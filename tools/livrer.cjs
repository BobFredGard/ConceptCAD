// « livre » : publie en une fois tout ce que les cpt ont rangé dans main depuis la livraison précédente
// (demande de Fred du 24/11/2026 ; avant, chaque cpt publiait tout, 40 min à 1 h, 8 fois par jour).
//   node tools/livrer.cjs                     dans le dépôt principal D:\ConceptCAD (branche main)
//   node tools/livrer.cjs --essai             contrôles et aperçu des notes : rien n'est changé
//   node tools/livrer.cjs --depuis <étape>    reprise après un échec corrigé (les contrôles sont refaits)
//   --notes <fichier> --titre "<titre>"       notes et titre de la release (sinon : titres du CHANGELOG)
// Étapes, dans l'ordre (les attentes se recouvrent : le Mac se fabrique chez GitHub pendant Windows) :
//   controle    branche main, rien hors commit, main distant contenu dans le local, outils présents
//   tests       npm run ci:full (rouge = rien n'est publié)
//   git         push de main, tag annoté de la version, push du tag seul (il déclenche le site)
//   mac-lancer  main fusionné dans la branche de l'application, poussé, fabrication du DMG lancée
//   windows     node tauri/construire-windows.cjs (installateur signé + latest.json)
//   site        passage Pages du tag ; en échec (fréquent, erreur GitHub) : secours --ref main, 3 fois
//   autonome    ConceptCAD-autonome.html refait, copié sur S:\Dropbox\ConceptCAD (même lien public)
//   mac         attente du DMG, node tauri/mac/publier-maj.cjs
//   release     release GitHub V0.x.y avec les 5 fichiers de publication
//   verif       latest.json en ligne = cette version, installateurs téléchargeables
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const O = require('./livraison-outils.cjs');
const { git, lancer, arret } = O;

const ETAPES = ['controle', 'tests', 'git', 'mac-lancer', 'windows', 'site', 'autonome', 'mac', 'release', 'verif'];
const DEPOT = 'BobFredGard/ConceptCAD';
const SITE = 'https://bobfredgard.github.io/ConceptCAD/';
const DROPBOX = 'S:/Dropbox/ConceptCAD/ConceptCAD-autonome.html';
const CLE = path.join(os.homedir(), '.tauri', 'conceptcad-maj.key');
const FICHIERS = ['ConceptCAD-Windows-setup.exe', 'ConceptCAD-Mac.dmg', 'ConceptCAD-Mac-maj.tar.gz', 'ConceptCAD-Mac-maj.tar.gz.sig', 'latest.json'];

const argv = process.argv.slice(2);
const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const ESSAI = argv.includes('--essai'), DEPUIS = opt('--depuis') || 'controle';
if (!ETAPES.includes(DEPUIS)) { console.error('étape inconnue : ' + DEPUIS + ' (' + ETAPES.join(', ') + ')'); process.exit(2); }

const pause = ms => new Promise(r => setTimeout(r, ms));
const gh = (args, o) => lancer('gh', args, { cwd: ctx.racine, ...o });
const ghJson = args => JSON.parse(gh(args) || 'null');
const ctx = {};

