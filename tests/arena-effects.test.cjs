const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../scripts/arena-engine-v7.js");
const R = require("../scripts/arena-rules-v7.js");

function statDice(v) { v = Number(v || 0); if (v < 50) return { dice: 0, fixed: 0 }; if (v <= 75) return { dice: 1, fixed: 0 }; if (v <= 100) return { dice: 2, fixed: 0 }; if (v <= 125) return { dice: 3, fixed: 0 }; if (v <= 150) return { dice: 4, fixed: 0 }; if (v <= 175) return { dice: 5, fixed: 0 }; return { dice: 6, fixed: Math.floor((v - 175) / 15) }; }
function powerToDice(p) { p = Number(p || 0); if (p <= 0) return "—"; if (p <= 20) return "1d6"; if (p <= 40) return "2d6"; if (p <= 60) return "3d6"; if (p <= 80) return "4d6"; if (p <= 100) return "5d6"; return "6d6"; }
const CHART = { Water: { Fire: 2, Water: 0.5 }, Fire: { Water: 0.5 }, Electric: { Ground: 0 }, Fighting: { Normal: 2 } };
const typeMultiplier = (t, defs) => defs.reduce((m, d) => m * (CHART[t]?.[d] ?? 1), 1);
const E = (rand = () => 0.5) => create({ statDice, powerToDice, typeMultiplier, normalizeType: x => x, rand });
const mon = (name, types, stats, moves, ability = "", abilityText = "") => ({ name, types, ability, abilityText, stats: { hp: 200, atk: 100, def: 60, spa: 60, spd: 60, spe: 80, ...stats }, maxHp: stats.hp || 200, moves });
const mv = (name, type, category, power, desc = "", accuracy = 90) => ({ name, type, category, power, accuracy, desc });
const tackle = mv("Tackle", "Normal", "Physical", 40);
function duel(a, b, rand) { const e = E(rand); const bt = e.newBattle({ id: "t", format: 6, p1: { id: "A", name: "Ana", team: a }, p2: { id: "B", name: "Beto", team: b } }); return { e, bt }; }
function turn(e, bt, a, b) { e.submit(bt, "p1", a); e.submit(bt, "p2", b); return e.resolve(bt); }
const M = i => ({ kind: "move", idx: i });

test("lê estágios e status escritos nos golpes", () => {
  assert.deepEqual(R.parseMove({ name: "X", desc: "Reduz o Sp. Atk do alvo em 1 estágio.", category: "Physical" }).stages.map(s => [s.who, s.stat, s.n]), [["foe", "spa", -1]]);
  assert.deepEqual(R.parseMove({ name: "Y", desc: "Aumenta Sp. Atk, Sp. Def e Speed do usuário em 1 estágio cada.", category: "Status" }).stages.map(s => s.stat), ["spa", "spd", "spe"]);
  const bb = R.parseMove({ name: "Bubble Beam", desc: "10% de chance de reduzir a Speed do alvo em 1 estágio.", category: "Special" });
  assert.equal(bb.stages[0].chance, 10);
  const bs = R.parseMove({ name: "Body Slam", desc: "30% de chance de Paralisar.", category: "Physical" });
  assert.deepEqual(bs.status, [{ who: "foe", st: "par", chance: 30 }]);
  assert.equal(R.parseMove({ name: "Rain Dance", desc: "Invoca chuva por 5 turnos.", category: "Status" }).weather.kind, "rain");
  assert.equal(R.parseMove({ name: "Twin Sting", desc: "Move Multi-Hit de 2 acertos fixos.", category: "Physical" }).hits.max, 2);
  assert.equal(R.parseMove({ name: "Waterfall", desc: "20% de chance de fazer o alvo hesitar (Flinch).", category: "Physical" }).flinch, 20);
  assert.equal(R.parseMove({ name: "Focus Energy", desc: "aumenta a taxa de crítico em 2 estágios até sair de campo.", category: "Status" }).selfCrit, 2);
});

