// Images de référence : chaque esquisse d'une pièce, vue par la version navigateur, à comparer à `--captures` du natif.
// node natif/mesures/captures-navigateur.cjs "<fichier>" <dossier> [numéros d'esquisses séparés par des virgules]
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), crypto = require('crypto');
const { spawn } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));

const attendre = ms => new Promise(r => setTimeout(r, ms));
const portLibre = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

(async () => {
  const [fichier, dossier, liste] = process.argv.slice(2);
  fs.mkdirSync(dossier, { recursive: true });
  const port = await portLibre();
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  const url = 'http://127.0.0.1:' + port;
  let ctx;
  try {
    await attendre(800);
    // Le code servi est-il bien celui de ce dossier ?
    const h = b => crypto.createHash('sha256').update(b).digest('hex');
    const servi = Buffer.from(await (await fetch(url + '/ConceptCAD.html')).arrayBuffer());
    if (h(servi) !== h(fs.readFileSync(path.join(RACINE, 'ConceptCAD.html')))) throw new Error('le serveur ne sert pas le code de ce dossier');
    const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-captures-'));
    // Sans fenêtre visible : la personne peut se servir de son PC pendant ce temps.
    ctx = await chromium.launchPersistentContext(profil, { channel: 'chrome', headless: true, viewport: { width: 1500, height: 900 } });
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(url + '/ConceptCAD.html');
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && (occtReady === true || /échec|indisponible/.test(occBaseMsg)), null, { timeout: 300000 });
    await page.waitForFunction(() => !skEdit && rebuildDepth === 0);
    await page.setInputFiles('#fileProj', fichier);
    await page.waitForFunction(() => doc && (doc.features || []).length && bodies.some(b => b.shape), null, { timeout: 200000 });
    await page.waitForFunction(() => rebuildDepth === 0);
    const ids = await page.evaluate(() => doc.sketches.map(s => s.id));
    const voulus = liste ? liste.split(',').map(Number) : ids.map((_, i) => i);
    for (const i of voulus) {
      await page.evaluate(id => openSketch(id), ids[i]);
      await attendre(300);
      await page.locator('#skSvg').screenshot({ path: path.join(dossier, String(i).padStart(3, '0') + '-nav.png') });
      await page.evaluate(() => { if (typeof closeSketch === 'function') closeSketch(); });
      await page.waitForFunction(() => !skEdit && rebuildDepth === 0, null, { timeout: 60000 }).catch(() => {});
    }
    console.log(ids.length + ' esquisses, images : ' + voulus.join(','));
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    serveur.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
