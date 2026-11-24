/* ============================================================
   V6 — Barra inferior do celular em pixel art
   Troca os símbolos de texto (◓ ★ ⚔ ▤ ◉ TXT ●) por ícones 16x16
   no mesmo estilo dos botões de página, cada um com sua cor.
   ============================================================ */
(function(){
  "use strict";
  const nav=document.getElementById("mobileBottomNav");
  if(!nav)return;
  const PAL={o:"#181a24",w:"#ffffff",g:"#d4d8e2",s:"#8a90a0",r:"#e0393e",R:"#a0242a",p:"#ff9a9a",b:"#3d7be0",B:"#24468f",c:"#9fd0ff",y:"#f2c230",Y:"#b88a10",e:"#fff1a8",G:"#2a9a63",h:"#6fdc9c",n:"#b07a40",N:"#6a4420",t:"#e8b878",k:"#5a6070"};
  const PX={
    ball:["................",".....oooooo.....","...oorrrrrroo...","..orrpprrrrrRo..",".orrprrrrrrrrRo.",".orrrrrrrrrrrRo.","orrrrrooorrrrrRo","oooooowwwoooooo.","oggggoowooggggo.","owwwwwooowwwwwgo",".owwwwwwwwwwwgo.",".owwwwwwwwwwwgo.","..owwwwwwwwwgo..","...oogggggggoo..",".....oooooo.....","................"],
    cap:["................","................","......oooo......","....oorrrroo....","...orrpprrrRo...","..orrppwwwrrRo..","..orprwrrwrrRo..",".orrrrwwwwrrrRo.",".orrrrrrrrrrrRo.",".oRRRRRRRRRRRRo.",".ooooowwwwwwwooo","....owwwwwwwwwwo","....oggggggggggo",".....ooooooooooo","................","................"],
    swords:[".oo..........oo.","owgo........ogwo",".owgo......ogwo.","..owgo....ogwo..","...owgo..ogwo...","....owgoogwo....",".....owggwo.....","......ogwo......","..o..ogwwgo..o..",".oyoogwoowgooyo.","..oygwo..owgyo..","...oyyyooyyyo...","..oNooo..oooNo..",".oNo........oNo.","oYo..........oYo",".o............o."],
    bag:["................","......oooo......",".....o....o.....","....oooooooo....","...onnnnnnnnoo..","..onttnnnnnnNo..","..ontnnnnnnnNo..","..oooooyyooooo..","..onnnoyeyonnNo.","..onnnnoyonnnNo.","..onnnnnnnnnnNo.","..onoooooooooNo.","..onowwwwwwwoNo.","..oNoooooooooNo.","...oooooooooooo.","................"],
    dex:["................","..oooooooooooo..",".orrrrrrrrrrrRo.",".orwwwrrRoyoRRo.",".orwccwrrooorRo.",".orwcbwrrrrrrRo.",".orrwwrrrrrrrRo.",".oRRRRRRRRRRRRo.",".ooooooooooooooo",".okggggggggggko.",".okgcccccccgko..",".okgcbbbbbcgko..",".okgcccccccgko..",".okggggggggggko.","..oooooooooooo..","................"],
    pc:["................",".oooooooooooooo.",".oggggggggggggo.",".ogbbbbbbbbbbgo.",".ogbccbbbbwbbgo.",".ogbcbbbbwwwbgo.",".ogbbbbbbbwbbgo.",".ogbbbbbbbbbbgo.",".ogggggggggggg o",".oooooooooooooo.","......okko......","....oooooooo....","...okggggggko...","...oooooooooo...","................","................"],
    party:["................","................","....oooo........","...orrpRo.......","...oooooo.......","...owwwgo..oooo.","....oooo..orrpRo",".oooo.....oooooo",".orrpRo...owwwgo",".oooooo....oooo.",".owwwgo.........","..oooo...oooo...",".........orrpRo.",".........oooooo.",".........owwwgo.","..........oooo.."]
  };
  const ICON={page1:"ball",pageTrainer:"cap",page2:"swords",page3:"bag",page4:"dex",page5:"pc"};
  const COLOR={page1:"#e0393e",pageTrainer:"#e39a12",page2:"#ea5f1f",page3:"#2a9a63",page4:"#2f74d4",page5:"#7a5ad0",drawer:"#5a6070"};
  const LABEL={page1:"Pokémon",pageTrainer:"Treino",page2:"Batalha",page3:"Arquivo",page4:"Dex",page5:"Troca",drawer:"Time"};
  function svg(name){
    const rows=PX[name];let r="";
    rows.forEach((row,y)=>{row=row.replace(/ /g,".");let x=0;while(x<16){const ch=row[x];if(!ch||ch==="."){x++;continue;}let w=1;while(x+w<16&&row[x+w]===ch)w++;r+=`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${PAL[ch]||"#000"}"/>`;x+=w;}});
    return `<svg class="mn-px" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${r}</svg>`;
  }
  nav.classList.add("mn-v6");
  nav.querySelectorAll(".mobile-nav-btn").forEach(btn=>{
    const key=btn.dataset.mobilePage||(btn.id==="mobileDrawerNav"?"drawer":"");
    const icon=key==="drawer"?"party":ICON[key];
    if(!icon)return;
    btn.style.setProperty("--mn",COLOR[key]);
    const ico=btn.querySelector(".mobile-nav-icon");
    if(ico){ico.innerHTML=svg(icon);ico.classList.add("mn-ico");}
    const b=btn.querySelector("b");
    if(b&&LABEL[key]){b.textContent=LABEL[key];btn.setAttribute("aria-label",LABEL[key]);}
  });
})();
