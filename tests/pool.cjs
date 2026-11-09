// Pool de processus partagé par tests/run.cjs (suite complète) et tests/run-fast.cjs (suite rapide).
//
// Suites lancées EN PARALLÈLE : chaque suite reste un processus isolé (son propre noyau OCCT, sa
// propre application) ; sa sortie est mise en mémoire et affichée d'un bloc quand elle échoue (ou
// toujours avec --verbose), pour que les journaux ne s'entremêlent pas.
//   -j N / --jobs N / TEST_JOBS=N   taille du pool (-j 1 : en série)
//   --verbose                       affiche aussi la sortie des suites vertes
// Les durées de la dernière exécution (tests/.durees.json, non versionné, commun aux deux listes)
// servent à lancer les suites les plus longues en premier : la fin du pool n'attend plus un
// retardataire démarré trop tard.
//
// PARTIES : une entrée « suite:partie » lance `node tests/suite.cjs partie` ; la suite ne fait
// alors qu'une partie de ses contrôles (sans argument, elle fait tout). Une suite listée dans
// PARTIES (ci-dessous) est lancée en morceaux qui tournent en même temps, puis comptée comme UNE
// suite : verte seulement si tous ses morceaux le sont. Les morceaux couvrent ensemble tous les
// contrôles de la suite entière (voir l'en-tête de chaque suite).
//
// CŒURS P / E (Windows, processeur hybride, voir tests/coeurs.cjs) : un étalonnage épinglé trouve
// les cœurs rapides (résultat dans tests/.coeurs.json). Chaque ouvrier est épinglé sur les cœurs P
// ou sur les cœurs E (`start /affinity`) ; un ouvrier libre prend la plus longue suite qu'aucun
// autre ouvrier ne finirait plus tôt (durées gardées en équivalent cœur P). L'écart de vitesse
// P / E se mesure sur les suites elles-mêmes (~1,8) : chaque exécution compare la durée d'une suite
// sur cœur E à sa dernière durée sur cœur P, et la médiane est gardée dans tests/.coeurs.json
// (2 au départ). Processeur homogène, hors Windows ou TEST_AFFINITE=0 : pool homogène.
// TEST_PCORES=0-7 force la liste des cœurs P, TEST_RAPPORT=1.8 l'écart de vitesse.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { NCPU, masque, lancerProc, tuer, coeursPE, ecrire } = require('./coeurs.cjs');

const PARTIES = {
  test_noms_barquette: ['a', 'b', 'c', 'd', 'e'],
  test_engrenages: ['a', 'b'],
};
const DUREES = path.join(__dirname, '.durees.json');
const sec = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';

