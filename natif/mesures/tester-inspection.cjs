// L'inspection et l'export STEP d'un assemblage : mêmes masses, mêmes interférences, même nombre de solides que le navigateur ?
// node tester-inspection.cjs <dossier d'exemples ou fichier> <dossier de travail> --racine=<dépôt à la bonne version> [--pieces=A,B]
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
  const fichiers = fs.statSync(entree).isFile() ? [entree] : fs.readdirSync(entree).filter(f => f.endsWith('.conceptcad') && voulues.includes(f.replace('.conceptcad', ''))).map(f => path.join(entree, f));
  const port = 4300 + (process.pid % 500);
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  let justes = 0, ecarts = 0;
  try {
    await attendre(800);
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-insp-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    for (const chemin of fichiers) {
      const nom = path.basename(chemin).replace('.conceptcad', '');
      const d = path.join(dossier, nom);
      fs.rmSync(d, { recursive: true, force: true });
      fs.mkdirSync(d, { recursive: true });
      const etapes = path.join(d, 'etapes.json'), st = path.join(d, 'a.step');
      fs.writeFileSync(etapes, JSON.stringify([{ asm: 'basculer' }, { asm: 'inspecter' }, { mesure: 1 }, { exporter: ['step', st] }, { mesure: 1 }]));
      spawnSync(EXE, ['--essai-esquisse', chemin, '-2', path.join(d, 'sortie.conceptcad'), etapes, d], { encoding: 'utf8', timeout: 280000 });
      if (!fs.existsSync(path.join(d, 'bilan.json'))) { ecarts++; console.log(`ÉCART   ${nom} : le natif n'a rien rendu`); continue; }
      const bilan = JSON.parse(fs.readFileSync(path.join(d, 'bilan.json'), 'utf8'));
      const L = Array.isArray(bilan) ? bilan : bilan.etapes;
      const mes = L.find(x => x.inspection);
      const expo = L.find(x => x.nFormes != null);
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
        const c = asmActiveComp();
        if (!(c.occ && c.occ.length) && asm.path.length) { const P = asm.path.slice(); P.pop(); asmActivate(asmPathComp(P), P); }
        const r = asmInspectRun();
        const E = asmStepShapes();
        const res = { items: r.items.map(x => ({ label: x.label, mat: x.mat, v: x.v, mass: x.mass, c: x.c })), inter: r.inter.map(x => ({ a: x.a, b: x.b, v: x.v })), volume: r.total.v, masse: r.total.mass, com: r.com, nFormes: E.shapes.length, manquants: E.missing };
        E.shapes.forEach(s => { try { s.delete(); } catch (e) {} });
        return res;
      });
      await page.close();
      const pb = [], n = mes ? mes.inspection : null;
      if (!n) pb.push('pas d\'inspection côté natif');
      else {
        const proche = (x, y) => Math.abs(x - y) <= Math.max(0.01, Math.abs(y) * 1e-5);
        if (n.items.length !== b.items.length) pb.push(`corps ${n.items.length} / ${b.items.length}`);
        for (const x of b.items) {
          const a = n.items.find(q => q.label === x.label);
          if (!a) { pb.push(`corps absent : ${x.label}`); continue; }
          if (a.mat !== x.mat || !proche(a.v, x.v) || !proche(a.mass, x.mass)) pb.push(`${x.label} : ${a.mat} ${a.v} / ${x.mat} ${x.v}`);
        }
        if (!proche(n.masse, b.masse)) pb.push(`masse ${n.masse} / ${b.masse}`);
        for (let i = 0; i < 3; i++) if (Math.abs(n.com[i] - b.com[i]) > 1e-3) pb.push(`centre de gravité ${n.com} / ${b.com}`);
        const cle = x => [x.a, x.b].sort().join(' ∩ ');
        for (const x of b.inter) { const a = n.inter.find(q => cle(q) === cle(x)); if (!a) pb.push(`interférence absente : ${cle(x)} (${x.v})`); else if (!proche(a.v, x.v)) pb.push(`${cle(x)} : ${a.v} / ${x.v}`); }
        for (const x of n.inter) if (!b.inter.some(q => cle(q) === cle(x))) pb.push(`interférence en trop : ${cle(x)} (${x.v})`);
      }
      if (!expo) pb.push('pas d\'export côté natif');
      else {
        if (expo.nFormes !== b.nFormes) pb.push(`STEP : ${expo.nFormes} formes / ${b.nFormes}`);
        if (JSON.stringify(expo.manquants) !== JSON.stringify(b.manquants)) pb.push(`STEP manquants ${expo.manquants} / ${b.manquants}`);
        if (!fs.existsSync(st) || fs.statSync(st).size < 1000) pb.push('fichier STEP vide');
      }
      if (pb.length) { ecarts++; console.log(`ÉCART   ${nom} :\n   ` + pb.slice(0, 12).join('\n   ')); }
      else { justes++; console.log(`pareil  ${nom} : ${b.items.length} corps, ${b.masse.toFixed(1)} g, ${b.inter.length} interférences, STEP ${b.nFormes} solides (${fs.statSync(st).size >> 10} Ko)`); }
    }
    await ctx.close().catch(() => {});
  } finally { serveur.kill(); }
  console.log(`${justes} pareils, ${ecarts} écarts.`);
  process.exit(ecarts ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
