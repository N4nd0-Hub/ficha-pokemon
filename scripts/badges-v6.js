/* ============================================================
   V6 — Insígnias em pixel art (estilo divino)
   Cada tipo ganha um medalhão próprio desenhado pixel a pixel:
   aro de ouro com sombreado por ângulo e pontilhado, gema na cor
   do tipo, símbolo do elemento, auréola e asas quando a insígnia
   foi conquistada. As não conquistadas viram pedra apagada.
   As imagens são SVG gerados no navegador (sem arquivos).
   Usado no estojo do Trainer Card e no editor de insígnias.
   ============================================================ */
(function(){
  "use strict";
  if(window.hhBadgeArt)return;

  const N=48;               // grade de pixels (largura) do medalhão
  const H=44;               // altura
  const CX=24,CY=24;        // centro do medalhão
  const TYPE={
    Normal:["#f4f1e0","#c9c6a5","#8f8c6b","#5a5840"],Fire:["#ffd08a","#ff8a2a","#d04a12","#7a2208"],
    Water:["#bfe4ff","#5aa2ff","#2a5ed8","#14307a"],Electric:["#fff6a0","#ffd92a","#d6a400","#7a5a00"],
    Grass:["#d4ffa8","#6ed04a","#2f8f2a","#165218"],Ice:["#f0ffff","#9ee8ee","#4ab4c4","#1f6676"],
    Fighting:["#ffb0a0","#e2483a","#a01e1a","#5a0c0a"],Poison:["#f2b8f0","#b850c0","#7a2486","#401048"],
    Ground:["#fff0b8","#e2bf65","#a8803a","#5e4418"],Flying:["#eee6ff","#b8a2ff","#7a62d6","#3e2e86"],
    Psychic:["#ffc4dc","#ff5f9a","#c42a64","#6a0e34"],Bug:["#eaff9a","#a8c21a","#6a820c","#384606"],
    Rock:["#efe2a8","#c4ad4a","#8a7426","#4a3e12"],Ghost:["#d8c8f4","#8a6cc0","#56408a","#2a1e4a"],
    Dragon:["#c8b4ff","#7a48ff","#4a1ed0","#22086e"],Dark:["#d8c4b4","#8a6a56","#4e382c","#241812"],
    Steel:["#ffffff","#cfd2e4","#8e92ac","#4a4e66"],Fairy:["#ffe0f0","#f090c4","#c4569a","#6e2454"]
  };
  const GOLD=["#fff8d0","#ffd85a","#e0a420","#a86a10","#5e3606"];
  const STONE=["#cfcfd4","#a2a2aa","#76767e","#4c4c54","#2a2a30"];
  const BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];

  /* Símbolos 12x12 de cada elemento */
  const G={
    Normal:[".....##.....",".#...##...#.","..#......#..","....####....","...######...","##.######.##","##.######.##","...######...","....####....","..#......#..",".#...##...#.",".....##....."],
    Fire:[".....#......",".....##.....","....###.....","....####..#.","...#####.##.","..#########.","..##########",".####..#####",".###....####",".###....###.","..###..###..","...######..."],
    Water:[".....##.....",".....##.....","....####....","....####....","...######...","..########..",".##########.",".#.########.",".#.########.",".##.#######.","..########..","...######..."],
    Electric:[".......###..","......###...",".....###....","....###.....","...#######..","......###...",".....###....","....###.....","...###......","..##........",".##.........",".#.........."],
    Grass:["..........##",".......#####",".....######.","....######..","...#####.#..","..#####.##..","..####.###..",".####.####..",".###.####...",".##.####....",".#.###......","#..........."],
    Ice:[".....##.....","..#..##..#..","...#.##.#...","....####....",".#..####..#.","############","############",".#..####..#.","....####....","...#.##.#...","..#..##..#..",".....##....."],
    Fighting:["..##.##.##..",".###########",".###########",".###########",".#.#.#.#.###",".###########",".##########.",".##########.","..#########.","...#######..","...#######..","...#######.."],
    Poison:["........###.",".......#...#",".......#...#","..####..###.",".#....#.....","#......#....","#..##..#.##.","#..##..##..#","#......##..#",".#....#..##.","..####......","............"],
    Ground:["............",".....##.....","....####....","...######...","..###..###..",".###....###.","############","............","############","............","############","............"],
    Flying:["##..........","###.........","####........",".####.......","..#####.....","#..######...","##..########",".###..######","..####...###","...#####....",".....####...",".......##..."],
    Psychic:["............","....####....","..##....##..",".#..####..#.","#..#.##.#..#","#.#.####.#.#","#..#.##.#..#",".#..####..#.","..##....##..","....####....","............","............"],
    Bug:["..#......#..","...#....#...","....####....","...######...","#.###..###.#",".####..####.","#.###..###.#",".####..####.","#.###..###.#","..###..###..","...##..##...","............"],
    Rock:["....####....","..###..###..",".##......##.","##.##.....##","#...##.....#","#....#..##.#","#.....##...#","##....#...##",".##...#..##.","..###.#.##..","....######..","............"],
    Ghost:["....####....","..########..",".##########.",".###.##.###.",".##..##..##.",".##########.",".##########.",".###....###.",".##########.",".##########.",".#.##.##.#..","#...#..#...."],
    Dragon:["#.....#.....","##....##....",".##....##...",".###...###..","..###...###.","..####..####","...####..###","...#####..##","....#####..#",".....#####..","......#####.","........###."],
    Dark:["....#####...","..####......",".####.......",".###........","####........","###.........","###.........","####........",".####.......",".######...#.","..########..","....####...."],
    Steel:[".....##.....","..#.####.#..",".##########.","..###..###..",".###....###.","####....####","####....####",".###....###.","..###..###..",".##########.","..#.####.#..",".....##....."],
    Fairy:[".....##.....",".....##.....","....####....","....####....","..########..","############","############","..########..","....####....","....####....",".....##.....",".....##....."]
  };

  function tone(arr,light,x,y){
    // light 0..1 → índice da paleta com pontilhado Bayer para transições suaves
    const steps=arr.length-1;
    const v=Math.max(0,Math.min(steps,(1-light)*steps));
    const base=Math.floor(v),frac=v-base;
    const t=(BAYER[y&3][x&3]+.5)/16;
    return arr[Math.min(steps,base+(frac>t?1:0))];
  }

  function draw(type,earned){
    const px=new Map();
    const put=(x,y,c)=>{if(x>=0&&y>=0&&x<N&&y<H&&c)px.set(x+","+y,c);};
    const pal=TYPE[type]||TYPE.Normal;
    const metal=earned?GOLD:STONE;
    const gem=earned?pal:STONE.slice(1);
    const R_OUT=14.6,R_RIM=12.4,R_GEM=10.6;
    // auréola (atrás do medalhão)
    if(earned){
      for(let x=0;x<N;x++)for(let y=0;y<10;y++){
        const dx=(x+.5-CX)/8.5,dy=(y+.5-5)/2.6;const d=dx*dx+dy*dy;
        if(d>=.5&&d<=1.25)put(x,y,d<.75?GOLD[0]:d<1?GOLD[1]:GOLD[2]);
      }
      // asas de penas brancas com contorno (uma de cada lado)
      const wing=[
        "........oooo",
        "......oowwwo",
        "....oowwwwso",
        "...owwwwwsso",
        "..owwwwwssoo",
        ".owwwwssooo.",
        "owwwssowso..",
        "owwssowsso..",
        ".osssosso...",
        "..ooo.oo...."
      ];
      const WC={o:"#3a3f66",w:"#ffffff",s:"#c4cae6"};
      wing.forEach((row,j)=>[...row].forEach((ch,i)=>{
        if(!WC[ch])return;
        put(i,14+j,WC[ch]);put(N-1-i,14+j,WC[ch]);
      }));
    }
    // medalhão: aro com relevo, filete escuro e gema
    for(let y=0;y<H;y++)for(let x=0;x<N;x++){
      const dx=x+.5-CX,dy=y+.5-CY,d=Math.hypot(dx,dy);
      if(d>R_OUT)continue;
      const ang=(-dx-dy)/(Math.SQRT2*Math.max(d,.001));      // luz vindo de cima-esquerda
      if(d>R_RIM){
        const bevel=(d-R_RIM)/(R_OUT-R_RIM);
        put(x,y,tone(metal,.5+ang*.42-bevel*.12,x,y));
      }else if(d>R_GEM){
        put(x,y,metal[metal.length-1]);
      }else{
        const spec=Math.hypot(dx+4,dy+4);
        let light=.6+ang*.2-Math.pow(d/R_GEM,2)*.32;
        if(spec<3.4)light+=.3;
        const steps=gem.length-1;
        put(x,y,gem[Math.max(0,Math.min(steps,Math.round((1-light)*steps)))]);
      }
    }
    // contorno escuro em volta do medalhão
    for(let y=0;y<H;y++)for(let x=0;x<N;x++){
      const d=Math.hypot(x+.5-CX,y+.5-CY);
      if(d>R_OUT&&d<=R_OUT+1.1&&!px.has(x+","+y))put(x,y,earned?"#4a2a06":"#1e1e24");
    }
    // entalhes do aro (8 rebites)
    for(let k=0;k<8;k++){
      const a=k*Math.PI/4+Math.PI/8,x=Math.round(CX-.5+Math.cos(a)*13.4),y=Math.round(CY-.5+Math.sin(a)*13.4);
      put(x,y,earned?GOLD[0]:STONE[0]);put(x+1,y+1,metal[3]);
    }
    // símbolo do elemento com contorno
    const glyph=G[type]||G.Normal;const gx=CX-6,gy=CY-6;
    const on=(i,j)=>glyph[j]?.[i]==="#";
    for(let j=-1;j<=12;j++)for(let i=-1;i<=12;i++){
      if(on(i,j)){put(gx+i,gy+j,earned?(j<5?"#ffffff":pal[0]):STONE[1]);continue;}
      if(on(i-1,j)||on(i+1,j)||on(i,j-1)||on(i,j+1))put(gx+i,gy+j,earned?pal[3]:STONE[4]);
    }
    // brilhos
    if(earned){
      put(CX-7,CY-8,"#ffffff");put(CX-6,CY-8,"#ffffff");put(CX-7,CY-7,"#ffffff");
      [[6,5],[41,6],[5,38],[42,37]].forEach(([x,y])=>{put(x,y,"#fff6c0");put(x-1,y,"#ffe27a");put(x+1,y,"#ffe27a");put(x,y-1,"#ffe27a");put(x,y+1,"#ffe27a");});
    }else{
      // rachadura na pedra
      [[CX+3,CY-11],[CX+4,CY-10],[CX+4,CY-9],[CX+5,CY-8],[CX+4,CY-7],[CX+5,CY-6]].forEach(([x,y])=>put(x,y,STONE[4]));
    }
    // monta o SVG juntando pixels vizinhos da mesma cor em linhas
    let out="";
    for(let y=0;y<H;y++){
      let x=0;
      while(x<N){
        const c=px.get(x+","+y);
        if(!c){x++;continue;}
        let w=1;while(x+w<N&&px.get((x+w)+","+y)===c)w++;
        out+=`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
        x+=w;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${H}" shape-rendering="crispEdges">${out}</svg>`;
  }

  const cache=new Map();
  function url(type,earned){
    const key=(TYPE[type]?type:"Normal")+(earned?"+":"-");
    if(!cache.has(key))cache.set(key,"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(draw(TYPE[type]?type:"Normal",earned)));
    return cache.get(key);
  }
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  function img(b,cls="hb-badge"){
    const t=b?.type||"Normal";
    return `<img class="${cls}${b?.earned?" earned":""}" src="${url(t,!!b?.earned)}" alt="${esc(b?.name||"Insígnia")}" draggable="false">`;
  }

  /* ---------- Estojo do Trainer Card ---------- */
  function decorateCase(){
    const box=document.querySelector(".tc-badgecase>div");if(!box||typeof ensureTrainerData!=="function")return;
    const badges=(ensureTrainerData().badges||[]).slice(0,8);
    const spans=[...box.querySelectorAll(".tc-badge")];
    if(!spans.length||spans[0].querySelector("img"))return;
    spans.forEach((s,i)=>{
      const b=badges[i];if(!b)return;
      s.classList.add("hb-slot");
      s.innerHTML=`<i class="hb-glow" aria-hidden="true"></i>${img(b)}<small>${esc(b.name||"")}</small>`;
    });
    // completa o estojo com encaixes vazios até 8
    for(let i=spans.length;i<8;i++)box.insertAdjacentHTML("beforeend",`<span class="tc-badge hb-slot hb-empty" aria-hidden="true"></span>`);
    const caseEl=box.parentElement;
    const earned=badges.filter(b=>b.earned).length;
    const label=caseEl.querySelector("small");
    if(label&&!caseEl.querySelector(".hb-count"))label.insertAdjacentHTML("afterend",`<b class="hb-count">${earned}/${Math.max(8,badges.length)}</b>`);
  }

  /* ---------- Editor de insígnias (Editar cartão) ---------- */
  function decorateEditor(){
    const grid=document.getElementById("trainerBadgeGrid");if(!grid||typeof ensureTrainerData!=="function")return;
    const badges=ensureTrainerData().badges||[];
    grid.querySelectorAll(".trainer-badge-card").forEach((card,i)=>{
      const b=badges[i];const core=card.querySelector(".trainer-badge-core");
      if(!b||!core)return;
      const key=(b.type||"Normal")+(b.earned?"+":"-");
      if(core.dataset.hb===key)return;
      core.dataset.hb=key;core.classList.add("hb-core");
      core.innerHTML=img(b,"hb-badge hb-mini");
      card.querySelector(".trainer-badge-emblem")?.setAttribute("title",b.earned?"Conquistada — clique para desmarcar":"Não conquistada — clique para marcar");
    });
  }

  function run(){try{decorateCase();decorateEditor();}catch(e){}}
  const page=document.getElementById("pageTrainer");
  if(page)new MutationObserver(run).observe(page,{childList:true,subtree:true});
  run();
  window.hhBadgeArt={url,img,draw,TYPES:Object.keys(TYPE)};
})();
