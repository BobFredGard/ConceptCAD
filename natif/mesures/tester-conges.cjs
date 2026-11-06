// Congés et chanfreins : le natif calcule-t-il la même pièce que le navigateur ?
// 1. Les vrais congés des exemples : chaque pièce coupée juste avant sa première fonction que le natif ne sait pas rejouer.
// 2. Des congés tirés au hasard mais reproductibles, sur les extrusions des exemples : arêtes, rayons (petits et trop grands), congé ou chanfrein, tangentes cochées ou non.
// Pour chaque cas, un fichier est écrit ; le navigateur et le natif l'ouvrent chacun. Comparés : volume, aire, faces, arêtes, solides, validité.
// Les fichiers d'exemples sont seulement lus.
// node natif/mesures/tester-conges.cjs <dossier d'exemples> <dossier de travail> [--tirages=3] [--nom=extrait] [--url=ConceptCAD.html]
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const opts = process.argv.slice(2).filter(a => a.startsWith('--'));
const [source, dossier] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const opt = (n, d) => { const o = opts.find(a => a.startsWith(`--${n}=`)); return o ? o.slice(n.length + 3) : d; };
// --exe= : une copie du programme, pour pouvoir recompiler pendant que le banc tourne
const EXE = opt('exe', path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe'));
const TIRAGES = +opt('tirages', 3), EXTRAIT = opt('nom', '');
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); const j = JSON.parse(b); return j.doc || j; };
const SEUIL = 2e-5;
const proche = (a, b) => Math.abs((a || 0) - (b || 0)) <= Math.max(1e-2, SEUIL * Math.abs(b || 0));
const FICHIER_CAS = path.join(dossier, 'cas.conceptcad');

function natif(f) {
  const v = path.join(dossier, 'v.json');
  fs.rmSync(v, { force: true });
  const t0 = Date.now();
  const q = spawnSync(EXE, ['--verif', f, v], { encoding: 'utf8', timeout: 180000 });
  if (q.error && q.error.code === 'ETIMEDOUT') return { echec: 'bloqué plus de 3 min' };
  if (!fs.existsSync(v)) return { echec: 'arrêt du programme, code ' + q.status };
  const j = JSON.parse(fs.readFileSync(v, 'utf8'));
  if (j.erreur) return { echec: j.erreur };
  return Object.assign({}, j.cas[0], { refus: j.nonPrisEnCharge, msTotal: Date.now() - t0 });
}