// SUITES : noms (avec « :partie » éventuel) ; titre : préfixe de la ligne finale (« SUITE », « SUITE RAPIDE »)
async function pool(SUITES, { titre, timeout }) {
  const argv = process.argv.slice(2);
  const VERBOSE = argv.includes('--verbose');
  const iJ = argv.findIndex(a => a === '-j' || a === '--jobs');
  // morceaux réellement lancés
  const TACHES = [];
  const tachesDe = {};
  SUITES.forEach(s => {
    const l = PARTIES[s] ? PARTIES[s].map(p => s + ':' + p) : [s];
    tachesDe[s] = l;
    TACHES.push(...l);
  });
  // Taille du pool : un cœur laissé libre, et ~600 Mo de mémoire DISPONIBLE par processus
  // (pic mesuré : ~550 Mo pour une suite qui charge le noyau OCCT). Au-delà, la machine
  // swappe et tout ralentit ; -j N force la valeur.
  const auto = Math.max(1, Math.min(NCPU - 1, Math.floor(os.freemem() / (600 * 1024 ** 2))));
  const JOBS = Math.max(1, parseInt(iJ >= 0 ? argv[iJ + 1] : process.env.TEST_JOBS, 10) || auto);

  const { pcores, ecores, C } = await coeursPE(JOBS);
  let rapport = (C && C.rapportSuites) || 2;
  if (pcores && process.env.TEST_RAPPORT) rapport = +process.env.TEST_RAPPORT || rapport;
  // ouvriers : autant d'ouvriers P que de cœurs P, le reste sur les cœurs E
  const ouvriers = Array.from({ length: Math.min(JOBS, TACHES.length) }, (_, i) => {
    if (!pcores) return { aff: null, vit: 1, libre: 0, P: false };
    const P = i < pcores.length;
    return { aff: masque(P ? pcores : ecores), vit: P ? 1 : rapport, libre: 0, P };
  });

  let anciennes = {};
  try { anciennes = JSON.parse(fs.readFileSync(DUREES, 'utf8')); } catch (e) { /* première exécution : ordre de la liste */ }
  // Durée estimée (équivalent cœur P) ; une suite inconnue passe en tête (elle peut être longue).
  const est = e => anciennes[e] ?? anciennes[e.split(':')[0]] ?? Infinity;
  const file = TACHES.slice().sort((a, b) => est(b) - est(a));

  const res = {};
  const t0 = Date.now();
  let fini = 0;
  // Choix « au plus tôt fini » : la plus longue suite qu'aucun autre ouvrier (libre plus
  // tard, mais plus rapide) ne finirait avant celui-ci ; à défaut, la plus courte.
  function choisir(w) {
    const now = Date.now();
    for (let i = 0; i < file.length; i++) {
      const d = est(file[i]);
      if (!isFinite(d)) return file.splice(i, 1)[0];
      const f = now + d * w.vit;
      if (ouvriers.every(o => o === w || Math.max(o.libre, now) + d * o.vit >= f - 1)) return file.splice(i, 1)[0];
    }
    return file.pop();
  }
  function lancer(e, w) {
    return new Promise(resolve => {
      const [s, partie] = e.split(':');
      const debut = Date.now(), sortie = [];
      w.libre = debut + (isFinite(est(e)) ? est(e) * w.vit : 0);
      const p = lancerProc(path.join(__dirname, s + '.cjs'), partie ? [partie] : [], w.aff);
      p.stdout.on('data', d => sortie.push(d));
      p.stderr.on('data', d => sortie.push(d));
      const minuterie = setTimeout(() => { sortie.push(Buffer.from('\n✗ délai dépassé (' + sec(timeout) + ')\n')); tuer(p, w.aff); }, timeout);
      p.on('close', code => {
        clearTimeout(minuterie);
        const ms = Date.now() - debut, vert = code === 0;
        res[e] = { vert, ms, eq: ms / w.vit, P: w.P };
        w.libre = Date.now();
        fini++;
        if (!vert || VERBOSE) {
          console.log('\n──── ' + e + ' ────');
          process.stdout.write(Buffer.concat(sortie));
        }
        console.log((vert ? '✓ ' : '✗ ') + e + ' — ' + sec(ms) + (pcores ? (w.P ? ' (P)' : ' (E)') : '') + '  [' + fini + '/' + TACHES.length + ']');
        resolve();
      });
    });
  }
  async function ouvrier(w) { for (let e; file.length && (e = choisir(w));) await lancer(e, w); }

  console.log(titre + ' : ' + SUITES.length + ' suites' + (TACHES.length > SUITES.length ? ' (' + TACHES.length + ' morceaux)' : '') + ', ' + ouvriers.length + ' en parallèle' +
    (pcores ? ' (cœurs P ' + pcores.join(',') + ' : ' + ouvriers.filter(o => o.P).length + ' ouvriers ; cœurs E : ' +
      ouvriers.filter(o => !o.P).length + ' ouvriers, ' + String(rapport).replace('.', ',') + ' fois plus lents)' : ''));
  await Promise.all(ouvriers.map(ouvrier));
  const total = Date.now() - t0;
  const vertS = s => tachesDe[s].every(e => res[e].vert);
  const ko = SUITES.filter(s => !vertS(s));
  const cumul = TACHES.reduce((n, e) => n + res[e].ms, 0);
  // durées fusionnées avec celles déjà connues : la suite rapide n'efface pas celles de la complète
  const durees = Object.assign({}, anciennes);
  TACHES.forEach(e => { durees[e] = Math.round(res[e].eq); });
  try { fs.writeFileSync(DUREES, JSON.stringify(durees, null, 1)); } catch (e) { console.log('(durées non enregistrées : ' + e.message + ')'); }
  if (pcores && C) { // écart P / E appris : dernière durée de chaque suite sur P et sur E
    const mP = C.mesP || {}, mE = C.mesE || {};
    TACHES.forEach(e => { if (res[e].vert) (res[e].P ? mP : mE)[e] = res[e].ms; });
    const r = TACHES.filter(e => mP[e] > 3000 && mE[e] > 3000).map(e => mE[e] / mP[e]).sort((a, b) => a - b);
    Object.assign(C, { mesP: mP, mesE: mE });
    if (r.length >= 3) C.rapportSuites = +r[r.length >> 1].toFixed(2);
    ecrire(C);
    if (r.length >= 3) console.log('Écart P / E mesuré sur ' + r.length + ' suites : ' + String(C.rapportSuites).replace('.', ','));
  }
  console.log('');
  console.log('Plus lentes :');
  TACHES.slice().sort((a, b) => res[b].ms - res[a].ms).slice(0, 10)
    .forEach(e => console.log('  ' + sec(res[e].ms).padStart(9) + '  ' + e + (pcores ? (res[e].P ? ' (P)' : ' (E)') : '')));
  console.log('Durée : ' + sec(total) + ' (cumul des suites ' + sec(cumul) + ', ' + ouvriers.length + ' en parallèle)');
  console.log(titre + ': ' + (SUITES.length - ko.length) + '/' + SUITES.length + ' OK' + (ko.length ? ' — KO: ' + ko.join(', ') : ''));
  process.exit(ko.length ? 1 : 0);
}
module.exports = { pool, PARTIES };
