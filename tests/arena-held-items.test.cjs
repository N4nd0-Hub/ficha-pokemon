const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../scripts/arena-engine-v7.js");
const { interpret } = require("../scripts/item-rules-v7.js");

function statDice(v) { v = Number(v || 0); if (v < 50) return { dice: 0, fixed: 0 }; if (v <= 75) return { dice: 1, fixed: 0 }; if (v <= 100) return { dice: 2, fixed: 0 }; if (v <= 125) return { dice: 3, fixed: 0 }; return { dice: 4, fixed: 0 }; }
function powerToDice(p) { p = Number(p || 0); if (p <= 0) return "—"; if (p <= 20) return "1d6"; if (p <= 40) return "2d6"; if (p <= 60) return "3d6"; if (p <= 80) return "4d6"; return "5d6"; }
const CHART = { Normal: { Ghost: 0 }, Fire: { Grass: 2 } };
const typeMultiplier = (t, defs) => defs.reduce((m, d) => m * (CHART[t]?.[d] ?? 1), 1);
const eng = (rand = () => 0.5) => create({ statDice, powerToDice, typeMultiplier, normalizeType: x => x, rand });
const mon = (name, types, stats, moves, extra = {}) => ({ name, types, stats: { hp: 200, atk: 100, def: 60, spa: 60, spd: 60, spe: 80, ...stats }, maxHp: stats.hp || 200, moves, ...extra });
const tackle = { name: "Tackle", type: "Normal", category: "Physical", power: 40, accuracy: 90 };
const I = (name, description) => ({ name, description });
function battle(t1, t2, opts = {}) { const e = eng(opts.rand); const bt = e.newBattle({ id: "h", format: 6, p1: { id: "A", name: "A", team: t1 }, p2: { id: "B", name: "B", team: t2 } }); return { e, bt }; }
const turn = (e, bt, a = { kind: "move", idx: 0 }, b = { kind: "move", idx: 0 }) => { e.submit(bt, "p1", a); e.submit(bt, "p2", b); return e.resolve(bt); };

test("Red Card troca o atacante por outro Pokémon", () => {
  const card = I("Red Card", "Segurado: consumido quando o usuário leva dano de um golpe; o atacante é trocado por outro Pokémon aleatório do time dele.");
  const { e, bt } = battle([mon("A1", ["Normal"], { spe: 200 }, [tackle]), mon("A2", ["Normal"], {}, [tackle])], [mon("B", ["Normal"], {}, [tackle], { item: card })]);
  const evs = turn(e, bt);
  assert.ok(evs.some(x => x.k === "switch" && x.side === "p1" && x.to === "A2"));
  assert.equal(e.view(bt, "p2").itemGone, true);
});

test("Eject Button tira o Pokémon de campo e pede a troca", () => {
  const btn = I("Eject Button", "Segurado: consumido quando o usuário leva dano de um golpe; ele sai de campo e o treinador escolhe outro Pokémon.");
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [tackle])], [mon("B1", ["Normal"], {}, [tackle], { item: btn }), mon("B2", ["Normal"], {}, [tackle])]);
  const evs = turn(e, bt);
  assert.equal(bt.phase, "switch");
  assert.equal(bt.sides.p2.needSwitch, true);
  assert.ok(!evs.some(x => x.k === "move" && x.side === "p2"), "quem foi ejetado não ataca");
  e.submit(bt, "p2", { kind: "switch", idx: 1 });
  e.resolve(bt);
  assert.equal(e.activeMon(bt, "p2").name, "B2");
  assert.equal(bt.phase, "choose");
});

test("Clear Amulet bloqueia Intimidate; Adrenaline Orb dá Speed", () => {
  const amulet = I("Clear Amulet", "Segurado: inimigos não conseguem reduzir os estágios do usuário.");
  const { e, bt } = battle([mon("A", ["Normal"], {}, [tackle], { ability: "Intimidate" })], [mon("B", ["Normal"], {}, [tackle], { item: amulet })]);
  assert.equal(e.stageTotal(e.activeState(bt, "p2"), "atk"), 0);
  const orb = I("Adrenaline Orb", "Segurado: consumido quando o usuário é afetado por Intimidate; +1 estágio de Speed.");
  const r = battle([mon("A", ["Normal"], {}, [tackle], { ability: "Intimidate" })], [mon("B", ["Normal"], {}, [tackle], { item: orb })]);
  assert.equal(r.e.stageTotal(r.e.activeState(r.bt, "p2"), "spe"), 1);
});

test("Covert Cloak ignora efeitos secundários", () => {
  const cloak = I("Covert Cloak", "Segurado: o usuário ignora os efeitos secundários dos golpes inimigos (status, redução de estágios e Flinch).");
  const smash = { name: "Rock Smash", type: "Fighting", category: "Physical", power: 40, accuracy: 100, desc: "Reduz a Defense do alvo em 1 estágio." };
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [smash])], [mon("B", ["Normal"], {}, [tackle], { item: cloak })]);
  turn(e, bt);
  assert.equal(e.stageTotal(e.activeState(bt, "p2"), "def"), 0);
});

