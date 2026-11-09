/* ============================================================
   V6 — Animações da ficha
   Envolve funções já existentes (setActiveSheetPage, renderAll)
   sem mudar o que elas fazem. Respeita "reduzir movimento".
   ============================================================ */
(function(){
  "use strict";

  const reduceMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  function restartClass(el,className,ms){
    if(!el)return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    clearTimeout(el["_t_"+className]);
    el["_t_"+className]=setTimeout(()=>el.classList.remove(className),ms);
  }

  /* ---------- Troca de página ---------- */
  function animatePage(page){
    if(!page||reduceMotion())return;
    // Só os blocos visíveis no topo da página entram em cascata; o resto aparece junto.
    const blocks=[...page.querySelectorAll(".panel, .page-intro, :scope > section")]
      .filter(block=>!block.parentElement.closest(".panel")&&block.offsetParent!==null);
    const fold=window.innerHeight*1.2;
    let index=0;
    // Só anima o que está na tela; o resto aparece pronto (sem custo de desenho).
    blocks.forEach(block=>{
      block.classList.add("enter-block");
      const r=block.getBoundingClientRect();
      const visible=r.bottom>0&&r.top<fold;
      block.classList.toggle("enter-anim",visible);
      if(visible)block.style.setProperty("--enter-index",String(Math.min(index++,8)));
    });
    restartClass(page,"page-entering",1300);
  }

  if(typeof window.setActiveSheetPage==="function"){
    const originalSetPage=window.setActiveSheetPage;
    window.setActiveSheetPage=function(pageId,options){
      const before=document.querySelector(".page.active")?.id;
      const result=originalSetPage.apply(this,arguments);
      if(before!==pageId){
        animatePage(document.getElementById(pageId));
        document.dispatchEvent(new CustomEvent("hh:pagechange",{detail:{from:before,to:pageId}}));
      }
      return result;
    };
  }

  /* ---------- Troca de Pokémon ---------- */
  let lastPokemonId=typeof state!=="undefined"?state.currentId:null;

  if(typeof window.renderAll==="function"){
    const originalRenderAll=window.renderAll;
    window.renderAll=function(){
      const result=originalRenderAll.apply(this,arguments);
      const id=typeof state!=="undefined"?state.currentId:null;
      if(id!==lastPokemonId){
        lastPokemonId=id;
        if(!reduceMotion()){
          restartClass(document.querySelector(".sheet-head"),"pokemon-swapped",900);
          restartClass(document.getElementById("portrait"),"pokemon-swapped",900);
          restartClass(document.querySelector(".combat-portrait"),"pokemon-swapped",900);
        }
        document.dispatchEvent(new CustomEvent("hh:pokemonchange",{detail:{id}}));
      }else{
        document.dispatchEvent(new CustomEvent("hh:render"));
      }
      if(typeof fitGeneralAbilityText==="function")requestAnimationFrame(fitGeneralAbilityText);
      return result;
    };
  }

  /* ---------- Números que mudam dão um pulo ---------- */
  const watched=["generalOverviewLevel","generalOverviewHp","generalOverviewNature","generalOverviewMoves","activeCount","happinessValue","bstLabel","dexLabel"];
  const observer=new MutationObserver(records=>{
    if(reduceMotion())return;
    const seen=new Set();
    records.forEach(record=>{
      const el=record.target.nodeType===1?record.target:record.target.parentElement;
      const host=el?.closest?.(watched.map(id=>"#"+id).join(","));
      if(host&&!seen.has(host)){
        seen.add(host);
        if(host.style.display==="")host.style.display="inline-block";
        restartClass(host,"value-bump",500);
      }
    });
  });
  watched.forEach(id=>{
    const el=document.getElementById(id);
    if(el)observer.observe(el,{childList:true,characterData:true,subtree:true});
  });

  /* ---------- Cartões de golpe em cascata ---------- */
  const moveLists=document.querySelectorAll("#activeMoves");
  // Só anima golpes que não estavam na lista antes (a lista é refeita a cada edição).
  const knownMoves=new WeakMap();
  const moveObserver=new MutationObserver(records=>{
    const lists=new Set(records.map(r=>r.target));
    lists.forEach(list=>{
      const before=knownMoves.get(list)||new Set();
      const now=new Set();
      let index=0;
      list.querySelectorAll(":scope > .move-card").forEach(card=>{
        const id=card.dataset.moveId||card.textContent.slice(0,40);
        now.add(id);
        if(!before.has(id)&&before.size&&!reduceMotion()){
          card.style.setProperty("--enter-index",String(Math.min(index++,8)));
          card.classList.add("card-entering");
          setTimeout(()=>card.classList.remove("card-entering"),900);
        }
      });
      knownMoves.set(list,now);
    });
  });
  moveLists.forEach(list=>{
    knownMoves.set(list,new Set([...list.querySelectorAll(":scope > .move-card")].map(c=>c.dataset.moveId||c.textContent.slice(0,40))));
  });
  moveLists.forEach(list=>moveObserver.observe(list,{childList:true}));

  // A primeira página também entra animada.
  requestAnimationFrame(()=>animatePage(document.querySelector(".page.active")));
})();
