/* ============================================================
   V7 — Arena Online
   Lobby em tempo real para desafiar amigos e assistir batalhas,
   numa tela própria (botão ⚔ Arena no topo), sem ocupar a ficha.

   Rede: Supabase Realtime (presença + mensagens), canal por sala.
   Nada é gravado no banco e a batalha não altera a ficha: cada
   jogador leva uma cópia do time (até 6, na ordem da ficha) e
   começa com HP cheio. Quem desafia é o anfitrião: ele resolve os
   turnos com scripts/arena-engine-v7.js e manda o resultado a todos.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined"||!window.hhArenaEngine)return;

  const SB_URL="https://eoteckuikfmhfmkbbndc.supabase.co";
  const SB_KEY="sb_publishable_a7zlErG9omVgrP_W9MK-4w_yjvP3Qd8";
  const SB_JS="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const ls={get(k,d=""){try{return localStorage.getItem(k)??d;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const buzz=ms=>{try{navigator.vibrate?.(ms);}catch(e){}};
  const uidShort=()=>Math.random().toString(36).slice(2,10);
  const normRoom=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9-]/g,"").slice(0,24)||"geral";
  const typeColor=t=>{try{return moveTypePalette(t).main;}catch(e){return "#8a90a0";}};
  const typeDark=t=>{try{return moveTypePalette(t).dark;}catch(e){return "#4a5060";}};

  const me={id:(()=>{let v="";try{v=sessionStorage.getItem("hh_arena_id")||"";}catch(e){}if(!v){v="t"+uidShort();try{sessionStorage.setItem("hh_arena_id",v);}catch(e){}}return v;})(),
    /* O nome na arena é sempre o do personagem do Trainer Card */
    get name(){let n="";try{n=String(ensureTrainerData().name||"").trim();}catch(e){}return (n||"Treinador").slice(0,24);}};
  const engine=window.hhArenaEngine.create({
    statDice:v=>statDice(v),powerToDice:p=>powerToDice(p),
    typeMultiplier:(t,defs)=>defensiveMultiplier(t,defs),normalizeType:t=>normalizeTypeName(t)
  });

  let sb=null,lobby=null,battleCh=null,room=normRoom(new URLSearchParams(location.search).get("arena")||ls.get("hh_arena_room","geral"));
  /* Cenários: os mesmos da Batalha da ficha (assets/arenas) */
  const SCENES=(()=>{try{return Object.entries(COMBAT_ARENAS).map(([v,o])=>({v,label:o.label}));}catch(e){return [{v:"standard",label:"Padrão"}];}})();
  const sceneOk=v=>SCENES.some(x=>x.v===v);
  let scene=(()=>{const v=ls.get("hh_arena_scene");if(v==="random"||sceneOk(v))return v;const c=typeof current!=="undefined"?current?.combatArena:"";return sceneOk(c)?c:"standard";})();
  const pickScene=v=>v==="random"||!sceneOk(v)?SCENES[Math.floor(Math.random()*SCENES.length)].v:v;
  const sceneLabel=v=>SCENES.find(x=>x.v===v)?.label||"Padrão";
  /* Dano: "classic" (regra da ficha) ou "matrix" (🧪 Dano experimental / QD) */
  // V7: o dano por Qualidade (QD) é o dano do sistema — vale em todas as batalhas
  let dmgMode="matrix";
  const DMG_LABEL={classic:"Dano antigo (d6)",matrix:"Dano por Qualidade (QD)"};
  /* Prévia do dano no botão do golpe: quantos dados e qual dado (QD),
     pela Qualidade do ATK/SP.ATK atual contra a DEF/SP.DEF do alvo. */
  const QD_STEPS=["d4","d6","d8","d10","d12","d12+d4","d12+d6","d20"];
  const qualityOf=v=>v<=49?0:v<=75?1:v<=100?2:v<=125?3:v<=150?4:v<=175?5:v<=200?6:v<=225?7:8;
  const pdiceOf=p=>p<=0?0:p<=20?1:p<=40?2:p<=60?3:p<=80?4:p<=100?5:6;
  const stageMul=n=>n>=0?(2+n)/2:2/(2-n);
  function qdPreview(v,mine,move,power){
    try{
      const foe=mine==="p1"?"p2":"p1";
      const A=B.teams[mine][v.sides[mine].active],D=B.teams[foe][v.sides[foe].active];
      if(!A||!D||!power)return null;
      const phys=String(move.category||"").toLowerCase()==="physical";
      const ak=phys?"atk":"spa",dk=phys?"def":"spd";
      const atk=Math.floor(Number(A.stats?.[ak]||0)*stageMul(v.sides[mine].stg?.[ak]||0));
      const def=Math.floor(Number(D.stats?.[dk]||0)*stageMul(v.sides[foe].stg?.[dk]||0));
      const oq=qualityOf(atk),dq=qualityOf(def),gap=oq-dq;
      const mult=defensiveMultiplier(normalizeTypeName(move.type),(D.types||[]).map(normalizeTypeName).filter(Boolean));
      if(mult===0)return {label:"imune",title:"O alvo é imune a esse tipo"};
      let qi=gap<0?0:Math.min(7,gap+1),n=pdiceOf(power);
      if(mult>1){n++;qi=Math.min(7,qi+1);}else if(mult<1){n=Math.max(1,n-1);qi=Math.max(0,qi-1);}
      const qd=QD_STEPS[qi];
      const stab=(A.types||[]).map(normalizeTypeName).includes(normalizeTypeName(move.type));
      const label=qd.split("+").map(x=>`${n}${x}`).join("+")+(stab?"+1d6":"");
      return {label,qd,mult,title:`QD ${qd}: Q${oq} do seu ${phys?"ATK":"SP.ATK"} contra Q${dq} da ${phys?"DEF":"SP.DEF"} do alvo · ${n} dado${n>1?"s":""} de Poder${mult>1?" (super efetivo)":mult<1?" (resistido)":""}${stab?" · STAB +1d6":""}`};
    }catch(e){return null;}
  }
  let people={},chat=[],outgoing=null,incoming=null,myTeamCache=null;
  // batalha atual: {id,role:'p1'|'p2'|'spec',host:bool,state,teams,format,opp,names,playing}
  let B=null;
  /* Desafio Sem Fim: corrida atual (time, HP que sobra entre ondas, onda) */
  let RUN=null,RANK={list:null,loading:false,error:"",mode:"endless"};
  const REG=id=>window.hhArenaSurvival?.REGIONS?.[id]||null;
  const regionBest=id=>Number(state.arenaRegionBest?.[id]||0);
  /* Tentativas: as suas ficam na ficha; as de todos vêm do banco */
  const myAttempts=mode=>Number(state.arenaAttempts?.[mode]||0);
  const triesTxt=n=>`${n} tentativa${n===1?"":"s"}`;
  const SURV=()=>window.hhArenaSurvival;
  const aiRules={typeMultiplier:(t,d)=>defensiveMultiplier(t,d),normalizeType:t=>normalizeTypeName(t)};
  function playerKey(){
    let k=state.arenaPlayerKey||ls.get("hh_arena_pkey");
    if(!k){k="k"+Math.random().toString(36).slice(2)+Date.now().toString(36);}
    if(state.arenaPlayerKey!==k){state.arenaPlayerKey=k;try{(typeof debouncedSave==="function"?debouncedSave:saveState)();}catch(e){}}
    ls.set("hh_arena_pkey",k);return k;
  }

  /* ---------- Carregamento do Supabase ---------- */
  function loadSb(){
    if(window.supabase?.createClient)return Promise.resolve();
    return new Promise((ok,ko)=>{const s=document.createElement("script");s.src=SB_JS;s.onload=ok;s.onerror=()=>ko(new Error("sem conexão"));document.head.appendChild(s);});
  }

  /* ---------- Cópia do time ---------- */
  async function compactImage(src,max=160){
    if(!src)return "";
    try{
      const abs=new URL(src,location.href).href;
      if(!abs.startsWith("data:"))return abs;
      const img=new Image();img.decoding="async";
      await new Promise((ok,ko)=>{img.onload=ok;img.onerror=ko;img.src=abs;});
      const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.naturalWidth*s));c.height=Math.max(1,Math.round(img.naturalHeight*s));
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      return c.toDataURL("image/webp",.82);
    }catch(e){return "";}
  }
  /* Time da arena: o jogador escolhe quais Pokémon levam (até 6) e a ordem;
     sem escolha, vai a Equipe da ficha. */
  const fichaTeam=()=>state.pokemon.filter(p=>(p.storageGroup||"team")==="team").slice(0,6);
  /* A escolha fica na memória, na própria ficha (vai junto no salvamento)
     e, se couber, no navegador. Antes ficava só no navegador: quando o
     armazenamento estava cheio (fichas com muitas artes), o clique não fazia nada. */
  let pickMem=null;
  /* A Equipe da ficha manda: uma escolha própria da Arena só vale enquanto a
     Equipe da ficha continuar a mesma de quando ela foi feita. Se alguém sai
     ou entra pela ficha/PC, a Arena volta a seguir a Equipe. */
  const teamSig=()=>fichaTeam().map(p=>String(p.id)).sort().join("|");
  function pickIds(){
    let ids=pickMem;
    if(!ids&&Array.isArray(state.arenaPick))ids=state.arenaPick;
    if(!ids){try{ids=JSON.parse(ls.get("hh_arena_pick","[]"))||[];}catch(e){ids=[];}}
    if(ids.length&&(state.arenaPickBase||"")!==teamSig()){pickMem=[];state.arenaPick=[];state.arenaPickBase="";try{ls.set("hh_arena_pick","[]");}catch(e){}return [];}
    const known=new Set(state.pokemon.map(p=>String(p.id)));
    return ids.map(String).filter(id=>known.has(id)).slice(0,6);
  }
  function savePick(ids){
    // escolher exatamente a Equipe da ficha não é uma escolha própria
    if(ids.length&&ids.slice().sort().join("|")===teamSig())ids=[];
    pickMem=ids.slice(0,6);
    state.arenaPick=pickMem.slice();
    state.arenaPickBase=pickMem.length?teamSig():"";
    try{(typeof debouncedSave==="function"?debouncedSave:saveState)();}catch(e){}
    ls.set("hh_arena_pick",JSON.stringify(pickMem));
  }
  /* Quem vai é a escolha da arena; a ORDEM é sempre a da ficha (a mesma do
     Trainer Card, da faixa da equipe e do PC). Mudar a ordem aqui muda lá. */
  function teamSource(){
    const ids=pickIds();
    if(!ids.length)return fichaTeam();
    const set=new Set(ids);
    return state.pokemon.filter(p=>set.has(String(p.id))).slice(0,6);
  }
  function applyOrder(ids){
    const set=new Set(ids),by=new Map(state.pokemon.map(p=>[String(p.id),p]));
    const slots=[];state.pokemon.forEach((p,i)=>{if(set.has(String(p.id)))slots.push(i);});
    const next=state.pokemon.slice();
    ids.map(id=>by.get(id)).filter(Boolean).forEach((p,k)=>{if(slots[k]!=null)next[slots[k]]=p;});
    state.pokemon=next;
  }
  function editPick(fn){
    let ids=teamSource().map(p=>String(p.id));
    const before=ids.join("|");
    ids=fn(ids.slice())||ids;
    const sameSet=ids.length===before.split("|").filter(Boolean).length&&ids.every(id=>before.split("|").includes(id));
    if(sameSet&&ids.join("|")!==before){applyOrder(ids);ignoreRender=true;try{if(typeof renderAll==="function")renderAll();}catch(e){}ignoreRender=false;}
    savePick(ids);track();render();
  }
  function localImg(p){try{return displayPokemonImage(p)||"";}catch(e){return "";}}
  function teamPreview(){
    return teamSource().map(p=>{
      let img=displayPokemonImage(p)||"";
      try{img=new URL(img,location.href).href;}catch(e){}
      return {n:p.name,lv:Number(p.level||1),t:[p.type1,p.type2].filter(Boolean),img:img.startsWith("data:")?(thumbs.get(img.length+":"+img.slice(-40))||""):img};
    });
  }
  /* Miniaturas pequenas (56px) das artes enviadas na ficha, para a lista da sala */
  const thumbs=new Map();let thumbBusy=false;
  async function ensureThumbs(){
    if(thumbBusy)return;thumbBusy=true;let changed=false;
    for(const p of teamSource()){
      const img=displayPokemonImage(p)||"";if(!img.startsWith("data:"))continue;
      const k=img.length+":"+img.slice(-40);if(thumbs.has(k))continue;
      thumbs.set(k,await compactImage(img,56));changed=true;
    }
    thumbBusy=false;if(changed){track();render();}
  }
  /* ---------- Gimmicks do Pokémon da ficha ----------
     Mega: formas personalizadas/da Pokédex GM e Megas oficiais da PokéAPI
     (atributos = base da Mega + pontos investidos). Tera: Tera Type da ficha
     (ou o 1º tipo). Z: só com o Cristal Z preparado na ficha. */
  const megaCache=new Map();
  const g_=(name,...a)=>{try{return typeof window[name]==="function"?window[name](...a):undefined;}catch(e){return undefined;}};
  async function officialMegas(p){
    const sp=p.apiData?.speciesName||"";
    if(!sp||p.apiData?.source!=="PokeAPI")return [];
    const k=String(sp).toLowerCase();
    if(megaCache.has(k))return megaCache.get(k);
    const job=(async()=>{
      try{
        const r=await fetch(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(k)}/`);if(!r.ok)return [];
        const sd=await r.json();
        const vars=(sd.varieties||[]).filter(v=>!v.is_default&&/-mega(-[xyz])?$/.test(v.pokemon?.name||""));
        const out=[];
        for(const v of vars){
          try{
            const d=await (await fetch(v.pokemon.url)).json();
            const base={};(d.stats||[]).forEach(x=>{const m={hp:"hp",attack:"atk",defense:"def","special-attack":"spa","special-defense":"spd",speed:"spe"}[x.stat.name];if(m)base[m]=x.base_stat;});
            const ab=(d.abilities||[]).sort((a,b)=>Number(a.slot||0)-Number(b.slot||0)).find(x=>!x.is_hidden)||d.abilities?.[0];
            const abApi=ab?.ability?.name||"";
            out.push({name:g_("formatMegaDisplayName",d.name,sp)||d.name,types:(d.types||[]).map(x=>normalizeTypeName(x.type?.name||"")).filter(Boolean),base,
              ability:g_("officialAbilityEnglishName",abApi)||abApi,abilityText:String(await (g_("fetchAbilityDescription",abApi)||"")||"").slice(0,900),
              img:d.sprites?.other?.["official-artwork"]?.front_default||d.sprites?.front_default||""});
          }catch(e){}
        }
        return out;
      }catch(e){return [];}
    })();
    megaCache.set(k,job);
    return job;
  }
  async function gimmicksOf(p,cur){
    const g=p.gimmicks||{},mg=g.mega||{},tera=g.tera||{},z=g.zMove||{};
    const baseStats=cur.baseStats||{},stats=cur.stats||{};
    const invested=k=>Math.max(0,Number(stats[k]||0)-Number(baseStats[k]||0));
    const withPoints=b=>Object.fromEntries(["hp","atk","def","spa","spd","spe"].map(k=>[k,Number(b?.[k]||0)+invested(k)]));
    const forms=[];
    if(cur.megaNow)forms.push(cur.megaNow);
    else{
      for(const f of (mg.customForms||[]).slice(0,3)){
        if(!f?.name||!f.baseStats)continue;
        const st=withPoints(f.baseStats);
        forms.push({name:f.name,types:[normalizeTypeName(f.type1),normalizeTypeName(f.type2)].filter(Boolean),stats:st,maxHp:Math.max(1,st.hp),ability:f.abilityName||"",abilityText:String(f.abilityText||"").slice(0,900),img:await compactImage(f.imageUrl||"")});
      }
      if(!forms.length)for(const f of (await officialMegas(p)).slice(0,2)){
        const st=withPoints(f.base);
        forms.push({name:f.name,types:f.types,stats:st,maxHp:Math.max(1,st.hp),ability:f.ability,abilityText:f.abilityText,img:f.img});
      }
    }
    return {megaForms:forms,teraType:normalizeTypeName(tera.type)||normalizeTypeName(cur.type1)||"",zType:z.prepared?normalizeTypeName(z.type)||"":""};
  }
  /* Item segurado da ficha → nome, texto (sistema de QD) e automação */
  function heldItemOf(p){
    const name=String(p.heldItem||"").trim();if(!name)return null;
    let rec=null;
    try{const key=normalizeItemSearch(name);rec=(p.itemMemory||[]).find(r=>normalizeItemSearch(r.name)===key||normalizeItemSearch(r.apiName)===key)||null;}catch(e){}
    let off=null;try{off=officialItemByQuery(name);}catch(e){}
    const full=off?.apiName&&typeof POKEAPI_ITEM_BY_SLUG!=="undefined"?POKEAPI_ITEM_BY_SLUG.get(off.apiName):null;
    return {name:rec?.name||full?.name||name,apiName:rec?.apiName||full?.apiName||"",description:String(full?.description||rec?.description||"").slice(0,600),automation:full?.automation||rec?.automation||null};
  }
  // forma por gatilho (Pokédex GM): a Arena troca sozinha quando o gatilho acontece
  async function trigFormOf(p0){
    const f=(p0.triggerForms||[])[0];if(!f)return null;
    let img="";try{img=await compactImage(f.image||"");}catch(e){img=f.image||"";}
    const T=f.trigger||{};
    return {name:f.name,img,types:(f.types||[]).map(normalizeTypeName).filter(Boolean),trigger:{weather:T.weather||[],items:T.items||[],ability:!!T.ability,hpBelow:T.hpBelow||null}};
  }
  async function buildTeam(limit){
    const list=teamSource().slice(0,limit);
    const out=[];
    for(const p0 of list){
      // Se a ficha estiver com Mega ou Tera ligada, a arena começa na forma normal
      // e a Mega/Tera vira o gimmick da batalha.
      let p=p0,megaNow=null;
      const mg=p0.gimmicks?.mega,tr=p0.gimmicks?.tera;
      if(mg?.active&&mg.snapshot){
        const sn=mg.snapshot;
        megaNow={name:p0.name,types:[normalizeTypeName(p0.type1),normalizeTypeName(p0.type2)].filter(Boolean),stats:{...p0.stats},maxHp:Math.max(1,Number(p0.maxHp||p0.stats?.hp||1)),
          ability:p0.abilityName||"",abilityText:String(p0.abilityText||"").slice(0,900),img:await compactImage(displayPokemonImage(p0))};
        p={...p0,name:sn.name,type1:sn.type1,type2:sn.type2,stats:sn.stats,baseStats:sn.baseStats,maxHp:sn.maxHp,abilityName:sn.abilityName,abilityText:sn.abilityText,imageUrl:sn.imageUrl||p0.imageUrl};
      }
      if(tr?.active&&tr.snapshot)p={...p,type1:tr.snapshot.type1,type2:tr.snapshot.type2};
      let gimmick=null;try{gimmick=await gimmicksOf(p0,{...p,megaNow});}catch(e){}
      const moves=(p.moves||[]).filter(m=>m.active&&!(typeof isMoveLevelLocked==="function"&&isMoveLevelLocked(m))).slice(0,5)
        .map(m=>({name:m.name,type:normalizeTypeName(m.type)||"Normal",category:m.category||"Status",power:Number(m.power||0),
          accuracy:m.alwaysHits||m.accuracy==null||m.accuracy===""?null:Number(m.accuracy),alwaysHits:!!m.alwaysHits,desc:String(m.description||"").slice(0,420)}));
      out.push({name:p.name||"Pokémon",level:Number(p.level||1),types:[normalizeTypeName(p.type1),normalizeTypeName(p.type2)].filter(Boolean),
        stats:{hp:Number(p.stats?.hp||0),atk:Number(p.stats?.atk||0),def:Number(p.stats?.def||0),spa:Number(p.stats?.spa||0),spd:Number(p.stats?.spd||0),spe:Number(p.stats?.spe||0)},
        maxHp:Math.max(1,Number(p.maxHp||p.stats?.hp||1)),ability:p.abilityName||"",abilityText:String(p.abilityText||"").slice(0,900),img:await compactImage(p===p0?displayPokemonImage(p,{form:false}):(p.imageUrl||displayPokemonImage(p0,{form:false}))),
        trigForm:await trigFormOf(p0),
        fid:String(p0.id),gimmick,item:heldItemOf(p0),species:String(p0.apiData?.speciesName||p0.apiData?.pokemonName||""),
        moves:moves.length?moves:[{name:"Struggle",type:"Normal",category:"Physical",power:50,accuracy:null,desc:"Sem golpes ativos na ficha."}]});
    }
    return out;
  }

  /* ---------- Interface: casca ---------- */
  const root=document.createElement("section");
  root.id="hhArena";root.className="ar7";root.hidden=true;root.setAttribute("aria-label","Arena Online");
  document.body.appendChild(root);
  function open(){
    root.hidden=false;document.body.classList.add("ar7-open");sfx("page");
    document.getElementById("hhArenaBtn")?.classList.remove("ar9-running");
    connect();render(true);ensureThumbs();
  }
  function close(){
    // Desafio Sem Fim / Abismo: voltar para a ficha só pausa a corrida
    // (dá para comprar itens, mudar a ordem etc. e voltar)
    if(B?.solo&&RUN&&!RUN.over){
      root.hidden=true;document.body.classList.remove("ar7-open");
      document.getElementById("hhArenaBtn")?.classList.add("ar9-running");
      if(typeof showToast==="function")showToast(`${RUN.region?"A descida":"A corrida"} continua pausada: volte pelo botão ⚔ Arena.`);
      return;
    }
    if(B&&B.role!=="spec"&&B.state&&B.state.phase!=="end"&&!confirm("Sair da arena desiste da batalha atual. Sair mesmo?"))return;
    if(B)leaveBattle(true);
    root.hidden=true;document.body.classList.remove("ar7-open");
    disconnect();
  }
  /* A arena acompanha a ficha: ordem da equipe, Bolsa, nome, níveis… */
  let ignoreRender=false,syncT=0;
  const onFichaChange=()=>{
    if(ignoreRender)return;
    clearTimeout(syncT);
    syncT=setTimeout(()=>{
      if(lobby&&(!B||RUN))track();
      if(root.hidden)return;
      // não redesenha no meio de uma animação nem com campo de texto em uso
      if(B&&(B.playing||B.intro))return;
      const typing=document.activeElement&&root.contains(document.activeElement)&&/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if(!typing)render(true);
    },120);
  };
  document.addEventListener("hh:render",onFichaChange);
  document.addEventListener("hh:pokemonchange",onFichaChange);
  window.hhArena={open,close,get battle(){return B;},get rank(){return RANK;}};

  /* Botão ⚔ Arena no topo (computador e celular) */
  const brand=document.querySelector(".topbar .brand");
  if(brand&&!document.getElementById("hhArenaBtn")){
    brand.insertAdjacentHTML("afterend",`<button type="button" id="hhArenaBtn" class="ar7-open-btn" aria-label="Arena Online: desafie amigos" title="Arena Online: desafie amigos">
      <span class="ar7-open-ico" aria-hidden="true">⚔</span><span class="ar7-open-txt">Arena</span><i class="ar7-open-dot" hidden></i></button>`);
    const btn=document.getElementById("hhArenaBtn");
    btn.addEventListener("click",open);
    // No computador o botão fica junto das ferramentas; no celular, ao lado do ⋮.
    const mq=matchMedia("(min-width:901px)"),tools=document.getElementById("mobileToolsPanel");
    const place=()=>{if(mq.matches&&tools)tools.prepend(btn);else brand.after(btn);};
    place();mq.addEventListener?.("change",place);
  }

  /* ---------- Rede: lobby ---------- */
  let connecting=false,status="off",lastTrackedName="";
  async function connect(){
    if(lobby||connecting)return;
    connecting=true;status="connecting";render();
    try{
      await loadSb();
      sb=sb||window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      lobby=sb.channel("hh-arena:"+room,{config:{presence:{key:me.id},broadcast:{self:false}}});
      lobby.on("presence",{event:"sync"},()=>{
        const st=lobby.presenceState();people={};
        Object.entries(st).forEach(([id,arr])=>{if(arr&&arr[0])people[id]=arr[arr.length-1];});
        if(outgoing&&!people[outgoing.to]){outgoing=null;toast("O treinador saiu do lobby.");}
        render();
      });
      lobby.on("broadcast",{event:"chat"},({payload})=>{chat.push(payload);chat=chat.slice(-60);if(tab!=="chat")unread++;render();if(!root.hidden)sfx("type");});
      lobby.on("broadcast",{event:"challenge"},({payload})=>onChallenge(payload));
      lobby.on("broadcast",{event:"challenge-cancel"},({payload})=>{if(incoming&&incoming.id===payload.id){incoming=null;render();}});
      lobby.on("broadcast",{event:"challenge-reply"},({payload})=>onReply(payload));
      await new Promise((ok,ko)=>lobby.subscribe(st=>{if(st==="SUBSCRIBED")ok();else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT")ko(new Error(st));}));
      status="on";await track();loadRank();
    }catch(e){status="error";lobby=null;}
    connecting=false;render();
  }
  function disconnect(){
    try{lobby&&sb?.removeChannel(lobby);}catch(e){}
    lobby=null;people={};status="off";outgoing=null;incoming=null;
  }
  async function switchRoom(next){
    next=normRoom(next);if(next===room&&lobby)return;
    if(B){toast("Termine a batalha antes de trocar de sala.");return;}
    room=next;ls.set("hh_arena_room",room);disconnect();chat=[];await connect();
  }
  function myStatus(){
    if(RUN)return {status:"survival",wave:RUN.wave,region:RUN.region?.id||"",battle:RUN.ch?RUN.id:""};
    if(!B)return {status:"idle"};
    if(B.role==="spec")return {status:"watch",battle:B.id};
    return {status:"battle",battle:B.id,vs:B.names?.[B.role==="p1"?"p2":"p1"]||""};
  }
  async function track(){
    if(!lobby)return;
    lastTrackedName=me.name;
    try{await lobby.track({id:me.id,name:me.name,team:teamPreview(),at:Date.now(),...myStatus(),names:B?.names||null,ver:window.hhBuild||""});}catch(e){}
  }
  const send=(ch,event,payload)=>ch?.send({type:"broadcast",event,payload});

  /* ---------- Desafios ---------- */
  function challenge(to,format){
    const id="b"+uidShort();
    outgoing={id,to,format,at:Date.now()};
    outgoing.arena=pickScene(scene);outgoing.dmg=dmgMode;
    send(lobby,"challenge",{id,from:me.id,fromName:me.name,to,format,arena:outgoing.arena,dmg:outgoing.dmg});
    sfx("select");render();
    setTimeout(()=>{if(outgoing&&outgoing.id===id){send(lobby,"challenge-cancel",{id});outgoing=null;toast("O desafio expirou.");render();}},45000);
  }
  function onChallenge(p){
    if(p.to!==me.id)return;
    if(B||incoming){send(lobby,"challenge-reply",{id:p.id,to:p.from,from:me.id,accept:false,busy:true});return;}
    incoming=p;sfx("select");buzz([60,40,60]);
    if(root.hidden)document.getElementById("hhArenaBtn")?.querySelector(".ar7-open-dot")?.removeAttribute("hidden");
    render();
  }
  function reply(accept){
    if(!incoming)return;
    const p=incoming;incoming=null;
    send(lobby,"challenge-reply",{id:p.id,to:p.from,from:me.id,accept});
    if(accept)joinBattle({id:p.id,role:"p2",format:p.format,arena:p.arena,dmg:p.dmg,names:{p1:p.fromName,p2:me.name}});
    render();
  }
  function onReply(p){
    if(p.to!==me.id||!outgoing||outgoing.id!==p.id)return;
    const o=outgoing;outgoing=null;
    if(!p.accept){toast(p.busy?"O treinador está ocupado.":"Desafio recusado.");render();return;}
    joinBattle({id:o.id,role:"p1",format:o.format,arena:o.arena,dmg:o.dmg,names:{p1:me.name,p2:people[o.to]?.name||"Rival"}});
  }

  /* ---------- Batalha: rede ---------- */
  async function joinBattle({id,role,format,names,arena,dmg}){
    B={id,role,dmg:"matrix",arena:sceneOk(arena)?arena:"standard",host:role==="p1",format:Number(format)||3,names,state:null,teams:null,pendingTeams:{},specs:{},queue:[],playing:false,log:[],chosen:false};
    for(const k in lastHp)delete lastHp[k];
    sfx("page");render();
    battleCh=sb.channel("hh-arena-b:"+id,{config:{presence:{key:me.id},broadcast:{self:false}}});
    battleCh.on("presence",{event:"sync"},onBattlePresence);
    battleCh.on("broadcast",{event:"team"},({payload})=>{if(B?.host)hostTeam(payload);});
    battleCh.on("broadcast",{event:"action"},({payload})=>{if(B?.host)hostAction(payload.side,payload.action,payload.turn);});
    battleCh.on("broadcast",{event:"sync"},()=>{if(B?.host&&B.state)send(battleCh,"start",{teams:B.teams,state:pub(B.state),names:B.names,format:B.format,arena:B.arena,dmg:B.dmg});});
    battleCh.on("broadcast",{event:"start"},({payload})=>{if(!B||B.host)return;
      // descida do Abismo / Sem Fim: cada andar chega como um "start" novo
      if(payload.fresh&&B.teams&&payload.state?.id!==B.view?.id){B.view=null;B.log=[];B.queue=[];B.playing=false;B.teams=null;for(const k in lastHp)delete lastHp[k];}
      if(!B.teams){B.teams=payload.teams;B.names=payload.names;B.format=payload.format;}
      B.sub=payload.sub||"";if(sceneOk(payload.arena))B.arena=payload.arena;if(payload.dmg)B.dmg=payload.dmg==="classic"?"classic":"matrix";applyState(payload.state,true);});
    battleCh.on("broadcast",{event:"runend"},({payload})=>{if(!B||B.host)return;pushLog([{k:"info",text:payload.text||"A corrida acabou."}]);if(B.view)B.view.phase="end";render(true);});
    battleCh.on("broadcast",{event:"state"},({payload})=>{if(!B||B.host)return;applyState(payload,false);});
    battleCh.on("broadcast",{event:"emote"},({payload})=>showEmote(payload));
    await new Promise(ok=>battleCh.subscribe(st=>{if(st==="SUBSCRIBED")ok();}));
    await battleCh.track({id:me.id,name:me.name,role});
    if(role==="spec")send(battleCh,"sync",{});
    else{
      const team=await buildTeam(B.format);
      if(B.host)hostTeam({side:"p1",id:me.id,name:me.name,team});
      else{
        const sendTeam=()=>{if(B&&!B.teams)send(battleCh,"team",{side:"p2",id:me.id,name:me.name,team});};
        sendTeam();B.resend=setInterval(()=>{if(!B||B.teams)clearInterval(B?.resend);else sendTeam();},2500);
      }
    }
    await track();render();
  }
  function onBattlePresence(){
    if(!B||!battleCh)return;
    const list=Object.values(battleCh.presenceState()).map(a=>a[a.length-1]);
    B.specs=Object.fromEntries(list.filter(x=>x.role==="spec").map(x=>[x.id,x.name]));
    B.seen=B.seen||{};
    const roles=new Set(list.map(x=>x.role));
    roles.forEach(r=>{B.seen[r]=true;});
    // Só conta como saída quem já esteve na sala e continua fora depois de 5 s
    // (a presença pode chegar depois das primeiras mensagens).
    for(const s of ["p1","p2"])if(B.seen[s]&&!roles.has(s)&&!B.gone?.[s]){
      B.gone=B.gone||{};B.gone[s]=setTimeout(()=>checkGone(s),5000);
    }else if(roles.has(s)&&B.gone?.[s]){clearTimeout(B.gone[s]);delete B.gone[s];}
    render();
  }
  function checkGone(s){
    if(!B||!battleCh)return;
    delete B.gone[s];
    const still=Object.values(battleCh.presenceState()).some(a=>a[a.length-1]?.role===s);
    if(still)return;
    if(B.host&&s==="p2"&&B.state&&B.state.phase!=="end"){engine.walkover(B.state,"p2");broadcastState();}
    else if(!B.host&&s==="p1"&&B.view&&B.view.phase!=="end"){B.view.phase="end";B.view.winner=null;pushLog([{k:"hostleft"}]);render();track();}
  }
  function leaveBattle(silent){
    if(!B)return;
    if(B.solo){
      if(RUN&&B.state&&B.state.phase!=="end")endRun("desistiu");
      closeRunCh();B=null;RUN=null;track();if(!silent)render();return;
    }
    if(B.role!=="spec"&&B.state&&B.state.phase!=="end"){
      if(B.host){engine.walkover(B.state,"p1");broadcastState();}
      else send(battleCh,"action",{side:B.role,action:{kind:"forfeit"},turn:B.state.turn});
    }
    clearInterval(B.resend);
    const ch=battleCh;battleCh=null;B=null;
    setTimeout(()=>{try{ch&&sb?.removeChannel(ch);}catch(e){}},600);
    track();if(!silent)render();
  }
  function spectate(id,names){
    if(B)return;
    joinBattle({id,role:"spec",format:3,names});
  }

  /* ---------- Batalha: anfitrião ---------- */
  function hostTeam(p){
    if(!B?.host||B.state)return;
    B.pendingTeams[p.side]={id:p.id,name:p.name,team:p.team};
    if(B.pendingTeams.p1&&B.pendingTeams.p2){
      B.state=engine.newBattle({id:B.id,format:B.format,p1:B.pendingTeams.p1,p2:B.pendingTeams.p2,damage:B.dmg});
      B.teams=B.state.teams;B.names={p1:B.pendingTeams.p1.name,p2:B.pendingTeams.p2.name};
      B.started=true;
      send(battleCh,"start",{teams:B.teams,state:pub(B.state),names:B.names,format:B.format,arena:B.arena,dmg:B.dmg});
      applyState(pub(B.state),true);track();
    }
  }
  function hostAction(side,action,turn){
    if(!B?.host||!B.state)return;
    if(turn!=null&&turn!==B.state.turn&&action.kind!=="forfeit")return;
    let ready=engine.submit(B.state,side,action);
    if(B.solo&&side==="p1"&&!ready)ready=aiAct();
    if(ready){engine.resolve(B.state);broadcastState();if(B.solo)soloFollowUp();}
    else{broadcastState(true);}
  }
  function aiAct(){
    if(!B?.solo||!B.state||B.state.phase==="end")return false;
    if(!engine.canAct(B.state,"p2"))return false;
    const a=SURV()?.choose(B.state,engine,"p2",aiRules);
    return a?engine.submit(B.state,"p2",a):false;
  }
  function soloFollowUp(){
    // o oponente troca sozinho quando o Pokémon dele desmaia
    for(let k=0;k<4&&B?.state?.phase==="switch"&&B.state.sides.p2.needSwitch&&!B.state.sides.p2.pending;k++){
      const ready=aiAct();
      if(ready){engine.resolve(B.state);broadcastState();}else break;
    }
  }
  function pub(s){
    // estado sem os times (que já foram enviados no início)
    return {id:s.id,format:s.format,turn:s.turn,phase:s.phase,winner:s.winner,reason:s.reason,events:s.events||[],
      sides:Object.fromEntries(["p1","p2"].map(k=>[k,{name:s.sides[k].name,active:s.sides[k].active,needSwitch:s.sides[k].needSwitch,ready:!!s.sides[k].pending,
        team:s.sides[k].team.map(t=>({hp:t.hp,maxHp:t.maxHp,fainted:t.fainted,status:t.status||null})),...(engine.view?engine.view(s,k):{})}])),
      weather:s.weather?{...s.weather}:null};
  }
  function broadcastState(waitingOnly){
    const p=pub(B.state);if(waitingOnly)p.events=[];
    send(battleCh,"state",p);applyState(p,false);
    if(!waitingOnly)B.state.events=[];
    if(B.state.phase==="end")track();
  }

  /* ---------- Batalha: ações do jogador ---------- */
  function act(action){
    if(!B||B.role==="spec"||!B.view)return;
    B.chosen=true;B.sel={};B.bagOpen=false;sfx("select");buzz(8);
    if(B.host)hostAction("p1",action,B.view.turn);
    else send(battleCh,"action",{side:B.role,action,turn:B.view.turn});
    render();
  }

  /* ---------- Batalha: animação dos eventos ---------- */
  function applyState(s,initial){
    if(!B)return;
    const events=s.events||[];
    if(initial||!B.view){if(!B.view){B.intro=true;setTimeout(()=>{if(B){B.intro=false;if(!B.playing)render(true);}},2200);}B.view=JSON.parse(JSON.stringify(s));B.view.events=[];if(events.length)pushLog(events);render();return;}
    if(!events.length){
      // só mudou quem já escolheu
      for(const k of ["p1","p2"])B.view.sides[k].ready=s.sides[k].ready;
      B.view.phase=s.phase;render();return;
    }
    B.queue.push(s);
    if(!B.playing)playQueue();
  }
  async function playQueue(){
    if(!B)return;B.playing=true;
    while(B&&B.queue.length){
      const s=B.queue.shift();
      for(const ev of s.events){
        if(!B)return;
        pushLog([ev]);
        applyEventToView(ev);
        if(ev.k==="switch"){B.view.sides[ev.side].active=s.sides[ev.side].active;}
        if(ev.k==="faint"){B.view.sides[ev.side].team[B.view.sides[ev.side].active].fainted=true;}
        if(ev.k==="switch"||ev.k==="gimmick"||(ev.k==="item"&&ev.revived))render(true);else patch();
        if(ev.k==="gimmick"){const el=root.querySelector(`.ar7-mon.${ev.side===mySide()?"me":"foe"}`);el?.classList.add("ar9-evolve",ev.kind);sfx("page");buzz([20,30,60]);}
        if(ev.k==="evade"&&!ev.fail){const el=root.querySelector(`.ar7-mon.${ev.side===mySide()?"me":"foe"}`);el?.classList.remove("ar9-dodge");void el?.offsetWidth;el?.classList.add("ar9-dodge");}
        const wait=animate(ev);
        await new Promise(r=>setTimeout(r,Math.max(wait||0,ev.k==="move"?450:ev.k==="hit"?850:ev.k==="faint"?1000:ev.k==="gimmick"?1400:500)));
      }
      if(!B)return;
      B.view=JSON.parse(JSON.stringify(s));B.view.events=[];B.chosen=false;
      if(B.view.phase==="end"){sfx(B.view.winner===B.role?"page":"select");buzz([30,40,30]);}
      if(!B.queue.length)B.playing=false;
      const prevTurn=B.shownTurn||1;
      render(true);
      if(B.view.phase==="choose"&&B.view.turn!==prevTurn){
        B.shownTurn=B.view.turn;
        const f=root.querySelector(".ar7-field");
        if(f){const t=document.createElement("b");t.className="ar7-turnban";t.textContent="Turno "+B.view.turn;f.appendChild(t);setTimeout(()=>t.remove(),1500);}
      }
      if(B.view.phase==="end"&&B.solo&&RUN&&!RUN.done){onWaveEnd();render(true);}
      if(B.view.phase==="end"){const f=root.querySelector(".ar7-field");if(f){const t=document.createElement("b");t.className="ar7-turnban end";t.textContent=B.view.winner?`${sideName(B.view.winner)} venceu!`:"Fim";f.appendChild(t);}}
    }
    if(B)B.playing=false;
  }
  /* Gimmicks que o meu ativo ainda pode usar (vale também para quem não é o anfitrião) */
  function gimmicksFor(side){
    const v=B.view.sides[side],mon=B.teams[side][v.active],g=mon?.gimmick||{},used=v.gim||{mega:null,tera:null,z:false};
    return {mega:used.mega==null&&used.tera!==v.active&&!mon.mega?(g.megaForms||[]):[],
      tera:used.tera==null&&used.mega!==v.active&&!mon.mega&&!mon.tera&&g.teraType?g.teraType:"",
      z:!used.z&&g.zType&&(mon.moves||[]).some(m=>String(m.category).toLowerCase()!=="status"&&normalizeTypeName(m.type)===g.zType)?g.zType:""};
  }
  function sideName(s){return B?.names?.[s]||s;}
  function monName(side,idx){const t=B?.teams?.[side];const i=idx??B?.view?.sides?.[side]?.active;return t?.[i]?.name||"Pokémon";}
  function effText(m){return m===0?"Não teve efeito…":m>=4?"Extremamente efetivo!":m>=2?"É super efetivo!":m<=.25?"Quase não teve efeito…":m<=.5?"Não é muito efetivo…":"";}
  /* Atualiza o que a tela mostra a cada evento (HP, status, estágios, clima) */
  function applyEventToView(ev){
    const v=B.view;if(!v)return;
    const sd=ev.side?v.sides[ev.side]:null,t=sd?sd.team[sd.active]:null;
    if((ev.k==="hit"||ev.k==="heal"||ev.k==="sdmg")&&t&&ev.hp!=null)t.hp=ev.hp;
    if(ev.k==="status"&&!ev.fail&&sd){if(ev.st==="cnf")sd.cnf=true;else if(t)t.status=ev.st;}
    if(ev.k==="statusEnd"&&sd){if(ev.st==="cnf")sd.cnf=false;else if(t)t.status=null;}
    if(ev.k==="stage"&&sd&&ev.applied){sd.stg=sd.stg||{};sd.stg[ev.stat]=ev.total;if(!ev.total)delete sd.stg[ev.stat];}
    if(ev.k==="weather")v.weather=ev.end?null:{kind:ev.kind,turns:ev.turns};
    if(ev.k==="field"&&sd){sd.field=sd.field||{};sd.field[ev.kind]=ev.end?0:ev.turns;}
    if(ev.k==="switch"&&sd){sd.stg={};sd.cnf=false;}
    if(ev.k==="faint"&&t){t.fainted=true;t.status=null;sd.stg={};sd.cnf=false;}
    if(ev.k==="gimmick"&&sd){
      sd.gim=sd.gim||{mega:null,tera:null,z:false};
      sd.gim[ev.kind]=ev.idx;
      const m=B.teams?.[ev.side]?.[ev.idx];
      if(m&&!B.host){if(ev.kind==="mega")Object.assign(m,{name:ev.to,img:ev.img||m.img,types:ev.types,ability:ev.ability,mega:true});else if(ev.kind==="form"||ev.kind==="unform")Object.assign(m,{name:ev.to,img:ev.img||m.img,types:ev.types});else Object.assign(m,{types:ev.types,tera:ev.type});}
      const st=sd.team[ev.idx];if(st&&ev.maxHp){st.maxHp=ev.maxHp;st.hp=ev.hp;}
    }
    if(ev.k==="move"&&ev.z&&sd){sd.gim=sd.gim||{};sd.gim.z=true;}
    if(ev.k==="held"&&sd&&/consumid|comid|estourou|ativou|aguentou com 1 HP|diminuiu|zerou|curou|deu Power|machucou o atacante/.test(ev.text||""))sd.itemGone=true;
    if(ev.k==="switch"&&sd)sd.itemGone=false;
    if(ev.k==="item"&&sd&&ev.hp!=null){const st=sd.team[ev.idx];if(st){st.hp=ev.hp;if(ev.revived)st.fainted=false;st.status=ev.status||null;}if(ev.idx===sd.active)sd.cnf=!!ev.cnf;}
  }
  const ST_LABEL={psn:"Envenenado",tox:"gravemente envenenado (Toxic)",brn:"Queimado",dbrn:"com Deep Burn",par:"Paralisado",slp:"Dormindo",frz:"Congelado",cnf:"Confuso"};
  const ST_SHORT={psn:"PSN",tox:"TOX",brn:"BRN",dbrn:"BRN+",par:"PAR",slp:"SLP",frz:"FRZ",cnf:"CNF"};
  const STAT_PT={atk:"Attack",def:"Defense",spa:"Sp.Atk",spd:"Sp.Def",spe:"Speed",acc:"Precisão",eva:"Evasão"};
  const STAT_SHORT={atk:"ATK",def:"DEF",spa:"SPA",spd:"SPD",spe:"SPE",acc:"PRE",eva:"EVA"};
  const W_LABEL={rain:"Chuva",sun:"Sol forte",sand:"Tempestade de areia",hail:"Granizo",snow:"Neve"};
  const W_ICON={rain:"🌧",sun:"☀",sand:"🌪",hail:"🧊",snow:"❄"};
  const SRC_LABEL={evade:"o cansaço de tanto esquivar",psn:"o veneno",tox:"o veneno (Toxic)",brn:"a queimadura",dbrn:"a queimadura profunda",sand:"a tempestade de areia",hail:"o granizo",cnf:"a confusão",recoil:"o recuo"};
  const CANT={slp:"está dormindo.",frz:"está congelado!",par:"está paralisado e não conseguiu se mover!",flinch:"hesitou e não atacou!",cnf:"está confuso e se feriu!",powder:"é imune a golpes de pó.",recharge:"precisa recarregar!"};
  function pushLog(events){
    for(const ev of events){
      let line="",cls="";
      if(ev.k==="move"){
        line=`<b>${esc(ev.mon)}</b> (${esc(sideName(ev.side))}) usou <b class="ar7-mv" style="--t:${typeColor(ev.type)}">${esc(ev.move)}</b>!`;
        if(ev.roll!=null)line+=` <span class="ar7-dice">🎲 d100 ${ev.roll}${ev.acc!=null?` / ${ev.acc}%`:""}</span>`;
        if(ev.z)line=`<b class="ar9-zline">Z-MOVE!</b> `+line+` <small>Power ${ev.power}</small>`;
        if(ev.miss){line+=ev.dodged?" — <i>esquivou!</i>":" — <i>errou!</i>";cls="miss";}
        if(ev.protect){line+=" — se protegeu!";}
        if(ev.status&&ev.desc)line+=`<small>${esc(ev.desc)}</small>`;
        if(ev.noTarget)line+=" — sem alvo.";
        if(ev.fail)line+=` — <i>falhou${ev.why?` (${esc(ev.why)})`:""}.</i>`;
        if(ev.critKind==="boosted"&&ev.crit)line+=" <small>crítico pela margem aumentada</small>";
      }else if(ev.k==="hit"){
        if(ev.immune){line=`${effText(0)}`;cls="weak";}
        else{
          line=ev.mode==="matrix"
            ?`${ev.crit?"<b class='ar7-crit'>CRÍTICO!</b> ":""}${esc(monName(ev.side))} perdeu <b>${ev.amount}</b> HP <span class="ar7-dice">🧪 ${esc(ev.expr)} [${(ev.rolls||[]).join(", ")}] · QD ${esc(ev.qd)} (Q${ev.offQ} vs Q${ev.defQ})${ev.stab?" · STAB":""}</span>`
            :`${ev.crit?"<b class='ar7-crit'>CRÍTICO!</b> ":""}${esc(monName(ev.side))} perdeu <b>${ev.amount}</b> HP <span class="ar7-dice">${ev.dice}d6 [${(ev.rolls||[]).join(", ")}]${ev.fixed?` ${ev.fixed>0?"+":""}${ev.fixed}`:""}${ev.stab?" · STAB":""}</span>`;
          const e=effText(ev.mult);if(e)line+=` <i>${e}</i>`;cls=ev.crit?"crit":ev.mult>=2?"super":ev.mult<1?"weak":"";
        }
        if(ev.notes?.length)line+=` <span class="ar7-dice">${ev.notes.map(esc).join(" · ")}</span>`;
        if(ev.hits>1)line+=` <i>(${ev.hits} acertos)</i>`;
      }else if(ev.k==="gimmick"){
        line=ev.kind==="form"?`✦ <b>${esc(ev.mon)}</b> mudou de forma: <b class="ar9-mega">${esc(ev.to)}</b>!`:ev.kind==="unform"?`↺ <b>${esc(ev.mon)}</b> voltou para <b>${esc(ev.to)}</b>.`:ev.kind==="mega"?`◆ <b>${esc(ev.mon)}</b> Mega Evoluiu para <b class="ar9-mega">${esc(ev.to)}</b>!`:`✦ <b>${esc(ev.mon)}</b> Terastalizou: agora é <b class="ar7-mv" style="--t:${typeColor(ev.type)}">${esc(ev.type)}</b> (STAB +2d6)!`;cls="gimmick";
      }else if(ev.k==="evade"){
        if(ev.fail)line=`${esc(ev.mon)} não consegue esquivar (${ev.why==="frz"?"congelado":"dormindo"}).`;
        else line=`↯ <b>${esc(ev.mon)}</b> ${ev.kind==="active"?"se concentra em esquivar":"fica pronto para esquivar"} <span class="ar7-dice">Precisão do rival −${ev.pen} · ${ev.streak}ª seguida${ev.tired?" · cansado!":""}</span>`;
        cls="evade";
      }else if(ev.k==="held"){
        line=`🎒 <b>${esc(ev.mon)}</b>: <b class="ar9-held">${esc(ev.item)}</b> ${esc(ev.text||"")}.`;cls="heal";
      }else if(ev.k==="item"){
        line=ev.fail?`${esc(sideName(ev.side))} usou ${esc(ev.item)}, mas não teve efeito.`:`🎒 ${esc(sideName(ev.side))} usou <b>${esc(ev.item)}</b> em ${esc(ev.mon)}${ev.revived?": voltou à luta!":ev.healed?`: +${ev.healed} HP`:""}${ev.cured?" (status curado)":""}.`;cls="heal";
      }else if(ev.k==="heal")line=`${esc(monName(ev.side))} recuperou <b>${ev.amount}</b> HP${ev.src?` <small class="ar7-src">${esc(ev.src)}</small>`:""}.`;
      else if(ev.k==="sdmg"){line=`${esc(ev.mon)} perdeu <b>${ev.amount}</b> HP por ${SRC_LABEL[ev.src]||esc(ev.src)}.`;cls="weak";}
      else if(ev.k==="stage"){
        const lab=STAT_PT[ev.stat]||ev.stat;
        if(ev.blocked)line=`${esc(ev.mon)} não perdeu ${lab} <small class="ar7-src">${esc(ev.src||"")}</small>.`;
        else if(!ev.applied)line=`${lab} de ${esc(ev.mon)} não ${ev.n>0?"sobe":"desce"} mais.`;
        else{const a=Math.abs(ev.applied);line=`${ev.applied>0?"⬆":"⬇"} ${lab} de <b>${esc(ev.mon)}</b> ${ev.applied>0?(a>=2?"subiu muito":"subiu"):(a>=2?"caiu muito":"caiu")} (${ev.total>0?"+":""}${ev.total})${ev.src?` <small class="ar7-src">${esc(ev.src)}</small>`:""}`;cls=ev.applied>0?"up":"down";}
      }
      else if(ev.k==="status"){
        if(ev.fail)line=`${esc(ev.mon)} não pode ficar ${ST_LABEL[ev.st]||ev.st}${ev.src?` (${esc(ev.src)})`:" (tipo)"}.`;
        else{line=`<b>${esc(ev.mon)}</b> ficou <b class="ar7-st ${ev.st}">${ST_LABEL[ev.st]||ev.st}</b>!${ev.src?` <small class="ar7-src">${esc(ev.src)}</small>`:""}`;cls="status";}
      }
      else if(ev.k==="statusEnd")line=`${esc(ev.mon)} ${ev.st==="slp"?"acordou!":ev.st==="frz"?"descongelou!":ev.st==="cnf"?"saiu da confusão.":"se recuperou."}`;
      else if(ev.k==="cant"){line=`${esc(ev.mon)} ${CANT[ev.reason]||"não conseguiu agir."}${ev.src&&ev.reason==="powder"?` <small class="ar7-src">${esc(ev.src)}</small>`:""}`;cls="miss";}
      else if(ev.k==="weather")line=ev.end?`${W_ICON[ev.kind]||""} ${W_LABEL[ev.kind]||ev.kind} acabou.`:`${W_ICON[ev.kind]||""} <b>${W_LABEL[ev.kind]||ev.kind}</b> por ${ev.turns} turnos!${ev.src?` <small class="ar7-src">${esc(ev.src)}</small>`:""}`;
      else if(ev.k==="field")line=ev.end?`👑 O Campo Real de ${esc(sideName(ev.side))} acabou.`:`👑 <b>Campo Real</b> ${ev.extended?"estendido":"ativo"}: ${ev.turns} turnos.`;
      else if(ev.k==="ability"){line=`✦ <b>${esc(ev.mon)}</b>: <b class="ar7-ab">${esc(ev.name)}</b>${ev.text?` ${esc(ev.text)}`:""}`;cls="ability";}
      else if(ev.k==="hazard")line=ev.cleared?`${esc(ev.mon)} absorveu os Toxic Spikes.`:`Toxic Spikes no lado de ${esc(sideName(ev.side))} (${ev.layers} camada${ev.layers>1?"s":""}).`;
      else if(ev.k==="info")line=esc(ev.text);
      else if(ev.k==="blocked")line=`${esc(monName(ev.side))} se protegeu do ataque!`;
      else if(ev.k==="faint"){line=`<b>${esc(ev.mon)}</b> desmaiou!`;cls="faint";}
      else if(ev.k==="switch")line=`${esc(sideName(ev.side))} trocou ${esc(ev.from)} por <b>${esc(ev.to)}</b>!`;
      else if(ev.k==="forfeit")line=`${esc(sideName(ev.side))} desistiu.`;
      else if(ev.k==="left")line=`${esc(sideName(ev.side))} saiu da arena.`;
      else if(ev.k==="hostleft")line=`O anfitrião saiu: a batalha foi encerrada.`;
      else if(ev.k==="end")line=`🏆 <b>${esc(sideName(ev.winner))}</b> venceu a batalha!`;
      if(line)B.log.push({line,cls});
    }
    B.log=B.log.slice(-80);
  }
  function animate(ev){
    const pos=s=>(s===mySide()?"me":"foe");
    const field=root.querySelector(".ar7-field");if(!field)return 0;
    let wait=0;
    try{wait=window.hhArenaFx?.play(field,ev,{pos})||0;}catch(e){}
    if(ev.k==="move"&&!window.hhArenaFx){const el=field.querySelector(`.ar7-mon.${pos(ev.side)}`);el?.classList.remove("lunge");void el?.offsetWidth;el?.classList.add("lunge");}
    if(ev.k==="switch"){const el=field.querySelector(`.ar7-mon.${pos(ev.side)}`);el?.classList.remove("enter");void el?.offsetWidth;el?.classList.add("enter");sfx("page");}
    if(ev.k==="hit"&&!ev.immune){
      const el=field.querySelector(`.ar7-mon.${pos(ev.side)}`);
      el?.classList.remove("hurt");void el?.offsetWidth;el?.classList.add("hurt");
      const n=document.createElement("b");n.className="ar7-dmg"+(ev.crit?" crit":ev.mult>=2?" super":"");n.textContent="-"+ev.amount;
      field.querySelector(`.ar7-spot.${pos(ev.side)}`)?.appendChild(n);setTimeout(()=>n.remove(),1300);
      sfx(ev.crit?"page":"type");buzz(ev.crit?[20,30,40]:15);
    }
    return wait;
  }
  /* Atualiza só HP, Pokébolas, desmaio e textos, sem redesenhar o campo
     (assim os efeitos dos golpes não são cortados no meio). */
  function patch(){
    const field=root.querySelector(".ar7-field");
    if(!B?.view||!field){render(true);return;}
    const mine=mySide(),foe=mine==="p1"?"p2":"p1";
    for(const [side,pos] of [[foe,"foe"],[mine,"me"]]){
      const sp=field.querySelector(`.ar7-spot.${pos}`);if(!sp)continue;
      const s=B.view.sides[side],st=s.team[s.active],pct=hpPct(st);
      const hp=sp.querySelector(".ar7-hp");if(hp)hp.className="ar7-hp "+hpClass(pct);
      const bar=sp.querySelector(".ar7-hp i");if(bar){bar.dataset.to=pct;bar.style.setProperty("--w",pct+"%");}
      lastHp[pos]=pct;
      const num=sp.querySelector(".ar7-hp-num");if(num)num.textContent=`${st.hp} / ${st.maxHp}`;
      sp.querySelectorAll(".ar7-balls i").forEach((b,i)=>b.classList.toggle("out",!!s.team[i]?.fainted));
      sp.querySelector(".ar7-mon")?.classList.toggle("fainted",!!st.fainted);
      const bd=sp.querySelector(".ar7-badges");if(bd)bd.innerHTML=hudBadges(s);
    }
    field.dataset.weather=B.view.weather?.kind||"";
    const ch=field.querySelector(".ar7-chips");if(ch)ch.innerHTML=fieldChips();
    const msg=root.querySelector(".ar7-msg p");if(msg&&B.log.length)msg.innerHTML=B.log[B.log.length-1].line;
    const log=root.querySelector(".ar7-log");if(log){log.innerHTML=B.log.map(l=>`<p class="${l.cls}">${l.line}</p>`).join("");log.scrollTop=log.scrollHeight;}
  }
  function mySide(){return B?.role==="p2"?"p2":"p1";}

  /* ---------- Emotes ---------- */
  const EMOTES=["👏","🔥","😮","😂","💪","😭","⚡","GG"];
  function emote(e){if(!B||!battleCh)return;const p={e,name:me.name,id:me.id};send(battleCh,"emote",p);showEmote(p);}
  function showEmote(p){
    const field=root.querySelector(".ar7-field");if(!field)return;
    const n=document.createElement("span");n.className="ar7-emote";n.style.left=(12+Math.random()*70)+"%";
    n.innerHTML=`<b>${esc(p.e)}</b><small>${esc(p.name)}</small>`;field.appendChild(n);setTimeout(()=>n.remove(),2600);
  }

  /* ---------- Render ---------- */
  let toastT;
  function toast(t){const el=root.querySelector(".ar7-toast");if(!el){if(typeof showToast==="function")showToast(t);return;}el.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{el.hidden=true;},2600);}
  function hpPct(m){return Math.max(0,Math.min(100,Math.round(100*m.hp/Math.max(1,m.maxHp))));}
  function hpClass(p){return p>50?"":p>20?"mid":"low";}

  function render(force){
    if(root.hidden)return;
    if(!force&&(B?.playing||B?.intro)&&root.querySelector(".ar7-field")){patch();return;}
    const focus=document.activeElement?.id;
    const keptScroll=root.querySelector(".ar7-scenes")?.scrollLeft;
    const kept={};["ar7Chat","ar7Room","ar7Name"].forEach(id=>{const el=document.getElementById(id);if(el)kept[id]=el.value;});
    morph(root,`<div class="ar7-shell">
      <header class="ar7-top">
        <button type="button" class="ar7-back" data-ar="close" aria-label="Voltar para a ficha">← Ficha</button>
        <div class="ar7-title"><b>⚔ Arena Online</b><small>${B?(B.role==="spec"?"Assistindo batalha":"Batalha"):`Sala <code>${esc(room)}</code> · ${statusText()}`}</small></div>
        ${B?"":`<button type="button" class="ar7-share" data-ar="share" title="Copiar convite para esta sala">🔗 Convidar</button>`}
      </header>
      <div class="ar7-body">${B?battleView():lobbyView()}</div>
      <p class="ar7-toast" role="status" hidden></p>
      ${incoming?challengeDialog():""}
      ${orderAsk&&!B?orderDialog():""}
    </div>`);
    if(keptScroll){const n=root.querySelector(".ar7-scenes");if(n)n.scrollLeft=keptScroll;}
    Object.entries(kept).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
    if(focus){const el=document.getElementById(focus);if(el&&el.tagName==="INPUT"){el.focus();try{el.setSelectionRange(el.value.length,el.value.length);}catch(e){}}}
    const bars=[...root.querySelectorAll(".ar7-hp i[data-to]")];
    if(bars.length){requestAnimationFrame(()=>requestAnimationFrame(()=>bars.forEach(i=>i.style.setProperty("--w",i.dataset.to+"%"))));
      root.querySelectorAll(".ar7-spot").forEach(sp=>{const i=sp.querySelector(".ar7-hp i[data-to]");if(i)lastHp[sp.classList.contains("me")?"me":"foe"]=Number(i.dataset.to);});}
    const log=root.querySelector(".ar7-log");if(log)log.scrollTop=log.scrollHeight;
    const chatBox=root.querySelector(".ar7-chat-list");if(chatBox)chatBox.scrollTop=chatBox.scrollHeight;
  }
  /* Redesenho sem piscar: em vez de trocar o HTML inteiro, compara com o
     novo e muda só o que mudou. Imagens, animações e efeitos em andamento
     continuam no lugar (antes tudo era recriado a cada mensagem/presença). */
  const TRANSIENT=/(?:^|\s)(?:ar7-emote|ar7-dmg|ar7-turnban|ar7-fxl|ar7-p)(?:\s|$)/;
  const isTransient=n=>n.nodeType===1&&TRANSIENT.test(n.getAttribute("class")||"");
  function morph(parent,html){
    const tpl=document.createElement("template");tpl.innerHTML=html;
    syncChildren(parent,tpl.content);
  }
  function sameKind(a,b){
    if(a.nodeType!==b.nodeType)return false;
    if(a.nodeType!==1)return true;
    if(a.tagName!==b.tagName)return false;
    // cartas diferentes (outro Pokémon/outra pessoa) são trocadas inteiras
    const ka=a.getAttribute("data-id")||a.getAttribute("data-idx")||"",kb=b.getAttribute("data-id")||b.getAttribute("data-idx")||"";
    return ka===kb;
  }
  function syncChildren(a,b){
    const an=[...a.childNodes].filter(n=>!isTransient(n)),bn=[...b.childNodes];
    for(let i=0;i<bn.length;i++){
      const x=an[i],y=bn[i];
      if(!x){a.appendChild(y);continue;}
      if(sameKind(x,y))syncNode(x,y);else a.replaceChild(y,x);
    }
    for(let i=an.length-1;i>=bn.length;i--)an[i].remove();
  }
  function syncNode(x,y){
    if(x.nodeType===3||x.nodeType===8){if(x.nodeValue!==y.nodeValue)x.nodeValue=y.nodeValue;return;}
    if(x.nodeType!==1)return;
    // a mensagem flutuante (toast) é controlada por toast(); não mexe
    if(x.classList.contains("ar7-toast"))return;
    for(const at of [...x.attributes])if(!y.hasAttribute(at.name))x.removeAttribute(at.name);
    for(const at of [...y.attributes])if(x.getAttribute(at.name)!==at.value)x.setAttribute(at.name,at.value);
    const tag=x.tagName;
    if(tag==="INPUT"||tag==="TEXTAREA"){
      if(document.activeElement!==x&&y.hasAttribute("value")&&x.value!==y.getAttribute("value"))x.value=y.getAttribute("value");
      if(tag==="TEXTAREA")return;
    }
    if(tag==="DETAILS"&&!y.hasAttribute("open")&&x.open&&!x.hasAttribute("open")){}
    syncChildren(x,y);
    if(tag==="SELECT"){const sel=[...y.options].find(o=>o.selected);if(sel&&document.activeElement!==x)x.value=sel.value;}
  }
  function statusText(){return status==="on"?`${Object.keys(people).length} online`:status==="connecting"?"conectando…":status==="error"?"sem conexão":"desconectado";}

  function teamMinis(team,size=28){
    return (team||[]).map(m=>`<span class="ar7-mini" title="${esc(m.n)} Lv${m.lv}" style="--t:${typeColor(m.t?.[0])}">${m.img?`<img src="${esc(m.img)}" alt="" loading="lazy" width="${size}" height="${size}">`:`<i>${esc((m.n||"?").slice(0,1))}</i>`}</span>`).join("");
  }
  /* ---------- Lobby (repaginado): herói, modos, abas ---------- */
  const PX=(n,sz)=>window.hhArenaPix?window.hhArenaPix.svg(n,sz):"";
  let tab=(()=>{const t=ls.get("hh_arena_tab","sala");return ["sala","time","ranking","chat","ajustes"].includes(t)?t:"sala";})();
  let unread=0;
  const TABS=[["sala","people","Sala","Desafiar e assistir","#e0393e"],["time","ball","Meu time","Escalação","#e39a12"],["ranking","trophy","Ranking","Desafio Sem Fim","#c9961a"],["chat","chat","Chat","Conversa","#2f74d4"],["ajustes","gear","Ajustes","Sala e regras","#7a5ad0"]];
  const wideMq=matchMedia("(min-width:1100px)");
  wideMq.addEventListener?.("change",()=>{if(!B)render();});
  function lobbyView(){
    if(status==="error")return `<div class="ar7-card ar7-empty"><b>Não foi possível conectar à arena.</b><p>Confira a internet e tente de novo.</p><button type="button" class="ar7-btn primary" data-ar="retry">Tentar de novo</button></div>`;
    const list=Object.values(people).sort((a,b)=>(a.id===me.id?-1:b.id===me.id?1:a.name.localeCompare(b.name)));
    const others=list.filter(p=>p.id!==me.id);
    const battles={};
    // descidas de quem está numa versão antiga da ficha (não dá para assistir)
    const oldRuns=list.filter(p=>p.status==="survival"&&!p.battle&&p.id!==me.id);
    list.filter(p=>(p.status==="battle"||p.status==="survival")&&p.battle&&p.id!==me.id).forEach(p=>{battles[p.battle]=battles[p.battle]||{id:p.battle,players:[],names:p.names,solo:p.status==="survival",region:p.region,wave:p.wave};battles[p.battle].players.push(p.name);});
    const myTeam=teamPreview();
    const lead=myTeam[0];const leadMon=teamSource()[0];const leadImg=leadMon?localImg(leadMon):"";
    const bg=scene==="random"?"standard":scene;
    const best=Number(state.arenaSurvivalBest||0);
    const top=RANK.list?.[0];
    const nBattles=Object.keys(battles).length;
    const wide=wideMq.matches;
    const curTab=wide&&tab==="chat"?"sala":tab;
    if(curTab==="chat"||wide)unread=0;
    const counts={sala:others.length,chat:unread};
    const slots=teamSource();
    return `<div class="ar8"><div class="ar8-main">
    <section class="ar8-hero ar8-frame" style="background-image:linear-gradient(100deg,rgba(14,16,30,.82) 0%,rgba(14,16,30,.45) 50%,rgba(14,16,30,.08) 100%),url('assets/arenas/${esc(bg)}.png')">
      <div class="ar8-hero-me">
        <span class="ar8-avatar" style="--t:${typeColor(lead?.t?.[0])}">${leadImg?`<img src="${esc(leadImg)}" alt="">`:PX("ball",40)}</span>
        <div class="ar8-hero-txt">
          <small>Treinador</small>
          <b>${esc(me.name)}</b>
          <span class="ar8-pills"><span class="ar8-pill ${status==="on"?"on":""}"><i></i>${statusText()}</span><span class="ar8-pill">Sala <code>${esc(room)}</code></span><span class="ar8-pill gold">🏆 Recorde ${best}</span></span>
        </div>
      </div>
      <div class="ar8-party" aria-label="Seu time">${Array.from({length:6},(_,i)=>{const p=slots[i];if(!p)return `<span class="ar8-slot empty">${PX("ball",22)}</span>`;const im=localImg(p);return `<span class="ar8-slot${i===0?" lead":""}" title="${esc(p.name)} • Lv. ${Number(p.level||1)}" style="--t:${typeColor(p.type1)}">${im?`<img src="${esc(im)}" alt="${esc(p.name)}">`:`<i>${esc((p.name||"?").slice(0,1))}</i>`}<small>Lv${Number(p.level||1)}</small></span>`;}).join("")}</div>
    </section>
    ${outgoing?`<section class="ar7-card ar7-wait"><b>Desafio enviado para ${esc(people[outgoing.to]?.name||"…")}</b><small>${outgoing.format>=6?"time todo":`${outgoing.format} vs ${outgoing.format}`} · aguardando resposta</small><button type="button" class="ar7-btn" data-ar="cancel">Cancelar</button></section>`:""}
    <section class="ar8-modes">
      <article class="ar8-mode friends ar8-frame">
        <span class="ar8-mode-ico">${PX("swords",72)}</span>
        <div class="ar8-mode-txt"><small>Multijogador</small><h3>Batalha entre amigos</h3>
          <p>${others.length?`<b>${others.length}</b> treinador${others.length>1?"es":""} na sala`:"Ninguém na sala ainda"}${nBattles?` · <b>${nBattles}</b> batalha${nBattles>1?"s":""} ao vivo`:""}</p></div>
        <div class="ar8-mode-act">${others.length?`<button type="button" class="ar7-btn primary" data-ar="tab" data-v="sala">⚔ Desafiar</button>`:`<button type="button" class="ar7-btn primary" data-ar="share">🔗 Convidar</button>`}</div>
      </article>
      <article class="ar8-mode endless ar8-frame">
        <span class="ar8-mode-ico tower">${PX("tower",64)}</span>
        <div class="ar8-mode-txt"><small>Solo · ondas infinitas</small><h3>Desafio Sem Fim</h3>
          <p>Recorde: <b>${best}</b> onda${best===1?"":"s"} · 🔁 <b>${myAttempts("endless")}</b>${top?` · Líder: <b>${esc(top.player)}</b> (${top.waves})`:""}</p></div>
        <div class="ar8-mode-act"><button type="button" class="ar7-btn primary" data-ar="surv-start" ${myTeam.length?"":"disabled"}>▶ Começar</button><button type="button" class="ar7-btn" data-ar="tab" data-v="ranking">🏆</button></div>
      </article>
    </section>
    ${citiesView(myTeam)}
    <nav class="ar8-tabs" role="tablist" aria-label="Seções da arena">${TABS.filter(([k])=>!(wide&&k==="chat")).map(([k,ico,label,sub,col])=>`<button type="button" role="tab" aria-selected="${curTab===k}" class="ar8-tab${curTab===k?" on":""}" data-ar="tab" data-v="${k}" style="--nb:${col}"><span class="ar8-tab-ico">${PX(ico,22)}</span><span class="ar8-tab-txt"><b>${label}</b><small>${sub}</small></span>${counts[k]?`<i class="ar8-count">${counts[k]}</i>`:""}</button>`).join("")}</nav>
    <section class="ar8-panel" role="tabpanel">${curTab==="sala"?roomTab(others,battles,myTeam,oldRuns):curTab==="time"?`<div class="ar8-sec"><h3>${PX("ball",22)} Seu time na arena</h3><p class="ar8-sub">Quem vai para as batalhas e para o Desafio Sem Fim. O primeiro começa a luta.</p>${teamEditor()}</div>`:curTab==="ranking"?rankTab():curTab==="chat"?chatTab():settingsTab()}</section>
    </div>
    ${wide?`<aside class="ar8-side">${sideOnline(others)}${chatTab()}</aside>`:""}
    </div>`;
  }
  /* Desafios das cidades: cada cidade tem sua área de um tipo só */
  function citiesView(myTeam){
    const regions=Object.values(window.hhArenaSurvival?.REGIONS||{});
    if(!regions.length)return "";
    return `<section class="ar9-cities" aria-label="Desafios das cidades">
      <h3 class="ar9-cities-title">${PX("abyss",22)} Desafios das cidades <small>Desafio Sem Fim por tipagem</small></h3>
      ${regions.map(r=>{const best=regionBest(r.id);return `<article class="ar9-city ar8-frame t-${esc(r.type.toLowerCase())}" style="--t:${typeColor(r.type)};--td:${typeDark(r.type)};background-image:linear-gradient(100deg,rgba(20,14,10,.92) 0%,rgba(28,20,14,.7) 55%,rgba(28,20,14,.25) 100%),url('assets/arenas/${esc(r.scene)}.png')">
        <span class="ar9-city-ico">${PX(r.icon,64)}</span>
        <div class="ar9-city-txt"><small>Cidade de <b>${esc(r.city)}</b> · tipo ${esc(r.typePt)}</small><h3>${esc(r.area)}</h3>
          <p>Lv ${r.minLv} → ${r.maxLv} · cada andar mais fundo e mais perigoso · Guardião no andar ${r.floors}</p>
          <ul class="ar9-rules"><li>⭐ Rende <b>PPg</b> para quem lutar</li><li>🎒 Cura só com os itens da sua Bolsa</li><li>💔 Golpes de cura rendem metade</li></ul>
          <p class="ar9-best">Seu recorde: <b>${best}</b> andar${best===1?"":"es"}${best?` (${best*40} m)`:""} · 🔁 Tentativas: <b>${myAttempts(r.id)}</b></p></div>
        <div class="ar8-mode-act"><button type="button" class="ar7-btn primary" data-ar="region-start" data-v="${esc(r.id)}" ${myTeam.length?"":"disabled"}>⬇ Descer</button><button type="button" class="ar7-btn" data-ar="rank-mode-open" data-v="${esc(r.id)}" title="Ranking de ${esc(r.city)}">🏆</button></div>
      </article>`;}).join("")}
    </section>`;
  }
  function sideOnline(others){
    return `<div class="ar8-sec ar8-online"><h3>${PX("people",22)} Online agora <small>${others.length+1}</small></h3>
      <ul>${[{name:me.name,status:"me",team:teamPreview()},...others].map(p=>{const l=(p.team||[])[0];return `<li><span class="ar8-avatar xs" style="--t:${typeColor(l?.t?.[0])}">${l?.img?`<img src="${esc(l.img)}" alt="">`:PX("ball",18)}</span><b>${esc(p.name)}${p.status==="me"?" <small>(você)</small>":""}</b><i class="ar8-dot ${esc(p.status)}" title="${esc(p.status)}"></i></li>`;}).join("")}</ul></div>`;
  }
  function roomTab(others,battles,myTeam,oldRuns=[]){
    const watchers={};Object.values(people).filter(p=>p.status==="watch").forEach(p=>{watchers[p.battle]=(watchers[p.battle]||0)+1;});
    const badge=p=>p.status==="battle"?`⚔ em batalha${p.vs?` com ${esc(p.vs)}`:""}`:p.status==="watch"?"👁 assistindo":p.status==="survival"?(p.region&&REG(p.region)?`⛰ ${esc(REG(p.region).area)} · andar ${Number(p.wave)||1}`:`🗼 Desafio Sem Fim · onda ${Number(p.wave)||1}`):"● disponível";
    return `<div class="ar8-sec">
      <h3>${PX("people",24)} Treinadores na sala <small>${others.length}</small></h3>
      ${others.length?`<ul class="ar8-people">${others.map(p=>{const l=(p.team||[])[0];return `<li class="ar8-person ${esc(p.status)}">
        <span class="ar8-avatar sm" style="--t:${typeColor(l?.t?.[0])}">${l?.img?`<img src="${esc(l.img)}" alt="">`:PX("ball",28)}</span>
        <div class="ar8-person-txt"><b>${esc(p.name)}</b><span class="ar7-badge ${esc(p.status)}">${badge(p)}</span><span class="ar7-minis">${teamMinis(p.team,26)}</span></div>
        ${p.status==="idle"&&!outgoing&&myTeam.length?`<div class="ar7-formats" role="group" aria-label="Desafiar ${esc(p.name)}">
          <button type="button" class="ar7-btn primary ar7-ch-main" data-ar="challenge" data-to="${esc(p.id)}" data-format="6">⚔ Desafiar <small>time todo</small></button>
          <button type="button" class="ar7-btn" data-ar="challenge" data-to="${esc(p.id)}" data-format="3">3 vs 3</button>
          <button type="button" class="ar7-btn" data-ar="challenge" data-to="${esc(p.id)}" data-format="1">1 vs 1</button></div>`:""}
      </li>`;}).join("")}</ul>`:`<div class="ar8-empty">${PX("people",48)}<p>${status==="on"?"Ninguém mais nesta sala ainda.":"Conectando…"}</p>${status==="on"?`<button type="button" class="ar7-btn primary" data-ar="share">🔗 Mandar convite</button>`:""}</div>`}
    </div>
    <div class="ar8-sec">
      <h3>${PX("eye",24)} Batalhas ao vivo <small>${Object.keys(battles).length}</small></h3>
      ${Object.keys(battles).length?`<ul class="ar7-battles">${Object.values(battles).map(b=>`<li><span>${b.solo?`${b.region&&REG(b.region)?"⛰":"🗼"} <b>${esc(b.players[0]||"?")}</b> <small>${b.region&&REG(b.region)?`${esc(REG(b.region).area)} · andar ${Number(b.wave)||1}`:`Desafio Sem Fim · onda ${Number(b.wave)||1}`}</small>`:`<b>${esc(b.names?.p1||b.players[0]||"?")}</b> <i class="ar8-vs">VS</i> <b>${esc(b.names?.p2||b.players[1]||"?")}</b>`}${watchers[b.id]?` <small>👁 ${watchers[b.id]}</small>`:""}</span>
        <button type="button" class="ar7-btn" data-ar="watch" data-id="${esc(b.id)}" data-p1="${esc(b.names?.p1||"")}" data-p2="${esc(b.names?.p2||"")}">👁 Assistir</button></li>`).join("")}</ul>`:oldRuns.length?"":`<p class="ar7-empty-text">Nenhuma batalha agora. Quando alguém lutar, aparece aqui para assistir.</p>`}
      ${oldRuns.length?`<ul class="ar7-battles ar9-oldruns">${oldRuns.map(p=>`<li><span>${p.region&&REG(p.region)?"⛰":"🗼"} <b>${esc(p.name)}</b> <small>${p.region&&REG(p.region)?`${esc(REG(p.region).area)} · andar ${Number(p.wave)||1}`:`Desafio Sem Fim · onda ${Number(p.wave)||1}`}</small></span>
        <small class="ar9-oldtag">versão antiga da ficha: peça para atualizar a página (depois da corrida) para poder assistir</small></li>`).join("")}</ul>`:""}
    </div>`;
  }
  function rankTab(){
    const list=RANK.list,reg=RANK.mode!=="endless"?REG(RANK.mode):null;
    const best=reg?regionBest(reg.id):Number(state.arenaSurvivalBest||0);
    const unit=n=>reg?`andar${n===1?"":"es"}`:`onda${n===1?"":"s"}`;
    const me_=playerKey();
    const pod=list?.slice(0,3)||[];
    const card=(r,i)=>`<div class="ar8-pod p${i+1}${r.player_key===me_?" me":""}">
      ${i===0?`<span class="ar8-crown">${PX("crown",30)}</span>`:""}
      <span class="ar8-avatar" style="--t:#ffd23f">${(()=>{const im=(r.team||[]).find(t=>t.img)?.img;return im?`<img src="${esc(im)}" alt="">`:PX("ball",34);})()}</span>
      <b>${esc(r.player)}</b><strong>${r.waves}<small> ${unit(r.waves)}</small></strong>${RANK.tries?.get(r.player_key)?`<em class="ar9-tries">🔁 ${triesTxt(RANK.tries.get(r.player_key))}</em>`:""}<i class="ar8-step">${i+1}</i></div>`;
    const regions=Object.values(window.hhArenaSurvival?.REGIONS||{});
    return `<div class="ar8-sec ar8-rank">
      <div class="ar8-rank-top"><h3>${PX("trophy",24)} Ranking ${reg?`do ${esc(reg.area)}`:"do Desafio Sem Fim"}</h3><button type="button" class="ar7-link" data-ar="rank-reload">atualizar</button></div>
      <div class="ar9-rank-modes" role="tablist" aria-label="Modo do ranking"><button type="button" role="tab" aria-selected="${!reg}" class="${!reg?"on":""}" data-ar="rank-mode" data-v="endless">${PX("tower",18)} Sem Fim</button>${regions.map(x=>`<button type="button" role="tab" aria-selected="${reg?.id===x.id}" class="${reg?.id===x.id?"on":""}" data-ar="rank-mode" data-v="${esc(x.id)}">${PX(x.icon,18)} ${esc(x.city)}</button>`).join("")}</div>
      <p class="ar8-sub">Melhor ${reg?"descida":"corrida"} de cada treinador. Seu recorde: <b>${best}</b> ${unit(best)} · 🔁 <b>${triesTxt(Math.max(myAttempts(RANK.mode),RANK.tries?.get(me_)||0))}</b>.</p>
      ${RANK.loading&&!list?`<p class="ar7-empty-text">Carregando…</p>`:RANK.error&&!list?`<p class="ar7-empty-text">${esc(RANK.error)}</p>`:!list||!list.length?`<div class="ar8-empty">${PX("tower",40)}<p>Ninguém no ranking ainda. Seja o primeiro!</p></div>`:`
      <div class="ar8-podium">${[1,0,2].filter(i=>pod[i]).map(i=>card(pod[i],i)).join("")}</div>
      ${list.length>3?`<ol class="ar7-rank-list" start="4">${list.slice(3).map((r,i)=>`<li class="${r.player_key===me_?"me":""}"><span class="ar7-rank-pos">${i+4}</span>
        <span class="ar7-rank-name"><b>${esc(r.player)}</b><small>${(r.team||[]).map(t=>esc(t.n)).join(", ")}${r.damage_mode==="matrix"?" · 🧪":""}${r.last_foe?` · caiu para ${esc(r.last_foe)}`:""}${RANK.tries?.get(r.player_key)?` · 🔁 ${triesTxt(RANK.tries.get(r.player_key))}`:""}</small></span>
        <span class="ar7-rank-minis">${teamMinis((r.team||[]).map(t=>({n:t.n,lv:t.lv,t:[],img:t.img||""})),24)}</span>
        <b class="ar7-rank-score">${r.waves}<small>${unit(r.waves)}</small></b></li>`).join("")}</ol>`:""}`}
    </div>`;
  }
  function chatTab(){
    return `<div class="ar8-sec ar7-chat">
      <h3>${PX("chat",24)} Chat da sala</h3>
      <div class="ar7-chat-list" aria-live="polite">${chat.length?chat.map(c=>`<p class="${c.name===me.name?"mine":""}"><b>${esc(c.name)}</b><span>${esc(c.text)}</span></p>`).join(""):`<p class="ar7-empty-text">Diga oi! 👋</p>`}</div>
      <form class="ar7-chat-form" data-ar-form="chat"><input id="ar7Chat" maxlength="160" placeholder="Mensagem…" autocomplete="off"><button type="submit" class="ar7-btn primary">Enviar</button></form>
    </div>`;
  }
  function settingsTab(){
    return `<div class="ar8-sec">
      <h3>${PX("gear",24)} Ajustes</h3>
      <div class="ar7-me-row">
        <label class="ar7-field-label">Nome do treinador <small>(o mesmo do Trainer Card)</small><input id="ar7Name" maxlength="24" value="${esc(me.name)}" autocomplete="off"></label>
        <label class="ar7-field-label">Sala<span class="ar7-room"><input id="ar7Room" maxlength="24" value="${esc(room)}" autocomplete="off" spellcheck="false"><button type="button" class="ar7-btn" data-ar="room">Entrar</button></span></label>
      </div>
      <p class="ar7-hint">Use uma sala com nome próprio (ex.: <code>mesa-do-nando</code>) para jogar só com seus amigos, e mande o <button type="button" class="ar7-link" data-ar="share">convite 🔗</button>. A batalha não altera a ficha: todos começam com HP cheio.</p>
      <div class="ar7-dmg-pick"><small>⚔ Dano por Qualidade (QD): o Poder do golpe define quantos dados; a Qualidade do seu ATK/SP.ATK contra a DEF/SP.DEF do alvo define o dado (d4 a d20). Super efetivo +1 dado e +1 degrau; STAB +1d6; nível÷5 fixo. O botão de cada golpe já mostra os dados contra o rival atual.</small></div>
      <div class="ar7-scenes-head"><small>Ambiente das suas batalhas:</small><b>${scene==="random"?"Aleatório":esc(sceneLabel(scene))}</b></div>
      <div class="ar7-scenes" role="radiogroup" aria-label="Ambiente da batalha">
        <button type="button" role="radio" aria-checked="${scene==="random"}" class="ar7-scene rnd${scene==="random"?" on":""}" data-ar="scene" data-v="random"><i>🎲</i><b>Aleatório</b></button>
        ${SCENES.map(x=>`<button type="button" role="radio" aria-checked="${x.v===scene}" class="ar7-scene${x.v===scene?" on":""}" data-ar="scene" data-v="${esc(x.v)}"><i style="background-image:url('assets/arenas/${esc(x.v)}.png')"></i><b>${esc(x.label)}</b></button>`).join("")}
      </div>
    </div>`;
  }
  let pickOpen=false;
  function teamEditor(){
    const team=teamSource(),custom=pickIds().length>0;
    const ids=new Set(team.map(p=>String(p.id)));
    const rest=state.pokemon.filter(p=>!ids.has(String(p.id)));
    const face=p=>{const img=localImg(p);return img?`<img src="${esc(img)}" alt="" width="44" height="44" loading="lazy">`:`<i>${esc((p.name||"?").slice(0,1))}</i>`;};
    return `<div class="ar7-pick">
      <div class="ar7-pick-head"><small>Seu time na arena <b>${team.length}/6</b> ${custom?"· escolhido por você":"· Equipe da ficha"}</small>
        ${custom?`<button type="button" class="ar7-link" data-ar="pick-reset">Usar a Equipe da ficha</button>`:""}</div>
      ${team.length?`<ol class="ar7-pick-list">${team.map((p,i)=>`<li class="${i===0?"lead":""}" style="--t:${typeColor(p.type1)}">
        <span class="ar7-pick-face">${face(p)}</span>
        <span class="ar7-pick-name"><b>${esc(p.name)}</b><small>${i===0?"Começa a luta":`#${i+1}`} · Lv${Number(p.level||1)}</small></span>
        <span class="ar7-pick-acts">
          ${i>0?`<button type="button" data-ar="pick-lead" data-id="${esc(String(p.id))}" title="Começar com ${esc(p.name)}" aria-label="Começar com ${esc(p.name)}">★</button><button type="button" data-ar="pick-left" data-id="${esc(String(p.id))}" title="Subir na ordem" aria-label="Subir ${esc(p.name)} na ordem">▲</button>`:""}
          <button type="button" data-ar="pick-del" data-id="${esc(String(p.id))}" title="Tirar do time" aria-label="Tirar ${esc(p.name)} do time">✕</button>
        </span></li>`).join("")}</ol>`:`<p class="ar7-empty-text">Nenhum Pokémon no time. Adicione abaixo.</p>`}
      ${rest.length?`<button type="button" class="ar7-btn ar7-pick-more" data-ar="pick-more" aria-expanded="${pickOpen}">${pickOpen?"Fechar lista":"＋ Adicionar Pokémon da ficha"}</button>
      ${pickOpen?`<div class="ar7-pick-pool">${rest.map(p=>`<button type="button" data-ar="pick-add" data-id="${esc(String(p.id))}" ${team.length>=6?"disabled":""} title="Adicionar ${esc(p.name)}">${face(p)}<span>${esc(p.name)}</span><small>${p.storageGroup==="team"?"Equipe":"Caixa"}</small></button>`).join("")}</div>`:""}`:""}
    </div>`;
  }
  /* ---------- Desafio Sem Fim ---------- */
  async function loadRank(force){
    if(RANK.loading||(!force&&RANK.list&&Date.now()-(RANK.at||0)<60000))return;
    RANK.loading=true;RANK.error="";render();
    try{
      await loadSb();sb=sb||window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const mode=RANK.mode;
      const [{data,error},stats]=await Promise.all([
        sb.from("arena_survival_ranking").select("player,player_key,waves,team,damage_mode,last_foe,created_at,mode").eq("mode",mode).gt("waves",0).order("waves",{ascending:false}).order("created_at",{ascending:true}).limit(300),
        sb.from("arena_survival_stats").select("player_key,attempts").eq("mode",mode).limit(1000)]);
      if(error)throw error;
      if(mode!==RANK.mode){RANK.loading=false;return;}
      RANK.tries=new Map((stats?.data||[]).map(x=>[x.player_key,Number(x.attempts||0)]));
      const seen=new Set(),out=[];
      for(const r of data||[]){if(seen.has(r.player_key))continue;seen.add(r.player_key);out.push(r);if(out.length>=20)break;}
      RANK.list=out;RANK.at=Date.now();
    }catch(e){RANK.error="Não consegui carregar o ranking agora.";}
    RANK.loading=false;render();
  }
  async function startRun(regionId){
    if(B||!SURV())return;
    const region=regionId?REG(regionId):null;
    if(regionId&&!region)return;
    toast(region?`Descendo para o ${region.area}…`:"Preparando o Desafio Sem Fim…");
    const team=await buildTeam(6);
    if(!team.length){toast("Monte um time primeiro.");return;}
    RUN={wave:0,team,hp:team.map(m=>({hp:Math.max(1,Number(m.maxHp||1)),maxHp:Math.max(1,Number(m.maxHp||1)),fainted:false})),train:0,dmg:dmgMode,cleared:0,done:false,
      region,mode:region?region.id:"endless",ppg:{},lastGains:[]};
    RUN.id="run-"+uidShort();openRunCh();
    state.arenaAttempts=state.arenaAttempts||{};
    state.arenaAttempts[RUN.mode]=myAttempts(RUN.mode)+1;RUN.attempt=state.arenaAttempts[RUN.mode];
    try{(typeof debouncedSave==="function"?debouncedSave:saveState)();}catch(e){}
    nextWave();
  }
  /* ---------- Corrida ao vivo: quem está na sala pode assistir ---------- */
  function runSubtitle(){
    if(!RUN)return "";
    return RUN.region?`⛰ ${RUN.region.area} · Andar ${RUN.wave} · ${RUN.waveInfo?.depth||RUN.wave*40} m${RUN.waveInfo?.boss?" · GUARDIÃO":RUN.waveInfo?.elite?" · Montanhista":""} · ${RUN.attempt||1}ª tentativa`
      :`🗼 Desafio Sem Fim · Onda ${RUN.wave} · ${RUN.attempt||1}ª tentativa`;
  }
  function runStartPayload(){
    return {teams:B.teams,state:pub(B.state),names:B.names,format:6,arena:B.arena,dmg:B.dmg,fresh:true,sub:runSubtitle()};
  }
  function openRunCh(){
    if(!sb||!RUN)return;
    try{
      const ch=sb.channel("hh-arena-b:"+RUN.id,{config:{presence:{key:me.id},broadcast:{self:false}}});
      ch.on("broadcast",{event:"sync"},()=>{if(B?.solo&&B.state&&RUN?.ch===ch)send(ch,"start",runStartPayload());});
      ch.on("broadcast",{event:"emote"},({payload})=>showEmote(payload));
      ch.on("presence",{event:"sync"},()=>{if(B?.solo){B.specs=Object.fromEntries(Object.values(ch.presenceState()).map(a=>a[a.length-1]).filter(x=>x.role==="spec").map(x=>[x.id,x.name]));if(!B.playing)render();}});
      ch.subscribe(st=>{if(st==="SUBSCRIBED"){ch.track({id:me.id,name:me.name,role:"p1"});track();}});
      RUN.ch=ch;battleCh=ch;
    }catch(e){}
  }
  function closeRunCh(){
    const ch=RUN?.ch;if(!ch)return;
    RUN.ch=null;if(battleCh===ch)battleCh=null;
    setTimeout(()=>{try{sb?.removeChannel(ch);}catch(e){}},800);
  }
  async function nextWave(){
    RUN.wave++;RUN.done=false;RUN.error="";RUN.lastGains=[];
    const region=RUN.region;
    B={id:"solo-"+uidShort(),role:"p1",host:true,solo:true,arena:region?region.scene:pickScene(scene),dmg:RUN.dmg,format:6,names:{p1:me.name,p2:(region?"Andar ":"Onda ")+RUN.wave},state:null,teams:null,pendingTeams:{},specs:{},queue:[],playing:false,log:[],chosen:false,sel:{}};
    for(const k in lastHp)delete lastHp[k];
    sfx("page");render();track();
    const ref=Math.round(RUN.team.reduce((x,m)=>x+Number(m.level||1),0)/RUN.team.length);
    let wave;
    try{wave=region?await SURV().makeRegionWave(region.id,RUN.wave):await SURV().makeWave(RUN.wave,ref);}
    catch(e){if(RUN){RUN.error="A PokéAPI não respondeu.";render();}return;}
    if(!B?.solo||!RUN)return;
    RUN.waveInfo=wave;
    const alive=RUN.team.map((m,i)=>i).filter(i=>!RUN.hp[i].fainted);
    RUN.alive=alive;
    const foeName=region?`${wave.label} · Andar ${RUN.wave}`:`${wave.boss?"Chefe da onda":wave.elite?"Elite da onda":"Onda"} ${RUN.wave}`;
    B.state=engine.newBattle({id:B.id,format:6,damage:RUN.dmg,
      // no desafio da cidade, golpes e abilities curam só metade
      p1:{id:me.id,name:me.name,team:alive.map(i=>RUN.team[i]),items:true,healMult:region?.5:1},
      p2:{id:"cpu",name:foeName,team:wave.team}});
    // HP que sobrou das ondas anteriores e o treino acumulado
    alive.forEach((ri,j)=>{const st=B.state.sides.p1.team[j];st.hp=Math.min(st.maxHp,RUN.hp[ri].hp);if(RUN.train){st.persist.atk=(st.persist.atk||0)+RUN.train;st.persist.spa=(st.persist.spa||0)+RUN.train;}});
    B.teams=B.state.teams;B.names={p1:me.name,p2:B.state.sides.p2.name};B.started=true;
    applyState(pub(B.state),true);
    if(RUN.ch){battleCh=RUN.ch;send(RUN.ch,"start",runStartPayload());}
    B.state.events=[];track();
  }
  const saveNow=()=>{try{(typeof debouncedSave==="function"?debouncedSave:saveState)();}catch(e){}};
  /* PPg (regra 17): quem lutou no andar ganha 1 (selvagem), 2 (Montanhista)
     ou 3 (Guardião). Nada se o Pokémon está 10+ níveis acima do rival. */
  function awardPpg(){
    const info=RUN.waveInfo,st=B.state;if(!info||!st)return;
    const gains=[],shareGains=new Map();
    RUN.alive.forEach((ri,j)=>{
      const t=st.sides.p1.team[j];if(!t?.part)return;
      const m=RUN.team[ri];
      const p=state.pokemon.find(x=>String(x.id)===String(m.fid));
      if(Number(m.level||1)-info.level>=10){
        // não ganha PPg, mas sempre passa 1 PPg inteiro para quem segura o Exp. Share
        let passed=0;
        try{for(const h of (state.pokemon||[]).filter(x=>(x.storageGroup||"team")==="team"&&String(x.id)!==String(m.fid)&&/^exp\.?\s*share$/i.test(String(x.heldItem||"").trim()))){
          const before=Math.max(0,Number(h.currentPpg||0));h.currentPpg=Math.min(15,before+1);const add=h.currentPpg-before;passed+=add;
          const g=shareGains.get(h.id)||{m:{name:h.name,img:(typeof displayPokemonImage==="function"?displayPokemonImage(h):"")||""},n:0,share:true};
          g.n+=add;g.total=h.currentPpg;g.max=h.currentPpg>=15;g.half=!!h.ppgShareHalf;shareGains.set(h.id,g);RUN.ppg[h.id]=(RUN.ppg[h.id]||0)+add;
        }}catch(e){console.error(e);}
        gains.push({ri,m:{name:m.name,img:m.img},n:0,total:Number(p?.currentPpg||0),why:passed?`nível bem acima · passou 1 PPg pelo Exp. Share`:"nível bem acima do rival"});return;
      }
      if(!p)return;
      const before=Math.max(0,Number(p.currentPpg||0)),after=Math.min(15,before+info.ppg);
      p.currentPpg=after;RUN.ppg[m.fid]=(RUN.ppg[m.fid]||0)+(after-before);
      gains.push({ri,m:{name:m.name,img:m.img},n:after-before,total:after,max:after>=15});
      // Exp. Share: quem segura (na Equipe) recebe metade do que este Pokémon ganhou
      try{for(const x of (window.hhPpg?.expShareList?.(p,after-before)||[])){
        const g=shareGains.get(x.p.id)||{m:{name:x.p.name,img:(typeof displayPokemonImage==="function"?displayPokemonImage(x.p):"")||""},n:0,share:true};
        g.n+=x.add;g.total=x.total;g.max=x.total>=15;g.half=x.half;shareGains.set(x.p.id,g);
        RUN.ppg[x.p.id]=(RUN.ppg[x.p.id]||0)+x.add;
      }}catch(e){console.error(e);}
    });
    shareGains.forEach(g=>gains.push(g));
    RUN.lastGains=gains;
    saveNow();
    try{if(typeof renderAll==="function")setTimeout(()=>{try{renderAll();}catch(e){}},50);}catch(e){}
  }
  function onWaveEnd(){
    RUN.done=true;
    const st=B.state||null;
    if(B.view.winner==="p1"){
      RUN.cleared=RUN.wave;
      // guarda o HP que sobrou
      if(st)RUN.alive.forEach((ri,j)=>{const t=st.sides.p1.team[j];RUN.hp[ri]={hp:t.hp,maxHp:t.maxHp,fainted:t.fainted};});
      if(RUN.region){
        awardPpg();
        const id=RUN.region.id;state.arenaRegionBest=state.arenaRegionBest||{};
        if(RUN.cleared>regionBest(id)){state.arenaRegionBest[id]=RUN.cleared;saveNow();}
      }else{
        // recupera 10% de todos de pé
        RUN.hp.forEach(h=>{if(!h.fainted)h.hp=Math.min(h.maxHp,h.hp+Math.ceil(h.maxHp*.1));});
        if(RUN.cleared>Number(state.arenaSurvivalBest||0)){state.arenaSurvivalBest=RUN.cleared;saveNow();}
      }
      if(RUN.hp.every(h=>h.fainted))endRun();
    }else endRun();
  }
  function endRun(reason){
    if(!RUN||RUN.recorded)return;
    RUN.recorded=true;RUN.over=true;
    if(RUN.ch)send(RUN.ch,"runend",{text:`${me.name} terminou a corrida: ${RUN.cleared} ${RUN.region?"andar(es)":"onda(s)"} vencido(s).`});
    const foe=B?.teams?.p2?.[B?.state?.sides?.p2?.active||0]?.name||"";
    if(!RUN.region&&RUN.cleared>Number(state.arenaSurvivalBest||0)){state.arenaSurvivalBest=RUN.cleared;}
    saveNow();
    // toda corrida conta como tentativa no banco (as de 0 não aparecem no pódio)
    saveRank({waves:RUN.cleared,foe:reason?"":foe,quiet:RUN.cleared<1});
  }
  async function saveRank({waves,foe,quiet}){
    const run=RUN;if(!run)return;
    // artes enviadas na ficha (imagem embutida) viram uma miniatura de 56px
    const team=[];
    for(const m of run.team.slice(0,6)){
      let img=String(m.img||"");
      if(/^https?:/.test(img)&&img.length<300){}
      else if(img.startsWith("data:")){img=await compactImage(img,56);if(img.length>12000)img="";}
      else img="";
      team.push({n:String(m.name).slice(0,30),lv:Number(m.level||1),img});
    }
    const dmg=run.dmg==="matrix"?"matrix":"classic";
    try{
      await loadSb();sb=sb||window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const row={player:String(me.name||"Treinador").slice(0,24)||"Treinador",player_key:playerKey().slice(0,64),waves:Math.max(0,Math.min(999,Number(waves)||0)),team,damage_mode:dmg,last_foe:String(foe||"").slice(0,40)||null,mode:run.mode||"endless"};
      let {error}=await sb.from("arena_survival_ranking").insert(row);
      // se o banco recusar (ex.: fotos grandes demais), tenta de novo só com os links
      if(error){row.team=team.map(t=>({...t,img:/^https?:/.test(t.img||"")?t.img:""}));({error}=await sb.from("arena_survival_ranking").insert(row));}
      if(error)throw error;
      if(!quiet)toast("Corrida registrada no ranking!");RANK.at=0;if(RANK.mode===(run.mode||"endless"))loadRank(true);
    }catch(e){if(!quiet)toast("Não consegui salvar no ranking.");}
  }
  function applyReward(kind){
    if(!RUN||RUN.over)return;
    if(!RUN.region){
      if(kind==="heal")RUN.hp.forEach(h=>{if(!h.fainted)h.hp=Math.min(h.maxHp,h.hp+Math.ceil(h.maxHp*.35));});
      if(kind==="revive"){const h=RUN.hp.find(x=>x.fainted);if(h){h.fainted=false;h.hp=Math.ceil(h.maxHp*.5);}}
      if(kind==="train")RUN.train=Math.min(3,RUN.train+1);
    }
    B=null;nextWave();
  }

  /* ---------- Mochila (itens reais da Bolsa da ficha) ---------- */
  const ITEM_KINDS=new Set(["healFlat","healFraction","healFull","fullRestore","reviveFraction","reviveFull","cureCondition","cureAll","stage"]);
  function bagList({between=false}={}){
    const out=[];
    try{
      initializeUnifiedBagInventory();
      for(const [slug,q] of Object.entries(state.combatBag||{})){
        const qty=Math.floor(Number(q||0));if(qty<=0)continue;
        const item=BAG_CONSUMABLE_BY_SLUG.get(slug);if(!item)continue;
        const spec=bagItemUseSpec(item);if(!spec||!ITEM_KINDS.has(spec.kind))continue;
        if(between&&!/^(heal|full|revive)/.test(spec.kind))continue;
        out.push({slug,name:item.name,qty,spec,desc:String(item.description||"").slice(0,140),revive:/^revive/.test(spec.kind),src:"Bolsa"});
      }
    }catch(e){}
    // itens comprados na Loja do Treinador (inventário do treinador)
    try{
      const items=ensureTrainerData().inventory?.items||[];
      for(const i of items){
        if(!(Number(i.qty)>0)||!(i.usable||i.category==="consumables"))continue;
        const spec=invItemSpec(i);if(!spec||!ITEM_KINDS.has(spec.kind))continue;
        if(between&&!/^(heal|full|revive)/.test(spec.kind))continue;
        let hit=null;try{hit=officialItemByQuery(i.name);}catch(e){}
        out.push({slug:"inv:"+i.id,name:i.name,qty:Number(i.qty),spec,desc:String(i.desc||"").slice(0,140),revive:/^revive/.test(spec.kind),src:"Inventário",
          img:hit?.apiName?itemImg(hit.apiName):"",icon:i.icon||"🧪"});
      }
    }catch(e){}
    const order={reviveFull:0,reviveFraction:1,fullRestore:2,healFull:3,healFraction:4,healFlat:5};
    return out.sort((a,b)=>(order[a.spec.kind]??9)-(order[b.spec.kind]??9)||a.name.localeCompare(b.name));
  }
  /* Efeito de um item do inventário do treinador: o texto da loja manda
     ("Cura 50 HP", "Cura totalmente"); senão, o item oficial de mesmo nome. */
  function invItemSpec(i){
    const d=String(i.desc||"");
    let m=/(?:cura|restaura|recupera)\s+(\d+)\s*(?:de\s+)?HP/i.exec(d);
    if(/revive|reviver|reanima/i.test(i.name+" "+d)){
      if(/totalmente|todo o HP|max/i.test(i.name+" "+d))return {kind:"reviveFull"};
      return {kind:"reviveFraction",num:1,den:2};
    }
    if(m)return {kind:"healFlat",amount:Number(m[1])};
    if(/cura totalmente|restaura todo|HP (?:total|cheio)|todo o HP/i.test(d))return /status|condi/i.test(d)?{kind:"fullRestore"}:{kind:"healFull"};
    try{const hit=officialItemByQuery(i.name);const item=hit&&BAG_CONSUMABLE_BY_SLUG.get(hit.apiName);if(item)return bagItemUseSpec(item);}catch(e){}
    if(/cura (?:todos os )?status|cura todas as condi/i.test(d))return {kind:"cureAll"};
    return null;
  }
  function spendItem(slug){
    try{
      if(String(slug).startsWith("inv:")){
        const it=(ensureTrainerData().inventory?.items||[]).find(x=>"inv:"+x.id===slug);
        if(!it||!(it.qty>0))return false;
        it.qty-=1;saveNow();try{document.dispatchEvent(new CustomEvent("hh:render"));}catch(e){}return true;
      }
      const q=bagQuantity(slug);if(q<=0)return false;setBagQuantity(slug,q-1,{render:false,save:true});saveNow();return true;
    }catch(e){return false;}
  }
  const itemImg=slug=>{try{return pokeApiItemSpriteUrl(slug);}catch(e){return "";}};
  /* Entre andares: a cura vem só da Mochila */
  function useItemBetween(slug,ri){
    const it=bagList({between:true}).find(x=>x.slug===slug);const h=RUN?.hp?.[ri];
    if(!it||!h)return;
    const e=it.spec;
    if(it.revive!==!!h.fainted){toast(it.revive?"Esse item é para quem desmaiou.":"Quem desmaiou precisa de um Revive.");return;}
    if(!it.revive&&h.hp>=h.maxHp){toast("O HP já está cheio.");return;}
    if(!spendItem(slug))return;
    if(it.revive){h.fainted=false;h.hp=e.kind==="reviveFull"?h.maxHp:Math.max(1,Math.floor(h.maxHp*(e.num||1)/(e.den||2)));}
    else{const add=e.kind==="healFlat"?(e.amount||20):e.kind==="healFraction"?Math.floor(h.maxHp*(e.num||1)/(e.den||4)):h.maxHp;h.hp=Math.min(h.maxHp,h.hp+Math.max(1,add));}
    B.betweenItem="";sfx("select");toast(`${it.name} em ${RUN.team[ri].name}.`);render();
  }
  function bagPanel(between){
    const list=bagList({between});
    const sel=B.bagItem||B.betweenItem||"";
    const it=list.find(x=>x.slug===sel);
    const team=between?RUN.team:B.teams[mySide()];
    const hpOf=i=>between?RUN.hp[i]:B.view.sides[mySide()].team[i];
    return `<div class="ar9-bag">
      <p class="ar9-bag-title">🎒 Mochila <small>itens reais da Bolsa da ficha · cada uso gasta 1</small></p>
      ${list.length?`<div class="ar9-bag-items">${list.map(x=>`<button type="button" class="ar9-item${x.slug===sel?" on":""}" data-ar="${between?"bag-between":"bag-pick"}" data-slug="${esc(x.slug)}" title="${esc(x.desc)}">${x.img||!x.slug.startsWith("inv:")?`<img src="${esc(x.img||itemImg(x.slug))}" alt="" width="30" height="30" loading="lazy">`:`<i class="ar9-item-ico">${esc(x.icon||"🧪")}</i>`}<b>${esc(x.name)}</b><small>×${x.qty}</small></button>`).join("")}</div>`
        :`<p class="ar7-empty-text">Nenhum item de cura na Bolsa. Compre ou ganhe itens na ficha (aba Bolsa).</p>`}
      ${it?`<p class="ar9-bag-title">Usar <b>${esc(it.name)}</b> em:</p><div class="ar7-party">${team.map((m,i)=>{const st=hpOf(i);const dis=it.revive!==!!st.fainted;return `<button type="button" class="ar7-switch" data-ar="${between?"bag-use-between":"bag-use"}" data-slug="${esc(it.slug)}" data-idx="${i}" ${dis?"disabled":""}>
        ${m.img?`<img src="${esc(m.img)}" alt="" width="34" height="34">`:`<i>${esc(m.name.slice(0,1))}</i>`}<span><b>${esc(m.name)}</b><small class="${hpClass(hpPct(st))}">${st.fainted?"desmaiado":`${st.hp}/${st.maxHp}`}</small></span></button>`;}).join("")}</div>`:""}
    </div>`;
  }
  function regionPanel(v){
    const R0=RUN.region,won=v.winner==="p1"&&!RUN.over;
    const totalPpg=Object.values(RUN.ppg||{}).reduce((a,b)=>a+b,0);
    if(won)return floorPanel(R0);
    const best=regionBest(R0.id);
    return `<div class="ar7-result lose"><b>${RUN.cleared>=R0.floors?"🏔 Você voltou do Coração do Abismo!":"O abismo venceu desta vez…"}</b>
      <small>Andares vencidos: <b>${RUN.cleared}</b> (${RUN.cleared*40} m). Recorde em ${esc(R0.city)}: <b>${best}</b>. PPg ganhos nesta descida: <b>${totalPpg}</b>. Esta foi a sua <b>${RUN.attempt||myAttempts(R0.id)}ª tentativa</b>.${RUN.cleared>=1?" A descida foi para o ranking.":""}</small>
      <div class="ar7-modal-actions"><button type="button" class="ar7-btn" data-ar="leave">Voltar ao lobby</button><button type="button" class="ar7-btn primary" data-ar="region-again">Descer de novo</button></div></div>`;
  }
  /* Andar vencido no Abismo: prêmios de PPg, próximo andar, time (ordem e
     HP) e Mochila — tudo num painel só, com o tema de caverna. */
  function floorPanel(R0){
    const info=RUN.waveInfo||{},next=SURV()?.regionInfo(R0.id,RUN.wave+1);
    const gains=RUN.lastGains||[];
    const floors=R0.floors||16,pct=Math.min(100,Math.round(100*RUN.wave/floors));
    const list=bagList({between:true});
    const sel=B.betweenItem||"",it=list.find(x=>x.slug===sel);
    const mon=(m)=>m.img?`<img src="${esc(m.img)}" alt="" loading="lazy">`:`<i>${esc(String(m.name||"?").slice(0,1))}</i>`;
    const kind=next?.boss?["boss","👑 Guardião"]:next?.elite?["elite","🧗 Montanhista"]:["wild","🪨 Selvagem"];
    const gainCard=g=>{
      const m=g.m||RUN.team[g.ri]||{};const tot=Number(g.total||0);
      const status=g.share?`🔗 Exp. Share${g.half?" · +½ guardado":""}`:g.n?(g.max?"Reserva cheia":"Ganhou neste andar"):(g.why||"Reserva cheia (15)");
      return `<li class="ab9-gain${g.n?"":" none"}${g.share?" share":""}"><span class="ab9-mon">${mon(m)}</span>
        <span class="ab9-gain-txt"><b>${esc(m.name)}</b><small>${esc(status)}</small>
          <span class="ab9-meter" title="${tot}/15 PPg"><i style="width:${Math.round(100*tot/15)}%"></i></span></span>
        <em class="ab9-plus">${g.n?`+${g.n}`:"—"}<small>${g.n?"PPg":tot>=15?"15/15":""}</small></em></li>`;
    };
    const teamCard=(m,i)=>{
      const h=RUN.hp[i];const pc=h.fainted?0:Math.round(100*h.hp/h.maxHp);
      const can=it&&(it.revive===!!h.fainted)&&(it.revive||h.hp<h.maxHp);
      return `<li class="ab9-member${h.fainted?" out":""}${it?(can?" target":" dim"):""}">
        <span class="ab9-pos">${i+1}º</span><span class="ab9-mon">${mon(m)}</span>
        <span class="ab9-member-txt"><b>${esc(m.name)}</b>
          <span class="ab9-hp ${pc<=25?"low":pc<=50?"mid":""}"><i style="width:${pc}%"></i></span>
          <small>${h.fainted?"desmaiado":`${h.hp}/${h.maxHp} HP`}</small></span>
        <span class="ab9-member-acts">${it?`<button type="button" class="ab9-use" data-ar="bag-use-between" data-slug="${esc(it.slug)}" data-idx="${i}" ${can?"":"disabled"}>${can?"Usar":"—"}</button>`
          :i>0?`<button type="button" data-ar="run-lead" data-i="${i}" title="Começar com ${esc(m.name)}" aria-label="Começar com ${esc(m.name)}">★</button><button type="button" data-ar="run-up" data-i="${i}" title="Subir na ordem" aria-label="Subir ${esc(m.name)}">▲</button>`:`<em title="Começa o próximo andar">LÍDER</em>`}</span></li>`;
    };
    return `<section class="ab9">
      <header class="ab9-head">
        <span class="ab9-badge ab9-e">🏔️</span>
        <div class="ab9-title"><small>Abismo Rochoso · ${esc(R0.city||"")}</small><b>Andar ${RUN.wave} vencido!</b><span>${info.depth||RUN.wave*40} m · ${esc(info.zone||"")}</span></div>
        <div class="ab9-depth" title="${RUN.wave}/${floors} andares até o Coração do Abismo"><span>${RUN.wave}<small>/${floors}</small></span><i><em style="height:${pct}%;--w:${pct}%"></em></i></div>
      </header>
      <div class="ab9-grid">
        <div class="ab9-col">
          <article class="ab9-card"><h4><i class="ab9-e">⭐</i> PPg do andar <small>${gains.reduce((a,g)=>a+(g.n||0),0)} no total</small></h4>
            ${gains.length?`<ul class="ab9-gains">${gains.map(gainCard).join("")}</ul>`:`<p class="ab9-empty">Ninguém ganhou PPg neste andar.</p>`}</article>
          ${next?`<article class="ab9-card ab9-next ${kind[0]}"><h4><i class="ab9-e">⬇️</i> Próximo: Andar ${next.n}</h4>
            <div class="ab9-next-row"><span class="ab9-kind">${kind[1]}</span><span><b>Lv. ${next.level}</b><small>nível</small></span><span><b>${next.depth} m</b><small>profundidade</small></span><span><b>+${next.ppg}</b><small>PPg por Pokémon</small></span></div>
            <p>${esc(next.zone||"")}${next.count>1?` · ${next.count} rivais`:""}</p></article>`:""}
        </div>
        <div class="ab9-col">
          <article class="ab9-card"><h4><i class="ab9-e">🔀</i> Seu time <small>${it?`toque em <b>Usar</b> para dar ${esc(it.name)}`:"o 1º de pé começa · ★ lidera · ▲ sobe"}</small></h4>
            <ol class="ab9-team">${RUN.team.map(teamCard).join("")}</ol></article>
          <article class="ab9-card ab9-bag"><h4><i class="ab9-e">🎒</i> Mochila <small>sem cura grátis no abismo · cada uso gasta 1</small></h4>
            ${list.length?`<div class="ab9-items">${list.map(x=>`<button type="button" class="ab9-item${x.slug===sel?" on":""}" data-ar="bag-between" data-slug="${esc(x.slug)}" title="${esc(x.desc)}" aria-pressed="${x.slug===sel}">${x.img||!x.slug.startsWith("inv:")?`<img src="${esc(x.img||itemImg(x.slug))}" alt="" loading="lazy">`:`<i>${esc(x.icon||"🧪")}</i>`}<b>${esc(x.name)}</b><small>×${x.qty}</small></button>`).join("")}</div>
              ${it?`<p class="ab9-hint">Escolha quem recebe <b>${esc(it.name)}</b> no time acima, ou toque no item de novo para cancelar.</p>`:`<p class="ab9-hint">Toque num item e depois em <b>Usar</b> no Pokémon.</p>`}`
              :`<p class="ab9-empty">Nenhum item de cura na Bolsa. Compre na Mochila da ficha.</p>`}</article>
        </div>
      </div>
      <footer class="ab9-actions"><button type="button" class="ab9-btn" data-ar="region-stop"><i class="ab9-e">⬆️</i> Subir e encerrar</button><button type="button" class="ab9-btn go" data-ar="surv-reward" data-v="next"><i class="ab9-e">⬇️</i> Descer ao andar ${RUN.wave+1}</button></footer>
    </section>`;
  }
  function survivalPanel(v){
    if(RUN?.region)return regionPanel(v);
    const won=v.winner==="p1"&&RUN&&!RUN.over;
    if(won){
      const anyFainted=RUN.hp.some(h=>h.fainted);
      const next=SURV()?.waveInfo(RUN.wave+1,Math.round(RUN.team.reduce((x,m)=>x+Number(m.level||1),0)/RUN.team.length));
      return `<div class="ar7-result win ar7-surv-win"><b>🏆 Onda ${RUN.wave} vencida!</b>
        <small>Seu time recuperou 10% do HP. Escolha um prêmio antes da onda ${RUN.wave+1}${next?` (Lv. ${next.level}${next.boss?" · CHEFE":next.elite?" · Elite":""})`:""}:</small>
        <div class="ar7-rewards">
          <button type="button" class="ar7-reward" data-ar="surv-reward" data-v="heal"><span>💚</span><b>Curar</b><small>+35% de HP para todos de pé</small></button>
          <button type="button" class="ar7-reward" data-ar="surv-reward" data-v="revive" ${anyFainted?"":"disabled"}><span>✨</span><b>Reviver</b><small>${anyFainted?"Um desmaiado volta com 50%":"Ninguém desmaiou"}</small></button>
          <button type="button" class="ar7-reward" data-ar="surv-reward" data-v="train" ${RUN.train>=3?"disabled":""}><span>💪</span><b>Treinar</b><small>+1 Attack e Sp.Atk para o time (${RUN.train}/3)</small></button>
        </div>
        <div class="ar7-surv-hp">${RUN.team.map((m,i)=>{const h=RUN.hp[i];const pc=Math.round(100*h.hp/h.maxHp);return `<span class="${h.fainted?"out":""}" title="${esc(m.name)}">${m.img?`<img src="${esc(m.img)}" alt="" width="28" height="28">`:""}<i style="--p:${h.fainted?0:pc}%"></i></span>`;}).join("")}</div>
        ${runOrderRow()}
      </div>`;
    }
    const best=Number(state.arenaSurvivalBest||0);
    return `<div class="ar7-result lose"><b>Fim da corrida!</b>
      <small>Você venceu <b>${RUN?.cleared||0}</b> onda${(RUN?.cleared||0)===1?"":"s"}. Seu recorde: <b>${best}</b>. Esta foi a sua <b>${RUN?.attempt||myAttempts("endless")}ª tentativa</b>.${(RUN?.cleared||0)>=1?" A corrida foi para o ranking.":""}</small>
      <div class="ar7-modal-actions"><button type="button" class="ar7-btn" data-ar="leave">Voltar ao lobby</button><button type="button" class="ar7-btn primary" data-ar="surv-again">Jogar de novo</button></div></div>`;
  }
  /* ---------- Ordem do time antes de começar ---------- */
  let orderAsk=null;
  function askOrder(id){if(B)return;if(!teamSource().length){toast("Monte um time primeiro.");return;}orderAsk={id};sfx("select");render();}
  function orderDialog(){
    const team=teamSource(),R0=orderAsk.id?REG(orderAsk.id):null;
    const face=p=>{const img=localImg(p);return img?`<img src="${esc(img)}" alt="" width="44" height="44">`:`<i>${esc((p.name||"?").slice(0,1))}</i>`;};
    return `<div class="ar7-modal" role="dialog" aria-modal="true" aria-labelledby="ar9OrdTitle"><div class="ar7-modal-box ar9-order">
      <span class="ar7-modal-ico" aria-hidden="true">${R0?PX("abyss",44):PX("tower",44)}</span>
      <h3 id="ar9OrdTitle">${R0?`Descer no ${esc(R0.area)}`:"Desafio Sem Fim"}</h3>
      <p>Escolha a ordem: o 1º começa a luta e os outros entram nessa ordem quando alguém desmaia.</p>
      <ol class="ar7-pick-list">${team.map((p,i)=>`<li class="${i===0?"lead":""}" style="--t:${typeColor(p.type1)}">
        <span class="ar7-pick-face">${face(p)}</span>
        <span class="ar7-pick-name"><b>${esc(p.name)}</b><small>${i===0?"Começa a luta":`${i+1}º`} · Lv${Number(p.level||1)}</small></span>
        <span class="ar7-pick-acts">
          ${i>0?`<button type="button" data-ar="pick-lead" data-id="${esc(String(p.id))}" title="Começar com ${esc(p.name)}" aria-label="Começar com ${esc(p.name)}">★</button><button type="button" data-ar="pick-left" data-id="${esc(String(p.id))}" aria-label="Subir ${esc(p.name)}">▲</button>`:""}
          ${i<team.length-1?`<button type="button" data-ar="pick-down" data-id="${esc(String(p.id))}" aria-label="Descer ${esc(p.name)}">▼</button>`:""}
        </span></li>`).join("")}</ol>
      <p class="ar7-hint">É a mesma ordem do Trainer Card e da Equipe da ficha: mudando aqui, muda lá. Para trocar quem vai, use a aba <b>Meu time</b>.</p>
      <div class="ar7-modal-actions"><button type="button" class="ar7-btn" data-ar="order-cancel">Cancelar</button><button type="button" class="ar7-btn primary" data-ar="order-go">${R0?"⬇ Descer":"▶ Começar"}</button></div>
    </div></div>`;
  }
  /* Entre andares: muda quem começa o próximo */
  function runMove(i,lead){
    if(!RUN||RUN.over)return;
    const j=lead?0:i-1;if(i<=0||j<0||i>=RUN.team.length)return;
    const mv=(arr)=>{const x=arr.splice(i,1)[0];arr.splice(j,0,x);};
    mv(RUN.team);mv(RUN.hp);
    sfx("select");render(true);
  }
  function runOrderRow(){
    return `<div class="ar9-runorder"><p class="ar9-bag-title">🔀 Ordem para o próximo ${RUN.region?"andar":"onda"} <small>o 1º de pé começa</small></p>
      <ol>${RUN.team.map((m,i)=>{const h=RUN.hp[i];return `<li class="${h.fainted?"out":""}">${m.img?`<img src="${esc(m.img)}" alt="" width="30" height="30">`:""}<b>${esc(m.name)}</b><small>${h.fainted?"desmaiado":`${h.hp}/${h.maxHp}`}</small>
        ${i>0?`<span><button type="button" data-ar="run-lead" data-i="${i}" title="Começar com ${esc(m.name)}" aria-label="Começar com ${esc(m.name)}">★</button><button type="button" data-ar="run-up" data-i="${i}" aria-label="Subir ${esc(m.name)}">▲</button></span>`:"<em>1º</em>"}</li>`;}).join("")}</ol></div>`;
  }
  function challengeDialog(){
    const p=incoming;
    return `<div class="ar7-modal" role="alertdialog" aria-modal="true" aria-labelledby="ar7ChTitle">
      <div class="ar7-modal-box"><span class="ar7-modal-ico" aria-hidden="true">⚔</span>
        <h3 id="ar7ChTitle">${esc(p.fromName)} te desafiou!</h3>
        ${sceneOk(p.arena)?`<i class="ar7-modal-scene" style="background-image:url('assets/arenas/${esc(p.arena)}.png')"></i>`:""}<p>Formato: <b>${p.format===1?"1 vs 1":p.format>=6?"time todo (até 6)":`${p.format} vs ${p.format}`}</b>${sceneOk(p.arena)?` · Ambiente: <b>${esc(sceneLabel(p.arena))}</b>`:""} · <b>${DMG_LABEL[p.dmg==="matrix"?"matrix":"classic"]}</b>. Vai o time que você montou na arena (o primeiro começa).</p>
        <div class="ar7-modal-actions"><button type="button" class="ar7-btn" data-ar="decline">Recusar</button><button type="button" class="ar7-btn primary" data-ar="accept">Aceitar</button></div>
      </div></div>`;
  }

  function hudBadges(s){
    const st=s.team[s.active]||{};let h="";
    if(st.status)h+=`<b class="ar7-st ${st.status}" title="${esc(ST_LABEL[st.status]||"")}">${ST_SHORT[st.status]||st.status}</b>`;
    if(s.cnf)h+=`<b class="ar7-st cnf" title="Confuso">CNF</b>`;
    for(const [k,v] of Object.entries(s.stg||{}))if(v)h+=`<i class="ar7-stg ${v>0?"up":"down"}" title="${STAT_PT[k]} ${v>0?"+":""}${v}">${STAT_SHORT[k]} ${v>0?"+":""}${v}</i>`;
    if(s.crit)h+=`<i class="ar7-stg up" title="Crítico aumentado">CRIT +${s.crit}</i>`;
    if(s.swagger)h+=`<i class="ar7-stg swag" title="Swagger Mode">SWAGGER</i>`;
    if(s.semi)h+=`<i class="ar7-stg semi" title="Invulnerável neste turno">${{fly:"🪽 NO AR",dig:"⛏ SUBTERRÂNEO",dive:"🌊 SUBMERSO",phantom:"👻 SUMIDO"}[s.semi]||"OCULTO"}</i>`;
    if(s.sub)h+=`<i class="ar7-stg sub" title="Substituto com ${s.sub} HP">🧸 SUB ${s.sub}</i>`;
    if(s.forced==="recharge")h+=`<i class="ar7-stg down" title="Precisa recarregar">RECARGA</i>`;
    if(s.perish)h+=`<i class="ar7-stg down" title="Perish Song">💀 ${s.perish}</i>`;
    if(s.cursed)h+=`<i class="ar7-stg down" title="Amaldiçoado: perde 1/4 do HP por turno">MALDIÇÃO</i>`;
    if(s.seeded)h+=`<i class="ar7-stg down" title="Leech Seed: perde 1/8 do HP por turno">🌱 SEMENTE</i>`;
    if(s.taunt)h+=`<i class="ar7-stg down" title="Taunt: só pode atacar">TAUNT ${s.taunt}</i>`;
    if(s.encore!=null)h+=`<i class="ar7-stg down" title="Encore: repete o mesmo golpe">ENCORE</i>`;
    if(s.disable!=null)h+=`<i class="ar7-stg down" title="Um golpe está bloqueado">DISABLE</i>`;
    if(s.yawn)h+=`<i class="ar7-stg down" title="Vai dormir no fim do próximo turno">😪 SONO</i>`;
    return h;
  }
  function fieldChips(){
    const v=B.view;let h="";
    if(v.weather)h+=`<b class="ar7-chip w-${v.weather.kind}">${W_ICON[v.weather.kind]||""} ${W_LABEL[v.weather.kind]||""} <small>${v.weather.turns}</small></b>`;
    for(const k of ["p1","p2"]){const f=v.sides[k].field||{},hz=v.sides[k].hazards||{},nm=esc(sideName(k));
      if(f.royal>0)h+=`<b class="ar7-chip royal">👑 Campo Real · ${nm} <small>${f.royal}</small></b>`;
      if(f.reflect>0)h+=`<b class="ar7-chip scr">🛡 Reflect · ${nm} <small>${f.reflect}</small></b>`;
      if(f.light>0)h+=`<b class="ar7-chip scr">✨ Light Screen · ${nm} <small>${f.light}</small></b>`;
      if(f.veil>0)h+=`<b class="ar7-chip scr">🌌 Aurora Veil · ${nm} <small>${f.veil}</small></b>`;
      if(f.tailwind>0)h+=`<b class="ar7-chip tw">🍃 Tailwind · ${nm} <small>${f.tailwind}</small></b>`;
      if(hz.rocks)h+=`<b class="ar7-chip hz">🪨 Stealth Rock · ${nm}</b>`;
      if(hz.spikes)h+=`<b class="ar7-chip hz">📌 Spikes ×${hz.spikes} · ${nm}</b>`;
      if(hz.web)h+=`<b class="ar7-chip hz">🕸 Sticky Web · ${nm}</b>`;
      if(hz.tspikes)h+=`<b class="ar7-chip hz">☠ Toxic Spikes ×${hz.tspikes} · ${nm}</b>`;}
    if(v.sides.p1.trick>0)h+=`<b class="ar7-chip trick">🌀 Trick Room <small>${v.sides.p1.trick}</small></b>`;
    return h;
  }
  function monCard(side,pos){
    const v=B.view,s=v.sides[side],t=B.teams[side],m=t[s.active],st=s.team[s.active];
    const pct=hpPct(st);
    return `<div class="ar7-spot ${pos}">
      <div class="ar7-hud"><div class="ar7-hud-name"><b>${esc(m.name)}</b><small>Lv. ${m.level}</small></div>
        ${m.build&&pos==="foe"?`<small class="ar7-build">${esc(m.build)}${m.ability?` · ${esc(m.ability)}`:""}</small>`:""}
        ${m.item?.name&&!s.itemGone?`<small class="ar9-hud-item" title="Item segurado">🎒 ${esc(m.item.name)}</small>`:""}
        <div class="ar7-hud-types">${(m.types||[]).map(x=>`<i style="--t:${typeColor(x)};--td:${typeDark(x)}">${esc(x)}</i>`).join("")}</div>
        <div class="ar7-hp ${hpClass(pct)}"><span>HP</span><div><i data-to="${pct}" style="--w:${lastHp[pos]??pct}%"></i></div>${pos==="me"?`<small class="ar7-hp-num">${st.hp} / ${st.maxHp}</small>`:""}</div>
        <div class="ar7-balls">${s.team.map(x=>`<i class="${x.fainted?"out":""}"></i>`).join("")}</div>
        <div class="ar7-badges">${hudBadges(s)}</div>
      </div>
      <div class="ar7-mon ${pos}${st.fainted?" fainted":""}${B.intro?" intro":""}">${m.img?`<img src="${esc(m.img)}" alt="${esc(m.name)}">`:`<i>${esc(m.name.slice(0,1))}</i>`}</div>
    </div>`;
  }
  const lastHp={};
  function battleView(){
    if(B.solo&&(!B.view||!B.teams))return `<div class="ar7-card ar7-empty ar7-surv-load${RUN?.region?" ar9-abyss-load":""}"><span class="ar7-surv-ico">${RUN?.region?PX("abyss",56):"🗼"}</span><b>${RUN?.error?esc(RUN.error):RUN?.region?`Andar ${RUN.wave} · ${RUN.wave*40} m: algo se mexe nas pedras…`:`Onda ${RUN?.wave||1}: chamando um Pokémon selvagem…`}</b><p>${RUN?.error?"Confira a internet e tente de novo.":RUN?.region?`Só Pokémon do tipo ${esc(RUN.region.typePt)} vivem no ${esc(RUN.region.area)}.`:"Buscando na PokéAPI e distribuindo os atributos."}</p>${RUN?.error?`<button type="button" class="ar7-btn primary" data-ar="surv-retry">Tentar de novo</button>`:""}<button type="button" class="ar7-btn" data-ar="leave">Voltar ao lobby</button></div>`;
    if(!B.view||!B.teams)return `<div class="ar7-card ar7-empty"><b>${B.role==="spec"?"Entrando para assistir…":"Preparando a batalha…"}</b><p>${B.role==="spec"?"Buscando o estado da batalha.":"Esperando os dois times chegarem."}</p><button type="button" class="ar7-btn" data-ar="leave">Voltar ao lobby</button></div>`;
    const v=B.view,mine=mySide(),foe=mine==="p1"?"p2":"p1";
    const specs=Object.values(B.specs||{});
    const ended=v.phase==="end";
    let panel="";
    if(ended&&B.solo)panel=survivalPanel(v);
    else if(ended){
      const win=v.winner;
      panel=`<div class="ar7-result ${win===B.role?"win":win?"lose":""}"><b>${win?(B.role===win?"🏆 Você venceu!":B.role==="spec"?`🏆 ${esc(sideName(win))} venceu!`:"Você perdeu…"):"Batalha encerrada"}</b>
        <button type="button" class="ar7-btn primary" data-ar="leave">Voltar ao lobby</button></div>`;
    }else if(B.role==="spec"){
      panel=`<div class="ar7-waiting">👁 Você está assistindo. ${["p1","p2"].map(s=>`${esc(sideName(s))}: ${v.sides[s].ready?"✓ escolheu":"pensando…"}`).join(" · ")}</div>`;
    }else{
      const s=v.sides[mine],team=B.teams[mine];
      const mustSwitch=v.phase==="switch"&&s.needSwitch;
      const waitingSwitch=v.phase==="switch"&&!s.needSwitch;
      if(B.playing)panel=`<div class="ar7-waiting ar7-dots">Resolvendo o turno</div>`;
      else if(waitingSwitch)panel=`<div class="ar7-waiting">Esperando ${esc(sideName(foe))} escolher o próximo Pokémon…</div>`;
      else if(s.ready||B.chosen)panel=`<div class="ar7-waiting">✓ Ação escolhida. Esperando ${esc(sideName(foe))}…</div>`;
      else if(!mustSwitch&&B.bagOpen&&s.items)panel=`<p class="ar7-ask">🎒 Usar um item gasta a ação de <b>${esc(team[s.active].name)}</b>.</p>${bagPanel(false)}<button type="button" class="ar7-btn" data-ar="bag-close">← Voltar aos golpes</button>`;
      else{
        const mon=team[s.active];
        const sel=B.sel||(B.sel={});
        const g=gimmicksFor(mine);
        const zOn=sel.gimmick==="z";
        const streak=s.evadeStreak||0;
        panel=`${mustSwitch?`<p class="ar7-ask">${esc(mon.name)} ${s.team?.[s.active]&&!s.team[s.active].fainted?"saiu de campo pelo item!":"desmaiou!"} Escolha o próximo:</p>`:`<p class="ar7-ask">O que <b>${esc(mon.name)}</b> vai fazer?</p>`}
          ${!mustSwitch&&s.forced?`<div class="ar9-forced"><p>${s.forced==="recharge"?`<b>${esc(mon.name)}</b> precisa recarregar depois do golpe forte.`:`<b>${esc(mon.name)}</b> continua o <b>${esc(s.forced)}</b>${s.semi?" (ainda invulnerável)":""}.`}</p><button type="button" class="ar7-btn primary" data-ar="move" data-idx="${s.forcedIdx??0}">▶ Continuar</button></div>`:""}
          ${mustSwitch||s.forced?"":`<div class="ar7-moves">${mon.moves.map((m,i)=>{const zOk=zOn&&g.z&&String(m.category).toLowerCase()!=="status"&&normalizeTypeName(m.type)===g.z;const locked=(s.lock!=null&&s.lock!==i)||(s.encore!=null&&s.encore!==i)||s.disable===i||(s.taunt>0&&String(m.category).toLowerCase()==="status");const zp=zOk?engine.zPower(m.power):0;return `<button type="button" class="ar7-move${zOk?" zmove":""}" data-ar="move" data-idx="${i}" ${(zOn&&!zOk)||locked?"disabled":""} ${locked?`title="Bloqueado (Choice, Encore, Disable ou Taunt)"`:""} style="--t:${typeColor(m.type)};--td:${typeDark(m.type)}" title="${esc(m.desc)}">
            <b>${zOk?"Z-":""}${esc(m.name)}</b><small>${esc(m.type)} · ${m.category==="Physical"?"Físico":m.category==="Special"?"Especial":"Status"}${(()=>{const q=m.power?qdPreview(v,mine,m,zOk?zp:Number(m.power)):null;const dmg=q?` · <em class="ar9-qd${q.mult>1?" se":q.mult<1?" nve":""}" title="${esc(q.title)}">${esc(q.label)}</em>`:"";return zOk?`${dmg} · não erra`:`${dmg}${m.accuracy!=null?` · ${m.accuracy}%`:""}`;})()}</small></button>`;}).join("")}</div>
          <div class="ar9-tactics">
            ${g.mega.length||g.tera||g.z?`<div class="ar9-gims" role="group" aria-label="Gimmicks (uma de cada por batalha)">
              ${g.mega.map((f,i)=>`<button type="button" class="ar9-gim mega${sel.gimmick==="mega"&&(sel.form||0)===i?" on":""}" data-ar="gim" data-v="mega" data-form="${i}" aria-pressed="${sel.gimmick==="mega"&&(sel.form||0)===i}" title="Mega Evolui antes de atacar: ${esc(f.name)} (${esc((f.types||[]).join("/"))})"><i>◆</i>${g.mega.length>1?esc(f.name):"Mega Evoluir"}</button>`).join("")}
              ${g.tera?`<button type="button" class="ar9-gim tera${sel.gimmick==="tera"?" on":""}" data-ar="gim" data-v="tera" aria-pressed="${sel.gimmick==="tera"}" style="--t:${typeColor(g.tera)}" title="Terastaliza antes de atacar: vira ${esc(g.tera)} e o STAB de ${esc(g.tera)} vira +2d6"><i>✦</i>Tera ${esc(g.tera)}</button>`:""}
              ${g.z?`<button type="button" class="ar9-gim z${zOn?" on":""}" data-ar="gim" data-v="z" aria-pressed="${zOn}" style="--t:${typeColor(g.z)}" title="Z-Move: um golpe ${esc(g.z)} com Power turbinado que não erra (1 por batalha)"><i>Z</i>Z-Move ${esc(g.z)}</button>`:""}
            </div>`:""}
            <div class="ar9-evade">
              <button type="button" class="ar9-react${sel.react?" on":""}" data-ar="react" aria-pressed="${!!sel.react}" title="Evasão Reativa: junto do golpe, a Precisão do rival cai 25"><i>↯</i>Esquiva reativa <small>−25 Precisão</small></button>
              <button type="button" class="ar9-active" data-ar="evade" title="Evasão Ativa: gasta a ação, a Precisão do rival cai 50"><i>🛡</i>Evasão ativa <small>gasta a ação · −50</small></button>
              ${s.items?`<button type="button" class="ar9-bagbtn" data-ar="bag-open"><i>🎒</i>Mochila <small>gasta a ação</small></button>`:""}
            </div>
            ${streak>=2?`<p class="ar9-tired">${streak>=3?"⚠ Cansado: a próxima evasão custa 1/16 do HP.":"Mais uma evasão seguida e o cansaço começa."}</p>`:""}
          </div>`}
          <p class="ar7-party-title">${mustSwitch?"Escolha quem entra:":`Trocar Pokémon <small>(gasta o turno)</small>`}</p>
          <div class="ar7-party">${team.map((m,i)=>{const st=s.team[i];const dis=st.fainted||i===s.active;return `<button type="button" class="ar7-switch" data-ar="switch" data-idx="${i}" ${dis?"disabled":""} title="Trocar para ${esc(m.name)}">
            ${m.img?`<img src="${esc(m.img)}" alt="" width="34" height="34">`:`<i>${esc(m.name.slice(0,1))}</i>`}<span><b>${esc(m.name)}</b><small class="${hpClass(hpPct(st))}">${st.fainted?"desmaiado":`${st.hp}/${st.maxHp}`}</small></span></button>`;}).join("")}</div>
          ${mustSwitch?"":`<button type="button" class="ar7-btn ar7-forfeit" data-ar="forfeit">🏳 Desistir</button>`}`;
      }
    }
    return `<section class="ar7-battle">
      <div class="ar7-vs"><b>${esc(sideName(foe))}</b><span>VS</span><b>${esc(sideName(mine))}</b><small>${B.role==="spec"&&B.sub?`${esc(B.sub)} · `:""}${B.solo&&RUN?.attempt?`🔁 ${RUN.attempt}ª tentativa · `:""}${B.solo&&RUN?.region?`⛰ ${esc(RUN.region.area)} · Andar ${RUN.wave} · ${RUN.waveInfo?.depth||RUN.wave*40} m${RUN.waveInfo?.boss?" · GUARDIÃO":RUN.waveInfo?.elite?" · Montanhista":""} · `:B.solo?`🗼 Onda ${RUN?.wave||1}${RUN?.waveInfo?.boss?" · CHEFE":RUN?.waveInfo?.elite?" · Elite":""} · `:""}Turno ${v.turn}${specs.length?` · 👁 ${specs.length}`:""}${B.dmg==="matrix"?"":" · Dano antigo (d6)"}</small></div>
      <div class="ar7-field" data-scene="${esc(B.arena||"standard")}" data-weather="${esc(B.view.weather?.kind||"")}" style="--ar7-t:-${(performance.now()/1000).toFixed(2)}s">
        <div class="ar7-fx" aria-hidden="true"></div><i class="ar7-plat foe" aria-hidden="true"></i><i class="ar7-plat me" aria-hidden="true"></i>
        ${monCard(foe,"foe")}${monCard(mine,"me")}
        ${B.intro?`<div class="ar7-vsintro" aria-hidden="true"><b class="l">${esc(sideName(foe))}</b><span>VS</span><b class="r">${esc(sideName(mine))}</b></div>`:""}
        <div class="ar7-wx" aria-hidden="true"></div>
        <div class="ar7-chips">${fieldChips()}</div>
        <span class="ar7-scene-tag">${esc(sceneLabel(B.arena))}</span>
      </div>
      <div class="ar7-msg" aria-hidden="true"><p>${B.log.length?B.log[B.log.length-1].line:`${esc(sideName(foe))} quer batalhar!`}</p></div>
      <div class="ar7-panel">${panel}</div>
      <div class="ar7-emotes" role="group" aria-label="Reações">${EMOTES.map(e=>`<button type="button" data-ar="emote" data-e="${esc(e)}">${esc(e)}</button>`).join("")}</div>
      <div class="ar7-log" aria-live="polite">${B.log.map(l=>`<p class="${l.cls}">${l.line}</p>`).join("")}</div>
      ${specs.length?`<p class="ar7-specs">👁 Assistindo: ${specs.map(esc).join(", ")}</p>`:""}
      ${!ended?`<button type="button" class="ar7-btn ar7-leave" data-ar="leave">${B.role==="spec"?"Parar de assistir":"Sair da batalha"}</button>`:""}
    </section>`;
  }

  /* ---------- Eventos ---------- */
  root.addEventListener("click",async e=>{
    const b=e.target.closest("[data-ar]");if(!b)return;
    const a=b.dataset.ar;
    if(a==="close")close();
    else if(a==="retry"){status="off";connect();}
    else if(a==="room")switchRoom(document.getElementById("ar7Room")?.value);
    else if(a==="share"){
      const url=`${location.origin}${location.pathname}?arena=${encodeURIComponent(room)}`;
      try{if(navigator.share)await navigator.share({title:"Arena Pokémon",text:`Vem lutar na sala ${room}!`,url});else{await navigator.clipboard.writeText(url);toast("Convite copiado!");}}catch(err){try{await navigator.clipboard.writeText(url);toast("Convite copiado!");}catch(e2){prompt("Copie o convite:",url);}}
    }
    else if(a==="challenge")challenge(b.dataset.to,Number(b.dataset.format));
    else if(a==="cancel"){if(outgoing){send(lobby,"challenge-cancel",{id:outgoing.id});outgoing=null;render();}}
    else if(a==="accept")reply(true);
    else if(a==="decline")reply(false);
    else if(a==="watch")spectate(b.dataset.id,{p1:b.dataset.p1,p2:b.dataset.p2});
    else if(a==="leave"){if(B&&B.role!=="spec"&&B.view&&B.view.phase!=="end"&&!confirm("Sair agora conta como desistência. Sair?"))return;leaveBattle();render();}
    else if(a==="move"){const sel=B?.sel||{};act({kind:"move",idx:Number(b.dataset.idx),react:!!sel.react,gimmick:sel.gimmick||"",form:sel.form||0});}
    else if(a==="gim"){const sel=B.sel=B.sel||{};const v=b.dataset.v,f=Number(b.dataset.form||0);if(sel.gimmick===v&&(sel.form||0)===f)sel.gimmick="";else{sel.gimmick=v;sel.form=f;}sfx("select");render(true);}
    else if(a==="react"){const sel=B.sel=B.sel||{};sel.react=!sel.react;sfx("select");render(true);}
    else if(a==="evade")act({kind:"evade"});
    else if(a==="bag-open"){B.bagOpen=true;B.bagItem="";render(true);}
    else if(a==="bag-close"){B.bagOpen=false;B.bagItem="";render(true);}
    else if(a==="bag-pick"){B.bagItem=B.bagItem===b.dataset.slug?"":b.dataset.slug;render(true);}
    else if(a==="bag-use"){
      const it=bagList().find(x=>x.slug===b.dataset.slug);if(!it)return;
      const idx=Number(b.dataset.idx);
      if(it.spec.kind==="stage"&&idx!==B.view.sides[mySide()].active){toast("Itens de estágio só no Pokémon em campo.");return;}
      if(!spendItem(it.slug))return;
      B.bagOpen=false;B.bagItem="";
      act({kind:"item",target:idx,slug:it.slug,name:it.name,effect:it.spec});
    }
    else if(a==="bag-between"){B.betweenItem=B.betweenItem===b.dataset.slug?"":b.dataset.slug;render(true);}
    else if(a==="bag-use-between")useItemBetween(b.dataset.slug,Number(b.dataset.idx));
    else if(a==="region-start")askOrder(b.dataset.v||"altamuralha");
    else if(a==="order-go"){const id=orderAsk?.id||"";orderAsk=null;startRun(id||undefined);}
    else if(a==="order-cancel"){orderAsk=null;render();}
    else if(a==="pick-down")editPick(ids=>{const i=ids.indexOf(b.dataset.id);if(i>=0&&i<ids.length-1)[ids[i+1],ids[i]]=[ids[i],ids[i+1]];return ids;});
    else if(a==="run-up"||a==="run-lead"){runMove(Number(b.dataset.i),a==="run-lead");}
    else if(a==="region-stop"){if(confirm("Subir agora encerra a descida e guarda o resultado no ranking. Encerrar?")){endRun("subiu");render();closeRunCh();B=null;RUN=null;track();render();}}
    else if(a==="region-again"){const id=RUN?.region?.id||"altamuralha";closeRunCh();B=null;RUN=null;askOrder(id);}
    else if(a==="rank-mode-open"){tab="ranking";ls.set("hh_arena_tab",tab);RANK.mode=b.dataset.v;RANK.list=null;RANK.at=0;render();loadRank(true);root.querySelector(".ar8-tabs")?.scrollIntoView({block:"nearest",behavior:"smooth"});}
    else if(a==="rank-mode"){RANK.mode=b.dataset.v;RANK.list=null;RANK.at=0;render();loadRank(true);}
    else if(a==="switch")act({kind:"switch",idx:Number(b.dataset.idx)});
    else if(a==="forfeit"){if(confirm("Desistir da batalha?"))act({kind:"forfeit"});}
    else if(a==="emote")emote(b.dataset.e);
    else if(a==="tab"){tab=b.dataset.v;ls.set("hh_arena_tab",tab);if(tab==="ranking")loadRank();sfx("select");render();root.querySelector(".ar8-tabs")?.scrollIntoView({block:"nearest",behavior:"smooth"});}
    else if(a==="surv-start")askOrder("");
    else if(a==="surv-retry"){if(RUN){RUN.error="";RUN.wave--;nextWave();}}
    else if(a==="surv-reward")applyReward(b.dataset.v);
    else if(a==="surv-again"){closeRunCh();B=null;RUN=null;askOrder("");}
    else if(a==="rank-reload")loadRank(true);
    else if(a==="pick-add")editPick(ids=>ids.length<6&&!ids.includes(b.dataset.id)?[...ids,b.dataset.id]:ids);
    else if(a==="pick-del")editPick(ids=>ids.filter(x=>x!==b.dataset.id));
    else if(a==="pick-lead")editPick(ids=>[b.dataset.id,...ids.filter(x=>x!==b.dataset.id)]);
    else if(a==="pick-left")editPick(ids=>{const i=ids.indexOf(b.dataset.id);if(i>0)[ids[i-1],ids[i]]=[ids[i],ids[i-1]];return ids;});
    else if(a==="pick-reset"){savePick([]);track();render();}
    else if(a==="pick-more"){pickOpen=!pickOpen;render();}
    else if(a==="scene"){scene=b.dataset.v;ls.set("hh_arena_scene",scene);sfx("select");render();}
  });
  root.addEventListener("submit",e=>{
    const f=e.target.closest("[data-ar-form]");if(!f)return;e.preventDefault();
    const input=document.getElementById("ar7Chat");const text=String(input?.value||"").trim();
    if(!text||!lobby)return;
    const msg={name:me.name,text,at:Date.now()};chat.push(msg);chat=chat.slice(-60);send(lobby,"chat",msg);input.value="";render();
  });
  root.addEventListener("change",e=>{
    if(e.target.id==="ar7Name"){
      const n=String(e.target.value||"").trim().slice(0,24);
      if(n){try{ensureTrainerData().name=n;(typeof debouncedSave==="function"?debouncedSave:saveState)();if(typeof renderAll==="function")renderAll();}catch(err){}}
      track();render();
    }
  });
  root.addEventListener("keydown",e=>{
    if(e.key==="Enter"&&e.target.id==="ar7Room"){e.preventDefault();switchRoom(e.target.value);}
    if(e.key==="Escape"&&orderAsk){orderAsk=null;render();return;}
    if(e.key==="Escape"&&!incoming&&!B)close();
  });
  window.addEventListener("beforeunload",()=>{if(B)leaveBattle(true);});

  // Convite: ?arena=sala abre direto na arena
  if(new URLSearchParams(location.search).has("arena"))setTimeout(open,600);
})();
