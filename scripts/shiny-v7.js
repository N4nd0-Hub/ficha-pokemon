/* ============================================================
   V7 — Pokémon Shiny na ficha
   Botão ✦ SHINY embaixo da arte (página 01). Ligado, o Pokémon
   aparece shiny em toda a ficha (resumo, Box, Trainer Card, Arena,
   Pokédex): arte oficial shiny da PokéAPI, forma Shiny da Pokédex GM
   ou uma arte shiny enviada pelo jogador (📷 ARTE SHINY).
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;
  const cur=()=>{try{return current;}catch(e){return null;}};
  const toast=t=>{try{showToast(t);}catch(e){}};
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const save=()=>{try{saveState();}catch(e){try{debouncedSave();}catch(_){}}};
  const hasArt=p=>{try{return !!shinyPokemonImage(p);}catch(e){return false;}};

  const input=document.createElement("input");
  input.type="file";input.accept="image/png,image/jpeg,image/webp,image/gif";input.hidden=true;
  document.body.appendChild(input);

  async function shrink(file,max=512){
    const url=await new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(String(r.result||""));r.onerror=ko;r.readAsDataURL(file);});
    try{
      const img=new Image();await new Promise((ok,ko)=>{img.onload=ok;img.onerror=ko;img.src=url;});
      const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.naturalWidth*s));c.height=Math.max(1,Math.round(img.naturalHeight*s));
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      return c.toDataURL("image/webp",.9);
    }catch(e){return url;}
  }

  function render(){
    const p=cur();
    const box=document.querySelector("#sumScreen .sum-left-actions");
    if(!box||!p)return;
    let btn=box.querySelector("[data-shiny=toggle]");
    if(!btn){
      box.insertAdjacentHTML("beforeend",`<button type="button" data-shiny="toggle" class="shiny7-btn" aria-pressed="false">✦ SHINY</button>
        <button type="button" data-shiny="art" class="shiny7-art" hidden>📷 ARTE SHINY</button>`);
      btn=box.querySelector("[data-shiny=toggle]");
      box.classList.add("shiny7-actions");
    }
    const on=!!p.shiny;
    btn.setAttribute("aria-pressed",String(on));
    btn.classList.toggle("on",on);
    btn.title=on?"Voltar para a cor normal":"Mostrar este Pokémon na forma Shiny";
    const art=box.querySelector("[data-shiny=art]");
    const needArt=on;
    art.hidden=!needArt;
    art.textContent=p.shinyImageUrl?"📷 TROCAR ARTE SHINY":"📷 ENVIAR ARTE SHINY";
    const stage=document.getElementById("sumStage");
    stage?.classList.toggle("shiny7-on",on);
    const name=document.getElementById("sumName");
    if(name){let star=name.parentElement.querySelector(".shiny7-star");
      if(on&&!star){name.insertAdjacentHTML("afterend",`<i class="shiny7-star" title="Shiny" aria-label="Shiny">✦</i>`);}
      if(!on&&star)star.remove();}
  }

  function sparkle(){
    const stage=document.getElementById("sumStage");if(!stage)return;
    stage.classList.remove("shiny7-burst");void stage.offsetWidth;stage.classList.add("shiny7-burst");
    setTimeout(()=>stage.classList.remove("shiny7-burst"),1300);
  }

  document.addEventListener("click",e=>{
    const b=e.target.closest("#sumScreen [data-shiny]");if(!b)return;
    const p=cur();if(!p)return;
    if(b.dataset.shiny==="toggle"){
      p.shiny=!p.shiny;
      try{renderAll();}catch(_){}
      save();render();
      if(p.shiny){sparkle();sfx("page");
        if(!hasArt(p))toast(`✦ ${p.name} agora é Shiny! Ele usa uma arte própria: envie a versão shiny em "📷 Enviar arte shiny".`);
        else toast(`✦ ${p.name} agora é Shiny!`);
      }else{sfx("select");toast(`${p.name} voltou para a cor normal.`);}
    }else if(b.dataset.shiny==="art"){input.value="";input.click();}
  });
  input.addEventListener("change",async()=>{
    const f=input.files?.[0];const p=cur();if(!f||!p)return;
    if(!/^image\//.test(f.type)){toast("Escolha uma imagem PNG, JPG, WEBP ou GIF.");return;}
    p.shinyImageUrl=await shrink(f);
    p.shiny=true;
    try{renderAll();}catch(_){}
    save();render();sparkle();toast(`Arte shiny de ${p.name} salva.`);
  });
  ["hh:render","hh:pokemonchange"].forEach(ev=>document.addEventListener(ev,render));
  if(document.readyState!=="loading")setTimeout(render,0);
})();
