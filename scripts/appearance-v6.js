/* ============================================================
   V6 — Aparência: ícones em pixel art dos botões de página e do
   DATA IMPORT, botão Personalizar compacto e painel de
   personalização redesenhado (cartões com prévia do tema).
   ============================================================ */
(function(){
  "use strict";
  const PAL={"o": "#181a24", "w": "#ffffff", "g": "#d4d8e2", "s": "#8a90a0", "r": "#e0393e", "R": "#a0242a", "p": "#ff9a9a", "b": "#3d7be0", "B": "#24468f", "c": "#9fd0ff", "y": "#f2c230", "Y": "#b88a10", "e": "#fff1a8", "G": "#2a9a63", "h": "#6fdc9c", "H": "#1a6a43", "n": "#b07a40", "N": "#6a4420", "t": "#e8b878", "v": "#8a5ad0", "V": "#5a3496", "l": "#c9a6ff", "f": "#ff8a2a", "F": "#c04a10", "k": "#5a6070"};
  const PX={"cap":["................","................","......oooo......","....oorrrroo....","...orrpprrrRo...","..orrppwwwrrRo..","..orprwrrwrrRo..",".orrrrwwwwrrrRo.",".orrrrrrrrrrrRo.",".oRRRRRRRRRRRRo.",".ooooowwwwwwwooo","....owwwwwwwwwwo","....oggggggggggo",".....ooooooooooo","................","................"],"swords":[".oo..........oo.","owgo........ogwo",".owgo......ogwo.","..owgo....ogwo..","...owgo..ogwo...","....owgoogwo....",".....owggwo.....","......ogwo......","..o..ogwwgo..o..",".oyoogwoowgooyo.","..oygwo..owgyo..","...oyyyooyyyo...","..oNooo..oooNo..",".oNo........oNo.","oYo..........oYo",".o............o."],"bag":["................","......oooo......",".....o....o.....","....oooooooo....","...onnnnnnnnoo..","..onttnnnnnnNo..","..ontnnnnnnnNo..","..oooooyyooooo..","..onnnoyeyonnNo.","..onnnnoyonnnNo.","..onnnnnnnnnnNo.","..onoooooooooNo.","..onowwwwwwwoNo.","..oNoooooooooNo.","...oooooooooooo.","................"],"floppy":["................",".oooooooooooooo.",".obbbbwwwwwwbbo.",".obbbbwwwkwwbbo.",".obbbbwwwkwwbbo.",".obbbbwwwwwwbbo.",".obbbbbbbbbbbbo.",".obbbbbbbbbbbbo.",".obbggggggggbbo.",".obbgwwwwwwgbbo.",".obbgggggggggbo.",".obbgwwwwwwgbbo.",".obbggggggggbbo.",".oBBBBBBBBBBBBo.",".oooooooooooooo.","................"],"palette":["................",".....oooooo.....","...oowwwwwwoo...","..owwwrrwwwwwo..",".owwwwrrwwbbwwo.",".owyywwwwwbbwwo.","owwyywwwwwwwwwwo","owwwwwwwwwwoowwo","owGGwwwwwwo..owo","owGGwwwwwwo..owo",".owwwwwvvwwoowwo",".owwwwwvvwwwwwo.","..owwwwwwwwwwo..","...oowwwwwwoo...",".....oooooo.....","................"]};
  const cache=new Map();
  function px(name,cls="ap-px"){
    const key=name+"|"+cls;
    if(cache.has(key))return cache.get(key);
    const rows=PX[name];if(!rows)return "";
    let r="";
    rows.forEach((row,y)=>{let x=0;while(x<16){const ch=row[x];if(ch==="."){x++;continue;}let w=1;while(x+w<16&&row[x+w]===ch)w++;r+=`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${PAL[ch]}"/>`;x+=w;}});
    const svg=`<svg class="${cls}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${r}</svg>`;
    cache.set(key,svg);return svg;
  }
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));

  /* ---------- Ícones dos botões de página e do DATA IMPORT ---------- */
  const NAV={pageTrainer:"cap",page2:"swords",page3:"bag"};
  function navIcons(){
    Object.entries(NAV).forEach(([page,name])=>{
      document.querySelectorAll(`.sheet-navigation .tab[data-page="${page}"] .hardware-symbol`).forEach(el=>{
        if(el.dataset.px===name)return;
        el.dataset.px=name;el.classList.add("ap-has-px");el.innerHTML=px(name,"ap-px ap-px-nav");
      });
    });
    const port=document.querySelector(".sheet-import-port .sheet-import-port-icon");
    if(port&&port.dataset.px!=="floppy"){port.dataset.px="floppy";port.classList.add("ap-has-px");port.innerHTML=px("floppy","ap-px ap-px-port");}
  }

  /* ---------- Personalizar compacto ---------- */
  function compactButton(){
    const b=document.getElementById("themeBtn");if(!b)return;
    b.classList.add("ap-compact");
    if(!b.querySelector(".ap-btn-ico"))b.insertAdjacentHTML("afterbegin",`<span class="ap-btn-ico" aria-hidden="true">${px("palette","ap-px ap-px-btn")}</span>`);
    const label=document.getElementById("themeLabel")?.textContent?.trim();
    const title=`Personalizar${label?` · ${label}`:""}`;
    if(b.title!==title){b.title=title;b.setAttribute("aria-label",title);}
  }

  /* ---------- Cartões de tema com prévia ---------- */
  function themeCard(key,theme,active){
    const v=theme.vars||{};
    const meta=(typeof THEME_META!=="undefined"&&THEME_META[key])||{description:""};
    return `<button type="button" class="theme-option ap-theme${active?" active":""}" data-theme="${esc(key)}" aria-pressed="${active}"
        style="--p-bg:${esc(v["--bg"])};--p-bg2:${esc(v["--bg2"])};--p-panel:${esc(v["--panel"])};--p-panel2:${esc(v["--panel2"])};--p-line:${esc(v["--line"])};--p-text:${esc(v["--text"])};--p-muted:${esc(v["--muted"])};--p-a:${esc(v["--accent"])};--p-b:${esc(v["--accent2"])}">
      <span class="ap-preview" aria-hidden="true">
        <i class="ap-bar"><i></i><i></i><i></i></i>
        <i class="ap-body">
          <i class="ap-mon"><i></i></i>
          <i class="ap-lines"><i></i><i></i><i class="short"></i><i class="chip"></i></i>
        </i>
      </span>
      <span class="ap-name"><b>${esc(theme.label)}</b><small>${esc(meta.description||"")}</small></span>
      <span class="ap-check" aria-hidden="true">✓</span>
    </button>`;
  }
  function specialCard(key,theme,active){
    const meta=(typeof THEME_META!=="undefined"&&THEME_META[key])||{description:""};
    return `<button type="button" class="theme-option ap-theme ap-special sp-${esc(key)}${active?" active":""}" data-theme="${esc(key)}" aria-pressed="${active}">
      <span class="ap-preview ap-sp-preview" aria-hidden="true"><i class="sp-a"></i><i class="sp-b"></i><i class="sp-c"></i><i class="sp-d"></i></span>
      <span class="ap-name"><b>${esc(theme.label)} <em>ESPECIAL</em></b><small>${esc(meta.description||"")}</small></span>
      <span class="ap-check" aria-hidden="true">✓</span>
    </button>`;
  }
  document.addEventListener("change",e=>{
    if(e.target?.id!=="apFxToggle")return;
    try{localStorage.setItem("hh_fx_off",e.target.checked?"0":"1");}catch(err){}
    window.hhSpecialFx?.refresh();
  });
  function fontCard(key,font,active){
    return `<button type="button" class="font-theme-option ap-font${active?" active":""}" data-font-theme="${esc(key)}" aria-pressed="${active}">
      <span class="ap-font-sample" style="font-family:${esc(font.display||font.ui)}">Aa</span>
      <span class="ap-name"><b style="font-family:${esc(font.display||font.ui)}">${esc(font.label)}</b><small>${esc(font.description||"")}</small></span>
      <span class="ap-check" aria-hidden="true">✓</span>
    </button>`;
  }
  if(typeof window.renderThemeOptions==="function"){
    window.renderThemeOptions=function(){
      const grid=document.getElementById("themeGrid");if(!grid)return;
      const all=Object.entries(THEMES);
      const normal=all.filter(([,t])=>!t.special),special=all.filter(([,t])=>t.special);
      let fxOff=false;try{fxOff=localStorage.getItem("hh_fx_off")==="1";}catch(e){}
      grid.innerHTML=normal.map(([k,t])=>themeCard(k,t,state.theme===k)).join("")+
        (special.length?`<div class="ap-special-head"><b>✨ Temas especiais</b><small>Com animações e enfeites exclusivos</small>
          <label class="ap-fx-toggle"><input type="checkbox" id="apFxToggle"${fxOff?"":" checked"}> Efeitos animados</label></div>`+
          special.map(([k,t])=>specialCard(k,t,state.theme===k)).join(""):"");
    };
  }
  if(typeof window.renderFontThemeOptions==="function"){
    window.renderFontThemeOptions=function(){
      const grid=document.getElementById("fontThemeGrid");if(!grid)return;
      grid.innerHTML=Object.entries(FONT_THEMES).map(([k,f])=>fontCard(k,f,state.fontTheme===k)).join("");
    };
  }

  /* ---------- Cabeçalho e abas do painel ---------- */
  function decorateModal(){
    const modal=document.getElementById("themeModal");if(!modal||modal.dataset.ap)return;
    modal.dataset.ap="1";modal.classList.add("ap-sheet");
    const head=modal.querySelector(".modal-head");
    if(head){
      const title=head.querySelector("div");
      if(title)title.innerHTML=`<span class="ap-head-icon">${px("palette","ap-px")}</span><span><b>Personalização</b><small>Cores, fontes e o modo Pokédex</small></span>`;
      title?.classList.add("ap-head-title");
    }
    const tabs=modal.querySelectorAll(".appearance-modal-tab");
    const labels=[["Temas & fontes","palette"],["Pokédex","floppy"]];
    tabs.forEach((t,i)=>{
      if(!labels[i])return;
      t.innerHTML=`${i===0?px("palette","ap-px ap-px-tab"):'<span class="ap-lens"></span>'}<b>${labels[i][0]}</b>`;
    });
  }

  function run(){navIcons();compactButton();decorateModal();}
  run();
  ["renderAll","setActiveSheetPage","setSheetPokedexMode","applyTheme","applyFontTheme"].forEach(fn=>{
    const orig=window[fn];if(typeof orig!=="function")return;
    window[fn]=function(){const r=orig.apply(this,arguments);try{run();}catch(e){}return r;};
  });
  try{renderThemeOptions();renderFontThemeOptions();}catch(e){}
  window.hhPx=px;
})();
