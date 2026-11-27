/* ============================================================
   V7 — Aviso de versão nova
   A página guarda o número da versão (<meta name="hh-build">). De tempos
   em tempos (e ao voltar para a aba) ela confere o site: se saiu uma
   versão nova, aparece uma faixa "Nova versão · Atualizar". Assim todo
   mundo da mesa fica na mesma versão (a Arena depende disso para assistir
   descidas, por exemplo). Nunca recarrega sozinha.
   ============================================================ */
(function(){
  "use strict";
  const mine=document.querySelector('meta[name="hh-build"]')?.content||"";
  window.hhBuild=mine;
  if(!mine)return;
  let latest=mine,bar=null,checking=false,last=0;
  async function check(){
    if(checking||Date.now()-last<60000)return;
    checking=true;last=Date.now();
    try{
      const r=await fetch(`./index.html?hhvc=${Date.now()}`,{cache:"no-store"});
      if(r.ok){
        const html=await r.text();
        const m=/<meta name="hh-build" content="([^"]+)"/.exec(html);
        if(m&&m[1]!==mine&&m[1]>mine){latest=m[1];show();}
      }
    }catch(e){}
    checking=false;
  }
  function busy(){return !!(window.hhArena?.battle&&window.hhArena.battle.role!=="spec");}
  function show(){
    if(!bar){
      bar=document.createElement("div");bar.className="upd7-bar";bar.setAttribute("role","status");
      bar.innerHTML=`<span>✨ Saiu uma versão nova da ficha.</span><button type="button" data-upd="go">ATUALIZAR</button><button type="button" data-upd="x" aria-label="Agora não">✕</button>`;
      document.body.appendChild(bar);
      bar.addEventListener("click",async e=>{
        const a=e.target.closest("[data-upd]")?.dataset.upd;if(!a)return;
        if(a==="x"){bar.hidden=true;return;}
        if(busy()&&!confirm("Você está numa batalha/corrida da Arena. Atualizar agora encerra ela. Atualizar mesmo?"))return;
        try{if(typeof flushLocalSave==="function")await flushLocalSave();}catch(err){}
        try{if(typeof saveState==="function")saveState();}catch(err){}
        location.reload();
      });
    }
    bar.hidden=false;
  }
  window.hhUpdate={check,get latest(){return latest;},get outdated(){return latest!==mine;}};
  setTimeout(check,8000);
  setInterval(check,5*60000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")check();});
  window.addEventListener("focus",check);
})();
