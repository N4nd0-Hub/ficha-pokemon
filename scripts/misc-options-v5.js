(function(){
  "use strict";

  const STORAGE_KEY="pokemon_hh_v5_misc_options_ui";

  const PANEL_CONFIGS=[
    {selector:".misc-training-hub",key:"training",label:"Laboratório de Treinamento"},
    {selector:".misc-items-hub",key:"items",label:"Equipamento & Itens"},
    {selector:".misc-abilities-hub",key:"abilities",label:"Abilities Extras"},
    {selector:".misc-history-hub",key:"history",label:"Histórico de Progressão"},
    {selector:".misc-notes-hub",key:"notes",label:"Anotações do Pokémon"}
  ];

  function readState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
      return parsed&&typeof parsed==="object"?parsed:{};
    }catch(error){return {};}
  }

  function writeState(value){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value||{}));}catch(error){}
  }

  function stripLegacyDecoration(page){
    page.querySelectorAll(".section-panel").forEach(function(panel){
      panel.classList.remove(
        "section-panel","section-training","section-ppg","section-history",
        "section-notes","section-items","section-ability-memory"
      );
      panel.removeAttribute("data-page-decorated");
      const head=panel.querySelector(":scope > .panel-head");
      if(head)head.removeAttribute("data-section-icon");
    });
  }

  function addToggle(panel,key,label){
    const head=panel.querySelector(":scope > .panel-head");
    const body=panel.querySelector(":scope > .panel-body");
    if(!head||!body)return;

    panel.classList.add("misc-option-panel");
    panel.dataset.miscKey=key;

    let button=head.querySelector(".misc-option-toggle");
    if(!button){
      button=document.createElement("button");
      button.type="button";
      button.className="misc-option-toggle";
      button.setAttribute("aria-label","Minimizar ou expandir "+label);
      head.appendChild(button);
    }

    const apply=function(collapsed){
      panel.classList.toggle("collapsed",collapsed);
      body.hidden=collapsed;
      button.setAttribute("aria-expanded",String(!collapsed));
      button.innerHTML=collapsed
        ? "<span>＋</span><small>EXPANDIR</small>"
        : "<span>−</span><small>RECOLHER</small>";
    };

    const stored=readState();
    apply(!!stored[key]);

    if(button.dataset.miscCollapseBound==="true")return;
    button.dataset.miscCollapseBound="true";

    button.addEventListener("click",function(event){
      event.preventDefault();
      event.stopPropagation();
      const next=!panel.classList.contains("collapsed");
      const state=readState();
      state[key]=next;
      writeState(state);
      apply(next);
    });
  }

  function buildProgressPanel(page,stack){
    const existing=page.querySelector(".misc-option-progress");
    if(existing)return existing;

    const consoleNode=page.querySelector(":scope > .misc-ppg-console");
    if(!consoleNode)return null;

    const panel=document.createElement("section");
    panel.className="panel misc-option-panel misc-option-progress";
    panel.dataset.miscKey="progress";

    const head=document.createElement("div");
    head.className="panel-head";
    head.innerHTML=
      '<div class="misc-panel-head-main">'+
        '<span class="misc-panel-icon" aria-hidden="true">PG</span>'+
        '<div class="misc-panel-head-copy"><h2>PPg & Progressão</h2><span class="eyebrow">Pontos atuais do Pokémon</span></div>'+
      '</div>';

    const body=document.createElement("div");
    body.className="panel-body";
    body.appendChild(consoleNode);

    panel.appendChild(head);
    panel.appendChild(body);
    stack.appendChild(panel);
    addToggle(panel,"progress","PPg & Progressão");
    return panel;
  }

  function initialize(){
    const page=document.getElementById("page3");
    if(!page||page.dataset.miscOptionsReady==="true")return;

    stripLegacyDecoration(page);

    let stack=page.querySelector(".misc-command-grid, .misc-options-stack");
    if(!stack)return;

    stack.classList.remove("misc-command-grid");
    stack.classList.add("misc-options-stack");

    const panels={};
    PANEL_CONFIGS.forEach(function(config){
      const panel=page.querySelector(config.selector);
      if(!panel)return;
      panels[config.key]=panel;
      addToggle(panel,config.key,config.label);
    });

    const progress=buildProgressPanel(page,stack);

    ["training","items","abilities"].forEach(function(key){
      if(panels[key])stack.appendChild(panels[key]);
    });
    if(progress)stack.appendChild(progress);
    ["history","notes"].forEach(function(key){
      if(panels[key])stack.appendChild(panels[key]);
    });

    page.dataset.miscOptionsReady="true";
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",initialize,{once:true});
  }else{
    initialize();
  }
})();