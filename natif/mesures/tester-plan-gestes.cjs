// La mise en plan à la souris : les mêmes gestes dans le navigateur et dans le programme natif, puis le plan enregistré comparé.
// node mesures/tester-plan-gestes.cjs <dossier> --racine=D:/ConceptCAD [--pieces=A,B]
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), z = require('zlib');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossier = path.resolve(process.argv[2]);
const RACINE = opt('racine', path.resolve(__dirname, '..', '..'));
const EX = opt('dossier', path.resolve(__dirname, '..', '..', 'Exemples'));
const EXE = path.resolve(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const PIECES = opt('pieces', 'Perçages,Crochet,Cache Piles,Griffe').split(',');
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(dossier, { recursive: true, force: true });
fs.mkdirSync(dossier, { recursive: true });

const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = z.gunzipSync(b); const j = JSON.parse(b.toString('utf8')); return j.doc || j; };
function ecart(a, b, ch, out) {
  if (out.length > 10) return;
  const creux = x => x === undefined || x === null || x === false;
  if (creux(a) && creux(b)) return;
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 0.02) out.push(`${ch} : ${a} / ${b}`); return; }
  if (creux(a) || creux(b) || typeof a !== 'object' || typeof b !== 'object') { if (a !== b) out.push(`${ch} : ${JSON.stringify(a)} / ${JSON.stringify(b)}`.slice(0, 200)); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) ecart(a[k], b[k], ch + '.' + k, out);
}
// Ce que les gestes changent
const resume = mep => mep.sheets.map(s => ({
  views: (s.views || []).map(v => ({ id: v.id, x: v.x, y: v.y, ttl: v.ttl, sh: v.section && v.section.sh, a: v.section && v.section.a, b: v.section && v.section.b })),
  dims: Object.fromEntries((s.dims || []).map(d => [d.id, d])),
  balloons: s.balloons || [],
}));

// Dans la page : passer des mm aux pixels entiers, et revenir aux mm exacts que le navigateur verra
const AIDE = () => {
  const svg = () => document.getElementById('mepGSheet').ownerSVGElement;
  window.__px = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(svg().getScreenCTM()); return [Math.round(q.x), Math.round(q.y)]; };
  window.__mm = (px, py) => { const q = new DOMPoint(px, py).matrixTransform(svg().getScreenCTM().inverse()); return [q.x, q.y]; };
};

class Geste {
  constructor(page) { this.page = page; this.etapes = [{ atelier: 'plan' }]; }
  async mm(px, py) { return this.page.evaluate(([a, b]) => window.__mm(a, b), [px, py]); }
  async px(x, y) { return this.page.evaluate(([a, b]) => window.__px(a, b), [x, y]); }
  async presse(px, py) {
    await this.page.mouse.move(px, py);
    await this.page.mouse.down();
    this.etapes.push({ plan: { presse: await this.mm(px, py) } });
  }
  async glisse(px, py) {
    await this.page.mouse.move(px, py);
    this.etapes.push({ plan: { glisse: await this.mm(px, py) } });
  }
  async lache() {
    await this.page.mouse.up();
    this.etapes.push({ plan: { lache: 1 } });
    await attendre(30);
  }
  async glisser(p0, p1) {
    await this.presse(p0[0], p0[1]);
    await this.glisse(Math.round((p0[0] + p1[0]) / 2), Math.round((p0[1] + p1[1]) / 2));
    await this.glisse(p1[0], p1[1]);
    await this.lache();
  }
  async clic(p) {
    await this.presse(p[0], p[1]);
    await this.lache();
  }
  async suppr() {
    await this.page.keyboard.press('Delete');
    this.etapes.push({ plan: { touche: 'Suppr' } });
    await attendre(30);
  }
  async annuler() {
    await this.page.keyboard.press('Control+z');
    this.etapes.push({ annuler: 1 });
    await attendre(200);
  }
}

// Un point d'une vue où rien d'autre n'attrape le clic : le clic le dit
async function pointDeVue(g, v) {
  const p = g.page;
  for (let r = 0; r <= 70; r += 4) {
    const n = r ? Math.max(8, Math.round(r / 2)) : 1;
    for (let k = 0; k < n; k++) {
      const x = v.x + r * Math.cos(2 * Math.PI * k / n), y = v.y + r * Math.sin(2 * Math.PI * k / n);
      const q = await g.px(x, y);
      const libre = await p.evaluate(([px, py, id]) => {
        const [a, b] = window.__mm(px, py);
        if (__mepTest.dimAt(a, b)) return false;
        const el = document.elementFromPoint(px, py);
        return !!el && !!el.closest('svg');
      }, [q[0], q[1], v.id]);
      if (!libre) continue;
      await p.mouse.click(q[0], q[1]);
      await attendre(10);
      if (await p.evaluate(id => __mepTest.viewSel() === id, v.id)) return q;
    }
  }
  return null;
}
// Les cotes de la planche, avec l'endroit de leur texte
const lesCotes = page => page.evaluate(() => {
  const r = [], vus = new Set();
  document.querySelectorAll('#mepGSheet text').forEach(t => {
    if (!/mepDimT/.test(t.getAttribute('class') || '')) return;
    const x = +t.getAttribute('x'), y = +t.getAttribute('y');
    const d = __mepTest.dimAt(x, y);
    if (d && !vus.has(d.id)) { vus.add(d.id); r.push({ id: d.id, kind: d.kind, x, y }); }
  });
  return r;
});
const lesTitres = page => page.evaluate(() => {
  const r = [];
  document.querySelectorAll('#mepGSheet text.mepLbl').forEach(t => { if (t.getAttribute('text-anchor') === 'middle') r.push({ x: +t.getAttribute('x'), y: +t.getAttribute('y'), h: 2 }); });
  return r;
});

