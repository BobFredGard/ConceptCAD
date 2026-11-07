// Changer une cote d'esquisse : le natif et le navigateur arrivent-ils à la même pièce ?
// Pour chaque cote modifiable des pièces que le natif sait calculer, trois résultats sont comparés :
// A le navigateur fait la modification lui-même, B le navigateur rouvre le fichier écrit par le natif, N le calcul du natif.
// node natif/mesures/tester-cotes-navigateur.cjs <dossier de travail> [Nom de pièce]
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const SOURCE = process.env.CC_SOURCE || path.join(RACINE, 'Exemples');  // pièces à passer, Exemples par défaut
const RACINE_NAV = process.env.CC_RACINE_NAV || RACINE;  // le dossier qui sert le ConceptCAD.html à comparer
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const dossier = process.argv[2], filtre = process.argv[3] || '';
const SEUIL_MM = 1e-3, SEUIL_VOLUME = 1e-2;
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
const portLibre = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); const j = JSON.parse(b); return j.doc || j; };

const ETAT = () => {
  const sh = typeof occLive !== 'undefined' && occLive && occLive.shape;
  return { src: JSON.parse(docHashSrc(doc)), corps: bodies.filter(b => b.shape).length, volume: sh ? occCoqueVolume(sh) : null };
};
// Différences entre deux documents : un nombre compte s'il s'écarte de plus du seuil, tout le reste doit être identique
function ecarts(a, b, chemin, out) {
  // _refNote : simple message d'information, selon le chemin suivi. chk et rdV : marques posées à l'ouverture de l'esquisse.
  if (a === b || ['_refNote', 'chk', 'rdV'].includes(chemin[chemin.length - 1])) return out;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > SEUIL_MM) out.push(chemin.join('.') + ' ' + a + ' / ' + b);
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) ecarts(a[k], b[k], chemin.concat(k), out);
    return out;
  }
  out.push(chemin.join('.') + ' ' + JSON.stringify(a) + ' / ' + JSON.stringify(b));
  return out;
}
const pret = page => page.waitForFunction(() => typeof doc !== 'undefined' && doc && !skEdit && rebuildDepth === 0, null, { timeout: 600000 });

