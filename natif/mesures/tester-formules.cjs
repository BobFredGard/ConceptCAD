// Cotes nommées, formules et paramètres : le natif et le navigateur arrivent-ils à la même pièce ?
// 1. parEval : une longue liste d'expressions, valeur ou message d'erreur (sans navigateur : le texte du module est exécuté dans Node).
// 2. Des suites de saisies sur de vraies pièces : la décision, le message, puis A le navigateur fait les saisies lui-même,
//    N le fichier écrit par le natif, B le navigateur rouvre ce fichier. Tout doit coïncider.
// node natif/mesures/tester-formules.cjs <dossier de travail> [--racine=<dossier qui sert le ConceptCAD.html>] [--src=<dossier des sources JS>] [--eval]
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), zlib = require('zlib'), vm = require('vm');
const { spawn, spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const opt = n => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : ''; };
const RACINE_NAV = opt('racine') || RACINE;
const SRC_JS = opt('src') || path.join(RACINE_NAV, 'src');
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const EXEMPLES = path.join(RACINE, 'Exemples');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const dossier = path.resolve(process.argv[2]);
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
const portLibre = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); const j = JSON.parse(b); return j.doc || j; };

// ---------- 1. parEval
function testerEvaluations() {
  const code = fs.readFileSync(path.join(SRC_JS, '51-parametres.js'), 'utf8').split('\n');
  const fin = code.findIndex(l => l.startsWith('function parDimUser'));
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(code.slice(0, fin).join('\n') + '\nthis.parEval=parEval;this.parIsNumber=parIsNumber;', ctx);
  const noms = { L: 100, R: 5, a_1: 2.5, Zero: 0 };
  const textes = [
    '1', '1+2', '2*3+4', '2+3*4', '(2+3)*4', '10/4', '12,5', '12,5 + 1,5', '1.5e3', '1e-2', '.5', '5.', '-3', '+3', '--3', '2^3', '2^3^2', '-2^2', '2^-1',
    'L', 'L/2', 'L*2+R', '(L - 2*R)/3', 'a_1*2', 'Zero+1', '1/Zero', 'pi', 'PI', 'pi*2', '2*pi*R',
    'sqrt(16)', 'abs(-3)', 'min(1;2;3)', 'max(1;2;3)', 'min(1, 2)', 'max(4,5)', 'floor(2.7)', 'ceil(2.1)', 'floor(-2.5)', 'ceil(-2.5)',
    'round(2.5)', 'round(-2.5)', 'round(2.46;0,1)', 'round(7;5)', 'roundmoins(7;5)', 'roundplus(7;5)', 'roundmoins(7,3;0,5)', 'roundplus(7,3;0,5)', 'round(1;0)', 'RoundPlus(3,1)', 'ROUND(3.5)',
    'sin(30)', 'cos(60)', 'tan(45)', 'asin(0.5)', 'acos(0.5)', 'atan(1)', 'SIN(90)', 'sin()', 'sqrt(-1)', 'min()', 'max()',
    'if(1;2;3)', 'if(0;2;3)', 'si(L>50;1;2)', 'IF(L<50;1;2)', 'if(L>=100;1;2)', 'if(L<=100;1;2)', 'if(L==100;1;2)', 'if(L!=100;1;2)', 'if(L<>100;1;2)', 'if(L=100;1;2)',
    'if(1;2;1/Zero)', 'if(0;1/Zero;3)', 'if(1;2;INCONNU)', 'if(0;INCONNU;3)', 'if(1;2;sqrt(-1))', 'if(1;2;round(1;0))', 'if(1)', 'if(1;2)', 'if(1;2;3', 'if(1;2;3;4)',
    'and(1;1)', 'and(1;0)', 'or(0;0)', 'or(0;1)', 'not(0)', 'not(5)', 'not()', 'and()', 'or()', '(1<2)', '(2<1)', '(1<2)+1', '1<2', '2>1', '1<2<3',
    '5 mm', '5mm', '2 cm + 3', '1 in', '1"', '1.5 rad', '45°', '45 °', '45 deg', '45deg', '2 m', '2m', '2 mm + 3 mm', '5 mmm', '5 min', '3 cm', '3 CM', '5 MM', '5 DEG',
    '', ' ', '(', ')', '()', '1+', '*2', '1 2', '1,', ',5', '1,2,3', 'L L', 'L(', 'foo(1)', 'INCONNU', 'INCONNU+1', '1/0', '0/0', '1e400', 'é', '1é', '€', '2 + é', 'sqrt(4', 'sqrt 4',
    'pi()', 'L()', 'sqrt(4;9)', 'abs(1;2)', '1 ; 2', '  7  ', '7 mm  ', '\t3', '1e', '1e+', '1E2', 'e', 'R5', 'Ø20', '∠45', 'R*2', 'r', 'l', '1_000', '_a', 'a b', 'L=5', 'L==100', '5==5',
    'roundplus(0.1+0.2;0.1)', 'roundmoins(0.3;0.1)', 'round(0.15;0.1)', 'round(1.005;0.01)', 'max(1;sqrt(-1))', 'min(sqrt(-1);1)', '2^0.5', '0^0', '(-8)^(1/3)', '10^400', 'sqrt(2)*sqrt(2)', 'tan(90)',
  ];
  const f = path.join(dossier, 'eval.json'), o = path.join(dossier, 'eval-sortie.json');
  fs.writeFileSync(f, JSON.stringify({ noms, textes }));
  const q = spawnSync(EXE, ['--evaluer', f, o], { encoding: 'utf8' });
  if (q.status !== 0) { console.log('--evaluer : échec', q.status, q.stderr); return 1; }
  const n = JSON.parse(fs.readFileSync(o, 'utf8'));
  let faux = 0;
  n.forEach((r, i) => {
    const t = textes[i];
    let v, e;
    try { v = ctx.parEval(t, x => { if (!(x in noms)) throw new Error('« ' + x + ' » inconnu'); return noms[x]; }); } catch (err) { e = err.message; }
    const num = ctx.parIsNumber(t);
    const pareil = e === r.e && (e !== undefined || Math.abs(v - r.v) <= 1e-12 * Math.max(1, Math.abs(v))) && num === r.n;
    if (!pareil) { faux++; console.log(`ÉVAL ${JSON.stringify(t)} : navigateur ${e !== undefined ? 'erreur ' + e : v} ${num}, natif ${r.e !== undefined ? 'erreur ' + r.e : r.v} ${r.n}`); }
  });
  console.log(`parEval : ${textes.length - faux} expressions sur ${textes.length} identiques.`);
  return faux;
}

