// L'export DXF d'une planche : le fichier du navigateur et celui du programme natif, entité par entité.
// node mesures/tester-plan-exports.cjs <dossier> --racine=D:/ConceptCAD [--pieces=A,B] [--dossier=…]
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossier = path.resolve(process.argv[2]);
const RACINE = opt('racine', path.resolve(__dirname, '..', '..'));
const EX = opt('dossier', path.resolve(__dirname, '..', '..', 'Exemples'));
const EXE = path.resolve(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const PIECES = opt('pieces', 'Griffe,Perçages,Crochet').split(',');
const TOL = 0.02;
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(dossier, { recursive: true, force: true });
fs.mkdirSync(dossier, { recursive: true });

// Le fichier en entités : [genre, calque, nombres, texte]
function lire(t) {
  const l = t.split(/\r?\n/);
  const paires = [];
  for (let i = 0; i + 1 < l.length; i += 2) paires.push([+l[i], l[i + 1]]);
  let d = paires.findIndex(p => p[0] === 2 && p[1] === 'ENTITIES') + 1;
  const ents = [];
  while (d < paires.length && !(paires[d][0] === 0 && paires[d][1] === 'ENDSEC')) {
    const genre = paires[d][1];
    const champs = [];
    d++;
    while (d < paires.length && paires[d][0] !== 0) champs.push(paires[d++]);
    const val = c => { const p = champs.find(q => q[0] === c); return p ? p[1] : undefined; };
    if (genre === 'POLYLINE') {
      const pts = [];
      while (paires[d][1] === 'VERTEX') {
        d++;
        const v = [];
        while (paires[d][0] !== 0) v.push(paires[d++]);
        pts.push(+v.find(q => q[0] === 10)[1], +v.find(q => q[0] === 20)[1]);
      }
      if (paires[d][1] === 'SEQEND') { d++; while (paires[d][0] !== 0) d++; }
      ents.push({ g: val(70) === '1' ? 'POLYF' : 'POLY', L: val(8), n: pts });
    } else {
      const n = champs.filter(p => [10, 20, 11, 21, 12, 22, 13, 23, 40, 50].includes(p[0])).map(p => +p[1]);
      ents.push({ g: genre, L: val(8), n, t: genre === 'TEXT' ? val(1) : undefined });
    }
  }
  return ents;
}
const bilan = es => { const c = {}; for (const e of es) { const k = e.g.replace('POLYF', 'POLY') + ' ' + e.L; c[k] = (c[k] || 0) + 1; } return c; };
const proche = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= TOL);
const inverse = n => { const o = []; for (let i = n.length - 2; i >= 0; i -= 2) o.push(n[i], n[i + 1]); return o; };
// Chaque entité du navigateur doit avoir sa jumelle : même genre, même calque, mêmes nombres
function apparier(A, B) {
  const reste = new Map();
  for (const e of B) { const k = e.g + '|' + e.L + '|' + (e.t || ''); if (!reste.has(k)) reste.set(k, []); reste.get(k).push(e); }
  const seuls = [];
  for (const e of A) {
    const k = e.g + '|' + e.L + '|' + (e.t || '');
    const l = reste.get(k) || [];
    const i = l.findIndex(q => proche(q.n, e.n) || (e.g !== 'TEXT' && e.g !== 'CIRCLE' && proche(inverse(q.n), e.n)));
    if (i < 0) seuls.push(e);
    else l.splice(i, 1);
  }
  const autres = [];
  for (const l of reste.values()) autres.push(...l);
  return [seuls, autres];
}

