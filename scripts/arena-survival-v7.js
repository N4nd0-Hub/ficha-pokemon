/* ============================================================
   V7 — Arena: Desafio Sem Fim (gerador de oponentes e IA)
   Cada onda traz Pokémon aleatórios da PokéAPI. Os atributos seguem a
   regra da ficha (Base Stats + 6 pontos por nível) e os pontos são
   distribuídos por um "estilo" sorteado: Tanque aguenta mais, Atacante
   e Especialista batem mais, Veloz age primeiro… A cada onda o nível,
   os pontos extras e o Base Stat máximo permitido sobem; a cada 5 ondas
   vem uma Elite e a cada 10 um Chefe com dois Pokémon.
   Golpes vêm da PokéAPI e ganham uma descrição em português montada a
   partir dos dados oficiais (estágios, status, Flinch, dreno, recuo…),
   que o leitor de regras da arena entende.

   Desafios das cidades: cada cidade tem uma área com um tipo só.
   Altamuralha (Pedra) → Abismo Rochoso, do Lv 15 ao 30: cada andar é
   mais fundo, mais forte e com mais Elites; no andar 16 está o Guardião
   (com Terastalização Pedra). Depois dele o abismo continua sem fundo.
   ============================================================ */
(function(root){
  "use strict";
  const API="https://pokeapi.co/api/v2/";
  const MAX_ID=1025;
  const cache=new Map();
  const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const cap=s=>String(s||"").split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  async function get(path){
    const url=path.startsWith("http")?path:API+path;
    if(cache.has(url))return cache.get(url);
    const p=fetch(url).then(r=>{if(!r.ok)throw new Error("PokéAPI "+r.status);return r.json();});
    cache.set(url,p);
    try{return await p;}catch(e){cache.delete(url);throw e;}
  }

  const STAT_KEY={hp:"hp",attack:"atk",defense:"def","special-attack":"spa","special-defense":"spd",speed:"spe"};
  const STAT_PT={atk:"Attack",def:"Defense",spa:"Sp. Atk",spd:"Sp. Def",spe:"Speed",accuracy:"Precisão",evasion:"Evasão"};
  const BUILDS={
    tank:{label:"Tanque",w:{hp:4,atk:1,def:3,spa:1,spd:3,spe:.5}},
    attacker:{label:"Atacante",w:{hp:1.5,atk:4,def:1,spa:.3,spd:1,spe:2.5}},
    special:{label:"Especialista",w:{hp:1.5,atk:.3,def:1,spa:4,spd:1,spe:2.5}},
    speedy:{label:"Veloz",w:{hp:1,atk:2.5,def:.6,spa:2.5,spd:.6,spe:4}},
    bruiser:{label:"Brutamontes",w:{hp:3,atk:3.5,def:2,spa:.5,spd:1.5,spe:.5}},
    balanced:{label:"Equilibrado",w:{hp:2,atk:2,def:2,spa:2,spd:2,spe:2}}
  };

  /* Dificuldade da onda */
  function waveInfo(n,refLevel){
    const ref=Math.max(1,Math.min(100,refLevel||10));
    const boss=n%10===0,elite=!boss&&n%5===0;
    const level=Math.max(2,Math.min(100,Math.round(ref*.7+n*1.6+(elite?3:0)+(boss?5:0))));
    const bstCap=boss?999:Math.min(720,300+n*22+(elite?60:0));
    const bonus=Math.round((n-1)*3*(boss?1.5:elite?1.25:1));
    return {n,level,bstCap,bonus,boss,elite,count:boss?2:1};
  }

  /* ---------- Desafios das cidades ---------- */
  const REGIONS={
    altamuralha:{id:"altamuralha",city:"Altamuralha",area:"Abismo Rochoso",type:"Rock",typePt:"Pedra",minLv:15,maxLv:30,floors:16,scene:"cave",
      icon:"abyss",boss:"Guardião do Abismo",trainer:"Montanhista",
      zones:[[1,"Fenda da Muralha"],[5,"Galerias de Quartzo"],[9,"Veios de Âmbar"],[13,"Câmaras Profundas"],[16,"Coração do Abismo"],[17,"Abismo sem Fundo"]]}
  };
  function zoneOf(region,n){let z=region.zones[0][1];for(const [f,name] of region.zones)if(n>=f)z=name;return z;}
  /* Andar n: Lv sobe 1 por andar (15 → 30); Elite a cada 4; Guardião no 16;
     depois do 16, Lv 30 e um Guardião a cada 5 andares. */
  function regionInfo(regionId,n){
    const R0=REGIONS[regionId]||REGIONS.altamuralha;
    const past=n>R0.floors;
    const boss=n===R0.floors||(past&&(n-R0.floors)%5===0);
    const elite=!boss&&(n%4===0||(past&&n%2===0));
    const level=Math.min(R0.maxLv,R0.minLv+n-1);
    const bstCap=boss?999:Math.min(600,330+n*15+(elite?40:0)+(past?(n-R0.floors)*10:0));
    const bonus=Math.round((n-1)*2.5*(boss?1.6:elite?1.3:1))+(past?(n-R0.floors)*4:0);
    const count=boss?2:(elite&&n>=8)||(past&&n%3===0)?2:1;
    return {n,level,bstCap,bonus,boss,elite,count,region:R0.id,depth:n*40,zone:zoneOf(R0,n),ppg:boss?3:elite?2:1,
      label:boss?R0.boss:elite?R0.trainer:"Selvagem"};
  }
  const typePools=new Map();
  async function typePool(type){
    const k=type.toLowerCase();
    if(typePools.has(k))return typePools.get(k);
    const t=await get("type/"+k);
    const list=(t.pokemon||[]).map(x=>{const id=Number(String(x.pokemon.url).match(/\/(\d+)\/?$/)?.[1]||0);return {id,name:x.pokemon.name};})
      .filter(x=>x.id&&x.id<=MAX_ID&&!/-(mega|gmax|totem|primal|eternamax|starter)/.test(x.name));
    typePools.set(k,list);return list;
  }

  /* Distribui os pontos pelo estilo, até +3 por nível no mesmo atributo (regra 18) */
  function distribute(base,level,bonus,build){
    const stats={...base};
    const total=Math.max(0,(level-1)*6)+bonus;
    const w=BUILDS[build].w;
    const keys=Object.keys(w);
    const capPer=Math.max(3,Math.ceil((level-1)*3+bonus*.6));
    const added={hp:0,atk:0,def:0,spa:0,spd:0,spe:0};
    const totW=keys.reduce((a,k)=>a+w[k],0);
    for(let i=0;i<total;i++){
      let r=Math.random()*totW,k=keys[0];
      for(const kk of keys){r-=w[kk];if(r<=0){k=kk;break;}}
      if(added[k]>=capPer){k=keys.find(x=>added[x]<capPer)||k;}
      added[k]++;stats[k]++;
    }
    return {stats,added};
  }

  /* Descrição em português a partir dos dados oficiais do golpe */
  function describe(mv){
    const meta=mv.meta||{};const parts=[];
    const who=/user/.test(mv.target?.name||"")&&!/opponent|selected-pokemon|all-other/.test(mv.target?.name||"")?"do usuário":"do alvo";
    if(mv.priority)parts.push(`Prioridade ${mv.priority>0?"+":""}${mv.priority}.`);
    const sc=(mv.stat_changes||[]);
    if(sc.length){
      const chance=meta.stat_chance&&meta.stat_chance<100?`${meta.stat_chance}% de chance de `:"";
      const groups={};
      sc.forEach(c=>{const k=c.change>0?"up":"down";(groups[k+"|"+Math.abs(c.change)]=groups[k+"|"+Math.abs(c.change)]||[]).push(STAT_PT[STAT_KEY[c.stat.name]||c.stat.name]||c.stat.name);});
      for(const [g,stats] of Object.entries(groups)){
        const [dir,n]=g.split("|");
        const list=stats.length>1?stats.slice(0,-1).join(", ")+" e "+stats[stats.length-1]:stats[0];
        const selfTarget=mv.damage_class?.name!=="status"&&dir==="down"&&/^(close-combat|superpower|overheat|draco-meteor|leaf-storm|psycho-boost|fleur-cannon|hammer-arm|v-create|make-it-rain|armor-cannon|headlong-rush|ice-hammer|spin-out|clanging-scales|dragon-ascent)$/.test(mv.name);
        const tgt=selfTarget?"do usuário":who;
        parts.push(`${chance?chance+(dir==="up"?"aumentar":"reduzir"):(dir==="up"?"Aumenta":"Reduz")} ${stats.length>1?"":"a "}${list} ${tgt} em ${n} estágio${n>1?"s":""}.`);
      }
    }
    const ail=meta.ailment?.name;
    const AIL={paralysis:"Paralisar o alvo (Paralysis)",sleep:"fazer o alvo dormir (Sleep)",freeze:"Congelar o alvo (Freeze)",burn:"Queimar o alvo (Burn)",poison:"causar Poison",confusion:"deixar o alvo Confuso"};
    if(ail&&AIL[ail]){
      const c=meta.ailment_chance||0;
      if(mv.name==="toxic")parts.push("Deixa o alvo com Toxic.");
      else parts.push(c&&c<100?`${c}% de chance de ${AIL[ail]}.`:`${AIL[ail].charAt(0).toUpperCase()+AIL[ail].slice(1)}.`);
    }
    if(meta.flinch_chance)parts.push(`${meta.flinch_chance}% de chance de fazer o alvo hesitar (Flinch).`);
    if(meta.drain>0)parts.push(`O usuário recupera ${meta.drain}% do dano causado.`);
    if(meta.drain<0)parts.push(`O usuário sofre ${-meta.drain}% do dano causado de recuo.`);
    if(meta.healing>0&&mv.damage_class?.name==="status")parts.push(`Recupera ${meta.healing}% do HP.`);
    if(meta.crit_rate>0)parts.push(`Taxa de crítico aumentada (+${meta.crit_rate} estágio).`);
    if(meta.min_hits&&meta.max_hits){parts.push(meta.min_hits===meta.max_hits?`Acerta ${meta.min_hits} vezes.`:`Acerta de ${meta.min_hits} a ${meta.max_hits} vezes.`);}
    if(!parts.length){const en=(mv.effect_entries||[]).find(e=>e.language?.name==="en");if(en)parts.push(String(en.short_effect||"").replace(/\$effect_chance/g,String(mv.effect_chance||"")));}
    return parts.join(" ");
  }

  async function buildMoves(p,level){
    const learn=p.moves.map(m=>{
      const lv=m.version_group_details.filter(v=>v.move_learn_method.name==="level-up").map(v=>v.level_learned_at);
      return {url:m.move.url,name:m.move.name,lv:lv.length?Math.min(...lv):999};
    });
    let pool=learn.filter(m=>m.lv<=level);
    if(pool.length<4)pool=learn.slice().sort((a,b)=>a.lv-b.lv).slice(0,Math.max(8,pool.length));
    pool=pool.sort(()=>Math.random()-.5).slice(0,14);
    const details=(await Promise.all(pool.map(m=>get(m.url).catch(()=>null)))).filter(Boolean);
    const types=p.types.map(t=>t.type.name);
    const dmg=details.filter(d=>d.damage_class?.name!=="status"&&d.power>0)
      .sort((a,b)=>(b.power*(types.includes(b.type.name)?1.5:1))-(a.power*(types.includes(a.type.name)?1.5:1)));
    const status=details.filter(d=>d.damage_class?.name==="status"&&((d.stat_changes||[]).length||d.meta?.ailment?.name!=="none"||d.meta?.healing>0));
    const chosen=[];
    // até 3 de dano de tipos diferentes, com prioridade para o STAB
    for(const d of dmg){if(chosen.length>=3)break;if(!chosen.some(c=>c.type.name===d.type.name))chosen.push(d);}
    if(status.length&&chosen.length<4)chosen.push(pick(status));
    for(const d of dmg){if(chosen.length>=4)break;if(!chosen.includes(d))chosen.push(d);}
    const out=chosen.slice(0,4).map(d=>({name:cap(d.name),type:cap(d.type.name),category:cap(d.damage_class?.name||"status"),
      power:Number(d.power||0),accuracy:d.accuracy==null?null:Math.min(100,d.accuracy),alwaysHits:d.accuracy==null&&d.damage_class?.name!=="status",desc:describe(d).slice(0,400)}));
    if(!out.some(m=>m.power>0))out.unshift({name:"Tackle",type:"Normal",category:"Physical",power:40,accuracy:100,desc:""});
    return out.slice(0,4);
  }

  async function randomSpecies(info,avoid,pool){
    let best=null;
    for(let t=0;t<(pool?12:8);t++){
      const id=pool?pick(pool).id:R(1,MAX_ID);if(avoid.has(id))continue;
      let p;try{p=await get("pokemon/"+id);}catch(e){continue;}
      const bst=p.stats.reduce((a,s)=>a+s.base_stat,0);
      if(bst<=info.bstCap&&(!info.boss||bst>=480)){return p;}
      if(!best||Math.abs(bst-info.bstCap)<Math.abs(best.bst-info.bstCap))best={p,bst};
    }
    if(best)return best.p;
    throw new Error("Não consegui falar com a PokéAPI.");
  }

  const TYPE_ITEM={Normal:"silk-scarf",Fire:"charcoal",Water:"mystic-water",Electric:"magnet",Grass:"miracle-seed",Ice:"never-melt-ice",Fighting:"black-belt",Poison:"poison-barb",
    Ground:"soft-sand",Flying:"sharp-beak",Psychic:"twisted-spoon",Bug:"silver-powder",Rock:"hard-stone",Ghost:"spell-tag",Dragon:"dragon-fang",Dark:"black-glasses",Steel:"metal-coat",Fairy:"fairy-feather"};
  function foeItem(types,build){
    const cat=typeof POKEAPI_ITEM_BY_SLUG!=="undefined"?POKEAPI_ITEM_BY_SLUG:null;if(!cat)return null;
    const opts=[TYPE_ITEM[types[0]],"leftovers","sitrus-berry","focus-sash",build==="tank"?"rocky-helmet":build==="attacker"?"choice-band":build==="special"?"choice-specs":"life-orb","expert-belt"].filter(Boolean);
    const it=cat.get(pick(opts))||cat.get("leftovers");
    return it?{name:it.name,apiName:it.apiName,description:it.description,automation:it.automation||null}:null;
  }
  async function makeFoe(info,avoid,pool){
    const p=await randomSpecies(info,avoid,pool);avoid.add(p.id);
    const base={};p.stats.forEach(s=>{base[STAT_KEY[s.stat.name]]=s.base_stat;});
    const build=pick(Object.keys(BUILDS));
    const {stats}=distribute(base,info.level,info.bonus,build);
    const abilities=p.abilities.filter(a=>!a.is_hidden).map(a=>a.ability.name);
    const ability=cap(pick(abilities.length?abilities:p.abilities.map(a=>a.ability.name)));
    const sp=p.sprites||{};
    const img=sp.other?.["official-artwork"]?.front_default||sp.other?.home?.front_default||sp.front_default||"";
    const moves=await buildMoves(p,info.level);
    const name=cap(p.species?.name||p.name);
    const foe={name,level:info.level,types:p.types.map(t=>cap(t.type.name)),stats,maxHp:stats.hp,ability,abilityText:"",img,moves,build:BUILDS[build].label,dex:p.id,bst:Object.values(base).reduce((a,b)=>a+b,0)};
    // Elites e Chefes/Guardiões seguram um item (lido pelo leitor de itens)
    if(info.elite||info.boss)foe.item=foeItem(foe.types,build);
    // Guardiões das cidades Terastalizam no tipo da área
    if(info.region&&info.boss)foe.gimmick={teraType:(REGIONS[info.region]||{}).type||""};
    return foe;
  }
  async function makeRegionWave(regionId,n,opt={}){
    const info=regionInfo(regionId,n);
    if(opt.min&&info.count<opt.min)info.count=opt.min;
    const pool=await typePool(REGIONS[info.region].type);
    const avoid=new Set(),team=[];
    for(let i=0;i<info.count;i++){
      const f=await makeFoe(info,avoid,pool);
      if(info.boss&&i>0)delete f.gimmick;
      team.push(f);
    }
    return {...info,team};
  }

  async function makeWave(n,refLevel,opt={}){
    const info=waveInfo(n,refLevel);
    if(opt.min&&info.count<opt.min)info.count=opt.min;
    const avoid=new Set();
    const team=[];
    for(let i=0;i<info.count;i++)team.push(await makeFoe(info,avoid));
    return {...info,team};
  }


  /* ---------- Modo Exploração: Pokémon selvagem de um bioma ----------
     Sorteia uma espécie dos tipos da área (sem lendários, até o Base Stat
     máximo da região) e pesa pela raridade: os comuns aparecem bem mais.
     Raridade pelo total de Base Stats: até 330 Comum, até 420 Incomum,
     até 480 Raro, acima disso Muito Raro. */
  const NO_WILD=new Set([144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649,716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,792,800,801,802,807,808,809,888,889,890,891,892,893,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1014,1015,1016,1017,1024,1025]);
  function rarityOf(bst){return bst<=330?"common":bst<=420?"uncommon":bst<=480?"rare":"veryrare";}
  const RAR_W={common:1,uncommon:.6,rare:.28,veryrare:.12};
  async function makeWild({types,level,bstCap=530,bonus=0,prefer=""}){
    const lists=await Promise.all((types||["Normal"]).map(t=>typePool(t).catch(()=>[])));
    let pool=[];const seen=new Set();
    lists.forEach((l,i)=>l.forEach(x=>{if(seen.has(x.id)||NO_WILD.has(x.id)||/-(gmax|mega|totem|cap|cosplay|rock-star|belle|pop-star|phd|libre)/.test(x.name))return;seen.add(x.id);pool.push({...x,w:prefer&&types[i]===prefer?2:1});}));
    if(!pool.length)throw new Error("Sem Pokémon para esta área.");
    const pickW=()=>{const tot=pool.reduce((a,x)=>a+x.w,0);let r=Math.random()*tot;for(const x of pool){r-=x.w;if(r<=0)return x;}return pool[0];};
    let chosen=null,fallback=null;
    for(let t=0;t<14&&!chosen;t++){
      const c=pickW();let p;try{p=await get("pokemon/"+c.id);}catch(e){continue;}
      const bst=p.stats.reduce((a,s)=>a+s.base_stat,0);
      if(bst>bstCap){if(!fallback||bst<fallback.bst)fallback={p,bst};continue;}
      const rar=rarityOf(bst);
      if(Math.random()<=RAR_W[rar]||t>=11)chosen={p,bst,rar};
      else if(!fallback||fallback.bst>bstCap)fallback={p,bst};
    }
    if(!chosen&&fallback)chosen={...fallback,rar:rarityOf(fallback.bst)};
    if(!chosen)throw new Error("Não consegui falar com a PokéAPI.");
    const p=chosen.p;
    const base={};p.stats.forEach(s=>{base[STAT_KEY[s.stat.name]]=s.base_stat;});
    const build=pick(Object.keys(BUILDS));
    const {stats}=distribute(base,level,bonus,build);
    const abilities=p.abilities.filter(a=>!a.is_hidden).map(a=>a.ability.name);
    const ability=cap(pick(abilities.length?abilities:p.abilities.map(a=>a.ability.name)));
    const shiny=Math.random()<1/256;
    const sp=p.sprites||{};
    const img=(shiny?(sp.other?.["official-artwork"]?.front_shiny||sp.other?.home?.front_shiny):null)||sp.other?.["official-artwork"]?.front_default||sp.other?.home?.front_default||sp.front_default||"";
    const sprite=(shiny?sp.front_shiny:sp.front_default)||img;
    const moves=await buildMoves(p,level);
    return {name:cap(p.species?.name||p.name),apiName:p.name,level,types:p.types.map(t=>cap(t.type.name)),stats,maxHp:stats.hp,ability,abilityText:"",img,sprite,moves,
      build:BUILDS[build].label,dex:p.id,bst:chosen.bst,rarity:chosen.rar,shiny};
  }

  /* ---------- IA do oponente ----------
     Estima o dano de cada golpe (Power, STAB, efetividade, Attack/Sp.Atk
     efetivos contra a defesa) e escolhe com um pouco de sorte. Usa golpes
     de status de vez em quando, mais cedo na luta e se ainda não usou. */
  function choose(b,engine,side,rules){
    const s=b.sides[side];
    if(b.phase==="switch"){
      const idx=s.team.findIndex((t,i)=>!t.fainted&&i!==s.active);
      return idx>=0?{kind:"switch",idx}:null;
    }
    const me=engine.activeMon(b,side),foe=side==="p1"?"p2":"p1",F=engine.activeMon(b,foe);
    const ms=engine.activeState(b,side);
    const g=engine.gimmickOptions?engine.gimmickOptions(b,side):null;
    const extra=a=>{
      if(a.kind!=="move")return a;
      if(g?.tera)a.gimmick="tera";
      else if(g?.mega?.length)a.gimmick="mega";
      // de vez em quando esquiva junto do golpe (sem passar do cansaço)
      if(!a.gimmick&&(ms.evadeStreak||0)<2&&Math.random()<.12)a.react=true;
      return a;
    };
    const scored=me.moves.map((m,i)=>{
      const cat=String(m.category||"").toLowerCase();
      if(cat==="status"){
        const fx=m.fx||{};
        let sc=18;
        if(fx.stages?.some(x=>x.who==="self"&&x.n>0)&&(engine.stageTotal(ms,fx.stages[0].stat)>=2))sc=2;
        if(fx.status?.length&&engine.activeState(b,foe).status)sc=1;
        if(fx.heal&&ms.hp>ms.maxHp*.6)sc=1;
        if(fx.heal&&ms.hp<ms.maxHp*.4)sc=40;
        if(fx.protect)sc=4;
        if(fx.weather&&b.weather?.kind===fx.weather.kind)sc=1;
        return {i,sc};
      }
      const mtype=rules.normalizeType(m.type);
      const mult=(F.types||[]).length?rules.typeMultiplier(mtype,(F.types||[]).map(rules.normalizeType)):1;
      const stab=(me.types||[]).map(rules.normalizeType).includes(mtype)?1.5:1;
      const off=engine.effStat(b,side,cat==="physical"?"atk":"spa"),def=engine.effStat(b,foe,cat==="physical"?"def":"spd");
      const acc=m.accuracy==null?1:Math.min(.9,m.accuracy/100);
      const sc=(m.power||60)*stab*mult*(off+40)/(def+40)*acc;
      return {i,sc};
    });
    const total=scored.reduce((a,x)=>a+Math.max(.5,x.sc)**2,0);
    let r=Math.random()*total;
    for(const x of scored){r-=Math.max(.5,x.sc)**2;if(r<=0)return extra({kind:"move",idx:x.i});}
    return extra({kind:"move",idx:0});
  }

  root.hhArenaSurvival={makeWave,waveInfo,distribute,describe,choose,BUILDS,REGIONS,regionInfo,makeRegionWave,typePool,makeWild,rarityOf};
})(window);
