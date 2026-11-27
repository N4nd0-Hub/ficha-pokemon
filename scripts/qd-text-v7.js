/* ============================================================
   V7 — Textos no sistema de QD (Qualidade de Dano)
   Converte textos de abilities e itens escritos em d6 para o sistema novo:
   • bônus/penalidade de dano "+1d6" / "−1d6"  → "+1 dado da QD" / "−1 dado da QD"
     (o dado é o mesmo que o golpe rola: d4, d6, d8… d20);
   • cura "cura 1d6 HP"                         → "recupera 1/16 (6,25%) do HP Máximo";
   • dano fixo "sofre 1d6 de dano"              → "sofre dano igual a 1/16 (6,25%) do HP Máximo";
   • cura fixa de abilities "recupera 5 HP"     → % do HP Máximo (mesma escala).
   Escala: cada 1d6 (média 3,5) vale 1/16 do HP Máximo; outros dados
   proporcionais à média (1d4 ≈ 4%, 1d8 ≈ 8%…). O STAB também vira dado da
   QD (+1; Tera do mesmo tipo e Adaptability +2). Dados base dos golpes
   ("6d6 base") viram "6 dados base". Ficam como estão: tabelas sorteadas
   ("role 1d6: 1-2 …"), durações ("por 1d4 turnos") e dano periódico de status.
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
  const HEAL_VERB="(cura|curam|curar|recupera|recuperam|recuperar|restaura|restauram|restaurar|regenera|regeneram)";
  const HURT_VERB="(sofre|sofrem|perde|perdem|toma|tomam)";

  function sentence(s,{abilityFlat=true}={}){
    // dano de status (periódico) segue em d6; só converte bônus de dano com sinal fora dele
    if(/peri[óo]dic/i.test(s))return s.replace(new RegExp("([+＋−\\-–])\\s*"+D+"\\s+de\\s+dano(?!\\s+peri)","g"),(m,sg,n,d)=>d==="6"?`${/[+＋]/.test(sg)?"+":"−"}${dice(+n)} de dano`:m);
    // golpes: dados base do Poder e crítico
    s=s.replace(/(\d+)d6(?=→)/g,"$1");
    s=s.replace(/o dano base (\d+)d6 é maximizado em \d+/gi,"os $1 dados base saem no valor máximo");
    s=s.replace(/maximiza apenas os (\d+)d6 base(?: para \d+)?/gi,"maximiza apenas os $1 dados base");
    s=s.replace(/(\d+)\s*d6\s+base/gi,(m,n)=>`${n} dado${+n>1?"s":""} base`);
    // defesa: "ignore -1d6 da Defense", "ignora -3d6 da redução de dano", "equivalente a -1d6 na Redução de Dano"
    s=s.replace(/(ignore|ignora|ignoram)\s*[−\-–]?\s*(\d+)\s*d6\s+(?:da|de|na)\s+(?:Defense(?:\s+ou\s+Sp\.?\s*Def)?|Sp\.?\s*Def|redu[çc][ãa]o (?:de dano|defensiva)|defesa)(?:\s+(?:dele|do alvo))?/gi,
      (m,v,n)=>`${v} ${+n>1?`${n} degraus`:"1 degrau"} da defesa do alvo (QD +${n} passo${+n>1?"s":""})`);
    s=s.replace(/equivalente a\s*[−\-–]\s*(\d+)\s*d6\s+na\s+Redu[çc][ãa]o de Dano/gi,(m,n)=>`equivalente a −${n} degrau${+n>1?"s":""} na defesa (QD do atacante +${n})`);
    s=s.replace(/(ganha|ganham|recebe|recebem)\s+(\d+)\s*d6\s+de\s+Redu[çc][ãa]o de Dano/gi,(m,v,n)=>`${v} ${n} degrau${+n>1?"s":""} de defesa (a QD do atacante cai ${n} passo${+n>1?"s":""})`);
    s=s.replace(/dados de dano f[íi]sico \(d6\)/gi,"dados de dano físico (dados da QD)");
    s=s.replace(/perder\s+(\d+)\s*d6\b/gi,(m,n)=>`perder ${dice(+n)}`);
    s=s.replace(/(\d+)\s*d6\s+a menos/gi,(m,n)=>`${dice(+n)} a menos`);
    s=s.replace(/[+＋]?\s*(\d+)\s*d6\s+(adicional\s+)?de\s+STAB/gi,(m,n,ad)=>`+${dice(+n)} ${ad?"adicional ":""}de STAB`);
    s=s.replace(/STAB\s+([+＋])?\s*(\d+)\s*d6/gi,(m,sg,n)=>`STAB +${dice(+n)}`);
    s=s.replace(/STAB duplo,\s*\+?(\d+)\s*d6/gi,(m,n)=>`STAB duplo, +${dice(+n)}`);
    // "ignora 1d6 de redução defensiva" → QD sobe um passo
    s=s.replace(new RegExp("(ignora|ignoram)\\s+"+D+"(\\s+adicional)?\\s+(?:de|da)\\s+redu[çc][ãa]o defensiva","gi"),
      (m,v,n,d,ad)=>`${v} ${+n>1?`${n} degraus`:"1 degrau"}${ad?" a mais":""} da defesa do alvo (QD +${n} passo${+n>1?"s":""})`);
    // cura como substantivo: "cura de 1d6 HP", "a cura fica em 1d6", "regeneração sobe para 2d6"
    s=s.replace(new RegExp("((?:cura|regenera[çc][ãa]o|recupera[çc][ãa]o)(?:\\s+(?:de|fica em|sobe para|passa a ser|para))?)\\s+"+D+"(?:\\s*(?:de\\s+)?(?:HP|PV))?","gi"),
      (m,pre,n,d)=>`${pre} ${pctText(pctOf(+n,+d))}`);
    // cura em dados
    s=s.replace(new RegExp(HEAL_VERB+"\\s+(?:imediatamente\\s+|ainda\\s+|mais\\s+|tamb[ée]m\\s+)?[+＋]?\\s*"+D+"(?:\\s*(?:de\\s+)?(?:HP|PV|pontos de vida|de Vida|Vida))?","gi"),
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
