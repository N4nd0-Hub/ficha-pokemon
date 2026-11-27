/* ============================================================
   V7 — PPg sobem o nível (regra 17: Progressão por Pontos)
   Card "Progresso" embaixo da Evolução, na página 01. Mostra quantos
   PPg o Pokémon tem, quanto custa o próximo nível e, quando dá, o
   botão SUBIR DE NÍVEL (gasta os PPg e usa o mesmo +1 nível da ficha,
   com Nature, prioridades e limite por dezena).
   Custo por nível = faixa do nível + ajuste da espécie (máx. 10):
     Lv 1–15: 5 · 16–25: 6 · 26–40: 7 · 41–60: 8 · 61–80: 9 · 81–100: 10
     Evolução cedo (forma final até Lv 30): −1
     Evolução média (31–44) ou sem evolução: +0
     Evolução tardia (45–54): +1
     Estágio final de uma linha / pseudo-lendário (≥55): +2
   O ajuste é calculado pela linha evolutiva (PokéAPI, Pokédex GM,
   Fakemon do sistema, Banco Local) e pode ser trocado à mão.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const cur=()=>{try{return current;}catch(e){return null;}};
  const toast=t=>{try{showToast(t);}catch(e){}};
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const save=()=>{try{saveState();}catch(e){try{debouncedSave();}catch(_){}}};
  const MAX=15;

  const BANDS=[[15,5,"1–15"],[25,6,"16–25"],[40,7,"26–40"],[60,8,"41–60"],[80,9,"61–80"],[100,10,"81–100"]];
  const band=lv=>BANDS.find(b=>lv<=b[0])||BANDS[BANDS.length-1];
  const PROFILES={
    fast:{mod:-1,label:"Evolução cedo",short:"−1"},
    medium:{mod:0,label:"Evolução média",short:"+0"},
    none:{mod:0,label:"Sem evolução",short:"+0"},
    late:{mod:1,label:"Evolução tardia",short:"+1"},
    final:{mod:2,label:"Estágio final",short:"+2"},
    pseudo:{mod:2,label:"Pseudo-lendário / final ≥55",short:"+2"}
  };
  const CHOICES=[["auto","Automático"],["fast","Cedo (−1)"],["medium","Média (+0)"],["late","Tardia (+1)"],["final","Final / Pseudo (+2)"]];

  /* Ajuste automático pela linha evolutiva */
  function autoProfile(p){
    const line=window.hhEvolution?.lineOf?.(p);
    if(!line)return {key:"medium",why:"buscando a linha evolutiva…",loading:true};
    if(line.isFinal&&line.hasPrev)return {key:"final",why:"última forma da linha"};
    if(line.isFinal)return {key:"none",why:"não evolui"};
    const f=line.finalLevel;
    if(f==null)return {key:"medium",why:"evolui por condição especial"};
    if(f<=30)return {key:"fast",why:`forma final no Lv ${f}`};
    if(f<=44)return {key:"medium",why:`forma final no Lv ${f}`};
    if(f<=54)return {key:"late",why:`forma final no Lv ${f}`};
    return {key:"pseudo",why:`forma final no Lv ${f}`};
  }
  function profileOf(p){
    const pick=p.ppgProfile||"auto";
    if(pick!=="auto"&&PROFILES[pick])return {key:pick,why:"escolhido à mão",manual:true};
    // perfil escolhido ao criar o Pokémon (Perfil Evolutivo) vale se não for o padrão
    const ep=p.evolutionProfile?.key;
    if(!p.ppgProfile&&ep&&ep!=="medium"&&ep!=="none"&&ep!=="custom"){
      const map={"bug-fast":"fast",fast:"fast",late:"late",pseudo:"pseudo"};
      if(map[ep])return {key:map[ep],why:"Perfil Evolutivo da ficha"};
    }
    return autoProfile(p);
  }
  function costOf(p){
    const lv=Math.max(1,Math.min(100,Number(p.level||1)));
    const b=band(lv),pr=profileOf(p),P=PROFILES[pr.key]||PROFILES.medium;
    const cost=Math.max(1,Math.min(10,b[1]+P.mod));
    return {cost,base:b[1],range:b[2],profile:pr,P,lv};
  }

  /* ---------- Card ---------- */
  let card=null;
  function ensureCard(){
    if(card&&document.body.contains(card))return card;
    const after=document.getElementById("evo7Card")||document.querySelector("#sumScreen .sum-hpbox");
    if(!after)return null;
    card=document.createElement("section");
    card.className="ppg7-card";card.id="ppg7Card";card.setAttribute("aria-label","Progresso por PPg");
    after.insertAdjacentElement("afterend",card);
    return card;
  }
  let open=false;
  function render(){
    const p=cur();const c=ensureCard();if(!c||!p)return;
    // fica sempre logo depois do card de Evolução
    const evo=document.getElementById("evo7Card");if(evo&&evo.nextElementSibling!==c)evo.insertAdjacentElement("afterend",c);
    const ppg=Math.max(0,Math.min(MAX,Number(p.currentPpg||0)));
    const k=costOf(p),lv=k.lv;
    const can=ppg>=k.cost&&lv<100;
    const pct=Math.min(100,Math.round(100*ppg/k.cost));
    c.className="ppg7-card"+(can?" ready":"");
    c.innerHTML=`<header><b>⭐ PROGRESSO</b><small>${lv>=100?"nível máximo":can?"PODE SUBIR DE NÍVEL!":`Lv ${lv} → ${lv+1}`}</small></header>
      <div class="ppg7-row"><span class="ppg7-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${k.cost}" aria-valuenow="${Math.min(ppg,k.cost)}" aria-label="PPg para o próximo nível"><i style="width:${pct}%"></i>${Array.from({length:k.cost-1},(_,i)=>`<em style="left:${100*(i+1)/k.cost}%"></em>`).join("")}</span>
        <b class="ppg7-num">${ppg}<small>/${k.cost} PPg</small></b></div>
      <p class="ppg7-cost">Custo: faixa Lv ${k.range} (${k.base}) ${k.P.short} ${esc(k.P.label.toLowerCase())} = <b>${k.cost} PPg/nível</b>${ppg>k.cost?` · sobra ${ppg-k.cost}`:""}</p>
      <div class="ppg7-acts">
        <button type="button" class="ppg7-btn sm" data-ppg="minus" aria-label="Tirar 1 PPg" ${ppg<=0?"disabled":""}>−1</button>
        <button type="button" class="ppg7-btn sm" data-ppg="plus" aria-label="Somar 1 PPg" ${ppg>=MAX?"disabled":""}>+1</button>
        <button type="button" class="ppg7-btn up${can?" go":""}" data-ppg="levelup" ${can?"":"disabled"}>${can?`⬆ SUBIR PARA LV ${lv+1}`:lv>=100?"NÍVEL MÁXIMO":`FALTA${k.cost-ppg>1?"M":""} ${k.cost-ppg} PPg`}</button>
      </div>
      <details class="ppg7-more"${open?" open":""}><summary>Ganhar PPg e ajuste da espécie</summary>
        <div class="ppg7-gain">${[["1","Selvagem relevante"],["1","Exploração fora da Pokébola"],["2","Vitória contra Treinador"],["3","Líder / Chefe"]].map(([n,l])=>`<button type="button" class="ppg7-chip" data-ppg="gain" data-n="${n}" title="${esc(l)}">+${n} <small>${esc(l)}</small></button>`).join("")}</div>
        <p class="ppg7-hint">Inimigo 10+ níveis abaixo não dá PPg. Máximo de 3 PPg por cena. A reserva guarda até ${MAX}.</p>
        <label class="ppg7-pick">Ajuste da espécie
          <select data-ppg="profile">${CHOICES.map(([v,l])=>`<option value="${v}"${(p.ppgProfile||"auto")===v?" selected":""}>${esc(l)}</option>`).join("")}</select></label>
        <p class="ppg7-hint">${k.profile.manual?"Escolhido à mão.":`Automático: ${esc(k.P.label)} (${esc(k.profile.why)}).`}</p>
      </details>`;
  }

  function setPpg(v){
    const p=cur();if(!p)return;
    p.currentPpg=Math.max(0,Math.min(MAX,Math.round(v)));
    try{renderAll();}catch(e){render();}
    save();
  }
  function levelUp(){
    const p=cur();if(!p)return;
    const k=costOf(p),ppg=Number(p.currentPpg||0);
    if(ppg<k.cost||k.lv>=100)return;
    const before=Number(p.level||1);
    try{confirmNextLevel();}catch(e){console.error(e);}
    const q=cur();
    if(Number(q.level||1)<=before){toast(document.getElementById("progressWarning")?.textContent||"Não foi possível subir de nível agora.");render();return;}
    q.currentPpg=Math.max(0,ppg-k.cost);
    try{renderAll();}catch(e){}
    save();sfx("page");
    const lvInput=document.querySelector('#sumScreen [data-proxy="level"]');if(lvInput)lvInput.value=q.level;
    toast(`⬆ ${q.name} subiu para o nível ${q.level}! Gastou ${k.cost} PPg (sobraram ${q.currentPpg}).`);
    card?.classList.remove("ppg7-pop");void card?.offsetWidth;card?.classList.add("ppg7-pop");
  }

  /* Exp. Share: quem segura (outro Pokémon da Equipe) recebe metade dos PPg
     que o Pokémon atual ganhar. Meio PPg fica guardado e soma no próximo. */
  const isShare=x=>/^exp\.?\s*share$/i.test(String(x?.heldItem||"").trim());
  function expShareList(gainer,n){
    const team=(state.pokemon||[]).filter(x=>(x.storageGroup||"team")==="team"&&x!==gainer&&String(x.id)!==String(gainer?.id)&&isShare(x));
    const out=[];
    if(!(n>0))return out;
    for(const h of team){
      const half=Math.max(0,Number(h.ppgShareHalf||0))+n;// em meios PPg
      const add=Math.floor(half/2);h.ppgShareHalf=half%2;
      const before=Math.max(0,Number(h.currentPpg||0));
      h.currentPpg=Math.min(MAX,before+add);
      out.push({p:h,add:h.currentPpg-before,total:h.currentPpg,half:!!h.ppgShareHalf});
    }
    return out;
  }
  function expShare(gainer,n){
    const got=expShareList(gainer,n).map(x=>`${x.p.name} +${x.add}${x.half?" (+½ guardado)":""}`);
    return got.length?`🔗 Exp. Share: ${got.join(" · ")}`:"";
  }
  document.addEventListener("click",e=>{
    const b=e.target.closest("#ppg7Card [data-ppg]");if(!b||b.tagName==="SELECT")return;
    const p=cur();if(!p)return;
    const a=b.dataset.ppg,v=Number(p.currentPpg||0);
    if(a==="plus")setPpg(v+1);
    else if(a==="minus")setPpg(v-1);
    else if(a==="gain"){const n=Number(b.dataset.n||1);const room=MAX-v;const shared=expShare(p,n);setPpg(v+n);sfx("select");if(room<n)toast(`A reserva de PPg está cheia (${MAX}).`);
      else{const k=costOf(cur());if(v<k.cost&&v+n>=k.cost)toast(`⭐ ${p.name} já pode subir de nível! Use o botão no card Progresso.`);else if(shared)toast(shared);}}
    else if(a==="levelup")levelUp();
  });
  document.addEventListener("change",e=>{
    const s=e.target.closest("#ppg7Card [data-ppg=profile]");if(!s)return;
    const p=cur();if(!p)return;
    p.ppgProfile=s.value;save();render();
  });
  document.addEventListener("toggle",e=>{if(e.target.matches?.("#ppg7Card .ppg7-more"))open=e.target.open;},true);
  ["hh:render","hh:pokemonchange","hh:evoline"].forEach(ev=>document.addEventListener(ev,render));
  // a tela de PPg do Arquivo mostra o custo do próximo nível
  const label=document.querySelector(".ppg-value-row span");
  if(label&&typeof window.updatePpgDisplay==="function"&&!window.updatePpgDisplay.__ppg7){
    const orig=window.updatePpgDisplay;
    window.updatePpgDisplay=function(){const r=orig.apply(this,arguments);try{const p=cur();const k=costOf(p);label.textContent=`/ ${MAX} PPg · próximo nível: ${k.cost}`;}catch(e){}return r;};
    window.updatePpgDisplay.__ppg7=true;
  }
  window.hhPpg={costOf,profileOf,levelUp,render,expShare,expShareList};
  if(document.readyState!=="loading")setTimeout(render,0);
})();
