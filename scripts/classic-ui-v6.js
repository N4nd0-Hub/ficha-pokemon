/* ============================================================
   V6 — Interações no estilo dos jogos clássicos
   - cursor ▶ que pula para o item sob o mouse ou o foco
   - bipes de menu (com botão de som no topo)
   - transição de tela em persianas ao trocar de página
   - Q / E trocam de página, como L / R
   - avisos digitados letra por letra
   - Memória de Moves e Ability no formato da tela de resumo
   Nada aqui altera como a ficha guarda os dados.
   ============================================================ */
(function(){
  "use strict";

  const reduceMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const isDexMode=()=>document.documentElement.dataset.sheetMode==="pokedex";
  const store={
    get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},
    set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  };

  /* ============================================================
     SOM — bipes de onda quadrada, como no Game Boy
     ============================================================ */
  const SOUND_KEY="hh_classic_sound";
  let soundOn=store.get(SOUND_KEY,"on")!=="off";
  let audio=null;
  function tone(freq,ms,{type="square",gain=.03,at=0}={}){
    if(!soundOn)return;
    try{
      audio=audio||new (window.AudioContext||window.webkitAudioContext)();
      if(audio.state==="suspended")audio.resume();
      const t=audio.currentTime+at/1000;
      const osc=audio.createOscillator(),vol=audio.createGain();
      osc.type=type;osc.frequency.setValueAtTime(freq,t);
      vol.gain.setValueAtTime(gain,t);
      vol.gain.exponentialRampToValueAtTime(.0001,t+ms/1000);
      osc.connect(vol).connect(audio.destination);
      osc.start(t);osc.stop(t+ms/1000+.02);
    }catch(e){}
  }
  const sfx={
    select(){tone(1320,45)},
    page(){tone(880,50);tone(1320,60,{at:55})},
    cancel(){tone(660,50);tone(440,70,{at:55})},
    type(){tone(1900,10,{gain:.012})},
    error(){tone(200,120,{type:"sawtooth",gain:.025})}
  };
  window.hhClassicSfx=sfx;

  function addSoundButton(){
    const actions=document.querySelector(".topbar .top-actions");
    if(!actions||document.getElementById("clSoundBtn"))return;
    const btn=document.createElement("button");
    btn.type="button";
    btn.id="clSoundBtn";
    btn.className="cl-sound-btn";
    const sync=()=>{
      btn.setAttribute("aria-pressed",String(soundOn));
      btn.textContent=soundOn?"♪":"♪̸";
      btn.title=soundOn?"Som dos menus ligado — clique para silenciar":"Som dos menus desligado — clique para ligar";
      btn.setAttribute("aria-label",btn.title);
    };
    btn.addEventListener("click",()=>{
      soundOn=!soundOn;
      store.set(SOUND_KEY,soundOn?"on":"off");
      sync();
      if(soundOn)sfx.page();
    });
    sync();
    const anchor=actions.querySelector(".top-action-divider");
    if(anchor)anchor.insertAdjacentElement("beforebegin",btn);
    else actions.prepend(btn);
  }

  /* ============================================================
     MODO CLARO / ESCURO / AUTOMÁTICO
     "Automático" segue o tema: temas escuros abrem as janelas escuras.
     ============================================================ */
  const SCHEMES=["light","dark","auto"];
  const SCHEME_LABEL={light:"☀",dark:"☾",auto:"◐"};
  const SCHEME_TITLE={light:"Janelas claras",dark:"Janelas escuras",auto:"Automático (segue o tema)"};
  function schemePref(){
    const v=(typeof state!=="undefined"&&state.classicScheme)||store.get("hh_classic_scheme","light");
    return SCHEMES.includes(v)?v:"light";
  }
  function themeIsDark(){
    const bg=getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    const m=bg.match(/^#?([0-9a-f]{6})$/i);
    if(!m)return true;
    const n=parseInt(m[1],16);
    const l=(.2126*((n>>16)&255)+.7152*((n>>8)&255)+.0722*(n&255))/255;
    return l<.5;
  }
  function applyScheme(){
    const pref=schemePref();
    const dark=pref==="dark"||(pref==="auto"&&themeIsDark());
    document.documentElement.dataset.clScheme=dark?"dark":"light";
    const btn=document.getElementById("clSchemeBtn");
    if(btn){
      btn.textContent=SCHEME_LABEL[pref];
      btn.title=`${SCHEME_TITLE[pref]} — clique para trocar`;
      btn.setAttribute("aria-label",btn.title);
    }
    if(typeof drawRadar==="function")requestAnimationFrame(()=>drawRadar());
  }
  function addSchemeButton(){
    const sound=document.getElementById("clSoundBtn");
    if(!sound||document.getElementById("clSchemeBtn"))return;
    const btn=document.createElement("button");
    btn.type="button";btn.id="clSchemeBtn";btn.className="cl-sound-btn";
    btn.addEventListener("click",()=>{
      const next=SCHEMES[(SCHEMES.indexOf(schemePref())+1)%SCHEMES.length];
      if(typeof state!=="undefined"){state.classicScheme=next;if(typeof debouncedSave==="function")debouncedSave();}
      store.set("hh_classic_scheme",next);
      applyScheme();
      sfx.select();
      if(typeof window.showToast==="function")window.showToast(`Aparência: ${SCHEME_TITLE[next]}.`);
    });
    sound.insertAdjacentElement("beforebegin",btn);
  }
  if(typeof window.applyTheme==="function"){
    const originalTheme=window.applyTheme;
    window.applyTheme=function(){const r=originalTheme.apply(this,arguments);applyScheme();return r;};
  }
  applyScheme();

  /* Clique em qualquer item de menu faz o bipe. */
  const SELECTABLE=[
    ".tab",".btn",".pokemon-card",".move-card",".cl-move-filters button",".theme-option",".font-option",
    ".appearance-tab",".trainer-party-slot",".general-identity-drawer>summary",".top-personalize-btn",
    "[data-mobile-page]",".registry-option-card",".general-stack-toggle",".combat-collapse-btn",
    ".mobile-nav-btn",".drawer-add-btn",".drawer-size-btn"
  ].join(",");
  document.addEventListener("click",event=>{
    const el=event.target.closest(SELECTABLE);
    if(!el||el.closest("#dexDevice"))return;
    if(el.matches(".tab[data-page]")||el.matches("[data-mobile-page]"))return; // a troca de página tem som próprio
    if(el.matches("[data-close],.hh-save-close")||/^[✕×]$/.test(el.textContent.trim()))sfx.cancel();
    else sfx.select();
  },true);

  /* ============================================================
     CURSOR ▶
     ============================================================ */
  const cursor=document.createElement("div");
  cursor.className="cl-cursor";
  cursor.setAttribute("aria-hidden","true");
  cursor.innerHTML="<i>▶</i>";
  document.body.appendChild(cursor);
  let cursorTarget=null;

  function placeCursor(el){
    if(!el||isDexMode()&&el.closest(".sheet")){cursor.classList.remove("on");cursorTarget=null;return;}
    const r=el.getBoundingClientRect();
    if(!r.width||r.bottom<0||r.top>innerHeight){cursor.classList.remove("on");return;}
    cursorTarget=el;
    const x=r.left>22?r.left-18:r.left+4;
    cursor.style.transform=`translate(${Math.round(x)}px,${Math.round(r.top+r.height/2-8)}px)`;
    cursor.classList.add("on");
  }
  document.addEventListener("pointerover",event=>{
    if(event.pointerType&&event.pointerType!=="mouse")return;
    const el=event.target.closest(SELECTABLE);
    if(el&&!el.closest("#dexDevice")&&!el.disabled)placeCursor(el);
    else if(!event.target.closest(".cl-cursor")){cursor.classList.remove("on");cursorTarget=null;}
  });
  document.addEventListener("focusin",event=>{
    const el=event.target.closest?.(SELECTABLE);
    if(el&&el.matches(":focus-visible"))placeCursor(el);
  });
  let scrollQueued=false;
  addEventListener("scroll",()=>{
    if(!cursorTarget||scrollQueued)return;
    scrollQueued=true;
    requestAnimationFrame(()=>{scrollQueued=false;if(cursorTarget)placeCursor(cursorTarget);});
  },{passive:true});
  document.addEventListener("pointerleave",()=>cursor.classList.remove("on"));

  /* ============================================================
     MENU DE PÁGINAS — nomes, transição e Q / E
     ============================================================ */
  const PAGE_LABEL={page1:"Pokémon",pageTrainer:"Treinador",page2:"Batalha",page3:"Arquivo",page4:"Pokédex"};
  function labelTabs(){
    document.querySelectorAll(".sheet-navigation .tab.pokedex-hardware-key").forEach(tab=>{
      const label=PAGE_LABEL[tab.dataset.page]||String(tab.title||"").split("•").pop().trim();
      tab.dataset.clLabel=label;
    });
    const tabs=document.querySelector(".sheet-navigation .page-tabs");
    if(tabs&&!document.querySelector(".cl-lr-hint")){
      const hint=document.createElement("span");
      hint.className="cl-lr-hint";
      hint.innerHTML="<kbd>Q</kbd>◀ ▶<kbd>E</kbd>";
      hint.title="Use Q e E para trocar de página";
      tabs.insertAdjacentElement("afterend",hint);
    }
  }

  function wipe(){
    if(reduceMotion())return;
    const el=document.createElement("div");
    el.className="cl-wipe";
    el.setAttribute("aria-hidden","true");
    el.innerHTML=Array.from({length:10},(_,i)=>`<i style="animation-delay:${i*14}ms"></i>`).join("");
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),600);
  }
  document.addEventListener("hh:pagechange",()=>{
    cursor.classList.remove("on");
    if(isDexMode())return;
    sfx.page();
    wipe();
  });

  function pageOrder(){
    return [...document.querySelectorAll(".sheet-navigation .tab[data-page]")]
      .filter(t=>t.offsetParent!==null)
      .map(t=>t.dataset.page);
  }
  document.addEventListener("keydown",event=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.target.closest("input,textarea,select,[contenteditable],dialog"))return;
    if(document.querySelector(".modal-backdrop.open,.modal-backdrop.show"))return;
    const key=event.key.toLowerCase();
    if(key!=="q"&&key!=="e")return;
    const order=pageOrder();
    if(order.length<2||typeof setActiveSheetPage!=="function")return;
    const current=document.querySelector(".page.active")?.id;
    const i=Math.max(0,order.indexOf(current));
    event.preventDefault();
    setActiveSheetPage(order[(i+(key==="e"?1:-1)+order.length)%order.length]);
  });

  /* ============================================================
     AVISOS DIGITADOS
     ============================================================ */
  if(typeof window.showToast==="function"){
    const toastEl=document.getElementById("toast");
    let typing=0;
    window.showToast=function(text){
      if(!toastEl)return;
      clearInterval(typing);
      clearTimeout(window.showToast.t);
      const full=String(text??"");
      toastEl.classList.add("show");
      const hold=Math.max(1800,full.length*45+1400);
      if(reduceMotion()){toastEl.textContent=full;}
      else{
        let i=0;
        toastEl.textContent="";
        typing=setInterval(()=>{
          i+=1;
          toastEl.textContent=full.slice(0,i);
          if(i%3===0)sfx.type();
          if(i>=full.length)clearInterval(typing);
        },22);
      }
      window.showToast.t=setTimeout(()=>toastEl.classList.remove("show"),hold);
    };
  }

  /* ============================================================
     ABILITY — rótulo e caixa de diálogo
     ============================================================ */
  (function decorateAbility(){
    const name=document.getElementById("abilityName");
    const text=document.getElementById("abilityText");
    if(!name||!text||text.parentElement.classList.contains("cl-dialog"))return;
    const label=document.createElement("span");
    label.className="cl-ability-label";
    label.textContent="HABILIDADE";
    name.insertAdjacentElement("beforebegin",label);
    const dialog=document.createElement("div");
    dialog.className="cl-dialog";
    text.insertAdjacentElement("beforebegin",dialog);
    dialog.appendChild(text);
  })();

  /* ============================================================
     MEMÓRIA DE MOVES — tela de resumo
     ============================================================ */
  const list=document.getElementById("memoryMoves");
  if(list&&typeof current!=="undefined"){
    const FILTERS=[
      {id:"all",label:"Todos"},
      {id:"active",label:"Equipados"},
      {id:"available",label:"Disponíveis"},
      {id:"locked",label:"Futuros"}
    ];
    const FILTER_KEY="hh_classic_move_filter";
    let selectedId=null;
    const readFilter=()=>{const v=store.get(FILTER_KEY,"all");return FILTERS.some(f=>f.id===v)?v:"all"};
    const isLocked=m=>typeof isMoveLevelLocked==="function"?isMoveLevelLocked(m):false;
    const moveById=id=>(current?.moves||[]).find(m=>String(m.id)===String(id));
    const stateOf=m=>isLocked(m)?"locked":m.active?"active":"available";

    const bar=document.createElement("div");
    bar.className="cl-move-filters";
    bar.setAttribute("role","group");
    bar.setAttribute("aria-label","Filtrar golpes");
    list.insertAdjacentElement("beforebegin",bar);
    function renderFilters(){
      const moves=current?.moves||[];
      const counts={
        all:moves.length,
        active:moves.filter(m=>stateOf(m)==="active").length,
        available:moves.filter(m=>stateOf(m)!=="locked").length,
        locked:moves.filter(m=>stateOf(m)==="locked").length
      };
      const active=readFilter();
      bar.innerHTML=FILTERS.map(f=>`<button type="button" data-cl-filter="${f.id}" aria-pressed="${f.id===active}">${f.label}<b>${counts[f.id]}</b></button>`).join("");
      list.dataset.clFilter=active;
    }
    bar.addEventListener("click",event=>{
      const btn=event.target.closest("[data-cl-filter]");
      if(!btn)return;
      store.set(FILTER_KEY,btn.dataset.clFilter);
      renderFilters();
    });

    const CATEGORY={physical:"Físico",special:"Especial",status:"Status"};
    const categoryOf=m=>{
      const c=String(m?.category||"").toLowerCase();
      if(c.startsWith("phys")||c.startsWith("fís")||c.startsWith("fis"))return "physical";
      if(c.startsWith("spec")||c.startsWith("esp"))return "special";
      return "status";
    };

    function decorate(card){
      const move=moveById(card.dataset.moveId);
      if(!move)return;
      card.dataset.clState=stateOf(move);
      card.tabIndex=0;
      const on=String(move.id)===String(selectedId);
      card.classList.toggle("cl-selected",on);
      card.setAttribute("aria-selected",String(on));
      const info=card.querySelector(".move-card-top>div:first-child");
      const meta=card.querySelector(".move-meta");
      const name=card.querySelector(".move-name");
      if(!info||!meta||!name||info.querySelector(".cl-move-type"))return;

      const typeBadge=meta.querySelector(".type-icon-badge");
      if(typeBadge){
        const clone=typeBadge.cloneNode(true);
        clone.classList.add("cl-move-type");
        info.insertBefore(clone,name);
      }
      const cat=categoryOf(move);
      const catIcon=document.createElement("span");
      catIcon.className=`cl-move-cat ${cat}`;
      catIcon.textContent=CATEGORY[cat].toUpperCase();
      name.prepend(catIcon);

      let accText="—";
      meta.querySelectorAll(":scope > .tag").forEach(tag=>{
        const t=tag.textContent.trim();
        if(/^(Physical|Special|Status)$/i.test(t)||/^Power\b/i.test(t)){tag.classList.add("cl-hide");return;}
        if(/^Acc\.?/i.test(t)){accText=t.replace(/^Acc\.?\s*/i,"");tag.classList.add("cl-hide");}
      });
      const power=Number(move.power||0);
      const stats=document.createElement("span");
      stats.className="cl-move-stats";
      stats.innerHTML=`<span class="cl-move-stat"><small>PODER</small><b>${power>0?power:"—"}</b></span><span class="cl-move-stat"><small>PRECISÃO</small><b>${accText}</b></span>`;
      name.insertAdjacentElement("afterend",stats);
    }
    function decorateAll(){
      list.querySelectorAll(":scope > .move-card").forEach(decorate);
      renderFilters();
    }
    function select(card,{toggle=true}={}){
      const id=card?.dataset.moveId;
      if(!id)return;
      selectedId=toggle&&String(selectedId)===String(id)?null:id;
      list.querySelectorAll(":scope > .move-card").forEach(c=>{
        const on=String(c.dataset.moveId)===String(selectedId);
        c.classList.toggle("cl-selected",on);
        c.setAttribute("aria-selected",String(on));
      });
    }
    list.addEventListener("click",event=>{
      if(event.target.closest("button,input,select,textarea,a"))return;
      const card=event.target.closest(".move-card");
      if(card)select(card);
    });
    list.addEventListener("keydown",event=>{
      const card=event.target.closest(".move-card");
      if(!card||event.target!==card)return;
      if(event.key==="Enter"||event.key===" "){event.preventDefault();sfx.select();select(card);return;}
      if(event.key==="ArrowDown"||event.key==="ArrowUp"){
        event.preventDefault();
        const visible=[...list.querySelectorAll(":scope > .move-card")].filter(c=>c.offsetParent!==null);
        const next=visible[visible.indexOf(card)+(event.key==="ArrowDown"?1:-1)];
        if(next){next.focus();sfx.select();select(next,{toggle:false});}
      }
    });
    new MutationObserver(decorateAll).observe(list,{childList:true});
    decorateAll();
  }

  addSoundButton();
  addSchemeButton();
  applyScheme();
  labelTabs();
})();
