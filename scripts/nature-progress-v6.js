/* ============================================================
   V6 — Nature & Progressão reorganizada
   Reaproveita todos os campos originais (mesmos IDs e eventos) e só
   muda a organização:
     1. Nature: seletor + chips de bônus/penalidade.
     2. "Como ele cresce": botões Automático (padrão) / Manual.
        Só aparece o conteúdo do modo escolhido.
     3. Subir de nível: os botões de treino.
     4. Regras e relatório num bloco recolhido.
   ============================================================ */
(function(){
  "use strict";
  const panel=[...document.querySelectorAll("section.panel")].find(p=>p.querySelector(":scope > .panel-head h2")?.textContent.trim()==="Nature & Progressão");
  const body=panel?.querySelector(":scope > .panel-body");
  const toggle=document.getElementById("autoProgression");
  if(!panel||!body||!toggle||body.querySelector(".np-wrap"))return;

  const $=id=>document.getElementById(id);
  const natureGrid=body.querySelector(".nature-grid");
  const manual=$("manualPresetSection");
  const summary=body.querySelector(".progress-summary");
  const autoRow=body.querySelector(".progression-auto-row");
  const autoPanel=$("autoPriorityPanel");
  const limit=$("progressLimitNotice");
  const note=$("progressionModeNote");
  const training=body.querySelector(".level-training-console");
  const report=body.querySelector(".progress-report-wrap");
  const oldDrawer=body.querySelector(".nature-progress-drawer");

  const wrap=document.createElement("div");
  wrap.className="np-wrap";
  wrap.innerHTML=`
    <section class="np-step np-nature"><header><span class="np-num">1</span><div><b>Nature</b><small>Dá +1 ponto extra num atributo e −1 em outro sempre que ele recebe pontos.</small></div></header><div class="np-slot" data-slot="nature"></div></section>
    <section class="np-step np-mode"><header><span class="np-num">2</span><div><b>Como ele cresce</b><small>Escolha quem decide onde vão os 6 pontos de cada nível.</small></div></header>
      <div class="np-switch" role="radiogroup" aria-label="Modo de progressão">
        <button type="button" role="radio" data-np-mode="auto"><i>⚙</i><b>Automático <em>recomendado</em></b><small>Você só define a ordem de prioridade; os pontos são distribuídos sozinhos.</small></button>
        <button type="button" role="radio" data-np-mode="manual"><i>✋</i><b>Manual</b><small>Você escolhe os 6 pontos de cada nível (até +3 por atributo).</small></button>
      </div>
      <div class="np-slot" data-slot="auto"></div>
      <div class="np-slot" data-slot="manual"></div>
    </section>
    <section class="np-step np-level"><header><span class="np-num">3</span><div><b>Subir de nível</b><small>Aplica os pontos, a Nature e os limites de uma vez.</small></div></header><div class="np-slot" data-slot="level"></div></section>
    <details class="np-rules"><summary><span>📖</span><b>Regras e relatório</b><small>Limite por dezena, como cada modo funciona e o histórico</small><i>⌄</i></summary><div class="np-slot" data-slot="rules"></div></details>`;
  const slot=k=>wrap.querySelector(`[data-slot="${k}"]`);

  if(natureGrid)slot("nature").appendChild(natureGrid);
  if(autoPanel){slot("auto").insertAdjacentHTML("beforeend",`<p class="np-hint"><b>Como funciona:</b> a 1ª prioridade recebe até +3 por nível, o que sobrar vai para a 2ª, e assim por diante. Quem chegar a +20 na dezena é pulado até a próxima.</p>`);slot("auto").appendChild(autoPanel);}
  slot("manual").insertAdjacentHTML("beforeend",`<p class="np-hint"><b>Como funciona:</b> distribua 6 pontos (até +3 por atributo). Eles são aplicados a cada nível que o Pokémon subir.</p>`);
  if(manual)slot("manual").appendChild(manual);
  if(summary)slot("manual").appendChild(summary);
  if(training)slot("level").appendChild(training);
  [limit,note,report].forEach(n=>n&&slot("rules").appendChild(n));
  if(autoRow){autoRow.hidden=true;autoRow.classList.add("np-hidden-toggle");slot("rules").appendChild(autoRow);}
  body.prepend(wrap);
  if(oldDrawer&&!oldDrawer.querySelector("*:not(summary):not(summary *)"))oldDrawer.remove();
  else if(oldDrawer)oldDrawer.remove();
  panel.classList.add("np-panel");

  // texto do subtítulo do painel
  const eyebrow=panel.querySelector(":scope > .panel-head .eyebrow");

  function sync(){
    const auto=!!toggle.checked;
    wrap.dataset.mode=auto?"auto":"manual";
    wrap.querySelectorAll("[data-np-mode]").forEach(b=>{const on=(b.dataset.npMode==="auto")===auto;b.classList.toggle("on",on);b.setAttribute("aria-checked",String(on));});
    if(eyebrow)eyebrow.textContent=auto?"Modo automático":"Modo manual";
    // Nature: chips com o atributo favorecido/prejudicado
    const plus=$("naturePositiveDisplay")?.textContent.trim(),minus=$("natureNegativeDisplay")?.textContent.trim();
    wrap.querySelector(".np-nature")?.classList.toggle("neutral",!plus||plus==="Nenhum");
  }
  wrap.addEventListener("click",e=>{
    const b=e.target.closest("[data-np-mode]");if(!b)return;
    const want=b.dataset.npMode==="auto";
    if(toggle.checked===want)return;
    toggle.checked=want;
    toggle.dispatchEvent(new Event("change",{bubbles:true}));
    sync();window.hhClassicSfx?.select?.();
  });
  toggle.addEventListener("change",sync);
  const orig=window.renderNatureProgression;
  if(typeof orig==="function")window.renderNatureProgression=function(){const r=orig.apply(this,arguments);try{sync();}catch(e){}return r;};
  sync();
})();
