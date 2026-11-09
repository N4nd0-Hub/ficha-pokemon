/* ============================================================
   V6 — PC de Pokémon (barra lateral)
   Troca a lista da gaveta por um PC como o dos jogos:
   Equipe em lista com HP, caixas em grade de 6×5, prévia do
   Pokémon sob o cursor e ações (ver, favoritar, mover, soltar).
   Usa os mesmos dados e regras da gaveta original.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined"||typeof renderDrawer!=="function")return;

  const inner=document.querySelector(".drawer .drawer-inner");
  if(!inner)return;

  const BOX_SIZE=30;
  const TEAM_MAX=6;
  const store={
    get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},
    set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  };
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const sfx=name=>window.hhClassicSfx?.[name]?.();
  const img=p=>typeof displayPokemonImage==="function"?displayPokemonImage(p):(p.imageUrl||"");
  const typesOf=p=>[p.type1,p.type2].map(t=>typeof normalizeTypeName==="function"?normalizeTypeName(t):t).filter(Boolean);
  const typeBadge=t=>typeof typeIconHtml==="function"?typeIconHtml(t,true):`<span class="tag">${esc(t)}</span>`;
  const hpPct=p=>{
    const max=Math.max(1,Number(p.maxHp||1));
    return Math.max(0,Math.min(100,Number(p.currentHp||0)/max*100));
  };
  const hpClass=pct=>pct<25?"danger":pct<=50?"warning":"";

  let view=store.get("hh_pc_view","team"); // "team" ou "box-N"
  let previewId=null;

  const root=document.createElement("section");
  root.className="pc-box";
  root.setAttribute("aria-label","PC de Pokémon");
  inner.classList.add("has-pc-box");
  inner.appendChild(root);

  const team=()=>state.pokemon.filter(p=>(p.storageGroup||"team")==="team");
  const boxed=()=>state.pokemon.filter(p=>(p.storageGroup||"team")!=="team");
  const boxCount=()=>Math.max(1,Math.ceil((boxed().length+1)/BOX_SIZE));
  const views=()=>["team",...Array.from({length:boxCount()},(_,i)=>`box-${i+1}`)];
  const byId=id=>state.pokemon.find(p=>String(p.id)===String(id));

  function viewLabel(v){
    if(v==="team")return "EQUIPE";
    return `CAIXA ${v.split("-")[1]}`;
  }

  /* ---------- Ações ---------- */
  function selectPokemon(p){
    if(!p)return;
    state.currentId=p.id;
    current=getCurrent();
    renderAll();
    if(typeof closeMobileDrawerIfNeeded==="function")closeMobileDrawerIfNeeded();
    debouncedSave();
  }
  function toggleFavorite(p){
    p.favorite=!p.favorite;
    renderDrawer();
    debouncedSave();
  }
  function move(p){
    if((p.storageGroup||"team")!=="team"){
      if(team().length>=TEAM_MAX){showToast("A Equipe já possui seis Pokémon.");sfx("error");return;}
      p.storageGroup="team";
      showToast(`${p.name||"Pokémon"} entrou na Equipe!`);
    }else{
      if(team().length<=1&&state.pokemon.length>1&&boxed().length===0){/* deixa mover mesmo assim */}
      p.storageGroup="box";
      showToast(`${p.name||"Pokémon"} foi guardado na caixa.`);
    }
    renderDrawer();
    if(typeof renderCombatParty==="function")renderCombatParty();
    if(typeof renderTrainerParty==="function")renderTrainerParty();
    debouncedSave();
  }
  function release(p){
    if(state.pokemon.length===1){showToast("É preciso manter ao menos uma ficha.");sfx("error");return;}
    if(!confirm(`Soltar ${p.name||"este Pokémon"}? A ficha será excluída.`))return;
    state.pokemon=state.pokemon.filter(x=>x.id!==p.id);
    if(state.currentId===p.id)state.currentId=state.pokemon[0].id;
    if(previewId===p.id)previewId=null;
    current=getCurrent();
    renderAll();
    if(typeof saveState==="function")saveState();
    showToast(`Tchau, ${p.name||"Pokémon"}!`);
  }

  /* ---------- Desenho ---------- */
  function slotHtml(p,i){
    if(!p)return `<span class="pc-slot empty" aria-hidden="true"></span>`;
    const src=img(p);
    const on=String(p.id)===String(state.currentId);
    return `<button type="button" class="pc-slot${on?" current":""}" data-pc-id="${esc(p.id)}" title="${esc(p.name)} • Lv. ${Number(p.level||1)}">
      ${src?`<img src="${esc(src)}" alt="" loading="lazy" draggable="false">`:'<span class="pc-ball">◓</span>'}
      ${p.favorite?'<i class="pc-fav" aria-label="Favorito">★</i>':""}
    </button>`;
  }
  function partyHtml(p){
    const src=img(p);
    const pct=hpPct(p);
    const on=String(p.id)===String(state.currentId);
    return `<button type="button" class="pc-party${on?" current":""}" data-pc-id="${esc(p.id)}">
      <span class="pc-party-sprite">${src?`<img src="${esc(src)}" alt="" loading="lazy" draggable="false">`:'<span class="pc-ball">◓</span>'}</span>
      <span class="pc-party-info">
        <b>${esc(p.name||"Sem nome")}${p.favorite?' <i class="pc-fav-inline">★</i>':""}</b>
        <span class="pc-party-lv">Lv${Number(p.level||1)}</span>
        <span class="pc-hp"><small>HP</small><span class="pc-hp-bar"><i class="${hpClass(pct)}" style="width:${pct}%"></i></span></span>
        <span class="pc-hp-num">${Math.max(0,Number(p.currentHp||0))}/${Math.max(1,Number(p.maxHp||1))}</span>
      </span>
    </button>`;
  }
  function previewHtml(p){
    if(!p)return `<div class="pc-preview empty"><p>Passe o cursor sobre um Pokémon.</p></div>`;
    const src=img(p);
    const inTeam=(p.storageGroup||"team")==="team";
    return `<div class="pc-preview">
      <div class="pc-preview-stage">${src?`<img src="${esc(src)}" alt="${esc(p.name)}" draggable="false">`:'<span class="pc-ball big">◓</span>'}</div>
      <div class="pc-preview-info">
        <b>${esc(p.name||"Sem nome")}</b>
        <span>Lv. ${Number(p.level||1)} • Nº ${esc(String(p.dex||"—").padStart(4,"0"))}</span>
        <span class="pc-preview-types">${typesOf(p).map(typeBadge).join("")}</span>
        <span>Item: <em>${esc(p.heldItem||"nenhum")}</em></span>
      </div>
      <div class="pc-preview-actions">
        <button type="button" data-pc-act="open" data-pc-target="${esc(p.id)}">▶ VER FICHA</button>
        <button type="button" data-pc-act="fav" data-pc-target="${esc(p.id)}" aria-pressed="${!!p.favorite}">${p.favorite?"★ FAVORITO":"☆ FAVORITAR"}</button>
        <button type="button" data-pc-act="move" data-pc-target="${esc(p.id)}">${inTeam?"⇣ GUARDAR":"⇡ À EQUIPE"}</button>
        <button type="button" data-pc-act="release" data-pc-target="${esc(p.id)}" class="danger">SOLTAR</button>
      </div>
    </div>`;
  }

  function render(){
    if(!views().includes(view))view="team";
    const t=team(),b=boxed();
    const previewP=byId(previewId)||byId(state.currentId);
    let body="";
    if(view==="team"){
      body=`<div class="pc-party-list">${t.map(partyHtml).join("")}${Array.from({length:Math.max(0,TEAM_MAX-t.length)},()=>'<span class="pc-party empty" aria-hidden="true"><span>— vazio —</span></span>').join("")}</div>`;
    }else{
      const n=Number(view.split("-")[1])-1;
      const slots=b.slice(n*BOX_SIZE,(n+1)*BOX_SIZE);
      body=`<div class="pc-grid">${Array.from({length:BOX_SIZE},(_,i)=>slotHtml(slots[i],i)).join("")}</div>`;
    }
    root.innerHTML=`
      <header class="pc-head">
        <div class="pc-title"><span class="pc-led" aria-hidden="true"></span><div><small>SISTEMA DE ARMAZENAMENTO</small><b>PC DE POKÉMON</b></div></div>
        <button type="button" class="pc-new" data-pc-act="new" title="Criar novo Pokémon">＋ NOVO</button>
      </header>
      <div class="pc-switch">
        <button type="button" data-pc-nav="-1" aria-label="Caixa anterior">◀</button>
        <div class="pc-switch-label" aria-live="polite">
          <b>${viewLabel(view)}</b>
          <small>${view==="team"?`${t.length} / ${TEAM_MAX}`:`${b.length} guardados`}</small>
        </div>
        <button type="button" data-pc-nav="1" aria-label="Próxima caixa">▶</button>
      </div>
      <div class="pc-wall ${view==="team"?"is-team":"is-box"}">${body}</div>
      ${previewHtml(previewP)}
      <footer class="pc-foot">${state.pokemon.length} Pokémon registrados • Equipe ${t.length}/${TEAM_MAX}</footer>`;
  }

  root.addEventListener("click",event=>{
    const nav=event.target.closest("[data-pc-nav]");
    if(nav){
      const list=views();
      const i=list.indexOf(view);
      view=list[(i+Number(nav.dataset.pcNav)+list.length)%list.length];
      store.set("hh_pc_view",view);
      sfx("page");
      const wall=root.querySelector(".pc-wall");
      render();
      root.querySelector(".pc-wall")?.classList.add(Number(nav.dataset.pcNav)>0?"slide-left":"slide-right");
      return;
    }
    const act=event.target.closest("[data-pc-act]");
    if(act){
      if(act.dataset.pcAct==="new"){document.getElementById("drawerNewBtn")?.click();return;}
      const p=byId(act.dataset.pcTarget);
      if(!p)return;
      if(act.dataset.pcAct==="open")selectPokemon(p);
      if(act.dataset.pcAct==="fav")toggleFavorite(p);
      if(act.dataset.pcAct==="move")move(p);
      if(act.dataset.pcAct==="release")release(p);
      return;
    }
    const slot=event.target.closest("[data-pc-id]");
    if(slot){previewId=slot.dataset.pcId;selectPokemon(byId(slot.dataset.pcId));}
  });
  root.addEventListener("pointerover",event=>{
    const slot=event.target.closest("[data-pc-id]");
    if(!slot||slot.dataset.pcId===previewId)return;
    previewId=slot.dataset.pcId;
    const holder=root.querySelector(".pc-preview");
    if(holder){
      const tmp=document.createElement("div");
      tmp.innerHTML=previewHtml(byId(previewId));
      holder.replaceWith(tmp.firstElementChild);
    }
  });

  // Atualiza sempre que a gaveta original seria redesenhada.
  const originalRenderDrawer=window.renderDrawer;
  window.renderDrawer=function(){
    const result=originalRenderDrawer.apply(this,arguments);
    render();
    return result;
  };
  render();
})();
