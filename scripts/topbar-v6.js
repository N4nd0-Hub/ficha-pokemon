/* ============================================================
   V6 — Ícones da barra superior e do botão de importação
   Mesmo método da ficha Contos de Runeterra: SVGs inline, de traço,
   num conjunto central (ICON) e uma função icon(nome).
   Ícones de interface: Lucide (licença ISC, https://lucide.dev).
   A Poké Ball é desenho próprio da ficha.
   ============================================================ */
(function(){
  "use strict";
  const L={
    download:'<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    upload:'<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    palette:'<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".9" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".9" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".9" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".9" fill="currentColor"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    "sun-moon":'<path d="M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>',
    "volume-2":'<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.36 18.36a9 9 0 0 0 0-12.73"/>',
    "volume-x":'<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
    "clipboard-paste":'<path d="M11 14h10"/><path d="M16 4h2a2 2 0 0 1 2 2v1.34"/><path d="m17 18 4-4-4-4"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.79-1.11"/><rect x="8" y="2" width="8" height="4" rx="1"/>'
  };
  /* Poké Ball (preenchida) com brilho: usada no botão de Pokémon extras */
  const BALL='<svg class="tb-svg ball" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="#fff"/><path d="M2 12a10 10 0 0 1 20 0Z" fill="#ff5a60"/><path d="M5.3 7.6a7.6 7.6 0 0 1 4-3.1" fill="none" stroke="#ffc1c4" stroke-width="1.6" stroke-linecap="round"/><path d="M2 12h20" stroke="#181a24" stroke-width="2.2"/><circle cx="12" cy="12" r="10" fill="none" stroke="#181a24" stroke-width="2"/><circle cx="12" cy="12" r="3.8" fill="#181a24"/><circle cx="12" cy="12" r="2.1" fill="#fff"/><path d="m19.5 1.8.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6Z" fill="#ffe46b" stroke="#181a24" stroke-width=".6"/></svg>';
  /* Poké Ball do botão Box & Bolsa: mesma da aba do navegador */
  const BIG_BALL='<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" fill="#f4f5f7"/><path d="M3 32a29 29 0 0 1 58 0Z" fill="#e3262f"/><path d="M12 18a24 24 0 0 1 14-9" fill="none" stroke="#ff8a8f" stroke-width="4" stroke-linecap="round"/><path d="M3 32h58" stroke="#15181f" stroke-width="6"/><circle cx="32" cy="32" r="29" fill="none" stroke="#15181f" stroke-width="5"/><circle cx="32" cy="32" r="11" fill="#15181f"/><circle cx="32" cy="32" r="6.5" fill="#f4f5f7"/></svg>';
  function icon(name){
    if(name==="ball")return BALL;
    return `<svg class="tb-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${L[name]||""}</svg>`;
  }

  /* Botões de texto: Exportar, Importar, Pokémon extras */
  const MAP=[["exportBtn","export","download"],["importBtn","import","upload"],["hhGmDexTopBtn","extras","ball"]];
  function decorate(){
    MAP.forEach(([id,cls,name])=>{
      const b=document.getElementById(id);
      if(!b)return;
      b.classList.add("tb-btn",`tb-${cls}`);
      const ico=b.querySelector(".tb-ico");
      if(ico&&ico.dataset.icon===name)return;
      if(ico)ico.remove();
      if(cls==="extras"){
        [...b.childNodes].forEach(n=>{if(n.nodeType===3)n.textContent=n.textContent.replace(/^[\s◓○●⚪]+/,"");});
      }
      let label=b.querySelector(".tb-label");
      if(!label){
        label=document.createElement("span");
        label.className="tb-label";
        [...b.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).forEach(n=>{label.append(n.textContent.trim());n.remove();});
        if(label.textContent){b.appendChild(label);if(!b.getAttribute("aria-label"))b.setAttribute("aria-label",label.textContent);}
      }
      b.insertAdjacentHTML("afterbegin",`<span class="tb-ico" data-icon="${name}">${icon(name)}</span>`);
    });
    const theme=document.getElementById("themeBtn");
    if(theme){
      theme.classList.add("tb-btn","tb-theme");
      const pi=theme.querySelector(".top-personalize-icon");
      if(pi&&pi.dataset.icon!=="palette"){pi.dataset.icon="palette";pi.innerHTML=icon("palette");}
    }
    squareIcon("clSchemeBtn","tb-scheme",t=>t.includes("☾")?"moon":t.includes("◐")?"sun-moon":"sun");
    squareIcon("clSoundBtn","tb-sound",(t,b)=>b.getAttribute("aria-pressed")==="false"?"volume-x":"volume-2");
    const shell=document.querySelector("#drawerToggle .pocket-ball-shell");
    if(shell&&!shell.querySelector("svg")){shell.classList.add("tb-ball-shell");shell.innerHTML=BIG_BALL;}
    const port=document.querySelector(".sheet-import-port .sheet-import-port-icon");
    if(port&&port.dataset.icon!=="clipboard-paste"){port.dataset.icon="clipboard-paste";port.innerHTML=icon("clipboard-paste");port.classList.add("tb-port-ico");}
  }
  /* Lua/sol e som: o script clássico troca o texto (☀ ☾ ◐ ♪); aqui vira ícone. */
  function squareIcon(id,cls,pick){
    const b=document.getElementById(id);
    if(!b)return;
    b.classList.add("tb-btn","tb-square",cls);
    const raw=b.querySelector(".tb-raw")?.textContent??b.textContent;
    const name=pick(raw,b);
    if(b.dataset.icon===name&&b.querySelector("svg"))return;
    b.dataset.icon=name;
    b.innerHTML=`${icon(name)}<span class="tb-raw" hidden>${raw.replace(/[<>&]/g,"")}</span>`;
  }

  let busy=false;
  const run=()=>{if(busy)return;busy=true;try{decorate();}finally{busy=false;}};
  run();
  const actions=document.querySelector(".topbar .top-actions");
  if(actions)new MutationObserver(run).observe(actions,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["aria-pressed"]});
  window.hhIcon=icon;
})();
