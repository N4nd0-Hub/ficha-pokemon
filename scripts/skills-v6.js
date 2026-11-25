/* ============================================================
   V6 — Criador de Perícias
   Antes: era preciso abrir "Editar cartão", achar o painel,
   apagar o texto "Nova Perícia" e ajustar tudo num cartão grande.
   Agora: uma janela rápida (também no Dossiê, sem modo de edição)
   com ideias de Perícias por atributo, atributo e grau em botões,
   chance de sucesso ao vivo e "Criar e adicionar outra".
   ============================================================ */
(function(){
  "use strict";
  if(typeof ensureTrainerData!=="function"||typeof TRAINER_ATTRIBUTES==="undefined")return;

  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
  const sfx=n=>window.hhClassicSfx?.[n]?.();
  const ATTRS=TRAINER_ATTRIBUTES;
  const GRADES=TRAINER_SKILL_GRADES;
  const ORDER=["E","D","C","B","A","S"];
  const COLOR={life:"#e85a5a",body:"#f09030",mind:"#4aa0e0",presence:"#e8c030",spirit:"#a070e0"};
  const GRADE_HINT={E:"Ruim: rola 3 e fica o pior",D:"Básico",C:"Treinado",B:"Experiente",A:"Especialista",S:"Mestre"};
  // Ideias de Perícias (o sistema não tem lista fixa; o Mestre aprova).
  const IDEAS={
    life:["Resistência","Fôlego","Tolerância a Venenos","Recuperação Rápida","Suportar Dor"],
    body:["Arremesso de Pokébola","Atletismo","Luta","Escalada","Natação","Furtividade","Acrobacia","Montaria Pokémon","Reflexos"],
    mind:["Conhecimento Pokémon","Medicina Pokémon","Estratégia de Batalha","Investigação","Sobrevivência","Tecnologia","Percepção","Primeiros Socorros"],
    presence:["Lábia","Intimidação","Liderança","Concursos Pokémon","Performance","Negociação","Adestramento","Empatia"],
    spirit:["Comunicação com Pokémon","Sensitividade Paranormal","Ler Aura","Meditação","Vínculo Espiritual","Intuição"]
  };

  const attrValue=k=>Math.max(0,Math.trunc(Number(ensureTrainerData().attributes?.[k]||0)));
  const attrDef=k=>ATTRS.find(a=>a.key===k)||ATTRS[0];
  function odds(target,grade){
    const r=GRADES[grade]||GRADES.D,p=Math.max(0,Math.min(100,target))/100;
    return Math.round((r.worst?Math.pow(p,r.dice):1-Math.pow(1-p,r.dice))*100);
  }

  /* ---------- Janela ---------- */
  let ui=null;
  function open(id=null,preset={}){
    close();
    const t=ensureTrainerData();
    const skill=id?t.skills.find(s=>String(s.id)===String(id)):null;
    if(id&&!skill)return;
    const draft=skill?{name:skill.name,attribute:skill.attribute,grade:skill.grade,note:skill.note||""}:
      {name:"",attribute:preset.attribute||"body",grade:"D",note:""};
    const el=document.createElement("div");
    el.className="sk6-shade";
    el.innerHTML=`<div class="sk6-dialog" role="dialog" aria-modal="true" aria-labelledby="sk6Title">
      <header class="sk6-head"><div><small>PERÍCIAS DO TREINADOR</small><h3 id="sk6Title">${skill?"Editar perícia":"Nova perícia"}</h3></div>
        <button type="button" class="sk6-x" data-sk6="close" aria-label="Fechar">✕</button></header>
      <form class="sk6-body" novalidate>
        <label class="sk6-label" for="sk6Name">1 · Nome</label>
        <input id="sk6Name" class="sk6-input" maxlength="60" autocomplete="off" spellcheck="false" placeholder="Ex.: Arremesso de Pokébola" value="${esc(draft.name)}">
        <p class="sk6-warn" hidden></p>
        <div class="sk6-ideas" aria-label="Ideias de perícias"></div>
        <span class="sk6-label">2 · Atributo usado no teste</span>
        <div class="sk6-attrs" role="radiogroup" aria-label="Atributo">${ATTRS.map(a=>`
          <button type="button" role="radio" class="sk6-attr" data-attr="${a.key}" style="--c:${COLOR[a.key]||"#888"}">
            <i>${esc(a.icon||"")}</i><b>${esc(a.label)}</b><strong>${attrValue(a.key)}</strong></button>`).join("")}</div>
        <span class="sk6-label">3 · Grau</span>
        <div class="sk6-grades" role="radiogroup" aria-label="Grau"></div>
        <div class="sk6-preview" aria-live="polite"></div>
        <label class="sk6-label" for="sk6Note">Especialização (opcional)</label>
        <input id="sk6Note" class="sk6-input" maxlength="200" autocomplete="off" placeholder="Ex.: só com Pokébolas pesadas, em combate…" value="${esc(draft.note)}">
      </form>
      <footer class="sk6-foot">
        ${skill?'<button type="button" class="sk6-btn danger" data-sk6="delete">Excluir</button>':""}
        <span class="sk6-spacer"></span>
        <button type="button" class="sk6-btn" data-sk6="close">Cancelar</button>
        ${skill?"":'<button type="button" class="sk6-btn" data-sk6="again">Criar e adicionar outra</button>'}
        <button type="button" class="sk6-btn primary" data-sk6="save">${skill?"Salvar":"Criar perícia"}</button>
      </footer></div>`;
    document.body.appendChild(el);
    document.body.classList.add("sk6-open");
    ui={el,draft,id:skill?String(skill.id):null,returnFocus:document.activeElement};
    el.addEventListener("click",onClick);
    el.addEventListener("input",onInput);
    el.addEventListener("keydown",onKey);
    el.querySelector("form").addEventListener("submit",e=>{e.preventDefault();save(false);});
    refresh();
    requestAnimationFrame(()=>el.querySelector("#sk6Name").focus());
    sfx("select");
  }
  function close(){
    if(!ui)return;
    const back=ui.returnFocus;ui.el.remove();ui=null;
    document.body.classList.remove("sk6-open");
    if(back&&document.contains(back))back.focus?.({preventScroll:true});
  }
  function duplicate(name){
    const n=norm(name);if(!n)return null;
    return ensureTrainerData().skills.find(s=>norm(s.name)===n&&String(s.id)!==ui.id)||null;
  }
  function refresh(){
    if(!ui)return;
    const {el,draft}=ui;
    el.querySelectorAll(".sk6-attr").forEach(b=>{
      const on=b.dataset.attr===draft.attribute;b.classList.toggle("on",on);b.setAttribute("aria-checked",String(on));
    });
    const target=attrValue(draft.attribute);
    el.querySelector(".sk6-grades").innerHTML=[...ORDER].reverse().map(g=>{
      const r=GRADES[g];
      return `<button type="button" role="radio" class="sk6-grade g-${g}${g===draft.grade?" on":""}" data-grade="${g}" aria-checked="${g===draft.grade}">
        <b>${g}</b><small>${r.dice}d100${r.worst?" pior":""}</small><em>${odds(target,g)}%</em></button>`;
    }).join("");
    const a=attrDef(draft.attribute),r=GRADES[draft.grade]||GRADES.D;
    el.querySelector(".sk6-preview").innerHTML=`<b>${esc(GRADE_HINT[draft.grade]||"")}</b>
      Teste: ${r.dice}d100${r.worst?", fica o pior,":""} contra ${esc(a.label)} ${target} · crítico ≤ ${Math.floor(target/4)} ·
      <strong>${odds(target,draft.grade)}% de chance</strong>`;
    const owned=new Set(ensureTrainerData().skills.filter(s=>String(s.id)!==ui.id).map(s=>norm(s.name)));
    const ideas=(IDEAS[draft.attribute]||[]).filter(n=>!owned.has(norm(n)));
    el.querySelector(".sk6-ideas").innerHTML=ideas.length?`<span>Ideias para ${esc(a.label)}:</span>${ideas.map(n=>
      `<button type="button" class="sk6-idea${norm(n)===norm(draft.name)?" on":""}" data-idea="${esc(n)}">${esc(n)}</button>`).join("")}`:"";
    const dup=duplicate(draft.name),warn=el.querySelector(".sk6-warn");
    warn.hidden=!dup;warn.textContent=dup?`Você já tem “${dup.name}” (${dup.grade}). Para subir o grau, edite a existente.`:"";
  }
  function onClick(e){
    if(e.target===ui.el){close();return;}
    const b=e.target.closest("button");if(!b)return;
    if(b.dataset.attr){ui.draft.attribute=b.dataset.attr;refresh();sfx("type");return;}
    if(b.dataset.grade){ui.draft.grade=b.dataset.grade;refresh();sfx("type");return;}
    if(b.dataset.idea){ui.draft.name=b.dataset.idea;ui.el.querySelector("#sk6Name").value=b.dataset.idea;refresh();return;}
    const act=b.dataset.sk6;
    if(act==="close")close();
    else if(act==="save")save(false);
    else if(act==="again")save(true);
    else if(act==="delete")remove();
  }
  function onInput(e){
    if(e.target.id==="sk6Name"){ui.draft.name=e.target.value;refresh();}
    else if(e.target.id==="sk6Note")ui.draft.note=e.target.value;
  }
  function onKey(e){
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close();return;}
    if(e.key==="Enter"&&e.target.tagName==="INPUT"){e.preventDefault();save(false);return;}
    if(e.key==="Tab"){ // mantém o foco dentro da janela
      const f=[...ui.el.querySelectorAll("button,input")].filter(x=>!x.disabled&&x.offsetParent);
      if(!f.length)return;
      if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f.at(-1).focus();}
      else if(!e.shiftKey&&document.activeElement===f.at(-1)){e.preventDefault();f[0].focus();}
    }
  }
  function toast(msg){if(typeof showToast==="function")showToast(msg);}
  function refreshSheet(){
    if(typeof window.renderTrainerPage==="function")window.renderTrainerPage();
    else{window.renderTrainerSkills?.();window.renderTrainerSummary?.();}
    document.dispatchEvent(new CustomEvent("hh:skillschange"));
    if(typeof saveState==="function")saveState();
  }
  function save(again){
    const d=ui.draft,name=String(d.name||"").trim().replace(/\s+/g," ");
    const input=ui.el.querySelector("#sk6Name");
    if(!name){input.focus();input.classList.add("sk6-shake");setTimeout(()=>input.classList.remove("sk6-shake"),400);toast("Dê um nome para a perícia (ou toque numa ideia).");return;}
    if(duplicate(name)){input.focus();toast("Essa perícia já existe. Edite a que você já tem.");return;}
    const t=ensureTrainerData();
    const data={name,attribute:d.attribute,grade:GRADES[d.grade]?d.grade:"D",note:String(d.note||"").trim()};
    if(ui.id){const s=t.skills.find(x=>String(x.id)===ui.id);if(s)Object.assign(s,data);}
    else t.skills.push({id:typeof uid==="function"?uid():String(Date.now()),...data});
    refreshSheet();sfx("page");
    toast(`${ui.id?"Perícia atualizada":"Perícia criada"}: ${name} [${data.grade}] · ${attrDef(data.attribute).label}`);
    if(again){const attr=d.attribute;open(null,{attribute:attr});}else close();
  }
  function remove(){
    const t=ensureTrainerData(),s=t.skills.find(x=>String(x.id)===ui.id);if(!s)return close();
    if(!confirm(`Excluir a perícia “${s.name}”?`))return;
    t.skills=t.skills.filter(x=>String(x.id)!==ui.id);
    refreshSheet();toast(`Perícia excluída: ${s.name}`);close();
  }

  /* ---------- Atalhos na ficha ---------- */
  // Botão "＋ PERÍCIA" do modo de edição abre a janela em vez de criar "Nova Perícia".
  document.addEventListener("click",e=>{
    const add=e.target.closest("#trainerAddSkillBtn");
    if(add){e.preventDefault();e.stopImmediatePropagation();open();return;}
    const edit=e.target.closest("[data-sk6-edit]");
    if(edit){e.preventDefault();e.stopPropagation();open(edit.dataset.sk6Edit);return;}
    if(e.target.closest("[data-sk6-new]")){e.preventDefault();e.stopPropagation();open();}
  },true);
  const addBtn=document.getElementById("trainerAddSkillBtn");
  if(addBtn)addBtn.textContent="＋ NOVA PERÍCIA";

  // Dossiê: botão de criar e ✎ em cada perícia, sem precisar do modo de edição.
  function decorate(){
    const dossier=document.querySelector(".tc-dossier");if(!dossier)return;
    const block=[...dossier.querySelectorAll(".tcd-block")].find(b=>/per[ií]cias/i.test(b.querySelector("h4")?.textContent||""));
    if(!block)return;
    const h4=block.querySelector("h4");
    if(h4&&!h4.querySelector("[data-sk6-new]")){
      h4.classList.add("sk6-h4");
      h4.insertAdjacentHTML("beforeend",'<button type="button" class="sk6-new" data-sk6-new>＋ Nova perícia</button>');
    }
    const empty=block.querySelector(".tcd-empty");
    if(empty&&!empty.dataset.sk6){empty.dataset.sk6="1";
      empty.innerHTML='Nenhuma perícia ainda. <button type="button" class="sk6-link" data-sk6-new>Criar a primeira perícia</button>';}
    block.querySelectorAll(".tcd-skill").forEach(row=>{
      const roll=row.querySelector("[data-tcd-roll]");
      if(!roll||row.querySelector("[data-sk6-edit]"))return;
      roll.insertAdjacentHTML("beforebegin",`<button type="button" class="tcd-roll sk6-edit" data-sk6-edit="${esc(roll.dataset.tcdRoll)}" title="Editar perícia" aria-label="Editar perícia">✎</button>`);
      row.classList.add("sk6-row");
    });
  }
  const dossierEl=document.querySelector(".tc-dossier");
  if(dossierEl)new MutationObserver(decorate).observe(dossierEl,{childList:true});
  decorate();

  window.hhSkillCreator={open,close};
})();
