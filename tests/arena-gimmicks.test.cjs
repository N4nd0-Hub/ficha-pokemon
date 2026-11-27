const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../scripts/arena-engine-v7.js");

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
const typeMultiplier = () => 1;
function seq(values) { let i = 0; return () => values[i++ % values.length]; }
function engine(rand) { return create({ statDice, powerToDice, typeMultiplier, normalizeType: x => x, rand }); }
const mon = (name, types, stats, moves, extra = {}) => ({ name, types, stats: { hp: 200, atk: 100, def: 60, spa: 60, spd: 60, spe: 80, ...stats }, maxHp: stats.hp || 200, moves, ...extra });
const tackle = { name: "Tackle", type: "Normal", category: "Physical", power: 40, accuracy: 90 };
const rock = { name: "Rock Slide", type: "Rock", category: "Physical", power: 75, accuracy: 90 };
function battle(rand, a, b, opts = {}) {
  const e = engine(rand);
  const bt = e.newBattle({ id: "t", format: 6, p1: { id: "A", name: "Ana", team: a, ...(opts.p1 || {}) }, p2: { id: "B", name: "Beto", team: b, ...(opts.p2 || {}) } });
  return { e, bt };
}

test("Evasão Ativa tira 50 da Precisão inimiga e gasta a ação", () => {
  // d100 = 60: acertaria com 90%, mas com −50 vira 40 e erra
  const { e, bt } = battle(() => 0.595,
    [mon("Esquivo", ["Normal"], { spe: 10 }, [tackle])],
    [mon("Atacante", ["Normal"], { spe: 200 }, [tackle])]);
  e.submit(bt, "p1", { kind: "evade" });
  assert.equal(e.submit(bt, "p2", { kind: "move", idx: 0 }), true);
  const evs = e.resolve(bt);
  const ev = evs.find(x => x.k === "evade");
  assert.equal(ev.kind, "active"); assert.equal(ev.pen, 50);
  const mv = evs.find(x => x.k === "move" && x.side === "p2");
  assert.equal(mv.acc, 40); assert.equal(mv.miss, true); assert.equal(mv.dodged, true);
  assert.equal(evs.filter(x => x.k === "move" && x.side === "p1").length, 0);
});

test("Evasão Reativa vem junto do golpe e tira 25", () => {
  const { e, bt } = battle(() => 0.7,
    [mon("Esquivo", ["Normal"], { spe: 10 }, [tackle])],
    [mon("Atacante", ["Normal"], { spe: 200 }, [tackle])]);
  e.submit(bt, "p1", { kind: "move", idx: 0, react: true });
  e.submit(bt, "p2", { kind: "move", idx: 0 });
  const evs = e.resolve(bt);
  assert.equal(evs.find(x => x.k === "evade").pen, 25);
  assert.equal(evs.find(x => x.k === "move" && x.side === "p2").acc, 65);
  assert.ok(evs.some(x => x.k === "move" && x.side === "p1"));
});

