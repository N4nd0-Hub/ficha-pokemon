/* ============================================================
   V7 — Evolução na tela principal
   Um card "Evolução" fica embaixo do HP do Pokémon, na página 01:
   mostra a(s) próxima(s) forma(s) com a arte, a condição (nível,
   pedra, felicidade, troca…) e quanto falta. Quando chega a hora, o
   card brilha, a ficha avisa e o Pokémon aparece com 🧬 na Box.
   Evoluir abre uma prévia (antes → depois, atributos novos com os
   pontos investidos já somados) e, ao confirmar:
   • preserva SEMPRE o investimento (pontos acima dos Base Stats),
     nível, golpes, Nature, PPg, felicidade, item e apelido;
   • gasta a pedra/item da Bolsa, se a evolução usa um e você tem;
   • guarda uma cópia da forma anterior para "Desfazer evolução".
   Funciona com Pokémon oficiais (PokéAPI), Fakemon do sistema /
   Pokédex GM e espécies do Banco Local.
   ============================================================ */
(function(){
  "use strict";
  if(typeof state==="undefined")return;
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const cur=()=>{try{return current;}catch(e){return null;}};
  const sfx=n=>{try{window.hhClassicSfx?.[n]?.();}catch(e){}};
  const toast=t=>{try{showToast(t);}catch(e){}};
  const pretty=s=>{try{return prettyName(s);}catch(e){return String(s||"").split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");}};
  const typeBadge=t=>{try{return typeIconHtml(t,true);}catch(e){return `<span class="tag">${esc(t)}</span>`;}};
  const norm=t=>{try{return normalizeTypeName(t)||"";}catch(e){return t||"";}};
  const ART=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  const STATS=[["hp","HP"],["atk","ATK"],["def","DEF"],["spa","SP.ATK"],["spd","SP.DEF"],["spe","SPE"]];
  const save=()=>{try{saveState();}catch(e){try{debouncedSave();}catch(_){}}};

  /* ---------- Descobrir as próximas formas ---------- */
  const LS="hh_evo_cache_v3";
  let disk={};try{disk=JSON.parse(localStorage.getItem(LS)||"{}")||{};}catch(e){disk={};}
  const mem=new Map(),pending=new Map(),lines=new Map();
  const findInt=v=>{try{return v?findIntegratedCustomSpecies(v):null;}catch(e){return null;}};
  function keyOf(p){
    const a=p?.apiData||{};
    if(a.integratedSpeciesId&&findInt(a.integratedSpeciesId))return "int:"+a.integratedSpeciesId;
    if(a.source==="PokeAPI"||/PokéAPI/.test(a.source||"")&&a.pokemonId||a.pokemonId&&a.speciesName)return "api:"+String(a.speciesName||a.pokemonName||p.dex||p.name||"").toLowerCase();
    const sp=findInt(a.speciesName)||findInt(p.name);
    if(sp)return "int:"+sp.id;
    try{const loc=findLocalSpecies(p.name);if(loc?.nextEvolution?.name)return "loc:"+String(p.name).toLowerCase();}catch(e){}
    if(p.nextEvolution?.name)return "nx:"+String(p.nextEvolution.name).toLowerCase();
    return "";
  }
  /* Opções síncronas (do cache ou de bancos locais). null = ainda buscando. */
  function optionsOf(p){
    const k=keyOf(p);if(!k)return [];
    if(k.startsWith("int:"))return integratedOptions(k.slice(4));
    if(k.startsWith("loc:"))return localOptions(p);
    if(k.startsWith("nx:")){const t=findInt(p.nextEvolution.name);if(t)return [intOption(t,p.nextEvolution.level,p.nextEvolution.method||"")];}
    if(mem.has(k))return mem.get(k);
    if(disk[k]&&Date.now()-(disk[k].at||0)<14*864e5){mem.set(k,disk[k].list);if(disk[k].line)lines.set(k,disk[k].line);return disk[k].list;}
    if(pending.has(k))return null;
    const job=k.startsWith("nx:")?nextByName(p.nextEvolution):officialOptions(k.slice(4));
    if(!pending.has(k))pending.set(k,job.then(res=>{
      const list=Array.isArray(res)?res:res.list,line=Array.isArray(res)?null:res.line;
      mem.set(k,list);if(line)lines.set(k,line);disk[k]={at:Date.now(),list,line};
      try{localStorage.setItem(LS,JSON.stringify(disk));}catch(e){}
      pending.delete(k);refresh(true);document.dispatchEvent(new CustomEvent("hh:evoline"));
    }).catch(()=>{pending.delete(k);mem.set(k,[]);}));
    return null;
  }
  async function officialOptions(ref){
    const slug=String(ref).trim().toLowerCase().replace(/\s+/g,"-");
    const sp=await (await fetch(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(slug)}/`)).json();
    if(!sp.evolution_chain?.url)return [];
    const chain=await (await fetch(sp.evolution_chain.url)).json();
    const find=(n)=>{if(!n)return null;if(n.species?.name===sp.name)return n;for(const c of n.evolves_to||[]){const f=find(c);if(f)return f;}return null;};
    const node=find(chain.chain);if(!node)return [];
    // linha: tem forma anterior? é a última? em que nível vem a forma final?
    // amizade conta como evolução cedo (Riolu → Lucario ~Lv 30)
    const stepLv=c=>{const ds=c.evolution_details||[];const d=ds.find(x=>x.min_level)||{};return d.min_level||(ds.some(x=>x.min_happiness)?30:null);};
    const finalLv=n=>{let best=null;for(const c of n.evolves_to||[]){const v=(c.evolves_to||[]).length?finalLv(c):stepLv(c);if(v!=null&&(best==null||v>best))best=v;}return best;};
    const line={hasPrev:node!==chain.chain,isFinal:!(node.evolves_to||[]).length,finalLevel:finalLv(node)};
    const list=(node.evolves_to||[]).map(c=>{
      const id=Number(String(c.species?.url||"").match(/\/(\d+)\/?$/)?.[1]||0);
      const ds=c.evolution_details||[];
      const d=ds.find(x=>x.trigger?.name==="level-up"&&x.min_level)||ds[0]||{};
      let detail="";try{detail=formatEvolutionDetails([d]);}catch(e){}
      return {source:"official",name:pretty(c.species?.name||""),apiName:c.species?.name||"",speciesId:id,img:id?ART(id):"",
        level:d.min_level||null,happiness:d.min_happiness||null,item:d.item?.name||d.held_item?.name||"",trade:d.trigger?.name==="trade",detail};
    }).filter(o=>o.apiName);
    return {list:splitForms(list),line};
  }
  /* Evoluções que viram formas diferentes da mesma espécie (a PokéAPI lista
     só a espécie): cada forma vira uma opção própria para escolher. */
  const FORM_SPLIT={
    lycanroc:[{api:"lycanroc-midday",id:745,name:"Lycanroc (Dia)",detail:"Lv. 25 · de dia"},{api:"lycanroc-midnight",id:10126,name:"Lycanroc (Noite)",detail:"Lv. 25 · de noite"},{api:"lycanroc-dusk",id:10152,name:"Lycanroc (Crepúsculo)",detail:"Lv. 25 · ao entardecer, com Own Tempo"}],
    toxtricity:[{api:"toxtricity-amped",id:849,name:"Toxtricity (Amped)",detail:"Lv. 30 · natureza agitada"},{api:"toxtricity-low-key",id:10184,name:"Toxtricity (Low Key)",detail:"Lv. 30 · natureza calma"}],
    urshifu:[{api:"urshifu-single-strike",id:892,name:"Urshifu (Golpe Único)",detail:"Pergaminho das Trevas"},{api:"urshifu-rapid-strike",id:10191,name:"Urshifu (Golpe Fluido)",detail:"Pergaminho das Águas"}]
  };
  function splitForms(list){
    const out=[];
    for(const o of list){
      const forms=FORM_SPLIT[o.apiName];
      if(!forms){out.push(o);continue;}
      forms.forEach(f=>out.push({...o,name:f.name,apiName:f.api,speciesId:f.id,img:ART(f.id),detail:f.detail,form:true}));
    }
    return out;
  }
  /* "Evolução Futura" da Importação Rápida apontando para uma espécie oficial */
  async function nextByName(nx){
    const slug=String(nx.name).trim().toLowerCase().replace(/\s+/g,"-");
    const sp=await (await fetch(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(slug)}/`)).json();
    const level=nx.level==null||nx.level===""?null:Number(nx.level);
    return [{source:"official",name:pretty(sp.name),apiName:sp.name,speciesId:sp.id,img:ART(sp.id),level,happiness:null,item:"",trade:false,detail:level?`Lv. ${level}`:(nx.method||"")}];
  }
  const lvOf=ev=>{const n=Number(ev?.level);if(n>0)return n;const m=/(?:n[ií]vel|lv\.?|level)\s*(\d+)/i.exec(String(ev?.requirements||""));return m?Number(m[1]):null;};
  function intOption(t,level,detail){
    let img="";try{img=resolveAssetUrl(t.image?.dataUrl)||"";}catch(e){}
    return {source:"integrated",name:t.name,species:t,img,level:level==null||level===""?null:Number(level),detail:detail||(level?`Lv. ${level}`:"Evolução registrada"),
      types:t.types||[],baseStats:t.baseStats||{},ability:t.ability?.name||""};
  }
  function integratedOptions(id){
    const sp=findInt(id);if(!sp)return [];
    const ev=sp.evolution||{};
    // formato do sistema: evolvesTo [{id,name,level}]
    if(Array.isArray(ev.evolvesTo)&&ev.evolvesTo.length&&typeof ev.evolvesTo[0]==="object"){
      return ev.evolvesTo.map(n=>{const t=findInt(n.id||n.name);return t?intOption(t,n.level,ev.method):null;}).filter(Boolean);
    }
    // formato da Pokédex GM: nextIds + level/requirements
    const targets=[];
    (ev.nextIds||[]).forEach(x=>{const t=findInt("gm-"+x)||findInt(x);if(t)targets.push(t);});
    if(!targets.length)String(ev.next||"").split(/\s*(?:→|->|;|,|\||\/)\s*/).filter(Boolean).forEach(n=>{const t=findInt(n);if(t)targets.push(t);});
    return targets.map(t=>{
      const tev=t.evolution||{};
      // O GM às vezes grava no alvo o requisito para chegar nele, às vezes na
      // origem o requisito para sair dela. Se o valor do alvo repete o do
      // próximo estágio dele, é "de saída" e vale o da origem.
      let level=lvOf(tev),req=String(tev.requirements||"").trim();
      const tnext=(tev.nextIds||[]).map(x=>findInt("gm-"+x)).find(Boolean);
      const tnextLv=tnext?lvOf(tnext.evolution):null;
      if(level==null&&!req||(level!=null&&tnextLv!=null&&level===tnextLv)){level=lvOf(ev);req=String(ev.requirements||"").trim();}
      const textReq=req&&!/^(?:n[ií]vel|lv\.?|level)\s*\d+$/i.test(req)?req:"";
      const o=intOption(t,level,textReq||(level?`Lv. ${level}`:"Evolução registrada"));
      if(textReq&&level==null)o.special=textReq;
      return o;
    });
  }
  /* Linha evolutiva da espécie (para o custo de PPg por nível) */
  function lineOf(p){
    const k=keyOf(p);
    if(!k)return {hasPrev:false,isFinal:true,finalLevel:null,known:true};
    if(k.startsWith("int:")){
      const sp=findInt(k.slice(4));const ev=sp?.evolution||{};
      const hasPrev=!!(ev.previousId||ev.previous||ev.evolvesFrom);
      const walk=(id,depth)=>{const opts=integratedOptions(id);if(!opts.length||depth>4)return null;let best=null;
        for(const o of opts){const sub=walk(o.species.id,depth+1);const v=sub!=null?sub:o.level;if(v!=null&&(best==null||v>best))best=v;}return best;};
      const opts=integratedOptions(k.slice(4));
      return {hasPrev,isFinal:!opts.length,finalLevel:walk(k.slice(4),0),known:true};
    }
    if(k.startsWith("loc:")||k.startsWith("nx:")){
      const opts=optionsOf(p)||[];
      let hasPrev=false;try{hasPrev=(state.speciesBank||[]).some(s=>String(s.nextEvolution?.name||"").toLowerCase()===String(p.name).toLowerCase());}catch(e){}
      return {hasPrev,isFinal:!opts.length,finalLevel:opts.reduce((a,o)=>o.level!=null&&(a==null||o.level>a)?o.level:a,null),known:true};
    }
    optionsOf(p);
    return lines.get(k)||null;
  }
  function localOptions(p){
    let tpl=null,tgt=null;try{tpl=findLocalSpecies(p.name);tgt=tpl?.nextEvolution?.name?findLocalSpecies(tpl.nextEvolution.name):null;}catch(e){}
    if(!tgt)return [];
    const level=tpl.nextEvolution.level==null?null:Number(tpl.nextEvolution.level);
    return [{source:"local",name:tgt.name,template:tgt,img:tgt.imageUrl||"",level,detail:level?`Lv. ${level}`:"Banco Local",
      types:[tgt.type1,tgt.type2].filter(Boolean),baseStats:tgt.baseStats||{},ability:tgt.abilityName||""}];
  }

  /* ---------- Pronto para evoluir? ---------- */
  function bagHas(slug){try{return slug&&bagQuantity(slug)>0;}catch(e){return false;}}
  function statusOf(p,o){
    const lv=Number(p.level||1);
    if(o.level&&lv<o.level){
      const prevLv=Math.max(1,o.level-10);
      return {ready:false,kind:"level",label:`Falta${o.level-lv>1?"m":""} ${o.level-lv} nível${o.level-lv>1?"s":""}`,pct:Math.max(4,Math.min(100,Math.round(100*(lv-prevLv)/(o.level-prevLv))))};
    }
    if(o.happiness&&Number(p.happiness||0)<o.happiness)return {ready:false,kind:"happy",label:`Felicidade ${Number(p.happiness||0)}/${o.happiness}`,pct:Math.round(100*Number(p.happiness||0)/o.happiness),soft:true};
    if(o.item&&!bagHas(o.item))return {ready:false,kind:"item",label:`Precisa de ${pretty(o.item)} na Bolsa`,soft:true};
    if(o.item)return {ready:true,kind:"item",label:`${pretty(o.item)} na Bolsa ✓`};
    if(o.trade)return {ready:false,kind:"trade",label:"Evolui por troca: evolua quando o Mestre liberar",soft:true};
    if(o.special)return {ready:false,kind:"special",label:"Condição especial: evolua quando o Mestre liberar",soft:true};
    return {ready:true,kind:"level",label:o.level?"Nível alcançado!":"Pronto para evoluir"};
  }
  function readyOptions(p){
    if(p?.gimmicks?.mega?.active)return [];
    const list=optionsOf(p);
    return (list||[]).filter(o=>statusOf(p,o).ready);
  }

  /* ---------- Card na tela principal ---------- */
  let card=null;
  function ensureCard(){
    if(card&&document.body.contains(card))return card;
    const hp=document.querySelector("#sumScreen .sum-hpbox");
    if(!hp)return null;
    card=document.createElement("section");
    card.className="evo7-card";card.id="evo7Card";card.setAttribute("aria-label","Evolução");
    hp.insertAdjacentElement("afterend",card);
    return card;
  }
  function render(){
    const p=cur();const c=ensureCard();if(!c||!p)return;
    const hist=(p.evolutionHistory||[]).slice(-1)[0];
    const undo=hist?`<button type="button" class="evo7-undo" data-evo="undo" title="Volta para ${esc(hist.fromName)} como estava antes de evoluir">↩ Desfazer evolução (${esc(hist.fromName)})</button>`:"";
    if(p.gimmicks?.mega?.active){c.className="evo7-card muted";c.innerHTML=`<header><b>🧬 EVOLUÇÃO</b><small>Mega ativa</small></header><p class="evo7-note">Reverta a Mega Evolução para ver a linha evolutiva.</p>${undo}`;return;}
    const list=optionsOf(p);
    if(list===null){c.className="evo7-card muted";c.innerHTML=`<header><b>🧬 EVOLUÇÃO</b><small>buscando…</small></header>${undo}`;return;}
    if(!list.length){c.className="evo7-card muted final";c.innerHTML=`<header><b>🧬 EVOLUÇÃO</b><small>${keyOf(p)?"forma final":"sem linha registrada"}</small></header>${undo}`;return;}
    const anyReady=list.some(o=>statusOf(p,o).ready);
    c.className="evo7-card"+(anyReady?" ready":"");
    const img=(()=>{try{return displayPokemonImage(p)||"";}catch(e){return "";}})();
    c.innerHTML=`<header><b>🧬 EVOLUÇÃO</b><small>${anyReady?"PRONTO PARA EVOLUIR!":list.length>1?`${list.length} caminhos`:"próxima forma"}</small></header>
      <ul>${list.map((o,i)=>{const st=statusOf(p,o);return `<li class="${st.ready?"ok":""}">
        <span class="evo7-pair"><span class="evo7-face">${img?`<img src="${esc(img)}" alt="" loading="lazy">`:"◓"}</span><i>➜</i><span class="evo7-face next">${o.img?`<img src="${esc(p.shiny&&o.speciesId?o.img.replace("/official-artwork/","/official-artwork/shiny/"):o.img)}" alt="${esc(o.name)}" loading="lazy">`:"?"}</span></span>
        <span class="evo7-info"><b>${esc(o.name)}</b><small>${esc(o.detail||"")}</small>
          ${st.kind==="level"&&!st.ready||st.kind==="happy"?`<span class="evo7-bar" title="${esc(st.label)}"><i style="width:${st.pct||0}%"></i></span>`:""}
          <em class="${st.ready?"go":st.soft?"soft":""}">${esc(st.label)}</em></span>
        <button type="button" class="evo7-btn${st.ready?" go":""}" data-evo="open" data-i="${i}">${st.ready?"EVOLUIR":"VER"}</button>
      </li>`;}).join("")}</ul>${list.length>1?`<button type="button" class="evo7-btn evo7-cmp${anyReady?" go":""}" data-evo="choose">🧬 Comparar os ${list.length} caminhos</button>`:""}${undo}`;
  }

  /* ---------- Aviso quando fica pronto ---------- */
  function notify(){
    const p=cur();if(!p)return;
    const ready=readyOptions(p);if(!ready.length)return;
    p.evoAlerted=Array.isArray(p.evoAlerted)?p.evoAlerted:[];
    const fresh=ready.filter(o=>!p.evoAlerted.includes(`${o.name}@${Number(p.level||1)>=Number(o.level||0)?"lv":"x"}`));
    if(!fresh.length)return;
    fresh.forEach(o=>p.evoAlerted.push(`${o.name}@${Number(p.level||1)>=Number(o.level||0)?"lv":"x"}`));
    p.evoAlerted=p.evoAlerted.slice(-12);
    // espera o aviso de "subiu de nível" passar antes de avisar a evolução
    setTimeout(()=>{
      toast(`🧬 ${p.name} pode evoluir para ${fresh.map(o=>o.name).join(" ou ")}! Veja o card Evolução embaixo do HP.`);
      sfx("page");
      card?.classList.add("evo7-ping");setTimeout(()=>card?.classList.remove("evo7-ping"),2400);
    },1800);
    try{debouncedSave();}catch(e){}
  }

  /* Box: 🧬 em quem já pode evoluir */
  if(typeof window.renderDrawerCard==="function"&&!window.renderDrawerCard.__evo){
    const orig=window.renderDrawerCard;
    window.renderDrawerCard=function(p){
      const el=orig.apply(this,arguments);
      try{
        if(el&&readyOptions(p).length){
          el.classList.add("evo7-can");
          const row=el.querySelector(".pokemon-card-name-row");
          row?.insertAdjacentHTML("beforeend",`<span class="evo7-tag" title="Pode evoluir">🧬</span>`);
        }
      }catch(e){}
      return el;
    };
    window.renderDrawerCard.__evo=true;
  }

  let lastDrawer=0;
  function refresh(fromFetch){
    render();
    if(!fromFetch)notify();
    if(fromFetch&&Date.now()-lastDrawer>1500){lastDrawer=Date.now();try{renderDrawer();}catch(e){}}
  }
  document.addEventListener("hh:render",()=>refresh(false));
  document.addEventListener("hh:pokemonchange",()=>refresh(false));
  // busca as linhas de todo mundo uma vez (para os 🧬 da Box)
  setTimeout(()=>{(state.pokemon||[]).forEach(p=>optionsOf(p));render();},1500);

  /* ---------- Prévia e confirmação ---------- */
  let modal=null,open_=null;
  async function targetData(o){
    if(o.source!=="official")return {types:(o.types||[]).map(norm).filter(Boolean),baseStats:o.baseStats||{},ability:o.ability||""};
    const d=await (await fetch(`https://pokeapi.co/api/v2/pokemon/${o.speciesId||o.apiName}/`)).json();
    const base={};(d.stats||[]).forEach(x=>{const m={hp:"hp",attack:"atk",defense:"def","special-attack":"spa","special-defense":"spd",speed:"spe"}[x.stat.name];if(m)base[m]=x.base_stat;});
    let rework=null;try{rework=findPokemonRework(d.name)||findPokemonRework(d.id);}catch(e){}
    const ab=(d.abilities||[]).sort((a,b)=>a.slot-b.slot).find(x=>!x.is_hidden)||d.abilities?.[0];
    let abName=ab?.ability?.name||"";try{abName=officialAbilityEnglishName(abName)||abName;}catch(e){}
    return {types:rework?rework.types:(d.types||[]).map(x=>norm(pretty(x.type.name))),baseStats:rework?rework.baseStats:base,ability:rework?rework.abilityName:abName};
  }
  /* ---------- Escolha entre vários caminhos (split evolution) ---------- */
  const tdCache=new Map();
  function tdOf(o){
    const k=o.speciesId||o.apiName||o.name;
    if(tdCache.has(k))return tdCache.get(k);
    tdCache.set(k,null);
    targetData(o).then(t=>{tdCache.set(k,t);if(modal?.classList.contains("open")&&modal.dataset.view==="choose")openChooser(Number(modal.dataset.sel||0));}).catch(()=>{});
    return null;
  }
  function ensureModal(){
    if(modal)return;
    modal=document.createElement("div");modal.className="evo7-modal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");document.body.appendChild(modal);
    modal.addEventListener("click",e=>{
      if(e.target===modal||e.target.closest("[data-evo=close]"))closePreview();
      else if(e.target.closest("[data-evo=go]"))confirmEvolve();
      else if(e.target.closest("[data-evo=back]"))openChooser(Number(modal.dataset.sel||0));
      else{const c=e.target.closest("[data-evo=pick]");if(c)openPreview(Number(c.dataset.i),{fromChooser:true});
        const h=e.target.closest("[data-evo=hl]");if(h&&!c){modal.dataset.sel=h.dataset.i;modal.querySelectorAll(".evo7-path").forEach(x=>x.classList.toggle("sel",x===h));}}
    });
  }
  function openChooser(sel=0){
    const p=cur();const list=optionsOf(p)||[];if(!list.length)return;
    ensureModal();open_=null;
    modal.dataset.view="choose";modal.dataset.sel=String(sel);
    const img=(()=>{try{return displayPokemonImage(p)||"";}catch(e){return "";}})();
    const max=Math.max(1,...list.map(o=>{const t=tdOf(o);return t?Math.max(...STATS.map(([k])=>Number(t.baseStats[k]||0))):1;}),150);
    const cards=list.map((o,i)=>{
      const st=statusOf(p,o),t=tdOf(o);
      const bst=t?STATS.reduce((a,[k])=>a+Number(t.baseStats[k]||0),0):0;
      return `<article class="evo7-path${i===sel?" sel":""}${st.ready?" ok":""}" data-evo="hl" data-i="${i}" tabindex="0">
        <div class="evo7-path-art">${o.img?`<img src="${esc(o.img)}" alt="${esc(o.name)}" loading="lazy">`:"◓"}</div>
        <b class="evo7-path-name">${esc(o.name)}</b>
        <span class="evo7-path-types">${t?t.types.map(typeBadge).join(" "):'<i class="evo7-dots">…</i>'}</span>
        <small class="evo7-path-cond">${esc(o.detail||"")}</small>
        ${t?`<div class="evo7-mini">${STATS.map(([k,l])=>{const v=Number(t.baseStats[k]||0);return `<span title="${l} ${v}"><em>${l.replace("SP.","S")}</em><i style="width:${Math.round(100*v/max)}%"></i><b>${v}</b></span>`;}).join("")}<span class="tot"><em>TOTAL</em><b>${bst}</b></span></div>`:`<div class="evo7-mini wait">Carregando atributos…</div>`}
        ${t&&t.ability?`<small class="evo7-path-ab">Ability: <b>${esc(t.ability)}</b></small>`:""}
        <em class="evo7-path-st ${st.ready?"go":st.soft?"soft":""}">${esc(st.label)}</em>
        <button type="button" class="evo7-btn${st.ready?" go":""}" data-evo="pick" data-i="${i}">${st.ready?"Escolher":"Ver prévia"}</button>
      </article>`;}).join("");
    modal.innerHTML=`<div class="evo7-box evo7-choose"><header><b>🧬 Escolha a evolução</b><button type="button" class="evo7-x" data-evo="close" aria-label="Fechar">✕</button></header>
      <div class="evo7-from">${img?`<img src="${esc(img)}" alt="">`:""}<div><b>${esc(p.name)}</b><small>tem <b>${list.length}</b> caminhos de evolução. Compare e escolha um.</small></div></div>
      <div class="evo7-paths" style="--n:${Math.min(list.length,4)}">${cards}</div>
      <p class="evo7-note">A condição de cada caminho (horário, item, felicidade…) é decidida na mesa: escolha a que o Mestre liberou.</p></div>`;
    modal.classList.add("open");
  }
  async function openPreview(i,{fromChooser=false}={}){
    const p=cur();const list=optionsOf(p)||[];const o=list[i];if(!o)return;
    if(list.length>1&&!fromChooser){openChooser(i);sfx("select");return;}
    ensureModal();modal.dataset.view="preview";modal.dataset.sel=String(i);
    const st=statusOf(p,o);
    open_={o,pid:p.id};
    const img=(()=>{try{return displayPokemonImage(p)||"";}catch(e){return "";}})();
    const box=(body)=>`<div class="evo7-box"><header><b>🧬 Evolução</b><button type="button" class="evo7-x" data-evo="close" aria-label="Fechar">✕</button></header>${body}</div>`;
    modal.innerHTML=box(`<div class="evo7-stage"><span>${img?`<img src="${esc(img)}" alt="">`:""}<b>${esc(p.name)}</b></span><i>➜</i><span class="next">${o.img?`<img src="${esc(o.img)}" alt="">`:""}<b>${esc(o.name)}</b></span></div><p class="evo7-note">Carregando os atributos de ${esc(o.name)}…</p>`);
    modal.classList.add("open");sfx("select");
    let t;try{t=await targetData(o);}catch(e){t=null;}
    if(!open_||open_.o!==o)return;
    const oldBase=p.baseStats||{},oldStats=p.stats||{};
    const inv=k=>Math.max(0,Number(oldStats[k]||0)-Number(oldBase[k]||0));
    const rows=t?STATS.map(([k,l])=>{const nb=Number(t.baseStats[k]||0),ob=Number(oldBase[k]||0),tot=nb+inv(k),now=Number(oldStats[k]||0);const d=tot-now;
      return `<tr><th>${l}</th><td>${ob} ➜ <b>${nb}</b></td><td>+${inv(k)}</td><td><b>${tot}</b> <small class="${d>0?"up":d<0?"down":""}">${d>0?"+":""}${d||""}</small></td></tr>`;}).join(""):"";
    const nick=isNick(p);
    const itemNote=o.item?(bagHas(o.item)?`Gasta 1 ${esc(pretty(o.item))} da Bolsa.`:`Você não tem ${esc(pretty(o.item))} na Bolsa: evolui mesmo assim se o Mestre liberou.`):"";
    modal.innerHTML=box(`
      <div class="evo7-stage"><span>${img?`<img src="${esc(img)}" alt="">`:""}<b>${esc(p.name)}</b><small>${[p.type1,p.type2].filter(Boolean).map(x=>typeBadge(norm(x))).join(" ")}</small></span>
        <i>➜</i><span class="next">${o.img?`<img src="${esc(o.img)}" alt="">`:""}<b>${esc(nick?`${p.name} (${o.name})`:o.name)}</b><small>${t?t.types.map(typeBadge).join(" "):""}</small></span></div>
      <p class="evo7-cond ${st.ready?"go":""}">${esc(o.detail||"")}${o.detail?" · ":""}${esc(st.label)}</p>
      ${t?`<table class="evo7-table"><thead><tr><th></th><th>Base</th><th>Investido</th><th>Novo total</th></tr></thead><tbody>${rows}</tbody></table>
      ${t.ability&&t.ability!==p.abilityName?`<p class="evo7-note">Ability: <b>${esc(p.abilityName||"—")}</b> ➜ <b>${esc(t.ability)}</b></p>`:""}`:`<p class="evo7-note">Não consegui carregar a prévia dos atributos, mas dá para evoluir assim mesmo.</p>`}
      <ul class="evo7-keep"><li>✓ Pontos investidos mantidos</li><li>✓ Nível, golpes e Nature</li><li>✓ PPg, felicidade e item</li>${nick?`<li>✓ Apelido "${esc(p.name)}"</li>`:""}<li>✓ Dá para desfazer depois</li></ul>
      ${itemNote?`<p class="evo7-note">${itemNote}</p>`:""}
      <div class="evo7-acts">${list.length>1?`<button type="button" class="evo7-btn" data-evo="back">← Outros caminhos</button>`:`<button type="button" class="evo7-btn" data-evo="close">AGORA NÃO</button>`}
        <button type="button" class="evo7-btn go evo7-go" data-evo="go" ${!st.ready&&st.kind==="level"?"disabled":""}>${!st.ready&&st.kind==="level"?`Requer Lv. ${o.level}`:"🧬 Evoluir!"}</button></div>`);
  }
  function closePreview(){modal?.classList.remove("open");open_=null;}
  /* Apelido: o nome atual não é o nome da espécie */
  function isNick(p){
    const a=p.apiData||{};const n=String(p.name||"").trim().toLowerCase();
    const cands=[a.pokemonName,a.speciesName,p.name&&a.source==="IntegratedCustomSpecies"?(()=>{try{return findIntegratedCustomSpecies(a.integratedSpeciesId)?.name;}catch(e){return "";}})():""]
      .filter(Boolean).map(x=>pretty(x).toLowerCase());
    if(!cands.length)return false;
    return !!n&&!cands.includes(n)&&!cands.some(c=>c.replace(/-/g," ")===n);
  }

  let busy=false;
  async function confirmEvolve(){
    if(busy||!open_)return;
    const p=cur();if(!p||p.id!==open_.pid){closePreview();return;}
    const o=open_.o;const st=statusOf(p,o);
    if(!st.ready&&st.kind==="level")return;
    busy=true;
    const btn=modal.querySelector("[data-evo=go]");if(btn){btn.disabled=true;btn.textContent="Evoluindo…";}
    const snap=JSON.parse(JSON.stringify(p));delete snap.evolutionHistory;
    const fromName=p.name,nick=isNick(p),beforeKey=JSON.stringify([p.apiData?.pokemonId,p.apiData?.integratedSpeciesId,p.baseStats]);
    try{
      if(o.source==="official"){
        const a=document.getElementById("preserveInvestedStats"),b=document.getElementById("syncCurrentStats");
        if(a)a.checked=true;if(b)b.checked=false;
        await searchPokemonFromApi(String(o.speciesId||o.apiName),{official:true});
      }else if(o.source==="integrated"){
        applyIntegratedCustomSpecies(o.species,{preserveInvested:true,syncCurrent:false,fromEvolution:true});
      }else applyLocalEvolution(o.template);
    }catch(e){console.error(e);}
    const q=cur();
    const changed=JSON.stringify([q.apiData?.pokemonId,q.apiData?.integratedSpeciesId,q.baseStats])!==beforeKey;
    busy=false;
    if(!changed||q.id!==snap.id){toast("Não foi possível evoluir agora. Confira a internet e tente de novo.");if(btn){btn.disabled=false;btn.textContent="🧬 Evoluir!";}return;}
    if(nick)q.name=fromName;
    if(o.item&&bagHas(o.item)){try{setBagQuantity(o.item,bagQuantity(o.item)-1,{render:false,save:false});}catch(e){}}
    q.evolutionHistory=[...(q.evolutionHistory||[]),{at:Date.now(),fromName,toName:o.name,snap}].slice(-1);
    q.evoAlerted=[];
    try{renderAll();}catch(e){}
    save();
    closePreview();
    celebrate(fromName,q.name===fromName?o.name:q.name);
  }
  function celebrate(from,to){
    sfx("page");
    const stage=document.querySelector("#sumScreen .sum-stage");
    if(stage){stage.classList.remove("evo7-evolve");void stage.offsetWidth;stage.classList.add("evo7-evolve");setTimeout(()=>stage.classList.remove("evo7-evolve"),2200);}
    toast(`✨ ${from} evoluiu para ${to}! Investimento, golpes e progresso mantidos.`);
  }
  function undo(){
    const p=cur();const h=(p?.evolutionHistory||[]).slice(-1)[0];if(!h)return;
    if(!confirm(`Desfazer a evolução e voltar para ${h.fromName}? O nível, HP e golpes voltam a como estavam antes de evoluir.`))return;
    const id=p.id,rest=(p.evolutionHistory||[]).slice(0,-1);
    Object.keys(p).forEach(k=>{delete p[k];});
    Object.assign(p,JSON.parse(JSON.stringify(h.snap)),{id,evolutionHistory:rest});
    p.evoAlerted=[...(p.evoAlerted||[])];
    try{renderAll();}catch(e){}
    save();toast(`↩ ${p.name} voltou à forma anterior.`);
  }

  document.addEventListener("click",e=>{
    const b=e.target.closest("#evo7Card [data-evo]");if(!b)return;
    if(b.dataset.evo==="open")openPreview(Number(b.dataset.i));
    else if(b.dataset.evo==="choose"){openChooser(0);sfx("select");}
    else if(b.dataset.evo==="undo")undo();
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal?.classList.contains("open"))closePreview();});

  window.hhEvolution={optionsOf,statusOf,readyOptions,openPreview,refresh,lineOf};
  if(document.readyState!=="loading")setTimeout(()=>refresh(false),0);
})();
