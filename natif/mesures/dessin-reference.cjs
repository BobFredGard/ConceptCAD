// Fait faire au navigateur (exécuté dans Node, sans toucher à src/) des gestes de dessin sur chaque esquisse :
// vrais événements de souris sur la vue, tirés au hasard mais reproductibles. Les gestes et l'esquisse complète
// après chacun sont écrits pour BancDessin, qui rejoue les mêmes gestes dans le natif et compare.
// node dessin-reference.cjs <dossier d'exemples> <sortie.json> [--communes] [--nom=extrait] [--sessions=n] [--contraintes] [--cotes]
// --cotes : ajoute l'outil Cote et la longueur tapée aux gestes tirés
// --modifier : ajoute Ajuster et Décaler aux gestes tirés
// --tape : ajoute Décaler à distance tapée. Le navigateur n'a pas ce geste : on appelle directement son skOffsetApply avec la distance
// --contraintes : ajoute la pose de contraintes aux gestes tirés (sans cette option, les références déjà faites restent reproductibles)
// Restent neutralisés, à dire honnêtement : l'accroche sur les arêtes du solide, et le clic sur une étiquette de cote.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const racine = path.join(__dirname, '..', '..');
const { loadApp } = require(path.join(racine, 'tests', 'appvm.cjs'));
const { ctx } = loadApp();
const dossier = process.argv[2], cible = process.argv[3];
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const nomVoulu = opt('nom', ''), nbSessions = +opt('sessions', 3);
const horlogeReelle = Date.now;
Date.now = () => 1e12;  // le budget de 400 ms ne doit pas dépendre de la machine

if (process.argv.includes('--communes')) {
  const PI = 3.141592653589793, PIO2 = 1.5707963267948966, PIO2_B = 6.123233995736766e-17, RAC3 = 1.7320508075688772;
  const sinPoly = y => { const z = y * y; let s = 1; for (let k = 19; k >= 3; k -= 2) s = 1 - s * z / (k * (k - 1)); return y * s; };
  const cosPoly = y => { const z = y * y; let s = 1; for (let k = 20; k >= 2; k -= 2) s = 1 - s * z / (k * (k - 1)); return s; };
  const reduire = x => { const k = Math.floor(x / PIO2 + 0.5); return [x - k * PIO2 - k * PIO2_B, ((k % 4) + 4) % 4]; };
  Math.sin = x => { if (!isFinite(x)) return NaN; const [y, q] = reduire(x); return q === 0 ? sinPoly(y) : q === 1 ? cosPoly(y) : q === 2 ? -sinPoly(y) : -cosPoly(y); };
  Math.cos = x => { if (!isFinite(x)) return NaN; const [y, q] = reduire(x); return q === 0 ? cosPoly(y) : q === 1 ? -sinPoly(y) : q === 2 ? -cosPoly(y) : sinPoly(y); };
  const atanPetit = t => { const z = t * t; let s = 0; for (let k = 33; k >= 1; k -= 2) s = 1 / k - z * s; return t * s; };
  const atan = t => t > 1 ? PIO2 - atan(1 / t) : t > 0.2679491924311227 ? PI / 6 + atanPetit((t * RAC3 - 1) / (t + RAC3)) : atanPetit(t);
  Math.atan2 = (y, x) => {
    if (isNaN(x) || isNaN(y)) return NaN;
    if (x === 0 && y === 0) return 0;
    const ax = Math.abs(x), ay = Math.abs(y);
    let a = ax === 0 ? PIO2 : ay === 0 ? 0 : atan(ay / ax);
    if (x < 0) a = PI - a;
    return y < 0 ? -a : a;
  };
}

const lireDoc = f => {
  let b = fs.readFileSync(f);
  if (b[0] === 0x1f) b = zlib.gunzipSync(b);
  const j = JSON.parse(b.toString('utf8'));
  return j.doc || j;
};

