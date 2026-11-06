// Installe le noyau v3 fabriqué (occt-build/out/v3) là où l'application le charge : occt/v3/.
//   node occt-build/installer.cjs [mt]   (mt : noyau multicœur, dans occt/mt/)
// Copie la colle, le .wasm (Git LFS), la table compat-v3.json et le traducteur compat-v3.cjs
// (source unique : occt-build/compat-v3.cjs — tests/test_moteur_v3.cjs vérifie que la copie est à jour).
'use strict';
const fs=require('fs'),path=require('path');
const V=process.argv[2]==='mt'?'mt':'v3';
const ROOT=path.join(__dirname,'..'),SRC=path.join(__dirname,'out',V),DST=path.join(ROOT,'occt',V);
const fichiers=[[path.join(SRC,'conceptcad_v3.js'),'conceptcad_v3.js'],[path.join(SRC,'conceptcad_v3.wasm'),'conceptcad_v3.wasm'],
  // mt : même table que le noyau normal, celle que la page utilise pour les deux
  [V==='v3'?path.join(SRC,'compat-v3.json'):path.join(ROOT,'occt','v3','compat-v3.json'),'compat-v3.json'],...(V==='v3'?[[path.join(__dirname,'compat-v3.cjs'),'compat-v3.cjs']]:[]),
  [path.join(SRC,'PROVENANCE.txt'),'PROVENANCE.txt']];
for(const [s] of fichiers)if(!fs.existsSync(s)){console.error('absent : '+s+' — lancez d’abord node occt-build/build.cjs '+V);process.exit(1);}
fs.mkdirSync(DST,{recursive:true});
for(const [s,d] of fichiers){fs.copyFileSync(s,path.join(DST,d));console.log(d+' '+(fs.statSync(s).size/1e6).toFixed(1)+' Mo');}
// Pour les tests sous Node : les fils relancent la colle, qui doit être lue comme un module
if(V==='mt')fs.writeFileSync(path.join(DST,'package.json'),'{"type":"module"}\n');
console.log('noyau '+V+' installé → '+DST);
