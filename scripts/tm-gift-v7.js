/* ============================================================
   V7 — Mochila: 💿 Criador de TM e 🎁 Baú do Mestre
   • Criador de TM: o jogador escolhe a tipagem e escreve o golpe; o TM
     vai para o Inventário de Viagem. Usar o TM num Pokémon começa um
     treino: golpe legal para a espécie (está na lista de golpes dela)
     aprende com 1 sucesso; ilegal precisa de 3 treinos (3 dias na mesa).
     O TM é gasto ao começar o treino.
   • Baú do Mestre: com a senha do Modo Mestre, dá itens de graça
     (catálogo, lojas, itens criados na hora e dinheiro) para repor o que
     os jogadores perderam.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;
  const UI=()=>window.hhItemsUI;
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const toast=t=>{try{showToast(t);}catch(e){}};
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const cur=()=>{try{return current;}catch(e){return null;}};
  const save=()=>{try{saveState();}catch(e){try{debouncedSave();}catch(_){}}};
  const ico=(n,c)=>UI()?.ico?.(n,c)||"";
  const itemSprite=slug=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${encodeURIComponent(slug)}.png`;
  const TYPES=["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
  const TYPE_PT={Normal:"Normal",Fire:"Fogo",Water:"Água",Electric:"Elétrico",Grass:"Planta",Ice:"Gelo",Fighting:"Lutador",Poison:"Veneno",Ground:"Terra",Flying:"Voador",Psychic:"Psíquico",Bug:"Inseto",Rock:"Pedra",Ghost:"Fantasma",Dragon:"Dragão",Dark:"Sombrio",Steel:"Aço",Fairy:"Fada"};
  const TYPE_COLOR={Normal:"#a8a77a",Fire:"#ee8130",Water:"#6390f0",Electric:"#f7d02c",Grass:"#7ac74c",Ice:"#96d9d6",Fighting:"#c22e28",Poison:"#a33ea1",Ground:"#e2bf65",Flying:"#a98ff3",Psychic:"#f95587",Bug:"#a6b91a",Rock:"#b6a136",Ghost:"#735797",Dragon:"#6f35fc",Dark:"#705746",Steel:"#b7b7ce",Fairy:"#d685ad"};
  const CAT_PT={Physical:"Físico",Special:"Especial",Status:"Status"};
  const normT=t=>{try{return normalizeTypeName(t)||"Normal";}catch(e){return String(t||"Normal");}};
  const slugOf=n=>String(n||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim().replace(/[\s_]+/g,"-").replace(/[^a-z0-9-]/g,"");
  const invItems=()=>{try{const t=ensureTrainerData();t.inventory=t.inventory||{};t.inventory.items=Array.isArray(t.inventory.items)?t.inventory.items:[];return t.inventory.items;}catch(e){return [];}};
  const rerender=()=>{const a=document.activeElement;if(a&&a.closest?.(".it7")&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;UI()?.render?.();};

  /* ================= 💿 Criador de TM ================= */
  const tm={type:"Normal",name:"",draft:null,err:"",busy:false,custom:{cat:"Physical",power:0}};
  const legal=new Map();   // `${pid}|${slug}` -> {known,legal,why}
  const override=new Map(); // `${pid}|${slug}` -> true/false
  const tms=()=>invItems().filter(i=>i.tm&&Number(i.qty||0)>0);

  async function speciesMoves(p){
    const a=p?.apiData||{};
    let sp=null;try{sp=findIntegratedCustomSpecies(a.integratedSpeciesId||a.speciesName||p.name);}catch(e){}
    if(sp&&Array.isArray(sp.moves)&&sp.moves.length)return new Set(sp.moves.map(m=>slugOf(m.name||m)));
    const ref=a.pokemonId||a.pokemonName||(a.source&&/api/i.test(a.source)?p.name:"");
    if(!ref)return null;
    const r=await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(String(ref).toLowerCase())}/`);
    if(!r.ok)return null;
    const d=await r.json();
    return new Set((d.moves||[]).map(m=>m.move.name));
  }
  const setCache=new Map();
  function checkLegal(p,mv){
    const k=`${p.id}|${slugOf(mv.name)}`;
    if(legal.has(k))return legal.get(k);
    legal.set(k,{pending:true});
    const pk=String(p.id);
    (setCache.has(pk)?Promise.resolve(setCache.get(pk)):speciesMoves(p).then(s=>{setCache.set(pk,s);return s;}))
      .then(set=>{
        if(!set)legal.set(k,{known:false});
        else legal.set(k,{known:true,legal:set.has(slugOf(mv.name))});
      }).catch(()=>legal.set(k,{known:false})).finally(rerender);
    return legal.get(k);
  }
  function verdict(p,mv){
    const k=`${p.id}|${slugOf(mv.name)}`;
    if(override.has(k))return {legal:override.get(k),manual:true};
    const v=checkLegal(p,mv);
    if(v.pending)return {pending:true};
    if(!v.known)return {legal:false,unknown:true};
    return {legal:v.legal};
  }

  async function lookup(){
    const name=tm.name.trim();if(!name){tm.err="Escreva o nome do golpe.";UI().render();return;}
    tm.busy=true;tm.err="";tm.draft=null;UI().render();
    try{
      const mv=await fetchMoveFromApi(name);
      mv.type=normT(mv.type);
      tm.draft={...mv,found:true};
      if(mv.type!==tm.type)tm.err=`${mv.name} é do tipo ${TYPE_PT[mv.type]||mv.type}: um TM de ${TYPE_PT[tm.type]} não grava esse golpe.`;
    }catch(e){
      tm.draft={name:name.replace(/\s+/g," ").replace(/\b\w/g,c=>c.toUpperCase()),type:tm.type,category:tm.custom.cat,power:tm.custom.power,accuracy:90,effectChance:0,description:"",found:false};
    }
    tm.busy=false;UI().render();
  }
  function forge(){
    const d=tm.draft;if(!d)return;
    if(d.found&&d.type!==tm.type){toast("A tipagem do TM precisa ser a mesma do golpe.");return;}
    const mv=d.found?d:{...d,type:tm.type,category:tm.custom.cat,power:Number(tm.custom.power||0),description:"Golpe personalizado gravado num TM: o Mestre define os detalhes que faltarem.",source:"TM personalizado"};
    const slug=slugOf(mv.name);
    const tpt=TYPE_PT[mv.type]||mv.type;
    const src={key:`tm-${slug}`,name:`TM ${tpt} · ${mv.name}`,icon:"💿",category:"other",sprite:`tm-${String(mv.type).toLowerCase()}`,usable:true,
      desc:`Ensina ${mv.name} (${tpt} · ${CAT_PT[mv.category]||mv.category}${Number(mv.power)?` · Power ${mv.power}`:""}). Golpe legal para a espécie: 1 sucesso de treino. Ilegal: 3 treinos (3 dias).`,
      tm:{type:mv.type,move:{name:mv.name,type:mv.type,category:mv.category||"Physical",power:Number(mv.power||0),powerLabel:mv.powerLabel||"",accuracy:Number(mv.accuracy??90),accuracyLabel:mv.accuracyLabel||"",alwaysHits:!!mv.alwaysHits,effectChance:Number(mv.effectChance||0),description:mv.description||"",source:mv.source||"TM",tags:mv.tags||[],learnableBy:mv.learnableBy||[],learnRule:mv.learnRule||""}}};
    if(window.hhTrainerInventory?.add)window.hhTrainerInventory.add(src,1);
    else{invItems().push({...src,id:"it"+Math.random().toString(36).slice(2,9),qty:1});save();}
    sfx("level");toast(`💿 ${src.name} foi para o Inventário de Viagem.`);
    tm.draft=null;tm.name="";tm.err="";
    try{renderAll();}catch(e){}
    UI().render();
  }
  function teach(id,p){
    const it=invItems().find(i=>i.id===id);if(!it?.tm||!p)return;
    const mv=it.tm.move;
    if((p.moves||[]).some(m=>slugOf(m.name)===slugOf(mv.name))){toast(`${p.name} já sabe ${mv.name}.`);return;}
    if((p.trainingMoves||[]).some(t=>slugOf(t.name)===slugOf(mv.name))){toast(`${p.name} já está treinando ${mv.name}.`);return;}
    const v=verdict(p,mv);if(v.pending){toast("Ainda conferindo se o golpe é legal…");return;}
    const isLegal=!!v.legal;
    p.trainingMoves=Array.isArray(p.trainingMoves)?p.trainingMoves:[];
    p.trainingMoves.push({id:typeof uid==="function"?uid():"t"+Date.now(),name:mv.name,elementType:mv.type,category:mv.category,power:mv.power,powerLabel:mv.powerLabel,
      accuracy:mv.accuracy,accuracyLabel:mv.accuracyLabel,alwaysHits:mv.alwaysHits,effectChance:mv.effectChance,description:mv.description,source:mv.source,tags:[...(mv.tags||[])],
      learnableBy:[...(mv.learnableBy||[])],learnRule:mv.learnRule,trainingType:isLegal?"tm":"tm-illegal",successes:0,required:isLegal?1:3,active:false,fromTm:it.name});
    it.qty=Math.max(0,Number(it.qty||0)-1);
    save();try{renderAll();}catch(e){}
    sfx("select");
    toast(isLegal?`💿 ${p.name} começou a treinar ${mv.name}: aprende com 1 sucesso (página 02 · Treino).`:`💿 ${p.name} começou a treinar ${mv.name} (ilegal): precisa de 3 treinos, 3 dias na mesa.`);
    UI().render();
  }
  function tmView(){
    const p=cur(),list=tms(),d=tm.draft;
    const draftCard=d?`<div class="tm7-draft" style="--t:${TYPE_COLOR[d.found?d.type:tm.type]}">
        <img src="${esc(itemSprite("tm-"+String(d.found?d.type:tm.type).toLowerCase()))}" alt="" width="40" height="40">
        <div><b>${esc(d.name)}</b><small>${d.found?`${esc(TYPE_PT[d.type]||d.type)} · ${esc(CAT_PT[d.category]||d.category)}${Number(d.power)?` · Power ${d.power}`:""}${d.accuracy?` · Precisão ${d.accuracyLabel||d.accuracy+"%"}`:""} · ${esc(d.source||"")}`:"Não está no Banco do Sistema nem na PokéAPI: vira um golpe personalizado."}</small>
        ${d.found&&d.description?`<p>${esc(String(d.description).slice(0,260))}</p>`:""}
        ${!d.found?`<div class="tm7-custom"><span>Categoria:</span>${["Physical","Special","Status"].map(c=>`<button type="button" class="${tm.custom.cat===c?"on":""}" data-it="tm-cat" data-v="${c}">${CAT_PT[c]}</button>`).join("")}<label>Power <input type="number" min="0" max="250" data-tm="power" value="${Number(tm.custom.power||0)}"></label></div>`:""}</div>
        ${d.found&&d.type!==tm.type?`<button type="button" class="it7-btn" data-it="tm-type" data-v="${esc(d.type)}">Usar TM de ${esc(TYPE_PT[d.type]||d.type)}</button>`:`<button type="button" class="it7-btn go" data-it="tm-forge">💿 Gravar TM</button>`}
      </div>`:"";
    return `<div class="tm7">
      <section class="tm7-forge">
        <h3>${ico("disc")} Criador de TM</h3>
        <p class="tm7-sub">1. Escolha a tipagem do disco · 2. Escreva o golpe · 3. Grave. O TM vai para o Inventário de Viagem.</p>
        <div class="tm7-types">${TYPES.map(t=>`<button type="button" class="${tm.type===t?"on":""}" style="--t:${TYPE_COLOR[t]}" data-it="tm-type" data-v="${t}">${esc(TYPE_PT[t])}</button>`).join("")}</div>
        <form class="tm7-row" data-tm-form="look"><input data-tm="name" type="text" maxlength="40" placeholder="Nome do golpe (ex.: Flamethrower)" value="${esc(tm.name)}" autocomplete="off"><button type="submit" class="it7-btn" ${tm.busy?"disabled":""}>${tm.busy?"Buscando…":"🔍 Conferir golpe"}</button></form>
        ${tm.err?`<p class="tm7-err">${esc(tm.err)}</p>`:""}
        ${draftCard}
      </section>
      <section class="tm7-list">
        <h3>${ico("disc")} Seus TMs <small>${p?`ensinando para <b>${esc(p.name)}</b> (troque o Pokémon na ficha)`:""}</small></h3>
        ${list.length?`<div class="tm7-grid">${list.map(it=>{const mv=it.tm.move;const v=p?verdict(p,mv):null;const k=p?`${p.id}|${slugOf(mv.name)}`:"";
          const badge=!p?"":v.pending?`<em class="tm7-v wait">Conferindo…</em>`:v.legal?`<em class="tm7-v ok">✓ Legal${v.manual?" (Mestre)":""}: aprende com 1 sucesso</em>`:`<em class="tm7-v bad">✕ ${v.unknown?"Não deu para conferir · conta como ilegal":"Ilegal"}${v.manual?" (Mestre)":""}: 3 treinos (3 dias)</em>`;
          return `<article class="tm7-card" style="--t:${TYPE_COLOR[it.tm.type]||"#888"}">
            <div class="tm7-top"><img src="${esc(itemSprite("tm-"+String(it.tm.type).toLowerCase()))}" alt="" width="36" height="36"><div><b>${esc(mv.name)}</b><small>${esc(TYPE_PT[mv.type]||mv.type)} · ${esc(CAT_PT[mv.category]||mv.category)}${Number(mv.power)?` · Power ${mv.power}`:""}</small></div><span class="tm7-qty">×${Number(it.qty)}</span></div>
            ${badge}
            ${p?`<div class="tm7-acts"><select data-tm="ov" data-k="${esc(k)}" title="O Mestre pode decidir"><option value="">Automático</option><option value="1" ${override.get(k)===true?"selected":""}>Mestre: legal</option><option value="0" ${override.get(k)===false?"selected":""}>Mestre: ilegal</option></select>
              <button type="button" class="it7-btn go" data-it="tm-teach" data-v="${esc(it.id)}" ${v?.pending?"disabled":""}>Treinar ${esc(p.name)}</button></div>`:""}
          </article>`;}).join("")}</div>`:`<p class="tm7-empty">Nenhum TM ainda. Crie um acima.</p>`}
        <p class="tm7-sub">Começar o treino gasta o TM. O progresso aparece na página 02, em Treino de Moves: marque os sucessos lá.</p>
      </section></div>`;
  }

  /* ================= 🎁 Baú do Mestre ================= */
  const gift={q:"",n:1,msg:"",cName:"",cDesc:"",cCat:"other"};
  const gmOn=()=>!!window.hhGm?.isOn?.();
  const CATS=[["balls","Poké Balls"],["consumables","Consumíveis"],["trainer","Treinador"],["camping","Acampamento"],["exploration","Exploração"],["held","Held Items"],["other","Outros"]];
  function sources(){
    const out=[];
    for(const sh of (window.hhTrainerInventory?.shops||[]))for(const it of (sh.items||[]))out.push({id:`shop:${sh.id}:${it.key}`,name:it.name,from:sh.name,icon:it.icon,shop:it});
    try{POKEAPI_ITEM_BY_SLUG.forEach((it,slug)=>out.push({id:"api:"+slug,name:it.name,from:"Itemdex",img:itemSprite(slug),api:it,slug}));}catch(e){}
    return out;
  }
  function results(){
    const q=slugOf(gift.q);if(!q)return [];
    const all=sources();const seen=new Set();
    return all.filter(x=>{const k=slugOf(x.name);if(!k.includes(q)||seen.has(k+x.from))return false;seen.add(k+x.from);return true;}).slice(0,40);
  }
  function give(x,n){
    n=Math.max(1,Math.min(999,Number(n||1)));
    if(x.api){
      const slug=x.slug;
      if(typeof BAG_CONSUMABLE_BY_SLUG!=="undefined"&&BAG_CONSUMABLE_BY_SLUG.has(slug))setBagQuantity(slug,bagQuantity(slug)+n,{render:false,save:false});
      else{let held=false;try{held=UI().groupOf(x.api)==="held"||UI().groupOf(x.api)==="berry";}catch(e){}
        window.hhTrainerInventory.add({name:x.api.name,icon:held?"💎":"📦",category:held?"held":"other",desc:x.api.description||"",apiName:slug,sprite:slug},n);}
    }else if(x.shop){const s={...x.shop};delete s.builtin;window.hhTrainerInventory.add(s,n);}
    else window.hhTrainerInventory.add(x.custom,n);
    save();try{renderAll();}catch(e){}
    sfx("coin");toast(`🎁 ${x.name} ×${n} entregue de graça.`);
  }
  function giftView(){
    if(false)return `<div class="gift7 locked"><span class="gift7-lock">${ico("gift","it7-px big")}</span><b>Baú do Mestre</b>
      <p>Só o Mestre tem a chave.</p>
      <form class="tm7-row" data-gift-form="pwd"><input data-gift="pwd" type="password" placeholder="Senha do Mestre" autocomplete="off"><button type="submit" class="it7-btn go">Abrir</button></form>
      ${gift.msg?`<p class="tm7-err">${esc(gift.msg)}</p>`:""}</div>`;
    const res=results();
    return `<div class="gift7">
      <header class="gift7-head">${ico("gift")}<div><b>Baú do Mestre</b><small>Pra repor o que se perdeu pelo caminho.</small></div></header>
      <section class="gift7-sec"><h4>Dinheiro</h4><form class="tm7-row" data-gift-form="money"><input data-gift="money" type="number" min="1" max="9999999" placeholder="Quantia em ₽"><button type="submit" class="it7-btn go">Dar ₽</button></form></section>
      <section class="gift7-sec"><h4>Procurar item</h4>
        <div class="tm7-row"><input data-gift="q" type="search" placeholder="Nome do item (Potion, Leftovers, Barraca, Ultra Ball…)" value="${esc(gift.q)}" autocomplete="off">
          <span class="gift7-n"><button type="button" data-it="gift-n" data-v="-1">−</button><b>×${gift.n}</b><button type="button" data-it="gift-n" data-v="1">+</button></span></div>
        <div class="gift7-res">${gift.q.trim()?(res.length?res.map(x=>`<div class="gift7-item"><span class="gift7-ico">${x.img?`<img src="${esc(x.img)}" alt="" width="28" height="28" loading="lazy">`:/^px:/.test(x.icon||"")?(window.hhInvPx?.(x.icon.slice(3),"it7-px")||""):esc(x.icon||"📦")}</span><span><b>${esc(x.name)}</b><small>${esc(x.from)}</small></span><button type="button" class="it7-btn go" data-it="gift-give" data-v="${esc(x.id)}">Dar ×${gift.n}</button></div>`).join(""):`<p class="tm7-empty">Nada com esse nome. Crie o item abaixo.</p>`):`<p class="tm7-empty">Digite para buscar no catálogo e nas lojas.</p>`}</div></section>
      <section class="gift7-sec"><h4>Item personalizado</h4>
        <form class="gift7-custom" data-gift-form="custom">
          <input data-gift="cName" type="text" maxlength="60" placeholder="Nome do item" value="${esc(gift.cName)}">
          <select data-gift="cCat">${CATS.map(([k,l])=>`<option value="${k}" ${gift.cCat===k?"selected":""}>${l}</option>`).join("")}</select>
          <textarea data-gift="cDesc" maxlength="600" rows="2" placeholder="O que o item faz (opcional)">${esc(gift.cDesc)}</textarea>
          <button type="submit" class="it7-btn go">Criar e dar ×${gift.n}</button></form></section>
    </div>`;
  }

  /* ================= registro das abas ================= */
  window.hhItemsTabs=window.hhItemsTabs||[];
  window.hhItemsTabs.push({key:"tm",icon:"disc",label:"TMs",sub:"Criar e treinar",view:tmView,
    onClick(a,b){
      if(a==="tm-type"){tm.type=b.dataset.v;tm.err="";if(tm.draft&&tm.draft.found&&tm.draft.type!==tm.type)tm.err=`${tm.draft.name} é do tipo ${TYPE_PT[tm.draft.type]}: um TM de ${TYPE_PT[tm.type]} não grava esse golpe.`;UI().render();return true;}
      if(a==="tm-cat"){tm.custom.cat=b.dataset.v;UI().render();return true;}
      if(a==="tm-forge"){forge();return true;}
      if(a==="tm-teach"){teach(b.dataset.v,cur());return true;}
      return false;
    },
    onInput(e){const t=e.target.dataset.tm;if(t==="name"){tm.name=e.target.value;}else if(t==="power"){tm.custom.power=Number(e.target.value||0);}else if(t==="ov"){const k=e.target.dataset.k;if(e.target.value==="")override.delete(k);else override.set(k,e.target.value==="1");UI().render();}},
    onSubmit(e){if(e.target.closest("[data-tm-form=look]"))lookup();}
  });
  // selects disparam "change", não "input" em alguns navegadores
  document.addEventListener("change",e=>{const s=e.target.closest?.(".it7 [data-tm=ov]");if(!s)return;const k=s.dataset.k;if(s.value==="")override.delete(k);else override.set(k,s.value==="1");UI()?.render();});
  window.hhItemsTabs.push({key:"gift",icon:"gift",label:"Baú",sub:"Itens de graça",view:giftView,
    after(box){if(gift.focus){const el=box.querySelector(`[data-gift=${gift.focus}]`);if(el){el.focus();const v=el.value;try{el.setSelectionRange(v.length,v.length);}catch(e){}}gift.focus=null;}},
    onClick(a,b){
      if(a==="gift-lock"){window.hhGm?.lock?.();UI().render();return true;}
      if(a==="gift-n"){gift.n=Math.max(1,Math.min(99,gift.n+Number(b.dataset.v)));UI().render();return true;}
      if(a==="gift-give"){const x=sources().find(s=>s.id===b.dataset.v);if(x)give(x,gift.n);UI().render();return true;}
      return false;
    },
    onInput(e){const k=e.target.dataset.gift;if(!k)return;if(k==="q"){gift.q=e.target.value;gift.focus="q";UI().render();}else if(k==="cName")gift.cName=e.target.value;else if(k==="cDesc")gift.cDesc=e.target.value;else if(k==="cCat")gift.cCat=e.target.value;},
    async onSubmit(e){
      const f=e.target.closest("[data-gift-form]");if(!f)return;const kind=f.dataset.giftForm;
      if(kind==="pwd"){const ok=await window.hhGm?.unlock?.(f.querySelector("[data-gift=pwd]").value||"");gift.msg=ok?"":"Senha errada.";if(ok)sfx("level");UI().render();return;}
      if(kind==="money"){const n=Math.floor(Number(f.querySelector("[data-gift=money]").value||0));if(n>0){const t=ensureTrainerData();t.money=Number(t.money||0)+n;save();try{renderAll();}catch(err){}sfx("coin");toast(`🎁 ₽ ${n.toLocaleString("pt-BR")} entregues.`);UI().render();}return;}
      if(kind==="custom"){const name=(f.querySelector("[data-gift=cName]").value||"").trim();if(!name){toast("Dê um nome ao item.");return;}
        gift.cCat=f.querySelector("[data-gift=cCat]").value;
        give({name,custom:{name,desc:(f.querySelector("[data-gift=cDesc]").value||"").trim(),category:gift.cCat,icon:gift.cCat==="held"?"💎":gift.cCat==="balls"?"ball:poke":"📦"}},gift.n);
        gift.cName="";gift.cDesc="";UI().render();}
    }
  });
  window.hhTmForge={tms,verdict,teach};
})();
