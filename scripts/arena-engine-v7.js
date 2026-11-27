/* ============================================================
   V7 — Arena Online: motor de batalha
   Resolve os turnos de uma batalha 1 contra 1 (até 6 Pokémon por
   lado) com as regras da ficha:
   • ordem: trocas → prioridade → Speed efetiva (estágios, Paralysis,
     clima) → empate no dado;
   • acerto: 1d100 ≤ precisão (teto de 90%, estágios de Precisão/Evasão);
     01–05 é Crítico Natural (dados de Power no máximo, ignora 1 dado de
     defesa); crítico aumentado (Focus Energy, golpes de crítico alto)
     amplia a margem em 5 por estágio e vale 4 por dado de Power;
   • dano: dados de Power + Attack/Sp.Atk efetivos + STAB (+1d6);
     super efetivo +1d6 e metade da defesa (4×: +2d6 e sem defesa);
     resistido perde metade do bônus e −1d6 (¼×: sem bônus e −2d6);
     imune: 0. Defesa efetiva tira dados; nunca abaixo de 1d6;
   • estágios −6…+6: +1 fica até sair de campo, +2 ou mais dura 2 rodadas,
     reduções duram 3 rodadas (regra 9 da ficha);
   • status da ficha: Burn (1d3/turno, físico −1d6), Deep Burn, Poison
     (1d6), Toxic (+1d6 por rodada), Paralysis (Speed −50%, 1d4=1 perde
     a ação), Sleep (1d3 turnos), Freeze (5–6 no 1d6 descongela),
     Confusion (1d3 turnos; 1–3 no 1d6 se fere em 1d6 e perde a ação);
   • clima: Chuva (Water +1d6, Fire −1d6), Sol (o contrário),
     Tempestade de areia e Granizo (1d6 por turno em quem não resiste);
   • efeitos dos textos de golpes e abilities lidos por arena-rules-v7.js;
   • Evasão (regra 3): Reativa (junto do golpe, Precisão inimiga −25) e
     Ativa (gasta a ação, −50). Depois de 3 evasões seguidas cada nova
     custa 1/16 do HP Máximo (com Pressure do rival: depois de 2, 1/8). Crítico
     natural ignora; Freeze e Sleep impedem;
   • gimmicks (uma de cada por time na batalha): Mega Evolução (nova
     forma: tipos, atributos e ability), Terastalização (vira o Tera Type,
     STAB do Tera Type +2d6) e Z-Move (golpe do tipo do Cristal Z com
     Power turbinado que não erra). Mega e Tera não vão no mesmo Pokémon;
   • itens da Bolsa (só nos modos solo): curas, reviver, curar status;
   • item segurado (lido por item-rules-v7.js): Leftovers, Life Orb, Choice,
     itens de tipo (+1 dado da QD), bagas de HP baixo, bagas de resistência,
     Focus Sash, Rocky Helmet, Scope Lens, Air Balloon, Weakness Policy…
   Não depende da tela: recebe as funções de regra por injeção.
   ============================================================ */
