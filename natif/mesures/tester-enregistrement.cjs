// Enregistrer sans rien perdre : sur toutes les pièces de Exemples/, travaille sur des copies.
// node natif/mesures/tester-enregistrement.cjs <dossier de travail>
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const { spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const dossier = process.argv[2];
fs.mkdirSync(dossier, { recursive: true });

const texte = b => (b[0] === 0x1f && b[1] === 0x8b ? zlib.gunzipSync(b) : b).toString('utf8');
const gz = b => b[0] === 0x1f && b[1] === 0x8b;
const lancer = (...a) => spawnSync(EXE, a, { stdio: 'ignore' }).status;
const piece = o => (o.doc && typeof o.doc === 'object' ? o.doc : o);
// Comparaison stricte, ordre des clés compris
const pareil = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let echecs = 0, essais = 0;
const verifier = (ok, nom, f) => { essais++; if (!ok) { echecs++; console.log('  ÉCHEC ' + f + ' : ' + nom); } };

const pieces = fs.readdirSync(path.join(RACINE, 'Exemples')).filter(f => f.endsWith('.conceptcad'));
const modifiees = [];
for (const f of pieces) {
  const src = path.join(RACINE, 'Exemples', f), o = fs.readFileSync(src), t0 = texte(o), j0 = JSON.parse(t0);
  const copie = path.join(dossier, 'copie-' + f);
  fs.copyFileSync(src, copie);

  // 1. Sans modification : les mêmes octets
  const sortie = path.join(dossier, 'sortie-' + f);
  fs.rmSync(sortie, { force: true });
  verifier(lancer('--reenregistrer', copie, sortie) === 0, 'enregistrement sans modification', f);
  verifier(fs.existsSync(sortie) && fs.readFileSync(sortie).equals(o), 'octets identiques sans modification', f);

  // 2. Une profondeur changée : cette seule valeur diffère, tout le reste est identique et dans le même ordre
  const feats = piece(j0).features || [];
  const i = feats.findIndex(x => x.type === 'extrude' && typeof x.distance === 'number');
  if (i < 0) { console.log(f + ' : identique (pas de profondeur à changer)'); continue; }
  const v = feats[i].distance + (feats[i].distance < 0 ? -0.1 - 0.2 : 0.1 + 0.2);
  fs.copyFileSync(src, copie);
  const modif = path.join(dossier, 'modif-' + f);
  fs.rmSync(modif, { force: true });
  verifier(lancer('--reenregistrer', copie, modif, i + '=' + v) === 0, 'enregistrement modifié', f);
  const om = fs.readFileSync(modif), tm = texte(om), attendu = JSON.parse(t0);
  piece(attendu).features[i].distance = v;
  verifier(pareil(JSON.parse(tm), attendu), 'seule la profondeur diffère', f);
  verifier(gz(om) === gz(o), 'même compression', f);
  // La différence dans le texte reste limitée à ce nombre
  let a = 0; while (a < t0.length && t0[a] === tm[a]) a++;
  let b = 0; while (b < t0.length - a && b < tm.length - a && t0[t0.length - 1 - b] === tm[tm.length - 1 - b]) b++;
  verifier(t0.length - a - b <= 24 && tm.length - a - b <= 24, 'zone changée limitée à un nombre', f);

  // 3. Retour à la valeur d'origine : le même texte
  const retour = path.join(dossier, 'retour-' + f);
  fs.rmSync(retour, { force: true });
  verifier(lancer('--reenregistrer', modif, retour, i + '=' + feats[i].distance) === 0, 'retour à la valeur', f);
  verifier(texte(fs.readFileSync(retour)) === t0, 'texte identique après retour', f);

  // 4. Enregistrer sur place : garde l'ancienne version en .bak
  fs.copyFileSync(src, copie);
  fs.rmSync(copie + '.bak', { force: true });
  verifier(lancer('--reenregistrer', copie, copie, i + '=' + v) === 0, 'enregistrement sur place', f);
  verifier(fs.existsSync(copie + '.bak') && fs.readFileSync(copie + '.bak').equals(o), 'copie .bak exacte', f);
  verifier(fs.readdirSync(dossier).every(n => !n.includes('.tmp')), 'aucun fichier temporaire restant', f);

  // 5. Fichier changé ailleurs après l'ouverture : refus, rien d'écrit
  fs.copyFileSync(src, copie);
  const code = lancer('--conflit', copie);
  verifier(code === 3, 'refus si le fichier a changé (code ' + code + ')', f);
  verifier(fs.readFileSync(copie).equals(Buffer.concat([o, Buffer.from(' ')])), 'fichier intact après refus', f);

  modifiees.push({ f, i, v, modif, id: feats[i].id });
  console.log(f + ' : fonction ' + i + ', ' + feats[i].distance + ' → ' + v);
  // Le Drapeau est la seule pièce modifiable dans le logiciel : toutes ses profondeurs passent au navigateur
  if (f.startsWith('003-')) feats.forEach((x, k) => {
    if (k === i || x.type !== 'extrude' || typeof x.distance !== 'number') return;
    const w = x.distance + (x.distance < 0 ? -0.3 : 0.3), m2 = path.join(dossier, 'modif' + k + '-' + f);
    fs.rmSync(m2, { force: true });
    verifier(lancer('--reenregistrer', src, m2, k + '=' + w) === 0, 'enregistrement fonction ' + k, f);
    modifiees.push({ f, i: k, v: w, modif: m2, id: x.id });
  });
}

// 6. Profondeur absente du fichier : ajoutée sans rien déplacer d'autre
{
  const f = pieces.find(x => x.startsWith('003-')), j = JSON.parse(texte(fs.readFileSync(path.join(RACINE, 'Exemples', f))));
  const i = piece(j).features.findIndex(x => x.type === 'extrude');
  delete piece(j).features[i].distance;
  const sans = path.join(dossier, 'sans-distance.conceptcad'), s2 = path.join(dossier, 'sans-distance-2.conceptcad');
  fs.writeFileSync(sans, JSON.stringify(j));
  fs.rmSync(s2, { force: true });
  verifier(lancer('--reenregistrer', sans, s2, i + '=12.5') === 0, 'ajout de la profondeur', 'sans distance');
  const r = JSON.parse(fs.readFileSync(s2, 'utf8'));
  verifier(piece(r).features[i].distance === 12.5, 'profondeur ajoutée', 'sans distance');
  delete piece(r).features[i].distance;
  verifier(pareil(r, j), 'reste identique', 'sans distance');
}

fs.writeFileSync(path.join(dossier, 'modifiees.json'), JSON.stringify(modifiees, null, 1));
console.log(`\n${essais - echecs}/${essais} contrôles réussis, ${pieces.length} pièces, ${modifiees.length} modifiées`);
process.exit(echecs ? 1 : 0);
