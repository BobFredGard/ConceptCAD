// Relevé léger pour la carte des tests (tests/carte.cjs) : chargé avant la suite par
// NODE_OPTIONS=--require, il demande au moteur la liste des FONCTIONS exécutées (sans compter les
// passages ni les blocs : NODE_V8_COVERAGE, ligne par ligne, doublait la durée des suites lourdes).
// Écrit à la sortie du processus dans CARTE_COUV (même forme que NODE_V8_COVERAGE).
'use strict';
const dossier = process.env.CARTE_COUV;
if (dossier) {
  try {
    const inspector = require('inspector'), fs = require('fs'), path = require('path');
    const s = new inspector.Session();
    s.connect();
    s.post('Profiler.enable');
    s.post('Profiler.startPreciseCoverage', { callCount: false, detailed: false });
    let fait = false;
    const ecrire = () => {
      if (fait) return;
      fait = true;
      s.post('Profiler.takePreciseCoverage', (err, r) => {
        if (err || !r) return;
        const result = r.result.filter(x => x.url === 'ConceptCAD.html');
        try { fs.writeFileSync(path.join(dossier, 'couv-' + process.pid + '-' + (require('worker_threads').threadId) + '.json'), JSON.stringify({ result })); } catch (e) { /* dossier retiré */ }
      });
    };
    process.on('exit', ecrire);
  } catch (e) { /* inspecteur indisponible : pas de relevé */ }
}