vm.runInContext(`
  // Ce qui dépend de l'écran ou du solide est coupé : le natif ne l'a pas dans cette comparaison
  skPlSnap = () => null; skPlHit = () => null; skPlSelect = () => false; skPlUndoIfPlane = () => {};
  hitDimLabel = () => null; hitDimLine = () => null;
  drawSketch2D = () => {}; renderSkPanel = () => {}; skRefreshHealth = () => {};
  skStatus = () => {}; skUndoBtn = () => {};
  $('sketchOverlay').classList.contains = () => true;  // les touches ne sont écoutées qu'esquisse ouverte
  function __ouvrir(src, s, cx, cy) {
    const sk = JSON.parse(JSON.stringify(src));
    doc.sketches = [sk]; doc.features = [];
    skView = { s, cx, cy }; skUpdateTols();
    $('skSnap').checked = true;
    migrateSketch(sk);
    skFixSurProjRepair(sk);
    skValsNote(sk);
    skGapToAngle(sk);
    const arcPts = new Set();
    (sk.entities || []).forEach(e => { if (e && e.t === 'arc') { arcPts.add(e.pa); arcPts.add(e.pb); } });
    (sk.constraints || []).forEach(c => {
      if (c.type !== 'symmetric' || c.inf) return;
      if ([c.a, c.b].some(id => { const l = entById(sk, id); return l && (arcPts.has(l.p1) || arcPts.has(l.p2)); })) c.inf = true;
    });
    skEdit = sk; skTool = 'select'; skUndoStack = []; skRedoStack = []; skSel = null; skSelX = [];
    skCancelDraft();
    solveSketch(sk);
    return sk;
  }
  function __evt(type, x, y, ctrl) {
    const [px, py] = w2s(x, y);
    svg.dispatchEvent(new PointerEvent(type, { clientX: px, clientY: py, button: 0, ctrlKey: !!ctrl, detail: 1 }));
  }
  function __exact(x, y) { const [px, py] = w2s(x, y); const [a, b] = s2w(px, py); return a === x && b === y; }
  function __pas(st) {
    if (st.a === 'outil') { skCancelDraft(); skTool = st.o; }
    else if (st.a === 'bas') __evt('pointerdown', st.x, st.y, st.c);
    else if (st.a === 'bouge') __evt('pointermove', st.x, st.y);
    else if (st.a === 'haut') __evt('pointerup', st.x, st.y);
    else if (st.a === 'dbl') __evt('dblclick', st.x, st.y);
    else if (st.a === 'offD') {
      if (skOffArm) {
        const sel = skSelectedEnts().filter(e => (e.t === 'line' && !e.handle || e.t === 'circle' || e.t === 'arc') && !e.ref);
        skOffArm = false;
        if (sel.length) {
          skPushUndo();
          const r = skOffsetApply(skEdit, sel.map(e => e.id), Number(st.t), { x: st.x, y: st.y });
          if (!r.ok) { skUndoStack.pop(); skUndoBtn(); } else afterEdit();
        }
      }
    }
    else if (st.a === 'echap') skEscapeToSelect();
    else if (st.a === 'suppr') deleteSkSel();
    else if (st.a === 'con') applyCon(st.t);
    else if (st.a === 'touche') dispatchEvent(new KeyboardEvent('keydown', { key: st.k }));
    else if (st.a === 'f1' || st.a === 'f2') skShortcut({ key: st.a.toUpperCase(), shiftKey: false, preventDefault() {} });
  }
  function __etat(sk) {
    const P = sk.points, pts = [], ray = [], val = [];
    Object.keys(P).forEach(k => pts.push(P[k].x, P[k].y));
    const v = x => x === undefined || x === null ? '' : x;
    const st = [
      sk.seq,
      Object.keys(P).join(','),
      (sk.entities || []).map(e => [e.id, e.t, v(e.p1), v(e.p2), v(e.pc), v(e.pa), v(e.pb), v(e.p), e.construction ? 1 : 0].join(',')).join(';'),
      (sk.constraints || []).map(c => [v(c.id), c.type, v(c.p), v(c.line), v(c.ent), v(c.a), v(c.b), v(c.mid), v(c.c), v(c.d), c.inf ? 1 : 0].join(',')).join(';'),
      (sk.dims || []).map(d => [d.id, d.type, v(d.line), v(d.ent), v(d.a), v(d.b), v(d.p), v(d.orient), d.ref ? 1 : 0, d.chk ? 1 : 0, d.dia ? 1 : 0, d.sgn === 1 || d.sgn === -1 ? d.sgn : 0, d.ccw === 0 || d.ccw === 1 ? d.ccw : -1].join(',')).join(';'),
    ].join('#');
    (sk.entities || []).forEach(e => { if (e.t === 'circle' || e.t === 'arc') ray.push(e.r); });
    (sk.dims || []).forEach(d => val.push(+d.value));
    return { pts, ray, val, st };
  }
  function __geo() { return JSON.parse(JSON.stringify({ points: skEdit.points, entities: skEdit.entities })); }
`, ctx);
const run = (code, v) => { ctx.__v = v; return vm.runInContext(code, ctx); };

