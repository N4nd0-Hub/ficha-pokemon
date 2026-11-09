/* V6 — Controles do visor da Enciclopédia. O catálogo continua na ficha. */
(function(){
  "use strict";

  const page=document.getElementById("page4");
  const reader=document.getElementById("encyclopediaReader");
  const list=document.getElementById("encyclopediaList");
  const dex=window.hhDexDevice;
  if(!page||!reader||!list||!dex||typeof encyclopediaState==="undefined")return;

  const visor=page.querySelector(".dex-archive-visor");
  const title=document.getElementById("dexArchiveName");
  const sweep=visor.querySelector(".dex-archive-sweep");
  const tabs=page.querySelector(".encyclopedia-mode-switch");
  const control=action=>page.querySelector(`[data-archive="${action}"]`);
  const voice=control("voice");
  const sound=control("sound");
  const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
  let selected="";
  let scan;
  let narration;

  function stopNarration(){
    if(!narration)return;
    narration=null;
    voice.setAttribute("aria-pressed","false");
    voice.textContent="B · LER";
    window.speechSynthesis.cancel();
  }

  function syncSound(){
    const enabled=dex.soundEnabled();
    sound.setAttribute("aria-pressed",String(enabled));
    sound.textContent=enabled?"♪ SOM":"✕ MUDO";
  }

  function syncRecord(){
    if(!page.classList.contains("active"))return;
    const heading=reader.querySelector("h2")?.textContent.trim();
    const hasEntries=!!list.querySelector("[data-ency-key]");
    for(const action of ["prev","next","open"])control(action).disabled=!hasEntries;
    voice.disabled=!heading||!!reader.querySelector(".encyclopedia-loading")||!window.speechSynthesis||!window.SpeechSynthesisUtterance;
    const label=heading||"Selecione um registro";
    if(title.textContent!==label)title.textContent=label;
    list.querySelector(".encyclopedia-entry.active")?.setAttribute("aria-current","true");

    const {mode,selectedAbility,selectedMove,selectedRule}=encyclopediaState;
    const key=mode+":"+(heading?{abilities:selectedAbility,moves:selectedMove,rules:selectedRule}[mode]:"");
    if(key===selected)return;
    selected=key;
    stopNarration();
    reader.scrollTop=0;
    scan?.cancel();
    if(!heading||reduceMotion.matches)return;
    scan=sweep.animate([
      {transform:"translateY(-100%)",opacity:0},
      {opacity:1,offset:.15},
      {transform:"translateY(100%)",opacity:0}
    ],{duration:460,easing:"linear"});
    reader.firstElementChild?.animate([
      {opacity:.45,transform:"translateY(5px)"},
      {opacity:1,transform:"none"}
    ],{duration:240,easing:"ease-out"});
  }

  function step(direction,focus=false){
    const entries=[...list.querySelectorAll("[data-ency-key]")];
    if(!entries.length)return;
    const index=entries.findIndex(entry=>entry.classList.contains("active"));
    const next=(index<0&&direction<0)?entries.length-1:(index+direction+entries.length)%entries.length;
    const key=entries[next].dataset.encyKey;
    if(next!==index)entries[next].click();
    const target=list.querySelector(`[data-ency-key="${CSS.escape(key)}"]`);
    if(focus)target?.focus({preventScroll:true});
    target?.scrollIntoView({block:"nearest"});
  }

  function readRecord(){
    if(narration){stopNarration();return;}
    const paper=reader.querySelector(".encyclopedia-paper:last-child");
    if(!paper||voice.disabled)return;
    const content=paper.cloneNode(true);
    content.querySelectorAll("button,.encyclopedia-reader-actions,.encyclopedia-page-number").forEach(el=>el.remove());
    const text=[...content.children].map(el=>el.textContent.trim()).filter(Boolean).join(". ");
    if(!text)return;

    const utterance=new SpeechSynthesisUtterance(`${title.textContent}. ${text}`);
    utterance.lang="pt-BR";
    utterance.onend=utterance.onerror=()=>{
      if(narration!==utterance)return;
      narration=null;
      voice.setAttribute("aria-pressed","false");
      voice.textContent="B · LER";
    };
    narration=utterance;
    voice.setAttribute("aria-pressed","true");
    voice.textContent="■ PARAR";
    window.speechSynthesis.speak(utterance);
  }

  page.addEventListener("click",event=>{
    const action=event.target.closest("[data-archive]")?.dataset.archive;
    if(action==="sound"){
      dex.setSound(!dex.soundEnabled());
      syncSound();
    }else if(action==="prev"||action==="next"){
      step(action==="prev"?-1:1);
    }else if(action==="open"){
      if(!list.querySelector(".encyclopedia-entry.active"))step(1);
      reader.focus({preventScroll:true});
      visor.scrollIntoView({block:"start",behavior:reduceMotion.matches?"instant":"smooth"});
    }else if(action==="voice"){
      readRecord();
    }
    if(event.target.closest("[role='tab'],[data-ency-key],[data-rule-nav],[data-archive='open']"))dex.beep(980,45);
  });

  list.addEventListener("keydown",event=>{
    if(event.key!=="ArrowUp"&&event.key!=="ArrowDown")return;
    event.preventDefault();
    step(event.key==="ArrowUp"?-1:1,true);
  });
  tabs.addEventListener("keydown",event=>{
    if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
    const buttons=[...tabs.querySelectorAll("[role='tab']")];
    const index=buttons.indexOf(event.target);
    if(index<0)return;
    event.preventDefault();
    const next=buttons[(index+(event.key==="ArrowLeft"?-1:1)+buttons.length)%buttons.length];
    next.focus();
    next.click();
  });

  const observer=new MutationObserver(syncRecord);
  observer.observe(reader,{childList:true});
  observer.observe(list,{childList:true});
  document.addEventListener("hh:pagechange",event=>{
    if(event.detail.to==="page4"){
      syncSound();
      syncRecord();
    }else if(event.detail.from==="page4"){
      selected="";
      stopNarration();
      scan?.cancel();
    }
  });
  document.addEventListener("hh:render",()=>{
    if(page.classList.contains("active"))syncSound();
  });
  syncSound();
  syncRecord();
})();
