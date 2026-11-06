// Fait produire au solveur de la version navigateur (exécuté dans Node, sans toucher à src/) les résultats
// de référence du solveur natif : sur chaque esquisse de Exemples/, l'ouverture, puis chaque cote changée et
// remise, puis les arêtes projetées déplacées et remises. Chaque scénario repart du fichier.
// Le budget de 400 ms du navigateur est neutralisé (horloge figée) : sinon le résultat dépendrait de la machine.
// Sortie : natif/sortie/reference-solveur.json
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const racine = path.join(__dirname, '..', '..');
const { loadApp } = require(path.join(racine, 'tests', 'appvm.cjs'));
const { ctx } = loadApp();

const lireDoc = f => {
  let b = fs.readFileSync(f);
  if (b[0] === 0x1f) b = zlib.gunzipSync(b);
  const j = JSON.parse(b.toString('utf8'));
  return j.doc || j;
};

const horlogeReelle = Date.now;
const nom = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
Date.now = () => 1e12;  // l'horloge figée rend les 400 ms inopérantes
// --bruit : atan2, sin et cos arrondis un cran plus loin, un appel sur deux, pour mesurer ce que le dernier
// chiffre d'un calcul change au résultat : c'est la seule différence attendue avec le natif (autre bibliothèque de maths).
const bruit = process.argv.includes('--bruit');
if (bruit) {
  let n = 0;
  const ulp = x => x * (1 + (n++ % 2 ? 2.220446049250313e-16 : 0));
  for (const f of ['atan2', 'sin', 'cos']) {
    const g = Math[f];
    Math[f] = (...a) => ulp(g(...a));
  }
}
// --communes : atan2, sin et cos écrits à l'identique dans natif/src/maths_communes.h. Les deux côtés font alors
// exactement les mêmes opérations : tout écart restant est une erreur de traduction.
const communes = process.argv.includes('--communes');
if (communes) {
  const PI = 3.141592653589793, PIO2 = 1.5707963267948966, PIO2_B = 6.123233995736766e-17, RAC3 = 1.7320508075688772;
  const sinPoly = y => { const z = y * y; let s = 1; for (let k = 19; k >= 3; k -= 2) s = 1 - s * z / (k * (k - 1)); return y * s; };
  const cosPoly = y => { const z = y * y; let s = 1; for (let k = 20; k >= 2; k -= 2) s = 1 - s * z / (k * (k - 1)); return s; };
  const reduire = x => { const k = Math.floor(x / PIO2 + 0.5); return [x - k * PIO2 - k * PIO2_B, ((k % 4) + 4) % 4]; };
  Math.sin = x => { if (!isFinite(x)) return NaN; const [y, q] = reduire(x); return q === 0 ? sinPoly(y) : q === 1 ? cosPoly(y) : q === 2 ? -sinPoly(y) : -cosPoly(y); };
  Math.cos = x => { if (!isFinite(x)) return NaN; const [y, q] = reduire(x); return q === 0 ? cosPoly(y) : q === 1 ? -sinPoly(y) : q === 2 ? -cosPoly(y) : sinPoly(y); };
  const atanPetit = t => { const z = t * t; let s = 0; for (let k = 33; k >= 1; k -= 2) s = 1 / k - z * s; return t * s; };
  const atan = t => t > 1 ? PIO2 - atan(1 / t) : t > 0.2679491924311227 ? PI / 6 + atanPetit((t * RAC3 - 1) / (t + RAC3)) : atanPetit(t);
  Math.atan2 = (y, x) => {
    if (isNaN(x) || isNaN(y)) return NaN;
    if (x === 0 && y === 0) return 0;
    const ax = Math.abs(x), ay = Math.abs(y);
    let a = ax === 0 ? PIO2 : ay === 0 ? 0 : atan(ay / ax);
    if (x < 0) a = PI - a;
    return y < 0 ? -a : a;
  };
}
const dossier = path.join(racine, 'Exemples');
const fichiers = fs.readdirSync(dossier).filter(f => f.endsWith('.conceptcad') && (!nom || f.includes(nom))).sort();

