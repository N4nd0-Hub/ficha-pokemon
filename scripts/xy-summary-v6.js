/* ============================================================
   V6 — Telas de resumo X/Y (Memória de Moves)
   Não muda como os golpes são guardados: só lê current.moves,
   marca cada cartão com seu estado e acrescenta os detalhes
   visuais (tipo, categoria, Power/Acc, filtros e seleção).
   ============================================================ */
(function(){
  "use strict";

  const list=document.getElementById("memoryMoves");
  if(!list||typeof current==="undefined")return;

  const FILTERS=[
    {id:"all",label:"Todos"},
    {id:"active",label:"Equipados"},
    {id:"available",label:"Disponíveis"},
    {id:"locked",label:"Futuros"}
  ];
  const FILTER_KEY="hh_xy_move_filter";
  let selectedId=null;

  function readFilter(){
    try{const v=localStorage.getItem(FILTER_KEY);return FILTERS.some(f=>f.id===v)?v:"all"}catch(error){return "all"}
  }
  function writeFilter(v){
    try{localStorage.setItem(FILTER_KEY,v)}catch(error){}
  }

  const isLocked=m=>typeof isMoveLevelLocked==="function"?isMoveLevelLocked(m):false;
  const moveById=id=>(current?.moves||[]).find(m=>String(m.id)===String(id));
  const stateOf=m=>isLocked(m)?"locked":m.active?"active":"available";

  /* ---------- Abas de filtro ---------- */
  const bar=document.createElement("div");
  bar.className="xy-move-filters";
  bar.setAttribute("role","group");
  bar.setAttribute("aria-label","Filtrar golpes");
  list.insertAdjacentElement("beforebegin",bar);

  function renderFilters(){
    const moves=current?.moves||[];
    const counts={
      all:moves.length,
      active:moves.filter(m=>stateOf(m)==="active").length,
      available:moves.filter(m=>stateOf(m)!=="locked").length,
      locked:moves.filter(m=>stateOf(m)==="locked").length
    };
    const active=readFilter();
    bar.innerHTML=FILTERS.map(f=>`<button type="button" data-xy-filter="${f.id}" aria-pressed="${f.id===active}">${f.label}<b>${counts[f.id]}</b></button>`).join("");
    list.dataset.xyFilter=active;
  }
  bar.addEventListener("click",event=>{
    const btn=event.target.closest("[data-xy-filter]");
    if(!btn)return;
    writeFilter(btn.dataset.xyFilter);
    renderFilters();
  });

  /* ---------- Cartões ---------- */
  function categoryOf(m){
    const c=String(m?.category||"").toLowerCase();
    if(c.startsWith("phys")||c.startsWith("fís")||c.startsWith("fis"))return "physical";
    if(c.startsWith("spec")||c.startsWith("esp"))return "special";
    return "status";
  }
  const CATEGORY_LABEL={physical:"Físico",special:"Especial",status:"Status"};

  function decorate(card){
    const move=moveById(card.dataset.moveId);
    if(!move)return;
    const state=stateOf(move);
    card.dataset.xyState=state;
    card.tabIndex=0;
    card.setAttribute("aria-selected",String(String(move.id)===String(selectedId)));
    card.classList.toggle("xy-selected",String(move.id)===String(selectedId));

    const info=card.querySelector(".move-card-top>div:first-child");
    const meta=card.querySelector(".move-meta");
    const name=card.querySelector(".move-name");
    if(!info||!meta||!name||info.querySelector(".xy-move-type"))return;

    // Tipo vai para a frente do nome, como na tela de resumo.
    const typeBadge=meta.querySelector(".type-icon-badge");
    if(typeBadge){
      const clone=typeBadge.cloneNode(true);
      clone.classList.add("xy-move-type");
      info.insertBefore(clone,name);
    }

    // Categoria em ícone ao lado do nome.
    const cat=categoryOf(move);
    const catIcon=document.createElement("span");
    catIcon.className=`xy-move-cat ${cat}`;
    catIcon.title=CATEGORY_LABEL[cat];
    catIcon.setAttribute("aria-label",CATEGORY_LABEL[cat]);
    name.prepend(catIcon);

    // Power e Accuracy em mostradores; as etiquetas repetidas somem.
    let accText="—";
    meta.querySelectorAll(":scope > .tag").forEach(tag=>{
      const t=tag.textContent.trim();
      if(/^(Physical|Special|Status)$/i.test(t)||/^Power\b/i.test(t)){tag.classList.add("xy-hide");return;}
      if(/^Acc\.?/i.test(t)){accText=t.replace(/^Acc\.?\s*/i,"");tag.classList.add("xy-hide");}
    });
    const power=Number(move.power||0);
    const stats=document.createElement("span");
    stats.className="xy-move-stats";
    stats.innerHTML=`
      <span class="xy-move-stat"><small>PODER</small><b>${power>0?power:"—"}</b></span>
      <span class="xy-move-stat"><small>PRECISÃO</small><b>${accText}</b></span>`;
    name.insertAdjacentElement("afterend",stats);
  }

  function decorateAll(){
    list.querySelectorAll(":scope > .move-card").forEach(decorate);
    renderFilters();
  }

  /* ---------- Seleção (como escolher um golpe no jogo) ---------- */
  function select(card,{toggle=true}={}){
    const id=card?.dataset.moveId;
    if(!id)return;
    selectedId=toggle&&String(selectedId)===String(id)?null:id;
    list.querySelectorAll(":scope > .move-card").forEach(c=>{
      const on=String(c.dataset.moveId)===String(selectedId);
      c.classList.toggle("xy-selected",on);
      c.setAttribute("aria-selected",String(on));
    });
  }

  list.addEventListener("click",event=>{
    if(event.target.closest("button,input,select,textarea,a"))return;
    const card=event.target.closest(".move-card");
    if(card)select(card);
  });
  list.addEventListener("keydown",event=>{
    const card=event.target.closest(".move-card");
    if(!card||event.target!==card)return;
    if(event.key==="Enter"||event.key===" "){
      event.preventDefault();
      select(card);
      return;
    }
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      event.preventDefault();
      const visible=[...list.querySelectorAll(":scope > .move-card")].filter(c=>c.offsetParent!==null);
      const i=visible.indexOf(card);
      const next=visible[i+(event.key==="ArrowDown"?1:-1)];
      if(next){next.focus();select(next,{toggle:false});}
    }
  });

  /* ---------- Ability: placa + caixa de diálogo ---------- */
  (function decorateAbility(){
    const name=document.getElementById("abilityName");
    const text=document.getElementById("abilityText");
    if(!name||!text||text.parentElement.classList.contains("xy-dialog"))return;
    const label=document.createElement("span");
    label.className="xy-ability-label";
    label.textContent="HABILIDADE";
    name.insertAdjacentElement("beforebegin",label);
    const dialog=document.createElement("div");
    dialog.className="xy-dialog";
    text.insertAdjacentElement("beforebegin",dialog);
    dialog.appendChild(text);
  })();

  new MutationObserver(decorateAll).observe(list,{childList:true});
  decorateAll();
})();
