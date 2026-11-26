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
    name:ls.get("hh_arena_name")||(typeof ensureTrainerData==="function"?(ensureTrainerData().name||""):"")||"Treinador"};
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
  let people={},chat=[],outgoing=null,incoming=null,myTeamCache=null;
  // batalha atual: {id,role:'p1'|'p2'|'spec',host:bool,state,teams,format,opp,names,playing}
  let B=null;

  /* ---------- Carregamento do Supabase ---------- */
  function loadSb(){
    if(window.supabase?.createClient)return Promise.resolve();
    return new Promise((ok,ko)=>{const s=document.createElement("script");s.src=SB_JS;s.onload=ok;s.onerror=()=>ko(new Error("sem conexão"));document.head.appendChild(s);});
  }

  /* ---------- Cópia do time ---------- */
  async function compactImage(src){
    if(!src)return "";
    try{
      const abs=new URL(src,location.href).href;
      if(!abs.startsWith("data:"))return abs;
      const img=new Image();img.decoding="async";
      await new Promise((ok,ko)=>{img.onload=ok;img.onerror=ko;img.src=abs;});
      const s=Math.min(1,160/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.naturalWidth*s));c.height=Math.max(1,Math.round(img.naturalHeight*s));
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      return c.toDataURL("image/webp",.82);
    }catch(e){return "";}
  }
  /* Time da arena: o jogador escolhe quais Pokémon levam (até 6) e a ordem;
     sem escolha, vai a Equipe da ficha. */
  const fichaTeam=()=>state.pokemon.filter(p=>(p.storageGroup||"team")==="team").slice(0,6);
  function pickIds(){
    let ids=[];try{ids=JSON.parse(ls.get("hh_arena_pick","[]"))||[];}catch(e){}
    const known=new Set(state.pokemon.map(p=>String(p.id)));
    return ids.map(String).filter(id=>known.has(id)).slice(0,6);
  }
  function savePick(ids){ls.set("hh_arena_pick",JSON.stringify(ids.slice(0,6)));}
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
      return {n:p.name,lv:Number(p.level||1),t:[p.type1,p.type2].filter(Boolean),img:img.startsWith("data:")?"":img};
    });
  }
  async function buildTeam(limit){
    const list=teamSource().slice(0,limit);
    const out=[];
    for(const p of list){
      const moves=(p.moves||[]).filter(m=>m.active&&!(typeof isMoveLevelLocked==="function"&&isMoveLevelLocked(m))).slice(0,5)
        .map(m=>({name:m.name,type:normalizeTypeName(m.type)||"Normal",category:m.category||"Status",power:Number(m.power||0),
          accuracy:m.alwaysHits||m.accuracy==null||m.accuracy===""?null:Number(m.accuracy),alwaysHits:!!m.alwaysHits,desc:String(m.description||"").slice(0,220)}));
      out.push({name:p.name||"Pokémon",level:Number(p.level||1),types:[normalizeTypeName(p.type1),normalizeTypeName(p.type2)].filter(Boolean),
        stats:{hp:Number(p.stats?.hp||0),atk:Number(p.stats?.atk||0),def:Number(p.stats?.def||0),spa:Number(p.stats?.spa||0),spd:Number(p.stats?.spd||0),spe:Number(p.stats?.spe||0)},
        maxHp:Math.max(1,Number(p.maxHp||p.stats?.hp||1)),ability:p.abilityName||"",img:await compactImage(displayPokemonImage(p)),
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
    connect();render();
  }
  function close(){
    if(B&&B.role!=="spec"&&B.state&&B.state.phase!=="end"&&!confirm("Sair da arena desiste da batalha atual. Sair mesmo?"))return;
    if(B)leaveBattle(true);
    root.hidden=true;document.body.classList.remove("ar7-open");
    disconnect();
  }
  window.hhArena={open,close,get battle(){return B;}};

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
  let connecting=false,status="off";
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
      lobby.on("broadcast",{event:"chat"},({payload})=>{chat.push(payload);chat=chat.slice(-60);render();if(!root.hidden)sfx("type");});
      lobby.on("broadcast",{event:"challenge"},({payload})=>onChallenge(payload));
      lobby.on("broadcast",{event:"challenge-cancel"},({payload})=>{if(incoming&&incoming.id===payload.id){incoming=null;render();}});
      lobby.on("broadcast",{event:"challenge-reply"},({payload})=>onReply(payload));
      await new Promise((ok,ko)=>lobby.subscribe(st=>{if(st==="SUBSCRIBED")ok();else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT")ko(new Error(st));}));
      status="on";await track();
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
    if(!B)return {status:"idle"};
    if(B.role==="spec")return {status:"watch",battle:B.id};
    return {status:"battle",battle:B.id,vs:B.names?.[B.role==="p1"?"p2":"p1"]||""};
  }
  async function track(){
    if(!lobby)return;
    try{await lobby.track({id:me.id,name:me.name,team:teamPreview(),at:Date.now(),...myStatus(),names:B?.names||null});}catch(e){}
  }
  const send=(ch,event,payload)=>ch?.send({type:"broadcast",event,payload});

  /* ---------- Desafios ---------- */
  function challenge(to,format){
    const id="b"+uidShort();
    outgoing={id,to,format,at:Date.now()};
    outgoing.arena=pickScene(scene);
    send(lobby,"challenge",{id,from:me.id,fromName:me.name,to,format,arena:outgoing.arena});
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
    if(accept)joinBattle({id:p.id,role:"p2",format:p.format,arena:p.arena,names:{p1:p.fromName,p2:me.name}});
    render();
  }
  function onReply(p){
    if(p.to!==me.id||!outgoing||outgoing.id!==p.id)return;
    const o=outgoing;outgoing=null;
    if(!p.accept){toast(p.busy?"O treinador está ocupado.":"Desafio recusado.");render();return;}
    joinBattle({id:o.id,role:"p1",format:o.format,arena:o.arena,names:{p1:me.name,p2:people[o.to]?.name||"Rival"}});
  }

  /* ---------- Batalha: rede ---------- */
  async function joinBattle({id,role,format,names,arena}){
    B={id,role,arena:sceneOk(arena)?arena:"standard",host:role==="p1",format:Number(format)||3,names,state:null,teams:null,pendingTeams:{},specs:{},queue:[],playing:false,log:[],chosen:false};
    for(const k in lastHp)delete lastHp[k];
    sfx("page");render();
    battleCh=sb.channel("hh-arena-b:"+id,{config:{presence:{key:me.id},broadcast:{self:false}}});
    battleCh.on("presence",{event:"sync"},onBattlePresence);
    battleCh.on("broadcast",{event:"team"},({payload})=>{if(B?.host)hostTeam(payload);});
    battleCh.on("broadcast",{event:"action"},({payload})=>{if(B?.host)hostAction(payload.side,payload.action,payload.turn);});
    battleCh.on("broadcast",{event:"sync"},()=>{if(B?.host&&B.state)send(battleCh,"start",{teams:B.teams,state:pub(B.state),names:B.names,format:B.format,arena:B.arena});});
    battleCh.on("broadcast",{event:"start"},({payload})=>{if(!B||B.host)return;if(!B.teams){B.teams=payload.teams;B.names=payload.names;B.format=payload.format;}if(sceneOk(payload.arena))B.arena=payload.arena;applyState(payload.state,true);});
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
      B.state=engine.newBattle({id:B.id,format:B.format,p1:B.pendingTeams.p1,p2:B.pendingTeams.p2});
      B.teams=B.state.teams;B.names={p1:B.pendingTeams.p1.name,p2:B.pendingTeams.p2.name};
      B.started=true;
      send(battleCh,"start",{teams:B.teams,state:pub(B.state),names:B.names,format:B.format,arena:B.arena});
      applyState(pub(B.state),true);track();
    }
  }
  function hostAction(side,action,turn){
    if(!B?.host||!B.state)return;
    if(turn!=null&&turn!==B.state.turn&&action.kind!=="forfeit")return;
    const ready=engine.submit(B.state,side,action);
    if(ready){engine.resolve(B.state);broadcastState();}
    else{broadcastState(true);}
  }
  function pub(s){
    // estado sem os times (que já foram enviados no início)
    return {id:s.id,format:s.format,turn:s.turn,phase:s.phase,winner:s.winner,reason:s.reason,events:s.events||[],
      sides:Object.fromEntries(["p1","p2"].map(k=>[k,{name:s.sides[k].name,active:s.sides[k].active,needSwitch:s.sides[k].needSwitch,ready:!!s.sides[k].pending,team:s.sides[k].team}]))};
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
        if(ev.k==="hit"||ev.k==="heal"){B.view.sides[ev.side].team[B.view.sides[ev.side].active].hp=ev.hp;}
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
      if(B.view.phase==="end"){const f=root.querySelector(".ar7-field");if(f){const t=document.createElement("b");t.className="ar7-turnban end";t.textContent=B.view.winner?`${sideName(B.view.winner)} venceu!`:"Fim";f.appendChild(t);}}
    }
    if(B)B.playing=false;
  }
  function sideName(s){return B?.names?.[s]||s;}
  function monName(side,idx){const t=B?.teams?.[side];const i=idx??B?.view?.sides?.[side]?.active;return t?.[i]?.name||"Pokémon";}
  function effText(m){return m===0?"Não teve efeito…":m>=4?"Extremamente efetivo!":m>=2?"É super efetivo!":m<=.25?"Quase não teve efeito…":m<=.5?"Não é muito efetivo…":"";}
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
      }else if(ev.k==="hit"){
        if(ev.immune){line=`${effText(0)}`;cls="weak";}
        else{
          line=`${ev.crit?"<b class='ar7-crit'>CRÍTICO!</b> ":""}${esc(monName(ev.side))} perdeu <b>${ev.amount}</b> HP <span class="ar7-dice">${ev.dice}d6 [${(ev.rolls||[]).join(", ")}]${ev.fixed?` ${ev.fixed>0?"+":""}${ev.fixed}`:""}${ev.stab?" · STAB":""}</span>`;
          const e=effText(ev.mult);if(e)line+=` <i>${e}</i>`;cls=ev.crit?"crit":ev.mult>=2?"super":ev.mult<1?"weak":"";
        }
      }else if(ev.k==="heal")line=`${esc(monName(ev.side))} recuperou <b>${ev.amount}</b> HP.`;
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
    }
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
  function lobbyView(){
    if(status==="error")return `<div class="ar7-card ar7-empty"><b>Não foi possível conectar à arena.</b><p>Confira a internet e tente de novo.</p><button type="button" class="ar7-btn primary" data-ar="retry">Tentar de novo</button></div>`;
    const list=Object.values(people).sort((a,b)=>(a.id===me.id?-1:b.id===me.id?1:a.name.localeCompare(b.name)));
    const others=list.filter(p=>p.id!==me.id);
    const battles={};
    list.filter(p=>p.status==="battle"&&p.battle).forEach(p=>{battles[p.battle]=battles[p.battle]||{id:p.battle,players:[],names:p.names};battles[p.battle].players.push(p.name);});
    const watchers={};list.filter(p=>p.status==="watch").forEach(p=>{watchers[p.battle]=(watchers[p.battle]||0)+1;});
    const myTeam=teamPreview();
    return `
    <section class="ar7-card ar7-me">
      <div class="ar7-me-row">
        <label class="ar7-field-label">Seu nome na arena<input id="ar7Name" maxlength="20" value="${esc(me.name)}" autocomplete="off"></label>
        <label class="ar7-field-label">Sala<span class="ar7-room"><input id="ar7Room" maxlength="24" value="${esc(room)}" autocomplete="off" spellcheck="false"><button type="button" class="ar7-btn" data-ar="room">Entrar</button></span></label>
      </div>
      ${teamEditor()}
      <div class="ar7-scenes-head"><small>Ambiente das suas batalhas (vale quando você desafia):</small><b>${scene==="random"?"Aleatório":esc(sceneLabel(scene))}</b></div>
      <div class="ar7-scenes" role="radiogroup" aria-label="Ambiente da batalha">
        <button type="button" role="radio" aria-checked="${scene==="random"}" class="ar7-scene rnd${scene==="random"?" on":""}" data-ar="scene" data-v="random"><i>🎲</i><b>Aleatório</b></button>
        ${SCENES.map(x=>`<button type="button" role="radio" aria-checked="${x.v===scene}" class="ar7-scene${x.v===scene?" on":""}" data-ar="scene" data-v="${esc(x.v)}"><i style="background-image:url('assets/arenas/${esc(x.v)}.png')"></i><b>${esc(x.label)}</b></button>`).join("")}
      </div>
      <p class="ar7-hint">Use uma sala com nome próprio (ex.: <code>mesa-do-nando</code>) para jogar só com seus amigos. A batalha não altera a ficha: todos começam com HP cheio.</p>
    </section>
    ${outgoing?`<section class="ar7-card ar7-wait"><b>Desafio enviado para ${esc(people[outgoing.to]?.name||"…")}</b><small>${outgoing.format>=6?"time todo":`${outgoing.format} vs ${outgoing.format}`} · aguardando resposta</small><button type="button" class="ar7-btn" data-ar="cancel">Cancelar</button></section>`:""}
    <section class="ar7-card">
      <h3>Treinadores na sala <small>${others.length}</small></h3>
      ${others.length?`<ul class="ar7-people">${others.map(p=>`<li class="ar7-person">
        <div class="ar7-person-head"><b>${esc(p.name)}</b><span class="ar7-badge ${esc(p.status)}">${p.status==="battle"?`em batalha${p.vs?` com ${esc(p.vs)}`:""}`:p.status==="watch"?"assistindo":"disponível"}</span></div>
        <span class="ar7-minis">${teamMinis(p.team)}</span>
        ${p.status==="idle"&&!outgoing&&myTeam.length?`<div class="ar7-formats" role="group" aria-label="Desafiar ${esc(p.name)}">
          <button type="button" class="ar7-btn primary ar7-ch-main" data-ar="challenge" data-to="${esc(p.id)}" data-format="6">⚔ Desafiar <small>time todo</small></button>
          <button type="button" class="ar7-btn" data-ar="challenge" data-to="${esc(p.id)}" data-format="3">3 vs 3</button>
          <button type="button" class="ar7-btn" data-ar="challenge" data-to="${esc(p.id)}" data-format="1">1 vs 1</button></div>`:""}
      </li>`).join("")}</ul>`:`<p class="ar7-empty-text">${status==="on"?"Ninguém mais nesta sala ainda. Mande o convite 🔗 para um amigo!":"Conectando…"}</p>`}
    </section>
    <section class="ar7-card">
      <h3>Batalhas acontecendo <small>${Object.keys(battles).length}</small></h3>
      ${Object.keys(battles).length?`<ul class="ar7-battles">${Object.values(battles).map(b=>`<li><span><b>${esc(b.names?.p1||b.players[0]||"?")}</b> vs <b>${esc(b.names?.p2||b.players[1]||"?")}</b>${watchers[b.id]?` <small>👁 ${watchers[b.id]}</small>`:""}</span>
        <button type="button" class="ar7-btn" data-ar="watch" data-id="${esc(b.id)}" data-p1="${esc(b.names?.p1||"")}" data-p2="${esc(b.names?.p2||"")}">👁 Assistir</button></li>`).join("")}</ul>`:`<p class="ar7-empty-text">Nenhuma batalha agora.</p>`}
    </section>
    <section class="ar7-card ar7-chat">
      <h3>Chat da sala</h3>
      <div class="ar7-chat-list" aria-live="polite">${chat.length?chat.map(c=>`<p><b>${esc(c.name)}:</b> ${esc(c.text)}</p>`).join(""):`<p class="ar7-empty-text">Diga oi! 👋</p>`}</div>
      <form class="ar7-chat-form" data-ar-form="chat"><input id="ar7Chat" maxlength="160" placeholder="Mensagem…" autocomplete="off"><button type="submit" class="ar7-btn primary">Enviar</button></form>
    </section>`;
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
  function challengeDialog(){
    const p=incoming;
    return `<div class="ar7-modal" role="alertdialog" aria-modal="true" aria-labelledby="ar7ChTitle">
      <div class="ar7-modal-box"><span class="ar7-modal-ico" aria-hidden="true">⚔</span>
        <h3 id="ar7ChTitle">${esc(p.fromName)} te desafiou!</h3>
        ${sceneOk(p.arena)?`<i class="ar7-modal-scene" style="background-image:url('assets/arenas/${esc(p.arena)}.png')"></i>`:""}<p>Formato: <b>${p.format===1?"1 vs 1":p.format>=6?"time todo (até 6)":`${p.format} vs ${p.format}`}</b>${sceneOk(p.arena)?` · Ambiente: <b>${esc(sceneLabel(p.arena))}</b>`:""}. Vai o time que você montou na arena (o primeiro começa).</p>
        <div class="ar7-modal-actions"><button type="button" class="ar7-btn" data-ar="decline">Recusar</button><button type="button" class="ar7-btn primary" data-ar="accept">Aceitar</button></div>
      </div></div>`;
  }

  function monCard(side,pos){
    const v=B.view,s=v.sides[side],t=B.teams[side],m=t[s.active],st=s.team[s.active];
    const pct=hpPct(st);
    return `<div class="ar7-spot ${pos}">
      <div class="ar7-hud"><div class="ar7-hud-name"><b>${esc(m.name)}</b><small>Lv. ${m.level}</small></div>
        <div class="ar7-hud-types">${(m.types||[]).map(x=>`<i style="--t:${typeColor(x)};--td:${typeDark(x)}">${esc(x)}</i>`).join("")}</div>
        <div class="ar7-hp ${hpClass(pct)}"><span>HP</span><div><i data-to="${pct}" style="--w:${lastHp[pos]??pct}%"></i></div>${pos==="me"?`<small class="ar7-hp-num">${st.hp} / ${st.maxHp}</small>`:""}</div>
        <div class="ar7-balls">${s.team.map(x=>`<i class="${x.fainted?"out":""}"></i>`).join("")}</div>
      </div>
      <div class="ar7-mon ${pos}${st.fainted?" fainted":""}${B.intro?" intro":""}">${m.img?`<img src="${esc(m.img)}" alt="${esc(m.name)}">`:`<i>${esc(m.name.slice(0,1))}</i>`}</div>
    </div>`;
  }
  const lastHp={};
  function battleView(){
    if(!B.view||!B.teams)return `<div class="ar7-card ar7-empty"><b>${B.role==="spec"?"Entrando para assistir…":"Preparando a batalha…"}</b><p>${B.role==="spec"?"Buscando o estado da batalha.":"Esperando os dois times chegarem."}</p><button type="button" class="ar7-btn" data-ar="leave">Voltar ao lobby</button></div>`;
    const v=B.view,mine=mySide(),foe=mine==="p1"?"p2":"p1";
    const specs=Object.values(B.specs||{});
    const ended=v.phase==="end";
    let panel="";
    if(ended){
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
      <div class="ar7-vs"><b>${esc(sideName(foe))}</b><span>VS</span><b>${esc(sideName(mine))}</b><small>Turno ${v.turn}${specs.length?` · 👁 ${specs.length}`:""}</small></div>
      <div class="ar7-field" data-scene="${esc(B.arena||"standard")}" style="--ar7-t:-${(performance.now()/1000).toFixed(2)}s">
        <div class="ar7-fx" aria-hidden="true"></div><i class="ar7-plat foe" aria-hidden="true"></i><i class="ar7-plat me" aria-hidden="true"></i>
        ${monCard(foe,"foe")}${monCard(mine,"me")}
        ${B.intro?`<div class="ar7-vsintro" aria-hidden="true"><b class="l">${esc(sideName(foe))}</b><span>VS</span><b class="r">${esc(sideName(mine))}</b></div>`:""}
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
    if(e.target.id==="ar7Name"){me.name=String(e.target.value||"").trim().slice(0,20)||"Treinador";ls.set("hh_arena_name",me.name);track();render();}
  });
  root.addEventListener("keydown",e=>{
    if(e.key==="Enter"&&e.target.id==="ar7Room"){e.preventDefault();switchRoom(e.target.value);}
    if(e.key==="Escape"&&!incoming&&!B)close();
  });
  window.addEventListener("beforeunload",()=>{if(B)leaveBattle(true);});

  // Convite: ?arena=sala abre direto na arena
  if(new URLSearchParams(location.search).has("arena"))setTimeout(open,600);
})();
