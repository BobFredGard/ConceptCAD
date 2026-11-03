// Installe le noyau v3 fabriqué (occt-build/out/v3) là où l'application le charge : occt/v3/.
//   node occt-build/installer.cjs
// Copie la colle, le .wasm (Git LFS), la table compat-v3.json et le traducteur compat-v3.cjs
// (source unique : occt-build/compat-v3.cjs — tests/test_moteur_v3.cjs vérifie que la copie est à jour).
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),SRC=path.join(__dirname,'out','v3'),DST=path.join(ROOT,'occt','v3');
const fichiers=[[path.join(SRC,'conceptcad_v3.js'),'conceptcad_v3.js'],[path.join(SRC,'conceptcad_v3.wasm'),'conceptcad_v3.wasm'],
  [path.join(SRC,'compat-v3.json'),'compat-v3.json'],[path.join(__dirname,'compat-v3.cjs'),'compat-v3.cjs'],
  [path.join(SRC,'PROVENANCE.txt'),'PROVENANCE.txt']];
for(const [s] of fichiers)if(!fs.existsSync(s)){console.error('absent : '+s+' — lancez d’abord node occt-build/build.cjs v3');process.exit(1);}
fs.mkdirSync(DST,{recursive:true});
for(const [s,d] of fichiers){fs.copyFileSync(s,path.join(DST,d));console.log(d+' '+(fs.statSync(s).size/1e6).toFixed(1)+' Mo');}
console.log('noyau v3 installé → '+DST);
