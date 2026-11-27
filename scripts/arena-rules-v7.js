/* ============================================================
   V7 — Arena Online: leitura dos textos de golpes e abilities
   Transforma a descrição escrita na ficha (português ou inglês) em
   efeitos que o motor da arena aplica de verdade:
   estágios (+1 Attack, −1 Speed…), status (Poison, Burn, Paralysis,
   Sleep, Freeze, Confusion, Toxic, Deep Burn), Flinch, cura, dreno,
   recuo, clima, golpes de vários acertos, crítico aumentado, Protect,
   condições de Power em dobro e gatilhos de abilities (ao entrar,
   ao acertar, ao derrotar, com HP baixo, ao ser atingido, imunidades,
   bônus em clima). Abilities muito específicas (Royal Field, Command
   Pheromone…) têm regras próprias no fim do arquivo.
   Sem dependência de tela: roda no navegador e nos testes (node).
   ============================================================ */
(function(root){
  "use strict";

  const STATS=[
    ["spa",/sp\.?\s*atk|sp\.?\s*attack|special attack|ataque especial|sp\.?\s*atq/i],
    ["spd",/sp\.?\s*def(?:ense)?|special defense|defesa especial/i],
    ["atk",/\battack\b|\bataque\b|\batk\b/i],
    ["def",/\bdefense\b|\bdefesa\b|\bdef\b/i],
    ["spe",/\bspeed\b|\bvelocidade\b|\bspe\b/i],
    ["acc",/precis[ãa]o|accuracy|\bacc\b/i],
    ["eva",/evas[ãa]o|evasion|evasiva/i]
  ];
  const STAT_RE=/sp\.?\s*atk|sp\.?\s*attack|special attack|ataque especial|sp\.?\s*def(?:ense)?|special defense|defesa especial|\battack\b|\bataque\b|\bdefense\b|\bdefesa\b|\bspeed\b|\bvelocidade\b|precis[ãa]o|accuracy|evas[ãa]o|evasion|evasiva|todos os (?:seus )?atributos|all stats/gi;
  const STAT_LABEL={atk:"Attack",def:"Defense",spa:"Sp.Atk",spd:"Sp.Def",spe:"Speed",acc:"Precisão",eva:"Evasão"};
  function statKey(s){
    if(/todos os|all stats/i.test(s))return "all";
    for(const [k,re] of STATS)if(re.test(s))return k;
    return null;
  }

  const STATUS=[
    ["tox",/\btoxic\b|gravemente envenenad/i],
    ["dbrn",/deep burn|queimadura profunda/i],
    ["psn",/\bpoison(?:ed)?\b|envenen\w*|\bveneno\b/i],
    ["brn",/\bburn(?:ed)?\b|queimad\w*|\bqueimar\b|queima o alvo/i],
    ["par",/paralys\w*|paralis\w*|paraliz\w*/i],
    ["slp",/\bsleep\b|\basleep\b|dormir|dormindo|adormec\w*|\bsono\b/i],
    ["frz",/\bfreeze\b|\bfrozen\b|congel\w*/i],
    ["cnf",/confus\w*|confuso|confusa/i]
  ];
  const STATUS_LABEL={psn:"Envenenado",tox:"Toxic",brn:"Queimado",dbrn:"Deep Burn",par:"Paralisado",slp:"Dormindo",frz:"Congelado",cnf:"Confuso"};
  function statusKeys(s){const out=[];for(const [k,re] of STATUS)if(re.test(s)&&!out.includes(k))out.push(k);
    if(out.includes("tox"))return out.filter(x=>x!=="psn");
    if(out.includes("dbrn"))return out.filter(x=>x!=="brn");
    return out;}

  const WEATHER=[
    ["rain",/\bchuva\b|\brain\b|chover|chovendo/i],
    ["sun",/\bsol\b|ensolarad\w*|\bsunny\b|\bsun\b|luz do sol|harsh sunlight/i],
    ["sand",/tempestade de areia|sandstorm|\bareia\b/i],
    ["hail",/granizo|\bhail\b/i],
    ["snow",/\bneve\b|\bsnow\b|nevasca|snowscape/i]
  ];
  const WEATHER_LABEL={rain:"Chuva",sun:"Sol forte",sand:"Tempestade de areia",hail:"Granizo",snow:"Neve"};
  const WEATHER_MOVES={"rain dance":"rain","sunny day":"sun","sandstorm":"sand","hail":"hail","snowscape":"snow","chilly reception":"snow"};
  function weatherKey(s){for(const [k,re] of WEATHER)if(re.test(s))return k;return null;}

  const TYPES=["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
  const TYPE_PT={fogo:"Fire",agua:"Water","água":"Water",eletrico:"Electric","elétrico":"Electric",planta:"Grass",grama:"Grass",gelo:"Ice",lutador:"Fighting",luta:"Fighting",veneno:"Poison",venenoso:"Poison",terra:"Ground",voador:"Flying",psiquico:"Psychic","psíquico":"Psychic",inseto:"Bug",pedra:"Rock",rocha:"Rock",fantasma:"Ghost",dragao:"Dragon","dragão":"Dragon",sombrio:"Dark",metal:"Steel",aco:"Steel","aço":"Steel",fada:"Fairy"};
  function typesIn(s){
    const out=new Set();
    for(const t of TYPES)if(new RegExp("\\b"+t+"\\b","i").test(s))out.add(t);
    for(const [pt,t] of Object.entries(TYPE_PT))if(new RegExp("(?:tipo|do tipo|de tipo)\\s+"+pt+"\\b","i").test(s))out.add(t);
    return [...out];
  }

  const key=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9' -]/g,"").trim();
  const num=s=>Number(String(s).replace(/[−–]/g,"-"));
  function sentences(text){
    return String(text||"").replace(/\r/g,"").split(/(?<!\b(?:Sp|sp|SP|m[áa]x|Máx|Lv|lv|ex|Ex|aprox)\.)(?<=[.;!])\s+|\n+|•/).map(x=>x.trim()).filter(Boolean);
  }
  function chanceIn(s){const m=/(\d{1,3})\s*%\s*(?:de\s+)?(?:chance|probabilidade|chance de)/i.exec(s)||/chance\s+de\s+(\d{1,3})\s*%/i.exec(s);return m?Math.min(100,Number(m[1])):100;}

  /* "Aumenta Sp. Atk, Sp. Def e Speed do usuário em 1 estágio cada",
     "Reduz o Sp. Atk do alvo em 1 estágio", "+1 Estágio de Speed (máx. +3)",
     "Inimigos recebem −1 estágio de Speed", "Reduz a Speed do alvo em 2 estágios". */
  function parseStages(s,defaultWho){
    const out=[];
    const lower=s.toLowerCase();
    if(/taxa de cr[ií]tico|critical|cr[ií]tico/i.test(s)&&!STAT_RE.test(s.replace(/cr[ií]tico/gi,""))){STAT_RE.lastIndex=0;return out;}
    STAT_RE.lastIndex=0;
    const max=/m[áa]x(?:imo)?\.?\s*(?:de\s*)?\+?\s*(\d)/i.exec(s)||/at[ée]\s*(?:o m[áa]ximo de\s*)?\+\s*(\d)/i.exec(s);
    const cap=max?Number(max[1]):null;
    let who=defaultWho;
    if(/\b(do|o|ao|no) usu[áa]rio\b|\bde si\b|si mesmo|\bseu(s)? pr[óo]pri|\bganha\b|\bgains?\b|\bown\b|\buser'?s?\b/i.test(s))who="self";
    if(/\b(do|o|ao|no|os|dos) alvos?\b|inimig|oponent|advers|\bdeles\b|\bdelas\b|\btarget\b|\bfoe|\bopponent/i.test(s)&&!/\b(do|o) usu[áa]rio\b/i.test(s))who="foe";
    if(/todos os aliados|aliados|allies/i.test(s)&&!/inimig/i.test(s.split(/aliados/i)[0]||""))who=/inimig/i.test(s)&&lower.indexOf("inimig")<lower.indexOf("aliad")?"foe":"team";
    // forma "+N estágio(s) de X"
    const reB=/([+\-−–])\s*(\d)\s*est[áa]gios?\s+(?:de|em|no|na)\s+((?:[^.;,()]|,(?=\s*(?:sp|spe|att|def|pre|eva|vel|ata)))+)/gi;
    let m;
    while((m=reB.exec(s))){
      const sign=m[1]==="+"?1:-1,n=Number(m[2]);
      const part=m[3];
      const stats=(part.match(STAT_RE)||[]).map(statKey).filter(Boolean);STAT_RE.lastIndex=0;
      let w=who;const before=s.slice(Math.max(0,m.index-60),m.index);
      if(/inimig|alvo|oponent|advers/i.test(before))w="foe";
      else if(/aliad/i.test(before))w="team";
      else if(/\b(ganha|recebe|usu[áa]rio)\b/i.test(before)&&!/inimig/i.test(before))w=w==="foe"&&/recebem/i.test(before)?"foe":"self";
      if(sign<0&&w==="self"&&!/usu[áa]rio|si mesmo|pr[óo]pri/i.test(s)&&/inimig|alvo/i.test(s))w="foe";
      (stats.length?stats:[]).forEach(st=>out.push({who:w,stat:st,n:sign*n,cap}));
    }
    if(out.length)return out;
    // forma "verbo ... STATS ... em N estágio(s)"
    const verb=/(aument\w*|elev\w*|ganh\w*|sobe|subir|raise[sd]?|boost\w*|increase[sd]?|reduz\w*|diminu\w*|abaix\w*|baix\w*|perde\w*|lower[sd]?|decrease[sd]?|drops?|cai)\b/i.exec(s);
    const amt=/em\s+(\d)\s+est[áa]gios?|by\s+(\d)\s+stages?|(\d)\s+est[áa]gios?|(\d)\s+stages?/i.exec(s);
    if(verb&&amt){
      const n=Number(amt[1]||amt[2]||amt[3]||amt[4]);
      const sign=/aument|elev|ganh|sobe|subir|raise|boost|increase/i.test(verb[1])?1:-1;
      const seg=s.slice(verb.index,amt.index+amt[0].length);
      const stats=[...new Set((seg.match(STAT_RE)||[]).map(statKey).filter(Boolean))];STAT_RE.lastIndex=0;
      let w=who;
      if(/do alvo|dos alvos|o alvo|dos inimigos|deles|do oponente|target|foe|opponent/i.test(seg))w="foe";
      if(/do usu[áa]rio|o usu[áa]rio|user|de si/i.test(seg))w="self";
      if(!w)w=sign>0?"self":"foe";
      stats.forEach(st=>{
        if(st==="all")["atk","def","spa","spd","spe"].forEach(x=>out.push({who:w,stat:x,n:sign*n,cap}));
        else out.push({who:w,stat:st,n:sign*n,cap});
      });
    }
    return out;
  }

  const PROTECT=new Set(["protect","detect","spiky shield","king's shield","baneful bunker","silk trap","burning bulwark","obstruct","max guard"]);
  const HEAL50=new Set(["recover","roost","soft-boiled","slack off","synthesis","moonlight","morning sun","milk drink","heal order","shore up","lunar blessing","cpr"]);
  const POWDER=new Set(["sleep powder","poison powder","stun spore","spore","cotton spore","rage powder","powder","magic powder"]);
  const PRIORITY={
    "extreme speed":2,"first impression":2,"feint":2,"fake out":3,"upper hand":3,"quick guard":3,"wide guard":3,
    "protect":4,"detect":4,"endure":4,"spiky shield":4,"king's shield":4,"baneful bunker":4,"silk trap":4,"burning bulwark":4,"obstruct":4,
    "quick attack":1,"aqua jet":1,"mach punch":1,"bullet punch":1,"ice shard":1,"shadow sneak":1,"sucker punch":1,"accelerock":1,
    "jet punch":1,"vacuum wave":1,"water shuriken":1,"grassy glide":1,"thunderclap":1,"zippy zap":2,
    "counter":-5,"mirror coat":-5,"revenge":-4,"avalanche":-4,"focus punch":-3,"roar":-6,"whirlwind":-6,"trick room":-7
  };
  /* Golpes clássicos cujo texto na ficha às vezes é só narrativo */
  const KNOWN={
    "swords dance":{stages:[{who:"self",stat:"atk",n:2}]},"nasty plot":{stages:[{who:"self",stat:"spa",n:2}]},
    "dragon dance":{stages:[{who:"self",stat:"atk",n:1},{who:"self",stat:"spe",n:1}]},"calm mind":{stages:[{who:"self",stat:"spa",n:1},{who:"self",stat:"spd",n:1}]},
    "bulk up":{stages:[{who:"self",stat:"atk",n:1},{who:"self",stat:"def",n:1}]},"quiver dance":{stages:[{who:"self",stat:"spa",n:1},{who:"self",stat:"spd",n:1},{who:"self",stat:"spe",n:1}]},
    "agility":{stages:[{who:"self",stat:"spe",n:2}]},"iron defense":{stages:[{who:"self",stat:"def",n:2}]},"harden":{stages:[{who:"self",stat:"def",n:1}]},
    "growl":{stages:[{who:"foe",stat:"atk",n:-1}]},"leer":{stages:[{who:"foe",stat:"def",n:-1}]},"tail whip":{stages:[{who:"foe",stat:"def",n:-1}]},
    "string shot":{stages:[{who:"foe",stat:"spe",n:-2}]},"sand attack":{stages:[{who:"foe",stat:"acc",n:-1}]},"double team":{stages:[{who:"self",stat:"eva",n:1}]},
    "screech":{stages:[{who:"foe",stat:"def",n:-2}]},"charm":{stages:[{who:"foe",stat:"atk",n:-2}]},"scary face":{stages:[{who:"foe",stat:"spe",n:-2}]},
    "thunder wave":{status:[{who:"foe",st:"par",chance:100}]},"toxic":{status:[{who:"foe",st:"tox",chance:100}]},"will-o-wisp":{status:[{who:"foe",st:"brn",chance:100}]},
    "hypnosis":{status:[{who:"foe",st:"slp",chance:100}]},"sleep powder":{status:[{who:"foe",st:"slp",chance:100}]},"spore":{status:[{who:"foe",st:"slp",chance:100}]},
    "stun spore":{status:[{who:"foe",st:"par",chance:100}]},"poison powder":{status:[{who:"foe",st:"psn",chance:100}]},"confuse ray":{status:[{who:"foe",st:"cnf",chance:100}]},
    "supersonic":{status:[{who:"foe",st:"cnf",chance:100}]},"swagger":{status:[{who:"foe",st:"cnf",chance:100}],stages:[{who:"foe",stat:"atk",n:2}]},
    "focus energy":{selfCrit:2},"rest":{rest:true},"haze":{haze:true},"toxic spikes":{hazard:"tspikes"},
    "close combat":{stages:[{who:"self",stat:"def",n:-1},{who:"self",stat:"spd",n:-1}]},"superpower":{stages:[{who:"self",stat:"atk",n:-1},{who:"self",stat:"def",n:-1}]},
    "draco meteor":{stages:[{who:"self",stat:"spa",n:-2}]},"overheat":{stages:[{who:"self",stat:"spa",n:-2}]},"leaf storm":{stages:[{who:"self",stat:"spa",n:-2}]}
  };

  /* Golpes de vários acertos oficiais. "2–5" segue a regra do Heaven & Hell:
     3 acertos fixos, 5 no Crítico Natural (Skill Link, Loaded Dice e afins: 5).
     perHit: Power de cada acerto quando ele muda (Triple Axel, Triple Kick). */
  const MULTI={
    "arm thrust":[2,5],"barrage":[2,5],"bone rush":[2,5],"bullet seed":[2,5],"comet punch":[2,5],"double slap":[2,5],"fury attack":[2,5],
    "fury swipes":[2,5],"icicle spear":[2,5],"pin missile":[2,5],"rock blast":[2,5],"scale shot":[2,5],"spike cannon":[2,5],"tail slap":[2,5],
    "water shuriken":[2,5],"bonemerang":[2,2],"double hit":[2,2],"double iron bash":[2,2],"double kick":[2,2],"dragon darts":[2,2],
    "dual chop":[2,2],"dual wingbeat":[2,2],"gear grind":[2,2],"tachyon cutter":[2,2],"twin beam":[2,2],"twineedle":[2,2],
    "surging strikes":[3,3],"triple dive":[3,3],"population bomb":[1,10],
    "triple axel":[3,3,[20,40,60]],"triple kick":[3,3,[10,20,30]]
  };
  /* Golpes com mecânica própria (Arena): o motor lê fx.mech */
  const SEMI_HIT={fly:{"thunder":1,"hurricane":1,"gust":2,"twister":2,"sky uppercut":1,"smack down":1,"thousand arrows":1},
    dig:{"earthquake":2,"magnitude":2,"fissure":1},dive:{"surf":2,"whirlpool":2},phantom:{}};
  const MECH={
    // dois turnos com invulnerabilidade
    "fly":{semi:"fly",say:"voou bem alto!"},"bounce":{semi:"fly",say:"saltou bem alto!"},"sky drop":{semi:"fly",say:"subiu aos céus!"},
    "dig":{semi:"dig",say:"cavou um buraco!"},"dive":{semi:"dive",say:"mergulhou fundo!"},
    "phantom force":{semi:"phantom",breakProtect:true,say:"sumiu de vista!"},"shadow force":{semi:"phantom",breakProtect:true,say:"sumiu nas sombras!"},
    // dois turnos sem invulnerabilidade
    "solar beam":{charge:true,skipIn:"sun",say:"absorveu luz!"},"solar blade":{charge:true,skipIn:"sun",say:"absorveu luz!"},
    "sky attack":{charge:true,say:"foi envolto por uma luz forte!"},"razor wind":{charge:true,say:"criou um redemoinho!"},
    "skull bash":{charge:true,chargeStage:{stat:"def",n:1},say:"abaixou a cabeça!"},"meteor beam":{charge:true,chargeStage:{stat:"spa",n:1},say:"juntou energia cósmica!"},
    "electro shot":{charge:true,skipIn:"rain",chargeStage:{stat:"spa",n:1},say:"juntou eletricidade!"},
    "freeze shock":{charge:true,say:"ficou coberto de gelo!"},"ice burn":{charge:true,say:"ficou coberto de ar congelante!"},
    "geomancy":{charge:true,say:"absorveu energia!",selfStages:[{stat:"spa",n:2},{stat:"spd",n:2},{stat:"spe",n:2}]},
    // precisa recarregar
    "hyper beam":{recharge:true},"giga impact":{recharge:true},"blast burn":{recharge:true},"hydro cannon":{recharge:true},"frenzy plant":{recharge:true},
    "rock wrecker":{recharge:true},"roar of time":{recharge:true},"prismatic laser":{recharge:true},"eternabeam":{recharge:true},"meteor assault":{recharge:true},
    // só funcionam contra a ação do alvo
    "sucker punch":{needFoeAttack:true},"thunderclap":{needFoeAttack:true},"upper hand":{needFoePriority:true,flinch:100},
    "feint":{breakProtect:true,needFoeProtect:false},"fake out":{firstTurn:true,flinch:100},"first impression":{firstTurn:true},
    "focus punch":{focus:true},
    // custam a própria vida
    "explosion":{selfKO:true},"self-destruct":{selfKO:true},"misty explosion":{selfKO:true},
    "memento":{selfKO:true,foeStages:[{stat:"atk",n:-2},{stat:"spa",n:-2}]},
    "healing wish":{selfKO:true,healWish:true},"lunar dance":{selfKO:true,healWish:true},
    "final gambit":{selfKO:true,gambit:true},
    "curse":{curse:true},"belly drum":{bellyDrum:true},"substitute":{substitute:true},"destiny bond":{destiny:true},"perish song":{perish:true},
    "mind blown":{halfCost:true},"steel beam":{halfCost:true},"chloroblast":{halfCost:true},
    "endure":{endure:true},"pain split":{painSplit:true},"endeavor":{endeavor:true},
    // dano fixo e nocaute
    "seismic toss":{fixed:"level"},"night shade":{fixed:"level"},"dragon rage":{fixed:40},"sonic boom":{fixed:20},"psywave":{fixed:"psywave"},
    "super fang":{fixed:"half"},"ruination":{fixed:"half"},"nature's madness":{fixed:"half"},
    "fissure":{ohko:true},"guillotine":{ohko:true},"horn drill":{ohko:true},"sheer cold":{ohko:true},
    // Power variável
    "reversal":{power:"reversal"},"flail":{power:"reversal"},"eruption":{power:"hpHigh"},"water spout":{power:"hpHigh"},"dragon energy":{power:"hpHigh"},
    "stored power":{power:"boosts"},"power trip":{power:"boosts"},"acrobatics":{power:"acrobatics"},"brine":{power:"brine"},
    "weather ball":{power:"weather"},"knock off":{knockOff:true},"metal burst":{metalBurst:true},
    // efeitos no alvo
    "taunt":{taunt:true},"encore":{encore:true},"disable":{disable:true},"leech seed":{leechSeed:true},"yawn":{yawn:true},
    "trick":{swapItems:true},"switcheroo":{swapItems:true},"thief":{stealItem:true},"covet":{stealItem:true},
    "roar":{phaze:true},"whirlwind":{phaze:true},"dragon tail":{phaze:true},"circle throw":{phaze:true},
    "u-turn":{pivot:true},"volt switch":{pivot:true},"flip turn":{pivot:true},"teleport":{pivot:true},
    "parting shot":{pivot:true,foeStages:[{stat:"atk",n:-1},{stat:"spa",n:-1}]},"baton pass":{pivot:true,baton:true},"shed tail":{pivot:true,shedTail:true},
    "sleep talk":{sleepTalk:true},"snore":{snore:true},"wish":{wish:true},
    // campo
    "trick room":{trickRoom:true},"tailwind":{tailwind:true},"reflect":{screen:"reflect"},"light screen":{screen:"light"},"aurora veil":{screen:"veil"},
    "brick break":{breakScreens:true},"psychic fangs":{breakScreens:true},"raging bull":{breakScreens:true},
    "stealth rock":{hazard:"rocks"},"spikes":{hazard:"spikes"},"sticky web":{hazard:"web"},
    "rapid spin":{clearHazards:"self",selfStages:[{stat:"spe",n:1}]},"mortal spin":{clearHazards:"self"},"defog":{clearHazards:"both",clearFoeScreens:true},
    "tidy up":{clearHazards:"both",selfStages:[{stat:"atk",n:1},{stat:"spe",n:1}]},
    "smack down":{grounds:true},"thousand arrows":{grounds:true},"growth":{growth:true}
  };

  function parseMove(move){
    const name=key(move?.name);
    const text=String(move?.desc||move?.description||"");
    const cat=String(move?.category||"").toLowerCase();
    const fx={stages:[],status:[],flinch:0,drain:0,heal:0,recoil:0,weather:null,hits:null,critStage:0,selfCrit:0,
      protect:PROTECT.has(name),firstTurnOnly:false,falseSwipe:false,counter:null,doubleIf:[],hazard:null,
      powder:POWDER.has(name),sound:/\bmove de som\b|sound/i.test(text),contact:cat==="physical",priority:0,
      field:null,haze:false,rest:false,neverMiss:false,special:[]};
    // prioridade
    const pm=/prioridade\s*([+\-−–])\s*(\d)/i.exec(text)||/priority\s*([+\-−–])\s*(\d)/i.exec(text);
    fx.priority=pm?(pm[1]==="+"?1:-1)*Number(pm[2]):(PRIORITY[name]||0);
    if(HEAL50.has(name))fx.heal=50;
    if(WEATHER_MOVES[name])fx.weather={kind:WEATHER_MOVES[name],turns:5};
    for(const s of sentences(text)){
      const low=s.toLowerCase();
      if(/prioridade|priority/i.test(s)&&!/estágio|stage|chance|dano|power|poder/i.test(s.replace(/prioridade\s*[+\-−–]\s*\d/i,"")))continue;
      // crítico
      if(/taxa de cr[ií]tico|cr[ií]tico aumentad|critical hit ratio|high critical/i.test(s)){
        const n=/(\d)\s*est[áa]gios?/i.exec(s);const v=n?Number(n[1]):1;
        if(cat==="status"){if(/aumenta a taxa|usu[áa]rio|at[ée] sair|raises?/i.test(s))fx.selfCrit=Math.max(fx.selfCrit,v);}
        else fx.critStage=Math.max(fx.critStage,v);
        continue;
      }
      // clima
      const wk=weatherKey(s);
      if(wk&&/invoca|cria|ativa|summons?|causa|inicia|por\s+\d+\s+turnos/i.test(s)&&!/durante|enquanto|se estiver|while|during/i.test(s)){
        const t=/(\d+)\s*(?:turnos|rodadas|turns)/i.exec(s);fx.weather={kind:wk,turns:t?Number(t[1]):5};continue;
      }
      // armadilhas
      if(/espinhos venenosos|toxic spikes/i.test(s)){fx.hazard="tspikes";continue;}
      // vários acertos
      if(!fx.hits){
        const hm=/(\d{1,2})\s*(?:a|-|–|ou|to)\s*(\d{1,2})\s*(?:acertos|vezes|hits|golpes|times|sementes|agulhas|espinhos|pedras|ataques)/i.exec(s);
        const hf=/(\d)\s*acertos fixos|(\d)\s*hits?\b|(?:ataca|acerta|atinge|golpeia|chuta|bate)\s+(?:o alvo\s+)?(\d+)\s+vezes|(\d+)\s+vezes\s+seguidas|(?:hits|strikes)\s+(?:the target\s+)?(\d+)\s+times|(?:duas|two) vezes|\btwice\b|(?:tr[êe]s|three) vezes/i.exec(s);
        if(hm&&Number(hm[2])>=2&&Number(hm[2])<=10)fx.hits={min:Number(hm[1]),max:Number(hm[2])};
        else if(hf){const n=Number(hf[1]||hf[2]||hf[3]||hf[4]||hf[5]||(/tr[êe]s|three/i.test(hf[0])?3:2));if(n>=2&&n<=10)fx.hits={min:n,max:n};}
      }
      // primeiro turno
      if(/primeiro turno|first turn/i.test(s))fx.firstTurnOnly=true;
      // false swipe
      if(/pelo menos 1 de hp|leaves the target with at least 1|n[ãa]o consegue derrotar/i.test(s))fx.falseSwipe=true;
      // counter / mirror coat
      if(/devolve|returns? .*(dano|damage)/i.test(s)){fx.counter=/especial|special/i.test(s)?"special":/f[íi]sico|physical/i.test(s)?"physical":"any";continue;}
      // power em dobro
      if(/(poder|power)[^.]*dobra|dobra[^.]*(poder|power)|double[sd]? (?:in )?power/i.test(s)){
        const sts=statusKeys(s);
        if(/alvo estiver com|target is|se o alvo tiver|alvo com/i.test(s)&&sts.length)fx.doubleIf.push({cond:"targetStatus",st:sts});
        else if(/j[áa] recebeu dano|already (?:taken|been) damage/i.test(s))fx.doubleIf.push({cond:"targetHurt"});
        else if(/foi derrotado|fainted/i.test(s))fx.doubleIf.push({cond:"allyFainted"});
        else if(/uso consecutivo|consecutiv/i.test(s))fx.doubleIf.push({cond:"consecutive"});
        else if(/usu[áa]rio (?:estiver|tiver)? ?(?:com )?(?:status|condi)|user is (?:burned|poisoned|paralyzed)/i.test(s))fx.doubleIf.push({cond:"userStatus"});
        continue;
      }
      // dreno e cura
      const dr=/(?:recupera|cura|drena|restaura|recebe de volta)\w*\s+(\d+)\s*%\s*(?:do|de)\s+(?:todo\s+o\s+)?dano|recovers?\s+(\d+)\s*%\s*of the damage|(?:recupera|cura|drena)\w*\s+(metade|half|tr[êe]s quartos|3\/4)\s+do dano|(?:restores?|heals?)\s+(?:the user\s+)?(?:by\s+)?(half|75%)\s+(?:of\s+)?the damage/i.exec(s);
      if(dr){const w=String(dr[3]||dr[4]||"").toLowerCase();fx.drain=w?(/tr[êe]s|3\/4|75/.test(w)?75:50):Number(dr[1]||dr[2]);continue;}
      const hl=/(?:recupera|cura|restaura|heals?|restores?)\s+(?:at[ée]\s+)?(\d+)\s*%\s*(?:do|of)?\s*(?:seu\s+)?(?:hp|vida)/i.exec(s)||/(?:recupera|cura|restaura)\s+(metade)\s+(?:do|de)\s+(?:seu\s+)?(?:hp|vida)/i.exec(s);
      if(hl&&cat==="status"){fx.heal=hl[1]==="metade"?50:Number(hl[1]);continue;}
      const rc=/(?:recebe|sofre|takes?)\s+(\d+)\s*%\s*(?:do dano|of the damage)[^.]*(?:recuo|recoil)?|(?:recuo|recoil)[^.]*?(\d+)\s*%|(\d)\/(\d)\s+do dano[^.]*recuo/i.exec(s);
      if(rc){fx.recoil=rc[3]?Math.round(100*Number(rc[3])/Number(rc[4])):Number(rc[1]||rc[2]);continue;}
      // regras reworkadas: Swords Dance / Iron Defense
      if(/pr[óo]ximo (?:move|golpe|ataque)[^.]*(?:dobro|2×|2x)|double[sd]? the damage of the next/i.test(s)){fx.nextDouble=/f[íi]sico|physical/i.test(s)?"physical":/especial|special/i.test(s)?"special":"any";continue;}
      if(/(?:reduz|corta)[^.]*(?:50\s*%|metade)[^.]*pr[óo]ximo dano|pr[óo]ximo dano[^.]*(?:metade|50\s*%)/i.test(s)){fx.nextHalf=true;continue;}
      // nunca erra
      if(/nunca erra|never misses|n[ãa]o erra/i.test(s))fx.neverMiss=true;
      // flinch
      if(/flinch|hesitar|recuar de medo|vacilar/i.test(s)&&!/imune|immune/i.test(s)){fx.flinch=Math.max(fx.flinch,chanceIn(s));}
      // status
      const sts=statusKeys(s);
      if(sts.length&&!/imune|immune|remove|cura |cures?|se o alvo estiver|if the target is|usu[áa]rio estiver|alvo com|enquanto/i.test(s)){
        const ch=chanceIn(s);
        const self=/o usu[áa]rio (?:fica|adormece|dorme)|user (?:falls asleep|becomes)/i.test(s);
        sts.forEach(st=>{if(!(st==="psn"&&/toxic/i.test(name)))fx.status.push({who:self?"self":"foe",st,chance:ch});});
      }
      // estágios
      const st=parseStages(s,cat==="status"?null:"foe");
      st.forEach(x=>{x.chance=chanceIn(s);if(cat!=="status"&&x.chance===100&&!/depois do ataque|ap[óo]s o ataque|after/i.test(s)&&x.who==="foe"&&/chance/i.test(s))x.chance=chanceIn(s);fx.stages.push(x);});
    }
    const kn=KNOWN[name];
    if(kn){
      if(kn.stages&&!fx.stages.length&&!fx.nextDouble&&!fx.nextHalf)fx.stages=kn.stages.map(x=>({...x,chance:100}));
      if(kn.status&&!fx.status.length)fx.status=kn.status.slice();
      if(kn.selfCrit)fx.selfCrit=Math.max(fx.selfCrit,kn.selfCrit);
      if(kn.hazard)fx.hazard=kn.hazard;if(kn.haze)fx.haze=true;if(kn.rest)fx.rest=true;
    }
    if(name==="royal command")fx.field="royal";
    if(name==="rest"){fx.rest=true;fx.heal=0;}
    if(fx.hazard)fx.status=[];
    // golpes de dreno oficiais (quando o texto não diz quanto)
    const DRAIN={"absorb":50,"mega drain":50,"giga drain":50,"drain punch":50,"leech life":50,"horn leech":50,"draining kiss":75,"oblivion wing":75,"parabolic charge":50,"dream eater":50,"bitter blade":50,"matcha gotcha":50};
    if(!fx.drain&&DRAIN[name]&&cat!=="status")fx.drain=DRAIN[name];
    // tabela oficial manda sobre o texto
    if(MULTI[name]){const [a,b2,per]=MULTI[name];fx.hits={min:a,max:b2,...(per?{perHit:per}:{})};}
    if(cat==="status")fx.hits=null;
    fx.mech=MECH[name]||null;
    if(fx.mech){
      const M=fx.mech;
      if(M.firstTurn)fx.firstTurnOnly=true;
      if(M.flinch)fx.flinch=Math.max(fx.flinch,M.flinch);
      // o motor cuida destes: não deixa o texto aplicar de novo
      if(M.curse||M.bellyDrum||M.substitute||M.selfKO||M.taunt||M.encore||M.disable||M.leechSeed||M.yawn||M.screen||M.hazard||M.trickRoom||M.tailwind||M.perish||M.destiny||M.pivot||M.wish||M.painSplit){fx.stages=M.foeStages||M.curse?[]:fx.stages.filter(x=>x.who!=="foe"||cat!=="status");fx.status=[];fx.heal=0;}
      if(M.curse||M.bellyDrum)fx.stages=[];
      if(M.hazard)fx.hazard=null;
    }
    return fx;
  }

  /* ---------------- Abilities ---------------- */
  function emptyAbility(name){
    return {name:String(name||""),onEnter:{stages:[],weather:null,field:null,foeAccFirstTurn:0},onHit:[],onKO:{stages:[],healPct:0,nextPhys:0},
      lowHp:null,weatherSpeed:null,weatherBoost:[],pinch:null,immune:{status:new Set(),flinch:false,powder:false,drain:false,types:new Set(),intimidate:false,statDrop:false},
      absorb:{},onHurtContact:[],dmgTaken:[],tinted:false,maxHits:false,endTurn:{stages:[],healPct:0},sturdy:false,guts:false,
      critMode:null,aerial:false,keepOnMiss:false,ruin:[],notes:[]};
  }
  const OFFICIAL={
    "intimidate":a=>a.onEnter.stages.push({who:"foe",stat:"atk",n:-1}),
    "sword of ruin":a=>a.ruin.push({stat:"def",pct:25}),"beads of ruin":a=>a.ruin.push({stat:"spd",pct:25}),
    "tablets of ruin":a=>a.ruin.push({stat:"atk",pct:25}),"vessel of ruin":a=>a.ruin.push({stat:"spa",pct:25}),
    "drizzle":a=>a.onEnter.weather={kind:"rain",turns:5},"drought":a=>a.onEnter.weather={kind:"sun",turns:5},
    "sand stream":a=>a.onEnter.weather={kind:"sand",turns:5},"snow warning":a=>a.onEnter.weather={kind:"snow",turns:5},
    "swift swim":a=>a.weatherSpeed="rain","chlorophyll":a=>a.weatherSpeed="sun","sand rush":a=>a.weatherSpeed="sand","slush rush":a=>a.weatherSpeed="hail",
    "speed boost":a=>a.endTurn.stages.push({who:"self",stat:"spe",n:1}),
    "static":a=>a.onHurtContact.push({st:"par",chance:30}),"poison point":a=>a.onHurtContact.push({st:"psn",chance:30}),"flame body":a=>a.onHurtContact.push({st:"brn",chance:30}),
    "levitate":a=>a.immune.types.add("Ground"),"flash fire":a=>{a.immune.types.add("Fire");},
    "water absorb":a=>{a.immune.types.add("Water");a.absorb.Water=25;},"volt absorb":a=>{a.immune.types.add("Electric");a.absorb.Electric=25;},
    "sap sipper":a=>{a.immune.types.add("Grass");},"lightning rod":a=>a.immune.types.add("Electric"),"storm drain":a=>a.immune.types.add("Water"),"motor drive":a=>a.immune.types.add("Electric"),
    "inner focus":a=>{a.immune.flinch=true;a.immune.intimidate=true;},"own tempo":a=>a.immune.status.add("cnf"),"insomnia":a=>a.immune.status.add("slp"),"vital spirit":a=>a.immune.status.add("slp"),
    "limber":a=>a.immune.status.add("par"),"immunity":a=>{a.immune.status.add("psn");a.immune.status.add("tox");},"water veil":a=>{a.immune.status.add("brn");a.immune.status.add("dbrn");},
    "magma armor":a=>a.immune.status.add("frz"),"clear body":a=>a.immune.statDrop=true,"white smoke":a=>a.immune.statDrop=true,"keen eye":a=>a.immune.statDrop=true,
    "sturdy":a=>a.sturdy=true,"guts":a=>a.guts=true,"tinted lens":a=>a.tinted=true,"skill link":a=>a.maxHits=true,"overcoat":a=>a.immune.powder=true,
    "blaze":a=>a.pinch="Fire","torrent":a=>a.pinch="Water","overgrow":a=>a.pinch="Grass","swarm":a=>a.pinch="Bug"
  };

  /* Protosynthesis / Quark Drive (oficial + texto da ficha):
     maior atributo ×1,3 (Speed ×1,5) no Sol (ou Electric Terrain) ou com Booster Energy,
     e bônus escritos: "+1QD em golpes físicos Ground e Fighting", "+20 de Speed",
     "na primeira vez … reduz em −1QD o dano físico recebido até o fim do turno". */
  function parseParadox(a,nm,T){
    a.proto={weather:nm==="protosynthesis"?"sun":null,mult:1.3,speMult:1.5,boost:null,speedFlat:0,firstGuard:null};
    for(const s of sentences(T)){
      const b=/golpes\s+(f[íi]sicos|especiais)?\s*([^.]*?)\s+(?:recebem|ganham|causam)\s*\+\s*(\d)\s*(?:QD|dados? da QD)/i.exec(s);
      if(b){a.proto.boost={cat:b[1]?(/f[íi]s/i.test(b[1])?"physical":"special"):null,types:typesIn(b[2]),dice:Number(b[3])};continue;}
      const sp=/\+\s*(\d+)\s*de\s*(?:Speed|Velocidade)/i.exec(s);if(sp){a.proto.speedFlat=Number(sp[1]);continue;}
      const g=/primeira vez[^.]*?(?:reduz|diminui)[^.]*?[−–-]\s*(\d)\s*QD(?:[^.]*?(f[íi]sico|especial))?/i.exec(s);
      if(g){a.proto.firstGuard={dice:Number(g[1]),cat:g[2]?(/f[íi]s/i.test(g[2])?"physical":"special"):null};continue;}
      const m=/×\s*(\d+[.,]\d+)/.exec(s);if(m&&/maior atributo|highest stat/i.test(s))a.proto.mult=Number(m[1].replace(",","."));
    }
    return a;
  }
  function parseAbility(name,text){
    const a=emptyAbility(name);
    const nm=key(name);
    const T=String(text||"");
    if(nm==="protosynthesis"||nm==="quark drive")return parseParadox(a,nm,T);
    for(const s of sentences(T)){
      const low=s.toLowerCase();
      // fora de combate: ignora
      if(/fora de combate|fora da batalha|outside of battle/i.test(s))continue;
      // aura que reduz um atributo de todos os outros (Sword of Ruin e afins)
      {const rx=/(?:reduz|diminui|abaixa|corta)\w*\s+(?:em\s+)?(\d+)\s*%\s+(?:d[oa]s?\s+|[oa]s?\s+)?(ataque especial|defesa especial|sp\.?\s*atk|sp\.?\s*def|ataque|defesa|velocidade|speed|attack|defense)\b[^.]*?(todos os outros|outros pok[eé]mon|dos? inimigos?|dos? advers[aá]rios?|dos? oponentes?|do alvo|dos? rivais?)/i.exec(s)
          ||/(?:lowers?|reduces?)\s+the\s+(sp\.?\s*atk|sp\.?\s*def|attack|defense|speed)\s+of\s+all\s+(?:other\s+)?pok[eé]mon/i.exec(s);
        if(rx){const pct=rx.length>3?Number(rx[1]):25,word=(rx.length>3?rx[2]:rx[1]).toLowerCase().replace(/\s+/g," ");
          const stat=/ataque especial|sp\.? ?atk/.test(word)?"spa":/defesa especial|sp\.? ?def/.test(word)?"spd":/ataque|attack/.test(word)?"atk":/defesa|defense/.test(word)?"def":"spe";
          if(pct>0&&pct<100){a.ruin.push({stat,pct});continue;}}}
      // imunidades
      if(/imune|immune|n[ãa]o pode ser|cannot be|impede/i.test(s)){
        if(!/de p[óo]|powder/i.test(s))statusKeys(s).forEach(k=>{a.immune.status.add(k);if(k==="psn")a.immune.status.add("tox");if(k==="brn")a.immune.status.add("dbrn");});
        if(/flinch|hesit/i.test(s))a.immune.flinch=true;
        if(/de p[óo]|powder/i.test(s))a.immune.powder=true;
        if(/drenam|leech seed|drain/i.test(s))a.immune.drain=true;
        if(/intimida|medo|intimidate/i.test(s))a.immune.intimidate=true;
        if(/redu[çc][õo]es de (attack|ataque)|stat drops?|redu[çc][õo]es de atributos/i.test(s))a.immune.statDrop=true;
        const tm=/(?:imune a|immune to) (?:golpes |moves |ataques )?(?:do tipo )?(\w+)/i.exec(s);
        if(tm){const t=TYPES.find(x=>x.toLowerCase()===tm[1].toLowerCase())||TYPE_PT[tm[1].toLowerCase()];if(t)a.immune.types.add(t);}
        continue;
      }
      // bônus em clima: "Durante chuva ..., seus ataques do tipo Water causam +1d6"
      const wk=weatherKey(s);
      if(wk&&/durante|enquanto|while|during|sob|em clima/i.test(s)){
        const dm=/\+\s*(\d)\s*(?:d6|dados?\s+da\s+QD)/i.exec(s);const ts=typesIn(s);
        if(dm)a.weatherBoost.push({weather:wk,types:ts,dice:Number(dm[1])});
        if(/speed|velocidade/i.test(s)&&/(dobra|aument|ganha|double)/i.test(s))a.weatherSpeed=wk;
        if(!dm&&!a.weatherSpeed)a.notes.push(s);
        continue;
      }
      // ao entrar em campo
      if(/ao entrar em campo|sempre que entra|quando entra em campo|on (?:switch|entering)|ao entrar na batalha|ao ser enviado/i.test(s)){
        const wk2=weatherKey(s);
        if(wk2&&/cria|ativa|invoca|summons?|inicia|causa/i.test(s)){const t=/(\d+)\s*(?:turnos|rodadas)/i.exec(s);a.onEnter.weather={kind:wk2,turns:t?Number(t[1]):5};}
        if(/campo real|royal field/i.test(s)){const t=/(\d+)\s*(?:turnos|rodadas)/i.exec(s);a.onEnter.field={kind:"royal",turns:t?Number(t[1]):3};}
        parseStages(s,"self").forEach(x=>a.onEnter.stages.push(x));
        continue;
      }
      if(/^inimigos recebem|^os inimigos|^oponentes recebem/i.test(s)&&/est[áa]gio/i.test(s)&&/primeiro turno|first turn/i.test(s)){
        parseStages(s,"foe").forEach(x=>{if(x.stat==="acc")a.onEnter.foeAccFirstTurn=x.n;else a.onEnter.stages.push({...x,who:"foe",rounds:1});});continue;
      }
      if(/todos os aliados/i.test(s)&&/est[áa]gio/i.test(s)){parseStages(s,"team").forEach(x=>a.onEnter.stages.push({...x,who:"team"}));continue;}
      // derrotar / nocautear
      if(/derrota|nocaute|derrubar|knocks? out|faints? a|defeats?/i.test(s)){
        parseStages(s,"self").forEach(x=>a.onKO.stages.push({...x,who:"self"}));
        const h=/recupera\s+(\d+)\s*%/i.exec(s);if(h)a.onKO.healPct=Number(h[1]);
        const nx=/\+\s*(\d)\s*(?:d6|dados?\s+da\s+QD)[^.]*pr[óo]ximo ataque( f[íi]sico)?/i.exec(s);if(nx)a.onKO.nextPhys=Number(nx[1]);
        continue;
      }
      // HP baixo
      const hp=/hp[^.]*(?:abaixo de|menos de|cai (?:para|abaixo)|below|at or below)\s*(?:de\s*)?(\d+)\s*%|(?:1\/3|um ter[çc]o) ou menos/i.exec(s);
      if(hp){const pct=hp[1]?Number(hp[1]):34;a.lowHp={pct,stages:parseStages(s,"self").map(x=>({...x,who:"self"})),once:/uma vez|once/i.test(s)};
        const ts=typesIn(s);if(ts.length&&/(1,5|\+\s*1\s*(?:d6|dado da QD)|dano)/i.test(s))a.pinch=ts[0];continue;}
      // ao receber golpe de contato
      if(/(recebe|sofre|[ée] atingid\w*|is hit|takes? damage)[^.]*(f[íi]sico|contato|contact|physical)/i.test(s)||/golpes de contato contra/i.test(s)){
        const sts=statusKeys(s);const ch=chanceIn(s);
        sts.forEach(st=>a.onHurtContact.push({st,chance:ch===100&&/podem|pode|may/i.test(s)?30:ch}));
        continue;
      }
      // ao acertar
      if(/acerta|acertar|hits?|ao usar|quando usa/i.test(s)&&/est[áa]gio/i.test(s)){
        const cond={};
        if(/f[íi]sico|physical/i.test(s))cond.cat="physical";if(/especial|special/i.test(s))cond.cat="special";
        if(/contato|contact/i.test(s))cond.contact=true;
        if(/cr[íi]tico|critical/i.test(s))cond.crit=true;
        if(/flinch|recuar|hesitar/i.test(s))cond.flinch=true;
        // "do tipo Fighting" / "Se o golpe for Fire ou Fighting"
        const parts=s.split(/\.\s*/);
        parseStages(s,"self").forEach(x=>{
          const seg=s;const tm=/(?:do tipo|for|tipo)\s+((?:\w+)(?:\s+ou\s+\w+)*)/i.exec(seg);
          const ts=tm?typesIn(tm[0]):[];
          a.onHit.push({cond:{...cond,types:ts.length?ts:null},stage:{...x,who:x.who==="foe"?"foe":"self"}});
        });
        if(/at[ée] errar|mant[ée]m[^.]*at[ée] errar/i.test(s))a.keepOnMiss=true;
        continue;
      }
      if(/se o golpe for/i.test(s)&&/est[áa]gio/i.test(s)){
        const ts=typesIn(s);parseStages(s,"self").forEach(x=>a.onHit.push({cond:{types:ts,contact:true},stage:{...x,who:"self"}}));continue;
      }
      // fim do turno
      if(/fim de cada turno|fim do turno|end of each turn|ao fim de cada rodada/i.test(s)){
        parseStages(s,"self").forEach(x=>a.endTurn.stages.push(x));
        const h=/recupera\s+(\d+)\s*%|recupera\s+1\/(\d+)/i.exec(s);if(h)a.endTurn.healPct=h[1]?Number(h[1]):Math.round(100/Number(h[2]));
        continue;
      }
      // dano recebido reduzido: "recebe -1d6 de dano Fire"
      const dt=/recebe\s*[−\-–]\s*(\d)\s*(?:d6|dados?\s+da\s+QD)\s*de dano\s*(\w+)?/i.exec(s);
      if(dt){const t=TYPES.find(x=>x.toLowerCase()===String(dt[2]||"").toLowerCase());a.dmgTaken.push({type:t||null,dice:-Number(dt[1]),fullHp:/hp cheio|full hp/i.test(s)});continue;}
      // pouco efetivo vira neutro
      if(/pouco efetivos?[^.]*(neutro|normal)|not very effective[^.]*(normal|neutral)/i.test(s)){a.tinted=true;continue;}
      if(/multi-?hit[^.]*(m[áa]ximo|maximum)/i.test(s)){a.maxHits=true;continue;}
      a.notes.push(s);
    }
    const off=OFFICIAL[nm];if(off)off(a);
    if(SPECIAL[nm])SPECIAL[nm](a,T);
    return a;
  }

  /* Abilities com regras que não cabem nos padrões acima. O motor lê
     estas marcações em pontos específicos da batalha. */
  const SPECIAL={
    "royal field":a=>{a.onEnter.field={kind:"royal",turns:3};a.onEnter.stages=a.onEnter.stages.filter(x=>!(x.who==="foe"&&x.stat==="spe"));a.immune.powder=true;a.royal=true;},
    "command pheromone":a=>{a.onEnter.stages=[{who:"team",stat:"atk",n:1,cap:3}];a.onEnter.foeAccFirstTurn=-1;a.onKO.healPct=a.onKO.healPct||10;},
    "swagger drive":a=>{a.onEnter.stages=[{who:"self",stat:"atk",n:1}];a.onHit=a.onHit.filter(h=>!h.cond.crit);a.critMode={turns:2,physDice:1,immuneDrops:["atk","spe"]};},
    "toxic shell":a=>{a.onHurtContact=[{st:"psn",chance:35}];a.immune.status.add("tox");a.immune.drain=true;},
    "emergency dash":a=>{a.lowHp={pct:50,stages:[{who:"self",stat:"spe",n:2}],once:true};},
    "hydro rush":a=>{a.onHit=[{cond:{cat:"physical",types:["Fighting"]},stage:{who:"self",stat:"spe",n:1}}];a.weatherBoost=[{weather:"rain",types:["Water"],dice:1}];},
    "hydro rush+":a=>{},
    "killer instinct":a=>{a.onKO={stages:[{who:"self",stat:"spe",n:1}],healPct:0,nextPhys:1};},
    "kappa style":a=>{a.maxHits=true;a.onKO.stages=[{who:"self",stat:"acc",n:1}];},
    "aerial momentum":a=>{a.aerial=true;a.onHit=[{cond:{flinch:true},stage:{who:"self",stat:"spe",n:1,cap:3}}];},
    "blazing heart":a=>{a.onHit=[{cond:{contact:true},stage:{who:"self",stat:"atk",n:1,cap:3}},{cond:{contact:true,types:["Fire","Fighting"]},stage:{who:"self",stat:"spe",n:1}}];a.keepOnMiss=true;},
    "water veil":a=>{a.immune.status.add("brn");a.immune.status.add("dbrn");}
  };

  const api={parseMove,parseAbility,parseStages,statusKeys,weatherKey,STAT_LABEL,STATUS_LABEL,WEATHER_LABEL,key,SEMI_HIT,MECH};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.hhArenaRules=api;
})(typeof window!=="undefined"?window:globalThis);
