/* ============================================================
   V7 — Gráfico de status (substitui o radar em canvas)
   SVG interativo ligado ao sistema de Qualidade (QD):
   • anéis nas faixas de Qualidade (Q1 50 · Q2 76 · Q3 101 …);
   • polígono do status atual com brilho e, se quiser, o dos
     Base Stats oficiais por baixo para comparar;
   • etiquetas clicáveis em volta (abrem o campo para editar);
   • passar o mouse ou tocar num status mostra o cartão dele:
     valor, Qualidade, quanto falta para a próxima, Nature, base
     e o dado (QD) que ele dá no ataque ou na defesa.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined"||typeof STAT_KEYS==="undefined")return;
  const box=document.querySelector(".radar-box");
  const canvas=document.getElementById("radar");
  if(!box||!canvas)return;

  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const cur=()=>{try{return current;}catch(e){return null;}};
  const KEYS=STAT_KEYS.map(([k])=>k);
  const LABEL=["Vida","Ataque","Defesa","Atq. Esp.","Def. Esp.","Veloc."];
  const LONG=["Vida (HP)","Ataque","Defesa","Ataque Especial","Defesa Especial","Velocidade"];
  const COLOR=["#4fe36f","#ff9538","#4f8dff","#b067ff","#76e7ff","#ffd84a"];
  const Q_AT=[50,76,101,126,151,176,201,226];// valor que entra em cada Qualidade (Q1…Q8)
    const quality=v=>v<=49?0:v<=75?1:v<=100?2:v<=125?3:v<=150?4:v<=175?5:v<=200?6:v<=225?7:8;
  const W=560,H=500,CX=280,CY=250,R=170;
  const ang=i=>-Math.PI/2+i*Math.PI/3;
  const pt=(i,r)=>[CX+Math.cos(ang(i))*r,CY+Math.sin(ang(i))*r];
  const poly=rs=>rs.map((r,i)=>pt(i,r).map(n=>n.toFixed(1)).join(",")).join(" ");
  const scaleFor=vals=>Math.max(100,Math.ceil(Math.max(...vals,1)*1.1/25)*25);

  let ui={sel:-1,hover:-1,base:false,bands:true};
  try{const s=JSON.parse(localStorage.getItem("hh_statchart")||"{}");ui.base=!!s.base;ui.bands=s.bands!==false;}catch(e){}
  const remember=()=>{try{localStorage.setItem("hh_statchart",JSON.stringify({base:ui.base,bands:ui.bands}));}catch(e){}};

  const root=document.createElement("div");
  root.className="sc7";
  box.classList.add("sc7-on");
  box.appendChild(root);
  root.innerHTML=`<div class="sc7-bar" role="group" aria-label="Opções do gráfico">
      <button type="button" data-sc="bands" aria-pressed="${ui.bands}">◈ Faixas de Qualidade</button>
      <button type="button" data-sc="base" aria-pressed="${ui.base}">◇ Comparar com a Base</button>
    </div>
    <div class="sc7-stage"><svg class="sc7-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico dos status"></svg><div class="sc7-labels"></div></div>
    <div class="sc7-card" aria-live="polite"></div>`;
  const svg=root.querySelector("svg"),labelsEl=root.querySelector(".sc7-labels"),card=root.querySelector(".sc7-card");

  let shown=null,shownMax=100,frame=0;
  function values(){const p=cur();return KEYS.map(k=>Math.max(0,Number(p?.stats?.[k]||0)));}
  function baseValues(){const p=cur();const b=p?.baseStats||{};return KEYS.map(k=>Math.max(0,Number(b[k]||0)));}

  function draw(vals,max){
    const p=cur(),target=values(),base=baseValues(),focus=ui.hover>=0?ui.hover:ui.sel;
    const plus=p?.naturePlus,minus=p?.natureMinus;
    let s=`<defs>
      <radialGradient id="sc7Bg" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#3c78d8" stop-opacity=".22"/><stop offset="1" stop-color="#0b1424" stop-opacity="0"/></radialGradient>
      <radialGradient id="sc7Fill" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#9fe0ff" stop-opacity=".12"/><stop offset="1" stop-color="#63d0ff" stop-opacity=".42"/></radialGradient>
      <filter id="sc7Glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      ${COLOR.map((c,i)=>`<radialGradient id="sc7Dot${i}"><stop offset="0" stop-color="${c}" stop-opacity=".6"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join("")}
    </defs>
    <circle cx="${CX}" cy="${CY}" r="${R+60}" fill="url(#sc7Bg)"/>`;
    // fundo em teia e faixas de Qualidade
    for(let ring=5;ring>=1;ring--)s+=`<polygon points="${poly(Array(6).fill(R*ring/5))}" class="sc7-web${ring%2?" odd":""}${ring===5?" out":""}"/>`;
    if(ui.bands){
      Q_AT.forEach((v,qi)=>{if(v>max)return;const r=R*v/max;
        s+=`<polygon points="${poly(Array(6).fill(r))}" class="sc7-band q${qi+1}"/>`;
        const [x,y]=pt(0,r);s+=`<text x="${x+6}" y="${y-3}" class="sc7-qtxt">Q${qi+1}·${v}</text>`;});
    }
    // fatia em destaque
    if(focus>=0){const v=pt(focus,R),m0=pt((focus+5)%6,R),m1=pt((focus+1)%6,R);const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];const a=mid(m0,v),b=mid(v,m1);
      s+=`<path d="M${CX},${CY} L${a.join(",")} L${v.join(",")} L${b.join(",")} Z" fill="${COLOR[focus]}" opacity=".16"/>`;}
    // eixos
    for(let i=0;i<6;i++){const [x,y]=pt(i,R);s+=`<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="${COLOR[i]}" stroke-opacity="${i===focus?.8:.35}" stroke-width="${i===focus?2:1.2}"/>`;}
    // base oficial (tracejado)
    if(ui.base&&base.some(Boolean))s+=`<polygon points="${poly(base.map(v=>R*Math.min(1,v/max)))}" class="sc7-base"/>`;
    // status atual: fatias coloridas + contorno com brilho
    const rs=vals.map(v=>R*Math.max(0,Math.min(1,v/max)));
    const pts=rs.map((r,i)=>pt(i,r));
    for(let i=0;i<6;i++){const j=(i+1)%6;s+=`<polygon points="${CX},${CY} ${pts[i].join(",")} ${pts[j].join(",")}" fill="${COLOR[i]}" fill-opacity="${focus===i||focus===j?.36:.22}"/>`;}
    s+=`<polygon points="${poly(rs)}" fill="url(#sc7Fill)" class="sc7-shape" filter="url(#sc7Glow)"/>`;
    // pontos (focáveis)
    pts.forEach(([x,y],i)=>{const big=i===focus;
      s+=`<g class="sc7-dot${big?" on":""}" data-i="${i}" tabindex="0" role="button" aria-label="${LONG[i]} ${Math.round(target[i])}">
        <circle cx="${x}" cy="${y}" r="${big?22:16}" fill="url(#sc7Dot${i})"/>
        <circle cx="${x}" cy="${y}" r="${big?9:7}" fill="${COLOR[i]}" stroke="#0b121a" stroke-width="2.5"/>
        <circle cx="${x-2.4}" cy="${y-2.4}" r="2.3" fill="#fff" opacity=".75"/>
        <circle cx="${x}" cy="${y}" r="20" fill="transparent"/></g>`;});
    // centro
    const total=target.reduce((a,b)=>a+b,0),bst=base.reduce((a,b)=>a+b,0);
    s+=`<g class="sc7-center"><circle cx="${CX}" cy="${CY}" r="34"/><text x="${CX}" y="${CY-9}" class="sc7-ctop">TOTAL</text><text x="${CX}" y="${CY+8}" class="sc7-cval">${Math.round(total)}</text>${bst?`<text x="${CX}" y="${CY+22}" class="sc7-cbst">base ${bst}</text>`:""}</g>`;
    svg.innerHTML=s;
    // etiquetas (HTML, clicáveis)
    labelsEl.innerHTML=KEYS.map((k,i)=>{const [x,y]=pt(i,R+52);const q=quality(target[i]);const mark=k===plus?`<i class="up" title="Nature +">▲</i>`:k===minus?`<i class="down" title="Nature −">▼</i>`:"";
      return `<button type="button" class="sc7-chip${i===focus?" on":""}" data-i="${i}" style="left:${(x/W*100).toFixed(2)}%;top:${(y/H*100).toFixed(2)}%;--c:${COLOR[i]}" title="Editar ${LONG[i]}">
        <span>${LABEL[i]}${mark}</span><b>${Math.round(target[i])}</b><em>Q${q}</em></button>`;}).join("");
    renderCard();
  }

  function renderCard(){
    const i=ui.hover>=0?ui.hover:ui.sel,p=cur();
    if(i<0||!p){card.innerHTML=`<p class="sc7-tip">Toque num status para ver a <b>Qualidade</b> e o dado que ele dá. Toque de novo na etiqueta para editar.</p>`;card.style.removeProperty("--c");return;}
    const k=KEYS[i],v=Math.round(Number(p.stats?.[k]||0)),b=Math.round(Number(p.baseStats?.[k]||0)),q=quality(v);
    const next=Q_AT[q],prev=q?Q_AT[q-1]:0;
    const pct=next?Math.round(100*(v-prev)/(next-prev)):100;
    const nat=k===p.naturePlus?"Nature favorece (▲)":k===p.natureMinus?"Nature atrapalha (▼)":"";
    let role="";
    if(k==="atk"||k==="spa")role=`Ataque ${k==="atk"?"físico":"especial"}: contra uma defesa de Q${q} rola <b>d6</b>${q>0?`; contra Q${q-1}, <b>d8</b>`:""}${q>1?`; contra Q${q-2}, <b>d10</b>`:""}. Contra defesa acima de Q${q}, cai para <b>d4</b>.`;
    else if(k==="def"||k==="spd")role=`Defesa ${k==="def"?"física":"especial"}: um atacante de Q${q} rola <b>d6</b>; de Q${q+1}, <b>d8</b>; abaixo de Q${q}, só <b>d4</b>.`;
    else if(k==="spe")role="Define quem age primeiro (depois da prioridade do golpe).";
    else role="HP Máximo do Pokémon.";
    card.style.setProperty("--c",COLOR[i]);
    card.innerHTML=`<div class="sc7-card-head"><b>${LONG[i]}</b><span class="sc7-q">Q${q}</span><strong>${v}</strong></div>
      ${`<div class="sc7-meter" title="${next?`faltam ${next-v} para Q${q+1}`:"Qualidade máxima"}"><i style="width:${Math.max(4,Math.min(100,pct))}%"></i></div>
      <small class="sc7-meta">${next?`Faltam <b>${next-v}</b> para <b>Q${q+1}</b> (${next})`:"Qualidade máxima (Q8)"}${b?` · Base oficial <b>${b}</b>`:""}${nat?` · ${nat}`:""}</small>`}
      <p>${role}</p>`;
  }

  function render(animate=true){
    const target=values(),max=scaleFor(target);
    cancelAnimationFrame(frame);
    const reduce=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if(!shown||!animate||reduce||document.hidden){shown=target;shownMax=max;draw(target,max);return;}
    const from=shown.slice(),fromMax=shownMax,t0=performance.now(),dur=420,ease=t=>1-Math.pow(1-t,3);
    if(from.every((x,i)=>x===target[i])&&fromMax===max){draw(target,max);return;}
    const step=now=>{const k=ease(Math.min(1,(now-t0)/dur));shown=target.map((v,i)=>from[i]+(v-from[i])*k);shownMax=fromMax+(max-fromMax)*k;draw(shown,shownMax);if(k<1)frame=requestAnimationFrame(step);else{shown=target;shownMax=max;}};
    frame=requestAnimationFrame(step);
  }
  const redraw=()=>draw(shown||values(),shownMax||scaleFor(values()));
  function setHover(i){if(i===ui.hover)return;ui.hover=i;
    document.querySelectorAll("#statEditor .stat-row").forEach(row=>row.classList.toggle("radar-linked",i>=0&&row.dataset.stat===KEYS[i]));redraw();}
  function editStat(i){const input=document.querySelector(`#statEditor .stat-row[data-stat="${KEYS[i]}"] input`);if(input){input.focus();input.select?.();}}

  root.addEventListener("click",e=>{
    const t=e.target.closest("[data-sc]");
    if(t){ui[t.dataset.sc]=!ui[t.dataset.sc];t.setAttribute("aria-pressed",ui[t.dataset.sc]);remember();redraw();return;}
    const chip=e.target.closest(".sc7-chip");
    if(chip){const i=Number(chip.dataset.i);if(ui.sel===i)editStat(i);ui.sel=i;redraw();return;}
    const dot=e.target.closest(".sc7-dot");
    if(dot){const i=Number(dot.dataset.i);ui.sel=ui.sel===i?-1:i;redraw();return;}
  });
  root.addEventListener("keydown",e=>{const dot=e.target.closest(".sc7-dot");if(dot&&(e.key==="Enter"||e.key===" ")){e.preventDefault();editStat(Number(dot.dataset.i));}});
  root.addEventListener("pointerover",e=>{const el=e.target.closest(".sc7-dot,.sc7-chip");if(el&&e.pointerType!=="touch")setHover(Number(el.dataset.i));});
  root.addEventListener("pointerout",e=>{const el=e.target.closest(".sc7-dot,.sc7-chip");if(el&&!el.contains(e.relatedTarget))setHover(-1);});
  const ed=document.getElementById("statEditor");
  ed?.addEventListener("pointerover",e=>{const row=e.target.closest(".stat-row");if(row)setHover(KEYS.indexOf(row.dataset.stat));});
  ed?.addEventListener("pointerleave",()=>setHover(-1));
  ed?.addEventListener("focusin",e=>{const row=e.target.closest(".stat-row");if(row){ui.sel=KEYS.indexOf(row.dataset.stat);redraw();}});

  // o radar antigo passa a desenhar este gráfico
  try{window.drawRadar=function(){render(true);};}catch(e){}
  try{drawRadar=window.drawRadar;}catch(e){}
  ["hh:render","hh:pokemonchange"].forEach(ev=>document.addEventListener(ev,()=>render(true)));
  document.addEventListener("input",e=>{if(e.target.closest?.("#statEditor"))setTimeout(()=>render(true),0);});
  render(false);
  window.hhStatChart={render};
})();