function aleas(graine) {  // mulberry32
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function session(src, graine, nbGestes) {
  const r = aleas(graine);
  const P0 = src.points || {};
  const ks = Object.keys(P0).filter(k => k !== 'O');
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  ks.forEach(k => { x0 = Math.min(x0, P0[k].x); x1 = Math.max(x1, P0[k].x); y0 = Math.min(y0, P0[k].y); y1 = Math.max(y1, P0[k].y); });
  if (!ks.length) { x0 = -40; x1 = 40; y0 = -40; y1 = 40; }
  const taille = Math.max(x1 - x0, y1 - y0, 20);
  const s = Math.max(1 / 8, Math.min(64, Math.pow(2, Math.floor(Math.log2(400 / taille)))));
  const q = v => Math.round(v * 64) / 64;
  const cx = q((x0 + x1) / 2), cy = q((y0 + y1) / 2);
  ctx.__src = src; ctx.__s = s; ctx.__cx = cx; ctx.__cy = cy;
  vm.runInContext('__sk = __ouvrir(__src, __s, __cx, __cy)', ctx);
  const pas = [];
  const faire = st => {
    if (st.x !== undefined) { st.x = q(st.x); st.y = q(st.y); }
    run('__pas(__v)', st);
    pas.push(st);
    if (process.argv.includes('--tous')) st.etat = JSON.parse(JSON.stringify(vm.runInContext('__etat(__sk)', ctx)));
  };
  const noter = () => { pas[pas.length - 1].etat = JSON.parse(JSON.stringify(vm.runInContext('__etat(__sk)', ctx))); };
  const geo = () => vm.runInContext('__geo()', ctx);
  const pick = a => a[Math.floor(r() * a.length)];
  const px = n => (r() * 2 - 1) * n / s;  // n pixels au plus
  const lieu = dep => {
    const g = geo(), ids = Object.keys(g.points), u = r();
    const lignes = g.entities.filter(e => e.t === 'line' && g.points[e.p1] && g.points[e.p2]);
    const rondes = g.entities.filter(e => (e.t === 'circle' || e.t === 'arc') && g.points[e.pc]);
    if (dep && u < 0.3) return r() < 0.5 ? { x: dep.x + px(3), y: dep.y + (r() - 0.5) * taille } : { x: dep.x + (r() - 0.5) * taille, y: dep.y + px(3) };
    if (u < 0.45 && ids.length) { const p = g.points[pick(ids)]; return { x: p.x + px(4), y: p.y + px(4) }; }
    if (u < 0.55 && lignes.length) { const l = pick(lignes), A = g.points[l.p1], B = g.points[l.p2]; return { x: (A.x + B.x) / 2 + px(3), y: (A.y + B.y) / 2 + px(3) }; }
    if (u < 0.65 && lignes.length) { const l = pick(lignes), A = g.points[l.p1], B = g.points[l.p2], t = 0.2 + 0.6 * r(); return { x: A.x + (B.x - A.x) * t + px(3), y: A.y + (B.y - A.y) * t + px(3) }; }
    if (u < 0.75 && rondes.length) { const c = pick(rondes), C = g.points[c.pc], a = r() * 6.28; return { x: C.x + c.r * Math.cos(a) + px(3), y: C.y + c.r * Math.sin(a) + px(3) }; }
    return { x: x0 + (r() * 1.3 - 0.15) * (x1 - x0), y: y0 + (r() * 1.3 - 0.15) * (y1 - y0) };
  };
  const clic = (l, c) => { faire({ a: 'bas', x: l.x, y: l.y, c: !!c }); faire({ a: 'haut', x: l.x, y: l.y }); };
  const glisser = (l, k) => {
    faire({ a: 'bas', x: l.x, y: l.y });
    let d = { x: l.x, y: l.y };
    const m = taille * (r() < 0.5 ? 0.02 : 0.15);
    for (let i = 0; i < k; i++) { d = { x: d.x + (r() - 0.5) * m, y: d.y + (r() - 0.5) * m }; faire({ a: 'bouge', x: d.x, y: d.y }); }
    if (r() < 0.2) { const c = lieu(); d = c; faire({ a: 'bouge', x: d.x, y: d.y }); }
    faire({ a: 'haut', x: d.x, y: d.y });
  };
  const surEntite = g => {
    const e = pick(g.entities);
    if (!e) return null;
    if (e.t === 'line' && g.points[e.p1] && g.points[e.p2]) { const A = g.points[e.p1], B = g.points[e.p2], t = 0.25 + r() * 0.5; return { e, x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }; }
    if ((e.t === 'circle') && g.points[e.pc]) { const C = g.points[e.pc], a = r() * 6.28; return { e, x: C.x + e.r * Math.cos(a), y: C.y + e.r * Math.sin(a) }; }
    if (e.t === 'arc' && g.points[e.pa] && g.points[e.pb]) { const A = g.points[e.pa]; return { e, x: A.x, y: A.y }; }
    return null;
  };
  // Un clic qui vise un point, une ligne ou un cercle ou arc
  const viser = (g, quoi) => {
    if (quoi === 'point') { const ids = Object.keys(g.points); return ids.length ? g.points[pick(ids)] : null; }
    const liste = g.entities.filter(e => quoi === 'ligne' ? e.t === 'line' && g.points[e.p1] && g.points[e.p2] : (e.t === 'circle' || e.t === 'arc') && g.points[e.pc]);
    const e = pick(liste);
    if (!e) return null;
    if (e.t === 'line') { const A = g.points[e.p1], B = g.points[e.p2], t = 0.25 + r() * 0.5; return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }; }
    const C = g.points[e.pc];
    let a = r() * 6.28;
    if (e.t === 'arc' && g.points[e.pa] && g.points[e.pb]) {
      const a1 = Math.atan2(g.points[e.pa].y - C.y, g.points[e.pa].x - C.x), a2 = Math.atan2(g.points[e.pb].y - C.y, g.points[e.pb].x - C.x);
      a = a1 + (((a2 - a1) % 6.283185307179586 + 6.283185307179586) % 6.283185307179586) / 2;
    }
    return { x: C.x + e.r * Math.cos(a), y: C.y + e.r * Math.sin(a) };
  };
  const CAS = [
    ['con', 'h', ['ligne']], ['con', 'v', ['ligne']], ['con', 'h', ['ligne', 'ligne']], ['con', 'parallel', ['ligne', 'ligne']], ['con', 'perpendicular', ['ligne', 'ligne']],
    ['con', 'equal', ['ligne', 'ligne']], ['con', 'equal', ['rond', 'rond']], ['con', 'collinear', ['ligne', 'ligne']], ['con', 'tangent', ['ligne', 'rond']], ['con', 'tangent', ['rond', 'rond']],
    ['con', 'coaxial', ['rond', 'rond']], ['con', 'symmetric', ['ligne', 'ligne', 'ligne']], ['con', 'fix', ['point']], ['con', 'fix', ['ligne']], ['con', 'fix', ['rond']],
    ['con', 'midpoint', ['ligne', 'ligne']], ['con', 'midpoint', ['point', 'ligne']], ['con', 'coincident', ['point', 'point']], ['con', 'coincident', ['point', 'ligne']], ['con', 'coincident', ['point', 'rond']],
    ['con', 'construction', ['ligne']], ['con', 'construction', ['rond']], ['f1', '', ['point', 'point']], ['f1', '', ['point', 'ligne']], ['f1', '', ['point', 'rond']], ['f2', '', ['ligne']], ['f2', '', ['ligne', 'ligne']],
  ];
  const vide = () => { const u = () => (r() < 0.5 ? -1 : 1) * (0.1 + r() * 0.5) * taille; return { x: (x0 + x1) / 2 + u(), y: (y0 + y1) / 2 + u() }; };
  const SORTES_COTE = [['ligne'], ['ligne'], ['rond'], ['rond'], ['point', 'point'], ['ligne', 'ligne'], ['ligne', 'rond'], ['ligne', 'point'], ['rond', 'rond'], ['rond', 'ligne'], ['rond', 'point'], ['L', 'L'], ['L', 'L'], ['L', 'L']];
  const gestes = {
    coteOutil() {
      const cibles = pick(SORTES_COTE);
      faire({ a: 'outil', o: 'dim' });
      const paire = cibles[0] === 'L';
      cibles.forEach((q, i) => { const l = viser(geo(), q === 'L' ? 'ligne' : q); if (l) clic(l, paire); });
      for (let i = 1 + Math.floor(r() * 3); i > 0; i--) { const l = r() < 0.5 ? vide() : lieu(); faire({ a: 'bouge', x: l.x, y: l.y }); }
      const fin = r();
      if (fin < 0.6) clic(vide());
      else if (fin < 0.7) faire({ a: 'touche', k: 'Enter' });
      else if (fin < 0.8) faire({ a: 'touche', k: '5' });
      else if (fin < 0.9) faire({ a: 'echap' });
      else { const l = lieu(); clic(l); faire({ a: 'bouge', x: l.x + 1, y: l.y + 1 }); clic(vide()); }
      faire({ a: 'outil', o: 'select' });
    },
    ajuster() {
      // Une ligne qui traverse de temps en temps, pour de vraies coupes en plein milieu
      if (r() < 0.5) {
        const c = viser(geo(), r() < 0.6 ? 'ligne' : 'rond');
        if (c) {
          const a = r() * 6.283185307179586, l = (0.1 + r() * 0.4) * taille;
          faire({ a: 'outil', o: 'line' });
          clic({ x: c.x - l * Math.cos(a), y: c.y - l * Math.sin(a) });
          faire({ a: 'bouge', x: c.x + l * Math.cos(a), y: c.y + l * Math.sin(a) });
          clic({ x: c.x + l * Math.cos(a), y: c.y + l * Math.sin(a) });
          faire({ a: 'echap' });
        }
      }
      faire({ a: 'outil', o: 'trim' });
      for (let i = 1 + Math.floor(r() * 3); i > 0; i--) {
        const l = viser(geo(), r() < 0.65 ? 'ligne' : 'rond') || lieu();
        clic({ x: l.x + px(4), y: l.y + px(4) });
      }
      if (r() < 0.2) clic(vide());
      faire({ a: r() < 0.5 ? 'echap' : 'outil', o: 'select' });
    },
    decaler() {
      const g = geo();
      const utiles = g.entities.filter(e => (e.t === 'line' && g.points[e.p1] && g.points[e.p2]) || ((e.t === 'circle' || e.t === 'arc') && g.points[e.pc] && (e.t === 'circle' || (g.points[e.pa] && g.points[e.pb]))));
      if (!utiles.length) return;
      const surE = e => {
        if (e.t === 'line') { const A = g.points[e.p1], B = g.points[e.p2]; return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }; }
        const C = g.points[e.pc];
        let a = r() * 6.28;
        if (e.t === 'arc') {
          const a1 = Math.atan2(g.points[e.pa].y - C.y, g.points[e.pa].x - C.x), a2 = Math.atan2(g.points[e.pb].y - C.y, g.points[e.pb].x - C.x);
          a = a1 + (((a2 - a1) % 6.283185307179586 + 6.283185307179586) % 6.283185307179586) / 2;
        }
        return { x: C.x + e.r * Math.cos(a), y: C.y + e.r * Math.sin(a) };
      };
      // Une seule entité, quelques-unes au hasard, ou toute une chaîne reliée (contour fermé compris)
      let choix = [pick(utiles)];
      const u = r();
      if (u < 0.2) { for (let i = 1 + Math.floor(r() * 2); i > 0; i--) choix.push(pick(utiles)); }
      else if (u < 0.75) {
        const pts = new Set(), bouts = e => e.t === 'line' ? [e.p1, e.p2] : e.t === 'arc' ? [e.pa, e.pb] : [];
        bouts(choix[0]).forEach(p => pts.add(p));
        for (let ajout = true; ajout && choix.length < 12;) {
          ajout = false;
          for (const e of utiles) if (!choix.includes(e) && bouts(e).some(p => pts.has(p))) { choix.push(e); bouts(e).forEach(p => pts.add(p)); ajout = true; if (choix.length >= 12) break; }
        }
      }
      faire({ a: 'outil', o: 'select' });
      choix.forEach((e, i) => clic(surE(e), i > 0));
      faire({ a: 'outil', o: 'offset' });
      clic(vide());
      const cote = r() < 0.6 ? vide() : lieu();
      faire({ a: 'bouge', x: cote.x, y: cote.y });
      const fin = r();
      if (fin < 0.85) clic(cote);
      else if (fin < 0.92) clic({ x: choix[0].x || cote.x, y: choix[0].y || cote.y });
      faire({ a: 'echap' });
    },
    decalerTape() {
      const g = geo();
      const utiles = g.entities.filter(e => (e.t === 'line' && g.points[e.p1] && g.points[e.p2]) || (e.t === 'circle' && g.points[e.pc]) || (e.t === 'arc' && g.points[e.pc] && g.points[e.pa] && g.points[e.pb]));
      if (!utiles.length) return;
      const A = pick(utiles);
      const sur = A.t === 'line' ? { x: (g.points[A.p1].x + g.points[A.p2].x) / 2, y: (g.points[A.p1].y + g.points[A.p2].y) / 2 } : { x: g.points[A.pc].x + A.r, y: g.points[A.pc].y };
      faire({ a: 'outil', o: 'select' });
      clic(sur);
      faire({ a: 'outil', o: 'offset' });
      clic(vide());
      const cote = r() < 0.6 ? vide() : lieu();
      faire({ a: 'offD', x: cote.x, y: cote.y, t: String(+(0.5 + r() * 30).toFixed(r() < 0.5 ? 1 : 3)) });
      faire({ a: 'echap' });
    },
    longueurTapee() {
      faire({ a: 'outil', o: 'line' });
      const dep = lieu();
      clic(dep);
      if (r() < 0.85) { const l = lieu(dep); faire({ a: 'bouge', x: l.x, y: l.y }); }
      const mode = r();
      if (mode < 0.5) {
        faire({ a: 'touche', k: String(1 + Math.floor(r() * 9)) });
        faire({ a: 'touche', k: String(Math.floor(r() * 10)) });
        if (r() < 0.3) { faire({ a: 'touche', k: r() < 0.5 ? ',' : '.' }); faire({ a: 'touche', k: String(Math.floor(r() * 10)) }); }
        if (r() < 0.2) faire({ a: 'touche', k: 'Backspace' });
      } else if (mode < 0.8) {
        faire({ a: 'touche', k: 'Tab' });
        faire({ a: 'touche', k: 'Tab' });
        faire({ a: 'touche', k: String(1 + Math.floor(r() * 9)) });
        faire({ a: 'touche', k: '0' });
      } else {
        faire({ a: 'touche', k: 'Tab' });
        if (r() < 0.3) faire({ a: 'touche', k: '0' });
      }
      const fin = r();
      if (fin < 0.6) faire({ a: 'touche', k: 'Enter' });
      else if (fin < 0.85) { const l = lieu(); clic(l); }
      faire({ a: 'echap' });
    },
    contrainte() {
      const [a, t, cibles] = pick(CAS);
      faire({ a: 'outil', o: 'select' });
      cibles.forEach((q, i) => { const l = viser(geo(), q); if (l) clic(l, i > 0); });
      faire(a === 'con' ? { a, t } : { a });
      // F1 sans choix qui convienne arme l'outil Coïncident du navigateur, pas encore traduit : on en sort
      faire({ a: 'outil', o: 'select' });
    },
    glissePoint() {
      const g = geo(), ids = Object.keys(g.points);
      if (!ids.length) return;
      const p = g.points[pick(ids)];
      faire({ a: 'outil', o: 'select' });
      glisser({ x: p.x + px(2), y: p.y + px(2) }, 1 + Math.floor(r() * 3));
    },
    glisseEntite() {
      const l = surEntite(geo());
      if (!l) return;
      faire({ a: 'outil', o: 'select' });
      glisser(l, 1 + Math.floor(r() * 3));
    },
    ligne() {
      faire({ a: 'outil', o: 'line' });
      let dep = lieu();
      clic(dep);
      const n = 1 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const l = lieu(dep);
        faire({ a: 'bouge', x: (l.x + dep.x) / 2, y: (l.y + dep.y) / 2 });
        faire({ a: 'bouge', x: l.x, y: l.y });
        clic(l);
        dep = l;
      }
      faire({ a: 'echap' });
    },
    ligneGlissee() {
      faire({ a: 'outil', o: 'line' });
      const a = lieu(), b = lieu(a);
      faire({ a: 'bas', x: a.x, y: a.y });
      faire({ a: 'bouge', x: b.x, y: b.y });
      faire({ a: 'haut', x: b.x, y: b.y });
      faire({ a: 'echap' });
    },
    rectangle() {
      faire({ a: 'outil', o: 'rect' });
      const a = lieu(), b = lieu(), c = r() < 0.35;
      clic(a, c);
      faire({ a: 'bouge', x: b.x, y: b.y });
      clic(b);
      faire({ a: 'echap' });
    },
    cercle() {
      faire({ a: 'outil', o: 'circle' });
      const a = lieu(), b = lieu();
      clic(a);
      faire({ a: 'bouge', x: b.x, y: b.y });
      clic(b);
      faire({ a: 'echap' });
    },
    arc() {
      faire({ a: 'outil', o: 'arc' });
      const a = lieu(), b = lieu(), c = lieu();
      clic(a);
      faire({ a: 'bouge', x: b.x, y: b.y });
      clic(b);
      faire({ a: 'bouge', x: c.x, y: c.y });
      clic(c);
      faire({ a: 'echap' });
    },
    coter() {
      const l = surEntite(geo());
      if (!l) return;
      faire({ a: 'outil', o: 'select' });
      faire({ a: 'dbl', x: l.x, y: l.y });
    },
    effacer() {
      const l = surEntite(geo());
      if (!l) return;
      faire({ a: 'outil', o: 'select' });
      clic(l);
      faire({ a: 'suppr' });
    },
    effacerPoint() {
      const g = geo(), ids = Object.keys(g.points);
      if (!ids.length) return;
      const p = g.points[pick(ids)];
      faire({ a: 'outil', o: 'select' });
      clic(p);
      faire({ a: 'suppr' });
    },
  };
  const noms = ['glissePoint', 'glissePoint', 'glisseEntite', 'glisseEntite', 'ligne', 'ligne', 'ligneGlissee', 'rectangle', 'rectangle', 'cercle', 'arc', 'coter', 'effacer', 'effacerPoint'];
  if (process.argv.includes('--contraintes')) noms.push(...Array(10).fill('contrainte'));
  if (process.argv.includes('--cotes')) noms.push(...Array(8).fill('coteOutil'), ...Array(5).fill('longueurTapee'));
  if (process.argv.includes('--modifier')) noms.push(...Array(10).fill('ajuster'), ...Array(10).fill('decaler'));
  if (process.argv.includes('--tape')) noms.push(...Array(8).fill('decalerTape'));
  for (let i = 0; i < nbGestes; i++) {
    const avant = pas.length;
    const nom = pick(noms);
    gestes[nom]();
    if (pas.length > avant) { pas[avant].geste = nom; noter(); }
  }
  const final = JSON.parse(vm.runInContext('JSON.stringify(__sk)', ctx));
  // Le refus d'une contrainte recalcule les formules des cotes. Ici le document n'a que cette esquisse, sans paramètres :
  // une formule qui vise autre chose ne peut pas se calculer, garde sa valeur et s'en plaint. C'est propre au banc, pas à la pièce.
  (final.dims || []).forEach(d => { if (d.exprErr && !(src.dims || []).some(o => o.id === d.id && o.exprErr)) delete d.exprErr; });
  return { graine, s, cx, cy, pas, final };
}

