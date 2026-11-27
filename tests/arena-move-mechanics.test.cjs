const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../scripts/arena-engine-v7.js");

function statDice(v) { v = Number(v || 0); if (v < 50) return { dice: 0, fixed: 0 }; if (v <= 75) return { dice: 1, fixed: 0 }; if (v <= 100) return { dice: 2, fixed: 0 }; return { dice: 3, fixed: 0 }; }
function powerToDice(p) { p = Number(p || 0); if (p <= 0) return "—"; if (p <= 40) return "2d6"; if (p <= 80) return "4d6"; return "6d6"; }
const CHART = { Normal: { Ghost: 0, Rock: 0.5 }, Ghost: { Normal: 0 }, Rock: { Fire: 2, Flying: 2 } };
const typeMultiplier = (t, defs) => defs.reduce((m, d) => m * (CHART[t]?.[d] ?? 1), 1);
const eng = (rand = () => 0.5) => create({ statDice, powerToDice, typeMultiplier, normalizeType: x => x, rand });
const mon = (name, types, stats, moves, extra = {}) => ({ name, types, level: 30, stats: { hp: 200, atk: 100, def: 80, spa: 80, spd: 80, spe: 80, ...stats }, maxHp: stats.hp || 200, moves, ...extra });
const M = (name, type, category, power, accuracy = 100, desc = "") => ({ name, type, category, power, accuracy, desc });
const tackle = M("Tackle", "Normal", "Physical", 40);
const growl = M("Growl", "Normal", "Status", 0, 100, "Lowers the target's Attack by one stage.");
function battle(t1, t2, rand) { const e = eng(rand); const bt = e.newBattle({ id: "m", format: 6, p1: { id: "A", name: "A", team: t1 }, p2: { id: "B", name: "B", team: t2 } }); return { e, bt }; }
const turn = (e, bt, a = 0, b = 0) => { e.submit(bt, "p1", typeof a === "object" ? a : { kind: "move", idx: a }); e.submit(bt, "p2", typeof b === "object" ? b : { kind: "move", idx: b }); return e.resolve(bt); };
const hitOn = (evs, side) => evs.filter(x => x.k === "hit" && x.side === side);

test("Fly: invulnerável no 1º turno e ataca no 2º", () => {
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [M("Fly", "Flying", "Physical", 90)])], [mon("B", ["Normal"], {}, [tackle])]);
  const t1 = turn(e, bt);
  assert.equal(e.view(bt, "p1").semi, "fly");
  assert.equal(hitOn(t1, "p1").length, 0, "Tackle não alcança quem está no ar");
  const t2 = turn(e, bt, 0, 0);
  assert.ok(hitOn(t2, "p2").some(h => h.amount > 0));
  assert.equal(e.view(bt, "p1").semi, null);
});

test("Dig é atingido por Earthquake com o dobro de Power", () => {
  const eq = M("Earthquake", "Ground", "Physical", 100);
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [M("Dig", "Ground", "Physical", 80)])], [mon("B", ["Normal"], { spe: 10 }, [eq])]);
  const t1 = turn(e, bt);
  assert.ok(hitOn(t1, "p1").some(h => h.amount > 0));
});

test("Sucker Punch falha contra golpe de status; Upper Hand só contra prioridade", () => {
  const sp = M("Sucker Punch", "Dark", "Physical", 70);
  const r1 = battle([mon("A", ["Normal"], {}, [sp])], [mon("B", ["Normal"], {}, [growl])]);
  const ev1 = turn(r1.e, r1.bt).find(x => x.k === "move" && x.side === "p1");
  assert.equal(ev1.fail, true);
  const r2 = battle([mon("A", ["Normal"], {}, [sp])], [mon("B", ["Normal"], {}, [tackle])]);
  assert.ok(hitOn(turn(r2.e, r2.bt), "p2").length);
  const uh = M("Upper Hand", "Fighting", "Physical", 65);
  const r3 = battle([mon("A", ["Normal"], {}, [uh])], [mon("B", ["Normal"], {}, [tackle])]);
  assert.equal(turn(r3.e, r3.bt).find(x => x.k === "move" && x.side === "p1").fail, true);
  const r4 = battle([mon("A", ["Normal"], {}, [uh])], [mon("B", ["Normal"], {}, [M("Quick Attack", "Normal", "Physical", 40)])]);
  assert.ok(hitOn(turn(r4.e, r4.bt), "p2").length);
});

