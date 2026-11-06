// Chaque pièce : le solide du natif est-il celui du navigateur ? Volume, aire, faces, arêtes, sommets et solides.
// node tester-solides.cjs <dossier d'exemples> <dossier de travail> --racine=<dépôt à la bonne version> [--pieces=A,B]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossierEx = path.resolve(process.argv[2]), dossier = path.resolve(process.argv[3]);
const RACINE = path.resolve(opt('racine', path.join(__dirname, '..', '..')));
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const voulues = opt('pieces', '').split(',').filter(Boolean);
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(dossier, { recursive: true });

(async () => {
  const fichiers = fs.readdirSync(dossierEx).filter(f => f.endsWith('.conceptcad') && (!voulues.length || voulues.includes(f.replace('.conceptcad', ''))));
  const port = 4300 + (process.pid % 500);
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  let justes = 0, ecarts = 0, nonCalcules = 0;
  try {
    await attendre(800);
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-sol-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    for (const f of fichiers) {
      const chemin = path.join(dossierEx, f), nom = f.replace('.conceptcad', '');
      const sortie = path.join(dossier, 'v.json');
      fs.rmSync(sortie, { force: true });
      const t = spawnSync(EXE, ['--verif', chemin, sortie], { encoding: 'utf8', timeout: 240000 });
      if (!fs.existsSync(sortie)) { ecarts++; console.log(`ÉCART   ${nom} : le natif n'a rien rendu (code ${t.status})`); continue; }
      const n = JSON.parse(fs.readFileSync(sortie, 'utf8'));
      if ((n.nonPrisEnCharge || []).length) { nonCalcules++; console.log(`manque  ${nom} : ${n.nonPrisEnCharge.join(', ')}`); continue; }
      const c = n.cas[0];
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
      await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
      await page.evaluate(() => { window.__docAvant = doc; });
      await page.setInputFiles('#fileProj', chemin);
      await page.waitForFunction(() => doc && doc !== window.__docAvant, null, { timeout: 300000 });
      // Le navigateur rejoue par tranches : attendre que le solide ne bouge plus
      let m = null, pareil = 0;
      for (let k = 0; k < 400 && pareil < 4; k++) {
        await attendre(500);
        const q = await page.evaluate(() => {
          const sh = typeof occLive !== 'undefined' && occLive && occLive.shape;
          if (!sh) return { rien: 1 };
          const nb = t => { const a = occSubShapes(sh, t), n = a.length; occDispose(a); return n; };
          const coques = (bodies || []).filter(b => b.shape).length;
          return { volume: occCoqueVolume(sh), faces: nb('TopAbs_FACE'), solides: nb('TopAbs_SOLID'), corps: coques };
        });
        const cle = JSON.stringify(q);
        pareil = m && JSON.stringify(m) === cle ? pareil + 1 : 0;
        m = q;
      }
      await page.close();
      if (m && m.rien && c.volume === 0) { justes++; console.log(`pareil  ${nom} : aucun solide des deux côtés`); continue; }
      const dv = m && m.volume != null ? Math.abs(m.volume - c.volume) : Infinity;
      const ok = dv <= Math.max(0.01, Math.abs(c.volume) * 1e-7) && m.faces === c.faces && m.solides === c.solides;
      if (ok) justes++; else ecarts++;
      console.log(`${ok ? 'pareil ' : 'ÉCART  '} ${nom} : volume natif ${c.volume.toFixed(3)} nav. ${m && m.volume != null ? m.volume.toFixed(3) : '-'} ; faces ${c.faces} / ${m && m.faces} ; solides ${c.solides} / ${m && m.solides} ; ${c.ms.toFixed(0)} ms${(c.textes || []).length ? ' ; ' + c.textes.join(' / ').slice(0, 300) : ''}`);
    }
    await ctx.close().catch(() => {});
  } finally { serveur.kill(); }
  console.log(`${fichiers.length} pièces : ${justes} pareilles, ${ecarts} écarts, ${nonCalcules} pas encore calculées.`);
  process.exit(ecarts ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
