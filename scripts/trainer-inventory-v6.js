/* ============================================================
   V6 — Inventário de Viagem (página do Treinador)
   Itens que não cabem na Bolsa de combate: equipamentos,
   acampamento, comida, Poké Balls compradas na loja etc.
   Carteira ligada ao dinheiro do treinador, loja editável
   (começa com a Loja Inicial de Elysius), itens personalizados
   e um resumo do descanso conforme o equipamento que o
   treinador carrega.
   Dados em state.trainer.inventory = {items:[], shop:[], hiddenShop:[]}
   ============================================================ */
(function(){
  "use strict";
  const page=document.getElementById("pageTrainer");
  if(!page||typeof state==="undefined"||page.querySelector(".inv-wrap"))return;

  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const sfx=n=>window.hhClassicSfx?.[n]?.();
  const toast=t=>typeof showToast==="function"&&showToast(t);
  const save=()=>typeof debouncedSave==="function"&&debouncedSave();
  const newId=()=>typeof uid==="function"?uid():"inv"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const money=v=>`${Math.max(0,Math.round(Number(v)||0)).toLocaleString("pt-BR")}₽`;
  const int=(v,min=0,max=999999)=>Math.max(min,Math.min(max,Math.trunc(Number(v)||0)));

  /* ---------- Ícones em pixel art (16×16) ---------- */
  const PX_PAL={"o": "#181a24", "w": "#ffffff", "g": "#d4d8e2", "s": "#8a90a0", "r": "#e0393e", "R": "#a0242a", "p": "#ff9a9a", "b": "#3d7be0", "B": "#24468f", "c": "#9fd0ff", "y": "#f2c230", "Y": "#b88a10", "e": "#fff1a8", "G": "#2a9a63", "h": "#6fdc9c", "H": "#1a6a43", "n": "#b07a40", "N": "#6a4420", "t": "#e8b878", "v": "#8a5ad0", "V": "#5a3496", "l": "#c9a6ff", "k": "#2fb0c0", "K": "#1a7080", "q": "#a8f0f8", "f": "#ff8a2a", "F": "#c04a10", "L": "#b8bcc8", "S": "#5a6070", "D": "#3a3f4c", "x": "#2a1f3c", "X": "#120c1e", "Q": "#c9a6ff"};
  const PX={"rock":["................","................","......oooo......","....ooLLsSoo....","...oLLLssSSSo...","..oLLssssSSSDo..","..oLsssssSSSDo..",".oLsssssSSSSDDo.",".oLssssSSSSSDDo.",".osssssSSSSDDDo.",".oSssSSSSSDDDDo.","..oSSSSSDDDDDo..","...ooDDDDDDoo...",".....oooooo.....","................","................"],
    "shard":["................","........oo......",".......oQxo.....","......oQxxXo....",".....oQxxxXo....","....oQvxxxXXo...","...oQvxxxxXXo...","...oQxxxxXXXo...","..oQvxxxxXXXXo..","..oQxxxxXXXXXo..","..oQxxxxXXXXo...","...oxxxXXXXo....","....oxXXXXo.....",".....oXXoo......","......oo........","................"],
    "box":["................","................","...oooooooooo...","..ottttttttttno.",".otttttttttttno.","oooooooooooooonn","onnnnnnnnnnnnNNo","onnnnnoooonnnNNo","onnnnnottonnnNNo","onnnnnoooonnnNNo","onnnnnnnnnnnnNNo","onnnnnnnnnnnnNNo","oNNNNNNNNNNNNNNo","oooooooooooooooo","................","................"],
    "darkrock":["................","................","......oooo......","....oossDxoo....","...osssDDxxxo...","..ossDDDDxxxXo..","..osDDDDDxxxXo..",".osDDDDDxxxxXXo.",".osDDDDxxxxxXXo.",".oDDDDDxxxxXXXo.",".oxDDxxxxxXXXXo.","..oxxxxxXXXXXo..","...ooXXXXXXoo...",".....oooooo.....","................","................"],
    "bag":["......oooo......",".....o....o.....",".....o....o.....","...oooooooooo...","..orrrrrrrrrRo..",".orppprrrrrrRRo.",".orprrrrrrrrrRo.",".ooooooyyooooRo.",".orrrroyeyorrRo.",".orrrrooyoorrRo.",".orrrrrrrrrrrRo.",".oRrrrrrrrrrRRo.",".oRRRRRRRRRRRRo.",".onoooooooooono.","..o..........o..","................"],
    "ball":["................",".....oooooo.....","...oorrrrrroo...","..orpprrrrrrRo..",".orppprrrrrrRRo.",".orprrrrrrrrrRo.","orrrrrooorrrrRRo","oooooowwwoooooRo","ogggggowooggggso","owwwwwooowwwwwso",".owwwwwwwwwwwso.",".owwwwwwwwwwsso.","..owwwwwwwwsso..","...oosssssoo....",".....oooooo.....","................"],
    "potion":["................","......oooo......",".....osgggo.....","......oooo......","......owwo......","......owwo......",".....oowwoo.....","....ovvvvvvo....","...ovllvvvvVo...","...ovlvvvvvVo...","...owwwwwwwwo...","...owsswssswo...","...owwwwwwwwo...","...ovvvvvvvVo...","....oVVVVVVo....",".....oooooo....."],
    "shoe":["................","................","....oooo........","...obbbbo.......","...obcbbo.......","...obbbboooo....","...obbbbwbwbo...","...obcbbbbbbbo..","..obbbbbbbbbbbo.","..obbbbbbbbbbbbo","..oBBBBBBBBBBBBo","..owwwwwwwwwwwwo","..orrrrrrrrrrrro","...oooooooooooo.","................","................"],
    "tent":["................",".......oo.......","......orRo......",".....orrrRo.....","....orrorrRo....","....orrorrRo....","...orrrorrrRo...","...orrooorrRo...","..orrroNorrrRo..","..orrroNNorrRo..",".orrrroNNNorrRo.",".orrroNNNNNorRo.","orrrroNNNNNorrRo","oooooooooooooooo","GhGGhGGGhGGhGGhG","................"],
    "compass":["................",".....oooooo.....","...ooyyyyyyoo...","..oyyoooooooYo..","..oyowwwrwwoYo..",".oyowwwrrwwwoYo.",".oyowwwrrwwwoYo.",".oyowwwoowwwoYo.",".oyowwwssswwoYo.",".oyowwwsswwwoYo.","..oyowwwswwoYo..","..oYyoooooooYo..","...ooYYYYYYoo...",".....oooooo.....","................","................"],
    "gem":["................","................","....oooooooo....","...olcllvvvVo...","..olllllvvvVVo..",".oooooooooooooo.",".ollllcvvvvvVVo.","..olllcvvvvVVo..","...ollcvvvVVo...","....olcvvvVo....",".....olvvVo.....","......olVo......",".......oo.......","................","................","................"],
    "key":["................","................","...oooo.........","..oyeyyo........",".oyeooyyo.......",".oyo..oyo.......",".oyo..oyoooooooo",".oyyooyyyyyyyyYo","..oyyyyYooooyoYo","...ooooo...oYoYo","............o.o.","................","................","................","................","................"],
    "cart":["................","oo..............","oso.............",".ososooooooooooo","..oswwwwwwwwwwso","..oswGGwGGwGGwso","...oswGGwGGwGso.","...oswwwwwwwwso.","....osssssssso..","....osoooooooo..",".....ossssssso..","......oooooooo..",".....ooo...ooo..",".....oso...oso..",".....ooo...ooo..","................"],
    "moon":["................","......ooooo.....","....ooyyyyo..e..","...oyyyyyo..eee.","..oyyyyyo....e..","..oyeyyo........",".oyeyyyo........",".oyeyyyo.....e..",".oyyyyyyo.......",".oyyyyyyyo......","..oyyyyyyyooooo.","..oYyyyyyyyyyo..","...oYYyyyyyYo...","....ooYYYYYo....","......ooooo.....","................"],
    "coin":["................","......oooo......",".....oNNNNo.....","......onno......",".....oonnoo.....","...oonnnnnnoo...","..onnttnnnnnNo..",".onntoooonnnNNo.",".onntoyyyonnnNo.",".onnnoyooonnnNo.",".onnnoyyyonnnNo.",".onnnoooyonnnNo.",".onnnoyyyonnNNo.","..oNnooooonNNo..","...ooNNNNNNoo...",".....oooooo....."],
    "mart":["................",".oooooooooooooo.",".obbbbbbbbbbbbo.","obcbbbbbbbbbbbBo","oBBBBBBBBBBBBBBo","oooooooooooooooo",".owwwwwwwwwwwwo.",".owoooowwoooowo.",".owoqcowwocqowo.",".owoccowwoccowo.",".owoooowwoooowo.",".owwwwoooowwwwo.",".owwwwobbowwwwo.",".owwwwobbowwwwo.","oooooooooooooooo","................"],
    "plus":["................","................","......oooo......","......ohho......","......ohho......","......ohho......","..ooooohhooooo..","..ohhhhhhhhhho..","..ohhhhhhhhhho..","..ooooohhooooo..","......ohho......","......ohho......","......ohho......","......oooo......","................","................"]};
  const pxCache=new Map();
  function px(name,cls="inv-px"){
    const rows=PX[name];
    if(!rows)return "";
    const key=name+"|"+cls;
    if(pxCache.has(key))return pxCache.get(key);
    let rects="";
    rows.forEach((row,y)=>{
      let x=0;
      while(x<16){
        const ch=row[x];
        if(ch==="."){x++;continue;}
        let w=1;while(x+w<16&&row[x+w]===ch)w++;
        rects+=`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${PX_PAL[ch]}"/>`;
        x+=w;
      }
    });
    const svg=`<svg class="${cls}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
    pxCache.set(key,svg);
    return svg;
  }

  const CATS=[
    {id:"balls",label:"Poké Balls",icon:"px:ball",color:"#e0393e"},
    {id:"consumables",label:"Consumíveis",icon:"px:potion",color:"#2a9a63"},
    {id:"trainer",label:"Treinador",icon:"px:shoe",color:"#e39a12"},
    {id:"camping",label:"Acampamento",icon:"px:tent",color:"#a0703a"},
    {id:"exploration",label:"Exploração",icon:"px:compass",color:"#2f9fb0"},
    {id:"held",label:"Held Items",icon:"px:gem",color:"#8a5ad0"},
    {id:"other",label:"Outros",icon:"px:key",color:"#6a6fd0"}
  ];
  const CAT=Object.fromEntries(CATS.map(c=>[c.id,c]));

  /* Loja Inicial de Elysius */
  const ELYSIUS=[
    {key:"pokeball",name:"Pokébola Comum",icon:"ball:poke",category:"balls",price:200,usable:true,desc:"Poké Ball padrão para captura."},
    {key:"greatball",name:"Great Ball",icon:"ball:great",category:"balls",price:600,usable:true,desc:"Taxa de captura melhor que a Pokébola Comum."},
    {key:"ultraball",name:"Ultra Ball",icon:"ball:ultra",category:"balls",price:1200,usable:true,desc:"Alta taxa de captura."},
    {key:"potion",name:"Poção",icon:"🧴",category:"consumables",price:300,usable:true,desc:"Restaura 10 HP."},
    {key:"antidote",name:"Antídoto",icon:"💉",category:"consumables",price:100,usable:true,desc:"Remove Poison."},
    {key:"berry",name:"Berry",icon:"🍒",category:"consumables",price:100,usable:true,desc:"Pequenos efeitos: cura 5 HP ou 1 status leve."},
    {key:"food",name:"Comida Comum",icon:"🥪",category:"consumables",price:50,usable:true,desc:"Para o treinador. Evita desgaste em viagens longas."},
    {key:"pokefood",name:"Comida Pokémon Pré-preparada",icon:"🥫",category:"consumables",price:200,usable:true,desc:"Recupera 5 HP e melhora a Felicidade em +5."},
    {key:"runningshoes",name:"Sapatos de Corrida",icon:"px:shoe",category:"trainer",price:5000,desc:"+25 em Testes de Corpo para viagens longas ou correr.\nCusta 5 de Vida/Esforço por uso contínuo."},
    {key:"bicycle",name:"Bicicleta",icon:"🚲",category:"trainer",price:10000,desc:"+50 em Testes de Corpo para viagens longas.\nNão consome Vida/Esforço."},
    {key:"tent",name:"Barraca Simples",icon:"px:tent",category:"camping",price:500,large:true,rest:{pct:50,hp:5},desc:"Protege da chuva e frio leve.\nTreinador recupera +50% da Vida/Esforço ao dormir.\nPokémon recuperam +5 HP extra durante o descanso.\nCapacidade: 1 pessoa e 1 Pokémon pequeno."},
    {key:"tentplus",name:"Barraca Avançada",icon:"px:tent",category:"camping",price:1200,large:true,rest:{pct:100,hp:10},desc:"Melhor proteção contra clima adverso.\nTreinador recupera 100% da Vida/Esforço ao dormir.\nPokémon recuperam +10 HP extra durante o descanso.\nCapacidade: 2 pessoas e 2 Pokémon pequenos."},
    {key:"campkit",name:"Kit de Acampamento",icon:"🔥",category:"camping",price:400,large:true,desc:"Fogueira portátil, utensílios de cozinha e itens básicos.\nPermite cozinhar Comida Pokémon ou preparar Berries.\n+5 de Felicidade para Pokémon que compartilham a refeição."},
    {key:"bigbag",name:"Mochila Grande",icon:"px:bag",category:"camping",price:1000,backpack:true,desc:"Aumenta o limite de inventário: leva Itens Grandes sem causar sobrepeso."},
    {key:"blanket",name:"Manta de Sobrevivência",icon:"🛡️",category:"camping",price:200,rest:{pct:25,hp:null},desc:"Pode ser usada sem barraca.\nRecupera apenas 25% da Vida/Esforço durante o sono.\nRisco narrativo: pode sofrer penalidade em clima extremo."}
  ];
  /* PokéMart de Sylphora */
  const SYLPHORA=[
    {key:"sy-potion",name:"Potion",icon:"🧪",category:"consumables",price:350,usable:true,desc:"Cura 20 HP."},
    {key:"sy-superpotion",name:"Super Potion",icon:"🧪",category:"consumables",price:700,usable:true,desc:"Cura 50 HP."},
    {key:"sy-hyperpotion",name:"Hyper Potion",icon:"🧪",category:"consumables",price:1200,usable:true,desc:"Cura 120 HP."},
    {key:"sy-maxpotion",name:"Max Potion",icon:"🧪",category:"consumables",price:2500,usable:true,desc:"Cura totalmente."},
    {key:"sy-fullrestore",name:"Full Restore",icon:"💖",category:"consumables",price:3000,usable:true,desc:"Cura totalmente e remove status."},
    {key:"sy-antidote",name:"Antidote",icon:"💉",category:"consumables",price:100,usable:true,desc:"Cura Poison."},
    {key:"sy-paralyzeheal",name:"Paralyze Heal",icon:"⚡",category:"consumables",price:200,usable:true,desc:"Cura Paralysis."},
    {key:"sy-awakening",name:"Awakening",icon:"⏰",category:"consumables",price:200,usable:true,desc:"Cura Sleep."},
    {key:"sy-burnheal",name:"Burn Heal",icon:"🧯",category:"consumables",price:250,usable:true,desc:"Cura Burn."},
    {key:"sy-iceheal",name:"Ice Heal",icon:"🧊",category:"consumables",price:250,usable:true,desc:"Cura Freeze."},
    {key:"sy-fullheal",name:"Full Heal",icon:"✨",category:"consumables",price:600,usable:true,desc:"Cura todos os status."},
    {key:"sy-revive",name:"Revive",icon:"💠",category:"consumables",price:1500,usable:true,desc:"Revive com 50% do HP."},
    {key:"sy-maxrevive",name:"Max Revive",icon:"🔷",category:"consumables",price:4000,usable:true,rare:true,desc:"Revive com HP total.\nRaro, não é vendido normalmente."},
    {key:"pokeball",name:"Poké Ball",icon:"ball:poke",category:"balls",price:200,usable:true,premier:true,desc:"Chance básica de captura.\nA cada 10 compradas aqui, ganha 1 Premier Ball."},
    {key:"greatball",name:"Great Ball",icon:"ball:great",category:"balls",price:600,usable:true,desc:"Chance de captura melhorada."},
    {key:"ultraball",name:"Ultra Ball",icon:"ball:ultra",category:"balls",price:1200,usable:true,desc:"Chance de captura alta."},
    {key:"premierball",name:"Premier Ball",icon:"ball:premier",category:"balls",price:0,usable:true,bonus:true,desc:"Bônus: vem grátis a cada 10 Poké Balls compradas."},
    {key:"sy-escaperope",name:"Escape Rope",icon:"🪢",category:"exploration",price:550,usable:true,desc:"Escapa de cavernas e masmorras."},
    {key:"sy-repel",name:"Repel",icon:"🌫️",category:"exploration",price:350,usable:true,desc:"Evita encontros por 1 Viagem Longa."},
    {key:"sy-superrepel",name:"Super Repel",icon:"🌫️",category:"exploration",price:500,usable:true,desc:"Evita encontros por 2 Viagens Longas."},
    {key:"sy-maxrepel",name:"Max Repel",icon:"🌫️",category:"exploration",price:700,usable:true,desc:"Evita encontros por 3 Viagens Longas."},
    {key:"sy-focussash",name:"Focus Sash",icon:"🎗️",category:"held",price:4000,desc:"Segurado: com HP cheio, aguenta um golpe fatal com 1 HP. Depois é consumido."},
    {key:"sy-leftovers",name:"Leftovers",icon:"🍎",category:"held",price:4500,desc:"Segurado: ao fim de cada rodada, recupera 1/16 (6,25%) do HP Máximo."},
    {key:"sy-choiceband",name:"Choice Band",icon:"🎀",category:"held",price:5000,desc:"Segurado: Attack ×1,5 (sobe a Qualidade e a QD), mas fica preso ao primeiro golpe escolhido."},
    {key:"sy-choicespecs",name:"Choice Specs",icon:"👓",category:"held",price:5000,desc:"Segurado: Sp.Atk ×1,5 (sobe a Qualidade e a QD), mas fica preso ao primeiro golpe escolhido."},
    {key:"sy-choicescarf",name:"Choice Scarf",icon:"🧣",category:"held",price:5000,desc:"Segurado: Speed ×1,5, mas fica preso ao primeiro golpe escolhido."},
    {key:"sy-rockyhelmet",name:"Rocky Helmet",icon:"⛑️",category:"held",price:3800,desc:"Segurado: quem acerta o usuário com golpe de contato perde 1/6 do próprio HP Máximo."},
    {key:"sy-sitrusberry",name:"Sitrus Berry",icon:"🍊",category:"held",price:2000,desc:"Segurado: ao chegar a 1/2 do HP Máximo ou menos, é consumida e recupera 1/4 (25%) do HP Máximo."}
  ];
  const SHOPS=[
    {id:"elysius",name:"Loja Inicial de Elysius",icon:"px:coin",items:ELYSIUS,note:"Cada treinador começa com <b>12.000₽</b> para gastar livremente.",starter:true},
    {id:"sylphora",name:"PokéMart de Sylphora",icon:"px:mart",items:SYLPHORA,note:"Cura, captura, exploração e Held Items. A cada <b>10 Poké Balls</b> compradas aqui você ganha <b>1 Premier Ball</b>."},
    {id:"altamuralha",name:"Loja de Altamuralha",icon:"px:rock",items:[],catalog:true,note:"A primeira cidade grande vende quase todos os itens oficiais — Held Items, Mega Stones, Cristais Z, TMs, bagas, Poké Balls — <b>25% mais caro</b>, nada abaixo de <b>1.000₽</b>. Só não vende Master Ball, itens-chave e doces de nível."}
  ];
  const SHOP=Object.fromEntries(SHOPS.map(x=>[x.id,x]));
  const NO_GEAR={pct:10,hp:2};

  /* Pixel art oficial dos itens (sprites da PokéAPI, os mesmos da Bolsa). */
  const SPRITE_BY_KEY={
    pokeball:"poke-ball",greatball:"great-ball",ultraball:"ultra-ball",premierball:"premier-ball",
    potion:"potion",antidote:"antidote",berry:"oran-berry",bicycle:"bicycle"
  };
  SYLPHORA.forEach(x=>{if(x.key.startsWith("sy-"))SPRITE_BY_KEY[x.key]=x.name.toLowerCase().replace(/[^a-z0-9]+/g,"-");});
  const officialCache=new Map();
  function spriteSlug(i){
    if(i.sprite===false||i.sprite==="none")return "";
    if(i.sprite)return i.sprite;
    if(i.key&&SPRITE_BY_KEY[i.key])return SPRITE_BY_KEY[i.key];
    const name=String(i.name||"");
    if(!officialCache.has(name)){
      const hit=typeof officialItemByQuery==="function"?officialItemByQuery(name):null;
      officialCache.set(name,hit?.apiName?String(hit.apiName):"");
    }
    return officialCache.get(name);
  }
  const spriteUrl=slug=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${encodeURIComponent(slug)}.png`;

  function data(){
    const t=typeof ensureTrainerData==="function"?ensureTrainerData():(state.trainer||(state.trainer={}));
    if(!t.inventory||typeof t.inventory!=="object")t.inventory={};
    const inv=t.inventory;
    if(!Array.isArray(inv.items))inv.items=[];
    if(!Array.isArray(inv.shop))inv.shop=[];
    if(!Array.isArray(inv.hiddenShop))inv.hiddenShop=[];
    inv.hiddenShop=inv.hiddenShop.map(k=>String(k).includes(":")?String(k):"elysius:"+k);
    if(!SHOP[inv.shopId]&&!inv.shop.some(x=>x.shopId===inv.shopId))inv.shopId="elysius";
    inv.premierProgress=int(inv.premierProgress,0,9);
    inv.items=inv.items.filter(i=>i&&typeof i==="object").map(clean);
    // V7 — sistema de QD: itens segurados já comprados ganham o texto novo da loja
    if(!inv.qdTextV1){
      const all=SHOPS.flatMap(x=>x.items);
      inv.items.forEach(i=>{const s=all.find(x=>x.name.toLowerCase()===String(i.name).toLowerCase()&&x.category===i.category);if(s&&/\dd6/.test(i.desc||""))i.desc=s.desc;});
      inv.qdTextV1=true;
    }
    inv.shop=inv.shop.filter(i=>i&&typeof i==="object").map(clean);
    return {t,inv};
  }
  function clean(i){
    i.id=String(i.id||newId());
    i.name=String(i.name??"Item").slice(0,80)||"Item";
    i.icon=String(i.icon??"📦").slice(0,16);
    i.category=CAT[i.category]?i.category:"other";
    i.qty=int(i.qty??1,0,9999);
    i.price=int(i.price,0,99999999);
    i.desc=String(i.desc??"").slice(0,1200);
    i.large=!!i.large;i.usable=!!i.usable;i.backpack=!!i.backpack;i.rare=!!i.rare;
    if(i.shopId!=null)i.shopId=String(i.shopId);
    const oldEmoji={runningshoes:"👟",tent:"🛌",tentplus:"⛺",bigbag:"🎒"},newPx={runningshoes:"px:shoe",tent:"px:tent",tentplus:"px:tent",bigbag:"px:bag"};
    if(i.key&&oldEmoji[i.key]===i.icon)i.icon=newPx[i.key];
    if(i.icon==="🪨")i.icon=/dark|sombr|escur/i.test(i.name)?"px:darkrock":/obsidian/i.test(i.name)?"px:shard":"px:rock";
    if(i.icon==="📦")i.icon="px:box";
    if(i.sprite!=null&&i.sprite!==false)i.sprite=String(i.sprite).toLowerCase().replace(/[^a-z0-9-]+/g,"-").slice(0,60);
    if(i.rest&&typeof i.rest==="object"){
      const pct=int(i.rest.pct,0,100);
      i.rest={pct,hp:i.rest.hp==null||i.rest.hp===""?null:int(i.rest.hp,0,999)};
      if(!pct&&i.rest.hp==null)i.rest=null;
    }else i.rest=null;
    return i;
  }
  const shopList=(inv,shopId=inv.shopId)=>[
    ...(SHOP[shopId]?.items||[]).map(s=>({...s,id:shopId+":"+s.key,builtin:true})).filter(s=>!inv.hiddenShop.includes(s.id)),
    ...inv.shop.filter(s=>(s.shopId||"elysius")===shopId)
  ];

  const PICKER_ICONS=["box","rock","darkrock","shard","gem","key","potion","ball","compass","tent","shoe","bag","coin"];
  const pxOr=(icon,cls)=>/^px:/.test(icon||"")?px(icon.slice(3),cls):esc(icon||"");
  function iconHtml(icon,item){
    const slug=item?spriteSlug(item):"";
    if(slug)return `<img class="inv-sprite" src="${esc(spriteUrl(slug))}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${iconHtml(icon)}</span>`;
    if(/^px:/.test(icon||""))return px(icon.slice(3),"inv-px inv-px-item");
    const m=/^ball:(poke|great|ultra|premier)$/.exec(icon||"");
    if(m)return `<span class="inv-ball inv-ball-${m[1]}" aria-hidden="true"></span>`;
    if(!icon)return px("box","inv-px inv-px-item");
    return `<span class="inv-emoji" aria-hidden="true">${esc(icon)}</span>`;
  }

  /* ---------- Estado de tela ---------- */
  let filter="all",shopOpen=false,restOpen=false,editor=null,lastBuy=null,shopCat="all";

  const wrap=document.createElement("section");
  wrap.className="inv-wrap";
  wrap.id="trainerInventory";
  const anchor=page.querySelector(".tc-wrap");
  if(anchor)anchor.after(wrap);else page.prepend(wrap);

  function weightStatus(inv){
    const owned=inv.items.filter(i=>i.qty>0);
    const large=owned.filter(i=>i.large);
    const hasBag=owned.some(i=>i.backpack);
    if(large.length&&!hasBag)return {cls:"warn",text:`⚠ Sobrepeso: ${large.length} ${large.length>1?"itens":"item"} grande${large.length>1?"s":""} sem Mochila Grande`};
    if(hasBag)return {cls:"ok",text:"Mochila Grande: itens grandes liberados",icon:"bag"};
    return {cls:"",text:"Mochila comum: itens grandes causam sobrepeso"};
  }

  const holder=()=>typeof current!=="undefined"&&current?current:null;
  function itemCard(i){
    const c=CAT[i.category];
    return `<article class="inv-item${i.qty<=0?" is-empty":""}" style="--inv-c:${c.color}" data-id="${esc(i.id)}">
      <div class="inv-item-top">
        <div class="inv-icon">${iconHtml(i.icon,i)}</div>
        <div class="inv-item-name">
          <b>${esc(i.name)}</b>
          <span class="inv-tags">
            <em class="inv-tag cat">${esc(c.label)}</em>
            ${i.large?`<em class="inv-tag big">GRANDE</em>`:""}
            ${i.price?`<em class="inv-tag">${money(i.price)}</em>`:""}
            ${i.rest?`<em class="inv-tag rest">DESCANSO ${i.rest.pct}%</em>`:""}
          </span>
        </div>
        <span class="inv-qty-badge">×${i.qty}</span>
      </div>
      ${i.desc?`<p class="inv-desc">${esc(i.desc).replace(/\n/g,"<br>")}</p>`:`<p class="inv-desc empty">Sem descrição. Use ✎ para anotar o que este item faz.</p>`}
      <div class="inv-item-actions">
        <div class="inv-stepper">
          <button type="button" data-inv="dec" aria-label="Diminuir">−</button>
          <input type="number" min="0" max="9999" value="${i.qty}" data-inv="qty" aria-label="Quantidade de ${esc(i.name)}">
          <button type="button" data-inv="inc" aria-label="Aumentar">＋</button>
        </div>
        ${i.usable?`<button type="button" class="inv-btn use" data-inv="use"${i.qty<=0?" disabled":""}>${i.category==="balls"?"LANÇAR":"USAR"}</button>`:""}
        ${i.category==="held"&&holder()?`<button type="button" class="inv-btn use" data-inv="equip"${i.qty<=0?" disabled":""} title="Equipar como item segurado de ${esc(holder().name)}">DAR A ${esc(String(holder().name||"POKÉMON").toUpperCase())}</button>`:""}
        <span class="inv-spacer"></span>
        <button type="button" class="inv-icon-btn" data-inv="edit" title="Editar item" aria-label="Editar ${esc(i.name)}">✎</button>
        <button type="button" class="inv-icon-btn danger" data-inv="del" title="Remover item" aria-label="Remover ${esc(i.name)}">🗑</button>
      </div>
    </article>`;
  }

  function shopHtml(inv,t){
    const list=shopList(inv).filter(s=>shopCat==="all"||s.category===shopCat);
    const groups=CATS.map(c=>({c,rows:list.filter(s=>s.category===c.id)})).filter(g=>g.rows.length);
    const shop=SHOP[inv.shopId];
    const empty=shop?.starter&&t.money<=0&&!inv.items.length;
    const hiddenHere=inv.hiddenShop.filter(id=>id.startsWith(inv.shopId+":")).length;
    return `<div class="inv-shop">
      <div class="inv-shop-picker" role="tablist" aria-label="Lojas">
        ${SHOPS.map(x=>`<button type="button" role="tab" data-shoppick="${x.id}" class="${x.id===inv.shopId?"on":""}" aria-selected="${x.id===inv.shopId}">${pxOr(x.icon)} ${esc(x.name)}</button>`).join("")}
      </div>
      <div class="inv-shop-head">
        <div><small>LOJA</small><b>${esc(shop?.name||"Loja")}</b></div>
        <div class="inv-shop-wallet">Carteira <b>${money(t.money)}</b></div>
      </div>
      <p class="inv-shop-note">${shop?.note||""} Comprar desconta da carteira e guarda o item no inventário.</p>
      ${shop?.catalog?`<div class="inv-shop-catalog"><b>🏔 ${window.hhItemsUI?.shopItems?window.hhItemsUI.shopItems().length:"Centenas de"} itens à venda</b><span>A loja é grande demais para esta lista: abra na Mochila, com busca, categorias e o efeito de cada item.</span><button type="button" class="inv-btn buy" data-it-open="shop">🛒 Entrar na Loja de Altamuralha</button></div>`:""}
      <div class="inv-shop-tools">
        ${empty?`<button type="button" class="inv-btn" data-inv="startmoney">💰 Receber os 12.000₽ iniciais</button>`:""}
        ${lastBuy?`<button type="button" class="inv-btn ghost" data-inv="undo">↶ Desfazer: ${esc(lastBuy.name)} ×${lastBuy.qty}</button>`:""}
        <span class="inv-spacer"></span>
        <button type="button" class="inv-btn ghost" data-inv="newshop">＋ Item na loja</button>
      </div>
      <div class="inv-chips small"${shop?.catalog?" hidden":""}>
        <button type="button" data-shopcat="all" class="${shopCat==="all"?"on":""}">Tudo</button>
        ${CATS.map(c=>`<button type="button" data-shopcat="${c.id}" class="${shopCat===c.id?"on":""}">${pxOr(c.icon)} ${c.label}</button>`).join("")}
      </div>
      ${shop?.catalog?"":groups.length?groups.map(g=>`<div class="inv-shop-group" style="--inv-c:${g.c.color}">
        <h4>${pxOr(g.c.icon)} ${esc(g.c.label)}</h4>
        ${g.rows.map(s=>{
          const owned=inv.items.find(i=>sameItem(i,s));
          const poor=s.price>t.money;
          const progress=s.premier?`<em class="inv-tag rest">PREMIER ${inv.premierProgress}/10</em>`:"";
          return `<div class="inv-shop-row" data-shop="${esc(s.id)}">
            <div class="inv-icon sm">${iconHtml(s.icon,s)}</div>
            <div class="inv-shop-info">
              <b>${esc(s.name)}${s.large?` <em class="inv-tag big">GRANDE</em>`:""}${s.rare?` <em class="inv-tag big">RARO</em>`:""}${progress}${owned&&owned.qty?` <em class="inv-tag own">TEM ×${owned.qty}</em>`:""}</b>
              <small>${esc(s.desc).replace(/\n/g," · ")}</small>
            </div>
            <span class="inv-price">${s.bonus?"BÔNUS":money(s.price)}</span>
            <input type="number" min="1" max="99" value="1" data-shopqty aria-label="Quantidade">
            ${s.bonus?`<span class="inv-bonus-note">grátis</span>`:`<button type="button" class="inv-btn buy" data-inv="buy"${poor?` title="Dinheiro insuficiente"`:""}>COMPRAR</button>`}
            <button type="button" class="inv-icon-btn" data-inv="give" title="Adicionar sem pagar">🎁</button>
            <button type="button" class="inv-icon-btn danger" data-inv="shopdel" title="${s.builtin?"Esconder da loja":"Remover da loja"}">✕</button>
          </div>`;}).join("")}
      </div>`).join(""):`<div class="inv-empty">Nenhum item nesta seção da loja.</div>`}
      ${hiddenHere?`<button type="button" class="inv-link" data-inv="restoreshop">Mostrar de novo os ${hiddenHere} item(ns) escondidos desta loja</button>`:""}
    </div>`;
  }

  function restHtml(inv){
    const owned=inv.items.filter(i=>i.qty>0&&i.rest);
    const options=[...owned.map(i=>({id:i.id,name:i.name,icon:i.icon,...i.rest})),{id:"none",name:"Sem equipamento",icon:"px:moon",...NO_GEAR}];
    options.sort((a,b)=>b.pct-a.pct);
    const pick=options.find(o=>o.id===restPick)||options[0];
    const kit=inv.items.some(i=>i.qty>0&&/kit de acampamento/i.test(i.name));
    const hpText=pick.id==="none"?`Pokémon só restauram <b>${NO_GEAR.hp} HP</b>`:pick.hp==null?`Pokémon: sem bônus de HP informado`:`Pokémon recuperam <b>+${pick.hp} HP extra</b>`;
    return `<div class="inv-rest">
      <div class="inv-rest-head"><small>MECÂNICA DE DESCANSO</small><b>Onde o grupo vai dormir?</b></div>
      <div class="inv-chips">
        ${options.map(o=>`<button type="button" data-restpick="${esc(o.id)}" class="${o.id===pick.id?"on":""}">${/^ball:/.test(o.icon)?"":pxOr(o.icon)} ${esc(o.name)}</button>`).join("")}
      </div>
      <div class="inv-rest-result">
        <div class="inv-rest-meter"><span style="width:${pick.pct}%"></span><b>${pick.pct}%</b></div>
        <p>Treinador recupera <b>${pick.pct}% da Vida/Esforço</b> · ${hpText}.</p>
        ${kit?`<p class="inv-rest-bonus">🔥 Kit de Acampamento: Pokémon que dividirem a refeição ganham <b>+5 de Felicidade</b>.</p>`:""}
        <p class="inv-rest-rule">Sem equipamento 10% e 2 HP · Manta 25% · Barraca Simples 50% · Barraca Avançada 100%. Kit de acampamento e comida melhoram o moral do grupo e a relação com os Pokémon.</p>
      </div>
    </div>`;
  }
  let restPick=null;

  function editorHtml(){
    const e=editor.item;
    return `<form class="inv-editor" data-inv-form>
      <div class="inv-editor-head"><b>${editor.mode==="edit"?"Editar item":editor.target==="shop"?"Novo item da loja":"Novo item personalizado"}</b></div>
      <div class="inv-editor-grid">
        <label class="wide"><span>Nome</span><input name="name" required maxlength="80" value="${esc(e.name)}" placeholder="Ex.: Lanterna, Corda, Mapa de Elysius"></label>
        <label class="wide"><span>Ícone</span>
          <span class="inv-icon-picker">
            ${PICKER_ICONS.map(n=>`<button type="button" data-pick-icon="px:${n}" class="${e.icon==="px:"+n?"on":""}" title="${n}">${px(n)}</button>`).join("")}
            <input name="icon" maxlength="16" value="${esc(e.icon)}" placeholder="ou emoji" aria-label="Ícone (px:nome ou emoji)">
          </span>
        </label>
        <label><span>Pixel art (nome do item em inglês)</span><input name="sprite" maxlength="60" value="${esc(e.sprite||"")}" placeholder="ex.: rare-candy"></label>
        <label><span>Categoria</span><select name="category">${CATS.map(c=>`<option value="${c.id}"${c.id===e.category?" selected":""}>${c.label}</option>`).join("")}</select></label>
        ${editor.target==="shop"?"":`<label><span>Quantidade</span><input name="qty" type="number" min="0" max="9999" value="${e.qty}"></label>`}
        <label><span>Preço (₽)</span><input name="price" type="number" min="0" value="${e.price}"></label>
        <label class="wide"><span>Efeito / descrição</span><textarea name="desc" rows="3" maxlength="1200" placeholder="O que o item faz. Uma linha por efeito.">${esc(e.desc)}</textarea></label>
        <label class="check"><input type="checkbox" name="usable"${e.usable?" checked":""}> Consumível (botão USAR gasta 1)</label>
        <label class="check"><input type="checkbox" name="large"${e.large?" checked":""}> Item Grande (precisa de Mochila Grande)</label>
        <label class="check"><input type="checkbox" name="backpack"${e.backpack?" checked":""}> Funciona como Mochila Grande</label>
        <label><span>Descanso: % de Vida/Esforço</span><input name="restPct" type="number" min="0" max="100" value="${e.rest?e.rest.pct:""}" placeholder="—"></label>
        <label><span>Descanso: HP extra dos Pokémon</span><input name="restHp" type="number" min="0" max="999" value="${e.rest&&e.rest.hp!=null?e.rest.hp:""}" placeholder="—"></label>
      </div>
      <div class="inv-editor-actions">
        <button type="button" class="inv-btn ghost" data-inv="cancel">Cancelar</button>
        <button type="submit" class="inv-btn buy">${editor.mode==="edit"?"Salvar":editor.target==="shop"?"Adicionar à loja":"Adicionar ao inventário"}</button>
      </div>
    </form>`;
  }

  function render(){
    if(window.hhDefer?.("pageTrainer",render))return;
    const {t,inv}=data();
    const counts=Object.fromEntries(CATS.map(c=>[c.id,inv.items.filter(i=>i.category===c.id).length]));
    const items=inv.items.filter(i=>filter==="all"||i.category===filter);
    const total=inv.items.reduce((s,i)=>s+i.qty,0);
    const value=inv.items.reduce((s,i)=>s+i.qty*i.price,0);
    const w=weightStatus(inv);
    const keepFocus=document.activeElement&&wrap.contains(document.activeElement)?document.activeElement.dataset.inv||document.activeElement.name:null;
    wrap.innerHTML=`
      <header class="inv-head">
        <div class="inv-title">
          <span class="inv-title-icon">${px("bag","inv-px inv-px-title")}</span>
          <div><small>TREINADOR</small><b>Inventário de Viagem</b><span>Equipamentos e itens que não vão na Bolsa de combate</span></div>
        </div>
        <label class="inv-wallet"><span>CARTEIRA</span><div><b>₽</b><input type="number" min="0" step="1" value="${int(t.money,0,999999999)}" data-inv="money" aria-label="Dinheiro do treinador"></div></label>
      </header>
      <div class="inv-status">
        <span><b>${total}</b> itens</span>
        <span>Valor guardado <b>${money(value)}</b></span>
        <span class="inv-weight ${w.cls}">${w.icon?px(w.icon):""}${w.text}</span>
      </div>
      <div class="inv-toolbar">
        <div class="inv-chips">
          <button type="button" data-filter="all" class="${filter==="all"?"on":""}">Tudo <i>${inv.items.length}</i></button>
          ${CATS.map(c=>`<button type="button" data-filter="${c.id}" class="${filter===c.id?"on":""}" style="--inv-c:${c.color}">${pxOr(c.icon)} ${c.label} <i>${counts[c.id]}</i></button>`).join("")}
        </div>
        <div class="inv-main-actions">
          <button type="button" class="inv-btn shop${shopOpen?" on":""}" data-inv="shop" aria-expanded="${shopOpen}">${px("cart")} LOJA</button>
          <button type="button" class="inv-btn rest${restOpen?" on":""}" data-inv="rest" aria-expanded="${restOpen}">${px("moon")} DESCANSO</button>
          <button type="button" class="inv-btn" data-inv="new">${px("plus")} ITEM</button>
        </div>
      </div>
      ${editor?editorHtml():""}
      ${restOpen?restHtml(inv):""}
      ${shopOpen?shopHtml(inv,t):""}
      <div class="inv-grid">
        ${items.length?items.map(itemCard).join(""):`<div class="inv-empty">${inv.items.length?"Nada nesta categoria.":"Inventário vazio. Abra a <b>LOJA</b> para comprar os itens iniciais ou crie um <b>＋ ITEM</b> personalizado."}</div>`}
      </div>`;
    if(keepFocus==="money")wrap.querySelector("[data-inv=money]")?.focus();
  }

  function sameItem(i,s){
    if(s.key&&i.key)return i.key===s.key;
    return i.name.trim().toLowerCase()===String(s.name).trim().toLowerCase()&&i.category===s.category;
  }
  function addToInventory(src,qty){
    const {inv}=data();
    let item=inv.items.find(i=>sameItem(i,src));
    if(item)item.qty=int(item.qty+qty,0,9999);
    else{
      item=clean({...JSON.parse(JSON.stringify(src)),id:newId(),qty});
      delete item.builtin;
      inv.items.push(item);
    }
    return item;
  }
  function syncMoney(){
    const input=document.getElementById("trainerMoney");
    if(input&&document.activeElement!==input)input.value=state.trainer.money;
    if(typeof renderTrainerIdentity==="function")renderTrainerIdentity();
    if(typeof renderTrainerSummary==="function")renderTrainerSummary();
    document.dispatchEvent(new CustomEvent("hh:trainermoney"));
  }
  function refreshCard(){
    // Atualiza o dinheiro mostrado no Trainer Card.
    const el=page.querySelector(".tc-money");
    if(el)el.textContent=`₽ ${Number(state.trainer.money||0).toLocaleString("pt-BR")}`;
  }
  function commit(){save();render();}

  /* ---------- Eventos ---------- */
  wrap.addEventListener("click",event=>{
    const f=event.target.closest("[data-filter]");
    if(f){filter=f.dataset.filter;sfx("select");render();return;}
    const sc=event.target.closest("[data-shopcat]");
    if(sc){shopCat=sc.dataset.shopcat;sfx("select");render();return;}
    const pick=event.target.closest("[data-pick-icon]");
    if(pick){
      const form=pick.closest("[data-inv-form]");
      if(form){form.elements.icon.value=pick.dataset.pickIcon;form.querySelectorAll("[data-pick-icon]").forEach(b=>b.classList.toggle("on",b===pick));sfx("select");}
      return;
    }
    const sp=event.target.closest("[data-shoppick]");
    if(sp){const {inv}=data();inv.shopId=sp.dataset.shoppick;shopCat="all";sfx("page");commit();return;}
    const rp=event.target.closest("[data-restpick]");
    if(rp){restPick=rp.dataset.restpick;sfx("select");render();return;}
    const b=event.target.closest("[data-inv]");
    if(!b||b.tagName==="INPUT")return;
    const {t,inv}=data();
    const act=b.dataset.inv;
    const card=b.closest(".inv-item");
    const item=card?inv.items.find(i=>i.id===card.dataset.id):null;
    const row=b.closest(".inv-shop-row");
    const shopItem=row?shopList(inv).find(s=>s.id===row.dataset.shop):null;

    if(act==="shop"){shopOpen=!shopOpen;sfx(shopOpen?"page":"cancel");render();return;}
    if(act==="rest"){restOpen=!restOpen;sfx(restOpen?"page":"cancel");render();return;}
    if(act==="new"||act==="newshop"){
      editor={mode:"new",target:act==="newshop"?"shop":"items",item:clean({name:"",icon:"px:box",category:filter!=="all"?filter:"other",qty:1,price:0,desc:""})};
      editor.item.name="";sfx("page");render();wrap.querySelector(".inv-editor input[name=name]")?.focus();return;
    }
    if(act==="cancel"){editor=null;sfx("cancel");render();return;}
    if(act==="startmoney"){t.money=12000;syncMoney();refreshCard();sfx("page");toast("💰 12.000₽ na carteira");commit();return;}
    if(act==="restoreshop"){inv.hiddenShop=inv.hiddenShop.filter(id=>!id.startsWith(inv.shopId+":"));sfx("select");commit();return;}
    if(act==="undo"&&lastBuy){
      const it=inv.items.find(i=>i.id===lastBuy.id);
      if(it){it.qty=Math.max(0,it.qty-lastBuy.qty);if(!it.qty&&lastBuy.created)inv.items=inv.items.filter(i=>i!==it);}
      if(lastBuy.premier){
        const pb=inv.items.find(i=>i.key==="premierball");
        if(pb){pb.qty=Math.max(0,pb.qty-lastBuy.premier.bonus);if(!pb.qty&&lastBuy.premier.created)inv.items=inv.items.filter(i=>i!==pb);}
        inv.premierProgress=lastBuy.premier.before;
      }
      t.money=int(t.money+lastBuy.cost,0,999999999);
      toast(`↶ Compra desfeita: +${money(lastBuy.cost)}`);
      lastBuy=null;syncMoney();refreshCard();sfx("cancel");commit();return;
    }
    if(shopItem&&(act==="buy"||act==="give")){
      const qty=int(row.querySelector("[data-shopqty]")?.value||1,1,99);
      const cost=act==="buy"?shopItem.price*qty:0;
      if(cost>t.money){sfx("error");toast(`Dinheiro insuficiente: faltam ${money(cost-t.money)}`);return;}
      const existed=inv.items.some(i=>sameItem(i,shopItem));
      const it=addToInventory(shopItem,qty);
      t.money=int(t.money-cost,0,999999999);
      lastBuy=act==="buy"?{id:it.id,qty,cost,name:shopItem.name,created:!existed}:null;
      let bonusText="";
      if(act==="buy"&&shopItem.premier){
        const before=inv.premierProgress,total=before+qty,bonus=Math.floor(total/10);
        inv.premierProgress=total%10;
        const premierSrc=(SHOP[inv.shopId]?.items||[]).find(x=>x.key==="premierball");
        if(bonus&&premierSrc){
          const hadPremier=inv.items.some(i=>i.key==="premierball");
          addToInventory(premierSrc,bonus);
          bonusText=` + ${bonus} Premier Ball${bonus>1?"s":""} grátis`;
          lastBuy.premier={bonus,before,created:!hadPremier};
        }else lastBuy.premier={bonus:0,before,created:false};
      }
      syncMoney();refreshCard();sfx("page");
      toast(act==="buy"?`🛒 ${shopItem.name} ×${qty} por ${money(cost)}${bonusText}`:`🎁 ${shopItem.name} ×${qty} adicionado`);
      commit();return;
    }
    if(shopItem&&act==="shopdel"){
      if(shopItem.builtin)inv.hiddenShop.push(shopItem.id);
      else inv.shop=inv.shop.filter(s=>s.id!==shopItem.id);
      sfx("cancel");commit();return;
    }
    if(!item)return;
    if(act==="inc"){item.qty=int(item.qty+1,0,9999);sfx("select");commit();return;}
    if(act==="dec"){item.qty=int(item.qty-1,0,9999);sfx("select");commit();return;}
    if(act==="use"&&item.qty>0){
      item.qty-=1;sfx("page");
      toast(`${item.category==="balls"?"◓ Lançou":"✓ Usou"} ${item.name} · restam ${item.qty}`);
      if(!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches){
        card.classList.remove("inv-used");void card.offsetWidth;card.classList.add("inv-used");
        setTimeout(commit,260);
      }else commit();
      return;
    }
    if(act==="equip"&&item.qty>0){
      const p=holder();
      if(!p)return;
      const previous=p.heldItem||"";
      const official=typeof officialItemByQuery==="function"?officialItemByQuery(item.name):null;
      if(official&&typeof registerOfficialItem==="function")registerOfficialItem(official.name,{equip:true});
      else{
        p.heldItem=item.name;
        if(!p.itemText)p.itemText=item.desc;
        if(typeof syncHeldItemFields==="function")syncHeldItemFields(p);
        if(typeof renderCombatPage==="function")renderCombatPage();
      }
      item.qty-=1;
      if(previous&&previous.toLowerCase()!==item.name.toLowerCase()){
        const back=inv.items.find(i=>i.name.toLowerCase()===previous.toLowerCase());
        if(back)back.qty=int(back.qty+1,0,9999);
      }
      sfx("page");
      toast(`💎 ${p.name||"Pokémon"} agora segura ${item.name}${previous&&previous.toLowerCase()!==item.name.toLowerCase()?` · ${previous} ${inv.items.some(i=>i.name.toLowerCase()===previous.toLowerCase())?"voltou ao inventário":"foi retirado"}`:""}`);
      if(typeof debouncedSave==="function")debouncedSave();
      commit();return;
    }
    if(act==="edit"){editor={mode:"edit",target:"items",id:item.id,item:JSON.parse(JSON.stringify(item))};sfx("page");render();wrap.querySelector(".inv-editor")?.scrollIntoView({block:"nearest",behavior:"smooth"});return;}
    if(act==="del"){
      if(card.dataset.confirm!=="1"){card.dataset.confirm="1";b.textContent="✓?";b.title="Clique de novo para remover";setTimeout(()=>{if(b.isConnected){b.textContent="🗑";card.dataset.confirm="";}},2500);return;}
      inv.items=inv.items.filter(i=>i!==item);sfx("cancel");toast(`🗑 ${item.name} removido`);commit();return;
    }
  });

  wrap.addEventListener("change",event=>{
    const el=event.target;
    const {t,inv}=data();
    if(el.dataset.inv==="money"){
      t.money=int(el.value,0,999999999);el.value=t.money;
      syncMoney();refreshCard();save();render();return;
    }
    if(el.dataset.inv==="qty"){
      const item=inv.items.find(i=>i.id===el.closest(".inv-item")?.dataset.id);
      if(item){item.qty=int(el.value,0,9999);commit();}
    }
  });

  wrap.addEventListener("submit",event=>{
    event.preventDefault();
    const form=event.target.closest("[data-inv-form]");
    if(!form||!editor)return;
    const v=n=>form.elements[n]?.value;
    const c=n=>!!form.elements[n]?.checked;
    const restPct=v("restPct"),restHp=v("restHp");
    const fields={
      name:String(v("name")||"").trim()||"Item",
      icon:String(v("icon")||"").trim()||"px:box",
      sprite:String(v("sprite")||"").trim()||null,
      category:v("category"),
      qty:editor.target==="shop"?1:int(v("qty"),0,9999),
      price:int(v("price"),0,99999999),
      desc:String(v("desc")||"").trim(),
      usable:c("usable"),large:c("large"),backpack:c("backpack"),
      rest:restPct!==""||restHp!==""?{pct:int(restPct,0,100),hp:restHp===""?null:int(restHp,0,999)}:null
    };
    const {inv}=data();
    if(editor.mode==="edit"){
      const item=inv.items.find(i=>i.id===editor.id);
      if(item)Object.assign(item,fields),clean(item);
      toast(`✎ ${fields.name} salvo`);
    }else if(editor.target==="shop"){
      inv.shop.push(clean({...fields,id:newId(),shopId:inv.shopId}));
      shopOpen=true;toast(`🛒 ${fields.name} na loja`);
    }else{
      inv.items.push(clean({...fields,id:newId()}));
      if(filter!=="all"&&filter!==fields.category)filter="all";
      toast(`＋ ${fields.name} no inventário`);
    }
    editor=null;sfx("page");commit();
  });

  document.getElementById("trainerMoney")?.addEventListener("input",()=>{
    const input=wrap.querySelector("[data-inv=money]");
    if(input&&document.activeElement!==input)input.value=int(state.trainer?.money,0,999999999);
    if(shopOpen)render();
  });

  if(typeof window.renderTrainerPage==="function"){
    const original=window.renderTrainerPage;
    window.renderTrainerPage=function(){const r=original.apply(this,arguments);render();return r;};
  }
  window.hhTrainerInventory={render,shops:SHOPS,data};
  render();
})();
