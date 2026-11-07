// La mesure : pour chaque pièce, des paires de faces et d'arêtes mesurées par le navigateur et par le natif.
// node mesures/tester-mesure.cjs <dossier> --racine=D:/ConceptCAD [--pieces=A,B]
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossier = path.resolve(process.argv[2]);
const RACINE = opt('racine', path.resolve(__dirname, '..', '..'));
const EX = path.resolve(__dirname, '..', '..', 'Exemples');
const EXE = path.resolve(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const PIECES = opt('pieces', 'Perçages,Griffe,Cache Piles,Poche et Contour,Cavité Test,Malaxeur Retard').split(',');
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(dossier, { recursive: true });

(async () => {
  const port = 5200 + (process.pid % 400);
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  let total = 0, ecarts = 0, sans = 0;
  for (const nom of PIECES) {
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-me-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 120000 });
    await page.evaluate(() => { window.__d = doc; });
    const f = path.join(EX, nom + '.conceptcad');
    await page.setInputFiles('#fileProj', f);
    await page.waitForFunction(() => doc && doc !== window.__d, null, { timeout: 60000 });
    await attendre(2500);
    const nav = await page.evaluate(() => {
      const B = bodies.filter(b => b.kind === 'body' && b.mesh && b.shape);
      const faces = [], aretes = [];
      B.forEach((b, c) => {
        const G = b.mesh.geometry, gr = G.userData.occGroups || [], pos = G.attributes.position, idx = G.index;
        gr.forEach(g => {
          if (!g.count) return;
          const i0 = idx ? idx.getX(g.start * 3) : g.start * 3;
          faces.push({ c, f: g.f, fi: g.start, mesh: b.mesh, p: [pos.getX(i0), pos.getY(i0), pos.getZ(i0)] });
        });
        occListEdges(b.shape).forEach(e => aretes.push({ c, src: e.src, pts: e.pts }));
      });
      const echantillon = (L, n) => L.length <= n ? L : Array.from({ length: n }, (_, i) => L[Math.floor(i * L.length / n)]);
      const FA = echantillon(faces, 30), AR = echantillon(aretes, 24);
      const cas = [];
      for (let i = 0; i < FA.length; i++) for (let j = i + 1; j < FA.length; j++) {
        const a = FA[i], b = FA[j];
        const A = { mesh: a.mesh, faceIndex: a.fi, point: new THREE.Vector3(...a.p), geom: occFaceGeom(a.mesh, a.fi) };
        const Q = { mesh: b.mesh, faceIndex: b.fi, point: new THREE.Vector3(...b.p), geom: occFaceGeom(b.mesh, b.fi) };
        clearMeasure();
        const ok = measurePair(A, Q);
        cas.push({ t: 'f', ca: a.c, a: a.f, cb: b.c, b: b.f, pa: a.p, pb: b.p, ok, texte: ok ? faceEl.textContent : '' });
      }
      for (let i = 0; i < AR.length; i++) for (let j = i + 1; j < AR.length; j++) {
        clearMeasure();
        edgeSelect(null, { P: AR[i].pts }, false);
        const d1 = faceEl.textContent.split('\n')[0].replace(/^[^:]*: /, '');
        edgeSelect(null, { P: AR[j].pts }, true);
        cas.push({ t: 'a', ca: AR[i].c, a: AR[i].src, cb: AR[j].c, b: AR[j].src, desc: d1, ok: true, texte: faceEl.textContent });
      }
      clearMeasure();
      return { n: B.length, cas };
    });
    await ctx.close();
    const fc = path.join(dossier, nom + '-cas.json'), fs2 = path.join(dossier, nom + '-natif.json');
    fs.writeFileSync(fc, JSON.stringify({ piece: f, cas: nav.cas.map(({ t, ca, a, cb, b, pa, pb }) => ({ t, ca, a, cb, b, pa, pb })) }));
    const r = spawnSync(EXE, ['--mesures', fc, fs2], { timeout: 280000 });
    if (r.status !== 0 || !fs.existsSync(fs2)) { ecarts++; console.log(`ÉCART   ${nom} : code ${r.status}`); continue; }
    const nat = JSON.parse(fs.readFileSync(fs2, 'utf8'));
    let e = 0;
    nav.cas.forEach((c, i) => {
      total++;
      const n = nat[i] || {};
      if (!c.ok) sans++;
      const pareil = !!n.ok === !!c.ok && (n.texte || '') === c.texte && (c.t !== 'a' || n.desc === c.desc);
      if (!pareil) {
        e++;
        if (e <= 5) console.log(`   ${c.t} ${c.a}/${c.b} :\n      nav   ${JSON.stringify(c.desc || '')} ${JSON.stringify(c.texte)}\n      natif ${JSON.stringify(n.desc || '')} ${JSON.stringify(n.texte || '')}`);
      }
    });
    ecarts += e;
    console.log(`${e ? 'ÉCART ' : 'pareil'}  ${nom} : ${nav.cas.length} paires, ${e} écarts`);
  }
  console.log(`${total} paires : ${total - ecarts} justes, ${ecarts} écarts (${sans} sans mesure exacte des deux côtés)`);
  sv.kill();
  process.exit(ecarts ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
