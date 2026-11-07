// La mise en plan, le ruban : planches et nouvelles vues, les mêmes clics dans le navigateur et dans le programme natif, puis le plan comparé.
// node mesures/tester-plan-commandes.cjs <dossier> --racine=D:/ConceptCAD [--pieces=A,B] [--scenarios=a,b]
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), z = require('zlib');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossier = path.resolve(process.argv[2]);
const RACINE = opt('racine', path.resolve(__dirname, '..', '..'));
const EX = opt('dossier', path.resolve(__dirname, '..', '..', 'Exemples'));
const EXE = path.resolve(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const PIECES = opt('pieces', 'Perçages,Crochet,Griffe').split(',');
const FILTRE = opt('scenarios', '');
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(dossier, { recursive: true, force: true });
fs.mkdirSync(dossier, { recursive: true });

const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = z.gunzipSync(b); const j = JSON.parse(b.toString('utf8')); return j.doc || j; };
function ecart(a, b, ch, out) {
  if (out.length > 14) return;
  const creux = x => x === undefined || x === null || x === false || x === '' || (Array.isArray(x) && !x.length);
  if (creux(a) && creux(b)) return;
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 0.02) out.push(`${ch} : ${a} / ${b}`); return; }
  if (creux(a) || creux(b) || typeof a !== 'object' || typeof b !== 'object') { if (a !== b) out.push(`${ch} : ${JSON.stringify(a)} / ${JSON.stringify(b)}`.slice(0, 200)); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) ecart(a[k], b[k], ch + '.' + k, out);
}
// Les identifiants portent l'heure : on les remplace par le rang
function resume(mep) {
  const sans = o => { if (Array.isArray(o)) return o.map(sans); if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) if (k[0] !== '_') r[k] = sans(o[k]); return r; } return o; };
  const m = sans(mep);
  for (const s of m.sheets) {
    delete s.id;
    const ids = {};
    (s.views || []).forEach((v, i) => { ids[v.id] = 'v#' + i; });
    const rang = x => (ids[x] !== undefined ? ids[x] : x);
    for (const v of s.views || []) {
      v.id = rang(v.id);
      v.parent = rang(v.parent);
      if (v.section) v.section.pid = rang(v.section.pid);
      if (v.auxEdge) v.auxEdge.pid = rang(v.auxEdge.pid);
      delete v.axes;
    }
    // La forme de l'entité que la page mémorise quand elle en a le temps
    for (const d of s.dims || []) for (const c of ['a', 'b', 'c']) if (d[c] && d[c].hint) { delete d[c].hint.s; if (d[c].hint.t === 'ctr') delete d[c].hint.i; }
    const cotes = {};
    (s.dims || []).forEach((d, i) => { d.vid = rang(d.vid); if (d.vid2) d.vid2 = rang(d.vid2); delete d.id; cotes[i] = d; });
    s.dims = cotes;
  }
  return { cur: m.cur, sheets: m.sheets };
}
const AIDE = () => {
  const svg = () => document.getElementById('mepGSheet').ownerSVGElement;
  window.__px = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(svg().getScreenCTM()); return [Math.round(q.x), Math.round(q.y)]; };
  window.__mm = (px, py) => { const q = new DOMPoint(px, py).matrixTransform(svg().getScreenCTM().inverse()); return [q.x, q.y]; };
  // La vue la plus grande, sa boîte sur la feuille et ses arêtes droites
  window.__vue = (id) => {
    const sh = doc.mep.sheets[doc.mep.cur || 0];
    const mesurer = v => {
      const g = __mepTest.geo(v);
      if (!g || !g.els) return null;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const pts = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
      const L = [];
      for (const e of g.els) {
        if (e.t === 'L') { pts(e.x1, e.y1); pts(e.x2, e.y2); L.push([e.x1, e.y1, e.x2, e.y2]); }
        else if (e.cx !== undefined) { pts(e.cx - e.r, e.cy - e.r); pts(e.cx + e.r, e.cy + e.r); }
      }
      if (x0 > x1) return null;
      const s = v.scale;
      const f = document.getElementById('mepGSheet').ownerSVGElement.viewBox.baseVal;
      return { sx: v.x + (x0 + x1) / 2 * s < f.x + f.width / 2 ? 1 : -1, sy: v.y + (y0 + y1) / 2 * s < f.y + f.height / 2 ? 1 : -1, id: v.id, kind: v.kind, x: v.x + (x0 + x1) / 2 * s, y: v.y + (y0 + y1) / 2 * s, w: (x1 - x0) * s, h: (y1 - y0) * s, lignes: L.map(l => [v.x + l[0] * s, v.y + l[1] * s, v.x + l[2] * s, v.y + l[3] * s]) };
    };
    if (id) return mesurer(sh.views.find(v => v.id === id));
    let m = null;
    for (const v of sh.views) { if (v.kind === 'detail' || v.kind === 'section') continue; const q = mesurer(v); if (q && (!m || q.w * q.h > m.w * m.h)) m = q; }
    return m;
  };
};