// Passage GitHub Actions : attendre qu'il apparaisse, puis qu'il finisse (annulé au-delà du délai).
async function trouverRun(workflow, filtre, apparition) {
  const fin = Date.now() + apparition;
  for (;;) {
    const r = ghJson(['run', 'list', '--workflow', workflow, '-L', '15', '--json', 'databaseId,headSha,event,status,conclusion,createdAt']).find(filtre);
    if (r || Date.now() > fin) return r || null;
    await pause(10000);
  }
}
async function finRun(id, delai) {
  const fin = Date.now() + delai;
  for (;;) {
    const r = ghJson(['run', 'view', String(id), '--json', 'status,conclusion']);
    if (r.status === 'completed') return r.conclusion;
    if (Date.now() > fin) { gh(['run', 'cancel', String(id)], { ok: true }); return 'délai dépassé'; }
    await pause(20000);
  }
}
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const FAIRE = {
  async controle() {
    const R = ctx.racine = git(['rev-parse', '--show-toplevel'], process.cwd());
    if (git(['rev-parse', '--abbrev-ref', 'HEAD'], R) !== 'main') arret('à lancer dans le dépôt principal (D:\\ConceptCAD), branche main');
    const V = ctx.V = O.versionPaquet(R);
    if (O.appVerFichier(path.join(R, 'ConceptCAD.html')) !== V) arret('ConceptCAD.html n\'est pas en ' + V);
    const sale = git(['status', '--porcelain', '--untracked-files=no'], R);
    if (sale) arret('fichiers modifiés hors commit dans ' + R + ' (essai d\'une session ? Exemples de Fred à commiter ?) :\n' + sale);
    const nouveaux = git(['status', '--porcelain', '--', 'Exemples'], R);
    if (nouveaux) arret('Exemples nouveaux à commiter d\'abord (commit séparé, après node tests/test_exemples_sains.cjs Exemples) :\n' + nouveaux);
    git(['fetch', '-q', 'origin'], R);
    if (git(['merge-base', '--is-ancestor', 'origin/main', 'main'], R, { ok: true }) === null)
      arret('main sur GitHub contient des commits absents du main local (modifié sur GitHub ?) : les fusionner d\'abord');
    ctx.dejaPublie = !!git(['ls-remote', '--tags', 'origin', 'refs/tags/' + V], R);
    if (ctx.dejaPublie && DEPUIS === 'controle') arret(V + ' est déjà livrée (tag sur GitHub). Reprise : --depuis <étape>');
    ctx.avant = git(['for-each-ref', '--merged', 'main', '--sort=-creatordate', '--format=%(refname:short)', 'refs/tags/V*'], R)
      .split(/\r?\n/).filter(t => t && t !== V)[0] || null;
    ctx.entrees = O.entreesChangelog(fs.readFileSync(path.join(R, 'CHANGELOG.md'), 'utf8'), ctx.avant, V);
    if (!ctx.entrees.length) arret('aucune entrée du CHANGELOG entre ' + ctx.avant + ' et ' + V);
    const n = O.notesRelease(ctx.entrees, V);
    ctx.titre = opt('--titre') || n.titre;
    ctx.notes = opt('--notes') ? O.avecPied(fs.readFileSync(opt('--notes'), 'utf8')) : n.notes;
    // Application Windows / Mac : worktree de sa branche, clé de signature, outils.
    const W = O.worktrees(R).find(w => w.branch === O.BRANCHE_APPLI);
    if (!W) arret('worktree de la branche ' + O.BRANCHE_APPLI + ' (application Windows / Mac) introuvable');
    ctx.appli = W.path;
    if (git(['rev-parse', '-q', '--verify', 'MERGE_HEAD'], W.path, { ok: true })) arret('fusion en cours dans ' + W.path);
    if (!fs.existsSync(CLE)) arret('clé de signature des mises à jour absente : ' + CLE);
    lancer('cargo', ['--version']);
    gh(['auth', 'status']);
    console.log('Livraison de ' + V + ' (précédente : ' + (ctx.avant || '—') + ') : ' + ctx.entrees.map(e => e.v).join(', '));
    console.log('Release « ' + ctx.titre + ' »\n' + ctx.notes.replace(/^/gm, '  | '));
    console.log('Application : ' + W.path);
  },

  async tests() { lancer('npm', ['run', 'ci:full'], { cwd: ctx.racine, inherit: true }); },

  async git() {
    const R = ctx.racine, V = ctx.V;
    git(['push', '-q', 'origin', 'main'], R);
    if (!git(['rev-parse', '-q', '--verify', 'refs/tags/' + V], R, { ok: true })) git(['tag', '-a', V, '-m', ctx.titre], R);
    if (git(['rev-parse', V + '^{commit}'], R) !== git(['rev-parse', 'main'], R)) arret('le tag ' + V + ' ne désigne pas la tête de main');
    if (!git(['ls-remote', '--tags', 'origin', 'refs/tags/' + V], R)) git(['push', '-q', 'origin', 'refs/tags/' + V], R);
    console.log('✓ main et ' + V + ' poussés');
  },

  async 'mac-lancer'() {
    const W = ctx.appli, V = ctx.V;
    if (git(['merge-base', '--is-ancestor', 'main', 'HEAD'], W, { ok: true }) === null
      && git(['merge', '--no-edit', '-m', 'Merge ' + V, 'main'], W, { ok: true }) === null) {
      git(['merge', '--abort'], W, { ok: true });
      arret('fusion de main dans la branche de l\'application refusée (conflit ou fichiers modifiés dans ' + W + ')');
    }
    if (O.versionPaquet(W) !== V) arret('la branche de l\'application n\'est pas en ' + V);
    git(['push', '-q', 'origin', O.BRANCHE_APPLI], W);
    const sha = git(['rev-parse', 'HEAD'], W);
    await pause(15000); // un push qui touche tauri/** lance déjà le passage
    if (!await trouverRun('application-mac.yml', r => r.headSha === sha, 0)) {
      gh(['workflow', 'run', 'application-mac.yml', '--ref', O.BRANCHE_APPLI]);
      console.log('✓ fabrication du DMG lancée chez GitHub');
    } else console.log('✓ fabrication du DMG déjà lancée par le push');
  },

  async windows() { lancer('node', ['tauri/construire-windows.cjs'], { cwd: ctx.appli, inherit: true }); },

  async site() {
    const sha = git(['rev-parse', 'main'], ctx.racine);
    let run = await trouverRun('pages.yml', r => r.headSha === sha && r.event === 'push', 3 * 60000);
    let fin = run ? await finRun(run.databaseId, 12 * 60000) : 'pas de passage';
    for (let essai = 1; fin !== 'success' && essai <= 3; essai++) {
      console.log('Site : ' + fin + ' — secours ' + essai + '/3 (gh workflow run pages.yml --ref main)');
      const vus = new Set(ghJson(['run', 'list', '--workflow', 'pages.yml', '-L', '15', '--json', 'databaseId']).map(r => r.databaseId));
      gh(['workflow', 'run', 'pages.yml', '--ref', 'main']);
      run = await trouverRun('pages.yml', r => !vus.has(r.databaseId), 2 * 60000);
      fin = run ? await finRun(run.databaseId, 12 * 60000) : 'pas de passage';
    }
    if (fin !== 'success') arret('site non publié après 3 secours');
    for (let i = 0; i < 12; i++) { // le site garde l'ancienne page en cache quelques minutes
      const en = O.appVer(await (await fetch(SITE + '?v=' + Date.now())).text());
      if (en === ctx.V) { console.log('✓ site en ligne en ' + en + ' : ' + SITE); return; }
      await pause(20000);
    }
    console.log('⚠ site publié, mais la page en ligne annonce encore l\'ancienne version (cache) : relire ' + SITE + ' plus tard');
  },

  async autonome() {
    lancer('node', ['tools/autonome.cjs'], { cwd: ctx.racine, inherit: true });
    const f = path.join(ctx.racine, 'ConceptCAD-autonome.html');
    if (O.appVerFichier(f) !== ctx.V) arret('ConceptCAD-autonome.html n\'est pas en ' + ctx.V);
    if (!fs.existsSync(path.dirname(DROPBOX))) { console.log('⚠ ' + path.dirname(DROPBOX) + ' absent : copie Dropbox à faire à la main'); return; }
    fs.copyFileSync(f, DROPBOX);
    if (sha256(f) !== sha256(DROPBOX)) arret('copie Dropbox différente de l\'original : ' + DROPBOX);
    console.log('✓ fichier autonome ' + ctx.V + ' copié sur ' + DROPBOX);
  },

  async mac() {
    const sha = git(['rev-parse', 'HEAD'], ctx.appli);
    const run = await trouverRun('application-mac.yml', r => r.headSha === sha, 3 * 60000);
    if (!run) arret('aucun passage « Application Mac » pour ' + sha.slice(0, 9) + ' : relancer --depuis mac-lancer');
    const fin = run.conclusion === 'success' ? 'success' : await finRun(run.databaseId, 45 * 60000);
    if (fin !== 'success') arret('DMG : passage ' + run.databaseId + ' en « ' + fin + ' » — gh run rerun ' + run.databaseId + ', puis --depuis mac');
    lancer('node', ['tauri/mac/publier-maj.cjs'], { cwd: ctx.appli, inherit: true });
  },

  async release() {
    const dir = path.join(ctx.appli, 'tauri', 'src-tauri', 'target', 'release', 'bundle', 'publication');
    const manque = FICHIERS.filter(n => !fs.existsSync(path.join(dir, n)));
    if (manque.length) arret('fichiers de publication absents de ' + dir + ' : ' + manque.join(', '));
    const a = JSON.parse(fs.readFileSync(path.join(dir, 'latest.json'), 'utf8'));
    if ('V' + a.version !== ctx.V) arret('latest.json annonce ' + a.version + ', et non ' + ctx.V);
    const p = ['windows-x86_64', 'darwin-aarch64', 'darwin-x86_64'].filter(k => !(a.platforms || {})[k]);
    if (p.length) arret('latest.json sans ' + p.join(', '));
    const notes = path.join(os.tmpdir(), 'conceptcad-notes-' + ctx.V + '.md');
    fs.writeFileSync(notes, ctx.notes);
    const fichiers = FICHIERS.map(n => path.join(dir, n));
    if (gh(['release', 'view', ctx.V, '--json', 'tagName'], { ok: true }) !== null) {
      gh(['release', 'upload', ctx.V, ...fichiers, '--clobber']);
      gh(['release', 'edit', ctx.V, '--title', ctx.titre, '--notes-file', notes]);
    } else gh(['release', 'create', ctx.V, ...fichiers, '--verify-tag', '--title', ctx.titre, '--notes-file', notes]);
    console.log('✓ release ' + ctx.V + ' : https://github.com/' + DEPOT + '/releases/tag/' + ctx.V);
  },

  async verif() {
    for (let i = 0; ; i++) {
      let v = null;
      try { v = (await (await fetch('https://github.com/' + DEPOT + '/releases/latest/download/latest.json?v=' + Date.now())).json()).version; } catch { /* réessayer */ }
      if ('V' + v === ctx.V) break;
      if (i >= 8) arret('latest.json en ligne annonce ' + v + ', et non ' + ctx.V + ' : les applications installées ne verront pas la mise à jour');
      await pause(15000);
    }
    for (const n of ['ConceptCAD-Windows-setup.exe', 'ConceptCAD-Mac.dmg']) {
      // premier octet seulement (une requête HEAD peut être refusée par le stockage des fichiers)
      const r = await fetch('https://github.com/' + DEPOT + '/releases/download/' + ctx.V + '/' + n, { headers: { Range: 'bytes=0-0' } });
      await r.body?.cancel();
      if (!r.ok) arret(n + ' : téléchargement public impossible (' + r.status + ')');
    }
    console.log('✓ mises à jour en ligne : les applications installées passeront en ' + ctx.V);
  },
};

