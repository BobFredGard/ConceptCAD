// Carte des tests : quelles lignes de src/ (et PostPro/) chaque suite exécute réellement.
//
// Chaque suite lancée par le pool (tests/pool.cjs) charge tests/carte-releve.cjs : le moteur
// JavaScript note, à la sortie du processus, les fonctions exécutées. La partie
// « ConceptCAD.html » (le script chargé par tests/appvm.cjs) est ramenée aux fichiers sources
// grâce aux bandeaux que build.js place avant chaque fichier, puis rangée par suite :
//   { "src/20-60-conges.js": { b: <empreinte Git du fichier au moment du test>, l: "12-40,45" } }
// L'empreinte (git hash-object -w) permet ensuite de comparer le fichier actuel à celui qu'a vu la
// suite (git diff entre deux empreintes) : les lignes modifiées sont lues dans les coordonnées de
// la carte, quel que soit le nombre de commits ou de modifications non commitées depuis.
//
// La carte est rangée dans le dossier Git commun (.git/conceptcad-carte-tests.json) : partagée par
// le dépôt principal et tous les worktrees, jamais versionnée. Chaque exécution d'une suite met à
// jour son entrée ; tests/run-cible.cjs s'en sert pour ne lancer que les suites concernées.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'ConceptCAD.html');
const git = (args, input) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', input, maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] });
let COMMUN = null;
function dossierCommun() {
  if (!COMMUN) COMMUN = path.resolve(ROOT, git(['rev-parse', '--git-common-dir']).trim());
  return COMMUN;
}
const fichierCarte = () => process.env.CARTE_TESTS || path.join(dossierCommun(), 'conceptcad-carte-tests.json');

function lireCarte() {
  try { const c = JSON.parse(fs.readFileSync(fichierCarte(), 'utf8')); if (c && c.v === 1 && c.suites) return c; } catch (e) { /* pas encore de carte */ }
  return { v: 1, suites: {} };
}
// Réécrit seulement les suites passées (relit la carte juste avant : une autre session a pu écrire).
function ecrireCarte(maj) {
  const c = lireCarte();
  Object.assign(c.suites, maj);
  c.date = new Date().toISOString();
  const f = fichierCarte(), tmp = f + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(c));
  fs.renameSync(tmp, f);
  return c;
}

// Ligne de commentaire seul (// …, /* … */, * … d'un bloc) : sans effet sur les suites
function estCommentaire(t) {
  t = t.trim();
  return t === '' || t.startsWith('//') || (/^\/?\*/.test(t) && !/\*\/.*\S/.test(t.replace(/^\/\*/, '')));
}

// Lignes sans code d'un texte JavaScript (vides ou entièrement en commentaire, y compris le milieu
// d'un long /* … */) : tableau indexé par ligne (0 = 1re ligne). Le découpage en mots d'acorn
// suffit (pas d'analyse complète : un fichier de src/ seul peut ne pas être un script entier) ;
// sans acorn, ligne par ligne.
function lignesSansCode(texte) {
  const lignes = texte.split('\n');
  const out = new Uint8Array(lignes.length);
  let acorn = null;
  try { acorn = require('acorn'); } catch (e) { /* repli */ }
  if (acorn) {
    try {
      const debuts = [0];
      for (let i = texte.indexOf('\n'); i >= 0; i = texte.indexOf('\n', i + 1)) debuts.push(i + 1);
      const ligneDe = p => { let lo = 0, hi = debuts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (debuts[m] <= p) lo = m; else hi = m - 1; } return lo; };
      const code = new Uint8Array(lignes.length);
      for (const t of acorn.tokenizer(texte, { ecmaVersion: 'latest', allowHashBang: true })) {
        const a = ligneDe(t.start), b = ligneDe(Math.max(t.start, t.end - 1));
        for (let l = a; l <= b; l++) code[l] = 1;
      }
      for (let l = 0; l < lignes.length; l++) out[l] = code[l] ? 0 : 1;
      return out;
    } catch (e) { /* texte que le découpage refuse : repli */ }
  }
  lignes.forEach((t, l) => { out[l] = estCommentaire(t) ? 1 : 0; });
  return out;
}

