/* ============================================================
   V7 — 🧭 Modo Exploração e Viagem (Elysius · continente de Helikon)
   O treinador explora as áreas da região onde está para encontrar
   Pokémon selvagens e itens. Cada passo gasta a Vida do treinador
   (atributo Vida da ficha), que volta sozinha: cheia em 1 hora real.
   A região só muda com a senha que o Mestre entrega na história.

   Áreas: um mapa de 7×5 casas com névoa. Andar para uma casa vizinha
   gasta Vida conforme o terreno; a primeira visita sorteia o que há lá
   (Pokémon, item, nada ou perigo). Pokémon selvagens: batalha na Arena
   (Equipe da ficha, HP guardado durante a expedição), Poké Ball direto
   ou fugir. Captura pelas regras da ficha: arremesso d100 ≤ Corpo (+20
   se Sleep/Paralysis) e captura d100 ≤ NAC; desmaiado = Comum/Incomum
   automática, Raro NAC 50, Muito Raro NAC 20.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;

  /* ---------- utilidades ---------- */
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const d100=()=>R(1,100);
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const toast=m=>{try{showToast(m);}catch(e){}};
  const save=()=>{try{(typeof debouncedSave==="function"?debouncedSave:saveState)();}catch(e){}};
  const reduce=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const wait=ms=>new Promise(r=>setTimeout(r,reduce()?Math.min(ms,60):ms));
  const itemSprite=slug=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${encodeURIComponent(slug)}.png`;
  const TYPE_COLOR={Normal:"#a8a77a",Fire:"#ee8130",Water:"#6390f0",Electric:"#f7d02c",Grass:"#7ac74c",Ice:"#96d9d6",Fighting:"#c22e28",Poison:"#a33ea1",Ground:"#e2bf65",Flying:"#a98ff3",Psychic:"#f95587",Bug:"#a6b91a",Rock:"#b6a136",Ghost:"#735797",Dragon:"#6f35fc",Dark:"#705746",Steel:"#b7b7ce",Fairy:"#d685ad"};
  const TYPE_PT={Normal:"Normal",Fire:"Fogo",Water:"Água",Electric:"Elétrico",Grass:"Planta",Ice:"Gelo",Fighting:"Lutador",Poison:"Veneno",Ground:"Terra",Flying:"Voador",Psychic:"Psíquico",Bug:"Inseto",Rock:"Pedra",Ghost:"Fantasma",Dragon:"Dragão",Dark:"Sombrio",Steel:"Aço",Fairy:"Fada"};
  const chip=t=>`<span class="ex7-type" style="--t:${TYPE_COLOR[t]||"#999"}">${esc(TYPE_PT[t]||t)}</span>`;

  /* ---------- ícones em pixel art (mesma paleta da Arena) ---------- */
  const ICO={
    compass:["......kkkk......","....kkyyyykk....","...kyywwwwyyk...","..kywwwrwwwwyk..",".kywwwrrwwwwwyk.",".kywwwrrwwwwwyk.","kywwwwrrkwwwwwyk","kywwwwkkkkwwwwyk","kywwwwwkddwwwwyk",".kywwwwwddwwwyk.",".kywwwwwddwwwyk.","..kywwwwdwwwyk..","...kyywwwwyyk...","....kkyyyykk....","......kkkk......"],
    heart:[".kk...kk.","krrk.krrk","krwrkrrrk","krrrrrrRk",".krrrrRk.","..krrRk..","...kRk...","....k...."],
    grass:["............","....k....k..","...kGk..kGk.","k..kGk.kGGk.","kGkkGGkkGk..","kGGkGGkGGk.k",".kGGeGGGekkG",".keGGeGGeGGk","..keeeeeeek.."],
    tree:["....kkkk....","..kkGGGGkk..",".kGGwGGGGek.","kGGGGGGGGGek","kGGGGGGeGGek","kGeGGGGGGeek",".keGGeGGeek.","..kkeeeekk..","....knnk....","....knnk....","...kknnkk...","............"],
    rock:["............","....kkkk....","...kmmmwk...","..kmmmmmmk..",".kmmmMmmmmk.",".kmmMMmmmMk.","kmmmMmmmmMMk","kMMmmmmmMMMk",".kkMMMMMMkk.","...kkkkkk...."],
    wave:["............","...kkk......","..kbbbk.....",".kbwwbbk..kk","kbbkkbbbkkbk","kbk..kbbbbk.","........kk..","...kkk......","..kbbbk..kk.",".kbBBbbkkbk.","kBbkkbBBbk..","kk....kkk..."],
    cave:["....kkkkk...","..kkmmmmmkk.",".kmmmmmmmmmk","kmmmkkkkmmmk","kmmkKKKKkmMk","kmkKKKKKKkMk","kmkKKKKKKkMk","kMkKKKKKKkMk","kkkkkkkkkkkk"],
    snow:[".....k.....","..k..k..k..","...k.k.k...","....kck....","kkkkcwckkkk","....kck....","...k.k.k...","..k..k..k..",".....k....."],
    cloud:["............","....kkk.....","...kwwwk....",".kkwwwwwkk..","kwwwwwwwwwk.","kwwwwwwwwggk",".kggggggggk.","..kkkkkkkk.."],
    flower:["....kk......","...kppk..kk.","..kpwwpkkyyk","...kppk.kyyk","....kk...kk.","....kG...kG.","...kGGk.kGGk","...kGk...kGk"],
    path:["............","..kk........",".knnk.......",".knnk...kk..","..kk...knnk.","........knnk.","....kk...kk.","...knnk.....","...knnk.....","....kk......"],
    sand:["............","...y....Y...",".Y....y.....","......Y..y..","..y.Y.......","........Y...",".Y..y.....y.","....Y..y...."],
    chest:["............",".kkkkkkkkkk.","kYnnnnnnnnYk","kYnnnnnnnnYk","kkkkkyykkkkk","kYnnnyynnnYk","kYnnnkknnnYk","kYnnnnnnnnYk","kkkkkkkkkkkk"],
    star:[".....kk.....",".....kyk....","....kyyk....","kkkkkyykkkkk",".kyyyyyyyYk.","..kyyyyyYk..","..kyyYyyYk..",".kyYk.kYYk..",".kk.....kk.."],
    drop:[".....k.....","....kck....","...kcbck...","..kcwbbck..",".kcwbbbBck.",".kcbbbbBck.",".kcbbbBBck.","..kcBBBck..","...kkkkk..."],
    boot:["...kkkk.....","...krrk.....","...krrk.....","...krrk.....","...krrkkkk..","..krrrrrrrk.","..kRRRRRRRk.","..kkkkkkkkk."],
    key:["..kkk.......",".kyyyk......","kyk.kyk.....","kyk.kykkkkkk","kyyyyyyyyyyk",".kyyyk.kYkYk","..kkk...k.k."],
    pin:["...kkkk...","..krrrrk..",".krrwwrrk.",".krwkkwrk.",".krrwwrrk.","..krrrrk..","...krrk...","....kk...."]
  };
  const PIX=()=>window.hhArenaPix;
  let icoReady=false;
  function ensureIcons(){
    const P=PIX();if(!P||icoReady)return !!P;
    Object.assign(P.PAL,{e:"#2f8a4a",i:"#d9f3ff"});
    Object.entries(ICO).forEach(([k,v])=>{if(!P.ICONS["ex-"+k])P.ICONS["ex-"+k]=v;});
    icoReady=true;return true;
  }
  const px=(name,size=20,cls="")=>ensureIcons()?PIX().svg("ex-"+name,size).replace('class="px-ico','class="px-ico ex7-px '+cls):"";

  /* ---------- Elysius · Helikon ---------- */
  const MAP_W=240,MAP_H=150; // mapa em pixel art de Helikon (assets/explore/helikon-map.png, 240×150 ampliado 4×)
  const REGIONS={
    sylphora:{id:"sylphora",name:"Sylphora",biome:"Floresta",icon:"tree",lv:[8,18],bst:450,color:"#3f9e57",pos:[58,92],
      hash:"a51919ee15315c49f8330456d262f682e0dad875ef5eb991e8737a4bf59e939f",
      desc:"A grande floresta do oeste de Helikon. Copas fechadas, riachos escondidos e muitos Pokémon Planta e Inseto.",
      areas:[
        {id:"bosque",name:"Bosque das Fadas",types:["Grass","Bug","Fairy"],scene:"forest",tiles:{grass:5,tree:4,flower:3,path:2}},
        {id:"clareira",name:"Clareira dos Cogumelos",types:["Grass","Poison","Bug"],scene:"forest",tiles:{grass:5,tree:3,flower:2,path:2}},
        {id:"copa",name:"Copa Antiga",types:["Flying","Bug","Normal"],scene:"forest",tiles:{tree:6,grass:3,path:2}},
        {id:"riacho",name:"Riacho Sombreado",types:["Water","Grass","Ghost"],scene:"night",dusk:true,tiles:{water:4,tree:4,grass:3,path:1}}
      ]},
    nerona:{id:"nerona",name:"Nerona",biome:"Mares",icon:"wave",lv:[10,22],bst:470,color:"#3d7fd6",pos:[22,142],
      hash:"7a7f741016923f894b1e85e3520e9419e0560978ee799d4c5b414886724996ae",
      desc:"Os mares e a costa sul de Helikon, por onde passa a Rota do Dragão. Praias, recifes e grutas de maré.",
      areas:[
        {id:"praia",name:"Praia de Coral",types:["Water","Rock","Bug"],scene:"ocean",tiles:{sand:5,water:4,rock:2,path:1}},
        {id:"recifes",name:"Recifes Profundos",types:["Water","Poison"],scene:"ocean",dive:true,tiles:{water:8,rock:2,sand:2}},
        {id:"falesias",name:"Falésias do Vento",types:["Flying","Water","Normal"],scene:"sky",tiles:{rock:4,grass:3,cloud:2,water:2,path:1}},
        {id:"grutas",name:"Grutas da Maré",types:["Water","Dark","Ghost"],scene:"cave",dusk:true,tiles:{cave:5,water:4,rock:3}}
      ]},
    altamuralha:{id:"altamuralha",name:"Altamuralha",biome:"Montanhas e Vales",icon:"rock",lv:[15,30],bst:530,color:"#a2763c",pos:[151,86],
      hash:"27d0f366944cfc59a9a50fe618e2629a12bae1ecc9df372f572f1099e79451ba",
      desc:"A Grande Cidade na montanha, lar do Rochedo Eterno. Trilhas de pedra, vales de vento e cavernas de cristal no fim da Rota do Dragão.",
      areas:[
        {id:"trilhas",name:"Trilhas da Muralha",types:["Rock","Ground","Fighting"],scene:"mountain",tiles:{rock:5,path:3,grass:2,cave:1}},
        {id:"vale",name:"Vale dos Ventos",types:["Flying","Normal","Grass"],scene:"sky",tiles:{grass:5,flower:2,cloud:2,path:2,rock:1}},
        {id:"quartzo",name:"Cavernas de Quartzo",types:["Rock","Steel","Ghost"],scene:"cave",dusk:true,tiles:{cave:6,rock:4,water:1}},
        {id:"rio",name:"Rio das Pedras",types:["Water","Ground","Rock"],scene:"mountain",tiles:{water:4,rock:3,grass:3,path:2}},
        {id:"encostas",name:"Encostas Floridas",types:["Grass","Fairy","Bug"],scene:"forest",tiles:{flower:4,grass:4,tree:2,rock:2}}
      ]},
    frostrine:{id:"frostrine",name:"Frostrine",biome:"Montanhas Nevadas e Florestas Gélidas",icon:"snow",lv:[28,42],bst:560,color:"#7fb8d8",pos:[70,30],secret:true,
      hash:"0ab3be77c78f4e6a394aa28818826e1a4df49e91b47b76b0e98b0ef93de8bbf0",
      desc:"Além de Altamuralha, a neve cobre montanhas e florestas inteiras. O frio corta, e cada passo pesa.",
      areas:[
        {id:"floresta",name:"Floresta Gélida",types:["Ice","Grass","Dark"],scene:"forest",tiles:{snow:4,tree:5,grass:1,path:2}},
        {id:"encostas",name:"Encostas Nevadas",types:["Ice","Rock","Steel"],scene:"mountain",tiles:{snow:6,rock:4,cave:1}},
        {id:"lago",name:"Lago Congelado",types:["Ice","Water"],scene:"ocean",dive:true,tiles:{water:5,snow:5,rock:1}}
      ]},
    aelora:{id:"aelora",name:"Aelora",biome:"Pico de Dragons Peak",icon:"star",lv:[40,55],bst:600,color:"#c88bd8",pos:[190,30],secret:true,
      hash:"bfcf344d4e62610c17a7d6749f56504ade33940c970db3bc6f91bed26e15e2aa",
      desc:"O cume de Dragons Peak, onde a Rota do Dragão termina. Escarpas, ninhos nas nuvens e ruínas antigas.",
      areas:[
        {id:"escarpas",name:"Escarpas do Dragão",types:["Dragon","Rock","Flying"],scene:"mountain",tiles:{rock:6,cloud:2,path:2,cave:1}},
        {id:"ninho",name:"Ninho das Nuvens",types:["Dragon","Flying","Fairy"],scene:"sky",tiles:{cloud:6,rock:3,flower:2}},
        {id:"cume",name:"Cume de Aelora",types:["Dragon","Steel","Psychic"],scene:"temple",tiles:{rock:4,snow:3,path:3,cloud:1}}
      ]}
  };
  const ORDER=["sylphora","nerona","altamuralha","frostrine","aelora"];
  const START="altamuralha";

  /* Terrenos: custo de Vida por passo e o que costuma ter */
  const TERRAIN={
    path:{label:"Trilha",cost:1,ev:{poke:25,item:20,none:50,hazard:5}},
    grass:{label:"Mato alto",cost:1,ev:{poke:55,item:12,none:28,hazard:5}},
    flower:{label:"Campo florido",cost:1,ev:{poke:45,item:20,none:32,hazard:3}},
    sand:{label:"Areia",cost:1,ev:{poke:30,item:30,none:35,hazard:5}},
    tree:{label:"Mata fechada",cost:2,ev:{poke:42,item:23,none:28,hazard:7}},
    rock:{label:"Pedras",cost:2,ev:{poke:30,item:35,none:25,hazard:10}},
    water:{label:"Água",cost:2,ev:{poke:50,item:15,none:30,hazard:5}},
    cave:{label:"Caverna",cost:2,ev:{poke:45,item:25,none:20,hazard:10}},
    cloud:{label:"Penhasco",cost:2,ev:{poke:40,item:20,none:28,hazard:12}},
    snow:{label:"Neve funda",cost:3,ev:{poke:35,item:20,none:30,hazard:15}}
  };
  const T_ICON={path:"path",grass:"grass",flower:"flower",sand:"sand",tree:"tree",rock:"rock",water:"wave",cave:"cave",cloud:"cloud",snow:"snow"};
  const T_PREFER={water:["Water","Ice"],cave:["Rock","Ghost","Dark","Steel"],tree:["Bug","Grass"],cloud:["Flying","Dragon"],snow:["Ice"],flower:["Fairy","Bug","Grass"],rock:["Rock","Ground","Fighting"],sand:["Ground","Water"]};
  const HAZARD={
    path:["Uma ponte de cordas balançou e você quase caiu.","Você torceu o pé numa raiz."],
    grass:["Um enxame de Beedrill passou zunindo: você correu.","Espinhos escondidos no mato arranharam suas pernas."],
    flower:["O pólen te deu uma crise de espirros."],
    sand:["A maré subiu de repente e te arrastou."],
    tree:["Um galho podre caiu nas suas costas.","Você se perdeu e andou em círculos."],
    rock:["Pedras rolaram do alto: você se protegeu como pôde.","Você escorregou num paredão."],
    water:["A correnteza te puxou: você nadou de volta com esforço."],
    cave:["Você bateu a cabeça numa estalactite.","Um desabamento bloqueou o caminho e você teve de cavar."],
    cloud:["Uma rajada de vento te jogou contra as pedras."],
    snow:["Você afundou na neve até a cintura.","Uma nevasca curta te gelou até os ossos."]
  };
  /* Itens que dá para achar (Bolsa da ficha); alguns são da região */
  const LOOT=[["poke-ball",22,1,3],["great-ball",8,1,1],["potion",20,1,2],["super-potion",8,1,1],["antidote",7,1,1],["paralyze-heal",6,1,1],["awakening",5,1,1],["burn-heal",5,1,1],["ice-heal",4,1,1],["oran-berry",12,1,3],["sitrus-berry",5,1,1],["revive",3,1,1],["escape-rope",3,1,1],["ether",3,1,1]];
  const REGION_LOOT={
    sylphora:["miracle-seed","leaf-stone","silver-powder","big-root","tiny-mushroom"],
    nerona:["mystic-water","water-stone","pearl","shoal-salt","heart-scale"],
    altamuralha:["hard-stone","everstone","moon-stone","soft-sand","smooth-rock"],
    frostrine:["never-melt-ice","ice-stone","icy-rock","snowball"],
    aelora:["dragon-fang","dragon-scale","sharp-beak","star-piece"]
  };

  /* ---------- estado (fica na ficha: state.trainer.explore) ---------- */
  const trainer=()=>typeof ensureTrainerData==="function"?ensureTrainerData():(state.trainer||(state.trainer={}));
  function X(){
    const t=trainer();
    if(!t.explore||typeof t.explore!=="object")t.explore={};
    const x=t.explore;
    if(!REGIONS[x.region])x.region=START;
    if(!Array.isArray(x.known))x.known=["sylphora","nerona","altamuralha"];
    if(!x.known.includes(x.region))x.known.push(x.region);
    if(x.hp==null){x.hp=maxHp();x.at=Date.now();}
    return x;
  }
  const lifeAttr=()=>{try{return typeof trainerAttributeValue==="function"?trainerAttributeValue("life"):Number(trainer().attributes?.life||50);}catch(e){return 50;}};
  const maxHp=()=>Math.max(10,lifeAttr()||50);
  const REGEN_MS=60*60*1000; // Vida toda em 1 hora real
  function hpNow(){
    const x=X(),mx=maxHp();
    const h=Number(x.hp||0)+(Date.now()-Number(x.at||Date.now()))/REGEN_MS*mx;
    return clamp(h,0,mx);
  }
  function setHp(v){const x=X();x.hp=clamp(v,0,maxHp());x.at=Date.now();save();}
  function fullIn(){const mx=maxHp(),h=hpNow();return h>=mx?0:Math.ceil((mx-h)/mx*REGEN_MS);}
  const fmtTime=ms=>{const s=Math.ceil(ms/1000),m=Math.floor(s/60);return m>=60?`${Math.floor(m/60)}h${String(m%60).padStart(2,"0")}`:`${m}:${String(s%60).padStart(2,"0")}`;};
  const region=()=>REGIONS[X().region];
  const known=id=>X().known.includes(id);

  /* ---------- senha da região ---------- */
  const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  async function sha(s){
    const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  async function tryPassword(text){
    const h=await sha("helikon:"+norm(text));
    return Object.values(REGIONS).find(r=>r.hash===h)||null;
  }

  /* ---------- Equipe ---------- */
  const team=()=>(state.pokemon||[]).filter(p=>(p.storageGroup||"team")==="team").slice(0,6);
  const pImg=p=>{try{return (typeof displayPokemonImage==="function"?displayPokemonImage(p):"")||p.imageUrl||"";}catch(e){return p.imageUrl||"";}};
  const teamAvg=()=>{const t=team();return t.length?Math.round(t.reduce((a,p)=>a+Number(p.level||1),0)/t.length):10;};
  function teamState(){
    const e=X().exp;return team().map(p=>{const h=e?.teamHp?.[p.id];return {p,pct:h?h.pct:1,fainted:h?!!h.fainted:false};});
  }

  /* ---------- expedição ---------- */
  const W=7,H=5;
  function newExpedition(areaId){
    const r=region(),a=r.areas.find(x=>x.id===areaId);if(!a)return;
    const bag=[];Object.entries(a.tiles).forEach(([k,n])=>{for(let i=0;i<n;i++)bag.push(k);});
    const tiles=[];
    for(let i=0;i<W*H;i++)tiles.push({k:pick(bag),seen:false,done:false});
    // terrenos parecidos juntos: cada casa copia um vizinho às vezes
    for(let pass=0;pass<2;pass++)for(let i=0;i<tiles.length;i++){if(Math.random()<.35){const n=neighbors(i);tiles[i].k=tiles[pick(n)].k;}}
    const start=(H-1)*W+Math.floor(W/2);
    tiles[start]={k:"path",seen:true,done:true,start:true};
    // um lugar especial escondido longe da entrada
    const far=tiles.map((t,i)=>i).filter(i=>dist(i,start)>=4);
    const sp=pick(far);tiles[sp].special=pick(["nest","chest","spring"]);
    neighbors(start).forEach(i=>tiles[i].seen=true);
    X().exp={region:r.id,area:a.id,tiles,pos:start,teamHp:{},log:[{t:`Você entrou em ${a.name}.`,c:"info"}],found:[],caught:[],steps:0,at:Date.now()};
    save();
  }
  function neighbors(i){const x=i%W,y=Math.floor(i/W),o=[];if(x>0)o.push(i-1);if(x<W-1)o.push(i+1);if(y>0)o.push(i-W);if(y<H-1)o.push(i+W);return o;}
  function dist(a,b){return Math.abs(a%W-b%W)+Math.abs(Math.floor(a/W)-Math.floor(b/W));}
  const exp=()=>{const e=X().exp;return e&&e.region===X().region&&region().areas.some(a=>a.id===e.area)?e:null;};
  const area=()=>{const e=exp();return e?region().areas.find(a=>a.id===e.area):null;};
  function log(t,c="info"){const e=exp();if(!e)return;e.log.unshift({t,c});e.log=e.log.slice(0,30);}
  function endExpedition(msg){
    const e=X().exp;
    X().exp=null;save();
    ui.view="map";ui.ev=null;
    if(msg)toast(msg);
    render();
    return e;
  }

  /* ---------- andar ---------- */
  async function step(i){
    const e=exp();if(!e||ui.busy||ui.ev)return;
    if(i===e.pos)return;
    if(!neighbors(e.pos).includes(i)){toast("Ande uma casa por vez (para cima, baixo ou para os lados).");return;}
    const t=e.tiles[i],cost=TERRAIN[t.k]?.cost||1;
    const h=hpNow();
    if(h<cost){toast(`Sem Vida para andar (${TERRAIN[t.k].label} custa ${cost}). Cheia em ${fmtTime(fullIn())}.`);sfx("error");return;}
    setHp(h-cost);
    e.pos=i;e.steps++;t.seen=true;neighbors(i).forEach(n=>e.tiles[n].seen=true);
    sfx("select");
    if(t.start){log("Você voltou à entrada.");save();render();return;}
    const first=!t.done;t.done=true;
    if(t.special&&!t.specialDone){t.specialDone=true;save();await special(t);return;}
    const evs=first?TERRAIN[t.k].ev:{poke:15,item:0,none:85,hazard:0};
    let r=R(1,100),kind="none";
    for(const [k,w] of Object.entries(evs)){r-=w;if(r<=0){kind=k;break;}}
    save();
    if(kind==="poke")await encounter(t);
    else if(kind==="item")foundItem(t);
    else if(kind==="hazard")hazard(t);
    else{log(first?`${TERRAIN[t.k].label}: nada por aqui.`:`${TERRAIN[t.k].label}: caminho conhecido.`,"none");render();}
  }
  function hazard(t){
    const n=R(2,5)+(t.k==="snow"?2:0);
    const h=hpNow()-n;setHp(h);
    const txt=pick(HAZARD[t.k]||HAZARD.path);
    log(`${txt} −${n} Vida.`,"bad");sfx("hit");
    if(h<=0){endExpedition("Você desmaiou de cansaço e foi levado de volta para a cidade.");return;}
    ui.ev={kind:"hazard",text:txt,n};render();
  }

  /* ---------- itens ---------- */
  const CATALOG=()=>typeof POKEAPI_ITEM_BY_SLUG!=="undefined"?POKEAPI_ITEM_BY_SLUG:null;
  const isBag=slug=>typeof BAG_CONSUMABLE_BY_SLUG!=="undefined"&&BAG_CONSUMABLE_BY_SLUG.has(slug);
  function itemName(slug){return (isBag(slug)?BAG_CONSUMABLE_BY_SLUG.get(slug)?.name:null)||CATALOG()?.get(slug)?.name||slug.split("-").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ");}
  function giveItem(slug,n){
    if(isBag(slug)){setBagQuantity(slug,bagQuantity(slug)+n,{render:false,save:false});return true;}
    const it=CATALOG()?.get(slug);
    const t=trainer();t.inventory=t.inventory||{};const I=t.inventory;I.items=I.items||[];
    const name=it?.name||itemName(slug);
    const ex=I.items.find(x=>String(x.name).toLowerCase()===name.toLowerCase());
    if(ex)ex.qty=Number(ex.qty||0)+n;
    else I.items.push({id:"it"+Math.random().toString(36).slice(2,9),name,icon:/stone|everstone/.test(slug)?"📦":"💎",category:/stone|scale|pearl|piece|salt|heart/.test(slug)?"other":"held",qty:n,price:0,desc:it?.description||"Encontrado na exploração.",apiName:slug});
    return true;
  }
  function rollLoot(rich){
    if(Math.random()<(rich?.5:.16)){const slug=pick(REGION_LOOT[region().id]||REGION_LOOT.altamuralha);return {slug,n:1};}
    if(!rich&&Math.random()<.12)return {money:R(4,12)*50};
    const tot=LOOT.reduce((a,x)=>a+x[1],0);let r=Math.random()*tot;
    for(const [slug,w,a,b] of LOOT){r-=w;if(r<=0)return {slug,n:R(a,b)*(rich?2:1)};}
    return {slug:"potion",n:1};
  }
  function foundItem(t,rich=false){
    const l=rollLoot(rich);
    const e=exp();
    if(l.money){const tr=trainer();tr.money=Number(tr.money||0)+l.money;log(`Você achou ₽ ${l.money.toLocaleString("pt-BR")} perdidos no chão.`,"good");e.found.push({name:`${l.money.toLocaleString("pt-BR")}`,n:1,money:true});ui.ev={kind:"money",n:l.money};}
    else{giveItem(l.slug,l.n);const name=itemName(l.slug);log(`Você achou ${name} ×${l.n}.`,"good");e.found.push({slug:l.slug,name,n:l.n});ui.ev={kind:"item",slug:l.slug,name,n:l.n,bag:isBag(l.slug)};}
    sfx("coin");save();try{renderAll();}catch(err){}render();
  }
  async function special(t){
    if(t.special==="chest"){log("Um baú antigo, meio enterrado!","good");foundItem(t,true);return;}
    if(t.special==="spring"){
      const e=exp();team().forEach(p=>{const h=e.teamHp[p.id];if(h&&!h.fainted)h.pct=Math.min(1,h.pct+.5);});
      setHp(hpNow()+Math.ceil(maxHp()*.25));
      log("Uma fonte de água cristalina: o time recuperou 50% do HP e você, 25% da Vida.","good");sfx("heal");
      ui.ev={kind:"spring"};render();return;
    }
    if(t.special==="nest"){log("Um ninho! Algo raro vive aqui…","good");await encounter(t,{nest:true});}
  }

  /* ---------- encontro ---------- */
  async function encounter(t,{nest=false}={}){
    const r=region(),a=area(),S=window.hhArenaSurvival;
    if(!S?.makeWild){log("A trilha está calma (a Arena ainda não carregou).","none");render();return;}
    ui.busy=true;ui.ev={kind:"loading"};render();
    const prefer=(T_PREFER[t.k]||[]).find(x=>a.types.includes(x))||"";
    const level=clamp(teamAvg()+R(-3,2)+(nest?3:0),r.lv[0],r.lv[1]);
    let foe=null;
    for(let tries=0;tries<(nest?4:1)&&(!foe||(nest&&foe.rarity==="common"));tries++){
      try{foe=await S.makeWild({types:a.types,level,bstCap:r.bst+(nest?40:0),bonus:Math.round((level-r.lv[0])*1.5)+(nest?6:0),prefer});}catch(err){break;}
    }
    ui.busy=false;
    if(!foe){ui.ev=null;log("Algo se mexeu no mato, mas sumiu (sem conexão com a PokéAPI).","none");render();return;}
    foe.terrain=t.k;
    log(`${foe.shiny?"✨ ":""}Um ${foe.name} selvagem (Lv. ${foe.level}) apareceu!`,"poke");
    sfx("encounter");
    ui.ev={kind:"poke",foe,round:1,tile:t.k};render();
  }
  const RAR={common:{label:"Comum",mod:30,stars:1},uncommon:{label:"Incomum",mod:15,stars:2},rare:{label:"Raro",mod:0,stars:3},veryrare:{label:"Muito Raro",mod:-20,stars:4},legendary:{label:"Lendário",mod:-50,stars:5}};
  function flee(){
    const ev=ui.ev;if(!ev?.foe)return;
    setHp(hpNow()-1);
    log(`Você fugiu de ${ev.foe.name}. −1 Vida.`,"none");
    ui.ev=null;save();render();
    if(hpNow()<=0)endExpedition("Você desmaiou de cansaço e foi levado de volta para a cidade.");
  }
  async function battle(){
    const ev=ui.ev;if(!ev?.foe)return;
    if(!window.hhArena?.wild){toast("A Arena ainda está carregando.");return;}
    if(!teamState().some(x=>!x.fainted)){toast("Todo o time está desmaiado: lance uma Poké Ball ou fuja.");return;}
    const e=exp(),a=area(),foe=ev.foe;
    root.hidden=true;document.body.classList.remove("ex7-open");
    const ok=await window.hhArena.wild({foe,scene:a.scene,area:a.name,teamHp:e.teamHp,
      onBall:(info,cb)=>{openCapture({foe,info,inBattle:true,cb});},
      onEnd:res=>afterBattle(foe,res)});
    if(!ok){root.hidden=false;document.body.classList.add("ex7-open");}
  }
  function afterBattle(foe,res){
    const e=exp();if(!e)return;
    root.hidden=false;document.body.classList.add("ex7-open");
    Object.assign(e.teamHp,res.teamHp||{});
    const g=(res.gains||[]).map(x=>`${x.m.name} +${x.n} PPg`).join(", ");
    if(res.outcome==="caught"){save();render();return;}
    if(res.outcome==="catch"){log(`${foe.name} desmaiou!${g?` (${g})`:""}`,"good");openCapture({foe,info:{...(res.foe||{}),pct:0,fainted:true},inBattle:false});save();return;}
    if(res.outcome==="leave"){log(`Você venceu ${foe.name} e deixou ele ir.${g?` (${g})`:""}`,"good");ui.ev=null;save();render();return;}
    if(res.outcome==="fled"){log(`Você fugiu da batalha contra ${foe.name}.`,"none");ui.ev=null;setHp(hpNow()-1);save();render();return;}
    // derrota: carregar o time de volta custa Vida
    const n=8;setHp(hpNow()-n);
    log(`Seu time foi derrotado por ${foe.name}. Você carregou todos de volta: −${n} Vida.`,"bad");
    ui.ev=null;save();
    if(hpNow()<=0||!teamState().some(x=>!x.fainted)){endExpedition("Sem Pokémon de pé, você voltou para a cidade. O time foi curado no Centro Pokémon.");return;}
    render();
  }

  /* ---------- captura (regras da ficha) ---------- */
  const STATUS_CAP={slp:{label:"Sleep",mod:30,throw:20},frz:{label:"Freeze",mod:30,throw:0},par:{label:"Paralysis",mod:15,throw:20},psn:{label:"Poison",mod:15,throw:0},tox:{label:"Poison",mod:15,throw:0},brn:{label:"Burn",mod:15,throw:0}};
  const lifeMod=pct=>pct<=25?40:pct<=50?20:pct<=75?10:0;
  function levelMod(diff){if(diff>=15)return -50;if(diff>=10)return -30;if(diff>=5)return -15;if(diff<=-10)return 20;if(diff<=-5)return 10;return 0;}
  const RULES=()=>typeof CAPTURE_BALL_RULES!=="undefined"?CAPTURE_BALL_RULES:{};
  const body=()=>{try{return typeof trainerAttributeValue==="function"?trainerAttributeValue("body"):Number(trainer().attributes?.body||0);}catch(e){return 40;}};
  function hasThrowSkill(){const n=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();return (trainer().skills||[]).some(s=>/arremesso/.test(n(s.name))&&/pok/.test(n(s.name)));}
  function balls(){
    const out=[];
    try{BAG_CONSUMABLE_BY_SLUG.forEach((it,slug)=>{if(it?.bagGroup==="balls"){const q=bagQuantity(slug);if(q>0)out.push({slug,name:it.name,qty:q});}});}catch(e){}
    return out.sort((a,b)=>(RULES()[a.slug]?.base||0)-(RULES()[b.slug]?.base||0));
  }
  function ballBonus(slug,C){
    const r=RULES()[slug];if(!r)return {bonus:0,note:"sem regra própria"};
    if(r.auto)return {auto:true,bonus:0,note:"captura automática"};
    let b=Number(r.base||0),note=r.text||"";
    const types=C.foe.types||[];const a=area();
    if(r.context==="nest")b=C.foe.level<C.myLevel?20:0;
    else if(r.context==="timer")b=Math.min(30,(C.turn||1)*5);
    else if(r.context==="quick")b=(C.turn||1)<=1?30:0;
    else if(r.context==="net")b=types.some(t=>t==="Water"||t==="Bug")?20:0;
    else if(r.context==="dive")b=(a?.dive||C.foe.terrain==="water")?20:0;
    else if(r.context==="dusk")b=(a?.dusk||C.foe.terrain==="cave")?30:0;
    else if(r.context==="repeat")b=(state.pokemon||[]).some(p=>norm(p.name)===norm(C.foe.name))?25:0;
    else if(r.context==="safari")b=0;
    return {bonus:b,note};
  }
  function throwData(C){
    const st=STATUS_CAP[C.info.status]||null;
    const skill=hasThrowSkill();
    const b=body();
    const target=clamp(b+(st?.throw||0)+(skill?0:-15),1,99);
    return {body:b,skill,st,target,crit:Math.min(target,Math.floor(b/4))};
  }
  function nac(C,slug,crit){
    const rar=RAR[C.foe.rarity]||RAR.common,bb=ballBonus(slug,C);
    if(bb.auto)return {auto:true,value:100,parts:[["Master Ball","auto"]]};
    if(C.info.fainted){
      if(C.foe.rarity==="common"||C.foe.rarity==="uncommon")return {auto:true,value:100,parts:[[`Desmaiado · ${rar.label}`,"auto"]]};
      const f=C.foe.rarity==="rare"?50:20;const v=clamp(f+(crit?10:0),5,95);
      return {auto:false,value:v,parts:[[`Desmaiado · ${rar.label}`,f],...(crit?[["Arremesso crítico",10]]:[])]};
    }
    const pct=Math.round((C.info.pct??1)*100);
    const st=STATUS_CAP[C.info.status];
    const diff=C.foe.level-C.myLevel;
    const parts=[["Base",30],[`Vida ${pct}%`,lifeMod(pct)],[itemName(slug),bb.bonus],[`Nível (${diff>=0?"+":""}${diff})`,levelMod(diff)],[`Raridade · ${rar.label}`,rar.mod]];
    if(st)parts.push([st.label,st.mod]);
    if(crit)parts.push(["Arremesso crítico",10]);
    const raw=parts.reduce((s,[,v])=>s+v,0);
    return {auto:false,value:clamp(raw,5,95),raw,parts};
  }
  function openCapture({foe,info,inBattle,cb}){
    const lead=team().find(p=>!(exp()?.teamHp?.[p.id]?.fainted))||team()[0];
    const C={foe,inBattle,cb,info:{pct:1,fainted:false,status:"",turn:1,...(info||{})}};
    C.myLevel=Number(info?.myLevel||lead?.level||1);C.turn=Number(C.info.turn||1);
    const bl=balls();
    ui.cap={C,ball:bl[0]?.slug||"",phase:"aim",msg:""};
    ui.ev={kind:"capture"};
    if(root.hidden){root.hidden=false;document.body.classList.add("ex7-open");}
    render();
  }
  let ringRaf=0,ringT0=0;
  function ringScale(){const t=(performance.now()-ringT0)/1000;return .18+.82*(.5+.5*Math.cos(t*Math.PI*1.25));}
  function startRing(){
    cancelAnimationFrame(ringRaf);ringT0=performance.now();
    const loop=()=>{const r=root.querySelector(".ex7-ring");if(!r||ui.cap?.phase!=="aim")return;r.style.transform=`scale(${ringScale().toFixed(3)})`;ringRaf=requestAnimationFrame(loop);};
    ringRaf=requestAnimationFrame(loop);
  }
  async function doThrow(mode){
    const K=ui.cap;if(!K||K.phase!=="aim")return;
    const C=K.C;
    if(!K.ball||bagQuantity(K.ball)<=0){toast("Escolha uma Poké Ball da Bolsa.");return;}
    cancelAnimationFrame(ringRaf);
    const td=throwData(C);
    const roll=mode==="ring"?clamp(Math.round(ringScale()*100)+R(-3,3),1,100):d100();
    const hit=roll<=td.target,crit=hit&&roll<=td.crit;
    const ballName=itemName(K.ball);
    setBagQuantity(K.ball,bagQuantity(K.ball)-1,{render:false,save:false});
    K.phase="fly";K.throwRoll=roll;K.hit=hit;K.crit=crit;K.msg=hit?(crit?"Arremesso CRÍTICO!":"Acertou!"):"A Poké Ball errou o alvo!";
    sfx("throw");render();await wait(650);
    if(!hit){K.phase="fail";log(`${ballName}: arremesso ${roll} > ${td.target}, errou ${C.foe.name}.`,"bad");afterFail(C,ballName);return;}
    const n=nac(C,K.ball,crit);
    const capRoll=n.auto?0:d100();
    const caught=n.auto||capRoll<=n.value;
    K.nac=n;K.capRoll=capRoll;K.phase="shake";K.shakes=0;render();
    const shakes=caught?3:Math.max(0,Math.min(2,Math.floor(3-(capRoll-n.value)/12)));
    for(let i=0;i<3;i++){await wait(560);if(i>=shakes&&!caught)break;K.shakes=i+1;sfx("select");render();}
    await wait(380);
    if(caught){
      K.phase="caught";K.msg=`${C.foe.name} foi capturado!`;sfx("caught");render();
      log(`◓ ${C.foe.name} foi capturado com ${ballName}!${n.auto?"":` (${capRoll} ≤ ${n.value})`}`,"good");
      await register(C.foe,K.ball,C.info);
      const e=exp();if(e)e.caught.push({name:C.foe.name,level:C.foe.level,img:C.foe.sprite||C.foe.img});
      save();
      if(C.inBattle)C.cb?.("caught");
      render();
    }else{
      K.phase="fail";K.msg=`${C.foe.name} escapou da ${ballName}! (${capRoll} > ${n.value})`;
      log(`${C.foe.name} escapou da ${ballName} (${capRoll} > ${n.value}).`,"bad");
      afterFail(C,ballName);
    }
  }
  function afterFail(C,ballName){
    save();
    if(!C.inBattle&&!C.info.fainted&&Math.random()<.25){ui.cap.fled=true;log(`${C.foe.name} fugiu!`,"bad");}
    try{renderAll();}catch(e){}
    render();
    ui.cap.ballName=ballName;
  }
  function captureBack(){
    const K=ui.cap;if(!K)return;const C=K.C;
    ui.cap=null;
    if(K.phase==="caught"){ui.ev=null;render();return;}
    if(C.inBattle){ui.ev=null;render();root.hidden=true;document.body.classList.remove("ex7-open");C.cb?.(K.phase==="aim"?{}:{ball:K.ballName||"Poké Ball"});return;}
    if(K.fled||C.info.fainted){ui.ev=null;if(C.info.fainted&&!K.fled)log(`Você deixou ${C.foe.name} ir.`,"none");render();return;}
    ui.ev={kind:"poke",foe:C.foe,round:(C.turn||1)+1,tile:C.foe.terrain};render();
  }
  async function register(foe,ballSlug,info){
    if(typeof createBlankPokemon!=="function")return;
    const back=typeof current!=="undefined"?current?.id:null;
    const app=document.getElementById("app");const wasOpen=app?.classList.contains("drawer-open");
    try{
      createBlankPokemon();
      const p=current;
      let real=false;
      if(foe.apiName&&typeof searchPokemonFromApi==="function"){
        real=await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(foe.apiName)}`).then(r=>r.ok).catch(()=>false);
        if(real)await searchPokemonFromApi(foe.apiName);
      }
      if(!real)p.name=foe.name;
      p.storageGroup="box";p.level=foe.level;
      if(foe.shiny)p.shiny=true;
      p.notes=[p.notes,`Capturado com ${itemName(ballSlug)} em ${area()?.name||"exploração"}, ${region().name} (nível ${foe.level}).`].filter(Boolean).join("\n");
      if(ballSlug==="luxury-ball")p.happiness=Math.max(Number(p.happiness||0),120);
      if(typeof syncLevelDependentData==="function")try{syncLevelDependentData(p);}catch(e){}
      const prev=(state.pokemon||[]).find(x=>x.id===back);
      if(prev){state.currentId=prev.id;current=prev;}
      if(!wasOpen)app?.classList.remove("drawer-open");
      renderAll();saveState();
      toast(`📦 ${foe.name} foi para o PC`);
    }catch(e){console.error(e);toast("Não consegui registrar sozinho: crie o Pokémon pelo PC.");}
  }

  /* ---------- tela ---------- */
  const ui={view:"map",ev:null,busy:false,cap:null,pwd:false};
  const root=document.createElement("section");
  root.id="hhExplore";root.className="ex7";root.hidden=true;root.setAttribute("aria-label","Exploração");
  document.body.appendChild(root);
  let tick=0;
  function open(){
    X();root.hidden=false;document.body.classList.add("ex7-open");sfx("page");
    ui.view=exp()?"area":"map";render();
    clearInterval(tick);tick=setInterval(()=>{if(root.hidden){clearInterval(tick);return;}paintHp();},1000);
  }
  function close(){
    if(ui.cap&&ui.cap.C.inBattle){captureBack();return;}
    if(ui.busy)return;
    root.hidden=true;document.body.classList.remove("ex7-open");clearInterval(tick);cancelAnimationFrame(ringRaf);
  }
  function hpBar(){
    const mx=maxHp(),h=hpNow(),pc=Math.round(100*h/mx),ms=fullIn();
    return `<div class="ex7-life" title="Vida do treinador: cada passo gasta Vida; enche toda em 1 hora.">${px("heart",20)}
      <div class="ex7-lifebar"><i style="width:${pc}%" class="${pc<=25?"low":pc<=50?"mid":""}"></i><b>${Math.floor(h)}/${mx}</b></div>
      <small>${ms?`cheia em ${fmtTime(ms)}`:"Vida cheia"}</small></div>`;
  }
  function paintHp(){const el=root.querySelector(".ex7-life");if(el)el.outerHTML=hpBar();}
  function head(){
    const r=region();
    return `<header class="ex7-head">
      <span class="ex7-logo">${px("compass",34)}</span>
      <div class="ex7-title"><b>Exploração</b><small>Elysius · Helikon · <b>${esc(r.name)}</b></small></div>
      ${hpBar()}
      <button type="button" class="ex7-x" data-ex="close" aria-label="Fechar exploração">✕</button>
    </header>`;
  }
  function mapView(){
    const x=X(),r=region();
    const pins=ORDER.map(id=>{const g=REGIONS[id];const k=known(id),here=id===x.region;
      return `<div class="ex7-pin${here?" here":""}${k?"":" unknown"}" style="left:${(g.pos[0]/MAP_W*100).toFixed(2)}%;top:${(g.pos[1]/MAP_H*100).toFixed(2)}%;--c:${g.color}" title="${k?esc(g.name+" · "+g.biome):"Região desconhecida"}">
        <span class="ex7-pin-ico">${k?px(g.icon,22):"<b>?</b>"}</span><span class="ex7-pin-name">${k?esc(g.name):"???"}</span>${here?`<span class="ex7-here">${px("pin",16)} você está aqui</span>`:""}</div>`;}).join("");
    return `<div class="ex7-body ex7-mapbody">
      <section class="ex7-map" aria-label="Mapa de Helikon">
        <div class="ex7-mapimg"><img src="assets/explore/helikon-map.png?v=1" alt="Mapa em pixel art do continente de Helikon, em Elysius" draggable="false">
          <span class="ex7-maplabel" style="left:46%;top:88%">Rota do Dragão</span>
          <span class="ex7-maplabel" style="left:13%;top:66%">Cidade de Helikon</span>
          <span class="ex7-maplabel big" style="left:47%;top:71%">H E L I K O N</span>
          ${known("frostrine")?"":`<span class="ex7-fog" style="left:2%;top:0%;width:60%;height:44%"></span>`}
          ${known("aelora")?"":`<span class="ex7-fog" style="left:58%;top:4%;width:42%;height:66%"></span>`}
          <span class="ex7-maplabel peak" style="left:80%;top:62%">Dragons Peak</span>
          ${pins}
        </div>
        <p class="ex7-mapnote">${px("key",16)} A região só muda com a senha que o Mestre entrega na história.</p>
      </section>
      <section class="ex7-region" style="--c:${r.color}">
        <div class="ex7-rhead"><span class="ex7-rico">${px(r.icon,34)}</span><div><b>${esc(r.name)}</b><small>${esc(r.biome)} · Lv. ${r.lv[0]}–${r.lv[1]}</small></div>
          <button type="button" class="ex7-btn" data-ex="pwd">${px("key",16)} Mudar de região</button></div>
        <p class="ex7-rdesc">${esc(r.desc)}</p>
        <h3>Áreas para explorar</h3>
        <div class="ex7-areas">${r.areas.map(a=>`<button type="button" class="ex7-area" data-ex="go" data-v="${esc(a.id)}">
          <span class="ex7-area-ico t-${Object.keys(a.tiles)[0]}">${px(T_ICON[Object.keys(a.tiles)[0]],28)}</span>
          <span class="ex7-area-txt"><b>${esc(a.name)}</b><span>${a.types.map(chip).join("")}</span><small>${Object.keys(a.tiles).map(k=>TERRAIN[k].label).join(" · ")}${a.dusk?" · escuro (Dusk Ball)":""}${a.dive?" · mergulho (Dive Ball)":""}</small></span>
          <span class="ex7-go">Explorar →</span></button>`).join("")}</div>
        <details class="ex7-rules"><summary>📖 Como funciona</summary><ul>
          <li><b>Vida:</b> cada passo gasta Vida do treinador (Trilha 1, Mata/Pedras/Água/Caverna 2, Neve 3). A Vida máxima é o atributo Vida da ficha e enche toda em <b>1 hora</b>, mesmo com o site fechado.</li>
          <li><b>Casas:</b> a primeira visita pode ter um Pokémon, um item, nada ou um perigo (perde Vida). Mato alto e água têm mais Pokémon; pedras e cavernas, mais itens. Cada área esconde um lugar especial: ninho, baú ou fonte.</li>
          <li><b>Pokémon selvagem:</b> batalhe na Arena com a sua Equipe (o HP fica guardado na expedição), lance uma Poké Ball direto ou fuja (−1 Vida). Vencer dá 1 PPg (com Exp. Share).</li>
          <li><b>Captura:</b> arremesso d100 ≤ Corpo (+20 se Sleep/Paralysis; −15 sem a perícia Arremesso de Pokébola) e captura d100 ≤ NAC (30 + Vida + Poké Ball + nível + raridade + status). Desmaiado: Comum/Incomum é automática, Raro NAC 50, Muito Raro NAC 20.</li>
          <li><b>Derrota:</b> carregar o time de volta custa 8 Vida. Com Vida 0 você desmaia e volta para a cidade; sair da área cura o time no Centro Pokémon.</li>
        </ul></details>
      </section>
      ${ui.pwd?pwdModal():""}
    </div>`;
  }
  function pwdModal(){
    return `<div class="ex7-modal" role="dialog" aria-label="Mudar de região"><div class="ex7-card ex7-pwd">
      <span class="ex7-big">${px("key",44)}</span>
      <b>Viajar para outra região</b>
      <p>Digite a senha que o Mestre entregou. Ela leva o grupo para a região certa.</p>
      <form data-ex-form="pwd"><input id="ex7Pwd" type="text" autocomplete="off" spellcheck="false" placeholder="Senha da região" maxlength="60"><button type="submit" class="ex7-btn primary">Viajar</button></form>
      <small id="ex7PwdMsg" class="ex7-pwdmsg"></small>
      <button type="button" class="ex7-btn ghost" data-ex="pwd-close">Cancelar</button></div></div>`;
  }
  function areaView(){
    const e=exp(),a=area(),r=region();
    const tiles=e.tiles.map((t,i)=>{
      const here=i===e.pos,near=neighbors(e.pos).includes(i);
      const cls=["ex7-tile","t-"+t.k,t.seen?"seen":"fog",t.done?"done":"",here?"here":"",near?"near":""].filter(Boolean).join(" ");
      const label=t.seen?`${TERRAIN[t.k].label}${near?` · custa ${TERRAIN[t.k].cost} Vida`:""}`:"Névoa";
      const mark=t.start?px("path",22):t.special&&t.specialDone?px(t.special==="nest"?"star":t.special==="chest"?"chest":"drop",22):"";
      return `<button type="button" class="${cls}" data-ex="step" data-v="${i}" ${near?"":"tabindex=\"-1\""} title="${esc(label)}" aria-label="${esc(label)}">
        ${t.seen?`<span class="ex7-tico">${px(T_ICON[t.k],26)}</span>`:"<span class=\"ex7-fogq\">?</span>"}${mark?`<span class="ex7-mark">${mark}</span>`:""}
        ${here?`<span class="ex7-me">${px("boot",26)}</span>`:""}${near&&t.seen?`<span class="ex7-cost">${TERRAIN[t.k].cost}</span>`:""}</button>`;}).join("");
    const ts=teamState();
    return `<div class="ex7-body ex7-areabody" style="--c:${r.color}">
      <section class="ex7-board">
        <div class="ex7-areahead"><span class="ex7-rico sm">${px(r.icon,24)}</span><div><b>${esc(a.name)}</b><small>${esc(r.name)} · ${a.types.map(t=>TYPE_PT[t]||t).join(" / ")} · ${e.steps} passo(s)</small></div>
          <button type="button" class="ex7-btn" data-ex="leave">⟲ Voltar à cidade</button></div>
        <div class="ex7-grid" style="--w:${W}">${tiles}</div>
        <p class="ex7-hint">Clique numa casa vizinha para andar. O número é quanta Vida ela custa.</p>
      </section>
      <aside class="ex7-side">
        <div class="ex7-panel"><h4>Equipe</h4>${ts.length?`<ul class="ex7-team">${ts.map(x=>`<li class="${x.fainted?"out":""}"><img src="${esc(pImg(x.p))}" alt="" width="34" height="34" loading="lazy"><span><b>${esc(x.p.name)}</b><small>Lv. ${Number(x.p.level||1)}</small><i class="ex7-hp"><i style="width:${Math.round(x.pct*100)}%" class="${x.pct<=.25?"low":x.pct<=.5?"mid":""}"></i></i></span></li>`).join("")}</ul>`:`<p class="ex7-empty">Ponha Pokémon na Equipe para batalhar.</p>`}</div>
        <div class="ex7-panel"><h4>Bolsa da expedição</h4>${e.found.length||e.caught.length?`<ul class="ex7-found">${e.caught.map(c=>`<li class="poke">${c.img?`<img src="${esc(c.img)}" alt="" width="26" height="26">`:""}<b>${esc(c.name)}</b><small>capturado</small></li>`).join("")}${e.found.map(f=>`<li>${f.slug?`<img src="${esc(itemSprite(f.slug))}" alt="" width="24" height="24" loading="lazy">`:"<i>₽</i>"}<b>${esc(f.name)}</b><small>${f.money?"":"×"+f.n}</small></li>`).join("")}</ul>`:`<p class="ex7-empty">Nada ainda. Explore!</p>`}</div>
        <div class="ex7-panel ex7-logp"><h4>Diário</h4><ol class="ex7-log">${e.log.map(l=>`<li class="${esc(l.c)}">${esc(l.t)}</li>`).join("")}</ol></div>
      </aside>
      ${ui.ev?evModal():""}
    </div>`;
  }
  function foeCard(foe){
    const rar=RAR[foe.rarity]||RAR.common;
    return `<div class="ex7-foe">
      <div class="ex7-foeimg t-${esc(foe.terrain||"grass")}"><img src="${esc(foe.img||foe.sprite)}" alt="${esc(foe.name)}">${foe.shiny?`<span class="ex7-shiny">✨ Shiny</span>`:""}</div>
      <div class="ex7-foeinfo"><b>${esc(foe.name)}</b><small>Lv. ${foe.level} · ${foe.types.map(chip).join("")}</small>
        <span class="ex7-rar r-${esc(foe.rarity)}">${"★".repeat(rar.stars)}${"☆".repeat(4-Math.min(4,rar.stars))} ${esc(rar.label)}</span></div></div>`;
  }
  function evModal(){
    const ev=ui.ev;
    let inner="";
    if(ev.kind==="loading")inner=`<span class="ex7-big ex7-bounce">${px("grass",56)}</span><b>Algo se mexe…</b><p>Um Pokémon está chegando.</p>`;
    else if(ev.kind==="poke"){
      const hasBall=balls().length>0,alive=teamState().some(x=>!x.fainted);
      inner=`<p class="ex7-evtitle">Um Pokémon selvagem apareceu!</p>${foeCard(ev.foe)}
        <div class="ex7-acts">
          <button type="button" class="ex7-btn primary" data-ex="battle" ${alive?"":"disabled"}>⚔ Batalhar</button>
          <button type="button" class="ex7-btn" data-ex="ball" ${hasBall?"":"disabled"} title="${hasBall?"Lançar sem batalhar (o Pokémon está com a Vida cheia)":"Sem Poké Balls na Bolsa"}">◓ Poké Ball</button>
          <button type="button" class="ex7-btn ghost" data-ex="flee">🏃 Fugir <small>−1 Vida</small></button></div>
        ${alive?"":`<small class="ex7-warn">Todo o time está desmaiado.</small>`}${hasBall?"":`<small class="ex7-warn">Sem Poké Balls na Bolsa.</small>`}`;
    }
    else if(ev.kind==="item")inner=`<span class="ex7-big ex7-pop"><img src="${esc(itemSprite(ev.slug))}" alt="" width="64" height="64"></span><b>Você achou ${esc(ev.name)} ×${ev.n}!</b><p>${ev.bag?"Foi para a Bolsa.":"Foi para o Inventário de Viagem."}</p><button type="button" class="ex7-btn primary" data-ex="ok">Continuar</button>`;
    else if(ev.kind==="money")inner=`<span class="ex7-big ex7-pop">${px("chest",56)}</span><b>₽ ${ev.n.toLocaleString("pt-BR")}!</b><p>Dinheiro perdido no caminho.</p><button type="button" class="ex7-btn primary" data-ex="ok">Continuar</button>`;
    else if(ev.kind==="hazard")inner=`<span class="ex7-big ex7-shake">${px("heart",48)}</span><b>Perigo!</b><p>${esc(ev.text)}</p><p class="ex7-dmg">−${ev.n} Vida</p><button type="button" class="ex7-btn primary" data-ex="ok">Continuar</button>`;
    else if(ev.kind==="spring")inner=`<span class="ex7-big ex7-pop">${px("drop",56)}</span><b>Fonte cristalina</b><p>O time recuperou 50% do HP e você, 25% da Vida.</p><button type="button" class="ex7-btn primary" data-ex="ok">Continuar</button>`;
    else if(ev.kind==="capture")return captureModal();
    return `<div class="ex7-modal" role="dialog"><div class="ex7-card">${inner}</div></div>`;
  }
  function captureModal(){
    const K=ui.cap,C=K.C,td=throwData(C),bl=balls();
    const n=K.ball?nac(C,K.ball,false):null;
    const fainted=C.info.fainted;
    const ph=K.phase;
    const stage=`<div class="ex7-capstage ${ph}">
      <div class="ex7-capfoe">${ph==="shake"||ph==="caught"?"":`<img src="${esc(C.foe.sprite||C.foe.img)}" alt="${esc(C.foe.name)}" class="${fainted?"ko":""}">`}</div>
      ${ph==="aim"?`<div class="ex7-ringwrap" data-ex="ring" title="Clique quando o anel estiver pequeno"><i class="ex7-zone ok" style="--z:${td.target}"></i><i class="ex7-zone crit" style="--z:${Math.max(4,td.crit)}"></i><img class="ex7-ball" src="${esc(itemSprite(K.ball||"poke-ball"))}" alt=""><i class="ex7-ring"></i></div>`
        :`<div class="ex7-ballfx ${ph}"><img class="ex7-ball" src="${esc(itemSprite(K.ball||"poke-ball"))}" alt="" style="--s:${K.shakes||0}">${ph==="caught"?`<span class="ex7-stars">✦ ✦ ✦</span>`:""}</div>`}
      ${K.msg?`<b class="ex7-capmsg ${ph}">${esc(K.msg)}</b>`:""}
    </div>`;
    let body="";
    if(ph==="aim"){
      body=`<div class="ex7-capballs">${bl.length?bl.map(b=>{const bb=ballBonus(b.slug,C);return `<button type="button" class="ex7-capball${b.slug===K.ball?" on":""}" data-ex="pickball" data-v="${esc(b.slug)}" title="${esc(RULES()[b.slug]?.text||"")}"><img src="${esc(itemSprite(b.slug))}" alt="" width="28" height="28"><b>${esc(b.name)}</b><small>${bb.auto?"AUTO":`${bb.bonus>=0?"+":""}${bb.bonus}`} · ×${b.qty}</small></button>`;}).join(""):`<p class="ex7-warn">Sem Poké Balls na Bolsa.</p>`}</div>
        <div class="ex7-capnums"><span><small>ARREMESSO</small><b>${td.target}</b><em>d100 ≤ ${td.target} · crítico ≤ ${td.crit}${td.skill?"":" · sem perícia −15"}${td.st?.throw?` · ${td.st.label} +${td.st.throw}`:""}</em></span>
          <span><small>NAC</small><b>${n?(n.auto?"AUTO":n.value):"—"}</b><em>${n?n.parts.map(([k,v])=>`${esc(k)} ${typeof v==="number"?(v>=0?"+":"")+v:esc(v)}`).join(" · "):""}</em></span></div>
        <div class="ex7-acts"><button type="button" class="ex7-btn primary" data-ex="ring" ${K.ball?"":"disabled"}>🎯 Arremessar (anel)</button><button type="button" class="ex7-btn" data-ex="dice" ${K.ball?"":"disabled"}>🎲 Rolar d100</button><button type="button" class="ex7-btn ghost" data-ex="capback">${C.inBattle?"← Voltar à batalha":fainted?"Deixar ir":"← Voltar"}</button></div>
        <small class="ex7-hint">Clique no anel (ou Espaço) quando ele estiver pequeno: dentro do verde acerta, no dourado é crítico (+10 NAC).${C.inBattle?" A Poké Ball gasta a ação do turno.":""}</small>`;
    }else if(ph==="fly"||ph==="shake"){
      body=`<p class="ex7-hint">${ph==="fly"?`Arremesso: <b>${K.throwRoll}</b>`:`NAC ${K.nac?.auto?"automático":`${K.nac?.value} · d100 = ${K.capRoll}`}`}</p>`;
    }else if(ph==="caught"){
      body=`<p>${esc(C.foe.name)} foi enviado para o PC da ficha.</p><div class="ex7-acts"><button type="button" class="ex7-btn primary" data-ex="capback">Continuar</button></div>`;
    }else{
      const again=!K.fled&&bl.length;
      body=`<p>${K.fled?`<b>${esc(C.foe.name)} fugiu!</b>`:C.inBattle?"A batalha continua: o selvagem age neste turno.":""}</p>
        <div class="ex7-acts">${again&&!C.inBattle?`<button type="button" class="ex7-btn primary" data-ex="again">◓ Tentar de novo</button>`:""}<button type="button" class="ex7-btn ${again&&!C.inBattle?"":"primary"}" data-ex="capback">${C.inBattle?"← Voltar à batalha":K.fled||C.info.fainted?"Continuar":"← Voltar"}</button></div>`;
    }
    return `<div class="ex7-modal" role="dialog" aria-label="Captura"><div class="ex7-card ex7-cap">
      <p class="ex7-evtitle">${fainted?"Pokémon desmaiado":`Captura · Vida ${Math.round((C.info.pct??1)*100)}%`}${STATUS_CAP[C.info.status]?` · ${STATUS_CAP[C.info.status].label}`:""}</p>
      ${foeCard(C.foe)}${stage}${body}</div></div>`;
  }
  function render(){
    if(root.hidden&&!ui.cap)return;
    if(ui.view==="area"&&!exp())ui.view="map";
    root.innerHTML=`<div class="ex7-win">${head()}${ui.view==="area"?areaView():mapView()}</div>`;
    if(ui.cap?.phase==="aim")startRing();
    if(ui.pwd)setTimeout(()=>root.querySelector("#ex7Pwd")?.focus(),30);
  }

  /* ---------- eventos ---------- */
  root.addEventListener("click",async e=>{
    const b=e.target.closest("[data-ex]");if(!b||b.disabled)return;
    const a=b.dataset.ex,v=b.dataset.v;
    if(a==="close")close();
    else if(a==="pwd"){ui.pwd=true;render();}
    else if(a==="pwd-close"){ui.pwd=false;render();}
    else if(a==="go"){
      if(!team().length){toast("Ponha Pokémon na Equipe antes de explorar.");return;}
      if(hpNow()<1){toast(`Você está sem Vida. Cheia em ${fmtTime(fullIn())}.`);return;}
      newExpedition(v);ui.view="area";ui.ev=null;sfx("page");render();
    }
    else if(a==="leave"){if(confirm("Voltar para a cidade encerra a expedição (o time é curado). Voltar?"))endExpedition("Você voltou para a cidade. O time foi curado no Centro Pokémon.");}
    else if(a==="step")step(Number(v));
    else if(a==="ok"){ui.ev=null;render();}
    else if(a==="flee")flee();
    else if(a==="battle")battle();
    else if(a==="ball"){const ev=ui.ev;openCapture({foe:ev.foe,info:{pct:1,fainted:false,status:"",turn:ev.round||1},inBattle:false});}
    else if(a==="pickball"){if(ui.cap){ui.cap.ball=v;render();}}
    else if(a==="ring")doThrow("ring");
    else if(a==="dice")doThrow("dice");
    else if(a==="again"){if(ui.cap){ui.cap.phase="aim";ui.cap.msg="";ui.cap.C.turn=(ui.cap.C.turn||1)+1;if(bagQuantity(ui.cap.ball)<=0)ui.cap.ball=balls()[0]?.slug||"";render();}}
    else if(a==="capback")captureBack();
  });
  root.addEventListener("submit",async e=>{
    const f=e.target.closest("[data-ex-form]");if(!f)return;e.preventDefault();
    const inp=root.querySelector("#ex7Pwd"),msg=root.querySelector("#ex7PwdMsg");
    const txt=inp?.value||"";if(!txt.trim())return;
    let r=null;try{r=await tryPassword(txt);}catch(err){if(msg)msg.textContent="Este navegador não conseguiu conferir a senha.";return;}
    if(!r){if(msg){msg.textContent="Senha errada. Confira com o Mestre.";msg.classList.add("bad");}sfx("error");inp?.select();return;}
    const x=X();
    if(r.id===x.region){if(msg){msg.textContent=`Vocês já estão em ${r.name}.`;msg.classList.remove("bad");}return;}
    const first=!x.known.includes(r.id);
    x.region=r.id;if(first)x.known.push(r.id);x.exp=null;save();
    ui.pwd=false;ui.view="map";sfx("level");render();
    toast(first?`🗺 Nova região descoberta: ${r.name}!`:`🧭 O grupo viajou para ${r.name}.`);
  });
  document.addEventListener("keydown",e=>{
    if(root.hidden)return;
    if(e.key==="Escape"){if(ui.pwd){ui.pwd=false;render();}else if(!ui.ev)close();return;}
    if((e.key===" "||e.key==="Enter")&&ui.cap?.phase==="aim"&&!/^(INPUT|BUTTON)$/.test(document.activeElement?.tagName||"")){e.preventDefault();doThrow("ring");}
    // setas andam no mapa da área
    const e2=exp();
    if(ui.view==="area"&&e2&&!ui.ev&&!ui.busy){const d={ArrowLeft:-1,ArrowRight:1,ArrowUp:-W,ArrowDown:W}[e.key];if(d){const to=e2.pos+d;if(to>=0&&to<W*H&&neighbors(e2.pos).includes(to)){e.preventDefault();step(to);}}}
  });

  /* ---------- botão no topo (junto da Arena e da Mochila) ---------- */
  function mountTop(){
    let btn=document.getElementById("hhExploreBtn");
    if(!btn){
      const brand=document.querySelector(".topbar .brand");if(!brand)return;
      brand.insertAdjacentHTML("afterend",`<button type="button" id="hhExploreBtn" class="ar7-open-btn ex7-top" aria-label="Exploração: viajar e capturar Pokémon" title="Exploração: viajar e capturar Pokémon"><span class="ex7-topico"></span><span class="ar7-open-txt">Explorar</span></button>`);
      btn=document.getElementById("hhExploreBtn");
      btn.addEventListener("click",open);
    }
    const ico=btn.querySelector(".ex7-topico");if(ico&&!ico.firstChild&&ensureIcons())ico.innerHTML=px("compass",20);
    const anchor=document.getElementById("hhBagBtn")||document.getElementById("hhArenaBtn");
    if(anchor&&anchor.nextElementSibling!==btn)anchor.after(btn);
  }
  matchMedia("(min-width:901px)").addEventListener?.("change",()=>setTimeout(mountTop,30));
  let tries=0;const waitTop=setInterval(()=>{mountTop();if((document.getElementById("hhBagBtn")&&ensureIcons())||++tries>60)clearInterval(waitTop);},250);

  window.hhExplore={open,close,REGIONS,hpNow,maxHp,get state(){return X();}};
})();
