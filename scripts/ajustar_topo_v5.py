#!/usr/bin/env python3
"""Atualiza somente a barra superior da ficha PC V5.0.
Idempotente: não altera a interface novamente quando já estiver atualizada.
O botão da Pokébola e o + da Box continuam gerenciando os Pokémon.
"""
from pathlib import Path
import re

index = Path("index.html")
css_file = Path("styles/topbar-v5.css")
source = index.read_text(encoding="utf-8")
marker = "/* V5.0 — barra superior compacta e botão de personalização."

if 'class="top-personalize-btn"' in source:
    if marker not in source:
        raise SystemExit("ERRO: botão atualizado, mas o CSS está ausente.")
    print("Topo já atualizado; sem alterações.")
    raise SystemExit(0)

def replace_exact(pattern, replacement, label):
    global source
    source, count = re.subn(pattern, lambda _: replacement, source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"ERRO: {label} foi encontrado {count} vez(es), esperado 1.")

new_button = """    <button class="top-personalize-btn" id="themeBtn" type="button"
      aria-haspopup="dialog" aria-controls="themeModal"
      title="Personalizar aparência, fontes e cores">
      <span class="top-personalize-icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3a9 9 0 1 0 9 9c0-1.7-1.3-3-3-3h-1a2 2 0 0 1-2-2V6a3 3 0 0 0-3-3Z"/>
          <circle cx="6.5" cy="12" r="1" fill="currentColor" stroke="none"/>
          <circle cx="9" cy="7.5" r="1" fill="currentColor" stroke="none"/>
          <circle cx="15" cy="15.5" r="1" fill="currentColor" stroke="none"/>
        </svg>
      </span>
      <span class="top-personalize-copy">
        <b>Personalizar</b><small id="themeLabel">Hazel • Padrão</small>
      </span>
      <span class="top-personalize-arrow" aria-hidden="true">⌄</span>
    </button>
    <span class="top-action-divider" aria-hidden="true"></span>
"""

replace_exact(
    r'    <button class="select-like top-selector" id="currentPokemonBtn">.*?</button>\n',
    "", "seletor da ficha atual"
)
replace_exact(
    r'    <button class="select-like top-selector" id="themeBtn">.*?</button>\n',
    new_button, "seletor de personalização"
)
replace_exact(
    r'    <button class="btn primary" id="newPokemonBtn">＋ Novo Pokémon</button>\n',
    "", "botão Novo Pokémon da barra superior"
)
replace_exact(
    r'document.getElementById\("currentPokemonBtn"\).onclick=toggleDrawer;\n',
    "", "evento do seletor removido"
)
replace_exact(
    r'document.getElementById\("newPokemonBtn"\).onclick=openManualPokemonModal;\n',
    "", "evento do botão removido"
)
replace_exact(
    r'\["themeBtn","exportBtn","importBtn","newPokemonBtn"\]',
    '["themeBtn","exportBtn","importBtn"]', "fechamento do menu mobile"
)

old_name = 'document.getElementById("topCurrentName").textContent=current.name||"Sem nome";'
if source.count(old_name) != 2:
    raise SystemExit("ERRO: atualização do nome da ficha não corresponde à versão esperada.")
source = source.replace(old_name, "")

css = css_file.read_text(encoding="utf-8")
if source.count("</style>") < 1:
    raise SystemExit("ERRO: folha de estilos principal não encontrada.")
source = source.replace("</style>", "\n" + css + "\n</style>", 1)

checks = {
    "seletor superior removido": 'id="currentPokemonBtn"' not in source,
    "botão superior Novo Pokémon removido": 'id="newPokemonBtn"' not in source,
    "nome antigo removido": 'id="topCurrentName"' not in source,
    "botão Personalizar único": source.count('id="themeBtn"') == 1,
    "rótulo do tema preservado": source.count('id="themeLabel"') == 1,
    "modal de personalização preservado": 'id="themeModal"' in source,
    "evento de personalização preservado": 'document.getElementById("themeBtn").onclick' in source,
    "botão de criar na Box preservado": 'id="drawerNewBtn"' in source,
    "ação da Box preservada": 'document.getElementById("drawerNewBtn").onclick=openManualPokemonModal' in source,
    "Pokébola de acesso à Box preservada": 'id="drawerToggle"' in source,
    "botões JSON preservados": 'id="exportBtn"' in source and 'id="importBtn"' in source,
    "ponte GM preservada": "pokedex-gm-bridge.js" in source,
    "CSS da nova barra incluído": marker in source
}
for label, passed in checks.items():
    print(("OK" if passed else "FALHOU") + ": " + label)
if not all(checks.values()):
    raise SystemExit("Falha na validação. O index.html original foi mantido.")
index.write_text(source, encoding="utf-8")
print("Topo atualizado. Versão V5.0 mantida.")
