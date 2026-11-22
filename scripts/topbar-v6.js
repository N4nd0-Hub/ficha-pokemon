/* ============================================================
   V6 — Botões da barra superior
   Coloca um ícone em pixel art, numa "pastilha" colorida, em cada
   botão (Exportar, Importar, Pokémon extras). O visual fica no
   styles/topbar-v6.css.
   ============================================================ */
(function(){
  "use strict";
  const ICONS={
    "export": "<svg viewBox=\"0 0 12 12\" shape-rendering=\"crispEdges\" aria-hidden=\"true\"><rect x=\"4\" y=\"0\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"4\" y=\"1\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"4\" y=\"2\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"4\" y=\"3\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"1\" y=\"4\" width=\"10\" height=\"1\" fill=\"#ffffff\"/><rect x=\"2\" y=\"5\" width=\"8\" height=\"1\" fill=\"#ffffff\"/><rect x=\"3\" y=\"6\" width=\"6\" height=\"1\" fill=\"#ffffff\"/><rect x=\"4\" y=\"7\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"0\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"5\" y=\"8\" width=\"2\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"0\" y=\"9\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"9\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"0\" y=\"10\" width=\"12\" height=\"1\" fill=\"#ffffff\"/></svg>",
    "import": "<svg viewBox=\"0 0 12 12\" shape-rendering=\"crispEdges\" aria-hidden=\"true\"><rect x=\"4\" y=\"0\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"3\" y=\"1\" width=\"6\" height=\"1\" fill=\"#ffffff\"/><rect x=\"2\" y=\"2\" width=\"8\" height=\"1\" fill=\"#ffffff\"/><rect x=\"1\" y=\"3\" width=\"10\" height=\"1\" fill=\"#ffffff\"/><rect x=\"4\" y=\"4\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"4\" y=\"5\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"4\" y=\"6\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"4\" y=\"7\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"0\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"0\" y=\"9\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"9\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"0\" y=\"10\" width=\"12\" height=\"1\" fill=\"#ffffff\"/></svg>",
    "extras": "<svg viewBox=\"0 0 12 12\" shape-rendering=\"crispEdges\" aria-hidden=\"true\"><rect x=\"3\" y=\"0\" width=\"6\" height=\"1\" fill=\"#181a24\"/><rect x=\"2\" y=\"1\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"3\" y=\"1\" width=\"6\" height=\"1\" fill=\"#ffffff\"/><rect x=\"9\" y=\"1\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"1\" y=\"2\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"2\" y=\"2\" width=\"8\" height=\"1\" fill=\"#ffffff\"/><rect x=\"10\" y=\"2\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"0\" y=\"3\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"1\" y=\"3\" width=\"10\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"3\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"0\" y=\"4\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"1\" y=\"4\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"5\" y=\"4\" width=\"2\" height=\"1\" fill=\"#181a24\"/><rect x=\"7\" y=\"4\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"4\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"0\" y=\"5\" width=\"5\" height=\"1\" fill=\"#181a24\"/><rect x=\"5\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"6\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"7\" y=\"5\" width=\"5\" height=\"1\" fill=\"#181a24\"/><rect x=\"0\" y=\"6\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"1\" y=\"6\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"5\" y=\"6\" width=\"2\" height=\"1\" fill=\"#181a24\"/><rect x=\"7\" y=\"6\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"6\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"0\" y=\"7\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"1\" y=\"7\" width=\"2\" height=\"1\" fill=\"#d4d8e2\"/><rect x=\"3\" y=\"7\" width=\"6\" height=\"1\" fill=\"#ffffff\"/><rect x=\"9\" y=\"7\" width=\"2\" height=\"1\" fill=\"#d4d8e2\"/><rect x=\"11\" y=\"7\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"1\" y=\"8\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"2\" y=\"8\" width=\"2\" height=\"1\" fill=\"#d4d8e2\"/><rect x=\"4\" y=\"8\" width=\"4\" height=\"1\" fill=\"#ffffff\"/><rect x=\"8\" y=\"8\" width=\"2\" height=\"1\" fill=\"#d4d8e2\"/><rect x=\"10\" y=\"8\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"2\" y=\"9\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"3\" y=\"9\" width=\"6\" height=\"1\" fill=\"#d4d8e2\"/><rect x=\"9\" y=\"9\" width=\"1\" height=\"1\" fill=\"#181a24\"/><rect x=\"3\" y=\"10\" width=\"6\" height=\"1\" fill=\"#181a24\"/></svg>"
  };
  const MAP=[["exportBtn","export"],["importBtn","import"],["hhGmDexTopBtn","extras"]];
  function decorate(){
    MAP.forEach(([id,icon])=>{
      const b=document.getElementById(id);
      if(!b||b.querySelector(".tb-ico"))return;
      b.classList.add("tb-btn",`tb-${icon}`);
      // Tira o símbolo de texto antigo (◓) do botão de extras.
      if(icon==="extras"){
        const text=b.textContent.replace(/^[\s◓○●⚪]+/,"").trim();
        b.textContent=text;
      }
      b.insertAdjacentHTML("afterbegin",`<span class="tb-ico">${ICONS[icon]}</span>`);
      const label=document.createElement("span");
      label.className="tb-label";
      [...b.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).forEach(n=>{label.append(n.textContent.trim());n.remove();});
      if(label.textContent){b.appendChild(label);if(!b.getAttribute("aria-label"))b.setAttribute("aria-label",label.textContent);}
    });
    document.getElementById("themeBtn")?.classList.add("tb-btn","tb-theme");
    document.getElementById("clSchemeBtn")?.classList.add("tb-btn","tb-square","tb-scheme");
    document.getElementById("clSoundBtn")?.classList.add("tb-btn","tb-square","tb-sound");
  }
  decorate();
  const actions=document.querySelector(".topbar .top-actions");
  if(actions)new MutationObserver(decorate).observe(actions,{childList:true,subtree:true});
})();
