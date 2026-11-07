// Le moteur FAO du programme natif contre le navigateur : mêmes opérations reconnues, mêmes traces,
// et avec --regenerer mêmes parcours recalculés.
// node mesures/tester-fao.cjs <dossier> --racine=D:/ConceptCAD [--pieces=A,B] [--regenerer] [--op=type]
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossier = path.resolve(process.argv[2]);
const RACINE = opt('racine', path.resolve(__dirname, '..', '..'));
const EX = opt('dossier', path.resolve(__dirname, '..', '..', 'Exemples'));
const PIECES = opt('pieces', 'Perçages,Cavité Test').split(',');
const REGEN = process.argv.includes('--regenerer');
const TOL = 1e-6;
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(dossier, { recursive: true });

// Le moteur, comme le programme natif le lance
function moteur() {
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'fao', 'moteur.cjs')], { env: process.env });
  let buf = '', n = 0, pret;
  const att = new Map(), demarre = new Promise(r => { pret = r; });
  p.stderr.on('data', d => process.stderr.write(String(d).slice(0, 300)));
  p.stdout.on('data', d => {
    buf += d;
    for (let i; (i = buf.indexOf('\n')) >= 0;) {
      const l = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (l[0] !== '§') continue;
      const o = JSON.parse(l.slice(1));
      if (o.pret !== undefined) pret(o);
      else att.get(o.n)(o);
    }
  });
  return { demarre, cmd: (c, a) => new Promise(r => { const k = ++n; att.set(k, r); p.stdin.write(JSON.stringify({ n: k, cmd: c, ...a }) + '\n'); }), fin: () => p.stdin.end() };
}
// Le même calcul, dans la page
const DANS_PAGE = regen => {
  const lire = s => {
    const F = faoFrame(s), O = [];
    faoSeqSafe(s, true).forEach(b => {
      if (b.absent) { O.push({ id: b.op.id, absent: true }); return; }
      const sp = faoSegSplit(b.moves, faoSegClipper(b.op, s));
      O.push({ id: b.op.id, n: b.moves.length, cut: sp.cut, rap: sp.rap, ret: sp.ret, plg: sp.plg });
    });
    return { stock: faoStock(), frame: { X: F.X, Y: F.Y, Z: F.Z, O: F.O, id: F.id }, ops: O };
  };
  const R = faoRoot();
  const res = { active: R.activeSetupId, setups: [] };
  for (const s of R.setups) {
    R.activeSetupId = s.id;
    if (regen) for (const op of s.ops || []) { if (op.on === false) continue; try { faoOpMovesMap.delete(op); } catch (e) { /* rien */ } op.stale = false; faoOpMoves(op, s); }
    res.setups.push({ id: s.id, name: s.name, ops: (s.ops || []).map((op, i) => ({ id: op.id, type: op.type, label: (i + 1) + '. ' + faoOpShortLabel(op), on: op.on !== false, hidden: op.hidden === true, stale: op.stale === true, aParcours: faoOpMovesTry(op, s) != null })), traces: lire(s) });
  }
  R.activeSetupId = res.active;
  return res;
};
function ecartNombres(a, b, ch, out) {
  if (a === undefined && b === undefined) return;
  if (!a || !b || a.length !== b.length) { out.push(`${ch} : ${a ? a.length : '-'} / ${b ? b.length : '-'} nombres`); return; }
  let m = 0, im = -1;
  for (let i = 0; i < a.length; i++) { const e = Math.abs(a[i] - b[i]); if (e > m) m = e, im = i; }
  if (m > TOL) out.push(`${ch} : écart ${m.toExponential(2)} au rang ${im}`);
}
(async () => {
  const port = 5200 + (process.pid % 400);
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  const M = moteur();
  const dep = await M.demarre;
  if (!dep.pret) throw new Error(dep.erreur);
  let justes = 0, faux = 0;
  for (const nom of PIECES) {
    const f = path.join(EX, nom + '.conceptcad');
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fa-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 120000 });
    await page.evaluate(() => { window.__d = doc; });
    await page.setInputFiles('#fileProj', f);
    await page.waitForFunction(() => doc && doc !== window.__d, null, { timeout: 60000 });
    await page.waitForFunction(() => typeof faoSolidSettled === 'function' && faoSolidSettled() && !(typeof rebuildBusy !== 'undefined' && rebuildBusy), null, { timeout: 120000 }).catch(() => {});
    await attendre(5000);
    page.setDefaultTimeout(1200000);
    const nav = await page.evaluate(DANS_PAGE, REGEN);
    await ctx.close();
    const a = await M.cmd('ouvrir', { fichier: f });
    if (!a.ok) { faux++; console.log(`ÉCART   ${nom} : moteur ${a.erreur}`); continue; }
    const out = [];
    for (const sn of nav.setups) {
      const sm = a.r.setups.find(x => x.id === sn.id);
      if (!sm) { out.push(`posage ${sn.name} absent`); continue; }
      if (REGEN) { const g = await M.cmd('regenerer', { posage: sn.id }); if (!g.ok) out.push('regénération : ' + g.erreur); }
      const ar = (await M.cmd('arbre', {})).r.setups.find(x => x.id === sn.id);
      sn.ops.forEach((o, i) => {
        const q = ar.ops[i] || {};
        for (const k of ['id', 'type', 'label', 'on', 'hidden', 'stale', 'aParcours']) if (o[k] !== q[k]) out.push(`${sn.name} ${o.label} ${k} : ${o[k]} / ${q[k]}`);
      });
      const t = await M.cmd('traces', { posage: sn.id });
      if (!t.ok) { out.push('traces : ' + t.erreur); continue; }
      sn.traces.ops.forEach((o, i) => {
        const q = t.r.ops[i] || {};
        if (!!o.absent !== !!q.absent) { out.push(`${sn.name} ${o.id} absent : ${!!o.absent} / ${!!q.absent}`); return; }
        if (o.absent) return;
        for (const k of ['cut', 'rap', 'ret', 'plg']) ecartNombres(o[k], q[k], `${sn.name} ${o.id} ${k}`, out);
      });
    }
    const nb = nav.setups.reduce((s, x) => s + x.ops.length, 0), av = nav.setups.reduce((s, x) => s + x.ops.filter(o => o.aParcours).length, 0);
    if (out.length) {
      faux++;
      console.log(`ÉCART   ${nom} (${nb} opérations, ${av} avec parcours) :`);
      out.slice(0, 20).forEach(l => console.log('   ' + l));
    } else {
      justes++;
      console.log(`juste   ${nom} : ${nb} opérations, ${av} avec parcours`);
    }
  }
  M.fin();
  sv.kill();
  console.log(`${justes} justes, ${faux} écarts`);
  process.exit(faux ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
