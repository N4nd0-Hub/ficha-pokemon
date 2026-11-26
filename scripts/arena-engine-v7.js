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
   • efeitos dos textos de golpes e abilities lidos por arena-rules-v7.js.
   Não depende da tela: recebe as funções de regra por injeção.
   ============================================================ */
(function(root){
  "use strict";
  const RULES=(typeof module!=="undefined"&&module.exports)?require("./arena-rules-v7.js"):root.hhArenaRules;
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
      return {...m,moves,abil:RULES.parseAbility(m.ability||"",m.abilityText||"")};
    }
    function monState(m){
      const hp=Math.max(1,Number(m.maxHp||m.stats?.hp||1));
      return {hp,maxHp:hp,fainted:false,status:null,slp:0,tox:0,cnf:0,stages:[],persist:{},crit:0,
        flinch:false,enteredTurn:1,lastMove:"",lastType:"",fury:0,swagger:0,nextPhys:0,nextDouble:null,nextHalf:false,
        hurt:{phys:0,spec:0,any:false},used:{},protectStreak:0,abilStages:[]};
    }
    function newBattle({id,format,p1,p2}){
      const side=(info)=>({id:info.id,name:info.name,active:0,needSwitch:false,pending:null,hazards:{tspikes:0},field:{},faintedLastTurn:false,
        team:info.team.map(monState)});
      const b={id,format,turn:1,phase:"choose",winner:null,reason:"",weather:null,
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
      if(stat==="spe"){
        if(ms.status==="par")v=Math.floor(v/2);
        if(b.weather&&m.abil.weatherSpeed===b.weather.kind)v*=2;
      }
      return v;
    }
    function effSpeed(b,s){return effStat(b,s,"spe");}
    /* aplica um estágio respeitando limites, imunidades e duração da ficha */
    function addStage(b,s,stat,n,events,{src="",cap=null,rounds,persist=false,fromFoe=false,monIdx}={}){
      const side=b.sides[s],idx=monIdx??side.active,ms=side.team[idx],mon=b.teams[s][idx];
      if(!n||ms.fainted)return 0;
      if(stat==="all"){let t=0;for(const x of ["atk","def","spa","spd","spe"])t+=addStage(b,s,x,n,events,{src,cap,rounds,persist,fromFoe,monIdx});return t;}
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
      return true;
    }

    /* ---------- Entrada em campo ---------- */
    function setWeather(b,kind,turns,events,src){
      if(b.weather&&b.weather.kind===kind){b.weather.turns=Math.max(b.weather.turns,turns);}
      else b.weather={kind,turns};
      events.push({k:"weather",kind,turns,src});
    }
    function onEnter(b,s,events,start){
      const side=b.sides[s],ms=activeState(b,s),mon=activeMon(b,s),A=mon.abil,foe=other(s);
      ms.enteredTurn=start?1:(b.phase==="switch"?b.turn:b.turn+1);
      // Toxic Spikes
      if(side.hazards.tspikes>0){
        const t=typesOf(b,s);
        if(t.includes("Poison")){side.hazards.tspikes=0;events.push({k:"hazard",side:s,kind:"tspikes",layers:0,cleared:true,mon:mon.name});}
        else if(!t.includes("Flying")&&!t.includes("Steel"))giveStatus(b,s,side.hazards.tspikes>=2?"tox":"psn",events,"Toxic Spikes");
      }
      // Campo Real do outro lado: −1 Speed em quem entra
      if(!start&&b.sides[foe].field.royal>0)addStage(b,s,"spe",-1,events,{src:"Campo Real",fromFoe:true});
      const shown=[];
      const say=()=>{if(!shown.length){shown.push(1);events.push({k:"ability",side:s,mon:mon.name,name:A.name});}};
      if(A.onEnter.weather){say();setWeather(b,A.onEnter.weather.kind,A.onEnter.weather.turns,events,A.name);}
      if(A.onEnter.field?.kind==="royal"){say();side.field.royal=A.onEnter.field.turns;side.field.royalOwner=side.active;events.push({k:"field",side:s,kind:"royal",turns:side.field.royal});
        if(!activeState(b,foe).fainted)addStage(b,foe,"spe",-1,events,{src:"Campo Real",fromFoe:true});}
      for(const st of A.onEnter.stages){
        say();
        if(st.who==="self")addStage(b,s,st.stat,st.n,events,{src:A.name,cap:st.cap});
        else if(st.who==="foe"){
          const F=abil(b,foe);
          if(F.immune.intimidate&&st.n<0){events.push({k:"stage",side:foe,mon:activeMon(b,foe).name,stat:st.stat,n:st.n,applied:0,blocked:true,total:stageTotal(activeState(b,foe),st.stat),src:F.name});}
          else if(!activeState(b,foe).fainted)addStage(b,foe,st.stat,st.n,events,{src:A.name,fromFoe:true,rounds:st.rounds});
        }else if(st.who==="team"){
          side.team.forEach((t,i)=>{if(!t.fainted)addStage(b,s,st.stat,st.n,events,{src:A.name,cap:st.cap??3,persist:true,monIdx:i});});
          events.push({k:"info",text:`${mon.name} inspirou o time: +${st.n} de ${RULES.STAT_LABEL[st.stat]} para todos (máx. +${st.cap??3}).`});
        }
      }
      if(A.onEnter.foeAccFirstTurn&&!activeState(b,foe).fainted){say();addStage(b,foe,"acc",A.onEnter.foeAccFirstTurn,events,{src:A.name,fromFoe:true,rounds:1});}
    }
    function resetVolatile(ms){
      ms.stages=[];ms.cnf=0;ms.crit=0;ms.flinch=false;ms.fury=0;ms.swagger=0;ms.protectStreak=0;ms.abilStages=[];ms.nextDouble=null;ms.nextHalf=false;
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
      }else if(action.kind==="move"){
        if(b.phase==="switch")return false;
        const mon=activeMon(b,s);if(!mon?.moves?.[action.idx]&&action.idx!==-1)return false;
      }else return false;
      side.pending=action;
      if(b.phase==="switch")return ["p1","p2"].every(x=>!b.sides[x].needSwitch||b.sides[x].pending);
      return !!(b.sides.p1.pending&&b.sides.p2.pending);
    }

    /* ---------- Dano ---------- */
    function typeMult(b,atkSide,mtype){
      const defTypes=typesOf(b,other(atkSide));
      let mult=defTypes.length?rules.typeMultiplier(mtype,defTypes):1;
      if(abil(b,other(atkSide)).immune.types.has(mtype))mult=0;
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
      const stab=atkTypes.includes(mtype);
      let bonusDice=bonusStat.dice+(stab?1:0),fixed=bonusStat.fixed;
      ev.stab=stab;
      let add=0,pen=0;const notes=[];
      if(mult>=4)add=2;else if(mult>=2)add=1;
      else if(mult<=.25){bonusDice=0;fixed=0;pen=2;}
      else if(mult<=.5){bonusDice=Math.floor(bonusDice/2);pen=1;}
      // clima
      if(b.weather){
        const w=b.weather.kind;
        if((w==="rain"&&mtype==="Water")||(w==="sun"&&mtype==="Fire")){add+=1;notes.push(RULES.WEATHER_LABEL[w]+" +1d6");}
        if((w==="rain"&&mtype==="Fire")||(w==="sun"&&mtype==="Water")){pen+=1;notes.push(RULES.WEATHER_LABEL[w]+" −1d6");}
        for(const wb of A.abil.weatherBoost)if(wb.weather===w&&(!wb.types?.length||wb.types.includes(mtype))){add+=wb.dice;notes.push(`${A.abil.name} +${wb.dice}d6`);}
      }
      // abilities e efeitos do atacante
      if(A.abil.pinch===mtype&&aS.hp*3<=aS.maxHp){add+=1;notes.push(`${A.abil.name} +1d6`);}
      if(A.abil.royal&&b.sides[atkSide].field.royal>0&&(mtype==="Bug"||mtype==="Fairy")){add+=1;notes.push("Campo Real +1d6");}
      if(physical&&aS.nextPhys){add+=aS.nextPhys;notes.push(`${A.abil.name} +${aS.nextPhys}d6`);aS.nextPhys=0;}
      if(physical&&aS.swagger>0){add+=A.abil.critMode?.physDice||1;notes.push("Swagger Mode +1d6");}
      if(physical&&A.abil.aerial&&aS.lastType==="Flying"){add+=1;notes.push(`${A.abil.name} +1d6`);}
      if(physical&&(aS.status==="brn")&&!A.abil.guts){pen+=1;notes.push("Burn −1d6");}
      if(physical&&A.abil.guts&&aS.status){add+=1;notes.push("Guts +1d6");}
      // abilities do defensor
      for(const t of D.abil.dmgTaken)if((!t.type||t.type===mtype)&&(!t.fullHp||dS.hp>=dS.maxHp)){pen-=t.dice;notes.push(`${D.abil.name} ${t.dice}d6`);}
      const def=rules.statDice(effStat(b,defSide,physical?"def":"spd"));
      let defDice=def.dice,defFixed=def.fixed;
      if(mult>=4){defDice=0;defFixed=0;}else if(mult>=2){defDice=Math.floor(defDice/2);defFixed=Math.floor(defFixed/2);}
      let critFixed=0;
      if(crit){critFixed=base*(critKind==="natural"?6:4);base=0;if(critKind==="natural")defDice=Math.max(0,defDice-1);}
      let dice=Math.max(0,base+bonusDice+add-pen-defDice);
      if(dice<=0&&!critFixed)dice=1;
      const rolls=roll(dice);
      let total=Math.max(1,sum(rolls)+fixed+critFixed-defFixed);
      if(physical&&aS.status==="dbrn"){total=Math.max(1,Math.floor(total/2));notes.push("Deep Burn ½");}
      if(aS.nextDouble&&(aS.nextDouble==="any"||aS.nextDouble===cat)){total*=2;notes.push("dano dobrado");aS.nextDouble=null;}
      if(dS.nextHalf){total=Math.max(1,Math.floor(total/2));notes.push("defesa reforçada ½");dS.nextHalf=false;}
      ev.dice=(ev.dice||0)+dice;ev.rolls=[...(ev.rolls||[]),...rolls];ev.fixed=(ev.fixed||0)+fixed+critFixed-defFixed;
      if(notes.length)ev.notes=[...new Set([...(ev.notes||[]),...notes])];
      return total;
    }

    function hpEvent(events,k,s,b,amount,src){const ms=activeState(b,s);events.push({k,side:s,mon:activeMon(b,s).name,amount,hp:ms.hp,src});}
    function heal(b,s,amount,events,src){
      const ms=activeState(b,s);if(ms.fainted||amount<=0)return 0;
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
      return 5+5*Math.max(0,(move.fx?.critStage||0)+(activeState(b,s).crit||0));
    }

    /* ---------- Usar um golpe ---------- */
    function useMove(b,s,idx,events,ctx){
      const A=activeMon(b,s),aS=activeState(b,s);
      if(aS.fainted)return;
      const tSide=other(s);
      const move=A.moves[idx]||{name:"Struggle",type:"Normal",category:"Physical",power:50,accuracy:null,fx:RULES.parseMove({name:"Struggle",category:"Physical"})};
      const fx=move.fx;
      const cat=String(move.category||"").toLowerCase();
      const k=key(move.name);
      // pode agir?
      if(aS.status==="slp"){
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
      events.push(ev);
      const prevMove=aS.lastMove;aS.lastMove=k;
      const prevType=aS.lastType;aS.lastType=normT(move.type);
      // falhas de condição
      if(fx.firstTurnOnly&&aS.enteredTurn!==b.turn){ev.fail=true;ev.why="só funciona no primeiro turno em campo";aS.lastType=prevType;return;}
      if(fx.protect){
        const ok=prevMove&&A.moves.some(m=>key(m.name)===prevMove&&m.fx.protect)?d(3)===1:true;
        if(ok){ctx.protected.add(s);ev.protect=true;aS.protectStreak++;}else{ev.fail=true;ev.why="falhou (uso seguido)";}
        return;
      }
      const tS=activeState(b,tSide),T=activeMon(b,tSide);
      const affectsFoe=fx.stages.some(x=>x.who==="foe")||fx.status.some(x=>x.who==="foe")||cat!=="status";
      if(affectsFoe&&ctx.protected.has(tSide)&&cat!=="status"){events.push({k:"blocked",side:tSide});return;}
      if(fx.powder&&(typesOf(b,tSide).includes("Grass")||abil(b,tSide).immune.powder)){events.push({k:"cant",side:tSide,mon:T.name,reason:"powder",src:abil(b,tSide).immune.powder?abil(b,tSide).name:"Grass"});return;}

      // golpes de status
      if(cat==="status"){
        if(affectsFoe&&!tS.fainted&&move.accuracy!=null&&!move.alwaysHits&&!fx.neverMiss&&(fx.stages.some(x=>x.who==="foe")||fx.status.some(x=>x.who==="foe"))){
          const acc=accuracyFor(b,s,move);const r=d(100);ev.roll=r;ev.acc=acc;
          if(r>acc&&r>5){ev.miss=true;return;}
        }
        if(ctx.protected.has(tSide)&&affectsFoe){events.push({k:"blocked",side:tSide});return;}
        applySecondary(b,s,move,events,{hit:true,status:true});
        if(fx.heal)heal(b,s,Math.ceil(aS.maxHp*fx.heal/100),events,move.name);
        if(fx.rest){aS.status="slp";aS.slp=2;heal(b,s,aS.maxHp,events,move.name);events.push({k:"status",side:s,mon:A.name,st:"slp",src:move.name});}
        if(fx.selfCrit){aS.crit+=fx.selfCrit;events.push({k:"info",text:`${A.name} se concentrou: crítico aumentado em ${fx.selfCrit} estágio${fx.selfCrit>1?"s":""}.`});}
        if(fx.weather)setWeather(b,fx.weather.kind,fx.weather.turns,events,move.name);
        if(fx.hazard==="tspikes"){const h=b.sides[tSide].hazards;h.tspikes=Math.min(2,h.tspikes+1);events.push({k:"hazard",side:tSide,kind:"tspikes",layers:h.tspikes});}
        if(fx.haze){for(const x of ["p1","p2"]){activeState(b,x).stages=[];}events.push({k:"info",text:"Todos os estágios foram zerados."});}
        if(fx.nextDouble){aS.nextDouble=fx.nextDouble;events.push({k:"info",text:`O próximo golpe ${fx.nextDouble==="physical"?"físico ":fx.nextDouble==="special"?"especial ":""}de ${A.name} causa o dobro do dano.`});}
        if(fx.nextHalf){aS.nextHalf=true;events.push({k:"info",text:`O próximo dano que ${A.name} receber cai pela metade.`});}
        // Campo Real
        const side=b.sides[s];
        if(fx.field==="royal"){
          if(side.field.royal>0){side.field.royal+=2;events.push({k:"field",side:s,kind:"royal",turns:side.field.royal,extended:true});}
          else{side.field.royal=3;events.push({k:"field",side:s,kind:"royal",turns:3});if(!tS.fainted)addStage(b,tSide,"spe",-1,events,{src:"Campo Real",fromFoe:true});}
          heal(b,s,sum(roll(1)),events,"Royal Command");
        }else if(A.abil.royal&&side.field.royal>0&&k==="quiver dance"){side.field.royal+=2;events.push({k:"field",side:s,kind:"royal",turns:side.field.royal,extended:true});}
        if(!fx.stages.length&&!fx.status.length&&!fx.heal&&!fx.rest&&!fx.selfCrit&&!fx.weather&&!fx.hazard&&!fx.haze&&!fx.field&&!fx.nextDouble&&!fx.nextHalf&&!(A.abil.royal&&k==="quiver dance")){
          ev.status=true;ev.desc=String(move.desc||"").slice(0,160);
        }
        return;
      }

      if(tS.fainted){ev.noTarget=true;return;}
      // precisão e crítico
      const r=d(100);
      const acc=move.accuracy==null||move.alwaysHits||fx.neverMiss?null:accuracyFor(b,s,move);
      ev.roll=r;ev.acc=acc;
      const natural=r<=5;
      const crit=natural||(r<=critMargin(b,s,move)&&(acc==null||r<=acc));
      ev.crit=crit;ev.critKind=natural?"natural":crit?"boosted":"";
      if(!crit&&acc!=null&&r>acc){
        ev.miss=true;aS.fury=0;
        if(A.abil.keepOnMiss&&aS.abilStages.length){aS.stages=aS.stages.filter(x=>!aS.abilStages.includes(x));aS.abilStages=[];events.push({k:"info",text:`${A.name} errou e perdeu o embalo da ${A.abil.name}.`});}
        return;
      }
      // Power
      let power=Number(move.power||0);
      if(fx.counter){
        const got=fx.counter==="physical"?aS.hurt.phys:fx.counter==="special"?aS.hurt.spec:(aS.hurt.phys+aS.hurt.spec);
        if(!got){ev.fail=true;ev.why="não recebeu dano para devolver";return;}
        const amount=got*2;const hit={k:"hit",side:tSide,crit:false,mult:1,amount,fixed:amount,dice:0,rolls:[],notes:["devolveu o dobro"]};
        tS.hp=Math.max(0,tS.hp-amount);hit.hp=tS.hp;events.push(hit);afterHit(b,s,move,events,hit,amount,ctx);return;
      }
      if(!power)power=60;
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
      if(fx.hits)hits=A.abil.maxHits?fx.hits.max:fx.hits.min+Math.floor(rand()*(fx.hits.max-fx.hits.min+1));
      const hit={k:"hit",side:tSide,crit};
      let amount=0;
      for(let i=0;i<hits;i++)amount+=damage(b,s,move,hit,{crit,critKind:ev.critKind,power});
      if(hits>1)hit.hits=hits;
      if(hit.immune){hit.amount=0;hit.hp=tS.hp;events.push(hit);
        const ab=abil(b,tSide);const mt=normT(move.type);
        if(ab.absorb?.[mt])heal(b,tSide,Math.ceil(tS.maxHp*ab.absorb[mt]/100),events,ab.name);
        return;}
      if(fx.falseSwipe&&amount>=tS.hp)amount=Math.max(0,tS.hp-1);
      if(abil(b,tSide).sturdy&&tS.hp>=tS.maxHp&&amount>=tS.hp){amount=tS.hp-1;hit.notes=[...(hit.notes||[]),abil(b,tSide).name];}
      hit.amount=amount;
      tS.hp=Math.max(0,tS.hp-amount);hit.hp=tS.hp;
      events.push(hit);
      afterHit(b,s,move,events,hit,amount,ctx);
    }
    function accuracyFor(b,s,move){
      const base=Math.max(1,Math.min(100,Number(move.accuracy)||100));
      const net=Math.max(-6,Math.min(6,stageTotal(activeState(b,s),"acc")-stageTotal(activeState(b,other(s)),"eva")));
      return Math.max(1,Math.min(90,Math.floor(base*stageMult("acc",net))));
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
        else heal(b,s,Math.max(1,Math.floor(amount*fx.drain/100)),events,move.name);
      }
      const fainted=checkFaint(b,tSide,events);
      if(fx.recoil&&amount>0)hurt(b,s,Math.max(1,Math.floor(amount*fx.recoil/100)),events,"recoil");
      // efeitos secundários
      let flinched=false;
      if(!fainted){
        applySecondary(b,s,move,events,{hit:true});
        if(fx.flinch&&!ctx.acted.has(tSide)&&!abil(b,tSide).immune.flinch&&chance(fx.flinch)){tS.flinch=true;flinched=true;}
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
      // contato contra ability do alvo (Static, Toxic Shell…)
      if(physical&&amount>0&&!aS.fainted){
        for(const o of abil(b,tSide).onHurtContact){
          if(chance(o.chance)){events.push({k:"ability",side:tSide,mon:T.name,name:abil(b,tSide).name});giveStatus(b,s,o.st,events,abil(b,tSide).name);}
        }
      }
    }
    /* estágios e status do texto do golpe */
    function applySecondary(b,s,move,events){
      const fx=move.fx,tSide=other(s);
      const rollFor=new Map();// mesma chance = mesma rolagem (ex.: "10% de reduzir Sp.Def")
      const happens=c=>{if(c>=100)return true;if(!rollFor.has(c))rollFor.set(c,d(100)<=c);return rollFor.get(c);};
      for(const st of fx.stages){
        if(!happens(st.chance??100))continue;
        if(st.who==="foe"){if(!activeState(b,tSide).fainted)addStage(b,tSide,st.stat,st.n,events,{src:move.name,fromFoe:true,cap:st.cap});}
        else addStage(b,s,st.stat,st.n,events,{src:move.name,cap:st.cap});
      }
      for(const st of fx.status){
        if(!happens(st.chance??100))continue;
        const target=st.who==="self"?s:tSide;
        if(!activeState(b,target).fainted)giveStatus(b,target,st.st,events,move.name);
      }
    }

    function applySwitch(b,s,idx,events){
      const side=b.sides[s];
      const fromMs=activeState(b,s);
      const from=activeMon(b,s).name;resetVolatile(fromMs);
      side.active=idx;side.needSwitch=false;
      events.push({k:"switch",side:s,from,to:activeMon(b,s).name,hp:activeState(b,s).hp});
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
          if(b.weather.kind==="sand"&&!t.some(x=>["Rock","Ground","Steel"].includes(x)))hurt(b,s,sum(roll(1)),events,"sand");
          if(b.weather.kind==="hail"&&!t.includes("Ice"))hurt(b,s,sum(roll(1)),events,"hail");
        }
        if(ms.fainted)continue;
        // Campo Real cura os aliados
        if(side.field.royal>0)heal(b,s,sum(roll(1)),events,"Campo Real");
        // ability de fim de turno
        const A=mon.abil;
        A.endTurn.stages.forEach(st=>addStage(b,s,st.stat,st.n,events,{src:A.name,cap:st.cap}));
        if(A.endTurn.healPct)heal(b,s,Math.max(1,Math.floor(ms.maxHp*A.endTurn.healPct/100)),events,A.name);
        lowHpCheck(b,s,events);
      }
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
      if(b.weather){b.weather.turns--;if(b.weather.turns<=0){events.push({k:"weather",kind:b.weather.kind,turns:0,end:true});b.weather=null;}}
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
      for(const s of ["p1","p2"])if(P[s]?.kind==="switch")applySwitch(b,s,P[s].idx,events);
      const order=["p1","p2"].filter(s=>P[s]?.kind==="move").map(s=>{
        const mon=activeMon(b,s),mv=mon.moves[P[s].idx]||{};
        return {s,prio:movePriority(mv),spe:effSpeed(b,s),tie:ties[s]};
      }).sort((x,y)=>y.prio-x.prio||y.spe-x.spe||y.tie-x.tie);
      const ctx={protected:new Set(),acted:new Set()};
      for(const o of order){
        if(b.phase==="end")break;
        useMove(b,o.s,P[o.s].idx,events,ctx);
        ctx.acted.add(o.s);
      }
      b.sides.p1.pending=b.sides.p2.pending=null;
      if(!finish(b,events)){
        endTurn(b,events);
        if(!finish(b,events)){
          let needs=false;
          for(const s of ["p1","p2"])if(activeState(b,s).fainted){b.sides[s].needSwitch=true;needs=true;}
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
      return {stg,cnf:ms.cnf>0,crit:ms.crit||0,swagger:ms.swagger>0,field:{...side.field},hazards:{...side.hazards}};
    }

    return {newBattle,submit,resolve,walkover,canAct,movePriority,activeMon,activeState,view,stageTotal,effStat};
  }

  const api={create,movePriority};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.hhArenaEngine=api;
})(typeof window!=="undefined"?window:globalThis);
