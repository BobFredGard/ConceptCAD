// Suite CIBLÉE : ne lance que les suites touchées par ce qui a changé depuis leur dernier passage.
//   node tests/run-cible.cjs              parmi la suite rapide (npm run ci)
//   node tests/run-cible.cjs --complete   parmi toute la suite (npm run test:cible)
//   node tests/run-cible.cjs --liste      montre le tri et ses raisons, sans rien lancer
//   node tests/run-cible.cjs --tout       lance toute la liste (comme run.cjs / run-fast.cjs)
//   (+ les options du pool : -j N, --verbose)
//
// Le tri s'appuie sur la carte des tests (tests/carte.cjs) : pour chaque suite, les lignes de
// src/ et PostPro/ qu'elle a réellement exécutées lors de son dernier passage. Une suite est lancée :
//   • si elle n'a jamais été relevée, ou était rouge (ou coupée) la dernière fois ;
//   • si une ligne modifiée d'un fichier source fait partie des lignes qu'elle a exécutées
//     (une ligne ajoutée compte pour ses deux voisines ; un commentaire seul ne compte pas) ;
//   • si son propre fichier, un fichier qu'elle cite (aide de tests/, Exemples/, outil de tools/,
//     documents) a changé ;
//   • TOUTES si ce qui change touche tout : code exécuté au chargement (toutes les suites passent
//     par ces lignes), fichier source ajouté / retiré, page HTML hors script, noyau occt/,
//     threejs/, build.js, tests/appvm.cjs…
// Les suites qui ne chargent pas l'application (contrôles du texte des sources) sont toujours
// lancées : elles durent quelques dixièmes de seconde.
// Une ligne modifiée qu'aucune suite n'exécute (fonction que les tests n'appellent jamais) est
// signalée : aucun test ne peut la vérifier. Chaque passage met la carte à jour pour les suites lancées.
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./carte.cjs');
const { pool } = require('./pool.cjs');

const argv = process.argv.slice(2);
const COMPLETE = argv.includes('--complete');
const LISTE = argv.includes('--liste');
const TOUT = argv.includes('--tout');
const rapide = require('./run-fast.cjs'), complete = require('./run.cjs');
const nomS = e => e.split(':')[0];
const SUITES = [...new Set((COMPLETE ? complete.SUITES.concat(rapide.SUITES) : rapide.SUITES).map(nomS))];
const TIMEOUT = COMPLETE ? complete.TIMEOUT : rapide.TIMEOUT;
const TITRE = 'SUITE CIBLÉE' + (COMPLETE ? ' (complète)' : ' (rapide)');

