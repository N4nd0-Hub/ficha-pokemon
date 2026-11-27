const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../scripts/arena-engine-v7.js");
const { interpret } = require("../scripts/item-rules-v7.js");

function statDice(v) { v = Number(v || 0); if (v < 50) return { dice: 0, fixed: 0 }; if (v <= 75) return { dice: 1, fixed: 0 }; if (v <= 100) return { dice: 2, fixed: 0 }; if (v <= 125) return { dice: 3, fixed: 0 }; if (v <= 150) return { dice: 4, fixed: 0 }; if (v <= 175) return { dice: 5, fixed: 0 }; return { dice: 6, fixed: Math.floor((v - 175) / 15) }; }
function powerToDice(p) { p = Number(p || 0); if (p <= 0) return "—"; if (p <= 20) return "1d6"; if (p <= 40) return "2d6"; if (p <= 60) return "3d6"; if (p <= 80) return "4d6"; if (p <= 100) return "5d6"; return "6d6"; }
const CHART = { Fire: { Grass: 2 }, Water: { Fire: 2 } };
const typeMultiplier = (t, defs) => defs.reduce((m, d) => m * (CHART[t]?.[d] ?? 1), 1);
const eng = (rand = () => 0.5) => create({ statDice, powerToDice, typeMultiplier, normalizeType: x => x, rand });
const mon = (name, types, stats, moves, extra = {}) => ({ name, types, stats: { hp: 160, atk: 100, def: 60, spa: 60, spd: 60, spe: 80, ...stats }, maxHp: stats.hp || 160, moves, ...extra });
const tackle = { name: "Tackle", type: "Normal", category: "Physical", power: 40, accuracy: 90 };
const ember = { name: "Ember", type: "Fire", category: "Special", power: 40, accuracy: 90 };
const I = (name, description, automation) => ({ name, description, automation });
const LEFT = I("Leftovers", "Segurado: ao fim de cada rodada, recupera 1/16 (6,25%) do HP Máximo do usuário.", { trigger: "endRound", kind: "healFraction", num: 1, den: 16 });
function duel(a, b, opts = {}) { const e = eng(opts.rand); const bt = e.newBattle({ id: "i", format: 6, damage: opts.damage, p1: { id: "A", name: "A", team: [a] }, p2: { id: "B", name: "B", team: [b] } }); return { e, bt }; }
const turn = (e, bt, a = { kind: "move", idx: 0 }, b = { kind: "move", idx: 0 }) => { e.submit(bt, "p1", a); e.submit(bt, "p2", b); return e.resolve(bt); };

test("leitor entende os itens principais", () => {
  assert.deepEqual(interpret(I("Charcoal", "Segurado: golpes Fire do usuário causam +1 dado da QD.")).battle.typeQD, { types: ["Fire"], n: 1 });
  assert.equal(interpret(I("Choice Band", "Segurado: Attack ×1,5 (sobe a Qualidade). Depois de escolher um golpe, fica preso nele enquanto segurar o item.")).battle.statMult.atk, 1.5);
  assert.equal(interpret(LEFT).battle.endHeal, 1 / 16);
  assert.ok(interpret(LEFT).tags.length);
});

test("Leftovers cura 1/16 no fim da rodada", () => {
  const { e, bt } = duel(mon("A", ["Normal"], {}, [tackle], { item: LEFT }), mon("B", ["Normal"], {}, [{ ...tackle, accuracy: 1 }]));
  e.activeState(bt, "p1").hp = 100;
  const evs = turn(e, bt, { kind: "move", idx: 0 }, { kind: "move", idx: 0 });
  assert.ok(evs.some(x => x.k === "heal" && x.side === "p1" && x.src === "Leftovers" && x.amount === 10));
});

test("Charcoal dá +1 dado da QD em golpes Fire (experimental)", () => {
  const ch = I("Charcoal", "Segurado: golpes Fire do usuário causam +1 dado da QD.");
  const { e, bt } = duel(mon("A", ["Normal"], { spe: 200, spa: 100 }, [ember], { item: ch }), mon("B", ["Normal"], { hp: 500 }, [tackle]), { damage: "matrix" });
  const hit = turn(e, bt).find(x => x.k === "hit" && x.side === "p2");
  assert.equal(hit.count, 3); // 2 dados de Poder + 1 do Charcoal
  assert.ok(hit.notes.includes("Charcoal +1 QD"));
});

