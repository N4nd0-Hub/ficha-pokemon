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
   O arremesso pode ser rolado no dado ou no minigame de mira
   (a posição em que o jogador para a mira vira o resultado do d100).
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
  const DIST=[{id:"short",label:"Curta",mod:20},{id:"normal",label:"Normal",mod:0},{id:"long",label:"Longa",mod:-20}];
  const SIZE=[{id:"small",label:"Pequeno / ágil",mod:-10},{id:"normal",label:"Normal",mod:0},{id:"big",label:"Grande / parado",mod:10}];
  const ENV=[["normal","Normal"],["water","Água / mergulho"],["fishing","Pesca"],["night","Noite"],["cave","Caverna"],["safari","Safari"]];
  const ARENA={normal:"forest",water:"water",fishing:"water",night:"night",cave:"cave",safari:"desert"};
  const lifeMod=pct=>pct<=25?40:pct<=50?20:pct<=75?10:0;
  function levelMod(diff){
    if(diff>=15)return -50;
    if(diff>=10)return -30;
    if(diff>=5)return -15;
    if(diff<=-10)return 20;
    if(diff<=-5)return 10;
    return 0;
  }
  function suggestRarity(sp){
    if(!sp)return null;
    if(sp.is_legendary||sp.is_mythical)return "legendary";
    const r=Number(sp.capture_rate);
    if(r>=200)return "common";
    if(r>=120)return "uncommon";
    if(r>=45)return "rare";
    return "veryrare";
  }

  /* ---------- Estado da tela ---------- */
  const saved=(()=>{try{return JSON.parse(store.get("hh_capture_v6","{}"))}catch(e){return{}}})();
  const S=Object.assign({
    species:"",display:"",sprite:"",types:[],level:5,hp:100,rarity:"common",rarityAuto:null,status:"none",
    dist:"normal",size:"normal",env:"normal",round:1,repeat:false,ball:"",practice:false,
    mode:"minigame",gmOverride:false
  },saved);
  const persist=()=>store.set("hh_capture_v6",JSON.stringify(S));
  let busy=false,history=[],lastCaught=null,shownDisplay=null;

  /* ---------- Treinador e Bolsa ---------- */
  const trainer=()=>typeof ensureTrainerData==="function"?ensureTrainerData():(state.trainer||{});
  const body=()=>typeof trainerAttributeValue==="function"?Number(trainerAttributeValue("body"))||0:Number(trainer().attributes?.body||0);
  function hasThrowSkill(){
    const norm=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
    return (trainer().skills||[]).some(s=>/arremesso/.test(norm(s.name))&&/pok/.test(norm(s.name)));
  }
  const qty=slug=>typeof bagQuantity==="function"?bagQuantity(slug):0;
  function allBalls(){
    const list=[];
    const seen=new Set();
    const push=(slug,name)=>{if(!slug||seen.has(slug))return;seen.add(slug);list.push({slug,name});};
    if(typeof BAG_CONSUMABLE_BY_SLUG!=="undefined")BAG_CONSUMABLE_BY_SLUG.forEach((item,slug)=>{if(item?.bagGroup==="balls")push(slug,item.name);});
    if(typeof CAPTURE_BALL_RULES!=="undefined")Object.entries(CAPTURE_BALL_RULES).forEach(([slug,r])=>{if(!/^la/.test(slug))push(slug,r.label);});
    return list;
  }
  function availableBalls(){
    const all=allBalls();
    if(S.practice)return all.filter(b=>typeof CAPTURE_BALL_RULES!=="undefined"&&CAPTURE_BALL_RULES[b.slug]).map(b=>({...b,qty:qty(b.slug)}));
    return all.map(b=>({...b,qty:qty(b.slug)})).filter(b=>b.qty>0);
  }

  /* ---------- Cálculos ---------- */
  function ballInfo(slug){
    if(!slug)return {bonus:0,auto:false,title:"Sem Poké Ball",text:""};
    const ctx={type1:S.types[0]||"",type2:S.types[1]||"",level:S.level,round:S.round,environment:S.env,repeat:S.repeat};
    try{return captureBallBonusFor(slug,ctx);}catch(e){return {bonus:0,auto:false,title:slug,text:""};}
  }
  function throwData(){
    const st=STATUS.find(x=>x.id===S.status)||STATUS[0];
    const dist=DIST.find(x=>x.id===S.dist)||DIST[1];
    const size=SIZE.find(x=>x.id===S.size)||SIZE[1];
    const b=body();
    const target=clamp(b+dist.mod+size.mod+st.throw,0,100);
    return {body:b,target,crit:Math.floor(b/4),parts:[["Corpo",b],["Distância",dist.mod],["Tamanho",size.mod],["Status",st.throw]]};
  }
  function nacData(crit=false){
    const ball=ballInfo(S.ball);
    const rarity=RARITY.find(r=>r.id===S.rarity)||RARITY[0];
    const st=STATUS.find(x=>x.id===S.status)||STATUS[0];
    const myLevel=Number(current?.level||1);
    const diff=S.level-myLevel;
    const parts=[
      ["Base",30],
      ["Vida",S.hp>0?lifeMod(S.hp):0],
      ["Poké Ball",ball.auto?0:Number(ball.bonus||0)],
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
      return {auto:false,value,raw:value,parts:[["0 HP • "+rarity.label,fixed],...(crit?[["Arremesso crítico",10]]:[])],ball,note:`Pokémon desmaiado: NAC ${fixed}${crit?" +10 do crítico":""}.`};
    }
    const raw=parts.reduce((s,[,v])=>s+v,0);
    return {auto:false,raw,value:clamp(raw,5,95),parts,ball,note:raw>95?"Limitado ao máximo de 95.":raw<5?"Limitado ao mínimo de 5.":""};
  }

  /* ---------- Estrutura ---------- */
  const menuBtn=document.createElement("button");
  menuBtn.type="button";menuBtn.className="bt-cmd capture";menuBtn.dataset.btMenu="capture";menuBtn.textContent="CAPTURAR";
  box.querySelector(".bt-menu")?.appendChild(menuBtn);
  const panel=document.createElement("div");
  panel.className="bt-panel cp-panel";panel.dataset.btPanel="capture";panel.hidden=true;
  box.querySelector(".bt-panels")?.appendChild(panel);
  panel.innerHTML=`
    <div class="cp-layout">
      <div class="cp-stage-wrap">
        <div class="cp-scene" id="cpScene">
          <div class="cp-hud">
            <div class="cp-hud-name"><b id="cpName">???</b><span id="cpLevel">Lv5</span></div>
            <div class="cp-hud-hp"><small>HP</small><i><i id="cpHpBar"></i></i></div>
            <div class="cp-hud-tags" id="cpHudTags"></div>
          </div>
          <img class="cp-platform" alt="" aria-hidden="true">
          <div class="cp-target"><img id="cpTarget" alt=""></div>
          <img class="cp-ball" id="cpBall" alt="" aria-hidden="true">
          <div class="cp-fx" id="cpFx" aria-hidden="true"></div>
          <div class="cp-aim" id="cpAim" hidden>
            <div class="cp-aim-label">MIRA! Clique ou aperte Espaço</div>
            <div class="cp-aim-bar"><i class="crit"></i><i class="ok"></i><b id="cpAimMarker"></b></div>
            <div class="cp-aim-scale"><span>1</span><span id="cpAimTarget">50</span><span>100</span></div>
          </div>
          <div class="cp-banner" id="cpBanner" hidden></div>
          <div class="cp-dice" id="cpDice" aria-live="polite"></div>
        </div>
        <div class="cp-actions">
          <div class="cp-mode" role="radiogroup" aria-label="Modo do arremesso">
            <button type="button" data-cp-mode="minigame">🎯 Minigame</button>
            <button type="button" data-cp-mode="dice">🎲 Dado</button>
          </div>
          <button type="button" class="cp-throw" id="cpThrow">ARREMESSAR!</button>
        </div>
        <div class="cp-after" id="cpAfter" hidden></div>
        <ol class="cp-log" id="cpLog"></ol>
        <details class="cp-rules">
          <summary>📖 Como funciona a captura</summary>
          <ol>
            <li><b>Arremesso:</b> 1d100 ≤ Corpo, com +20 a curta distância, −20 longa, −10 alvo pequeno/ágil, +10 alvo grande/parado e +20 se ele estiver dormindo ou paralisado. Resultado ≤ ¼ do Corpo é <b>crítico</b> (+10 no NAC). Precisa da perícia Arremesso de Pokébola.</li>
            <li><b>Captura:</b> 1d100 ≤ NAC. NAC = 30 + Vida + Poké Ball + Diferença de Nível + Raridade + Status, entre 5 e 95. Master Ball captura direto.</li>
            <li><b>Vida:</b> até 25% +40 · até 50% +20 · até 75% +10. <b>Nível</b> (alvo − seu Pokémon): +5 → −15, +10 → −30, +15 → −50, −5 → +10, −10 → +20. <b>Raridade:</b> Comum +30, Incomum +15, Raro 0, Muito Raro −20, Lendário −50. <b>Status:</b> Sleep/Freeze +30, Paralysis/Poison/Burn +15.</li>
            <li><b>Desmaiado (0 HP):</b> Comum/Incomum captura automática; Raro NAC 50; Muito Raro/Lendário NAC 20.</li>
            <li><b>Minigame:</b> a mira vira o resultado do d100 do arremesso — pare na faixa verde (amarela = crítico). Quanto mais difícil o arremesso, mais rápida a mira. No modo Dado, a rolagem é automática.</li>
          </ol>
        </details>
      </div>
      <div class="cp-setup">
        <section class="cp-card">
          <h4>Pokémon selvagem</h4>
          <form class="cp-search" id="cpSearch">
            <input id="cpSpecies" placeholder="Nome ou nº (ex.: pikachu, 25)" autocomplete="off" aria-label="Pokémon alvo">
            <button type="submit">BUSCAR</button>
          </form>
          <div class="cp-row">
            <label><span>Nível</span><input type="number" id="cpLevelIn" min="1" max="100"></label>
            <label><span>Raridade</span><select id="cpRarity">${RARITY.map(r=>`<option value="${r.id}">${r.label} (${signed(r.mod)})</option>`).join("")}</select></label>
          </div>
          <label class="cp-hp"><span>HP do alvo: <b id="cpHpLabel">100%</b></span>
            <input type="range" id="cpHp" min="0" max="100" step="1">
          </label>
          <div class="cp-chips" id="cpHpChips">${[100,75,50,25,10,0].map(v=>`<button type="button" data-cp-hp="${v}">${v===0?"0 HP":v+"%"}</button>`).join("")}</div>
          <div class="cp-chips cp-status" id="cpStatus">${STATUS.map(s=>`<button type="button" data-cp-status="${s.id}" class="st-${s.id}">${s.label}</button>`).join("")}</div>
        </section>
        <section class="cp-card">
          <h4>Arremesso</h4>
          <div class="cp-seg" data-cp-seg="dist">${DIST.map(d=>`<button type="button" data-v="${d.id}">${d.label} <small>${signed(d.mod)}</small></button>`).join("")}</div>
          <div class="cp-seg" data-cp-seg="size">${SIZE.map(d=>`<button type="button" data-v="${d.id}">${d.label} <small>${signed(d.mod)}</small></button>`).join("")}</div>
          <div class="cp-skill" id="cpSkill"></div>
        </section>
        <section class="cp-card">
          <h4>Poké Ball</h4>
          <div class="cp-balls" id="cpBalls"></div>
          <label class="cp-check"><input type="checkbox" id="cpPractice"> Treino: não gasta Poké Ball e mostra todas</label>
          <div class="cp-row cp-ctx">
            <label><span>Ambiente</span><select id="cpEnv">${ENV.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></label>
            <label><span>Rodada</span><input type="number" id="cpRound" min="1" max="99"></label>
          </div>
          <label class="cp-check"><input type="checkbox" id="cpRepeat"> Espécie já registrada na Dex</label>
          <p class="cp-ballrule" id="cpBallRule"></p>
        </section>
        <section class="cp-card cp-odds">
          <div><small>ARREMESSO</small><b id="cpThrowPct">0%</b><span id="cpThrowTxt"></span></div>
          <div><small>CAPTURA (NAC)</small><b id="cpNac">0</b><span id="cpNacTxt"></span></div>
          <ul class="cp-parts" id="cpParts"></ul>
        </section>
      </div>
    </div>`;

  const $=id=>panel.querySelector("#"+id);
  const scene=$("cpScene"),ballEl=$("cpBall"),targetWrap=panel.querySelector(".cp-target"),targetImg=$("cpTarget"),fx=$("cpFx");

  /* ---------- Texto da caixa de batalha ---------- */
  let typing=0;
  function say(text){
    const el=box.querySelector("#btText");if(!el)return;
    clearInterval(typing);
    if(reduce()){el.textContent=text;return;}
    let i=0;el.textContent="";
    typing=setInterval(()=>{i++;el.textContent=text.slice(0,i);if(i%3===0)sfx("type");if(i>=text.length)clearInterval(typing);},18);
  }

  /* ---------- Render ---------- */
  function render(){
    if(!S.ball||(!S.practice&&qty(S.ball)<=0)){const first=availableBalls()[0];S.ball=first?.slug||"";}
    const env=ARENA[S.env]||"forest";
    scene.style.backgroundImage=`url("assets/arenas/${env}.png")`;
    panel.querySelector(".cp-platform").src=`assets/arenas/${env}-platform.png`;
    $("cpName").textContent=(S.display||"Pokémon selvagem").toUpperCase();
    $("cpLevel").textContent=`Lv${S.level}`;
    const bar=$("cpHpBar");bar.style.width=`${S.hp}%`;bar.className=S.hp>50?"ok":S.hp>20?"mid":"low";
    const st=STATUS.find(x=>x.id===S.status);
    $("cpHudTags").innerHTML=`${(S.types||[]).map(t=>typeof typeIconHtml==="function"?typeIconHtml(t,true):`<span>${esc(t)}</span>`).join("")}${S.status!=="none"?`<em class="st-${S.status}">${esc(st.label.slice(0,3).toUpperCase())}</em>`:""}${S.hp<=0?'<em class="st-ko">KO</em>':""}`;
    if(S.sprite){targetImg.src=S.sprite;targetImg.alt=S.display;targetWrap.classList.remove("empty");}
    else{targetImg.removeAttribute("src");targetWrap.classList.add("empty");}
    targetWrap.classList.toggle("ko",S.hp<=0);
    targetWrap.classList.toggle("sleep",S.status==="sleep");
    if(!busy){ballEl.src=S.ball?itemSprite(S.ball):"";ballEl.style.opacity=S.ball?1:0;}

    if(shownDisplay!==S.display){$("cpSpecies").value=S.display||"";shownDisplay=S.display;}
    $("cpLevelIn").value=S.level;$("cpRarity").value=S.rarity;
    $("cpHp").value=S.hp;$("cpHpLabel").textContent=S.hp<=0?"0 HP (desmaiado)":`${S.hp}%`;
    panel.querySelectorAll("[data-cp-hp]").forEach(b=>b.classList.toggle("on",Number(b.dataset.cpHp)===S.hp));
    panel.querySelectorAll("[data-cp-status]").forEach(b=>b.classList.toggle("on",b.dataset.cpStatus===S.status));
    panel.querySelectorAll('[data-cp-seg="dist"] [data-v]').forEach(b=>b.classList.toggle("on",b.dataset.v===S.dist));
    panel.querySelectorAll('[data-cp-seg="size"] [data-v]').forEach(b=>b.classList.toggle("on",b.dataset.v===S.size));
    panel.querySelectorAll("[data-cp-mode]").forEach(b=>{b.classList.toggle("on",b.dataset.cpMode===S.mode);b.setAttribute("aria-checked",b.dataset.cpMode===S.mode);});
    $("cpEnv").value=S.env;$("cpRound").value=S.round;$("cpRepeat").checked=!!S.repeat;$("cpPractice").checked=!!S.practice;
    const rarityNote=S.rarityAuto?` <small class="cp-auto">sugerida pela PokéAPI: ${esc(RARITY.find(r=>r.id===S.rarityAuto)?.label||"")}</small>`:"";
    $("cpRarity").parentElement.querySelector("span").innerHTML=`Raridade${rarityNote}`;

    const skill=hasThrowSkill();
    $("cpSkill").innerHTML=skill
      ?`<span class="ok">✓ Perícia Arremesso de Pokébola</span>`
      :`<span class="warn">✕ Sem a perícia Arremesso de Pokébola</span><label class="cp-check"><input type="checkbox" id="cpGm"${S.gmOverride?" checked":""}> Mestre liberou o arremesso</label>`;

    const balls=availableBalls();
    $("cpBalls").innerHTML=balls.length?balls.map(b=>{
      const info=ballInfo(b.slug);
      return `<button type="button" class="cp-ball-btn${b.slug===S.ball?" on":""}" data-cp-ball="${esc(b.slug)}" title="${esc(info.title)}">
        <img src="${esc(itemSprite(b.slug))}" alt="" loading="lazy"><b>${esc(b.name)}</b>
        <small>${info.auto?"AUTO":signed(Number(info.bonus||0))}${S.practice?"":` · ×${b.qty}`}</small></button>`;
    }).join(""):`<p class="cp-empty">Nenhuma Poké Ball na Bolsa. Compre no Inventário de Viagem ou marque “Treino”.</p>`;
    const info=ballInfo(S.ball);
    $("cpBallRule").innerHTML=S.ball?`<b>${esc(info.title)}</b> ${esc(info.text||"")}`:"";

    const t=throwData(),n=nacData(false);
    $("cpThrowPct").textContent=`${t.target}%`;
    $("cpThrowTxt").textContent=`d100 ≤ ${t.target} · crítico ≤ ${t.crit}`;
    $("cpNac").textContent=n.auto?"AUTO":n.value;
    $("cpNacTxt").textContent=n.auto?n.note:`d100 ≤ ${n.value}${n.note?" · "+n.note:""}`;
    $("cpParts").innerHTML=n.parts.map(([l,v])=>`<li class="${v>0?"pos":v<0?"neg":""}"><span>${esc(l)}</span><b>${signed(v)}</b></li>`).join("")+
      `<li class="hint"><span>Crítico no arremesso</span><b>+10</b></li>`;
    const can=!busy&&!!S.ball&&(S.practice||qty(S.ball)>0)&&(skill||S.gmOverride);
    $("cpThrow").disabled=!can;
    $("cpThrow").textContent=busy?"…":"ARREMESSAR!";
    $("cpLog").innerHTML=history.slice(0,5).map(h=>`<li class="${h.cls}">${esc(h.text)}</li>`).join("");
  }

  /* ---------- Busca do alvo (PokéAPI) ---------- */
  async function loadSpecies(q){
    const query=String(q||"").trim().toLowerCase().replace(/\s+/g,"-");
    if(!query)return;
    say(`Procurando ${query.toUpperCase()}...`);
    try{
      const res=await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(query)}`);
      if(!res.ok)throw new Error("404");
      const p=await res.json();
      const sp=await fetch(p.species?.url).then(r=>r.ok?r.json():null).catch(()=>null);
      const ptName=sp?.names?.find(n=>n.language?.name==="en")?.name||p.name;
      S.species=p.name;S.display=ptName;
      S.sprite=p.sprites?.other?.showdown?.front_default||p.sprites?.front_default||p.sprites?.other?.["official-artwork"]?.front_default||"";
      S.types=(p.types||[]).map(t=>t.type.name[0].toUpperCase()+t.type.name.slice(1));
      const sug=suggestRarity(sp);
      S.rarityAuto=sug;if(sug)S.rarity=sug;
      S.hp=100;S.status="none";S.round=1;
      const reg=(state.pokemon||[]).some(x=>String(x.name||"").toLowerCase()===p.name||String(x.apiData?.species||"").toLowerCase()===p.name);
      S.repeat=reg;
      persist();render();
      sfx("page");say(`Um ${ptName.toUpperCase()} selvagem apareceu!`);
      if(!reduce())targetWrap.animate([{transform:"translateX(60px)",opacity:0},{transform:"none",opacity:1}],{duration:500,easing:"cubic-bezier(.2,.9,.3,1.2)"});
    }catch(e){
      say("Não encontrei esse Pokémon na PokéAPI. Confira o nome em inglês ou o número.");sfx("error");
    }
  }

  /* ---------- Animações ---------- */
  function geom(){
    const s=scene.getBoundingClientRect(),t=targetWrap.getBoundingClientRect();
    return {w:s.width,h:s.height,start:{x:s.width*.1,y:s.height*.86},target:{x:t.left-s.left+t.width/2,y:t.top-s.top+t.height*.55},ground:{x:t.left-s.left+t.width/2,y:t.top-s.top+t.height*.92}};
  }
  const place=(x,y,extra="")=>`translate(${x-18}px,${y-18}px) ${extra}`;
  function arc(from,to,height,steps=14,spins=3){
    const frames=[];
    for(let i=0;i<=steps;i++){
      const k=i/steps,x=from.x+(to.x-from.x)*k,y=from.y+(to.y-from.y)*k-Math.sin(Math.PI*k)*height;
      frames.push({transform:place(x,y,`rotate(${spins*360*k}deg)`),offset:k});
    }
    return frames;
  }
  async function anim(el,frames,opts){
    if(reduce()){const last=frames[frames.length-1];Object.assign(el.style,{transform:last.transform||""});return;}
    const a=el.animate(frames,{fill:"forwards",...opts});
    await a.finished.catch(()=>{});
  }
  function burst(x,y,kind){
    if(reduce())return;
    const n=kind==="stars"?10:8;
    for(let i=0;i<n;i++){
      const p=document.createElement("i");
      p.className=`cp-p ${kind}`;
      p.style.left=`${x}px`;p.style.top=`${y}px`;
      fx.appendChild(p);
      const ang=(Math.PI*2*i)/n,dist=40+Math.random()*30;
      p.animate([{transform:"translate(-50%,-50%) scale(.4)",opacity:1},{transform:`translate(calc(-50% + ${Math.cos(ang)*dist}px),calc(-50% + ${Math.sin(ang)*dist}px)) scale(1)`,opacity:0}],{duration:700,easing:"cubic-bezier(.2,.8,.3,1)"}).finished.then(()=>p.remove());
    }
  }
  function banner(text,cls){
    const b=$("cpBanner");b.textContent=text;b.className=`cp-banner ${cls}`;b.hidden=false;
    if(!reduce())b.animate([{transform:"translate(-50%,-50%) scale(.3)",opacity:0},{transform:"translate(-50%,-50%) scale(1.1)",opacity:1,offset:.6},{transform:"translate(-50%,-50%) scale(1)",opacity:1}],{duration:450,easing:"ease-out"});
  }
  function dice(label,roll,target,ok){
    $("cpDice").innerHTML=`<span class="${ok?"ok":"bad"}"><small>${esc(label)}</small><b>${roll}</b><i>${ok?"≤":">"} ${target}</i></span>`;
    if(!reduce())$("cpDice").firstChild.animate([{transform:"scale(.5) rotate(-12deg)",opacity:0},{transform:"scale(1.15)",opacity:1,offset:.6},{transform:"none"}],{duration:380});
  }
  function resetScene(){
    $("cpBanner").hidden=true;$("cpDice").innerHTML="";fx.innerHTML="";
    ballEl.getAnimations().forEach(a=>a.cancel());targetWrap.getAnimations().forEach(a=>a.cancel());
    ballEl.style.transform="";ballEl.style.filter="";targetWrap.style.opacity="";
    ballEl.classList.remove("thrown");
  }

  /* ---------- Minigame de mira ---------- */
  function aim(target,crit){
    return new Promise(resolve=>{
      const box2=$("cpAim"),marker=$("cpAimMarker");
      box2.querySelector(".ok").style.width=`${target}%`;
      box2.querySelector(".crit").style.width=`${crit}%`;
      $("cpAimTarget").textContent=target;$("cpAimTarget").style.left=`${target}%`;
      box2.hidden=false;
      // velocidade: quanto mais difícil o arremesso, mais rápida a mira
      const period=Math.max(650,1500-(100-target)*9);
      let t0=performance.now(),raf=0,pos=0,done=false;
      const tick=now=>{
        const ph=((now-t0)%(period*2))/period;
        const k=ph<=1?ph:2-ph;
        const wob=Math.sin(now/90)*0.012;
        pos=clamp(k+wob,0,1);
        marker.style.left=`${pos*100}%`;
        raf=requestAnimationFrame(tick);
      };
      raf=requestAnimationFrame(tick);
      const stop=e=>{
        if(done)return;
        if(e.type==="keydown"&&e.code!=="Space"&&e.key!=="Enter")return;
        e.preventDefault();done=true;
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown",stop,true);box2.removeEventListener("pointerdown",stop);
        const roll=clamp(Math.round(pos*99)+1,1,100);
        sfx("select");
        setTimeout(()=>{box2.hidden=true;resolve(roll);},350);
      };
      setTimeout(()=>{document.addEventListener("keydown",stop,true);box2.addEventListener("pointerdown",stop);},120);
      say("Mire! Pare o marcador dentro da faixa verde.");
    });
  }

  /* ---------- Fluxo ---------- */
  async function throwBall(){
    if(busy)return;
    if(!S.ball){say("Escolha uma Poké Ball.");return;}
    busy=true;resetScene();render();
    const t=throwData();
    const ballName=allBalls().find(b=>b.slug===S.ball)?.name||"Poké Ball";
    let roll;
    if(S.mode==="minigame")roll=await aim(t.target,t.crit);
    else{say(`${(trainer().name||"Treinador").toUpperCase()} arremessou uma ${ballName.toUpperCase()}!`);roll=d100();await wait(250);}
    const hit=roll<=t.target,crit=hit&&roll<=t.crit;
    dice("Arremesso",roll,t.target,hit);
    const g=geom();
    ballEl.classList.add("thrown");sfx("page");
    if(!hit){
      const miss={x:g.target.x+(Math.random()<.5?-1:1)*70,y:g.target.y-10};
      targetWrap.animate([{transform:"none"},{transform:"translateX(18px)"},{transform:"none"}],{duration:420,delay:300});
      await anim(ballEl,arc(g.start,miss,g.h*.45),{duration:620,easing:"linear"});
      await anim(ballEl,[{transform:place(miss.x,miss.y)},{transform:place(miss.x+20,g.ground.y,"rotate(200deg)")},{transform:place(miss.x+34,g.ground.y-14,"rotate(260deg)")},{transform:place(miss.x+44,g.ground.y,"rotate(320deg)"),opacity:1},{transform:place(miss.x+52,g.ground.y,"rotate(360deg)"),opacity:0}],{duration:700,easing:"ease-in"});
      banner("ERROU!","miss");sfx("error");
      say(`${roll} > ${t.target}. A ${ballName} errou o alvo!`);
      log(`Arremesso ${roll}/${t.target}: errou`,"bad");
      showAfter("miss");
      busy=false;render();return;
    }
    if(crit){burst(g.target.x,g.target.y,"stars");}
    await anim(ballEl,arc(g.start,g.target,g.h*.5),{duration:650,easing:"linear"});
    say(crit?`Arremesso perfeito! (${roll} ≤ ${t.crit}) +10 no NAC!`:`Acertou! (${roll} ≤ ${t.target})`);
    // abre e puxa o Pokémon
    burst(g.target.x,g.target.y,"flash");
    await Promise.all([
      anim(targetWrap,[{filter:"none",transform:"none",opacity:1},{filter:"brightness(3) saturate(0)",offset:.35},{filter:"brightness(3) sepia(1) hue-rotate(-50deg) saturate(6)",transform:"scale(.05) translateY(-80%)",opacity:0}],{duration:520,easing:"ease-in"}),
      anim(ballEl,[{transform:place(g.target.x,g.target.y,"scale(1)")},{transform:place(g.target.x,g.target.y-10,"scale(1.25)")},{transform:place(g.target.x,g.target.y,"scale(1)")}],{duration:520})
    ]);
    await anim(ballEl,[{transform:place(g.target.x,g.target.y)},{transform:place(g.ground.x,g.ground.y),offset:.55,easing:"ease-in"},{transform:place(g.ground.x,g.ground.y-18),offset:.75,easing:"ease-out"},{transform:place(g.ground.x,g.ground.y)}],{duration:520});
    // rolagem de captura
    const n=nacData(crit);
    const capRoll=n.auto?null:d100();
    const ok=n.auto||capRoll<=n.value;
    if(!S.practice&&typeof changeBagQuantity==="function"){changeBagQuantity(S.ball,-1,{render:false,save:false});try{updateDrawerPocketSummary();renderDrawerBag();renderCombatBag();saveState();}catch(e){}}
    const margin=ok?0:capRoll-n.value;
    const shakes=ok?3:margin<=10?3:margin<=25?2:1;
    for(let i=0;i<shakes;i++){
      await wait(380);
      sfx("type");
      await anim(ballEl,[{transform:place(g.ground.x,g.ground.y,"rotate(0)")},{transform:place(g.ground.x-4,g.ground.y,"rotate(-28deg)")},{transform:place(g.ground.x+4,g.ground.y,"rotate(24deg)")},{transform:place(g.ground.x,g.ground.y,"rotate(0)")}],{duration:520,easing:"ease-in-out"});
      say(["...","... ...","... ... ..."][i]);
    }
    await wait(420);
    if(capRoll!=null)dice("Captura",capRoll,n.value,ok);
    if(ok){
      sfx("page");
      ballEl.animate([{filter:"none"},{filter:"brightness(.55)"}],{duration:250,fill:"forwards"});
      burst(g.ground.x,g.ground.y-10,"stars");
      banner("GOTCHA!","ok");
      say(`Gotcha! ${(S.display||"Pokémon").toUpperCase()} foi capturado!${capRoll!=null?` (${capRoll} ≤ ${n.value})`:""}${S.ball==="heal-ball"?" A Heal Ball curou o Pokémon.":""}${S.ball==="luxury-ball"?" A Luxury Ball melhora a amizade inicial.":""}`);
      log(`${S.display||"Pokémon"} capturado ${capRoll!=null?`${capRoll}/${n.value}`:"(auto)"} com ${ballName}`,"ok");
      lastCaught={species:S.species,display:S.display,level:S.level,ball:S.ball,ballName};
      showAfter("caught");
    }else{
      sfx("error");
      burst(g.ground.x,g.ground.y-14,"flash");
      await Promise.all([
        anim(ballEl,[{transform:place(g.ground.x,g.ground.y),opacity:1},{transform:place(g.ground.x,g.ground.y-8,"scale(1.3)"),opacity:0}],{duration:300}),
        anim(targetWrap,[{transform:"scale(.05) translateY(-80%)",opacity:0,filter:"brightness(3)"},{transform:"scale(1.1)",opacity:1,offset:.7},{transform:"none",opacity:1,filter:"none"}],{duration:520,easing:"ease-out"})
      ]);
      banner(shakes>=3?"QUASE!":"ESCAPOU!","bad");
      say(`Ah não! O Pokémon escapou! (${capRoll} > ${n.value})`);
      log(`Escapou ${capRoll}/${n.value} com ${ballName}`,"bad");
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
      el.innerHTML=`<span>Capturado!</span><button type="button" class="primary" data-cp-after="register">MANDAR PARA O PC</button><button type="button" data-cp-after="reset">NOVA CAPTURA</button>`;
    }else{
      el.innerHTML=`<span>Rodada ${S.round} — tente de novo.</span><button type="button" data-cp-after="reset">CONTINUAR</button>`;
    }
  }
  async function registerCaught(){
    if(!lastCaught||typeof createBlankPokemon!=="function"||typeof searchPokemonFromApi!=="function")return;
    const back=current?.id;
    const c=lastCaught;lastCaught=null;
    $("cpAfter").innerHTML="<span>Registrando no PC…</span>";
    try{
      createBlankPokemon();
      await searchPokemonFromApi(c.species);
      const p=current;
      p.storageGroup="box";
      p.level=c.level;
      p.notes=[p.notes,`Capturado com ${c.ballName} (nível ${c.level}).`].filter(Boolean).join("\n");
      if(c.ball==="luxury-ball")p.happiness=Math.max(Number(p.happiness||0),120);
      if(typeof syncLevelDependentData==="function")try{syncLevelDependentData(p);}catch(e){}
      const prev=(state.pokemon||[]).find(x=>x.id===back);
      if(prev){state.currentId=prev.id;current=prev;}
      renderAll();saveState();
      say(`${c.display.toUpperCase()} foi enviado para o PC! Ajuste nível e pontos na ficha dele.`);
      if(typeof showToast==="function")showToast(`📦 ${c.display} foi para o PC`);
    }catch(e){say("Não consegui registrar automaticamente. Crie o Pokémon pelo PC.");}
    $("cpAfter").hidden=true;
  }

  /* ---------- Eventos ---------- */
  panel.addEventListener("click",e=>{
    const t=e.target;
    const hpb=t.closest("[data-cp-hp]");if(hpb){S.hp=Number(hpb.dataset.cpHp);persist();render();sfx("select");return;}
    const st=t.closest("[data-cp-status]");if(st){S.status=st.dataset.cpStatus;persist();render();sfx("select");return;}
    const seg=t.closest("[data-cp-seg] [data-v]");if(seg){S[seg.parentElement.dataset.cpSeg]=seg.dataset.v;persist();render();sfx("select");return;}
    const md=t.closest("[data-cp-mode]");if(md){S.mode=md.dataset.cpMode;persist();render();sfx("select");return;}
    const bb=t.closest("[data-cp-ball]");if(bb&&!busy){S.ball=bb.dataset.cpBall;persist();render();sfx("select");return;}
    const af=t.closest("[data-cp-after]");
    if(af){
      const a=af.dataset.cpAfter;
      if(a==="lose"&&typeof changeBagQuantity==="function"){changeBagQuantity(S.ball,-1,{render:false,save:false});try{updateDrawerPocketSummary();renderDrawerBag();renderCombatBag();saveState();}catch(err){}}
      if(a==="register"){registerCaught();return;}
      $("cpAfter").hidden=true;resetScene();render();return;
    }
    if(t.closest("#cpThrow")){$("cpAfter").hidden=true;throwBall();}
  });
  panel.addEventListener("change",e=>{
    const t=e.target;
    if(t.id==="cpLevelIn")S.level=clamp(Math.trunc(Number(t.value)||1),1,100);
    if(t.id==="cpRarity"){S.rarity=t.value;}
    if(t.id==="cpEnv")S.env=t.value;
    if(t.id==="cpRound")S.round=clamp(Math.trunc(Number(t.value)||1),1,99);
    if(t.id==="cpRepeat")S.repeat=t.checked;
    if(t.id==="cpPractice"){S.practice=t.checked;S.ball="";}
    if(t.id==="cpGm")S.gmOverride=t.checked;
    persist();render();
  });
  panel.addEventListener("input",e=>{if(e.target.id==="cpHp"){S.hp=Number(e.target.value);persist();render();}});
  $("cpSearch").addEventListener("submit",e=>{e.preventDefault();loadSpecies($("cpSpecies").value);});
  menuBtn.addEventListener("click",()=>setTimeout(()=>{render();say(S.display?`O ${S.display.toUpperCase()} selvagem está à espera. Escolha a Poké Ball!`:"Procure o Pokémon selvagem e escolha a Poké Ball.");},30));

  ["renderCombatPage","renderAll"].forEach(fn=>{
    const orig=window[fn];if(typeof orig!=="function")return;
    window[fn]=function(){const r=orig.apply(this,arguments);if(!panel.hidden&&!busy)render();return r;};
  });
  if(box.querySelector(".bt-cmd.active")==null&&store.get("hh_bt_menu","")==="capture")menuBtn.click();
  render();
  window.hhCapture={rules:{lifeMod,levelMod,suggestRarity,RARITY,STATUS},nacData,throwData,state:S,render};
})();
