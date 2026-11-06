// Splines en volume : le natif calcule-t-il la même pièce que le navigateur ?
// Des esquisses à splines tirées au hasard mais reproductibles (fermée, par points de contrôle, fermée par une ligne,
// deux splines, jonction en T, trou, poche) sont écrites puis ouvertes par les deux. Comparés : volume, aire, faces, arêtes, solides, validité.
// node natif/mesures/tester-splines.cjs <dossier de travail> [--tirages=6] [--url=ConceptCAD.html] [--exe=...] [--racine=dépôt dont le navigateur est servi]
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os');
const { spawn, spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const opts = process.argv.slice(2).filter(a => a.startsWith('--'));
const [dossier] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const opt = (n, d) => { const o = opts.find(a => a.startsWith(`--${n}=`)); return o ? o.slice(n.length + 3) : d; };
const EXE = opt('exe', path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe'));
const URL_APP = opt('url', 'ConceptCAD.html'), TIRAGES = +opt('tirages', 6);
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
const FICHIER = path.join(dossier, 'cas.conceptcad');
const SEUIL = 2e-5;
const proche = (a, b) => Math.abs((a || 0) - (b || 0)) <= Math.max(1e-2, SEUIL * Math.abs(b || 0));

function hasard(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function natif(f) {
  const v = path.join(dossier, 'v.json');
  fs.rmSync(v, { force: true });
  const q = spawnSync(EXE, ['--verif', f, v], { encoding: 'utf8', timeout: 180000 });
  if (q.error && q.error.code === 'ETIMEDOUT') return { echec: 'bloqué plus de 3 min' };
  if (!fs.existsSync(v)) return { echec: 'arrêt du programme, code ' + q.status };
  const j = JSON.parse(fs.readFileSync(v, 'utf8'));
  if (j.erreur) return { echec: j.erreur };
  return Object.assign({}, j.cas[0], { refus: j.nonPrisEnCharge });
}

// ---- Les esquisses
function esquisse(id, construire) {
  const sk = { id, name: id, plane: 'XY', origin: [0, 0, 0], axU: [1, 0, 0], axV: [0, 1, 0], axN: [0, 0, 1], points: {}, entities: [], constraints: [], seq: 1, visible: false };
  let n = 0;
  const P = (x, y) => { const p = 'p' + (++n); sk.points[p] = { x, y }; return p; };
  const E = o => { const e = Object.assign({ id: 'e' + (++n) }, o); sk.entities.push(e); return e; };
  construire(P, E, sk);
  sk.seq = n + 1;
  return sk;
}
// Une couronne de points autour de (cx, cy), en sens direct, irrégulière
const couronne = (P, h, cx, cy, r, nb) => {
  const ids = [];
  for (let i = 0; i < nb; i++) {
    const a = 2 * Math.PI * (i + 0.25 * (h() - 0.5)) / nb, R = r * (0.75 + 0.35 * h());
    ids.push(P(cx + R * Math.cos(a), cy + R * Math.sin(a)));
  }
  return ids;
};
// Un arc de points de gauche à droite au-dessus de y0
const dessus = (P, h, x0, x1, y0, nb) => {
  const ids = [P(x0, y0)];
  for (let i = 1; i < nb - 1; i++) ids.push(P(x0 + (x1 - x0) * i / (nb - 1), y0 + 8 + 14 * h()));
  ids.push(P(x1, y0));
  return ids;
};
const rectangle = (P, E, x0, y0, x1, y1) => {
  const a = P(x0, y0), b = P(x1, y0), c = P(x1, y1), d = P(x0, y1);
  [[a, b], [b, c], [c, d], [d, a]].forEach(([p1, p2]) => E({ t: 'line', p1, p2 }));
};
const FORMES = {
  'fermée par passage': (h) => (P, E) => E({ t: 'spline', mode: 'fit', closed: true, pts: couronne(P, h, 10, 5, 20, 3 + Math.floor(h() * 5)) }),
  'fermée par contrôle': (h) => (P, E) => E({ t: 'spline', mode: 'ctrl', closed: true, pts: couronne(P, h, -5, 8, 25, 4 + Math.floor(h() * 5)) }),
  'ouverte et une ligne': (h) => (P, E) => { const ids = dessus(P, h, 0, 50, 0, 3 + Math.floor(h() * 4)); E({ t: 'spline', mode: 'fit', pts: ids }); E({ t: 'line', p1: ids[ids.length - 1], p2: ids[0] }); },
  'contrôle et une ligne': (h) => (P, E) => { const ids = dessus(P, h, 0, 50, 0, 4 + Math.floor(h() * 4)); E({ t: 'spline', mode: 'ctrl', pts: ids }); E({ t: 'line', p1: ids[ids.length - 1], p2: ids[0] }); },
  'deux splines': (h) => (P, E) => {
    const a = P(0, 0), b = P(60, 0), haut = [a, P(20, 10 + 8 * h()), P(40, 12 + 8 * h()), b], bas = [b, P(40, -10 - 8 * h()), P(20, -12 - 8 * h()), a];
    E({ t: 'spline', mode: 'fit', pts: haut }); E({ t: 'spline', mode: h() < 0.5 ? 'fit' : 'ctrl', pts: bas });
  },
  'jonction en T': (h) => (P, E) => {
    const ids = dessus(P, h, 0, 60, 0, 5); E({ t: 'spline', mode: 'fit', pts: ids });
    E({ t: 'line', p1: ids[ids.length - 1], p2: ids[0] });
    const m = P(25 + 10 * h(), 0);
    E({ t: 'line', p1: ids[2], p2: m });
  },
  'avec poignée': (h) => (P, E) => {
    const ids = dessus(P, h, 0, 50, 0, 4), q = P(50 + 8, 8 + 6 * h());
    const s = E({ t: 'spline', mode: 'fit', pts: ids });
    E({ t: 'line', p1: ids[3], p2: q, construction: true, handle: s.id });
    E({ t: 'line', p1: ids[3], p2: ids[0] });
  },
  'trou dans un rectangle': (h) => (P, E) => { rectangle(P, E, -40, -40, 40, 40); E({ t: 'spline', mode: h() < 0.5 ? 'fit' : 'ctrl', closed: true, pts: couronne(P, h, 0, 0, 20, 5) }); },
  'spline dans un trou': (h) => (P, E) => { rectangle(P, E, -60, -60, 60, 60); rectangle(P, E, -40, -40, 40, 40); E({ t: 'spline', mode: 'fit', closed: true, pts: couronne(P, h, 0, 0, 15, 5) }); },
  'arc et spline': (h) => (P, E) => {
    const a = P(25, 0), b = P(-25, 0), c = P(0, 0);
    E({ t: 'arc', pc: c, pa: b, pb: a, r: 25 });
    const ids = [a, P(12, 12 + 6 * h()), P(-12, 12 + 6 * h()), b];
    E({ t: 'spline', mode: 'fit', pts: ids });
  },
};
function document(nom, h) {
  const sk = esquisse('sk_1', FORMES[nom](h));
  const dist = 5 + Math.round(h() * 30);
  const features = [{ id: 'ex_1', type: 'extrude', name: 'E1', sketchId: 'sk_1', distance: dist, op: 'add', visible: true, mid: h() < 0.2, upto: null, body: 'b1' }];
  const sketches = [sk];
  if (h() < 0.3) {  // une poche à spline dans la pièce
    sketches.push(esquisse('sk_2', (P, E) => { E({ t: 'spline', mode: 'fit', closed: true, pts: couronne(P, h, 15, 8, 5, 4) }); }));
    sketches[1].origin = [0, 0, dist];
    features.push({ id: 'ex_2', type: 'extrude', name: 'E2', sketchId: 'sk_2', distance: -3, op: 'cut', visible: true, mid: false, upto: null, body: 'b1' });
  }
  return { app: 'ConceptCAD', v: 1, name: 'cas', tint: 0, entNames: {}, originVis: true, view: null, bodyVis: {}, bodies: [{ id: 'b1', name: 'Corps 1' }], bodySeq: 2, activeBody: 'b1', fold: {}, fao: null, mep: null, params: [], sel: null, sketches, features, cgeo: [] };
}

(async () => {
  const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r));
  const serveur = spawn(process.execPath, [path.join(opt('racine', RACINE), 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-spl-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
  let page;
  const ouvrir = async () => {
    if (page) await page.close().catch(() => {});
    page = await ctx.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(`http://127.0.0.1:${port}/${URL_APP}?mono`);
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
  };
  await ouvrir();
  const charger = async (f, n) => {
    await page.evaluate(() => { mffPendingOpen = true; doc = { name: '', sketches: [], features: [], cgeo: [], bodyVis: {}, bodies: [], bodySeq: 1, activeBody: null, mep: null }; });
    await page.setInputFiles('#fileProj', f);
    await page.waitForFunction(n => doc && (doc.features || []).length === n, n, { timeout: 120000 });
    await attendre(200);
    await page.waitForFunction(() => !skEdit && rebuildDepth === 0, null, { timeout: 120000 });
    await attendre(50);
  };
  const mesureNav = () => page.evaluate(() => {
    const sh = typeof occLive !== 'undefined' && occLive && occLive.shape;
    if (!sh) return { volume: 0, aire: 0, faces: 0, aretes: 0, solides: 0, valide: false, vide: true };
    const E = occt.TopAbs_ShapeEnum, compter = t => { let n = 0; const x = new occt.TopExp_Explorer_2(sh, t, E.TopAbs_SHAPE); while (x.More()) { n++; x.Next(); } x.delete(); return n; };
    const G = new occt.GProp_GProps_1(); occt.BRepGProp.SurfaceProperties_1(sh, G, false, false); const aire = G.Mass(); G.delete();
    return { volume: occCoqueVolume(sh), aire, faces: compter(E.TopAbs_FACE), aretes: compter(E.TopAbs_EDGE), solides: compter(E.TopAbs_SOLID), valide: occCoqueValide(sh) };
  });
  const bilan = { justes: 0, vides: 0, ecarts: [], refus: 0 };
  try {
    let graine = 1000;
    for (const nom of Object.keys(FORMES)) {
      let ok = 0, tot = 0;
      for (let t = 0; t < TIRAGES; t++) {
        graine++;
        const d = document(nom, hasard(graine));
        const quoi = `${nom} (graine ${graine})`;
        fs.writeFileSync(FICHIER, JSON.stringify(d));
        const n = natif(FICHIER);
        tot++;
        if (n.refus && n.refus.length) { bilan.refus++; console.log(`REFUS ${quoi} : ${JSON.stringify(n.refus)}`); continue; }
        let b;
        try {
          await charger(FICHIER, d.features.length);
          b = await mesureNav();
        } catch (e) { console.log('navigateur bloqué : ' + quoi + ' : ' + String(e).slice(0, 200)); await ouvrir().catch(() => {}); continue; }
        if (n.echec) { bilan.ecarts.push({ quoi, natif: n.echec, nav: b }); fs.copyFileSync(FICHIER, path.join(dossier, `ecart-${graine}.conceptcad`)); console.log(`ÉCART ${quoi} : natif ${n.echec} | navigateur V=${b.volume}`); continue; }
        const juste = proche(n.volume, b.volume) && proche(n.aire, b.aire) && n.faces === b.faces && n.aretes === b.aretes && n.solides === b.solides && n.valide === b.valide;
        if (juste) { bilan.justes++; ok++; if (b.vide) bilan.vides++; } else {
          bilan.ecarts.push({ quoi, natif: n, nav: b });
          fs.copyFileSync(FICHIER, path.join(dossier, `ecart-${graine}.conceptcad`));
          console.log(`ÉCART ${quoi} : natif V=${(n.volume || 0).toFixed(3)} A=${(n.aire || 0).toFixed(2)} f=${n.faces} a=${n.aretes} s=${n.solides} ${n.valide} | navigateur V=${(b.volume || 0).toFixed(3)} A=${(b.aire || 0).toFixed(2)} f=${b.faces} a=${b.aretes} s=${b.solides} ${b.valide}`);
        }
      }
      console.log(`${nom} : ${ok}/${tot}`);
    }
  } finally {
    await ctx.close().catch(() => {});
    serveur.kill();
  }
  console.log(`bilan : ${bilan.justes} pièces identiques (dont ${bilan.vides} vides), ${bilan.ecarts.length} écarts, ${bilan.refus} refus`);
  process.exit(bilan.ecarts.length ? 1 : 0);
})();
