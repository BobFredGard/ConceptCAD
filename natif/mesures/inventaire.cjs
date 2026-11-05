// Lignes de src/ par grand domaine : node natif/mesures/inventaire.cjs
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', '..', 'src');
const DOMAINES = [
  ['FAO et posts', /^(88-|89-|90-60)/],
  ['Mise en plan', /^98-(mep|00-style|01-import-dxf)/],
  ['Rendu réaliste', /^98-(rendu|film)|^12-/],
  ['Assemblage et composants', /^(46|47|48)-/],
  ['Esquisseur et contraintes', /^(50-|39-|30-traits|41-profil|49-|60-|62-|99-raccourcis|99-mobile-creer)/],
  ['Import, export, fichiers', /^(90-30|90-40|90-50|97-fichiers)/],
  ['Fonctions 3D et rejeu', /^(20-|21-|31-|40-20|40-30|43-|51-|52-|53-|70-|71-|75-|76-|77-|78-|79-|80-|85-|86-|87-)/],
  ['Interface et vue 3D', /./],
];
const t = DOMAINES.map(d => ({ nom: d[0], lignes: 0, fichiers: 0, liste: [] }));
for (const f of fs.readdirSync(SRC).filter(x => x.endsWith('.js')).sort()) {
  const n = fs.readFileSync(path.join(SRC, f), 'utf8').split('\n').length - 1;
  const i = DOMAINES.findIndex(d => d[1].test(f));
  t[i].lignes += n; t[i].fichiers++; t[i].liste.push(f);
}
let total = 0;
for (const d of t) { total += d.lignes; console.log(String(d.lignes).padStart(7), String(d.fichiers).padStart(4), d.nom); }
console.log(String(total).padStart(7), '     Total');
if (process.argv[2] === '--detail') for (const d of t) console.log('\n' + d.nom + '\n  ' + d.liste.join(' '));
