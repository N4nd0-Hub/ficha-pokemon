/* ============================================================
   V7 — Arena Online: motor de batalha
   Resolve os turnos de uma batalha 1 contra 1 (até 6 Pokémon por
   lado) com as regras da ficha:
   • ordem: trocas → prioridade → Speed (empate no dado);
   • acerto: 1d100 ≤ precisão; 01–05 é Crítico Natural
     (acerta sempre, dados de Power no máximo, ignora 1 dado de defesa);
   • dano: dados de Power (1d6–6d6) + dados de Attack/Sp.Atk + STAB (+1d6);
     super efetivo +1d6 e metade da defesa (4×: +2d6 e sem defesa);
     resistido perde metade do bônus e −1d6 (¼×: sem bônus e −2d6);
     imune: 0. A defesa (Defense/Sp.Def) tira dados; nunca abaixo de 1d6;
   • Protect/Detect bloqueiam o turno; golpes de cura recuperam 50%.
   Não depende da tela: recebe as funções de regra por injeção, e o
   anfitrião da batalha é quem chama resolveTurn/applySwitch.
   ============================================================ */
(function(root){
  "use strict";

  const PRIORITY={
    "extreme speed":2,"first impression":2,"feint":2,"fake out":3,"upper hand":3,"quick guard":3,"wide guard":3,
    "protect":4,"detect":4,"endure":4,"spiky shield":4,"king's shield":4,"baneful bunker":4,"silk trap":4,"burning bulwark":4,"obstruct":4,
    "quick attack":1,"aqua jet":1,"mach punch":1,"bullet punch":1,"ice shard":1,"shadow sneak":1,"sucker punch":1,"accelerock":1,
    "jet punch":1,"vacuum wave":1,"water shuriken":1,"grassy glide":1,"thunderclap":1,"zippy zap":2,
    "counter":-5,"mirror coat":-5,"revenge":-4,"avalanche":-4,"focus punch":-3,"roar":-6,"whirlwind":-6,"trick room":-7,"reflected force":-4
  };
  const PROTECT=new Set(["protect","detect","spiky shield","king's shield","baneful bunker","silk trap","burning bulwark","obstruct"]);
  const HEAL=new Set(["recover","roost","soft-boiled","slack off","synthesis","moonlight","morning sun","milk drink","heal order","shore up","rest","cpr","lunar blessing"]);
  const key=s=>String(s||"").toLowerCase().replace(/[^a-z0-9' -]/g,"").trim();

  function movePriority(move){
    const m=String(move?.desc||move?.description||"").match(/prioridade\s*([+\-−])\s*(\d)/i);
    if(m)return (m[1]==="+"?1:-1)*Number(m[2]);
    return PRIORITY[key(move?.name)]||0;
  }

  function create(rules){
    const rand=rules.rand||Math.random;
    const d=(n)=>1+Math.floor(rand()*n);
    const rollD6=n=>Array.from({length:Math.max(0,n)},()=>d(6));
    const powerDice=p=>{const t=rules.powerToDice(p);const m=/^(\d+)d6$/.exec(String(t));return m?Number(m[1]):0;};

    function newBattle({id,format,p1,p2}){
      const side=(info)=>({id:info.id,name:info.name,active:0,needSwitch:false,pending:null,
        team:info.team.map(m=>({hp:Math.max(1,Number(m.maxHp||m.stats?.hp||1)),maxHp:Math.max(1,Number(m.maxHp||m.stats?.hp||1)),fainted:false}))});
      return {id,format,turn:1,phase:"choose",winner:null,reason:"",sides:{p1:side(p1),p2:side(p2)},teams:{p1:p1.team,p2:p2.team},events:[]};
    }
    const other=s=>s==="p1"?"p2":"p1";
    const activeMon=(b,s)=>b.teams[s][b.sides[s].active];
    const activeState=(b,s)=>b.sides[s].team[b.sides[s].active];
    const alive=(b,s)=>b.sides[s].team.some(m=>!m.fainted);

    function canAct(b,s){
      const side=b.sides[s];
      if(b.phase==="end")return false;
      if(b.phase==="switch")return side.needSwitch&&!side.pending;
      return !side.pending;
    }
    /* Registra a ação de um lado. Devolve true quando o turno pode ser resolvido. */
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

    function damage(b,atkSide,move,ev){
      const defSide=other(atkSide);
      const A=activeMon(b,atkSide),D=activeMon(b,defSide);
      const cat=String(move.category||"").toLowerCase();
      const physical=cat==="physical";
      const atkTypes=(A.types||[]).map(rules.normalizeType).filter(Boolean);
      const defTypes=[...new Set((D.types||[]).map(rules.normalizeType).filter(Boolean))];
      const mtype=rules.normalizeType(move.type)||"Normal";
      const mult=defTypes.length?rules.typeMultiplier(mtype,defTypes):1;
      ev.mult=mult;
      if(mult===0){ev.amount=0;ev.immune=true;return 0;}
      let base=powerDice(Number(move.power||0)||(cat==="status"?0:60));
      const bonusStat=rules.statDice(Number(A.stats?.[physical?"atk":"spa"]||0));
      let bonusDice=bonusStat.dice+(atkTypes.includes(mtype)?1:0),fixed=bonusStat.fixed;
      ev.stab=atkTypes.includes(mtype);
      let add=0,pen=0;
      if(mult>=4)add=2;else if(mult>=2)add=1;
      else if(mult<=.25){bonusDice=0;fixed=0;pen=2;}
      else if(mult<=.5){bonusDice=Math.floor(bonusDice/2);pen=1;}
      const def=rules.statDice(Number(D.stats?.[physical?"def":"spd"]||0));
      let defDice=def.dice,defFixed=def.fixed;
      if(mult>=4){defDice=0;defFixed=0;}else if(mult>=2){defDice=Math.floor(defDice/2);defFixed=Math.floor(defFixed/2);}
      let critFixed=0;
      if(ev.crit){critFixed=base*6;base=0;defDice=Math.max(0,defDice-1);}
      let dice=Math.max(0,base+bonusDice+add-pen-defDice);
      if(dice<=0&&!critFixed)dice=1;
      const rolls=rollD6(dice);
      const total=Math.max(1,rolls.reduce((a,v)=>a+v,0)+fixed+critFixed-defFixed);
      Object.assign(ev,{dice,rolls,fixed:fixed+critFixed-defFixed,amount:total});
      return total;
    }

    function useMove(b,s,idx,events,protectedSides){
      const A=activeMon(b,s),aState=activeState(b,s);
      if(aState.fainted)return;
      const tSide=other(s),tState=activeState(b,tSide);
      const move=A.moves[idx]||{name:"Struggle",type:"Normal",category:"Physical",power:50,accuracy:null};
      const k=key(move.name);
      const ev={k:"move",side:s,mon:A.name,move:move.name,type:move.type,category:move.category};
      events.push(ev);
      if(PROTECT.has(k)){protectedSides.add(s);ev.protect=true;return;}
      if(HEAL.has(k)){
        const before=aState.hp;aState.hp=Math.min(aState.maxHp,aState.hp+Math.ceil(aState.maxHp/2));
        events.push({k:"heal",side:s,amount:aState.hp-before,hp:aState.hp});return;
      }
      if(String(move.category||"").toLowerCase()==="status"){ev.status=true;ev.desc=String(move.desc||"").slice(0,160);return;}
      if(tState.fainted){ev.noTarget=true;return;}
      if(protectedSides.has(tSide)){events.push({k:"blocked",side:tSide});return;}
      const roll=d(100);
      const acc=move.accuracy==null||move.alwaysHits?null:Math.min(100,Number(move.accuracy)||100);
      ev.roll=roll;ev.acc=acc;
      ev.crit=roll<=5;
      if(!ev.crit&&acc!=null&&roll>acc){ev.miss=true;return;}
      const hit={k:"hit",side:tSide,crit:ev.crit};
      const amount=damage(b,s,move,hit);
      tState.hp=Math.max(0,tState.hp-amount);hit.hp=tState.hp;
      events.push(hit);
      if(tState.hp<=0){tState.fainted=true;events.push({k:"faint",side:tSide,mon:activeMon(b,tSide).name});}
    }

    function applySwitch(b,s,idx,events){
      const side=b.sides[s];
      const from=activeMon(b,s).name;side.active=idx;side.needSwitch=false;
      events.push({k:"switch",side:s,from,to:activeMon(b,s).name,hp:activeState(b,s).hp});
    }

    function finish(b,events){
      for(const s of ["p1","p2"]){
        if(!alive(b,s)){b.phase="end";b.winner=other(s);b.reason="ko";events.push({k:"end",winner:b.winner});return true;}
      }
      return false;
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
        b.phase="choose";b.events=events;return events;
      }
      for(const s of ["p1","p2"])if(P[s]?.kind==="switch")applySwitch(b,s,P[s].idx,events);
      const order=["p1","p2"].filter(s=>P[s]?.kind==="move").map(s=>{
        const mon=activeMon(b,s),mv=mon.moves[P[s].idx]||{};
        return {s,prio:movePriority(mv),spe:Number(mon.stats?.spe||0),tie:rand()};
      }).sort((x,y)=>y.prio-x.prio||y.spe-x.spe||y.tie-x.tie);
      const protectedSides=new Set();
      for(const o of order)useMove(b,o.s,P[o.s].idx,events,protectedSides);
      b.sides.p1.pending=b.sides.p2.pending=null;
      if(!finish(b,events)){
        let needs=false;
        for(const s of ["p1","p2"])if(activeState(b,s).fainted){b.sides[s].needSwitch=true;needs=true;}
        b.phase=needs?"switch":"choose";
        b.turn+=1;
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

    return {newBattle,submit,resolve,walkover,canAct,movePriority,activeMon,activeState};
  }

  const api={create,movePriority};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.hhArenaEngine=api;
})(typeof window!=="undefined"?window:globalThis);