// ── Le script de ConceptCAD.html découpé par fichier source ──
// Même extraction que tests/appvm.cjs (premier <script>) : les positions notées par le moteur
// sont relatives à ce texte.
function decouper(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('script introuvable dans ConceptCAD.html');
  const script = m[1];
  const tete = crypto.createHash('sha1').update(html.slice(0, m.index) + '\u0000' + html.slice(m.index + m[0].length)).digest('hex');
  const debuts = [0];
  for (let i = script.indexOf('\n'); i >= 0; i = script.indexOf('\n', i + 1)) debuts.push(i + 1);
  // position du premier caractère non blanc de chaque ligne (-1 : ligne vide) ; com : commentaire
  // seul (un commentaire ENTRE deux fonctions appartient au script entier, donc à TOUTES les
  // suites : il ne compte que s'il est dans une fonction)
  const pos = new Int32Array(debuts.length), com = lignesSansCode(script);
  for (let l = 0; l < debuts.length; l++) {
    const fin = l + 1 < debuts.length ? debuts[l + 1] : script.length;
    let p = debuts[l];
    while (p < fin && /\s/.test(script[p])) p++;
    pos[l] = p < fin ? p : -1;
  }
  // bandeaux de build.js : « /* ═══ 20-60-conges.js — conges ═══ */ », « /* ═══ PostPro/x.js — fiche machine ═══ */ »
  const sections = [];
  const BAND = /^\/\* ═{5,} (\S+) — .* ═{5,} \*\/\r?$/;
  for (let l = 0; l < debuts.length; l++) {
    const fin = l + 1 < debuts.length ? debuts[l + 1] : script.length;
    if (script.charCodeAt(debuts[l]) !== 47) continue; // '/'
    const b = BAND.exec(script.slice(debuts[l], fin).replace(/\n$/, ''));
    if (!b) continue;
    if (sections.length) sections[sections.length - 1].fin = l;
    sections.push({ fichier: b[1].startsWith('PostPro/') ? b[1] : 'src/' + b[1], debut: l + 1, fin: debuts.length });
  }
  return { script, tete, debuts, pos, com, sections };
}

// ── Lignes exécutées AU CHARGEMENT (hors de toute fonction) dans le script actuel ──
// Analyse du texte par acorn (déjà présent : dépendance d'ESLint). Une ligne modifiée de ce genre
// tourne pour toutes les suites → tout relancer. null si acorn manque (le tri sera alors prudent).
// Rend { ch, fdeb } : ch[l] = 1 si la ligne l du script tourne au chargement ; fdeb[l] = ligne où
// commence la fonction la plus extérieure qui contient l (-1 hors fonction).
function lignesChargement(D) {
  let acorn, ast;
  try { acorn = require('acorn'); } catch (e) { return null; }
  try { ast = acorn.parse(D.script, { ecmaVersion: 'latest', sourceType: 'script' }); } catch (e) { return null; }
  const F = []; // fonctions les plus extérieures [début, fin)
  const voir = n => {
    if (!n || typeof n.type !== 'string') return;
    if (/Function/.test(n.type)) { F.push([n.start, n.end]); return; }
    for (const k in n) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(voir); else if (v && typeof v === 'object') voir(v);
    }
  };
  voir(ast);
  F.sort((a, b) => a[0] - b[0]);
  const ch = new Uint8Array(D.pos.length), fdeb = new Int32Array(D.pos.length).fill(-1);
  const ligneDe = p => { let lo = 0, hi = D.debuts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (D.debuts[m] <= p) lo = m; else hi = m - 1; } return lo; };
  let i = 0;
  for (let l = 0; l < D.pos.length; l++) {
    const p = D.pos[l];
    if (p < 0) continue;
    while (i < F.length && F[i][1] <= p) i++;
    if (i < F.length && F[i][0] <= p) fdeb[l] = ligneDe(F[i][0]);
    else if (!D.com[l]) ch[l] = 1;
  }
  return { ch, fdeb };
}

// ── Lignes exécutées d’après un dossier de relevés (format de NODE_V8_COVERAGE) ──
// Chaque ligne prend le compte du plus petit morceau qui contient son premier caractère.
function couverture(dossier, D) {
  const nl = D.pos.length;
  const val = new Uint8Array(nl); // 0 : rien, 1 : non exécutée, 2 : exécutée
  let vu = false;
  let fichiers = [];
  try { fichiers = fs.readdirSync(dossier).filter(f => f.endsWith('.json')); } catch (e) { /* aucun fichier : processus coupé */ }
  for (const f of fichiers) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8')); } catch (e) { continue; }
    for (const s of j.result || []) {
      if (s.url !== 'ConceptCAD.html') continue;
      vu = true;
      const R = [];
      for (const fn of s.functions) for (const r of fn.ranges) R.push(r);
      const racine = R.reduce((m, r) => (r.startOffset === 0 && (!m || r.endOffset > m.endOffset) ? r : m), null);
      R.sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
      const loc = new Uint8Array(nl);
      for (const r of R) {
        let lo = 0, hi = nl; // première ligne dont la position >= startOffset
        while (lo < hi) { const mid = (lo + hi) >> 1; if (D.debuts[mid] < r.startOffset) lo = mid + 1; else hi = mid; }
        if (lo > 0 && D.pos[lo - 1] >= r.startOffset) lo--;
        const v = r.count > 0 ? 2 : 1;
        for (let l = lo; l < nl && D.debuts[l] < r.endOffset; l++) {
          const p = D.pos[l];
          if (p >= r.startOffset && p < r.endOffset && !(r === racine && D.com[l])) loc[l] = v;
        }
      }
      for (let l = 0; l < nl; l++) if (loc[l] === 2) val[l] = 2; else if (loc[l] && !val[l]) val[l] = 1;
    }
  }
  if (!vu) return null;
  const out = {};
  for (const s of D.sections) {
    const l = [];
    for (let i = s.debut; i < s.fin; i++) if (val[i] === 2) l.push(i - s.debut + 1);
    if (l.length) out[s.fichier] = enPlages(l);
  }
  return out;
}

