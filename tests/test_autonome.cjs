// Fichier autonome (tools/autonome.cjs) : il se fabrique depuis le livrable, ne cite plus aucun
// fichier voisin et reste d'une taille raisonnable. L'essai réel, hors ligne : browser/autonome.spec.cjs.
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {fabriquer}=require('../tools/autonome.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autonome-'));
try{
  const f=path.join(dir,'a.html'),taille=fabriquer(f),h=fs.readFileSync(f,'utf8');
  A(taille>15e6&&taille<40e6,'taille raisonnable ('+(taille/1048576).toFixed(1)+' Mo)');
  A(!/<script[^>]*\bsrc=/.test(h),'plus aucun script chargé depuis un fichier');
  // l'icône d'onglet (V0.74.0) est incluse (href="data:…") : seul un fichier externe est refusé
  A(!/<link[^>]*\bhref=(?!["']?data:)/.test(h),'aucune feuille de style externe');
  A(h.indexOf('window.__EMB=')<h.indexOf('const APP_VER='),'le noyau est posé avant le code de l’application');
  A(h.includes('window.__EMB.pret(OCCT_FILES)')&&h.includes('if(m.emb)')&&h.includes('window.__EMB.rt'),'le code reconnaît le mode embarqué (noyau, worker, rendu)');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log(ko?'\n*** '+ko+' ÉCHEC(S) ***':'\n*** TOUT PASSE ***');
process.exit(ko?1:0);
