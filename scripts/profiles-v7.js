/* ============================================================
   V7 — Fichas de jogador (vários treinadores no mesmo navegador)
   A ficha aberta continua no save normal. As outras ficam guardadas
   num banco local separado (IndexedDB "pokemon_hh_profiles"), com:
   • "meta": nome, treinador, jogador, time em miniatura, data;
   • "state": a ficha completa, com as artes.
   Trocar de ficha = salvar a atual no banco e abrir a escolhida no
   save normal. Nada sai do navegador.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;
  const DB="pokemon_hh_profiles",VER=1;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const PX=(n,sz)=>window.hhArenaPix?window.hhArenaPix.svg(n,sz):"";
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const typeColor=t=>{try{return moveTypePalette(t).main;}catch(e){return "#8a90a0";}};
  const toast=t=>{try{showToast(t);}catch(e){}};
  const newId=()=>"pf"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  /* ---------- Banco ---------- */
  let dbp=null;
  function db(){
    if(dbp)return dbp;
    dbp=new Promise((ok,ko)=>{
      const r=indexedDB.open(DB,VER);
      r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains("meta"))d.createObjectStore("meta",{keyPath:"id"});if(!d.objectStoreNames.contains("state"))d.createObjectStore("state",{keyPath:"id"});};
      r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);
    });
    return dbp;
  }
  async function tx(stores,mode,fn){
    const d=await db();
    return new Promise((ok,ko)=>{
      const t=d.transaction(stores,mode);let out;
      t.oncomplete=()=>ok(out);t.onerror=()=>ko(t.error);t.onabort=()=>ko(t.error);
      out=fn(...stores.map(s=>t.objectStore(s)));
    });
  }
  const req=r=>new Promise((ok,ko)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);});
  async function listMeta(){const d=await db();return req(d.transaction("meta").objectStore("meta").getAll());}
  async function getState(id){const d=await db();const r=await req(d.transaction("state").objectStore("state").get(id));return r?.data||null;}
  async function putProfile(meta,data){await tx(["meta","state"],"readwrite",(m,s)=>{m.put(meta);s.put({id:meta.id,data});});}
  async function delProfile(id){await tx(["meta","state"],"readwrite",(m,s)=>{m.delete(id);s.delete(id);});}

  /* ---------- Resumo de uma ficha (para os cartões) ---------- */
  async function thumb(src,max=72){
    if(!src)return "";
    if(!/^data:/.test(src))return src;
    try{
      const img=new Image();await new Promise((ok,ko)=>{img.onload=ok;img.onerror=ko;img.src=src;});
      const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);return c.toDataURL("image/webp",.82);
    }catch(e){return "";}
  }
  function imgOf(p){try{return displayPokemonImage(p)||"";}catch(e){return p?.image||p?.imageUrl||"";}}
  async function summarize(s,id){
    const team=(s.pokemon||[]).filter(p=>(p.storageGroup||"team")==="team").slice(0,6);
    const t=s.trainer||{};
    return {id,label:String(s.profileName||"").slice(0,40),trainer:String(t.name||"Treinador").slice(0,40),player:String(t.player||"").slice(0,40),
      money:Number(t.money||0),badges:Array.isArray(t.badges)?t.badges.filter(b=>b&&(b.earned||b.obtained||b.have)).length:0,
      pokemonCount:(s.pokemon||[]).length,theme:s.theme||"",
      team:await Promise.all(team.map(async p=>({n:String(p.name||"?").slice(0,30),lv:Number(p.level||1),t:p.type1||"",img:await thumb(imgOf(p))}))),
      updatedAt:Date.now()};
  }
  function activeId(){
    if(!state.profileId){state.profileId=newId();try{queueLocalSave();}catch(e){}}
    return state.profileId;
  }
  async function snapshotActive(){
    const id=activeId();
    const data=JSON.parse(JSON.stringify(state));
    await putProfile(await summarize(data,id),data);
    return id;
  }

  /* ---------- Tela ---------- */
  const root=document.createElement("section");
  root.id="hhProfiles";root.className="ar7 pf7";root.hidden=true;root.setAttribute("aria-label","Fichas de jogador");
  document.body.appendChild(root);
  let metas=[],busy="",form=null;
  async function open(){
    root.hidden=false;document.body.classList.add("ar7-open");sfx("page");
    busy="Carregando fichas…";render();
    try{try{await flushLocalSave();}catch(e){}await snapshotActive();metas=await listMeta();}
    catch(e){console.error(e);toast("Não consegui abrir o banco de fichas deste navegador.");}
    busy="";render();
    try{navigator.storage?.persist?.();}catch(e){}
  }
  function close(){root.hidden=true;document.body.classList.remove("ar7-open");form=null;}
  window.hhProfiles={open,close};

  const ago=ts=>{const s=Math.round((Date.now()-ts)/1000);if(s<60)return "agora";const m=Math.round(s/60);if(m<60)return `há ${m} min`;const h=Math.round(m/60);if(h<24)return `há ${h} h`;const d=Math.round(h/24);return d<30?`há ${d} dia${d>1?"s":""}`:new Date(ts).toLocaleDateString("pt-BR");};
  const money=v=>{try{return "₽ "+Number(v||0).toLocaleString("pt-BR",{maximumFractionDigits:2});}catch(e){return "₽ "+v;}};

  function card(m){
    const isActive=m.id===state.profileId;
    const lead=m.team?.[0];
    return `<article class="pf7-card ar8-frame${isActive?" active":""}" data-id="${esc(m.id)}">
      <header class="pf7-card-head" style="--t:${typeColor(lead?.t)}">
        <span class="ar8-avatar">${lead?.img?`<img src="${esc(lead.img)}" alt="">`:PX("ball",44)}</span>
        <div class="pf7-names">
          ${m.label?`<small class="pf7-label">${esc(m.label)}</small>`:`<small class="pf7-label">Ficha de treinador</small>`}
          <b>${esc(m.trainer)}</b>
          <span>${m.player?`Jogador: <strong>${esc(m.player)}</strong>`:"Jogador não informado"}</span>
        </div>
        ${isActive?`<span class="pf7-badge">● Em uso</span>`:""}
      </header>
      <div class="pf7-party">${Array.from({length:6},(_,i)=>{const p=m.team?.[i];return p?`<span class="ar8-slot" title="${esc(p.n)} • Lv. ${p.lv}" style="--t:${typeColor(p.t)}">${p.img?`<img src="${esc(p.img)}" alt="${esc(p.n)}">`:`<i>${esc(p.n.slice(0,1))}</i>`}<small>Lv${p.lv}</small></span>`:`<span class="ar8-slot empty">${PX("ball",18)}</span>`;}).join("")}</div>
      <dl class="pf7-stats"><div><dt>Pokémon</dt><dd>${m.pokemonCount}</dd></div><div><dt>Dinheiro</dt><dd>${money(m.money)}</dd></div><div><dt>Atualizada</dt><dd>${isActive?"agora":ago(m.updatedAt)}</dd></div></dl>
      <div class="pf7-actions">
        ${isActive?`<button type="button" class="ar7-btn primary" data-pf="close">✓ Continuar nesta</button>`:`<button type="button" class="ar7-btn primary" data-pf="switch">▶ Abrir ficha</button>`}
        <button type="button" class="ar7-btn" data-pf="rename" title="Dar um nome para a ficha">✎</button>
        <button type="button" class="ar7-btn" data-pf="dup" title="Duplicar">⧉</button>
        <button type="button" class="ar7-btn" data-pf="export" title="Baixar JSON">⭳</button>
        ${isActive?"":`<button type="button" class="ar7-btn danger" data-pf="delete" title="Apagar">🗑</button>`}
      </div>
      ${form?.type==="rename"&&form.id===m.id?`<form class="pf7-form" data-pf-form="rename"><label>Nome da ficha<input id="pf7Label" maxlength="40" value="${esc(m.label)}" placeholder="Ex.: Campanha de Kanto"></label><div><button type="button" class="ar7-btn" data-pf="cancel">Cancelar</button><button type="submit" class="ar7-btn primary">Salvar</button></div></form>`:""}
    </article>`;
  }
  function render(){
    if(root.hidden)return;
    const sorted=metas.slice().sort((a,b)=>(b.id===state.profileId)-(a.id===state.profileId)||b.updatedAt-a.updatedAt);
    root.innerHTML=`<div class="ar7-shell">
      <header class="ar7-top">
        <button type="button" class="ar7-back" data-pf="close" aria-label="Voltar para a ficha">← Ficha</button>
        <div class="ar7-title"><b>${PX("people",18)} Fichas de jogador</b><small>${metas.length} ficha${metas.length===1?"":"s"} neste navegador</small></div>
        <button type="button" class="ar7-share" data-pf="new">＋ Nova ficha</button>
      </header>
      <div class="pf7-body">
        <section class="ar8-sec pf7-intro"><h3>${PX("people",22)} Seus treinadores</h3>
          <p class="ar8-sub">Cada ficha é um treinador completo (Pokémon, mochila, insígnias e artes). Abra uma para jogar; as outras ficam guardadas neste navegador. Para levar a outro aparelho, baixe o JSON (⭳).</p>
          <div class="pf7-toolbar">
            <button type="button" class="ar7-btn primary" data-pf="new">＋ Nova ficha em branco</button>
            <button type="button" class="ar7-btn" data-pf="import">⭱ Importar JSON como nova ficha</button>
            <input type="file" id="pf7Import" accept=".json,application/json" hidden>
          </div>
          ${form?.type==="new"?`<form class="pf7-form" data-pf-form="new"><label>Nome do treinador<input id="pf7Trainer" maxlength="40" placeholder="Ex.: Virgil" required></label><label>Jogador<input id="pf7Player" maxlength="40" placeholder="Ex.: Elias"></label><div><button type="button" class="ar7-btn" data-pf="cancel">Cancelar</button><button type="submit" class="ar7-btn primary">Criar e abrir</button></div></form>`:""}
        </section>
        ${busy?`<div class="ar7-card ar7-empty"><b>${esc(busy)}</b></div>`:`<div class="pf7-grid">${sorted.map(card).join("")||""}</div>`}
      </div>
      <p class="ar7-toast" role="status" hidden></p>
    </div>`;
    const f=root.querySelector("#pf7Trainer,#pf7Label");if(f)f.focus();
  }

  /* ---------- Ações ---------- */
  async function switchTo(id){
    if(id===state.profileId){close();return;}
    busy="Abrindo ficha…";render();
    try{
      if(!await flushLocalSave({reason:"Antes de trocar de ficha"}))throw new Error("Guarde ou recupere o save atual antes de trocar. Nada foi alterado.");
      await snapshotActive();
      const data=await getState(id);
      if(!data||!validSavedState(data))throw new Error("Esta ficha está vazia ou danificada.");
      data.profileId=id;
      applyRestoredLocalState(normalizeLocalSavedState(data));
      await flushLocalSave({reason:"Troca de ficha"});
      metas=await listMeta();busy="";close();
      toast(`✓ Ficha de ${state.trainer?.name||"treinador"} aberta.`);sfx("page");
    }catch(e){console.error(e);busy="";render();alert(e.message||"Não consegui abrir esta ficha.");}
  }
  async function createNew(trainer,player){
    const data=JSON.parse(JSON.stringify(defaultData));
    const id=newId();data.profileId=id;data.trainer={...(data.trainer||{}),name:trainer||"Treinador",player:player||""};
    const norm=normalizeLocalSavedState(data);
    await putProfile(await summarize(norm,id),norm);
    metas=await listMeta();form=null;
    await switchTo(id);
  }
  async function duplicate(id){
    const data=id===state.profileId?JSON.parse(JSON.stringify(state)):await getState(id);
    if(!data)return;
    const nid=newId();data.profileId=nid;data.profileName=((data.profileName||data.trainer?.name||"Ficha")+" (cópia)").slice(0,40);
    await putProfile(await summarize(data,nid),data);metas=await listMeta();render();toast("✓ Ficha duplicada.");
  }
  async function rename(id,label){
    label=String(label||"").trim().slice(0,40);
    if(id===state.profileId){state.profileName=label;try{await flushLocalSave();}catch(e){}await snapshotActive();}
    else{const data=await getState(id);if(!data)return;data.profileName=label;await putProfile(await summarize(data,id),data);}
    metas=await listMeta();form=null;render();
  }
  async function remove(id){
    const m=metas.find(x=>x.id===id);if(!m||id===state.profileId)return;
    if(!confirm(`Apagar a ficha de ${m.trainer}${m.label?` (${m.label})`:""}?\n\nIsso apaga os Pokémon e as artes dela deste navegador e não dá para desfazer. Se quiser guardar, baixe o JSON antes.`))return;
    await delProfile(id);metas=await listMeta();render();toast("Ficha apagada.");
  }
  async function exportOne(id){
    if(id===state.profileId){try{await exportAll();}catch(e){}return;}
    const data=await getState(id);if(!data)return;
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    let name="pokemon-ficha";try{name=portableTrainerExportFileName(data).replace(/\.json$/,"");}catch(e){}
    a.download=name+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),120000);
    toast("✓ JSON baixado.");
  }
  async function importNew(file){
    try{
      const parsed=JSON.parse(await file.text());
      if(!validSavedState(parsed))throw new Error("O JSON não contém fichas Pokémon válidas.");
      const data=normalizeLocalSavedState(parsed);
      const id=newId();data.profileId=id;
      await putProfile(await summarize(data,id),data);
      metas=await listMeta();render();
      toast(`✓ Ficha de ${data.trainer?.name||"treinador"} importada. Toque em "Abrir ficha" para usar.`);
    }catch(e){alert(e.message||"Arquivo JSON inválido.");}
  }

  root.addEventListener("click",e=>{
    const b=e.target.closest("[data-pf]");if(!b)return;
    const a=b.dataset.pf,id=b.closest("[data-id]")?.dataset.id;
    if(a==="close")close();
    else if(a==="switch")switchTo(id);
    else if(a==="new"){form={type:"new"};render();root.querySelector(".pf7-intro")?.scrollIntoView({behavior:"smooth",block:"start"});}
    else if(a==="cancel"){form=null;render();}
    else if(a==="rename"){form={type:"rename",id};render();}
    else if(a==="dup")duplicate(id);
    else if(a==="export")exportOne(id);
    else if(a==="delete")remove(id);
    else if(a==="import")root.querySelector("#pf7Import")?.click();
  });
  root.addEventListener("change",e=>{if(e.target.id==="pf7Import"&&e.target.files?.[0]){importNew(e.target.files[0]);e.target.value="";}});
  root.addEventListener("submit",e=>{
    const f=e.target.closest("[data-pf-form]");if(!f)return;e.preventDefault();
    if(f.dataset.pfForm==="new")createNew(root.querySelector("#pf7Trainer")?.value.trim(),root.querySelector("#pf7Player")?.value.trim());
    else rename(f.closest("[data-id]").dataset.id,root.querySelector("#pf7Label")?.value);
  });
  root.addEventListener("keydown",e=>{if(e.key==="Escape"){if(form){form=null;render();}else close();}});

  /* Botão no topo, ao lado da Arena */
  function mountButton(){
    if(document.getElementById("hhProfilesBtn"))return;
    const html=`<button type="button" id="hhProfilesBtn" class="pf7-open-btn" title="Fichas de jogador: vários treinadores" aria-label="Fichas de jogador">${PX("people",18)||"👥"}<span>Fichas</span></button>`;
    const arena=document.getElementById("hhArenaBtn");
    if(arena)arena.insertAdjacentHTML("afterend",html);
    else document.querySelector(".topbar .brand")?.insertAdjacentHTML("afterend",html);
    document.getElementById("hhProfilesBtn").addEventListener("click",open);
  }
  // o botão da Arena muda de lugar no celular/computador; seguimos ele
  const place=()=>{const btn=document.getElementById("hhProfilesBtn"),arena=document.getElementById("hhArenaBtn");if(btn&&arena&&arena.nextElementSibling!==btn)arena.after(btn);};
  mountButton();
  try{matchMedia("(min-width:901px)").addEventListener("change",()=>setTimeout(place,0));}catch(e){}
  setTimeout(place,50);
})();
