#!/usr/bin/env python3
"""Gera styles/theme-skins-v7.css: uma "pele" visual por geração.

Cada pele define variáveis --sk-* (moldura, cantos, sombra, corte,
faixa de título, rótulos, retrato e cenário) inspiradas na interface
dos jogos daquela geração. Um único conjunto de regras aplica essas
variáveis em todas as janelas da ficha: janelas comuns, a tela de
resumo do Pokémon, abas, rótulos da tabela, retrato e fundo.
As cores continuam vindo do tema (--cl-*), então a mesma pele serve
para o jogo e para os protagonistas daquela região.

Uso: python3 scripts/build-theme-skins.py
"""
from pathlib import Path

ON = 'html[data-theme-skin]:not([data-sheet-mode="pokedex"])'
PAGES = ':is(#page1,#pageTrainer,#page2,#page3,#page5)'

SKINS = {
    "kanto": dict(
        about="FireRed/LeafGreen (GBA): caixas brancas com moldura dupla clara e fundo xadrez das telas de resumo",
        radius="10px", radius_sm="6px",
        border="4px solid color-mix(in srgb,var(--cl-frame) 55%,#fff)",
        shadow="0 0 0 3px var(--cl-ink),inset 0 0 0 3px #fff,inset 0 0 0 5px color-mix(in srgb,var(--cl-frame) 35%,#fff),5px 5px 0 2px rgba(0,0,0,.35)",
        head="repeating-linear-gradient(90deg,rgba(255,255,255,.10) 0 8px,transparent 8px 16px),linear-gradient(180deg,color-mix(in srgb,var(--cl-banner) 78%,#fff) 0 50%,var(--cl-banner) 50% 100%)",
        dt="repeating-linear-gradient(90deg,rgba(255,255,255,.10) 0 6px,transparent 6px 12px),linear-gradient(180deg,color-mix(in srgb,var(--cl-frame) 78%,#fff) 0 50%,var(--cl-frame) 50% 100%)",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,rgba(0,0,0,.25),transparent 70%),repeating-linear-gradient(90deg,rgba(0,90,30,.10) 0 6px,transparent 6px 12px) 0 100%/100% 40% no-repeat,linear-gradient(180deg,#a8d8ff,#e8f6ff 60%,#8fd16a 60.5%,#6cba4a)",
        body="conic-gradient(from 0deg,color-mix(in srgb,var(--accent2) 24%,var(--bg)) 0 25%,var(--bg) 0 50%,color-mix(in srgb,var(--accent2) 24%,var(--bg)) 0 75%,var(--bg) 0) 0 0/48px 48px",
    ),
    "johto": dict(
        about="Gold/Silver/Crystal (Game Boy Color): borda preta de linha dupla, cantos retos e faixas lisas",
        radius="2px", radius_sm="2px",
        border="3px solid var(--cl-ink)",
        shadow="inset 0 0 0 3px var(--cl-paper),inset 0 0 0 5px var(--cl-ink),5px 5px 0 0 rgba(0,0,0,.45)",
        head="var(--cl-banner)",
        head_extra="border-bottom:5px double var(--cl-ink)!important;",
        dt="var(--cl-frame)",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,rgba(0,0,0,.25),transparent 70%),linear-gradient(180deg,#f8b878 0,#f8d8a8 45%,#f8f0c8 60%,#a8c878 60.5%,#789848)",
        body="repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 2px,transparent 2px 4px),radial-gradient(circle at 50% 0,color-mix(in srgb,var(--accent) 24%,transparent),transparent 60%),var(--bg)",
    ),
    "hoenn": dict(
        about="Ruby/Sapphire/Emerald (GBA): janelas arredondadas com brilho em cima e faixas em duas cores na diagonal",
        radius="16px", radius_sm="10px",
        border="4px solid var(--cl-frame)",
        shadow="0 0 0 3px var(--cl-ink),inset 0 3px 0 0 rgba(255,255,255,.65),0 8px 0 -1px rgba(0,0,0,.35)",
        head="linear-gradient(115deg,var(--cl-banner) 0 58%,color-mix(in srgb,var(--cl-frame) 70%,#fff) 58% 61%,var(--cl-frame) 61% 100%)",
        dt="linear-gradient(115deg,var(--cl-frame) 0 78%,color-mix(in srgb,var(--cl-frame) 60%,#fff) 78% 82%,var(--cl-frame-dark) 82%)",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,rgba(0,0,0,.22),transparent 70%),repeating-linear-gradient(170deg,rgba(255,255,255,.4) 0 3px,transparent 3px 14px) 0 52%/100% 14% no-repeat,linear-gradient(180deg,#78c8f8,#c8ecff 50%,#4aa8e0 50.5%,#3a90d0 64%,#f0dca0 64.5%,#e8c878)",
        body="repeating-radial-gradient(circle at 50% 120%,color-mix(in srgb,var(--accent2) 24%,transparent) 0 2px,transparent 2px 38px),linear-gradient(180deg,color-mix(in srgb,var(--accent2) 30%,var(--bg)),var(--bg))",
    ),
    "sinnoh": dict(
        about="Diamond/Pearl/Platinum (DS): botões brilhantes com reflexo, cantos bem redondos e o LCD verde do Pokétch",
        radius="20px", radius_sm="12px",
        border="3px solid var(--cl-frame-dark)",
        shadow="0 0 0 3px var(--cl-ink),inset 0 0 0 2px rgba(255,255,255,.75),0 6px 0 0 rgba(0,0,0,.4)",
        head="linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.14) 48%,transparent 52%),linear-gradient(180deg,color-mix(in srgb,var(--cl-banner) 72%,#fff),var(--cl-banner) 55%,var(--cl-banner-dark))",
        dt="linear-gradient(180deg,rgba(255,255,255,.45),rgba(255,255,255,.1) 48%,transparent 52%),linear-gradient(180deg,color-mix(in srgb,var(--cl-frame) 75%,#fff),var(--cl-frame-dark))",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,rgba(0,0,0,.22),transparent 70%),radial-gradient(circle,rgba(255,255,255,.95) 0 1.5px,transparent 2px) 0 0/22px 22px,linear-gradient(180deg,#b8c8e8,#e8f0ff 58%,#ffffff 58.5%,#dfe8f2)",
        body="linear-gradient(180deg,rgba(255,255,255,.05) 50%,transparent 50%) 0 0/100% 6px,radial-gradient(ellipse at 50% -20%,color-mix(in srgb,var(--accent2) 48%,transparent),transparent 65%),var(--bg)",
        extra=f"""{ON}[data-theme-skin="sinnoh"] body .sheet #page1 .cl-dialog{{background:linear-gradient(180deg,rgba(0,0,0,.05) 50%,transparent 50%) 0 0/100% 4px,#b8d8a0!important;border-color:#3a5a30!important}}
{ON}[data-theme-skin="sinnoh"] body .sheet #page1 .cl-dialog *{{color:#1f3a18!important}}""",
    ),
    "unova": dict(
        about="Black/White e C-Gear: cantos cortados na diagonal, preto forte e grade de circuito",
        radius="0px", radius_sm="0px",
        border="3px solid var(--cl-ink)",
        shadow="inset 0 0 0 3px var(--cl-frame),inset 0 0 0 5px var(--cl-ink)",
        clip="polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px)",
        head="linear-gradient(100deg,var(--cl-ink) 0 14px,var(--cl-banner) 14px calc(100% - 46px),var(--cl-ink) calc(100% - 46px) calc(100% - 40px),var(--cl-banner-dark) calc(100% - 40px))",
        dt="linear-gradient(100deg,var(--cl-ink) 0 8px,var(--cl-frame) 8px)",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,rgba(0,0,0,.35),transparent 70%),linear-gradient(90deg,transparent 0 10%,rgba(255,255,255,.18) 10% 11%,transparent 11% 30%,rgba(255,255,255,.12) 30% 31%,transparent 31%) 0 0/100% 60% no-repeat,linear-gradient(180deg,#1c2430,#3a4658 60%,#5a6474 60.5%,#2a303a)",
        body="linear-gradient(90deg,color-mix(in srgb,var(--accent) 20%,transparent) 1px,transparent 1px) 0 0/56px 56px,linear-gradient(0deg,color-mix(in srgb,var(--accent) 20%,transparent) 1px,transparent 1px) 0 0/56px 56px,var(--bg)",
    ),
    "kalos": dict(
        about="X/Y e Holo Caster: bordas finas com brilho azul, cantos suaves e faixas translúcidas",
        radius="16px", radius_sm="10px",
        border="2px solid color-mix(in srgb,var(--cl-frame) 70%,#fff)",
        shadow="0 0 0 3px var(--cl-ink),0 0 18px 2px color-mix(in srgb,var(--cl-frame) 50%,transparent),inset 0 0 0 2px rgba(255,255,255,.55)",
        head="linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent),linear-gradient(90deg,var(--cl-banner),color-mix(in srgb,var(--cl-banner) 50%,var(--cl-frame)))",
        dt="linear-gradient(90deg,var(--cl-frame),color-mix(in srgb,var(--cl-frame) 55%,#9fd8ff))",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,rgba(0,0,0,.22),transparent 70%),repeating-linear-gradient(0deg,rgba(120,200,255,.12) 0 1px,transparent 1px 4px),linear-gradient(180deg,#cfe6ff,#f4f8ff 58%,#d8e8f0 58.5%,#b8d0e0)",
        body="conic-gradient(from 200deg at 50% -10%,transparent 0 20deg,color-mix(in srgb,var(--accent2) 24%,transparent) 20deg 26deg,transparent 26deg 46deg,color-mix(in srgb,var(--accent) 20%,transparent) 46deg 52deg,transparent 52deg 72deg,color-mix(in srgb,var(--accent2) 24%,transparent) 72deg 78deg,transparent 78deg),var(--bg)",
    ),
    "alola": dict(
        about="Sun/Moon e Rotom Dex: janelas bem redondas e alegres, faixas de pôr do sol e céu tropical",
        radius="24px", radius_sm="14px",
        border="4px solid var(--cl-frame)",
        shadow="0 0 0 3px var(--cl-ink),inset 0 0 0 3px rgba(255,255,255,.55),0 7px 0 0 rgba(0,0,0,.35)",
        head="radial-gradient(circle at 94% 150%,rgba(255,236,150,.9) 0 20px,transparent 21px),linear-gradient(180deg,color-mix(in srgb,var(--cl-banner) 68%,#ffd27a),var(--cl-banner) 70%,var(--cl-banner-dark))",
        dt="linear-gradient(180deg,color-mix(in srgb,var(--cl-frame) 70%,#ffe0a0),var(--cl-frame))",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,rgba(0,0,0,.22),transparent 70%),radial-gradient(circle at 78% 30%,#fff6c0 0 20px,rgba(255,220,120,.55) 21px 32px,transparent 33px),linear-gradient(180deg,#ff9e6e,#ffd38a 50%,#7fd4e8 50.5%,#48b6d6 66%,#f6e2a8 66.5%,#eccb86)",
        body="radial-gradient(circle at 85% 8%,color-mix(in srgb,var(--accent) 45%,transparent) 0 60px,transparent 170px),linear-gradient(180deg,color-mix(in srgb,var(--accent) 24%,var(--bg)),var(--bg) 70%)",
    ),
    "galar": dict(
        about="Sword/Shield: faixas inclinadas de placar de estádio, listras diagonais e borda lateral grossa",
        radius="4px", radius_sm="3px",
        border="3px solid var(--cl-ink)",
        border_left="12px solid var(--cl-frame)",
        shadow="7px 7px 0 0 rgba(0,0,0,.4)",
        head="repeating-linear-gradient(-45deg,rgba(255,255,255,.14) 0 6px,transparent 6px 14px),linear-gradient(100deg,var(--cl-banner) 0 calc(100% - 60px),var(--cl-ink) calc(100% - 60px) calc(100% - 54px),var(--cl-frame) calc(100% - 54px))",
        dt="repeating-linear-gradient(-45deg,rgba(255,255,255,.12) 0 5px,transparent 5px 12px),var(--cl-frame)",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,rgba(0,0,0,.22),transparent 70%),linear-gradient(90deg,transparent 49.6%,rgba(255,255,255,.75) 49.6% 50.4%,transparent 50.4%) 0 100%/100% 40% no-repeat,repeating-linear-gradient(90deg,#4cae4c 0 24px,#3f9c40 24px 48px) 0 100%/100% 40% no-repeat,linear-gradient(180deg,#9ec8f0,#e4f0fb)",
        body="repeating-linear-gradient(-45deg,color-mix(in srgb,var(--accent) 16%,transparent) 0 14px,transparent 14px 40px),var(--bg)",
    ),
    "paldea": dict(
        about="Scarlet/Violet: contorno preto grosso de quadrinho, sombra sólida deslocada e faixas inclinadas com retícula",
        radius="12px", radius_sm="8px",
        border="4px solid var(--cl-ink)",
        shadow="8px 8px 0 0 var(--cl-ink)",
        head="radial-gradient(circle,rgba(255,255,255,.24) 1.4px,transparent 1.8px) 0 0/8px 8px,linear-gradient(95deg,var(--cl-banner) 0 72%,color-mix(in srgb,var(--cl-banner) 55%,#fff) 72% 74.5%,var(--cl-banner-dark) 74.5%)",
        dt="radial-gradient(circle,rgba(255,255,255,.2) 1.2px,transparent 1.6px) 0 0/7px 7px,var(--cl-frame)",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,rgba(0,0,0,.22),transparent 70%),radial-gradient(circle,rgba(0,0,0,.07) 1.3px,transparent 1.7px) 0 0/9px 9px,linear-gradient(180deg,#8fd0ff,#e2f4ff 56%,#c6e48a 56.5%,#9cc860)",
        body="radial-gradient(circle,color-mix(in srgb,var(--accent) 28%,transparent) 1.6px,transparent 2px) 0 0/18px 18px,linear-gradient(160deg,color-mix(in srgb,var(--accent) 22%,var(--bg)),var(--bg) 60%)",
    ),
    "hisui": dict(
        about="Legends: Arceus: pergaminho, bordas de tinta e faixas como traço de pincel",
        radius="6px", radius_sm="4px",
        border="3px solid #4a3a26",
        shadow="0 0 0 2px #2a2016,inset 0 0 22px rgba(120,90,40,.28),5px 5px 0 0 rgba(0,0,0,.35)",
        paper="radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.35),transparent 60%),color-mix(in srgb,#efe2c2 85%,var(--cl-paper))",
        head="linear-gradient(90deg,transparent 0 6px,var(--cl-banner) 6px calc(100% - 10px),transparent calc(100% - 10px)),linear-gradient(0deg,transparent 0 4px,var(--cl-banner-dark) 4px calc(100% - 4px),transparent calc(100% - 4px))",
        dt="linear-gradient(90deg,var(--cl-frame-dark),var(--cl-frame) 85%,transparent)",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,rgba(60,40,20,.25),transparent 70%),linear-gradient(180deg,#e9dcbc,#f4ecd6 58%,#c9d4a4 58.5%,#a9b884)",
        body="radial-gradient(ellipse at 50% 0,color-mix(in srgb,var(--accent) 20%,transparent),transparent 60%),repeating-linear-gradient(0deg,rgba(255,240,210,.03) 0 1px,transparent 1px 3px),var(--bg)",
    ),
    "lumiose": dict(
        about="Legends Z-A: Lumiose à noite, vidro escuro com contorno neon e brilho de letreiro",
        radius="10px", radius_sm="6px",
        border="2px solid color-mix(in srgb,var(--accent) 80%,#fff)",
        shadow="0 0 0 3px var(--cl-ink),0 0 16px 1px color-mix(in srgb,var(--accent) 60%,transparent),inset 0 0 12px color-mix(in srgb,var(--accent) 22%,transparent)",
        head="linear-gradient(90deg,color-mix(in srgb,var(--accent) 22%,#0c120c),color-mix(in srgb,var(--accent) 55%,#0c120c))",
        head_extra="border-bottom:2px solid var(--accent)!important;text-shadow:0 0 6px color-mix(in srgb,var(--accent) 80%,#fff)!important;",
        dt="linear-gradient(90deg,#0c120c,color-mix(in srgb,var(--accent) 45%,#0c120c))",
        portrait="radial-gradient(ellipse 58% 12% at 50% 86%,color-mix(in srgb,var(--accent) 50%,transparent),transparent 70%),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px) 0 0/26px 26px,linear-gradient(180deg,#0b1020,#1a2440 60%,#20283a 60.5%,#0c1018)",
        body="radial-gradient(circle at 20% 30%,color-mix(in srgb,var(--accent) 24%,transparent),transparent 30%),radial-gradient(circle at 80% 70%,color-mix(in srgb,#a050ff 24%,transparent),transparent 32%),var(--bg)",
    ),
}