(async () => {
  const cas = [];
  for (const f of fs.readdirSync(SOURCE).filter(x => x.endsWith('.conceptcad') && x.includes(filtre))) {
    const src = path.join(SOURCE, f);
    const doc = lire(src);
    for (const s of doc.sketches || [])
      for (const d of s.dims || []) {
        const v = +d.value;
        if (!isFinite(v) || !v) continue;
        // Valeur tapée par l'utilisateur : des degrés pour un angle
        for (const k of [1.1, 0.9, 1.02, 1.25]) cas.push({ f, src, sk: s.id, nomSk: s.name, cote: d.id, valeur: v * k, sortie: path.join(dossier, `${cas.length}.conceptcad`) });
      }
  }
  const port = await portLibre();
  const serveur = spawn(process.execPath, [path.join(RACINE_NAV, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  const url = 'http://127.0.0.1:' + port;
  let justes = 0, faux = 0, figes = 0, refusPareils = 0, refusDifferents = 0;
  try {
    await attendre(800);
    const ouvrir = async fichier => {
      const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-cot-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
      const page = ctx.pages()[0] || await ctx.newPage();
      const erreurs = [];
      page.on('pageerror', e => erreurs.push(e.message));
      page.on('dialog', d => { erreurs.push('dialogue : ' + d.message()); d.dismiss().catch(() => {}); });
      await page.goto(url + '/ConceptCAD.html');
      await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
      await pret(page);
      await page.setInputFiles('#fileProj', fichier);
      await page.waitForFunction(() => doc && (doc.features || []).length || (doc && (doc.sketches || []).length), null, { timeout: 300000 });
      await attendre(1500);
      await pret(page);
      return { ctx, page, erreurs };
    };
    for (const c of cas) {
      const q = spawnSync(EXE, ['--coter', c.src, c.sortie, c.sk, c.cote, String(c.valeur)], { encoding: 'utf8' });
      if (q.status === 5) { figes++; continue; }
      if (q.status !== 0 && q.status !== 4) { faux++; console.log('ÉCHEC natif', c.f, c.sk, c.cote, q.status, q.stderr); continue; }
      let a = null, accepte = false, ea = null;
      try {
      a = await ouvrir(c.src);
      accepte = await a.page.evaluate(([sk, id, v]) => {
        openSketch(sk);
        const s = skEdit, d = s.dims.find(x => x.id === id);
        skPushUndo();
        skFirstDimScale(s, d, v);
        d.value = v;
        parApplyAll();
        const ok = skSolveOrRevert(s, 'Cote');
        closeSketch(true);
        return ok;
      }, [c.sk, c.cote, c.valeur]);
      await attendre(500);
      await pret(a.page);
      ea = await a.page.evaluate(ETAT);
      } catch (x) {
        // Le navigateur a planté sur ce cas (mémoire de la page) : on le dit et on passe au suivant
        console.log('NAVIGATEUR PLANTÉ', c.f, c.nomSk, c.cote, String(x.message).split('\n')[0]);
        if (a) await a.ctx.close().catch(() => {});
        continue;
      }
      await a.ctx.close().catch(() => {});
      const nomCas = `${c.f.slice(0, 28)} ${c.nomSk} ${c.cote} -> ${c.valeur}`;
      if ((q.status === 0) !== accepte) { refusDifferents++; console.log(`DÉCISION différente ${nomCas} : natif ${q.status === 0}, navigateur ${accepte}`); continue; }
      if (!accepte) { refusPareils++; console.log(`refusé des deux côtés ${nomCas}`); continue; }
      // Le fichier écrit : seuls les nombres que le logiciel sait changer peuvent différer, et rien n'est retiré
      const horsNombres = [];
      const seulsNombres = (a, b, chemin) => {
        if (a === b) return;
        if (a && b && typeof a === 'object' && typeof b === 'object') {
          if (JSON.stringify(Object.keys(a).filter(k => k in b)) !== JSON.stringify(Object.keys(b).filter(k => k in a))) horsNombres.push(chemin.join('.') + ' ordre');
          for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) seulsNombres(a[k], b[k], chemin.concat(k));
          return;
        }
        const permis = /^sketches\.\d+\.(points\.[^.]+\.[xy]|entities\.\d+\.(r|srcMid\.\d|isect\..*)|dims\.\d+\.(value|sgn|ccw))$/.test(chemin.join('.'));
        if (!permis) horsNombres.push(chemin.join('.'));
      };
      seulsNombres(lire(c.src), lire(c.sortie), []);
      const entier = f => { let o = fs.readFileSync(f); if (o[0] === 0x1f) o = zlib.gunzipSync(o); return JSON.parse(o); };
      const ouvertA = entier(c.src), ouvertB = entier(c.sortie);
      // Un fichier à trajectoires : tout ce qui entoure la pièce reste identique
      if (ouvertA.doc) { delete ouvertA.doc; delete ouvertB.doc; if (JSON.stringify(ouvertA) !== JSON.stringify(ouvertB)) horsNombres.push('hors de la pièce'); }
      if (horsNombres.length) { faux++; console.log(`FICHIER ${nomCas} : ${horsNombres.slice(0, 5).join(' ; ')}`); }
      const b = await ouvrir(c.sortie);
      const eb = await b.page.evaluate(ETAT);
      await b.ctx.close().catch(() => {});
      const champs = ecarts(ea.src, eb.src, [], []);
      const verif = path.join(dossier, 'verif.json');
      spawnSync(EXE, ['--verif', c.sortie, verif], { stdio: 'ignore' });
      const n = JSON.parse(fs.readFileSync(verif, 'utf8'));
      const vn = n.cas[0].volume;
      const volOk = ea.volume == null ? !vn : Math.abs(ea.volume - eb.volume) <= SEUIL_VOLUME && Math.abs(vn - eb.volume) <= SEUIL_VOLUME;
      const ok = !champs.length && ea.corps === eb.corps && volOk && !a.erreurs.length && !b.erreurs.length;
      if (ok) justes++; else faux++;
      console.log(`${ok ? 'pareil ' : 'ÉCART  '} ${nomCas} : volume nav. ${ea.volume == null ? '-' : ea.volume.toFixed(3)}, fichier ${eb.volume == null ? '-' : eb.volume.toFixed(3)}, natif ${vn.toFixed(3)}${champs.length ? ' | ' + champs.slice(0, 4).join(' ; ') + (champs.length > 4 ? ` … ${champs.length} champs` : '') : ''}${a.erreurs.concat(b.erreurs).slice(0, 2).join(' ')}`);
      fs.rmSync(c.sortie, { force: true });
      fs.rmSync(c.sortie + '.bak', { force: true });
    }
  } finally { serveur.kill(); }
  console.log(`${cas.length} cas : ${justes} pareils, ${faux} écarts, ${refusPareils} refusés des deux côtés, ${refusDifferents} décisions différentes, ${figes} figés par le natif (lecture seule).`);
  process.exit(faux || refusDifferents ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