vm.runInContext(`
  function __prep(src, doc0) {
    const sk = JSON.parse(JSON.stringify(src));
    // Dans l'ordre de l'application : chargement du document, puis ouverture de l'esquisse
    doc.sketches = [sk]; doc.features = [];
    migrateSketch(sk);
    skFixSurProjRepair(sk);
    skValsNote(sk);
    skGapToAngle(sk);
    const arcPts = new Set();
    (sk.entities || []).forEach(e => { if (e && e.t === 'arc') { arcPts.add(e.pa); arcPts.add(e.pb); } });
    (sk.constraints || []).forEach(c => {
      if (c.type !== 'symmetric' || c.inf) return;
      if ([c.a, c.b].some(id => { const l = entById(sk, id); return l && (arcPts.has(l.p1) || arcPts.has(l.p2)); })) c.inf = true;
    });
    return sk;
  }
  function __etat(sk) {
    const P = sk.points, pts = [], ray = [];
    Object.keys(P).forEach(k => { pts.push(P[k].x, P[k].y); });
    (sk.entities || []).forEach(e => { if (e.t === 'circle' || e.t === 'arc') ray.push(e.r); });
    return { pts, ray, res: skResid(sk), ids: Object.keys(P) };
  }
  function __jouer(src) {
    const cas = [];
    // 1. Ouverture
    let sk = __prep(src);
    const t = { type: 'ouverture', etapes: [] };
    const e0 = __etat(sk);
    t.etapes.push(Object.assign({ avant: true }, e0));
    solveSketch(sk);
    t.etapes.push(__etat(sk));
    cas.push(t);
    // 2. Chaque cote : petit changement, retour, grand changement (par petits pas), retour
    (src.dims || []).forEach(d0 => {
      const v = +d0.value;
      if (d0.ref || !isFinite(v) || !v) return;
      sk = __prep(src);
      solveSketch(sk);
      const d = sk.dims.find(x => x.id === d0.id);
      if (!d || d.ref) return;
      const c = { type: 'cote', cote: d.id, v: d.value, etapes: [] };
      [1.03, 1, 1.2, 1].forEach(k => {
        d.value = v * k;
        solveSketch(sk);
        c.etapes.push(Object.assign({ valeur: d.value }, __etat(sk)));
      });
      cas.push(c);
    });
    // 3. Les arêtes projetées bougent, comme quand la pièce change, puis reviennent
    sk = __prep(src);
    solveSketch(sk);
    const proj = new Set();
    (sk.entities || []).forEach(e => { if (e && e.proj) skProjPids(sk, e).forEach(p => proj.add(p)); });
    if (proj.size) {
      const c = { type: 'projection', etapes: [] };
      [[0.7, -0.4], [-0.7, 0.4], [6, 3], [-6, -3]].forEach(([dx, dy]) => {
        proj.forEach(p => { const q = sk.points[p]; if (q) { q.x += dx; q.y += dy; } });
        solveSketch(sk);
        c.etapes.push(Object.assign({ dx, dy }, __etat(sk)));
      });
      cas.push(c);
    }
    // 4. Comme à la main, sans repartir du fichier : chaque cote saisie (dont des valeurs impossibles, refusées),
    // puis une annulation. Le résultat dépend ici de tout ce qui précède : c'est le cas le plus exigeant.
    sk = __prep(src);
    solveSketch(sk);
    skEdit = sk; skUndoStack = []; skRedoStack = [];
    if ((src.dims || []).length) {
      const c = { type: 'saisies', etapes: [] };
      (src.dims || []).forEach(d0 => {
        const v = +d0.value;
        if (d0.ref || !isFinite(v) || !v) return;
        [1.1, 0.3, 4, 1].forEach(k => {
          const d = sk.dims.find(x => x.id === d0.id);
          if (!d || d.ref) return;
          const nv = v * k;
          skPushUndo();
          skFirstDimScale(sk, d, nv);
          d.value = nv;
          const ok = skSolveOrRevert(sk, 'Cote');
          c.etapes.push(Object.assign({ cote: d0.id, valeur: nv, ok }, __etat(sk)));
          if (k === 1.1 && ok) {
            skUndoTrans();
            c.etapes.push(Object.assign({ annule: true }, __etat(sk)));
          }
        });
      });
      skEdit = null;
      cas.push(c);
    }
    skEdit = null;
    return JSON.stringify(cas);
  }
`, ctx);

const sortie = [];
const t0 = horlogeReelle();
let nS = 0, nC = 0;
for (const f of fichiers) {
  let esquisses;
  try { esquisses = lireDoc(path.join(dossier, f)).sketches || []; } catch (e) { console.log('illisible', f); continue; }
  for (const s of esquisses) {
    ctx.__src = s;
    const debut = horlogeReelle();
    const cas = JSON.parse(vm.runInContext('__jouer(__src)', ctx));
    nS++; nC += cas.length;
    sortie.push({ fichier: f, esquisse: s.id, nom: s.name, cas, ms: horlogeReelle() - debut });
    const ms = horlogeReelle() - debut;
    if (ms > 5000) console.log(`  ${f} ${s.id} : ${cas.length} scénarios en ${(ms / 1000).toFixed(1)} s`);
  }
  console.log(`${f} fait, ${((horlogeReelle() - t0) / 1000).toFixed(0)} s`);
}
const cible = path.join(__dirname, '..', 'sortie', bruit ? 'reference-solveur-bruit.json' : communes ? 'reference-solveur-communes.json' : nom ? 'reference-solveur-essai.json' : 'reference-solveur.json');
fs.writeFileSync(cible, JSON.stringify(sortie));
console.log(`${nS} esquisses, ${nC} scénarios, ${(fs.statSync(cible).size / 1e6).toFixed(1)} Mo, ${((horlogeReelle() - t0) / 1000).toFixed(0)} s`);
process.exit(0);
