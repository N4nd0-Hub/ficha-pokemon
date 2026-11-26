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

  async function randomSpecies(info,avoid){
    let best=null;
    for(let t=0;t<8;t++){
      const id=R(1,MAX_ID);if(avoid.has(id))continue;
      let p;try{p=await get("pokemon/"+id);}catch(e){continue;}
      const bst=p.stats.reduce((a,s)=>a+s.base_stat,0);
      if(bst<=info.bstCap&&(!info.boss||bst>=480)){return p;}
      if(!best||Math.abs(bst-info.bstCap)<Math.abs(best.bst-info.bstCap))best={p,bst};
    }
    if(best)return best.p;
    throw new Error("Não consegui falar com a PokéAPI.");
  }

  async function makeFoe(info,avoid){
    const p=await randomSpecies(info,avoid);avoid.add(p.id);
    const base={};p.stats.forEach(s=>{base[STAT_KEY[s.stat.name]]=s.base_stat;});
    const build=pick(Object.keys(BUILDS));
    const {stats}=distribute(base,info.level,info.bonus,build);
    const abilities=p.abilities.filter(a=>!a.is_hidden).map(a=>a.ability.name);
    const ability=cap(pick(abilities.length?abilities:p.abilities.map(a=>a.ability.name)));
    const sp=p.sprites||{};
    const img=sp.other?.["official-artwork"]?.front_default||sp.other?.home?.front_default||sp.front_default||"";
    const moves=await buildMoves(p,info.level);
    const name=cap(p.species?.name||p.name);
    return {name,level:info.level,types:p.types.map(t=>cap(t.type.name)),stats,maxHp:stats.hp,ability,abilityText:"",img,moves,build:BUILDS[build].label,dex:p.id,bst:Object.values(base).reduce((a,b)=>a+b,0)};
  }

  async function makeWave(n,refLevel){
    const info=waveInfo(n,refLevel);
    const avoid=new Set();
    const team=[];
    for(let i=0;i<info.count;i++)team.push(await makeFoe(info,avoid));
    return {...info,team};
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
    for(const x of scored){r-=Math.max(.5,x.sc)**2;if(r<=0)return {kind:"move",idx:x.i};}
    return {kind:"move",idx:0};
  }

  root.hhArenaSurvival={makeWave,waveInfo,distribute,describe,choose,BUILDS};
})(window);
