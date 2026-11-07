// La mise en plan : les éléments de chaque planche, navigateur et natif, un par un.
// node mesures/tester-plan.cjs <dossier> --racine=D:/ConceptCAD [--pieces=A,B] [--sans=mepAxis,mepDim]
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossier = path.resolve(process.argv[2]);
const RACINE = opt('racine', path.resolve(__dirname, '..', '..'));
const EX = path.resolve(__dirname, '..', '..', 'Exemples');
const EXE = path.resolve(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const PIECES = opt('pieces', 'Barquette,Cache Piles,Cavité Usinage,Crochet,Goupille,Griffe,Malaxeur Retard,Perçages,Support Pédale Déportée R1200RT 2011').split(',');
const SANS = opt('sans', '').split(',').filter(Boolean);
const IGNORE = new Set(['textLength', 'lengthAdjust', 'data-fit']);
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(dossier, { recursive: true });
const numerique = s => /^-?\d+(\.\d+)?(e-?\d+)?$/.test(s);
// Les nombres dans une valeur d'attribut, à tol près
function memeValeur(a, b, tol) {
  if (a === b) return true;
  const ra = /-?\d+(?:\.\d+)?(?:e-?\d+)?/g;
  const na = String(a).match(ra) || [], nb = String(b).match(ra) || [];
  if (na.length !== nb.length) return false;
  if (String(a).replace(ra, '#') !== String(b).replace(ra, '#')) return false;
  return na.every((x, i) => Math.abs(+x - +nb[i]) <= tol);
}
// Ce qui dépend de la largeur d'un texte : Chrome la mesure à sa taille d'écran, elle varie de quelques microns
const tolDe = x => /mepDim/.test(x.at.class || '') ? 0.02 : 0.0021;
function memeElt(a, b, tol) {
  if (a.tag !== b.tag || (a.txt || '') !== (b.txt || '')) return false;
  const ka = Object.keys(a.at).filter(k => !IGNORE.has(k) && k !== 'href'), kb = Object.keys(b.at).filter(k => !IGNORE.has(k) && k !== 'href');
  if (ka.length !== kb.length) return false;
  return ka.every(k => k in b.at && memeValeur(a.at[k], b.at[k], tol));
}
const garde = e => !SANS.some(s => (e.at.class || '').includes(s)) && !(e.tag === 'tspan' && SANS.includes('mepDim'));

(async () => {
  const port = 5200 + (process.pid % 400);
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  let planches = 0, justes = 0, totalE = 0, ecarts = 0;
  for (const nom of PIECES) {
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-pl-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 120000 });
    await page.evaluate(() => { window.__d = doc; });
    const f = path.join(EX, nom + '.conceptcad');
    await page.setInputFiles('#fileProj', f);
    await page.waitForFunction(() => doc && doc !== window.__d, null, { timeout: 60000 });
    await attendre(2500);
    const nav = await page.evaluate(async () => {
      mepSetActive(true);
      await new Promise(r => setTimeout(r, 300));
      const res = [];
      const n = doc.mep.sheets.length;
      // Perspective : pas encore au programme du natif
      doc.mep.sheets.forEach(s => { s.views = s.views.filter(v => !(v.persp && v.kind === 'base' && !v.section && !v.detail)); });
      for (let i = 0; i < n; i++) {
        doc.mep.cur = i;
        window.mepThemeApply();
        await new Promise(r => setTimeout(r, 100));
        const g = document.getElementById('mepGSheet');
        // Les grosses vues se calculent en différé : attendre que la feuille ne bouge plus
        for (let essai = 0, avant = -1, stable = 0; essai < 120 && stable < 4; essai++) {
          await new Promise(r => setTimeout(r, 500));
          window.mepThemeApply();
          const n2 = g.querySelectorAll('*').length;
          stable = n2 === avant ? stable + 1 : 0;
          avant = n2;
        }
        const L = [];
        const lire = (el) => {
          const at = {};
          for (const a of el.attributes) at[a.name] = a.value;
          const enf = Array.from(el.children);
          L.push({ tag: el.tagName, at, txt: Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('') });
          enf.forEach(lire);
        };
        Array.from(g.children).forEach(lire);
        res.push(L);
      }
      return res;
    });
    await ctx.close();
    const fs2 = path.join(dossier, nom + '-natif.json');
    fs.writeFileSync(path.join(dossier, nom + '-nav.json'), JSON.stringify(nav));
    const t0 = Date.now();
    const r = spawnSync(EXE, ['--plan', f, fs2], { timeout: 280000 });
    const ms = Date.now() - t0;
    if (r.status !== 0 || !fs.existsSync(fs2)) { ecarts++; console.log(`ÉCART   ${nom} : code ${r.status}`); continue; }
    const nat = JSON.parse(fs.readFileSync(fs2, 'utf8'));
    nav.forEach((Ln, i) => {
      planches++;
      const A = Ln.filter(e => garde(e) && !(e.tag === 'image')), B = (nat[i] || []).filter(e => garde(e) && !(e.tag === 'image'));
      totalE += A.length;
      // Dans l'ordre ; à défaut, le même élément ailleurs
      const reste = B.slice();
      let e = 0, memeOrdre = 0;
      const exemples = [];
      A.forEach((x, k) => {
        if (B[k] && memeElt(x, B[k], tolDe(x))) memeOrdre++;
        const j = reste.findIndex(y => memeElt(x, y, tolDe(x)));
        if (j >= 0) reste.splice(j, 1);
        else { e++; if (exemples.length < 6) exemples.push('nav   ' + JSON.stringify(x).slice(0, 170)); }
      });
      reste.slice(0, 6).forEach(y => exemples.push('natif ' + JSON.stringify(y).slice(0, 170)));
      const tot = e + reste.length;
      ecarts += tot;
      if (!tot) justes++;
      console.log(`${tot ? 'ÉCART ' : 'pareil'}  ${nom} planche ${i + 1} : ${A.length} éléments navigateur, ${B.length} natif, ${e} sans pareil, ${reste.length} en trop, ${memeOrdre} au même rang (${ms} ms)`);
      if (tot) exemples.forEach(x => console.log('   ' + x));
    });
  }
  console.log(`${planches} planches : ${justes} justes, ${ecarts} écarts sur ${totalE} éléments`);
  sv.kill();
  process.exit(ecarts ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
