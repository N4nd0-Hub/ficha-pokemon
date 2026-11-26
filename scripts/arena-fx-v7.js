/* ============================================================
   V7 — Arena Online: efeitos dos golpes
   Animações por tipo (fogo, água, elétrico…) e por categoria
   (físico investe e acerta no alvo, especial dispara um projétil
   ou raio, status brilha em volta de quem usou). Tudo é desenhado
   numa camada própria por cima do campo, com Web Animations, então
   não depende de imagens extras e funciona offline.
   ============================================================ */
(function(){
  "use strict";
  const reduce=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  const R=(a,b)=>a+Math.random()*(b-a);
  const pal=t=>{try{return moveTypePalette(t);}catch(e){return {main:"#a8a878",dark:"#6d6d4e"};}};
  const norm=t=>{try{return normalizeTypeName(t)||"Normal";}catch(e){return t||"Normal";}};

  /* Aparência por tipo: forma das partículas, cor de brilho e estilo do golpe especial */
  const LOOK={
    Fire:{shape:"flame",glow:"#ffb347",colors:["#ff4b1f","#ff9a1f","#ffd23f"],special:"ball",rise:true},
    Water:{shape:"bubble",glow:"#7fd3ff",colors:["#2f8cff","#6fc3ff","#d8f3ff"],special:"stream"},
    Electric:{shape:"spark",glow:"#fff27a",colors:["#ffe23f","#fff7b0","#ffffff"],special:"bolt"},
    Grass:{shape:"leaf",glow:"#9cf07a",colors:["#3fae4a","#7bd65a","#c6f29a"],special:"leaves"},
    Ice:{shape:"shard",glow:"#d6f6ff",colors:["#9be7ff","#d6f6ff","#ffffff"],special:"beam",frost:true},
    Fighting:{shape:"star",glow:"#ffb08a",colors:["#c03028","#ff7a4d","#ffe0c8"],special:"ball"},
    Poison:{shape:"bubble",glow:"#d68cff",colors:["#a040a0","#c77ddc","#e8b6f2"],special:"ball",rise:true},
    Ground:{shape:"rock",glow:"#e8c77a",colors:["#a07838","#d2a55a","#e8d29c"],special:"quake"},
    Flying:{shape:"wind",glow:"#e6f0ff",colors:["#a890f0","#d6ccff","#ffffff"],special:"wind"},
    Psychic:{shape:"ring",glow:"#ff9ccb",colors:["#f85888","#ff9cc4","#ffd6e8"],special:"rings",tint:"rgba(248,88,136,.25)"},
    Bug:{shape:"dot",glow:"#d6f07a",colors:["#a8b820","#cfe05a","#eef7a8"],special:"swarm"},
    Rock:{shape:"rock",glow:"#e0cf8a",colors:["#8a7a3a","#b8a038","#ddd09a"],special:"rocks"},
    Ghost:{shape:"wisp",glow:"#b89cff",colors:["#705898","#9a7ed6","#d4c4ff"],special:"wisps",tint:"rgba(40,20,70,.45)"},
    Dragon:{shape:"flame",glow:"#9a8cff",colors:["#7038f8","#5a8cff","#c4b6ff"],special:"beam"},
    Dark:{shape:"slash",glow:"#8a7a70",colors:["#3a2e28","#705848","#bfa898"],special:"slash",tint:"rgba(10,8,20,.5)"},
    Steel:{shape:"shard",glow:"#e8eef8",colors:["#9aa6b8","#d0d8e6","#ffffff"],special:"beam"},
    Fairy:{shape:"star",glow:"#ffc6e6",colors:["#ee99ac","#ffb6d9","#fff0f8"],special:"sparkles"},
    Normal:{shape:"star",glow:"#ffffff",colors:["#c6c6a7","#e8e8d0","#ffffff"],special:"ball"}
  };
  const look=t=>LOOK[norm(t)]||LOOK.Normal;

  function layer(field){
    let l=field.querySelector(":scope>.ar7-fxl");
    if(!l){l=document.createElement("div");l.className="ar7-fxl";l.setAttribute("aria-hidden","true");field.appendChild(l);}
    return l;
  }
  /* Centro do sprite em coordenadas do campo */
  function center(field,pos){
    const f=field.getBoundingClientRect(),m=field.querySelector(`.ar7-mon.${pos}`);
    if(!m)return {x:f.width*(pos==="me"?.25:.72),y:f.height*(pos==="me"?.68:.32),s:f.width*.2};
    const r=m.getBoundingClientRect();
    return {x:r.left-f.left+r.width/2,y:r.top-f.top+r.height*.58,s:Math.min(r.width,r.height)};
  }
  function el(l,cls,css){
    const e=document.createElement("i");e.className="ar7-p "+cls;
    for(const [k,v] of Object.entries(css||{})){if(k.startsWith("--"))e.style.setProperty(k,v);else e.style[k]=v;}
    l.appendChild(e);return e;
  }
  function kill(e,a){a.onfinish=()=>e.remove();a.oncancel=()=>e.remove();return a;}
  function anim(e,frames,opt){return kill(e,e.animate(frames,{fill:"both",...opt}));}

  /* ---------- Peças ---------- */
  function particle(l,shape,color,size){
    return el(l,"s-"+shape,{width:size+"px",height:size+"px","--c":color});
  }
  function burst(l,at,lk,{n=14,spread=1,size=14,dur=700,delay=0}={}){
    for(let i=0;i<n;i++){
      const c=lk.colors[i%lk.colors.length],sz=size*R(.6,1.3);
      const p=particle(l,lk.shape,c,sz);
      const a=R(0,Math.PI*2),d=at.s*R(.25,.75)*spread;
      const dx=Math.cos(a)*d,dy=Math.sin(a)*d+(lk.rise?-at.s*.35:0);
      anim(p,[
        {transform:`translate(${at.x-sz/2}px,${at.y-sz/2}px) scale(.3) rotate(0deg)`,opacity:1},
        {transform:`translate(${at.x-sz/2+dx}px,${at.y-sz/2+dy}px) scale(1) rotate(${R(-200,200)}deg)`,opacity:1,offset:.55},
        {transform:`translate(${at.x-sz/2+dx*1.2}px,${at.y-sz/2+dy*1.2+(lk.rise?-20:14)}px) scale(.4) rotate(${R(-300,300)}deg)`,opacity:0}
      ],{duration:dur*R(.8,1.2),delay:delay+R(0,90),easing:"cubic-bezier(.2,.7,.3,1)"});
    }
  }
  function impact(l,at,lk,big){
    const s=at.s*(big?1.15:.8);
    const ring=el(l,"s-impact",{width:s+"px",height:s+"px","--c":lk.glow});
    anim(ring,[{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(.2)`,opacity:1},{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(1.2)`,opacity:0}],{duration:420,easing:"ease-out"});
    const star=el(l,"s-hitstar",{width:s*.7+"px",height:s*.7+"px","--c":lk.colors[1]});
    anim(star,[{transform:`translate(${at.x-s*.35}px,${at.y-s*.35}px) scale(.3) rotate(0)`,opacity:1},{transform:`translate(${at.x-s*.35}px,${at.y-s*.35}px) scale(1) rotate(25deg)`,opacity:1,offset:.4},{transform:`translate(${at.x-s*.35}px,${at.y-s*.35}px) scale(1.1) rotate(35deg)`,opacity:0}],{duration:360});
  }
  function travel(l,from,to,lk,{size=26,dur=480,shape="orb",trail=true}={}){
    const p=el(l,"s-"+shape,{width:size+"px",height:size+"px","--c":lk.colors[0],"--g":lk.glow});
    const mid={x:(from.x+to.x)/2,y:Math.min(from.y,to.y)-Math.abs(from.x-to.x)*.12};
    anim(p,[
      {transform:`translate(${from.x-size/2}px,${from.y-size/2}px) scale(.4)`},
      {transform:`translate(${mid.x-size/2}px,${mid.y-size/2}px) scale(1)`,offset:.5},
      {transform:`translate(${to.x-size/2}px,${to.y-size/2}px) scale(1.15)`,opacity:1},
      {transform:`translate(${to.x-size/2}px,${to.y-size/2}px) scale(1.6)`,opacity:0}
    ],{duration:dur+80,easing:"cubic-bezier(.4,0,.6,1)"});
    if(trail)for(let k=1;k<=5;k++){
      const t=el(l,"s-"+(lk.shape==="flame"?"flame":"orb"),{width:size*(1-k*.13)+"px",height:size*(1-k*.13)+"px","--c":lk.colors[k%lk.colors.length],"--g":lk.glow});
      const z=size*(1-k*.13);
      anim(t,[
        {transform:`translate(${from.x-z/2}px,${from.y-z/2}px)`,opacity:0},
        {transform:`translate(${mid.x-z/2}px,${mid.y-z/2}px)`,opacity:.7,offset:.5},
        {transform:`translate(${to.x-z/2}px,${to.y-z/2}px)`,opacity:0}
      ],{duration:dur,delay:k*35,easing:"cubic-bezier(.4,0,.6,1)"});
    }
    return dur;
  }
  function beam(l,from,to,lk,{width=18,dur=560}={}){
    const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy),ang=Math.atan2(dy,dx)*180/Math.PI;
    const b=el(l,"s-beam",{width:len+"px",height:width+"px","--c":lk.colors[0],"--c2":lk.colors[2],"--g":lk.glow,left:from.x+"px",top:from.y-width/2+"px",transform:`rotate(${ang}deg)`});
    anim(b,[{clipPath:"inset(0 100% 0 0)",opacity:1},{clipPath:"inset(0 0 0 0)",opacity:1,offset:.45},{clipPath:"inset(0 0 0 0)",opacity:1,offset:.75},{clipPath:"inset(0 0 0 100%)",opacity:.2}],{duration:dur,easing:"ease-in-out"});
    return dur*.5;
  }
  function bolt(l,to,lk){
    const f=l.getBoundingClientRect();
    const svgNS="http://www.w3.org/2000/svg",svg=document.createElementNS(svgNS,"svg");
    svg.setAttribute("class","ar7-p s-bolt");svg.setAttribute("width",f.width);svg.setAttribute("height",f.height);
    svg.style.cssText=`left:0;top:0`;svg.style.setProperty("--g",lk.glow);
    for(let k=0;k<2;k++){
      let x=to.x+R(-20,20),y=-10,d=`M${x} ${y}`;
      while(y<to.y){y+=R(18,34);x+=R(-26,26);d+=` L${x.toFixed(1)} ${Math.min(y,to.y).toFixed(1)}`;}
      const p=document.createElementNS(svgNS,"path");p.setAttribute("d",d);p.setAttribute("stroke",k?"#fff":lk.colors[0]);p.setAttribute("stroke-width",k?3:8);
      p.setAttribute("fill","none");p.setAttribute("stroke-linejoin","round");svg.appendChild(p);
    }
    l.appendChild(svg);
    anim(svg,[{opacity:1},{opacity:.2,offset:.2},{opacity:1,offset:.35},{opacity:.3,offset:.6},{opacity:1,offset:.7},{opacity:0}],{duration:520});
  }
  function slashes(l,at,lk,n=3){
    for(let i=0;i<n;i++){
      const w=at.s*1.1,s=el(l,"s-slashline",{width:w+"px","--c":lk.colors[i%2?2:1],"--g":lk.glow,left:at.x-w/2+"px",top:at.y-at.s*.3+i*at.s*.22+"px"});
      const ang=-32+i*6;
      anim(s,[{transform:`rotate(${ang}deg) scaleX(0)`,opacity:1,transformOrigin:"0 50%"},{transform:`rotate(${ang}deg) scaleX(1)`,opacity:1,offset:.5,transformOrigin:"0 50%"},{transform:`rotate(${ang}deg) scaleX(1)`,opacity:0,transformOrigin:"0 50%"}],{duration:380,delay:i*90,easing:"ease-out"});
    }
  }
  function rings(l,at,lk,n=3,grow=1.4){
    for(let i=0;i<n;i++){
      const s=at.s,r=el(l,"s-ringwave",{width:s+"px",height:s+"px","--c":lk.colors[i%lk.colors.length]});
      anim(r,[{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(.15)`,opacity:1},{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(${grow})`,opacity:0}],{duration:620,delay:i*150,easing:"ease-out"});
    }
  }
  function rocks(l,at,lk,n=5){
    for(let i=0;i<n;i++){
      const sz=at.s*R(.16,.28),p=particle(l,"rock",lk.colors[i%lk.colors.length],sz),x=at.x+R(-at.s*.45,at.s*.45);
      anim(p,[{transform:`translate(${x-sz/2}px,${-sz}px) rotate(0)`},{transform:`translate(${x-sz/2}px,${at.y-sz/2+R(-10,20)}px) rotate(${R(-120,120)}deg)`,offset:.75},{transform:`translate(${x-sz/2+R(-14,14)}px,${at.y-sz/2+10}px) rotate(${R(-160,160)}deg)`,opacity:0}],{duration:560,delay:i*70,easing:"cubic-bezier(.5,0,.8,.6)"});
    }
  }
  function aura(l,at,lk,{dur=900}={}){
    const s=at.s*1.25,a=el(l,"s-aura",{width:s+"px",height:s+"px","--c":lk.glow});
    anim(a,[{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(.6)`,opacity:0},{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(1)`,opacity:.9,offset:.35},{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(1.15)`,opacity:0}],{duration:dur});
    for(let i=0;i<10;i++){
      const sz=R(6,12),p=particle(l,i%2?"star":"orb",lk.colors[i%lk.colors.length],sz),x=at.x+R(-at.s*.4,at.s*.4);
      anim(p,[{transform:`translate(${x}px,${at.y+at.s*.3}px) scale(.4)`,opacity:0},{transform:`translate(${x}px,${at.y}px) scale(1)`,opacity:1,offset:.4},{transform:`translate(${x+R(-8,8)}px,${at.y-at.s*.6}px) scale(.3)`,opacity:0}],{duration:dur,delay:i*50});
    }
  }
  function shield(l,at,lk){
    const s=at.s*1.35,e=el(l,"s-shield",{width:s+"px",height:s+"px","--c":"#7fd3ff"});
    anim(e,[{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(.3)`,opacity:0},{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(1.05)`,opacity:1,offset:.3},{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(1)`,opacity:1,offset:.8},{transform:`translate(${at.x-s/2}px,${at.y-s/2}px) scale(1.1)`,opacity:0}],{duration:1000});
  }
  function tint(field,color,dur=700){
    const t=document.createElement("i");t.className="ar7-p s-tint under";t.style.background=color;field.appendChild(t);
    anim(t,[{opacity:0},{opacity:1,offset:.25},{opacity:1,offset:.7},{opacity:0}],{duration:dur});
  }
  function flash(field,color="#fff",dur=260){
    const t=document.createElement("i");t.className="ar7-p s-tint";t.style.background=color;layer(field).appendChild(t);
    anim(t,[{opacity:.95},{opacity:0}],{duration:dur,easing:"ease-out"});
  }
  function label(field,at,text,cls){
    const t=document.createElement("b");t.className="ar7-p s-label "+(cls||"");t.textContent=text;layer(field).appendChild(t);
    anim(t,[{transform:`translate(${at.x}px,${at.y-at.s*.55}px) translate(-50%,0) scale(.4)`,opacity:0},{transform:`translate(${at.x}px,${at.y-at.s*.7}px) translate(-50%,0) scale(1.1)`,opacity:1,offset:.25},{transform:`translate(${at.x}px,${at.y-at.s*.8}px) translate(-50%,0) scale(1)`,opacity:1,offset:.75},{transform:`translate(${at.x}px,${at.y-at.s*1}px) translate(-50%,0) scale(1)`,opacity:0}],{duration:1100});
  }
  function shake(field,strength){
    field.animate([{transform:"translate(0,0)"},{transform:`translate(${-strength}px,${strength/2}px)`},{transform:`translate(${strength}px,${-strength/2}px)`},{transform:`translate(${-strength/2}px,${strength/3}px)`},{transform:"translate(0,0)"}],{duration:380});
  }
  function monAnim(field,pos,frames,opt){
    const m=field.querySelector(`.ar7-mon.${pos}`);if(!m)return;
    m.animate(frames,opt);
  }

  /* ---------- Roteiro por evento ---------- */
  const HEAL=/recover|roost|soft-boiled|slack off|synthesis|moonlight|morning sun|milk drink|heal order|shore up|^rest$|lunar blessing/i;
  // Última intenção de golpe, usada para pintar o acerto com a cor certa.
  let lastMove=null;

  function play(field,ev,ctx){
    if(!field||reduce())return 0;
    const l=layer(field);
    const P=s=>ctx.pos(s),other=p=>p==="me"?"foe":"me";
    if(ev.k==="move"){
      const pos=P(ev.side),tpos=other(pos);
      const from=center(field,pos),to=center(field,tpos);
      const lk=look(ev.type),cat=String(ev.category||"").toLowerCase();
      lastMove={lk,cat,side:ev.side,type:norm(ev.type)};
      // brilho de preparação em quem ataca
      const glow=el(l,"s-charge",{width:from.s+"px",height:from.s+"px","--c":lk.glow});
      anim(glow,[{transform:`translate(${from.x-from.s/2}px,${from.y-from.s/2}px) scale(.6)`,opacity:0},{transform:`translate(${from.x-from.s/2}px,${from.y-from.s/2}px) scale(1)`,opacity:.8,offset:.5},{transform:`translate(${from.x-from.s/2}px,${from.y-from.s/2}px) scale(1.2)`,opacity:0}],{duration:420});
      if(ev.protect){shield(l,from,lk);return 900;}
      if(HEAL.test(ev.move||"")){aura(l,from,look("Grass"));return 700;}
      if(cat==="status"){
        aura(l,from,lk);
        if(lk.tint)tint(field,lk.tint,800);
        return 950;
      }
      if(ev.noTarget)return 500;
      // ataque físico: investida até o alvo
      if(cat==="physical"){
        const dx=(to.x-from.x)*.55,dy=(to.y-from.y)*.55,flip=pos==="me"?" scaleX(-1)":"";
        monAnim(field,pos,[{transform:"translate(0,0)"},{transform:`translate(${-dx*.12}px,${-dy*.12}px)`,offset:.25},{transform:`translate(${dx}px,${dy}px)`,offset:.55},{transform:"translate(0,0)"}],{duration:560,easing:"cubic-bezier(.5,0,.4,1)"});
        if(ev.miss){setTimeout(()=>{monAnim(field,tpos,[{transform:"translateX(0)"},{transform:`translateX(${tpos==="foe"?28:-28}px)`},{transform:"translateX(0)"}],{duration:420,easing:"ease-out"});label(field,to,"Errou!","miss");},300);return 900;}
        return 420;
      }
      // ataque especial: projétil, raio, raio elétrico…
      let t=480;
      const sp=lk.special;
      if(sp==="bolt"){setTimeout(()=>bolt(l,to,lk),120);t=420;}
      else if(sp==="beam"||sp==="stream"){t=beam(l,from,to,lk,{width:Math.max(16,from.s*(sp==="stream"?.2:.15)),dur:700});if(sp==="stream")for(let i=0;i<6;i++)setTimeout(()=>travel(l,from,to,lk,{size:12,dur:380,shape:"bubble",trail:false}),i*60);}
      else if(sp==="rings"){for(let i=0;i<4;i++)setTimeout(()=>travel(l,from,to,lk,{size:from.s*.5,dur:520,shape:"ringwave",trail:false}),i*90);t=600;}
      else if(sp==="leaves"||sp==="swarm"||sp==="sparkles"||sp==="wisps"){for(let i=0;i<8;i++)setTimeout(()=>travel(l,{x:from.x+R(-20,20),y:from.y+R(-20,20),s:from.s},to,lk,{size:Math.max(12,from.s*R(.1,.17)),dur:520,shape:lk.shape,trail:false}),i*45);t=640;}
      else if(sp==="rocks"){rocks(l,to,lk,6);t=480;}
      else if(sp==="quake"){shake(field,10);setTimeout(()=>shake(field,8),200);t=420;}
      else if(sp==="wind"){for(let i=0;i<4;i++)setTimeout(()=>travel(l,from,to,lk,{size:from.s*.5,dur:420,shape:"wind",trail:false}),i*80);t=560;}
      else if(sp==="slash"){t=200;}
      else t=travel(l,from,to,lk,{size:Math.max(22,from.s*.32),dur:480});
      if(ev.miss){
        setTimeout(()=>{monAnim(field,tpos,[{transform:"translateX(0)"},{transform:`translateX(${tpos==="foe"?28:-28}px)`},{transform:"translateX(0)"}],{duration:420,easing:"ease-out"});label(field,to,"Errou!","miss");},t);
        return t+700;
      }
      return t;
    }
    if(ev.k==="hit"){
      const pos=P(ev.side),at=center(field,pos);
      const lm=lastMove||{lk:LOOK.Normal,cat:"physical"};
      const lk=lm.lk;
      if(ev.immune){label(field,at,"Imune","miss");return 900;}
      const big=ev.crit||ev.mult>=2;
      if(ev.crit)flash(field,"#fff",300);
      else if(ev.mult>=2)flash(field,lk.glow,220);
      if(lm.cat==="physical"&&lk.special==="slash")slashes(l,at,lk,3);
      else if(lm.cat==="physical")impact(l,at,lk,big);
      if(lm.cat!=="physical"&&lk.special==="slash")slashes(l,at,lk,4);
      if(lk.special==="rings")rings(l,at,lk,3,1.6);
      if(lk.tint&&lm.cat!=="physical")tint(field,lk.tint,600);
      burst(l,at,lk,{n:big?24:16,spread:big?1.3:1,size:Math.max(12,at.s*.16)});
      if(lk.frost){const f=el(l,"s-frost",{width:at.s*1.2+"px",height:at.s*1.2+"px"});anim(f,[{transform:`translate(${at.x-at.s*.6}px,${at.y-at.s*.6}px)`,opacity:0},{opacity:.9,offset:.3},{transform:`translate(${at.x-at.s*.6}px,${at.y-at.s*.6}px)`,opacity:0}],{duration:900});}
      if(big)shake(field,ev.crit?9:6);
      if(ev.crit)label(field,at,"Crítico!","crit");
      else if(ev.mult>=2)label(field,at,ev.mult>=4?"Extremamente efetivo!":"Super efetivo!","super");
      else if(ev.mult>0&&ev.mult<1)label(field,at,"Pouco efetivo","weak");
      // o alvo pisca na cor do golpe
      monAnim(field,pos,[{filter:"none"},{filter:`brightness(2.2) drop-shadow(0 0 10px ${lk.glow})`},{filter:"none"},{filter:`brightness(1.8)`},{filter:"none"}],{duration:420});
      return big?1050:900;
    }
    if(ev.k==="heal"){aura(l,center(field,P(ev.side)),look("Grass"));label(field,center(field,P(ev.side)),"+"+ev.amount,"heal");return 800;}
    if(ev.k==="blocked"){const at=center(field,P(ev.side));shield(l,at,LOOK.Water);label(field,at,"Protegido!","weak");return 900;}
    if(ev.k==="faint"){const at=center(field,P(ev.side));burst(l,{...at,y:at.y+at.s*.3},{shape:"dot",colors:["#ffffff","#d0d0d0","#a0a0a0"],glow:"#fff"},{n:16,size:10,dur:900});return 1100;}
    if(ev.k==="stage"&&ev.applied){
      const at=center(field,P(ev.side)),up=ev.applied>0;
      const col=up?["#ff6a3c","#ffb347","#fff0c8"]:["#3c8cff","#7fc3ff","#dff1ff"];
      for(let i=0;i<9;i++){
        const w=at.s*.13,x=at.x+R(-at.s*.38,at.s*.38),a=el(l,"s-arrow"+(up?"":" down"),{width:w+"px",height:w*1.3+"px","--c":col[i%3]});
        const y0=up?at.y+at.s*.35:at.y-at.s*.55,y1=up?at.y-at.s*.6:at.y+at.s*.35;
        anim(a,[{transform:`translate(${x}px,${y0}px)`,opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.75},{transform:`translate(${x}px,${y1}px)`,opacity:0}],{duration:700,delay:i*55,easing:"ease-in-out"});
      }
      monAnim(field,P(ev.side),[{filter:"none"},{filter:`brightness(1.4) drop-shadow(0 0 8px ${up?"#ff8a4d":"#4da3ff"})`},{filter:"none"}],{duration:700});
      label(field,at,`${{atk:"Attack",def:"Defense",spa:"Sp.Atk",spd:"Sp.Def",spe:"Speed",acc:"Precisão",eva:"Evasão"}[ev.stat]||ev.stat} ${ev.applied>0?"+":""}${ev.applied}`,up?"up":"down");
      return 820;
    }
    if(ev.k==="status"&&!ev.fail){
      const at=center(field,P(ev.side));
      const C={psn:"#b65ed8",tox:"#8a2fb0",brn:"#ff6a2c",dbrn:"#c2240e",par:"#f5d22e",slp:"#9aa6c8",frz:"#8fe3ff",cnf:"#ff7ac0"}[ev.st]||"#fff";
      const shape={psn:"bubble",tox:"bubble",brn:"flame",dbrn:"flame",par:"spark",slp:"ring",frz:"shard",cnf:"star"}[ev.st]||"dot";
      burst(l,at,{shape,colors:[C,"#ffffff",C],glow:C,rise:ev.st!=="frz"},{n:16,size:Math.max(10,at.s*.12),dur:800});
      monAnim(field,P(ev.side),[{filter:"none"},{filter:`drop-shadow(0 0 10px ${C}) brightness(1.3)`},{filter:"none"},{filter:`drop-shadow(0 0 10px ${C})`},{filter:"none"}],{duration:800});
      label(field,at,{psn:"Envenenado!",tox:"Toxic!",brn:"Queimado!",dbrn:"Deep Burn!",par:"Paralisado!",slp:"Dormiu!",frz:"Congelado!",cnf:"Confuso!"}[ev.st]||"",ev.st);
      return 900;
    }
    if(ev.k==="sdmg"){
      const at=center(field,P(ev.side));
      const C={psn:"#b65ed8",tox:"#8a2fb0",brn:"#ff6a2c",dbrn:"#c2240e",sand:"#d8b46a",hail:"#bfefff",cnf:"#ff7ac0",recoil:"#ffffff"}[ev.src]||"#fff";
      burst(l,at,{shape:ev.src==="brn"||ev.src==="dbrn"?"flame":ev.src==="hail"?"shard":ev.src==="sand"?"rock":"bubble",colors:[C,"#fff",C],glow:C,rise:true},{n:10,size:Math.max(8,at.s*.1),dur:700});
      monAnim(field,P(ev.side),[{opacity:1},{opacity:.3},{opacity:1},{opacity:.3},{opacity:1}],{duration:500});
      return 800;
    }
    if(ev.k==="cant"){const at=center(field,P(ev.side));label(field,at,{slp:"Zzz…",frz:"Congelado",par:"Paralisado!",flinch:"Hesitou!",cnf:"Confuso!",powder:"Imune"}[ev.reason]||"…","weak");
      if(ev.reason==="slp")for(let i=0;i<3;i++){const z=document.createElement("b");z.className="ar7-p s-label slp";z.textContent="Z";l.appendChild(z);anim(z,[{transform:`translate(${at.x+i*10}px,${at.y-at.s*.3}px) scale(.6)`,opacity:0},{opacity:1,offset:.3},{transform:`translate(${at.x+30+i*14}px,${at.y-at.s*.9}px) scale(1.2)`,opacity:0}],{duration:1100,delay:i*220});}
      return 900;}
    if(ev.k==="statusEnd"){const at=center(field,P(ev.side));burst(l,at,{shape:"star",colors:["#ffffff","#fff4b0"],glow:"#fff"},{n:10,size:10});return 650;}
    if(ev.k==="ability"){
      const pos=P(ev.side);
      const pop=document.createElement("div");pop.className="ar7-p s-abpop "+pos;
      pop.innerHTML=`<small></small><b></b>`;pop.querySelector("small").textContent=ev.mon;pop.querySelector("b").textContent=ev.name;
      l.appendChild(pop);
      anim(pop,[{transform:`translateX(${pos==="foe"?"-110%":"110%"})`,opacity:0},{transform:"translateX(0)",opacity:1,offset:.18},{transform:"translateX(0)",opacity:1,offset:.82},{transform:`translateX(${pos==="foe"?"-110%":"110%"})`,opacity:0}],{duration:1500,easing:"cubic-bezier(.2,.8,.3,1)"});
      return 1100;
    }
    if(ev.k==="weather"&&!ev.end){
      const C={rain:"rgba(60,110,200,.45)",sun:"rgba(255,200,80,.55)",sand:"rgba(200,160,90,.55)",hail:"rgba(200,240,255,.6)"}[ev.kind]||"rgba(255,255,255,.4)";
      flash(field,C,700);return 900;
    }
    if(ev.k==="field"&&!ev.end){
      const at=center(field,P(ev.side));
      for(let i=0;i<14;i++){const sz=R(8,14),p=particle(l,"star",["#ffd23f","#fff2a8","#ffb6d9"][i%3],sz),x=R(0,field.clientWidth);
        anim(p,[{transform:`translate(${x}px,-20px) rotate(0)`,opacity:0},{opacity:1,offset:.2},{transform:`translate(${x+R(-30,30)}px,${field.clientHeight*.8}px) rotate(${R(-200,200)}deg)`,opacity:0}],{duration:1300,delay:i*50});}
      label(field,{...at,y:field.clientHeight*.45},"👑 Campo Real","royal");return 1100;
    }
    if(ev.k==="switch"){const at=center(field,P(ev.side));rings(l,at,{colors:["#ffffff","#ffd23f","#ff5a4d"]},2,1.2);burst(l,at,{shape:"star",colors:["#ffffff","#ffe27a"],glow:"#fff"},{n:10,size:10});return 800;}
    return 0;
  }
  window.hhArenaFx={play,look};
})();
