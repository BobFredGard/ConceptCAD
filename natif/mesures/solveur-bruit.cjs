// Ce que change le seul arrondi : compare le navigateur à lui-même, avec et sans un dernier chiffre décalé
// sur atan2, sin et cos (solveur-reference.cjs --bruit). Sert d'étalon aux écarts du natif, qui calcule ces
// fonctions avec une autre bibliothèque de maths.
'use strict';
const fs = require('fs'), path = require('path');
const dos = path.join(__dirname, '..', 'sortie');
const A = JSON.parse(fs.readFileSync(path.join(dos, 'reference-solveur.json')));
const B = JSON.parse(fs.readFileSync(path.join(dos, 'reference-solveur-bruit.json')));
const tr = [0, 0, 0, 0, 0, 0], pires = [];
let decisions = 0, etats = 0, decidees = 0;
A.forEach((ea, i) => {
  const eb = B[i];
  ea.cas.forEach((ca, j) => {
    const cb = eb.cas[j];
    ca.etapes.forEach((a, k) => {
      const b = cb.etapes[k];
      etats++;
      if (a.ok !== undefined) {
        decidees++;
        if (a.ok !== b.ok) decisions++;
      }
      let m = 0;
      const ind = new Map(b.ids.map((x, q) => [x, q]));
      a.ids.forEach((id, q) => {
        const r = ind.get(id);
        if (r === undefined) { m = 1e9; return; }
        m = Math.max(m, Math.abs(a.pts[2 * q] - b.pts[2 * r]), Math.abs(a.pts[2 * q + 1] - b.pts[2 * r + 1]));
      });
      a.ray.forEach((v, q) => { m = Math.max(m, Math.abs(v - b.ray[q])); });
      tr[m < 1e-9 ? 0 : m < 1e-6 ? 1 : m < 1e-3 ? 2 : m < 0.05 ? 3 : m < 1 ? 4 : 5]++;
      if (m > 1e-3) pires.push([m, ea.fichier, ea.esquisse, ca.type, k]);
    });
  });
});
console.log(`navigateur contre lui-même : ${etats} états`);
console.log(`écart < 1e-9 mm : ${tr[0]} | < 1e-6 : ${tr[1]} | < 1e-3 : ${tr[2]} | < 0,05 : ${tr[3]} | < 1 : ${tr[4]} | au-delà : ${tr[5]}`);
console.log(`décisions différentes sur ${decidees} saisies : ${decisions}`);
pires.sort((a, b) => b[0] - a[0]).slice(0, 30).forEach(p => console.log('  ' + p[0].toPrecision(3) + '  ' + p.slice(1).join(' ')));
