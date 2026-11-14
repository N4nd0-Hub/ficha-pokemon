/* ============================================================
   V6 — Damage Matrix v0.2 (portada do Pokémon Arena)
   Regras, iguais às do Arena:
   - Poder efetivo (com Technician, Tough Claws, Mega Launcher e
     multi-hit) define a QUANTIDADE de dados (1d a 6d).
   - Qualidade do atributo ofensivo atual (ATK ou SP.ATK com
     estágios) menos a Qualidade da defesa do alvo define a QD:
       gap < 0 → d4 · 0 → d6 · 1 → d8 · 2 → d10 · 3 → d12
       4 → d12+d4 · 5 → d12+d6 · 6+ → d20
   - Super efetivo: +1 dado e QD +1 passo. Resistido: −1 dado e
     QD −1 passo. Imune: 0.
   - STAB +1d6 (Tera do mesmo tipo +2d6; Adaptability 1 + ⌈dados/2⌉).
   - Dano fixo de nível: ⌊nível ÷ 5⌋.
   - Crítico natural: dados da QD no máximo.
   Configuração salva em state.damageMatrix.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;

  const QDS=["d4","d6","d8","d10","d12","d12+d4","d12+d6","d20"];
  const QD_DICE={d4:[4],d6:[6],d8:[8],d10:[10],d12:[12],"d12+d4":[12,4],"d12+d6":[12,6],d20:[20]};
  const EFFECTIVENESS=[
    {v:0,label:"×0 Imune"},{v:.25,label:"×¼"},{v:.5,label:"×½"},
    {v:1,label:"×1 Normal"},{v:2,label:"×2"},{v:4,label:"×4"}
  ];
  /* Golpes de vários acertos — mesma tabela do Pokémon Arena (dados do Showdown). */
  const MULTI_HIT={armthrust:[2, 5],barrage:[2, 5],bonemerang:2,bonerush:[2, 5],bulletseed:[2, 5],cometpunch:[2, 5],doublehit:2,doubleironbash:2,doublekick:2,doubleslap:[2, 5],dragondarts:2,dualchop:2,dualwingbeat:2,furyattack:[2, 5],furyswipes:[2, 5],geargrind:2,iciclespear:[2, 5],pinmissile:[2, 5],populationbomb:10,rockblast:[2, 5],scaleshot:[2, 5],spikecannon:[2, 5],surgingstrikes:3,tachyoncutter:2,tailslap:[2, 5],tripleaxel:3,tripledive:3,triplekick:3,twinbeam:2,twineedle:2,watershuriken:[2, 5]};

  const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const normType=t=>typeof normalizeTypeName==="function"?normalizeTypeName(t):t;
  const powerDice=p=>p<=0?0:p<=20?1:p<=40?2:p<=60?3:p<=80?4:p<=100?5:6;
  const quality=s=>s<=49?0:s<=75?1:s<=100?2:s<=125?3:s<=150?4:s<=175?5:s<=200?6:s<=225?7:8;
  const qdFromGap=g=>g<0?"d4":QDS[Math.min(7,g+1)];
  const hasAbility=(p,name)=>norm(p?.abilityName)===norm(name);
  const isPhysical=m=>String(m?.category||"").toLowerCase().startsWith("phys");
  const isSpecial=m=>String(m?.category||"").toLowerCase().startsWith("spec");

  function settings(){
    const raw=state.damageMatrix&&typeof state.damageMatrix==="object"?state.damageMatrix:{};
    const clampStat=v=>Math.max(1,Math.min(999,Math.round(Number(v)||100)));
    const eff=EFFECTIVENESS.some(e=>e.v===Number(raw.effectiveness))?Number(raw.effectiveness):1;
    state.damageMatrix={
      enabled:raw.enabled!==false,
      targetDef:clampStat(raw.targetDef??100),
      targetSpd:clampStat(raw.targetSpd??100),
      effectiveness:eff
    };
    return state.damageMatrix;
  }

  function offensiveStat(p,key){
    if(typeof combatEffectiveStat==="function")return combatEffectiveStat(p,key);
    return Number(p?.stats?.[key]||0);
  }

  function hitCount(p,m){
    const raw=MULTI_HIT[norm(m?.name)];
    if(!raw)return 1;
    if(typeof raw==="number")return raw;
    if(hasAbility(p,"Skill Link"))return raw[1];
    return Math.floor((raw[0]+raw[1])/2);
  }

  function effectivePower(p,m){
    let power=Number(m?.power||0);
    if(hasAbility(p,"Technician")&&power<=60)power=Math.floor(power*1.5);
    if(hasAbility(p,"Tough Claws")&&isPhysical(m))power=Math.floor(power*1.30);
    if(hasAbility(p,"Mega Launcher")&&/(pulse|aura)/i.test(m?.name||""))power=Math.floor(power*1.5);
    return power;
  }

  function stabDice(p,m,bpDice){
    const type=normType(m?.type);
    const tera=p?.gimmicks?.tera;
    if(tera?.active&&normType(tera.type)===type)return 2;
    const types=[normType(p?.type1),normType(p?.type2)].filter(Boolean);
    if(!types.includes(type))return 0;
    return hasAbility(p,"Adaptability")?1+Math.ceil(bpDice/2):1;
  }

  /* Perfil completo do golpe, ou null para golpes sem dano. */
  function profile(m,p=(typeof current!=="undefined"?current:null)){
    if(!m||!p)return null;
    if(!(isPhysical(m)||isSpecial(m))||!(Number(m.power)>0))return null;
    const cfg=settings();
    const offKey=isPhysical(m)?"atk":"spa";
    const defKey=isPhysical(m)?"def":"spd";
    const offStat=offensiveStat(p,offKey);
    const defStat=defKey==="def"?cfg.targetDef:cfg.targetSpd;
    const offQ=quality(offStat),defQ=quality(defStat),gap=offQ-defQ;
    const hits=hitCount(p,m);
    const effectiveBP=effectivePower(p,m)*hits;
    const bpDice=powerDice(effectiveBP);
    let count=bpDice,qd=qdFromGap(gap);
    const eff=cfg.effectiveness,index=QDS.indexOf(qd);
    if(eff>1){count++;qd=QDS[Math.min(7,index+1)];}
    else if(eff>0&&eff<1){count=Math.max(1,count-1);qd=QDS[Math.max(0,index-1)];}
    const levelBonus=Math.floor(Number(p.level||1)/5);
    const stab=stabDice(p,m,bpDice);
    const baseExpression=QD_DICE[qd].map(s=>`${count}d${s}`).join(" + ");
    const immune=eff===0;
    const expression=immune?"Imune • 0 HP":`${baseExpression}${stab?` + ${stab}d6 STAB`:""}${levelBonus?` + ${levelBonus} fixos`:""}`;
    const short=immune?"Imune":`${QD_DICE[qd].map(x=>`${count}d${x}`).join("+")}${stab?` +${stab}d6`:""}${levelBonus?` +${levelBonus}`:""}`;
    return {count,qd,sides:QD_DICE[qd],hits,effectiveBP,offKey,defKey,offStat,defStat,offQ,defQ,gap,effectiveness:eff,stab,levelBonus,immune,baseExpression,expression,short};
  }

  /* Rola um perfil. critical: "none" | "natural". */
  function roll(pr,{critical="none"}={}){
    const d=n=>Math.floor(Math.random()*n)+1;
    if(!pr||pr.immune)return {dice:[],total:0};
    const dice=[];
    pr.sides.forEach(s=>{for(let i=0;i<pr.count;i++)dice.push({sides:s,value:critical==="natural"?s:d(s),group:"qd"});});
    for(let i=0;i<pr.stab;i++)dice.push({sides:6,value:d(6),group:"stab"});
    const total=dice.reduce((a,x)=>a+x.value,0)+pr.levelBonus;
    return {dice,total};
  }

  function enabled(){return settings().enabled;}
  function set(patch){
    Object.assign(settings(),patch);
    settings();
    if(typeof debouncedSave==="function")debouncedSave();
    document.dispatchEvent(new CustomEvent("hh:matrixchange"));
  }

  /* ---------- Painel da calculadora (inserido pela batalha) ---------- */
  function panelHtml(){
    const cfg=settings();
    return `
      <div class="dm-head">
        <button type="button" class="dm-toggle" data-dm="toggle" aria-pressed="${cfg.enabled}">🧪 Dano experimental: <b>${cfg.enabled?"ligado":"desligado"}</b></button>
        <small>${cfg.enabled?"Damage Matrix v0.2 · Poder define os dados, atributos definem a QD, nível soma dano fixo.":"Dano padrão: Poder em d6 + bônus do atributo."}</small>
      </div>
      ${cfg.enabled?`
      <div class="dm-target">
        <label><span>DEF do alvo</span><input type="number" min="1" max="999" inputmode="numeric" data-dm="targetDef" value="${cfg.targetDef}"><em>Qualidade ${quality(cfg.targetDef)}</em></label>
        <label><span>SP.DEF do alvo</span><input type="number" min="1" max="999" inputmode="numeric" data-dm="targetSpd" value="${cfg.targetSpd}"><em>Qualidade ${quality(cfg.targetSpd)}</em></label>
        <label><span>Efetividade</span><select data-dm="effectiveness">${EFFECTIVENESS.map(e=>`<option value="${e.v}"${e.v===cfg.effectiveness?" selected":""}>${e.label}</option>`).join("")}</select></label>
      </div>`:""}`;
  }
  function mountPanel(host){
    if(!host)return null;
    let el=host.querySelector(".dm-panel");
    if(!el){
      el=document.createElement("div");
      el.className="dm-panel";
      host.prepend(el);
      el.addEventListener("click",e=>{
        if(e.target.closest('[data-dm="toggle"]')){set({enabled:!settings().enabled});window.hhClassicSfx?.select?.();}
      });
      el.addEventListener("change",e=>{
        const f=e.target.closest("[data-dm]");
        if(!f||f.dataset.dm==="toggle")return;
        set({[f.dataset.dm]:Number(f.value)});
      });
    }
    const focused=el.contains(document.activeElement)?document.activeElement.dataset.dm:null;
    el.innerHTML=panelHtml();
    if(focused)el.querySelector(`[data-dm="${focused}"]`)?.focus();
    return el;
  }

  settings();
  window.hhDamageMatrix={enabled,settings,set,profile,roll,quality,mountPanel,QDS,QD_DICE};
  // Telas que já desenharam antes deste script carregar se atualizam.
  document.dispatchEvent(new CustomEvent("hh:matrixchange"));
})();
