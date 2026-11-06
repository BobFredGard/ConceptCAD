// Une pièce, fonction par fonction : chaque corps du natif est-il celui du navigateur ? Montre la première qui diffère.
// node tester-etapes.cjs <pièce> <dossier de travail> --racine=<dépôt à la bonne version>
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const piece = path.resolve(process.argv[2]), dossier = path.resolve(process.argv[3]);
const RACINE = path.resolve(opt('racine', path.join(__dirname, '..', '..')));
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const sortie = path.join(dossier, 'etapes.json');
  fs.rmSync(sortie, { force: true });
  spawnSync(EXE, ['--etapes', piece, sortie], { timeout: 3000000 });
  const nat = JSON.parse(fs.readFileSync(sortie, 'utf8'));
  const port = 4800 + (process.pid % 150);
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  try {
    await attendre(800);
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-et-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:' + port + '/ConceptCAD.html');
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
    await page.evaluate(() => { window.__docAvant = doc; });
    await page.setInputFiles('#fileProj', piece);
    await page.waitForFunction(() => doc && doc !== window.__docAvant, null, { timeout: 300000 });
    await attendre(5000);
    let ecarts = 0;
    for (let k = 0; k < nat.length; k++) {
      const q = await page.evaluate(k => {
        const r = occFinalShape(k + 1), out = { nom: '', type: '', corps: {} };
        const f = doc.features.filter(x => x.visible !== false)[k];
        out.nom = f.name; out.type = f.type;
        (r.perBody || []).forEach(p => { const a = occSubShapes(p.shape, 'TopAbs_FACE'), n = a.length; occDispose(a); out.corps[p.bodyId] = [occCoqueVolume(p.shape), n]; });
        out.msgs = r.msgs;
        return out;
      }, k);
      const n = nat[k].corps, b = q.corps;
      const cles = new Set([...Object.keys(n), ...Object.keys(b)]);
      const diff = [...cles].filter(c => !n[c] || !b[c] || Math.abs(n[c][0] - b[c][0]) > Math.max(0.01, Math.abs(b[c][0]) * 1e-7) || n[c][1] !== b[c][1]);
      if (diff.length) {
        ecarts++;
        console.log('ÉCART ' + (k + 1) + ' ' + q.type + ' « ' + q.nom + ' » ' + diff.map(c => c + ' : natif ' + JSON.stringify(n[c]) + ' nav. ' + JSON.stringify(b[c])).join(' ; '));
        console.log('   nav. : ' + (q.msgs || []).slice(-3).join(' / ').slice(0, 400));
        if (ecarts >= Number(opt('max', 4))) break;
      }
    }
    if (!ecarts) console.log(nat.length + ' fonctions identiques');
    await ctx.close().catch(() => {});
  } finally { serveur.kill(); }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });
