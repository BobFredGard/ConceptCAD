// « cpt » : range la version du worktree dans le dépôt local D:\ConceptCAD (branche main), sans rien
// publier (demande de Fred du 24/11/2026 : « commiter en local, ne pousser que ce qui est vraiment
// fonctionnel »). La publication (site, applications, fichier autonome) attend « livre » : tools/livrer.cjs.
//   node tools/cpt.cjs                    depuis le worktree, après `npm run ci` vert et le commit de version
//   node tools/cpt.cjs --sans-sauvegarde  sans copie de main sur la branche « sauvegarde » de GitHub
// Contrôles : rien d'oublié hors commit, main local déjà contenu dans la branche (sinon `git rebase main`),
// numéro de version libre, aucune livraison en cours (V1.1.8). Dans le dépôt principal : l'essai ConceptCAD.html posé pour Fred est retiré
// s'il est identique à la version rangée (sinon arrêt : essai d'une autre session), puis avance rapide
// de main. La branche « sauvegarde » de GitHub suit main : rien n'est publié (le site et les applications
// ne suivent que les tags), mais le travail ne vit plus seulement sur le disque du PC.
'use strict';
const fs = require('fs'), path = require('path');
const O = require('./livraison-outils.cjs');
const { git, arret } = O;

function cpt() {
  const ICI = git(['rev-parse', '--show-toplevel'], process.cwd());
  const branche = git(['rev-parse', '--abbrev-ref', 'HEAD'], ICI);
  if (branche === 'main') arret('à lancer depuis le worktree de la session, pas depuis main');
  const oublis = git(['status', '--porcelain', '--untracked-files=no'], ICI);
  if (oublis) arret('modifications non commitées :\n' + oublis);
  const V = O.versionPaquet(ICI);
  const html = path.join(ICI, 'ConceptCAD.html');
  if (O.appVerFichier(html) !== V) arret('ConceptCAD.html annonce ' + O.appVerFichier(html) + ' au lieu de ' + V + ' : node build.js puis commit');
  git(['log', '-1', '--format=%s'], ICI).startsWith(V) || console.log('(le dernier commit ne commence pas par ' + V + ')');

  const M = O.worktrees(ICI).find(w => w.branch === 'main');
  if (!M) arret('dépôt principal (branche main) introuvable');
  if (git(['merge-base', '--is-ancestor', 'main', 'HEAD'], ICI, { ok: true }) === null)
    arret('main a avancé depuis le début de ce travail : `git rebase main`, numéro de version suivant le sien, node build.js, npm run ci, puis relancer');
  const Vmain = 'V' + JSON.parse(git(['show', 'main:package.json'], ICI)).version;
  if (O.cmpVersions(V, Vmain) <= 0) arret(V + ' est déjà pris (main est en ' + Vmain + ') : prendre le numéro suivant');
  const sha = git(['rev-parse', 'HEAD'], ICI);
  // V1.1.8 : pas pendant une livraison — ses tests tournent dans le dépôt principal, que l'avance de main changerait
  // (27/11 : un cpt de V1.1.6 pendant les tests de la livraison de V1.1.5 → tag V1.1.5 posé sur le code V1.1.6)
  const enCours = O.livraisonEnCours(M.path);
  if (enCours) arret('livraison en cours (' + enCours + ') : main ne doit pas bouger pendant ses tests ; relancer ce cpt quand elle est finie (20 à 25 min). '
    + V + ' reste commitée sur la branche ' + branche);

  // Dépôt principal : l'essai de ConceptCAD.html (copié pour que Fred teste) ne doit pas bloquer l'avance.
  if (git(['diff', '--name-only', 'HEAD'], M.path).split(/\r?\n/).includes('ConceptCAD.html')) {
    if (git(['hash-object', 'ConceptCAD.html'], M.path) !== git(['rev-parse', sha + ':ConceptCAD.html'], ICI))
      arret('ConceptCAD.html du dépôt principal est modifié et différent de ' + V + ' (essai d\'une autre session : '
        + O.appVerFichier(path.join(M.path, 'ConceptCAD.html')) + ') : attendre qu\'elle ait fini');
    git(['restore', '--', 'ConceptCAD.html'], M.path);
  }
  const r = git(['merge', '--ff-only', sha], M.path, { ok: true });
  if (r === null) arret('avance rapide de main refusée dans ' + M.path + ' (fichiers modifiés par Fred ?) :\n' + git(['status', '--short'], M.path));
  const servi = O.appVerFichier(path.join(M.path, 'ConceptCAD.html'));
  if (servi !== V) arret('après l\'avance, ' + M.path + '\\ConceptCAD.html annonce ' + servi + ' au lieu de ' + V);
  console.log('✓ ' + V + ' rangée dans ' + M.path + ' (main local, non publiée)');

  if (!process.argv.includes('--sans-sauvegarde')) {
    const s = git(['push', '-q', 'origin', sha + ':refs/heads/' + O.SAUVEGARDE], ICI, { ok: true });
    console.log(s === null ? '⚠ copie de sauvegarde sur GitHub refusée (sans effet sur le cpt) : git push origin ' + sha.slice(0, 9) + ':refs/heads/' + O.SAUVEGARDE
      : '✓ copie de sauvegarde sur GitHub (branche ' + O.SAUVEGARDE + ', rien de publié)');
  }
  // Exemples de Fred à commiter à part (après node tests/test_exemples_sains.cjs <dépôt>/Exemples).
  const ex = git(['status', '--porcelain', '--', 'Exemples'], M.path);
  if (ex) console.log('⚠ Exemples nouveaux ou modifiés dans ' + M.path + ' (commit séparé, sans version) :\n' + ex);
  const derniere = git(['for-each-ref', '--merged', 'main', '--sort=-creatordate', '--count=1', '--format=%(refname:short)', 'refs/tags/V*'], M.path);
  const attente = O.entreesChangelog(fs.readFileSync(path.join(M.path, 'CHANGELOG.md'), 'utf8'), derniere, V);
  console.log('En attente de « livre » depuis ' + (derniere || '—') + ' : ' + attente.map(e => e.v).join(', '));
}

try { cpt(); } catch (e) {
  if (!(e instanceof O.Arret)) throw e;
  console.error('✗ cpt arrêté : ' + e.message);
  process.exit(1);
}