// ---------- 2. suites de saisies
const nb = x => String(+(+x).toFixed(4));
function suites(doc, piece) {
  const out = [];
  const utilisable = s => (s.dims || []).filter(d => !d.ref && d.value > 0.5 && d.type !== 'angle' && !d.name && !d.expr);
  const esq = (doc.sketches || []).filter(s => utilisable(s).length >= 2);
  esq.slice(0, 2).forEach(s => {
    const [a, b] = utilisable(s), c = utilisable(s)[2];
    const va = a.dia ? 2 * a.value : a.value, vb = b.dia ? 2 * b.value : b.value;
    const k = +(vb / va).toFixed(6), n = 'L_' + a.id.replace(/\W/g, '');
    const m = 'M_' + a.id.replace(/\W/g, '');
    const A = t => ({ sk: s.id, cote: a.id, t }), B = t => ({ sk: s.id, cote: b.id, t });
    out.push({ nom: 'nommer', pas: [A(`${n} = ${nb(va * 1.05)}`)] });
    out.push({ nom: 'formule', pas: [A(`${n} = ${nb(va)}`), B(`${n}*${k}`)] });
    out.push({ nom: 'propage', pas: [A(`${n} = ${nb(va)}`), B(`${n}*${k}`), A(`${n} = ${nb(va * 1.1)}`)] });
    out.push({ nom: 'nommé+formule', pas: [A(`${n} = ${nb(va)}`), B(`${m} = ${n}*${k}`), A(`${n} = ${nb(va * 0.95)}`)] });
    out.push({ nom: 'renomme', pas: [A(`${n} = ${nb(va)}`), B(`${n}*${k}`), A(`${n}b = ${nb(va * 1.05)}`)] });
    out.push({ nom: 'circulaire', pas: [A(`${n} = ${nb(va)}`), B(`${m} = ${n}*${k}`), A(`${n} = ${m}/${k}`)] });
    out.push({ nom: 'nom pris', pas: [A(`${n} = ${nb(va)}`), B(`${n} = ${nb(vb)}`)] });
    out.push({ nom: 'inconnu', pas: [A('INCONNU*2')] });
    out.push({ nom: 'syntaxe', pas: [A('(1+')] });
    out.push({ nom: 'négatif', pas: [A('-5')] });
    out.push({ nom: 'nul', pas: [A('5-5')] });
    out.push({ nom: 'nom interdit', pas: [A('sin = 5')] });
    out.push({ nom: 'nom pi', pas: [A('pi = 5')] });
    out.push({ nom: 'nom mauvais', pas: [A('2x = 5')] });
    out.push({ nom: 'vide', pas: [A('')] });
    out.push({ nom: 'chiffre puis formule', pas: [A(`${n} = ${nb(va)}`), B(`${n}*${k}`), B(nb(vb * 1.02))] });
    out.push({ nom: 'virgule et unité', pas: [A(`${nb(va * 1.03).replace('.', ',')} mm`)] });
    out.push({ nom: 'pi et if', pas: [A(`if(${nb(va)} > 1 ; ${nb(va / Math.PI)}*pi ; 3)`)] });
    out.push({ nom: 'paramètre', pas: [{ param: 'P_essai', expr: nb(va) }, A(`P_essai*1,05`), { param: 'P_essai', expr: nb(va * 1.1) }] });
    out.push({ nom: 'paramètre formule', pas: [{ param: 'P_essai', expr: nb(va) }, { param: 'Q_essai', expr: 'P_essai/2' }, A('Q_essai*2'), { param: 'P_essai', expr: nb(va * 0.95) }] });
    out.push({ nom: 'paramètre faux', pas: [{ param: 'P_essai', expr: 'INCONNU+1' }] });
    if (c) out.push({ nom: 'trois', pas: [A(`${n} = ${nb(va)}`), B(`${n}*${k}`), { sk: s.id, cote: c.id, t: `${n}*${+((c.dia ? 2 * c.value : c.value) / va).toFixed(6)}` }, A(`${n} = ${nb(va * 1.08)}`)] });
  });
  // Entre deux esquisses
  if (esq.length >= 2) {
    const [s, t] = esq;
    const a = utilisable(s)[0], b = utilisable(t)[0];
    const va = a.dia ? 2 * a.value : a.value, vb = b.dia ? 2 * b.value : b.value;
    const k = +(vb / va).toFixed(6);
    out.push({ nom: 'autre esquisse', pas: [{ sk: s.id, cote: a.id, t: `Lx = ${nb(va)}` }, { sk: t.id, cote: b.id, t: `Lx*${k}` }, { sk: s.id, cote: a.id, t: `Lx = ${nb(va * 1.04)}` }] });
  }
  // Ce que la pièce contient déjà
  (doc.sketches || []).forEach(s => (s.dims || []).forEach(d => {
    if (d.ref) return;
    const v = d.type === 'angle' ? d.value * 180 / Math.PI : d.dia ? 2 * d.value : d.value;
    if (d.name) out.push({ nom: 'cote nommée ' + d.name, pas: [{ sk: s.id, cote: d.id, t: `${d.name} = ${nb(v * 1.03)}` }] });
    if (d.expr) out.push({ nom: 'formule du fichier ' + d.id, pas: [{ sk: s.id, cote: d.id, t: nb(v * 1.02) }] });
  }));
  (doc.params || []).forEach(p => out.push({ nom: 'paramètre du fichier ' + p.name, pas: [{ param: p.name, expr: nb((+p.value || 10) * 1.05) }] }));
  return out.map(x => Object.assign(x, { piece }));
}

