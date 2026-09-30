#!/usr/bin/env python3
"""Instala a Página 04 / Miscelânea como menu de opções recolhíveis.

Mantém os IDs usados pelas mecânicas existentes e remove a decoração legada
da Página 04 para que ela use apenas styles/misc-v5.css.
"""
from pathlib import Path

index = Path("index.html")
source = index.read_text(encoding="utf-8")

STYLE_LINK = '<link rel="stylesheet" href="styles/misc-v5.css" />'
SCRIPT_LINK = '<script defer src="scripts/misc-options-v5.js"></script>'

NEW_PAGE = r'''<div class="page misc-page-v5" id="page3">
        <section class="misc-menu-hero" aria-labelledby="miscMenuTitle">
          <div class="misc-menu-copy">
            <span class="misc-menu-kicker">PÁGINA 04 • MENU DO POKÉMON</span>
            <h3 id="miscMenuTitle">Treino & Inventário</h3>
            <p>Gerencie progressão, treinos, itens, Abilities extras e anotações sem sair da ficha.</p>
          </div>
          <div class="misc-menu-status" aria-label="Resumo da página">
            <div><span>PPg</span><b id="miscOverviewPpg">0 / 15</b></div>
            <div><span>Treinos</span><b id="miscOverviewTraining">0</b></div>
            <div><span>Itens</span><b id="miscOverviewItems">0</b></div>
            <div><span>Abilities</span><b id="miscOverviewAbilities">0</b></div>
          </div>
        </section>

        <div class="misc-options-stack">
          <section class="panel misc-option-panel misc-option-training" data-misc-key="training">
            <div class="panel-head">
              <div class="misc-option-heading">
                <span class="misc-option-icon" aria-hidden="true">TR</span>
                <div><h2>Laboratório de Treinamento</h2><span class="eyebrow">Moves • 1 treino ativo por descanso</span></div>
              </div>
              <button class="misc-option-toggle" type="button" aria-label="Minimizar ou expandir Laboratório de Treinamento"><span>−</span><small>RECOLHER</small></button>
            </div>
            <div class="panel-body">
              <div class="misc-training-rules" aria-label="Regras rápidas de treinamento">
                <div class="misc-rule-chip"><b>5 sucessos</b><span>Move aprendido naturalmente.</span></div>
                <div class="misc-rule-chip"><b>10 sucessos</b><span>Ilegal, Egg Move ou TM raro.</span></div>
                <div class="misc-rule-chip"><b>Crítico = +2</b><span>Um crítico vale dois sucessos.</span></div>
              </div>
              <div class="move-auto-tools misc-search-row">
                <input class="input" id="trainingMoveApiLookup" list="officialMoveSuggestions" placeholder="Buscar Move oficial ou exclusivo..." />
                <button class="btn" id="trainingMoveApiLookupBtn">🔎 Preencher Move</button>
              </div>
              <div class="move-auto-status" id="trainingMoveApiLookupStatus"></div>
              <div class="training-form misc-training-form">
                <div class="field training-name"><label>Nome do Move</label><input class="input" id="trainingMoveName" placeholder="Ex.: Flamethrower" /></div>
                <div class="field"><label>Tipo</label><input class="input" id="trainingElementType" placeholder="Ex.: Fire" /></div>
                <div class="field"><label>Categoria</label><select class="input" id="trainingCategory"><option value="Physical">Physical</option><option value="Special">Special</option><option value="Status">Status</option></select></div>
                <div class="field"><label>Power</label><input class="input" id="trainingPower" type="number" min="0" value="0" /></div>
                <div class="field"><label>Accuracy</label><input class="input" id="trainingAccuracy" type="number" min="0" max="90" value="90" /></div>
                <div class="field training-kind"><label>Tipo de Treino</label><select class="input" id="trainingMoveType"><option value="natural">Natural • 5 sucessos</option><option value="rare">Ilegal / Ovo / TM Raro • 10 sucessos</option></select></div>
                <button class="btn primary training-start" id="addTrainingMoveBtn">＋ Iniciar Treino</button>
              </div>
              <div class="move-extra-form misc-training-extra">
                <div class="field"><label>Chance do Efeito (%)</label><input class="input" id="trainingEffectChance" type="number" min="0" max="100" value="0" /></div>
                <div class="field"><label>Descrição / Efeito do Move</label><textarea class="input" id="trainingDescription" placeholder="Ex.: 30% de chance de causar Paralysis..."></textarea></div>
              </div>
              <div class="training-list" id="trainingMovesList"></div>
            </div>
          </section>

          <section class="panel misc-option-panel misc-option-items" data-misc-key="items">
            <div class="panel-head">
              <div class="misc-option-heading">
                <span class="misc-option-icon" aria-hidden="true">IT</span>
                <div><h2>Equipamento & Itens</h2><span class="eyebrow">Item segurado • catálogo • memória</span></div>
              </div>
              <button class="misc-option-toggle" type="button" aria-label="Minimizar ou expandir Equipamento e Itens"><span>−</span><small>RECOLHER</small></button>
            </div>
            <div class="panel-body">
              <div class="misc-item-topline">
                <div class="misc-held-slot">
                  <div class="misc-held-orb" aria-hidden="true">◆</div>
                  <div><label for="heldItemSelect">Item Segurado Atual</label><select class="input" id="heldItemSelect"></select></div>
                </div>
                <div class="official-item-browser">
                  <div class="official-item-browser-head"><div><b>Catálogo de Itens</b><small><span id="pokeApiItemCount">0</span> itens oficiais disponíveis</small></div><span class="official-item-source">POKÉAPI</span></div>
                  <div class="official-item-search-row"><input class="input" id="officialItemLookup" list="pokeApiItemSuggestions" placeholder="Buscar item oficial, ex.: Leftovers..." /><button class="btn" id="officialItemLookupBtn" type="button">🔎 Adicionar</button></div>
                  <div class="move-auto-status official-item-status" id="officialItemLookupStatus">Selecione um item para adicioná-lo à Memória de Itens.</div>
                </div>
              </div>
              <datalist id="pokeApiItemSuggestions"></datalist>
              <details class="misc-create-drawer">
                <summary>Criar item original</summary>
                <div class="misc-create-body">
                  <div class="item-create-grid"><input class="input" id="customItemName" placeholder="Nome do item original" /><button class="btn primary" id="addCustomItemBtn">＋ Adicionar</button></div>
                  <textarea class="input" id="customItemDescription" placeholder="Descrição / efeito do item..." style="margin-top:8px;min-height:76px"></textarea>
                </div>
              </details>
              <div class="section-helper" style="margin:9px 0 0">Itens compatíveis reagem automaticamente a HP, condições, estágios e ao encerramento da rodada.</div>
              <div class="item-memory-list" id="itemMemoryList"></div>
            </div>
          </section>

          <section class="panel misc-option-panel misc-option-abilities" data-misc-key="abilities">
            <div class="panel-head">
              <div class="misc-option-heading">
                <span class="misc-option-icon" aria-hidden="true">AB</span>
                <div><h2>Abilities Extras</h2><span class="eyebrow">Memória • <span id="abilityBankCount">379</span> no compêndio</span></div>
              </div>
              <button class="misc-option-toggle" type="button" aria-label="Minimizar ou expandir Abilities Extras"><span>−</span><small>RECOLHER</small></button>
            </div>
            <div class="panel-body">
              <div class="misc-ability-tools misc-search-row">
                <input class="input" id="abilitySystemLookup" list="systemAbilitySuggestions" placeholder="Buscar Ability, ex.: Adaptability..." />
                <button class="btn" id="abilitySystemLookupBtn">🔎 Preencher Ability</button>
              </div>
              <div class="move-auto-status" id="abilitySystemLookupStatus"></div>
              <datalist id="systemAbilitySuggestions"></datalist>
              <div class="misc-ability-entry">
                <div class="ability-create-grid"><input class="input" id="memoryAbilityName" placeholder="Nome da Ability" /><button class="btn primary" id="addMemoryAbilityBtn">＋ Adicionar</button></div>
                <textarea class="input" id="memoryAbilityDescription" placeholder="Descrição / efeito..."></textarea>
              </div>
              <div class="section-helper" style="margin-top:8px">Use esta área para Abilities secundárias, Hidden Abilities, formas alternativas ou efeitos extras. A Ability principal continua na página Geral.</div>
              <div class="ability-memory-list" id="abilityMemoryList"></div>
            </div>
          </section>

          <section class="panel misc-option-panel misc-option-progress" data-misc-key="progress">
            <div class="panel-head">
              <div class="misc-option-heading">
                <span class="misc-option-icon" aria-hidden="true">PG</span>
                <div><h2>PPg & Progressão</h2><span class="eyebrow">Pontos atuais • histórico por nível</span></div>
              </div>
              <button class="misc-option-toggle" type="button" aria-label="Minimizar ou expandir PPg e Progressão"><span>−</span><small>RECOLHER</small></button>
            </div>
            <div class="panel-body">
              <div class="misc-progress-layout">
                <div class="misc-ppg-card">
                  <div class="misc-ppg-title"><span class="misc-ppg-symbol" aria-hidden="true">PG</span><div><b>Pontos de Progresso</b><small>Reserva atual do Pokémon</small></div></div>
                  <div class="ppg-value-row"><b id="ppgValueLabel">0</b><span>/ 15 PPg</span></div>
                  <input class="ppg-range" id="currentPpg" type="range" min="0" max="15" step="1" value="0" />
                  <div class="ppg-bar"><div class="ppg-fill" id="ppgFill"></div></div>
                  <div class="misc-ppg-actions"><button class="btn small" id="ppgMinusBtn">−1 PPg</button><button class="btn small" id="ppgPlusBtn">＋1 PPg</button></div>
                </div>
                <div class="misc-history-card">
                  <div class="misc-history-title"><b>Histórico de Progressão</b><span id="progressHistoryCount">0 registros</span></div>
                  <div class="section-helper">Cada nível confirmado registra a distribuição aplicada e os ganhos finais após Nature.</div>
                  <div class="progress-history-list" id="progressHistoryList"></div>
                </div>
              </div>
            </div>
          </section>

          <section class="panel misc-option-panel misc-option-notes" data-misc-key="notes">
            <div class="panel-head">
              <div class="misc-option-heading">
                <span class="misc-option-icon" aria-hidden="true">NT</span>
                <div><h2>Anotações do Pokémon</h2><span class="eyebrow">Campanha • evolução • peculiaridades</span></div>
              </div>
              <button class="misc-option-toggle" type="button" aria-label="Minimizar ou expandir Anotações do Pokémon"><span>−</span><small>RECOLHER</small></button>
            </div>
            <div class="panel-body"><textarea class="input notes-area" id="pokemonNotes" placeholder="Personalidade, histórico, peculiaridades, evolução, treinos, informações da campanha..."></textarea></div>
          </section>
        </div>
      </div>

      '''

