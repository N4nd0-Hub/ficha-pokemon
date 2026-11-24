/* ============================================================
   V6 — Gimmicks (Tera, Z-Move, Mega)
   • Os três botões viram um "painel de poderes" com orbes, nome,
     luz de estado (pronto / ativo / usado) e brilho quando ativos.
   • Os menus ganham fundo animado próprio, grade de cristais de
     tipo no lugar do <select> e ativação de "segurar para carregar".
   • Ao ativar, a arena toca uma cena: cristais (Tera), raios
     dourados com o Z (Z-Move) ou a esfera de energia (Mega). Depois
     o Pokémon fica com uma aura enquanto o poder estiver ativo.
   As regras continuam nas funções originais da ficha.
   ============================================================ */
(function(){
  "use strict";
  const screen=document.querySelector(".combat-screen");
  const dock=document.querySelector(".combat-gimmicks");
  if(!screen||!dock||dock.dataset.gx||typeof state==="undefined")return;
  dock.dataset.gx="1";

  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const reduce=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const sfx=n=>window.hhClassicSfx?.[n]?.();
  const wait=ms=>new Promise(r=>setTimeout(r,reduce()?Math.min(ms,60):ms));
  const TYPES=typeof POKEMON_TYPES!=="undefined"?POKEMON_TYPES:["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
  const color=t=>{try{return moveTypePalette(t).main;}catch(e){return "#9aa0a8";}};
  const g=()=>{try{ensureGimmicks();}catch(e){}return current?.gimmicks||{};};
  const say=t=>{const el=document.getElementById("btText");if(el)el.textContent=t;};

  /* ---------- Painel de poderes ---------- */
  const INFO={
    tera:{id:"teraGimmickBtn",name:"TERA",hint:"Terastalizar",color:"#5fd8ea"},
    z:{id:"zGimmickBtn",name:"Z-MOVE",hint:"Poder Z",color:"#f2c230"},
    mega:{id:"megaGimmickBtn",name:"MEGA",hint:"Mega Evolução",color:"#c38cff"}
  };
  dock.classList.add("gx-dock");
  dock.insertAdjacentHTML("afterbegin",`<div class="gx-dock-head"><i></i>PODERES</div>`);
  Object.entries(INFO).forEach(([k,info])=>{
    const b=document.getElementById(info.id);if(!b)return;
    b.classList.add("gx-orb",`gx-${k}`);
    b.style.setProperty("--gx",info.color);
    b.insertAdjacentHTML("afterbegin",`<span class="gx-ring" aria-hidden="true"></span>`);
    b.insertAdjacentHTML("beforeend",`<span class="gx-label"><b>${info.name}</b><small class="gx-state">PRONTO</small></span><span class="gx-led" aria-hidden="true"></span>`);
  });

  function syncDock(){
    const G=g();
    const st={
      tera:G.tera?.active?["on",`${G.tera.type||"ATIVO"}`]:["ready","PRONTO"],
      z:G.zMove?.prepared?(G.zMove.used?["used","USADO"]:["on",`Z ${G.zMove.type||""}`]):["ready","PRONTO"],
      mega:G.mega?.active?["on","ATIVA"]:["ready","PRONTO"]
    };
    Object.entries(INFO).forEach(([k,info])=>{
      const b=document.getElementById(info.id);if(!b)return;
      const [s,label]=st[k];
      b.dataset.gxState=s;
      const lab=b.querySelector(".gx-state");if(lab)lab.textContent=label.toUpperCase();
      if(k==="tera")b.style.setProperty("--gx",G.tera?.active?color(G.tera.type):info.color);
      b.setAttribute("aria-label",`${info.hint}: ${label}`);
    });
    // aura persistente na arena
    screen.classList.toggle("gx-tera-on",!!G.tera?.active);
    screen.classList.toggle("gx-z-on",!!(G.zMove?.prepared&&!G.zMove?.used));
    screen.classList.toggle("gx-mega-on",!!G.mega?.active);
    if(G.tera?.active)screen.style.setProperty("--gx-tera",color(G.tera.type));
    if(G.zMove?.prepared)screen.style.setProperty("--gx-z",color(G.zMove.type));
  }

  /* ---------- Menus ---------- */
  const MODALS={
    tera:{el:document.getElementById("teraGimmickModal"),select:"teraTypeSelect",title:"Escolha o Tera Type",icon:"assets/gimmicks/tera.webp"},
    z:{el:document.getElementById("zGimmickModal"),select:"zMoveTypeSelect",title:"Escolha a Z-Stone",icon:"assets/gimmicks/z-move.webp"},
    mega:{el:document.getElementById("megaGimmickModal"),icon:"assets/gimmicks/mega.webp"}
  };
  Object.entries(MODALS).forEach(([k,m])=>{
    const modal=m.el?.querySelector(".gimmick-modal");if(!modal)return;
    modal.classList.add("gx-modal",`gx-modal-${k}`);
    modal.insertAdjacentHTML("afterbegin",`<div class="gx-bg" aria-hidden="true"><i></i><i></i><i></i></div>`);
    const sym=modal.querySelector(".gimmick-modern-hero-symbol");
    if(sym)sym.innerHTML=`<span class="gx-orbit"></span><img src="${m.icon}" alt="">`;
    const orb=modal.querySelector(".gimmick-modern-orb");
    if(orb)orb.innerHTML=`<img src="${m.icon}" alt="">`;
    if(m.select){
      const field=modal.querySelector(".gimmick-modern-field");
      field?.classList.add("gx-hidden-field");
      field?.insertAdjacentHTML("afterend",`<div class="gx-gems-wrap"><div class="gx-gems-head"><span class="gimmick-modern-step">01</span><b>${m.title}</b><small class="gx-picked"></small></div><div class="gx-gems" data-gx-select="${m.select}" role="radiogroup" aria-label="${m.title}">${TYPES.map(t=>`<button type="button" class="gx-gem" role="radio" data-type="${esc(t)}" style="--t:${color(t)}"><i></i><span>${esc(t)}</span></button>`).join("")}</div></div>`);
    }
  });
  function syncGems(){
    document.querySelectorAll(".gx-gems").forEach(grid=>{
      const sel=document.getElementById(grid.dataset.gxSelect);if(!sel)return;
      grid.querySelectorAll(".gx-gem").forEach(b=>{const on=b.dataset.type===sel.value;b.classList.toggle("on",on);b.setAttribute("aria-checked",on);});
      const head=grid.parentElement.querySelector(".gx-picked");if(head)head.innerHTML=`<i style="--t:${color(sel.value)}"></i>${esc(sel.value)}`;
      grid.closest(".gx-modal")?.style.setProperty("--gx-pick",color(sel.value));
    });
  }
  document.addEventListener("click",e=>{
    const gem=e.target.closest(".gx-gem");if(!gem)return;
    const sel=document.getElementById(gem.closest(".gx-gems").dataset.gxSelect);if(!sel)return;
    sel.value=gem.dataset.type;sel.dispatchEvent(new Event("change",{bubbles:true}));
    syncGems();sfx("select");
    if(!reduce())gem.animate([{transform:"scale(1)"},{transform:"scale(1.18) rotate(-6deg)"},{transform:"scale(1)"}],{duration:280});
  });

  /* ---------- Segurar para ativar ---------- */
  const HOLD=650;
  function holdButton(id,action,label){
    const b=document.getElementById(id);if(!b)return;
    b.onclick=null;b.classList.add("gx-hold");
    b.insertAdjacentHTML("beforeend",`<span class="gx-hold-fill" aria-hidden="true"></span><small class="gx-hold-tip">SEGURE</small>`);
    let raf=0,t0=0,done=false;
    const set=v=>b.style.setProperty("--hold",v);
    const stop=()=>{cancelAnimationFrame(raf);if(!done)set(0);b.classList.remove("charging");};
    b.addEventListener("pointerdown",e=>{
      if(b.disabled||e.button>0)return;
      done=false;t0=performance.now();b.classList.add("charging");sfx("type");
      const tick=now=>{const k=Math.min(1,(now-t0)/HOLD);set(k);if(k>=1){done=true;b.classList.remove("charging");set(0);action();return;}raf=requestAnimationFrame(tick);};
      raf=requestAnimationFrame(tick);
    });
    ["pointerup","pointerleave","pointercancel"].forEach(ev=>b.addEventListener(ev,()=>{if(!done&&b.classList.contains("charging")){b.classList.add("nudge");setTimeout(()=>b.classList.remove("nudge"),400);}stop();}));
    // teclado (Enter/Espaço) ativa direto
    b.addEventListener("click",e=>{if(e.detail===0&&!b.disabled)action();});
    b.setAttribute("aria-label",`${label} (segure para ativar)`);
  }
  holdButton("activateTeraBtn",()=>window.activateTera(),"Terastalizar");
  holdButton("prepareZMoveBtn",()=>window.prepareZMove(),"Preparar Z-Stone");
  holdButton("usePreparedZMoveBtn",()=>window.consumeZMove(),"Consumir Z-Move");

  /* ---------- Cenas de ativação na arena ---------- */
  const fx=document.createElement("div");fx.className="gx-fx";fx.setAttribute("aria-hidden","true");screen.appendChild(fx);
  const closeModals=()=>document.querySelectorAll("#teraGimmickModal.open,#zGimmickModal.open,#megaGimmickModal.open").forEach(m=>m.classList.remove("open"));
  function stageCenter(){
    const s=screen.getBoundingClientRect(),p=(document.getElementById("combatPortraitImg")||screen.querySelector(".combat-pokemon-stage")).getBoundingClientRect();
    return {x:p.left-s.left+p.width/2,y:p.top-s.top+p.height*.5,w:p.width,h:p.height};
  }
  function clear(){fx.innerHTML="";fx.className="gx-fx";}
  async function cinematicTera(type){
    if(reduce())return;
    const c=stageCenter(),col=color(type);
    clear();fx.classList.add("gx-play","tera");fx.style.setProperty("--c",col);
    fx.insertAdjacentHTML("beforeend",`<div class="gx-dim"></div><div class="gx-title"><small>TERASTALIZAÇÃO</small><b>${esc(type)}</b></div>`);
    for(let i=0;i<16;i++){
      const s=document.createElement("i");s.className="gx-shard";
      const a=Math.PI*2*i/16,d=Math.max(c.w,c.h)*.9;
      s.style.cssText=`left:${c.x}px;top:${c.y}px;--sx:${Math.cos(a)*d}px;--sy:${Math.sin(a)*d}px;--r:${a}rad;animation-delay:${i*18}ms`;
      fx.appendChild(s);
    }
    fx.insertAdjacentHTML("beforeend",`<div class="gx-crystal" style="left:${c.x}px;top:${c.y}px;width:${c.w*.9}px;height:${c.h*.95}px"></div><div class="gx-flash"></div>`);
    sfx("page");
    await wait(1900);clear();
  }
  async function cinematicZ(type,used){
    if(reduce())return;
    const c=stageCenter(),col=color(type);
    clear();fx.classList.add("gx-play","z");fx.style.setProperty("--c",col);
    fx.insertAdjacentHTML("beforeend",`<div class="gx-dim"></div><div class="gx-rays" style="left:${c.x}px;top:${c.y}px"></div><div class="gx-bigz">Z</div><div class="gx-title"><small>${used?"Z-MOVE!":"Z-STONE PREPARADA"}</small><b>${esc(type)}</b></div><div class="gx-flash"></div>`);
    sfx("page");
    await wait(1800);clear();
  }
  let megaCharge=null;
  function megaStart(){
    if(reduce())return;
    const c=stageCenter();
    clear();fx.classList.add("gx-play","mega","charging");
    fx.insertAdjacentHTML("beforeend",`<div class="gx-dim"></div><div class="gx-sphere" style="left:${c.x}px;top:${c.y}px;width:${Math.max(c.w,c.h)}px;height:${Math.max(c.w,c.h)}px"><i></i><i></i><i></i></div><div class="gx-dna" style="left:${c.x}px;top:${c.y}px">${Array.from({length:10},(_,i)=>`<i style="--i:${i}"></i>`).join("")}</div>`);
    megaCharge=Date.now();
  }
  async function megaEnd(ok,label){
    if(reduce()){clear();return;}
    if(!megaCharge)megaStart();
    const elapsed=Date.now()-(megaCharge||Date.now());
    if(elapsed<1100)await wait(1100-elapsed);
    megaCharge=null;
    if(!ok){clear();return;}
    fx.classList.remove("charging");
    fx.insertAdjacentHTML("beforeend",`<div class="gx-flash rainbow"></div><div class="gx-title"><small>MEGA EVOLUÇÃO</small><b>${esc(label||"Mega")}</b></div>`);
    sfx("page");
    await wait(1500);clear();
  }

  /* ---------- Ligando nas funções da ficha ---------- */
  function wrap(name,after){
    const orig=window[name];if(typeof orig!=="function")return;
    window[name]=function(){
      const before=JSON.parse(JSON.stringify(g()));
      const r=orig.apply(this,arguments);
      if(r&&typeof r.then==="function")return r.then(v=>{after(before,arguments);return v;});
      after(before,arguments);return r;
    };
  }
  wrap("activateTera",before=>{const G=g();if(G.tera?.active&&(!before.tera?.active||before.tera.type!==G.tera.type)){closeModals();say(`${(current.name||"").toUpperCase()} Terastalizou! Agora é tipo ${G.tera.type}.`);cinematicTera(G.tera.type);}});
  wrap("prepareZMove",before=>{const G=g();if(G.zMove?.prepared&&!G.zMove.used){closeModals();say(`Z-Stone ${G.zMove.type} preparada! O poder Z está pronto.`);cinematicZ(G.zMove.type,false);}});
  wrap("consumeZMove",before=>{const G=g();if(G.zMove?.used&&!before.zMove?.used){closeModals();say(`${(current.name||"").toUpperCase()} libera todo o poder Z!`);cinematicZ(G.zMove.type,true);}});
  ["activateMegaEvolution","activateCustomMegaEvolution"].forEach(name=>{
    const orig=window[name];if(typeof orig!=="function")return;
    window[name]=function(){
      const was=!!g().mega?.active;
      closeModals();megaStart();
      let r;
      try{r=orig.apply(this,arguments);}catch(e){megaEnd(false);throw e;}
      Promise.resolve(r).then(()=>{
        const G=g();const ok=!!G.mega?.active&&(!was||true);
        if(ok)say(`${(current.name||"").toUpperCase()} Mega Evoluiu!`);
        megaEnd(ok,current.name);
      },()=>megaEnd(false));
      return r;
    };
  });
  const origUI=window.renderGimmickUI;
  if(typeof origUI==="function")window.renderGimmickUI=function(){const r=origUI.apply(this,arguments);try{syncDock();syncGems();}catch(e){}return r;};
  ["openTeraGimmickModal","openZGimmickModal","openMegaGimmickModal"].forEach(n=>{
    const orig=window[n];if(typeof orig!=="function")return;
    window[n]=function(){const r=orig.apply(this,arguments);syncGems();sfx("page");return r;};
  });
  // os botões foram ligados às funções antigas; religa para as novas
  document.getElementById("teraGimmickBtn").onclick=()=>window.openTeraGimmickModal();
  document.getElementById("zGimmickBtn").onclick=()=>window.openZGimmickModal();
  document.getElementById("megaGimmickBtn").onclick=()=>window.openMegaGimmickModal();
  document.getElementById("deactivateTeraBtn").onclick=()=>window.deactivateTera();
  document.getElementById("resetZMoveBtn").onclick=()=>window.resetZMove();
  document.getElementById("revertMegaBtn").onclick=()=>window.revertMegaEvolution();

  try{syncDock();syncGems();}catch(e){}
  window.hhGimmicks={cinematicTera,cinematicZ,megaStart,megaEnd,syncDock};
})();
