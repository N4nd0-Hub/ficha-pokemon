/* ============================================================
   V6 — Barra de Felicidade (Vínculo do Pokémon)
   Coração em pixel art que enche conforme a felicidade, barra em
   blocos com faixas de vínculo, marcador animado, frase do
   Pokémon e botões rápidos (−5, −1, +1, +5).
   ============================================================ */
(function(){
  "use strict";
  const box=document.querySelector(".pokemon-happiness-box");
  const input=document.getElementById("happiness");
  if(!box||!input||box.dataset.hv6)return;
  box.dataset.hv6="1";

  const TIERS=[
    {min:0,  max:49, id:"t0",label:"Desconfiado",line:"%s ainda não confia em você.",color:"#7f8aa3"},
    {min:50, max:99, id:"t1",label:"Neutro",     line:"%s está se acostumando com você.",color:"#9fb4d8"},
    {min:100,max:149,id:"t2",label:"Amigável",   line:"%s gosta da sua companhia.",color:"#f6a6c1"},
    {min:150,max:199,id:"t3",label:"Muito amigável",line:"%s fica feliz ao seu lado.",color:"#f27aa5"},
    {min:200,max:254,id:"t4",label:"Apegado",    line:"%s é muito apegado a você!",color:"#ec4f86"},
    {min:255,max:255,id:"t5",label:"Melhores amigos",line:"%s te ama do fundo do coração!",color:"#ff3d6e"}
  ];
  const tierOf=v=>TIERS.find(t=>v>=t.min&&v<=t.max)||TIERS[0];

  /* Coração 11×10 em pixel art */
  const HEART=[
    "..ooo.ooo..",
    ".oxxxoxxxo.",
    "oxhhxxxxxxo",
    "oxhxxxxxxdo",
    "oxxxxxxxxdo",
    ".oxxxxxxdo.",
    "..oxxxxdo..",
    "...oxxdo...",
    "....odo....",
    ".....o....."
  ];
  function heartSvg(fill,light,dark,cls){
    const pal={o:"#181a24",x:fill,h:light,d:dark};
    let r="";
    HEART.forEach((row,y)=>{let x=0;while(x<row.length){const ch=row[x];if(ch==="."){x++;continue;}let w=1;while(row[x+w]===ch)w++;r+=`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${pal[ch]}"/>`;x+=w;}});
    return `<svg class="${cls}" viewBox="0 0 11 10" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }

  /* ---------- Montagem ---------- */
  const strip=box.closest(".general-happiness-strip");
  const symbol=strip?.querySelector(".general-happiness-symbol");
  if(symbol){
    symbol.classList.add("hv-heart");
    symbol.innerHTML=heartSvg("#4a5163","#6a7287","#353b4a","hv-heart-empty")+`<span class="hv-heart-fill">${heartSvg("#ff4f7e","#ffb3c7","#c42a57","")}</span>`;
  }
  const labelBox=strip?.querySelector(".general-happiness-label > span:last-child");
  if(labelBox&&!labelBox.querySelector(".hv-line")){
    const line=document.createElement("em");
    line.className="hv-line";
    labelBox.appendChild(line);
  }

  const head=box.querySelector(".happiness-head");
  const numberWrap=box.querySelector(".happiness-number-wrap");
  const headLabel=head?.querySelector("label");
  if(headLabel&&!head.querySelector(".hv-tier")){
    const tier=document.createElement("span");
    tier.className="hv-tier";
    headLabel.after(tier);
  }
  if(numberWrap&&!box.querySelector(".hv-step")){
    const mk=(d,txt)=>`<button type="button" class="hv-step" data-hv-step="${d}" aria-label="${d>0?"Aumentar":"Diminuir"} felicidade em ${Math.abs(d)}">${txt}</button>`;
    numberWrap.insertAdjacentHTML("afterbegin",mk(-5,"−5")+mk(-1,"−1"));
    numberWrap.insertAdjacentHTML("beforeend",mk(1,"+1")+mk(5,"+5"));
  }

  const bar=box.querySelector(".happiness-bar");
  if(bar&&!bar.querySelector(".hv-ticks")){
    bar.classList.add("hv-bar");
    /* Marcas e coração ficam numa camada própria por cima da barra,
       para nenhum tema esconder (overflow/z-index da barra). */
    const track=document.createElement("div");
    track.className="hv-track";
    bar.before(track);
    track.appendChild(bar);
    track.insertAdjacentHTML("beforeend",`
      <div class="hv-overlay">
        <div class="hv-ticks">${TIERS.slice(1).map(t=>`<i style="left:${t.min/255*100}%"></i>`).join("")}</div>
        <div class="hv-marker">${heartSvg("#ff4f7e","#ffb3c7","#c42a57","")}</div>
      </div>`);
    track.insertAdjacentHTML("afterend",`<div class="hv-scale">${TIERS.map(t=>{
      const w=(Math.min(t.max+1,256)-t.min)/256*100;
      return `<span data-tier="${t.id}" style="flex-basis:${w}%;--hv-c:${t.color}">${t.label}</span>`;
    }).join("")}</div>`);
  }

  /* ---------- Atualização ---------- */
  let lastValue=null;
  function paint(){
    const p=typeof current!=="undefined"?current:null;
    const v=Math.max(0,Math.min(255,Math.round(Number(p?.happiness||0))));
    const pct=v/255*100;
    const t=tierOf(v);
    const name=(p?.name||"Seu Pokémon").trim()||"Seu Pokémon";
    box.dataset.tier=t.id;
    strip?.setAttribute("data-tier",t.id);
    box.style.setProperty("--hv-pct",`${pct}%`);
    box.style.setProperty("--hv-c",t.color);
    strip?.style.setProperty("--hv-pct",`${pct}%`);
    strip?.style.setProperty("--hv-c",t.color);
    strip?.style.setProperty("--hv-beat",`${Math.max(.55,1.6-pct/100)}s`);
    const fill=document.getElementById("happinessFill");
    if(fill)fill.style.setProperty("background-size",`100% 100%, ${pct>0?(10000/pct).toFixed(2):100}% 100%`,"important");
    const tierEl=box.querySelector(".hv-tier");
    if(tierEl)tierEl.textContent=t.label;
    const line=strip?.querySelector(".hv-line");
    if(line)line.textContent=t.line.replace("%s",name);
    box.querySelectorAll(".hv-scale span").forEach(s=>s.classList.toggle("on",s.dataset.tier===t.id));
    box.querySelectorAll(".hv-step").forEach(b=>{
      const d=Number(b.dataset.hvStep);
      b.disabled=(d<0&&v<=0)||(d>0&&v>=255);
    });
    if(lastValue!=null&&v!==lastValue&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
      const cls=v>lastValue?"hv-up":"hv-down";
      [box,strip].forEach(el=>{if(!el)return;el.classList.remove("hv-up","hv-down");void el.offsetWidth;el.classList.add(cls);});
    }
    lastValue=v;
  }

  box.addEventListener("click",event=>{
    const b=event.target.closest("[data-hv-step]");
    if(!b)return;
    const v=Math.max(0,Math.min(255,Number(input.value||0)+Number(b.dataset.hvStep)));
    input.value=v;
    input.dispatchEvent(new Event("input",{bubbles:true}));
    window.hhClassicSfx?.select?.();
  });

  if(typeof window.updateHappiness==="function"){
    const original=window.updateHappiness;
    window.updateHappiness=function(){const r=original.apply(this,arguments);paint();return r;};
  }
  window.hhHappiness={paint,tierOf};
  paint();
})();
