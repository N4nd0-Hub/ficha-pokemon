/* ============================================================
   V6 — Interface de batalha (página de Combate)
   Tela de batalha como nos jogos: arena em cima, caixa de texto
   e menu LUTAR / BOLSA / POKÉMON / VIDA / ESTADO embaixo.
   - LUTAR: golpes em grade colorida por tipo; ao escolher um,
     "POKÉMON usou GOLPE!" e rolagem animada de acerto (d100) e
     dano (dados do Poder + bônus do atributo).
   - As demais abas recebem os cartões que já existiam (bolsa,
     equipe, controle de vida, Ability/item/condições), com os
     mesmos eventos e o mesmo salvamento.
   - Dano e cura mostram o número subindo na arena.
   ============================================================ */
(function(){
  "use strict";
  const page=document.getElementById("page2");
  const center=page?.querySelector(".combat-center");
  const screenEl=page?.querySelector(".combat-screen");
  if(!page||!center||!screenEl||typeof state==="undefined"||page.querySelector(".bt-box"))return;

  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const sfx=n=>window.hhClassicSfx?.[n]?.();
  const reduceMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const norm=t=>typeof normalizeTypeName==="function"?normalizeTypeName(t):t;
  const typeBadge=t=>typeof typeIconHtml==="function"?typeIconHtml(t,true):`<span class="tag">${esc(t)}</span>`;
  const store={
    get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},
    set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  };
  const TYPE_TINT={
    Normal:"#a8a77a",Fire:"#ee8130",Water:"#6390f0",Electric:"#f7d02c",Grass:"#7ac74c",Ice:"#96d9d6",
    Fighting:"#c22e28",Poison:"#a33ea1",Ground:"#e2bf65",Flying:"#a98ff3",Psychic:"#f95587",Bug:"#a6b91a",
    Rock:"#b6a136",Ghost:"#735797",Dragon:"#6f35fc",Dark:"#705746",Steel:"#b7b7ce",Fairy:"#d685ad"
  };
  const MENU=[
    {id:"fight",label:"LUTAR",cls:"fight"},
    {id:"bag",label:"BOLSA",cls:"bag"},
    {id:"party",label:"POKÉMON",cls:"party"},
    {id:"hp",label:"VIDA",cls:"hp"},
    {id:"status",label:"ESTADO",cls:"status"}
  ];
  let menu=store.get("hh_bt_menu","fight");
  if(!MENU.some(m=>m.id===menu))menu="fight";
  let chosen=null;

  /* ---------- Estrutura ---------- */
  const box=document.createElement("section");
  box.className="bt-box";
  box.innerHTML=`
    <div class="bt-command">
      <div class="bt-text" id="btText" aria-live="polite"></div>
      <nav class="bt-menu" aria-label="Comandos de batalha">
        ${MENU.map(m=>`<button type="button" class="bt-cmd ${m.cls}" data-bt-menu="${m.id}">${m.label}</button>`).join("")}
      </nav>
    </div>
    <div class="bt-panels">
      <div class="bt-panel" data-bt-panel="fight">
        <div class="bt-matrix" id="btMatrix"></div>
        <div class="bt-moves" id="btMoves"></div>
        <div class="bt-roll" id="btRoll" hidden></div>
      </div>
      <div class="bt-panel" data-bt-panel="bag"></div>
      <div class="bt-panel" data-bt-panel="party"></div>
      <div class="bt-panel" data-bt-panel="hp"></div>
      <div class="bt-panel bt-status-grid" data-bt-panel="status"></div>
    </div>`;
  screenEl.insertAdjacentElement("afterend",box);
  page.classList.add("bt-active");

  const floatLayer=document.createElement("div");
  floatLayer.className="bt-floats";
  floatLayer.setAttribute("aria-hidden","true");
  screenEl.appendChild(floatLayer);

  /* ---------- Cartões existentes vão para as abas ---------- */
  const left=page.querySelector(".combat-side-left");
  const right=page.querySelector(".combat-side-right");
  const panel=id=>box.querySelector(`[data-bt-panel="${id}"]`);
  const adopt=(id,node)=>{if(node){panel(id).appendChild(node);node.classList.add("bt-adopted");}};
  adopt("bag",document.getElementById("combatBagCard"));
  adopt("party",document.getElementById("combatPartyList")?.closest(".combat-info-card"));
  adopt("hp",left?.querySelector(".combat-hp-control-card"));
  adopt("status",left?.querySelector(".combat-info-card:not(.combat-item-card):not(.combat-condition-panel):not(.combat-hp-control-card)"));
  adopt("status",document.getElementById("combatItemCard"));
  adopt("status",document.getElementById("combatConditionsCard"));

  /* ---------- Texto digitado da caixa ---------- */
  let typing=0;
  function say(text,{instant=false}={}){
    const el=box.querySelector("#btText");
    clearInterval(typing);
    const full=String(text||"");
    if(instant||reduceMotion()){el.textContent=full;return;}
    let i=0;el.textContent="";
    typing=setInterval(()=>{
      i+=1;el.textContent=full.slice(0,i);
      if(i%3===0)sfx("type");
      if(i>=full.length)clearInterval(typing);
    },20);
  }
  const name=()=>(current?.name||"Pokémon").toUpperCase();
  function idleText(){
    return {
      fight:`O que ${name()} vai fazer?`,
      bag:"Escolha um item da Bolsa.",
      party:"Escolha um Pokémon da Equipe.",
      hp:"Registre o dano ou a cura rolados.",
      status:"Ability, item e condições de batalha."
    }[menu];
  }

  /* ---------- Menu ---------- */
  function setMenu(id,{sound=true,speak=true}={}){
    menu=id;store.set("hh_bt_menu",id);
    box.querySelectorAll("[data-bt-menu]").forEach(b=>b.classList.toggle("active",b.dataset.btMenu===id));
    box.querySelectorAll("[data-bt-panel]").forEach(p=>{
      const on=p.dataset.btPanel===id;
      p.hidden=!on;
      if(on&&!reduceMotion()){p.classList.remove("bt-enter");void p.offsetWidth;p.classList.add("bt-enter");}
    });
    if(sound)sfx("select");
    if(speak)say(idleText());
  }

  /* ---------- Golpes ---------- */
  const locked=m=>typeof isMoveLevelLocked==="function"?isMoveLevelLocked(m):false;
  const activeMoves=()=>(current?.moves||[]).filter(m=>m.active&&!locked(m)).slice(0,5);
  const CAT={physical:"FÍS",special:"ESP",status:"STA"};
  const catOf=m=>{const c=String(m.category||"").toLowerCase();return c.startsWith("phys")?"physical":c.startsWith("spec")?"special":"status"};
  function accuracyOf(m){
    try{const info=effectiveMoveAccuracy(m);const n=parseInt(String(info.label).replace(/\D/g,""),10);if(n>0)return n;}catch(e){}
    return Number(m.accuracy)>0?Number(m.accuracy):0;
  }
  const DM=()=>window.hhDamageMatrix;
  const matrixOn=()=>!!DM()?.enabled();
  function renderMoves(){
    DM()?.mountPanel(box.querySelector("#btMatrix"));
    const list=activeMoves();
    const el=box.querySelector("#btMoves");
    if(!list.length){
      el.innerHTML=`<p class="bt-empty">Nenhum golpe equipado. Equipe golpes na página do Pokémon.</p>`;
      return;
    }
    el.innerHTML=list.map(m=>{
      const t=norm(m.type)||"Normal";
      const cat=catOf(m);
      const acc=accuracyOf(m);
      return `<button type="button" class="bt-move${String(m.id)===String(chosen)?" chosen":""}" data-bt-move="${esc(m.id)}" style="--t:${TYPE_TINT[t]||"#888"}">
        <b>${esc(m.name||"—")}</b>
        <span class="bt-move-meta">${typeBadge(t)}<span class="cl-move-cat ${cat}">${CAT[cat]}</span></span>
        <span class="bt-move-nums"><em>PODER ${Number(m.power)>0?Number(m.power):"—"}</em><em>PREC ${acc?acc+"%":"—"}</em></span>
        ${matrixOn()?(()=>{const pr=DM().profile(m);return pr?`<span class="bt-move-dmg" title="${esc(pr.expression)}">🎲 ${esc(pr.short)} <i>${esc(pr.qd.toUpperCase())}</i></span>`:"";})():""}
      </button>`;
    }).join("");
  }

  /* ---------- Rolagem ---------- */
  const d=(n)=>Math.floor(Math.random()*n)+1;
  function parseBonus(text){
    const m=String(text||"").match(/\+(\d+)d6(?:\s*\+(\d+))?/);
    return m?{dice:Number(m[1]),fixed:Number(m[2]||0)}:{dice:0,fixed:0};
  }
  function rollPlan(m){
    const baseText=typeof powerToDice==="function"?powerToDice(m.power):"—";
    const base=parseInt(baseText,10)||0;
    let bonusText="";
    try{bonusText=typeof moveOffensiveBonus==="function"?moveOffensiveBonus(m):""}catch(e){}
    const bonus=parseBonus(bonusText);
    return {base,bonus,bonusText,acc:accuracyOf(m)};
  }
  function chooseMove(id,{quiet=false}={}){
    const m=activeMoves().find(x=>String(x.id)===String(id));
    if(!m)return;
    chosen=m.id;
    renderMoves();
    const plan=rollPlan(m);
    const desc=typeof translateMoveEffectPt==="function"?translateMoveEffectPt(m.description||""):(m.description||"");
    if(!quiet){
      sfx("select");
      say(`${name()} usou ${(m.name||"").toUpperCase()}!`);
      flashSprite("attack");
    }
    const roll=box.querySelector("#btRoll");
    roll.hidden=false;
    const pr=matrixOn()?DM().profile(m):null;
    if(matrixOn()){
      const STAT={atk:"ATK",spa:"SP.ATK",def:"DEF",spd:"SP.DEF"};
      roll.innerHTML=`
      <div class="bt-roll-head">
        <b>${esc(m.name)}</b>
        <span>${pr?esc(pr.expression):"Sem dano"}</span>
      </div>
      ${pr&&!pr.immune?`<p class="bt-roll-matrix">
        <span>${STAT[pr.offKey]} ${pr.offStat} <i>Q${pr.offQ}</i></span><span>vs</span><span>${STAT[pr.defKey]} alvo ${pr.defStat} <i>Q${pr.defQ}</i></span><span>→</span><b>QD ${esc(pr.qd)}</b>
        <small>Poder efetivo ${pr.effectiveBP}${pr.hits>1?` (${pr.hits} acertos)`:""} · ${pr.count} dado${pr.count>1?"s":""}${pr.effectiveness!==1?` · efetividade ×${String(pr.effectiveness).replace(".",",")}`:""}${pr.levelBonus?` · nível +${pr.levelBonus}`:""}</small>
      </p>`:""}
      ${desc?`<p class="bt-roll-desc">${esc(desc)}</p>`:""}
      <div class="bt-roll-actions">
        <button type="button" data-bt-roll="acc">🎯 ACERTO (d100 ≤ ${plan.acc||"—"})</button>
        ${pr&&!pr.immune?`<button type="button" data-bt-roll="dmg">🎲 DANO (${esc(pr.short)})</button><button type="button" data-bt-roll="crit">💥 CRÍTICO</button>`:""}
        <button type="button" data-bt-roll="edit">✎ EDITAR GOLPE</button>
      </div>
      <div class="bt-dice" id="btDice"></div>`;
      return;
    }
    roll.innerHTML=`
      <div class="bt-roll-head">
        <b>${esc(m.name)}</b>
        <span>${plan.base?`${plan.base}d6 base`:"Sem dano"}${plan.bonus.dice?` • ${esc(plan.bonusText)}`:""}</span>
      </div>
      ${desc?`<p class="bt-roll-desc">${esc(desc)}</p>`:""}
      <div class="bt-roll-actions">
        <button type="button" data-bt-roll="acc">🎯 ACERTO (d100 ≤ ${plan.acc||"—"})</button>
        ${plan.base?`<button type="button" data-bt-roll="dmg">🎲 DANO (${plan.base+plan.bonus.dice}d6${plan.bonus.fixed?` +${plan.bonus.fixed}`:""})</button>`:""}
        <button type="button" data-bt-roll="edit">✎ EDITAR GOLPE</button>
      </div>
      <div class="bt-dice" id="btDice"></div>`;
  }
  function animateDice(values,{sides=6,label,total,verdict,groups=null}){
    const tray=box.querySelector("#btDice");
    if(!tray)return;
    const sideOf=i=>Array.isArray(sides)?sides[i]:sides;
    tray.innerHTML=`<div class="bt-dice-row">${values.map((_,i)=>`<span class="bt-die${sideOf(i)===100?" wide":""}${groups?.[i]==="stab"?" stab":""}" data-sides="d${sideOf(i)}">?</span>`).join("")}</div><div class="bt-dice-total"></div>`;
    const dice=[...tray.querySelectorAll(".bt-die")];
    const totalEl=tray.querySelector(".bt-dice-total");
    const finish=()=>{
      dice.forEach((el,i)=>{el.textContent=values[i];el.classList.add("done");if(sideOf(i)!==100&&values[i]===sideOf(i))el.classList.add("max");});
      totalEl.innerHTML=`${label}: <b>${total}</b>${verdict?` <span class="${verdict.cls}">${verdict.text}</span>`:""}`;
      sfx(verdict?.cls==="miss"?"error":"page");
    };
    if(reduceMotion()){finish();return;}
    let ticks=0;
    const spin=setInterval(()=>{
      ticks++;
      dice.forEach((el,i)=>{el.textContent=d(sideOf(i));});
      if(ticks%2===0)sfx("type");
      if(ticks>=12){clearInterval(spin);finish();}
    },55);
  }
  function rollAccuracy(m){
    const plan=rollPlan(m);
    const v=d(100);
    const hit=plan.acc?v<=plan.acc:true;
    animateDice([v],{sides:100,label:"Acerto",total:v,verdict:{cls:hit?"hit":"miss",text:hit?"ACERTOU!":"ERROU!"}});
    setTimeout(()=>say(hit?`O ataque de ${name()} acertou!`:`O ataque de ${name()} errou!`),reduceMotion()?0:700);
  }
  function rollMatrix(m,critical){
    const pr=DM().profile(m);
    if(!pr)return;
    const r=DM().roll(pr,{critical:critical?"natural":"none"});
    const values=r.dice.map(x=>x.value);
    const maxes=r.dice.filter(x=>x.value===x.sides).length;
    const label=`Dano${critical?" crítico":""}${pr.levelBonus?` (inclui +${pr.levelBonus} fixos)`:""}`;
    animateDice(values,{sides:r.dice.map(x=>x.sides),groups:r.dice.map(x=>x.group),label,total:r.total,
      verdict:critical?{cls:"hit",text:"CRÍTICO!"}:maxes?{cls:"hit",text:`${maxes}× máximo`}:null});
    setTimeout(()=>say(`${(m.name||"").toUpperCase()} causou ${r.total} de dano${critical?" com um acerto crítico":""}!`),reduceMotion()?0:700);
  }
  function rollDamage(m){
    if(matrixOn()){rollMatrix(m,false);return;}
    const plan=rollPlan(m);
    const n=plan.base+plan.bonus.dice;
    const values=Array.from({length:n},()=>d(6));
    const total=values.reduce((a,b)=>a+b,0)+plan.bonus.fixed;
    const sixes=values.filter(v=>v===6).length;
    animateDice(values,{sides:6,label:"Dano",total,verdict:sixes?{cls:"hit",text:`${sixes}× 6`}:null});
    setTimeout(()=>say(`${(m.name||"").toUpperCase()} causou ${total} de dano!`),reduceMotion()?0:700);
  }

  /* ---------- Efeitos na arena ---------- */
  function flashSprite(kind){
    if(reduceMotion())return;
    const sprite=screenEl.querySelector(".combat-pokemon-stage img, #combatPortraitImg");
    if(!sprite)return;
    sprite.classList.remove("bt-attack","bt-hit","bt-heal");void sprite.offsetWidth;
    sprite.classList.add(`bt-${kind}`);
  }
  function floatNumber(text,cls){
    if(reduceMotion())return;
    const el=document.createElement("span");
    el.className=`bt-float ${cls}`;
    el.textContent=text;
    floatLayer.appendChild(el);
    setTimeout(()=>el.remove(),1200);
  }
  if(typeof window.applyCombatHpChange==="function"){
    const original=window.applyCombatHpChange;
    window.applyCombatHpChange=function(kind){
      const before=Number(current?.currentHp||0);
      const result=original.apply(this,arguments);
      const after=Number(current?.currentHp||0);
      const diff=after-before;
      if(diff<0){floatNumber(`−${-diff}`,"dmg");flashSprite("hit");sfx("error");say(`${name()} recebeu ${-diff} de dano!`);}
      else if(diff>0){floatNumber(`+${diff}`,"heal");flashSprite("heal");sfx("page");say(`${name()} recuperou ${diff} HP!`);}
      if(after<=0&&before>0)setTimeout(()=>say(`${name()} desmaiou!`),900);
      return result;
    };
  }

  /* ---------- Eventos ---------- */
  box.addEventListener("click",event=>{
    const m=event.target.closest("[data-bt-menu]");
    if(m){setMenu(m.dataset.btMenu);return;}
    const mv=event.target.closest("[data-bt-move]");
    if(mv){chooseMove(mv.dataset.btMove);return;}
    const r=event.target.closest("[data-bt-roll]");
    if(r){
      const move=activeMoves().find(x=>String(x.id)===String(chosen));
      if(!move)return;
      if(r.dataset.btRoll==="acc")rollAccuracy(move);
      if(r.dataset.btRoll==="dmg")rollDamage(move);
      if(r.dataset.btRoll==="crit")rollMatrix(move,true);
      if(r.dataset.btRoll==="edit")document.querySelector(`#activeMoves .move-card[data-move-id="${CSS.escape(String(move.id))}"] .btn.edit`)?.click();
    }
  });

  let lastId=null;
  function refresh(){
    const id=current?.id;
    if(id!==lastId){chosen=null;box.querySelector("#btRoll").hidden=true;lastId=id;if(page.classList.contains("active"))say(idleText(),{instant:true});}
    renderMoves();
  }
  if(typeof window.renderCombatPage==="function"){
    const original=window.renderCombatPage;
    window.renderCombatPage=function(){const r=original.apply(this,arguments);refresh();return r;};
  }
  document.addEventListener("hh:matrixchange",()=>{
    renderMoves();
    if(chosen)chooseMoveQuiet(chosen);
  });
  function chooseMoveQuiet(id){
    const m=activeMoves().find(x=>String(x.id)===String(id));
    if(!m)return;
    const tray=box.querySelector("#btDice")?.innerHTML||"";
    chooseMove(id,{quiet:true});
    const dice=box.querySelector("#btDice");if(dice)dice.innerHTML=tray;
  }
  document.addEventListener("hh:pagechange",e=>{if(e.detail?.to==="page2")setTimeout(()=>say(idleText()),250);});

  setMenu(menu,{sound:false,speak:false});
  say(idleText(),{instant:true});
  refresh();
})();