(function(root){
  "use strict";
  const RULES=(typeof module!=="undefined"&&module.exports)?require("./arena-rules-v7.js"):root.hhArenaRules;
  const ITEMS=(typeof module!=="undefined"&&module.exports)?require("./item-rules-v7.js"):root.hhItemRules;
  const key=s=>String(s||"").toLowerCase().replace(/[^a-z0-9' -]/g,"").trim();

  function movePriority(move){
    if(move?.fx)return move.fx.priority||0;
    return RULES.parseMove(move).priority||0;
  }

  const STAT_KEYS=["atk","def","spa","spd","spe","acc","eva"];
  const MAJOR=new Set(["psn","tox","brn","dbrn","par","slp","frz"]);

  function create(rules){
    const rand=rules.rand||Math.random;
    const d=(n)=>1+Math.floor(rand()*n);
    const roll=(n,f=6)=>Array.from({length:Math.max(0,n)},()=>d(f));
    const sum=a=>a.reduce((x,y)=>x+y,0);
    const chance=p=>p>=100||d(100)<=p;
    const powerDice=p=>{const t=rules.powerToDice(p);const m=/^(\d+)d6$/.exec(String(t));return m?Number(m[1]):0;};
    const normT=t=>rules.normalizeType(t)||"";
    const other=s=>s==="p1"?"p2":"p1";

    /* ---------- Preparação ---------- */
    function prepMon(m){
      const moves=(m.moves||[]).map(mv=>({...mv,fx:RULES.parseMove(mv)}));
      const g=m.gimmick||{};
      const gimmick={megaForms:(g.megaForms||[]).filter(f=>f&&f.name&&f.stats).slice(0,3),teraType:normT(g.teraType)||"",zType:normT(g.zType)||""};
      // item segurado: o leitor de itens transforma o texto em efeito de batalha
      let item=null;
      if(m.item&&m.item.name&&ITEMS){
        const r=ITEMS.interpret(m.item);item={name:String(m.item.name),...r.battle};
        if(item.species?.length){const who=`${m.name} ${m.species||""}`.toLowerCase();if(!item.species.some(x=>who.includes(String(x).toLowerCase())))item.inactive=true;}
      }
      let types=m.types||[];
      // Memory / Drive / Plate: muda o tipo do golpe exclusivo (e do Pokémon) de quem conhece o golpe
      if(item&&!item.inactive&&item.form){
        const fk=key(item.form.move);const knows=moves.some(mv=>key(mv.name)===fk);
        if(knows){moves.forEach(mv=>{if(key(mv.name)===fk)mv.type=item.form.type;});if(item.form.setTypes)types=[item.form.type];}
      }
      return {...m,types,moves,gimmick,item,origTypes:types.map(normT).filter(Boolean),abil:RULES.parseAbility(m.ability||"",m.abilityText||"")};
    }
    function monState(m){
      const hp=Math.max(1,Number(m.maxHp||m.stats?.hp||1));
      return {hp,maxHp:hp,fainted:false,status:null,slp:0,tox:0,cnf:0,stages:[],persist:{},crit:0,
        flinch:false,enteredTurn:1,lastMove:"",lastType:"",fury:0,swagger:0,nextPhys:0,nextDouble:null,nextHalf:false,
        hurt:{phys:0,spec:0,any:false},used:{},protectStreak:0,abilStages:[],evadeStreak:0,part:false,itemGone:false,lock:null,metro:{k:"",n:0},
        semi:null,charge:null,recharge:false,sub:0,destiny:false,perish:0,cursed:false,seeded:null,taunt:0,encore:null,disable:null,yawn:0,lastIdx:-1,baton:false};
    }
    function newBattle({id,format,p1,p2,damage:dmgMode}){
      const side=(info)=>({id:info.id,name:info.name,active:0,needSwitch:false,pending:null,hazards:{tspikes:0,rocks:false,spikes:0,web:false},field:{},faintedLastTurn:false,
        gim:{mega:null,tera:null,z:false},items:!!info.items,healMult:info.healMult??1,
        team:info.team.map(monState)});
      const b={id,format,turn:1,phase:"choose",winner:null,reason:"",weather:null,trickRoom:0,damage:dmgMode==="matrix"?"matrix":"classic",
        sides:{p1:side(p1),p2:side(p2)},teams:{p1:p1.team.map(prepMon),p2:p2.team.map(prepMon)},events:[]};
      const events=[];
      // as abilities de entrada dos dois primeiros, na ordem de Speed
      const order=["p1","p2"].sort((x,y)=>effSpeed(b,y)-effSpeed(b,x));
      for(const s of order)onEnter(b,s,events,true);
      b.events=events;
      return b;
    }

    const activeMon=(b,s)=>b.teams[s][b.sides[s].active];
    const activeState=(b,s)=>b.sides[s].team[b.sides[s].active];
    const alive=(b,s)=>b.sides[s].team.some(m=>!m.fainted);
    const typesOf=(b,s)=>[...new Set((activeMon(b,s).types||[]).map(normT).filter(Boolean))];
    const abil=(b,s)=>activeMon(b,s).abil;
    const t_=(b,s)=>typesOf(b,s);
    /* item segurado ativo (não consumido e da espécie certa) */
    const itemOf=(b,s)=>{const it=activeMon(b,s).item;return it&&!it.inactive&&!activeState(b,s).itemGone?it:null;};
    function useUpItem(b,s,events,text){
      const it=itemOf(b,s);if(!it)return;
      activeState(b,s).itemGone=true;
      events.push({k:"held",side:s,mon:activeMon(b,s).name,item:it.name,text:text||"foi consumido"});
    }
    /* ainda tem alguém no banco para entrar? */
    const canEject=(b,s)=>b.sides[s].team.some((t,i)=>!t.fainted&&i!==b.sides[s].active)&&!activeState(b,s).fainted;
    const SOUND=/^(boomburst|bug buzz|chatter|clanging scales|clangorous soul|clangorous soulblaze|confide|disarming voice|echoed voice|eerie spell|grass whistle|growl|heal bell|hyper voice|metal sound|noble roar|overdrive|parting shot|perish song|psychic noise|relic song|roar|round|screech|sing|snarl|snore|sparkling aria|supersonic|torch song|alluring voice|uproar)$/;
    const PUNCH=/punch|^(hammer arm|ice hammer|meteor mash|sky uppercut|rage fist|headlong rush|double iron bash|plasma fists|surging strikes|wicked blow)$/;
    const grounded=(b,s)=>!typesOf(b,s).includes("Flying")&&key(abil(b,s).name)!=="levitate"&&!itemOf(b,s)?.groundImmune;
    const isSound=move=>!!move?.fx?.sound||SOUND.test(key(move?.name));
    const isPunch=move=>PUNCH.test(key(move?.name));
    function heldSay(b,s,events,text){const it=itemOf(b,s);if(it)events.push({k:"held",side:s,mon:activeMon(b,s).name,item:it.name,text});}

    /* ---------- Estágios ---------- */
    function stageTotal(ms,stat){
      const v=ms.stages.filter(x=>x.stat===stat).reduce((a,x)=>a+x.n,0)+(ms.persist[stat]||0);
      return Math.max(-6,Math.min(6,v));
    }
    function stageMult(stat,st){
      const acc=stat==="acc"||stat==="eva";
      return st>=0?(acc?(3+st)/3:(2+st)/2):(acc?3/(3-st):2/(2-st));
    }
    function effStat(b,s,stat){
      const m=activeMon(b,s),ms=activeState(b,s);
      let v=Math.floor(Math.max(0,Number(m.stats?.[stat]||0))*stageMult(stat,stageTotal(ms,stat)));
      const it=m.item&&!m.item.inactive&&!ms.itemGone?m.item:null;
      if(it?.statMult?.[stat])v=Math.floor(v*it.statMult[stat]);
      // Protosynthesis / Quark Drive
      if(ms.protoOn&&m.abil?.proto){if(stat===ms.protoStat)v=Math.floor(v*(stat==="spe"?m.abil.proto.speMult:m.abil.proto.mult));if(stat==="spe"&&m.abil.proto.speedFlat)v+=m.abil.proto.speedFlat;}
      // auras do rival (Sword of Ruin e abilities iguais): reduzem o atributo de quem está do outro lado
      {const o=other(s),om=activeMon(b,o);if(om&&!activeState(b,o).fainted)for(const r of om.abil?.ruin||[])if(r.stat===stat&&!(m.abil?.ruin||[]).some(x=>x.stat===stat))v=Math.floor(v*(1-r.pct/100));}
      // Areia: Rock ganha SP.DEF ×1,5 · Neve: Ice ganha DEF ×1,5
      if(b.weather?.kind==="sand"&&stat==="spd"&&typesOf(b,s).includes("Rock"))v=Math.floor(v*1.5);
      if(b.weather?.kind==="snow"&&stat==="def"&&typesOf(b,s).includes("Ice"))v=Math.floor(v*1.5);
      if(stat==="spe"){
        if(ms.status==="par")v=Math.floor(v/2);
        if(b.weather&&(m.abil.weatherSpeed===b.weather.kind||(m.abil.weatherSpeed==="hail"&&b.weather.kind==="snow")))v*=2;
        if(b.sides[s].field.tailwind>0)v*=2;
      }
      return v;
    }
    function effSpeed(b,s){return effStat(b,s,"spe");}
    /* aplica um estágio respeitando limites, imunidades e duração da ficha */
    function addStage(b,s,stat,n,events,{src="",cap=null,rounds,persist=false,fromFoe=false,monIdx,noMirror=false}={}){
      const side=b.sides[s],idx=monIdx??side.active,ms=side.team[idx],mon=b.teams[s][idx];
      if(!n||ms.fainted)return 0;
      if(stat==="all"){let t=0;for(const x of ["atk","def","spa","spd","spe"])t+=addStage(b,s,x,n,events,{src,cap,rounds,persist,fromFoe,monIdx,noMirror});return t;}
      if(n<0&&fromFoe&&idx===side.active&&itemOf(b,s)?.clearAmulet){heldSay(b,s,events,"impediu a redução");return 0;}
      if(n<0&&fromFoe){
        if(mon.abil.immune.statDrop||(ms.swagger>0&&mon.abil.critMode?.immuneDrops?.includes(stat))){
          events.push({k:"stage",side:s,mon:mon.name,stat,n,applied:0,blocked:true,total:stageTotal(ms,stat),src:mon.abil.name});return 0;
        }
      }
      const cur=stageTotal(ms,stat);
      let applied=n>0?Math.min(n,6-cur):Math.max(n,-6-cur);
      if(cap!=null&&n>0)applied=Math.max(0,Math.min(applied,cap-cur));
      if(applied===0){events.push({k:"stage",side:s,mon:mon.name,stat,n,applied:0,total:cur,src});return 0;}
      if(persist)ms.persist[stat]=(ms.persist[stat]||0)+applied;
      else ms.stages.push({stat,n:applied,rounds:rounds!==undefined?rounds:(applied<0?3:applied>=2?2:null)});
      if(idx===side.active)events.push({k:"stage",side:s,mon:mon.name,stat,n,applied,total:stageTotal(ms,stat),src});
      if(idx===side.active){
        // Eject Pack: estágio reduzido → sai de campo no fim do turno
        if(applied<0&&itemOf(b,s)?.ejectPack&&canEject(b,s)){useUpItem(b,s,events,"tirou o Pokémon de campo");ms.eject=true;}
        // Mirror Herb do outro lado: copia o aumento
        const o=other(s);
        if(applied>0&&!noMirror&&!activeState(b,o).fainted&&itemOf(b,o)?.mirrorHerb){useUpItem(b,o,events,"copiou o aumento");addStage(b,o,stat,applied,events,{src:"Mirror Herb",noMirror:true});}
      }
      return applied;
    }

    /* ---------- Status ---------- */
    function canStatus(b,s,st){
      const ms=activeState(b,s),mon=activeMon(b,s),types=typesOf(b,s);
      if(ms.fainted)return "fainted";
      if(mon.abil.immune.status.has(st))return "ability";
      if((st==="brn"||st==="dbrn")&&types.includes("Fire"))return "type";
      if(st==="par"&&types.includes("Electric"))return "type";
      if((st==="psn"||st==="tox")&&(types.includes("Poison")||types.includes("Steel")))return "type";
      if(st==="frz"&&types.includes("Ice"))return "type";
      if(st==="cnf")return ms.cnf>0?"already":"";
      if(ms.status)return "already";
      return "";
    }
    function giveStatus(b,s,st,events,src){
      const why=canStatus(b,s,st);const ms=activeState(b,s),mon=activeMon(b,s);
      if(why){if(why==="ability"||why==="type")events.push({k:"status",side:s,mon:mon.name,st,fail:why,src:why==="ability"?mon.abil.name:""});return false;}
      if(st==="cnf")ms.cnf=d(3);
      else{ms.status=st;if(st==="slp")ms.slp=d(3);if(st==="tox")ms.tox=1;}
      events.push({k:"status",side:s,mon:mon.name,st,src});
      // bagas que curam status na hora (Lum, Cheri…) e Mental Herb (confusão)
      const it=itemOf(b,s);
      if(st==="cnf"&&it?.mentalHerb){ms.cnf=0;useUpItem(b,s,events,"curou a confusão");events.push({k:"statusEnd",side:s,mon:mon.name,st});return true;}
      if(it?.cure&&(it.cure==="any"||it.cure.includes(st))){
        if(st==="cnf")ms.cnf=0;else{ms.status=null;ms.slp=0;ms.tox=0;}
        useUpItem(b,s,events,`curou ${st==="cnf"?"a confusão":"o status"}`);events.push({k:"statusEnd",side:s,mon:mon.name,st});
      }
      return true;
    }

    /* ---------- Entrada em campo ---------- */
    function setWeather(b,kind,turns,events,src,s){
      if(s&&itemOf(b,s)?.weatherTurns)turns=Math.max(turns,itemOf(b,s).weatherTurns);
      if(b.weather&&b.weather.kind===kind){b.weather.turns=Math.max(b.weather.turns,turns);}
      else b.weather={kind,turns};
      events.push({k:"weather",kind,turns,src});
      for(const x of ["p1","p2"])if(b.sides[x].active!=null)paradoxCheck(b,x,events);
    }
    function onEnter(b,s,events,start){
      const side=b.sides[s],ms=activeState(b,s),mon=activeMon(b,s),A=mon.abil,foe=other(s);
      ms.part=true;
      ms.enteredTurn=start?1:(b.phase==="switch"?b.turn:b.turn+1);
      // Toxic Spikes
      if(side.hazards.tspikes>0&&itemOf(b,s)?.boots)heldSay(b,s,events,"protegeu dos espinhos");
      else if(side.hazards.tspikes>0){
        const t=typesOf(b,s);
        if(t.includes("Poison")){side.hazards.tspikes=0;events.push({k:"hazard",side:s,kind:"tspikes",layers:0,cleared:true,mon:mon.name});}
        else if(!t.includes("Flying")&&!t.includes("Steel"))giveStatus(b,s,side.hazards.tspikes>=2?"tox":"psn",events,"Toxic Spikes");
      }
      // Stealth Rock, Spikes e Sticky Web
      if(!itemOf(b,s)?.boots){
        const H=side.hazards;
        if(H.rocks){const m=rules.typeMultiplier("Rock",typesOf(b,s));const dmg=Math.max(1,Math.floor(ms.maxHp*0.125*m));events.push({k:"info",text:`Pedras pontiagudas acertaram ${mon.name}!`});hurt(b,s,dmg,events,"Stealth Rock");}
        if(!ms.fainted&&grounded(b,s)){
          if(H.spikes>0){const f=[0,1/8,1/6,1/4][Math.min(3,H.spikes)];events.push({k:"info",text:`${mon.name} pisou nos Spikes!`});hurt(b,s,Math.max(1,Math.floor(ms.maxHp*f)),events,"Spikes");}
          if(!ms.fainted&&H.web){events.push({k:"info",text:`${mon.name} ficou preso na Sticky Web!`});addStage(b,s,"spe",-1,events,{src:"Sticky Web",fromFoe:true});}
        }
      }
      if(side.healWish&&!ms.fainted){side.healWish=false;ms.status=null;ms.slp=0;ms.tox=0;events.push({k:"info",text:`O desejo de cura envolveu ${mon.name}!`});heal(b,s,ms.maxHp,events,"Healing Wish");}
      // Campo Real do outro lado: −1 Speed em quem entra
      if(!start&&b.sides[foe].field.royal>0)addStage(b,s,"spe",-1,events,{src:"Campo Real",fromFoe:true});
      const shown=[];
      const say=()=>{if(!shown.length){shown.push(1);events.push({k:"ability",side:s,mon:mon.name,name:A.name});}};
      if(A.onEnter.weather){say();setWeather(b,A.onEnter.weather.kind,A.onEnter.weather.turns,events,A.name,s);}
      if(A.onEnter.field?.kind==="royal"){say();side.field.royal=A.onEnter.field.turns;side.field.royalOwner=side.active;events.push({k:"field",side:s,kind:"royal",turns:side.field.royal});
        if(!activeState(b,foe).fainted)addStage(b,foe,"spe",-1,events,{src:"Campo Real",fromFoe:true});}
      for(const st of A.onEnter.stages){
        say();
        if(st.who==="self")addStage(b,s,st.stat,st.n,events,{src:A.name,cap:st.cap});
        else if(st.who==="foe"){
          const F=abil(b,foe);
          if(F.immune.intimidate&&st.n<0){events.push({k:"stage",side:foe,mon:activeMon(b,foe).name,stat:st.stat,n:st.n,applied:0,blocked:true,total:stageTotal(activeState(b,foe),st.stat),src:F.name});}
          else if(!activeState(b,foe).fainted){addStage(b,foe,st.stat,st.n,events,{src:A.name,fromFoe:true,rounds:st.rounds});
            if(st.n<0&&key(A.name)==="intimidate"&&itemOf(b,foe)?.adrenaline){useUpItem(b,foe,events,"reagiu ao Intimidate");addStage(b,foe,"spe",itemOf(b,foe)?.adrenaline||1,events,{src:"Adrenaline Orb"});}}
        }else if(st.who==="team"){
          side.team.forEach((t,i)=>{if(!t.fainted)addStage(b,s,st.stat,st.n,events,{src:A.name,cap:st.cap??3,persist:true,monIdx:i});});
          events.push({k:"info",text:`${mon.name} inspirou o time: +${st.n} de ${RULES.STAT_LABEL[st.stat]} para todos (máx. +${st.cap??3}).`});
        }
      }
      if(itemOf(b,s)?.booster&&A.proto&&!(A.proto.weather&&b.weather?.kind===A.proto.weather)){
        useUpItem(b,s,events,`ativou ${A.name}`);ms.boosterOn=true;
      }
      paradoxCheck(b,s,events);
      if(A.ruin?.length){const L={atk:"Attack",def:"Defense",spa:"Sp.Atk",spd:"Sp.Def",spe:"Speed"};events.push({k:"ability",side:s,mon:mon.name,name:A.name});events.push({k:"info",text:`${A.name}: ${A.ruin.map(r=>`${L[r.stat]} −${r.pct}%`).join(", ")} em todos os outros Pokémon.`});}
      if(A.onEnter.foeAccFirstTurn&&!activeState(b,foe).fainted){say();addStage(b,foe,"acc",A.onEnter.foeAccFirstTurn,events,{src:A.name,fromFoe:true,rounds:1});}
    }
    /* ---------- Protosynthesis e formas por gatilho ---------- */
    const PSTAT={atk:"Attack",def:"Defense",spa:"Sp.Atk",spd:"Sp.Def",spe:"Speed"};
    function bestStat(mon){return ["atk","def","spa","spd","spe"].reduce((x,y)=>Number(mon.stats?.[y]||0)>Number(mon.stats?.[x]||0)?y:x,"atk");}
    function paradoxCheck(b,s,events){
      const ms=activeState(b,s);if(!ms||ms.fainted)return;
      const mon=activeMon(b,s),P=mon.abil?.proto;
      if(P){
        const on=!!((P.weather&&b.weather?.kind===P.weather)||ms.boosterOn);
        if(on&&!ms.protoOn){
          ms.protoOn=true;ms.protoStat=bestStat(mon);
          events.push({k:"ability",side:s,mon:mon.name,name:mon.abil.name});
          const extra=[P.boost?`+${P.boost.dice} QD em golpes ${P.boost.cat==="physical"?"físicos ":P.boost.cat==="special"?"especiais ":""}${(P.boost.types||[]).join("/")}`:"",P.speedFlat?`+${P.speedFlat} de Speed`:""].filter(Boolean);
          events.push({k:"info",text:`${mon.abil.name} despertou: ${PSTAT[ms.protoStat]} ×${ms.protoStat==="spe"?P.speMult:P.mult}${extra.length?" · "+extra.join(" · "):""}.`});
          if(P.firstGuard&&!ms.protoGuardUsed){ms.protoGuardUsed=true;ms.protoGuardTurn=b.turn;events.push({k:"info",text:`${mon.name} se protege: −${P.firstGuard.dice} QD no dano ${P.firstGuard.cat==="special"?"especial":"físico"} recebido neste turno.`});}
        }else if(!on&&ms.protoOn){ms.protoOn=false;events.push({k:"info",text:`${mon.abil.name} de ${mon.name} se apagou.`});}
      }
      formCheck(b,s,events);
    }
    /* Formas que mudam sozinhas (arte/tipos) por gatilho: clima, Booster Energy, HP baixo ou a própria Protosynthesis */
    function formCheck(b,s,events){
      const side=b.sides[s],idx=side.active,ms=activeState(b,s);if(!ms||ms.fainted)return;
      const base=ms.formOn?ms.formBase:activeMon(b,s),tf=base?.trigForm;if(!tf)return;
      const T=tf.trigger||{};
      const on=!!(((T.weather||[]).includes(b.weather?.kind))||(ms.boosterOn&&(T.items||[]).some(i=>/booster/i.test(i)))||(T.ability&&ms.protoOn)||(T.hpBelow&&ms.hp/ms.maxHp<=T.hpBelow));
      if(on&&!ms.formOn){
        const types=(tf.types||[]).map(normT).filter(Boolean);
        const next={...base,name:tf.name||base.name,img:tf.img||base.img,types:types.length?types:base.types,origTypes:types.length?types:base.origTypes,stats:tf.stats?{...base.stats,...tf.stats}:base.stats,baseName:base.name};
        ms.formBase=base;ms.formOn=true;b.teams[s][idx]=next;
        events.push({k:"gimmick",kind:"form",side:s,idx,mon:base.name,to:next.name,img:next.img,types:next.types,ability:next.ability,hp:ms.hp,maxHp:ms.maxHp});
      }else if(!on&&ms.formOn){
        const back=ms.formBase;ms.formOn=false;ms.formBase=null;b.teams[s][idx]=back;
        events.push({k:"gimmick",kind:"unform",side:s,idx,mon:tf.name||back.name,to:back.name,img:back.img,types:back.types,ability:back.ability,hp:ms.hp,maxHp:ms.maxHp});
      }
    }
    function resetVolatile(ms){
      ms.stages=[];ms.cnf=0;ms.crit=0;ms.flinch=false;ms.eject=false;ms.nextAcc=0;ms.nextFirst=false;ms.fury=0;ms.swagger=0;ms.protectStreak=0;ms.abilStages=[];ms.nextDouble=null;ms.nextHalf=false;ms.evadeStreak=0;ms.lock=null;ms.metro={k:"",n:0};
      ms.boosterOn=false;ms.protoOn=false;ms.protoGuardTurn=0;
      ms.semi=null;ms.charge=null;ms.recharge=false;ms.sub=0;ms.destiny=false;ms.perish=0;ms.cursed=false;ms.seeded=null;ms.taunt=0;ms.encore=null;ms.disable=null;ms.yawn=0;ms.lastIdx=-1;ms.baton=false;
      if(ms.status==="tox")ms.tox=1;
    }

    /* ---------- Ações ---------- */
    function canAct(b,s){
      const side=b.sides[s];
      if(b.phase==="end")return false;
      if(b.phase==="switch")return side.needSwitch&&!side.pending;
      return !side.pending;
    }
    function submit(b,s,action){
      if(!canAct(b,s))return false;
      const side=b.sides[s];
      if(action.kind==="forfeit"){side.pending=action;return true;}
      if(action.kind==="switch"){
        const t=side.team[action.idx];
        if(!t||t.fainted||action.idx===side.active)return false;
        action={kind:"switch",idx:action.idx};
      }else if(action.kind==="move"){
        if(b.phase==="switch")return false;
        const mon=activeMon(b,s);if(!mon?.moves?.[action.idx]&&action.idx!==-1)return false;
        const lk=activeState(b,s).lock;if(lk!=null&&itemOf(b,s)?.choiceLock&&action.idx!==lk)return false;
        const g=action.gimmick&&gimmickOptions(b,s);
        const okG=!action.gimmick||(action.gimmick==="mega"&&g.mega.length&&g.mega[Number(action.form)||0])||(action.gimmick==="tera"&&g.tera)
          ||(action.gimmick==="z"&&g.z&&zMoveOk(mon,mon.moves[action.idx],g.z));
        if(!okG)return false;
        action={kind:"move",idx:action.idx,react:!!action.react,gimmick:action.gimmick||"",form:Number(action.form)||0};
      }else if(action.kind==="evade"){
        if(b.phase==="switch")return false;
        action={kind:"evade"};
      }else if(action.kind==="item"){
        if(b.phase==="switch"||!side.items)return false;
        const t=side.team[action.target];const e=action.effect||{};
        if(!t||!e.kind)return false;
        const revive=/^revive/.test(e.kind);
        if(revive!==!!t.fainted)return false;
        action={kind:"item",target:action.target,name:String(action.name||"Item").slice(0,40),slug:String(action.slug||""),effect:{...e}};
      }else return false;
      side.pending=action;
      if(b.phase==="switch")return ["p1","p2"].every(x=>!b.sides[x].needSwitch||b.sides[x].pending);
      return !!(b.sides.p1.pending&&b.sides.p2.pending);
    }

    /* ---------- Gimmicks ---------- */
    /* O que o Pokémon ativo ainda pode usar nesta batalha */
    function gimmickOptions(b,s){
      const side=b.sides[s],mon=activeMon(b,s),g=mon.gimmick||{},idx=side.active;
      return {
        mega:side.gim.mega==null&&side.gim.tera!==idx&&!mon.mega?(g.megaForms||[]):[],
        tera:side.gim.tera==null&&side.gim.mega!==idx&&!mon.mega&&g.teraType?g.teraType:"",
        z:!side.gim.z&&g.zType?g.zType:""
      };
    }
    function zMoveOk(mon,move,zType){
      return !!move&&String(move.category||"").toLowerCase()!=="status"&&normT(move.type)===zType;
    }
    /* Power do Z-Move (tabela oficial) */
    function zPower(p){
      p=Number(p||0);
      return p<=55?100:p<=65?120:p<=75?140:p<=85?160:p<=95?175:p<=100?180:p<=110?185:p<=125?190:p<=130?195:200;
    }
    function megaEvolve(b,s,formIdx,events){
      const side=b.sides[s],idx=side.active,mon=activeMon(b,s),ms=activeState(b,s);
      const f=(mon.gimmick.megaForms||[])[formIdx]||mon.gimmick.megaForms[0];if(!f)return;
      const from=mon.name;
      const types=(f.types||[]).map(normT).filter(Boolean);
      const next={...mon,name:f.name,types:types.length?types:mon.types,origTypes:types.length?types:mon.origTypes,stats:{...mon.stats,...f.stats},
        ability:f.ability||mon.ability,abilityText:f.abilityText||(f.ability?"":mon.abilityText),img:f.img||mon.img,mega:true,baseName:from};
      next.abil=RULES.parseAbility(next.ability||"",next.abilityText||"");
      const newMax=Math.max(1,Number(f.maxHp||f.stats?.hp||ms.maxHp));
      if(newMax>ms.maxHp){ms.hp+=newMax-ms.maxHp;ms.maxHp=newMax;}
      b.teams[s][idx]=next;side.gim.mega=idx;
      events.push({k:"gimmick",kind:"mega",side:s,idx,mon:from,to:next.name,img:next.img,types:next.types,ability:next.ability,hp:ms.hp,maxHp:ms.maxHp});
      const A=next.abil;
      if(A.onEnter.weather){events.push({k:"ability",side:s,mon:next.name,name:A.name});setWeather(b,A.onEnter.weather.kind,A.onEnter.weather.turns,events,A.name);}
    }
    function terastallize(b,s,events){
      const side=b.sides[s],idx=side.active,mon=activeMon(b,s);
      const t=mon.gimmick.teraType;if(!t)return;
      b.teams[s][idx]={...mon,types:[t],tera:t};side.gim.tera=idx;
      events.push({k:"gimmick",kind:"tera",side:s,idx,mon:mon.name,type:t,types:[t]});
    }
    /* STAB: tipo atual ou original (+1d6); Tera Type +2d6 */
    function stabDice(b,s,mtype){
      const mon=activeMon(b,s);
      if(mon.tera&&mon.tera===mtype)return 2;
      return typesOf(b,s).includes(mtype)||(mon.origTypes||[]).includes(mtype)?1:0;
    }

    /* ---------- Itens da Bolsa ---------- */
    const COND_CODE={"Envenenado":["psn","tox"],"Queimado":["brn","dbrn"],"Congelado":["frz"],"Dormindo":["slp"],"Paralisado":["par"],"Confuso":["cnf"]};
    function useItem(b,s,a,events){
      const side=b.sides[s],ms=side.team[a.target],mon=b.teams[s][a.target],e=a.effect;
      if(!ms)return;
      const ev={k:"item",side:s,idx:a.target,mon:mon.name,item:a.name,slug:a.slug};
      const isActive=a.target===side.active;
      const healTo=n=>{const before=ms.hp;ms.hp=Math.min(ms.maxHp,ms.hp+Math.max(0,Math.floor(n)));ev.healed=ms.hp-before;};
      const cure=(codes)=>{let did=false;if(ms.status&&(!codes||codes.includes(ms.status))){ms.status=null;ms.slp=0;ms.tox=0;did=true;}if((!codes||codes.includes("cnf"))&&ms.cnf>0){ms.cnf=0;did=true;}if(did)ev.cured=true;};
      if(e.kind==="reviveFraction"||e.kind==="reviveFull"){
        if(!ms.fainted){ev.fail=true;events.push(ev);return;}
        ms.fainted=false;ms.status=null;ms.hp=e.kind==="reviveFull"?ms.maxHp:Math.max(1,Math.floor(ms.maxHp*(e.num||1)/(e.den||2)));ev.revived=true;
      }else if(ms.fainted){ev.fail=true;events.push(ev);return;}
      else if(e.kind==="healFlat")healTo(e.amount||20);
      else if(e.kind==="healFraction")healTo(ms.maxHp*(e.num||1)/(e.den||4));
      else if(e.kind==="healFull")healTo(ms.maxHp);
      else if(e.kind==="fullRestore"){healTo(ms.maxHp);cure(null);}
      else if(e.kind==="cureCondition")cure(COND_CODE[e.condition]||null);
      else if(e.kind==="cureAll")cure(null);
      else if(e.kind==="stage"&&isActive){const st=e.stat==="accuracy"?"acc":e.stat==="evasion"?"eva":e.stat;events.push(ev);addStage(b,s,st,Number(e.amount||1),events,{src:a.name});return;}
      else{ev.fail=true;}
      ev.hp=ms.hp;ev.maxHp=ms.maxHp;ev.status=ms.status||null;ev.cnf=ms.cnf>0;
      events.push(ev);
    }

    /* ---------- Evasão (regra 3) ---------- */
    function declareEvade(b,s,kind,events,ctx){
      const side=b.sides[s],ms=activeState(b,s),mon=activeMon(b,s);
      if(ms.fainted)return;
      if(ms.status==="frz"||ms.status==="slp"){events.push({k:"evade",side:s,mon:mon.name,kind,fail:true,why:ms.status});ms.evadeStreak=0;return;}
      const pressure=key(abil(b,other(s)).name)==="pressure";
      const limit=pressure?2:3;
      const tired=ms.evadeStreak>=limit;
      ms.evadeStreak++;ms.evadedThisTurn=true;
      const pen=kind==="active"?50:25;
      ctx.evade[s]=Math.max(ctx.evade[s]||0,pen);
      events.push({k:"evade",side:s,mon:mon.name,kind,pen,streak:ms.evadeStreak,limit,tired});
      if(tired)hurt(b,s,Math.max(1,Math.floor(ms.maxHp*(pressure?2:1)/16)),events,"evade");
    }

    /* ---------- Dano ---------- */
    function typeMult(b,atkSide,mtype){
      const defTypes=typesOf(b,other(atkSide));
      let mult=defTypes.length?rules.typeMultiplier(mtype,defTypes):1;
      if(mult===0&&itemOf(b,other(atkSide))?.ringTarget)mult=defTypes.reduce((x,t)=>{const v=rules.typeMultiplier(mtype,[t]);return x*(v===0?1:v);},1);
      if(abil(b,other(atkSide)).immune.types.has(mtype))mult=0;
      if(mtype==="Ground"&&itemOf(b,other(atkSide))?.groundImmune)mult=0;
      if(abil(b,atkSide).tinted&&mult>0&&mult<1)mult=Math.min(1,mult*2);
      return mult;
    }
    function damage(b,atkSide,move,ev,{crit,critKind,power}){
      const defSide=other(atkSide);
      const A=activeMon(b,atkSide),D=activeMon(b,defSide),aS=activeState(b,atkSide),dS=activeState(b,defSide);
      const cat=String(move.category||"").toLowerCase(),physical=cat==="physical";
      const atkTypes=typesOf(b,atkSide);
      const mtype=normT(move.type)||"Normal";
      const mult=typeMult(b,atkSide,mtype);
      ev.mult=mult;
      if(mult===0){ev.amount=0;ev.immune=true;return 0;}
      let base=powerDice(power);
      const bonusStat=rules.statDice(effStat(b,atkSide,physical?"atk":"spa"));
      const sd=stabDice(b,atkSide,mtype),stab=sd>0;
      let bonusDice=bonusStat.dice+sd,fixed=bonusStat.fixed;
      ev.stab=stab;if(sd>1)ev.tera=true;
      let add=0,pen=0;
      if(mult>=4)add=2;else if(mult>=2)add=1;
      else if(mult<=.25){bonusDice=0;fixed=0;pen=2;}
      else if(mult<=.5){bonusDice=Math.floor(bonusDice/2);pen=1;}
      const ex=extraMods(b,atkSide,move,mtype,physical);add+=ex.add;pen+=ex.pen;const notes=ex.notes;
      const def=rules.statDice(effStat(b,defSide,physical?"def":"spd"));
      let defDice=def.dice,defFixed=def.fixed;
      if(mult>=4){defDice=0;defFixed=0;}else if(mult>=2){defDice=Math.floor(defDice/2);defFixed=Math.floor(defFixed/2);}
      let critFixed=0;
      if(crit){critFixed=base*(critKind==="natural"?6:4);base=0;if(critKind==="natural")defDice=Math.max(0,defDice-1);}
      let dice=Math.max(0,base+bonusDice+add-pen-defDice);
      if(dice<=0&&!critFixed)dice=1;
      const rolls=roll(dice);
      let total=Math.max(1,sum(rolls)+fixed+critFixed-defFixed);
      total=finalMods(b,atkSide,cat,physical,total+(ex.flat||0),notes);
      ev.dice=(ev.dice||0)+dice;ev.rolls=[...(ev.rolls||[]),...rolls];ev.fixed=(ev.fixed||0)+fixed+critFixed-defFixed;
      if(notes.length)ev.notes=[...new Set([...(ev.notes||[]),...notes])];
      return total;
    }
    /* Bônus e penalidades em d6 que valem nos dois modos de dano */
    function extraMods(b,atkSide,move,mtype,physical){
      const defSide=other(atkSide);
      const A=activeMon(b,atkSide),D=activeMon(b,defSide),aS=activeState(b,atkSide),dS=activeState(b,defSide);
      let add=0,pen=0;const notes=[];
      // bônus de abilities/itens: no sistema de QD viram dados da QD do golpe
      let qa=0,qp=0;const q=(n,label)=>{if(n>0)qa+=n;else qp-=n;notes.push(label);};
      // clima
      const umb=itemOf(b,atkSide)?.umbrella||itemOf(b,defSide)?.umbrella;
      if(b.weather&&umb&&(b.weather.kind==="rain"||b.weather.kind==="sun"))notes.push("Utility Umbrella: sem clima");
      else if(b.weather){
        const w=b.weather.kind;
        if((w==="rain"&&mtype==="Water")||(w==="sun"&&mtype==="Fire")){add+=1;notes.push(RULES.WEATHER_LABEL[w]+" +1d6");}
        if((w==="rain"&&mtype==="Fire")||(w==="sun"&&mtype==="Water")){pen+=1;notes.push(RULES.WEATHER_LABEL[w]+" −1d6");}
        for(const wb of A.abil.weatherBoost)if((wb.weather===w||(wb.weather==="hail"&&w==="snow"))&&(!wb.types?.length||wb.types.includes(mtype)))q(wb.dice,`${A.abil.name} +${wb.dice} QD`);
      }
      // abilities e efeitos do atacante
      if(A.abil.pinch===mtype&&aS.hp*3<=aS.maxHp)q(1,`${A.abil.name} +1 QD`);
      if(A.abil.royal&&b.sides[atkSide].field.royal>0&&(mtype==="Bug"||mtype==="Fairy"))q(1,"Campo Real +1 QD");
      if(physical&&aS.nextPhys){q(aS.nextPhys,`${A.abil.name} +${aS.nextPhys} QD`);aS.nextPhys=0;}
      if(physical&&aS.swagger>0)q(A.abil.critMode?.physDice||1,`Swagger Mode +${A.abil.critMode?.physDice||1} QD`);
      if(physical&&A.abil.aerial&&aS.lastType==="Flying")q(1,`${A.abil.name} +1 QD`);
      if(physical&&(aS.status==="brn")&&!A.abil.guts){pen+=1;notes.push("Burn −1d6");}
      if(physical&&A.abil.guts&&aS.status)q(1,"Guts +1 QD");
      // abilities do defensor
      {const P=A.abil?.proto;if(aS.protoOn&&P?.boost&&(!P.boost.cat||(P.boost.cat==="physical")===physical)&&(!P.boost.types?.length||P.boost.types.includes(mtype)))q(P.boost.dice,`${A.abil.name} +${P.boost.dice} QD`);}
      {const P=D.abil?.proto;if(P?.firstGuard&&dS.protoGuardTurn===b.turn&&(!P.firstGuard.cat||(P.firstGuard.cat==="physical")===physical))q(-P.firstGuard.dice,`${D.abil.name} −${P.firstGuard.dice} QD`);}
      for(const t of D.abil.dmgTaken)if((!t.type||t.type===mtype)&&(!t.fullHp||dS.hp>=dS.maxHp))q(t.dice,`${D.abil.name} ${t.dice} QD`);
      // item segurado do atacante
      let flat=0;const it=itemOf(b,atkSide);
      if(it){
        if(it.typeQD&&it.typeQD.types.includes(mtype))q(it.typeQD.n,`${it.name} +${it.typeQD.n} QD`);
        if(it.allQD)q(it.allQD,`${it.name} +${it.allQD} QD`);
        if(it.seQD&&typeMult(b,atkSide,mtype)>=2)q(it.seQD,`${it.name} +${it.seQD} QD`);
        if(it.catFlat&&it.catFlat.cat===(physical?"physical":"special")){flat+=it.catFlat.n;notes.push(`${it.name} +${it.catFlat.n}`);}
        if(it.punch&&isPunch(move))q(it.punch,`${it.name} +${it.punch} QD`);
        if(it.metronome&&aS.metro.n>1){const n=Math.min(3,aS.metro.n-1);q(n,`${it.name} +${n} QD`);}
      }
      // no dano da ficha (clássico) o dado é sempre d6
      if(b.damage!=="matrix"){add+=qa;pen+=qp;qa=0;qp=0;}
      return {add,pen,notes,qa,qp,flat};
    }
    function finalMods(b,atkSide,cat,physical,total,notes){
      const aS=activeState(b,atkSide),dS=activeState(b,other(atkSide));
      if(physical&&aS.status==="dbrn"){total=Math.max(1,Math.floor(total/2));notes.push("Deep Burn ½");}
      if(aS.nextDouble&&(aS.nextDouble==="any"||aS.nextDouble===cat)){total*=2;notes.push("dano dobrado");aS.nextDouble=null;}
      if(dS.nextHalf){total=Math.max(1,Math.floor(total/2));notes.push("defesa reforçada ½");dS.nextHalf=false;}
      const F=b.sides[other(atkSide)].field;
      if(physical&&(F.reflect>0||F.veil>0)){total=Math.max(1,Math.floor(total/2));notes.push(F.veil>0?"Aurora Veil ½":"Reflect ½");}
      else if(!physical&&(F.light>0||F.veil>0)){total=Math.max(1,Math.floor(total/2));notes.push(F.veil>0?"Aurora Veil ½":"Light Screen ½");}
      return total;
    }

    /* ---------- Dano experimental (Damage Matrix v0.2 da ficha) ----------
       Poder efetivo (Technician, Tough Claws, Mega Launcher, vários acertos)
       define quantos dados; a Qualidade do ATK/SP.ATK atual menos a da
       DEF/SP.DEF atual do alvo define o dado (QD d4…d20). Super efetivo
       +1 dado e QD +1 degrau; resistido −1 dado e QD −1; imune 0.
       STAB +1d6 (Adaptability 1+⌈dados/2⌉), + nível÷5 fixo. Crítico
       natural: dados da QD no máximo; crítico aumentado: rola 2 vezes cada
       dado da QD e fica com o maior. Bônus/penalidades em d6 (clima,
       Burn, abilities) somam ou tiram d6 extras. */
    const QDS=["d4","d6","d8","d10","d12","d12+d4","d12+d6","d20"];
    const QD_SIDES={d4:[4],d6:[6],d8:[8],d10:[10],d12:[12],"d12+d4":[12,4],"d12+d6":[12,6],d20:[20]};
    const quality=v=>v<=49?0:v<=75?1:v<=100?2:v<=125?3:v<=150?4:v<=175?5:v<=200?6:v<=225?7:8;
    const pdice=p=>p<=0?0:p<=20?1:p<=40?2:p<=60?3:p<=80?4:p<=100?5:6;
    function matrixDamage(b,atkSide,move,ev,{crit,critKind,power,hits}){
      const defSide=other(atkSide);
      const A=activeMon(b,atkSide);
      const cat=String(move.category||"").toLowerCase(),physical=cat==="physical";
      const mtype=normT(move.type)||"Normal";
      const mult=typeMult(b,atkSide,mtype);
      ev.mult=mult;ev.mode="matrix";
      if(mult===0){ev.amount=0;ev.immune=true;return 0;}
      const ab=key(A.abil.name);
      let bp=power;
      if(ab==="technician"&&bp<=60)bp=Math.floor(bp*1.5);
      if(ab==="tough claws"&&physical)bp=Math.floor(bp*1.3);
      if(ab==="mega launcher"&&/(pulse|aura)/i.test(move.name||""))bp=Math.floor(bp*1.5);
      const bpDice=pdice(bp*hits);
      const offQ=quality(effStat(b,atkSide,physical?"atk":"spa")),defQ=quality(effStat(b,defSide,physical?"def":"spd"));
      const gap=offQ-defQ;
      let qi=gap<0?0:Math.min(7,gap+1),count=bpDice;
      if(mult>1){count++;qi=Math.min(7,qi+1);}
      else if(mult<1){count=Math.max(1,count-1);qi=Math.max(0,qi-1);}
      const qd=QDS[qi];
      const sd=stabDice(b,atkSide,mtype);
      let stab=sd?(ab==="adaptability"?1+Math.ceil(bpDice/2):1)+(sd>1?1:0):0;if(sd>1)ev.tera=true;
      const ex=extraMods(b,atkSide,move,mtype,physical);
      // dados da QD vindos de abilities/itens (+1 dado da QD = mais um dado igual aos do golpe)
      count=Math.max(1,count+(ex.qa||0)-(ex.qp||0));
      let extra=stab+ex.add-ex.pen;
      if(extra<0){count=Math.max(1,count+extra);extra=0;}
      const level=Math.floor(Number(A.level||1)/5);
      const rolls=[];let total=0;
      for(const sides of QD_SIDES[qd])for(let i=0;i<count;i++){
        let v=critKind==="natural"&&crit?sides:d(sides);
        if(crit&&critKind==="boosted")v=Math.max(v,d(sides));
        rolls.push(v);total+=v;
      }
      const d6=roll(extra);rolls.push(...d6);total+=sum(d6)+level+(ex.flat||0);
      total=Math.max(1,finalMods(b,atkSide,cat,physical,total,ex.notes));
      ev.stab=stab>0;ev.qd=qd;ev.count=count;ev.extra=extra;ev.level=level;ev.gap=gap;ev.offQ=offQ;ev.defQ=defQ;
      ev.expr=`${QD_SIDES[qd].map(x=>`${count}d${x}`).join("+")}${extra?` +${extra}d6`:""}${level?` +${level}`:""}`;
      ev.dice=count*QD_SIDES[qd].length+extra;ev.rolls=rolls;ev.fixed=level;
      if(ex.notes.length)ev.notes=[...new Set([...(ev.notes||[]),...ex.notes])];
      return total;
    }

    function hpEvent(events,k,s,b,amount,src){const ms=activeState(b,s);events.push({k,side:s,mon:activeMon(b,s).name,amount,hp:ms.hp,src});}
    function heal(b,s,amount,events,src){
      const ms=activeState(b,s);if(ms.fainted||amount<=0)return 0;
      const hm=b.sides[s].healMult??1;if(hm!==1)amount=Math.max(1,Math.floor(amount*hm));
      const before=ms.hp;ms.hp=Math.min(ms.maxHp,ms.hp+amount);
      if(ms.hp>before)hpEvent(events,"heal",s,b,ms.hp-before,src);
      return ms.hp-before;
    }
    function hurt(b,s,amount,events,src){
      const ms=activeState(b,s);if(ms.fainted)return;
      ms.hp=Math.max(0,ms.hp-amount);hpEvent(events,"sdmg",s,b,amount,src);
      checkFaint(b,s,events);
    }
    function checkFaint(b,s,events){
      const ms=activeState(b,s);
      if(ms.hp<=0&&!ms.fainted){ms.fainted=true;ms.status=null;events.push({k:"faint",side:s,mon:activeMon(b,s).name});b.sides[s].faintedThisTurn=true;return true;}
      return false;
    }
    function lowHpCheck(b,s,events){
      const ms=activeState(b,s),A=abil(b,s);
      if(!A.lowHp||ms.fainted)return;
      if(A.lowHp.once&&ms.used.lowHp)return;
      if(ms.hp*100<=ms.maxHp*A.lowHp.pct&&!ms.used.lowHpNow){
        ms.used.lowHp=true;ms.used.lowHpNow=true;
        events.push({k:"ability",side:s,mon:activeMon(b,s).name,name:A.name});
        A.lowHp.stages.forEach(st=>addStage(b,s,st.stat,st.n,events,{src:A.name,cap:st.cap}));
      }
    }
    function critMargin(b,s,move){
      return 5+5*Math.max(0,(move.fx?.critStage||0)+(activeState(b,s).crit||0)+(itemOf(b,s)?.crit||0));
    }

    /* ---------- Usar um golpe ---------- */
    function useMove(b,s,idx,events,ctx,opt={}){
      const A=activeMon(b,s),aS=activeState(b,s);
      if(aS.fainted)return;
      const tSide=other(s);
      let move=A.moves[idx]||{name:"Struggle",type:"Normal",category:"Physical",power:50,accuracy:null,fx:RULES.parseMove({name:"Struggle",category:"Physical"})};
      const isZ=ctx.z?.has(s)&&zMoveOk(A,move,A.gimmick?.zType);
      if(isZ){b.sides[s].gim.z=true;move={...move,name:"Z-"+move.name,power:zPower(move.power),accuracy:null,alwaysHits:true,zBase:move.name};}
      const fx=move.fx;
      const cat=String(move.category||"").toLowerCase();
      const k=key(move.name);
      const M=fx.mech||{};
      // pode agir? (Sleep Talk e Snore funcionam dormindo)
      if(aS.status==="slp"&&!opt.asleepOK&&(M.sleepTalk||M.snore)&&aS.slp>0){aS.slp--;opt={...opt,asleep:true};}
      else if(aS.status==="slp"&&!opt.asleepOK){
        if(aS.slp>0){aS.slp--;events.push({k:"cant",side:s,mon:A.name,reason:"slp"});return;}
        aS.status=null;events.push({k:"statusEnd",side:s,mon:A.name,st:"slp"});
      }
      if(aS.status==="frz"){
        if(d(6)>=5){aS.status=null;events.push({k:"statusEnd",side:s,mon:A.name,st:"frz"});}
        else{events.push({k:"cant",side:s,mon:A.name,reason:"frz"});return;}
      }
      if(aS.flinch){aS.flinch=false;events.push({k:"cant",side:s,mon:A.name,reason:"flinch"});return;}
      if(aS.status==="par"&&d(4)===1){events.push({k:"cant",side:s,mon:A.name,reason:"par"});return;}
      if(aS.cnf>0){
        aS.cnf--;
        if(d(6)<=3){const dmg=sum(roll(1));events.push({k:"cant",side:s,mon:A.name,reason:"cnf"});hurt(b,s,dmg,events,"cnf");return;}
        if(aS.cnf===0)events.push({k:"statusEnd",side:s,mon:A.name,st:"cnf"});
      }
      const ev={k:"move",side:s,mon:A.name,move:move.name,type:move.type,category:move.category};
      if(isZ){ev.z=true;ev.power=move.power;}
      // item: Choice prende no golpe; Metronome conta usos seguidos
      const myItem=itemOf(b,s);
      if(myItem?.choiceLock&&aS.lock==null&&A.moves[idx])aS.lock=idx;
      const mk=key(move.name);aS.metro=aS.metro.k===mk?{k:mk,n:aS.metro.n+1}:{k:mk,n:1};
      events.push(ev);
      const prevMove=aS.lastMove;aS.lastMove=k;
      const prevType=aS.lastType;aS.lastType=normT(move.type);
      aS.destiny=false;aS.lastIdx=idx;
      const fail=why=>{ev.fail=true;ev.why=why;return true;};
      // Sleep Talk / Snore
      if(M.snore&&!opt.asleep&&!opt.asleepOK){fail("só funciona dormindo");return;}
      if(M.sleepTalk){
        if(!opt.asleep){fail("só funciona dormindo");return;}
        const opts=A.moves.map((m,i)=>i).filter(i=>i!==idx&&!(A.moves[i].fx?.mech?.semi||A.moves[i].fx?.mech?.charge||A.moves[i].fx?.mech?.sleepTalk));
        if(!opts.length){fail("nenhum golpe para usar");return;}
        useMove(b,s,opts[Math.floor(rand()*opts.length)],events,ctx,{asleepOK:true});return;
      }
      // Taunt / Disable
      if(aS.taunt>0&&cat==="status"){fail("está provocado (Taunt) e só pode atacar");return;}
      if(aS.disable&&aS.disable.idx===idx){fail("o golpe está bloqueado (Disable)");return;}
      // golpes de dois turnos (Fly, Dig, Dive, Phantom Force, Solar Beam…)
      if((M.semi||M.charge)&&!aS.charge){
        const skip=M.skipIn&&b.weather?.kind===M.skipIn;
        const herb=!skip&&/power herb/i.test(itemOf(b,s)?.name||"");
        if(M.chargeStage)addStage(b,s,M.chargeStage.stat,M.chargeStage.n,events,{src:move.name});
        if(herb)useUpItem(b,s,events,"fez o golpe sair na hora");
        else if(!skip){aS.charge={idx,name:move.name};if(M.semi)aS.semi=M.semi;events.push({k:"info",text:`${A.name} ${M.say||"está se preparando!"}`});return;}
      }else if(aS.charge){aS.charge=null;aS.semi=null;}
      // Focus Punch: perde a concentração se levou dano antes
      if(M.focus&&aS.hurt.any){fail("perdeu a concentração e não atacou");return;}
      // Sucker Punch / Thunderclap / Upper Hand: dependem da ação do alvo
      if(M.needFoeAttack||M.needFoePriority){
        const fa=ctx.P?.[tSide],fm=fa?.kind==="move"?activeMon(b,tSide).moves[fa.idx]:null;
        const ok=fm&&!ctx.acted.has(tSide)&&(M.needFoePriority?movePriority(fm)>0:String(fm.category||"").toLowerCase()!=="status");
        if(!ok){fail(M.needFoePriority?"só funciona contra um golpe de prioridade":"só funciona se o alvo for atacar");return;}
      }
      if(M.selfKO)ctx.selfKO.add(s);
      // falhas de condição
      if(fx.firstTurnOnly&&aS.enteredTurn!==b.turn){ev.fail=true;ev.why="só funciona no primeiro turno em campo";aS.lastType=prevType;return;}
      if(fx.protect){
        const ok=prevMove&&A.moves.some(m=>key(m.name)===prevMove&&m.fx.protect)?d(3)===1:true;
        if(ok){ctx.protected.add(s);ev.protect=true;aS.protectStreak++;}else{ev.fail=true;ev.why="falhou (uso seguido)";}
        return;
      }
      const tS=activeState(b,tSide),T=activeMon(b,tSide);
      const affectsFoe=fx.stages.some(x=>x.who==="foe")||fx.status.some(x=>x.who==="foe")||cat!=="status";
      if(affectsFoe&&ctx.protected.has(tSide)&&M.breakProtect){ctx.protected.delete(tSide);events.push({k:"info",text:`${A.name} quebrou a proteção de ${T.name}!`});}
      if(affectsFoe&&ctx.protected.has(tSide)&&cat!=="status"){events.push({k:"blocked",side:tSide});return;}
      // alvo no ar, debaixo da terra, na água ou sumido
      let semiMult=1;
      if(tS.semi&&!tS.fainted&&(affectsFoe||M.phaze||M.taunt||M.encore||M.disable||M.leechSeed||M.yawn||M.swapItems)){
        const hm=RULES.SEMI_HIT?.[tS.semi]?.[k];
        if(!hm&&key(abil(b,s).name)!=="no guard"&&key(abil(b,tSide).name)!=="no guard"){ev.miss=true;ev.why={fly:"está no ar",dig:"está debaixo da terra",dive:"está debaixo d'água",phantom:"sumiu de vista"}[tS.semi];events.push({k:"info",text:`${T.name} ${ev.why}: o golpe não alcançou.`});return;}
        semiMult=hm||1;
        if(M.grounds&&tS.semi==="fly"){tS.semi=null;tS.charge=null;events.push({k:"info",text:`${T.name} foi derrubado no chão!`});}
      }
      // Substitute bloqueia golpes de status no alvo (som atravessa)
      if(cat==="status"&&tS.sub>0&&!isSound(move)&&!M.phaze&&(fx.stages.some(x=>x.who==="foe")||fx.status.some(x=>x.who==="foe")||M.taunt||M.encore||M.disable||M.leechSeed||M.yawn||M.foeStages||M.swapItems)){fail(`o substituto de ${T.name} bloqueou`);return;}
      if(fx.powder&&(typesOf(b,tSide).includes("Grass")||abil(b,tSide).immune.powder||itemOf(b,tSide)?.goggles)){const gg=itemOf(b,tSide)?.goggles&&!typesOf(b,tSide).includes("Grass")&&!abil(b,tSide).immune.powder;events.push({k:"cant",side:tSide,mon:T.name,reason:"powder",src:gg?itemOf(b,tSide).name:abil(b,tSide).immune.powder?abil(b,tSide).name:"Grass"});return;}

      // golpes de status
      if(cat==="status"){
        if(affectsFoe&&!tS.fainted&&move.accuracy!=null&&!move.alwaysHits&&!fx.neverMiss&&(fx.stages.some(x=>x.who==="foe")||fx.status.some(x=>x.who==="foe"))){
          const acc=accuracyFor(b,s,move,ctx);const r=d(100);ev.roll=r;ev.acc=acc;
          aS.nextAcc=0;
          if(r>acc&&r>5){ev.miss=true;if(ctx.evade?.[tSide]&&r<=acc+ctx.evade[tSide])ev.dodged=true;blunder(b,s,events);return;}
        }
        if(ctx.protected.has(tSide)&&affectsFoe){events.push({k:"blocked",side:tSide});return;}
        if(fx.mech&&statusMech(b,s,idx,move,M,events,ctx,ev))return;
        applySecondary(b,s,move,events,{hit:true,status:true});
        if(fx.heal){
          // Synthesis, Moonlight e Morning Sun: 2/3 no Sol, 1/4 em outros climas
          let pct=fx.heal;const w=b.weather?.kind;
          if(w&&/^(synthesis|moonlight|morning sun)$/.test(k))pct=w==="sun"?66.7:25;
          if(w==="sand"&&k==="shore up")pct=66.7;
          heal(b,s,Math.ceil(aS.maxHp*pct/100),events,move.name);
        }
        if(fx.rest){aS.status="slp";aS.slp=2;heal(b,s,aS.maxHp,events,move.name);events.push({k:"status",side:s,mon:A.name,st:"slp",src:move.name});}
        if(fx.selfCrit){aS.crit+=fx.selfCrit;events.push({k:"info",text:`${A.name} se concentrou: crítico aumentado em ${fx.selfCrit} estágio${fx.selfCrit>1?"s":""}.`});}
        if(fx.weather)setWeather(b,fx.weather.kind,fx.weather.turns,events,move.name,s);
        if(fx.hazard==="tspikes"){const h=b.sides[tSide].hazards;h.tspikes=Math.min(2,h.tspikes+1);events.push({k:"hazard",side:tSide,kind:"tspikes",layers:h.tspikes});}
        if(fx.haze){for(const x of ["p1","p2"]){activeState(b,x).stages=[];}events.push({k:"info",text:"Todos os estágios foram zerados."});}
        if(fx.nextDouble){aS.nextDouble=fx.nextDouble;events.push({k:"info",text:`O próximo golpe ${fx.nextDouble==="physical"?"físico ":fx.nextDouble==="special"?"especial ":""}de ${A.name} causa o dobro do dano.`});}
        if(fx.nextHalf){aS.nextHalf=true;events.push({k:"info",text:`O próximo dano que ${A.name} receber cai pela metade.`});}
        // Campo Real
        const side=b.sides[s];
        if(fx.field==="royal"){
          if(side.field.royal>0){side.field.royal+=2;events.push({k:"field",side:s,kind:"royal",turns:side.field.royal,extended:true});}
          else{side.field.royal=3;events.push({k:"field",side:s,kind:"royal",turns:3});if(!tS.fainted)addStage(b,tSide,"spe",-1,events,{src:"Campo Real",fromFoe:true});}
          heal(b,s,Math.max(1,Math.floor(aS.maxHp/16)),events,"Royal Command");
        }else if(A.abil.royal&&side.field.royal>0&&k==="quiver dance"){side.field.royal+=2;events.push({k:"field",side:s,kind:"royal",turns:side.field.royal,extended:true});}
        if(isSound(move))throatSpray(b,s,events);
        if(!fx.stages.length&&!fx.status.length&&!fx.heal&&!fx.rest&&!fx.selfCrit&&!fx.weather&&!fx.hazard&&!fx.haze&&!fx.field&&!fx.nextDouble&&!fx.nextHalf&&!(A.abil.royal&&k==="quiver dance")){
          ev.status=true;ev.desc=String(move.desc||"").slice(0,160);
        }
        return;
      }

      if(tS.fainted){ev.noTarget=true;return;}
      // precisão e crítico
      const r=d(100);
      const acc=move.accuracy==null||move.alwaysHits||fx.neverMiss||weatherSure(b,move)?null:accuracyFor(b,s,move,ctx);
      aS.nextAcc=0;
      ev.roll=r;ev.acc=acc;
      const natural=r<=5;
      const crit=natural||(r<=critMargin(b,s,move)&&(acc==null||r<=acc));
      ev.crit=crit;ev.critKind=natural?"natural":crit?"boosted":"";
      if(!crit&&acc!=null&&r>acc){
        ev.miss=true;aS.fury=0;if(ctx.evade?.[tSide]&&r<=acc+ctx.evade[tSide])ev.dodged=true;blunder(b,s,events);
        if(A.abil.keepOnMiss&&aS.abilStages.length){aS.stages=aS.stages.filter(x=>!aS.abilStages.includes(x));aS.abilStages=[];events.push({k:"info",text:`${A.name} errou e perdeu o embalo da ${A.abil.name}.`});}
        return;
      }
      // Power
      let power=Number(move.power||0);
      if(fx.counter||M.metalBurst){
        const cm=M.metalBurst?"any":fx.counter;
        const got=cm==="physical"?aS.hurt.phys:cm==="special"?aS.hurt.spec:(aS.hurt.phys+aS.hurt.spec);
        if(!got){ev.fail=true;ev.why="não recebeu dano para devolver";return;}
        const amount=M.metalBurst?Math.floor(got*1.5):got*2;const hit={k:"hit",side:tSide,crit:false,mult:1,amount,fixed:amount,dice:0,rolls:[],notes:[M.metalBurst?"devolveu 1,5×":"devolveu o dobro"]};
        tS.hp=Math.max(0,tS.hp-amount);hit.hp=tS.hp;events.push(hit);afterHit(b,s,move,events,hit,amount,ctx);return;
      }
      if(!power)power=60;
      // Power que depende da situação
      const hpR=aS.hp/aS.maxHp;
      if(M.power==="reversal")power=hpR<=.0417?200:hpR<=.104?150:hpR<=.208?100:hpR<=.354?80:hpR<=.6875?40:20;
      if(M.power==="hpHigh")power=Math.max(1,Math.floor(150*hpR));
      if(M.power==="boosts")power=20+20*["atk","def","spa","spd","spe","acc","eva"].reduce((t,x)=>t+Math.max(0,stageTotal(aS,x)),0);
      if(M.power==="acrobatics"&&!itemOf(b,s))power*=2;
      if(M.power==="brine"&&tS.hp*2<=tS.maxHp)power*=2;
      if(M.power==="weather"&&b.weather){power*=2;const wt={sun:"Fire",rain:"Water",sand:"Rock",hail:"Ice",snow:"Ice"}[b.weather.kind];if(wt)move={...move,type:wt};}
      if(M.knockOff&&itemOf(b,tSide))power=Math.floor(power*1.5);
      if(semiMult>1)power*=semiMult;
      if((k==="solar beam"||k==="solar blade")&&b.weather&&b.weather.kind!=="sun"){power=Math.floor(power/2);}
      if(M.breakScreens){const F=b.sides[tSide].field;if(F.reflect>0||F.light>0||F.veil>0){F.reflect=0;F.light=0;F.veil=0;events.push({k:"info",text:`${A.name} quebrou as barreiras de ${T.name}!`});}}
      // dano fixo, nocaute e golpes que custam a vida
      if(M.fixed||M.ohko||M.gambit||M.endeavor){
        if(typeMult(b,s,normT(move.type))===0){events.push({k:"hit",side:tSide,crit:false,mult:0,amount:0,immune:true,hp:tS.hp});return;}
        let amount=0;
        if(M.ohko){
          const al=Number(A.level||1),tl=Number(T.level||1);
          if(tl>al){fail("o alvo tem nível maior");return;}
          const r2=d(100),acc2=30+al-tl;ev.roll=r2;ev.acc=acc2;
          if(r2>acc2){ev.miss=true;return;}
          amount=tS.hp;if(abil(b,tSide).sturdy){amount=0;fail(`${abil(b,tSide).name} impediu o nocaute`);return;}
          events.push({k:"info",text:"É um nocaute de um golpe!"});
        }
        else if(M.gambit)amount=aS.hp;
        else if(M.endeavor){amount=Math.max(0,tS.hp-aS.hp);if(!amount){fail("o alvo não tem mais HP que o usuário");return;}}
        else if(M.fixed==="level")amount=Number(A.level||1);
        else if(M.fixed==="half")amount=Math.max(1,Math.floor(tS.hp/2));
        else if(M.fixed==="psywave")amount=Math.max(1,Math.floor(Number(A.level||1)*(50+d(101)-1)/100));
        else amount=Number(M.fixed)||1;
        if(ctx.endure.has(tSide)&&amount>=tS.hp){amount=tS.hp-1;events.push({k:"info",text:`${T.name} aguentou firme!`});}
        if(subAbsorb(b,s,move,amount,events))return afterSub(b,s,move,M,events,amount);
        const hit={k:"hit",side:tSide,crit:false,mult:1,amount,fixed:amount,dice:0,rolls:[],notes:["dano fixo"]};
        tS.hp=Math.max(0,tS.hp-amount);hit.hp=tS.hp;events.push(hit);afterHit(b,s,move,events,hit,amount,ctx);return;
      }
      const gemIt=itemOf(b,s);
      if(gemIt?.gem&&gemIt.gem.type===normT(move.type)){power=Math.round(power*gemIt.gem.x);useUpItem(b,s,events,`deu Power ×${String(gemIt.gem.x).replace(".",",")} ao golpe`);}
      for(const c of fx.doubleIf){
        if(c.cond==="targetStatus"&&tS.status&&c.st.some(x=>x===tS.status||(x==="psn"&&tS.status==="tox")||(x==="tox"&&tS.status==="psn")))power*=2;
        if(c.cond==="targetHurt"&&tS.hurt.any)power*=2;
        if(c.cond==="allyFainted"&&b.sides[s].faintedLastTurn)power*=2;
        if(c.cond==="userStatus"&&aS.status)power*=2;
        if(c.cond==="consecutive"){if(prevMove===k&&aS.fury>0)power=Math.min(power*2**aS.fury,160);aS.fury++;}
      }
      if(!fx.doubleIf.some(c=>c.cond==="consecutive"))aS.fury=0;
      // vários acertos
      let hits=1;
      if(fx.hits&&myItem?.loaded&&!A.abil.maxHits)heldSay(b,s,events,"garantiu o máximo de acertos");
      if(fx.hits){
        const H=fx.hits,maxed=A.abil.maxHits||myItem?.loaded;
        if(maxed||H.min===H.max)hits=H.max;
        // Heaven & Hell: 2–5 acertos = 3 fixos, 5 no Crítico Natural
        else if(H.min===2&&H.max===5)hits=ev.critKind==="natural"?5:3;
        else if(H.max===10)hits=ev.critKind==="natural"?10:Math.max(H.min,Math.ceil(H.max/2));
        else hits=H.min+Math.floor(rand()*(H.max-H.min+1));
        // Power que cresce a cada acerto (Triple Axel/Kick): usa a soma
        if(H.perHit){const per=H.perHit.slice(0,hits);power=Math.round(per.reduce((x,y)=>x+y,0)/hits);}
      }
      const hit={k:"hit",side:tSide,crit};
      let amount=0;
      if(b.damage==="matrix")amount=matrixDamage(b,s,move,hit,{crit,critKind:ev.critKind,power,hits});
      else for(let i=0;i<hits;i++)amount+=damage(b,s,move,hit,{crit,critKind:ev.critKind,power});
      if(hits>1)hit.hits=hits;
      if(hit.immune){hit.amount=0;hit.hp=tS.hp;events.push(hit);
        const ab=abil(b,tSide);const mt=normT(move.type);
        if(ab.absorb?.[mt])heal(b,tSide,Math.ceil(tS.maxHp*ab.absorb[mt]/100),events,ab.name);
        return;}
      if(fx.falseSwipe&&amount>=tS.hp)amount=Math.max(0,tS.hp-1);
      if(abil(b,tSide).sturdy&&tS.hp>=tS.maxHp&&amount>=tS.hp){amount=tS.hp-1;hit.notes=[...(hit.notes||[]),abil(b,tSide).name];}
      // itens do alvo antes do dano
      const tIt=itemOf(b,tSide);
      if(tIt?.resist&&tIt.resist.type===normT(move.type)&&(!tIt.resist.se||hit.mult>=2)&&amount>0){amount=Math.max(1,Math.floor(amount/2));hit.notes=[...(hit.notes||[]),`${tIt.name} ½`];useUpItem(b,tSide,events,"diminuiu o dano pela metade");}
      if(tIt&&!tS.itemGone&&tIt.sash&&tS.hp>=tS.maxHp&&amount>=tS.hp){amount=tS.hp-1;useUpItem(b,tSide,events,"aguentou com 1 HP");}
      else if(tIt&&tIt.band&&amount>=tS.hp&&chance(tIt.band)){amount=tS.hp-1;heldSay(b,tSide,events,"aguentou com 1 HP");}
      if(ctx.endure.has(tSide)&&amount>=tS.hp){amount=tS.hp-1;events.push({k:"info",text:`${T.name} aguentou firme (Endure)!`});}
      if(subAbsorb(b,s,move,amount,events))return afterSub(b,s,move,M,events,amount);
      hit.amount=amount;
      tS.hp=Math.max(0,tS.hp-amount);hit.hp=tS.hp;
      events.push(hit);
      afterHit(b,s,move,events,hit,amount,ctx);
    }
    /* Substitute: o boneco leva o dano no lugar (golpes de som atravessam) */
    function subAbsorb(b,s,move,amount,events){
      const tSide=other(s),tS=activeState(b,tSide),T=activeMon(b,tSide);
      if(!(tS.sub>0)||isSound(move))return false;
      const took=Math.min(tS.sub,amount);tS.sub-=took;
      events.push({k:"info",text:`O substituto de ${T.name} levou ${took} de dano${tS.sub<=0?" e quebrou!":"."}`});
      if(tS.sub<=0)tS.sub=0;
      return true;
    }
    function afterSub(b,s,move,M,events,amount){
      const aS=activeState(b,s);
      if(move.fx.recoil&&amount>0)hurt(b,s,Math.max(1,Math.floor(amount*move.fx.recoil/100)),events,"recoil");
      if(M.recharge&&!aS.fainted)aS.recharge=true;
      if(M.halfCost&&!aS.fainted)hurt(b,s,Math.max(1,Math.ceil(aS.maxHp/2)),events,move.name);
      if(M.pivot&&!aS.fainted&&canEject(b,s)){aS.eject=true;}
    }
    /* Roar, Whirlwind, Dragon Tail: o alvo é trocado por um aleatório */
    function forceOut(b,t,events,ctx){
      const side=b.sides[t];
      const opts=side.team.map((x,i)=>i).filter(i=>!side.team[i].fainted&&i!==side.active);
      if(!opts.length)return false;
      events.push({k:"info",text:`${activeMon(b,t).name} foi arrastado para fora!`});
      applySwitch(b,t,opts[Math.floor(rand()*opts.length)],events);
      ctx.forced=ctx.forced||new Set();ctx.forced.add(t);
      return true;
    }
    /* Golpes de status com mecânica própria. Devolve true se cuidou do golpe. */
    function statusMech(b,s,idx,move,M,events,ctx,ev){
      const tSide=other(s),A=activeMon(b,s),aS=activeState(b,s),T=activeMon(b,tSide),tS=activeState(b,tSide);
      const say=t=>events.push({k:"info",text:t});
      const fail=w=>{ev.fail=true;ev.why=w;return true;};
      const side=b.sides[s],foeSide=b.sides[tSide];
      if(M.substitute){
        if(aS.sub>0)return fail("já tem um substituto");
        const cost=Math.floor(aS.maxHp/4);if(aS.hp<=cost)return fail("não tem HP para o substituto");
        hurt(b,s,cost,events,"Substitute");aS.sub=cost;say(`${A.name} criou um substituto (${cost} HP)!`);return true;
      }
      if(M.curse){
        if(typesOf(b,s).includes("Ghost")){
          if(tS.cursed)return fail("o alvo já está amaldiçoado");
          hurt(b,s,Math.max(1,Math.floor(aS.maxHp/2)),events,"Curse");tS.cursed=true;say(`${A.name} cortou a própria vida e amaldiçoou ${T.name}!`);
        }else{addStage(b,s,"atk",1,events,{src:"Curse"});addStage(b,s,"def",1,events,{src:"Curse"});addStage(b,s,"spe",-1,events,{src:"Curse"});}
        return true;
      }
      if(M.bellyDrum){
        const cost=Math.floor(aS.maxHp/2);if(aS.hp<=cost)return fail("não tem HP suficiente");
        hurt(b,s,cost,events,"Belly Drum");addStage(b,s,"atk",12,events,{src:"Belly Drum"});say(`${A.name} cortou o HP e maximizou o Attack!`);return true;
      }
      if(M.destiny){aS.destiny=true;say(`${A.name} quer levar o rival junto se for derrotado!`);return true;}
      if(M.perish){let any=false;for(const x of [s,tSide]){const ms=activeState(b,x);if(!ms.fainted&&!ms.perish&&!(x===tSide&&key(abil(b,x).name)==="soundproof")){ms.perish=4;any=true;}}
        if(!any)return fail("todos já ouviram a canção");say("Todos que ouviram a canção vão desmaiar em 3 turnos!");return true;}
      if(M.endure){const ok=aS.protectStreak>0?d(3)===1:true;if(!ok){aS.protectStreak=0;return fail("falhou (uso seguido)");}ctx.endure.add(s);aS.protectStreak++;say(`${A.name} se preparou para aguentar!`);return true;}
      if(M.painSplit){const avg=Math.floor((aS.hp+tS.hp)/2);aS.hp=Math.min(aS.maxHp,avg);tS.hp=Math.min(tS.maxHp,avg);
        events.push({k:"heal",side:s,mon:A.name,amount:0,hp:aS.hp,src:"Pain Split"},{k:"sdmg",side:tSide,mon:T.name,amount:0,hp:tS.hp,src:"Pain Split"});say(`${A.name} e ${T.name} dividiram o HP (${avg}).`);return true;}
      if(M.taunt){if(tS.taunt>0)return fail("o alvo já está provocado");tS.taunt=3;say(`${T.name} caiu na provocação: só pode atacar por 3 turnos!`);return true;}
      if(M.encore){const li=tS.lastIdx;if(li<0||tS.encore)return fail("o alvo não tem golpe para repetir");tS.encore={idx:li,n:3};say(`${T.name} ficou preso no bis: só usa ${T.moves[li]?.name} por 3 turnos!`);return true;}
      if(M.disable){const li=tS.lastIdx;if(li<0||tS.disable)return fail("o alvo não tem golpe para bloquear");tS.disable={idx:li,n:4};say(`${T.moves[li]?.name} de ${T.name} foi bloqueado por 4 turnos!`);return true;}
      if(M.leechSeed){if(typesOf(b,tSide).includes("Grass"))return fail("Pokémon Grass são imunes");if(tS.seeded)return fail("o alvo já tem sementes");tS.seeded=s;say(`${T.name} foi semeado!`);return true;}
      if(M.yawn){if(tS.status||tS.yawn)return fail("não funcionou");tS.yawn=2;say(`${T.name} ficou com sono…`);return true;}
      if(M.trickRoom){b.trickRoom=b.trickRoom>0?0:5;say(b.trickRoom?"As dimensões se distorceram: os mais lentos agem primeiro por 5 turnos!":"As dimensões voltaram ao normal.");return true;}
      if(M.tailwind){if(side.field.tailwind>0)return fail("o vento já está soprando");side.field.tailwind=4;say(`Um vento a favor soprou para o time de ${A.name}! (4 turnos)`);return true;}
      if(M.screen){
        if(M.screen==="veil"&&!(b.weather&&(b.weather.kind==="hail"||b.weather.kind==="snow")))return fail("só funciona com granizo/neve");
        if(side.field[M.screen]>0)return fail("a barreira já está ativa");
        side.field[M.screen]=/light clay/i.test(itemOf(b,s)?.name||"")?8:5;say(`${move.name} protege o time de ${A.name} por ${side.field[M.screen]} turnos!`);return true;
      }
      if(M.hazard){const H=foeSide.hazards;
        if(M.hazard==="rocks"){if(H.rocks)return fail("já há pedras");H.rocks=true;say(`Pedras pontiagudas flutuam no lado de ${T.name}!`);}
        if(M.hazard==="spikes"){if(H.spikes>=3)return fail("já há 3 camadas");H.spikes++;say(`Spikes espalhados no lado de ${T.name} (${H.spikes}/3)!`);}
        if(M.hazard==="web"){if(H.web)return fail("já há uma teia");H.web=true;say(`Uma teia pegajosa cobre o lado de ${T.name}!`);}
        return true;}
      if(M.clearHazards==="both"){for(const x of [s,tSide]){const H=b.sides[x].hazards;H.tspikes=0;H.rocks=false;H.spikes=0;H.web=false;}
        if(M.clearFoeScreens){const F=foeSide.field;F.reflect=0;F.light=0;F.veil=0;if(!tS.fainted)addStage(b,tSide,"eva",-1,events,{src:move.name,fromFoe:true});}
        if(M.selfStages)M.selfStages.forEach(x=>addStage(b,s,x.stat,x.n,events,{src:move.name}));
        say("Os perigos de campo foram limpos!");return true;}
      if(M.wish){if(side.wish)return fail("já há um desejo");side.wish={turns:2,amount:Math.floor(aS.maxHp/2)};say(`${A.name} fez um desejo!`);return true;}
      if(M.swapItems){const ai=A.item&&!aS.itemGone?A.item:null,ti=T.item&&!tS.itemGone?T.item:null;if(!ai&&!ti)return fail("ninguém tem item");
        A.item=ti?{...ti}:null;T.item=ai?{...ai}:null;aS.itemGone=false;tS.itemGone=false;aS.lock=null;tS.lock=null;say(`${A.name} trocou de item com ${T.name}!`);return true;}
      if(M.phaze){if(!forceOut(b,tSide,events,ctx))return fail("o alvo não tem quem entrar");return true;}
      if(M.growth){const n=b.weather?.kind==="sun"?2:1;addStage(b,s,"atk",n,events,{src:move.name});addStage(b,s,"spa",n,events,{src:move.name});return true;}
      if(M.selfStages&&M.charge){M.selfStages.forEach(x=>addStage(b,s,x.stat,x.n,events,{src:move.name}));return true;}
      if(M.selfKO){
        if(M.foeStages&&!tS.fainted)M.foeStages.forEach(x=>addStage(b,tSide,x.stat,x.n,events,{src:move.name,fromFoe:true}));
        if(M.healWish){side.healWish=true;say(`${A.name} deixou um desejo de cura para quem entrar!`);}
        return true;// o desmaio vem depois do golpe (ctx.selfKO)
      }
      if(M.pivot){
        if(M.foeStages&&!tS.fainted)M.foeStages.forEach(x=>addStage(b,tSide,x.stat,x.n,events,{src:move.name,fromFoe:true}));
        if(!canEject(b,s))return M.foeStages?true:fail("não tem quem entrar");
        if(M.shedTail){const cost=Math.ceil(aS.maxHp/2);if(aS.hp<=cost)return fail("não tem HP suficiente");hurt(b,s,cost,events,"Shed Tail");side.passSub=Math.floor(aS.maxHp/4);}
        if(M.baton)aS.baton=true;
        aS.eject=true;say(`${A.name} vai trocar de lugar${M.baton?" passando os estágios":""}!`);return true;
      }
      return false;
    }
    function blunder(b,s,events){
      const it=itemOf(b,s);if(!it?.blunder||activeState(b,s).fainted)return;
      useUpItem(b,s,events,"ativou depois do erro");addStage(b,s,"spe",it.blunder,events,{src:it.name});
    }
    function throatSpray(b,s,events){
      const it=itemOf(b,s);if(!it?.throatSpray||activeState(b,s).fainted)return;
      useUpItem(b,s,events,"ativou com o golpe de som");addStage(b,s,"spa",it.throatSpray,events,{src:it.name});
    }
    // Thunder/Hurricane não erram na chuva; Blizzard não erra no granizo/neve
    const weatherSure=(b,move)=>{const w=b.weather?.kind,k=key(move.name);return (w==="rain"&&(k==="thunder"||k==="hurricane"||k==="bleakwind storm"||k==="wildbolt storm"||k==="sandsear storm"))||((w==="hail"||w==="snow")&&k==="blizzard");};
    function accuracyFor(b,s,move,ctx){
      const k0=key(move.name);
      const base=b.weather?.kind==="sun"&&(k0==="thunder"||k0==="hurricane")?50:Math.max(1,Math.min(100,Number(move.accuracy)||100));
      const net=Math.max(-6,Math.min(6,stageTotal(activeState(b,s),"acc")-stageTotal(activeState(b,other(s)),"eva")));
      const acc=Math.max(1,Math.min(90,Math.floor(base*stageMult("acc",net))));
      const ev=ctx?.evade?.[other(s)]||0;
      const mine=itemOf(b,s),theirs=itemOf(b,other(s));
      let bonus=(activeState(b,s).nextAcc||0)+(mine?.acc||0)+(mine?.accLate&&ctx?.acted?.has(other(s))?mine.accLate:0)-(theirs?.foeAcc||0);
      const out=acc+bonus;
      return Math.max(1,Math.min(bonus>0?100:acc,out)-ev);
    }
    /* bagas de HP baixo (Sitrus, Oran, Liechi…) */
    function itemPinch(b,s,events){
      const it=itemOf(b,s),ms=activeState(b,s);
      if(!it?.pinch||ms.fainted)return;
      if(ms.hp>ms.maxHp*it.pinch.at)return;
      const p=it.pinch;
      if(p.consume!==false)useUpItem(b,s,events,"foi comido");else heldSay(b,s,events,"ativou");
      if(p.healFrac)heal(b,s,Math.max(1,Math.floor(ms.maxHp*p.healFrac)),events,it.name);
      if(p.healFlat)heal(b,s,p.healFlat,events,it.name);
      if(p.nextAcc)ms.nextAcc=p.nextAcc;
      if(p.nextFirst)ms.nextFirst=true;
      if(p.stage){const st=p.stage.stat==="random"?["atk","def","spa","spd","spe"][d(5)-1]:p.stage.stat;addStage(b,s,st,p.stage.n,events,{src:it.name});}
    }
    function afterHit(b,s,move,events,hit,amount,ctx){
      const tSide=other(s),A=activeMon(b,s),aS=activeState(b,s),T=activeMon(b,tSide),tS=activeState(b,tSide);
      const fx=move.fx,cat=String(move.category||"").toLowerCase(),physical=cat==="physical",mtype=normT(move.type);
      if(amount>0){
        tS.hurt.any=true;if(physical)tS.hurt.phys+=amount;else tS.hurt.spec+=amount;
        if(tS.status==="slp"&&physical&&d(6)>=5){tS.status=null;tS.slp=0;events.push({k:"statusEnd",side:tSide,mon:T.name,st:"slp"});}
      }
      // dreno e recuo
      if(fx.drain&&amount>0){
        if(abil(b,tSide).immune.drain)events.push({k:"info",text:`${T.name} não pode ser drenado (${abil(b,tSide).name}).`});
        else heal(b,s,Math.max(1,Math.floor(amount*fx.drain/100*(itemOf(b,s)?.bigRoot||1))),events,move.name);
      }
      const fainted=checkFaint(b,tSide,events);
      if(fx.recoil&&amount>0)hurt(b,s,Math.max(1,Math.floor(amount*fx.recoil/100)),events,"recoil");
      // efeitos secundários
      let flinched=false;
      if(!fainted){
        applySecondary(b,s,move,events,{hit:true});
        if(fx.flinch&&!itemOf(b,tSide)?.cloak&&!ctx.acted.has(tSide)&&!abil(b,tSide).immune.flinch&&chance(fx.flinch)){tS.flinch=true;flinched=true;}
        lowHpCheck(b,tSide,events);
      }
      // ability do atacante ao acertar
      for(const h of A.abil.onHit){
        const c=h.cond;
        if(c.cat&&c.cat!==cat)continue;
        if(c.contact&&!physical)continue;
        if(c.types&&!c.types.includes(mtype))continue;
        if(c.crit&&!hit.crit)continue;
        if(c.flinch&&!flinched)continue;
        if(aS.fainted)continue;
        const before=aS.stages.length;
        const ap=addStage(b,s,h.stage.stat,h.stage.n,events,{src:A.abil.name,cap:h.stage.cap});
        if(ap&&A.abil.keepOnMiss&&aS.stages.length>before)aS.abilStages.push(aS.stages[aS.stages.length-1]);
      }
      if(hit.crit&&A.abil.critMode&&!aS.fainted){aS.swagger=A.abil.critMode.turns+1;events.push({k:"ability",side:s,mon:A.name,name:A.abil.name,text:"entrou em Swagger Mode!"});}
      // ao derrotar
      if(fainted&&!aS.fainted){
        const K=A.abil.onKO;
        if(K.stages.length||K.healPct||K.nextPhys)events.push({k:"ability",side:s,mon:A.name,name:A.abil.name});
        K.stages.forEach(st=>addStage(b,s,st.stat,st.n,events,{src:A.abil.name,cap:st.cap}));
        if(K.healPct)heal(b,s,Math.max(1,Math.floor(aS.maxHp*K.healPct/100)),events,A.abil.name);
        if(K.nextPhys)aS.nextPhys+=K.nextPhys;
      }
      // ---- itens segurados depois do golpe
      const aIt=itemOf(b,s),dIt=itemOf(b,tSide);
      if(amount>0&&aIt?.drain&&!aS.fainted)heal(b,s,Math.max(1,Math.floor(amount*aIt.drain)),events,aIt.name);
      if(amount>0&&aIt?.flinch&&!fx.flinch&&!fainted&&!dIt?.cloak&&!ctx.acted.has(tSide)&&!abil(b,tSide).immune.flinch&&chance(aIt.flinch))tS.flinch=true;
      if(amount>0&&dIt&&!tS.fainted){
        if(dIt.groundImmune)useUpItem(b,tSide,events,"estourou");
        else if(dIt.weakPolicy&&hit.mult>=2){useUpItem(b,tSide,events,"ativou");addStage(b,tSide,"atk",dIt.weakPolicy,events,{src:dIt.name});addStage(b,tSide,"spa",dIt.weakPolicy,events,{src:dIt.name});}
        else if(dIt.seHeal&&hit.mult>=2){useUpItem(b,tSide,events,"foi comido");heal(b,tSide,Math.max(1,Math.floor(tS.maxHp*dIt.seHeal)),events,dIt.name);}
        else if(dIt.hitStage&&(dIt.hitStage.on.toLowerCase()===cat||dIt.hitStage.on===mtype)){useUpItem(b,tSide,events,"ativou");addStage(b,tSide,dIt.hitStage.stat,dIt.hitStage.n,events,{src:dIt.name});}
        else if(dIt.hitRecoil&&dIt.hitRecoil.cat===cat&&!aS.fainted){useUpItem(b,tSide,events,"machucou o atacante");hurt(b,s,Math.max(1,Math.floor(aS.maxHp*dIt.hitRecoil.frac)),events,dIt.name);}
        itemPinch(b,tSide,events);
      }
      const contact=physical&&!aIt?.pads&&!(aIt?.punch&&isPunch(move));
      if(amount>0&&contact&&dIt?.contactHurt&&!aS.fainted){heldSay(b,tSide,events,"machucou quem encostou");hurt(b,s,Math.max(1,Math.floor(aS.maxHp*dIt.contactHurt)),events,dIt.name);}
      if(amount>0&&aIt?.recoil&&!aS.fainted){heldSay(b,s,events,"cobrou o preço");hurt(b,s,Math.max(1,Math.floor(aS.maxHp*aIt.recoil)),events,aIt.name);}
      if(!aS.fainted)itemPinch(b,s,events);
      // contato contra ability do alvo (Static, Toxic Shell…)
      if(contact&&amount>0&&!aS.fainted){
        for(const o of abil(b,tSide).onHurtContact){
          if(chance(o.chance)){events.push({k:"ability",side:tSide,mon:T.name,name:abil(b,tSide).name});giveStatus(b,s,o.st,events,abil(b,tSide).name);}
        }
      }
      if(isSound(move))throatSpray(b,s,events);
      const M=fx.mech||{};
      if(fainted&&tS.destiny&&!aS.fainted){events.push({k:"info",text:`${T.name} levou ${A.name} junto (Destiny Bond)!`});aS.hp=0;checkFaint(b,s,events);}
      if(M.recharge&&!aS.fainted)aS.recharge=true;
      if(M.halfCost&&!aS.fainted)hurt(b,s,Math.max(1,Math.ceil(aS.maxHp/2)),events,move.name);
      if(M.knockOff&&amount>0&&!tS.fainted&&itemOf(b,tSide)){const nm=itemOf(b,tSide).name;tS.itemGone=true;events.push({k:"info",text:`${A.name} derrubou o ${nm} de ${T.name}!`});}
      if(M.stealItem&&amount>0&&!aS.fainted&&!itemOf(b,s)&&itemOf(b,tSide)){const it=itemOf(b,tSide);A.item={...it};aS.itemGone=false;tS.itemGone=true;events.push({k:"info",text:`${A.name} roubou o ${it.name} de ${T.name}!`});}
      if(M.clearHazards==="self"&&!aS.fainted){const H=b.sides[s].hazards;if(H.tspikes||H.rocks||H.spikes||H.web){H.tspikes=0;H.rocks=false;H.spikes=0;H.web=false;events.push({k:"info",text:`${A.name} limpou os perigos do seu lado!`});}}
      if(M.selfStages&&!aS.fainted)M.selfStages.forEach(x=>addStage(b,s,x.stat,x.n,events,{src:move.name}));
      if(M.phaze&&amount>0&&!tS.fainted&&tS.sub<=0)forceOut(b,tSide,events,ctx);
      if(M.pivot&&!aS.fainted&&canEject(b,s)){aS.eject=true;events.push({k:"info",text:`${A.name} vai voltar para a Pokébola.`});}
      // Eject Button: quem levou o golpe sai no fim do turno
      if(amount>0&&!tS.fainted&&itemOf(b,tSide)?.ejectButton&&canEject(b,tSide)){useUpItem(b,tSide,events,"tirou o Pokémon de campo");tS.eject=true;}
      // Red Card: o atacante é trocado por um aleatório
      else if(amount>0&&!tS.fainted&&!aS.fainted&&itemOf(b,tSide)?.redCard&&canEject(b,s)){
        useUpItem(b,tSide,events,`mostrou o cartão para ${A.name}`);
        const opts=b.sides[s].team.map((t,i)=>i).filter(i=>!b.sides[s].team[i].fainted&&i!==b.sides[s].active);
        applySwitch(b,s,opts[Math.floor(rand()*opts.length)],events);ctx.forced=ctx.forced||new Set();ctx.forced.add(s);
      }
    }
    /* estágios e status do texto do golpe */
    function applySecondary(b,s,move,events){
      const fx=move.fx,tSide=other(s);
      const rollFor=new Map();// mesma chance = mesma rolagem (ex.: "10% de reduzir Sp.Def")
      const happens=c=>{if(c>=100)return true;if(!rollFor.has(c))rollFor.set(c,d(100)<=c);return rollFor.get(c);};
      const cloak=itemOf(b,tSide)?.cloak&&move.category&&String(move.category).toLowerCase()!=="status";
      for(const st of fx.stages){
        if(cloak&&st.who==="foe")continue;
        if(!happens(st.chance??100))continue;
        if(st.who==="foe"){if(!activeState(b,tSide).fainted)addStage(b,tSide,st.stat,st.n,events,{src:move.name,fromFoe:true,cap:st.cap});}
        else addStage(b,s,st.stat,st.n,events,{src:move.name,cap:st.cap});
      }
      for(const st of fx.status){
        if(cloak&&st.who!=="self")continue;
        if(!happens(st.chance??100))continue;
        const target=st.who==="self"?s:tSide;
        if(!activeState(b,target).fainted)giveStatus(b,target,st.st,events,move.name);
      }
    }

    function applySwitch(b,s,idx,events){
      const side=b.sides[s];
      const fromMs=activeState(b,s);
      const from=activeMon(b,s).name;
      const pass=fromMs.baton?{stages:fromMs.stages.map(x=>({...x})),persist:{...fromMs.persist},sub:fromMs.sub,crit:fromMs.crit}:null;
      if(fromMs.formOn&&fromMs.formBase){b.teams[s][side.active]=fromMs.formBase;fromMs.formOn=false;fromMs.formBase=null;}
      resetVolatile(fromMs);
      side.active=idx;side.needSwitch=false;
      events.push({k:"switch",side:s,from,to:activeMon(b,s).name,hp:activeState(b,s).hp});
      {const ns=activeState(b,s);
        if(pass){ns.stages=pass.stages;ns.persist=pass.persist;ns.sub=pass.sub;ns.crit=pass.crit;}
        if(side.passSub){ns.sub=side.passSub;side.passSub=0;events.push({k:"info",text:`${activeMon(b,s).name} recebeu o substituto!`});}}
      onEnter(b,s,events,false);
    }

    function finish(b,events){
      for(const s of ["p1","p2"]){
        if(!alive(b,s)){b.phase="end";b.winner=other(s);b.reason="ko";events.push({k:"end",winner:b.winner});return true;}
      }
      return false;
    }

    /* ---------- Fim do turno ---------- */
    function endTurn(b,events){
      const order=["p1","p2"].sort((x,y)=>effSpeed(b,y)-effSpeed(b,x));
      for(const s of order){
        const ms=activeState(b,s),mon=activeMon(b,s),side=b.sides[s];
        if(ms.fainted)continue;
        // status
        if(ms.status==="brn")hurt(b,s,sum(roll(1,3)),events,"brn");
        else if(ms.status==="dbrn")hurt(b,s,sum(roll(1)),events,"dbrn");
        else if(ms.status==="psn")hurt(b,s,sum(roll(1)),events,"psn");
        else if(ms.status==="tox"){hurt(b,s,sum(roll(ms.tox)),events,"tox");ms.tox++;}
        if(ms.fainted)continue;
        // clima
        if(b.weather){
          const t=typesOf(b,s);
          if(itemOf(b,s)?.goggles){}
          else if(b.weather.kind==="sand"&&!t.some(x=>["Rock","Ground","Steel"].includes(x)))hurt(b,s,sum(roll(1)),events,"sand");
          else if(b.weather.kind==="hail"&&!t.includes("Ice"))hurt(b,s,sum(roll(1)),events,"hail");
        }
        if(ms.fainted)continue;
        // item segurado no fim da rodada
        const eIt=itemOf(b,s);
        if(eIt){
          if(eIt.endHeal&&(!eIt.endHealType||t_(b,s).includes(eIt.endHealType)))heal(b,s,Math.max(1,Math.floor(ms.maxHp*eIt.endHeal)),events,eIt.name);
          else if(eIt.endHurt){heldSay(b,s,events,"machucou o usuário");hurt(b,s,Math.max(1,Math.floor(ms.maxHp*eIt.endHurt)),events,eIt.name);}
          if(ms.fainted)continue;
          if(eIt.selfStatus&&!ms.status)giveStatus(b,s,eIt.selfStatus,events,eIt.name);
          if(eIt.clearDrops&&ms.stages.some(x=>x.n<0)){ms.stages=ms.stages.filter(x=>x.n>=0);useUpItem(b,s,events,"zerou os estágios reduzidos");}
          itemPinch(b,s,events);
        }
        // maldição, sementes, sono do Yawn
        if(ms.cursed){events.push({k:"info",text:`${mon.name} sofre com a maldição!`});hurt(b,s,Math.max(1,Math.floor(ms.maxHp/4)),events,"Curse");if(ms.fainted)continue;}
        if(ms.seeded){const src=ms.seeded,dmg=Math.max(1,Math.floor(ms.maxHp/8));hurt(b,s,dmg,events,"Leech Seed");if(!activeState(b,src).fainted)heal(b,src,dmg,events,"Leech Seed");if(ms.fainted)continue;}
        if(ms.yawn>0){ms.yawn--;if(ms.yawn===0&&!ms.status)giveStatus(b,s,"slp",events,"Yawn");}
        // Campo Real cura os aliados
        if(side.field.royal>0)heal(b,s,Math.max(1,Math.floor(ms.maxHp/16)),events,"Campo Real");
        // ability de fim de turno
        const A=mon.abil;
        A.endTurn.stages.forEach(st=>addStage(b,s,st.stat,st.n,events,{src:A.name,cap:st.cap}));
        if(A.endTurn.healPct)heal(b,s,Math.max(1,Math.floor(ms.maxHp*A.endTurn.healPct/100)),events,A.name);
        lowHpCheck(b,s,events);
      }
      // Perish Song, Wish e contadores
      for(const s of order){
        const ms=activeState(b,s),side=b.sides[s];
        if(!ms.fainted&&ms.perish>0){ms.perish--;events.push({k:"info",text:`${activeMon(b,s).name}: contagem da Perish Song ${ms.perish}.`});if(ms.perish===0){ms.hp=0;checkFaint(b,s,events);}}
        if(side.wish){side.wish.turns--;if(side.wish.turns<=0){if(!ms.fainted){events.push({k:"info",text:"O desejo se realizou!"});heal(b,s,side.wish.amount,events,"Wish");}side.wish=null;}}
        if(ms.taunt>0){ms.taunt--;if(!ms.taunt)events.push({k:"info",text:`${activeMon(b,s).name} não está mais provocado.`});}
        if(ms.encore){ms.encore.n--;if(ms.encore.n<=0)ms.encore=null;}
        if(ms.disable){ms.disable.n--;if(ms.disable.n<=0)ms.disable=null;}
        for(const f of ["reflect","light","veil","tailwind"])if(side.field[f]>0){side.field[f]--;if(!side.field[f])events.push({k:"info",text:`${{reflect:"Reflect",light:"Light Screen",veil:"Aurora Veil",tailwind:"O vento a favor"}[f]} acabou para o time de ${side.name}.`});}
      }
      if(b.trickRoom>0){b.trickRoom--;if(!b.trickRoom)events.push({k:"info",text:"As dimensões voltaram ao normal."});}
      // durações
      for(const s of ["p1","p2"]){
        const side=b.sides[s];
        side.team.forEach(ms=>{
          ms.stages=ms.stages.filter(x=>{if(x.rounds==null)return true;x.rounds--;return x.rounds>0;});
          ms.used.lowHpNow=false;ms.hurt={phys:0,spec:0,any:false};ms.flinch=false;
        });
        const ms=activeState(b,s);
        if(ms.swagger>0){ms.swagger--;if(ms.swagger===0&&!ms.fainted)events.push({k:"info",text:`${activeMon(b,s).name} saiu do Swagger Mode.`});}
        if(side.field.royal>0){side.field.royal--;if(side.field.royal===0)events.push({k:"field",side:s,kind:"royal",turns:0,end:true});}
        side.faintedLastTurn=!!side.faintedThisTurn;side.faintedThisTurn=false;
      }
      if(b.weather){b.weather.turns--;if(b.weather.turns<=0){events.push({k:"weather",kind:b.weather.kind,turns:0,end:true});b.weather=null;for(const x of ["p1","p2"])paradoxCheck(b,x,events);}}
    }

    /* Resolve o turno (ou a troca obrigatória) com as ações pendentes. */
    function resolve(b){
      const events=[];
      const P={p1:b.sides.p1.pending,p2:b.sides.p2.pending};
      for(const s of ["p1","p2"])if(P[s]?.kind==="forfeit"){
        b.phase="end";b.winner=other(s);b.reason="forfeit";events.push({k:"forfeit",side:s},{k:"end",winner:b.winner});
        b.sides.p1.pending=b.sides.p2.pending=null;b.events=events;return events;
      }
      if(b.phase==="switch"){
        for(const s of ["p1","p2"])if(b.sides[s].needSwitch&&P[s]?.kind==="switch")applySwitch(b,s,P[s].idx,events);
        b.sides.p1.pending=b.sides.p2.pending=null;
        if(!finish(b,events)){
          const needs=["p1","p2"].filter(s=>activeState(b,s).fainted);
          needs.forEach(s=>{b.sides[s].needSwitch=true;});
          b.phase=needs.length?"switch":"choose";
        }
        b.events=events;return events;
      }
      const ties={p1:rand(),p2:rand()};
      // ações forçadas: recarga, segundo turno de Fly/Dig/Solar Beam e Encore
      for(const s of ["p1","p2"]){
        const ms=activeState(b,s),a=P[s];if(!a||ms.fainted)continue;
        if(ms.recharge)P[s]={kind:"recharge"};
        else if(ms.charge)P[s]={kind:"move",idx:ms.charge.idx,react:false};
        else if(a.kind==="move"&&ms.encore&&activeMon(b,s).moves[ms.encore.idx])P[s]={...a,idx:ms.encore.idx};
      }
      for(const s of ["p1","p2"])if(P[s]?.kind==="recharge"){activeState(b,s).recharge=false;events.push({k:"cant",side:s,mon:activeMon(b,s).name,reason:"recharge"});}
      for(const s of ["p1","p2"])if(P[s]?.kind==="switch")applySwitch(b,s,P[s].idx,events);
      for(const s of ["p1","p2"])if(P[s]?.kind==="item")useItem(b,s,P[s],events);
      const ctx={protected:new Set(),acted:new Set(),evade:{},z:new Set(),P,selfKO:new Set(),endure:new Set()};
      // gimmicks antes dos golpes (mais rápido primeiro)
      for(const s of ["p1","p2"].sort((x,y)=>effSpeed(b,y)-effSpeed(b,x)||ties[y]-ties[x])){
        const a=P[s];if(a?.kind!=="move"||!a.gimmick||activeState(b,s).fainted)continue;
        const g=gimmickOptions(b,s);
        if(a.gimmick==="mega"&&g.mega.length)megaEvolve(b,s,a.form,events);
        else if(a.gimmick==="tera"&&g.tera)terastallize(b,s,events);
        else if(a.gimmick==="z"&&g.z)ctx.z.add(s);
      }
      // evasão declarada (Ativa gasta a ação; Reativa vem junto do golpe)
      for(const s of ["p1","p2"]){
        const a=P[s];activeState(b,s).evadedThisTurn=false;
        if(a?.kind==="evade")declareEvade(b,s,"active",events,ctx);
        else if(a?.kind==="move"&&a.react)declareEvade(b,s,"react",events,ctx);
      }
      for(const s of ["p1","p2"]){const ms=activeState(b,s);if(!ms.evadedThisTurn)ms.evadeStreak=0;}
      const order=["p1","p2"].filter(s=>P[s]?.kind==="move").map(s=>{
        const mon=activeMon(b,s),mv=mon.moves[P[s].idx]||{};
        const ms=activeState(b,s);
        const qc=itemOf(b,s)?.quick;const quick=(qc&&d(10000)<=qc*100)||ms.nextFirst;
        if(ms.nextFirst){ms.nextFirst=false;events.push({k:"info",text:`${mon.name} agiu primeiro pela Custap Berry.`});}
        else if(quick)heldSay(b,s,events,"agiu primeiro");
        const slow=!quick&&itemOf(b,s)?.slow;
        return {s,prio:movePriority(mv)+(quick?.5:slow?-.5:0),spe:effSpeed(b,s),tie:ties[s]};
      }).sort((x,y)=>y.prio-x.prio||(b.trickRoom>0?x.spe-y.spe:y.spe-x.spe)||y.tie-x.tie);
      for(const o of order){
        if(b.phase==="end")break;
        if(activeState(b,o.s).eject||ctx.forced?.has(o.s))continue;
        useMove(b,o.s,P[o.s].idx,events,ctx);
        if(ctx.selfKO.has(o.s)){const ms=activeState(b,o.s);if(!ms.fainted){ms.hp=0;checkFaint(b,o.s,events);}ctx.selfKO.delete(o.s);}
        ctx.acted.add(o.s);
      }
      b.sides.p1.pending=b.sides.p2.pending=null;
      if(!finish(b,events)){
        endTurn(b,events);
        if(!finish(b,events)){
          let needs=false;
          for(const s of ["p1","p2"]){
            const ms=activeState(b,s);
            if(ms.fainted){b.sides[s].needSwitch=true;needs=true;}
            else if(ms.eject){ms.eject=false;if(canEject(b,s)){b.sides[s].needSwitch=true;needs=true;events.push({k:"info",text:`${activeMon(b,s).name} vai sair de campo: escolha quem entra.`});}}
          }
          b.phase=needs?"switch":"choose";
          b.turn+=1;
        }
      }
      b.events=events;
      return events;
    }

    /* Saída de um jogador: vitória por W.O. para o outro. */
    function walkover(b,leftSide){
      if(b.phase==="end")return [];
      b.phase="end";b.winner=other(leftSide);b.reason="left";
      return b.events=[{k:"left",side:leftSide},{k:"end",winner:b.winner}];
    }

    /* Resumo do lado para a tela (estágios do ativo, status, campo) */
    function view(b,s){
      const side=b.sides[s],ms=activeState(b,s);
      const stg={};STAT_KEYS.forEach(k=>{const v=stageTotal(ms,k);if(v)stg[k]=v;});
      return {stg,cnf:ms.cnf>0,crit:ms.crit||0,swagger:ms.swagger>0,field:{...side.field},hazards:{...side.hazards},gim:{...side.gim},items:side.items,evadeStreak:ms.evadeStreak||0,lock:itemOf(b,s)?.choiceLock?ms.lock:null,itemGone:!!ms.itemGone,
        semi:ms.semi||null,forced:ms.recharge?"recharge":ms.charge?ms.charge.name:null,forcedIdx:ms.charge?ms.charge.idx:null,sub:ms.sub||0,perish:ms.perish>0?ms.perish:0,
        cursed:!!ms.cursed,seeded:!!ms.seeded,taunt:ms.taunt||0,encore:ms.encore?ms.encore.idx:null,disable:ms.disable?ms.disable.idx:null,yawn:ms.yawn||0,trick:b.trickRoom||0};
    }

    return {newBattle,submit,resolve,walkover,canAct,movePriority,activeMon,activeState,view,stageTotal,effStat,gimmickOptions,zMoveOk,zPower};
  }

  const api={create,movePriority};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.hhArenaEngine=api;
})(typeof window!=="undefined"?window:globalThis);