# Superfícies da ficha
WINDOWS = [f'body .sheet {PAGES} :is(.panel,.page-intro,.combat-info-card)', 'body #page1 #sumScreen']
LITE = ['body #page1 #sumScreen .sum-adopted.panel', 'body #page1 #sumScreen .sum-adopted.pokemon-held-item-console',
        'body #page1 #sumScreen .sum-namebar', f'body .sheet {PAGES} .stat-row']
HEADS = [f'body .sheet {PAGES} .panel>.panel-head', f'body .sheet {PAGES} .combat-info-card>.combat-card-head',
         'body #page1 #sumScreen .sum-tabs']
DTS = ['body #page1 #sumScreen .sum-table dt']
PORTRAIT = ['body .sheet #page1 .portrait', 'body #page1 #sumScreen .sum-stage']


def sel(parts, pre=ON):
    return ",\n".join(f"{pre} {p}" for p in parts)


def build():
    out = ["/* ============================================================",
           "   V7 — Peles dos temas (uma por geração)",
           "   Arquivo gerado por scripts/build-theme-skins.py — edite lá.",
           "   ============================================================ */", ""]
    for skin, d in SKINS.items():
        out.append(f"/* {skin}: {d['about']} */")
        v = [f"--sk-radius:{d['radius']}", f"--sk-radius-sm:{d['radius_sm']}", f"--sk-border:{d['border']}",
             f"--sk-shadow:{d['shadow']}", f"--sk-clip:{d.get('clip', 'none')}", f"--sk-head:{d['head']}",
             f"--sk-dt:{d['dt']}", f"--sk-portrait:{d['portrait']}", f"--sk-body:{d['body']}"]
        if d.get("border_left"):
            v.append(f"--sk-border-left:{d['border_left']}")
        if d.get("paper"):
            v.append(f"--sk-paper:{d['paper']}")
        out.append(f'html[data-theme-skin="{skin}"]{{\n  ' + ";\n  ".join(v) + ";\n}")
        if d.get("head_extra"):
            out.append(sel(HEADS, f'{ON}[data-theme-skin="{skin}"]') + "{" + d["head_extra"] + "}")
        if d.get("extra"):
            out.append(d["extra"])
        out.append("")

    out.append("/* ---------- Regras comuns a todas as peles ---------- */")
    out.append(sel(WINDOWS) + """{
  border:var(--sk-border)!important;
  border-radius:var(--sk-radius)!important;
  box-shadow:var(--sk-shadow)!important;
  clip-path:var(--sk-clip)!important;
  -webkit-clip-path:var(--sk-clip)!important;
}""")
    out.append(sel(WINDOWS, f'{ON}[data-theme-skin="galar"]') + "{border-left:var(--sk-border-left)!important}")
    out.append(sel(WINDOWS, f'{ON}[data-theme-skin="hisui"]') + "{background:var(--sk-paper)!important}")
    out.append(sel(LITE) + "{border-radius:var(--sk-radius-sm)!important}")
    out.append(sel(HEADS) + "{background:var(--sk-head)!important}")
    out.append(sel(DTS) + "{background:var(--sk-dt)!important}")
    out.append(sel(PORTRAIT) + "{background:var(--sk-portrait)!important;border-radius:var(--sk-radius-sm)!important}")
    out.append(f"{ON} body{{background:var(--sk-body)!important;background-attachment:fixed!important}}")
    # Galar: faixa inclinada, texto reto
    g = f'{ON}[data-theme-skin="galar"]'
    out.append(sel([f'body .sheet {PAGES} .panel>.panel-head', f'body .sheet {PAGES} .combat-info-card>.combat-card-head'], g)
               + "{clip-path:polygon(0 0,100% 0,calc(100% - 14px) 100%,0 100%)}")
    # Unova: abas do resumo com corte
    out.append(f'{ON}[data-theme-skin="unova"] body #page1 #sumScreen .sum-tabs button.active{{clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)}}')
    # Paldea: abas com contorno de quadrinho
    out.append(f'{ON}[data-theme-skin="paldea"] body #page1 #sumScreen .sum-tabs button{{border-right:3px solid var(--cl-ink)!important}}')
    out.append("@media (max-width:900px){")
    out.append(f'  html[data-theme-skin="unova"]{{--sk-clip:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}}')
    out.append(f'  html[data-theme-skin="paldea"]{{--sk-shadow:5px 5px 0 0 var(--cl-ink)}}')
    out.append(f'  html[data-theme-skin="galar"]{{--sk-border-left:8px solid var(--cl-frame)}}')
    out.append("}")
    out.append("@media (prefers-reduced-motion:reduce){html[data-theme-skin] body{background-attachment:scroll!important}}")
    Path(__file__).resolve().parent.parent.joinpath("styles/theme-skins-v7.css").write_text("\n".join(out) + "\n", encoding="utf8")


if __name__ == "__main__":
    build()
    print("styles/theme-skins-v7.css gerado")
