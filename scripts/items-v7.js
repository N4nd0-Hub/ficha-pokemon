/* ============================================================
   V7 — 🎒 Mochila (área de itens)
   Uma tela só para os itens, aberta pela página 01 (botão 🎒 MOCHILA e
   pelo item segurado da aba INFO). Junta tudo o que estava espalhado:
   • Bolsa: o que você tem (Bolsa de combate + inventário do treinador),
     por categoria, com busca e o efeito "lido" de cada item;
   • Equipe: o item segurado de cada Pokémon, para trocar ou tirar;
   • Loja: PokéMart com os itens oficiais já no sistema de QD;
   • Itemdex: o catálogo inteiro para consultar.
   O efeito de cada item é interpretado por item-rules-v7.js (o mesmo
   leitor que faz o item funcionar nas batalhas da Arena).
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined"||!window.hhItemRules)return;
  const R=window.hhItemRules;
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const toast=t=>{try{showToast(t);}catch(e){}};
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const save=()=>{try{debouncedSave();}catch(e){try{saveState();}catch(_){}}};
  const cur=()=>{try{return current;}catch(e){return null;}};
  const CAT=()=>typeof POKEAPI_ITEM_BY_SLUG!=="undefined"?POKEAPI_ITEM_BY_SLUG:new Map();
  const sprite=slug=>{try{return slug?pokeApiItemSpriteUrl(slug):"";}catch(e){return "";}};
  const money=()=>{try{return Math.max(0,Number(ensureTrainerData().money||0));}catch(e){return 0;}};
  const fmtMoney=n=>`${Number(n||0).toLocaleString("pt-BR")}₽`;
  const officialOf=name=>{try{const o=officialItemByQuery(name);return o?.apiName?CAT().get(o.apiName)||o:null;}catch(e){return null;}};
  const inv=()=>{try{const t=ensureTrainerData();t.inventory=t.inventory||{};t.inventory.items=Array.isArray(t.inventory.items)?t.inventory.items:[];return t.inventory;}catch(e){return {items:[]};}};

  /* ---------- Categorias ---------- */
  const GROUPS=[["all","Tudo","🎒"],["heal","Cura","🧪"],["status","Status","✨"],["battle","Batalha","⚔"],["held","Segurados","💎"],["berry","Bagas","🍒"],["ball","Poké Balls","◓"],["evo","Evolução e TMs","🧬"],["other","Outros","📦"]];
  function groupOf(it){
    const c=String(it.category||""),slug=String(it.apiName||""),d=String(it.description||it.desc||"");
    if(/balls$/.test(c)||/-ball$/.test(slug)||it.invCat==="balls")return "ball";
    if(/-berry$/.test(slug)||/berr(y|ies)/i.test(it.name||""))return "berry";
    if(/^(healing|revival|pp-recovery)$/.test(c)||/(Cura|Restaura|Recupera)\s+\d+\s*HP|Reviv|Cura totalmente/i.test(d)&&!/^Segurad/.test(d))return "heal";
    if(c==="status-cures"||/^Cura (?:Poison|Burn|Sleep|Freeze|Paralysis|todos)/i.test(d))return "status";
    if(/^(stat-boosts|miracle-shooter|flutes)$/.test(c)||/^Na batalha/i.test(d))return "battle";
    if(/^Segurad/.test(d)||/^(held-items|choice|type-enhancement|plates|jewels|type-protection|bad-held-items|species-specific|scarves|memories|in-a-pinch)$/.test(c)||it.invCat==="held")return "held";
    if(/^(evolution|all-machines|mega-stones|z-crystals|tera-shard)$/.test(c)||/^(Ensina|Evolução)/.test(d))return "evo";
    return "other";
  }
  const read=it=>R.interpret({name:it.name,description:it.description||it.desc||"",automation:it.automation||null,category:it.category,apiName:it.apiName});
  const canHold=it=>{const g=groupOf(it);return g==="held"||g==="berry"||read(it).held;};

  /* ---------- O que o treinador tem ---------- */
  function owned(){
    const out=[];
    try{initializeUnifiedBagInventory();}catch(e){}
    for(const [slug,q] of Object.entries(state.combatBag||{})){
      const n=Math.floor(Number(q||0));if(n<=0)continue;
      const it=CAT().get(slug);if(!it)continue;
      out.push({id:"bag:"+slug,src:"bag",slug,qty:n,name:it.name,description:it.description,automation:it.automation,category:it.category,apiName:slug,img:sprite(slug)});
    }
    for(const i of inv().items){
      if(!(Number(i.qty)>0))continue;
      const off=officialOf(i.name);
      out.push({id:"inv:"+i.id,src:"inv",invId:i.id,qty:Number(i.qty),name:i.name,
        description:off?.description&&/^(held|consumables|balls)$/.test(i.category)?off.description:(i.desc||""),
        automation:off?.automation||null,category:off?.category||"",apiName:off?.apiName||"",invCat:i.category,icon:i.icon,img:off?.apiName?sprite(off.apiName):""});
    }
    return out.sort((a,b)=>a.name.localeCompare(b.name));
  }

  /* ---------- Ações ---------- */
  function addHeldBack(name){
    if(!name)return;
    const off=officialOf(name);
    if(off?.apiName&&typeof BAG_CONSUMABLE_BY_SLUG!=="undefined"&&BAG_CONSUMABLE_BY_SLUG.has(off.apiName)){setBagQuantity(off.apiName,bagQuantity(off.apiName)+1,{render:false,save:false});return;}
    const I=inv();const ex=I.items.find(i=>String(i.name).toLowerCase()===String(name).toLowerCase());
    if(ex)ex.qty=Number(ex.qty||0)+1;
    else I.items.push({id:"it"+Math.random().toString(36).slice(2,9),name,icon:"💎",category:"held",qty:1,price:Number(off?.cost||0),desc:off?.description||""});
  }
  function spend(entry){
    if(entry.src==="bag"){const q=bagQuantity(entry.slug);if(q<=0)return false;setBagQuantity(entry.slug,q-1,{render:false,save:false});return true;}
    const it=inv().items.find(i=>i.id===entry.invId);if(!it||!(it.qty>0))return false;it.qty-=1;return true;
  }
  function giveTo(p,entry){
    if(!p||!entry)return;
    if(!spend(entry)){toast("Você não tem mais esse item.");return;}
    const prev=String(p.heldItem||"").trim();
    if(prev)addHeldBack(prev);
    p.heldItem=entry.name;
    try{if(entry.apiName&&p===cur())registerOfficialItem(entry.apiName,{equip:true});}catch(e){}
    p.heldItem=entry.name;
    try{renderAll();}catch(e){}
    save();sfx("select");
    toast(`💎 ${p.name} agora segura ${entry.name}${prev?` · ${prev} voltou para a Mochila`:""}.`);
  }
  function takeFrom(p){
    const prev=String(p?.heldItem||"").trim();if(!prev)return;
    addHeldBack(prev);p.heldItem="";
    try{renderAll();}catch(e){}
    save();sfx("select");toast(`${prev} voltou para a Mochila.`);
  }
  function useOn(entry){
    const p=cur();if(!p||!entry)return;
    let slug=entry.src==="bag"?entry.slug:entry.apiName;
    if(!slug||typeof BAG_CONSUMABLE_BY_SLUG==="undefined"||!BAG_CONSUMABLE_BY_SLUG.has(slug)){toast("Esse item não tem uso automático: aplique o efeito com o Mestre.");return;}
    // item do inventário do treinador: passa 1 unidade para a Bolsa e usa por lá
    let moved=false;
    if(entry.src==="inv"){if(!spend(entry))return;setBagQuantity(slug,bagQuantity(slug)+1,{render:false,save:false});moved=true;}
    const before=bagQuantity(slug);
    try{useBagItem(slug);}catch(e){console.error(e);}
    if(moved&&bagQuantity(slug)>=before){setBagQuantity(slug,bagQuantity(slug)-1,{render:false,save:false});const it=inv().items.find(i=>i.id===entry.invId);if(it)it.qty+=1;}
    try{renderAll();}catch(e){}
    save();render();
  }
  function buy(item,n=1){
    const price=Number(item.cost||0)*n;
    const t=ensureTrainerData();
    if(money()<price){toast("Dinheiro insuficiente.");return;}
    t.money=money()-price;
    if(typeof BAG_CONSUMABLE_BY_SLUG!=="undefined"&&BAG_CONSUMABLE_BY_SLUG.has(item.apiName))setBagQuantity(item.apiName,bagQuantity(item.apiName)+n,{render:false,save:false});
    else{
      const I=inv();const ex=I.items.find(i=>String(i.name).toLowerCase()===String(item.name).toLowerCase());
      if(ex)ex.qty=Number(ex.qty||0)+n;
      else I.items.push({id:"it"+Math.random().toString(36).slice(2,9),name:item.name,icon:groupOf(item)==="held"?"💎":"📦",category:groupOf(item)==="held"?"held":"other",qty:n,price:Number(item.cost||0),desc:item.description||""});
    }
    try{renderAll();}catch(e){}
    save();sfx("page");toast(`🛒 ${item.name} ×${n} por ${fmtMoney(price)}.`);
  }

  /* ---------- Loja (PokéMart oficial) ---------- */
  const SHOP_GROUPS=new Set(["heal","status","battle","ball","berry","held"]);
  let shopCache=null;
  function shopItems(){
    if(shopCache)return shopCache;
    shopCache=[...CAT().values()].filter(it=>Number(it.cost)>0&&SHOP_GROUPS.has(groupOf(it))&&!/Sem efeito/.test(it.description||"")&&!/^(dynamax|tm-materials|picnic|sandwich|curry|all-mail|data-cards|loot)/.test(it.category||""))
      .sort((a,b)=>GROUPS.findIndex(g=>g[0]===groupOf(a))-GROUPS.findIndex(g=>g[0]===groupOf(b))||a.cost-b.cost);
    return shopCache;
  }

  /* ---------- Tela ---------- */
  let ui={open:false,tab:"bag",group:"all",q:"",sel:null,page:1};
  let box=null;
  function ensure(){
    if(box)return box;
    box=document.createElement("div");box.className="it7";box.hidden=true;box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-label","Mochila");
    document.body.appendChild(box);
    box.addEventListener("click",onClick);
    box.addEventListener("input",e=>{if(e.target.matches("[data-it=q]")){ui.q=e.target.value;ui.page=1;renderList();}});
    return box;
  }
  function open(tab){ensure();ui.open=true;if(tab)ui.tab=tab;box.hidden=false;document.body.classList.add("it7-open");sfx("page");render();setTimeout(()=>box.querySelector("[data-it=q]")?.focus({preventScroll:true}),60);}
  function close(){if(!box)return;ui.open=false;box.hidden=true;document.body.classList.remove("it7-open");}
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&ui.open)close();});

  function tagChips(r,max=6){return r.tags.slice(0,max).map(t=>`<span class="it7-tag ${esc(t.kind)}">${esc(t.icon)} ${esc(t.label)}</span>`).join("");}
  function face(e,size=40){return e.img?`<img src="${esc(e.img)}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('i'),{textContent:'📦'}))">`:`<i>${esc(/^px:|^ball:/.test(e.icon||"")?"📦":(e.icon||"📦"))}</i>`;}

  function listData(){
    if(ui.tab==="bag")return owned();
    if(ui.tab==="shop")return shopItems().map(it=>({id:"shop:"+it.apiName,src:"shop",name:it.name,description:it.description,automation:it.automation,category:it.category,apiName:it.apiName,cost:it.cost,img:sprite(it.apiName),item:it}));
    if(ui.tab==="dex")return [...CAT().values()].map(it=>({id:"dex:"+it.apiName,src:"dex",name:it.name,description:it.description,automation:it.automation,category:it.category,apiName:it.apiName,cost:it.cost,img:sprite(it.apiName),item:it}));
    return [];
  }
  function filtered(){
    const q=ui.q.trim().toLowerCase();
    return listData().filter(e=>(ui.group==="all"||groupOf(e)===ui.group)&&(!q||`${e.name} ${e.description||""}`.toLowerCase().includes(q)));
  }
  function render(){
    ensure();
    const p=cur();
    const tabs=[["bag","🎒","Bolsa","O que você tem"],["team","💎","Equipe","Itens segurados"],["shop","🛒","Loja","PokéMart"],["dex","📖","Itemdex","Todos os itens"]];
    box.innerHTML=`<div class="it7-win">
      <header class="it7-head">
        <div class="it7-title"><b>🎒 Mochila</b><small>${p?`Usar em <b>${esc(p.name)}</b> · `:""}Carteira: <b>${fmtMoney(money())}</b></small></div>
        <button type="button" class="it7-x" data-it="close" aria-label="Fechar">✕</button>
      </header>
      <nav class="it7-tabs" role="tablist">${tabs.map(([k,i,l,s])=>`<button type="button" role="tab" aria-selected="${ui.tab===k}" class="${ui.tab===k?"on":""}" data-it="tab" data-v="${k}"><i>${i}</i><b>${l}</b><small>${s}</small></button>`).join("")}</nav>
      <div class="it7-body" data-tab="${ui.tab}">${ui.tab==="team"?teamView():`
        <div class="it7-listcol">
          <div class="it7-tools"><input class="it7-q" data-it="q" type="search" placeholder="Buscar item ou efeito (ex.: Fire, cura, crítico)…" value="${esc(ui.q)}" aria-label="Buscar item">
            <div class="it7-groups">${GROUPS.map(([k,l,i])=>`<button type="button" class="${ui.group===k?"on":""}" data-it="group" data-v="${k}">${i} ${l}</button>`).join("")}</div></div>
          <div class="it7-list" role="list"></div>
        </div>
        <aside class="it7-detail" aria-live="polite"></aside>`}</div>
    </div>`;
    if(ui.tab!=="team"){renderList();renderDetail();}
  }
  function renderList(){
    const el=box?.querySelector(".it7-list");if(!el)return;
    const all=filtered();
    const shown=all.slice(0,ui.page*60);
    el.innerHTML=shown.length?shown.map(e=>{const r=read(e);return `<button type="button" role="listitem" class="it7-card${ui.sel===e.id?" on":""}" data-it="sel" data-id="${esc(e.id)}">
      <span class="it7-face">${face(e)}</span>
      <span class="it7-info"><b>${esc(e.name)}</b><small>${r.tags[0]?`${esc(r.tags[0].icon)} ${esc(r.tags[0].label)}`:esc(String(e.description||"").slice(0,60))}</small></span>
      <span class="it7-qty">${e.src==="shop"?fmtMoney(e.cost):e.qty?`×${e.qty}`:""}</span></button>`;}).join("")+(all.length>shown.length?`<button type="button" class="it7-more" data-it="more">Mostrar mais (${all.length-shown.length})</button>`:"")
      :`<p class="it7-empty">${ui.tab==="bag"?"Nada aqui ainda. Compre na aba 🛒 Loja.":"Nenhum item encontrado."}</p>`;
  }
  function findEntry(id){return listData().find(e=>e.id===id)||null;}
  function renderDetail(){
    const el=box?.querySelector(".it7-detail");if(!el)return;
    const e=ui.sel&&findEntry(ui.sel);
    if(!e){el.innerHTML=`<div class="it7-hint"><span>🎒</span><p>Escolha um item para ver o que ele faz${ui.tab==="bag"?", usar ou dar para um Pokémon segurar":ui.tab==="shop"?" e comprar":""}.</p></div>`;return;}
    const r=read(e),p=cur(),g=groupOf(e);
    const usable=(e.src==="bag"||e.src==="inv")&&e.apiName&&typeof BAG_CONSUMABLE_BY_SLUG!=="undefined"&&BAG_CONSUMABLE_BY_SLUG.has(e.apiName)&&g!=="ball";
    const holdable=(e.src==="bag"||e.src==="inv")&&canHold(e);
    const have=e.src==="shop"||e.src==="dex"?owned().filter(o=>o.apiName===e.apiName||o.name===e.name).reduce((a,o)=>a+o.qty,0):e.qty;
    const team=(state.pokemon||[]).filter(x=>(x.storageGroup||"team")==="team").slice(0,6);
    el.innerHTML=`<div class="it7-big">${face(e,72)}<div><b>${esc(e.name)}</b><small>${esc(GROUPS.find(x=>x[0]===g)?.[1]||"Item")}${e.src==="inv"?" · Inventário do Treinador":e.src==="bag"?" · Bolsa":""}${have?` · você tem ${have}`:""}</small></div></div>
      ${r.tags.length?`<div class="it7-tags">${tagChips(r,10)}</div>`:""}
      <p class="it7-desc">${esc(e.description||"Sem descrição.")}</p>
      ${r.usableInBattle&&r.held?`<p class="it7-note">⚔ Funciona sozinho nas batalhas da Arena quando o Pokémon segura o item.</p>`:""}
      <div class="it7-acts">
        ${usable&&p?`<button type="button" class="it7-btn go" data-it="use">Usar em ${esc(p.name)}</button>`:""}
        ${holdable?`<div class="it7-give"><small>Dar para segurar:</small><div>${team.map(x=>{let im="";try{im=displayPokemonImage(x)||"";}catch(err){}return `<button type="button" data-it="give" data-p="${esc(String(x.id))}" title="${esc(x.name)}${x.heldItem?` (segura ${esc(x.heldItem)})`:""}">${im?`<img src="${esc(im)}" alt="" width="34" height="34">`:"◓"}<span>${esc(x.name)}</span>${x.heldItem?`<em>${esc(x.heldItem)}</em>`:""}</button>`;}).join("")}</div></div>`:""}
        ${e.src==="shop"?`<div class="it7-buy"><button type="button" class="it7-btn go" data-it="buy" data-n="1" ${money()<e.cost?"disabled":""}>Comprar 1 · ${fmtMoney(e.cost)}</button><button type="button" class="it7-btn" data-it="buy" data-n="5" ${money()<e.cost*5?"disabled":""}>×5 · ${fmtMoney(e.cost*5)}</button></div>`:""}
        ${e.src==="dex"&&e.cost?`<button type="button" class="it7-btn" data-it="toShop" data-id="${esc(e.apiName)}">Ver na Loja · ${fmtMoney(e.cost)}</button>`:""}
      </div>`;
  }
  function teamView(){
    const team=(state.pokemon||[]).filter(x=>(x.storageGroup||"team")==="team").slice(0,6);
    if(!team.length)return `<p class="it7-empty">Nenhum Pokémon na Equipe.</p>`;
    return `<div class="it7-team">${team.map(x=>{
      let im="";try{im=displayPokemonImage(x)||"";}catch(e){}
      const it=x.heldItem?(officialOf(x.heldItem)||(x.itemMemory||[]).find(r=>String(r.name).toLowerCase()===String(x.heldItem).toLowerCase())||{name:x.heldItem,description:""}):null;
      const r=it?read({...it,name:x.heldItem}):null;
      return `<article class="it7-slot"><span class="it7-mon">${im?`<img src="${esc(im)}" alt="">`:"◓"}</span>
        <div class="it7-slot-txt"><b>${esc(x.name)}</b><small>Lv ${Number(x.level||1)}</small>
          ${it?`<p class="it7-held">${face({img:sprite(it.apiName),icon:"💎"},28)} <b>${esc(x.heldItem)}</b></p><div class="it7-tags">${tagChips(r,4)}</div>`:`<p class="it7-held none">Sem item segurado</p>`}</div>
        <div class="it7-slot-acts">${it?`<button type="button" class="it7-btn" data-it="take" data-p="${esc(String(x.id))}">Tirar</button>`:""}<button type="button" class="it7-btn" data-it="pickFor" data-p="${esc(String(x.id))}">${it?"Trocar":"Dar item"}</button></div></article>`;}).join("")}</div>`;
  }
  function onClick(e){
    const b=e.target.closest("[data-it]");
    if(!b){if(e.target===box)close();return;}
    const a=b.dataset.it;
    if(a==="close")close();
    else if(a==="tab"){ui.tab=b.dataset.v;ui.sel=null;ui.page=1;if(ui.tab!=="bag")ui.group=ui.group==="held"&&ui.tab==="shop"?"held":"all";sfx("select");render();}
    else if(a==="group"){ui.group=b.dataset.v;ui.page=1;box.querySelectorAll(".it7-groups button").forEach(x=>x.classList.toggle("on",x===b));renderList();}
    else if(a==="sel"){ui.sel=b.dataset.id;box.querySelectorAll(".it7-card").forEach(x=>x.classList.toggle("on",x===b));renderDetail();sfx("select");if(matchMedia("(max-width:760px)").matches)box.querySelector(".it7-detail")?.scrollIntoView({behavior:"smooth",block:"start"});}
    else if(a==="more"){ui.page++;renderList();}
    else if(a==="use"){useOn(findEntry(ui.sel));}
    else if(a==="give"){const p=(state.pokemon||[]).find(x=>String(x.id)===b.dataset.p);giveTo(p,findEntry(ui.sel));render();}
    else if(a==="take"){const p=(state.pokemon||[]).find(x=>String(x.id)===b.dataset.p);takeFrom(p);render();}
    else if(a==="pickFor"){ui.tab="bag";ui.group="held";ui.sel=null;render();toast("Escolha um item segurado e toque no Pokémon em “Dar para segurar”.");}
    else if(a==="buy"){const e2=findEntry(ui.sel);if(e2?.item)buy(e2.item,Number(b.dataset.n||1));render();}
    else if(a==="toShop"){ui.tab="shop";ui.sel="shop:"+b.dataset.id;ui.group="all";render();}
  }

  /* ---------- Entradas na página 01 ---------- */
  function mountEntry(){
    const actions=document.querySelector("#sumScreen .sum-left-actions");
    if(actions&&!actions.querySelector("[data-it-open]")){
      actions.insertAdjacentHTML("beforeend",`<button type="button" data-it-open="bag" class="it7-open">🎒 MOCHILA</button>`);
    }
    // aba INFO: o que o item segurado faz + atalho para a Mochila
    const strip=document.querySelector(".general-held-strip");
    if(strip){
      let box2=strip.parentElement.querySelector(".it7-heldfx");
      if(!box2){box2=document.createElement("div");box2.className="it7-heldfx";strip.insertAdjacentElement("afterend",box2);}
      const p=cur();const name=String(p?.heldItem||"").trim();
      const it=name?(officialOf(name)||(p.itemMemory||[]).find(r=>String(r.name).toLowerCase()===name.toLowerCase())||{name,description:""}):null;
      const r=it?read({...it,name}):null;
      box2.innerHTML=`${r&&r.tags.length?`<div class="it7-tags">${tagChips(r,5)}</div>`:""}<button type="button" class="it7-link" data-it-open="team">🎒 ${name?"Trocar item na Mochila":"Escolher item na Mochila"}</button>`;
    }
  }
  document.addEventListener("click",e=>{const b=e.target.closest("[data-it-open]");if(b){e.preventDefault();open(b.dataset.itOpen==="team"?"bag":b.dataset.itOpen);if(b.dataset.itOpen==="team"){ui.group="held";render();}}});
  ["hh:render","hh:pokemonchange"].forEach(ev=>document.addEventListener(ev,()=>{mountEntry();if(ui.open)render();}));
  if(document.readyState!=="loading")setTimeout(mountEntry,0);
  window.hhItemsUI={open,close,interpret:read,groupOf,owned};
})();
