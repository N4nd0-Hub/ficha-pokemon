'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const SOURCE=fs.readFileSync(path.join(__dirname,'../scripts/damage-matrix-v6.js'),'utf8');

function fakeBox(label){
  const span={textContent:label,dataset:{}};
  const box={classList:{on:false,toggle(c,v){this.on=v;}},querySelector:()=>span};
  const b={textContent:'',closest:()=>box};
  return {b,span,box};
}
function load(pokemon,matrix={},boxes={}){
  const ctx={
    state:{damageMatrix:{enabled:true,targetDef:100,targetSpd:100,effectiveness:1,...matrix}},
    current:pokemon,
    normalizeTypeName:t=>t?String(t)[0].toUpperCase()+String(t).slice(1).toLowerCase():'',
    combatEffectiveStat:(p,k)=>p.stats[k],
    document:{_l:[],dispatchEvent(){this._l.forEach(f=>f());},addEventListener(t,f){this._l.push(f);},getElementById:id=>boxes[id]?.b||null},
    CustomEvent:function(){},
    Math
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(SOURCE,ctx);
  return ctx.hhDamageMatrix;
}
const blaziken=(extra={})=>({name:'Blaziken',level:36,type1:'Fire',type2:'Fighting',abilityName:'Blaze',stats:{atk:120,spa:110,def:70,spd:70},gimmicks:{tera:{active:false,type:''}},...extra});
const move=(name,type,category,power)=>({name,type,category,power});

test('Qualidade por faixa de atributo, igual ao Arena',()=>{
  const dm=load(blaziken());
  const cases=[[49,0],[50,1],[75,1],[76,2],[100,2],[101,3],[125,3],[150,4],[175,5],[200,6],[225,7],[226,8]];
  for(const [stat,q] of cases)assert.equal(dm.quality(stat),q,`stat ${stat}`);
});

test('Poder define os dados, a diferença de Qualidade define a QD, nível soma fixo',()=>{
  const dm=load(blaziken());
  const p=dm.profile(move('Blaze Kick','Fire','Physical',85));
  // ATK 120 (Q3) vs DEF 100 (Q2): gap 1 → d8; Poder 85 → 5 dados; STAB 1d6; nível 36 → +7
  assert.equal(p.count,5);assert.equal(p.qd,'d8');assert.equal(p.stab,1);assert.equal(p.levelBonus,7);
  assert.equal(p.expression,'5d8 + 1d6 STAB + 7 fixos');
});

test('QD d4 quando o alvo tem Qualidade maior e d20 no topo',()=>{
  assert.equal(load(blaziken(),{targetDef:200}).profile(move('Tackle','Normal','Physical',40)).qd,'d4');
  const strong=blaziken({stats:{atk:300,spa:110,def:70,spd:70}});
  assert.equal(load(strong,{targetDef:40}).profile(move('Tackle','Normal','Physical',40)).qd,'d20');
});

test('Super efetivo sobe um dado e um passo; resistido desce; imune zera',()=>{
  const m=move('Blaze Kick','Fire','Physical',85);
  const up=load(blaziken(),{effectiveness:2}).profile(m);
  assert.equal(up.count,6);assert.equal(up.qd,'d10');
  const down=load(blaziken(),{effectiveness:.5}).profile(m);
  assert.equal(down.count,4);assert.equal(down.qd,'d6');
  const none=load(blaziken(),{effectiveness:0}).profile(m);
  assert.equal(none.immune,true);assert.equal(load(blaziken()).roll(none).total,0);
});

test('Especial usa SP.ATK contra SP.DEF do alvo',()=>{
  const p=load(blaziken(),{targetSpd:40}).profile(move('Flamethrower','Fire','Special',90));
  assert.equal(p.offKey,'spa');assert.equal(p.defKey,'spd');assert.equal(p.qd,'d12'); // Q3 vs Q0: diferença 3 → d12
});

test('STAB: Tera do mesmo tipo dá 2d6; Adaptability 1 + metade dos dados',()=>{
  const tera=load(blaziken({gimmicks:{tera:{active:true,type:'Fire'}}})).profile(move('Blaze Kick','Fire','Physical',85));
  assert.equal(tera.stab,2);
  const adapt=load(blaziken({abilityName:'Adaptability'})).profile(move('Blaze Kick','Fire','Physical',85));
  assert.equal(adapt.stab,1+Math.ceil(5/2));
  assert.equal(load(blaziken()).profile(move('Thunder Punch','Electric','Physical',75)).stab,0);
});

test('Technician e multi-hit alteram o Poder efetivo',()=>{
  const tech=load(blaziken({abilityName:'Technician'})).profile(move('Quick Attack','Normal','Physical',40));
  assert.equal(tech.effectiveBP,60);assert.equal(tech.count,3);
  const dk=load(blaziken()).profile(move('Double Kick','Fighting','Physical',30));
  assert.equal(dk.hits,2);assert.equal(dk.effectiveBP,60);
  const seed=load(blaziken({abilityName:'Skill Link'})).profile(move('Bullet Seed','Grass','Physical',25));
  assert.equal(seed.hits,5);assert.equal(seed.effectiveBP,125);assert.equal(seed.count,6);
});

test('Golpes de Status não têm perfil de dano',()=>{
  assert.equal(load(blaziken()).profile(move('Swords Dance','Normal','Status',0)),null);
});

test('Rolagem fica dentro dos limites e o crítico natural maximiza a QD',()=>{
  const dm=load(blaziken());
  const p=dm.profile(move('Blaze Kick','Fire','Physical',85));
  for(let i=0;i<200;i++){
    const r=dm.roll(p);
    assert.equal(r.dice.length,6);
    assert.ok(r.total>=5+1+7&&r.total<=40+6+7,`total ${r.total}`);
  }
  const crit=dm.roll(p,{critical:'natural'});
  assert.ok(crit.dice.filter(d=>d.group==='qd').every(d=>d.value===8));
  assert.ok(crit.total>=40+1+7);
});

test('Quadro de STATUS mostra Qualidade e QD com a Matrix ligada e volta ao normal desligada',()=>{
  const boxes={atkBonus:fakeBox('Bônus físico'),spaBonus:fakeBox('Bônus especial'),defReduce:fakeBox('Redução física'),spdReduce:fakeBox('Redução especial')};
  const dm=load(blaziken(),{targetDef:100},boxes);
  assert.equal(boxes.atkBonus.b.textContent,'ATK 120 · Q3');
  assert.match(boxes.atkBonus.span.textContent,/QD d8 contra DEF do alvo 100/);
  assert.equal(boxes.defReduce.b.textContent,'DEF 70 · Q1');
  assert.equal(boxes.atkBonus.box.classList.on,true);
  dm.set({enabled:false});
  assert.equal(boxes.atkBonus.span.textContent,'Bônus físico');
  assert.equal(boxes.atkBonus.box.classList.on,false);
});

test('Régua mostra o degrau base e o final quando a efetividade muda a QD',()=>{
  const dm=load(blaziken(),{effectiveness:2});
  const html=dm.ladderHtml(dm.profile(move('Flamethrower','Fire','Special',90)));
  assert.match(html,/is-final">d10</);
  assert.match(html,/is-base">d8</);
  assert.match(html,/sobe 1 degrau/);
});
