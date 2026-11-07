// Les composants liés à un fichier : scénario complet en vraie fenêtre, chaque fichier écrit est relu par le navigateur.
// node tester-liens.cjs <dossier de travail> --racine=<dépôt à la bonne version>
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), z = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossier = path.resolve(process.argv[2]);
const RACINE = path.resolve(opt('racine', path.join(__dirname, '..', '..')));
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const EX = path.join(__dirname, '..', '..', 'Exemples');
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(dossier, { recursive: true, force: true });
fs.mkdirSync(path.join(dossier, 'projets', 'sous'), { recursive: true });
const lireTexte = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = z.gunzipSync(b); return b.toString('utf8'); };
const lireDoc = f => { const j = JSON.parse(lireTexte(f)); return j.doc || j; };
// asmHash
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + '_' + s.length; };
let ecarts = 0;
const verifie = (ok, m) => { console.log((ok ? 'juste   ' : 'ÉCART   ') + m); if (!ok) ecarts++; };
const m = { mesure: 1 };
const essai = (nom, entree, sortie, etapes) => {
  const d = path.join(dossier, 'e-' + nom);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'etapes.json'), JSON.stringify(etapes));
  const r = spawnSync(EXE, ['--essai-esquisse', entree, '-2', sortie, path.join(d, 'etapes.json'), d], { timeout: 280000 });
  if (fs.existsSync(path.join(d, 'erreur.txt'))) console.log('   erreur.txt : ' + fs.readFileSync(path.join(d, 'erreur.txt'), 'utf8'));
  const bi = fs.existsSync(path.join(d, 'bilan.json')) ? JSON.parse(fs.readFileSync(path.join(d, 'bilan.json'), 'utf8')) : [];
  if (r.status !== 0 || bi.length !== etapes.length) { ecarts++; console.log(`ÉCART   ${nom} : code ${r.status}, ${bi.length}/${etapes.length} étapes`); }
  return bi;
};