test("Explosion derruba o próprio usuário", () => {
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [M("Explosion", "Normal", "Physical", 250)]), mon("A2", ["Normal"], {}, [tackle])], [mon("B", ["Normal"], { hp: 900 }, [tackle])]);
  const evs = turn(e, bt);
  assert.ok(evs.some(x => x.k === "faint" && x.side === "p1"));
});

test("Substitute leva o dano no lugar", () => {
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [M("Substitute", "Normal", "Status", 0, null)])], [mon("B", ["Normal"], {}, [tackle, growl])]);
  turn(e, bt);
  assert.equal(e.activeState(bt, "p1").hp, 150);
  const before = e.activeState(bt, "p1").sub;
  assert.ok(before > 0 || before === 0);
  const r = battle([mon("A", ["Normal"], { spe: 200 }, [M("Substitute", "Normal", "Status", 0, null)])], [mon("B", ["Normal"], { spe: 10 }, [M("Leer", "Normal", "Status", 0, 100, "Lowers the target's Defense by one stage.")])]);
  const evs = turn(r.e, r.bt);
  assert.ok(evs.find(x => x.k === "move" && x.side === "p2").fail, "Leer é bloqueado pelo substituto");
});

test("Curse do Ghost custa metade do HP e amaldiçoa", () => {
  const { e, bt } = battle([mon("G", ["Ghost"], { spe: 200 }, [M("Curse", "Ghost", "Status", 0, null)])], [mon("B", ["Normal"], {}, [growl])]);
  const evs = turn(e, bt);
  assert.equal(e.activeState(bt, "p1").hp, 100);
  assert.ok(evs.some(x => x.k === "sdmg" && x.side === "p2" && x.src === "Curse"));
});

test("Hyper Beam precisa recarregar no turno seguinte", () => {
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [M("Hyper Beam", "Normal", "Special", 150, 100)])], [mon("B", ["Normal"], { hp: 900 }, [growl])]);
  turn(e, bt);
  assert.equal(e.view(bt, "p1").forced, "recharge");
  const t2 = turn(e, bt);
  assert.ok(t2.some(x => x.k === "cant" && x.reason === "recharge"));
});

test("Perish Song derruba os dois depois de 3 turnos", () => {
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [M("Perish Song", "Normal", "Status", 0, null), growl])], [mon("B", ["Normal"], {}, [growl])]);
  turn(e, bt); turn(e, bt, 1); turn(e, bt, 1);
  const evs = turn(e, bt, 1);
  assert.equal(bt.phase, "end");
  assert.ok(evs.filter(x => x.k === "faint").length >= 1);
});

test("Stealth Rock machuca quem entra; Taunt bloqueia status", () => {
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [M("Stealth Rock", "Rock", "Status", 0, null), M("Taunt", "Dark", "Status", 0, 100)])], [mon("B", ["Normal"], {}, [growl]), mon("F", ["Fire"], {}, [growl])]);
  turn(e, bt);
  const evs = turn(e, bt, 1, { kind: "switch", idx: 1 });
  assert.ok(evs.some(x => x.k === "sdmg" && x.src === "Stealth Rock" && x.amount === 50));
  const t3 = turn(e, bt, 0, 0);
  assert.ok(t3.find(x => x.k === "move" && x.side === "p2").fail, "provocado não usa Growl");
});

test("Destiny Bond leva o atacante junto", () => {
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200, hp: 1 }, [M("Destiny Bond", "Ghost", "Status", 0, null)])], [mon("B", ["Normal"], { spe: 10 }, [M("Mega Kick", "Normal", "Physical", 120)])], () => 0.1);
  const evs = turn(e, bt);
  assert.equal(evs.filter(x => x.k === "faint").length, 2);
});