(async () => {
  const debut = Date.now(), temps = [];
  let verrou = null;
  try {
    await FAIRE.controle();
    if (ESSAI) { console.log('\n(essai : rien n\'a été changé)'); return; }
    // Une seule livraison à la fois, toutes sessions confondues (dossier Git commun).
    verrou = path.resolve(ctx.racine, git(['rev-parse', '--git-common-dir'], ctx.racine), 'conceptcad-livraison.lock');
    if (fs.existsSync(verrou) && Date.now() - fs.statSync(verrou).mtimeMs < 3 * 3600000) { const v = verrou; verrou = null; arret('livraison déjà en cours : ' + fs.readFileSync(v, 'utf8') + ' (' + v + ')'); }
    fs.writeFileSync(verrou, ctx.V + ', processus ' + process.pid + ', ' + new Date().toLocaleString('fr-FR'));
    for (const e of ETAPES.slice(Math.max(1, ETAPES.indexOf(DEPUIS)))) {
      const t = Date.now();
      console.log('\n=== ' + e + ' ===');
      await FAIRE[e]();
      temps.push(e + ' ' + O.duree(Date.now() - t));
    }
    console.log('\n✓ ' + ctx.V + ' livrée en ' + O.duree(Date.now() - debut) + ' (' + temps.join(', ') + ')');
  } catch (e) {
    if (!(e instanceof O.Arret)) throw e;
    console.error('\n✗ livraison arrêtée : ' + e.message + (temps.length ? '\n  étapes faites : ' + temps.join(', ') : ''));
    process.exitCode = 1;
  } finally { if (verrou) fs.rmSync(verrou, { force: true }); }
})();
