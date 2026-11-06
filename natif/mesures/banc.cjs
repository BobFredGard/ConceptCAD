// Banc natif / navigateur : même pièce, même suite de modifications, même relevé mémoire.
//   node natif/mesures/banc.cjs "<fichier .conceptcad>" <indice fonction> [tours] [--parite v1,v2,...]
// Relevé : somme sur TOUS les processus de l'arbre (mémoire privée « gestionnaire des tâches » et mémoire engagée).
// Protocole : ouverture, 10 s de repos, relevé ; 120 modifications de la profondeur de la fonction
// (d + 0,05 mm × i), 20 ms entre deux ; 10 s de repos, relevé.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net'), crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..', '..');
const EXE = path.join(RACINE, 'natif', 'sortie', 'ConceptCADNatif.exe');
const { chromium } = require(path.join(RACINE, 'node_modules', '@playwright', 'test'));

const PS_RAM = `
param([int]$racine)
$tous = Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name
$garde = New-Object 'System.Collections.Generic.HashSet[int]'
[void]$garde.Add($racine)
do { $n = $garde.Count; foreach ($p in $tous) { if ($garde.Contains([int]$p.ParentProcessId)) { [void]$garde.Add([int]$p.ProcessId) } } } while ($garde.Count -ne $n)
$perf = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process
$pv = 0; $ws = 0; $eng = 0; $nb = 0; $det = @()
foreach ($q in $perf) { if ($garde.Contains([int]$q.IDProcess) -and $q.IDProcess -ne 0) { $pv += $q.WorkingSetPrivate; $ws += $q.WorkingSet; $eng += $q.PrivateBytes; $nb++; $det += ($q.Name + '=' + [math]::Round($q.WorkingSetPrivate/1MB)) } }
Write-Output (@{prive=[math]::Round($pv/1MB,1); ws=[math]::Round($ws/1MB,1); engage=[math]::Round($eng/1MB,1); processus=$nb; detail=($det -join ' ')} | ConvertTo-Json -Compress)
`;
const psFichier = path.join(os.tmpdir(), 'cc-banc-ram-' + process.pid + '.ps1');
fs.writeFileSync(psFichier, PS_RAM);
function ram(pid) {
  const s = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFichier, String(pid)], { encoding: 'utf8' });
  return JSON.parse(s.trim().split('\n').pop());
}
// Option --rapides : tout l'arbre de processus sur les cœurs rapides (processeur à deux sortes de cœurs). Sans cela, Windows
// peut placer un côté sur les cœurs économes (1,7 fois plus lents) et la comparaison de vitesse ne vaut rien.
const PS_EPINGLE = `
param([int]$racine,[int64]$masque)
$tous = Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId
$garde = New-Object 'System.Collections.Generic.HashSet[int]'
[void]$garde.Add($racine)
do { $n = $garde.Count; foreach ($p in $tous) { if ($garde.Contains([int]$p.ParentProcessId)) { [void]$garde.Add([int]$p.ProcessId) } } } while ($garde.Count -ne $n)
$ok = 0
foreach ($i in $garde) { try { $q = Get-Process -Id $i -ErrorAction Stop; $q.ProcessorAffinity = [IntPtr]$masque; if ($q.ProcessorAffinity.ToInt64() -eq $masque) { $ok++ } } catch {} }
Write-Output $ok
`;
const psEpingle = path.join(os.tmpdir(), 'cc-banc-epingle-' + process.pid + '.ps1');
fs.writeFileSync(psEpingle, PS_EPINGLE);
const MASQUE = process.argv.includes('--rapides') ? 0xff : 0;
function epingler(pid) {
  if (!MASQUE) return;
  const ok = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psEpingle, String(pid), String(MASQUE)], { encoding: 'utf8' }).trim();
  console.log('  processus sur coeurs rapides :', ok);
}
const attendre = ms => new Promise(r => setTimeout(r, ms));
const mediane = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
const quantile = (a, q) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) * q)] : null; };
const portLibre = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

let serveur = null, urlBase = null;
async function demarrerServeur() {
  const port = await portLibre();
  serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  urlBase = 'http://127.0.0.1:' + port;
  await attendre(800);
  // Le code servi est-il bien celui de ce dossier ?
  const servi = Buffer.from(await (await fetch(urlBase + '/ConceptCAD.html')).arrayBuffer());
  const local = fs.readFileSync(path.join(RACINE, 'ConceptCAD.html'));
  const h = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
  if (h(servi) !== h(local)) throw new Error('le serveur ne sert pas le code de ce dossier');
  return { port, empreinte: h(servi) };
}

