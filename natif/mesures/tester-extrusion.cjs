// Extruder : le natif et le navigateur font-ils la même chose ?
// 1. Sur une pièce calculée, chaque esquisse et plusieurs réglages : le navigateur crée la fonction par son panneau ; le natif écrit la sienne.
//    Comparés : le texte de la fonction (sauf identifiant), l'esquisse masquée, le volume dans les deux programmes, et le reste du fichier intact.
// 2. Avec --toutes=<dossier d'exemples> : chaque esquisse des exemples, seule dans une pièce vide, extrudée de 20 mm : les contours trouvés donnent-ils le même volume ?
// node natif/mesures/tester-extrusion.cjs <fichier.conceptcad> <dossier de travail> [--toutes=dossier] [--max=n]
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const EXE = path.join(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));
const opts = process.argv.slice(2).filter(a => a.startsWith('--'));
const [source, dossier] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const opt = n => { const o = opts.find(a => a.startsWith(`--${n}=`)); return o ? o.slice(n.length + 3) : null; };
const SEUIL_RELATIF = 2e-5;
fs.mkdirSync(dossier, { recursive: true });
const attendre = ms => new Promise(r => setTimeout(r, ms));
const lireBrut = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); return JSON.parse(b); };
const lire = f => { const j = lireBrut(f); return j.doc || j; };
let justes = 0, faux = 0;
const bilan = (ok, quoi) => { if (ok) justes++; else faux++; if (!ok || !opt('toutes')) console.log((ok ? 'pareil  ' : 'ÉCART   ') + quoi); };
// Plus de solide du tout : 0 d'un côté, rien de l'autre
const procheV = (a, b) => Math.abs((a || 0) - (b || 0)) <= Math.max(1e-2, SEUIL_RELATIF * Math.abs(b || 0));

const REGLAGES = [
  { nom: 'plot 20', d: 20, op: 'add' },
  { nom: 'plot 7.5', d: 7.5, op: 'add' },
  { nom: 'poche 15', d: 15, op: 'cut' },
  { nom: 'plot symétrique 30', d: 30, op: 'add', mid: true },
  { nom: 'poche inversée 5', d: 5, op: 'cut', flip: true },
  { nom: 'poche à travers', d: 20, op: 'cut', through: true },
];

function verifNatif(f) {
  const v = path.join(dossier, 'v.json');
  fs.rmSync(v, { force: true });
  const q = spawnSync(EXE, ['--verif', f, v], { encoding: 'utf8' });
  if (!fs.existsSync(v)) return { echec: q.stderr || String(q.status) };
  return JSON.parse(fs.readFileSync(v, 'utf8')).cas[0];
}

