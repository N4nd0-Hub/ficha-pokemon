/* ============================================================
   V6 — Temas especiais (Pikachu, N, Arceus)
   Cada tema especial ganha uma camada de efeitos atrás da ficha
   (#spFxBack) e, quando precisa, uma camada leve na frente
   (#spFxFront, sem cliques). As cores e enfeites ficam no
   styles/special-themes-v6.css. Os efeitos animados podem ser
   desligados no Personalizar e respeitam "reduzir movimento".
   ============================================================ */
(function(){
  "use strict";
  if(window.hhSpecialFx)return;
  const root=document.documentElement;
  const SPECIAL=["pikachu","n","arceus"];
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const reduce=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const fxOff=()=>{try{return localStorage.getItem("hh_fx_off")==="1";}catch(e){return false;}};

  const back=document.createElement("div");back.id="spFxBack";back.setAttribute("aria-hidden","true");
  const front=document.createElement("div");front.id="spFxFront";front.setAttribute("aria-hidden","true");
  document.body.append(back,front);

  let active=null,cleanup=[];
  const later=(fn,ms)=>{const t=setTimeout(fn,ms);cleanup.push(()=>clearTimeout(t));};
  const on=(el,ev,fn,opt)=>{el.addEventListener(ev,fn,opt);cleanup.push(()=>el.removeEventListener(ev,fn,opt));};
  const el=(tag,cls,parent,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html)e.innerHTML=html;parent?.appendChild(e);return e;};

  /* ---------- Pikachu: raios, faíscas e orbes elétricos ---------- */
  function boltPath(x,y0,y1){
    let pts=[[x,y0]],y=y0,cx=x;
    while(y<y1){y+=rnd(18,46);cx+=rnd(-38,38);pts.push([cx,Math.min(y,y1)]);}
    return pts;
  }
  function strike(){
    if(!document.hidden){
      const w=innerWidth,h=innerHeight;
      const x=rnd(w*.08,w*.92),end=rnd(h*.35,h*.85);
      const main=boltPath(x,-10,end);
      const branches=[];
      for(let i=0;i<2;i++){const s=main[Math.floor(rnd(1,main.length-1))];if(s)branches.push(boltPath(s[0],s[1],s[1]+rnd(60,160)));}
      const line=p=>`<polyline points="${p.map(q=>q.join(",")).join(" ")}"/>`;
      const svg=el("div","sp-bolt",front,`<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <g class="glow">${line(main)}${branches.map(line).join("")}</g>
        <g class="core">${line(main)}${branches.map(line).join("")}</g></svg>`);
      const flash=el("div","sp-flash",front);
      setTimeout(()=>{svg.remove();flash.remove();},900);
      // a janela mais próxima do raio dá um "choque"
      const hit=document.elementFromPoint(main.at(-1)[0],main.at(-1)[1])?.closest(".panel,.combat-info-card");
      if(hit){hit.classList.add("sp-zap");setTimeout(()=>hit.classList.remove("sp-zap"),700);}
    }
    later(strike,rnd(4200,9000));
  }
  function sparksAt(x,y,n=7){
    for(let i=0;i<n;i++){
      const s=el("i","sp-spark",front);
      s.style.left=x+"px";s.style.top=y+"px";
      const a=rnd(0,Math.PI*2),d=rnd(18,46);
      s.animate([{transform:"translate(-50%,-50%) scale(1)",opacity:1},{transform:`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d}px)) scale(.2)`,opacity:0}],{duration:rnd(380,620),easing:"cubic-bezier(.2,.8,.3,1)"}).finished.then(()=>s.remove());
    }
  }
  function mountPikachu(animated){
    for(let i=0;i<14;i++){
      const o=el("i","sp-orb",back);
      o.style.cssText=`left:${rnd(0,100)}%;top:${rnd(0,100)}%;--s:${rnd(4,10)}px;animation-duration:${rnd(7,15)}s;animation-delay:${-rnd(0,15)}s`;
    }
    if(!animated)return;
    later(strike,1400);
    on(document,"pointerdown",e=>{if(e.target.closest("button,.tab,[role=tab],a"))sparksAt(e.clientX,e.clientY);},{passive:true});
  }

  /* ---------- N: fórmulas, roda-gigante e formas de brinquedo ---------- */
  const FORMULAS=["e^{iπ} + 1 = 0","f(x) = ax² + bx + c","∑ 1/n² = π²/6","∫₀^∞ e^{-x²} dx = √π/2","Verdade ≠ Ideais ?","x = (−b ± √Δ) / 2a","φ = (1 + √5) / 2","∀ Pokémon ∃ amigo","lim n→∞ (1+1/n)ⁿ = e","a² + b² = c²","∇·E = ρ/ε₀","P(liberdade) = ?","2, 3, 5, 7, 11, 13…","dy/dx = ky","sin²θ + cos²θ = 1","1 + 1 = 2  (amigos)"];
  const WHEEL=`<svg viewBox="-110 -110 220 260"><g class="sp-wheel-rot">
      <circle r="100" fill="none" stroke-width="4"/><circle r="84" fill="none" stroke-width="1.5"/><circle r="12" stroke-width="3"/>
      ${Array.from({length:12},(_,i)=>{const a=i*Math.PI/6,x=Math.cos(a)*100,y=Math.sin(a)*100;return `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke-width="2"/>`;}).join("")}
      ${Array.from({length:12},(_,i)=>{const a=i*Math.PI/6,x=Math.cos(a)*100,y=Math.sin(a)*100;return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="sp-cab"><line x1="0" y1="0" x2="0" y2="8" stroke-width="2"/><rect x="-9" y="8" width="18" height="14" rx="4" stroke-width="2"/></g></g>`;}).join("")}
    </g><path d="M0 0 L-55 140 M0 0 L55 140 M-70 140 H70" fill="none" stroke-width="5"/></svg>`;
  function mountN(animated){
    const wheel=el("div","sp-wheel",back,WHEEL);
    if(!animated)wheel.classList.add("still");
    FORMULAS.forEach((f,i)=>{
      const t=el("span","sp-formula",back);t.textContent=f;
      t.style.cssText=`left:${rnd(2,88)}%;top:${rnd(4,96)}%;font-size:${rnd(13,22).toFixed(0)}px;animation-duration:${rnd(18,34)}s;animation-delay:${-rnd(0,30)}s;--r:${rnd(-8,8).toFixed(1)}deg`;
    });
    const shapes=["sq","tri","circ","star","cube"];
    for(let i=0;i<10;i++){
      const s=el("i",`sp-toy ${pick(shapes)}`,back);
      s.style.cssText=`left:${rnd(0,96)}%;top:${rnd(0,96)}%;--s:${rnd(14,30).toFixed(0)}px;animation-duration:${rnd(14,26)}s;animation-delay:${-rnd(0,26)}s;--c:${pick(["#9fe3c8","#f6e7a1","#bcc6f5","#f5b8c8","#ffffff"])}`;
    }
  }

  /* ---------- Arceus: raios de luz, partículas douradas e colunas ---------- */
  function mountArceus(animated){
    el("div","sp-rays",back);
    el("div","sp-halo",back,"<i></i><i></i>");
    el("div","sp-col left",back,"<i></i>");
    el("div","sp-col right",back,"<i></i>");
    for(let i=0;i<26;i++){
      const m=el("i","sp-mote",back);
      m.style.cssText=`left:${rnd(0,100)}%;--s:${rnd(2,6).toFixed(1)}px;animation-duration:${rnd(9,20)}s;animation-delay:${-rnd(0,20)}s;--x:${rnd(-40,40).toFixed(0)}px`;
    }
    if(!animated)return;
    for(let i=0;i<7;i++){
      const m=el("i","sp-mote front",front);
      m.style.cssText=`left:${rnd(0,100)}%;--s:${rnd(2,4).toFixed(1)}px;animation-duration:${rnd(14,24)}s;animation-delay:${-rnd(0,24)}s;--x:${rnd(-60,60).toFixed(0)}px`;
    }
    on(document,"pointerdown",e=>{
      if(!e.target.closest("button,.tab,[role=tab]"))return;
      const r=el("i","sp-ring",front);r.style.left=e.clientX+"px";r.style.top=e.clientY+"px";setTimeout(()=>r.remove(),900);
    },{passive:true});
  }

  const MOUNT={pikachu:mountPikachu,n:mountN,arceus:mountArceus};
  function teardown(){cleanup.forEach(f=>{try{f();}catch(e){}});cleanup=[];back.innerHTML="";front.innerHTML="";}
  function refresh(force){
    const theme=root.dataset.theme;
    const want=SPECIAL.includes(theme)&&root.dataset.sheetMode!=="pokedex"?theme:null;
    const animated=!fxOff()&&!reduce();
    root.dataset.spFx=want?(animated?"on":"still"):"";
    const key=want?want+(animated?"+":"-"):null;
    if(key===active&&!force)return;
    teardown();active=key;
    if(!want)return;
    MOUNT[want](animated);
  }
  new MutationObserver(()=>refresh()).observe(root,{attributes:true,attributeFilter:["data-theme","data-sheet-mode"]});
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change",()=>refresh(true));
  refresh();
  window.hhSpecialFx={refresh:()=>refresh(true)};
})();
