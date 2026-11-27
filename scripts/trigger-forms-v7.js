/* ============================================================
   V7 — Formas por gatilho (Pokédex GM, forma "trigger")
   Pokémon que mudam de forma sozinhos (ex.: Brute Chaos desperta
   com a Protosynthesis). Na Arena a troca é automática pelo
   gatilho; na ficha, o botão ✦ FORMA alterna a arte (e os tipos,
   se a forma tiver outros) para jogar na mesa com o Mestre.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;
  const cur=()=>{try{return current;}catch(e){return null;}};
  const toast=t=>{try{showToast(t);}catch(e){}};
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const save=()=>{try{saveState();}catch(e){try{debouncedSave();}catch(_){}}};
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const formOf=p=>(p?.triggerForms||[]).find(f=>String(f.id)===String(p.formActive))||null;
  const W={sun:"Sol Forte",rain:"Chuva",sand:"Tempestade de areia",hail:"Granizo",snow:"Neve"};
  function triggerText(f){
    const T=f?.trigger||{};if(T.text)return T.text;
    const out=[...(T.weather||[]).map(w=>W[w]||w),...(T.items||[]),T.hpBelow?`HP ≤ ${Math.round(T.hpBelow*100)}%`:""].filter(Boolean);
    return out.join(" ou ")||"gatilho próprio";
  }

  function toggle(){
    const p=cur();if(!p?.triggerForms?.length)return;
    const f=p.triggerForms[0];
    if(p.formActive){
      if(p.formBaseTypes){p.type1=p.formBaseTypes[0];p.type2=p.formBaseTypes[1]||"";}
      p.formActive=null;p.formBaseTypes=null;
      toast(`${p.name} voltou à forma normal.`);
    }else{
      const types=(f.types||[]).filter(Boolean);
      if(types.length&&(types[0]!==p.type1||(types[1]||"")!==(p.type2||""))){p.formBaseTypes=[p.type1,p.type2||""];p.type1=types[0];p.type2=types[1]||"";}
      p.formActive=f.id;
      toast(`✦ ${f.name}!`);
      const stage=document.getElementById("sumStage");
      if(stage){stage.classList.remove("tf7-flash");void stage.offsetWidth;stage.classList.add("tf7-flash");}
    }
    sfx("page");save();
    try{renderAll();}catch(e){}
  }

  function render(){
    const p=cur();
    const box=document.querySelector("#sumScreen .sum-left-actions");if(!box)return;
    let btn=box.querySelector("[data-tf=toggle]");
    const has=!!p?.triggerForms?.length;
    if(!has){btn?.remove();document.getElementById("sumStage")?.classList.remove("tf7-on");return;}
    if(!btn){box.insertAdjacentHTML("beforeend",`<button type="button" data-tf="toggle" class="tf7-btn" aria-pressed="false"></button>`);btn=box.querySelector("[data-tf=toggle]");}
    const f=p.triggerForms[0],on=!!formOf(p);
    btn.setAttribute("aria-pressed",String(on));btn.classList.toggle("on",on);
    btn.innerHTML=on?"↺ FORMA NORMAL":"✦ "+esc(String(f.name||"FORMA").replace(/^.*\((.*)\)$/,"$1").toUpperCase());
    btn.title=on?"Voltar para a forma normal":`Trocar para ${f.name}. Na Arena muda sozinho com: ${triggerText(f)}.`;
    document.getElementById("sumStage")?.classList.toggle("tf7-on",on);
  }

  document.addEventListener("click",e=>{if(e.target.closest("#sumScreen [data-tf=toggle]"))toggle();});
  ["hh:render","hh:pokemonchange"].forEach(ev=>document.addEventListener(ev,render));
  setTimeout(render,400);
  window.hhTriggerForms={toggle,render,triggerText};
})();