test("Safety Goggles protege de golpes de pó", () => {
  const g = I("Safety Goggles", "Segurado: imune a golpes de pó (Spore, Sleep Powder…) e ao dano de Hail e Sandstorm.");
  const spore = { name: "Spore", type: "Grass", category: "Status", power: 0, accuracy: 100, desc: "Puts the target to sleep." };
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [spore])], [mon("B", ["Normal"], {}, [tackle], { item: g })]);
  const evs = turn(e, bt);
  assert.ok(evs.some(x => x.k === "cant" && x.reason === "powder" && x.src === "Safety Goggles"));
  assert.equal(e.activeState(bt, "p2").status, null);
});

test("Loaded Dice garante o máximo de acertos", () => {
  const dice = I("Loaded Dice", "Segurado: golpes de vários acertos acertam o número máximo de vezes.");
  const seed = { name: "Bullet Seed", type: "Grass", category: "Physical", power: 25, accuracy: 100, desc: "Acerta 2 a 5 vezes." };
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [seed], { item: dice })], [mon("B", ["Normal"], { hp: 900 }, [tackle])], { rand: () => 0 });
  const hits = turn(e, bt).filter(x => x.k === "hit" && x.side === "p2");
  assert.equal(hits.length, 5);
});

test("Memory muda o tipo do Silvally e do Multi-Attack", () => {
  const mem = I("Fire Memory", "Segurado por Silvally: Silvally vira tipo Fire e Multi-Attack vira Fire.");
  const ma = { name: "Multi-Attack", type: "Normal", category: "Physical", power: 120, accuracy: 100 };
  const { e, bt } = battle([mon("Silvally", ["Normal"], {}, [ma], { item: mem })], [mon("B", ["Grass"], {}, [tackle])]);
  assert.deepEqual(e.activeMon(bt, "p1").types, ["Fire"]);
  assert.equal(e.activeMon(bt, "p1").moves[0].type, "Fire");
});

test("Ring Target anula imunidade de tipo; Blunder Policy dá Speed ao errar", () => {
  const ring = I("Ring Target", "Segurado: anula as imunidades de tipo do usuário (imunidades de ability continuam).");
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 200 }, [{ ...tackle, accuracy: 100 }])], [mon("G", ["Ghost"], {}, [tackle], { item: ring })]);
  const hit = turn(e, bt).find(x => x.k === "hit" && x.side === "p2");
  assert.ok(hit.amount > 0);
  const bp = I("Blunder Policy", "Segurado: consumido quando o usuário erra um golpe por Precisão; +2 estágios de Speed.");
  const r = battle([mon("A", ["Normal"], { spe: 200 }, [{ ...tackle, accuracy: 10 }], { item: bp })], [mon("B", ["Normal"], {}, [tackle])], { rand: () => 0.99 });
  turn(r.e, r.bt);
  assert.equal(r.e.stageTotal(r.e.activeState(r.bt, "p1"), "spe"), 2);
});

test("Lagging Tail age por último; Mirror Herb copia o aumento", () => {
  const tail = I("Lagging Tail", "Segurado: o usuário age por último na sua faixa de prioridade.");
  const { e, bt } = battle([mon("A", ["Normal"], { spe: 300 }, [tackle], { item: tail })], [mon("B", ["Normal"], { spe: 10 }, [tackle])]);
  const moves = turn(e, bt).filter(x => x.k === "move").map(x => x.side);
  assert.deepEqual(moves, ["p2", "p1"]);
  const herb = I("Mirror Herb", "Segurado: consumido quando o inimigo sobe um estágio; o usuário copia o mesmo aumento.");
  const sd = { name: "Swords Dance", type: "Normal", category: "Status", power: 0, accuracy: null, desc: "Raises the user's Attack by two stages." };
  const r = battle([mon("A", ["Normal"], { spe: 200 }, [sd])], [mon("B", ["Normal"], {}, [tackle], { item: herb })]);
  turn(r.e, r.bt);
  assert.equal(r.e.stageTotal(r.e.activeState(r.bt, "p2"), "atk"), 2);
});

test("leitor entende os held items novos", () => {
  const b = d => interpret(I("x", d)).battle;
  assert.equal(b("Segurado: golpes de soco causam +1 dado da QD e não contam como contato.").punch, 1);
  assert.equal(b("Segurado: ao chegar a 1/4 do HP Máximo ou menos, é consumida e o próximo golpe do usuário ganha +20 de Precisão.").pinch.nextAcc, 20);
  assert.equal(b("Segurado: o usuário ignora os perigos de entrada (Spikes, Stealth Rock, Toxic Spikes, Sticky Web).").boots, true);
  assert.deepEqual(b("Segurado por Genesect: Techno Blast vira Water.").form, { type: "Water", move: "Techno Blast" });
});

test("Drain Punch recupera 50% do dano causado e STAB soma 1 dado da QD", () => {
  const dp = { name: "Drain Punch", type: "Fighting", category: "Physical", power: 75, accuracy: 100, desc: "O usuário recupera 50% do dano causado." };
  const { e, bt } = battle([mon("A", ["Fighting"], { spe: 200 }, [dp])], [mon("B", ["Normal"], { hp: 900 }, [{ ...tackle, power: 0, category: "Status" }])]);
  e.activeState(bt, "p1").hp = 50;
  const evs = turn(e, bt);
  const hit = evs.find(x => x.k === "hit" && x.side === "p2");
  const heal = evs.find(x => x.k === "heal" && x.side === "p1");
  assert.ok(hit && hit.amount > 0);
  assert.ok(heal && heal.amount === Math.max(1, Math.floor(hit.amount / 2)), JSON.stringify(heal));
});
