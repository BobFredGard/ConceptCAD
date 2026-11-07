// La pose des pièces normalisées dans un assemblage : insertion, paire, sur des trous, dans une rainure, modifier. Mêmes clics que dans le navigateur, même bloc d'assemblage à la fin.
// node tester-normalises-pose.cjs <dossier de travail> --racine=<dépôt à la bonne version> [--seul=mot]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), z = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossier = path.resolve(process.argv[2]);
const RACINE = path.resolve(opt('racine', path.join(__dirname, '..', '..')));
const SEUL = opt('seul', '');
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const EX = path.join(__dirname, '..', '..', 'Exemples');
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(dossier, { recursive: true, force: true });
fs.mkdirSync(dossier, { recursive: true });
const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = z.gunzipSync(b); const j = JSON.parse(b.toString('utf8')); return j.doc || j; };

// Le bloc d'assemblage sans ce qui est tiré au hasard : composants et occurrences désignés par leur nom
function resume(a) {
  const noms = {}, comps = {};
  for (const c of a.comps) { comps[c.id] = c.name; for (const o of c.occ || []) noms[o.id] = o.name; }
  const chemin = r => r && r.path ? Object.assign({}, r, { path: r.path.map(x => noms[x] || x) }) : r;
  const out = {};
  for (const c of a.comps) {
    const occ = (c.occ || []).map(o => {
      const r = { name: o.name, comp: comps[o.comp] || o.comp, fr: o.fr, fixed: !!o.fixed };
      if (o.align) { r.align = Object.assign({}, o.align, { src: chemin(o.align.src), dst: chemin(o.align.dst) }); delete r.align.sig; }
      return r;
    });
    const d = c.doc && c.doc.std;
    out[c.name] = { key: d ? d.key : '', occ };
  }
  return out;
}
function ecart(a, b, ch, out, tol) {
  if (out.length > 8) return;
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > tol) out.push(`${ch} : ${a} / ${b}`); return; }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (a !== b) out.push(`${ch} : ${JSON.stringify(a)} / ${JSON.stringify(b)}`); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[k], vb = b[k];
    if (va === undefined || va === null || va === false) { if (vb !== undefined && vb !== null && vb !== false) out.push(`${ch}.${k} : absent / ${JSON.stringify(vb).slice(0, 90)}`); continue; }
    if (vb === undefined || vb === null || vb === false) { out.push(`${ch}.${k} : ${JSON.stringify(va).slice(0, 90)} / absent`); continue; }
    ecart(va, vb, ch + '.' + k, out, tol);
  }
}
const VIS = { cat: 'iso', st: { type: 'chc', size: 'M4', len: '12' } }, FHC = { cat: 'iso', st: { type: 'fhc', size: 'M6', len: '20' } }, PIN = { cat: 'pin', st: { type: 'iso2338', size: '4', len: '12' } }, BOUCHON = { cat: 'plug', st: { type: 'din908', size: 'G 1/8' } };
const CLE = { cat: 'key', st: { type: 'A', size: '8x7', len: '25' } };
const ROUE = { cat: 'gear', st: { kind: 'ext', m: '2', z: '40', b: '30', d: '30', kw: 'iso' } };
const PAIRE = { cat: 'gearPair', st: { kind: 'ext', m: '2', z1: '20', z2: '40', b: '20' } };

