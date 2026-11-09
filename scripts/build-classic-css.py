#!/usr/bin/env python3
"""Gera styles/classic-ui-v6.css.

A ficha tem muitas regras antigas com ID e !important. Para o visual
clássico vencer sem apagar nada, os seletores usam um prefixo com ID:
  $S  → modo normal (o Modo Pokédex mantém a carcaça própria)
  $P  → páginas que usam janelas clássicas (a Enciclopédia tem visual próprio)
Rode:  python3 scripts/build-classic-css.py
"""
from pathlib import Path

S = 'html:not([data-sheet-mode="pokedex"]) body'
P = f'{S} .sheet :is(#page1,#pageTrainer,#page2,#page3,#page5)'
G = f'{S} .sheet #page1'

CSS = r'''
/* ============================================================
   V6 — Visual clássico (Game Boy / GBA / DS)
   Arquivo gerado por scripts/build-classic-css.py — edite lá.
   Janelas claras com borda dupla, faixas de título em pixel,
   cursor ▶ e fundo com Poké Balls. As cores vêm do tema.
   ============================================================ */

:root{
  /* Paleta clássica derivada do tema: o papel das janelas leva um pouco
     da cor secundária do tema e as faixas usam a principal. */
  --cl-ink:#181a24;
  --cl-paper:color-mix(in srgb,var(--accent2,#2f6fd0) 7%,#fbfaf2);
  --cl-paper2:color-mix(in srgb,var(--accent2,#2f6fd0) 11%,#eceee2);
  --cl-paper3:color-mix(in srgb,var(--accent2,#2f6fd0) 16%,#dfe1d2);
  --cl-card:color-mix(in srgb,var(--accent2,#2f6fd0) 3%,#ffffff);
  --cl-inset:color-mix(in srgb,var(--accent2,#2f6fd0) 10%,#e7e7da);
  --cl-line:color-mix(in srgb,var(--accent2,#2f6fd0) 18%,#bfc2b2);
  --cl-hl:#ffffff;
  --cl-text:#23262e;
  --cl-muted:#5f6670;
  --cl-frame:color-mix(in srgb,var(--accent2,#2f6fd0) 72%,#ffffff);
  --cl-frame-dark:color-mix(in srgb,var(--accent2,#2f6fd0) 78%,#000000);
  --cl-banner:var(--accent,#d8343c);
  --cl-banner-dark:color-mix(in srgb,var(--accent,#d8343c) 62%,#000000);
  --cl-title:"Press Start 2P","Silkscreen",ui-monospace,monospace;
  --cl-pixel:"Silkscreen","Press Start 2P",ui-monospace,monospace;
  --cl-scan:repeating-linear-gradient(180deg,rgba(255,255,255,.10) 0 2px,transparent 2px 4px);
  --cl-ball:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cg fill='%23ffffff' fill-opacity='.05'%3E%3Cpath d='M6 2h4v1h2v1h1v2h1v1H9V6H7v1H2V6h1V4h1V3h2z'/%3E%3Cpath d='M2 9h5v1h2V9h5v1h-1v2h-1v1h-2v1H6v-1H4v-1H3v-2H2z'/%3E%3Cpath d='M7 7h2v2H7z'/%3E%3C/g%3E%3C/svg%3E");
}
/* Modo escuro: janelas noturnas tingidas pelo tema. */
html[data-cl-scheme="dark"]{
  --cl-ink:#05070c;
  --cl-paper:color-mix(in srgb,var(--accent2,#2f6fd0) 14%,#151922);
  --cl-paper2:color-mix(in srgb,var(--accent2,#2f6fd0) 16%,#1d222d);
  --cl-paper3:color-mix(in srgb,var(--accent2,#2f6fd0) 22%,#272d3a);
  --cl-card:color-mix(in srgb,var(--accent2,#2f6fd0) 10%,#202632);
  --cl-inset:color-mix(in srgb,var(--accent2,#2f6fd0) 8%,#11151c);
  --cl-line:color-mix(in srgb,var(--accent2,#2f6fd0) 30%,#3a4252);
  --cl-hl:color-mix(in srgb,var(--accent2,#2f6fd0) 25%,#3a4252);
  --cl-text:#eef2f8;
  --cl-muted:#a3adbd;
  --cl-frame:color-mix(in srgb,var(--accent2,#2f6fd0) 75%,#9ab0d0);
  --cl-frame-dark:color-mix(in srgb,var(--accent2,#2f6fd0) 70%,#000000);
}
html[data-cl-scheme="dark"] :is(input,textarea,select)::placeholder{color:#7d8798!important}

/* ---------- Fundo: Poké Balls em pixel deslizando na diagonal ---------- */
$S{
  background:
    radial-gradient(ellipse at 50% -10%,color-mix(in srgb,var(--accent2) 30%,transparent),transparent 60%),
    linear-gradient(180deg,color-mix(in srgb,var(--bg) 85%,var(--accent2)),var(--bg))!important;
  background-attachment:fixed!important;
}
$S::before{
  content:"";
  position:fixed;
  inset:-128px;
  z-index:-1;
  background:var(--cl-ball),
    repeating-linear-gradient(135deg,transparent 0 22px,rgba(255,255,255,.018) 22px 44px);
  background-size:64px 64px,auto;
  pointer-events:none;
  animation:clDrift 12s linear infinite;
  will-change:transform;
  contain:strict;
}
@keyframes clDrift{to{transform:translate(64px,64px)}}

/* ---------- Barra do topo ---------- */
$S .topbar{
  border-bottom:4px solid var(--cl-ink)!important;
  background:var(--cl-scan),linear-gradient(180deg,color-mix(in srgb,var(--cl-banner) 88%,#fff),var(--cl-banner) 55%,var(--cl-banner-dark))!important;
  box-shadow:0 4px 0 rgba(0,0,0,.35)!important;
}
$S .topbar .brand,$S .topbar .brand small{color:#fff!important;text-shadow:2px 2px 0 rgba(0,0,0,.35)}
$S .topbar .brand>span{font-family:var(--cl-title)!important;font-size:13px!important;letter-spacing:.04em}
$S .topbar .brand small{font-family:var(--cl-pixel)!important;font-size:11px!important;opacity:.92}
$S .topbar :is(.btn,.top-personalize-btn){
  border:3px solid var(--cl-ink)!important;
  border-radius:8px!important;
  background:var(--cl-paper)!important;
  color:var(--cl-text)!important;
  font-family:var(--cl-pixel)!important;
  font-weight:700!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
}
$S .topbar .top-personalize-btn :is(b,small,svg,span){color:var(--cl-text)!important}
$S .topbar .top-personalize-icon{border-color:var(--cl-ink)!important;background:var(--cl-paper2)!important}
$S .topbar .top-action-divider{background:rgba(0,0,0,.25)!important}

/* ---------- Moldura da ficha ---------- */
$S .sheet{
  border:0!important;
  background:transparent!important;
  box-shadow:none!important;
}

/* ---------- Cabeçalho do Pokémon (placa + menu) ---------- */
$S .sheet .sheet-head{
  position:relative;
  margin-bottom:16px!important;
  padding:14px 18px!important;
  border:4px solid var(--cl-frame)!important;
  border-radius:12px!important;
  background:var(--cl-paper)!important;
  box-shadow:0 0 0 3px var(--cl-ink),6px 6px 0 3px rgba(0,0,0,.45),inset 0 0 0 2px var(--cl-hl)!important;
  color:var(--cl-text)!important;
  overflow:visible!important;
}
$S .sheet .sheet-head::before,$S .sheet .sheet-head::after{display:none!important}
$S .sheet .sheet-head .eyebrow{
  display:inline-block!important;
  padding:4px 10px!important;
  border-radius:4px;
  background:var(--cl-banner)!important;
  color:#fff!important;
  font-family:var(--cl-pixel)!important;
  font-size:11px!important;
  letter-spacing:.08em!important;
}
$S .sheet .sheet-title input{
  color:var(--cl-text)!important;
  font-family:var(--cl-title)!important;
  font-size:24px!important;
  letter-spacing:.02em;
  text-shadow:3px 3px 0 var(--cl-paper3)!important;
  background:transparent!important;
}
$S .sheet .sheet-head .type-pill{
  border:2px solid var(--cl-ink)!important;
  border-radius:4px!important;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  font-family:var(--cl-pixel)!important;
  box-shadow:0 2px 0 var(--cl-ink)!important;
}

/* Menu de páginas: botões do menu START. */
$S .sheet .sheet-navigation{background:transparent!important;border:0!important;box-shadow:none!important}
$S .sheet .sheet-navigation .page-tabs{
  display:flex!important;
  flex-wrap:nowrap!important;
  justify-content:flex-end;
  gap:8px!important;
  width:auto!important;
  grid-template-columns:none!important;
}
$S .sheet .sheet-navigation{display:flex!important;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
$S .sheet .sheet-navigation .tab.pokedex-hardware-key{
  position:relative;
  display:inline-flex!important;
  flex-direction:row!important;
  flex:0 0 auto!important;
  align-items:center!important;
  gap:8px!important;
  min-width:0!important;
  width:auto!important;
  height:auto!important;
  min-height:38px!important;
  padding:5px 10px 5px 22px!important;
  border:3px solid var(--cl-ink)!important;
  border-radius:8px!important;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  box-shadow:0 4px 0 var(--cl-ink)!important;
  transform:none!important;
  filter:none!important;
  transition:transform .08s steps(2),box-shadow .08s steps(2),background .1s;
}
$S .sheet .sheet-navigation .tab.pokedex-hardware-key>*{display:none!important}
$S .sheet .sheet-navigation .tab.pokedex-hardware-key .hardware-symbol,
$S .sheet .sheet-navigation .tab.pokedex-hardware-key .dex-key-lens{
  display:grid!important;
  place-items:center;
  width:22px!important;height:22px!important;
  margin:0!important;
  border:2px solid var(--cl-ink)!important;
  border-radius:50%!important;
  background:var(--cl-paper2)!important;
  color:var(--cl-text)!important;
  font-size:12px!important;
  box-shadow:none!important;
}
$S .sheet .sheet-navigation .tab.pokedex-hardware-key::after{
  content:attr(data-cl-label);
  font-family:var(--cl-pixel);
  font-size:11px;
  font-weight:700;
  letter-spacing:.04em;
  text-transform:uppercase;
  white-space:nowrap;
  color:inherit;
}
$S .sheet .sheet-navigation .tab.pokedex-hardware-key::before{
  content:"▶"!important;
  position:absolute!important;
  left:8px!important;top:50%!important;
  inset:auto auto auto 8px;
  width:auto!important;height:auto!important;
  border:0!important;background:none!important;box-shadow:none!important;
  color:var(--cl-banner);
  font-size:11px;
  transform:translateY(-50%);
  opacity:0;
}
$S .sheet .sheet-navigation .tab.pokedex-hardware-key:hover{background:var(--cl-paper2)!important}
$S .sheet .sheet-navigation .tab.pokedex-hardware-key:active{transform:translateY(4px)!important;box-shadow:0 0 0 var(--cl-ink)!important}
$S .sheet .sheet-navigation .tab.pokedex-hardware-key.active{
  background:var(--cl-scan),linear-gradient(180deg,var(--cl-frame),var(--cl-frame-dark))!important;
  color:#fff!important;
  text-shadow:2px 2px 0 rgba(0,0,0,.35);
}
$S .sheet .sheet-navigation .tab.pokedex-hardware-key.active::before{opacity:1;color:#fff;animation:clBlink .8s steps(1) infinite}
$S .sheet .sheet-navigation .tab.pokedex-hardware-key.active .hardware-symbol{background:var(--cl-card)!important}
$S .sheet .sheet-head .sheet-import-port{
  border:3px solid var(--cl-ink)!important;
  border-radius:8px!important;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
}
$S .sheet .sheet-head .sheet-import-port *{color:var(--cl-text)!important}
.cl-lr-hint{
  display:inline-flex;align-items:center;gap:6px;
  margin-left:4px;
  color:var(--cl-muted);
  font:700 10px var(--cl-pixel);
  letter-spacing:.06em;
  white-space:nowrap;
}
.cl-lr-hint kbd{
  padding:2px 6px;
  border:2px solid var(--cl-ink);
  border-radius:4px;
  background:var(--cl-paper2);
  color:var(--cl-text);
  font:inherit;
  box-shadow:0 2px 0 var(--cl-ink);
}
html[data-sheet-mode="pokedex"] .cl-lr-hint{display:none}

/* ============================================================
   JANELAS — o coração do visual clássico
   Dentro de cada janela as variáveis viram as de um tema claro,
   então campos, linhas e textos se ajustam sozinhos.
   ============================================================ */
$P :is(.panel,.page-intro,.combat-info-card,.misc-menu-hero){
  --text:var(--cl-text);
  --muted:var(--cl-muted);
  --bg:var(--cl-card);
  --bg2:var(--cl-paper2);
  --panel:var(--cl-paper);
  --panel2:var(--cl-paper2);
  --line:var(--cl-line);
  position:relative;
  margin-bottom:6px;
  overflow:hidden!important;
  border:4px solid var(--cl-frame)!important;
  border-radius:12px!important;
  background:var(--cl-paper)!important;
  color:var(--cl-text)!important;
  box-shadow:0 0 0 3px var(--cl-ink),6px 6px 0 3px rgba(0,0,0,.4),inset 0 0 0 2px var(--cl-hl)!important;
  clip-path:none!important;
  -webkit-clip-path:none!important;
}
$P :is(.panel,.page-intro,.combat-info-card)::before{
  border-radius:0!important;
}
$P .panel::after,$P .combat-info-card::after{display:none!important}

/* Faixa de título da janela */
$P .panel>.panel-head,
$P .combat-info-card>.combat-card-head{
  position:relative;
  min-height:44px;
  margin:0!important;
  padding:8px 12px 8px 14px!important;
  border:0!important;
  border-bottom:3px solid var(--cl-ink)!important;
  border-radius:0!important;
  background:var(--cl-scan),linear-gradient(180deg,color-mix(in srgb,var(--cl-banner) 85%,#fff),var(--cl-banner) 60%,var(--cl-banner-dark))!important;
  color:#fff!important;
  box-shadow:none!important;
}
$P .panel>.panel-head::before{
  position:static!important;
  display:inline-grid!important;
  place-items:center;
  width:auto!important;min-width:28px;height:24px!important;
  margin-right:10px;
  padding:0 5px;
  border:2px solid var(--cl-ink)!important;
  border-radius:4px!important;
  background:var(--cl-card)!important;
  color:var(--cl-banner-dark)!important;
  font:700 10px var(--cl-pixel)!important;
  box-shadow:0 2px 0 var(--cl-ink)!important;
  transform:none!important;
}
$P .panel>.panel-head :is(h2,h3,b,strong),
$P .combat-info-card>.combat-card-head :is(b,strong){
  margin:0!important;
  padding:0!important;
  background:none!important;
  clip-path:none!important;
  color:#fff!important;
  font-family:var(--cl-title)!important;
  font-size:12px!important;
  font-weight:400!important;
  letter-spacing:.04em!important;
  line-height:1.5!important;
  text-shadow:2px 2px 0 rgba(0,0,0,.4)!important;
  text-transform:uppercase;
}
$P .panel>.panel-head h2::after{display:none!important}
$P .panel>.panel-head :is(.eyebrow,small,span:not(.combat-card-icon)):not(.general-stack-toggle *):not(.misc-option-toggle *),
$P .combat-info-card>.combat-card-head small{
  color:rgba(255,255,255,.88)!important;
  font-family:var(--cl-pixel)!important;
  font-size:10px!important;
  text-shadow:1px 1px 0 rgba(0,0,0,.35)!important;
}
$P .panel>.panel-head .eyebrow{
  padding:3px 8px!important;
  border-radius:4px;
  background:rgba(0,0,0,.22)!important;
}
$P .combat-info-card>.combat-card-head .combat-card-icon{
  border:2px solid var(--cl-ink)!important;
  border-radius:4px!important;
  background:var(--cl-card)!important;
  color:var(--cl-banner-dark)!important;
}
$P :is(.general-stack-toggle,.combat-collapse-btn,.misc-option-toggle){
  border:2px solid var(--cl-ink)!important;
  border-radius:6px!important;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  box-shadow:0 2px 0 var(--cl-ink)!important;
}
$P .panel>.panel-head :is(.general-stack-toggle,.combat-collapse-btn,.misc-option-toggle) *,
$P .combat-info-card>.combat-card-head :is(.general-stack-toggle,.combat-collapse-btn) *{color:var(--cl-text)!important;border-color:var(--cl-ink)!important;text-shadow:none!important;font-family:var(--cl-pixel)!important;font-size:10px!important}

$P .combat-info-card>.combat-card-head{min-height:0;padding:8px 10px!important}
$P .combat-info-card>.combat-card-head :is(b,strong){font-size:10px!important;line-height:1.5!important}
$P .combat-info-card>.combat-card-head small{font-size:9px!important;line-height:1.4!important}

/* Trainer Card: cartão claro como o de FireRed / LeafGreen */
$S .sheet #pageTrainer .trainer-license-card{
  --text:var(--cl-text);--muted:var(--cl-muted);--bg:var(--cl-card);--bg2:var(--cl-paper2);--panel:var(--cl-paper);--panel2:var(--cl-paper2);--line:var(--cl-line);
  border:4px solid var(--cl-frame)!important;
  border-radius:16px!important;
  background:
    repeating-linear-gradient(135deg,transparent 0 18px,rgba(0,0,0,.025) 18px 36px),
    linear-gradient(180deg,#fdfcf4,#eef0e0)!important;
  color:var(--cl-text)!important;
  box-shadow:0 0 0 3px var(--cl-ink),8px 8px 0 3px rgba(0,0,0,.4)!important;
  clip-path:none!important;
}
$S .sheet #pageTrainer .trainer-license-card::before,$S .sheet #pageTrainer .trainer-license-card::after{display:none!important}
$S .sheet #pageTrainer .trainer-license-card :is(label,span,small,b,strong,p,h2,h3){color:inherit}
$S .sheet #pageTrainer .trainer-license-card>:first-child{
  border-bottom:3px solid var(--cl-ink)!important;
  background:var(--cl-scan),linear-gradient(180deg,color-mix(in srgb,var(--cl-banner) 85%,#fff),var(--cl-banner) 60%,var(--cl-banner-dark))!important;
}
$S .sheet #pageTrainer .trainer-license-card>:first-child *{color:#fff!important;text-shadow:1px 1px 0 rgba(0,0,0,.35)}
$S .sheet #pageTrainer .trainer-license-card :is(input,textarea,select){
  border:2px solid var(--cl-ink)!important;border-radius:6px!important;background:var(--cl-card)!important;color:var(--cl-text)!important;box-shadow:inset 0 3px 0 var(--cl-inset)!important;
}
$S .sheet #pageTrainer .trainer-license-card :is(.trainer-card-mini-stats>*,.trainer-party-strip,.trainer-badges,.trainer-badge,.trainer-badge-card,[class*="trainer-badge"]){
  border-color:var(--cl-line)!important;background:var(--cl-paper2)!important;color:var(--cl-text)!important;box-shadow:none!important;
}
$S .sheet #pageTrainer .trainer-party-slot{
  border:3px solid var(--cl-ink)!important;border-radius:10px!important;
  background:linear-gradient(180deg,#d8f0ff,#f4fbff 62%,#cfe8c0 62%)!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
}
$S .sheet #pageTrainer .trainer-party-slot:not(.current):not(:has(img)){background:var(--cl-paper2)!important;border-style:dashed!important;box-shadow:none!important}
$S .sheet #pageTrainer .trainer-party-slot.current{box-shadow:0 3px 0 var(--cl-ink),0 0 0 3px #ffd040!important}
$S .sheet #pageTrainer .trainer-party-slot *{color:var(--cl-text)!important}
$S .sheet #pageTrainer .trainer-photo,$S .sheet #pageTrainer [class*="trainer-photo"]{border:3px solid var(--cl-ink)!important;border-radius:10px!important;background:var(--cl-paper2)!important}
$S .sheet #pageTrainer .trainer-mechanics-divider span{
  padding:5px 12px;border:3px solid var(--cl-ink);border-radius:8px;
  background:var(--cl-paper)!important;color:var(--cl-text)!important;
  font-family:var(--cl-pixel)!important;box-shadow:0 3px 0 var(--cl-ink);
}
$S .sheet #pageTrainer .trainer-mechanics-divider i{background:var(--cl-ink)!important;height:3px!important}

$S .drawer .drawer-overview-stat :is(span,b){color:var(--cl-text)!important}
$S .drawer .drawer-overview-stat{border:3px solid var(--cl-ink)!important;border-radius:8px!important;background:var(--cl-card)!important;box-shadow:0 3px 0 var(--cl-ink)!important}

/* Arquivo: faixa de título e cartões de Ability */
$P .misc-menu-hero{padding:14px 18px!important}
$P .misc-menu-hero :is(h3,b,strong){color:var(--cl-text)!important;font-family:var(--cl-title)!important;font-size:14px!important}
$P .misc-menu-hero :is(span,small,p){color:var(--cl-muted)!important}
$P .misc-menu-hero :is([class*="stat"],[class*="metric"]){
  border:2px solid var(--cl-ink)!important;border-radius:6px!important;background:var(--cl-card)!important;box-shadow:0 2px 0 var(--cl-ink)!important;
}
$P .misc-menu-hero :is([class*="stat"],[class*="metric"]) b{color:var(--cl-text)!important}
$S .sheet #page3 :is(.ability-memory-card,.ability-card,.memory-ability-card,.move-card) .move-name{color:var(--cl-text)!important;font-family:var(--cl-title)!important;font-size:11px!important}
$S .sheet #page3 .move-card{
  border:3px solid var(--cl-ink)!important;border-radius:10px!important;background:var(--cl-card)!important;box-shadow:0 3px 0 var(--cl-ink)!important;
}

/* Corpo da janela */
$P .panel>.panel-body,
$P .combat-info-card>:not(.combat-card-head){color:var(--cl-text)}
$P .panel :is(h3,h4,label,.label,.field>label){color:var(--cl-text)}

/* Sub-caixas dentro da janela: cinza claro com contorno fino. */
$P .panel :is(.pokemon-registry-console,.pokemon-data-console,.pokemon-vitals-console,.level-training-console,
  .registry-option-card,.general-identity-drawer,.pokemon-held-item-console,.matchup-group,.derived>div,
  .base-stats-summary,.registry-evolution-bar,.manual-section,.misc-card,.misc-box){
  border:2px solid var(--cl-line)!important;
  border-radius:8px!important;
  background:var(--cl-paper2)!important;
  color:var(--cl-text)!important;
  box-shadow:none!important;
}

/* ---------- Botões ---------- */
$P .btn,$S .modal .btn,$S .drawer .btn{
  min-height:32px;
  border:3px solid var(--cl-ink)!important;
  border-radius:8px!important;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  font-family:var(--cl-pixel)!important;
  font-size:11px!important;
  font-weight:700!important;
  letter-spacing:.05em!important;
  text-transform:uppercase;
  text-shadow:none!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
  transition:transform .06s steps(2),box-shadow .06s steps(2),background .1s!important;
}
$P .btn:hover,$S .modal .btn:hover,$S .drawer .btn:hover{background:var(--cl-paper2)!important}
$P .btn:active:not(:disabled),$S .modal .btn:active:not(:disabled),$S .drawer .btn:active:not(:disabled){transform:translateY(3px)!important;box-shadow:0 0 0 var(--cl-ink)!important}
$P .btn.primary,$S .modal .btn.primary{
  background:var(--cl-scan),linear-gradient(180deg,var(--cl-frame),var(--cl-frame-dark))!important;
  color:#fff!important;
  text-shadow:1px 1px 0 rgba(0,0,0,.35)!important;
}
$P .btn.danger,$S .modal .btn.danger{
  background:var(--cl-scan),linear-gradient(180deg,color-mix(in srgb,var(--cl-banner) 85%,#fff),var(--cl-banner-dark))!important;
  color:#fff!important;
}
$P .btn:disabled{opacity:.5;box-shadow:0 3px 0 var(--cl-ink)!important}

/* ---------- Campos ---------- */
$P :is(.input,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),textarea,select),
$S .modal :is(.input,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),textarea,select){
  border:2px solid var(--cl-ink)!important;
  border-radius:6px!important;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  box-shadow:inset 0 3px 0 var(--cl-inset)!important;
}
$P :is(.input,input,textarea,select)::placeholder,$S .modal :is(.input,input,textarea)::placeholder{color:#8b9097!important;opacity:1}
$P :is(.input,input,textarea,select):focus,$S .modal :is(.input,input,textarea,select):focus{
  outline:none!important;
  border-color:var(--cl-frame-dark)!important;
  box-shadow:inset 0 3px 0 var(--cl-inset),0 0 0 3px color-mix(in srgb,var(--cl-frame) 60%,transparent)!important;
}

/* ---------- Etiquetas ---------- */
$P .tag{
  border:2px solid var(--cl-line)!important;
  border-radius:4px!important;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  font-family:var(--cl-pixel)!important;
}

/* Etiquetas de tipo dos jogos de GBA */
$S .type-icon-badge{
  min-width:0!important;
  min-height:20px!important;
  padding:2px 8px!important;
  border:2px solid var(--type-border)!important;
  border-radius:4px!important;
  clip-path:none!important;
  background:linear-gradient(180deg,var(--type-highlight) 0 45%,var(--type-bg) 45%)!important;
  box-shadow:0 2px 0 var(--cl-ink)!important;
}
$S .type-icon-badge::before{display:none!important}
$S .type-icon-badge .type-icon-label,
$S .sheet #page1 .general-type-strip .type-icon-label{font-size:0!important}
$S .type-icon-badge::after{
  content:attr(title);
  position:relative;
  font-family:var(--cl-pixel);
  font-size:11px;
  font-weight:700;
  letter-spacing:.06em;
  text-transform:uppercase;
  color:#fff;
  text-shadow:1px 1px 0 var(--type-border),-1px 0 0 var(--type-border),0 -1px 0 var(--type-border),1px 0 0 var(--type-border);
  white-space:nowrap;
}

/* ---------- Barras de HP clássicas ---------- */
$S :is(.hp-bar,.drawer-hp-bar,.happiness-bar){
  position:relative;
  height:12px!important;
  padding:2px!important;
  border:2px solid var(--cl-ink)!important;
  border-radius:999px!important;
  background:#3b3f4a!important;
  box-shadow:inset 0 0 0 2px var(--cl-hl)!important;
  overflow:hidden;
}
$S :is(.hp-fill,.drawer-hp-fill){
  height:100%!important;
  border-radius:999px!important;
  background:linear-gradient(180deg,#8cf0a8 0 40%,#40c070 40%)!important;
}
$S :is(.hp-fill.hp-warning,.drawer-hp-fill.warning){background:linear-gradient(180deg,#ffe080 0 40%,#e8b020 40%)!important}
$S :is(.hp-fill.hp-danger,.drawer-hp-fill.danger){background:linear-gradient(180deg,#ff9a88 0 40%,#e04030 40%)!important}

/* ---------- Faixa de título de cada página ---------- */
$P .page-intro{
  display:grid!important;
  padding:12px 16px!important;
}
$P .page-intro .page-intro-mark{
  border:3px solid var(--cl-ink)!important;
  border-radius:50%!important;
  background:var(--cl-scan),linear-gradient(180deg,color-mix(in srgb,var(--cl-banner) 85%,#fff) 0 48%,var(--cl-ink) 48% 56%,#fff 56%)!important;
  color:transparent!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
}
$P .page-intro :is(.page-intro-kicker){
  color:var(--cl-banner-dark)!important;
  font-family:var(--cl-pixel)!important;
  font-weight:700;
}
$P .page-intro :is(h3,h2){
  color:var(--cl-text)!important;
  font-family:var(--cl-title)!important;
  font-size:14px!important;
}
$P .page-intro :is(p,small){color:var(--cl-muted)!important}
$P .page-intro .page-intro-stat{
  border:2px solid var(--cl-ink)!important;
  border-radius:6px!important;
  background:var(--cl-card)!important;
  box-shadow:0 2px 0 var(--cl-ink)!important;
}
$P .page-intro .page-intro-stat span{color:var(--cl-muted)!important;font-family:var(--cl-pixel)!important}
$P .page-intro .page-intro-stat b{color:var(--cl-text)!important;font-family:var(--cl-title)!important;font-size:11px!important}

/* ---------- Rodapé ---------- */
$S .sheet .footer{
  margin-top:16px;
  padding:10px 16px!important;
  border:3px solid var(--cl-ink)!important;
  border-radius:8px!important;
  background:var(--cl-paper)!important;
  color:var(--cl-text)!important;
  box-shadow:0 4px 0 var(--cl-ink)!important;
  font-family:var(--cl-pixel)!important;
}
$S .sheet .footer *{color:var(--cl-text)!important}

/* ============================================================
   PÁGINA GERAL — topo (identidade, status, felicidade)
   ============================================================ */
$G .portrait{
  border:3px solid var(--cl-ink)!important;
  border-radius:10px!important;
  background:
    radial-gradient(ellipse 60% 14% at 50% 86%,rgba(0,0,0,.22),transparent 70%),
    radial-gradient(ellipse 70% 22% at 50% 86%,color-mix(in srgb,var(--cl-frame) 55%,#fff),transparent 72%),
    linear-gradient(180deg,#d8f0ff,#f4fbff 58%,#cfe8c0 58.5%,#e6f4d8)!important;
  box-shadow:inset 0 0 0 2px var(--cl-hl)!important;
}
$G .portrait::before,$G .portrait::after{display:none!important}
$G .portrait .portrait-empty{color:var(--cl-muted)!important}
$G .radar-box{
  border:3px solid var(--cl-ink)!important;
  border-radius:10px!important;
  background:#151a26!important;
  box-shadow:inset 0 0 0 2px var(--cl-hl),inset 0 0 0 4px var(--cl-frame)!important;
}
$G .stat-row{
  border:2px solid var(--cl-ink)!important;
  border-left-width:8px!important;
  border-radius:6px!important;
  background:var(--cl-card)!important;
  box-shadow:0 2px 0 var(--cl-ink)!important;
}
$G .stat-row span{font-family:var(--cl-pixel)!important;color:color-mix(in srgb,currentColor 55%,#000)!important;font-weight:700!important}
$G .stat-row input{color:var(--cl-text)!important}
$G .stat-row.radar-linked{background:var(--cl-paper2)!important}
$G .general-happiness-strip{padding:10px 14px!important}

/* ============================================================
   SEÇÕES DA PÁGINA GERAL (Ability, Fraquezas, Moves)
   ============================================================ */
/* Ability: placa de nome + caixa de diálogo */
$G .general-stack-ability>.panel-body{
  display:grid!important;
  grid-template-columns:minmax(200px,280px) minmax(0,1fr)!important;
  grid-template-rows:auto auto 1fr auto!important;
  column-gap:16px!important;
  row-gap:6px!important;
  align-items:start!important;
  padding:14px 16px 10px!important;
}
$G .general-stack-ability>.panel-body::before,$G .general-stack-ability>.panel-body::after{content:none!important;display:none!important}
$G .cl-ability-label{
  grid-column:1!important;grid-row:1!important;
  justify-self:start!important;
  color:var(--cl-banner-dark);
  font:700 11px var(--cl-pixel);
  letter-spacing:.1em;
}
$G .general-stack-ability #abilityName{
  grid-column:1!important;grid-row:2!important;
  position:static!important;
  width:100%;
  min-height:50px;
  margin:0!important;
  padding:10px 14px!important;
  border:3px solid var(--cl-ink)!important;
  border-radius:8px!important;
  background:var(--cl-scan),linear-gradient(180deg,var(--cl-frame),var(--cl-frame-dark))!important;
  color:#fff!important;
  font-family:var(--cl-title)!important;
  font-size:12px!important;
  text-shadow:2px 2px 0 rgba(0,0,0,.35)!important;
  box-shadow:0 4px 0 var(--cl-ink)!important;
}
$G .cl-dialog{
  position:relative;
  grid-column:2!important;grid-row:1 / span 3!important;
  min-width:0;
}
$G .general-stack-ability #abilityText{
  display:block;
  width:100%;
  min-height:74px!important;
  height:var(--ability-user-height,74px)!important;
  margin:0!important;
  padding:12px 34px 12px 16px!important;
  border:3px solid var(--cl-ink)!important;
  border-radius:10px!important;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  font-size:14px!important;
  line-height:1.65!important;
  box-shadow:inset 0 0 0 3px var(--cl-hl),inset 0 0 0 6px var(--cl-frame)!important;
  resize:none;
}
$G .general-stack-ability .general-ability-resize-handle{
  grid-column:2!important;grid-row:4!important;
  margin:0!important;
  border:0!important;
  background:transparent!important;
  opacity:.55;
}

/* Fraquezas: duas colunas com medalhões de multiplicador */
$G .general-stack-weakness .matchup-groups{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  grid-template-areas:"hw hr" "x4 half" "x2 quarter" ". zero"!important;
  gap:8px 14px!important;
}
$G .general-stack-weakness .matchup-groups::before,
$G .general-stack-weakness .matchup-groups::after{
  justify-self:start;
  padding:5px 12px;
  border:2px solid var(--cl-ink);
  border-radius:6px;
  color:#fff;
  font:700 11px var(--cl-pixel);
  letter-spacing:.08em;
  text-shadow:1px 1px 0 rgba(0,0,0,.35);
  box-shadow:0 2px 0 var(--cl-ink);
}
$G .general-stack-weakness .matchup-groups::before{content:"▲ RECEBE MAIS DANO";grid-area:hw;background:#d04838}
$G .general-stack-weakness .matchup-groups::after{content:"▼ RECEBE MENOS DANO";grid-area:hr;background:#38a060}
$G .general-stack-weakness .matchup-super{grid-area:x4;--cl-mult:#e04838}
$G .general-stack-weakness .matchup-effective{grid-area:x2;--cl-mult:#f08830}
$G .general-stack-weakness .matchup-resist{grid-area:half;--cl-mult:#38a868}
$G .general-stack-weakness .matchup-hyper{grid-area:quarter;--cl-mult:#2898b0}
$G .general-stack-weakness .matchup-immune{grid-area:zero;grid-column:2!important;grid-row:4!important;--cl-mult:#8088a0}
$G .general-stack-weakness .matchup-group{
  display:grid!important;
  grid-template-columns:48px minmax(0,1fr)!important;
  grid-template-areas:"med title" "med types" "med rule"!important;
  column-gap:12px!important;
  row-gap:6px!important;
  align-items:center;
  min-height:0!important;
  margin:0!important;
  padding:10px 12px 10px 10px!important;
  border:2px solid var(--cl-ink)!important;
  border-left:8px solid var(--cl-mult)!important;
  border-radius:8px!important;
  background:var(--cl-card)!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
}
$G .general-stack-weakness .matchup-group::before{
  grid-area:med;
  display:grid;place-items:center;
  width:46px;height:46px;
  border:3px solid var(--cl-ink);
  border-radius:50%;
  background:linear-gradient(180deg,color-mix(in srgb,var(--cl-mult) 55%,#fff) 0 45%,var(--cl-mult) 45%);
  color:#fff;
  font:400 11px var(--cl-title);
  text-shadow:1px 1px 0 rgba(0,0,0,.45);
}
$G .general-stack-weakness .matchup-super::before{content:"×4"}
$G .general-stack-weakness .matchup-effective::before{content:"×2"}
$G .general-stack-weakness .matchup-resist::before{content:"×½"}
$G .general-stack-weakness .matchup-hyper::before{content:"×¼"}
$G .general-stack-weakness .matchup-immune::before{content:"×0"}
$G .general-stack-weakness .matchup-group h3{grid-area:title;margin:0!important;color:var(--cl-text)!important;font-family:var(--cl-pixel)!important;font-size:12px!important;font-weight:700!important}
$G .general-stack-weakness .matchup-types{grid-area:types;display:flex!important;flex-wrap:wrap;gap:6px!important;min-height:0!important}
$G .general-stack-weakness .matchup-rule{grid-area:rule;margin:0!important;padding:0!important;border:0!important;color:var(--cl-muted)!important;font-size:11px!important;line-height:1.45!important}
$G .general-stack-weakness .matchup-empty{color:var(--cl-muted)!important;font-size:12px!important}
$G .general-stack-weakness .matchup-group:has(.matchup-empty){opacity:.6}
$G .general-stack-weakness .matchup-group:has(.matchup-empty) .matchup-rule{display:none}

/* Moves: lista de golpes como na tela de resumo */
$G .general-stack-moves .learnset-helper{
  padding:8px 12px 8px 36px!important;
  border:2px solid var(--cl-line)!important;
  border-radius:8px!important;
  background:var(--cl-paper2)!important;
  color:var(--cl-muted)!important;
  font-size:12px!important;
  position:relative;
}
$G .general-stack-moves .learnset-helper::before{
  content:"!";
  position:absolute;left:9px;top:50%;
  display:grid;place-items:center;
  width:18px;height:18px;
  border:2px solid var(--cl-ink);
  border-radius:50%;
  background:#ffd040;
  color:var(--cl-ink);
  font:700 11px var(--cl-pixel);
  transform:translateY(-50%);
}
$G #memoryMoves{
  display:grid!important;
  align-content:start;
  gap:8px!important;
  max-height:600px!important;
  padding:4px 10px 8px 4px!important;
  scrollbar-width:thin;
}
$G #memoryMoves .move-card,$G #memoryMoves .move-card-top{min-height:0!important;height:auto!important}
$G #memoryMoves .move-card{
  position:relative;
  margin:0!important;
  padding:0!important;
  border:3px solid var(--cl-ink)!important;
  border-radius:10px!important;
  background:linear-gradient(90deg,var(--move-type,#888) 0 10px,#fff 10px)!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
  cursor:pointer;
  outline:none;
  transition:transform .06s steps(2)!important;
  filter:none!important;
}
$G #memoryMoves .move-card:hover,$G #memoryMoves .move-card.cl-selected,$G #memoryMoves .move-card:focus-visible{
  background:linear-gradient(90deg,var(--move-type,#888) 0 10px,var(--cl-paper2) 10px)!important;
}
$G #memoryMoves .move-card.cl-selected{box-shadow:0 3px 0 var(--cl-ink),0 0 0 3px var(--cl-frame)!important}
$G #memoryMoves .move-card-top{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  gap:10px 14px!important;
  align-items:center!important;
  padding:10px 12px 10px 22px!important;
}
$G #memoryMoves .move-card-top>div:first-child{
  display:grid!important;
  grid-template-columns:auto minmax(0,1fr) auto;
  grid-template-areas:"type name stats" "meta meta meta" "desc desc desc";
  align-items:center;
  column-gap:12px;
  row-gap:6px;
  min-width:0;
}
$G #memoryMoves .cl-move-type{grid-area:type}
$G #memoryMoves .move-name{
  grid-area:name;
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  min-width:0;
  margin:0!important;
  color:var(--cl-text)!important;
  font-family:var(--cl-title)!important;
  font-size:11px!important;
  line-height:1.6!important;
  text-shadow:none!important;
}
$G #memoryMoves .cl-move-stats{grid-area:stats;display:flex;gap:6px}
$G #memoryMoves .cl-move-stat{
  display:grid;
  min-width:56px;
  padding:3px 8px;
  border:2px solid var(--cl-ink);
  border-radius:6px;
  background:var(--cl-paper2);
  text-align:center;
}
$G #memoryMoves .cl-move-stat small{color:var(--cl-muted);font:700 9px var(--cl-pixel);letter-spacing:.08em}
$G #memoryMoves .cl-move-stat b{color:var(--cl-text);font:400 10px var(--cl-title)}
$G #memoryMoves .move-meta{grid-area:meta;display:flex!important;flex-wrap:wrap;gap:5px!important;margin:0!important}
$G #memoryMoves .move-meta>.type-icon-badge,$G #memoryMoves .move-meta>.cl-hide{display:none!important}
$G #memoryMoves .move-meta>.tag{font-size:10.5px!important;padding:2px 7px!important}
$G #memoryMoves .move-description{
  grid-area:desc;
  display:block!important;
  min-height:0!important;max-height:none!important;height:auto!important;
  margin:0!important;
  padding:6px 0 0!important;
  border:0!important;
  border-top:2px dashed var(--cl-line)!important;
  background:none!important;
  color:var(--cl-muted)!important;
  font-size:12.5px!important;
  line-height:1.5!important;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
$G #memoryMoves .move-card.cl-selected .move-description{
  white-space:normal;
  padding:10px 14px!important;
  border:3px solid var(--cl-ink)!important;
  border-radius:8px;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  box-shadow:inset 0 0 0 2px var(--cl-hl),inset 0 0 0 4px var(--cl-frame)!important;
}
$G #memoryMoves .move-card[data-cl-state="active"] .move-name::after{
  content:"EQUIPADO";
  padding:2px 6px;
  border:2px solid var(--cl-ink);
  border-radius:4px;
  background:#ffd040;
  color:var(--cl-ink);
  font:700 9px var(--cl-pixel);
  letter-spacing:.08em;
}
$G #memoryMoves .move-card[data-cl-state="locked"]{filter:grayscale(1) opacity(.7)!important;border-style:dashed!important}
$G #memoryMoves .move-card[data-cl-state="locked"] .move-name::before{content:"🔒";font-size:11px}
$G #memoryMoves .move-actions{display:flex!important;gap:5px!important;align-self:center}
$G #memoryMoves .move-actions .btn{min-height:30px!important;padding:4px 10px!important;font-size:10px!important}
$G #memoryMoves .move-actions .btn.toggle{background:var(--cl-scan),linear-gradient(180deg,var(--cl-frame),var(--cl-frame-dark))!important;color:#fff!important}
$G #memoryMoves .move-card[data-cl-state="active"] .move-actions .btn.toggle{background:var(--cl-card)!important;color:var(--cl-text)!important}
#memoryMoves[data-cl-filter="active"] .move-card:not([data-cl-state="active"]),
#memoryMoves[data-cl-filter="available"] .move-card[data-cl-state="locked"],
#memoryMoves[data-cl-filter="locked"] .move-card:not([data-cl-state="locked"]){display:none!important}

/* Ícone de categoria (como nos jogos de GBA/DS) */
.cl-move-cat{
  flex:0 0 auto;
  display:inline-grid;place-items:center;
  min-width:44px;height:18px;
  padding:0 4px;
  border:2px solid var(--cl-ink);
  border-radius:4px;
  color:#fff;
  font:700 9px var(--cl-pixel);
  letter-spacing:.04em;
  text-shadow:1px 1px 0 rgba(0,0,0,.4);
}
.cl-move-cat.physical{background:linear-gradient(180deg,#f8a060 0 45%,#d85820 45%)}
.cl-move-cat.special{background:linear-gradient(180deg,#80a8f8 0 45%,#4060c8 45%)}
.cl-move-cat.status{background:linear-gradient(180deg,#d0d0d0 0 45%,#8890a0 45%)}

/* Abas de filtro */
.cl-move-filters{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.cl-move-filters button{
  display:inline-flex;align-items:center;gap:8px;
  padding:6px 12px;
  border:3px solid var(--cl-ink);
  border-radius:8px;
  background:var(--cl-card);
  color:var(--cl-text);
  font:700 11px var(--cl-pixel);
  letter-spacing:.06em;
  text-transform:uppercase;
  box-shadow:0 3px 0 var(--cl-ink);
  cursor:pointer;
}
.cl-move-filters button b{
  min-width:20px;padding:1px 5px;
  border-radius:4px;
  background:var(--cl-paper3);
  font-size:10px;
}
.cl-move-filters button[aria-pressed="true"]{
  background:var(--cl-scan),linear-gradient(180deg,var(--cl-frame),var(--cl-frame-dark));
  color:#fff;
}
.cl-move-filters button[aria-pressed="true"] b{background:rgba(0,0,0,.25)}
.cl-move-filters button:active{transform:translateY(3px);box-shadow:none}

/* ============================================================
   GAVETA (Box & Bolsa) — caixa do PC
   ============================================================ */
$S .drawer{
  --text:var(--cl-text);--muted:var(--cl-muted);--bg:var(--cl-card);--bg2:var(--cl-paper2);--panel:var(--cl-paper);--panel2:var(--cl-paper2);--line:var(--cl-line);
  border-right:4px solid var(--cl-ink)!important;
  background:
    var(--cl-ball),
    linear-gradient(180deg,color-mix(in srgb,var(--cl-frame) 55%,#fff),color-mix(in srgb,var(--cl-frame) 80%,#fff))!important;
  background-size:48px 48px,auto!important;
}
$S .drawer :is(.drawer-title,.drawer-section,.drawer-group,.drawer-stat,.drawer-counter,.drawer-summary>*,.pokemon-group,.drawer-list-head){
  border:3px solid var(--cl-ink)!important;
  border-radius:10px!important;
  background:var(--cl-paper)!important;
  color:var(--cl-text)!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
}
$S .drawer .pokemon-card{
  border:3px solid var(--cl-ink)!important;
  border-left:8px solid var(--drawer-card-type,var(--cl-frame))!important;
  border-radius:10px!important;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
}
$S .drawer .pokemon-card.active{background:linear-gradient(90deg,color-mix(in srgb,var(--cl-frame) 30%,#fff),#fff)!important;box-shadow:0 3px 0 var(--cl-ink),0 0 0 3px #ffd040!important}
$S .drawer .pokemon-card *{color:var(--cl-text)}
$S .drawer .pokemon-thumb-stage{border:2px solid var(--cl-ink)!important;border-radius:8px!important;background:linear-gradient(180deg,#d8f0ff,#f4fbff 60%,#cfe8c0 60%)!important}

/* ============================================================
   MODAIS — janela por cima da tela
   ============================================================ */
$S .modal-backdrop{background:rgba(8,10,20,.72)!important;backdrop-filter:none!important}
$S .modal{
  --text:var(--cl-text);--muted:var(--cl-muted);--bg:var(--cl-card);--bg2:var(--cl-paper2);--panel:var(--cl-paper);--panel2:var(--cl-paper2);--line:var(--cl-line);
  border:4px solid var(--cl-frame)!important;
  border-radius:14px!important;
  background:var(--cl-paper)!important;
  color:var(--cl-text)!important;
  box-shadow:0 0 0 3px var(--cl-ink),8px 8px 0 3px rgba(0,0,0,.45)!important;
}
$S .modal .modal-head{
  border-bottom:3px solid var(--cl-ink)!important;
  background:var(--cl-scan),linear-gradient(180deg,color-mix(in srgb,var(--cl-banner) 85%,#fff),var(--cl-banner) 60%,var(--cl-banner-dark))!important;
  color:#fff!important;
}
$S .modal .modal-head :is(b,h2,h3){color:#fff!important;font-family:var(--cl-title)!important;font-size:12px!important;text-shadow:2px 2px 0 rgba(0,0,0,.35)}
$S .modal .modal-head :is(small,div>div,span){color:rgba(255,255,255,.88)!important}
$S .modal :is(.theme-option,.font-option,.appearance-tab){
  border:3px solid var(--cl-ink)!important;
  border-radius:8px!important;
  background:var(--cl-card)!important;
  color:var(--cl-text)!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
}
$S .modal :is(.theme-option,.font-option,.appearance-tab) *{color:var(--cl-text)!important}
$S .modal :is(.theme-option,.font-option,.appearance-tab).active{
  background:linear-gradient(90deg,color-mix(in srgb,var(--cl-frame) 35%,#fff),#fff)!important;
  box-shadow:0 3px 0 var(--cl-ink),0 0 0 3px #ffd040!important;
}

/* ============================================================
   AVISOS — caixa de diálogo na parte de baixo
   ============================================================ */
$S .toast{
  left:50%!important;right:auto!important;bottom:20px!important;
  width:min(620px,calc(100vw - 32px))!important;
  max-width:none!important;
  padding:16px 44px 16px 20px!important;
  border:4px solid var(--cl-frame)!important;
  border-radius:12px!important;
  background:var(--cl-paper)!important;
  color:var(--cl-text)!important;
  font-family:var(--cl-pixel)!important;
  font-size:13px!important;
  font-weight:700!important;
  line-height:1.6!important;
  text-align:left!important;
  box-shadow:0 0 0 3px var(--cl-ink),6px 6px 0 3px rgba(0,0,0,.45)!important;
  transform:translate(-50%,20px)!important;
}
$S .toast.show{transform:translate(-50%,0)!important}
$S .toast::after{
  content:"▼";
  position:absolute;right:16px;bottom:12px;
  color:var(--cl-banner);
  font-size:11px;
  animation:clBlink .8s steps(1) infinite;
}
#hhLocalSaveButton{
  border:3px solid var(--cl-ink)!important;
  border-radius:8px!important;
  background:var(--cl-paper)!important;
  color:var(--cl-text)!important;
  font:700 11px var(--cl-pixel)!important;
  box-shadow:0 3px 0 var(--cl-ink)!important;
}

/* ---------- Cursor ▶ que acompanha o item sob o mouse ---------- */
.cl-cursor{
  position:fixed;
  z-index:10050;
  left:0;top:0;
  color:var(--cl-banner,#d8343c);
  font-size:14px;
  line-height:1;
  text-shadow:2px 2px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;
  pointer-events:none;
  opacity:0;
  transition:opacity .1s;
}
.cl-cursor.on{opacity:1}
.cl-cursor i{display:block;font-style:normal;animation:clNudge .5s steps(2) infinite}
@keyframes clNudge{50%{transform:translateX(3px)}}

/* ---------- Transição de tela (persianas, como nos menus antigos) ---------- */
.cl-wipe{
  position:fixed;inset:0;z-index:10040;
  display:grid;grid-template-rows:repeat(10,1fr);
  pointer-events:none;
}
.cl-wipe i{
  display:block;
  background:var(--cl-ink);
  transform:scaleY(0);
  animation:clBlind .34s steps(5) both;
}
.cl-wipe i:nth-child(odd){transform-origin:top}
.cl-wipe i:nth-child(even){transform-origin:bottom}
@keyframes clBlind{0%{transform:scaleY(0)}45%,55%{transform:scaleY(1)}100%{transform:scaleY(0)}}

/* ---------- Botão de som ---------- */
.cl-sound-btn{
  display:inline-grid;place-items:center;
  min-width:40px;height:36px;
  padding:0 8px;
  border:3px solid var(--cl-ink);
  border-radius:8px;
  background:var(--cl-paper);
  color:var(--cl-text);
  font:700 12px var(--cl-pixel);
  box-shadow:0 3px 0 var(--cl-ink);
  cursor:pointer;
}
.cl-sound-btn[aria-pressed="false"]{color:#999}
.cl-sound-btn:active{transform:translateY(3px);box-shadow:none}

@keyframes clBlink{50%{opacity:0}}

/* ---------- Telas menores ---------- */
@media (max-width:1240px){
  $S .sheet .sheet-navigation .page-tabs{flex-wrap:wrap!important}
}
@media (max-width:900px){
  $G .general-stack-ability>.panel-body{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto auto auto auto!important}
  $G .cl-dialog{grid-column:1!important;grid-row:3!important}
  $G .general-stack-ability .general-ability-resize-handle{grid-column:1!important;grid-row:4!important}
  $G .general-stack-weakness .matchup-groups{grid-template-columns:minmax(0,1fr)!important;grid-template-areas:"hw" "x4" "x2" "hr" "half" "quarter" "zero"!important}
  $G .general-stack-weakness .matchup-immune{grid-column:1!important;grid-row:auto!important}
  .cl-lr-hint{display:none}
}
@media (max-width:640px){
  $S .sheet .sheet-title input{font-size:16px!important}
  $P .panel>.panel-head :is(h2,h3,b,strong){font-size:10px!important}
  $G #memoryMoves .move-card-top{grid-template-columns:minmax(0,1fr)!important}
  $G #memoryMoves .move-card-top>div:first-child{grid-template-columns:auto minmax(0,1fr);grid-template-areas:"type name" "stats stats" "meta meta" "desc desc"}
  $G #memoryMoves .move-actions{justify-content:flex-end}
  .cl-move-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
  .cl-move-filters button{justify-content:space-between}
}

@media (prefers-reduced-motion: reduce){
  $S::before{animation:none!important}
  .cl-cursor i,.cl-wipe{animation:none!important;display:none}
  $S .toast::after{animation:none!important}
}
'''

out = CSS.replace('$G', G).replace('$P', P).replace('$S', S)
Path(__file__).resolve().parent.parent.joinpath('styles', 'classic-ui-v6.css').write_text(out.lstrip(), encoding='utf-8')
print('styles/classic-ui-v6.css', len(out), 'bytes')
