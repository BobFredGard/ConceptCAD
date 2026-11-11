// Prépare tauri/dist : la page du logiciel, son noyau et ses bibliothèques, avec le pont en tête.
//   node tauri/preparer.cjs [ConceptCAD.html à emballer]
// ConceptCAD.html n'est pas modifié : seule sa copie dans dist reçoit le pont.
'use strict';
const fs=require('fs'),path=require('path');
const ICI=__dirname,ROOT=path.join(ICI,'..'),DIST=path.join(ICI,'dist');
const source=path.resolve(process.argv[2]||path.join(ROOT,'ConceptCAD.html'));
for(const n of ['v3','mt'])if(fs.statSync(path.join(ROOT,'occt',n,'conceptcad_v3.wasm')).size<1e7)throw new Error('noyau '+n+' réduit à un pointeur LFS : lancer git lfs checkout');
fs.rmSync(DIST,{recursive:true,force:true});
fs.mkdirSync(path.join(DIST,'occt'),{recursive:true});
for(const n of ['v3','mt'])fs.cpSync(path.join(ROOT,'occt',n),path.join(DIST,'occt',n),{recursive:true});
fs.cpSync(path.join(ROOT,'threejs'),path.join(DIST,'threejs'),{recursive:true});
fs.copyFileSync(path.join(ICI,'pont.js'),path.join(DIST,'pont.js'));
// V0.93.0 : la fiche et les icônes de l'application installable (PWA) ne sont pas dans dist —
// leurs liens sont retirés de la copie pour ne pas chercher deux fichiers absents.
const page=fs.readFileSync(source,'utf8').replace(/<link rel="(?:manifest|apple-touch-icon)" href="[^"]*">\r?\n/g,'');
if(!page.includes('<head>'))throw new Error('<head> introuvable dans '+source);
fs.writeFileSync(path.join(DIST,'index.html'),page.replace('<head>',()=>'<head><script src="pont.js"></script>'));
const version=/APP_VER='([^']+)'/.exec(page);
console.log('✓ dist prêt : '+(version?version[1]:'version ?')+' depuis '+source);
