/* ============================================================
   V7 — Temas de jogos e protagonistas
   • Estampa de fundo em pixel art própria de cada tema
     (chamas, folhas, ondas, joias, sol, lua, espadas…).
   • Papel das janelas um pouco mais tingido nos temas de jogo
     e de protagonista (data-theme-group no <html>).
   • Seletor de temas com grupos, gerações, filtros e busca.
   Os dados dos temas ficam em THEMES/THEME_META (app-core.js).
   ============================================================ */
(function(){
  "use strict";
  if(typeof THEMES==="undefined"||typeof state==="undefined")return;
  const root=document.documentElement;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();

  /* ---------- Estampas 16×16 (# = pixel) ---------- */
  const MOTIF={
    flame:["................",".......#........","......##........","......###.......",".....####..#....",".....#####.##...","....######.##...","...##########...","...###.######...","..###...#####...","..###....#####..","..####...#####..","...###########..","....#########...",".....#######....","................"],
    leaf:["................","...........###..","........######..","......########..",".....######.##..","....######.###..","....#####.####..","...#####.#####..","...####.#####...","...###.#####....","...##.#####.....","...#.####.......","..#.............",".#..............","#...............","................"],
    wave:["................","................","....###.........","..##...##.......",".#.......#......","#...###...#....#","...#...#...#..#.","..#.....#...##..","................","....###.........","..##...##.......",".#.......#......","#...###...#....#","...#...#...#..#.","..#.....#...##..","................"],
    gem:["................","....########....","...#..#..#..#...","..#..#....#..#..",".##############.",".#...#....#...#.","..#...#..#...#..","...#..#..#..#...","....#..##..#....",".....#.##.#.....","......####......",".......##.......","................","................","................","................"],
    pearl:["................",".....######.....","....#......#....","...#..##....#...","..#..#.......#..","..#..#.......#..","..#..........#..","..#..........#..","..#..........#..","...#........#...","....#......#....",".....######.....","................","................","................","................"],
    star:["................",".......##.......",".......##.......","......####......","......####......","##############..",".############...","..##########....","...########.....","...########.....","..####..####....","..###....###....",".##........##...","................","................","................"],
    feather:["................","............##..","..........####..","........######..",".......####.##..","......####.##...",".....####.###...","....####.###....","...####.###.....","...###.###......","...##.###.......","..#.##..........",".#..............","#...............","................","................"],
    moon:["................",".....####.......","...######.......","..#####.........","..####..........",".####...........",".####...........",".####...........",".####...........",".#####..........","..#####.........","..########..#...","...##########...",".....######.....","................","................"],
    sun:["................",".......##.......","..#....##....#..","...#........#...","......####......",".....######.....","....########....","##..########..##","##..########..##","....########....",".....######.....","......####......","...#........#...","..#....##....#..",".......##.......","................"],
    sword:["................","...............#","..............##",".............##.","............##..","...........##...","..........##....",".........##.....","....#...##......",".....#.##.......","......##........",".....####.......","....##..#.......","...##...........","..##............","................"],
    shield:["................","..############..","..#..........#..","..#..######..#..","..#..#....#..#..","..#..#....#..#..","..#..######..#..","..#..........#..","...#........#...","...#........#...","....#......#....",".....#....#.....","......####......","................","................","................"],
    snowflake:["................",".......#........","....#..#..#.....",".....#.#.#......","......###.......","..#....#....#...","...#..###..#....","#######.#######.","...#..###..#....","..#....#....#...","......###.......",".....#.#.#......","....#..#..#.....",".......#........","................","................"],
    yinyang:["................",".....######.....","...##....####...","..#.......####..","..#..##...####..",".#...##..#####..",".#......######..",".#....#######...",".#...##########.","..#.######..##..","..#.######..##..","...##########...",".....######.....","................","................","................"],
    xy:["................","................","#....#..#....#..",".#..#...#....#..","..##.....#..#...","..##......##....",".#..#.....#.....","#....#....#.....","................","................","................","................","................","................","................","................"],
    heart:["................","................","..###....###....",".#####..#####...","##############..","##############..","##############..",".############...","..##########....","...########.....","....######......",".....####.......","......##........","................","................","................"],
    cap:["................","................","......####......","....########....","...##########...","..####....####..","..###......###..",".#############..",".##############.","###############.","................","................","................","................","................","................"],
    hex:["................","....######......","...#......#.....","..#........#....","..#........#....","...#......#.....","....######......","..........######",".........#......","........#.......","........#.......",".........#......","..........######","................","................","................"],
    orange:["................",".....######.....","...##########...","..#.#..##..#.#..",".#...#.##.#...#.",".#....####....#.","################",".#....####....#.",".#...#.##.#...#.","..#.#..##..#.#..","...##########...",".....######.....","................","................","................","................"],
    grape:["................",".......#........","......#.........",".....####.......","....##..##......","....##..##......","...##..##..##...","...##..##..##...","....##..##......","....##..##......",".....####.......",".....####.......","......##........","................","................","................"],
    sparkle:["................",".......#........",".......#........","......###.......","..###########...","......###.......",".......#.....#..",".......#....###.","............#...","...#............","..###...........","...#............","................","................","................","................"],
    zigzag:["................","........######..",".......######...","......######....",".....######.....","....#######.....","...##########...","......######....",".....######.....","....######......","...######.......","..######........",".######.........","................","................","................"],
    film:["................","################","#.##.##.##.##.##","################","#..............#","#..............#","#..............#","#..............#","################","#.##.##.##.##.##","################","................","................","................","................","................"],
    flower:["................","......###.......",".....#####......","..###.###.###...",".#####.#.#####..",".######.######..","..####.#.####...","......###.......","..####.#.####...",".######.######..",".#####.#.#####..","..###.###.###...",".....#####......","......###.......","................","................"],
    bow:["................","................","##.........##...","####.....####...","######.######...","#######.#####...","######...####...","#######.#####...","######.######...","####.##.#####...","##..##...##.....","...##.....##....","..##.......##...","................","................","................"],
    compass:["................",".....######.....","...##......##...","..#....#.....#..",".#....###.....#.",".#...#####....#.","#.....###.....#.","#......#......#.","#......#......#.","#.....###.....#.",".#...#####....#.",".#....###.....#.","..#....#.....#..","...##......##...",".....######.....","................"]
  };
  const cache={};
  function motifUrl(name){
    if(!MOTIF[name])return "";
    if(cache[name])return cache[name];
    let d="";
    MOTIF[name].forEach((row,y)=>{row=row.padEnd(16,".").slice(0,16);let x=0;while(x<16){if(row[x]!=="#"){x++;continue;}let w=1;while(x+w<16&&row[x+w]==="#")w++;d+=`M${x} ${y}h${w}v1h-${w}z`;x+=w;}});
    const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 16 16' shape-rendering='crispEdges'><path fill='#ffffff' fill-opacity='.09' d='${d}'/></svg>`;
    return cache[name]=`url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  window.hhThemeMotif=motifUrl;

  /* ---------- Peles por geração ---------- */
  const SKIN_BY_GEN={1:"kanto",2:"johto",3:"hoenn",4:"sinnoh",5:"unova",6:"kalos",7:"alola",8:"galar",9:"paldea"};
  function skinOf(key,theme){
    if(theme.special||!["game","hero"].includes(theme.group))return "";
    if(theme.skin)return theme.skin;
    if(theme.gen===10)return key==="za"?"lumiose":"hisui";
    return SKIN_BY_GEN[theme.gen]||"";
  }
  window.hhThemeSkin=skinOf;

  /* ---------- Aplicação ---------- */
  function decorate(){
    const key=state.theme,theme=THEMES[key]||{};
    root.dataset.themeGroup=theme.group||"classic";
    // Pele da geração: molduras, faixas, retrato e cenário inspirados na interface dos jogos.
    const skin=skinOf(key,theme);
    if(skin)root.dataset.themeSkin=skin;else delete root.dataset.themeSkin;
    // os temas especiais têm fundo próprio em special-themes-v6.css
    if(theme.motif&&theme.motif!=="ball"&&!theme.special)root.style.setProperty("--cl-ball",motifUrl(theme.motif));
    else root.style.removeProperty("--cl-ball");
  }
  if(typeof window.applyTheme==="function"){
    const original=window.applyTheme;
    window.applyTheme=function(){const r=original.apply(this,arguments);decorate();return r;};
  }
  decorate();

  /* ---------- Seletor ---------- */
  const GROUPS=[["all","Todos"],["game","Jogos"],["hero","Protagonistas"],["classic","Clássicos"],["special","Especiais"]];
  const GEN_LABEL=g=>g===10?"Legends":g?`Geração ${["","I","II","III","IV","V","VI","VII","VIII","IX"][g]}`:"";
  const REGION={1:"Kanto",2:"Johto",3:"Hoenn",4:"Sinnoh",5:"Unova",6:"Kalos",7:"Alola",8:"Galar",9:"Paldea",10:"Hisui · Lumiose"};
  let filter="all",query="";
  try{filter=localStorage.getItem("hh_theme_filter")||"all";}catch(e){}

  function card(key,theme,active){
    const v=theme.vars||{},meta=(typeof THEME_META!=="undefined"&&THEME_META[key])||{};
    const motif=theme.motif&&theme.motif!=="ball"?motifUrl(theme.motif).replace("fill-opacity%3D'.09'","fill-opacity%3D'.22'").replace("fill-opacity='.09'","fill-opacity='.22'"):"";
    const special=theme.special;
    return `<button type="button" class="theme-option ap-theme th7-card${special?` ap-special sp-${esc(key)}`:""}${active?" active":""}" data-theme="${esc(key)}" aria-pressed="${active}"
        style="--p-bg:${esc(v["--bg"])};--p-bg2:${esc(v["--bg2"])};--p-panel:${esc(v["--panel"])};--p-panel2:${esc(v["--panel2"])};--p-line:${esc(v["--line"])};--p-text:${esc(v["--text"])};--p-muted:${esc(v["--muted"])};--p-a:${esc(v["--accent"])};--p-b:${esc(v["--accent2"])}${motif?`;--p-motif:${esc(motif)}`:""}">
      ${special?`<span class="ap-preview ap-sp-preview" aria-hidden="true"><i class="sp-a"></i><i class="sp-b"></i><i class="sp-c"></i><i class="sp-d"></i></span>`:
      `<span class="ap-preview th7-preview" aria-hidden="true">
        <i class="ap-bar"><i></i><i></i><i></i></i>
        <i class="ap-body"><i class="ap-mon"><i></i></i><i class="ap-lines"><i></i><i></i><i class="short"></i><i class="chip"></i></i></i>
      </span>`}
      <span class="ap-name"><b>${esc(theme.label)}${special?" <em>ESPECIAL</em>":""}</b><small>${esc(meta.description||"")}</small></span>
      <span class="ap-check" aria-hidden="true">✓</span>
    </button>`;
  }
  function render(){
    const grid=document.getElementById("themeGrid");if(!grid)return;
    const all=Object.entries(THEMES).map(([k,t])=>[k,{...t,group:t.special?"special":(t.group||"classic")}]);
    const q=norm(query);
    const match=([k,t])=>(filter==="all"||t.group===filter)&&(!q||norm(t.label+" "+(THEME_META[k]?.description||"")+" "+(REGION[t.gen]||"")+" "+GEN_LABEL(t.gen)).includes(q));
    const list=all.filter(match);
    const counts=Object.fromEntries(GROUPS.map(([g])=>[g,g==="all"?all.length:all.filter(([,t])=>t.group===g).length]));
    let fxOff=false;try{fxOff=localStorage.getItem("hh_fx_off")==="1";}catch(e){}
    const cur=THEMES[state.theme];
    let html=`<div class="th7-tools">
      <div class="th7-current"><span>Tema atual</span><b>${esc(cur?.label||"Padrão")}</b></div>
      <label class="th7-search"><span aria-hidden="true">⌕</span><input type="search" id="th7Search" placeholder="Buscar tema, jogo, região…" value="${esc(query)}" autocomplete="off" aria-label="Buscar tema"></label>
      <div class="th7-filters" role="tablist" aria-label="Grupos de temas">${GROUPS.map(([g,l])=>`<button type="button" role="tab" class="th7-filter${filter===g?" on":""}" data-th7-filter="${g}" aria-selected="${filter===g}">${l}<small>${counts[g]}</small></button>`).join("")}</div>
    </div>`;
    if(!list.length)html+=`<p class="th7-empty">Nenhum tema encontrado para “${esc(query)}”.</p>`;
    const order=["game","hero","classic","special"];
    const titles={game:["🎮","Jogos","Uma paleta e estampa para cada versão"],hero:["🧢","Protagonistas","As cores da roupa de cada protagonista"],classic:["◓","Clássicos","Os temas de sempre da ficha"],special:["✨","Especiais","Com animações e enfeites exclusivos"]};
    for(const g of order){
      const items=list.filter(([,t])=>t.group===g);if(!items.length)continue;
      const [ico,title,sub]=titles[g];
      html+=`<div class="th7-section"><b>${ico} ${title}</b><small>${sub}</small>${g==="special"?`<label class="ap-fx-toggle"><input type="checkbox" id="apFxToggle"${fxOff?"":" checked"}> Efeitos animados</label>`:""}</div>`;
      if(g==="game"||g==="hero"){
        const gens=[...new Set(items.map(([,t])=>t.gen||0))].sort((a,b)=>a-b);
        for(const gen of gens){
          html+=`<div class="th7-gen"><span>${esc(GEN_LABEL(gen))}</span><small>${esc(REGION[gen]||"")}</small></div>`;
          html+=items.filter(([,t])=>(t.gen||0)===gen).map(([k,t])=>card(k,t,state.theme===k)).join("");
        }
      }else html+=items.map(([k,t])=>card(k,t,state.theme===k)).join("");
    }
    grid.innerHTML=html;
    grid.classList.add("th7-grid");
  }
  window.renderThemeOptions=render;
  document.addEventListener("click",e=>{
    const f=e.target.closest("[data-th7-filter]");if(!f)return;
    filter=f.dataset.th7Filter;try{localStorage.setItem("hh_theme_filter",filter);}catch(err){}
    render();
  });
  document.addEventListener("input",e=>{
    if(e.target.id!=="th7Search")return;
    query=e.target.value;const pos=e.target.selectionStart;
    render();
    const input=document.getElementById("th7Search");if(input){input.focus();try{input.setSelectionRange(pos,pos);}catch(err){}}
  });
  try{render();}catch(e){}
})();
