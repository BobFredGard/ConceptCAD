// Outils communs à tools/cpt.cjs (« cpt » : version rangée dans le dépôt local) et tools/livrer.cjs
// (« livre » : publication). Demande de Fred du 24/11/2026 : un cpt ne publie plus rien, la livraison
// publie en une fois tout ce qui s'est accumulé depuis la précédente.
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');

// Identité des commits et des tags (aucune n'est configurée sur la machine).
const ID = ['-c', 'user.name=BobFredGard', '-c', 'user.email=BobFredGard@users.noreply.github.com'];
// Branche de l'application Windows / Mac (Tauri) et branche de sauvegarde des cpt.
const BRANCHE_APPLI = 'claude/vigorous-swanson-45df96';
const SAUVEGARDE = 'sauvegarde';

class Arret extends Error {}
const arret = m => { throw new Arret(m); };

// Commande sans shell (git, gh, node) ; texte de sortie, ou exception lisible si ok:false n'est pas demandé.
function lancer(c, args, { cwd, inherit, env, ok } = {}) {
  const r = spawnSync(c, args, { cwd, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe', maxBuffer: 1 << 26,
    env: env ? { ...process.env, ...env } : process.env, shell: c === 'npm' });
  if (r.error) { if (ok) return null; arret(c + ' introuvable : ' + r.error.message); }
  if (r.status !== 0) {
    if (ok) return null;
    arret(c + ' ' + args.join(' ') + ' : échec' + (inherit ? '' : '\n' + ((r.stderr || '') + (r.stdout || '')).trim()));
  }
  return inherit ? '' : (r.stdout || '').trim();
}
const git = (args, cwd, o) => lancer('git', ID.concat(args), { cwd, ...o });

// V0.99.9 < V0.99.10 : comparaison chiffre par chiffre.
const num = v => String(v).replace(/^V/, '').split('.').map(Number);
function cmpVersions(a, b) {
  const x = num(a), y = num(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}

// Entrées du CHANGELOG « ## V0.x.y - titre » situées après `apres` (exclu) et jusqu'à `jusqua` (inclus).
function entreesChangelog(texte, apres, jusqua) {
  const l = [];
  for (const m of texte.matchAll(/^## (V\d+\.\d+\.\d+)\s*[-—]\s*(.+?)\s*$/gm))
    if ((!apres || cmpVersions(m[1], apres) > 0) && cmpVersions(m[1], jusqua) <= 0) l.push({ v: m[1], titre: m[2] });
  return l.sort((a, b) => cmpVersions(a.v, b.v));
}
const court = (t, n = 140) => t.length <= n ? t : t.slice(0, n - 1).replace(/[\s,;:—-]+\S*$/, '') + '…';
// Titre et notes de la release : une seule version → son titre ; plusieurs → une ligne par version.
// Notes de Fred (15/11/2026) : seulement ce qui change, puis le bloc fixe des installateurs.
const PIED = 'Windows : ConceptCAD-Windows-setup.exe · Mac : ConceptCAD-Mac.dmg — les applications installées proposent la mise à jour d\'elles-mêmes.';
const avecPied = notes => notes.includes('ConceptCAD-Windows-setup.exe') ? notes : notes.trim() + '\n\n' + PIED;
function notesRelease(entrees, version) {
  if (!entrees.length) return { titre: version, notes: '' };
  if (entrees.length === 1) return { titre: version + ' — ' + court(entrees[0].titre, 90), notes: avecPied('**Nouveau :** ' + entrees[0].titre) };
  return { titre: version + ' — ' + entrees.length + ' nouveautés',
    notes: avecPied('**Nouveau :**\n' + entrees.map(e => '- ' + court(e.titre) + ' (' + e.v + ')').join('\n')) };
}

// git worktree list --porcelain → [{ path, head, branch }]
function worktrees(cwd) {
  return lancer('git', ['worktree', 'list', '--porcelain'], { cwd }).split(/\r?\n\r?\n/).map(b => {
    const o = {};
    for (const l of b.split(/\r?\n/)) {
      if (l.startsWith('worktree ')) o.path = path.resolve(l.slice(9));
      else if (l.startsWith('HEAD ')) o.head = l.slice(5);
      else if (l.startsWith('branch ')) o.branch = l.slice(7).replace(/^refs\/heads\//, '');
    }
    return o;
  }).filter(o => o.path);
}

const appVer = texte => (/APP_VER='(V[\d.]+)'/.exec(texte) || [])[1] || null;
// Lit APP_VER sans charger tout le fichier (le fichier autonome pèse 23 Mo, APP_VER est au début).
function appVerFichier(f) {
  const fd = fs.openSync(f, 'r'), b = Buffer.alloc(4 << 20);
  try { return appVer(b.toString('utf8', 0, fs.readSync(fd, b, 0, b.length, 0))) || appVer(fs.readFileSync(f, 'utf8')); }
  finally { fs.closeSync(fd); }
}
const versionPaquet = dir => 'V' + JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
const duree = ms => ms < 60000 ? Math.round(ms / 1000) + ' s' : Math.round(ms / 60000) + ' min';

module.exports = { ID, BRANCHE_APPLI, SAUVEGARDE, Arret, arret, lancer, git, cmpVersions, entreesChangelog, court,
  notesRelease, avecPied, worktrees, appVer, appVerFichier, versionPaquet, duree };
