const test = require("node:test");
const assert = require("node:assert/strict");
const { create, movePriority } = require("../scripts/arena-engine-v7.js");

// Mesmas faixas da ficha (statDice / powerToDice).
function statDice(v) {
  v = Number(v || 0);
  if (v < 50) return { dice: 0, fixed: 0 };
  if (v <= 75) return { dice: 1, fixed: 0 };
  if (v <= 100) return { dice: 2, fixed: 0 };
  if (v <= 125) return { dice: 3, fixed: 0 };
  if (v <= 150) return { dice: 4, fixed: 0 };
  if (v <= 175) return { dice: 5, fixed: 0 };
  return { dice: 6, fixed: Math.floor((v - 175) / 15) };
}
function powerToDice(p) {
  p = Number(p || 0);
  if (p <= 0) return "—";
  if (p <= 20) return "1d6"; if (p <= 40) return "2d6"; if (p <= 60) return "3d6";
  if (p <= 80) return "4d6"; if (p <= 100) return "5d6"; return "6d6";
}
const CHART = { Water: { Fire: 2, Water: 0.5, Grass: 0.5 }, Fire: { Grass: 2, Water: 0.5 }, Normal: { Ghost: 0 }, Electric: { Ground: 0 } };
const typeMultiplier = (t, defs) => defs.reduce((m, d) => m * (CHART[t]?.[d] ?? 1), 1);
function seq(values) { let i = 0; return () => values[i++ % values.length]; }
function engine(rand) { return create({ statDice, powerToDice, typeMultiplier, normalizeType: x => x, rand }); }
const mon = (name, types, stats, moves) => ({ name, types, stats: { hp: 100, atk: 100, def: 60, spa: 60, spd: 60, spe: 80, ...stats }, maxHp: stats.hp || 100, moves });
const surf = { name: "Surf", type: "Water", category: "Special", power: 90, accuracy: 90 };
const tackle = { name: "Tackle", type: "Normal", category: "Physical", power: 40, accuracy: 90 };
const quick = { name: "Quick Attack", type: "Normal", category: "Physical", power: 40, accuracy: 90 };

function battle(rand, a, b) {
  const e = engine(rand);
  const bt = e.newBattle({ id: "t", format: 3, p1: { id: "A", name: "Ana", team: a }, p2: { id: "B", name: "Beto", team: b } });
  return { e, bt };
}

test("prioridade vem da lista e da descrição", () => {
  assert.equal(movePriority({ name: "Quick Attack" }), 1);
  assert.equal(movePriority({ name: "Inventado", desc: "Prioridade +2. Ataca." }), 2);
  assert.equal(movePriority({ name: "Counter" }), -5);
  assert.equal(movePriority({ name: "Tackle" }), 0);
});

test("golpe de prioridade age antes mesmo sendo mais lento", () => {
  const { e, bt } = battle(() => 0.5,
    [mon("Lento", ["Normal"], { spe: 10 }, [quick])],
    [mon("Rápido", ["Normal"], { spe: 200 }, [tackle])]);
  e.submit(bt, "p1", { kind: "move", idx: 0 });
  assert.equal(e.submit(bt, "p2", { kind: "move", idx: 0 }), true);
  const ev = e.resolve(bt).filter(x => x.k === "move");
  assert.equal(ev[0].side, "p1");
});