const sortie = [];
const t0 = horlogeReelle();
const fichiers = fs.readdirSync(dossier).filter(f => f.endsWith('.conceptcad') && (!nomVoulu || f.includes(nomVoulu))).sort();
let nE = 0, nG = 0;
const vide = { id: '(vide)', name: 'vide', plane: 'XY', points: {}, entities: [], constraints: [], dims: [] };
if (!nomVoulu) {
  const sessions = [];
  for (let k = 0; k < 8; k++) sessions.push(session(vide, 1000 + k, 25));
  sortie.push({ fichier: '', esquisse: '(vide)', sessions });
  sessions.forEach(x => { nG += x.pas.length; });
}
for (const f of fichiers) {
  let es;
  try { es = lireDoc(path.join(dossier, f)).sketches || []; } catch (e) { console.log('illisible', f); continue; }
  for (const s of es) {
    const n = Object.keys(s.points || {}).length;
    if ((s.entities || []).some(e => e.t === 'spline')) continue;
    const sessions = [];
    const debut = horlogeReelle();
    const nbS = n > 120 ? 1 : nbSessions, nbGe = n > 120 ? 5 : 12;
    for (let k = 0; k < nbS; k++) sessions.push(session(s, nE * 100 + k + 1, nbGe));
    sortie.push({ fichier: f, esquisse: s.id, sessions });
    sessions.forEach(x => { nG += x.pas.length; });
    nE++;
    const ms = horlogeReelle() - debut;
    if (ms > 20000) console.log(`  ${f} ${s.id} : ${n} points, ${(ms / 1000).toFixed(0)} s`);
  }
  console.log(`${f} fait, ${((horlogeReelle() - t0) / 1000).toFixed(0)} s`);
}
fs.writeFileSync(cible, JSON.stringify(sortie));
console.log(`${nE} esquisses, ${nG} pas, ${(fs.statSync(cible).size / 1e6).toFixed(1)} Mo, ${((horlogeReelle() - t0) / 1000).toFixed(0)} s`);
process.exit(0);
