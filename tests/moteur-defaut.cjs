// Moteur des suites (V0.43.0) : celui de l'application, le noyau OCCT 8 (occt/v3) + traducteur.
// Les tests lisent toujours occt/opencascade.full.js ; l'aiguillage tests/occt-moteur.cjs (posé ici
// dans NODE_OPTIONS, hérité par chaque suite lancée) redirige vers occt/v3.
//   OCCT_DIR=actuel  → ancien noyau 1.1.1 (occt/opencascade.*) ;  OCCT_DIR=<dossier> → ce moteur-là.
// Requis en tête de tests/run.cjs et tests/run-fast.cjs. Un test lancé seul (node tests/x.cjs)
// garde l'ancien noyau, sauf avec node tools/ci-moteur.cjs occt/v3 -- tests/x.cjs.
'use strict';
const path=require('path');
const ROOT=path.join(__dirname,'..');
if(process.env.OCCT_DIR==='actuel')delete process.env.OCCT_DIR;
else{
  if(!process.env.OCCT_DIR)process.env.OCCT_DIR=path.join(ROOT,'occt','v3');
  const hook=path.join(__dirname,'occt-moteur.cjs').split(path.sep).join('/');
  if(!(process.env.NODE_OPTIONS||'').includes('occt-moteur.cjs'))
    process.env.NODE_OPTIONS=((process.env.NODE_OPTIONS||'')+' --require "'+hook+'"').trim();
}