test("Choice Band: Attack ×1,5 e fica preso no golpe", () => {
  const cb = I("Choice Band", "Segurado: Attack ×1,5. Depois de escolher um golpe, fica preso nele enquanto segurar o item.");
  const { e, bt } = duel(mon("A", ["Normal"], { atk: 100, spe: 200 }, [tackle, { ...tackle, name: "Headbutt" }], { item: cb }), mon("B", ["Normal"], { hp: 500 }, [tackle]));
  assert.equal(e.effStat(bt, "p1", "atk"), 150);
  turn(e, bt);
  e.submit(bt, "p1", { kind: "move", idx: 1 });
  assert.equal(bt.sides.p1.pending, null);            // outro golpe: recusado
  e.submit(bt, "p1", { kind: "move", idx: 0 });
  assert.equal(bt.sides.p1.pending.idx, 0);           // o mesmo golpe: aceito
});

test("Sitrus Berry cura 1/4 ao cair para metade do HP e é consumida", () => {
  const sit = I("Sitrus Berry", "Segurado: ao chegar a 1/2 do HP Máximo ou menos, é consumido e recupera 1/4 do HP Máximo.", { trigger: "hp", kind: "healThresholdFraction", thresholdNum: 1, thresholdDen: 2, num: 1, den: 4, consume: true });
  const big = { name: "Mega Hit", type: "Normal", category: "Physical", power: 150, accuracy: 90 };
  const { e, bt } = duel(mon("A", ["Normal"], { spe: 1 }, [tackle], { item: sit }), mon("B", ["Normal"], { atk: 200, spe: 200 }, [big]));
  e.activeState(bt, "p1").hp = 120;   // 49 de dano leva para 71 (< metade)
  const evs = turn(e, bt);
  assert.ok(evs.some(x => x.k === "held" && x.item === "Sitrus Berry"));
  assert.ok(evs.some(x => x.k === "heal" && x.src === "Sitrus Berry" && x.amount === 40));
  assert.equal(e.activeState(bt, "p1").itemGone, true);
});

test("Focus Sash aguenta golpe fatal com HP cheio; baga de resistência corta o dano", () => {
  const sash = I("Focus Sash", "Segurado: se estiver com HP cheio, sobrevive a um ataque de um único hit com 1 HP; depois o item é consumido.");
  const big = { name: "Mega Hit", type: "Normal", category: "Physical", power: 150, accuracy: 90 };
  const r = duel(mon("A", ["Normal"], { hp: 20, spe: 1 }, [tackle], { item: sash }), mon("B", ["Normal"], { atk: 250, spe: 200 }, [big]));
  turn(r.e, r.bt);
  assert.equal(r.e.activeState(r.bt, "p1").hp, 1);
  const occa = I("Occa Berry", "Segurado: consumida ao levar um golpe Fire super efetivo; o dano desse golpe cai pela metade.");
  const fire = { name: "Flamethrower", type: "Fire", category: "Special", power: 90, accuracy: 90 };
  const q = duel(mon("A", ["Grass"], { hp: 500, spe: 1 }, [tackle], { item: occa }), mon("B", ["Fire"], { spa: 120, spe: 200 }, [fire]));
  const hit = turn(q.e, q.bt).find(x => x.k === "hit" && x.side === "p1");
  assert.ok(hit.notes.includes("Occa Berry ½"));
});

test("item de outra espécie não funciona (Light Ball fora do Pikachu)", () => {
  const lb = I("Light Ball", "Segurado por Pikachu: Attack e Sp.Atk ×2. Criação: ovo de Pichu vem com Volt Tackle.");
  const { e, bt } = duel(mon("Eevee", ["Normal"], { atk: 100 }, [tackle], { item: lb }), mon("B", ["Normal"], {}, [tackle]));
  assert.equal(e.effStat(bt, "p1", "atk"), 100);
  const p = duel(mon("Pikachu", ["Electric"], { atk: 100 }, [tackle], { item: lb }), mon("B", ["Normal"], {}, [tackle]));
  assert.equal(p.e.effStat(p.bt, "p1", "atk"), 200);
});
