// Créer une esquisse : le natif et le navigateur posent-ils la même ?
// 1. Sur chaque face plane d'une pièce calculée : origine, axes et face porteuse comparés à newSketchOnFace.
// 2. Sur les plans XY, XZ, YZ et une face : le fichier écrit par le natif est rouvert par le navigateur, qui doit trouver la même esquisse et le même solide.
// node natif/mesures/tester-nouvelle-esquisse.cjs <fichier.conceptcad> <dossier de travail>
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const [source, dossier] = process.argv.slice(2);
const SEUIL = 1e-4;
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); const j = JSON.parse(b); return j.doc || j; };
let justes = 0, faux = 0;
const bilan = (ok, quoi) => { if (ok) justes++; else faux++; console.log((ok ? 'pareil  ' : 'ÉCART   ') + quoi); };
const proches = (a, b) => a && b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= SEUIL);
function ecarts(n, v) {
  const out = [];
  for (const k of ['origin', 'axU', 'axV', 'axN']) if (!proches(n[k], v[k])) out.push(`${k} ${JSON.stringify(n[k])} / ${JSON.stringify(v[k])}`);
  if ((n.at || null) !== (v.at || null)) out.push(`at ${n.at} / ${v.at}`);
  if (n.name !== v.name) out.push(`nom ${n.name} / ${v.name}`);
  const hn = n.host || null, hv = v.host || null;
  if (!hn !== !hv) out.push(`porteuse ${JSON.stringify(hn)} / ${JSON.stringify(hv)}`);
  else if (hn) for (const k of ['feat', 'tag', 'edge', 'name']) if (hn[k] !== hv[k]) out.push(`porteuse.${k} ${hn[k]} / ${hv[k]}`);
  if (hn && hv) for (const k of ['x', 'y', 'h']) if (Math.abs((hn[k] || 0) - (hv[k] || 0)) > 2e-3) out.push(`porteuse.${k} ${hn[k]} / ${hv[k]}`);
  return out;
}

