// Le choix des arêtes : les mêmes gestes dans le navigateur et dans le natif donnent-ils la même fonction et la même pièce ?
// Pour chaque pièce : même liste d'arêtes vives et tangentes ; puis des arêtes tirées au hasard, mêmes rayon et réglages :
// même aperçu possible ou non, mêmes champs écrits, et le fichier écrit par le natif, relu par le navigateur, donne la même pièce.
// Les fichiers d'exemples sont seulement lus.
// node natif/mesures/tester-conges-gestes.cjs <dossier d'exemples> <dossier de travail> [--tirages=4] [--nom=extrait] [--exe=programme]
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const opts = process.argv.slice(2).filter(a => a.startsWith('--'));
const [source, dossier] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const opt = (n, d) => { const o = opts.find(a => a.startsWith(`--${n}=`)); return o ? o.slice(n.length + 3) : d; };
const TIRAGES = +opt('tirages', 4), EXTRAIT = opt('nom', '');
const EXE = opt('exe', path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe'));
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); const j = JSON.parse(b); return j.doc || j; };
const SEUIL = 2e-5;
const proche = (a, b) => Math.abs((a || 0) - (b || 0)) <= Math.max(1e-2, SEUIL * Math.abs(b || 0));
const procheVec = (a, b) => a && b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
function hasard(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const CAS = path.join(dossier, 'cas.conceptcad'), GESTES = path.join(dossier, 'gestes.json'), RAPPORT = path.join(dossier, 'rapport.json'), ECRIT = path.join(dossier, 'ecrit.conceptcad');
function natifGeste(g) {
  fs.writeFileSync(GESTES, JSON.stringify(g));
  fs.rmSync(RAPPORT, { force: true });
  fs.rmSync(ECRIT, { force: true });
  const q = spawnSync(EXE, ['--conge', CAS, ECRIT, GESTES, RAPPORT], { encoding: 'utf8', timeout: 180000 });
  if (!fs.existsSync(RAPPORT)) throw new Error('natif arrêté, code ' + q.status + ' ' + (q.stderr || ''));
  return JSON.parse(fs.readFileSync(RAPPORT, 'utf8'));
}
function verif(f) {
  const v = path.join(dossier, 'v.json');
  fs.rmSync(v, { force: true });
  spawnSync(EXE, ['--verif', f, v], { encoding: 'utf8', timeout: 180000 });
  const j = JSON.parse(fs.readFileSync(v, 'utf8'));
  return Object.assign({}, j.cas && j.cas[0], { refus: j.nonPrisEnCharge });
}
// Deux listes d'arêtes : mêmes milieux à 0,01 mm près
function ecartListes(a, b) {
  const reste = b.slice();
  let manque = 0;
  for (const e of a) {
    const i = reste.findIndex(x => Math.hypot(x.mid[0] - e.mid[0], x.mid[1] - e.mid[1], x.mid[2] - e.mid[2]) < 0.01 && Math.abs(x.len - e.len) < 0.01);
    if (i < 0) manque++; else reste.splice(i, 1);
  }
  return manque + reste.length;
}

(async () => {
  const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r));
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-cgg-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
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
    await page.evaluate(() => { try { if (typeof exitFilletMode === 'function') exitFilletMode(true); } catch (e) {} mffPendingOpen = true; doc = { name: '', sketches: [], features: [], cgeo: [], bodyVis: {}, bodies: [], bodySeq: 1, activeBody: null, mep: null }; });
    await page.setInputFiles('#fileProj', f);
    await page.waitForFunction(n => doc && (doc.features || []).length === n, n, { timeout: 120000 });
    await attendre(200);
    await page.waitForFunction(() => !skEdit && rebuildDepth === 0, null, { timeout: 120000 });
    await attendre(50);
  };
  const mesureNav = () => page.evaluate(() => {
    const sh = typeof occLive !== 'undefined' && occLive && occLive.shape;
    if (!sh) return { volume: 0, aire: 0, faces: 0, aretes: 0, solides: 0, valide: false };
    const E = occt.TopAbs_ShapeEnum, compter = t => { let n = 0; const x = new occt.TopExp_Explorer_2(sh, t, E.TopAbs_SHAPE); while (x.More()) { n++; x.Next(); } x.delete(); return n; };
    const G = new occt.GProp_GProps_1(); occt.BRepGProp.SurfaceProperties_1(sh, G, false, false); const aire = G.Mass(); G.delete();
    return { volume: occCoqueVolume(sh), aire, faces: compter(E.TopAbs_FACE), aretes: compter(E.TopAbs_EDGE), solides: compter(E.TopAbs_SOLID), valide: occCoqueValide(sh) };
  });
  const pareil = (n, b) => proche(n.volume, b.volume) && proche(n.aire, b.aire) && n.faces === b.faces && n.aretes === b.aretes && n.solides === b.solides && n.valide === b.valide;
  const bilan = { ancres: 0, ancresFausses: 0, pieces: 0, listesJustes: 0, listesFausses: [], justes: 0, avecEffet: 0, apercusPareils: 0, ecarts: [], refus: 0 };
  const SAIT = f => (f.type === 'extrude' && !f.draft && !f.upto && !f.repeatId && !(f.profiles && f.profiles.length) && !(f.cutBodies && f.cutBodies.length) && !(f.expr && Object.keys(f.expr).length)) || (f.type === 'xfillet' && (!f.cmode || f.cmode === 'eq'));
  const couper = d0 => {
    const garde = [];
    for (const f of d0.features) {
      if (f.visible === false) continue;
      if (!SAIT(f)) break;
      garde.push(f);
    }
    if (!garde.length) return null;
    const utilisees = new Set(garde.map(f => f.sketchId));
    return Object.assign({}, d0, { features: garde, // Une esquisse non consommée qui suit des arêtes : le navigateur la recale sur la pièce coupée, qui n''est plus celle du fichier. Artefact de la coupe : retirée.
    sketches: (d0.sketches || []).filter(k => utilisees.has(k.id) || (!k.host && !(k.entities || []).some(e => e.proj))), params: [], imports: undefined });
  };
  const fichiers = fs.readdirSync(source).filter(n => n.endsWith('.conceptcad') && (!EXTRAIT || n.includes(EXTRAIT))).sort();
  try {
    for (const nom of fichiers) {
      let d0;
      try { d0 = lire(path.join(source, nom)); } catch (e) { continue; }
      if (!d0.features) continue;
      const nu = couper(d0);
      if (!nu) continue;
      fs.writeFileSync(CAS, JSON.stringify(nu));
      const n0 = verif(CAS);
      if (n0.refus && n0.refus.length) { bilan.refus++; continue; }
      await charger(CAS, nu.features.length);
      const listeNav = await page.evaluate(() => { if (!occLive || !occLive.shape) return null; const a = occVisibleSharpEdges(); return { vives: a.filter(e => e.sharp).map(e => { let an = null; try { an = xAnchorFor(e.mid); } catch (x) {} return { mid: e.mid, len: e.len, ancre: an }; }), lisses: a.filter(e => !e.sharp).map(e => ({ mid: e.mid, len: e.len })) }; });
      if (!listeNav || !listeNav.vives.length) continue;
      bilan.pieces++;
      const liste = natifGeste({ r: 2 });
      const ev = ecartListes(liste.vives, listeNav.vives), et = ecartListes(liste.lisses, listeNav.lisses);
      if (ev || et) { bilan.listesFausses.push({ nom, vives: [liste.vives.length, listeNav.vives.length], lisses: [liste.lisses.length, listeNav.lisses.length] }); console.log(`LISTE ${nom} : vives natif ${liste.vives.length} navigateur ${listeNav.vives.length}, lisses ${liste.lisses.length} / ${listeNav.lisses.length}`); }
      else bilan.listesJustes++;
      // L'ancre de chaque arête vive, écrite dans le fichier pour la retrouver
      for (const e of liste.vives) {
        const b = listeNav.vives.find(x => Math.hypot(x.mid[0] - e.mid[0], x.mid[1] - e.mid[1], x.mid[2] - e.mid[2]) < 0.01);
        if (!b) continue;
        bilan.ancres++;
        const A = e.ancre || null, B = b.ancre || null;
        const juste = (!A && !B) || (A && B && ['t', 'sk', 'id', 'side', 'far'].every(k => A[k] === B[k]) && Math.abs(A.z - B.z) < 1e-9 && Math.abs((A.dist || 0) - (B.dist || 0)) < 1e-9);
        if (!juste) { bilan.ancresFausses++; if (bilan.ancresFausses <= 12) console.log(`ANCRE ${nom} (${e.mid.map(v => v.toFixed(3)).join(', ')}) : natif ${JSON.stringify(A)} / navigateur ${JSON.stringify(B)}`); }
      }
      if (opts.includes('--ancres')) continue;
      const RAYONS = [0.3, 1, 2.5, 6, 15, 60];
      for (let t = 0; t < TIRAGES; t++) {
        const r = hasard(nom.length * 6113 + nom.charCodeAt(0) * 37 + t);
        const n = Math.min(listeNav.vives.length, 1 + Math.floor(r() * 3));
        const prises = [], vu = new Set();
        while (prises.length < n) { const i = Math.floor(r() * listeNav.vives.length); if (!vu.has(i)) { vu.add(i); prises.push(listeNav.vives[i].mid); } }
        const R = RAYONS[Math.floor(r() * RAYONS.length)], chanfrein = r() < 0.25, tangent = r() < 0.7;
        const quoi = `${nom} tirage ${t} : ${chanfrein ? 'D' : 'R'}${R} sur ${n} arête(s), tangentes ${tangent ? 'oui' : 'non'}`;
        await charger(CAS, nu.features.length);
        // Le navigateur : les mêmes gestes par ses propres fonctions
        const nav = await page.evaluate(({ prises, R, chanfrein, tangent }) => {
          enterExactFilletMode(null, chanfrein ? 'chamfer' : 'fillet');
          if (!filModeX) return { echec: 'mode refusé' };
          filModeX.radius = R; filModeX.tangent = tangent;
          prises.forEach(m => { const i = filModeX.edges.findIndex(e => Math.hypot(e.mid[0] - m[0], e.mid[1] - m[1], e.mid[2] - m[2]) < 1e-3); if (i >= 0) xSeedAdd(i); });
          xSelSync();
          const apercu = !!xPrevBody, message = filModeX._prevMsg || '';
          const n0 = doc.features.length;
          applyExactFillet();
          const f = doc.features[doc.features.length - 1];
          return { apercu, message, fait: doc.features.length === n0 + 1, f: JSON.parse(JSON.stringify({ name: f.name, type: f.type, tangent: f.tangent, chamfer: f.chamfer, cmode: f.cmode, body: f.body, edges: (f.edges || []).map(e => ({ pos: e.pos, pos0: e.pos0, r: e.r, len: e.len, anchor: e.anchor, seed: e.seed })) })) };
        }, { prises, R, chanfrein, tangent });
        await page.waitForFunction(() => rebuildDepth === 0, null, { timeout: 120000 });
        await attendre(50);
        const mNav = await mesureNav();
        // Le natif
        const g = natifGeste({ chanfrein, r: R, tangent, mids: prises });
        const fautes = [];
        if (g.apercu === nav.apercu) bilan.apercusPareils++; else fautes.push(`aperçu natif ${g.apercu} navigateur ${nav.apercu} (${g.message} | ${nav.message})`);
        if (!g.ecrit || !nav.fait) { fautes.push('rien écrit'); }
        else {
          const ecrit = lire(ECRIT), f = ecrit.features[ecrit.features.length - 1];
          for (const k of ['type', 'name', 'tangent', 'body']) if (f[k] !== nav.f[k]) fautes.push(`${k} : ${f[k]} / ${nav.f[k]}`);
          if (!!f.chamfer !== !!nav.f.chamfer || f.cmode !== nav.f.cmode) fautes.push('type de chanfrein');
          if (f.edges.length !== nav.f.edges.length) fautes.push(`arêtes ${f.edges.length} / ${nav.f.edges.length}`);
          else f.edges.forEach((e, i) => {
            const b = nav.f.edges[i];
            if (!procheVec(e.pos, b.pos) || !procheVec(e.pos0, b.pos0)) fautes.push(`position ${i}`);
            if (e.r !== b.r) fautes.push(`rayon ${i}`);
            if (Math.abs(e.len - b.len) > 1e-9) fautes.push(`longueur ${i} : ${e.len} / ${b.len}`);
            if (JSON.stringify(e.anchor) !== JSON.stringify(b.anchor) && !(e.anchor && b.anchor && ['t', 'sk', 'id', 'side', 'far'].every(k => e.anchor[k] === b.anchor[k]) && Math.abs(e.anchor.z - b.anchor.z) < 1e-9 && Math.abs((e.anchor.dist || 0) - (b.anchor.dist || 0)) < 1e-9)) fautes.push(`ancre ${i} : ${JSON.stringify(e.anchor)} / ${JSON.stringify(b.anchor)}`);
            if (!!e.seed !== !!b.seed) fautes.push(`germe ${i}`);
          });
          // Le fichier écrit : relu par les deux
          const mE = verif(ECRIT);
          if (!pareil(mE, mNav)) fautes.push(`pièce du natif V=${mE.volume} f=${mE.faces} a=${mE.aretes} / navigateur V=${mNav.volume} f=${mNav.faces} a=${mNav.aretes}`);
          await charger(ECRIT, ecrit.features.length);
          const mRelu = await mesureNav();
          if (!pareil(mE, mRelu)) fautes.push(`relu par le navigateur V=${mRelu.volume} f=${mRelu.faces} / natif V=${mE.volume} f=${mE.faces}`);
          if (!proche(mE.volume, n0.volume) || mE.faces !== n0.faces) bilan.avecEffet++;
        }
        if (fautes.length) { bilan.ecarts.push({ quoi, fautes }); console.log(`ÉCART ${quoi} : ${fautes.join(' ; ')}`); }
        else bilan.justes++;
      }
      console.log(`fait ${nom} : ${bilan.justes} justes, ${bilan.ecarts.length} écarts`);
    }
  } finally {
    fs.writeFileSync(path.join(dossier, 'bilan.json'), JSON.stringify(bilan, null, 1));
    console.log(`\n${bilan.pieces} pièces : listes d'arêtes identiques ${bilan.listesJustes}, différentes ${bilan.listesFausses.length} ; ancres ${bilan.ancres - bilan.ancresFausses} justes sur ${bilan.ancres} ; gestes : ${bilan.justes} identiques (${bilan.avecEffet} ont changé la pièce), ${bilan.ecarts.length} écarts ; aperçus pareils ${bilan.apercusPareils} ; refusées ${bilan.refus}`);
    await ctx.close().catch(() => {});
    serveur.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
