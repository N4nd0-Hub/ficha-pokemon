const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../scripts/arena-engine-v7.js");

function statDice(v) { v = Number(v || 0); if (v < 50) return { dice: 0, fixed: 0 }; if (v <= 75) return { dice: 1, fixed: 0 }; if (v <= 100) return { dice: 2, fixed: 0 }; return { dice: 3, fixed: 0 }; }
function powerToDice(p) { p = Number(p || 0); if (p <= 0) return "—"; if (p <= 40) return "2d6"; if (p <= 80) return "4d6"; return "5d6"; }
const typeMultiplier = () => 1;
const eng = (rand = () => 0.5) => create({ statDice, powerToDice, typeMultiplier, normalizeType: x => x, rand });
const mon = (name, stats, moves, extra = {}) => ({ name, types: ["Normal"], stats: { hp: 200, atk: 100, def: 60, spa: 60, spd: 60, spe: 80, ...stats }, maxHp: stats.hp || 200, moves, ...extra });
const tackle = { name: "Tackle", type: "Normal", category: "Physical", power: 40, accuracy: 100 };
const slide = { name: "Rock Slide", type: "Rock", category: "Physical", power: 75, accuracy: 100 };
const team = (p, n = 3, mv = [tackle], st = {}) => Array.from({ length: n }, (_, i) => mon(`${p}${i + 1}`, st, mv));
function battle(t1, t2) { const e = eng(); const bt = e.newBattle({ id: "d", format: 6, slots: 2, p1: { id: "A", name: "A", team: t1 }, p2: { id: "B", name: "B", team: t2 } }); return { e, bt }; }

test("dupla: dois Pokémon em campo de cada lado e escolha de alvo", () => {
  const { e, bt } = battle(team("A"), team("B"));
  assert.deepEqual(e.posOf(bt), ["p1", "p1b", "p2", "p2b"]);
  assert.equal(e.activeMon(bt, "p1b").name, "A2");
  assert.equal(e.submit(bt, "p1", { kind: "move", idx: 0, target: "p2b" }), false);
  e.submit(bt, "p1b", { kind: "move", idx: 0, target: "p2b" });
  e.submit(bt, "p2", { kind: "move", idx: 0, target: "p1" });
  assert.equal(e.submit(bt, "p2b", { kind: "move", idx: 0, target: "p1" }), true);
  const evs = e.resolve(bt);
  const hitsOnP2b = evs.filter(x => x.k === "hit" && x.side === "p2b").length;
  const hitsOnP2 = evs.filter(x => x.k === "hit" && x.side === "p2").length;
  assert.equal(hitsOnP2b, 2); assert.equal(hitsOnP2, 0);
  assert.equal(bt.phase, "choose");
});

test("dupla: golpe em área acerta os dois oponentes com ×0,75", () => {
  const quiet = { ...tackle, name: "Wait", category: "Status", power: 0 };
  const { e, bt } = battle([mon("A1", { spe: 300 }, [slide]), mon("A2", {}, [quiet])], team("B", 2, [quiet]));
  ["p1", "p1b", "p2", "p2b"].forEach(s => e.submit(bt, s, { kind: "move", idx: 0 }));
  const evs = e.resolve(bt);
  const hits = evs.filter(x => x.k === "hit" && (x.side === "p2" || x.side === "p2b"));
  assert.equal(new Set(hits.map(h => h.side)).size, 2);
  assert.ok(hits.every(h => (h.notes || []).some(n => /0,75/.test(n))));
});

test("dupla: quem desmaia é trocado pelo banco; sem banco a posição fica vazia", () => {
  const { e, bt } = battle(team("A", 2, [{ ...tackle, power: 250 }], { atk: 400, spe: 300 }), [mon("B1", { hp: 5 }, [tackle]), mon("B2", { hp: 5 }, [tackle]), mon("B3", {}, [tackle])]);
  e.submit(bt, "p1", { kind: "move", idx: 0, target: "p2" });
  e.submit(bt, "p1b", { kind: "move", idx: 0, target: "p2b" });
  e.submit(bt, "p2", { kind: "move", idx: 0 });
  e.submit(bt, "p2b", { kind: "move", idx: 0 });
  e.resolve(bt);
  assert.equal(bt.phase, "switch");
  const need = ["p2", "p2b"].filter(s => bt.sides[s].needSwitch && !bt.sides[s].empty);
  assert.equal(need.length, 1, "só sobrou B3 para uma posição");
  assert.equal(e.submit(bt, need[0], { kind: "switch", idx: 2 }), true);
  e.resolve(bt);
  assert.equal(bt.phase, "choose");
  assert.deepEqual(e.posOf(bt).filter(x => x.startsWith("p2")), [need[0]]);
});

test("dupla: troca não pode puxar o parceiro que já está em campo", () => {
  const { e, bt } = battle(team("A"), team("B"));
  assert.equal(e.submit(bt, "p1", { kind: "switch", idx: 1 }), false);
  e.submit(bt, "p1", { kind: "switch", idx: 2 });
  assert.equal(bt.sides.p1.pending?.idx, 2);
  assert.equal(e.submit(bt, "p1b", { kind: "switch", idx: 2 }), false, "o parceiro já pediu esse Pokémon");
});

test("simples continua igual", () => {
  const e = eng();
  const bt = e.newBattle({ id: "s", format: 6, p1: { id: "A", name: "A", team: team("A") }, p2: { id: "B", name: "B", team: team("B") } });
  assert.deepEqual(e.posOf(bt), ["p1", "p2"]);
  e.submit(bt, "p1", { kind: "move", idx: 0 }); assert.equal(e.submit(bt, "p2", { kind: "move", idx: 0 }), true);
  e.resolve(bt); assert.equal(bt.phase, "choose");
});