(async () => {
  const port = 5200 + (process.pid % 400);
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  let ctx = null, page = null;
  const ouvrir = async f => {
    // Navigateur neuf à chaque scénario : le précédent a laissé un document modifié
    if (ctx) await ctx.close();
    ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-np-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 120000 });
    await page.evaluate(() => { window.__d = doc; });
    await page.setInputFiles('#fileProj', f);
    await page.waitForFunction(() => doc && doc !== window.__d, null, { timeout: 60000 });
    await attendre(1500);
  };
  let justes = 0, ecarts = 0, n = 0;
  // Un scénario : le fichier, puis des actions jouées des deux côtés
  const scenario = async (nom, fichier, actions, tol = 1e-5) => {
    if (SEUL && !nom.includes(SEUL)) return;
    n++;
    const f = path.join(EX, fichier + '.conceptcad');
    await ouvrir(f);
    const etapes = [];
    const refus = [];
    for (const A of actions) {
      const r = await page.evaluate(async A => {
        const sp = () => stdSpec(A.cat, A.st);
        if (A.fait === 'inserer') { const o = stdInsert(sp()); await new Promise(q => setTimeout(q, 200)); return { etape: { normInserer: { cat: A.cat, st: A.st } }, ok: !!o }; }
        // trouver où cliquer, sur le composant visé (par défaut le dernier non normalisé)
        asmEnsure(); if (asmMode !== 'asm') asmEnter();
        let cible = asmActiveComp(), W = [0, 0, 0], occId = null;
        if (A.dans) { const o = asmComp(asmActiveComp().id).occ.find(q => asmComp(q.comp).name.startsWith(A.dans)); cible = asmComp(o.comp); W = o.fr; occId = o.id; }
        const Gs = asmSnapGeomOf(cible);
        const mondeP = p => W.o ? [W.o[0] + p[0] * W.x[0] + p[1] * W.y[0] + p[2] * W.z[0], W.o[1] + p[0] * W.x[1] + p[1] * W.y[1] + p[2] * W.z[1], W.o[2] + p[0] * W.x[2] + p[1] * W.y[2] + p[2] * W.z[2]] : p;
        let o, t;
        if (A.fait === 'trou') {
          const H = stdHoles(Gs), h = H.filter(q => q.kind === A.sorte)[A.rang || 0];
          if (!h) return { sans: 'pas de trou ' + A.sorte, kinds: H.map(q => q.kind) };
          const up = Math.abs(h.n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], u = [h.n[1] * up[2] - h.n[2] * up[1], h.n[2] * up[0] - h.n[0] * up[2], h.n[0] * up[1] - h.n[1] * up[0]], lu = Math.hypot(...u);
          const dep = (h.d0 + h.d1) * (A.prof || 0.5);
          t = [0, 1, 2].map(i => h.E.c[i] - h.n[i] * dep + u[i] / lu * h.r);
          o = [0, 1, 2].map(i => h.E.c[i] + h.n[i] * 200);
        } else if (A.fait === 'rainure') {
          let K = null;
          for (const F of Gs.faces) { if (F.k !== 'plane') continue; const q = stdKeyway(F); if (q && (!A.forme || q.form === A.forme)) { K = q; break; } }
          if (!K) return { sans: 'pas de rainure' };
          // le fond, vu depuis sa normale
          const c = K.arcs && K.arcs.length && A.bout ? K.arcs[0].c : K.c;
          t = c;
          o = [0, 1, 2].map(i => K.c[i] + K.F.n[i] * (A.recul || 3));
          if (A.bout) t = [0, 1, 2].map(i => K.c[i] + (c[i] - K.c[i]) * 0.9);
        }
        if (A.fait === 'trou' || A.fait === 'rainure') {
          const O = mondeP(o), T = mondeP(t), d = [T[0] - O[0], T[1] - O[1], T[2] - O[2]], l = Math.hypot(...d), D = d.map(v => v / l);
          asmRay = () => new THREE.Ray(new THREE.Vector3(...O), new THREE.Vector3(...D));
          stdUi.pinAt = A.pinAt || 'auto'; stdUi.keyAt = A.keyAt || 'face';
          const S = sp();
          stdHoleStart(S);
          const pris = stdHolePickAt({});
          await new Promise(q => setTimeout(q, 200));
          return { etape: { normRayon: { cat: A.cat, st: A.st, pinAt: A.pinAt || 'auto', keyAt: A.keyAt || 'face', o: O, d: D } }, ok: pris, msg: faceEl.textContent };
        }
        if (A.fait === 'modifier') {
          const oc = [...asm.comps.flatMap(c => c.occ || [])].find(q => q.name === A.occ);
          const r = stdReplace(oc.id, sp(), A.tout !== false);
          await new Promise(q => setTimeout(q, 200));
          return { etape: { normModifier: { occ: A.occ, cat: A.cat, st: A.st, tout: A.tout !== false } }, ok: !!r, how: r && r.how };
        }
        return { sans: 'action inconnue' };
      }, A);
      if (r.sans) { refus.push(r.sans + (r.kinds ? ' : ' + r.kinds.join(',') : '')); break; }
      etapes.push(r.etape);
      if (r.msg) refus.push('   nav : ' + r.msg);
    }
    await attendre(1000);
    const navA = await page.evaluate(() => JSON.parse(JSON.stringify(asm)));
    const d = path.join(dossier, 'e-' + nom);
    fs.mkdirSync(d, { recursive: true });
    const sortie = path.join(d, 'sortie.conceptcad');
    const pas = [{ asm: 'basculer' }, ...etapes, { mesure: 1 }];
    fs.writeFileSync(path.join(d, 'etapes.json'), JSON.stringify(pas));
    const r = spawnSync(EXE, ['--essai-esquisse', f, '-2', sortie, path.join(d, 'etapes.json'), d], { timeout: 280000 });
    if (fs.existsSync(path.join(d, 'erreur.txt'))) console.log('   erreur.txt : ' + fs.readFileSync(path.join(d, 'erreur.txt'), 'utf8'));
    const bi = fs.existsSync(path.join(d, 'bilan.json')) ? JSON.parse(fs.readFileSync(path.join(d, 'bilan.json'), 'utf8')) : [];
    if (r.status !== 0 || bi.length !== pas.length || !fs.existsSync(sortie)) { ecarts++; console.log(`ÉCART   ${nom} : code ${r.status}, ${bi.length}/${pas.length} étapes`); return; }
    const nat = lire(sortie).asm;
    const o = [];
    ecart(resume(navA), resume(nat), '', o, tol);
    if (o.length) { ecarts++; console.log(`ÉCART   ${nom} (nav / natif)\n   ` + o.join('\n   ') + '\n   ' + refus.join('\n   ')); }
    else { justes++; console.log(`pareil  ${nom} : ${navA.comps.length} composants ${refus.length ? '\n   ' + refus.join('\n   ') : ''}`); }
  };
  const avec = (p, x) => Object.assign({}, p, x);
  const TA = 'Test Assemblage';
  await scenario('inserer', TA, [avec(VIS, { fait: 'inserer' }), avec(VIS, { fait: 'inserer' }), avec(BOUCHON, { fait: 'inserer' })], 2);
  await scenario('paire', TA, [avec(PAIRE, { fait: 'inserer' })], 2);
  await scenario('aimant', TA, [{ cat: 'magnet', st: { shape: 'cyl' }, fait: 'inserer' }, { cat: 'magnet', st: { shape: 'box' }, fait: 'inserer' }], 2);
  for (const [nom, fichier] of [['p', 'Perçages'], ['g', 'Griffe']]) {
    for (const sorte of ['simple', 'cbore', 'csink']) {
      await scenario(`trou-${nom}-${sorte}-vis`, fichier, [avec(sorte === 'csink' ? FHC : VIS, { fait: 'trou', sorte })]);
      await scenario(`trou-${nom}-${sorte}-goupille`, fichier, [avec(PIN, { fait: 'trou', sorte, prof: 0.1 })]);
      await scenario(`trou-${nom}-${sorte}-goupille-fond`, fichier, [avec(PIN, { fait: 'trou', sorte, pinAt: 'bot' })]);
    }
  }
  await scenario('modifier-toutes', 'Perçages', [avec(VIS, { fait: 'trou', sorte: 'simple' }), avec(VIS, { fait: 'modifier', occ: 'CHC M4×12:1', st: { type: 'chc', size: 'M4', len: '16' } })]);
  await scenario('modifier-une', 'Perçages', [avec(VIS, { fait: 'trou', sorte: 'simple' }), avec(VIS, { fait: 'modifier', occ: 'CHC M4×12:1', tout: false, st: { type: 'chc', size: 'M4', len: '16' } })]);
  await scenario('rainure-roue', TA, [avec(ROUE, { fait: 'inserer' }), avec(CLE, { fait: 'rainure', dans: 'Engrenage', st: { type: 'A', size: '8x7', len: '25' }, recul: 30 })], 2);
  await scenario('rainure-axe', 'Axe', [avec(CLE, { fait: 'rainure' })]);
  await scenario('rainure-axe-bout', 'Axe', [avec(CLE, { fait: 'rainure', keyAt: 'arc', bout: true })]);
  console.log(`${n} scénarios : ${justes} pareils, ${ecarts} écarts`);
  if (ctx) await ctx.close();
  sv.kill();
  process.exit(ecarts ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