(async () => {
  const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r));
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  const ouvrir = async f => {
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ne-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    const page = ctx.pages()[0] || await ctx.newPage();
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    page.on('dialog', d => { erreurs.push('dialogue : ' + d.message()); d.dismiss().catch(() => {}); });
    await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
    await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
    await page.setInputFiles('#fileProj', f);
    await page.waitForFunction(() => doc && (doc.features || []).length, null, { timeout: 300000 });
    await attendre(1500);
    await page.waitForFunction(() => !skEdit && rebuildDepth === 0, null, { timeout: 300000 });
    return { ctx, page, erreurs };
  };
  try {
    // 1. Chaque face plane
    const listeF = path.join(dossier, 'faces.json');
    const q = spawnSync(EXE, ['--esquisses-faces', source, listeF], { encoding: 'utf8' });
    if (q.status !== 0) throw new Error('natif : ' + q.stderr);
    const faces = JSON.parse(fs.readFileSync(listeF, 'utf8'));
    const { ctx, page, erreurs } = await ouvrir(source);
    for (const f of faces) {
      const v = await page.evaluate(({ point, axN }) => {
        const n = new THREE.Vector3(...axN), p = new THREE.Vector3(...point);
        const rc = new THREE.Raycaster(p.clone().addScaledVector(n, 1), n.clone().negate(), 0.01, 3);
        const meshes = bodies.filter(b => b.mesh && !b.ghost).map(b => b.mesh);
        const h = rc.intersectObjects(meshes, true)[0];
        if (!h) return { manque: true };
        const noms = JSON.stringify(doc.entNames);
        selFaces = [{ mesh: h.object, point: h.point.clone(), faceIndex: h.faceIndex }];
        const avant = doc.sketches.length;
        newSketchOnFace();
        const sk = doc.sketches[avant];
        const r = sk ? JSON.parse(JSON.stringify(sk, (k, x) => k.charCodeAt(0) === 95 ? undefined : x)) : { manque: true };
        closeSketch(false);
        doc.entNames = JSON.parse(noms);
        selFaces = [];
        return r;
      }, { point: f.point, axN: f.axN });
      await attendre(100);
      await page.waitForFunction(() => !skEdit && rebuildDepth === 0, null, { timeout: 300000 });
      if (v.manque) { bilan(false, `face ${f.rang} : le navigateur ne la trouve pas`); continue; }
      const e = ecarts(f, v);
      bilan(!e.length, `face ${f.rang} ${f.host ? f.host.tag : 'sans porteuse'} : ${e.join(' ; ')}`);
    }
    if (erreurs.length) bilan(false, 'erreurs navigateur : ' + erreurs.slice(0, 3).join(' | '));
    await ctx.close().catch(() => {});

    // 2. Écrit par le natif, rouvert par le navigateur
    const casFichier = ['XY', 'XZ', 'YZ'].concat(faces.filter(f => f.host).slice(0, 2).map(f => String(f.rang)), faces.filter(f => f.host && f.host.tag === 'SIDE').slice(0, 1).map(f => String(f.rang)));
    for (const c of casFichier) {
      const sortie = path.join(dossier, `nouvelle-${c}.conceptcad`);
      const w = spawnSync(EXE, ['--nouvelle-esquisse', source, sortie, c], { encoding: 'utf8' });
      if (w.status !== 0) { bilan(false, `${c} : refus du natif ${w.status} ${w.stderr}`); continue; }
      // Le navigateur retire à l'ouverture une esquisse restée vide, comme le natif en sortant : on y dessine un rectangle
      const id = lire(sortie).sketches.at(-1).id;
      const gestes = path.join(dossier, 'gestes.json');
      fs.writeFileSync(gestes, JSON.stringify({ s: 1, pas: [{ a: 'outil', o: 'rect' }, { a: 'bas', x: 200, y: 210 }, { a: 'haut', x: 200, y: 210 }, { a: 'bouge', x: 230, y: 250 }, { a: 'bas', x: 260, y: 290 }, { a: 'haut', x: 260, y: 290 }, { a: 'echap' }] }));
      const t = spawnSync(EXE, ['--dessiner', sortie, sortie, id, gestes], { encoding: 'utf8' });
      if (t.status !== 0) { bilan(false, `${c} : dessin refusé ${t.status} ${t.stderr}`); continue; }
      const dn = lire(sortie), d0 = lire(source);
      const sk = dn.sketches[dn.sketches.length - 1];
      if (sk.entities.length !== 4) bilan(false, `${c} : ${sk.entities.length} éléments dessinés au lieu de 4`);
      const memeReste =JSON.stringify({ ...d0, entNames: 0 }) === JSON.stringify({ ...dn, sketches: dn.sketches.slice(0, -1), entNames: 0 });
      const o = await ouvrir(sortie);
      const r = await o.page.evaluate(id => {
        const k = doc.sketches.find(x => x.id === id), sh = typeof occLive !== 'undefined' && occLive && occLive.shape;
        const avantO = k ? k.origin.slice() : null;
        return { trouve: !!k, plane: k && k.plane, origin: avantO, axN: k && k.axN, volume: sh ? occCoqueVolume(sh) : null, host: k && k.host };
      }, sk.id);
      const ouvre = await o.page.evaluate(id => { openSketch(id); const ok = skEdit && skEdit.id === id; closeSketch(false); return ok; }, sk.id).catch(e => 'erreur ' + e.message);
      await o.ctx.close().catch(() => {});
      const n = JSON.parse((spawnSync(EXE, ['--verif', sortie, path.join(dossier, 'v.json')], { stdio: 'ignore' }), fs.readFileSync(path.join(dossier, 'v.json'), 'utf8'))).cas[0];
      const ok = r.trouve && proches(r.origin, sk.origin) && proches(r.axN, sk.axN) && memeReste && !o.erreurs.length && Math.abs(r.volume - n.volume) < 1e-2 && ouvre === true;
      bilan(ok, `${c} rouvert : esquisse ${r.trouve}, origine ${JSON.stringify(r.origin)} / ${JSON.stringify(sk.origin)}, reste du fichier intact ${memeReste}, volume ${r.volume && r.volume.toFixed(3)} / ${n.volume.toFixed(3)}, s'ouvre ${ouvre} ${o.erreurs.slice(0, 2).join(' ')}`);
    }
  } finally { serveur.kill(); }
  console.log(`${justes} pareils, ${faux} écarts.`);
  process.exit(faux ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
