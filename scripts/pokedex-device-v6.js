/* ============================================================
   V6 — Pokédex como aparelho
   Substitui a visão geral com o Modo Pokédex ligado. Lê o Pokémon atual da
   ficha (state/current) e busca na PokéAPI o que a ficha não
   guarda: categoria, registro dos jogos, altura, peso e grito.
   Preferências do visor ficam em state.dexDevice e passam pelo
   debouncedSave, como o resto da ficha.
   ============================================================ */
(function(){
  "use strict";

  if(typeof state==="undefined"||typeof getCurrent!=="function")return;

  const SECTIONS=[
    {id:"entry",label:"ENTRADA",short:"ENT"},
    {id:"stats",label:"STATUS",short:"STS"},
    {id:"types",label:"TIPOS",short:"TPS"},
    {id:"moves",label:"GOLPES",short:"GLP"},
    {id:"ability",label:"ABILITY",short:"ABL"}
  ];
  const STAT_SHORT={hp:"HP",atk:"ATK",def:"DEF",spa:"SP.ATK",spd:"SP.DEF",spe:"SPD"};
  const STAT_COLORS={hp:"#4fe36f",atk:"#ff9538",def:"#4f8dff",spa:"#b067ff",spd:"#76e7ff",spe:"#ffd84a"};
  const TYPE_TINT={
    Normal:"#a8a77a",Fire:"#ee8130",Water:"#6390f0",Electric:"#f7d02c",Grass:"#7ac74c",Ice:"#96d9d6",
    Fighting:"#c22e28",Poison:"#a33ea1",Ground:"#e2bf65",Flying:"#a98ff3",Psychic:"#f95587",Bug:"#a6b91a",
    Rock:"#b6a136",Ghost:"#735797",Dragon:"#6f35fc",Dark:"#705746",Steel:"#b7b7ce",Fairy:"#d685ad"
  };
  const LANG_LABEL={en:"EN",es:"ES"};
  const VERSION_PT={
    "red":"Red","blue":"Blue","yellow":"Yellow","gold":"Gold","silver":"Silver","crystal":"Crystal",
    "ruby":"Ruby","sapphire":"Sapphire","emerald":"Emerald","firered":"FireRed","leafgreen":"LeafGreen",
    "diamond":"Diamond","pearl":"Pearl","platinum":"Platinum","heartgold":"HeartGold","soulsilver":"SoulSilver",
    "black":"Black","white":"White","black-2":"Black 2","white-2":"White 2","x":"X","y":"Y",
    "omega-ruby":"Omega Ruby","alpha-sapphire":"Alpha Sapphire","sun":"Sun","moon":"Moon",
    "ultra-sun":"Ultra Sun","ultra-moon":"Ultra Moon","lets-go-pikachu":"Let's Go Pikachu","lets-go-eevee":"Let's Go Eevee",
    "sword":"Sword","shield":"Shield","legends-arceus":"Legends: Arceus","scarlet":"Scarlet","violet":"Violet"
  };

  const reduceMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const $=(sel,root=document)=>root.querySelector(sel);
  const escHtml=s=>typeof esc==="function"?esc(s):String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const pad=n=>String(n||0).padStart(4,"0");
  const now=()=>typeof current!=="undefined"&&current?current:getCurrent();
  const page=$("#page1");
  if(!page)return;
  const editSheet=$("#dexEditSheetBtn");
  const isDexHome=()=>page.classList.contains("active")&&document.documentElement.dataset.sheetMode==="pokedex";

  /* ---------- Preferências do visor ---------- */
  function prefs(){
    if(!state.dexDevice||typeof state.dexDevice!=="object")state.dexDevice={};
    const d=state.dexDevice;
    if(!SECTIONS.some(s=>s.id===d.section))d.section="entry";
    if(!LANG_LABEL[d.lang])d.lang="en";
    d.shiny=!!d.shiny;
    d.folded=!!d.folded;
    if(d.sound==null)d.sound=true;
    d.sound=!!d.sound;
    return d;
  }
  function savePrefs(){
    if(typeof debouncedSave==="function")debouncedSave();
  }

  /* ---------- Som (bipes curtos, gerados na hora) ---------- */
  let audioCtx=null;
  function beep(freq=880,ms=55,type="square",gain=.035){
    if(!prefs().sound)return;
    try{
      audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
      const osc=audioCtx.createOscillator(),vol=audioCtx.createGain();
      osc.type=type;osc.frequency.value=freq;
      vol.gain.setValueAtTime(gain,audioCtx.currentTime);
      vol.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+ms/1000);
      osc.connect(vol).connect(audioCtx.destination);
      osc.start();osc.stop(audioCtx.currentTime+ms/1000+.02);
    }catch(error){}
  }
  const chirp=()=>{beep(1180,40);setTimeout(()=>beep(1560,50),55)};

  /* ---------- Dados da espécie ---------- */
  const speciesCache=new Map();
  let fetchController=null;

  async function loadOfficial(id){
    if(speciesCache.has(id))return speciesCache.get(id);
    fetchController?.abort();
    fetchController=new AbortController();
    const signal=fetchController.signal;
    const [pokemonRes,speciesRes]=await Promise.all([
      fetch(`https://pokeapi.co/api/v2/pokemon/${id}/`,{signal}),
      fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`,{signal})
    ]);
    if(!pokemonRes.ok||!speciesRes.ok)throw new Error("PokéAPI indisponível");
    const pokemon=await pokemonRes.json(),species=await speciesRes.json();
    const clean=t=>String(t||"").replace(/[\f\n\r­]+/g," ").replace(/\s+/g," ").trim();
    const entries={};
    (species.flavor_text_entries||[]).forEach(e=>{
      const lang=e.language?.name==="es-419"?"es":e.language?.name;
      if(!LANG_LABEL[lang])return;
      const text=clean(e.flavor_text);
      const list=entries[lang]||(entries[lang]=[]);
      if(!list.some(x=>x.text===text))list.push({text,version:VERSION_PT[e.version?.name]||e.version?.name||""});
    });
    Object.values(entries).forEach(list=>list.reverse()); // mais recente primeiro
    const genus={};
    (species.genera||[]).forEach(g=>{if(LANG_LABEL[g.language?.name])genus[g.language.name]=g.genus;});
    const data={
      official:true,
      id,
      entries,
      genus,
      height:Number(pokemon.height||0)/10,
      weight:Number(pokemon.weight||0)/10,
      generation:String(species.generation?.name||"").replace("generation-","").toUpperCase(),
      habitat:species.habitat?.name||"",
      legendary:!!species.is_legendary,
      mythical:!!species.is_mythical,
      cry:pokemon.cries?.latest||pokemon.cries?.legacy||"",
      cryLegacy:pokemon.cries?.legacy||""
    };
    speciesCache.set(id,data);
    return data;
  }

  function customSpeciesFor(p){
    const sid=p?.apiData?.integratedSpeciesId;
    if(!sid||typeof INTEGRATED_CUSTOM_SPECIES==="undefined")return null;
    return INTEGRATED_CUSTOM_SPECIES.find(s=>s.id===sid)||null;
  }

  function localEntry(p){
    const sp=customSpeciesFor(p);
    const parts=[];
    if(sp?.notes)parts.push(sp.notes);
    const abilityName=sp?.ability?.name||p.abilityName;
    const abilityText=sp?.ability?.description||p.abilityText;
    if(abilityText)parts.push(`${abilityName||"Ability"}: ${abilityText}`);
    if(sp?.evolution?.method)parts.push(sp.evolution.method);
    return {
      official:false,
      entries:{pt:[{text:parts.join(" ")||"Registro de campo ainda vazio. Este Pokémon não consta no banco oficial.",version:sp?"Banco H&H":"Registro manual"}]},
      genus:{pt:sp?.classification?`Pokémon ${sp.classification}`:"Pokémon não catalogado"},
      height:0,weight:0,generation:"",habitat:"",cry:""
    };
  }

  /* ---------- Montagem do aparelho ---------- */
  let root=null;
  let typingTimer=0,typingFull="",typingEl=null;
  let entryIndex=0;
  let lastId=null;
  let info=null;

  function build(){
    if(root)return root;
    root=document.createElement("section");
    root.className="dex-device";
    root.id="dexDevice";
    root.tabIndex=0;
    root.setAttribute("aria-label","Pokédex • use as setas para navegar, A para o grito e B para a narração");
    root.innerHTML=`
      <div class="dex-half dex-left">
        <div class="dex-left-top">
          <span class="dex-top-leds" aria-hidden="true"><i class="r"></i><i class="y"></i><i class="g"></i></span>
          <span class="dex-device-title">VISOR DE REGISTRO<small>← → SEÇÕES • ↑ ↓ POKÉMON</small></span>
          <button class="dex-fold-btn" type="button" data-dex="fold" aria-expanded="true" aria-controls="dexScreen dexBody">
            <span class="dex-fold-icon">▾</span><span class="dex-fold-text">FECHAR</span>
          </button>
        </div>
        <div class="dex-screen-bezel">
          <span class="dex-bezel-leds" aria-hidden="true"><i></i><i></i></span>
          <div class="dex-screen" id="dexScreen">
            <div class="dex-screen-grid" aria-hidden="true"></div>
            <div class="dex-sprite-wrap">
              <img class="dex-sprite" id="dexSprite" alt="" draggable="false" />
              <span class="dex-sprite-empty" id="dexSpriteEmpty">SEM IMAGEM</span>
            </div>
            <span class="dex-scanline" aria-hidden="true"></span>
            <div class="dex-screen-hud">
              <span id="dexNumber">Nº 0000</span>
              <span class="dex-hud-flags" id="dexFlags"></span>
            </div>
            <div class="dex-screen-status" id="dexStatus">AGUARDANDO</div>
          </div>
          <div class="dex-bezel-foot">
            <span class="dex-red-button" aria-hidden="true"></span>
            <span class="dex-grill" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          </div>
        </div>
        <div class="dex-controls">
          <div class="dex-dpad" role="group" aria-label="Direcional">
            <button type="button" class="up" data-dex="up" aria-label="Pokémon anterior">▲</button>
            <button type="button" class="left" data-dex="left" aria-label="Seção anterior">◀</button>
            <button type="button" class="center" data-dex="scan" aria-label="Escanear de novo"></button>
            <button type="button" class="right" data-dex="right" aria-label="Próxima seção">▶</button>
            <button type="button" class="down" data-dex="down" aria-label="Próximo Pokémon">▼</button>
          </div>
          <div class="dex-ident">
            <div class="dex-ident-screen">
              <b id="dexName">—</b>
              <small id="dexGenus">—</small>
            </div>
            <div class="dex-pills">
              <button type="button" data-dex="shiny" class="dex-pill" id="dexShinyBtn" aria-pressed="false">★ SHINY</button>
              <button type="button" data-dex="sound" class="dex-pill" id="dexSoundBtn" aria-pressed="true">♪ SOM</button>
            </div>
          </div>
          <div class="dex-ab">
            <button type="button" class="dex-btn-b" data-dex="voice" title="B • Narrar o registro"><b>B</b><small>VOZ</small></button>
            <button type="button" class="dex-btn-a" data-dex="cry" title="A • Tocar o grito"><b>A</b><small>GRITO</small></button>
          </div>
        </div>
      </div>
      <div class="dex-hinge" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="dex-half dex-right">
        <div class="dex-data-screen">
          <nav class="dex-tabs" role="tablist" aria-label="Seções da Pokédex">
            ${SECTIONS.map(s=>`<button type="button" role="tab" data-section="${s.id}"><span>${s.label}</span><small>${s.short}</small></button>`).join("")}
          </nav>
          <div class="dex-body" id="dexBody" role="tabpanel" aria-live="polite"></div>
        </div>
        <div class="dex-info-row">
          <div class="dex-lcd"><small>ALTURA</small><b id="dexHeight">—</b></div>
          <div class="dex-lcd"><small>PESO</small><b id="dexWeight">—</b></div>
          <div class="dex-lcd"><small>GERAÇÃO</small><b id="dexGen">—</b></div>
        </div>
        <div class="dex-keypad" id="dexKeypad" aria-label="Equipe"></div>
      </div>`;
    page.prepend(root);
    bindEvents();
    return root;
  }

  /* ---------- Eventos ---------- */
  function bindEvents(){
    root.addEventListener("click",event=>{
      const tab=event.target.closest(".dex-tabs [data-section]");
      if(tab){setSection(tab.dataset.section);return;}
      const key=event.target.closest("[data-pokemon-id]");
      if(key){switchPokemon(key.dataset.pokemonId);return;}
      const btn=event.target.closest("[data-dex]");
      if(btn){press(btn.dataset.dex,btn);return;}
      if(event.target.closest(".dex-typing"))finishTyping();
    });

    root.addEventListener("keydown",event=>{
      if(event.target.matches("input,textarea,select,[contenteditable]"))return;
      const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",a:"cry",A:"cry",b:"voice",B:"voice",s:"shiny",S:"shiny"};
      const action=map[event.key];
      if(!action)return;
      event.preventDefault();
      const btn=root.querySelector(`[data-dex="${action}"]`);
      press(action,btn);
    });
  }

  function flashButton(btn){
    if(!btn)return;
    btn.classList.remove("is-pressed");void btn.offsetWidth;btn.classList.add("is-pressed");
    setTimeout(()=>btn.classList.remove("is-pressed"),180);
  }

  function press(action,btn){
    if(!root||!isDexHome())return;
    flashButton(btn);
    const d=prefs();
    switch(action){
      case "left":stepSection(-1);break;
      case "right":stepSection(1);break;
      case "up":stepPokemon(-1);break;
      case "down":stepPokemon(1);break;
      case "scan":beep(660,60);scan(true);break;
      case "cry":playCry();break;
      case "voice":narrate();break;
      case "shiny":
        d.shiny=!d.shiny;savePrefs();chirp();
        renderSprite(true);syncPills();break;
      case "sound":
        d.sound=!d.sound;savePrefs();if(d.sound)chirp();syncPills();break;
      case "fold":
        d.folded=!d.folded;savePrefs();beep(d.folded?420:760,70);syncFold();break;
      case "lang":
        d.lang=d.lang==="en"?"es":"en";entryIndex=0;savePrefs();beep(980,40);
        renderIdentity();renderSection(true);break;
      case "entry-prev":case "entry-next":{
        const list=currentEntries();
        if(list.length>1){
          entryIndex=(entryIndex+(action==="entry-next"?1:-1)+list.length)%list.length;
          beep(1040,35);renderSection(true);
        }
        break;
      }
    }
  }

  /* ---------- Navegação ---------- */
  function setSection(id,{sound=true}={}){
    if(!root)return;
    const d=prefs();
    if(d.section===id){if(sound)beep(700,30);return;}
    d.section=id;savePrefs();
    if(sound)beep(980,40);
    renderSection(true);
  }
  function stepSection(dir){
    const i=SECTIONS.findIndex(s=>s.id===prefs().section);
    setSection(SECTIONS[(i+dir+SECTIONS.length)%SECTIONS.length].id);
  }

  function orderedPokemon(){
    const all=Array.isArray(state.pokemon)?state.pokemon:[];
    const team=all.filter(p=>(p.storageGroup||"team")==="team");
    const box=all.filter(p=>(p.storageGroup||"team")!=="team");
    return [...team,...box];
  }
  function stepPokemon(dir){
    const list=orderedPokemon();
    if(list.length<2){beep(220,90,"sawtooth",.025);nudge(dir);return;}
    const i=Math.max(0,list.findIndex(p=>p.id===state.currentId));
    switchPokemon(list[(i+dir+list.length)%list.length].id);
  }
  function nudge(dir){
    const screen=$("#dexScreen");
    if(!screen||reduceMotion())return;
    screen.style.setProperty("--nudge",dir>0?"6px":"-6px");
    screen.classList.remove("is-nudged");void screen.offsetWidth;screen.classList.add("is-nudged");
  }
  function switchPokemon(id){
    if(!id||id===state.currentId){beep(700,30);return;}
    chirp();
    state.currentId=id;
    current=getCurrent();
    renderAll();
    if(typeof debouncedSave==="function")debouncedSave();
  }

  /* ---------- Desenho ---------- */
  function typesOf(p){
    const norm=typeof normalizeTypeName==="function"?normalizeTypeName:(t=>t);
    return [...new Set([norm(p.type1),norm(p.type2)].filter(Boolean))];
  }
  function typeBadge(t){
    return typeof typeIconHtml==="function"?typeIconHtml(t,true):`<span class="tag">${escHtml(t)}</span>`;
  }

  function currentEntries(){
    if(!info)return [];
    const d=prefs();
    return info.entries[d.lang]||info.entries.en||info.entries.pt||Object.values(info.entries)[0]||[];
  }
  function currentGenus(){
    if(!info)return "";
    const d=prefs();
    return info.genus[d.lang]||info.genus.en||info.genus.pt||"";
  }

  function renderSprite(animate){
    const p=now();
    const img=$("#dexSprite"),empty=$("#dexSpriteEmpty");
    if(!img)return;
    const d=prefs();
    const officialId=typeof officialPokedexId==="function"?officialPokedexId(p):0;
    const canShiny=!!officialId;
    const src=typeof displayPokemonImage==="function"
      ?displayPokemonImage(p,{shiny:d.shiny&&canShiny})
      :(p.imageUrl||"");
    $("#dexShinyBtn")?.toggleAttribute("disabled",!canShiny);
    if(!src){img.hidden=true;empty.hidden=false;return;}
    img.onerror=()=>{img.hidden=true;empty.hidden=false;};
    img.onload=()=>{img.hidden=false;empty.hidden=true;};
    if(img.getAttribute("src")!==src)img.src=src;
    else{img.hidden=false;empty.hidden=true;}
    if(animate&&!reduceMotion()){
      img.classList.remove("is-sparkle");void img.offsetWidth;
      if(d.shiny&&canShiny)img.classList.add("is-sparkle");
    }
    root.classList.toggle("is-shiny",d.shiny&&canShiny);
  }

  function renderIdentity(){
    const p=now();
    const types=typesOf(p);
    const tint=TYPE_TINT[types[0]]||"#59cfff";
    const tint2=TYPE_TINT[types[1]]||tint;
    root.style.setProperty("--dex-tint",tint);
    root.style.setProperty("--dex-tint-2",tint2);
    $("#dexNumber").textContent=Number(String(p.dex||"").replace(/\D/g,""))?`Nº ${pad(String(p.dex).replace(/\D/g,""))}`:"Nº ----";
    $("#dexName").textContent=(p.name||"Sem nome").toUpperCase();
    $("#dexGenus").textContent=currentGenus()||(info?"—":"CONSULTANDO…");
    const flags=[];
    if(info?.legendary)flags.push('<span class="flag legend">LENDÁRIO</span>');
    if(info?.mythical)flags.push('<span class="flag myth">MÍTICO</span>');
    if(p.apiData?.custom)flags.push('<span class="flag fake">FAKEMON</span>');
    flags.push(`<span class="flag lv">LV ${Number(p.level||1)}</span>`);
    $("#dexFlags").innerHTML=flags.join("");
    $("#dexHeight").innerHTML=info?.height?`${info.height.toFixed(1).replace(".",",")}<small> m</small>`:"—";
    $("#dexWeight").innerHTML=info?.weight?`${info.weight.toFixed(1).replace(".",",")}<small> kg</small>`:"—";
    $("#dexGen").textContent=info?.generation||(p.apiData?.custom?"H&H":"—");
  }

  function renderKeypad(){
    const pad=$("#dexKeypad");
    const list=orderedPokemon().slice(0,10);
    pad.innerHTML=list.map((p,i)=>{
      const src=typeof displayPokemonImage==="function"?displayPokemonImage(p):(p.imageUrl||"");
      const active=p.id===state.currentId;
      return `<button type="button" class="dex-key${active?" active":""}" data-pokemon-id="${escHtml(p.id)}"
        title="${escHtml(p.name||"Pokémon")} • Lv. ${Number(p.level||1)}" aria-pressed="${active}">
        <span class="dex-key-num">${String(i+1).padStart(2,"0")}</span>
        ${src?`<img src="${escHtml(src)}" alt="" loading="lazy" draggable="false">`:'<span class="dex-key-ball">◓</span>'}
      </button>`;
    }).join("")+Array.from({length:Math.max(0,5-list.length)},()=>'<span class="dex-key empty" aria-hidden="true"></span>').join("");
  }

  function syncTabs(){
    const d=prefs();
    root.querySelectorAll(".dex-tabs [data-section]").forEach(tab=>{
      const on=tab.dataset.section===d.section;
      tab.classList.toggle("active",on);
      tab.setAttribute("aria-selected",String(on));
    });
  }
  function syncPills(){
    const d=prefs();
    $("#dexShinyBtn")?.setAttribute("aria-pressed",String(d.shiny));
    $("#dexSoundBtn")?.setAttribute("aria-pressed",String(d.sound));
    $("#dexSoundBtn")&&($("#dexSoundBtn").textContent=d.sound?"♪ SOM":"✕ MUDO");
  }
  function syncFold(){
    const d=prefs();
    root.classList.toggle("is-folded",d.folded);
    const button=$(".dex-fold-btn",root);
    button.setAttribute("aria-expanded",String(!d.folded));
    button.setAttribute("aria-label",d.folded?"Abrir visor da Pokédex":"Fechar visor da Pokédex");
    const text=$(".dex-fold-text",root),icon=$(".dex-fold-icon",root);
    if(text)text.textContent=d.folded?"ABRIR":"FECHAR";
    if(icon)icon.textContent=d.folded?"▸":"▾";
  }

  /* Seções do visor direito */
  function sectionHtml(id){
    const p=now();
    if(id==="entry"){
      const list=currentEntries();
      const entry=list[entryIndex]||list[0];
      const d=prefs();
      const langBtn=info?.official?`<button type="button" class="dex-chip" data-dex="lang" title="Trocar idioma do registro">${LANG_LABEL[d.lang]} ⇄ ${d.lang==="en"?"ES":"EN"}</button>`:"";
      const nav=list.length>1?`<span class="dex-entry-nav">
          <button type="button" class="dex-chip" data-dex="entry-prev" aria-label="Registro anterior">‹</button>
          <span>${entryIndex+1}/${list.length}</span>
          <button type="button" class="dex-chip" data-dex="entry-next" aria-label="Próximo registro">›</button>
        </span>`:"";
      const notes=String(p.notes||"").trim();
      return `
        <div class="dex-entry-head">
          <span class="dex-kicker">${entry?.version?escHtml(entry.version.toUpperCase()):"REGISTRO"}</span>
          <span class="dex-entry-tools">${nav}${langBtn}</span>
        </div>
        <p class="dex-typing" title="Clique para mostrar o texto todo">${info?"":'<span class="dex-loading">CONSULTANDO BANCO DE DADOS<i>.</i><i>.</i><i>.</i></span>'}</p>
        ${notes?`<div class="dex-notes"><span class="dex-kicker">NOTAS DO TREINADOR</span><p>${escHtml(notes)}</p></div>`:""}`;
    }
    if(id==="stats"){
      const stats=p.stats||{};
      const values=(typeof STAT_KEYS!=="undefined"?STAT_KEYS.map(([k])=>k):Object.keys(STAT_SHORT)).map(k=>[k,Number(stats[k]||0)]);
      const top=Math.max(100,Math.ceil(Math.max(...values.map(v=>v[1]),1)*1.12/25)*25);
      const total=values.reduce((a,[,v])=>a+v,0);
      const hp=Math.max(0,Number(p.currentHp||0)),hpMax=Math.max(1,Number(p.maxHp||1));
      return `
        <div class="dex-stat-list">
          ${values.map(([k,v],i)=>`
            <div class="dex-stat" style="--stat-color:${STAT_COLORS[k]};--stat-pct:${Math.min(100,v/top*100)}%;--i:${i}">
              <span class="dex-stat-name">${STAT_SHORT[k]}${p.naturePlus===k?' <em class="up">▲</em>':""}${p.natureMinus===k?' <em class="down">▼</em>':""}</span>
              <span class="dex-stat-bar"><i></i></span>
              <b class="dex-stat-value" data-count="${v}">${v}</b>
            </div>`).join("")}
        </div>
        <div class="dex-stat-foot">
          <span>TOTAL <b data-count="${total}">${total}</b></span>
          <span>NATURE <b>${escHtml((p.natureName||"—").toUpperCase())}</b></span>
          <span>HP <b>${hp}/${hpMax}</b></span>
        </div>`;
    }
    if(id==="types"){
      const types=typesOf(p);
      if(!types.length)return '<p class="dex-empty">Nenhuma tipagem definida.</p>';
      const groups={x4:[],x2:[],half:[],quarter:[],zero:[]};
      if(typeof POKEMON_TYPES!=="undefined"&&typeof defensiveMultiplier==="function"){
        POKEMON_TYPES.forEach(t=>{
          const m=defensiveMultiplier(t,types);
          if(m===0)groups.zero.push(t);
          else if(m>=4)groups.x4.push(t);
          else if(m===2)groups.x2.push(t);
          else if(m===.5)groups.half.push(t);
          else if(m<=.25)groups.quarter.push(t);
        });
      }
      const row=(label,cls,list)=>list.length?`<div class="dex-type-row ${cls}"><span>${label}</span><div>${list.map(typeBadge).join("")}</div></div>`:"";
      return `
        <div class="dex-type-main">${types.map(t=>`<span class="dex-type-big" style="--t:${TYPE_TINT[t]||"#888"}">${escHtml(t.toUpperCase())}</span>`).join("")}</div>
        ${row("FRACO<small>dano ×4</small>","bad",groups.x4)}
        ${row("FRACO<small>dano ×2</small>","bad",groups.x2)}
        ${row("RESISTE<small>dano ×0,5</small>","good",groups.half)}
        ${row("RESISTE<small>dano ×0,25</small>","good",groups.quarter)}
        ${row("IMUNE<small>dano ×0</small>","immune",groups.zero)}`;
    }
    if(id==="moves"){
      const moves=Array.isArray(p.moves)?p.moves:[];
      const active=moves.filter(m=>m.active);
      if(!active.length)return `<p class="dex-empty">Nenhum golpe equipado. ${moves.length} na memória.</p>`;
      return `
        <ol class="dex-move-list">
          ${active.map((m,i)=>{
            const dice=typeof powerToDice==="function"?powerToDice(m.power):"";
            return `<li style="--i:${i};--t:${TYPE_TINT[normalizeTypeName?.(m.type)]||"#888"}">
              <b>${escHtml(m.name||"—")}</b>
              <span class="dex-move-meta">${typeBadge(m.type)}<em>${escHtml((m.category||"—").toUpperCase())}</em>${Number(m.power)>0?`<em>PWR ${Number(m.power)}</em>`:""}${dice&&dice!=="—"?`<em>${dice}</em>`:""}</span>
            </li>`;
          }).join("")}
        </ol>
        <p class="dex-foot-note">${active.length}/5 equipados • ${moves.length} na memória</p>`;
    }
    if(id==="ability"){
      return `
        <div class="dex-ability">
          <span class="dex-kicker">ABILITY</span>
          <h4>${escHtml(p.abilityName||"Sem Ability")}</h4>
          <p>${escHtml(p.abilityText||"Nenhum efeito registrado.")}</p>
        </div>
        <div class="dex-ability held">
          <span class="dex-kicker">ITEM SEGURADO</span>
          <h4>${escHtml(p.heldItem||"Nenhum item")}</h4>
        </div>`;
    }
    return "";
  }

  function renderSection(animate){
    const body=$("#dexBody");
    if(!body)return;
    clearInterval(typingTimer);
    typingEl=null;
    const d=prefs();
    syncTabs();
    body.dataset.section=d.section;
    body.innerHTML=sectionHtml(d.section);
    if(animate&&!reduceMotion()){
      body.classList.remove("is-switching");void body.offsetWidth;body.classList.add("is-switching");
    }
    if(d.section==="entry"&&info){
      const entry=currentEntries()[entryIndex]||currentEntries()[0];
      typeText($(".dex-typing",body),entry?.text||"",animate);
    }
    if(d.section==="stats"&&animate)countUp(body);
  }

  function typeText(el,text,animate){
    clearInterval(typingTimer);
    typingEl=el;typingFull=text;
    if(!el)return;
    if(!animate||reduceMotion()){el.textContent=text;return;}
    el.textContent="";
    el.classList.add("is-typing");
    let i=0;
    typingTimer=setInterval(()=>{
      i+=2;
      el.textContent=text.slice(0,i);
      if(i%6===0)beep(1900+Math.random()*300,12,"square",.012);
      if(i>=text.length)finishTyping();
    },22);
  }
  function finishTyping(){
    clearInterval(typingTimer);
    if(typingEl){typingEl.textContent=typingFull;typingEl.classList.remove("is-typing");}
  }

  function countUp(scope){
    scope.querySelectorAll("[data-count]").forEach(el=>{
      const target=Number(el.dataset.count||0);
      const t0=performance.now(),dur=650;
      const step=t=>{
        const k=Math.min(1,(t-t0)/dur);
        el.textContent=String(Math.round(target*(1-Math.pow(1-k,3))));
        if(k<1)requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* ---------- Escaneamento ---------- */
  let scanTimer=0;
  function scan(force){
    const screen=$("#dexScreen"),status=$("#dexStatus");
    if(!screen)return;
    clearTimeout(scanTimer);
    if(reduceMotion()){status.textContent="REGISTRADO";return;}
    screen.classList.remove("is-scanning","is-registered");void screen.offsetWidth;
    screen.classList.add("is-scanning");
    status.textContent="ESCANEANDO…";
    root.classList.add("is-busy");
    if(force!==false)beep(520,80,"triangle",.03);
    scanTimer=setTimeout(()=>{
      screen.classList.remove("is-scanning");
      screen.classList.add("is-registered");
      if(!status.classList.contains("is-alert"))status.textContent="REGISTRADO";
      root.classList.remove("is-busy");
      chirp();
    },1150);
  }

  /* ---------- Grito e narração ---------- */
  let cryAudio=null;
  function setSpeaking(on){
    root.classList.toggle("is-speaking",on);
    document.querySelector(".full-pokedex-camera")?.classList.toggle("is-speaking",on);
  }
  function playCry(){
    const url=info?.cry;
    if(!url){beep(220,120,"sawtooth",.03);toast(info?.official?"Grito indisponível.":"Este Pokémon não tem grito registrado.");return;}
    try{
      cryAudio?.pause();
      cryAudio=new Audio(url);
      cryAudio.volume=.55;
      setSpeaking(true);
      cryAudio.onended=cryAudio.onerror=()=>setSpeaking(false);
      cryAudio.play().catch(()=>{
        if(info.cryLegacy&&url!==info.cryLegacy){
          cryAudio=new Audio(info.cryLegacy);cryAudio.volume=.55;
          cryAudio.onended=cryAudio.onerror=()=>setSpeaking(false);
          cryAudio.play().catch(()=>{setSpeaking(false);toast("Este navegador não tocou o grito.");});
        }else{setSpeaking(false);toast("Este navegador não tocou o grito.");}
      });
    }catch(error){setSpeaking(false);}
  }
  function narrate(){
    const synth=window.speechSynthesis;
    if(!synth){toast("Narração indisponível neste navegador.");return;}
    if(synth.speaking){synth.cancel();setSpeaking(false);return;}
    const p=now();
    const d=prefs();
    const entry=currentEntries()[entryIndex]||currentEntries()[0];
    const lang=info?.official?(d.lang==="es"?"es-ES":"en-US"):"pt-BR";
    const text=[p.name,currentGenus(),entry?.text].filter(Boolean).join(". ");
    const utter=new SpeechSynthesisUtterance(text);
    utter.lang=lang;utter.rate=1.02;utter.pitch=.82;
    const voice=synth.getVoices().find(v=>v.lang?.toLowerCase().startsWith(lang.slice(0,2).toLowerCase()));
    if(voice)utter.voice=voice;
    utter.onstart=()=>setSpeaking(true);
    utter.onend=utter.onerror=()=>setSpeaking(false);
    if(prefs().section!=="entry")setSection("entry",{sound:false});
    synth.speak(utter);
  }

  function toast(message){
    const status=$("#dexStatus");
    if(!status)return;
    status.textContent=message.toUpperCase();
    status.classList.add("is-alert");
    clearTimeout(toast.t);
    toast.t=setTimeout(()=>{status.classList.remove("is-alert");status.textContent="REGISTRADO";},2400);
  }

  /* ---------- Atualização ---------- */
  async function refresh({newPokemon=false}={}){
    if(!isDexHome()){
      if(lastId!==null){
        lastId=null;
        fetchController?.abort();
        finishTyping();
        clearTimeout(scanTimer);
        root.classList.remove("is-busy");
        $("#dexScreen",root).classList.remove("is-scanning");
        window.speechSynthesis?.cancel();
        cryAudio?.pause();
        setSpeaking(false);
      }
      return;
    }
    build();
    const p=now();
    const id=p?.id;
    const changed=newPokemon||id!==lastId;
    lastId=id;

    if(changed){
      entryIndex=0;
      window.speechSynthesis?.cancel();
      cryAudio?.pause();
      setSpeaking(false);
      const officialId=typeof officialPokedexId==="function"?officialPokedexId(p):0;
      info=officialId?(speciesCache.get(officialId)||null):localEntry(p);
      renderAll_();
      scan(false);
      if(officialId&&!info){
        try{
          const data=await loadOfficial(officialId);
          if(!isDexHome()||now()?.id!==id)return;
          info=data;
        }catch(error){
          if(error.name==="AbortError"||!isDexHome()||now()?.id!==id)return;
          info=localEntry(p);
          toast("Sem conexão com a PokéAPI");
        }
        renderIdentity();
        renderSection(true);
      }
    }else{
      // Mesma ficha, outro dado mudou (stats, golpes, nome...): atualiza sem reescanear.
      syncFold();
      syncPills();
      renderIdentity();
      renderKeypad();
      const d=prefs();
      if(d.section!=="entry"||$("#dexBody").dataset.section!==d.section)renderSection(false);
      renderSprite(false);
    }
  }
  function renderAll_(){
    syncFold();
    syncPills();
    renderIdentity();
    renderSprite(true);
    renderKeypad();
    renderSection(true);
  }

  /* ---------- Ligar / desligar ---------- */
  function playBoot(){
    if(reduceMotion())return Promise.resolve();
    return new Promise(resolve=>{
      const overlay=document.createElement("div");
      overlay.className="dex-boot";
      overlay.innerHTML=`
        <div class="dex-boot-top"><span class="dex-boot-lens"></span><span class="dex-boot-leds"><i></i><i></i><i></i></span></div>
        <div class="dex-boot-bottom">
          <div class="dex-boot-screen">
            <b>H&amp;H DEX-03</b>
            <span class="dex-boot-line">INICIANDO SISTEMA</span>
            <span class="dex-boot-bar"><i></i></span>
            <small>Toque para pular</small>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      let done=false;
      const finish=()=>{
        if(done)return;done=true;
        overlay.classList.add("is-opening");
        chirp();
        setTimeout(()=>{overlay.remove();resolve();},520);
      };
      overlay.addEventListener("click",finish);
      [0,180,360].forEach((t,i)=>setTimeout(()=>beep(660+i*220,60),t+150));
      setTimeout(()=>{const line=$(".dex-boot-line",overlay);if(line)line.textContent="CARREGANDO REGISTROS";},700);
      setTimeout(finish,1650);
    });
  }

  if(typeof window.setSheetPokedexMode==="function"){
    const original=window.setSheetPokedexMode;
    let powerOffTimer=0;
    window.setSheetPokedexMode=function(enabled){
      clearTimeout(powerOffTimer);
      root?.classList.remove("is-powering-off");
      const was=!!state.sheetPokedexMode;
      const apply=()=>{
        const restoreFocus=!enabled&&document.activeElement===editSheet;
        const result=original.call(this,enabled);
        if(!was&&enabled&&isDexHome()){
          build();
          playBoot().then(()=>refresh());
        }else{
          refresh();
        }
        if(restoreFocus)$("#sumScreen [data-sum-tab].active")?.focus({preventScroll:true});
        return result;
      };
      if(was&&!enabled&&root&&isDexHome()&&!prefs().folded&&!reduceMotion()){
        root.classList.add("is-powering-off");
        beep(440,90,"triangle");setTimeout(()=>beep(220,140,"triangle"),90);
        powerOffTimer=setTimeout(()=>{
          root.classList.remove("is-powering-off");
          apply();
        },380);
        return;
      }
      return apply();
    };
    editSheet?.addEventListener("click",()=>window.setSheetPokedexMode(false));
  }

  document.addEventListener("hh:pagechange",()=>refresh());
  document.addEventListener("hh:pokemonchange",()=>refresh({newPokemon:true}));
  document.addEventListener("hh:render",()=>refresh());

  // Estado inicial (a ficha pode abrir já no Modo Pokédex).
  prefs();
  refresh();

  // API pequena para testes e para quem quiser chamar de fora.
  window.hhDexDevice={refresh,press,setSection,playBoot};
})();
