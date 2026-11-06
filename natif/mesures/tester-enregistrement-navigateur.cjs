// Le navigateur rouvre-t-il un fichier enregistré par le natif comme s'il avait fait la modification lui-même ?
// À lancer après tester-enregistrement.cjs, avec le même dossier. Sans fenêtre visible.
// node natif/mesures/tester-enregistrement-navigateur.cjs <dossier de travail>
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const dossier = process.argv[2];
const liste = JSON.parse(fs.readFileSync(path.join(dossier, 'modifiees.json'), 'utf8'));
const attendre = ms => new Promise(r => setTimeout(r, ms));
const portLibre = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

const ETAT = () => {
  const sh = typeof occLive !== 'undefined' && occLive && occLive.shape;
  let job = null, ops = 0, sans = 0;
  try { job = faoDoc(); faoActiveOps(job).forEach(op => { const k = faoOpMovesKey(op, job), h = faoOpMovesHit(op); if (k !== null) { ops++; if (!(h && h.key === k)) sans++; } }); } catch (e) {}
  return { src: JSON.parse(docHashSrc(doc)), corps: bodies.filter(b => b.shape).length, volume: sh ? occCoqueVolume(sh) : null, ops, sans };
};
// Toutes les différences entre deux documents, sous la forme chemin → nom du champ
function ecarts(a, b, chemin, out) {
  if (a === b) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) ecarts(a[k], b[k], chemin.concat(k), out);
    return out;
  }
  out.push(chemin.filter(k => isNaN(k)).join('.'));
  return out;
}
const pret = page => page.waitForFunction(() => typeof doc !== 'undefined' && doc && !skEdit && rebuildDepth === 0, null, { timeout: 600000 });

(async () => {
  const port = await portLibre();
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  const url = 'http://127.0.0.1:' + port;
  let echecs = 0;
  const identiques = [], differentes = [];
  try {
    await attendre(800);
    const h = b => crypto.createHash('sha256').update(b).digest('hex');
    if (h(Buffer.from(await (await fetch(url + '/ConceptCAD.html')).arrayBuffer())) !== h(fs.readFileSync(path.join(RACINE, 'ConceptCAD.html')))) throw new Error('le serveur ne sert pas le code de ce dossier');
    const ouvrir = async fichier => {
      const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-enr-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
      const page = ctx.pages()[0] || await ctx.newPage();
      const erreurs = [];
      page.on('pageerror', e => erreurs.push(e.message));
      page.on('dialog', d => { erreurs.push('dialogue : ' + d.message()); d.dismiss().catch(() => {}); });
      await page.goto(url + '/ConceptCAD.html');
      await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
      await pret(page);
      await page.setInputFiles('#fileProj', fichier);
      await page.waitForFunction(() => doc && (doc.features || []).length, null, { timeout: 300000 });
      await attendre(2000);
      await pret(page);
      return { ctx, page, erreurs };
    };
    for (const { f, i, v, modif, id } of liste) {
      // A : le navigateur ouvre l'original et fait la modification lui-même
      const a = await ouvrir(path.join(RACINE, 'Exemples', f));
      await a.page.evaluate(([id, v]) => { doc.features.find(x => x.id === id).distance = v; markDirty(); rebuild(); }, [id, v]);
      await attendre(500);
      await pret(a.page);
      const ea = await a.page.evaluate(ETAT);
      await a.ctx.close().catch(() => {});
      // B : le navigateur ouvre le fichier enregistré par le natif
      const b = await ouvrir(modif);
      const eb = await b.page.evaluate(ETAT);
      const lu = await b.page.evaluate(id => doc.features.find(x => x.id === id).distance, id);
      await b.ctx.close().catch(() => {});
      // Tout doit être identique, jusqu'au dernier champ
      const champs = ecarts(ea.src, eb.src, [], []);
      const ok = !champs.length && ea.corps === eb.corps && ea.volume === eb.volume && lu === v && !a.erreurs.length && !b.erreurs.length;
      const sortie = path.join(dossier, 'verif.json');
      spawnSync(EXE, ['--verif', modif, sortie], { stdio: 'ignore' });
      const n = JSON.parse(fs.readFileSync(sortie, 'utf8'));
      const calculable = !n.nonPrisEnCharge.length, regle = n.modifiables.includes(i);
      const vn = calculable ? n.cas[0].volume : null;
      // Seul compte ce que le logiciel laisse modifier ; le reste montre si la règle est assez prudente
      const exige = calculable && regle;
      if (exige && (!ok || vn.toFixed(6) !== eb.volume.toFixed(6))) echecs++;
      if (ok) identiques.push(regle); else differentes.push(regle);
      console.log((ok ? 'pareil  ' : 'ÉCART   ') + (exige ? 'modifiable ' : regle ? 'règle ok   ' : 'refusée    ') + f.slice(0, 30).padEnd(31) + ' f' + i + ` volume nav. ${ea.volume == null ? '-' : ea.volume.toFixed(3)} / fichier ${eb.volume == null ? '-' : eb.volume.toFixed(3)}  natif ${vn == null ? '-' : vn.toFixed(3)}  parcours sans valeur ${eb.sans}/${eb.ops}  écarts ${champs.length ? [...new Set(champs)].join(', ') : 'aucun'}` + ((a.erreurs.length || b.erreurs.length) ? '  erreurs : ' + JSON.stringify([...a.erreurs, ...b.erreurs]).slice(0, 200) : ''));
    }
  } finally { serveur.kill(); }
  console.log(`Écarts sur ce que le logiciel laisse modifier : ${echecs}. Écarts malgré la règle sur des pièces non calculables : ${differentes.filter(Boolean).length}. Identiques malgré un refus : ${identiques.filter(x => !x).length}.`);
  process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
