/* ============================================================
   V7 — Biblioteca Pokédex (adicionar Pokémon à ficha)
   O botão ＋ do PC abre uma Pokédex para navegar, filtrar e pesquisar
   todos os Pokémon da PokéAPI (e os Fakemon do sistema). Ao escolher,
   a ficha é criada com a mesma importação da busca da ficha (stats,
   abilities, movepool por nível). Criar à mão continua disponível no
   botão "Criar personalizado".
   Lista: GraphQL da PokéAPI (uma consulta, com tipos e geração);
   se falhar, usa a lista REST e as faixas de número por geração.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;
  const GQL="https://graphql.pokeapi.co/v1beta2";
  const REST="https://pokeapi.co/api/v2/";
  const ART=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  const ART_SHINY=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const PX=(n,sz)=>window.hhArenaPix?window.hhArenaPix.svg(n,sz):"";
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const pal=t=>{try{return moveTypePalette(t);}catch(e){return {main:"#8a90a0",dark:"#4a5060"};}};
  const nice=n=>{try{return prettyName(n);}catch(e){return String(n||"").split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");}};
  const capT=t=>t?t.charAt(0).toUpperCase()+t.slice(1):"";
  const TYPES=["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
  const TYPE_PT={normal:"Normal",fogo:"Fire",agua:"Water","água":"Water",eletrico:"Electric","elétrico":"Electric",planta:"Grass",grama:"Grass",gelo:"Ice",lutador:"Fighting",veneno:"Poison",terra:"Ground",voador:"Flying",psiquico:"Psychic","psíquico":"Psychic",inseto:"Bug",pedra:"Rock",fantasma:"Ghost",dragao:"Dragon","dragão":"Dragon",sombrio:"Dark",metal:"Steel","aço":"Steel",aco:"Steel",fada:"Fairy"};
  const GENS=[[1,"I","Kanto",1,151],[2,"II","Johto",152,251],[3,"III","Hoenn",252,386],[4,"IV","Sinnoh",387,493],[5,"V","Unova",494,649],[6,"VI","Kalos",650,721],[7,"VII","Alola",722,809],[8,"VIII","Galar",810,905],[9,"IX","Paldea",906,1025]];
  const genOfId=id=>GENS.find(g=>id>=g[3]&&id<=g[4])?.[0]||0;
  const STAT_LABEL=[["hp","HP"],["atk","Attack"],["def","Defense"],["spa","Sp. Atk"],["spd","Sp. Def"],["spe","Speed"]];
  const STAT_API={hp:"hp",attack:"atk",defense:"def","special-attack":"spa","special-defense":"spd",speed:"spe"};

  let list=null,loading=false,loadError="";
  const filt={q:"",gen:0,type:"",forms:false,fakemon:false};
  let shown=120,sel=null,detail=null,shiny=false,addLevel=5,adding=false;
  const cache=new Map();

  /* ---------- Dados ---------- */
  async function getJSON(url,opt){
    if(cache.has(url))return cache.get(url);
    const p=fetch(url,opt).then(r=>{if(!r.ok)throw new Error("PokéAPI "+r.status);return r.json();});
    cache.set(url,p);try{return await p;}catch(e){cache.delete(url);throw e;}
  }
  async function loadList(){
    if(list||loading)return;loading=true;loadError="";render();
    try{
      let rows;
      try{
        const q='query{pokemon(order_by:{id:asc}){id name is_default pokemon_species_id pokemontypes(order_by:{slot:asc}){type{name}} pokemonspecy{generation_id}}}';
        const r=await getJSON(GQL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query:q})});
        rows=(r.data?.pokemon||[]).map(p=>({id:p.id,name:p.name,dex:p.pokemon_species_id,def:p.is_default,types:(p.pokemontypes||[]).map(t=>capT(t.type?.name)),gen:p.pokemonspecy?.generation_id||genOfId(p.pokemon_species_id)}));
        if(!rows.length)throw new Error("vazio");
      }catch(e){
        const r=await getJSON(REST+"pokemon?limit=1400");
        rows=(r.results||[]).map(x=>{const id=Number(x.url.split("/").filter(Boolean).pop());return {id,name:x.name,dex:id<10000?id:0,def:id<10000,types:[],gen:genOfId(id)};});
      }
      // Fakemon do sistema
      const fk=(typeof INTEGRATED_CUSTOM_SPECIES!=="undefined"?INTEGRATED_CUSTOM_SPECIES:[]).map(s=>({id:"fk-"+s.id,name:s.name,dex:0,def:true,fakemon:true,types:s.types||[],gen:0,img:s.image?.dataUrl||"",species:s}));
      list=[...rows,...fk];
    }catch(e){loadError="Não consegui falar com a PokéAPI. Confira a internet.";}
    loading=false;render();
  }
  function filtered(){
    if(!list)return [];
    let q=filt.q.trim().toLowerCase().replace(/^#/,"");
    const typeQ=TYPE_PT[q]||TYPES.find(t=>t.toLowerCase()===q);
    return list.filter(p=>{
      if(filt.fakemon&&!p.fakemon)return false;
      if(!filt.forms&&!p.def&&!p.fakemon)return false;
      if(filt.gen&&p.gen!==filt.gen)return false;
      if(filt.type&&!p.types.includes(filt.type))return false;
      if(!q)return true;
      if(typeQ)return p.types.includes(typeQ);
      if(/^\d+$/.test(q))return String(p.dex)===String(Number(q))||String(p.dex).startsWith(q);
      return p.name.toLowerCase().replace(/-/g," ").includes(q.replace(/-/g," "));
    });
  }
  const imgOf=p=>p.fakemon?p.img:(shiny&&sel&&sel.id===p.id?ART_SHINY(p.id):ART(p.id));

  async function select(p){
    sel=p;detail=null;shiny=false;sfx("select");render();
    if(p.fakemon){
      const s=p.species;
      detail={stats:s.baseStats||{},abilities:[s.ability?.name].filter(Boolean),abilityText:s.ability?.description||"",genus:s.category||"Fakemon do sistema",flavor:s.notes||"",height:null,weight:null,chain:[],cry:""};
      render();return;
    }
    try{
      const d=await getJSON(REST+"pokemon/"+p.id);
      if(sel!==p)return;
      const stats={};(d.stats||[]).forEach(s=>{stats[STAT_API[s.stat.name]]=s.base_stat;});
      detail={stats,abilities:(d.abilities||[]).map(a=>nice(a.ability.name)+(a.is_hidden?" (oculta)":"")),height:d.height/10,weight:d.weight/10,cry:d.cries?.latest||"",
        types:(d.types||[]).map(t=>capT(t.type.name)),genus:"",flavor:"",chain:[]};
      if(!p.types.length)p.types=detail.types;
      render();
      const sp=await getJSON(d.species.url);
      if(sel!==p)return;
      const ptFlavor=(sp.flavor_text_entries||[]).filter(f=>["pt-br","pt","es","en"].includes(f.language.name));
      const pick=lang=>ptFlavor.filter(f=>f.language.name===lang).pop();
      const fl=pick("pt-br")||pick("pt")||pick("es")||pick("en");
      detail.flavor=fl?String(fl.flavor_text).replace(/[\f\n\r]+/g," "):"";
      detail.flavorLang=fl?.language?.name||"";
      const g=(sp.genera||[]).find(x=>x.language.name==="es")||(sp.genera||[]).find(x=>x.language.name==="en");
      detail.genus=g?.genus||"";
      render();
      if(sp.evolution_chain?.url){
        const ch=await getJSON(sp.evolution_chain.url);
        const out=[];const walk=(n,depth)=>{const id=Number(n.species.url.split("/").filter(Boolean).pop());out.push({id,name:n.species.name,depth});(n.evolves_to||[]).forEach(x=>walk(x,depth+1));};
        walk(ch.chain,0);
        if(sel===p){detail.chain=out;render();}
      }
    }catch(e){if(sel===p){detail={error:"Não consegui carregar os detalhes."};render();}}
  }

  async function addToSheet(){
    if(!sel||adding)return;
    adding=true;render();
    const p=sel,level=Math.max(1,Math.min(100,Number(addLevel)||1)),useShiny=shiny&&!p.fakemon;
    try{
      const teamCount=state.pokemon.filter(x=>(x.storageGroup||"team")==="team").length;
      createBlankPokemon();
      const fresh=current;
      await searchPokemonFromApi(p.fakemon?p.name:p.name);
      if(current!==fresh)throw new Error("A ficha mudou durante a importação.");
      fresh.storageGroup=teamCount<6?"team":"box";
      if(useShiny)fresh.imageUrl=ART_SHINY(p.id);
      if(level>1){const lv=document.getElementById("level");if(lv){lv.value=String(level);lv.dispatchEvent(new Event("change",{bubbles:true}));}else fresh.level=level;}
      document.getElementById("app")?.classList.remove("drawer-open");
      try{renderAll();}catch(e){}
      try{saveState();}catch(e){}
      try{setActiveSheetPage("page1");}catch(e){}
      close();
      showToast(`✓ ${fresh.name} entrou ${fresh.storageGroup==="team"?"na Equipe":"na Caixa do PC"} (Lv. ${fresh.level}).`);sfx("page");
    }catch(e){console.error(e);showToast(e.message||"Não consegui adicionar este Pokémon.");}
    adding=false;render();
  }

  /* ---------- Tela ---------- */
  const root=document.createElement("section");
  root.id="hhDexLib";root.className="ar7 dx7";root.hidden=true;root.setAttribute("aria-label","Pokédex: adicionar Pokémon");
  document.body.appendChild(root);
  function open(){root.hidden=false;document.body.classList.add("ar7-open");sfx("page");render();loadList();setTimeout(()=>root.querySelector("#dx7Search")?.focus(),60);}
  function close(){root.hidden=true;document.body.classList.remove("ar7-open");sel=null;detail=null;}
  window.hhDexLibrary={open,close};

  function typeChip(t,small){const c=pal(t);return `<i class="dx7-type${small?" sm":""}" style="--t:${c.main};--td:${c.dark}">${esc(t)}</i>`;}
  function card(p){
    const c=pal(p.types[0]||"Normal");
    return `<button type="button" class="dx7-card${sel&&sel.id===p.id?" on":""}${p.fakemon?" fk":""}" data-dx="pick" data-id="${esc(p.id)}" style="--t:${c.main};--td:${c.dark}">
      <span class="dx7-no">${p.fakemon?"FAKEMON":p.dex?"#"+String(p.dex).padStart(4,"0"):"FORMA"}</span>
      <span class="dx7-art"><img src="${esc(p.fakemon?p.img:ART(p.id))}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'"></span>
      <b>${esc(nice(p.name))}</b>
      <span class="dx7-types">${p.types.map(t=>typeChip(t,true)).join("")}</span>
    </button>`;
  }
  function detailView(){
    if(!sel)return `<div class="dx7-empty">${PX("ball",64)}<b>Escolha um Pokémon</b><p>Toque num cartão para ver os dados e adicionar à ficha.</p></div>`;
    const p=sel,d=detail,types=(d?.types||p.types||[]);
    const c=pal(types[0]||"Normal");
    const bst=d?.stats?Object.values(d.stats).reduce((a,b)=>a+Number(b||0),0):0;
    const team=state.pokemon.filter(x=>(x.storageGroup||"team")==="team").length;
    return `<div class="dx7-detail" style="--t:${c.main};--td:${c.dark}">
      <button type="button" class="dx7-close-detail" data-dx="unpick" aria-label="Fechar detalhes">✕</button>
      <div class="dx7-hero">
        <span class="dx7-no big">${p.fakemon?"Fakemon do sistema":p.dex?"Nº "+String(p.dex).padStart(4,"0"):"Forma alternativa"}</span>
        <div class="dx7-hero-art"><img src="${esc(p.fakemon?p.img:(shiny?ART_SHINY(p.id):ART(p.id)))}" alt="${esc(nice(p.name))}"></div>
        <h2>${esc(nice(p.name))}</h2>
        ${d?.genus?`<small class="dx7-genus">${esc(d.genus)}</small>`:""}
        <div class="dx7-types">${types.map(t=>typeChip(t)).join("")}</div>
        <div class="dx7-hero-btns">
          ${p.fakemon?"":`<button type="button" class="dx7-pill${shiny?" on":""}" data-dx="shiny" aria-pressed="${shiny}">✦ Shiny</button>`}
          ${d?.cry?`<button type="button" class="dx7-pill" data-dx="cry">♪ Grito</button>`:""}
        </div>
      </div>
      ${!d?`<p class="dx7-loading">Carregando dados…</p>`:d.error?`<p class="dx7-loading">${esc(d.error)}</p>`:`
      ${d.flavor?`<p class="dx7-flavor">“${esc(d.flavor)}”</p>`:""}
      <div class="dx7-block"><h4>Base Stats <small>BST ${bst}</small></h4>
        ${STAT_LABEL.map(([k,l])=>{const v=Number(d.stats[k]||0);return `<div class="dx7-stat"><span>${l}</span><b>${v}</b><i><em style="width:${Math.min(100,v/2.55)}%;--c:${v>=110?"#3fc957":v>=80?"#9bd34a":v>=60?"#f2c230":"#f08030"}"></em></i></div>`;}).join("")}
      </div>
      <div class="dx7-block dx7-facts">
        <div><small>Abilities</small><b>${d.abilities.map(esc).join(" · ")||"—"}</b>${d.abilityText?`<p>${esc(d.abilityText)}</p>`:""}</div>
        ${d.height!=null?`<div><small>Altura</small><b>${d.height.toLocaleString("pt-BR")} m</b></div><div><small>Peso</small><b>${d.weight.toLocaleString("pt-BR")} kg</b></div>`:""}
      </div>
      ${d.chain?.length>1?`<div class="dx7-block"><h4>Evoluções</h4><div class="dx7-chain">${d.chain.map((x,i)=>`${i&&x.depth>d.chain[i-1].depth?`<span class="dx7-arrow">→</span>`:i?`<span class="dx7-arrow alt">/</span>`:""}<button type="button" class="dx7-evo${x.id===p.dex?" on":""}" data-dx="pick" data-id="${x.id}"><img src="${ART(x.id)}" alt="" loading="lazy"><small>${esc(nice(x.name))}</small></button>`).join("")}</div></div>`:""}
      `}
      <div class="dx7-add">
        <label>Nível<input type="number" id="dx7Level" min="1" max="100" value="${esc(addLevel)}"></label>
        <button type="button" class="ar7-btn primary dx7-add-btn" data-dx="add" ${adding||!d||d.error?"disabled":""}>${adding?"Adicionando…":`＋ Adicionar à ficha`}</button>
        <small>Vai para ${team<6?"a <b>Equipe</b>":"a <b>Caixa do PC</b> (Equipe cheia)"} com stats, abilities e golpes por nível.</small>
      </div>
    </div>`;
  }
  function render(){
    if(root.hidden)return;
    const scrollTop=root.querySelector(".dx7-grid-wrap")?.scrollTop;
    const focusId=document.activeElement?.id,selStart=document.activeElement?.selectionStart;
    const all=filtered(),items=all.slice(0,shown);
    root.innerHTML=`<div class="ar7-shell dx7-shell">
      <header class="ar7-top">
        <button type="button" class="ar7-back" data-dx="close">← Ficha</button>
        <div class="ar7-title"><b><span class="dx7-lens" aria-hidden="true"></span> Pokédex</b><small>Escolha um Pokémon para a ficha</small></div>
        <button type="button" class="ar7-share" data-dx="manual" title="Criar Fakemon, forma própria ou Pokémon original">✎ <span class="dx7-hide-m">Criar </span>personalizado</button>
      </header>
      <div class="dx7-layout${sel?" has-sel":""}">
        <section class="dx7-browse ar8-sec">
          <h3>${PX("ball",22)} Biblioteca <small>${list?all.length:"…"}</small></h3>
          <div class="dx7-filters">
            <label class="dx7-search"><span aria-hidden="true">🔍</span><input id="dx7Search" type="search" placeholder="Nome, número ou tipo (ex.: pikachu, 25, fogo)" value="${esc(filt.q)}" autocomplete="off"></label>
            <div class="dx7-chips" role="group" aria-label="Geração"><button type="button" class="dx7-chip${!filt.gen?" on":""}" data-dx="gen" data-v="0">Todas</button>${GENS.map(g=>`<button type="button" class="dx7-chip${filt.gen===g[0]?" on":""}" data-dx="gen" data-v="${g[0]}" title="${g[2]}">${g[1]} <small>${g[2]}</small></button>`).join("")}</div>
            <div class="dx7-chips types" role="group" aria-label="Tipo">${TYPES.map(t=>{const c=pal(t);return `<button type="button" class="dx7-tchip${filt.type===t?" on":""}" data-dx="type" data-v="${t}" style="--t:${c.main};--td:${c.dark}">${t}</button>`;}).join("")}</div>
            <div class="dx7-toggles">
              <label><input type="checkbox" data-dx-tg="forms" ${filt.forms?"checked":""}> Formas regionais, Mega e outras</label>
              <label><input type="checkbox" data-dx-tg="fakemon" ${filt.fakemon?"checked":""}> Só Fakemon do sistema</label>
            </div>
          </div>
          <div class="dx7-grid-wrap">
            ${loadError?`<div class="dx7-empty"><b>${esc(loadError)}</b><button type="button" class="ar7-btn primary" data-dx="retry">Tentar de novo</button></div>`:
              !list?`<div class="dx7-grid">${Array.from({length:18},()=>`<span class="dx7-card skel"></span>`).join("")}</div>`:
              !all.length?`<div class="dx7-empty">${PX("ball",48)}<b>Nenhum Pokémon com esse filtro.</b><p>Não achou? Use <button type="button" class="ar7-link" data-dx="manual">Criar personalizado</button>.</p></div>`:
              `<div class="dx7-grid">${items.map(card).join("")}</div>${all.length>shown?`<div class="dx7-more" data-more>Carregando mais…</div>`:""}`}
          </div>
        </section>
        <aside class="dx7-side ar8-sec">${detailView()}</aside>
      </div>
    </div>`;
    const gw=root.querySelector(".dx7-grid-wrap");if(gw&&scrollTop)gw.scrollTop=scrollTop;
    if(focusId){const el=document.getElementById(focusId);if(el){el.focus();try{if(selStart!=null)el.setSelectionRange(selStart,selStart);}catch(e){}}}
    const more=root.querySelector("[data-more]");
    if(more){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();shown+=120;render();}},{root:null,rootMargin:"400px"});io.observe(more);}
  }

  let searchT;
  root.addEventListener("input",e=>{
    if(e.target.id==="dx7Search"){filt.q=e.target.value;shown=120;clearTimeout(searchT);searchT=setTimeout(render,140);}
    if(e.target.id==="dx7Level")addLevel=e.target.value;
  });
  root.addEventListener("change",e=>{const k=e.target.dataset?.dxTg;if(k){filt[k]=e.target.checked;shown=120;render();}});
  root.addEventListener("click",e=>{
    const b=e.target.closest("[data-dx]");if(!b)return;
    const a=b.dataset.dx;
    if(a==="close")close();
    else if(a==="manual"){close();try{openManualPokemonModal();}catch(err){}}
    else if(a==="retry"){loadError="";loadList();}
    else if(a==="gen"){filt.gen=Number(b.dataset.v)||0;shown=120;sfx("select");render();}
    else if(a==="type"){filt.type=filt.type===b.dataset.v?"":b.dataset.v;shown=120;sfx("select");render();}
    else if(a==="pick"){const id=b.dataset.id;const p=list?.find(x=>String(x.id)===String(id));if(p){select(p);if(matchMedia("(max-width:900px)").matches)root.querySelector(".dx7-side")?.scrollIntoView?.({behavior:"smooth"});}}
    else if(a==="unpick"){sel=null;detail=null;render();}
    else if(a==="shiny"){shiny=!shiny;sfx("select");render();}
    else if(a==="cry"){try{new Audio(detail.cry).play();}catch(err){}}
    else if(a==="add")addToSheet();
  });
  root.addEventListener("keydown",e=>{if(e.key==="Escape"){if(sel){sel=null;detail=null;render();}else close();}if(e.key==="Enter"&&e.target.id==="dx7Level")addToSheet();});

  /* O ＋ do PC e o "Novo" passam a abrir a Pokédex */
  const btn=document.getElementById("drawerNewBtn");
  if(btn){btn.onclick=open;btn.title="Adicionar Pokémon pela Pokédex";}
})();
