/* ============================================================
   V7 — Página 04 · Centro de Treinamento
   Resumo dos treinos (arte do Pokémon, treino de hoje, prontos, TMs)
   e a lista de TMs da Mochila para começar um treino com um clique.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const $=id=>document.getElementById(id);
  const cur=()=>{try{return current;}catch(e){return null;}};
  const TC={Normal:"#a8a77a",Fire:"#ee8130",Water:"#6390f0",Electric:"#f7d02c",Grass:"#7ac74c",Ice:"#96d9d6",Fighting:"#c22e28",Poison:"#a33ea1",Ground:"#e2bf65",Flying:"#a98ff3",Psychic:"#f95587",Bug:"#a6b91a",Rock:"#b6a136",Ghost:"#735797",Dragon:"#6f35fc",Dark:"#705746",Steel:"#b7b7ce",Fairy:"#d685ad"};
  const sprite=slug=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${encodeURIComponent(slug)}.png`;
  let again=0;
  function paint(){
    const p=cur(),page=$("page3");if(!p||!page)return;
    const list=p.trainingMoves||[];
    const active=list.find(t=>t.active);
    const ready=list.filter(t=>Number(t.successes||0)>=Number(t.required||5)).length;
    const tms=window.hhTmForge?.tms?.()||[];
    const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
    set("miscOverviewTraining",String(list.length));
    set("tr7Active",active?active.name:"—");
    set("tr7Ready",String(ready));
    set("tr7Tms",String(tms.reduce((a,i)=>a+Number(i.qty||0),0)));
    const art=$("tr7Art");
    if(art){let img="";try{img=displayPokemonImage(p)||"";}catch(e){}
      const key=img+"|"+p.name;if(art.dataset.k!==key){art.dataset.k=key;art.innerHTML=img?`<img src="${esc(img)}" alt="">`:"";}}
    set("tr7Sub",list.length?`${p.name} está treinando ${list.length} golpe${list.length>1?"s":""}${active?`; hoje: ${active.name}`:""}${ready?` · ${ready} pronto${ready>1?"s":""} para aprender`:""}.`:`${p.name} não está treinando nenhum golpe. Comece um treino ou use um TM.`);
    // TMs da Mochila
    const box=$("tr7TmList");
    if(box){
      if(!tms.length)box.innerHTML=`<p class="tr7-tmempty">Nenhum TM. Crie um no Criador de TM (Mochila › TMs).</p>`;
      else{
        let pending=false;
        box.innerHTML=tms.map(it=>{
          const mv=it.tm.move,v=window.hhTmForge.verdict(p,mv);if(v.pending)pending=true;
          const known=(p.moves||[]).some(m=>String(m.name).toLowerCase()===String(mv.name).toLowerCase())||(p.trainingMoves||[]).some(t=>String(t.name).toLowerCase()===String(mv.name).toLowerCase());
          return `<div class="tr7-tm" style="--t:${TC[mv.type]||"#888"}">
            <img src="${esc(sprite("tm-"+String(mv.type).toLowerCase()))}" alt="" width="30" height="30">
            <div><b>${esc(mv.name)}</b><small>${v.pending?"conferindo…":v.legal?"legal · 1 sucesso":"ilegal · 3 treinos"} · ×${Number(it.qty)}</small></div>
            <button type="button" class="btn small" data-tr7-tm="${esc(it.id)}" ${v.pending||known?"disabled":""} title="${known?`${esc(p.name)} já sabe ou já treina este golpe`:"Começa o treino e gasta o TM"}">${known?"Já tem":"Usar"}</button>
          </div>`;}).join("");
        if(pending){clearTimeout(again);again=setTimeout(paint,1200);}
      }
    }
  }
  document.addEventListener("click",e=>{
    const b=e.target.closest?.("[data-tr7-tm]");
    if(b){window.hhTmForge?.teach(b.dataset.tr7Tm,cur());try{renderTrainingMoves();}catch(err){}paint();return;}
    if(e.target.closest?.("#tr7TmOpen"))window.hhItemsUI?.open?.("tm");
  });
  // lembra quais caixas (Abilities / Anotações) ficam abertas
  ["tr7Abilities","tr7Notes"].forEach(id=>{const d=$(id);if(!d)return;try{d.open=localStorage.getItem("hh_tr7_"+id)==="1";}catch(e){}
    d.addEventListener("toggle",()=>{try{localStorage.setItem("hh_tr7_"+id,d.open?"1":"0");}catch(e){}});});
  document.addEventListener("hh:training",paint);
  document.addEventListener("hh:render",paint);
  setTimeout(paint,600);
  window.hhTraining={paint};
})();
