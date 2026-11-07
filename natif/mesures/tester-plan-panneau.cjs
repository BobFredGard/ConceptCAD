// Le panneau de la mise en plan : les mêmes réglages dans le navigateur et dans le programme natif, puis le plan enregistré comparé.
// node mesures/tester-plan-panneau.cjs <dossier> --racine=D:/ConceptCAD [--pieces=A,B]
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), z = require('zlib');
const { chromium } = require('playwright');
const opt = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dossier = path.resolve(process.argv[2]);
const RACINE = opt('racine', path.resolve(__dirname, '..', '..'));
const EX = opt('dossier', path.resolve(__dirname, '..', '..', 'Exemples'));
const EXE = path.resolve(__dirname, '..', 'sortie', 'ConceptCADNatif.exe');
const PIECES = opt('pieces', 'Perçages,Crochet,Griffe').split(',');
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(dossier, { recursive: true, force: true });
fs.mkdirSync(dossier, { recursive: true });

const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = z.gunzipSync(b); const j = JSON.parse(b.toString('utf8')); return j.doc || j; };
function ecart(a, b, ch, out) {
  if (out.length > 14) return;
  const creux = x => x === undefined || x === null || x === false || x === '';
  if (creux(a) && creux(b)) return;
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 0.02) out.push(`${ch} : ${a} / ${b}`); return; }
  if (typeof a === 'string' && typeof b === 'string' && /^[[{]/.test(a) && /^[[{]/.test(b)) { try { return ecart(JSON.parse(a), JSON.parse(b), ch, out); } catch (e) { /* du texte */ } }
  if (creux(a) || creux(b) || typeof a !== 'object' || typeof b !== 'object') { if (a !== b) out.push(`${ch} : ${JSON.stringify(a)} / ${JSON.stringify(b)}`.slice(0, 220)); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (k !== '_step' && k !== '_persp') ecart(a[k], b[k], ch + '.' + k, out);
}
// Ce qui se règle : tout le plan, sans ce que le fichier ne garde pas d'une session à l'autre
const resume = mep => {
  const ls = (mep.prefs && mep.prefs.ls) || {};
  const garde = {};
  for (const k of ['mep_paper', 'mep_exp_bw', 'mep_rulers', 'mep_lw', 'minifusion_mepDimStyle', 'minifusion_mepZoomRev', 'mep_frame_def']) garde[k] = ls[k];
  return { prefs: garde, sheets: mep.sheets };
};

// Dans la page : poser un champ par son libellé, cliquer un bouton par son texte
const AIDE = () => {
  const svg = () => document.getElementById('mepGSheet').ownerSVGElement;
  window.__px = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(svg().getScreenCTM()); return [Math.round(q.x), Math.round(q.y)]; };
  window.__mm = (px, py) => { const q = new DOMPoint(px, py).matrixTransform(svg().getScreenCTM().inverse()); return [q.x, q.y]; };
  const cote = () => document.getElementById('mepSide') || document;
  window.__champ = (lab, val) => {
    const racine = cote();
    let c = null;
    for (const r of racine.querySelectorAll('.row')) {
      const L = r.querySelector('label');
      if (L && L.textContent.trim() === lab) { c = r.querySelector('select,input:not([type=checkbox]):not([type=color]),textarea') || r.querySelector('input[type=color]') || r.querySelector('input'); break; }
    }
    if (!c) for (const i of racine.querySelectorAll('input,select')) if (i.title === lab && !i.dataset.__pris) { c = i; break; }
    if (!c) return false;
    if (c.type === 'checkbox') c.checked = val === '1';
    else c.value = val;
    c.disabled = false;
    c.dispatchEvent(new Event('input', { bubbles: true }));
    c.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  window.__bouton = lab => {
    for (const b of cote().querySelectorAll('button')) if (b.textContent.trim() === lab) { b.click(); return true; }
    return false;
  };
};

class Scene {
  constructor(page) { this.page = page; this.etapes = [{ atelier: 'plan' }]; this.perdus = []; }
  async mm(px, py) { return this.page.evaluate(([a, b]) => window.__mm(a, b), [px, py]); }
  async px(x, y) { return this.page.evaluate(([a, b]) => window.__px(a, b), [x, y]); }
  async clic(p) {
    await this.page.mouse.click(p[0], p[1]);
    this.etapes.push({ plan: { presse: await this.mm(p[0], p[1]) } }, { plan: { lache: 1 } });
    await attendre(60);
  }
  async champ(lab, val, labNatif) {
    const ok = await this.page.evaluate(([l, v]) => window.__champ(l, v), [lab, String(val)]);
    if (!ok) this.perdus.push('champ ' + lab);
    this.etapes.push({ reglagePlan: { champ: labNatif || lab, valeur: String(val) } });
    await attendre(40);
  }
  async bouton(lab, labNatif) {
    const ok = await this.page.evaluate(l => window.__bouton(l), lab);
    if (!ok) this.perdus.push('bouton ' + lab);
    this.etapes.push({ reglagePlan: { bouton: labNatif || lab } });
    await attendre(40);
  }
}

async function pointDeVue(g, v) {
  const p = g.page;
  for (let r = 0; r <= 70; r += 4) {
    const n = r ? Math.max(8, Math.round(r / 2)) : 1;
    for (let k = 0; k < n; k++) {
      const x = v.x + r * Math.cos(2 * Math.PI * k / n), y = v.y + r * Math.sin(2 * Math.PI * k / n);
      const q = await g.px(x, y);
      const libre = await p.evaluate(([px, py]) => {
        const [a, b] = window.__mm(px, py);
        if (__mepTest.dimAt(a, b)) return false;
        const el = document.elementFromPoint(px, py);
        return !!el && !!el.closest('svg');
      }, [q[0], q[1]]);
      if (!libre) continue;
      await p.mouse.click(q[0], q[1]);
      await attendre(10);
      if (await p.evaluate(id => __mepTest.viewSel() === id, v.id)) return q;
    }
  }
  return null;
}
const lesCotes = page => page.evaluate(() => {
  const r = [], vus = new Set();
  document.querySelectorAll('#mepGSheet text').forEach(t => {
    if (!/mepDimT/.test(t.getAttribute('class') || '')) return;
    const x = +t.getAttribute('x'), y = +t.getAttribute('y');
    const d = __mepTest.dimAt(x, y);
    if (d && !vus.has(d.id)) { vus.add(d.id); r.push({ id: d.id, kind: d.kind, x, y }); }
  });
  return r;
});
async function choisirVue(g, filtre) {
  const vues = await g.page.evaluate(() => doc.mep.sheets[doc.mep.cur || 0].views.map(v => ({ id: v.id, x: v.x, y: v.y, kind: v.kind, sec: !!(v.section && v.section.pid), axes: (v.axes || []).length, align: !!v.align })));
  for (const v of vues.filter(filtre)) {
    const q = await pointDeVue(g, v);
    if (q) {
      g.etapes.push({ plan: { presse: await g.mm(q[0], q[1]) } }, { plan: { lache: 1 } });
      return v;
    }
  }
  return null;
}

const SCENARIOS = {
  async planche(g) {
    await g.champ('Format', 'A2V');
    await g.champ('Format', 'Manuel');
    await g.champ('Largeur (mm)', 500);
    await g.champ('Hauteur (mm)', 900);
    await g.champ('Largeur (mm)', 20);
    await g.champ('Format', 'A3H');
    for (const b of ['Justet', 'ISO 5457', 'Classique']) await g.bouton(b);
    await g.champ('Marge gauche (mm)', 15);
    await g.champ('Marge droite (mm)', 12.5);
    await g.champ('Marge haute (mm)', 11);
    await g.champ('Marge basse (mm)', 60);
    await g.champ('Trait du cadre (mm)', 0.8);
    await g.champ('Liseré intérieur', '1');
    await g.champ('Repères de centrage', '1');
    await g.champ('Zones de repérage', '1');
    await g.champ('Coins de coupe', '1');
    await g.champ('Couleur du cadre', '#112233');
    await g.champ('Couleur des repères', '#445566');
    await g.bouton('Sombre');
    await g.bouton('Noir');
    await g.champ('Règles en mm', '0');
    await g.champ('Traits', 'iso5');
    await g.champ('Trait épais (mm)', 0.6, 'Trait épais (mm)');
    await g.champ('Lignes de rappel (mm)', 0.4);
    await g.champ('Axes de trous (mm)', 3);
    return 'planche';
  },
  async cartouche(g) {
    for (const [l, v] of [['Projet', 'Essai'], ['Client', 'Moi & cie'], ['Société', 'ACME'], ['Quantité', '3'], ['N° de plan', 'P-1'], ['Auteur', 'Fred'], ['Date', '01/02/2026'], ['Matière', 'Acier'], ['TTS (surface)', 'Zingué'], ['TTH (thermique)', 'Trempé']]) await g.champ(l, v);
    await g.champ('Tol. générales', 'ISO 2768-m');
    await g.bouton('+ Révision');
    await g.bouton('+ Révision');
    await g.champ('Révisions', '0', 'Révisions');
    await g.champ('Largeur totale (mm)', 120);
    await g.champ('Hauteur h (mm)', 3.5);
    await g.champ('Trait (mm)', 1.2);
    await g.bouton('= cartouche');
    await g.champ('Nomenclature', '1');
    return 'cartouche';
  },
  async ecriture(g) {
    await g.champ('Cotes h (mm)', 5);
    await g.champ('Repères, titres de vue h (mm)', 7);
    await g.champ('Nouveaux textes h (mm)', 2.5);
    await g.bouton('Valeurs ISO (3,5 / 5 / 3,5)');
    await g.champ('Hauteur du texte (mm)', 4.2);
    await g.champ('Angle des flèches (°)', 20);
    await g.champ('Longueur des flèches (mm)', 9);
    await g.champ('Précision (par défaut)', '3');
    await g.champ('Couleur', '#aa0011');
    await g.bouton('Réinitialiser');
    await g.champ('Hauteur du texte (mm)', 5);
    return 'écriture';
  },
  async vue(g) {
    let t = '';
    const v = await choisirVue(g, q => q.kind === 'base');
    if (v) {
      t += 'base ';
      await g.champ('Libellé', 'Z');
      await g.champ('Échelle', '2');
      await g.champ('Rendu', 'dash');
      await g.champ('Ombrage (faces)', '1');
      await g.champ('Rendu 3D (image)', '1');
      await g.champ('Miroir', '1');
      await g.champ('Rendu réaliste', '1');
      await g.champ('Arêtes tangentielles', '1');
      await g.champ('HLR exact OCCT', '0');
      await g.champ('HLR exact OCCT', '1');
      await g.champ('Axes des perçages', '1');
      await g.champ('Cercles de perçage', '1');
    }
    await g.page.keyboard.press('Escape');
    g.etapes.push({ plan: { touche: 'Echap' } });
    const c = await choisirVue(g, q => q.kind === 'section' && q.sec);
    if (c) {
      t += 'coupe ';
      await g.bouton('+ Brisure');
      await g.bouton('+ Brisure');
      await g.bouton('− Brisure');
      await g.champ('Échelle', '0.5');
    }
    return t;
  },
  // Inverser (flip) n'est pas comparé : le navigateur ne refait la vue que plus tard, le programme natif tout de suite
  async projection(g) {
    // Sur une vue sans axes ni cotes : les cotes d'une vue passée en perspective se rattachent autrement (écart connu)
    const cotees = await g.page.evaluate(() => doc.mep.sheets[doc.mep.cur || 0].dims.flatMap(d => [d.vid, d.vid2]));
    const v = await choisirVue(g, q => q.kind === 'base' && !q.axes && !cotees.includes(q.id));
    if (!v) return '';
    await g.champ('Projection', 'obl');
    await g.champ('Angle fuyante (°)', 30);
    await g.champ('Coef. fuyante', 0.7);
    await g.champ('Projection', 'persp');
    await g.champ('Fuyante (angle °)', 200);
    return 'base';
  },
  async cote(g) {
    const cotes = await lesCotes(g.page);
    let t = '';
    const parSorte = {};
    for (const d of cotes) {
      parSorte[d.kind] = (parSorte[d.kind] || 0) + 1;
      if (parSorte[d.kind] > 1) continue;
      await g.clic(await g.px(d.x, d.y - 0.6));
      await attendre(300);
      t += d.kind + ' ';
      if (d.kind === 'note' || d.kind === 'ord') continue;
      await g.champ('Texte avant', 'A ');
      await g.champ('Texte après', ' B');
      await g.champ('Précision', '3');
      await g.champ('Tolérance', 'pm');
      await g.champ('± mm', 0.25);
      await g.champ('Tolérance', 'dbl');
      await g.champ('+', 0.3);
      await g.champ('−', -0.2);
      await g.champ('Tolérance', 'cls');
      if (d.kind !== 'hole') {
        await g.champ('Type', 'shaft');
        await g.champ('Écart', 'g');
        await g.champ('Qualité (IT)', '6');
        await g.champ('Type', 'fit');
        await g.champ('Ajustement', 'H8/f7');
        await g.champ('Saisie', 'H7 / p6');
        await g.champ('Cote de référence', '1');
      } else {
        await g.champ('Écart', 'G');
        await g.champ('Qualité (IT)', '6');
      }
      if (d.kind === 'len' || d.kind === 'dist' || d.kind === 'ang') {
        await g.champ('Décalage texte (mm)', 6);
        await g.champ('Décalage texte (mm)', 1);
        await g.champ('Décalage texte (mm)', 50);
        if (d.kind !== 'ang') await g.bouton('Centrer');
      }
    }
    return t;
  },
};

(async () => {
  const port = 5200 + (process.pid % 400);
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  let justes = 0, faux = 0;
  for (const nom of PIECES) {
    for (const [scen, jouer] of Object.entries(SCENARIOS)) {
      const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-pp-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => { window.__MEP_TEST_HOOKS__ = true; });
      page.on('dialog', d => d.accept());
      await page.goto(`http://127.0.0.1:${port}/ConceptCAD.html`);
      await page.waitForFunction(() => typeof occtReady !== 'undefined' && occtReady === true, null, { timeout: 120000 });
      await page.evaluate(() => { window.__d = doc; });
      const f = path.join(EX, nom + '.conceptcad');
      await page.setInputFiles('#fileProj', f);
      await page.waitForFunction(() => doc && doc !== window.__d, null, { timeout: 60000 });
      await attendre(2500);
      await page.evaluate(async () => {
        mepSetActive(true);
        doc.mep.cur = 0;
        window.mepThemeApply();
        const g = document.getElementById('mepGSheet');
        for (let i = 0, avant = -1, stable = 0; i < 120 && stable < 4; i++) {
          await new Promise(r => setTimeout(r, 500));
          window.mepThemeApply();
          const n = g.querySelectorAll('*').length;
          stable = n === avant ? stable + 1 : 0;
          avant = n;
        }
      });
      await page.evaluate(AIDE);
      const g = new Scene(page);
      const bilan = await jouer(g);
      await attendre(600);
      await page.evaluate(() => { try { window.mepThemeApply(); } catch (e) { /* rien */ } });
      await attendre(300);
      const nav = await page.evaluate(() => JSON.parse(JSON.stringify(doc.mep)));
      await ctx.close();
      const base = path.join(dossier, nom + '-' + scen);
      fs.writeFileSync(base + '-etapes.json', JSON.stringify(g.etapes));
      fs.writeFileSync(base + '-nav.json', JSON.stringify(nav));
      const sortie = base + '-natif.conceptcad';
      const r = spawnSync(EXE, ['--essai-esquisse', f, '-2', sortie, base + '-etapes.json', dossier], { timeout: 280000 });
      if (r.status !== 0 || !fs.existsSync(sortie)) { faux++; console.log(`ÉCART   ${nom} ${scen} : code ${r.status}`); continue; }
      const out = [];
      if (g.perdus.length) out.push('navigateur, introuvable : ' + g.perdus.join(', '));
      const bilanNatif = JSON.parse(fs.readFileSync(path.join(dossier, 'bilan.json'), 'utf8'));
      const absents = g.etapes.map((e, i) => (e.reglagePlan && bilanNatif[i] && bilanNatif[i].trouve === false ? JSON.stringify(e.reglagePlan) : null)).filter(Boolean);
      if (absents.length) out.push('natif, introuvable : ' + absents.join(', '));
      ecart(resume(nav), resume(lire(sortie).mep), 'plan', out);
      if (out.length) {
        faux++;
        console.log(`ÉCART   ${nom} ${scen} (${bilan}) :`);
        out.forEach(l => console.log('   ' + l));
      } else {
        justes++;
        console.log(`juste   ${nom} ${scen} (${bilan})`);
      }
    }
  }
  sv.kill();
  console.log(`${justes} justes, ${faux} écarts`);
  process.exit(faux ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