(async () => {
  const port = 5200 + (process.pid % 400);
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  let justes = 0, faux = 0;
  for (const nom of PIECES) {
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-pe-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__MEP_TEST_HOOKS__ = true; });
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 120000 });
    await page.evaluate(() => { window.__d = doc; });
    const f = path.join(EX, nom + '.conceptcad');
    await page.setInputFiles('#fileProj', f);
    await page.waitForFunction(() => doc && doc !== window.__d, null, { timeout: 60000 });
    await attendre(2500);
    const texte = await page.evaluate(async () => {
      mepSetActive(true);
      doc.mep.cur = 0;
      window.mepThemeApply();
      const g = document.getElementById('mepGSheet');
      for (let i = 0, avant = -1, stable = 0; i < 120 && stable < 4; i++) {
        await new Promise(r => setTimeout(r, 500));
        window.mepThemeApply();
        const n = g.querySelectorAll('*').length;
        stable = n === avant ? stable + 1 : 0;
        avant = n;
      }
      // Défaut du navigateur (V0.69.0) : une épaisseur lue « calc(0.245px) » n'est pas un nombre et le trait saute du DXF
      // (fonds de filet, contours de coupe). Le programme natif les garde : on les rétablit ici pour comparer le reste.
      for (const el of g.ownerSVGElement.querySelectorAll('line,rect,circle,path,polyline,polygon')) {
        const m = /^calc\(([\d.]+)px\)$/.exec(getComputedStyle(el).strokeWidth);
        if (m) el.style.strokeWidth = m[1] + 'px';
      }
      return window.mepDxfBuild().text;
    });
    await ctx.close();
    const base = path.join(dossier, nom);
    fs.writeFileSync(base + '-nav.dxf', texte);
    fs.writeFileSync(base + '-etapes.json', JSON.stringify([{ atelier: 'plan' }, { plan: { exporter: 'dxf', fichier: base + '-natif.dxf' } }, { plan: { exporter: 'svg', fichier: base + '-natif.svg' } }, { plan: { exporter: 'pdf', fichier: base + '-natif.pdf' } }]));
    const r = spawnSync(EXE, ['--essai-esquisse', f, '-2', base + '-sortie.conceptcad', base + '-etapes.json', dossier], { timeout: 280000 });
    if (r.status !== 0) { faux++; console.log(`ÉCART   ${nom} : code ${r.status}`); continue; }
    const A = lire(texte), B = lire(fs.readFileSync(base + '-natif.dxf', 'utf8'));
    const entete = t => t.split('ENTITIES')[0];
    const [seulsNav, seulsNat] = apparier(A, B);
    const bA = bilan(A), bB = bilan(B);
    const compte = [...new Set([...Object.keys(bA), ...Object.keys(bB)])].filter(k => bA[k] !== bB[k]).map(k => `${k} ${bA[k] || 0}/${bB[k] || 0}`);
    const okEntete = entete(texte) === entete(fs.readFileSync(base + '-natif.dxf', 'utf8'));
    // Autre défaut du navigateur : d'une cote à tolérance il n'écrit que la tolérance, pas la valeur
    const enPlus = seulsNat.filter(e => e.g === 'TEXT' && e.L === 'COTES');
    const restants = seulsNat.filter(e => !enPlus.includes(e));
    if (!seulsNav.length && !restants.length && okEntete) {
      justes++;
      console.log(`juste   ${nom} : ${A.length} entités${enPlus.length ? `, ${enPlus.length} en plus côté natif (${enPlus.map(e => e.t).slice(0, 8).join(', ')})` : ''}`);
    } else {
      faux++;
      console.log(`ÉCART   ${nom} : ${A.length}/${B.length} entités, ${seulsNav.length} seules navigateur, ${seulsNat.length} seules natif${okEntete ? '' : ', en-tête différent'}`);
      if (compte.length) console.log('   comptes : ' + compte.join(' ; '));
      seulsNav.slice(0, 8).forEach(e => console.log('   nav   ' + JSON.stringify(e).slice(0, 200)));
      seulsNat.slice(0, 8).forEach(e => console.log('   natif ' + JSON.stringify(e).slice(0, 200)));
    }
    for (const ext of ['svg', 'pdf']) if (!fs.existsSync(base + '-natif.' + ext) || fs.statSync(base + '-natif.' + ext).size < 500) { faux++; console.log(`ÉCART   ${nom} : ${ext} absent`); }
  }
  // L'import : un fichier qui passe par toutes les sortes d'entités, puis le plan et le DXF ressortis comparés
  const essai = path.join(dossier, 'essai-import.dxf');
  const L = (...a) => a.join('\r\n') + '\r\n';
  const E = (t, ...p) => L(0, t, ...p);
  fs.writeFileSync(essai,
    E('SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 4) + E('ENDSEC') +
    E('SECTION', 2, 'BLOCKS') +
    E('BLOCK', 8, '0', 2, 'BOU', 70, 0, 10, 5, 20, 5) + E('CIRCLE', 8, '0', 10, 5, 20, 5, 40, 2) + E('LINE', 8, '0', 6, 'DASHED', 10, 3, 20, 5, 11, 7, 21, 5) + E('ENDBLK') + E('ENDSEC') +
    E('SECTION', 2, 'ENTITIES') +
    E('LINE', 8, 'A', 10, 0, 20, 0, 11, 100, 21, 0) +
    E('LINE', 8, 'A', 6, 'HIDDEN', 10, 0, 20, 10, 11, 100, 21, 10) +
    E('CIRCLE', 8, 'A', 10, 20, 20, 30, 40, 8) +
    E('CIRCLE', 8, 'A', 10, 80, 20, 30, 40, 6, 230, -1) +
    E('ARC', 8, 'A', 10, 50, 20, 30, 40, 12, 50, 30, 51, 150) +
    E('LWPOLYLINE', 8, 'A', 70, 1, 90, 4, 10, 0, 20, 50, 42, 0.5, 10, 30, 20, 50, 10, 30, 20, 70, 42, -0.3, 10, 0, 20, 70) +
    E('POLYLINE', 8, 'A', 66, 1, 70, 0) + E('VERTEX', 8, 'A', 10, 40, 20, 50, 42, 1) + E('VERTEX', 8, 'A', 10, 60, 20, 50) + E('VERTEX', 8, 'A', 10, 60, 20, 70) + E('SEQEND', 8, 'A') +
    E('ELLIPSE', 8, 'A', 10, 80, 20, 60, 11, 15, 21, 5, 40, 0.5, 41, 0, 42, 6.283185) +
    E('SPLINE', 8, 'A', 71, 3, 72, 8, 73, 4, 40, 0, 40, 0, 40, 0, 40, 0, 40, 1, 40, 1, 40, 1, 40, 1, 10, 0, 20, 80, 10, 20, 20, 100, 10, 40, 20, 60, 10, 60, 20, 80) +
    E('INSERT', 8, 'A', 2, 'BOU', 10, 90, 20, 90, 41, 2, 42, 2, 50, 30) +
    E('INSERT', 8, 'A', 2, 'ABSENT', 10, 0, 20, 0) +
    E('POINT', 8, 'A', 10, 1, 20, 1) +
    E('LINE', 8, 'COTATIONS', 10, 0, 20, 0, 11, 10, 21, 10) +
    E('DIMENSION', 8, 'A', 70, 32, 10, 50, 20, -10, 13, 0, 23, 0, 14, 100, 24, 0, 50, 0) +
    E('DIMENSION', 8, 'A', 70, 1, 10, 50, 20, -20, 13, 0, 23, 0, 14, 100, 24, 10) +
    E('DIMENSION', 8, 'A', 70, 4, 10, 20, 20, 30, 15, 28, 25, 30, 11, 35, 21, 35) +
    E('DIMENSION', 8, 'A', 70, 3, 10, 12, 20, 30, 15, 28, 25, 30, 11, 5, 21, 40) +
    E('DIMENSION', 8, 'A', 70, 2, 10, 1, 20, 1) +
    E('ENDSEC') + E('EOF'));
  const sansIds = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'id' || k === 'vid' || k === 'sel' ? undefined : v)));
  const proches = (a, b, ch, out) => {
    if (out.length > 12) return;
    if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-5) out.push(`${ch} : ${a} / ${b}`); return; }
    if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) proches(a[k], b[k], ch + '.' + k, out); return; }
    if ((a ?? null) !== (b ?? null)) out.push(`${ch} : ${JSON.stringify(a)} / ${JSON.stringify(b)}`.slice(0, 200));
  };
  {
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-pe-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__MEP_TEST_HOOKS__ = true; });
    await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 120000 });
    await page.evaluate(() => { window.__d = doc; });
    const f = path.join(EX, 'Griffe.conceptcad');
    await page.setInputFiles('#fileProj', f);
    await page.waitForFunction(() => doc && doc !== window.__d, null, { timeout: 60000 });
    await attendre(2500);
    await page.evaluate(() => { mepSetActive(true); doc.mep.cur = 0; window.mepThemeApply(); });
    await attendre(4000);
    const [choix] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => window.mepImportDxf())]);
    await choix.setFiles(essai);
    await page.waitForFunction(() => doc.mep.sheets[0].views.some(v => v.kind === 'dxf'), null, { timeout: 20000 });
    await attendre(1500);
    const nav = await page.evaluate(async () => {
      window.mepThemeApply();
      await new Promise(r => setTimeout(r, 1500));
      const g = document.getElementById('mepGSheet');
      for (const el of g.ownerSVGElement.querySelectorAll('line,rect,circle,path,polyline,polygon')) {
        const m = /^calc\(([\d.]+)px\)$/.exec(getComputedStyle(el).strokeWidth);
        if (m) el.style.strokeWidth = m[1] + 'px';
      }
      const sh = doc.mep.sheets[0];
      return { vue: sh.views.find(v => v.kind === 'dxf'), dims: sh.dims.slice(-4), dxf: window.mepDxfBuild().text };
    });
    await ctx.close();
    const base = path.join(dossier, 'import');
    fs.writeFileSync(base + '-nav.dxf', nav.dxf);
    fs.writeFileSync(base + '-etapes.json', JSON.stringify([{ atelier: 'plan' }, { plan: { importerDxf: essai } }, { plan: { exporter: 'dxf', fichier: base + '-natif.dxf' } }, { capture: 'import' }]));
    const r = spawnSync(EXE, ['--essai-esquisse', f, '-2', base + '-sortie.conceptcad', base + '-etapes.json', dossier], { timeout: 280000 });
    if (r.status !== 0) { faux++; console.log(`ÉCART   import : code ${r.status}`); }
    else {
      let b = fs.readFileSync(base + '-sortie.conceptcad');
      if (b[0] === 0x1f) b = require('zlib').gunzipSync(b);
      const j = JSON.parse(b.toString('utf8'));
      const sh = (j.doc || j).mep.sheets[0];
      const out = [];
      proches(sansIds(nav.vue), sansIds(sh.views.find(v => v.kind === 'dxf')), 'vue', out);
      proches(sansIds(nav.dims), sansIds(sh.dims.slice(-4)), 'cotes', out);
      const [sn, sm] = apparier(lire(nav.dxf), lire(fs.readFileSync(base + '-natif.dxf', 'utf8')));
      const smv = sm.filter(e => !(e.g === 'TEXT' && e.L === 'COTES'));
      if (out.length || sn.length || smv.length) {
        faux++;
        console.log(`ÉCART   import : ${out.length} dans le plan, ${sn.length}/${smv.length} entités`);
        out.forEach(l => console.log('   ' + l));
        sn.slice(0, 6).forEach(e => console.log('   nav   ' + JSON.stringify(e).slice(0, 180)));
        smv.slice(0, 6).forEach(e => console.log('   natif ' + JSON.stringify(e).slice(0, 180)));
      } else {
        justes++;
        console.log(`juste   import : ${nav.vue.dxf.n} éléments, ignorés ${JSON.stringify(nav.vue.dxf.skipped)}`);
      }
    }
  }
  sv.kill();
  console.log(`${justes} justes, ${faux} écarts`);
  process.exit(faux ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
