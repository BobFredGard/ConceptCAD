// Outil Intersection : le natif crée-t-il les mêmes courbes que le navigateur, sur de vraies pièces ?
// Une esquisse vide est ajoutée à la pièce sur 4 plans qui la traversent (3 axes et un plan de biais). Sur chacun, les mêmes
// gestes des deux côtés : clic sur une courbe (une face), Ctrl+clic puis Entrée (deux faces), Maj+clic (le corps), « tous les corps ».
// Comparés : les entités (sorte, points, rayon, noms, source), les contraintes, les points. Les fichiers d'exemples sont seulement lus.
// node natif/mesures/tester-intersection.cjs <dossier d'exemples> <dossier de travail> [--nom=extrait] [--racine=dépôt servi] [--exe=...]
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const opts = process.argv.slice(2).filter(a => a.startsWith('--'));
const [source, dossier] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const opt = (n, d) => { const o = opts.find(a => a.startsWith(`--${n}=`)); return o ? o.slice(n.length + 3) : d; };
const EXE = path.resolve(opt('exe', path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe')));
const EXTRAIT = opt('nom', '');
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); const j = JSON.parse(b); return j.doc || j; };
const FICHIER = path.resolve(dossier, 'cas.conceptcad');
const TOL = 2e-4;
const INTERSECTION = 18;  // rang de l'outil dans le programme

function verif(f) {
  const v = path.join(dossier, 'v.json');
  fs.rmSync(v, { force: true });
  const q = spawnSync(EXE, ['--verif', f, v], { encoding: 'utf8', timeout: 180000 });
  if (!fs.existsSync(v)) return { echec: 'code ' + q.status };
  const j = JSON.parse(fs.readFileSync(v, 'utf8'));
  return j.erreur ? { echec: j.erreur } : Object.assign({}, j.cas[0], { refus: j.nonPrisEnCharge });
}
// Le programme joue les gestes dans sa vraie fenêtre, sans prendre la main
function gestesNatif(rang, etapes) {
  const d = path.resolve(dossier, 'n');
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  const fe = path.join(d, 'etapes.json'), so = path.join(d, 'sortie.conceptcad');
  fs.writeFileSync(fe, JSON.stringify(etapes));
  const q = spawnSync(EXE, ['--essai-esquisse', FICHIER, String(rang), so, fe, d], { timeout: 240000 });
  if (!fs.existsSync(so)) return { echec: 'pas de fichier, code ' + q.status };
  return { doc: lire(so) };
}
const ecart = (a, b, tol) => Math.abs((a || 0) - (b || 0)) > tol;
function comparer(A, B) {  // A : natif, B : navigateur
  const E = [], ea = A.entities || [], eb = B.entities || [];
  if (ea.length !== eb.length) E.push(`entités ${ea.length} / ${eb.length} : ${ea.map(e => e.t).join()} / ${eb.map(e => e.t).join()}`);
  // L'ordre des courbes suit celui du noyau : on apparie par forme
  const pa = A.points || {}, pb = B.points || {};
  const signe = (e, P) => {
    const q = id => P[id] ? [+P[id].x.toFixed(2) + 0, +P[id].y.toFixed(2) + 0] : null;
    if (e.t === 'line') return 'line' + [q(e.p1), q(e.p2)].map(String).sort().join('|');
    if (e.t === 'circle') return 'circle' + q(e.pc) + '|' + (+e.r).toFixed(2);
    if (e.t === 'arc') return 'arc' + q(e.pc) + '|' + q(e.pa) + '|' + q(e.pb);
    return 'spline' + (e.pts || []).length + (e.closed ? 'f' : '');
  };
  const restant = eb.slice();
  for (const e of ea) {
    const s = signe(e, pa), i = restant.findIndex(x => signe(x, pb) === s);
    if (i < 0) { E.push(`entité sans pareille : ${s}`); continue; }
    const f = restant.splice(i, 1)[0];
    for (const k of ['t', 'construction', 'proj', 'srcName', 'isplN', 'closed']) if ((e[k] || false) !== (f[k] || false)) E.push(`${e.id} ${k} : ${e[k]} / ${f[k]}`);
    if (ecart(e.r, f.r, TOL)) E.push(`${e.id} r : ${e.r} / ${f.r}`);
    if (e.t === 'spline') {
      (e.pts || []).forEach((p, n) => { const a = pa[p], b = pb[(f.pts || [])[n]]; if (!a || !b || ecart(a.x, b.x, TOL) || ecart(a.y, b.y, TOL)) E.push(`${e.id} point ${n}`); });
    }
    const ia = e.isect || {}, ib = f.isect || {};
    if (ia.mode !== ib.mode) E.push(`${e.id} source : ${ia.mode} / ${ib.mode}`);
    if ((ia.faces || []).length !== (ib.faces || []).length) E.push(`${e.id} faces : ${(ia.faces || []).length} / ${(ib.faces || []).length}`);
    (ia.faces || []).forEach((x, n) => {
      const y = ib.faces[n];
      if (!y || x.st !== y.st || x.pos.some((v, m) => ecart(v, y.pos[m], 0.02)) || x.dim.some((v, m) => ecart(v, y.dim[m], x.st === 'Plane' ? 0.02 : 0.5)) || !!x.n !== !!y.n || (x.n && x.n.some((v, m) => ecart(v, y.n[m], 1e-3)))) E.push(`${e.id} face ${n} : ${JSON.stringify(x)} / ${JSON.stringify(y)}`);
    });
    if (!!ia.pt !== !!ib.pt) E.push(`${e.id} point du corps`);
  }
  const tri = L => (L || []).map(c => c.type + (c.ent ? 'e' : 'p')).sort().join();
  if (tri(A.constraints) !== tri(B.constraints)) E.push(`contraintes : ${(A.constraints || []).length} / ${(B.constraints || []).length}`);
  if (Object.keys(pa).length !== Object.keys(pb).length) E.push(`points : ${Object.keys(pa).length} / ${Object.keys(pb).length}`);
  return E;
}

