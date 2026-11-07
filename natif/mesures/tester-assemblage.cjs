// Chaque assemblage : le natif place-t-il les occurrences comme le navigateur ? Repères de chaque instance, solide de chaque composant.
// node tester-assemblage.cjs <dossier d'exemples ou fichier> <dossier de travail> --racine=<dépôt à la bonne version> [--pieces=A,B]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const entree = path.resolve(process.argv[2]), dossier = path.resolve(process.argv[3]);
const RACINE = path.resolve(opt('racine', path.join(__dirname, '..', '..')));
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const voulues = opt('pieces', '').split(',').filter(Boolean);
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(dossier, { recursive: true });

(async () => {
  const fichiers = fs.statSync(entree).isFile() ? [entree] : fs.readdirSync(entree).filter(f => f.endsWith('.conceptcad') && (!voulues.length || voulues.includes(f.replace('.conceptcad', '')))).map(f => path.join(entree, f));
  const port = 4300 + (process.pid % 500);
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  let justes = 0, ecarts = 0, vus = 0;
  try {
    await attendre(800);
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-asm-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    for (const chemin of fichiers) {
      const nom = path.basename(chemin).replace('.conceptcad', '');
      const sortie = path.join(dossier, 'v.json');
      fs.rmSync(sortie, { force: true });
      const t = spawnSync(EXE, ['--verif', chemin, sortie], { encoding: 'utf8', timeout: 280000 });
      if (!fs.existsSync(sortie)) { ecarts++; console.log(`ÉCART   ${nom} : le natif n'a rien rendu (code ${t.status})`); continue; }
      const n = JSON.parse(fs.readFileSync(sortie, 'utf8'));
      if (!n.assemblage) continue;
      vus++;
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
      await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
      await page.evaluate(() => { window.__docAvant = doc; });
      await page.setInputFiles('#fileProj', chemin);
      await page.waitForFunction(() => doc && doc !== window.__docAvant, null, { timeout: 300000 });
      await attendre(1500);
      const b = await page.evaluate(() => {
        asmBuildSnapshots();
        for (let k = 0; k < 4; k++) { asmSnapSync(); asmResolve(); }
        const comps = {};
        const back = asm.active, bp = asm.path.slice();
        for (const c of asm.comps) {
          asmActivate(c.id);
          const sh = typeof occLive !== 'undefined' && occLive && occLive.shape;
          const nb = t => { const a = occSubShapes(sh, t), n = a.length; occDispose(a); return n; };
          comps[c.id] = sh ? { name: c.name, volume: occCoqueVolume(sh), faces: nb('TopAbs_FACE'), solides: nb('TopAbs_SOLID') } : { name: c.name, volume: 0, faces: 0, solides: 0 };
          const g = asmSnapGeomOf(c); comps[c.id].accroches = g ? g.faces.length : null;
        }
        asmActivate(back, bp);
        asmResolve();
        const inst = asmInstances(asm.root).map(i => { const o = i.path.length ? asmOcc(i.path[i.path.length - 1]) : null; return { path: i.path, comp: i.comp, F: i.F, st: o ? o.st : '', msg: o ? o.msg : '', name: o ? o.name : '' }; });
        return { comps, inst, active: asm.active };
      });
      await page.close();
      const A = n.assemblage, pb = [];
      if (A.actif !== b.active) pb.push(`composant actif ${A.actif} / ${b.active}`);
      if (A.instances.length !== b.inst.length) pb.push(`instances ${A.instances.length} / ${b.inst.length}`);
      let maxEcart = 0;
      for (const i of b.inst) {
        const k = i.path.join('/'), a = A.instances.find(x => x.path.join('/') === k);
        if (!a) { pb.push(`instance ${i.name} absente`); continue; }
        for (const c of ['o', 'x', 'y', 'z']) for (let q = 0; q < 3; q++) {
          const e = Math.abs(a.F[c][q] - i.F[c][q]);
          maxEcart = Math.max(maxEcart, e);
          if (e > 1e-4) { pb.push(`${i.name} ${c} : natif ${a.F[c]} nav. ${i.F[c]}`); break; }
        }
        if ((i.st || 'ok') !== (a.st || 'ok')) pb.push(`${i.name} état natif ${a.st} « ${a.msg} » nav. ${i.st} « ${i.msg} »`);
      }
      for (const [id, c] of Object.entries(b.comps)) {
        const a = A.comps[id];
        if (!a) { if (c.volume) pb.push(`composant ${c.name} sans solide`); continue; }
        if (Math.abs(a.volume - c.volume) > Math.max(0.01, Math.abs(c.volume) * 1e-6) || a.faces !== c.faces || a.solides !== c.solides) pb.push(`${c.name} : volume ${a.volume.toFixed(3)} / ${c.volume.toFixed(3)}, faces ${a.faces} / ${c.faces}, solides ${a.solides} / ${c.solides} ${a.messages.join(' ')}`);
        if (c.accroches != null && a.accroches !== c.accroches) pb.push(`${c.name} : faces d'accroche ${a.accroches} / ${c.accroches}`);
      }
      if (pb.length) { ecarts++; console.log(`ÉCART   ${nom} :\n   ` + pb.slice(0, 12).join('\n   ')); }
      else { justes++; console.log(`pareil  ${nom} : ${b.inst.length} instances, ${Object.keys(b.comps).length} composants, écart de repère maxi ${maxEcart.toExponential(1)}`); }
    }
    await ctx.close().catch(() => {});
  } finally { serveur.kill(); }
  console.log(`${vus} assemblages : ${justes} pareils, ${ecarts} écarts.`);
  process.exit(ecarts ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