(async () => {
  const P = path.join(dossier, 'projets');
  const source = path.join(P, 'sous', 'Piece.conceptcad');
  fs.copyFileSync(path.join(EX, 'Griffe.conceptcad'), source);
  const hote0 = path.join(P, 'Hote0.conceptcad');
  fs.copyFileSync(path.join(EX, 'Test Assemblage.conceptcad'), hote0);
  const hote = path.join(P, 'Hote.conceptcad');

  // 1. Lier : même empreinte que le navigateur pour ce texte, rel trouvé depuis le dossier hôte
  let bi = essai('lier', hote0, hote, [{ asm: 'basculer' }, { lierAsm: source }, m]);
  let L = (bi[2].liens || [])[0];
  const sigAttendue = hash(lireTexte(source));
  verifie(L && L.sig === sigAttendue, `empreinte de la source ${L && L.sig} / ${sigAttendue}`);
  verifie(L && L.rel === 'sous/Piece.conceptcad', `rel = ${L && L.rel}`);
  verifie(L && !L.sale, 'pas modifié ici juste après le lien');
  const v0 = bi[2].instances.length;

  // 2. Rouvrir : rien ne change, le lien tient
  bi = essai('rouvrir', hote, path.join(P, 'r.conceptcad'), [{ liens: 'verifier' }, m]);
  L = (bi[1].liens || [])[0];
  verifie(L && !L.sale && !L.alerte, `rouvert : ni modifié ni en alerte (${L && L.message})`);

  // 3. La source change sur le disque : mise à jour
  const dS = JSON.parse(lireTexte(source));
  const dd = dS.doc || dS;
  dd.name = 'Griffe modifiée';
  dd.features = dd.features.filter(f => f.body !== 'b2' || f.type === 'extrude');
  fs.writeFileSync(source, JSON.stringify(dS));
  bi = essai('maj', hote, path.join(P, 'm.conceptcad'), [{ liens: 'verifier' }, m]);
  L = (bi[1].liens || [])[0];
  verifie(L && L.sig === hash(lireTexte(source)), 'mise à jour : empreinte de la nouvelle source');
  // (déjà faite à l'ouverture du fichier : la vérification demandée ne trouve plus rien à faire)
  const dm = lireDoc(path.join(P, 'm.conceptcad'));
  const cm = dm.asm.comps.find(c => c.link);
  verifie(cm && cm.doc && cm.doc.features.length === dd.features.length, `fonctions du composant ${cm && cm.doc && cm.doc.features.length} / ${dd.features.length}`);

  // 4. Modifier ici, puis enregistrer : la source est réécrite, avec sa copie .bak
  const avant = lireTexte(source);
  bi = essai('ecrire', path.join(P, 'm.conceptcad'), path.join(P, 'e.conceptcad'), [{ asm: 'basculer' }, { asmModeler: 'Piece:1' }, { nouveauCorps: 1 }, m, { liens: 'ecrire' }, m]);
  L = (bi[3].liens || [])[0];
  verifie(L && L.sale, 'modifié ici : ✎');
  L = (bi[5].liens || [])[0];
  verifie(L && !L.sale, 'après écriture : plus rien à écrire');
  const apres = lireTexte(source);
  verifie(apres !== avant && fs.existsSync(source + '.bak'), 'source réécrite, ancienne version en .bak');
  verifie(L && L.sig === hash(apres), 'empreinte = texte écrit');

  // 5. Extraire un composant ; le fichier écrit se relit
  const ext = path.join(P, 'Base-extraite.conceptcad');
  bi = essai('extraire', hote0, path.join(P, 'x.conceptcad'), [{ asm: 'basculer' }, { lienExtraire: ['Base:1', ext] }, m]);
  L = (bi[2].liens || [])[0];
  verifie(fs.existsSync(ext) && L && L.sig === hash(lireTexte(ext)), 'extraction : fichier écrit, empreinte juste');
  const dx = lireDoc(ext);
  const baseOrig = lireDoc(hote0).asm.comps.find(c => c.name === 'Base');
  verifie(dx.features.length === baseOrig.doc.features.length, `extrait : ${dx.features.length} fonctions / ${baseOrig.doc.features.length}`);

  // 6. Remplacer par un lien, relier, rompre
  bi = essai('remplacer', hote0, path.join(P, 'rp.conceptcad'), [{ asm: 'basculer' }, { lienRemplacer: ['Goupille:1', ext] }, m, { lienRelier: ['Goupille:1', source] }, m, { lienRompre: 'Goupille:1' }, m]);
  verifie((bi[2].liens || []).length === 1, 'remplacer : un lien');
  verifie((bi[4].liens || [])[0] && (bi[4].liens[0].rel || '').endsWith('Piece.conceptcad'), 'relier : suit le nouveau fichier');
  verifie((bi[6].liens || []).length === 0, 'rompre : plus de lien');

  // 7. Refus : la racine ne s'extrait pas, déjà lié
  bi = essai('refus', hote, path.join(P, 'f.conceptcad'), [{ asm: 'basculer' }, { lienExtraire: ['Piece:1', path.join(P, 'non.conceptcad')] }]);
  verifie(/déjà lié/.test(bi[1].etat || '') && !fs.existsSync(path.join(P, 'non.conceptcad')), `refus : ${bi[1].etat}`);

  // Le navigateur relit tout ce qui a été écrit et y trouve les mêmes composants
  const port = 4300 + (process.pid % 500);
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  try {
    await attendre(800);
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-lien-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
    for (const f of ['Hote.conceptcad', 'm.conceptcad', 'e.conceptcad', 'x.conceptcad', 'rp.conceptcad', 'Base-extraite.conceptcad', path.join('sous', 'Piece.conceptcad')]) {
      const c = path.join(P, f);
      const page = await ctx.newPage();
      page.on('dialog', d => d.dismiss());
      await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
      await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
      await page.evaluate(() => { window.__d = doc; });
      await page.setInputFiles('#fileProj', c);
      await page.waitForFunction(() => doc && doc !== window.__d, null, { timeout: 120000 }).catch(() => {});
      await attendre(1500);
      const b = await page.evaluate(() => ({ ouvert: doc !== window.__d, comps: asm ? asm.comps.map(x => ({ n: x.name, f: (x.doc.features || []).length, l: !!x.link })) : [], feats: doc.features.length }));
      await page.close();
      const d = lireDoc(c);
      const attendu = d.asm ? d.asm.comps.length : 0;
      verifie(b.ouvert && b.comps.length === attendu, `navigateur ouvre ${f} : ${b.comps.length} composants / ${attendu} (${b.comps.filter(x => x.l).length} lié)`);
    }
    await ctx.close().catch(() => {});
  } finally { serveur.kill(); }
  console.log(ecarts ? `${ecarts} écarts.` : 'Tout est juste.');
  process.exit(ecarts ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
