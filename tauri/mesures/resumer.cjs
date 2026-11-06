// Résume les résultats bruts de mesurer.cjs.
'use strict';
const fs=require('fs'),path=require('path');
const R=path.join(__dirname,'resultats');
const lire=n=>{const f=path.join(R,n+'.jsonl');return fs.existsSync(f)?fs.readFileSync(f,'utf8').trim().split('\n').map(l=>JSON.parse(l)):[];};
const med=l=>{const s=[...l].sort((a,b)=>a-b);return s.length?s[s.length>>1]:null;};
console.log('--- démarrage');
for(const c of ['app','chrome']){
  const d=lire('demarrage').filter(x=>x.cible===c);
  console.log(c,'profil neuf',d.filter(x=>x.neuf).map(x=>x.ms),'ensuite',d.filter(x=>!x.neuf).map(x=>x.ms),'médiane',med(d.filter(x=>!x.neuf).map(x=>x.ms)),d[0]&&d[0].version);
}
console.log('--- RAM');
for(const o of lire('ram')){
  if(o.echec){console.log(o.cible,o.piece,o.rep,'ÉCHEC',o.echec);continue;}
  console.log([o.piece,o.cible,'rep'+o.rep].join(' | '));
  for(const k of ['vide','ouvert','apres'])console.log('  ',k,JSON.stringify({prive:o[k].prive,engage:o[k].engage,ws:o[k].ws,gpuDed:o[k].gpuDed,gpuPart:o[k].gpuPart,proc:o[k].processus,noms:o[k].noms,top:o[k].detail.slice(0,5)}));
  console.log('   ouverture',o.ouvertureMs,'ms ; modif médiane',o.modifMedianeMs,'ms (début',o.modifPremieresMs,'fin',o.modifDernieresMs,') total',o.modifsTotalS,'s');
  console.log('   tas',JSON.stringify(o.tasOuvert),'→',JSON.stringify(o.tasApres),'cible',JSON.stringify(o.modifiee),'gpu',o.gpu,'dlg',o.dialogues,'err',o.erreurs);
}