test("Bulk Up dá +1 Attack que vira dado de dano; Growl tira Attack do alvo", () => {
  const bulk = mv("Bulk Up", "Fighting", "Status", 0, "Aumenta Attack e Defense do usuário em 1 estágio.");
  const growl = mv("Growl", "Normal", "Status", 0, "Reduz o Attack do alvo em 1 estágio.", null);
  const { e, bt } = duel([mon("A", ["Fighting"], { atk: 100, spe: 100 }, [bulk, tackle])], [mon("B", ["Normal"], { spe: 1 }, [growl])]);
  const ev = turn(e, bt, M(0), M(0));
  const st = ev.filter(x => x.k === "stage");
  assert.deepEqual(st.map(x => [x.side, x.stat, x.applied]), [["p1", "atk", 1], ["p1", "def", 1], ["p1", "atk", -1]]);
  assert.equal(e.stageTotal(e.activeState(bt, "p1"), "atk"), 0);
  // +1 é permanente, −1 dura 3 rodadas
  turn(e, bt, M(0), M(0)); turn(e, bt, M(0), M(0));
  assert.equal(e.stageTotal(e.activeState(bt, "p1"), "atk"), 1, "depois de 3 rodadas sobram +3 −2 = ... (as reduções expiram)");
});

test("status: veneno tira HP no fim do turno e Elétrico não paralisa", () => {
  const sting = mv("Poison Sting", "Poison", "Physical", 15, "100% de chance de causar Poison.");
  const tw = mv("Thunder Wave", "Electric", "Status", 0, "Paralisa o alvo.", 90);
  const { e, bt } = duel([mon("A", ["Poison"], { spe: 100 }, [sting, tw])], [mon("B", ["Electric"], { spe: 1 }, [mv("Splash", "Normal", "Status", 0, "Nada acontece.")])], () => 0.3);
  const ev = turn(e, bt, M(0), M(0));
  assert.ok(ev.some(x => x.k === "status" && x.st === "psn" && !x.fail));
  assert.ok(ev.some(x => x.k === "sdmg" && x.src === "psn"));
  const { e: e2, bt: b2 } = duel([mon("A", ["Normal"], { spe: 100 }, [tw])], [mon("B", ["Electric"], { spe: 1 }, [tackle])], () => 0.3);
  const ev2 = turn(e2, b2, M(0), M(0));
  assert.ok(ev2.some(x => x.k === "status" && x.fail === "type"));
});

test("chuva: Water +1d6 e ability de chuva soma mais 1d6", () => {
  const rain = mv("Rain Dance", "Water", "Status", 0, "Invoca chuva por 5 turnos.");
  const punch = mv("Aqua Punch", "Water", "Physical", 60, "");
  const hydro = "Quando Machop acerta um ataque físico do tipo Fighting, ele ganha +1 Estágio de Speed. Durante chuva ou submerso, seus ataques do tipo Water causam +1d6 de dano.";
  const { e, bt } = duel([mon("Machop", ["Fighting"], { atk: 100, spe: 100 }, [rain, punch], "Hydro Rush", hydro)], [mon("B", ["Normal"], { spe: 1, def: 60 }, [mv("Splash", "Normal", "Status", 0, "Nada.")])]);
  turn(e, bt, M(0), M(0));
  const hit = turn(e, bt, M(1), M(0)).find(x => x.k === "hit");
  // Power 60 = 3d6; Atk 100 = 2d6; chuva +1d6; Hydro Rush +1d6; Def 60 = −1d6 → 6d6
  assert.equal(hit.dice, 6);
  assert.ok(hit.notes.some(n => /Chuva/.test(n)));
});

test("Command Pheromone: +1 Attack para o time todo, mesmo quem está fora de campo", () => {
  const txt = "Formiral emite feromônios.\n• Ao entrar em campo, todos os aliados (mesmo os que estão fora de campo) ganham +1 estágio de Attack, até o máximo de +3.\n• Inimigos recebem −1 estágio de Precisão durante o primeiro turno.\n• Quando Formiral derrota um oponente, recupera 10% do HP máximo (moral elevada).";
  const { e, bt } = duel([mon("Formiral", ["Bug"], {}, [tackle], "Command Pheromone", txt), mon("Reserva", ["Bug"], {}, [tackle])], [mon("B", ["Normal"], {}, [tackle])]);
  assert.equal(e.stageTotal(bt.sides.p1.team[1], "atk"), 1, "reserva ganhou +1");
  assert.equal(e.stageTotal(e.activeState(bt, "p2"), "acc"), -1);
  turn(e, bt, { kind: "switch", idx: 1 }, M(0));
  assert.equal(e.stageTotal(e.activeState(bt, "p1"), "atk"), 1, "continua depois de trocar");
  assert.equal(e.stageTotal(e.activeState(bt, "p2"), "acc"), 0, "−1 de Precisão só no primeiro turno");
});

