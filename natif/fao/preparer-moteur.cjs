// Prépare ce dont le moteur FAO a besoin à côté du programme (sortie/fao) : la page de la version
// de référence, le noyau OCCT 8 et les quelques fichiers qui font tourner la page hors navigateur.
//   node fao/preparer-moteur.cjs --racine=D:/ConceptCAD --tag=V0.69.0
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const RACINE = opt('racine', 'D:/ConceptCAD'), TAG = opt('tag', 'V0.69.0');
const KIT = path.resolve(__dirname, '..', 'sortie', 'fao');
const git = f => execFileSync('git', ['-C', RACINE, 'show', TAG + ':' + f], { maxBuffer: 1 << 30 });
const ecrire = (f, d) => { const p = path.join(KIT, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, d); };
for (const f of ['ConceptCAD.html', 'tests/appvm.cjs', 'tests/noyau.cjs', 'tests/lire-projet.cjs', 'occt-build/compat-v3.cjs', 'occt/v3/compat-v3.json', 'occt/v3/conceptcad_v3.js', 'PostPro']) {
  if (f === 'PostPro') continue;
  ecrire(f, git(f));
}
// Le noyau lui-même : un gros fichier, pris sur le disque
for (const f of ['occt/v3/conceptcad_v3.wasm']) { fs.mkdirSync(path.dirname(path.join(KIT, f)), { recursive: true }); fs.copyFileSync(path.join(RACINE, f), path.join(KIT, f)); }
for (const f of ['moteur.cjs', 'minidom.cjs']) fs.copyFileSync(path.join(__dirname, f), path.join(KIT, f));
fs.writeFileSync(path.join(KIT, 'VERSION.txt'), TAG + '\n');
console.log('moteur prêt : ' + KIT);