// [1,2,3,7,9,10] → "1-3,7,9-10" et retour
function enPlages(l) {
  const o = [];
  for (let i = 0; i < l.length;) {
    let j = i;
    while (j + 1 < l.length && l[j + 1] === l[j] + 1) j++;
    o.push(i === j ? String(l[i]) : l[i] + '-' + l[j]);
    i = j + 1;
  }
  return o.join(',');
}
function dePlages(s) {
  const o = [];
  if (s) for (const p of s.split(',')) { const [a, b] = p.split('-').map(Number); o.push([a, isFinite(b) ? b : a]); }
  return o;
}
// une plage [a,b] touche-t-elle des lignes exécutées ?
function touche(plages, a, b) {
  let lo = 0, hi = plages.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (plages[m][1] < a) lo = m + 1; else hi = m; }
  return lo < plages.length && plages[lo][0] <= b;
}

// Empreintes Git des fichiers sources (écrites dans la base d'objets : git diff peut ensuite les
// comparer). Vérifie que ConceptCAD.html est à jour : sinon les lignes ne correspondraient pas.
function empreintes(D) {
  const fichiers = D.sections.map(s => s.fichier);
  const sortie = git(['hash-object', '-w', '--stdin-paths'], fichiers.map(f => path.join(ROOT, f)).join('\n') + '\n');
  const h = sortie.trim().split(/\r?\n/);
  const o = {};
  fichiers.forEach((f, i) => { o[f] = h[i]; });
  return o;
}
function livrablePerime(D) {
  const lignes = D.script.split('\n');
  for (const s of D.sections) {
    let src;
    try { src = fs.readFileSync(path.join(ROOT, s.fichier), 'utf8'); } catch (e) { return s.fichier + ' absent'; }
    const a = src.replace(/\s+$/, '').replace(/\r\n/g, '\n');
    // le corps d'une section s'arrête avant la ligne vide qui précède le bandeau suivant
    const b = lignes.slice(s.debut, s.fin).join('\n').replace(/\r/g, '').replace(/\s+$/, '');
    if (a !== b) return s.fichier;
  }
  return null;
}
function etatLivrable() {
  const D = decouper(fs.readFileSync(HTML, 'utf8'));
  return { D, perime: livrablePerime(D) };
}

// Empreinte de la liste ordonnée des fichiers source : un fichier ajouté, retiré ou déplacé
// change ce que chaque suite charge au démarrage → tout relancer.
const listeFichiers = D => crypto.createHash('sha1').update(D.sections.map(s => s.fichier).join('\n')).digest('hex').slice(0, 16);
// Commit courant (pour les fichiers hors src/ : comparés à ce commit au prochain tri)
const tete = () => git(['rev-parse', 'HEAD']).trim();
// Dossier temporaire de couverture d'une suite (vidé après lecture)
function dossierCouverture(e) {
  const d = path.join(os.tmpdir(), 'conceptcad-couv', process.pid + '-' + e.replace(/[^\w]/g, '_'));
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Fusion des morceaux d'une suite (« suite:partie ») : union des lignes de chaque fichier
function fusionner(a, b) {
  if (!a) return b;
  if (!b) return a;
  const o = Object.assign({}, a);
  for (const f in b) {
    if (!o[f]) { o[f] = b[f]; continue; }
    const set = new Set();
    for (const s of [o[f], b[f]]) for (const [x, y] of dePlages(s)) for (let i = x; i <= y; i++) set.add(i);
    o[f] = enPlages([...set].sort((p, q) => p - q));
  }
  return o;
}

module.exports = { lignesSansCode, lignesChargement, estCommentaire, ROOT, git, lireCarte, ecrireCarte, decouper, couverture, enPlages, dePlages, touche, empreintes, etatLivrable, tete, listeFichiers, dossierCouverture, fusionner, fichierCarte };
