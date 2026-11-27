/* ============================================================
   V7 — Textos no sistema de QD (Qualidade de Dano)
   Converte textos de abilities e itens escritos em d6 para o sistema novo:
   • bônus/penalidade de dano "+1d6" / "−1d6"  → "+1 dado da QD" / "−1 dado da QD"
     (o dado é o mesmo que o golpe rola: d4, d6, d8… d20);
   • cura "cura 1d6 HP"                         → "recupera 1/16 (6,25%) do HP Máximo";
   • dano fixo "sofre 1d6 de dano"              → "sofre dano igual a 1/16 (6,25%) do HP Máximo";
   • cura fixa de abilities "recupera 5 HP"     → % do HP Máximo (mesma escala).
   Escala: cada 1d6 (média 3,5) vale 1/16 do HP Máximo; outros dados
   proporcionais à média (1d4 ≈ 4%, 1d8 ≈ 8%…). O STAB continua em d6
   (regra da Damage Matrix) e tabelas sorteadas ("role 1d6: 1-2 …"),
   durações ("por 1d4 turnos") ficam como estão.
   Funciona no navegador (window.hhQdText) e no Node (testes / conversão).
   ============================================================ */
(function(root){
  "use strict";
  const HP="do HP Máximo";
  const FRAC={6.25:"1/16",12.5:"1/8",18.75:"3/16",25:"1/4",31.25:"5/16",37.5:"3/8",50:"1/2"};
  const fmt=x=>(Math.round(x*100)/100).toString().replace(".",",");
  function pctOf(n,die){return n*((die+1)/2)/3.5*6.25;}
  function pctText(v){
    const r=Math.round(v*100)/100;
    if(FRAC[r])return `${FRAC[r]} (${fmt(r)}%) ${HP}`;
    return `${Math.max(1,Math.round(v))}% ${HP}`;
  }
  const dice=n=>`${n} dado${n>1?"s":""} da QD`;
  const D="(\\d+)\\s*d\\s*(\\d+)";
  const HEAL_VERB="(cura|curam|recupera|recuperam|restaura|restauram|regenera|regeneram)";
  const HURT_VERB="(sofre|sofrem|perde|perdem|toma|tomam)";

  function sentence(s,{abilityFlat=true}={}){
    if(/\bSTAB\b/i.test(s))return s;                         // STAB segue em d6
    if(/peri[óo]dic/i.test(s))return s;                      // dano de status (regra) segue em d6
    // "ignora 1d6 de redução defensiva" → QD sobe um passo
    s=s.replace(new RegExp("(ignora|ignoram)\\s+"+D+"(\\s+adicional)?\\s+(?:de|da)\\s+redu[çc][ãa]o defensiva","gi"),
      (m,v,n,d,ad)=>`${v} ${+n>1?`${n} degraus`:"1 degrau"}${ad?" a mais":""} da defesa do alvo (QD +${n} passo${+n>1?"s":""})`);
    // cura como substantivo: "cura de 1d6 HP", "a cura fica em 1d6", "regeneração sobe para 2d6"
    s=s.replace(new RegExp("((?:cura|regenera[çc][ãa]o|recupera[çc][ãa]o)(?:\\s+(?:de|fica em|sobe para|passa a ser|para))?)\\s+"+D+"(?:\\s*(?:de\\s+)?(?:HP|PV))?","gi"),
      (m,pre,n,d)=>`${pre} ${pctText(pctOf(+n,+d))}`);
    // cura em dados
    s=s.replace(new RegExp(HEAL_VERB+"\\s+"+D+"(?:\\s*(?:de\\s+)?(?:HP|PV|pontos de vida|de Vida|Vida))?","gi"),
      (m,v,n,d)=>`${v} ${pctText(pctOf(+n,+d))}`);
    // cura fixa (abilities): "recupera 5 HP"
    if(abilityFlat)s=s.replace(new RegExp(HEAL_VERB+"\\s+(\\d+)\\s*(?:de\\s+)?(?:HP|PV|pontos de vida)(?![^.]*%)","gi"),
      (m,v,n)=>`${v} ${pctText(+n/3.5*6.25)}`);
    // bônus / penalidade de dano em d6
    s=s.replace(new RegExp("([+＋])\\s*"+D+"(?!\\s*(?:HP|PV))","g"),(m,sg,n,d)=>d==="6"?`+${dice(+n)}`:m);
    s=s.replace(new RegExp("([−\\-–])\\s*"+D+"(?!\\s*(?:HP|PV))","g"),(m,sg,n,d)=>d==="6"?`−${dice(+n)}`:m);
    // "ganha 1d6 de dano" (bônus sem sinal)
    s=s.replace(new RegExp("(ganha|ganham|recebe|recebem|soma|somam|adiciona|adicionam)\\s+"+D+"\\s+(?:de\\s+)?dano(?!\\s+(?:igual|fixo))","gi"),
      (m,v,n,d)=>d==="6"?`${v} +${dice(+n)} de dano`:m);
    // dano fixo: "sofre 1d6 (de dano)", "perde 1d6 HP"
    s=s.replace(new RegExp(HURT_VERB+"\\s+"+D+"(?:\\s*(?:de\\s+)?(?:dano|HP|PV|de Vida)(?:\\s+adicional)?)?","gi"),
      (m,v,n,d)=>/^perde/i.test(v)?`${v} ${pctText(pctOf(+n,+d))}`:`${v} dano igual a ${pctText(pctOf(+n,+d))}`);
    // "causa 1d6 de dano (adicional) ao atacante" e "1d6 de dano" soltos
    s=s.replace(new RegExp("(causa|causam)\\s+"+D+"\\s+(?:de\\s+)?dano(\\s+adicional)?","gi"),
      (m,v,n,d)=>`${v} dano igual a ${pctText(pctOf(+n,+d))}`);
    s=s.replace(new RegExp(D+"\\s+de\\s+dano","g"),(m,n,d)=>d==="6"?`dano igual a ${pctText(pctOf(+n,+d))}`:m);
    return s;
  }
  function convert(text,opts){
    if(!text||typeof text!=="string")return text;
    if(!/\d\s*d\s*\d/.test(text)&&!(opts?.abilityFlat!==false&&/(cura|recupera|restaura|regenera)\w*\s+\d+\s*(?:de\s+)?(?:HP|PV)/i.test(text)))return text;
    // divide em frases (ponto/exclamação/interrogação), mantendo ";" na mesma frase
    return text.split(/(?<=[.!?])\s+/).map(s=>/\b(role|rola|rolar|rolam|sorteia)\b/i.test(s)?s:sentence(s,opts)).join(" ");
  }
  const api={convert,pctOf,pctText};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.hhQdText=api;
})(typeof window!=="undefined"?window:globalThis);