const ETAT = () => {
  const sh = typeof occLive !== 'undefined' && occLive && occLive.shape;
  const fx = { params: (doc.params || []).map(p => ({ name: p.name, expr: String(p.expr), value: p.value, err: p.err || '' })), dims: {} };
  doc.sketches.forEach(s => (s.dims || []).forEach(d => { fx.dims[s.id + '/' + d.id] = { name: d.name || '', expr: d.expr == null ? '' : String(d.expr), err: d.exprErr || '' }; }));
  return { src: JSON.parse(docHashSrc(doc)), corps: bodies.filter(b => b.shape).length, volume: sh ? occCoqueVolume(sh) : null, fx };
};
function ecarts(a, b, chemin, out) {
  if (a === b || ['_refNote', 'chk', 'rdV', 'params', 'name'].includes(chemin[chemin.length - 1])) return out;
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-3) out.push(chemin.join('.') + ' ' + a + ' / ' + b); return out; }
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) ecarts(a[k], b[k], chemin.concat(k), out); return out; }
  out.push(chemin.join('.') + ' ' + JSON.stringify(a) + ' / ' + JSON.stringify(b));
  return out;
}
const pret = page => page.waitForFunction(() => typeof doc !== 'undefined' && doc && !skEdit && rebuildDepth === 0, null, { timeout: 600000 });

