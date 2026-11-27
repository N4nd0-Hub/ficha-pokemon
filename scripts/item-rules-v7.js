/* ============================================================
   V7 — Leitor de itens
   Entende o efeito de um item (pela automação do catálogo ou pelo texto
   em português no sistema de QD) e devolve:
   • tags: etiquetas curtas para a tela (ícone + texto);
   • battle: o efeito que a Arena aplica quando o Pokémon segura o item.
   Exemplos que ele entende: "golpes Fire do usuário causam +1 dado da
   QD", "recupera 1/16 do HP Máximo ao fim de cada rodada", "Attack ×1,5",
   "crítico aumentado +1 estágio", "consumida ao levar um golpe Fire
   super efetivo; o dano cai pela metade", "ao chegar a 1/2 do HP… cura 1/4".
   Funciona no navegador (window.hhItemRules) e no Node (testes / Arena).
   ============================================================ */
(function(root){
  "use strict";
  const TYPES=["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
  const TYPE_RX="(Normal|Fire|Water|Electric|Grass|Ice|Fighting|Poison|Ground|Flying|Psychic|Bug|Rock|Ghost|Dragon|Dark|Steel|Fairy)";
  const STAT={"attack":"atk","sp.atk":"spa","speed":"spe","defense":"def","sp.def":"spd"};
  const STAT_PT={atk:"Attack",spa:"Sp.Atk",spe:"Speed",def:"Defense",spd:"Sp.Def",acc:"Precisão",eva:"Evasão"};
  const COND={"Envenenado":["psn","tox"],"Queimado":["brn","dbrn"],"Congelado":["frz"],"Dormindo":["slp"],"Paralisado":["par"],"Confuso":["cnf"]};
  const num=s=>Number(String(s).replace(",","."));
  const frac=(n,d)=>Math.max(0,Number(n)||0)/Math.max(1,Number(d)||1);
  const pctLabel=f=>{const p=Math.round(f*10000)/100;return `${String(p).replace(".",",")}%`;};

  function typesIn(s){return TYPES.filter(t=>new RegExp(`\\b${t}\\b`).test(s));}

  function interpret(item){
    const it=typeof item==="string"?{name:item,description:""}:(item||{});
    const name=String(it.name||"");
    const d=String(it.description||it.desc||"");
    const a=it.automation||null;
    const tags=[],battle={};
    const tag=(icon,label,kind)=>tags.push({icon,label,kind});
    const held=/^Segurad[oa]/i.test(d)||/held/.test(String(it.category||""));
    // espécie exigida ("Segurado por Pikachu", "Segurado por Cubone ou Marowak")
    const sp=/Segurad[oa] por ([^:]+?)(?::|\s—)/i.exec(d);
    if(sp)battle.species=sp[1].split(/\s*(?:,|\bou\b|\be\b|\/)\s*/).map(x=>x.trim()).filter(Boolean);

    // ---- automação do catálogo (mais confiável que o texto)
    if(a){
      if(a.trigger==="endRound"&&a.kind==="healFraction"){battle.endHeal=frac(a.num,a.den);tag("💚",`Cura ${pctLabel(battle.endHeal)} do HP por rodada`,"heal");}
      if(a.kind==="blackSludge"){battle.endHeal=1/16;battle.endHealType="Poison";battle.endHurt=1/8;tag("💚","Poison: cura 1/16 por rodada","heal");tag("💔","Outros: perdem 1/8 por rodada","hurt");}
      if(a.kind==="damageFraction"&&a.trigger==="endRound"){battle.endHurt=frac(a.num,a.den);tag("💔",`Perde ${pctLabel(battle.endHurt)} do HP por rodada`,"hurt");}
      if(a.trigger==="hp"){
        const at=frac(a.thresholdNum||1,a.thresholdDen||2);
        const p={at,consume:a.consume!==false};
        if(a.kind==="healThresholdFraction"){p.healFrac=frac(a.num,a.den);tag("🍒",`HP ≤ ${a.thresholdNum||1}/${a.thresholdDen||2}: cura ${pctLabel(p.healFrac)}`,"heal");}
        if(a.kind==="healThresholdFlat"){p.healFlat=Number(a.amount||0);tag("🍒",`HP ≤ ${a.thresholdNum||1}/${a.thresholdDen||2}: cura ${p.healFlat} HP`,"heal");}
        if(a.kind==="stageThreshold"){const st=STAT[String(a.stat||"").toLowerCase()]||a.stat;p.stage={stat:st,n:Number(a.amount||1)};tag("⬆",`HP ≤ ${a.thresholdNum||1}/${a.thresholdDen||4}: +${p.stage.n} ${STAT_PT[st]||st}`,"stage");}
        if(a.kind==="randomStageThreshold"){p.stage={stat:"random",n:Number(a.amount||2)};tag("⬆",`HP baixo: +${p.stage.n} em um atributo aleatório`,"stage");}
        battle.pinch=p;
      }
      if(a.trigger==="condition"||a.kind==="cureCondition"||a.kind==="cureAnyCondition"){
        battle.cure=a.kind==="cureAnyCondition"?"any":(COND[a.condition]||[a.condition]);
        tag("✨",a.kind==="cureAnyCondition"?"Cura qualquer status":`Cura ${a.condition||"status"}`,"cure");
      }
      if(a.kind==="clearNegativeStages"){battle.clearDrops=true;tag("♻","Zera estágios reduzidos","cure");}
      if(a.trigger==="stage"&&a.kind!=="clearNegativeStages"){/* outros gatilhos de estágio: só etiqueta */}
    }

    // ---- texto (sistema de QD)
    let m;
    if(/golpes ofensivos causam \+(\d+) dados? da QD/i.test(d)){battle.allQD=num(RegExp.$1);tag("⚔",`+${battle.allQD} dado da QD em todos os golpes`,"dmg");}
    if((m=/perde 1\/(\d+) \((\d+)%\) do HP Máximo/i.exec(d))&&battle.allQD){battle.recoil=1/num(m[1]);tag("💔",`Perde ${m[2]}% do HP por golpe`,"hurt");}
    if(/super efetivos causam \+(\d+) dados? da QD/i.test(d)){battle.seQD=num(RegExp.$1);tag("💥",`+${battle.seQD} dado da QD em super efetivos`,"dmg");}
    if((m=new RegExp("golpes ((?:"+TYPE_RX.slice(1,-1)+")(?:\\s*(?:,|e)\\s*"+TYPE_RX+")*)(?: do usuário| que causa dano)?[^.]*?causam \\+(\\d+) dados? da QD","i").exec(d))){
      battle.typeQD={types:typesIn(m[1]),n:num(m[m.length-1])};tag("🔥",`+${battle.typeQD.n} dado da QD em golpes ${battle.typeQD.types.join("/")}`,"dmg");}
    if((m=/golpes (Physical|Special) causam \+(\d+) de dano fixo/i.exec(d))){battle.catFlat={cat:m[1].toLowerCase(),n:num(m[2])};tag("➕",`+${m[2]} de dano em golpes ${m[1]}`,"dmg");}
    // multiplicadores de atributo: "Attack ×1,5", "Sp.Def fica em 1.5×", "Defense e Sp.Def ×1,5"
    const mult=/((?:Attack|Sp\.Atk|Speed|Defense|Sp\.Def)(?:\s*(?:e|,)\s*(?:Attack|Sp\.Atk|Speed|Defense|Sp\.Def))*)\s*(?:ficam? em\s*)?×?\s*(\d+(?:[.,]\d+)?)\s*×?(?:\s*do valor normal)?/gi;
    while((m=mult.exec(d))){
      if(!/×/.test(m[0]))continue;
      const x=num(m[2]);if(!(x>0))continue;
      for(const s of m[1].split(/\s+e\s+|\s*,\s*/)){const k=STAT[s.toLowerCase()];if(k){battle.statMult=battle.statMult||{};battle.statMult[k]=x;}}
    }
    if(battle.statMult)tag("📈",Object.entries(battle.statMult).map(([k,x])=>`${STAT_PT[k]} ×${String(x).replace(".",",")}`).join(" · "),"stat");
    if(/Speed pela metade|Speed cai pela metade/i.test(d)){battle.statMult=battle.statMult||{};battle.statMult.spe=.5;tag("🐢","Speed pela metade","stat");}
    if(/fica preso nele/i.test(d)){battle.choiceLock=true;tag("🔒","Preso ao primeiro golpe escolhido","lock");}
    if((m=/crítico aumentado \+(\d+)/i.exec(d))){battle.crit=num(m[1]);tag("🎯",`Crítico +${m[1]} estágio${m[1]>1?"s":""}`,"crit");}
    if((m=/\+(\d+) de Precisão nos golpes/i.exec(d))){battle.acc=num(m[1]);tag("👁",`+${m[1]} de Precisão`,"acc");}
    if((m=/\+(\d+) de Precisão se o usuário agir depois/i.exec(d))){battle.accLate=num(m[1]);tag("👁",`+${m[1]} de Precisão agindo depois`,"acc");}
    if((m=/inimigos têm [−\-](\d+) de Precisão contra o usuário/i.exec(d))){battle.foeAcc=num(m[1]);tag("🌫",`Inimigos −${m[1]} de Precisão`,"acc");}
    if((m=/(\d+)% de chance de Flinch/i.exec(d))){battle.flinch=num(m[1]);tag("💫",`${m[1]}% de Flinch`,"flinch");}
    if((m=new RegExp("consumida ao levar um golpe "+TYPE_RX+" super efetivo","i").exec(d))){battle.resist={type:m[1],se:true};tag("🛡",`Golpe ${m[1]} super efetivo: dano ½ (1 vez)`,"def");}
    if((m=new RegExp("consumida ao (?:ser atingido por|levar um) golpe "+TYPE_RX+";[^.]*metade","i").exec(d))&&!battle.resist){battle.resist={type:m[1],se:false};tag("🛡",`Golpe ${m[1]}: dano ½ (1 vez)`,"def");}
    if(/sobrevive a um ataque[^.]*com 1 HP/i.test(d)||/sobrevive[^.]*golpe fatal/i.test(d)){battle.sash=true;tag("🎗","Com HP cheio, aguenta um golpe fatal com 1 HP","def");}
    if((m=/atacante perde 1\/(\d+)[^.]*do (?:próprio )?HP Máximo/i.exec(d))&&/contato/i.test(d)){battle.contactHurt=1/num(m[1]);tag("⛑",`Quem bate com contato perde 1/${m[1]} do HP`,"def");}
    if((m=new RegExp("próximo golpe "+TYPE_RX+"[^.]*Power ×(\\d+(?:,\\d+)?)","i").exec(d))){battle.gem={type:m[1],x:num(m[2])};tag("💎",`Próximo golpe ${m[1]}: Power ×${m[2]} (1 vez)`,"dmg");}
    if(/imune a golpes Ground/i.test(d)){battle.groundImmune=true;tag("🎈","Imune a Ground até levar dano","def");}
    if((m=/consumido ao levar um golpe super efetivo; \+(\d+) estágios de Attack e Sp\.Atk/i.exec(d))){battle.weakPolicy=num(m[1]);tag("📈","Leva super efetivo: +2 Attack e Sp.Atk","stage");}
    if(/Light Screen e Reflect[^.]*8 rodadas/i.test(d))tag("🧱","Telas duram 8 rodadas","field");
    if((m=/ao fim da rodada, aplica (Envenenado|Queimado) ao usuário/i.exec(d))){battle.selfStatus=m[1]==="Queimado"?"brn":"tox";tag(m[1]==="Queimado"?"🔥":"☠",`Fim da rodada: fica ${m[1]}`,"status");}
    if((m=/recupera 1\/(\d+) do dano causado/i.exec(d))){battle.drain=1/num(m[1]);tag("🔔",`Recupera 1/${m[1]} do dano causado`,"heal");}
    if((m=/(\d+)% de chance de sobreviver com 1 HP/i.exec(d))){battle.band=num(m[1]);tag("🎗",`${m[1]}% de aguentar um golpe fatal com 1 HP`,"def");}
    if((m=/\((\d+(?:,\d+)?)%\) de chance de agir primeiro/i.exec(d))){battle.quick=num(m[1]);tag("⚡",`${m[1]}% de agir primeiro`,"speed");}
    if(/consumida ao ser atingido por golpe super efetivo; recupera 1\/(\d+)/i.test(d)){battle.seHeal=1/num(RegExp.$1);tag("🍒",`Leva super efetivo: cura 1/${RegExp.$1} (1 vez)`,"heal");}
    if((m=/consumida ao ser atingido por golpe (Physical|Special); o atacante perde 1\/(\d+)/i.exec(d))){battle.hitRecoil={cat:m[1].toLowerCase(),frac:1/num(m[2])};tag("🍒",`Leva golpe ${m[1]}: atacante perde 1/${m[2]} (1 vez)`,"def");}
    if((m=/consumid[ao] ao (?:ser atingido por golpe|levar dano(?: de golpe)?) (Physical|Special|Normal|Fire|Water|Electric|Grass|Ice|Fighting|Poison|Ground|Flying|Psychic|Bug|Rock|Ghost|Dragon|Dark|Steel|Fairy); \+(\d+) estágios? de ([A-Za-z]+(?:\.[A-Za-z]+)?)/i.exec(d))){
      const st=STAT[m[3].toLowerCase()];if(st){battle.hitStage={on:m[1],stat:st,n:num(m[2])};tag("⬆",`Leva golpe ${m[1]}: +${m[2]} ${STAT_PT[st]} (1 vez)`,"stage");}}
    if(/mesmo golpe seguidas vezes dá \+1 dado da QD/i.test(d)){battle.metronome=true;tag("🎵","Mesmo golpe seguido: até +3 dados da QD","dmg");}
    if((m=/(Hail|Sandstorm|Sunny Day|Rain Dance)[^.]*dura 8 rodadas/i.exec(d))){battle.weatherTurns=8;tag("🌦",`${m[1]} dura 8 rodadas`,"field");}
    if(/Z-Move/i.test(d)&&(m=new RegExp("golpes "+TYPE_RX,"i").exec(d))){battle.zType=m[1];tag("Ⓩ",`Z-Move ${m[1]}`,"gimmick");}
    if((m=/permite que (.+?) Mega Evolua em (.+?)\./i.exec(d))){battle.megaStone={species:m[1],mega:m[2]};tag("◆",`Mega: ${m[2]}`,"gimmick");}
    if(/Tenta capturar|Captura|Taxa de sucesso/i.test(d)&&/ball/i.test(String(it.apiName||name))){const r=/(\d+(?:,\d+)?)×/.exec(d);tag("◓",r?`Captura ${r[1]}×`:"Poké Ball","ball");}
    if(/^Ensina /i.test(d))tag("💿","Ensina um golpe","tm");
    if(/^Evolução:/i.test(d)||/\bevolui (?:em|\w+ em)/i.test(d))tag("🧬","Evolução","evo");
    if(/ainda puder evoluir/i.test(d))battle.notFullyEvolved=true;
    // itens de usar (Bolsa)
    if((m=/(?:Cura|Restaura|Recupera)\s+(\d+)\s*(?:de\s+)?HP/i.exec(d))&&!held){tag("🧪",`Cura ${m[1]} HP`,"heal");}
    if(/Cura totalmente|todo o HP|HP total/i.test(d)&&!held)tag("🧪","Cura todo o HP","heal");
    if(/Reviv/i.test(d)&&!held)tag("💠","Revive","revive");
    if((m=/Na batalha: \+(\d+) estágio(?:\(s\))? de (.+?)(?:\.|$)/i.exec(d)))tag("⬆",`+${m[1]} ${m[2]}`,"stage");
    if(/Sem efeito (?:em batalha|no RPG)/i.test(d))tag("📦","Sem efeito em batalha","none");
    if(held&&!tags.length)tag("🎒","Segurado: efeito especial (confira com o Mestre)","other");
    return {tags,battle,held,usableInBattle:Object.keys(battle).length>0};
  }
  const api={interpret,TYPES};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.hhItemRules=api;
})(typeof window!=="undefined"?window:globalThis);