// Fichiers hors src/ qui changent ce que voient toutes les suites
const PARTOUT = [/^occt\//, /^threejs\//, /^build\.js$/, /^tests\/appvm\.cjs$/, /^tests\/noyau\.cjs$/, /^tests\/fixtures\//];
// Fichiers sans effet sur les suites Node (lanceurs, tests navigateur, outillage local)
const SANS_EFFET = [/^tests\/(pool|coeurs|run|run-fast|run-cible|carte|etalon-coeur)\.cjs$/, /^tests\/browser\//, /^tests\/parcours\//,
  /^\.claude\//, /^\.github\//, /^\.gitignore$/, /^\.gitattributes$/, /^Backup\//];

function trier() {
  const { D, perime } = C.etatLivrable();
  if (perime) {
    console.error('✗ ConceptCAD.html en retard sur ' + perime + ' : lancez node build.js');
    process.exit(1);
  }
  const blobs = C.empreintes(D);
  const liste = C.listeFichiers(D);
  const carte = C.lireCarte();
  const choix = new Map(); // suite → raison
  const prendre = (s, r) => { if (!choix.has(s)) choix.set(s, r); };
  if (TOUT) { SUITES.forEach(s => prendre(s, 'demandé (--tout)')); return { choix, notes: [] }; }
  const notes = [];

  // ── textes des suites (pour « fichier cité ») ──
  const texte = {};
  const lireSuite = s => texte[s] ?? (texte[s] = (() => { try { return fs.readFileSync(path.join(__dirname, s + '.cjs'), 'utf8'); } catch (e) { return ''; } })());

  // ── fichiers hors src/ changés depuis le commit de chaque relevé ──
  const horsSrcDe = {};
  let nonSuivis = null;
  function horsSrc(base) {
    if (horsSrcDe[base]) return horsSrcDe[base];
    let l;
    try {
      l = C.git(['diff', '--name-only', base]).split(/\r?\n/).filter(Boolean);
      if (!nonSuivis) nonSuivis = C.git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
      l = l.concat(nonSuivis);
    } catch (e) { l = null; } // commit inconnu (historique réécrit) : tout
    return (horsSrcDe[base] = l && l.filter(f => !/^(src|PostPro)\//.test(f) && f !== 'ConceptCAD.html' && !SANS_EFFET.some(r => r.test(f))));
  }
  // fichiers de src/ et PostPro/ changés depuis ce commit (null : commit inconnu)
  const srcDe = {};
  function srcChanges(base) {
    if (base in srcDe) return srcDe[base];
    try { srcDe[base] = C.git(['diff', '--name-only', base, '--', 'src', 'PostPro']).split(/\r?\n/).filter(Boolean).concat((nonSuivis || []).filter(f => /^(src|PostPro)\//.test(f))); } catch (e) { srcDe[base] = null; }
    return srcDe[base];
  }
  // une suite cite-t-elle ce fichier ?
  function cite(s, f) {
    const b = path.basename(f), n = b.replace(/\.[^.]+$/, '');
    const t = lireSuite(s);
    return t.includes(b) || (n.length >= 4 && new RegExp('[\\/\'"`]' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[.\'"`]').test(t));
  }

  // ── lignes modifiées d'un fichier source entre deux empreintes (coordonnées de l'ancienne) ──
  const morceaux = {};
  function modifs(f, a, b) {
    const k = a + '>' + b;
    if (morceaux[k]) return morceaux[k];
    const out = [];
    let d = '';
    try { d = C.git(['diff', '-U0', '--no-color', '--no-ext-diff', a, b]); } catch (e) { return (morceaux[k] = null); }
    let cur = null;
    for (const ligne of d.split(/\r?\n/)) {
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(ligne);
      if (m) {
        const oa = +m[1], on = m[2] === undefined ? 1 : +m[2], na = +m[3], nn = m[4] === undefined ? 1 : +m[4];
        cur = { oa, on, na, nn, a: oa, b: on ? oa + on - 1 : oa + 1, cle: f + ':' + na + '+' + nn };
        out.push(cur);
      }
    }
    // commentaires ou lignes vides seulement (des deux côtés) : sans effet
    const sa = sansCode(a), sb = sansCode(b);
    const neutre = h => {
      for (let l = h.oa; l < h.oa + h.on; l++) if (!sa[l - 1]) return false;
      for (let l = h.na; l < h.na + h.nn; l++) if (!sb[l - 1]) return false;
      return true;
    };
    // ligne ajoutée : comptée pour les lignes de code qui l'entourent dans l'ancien texte
    for (const h of out) if (!h.on) {
      let x = h.oa, y = h.oa + 1;
      while (x >= 1 && sa[x - 1]) x--;
      while (y <= sa.length && sa[y - 1]) y++;
      h.a = x >= 1 ? x : y; h.b = y <= sa.length ? y : h.a;
    }
    // seules les lignes de code de l'ancien texte comptent (un commentaire dans un bloc exécuté au
    // démarrage passerait pour une ligne de toutes les suites)
    for (const h of out) {
      h.code = [];
      for (let l = Math.max(1, h.a); l <= h.b; l++) if (!sa[l - 1] && (h.on || l === h.a || l === h.b)) h.code.push(l);
    }
    return (morceaux[k] = out.filter(h => !neutre(h)));
  }
  const sansCodeDe = {};
  const sansCode = blob => sansCodeDe[blob] || (sansCodeDe[blob] = C.lignesSansCode(C.git(['cat-file', '-p', blob]).replace(/\r\n/g, '\n')));
  // morceau dans le script actuel : code de chargement (→ tout) ou fonction toute neuve (sans effet
  // tant que du code modifié ailleurs ne l'appelle pas) ?
  let CH;
  function nature(f, h) {
    if (CH === undefined) CH = C.lignesChargement(D);
    if (!CH) return h.on ? 'code' : 'inconnu'; // acorn absent : une ligne ajoutée peut tourner au chargement
    const s = D.sections.find(x => x.fichier === f);
    if (!s || !h.nn) return 'code';
    const l0 = s.debut + h.na - 1, l1 = l0 + h.nn - 1;
    const texte = l => D.script.slice(D.debuts[l], D.debuts[l + 1]);
    // numéro de version ou étiquette de cache seuls (changés à chaque livraison) : lus au chargement,
    // mais seules les suites qui en parlent les vérifient
    const V = h.on === 1 && h.nn === 1 && /^const (APP_VER|CACHE_VER|FORMES_VER)\s*=\s*'[^']*';/.exec(texte(l0));
    if (V) return 'version:' + V[1];
    // constante toute neuve (const X=60000;) : sans effet tant que du code modifié ne la lit pas ;
  // fonction toute neuve : sans effet tant que du code modifié ne l'appelle pas
    const CONST = /^\s*(const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(-?[\d.e_]+|'[^'\\]*'|"[^"\\]*"|true|false|null)\s*;?\s*(\/\/.*)?\r?\n?$/;
    let neuve = true;
    for (let l = l0; l <= l1; l++) {
      if (D.com[l] || D.pos[l] < 0) continue;
      if (CH.ch[l]) { if (!h.on && CONST.test(texte(l))) continue; return 'chargement'; }
      if (!(CH.fdeb[l] >= l0 && CH.fdeb[l] <= l1)) neuve = false;
    }
    return neuve && !h.on ? 'neuve' : 'code';
  }

  const carteDe = s => carte.suites[s];
  const touches = new Set(); // clés des morceaux touchés par au moins une suite
  const tousMorceaux = new Map(); // clé → { f, a, b, parSuite: {s:[a,b]} }
  let raisonTout = null;
  const examinees = []; // suites relevées, vertes, qui chargent l'application
  const natures = {}, neuves = new Set();

  for (const s of SUITES) {
    const e = carteDe(s);
    if (!e) { prendre(s, 'jamais relevée'); continue; }
    if (!e.vert) { prendre(s, 'rouge ou coupée la dernière fois'); continue; }
    if (e.tete !== D.tete) { raisonTout = raisonTout || 'page ConceptCAD.html modifiée hors script'; }
    if (e.liste !== liste) { raisonTout = raisonTout || 'fichier source ajouté, retiré ou renommé'; }
    // hors src/
    const hs = horsSrc(e.base);
    if (!hs) { raisonTout = raisonTout || 'commit du relevé introuvable (' + e.base.slice(0, 8) + ')'; continue; }
    for (const f of hs) {
      if (PARTOUT.some(r => r.test(f))) { raisonTout = raisonTout || f + ' modifié (touche toutes les suites)'; break; }
      if (f === 'tests/' + s + '.cjs') { prendre(s, 'son fichier ' + f + ' a changé'); break; }
      if (/^(docs\/|README\.md$|CHANGELOG\.md$|package\.json$)/.test(f) && s === 'test_docs_version') { prendre(s, f + ' modifié'); break; }
      if (/^Exemples\//.test(f) && s === 'test_exemples_sains') { prendre(s, f + ' modifié'); break; }
      if (cite(s, f)) { prendre(s, 'cite ' + f + ', modifié'); break; }
    }
    if (!e.app) {
      // suite qui lit elle-même des fichiers de src/ (sans l'application) : relancée si l'un d'eux a
      // changé ; si elle n'en nomme aucun (elle lit tout), toujours
      const lus = D.sections.map(x => x.fichier).filter(f => lireSuite(s).includes(path.basename(f)));
      if (!lus.length) { prendre(s, 'contrôle sans l’application (toujours lancé)'); continue; }
      const ch = srcChanges(e.base);
      const f = ch ? lus.find(x => ch.includes(x)) : lus[0];
      if (f) prendre(s, 'lit ' + f + ', modifié');
      continue;
    }
    // src/ et PostPro/
    examinees.push(s);
    for (const f in e.f) {
      const { b, l } = e.f[f];
      if (!blobs[f]) { raisonTout = raisonTout || f + ' retiré'; continue; }
      if (b === blobs[f]) continue;
      const hs2 = modifs(f, b, blobs[f]);
      if (!hs2) { raisonTout = raisonTout || 'comparaison impossible pour ' + f; continue; }
      const pl = C.dePlages(l);
      for (const h of hs2) {
        const kn = h.cle + ':' + h.on, nat = natures[kn] || (natures[kn] = nature(f, h));
        if (nat === 'chargement') { raisonTout = raisonTout || 'code exécuté au chargement modifié (' + f + ' ligne ' + h.na + ')'; continue; }
        if (nat === 'inconnu') { raisonTout = raisonTout || 'lignes ajoutées dans ' + f + ' et analyse du texte indisponible (acorn absent)'; continue; }
        if (nat === 'neuve') { neuves.add(f + ' ligne ' + h.na); continue; }
        if (nat.startsWith('version:')) { const v = nat.slice(8); if (lireSuite(s).includes(v)) prendre(s, 'vérifie ' + v + ', changé'); continue; }
        const M = tousMorceaux.get(h.cle) || { f, parSuite: {} };
        M.parSuite[s] = { pl, code: h.code };
        tousMorceaux.set(h.cle, M);
        if (h.code.some(l => C.touche(pl, l, l))) { touches.add(h.cle); prendre(s, 'exécute ' + f + ' ligne ' + h.a + (h.b > h.a ? '-' + h.b : '') + ', modifiée'); }
      }
    }
  }
  // morceaux exécutés par toutes les suites relevées = code de chargement → tout
  for (const [cle, M] of tousMorceaux) {
    if (!touches.has(cle)) continue;
    const n = Object.keys(M.parSuite).filter(s => M.parSuite[s].code.some(l => C.touche(M.parSuite[s].pl, l, l))).length;
    if (examinees.length > 3 && n === examinees.length) { raisonTout = raisonTout || 'code exécuté par toutes les suites (' + cle.split(':')[0] + ')'; break; }
  }
  // morceaux exécutés par personne : fonction qu'aucune suite n'appelle, aucune ne peut la vérifier
  for (const [cle, M] of tousMorceaux) {
    if (touches.has(cle)) continue;
    notes.push(M.f + ' vers la ligne ' + cle.split(':').pop().split('+')[0] + ' : code modifié qu’aucune suite n’exécute (aucun test ne le vérifie)');
  }
  neuves.forEach(n => notes.push(n + ' : code nouveau (fonction ou constante), vérifié par les suites du code modifié qui s’en sert'));
  if (raisonTout) { SUITES.forEach(s => prendre(s, 'tout : ' + raisonTout)); notes.unshift('Tout est relancé : ' + raisonTout); }
  return { choix, notes };
}

const { choix, notes } = trier();
const lancees = SUITES.filter(s => choix.has(s));
console.log(TITRE + ' : ' + lancees.length + ' suites sur ' + SUITES.length + ' touchées par les modifications');
notes.forEach(n => console.log('  · ' + n));
const parRaison = {};
lancees.forEach(s => { const r = choix.get(s); (parRaison[r] = parRaison[r] || []).push(s); });
Object.entries(parRaison).sort((a, b) => b[1].length - a[1].length).slice(0, LISTE ? 1e9 : 12).forEach(([r, l]) =>
  console.log('  ' + String(l.length).padStart(4) + '  ' + r + (LISTE || l.length <= 4 ? ' : ' + l.join(', ') : '')));
// temps estimé d'après les durées du dernier passage (tests/.durees.json, en équivalent cœur P)
try {
  let d = {};
  for (const f of [path.join(__dirname, '.durees.json'), path.join(path.dirname(C.fichierCarte()), '..', 'tests', '.durees.json')]) {
    try { d = Object.assign(JSON.parse(fs.readFileSync(f, 'utf8')), d); } catch (e) { /* absent */ }
  }
  const duree = s => Object.keys(d).filter(k => nomS(k) === s).reduce((n, k) => n + d[k], 0);
  const cumul = l => l.reduce((n, s) => n + duree(s), 0) / 1000;
  if (Object.keys(d).length) console.log('  durée cumulée estimée : ' + Math.round(cumul(lancees)) + ' s (toute la liste : ' + Math.round(cumul(SUITES)) + ' s)');
} catch (e) { /* estimation seulement */ }
if (LISTE) process.exit(0);
if (!lancees.length) { console.log(TITRE + ': 0/0 OK — rien à relancer'); process.exit(0); }
pool(lancees, { titre: TITRE, timeout: TIMEOUT });
