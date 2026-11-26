/* ============================================================
   V7 — Arena: ícones em pixel art
   Cada ícone é uma grade de letras; cada letra é uma cor da paleta.
   Vira um <svg> nítido (shape-rendering: crispEdges) em qualquer tamanho.
   ============================================================ */
(function(root){
  "use strict";
  const PAL={
    k:"#1b1d2a", // contorno
    w:"#f4f6fb", // brilho
    g:"#aab3c8", // pedra clara
    d:"#68718c", // pedra escura
    s:"#4a5168", // sombra
    r:"#e3262f", // vermelho
    R:"#9c1820", // vermelho escuro
    y:"#ffd23f", // amarelo
    Y:"#e09a12", // amarelo escuro
    b:"#4f8de8", // azul
    B:"#2b5bb0", // azul escuro
    p:"#a070e0", // roxo
    c:"#8fe3ff", // ciano
    G:"#4cbf6a", // verde
    o:"#f08030", // laranja
    n:"#8a5a34", // madeira
    m:"#b08a5a", // rocha clara
    M:"#7a5a36", // rocha escura
    K:"#140e0a", // fundo do abismo
    a:"#f0b040"  // âmbar
  };
  const ICONS={
    // Desafio Sem Fim: torre infinita com bandeira, janelas acesas e degraus
    tower:[
      ".........krrrr......",
      ".........krrRRrr....",
      ".........krrr.......",
      ".........k..........",
      "........kwdk........",
      ".......kwggdk.......",
      ".......kwyYdk.......",
      "......kkkkkkkk......",
      "......kwgggddk......",
      "......kwgyYgdk......",
      "......kwgyYgdk......",
      ".....kkkkkkkkkk.....",
      ".....kwggggdddk.....",
      ".....kwgyYgyYdk.....",
      ".....kwgggggddk.....",
      "....kkkkkkkkkkkk....",
      "....kwgyYgggyYdk....",
      "....kwgyYgggyYdk....",
      "....kwgggggddddk....",
      "...kkkkkkkkkkkkkk...",
      "...kwgggknnkgdddk...",
      "...kwwggknnkggddk...",
      "cwwwccwwkknnkkwwccwc",
      ".cccwwwccwwwccwwccc.",
      "...cc..cccc..ccc....",
    ],
    // Batalha entre amigos: espadas cruzadas
    swords:[
      "kk............kk",
      "kwk..........kwk",
      ".kwk........kwk.",
      "..kwk......kwk..",
      "...kwk....kwk...",
      "....kwk..kwk....",
      ".....kwkkwk.....",
      "......kwwk......",
      "......kwwk......",
      ".....kwkkwk.....",
      "..kk.kk..kk.kk..",
      "..kykk....kkyk..",
      "...kyk....kyk...",
      "..knk......knk..",
      ".knk........knk.",
      ".kk..........kk.",
    ],
    people:[
      "...kkk....kkk...",
      "..kwwyk..kccbk..",
      "..kwyyk..kcbbk..",
      "..kyyyk..kbbbk..",
      "...kkk....kkk...",
      "..krrrk..kbbbk..",
      ".krrrrrkkbbbbbk.",
      ".krrRrrkkbbBbbk.",
      ".krrRrrkkbbBbbk.",
      ".kkkkkkkkkkkkkk.",
    ],
    ball:[
      "....kkkkkk....",
      "..kkrrrrrrkk..",
      ".krrwwrrrrRRk.",
      ".krwwrrrrrRRk.",
      "krrrrrrrrrrRRk",
      "kkkkkkwwkkkkkk",
      "kkkkkwkkwkkkkk",
      "kwwwwkwwkwwwgk",
      ".kwwwwkkwwwgk.",
      ".kwwwwwwwwggk.",
      "..kkwwwwggkk..",
      "....kkkkkk....",
    ],
    trophy:[
      "..kkkkkkkkkk..",
      "kkkwyyyyyyYkkk",
      "ky.kwyyyyYk.yk",
      "ky.kwyyyyYk.yk",
      ".kykwyyyyYkyk.",
      "..kkwyyyyYkk..",
      "....kwyyYk....",
      ".....kyYk.....",
      "......kYk.....",
      "....kkkkkk....",
      "....knnnnk....",
      "...kkkkkkkk...",
    ],
    chat:[
      ".kkkkkkkkkkkk.",
      "kwwwwwwwwwwwgk",
      "kwkkwwkkwwkkgk",
      "kwkkwwkkwwkkgk",
      "kwwwwwwwwwwwgk",
      ".kkkkwwgkkkkk.",
      "....kwgk......",
      "....kgk.......",
      "....kk........",
    ],
    gear:[
      ".....kkkk.....",
      "..kk.kddk.kk..",
      ".kddkkggkkddk.",
      ".kdggggggggdk.",
      "..kgggkkgggk..",
      "kkkggk..kggkkk",
      "kdggk....kggdk",
      "kdggk....kggdk",
      "kkkggk..kggkkk",
      "..kgggkkgggk..",
      ".kdggggggggdk.",
      ".kddkkggkkddk.",
      "..kk.kddk.kk..",
      ".....kkkk.....",
    ],
    eye:[
      "....kkkkkk....",
      "..kkwwwwwwkk..",
      ".kwwwkbbkwwwk.",
      "kwwwkbBBbkwwwk",
      "kwwwkbBkbkwwwk",
      ".kwwwkbbkwwwk.",
      "..kkwwwwwwkk..",
      "....kkkkkk....",
    ],
    // Abismo Rochoso (Altamuralha): boca da caverna, estalactites, cristal e âmbar
    abyss:[
      "....kkkkkkkkkkkk....",
      "..kkmmmMmmmmMmmmkk..",
      ".kmmMmmmmmmmmmmMmmk.",
      "kmMmmkkkkkkkkkkmmMmk",
      "kmmkKKMKKKKKKMKKkmmk",
      "kmMkKKMKKKMKKMKKkMmk",
      "kmmkKKKKKKMKKKKKkmmk",
      "kMmkKKKKKKKKKKKKkmMk",
      "kmmkKKKKKccKKKKKkmmk",
      "kmMkKKKKcwccKKKKkMmk",
      "kmmkKKKKccwcBKKKkmmk",
      "kMmkKKKKKccBKKKKkmMk",
      "kmmkKKKaKKcKKaKKkmmk",
      "kmMkKKaYaKKKaYaKkMmk",
      "kmmkKKKaKKKKKaKKkmmk",
      "kMmmkkkkkkkkkkkkmmMk",
      "kmMMmmmMmmmmMmmmMMmk",
      ".kkkkkkkkkkkkkkkkkk.",
    ],
    crown:[
      "k....k....k...",
      "kyk.kyk..kyk..",
      "kyykkyykkyyk..",
      "kyyyyyyyyyyk..",
      "kyryyybyyyrk..",
      "kYYYYYYYYYYk..",
      "kkkkkkkkkkkk..",
    ]
  };
  function svg(name,size=32,{title=""}={}){
    const rows=ICONS[name];if(!rows)return "";
    const w=Math.max(...rows.map(r=>r.length)),h=rows.length;
    let rects="";
    rows.forEach((row,y)=>{
      let x=0;
      while(x<row.length){
        const ch=row[x];
        if(!PAL[ch]){x++;continue;}
        let run=1;while(row[x+run]===ch)run++;
        rects+=`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${PAL[ch]}"/>`;
        x+=run;
      }
    });
    const hpx=Math.round(size*h/w);
    return `<svg class="px-ico px-${name}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${hpx}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" ${title?`role="img" aria-label="${title}"`:'aria-hidden="true"'}>${rects}</svg>`;
  }
  const api={svg,ICONS,PAL};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.hhArenaPix=api;
})(typeof window!=="undefined"?window:globalThis);