// Tirage reproductible
function hasard(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

(async () => {
  const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r));
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-cg-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
  let page;
  const ouvrir = async () => {
    if (page) await page.close().catch(() => {});
    page = await ctx.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html?mono`);
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
    const fx = (doc.features || []).filter(f => f.type === 'xfillet').map(f => ({ err: f._err || null, adj: f._adj || null, m: f._m || null }));
    return { volume: occCoqueVolume(sh), aire, faces: compter(E.TopAbs_FACE), aretes: compter(E.TopAbs_EDGE), solides: compter(E.TopAbs_SOLID), valide: occCoqueValide(sh), fx };
  });
  // sansEffet : le congé a échoué pareil des deux côtés, la pièce reste celle d'avant ; un tel cas prouve moins qu'un congé posé
  const bilan = { justes: 0, avecEffet: 0, sansEffet: 0, ecarts: [], sans: 0, refus: 0, tempsNav: 0, tempsNat: 0 };
  // Le navigateur ouvre, le natif ouvre, on compare
  const comparer = async (quoi, d, base) => {
    fs.writeFileSync(FICHIER_CAS, JSON.stringify(d));
    const n = natif(FICHIER_CAS);
    if (n.refus && n.refus.length) { bilan.refus++; return null; }
    let b;
    const t0 = Date.now();
    try {
      await charger(FICHIER_CAS, d.features.length);
      b = await mesureNav();
    } catch (e) {
      console.log('navigateur bloqué ou arrêté : ' + quoi);
      await ouvrir().catch(() => {});
      bilan.sans++;
      return null;
    }
    bilan.tempsNav += Date.now() - t0;
    if (n.echec) { bilan.ecarts.push({ quoi, natif: n.echec, nav: b }); console.log(`ÉCART ${quoi} : natif ${n.echec}`); return b; }
    bilan.tempsNat += n.ms || 0;
    const ok = proche(n.volume, b.volume) && proche(n.aire, b.aire) && n.faces === b.faces && n.aretes === b.aretes && n.solides === b.solides && n.valide === b.valide;
    if (ok) {
      bilan.justes++;
      if (base) { if (proche(n.volume, base.volume) && n.faces === base.faces) bilan.sansEffet++; else bilan.avecEffet++; }
    } else {
      bilan.ecarts.push({ quoi, natif: { volume: n.volume, aire: n.aire, faces: n.faces, aretes: n.aretes, solides: n.solides, valide: n.valide }, nav: b });
      console.log(`ÉCART ${quoi} : natif V=${(n.volume || 0).toFixed(3)} A=${(n.aire || 0).toFixed(2)} f=${n.faces} a=${n.aretes} s=${n.solides} ${n.valide} | navigateur V=${(b.volume || 0).toFixed(3)} A=${(b.aire || 0).toFixed(2)} f=${b.faces} a=${b.aretes} s=${b.solides} ${b.valide} ${JSON.stringify(b.fx || [])}`);
    }
    return b;
  };
  const SAIT = f => (f.type === 'extrude' && !f.draft && !f.upto && !f.repeatId && !(f.profiles && f.profiles.length) && !(f.cutBodies && f.cutBodies.length) && !(f.expr && Object.keys(f.expr).length)) || (f.type === 'xfillet' && (!f.cmode || f.cmode === 'eq'));
  // La pièce jusqu'à sa première fonction que le natif ne sait pas rejouer ; ce qui se pose sur une fonction retirée s'en va aussi
  const couper = (d0, avecConges) => {
    const garde = [];
    for (const f of d0.features) {
      if (f.visible === false) continue;
      if (!SAIT(f) || (!avecConges && f.type === 'xfillet')) break;
      garde.push(f);
    }
    if (!garde.length) return null;
    const ids = new Set(garde.map(f => f.id)), utilisees = new Set(garde.map(f => f.sketchId));
    const sketches = (d0.sketches || []).filter(k => utilisees.has(k.id) || !k.host);
    return Object.assign({}, d0, { features: garde, sketches, params: [], imports: undefined });
  };
  const fichiers = fs.readdirSync(source).filter(n => n.endsWith('.conceptcad') && (!EXTRAIT || n.includes(EXTRAIT))).sort();
  try {
    for (const nom of fichiers) {
      let d0;
      try { d0 = lire(path.join(source, nom)); } catch (e) { continue; }
      if (!d0.features) continue;
      // 1. Les vrais congés
      const vrais = couper(d0, true);
      if (vrais && vrais.features.some(f => f.type === 'xfillet')) {
        const b = await comparer(`${nom} : vrais congés (${vrais.features.filter(f => f.type === 'xfillet').length})`, vrais);
        if (b) console.log(`pièce  ${nom} V=${(b.volume || 0).toFixed(2)} f=${b.faces} ${JSON.stringify((b.fx || []).filter(x => x.err || x.adj))}`);
      }
      // 2. Des congés tirés au hasard sur les extrusions
      const nu = couper(d0, false);
      if (!nu) continue;
      fs.writeFileSync(FICHIER_CAS, JSON.stringify(nu));
      const n0 = natif(FICHIER_CAS);
      if (n0.refus && n0.refus.length) { bilan.refus++; continue; }
      let aretes;
      try {
        await charger(FICHIER_CAS, nu.features.length);
        aretes = await page.evaluate(() => {
          if (!occLive || !occLive.shape) return [];
          return occVisibleSharpEdges().filter(e => e.sharp).map(e => { let a = null; try { a = xAnchorFor(e.mid); } catch (x) {} return { mid: e.mid, len: e.len, anchor: a }; });
        });
      } catch (e) { await ouvrir().catch(() => {}); continue; }
      if (!aretes.length) continue;
      const RAYONS = [0.3, 1, 2.5, 6, 15, 60];
      for (let t = 0; t < TIRAGES; t++) {
        const r = hasard(nom.length * 7919 + nom.charCodeAt(0) * 131 + t);
        const n = Math.min(aretes.length, 1 + Math.floor(r() * 3));
        const prises = [], vu = new Set();
        while (prises.length < n) { const i = Math.floor(r() * aretes.length); if (!vu.has(i)) { vu.add(i); prises.push(aretes[i]); } }
        const R = RAYONS[Math.floor(r() * RAYONS.length)], chanfrein = r() < 0.25, tangent = r() < 0.7;
        const xf = {
          id: 'xf_banc', type: 'xfillet', name: (chanfrein ? 'Chanfrein exact (' : 'Congé exact (') + n + ' arête(s))', visible: true, tangent,
          edges: prises.map((a, i) => ({ pos: a.mid, pos0: a.mid, r: R, len: a.len, anchor: a.anchor, name: 'Arête ' + (i + 1), seed: 1 })),
        };
        if (chanfrein) { xf.chamfer = true; xf.cmode = 'eq'; }
        const d = Object.assign({}, nu, { features: [...nu.features, xf] });
        const quoi = `${nom} tirage ${t} : ${chanfrein ? 'D' : 'R'}${R} sur ${n} arête(s), tangentes ${tangent ? 'oui' : 'non'}`;
        await comparer(quoi, d, n0);
      }
      console.log(`fait ${nom} : ${bilan.justes} identiques, ${bilan.ecarts.length} écarts, ${bilan.refus} refusés, ${bilan.sans} sans réponse du navigateur`);
    }
  } finally {
    fs.writeFileSync(path.join(dossier, 'bilan.json'), JSON.stringify(bilan, null, 1));
    console.log(`\n${bilan.justes} cas identiques (tirés au hasard : ${bilan.avecEffet} ont changé la pièce, ${bilan.sansEffet} ont échoué des deux côtés), ${bilan.ecarts.length} écarts, ${bilan.refus} pièces refusées par le natif, ${bilan.sans} sans réponse du navigateur`);
    await ctx.close().catch(() => {});
    serveur.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
