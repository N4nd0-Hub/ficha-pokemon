#!/usr/bin/env python3
"""Repagina a Página 04 (Miscelânea) da ficha Pokémon V5.0.

Mantém todos os IDs usados pelo JavaScript para não alterar as mecânicas.
A operação é idempotente e injeta apenas a folha externa styles/misc-v5.css.
"""
from pathlib import Path

index = Path("index.html")
source = index.read_text(encoding="utf-8")

START = '<div class="page" id="page3">'
END = '<div class="page" id="page4">'
STYLE_LINK = '<link rel="stylesheet" href="styles/misc-v5.css" />'
SCRIPT_LINK = '<script defer src="scripts/misc-options-v5.js"></script>'
MARKER = 'class="page misc-page-v5" id="page3"'

new_page = r'''<div class="page misc-page-v5" id="page3">

        <section class="misc-game-hero" aria-labelledby="miscTitle">
          <div class="misc-hero-main">
            <div class="misc-hero-icon" aria-hidden="true">▤</div>
            <div>
              <span class="misc-hero-kicker">PÁGINA 04 • CENTRO DE APOIO</span>
              <h3 id="miscTitle">Treino & Inventário</h3>
              <p class="misc-hero-sub">Gerencie os treinos do Pokémon, PPg, equipamento, Abilities extras, histórico de progressão e anotações em um único painel.</p>
            </div>
          </div>
          <div class="misc-hero-dashboard" aria-label="Resumo da página">
            <div class="misc-overview-chip"><span>PPg</span><b id="miscOverviewPpg">0 / 15</b></div>
            <div class="misc-overview-chip"><span>TREINOS</span><b id="miscOverviewTraining">0</b></div>
            <div class="misc-overview-chip"><span>ITENS</span><b id="miscOverviewItems">0</b></div>
            <div class="misc-overview-chip"><span>ABILITIES</span><b id="miscOverviewAbilities">0</b></div>
          </div>
        </section>

        <section class="misc-ppg-console" aria-labelledby="miscPpgTitle">
          <div class="misc-ppg-title">
            <div class="misc-ppg-symbol" aria-hidden="true">PG</div>
            <div><b id="miscPpgTitle">Pontos de Progresso</b><small>RESERVA ATUAL DO POKÉMON</small></div>
          </div>
          <div class="misc-ppg-meter">
            <div class="ppg-value-row"><b id="ppgValueLabel">0</b><span>/ 15 PPg</span></div>
            <input class="ppg-range" id="currentPpg" type="range" min="0" max="15" step="1" value="0" />
            <div class="ppg-bar"><div class="ppg-fill" id="ppgFill"></div></div>
          </div>
          <div class="misc-ppg-actions">
            <button class="btn small" id="ppgMinusBtn">−1 PPg</button>
            <button class="btn small" id="ppgPlusBtn">＋1 PPg</button>
          </div>
        </section>

        <div class="misc-command-grid">
          <section class="panel misc-panel misc-training-hub">
            <div class="panel-head">
              <div class="misc-panel-head-main"><span class="misc-panel-icon" aria-hidden="true">TR</span><div class="misc-panel-head-copy">
                <h2>Laboratório de Treinamento</h2><span class="eyebrow">Moves • 1 treino ativo por descanso</span>
              </div></div>
            </div>
            <div class="panel-body">
              <div class="misc-training-rules" aria-label="Regras rápidas de treinamento">
                <div class="misc-rule-chip"><b>5 sucessos</b><span>Move aprendido naturalmente.</span></div>
                <div class="misc-rule-chip"><b>10 sucessos</b><span>Ilegal, Egg Move ou TM raro.</span></div>
                <div class="misc-rule-chip"><b>Crítico = +2</b><span>Um crítico vale dois sucessos.</span></div>
              </div>
              <div class="move-auto-tools">
                <input class="input" id="trainingMoveApiLookup" list="officialMoveSuggestions" placeholder="Buscar Move oficial ou exclusivo..." />
                <button class="btn" id="trainingMoveApiLookupBtn">🔎 Preencher Move</button>
              </div>
              <div class="move-auto-status" id="trainingMoveApiLookupStatus"></div>
              <div class="training-form">
                <div class="field training-name"><label>Nome do Move</label><input class="input" id="trainingMoveName" placeholder="Ex.: Flamethrower" /></div>
                <div class="field"><label>Tipo</label><input class="input" id="trainingElementType" placeholder="Ex.: Fire" /></div>
                <div class="field"><label>Categoria</label><select class="input" id="trainingCategory"><option value="Physical">Physical</option><option value="Special">Special</option><option value="Status">Status</option></select></div>
                <div class="field"><label>Power</label><input class="input" id="trainingPower" type="number" min="0" value="0" /></div>
                <div class="field"><label>Accuracy</label><input class="input" id="trainingAccuracy" type="number" min="0" max="90" value="90" /></div>
                <div class="field"><label>Tipo de Treino</label><select class="input" id="trainingMoveType"><option value="natural">Natural • 5 sucessos</option><option value="rare">Ilegal / Ovo / TM Raro • 10 sucessos</option></select></div>
                <button class="btn primary training-start" id="addTrainingMoveBtn">＋ Iniciar Treino</button>
              </div>
              <div class="move-extra-form">
                <div class="field"><label>Chance do Efeito (%)</label><input class="input" id="trainingEffectChance" type="number" min="0" max="100" value="0" /></div>
                <div class="field"><label>Descrição / Efeito do Move</label><textarea class="input" id="trainingDescription" placeholder="Ex.: 30% de chance de causar Paralysis..."></textarea></div>
              </div>
              <div class="training-list" id="trainingMovesList"></div>
            </div>
          </section>

          <section class="panel misc-panel misc-items-hub">
            <div class="panel-head">
              <div class="misc-panel-head-main"><span class="misc-panel-icon" aria-hidden="true">IT</span><div class="misc-panel-head-copy">
                <h2>Equipamento & Itens</h2><span class="eyebrow">Item segurado • catálogo • memória</span>
              </div></div>
            </div>
            <div class="panel-body">
              <div class="misc-held-slot">
                <div class="misc-held-orb" aria-hidden="true">◆</div>
                <div><label for="heldItemSelect">Item Segurado Atual</label><select class="input" id="heldItemSelect"></select></div>
              </div>
              <div class="official-item-browser">
                <div class="official-item-browser-head"><div><b>Catálogo de Itens</b><small><span id="pokeApiItemCount">0</span> itens oficiais disponíveis</small></div><span class="official-item-source">POKÉAPI</span></div>
                <div class="official-item-search-row"><input class="input" id="officialItemLookup" list="pokeApiItemSuggestions" placeholder="Buscar item oficial, ex.: Leftovers..." /><button class="btn" id="officialItemLookupBtn" type="button">🔎 ADICIONAR</button></div>
                <div class="move-auto-status official-item-status" id="officialItemLookupStatus">Selecione um item para adicioná-lo à Memória de Itens.</div>
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

          <section class="panel misc-panel misc-history-hub">
            <div class="panel-head">
              <div class="misc-panel-head-main"><span class="misc-panel-icon" aria-hidden="true">LV</span><div class="misc-panel-head-copy">
                <h2>Histórico de Progressão</h2><span class="eyebrow" id="progressHistoryCount">0 registros</span>
              </div></div>
            </div>
            <div class="panel-body">
              <div class="section-helper" style="margin-bottom:10px">Cada nível confirmado registra a distribuição aplicada e os ganhos finais após Nature.</div>
              <div class="progress-history-list" id="progressHistoryList"></div>
            </div>
          </section>

          <section class="panel misc-panel misc-abilities-hub">
            <div class="panel-head">
              <div class="misc-panel-head-main"><span class="misc-panel-icon" aria-hidden="true">AB</span><div class="misc-panel-head-copy">
                <h2>Abilities Extras</h2><span class="eyebrow">Memória • <span id="abilityBankCount">379</span> no compêndio</span>
              </div></div>
            </div>
            <div class="panel-body">
              <div class="misc-ability-tools">
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

          <section class="panel misc-panel misc-notes-hub">
            <div class="panel-head">
              <div class="misc-panel-head-main"><span class="misc-panel-icon" aria-hidden="true">NT</span><div class="misc-panel-head-copy">
                <h2>Anotações do Pokémon</h2><span class="eyebrow">Livre • campanha • evolução • peculiaridades</span>
              </div></div>
            </div>
            <div class="panel-body"><textarea class="input notes-area" id="pokemonNotes" placeholder="Personalidade, histórico, peculiaridades, evolução, treinos, informações da campanha..."></textarea></div>
          </section>
        </div>
      </div>

      '''

