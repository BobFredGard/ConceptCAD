// Une cote change plus haut dans la pièce : les intersections et les projections d'autres esquisses suivent-elles comme dans le navigateur ?
// Fabrique des pièces avec le programme lui-même (vrais gestes dans sa fenêtre), puis les passe à tester-cotes-navigateur.cjs.
// node natif/mesures/tester-suivi.cjs <dossier de travail> [--racine=<dossier qui sert le ConceptCAD.html à comparer>]
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const { spawnSync } = require('child_process');
const EXEMPLES = path.resolve(__dirname, '..', '..', 'Exemples');
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const dossier = path.resolve(process.argv[2]);
const racine = (process.argv.find(a => a.startsWith('--racine=')) || '').slice(9);
const pieces = path.join(dossier, 'pieces');
fs.mkdirSync(pieces, { recursive: true });
const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); const j = JSON.parse(b); return j.doc || j; };
const PROJETER = 17, INTERSECTION = 18;

function esquisse(id, nom, o, u, v, n) {
  return { id, name: nom, plane: 'XY', origin: o, axU: u, axV: v, axN: n, points: { O: { x: 0, y: 0 } }, entities: [{ id: 'e2', t: 'cpoint', p: 'O', construction: true }], constraints: [], seq: 3, visible: true };
}
function jouer(entree, rang, etapes, sortie) {
  const t = path.join(dossier, 'jeu');
  fs.rmSync(t, { recursive: true, force: true });
  fs.mkdirSync(t, { recursive: true });
  const fe = path.join(t, 'etapes.json');
  fs.writeFileSync(fe, JSON.stringify(etapes));
  const so = path.join(t, 'sortie.conceptcad');
  const q = spawnSync(EXE, ['--essai-esquisse', entree, String(rang), so, fe, t], { timeout: 240000 });
  if (!fs.existsSync(so)) throw new Error('pas de fichier, code ' + q.status);
  fs.copyFileSync(so, sortie);
  return lire(sortie).sketches[rang];
}

const base = lire(path.join(EXEMPLES, 'Poche et Contour.conceptcad'));
const fichier = path.join(pieces, 'poche-suivie.conceptcad');
const d = Object.assign({}, base, {
  sketches: base.sketches.map((s, i) => i ? s : Object.assign({}, s, { visible: true })).concat([
    esquisse('sk_plat', 'À plat', [0.37, 0.23, 15.11], [1, 0, 0], [0, 1, 0], [0, 0, 1]),
    esquisse('sk_debout', 'Debout', [0.37, 0.23, 15.11], [1, 0, 0], [0, 0, 1], [0, -1, 0]),
  ]),
});
fs.writeFileSync(fichier, JSON.stringify(d));
const rPlat = base.sketches.length, rDebout = rPlat + 1;

// À plat : tout le corps (Maj+clic sur le bord). Debout : deux faces (Ctrl+clic), puis un point et un côté de l'Esquisse 1 projetés.
let s = jouer(fichier, rPlat, [
  { outil: INTERSECTION }, { clic: [69.63, 0], maj: true },
], fichier);
console.log('À plat, corps :', s.entities.filter(e => e.isect).length, 'intersections');
s = jouer(fichier, rDebout, [
  { outil: INTERSECTION }, { clic: [69.63, 0], ctrl: true }, { clic: [-70.37, 0], ctrl: true }, { touche: 'Enter' },
  { outil: PROJETER }, { clic: [-70.37, -15.11] }, { clic: [20, -15.11] },
], fichier);
console.log('Debout :', s.entities.filter(e => e.isect).length, 'intersections,', s.entities.filter(e => e.skSrc).length, 'projetées d\'esquisse,', s.entities.filter(e => e.proj && e.srcMid && !e.isect).length, 'arêtes');
const v = spawnSync(EXE, ['--verif', fichier, path.join(dossier, 'v.json')]);
if (v.status !== 0) throw new Error('la pièce fabriquée ne se relit pas');

const env = Object.assign({}, process.env, { CC_SOURCE: pieces });
if (racine) env.CC_RACINE_NAV = racine;
const q = spawnSync(process.execPath, [path.join(__dirname, 'tester-cotes-navigateur.cjs'), path.join(dossier, 'cotes')], { env, stdio: 'inherit' });
process.exit(q.status);
