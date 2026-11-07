// Les composants normalisés : toutes les combinaisons de la fenêtre, comparées au navigateur (clé, nom, cotes, contrôles, document écrit).
// node tester-normalises.cjs <dossier de travail> --racine=<dépôt à la bonne version> [--cats=iso,ansi]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossier = path.resolve(process.argv[2]);
const RACINE = path.resolve(opt('racine', path.join(__dirname, '..', '..')));
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const CATS = opt('cats', '').split(',').filter(Boolean);
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(dossier, { recursive: true });

// Identifiants tirés au hasard : on les remplace par leur rang
function normaliserDoc(d) {
  const t = {};
  (d.sketches || []).forEach((s, i) => { t[s.id] = 'S' + i; });
  (d.features || []).forEach((s, i) => { t[s.id] = 'F' + i; });
  const walk = v => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k]); return o; }
    return typeof v === 'string' && t[v] ? t[v] : v;
  };
  return walk(d);
}
// Dernier chiffre d'une tangente (bibliothèques différentes) : 1e-14 mm, sans effet sur la pièce
const arrondi = s => s.replace(/\d+\.\d{10,}/g, v => (+v).toFixed(9));
function ecart(a, b, ch, out) {
  if (out.length > 6) return;
  if (typeof a === 'string' && typeof b === 'string') { a = arrondi(a); b = arrondi(b); }
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a))) out.push(`${ch} : ${a} / ${b}`); return; }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (a !== b) out.push(`${ch} : ${JSON.stringify(a)} / ${JSON.stringify(b)}`); return; }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(ch + ' : tableau / objet'); return; }
  const ka = Object.keys(a), kb = Object.keys(b);
  for (const k of new Set([...ka, ...kb])) {
    if (!(k in a)) { if (b[k] !== undefined && b[k] !== null) out.push(`${ch}.${k} : absent / ${JSON.stringify(b[k]).slice(0, 80)}`); continue; }
    if (!(k in b)) { if (a[k] !== undefined && a[k] !== null) out.push(`${ch}.${k} : ${JSON.stringify(a[k]).slice(0, 80)} / absent`); continue; }
    ecart(a[k], b[k], ch + '.' + k, out);
  }
}
(async () => {
  const port = 5200 + (process.pid % 400);
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-no-')), { channel: 'chrome', headless: true, viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
  await page.waitForFunction(() => typeof stdSpec === 'function', null, { timeout: 120000 });
  const lesCats = await page.evaluate(() => { const L = STD_CATS.map(c => c.k); return L; });
  const cats = CATS.length ? CATS : lesCats;
  let total = 0, justes = 0, ecarts = 0;
  for (const cat of cats) {
    const ref = await page.evaluate(cat => {
      const C = STD_CATS.find(c => c.k === cat), etats = [];
      const walk = (i, st) => {
        if (i === C.fields.length) { etats.push(st); return; }
        const f = C.fields[i];
        if (f.show && !f.show(st)) { walk(i + 1, st); return; }
        for (const o of f.opts(st)) walk(i + 1, Object.assign({}, st, { [f.k]: o[0] }));
      };
      walk(0, {});
      // Quelques valeurs libres ou fausses, pour la remise en ordre et les refus
      const extra = [{}, { type: 'xxx' }];
      if (cat === 'gear') extra.push({ kind: 'ext', m: '3,5', z: '17.4', beta: '12', x: 'abc', b: '-3', d: '100' }, { kind: 'ext', m: '2', z: '20', d: '12', kw: 'iso' }, { kind: 'ext', m: '2', z: '20', d: '36.9', kw: 'iso' }, { kind: 'int', m: '2', z: '50', D: '10' }, { kind: 'rack', m: '1.5', z: '15', H: '1', beta: '20', hand: 'L', j: '0.1', ks: '0.2' });
      if (cat === 'gearPair') extra.push({ kind: 'int', m: '2', z1: '20', z2: '25' }, { kind: 'int', m: '2', z1: '40', z2: '30' }, { kind: 'ext', m: '2', z1: '8', z2: '9', x1: '-1', x2: '-1' }, { kind: 'ext', m: '3', z1: '17', z2: '31', x1: '0.4', x2: '0.1', jn: '0', d1: '20', d2: '40' });
      if (cat === 'magnet') extra.push({ shape: 'ring' }, { shape: 'box', grade: 'zz' });
      etats.push(...extra);
      const out = etats.map(st => {
        const r = {}; const e = stdNormState(cat, st);
        r.opts = {};
        C.fields.forEach(f => { if (!f.show || f.show(e)) r.opts[f.k] = f.opts(e); });
        try {
          const sp = stdSpec(cat, st);
          const p = { key: sp.key, norm: sp.norm, desig: sp.desig, name: sp.name, info: sp.info, seat: sp.seat || '', sink: sp.sink || 0, reach: sp.reach || 0, etat: sp.st, checks: (sp.checks || []).map(c => [c.lvl === 'ok', c.txt]) };
          if (sp.pair) p.paire = sp.pair.map(m => ({ key: m.sp.key, fr: m.fr, doc: stdDoc(m.sp) }));
          else { p.doc = stdDoc(sp); p.paire = []; }
          r.p = p;
        } catch (x) { r.err = x.message; r.etat = e; }
        return r;
      });
      return { etats, out };
    }, cat);
    const fCas = path.join(dossier, `cas-${cat}.json`), fRes = path.join(dossier, `res-${cat}.json`);
    fs.writeFileSync(fCas, JSON.stringify(ref.etats.map(st => ({ cat, st }))));
    const r = spawnSync(EXE, ['--normalises', fCas, fRes], { timeout: 280000 });
    if (r.status !== 0) { console.log(`ÉCART ${cat} : le programme sort en code ${r.status}`); ecarts++; continue; }
    const nat = JSON.parse(fs.readFileSync(fRes, 'utf8'));
    let eCat = 0;
    ref.out.forEach((a, i) => {
      total++;
      const b = nat[i], o = [];
      if (a.p && a.p.doc) a.p.doc = normaliserDoc(JSON.parse(JSON.stringify(a.p.doc)));
      if (b.p && b.p.doc) b.p.doc = normaliserDoc(b.p.doc);
      if (a.p) for (const q of a.p.paire || []) q.doc = normaliserDoc(JSON.parse(JSON.stringify(q.doc)));
      if (b.p) for (const q of b.p.paire || []) q.doc = normaliserDoc(q.doc);
      ecart(JSON.parse(JSON.stringify(a)), b, '', o);
      if (o.length) {
        eCat++;
        if (eCat <= 6) console.log(`ÉCART ${cat} ${JSON.stringify(ref.etats[i])} (nav / natif)\n   ` + o.join('\n   '));
      } else justes++;
    });
    ecarts += eCat;
    console.log(`${cat} : ${ref.out.length} combinaisons, ${eCat} écarts`);
  }
  console.log(`${total} combinaisons : ${justes} justes, ${ecarts} écarts`);
  await ctx.close();
  sv.kill();
  process.exit(ecarts ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