(async () => {
  let faux = testerEvaluations();
  if (process.argv.includes('--eval')) process.exit(faux ? 1 : 0);
  const pieces = (opt('pieces') || 'Griffe,Axe,Poche et Contour,Barquette,Test Répétition Courbe').split(',');
  const cas = [];
  for (const p of pieces) {
    const src = path.join(EXEMPLES, p + '.conceptcad');
    suites(lire(src), p).forEach(c => cas.push(Object.assign(c, { src })));
  }
  const port = await portLibre();
  const serveur = spawn(process.execPath, [path.join(RACINE_NAV, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  const url = 'http://127.0.0.1:' + port;
  let justes = 0, figes = 0, refusPareils = 0;
  try {
    await attendre(800);
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fx-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    const ouvrir = async fichier => {
      const page = await ctx.newPage();
      const erreurs = [];
      page.on('pageerror', e => erreurs.push(e.message));
      page.on('dialog', d => { erreurs.push('dialogue : ' + d.message()); d.dismiss().catch(() => {}); });
      await page.goto(url + '/ConceptCAD.html');
      await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
      await pret(page);
      await page.setInputFiles('#fileProj', fichier);
      await page.waitForFunction(() => doc && ((doc.features || []).length || (doc.sketches || []).length), null, { timeout: 300000 });
      await attendre(1200);
      await pret(page);
      return { page, erreurs };
    };
    for (const c of cas) {
      const nomCas = `${c.piece} · ${c.nom}`;
      // Le natif : une exécution par saisie, chacune repart du fichier écrit par la précédente
      let courant = c.src, fige = false;
      const decisions = [];
      c.pas.forEach((p, i) => {
        const sortie = path.join(dossier, `s${i}.conceptcad`);
        fs.rmSync(sortie, { force: true });
        const q = p.param
          ? spawnSync(EXE, ['--parametre', courant, sortie, p.param, p.expr], { encoding: 'utf8' })
          : spawnSync(EXE, ['--formule', courant, sortie, p.sk, p.cote, p.t], { encoding: 'utf8' });
        if (q.status === 5) fige = true;
        if (q.status === 0) { decisions.push({ ok: true }); courant = sortie; }
        else decisions.push({ ok: false, msg: (q.stderr || '').trim(), code: q.status });
      });
      if (fige) { figes++; console.log(`figé   ${nomCas} : ${decisions.map(x => x.msg).join(' | ').slice(0, 120)}`); continue; }

      const a = await ouvrir(c.src);
      const dec = [];
      for (const p of c.pas) {
        dec.push(await a.page.evaluate(p => {
          if (p.param) {
            if (!Array.isArray(doc.params)) doc.params = [];
            let P = doc.params.find(x => x.name === p.param);
            if (!P) { P = { name: p.param, expr: '10', value: 10 }; doc.params.push(P); }
            const r = parSetParam(P, p.expr);
            if (r !== true) { if (P.expr === '10' && P.name === p.param && P.value === 10) { /* resté tel quel */ } return { ok: false, msg: r, nouveau: 1 }; }
            parApplyAll();
            rebuild();
            return { ok: true };
          }
          openSketch(p.sk);
          const s = skEdit, d = s.dims.find(x => x.id === p.cote);
          skPushUndo();
          const rr = parDimCommit(s, d, p.t);
          if (!rr.ok) { skUndoStack.pop(); skUndoBtn(); closeSketch(true); return { ok: false, msg: rr.msg }; }
          skFirstDimScale(s, d, rr.nv);
          d.value = rr.nv;
          parApplyAll();
          const ok = skSolveOrRevert(s, 'Cote');
          closeSketch(true);
          return { ok, msg: ok ? '' : 'solveur' };
        }, p));
        await attendre(300);
        await pret(a.page);
      }
      const ea = await a.page.evaluate(ETAT);
      await a.page.close();
      const dif = c.pas.map((p, i) => {
        const n = decisions[i], b = dec[i];
        if (n.ok !== b.ok) return `saisie ${i + 1} : natif ${n.ok ? 'accepte' : 'refuse (' + n.msg + ')'}, navigateur ${b.ok ? 'accepte' : 'refuse (' + b.msg + ')'}`;
        if (!n.ok && b.msg !== 'solveur' && n.msg !== b.msg) return `saisie ${i + 1} : message natif « ${n.msg} », navigateur « ${b.msg} »`;
        return '';
      }).filter(Boolean);
      if (dif.length) { faux++; console.log(`DÉCISION ${nomCas} : ${dif.join(' ; ')}`); continue; }
      if (!decisions.some(x => x.ok)) { refusPareils++; continue; }
      // Le fichier du natif, lu tel quel, puis rouvert par le navigateur
      const brut = lire(courant);
      const fxN = { params: (brut.params || []).map(p => ({ name: p.name, expr: String(p.expr), value: p.value, err: p.err || '' })), dims: {} };
      brut.sketches.forEach(s => (s.dims || []).forEach(d => { fxN.dims[s.id + '/' + d.id] = { name: d.name || '', expr: d.expr == null ? '' : String(d.expr), err: d.exprErr || '' }; }));
      const champsFx = ecartsFx(ea.fx, fxN);
      const b = await ouvrir(courant);
      const eb = await b.page.evaluate(ETAT);
      await b.page.close();
      const champs = ecarts(ea.src, eb.src, [], []);
      const verif = path.join(dossier, 'verif.json');
      spawnSync(EXE, ['--verif', courant, verif], { stdio: 'ignore' });
      const n = JSON.parse(fs.readFileSync(verif, 'utf8'));
      const vn = n.cas[0] ? n.cas[0].volume : 0;
      const calcule = n.cas[0] && n.cas[0].calcule !== false;
      const volOk = ea.volume == null || eb.volume == null ? true : Math.abs(ea.volume - eb.volume) <= 0.01 && (!calcule || !vn || Math.abs(vn - eb.volume) <= 0.01);
      const err = a.erreurs.concat(b.erreurs);
      const ok = !champs.length && !champsFx.length && ea.corps === eb.corps && volOk && !err.length;
      if (ok) justes++; else faux++;
      console.log(`${ok ? 'pareil ' : 'ÉCART  '} ${nomCas} : volume nav. ${ea.volume == null ? '-' : ea.volume.toFixed(3)}, fichier ${eb.volume == null ? '-' : eb.volume.toFixed(3)}, natif ${(+vn || 0).toFixed(3)}${champs.length ? ' | ' + champs.slice(0, 4).join(' ; ') + (champs.length > 4 ? ` … ${champs.length} champs` : '') : ''}${champsFx.length ? ' | fx ' + champsFx.slice(0, 4).join(' ; ') : ''} ${err.slice(0, 2).join(' ')}`);
    }
    await ctx.close().catch(() => {});
  } finally { serveur.kill(); }
  console.log(`${cas.length} suites : ${justes} pareilles, ${refusPareils} refusées des deux côtés avec le même message, ${faux} écarts, ${figes} figées par le natif.`);
  process.exit(faux ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

function ecartsFx(a, b) {
  const out = [];
  const num = (x, y, c) => { if (typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) > 1e-6 : x !== y) out.push(c + ' ' + JSON.stringify(x) + ' / ' + JSON.stringify(y)); };
  if (a.params.length !== b.params.length) out.push('params ' + a.params.length + ' / ' + b.params.length);
  a.params.forEach((p, i) => { const q = b.params[i] || {}; for (const k of ['name', 'expr', 'value', 'err']) num(p[k], q[k], 'param ' + p.name + '.' + k); });
  for (const k of new Set([...Object.keys(a.dims), ...Object.keys(b.dims)])) for (const c of ['name', 'expr', 'err']) num((a.dims[k] || {})[c], (b.dims[k] || {})[c], k + '.' + c);
  return out;
}