(async () => {
  const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r));
  const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ex-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('dialog', d => { erreurs.push('dialogue : ' + d.message()); d.dismiss().catch(() => {}); });
  await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
  await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 300000 });
  const charger = async (f, n) => {
    // Pas de question « abandonner les modifications ? » entre deux essais ; le document vidé dit quand le suivant est chargé
    await page.evaluate(() => { mffPendingOpen = true; doc = { name: '', sketches: [], features: [], cgeo: [], bodyVis: {}, bodies: [], bodySeq: 1, activeBody: null, mep: null }; });
    await page.setInputFiles('#fileProj', f);
    await page.waitForFunction(n => doc && (doc.features || []).length === n, n, { timeout: 300000 });
    await attendre(300);
    await page.waitForFunction(() => !skEdit && rebuildDepth === 0, null, { timeout: 300000 });
    await attendre(100);
  };
  const volume = () => page.evaluate(() => { const sh = typeof occLive !== 'undefined' && occLive && occLive.shape; return sh ? occCoqueVolume(sh) : null; });
  try {
    const d0 = lire(source);
    const n0 = d0.features.length;
    const candidates = [];
    d0.sketches.forEach((k, i) => candidates.push(i));
    for (const i of candidates) {
      for (const R of REGLAGES) {
        const k = d0.sketches[i];
        const sortie = path.join(dossier, 'ex.conceptcad');
        const args = ['--extruder', source, sortie, String(i), String(R.d), R.op];
        if (R.mid) args.push('mid'); if (R.flip) args.push('flip'); if (R.through) args.push('through');
        const w = spawnSync(EXE, args, { encoding: 'utf8' });
        const quoi = `${k.name} ${R.nom}`;
        if (w.status !== 0) { bilan(false, `${quoi} : refus du natif ${w.status} ${w.stderr}`); continue; }
        const dn = lire(sortie);
        const fn = dn.features.at(-1);
        // Le navigateur : mêmes clics que le panneau, depuis la pièce d'origine
        erreurs.length = 0;
        await charger(source, n0);
        const v = await page.evaluate(({ id, R }) => {
          const nf = extDynNew(id);
          const pose = () => {
            if (R.op === 'cut') extDynSet('', g => { g.op = 'cut'; if (!g.upto && !g.through) g.distance = Math.abs(g.distance || 20) * -1; ghostHide = g.id; });
            if (R.through) extDynSet('', g => { g.upto = null; g.through = true; g.distance = null; });
            else extDynSet('', g => extDistSet(g, Math.abs(R.d) * ((g.op || 'add') === 'cut' ? -1 : 1)));
            if (R.mid) extDynSet('', g => { g.mid = true; });
            if (R.flip) extDynSet('', g => { g.flip = !g.flip; });
          };
          pose();
          extDynOk();
          return JSON.parse(JSON.stringify(doc.features.find(x => x.id === nf.id), (k, x) => k.charCodeAt(0) === 95 ? undefined : x));
        }, { id: k.id, R });
        await page.waitForFunction(() => rebuildDepth === 0, null, { timeout: 300000 });
        await attendre(150);
        const vDirect = await volume();
        const ek = { ...fn }, ev = { ...v }; delete ek.id; delete ev.id;
        const texteEgal = JSON.stringify(Object.keys(ek).sort().map(c => [c, ek[c]])) === JSON.stringify(Object.keys(ev).filter(c => !(c === 'flip' && !ev.flip)).sort().map(c => [c, ev[c]]));
        const skV = dn.sketches[i].visible === false;
        const memeReste = JSON.stringify({ ...d0, sketches: d0.sketches.map(x => ({ ...x, visible: 0 })) }) === JSON.stringify({ ...dn, features: dn.features.slice(0, -1), sketches: dn.sketches.map(x => ({ ...x, visible: 0 })) });
        const memeEsquisses = d0.sketches.every((x, j) => j === i || x.visible === dn.sketches[j].visible);
        // Le fichier du natif, rouvert par le navigateur et par le natif
        await charger(sortie, n0 + 1);
        const vRouvert = await volume();
        const n = verifNatif(sortie);
        const ok = texteEgal && skV && memeReste && memeEsquisses && !erreurs.length && procheV(n.volume, vDirect) && procheV(vRouvert, vDirect);
        bilan(ok, `${quoi} : ${fn.name}, texte ${texteEgal}${texteEgal ? '' : ' ' + JSON.stringify(ek) + ' / ' + JSON.stringify(ev)}, masquée ${skV}, reste intact ${memeReste && memeEsquisses}, volume natif ${n.volume} navigateur ${vDirect} rouvert ${vRouvert} ${erreurs.slice(0, 2).join(' ')}`);
      }
    }
    const dossierEx = opt('toutes');
    if (dossierEx) {
      const fichiers = fs.readdirSync(dossierEx).filter(f => f.endsWith('.conceptcad'));
      let nb = 0, sansVolume = 0, ignorees = 0;
      const max = +opt('max') || Infinity;
      for (const f of fichiers) {
        const d = lire(path.join(dossierEx, f));
        for (let i = 0; i < d.sketches.length && nb < max; i++) {
          const k = d.sketches[i];
          if (!(k.entities || []).length) { ignorees++; continue; }
          const seule = path.join(dossier, 'seule.conceptcad'), sortie = path.join(dossier, 'seule-ex.conceptcad');
          fs.writeFileSync(seule, JSON.stringify({ name: 'essai', sketches: [{ ...k, host: k.host ? null : undefined }], features: [], cgeo: [], bodies: [{ id: 'b1', name: 'Corps 1', c: null }], bodySeq: 2, activeBody: 'b1', bodyVis: {}, mep: null, params: d.params || [] }));
          const w = spawnSync(EXE, ['--extruder', seule, sortie, '0', '20', 'add'], { encoding: 'utf8' });
          const quoi = `${f} / ${k.name}`;
          if (w.status !== 0) { bilan(false, `${quoi} : refus du natif ${w.status} ${w.stderr}`); continue; }
          const n = verifNatif(sortie);
          if ((n.nonPrisEnCharge || []).length) { ignorees++; continue; }
          nb++;
          erreurs.length = 0;
          await charger(sortie, 1);
          const v = await volume();
          const fauxDialogue = erreurs.filter(e => !/dialogue/.test(e));
          if (!v && !n.volume) { sansVolume++; justes++; continue; }
          bilan(procheV(n.volume, v) && !fauxDialogue.length, `${quoi} : natif ${n.volume}, navigateur ${v} ${erreurs.slice(0, 2).join(' ')}`);
          if (nb % 20 === 0) console.log(`… ${nb} esquisses, ${faux} écarts`);
        }
      }
      console.log(`${nb} esquisses essayées, ${sansVolume} sans volume des deux côtés, ${ignorees} ignorées (vides ou non reprises)`);
    }
  } finally { await ctx.close().catch(() => {}); serveur.kill(); }
  console.log(`${justes} pareils, ${faux} écarts.`);
  process.exit(faux ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
