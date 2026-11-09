/* ============================================================
   V6 — Trainer Card (página do Treinador)
   Cartão de treinador como nos jogos: frente com foto, nome,
   ID, dinheiro, equipe e estojo de insígnias; verso com
   atributos, perícias e habilidades. Clique para virar.
   "Editar cartão" mostra o formulário completo que já existia.
   ============================================================ */
(function(){
  "use strict";
  const page=document.getElementById("pageTrainer");
  if(!page||typeof state==="undefined"||page.querySelector(".tc-wrap"))return;

  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const sfx=n=>window.hhClassicSfx?.[n]?.();
  const reduceMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const ATTRS=typeof TRAINER_ATTRIBUTES!=="undefined"?TRAINER_ATTRIBUTES:[];
  const ATTR_COLOR={life:"#e85a5a",body:"#f09030",mind:"#4aa0e0",presence:"#e8c030",spirit:"#a070e0"};
  const BADGE_TINT={
    Normal:"#a8a77a",Fire:"#ee8130",Water:"#6390f0",Electric:"#f7d02c",Grass:"#7ac74c",Ice:"#96d9d6",
    Fighting:"#c22e28",Poison:"#a33ea1",Ground:"#e2bf65",Flying:"#a98ff3",Psychic:"#f95587",Bug:"#a6b91a",
    Rock:"#b6a136",Ghost:"#735797",Dragon:"#6f35fc",Dark:"#705746",Steel:"#b7b7ce",Fairy:"#d685ad"
  };

  function trainerId(t){
    // ID estável de 5 dígitos a partir do nome, como o "IDNo." dos jogos.
    const src=String(t.name||"")+String(t.player||"");
    let h=7;for(const c of src)h=(h*31+c.charCodeAt(0))%100000;
    return String(h).padStart(5,"0");
  }
  function stars(t){
    const earned=(t.badges||[]).filter(b=>b.earned).length;
    return Math.min(5,Math.floor(earned/2)+(team().length>=6?1:0));
  }
  const team=()=>state.pokemon.filter(p=>(p.storageGroup||"team")==="team").slice(0,6);
  const img=p=>typeof displayPokemonImage==="function"?displayPokemonImage(p):(p.imageUrl||"");

  const CARD_COLORS={front:"#4aa078",back:"#4a70b8",border:"#181a24"};
  const CARD_PATTERNS=["listras","quadriculado","liso"];

  const wrap=document.createElement("section");
  wrap.className="tc-wrap";
  wrap.innerHTML=`
    <div class="tc-toolbar">
      <button type="button" data-tc="flip">⟲ VIRAR CARTÃO</button>
      <button type="button" data-tc="edit" aria-pressed="false">✎ EDITAR CARTÃO</button>
    </div>
    <details class="tc-custom">
      <summary>⚙ PERSONALIZAR VISUAL</summary>
      <div class="tc-custom-fields">
        <label>Frente <input type="color" name="front"></label>
        <label>Verso <input type="color" name="back"></label>
        <label>Moldura <input type="color" name="border"></label>
        <label>Textura <select name="pattern">
          <option value="listras">Listras clássicas</option>
          <option value="quadriculado">Quadriculado</option>
          <option value="liso">Liso</option>
        </select></label>
        <button type="button" data-tc-reset>Restaurar padrão</button>
      </div>
    </details>
    <div class="tc-scene">
      <div class="tc-card" id="tcCard" tabindex="0" role="button" aria-label="Trainer Card — clique para virar">
        <div class="tc-face tc-front"></div>
        <div class="tc-face tc-back"></div>
      </div>
    </div>`;
  page.prepend(wrap);
  page.classList.add("tc-active");

  function front(t){
    const photo=t.photo
      ?`<img src="${esc(t.photo)}" alt="" draggable="false">`
      :`<span class="tc-photo-empty">${esc(String(t.name||"TR").slice(0,2).toUpperCase())}</span>`;
    const party=team();
    const n=stars(t);
    const badges=(t.badges||[]).slice(0,8);
    return `
      <header class="tc-head">
        <b>TRAINER CARD</b>
        <span class="tc-stars" aria-label="${n} estrelas">${"★".repeat(n)}<i>${"★".repeat(5-n)}</i></span>
        <span class="tc-idno">IDNo. ${trainerId(t)}</span>
      </header>
      <div class="tc-body">
        <dl class="tc-lines">
          <dt>NOME</dt><dd>${esc(t.name||"—")}</dd>
          <dt>JOGADOR</dt><dd>${esc(t.player||"—")}</dd>
          <dt>ORIGEM</dt><dd>${esc(t.region||"—")}</dd>
          <dt>IDADE</dt><dd>${esc(t.age||"—")}</dd>
          <dt>DINHEIRO</dt><dd class="tc-money">₽ ${Number(t.money||0).toLocaleString("pt-BR")}</dd>
          <dt>POKÉMON</dt><dd>${state.pokemon.length}</dd>
        </dl>
        <div class="tc-photo">${photo}</div>
      </div>
      <div class="tc-party">${Array.from({length:6},(_,i)=>{
        const p=party[i];
        if(!p)return `<span class="tc-ball" aria-hidden="true"></span>`;
        const src=img(p);
        return `<span class="tc-mon" title="${esc(p.name)} • Lv. ${Number(p.level||1)}">${src?`<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy" draggable="false">`:"◓"}</span>`;
      }).join("")}</div>
      <div class="tc-badgecase">
        <small>ESTOJO DE INSÍGNIAS</small>
        <div>${badges.map(b=>{
          const tint=BADGE_TINT[b.type]||"#c0c4d0";
          return `<span class="tc-badge${b.earned?" earned":""}" style="--b:${tint}" title="${esc(b.name)}${b.type?` • ${esc(b.type)}`:""}${b.earned?" • conquistada":" • não conquistada"}"></span>`;
        }).join("")}</div>
      </div>
      <footer class="tc-hint">Clique no cartão para ver o verso ▶</footer>`;
  }

  function back(t){
    const attrs=ATTRS.map(a=>{
      const v=Number(t.attributes?.[a.key]||0);
      const pct=Math.min(100,v/60*100);
      return `<div class="tc-attr" style="--c:${ATTR_COLOR[a.key]||"#888"};--p:${pct}%">
        <span>${esc(a.icon||"")} ${esc(a.label)}</span><span class="tc-bar"><i></i></span><b>${v}</b>
      </div>`;
    }).join("");
    const label=k=>ATTRS.find(a=>a.key===k)?.label||k;
    const skills=(t.skills||[]).map(s=>`<li><span class="tc-grade g-${esc(s.grade)}">${esc(s.grade)}</span><b>${esc(s.name)}</b><small>${esc(label(s.attribute))}</small></li>`).join("");
    const abilities=(t.exclusiveAbilities||[]).map(a=>`<li><b>${esc(a.name)}</b><small>${esc(label(a.attribute))}</small></li>`).join("");
    const total=ATTRS.reduce((s,a)=>s+Number(t.attributes?.[a.key]||0),0);
    const bag=Object.entries(state.combatBag||{}).filter(([,q])=>Number(q)>0).slice(0,12);
    const itemName=slug=>(typeof BAG_CONSUMABLE_BY_SLUG!=="undefined"&&BAG_CONSUMABLE_BY_SLUG.get(slug)?.name)||slug.replace(/-/g," ");
    const bagHtml=bag.length?`<div class="tc-bag">${bag.map(([slug,q])=>`<span title="${esc(itemName(slug))}"><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${encodeURIComponent(slug)}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><b>×${Number(q)}</b></span>`).join("")}</div>`:'<p class="tc-none">Mochila vazia.</p>';
    const notes=String(t.notes||"").trim();
    return `
      <header class="tc-head back"><b>FICHA DO TREINADOR</b><span class="tc-idno">TOTAL ${total}</span></header>
      <div class="tc-back-body">
        <section><h4>ATRIBUTOS</h4>${attrs}</section>
        <section><h4>PERÍCIAS</h4>${skills?`<ul class="tc-list">${skills}</ul>`:'<p class="tc-none">Nenhuma perícia.</p>'}</section>
        <section><h4>HABILIDADES</h4>${abilities?`<ul class="tc-list">${abilities}</ul>`:'<p class="tc-none">Nenhuma habilidade exclusiva.</p>'}</section>
        <section class="wide"><h4>MOCHILA</h4>${bagHtml}</section>
        <section class="wide"><h4>ANOTAÇÕES</h4>${notes?`<p class="tc-notes">${esc(notes)}</p>`:'<p class="tc-none">Sem anotações.</p>'}</section>
      </div>
      <footer class="tc-hint">◀ Clique para voltar à frente</footer>`;
  }

  function renderAppearance(appearance){
    Object.entries(CARD_COLORS).forEach(([key,fallback])=>{
      const saved=appearance?.[key];
      const color=typeof saved==="string"&&/^#[0-9a-f]{6}$/i.test(saved)?saved:null;
      if(color)card.style.setProperty(`--tc-${key}`,color);
      else card.style.removeProperty(`--tc-${key}`);
      custom.querySelector(`[name="${key}"]`).value=color||fallback;
    });
    const pattern=CARD_PATTERNS.includes(appearance?.pattern)?appearance.pattern:"listras";
    card.dataset.pattern=pattern;
    custom.querySelector('select[name="pattern"]').value=pattern;
  }

  function render(){
    const t=typeof ensureTrainerData==="function"?ensureTrainerData():state.trainer||{};
    renderAppearance(t.cardAppearance);
    wrap.querySelector(".tc-front").innerHTML=front(t);
    wrap.querySelector(".tc-back").innerHTML=back(t);
  }

  const card=wrap.querySelector("#tcCard");
  const custom=wrap.querySelector(".tc-custom");
  custom.addEventListener("input",event=>{
    const control=event.target;
    const key=control.name;
    if(!Object.hasOwn(CARD_COLORS,key)&&key!=="pattern")return;
    const t=ensureTrainerData();
    t.cardAppearance={...t.cardAppearance,[key]:control.value};
    renderAppearance(t.cardAppearance);
    debouncedSave();
  });
  custom.querySelector("[data-tc-reset]").addEventListener("click",()=>{
    delete ensureTrainerData().cardAppearance;
    renderAppearance();
    debouncedSave();
  });

  function flip(){
    card.classList.toggle("flipped");
    sfx("page");
  }
  card.addEventListener("click",flip);
  card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();flip();}});
  card.addEventListener("pointermove",e=>{
    if(reduceMotion()||e.pointerType!=="mouse")return;
    const r=card.getBoundingClientRect();
    card.style.setProperty("--rx",`${((e.clientY-r.top)/r.height-.5)*-6}deg`);
    card.style.setProperty("--ry",`${((e.clientX-r.left)/r.width-.5)*8}deg`);
    card.style.setProperty("--shine",`${(e.clientX-r.left)/r.width*100}%`);
  });
  card.addEventListener("pointerleave",()=>{card.style.setProperty("--rx","0deg");card.style.setProperty("--ry","0deg");});

  wrap.querySelector(".tc-toolbar").addEventListener("click",e=>{
    const b=e.target.closest("[data-tc]");
    if(!b)return;
    if(b.dataset.tc==="flip")flip();
    if(b.dataset.tc==="edit"){
      const on=!page.classList.contains("tc-editing");
      page.classList.toggle("tc-editing",on);
      b.setAttribute("aria-pressed",String(on));
      b.textContent=on?"✓ FECHAR EDIÇÃO":"✎ EDITAR CARTÃO";
      if(on)page.querySelector(".trainer-license-card")?.scrollIntoView({behavior:reduceMotion()?"auto":"smooth",block:"start"});
      else render();
    }
  });

  if(typeof window.renderTrainerPage==="function"){
    const original=window.renderTrainerPage;
    window.renderTrainerPage=function(){const r=original.apply(this,arguments);render();return r;};
  }
  let timer=0;
  page.addEventListener("input",event=>{
    if(custom.contains(event.target))return;
    clearTimeout(timer);timer=setTimeout(render,200);
  });
  page.addEventListener("change",event=>{
    if(custom.contains(event.target))return;
    clearTimeout(timer);timer=setTimeout(render,50);
  });
  document.addEventListener("hh:render",render);
  document.addEventListener("hh:pokemonchange",render);
  render();
})();
