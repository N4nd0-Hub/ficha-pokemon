/* ============================================================
   V6 — PC de Troca
   O botão "Importar" abre um PC de troca:
   • RECEBER: o jogador digita o código que o Mestre mandou e o
     Pokémon surge na tela, indo para a Equipe (se houver vaga) ou
     para o PC.
   • ENVIAR: o Mestre escolhe um Pokémon da própria ficha (oficial ou
     fakemon) e gera um código curto (XXXX-XXXX), guardado no Supabase
     da Pokédex GM. Sem internet, gera um código longo offline.
   • ARQUIVO: a importação antiga de JSON (substitui todas as fichas).
   ============================================================ */
(function(){
  "use strict";
  const btn=document.getElementById("importBtn");
  if(!btn||typeof state==="undefined"||window.hhTradePc)return;

  const API="https://eoteckuikfmhfmkbbndc.supabase.co/rest/v1/rpc/";
  const KEY="sb_publishable_a7zlErG9omVgrP_W9MK-4w_yjvP3Qd8";
  const TEAM_MAX=6;
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const sfx=n=>window.hhClassicSfx?.[n]?.();
  const reduce=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const wait=ms=>new Promise(r=>setTimeout(r,reduce()?Math.min(ms,80):ms));
  const toast=t=>typeof showToast==="function"?showToast(t):null;
  const deep=o=>typeof clone==="function"?clone(o):JSON.parse(JSON.stringify(o));
  const newId=()=>typeof uid==="function"?uid():Math.random().toString(36).slice(2,12);

  /* ---------- Imagem do Pokémon ---------- */
  function artOf(p){
    if(p?.imageUrl&&!/^\[/.test(p.imageUrl))return p.imageUrl;
    const id=Number(p?.apiData?.pokemonId||p?.dex)||0;
    return id?`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`:"";
  }
  const typeChip=t=>t?(typeof typeIconHtml==="function"?typeIconHtml(t,true):`<span class="tp-type">${esc(t)}</span>`):"";

  /* ---------- Códigos ---------- */
  async function rpc(fn,body){
    const res=await fetch(API+fn,{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await res.json().catch(()=>null);
    if(!res.ok)throw new Error(data?.message||"Falha na conexão com o PC de Troca.");
    return data;
  }
  const b64u={
    enc:bytes=>{let s="";bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");},
    dec:str=>{const s=atob(str.replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(s,c=>c.charCodeAt(0));}
  };
  async function offlineCode(payload){
    const raw=new TextEncoder().encode(JSON.stringify(payload));
    if(typeof CompressionStream==="undefined")return "HH0."+b64u.enc(raw);
    const z=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
    return "HH1."+b64u.enc(new Uint8Array(z));
  }
  async function readOffline(code){
    const [tag,body]=code.split(".");
    const bytes=b64u.dec(body.replace(/\s+/g,""));
    const raw=tag==="HH1"?new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()):bytes;
    return JSON.parse(new TextDecoder().decode(raw));
  }
  function packPokemon(p,{fullHp}){
    const c=deep(p);
    delete c.id;c.favorite=false;delete c.storageGroup;
    if(fullHp){c.currentHp=c.maxHp;if(Array.isArray(c.conditions))c.conditions=[];if("statusCondition"in c)c.statusCondition="";}
    return {kind:"hh-pokemon-gift",v:1,sentAt:new Date().toISOString(),pokemon:c};
  }
  async function fetchGift(code){
    const clean=code.trim();
    if(/^HH[01]\./i.test(clean))return {code:"offline",payload:await readOffline(clean.replace(/^hh/,"HH"))};
    const data=await rpc("pokemon_gift_redeem",{p_code:clean});
    return {code:data.code,payload:data.payload};
  }
  function addToSheet(payload){
    if(payload?.kind!=="hh-pokemon-gift"||!payload.pokemon||typeof payload.pokemon!=="object")throw new Error("Esse código não contém um Pokémon válido.");
    const p=deep(payload.pokemon);
    p.id=newId();
    if(p.name==null)p.name="Pokémon";if(p.level==null)p.level=1;
    const team=state.pokemon.filter(x=>x.storageGroup==="team").length;
    p.storageGroup=team<TEAM_MAX?"team":"box";
    p.favorite=false;
    try{if(typeof repairPokemonMoves==="function")repairPokemonMoves(p);}catch(e){}
    try{if(typeof ensurePage2Data==="function")ensurePage2Data(p);}catch(e){}
    try{if(typeof ensureProgression==="function")ensureProgression(p);}catch(e){}
    p.storageGroup=team<TEAM_MAX?"team":"box";
    state.pokemon.push(p);
    try{renderAll();}catch(e){}
    try{saveState();}catch(e){}
    return p;
  }

  /* ---------- Estrutura ---------- */
  const modal=document.createElement("div");
  modal.className="tp-modal";modal.id="tradePcModal";modal.hidden=true;
  modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-labelledby","tpTitle");
  modal.innerHTML=`
    <div class="tp-backdrop" data-tp-close></div>
    <div class="tp-machine">
      <header class="tp-head">
        <span class="tp-led"></span><span class="tp-led y"></span><span class="tp-led g"></span>
        <h2 id="tpTitle">PC DE TROCA</h2>
        <button type="button" class="tp-x" data-tp-close aria-label="Fechar">✕</button>
      </header>
      <nav class="tp-tabs" role="tablist">
        <button type="button" role="tab" data-tp-tab="receive">📥 RECEBER</button>
        <button type="button" role="tab" data-tp-tab="send">📤 ENVIAR <small>Mestre</small></button>
        <button type="button" role="tab" data-tp-tab="file">💾 ARQUIVO</button>
      </nav>
      <div class="tp-screen">
        <div class="tp-scan" aria-hidden="true"></div>

        <section class="tp-view" data-tp-view="receive">
          <div class="tp-receive-form" id="tpReceiveForm">
            <p class="tp-lead">Digite o código que o Mestre te mandou.</p>
            <form id="tpCodeForm" autocomplete="off">
              <input id="tpCode" class="tp-code" placeholder="XXXX-XXXX" spellcheck="false" aria-label="Código do Pokémon" maxlength="20000">
              <button type="submit" class="tp-go">RECEBER</button>
            </form>
            <p class="tp-where" id="tpWhere"></p>
            <p class="tp-err" id="tpErr" role="alert"></p>
          </div>
          <div class="tp-show" id="tpShow" hidden>
            <div class="tp-stage" id="tpStage">
              <div class="tp-beam"></div>
              <div class="tp-rings"><i></i><i></i><i></i></div>
              <img class="tp-pokeball" id="tpBall" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" alt="">
              <div class="tp-flash"></div>
              <img class="tp-mon" id="tpMon" alt="">
              <div class="tp-spark" id="tpSpark"></div>
            </div>
            <div class="tp-card" id="tpCard"></div>
            <div class="tp-actions" id="tpActions"></div>
          </div>
        </section>

        <section class="tp-view" data-tp-view="send" hidden>
          <p class="tp-lead">Escolha um Pokémon da sua ficha para virar código. Oficiais e fakemons, com arte, golpes e tudo mais.</p>
          <input class="tp-search" id="tpSearch" placeholder="Filtrar por nome..." aria-label="Filtrar Pokémon">
          <div class="tp-list" id="tpList"></div>
          <div class="tp-opts">
            <label><input type="checkbox" id="tpSingle" checked> Uso único (só um jogador recebe)</label>
            <label><input type="checkbox" id="tpFull" checked> Enviar com HP cheio e sem status</label>
          </div>
          <button type="button" class="tp-go wide" id="tpMake" disabled>GERAR CÓDIGO</button>
          <div class="tp-made" id="tpMade" hidden></div>
        </section>

        <section class="tp-view" data-tp-view="file" hidden>
          <div class="tp-file">
            <div class="tp-disk" aria-hidden="true"></div>
            <p class="tp-lead">Carregar um <b>arquivo JSON completo</b> da ficha (o mesmo do “Exportar JSON”).</p>
            <p class="tp-warn">⚠ Isso <b>substitui todas as fichas</b> desta tela pelo conteúdo do arquivo. Para receber só um Pokémon, use a aba Receber.</p>
            <button type="button" class="tp-go wide" id="tpFileBtn">ESCOLHER ARQUIVO .JSON</button>
          </div>
        </section>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const $=id=>modal.querySelector("#"+id);
  let tab="receive",picked=null,lastFocus=null,busy=false,received=null;

  function teamInfo(){
    const n=state.pokemon.filter(x=>x.storageGroup==="team").length;
    return n<TEAM_MAX?`Equipe: ${n}/${TEAM_MAX} — o Pokémon entra na sua equipe.`:`Equipe cheia (${TEAM_MAX}/${TEAM_MAX}) — o Pokémon vai para o PC.`;
  }
  function setTab(t){
    tab=t;
    modal.querySelectorAll("[data-tp-tab]").forEach(b=>{const on=b.dataset.tpTab===t;b.classList.toggle("on",on);b.setAttribute("aria-selected",on);});
    modal.querySelectorAll("[data-tp-view]").forEach(v=>v.hidden=v.dataset.tpView!==t);
    if(t==="send")renderList();
    if(t==="receive"){$("tpWhere").textContent=teamInfo();}
    sfx("select");
  }
  function open(){
    lastFocus=document.activeElement;
    try{if(typeof setMobileToolsOpen==="function")setMobileToolsOpen(false);}catch(e){}
    modal.hidden=false;document.body.classList.add("tp-open");
    resetReceive();setTab("receive");
    if(!reduce())modal.querySelector(".tp-machine").animate([{transform:"translateY(30px) scale(.96)",opacity:0},{transform:"none",opacity:1}],{duration:280,easing:"cubic-bezier(.2,.9,.3,1.1)"});
    setTimeout(()=>$("tpCode").focus(),60);
  }
  function close(){if(busy)return;modal.hidden=true;document.body.classList.remove("tp-open");lastFocus?.focus?.();}
  function resetReceive(){
    $("tpReceiveForm").hidden=false;$("tpShow").hidden=true;$("tpErr").textContent="";$("tpCode").value="";
    $("tpWhere").textContent=teamInfo();received=null;
  }

  /* ---------- Enviar (Mestre) ---------- */
  function renderList(){
    const q=$("tpSearch").value.trim().toLowerCase();
    const list=state.pokemon.filter(p=>!q||String(p.name||"").toLowerCase().includes(q));
    $("tpList").innerHTML=list.map(p=>{
      const art=artOf(p);
      return `<button type="button" class="tp-pick${picked===p.id?" on":""}" data-tp-pick="${esc(p.id)}">
        <span class="tp-pick-img">${art?`<img src="${esc(art)}" alt="" loading="lazy">`:"?"}</span>
        <b>${esc(p.name||"Sem nome")}</b><small>Lv${esc(p.level||1)}${p.apiData?.custom?" · Fakemon":""}</small></button>`;
    }).join("")||`<p class="tp-lead">Nenhum Pokémon encontrado.</p>`;
    $("tpMake").disabled=!picked||busy;
  }
  async function makeCode(){
    const p=state.pokemon.find(x=>x.id===picked);if(!p||busy)return;
    busy=true;$("tpMake").disabled=true;$("tpMake").textContent="CONECTANDO...";
    const payload=packPokemon(p,{fullHp:$("tpFull").checked});
    const made=$("tpMade");made.hidden=false;
    try{
      const code=await rpc("pokemon_gift_create",{p_payload:payload,p_label:String(p.name||""),p_single:$("tpSingle").checked});
      made.innerHTML=`<div class="tp-made-head">Código de <b>${esc(p.name)}</b></div>
        <div class="tp-bigcode" id="tpBig">${esc(code)}</div>
        <div class="tp-made-btns"><button type="button" data-tp-copy="${esc(code)}">📋 COPIAR CÓDIGO</button>
        <button type="button" data-tp-copy="${esc(`Você recebeu ${p.name}! Abra a ficha, clique em PC de Troca e use o código: ${code}`)}">💬 COPIAR MENSAGEM</button></div>
        <small>${$("tpSingle").checked?"Uso único: depois de recebido, o código para de funcionar.":"Vários jogadores podem usar este código."} Vale por 1 ano.</small>`;
      sfx("page");
      if(!reduce())$("tpBig").animate([{transform:"scale(.6)",opacity:0},{transform:"scale(1.08)",opacity:1,offset:.6},{transform:"none"}],{duration:420});
    }catch(err){
      try{
        const code=await offlineCode(payload);
        made.innerHTML=`<div class="tp-made-head">Sem conexão com o servidor — use o <b>código offline</b> de ${esc(p.name)}:</div>
          <textarea class="tp-longcode" readonly>${esc(code)}</textarea>
          <div class="tp-made-btns"><button type="button" data-tp-copy="${esc(code)}">📋 COPIAR CÓDIGO OFFLINE</button></div>
          <small>${esc(err.message||"")} O código offline é longo, mas funciona do mesmo jeito.</small>`;
      }catch(e2){made.innerHTML=`<p class="tp-err">Não foi possível gerar o código: ${esc(err.message||e2.message)}</p>`;}
    }
    busy=false;$("tpMake").textContent="GERAR CÓDIGO";$("tpMake").disabled=!picked;
  }

  /* ---------- Receber + animação ---------- */
  async function receive(code){
    if(busy)return;
    const value=String(code||"").trim();
    if(!value){$("tpErr").textContent="Digite o código.";return;}
    busy=true;$("tpErr").textContent="";
    const go=modal.querySelector("#tpCodeForm .tp-go");go.disabled=true;go.textContent="CONECTANDO...";
    let gift;
    try{gift=await fetchGift(value);}
    catch(err){busy=false;go.disabled=false;go.textContent="RECEBER";$("tpErr").textContent=err.message||"Código inválido.";sfx("error");
      if(!reduce())$("tpCode").animate([{transform:"translateX(0)"},{transform:"translateX(-8px)"},{transform:"translateX(8px)"},{transform:"none"}],{duration:300});return;}
    go.disabled=false;go.textContent="RECEBER";
    let p;
    try{p=addToSheet(gift.payload);}catch(err){busy=false;$("tpErr").textContent=err.message;sfx("error");return;}
    received=p;
    await playReveal(p);
    busy=false;
  }
  async function playReveal(p){
    $("tpReceiveForm").hidden=true;$("tpShow").hidden=false;
    const stage=$("tpStage"),mon=$("tpMon"),ball=$("tpBall"),card=$("tpCard");
    card.innerHTML="";$("tpActions").innerHTML="";
    stage.className="tp-stage s-link";
    const art=artOf(p);
    if(art)mon.src=art;else mon.removeAttribute("src");
    mon.classList.toggle("noart",!art);
    card.innerHTML=`<div class="tp-msg" id="tpMsg">Conectando ao PC de Troca...</div>`;
    sfx("type");
    await wait(900);
    stage.className="tp-stage s-ball";$("tpMsg").textContent="Recebendo transferência...";
    await wait(1000);
    stage.className="tp-stage s-open";sfx("page");
    await wait(450);
    stage.className="tp-stage s-reveal";
    await wait(900);
    stage.className="tp-stage s-done";
    sparkles();
    const where=p.storageGroup==="team"?"entrou na sua <b>Equipe</b>!":"foi enviado para o <b>PC</b> (equipe cheia).";
    card.innerHTML=`<div class="tp-name">${esc(p.name||"Pokémon")}</div>
      <div class="tp-meta"><span>Lv${esc(p.level||1)}</span>${typeChip(p.type1)}${typeChip(p.type2)}</div>
      <div class="tp-msg">Você recebeu <b>${esc(p.name)}</b>! Ele ${where}</div>`;
    if(!reduce())card.querySelector(".tp-name").animate([{transform:"scale(.4)",opacity:0,letterSpacing:".6em"},{transform:"scale(1.1)",opacity:1,offset:.6},{transform:"none",letterSpacing:".04em"}],{duration:600,easing:"ease-out"});
    $("tpActions").innerHTML=`<button type="button" class="tp-go" data-tp-act="view">VER FICHA</button><button type="button" class="tp-ghost" data-tp-act="again">RECEBER OUTRO</button>`;
    sfx("page");
    toast(`📥 ${p.name} chegou ${p.storageGroup==="team"?"na Equipe":"no PC"}!`);
  }
  function sparkles(){
    if(reduce())return;
    const box=$("tpSpark");box.innerHTML="";
    for(let i=0;i<18;i++){
      const s=document.createElement("i");
      const a=Math.PI*2*i/18,d=90+Math.random()*70;
      box.appendChild(s);
      s.animate([{transform:"translate(-50%,-50%) scale(.2)",opacity:1},{transform:`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d}px)) scale(1) rotate(180deg)`,opacity:0}],{duration:1100+Math.random()*400,easing:"cubic-bezier(.2,.8,.3,1)",delay:Math.random()*150}).finished.then(()=>s.remove());
    }
  }

  /* ---------- Eventos ---------- */
  modal.addEventListener("click",e=>{
    const t=e.target;
    if(t.closest("[data-tp-close]")){close();return;}
    const tb=t.closest("[data-tp-tab]");if(tb&&!busy){setTab(tb.dataset.tpTab);return;}
    const pk=t.closest("[data-tp-pick]");if(pk&&!busy){picked=pk.dataset.tpPick;$("tpMade").hidden=true;renderList();sfx("select");return;}
    if(t.closest("#tpMake")){makeCode();return;}
    const cp=t.closest("[data-tp-copy]");
    if(cp){navigator.clipboard?.writeText(cp.dataset.tpCopy).then(()=>{toast("📋 Copiado!");cp.classList.add("ok");setTimeout(()=>cp.classList.remove("ok"),1200);}).catch(()=>toast("Selecione e copie manualmente."));return;}
    if(t.closest("#tpFileBtn")){close();document.getElementById("importInput")?.click();return;}
    const act=t.closest("[data-tp-act]");
    if(act){
      if(act.dataset.tpAct==="again"){resetReceive();$("tpCode").focus();return;}
      if(act.dataset.tpAct==="view"&&received){
        state.currentId=received.id;
        try{current=received;}catch(e){}
        try{renderAll();if(typeof setActiveSheetPage==="function")setActiveSheetPage("page1");}catch(e){}
        close();
      }
    }
  });
  $("tpCodeForm").addEventListener("submit",e=>{e.preventDefault();receive($("tpCode").value);});
  $("tpCode").addEventListener("input",e=>{
    const el=e.target,v=el.value;
    if(/^hh[01]\./i.test(v.trim())){el.classList.add("long");return;}
    el.classList.remove("long");
    const c=v.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
    el.value=c.length>4?c.slice(0,4)+"-"+c.slice(4):c;
  });
  $("tpSearch").addEventListener("input",renderList);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)close();});

  // O botão Importar passa a abrir o PC de Troca.
  btn.onclick=null;
  btn.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();open();},true);
  btn.title="PC de Troca: receber Pokémon por código, enviar (Mestre) ou importar arquivo JSON";
  function relabel(){const l=btn.querySelector(".tb-label");if(l&&l.textContent!=="PC de Troca"){l.textContent="PC de Troca";btn.setAttribute("aria-label","PC de Troca");}else if(!l&&!btn.querySelector(".tb-ico"))btn.textContent="PC de Troca";}
  relabel();setTimeout(relabel,300);
  new MutationObserver(relabel).observe(btn,{childList:true,subtree:true,characterData:true});

  window.hhTradePc={open,close,receive,packPokemon,offlineCode,readOffline,addToSheet};
})();