starts = [
    '<div class="page misc-page-v5" id="page3">',
    '<div class="page" id="page3">'
]
start = -1
for marker in starts:
    start = source.find(marker)
    if start >= 0:
        break
if start < 0:
    raise SystemExit("ERRO: início da Página 04 não encontrado.")

end = source.find('<div class="page" id="page4">', start)
if end < 0:
    raise SystemExit("ERRO: início da Enciclopédia não encontrado.")

source = source[:start] + NEW_PAGE + source[end:]

# A Página 04 tem visual próprio: ela não deve receber section-panel legado.
source = source.replace(
    'document.querySelectorAll("#page1 .panel,#pageTrainer .panel,#page3 .panel")',
    'document.querySelectorAll("#page1 .panel,#pageTrainer .panel")'
)

for old_line in [
    '  "Moves em Treinamento":{className:"section-training",icon:"TR"},\n',
    '  "PPg Atual":{className:"section-ppg",icon:"PG"},\n',
    '  "Histórico de Progressão":{className:"section-history",icon:"HX"},\n',
    '  "Anotações do Pokémon":{className:"section-notes",icon:"NT"},\n',
    '  "Itens":{className:"section-items",icon:"IT"},\n',
    '  "Memória de Abilities":{className:"section-ability-memory",icon:"AB"},\n',
]:
    source = source.replace(old_line, "")

