// Ce que l'écran d'esquisse affiche, comparé au navigateur sur toutes les esquisses de Exemples/ :
// état du bandeau, santé, libertés, points et rayons encore libres, textes des listes.
// node natif/mesures/tester-panneau.cjs <dossier de travail>
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const { spawnSync } = require('child_process');
const racine = path.join(__dirname, '..', '..');
const { loadApp } = require(path.join(racine, 'tests', 'appvm.cjs'));
const { ctx } = loadApp();
const dossier = process.argv[2];
fs.mkdirSync(dossier, { recursive: true });
const exemples = path.join(racine, 'Exemples');
const sortie = path.join(dossier, 'panneau-natif.json');
const BANC = path.join(__dirname, '..', 'sortie', 'BancDessin.exe');
const r = spawnSync(BANC, ['--panneau', exemples, sortie], { stdio: 'inherit' });
if (r.status !== 0) { console.log('Le banc a échoué : ' + r.status); process.exit(1); }
const natif = JSON.parse(fs.readFileSync(sortie, 'utf8'));

vm.runInContext(`
  drawSketch2D = () => {}; renderSkPanel = () => {}; skRefreshHealth = () => {}; skStatus = () => {}; skUndoBtn = () => {};
  function __lire(src) {
    const sk = JSON.parse(JSON.stringify(src));
    doc.sketches = [sk]; doc.features = [];
    skView = { s: 1, cx: 0, cy: 0 }; skUpdateTols();
    migrateSketch(sk); skFixSurProjRepair(sk); skValsNote(sk); skGapToAngle(sk);
    const arcPts = new Set();
    (sk.entities || []).forEach(e => { if (e && e.t === 'arc') { arcPts.add(e.pa); arcPts.add(e.pb); } });
    (sk.constraints || []).forEach(c => {
      if (c.type !== 'symmetric' || c.inf) return;
      if ([c.a, c.b].some(id => { const l = entById(sk, id); return l && (arcPts.has(l.p1) || arcPts.has(l.p2)); })) c.inf = true;
    });
    skEdit = sk; skSel = null; skSelX = []; skDofCache = {};
    solveSketch(sk);
    const H = skHealth(sk); sk._health = H;
    const I = skDofInfo(sk);
    return {
      statut: skDefaultStatus(),
      sante: 'Contours : ' + H.loops + (H.holes ? ' · trous : ' + H.holes : '') + (H.opens.length ? ' · ⚠ ' + H.opens.length + ' bout(s) ouvert(s)' : ''),
      libertes: I.dof,
      pointsLibres: Object.keys(sk.points).filter(p => !I.ptFull(p)).sort(),
      entitesLibres: sk.entities.filter(e => !I.entFull(e)).map(e => e.id).sort(),
      ouverts: H.opens.length, doublons: H.dupes.length, degeneres: H.degen.length, croisements: H.selfints.length,
      contraintes: sk.constraints.map(c => conDesc(sk, c)),
      cotes: sk.dims.map(d => dimDesc(sk, d)),
      fixes: [...skFixed(sk)].sort(),
    };
  }
`, ctx);

const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); const j = JSON.parse(b.toString('utf8')); return j.doc || j; };
const docs = {};
let nb = 0, fautes = 0, exemplesFautes = [];
const parChamp = {};
for (const n of natif) {
  if (!docs[n.fichier]) docs[n.fichier] = lire(path.join(exemples, n.fichier));
  const src = (docs[n.fichier].sketches || []).find(s => s.id === n.esquisse);
  if (!src) continue;
  ctx.__s = src;
  let w;
  try { w = vm.runInContext('__lire(__s)', ctx); } catch (e) { console.log('navigateur en erreur', n.fichier, n.esquisse, e.message); continue; }
  nb++;
  let bon = true;
  for (const k of Object.keys(w)) {
    const a = JSON.stringify(n[k] && n[k].sort && (k === 'pointsLibres' || k === 'entitesLibres' || k === 'fixes') ? [...n[k]].sort() : n[k]), b = JSON.stringify(w[k]);
    if (a !== b) {
      bon = false;
      parChamp[k] = (parChamp[k] || 0) + 1;
      if (exemplesFautes.length < 12) exemplesFautes.push(n.fichier + ' ' + n.esquisse + ' ' + k + '\n   natif       ' + String(a).slice(0, 240) + '\n   navigateur  ' + String(b).slice(0, 240));
    }
  }
  if (!bon) fautes++;
}
console.log(`${nb} esquisses comparées, ${nb - fautes} identiques à l'écran`);
if (fautes) { console.log('Écarts par champ : ' + JSON.stringify(parChamp)); exemplesFautes.forEach(x => console.log(x)); process.exitCode = 1; }
