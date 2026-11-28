/* ============================================================
   V7 — 🎒 Mochila (área de itens)
   Uma tela só para os itens, aberta pela página 01 (botão 🎒 MOCHILA e
   pelo item segurado da aba INFO). Junta tudo o que estava espalhado:
   • Bolsa: o que você tem (Bolsa de combate + inventário do treinador),
     por categoria, com busca e o efeito "lido" de cada item;
   • Equipe: o item segurado de cada Pokémon, para trocar ou tirar;
   • Loja de Altamuralha: a primeira cidade grande vende quase todos os
     itens oficiais (menos Master Ball, itens-chave e afins), 25% mais caro;
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

  /* ---------- Ícones em pixel art (16×16) ----------
     Os da Mochila são desenhados aqui; os outros vêm do inventário do
     treinador (window.hhInvPx: poção, gema, Poké Ball, carrinho…). */
  const PAL={o:"#1b1d2a",R:"#e0393e",r:"#a8222a",Y:"#ffd23f",y:"#d9961a",W:"#fff6dc",G:"#7a5a3a",B:"#3b6fd8",b:"#234a9e",P:"#f4efe0",p:"#cfc6a8",S:"#dfe5f0",s:"#8a93a8",H:"#a0703a",L:"#43c17a",l:"#2d8a4a"};
  const ICONS={
    disc:["................",".....oooooo.....","...ooBBBBBBoo...","..oBBBBBBBBBBo..","..oBWWBBBBBBBo..",".oBBWBBoooBBBBo.",".oBBBBoYYoBBBBo.",".oBBBBoYYoBBBBo.",".oBBBBBooBBBBBo.",".oBBBBBBBBBBBbo.","..oBBBBBBBBBbo..","..oBBBBBBBBbbo..","...oobbbbbboo...",".....oooooo.....","................","................"],
    gift:["................","....oo....oo....","...oRRo..oRRo...","....oRRooRRo....","..oooooooooooo..","..oRRRRYYRRRRo..","..oRRRRYYRRRRo..","..oooooooooooo..","...oRRRYYRRRo...","...oRRRYYRRRo...","...oRRRYYRRRo...","...oRRRYYRRRo...","...orrrYYrrro...","...oooooooooo...","................","................"],
    bag:["................",".....oooooo.....","....oGGGGGGo....","....oGo..oGo....","..oooooooooooo..",".oRWRRRRRRRRRro.",".oWRRRRRRRRRRro.",".oRRRRRRRRRRRro.",".oooooooooooooo.",".oRRoYYYYYYoRro.",".oRRoYWWyyYoRro.",".oRRoYyyyyYoRro.",".oRRooooooooRro.",".orRRRRRRRRRRro.","..orrrrrrrrrro..","...oooooooooo..."],
    book:["................","...ooooooooooo..","..oBBBBBBBBBBpo.","..oBWBBBBBBBBpo.","..oBBBYYYYBBBpo.","..oBBBYooYBBBpo.","..oBBBYYYYBBBpo.","..oBBBBBBBBBBpo.","..oBBBBBBBBBBpo.","..oBBBBBBBBBBpo.","..obbbbbbbbbbpo.","..oPPPPPPPPPPPo.","..opppppppppppo.","...ooooooooooo..","................","................"],
    sword:["................","............oo..","...........oSso.","..........oSso..",".........oSso...","........oSso....",".......oSso.....","......oSso......","..oo.oSso.......","..oYoSso........","...oYso.........","...oHYYo........","..oHo.oYo.......",".oHo...oo.......",".oo.............","................"],
    spark:["................",".......o........","......oYo.......","......oYo.......",".....oYWYo......","..oooYWWWYooo...",".oYYYWWWWWYYYo..","..oooYWWWYooo...",".....oYWYo......","......oYo.......","......oYo.......",".......o........","................","................","................","................"],
    berry:["................",".......oo.oo....","......oLLoLLo...",".......oLLlo....",".....oooooooo...","....oRRRRRRRRo..","...oRWWRRRRRRro.","...oRWRRRRRRRro.","...oRRRRRRRRRro.","...oRRRRRRRRRro.","...oRRRRRRRRrro.","....oRRRRRRrro..",".....orrrrrro...","......oooooo....","................","................"]
  };
  const icoCache=new Map();
  function ico(name,cls="it7-px"){
    const k=name+"|"+cls;if(icoCache.has(k))return icoCache.get(k);
    const rows=ICONS[name];let out="";
    if(rows){
      let rects="";rows.forEach((row,y)=>{let x=0;while(x<16){const ch=row[x];if(!PAL[ch]){x++;continue;}let w=1;while(x+w<16&&row[x+w]===ch)w++;rects+=`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${PAL[ch]}"/>`;x+=w;}});
      out=`<svg class="${cls}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
    }else if(typeof window.hhInvPx==="function")out=window.hhInvPx(name,cls)||"";
    if(out)icoCache.set(k,out);
    return out||`<i class="${cls}">📦</i>`;
  }
  const GROUP_ICO={all:"bag",heal:"potion",status:"spark",battle:"sword",held:"gem",berry:"berry",ball:"ball",evo:"shard",other:"box"};

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
  const INV_CAT={ball:"balls",heal:"consumables",status:"consumables",battle:"consumables",held:"held",berry:"held",evo:"other",other:"other"};
  function buy(item,n=1){
    const unit=altPrice(item);if(!unit){toast("Esse item não é vendido aqui.");return;}
    const price=unit*n;
    const t=ensureTrainerData();
    if(money()<price){toast("Dinheiro insuficiente.");return;}
    t.money=money()-price;
    if(typeof BAG_CONSUMABLE_BY_SLUG!=="undefined"&&BAG_CONSUMABLE_BY_SLUG.has(item.apiName))setBagQuantity(item.apiName,bagQuantity(item.apiName)+n,{render:false,save:false});
    else{
      const I=inv();const ex=I.items.find(i=>String(i.name).toLowerCase()===String(item.name).toLowerCase());
      if(ex)ex.qty=Number(ex.qty||0)+n;
      else{const g=groupOf(item),ic=item.category==="spelunking"?"exploration":(INV_CAT[g]||"other");
        I.items.push({id:"it"+Math.random().toString(36).slice(2,9),name:item.name,icon:ic==="held"?"💎":ic==="balls"?"ball:poke":"📦",category:ic==="consumables"&&!/^(heal|status|battle)$/.test(g)?"other":ic,qty:n,price:unit,desc:item.description||"",shopId:"altamuralha"});}
    }
    try{renderAll();}catch(e){}
    save();sfx("page");toast(`🛒 ${item.name} ×${n} por ${fmtMoney(price)}.`);
  }

  /* ---------- Loja de Altamuralha ----------
     Primeira cidade grande da região (loja de meio de jogo): vende boa parte do catálogo,
     25% mais caro que o preço base. Fora da loja: Master Ball e outras bolas
     de captura garantida, itens-chave/de história, itens de eventos,
     doces de nível/EXP, Ability Patch, Bottle Caps, itens de valor (que só
     servem para vender) e materiais de jogos que a ficha não usa. */
  const ALT={id:"altamuralha",name:"Loja de Altamuralha",mult:1.25};
  const ALT_BLOCK_CAT=/^(plot-advancement|unused|event-items|data-cards|dynamax-crystals|tm-materials|picnic|sandwich-ingredients|curry-ingredients|all-mail|miracle-shooter|gameplay|loot|species-candies)$/;
  const ALT_BLOCK=new Set(["master-ball","cherish-ball","laorigin-ball","lastrange-ball","rare-candy","ability-patch","dynamax-candy","gold-bottle-cap","bottle-cap","max-mushrooms","wishing-piece","armorite-ore","dynite-ore","galarica-twig","pass-orb","blank-plate","sacred-ash"]);
  const BALL_PRICE={"safari-ball":600,"park-ball":600,"lapoke-ball":200,"lagreat-ball":600,"laultra-ball":800,"laheavy-ball":400,"laleaden-ball":800,"lagigaton-ball":1200,"lafeather-ball":300,"lawing-ball":600,"lajet-ball":1000,"dream-ball":1500,"beast-ball":3000,"premier-ball":200};
  function basePrice(it){
    const slug=String(it.apiName||""),c=String(it.category||""),cost=Number(it.cost||0),d=String(it.description||"");
    if(BALL_PRICE[slug])return BALL_PRICE[slug];
    if(c==="apricorn-balls")return 1000;
    if(/-berry$/.test(slug)&&c!=="catching-bonus"){
      const b=read(it).battle;
      if(b.pinch?.healFrac||b.seHeal||b.hitRecoil)return 2000;
      if(b.pinch?.stage||b.pinch?.nextAcc||b.pinch?.nextFirst)return 2500;
      if(b.cure==="any")return 2000;
      if(b.resist)return 1500;
      if(b.cure||b.pinch?.healFlat||b.hitStage)return 600;
      return c==="effort-drop"?1000:300;
    }
    if(c==="mega-stones")return 30000;
    if(c==="z-crystals")return /^Segurado por/.test(d)?24000:16000;
    if(/-mask$/.test(slug))return 25000;
    if(slug==="legend-plate")return 20000;
    if(c==="species-specific"&&!cost)return 15000;
    if(c==="nature-mints")return 8000;
    if(c==="vitamins")return Math.max(cost,1000);
    if(c==="choice")return Math.max(cost,5000);
    if(/^(held-items|bad-held-items)$/.test(c))return Math.max(cost,4000);
    if(/^(type-enhancement|plates|memories)$/.test(c))return Math.max(cost,2000);
    if(c==="jewels")return Math.max(cost,1500);
    if(c==="all-machines")return Math.min(cost||3000,10000);
    if(c==="evolution")return cost||3000;
    if(c==="flutes"||c==="collectibles"||c==="spelunking")return Math.max(cost,500);
    if(c==="training")return cost||3000;
    return Math.max(cost,100);
  }
  function altSells(it){
    if(!it?.apiName||ALT_BLOCK.has(it.apiName)||ALT_BLOCK_CAT.test(String(it.category||"")))return false;
    if(/-candy(-l|-xl)?$/.test(it.apiName))return false;
    // loja de meio de jogo: nada exclusivo de um Pokémon (Plates, Memories, Drives, Orbs, Mega Stones, Cristais Z exclusivos…)
    if(/^(plates|memories|species-specific|mega-stones)$/.test(String(it.category||"")))return false;
    if(/^Segurado por /.test(String(it.description||""))||read(it).battle.species?.length)return false;
    if(/^Item registrado no PokéAPI/.test(String(it.description||""))&&!/held|mega|z-crystal/.test(String(it.category||"")))return false;
    return true;
  }
  const priceCache=new Map();
  function altPrice(it){
    if(!it?.apiName)return Number(it?.cost||0);
    if(!priceCache.has(it.apiName))priceCache.set(it.apiName,altSells(it)?Math.max(1000,Math.round(basePrice(it)*ALT.mult/50)*50):0);
    return priceCache.get(it.apiName);
  }
  let shopCache=null;
  function shopItems(){
    if(shopCache)return shopCache;
    shopCache=[...CAT().values()].filter(altSells)
      .sort((a,b)=>GROUPS.findIndex(g=>g[0]===groupOf(a))-GROUPS.findIndex(g=>g[0]===groupOf(b))||altPrice(a)-altPrice(b)||a.name.localeCompare(b.name));
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
    box.addEventListener("submit",e=>{const ext=(window.hhItemsTabs||[]).find(t=>t.key===ui.tab);if(ext?.onSubmit){e.preventDefault();ext.onSubmit(e);}});
    box.addEventListener("input",e=>{const ext=(window.hhItemsTabs||[]).find(t=>t.key===ui.tab);if(ext?.onInput&&!e.target.matches("[data-it=q]")){ext.onInput(e);return;}if(e.target.matches("[data-it=q]")){ui.q=e.target.value;ui.page=1;renderList();}});
    return box;
  }
  function open(tab){ensure();ui.open=true;if(tab)ui.tab=tab;box.hidden=false;box.classList.remove("settled");clearTimeout(box._st);box._st=setTimeout(()=>box.classList.add("settled"),400);document.body.classList.add("it7-open");sfx("page");render();setTimeout(()=>box.querySelector("[data-it=q]")?.focus({preventScroll:true}),60);}
  function close(){if(!box)return;ui.open=false;box.hidden=true;document.body.classList.remove("it7-open");}
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&ui.open)close();});

  function tagChips(r,max=6){return r.tags.slice(0,max).map(t=>`<span class="it7-tag ${esc(t.kind)}">${esc(t.icon)} ${esc(t.label)}</span>`).join("");}
  function fallbackIco(e){const m=/^px:(\w+)/.exec(e.icon||"");if(m&&typeof window.hhInvPx==="function"&&window.hhInvPx(m[1]))return ico(m[1]);if(/^ball:/.test(e.icon||""))return ico("ball");return ico(GROUP_ICO[e.src?groupOf(e):"held"]||"box");}
  function face(e,size=40){const fb=fallbackIco(e);return e.img?`<img src="${esc(e.img)}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="it7-fb" hidden>${fb}</span>`:`<span class="it7-fb">${fb}</span>`;}

  function listData(){
    if(ui.tab==="bag")return owned();
    if(ui.tab==="shop")return shopItems().map(it=>({id:"shop:"+it.apiName,src:"shop",name:it.name,description:it.description,automation:it.automation,category:it.category,apiName:it.apiName,cost:altPrice(it),img:sprite(it.apiName),item:it}));
    if(ui.tab==="dex")return [...CAT().values()].map(it=>({id:"dex:"+it.apiName,src:"dex",name:it.name,description:it.description,automation:it.automation,category:it.category,apiName:it.apiName,cost:altPrice(it),img:sprite(it.apiName),item:it}));
    return [];
  }
  function filtered(){
    const q=ui.q.trim().toLowerCase();
    return listData().filter(e=>(ui.group==="all"||groupOf(e)===ui.group)&&(!q||`${e.name} ${e.description||""}`.toLowerCase().includes(q)));
  }
  function render(){
    ensure();
    const p=cur();
    const extra=(window.hhItemsTabs||[]);
    const tabs=[["bag","bag","Bolsa","O que você tem"],["team","gem","Equipe","Itens segurados"],["shop","cart","Loja","Altamuralha"],["dex","book","Itemdex","Todos os itens"],...extra.map(t=>[t.key,t.icon,t.label,t.sub])];
    const ext=extra.find(t=>t.key===ui.tab);
    const all=ui.tab==="team"||ext?[]:listData();
    const count=k=>k==="all"?all.length:all.filter(e=>groupOf(e)===k).length;
    box.innerHTML=`<div class="it7-win">
      <header class="it7-head">
        <span class="it7-logo">${ico("bag")}</span>
        <div class="it7-title"><b>Mochila</b><small>${p?`Usando em <b>${esc(p.name)}</b>`:"Itens do treinador"}</small></div>
        <span class="it7-wallet" title="Carteira">${ico("coin")}<b>${fmtMoney(money())}</b></span>
        <button type="button" class="it7-x" data-it="close" aria-label="Fechar">✕</button>
      </header>
      <nav class="it7-tabs" role="tablist">${tabs.map(([k,i,l,s])=>`<button type="button" role="tab" aria-selected="${ui.tab===k}" class="${ui.tab===k?"on":""}" data-it="tab" data-v="${k}">${ico(i)}<b>${l}</b><small>${s}</small></button>`).join("")}</nav>
      <div class="it7-body" data-tab="${ui.tab}">${ext?`<div class="it7-ext">${ext.view()}</div>`:ui.tab==="team"?teamView():`
        <nav class="it7-pockets" aria-label="Bolsos">${GROUPS.map(([k,l])=>{const n=count(k);return `<button type="button" class="${ui.group===k?"on":""}${n?"":" empty"}" data-it="group" data-v="${k}">${ico(GROUP_ICO[k])}<span>${l}</span><em>${n}</em></button>`;}).join("")}</nav>
        <div class="it7-listcol">
          <div class="it7-tools">${ui.tab==="shop"?`<div class="it7-city">${ico("mart")}<div><b>Loja de Altamuralha</b><small>A Grande Cidade na montanha, lar do Rochedo Eterno. · ${shopItems().length} itens à venda</small></div></div>`:""}
            <label class="it7-search"><span>⌕</span><input class="it7-q" data-it="q" type="search" placeholder="Buscar item ou efeito (Fire, cura, crítico…)" value="${esc(ui.q)}" aria-label="Buscar item"></label></div>
          <div class="it7-list" role="list"></div>
        </div>
        <aside class="it7-detail" aria-live="polite"></aside>`}</div>
    </div>`;
    if(ui.tab!=="team"&&!ext){renderList();renderDetail();}
    if(ext)ext.after?.(box);
  }
  function renderList(){
    const el=box?.querySelector(".it7-list");if(!el)return;
    const all=filtered();
    const shown=all.slice(0,ui.page*60);
    el.innerHTML=shown.length?shown.map(e=>{const r=read(e);return `<button type="button" role="listitem" class="it7-card${ui.sel===e.id?" on":""}" data-it="sel" data-id="${esc(e.id)}">
      <span class="it7-face">${face(e)}</span>
      <span class="it7-info"><b>${esc(e.name)}</b><small>${r.tags[0]?`${esc(r.tags[0].icon)} ${esc(r.tags[0].label)}`:esc(String(e.description||"").slice(0,60))}</small></span>
      <span class="it7-qty">${e.src==="shop"?fmtMoney(e.cost):e.qty?`×${e.qty}`:""}</span></button>`;}).join("")+(all.length>shown.length?`<button type="button" class="it7-more" data-it="more">Mostrar mais (${all.length-shown.length})</button>`:"")
      :`<p class="it7-empty">${ico(GROUP_ICO[ui.group]||"bag","it7-px big")}<span>${ui.tab==="bag"?"Nenhum item neste bolso. Compre na aba Loja.":"Nenhum item encontrado."}</span></p>`;
  }
  function findEntry(id){return listData().find(e=>e.id===id)||null;}
  function renderDetail(){
    const el=box?.querySelector(".it7-detail");if(!el)return;
    const e=ui.sel&&findEntry(ui.sel);
    if(!e){el.innerHTML=`<div class="it7-hint">${ico("bag","it7-px big")}<p>Escolha um item para ver o que ele faz${ui.tab==="bag"?", usar ou dar para um Pokémon segurar":ui.tab==="shop"?" e comprar":""}.</p></div>`;return;}
    const r=read(e),p=cur(),g=groupOf(e);
    const usable=(e.src==="bag"||e.src==="inv")&&e.apiName&&typeof BAG_CONSUMABLE_BY_SLUG!=="undefined"&&BAG_CONSUMABLE_BY_SLUG.has(e.apiName)&&g!=="ball";
    const holdable=(e.src==="bag"||e.src==="inv")&&canHold(e);
    const have=e.src==="shop"||e.src==="dex"?owned().filter(o=>o.apiName===e.apiName||o.name===e.name).reduce((a,o)=>a+o.qty,0):e.qty;
    const team=(state.pokemon||[]).filter(x=>(x.storageGroup||"team")==="team").slice(0,6);
    el.innerHTML=`<div class="it7-stage"><span class="it7-pedestal">${face(e,72)}</span>
        <b class="it7-name">${esc(e.name)}</b>
        <small class="it7-sub">${ico(GROUP_ICO[g]||"box","it7-px sm")}${esc(GROUPS.find(x=>x[0]===g)?.[1]||"Item")}${e.src==="inv"?" · Inventário":e.src==="bag"?" · Bolsa":""}${have?` · <b>você tem ${have}</b>`:""}</small></div>
      ${r.tags.length?`<div class="it7-tags">${tagChips(r,10)}</div>`:""}
      <p class="it7-desc">${esc(e.description||"Sem descrição.")}</p>
      ${r.usableInBattle&&r.held?`<p class="it7-note">⚔ Funciona sozinho nas batalhas da Arena quando o Pokémon segura o item.</p>`:""}
      <div class="it7-acts">
        ${usable&&p?`<button type="button" class="it7-btn go" data-it="use">Usar em ${esc(p.name)}</button>`:""}
        ${holdable?`<div class="it7-give"><small>Dar para segurar:</small><div>${team.map(x=>{let im="";try{im=displayPokemonImage(x)||"";}catch(err){}return `<button type="button" data-it="give" data-p="${esc(String(x.id))}" title="${esc(x.name)}${x.heldItem?` (segura ${esc(x.heldItem)})`:""}">${im?`<img src="${esc(im)}" alt="" width="34" height="34">`:"◓"}<span>${esc(x.name)}</span>${x.heldItem?`<em>${esc(x.heldItem)}</em>`:""}</button>`;}).join("")}</div></div>`:""}
        ${e.src==="shop"?`<div class="it7-buy"><button type="button" class="it7-btn go" data-it="buy" data-n="1" ${money()<e.cost?"disabled":""}>Comprar 1 · ${fmtMoney(e.cost)}</button><button type="button" class="it7-btn" data-it="buy" data-n="5" ${money()<e.cost*5?"disabled":""}>×5 · ${fmtMoney(e.cost*5)}</button></div>`:""}
        ${e.src==="dex"?(e.cost?`<button type="button" class="it7-btn" data-it="toShop" data-id="${esc(e.apiName)}">Ver na Loja de Altamuralha · ${fmtMoney(e.cost)}</button>`:`<p class="it7-note off">Não é vendido em Altamuralha.</p>`):""}
      </div>`;
  }
  function teamView(){
    const team=(state.pokemon||[]).filter(x=>(x.storageGroup||"team")==="team").slice(0,6);
    if(!team.length)return `<p class="it7-empty">${ico("ball","it7-px big")}<span>Nenhum Pokémon na Equipe.</span></p>`;
    const pal=t=>{try{return moveTypePalette(normalizeTypeName(t)).main;}catch(e){return "#8a90a0";}};
    const holding=team.filter(x=>String(x.heldItem||"").trim()).length;
    return `<div class="it7-teamhead"><b>${holding}/${team.length}</b><span>Pokémon segurando item</span><small>Toque no espaço do item para trocar</small></div>
    <div class="it7-team">${team.map(x=>{
      let im="";try{im=displayPokemonImage(x)||"";}catch(e){}
      const it=x.heldItem?(officialOf(x.heldItem)||(x.itemMemory||[]).find(r=>String(r.name).toLowerCase()===String(x.heldItem).toLowerCase())||{name:x.heldItem,description:""}):null;
      const r=it?read({...it,name:x.heldItem}):null;
      const types=[x.type1,x.type2].map(t=>typeof normalizeTypeName==="function"?normalizeTypeName(t):t).filter(Boolean);
      const c1=pal(types[0]||"Normal"),c2=pal(types[1]||types[0]||"Normal");
      const hp=Math.max(0,Number(x.currentHp??x.maxHp??0)),mx=Math.max(1,Number(x.maxHp||x.stats?.hp||1)),pc=Math.round(100*Math.min(hp,mx)/mx);
      const arena=r?.usableInBattle&&r?.held;
      return `<article class="it7-slot" style="--t1:${c1};--t2:${c2}">
        <div class="it7-slot-top">
          <span class="it7-mon">${im?`<img src="${esc(im)}" alt="" loading="lazy">`:"◓"}</span>
          <div class="it7-slot-id"><b>${esc(x.name)}</b>
            <span class="it7-slot-meta"><em>Lv ${Number(x.level||1)}</em>${types.map(t=>`<i style="--tc:${pal(t)}">${esc(t)}</i>`).join("")}</span>
            <span class="it7-slot-hp ${pc<=25?"low":pc<=50?"mid":""}" title="HP ${hp}/${mx}"><i style="width:${pc}%"></i></span></div>
        </div>
        <button type="button" class="it7-hold${it?"":" empty"}" data-it="pickFor" data-p="${esc(String(x.id))}" aria-label="${it?`Trocar ${esc(x.heldItem)}`:"Dar um item"}">
          <span class="it7-hold-ico">${it?face({img:sprite(it.apiName),icon:"px:gem"},32):ico("plus","it7-px")}</span>
          <span class="it7-hold-txt"><small>${it?"Segurando":"Sem item"}</small><b>${it?esc(x.heldItem):"Toque para dar um item"}</b></span>
          ${arena?`<span class="it7-hold-arena" title="Funciona sozinho na Arena">⚔</span>`:""}
        </button>
        ${r&&r.tags.length?`<div class="it7-tags">${tagChips(r,3)}</div>`:""}
        <div class="it7-slot-acts">${it?`<button type="button" class="it7-btn" data-it="take" data-p="${esc(String(x.id))}">Tirar</button>`:""}<button type="button" class="it7-btn${it?"":" go"}" data-it="pickFor" data-p="${esc(String(x.id))}">${it?"Trocar":"Dar item"}</button></div>
      </article>`;}).join("")}</div>`;
  }
  function onClick(e){
    const b=e.target.closest("[data-it]");
    if(!b){if(e.target===box)close();return;}
    const a=b.dataset.it;
    const ext=(window.hhItemsTabs||[]).find(t=>t.key===ui.tab);
    if(ext?.onClick?.(a,b,e)===true)return;
    if(a==="close")close();
    else if(a==="tab"){ui.tab=b.dataset.v;ui.sel=null;ui.page=1;if(ui.tab!=="bag")ui.group=ui.group==="held"&&ui.tab==="shop"?"held":"all";ui.q="";sfx("select");render();}
    else if(a==="group"){ui.group=b.dataset.v;ui.page=1;box.querySelectorAll(".it7-pockets button").forEach(x=>x.classList.toggle("on",x===b));renderList();sfx("select");}
    else if(a==="sel"){ui.sel=b.dataset.id;box.querySelectorAll(".it7-card").forEach(x=>x.classList.toggle("on",x===b));renderDetail();sfx("select");if(matchMedia("(max-width:760px)").matches)box.querySelector(".it7-detail")?.scrollIntoView({behavior:"smooth",block:"start"});}
    else if(a==="more"){ui.page++;renderList();}
    else if(a==="use"){useOn(findEntry(ui.sel));}
    else if(a==="give"){const p=(state.pokemon||[]).find(x=>String(x.id)===b.dataset.p);giveTo(p,findEntry(ui.sel));render();}
    else if(a==="take"){const p=(state.pokemon||[]).find(x=>String(x.id)===b.dataset.p);takeFrom(p);render();}
    else if(a==="pickFor"){ui.tab="bag";ui.group="held";ui.sel=null;render();toast("Escolha um item segurado e toque no Pokémon em “Dar para segurar”.");}
    else if(a==="buy"){const e2=findEntry(ui.sel);if(e2?.item)buy(e2.item,Number(b.dataset.n||1));render();}
    else if(a==="toShop"){ui.tab="shop";ui.sel="shop:"+b.dataset.id;ui.group="all";render();}
  }

  /* ---------- Entradas: botão no topo (junto da Arena) e item da INFO ---------- */
  function mountTop(){
    let btn=document.getElementById("hhBagBtn");
    if(!btn){
      const brand=document.querySelector(".topbar .brand");if(!brand)return;
      brand.insertAdjacentHTML("afterend",`<button type="button" id="hhBagBtn" class="ar7-open-btn it7-top" data-it-open="bag" aria-label="Mochila: itens, Equipe e Loja" title="Mochila: itens, Equipe e Loja">${ico("bag","it7-px top")}<span class="ar7-open-txt">Mochila</span></button>`);
      btn=document.getElementById("hhBagBtn");
    }
    const arena=document.getElementById("hhArenaBtn");
    if(arena&&arena.nextElementSibling!==btn)arena.after(btn);
  }
  // a Arena muda de lugar entre computador e celular: a Mochila vai junto
  matchMedia("(min-width:901px)").addEventListener?.("change",()=>setTimeout(mountTop,0));
  let tries=0;const waitArena=setInterval(()=>{mountTop();if(document.getElementById("hhArenaBtn")||++tries>40)clearInterval(waitArena);},250);
  function mountEntry(){
    mountTop();
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
  window.hhItemsUI={open,close,interpret:read,groupOf,owned,altPrice,shopItems,ALT,render:()=>{if(ui.open)render();},ico,sprite,inv,esc,fmtMoney,get tab(){return ui.tab;}};
})();
