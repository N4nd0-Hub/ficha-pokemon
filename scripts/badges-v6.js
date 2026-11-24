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
    return toSvg(px);
  }
  function toSvg(px){
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

  /* ---------- Estilo grego: moeda de ouro em mármore com coroa de louros ---------- */
  const MARBLE=["#ffffff","#f1ede4","#dcd5c6","#b9b09c"];
  const BRONZE=["#c9b48a","#a08a5e","#7a6640","#54462a","#2e2618"];
  function noise(x,y){const v=Math.sin(x*12.9898+y*78.233)*43758.5453;return v-Math.floor(v);}
  function drawGreek(type,earned){
    const px=new Map();
    const put=(x,y,c)=>{if(x>=0&&y>=0&&x<N&&y<H&&c)px.set(x+","+y,c);};
    const pal=TYPE[type]||TYPE.Normal;
    const metal=earned?GOLD:BRONZE;
    const R_OUT=14.2,R_BEAD=12.6,R_MAR=11.4,R_ENA=8.6;
    // coroa de louros dourada envolvendo a moeda (só conquistada)
    if(earned){
      // folhas desenhadas à mão (diagonais), espelhadas para o lado direito
      const UL=["LL..","LMM.",".MMD","..DD"],UR=["..LL",".MML","DMM.","DD.."];
      const LC={L:"#fff0a0",M:"#e8b830",D:"#9a6a10"};
      const left=new Map();
      const stamp=(spr,ax,ay,x0,y0)=>spr.forEach((row,j)=>[...row].forEach((ch,i)=>{if(LC[ch])left.set((x0+i-ax)+","+(y0+j-ay),LC[ch]);}));
      const R=17.4;
      const pt=th=>[Math.round(CX-.5-Math.sin(th)*R*1.05),Math.round(CY-.5+Math.cos(th)*R)];
      for(let d=14;d<=148;d+=2){const [x,y]=pt(d*Math.PI/180);left.set(x+","+y,"#7a4c08");}
      for(let k=0;k<9;k++){
        const [bx,by]=pt((24+k*15)*Math.PI/180);
        stamp(UL,3,3,bx,by);
        if(k>0&&k<8)stamp(UR,0,3,bx+1,by+1);
      }
      for(const [key,c] of left){const [x,y]=key.split(",").map(Number);put(x,y,c);put(N-1-x,y,c);}
      // fita na base, presa nos galhos
      for(let x=CX-4;x<=CX+3;x++){put(x,CY+17,"#b81e2a");put(x,CY+18,"#7a0e18");}
      put(CX-6,CY+17,"#b81e2a");put(CX-7,CY+18,"#7a0e18");put(CX+5,CY+17,"#b81e2a");put(CX+6,CY+18,"#7a0e18");
    }
    for(let y=0;y<H;y++)for(let x=0;x<N;x++){
      const dx=x+.5-CX,dy=y+.5-CY,d=Math.hypot(dx,dy);
      if(d>R_OUT+1.1)continue;
      const ang=(-dx-dy)/(Math.SQRT2*Math.max(d,.001));
      if(d>R_OUT){put(x,y,earned?"#4a2a06":"#1e1a12");continue;}
      if(d>R_BEAD){put(x,y,tone(metal,.55+ang*.4,x,y));continue;}
      if(d>R_MAR){
        // contas (pérolas) do aro, como nas moedas antigas
        const a=Math.atan2(dy,dx),k=((a/(Math.PI*2))*28+28)%1;
        put(x,y,k<.55?(ang>0?metal[0]:metal[1]):metal[3]);continue;
      }
      if(d>R_ENA){
        // anel de mármore com veios
        const vein=Math.abs(Math.sin(dx*.7+dy*.35+noise(x,y)*1.4))<.12;
        const base=earned?MARBLE:STONE;
        put(x,y,vein?base[3]:tone(base.slice(0,3),.6+ang*.3,x,y));continue;
      }
      // esmalte na cor do tipo, com degradê radial
      const light=.58+ang*.22-Math.pow(d/R_ENA,2)*.3;
      const g=earned?pal:STONE.slice(1);const st=g.length-1;
      put(x,y,g[Math.max(0,Math.min(st,Math.round((1-light)*st)))]);
    }
    // símbolo em relevo dourado
    const glyph=G[type]||G.Normal;const gx=CX-6,gy=CY-6;
    const on=(i,j)=>glyph[j]?.[i]==="#";
    for(let j=-1;j<=12;j++)for(let i=-1;i<=12;i++){
      if(on(i,j)){
        const lit=!on(i-1,j)||!on(i,j-1);
        put(gx+i,gy+j,earned?(lit?GOLD[0]:GOLD[1]):(lit?STONE[0]:STONE[1]));continue;
      }
      if(on(i-1,j)||on(i,j-1))put(gx+i,gy+j,earned?GOLD[4]:STONE[4]);
      else if(on(i+1,j)||on(i,j+1))put(gx+i,gy+j,earned?GOLD[3]:STONE[3]);
    }
    if(earned){
      put(CX-8,CY-7,"#ffffff");put(CX-7,CY-8,"#ffffff");
      // pequenas estrelas de luz (brilho divino)
      [[5,6],[42,8],[24,2]].forEach(([x,y])=>{put(x,y,"#fffbe0");put(x-1,y,"#ffe27a");put(x+1,y,"#ffe27a");put(x,y-1,"#ffe27a");put(x,y+1,"#ffe27a");});
    }else{
      [[CX+4,CY-12],[CX+5,CY-11],[CX+5,CY-10],[CX+6,CY-9],[CX+5,CY-8]].forEach(([x,y])=>put(x,y,"#1e1a12"));
    }
    return toSvg(px);
  }

  const cache=new Map();
  const STYLES={greek:"Grego",celestial:"Celestial"};
  let style=(()=>{try{return localStorage.getItem("hh_badge_style")||"greek";}catch(e){return "greek";}})();
  if(!STYLES[style])style="greek";
  document.documentElement.dataset.hbStyle=style;
  function url(type,earned,st=style){
    const t=TYPE[type]?type:"Normal";
    const key=st+t+(earned?"+":"-");
    if(!cache.has(key))cache.set(key,"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(st==="greek"?drawGreek(t,earned):draw(t,earned)));
    return cache.get(key);
  }
  function setStyle(st){
    if(!STYLES[st]||st===style)return;
    style=st;try{localStorage.setItem("hh_badge_style",st);}catch(e){}
    document.querySelectorAll(".tc-badgecase>div .hb-slot").forEach(el=>el.querySelector("img")?.remove());
    document.querySelectorAll(".trainer-badge-core.hb-core").forEach(el=>{delete el.dataset.hb;});
    document.querySelectorAll(".tc-badgecase").forEach(el=>el.dataset.hbStyle=st);document.documentElement.dataset.hbStyle=st;
    redecorate();
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
    const spans=[...box.querySelectorAll(".tc-badge:not(.hb-empty)")];
    if(!spans.length||spans[0].querySelector("img"))return;
    box.parentElement.dataset.hbStyle=style;
    spans.forEach((s,i)=>{
      const b=badges[i];if(!b)return;
      s.classList.add("hb-slot");
      s.innerHTML=`<i class="hb-glow" aria-hidden="true"></i>${img(b)}<small>${esc(b.name||"")}</small>`;
    });
    // completa o estojo com encaixes vazios até 8
    if(!box.querySelector(".hb-empty"))for(let i=spans.length;i<8;i++)box.insertAdjacentHTML("beforeend",`<span class="tc-badge hb-slot hb-empty" aria-hidden="true"></span>`);
    const caseEl=box.parentElement;
    const earned=badges.filter(b=>b.earned).length;
    const label=caseEl.querySelector("small");
    if(label&&!caseEl.querySelector(".hb-count"))label.insertAdjacentHTML("afterend",`<span class="hb-tools"><span class="hb-style" role="group" aria-label="Estilo das insígnias">${Object.entries(STYLES).map(([k,v])=>`<button type="button" data-hb-style="${k}" aria-pressed="${k===style}">${v}</button>`).join("")}</span><b class="hb-count">${earned}/${Math.max(8,badges.length)}</b></span>`);
    caseEl.querySelectorAll("[data-hb-style]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.hbStyle===style)));
  }

  /* ---------- Editor de insígnias (Editar cartão) ---------- */
  function decorateEditor(){
    const grid=document.getElementById("trainerBadgeGrid");if(!grid||typeof ensureTrainerData!=="function")return;
    const badges=ensureTrainerData().badges||[];
    grid.querySelectorAll(".trainer-badge-card").forEach((card,i)=>{
      const b=badges[i];const core=card.querySelector(".trainer-badge-core");
      if(!b||!core)return;
      const key=style+(b.type||"Normal")+(b.earned?"+":"-");
      if(core.dataset.hb===key)return;
      core.dataset.hb=key;core.classList.add("hb-core");
      core.innerHTML=img(b,"hb-badge hb-mini");
      card.querySelector(".trainer-badge-emblem")?.setAttribute("title",b.earned?"Conquistada — clique para desmarcar":"Não conquistada — clique para marcar");
    });
  }

  function run(){try{decorateCase();decorateEditor();}catch(e){}}
  function redecorate(){
    // recria as imagens do estojo no estilo novo
    const box=document.querySelector(".tc-badgecase>div");
    if(box&&typeof ensureTrainerData==="function"){
      const badges=(ensureTrainerData().badges||[]).slice(0,8);
      box.querySelectorAll(".hb-slot:not(.hb-empty)").forEach((s,i)=>{const b=badges[i];if(b)s.innerHTML=`<i class="hb-glow" aria-hidden="true"></i>${img(b)}<small>${esc(b.name||"")}</small>`;});
    }
    run();
  }
  // os botões ficam dentro do cartão: impede que o clique vire o cartão
  document.addEventListener("click",e=>{const b=e.target.closest("button[data-hb-style]");if(!b)return;e.preventDefault();e.stopPropagation();setStyle(b.dataset.hbStyle);window.hhClassicSfx?.select?.();},true);
  const page=document.getElementById("pageTrainer");
  if(page)new MutationObserver(run).observe(page,{childList:true,subtree:true});
  run();
  window.hhBadgeArt={url,img,draw,drawGreek,setStyle,STYLES,TYPES:Object.keys(TYPE),get style(){return style;}};
})();