test("Royal Field: campo de 3 turnos, −1 Speed no inimigo, cura 1d6 e Bug +1d6", () => {
  const txt = "Ao entrar em campo, cria o Campo Real por 3 turnos:\n• Aliados recuperam 1d6 de HP no fim de cada turno.\n• Inimigos recebem −1 estágio de Speed.\n• Moves Bug ou Fairy de Beecrown causam +1d6 de dano.";
  const buzz = mv("Bug Buzz", "Bug", "Special", 90, "");
  const { e, bt } = duel([mon("Beecrown", ["Bug", "Rock"], { spa: 100, hp: 200 }, [buzz], "Royal Field", txt)], [mon("B", ["Normal"], { spd: 60 }, [tackle])]);
  assert.equal(bt.sides.p1.field.royal, 3);
  assert.equal(e.stageTotal(e.activeState(bt, "p2"), "spe"), -1);
  const ev = turn(e, bt, M(0), M(0));
  const hit = ev.find(x => x.k === "hit" && x.side === "p2");
  assert.ok(hit.notes.includes("Campo Real +1d6"));
  assert.ok(ev.some(x => x.k === "heal" && x.side === "p1" && x.src === "Campo Real") || e.activeState(bt, "p1").hp === 200);
  assert.equal(bt.sides.p1.field.royal, 2);
});

test("Toxic Shell envenena quem bate fisicamente e Swagger Drive entra com +1 Attack", () => {
  const shell = "Quando Venoskor recebe dano de um Move físico direto, há 35% de chance de envenenar o atacante (Poison).";
  const { e, bt } = duel([mon("Pompadon", ["Fighting"], { spe: 100 }, [tackle], "Swagger Drive", "• Sempre que entra em campo, ganha +1 estágio de Attack.")], [mon("Venoskor", ["Bug", "Poison"], { spe: 1 }, [mv("Splash", "Normal", "Status", 0, "Nada.")], "Toxic Shell", shell)], () => 0.2);
  assert.equal(e.stageTotal(e.activeState(bt, "p1"), "atk"), 1);
  const ev = turn(e, bt, M(0), M(0));
  assert.ok(ev.some(x => x.k === "status" && x.side === "p1" && x.st === "psn"));
});

test("Flinch faz o alvo perder a ação e Sleep impede de agir", () => {
  const fall = mv("Waterfall", "Water", "Physical", 80, "100% de chance de fazer o alvo hesitar (Flinch).");
  const { e, bt } = duel([mon("A", ["Water"], { spe: 100 }, [fall])], [mon("B", ["Normal"], { spe: 1 }, [tackle])]);
  const ev = turn(e, bt, M(0), M(0));
  assert.ok(ev.some(x => x.k === "cant" && x.reason === "flinch"));
  const hyp = mv("Hypnosis", "Psychic", "Status", 0, "Faz o alvo dormir (Sleep).", 60);
  const s = duel([mon("A", ["Psychic"], { spe: 100 }, [hyp])], [mon("B", ["Normal"], { spe: 1 }, [tackle])], () => 0.1);
  const ev2 = turn(s.e, s.bt, M(0), M(0));
  assert.ok(ev2.some(x => x.k === "status" && x.st === "slp"));
  assert.ok(ev2.some(x => x.k === "cant" && x.reason === "slp"));
});

test("Precisão tem teto de 90% e −1 de Precisão reduz a chance", () => {
  const sure = mv("Strike", "Normal", "Physical", 40, "", 100);
  const { e, bt } = duel([mon("A", ["Normal"], { spe: 100 }, [sure])], [mon("B", ["Normal"], { spe: 1 }, [tackle])], () => 0.93);
  const m = turn(e, bt, M(0), M(0)).find(x => x.k === "move" && x.side === "p1");
  assert.equal(m.acc, 90); assert.equal(m.miss, true);
});

test("dano experimental (QD): dados pelo Poder, dado pela diferença de Qualidade", () => {
  const surf = mv("Surf", "Water", "Special", 90, "");
  const e = E(() => 0.4);
  const a = { ...mon("Água", ["Water"], { spa: 100, spe: 100 }, [surf]), level: 50 };
  const b = mon("Fogo", ["Fire"], { spd: 110, spe: 1 }, [tackle]);
  const bt = e.newBattle({ id: "m", format: 1, damage: "matrix", p1: { id: "A", name: "A", team: [a] }, p2: { id: "B", name: "B", team: [b] } });
  assert.equal(bt.damage, "matrix");
  const hit = turn(e, bt, M(0), M(0)).find(x => x.k === "hit" && x.side === "p2");
  // Poder 90 = 5 dados; Q2 contra Q3 → d4; super efetivo → 6 dados e d6; STAB +1d6; nível 50 → +10
  assert.equal(hit.expr, "6d6 +1d6 +10");
  assert.equal(hit.qd, "d6");
});
