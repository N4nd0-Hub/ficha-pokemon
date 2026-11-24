/* ============================================================
   V6 — Captura na aba de Batalha
   Regras Heaven & Hell:
   1) Arremesso: 1d100 ≤ Corpo + distância + tamanho + status
      (Dormindo/Paralisado +20). Crítico ≤ ¼ do Corpo → +10 no NAC.
      Exige a perícia Arremesso de Pokébola.
   2) Captura: 1d100 ≤ NAC.
      NAC = 30 + Vida + Pokébola + Dif. Nível + Raridade + Status
      (mínimo 5, máximo 95; Master Ball = automática).
      Alvo com 0 HP: Comum/Incomum captura automática; Raro NAC 50;
      Muito Raro/Lendário NAC 20.
   Versão simples: o Mestre informa raridade, nível, vida, status e a
   dificuldade do arremesso; na tela fica só a Poké Ball. No minigame,
   um anel fecha e abre em volta da bola e o tamanho do anel no
   clique vira o d100 do arremesso (funciona com Pokémon inventado).
   ============================================================ */
(function(){
  "use strict";
  const page=document.getElementById("page2");
  const box=page?.querySelector(".bt-box");
  if(!page||!box||box.querySelector('[data-bt-panel="capture"]')||typeof state==="undefined")return;

  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const sfx=n=>window.hhClassicSfx?.[n]?.();
  const reduce=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const wait=ms=>new Promise(r=>setTimeout(r,reduce()?Math.min(ms,60):ms));
  const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  const d100=()=>Math.floor(Math.random()*100)+1;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const signed=n=>`${n>=0?"+":"−"}${Math.abs(n)}`;
  const itemSprite=slug=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${encodeURIComponent(slug)}.png`;

  /* ---------- Tabelas das regras ---------- */
  const RARITY=[
    {id:"common",label:"Comum",mod:30},
    {id:"uncommon",label:"Incomum",mod:15},
    {id:"rare",label:"Raro",mod:0},
    {id:"veryrare",label:"Muito Raro",mod:-20},
    {id:"legendary",label:"Lendário",mod:-50}
  ];
  const STATUS=[
    {id:"none",label:"Nenhum",mod:0,throw:0},
    {id:"sleep",label:"Sleep",mod:30,throw:20},
    {id:"freeze",label:"Freeze",mod:30,throw:0},
    {id:"paralysis",label:"Paralysis",mod:15,throw:20},
    {id:"poison",label:"Poison",mod:15,throw:0},
    {id:"burn",label:"Burn",mod:15,throw:0},
    {id:"confusion",label:"Confusion",mod:0,throw:0}
  ];
  const DIFF=[
    {id:"veasy",label:"Muito fácil",mod:30,hint:"perto, alvo grande ou parado"},
    {id:"easy",label:"Fácil",mod:15,hint:"curta distância"},
    {id:"normal",label:"Normal",mod:0,hint:"situação comum"},
    {id:"hard",label:"Difícil",mod:-15,hint:"longe ou alvo ágil"},
    {id:"vhard",label:"Muito difícil",mod:-30,hint:"longe e alvo pequeno/ágil"}
  ];
  const HP=[{v:100,label:"76–100%"},{v:75,label:"51–75%"},{v:50,label:"26–50%"},{v:25,label:"1–25%"},{v:0,label:"0 HP"}];
  // Bolas que dependem da situação: o Mestre só marca se a condição vale.
  const COND={net:20,dive:20,dusk:30,safari:20,repeat:25};
  const lifeMod=pct=>pct<=25?40:pct<=50?20:pct<=75?10:0;
  function levelMod(diff){
    if(diff>=15)return -50;
    if(diff>=10)return -30;
    if(diff>=5)return -15;
    if(diff<=-10)return 20;
    if(diff<=-5)return 10;
    return 0;
  }

    /* ---------- Estado da tela ---------- */
  const saved=(()=>{try{return JSON.parse(store.get("hh_capture_v7","{}"))}catch(e){return{}}})();
  const S=Object.assign({
    name:"",level:5,myLevel:null,hp:100,rarity:"common",status:"none",diff:"normal",
    round:1,cond:false,ball:"",practice:false,mode:"minigame",gmOverride:false
  },saved);
  const persist=()=>store.set("hh_capture_v7",JSON.stringify(S));
  let busy=false,history=[],lastCaught=null;

  /* ---------- Treinador e Bolsa ---------- */
  const trainer=()=>typeof ensureTrainerData==="function"?ensureTrainerData():(state.trainer||{});
  const body=()=>typeof trainerAttributeValue==="function"?Number(trainerAttributeValue("body"))||0:Number(trainer().attributes?.body||0);
  function hasThrowSkill(){
    const norm=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
    return (trainer().skills||[]).some(s=>/arremesso/.test(norm(s.name))&&/pok/.test(norm(s.name)));
  }
  const qty=slug=>typeof bagQuantity==="function"?bagQuantity(slug):0;
  const RULES=()=>typeof CAPTURE_BALL_RULES!=="undefined"?CAPTURE_BALL_RULES:{};
  function allBalls(){
    const list=[],seen=new Set();
    const push=(slug,name)=>{if(!slug||seen.has(slug))return;seen.add(slug);list.push({slug,name});};
    if(typeof BAG_CONSUMABLE_BY_SLUG!=="undefined")BAG_CONSUMABLE_BY_SLUG.forEach((item,slug)=>{if(item?.bagGroup==="balls")push(slug,item.name);});
    Object.entries(RULES()).forEach(([slug,r])=>{if(!/^la/.test(slug))push(slug,r.label);});
    return list;
  }
  function availableBalls(){
    const all=allBalls().map(b=>({...b,qty:qty(b.slug)}));
    return S.practice?all.filter(b=>RULES()[b.slug]):all.filter(b=>b.qty>0);
  }
  const myLevel=()=>S.myLevel!=null?S.myLevel:Math.max(1,Number(current?.level||1));
  const ballName=slug=>allBalls().find(b=>b.slug===slug)?.name||RULES()[slug]?.label||"Poké Ball";

  /* ---------- Cálculos ---------- */
  function ballInfo(slug){
    const r=RULES()[slug];
    if(!slug)return {bonus:0,auto:false,cond:null,text:""};
    if(!r)return {bonus:0,auto:false,cond:null,text:"Sem regra própria • +0 NAC."};
    if(r.auto)return {bonus:0,auto:true,cond:null,text:r.text};
    let bonus=Number(r.base||0),cond=null;
    if(r.context==="nest")bonus=S.level<myLevel()?20:0;
    else if(r.context==="timer")bonus=Math.min(30,S.round*5);
    else if(r.context==="quick")bonus=S.round===1?30:0;
    else if(COND[r.context]){cond=COND[r.context];bonus=S.cond?cond:0;}
    return {bonus,auto:false,cond,context:r.context,text:r.text};
  }
  function throwData(){
    const st=STATUS.find(x=>x.id===S.status)||STATUS[0];
    const d=DIFF.find(x=>x.id===S.diff)||DIFF[2];
    const b=body();
    const target=clamp(b+d.mod+st.throw,1,99);
    return {body:b,target,crit:Math.min(target,Math.floor(b/4)),diff:d,st};
  }
  function nacData(crit=false){
    const ball=ballInfo(S.ball);
    const rarity=RARITY.find(r=>r.id===S.rarity)||RARITY[0];
    const st=STATUS.find(x=>x.id===S.status)||STATUS[0];
    const diff=S.level-myLevel();
    const parts=[
      ["Base",30],
      ["Vida",S.hp>0?lifeMod(S.hp):0],
      [ballName(S.ball),ball.auto?0:Number(ball.bonus||0)],
      [`Nível (${diff>=0?"+":""}${diff})`,levelMod(diff)],
      ["Raridade",rarity.mod],
      ["Status",st.mod]
    ];
    if(crit)parts.push(["Arremesso crítico",10]);
    if(ball.auto)return {auto:true,value:100,raw:100,parts,ball,note:"Master Ball: captura automática."};
    if(S.hp<=0){
      if(["common","uncommon"].includes(S.rarity))return {auto:true,value:100,raw:100,parts,ball,note:"0 HP + Comum/Incomum: captura automática."};
      const fixed=S.rarity==="rare"?50:20;
      const value=clamp(fixed+(crit?10:0),5,95);
      return {auto:false,value,raw:value,parts:[["0 HP • "+rarity.label,fixed],...(crit?[["Arremesso crítico",10]]:[])],ball,note:`Desmaiado: NAC fixo ${fixed}.`};
    }
    const raw=parts.reduce((s,[,v])=>s+v,0);
    return {auto:false,raw,value:clamp(raw,5,95),parts,ball,note:raw>95?"Limitado a 95.":raw<5?"Limitado a 5.":""};
  }

  /* ---------- Estrutura ---------- */
  const menuBtn=document.createElement("button");
  menuBtn.type="button";menuBtn.className="bt-cmd capture";menuBtn.dataset.btMenu="capture";menuBtn.textContent="CAPTURAR";
  box.querySelector(".bt-menu")?.appendChild(menuBtn);
  const panel=document.createElement("div");
  panel.className="bt-panel cp-panel";panel.dataset.btPanel="capture";panel.hidden=true;
  box.querySelector(".bt-panels")?.appendChild(panel);
  const chips=(key,list,lab=x=>x.label,val=x=>x.id,extra=()=> "")=>list.map(x=>`<button type="button" data-cp-set="${key}" data-v="${val(x)}" ${extra(x)}>${lab(x)}</button>`).join("");
  panel.innerHTML=`
    <div class="cp-layout">
      <div class="cp-stage-wrap">
        <div class="cp-stage" id="cpStage">
          <div class="cp-tag cp-tag-l"><small>ARREMESSO</small><b id="cpStThrow">0</b></div>
          <div class="cp-tag cp-tag-r"><small>NAC</small><b id="cpStNac">0</b></div>
          <div class="cp-who" id="cpWho"></div>
          <div class="cp-rings" id="cpRings">
            <i class="cp-zone ok"></i><i class="cp-zone crit"></i>
            <div class="cp-ballwrap" id="cpBallWrap"><img class="cp-ball" id="cpBall" alt=""></div>
            <i class="cp-ring" id="cpRing" hidden></i>
          </div>
          <div class="cp-hint" id="cpHint">Escolha a dificuldade e arremesse!</div>
          <div class="cp-fx" id="cpFx" aria-hidden="true"></div>
          <div class="cp-banner" id="cpBanner" hidden></div>
          <div class="cp-dice" id="cpDice" aria-live="polite"></div>
        </div>
        <div class="cp-actions">
          <div class="cp-mode" role="radiogroup" aria-label="Modo do arremesso">
            <button type="button" data-cp-set="mode" data-v="minigame">🎯 Minigame</button>
            <button type="button" data-cp-set="mode" data-v="dice">🎲 Dado</button>
          </div>
          <button type="button" class="cp-throw" id="cpThrow">ARREMESSAR!</button>
        </div>
        <div class="cp-after" id="cpAfter" hidden></div>
        <ol class="cp-log" id="cpLog"></ol>
        <details class="cp-rules">
          <summary>📖 Como funciona a captura</summary>
          <ol>
            <li><b>Minigame:</b> um anel fecha e abre em volta da Poké Ball. Clique (ou Espaço) quando ele estiver dentro do círculo verde. Dentro do dourado é <b>crítico</b> (+10 no NAC). O tamanho do anel vira o d100 do arremesso: anel pequeno = número baixo. No modo Dado, o d100 é rolado direto.</li>
            <li><b>Arremesso:</b> d100 ≤ Corpo + dificuldade (+20 se o alvo estiver dormindo ou paralisado). Crítico ≤ ¼ do Corpo. Precisa da perícia Arremesso de Pokébola.</li>
            <li><b>Captura:</b> d100 ≤ NAC. NAC = 30 + Vida + Poké Ball + Diferença de Nível + Raridade + Status, entre 5 e 95. Master Ball captura direto.</li>
            <li><b>Vida:</b> até 25% +40 · até 50% +20 · até 75% +10. <b>Nível</b> (selvagem − seu Pokémon): +5 → −15, +10 → −30, +15 → −50, −5 → +10, −10 → +20. <b>Raridade:</b> Comum +30, Incomum +15, Raro 0, Muito Raro −20, Lendário −50. <b>Status:</b> Sleep/Freeze +30, Paralysis/Poison/Burn +15.</li>
            <li><b>Desmaiado (0 HP):</b> Comum/Incomum captura automática; Raro NAC 50; Muito Raro/Lendário NAC 20.</li>
            <li><b>Dificuldade</b> (o Mestre escolhe pela cena): Muito fácil +30 · Fácil +15 · Normal 0 · Difícil −15 · Muito difícil −30.</li>
          </ol>
        </details>
      </div>
      <div class="cp-setup">
        <section class="cp-card">
          <h4>Pokémon selvagem</h4>
          <label class="cp-field"><span>Nome <em>(opcional — pode ser inventado)</em></span><input id="cpName" maxlength="40" placeholder="Ex.: Pikachu, Fakemon..." autocomplete="off"></label>
          <div class="cp-field"><span>Raridade</span><div class="cp-chips cp-rar">${chips("rarity",RARITY,r=>`${r.label} <small>${signed(r.mod)}</small>`,r=>r.id,r=>`class="r-${r.id}"`)}</div></div>
          <div class="cp-levels">
            <label class="cp-field"><span>Nível dele</span><span class="cp-num"><button type="button" data-cp-step="level" data-d="-1">−</button><input type="number" id="cpLevel" min="1" max="100"><button type="button" data-cp-step="level" data-d="1">+</button></span></label>
            <label class="cp-field"><span>Seu Pokémon <em id="cpMyName"></em></span><span class="cp-num"><button type="button" data-cp-step="myLevel" data-d="-1">−</button><input type="number" id="cpMyLevel" min="1" max="100"><button type="button" data-cp-step="myLevel" data-d="1">+</button></span></label>
          </div>
          <div class="cp-field"><span>Vida dele</span><div class="cp-chips cp-hpc">${chips("hp",HP,h=>h.label,h=>h.v)}</div></div>
          <div class="cp-field"><span>Status</span><div class="cp-chips cp-status">${chips("status",STATUS,s=>s.label,s=>s.id,s=>`class="st-${s.id}"`)}</div></div>
        </section>
        <section class="cp-card">
          <h4>Dificuldade do arremesso</h4>
          <div class="cp-diff">${DIFF.map(d=>`<button type="button" data-cp-set="diff" data-v="${d.id}" class="d-${d.id}"><b>${d.label}</b><small>${signed(d.mod)} · ${d.hint}</small></button>`).join("")}</div>
          <div class="cp-skill" id="cpSkill"></div>
        </section>
        <section class="cp-card">
          <h4>Poké Ball</h4>
          <div class="cp-balls" id="cpBalls"></div>
          <div class="cp-ballrule" id="cpBallRule"></div>
          <label class="cp-check"><input type="checkbox" id="cpPractice"> Treino: não gasta Poké Ball e mostra todas</label>
        </section>
        <section class="cp-card cp-odds">
          <div><small>ARREMESSO</small><b id="cpThrowPct">0%</b><span id="cpThrowTxt"></span></div>
          <div><small>CAPTURA (NAC)</small><b id="cpNac">0</b><span id="cpNacTxt"></span></div>
          <ul class="cp-parts" id="cpParts"></ul>
        </section>
      </div>
    </div>`;

  const $=id=>panel.querySelector("#"+id);
  const stage=$("cpStage"),rings=$("cpRings"),ballWrap=$("cpBallWrap"),ballEl=$("cpBall"),ring=$("cpRing"),fx=$("cpFx");

  /* ---------- Texto da caixa de batalha ---------- */
  let typing=0;
  function say(text){
    const el=box.querySelector("#btText");if(!el)return;
    clearInterval(typing);
    if(reduce()){el.textContent=text;return;}
    let i=0;el.textContent="";
    typing=setInterval(()=>{i++;el.textContent=text.slice(0,i);if(i%3===0)sfx("type");if(i>=text.length)clearInterval(typing);},18);
  }
  const hint=t=>{$("cpHint").textContent=t;};

  /* ---------- Render ---------- */
  function render(){
    if(!S.ball||(!S.practice&&qty(S.ball)<=0)){const first=availableBalls()[0];S.ball=first?.slug||"";}
    const t=throwData(),n=nacData(false),info=ballInfo(S.ball);
    if(!busy){ballEl.src=S.ball?itemSprite(S.ball):"";ballWrap.classList.toggle("empty",!S.ball);}
    rings.style.setProperty("--ok",t.target);rings.style.setProperty("--crit",t.crit);
    $("cpStThrow").textContent=`${t.target}%`;
    $("cpStNac").textContent=n.auto?"AUTO":n.value;
    const rar=RARITY.find(r=>r.id===S.rarity);
    $("cpWho").innerHTML=`<b>${esc(S.name||"Pokémon selvagem")}</b><span>Lv${S.level} · ${esc(rar.label)}${S.hp<=0?" · KO":S.status!=="none"?" · "+esc(STATUS.find(x=>x.id===S.status).label):""}</span>`;
    $("cpWho").className=`cp-who r-${S.rarity}`;

    if(document.activeElement!==$("cpName"))$("cpName").value=S.name;
    $("cpLevel").value=S.level;$("cpMyLevel").value=myLevel();
    $("cpMyName").textContent=current?.name?`(${current.name}${S.myLevel!=null?"":" • da ficha"})`:"";
    panel.querySelectorAll("[data-cp-set]").forEach(b=>{const on=String(S[b.dataset.cpSet])===b.dataset.v;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);});
    $("cpPractice").checked=!!S.practice;

    const skill=hasThrowSkill();
    $("cpSkill").innerHTML=`<span class="cp-body">Corpo ${t.body}${t.st.throw?` · ${t.st.label} +${t.st.throw}`:""} → acerta com <b>${t.target}</b> ou menos</span>`+(skill
      ?`<span class="ok">✓ Arremesso de Pokébola</span>`
      :`<span class="warn">✕ Sem a perícia Arremesso de Pokébola</span><label class="cp-check"><input type="checkbox" id="cpGm"${S.gmOverride?" checked":""}> Mestre liberou</label>`);

    const balls=availableBalls();
    $("cpBalls").innerHTML=balls.length?balls.map(b=>{
      const bi=ballInfo(b.slug);
      return `<button type="button" class="cp-ball-btn${b.slug===S.ball?" on":""}" data-cp-ball="${esc(b.slug)}" title="${esc(bi.text)}">
        <img src="${esc(itemSprite(b.slug))}" alt="" loading="lazy"><b>${esc(b.name)}</b>
        <small>${bi.auto?"AUTO":signed(Number(bi.bonus||0))}${S.practice?"":` · ×${b.qty}`}</small></button>`;
    }).join(""):`<p class="cp-empty">Nenhuma Poké Ball na Bolsa. Compre no Inventário de Viagem ou marque “Treino”.</p>`;
    let extra="";
    if(info.cond)extra=`<label class="cp-check cp-cond"><input type="checkbox" id="cpCond"${S.cond?" checked":""}> A condição vale agora (+${info.cond})</label>`;
    if(info.context==="timer"||info.context==="quick")extra=`<label class="cp-field cp-round"><span>Rodada do combate</span><span class="cp-num"><button type="button" data-cp-step="round" data-d="-1">−</button><input type="number" id="cpRound" min="1" max="99" value="${S.round}"><button type="button" data-cp-step="round" data-d="1">+</button></span></label>`;
    if(info.context==="nest")extra=`<small class="cp-auto">${info.bonus?"Ativa: o selvagem tem nível menor que o seu.":"Inativa: o selvagem não tem nível menor que o seu."}</small>`;
    $("cpBallRule").innerHTML=S.ball?`<p>${esc(info.text||"")}</p>${extra}`:"";

    $("cpThrowPct").textContent=`${t.target}%`;
    $("cpThrowTxt").textContent=`d100 ≤ ${t.target} · crítico ≤ ${t.crit}`;
    $("cpNac").textContent=n.auto?"AUTO":n.value;
    $("cpNacTxt").textContent=n.auto?n.note:`d100 ≤ ${n.value}${n.note?" · "+n.note:""}`;
    $("cpParts").innerHTML=n.parts.map(([l,v])=>`<li class="${v>0?"pos":v<0?"neg":""}"><span>${esc(l)}</span><b>${signed(v)}</b></li>`).join("")+
      `<li class="hint"><span>Se o arremesso for crítico</span><b>+10</b></li>`;
    const can=!busy&&!!S.ball&&(S.practice||qty(S.ball)>0)&&(skill||S.gmOverride);
    $("cpThrow").disabled=!can;
    $("cpThrow").textContent=busy?"…":"ARREMESSAR!";
    $("cpLog").innerHTML=history.slice(0,5).map(h=>`<li class="${h.cls}">${esc(h.text)}</li>`).join("");
  }

  /* ---------- Efeitos ---------- */
  async function anim(el,frames,opts){
    if(reduce()){const last=frames[frames.length-1];el.style.transform=last.transform||"";if(last.opacity!=null)el.style.opacity=last.opacity;return;}
    const a=el.animate(frames,{fill:"forwards",...opts});
    await a.finished.catch(()=>{});
  }
  function center(){const s=stage.getBoundingClientRect(),b=ballWrap.getBoundingClientRect();return {x:b.left-s.left+b.width/2,y:b.top-s.top+b.height/2};}
  function burst(kind,n=10){
    if(reduce())return;
    const c=center();
    for(let i=0;i<n;i++){
      const p=document.createElement("i");
      p.className=`cp-p ${kind}`;p.style.left=`${c.x}px`;p.style.top=`${c.y}px`;
      fx.appendChild(p);
      const ang=(Math.PI*2*i)/n+Math.random()*.3,dist=60+Math.random()*50;
      p.animate([{transform:"translate(-50%,-50%) scale(.3)",opacity:1},{transform:`translate(calc(-50% + ${Math.cos(ang)*dist}px),calc(-50% + ${Math.sin(ang)*dist}px)) scale(1.1) rotate(${ang*90}deg)`,opacity:0}],{duration:800,easing:"cubic-bezier(.2,.8,.3,1)"}).finished.then(()=>p.remove());
    }
  }
  function flash(color="#fff"){
    if(reduce())return;
    const f=document.createElement("i");f.className="cp-flash";f.style.background=`radial-gradient(circle,${color} 0,${color} 30%,transparent 70%)`;
    const c=center();f.style.left=`${c.x}px`;f.style.top=`${c.y}px`;fx.appendChild(f);
    f.animate([{transform:"translate(-50%,-50%) scale(.2)",opacity:1},{transform:"translate(-50%,-50%) scale(3)",opacity:0}],{duration:600,easing:"ease-out"}).finished.then(()=>f.remove());
  }
  function banner(text,cls){
    const b=$("cpBanner");b.textContent=text;b.className=`cp-banner ${cls}`;b.hidden=false;
    if(!reduce())b.animate([{transform:"translate(-50%,-50%) scale(.3)",opacity:0},{transform:"translate(-50%,-50%) scale(1.1)",opacity:1,offset:.6},{transform:"translate(-50%,-50%) scale(1)",opacity:1}],{duration:450,easing:"ease-out"});
  }
  function dice(label,roll,target,ok){
    const el=document.createElement("span");el.className=ok?"ok":"bad";
    el.innerHTML=`<small>${esc(label)}</small><b>${roll}</b><i>${ok?"≤":">"} ${target}</i>`;
    $("cpDice").appendChild(el);
    if(!reduce())el.animate([{transform:"scale(.5) rotate(-12deg)",opacity:0},{transform:"scale(1.15)",opacity:1,offset:.6},{transform:"none"}],{duration:380});
  }
  function resetScene(){
    $("cpBanner").hidden=true;$("cpDice").innerHTML="";fx.innerHTML="";
    [ballWrap,ballEl].forEach(el=>{el.getAnimations().forEach(a=>a.cancel());el.style.transform="";el.style.opacity="";el.style.filter="";});
    ballWrap.classList.remove("caught","idle-off");ring.hidden=true;rings.classList.remove("aiming");
  }

  /* ---------- Minigame: anel em volta da Poké Ball ---------- */
  function aim(target,crit){
    return new Promise(resolve=>{
      ring.hidden=false;rings.classList.add("aiming");ballWrap.classList.add("idle-off");
      // quanto mais difícil o arremesso, mais rápido o anel
      const period=Math.max(700,1700-(100-target)*10);
      let t0=performance.now(),raf=0,k=1,done=false;
      const tick=now=>{
        const ph=((now-t0)%(period*2))/period;
        const e=ph<=1?ph:2-ph;               // 0→1→0
        k=clamp(1-e*.99+Math.sin(now/110)*.006,.01,1); // fecha e abre
        const roll=Math.round(k*99)+1;
        ring.style.width=ring.style.height=`${k*100}%`;
        ring.className=`cp-ring ${roll<=crit?"crit":roll<=target?"ok":"bad"}`;
        raf=requestAnimationFrame(tick);
      };
      raf=requestAnimationFrame(tick);
      const stop=e=>{
        if(done)return;
        if(e.type==="keydown"&&e.code!=="Space"&&e.key!=="Enter")return;
        e.preventDefault();done=true;
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown",stop,true);stage.removeEventListener("pointerdown",stop);
        const roll=clamp(Math.round(k*99)+1,1,100);
        sfx("select");
        if(!reduce())ring.animate([{transform:"translate(-50%,-50%) scale(1)"},{transform:"translate(-50%,-50%) scale(1.08)"},{transform:"translate(-50%,-50%) scale(1)"}],{duration:200});
        setTimeout(()=>{ring.hidden=true;rings.classList.remove("aiming");resolve(roll);},420);
      };
      setTimeout(()=>{document.addEventListener("keydown",stop,true);stage.addEventListener("pointerdown",stop);},150);
      hint("Clique quando o anel estiver no círculo verde!");
      say("Mire! Solte a Poké Ball quando o anel ficar verde.");
    });
  }

  /* ---------- Fluxo ---------- */
  async function throwBall(){
    if(busy)return;
    if(!S.ball){say("Escolha uma Poké Ball.");return;}
    busy=true;resetScene();render();
    const t=throwData(),bn=ballName(S.ball),who=(S.name||"o Pokémon selvagem");
    let roll;
    if(S.mode==="minigame")roll=await aim(t.target,t.crit);
    else{say(`${(trainer().name||"Treinador").toUpperCase()} arremessou uma ${bn.toUpperCase()}!`);roll=d100();await wait(200);}
    const hit=roll<=t.target,crit=hit&&roll<=t.crit;
    dice("Arremesso",roll,t.target,hit);
    ballWrap.classList.add("idle-off");sfx("page");
    if(!hit){
      hint("A Poké Ball passou longe...");
      const side=Math.random()<.5?-1:1;
      await anim(ballWrap,[{transform:"none"},{transform:`translate(${side*40}px,-90px) rotate(${side*300}deg) scale(.8)`,offset:.45},{transform:`translate(${side*170}px,40px) rotate(${side*720}deg) scale(.6)`,opacity:0}],{duration:900,easing:"ease-in"});
      banner("ERROU!","miss");sfx("error");
      say(`${roll} > ${t.target}. A ${bn} errou ${who}!`);
      log(`Arremesso ${roll}/${t.target}: errou`,"bad");
      showAfter("miss");
      busy=false;render();return;
    }
    // sobe girando, abre com um clarão e cai no chão
    hint(crit?"ARREMESSO CRÍTICO! +10 no NAC":"Acertou em cheio!");
    say(crit?`Arremesso perfeito! (${roll} ≤ ${t.crit}) +10 no NAC!`:`Acertou! (${roll} ≤ ${t.target})`);
    if(crit)burst("stars",12);
    await anim(ballWrap,[{transform:"none"},{transform:"translateY(-110px) rotate(540deg) scale(.75)",offset:.6},{transform:"translateY(-120px) rotate(720deg) scale(.8)"}],{duration:620,easing:"cubic-bezier(.2,.7,.3,1)"});
    flash("#ffffff");flash("#ff6b6b");sfx("page");
    await wait(200);
    await anim(ballWrap,[{transform:"translateY(-120px) rotate(720deg) scale(.8)"},{transform:"translateY(0) rotate(720deg) scale(1)",offset:.55,easing:"ease-in"},{transform:"translateY(-26px) rotate(720deg)",offset:.75,easing:"ease-out"},{transform:"translateY(0) rotate(720deg)"}],{duration:620});
    ballWrap.style.transform="";ballWrap.getAnimations().forEach(a=>a.cancel());
    // rolagem de captura
    const n=nacData(crit);
    const capRoll=n.auto?null:d100();
    const ok=n.auto||capRoll<=n.value;
    if(!S.practice&&typeof changeBagQuantity==="function"){changeBagQuantity(S.ball,-1,{render:false,save:false});try{updateDrawerPocketSummary();renderDrawerBag();renderCombatBag();saveState();}catch(e){}}
    const margin=ok?0:capRoll-n.value;
    const shakes=ok?3:margin<=10?3:margin<=25?2:1;
    hint(`NAC ${n.auto?"AUTO":n.value}... segura!`);
    for(let i=0;i<shakes;i++){
      await wait(i?520:420);
      sfx("type");
      stage.classList.add("tense");
      await anim(ballWrap,[{transform:"rotate(0)"},{transform:"translateX(-6px) rotate(-30deg)"},{transform:"translateX(6px) rotate(26deg)"},{transform:"translateX(-2px) rotate(-8deg)"},{transform:"rotate(0)"}],{duration:620,easing:"ease-in-out"});
      stage.classList.remove("tense");
      say(["...","... ...","... ... ..."][i]);hint(["1...","2...","3..."][i]);
    }
    await wait(450);
    if(capRoll!=null)dice("Captura",capRoll,n.value,ok);
    if(ok){
      sfx("page");
      ballWrap.classList.add("caught");
      burst("stars",14);
      banner("GOTCHA!","ok");hint("Capturado!");
      say(`Gotcha! ${(S.name||"O Pokémon").toUpperCase()} foi capturado!${capRoll!=null?` (${capRoll} ≤ ${n.value})`:""}${S.ball==="heal-ball"?" A Heal Ball curou o Pokémon.":""}${S.ball==="luxury-ball"?" A Luxury Ball melhora a amizade inicial.":""}`);
      log(`${S.name||"Pokémon"} capturado ${capRoll!=null?`${capRoll}/${n.value}`:"(auto)"} com ${bn}`,"ok");
      lastCaught={name:S.name,level:S.level,ball:S.ball,ballName:bn};
      showAfter("caught");
    }else{
      sfx("error");
      flash("#ff4b4b");burst("flash",10);
      await anim(ballWrap,[{transform:"none",opacity:1},{transform:"scale(1.35)",opacity:0,offset:.5},{transform:"scale(.6)",opacity:0}],{duration:420});
      banner(shakes>=3?"QUASE!":"ESCAPOU!","bad");hint(`Faltou ${margin}.`);
      say(`Ah não! ${who.toUpperCase()} escapou! (${capRoll} > ${n.value})`);
      log(`Escapou ${capRoll}/${n.value} com ${bn}`,"bad");
      S.round=Math.min(99,S.round+1);persist();
      showAfter("escaped");
    }
    busy=false;render();
  }
  function log(text,cls){history.unshift({text,cls});history=history.slice(0,8);}
  function showAfter(kind){
    const el=$("cpAfter");el.hidden=false;
    if(kind==="miss"){
      el.innerHTML=S.practice?`<span>Treino: nenhuma Poké Ball foi gasta.</span><button type="button" data-cp-after="reset">TENTAR DE NOVO</button>`
        :`<span>O Mestre decide se a Poké Ball foi perdida.</span><button type="button" data-cp-after="lose">PERDIDA (−1)</button><button type="button" data-cp-after="reset">RECUPERADA</button>`;
    }else if(kind==="caught"){
      el.innerHTML=`<span>Capturado!</span><button type="button" class="primary" data-cp-after="register">MANDAR PARA O PC</button><button type="button" data-cp-after="new">NOVA CAPTURA</button>`;
    }else{
      el.innerHTML=`<span>Rodada ${S.round} — tente de novo.</span><button type="button" data-cp-after="reset">CONTINUAR</button>`;
    }
  }
  async function registerCaught(){
    if(!lastCaught||typeof createBlankPokemon!=="function")return;
    const back=current?.id;
    const c=lastCaught;lastCaught=null;
    $("cpAfter").innerHTML="<span>Registrando no PC…</span>";
    try{
      createBlankPokemon();
      const q=String(c.name||"").trim().toLowerCase().replace(/\s+/g,"-");
      let real=false;
      if(q&&typeof searchPokemonFromApi==="function"){
        real=await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(q)}`,{method:"GET"}).then(r=>r.ok).catch(()=>false);
        if(real)await searchPokemonFromApi(q);
      }
      const p=current;
      if(!real)p.name=c.name||"Pokémon capturado";
      p.storageGroup="box";
      p.level=c.level;
      p.notes=[p.notes,`Capturado com ${c.ballName} (nível ${c.level}).`].filter(Boolean).join("\n");
      if(c.ball==="luxury-ball")p.happiness=Math.max(Number(p.happiness||0),120);
      if(typeof syncLevelDependentData==="function")try{syncLevelDependentData(p);}catch(e){}
      const prev=(state.pokemon||[]).find(x=>x.id===back);
      if(prev){state.currentId=prev.id;current=prev;}
      renderAll();saveState();
      say(`${(c.name||"O Pokémon").toUpperCase()} foi enviado para o PC!${real?"":" Complete a ficha dele no PC."}`);
      if(typeof showToast==="function")showToast(`📦 ${c.name||"Pokémon"} foi para o PC`);
    }catch(e){say("Não consegui registrar automaticamente. Crie o Pokémon pelo PC.");}
    $("cpAfter").hidden=true;resetScene();render();
  }

  /* ---------- Eventos ---------- */
  panel.addEventListener("click",e=>{
    const t=e.target;
    const set=t.closest("[data-cp-set]");
    if(set&&!busy){const k=set.dataset.cpSet;S[k]=k==="hp"?Number(set.dataset.v):set.dataset.v;persist();render();sfx("select");return;}
    const step=t.closest("[data-cp-step]");
    if(step&&!busy){const k=step.dataset.cpStep,max=k==="round"?99:100;const base=k==="myLevel"?myLevel():S[k];S[k]=clamp(base+Number(step.dataset.d),1,max);persist();render();sfx("select");return;}
    const bb=t.closest("[data-cp-ball]");if(bb&&!busy){S.ball=bb.dataset.cpBall;S.cond=false;persist();render();sfx("select");return;}
    const af=t.closest("[data-cp-after]");
    if(af){
      const a=af.dataset.cpAfter;
      if(a==="lose"&&typeof changeBagQuantity==="function"){changeBagQuantity(S.ball,-1,{render:false,save:false});try{updateDrawerPocketSummary();renderDrawerBag();renderCombatBag();saveState();}catch(err){}}
      if(a==="register"){registerCaught();return;}
      if(a==="new"){S.round=1;S.hp=100;S.status="none";S.name="";persist();}
      $("cpAfter").hidden=true;resetScene();hint("Escolha a dificuldade e arremesse!");render();return;
    }
    if(t.closest("#cpThrow")){$("cpAfter").hidden=true;throwBall();}
  });
  panel.addEventListener("change",e=>{
    const t=e.target;
    if(t.id==="cpLevel")S.level=clamp(Math.trunc(Number(t.value)||1),1,100);
    if(t.id==="cpMyLevel")S.myLevel=clamp(Math.trunc(Number(t.value)||1),1,100);
    if(t.id==="cpRound")S.round=clamp(Math.trunc(Number(t.value)||1),1,99);
    if(t.id==="cpCond")S.cond=t.checked;
    if(t.id==="cpPractice"){S.practice=t.checked;S.ball="";}
    if(t.id==="cpGm")S.gmOverride=t.checked;
    persist();render();
  });
  panel.addEventListener("input",e=>{if(e.target.id==="cpName"){S.name=e.target.value.slice(0,40);persist();render();}});
  // Seu Pokémon segue a ficha; se trocar de Pokémon, volta a ler o nível dela.
  let lastCurrent=current?.id;
  menuBtn.addEventListener("click",()=>setTimeout(()=>{render();say(S.name?`${S.name.toUpperCase()} está à espera. Escolha a Poké Ball!`:"O Mestre define a cena; escolha a Poké Ball e arremesse!");},30));

  ["renderCombatPage","renderAll"].forEach(fn=>{
    const orig=window[fn];if(typeof orig!=="function")return;
    window[fn]=function(){const r=orig.apply(this,arguments);if(current?.id!==lastCurrent){lastCurrent=current?.id;S.myLevel=null;persist();}if(!panel.hidden&&!busy)render();return r;};
  });
  if(box.querySelector(".bt-cmd.active")==null&&store.get("hh_bt_menu","")==="capture")menuBtn.click();
  render();
  window.hhCapture={rules:{lifeMod,levelMod,RARITY,STATUS,DIFF},nacData,throwData,state:S,render};
})();
