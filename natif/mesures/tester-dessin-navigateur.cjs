// Ce que le natif a dessiné et enregistré : le navigateur rouvre-t-il la même pièce ?
// Rejoue dans le natif les sessions de mesures/dessin-reference.cjs (celles qui portent sur une pièce qu'il calcule), enregistre, puis compare
// le volume du natif et celui du navigateur qui rouvre le fichier. Les gestes eux-mêmes sont déjà comparés par BancDessin.
// node natif/mesures/tester-dessin-navigateur.cjs <reference.json> <dossier des exemples> <dossier de travail> [--fichier=chemin ...]
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os');
const { spawn, spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const [refF, exemples, dossier] = process.argv.slice(2);
const directs = process.argv.filter(a => a.startsWith('--fichier=')).map(a => a.slice(10));
const SEUIL_VOLUME = 1e-2;
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
const portLibre = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const pret = page => page.waitForFunction(() => typeof doc !== 'undefined' && doc && !skEdit && rebuildDepth === 0, null, { timeout: 600000 });
const ETAT = () => {
  const sh = typeof occLive !== 'undefined' && occLive && occLive.shape;
  return { corps: bodies.filter(b => b.shape).length, volume: sh ? occCoqueVolume(sh) : null, esquisses: (doc.sketches || []).map(s => ({ id: s.id, e: s.entities.length, c: s.constraints.length, d: s.dims.length, p: Object.keys(s.points).length })) };
};
const verif = f => {
  const v = path.join(dossier, 'verif.json');
  spawnSync(EXE, ['--verif', f, v], { stdio: 'ignore' });
  return JSON.parse(fs.readFileSync(v, 'utf8'));
};

(async () => {
  const cas = directs.map(f => ({ nom: path.basename(f), sortie: f }));
  if (refF && fs.existsSync(refF)) {
    for (const es of JSON.parse(fs.readFileSync(refF, 'utf8'))) {
      if (!es.fichier) continue;
      const src = path.join(exemples, es.fichier);
      for (const se of es.sessions) {
        const gestes = path.join(dossier, 'gestes.json');
        fs.writeFileSync(gestes, JSON.stringify({ s: se.s, pas: se.pas.map(p => { const q = { ...p }; delete q.etat; return q; }) }));
        const sortie = path.join(dossier, `${cas.length}.conceptcad`);
        const q = spawnSync(EXE, ['--dessiner', src, sortie, es.esquisse, gestes], { encoding: 'utf8' });
        if (q.status === 5) continue;  // pièce pas encore calculée par le natif
        if (q.status !== 0) { console.log('ÉCHEC natif', es.fichier, es.esquisse, se.graine, q.status, q.stderr); cas.push({ nom: es.fichier, faux: true }); continue; }
        cas.push({ nom: `${es.fichier.slice(0, 24)} ${es.esquisse} graine ${se.graine}`, sortie });
      }
    }
  }
  const port = await portLibre();
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  const url = 'http://127.0.0.1:' + port;
  let justes = 0, faux = 0;
  try {
    await attendre(800);
    for (const c of cas) {
      if (c.faux) { faux++; continue; }
      const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-des-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
      const page = ctx.pages()[0] || await ctx.newPage();
      const erreurs = [];
      page.on('pageerror', e => erreurs.push(e.message));
      page.on('dialog', d => { erreurs.push('dialogue : ' + d.message()); d.dismiss().catch(() => {}); });
      await page.goto(url + '/ConceptCAD.html');
      await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
      await pret(page);
      await page.setInputFiles('#fileProj', c.sortie);
      await page.waitForFunction(() => doc && (doc.features || []).length || (doc && (doc.sketches || []).length), null, { timeout: 300000 });
      await attendre(1500);
      await pret(page);
      const e = await page.evaluate(ETAT);
      await ctx.close().catch(() => {});
      const n = verif(c.sortie).cas[0];
      const ok = !erreurs.length && (e.volume == null ? !n.volume : Math.abs(e.volume - n.volume) <= SEUIL_VOLUME);
      if (ok) justes++; else faux++;
      console.log(`${ok ? 'pareil ' : 'ÉCART  '} ${c.nom} : navigateur ${e.volume == null ? '-' : e.volume.toFixed(3)}, natif ${(n.volume || 0).toFixed(3)} ${erreurs.slice(0, 2).join(' ')}`);
      if (!directs.includes(c.sortie)) { fs.rmSync(c.sortie, { force: true }); fs.rmSync(c.sortie + '.bak', { force: true }); }
    }
  } finally { serveur.kill(); }
  console.log(`${cas.length} fichiers : ${justes} pareils, ${faux} écarts.`);
  process.exit(faux ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