if STYLE_LINK not in source:
    source = source.replace("</head>", "  " + STYLE_LINK + "\n</head>", 1)

if SCRIPT_LINK not in source:
    source = source.replace(STYLE_LINK, STYLE_LINK + "\n  " + SCRIPT_LINK, 1)

critical_ids = [
    "trainingMoveApiLookup","trainingMoveApiLookupBtn","trainingMoveName","trainingElementType",
    "trainingCategory","trainingPower","trainingAccuracy","trainingMoveType","addTrainingMoveBtn",
    "trainingEffectChance","trainingDescription","trainingMovesList","ppgValueLabel","currentPpg",
    "ppgFill","ppgMinusBtn","ppgPlusBtn","progressHistoryCount","progressHistoryList","pokemonNotes",
    "pokeApiItemCount","officialItemLookup","officialItemLookupBtn","officialItemLookupStatus",
    "pokeApiItemSuggestions","heldItemSelect","customItemName","addCustomItemBtn","customItemDescription",
    "itemMemoryList","abilityBankCount","abilitySystemLookup","abilitySystemLookupBtn",
    "abilitySystemLookupStatus","systemAbilitySuggestions","memoryAbilityName","addMemoryAbilityBtn",
    "memoryAbilityDescription","abilityMemoryList","miscOverviewPpg","miscOverviewTraining",
    "miscOverviewItems","miscOverviewAbilities"
]
bad = []
for item_id in critical_ids:
    count = source.count(f'id="{item_id}"')
    if count != 1:
        bad.append(f"{item_id}={count}")

if bad:
    raise SystemExit("ERRO: IDs duplicados/ausentes: " + ", ".join(bad))

checks = {
    "Página 04 nova": 'class="misc-options-stack"' in source,
    "Cinco painéis": source.count('class="panel misc-option-panel') == 5,
    "CSS externo": STYLE_LINK in source,
    "JS externo": SCRIPT_LINK in source,
    "Enciclopédia preservada": '<div class="page" id="page4">' in source,
    "Exportação JSON preservada": 'id="exportBtn"' in source,
    "Importação JSON preservada": 'id="importBtn"' in source,
    "Decoração legada removida da page3": '#pageTrainer .panel,#page3 .panel' not in source,
}
for label, ok in checks.items():
    print(("OK" if ok else "FALHOU") + ": " + label)
if not all(checks.values()):
    raise SystemExit("Falha na validação da Página 04.")

index.write_text(source, encoding="utf-8")
print("Página 04 instalada como menu de opções recolhíveis.")