class Essai {
  constructor(page) { this.page = page; this.etapes = [{ atelier: 'plan' }]; }
  async mm(px, py) { return this.page.evaluate(([a, b]) => window.__mm(a, b), [px, py]); }
  async px(x, y) { return this.page.evaluate(([a, b]) => window.__px(a, b), [x, y]); }
  // Un clic en mm : les deux côtés reçoivent exactement le même point
  async clic(x, y) {
    const p = await this.px(x, y);
    const q = await this.mm(p[0], p[1]); // avant le clic : il peut décaler la feuille d'un rien
    await this.page.mouse.move(p[0], p[1]);
    await this.page.mouse.down();
    await this.page.mouse.up();
    this.etapes.push({ plan: { presse: q } }, { plan: { lache: 1 } });
    await attendre(40);
  }
  async bouton(nom, js) {
    await this.page.evaluate(js);
    this.etapes.push({ plan: { bouton: nom } });
    await attendre(6000); // la page refait ses vues exactes en revenant dans l'atelier
  }
  async touche(k, nom) {
    await this.page.keyboard.press(k);
    this.etapes.push({ plan: { touche: nom } });
    await attendre(40);
  }
}

const SCENARIOS = {
  async standard(g) {
    await g.bouton('Face', () => window.mepAddViewStd('front'));
    await g.bouton('ISO', () => window.mepAddViewStd('iso'));
    return 'Face, ISO';
  },
  async projection(g) {
    const v = await g.page.evaluate(() => window.__vue());
    await g.bouton('Projection', () => window.mepBeginProjCmd());
    await g.clic(v.x, v.y);
    await g.clic(v.x + v.sx * (v.w / 2 + 30), v.y);
    await g.clic(v.x, v.y + v.sy * (v.h / 2 + 30));
    await g.clic(v.x + v.sx * (v.w / 2 + 25), v.y + v.sy * (v.h / 2 + 25));
    await g.touche('Escape', 'Echap');
    return 'droite, dessous, diagonale';
  },
  async coupe(g) {
    const v = await g.page.evaluate(() => window.__vue());
    await g.bouton('Coupe', () => window.mepBeginSectionCmd());
    await g.clic(v.x - v.w / 2 - 3, v.y + 0.37);
    await g.clic(v.x + v.w / 2 + 3, v.y + 0.37);
    await g.touche('Enter', 'Entree');
    await g.clic(v.x + 3, v.y + v.sy * (v.h / 2 + 35));
    return 'coupe simple';
  },
  async coupeBrisee(g) {
    const v = await g.page.evaluate(() => window.__vue());
    await g.bouton('Coupe', () => window.mepBeginSectionCmd());
    const y0 = v.y - v.h * 0.13, y1 = v.y + v.h * 0.17, x1 = v.x - v.w * 0.07;
    await g.clic(v.x - v.w / 2 - 3, y0);
    await g.clic(x1, y0);
    await g.clic(x1 + 0.2, y1);
    await g.clic(x1 + 1, y1 + 2); // refusé ou à l'équerre, puis on l'enlève
    await g.touche('Backspace', 'Retour');
    await g.clic(v.x + v.w / 2 + 3, y1);
    await g.touche('Enter', 'Entree');
    await g.clic(v.x - 2, v.y + v.sy * (v.h / 2 + 32));
    return 'coupe brisée';
  },
  async detail(g) {
    const v = await g.page.evaluate(() => window.__vue());
    await g.bouton('Détail', () => window.mepBeginDetailCmd());
    await g.clic(v.x + v.w * 0.2, v.y - v.h * 0.1);
    await g.clic(v.x + v.w * 0.2 + 8, v.y - v.h * 0.1 + 3);
    await g.clic(v.x + v.sx * (v.w / 2 + 30), v.y - v.sy * (v.h / 2 - 5));
    return 'détail';
  },
  async auxiliaire(g) {
    const v = await g.page.evaluate(() => window.__vue());
    const l = v.lignes.slice().sort((a, b) => Math.hypot(b[2] - b[0], b[3] - b[1]) - Math.hypot(a[2] - a[0], a[3] - a[1]))[0];
    await g.bouton('Auxiliaire', () => window.mepBeginAuxCmd());
    await g.clic(l[0] * 0.63 + l[2] * 0.37, l[1] * 0.63 + l[3] * 0.37);
    await g.clic(v.x + v.sx * (v.w / 2 + 28), v.y + v.sy * (v.h / 2 + 28));
    return 'auxiliaire';
  },
  async planches(g) {
    await g.bouton('Nouvelle', () => window.mepAddSheet());
    await g.bouton('Projection', () => window.mepBeginProjCmd());
    await g.touche('Escape', 'Echap');
    await g.bouton('ISO', () => window.mepAddViewStd('iso'));
    await g.bouton('Dupliquer', () => { const t = [...document.querySelectorAll('button')].find(b => /dupliquer/i.test(b.title || '') && /planche/i.test(b.title || '')); if (!t) throw new Error('bouton Dupliquer introuvable'); t.click(); });
    return 'nouvelle, vue, dupliquée';
  },
};

(async () => {
  const port = 5200 + (process.pid % 400);
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  let justes = 0, faux = 0;
  for (const nom of PIECES) {
    for (const [scen, jouer] of Object.entries(SCENARIOS)) {
      if (FILTRE && !FILTRE.split(',').includes(scen)) continue;
      const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-pc-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
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
      await attendre(7000); // le calcul exact des vues finit après l'affichage
      await page.evaluate(AIDE);
      const g = new Essai(page);
      let bilan;
      try { bilan = await jouer(g); } catch (e) { faux++; console.log(`ÉCART   ${nom} ${scen} : navigateur ${e.message}`); await ctx.close(); continue; }
      await attendre(500);
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