async function ouvrirNavigateur(fichier) {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-banc-chrome-'));
  const ctx = await chromium.launchPersistentContext(profil, {
    channel: 'chrome', headless: false, viewport: { width: 1400, height: 900 },
    args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('dialog', d => { erreurs.push('dialogue : ' + d.message()); d.dismiss().catch(() => {}); });
  await page.goto(urlBase + '/ConceptCAD.html');
  await page.waitForFunction(() => typeof occtReady !== 'undefined' && (occtReady === true || /échec|indisponible/.test(occBaseMsg)), null, { timeout: 300000 });
  await page.waitForFunction(() => !skEdit && rebuildDepth === 0);
  await page.setInputFiles('#fileProj', fichier);
  await page.waitForFunction(() => doc && (doc.features || []).length && bodies.some(b => b.shape), null, { timeout: 200000 });
  await page.waitForFunction(() => rebuildDepth === 0);
  await page.bringToFront();
  // Le navigateur lancé par le banc : son processus racine, retrouvé par son dossier de profil
  const racine = pidNavigateur(profil);
  return { ctx, page, erreurs, profil, racine };
}
function pidNavigateur(profil) {
  const cle = path.basename(profil);
  const s = execFileSync('powershell', ['-NoProfile', '-Command',
    "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*" + cle + "*' -and $_.CommandLine -notlike '*--type=*' } | Select-Object -First 1 -ExpandProperty ProcessId"], { encoding: 'utf8' });
  return parseInt(s.trim(), 10);
}
const MESURES_PAGE = () => {
  const sh = occLive && occLive.shape;
  if (!sh) return null;
  const E = occt.TopAbs_ShapeEnum, compter = t => { let n = 0; const x = new occt.TopExp_Explorer_2(sh, t, E.TopAbs_SHAPE); while (x.More()) { n++; x.Next(); } x.delete(); return n; };
  const G = new occt.GProp_GProps_1(); occt.BRepGProp.SurfaceProperties_1(sh, G, false, false); const aire = G.Mass(); G.delete();
  const b = new occt.Bnd_Box_1(); occt.BRepBndLib.Add(sh, b, true); const a = occXyz(b.CornerMin()), z = occXyz(b.CornerMax()); b.delete();
  return { volume: occCoqueVolume(sh), aire, faces: compter(E.TopAbs_FACE), aretes: compter(E.TopAbs_EDGE), sommets: compter(E.TopAbs_VERTEX), solides: compter(E.TopAbs_SOLID), valide: occCoqueValide(sh), boite: [...a, ...z] };
};

async function pariteNavigateur(fichier, iF, valeurs) {
  const n = await ouvrirNavigateur(fichier);
  const sorties = [];
  sorties.push({ nom: 'tel quel', ...(await n.page.evaluate(MESURES_PAGE)) });
  for (const v of valeurs) {
    await n.page.evaluate(([i, x]) => { doc.features[i].distance = x; markDirty(); rebuild(); }, [iF, v]);
    await n.page.waitForFunction(() => rebuildDepth === 0);
    sorties.push({ nom: iF + '=' + v, ...(await n.page.evaluate(MESURES_PAGE)) });
  }
  const version = await n.page.evaluate(() => APP_VER + ' ; ' + occBaseMsg);
  const msgs = await n.page.evaluate(() => (typeof faceEl !== 'undefined' && faceEl.textContent) || '');
  await n.ctx.close();
  return { sorties, version, erreurs: n.erreurs, msgs };
}
function pariteNatif(fichier, iF, valeurs) {
  const sortie = path.join(os.tmpdir(), 'cc-banc-verif-' + process.pid + '.json');
  execFileSync(EXE, ['--verif', fichier, sortie, ...valeurs.map(v => iF + '=' + v)], { stdio: 'ignore' });
  return JSON.parse(fs.readFileSync(sortie, 'utf8'));
}

async function tourNavigateur(fichier, iF, nb = 120, reposMs = 10000) {
  const n = await ouvrirNavigateur(fichier);
  epingler(n.racine);
  await attendre(reposMs);
  const repos = ram(n.racine);
  const r = await n.page.evaluate(async ([i, nb]) => {
    const f = doc.features[i], d = +f.distance, calc = [], total = [];
    for (let k = 1; k <= nb; k++) {
      const t0 = performance.now();
      f.distance = d + Math.sign(d) * 0.05 * k; markDirty(); rebuild();
      calc.push(performance.now() - t0);
      await new Promise(res => requestAnimationFrame(res));
      total.push(performance.now() - t0);
      await new Promise(res => setTimeout(res, 20));
    }
    f.distance = d;
    // Rejeu seul, sans maillage ni affichage ni caches : la part du noyau, comparable au natif
    const rejeu = [];
    for (let k = 0; k < 5; k++) { occCkClear(); const t0 = performance.now(); const FR = occFinalShape(null); rejeu.push(performance.now() - t0); occCleanup(FR, null); }
    window.__rejeu = rejeu.sort((a, b) => a - b)[2];
    return { calc, total, tas: occt.HEAP8.length / 1048576, msRejeu: window.__rejeu };
  }, [iF, nb]);
  await attendre(reposMs);
  const apres = ram(n.racine);
  const erreurs = n.erreurs;
  await n.ctx.close();
  return { repos, apres, msCalc: mediane(r.calc), msTotal: mediane(r.total), ms90: quantile(r.total, 0.9), tasNoyauMo: r.tas, msRejeu: r.msRejeu, erreurs };
}

async function tourNatif(fichier, options) {
  const journal = path.join(os.tmpdir(), 'cc-banc-journal-' + process.pid + '-' + Date.now() + '.txt');
  const reposMs = options.reposMs == null ? 10000 : options.reposMs;
  const args = [...(options.sequentiel ? ['--sequentiel'] : []), '--protocole', fichier, journal, String(options.nb || 120)];
  const p = spawn(EXE, args, { stdio: 'ignore', cwd: path.dirname(EXE) });
  const lire = () => { try { return fs.readFileSync(journal, 'utf8'); } catch (e) { return ''; } };
  for (let i = 0; i < 600 && !/pret/.test(lire()); i++) await attendre(100);
  if (!/pret/.test(lire())) { p.kill(); throw new Error('natif : pas prêt'); }
  epingler(p.pid);
  await attendre(reposMs);
  const repos = ram(p.pid);
  fs.writeFileSync(journal + '.go', '1');
  for (let i = 0; i < 60000 && !/fin/.test(lire()); i++) await attendre(100);
  if (!/fin/.test(lire())) { p.kill(); throw new Error('natif : protocole inachevé'); }
  await attendre(reposMs);
  const apres = ram(p.pid);
  p.kill();
  const lignes = lire().split('\n').filter(l => l.startsWith('modif')).map(l => l.split(' ').map(Number));
  const col = c => lignes.map(l => l[c]), ms = col(2);
  return { repos, apres, msTotal: mediane(ms), ms90: quantile(ms, 0.9), nb: ms.length, msRejeu: mediane(col(3)), msMaillage: mediane(col(4)) };
}

// Plateau : la mémoire se stabilise-t-elle ? Relevé toutes les 120 modifications, jusqu'à 600, sans repos.
async function plateauNatif(fichier) {
  const journal = path.join(os.tmpdir(), 'cc-banc-plateau-' + process.pid + '-' + Date.now() + '.txt');
  const p = spawn(EXE, ['--protocole', fichier, journal, '600'], { stdio: 'ignore', cwd: path.dirname(EXE) });
  const lire = () => { try { return fs.readFileSync(journal, 'utf8'); } catch (e) { return ''; } };
  while (!/pret/.test(lire())) await attendre(100);
  await attendre(10000);
  const serie = [ram(p.pid).prive];
  fs.writeFileSync(journal + '.go', '1');
  for (const n of [120, 240, 360, 480, 600]) {
    while (!new RegExp('modif ' + n + ' ').test(lire())) await attendre(50);
    serie.push(ram(p.pid).prive);
  }
  await attendre(10000);
  serie.push(ram(p.pid).prive);
  p.kill();
  return serie;
}
async function plateauNavigateur(fichier, iF) {
  const n = await ouvrirNavigateur(fichier);
  await attendre(10000);
  const serie = [ram(n.racine).prive], d = await n.page.evaluate(i => +doc.features[i].distance, iF);
  for (let lot = 0; lot < 5; lot++) {
    await n.page.evaluate(async ([i, d0, l]) => {
      const f = doc.features[i];
      for (let k = 1; k <= 120; k++) {
        f.distance = d0 + Math.sign(d0) * 0.05 * (l * 120 + k); markDirty(); rebuild();
        await new Promise(res => requestAnimationFrame(res));
        await new Promise(res => setTimeout(res, 20));
      }
    }, [iF, d, lot]);
    serie.push(ram(n.racine).prive);
  }
  await attendre(10000);
  serie.push(ram(n.racine).prive);
  await n.ctx.close();
  return serie;
}

(async () => {
  const argv = process.argv.slice(2);
  const fichier = path.resolve(argv[0]), iF = +argv[1], tours = +(argv[2] || 3);
  const valeurs = [5, 12.5, 30];
  const sortie = { piece: path.basename(fichier), fonction: iF, date: new Date().toISOString(), machine: { coeurs: os.cpus().length, memoireGo: Math.round(os.totalmem() / 2 ** 30), processeur: os.cpus()[0].model } };
  sortie.serveur = await demarrerServeur();
  if (argv.includes('--vitesse')) {  // durées seules : tours courts et alternés, pour voir la dispersion
    const nb = 30, S = { natif: [], natifUnCoeur: [], navigateur: [] };
    for (let t = 0; t < tours; t++) {
      const a = await tourNatif(fichier, { nb, reposMs: 1000 }); S.natif.push({ total: a.msTotal, rejeu: a.msRejeu });
      const c = await tourNatif(fichier, { nb, reposMs: 1000, sequentiel: true }); S.natifUnCoeur.push({ total: c.msTotal, rejeu: c.msRejeu });
      const b = await tourNavigateur(fichier, iF, nb, 1000); S.navigateur.push({ total: b.msCalc, rejeu: b.msRejeu });
      console.log('tour', t + 1, 'natif', a.msTotal, '(rejeu', a.msRejeu, 'maillage', a.msMaillage, ') 1 coeur', c.msTotal, '(rejeu', c.msRejeu, 'maillage', c.msMaillage, ') chrome', b.msCalc, '(rejeu', b.msRejeu, ')');
    }
    fs.writeFileSync(path.join(__dirname, 'vitesse-' + path.basename(fichier, '.conceptcad').replace(/[^\w-]+/g, '_') + (MASQUE ? '-coeurs-rapides' : '') + '.json'), JSON.stringify({ modifsParTour: nb, ...S }, null, 1));
    serveur.kill(); fs.unlinkSync(psFichier); return;
  }
  if (argv.includes('--plateau')) {
    const a = await plateauNatif(fichier); console.log('natif   repos,120..600,repos :', a.join(' '));
    const b = await plateauNavigateur(fichier, iF); console.log('chrome  repos,120..600,repos :', b.join(' '));
    fs.writeFileSync(path.join(__dirname, 'plateau-' + path.basename(fichier, '.conceptcad').replace(/[^\w-]+/g, '_') + '.json'), JSON.stringify({ natif: a, navigateur: b }));
    serveur.kill(); fs.unlinkSync(psFichier); return;
  }
  console.log('serveur', sortie.serveur);
  const pn = pariteNatif(fichier, iF, valeurs);
  const pb = await pariteNavigateur(fichier, iF, valeurs);
  sortie.parite = { navigateur: pb.sorties, natif: pn.cas, version: pb.version, erreursNavigateur: pb.erreurs, messagesNavigateur: pb.msgs, nonPrisEnCharge: pn.nonPrisEnCharge };
  console.log('version', pb.version);
  for (let i = 0; i < pb.sorties.length; i++) {
    const a = pb.sorties[i], b = pn.cas[i];
    console.log(a.nom, '| nav V', a && a.volume, 'F', a && a.faces, 'A', a && a.aretes, '| nat V', b.volume, 'F', b.faces, 'A', b.aretes, '| écart V', a ? (b.volume - a.volume).toExponential(2) : '?', 'valide', a && a.valide, b.valide);
  }
  if (argv.includes('--parite')) { serveur.kill(); fs.unlinkSync(psFichier); return; }
  sortie.navigateur = []; sortie.natif = []; sortie.natifSequentiel = [];
  for (let t = 0; t < tours; t++) {
    console.log('tour', t + 1);
    const a = await tourNatif(fichier, {}); sortie.natif.push(a); console.log(' natif   ', a.repos.prive, '->', a.apres.prive, 'Mo | ms', a.msTotal, 'nb', a.nb);
    const b = await tourNavigateur(fichier, iF); sortie.navigateur.push(b); console.log(' chrome  ', b.repos.prive, '->', b.apres.prive, 'Mo | calc ms', b.msCalc, 'avec image', b.msTotal, 'tas', b.tasNoyauMo, b.erreurs.join(';'));
    const c = await tourNatif(fichier, { sequentiel: true }); sortie.natifSequentiel.push(c); console.log(' natif 1c', c.repos.prive, '->', c.apres.prive, 'Mo | ms', c.msTotal);
  }
  const dest = path.join(__dirname, 'resultats-' + path.basename(fichier, '.conceptcad').replace(/[^\w-]+/g, '_') + '.json');
  fs.writeFileSync(dest, JSON.stringify(sortie, null, 1));
  console.log('écrit', dest);
  serveur.kill();
  fs.unlinkSync(psFichier);
})().catch(e => { console.error(e); if (serveur) serveur.kill(); process.exit(1); });
