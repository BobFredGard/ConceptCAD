// Monter et descendre une fonction : le natif et le navigateur donnent-ils le même ordre, les mêmes refus, les mêmes ⚠ ?
// node natif/mesures/tester-ordre.cjs <dossier de travail> --racine=<dossier du navigateur> [--pieces=A,B]
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const ICI = path.resolve(__dirname, '..', '..');
const opt = n => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : ''; };
const RACINE = opt('racine') || ICI, PIECES = (opt('pieces') || 'Griffe,Cache Piles,Perçages,Barquette,Support Pédale Déportée R1200RT 2011,Test Répétition Courbe').split(',');
const EXE = path.join(ICI, 'natif', 'sortie', 'ConceptCADNatif.exe');
const { chromium } = require(path.join(ICI, 'node_modules', '@playwright', 'test'));
const dossier = process.argv[2];
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
const portLibre = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); const j = JSON.parse(b); return j.doc || j; };

(async () => {
  const port = await portLibre();
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  let justes = 0, ecarts = 0, ctx = null;
  try {
    for (const nom of PIECES) {
      const src = path.join(ICI, 'Exemples', nom + '.conceptcad');
      // Un profil neuf par pièce : l'ouverture ne doit rien reprendre de la pièce d'avant
      if (ctx) await ctx.close().catch(() => {});
      ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ordre-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
      const page = await ctx.newPage();
      page.on('dialog', d => d.dismiss().catch(() => {}));
      await page.goto('http://127.0.0.1:' + port + '/ConceptCAD.html');
      await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
      await page.setInputFiles('#fileProj', src);
      await page.waitForFunction(() => doc && (doc.features || []).length, null, { timeout: 300000 });
      await attendre(1500);
      const nav = await page.evaluate(() => {
        const out = [];
        for (const f of doc.features) {
          if (f.repeatId) continue;
          for (const dir of [-1, 1]) {
            const A = doc.features.slice();
            const ok = featMoveRaw(A, f.id, dir);
            out.push({ id: f.id, dir, ok, why: featMoveWhy, ordre: A.map(x => x.id) });
          }
        }
        const avert = {};
        antWarnMap().forEach((v, k) => { avert[k] = v.join('\n'); });
        return { out, avert };
      });
      // Vraiment déplacée puis recalculée : volume et ordre complet, copies comprises
      for (const c of nav.out) {
        if (!c.ok) continue;
        await page.evaluate(([id, dir]) => { featMove(id, dir); }, [c.id, c.dir]);
        await attendre(300);
        await page.waitForFunction(() => rebuildDepth === 0, null, { timeout: 300000 });
        const e = await page.evaluate(() => ({ volume: typeof occLive !== 'undefined' && occLive && occLive.shape ? occCoqueVolume(occLive.shape) : null, ordre: doc.features.map(x => x.id) }));
        c.volume = e.volume, c.ordreRecalcule = e.ordre;
        await page.evaluate(() => docUndo());
        await attendre(300);
        await page.waitForFunction(() => rebuildDepth === 0, null, { timeout: 300000 });
      }
      await page.close();
      // Le natif : chaque déplacement, puis son annulation, sur la même pièce
      const d = lire(src), etapes = [{ anteriorite: 1 }];
      for (const c of nav.out) etapes.push({ deplacer: { id: c.id, dir: c.dir } }, { annulerSi: c.ok ? 1 : 0 });
      const fEt = path.join(dossier, nom + '-etapes.json'), sortie = path.join(dossier, nom + '-natif.conceptcad'), dEs = path.join(dossier, nom + '-ce');
      fs.mkdirSync(dEs, { recursive: true });
      fs.writeFileSync(fEt, JSON.stringify(etapes.map(e => (e.annulerSi === 1 ? { annuler: 1 } : e)).filter(e => e.annulerSi === undefined)));
      try { fs.unlinkSync(path.join(dEs, 'bilan.json')); } catch (e) {}
      const r = spawnSync(EXE, ['--essai-esquisse', src, '-2', sortie, fEt, dEs], { timeout: 900000 });
      let bilan = null;
      try { bilan = JSON.parse(fs.readFileSync(path.join(dEs, 'bilan.json'))); } catch (e) {}
      if (!bilan) { ecarts++; console.log('ÉCHEC natif', nom, r.status); continue; }
      const L = (bilan.etapes || bilan).filter(e => e.ordre);
      const A = (bilan.etapes || bilan).find(e => e.avert);
      let bon = 0, faux = 0;
      nav.out.forEach((c, i) => {
        const n = L[i];
        const vol = n ? /Volume ([\d.]+)/.exec(n.etat) : null;
        const pareil = n && (c.ok
          ? JSON.stringify(n.ordre) === JSON.stringify(c.ordreRecalcule) && vol && Math.abs(+vol[1] - c.volume) < 0.05
          : JSON.stringify(n.ordre) === JSON.stringify(d.features.map(x => x.id)) && (c.why ? n.etat.includes(c.why) : n.etat.includes('rien à décaler')));
        if (pareil) bon++;
        else {
          faux++;
          if (faux <= 5) console.log('  écart', nom, c.id, c.dir, 'nav', c.ok, c.why || '', c.volume, (c.ordreRecalcule||[]).join(' ').slice(0,200), JSON.stringify(c.ordreRecalcule) === JSON.stringify(n && n.ordre) ? 'même ordre' : (n ? n.ordre.join(' ').slice(0,200) : ''), '| natif', n ? n.etat.slice(0, 160) : 'rien');
        }
      });
      const av = JSON.stringify(Object.entries(nav.avert).sort()), an = JSON.stringify(Object.entries(A ? A.avert : {}).sort());
      if (av !== an) { faux++; console.log('  ⚠ différents', nom, av.slice(0, 300), '/', an.slice(0, 300)); }
      console.log(`${faux ? 'ÉCART ' : 'juste '} ${nom} : ${bon}/${nav.out.length} déplacements, ${Object.keys(nav.avert).length} ⚠`);
      if (faux) ecarts++; else justes++;
    }
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    sv.kill();
  }
  console.log(`${justes} justes, ${ecarts} écarts`);
  process.exit(ecarts ? 1 : 0);
})();
