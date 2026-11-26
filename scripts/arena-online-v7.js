/* ============================================================
   V7 — Arena Online
   Lobby em tempo real para desafiar amigos e assistir batalhas,
   numa tela própria (botão ⚔ Arena no topo), sem ocupar a ficha.

   Rede: Supabase Realtime (presença + mensagens), canal por sala.
   Nada é gravado no banco e a batalha não altera a ficha: cada
   jogador leva uma cópia do time (até 6, na ordem da ficha) e
   começa com HP cheio. Quem desafia é o anfitrião: ele resolve os
   turnos com scripts/arena-engine-v7.js e manda o resultado a todos.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined"||!window.hhArenaEngine)return;

  const SB_URL="https://eoteckuikfmhfmkbbndc.supabase.co";
  const SB_KEY="sb_publishable_a7zlErG9omVgrP_W9MK-4w_yjvP3Qd8";
  const SB_JS="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const ls={get(k,d=""){try{return localStorage.getItem(k)??d;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const buzz=ms=>{try{navigator.vibrate?.(ms);}catch(e){}};
  const uidShort=()=>Math.random().toString(36).slice(2,10);
  const normRoom=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9-]/g,"").slice(0,24)||"geral";
  const typeColor=t=>{try{return moveTypePalette(t).main;}catch(e){return "#8a90a0";}};
  const typeDark=t=>{try{return moveTypePalette(t).dark;}catch(e){return "#4a5060";}};

  const me={id:(()=>{let v="";try{v=sessionStorage.getItem("hh_arena_id")||"";}catch(e){}if(!v){v="t"+uidShort();try{sessionStorage.setItem("hh_arena_id",v);}catch(e){}}return v;})(),
    /* O nome na arena é sempre o do personagem do Trainer Card */
    get name(){let n="";try{n=String(ensureTrainerData().name||"").trim();}catch(e){}return (n||"Treinador").slice(0,24);}};
  const engine=window.hhArenaEngine.create({
    statDice:v=>statDice(v),powerToDice:p=>powerToDice(p),
    typeMultiplier:(t,defs)=>defensiveMultiplier(t,defs),normalizeType:t=>normalizeTypeName(t)
  });

  let sb=null,lobby=null,battleCh=null,room=normRoom(new URLSearchParams(location.search).get("arena")||ls.get("hh_arena_room","geral"));
  /* Cenários: os mesmos da Batalha da ficha (assets/arenas) */
  const SCENES=(()=>{try{return Object.entries(COMBAT_ARENAS).map(([v,o])=>({v,label:o.label}));}catch(e){return [{v:"standard",label:"Padrão"}];}})();
  const sceneOk=v=>SCENES.some(x=>x.v===v);
  let scene=(()=>{const v=ls.get("hh_arena_scene");if(v==="random"||sceneOk(v))return v;const c=typeof current!=="undefined"?current?.combatArena:"";return sceneOk(c)?c:"standard";})();
  const pickScene=v=>v==="random"||!sceneOk(v)?SCENES[Math.floor(Math.random()*SCENES.length)].v:v;
  const sceneLabel=v=>SCENES.find(x=>x.v===v)?.label||"Padrão";
  /* Dano: "classic" (regra da ficha) ou "matrix" (🧪 Dano experimental / QD) */
  let dmgMode=(()=>{const v=ls.get("hh_arena_dmg");if(v==="matrix"||v==="classic")return v;return state.damageMatrix&&state.damageMatrix.enabled!==false?"matrix":"classic";})();
  const DMG_LABEL={classic:"Dano da ficha",matrix:"🧪 Dano experimental (QD)"};
  let people={},chat=[],outgoing=null,incoming=null,myTeamCache=null;
  // batalha atual: {id,role:'p1'|'p2'|'spec',host:bool,state,teams,format,opp,names,playing}
  let B=null;
  /* Desafio Sem Fim: corrida atual (time, HP que sobra entre ondas, onda) */
  let RUN=null,RANK={list:null,loading:false,error:""};
  const SURV=()=>window.hhArenaSurvival;
  const aiRules={typeMultiplier:(t,d)=>defensiveMultiplier(t,d),normalizeType:t=>normalizeTypeName(t)};
  function playerKey(){
    let k=state.arenaPlayerKey||ls.get("hh_arena_pkey");
    if(!k){k="k"+Math.random().toString(36).slice(2)+Date.now().toString(36);}
    if(state.arenaPlayerKey!==k){state.arenaPlayerKey=k;try{(typeof debouncedSave==="function"?debouncedSave:saveState)();}catch(e){}}
    ls.set("hh_arena_pkey",k);return k;
  }

  /* ---------- Carregamento do Supabase ---------- */
  function loadSb(){
    if(window.supabase?.createClient)return Promise.resolve();
    return new Promise((ok,ko)=>{const s=document.createElement("script");s.src=SB_JS;s.onload=ok;s.onerror=()=>ko(new Error("sem conexão"));document.head.appendChild(s);});
  }

  /* ---------- Cópia do time ---------- */
  async function compactImage(src,max=160){
    if(!src)return "";
    try{
      const abs=new URL(src,location.href).href;
      if(!abs.startsWith("data:"))return abs;
      const img=new Image();img.decoding="async";
      await new Promise((ok,ko)=>{img.onload=ok;img.onerror=ko;img.src=abs;});
      const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.naturalWidth*s));c.height=Math.max(1,Math.round(img.naturalHeight*s));
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      return c.toDataURL("image/webp",.82);
    }catch(e){return "";}
  }
  /* Time da arena: o jogador escolhe quais Pokémon levam (até 6) e a ordem;
     sem escolha, vai a Equipe da ficha. */
  const fichaTeam=()=>state.pokemon.filter(p=>(p.storageGroup||"team")==="team").slice(0,6);
  /* A escolha fica na memória, na própria ficha (vai junto no salvamento)
     e, se couber, no navegador. Antes ficava só no navegador: quando o
     armazenamento estava cheio (fichas com muitas artes), o clique não fazia nada. */
  let pickMem=null;
  function pickIds(){
    let ids=pickMem;
    if(!ids&&Array.isArray(state.arenaPick))ids=state.arenaPick;
    if(!ids){try{ids=JSON.parse(ls.get("hh_arena_pick","[]"))||[];}catch(e){ids=[];}}
    const known=new Set(state.pokemon.map(p=>String(p.id)));
    return ids.map(String).filter(id=>known.has(id)).slice(0,6);
  }
  function savePick(ids){
    pickMem=ids.slice(0,6);
    state.arenaPick=pickMem.slice();
    try{(typeof debouncedSave==="function"?debouncedSave:saveState)();}catch(e){}
    ls.set("hh_arena_pick",JSON.stringify(pickMem));
  }
  function teamSource(){
    const ids=pickIds();
    if(!ids.length)return fichaTeam();
    const by=new Map(state.pokemon.map(p=>[String(p.id),p]));
    return ids.map(id=>by.get(id)).filter(Boolean);
  }
  function editPick(fn){
    let ids=pickIds();if(!ids.length)ids=fichaTeam().map(p=>String(p.id));
    ids=fn(ids)||ids;savePick(ids);track();render();
  }
  function localImg(p){try{return displayPokemonImage(p)||"";}catch(e){return "";}}
  function teamPreview(){
    return teamSource().map(p=>{
      let img=displayPokemonImage(p)||"";
      try{img=new URL(img,location.href).href;}catch(e){}
      return {n:p.name,lv:Number(p.level||1),t:[p.type1,p.type2].filter(Boolean),img:img.startsWith("data:")?(thumbs.get(img.length+":"+img.slice(-40))||""):img};
    });
  }
  /* Miniaturas pequenas (56px) das artes enviadas na ficha, para a lista da sala */
  const thumbs=new Map();let thumbBusy=false;
  async function ensureThumbs(){
    if(thumbBusy)return;thumbBusy=true;let changed=false;
    for(const p of teamSource()){
      const img=displayPokemonImage(p)||"";if(!img.startsWith("data:"))continue;
      const k=img.length+":"+img.slice(-40);if(thumbs.has(k))continue;
      thumbs.set(k,await compactImage(img,56));changed=true;
    }
    thumbBusy=false;if(changed){track();render();}
  }
  async function buildTeam(limit){
    const list=teamSource().slice(0,limit);
    const out=[];
    for(const p of list){
      const moves=(p.moves||[]).filter(m=>m.active&&!(typeof isMoveLevelLocked==="function"&&isMoveLevelLocked(m))).slice(0,5)
        .map(m=>({name:m.name,type:normalizeTypeName(m.type)||"Normal",category:m.category||"Status",power:Number(m.power||0),
          accuracy:m.alwaysHits||m.accuracy==null||m.accuracy===""?null:Number(m.accuracy),alwaysHits:!!m.alwaysHits,desc:String(m.description||"").slice(0,420)}));
      out.push({name:p.name||"Pokémon",level:Number(p.level||1),types:[normalizeTypeName(p.type1),normalizeTypeName(p.type2)].filter(Boolean),
        stats:{hp:Number(p.stats?.hp||0),atk:Number(p.stats?.atk||0),def:Number(p.stats?.def||0),spa:Number(p.stats?.spa||0),spd:Number(p.stats?.spd||0),spe:Number(p.stats?.spe||0)},
        maxHp:Math.max(1,Number(p.maxHp||p.stats?.hp||1)),ability:p.abilityName||"",abilityText:String(p.abilityText||"").slice(0,900),img:await compactImage(displayPokemonImage(p)),
        moves:moves.length?moves:[{name:"Struggle",type:"Normal",category:"Physical",power:50,accuracy:null,desc:"Sem golpes ativos na ficha."}]});
    }
    return out;
  }

  /* ---------- Interface: casca ---------- */
  const root=document.createElement("section");
  root.id="hhArena";root.className="ar7";root.hidden=true;root.setAttribute("aria-label","Arena Online");
  document.body.appendChild(root);
  function open(){
    root.hidden=false;document.body.classList.add("ar7-open");sfx("page");
    connect();render();ensureThumbs();
  }
  function close(){
    if(B&&B.role!=="spec"&&B.state&&B.state.phase!=="end"&&!confirm("Sair da arena desiste da batalha atual. Sair mesmo?"))return;
    if(B)leaveBattle(true);
    root.hidden=true;document.body.classList.remove("ar7-open");
    disconnect();
  }
  document.addEventListener("hh:render",()=>{if(lobby&&!B&&me.name!==lastTrackedName)track();});
  window.hhArena={open,close,get battle(){return B;},get rank(){return RANK;}};

  /* Botão ⚔ Arena no topo (computador e celular) */
  const brand=document.querySelector(".topbar .brand");
  if(brand&&!document.getElementById("hhArenaBtn")){
    brand.insertAdjacentHTML("afterend",`<button type="button" id="hhArenaBtn" class="ar7-open-btn" aria-label="Arena Online: desafie amigos" title="Arena Online: desafie amigos">
      <span class="ar7-open-ico" aria-hidden="true">⚔</span><span class="ar7-open-txt">Arena</span><i class="ar7-open-dot" hidden></i></button>`);
    const btn=document.getElementById("hhArenaBtn");
    btn.addEventListener("click",open);
    // No computador o botão fica junto das ferramentas; no celular, ao lado do ⋮.
    const mq=matchMedia("(min-width:901px)"),tools=document.getElementById("mobileToolsPanel");
    const place=()=>{if(mq.matches&&tools)tools.prepend(btn);else brand.after(btn);};
    place();mq.addEventListener?.("change",place);
  }

  /* ---------- Rede: lobby ---------- */
  let connecting=false,status="off",lastTrackedName="";
  async function connect(){
    if(lobby||connecting)return;
    connecting=true;status="connecting";render();
    try{
      await loadSb();
      sb=sb||window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      lobby=sb.channel("hh-arena:"+room,{config:{presence:{key:me.id},broadcast:{self:false}}});
      lobby.on("presence",{event:"sync"},()=>{
        const st=lobby.presenceState();people={};
        Object.entries(st).forEach(([id,arr])=>{if(arr&&arr[0])people[id]=arr[arr.length-1];});
        if(outgoing&&!people[outgoing.to]){outgoing=null;toast("O treinador saiu do lobby.");}
        render();
      });
      lobby.on("broadcast",{event:"chat"},({payload})=>{chat.push(payload);chat=chat.slice(-60);if(tab!=="chat")unread++;render();if(!root.hidden)sfx("type");});
      lobby.on("broadcast",{event:"challenge"},({payload})=>onChallenge(payload));
      lobby.on("broadcast",{event:"challenge-cancel"},({payload})=>{if(incoming&&incoming.id===payload.id){incoming=null;render();}});
      lobby.on("broadcast",{event:"challenge-reply"},({payload})=>onReply(payload));
      await new Promise((ok,ko)=>lobby.subscribe(st=>{if(st==="SUBSCRIBED")ok();else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT")ko(new Error(st));}));
      status="on";await track();loadRank();
    }catch(e){status="error";lobby=null;}
    connecting=false;render();
  }
  function disconnect(){
    try{lobby&&sb?.removeChannel(lobby);}catch(e){}
    lobby=null;people={};status="off";outgoing=null;incoming=null;
  }
  async function switchRoom(next){
    next=normRoom(next);if(next===room&&lobby)return;
    if(B){toast("Termine a batalha antes de trocar de sala.");return;}
    room=next;ls.set("hh_arena_room",room);disconnect();chat=[];await connect();
  }
  function myStatus(){
    if(RUN)return {status:"survival",wave:RUN.wave};
    if(!B)return {status:"idle"};
    if(B.role==="spec")return {status:"watch",battle:B.id};
    return {status:"battle",battle:B.id,vs:B.names?.[B.role==="p1"?"p2":"p1"]||""};
  }
  async function track(){
    if(!lobby)return;
    lastTrackedName=me.name;
    try{await lobby.track({id:me.id,name:me.name,team:teamPreview(),at:Date.now(),...myStatus(),names:B?.names||null});}catch(e){}
  }
  const send=(ch,event,payload)=>ch?.send({type:"broadcast",event,payload});

  /* ---------- Desafios ---------- */
  function challenge(to,format){
    const id="b"+uidShort();
    outgoing={id,to,format,at:Date.now()};
    outgoing.arena=pickScene(scene);outgoing.dmg=dmgMode;
    send(lobby,"challenge",{id,from:me.id,fromName:me.name,to,format,arena:outgoing.arena,dmg:outgoing.dmg});
    sfx("select");render();
    setTimeout(()=>{if(outgoing&&outgoing.id===id){send(lobby,"challenge-cancel",{id});outgoing=null;toast("O desafio expirou.");render();}},45000);
  }
  function onChallenge(p){
    if(p.to!==me.id)return;
    if(B||incoming){send(lobby,"challenge-reply",{id:p.id,to:p.from,from:me.id,accept:false,busy:true});return;}
    incoming=p;sfx("select");buzz([60,40,60]);
    if(root.hidden)document.getElementById("hhArenaBtn")?.querySelector(".ar7-open-dot")?.removeAttribute("hidden");
    render();
  }
  function reply(accept){
    if(!incoming)return;
    const p=incoming;incoming=null;
    send(lobby,"challenge-reply",{id:p.id,to:p.from,from:me.id,accept});
    if(accept)joinBattle({id:p.id,role:"p2",format:p.format,arena:p.arena,dmg:p.dmg,names:{p1:p.fromName,p2:me.name}});
    render();
  }
  function onReply(p){
    if(p.to!==me.id||!outgoing||outgoing.id!==p.id)return;
    const o=outgoing;outgoing=null;
    if(!p.accept){toast(p.busy?"O treinador está ocupado.":"Desafio recusado.");render();return;}
    joinBattle({id:o.id,role:"p1",format:o.format,arena:o.arena,dmg:o.dmg,names:{p1:me.name,p2:people[o.to]?.name||"Rival"}});
  }

  /* ---------- Batalha: rede ---------- */
  async function joinBattle({id,role,format,names,arena,dmg}){
    B={id,role,dmg:dmg==="matrix"?"matrix":"classic",arena:sceneOk(arena)?arena:"standard",host:role==="p1",format:Number(format)||3,names,state:null,teams:null,pendingTeams:{},specs:{},queue:[],playing:false,log:[],chosen:false};
    for(const k in lastHp)delete lastHp[k];
    sfx("page");render();
    battleCh=sb.channel("hh-arena-b:"+id,{config:{presence:{key:me.id},broadcast:{self:false}}});
    battleCh.on("presence",{event:"sync"},onBattlePresence);
    battleCh.on("broadcast",{event:"team"},({payload})=>{if(B?.host)hostTeam(payload);});
    battleCh.on("broadcast",{event:"action"},({payload})=>{if(B?.host)hostAction(payload.side,payload.action,payload.turn);});
    battleCh.on("broadcast",{event:"sync"},()=>{if(B?.host&&B.state)send(battleCh,"start",{teams:B.teams,state:pub(B.state),names:B.names,format:B.format,arena:B.arena,dmg:B.dmg});});
    battleCh.on("broadcast",{event:"start"},({payload})=>{if(!B||B.host)return;if(!B.teams){B.teams=payload.teams;B.names=payload.names;B.format=payload.format;}if(sceneOk(payload.arena))B.arena=payload.arena;if(payload.dmg)B.dmg=payload.dmg;applyState(payload.state,true);});
    battleCh.on("broadcast",{event:"state"},({payload})=>{if(!B||B.host)return;applyState(payload,false);});
    battleCh.on("broadcast",{event:"emote"},({payload})=>showEmote(payload));
    await new Promise(ok=>battleCh.subscribe(st=>{if(st==="SUBSCRIBED")ok();}));
    await battleCh.track({id:me.id,name:me.name,role});
    if(role==="spec")send(battleCh,"sync",{});
    else{
      const team=await buildTeam(B.format);
      if(B.host)hostTeam({side:"p1",id:me.id,name:me.name,team});
      else{
        const sendTeam=()=>{if(B&&!B.teams)send(battleCh,"team",{side:"p2",id:me.id,name:me.name,team});};
        sendTeam();B.resend=setInterval(()=>{if(!B||B.teams)clearInterval(B?.resend);else sendTeam();},2500);
      }
    }
    await track();render();
  }
  function onBattlePresence(){
    if(!B||!battleCh)return;
    const list=Object.values(battleCh.presenceState()).map(a=>a[a.length-1]);
    B.specs=Object.fromEntries(list.filter(x=>x.role==="spec").map(x=>[x.id,x.name]));
    B.seen=B.seen||{};
    const roles=new Set(list.map(x=>x.role));
    roles.forEach(r=>{B.seen[r]=true;});
    // Só conta como saída quem já esteve na sala e continua fora depois de 5 s
    // (a presença pode chegar depois das primeiras mensagens).
    for(const s of ["p1","p2"])if(B.seen[s]&&!roles.has(s)&&!B.gone?.[s]){
      B.gone=B.gone||{};B.gone[s]=setTimeout(()=>checkGone(s),5000);
    }else if(roles.has(s)&&B.gone?.[s]){clearTimeout(B.gone[s]);delete B.gone[s];}
    render();
  }
  function checkGone(s){
    if(!B||!battleCh)return;
    delete B.gone[s];
    const still=Object.values(battleCh.presenceState()).some(a=>a[a.length-1]?.role===s);
    if(still)return;
    if(B.host&&s==="p2"&&B.state&&B.state.phase!=="end"){engine.walkover(B.state,"p2");broadcastState();}
    else if(!B.host&&s==="p1"&&B.view&&B.view.phase!=="end"){B.view.phase="end";B.view.winner=null;pushLog([{k:"hostleft"}]);render();track();}
  }
  function leaveBattle(silent){
    if(!B)return;
    if(B.solo){
      if(RUN&&B.state&&B.state.phase!=="end")endRun("desistiu");
      B=null;RUN=null;track();if(!silent)render();return;
    }
    if(B.role!=="spec"&&B.state&&B.state.phase!=="end"){
      if(B.host){engine.walkover(B.state,"p1");broadcastState();}
      else send(battleCh,"action",{side:B.role,action:{kind:"forfeit"},turn:B.state.turn});
    }
    clearInterval(B.resend);
    const ch=battleCh;battleCh=null;B=null;
    setTimeout(()=>{try{ch&&sb?.removeChannel(ch);}catch(e){}},600);
    track();if(!silent)render();
  }
  function spectate(id,names){
    if(B)return;
    joinBattle({id,role:"spec",format:3,names});
  }

  /* ---------- Batalha: anfitrião ---------- */
  function hostTeam(p){
    if(!B?.host||B.state)return;
    B.pendingTeams[p.side]={id:p.id,name:p.name,team:p.team};
    if(B.pendingTeams.p1&&B.pendingTeams.p2){
      B.state=engine.newBattle({id:B.id,format:B.format,p1:B.pendingTeams.p1,p2:B.pendingTeams.p2,damage:B.dmg});
      B.teams=B.state.teams;B.names={p1:B.pendingTeams.p1.name,p2:B.pendingTeams.p2.name};
      B.started=true;
      send(battleCh,"start",{teams:B.teams,state:pub(B.state),names:B.names,format:B.format,arena:B.arena,dmg:B.dmg});
      applyState(pub(B.state),true);track();
    }
  }
  function hostAction(side,action,turn){
    if(!B?.host||!B.state)return;
    if(turn!=null&&turn!==B.state.turn&&action.kind!=="forfeit")return;
    let ready=engine.submit(B.state,side,action);
    if(B.solo&&side==="p1"&&!ready)ready=aiAct();
    if(ready){engine.resolve(B.state);broadcastState();if(B.solo)soloFollowUp();}
    else{broadcastState(true);}
  }
  function aiAct(){
    if(!B?.solo||!B.state||B.state.phase==="end")return false;
    if(!engine.canAct(B.state,"p2"))return false;
    const a=SURV()?.choose(B.state,engine,"p2",aiRules);
    return a?engine.submit(B.state,"p2",a):false;
  }
  function soloFollowUp(){
    // o oponente troca sozinho quando o Pokémon dele desmaia
    for(let k=0;k<4&&B?.state?.phase==="switch"&&B.state.sides.p2.needSwitch&&!B.state.sides.p2.pending;k++){
      const ready=aiAct();
      if(ready){engine.resolve(B.state);broadcastState();}else break;
    }
  }
  function pub(s){
    // estado sem os times (que já foram enviados no início)
    return {id:s.id,format:s.format,turn:s.turn,phase:s.phase,winner:s.winner,reason:s.reason,events:s.events||[],
      sides:Object.fromEntries(["p1","p2"].map(k=>[k,{name:s.sides[k].name,active:s.sides[k].active,needSwitch:s.sides[k].needSwitch,ready:!!s.sides[k].pending,
        team:s.sides[k].team.map(t=>({hp:t.hp,maxHp:t.maxHp,fainted:t.fainted,status:t.status||null})),...(engine.view?engine.view(s,k):{})}])),
      weather:s.weather?{...s.weather}:null};
  }
  function broadcastState(waitingOnly){
    const p=pub(B.state);if(waitingOnly)p.events=[];
    send(battleCh,"state",p);applyState(p,false);
    if(!waitingOnly)B.state.events=[];
    if(B.state.phase==="end")track();
  }

  /* ---------- Batalha: ações do jogador ---------- */
  function act(action){
    if(!B||B.role==="spec"||!B.view)return;
    B.chosen=true;sfx("select");buzz(8);
    if(B.host)hostAction("p1",action,B.view.turn);
    else send(battleCh,"action",{side:B.role,action,turn:B.view.turn});
    render();
  }

  /* ---------- Batalha: animação dos eventos ---------- */
  function applyState(s,initial){
    if(!B)return;
    const events=s.events||[];
    if(initial||!B.view){if(!B.view){B.intro=true;setTimeout(()=>{if(B){B.intro=false;if(!B.playing)render(true);}},2200);}B.view=JSON.parse(JSON.stringify(s));B.view.events=[];if(events.length)pushLog(events);render();return;}
    if(!events.length){
      // só mudou quem já escolheu
      for(const k of ["p1","p2"])B.view.sides[k].ready=s.sides[k].ready;
      B.view.phase=s.phase;render();return;
    }
    B.queue.push(s);
    if(!B.playing)playQueue();
  }
  async function playQueue(){
    if(!B)return;B.playing=true;
    while(B&&B.queue.length){
      const s=B.queue.shift();
      for(const ev of s.events){
        if(!B)return;
        pushLog([ev]);
        applyEventToView(ev);
        if(ev.k==="switch"){B.view.sides[ev.side].active=s.sides[ev.side].active;}
        if(ev.k==="faint"){B.view.sides[ev.side].team[B.view.sides[ev.side].active].fainted=true;}
        if(ev.k==="switch")render(true);else patch();
        const wait=animate(ev);
        await new Promise(r=>setTimeout(r,Math.max(wait||0,ev.k==="move"?450:ev.k==="hit"?850:ev.k==="faint"?1000:500)));
      }
      if(!B)return;
      B.view=JSON.parse(JSON.stringify(s));B.view.events=[];B.chosen=false;
      if(B.view.phase==="end"){sfx(B.view.winner===B.role?"page":"select");buzz([30,40,30]);}
      if(!B.queue.length)B.playing=false;
      const prevTurn=B.shownTurn||1;
      render(true);
      if(B.view.phase==="choose"&&B.view.turn!==prevTurn){
        B.shownTurn=B.view.turn;
        const f=root.querySelector(".ar7-field");
        if(f){const t=document.createElement("b");t.className="ar7-turnban";t.textContent="Turno "+B.view.turn;f.appendChild(t);setTimeout(()=>t.remove(),1500);}
      }
      if(B.view.phase==="end"&&B.solo&&RUN&&!RUN.done)onWaveEnd();
      if(B.view.phase==="end"){const f=root.querySelector(".ar7-field");if(f){const t=document.createElement("b");t.className="ar7-turnban end";t.textContent=B.view.winner?`${sideName(B.view.winner)} venceu!`:"Fim";f.appendChild(t);}}
    }
    if(B)B.playing=false;
  }
  function sideName(s){return B?.names?.[s]||s;}
  function monName(side,idx){const t=B?.teams?.[side];const i=idx??B?.view?.sides?.[side]?.active;return t?.[i]?.name||"Pokémon";}
  function effText(m){return m===0?"Não teve efeito…":m>=4?"Extremamente efetivo!":m>=2?"É super efetivo!":m<=.25?"Quase não teve efeito…":m<=.5?"Não é muito efetivo…":"";}
  /* Atualiza o que a tela mostra a cada evento (HP, status, estágios, clima) */
  function applyEventToView(ev){
    const v=B.view;if(!v)return;
    const sd=ev.side?v.sides[ev.side]:null,t=sd?sd.team[sd.active]:null;
    if((ev.k==="hit"||ev.k==="heal"||ev.k==="sdmg")&&t&&ev.hp!=null)t.hp=ev.hp;
    if(ev.k==="status"&&!ev.fail&&sd){if(ev.st==="cnf")sd.cnf=true;else if(t)t.status=ev.st;}
    if(ev.k==="statusEnd"&&sd){if(ev.st==="cnf")sd.cnf=false;else if(t)t.status=null;}
    if(ev.k==="stage"&&sd&&ev.applied){sd.stg=sd.stg||{};sd.stg[ev.stat]=ev.total;if(!ev.total)delete sd.stg[ev.stat];}
    if(ev.k==="weather")v.weather=ev.end?null:{kind:ev.kind,turns:ev.turns};
    if(ev.k==="field"&&sd){sd.field=sd.field||{};sd.field[ev.kind]=ev.end?0:ev.turns;}
    if(ev.k==="switch"&&sd){sd.stg={};sd.cnf=false;}
    if(ev.k==="faint"&&t){t.fainted=true;t.status=null;sd.stg={};sd.cnf=false;}
  }
  const ST_LABEL={psn:"Envenenado",tox:"gravemente envenenado (Toxic)",brn:"Queimado",dbrn:"com Deep Burn",par:"Paralisado",slp:"Dormindo",frz:"Congelado",cnf:"Confuso"};
  const ST_SHORT={psn:"PSN",tox:"TOX",brn:"BRN",dbrn:"BRN+",par:"PAR",slp:"SLP",frz:"FRZ",cnf:"CNF"};
  const STAT_PT={atk:"Attack",def:"Defense",spa:"Sp.Atk",spd:"Sp.Def",spe:"Speed",acc:"Precisão",eva:"Evasão"};
  const STAT_SHORT={atk:"ATK",def:"DEF",spa:"SPA",spd:"SPD",spe:"SPE",acc:"PRE",eva:"EVA"};
  const W_LABEL={rain:"Chuva",sun:"Sol forte",sand:"Tempestade de areia",hail:"Granizo"};
  const W_ICON={rain:"🌧",sun:"☀",sand:"🌪",hail:"❄"};
  const SRC_LABEL={psn:"o veneno",tox:"o veneno (Toxic)",brn:"a queimadura",dbrn:"a queimadura profunda",sand:"a tempestade de areia",hail:"o granizo",cnf:"a confusão",recoil:"o recuo"};
  const CANT={slp:"está dormindo.",frz:"está congelado!",par:"está paralisado e não conseguiu se mover!",flinch:"hesitou e não atacou!",cnf:"está confuso e se feriu!",powder:"é imune a golpes de pó."};
  function pushLog(events){
    for(const ev of events){
      let line="",cls="";
      if(ev.k==="move"){
        line=`<b>${esc(ev.mon)}</b> (${esc(sideName(ev.side))}) usou <b class="ar7-mv" style="--t:${typeColor(ev.type)}">${esc(ev.move)}</b>!`;
        if(ev.roll!=null)line+=` <span class="ar7-dice">🎲 d100 ${ev.roll}${ev.acc!=null?` / ${ev.acc}%`:""}</span>`;
        if(ev.miss){line+=" — <i>errou!</i>";cls="miss";}
        if(ev.protect){line+=" — se protegeu!";}
        if(ev.status&&ev.desc)line+=`<small>${esc(ev.desc)}</small>`;
        if(ev.noTarget)line+=" — sem alvo.";
        if(ev.fail)line+=` — <i>falhou${ev.why?` (${esc(ev.why)})`:""}.</i>`;
        if(ev.critKind==="boosted"&&ev.crit)line+=" <small>crítico pela margem aumentada</small>";
      }else if(ev.k==="hit"){
        if(ev.immune){line=`${effText(0)}`;cls="weak";}
        else{
          line=ev.mode==="matrix"
            ?`${ev.crit?"<b class='ar7-crit'>CRÍTICO!</b> ":""}${esc(monName(ev.side))} perdeu <b>${ev.amount}</b> HP <span class="ar7-dice">🧪 ${esc(ev.expr)} [${(ev.rolls||[]).join(", ")}] · QD ${esc(ev.qd)} (Q${ev.offQ} vs Q${ev.defQ})${ev.stab?" · STAB":""}</span>`
            :`${ev.crit?"<b class='ar7-crit'>CRÍTICO!</b> ":""}${esc(monName(ev.side))} perdeu <b>${ev.amount}</b> HP <span class="ar7-dice">${ev.dice}d6 [${(ev.rolls||[]).join(", ")}]${ev.fixed?` ${ev.fixed>0?"+":""}${ev.fixed}`:""}${ev.stab?" · STAB":""}</span>`;
          const e=effText(ev.mult);if(e)line+=` <i>${e}</i>`;cls=ev.crit?"crit":ev.mult>=2?"super":ev.mult<1?"weak":"";
        }
        if(ev.notes?.length)line+=` <span class="ar7-dice">${ev.notes.map(esc).join(" · ")}</span>`;
        if(ev.hits>1)line+=` <i>(${ev.hits} acertos)</i>`;
      }else if(ev.k==="heal")line=`${esc(monName(ev.side))} recuperou <b>${ev.amount}</b> HP${ev.src?` <small class="ar7-src">${esc(ev.src)}</small>`:""}.`;
      else if(ev.k==="sdmg"){line=`${esc(ev.mon)} perdeu <b>${ev.amount}</b> HP por ${SRC_LABEL[ev.src]||esc(ev.src)}.`;cls="weak";}
      else if(ev.k==="stage"){
        const lab=STAT_PT[ev.stat]||ev.stat;
        if(ev.blocked)line=`${esc(ev.mon)} não perdeu ${lab} <small class="ar7-src">${esc(ev.src||"")}</small>.`;
        else if(!ev.applied)line=`${lab} de ${esc(ev.mon)} não ${ev.n>0?"sobe":"desce"} mais.`;
        else{const a=Math.abs(ev.applied);line=`${ev.applied>0?"⬆":"⬇"} ${lab} de <b>${esc(ev.mon)}</b> ${ev.applied>0?(a>=2?"subiu muito":"subiu"):(a>=2?"caiu muito":"caiu")} (${ev.total>0?"+":""}${ev.total})${ev.src?` <small class="ar7-src">${esc(ev.src)}</small>`:""}`;cls=ev.applied>0?"up":"down";}
      }
      else if(ev.k==="status"){
        if(ev.fail)line=`${esc(ev.mon)} não pode ficar ${ST_LABEL[ev.st]||ev.st}${ev.src?` (${esc(ev.src)})`:" (tipo)"}.`;
        else{line=`<b>${esc(ev.mon)}</b> ficou <b class="ar7-st ${ev.st}">${ST_LABEL[ev.st]||ev.st}</b>!${ev.src?` <small class="ar7-src">${esc(ev.src)}</small>`:""}`;cls="status";}
      }
      else if(ev.k==="statusEnd")line=`${esc(ev.mon)} ${ev.st==="slp"?"acordou!":ev.st==="frz"?"descongelou!":ev.st==="cnf"?"saiu da confusão.":"se recuperou."}`;
      else if(ev.k==="cant"){line=`${esc(ev.mon)} ${CANT[ev.reason]||"não conseguiu agir."}${ev.src&&ev.reason==="powder"?` <small class="ar7-src">${esc(ev.src)}</small>`:""}`;cls="miss";}
      else if(ev.k==="weather")line=ev.end?`${W_ICON[ev.kind]||""} ${W_LABEL[ev.kind]||ev.kind} acabou.`:`${W_ICON[ev.kind]||""} <b>${W_LABEL[ev.kind]||ev.kind}</b> por ${ev.turns} turnos!${ev.src?` <small class="ar7-src">${esc(ev.src)}</small>`:""}`;
      else if(ev.k==="field")line=ev.end?`👑 O Campo Real de ${esc(sideName(ev.side))} acabou.`:`👑 <b>Campo Real</b> ${ev.extended?"estendido":"ativo"}: ${ev.turns} turnos.`;
      else if(ev.k==="ability"){line=`✦ <b>${esc(ev.mon)}</b>: <b class="ar7-ab">${esc(ev.name)}</b>${ev.text?` ${esc(ev.text)}`:""}`;cls="ability";}
      else if(ev.k==="hazard")line=ev.cleared?`${esc(ev.mon)} absorveu os Toxic Spikes.`:`Toxic Spikes no lado de ${esc(sideName(ev.side))} (${ev.layers} camada${ev.layers>1?"s":""}).`;
      else if(ev.k==="info")line=esc(ev.text);
      else if(ev.k==="blocked")line=`${esc(monName(ev.side))} se protegeu do ataque!`;
      else if(ev.k==="faint"){line=`<b>${esc(ev.mon)}</b> desmaiou!`;cls="faint";}
      else if(ev.k==="switch")line=`${esc(sideName(ev.side))} trocou ${esc(ev.from)} por <b>${esc(ev.to)}</b>!`;
      else if(ev.k==="forfeit")line=`${esc(sideName(ev.side))} desistiu.`;
      else if(ev.k==="left")line=`${esc(sideName(ev.side))} saiu da arena.`;
      else if(ev.k==="hostleft")line=`O anfitrião saiu: a batalha foi encerrada.`;
      else if(ev.k==="end")line=`🏆 <b>${esc(sideName(ev.winner))}</b> venceu a batalha!`;
      if(line)B.log.push({line,cls});
    }
    B.log=B.log.slice(-80);
  }
  function animate(ev){
    const pos=s=>(s===mySide()?"me":"foe");
    const field=root.querySelector(".ar7-field");if(!field)return 0;
    let wait=0;
    try{wait=window.hhArenaFx?.play(field,ev,{pos})||0;}catch(e){}
    if(ev.k==="move"&&!window.hhArenaFx){const el=field.querySelector(`.ar7-mon.${pos(ev.side)}`);el?.classList.remove("lunge");void el?.offsetWidth;el?.classList.add("lunge");}
    if(ev.k==="switch"){const el=field.querySelector(`.ar7-mon.${pos(ev.side)}`);el?.classList.remove("enter");void el?.offsetWidth;el?.classList.add("enter");sfx("page");}
    if(ev.k==="hit"&&!ev.immune){
      const el=field.querySelector(`.ar7-mon.${pos(ev.side)}`);
      el?.classList.remove("hurt");void el?.offsetWidth;el?.classList.add("hurt");
      const n=document.createElement("b");n.className="ar7-dmg"+(ev.crit?" crit":ev.mult>=2?" super":"");n.textContent="-"+ev.amount;
      field.querySelector(`.ar7-spot.${pos(ev.side)}`)?.appendChild(n);setTimeout(()=>n.remove(),1300);
      sfx(ev.crit?"page":"type");buzz(ev.crit?[20,30,40]:15);
    }
    return wait;
  }
  /* Atualiza só HP, Pokébolas, desmaio e textos, sem redesenhar o campo
     (assim os efeitos dos golpes não são cortados no meio). */
  function patch(){
    const field=root.querySelector(".ar7-field");
    if(!B?.view||!field){render(true);return;}
    const mine=mySide(),foe=mine==="p1"?"p2":"p1";
    for(const [side,pos] of [[foe,"foe"],[mine,"me"]]){
      const sp=field.querySelector(`.ar7-spot.${pos}`);if(!sp)continue;
      const s=B.view.sides[side],st=s.team[s.active],pct=hpPct(st);
      const hp=sp.querySelector(".ar7-hp");if(hp)hp.className="ar7-hp "+hpClass(pct);
      const bar=sp.querySelector(".ar7-hp i");if(bar){bar.dataset.to=pct;bar.style.setProperty("--w",pct+"%");}
      lastHp[pos]=pct;
      const num=sp.querySelector(".ar7-hp-num");if(num)num.textContent=`${st.hp} / ${st.maxHp}`;
      sp.querySelectorAll(".ar7-balls i").forEach((b,i)=>b.classList.toggle("out",!!s.team[i]?.fainted));
      sp.querySelector(".ar7-mon")?.classList.toggle("fainted",!!st.fainted);
      const bd=sp.querySelector(".ar7-badges");if(bd)bd.innerHTML=hudBadges(s);
    }
    field.dataset.weather=B.view.weather?.kind||"";
    const ch=field.querySelector(".ar7-chips");if(ch)ch.innerHTML=fieldChips();
    const msg=root.querySelector(".ar7-msg p");if(msg&&B.log.length)msg.innerHTML=B.log[B.log.length-1].line;
    const log=root.querySelector(".ar7-log");if(log){log.innerHTML=B.log.map(l=>`<p class="${l.cls}">${l.line}</p>`).join("");log.scrollTop=log.scrollHeight;}
  }
  function mySide(){return B?.role==="p2"?"p2":"p1";}

  /* ---------- Emotes ---------- */
  const EMOTES=["👏","🔥","😮","😂","💪","😭","⚡","GG"];
  function emote(e){if(!B||!battleCh)return;const p={e,name:me.name,id:me.id};send(battleCh,"emote",p);showEmote(p);}
  function showEmote(p){
    const field=root.querySelector(".ar7-field");if(!field)return;
    const n=document.createElement("span");n.className="ar7-emote";n.style.left=(12+Math.random()*70)+"%";
    n.innerHTML=`<b>${esc(p.e)}</b><small>${esc(p.name)}</small>`;field.appendChild(n);setTimeout(()=>n.remove(),2600);
  }

  /* ---------- Render ---------- */
  let toastT;
  function toast(t){const el=root.querySelector(".ar7-toast");if(!el){if(typeof showToast==="function")showToast(t);return;}el.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{el.hidden=true;},2600);}
  function hpPct(m){return Math.max(0,Math.min(100,Math.round(100*m.hp/Math.max(1,m.maxHp))));}
  function hpClass(p){return p>50?"":p>20?"mid":"low";}

  function render(force){
    if(root.hidden)return;
    if(!force&&(B?.playing||B?.intro)&&root.querySelector(".ar7-field")){patch();return;}
    const focus=document.activeElement?.id;
    const keptScroll=root.querySelector(".ar7-scenes")?.scrollLeft;
    const kept={};["ar7Chat","ar7Room","ar7Name"].forEach(id=>{const el=document.getElementById(id);if(el)kept[id]=el.value;});
    root.innerHTML=`<div class="ar7-shell">
      <header class="ar7-top">
        <button type="button" class="ar7-back" data-ar="close" aria-label="Voltar para a ficha">← Ficha</button>
        <div class="ar7-title"><b>⚔ Arena Online</b><small>${B?(B.role==="spec"?"Assistindo batalha":"Batalha"):`Sala <code>${esc(room)}</code> · ${statusText()}`}</small></div>
        ${B?"":`<button type="button" class="ar7-share" data-ar="share" title="Copiar convite para esta sala">🔗 Convidar</button>`}
      </header>
      <div class="ar7-body">${B?battleView():lobbyView()}</div>
      <p class="ar7-toast" role="status" hidden></p>
      ${incoming?challengeDialog():""}
    </div>`;
    if(keptScroll){const n=root.querySelector(".ar7-scenes");if(n)n.scrollLeft=keptScroll;}
    Object.entries(kept).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
    if(focus){const el=document.getElementById(focus);if(el&&el.tagName==="INPUT"){el.focus();try{el.setSelectionRange(el.value.length,el.value.length);}catch(e){}}}
    const bars=[...root.querySelectorAll(".ar7-hp i[data-to]")];
    if(bars.length){requestAnimationFrame(()=>requestAnimationFrame(()=>bars.forEach(i=>i.style.setProperty("--w",i.dataset.to+"%"))));
      root.querySelectorAll(".ar7-spot").forEach(sp=>{const i=sp.querySelector(".ar7-hp i[data-to]");if(i)lastHp[sp.classList.contains("me")?"me":"foe"]=Number(i.dataset.to);});}
    const log=root.querySelector(".ar7-log");if(log)log.scrollTop=log.scrollHeight;
    const chatBox=root.querySelector(".ar7-chat-list");if(chatBox)chatBox.scrollTop=chatBox.scrollHeight;
  }
  function statusText(){return status==="on"?`${Object.keys(people).length} online`:status==="connecting"?"conectando…":status==="error"?"sem conexão":"desconectado";}

  function teamMinis(team,size=28){
    return (team||[]).map(m=>`<span class="ar7-mini" title="${esc(m.n)} Lv${m.lv}" style="--t:${typeColor(m.t?.[0])}">${m.img?`<img src="${esc(m.img)}" alt="" loading="lazy" width="${size}" height="${size}">`:`<i>${esc((m.n||"?").slice(0,1))}</i>`}</span>`).join("");
  }
  /* ---------- Lobby (repaginado): herói, modos, abas ---------- */
  const PX=(n,sz)=>window.hhArenaPix?window.hhArenaPix.svg(n,sz):"";
  let tab=(()=>{const t=ls.get("hh_arena_tab","sala");return ["sala","time","ranking","chat","ajustes"].includes(t)?t:"sala";})();
  let unread=0;
  const TABS=[["sala","people","Sala","Desafiar e assistir","#e0393e"],["time","ball","Meu time","Escalação","#e39a12"],["ranking","trophy","Ranking","Desafio Sem Fim","#c9961a"],["chat","chat","Chat","Conversa","#2f74d4"],["ajustes","gear","Ajustes","Sala e regras","#7a5ad0"]];
  const wideMq=matchMedia("(min-width:1100px)");
  wideMq.addEventListener?.("change",()=>{if(!B)render();});
  function lobbyView(){
    if(status==="error")return `<div class="ar7-card ar7-empty"><b>Não foi possível conectar à arena.</b><p>Confira a internet e tente de novo.</p><button type="button" class="ar7-btn primary" data-ar="retry">Tentar de novo</button></div>`;
    const list=Object.values(people).sort((a,b)=>(a.id===me.id?-1:b.id===me.id?1:a.name.localeCompare(b.name)));
    const others=list.filter(p=>p.id!==me.id);
    const battles={};
    list.filter(p=>p.status==="battle"&&p.battle).forEach(p=>{battles[p.battle]=battles[p.battle]||{id:p.battle,players:[],names:p.names};battles[p.battle].players.push(p.name);});
    const myTeam=teamPreview();
    const lead=myTeam[0];const leadMon=teamSource()[0];const leadImg=leadMon?localImg(leadMon):"";
    const bg=scene==="random"?"standard":scene;
    const best=Number(state.arenaSurvivalBest||0);
    const top=RANK.list?.[0];
    const nBattles=Object.keys(battles).length;
    const wide=wideMq.matches;
    const curTab=wide&&tab==="chat"?"sala":tab;
    if(curTab==="chat"||wide)unread=0;
    const counts={sala:others.length,chat:unread};
    const slots=teamSource();
    return `<div class="ar8"><div class="ar8-main">
    <section class="ar8-hero ar8-frame" style="background-image:linear-gradient(100deg,rgba(14,16,30,.82) 0%,rgba(14,16,30,.45) 50%,rgba(14,16,30,.08) 100%),url('assets/arenas/${esc(bg)}.png')">
      <div class="ar8-hero-me">
        <span class="ar8-avatar" style="--t:${typeColor(lead?.t?.[0])}">${leadImg?`<img src="${esc(leadImg)}" alt="">`:PX("ball",40)}</span>
        <div class="ar8-hero-txt">
          <small>Treinador</small>
          <b>${esc(me.name)}</b>
          <span class="ar8-pills"><span class="ar8-pill ${status==="on"?"on":""}"><i></i>${statusText()}</span><span class="ar8-pill">Sala <code>${esc(room)}</code></span><span class="ar8-pill gold">🏆 Recorde ${best}</span></span>
        </div>
      </div>
      <div class="ar8-party" aria-label="Seu time">${Array.from({length:6},(_,i)=>{const p=slots[i];if(!p)return `<span class="ar8-slot empty">${PX("ball",22)}</span>`;const im=localImg(p);return `<span class="ar8-slot${i===0?" lead":""}" title="${esc(p.name)} • Lv. ${Number(p.level||1)}" style="--t:${typeColor(p.type1)}">${im?`<img src="${esc(im)}" alt="${esc(p.name)}">`:`<i>${esc((p.name||"?").slice(0,1))}</i>`}<small>Lv${Number(p.level||1)}</small></span>`;}).join("")}</div>
    </section>
    ${outgoing?`<section class="ar7-card ar7-wait"><b>Desafio enviado para ${esc(people[outgoing.to]?.name||"…")}</b><small>${outgoing.format>=6?"time todo":`${outgoing.format} vs ${outgoing.format}`} · aguardando resposta</small><button type="button" class="ar7-btn" data-ar="cancel">Cancelar</button></section>`:""}
    <section class="ar8-modes">
      <article class="ar8-mode friends ar8-frame">
        <span class="ar8-mode-ico">${PX("swords",72)}</span>
        <div class="ar8-mode-txt"><small>Multijogador</small><h3>Batalha entre amigos</h3>
          <p>${others.length?`<b>${others.length}</b> treinador${others.length>1?"es":""} na sala`:"Ninguém na sala ainda"}${nBattles?` · <b>${nBattles}</b> batalha${nBattles>1?"s":""} ao vivo`:""}</p></div>
        <div class="ar8-mode-act">${others.length?`<button type="button" class="ar7-btn primary" data-ar="tab" data-v="sala">⚔ Desafiar</button>`:`<button type="button" class="ar7-btn primary" data-ar="share">🔗 Convidar</button>`}</div>
      </article>
      <article class="ar8-mode endless ar8-frame">
        <span class="ar8-mode-ico tower">${PX("tower",64)}</span>
        <div class="ar8-mode-txt"><small>Solo · ondas infinitas</small><h3>Desafio Sem Fim</h3>
          <p>Recorde: <b>${best}</b> onda${best===1?"":"s"}${top?` · Líder: <b>${esc(top.player)}</b> (${top.waves})`:""}</p></div>
        <div class="ar8-mode-act"><button type="button" class="ar7-btn primary" data-ar="surv-start" ${myTeam.length?"":"disabled"}>▶ Começar</button><button type="button" class="ar7-btn" data-ar="tab" data-v="ranking">🏆</button></div>
      </article>
    </section>
    <nav class="ar8-tabs" role="tablist" aria-label="Seções da arena">${TABS.filter(([k])=>!(wide&&k==="chat")).map(([k,ico,label,sub,col])=>`<button type="button" role="tab" aria-selected="${curTab===k}" class="ar8-tab${curTab===k?" on":""}" data-ar="tab" data-v="${k}" style="--nb:${col}"><span class="ar8-tab-ico">${PX(ico,22)}</span><span class="ar8-tab-txt"><b>${label}</b><small>${sub}</small></span>${counts[k]?`<i class="ar8-count">${counts[k]}</i>`:""}</button>`).join("")}</nav>
    <section class="ar8-panel" role="tabpanel">${curTab==="sala"?roomTab(others,battles,myTeam):curTab==="time"?`<div class="ar8-sec"><h3>${PX("ball",22)} Seu time na arena</h3><p class="ar8-sub">Quem vai para as batalhas e para o Desafio Sem Fim. O primeiro começa a luta.</p>${teamEditor()}</div>`:curTab==="ranking"?rankTab():curTab==="chat"?chatTab():settingsTab()}</section>
    </div>
    ${wide?`<aside class="ar8-side">${sideOnline(others)}${chatTab()}</aside>`:""}
    </div>`;
  }
  function sideOnline(others){
    return `<div class="ar8-sec ar8-online"><h3>${PX("people",22)} Online agora <small>${others.length+1}</small></h3>
      <ul>${[{name:me.name,status:"me",team:teamPreview()},...others].map(p=>{const l=(p.team||[])[0];return `<li><span class="ar8-avatar xs" style="--t:${typeColor(l?.t?.[0])}">${l?.img?`<img src="${esc(l.img)}" alt="">`:PX("ball",18)}</span><b>${esc(p.name)}${p.status==="me"?" <small>(você)</small>":""}</b><i class="ar8-dot ${esc(p.status)}" title="${esc(p.status)}"></i></li>`;}).join("")}</ul></div>`;
  }
  function roomTab(others,battles,myTeam){
    const watchers={};Object.values(people).filter(p=>p.status==="watch").forEach(p=>{watchers[p.battle]=(watchers[p.battle]||0)+1;});
    const badge=p=>p.status==="battle"?`⚔ em batalha${p.vs?` com ${esc(p.vs)}`:""}`:p.status==="watch"?"👁 assistindo":p.status==="survival"?`🗼 Desafio Sem Fim · onda ${Number(p.wave)||1}`:"● disponível";
    return `<div class="ar8-sec">
      <h3>${PX("people",24)} Treinadores na sala <small>${others.length}</small></h3>
      ${others.length?`<ul class="ar8-people">${others.map(p=>{const l=(p.team||[])[0];return `<li class="ar8-person ${esc(p.status)}">
        <span class="ar8-avatar sm" style="--t:${typeColor(l?.t?.[0])}">${l?.img?`<img src="${esc(l.img)}" alt="">`:PX("ball",28)}</span>
        <div class="ar8-person-txt"><b>${esc(p.name)}</b><span class="ar7-badge ${esc(p.status)}">${badge(p)}</span><span class="ar7-minis">${teamMinis(p.team,26)}</span></div>
        ${p.status==="idle"&&!outgoing&&myTeam.length?`<div class="ar7-formats" role="group" aria-label="Desafiar ${esc(p.name)}">
          <button type="button" class="ar7-btn primary ar7-ch-main" data-ar="challenge" data-to="${esc(p.id)}" data-format="6">⚔ Desafiar <small>time todo</small></button>
          <button type="button" class="ar7-btn" data-ar="challenge" data-to="${esc(p.id)}" data-format="3">3 vs 3</button>
          <button type="button" class="ar7-btn" data-ar="challenge" data-to="${esc(p.id)}" data-format="1">1 vs 1</button></div>`:""}
      </li>`;}).join("")}</ul>`:`<div class="ar8-empty">${PX("people",48)}<p>${status==="on"?"Ninguém mais nesta sala ainda.":"Conectando…"}</p>${status==="on"?`<button type="button" class="ar7-btn primary" data-ar="share">🔗 Mandar convite</button>`:""}</div>`}
    </div>
    <div class="ar8-sec">
      <h3>${PX("eye",24)} Batalhas ao vivo <small>${Object.keys(battles).length}</small></h3>
      ${Object.keys(battles).length?`<ul class="ar7-battles">${Object.values(battles).map(b=>`<li><span><b>${esc(b.names?.p1||b.players[0]||"?")}</b> <i class="ar8-vs">VS</i> <b>${esc(b.names?.p2||b.players[1]||"?")}</b>${watchers[b.id]?` <small>👁 ${watchers[b.id]}</small>`:""}</span>
        <button type="button" class="ar7-btn" data-ar="watch" data-id="${esc(b.id)}" data-p1="${esc(b.names?.p1||"")}" data-p2="${esc(b.names?.p2||"")}">👁 Assistir</button></li>`).join("")}</ul>`:`<p class="ar7-empty-text">Nenhuma batalha agora. Quando alguém lutar, aparece aqui para assistir.</p>`}
    </div>`;
  }
  function rankTab(){
    const list=RANK.list,best=Number(state.arenaSurvivalBest||0);
    const me_=playerKey();
    const pod=list?.slice(0,3)||[];
    const card=(r,i)=>`<div class="ar8-pod p${i+1}${r.player_key===me_?" me":""}">
      ${i===0?`<span class="ar8-crown">${PX("crown",30)}</span>`:""}
      <span class="ar8-avatar" style="--t:#ffd23f">${r.team?.[0]?.img?`<img src="${esc(r.team[0].img)}" alt="">`:PX("ball",34)}</span>
      <b>${esc(r.player)}</b><strong>${r.waves}<small> onda${r.waves===1?"":"s"}</small></strong><i class="ar8-step">${i+1}</i></div>`;
    return `<div class="ar8-sec ar8-rank">
      <div class="ar8-rank-top"><h3>${PX("trophy",24)} Ranking do Desafio Sem Fim</h3><button type="button" class="ar7-link" data-ar="rank-reload">atualizar</button></div>
      <p class="ar8-sub">Melhor corrida de cada treinador. Seu recorde: <b>${best}</b> onda${best===1?"":"s"}.</p>
      ${RANK.loading&&!list?`<p class="ar7-empty-text">Carregando…</p>`:RANK.error&&!list?`<p class="ar7-empty-text">${esc(RANK.error)}</p>`:!list||!list.length?`<div class="ar8-empty">${PX("tower",40)}<p>Ninguém no ranking ainda. Seja o primeiro!</p></div>`:`
      <div class="ar8-podium">${[1,0,2].filter(i=>pod[i]).map(i=>card(pod[i],i)).join("")}</div>
      ${list.length>3?`<ol class="ar7-rank-list" start="4">${list.slice(3).map((r,i)=>`<li class="${r.player_key===me_?"me":""}"><span class="ar7-rank-pos">${i+4}</span>
        <span class="ar7-rank-name"><b>${esc(r.player)}</b><small>${(r.team||[]).map(t=>esc(t.n)).join(", ")}${r.damage_mode==="matrix"?" · 🧪":""}${r.last_foe?` · caiu para ${esc(r.last_foe)}`:""}</small></span>
        <span class="ar7-rank-minis">${teamMinis((r.team||[]).map(t=>({n:t.n,lv:t.lv,t:[],img:t.img||""})),24)}</span>
        <b class="ar7-rank-score">${r.waves}<small>onda${r.waves===1?"":"s"}</small></b></li>`).join("")}</ol>`:""}`}
    </div>`;
  }
  function chatTab(){
    return `<div class="ar8-sec ar7-chat">
      <h3>${PX("chat",24)} Chat da sala</h3>
      <div class="ar7-chat-list" aria-live="polite">${chat.length?chat.map(c=>`<p class="${c.name===me.name?"mine":""}"><b>${esc(c.name)}</b><span>${esc(c.text)}</span></p>`).join(""):`<p class="ar7-empty-text">Diga oi! 👋</p>`}</div>
      <form class="ar7-chat-form" data-ar-form="chat"><input id="ar7Chat" maxlength="160" placeholder="Mensagem…" autocomplete="off"><button type="submit" class="ar7-btn primary">Enviar</button></form>
    </div>`;
  }
  function settingsTab(){
    return `<div class="ar8-sec">
      <h3>${PX("gear",24)} Ajustes</h3>
      <div class="ar7-me-row">
        <label class="ar7-field-label">Nome do treinador <small>(o mesmo do Trainer Card)</small><input id="ar7Name" maxlength="24" value="${esc(me.name)}" autocomplete="off"></label>
        <label class="ar7-field-label">Sala<span class="ar7-room"><input id="ar7Room" maxlength="24" value="${esc(room)}" autocomplete="off" spellcheck="false"><button type="button" class="ar7-btn" data-ar="room">Entrar</button></span></label>
      </div>
      <p class="ar7-hint">Use uma sala com nome próprio (ex.: <code>mesa-do-nando</code>) para jogar só com seus amigos, e mande o <button type="button" class="ar7-link" data-ar="share">convite 🔗</button>. A batalha não altera a ficha: todos começam com HP cheio.</p>
      <div class="ar7-dmg-pick" role="radiogroup" aria-label="Sistema de dano"><small>Dano das suas batalhas (vale quando você desafia e no Desafio Sem Fim):</small>
        <span>${["classic","matrix"].map(k=>`<button type="button" role="radio" aria-checked="${dmgMode===k}" class="ar7-btn${dmgMode===k?" primary":""}" data-ar="dmg" data-v="${k}">${k==="matrix"?"🧪 Experimental (QD)":"Padrão da ficha"}</button>`).join("")}</span>
        <em>${dmgMode==="matrix"?"Poder define quantos dados; a Qualidade do seu ATK/SP.ATK contra a DEF/SP.DEF do alvo define o dado (d4 a d20). STAB +1d6 e nível÷5 fixo.":"Power vira d6, Attack/Sp.Atk somam dados e Defense/Sp.Def tiram dados."}</em>
      </div>
      <div class="ar7-scenes-head"><small>Ambiente das suas batalhas:</small><b>${scene==="random"?"Aleatório":esc(sceneLabel(scene))}</b></div>
      <div class="ar7-scenes" role="radiogroup" aria-label="Ambiente da batalha">
        <button type="button" role="radio" aria-checked="${scene==="random"}" class="ar7-scene rnd${scene==="random"?" on":""}" data-ar="scene" data-v="random"><i>🎲</i><b>Aleatório</b></button>
        ${SCENES.map(x=>`<button type="button" role="radio" aria-checked="${x.v===scene}" class="ar7-scene${x.v===scene?" on":""}" data-ar="scene" data-v="${esc(x.v)}"><i style="background-image:url('assets/arenas/${esc(x.v)}.png')"></i><b>${esc(x.label)}</b></button>`).join("")}
      </div>
    </div>`;
  }
  let pickOpen=false;
  function teamEditor(){
    const team=teamSource(),custom=pickIds().length>0;
    const ids=new Set(team.map(p=>String(p.id)));
    const rest=state.pokemon.filter(p=>!ids.has(String(p.id)));
    const face=p=>{const img=localImg(p);return img?`<img src="${esc(img)}" alt="" width="44" height="44" loading="lazy">`:`<i>${esc((p.name||"?").slice(0,1))}</i>`;};
    return `<div class="ar7-pick">
      <div class="ar7-pick-head"><small>Seu time na arena <b>${team.length}/6</b> ${custom?"· escolhido por você":"· Equipe da ficha"}</small>
        ${custom?`<button type="button" class="ar7-link" data-ar="pick-reset">Usar a Equipe da ficha</button>`:""}</div>
      ${team.length?`<ol class="ar7-pick-list">${team.map((p,i)=>`<li class="${i===0?"lead":""}" style="--t:${typeColor(p.type1)}">
        <span class="ar7-pick-face">${face(p)}</span>
        <span class="ar7-pick-name"><b>${esc(p.name)}</b><small>${i===0?"Começa a luta":`#${i+1}`} · Lv${Number(p.level||1)}</small></span>
        <span class="ar7-pick-acts">
          ${i>0?`<button type="button" data-ar="pick-lead" data-id="${esc(String(p.id))}" title="Começar com ${esc(p.name)}" aria-label="Começar com ${esc(p.name)}">★</button><button type="button" data-ar="pick-left" data-id="${esc(String(p.id))}" title="Subir na ordem" aria-label="Subir ${esc(p.name)} na ordem">▲</button>`:""}
          <button type="button" data-ar="pick-del" data-id="${esc(String(p.id))}" title="Tirar do time" aria-label="Tirar ${esc(p.name)} do time">✕</button>
        </span></li>`).join("")}</ol>`:`<p class="ar7-empty-text">Nenhum Pokémon no time. Adicione abaixo.</p>`}
      ${rest.length?`<button type="button" class="ar7-btn ar7-pick-more" data-ar="pick-more" aria-expanded="${pickOpen}">${pickOpen?"Fechar lista":"＋ Adicionar Pokémon da ficha"}</button>
      ${pickOpen?`<div class="ar7-pick-pool">${rest.map(p=>`<button type="button" data-ar="pick-add" data-id="${esc(String(p.id))}" ${team.length>=6?"disabled":""} title="Adicionar ${esc(p.name)}">${face(p)}<span>${esc(p.name)}</span><small>${p.storageGroup==="team"?"Equipe":"Caixa"}</small></button>`).join("")}</div>`:""}`:""}
    </div>`;
  }
  /* ---------- Desafio Sem Fim ---------- */
  async function loadRank(force){
    if(RANK.loading||(!force&&RANK.list&&Date.now()-(RANK.at||0)<60000))return;
    RANK.loading=true;RANK.error="";render();
    try{
      await loadSb();sb=sb||window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data,error}=await sb.from("arena_survival_ranking").select("player,player_key,waves,team,damage_mode,last_foe,created_at").order("waves",{ascending:false}).order("created_at",{ascending:true}).limit(300);
      if(error)throw error;
      const seen=new Set(),out=[];
      for(const r of data||[]){if(seen.has(r.player_key))continue;seen.add(r.player_key);out.push(r);if(out.length>=20)break;}
      RANK.list=out;RANK.at=Date.now();
    }catch(e){RANK.error="Não consegui carregar o ranking agora.";}
    RANK.loading=false;render();
  }
  async function startRun(){
    if(B||!SURV())return;
    const team=await buildTeam(6);
    if(!team.length){toast("Monte um time primeiro.");return;}
    RUN={wave:0,team,hp:team.map(m=>({hp:Math.max(1,Number(m.maxHp||1)),maxHp:Math.max(1,Number(m.maxHp||1)),fainted:false})),train:0,dmg:dmgMode,cleared:0,done:false};
    nextWave();
  }
  async function nextWave(){
    RUN.wave++;RUN.done=false;RUN.error="";
    B={id:"solo-"+uidShort(),role:"p1",host:true,solo:true,arena:pickScene(scene),dmg:RUN.dmg,format:6,names:{p1:me.name,p2:"Onda "+RUN.wave},state:null,teams:null,pendingTeams:{},specs:{},queue:[],playing:false,log:[],chosen:false};
    for(const k in lastHp)delete lastHp[k];
    sfx("page");render();track();
    const ref=Math.round(RUN.team.reduce((x,m)=>x+Number(m.level||1),0)/RUN.team.length);
    let wave;
    try{wave=await SURV().makeWave(RUN.wave,ref);}
    catch(e){if(RUN){RUN.error="A PokéAPI não respondeu.";render();}return;}
    if(!B?.solo||!RUN)return;
    RUN.waveInfo=wave;
    const alive=RUN.team.map((m,i)=>i).filter(i=>!RUN.hp[i].fainted);
    RUN.alive=alive;
    B.state=engine.newBattle({id:B.id,format:6,damage:RUN.dmg,
      p1:{id:me.id,name:me.name,team:alive.map(i=>RUN.team[i])},
      p2:{id:"cpu",name:`${wave.boss?"Chefe da onda":wave.elite?"Elite da onda":"Onda"} ${RUN.wave}`,team:wave.team}});
    // HP que sobrou das ondas anteriores e o treino acumulado
    alive.forEach((ri,j)=>{const st=B.state.sides.p1.team[j];st.hp=Math.min(st.maxHp,RUN.hp[ri].hp);if(RUN.train){st.persist.atk=(st.persist.atk||0)+RUN.train;st.persist.spa=(st.persist.spa||0)+RUN.train;}});
    B.teams=B.state.teams;B.names={p1:me.name,p2:B.state.sides.p2.name};B.started=true;
    applyState(pub(B.state),true);B.state.events=[];track();
  }
  function onWaveEnd(){
    RUN.done=true;
    const st=B.state||null;
    if(B.view.winner==="p1"){
      RUN.cleared=RUN.wave;
      // guarda o HP que sobrou
      if(st)RUN.alive.forEach((ri,j)=>{const t=st.sides.p1.team[j];RUN.hp[ri]={hp:t.hp,maxHp:t.maxHp,fainted:t.fainted};});
      // recupera 10% de todos de pé
      RUN.hp.forEach(h=>{if(!h.fainted)h.hp=Math.min(h.maxHp,h.hp+Math.ceil(h.maxHp*.1));});
      if(RUN.cleared>Number(state.arenaSurvivalBest||0)){state.arenaSurvivalBest=RUN.cleared;try{(typeof debouncedSave==="function"?debouncedSave:saveState)();}catch(e){}}
      if(RUN.hp.every(h=>h.fainted))endRun();
    }else endRun();
  }
  function endRun(reason){
    if(!RUN||RUN.recorded)return;
    RUN.recorded=true;RUN.over=true;
    const foe=B?.teams?.p2?.[B?.state?.sides?.p2?.active||0]?.name||"";
    if(RUN.cleared>Number(state.arenaSurvivalBest||0)){state.arenaSurvivalBest=RUN.cleared;}
    try{(typeof debouncedSave==="function"?debouncedSave:saveState)();}catch(e){}
    if(RUN.cleared>=1)saveRank({waves:RUN.cleared,foe:reason?"":foe});
  }
  async function saveRank({waves,foe}){
    const run=RUN;if(!run)return;
    const team=run.team.slice(0,6).map(m=>({n:String(m.name).slice(0,30),lv:Number(m.level||1),img:/^https?:/.test(m.img||"")&&String(m.img).length<300?m.img:""}));
    const mode=run.dmg==="matrix"?"matrix":"classic";
    try{
      await loadSb();sb=sb||window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const {error}=await sb.from("arena_survival_ranking").insert({player:String(me.name||"Treinador").slice(0,24),player_key:playerKey().slice(0,64),waves,team,damage_mode:mode,last_foe:String(foe||"").slice(0,40)||null});
      if(error)throw error;
      toast("Corrida registrada no ranking!");RANK.at=0;loadRank(true);
    }catch(e){toast("Não consegui salvar no ranking.");}
  }
  function applyReward(kind){
    if(!RUN||RUN.over)return;
    if(kind==="heal")RUN.hp.forEach(h=>{if(!h.fainted)h.hp=Math.min(h.maxHp,h.hp+Math.ceil(h.maxHp*.35));});
    if(kind==="revive"){const h=RUN.hp.find(x=>x.fainted);if(h){h.fainted=false;h.hp=Math.ceil(h.maxHp*.5);}}
    if(kind==="train")RUN.train=Math.min(3,RUN.train+1);
    B=null;nextWave();
  }
  function survivalPanel(v){
    const won=v.winner==="p1"&&RUN&&!RUN.over;
    if(won){
      const anyFainted=RUN.hp.some(h=>h.fainted);
      const next=SURV()?.waveInfo(RUN.wave+1,Math.round(RUN.team.reduce((x,m)=>x+Number(m.level||1),0)/RUN.team.length));
      return `<div class="ar7-result win ar7-surv-win"><b>🏆 Onda ${RUN.wave} vencida!</b>
        <small>Seu time recuperou 10% do HP. Escolha um prêmio antes da onda ${RUN.wave+1}${next?` (Lv. ${next.level}${next.boss?" · CHEFE":next.elite?" · Elite":""})`:""}:</small>
        <div class="ar7-rewards">
          <button type="button" class="ar7-reward" data-ar="surv-reward" data-v="heal"><span>💚</span><b>Curar</b><small>+35% de HP para todos de pé</small></button>
          <button type="button" class="ar7-reward" data-ar="surv-reward" data-v="revive" ${anyFainted?"":"disabled"}><span>✨</span><b>Reviver</b><small>${anyFainted?"Um desmaiado volta com 50%":"Ninguém desmaiou"}</small></button>
          <button type="button" class="ar7-reward" data-ar="surv-reward" data-v="train" ${RUN.train>=3?"disabled":""}><span>💪</span><b>Treinar</b><small>+1 Attack e Sp.Atk para o time (${RUN.train}/3)</small></button>
        </div>
        <div class="ar7-surv-hp">${RUN.team.map((m,i)=>{const h=RUN.hp[i];const pc=Math.round(100*h.hp/h.maxHp);return `<span class="${h.fainted?"out":""}" title="${esc(m.name)}">${m.img?`<img src="${esc(m.img)}" alt="" width="28" height="28">`:""}<i style="--p:${h.fainted?0:pc}%"></i></span>`;}).join("")}</div>
      </div>`;
    }
    const best=Number(state.arenaSurvivalBest||0);
    return `<div class="ar7-result lose"><b>Fim da corrida!</b>
      <small>Você venceu <b>${RUN?.cleared||0}</b> onda${(RUN?.cleared||0)===1?"":"s"}. Seu recorde: <b>${best}</b>.${(RUN?.cleared||0)>=1?" A corrida foi para o ranking.":""}</small>
      <div class="ar7-modal-actions"><button type="button" class="ar7-btn" data-ar="leave">Voltar ao lobby</button><button type="button" class="ar7-btn primary" data-ar="surv-again">Jogar de novo</button></div></div>`;
  }
  function challengeDialog(){
    const p=incoming;
    return `<div class="ar7-modal" role="alertdialog" aria-modal="true" aria-labelledby="ar7ChTitle">
      <div class="ar7-modal-box"><span class="ar7-modal-ico" aria-hidden="true">⚔</span>
        <h3 id="ar7ChTitle">${esc(p.fromName)} te desafiou!</h3>
        ${sceneOk(p.arena)?`<i class="ar7-modal-scene" style="background-image:url('assets/arenas/${esc(p.arena)}.png')"></i>`:""}<p>Formato: <b>${p.format===1?"1 vs 1":p.format>=6?"time todo (até 6)":`${p.format} vs ${p.format}`}</b>${sceneOk(p.arena)?` · Ambiente: <b>${esc(sceneLabel(p.arena))}</b>`:""} · <b>${DMG_LABEL[p.dmg==="matrix"?"matrix":"classic"]}</b>. Vai o time que você montou na arena (o primeiro começa).</p>
        <div class="ar7-modal-actions"><button type="button" class="ar7-btn" data-ar="decline">Recusar</button><button type="button" class="ar7-btn primary" data-ar="accept">Aceitar</button></div>
      </div></div>`;
  }

  function hudBadges(s){
    const st=s.team[s.active]||{};let h="";
    if(st.status)h+=`<b class="ar7-st ${st.status}" title="${esc(ST_LABEL[st.status]||"")}">${ST_SHORT[st.status]||st.status}</b>`;
    if(s.cnf)h+=`<b class="ar7-st cnf" title="Confuso">CNF</b>`;
    for(const [k,v] of Object.entries(s.stg||{}))if(v)h+=`<i class="ar7-stg ${v>0?"up":"down"}" title="${STAT_PT[k]} ${v>0?"+":""}${v}">${STAT_SHORT[k]} ${v>0?"+":""}${v}</i>`;
    if(s.crit)h+=`<i class="ar7-stg up" title="Crítico aumentado">CRIT +${s.crit}</i>`;
    if(s.swagger)h+=`<i class="ar7-stg swag" title="Swagger Mode">SWAGGER</i>`;
    return h;
  }
  function fieldChips(){
    const v=B.view;let h="";
    if(v.weather)h+=`<b class="ar7-chip w-${v.weather.kind}">${W_ICON[v.weather.kind]||""} ${W_LABEL[v.weather.kind]||""} <small>${v.weather.turns}</small></b>`;
    for(const k of ["p1","p2"]){const f=v.sides[k].field||{};if(f.royal>0)h+=`<b class="ar7-chip royal">👑 Campo Real · ${esc(sideName(k))} <small>${f.royal}</small></b>`;}
    return h;
  }
  function monCard(side,pos){
    const v=B.view,s=v.sides[side],t=B.teams[side],m=t[s.active],st=s.team[s.active];
    const pct=hpPct(st);
    return `<div class="ar7-spot ${pos}">
      <div class="ar7-hud"><div class="ar7-hud-name"><b>${esc(m.name)}</b><small>Lv. ${m.level}</small></div>
        ${m.build&&pos==="foe"?`<small class="ar7-build">${esc(m.build)}${m.ability?` · ${esc(m.ability)}`:""}</small>`:""}
        <div class="ar7-hud-types">${(m.types||[]).map(x=>`<i style="--t:${typeColor(x)};--td:${typeDark(x)}">${esc(x)}</i>`).join("")}</div>
        <div class="ar7-hp ${hpClass(pct)}"><span>HP</span><div><i data-to="${pct}" style="--w:${lastHp[pos]??pct}%"></i></div>${pos==="me"?`<small class="ar7-hp-num">${st.hp} / ${st.maxHp}</small>`:""}</div>
        <div class="ar7-balls">${s.team.map(x=>`<i class="${x.fainted?"out":""}"></i>`).join("")}</div>
        <div class="ar7-badges">${hudBadges(s)}</div>
      </div>
      <div class="ar7-mon ${pos}${st.fainted?" fainted":""}${B.intro?" intro":""}">${m.img?`<img src="${esc(m.img)}" alt="${esc(m.name)}">`:`<i>${esc(m.name.slice(0,1))}</i>`}</div>
    </div>`;
  }
  const lastHp={};
  function battleView(){
    if(B.solo&&(!B.view||!B.teams))return `<div class="ar7-card ar7-empty ar7-surv-load"><span class="ar7-surv-ico">🗼</span><b>${RUN?.error?esc(RUN.error):`Onda ${RUN?.wave||1}: chamando um Pokémon selvagem…`}</b><p>${RUN?.error?"Confira a internet e tente de novo.":"Buscando na PokéAPI e distribuindo os atributos."}</p>${RUN?.error?`<button type="button" class="ar7-btn primary" data-ar="surv-retry">Tentar de novo</button>`:""}<button type="button" class="ar7-btn" data-ar="leave">Voltar ao lobby</button></div>`;
    if(!B.view||!B.teams)return `<div class="ar7-card ar7-empty"><b>${B.role==="spec"?"Entrando para assistir…":"Preparando a batalha…"}</b><p>${B.role==="spec"?"Buscando o estado da batalha.":"Esperando os dois times chegarem."}</p><button type="button" class="ar7-btn" data-ar="leave">Voltar ao lobby</button></div>`;
    const v=B.view,mine=mySide(),foe=mine==="p1"?"p2":"p1";
    const specs=Object.values(B.specs||{});
    const ended=v.phase==="end";
    let panel="";
    if(ended&&B.solo)panel=survivalPanel(v);
    else if(ended){
      const win=v.winner;
      panel=`<div class="ar7-result ${win===B.role?"win":win?"lose":""}"><b>${win?(B.role===win?"🏆 Você venceu!":B.role==="spec"?`🏆 ${esc(sideName(win))} venceu!`:"Você perdeu…"):"Batalha encerrada"}</b>
        <button type="button" class="ar7-btn primary" data-ar="leave">Voltar ao lobby</button></div>`;
    }else if(B.role==="spec"){
      panel=`<div class="ar7-waiting">👁 Você está assistindo. ${["p1","p2"].map(s=>`${esc(sideName(s))}: ${v.sides[s].ready?"✓ escolheu":"pensando…"}`).join(" · ")}</div>`;
    }else{
      const s=v.sides[mine],team=B.teams[mine];
      const mustSwitch=v.phase==="switch"&&s.needSwitch;
      const waitingSwitch=v.phase==="switch"&&!s.needSwitch;
      if(B.playing)panel=`<div class="ar7-waiting ar7-dots">Resolvendo o turno</div>`;
      else if(waitingSwitch)panel=`<div class="ar7-waiting">Esperando ${esc(sideName(foe))} escolher o próximo Pokémon…</div>`;
      else if(s.ready||B.chosen)panel=`<div class="ar7-waiting">✓ Ação escolhida. Esperando ${esc(sideName(foe))}…</div>`;
      else{
        const mon=team[s.active];
        panel=`${mustSwitch?`<p class="ar7-ask">${esc(mon.name)} desmaiou! Escolha o próximo:</p>`:`<p class="ar7-ask">O que <b>${esc(mon.name)}</b> vai fazer?</p>`}
          ${mustSwitch?"":`<div class="ar7-moves">${mon.moves.map((m,i)=>`<button type="button" class="ar7-move" data-ar="move" data-idx="${i}" style="--t:${typeColor(m.type)};--td:${typeDark(m.type)}" title="${esc(m.desc)}">
            <b>${esc(m.name)}</b><small>${esc(m.type)} · ${m.category==="Physical"?"Físico":m.category==="Special"?"Especial":"Status"}${m.power?` · ${powerToDice(m.power)}`:""}${m.accuracy!=null?` · ${m.accuracy}%`:""}</small></button>`).join("")}</div>`}
          <p class="ar7-party-title">${mustSwitch?"Escolha quem entra:":`Trocar Pokémon <small>(gasta o turno)</small>`}</p>
          <div class="ar7-party">${team.map((m,i)=>{const st=s.team[i];const dis=st.fainted||i===s.active;return `<button type="button" class="ar7-switch" data-ar="switch" data-idx="${i}" ${dis?"disabled":""} title="Trocar para ${esc(m.name)}">
            ${m.img?`<img src="${esc(m.img)}" alt="" width="34" height="34">`:`<i>${esc(m.name.slice(0,1))}</i>`}<span><b>${esc(m.name)}</b><small class="${hpClass(hpPct(st))}">${st.fainted?"desmaiado":`${st.hp}/${st.maxHp}`}</small></span></button>`;}).join("")}</div>
          ${mustSwitch?"":`<button type="button" class="ar7-btn ar7-forfeit" data-ar="forfeit">🏳 Desistir</button>`}`;
      }
    }
    return `<section class="ar7-battle">
      <div class="ar7-vs"><b>${esc(sideName(foe))}</b><span>VS</span><b>${esc(sideName(mine))}</b><small>${B.solo?`🗼 Onda ${RUN?.wave||1}${RUN?.waveInfo?.boss?" · CHEFE":RUN?.waveInfo?.elite?" · Elite":""} · `:""}Turno ${v.turn}${specs.length?` · 👁 ${specs.length}`:""} · ${B.dmg==="matrix"?"🧪 Dano experimental":"Dano da ficha"}</small></div>
      <div class="ar7-field" data-scene="${esc(B.arena||"standard")}" data-weather="${esc(B.view.weather?.kind||"")}" style="--ar7-t:-${(performance.now()/1000).toFixed(2)}s">
        <div class="ar7-fx" aria-hidden="true"></div><i class="ar7-plat foe" aria-hidden="true"></i><i class="ar7-plat me" aria-hidden="true"></i>
        ${monCard(foe,"foe")}${monCard(mine,"me")}
        ${B.intro?`<div class="ar7-vsintro" aria-hidden="true"><b class="l">${esc(sideName(foe))}</b><span>VS</span><b class="r">${esc(sideName(mine))}</b></div>`:""}
        <div class="ar7-wx" aria-hidden="true"></div>
        <div class="ar7-chips">${fieldChips()}</div>
        <span class="ar7-scene-tag">${esc(sceneLabel(B.arena))}</span>
      </div>
      <div class="ar7-msg" aria-hidden="true"><p>${B.log.length?B.log[B.log.length-1].line:`${esc(sideName(foe))} quer batalhar!`}</p></div>
      <div class="ar7-emotes" role="group" aria-label="Reações">${EMOTES.map(e=>`<button type="button" data-ar="emote" data-e="${esc(e)}">${esc(e)}</button>`).join("")}</div>
      <div class="ar7-panel">${panel}</div>
      <div class="ar7-log" aria-live="polite">${B.log.map(l=>`<p class="${l.cls}">${l.line}</p>`).join("")}</div>
      ${specs.length?`<p class="ar7-specs">👁 Assistindo: ${specs.map(esc).join(", ")}</p>`:""}
      ${!ended?`<button type="button" class="ar7-btn ar7-leave" data-ar="leave">${B.role==="spec"?"Parar de assistir":"Sair da batalha"}</button>`:""}
    </section>`;
  }

  /* ---------- Eventos ---------- */
  root.addEventListener("click",async e=>{
    const b=e.target.closest("[data-ar]");if(!b)return;
    const a=b.dataset.ar;
    if(a==="close")close();
    else if(a==="retry"){status="off";connect();}
    else if(a==="room")switchRoom(document.getElementById("ar7Room")?.value);
    else if(a==="share"){
      const url=`${location.origin}${location.pathname}?arena=${encodeURIComponent(room)}`;
      try{if(navigator.share)await navigator.share({title:"Arena Pokémon",text:`Vem lutar na sala ${room}!`,url});else{await navigator.clipboard.writeText(url);toast("Convite copiado!");}}catch(err){try{await navigator.clipboard.writeText(url);toast("Convite copiado!");}catch(e2){prompt("Copie o convite:",url);}}
    }
    else if(a==="challenge")challenge(b.dataset.to,Number(b.dataset.format));
    else if(a==="cancel"){if(outgoing){send(lobby,"challenge-cancel",{id:outgoing.id});outgoing=null;render();}}
    else if(a==="accept")reply(true);
    else if(a==="decline")reply(false);
    else if(a==="watch")spectate(b.dataset.id,{p1:b.dataset.p1,p2:b.dataset.p2});
    else if(a==="leave"){if(B&&B.role!=="spec"&&B.view&&B.view.phase!=="end"&&!confirm("Sair agora conta como desistência. Sair?"))return;leaveBattle();render();}
    else if(a==="move")act({kind:"move",idx:Number(b.dataset.idx)});
    else if(a==="switch")act({kind:"switch",idx:Number(b.dataset.idx)});
    else if(a==="forfeit"){if(confirm("Desistir da batalha?"))act({kind:"forfeit"});}
    else if(a==="emote")emote(b.dataset.e);
    else if(a==="tab"){tab=b.dataset.v;ls.set("hh_arena_tab",tab);if(tab==="ranking")loadRank();sfx("select");render();root.querySelector(".ar8-tabs")?.scrollIntoView({block:"nearest",behavior:"smooth"});}
    else if(a==="surv-start")startRun();
    else if(a==="surv-retry"){if(RUN){RUN.error="";RUN.wave--;nextWave();}}
    else if(a==="surv-reward")applyReward(b.dataset.v);
    else if(a==="surv-again"){B=null;RUN=null;startRun();}
    else if(a==="rank-reload")loadRank(true);
    else if(a==="dmg"){dmgMode=b.dataset.v==="matrix"?"matrix":"classic";ls.set("hh_arena_dmg",dmgMode);sfx("select");render();}
    else if(a==="pick-add")editPick(ids=>ids.length<6&&!ids.includes(b.dataset.id)?[...ids,b.dataset.id]:ids);
    else if(a==="pick-del")editPick(ids=>ids.filter(x=>x!==b.dataset.id));
    else if(a==="pick-lead")editPick(ids=>[b.dataset.id,...ids.filter(x=>x!==b.dataset.id)]);
    else if(a==="pick-left")editPick(ids=>{const i=ids.indexOf(b.dataset.id);if(i>0)[ids[i-1],ids[i]]=[ids[i],ids[i-1]];return ids;});
    else if(a==="pick-reset"){savePick([]);track();render();}
    else if(a==="pick-more"){pickOpen=!pickOpen;render();}
    else if(a==="scene"){scene=b.dataset.v;ls.set("hh_arena_scene",scene);sfx("select");render();}
  });
  root.addEventListener("submit",e=>{
    const f=e.target.closest("[data-ar-form]");if(!f)return;e.preventDefault();
    const input=document.getElementById("ar7Chat");const text=String(input?.value||"").trim();
    if(!text||!lobby)return;
    const msg={name:me.name,text,at:Date.now()};chat.push(msg);chat=chat.slice(-60);send(lobby,"chat",msg);input.value="";render();
  });
  root.addEventListener("change",e=>{
    if(e.target.id==="ar7Name"){
      const n=String(e.target.value||"").trim().slice(0,24);
      if(n){try{ensureTrainerData().name=n;(typeof debouncedSave==="function"?debouncedSave:saveState)();if(typeof renderAll==="function")renderAll();}catch(err){}}
      track();render();
    }
  });
  root.addEventListener("keydown",e=>{
    if(e.key==="Enter"&&e.target.id==="ar7Room"){e.preventDefault();switchRoom(e.target.value);}
    if(e.key==="Escape"&&!incoming&&!B)close();
  });
  window.addEventListener("beforeunload",()=>{if(B)leaveBattle(true);});

  // Convite: ?arena=sala abre direto na arena
  if(new URLSearchParams(location.search).has("arena"))setTimeout(open,600);
})();
