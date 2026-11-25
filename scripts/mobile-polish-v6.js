/* ============================================================
   V6 — Celular: polimento geral
   • Fileira do time no topo: troca de Pokémon com um toque
     (substitui o cabeçalho grande, que repetia a barra inferior).
   • iPhone: impede o zoom automático ao tocar num campo de texto
     (o usuário continua podendo ampliar com dois dedos).
   • Vibração curta ao trocar de página/Pokémon (Android).
   • Registra o app para funcionar como aplicativo e sem internet.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;
  const mobile=()=>window.matchMedia("(max-width:900px)").matches;
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const buzz=ms=>{try{if(mobile()&&navigator.vibrate)navigator.vibrate(ms);}catch(e){}};

  /* ---------- iPhone: sem zoom automático nos campos ---------- */
  const ios=/iP(hone|od|ad)/.test(navigator.platform)||/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.platform)&&navigator.maxTouchPoints>1);
  if(ios){
    const meta=document.querySelector('meta[name="viewport"]');
    // No iOS, maximum-scale só bloqueia o zoom do foco; a pinça continua funcionando.
    if(meta&&!/maximum-scale/.test(meta.content))meta.content+=", maximum-scale=1";
  }

  /* ---------- Fileira do time ---------- */
  const head=document.querySelector(".sheet-head");
  if(head&&!document.getElementById("mpTeam")){
    const bar=document.createElement("nav");
    bar.id="mpTeam";bar.className="mp-team";bar.setAttribute("aria-label","Trocar de Pokémon");
    head.prepend(bar);
    const team=()=>state.pokemon.filter(p=>(p.storageGroup||"team")==="team").slice(0,6);
    const img=p=>typeof displayPokemonImage==="function"?displayPokemonImage(p):(p.imageUrl||"");
    let last="";
    function render(){
      const list=team(),cur=typeof current!=="undefined"&&current?current:null;
      // o Pokémon aberto aparece mesmo se estiver guardado no PC
      if(cur&&!list.some(p=>p.id===cur.id))list.push(cur);
      const sig=list.map(p=>[p.id,p.name,p.level,img(p).length,p.currentHp,p.maxHp].join(":")).join("|")+"#"+(cur?.id||"");
      if(sig===last)return;last=sig;
      bar.innerHTML=list.map(p=>{
        const on=cur&&p.id===cur.id;
        const pct=Math.max(0,Math.min(100,Math.round(100*Number(p.currentHp||0)/Math.max(1,Number(p.maxHp||1)))));
        const src=img(p);
        return `<button type="button" class="mp-mon${on?" on":""}" data-mp-id="${esc(p.id)}" aria-pressed="${!!on}" aria-label="${esc(p.name)}, nível ${Number(p.level||1)}">
          <span class="mp-pic">${src?`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`:`<i>◓</i>`}</span>
          <span class="mp-hp" data-hp="${pct>50?"high":pct>20?"mid":"low"}" style="--hp:${pct}%"><i></i></span>
          <b>${esc(p.name)}</b><small>Lv${Number(p.level||1)}</small>
        </button>`;
      }).join("")+`<button type="button" class="mp-mon mp-more" data-mp-drawer aria-label="Abrir time e PC"><span class="mp-pic"><i>☰</i></span><b>PC</b><small>${state.pokemon.length}</small></button>`;
      // Mostra o Pokémon atual sem rolar a página (só a fileira, e só se estiver fora da vista).
      const on=bar.querySelector(".mp-mon.on");
      if(on){
        const left=on.offsetLeft-bar.offsetLeft,right=left+on.offsetWidth;
        if(left<bar.scrollLeft||right>bar.scrollLeft+bar.clientWidth)bar.scrollLeft=Math.max(0,left-(bar.clientWidth-on.offsetWidth)/2);
      }
    }
    bar.addEventListener("click",event=>{
      if(event.target.closest("[data-mp-drawer]")){document.getElementById("mobileDrawerNav")?.click();return;}
      const b=event.target.closest("[data-mp-id]");
      if(!b||b.dataset.mpId===state.currentId)return;
      state.currentId=b.dataset.mpId;
      current=getCurrent();
      renderAll();
      if(typeof debouncedSave==="function")debouncedSave();
      buzz(8);
    });
    ["renderAll","renderDrawer"].forEach(fn=>{
      const original=window[fn];if(typeof original!=="function")return;
      window[fn]=function(){const r=original.apply(this,arguments);render();return r;};
    });
    document.addEventListener("hh:render",render);
    document.addEventListener("hh:pokemonchange",render);
    render();
  }

  /* ---------- Vibração leve na barra inferior ---------- */
  document.getElementById("mobileBottomNav")?.addEventListener("click",e=>{if(e.target.closest(".mobile-nav-btn"))buzz(6);});

  /* ---------- App instalável e offline ---------- */
  if("serviceWorker" in navigator&&location.protocol==="https:"){
    window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(()=>{});});
  }
})();
