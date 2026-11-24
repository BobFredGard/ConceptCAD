// V0.99.75 : « cpt » local et « livre » séparés (demande de Fred du 24/11/2026). Contrôle de
// tools/livraison-outils.cjs (versions, CHANGELOG, notes de release) et de tools/cpt.cjs sur un dépôt
// JETABLE (dépôt « GitHub » nu, dépôt principal sur main, worktree de session) : la version est rangée
// dans main local sans tag ni push de main, la copie « sauvegarde » suit, l'essai ConceptCAD.html
// identique est retiré, un essai différent, un numéro déjà pris ou main avancé arrêtent tout.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const O = require('../tools/livraison-outils.cjs');
let ko = 0;
const A = (c, m) => { if (!c) { ko++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

console.log('=== Versions, CHANGELOG, notes ===');
A(O.cmpVersions('V0.99.9', 'V0.99.10') < 0 && O.cmpVersions('V0.99.100', 'V0.99.99') > 0 && O.cmpVersions('V0.99.7', '0.99.7') === 0, 'V0.99.9 < V0.99.10 < V0.99.100');
const CL = '# Journal\n\n## V0.99.9 - Neuf\n\ntexte\n\n## V0.99.10 - Dix\n\n## V0.99.11 — Onze (demande de Fred : « oui »)\n\n## V0.99.12 - Douze\n';
const e = O.entreesChangelog(CL, 'V0.99.9', 'V0.99.11');
A(e.map(x => x.v).join() === 'V0.99.10,V0.99.11', 'entrées après la précédente livraison, jusqu\'à la version livrée : ' + e.map(x => x.v));
A(O.entreesChangelog(CL, null, 'V0.99.9').length === 1, 'sans livraison précédente : tout jusqu\'à la version');
const n1 = O.notesRelease(e.slice(0, 1), 'V0.99.10'), n2 = O.notesRelease(e, 'V0.99.11');
A(n1.titre === 'V0.99.10 — Dix' && n1.notes.startsWith('**Nouveau :** Dix\n\nWindows : ConceptCAD-Windows-setup.exe'), 'une version : son titre, puis le bloc des installateurs');
A(n2.titre === 'V0.99.11 — 2 nouveautés' && n2.notes.split('\n- ').length === 3 && n2.notes.includes('(V0.99.10)'), 'plusieurs versions : une ligne chacune');
A(O.avecPied(n1.notes) === n1.notes && O.avecPied('Texte simple').endsWith('d\'elles-mêmes.'), 'bloc des installateurs ajouté une seule fois (notes écrites à la main comprises)');
A(O.court('a '.repeat(100), 20).length <= 20 && O.court('court') === 'court', 'titres longs raccourcis');
A(O.appVer("const APP_VER='V0.99.11';") === 'V0.99.11', 'APP_VER lu');

console.log('=== tools/cpt.cjs sur un dépôt jetable ===');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-livraison-'));
const g = (cwd, ...a) => { const r = spawnSync('git', O.ID.concat(a), { cwd, encoding: 'utf8' }); if (r.status) throw new Error('git ' + a.join(' ') + ' : ' + r.stderr); return r.stdout.trim(); };
const ecrire = (dir, v, extra) => {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'essai', version: v.slice(1) }) + '\n');
  fs.writeFileSync(path.join(dir, 'ConceptCAD.html'), "<script>const APP_VER='" + v + "';" + (extra || '') + '</script>\n');
  fs.appendFileSync(path.join(dir, 'CHANGELOG.md'), '\n## ' + v + ' - Essai ' + v + '\n');
};
const cpt = cwd => spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'cpt.cjs')], { cwd, encoding: 'utf8' });
try {
  const NU = path.join(T, 'github.git'), M = path.join(T, 'principal'), W = path.join(T, 'session');
  g(T, 'init', '-q', '--bare', '-b', 'main', NU);
  g(T, 'init', '-q', '-b', 'main', M);
  g(M, 'config', 'core.autocrlf', 'false');
  fs.writeFileSync(path.join(M, 'CHANGELOG.md'), '# Journal\n');
  ecrire(M, 'V0.99.72');
  g(M, 'add', '-A'); g(M, 'commit', '-q', '-m', 'V0.99.72'); g(M, 'tag', '-a', 'V0.99.72', '-m', 'V0.99.72');
  g(M, 'remote', 'add', 'origin', NU); g(M, 'push', '-q', 'origin', 'main', 'refs/tags/V0.99.72');
  g(M, 'worktree', 'add', '-q', '-b', 'session', W);

  // numéro déjà pris
  let r = cpt(W);
  A(r.status === 1 && /déjà pris/.test(r.stderr), 'numéro de main repris : arrêt (' + r.stderr.trim().split('\n')[0] + ')');
  // modification oubliée hors commit
  ecrire(W, 'V0.99.73');
  r = cpt(W);
  A(r.status === 1 && /non commitées/.test(r.stderr), 'modifications hors commit : arrêt');
  g(W, 'commit', '-q', '-am', 'V0.99.73 — essai');
  // essai différent posé pour Fred par une autre session
  fs.writeFileSync(path.join(M, 'ConceptCAD.html'), "<script>const APP_VER='V0.99.80';</script>\n");
  r = cpt(W);
  A(r.status === 1 && /autre session/.test(r.stderr) && g(M, 'rev-parse', 'main') === g(M, 'rev-parse', 'V0.99.72^{commit}'), 'essai d\'une autre session dans le dépôt principal : arrêt, main intact');
  // essai identique à la version rangée : retiré puis avance
  fs.copyFileSync(path.join(W, 'ConceptCAD.html'), path.join(M, 'ConceptCAD.html'));
  r = cpt(W);
  A(r.status === 0, 'cpt V0.99.73 : ' + (r.stdout + r.stderr).trim().split('\n').join(' | '));
  A(g(M, 'rev-parse', 'main') === g(W, 'rev-parse', 'HEAD') && !g(M, 'status', '--porcelain'), 'main local = la version rangée, dépôt principal propre');
  A(O.appVerFichier(path.join(M, 'ConceptCAD.html')) === 'V0.99.73', 'ConceptCAD.html du dépôt principal en V0.99.73');
  A(g(NU, 'rev-parse', 'main') === g(M, 'rev-parse', 'V0.99.72^{commit}'), 'main de GitHub inchangé (rien de publié)');
  A(g(NU, 'rev-parse', 'sauvegarde') === g(M, 'rev-parse', 'main'), 'copie de sauvegarde sur GitHub = main local');
  A(g(NU, 'tag') === 'V0.99.72' && g(M, 'tag') === 'V0.99.72', 'aucun tag créé');
  A(/En attente de « livre » depuis V0\.99\.72 : V0\.99\.73/.test(r.stdout), 'versions en attente de « livre » annoncées');
  // une autre session range V0.99.74 avant celle-ci : rebase demandé
  const W2 = path.join(T, 'session2');
  g(M, 'worktree', 'add', '-q', '-b', 'session2', W2, 'V0.99.72');
  ecrire(W2, 'V0.99.74'); g(W2, 'commit', '-q', '-am', 'V0.99.74');
  r = cpt(W2);
  A(r.status === 1 && /rebase main/.test(r.stderr), 'main a avancé : rebase demandé');
} catch (err) { ko++; console.log('  ✗ ' + err.message); }
finally { fs.rmSync(T, { recursive: true, force: true }); }

console.log(ko ? 'ÉCHEC : ' + ko : '*** TOUT PASSE ***');
process.exit(ko ? 1 : 0);
