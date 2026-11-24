/* ============================================================
   V6 — Seletor de ambiente da Batalha com miniaturas.
   Mantém o <select id="combatArenaSelect"> original (que salva o
   ambiente) e troca a aparência por um botão + grade de cenários.
   ============================================================ */
(function(){
  "use strict";
  const picker=document.querySelector(".combat-arena-picker");
  const select=document.getElementById("combatArenaSelect");
  if(!picker||!select||picker.classList.contains("ar-ready"))return;
  const NEW=new Set(["temple","city","mountain","ocean"]);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const thumb=v=>`url('assets/arenas/${v}.png')`;
  const opts=()=>[...select.options].map(o=>({v:o.value,label:o.textContent.trim()}));

  picker.classList.add("ar-ready");
  const btn=document.createElement("button");
  btn.type="button";btn.className="ar-btn";btn.setAttribute("aria-haspopup","true");btn.setAttribute("aria-expanded","false");
  const pop=document.createElement("div");
  pop.className="ar-pop";pop.hidden=true;pop.setAttribute("role","dialog");pop.setAttribute("aria-label","Escolher ambiente");
  picker.append(btn,pop);

  function renderBtn(){
    const o=opts().find(x=>x.v===select.value)||opts()[0];
    btn.innerHTML=`<i class="ar-thumb" style="background-image:${thumb(o.v)}"></i><span class="ar-btn-text"><small>AMBIENTE</small><b>${esc(o.label)}</b></span><span class="ar-btn-caret">▲</span>`;
    btn.setAttribute("aria-label",`Ambiente: ${o.label}. Trocar ambiente`);
  }
  function renderPop(){
    pop.innerHTML=`<h4>Escolha o ambiente <small>${opts().length} cenários</small></h4><div class="ar-grid">${opts().map(o=>`
      <button type="button" class="ar-card${o.v===select.value?" on":""}" data-ar="${esc(o.v)}" aria-pressed="${o.v===select.value}">
        <i class="ar-thumb" style="background-image:${thumb(o.v)}"></i>${NEW.has(o.v)?"<em>NOVO</em>":""}<b>${esc(o.label)}</b></button>`).join("")}</div>`;
  }
  function open(v){
    pop.hidden=!v;picker.classList.toggle("ar-open",v);btn.setAttribute("aria-expanded",String(v));
    if(v){renderPop();pop.querySelector(".ar-card.on")?.focus({preventScroll:true});window.hhClassicSfx?.select?.();}
  }
  btn.addEventListener("click",e=>{e.stopPropagation();open(pop.hidden);});
  pop.addEventListener("click",e=>{
    const c=e.target.closest("[data-ar]");if(!c)return;
    if(select.value!==c.dataset.ar){select.value=c.dataset.ar;select.dispatchEvent(new Event("change",{bubbles:true}));}
    open(false);renderBtn();btn.focus({preventScroll:true});
  });
  document.addEventListener("click",e=>{if(!pop.hidden&&!picker.contains(e.target))open(false);});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!pop.hidden){open(false);btn.focus();}});
  select.addEventListener("change",renderBtn);
  const orig=window.applyCombatArena;
  if(typeof orig==="function")window.applyCombatArena=function(){const r=orig.apply(this,arguments);renderBtn();return r;};
  renderBtn();
})();