test("Crítico natural ignora a evasão", () => {
  const { e, bt } = battle(() => 0.02,
    [mon("Esquivo", ["Normal"], { spe: 10 }, [tackle])],
    [mon("Atacante", ["Normal"], { spe: 200 }, [tackle])]);
  e.submit(bt, "p1", { kind: "evade" }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  const evs = e.resolve(bt);
  assert.ok(evs.some(x => x.k === "hit" && x.side === "p1" && x.crit));
});

test("Exaustão: a 4ª evasão seguida custa 1/16 do HP; com Pressure, a 3ª custa 1/8", () => {
  const run = (ability) => {
    const { e, bt } = battle(() => 0.99,
      [mon("Esquivo", ["Normal"], { spe: 10 }, [tackle])],
      [mon("Atacante", ["Normal"], { spe: 200 }, [{ ...tackle, accuracy: 10 }], { ability })]);
    const out = [];
    for (let i = 0; i < 4; i++) { e.submit(bt, "p1", { kind: "evade" }); e.submit(bt, "p2", { kind: "move", idx: 0 }); out.push(e.resolve(bt)); }
    return out.map(evs => evs.find(x => x.k === "sdmg" && x.src === "evade"));
  };
  const plain = run("");
  assert.deepEqual(plain.map(Boolean), [false, false, false, true]);
  assert.equal(plain[3].amount, 12); // 200 HP / 16
  const pres = run("Pressure");
  assert.deepEqual(pres.map(Boolean), [false, false, true, true]);
  assert.equal(pres[2].amount, 25); // 200 HP / 8
});

test("Freeze impede a evasão", () => {
  const { e, bt } = battle(() => 0.1,
    [mon("Gelado", ["Normal"], { spe: 10 }, [tackle])],
    [mon("Atacante", ["Normal"], { spe: 200 }, [tackle])]);
  e.activeState(bt, "p1").status = "frz";
  e.submit(bt, "p1", { kind: "evade" }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  const ev = e.resolve(bt).find(x => x.k === "evade");
  assert.equal(ev.fail, true);
});

test("Mega Evolução troca forma, tipos, atributos e ability antes dos golpes", () => {
  const form = { name: "Mega Teste", types: ["Rock", "Dark"], stats: { hp: 220, atk: 180, def: 120, spa: 60, spd: 100, spe: 90 }, maxHp: 220, ability: "Sand Stream" };
  const { e, bt } = battle(() => 0.5,
    [mon("Teste", ["Rock"], { spe: 10 }, [rock], { gimmick: { megaForms: [form], teraType: "Rock" } })],
    [mon("Alvo", ["Normal"], { spe: 200 }, [tackle])]);
  assert.equal(e.gimmickOptions(bt, "p1").mega.length, 1);
  e.submit(bt, "p1", { kind: "move", idx: 0, gimmick: "mega" });
  e.submit(bt, "p2", { kind: "move", idx: 0 });
  const evs = e.resolve(bt);
  const g = evs.find(x => x.k === "gimmick");
  assert.equal(g.kind, "mega"); assert.equal(g.to, "Mega Teste");
  assert.ok(evs.indexOf(g) < evs.findIndex(x => x.k === "move"));
  assert.equal(e.activeMon(bt, "p1").stats.atk, 180);
  assert.equal(bt.weather.kind, "sand");
  assert.equal(e.activeState(bt, "p1").maxHp, 220);
  // depois da Mega: sem Mega nem Tera para ele, e não dá para repetir
  const g2 = e.gimmickOptions(bt, "p1");
  assert.equal(g2.mega.length, 0); assert.equal(g2.tera, "");
});

test("Terastalização deixa monotipo e dá +2d6 de STAB no Tera Type", () => {
  const { e, bt } = battle(() => 0.5,
    [mon("Tera", ["Normal"], { spe: 200 }, [rock], { gimmick: { teraType: "Rock" } })],
    [mon("Alvo", ["Normal"], { spe: 10 }, [tackle])]);
  e.submit(bt, "p1", { kind: "move", idx: 0, gimmick: "tera" }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  const evs = e.resolve(bt);
  assert.equal(evs.find(x => x.k === "gimmick").kind, "tera");
  assert.deepEqual(e.activeMon(bt, "p1").types, ["Rock"]);
  const hit = evs.find(x => x.k === "hit" && x.side === "p2");
  // 4d6 (Power 75) + 2d6 (ATK 100) + 2d6 (Tera STAB) − 1d6 (DEF 60) = 7 dados
  assert.equal(hit.dice, 7); assert.equal(hit.tera, true);
  assert.equal(bt.sides.p1.gim.tera, 0);
});

test("Z-Move: só do tipo do Cristal, Power turbinado, não erra e só uma vez", () => {
  const { e, bt } = battle(() => 0.95,
    [mon("Z", ["Rock"], { spe: 200 }, [rock, tackle], { gimmick: { zType: "Rock" } })],
    [mon("Alvo", ["Normal"], { spe: 10, hp: 500 }, [tackle])]);
  assert.equal(e.submit(bt, "p1", { kind: "move", idx: 1, gimmick: "z" }), false);
  e.submit(bt, "p1", { kind: "move", idx: 0, gimmick: "z" }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  const evs = e.resolve(bt);
  const mv = evs.find(x => x.k === "move" && x.side === "p1");
  assert.equal(mv.z, true); assert.equal(mv.move, "Z-Rock Slide"); assert.equal(mv.power, 140);
  assert.ok(!mv.miss);
  assert.equal(e.gimmickOptions(bt, "p1").z, "");
  assert.equal(e.submit(bt, "p1", { kind: "move", idx: 0, gimmick: "z" }), false);
});

test("Itens da Bolsa curam, revivem e só valem quando o lado permite", () => {
  const { e, bt } = battle(() => 0.5,
    [mon("A", ["Normal"], { spe: 10 }, [tackle]), mon("B", ["Normal"], {}, [tackle])],
    [mon("Alvo", ["Normal"], { spe: 200 }, [tackle])], { p1: { items: true } });
  bt.sides.p1.team[0].hp = 50; bt.sides.p1.team[1].fainted = true; bt.sides.p1.team[1].hp = 0;
  assert.equal(e.submit(bt, "p1", { kind: "item", target: 0, name: "Revive", effect: { kind: "reviveFraction", num: 1, den: 2 } }), false);
  e.submit(bt, "p1", { kind: "item", target: 0, name: "Super Potion", effect: { kind: "healFlat", amount: 60 } });
  e.submit(bt, "p2", { kind: "move", idx: 0 });
  const evs = e.resolve(bt);
  const it = evs.find(x => x.k === "item");
  assert.equal(it.healed, 60);
  assert.ok(evs.indexOf(it) < evs.findIndex(x => x.k === "move"));
  e.submit(bt, "p1", { kind: "item", target: 1, name: "Revive", effect: { kind: "reviveFraction", num: 1, den: 2 } });
  e.submit(bt, "p2", { kind: "move", idx: 0 });
  e.resolve(bt);
  assert.equal(bt.sides.p1.team[1].fainted, false); assert.equal(bt.sides.p1.team[1].hp, 100);
  // sem permissão de itens (PvP)
  const o = battle(() => 0.5, [mon("A", ["Normal"], {}, [tackle])], [mon("B", ["Normal"], {}, [tackle])]);
  assert.equal(o.e.submit(o.bt, "p1", { kind: "item", target: 0, name: "Potion", effect: { kind: "healFlat", amount: 20 } }), false);
});

test("Cura reduzida: golpes de cura rendem menos no lado com healMult", () => {
  const recover = { name: "Recover", type: "Normal", category: "Status", power: 0, accuracy: null, desc: "Recupera 50% do HP máximo." };
  const { e, bt } = battle(() => 0.5,
    [mon("A", ["Normal"], { spe: 200 }, [recover])],
    [mon("B", ["Normal"], { spe: 10 }, [{ ...tackle, accuracy: 1 }])], { p1: { healMult: 0.5 } });
  bt.sides.p1.team[0].hp = 20;
  e.submit(bt, "p1", { kind: "move", idx: 0 }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  const h = e.resolve(bt).find(x => x.k === "heal");
  assert.equal(h.amount, 50);
});

test("participação marca quem entrou em campo (para os PPg)", () => {
  const { e, bt } = battle(() => 0.5,
    [mon("A", ["Normal"], {}, [tackle]), mon("B", ["Normal"], {}, [tackle])],
    [mon("C", ["Normal"], {}, [tackle])]);
  assert.equal(bt.sides.p1.team[0].part, true); assert.equal(bt.sides.p1.team[1].part, false);
  e.submit(bt, "p1", { kind: "switch", idx: 1 }); e.submit(bt, "p2", { kind: "move", idx: 0 }); e.resolve(bt);
  assert.equal(bt.sides.p1.team[1].part, true);
});

test("Sistema de QD: bônus de ability vira dado da QD no dano experimental", () => {
  const e = engine(() => 0.5);
  const bt = e.newBattle({ id: "q", format: 6, damage: "matrix",
    p1: { id: "A", name: "A", team: [mon("Guts", ["Normal"], { atk: 120, spe: 200 }, [tackle], { ability: "Guts", abilityText: "Quando está com status, golpes físicos causam +1 dado da QD de dano." })] },
    p2: { id: "B", name: "B", team: [mon("Alvo", ["Normal"], { hp: 500, spe: 1 }, [tackle])] } });
  e.activeState(bt, "p1").status = "par";
  e.submit(bt, "p1", { kind: "move", idx: 0 }); e.submit(bt, "p2", { kind: "move", idx: 0 });
  const hit = e.resolve(bt).find(x => x.k === "hit" && x.side === "p2");
  assert.ok(hit.notes.includes("Guts +1 QD"));
  // Tackle (40) = 2 dados de Poder +1 dado da QD do Guts = 3 dados da QD
  assert.equal(hit.count, 3);
});