if MARKER in source:
    print("Página 04 já repaginada; mantendo HTML atual.")
else:
    start = source.find(START)
    if start < 0:
        raise SystemExit("ERRO: início da Página 04 (page3) não encontrado.")
    end = source.find(END, start)
    if end < 0:
        raise SystemExit("ERRO: início da Enciclopédia (page4) não encontrado.")
    old_block = source[start:end]
    required_old_ids = [
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
    missing = [i for i in required_old_ids if f'id="{i}"' not in old_block]
    if missing:
        raise SystemExit("ERRO: a versão atual da Página 04 mudou. IDs ausentes: " + ", ".join(missing))
    source = source[:start] + new_page + source[end:]

# A Página 04 agora possui decoração e recolhimento próprios.
source = source.replace(
    'document.querySelectorAll("#page1 .panel,#pageTrainer .panel,#page3 .panel")',
    'document.querySelectorAll("#page1 .panel,#pageTrainer .panel")'
)

if SCRIPT_LINK not in source:
    if STYLE_LINK in source:
        source = source.replace(STYLE_LINK, STYLE_LINK + "\n  " + SCRIPT_LINK, 1)
    else:
        head_end = source.find("</head>")
        if head_end < 0:
            raise SystemExit("ERRO: </head> não encontrado para inserir o controlador da Miscelânea.")
        source = source[:head_end] + "  " + SCRIPT_LINK + "\n" + source[head_end:]

if STYLE_LINK not in source:
    head_end = source.find("</head>")
    if head_end < 0:
        raise SystemExit("ERRO: </head> não encontrado.")
    source = source[:head_end] + "  " + STYLE_LINK + "\n" + source[head_end:]

critical_ids = [
    "trainingMoveApiLookup","trainingMoveApiLookupBtn","trainingMoveName","trainingElementType",
    "trainingCategory","trainingPower","trainingAccuracy","trainingMoveType","addTrainingMoveBtn",
    "trainingEffectChance","trainingDescription","trainingMovesList","ppgValueLabel","currentPpg","ppgFill",
    "ppgMinusBtn","ppgPlusBtn","progressHistoryCount","progressHistoryList","pokemonNotes","pokeApiItemCount",
    "officialItemLookup","officialItemLookupBtn","officialItemLookupStatus","pokeApiItemSuggestions","heldItemSelect",
    "customItemName","addCustomItemBtn","customItemDescription","itemMemoryList","abilityBankCount",
    "abilitySystemLookup","abilitySystemLookupBtn","abilitySystemLookupStatus","systemAbilitySuggestions",
    "memoryAbilityName","addMemoryAbilityBtn","memoryAbilityDescription","abilityMemoryList","miscOverviewPpg",
    "miscOverviewTraining","miscOverviewItems","miscOverviewAbilities"
]
problems = []
for item_id in critical_ids:
    count = source.count(f'id="{item_id}"')
    if count != 1:
        problems.append(f"{item_id}={count}")
if problems:
    raise SystemExit("ERRO: IDs duplicados/ausentes após repaginação: " + ", ".join(problems))

checks = {
    "Página 04 V5 instalada": MARKER in source,
    "CSS externo instalado": STYLE_LINK in source,
    "Controlador da Miscelânea instalado": SCRIPT_LINK in source,
    "Decoração legada removida da Página 04": '#pageTrainer .panel,#page3 .panel' not in source,
    "Enciclopédia preservada": 'class="page" id="page4"' in source,
    "Exportação JSON preservada": 'id="exportBtn"' in source,
    "Importação JSON preservada": 'id="importBtn"' in source,
    "Treino preservado": 'id="trainingMovesList"' in source,
    "PPg preservado": 'id="currentPpg"' in source,
    "Itens preservados": 'id="itemMemoryList"' in source,
    "Abilities preservadas": 'id="abilityMemoryList"' in source,
}
for label, ok in checks.items():
    print(("OK" if ok else "FALHOU") + ": " + label)
if not all(checks.values()):
    raise SystemExit("Falha na validação; index.html não foi salvo.")

index.write_text(source, encoding="utf-8")
print("Página 04 repaginada. Versão V5.0 mantida.")