(async () => {
  const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r));
  const serveur = spawn(process.execPath, [path.join(opt('racine', RACINE), 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-is-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
  let page;
  const ouvrir = async () => {
    if (page) await page.close().catch(() => {});
    page = await ctx.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html?mono`);
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
  };
  await ouvrir();
  const charger = async (f, n, axN) => {
    await page.evaluate(() => { mffPendingOpen = true; doc = { name: '', sketches: [], features: [], cgeo: [], bodyVis: {}, bodies: [], bodySeq: 1, activeBody: null, mep: null }; });
    await page.setInputFiles('#fileProj', f);
    // Le plan attendu, pas seulement le nombre de fonctions : sans lui on lit encore le plan de l'essai précédent
    await page.waitForFunction(([n, axN]) => doc && (doc.features || []).length === n && (doc.sketches || []).some(k => k.id === 'sk_essai' && JSON.stringify(k.axN) === axN), [n, JSON.stringify(axN)], { timeout: 120000 });
    await attendre(200);
    await page.waitForFunction(() => !skEdit && rebuildDepth === 0, null, { timeout: 120000 });
    await attendre(50);
  };
  const bilan = { justes: 0, ecarts: 0, sans: 0, courbes: {} };
  const fichiers = fs.readdirSync(source).filter(n => n.endsWith('.conceptcad') && (!EXTRAIT || n.includes(EXTRAIT))).sort().map(n => path.join(source, n));
  // Pièce faite ici : les exemples que le programme sait calculer ne coupent que des faces planes.
  // Un oblong percé donne des cercles et des arcs à plat, et des ellipses (courbes libres) en biais.
  const FORMES = path.resolve(dossier, 'oblong-perce.conceptcad');
  fs.writeFileSync(FORMES, JSON.stringify({
    app: 'minifusion', v: 1, name: 'Oblong percé', bodies: [{ id: 'b1', name: 'Corps 1', visible: true }], bodySeq: 2, activeBody: 'b1', cgeo: [],
    sketches: [{
      id: 'sk_o', name: 'Esquisse 1', plane: 'XY', origin: [0, 0, 0], axU: [1, 0, 0], axV: [0, 1, 0], axN: [0, 0, 1], visible: false, seq: 20, dims: [], constraints: [],
      points: { O: { x: 0, y: 0 }, c1: { x: 40, y: 0 }, a1: { x: 40, y: -20 }, b1: { x: 40, y: 20 }, c2: { x: -40, y: 0 }, a2: { x: -40, y: 20 }, b2: { x: -40, y: -20 } },
      entities: [
        { id: 'e1', t: 'arc', pc: 'c1', pa: 'a1', pb: 'b1', r: 20 }, { id: 'e2', t: 'line', p1: 'b1', p2: 'a2' },
        { id: 'e3', t: 'arc', pc: 'c2', pa: 'a2', pb: 'b2', r: 20 }, { id: 'e4', t: 'line', p1: 'b2', p2: 'a1' },
      ],
    }, {
      id: 'sk_t', name: 'Esquisse 2', plane: 'XY', origin: [0, 0, 0], axU: [1, 0, 0], axV: [0, 1, 0], axN: [0, 0, 1], visible: false, seq: 5, dims: [], constraints: [],
      points: { O: { x: 0, y: 0 }, tr: { x: 5, y: 3 } }, entities: [{ id: 'e1', t: 'circle', pc: 'tr', r: 8 }],
    }],
    features: [
      { id: 'ex_o', type: 'extrude', name: 'Extrusion', sketchId: 'sk_o', distance: 30, op: 'add', visible: true, mid: false, upto: null, body: 'b1' },
      { id: 'ex_t', type: 'extrude', name: 'Trou', sketchId: 'sk_t', distance: 30, op: 'cut', visible: true, mid: false, upto: null, body: 'b1' },
    ],
  }));
  if (!EXTRAIT || 'oblong'.includes(EXTRAIT)) fichiers.unshift(FORMES);
  try {
    for (const chemin of fichiers) {
      const nom = path.basename(chemin);
      let d0;
      try { d0 = lire(chemin); } catch (e) { continue; }
      if (!d0.features || !d0.features.length) continue;
      const n0 = verif(chemin);
      if (n0.echec || (n0.refus && n0.refus.length) || !n0.volume) { bilan.sans++; continue; }
      const b = n0.boite || [0, 0, 0, 0, 0, 0];
      const c = [(b[0] + b[3]) / 2 + 0.37, (b[1] + b[4]) / 2 + 0.23, (b[2] + b[5]) / 2 + 0.11];
      const R = Math.SQRT1_2, R3 = Math.sqrt(1 / 3), R6 = Math.sqrt(1 / 6);
      const plans = [
        { nom: 'XY', u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] },
        { nom: 'XZ', u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] },
        { nom: 'YZ', u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0] },
        { nom: 'biais', u: [R, -R, 0], v: [R6, R6, -2 * R6], n: [R3, R3, R3] },
      ];
      // La boîte d'une face courbe dépend de son maillage (45,108 contre 45) : le navigateur retrouve la face la plus proche
      const pente = 25 * Math.PI / 180;
      plans.push({ nom: 'pente', u: [Math.cos(pente), 0, -Math.sin(pente)], v: [0, 1, 0], n: [Math.sin(pente), 0, Math.cos(pente)] });
      for (const P of plans) {
        const id = 'sk_essai';
        const sk = { id, name: 'Essai ' + P.nom, plane: 'XY', origin: c, axU: P.u, axV: P.v, axN: P.n, points: { O: { x: 0, y: 0 } }, entities: [{ id: 'e2', t: 'cpoint', p: 'O', construction: true }], constraints: [], seq: 3, visible: true };  // le navigateur retire une esquisse vide à l'ouverture
        const d = Object.assign({}, d0, { sketches: (d0.sketches || []).concat([sk]) });
        const rang = d.sketches.length - 1;
        fs.writeFileSync(FICHIER, JSON.stringify(d));
        await charger(FICHIER, d.features.length, P.n);
        const prep = await page.evaluate(id => {
          openSketch(id);
          skIsectReset();  // les candidates restent en mémoire d'un plan à l'autre
          const sk = skEdit, L = skIsectCandidates(sk);
          const un = c => c.type === 'line' ? [(c.x1 + c.x2) / 2, (c.y1 + c.y2) / 2] : c.type === 'circle' ? [c.cx + c.r, c.cy] : c.type === 'arc' ? (() => { const a = Math.atan2(c.y1 - c.cy, c.x1 - c.cx); let dd = Math.atan2(c.y2 - c.cy, c.x2 - c.cx) - a; while (dd <= 0) dd += 2 * Math.PI; return [c.cx + c.r * Math.cos(a + dd / 2), c.cy + c.r * Math.sin(a + dd / 2)]; })() : c.dense[128];
          const out = L.map(c => ({ t: c.type, fk: c.fk, at: un(c) }));
          closeSketch(false);
          return out;
        }, id);
        if (!prep.length) continue;
        prep.forEach(c => { bilan.courbes[c.t] = (bilan.courbes[c.t] || 0) + 1; });
        // Une courbe de chaque sorte, deux faces différentes
        const vus = new Set(), faces = [];
        for (const c of prep) if (c.fk && !vus.has(c.fk)) { vus.add(c.fk); faces.push(c); }
        const sortes = {};
        prep.forEach(c => { if (!sortes[c.t]) sortes[c.t] = c; });
        const gestes = [];
        Object.values(sortes).forEach(c => gestes.push({ quoi: 'clic sur ' + c.t, pas: [{ at: c.at }] }));
        gestes.push({ quoi: 'Maj+clic', pas: [{ at: prep[0].at, maj: true }] });
        if (faces.length >= 2) gestes.push({ quoi: 'Ctrl+clic x2, Entrée', pas: [{ at: faces[0].at, ctrl: true }, { at: faces[1].at, ctrl: true }, { entree: true }] });
        for (const g of gestes) {
          const quoi = `${nom} ${P.nom} : ${g.quoi}`;
          const etapes = [{ outil: INTERSECTION }];
          g.pas.forEach(p => { if (p.entree) etapes.push({ touche: 'Enter' }); else etapes.push({ clic: p.at, ctrl: !!p.ctrl, maj: !!p.maj }); });
          const n = gestesNatif(rang, etapes);
          if (n.echec) { bilan.ecarts++; console.log(`ÉCART ${quoi} : natif ${n.echec}`); continue; }
          await charger(FICHIER, d.features.length, P.n);
          const nav = await page.evaluate(([id, pas]) => {
            openSketch(id);
            const sk = skEdit;
            skIsectReset(); skTool = 'isect';
            pas.forEach(p => {
              if (p.entree) skIsectValidate();
              else skIsectClickAt(sk, p.at[0], p.at[1], { shiftKey: !!p.maj, ctrlKey: !!p.ctrl, metaKey: false });
            });
            const r = JSON.parse(JSON.stringify(sk));
            skTool = 'select'; closeSketch(false);
            return r;
          }, [id, g.pas]);
          const E = comparer(n.doc.sketches[rang], nav);
          if (E.length) {
            bilan.ecarts++;
            console.log(`ÉCART ${quoi} : ${E.slice(0, 4).join(' ; ')}`);
            fs.copyFileSync(FICHIER, path.join(dossier, `ecart-${bilan.ecarts}.conceptcad`));
            fs.writeFileSync(path.join(dossier, `ecart-${bilan.ecarts}.json`), JSON.stringify({ etapes, natif: n.doc.sketches[rang], nav }));
          } else bilan.justes++;
        }
      }
      console.log(`${nom} fait : ${bilan.justes} justes, ${bilan.ecarts} écarts`);
    }
  } finally {
    await ctx.close().catch(() => {});
    serveur.kill();
  }
  console.log(`bilan : ${bilan.justes} gestes identiques, ${bilan.ecarts} écarts, ${bilan.sans} pièces sautées, courbes vues ${JSON.stringify(bilan.courbes)}`);
  process.exit(bilan.ecarts ? 1 : 0);
})();