const SCENARIOS = {
  // Toutes les vues, puis des cotes de chaque sorte, leur texte, un titre, un double-clic
  async glisser(g) {
    const vues = await g.page.evaluate(() => doc.mep.sheets[doc.mep.cur || 0].views.map(v => ({ id: v.id, x: v.x, y: v.y, kind: v.kind })));
    let n = 0;
    for (const v of vues.slice(0, 5)) {
      const courant = await g.page.evaluate(id => { const q = doc.mep.sheets[doc.mep.cur || 0].views.find(w => w.id === id); return { id, x: q.x, y: q.y }; }, v.id);
      const q = await pointDeVue(g, courant);
      if (!q) continue;
      g.etapes.push({ plan: { presse: await g.mm(q[0], q[1]) } }, { plan: { lache: 1 } });
      await g.glisser(q, [q[0] + 17, q[1] + 11]);
      n++;
    }
    const cotes = await lesCotes(g.page);
    const parSorte = {};
    let c = 0;
    for (const d of cotes) {
      parSorte[d.kind] = (parSorte[d.kind] || 0) + 1;
      if (parSorte[d.kind] > 4) continue;
      const q = await g.px(d.x, d.y - 0.6);
      await g.glisser(q, [q[0] + 23, q[1] - 15]);
      c++;
    }
    const titres = await lesTitres(g.page);
    let t = 0;
    for (const u of titres.slice(0, 2)) {
      const q = await g.px(u.x, u.y - 1);
      await g.glisser(q, [q[0], q[1] + 20]);
      t++;
    }
    const encore = await lesCotes(g.page);
    let dbl = 0;
    for (const d of encore.filter(e => ['len', 'dist', 'ang'].includes(e.kind)).slice(0, 3)) {
      const q = await g.px(d.x, d.y - 0.6);
      await g.clic(q);
      await g.clic(q);
      await attendre(600);
      dbl++;
    }
    return `${n} vues, ${c} cotes, ${t} titres, ${dbl} doubles-clics`;
  },
  // Supprimer une cote, une vue, annuler, le cadre de sélection
  async supprimer(g) {
    let bilan = '';
    const cotes = await lesCotes(g.page);
    if (cotes.length) {
      const q = await g.px(cotes[0].x, cotes[0].y - 0.6);
      await g.clic(q);
      await g.suppr();
      bilan += 'cote ';
    }
    if (cotes.length > 1) {
      const q = await g.px(cotes[1].x, cotes[1].y - 0.6);
      await g.clic(q);
      await g.suppr();
      await g.annuler();
      bilan += 'cote annulée ';
    }
    const vues = await g.page.evaluate(() => doc.mep.sheets[doc.mep.cur || 0].views.map(v => ({ id: v.id, x: v.x, y: v.y })));
    if (vues.length > 1) {
      const v = vues[vues.length - 1];
      const q = await pointDeVue(g, v);
      if (q) {
        g.etapes.push({ plan: { presse: await g.mm(q[0], q[1]) } }, { plan: { lache: 1 } });
        await g.suppr();
        bilan += 'vue ';
      }
    }
    if (vues.length > 1) {
      // Le cadre, de droite à gauche, sur la moitié de la feuille, depuis un endroit vide
      const f = await g.page.evaluate(() => { const b = document.getElementById('mepGSheet').ownerSVGElement.viewBox.baseVal; return [b.x, b.y, b.width, b.height]; });
      const dep = await g.px(f[0] + 7, f[1] + 7), arr = await g.px(f[0] + f[2] * 0.45, f[1] + f[3] * 0.55);
      await g.glisser(arr, dep);
      await g.suppr();
      bilan += 'cadre ';
    }
    return bilan;
  },
};

(async () => {
  const port = 5200 + (process.pid % 400);
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  let justes = 0, faux = 0;
  for (const nom of PIECES) {
    for (const [scen, jouer] of Object.entries(SCENARIOS)) {
      const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-pg-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
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
      await page.evaluate(async () => {
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
      });
      await page.evaluate(AIDE);
      const g = new Geste(page);
      const bilan = await jouer(g);
      await attendre(300);
      const nav = await page.evaluate(() => JSON.parse(JSON.stringify(doc.mep)));
      await ctx.close();
      const base = path.join(dossier, nom + '-' + scen);
      fs.writeFileSync(base + '-etapes.json', JSON.stringify(g.etapes));
      fs.writeFileSync(base + '-nav.json', JSON.stringify(nav));
      const sortie = base + '-natif.conceptcad';
      const r = spawnSync(EXE, ['--essai-esquisse', f, '-2', sortie, base + '-etapes.json', dossier], { timeout: 280000 });
      if (r.status !== 0 || !fs.existsSync(sortie)) { faux++; console.log(`ÉCART   ${nom} ${scen} : code ${r.status}`); continue; }
      const out = [];
      ecart(resume(nav), resume(lire(sortie).mep), 'plan', out);
      if (out.length) {
        faux++;
        console.log(`ÉCART   ${nom} ${scen} (${bilan}) :`);
        out.forEach(l => console.log('   ' + l));
      } else {
        justes++;
        console.log(`juste   ${nom} ${scen} (${bilan})`);
      }
    }
  }
  sv.kill();
  console.log(`${justes} justes, ${faux} écarts`);
  process.exit(faux ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