test("super efetivo soma dado e tira metade da defesa; STAB soma 1d6", () => {
  // rolagens: d100=50 (acerta), d6 todos 3
  const { e, bt } = battle(seq([0.49, 0.4]),
    [mon("Água", ["Water"], { spa: 100, spe: 100 }, [surf])],
    [mon("Fogo", ["Fire"], { spd: 110, spe: 1 }, [tackle])]);
  e.submit(bt, "p1", { kind: "move", idx: 0 }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  const hit = e.resolve(bt).find(x => x.k === "hit" && x.side === "p2");
  // Power 90 = 5d6; Sp.Atk 100 = +2d6; STAB +1d6; 2× = +1d6; Sp.Def 110 = 3d6 → metade = 1d6 → 8d6
  assert.equal(hit.mult, 2);
  assert.equal(hit.dice, 8);
  assert.equal(hit.stab, true);
});

test("imunidade zera o dano", () => {
  const { e, bt } = battle(() => 0.3,
    [mon("Normal", ["Normal"], {}, [tackle])],
    [mon("Fantasma", ["Ghost"], {}, [tackle])]);
  e.submit(bt, "p1", { kind: "move", idx: 0 }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  const hit = e.resolve(bt).find(x => x.k === "hit" && x.side === "p2");
  assert.equal(hit.amount, 0);
  assert.equal(hit.immune, true);
});

test("erro quando o d100 passa da precisão; crítico em 01–05 acerta sempre", () => {
  const miss = battle(seq([0.95, 0.1]), [mon("A", ["Normal"], { spe: 100 }, [tackle])], [mon("B", ["Normal"], { spe: 1 }, [tackle])]);
  miss.e.submit(miss.bt, "p1", { kind: "move", idx: 0 }); miss.e.submit(miss.bt, "p2", { kind: "move", idx: 0 });
  assert.equal(miss.e.resolve(miss.bt).find(x => x.k === "move" && x.side === "p1").miss, true);
  const crit = battle(seq([0.02, 0.1]), [mon("A", ["Normal"], { spe: 100 }, [{ ...tackle, accuracy: 10 }])], [mon("B", ["Normal"], { spe: 1 }, [tackle])]);
  crit.e.submit(crit.bt, "p1", { kind: "move", idx: 0 }); crit.e.submit(crit.bt, "p2", { kind: "move", idx: 0 });
  const hit = crit.e.resolve(crit.bt).find(x => x.k === "hit" && x.side === "p2");
  assert.equal(hit.crit, true);
  assert.ok(hit.amount >= 12, "Power 40 = 2d6 no máximo (12 fixo) no crítico");
});

test("Pokémon nocauteado pede troca e o time sem Pokémon perde", () => {
  const big = { name: "Mega Soco", type: "Normal", category: "Physical", power: 150, accuracy: null };
  const { e, bt } = battle(() => 0.5,
    [mon("Forte", ["Normal"], { atk: 200, spe: 100 }, [big])],
    [mon("Fraco1", ["Normal"], { hp: 5, spe: 1 }, [tackle]), mon("Fraco2", ["Normal"], { hp: 5, spe: 1 }, [tackle])]);
  e.submit(bt, "p1", { kind: "move", idx: 0 }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  e.resolve(bt);
  assert.equal(bt.phase, "switch");
  assert.equal(bt.sides.p2.needSwitch, true);
  assert.equal(e.submit(bt, "p1", { kind: "move", idx: 0 }), false, "quem não precisa trocar espera");
  assert.equal(e.submit(bt, "p2", { kind: "switch", idx: 1 }), true);
  e.resolve(bt);
  assert.equal(bt.phase, "choose");
  e.submit(bt, "p1", { kind: "move", idx: 0 }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  e.resolve(bt);
  assert.equal(bt.phase, "end");
  assert.equal(bt.winner, "p1");
});

test("Protect bloqueia e desistir encerra", () => {
  const protect = { name: "Protect", type: "Normal", category: "Status", power: 0, accuracy: null };
  const { e, bt } = battle(() => 0.5, [mon("A", ["Normal"], {}, [tackle])], [mon("B", ["Normal"], {}, [protect])]);
  e.submit(bt, "p1", { kind: "move", idx: 0 }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  const ev = e.resolve(bt);
  assert.ok(ev.some(x => x.k === "blocked"));
  assert.equal(bt.sides.p2.team[0].hp, 100);
  e.submit(bt, "p2", { kind: "forfeit" });
  e.resolve(bt);
  assert.equal(bt.winner, "p1");
});
