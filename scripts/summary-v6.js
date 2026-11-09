/* ============================================================
   V6 — Tela de resumo do Pokémon (página principal)
   Monta a tela como nos jogos: à esquerda o Pokémon no palco,
   à direita abas INFO / STATUS / GOLPES / HABILIDADE / TIPOS.
   As partes editáveis que já existiam (gráfico e status, Nature,
   item, felicidade, Ability e fraquezas) são MOVIDAS para dentro
   das abas — continuam sendo os mesmos elementos, com os mesmos
   eventos e o mesmo salvamento.
   ============================================================ */
(function(){
  "use strict";
  const page=document.getElementById("page1");
  if(!page||typeof state==="undefined"||page.querySelector(".sum-screen"))return;

  const store={
    get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},
    set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  };
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const sfx=n=>window.hhClassicSfx?.[n]?.();
  const reduceMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const norm=t=>typeof normalizeTypeName==="function"?normalizeTypeName(t):t;
  const typeBadge=t=>typeof typeIconHtml==="function"?typeIconHtml(t,true):`<span class="tag">${esc(t)}</span>`;
  const TYPE_TINT={
    Normal:"#a8a77a",Fire:"#ee8130",Water:"#6390f0",Electric:"#f7d02c",Grass:"#7ac74c",Ice:"#96d9d6",
    Fighting:"#c22e28",Poison:"#a33ea1",Ground:"#e2bf65",Flying:"#a98ff3",Psychic:"#f95587",Bug:"#a6b91a",
    Rock:"#b6a136",Ghost:"#735797",Dragon:"#6f35fc",Dark:"#705746",Steel:"#b7b7ce",Fairy:"#d685ad"
  };
  const TABS=[
    {id:"info",label:"INFO"},
    {id:"status",label:"STATUS"},
    {id:"moves",label:"GOLPES"},
    {id:"ability",label:"HABILIDADE"},
    {id:"types",label:"TIPOS"}
  ];
  let tab=store.get("hh_sum_tab","info");
  if(!TABS.some(t=>t.id===tab))tab="info";
  let selectedMove=null;

  /* ---------- Estrutura ---------- */
  const screen=document.createElement("section");
  screen.className="sum-screen";
  screen.id="sumScreen";
  screen.innerHTML=`
    <div class="sum-left">
      <header class="sum-namebar">
        <span class="sum-ball" aria-hidden="true"></span>
        <span class="sum-no" id="sumNo">Nº0000</span>
        <b class="sum-name" id="sumName">—</b>
        <span class="sum-lv" id="sumLv">Lv1</span>
      </header>
      <button type="button" class="sum-stage" id="sumStage" title="Clique para ouvir o grito">
        <span class="sum-rays" aria-hidden="true"></span>
        <img id="sumSprite" alt="" draggable="false">
        <span class="sum-empty" id="sumEmpty">SEM IMAGEM</span>
        <span class="sum-flash" aria-hidden="true"></span>
      </button>
      <div class="sum-types" id="sumTypes"></div>
      <div class="sum-hpbox">
        <div class="sum-hpline"><small>HP</small><span class="sum-hpbar"><i id="sumHpFill"></i></span></div>
        <div class="sum-hpnum"><b id="sumHpNum">0 / 0</b><span id="sumHpPct">100%</span></div>
      </div>
      <div class="sum-left-actions">
        <button type="button" data-sum-act="cry">♪ GRITO</button>
        <button type="button" data-sum-act="tools" id="sumToolsBtn" aria-pressed="false">⚙ FERRAMENTAS</button>
      </div>
    </div>
    <div class="sum-right">
      <nav class="sum-tabs" role="tablist" aria-label="Resumo do Pokémon">
        <button type="button" class="sum-arrow" data-sum-step="-1" aria-label="Aba anterior">◀</button>
        ${TABS.map(t=>`<button type="button" role="tab" data-sum-tab="${t.id}">${t.label}</button>`).join("")}
        <button type="button" class="sum-arrow" data-sum-step="1" aria-label="Próxima aba">▶</button>
      </nav>
      <div class="sum-pages">
        <div class="sum-page" data-sum-page="info">
          <dl class="sum-table" id="sumInfoTable"></dl>
          <div class="sum-slot" data-slot="item"></div>
          <div class="sum-slot" data-slot="happiness"></div>
          <div class="sum-slot" data-slot="nature"></div>
        </div>
        <div class="sum-page" data-sum-page="status"><div class="sum-slot" data-slot="radar"></div></div>
        <div class="sum-page" data-sum-page="moves">
          <ol class="sum-moves" id="sumMoves"></ol>
          <div class="sum-move-detail" id="sumMoveDetail"></div>
          <button type="button" class="sum-link" data-sum-act="memory">▼ GERENCIAR GOLPES NA MEMÓRIA</button>
        </div>
        <div class="sum-page" data-sum-page="ability"><div class="sum-slot" data-slot="ability"></div></div>
        <div class="sum-page" data-sum-page="types"><div class="sum-slot" data-slot="types"></div></div>
      </div>
    </div>`;
  page.prepend(screen);
  page.classList.add("sum-active");

  /* ---------- Mover as peças editáveis para as abas ---------- */
  function adopt(slot,node){
    const holder=screen.querySelector(`[data-slot="${slot}"]`);
    if(holder&&node&&!holder.contains(node)){holder.appendChild(node);node.classList.add("sum-adopted");}
  }
  adopt("radar",page.querySelector(".general-status-panel .radar-wrap"));
  adopt("item",page.querySelector(".general-held-strip"));
  adopt("happiness",document.getElementById("generalHappinessStrip"));
  adopt("nature",page.querySelector(".general-stack-nature"));
  adopt("ability",page.querySelector(".general-stack-ability"));
  adopt("types",page.querySelector(".general-stack-weakness"));

  /* ---------- Abas ---------- */
  function setTab(id,{sound=true}={}){
    if(!TABS.some(t=>t.id===id))return;
    const changed=id!==tab;
    tab=id;store.set("hh_sum_tab",id);
    screen.querySelectorAll("[data-sum-tab]").forEach(b=>{
      const on=b.dataset.sumTab===id;
      b.classList.toggle("active",on);
      b.setAttribute("aria-selected",String(on));
    });
    screen.querySelectorAll("[data-sum-page]").forEach(p=>{
      const on=p.dataset.sumPage===id;
      p.hidden=!on;
      if(on&&changed&&!reduceMotion()){p.classList.remove("sum-enter");void p.offsetWidth;p.classList.add("sum-enter");}
    });
    if(id==="status"&&typeof drawRadar==="function")requestAnimationFrame(()=>drawRadar());
    if(id==="ability"&&typeof fitGeneralAbilityText==="function"){
      requestAnimationFrame(fitGeneralAbilityText);
      setTimeout(fitGeneralAbilityText,260);
    }
    if(changed&&sound)sfx("select");
  }
  function stepTab(d){
    const i=TABS.findIndex(t=>t.id===tab);
    setTab(TABS[(i+d+TABS.length)%TABS.length].id);
  }

  /* ---------- Conteúdo ---------- */
  const val=v=>v==null||v===""?"—":v;
  function infoRows(p){
    const types=[norm(p.type1),norm(p.type2)].filter(Boolean);
    const bst=Object.values(p.baseStats||p.stats||{}).reduce((a,b)=>a+Number(b||0),0);
    const source=p.apiData?.custom?"Fakemon / Banco H&H":p.apiData?.source==="PokeAPI"?"Oficial (PokéAPI)":"Registro manual";
    const trainer=state.trainer?.name||"—";
    return [
      ["Nº POKÉDEX",esc(String(p.dex||"—").padStart(4,"0"))],
      ["NOME",`<input class="sum-inline" data-proxy="pokemonName" value="${esc(p.name||"")}" aria-label="Nome">`],
      ["TIPO",types.map(typeBadge).join(" ")||"—"],
      ["NÍVEL",`<span class="sum-stepper"><button type="button" data-level-step="-1" aria-label="Baixar nível">−</button><input class="sum-inline num" data-proxy="level" type="number" min="1" max="100" value="${Number(p.level||1)}" aria-label="Nível"><button type="button" data-level-step="1" aria-label="Subir nível">+</button></span>`],
      ["NATURE",esc(val(p.natureName))],
      ["BST",String(bst)],
      ["TREINADOR",esc(trainer)],
      ["ORIGEM",esc(source)]
    ].map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join("");
  }

  function activeMoves(p){
    const locked=m=>typeof isMoveLevelLocked==="function"?isMoveLevelLocked(m):false;
    return (p.moves||[]).filter(m=>m.active&&!locked(m)).slice(0,5);
  }
  const CAT={physical:"FÍSICO",special:"ESPECIAL",status:"STATUS"};
  const catOf=m=>{const c=String(m.category||"").toLowerCase();return c.startsWith("phys")?"physical":c.startsWith("spec")?"special":"status"};
  function movesHtml(p){
    const list=activeMoves(p);
    if(!list.length)return `<li class="sum-move empty">Nenhum golpe equipado. Use a Memória de Moves para equipar.</li>`;
    if(!list.some(m=>String(m.id)===String(selectedMove)))selectedMove=list[0].id;
    return list.map(m=>{
      const t=norm(m.type)||"Normal";
      const on=String(m.id)===String(selectedMove);
      return `<li><button type="button" class="sum-move${on?" active":""}" data-move="${esc(m.id)}" style="--t:${TYPE_TINT[t]||"#888"}">
        ${typeBadge(t)}
        <b>${esc(m.name||"—")}</b>
        <span class="sum-move-pow">${Number(m.power)>0?`PODER ${Number(m.power)}`:"—"}</span>
      </button></li>`;
    }).join("");
  }
  function moveDetailHtml(p){
    const m=(p.moves||[]).find(x=>String(x.id)===String(selectedMove));
    if(!m)return "";
    const dice=typeof powerToDice==="function"?powerToDice(m.power):"";
    const cat=catOf(m);
    const desc=typeof translateMoveEffectPt==="function"?translateMoveEffectPt(m.description||""):(m.description||"");
    let bonus="";
    try{bonus=typeof moveOffensiveBonus==="function"?moveOffensiveBonus(m):""}catch(e){}
    return `
      <div class="sum-move-stats">
        <span class="cl-move-cat ${cat}">${CAT[cat]}</span>
        <span><small>PODER</small><b>${Number(m.power)>0?Number(m.power):"—"}</b></span>
        <span><small>DADOS</small><b>${dice&&dice!=="—"?dice:"—"}</b></span>
        <span><small>PRECISÃO</small><b>${Number(m.accuracy)>0?Number(m.accuracy)+"%":"—"}</b></span>
        ${bonus?`<span><small>BÔNUS</small><b>${esc(bonus)}</b></span>`:""}
      </div>
      <p class="sum-dialog">${esc(desc||"Sem descrição registrada.")}${Number(m.effectChance)>0?` <em>(Efeito ${Number(m.effectChance)}%)</em>`:""}</p>`;
  }

  let lastId=null;
  function render(){
    const p=typeof current!=="undefined"&&current?current:getCurrent();
    if(!p)return;
    const isNew=p.id!==lastId;
    lastId=p.id;
    const types=[norm(p.type1),norm(p.type2)].filter(Boolean);
    screen.style.setProperty("--sum-t1",TYPE_TINT[types[0]]||"#8aa0c0");
    screen.style.setProperty("--sum-t2",TYPE_TINT[types[1]||types[0]]||"#8aa0c0");
    screen.querySelector("#sumNo").textContent=`Nº${String(p.dex||"—").replace(/\D/g,"").padStart(4,"0")||"----"}`;
    screen.querySelector("#sumName").textContent=(p.name||"Sem nome").toUpperCase();
    screen.querySelector("#sumLv").textContent=`Lv${Number(p.level||1)}`;
    screen.querySelector("#sumTypes").innerHTML=types.map(typeBadge).join("");

    const img=screen.querySelector("#sumSprite"),empty=screen.querySelector("#sumEmpty");
    const src=typeof displayPokemonImage==="function"?displayPokemonImage(p):(p.imageUrl||"");
    if(src){
      if(img.getAttribute("src")!==src)img.src=src;
      img.hidden=false;empty.hidden=true;
      img.onerror=()=>{img.hidden=true;empty.hidden=false;};
    }else{img.hidden=true;empty.hidden=false;}
    if(isNew&&!reduceMotion()){
      const stage=screen.querySelector("#sumStage");
      stage.classList.remove("sum-release");void stage.offsetWidth;stage.classList.add("sum-release");
    }

    const max=Math.max(1,Number(p.maxHp||1)),cur=Math.max(0,Number(p.currentHp||0));
    const pct=Math.max(0,Math.min(100,cur/max*100));
    const fill=screen.querySelector("#sumHpFill");
    fill.style.width=pct+"%";
    fill.className=pct<25?"danger":pct<=50?"warning":"";
    screen.querySelector("#sumHpNum").textContent=`${cur} / ${max}`;
    screen.querySelector("#sumHpPct").textContent=`${Math.round(pct)}%`;

    const table=screen.querySelector("#sumInfoTable");
    if(!table.contains(document.activeElement))table.innerHTML=infoRows(p);
    if(isNew)selectedMove=null;
    screen.querySelector("#sumMoves").innerHTML=movesHtml(p);
    screen.querySelector("#sumMoveDetail").innerHTML=moveDetailHtml(p);
  }

  /* ---------- Eventos ---------- */
  function proxy(id,value){
    const el=document.getElementById(id);
    if(!el)return;
    el.value=value;
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
  }
  screen.addEventListener("click",event=>{
    const t=event.target.closest("[data-sum-tab]");
    if(t){setTab(t.dataset.sumTab);return;}
    const s=event.target.closest("[data-sum-step]");
    if(s){stepTab(Number(s.dataset.sumStep));return;}
    const mv=event.target.closest("[data-move]");
    if(mv){
      selectedMove=mv.dataset.move;
      screen.querySelectorAll("[data-move]").forEach(b=>b.classList.toggle("active",b===mv));
      screen.querySelector("#sumMoveDetail").innerHTML=moveDetailHtml(current);
      return;
    }
    const step=event.target.closest("[data-level-step]");
    if(step){
      const lv=Math.max(1,Math.min(100,Number(current.level||1)+Number(step.dataset.levelStep)));
      proxy("level",lv);
      if(Number(step.dataset.levelStep)>0&&lv>1)showToast(`${current.name||"Pokémon"} subiu para o nível ${lv}!`);
      render();
      return;
    }
    const act=event.target.closest("[data-sum-act]")?.dataset.sumAct;
    if(act==="cry"||event.target.closest("#sumStage"))playCry();
    if(act==="tools"){
      const on=!page.classList.contains("sum-tools");
      page.classList.toggle("sum-tools",on);
      screen.querySelector("#sumToolsBtn").setAttribute("aria-pressed",String(on));
      if(on)page.querySelector(".general-top-identity")?.scrollIntoView({behavior:reduceMotion()?"auto":"smooth",block:"start"});
    }
    if(act==="memory")document.getElementById("moveMemoryPanel")?.scrollIntoView({behavior:reduceMotion()?"auto":"smooth",block:"start"});
  });
  screen.addEventListener("change",event=>{
    const input=event.target.closest("[data-proxy]");
    if(!input)return;
    proxy(input.dataset.proxy,input.value);
    render();
  });
  screen.addEventListener("keydown",event=>{
    if(event.target.closest("input,textarea,select"))return;
    if(event.key==="ArrowRight"){event.preventDefault();stepTab(1);}
    if(event.key==="ArrowLeft"){event.preventDefault();stepTab(-1);}
  });

  let cry=null;
  function playCry(){
    const id=typeof officialPokedexId==="function"?officialPokedexId(current):0;
    const stage=screen.querySelector("#sumStage");
    if(!reduceMotion()){stage.classList.remove("sum-hop");void stage.offsetWidth;stage.classList.add("sum-hop");}
    if(!id){sfx("select");return;}
    try{
      cry?.pause();
      cry=new Audio(`https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`);
      cry.volume=.5;
      cry.play().catch(()=>{});
    }catch(e){}
  }

  document.addEventListener("hh:render",render);
  document.addEventListener("hh:pokemonchange",render);
  let t=0;
  page.addEventListener("input",event=>{
    if(event.target.closest(".sum-table"))return;
    clearTimeout(t);t=setTimeout(render,150);
  });

  /* A descrição da Ability se ajusta quando a largura muda (ex.: ao abrir a aba). */
  const abilityText=document.getElementById("abilityText");
  if(abilityText&&"ResizeObserver" in window&&typeof fitGeneralAbilityText==="function"){
    let lastW=0;
    new ResizeObserver(entries=>{
      const w=Math.round(entries[0].contentRect.width);
      if(w&&w!==lastW){lastW=w;requestAnimationFrame(fitGeneralAbilityText);}
    }).observe(abilityText);
  }

  setTab(tab,{sound:false});
  render();
})();
