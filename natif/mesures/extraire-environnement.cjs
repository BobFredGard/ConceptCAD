// Recopie depuis le navigateur les boutons de l'environnement (ruban de chaque mode, barre du haut, fil des fonctions, arbre) :
// noms, infobulles, ordre, séparations et icônes. Écrit natif/src/environnement_donnees.inc : rien n'est retapé à la main.
// node natif/mesures/extraire-environnement.cjs
'use strict';
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os');
const { spawn } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const attendre = ms => new Promise(r => setTimeout(r, ms));
const portLibre = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const large = s => 'L"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"';
const brut = s => 'R"~~~(' + s + ')~~~"';
(async () => {
  const port = await portLibre();
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore', cwd: RACINE });
  let ctx;
  try {
    await attendre(800);
    ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-env-')), { channel: 'chrome', headless: true, viewport: { width: 1500, height: 900 } });
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto('http://127.0.0.1:' + port + '/ConceptCAD.html');
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && (occtReady === true || /échec|indisponible/.test(occBaseMsg)), null, { timeout: 300000 });
    await page.waitForFunction(() => !skEdit && rebuildDepth === 0);
    await page.setInputFiles('#fileProj', path.join(RACINE, 'Exemples', '003-50-200-O-Drapeau Outillage Complet.conceptcad'));
    await page.waitForFunction(() => doc && (doc.features || []).length && bodies.some(b => b.shape), null, { timeout: 200000 });
    await page.waitForFunction(() => rebuildDepth === 0);
    await attendre(1000);
    const ruban = () => page.evaluate(() => {
      const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; };
      const out = [];
      let dernier = null, xFin = 0;
      for (const b of document.querySelectorAll('#mfRibbon .mfRb')) {
        if (!vis(b)) continue;
        const r = b.getBoundingClientRect(), s = b.querySelector('svg');
        // Ce qui se lit à l'écran : la dernière ligne, car les icônes à badge (DXF, SVG, PDF) répètent leur nom au-dessus
        const texte = b.innerText.trim().split('\n').pop().trim();
        const coul = b.classList.contains('mfIcR') ? '#ff453a' : b.classList.contains('mfIcG') ? '#30d158' : b.classList.contains('mfIcB') ? '#0a84ff' : '';
        // un groupe nouveau : plus d'écart que deux boutons voisins, ou nouvelle rangée
        const groupe = dernier !== null && (r.x - xFin > 6 || r.y !== dernier);
        out.push({ texte, titre: b.title, svg: s ? s.outerHTML : '', couleur: coul, groupe });
        dernier = r.y; xFin = r.right;
      }
      return out;
    });
    const modes = {};
    modes.cao = await ruban();
    const hauts = await page.evaluate(() => [...document.querySelectorAll('.topbar button, #mfThemeBtn')].filter(b => b.getBoundingClientRect().width > 0 && b.querySelector('svg')).map(b => ({ titre: b.title, svg: b.querySelector('svg').outerHTML })));
    const fil = await page.evaluate(() => [...document.querySelectorAll('#mfTl svg')].map(s => s.outerHTML));
    const arbre = await page.evaluate(() => [...document.querySelectorAll('#tree svg')].map(s => ({ svg: s.outerHTML, ligne: (s.closest('.ti,.item,div') || {}).textContent ? s.closest('div').textContent.trim().slice(0, 30) : '' })));
    const vueBoutons = await page.evaluate(() => ['btnRender', 'btnLive'].map(i => { const s = document.querySelector('#' + i + ' svg'); return { id: i, titre: document.getElementById(i).title, svg: s ? s.outerHTML : '' }; }));
    for (const m of ['FAO', 'PLAN', 'RENDU']) {
      await page.locator('.topbar').getByText(m, { exact: true }).first().click();
      await attendre(2000);
      modes[m.toLowerCase()] = await ruban();
    }
    let o = '// Généré par mesures/extraire-environnement.cjs depuis le navigateur. Ne pas modifier à la main.\n';
    const table = (nom, l) => {
      o += `const FicheRuban ${nom}[] = {\n`;
      l.forEach(b => { o += `  {${large(b.texte)}, ${large(b.titre)}, ${brut(b.svg)}, ${large(b.couleur)}, ${b.groupe ? 'true' : 'false'}},\n`; });
      o += '  {nullptr, nullptr, nullptr, nullptr, false}};\n';
    };
    table('RUBAN_CAO', modes.cao); table('RUBAN_FAO', modes.fao); table('RUBAN_PLAN', modes.plan);
    o += 'const FicheHaut BARRE_HAUTE[] = {\n';
    hauts.forEach(b => { o += `  {${large(b.titre)}, ${brut(b.svg)}},\n`; });
    o += '  {nullptr, nullptr}};\n';
    o += 'const FicheHaut BOUTONS_VUE[] = {\n';
    vueBoutons.forEach(b => { o += `  {${large(b.titre)}, ${brut(b.svg)}},\n`; });
    o += '  {nullptr, nullptr}};\n';
    fs.writeFileSync(path.join(__dirname, '..', 'src', 'environnement_donnees.inc'), o);
    fs.writeFileSync(process.argv[2] || path.join(os.tmpdir(), 'env-extrait.json'), JSON.stringify({ modes, hauts, fil, arbre, vueBoutons }, null, 1));
    console.log('CAO', modes.cao.length, 'FAO', modes.fao.length, 'PLAN', modes.plan.length, 'RENDU', modes.rendu.length, 'haut', hauts.length, 'fil', fil.length, 'arbre', arbre.length);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    serveur.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
