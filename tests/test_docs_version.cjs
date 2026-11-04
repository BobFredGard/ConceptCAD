// V0.47.2 : « les numéro de version ne sont jamais corectement mis à jour » — README, package.json
// et CHANGELOG doivent suivre APP_VER (tools/docs-version.cjs, appelé par build.js).
const fs=require('fs'),path=require('path');
const {synchroniser,appVer,nbVersions}=require('../tools/docs-version.cjs');
const ROOT=path.join(__dirname,'..');
const lire=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const ATT=[];const att=(ok,m)=>{console.log((ok?'  ✓ ':'  ✗ ')+m);if(!ok)ATT.push(m);};
const v=appVer();
const r=synchroniser(false);
att(!r.erreurs.length,'1 : tous les passages à tenir à jour existent ('+(r.erreurs.join(' ; ')||'aucune erreur')+')');
att(!r.retards.length,'2 : rien en retard sur '+v+' ('+(r.retards.join(', ')||'aucun')+')');
att(JSON.parse(lire('package.json')).version===v.slice(1),'3 : package.json = APP_VER');
att(lire('README.md').includes('Version actuelle : **'+v+'**'),'4 : README = APP_VER');
att(lire('README.md').includes('renommé en V0.33.0'),'5 : la version historique du README n’est pas touchée');
const c=lire('CHANGELOG.md');
att(c.includes('à `'+v+'`')&&c.includes('## '+v+' - '),'6 : CHANGELOG : en-tête et entrée de '+v);
const nb=nbVersions(c);
att(c.includes('**'+nb+' versions**'),'7 : CHANGELOG : '+nb+' versions annoncées');
if(ATT.length){console.log('ÉCHEC : '+ATT.length);process.exit(1);}
console.log('OK : documents alignés sur '+v);
