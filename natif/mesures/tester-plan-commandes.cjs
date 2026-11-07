// La mise en plan, le ruban : planches et nouvelles vues, les mêmes clics dans le navigateur et dans le programme natif, puis le plan comparé.
// node mesures/tester-plan-commandes.cjs <dossier> --racine=D:/ConceptCAD [--pieces=A,B] [--scenarios=a,b]
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
const FILTRE = opt('scenarios', '');
const attendre = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(dossier, { recursive: true, force: true });
fs.mkdirSync(dossier, { recursive: true });

const lire = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = z.gunzipSync(b); const j = JSON.parse(b.toString('utf8')); return j.doc || j; };
function ecart(a, b, ch, out) {
  if (out.length > 14) return;
  const creux = x => x === undefined || x === null || x === false || x === '' || (Array.isArray(x) && !x.length);
  if (creux(a) && creux(b)) return;
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 0.02) out.push(`${ch} : ${a} / ${b}`); return; }
  if (creux(a) || creux(b) || typeof a !== 'object' || typeof b !== 'object') { if (a !== b) out.push(`${ch} : ${JSON.stringify(a)} / ${JSON.stringify(b)}`.slice(0, 200)); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) ecart(a[k], b[k], ch + '.' + k, out);
}
// Les identifiants portent l'heure : on les remplace par le rang
let AVEC_AXES = false;
function resume(mep) {
  const sans = o => { if (Array.isArray(o)) return o.map(sans); if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) if (k[0] !== '_') r[k] = sans(o[k]); return r; } return o; };
  const m = sans(mep);
  for (const s of m.sheets) {
    delete s.id;
    const ids = {};
    (s.views || []).forEach((v, i) => { ids[v.id] = 'v#' + i; });
    const rang = x => (ids[x] !== undefined ? ids[x] : x);
    for (const v of s.views || []) {
      v.id = rang(v.id);
      v.parent = rang(v.parent);
      if (v.section) v.section.pid = rang(v.section.pid);
      if (v.auxEdge) v.auxEdge.pid = rang(v.auxEdge.pid);
      if (!AVEC_AXES) { delete v.axes; delete v.axExt; }
      else {
        // Les identifiants d'axes et les clés d'allongement portent l'heure
        const nom = {};
        (v.axes || []).forEach((a, i) => { nom[a.id] = 'ax' + i; delete a.id; (a.refs || []).forEach(r => { r.vid = rang(r.vid); }); if (a.ref) a.ref.vid = rang(a.ref.vid); });
        if (v.axExt) { const e = {}; for (const k of Object.keys(v.axExt)) { const m = /^m(.+)\.(\d+)$/.exec(k); e[m ? 'm' + nom[m[1]] + '.' + m[2] : k] = v.axExt[k]; } v.axExt = e; }
      }
    }
    // La forme de l'entité que la page mémorise quand elle en a le temps
    for (const d of s.dims || []) for (const c of ['a', 'b', 'c']) if (d[c] && d[c].hint) { delete d[c].hint.s; if (d[c].hint.t === 'ctr') delete d[c].hint.i; }
    const cotes = {};
    const lienSk = sk => { if (sk && sk.pts) Object.values(sk.pts).forEach(q => { if (q.lk && q.lk.vid) q.lk.vid = rang(q.lk.vid); }); };
    lienSk(s.sk);
    (s.views || []).forEach(v => { (v.locals || []).forEach(l => { delete l.id; }); });
    (s.dims || []).forEach((d, i) => { d.vid = rang(d.vid); if (d.vid2) d.vid2 = rang(d.vid2); delete d.id; cotes[i] = d; });
    s.dims = cotes;
  }
  return { cur: m.cur, sheets: m.sheets };
}
const AIDE = () => {
  const svg = () => document.getElementById('mepGSheet').ownerSVGElement;
  window.__px = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(svg().getScreenCTM()); return [Math.round(q.x), Math.round(q.y)]; };
  window.__mm = (px, py) => { const q = new DOMPoint(px, py).matrixTransform(svg().getScreenCTM().inverse()); return [q.x, q.y]; };
  // La vue la plus grande, sa boîte sur la feuille et ses arêtes droites
  window.__vue = (id) => {
    const sh = doc.mep.sheets[doc.mep.cur || 0];
    const mesurer = v => {
      const g = __mepTest.geo(v);
      if (!g || !g.els) return null;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const pts = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
      const L = [], C = [];
      for (const e of g.els) {
        if (e.t === 'L') { pts(e.x1, e.y1); pts(e.x2, e.y2); L.push([e.x1, e.y1, e.x2, e.y2]); }
        else if (e.cx !== undefined) {
          pts(e.cx - e.r, e.cy - e.r); pts(e.cx + e.r, e.cy + e.r);
          const a = e.t === 'A' ? (e.a0 + e.a1) / 2 : 0.7;
          C.push([v.x + e.cx * v.scale, v.y + e.cy * v.scale, e.r * v.scale, v.x + (e.cx + e.r * Math.cos(a)) * v.scale, v.y + (e.cy + e.r * Math.sin(a)) * v.scale, e.t]);
        }
      }
      if (x0 > x1) return null;
      const s = v.scale;
      const f = document.getElementById('mepGSheet').ownerSVGElement.viewBox.baseVal;
      return { sx: v.x + (x0 + x1) / 2 * s < f.x + f.width / 2 ? 1 : -1, sy: v.y + (y0 + y1) / 2 * s < f.y + f.height / 2 ? 1 : -1, id: v.id, kind: v.kind, x: v.x + (x0 + x1) / 2 * s, y: v.y + (y0 + y1) / 2 * s, w: (x1 - x0) * s, h: (y1 - y0) * s, cercles: C, lignes: L.map(l => [v.x + l[0] * s, v.y + l[1] * s, v.x + l[2] * s, v.y + l[3] * s]) };
    };
    if (id) return mesurer(sh.views.find(v => v.id === id));
    let m = null;
    for (const v of sh.views) { if (v.kind === 'detail' || v.kind === 'section') continue; const q = mesurer(v); if (q && (!m || q.w * q.h > m.w * m.h)) m = q; }
    return m;
  };
  // La vue orthogonale où il y a le plus de cercles, pour les outils de cotes
  window.__ortho = () => {
    const sh = doc.mep.sheets[doc.mep.cur || 0];
    let m = null;
    for (const v of sh.views) {
      if (v.camera || v.persp || v.obl || v.kind === 'detail' || v.kind === 'section') continue;
      const q = window.__vue(v.id);
      if (q && (!m || q.cercles.length > m.cercles.length)) m = q;
    }
    return m || window.__vue();
  };
};

class Essai {
  constructor(page) { this.page = page; this.etapes = [{ atelier: 'plan' }]; }
  async mm(px, py) { return this.page.evaluate(([a, b]) => window.__mm(a, b), [px, py]); }
  async px(x, y) { return this.page.evaluate(([a, b]) => window.__px(a, b), [x, y]); }
  // Un clic en mm : les deux côtés reçoivent exactement le même point
  async clic(x, y) {
    const p = await this.px(x, y);
    const q = await this.mm(p[0], p[1]); // avant le clic : il peut décaler la feuille d'un rien
    await this.page.mouse.move(p[0], p[1]);
    await this.page.mouse.down();
    await this.page.mouse.up();
    this.etapes.push({ plan: { presse: q } }, { plan: { lache: 1 } });
    await attendre(40);
  }
  async bouton(nom, js) {
    await this.page.evaluate(js);
    this.etapes.push({ plan: { bouton: nom } });
    await attendre(/^(Cote|Perçage|Note|Ordonnées|Trou|Cercle|Alignement|Libre|Symétrie|Ligne|Rectangle|Arc|Point|Ajuster|Texte|Cartouche|Logo)/.test(nom) ? 150 : 6000); // la page refait ses vues exactes en revenant dans l'atelier
  }
  // L'accrochage imposé : le menu du clic droit, avec le même choix des deux côtés
  async accrochage(m, lab) {
    await this.page.evaluate(x => window.__mepTest.setSnapMode(x), m);
    this.etapes.push({ plan: { menu: lab } });
    await attendre(40);
  }
  async menu(x, y, lab) {
    const p = await this.px(x, y);
    const q = await this.mm(p[0], p[1]);
    await this.page.mouse.click(p[0], p[1], { button: 'right' });
    await attendre(100);
    await this.page.evaluate(l => { const b = [...document.querySelectorAll('#mepCtx button')].find(e => e.textContent.trim().replace(/^✓\s*/, '') === l); if (!b) throw new Error('menu sans ' + l); b.click(); }, lab);
    this.etapes.push({ plan: { survol: q } }, { plan: { menu: lab, x: q[0], y: q[1] } });
    await attendre(100);
  }
  // Maj + clic
  async clicMaj(x, y) {
    const p = await this.px(x, y);
    const q = await this.mm(p[0], p[1]);
    await this.page.keyboard.down('Shift');
    await this.page.mouse.move(p[0], p[1]);
    await this.page.mouse.down();
    await this.page.mouse.up();
    await this.page.keyboard.up('Shift');
    this.etapes.push({ plan: { presse: q, maj: true } }, { plan: { lache: 1 } });
    await attendre(40);
  }
  async glisser(x0, y0, x1, y1) {
    const p = await this.px(x0, y0), q = await this.mm(p[0], p[1]);
    const p2 = await this.px(x1, y1), q2 = await this.mm(p2[0], p2[1]);
    await this.page.mouse.move(p[0], p[1]);
    await this.page.mouse.down();
    await this.page.mouse.move((p[0] + p2[0]) / 2, (p[1] + p2[1]) / 2);
    await this.page.mouse.move(p2[0], p2[1]);
    await this.page.mouse.up();
    this.etapes.push({ plan: { presse: q } }, { plan: { glisse: [(q[0] + q2[0]) / 2, (q[1] + q2[1]) / 2] } }, { plan: { glisse: q2 } }, { plan: { lache: 1 } });
    await attendre(60);
  }
  // Un bouton du panneau de droite
  async panneau(lab) {
    const ok = await this.page.evaluate(l => { const t = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === l), b = t.find(x => x.offsetParent) || t.find(x => x.closest('#mepSide')); if (b) b.click(); return !!b; }, lab);
    if (!ok) throw new Error('bouton absent : ' + lab + ' parmi ' + (await this.page.evaluate(() => [...document.querySelectorAll('#mepSide button')].filter(x => x.offsetParent).map(x => x.textContent.trim()).join(' | '))));
    this.etapes.push({ reglagePlan: { bouton: lab } });
    await attendre(120);
  }
  // Ctrl + glisser (dx = dy = 0 : Ctrl + clic)
  async glisserCtrl(x0, y0, x1, y1) {
    const p = await this.px(x0, y0), q = await this.mm(p[0], p[1]);
    const p2 = await this.px(x1, y1), q2 = await this.mm(p2[0], p2[1]);
    await this.page.mouse.move(p[0], p[1]);
    await this.page.keyboard.down('Control');
    await this.page.mouse.down();
    this.etapes.push({ plan: { presse: q, ctrl: true } });
    if (x0 !== x1 || y0 !== y1) {
      await this.page.mouse.move((p[0] + p2[0]) / 2, (p[1] + p2[1]) / 2);
      await this.page.mouse.move(p2[0], p2[1]);
      this.etapes.push({ plan: { glisse: [(q[0] + q2[0]) / 2, (q[1] + q2[1]) / 2] } }, { plan: { glisse: q2 } });
    }
    await this.page.mouse.up();
    await this.page.keyboard.up('Control');
    this.etapes.push({ plan: { lache: 1 } });
    await attendre(60);
  }
  // Une contrainte du panneau, sur ce qui est choisi
  async contrainte(id, lab) {
    await this.page.evaluate(i => { const T = window.__mepTest.sk, sh = doc.mep.sheets[doc.mep.cur || 0]; T.apply(sh, i, T.sel()); }, id);
    this.etapes.push({ reglagePlan: { bouton: lab } });
    await attendre(40);
  }
  async touche(k, nom) {
    await this.page.keyboard.press(k);
    this.etapes.push({ plan: { touche: nom } });
    await attendre(40);
  }
}

const neuve = async g => {
  await g.bouton('Nouvelle', () => window.mepAddSheet());
  await g.bouton('Projection', () => window.mepBeginProjCmd());
  await g.touche('Escape', 'Echap');
  await attendre(6000);
  return g.page.evaluate(() => window.__ortho());
};
const plusLongue = v => v.lignes.slice().sort((a, b) => Math.hypot(b[2] - b[0], b[3] - b[1]) - Math.hypot(a[2] - a[0], a[3] - a[1]))[0];
// Vers le bord de la feuille le plus libre
const normale = (l, v) => { const L = Math.hypot(l[2] - l[0], l[3] - l[1]), n = [-(l[3] - l[1]) / L, (l[2] - l[0]) / L]; return (n[0] * v.sx + n[1] * v.sy < 0) ? [-n[0], -n[1]] : n; };

// Un point libre, hors de la vue, en face du milieu du trait
const dehors = (l, v, n, marge) => { const mx = (l[0] + l[2]) / 2, my = (l[1] + l[3]) / 2, s = (v.x - mx) * n[0] + (v.y - my) * n[1], D = s + Math.abs(n[0]) * v.w / 2 + Math.abs(n[1]) * v.h / 2 + marge; return [mx + n[0] * D, my + n[1] * D]; };

const vide = async g => { await g.bouton('Nouvelle', () => window.mepAddSheet()); };
const outil = (g, nom, t) => g.bouton(nom, new Function('window.mepSetTool(' + JSON.stringify(t) + ')'));
const ligne = async (g, ...pts) => { await outil(g, 'Ligne', 'line'); for (const p of pts) await g.clic(p[0], p[1]); await g.touche('Escape', 'Echap'); await g.touche('Escape', 'Echap'); };

// Où cliquer une valeur d'ordonnée ; le milieu de la ligne d'une cote
const posOrd = (g, k) => g.page.evaluate(i => {
  const sh = doc.mep.sheets[doc.mep.cur || 0], d = sh.dims.find(x => x.kind === 'ord'), v = sh.views.find(x => x.id === d.vid);
  const S = q => [v.x + q.x * v.scale, v.y + q.y * v.scale], o = S(d.o), p = S(i < 0 ? d.o : d.pts[i]);
  return d.axis === 'y' ? [o[0] + (+d.off || 0), p[1]] : [p[0], o[1] + (+d.off || 0)];
}, k);
const milieuCote = (g, k) => g.page.evaluate(i => {
  const sh = doc.mep.sheets[doc.mep.cur || 0], d = sh.dims[i], v = sh.views.find(x => x.id === d.vid);
  const a = [v.x + d.a.x * v.scale, v.y + d.a.y * v.scale], b = [v.x + d.b.x * v.scale, v.y + d.b.y * v.scale], off = +d.off || 0;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], o = d.orient || 'a';
  if (o === 'h') return [m[0] + 3, m[1] + off];
  if (o === 'v') return [m[0] + off, m[1] + 3];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  return [m[0] + n[0] * off + (b[0] - a[0]) / L * 3, m[1] + n[1] * off + (b[1] - a[1]) / L * 3];
}, k);
const groupeOrd = async g => {
  const v = await neuve(g), l = plusLongue(v);
  await g.bouton('Ordonnées X', () => window.mepSetTool('ordx'));
  await g.clic(l[0], l[1]);
  await g.clic(l[2], l[3]);
  await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
  await g.touche('Enter', 'Entree');
  return v;
};

// Une coupe locale : 4 points autour du milieu de la vue, plan sur l'arête la plus longue
const coupeLocale = async g => {
  const v = await neuve(g), l = plusLongue(v);
  const w = Math.min(v.w, 60) / 4, h = Math.min(v.h, 60) / 4;
  await g.bouton('Coupe locale', () => window.mepBeginLocalCmd());
  await g.clic(v.x - w, v.y - h);
  await g.clic(v.x + w, v.y - h);
  await g.clic(v.x + w, v.y + h);
  await g.clic(v.x - w, v.y + h);
  await g.touche('Enter', 'Entree');
  await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
  await attendre(1500);
  return v;
};
const pointLocal = (g, i) => g.page.evaluate(k => { const sh = doc.mep.sheets[doc.mep.cur || 0], v = sh.views.find(x => x.locals), q = v.locals[0].pts[k]; return [v.x + q[0] * v.scale, v.y + q[1] * v.scale]; }, i);

const SCENARIOS = {
  async localeCreer(g) { await coupeLocale(g); return 'coupe locale'; },
  async localeTirer(g) {
    await coupeLocale(g);
    const p = await pointLocal(g, 1);
    await g.glisser(p[0], p[1], p[0] + 6, p[1] - 4);
    await attendre(1500);
    return 'tirer un point';
  },
  async localeRetirerPoint(g) {
    await coupeLocale(g);
    const p = await pointLocal(g, 1);
    await g.clicMaj(p[0], p[1]);
    await attendre(1500);
    return 'retirer un point';
  },
  async localeSupprimer(g) {
    await coupeLocale(g);
    await g.touche('Delete', 'Suppr');
    return 'supprimer la coupe';
  },
  async ordSupprimerPoint(g) {
    await groupeOrd(g);
    const p = await posOrd(g, 0);
    await g.clic(p[0], p[1]);
    await g.touche('Delete', 'Suppr');
    return 'supprimer une valeur';
  },
  async ordCassure(g) {
    await groupeOrd(g);
    const p = await posOrd(g, 1);
    await g.glisserCtrl(p[0], p[1], p[0] + 9, p[1]);
    return 'cassure';
  },
  async ordCassureRetiree(g) {
    await groupeOrd(g);
    const p = await posOrd(g, 1);
    await g.glisserCtrl(p[0], p[1], p[0] + 9, p[1]);
    const q = await posOrd(g, 1);
    await g.glisserCtrl(p[0] + 9, q[1], p[0] + 9, q[1]);
    return 'cassure retirée';
  },
  async ordPlusPoints(g) {
    const v = await groupeOrd(g), l = plusLongue(v);
    const p = await posOrd(g, -1);
    await g.clic(p[0], p[1]);
    await g.panneau('+ Points');
    await g.clic(l[0] + (l[2] - l[0]) / 4, l[1] + (l[3] - l[1]) / 4);
    await g.touche('Escape', 'Echap');
    return 'ajouter des points';
  },
  async coteAligner(g) {
    const v = await neuve(g);
    const l = plusLongue(v), m = v.lignes.filter(q => q !== l && Math.abs((q[2] - q[0]) * (l[3] - l[1]) - (q[3] - q[1]) * (l[2] - l[0])) < 1e-6 && Math.hypot(q[2] - q[0], q[3] - q[1]) > 5 && Math.hypot((q[0] + q[2] - l[0] - l[2]) / 2, (q[1] + q[3] - l[1] - l[3]) / 2) > 5)[0];
    if (!m) return null;
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
    await g.clic(v.x + v.sx * (v.w / 2 + 14), v.y + v.sy * (v.h / 2 + 14));
    await g.clic((m[0] + m[2]) / 2, (m[1] + m[3]) / 2);
    await g.clic(v.x + v.sx * (v.w / 2 + 28), v.y + v.sy * (v.h / 2 + 28));
    await g.touche('Escape', 'Echap');
    await g.touche('Escape', 'Echap');
    const a = await milieuCote(g, 0), b = await milieuCote(g, 1);
    await g.clic(b[0], b[1]);
    await g.clicMaj(a[0], a[1]);
    await g.panneau('Aligner sur une cote…');
    await g.clic(a[0], a[1]);
    return 'aligner une cote sur une autre';
  },
  async bullesAuto(g) {
    await g.clic(3, 3);
    await g.panneau('Bulles automatiques');
    await attendre(800);
    return 'bulles automatiques';
  },
  async bulleAjout(g) {
    const v = await g.page.evaluate(() => { const sh = doc.mep.sheets[doc.mep.cur || 0], w = sh.views.find(x => x.asm), bb = __mepTest.bbox ? __mepTest.bbox(w) : null; return { x: w.x, y: w.y }; });
    await g.clic(3, 3);
    await g.panneau('＋ Bulle');
    await g.clic(v.x, v.y);
    await g.touche('Escape', 'Echap');
    return 'une bulle à la main';
  },
  async skLigne(g) { await vide(g); await ligne(g, [80, 60], [160, 60], [160, 110], [90, 130]); return 'ligne enchaînée'; },
  async skRectangle(g) { await vide(g); await outil(g, 'Rectangle', 'rect'); await g.clic(80, 60); await g.clic(170, 120); await g.touche('Escape', 'Echap'); return 'rectangle'; },
  async skCercle(g) { await vide(g); await outil(g, 'Cercle', 'circle'); await g.clic(120, 90); await g.clic(150, 100); await g.touche('Escape', 'Echap'); return 'cercle'; },
  async skArc(g) { await vide(g); await outil(g, 'Arc', 'arc'); await g.clic(120, 90); await g.clic(150, 90); await g.clic(120, 60); await g.touche('Escape', 'Echap'); return 'arc'; },
  async skPoint(g) { await vide(g); await outil(g, 'Point', 'point'); await g.clic(120, 90); await g.clic(150, 70); await g.touche('Escape', 'Echap'); return 'points'; },
  async skTexte(g) { await vide(g); await outil(g, 'Texte', 'text'); await g.clic(120, 90); await g.touche('Escape', 'Echap'); await g.touche('Escape', 'Echap'); return 'texte'; },
  async skAccroche(g) {
    await vide(g);
    await ligne(g, [80, 60], [180, 60]);
    await outil(g, 'Ligne', 'line');
    await g.clic(130, 60); // sur le milieu
    await g.clic(130, 120);
    await g.clic(180, 60); // sur l'extrémité
    await g.touche('Escape', 'Echap');
    await g.touche('Escape', 'Echap');
    return 'milieu, extrémité';
  },
  async skAjuster(g) {
    await vide(g);
    await ligne(g, [80, 90], [200, 90]);
    await ligne(g, [120, 50], [120, 130]);
    await ligne(g, [160, 50], [160, 130]);
    await outil(g, 'Ajuster', 'trim');
    await g.clic(140, 90);
    await g.touche('Escape', 'Echap');
    return 'ajuster un tronçon';
  },
  async skParallele(g) {
    await vide(g);
    await ligne(g, [80, 60], [170, 70]);
    await ligne(g, [80, 110], [170, 130]);
    await g.clic(125, 65);
    await g.clicMaj(125, 120);
    await g.contrainte('parallel', 'Parallèle');
    return 'parallèle';
  },
  async skCote(g) {
    await vide(g);
    await ligne(g, [80, 60], [170, 60]);
    await g.clic(125, 60);
    await g.contrainte('dist', 'Distance');
    await g.page.evaluate(() => { const T = window.__mepTest.sk, sh = doc.mep.sheets[doc.mep.cur || 0], c = sh.sk.cons.find(q => q.type === 'dist'); T.setVal(sh, c, 40); });
    g.etapes.push({ reglagePlan: { champ: 'Distance (mm)', valeur: '40' } });
    await attendre(60);
    return 'cote pilotante à 40';
  },
  async skGlisser(g) {
    await vide(g);
    await ligne(g, [80, 60], [170, 60], [170, 120]);
    await g.clic(170, 60);
    await g.touche('Escape', 'Echap');
    await g.clic(125, 60); // le trait se choisit
    await g.glisser(125, 60, 125, 80);
    return 'glisser sous contraintes';
  },
  async skSupprimer(g) {
    await vide(g);
    await ligne(g, [80, 60], [170, 60], [170, 120]);
    await g.clic(125, 60);
    await g.touche('Delete', 'Suppr');
    return 'supprimer un trait';
  },
  async skCadre(g) {
    await vide(g);
    await ligne(g, [80, 60], [120, 60]);
    await ligne(g, [80, 100], [170, 100]);
    await g.glisser(60, 40, 140, 80);
    await g.touche('Delete', 'Suppr');
    return 'cadre, puis supprimer';
  },
  async skVue(g) {
    const v = await neuve(g);
    const l = plusLongue(v);
    await ligne(g, [l[0], l[1]], [v.x + v.sx * (v.w / 2 + 25), v.y + v.sy * (v.h / 2 + 18)]);
    return 'accroché à une vue';
  },
  async skCartouche(g) {
    await vide(g);
    await g.bouton('Cartouche', () => window.__mepTest.sk.tbEdit(true));
    await attendre(100);
    return 'cartouche dessiné';
  },
  async skCartoucheLigne(g) {
    await vide(g);
    await g.bouton('Cartouche', () => window.__mepTest.sk.tbEdit(true));
    await outil(g, 'Ligne', 'line');
    const q = await g.page.evaluate(() => { const c = window.__mepTest.sk.ctx(doc.mep.sheets[doc.mep.cur || 0]); return [c.ox, c.oy]; });
    await g.clic(q[0] - 40, q[1] - 60);
    await g.clic(q[0] - 10, q[1] - 60);
    await g.touche('Escape', 'Echap');
    await g.touche('Escape', 'Echap');
    await g.touche('Escape', 'Echap');
    return 'une ligne dans le cartouche';
  },
  async standard(g) {
    await g.bouton('Face', () => window.mepAddViewStd('front'));
    await g.bouton('ISO', () => window.mepAddViewStd('iso'));
    return 'Face, ISO';
  },
  async projection(g) {
    const v = await g.page.evaluate(() => window.__vue());
    await g.bouton('Projection', () => window.mepBeginProjCmd());
    await g.clic(v.x, v.y);
    await g.clic(v.x + v.sx * (v.w / 2 + 30), v.y);
    await g.clic(v.x, v.y + v.sy * (v.h / 2 + 30));
    await g.clic(v.x + v.sx * (v.w / 2 + 25), v.y + v.sy * (v.h / 2 + 25));
    await g.touche('Escape', 'Echap');
    return 'droite, dessous, diagonale';
  },
  async coupe(g) {
    const v = await g.page.evaluate(() => window.__vue());
    await g.bouton('Coupe', () => window.mepBeginSectionCmd());
    await g.clic(v.x - v.w / 2 - 3, v.y + 0.37);
    await g.clic(v.x + v.w / 2 + 3, v.y + 0.37);
    await g.touche('Enter', 'Entree');
    await g.clic(v.x + 3, v.y + v.sy * (v.h / 2 + 35));
    return 'coupe simple';
  },
  async coupeBrisee(g) {
    const v = await g.page.evaluate(() => window.__vue());
    await g.bouton('Coupe', () => window.mepBeginSectionCmd());
    const y0 = v.y - v.h * 0.13, y1 = v.y + v.h * 0.17, x1 = v.x - v.w * 0.07;
    await g.clic(v.x - v.w / 2 - 3, y0);
    await g.clic(x1, y0);
    await g.clic(x1 + 0.2, y1);
    await g.clic(x1 + 1, y1 + 2); // refusé ou à l'équerre, puis on l'enlève
    await g.touche('Backspace', 'Retour');
    await g.clic(v.x + v.w / 2 + 3, y1);
    await g.touche('Enter', 'Entree');
    await g.clic(v.x - 2, v.y + v.sy * (v.h / 2 + 32));
    return 'coupe brisée';
  },
  async detail(g) {
    const v = await g.page.evaluate(() => window.__vue());
    await g.bouton('Détail', () => window.mepBeginDetailCmd());
    await g.clic(v.x + v.w * 0.2, v.y - v.h * 0.1);
    await g.clic(v.x + v.w * 0.2 + 8, v.y - v.h * 0.1 + 3);
    await g.clic(v.x + v.sx * (v.w / 2 + 30), v.y - v.sy * (v.h / 2 - 5));
    return 'détail';
  },
  async auxiliaire(g) {
    const v = await g.page.evaluate(() => window.__vue());
    const l = v.lignes.slice().sort((a, b) => Math.hypot(b[2] - b[0], b[3] - b[1]) - Math.hypot(a[2] - a[0], a[3] - a[1]))[0];
    await g.bouton('Auxiliaire', () => window.mepBeginAuxCmd());
    await g.clic(l[0] * 0.63 + l[2] * 0.37, l[1] * 0.63 + l[3] * 0.37);
    await g.clic(v.x + v.sx * (v.w / 2 + 28), v.y + v.sy * (v.h / 2 + 28));
    return 'auxiliaire';
  },
  async rejeter(g) {
    const v = await g.page.evaluate(() => window.__ortho());
    await g.clic(v.x, v.y);
    await g.page.evaluate(id => window.mepReprojectView(id), v.id);
    g.etapes.push({ reglagePlan: { bouton: 'Rejeter' } });
    await attendre(6000);
    return 'rejeter la vue';
  },
  async orientation(g) {
    const v = await g.page.evaluate(() => window.__ortho());
    await g.clic(v.x, v.y);
    await g.page.evaluate(id => window.mepSetViewOrient(id, 'right'), v.id);
    g.etapes.push({ reglagePlan: { champ: 'Orientation', valeur: 'Côté droit' } });
    await attendre(6000);
    return 'orientation côté droit';
  },
  async coteLongueur(g) {
    const v = await neuve(g);
    const l = plusLongue(v), n = normale(l, v);
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    const mx = (l[0] + l[2]) / 2, my = (l[1] + l[3]) / 2;
    await g.clic(mx, my);
    await g.clic(v.x + v.sx * (v.w / 2 + 14), v.y + v.sy * (v.h / 2 + 14));
    return 'longueur';
  },
  async coteDeuxTraits(g) {
    const v = await neuve(g);
    const l = plusLongue(v);
    const u = [l[2] - l[0], l[3] - l[1]], L = Math.hypot(u[0], u[1]);
    const autre = v.lignes.find(q => { const w = [q[2] - q[0], q[3] - q[1]], K = Math.hypot(w[0], w[1]); return K > 2 && Math.abs(u[0] * w[1] - u[1] * w[0]) / (L * K) < 1e-5 && Math.abs((q[0] - l[0]) * u[1] - (q[1] - l[1]) * u[0]) / L > 2; });
    if (!autre) return null;
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
    await g.clic((autre[0] + autre[2]) / 2, (autre[1] + autre[3]) / 2);
    await g.clic(v.x + v.sx * (v.w / 2 + 12), v.y + v.sy * (v.h / 2 + 12));
    return 'distance de 2 traits';
  },
  async coteAngle(g) {
    const v = await neuve(g);
    const l = plusLongue(v);
    const u = [l[2] - l[0], l[3] - l[1]], L = Math.hypot(u[0], u[1]);
    const autre = v.lignes.find(q => { const w = [q[2] - q[0], q[3] - q[1]], K = Math.hypot(w[0], w[1]); return K > 2 && Math.abs(u[0] * w[1] - u[1] * w[0]) / (L * K) > 0.1; });
    if (!autre) return null;
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
    await g.clic((autre[0] + autre[2]) / 2, (autre[1] + autre[3]) / 2);
    await g.clic(v.x + v.sx * (v.w / 2 + 10), v.y + v.sy * (v.h / 2 + 10));
    return 'angle';
  },
  async coteCercle(g) {
    const v = await neuve(g);
    const c = v.cercles.slice().sort((a, b) => b[2] - a[2])[0];
    if (!c) return null;
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.clic(c[3], c[4]);
    await g.clic(v.x + v.sx * (v.w / 2 + 12), v.y + v.sy * (v.h / 2 + 9));
    return 'Ø ou R';
  },
  async cotePoints(g) {
    const v = await neuve(g);
    const l = plusLongue(v), n = normale(l, v);
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    const hx = v.x + v.sx * (v.w / 2 + 4), hy = v.y + v.sy * (v.h / 2 + 4);
    await g.clic(hx, hy);
    await g.clic(l[0], l[1]);
    await g.clic(hx + n[0] * 9 + 3, hy + n[1] * 9 + 2);
    return 'point à point';
  },
  async chaine(g) {
    const v = await neuve(g);
    const l = plusLongue(v), n = normale(l, v);
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    const mx = (l[0] + l[2]) / 2, my = (l[1] + l[3]) / 2;
    await g.clic(mx, my);
    const P = dehors(l, v, n, 16);
    await g.clic(P[0], P[1]);
    await g.touche('Escape', 'Echap');
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    const D = (P[0] - mx) * n[0] + (P[1] - my) * n[1];
    await g.clic(l[2] + n[0] * D * 0.6, l[3] + n[1] * D * 0.6);
    const c = v.cercles[0] || [l[0], l[1]];
    await g.clic(c[0], c[1]);
    await g.touche('Escape', 'Echap');
    return 'chaîne';
  },
  async percage(g) {
    const v = await neuve(g);
    const c = v.cercles.slice().sort((a, b) => a[2] - b[2])[0];
    if (!c) return null;
    await g.bouton('Perçage', () => window.mepSetTool('hole'));
    await g.clic(c[3], c[4]);
    await g.clic(c[0] + v.sx * (c[2] + 15), c[1] + v.sy * (c[2] + 11));
    return 'perçage';
  },
  async percagesAuto(g) {
    await neuve(g);
    await g.bouton('Perçages auto', () => window.__mepTest.autoHoles());
    return 'perçages automatiques';
  },
  async note(g) {
    const v = await neuve(g);
    const l = plusLongue(v), n = normale(l, v);
    await g.bouton('Note', () => window.mepSetTool('note'));
    await g.clic(l[0], l[1]);
    await g.clic(l[0] + n[0] * 17, l[1] + n[1] * 17);
    return 'note';
  },
  async ordonnees(g) {
    const v = await neuve(g);
    const l = plusLongue(v);
    await g.bouton('Ordonnées X', () => window.mepSetTool('ordx'));
    await g.clic(l[0], l[1]);
    await g.clic(l[2], l[3]);
    await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
    await g.touche('Enter', 'Entree');
    await g.bouton('Ordonnées Y', () => window.mepSetTool('ordy'));
    await g.clic(l[0], l[1]);
    await g.clic(l[2], l[3]);
    await g.touche('Escape', 'Echap');
    return 'ordonnées X et Y';
  },
  async snapBouts(g) {
    const v = await neuve(g);
    const l = plusLongue(v), n = normale(l, v);
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.accrochage('end', 'Extrémité');
    await g.clic(l[0] + 1, l[1] + 1);
    await g.clic(l[2] - 1, l[3] - 1);
    await g.clic((l[0] + l[2]) / 2 + n[0] * 15, (l[1] + l[3]) / 2 + n[1] * 15);
    return 'extrémités';
  },
  async snapMilieu(g) {
    const v = await neuve(g);
    const L = v.lignes.slice().sort((a, b) => Math.hypot(b[2] - b[0], b[3] - b[1]) - Math.hypot(a[2] - a[0], a[3] - a[1]));
    const m = q => [(q[0] + q[2]) / 2, (q[1] + q[3]) / 2];
    const a = m(L[0]);
    const b = L.map(m).find(q => Math.hypot(q[0] - a[0], q[1] - a[1]) > 5);
    if (!b) return null;
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.accrochage('mid', 'Milieu');
    await g.clic(a[0] + 1, a[1]);
    await g.clic(b[0], b[1] + 1);
    await g.clic(v.x + v.sx * (v.w / 2 + 14), v.y + v.sy * (v.h / 2 + 14));
    return 'milieux';
  },
  async snapCentre(g) {
    const v = await neuve(g);
    const c = v.cercles[0];
    if (!c) return null;
    const l = plusLongue(v);
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.accrochage('ctr', 'Centre');
    await g.clic(c[0] + 0.5, c[1]);
    await g.accrochage('end', 'Extrémité');
    await g.clic(l[0], l[1]);
    await g.clic(v.x + v.sx * (v.w / 2 + 11), v.y + v.sy * (v.h / 2 + 11));
    return 'centre puis extrémité';
  },
  async snapExtreme(g) {
    const v = await neuve(g);
    const c = v.cercles.slice().sort((a, b) => b[2] - a[2])[0];
    if (!c) return null;
    const l = plusLongue(v);
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.accrochage('maxx', 'Point extrême suivant X');
    await g.clic(c[3], c[4]);
    await g.accrochage('maxy', 'Point extrême suivant Y');
    await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
    await g.clic(v.x + v.sx * (v.w / 2 + 11), v.y + v.sy * (v.h / 2 + 11));
    return 'extrêmes X et Y';
  },
  async snapIntersection(g) {
    const v = await neuve(g);
    const l = plusLongue(v);
    const u = [l[2] - l[0], l[3] - l[1]], Lu = Math.hypot(u[0], u[1]);
    const autres = v.lignes.filter(q => { const w = [q[2] - q[0], q[3] - q[1]], K = Math.hypot(w[0], w[1]); return K > 2 && Math.abs(u[0] * w[1] - u[1] * w[0]) / (Lu * K) > 0.1; });
    if (autres.length < 2) return null;
    const m = q => [(q[0] + q[2]) / 2, (q[1] + q[3]) / 2];
    const a = autres[0], b = autres[autres.length - 1];
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.accrochage('int', 'Intersection (même prolongée)');
    await g.clic(m(l)[0], m(l)[1]);
    await g.clic(m(a)[0], m(a)[1]);
    await g.clic(m(l)[0], m(l)[1]);
    await g.clic(m(b)[0], m(b)[1]);
    await g.clic(v.x + v.sx * (v.w / 2 + 13), v.y + v.sy * (v.h / 2 + 13));
    return 'intersections';
  },
  async droiteCentre(g) {
    const v = await neuve(g);
    const c = v.cercles[0];
    if (!c) return null;
    const l = plusLongue(v);
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
    await g.accrochage('ctr', 'Centre');
    await g.clic(c[0], c[1]);
    await g.clic(v.x + v.sx * (v.w / 2 + 9), v.y + v.sy * (v.h / 2 + 9));
    return 'droite vers centre';
  },
  async menuBrouillon(g) {
    const v = await neuve(g);
    const c = v.cercles.slice().sort((a, b) => b[2] - a[2])[0];
    if (c) {
      await g.bouton('Cote', () => window.mepSetTool('dim'));
      await g.clic(c[3], c[4]);
      await g.menu(v.x + v.sx * (v.w / 2 + 9), v.y + v.sy * (v.h / 2 + 7), 'Rayon (R)');
      await g.clic(v.x + v.sx * (v.w / 2 + 9), v.y + v.sy * (v.h / 2 + 7));
      await g.touche('Escape', 'Echap');
    }
    const v2 = await neuve(g);
    const l = plusLongue(v2), n = normale(l, v2);
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
    const P = dehors(l, v2, n, 12);
    await g.menu(P[0], P[1], 'Alignée (A)');
    await g.clic(P[0], P[1]);
    return 'R et alignée en cours de pose';
  },
  async menuCote(g) {
    const v = await neuve(g);
    const l = plusLongue(v), n = normale(l, v);
    const [mx, my] = dehors(l, v, n, 16);
    await g.bouton('Cote', () => window.mepSetTool('dim'));
    await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
    await g.clic(mx, my);
    await g.touche('Escape', 'Echap');
    await g.menu(mx, my, Math.abs(n[0]) > 0.5 ? 'Horizontale (X)' : 'Verticale (Y)');
    return 'orientation d’une cote posée';
  },
  async axeTrou(g) {
    const v = await neuve(g);
    const c = v.cercles[0];
    if (!c) return null;
    await g.bouton('Trou', () => window.__mepTest.setAxisMode('hole'));
    await g.clic(c[3], c[4]);
    return 'axe sur un cercle';
  },
  async axeRevolution(g) {
    const v = await neuve(g);
    const l = plusLongue(v);
    await g.bouton('Trou', () => window.__mepTest.setAxisMode('hole'));
    await g.clic((l[0] + l[2]) / 2, (l[1] + l[3]) / 2);
    return 'axe sur un contour';
  },
  async axeAlignement(g) {
    const v = await neuve(g);
    if (v.cercles.length < 2) return null;
    await g.bouton('Alignement', () => window.__mepTest.setAxisMode('align'));
    await g.clic(v.cercles[0][3], v.cercles[0][4]);
    await g.clic(v.cercles[1][3], v.cercles[1][4]);
    await g.touche('Enter', 'Entree');
    return 'alignement';
  },
  async axeCercle(g) {
    const v = await neuve(g);
    if (v.cercles.length < 3) return null;
    await g.bouton('Cercle axes', () => window.__mepTest.setAxisMode('pitch'));
    for (const c of v.cercles.slice(0, 3)) await g.clic(c[3], c[4]);
    await g.touche('Enter', 'Entree');
    return 'cercle de perçage';
  },
  async axeLibre(g) {
    const v = await neuve(g);
    await g.bouton('Libre', () => window.__mepTest.setAxisMode('free'));
    await g.clic(v.x - v.w * 0.3, v.y - v.h * 0.2);
    await g.clic(v.x + v.w * 0.31, v.y + v.h * 0.27);
    return 'axe libre';
  },
  async axeSymetrie(g) {
    const v = await neuve(g);
    const l = plusLongue(v);
    const m = q => [(q[0] + q[2]) / 2, (q[1] + q[3]) / 2];
    const u = [l[2] - l[0], l[3] - l[1]], L = Math.hypot(u[0], u[1]);
    const autre = v.lignes.find(q => { const w = [q[2] - q[0], q[3] - q[1]], K = Math.hypot(w[0], w[1]); return K > 2 && Math.abs(u[0] * w[1] - u[1] * w[0]) / (L * K) < 1e-5 && Math.abs((q[0] - l[0]) * u[1] - (q[1] - l[1]) * u[0]) / L > 2; });
    if (!autre) return null;
    await g.bouton('Symétrie', () => window.__mepTest.setAxisMode('sym'));
    await g.clic(m(l)[0], m(l)[1]);
    await g.clic(m(autre)[0], m(autre)[1]);
    return 'symétrie';
  },
  async axeTirer(g) {
    const v = await neuve(g);
    const c = v.cercles[0];
    if (!c) return null;
    await g.bouton('Trou', () => window.__mepTest.setAxisMode('hole'));
    await g.clic(c[3], c[4]);
    await g.touche('Escape', 'Echap');
    const j = await g.page.evaluate(id => { const sh = doc.mep.sheets[doc.mep.cur || 0], w = sh.views.find(x => x.id === id), a = window.__mepTest.axisLines(w).find(p => p.ann && p.t === 'L'); return a ? [w.x + a.x2 * w.scale, w.y + a.y2 * w.scale, a.x2 - a.x1, a.y2 - a.y1] : null; }, v.id);
    if (!j) return null;
    const L = Math.hypot(j[2], j[3]);
    const p = await g.px(j[0], j[1]), q = await g.mm(p[0], p[1]);
    const p2 = await g.px(j[0] + j[2] / L * 9, j[1] + j[3] / L * 9), q2 = await g.mm(p2[0], p2[1]);
    await g.page.mouse.move(p[0], p[1]); await g.page.mouse.down(); await g.page.mouse.move((p[0] + p2[0]) / 2, (p[1] + p2[1]) / 2); await g.page.mouse.move(p2[0], p2[1]); await g.page.mouse.up();
    g.etapes.push({ plan: { presse: q } }, { plan: { glisse: [(q[0] + q2[0]) / 2, (q[1] + q2[1]) / 2] } }, { plan: { glisse: q2 } }, { plan: { lache: 1 } });
    await attendre(100);
    return 'tirer un bout d’axe';
  },
  async axeSupprimer(g) {
    const v = await neuve(g);
    const c = v.cercles[0];
    if (!c) return null;
    await g.bouton('Trou', () => window.__mepTest.setAxisMode('hole'));
    await g.clic(c[3], c[4]);
    await g.touche('Escape', 'Echap');
    const j = await g.page.evaluate(id => { const sh = doc.mep.sheets[doc.mep.cur || 0], w = sh.views.find(x => x.id === id), a = window.__mepTest.axisLines(w).find(p => p.ann && p.t === 'L'); return a ? [w.x + (a.x1 + a.x2) / 2 * w.scale, w.y + (a.y1 + a.y2) / 2 * w.scale] : null; }, v.id);
    if (!j) return null;
    await g.clic(j[0], j[1]);
    await g.touche('Delete', 'Suppr');
    return 'supprimer un axe';
  },
  async planches(g) {
    await g.bouton('Nouvelle', () => window.mepAddSheet());
    await g.bouton('Projection', () => window.mepBeginProjCmd());
    await g.touche('Escape', 'Echap');
    await g.bouton('ISO', () => window.mepAddViewStd('iso'));
    await g.bouton('Dupliquer', () => { const t = [...document.querySelectorAll('button')].find(b => /dupliquer/i.test(b.title || '') && /planche/i.test(b.title || '')); if (!t) throw new Error('bouton Dupliquer introuvable'); t.click(); });
    return 'nouvelle, vue, dupliquée';
  },
};

(async () => {
  const port = 5200 + (process.pid % 400);
  const sv = spawn(process.execPath, [path.join(RACINE, 'tests', 'browser', 'serveur.cjs'), String(port)], { stdio: 'ignore' });
  await attendre(800);
  let justes = 0, faux = 0;
  for (const nom of PIECES) {
    for (const [scen, jouer] of Object.entries(SCENARIOS)) {
      if (FILTRE && !FILTRE.split(',').includes(scen)) continue;
      const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-pc-')), { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 } });
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
      await attendre(7000); // le calcul exact des vues finit après l'affichage
      await page.evaluate(AIDE);
      const g = new Essai(page);
      let bilan;
      try { bilan = await jouer(g); } catch (e) { faux++; console.log(`ÉCART   ${nom} ${scen} : navigateur ${e.message}`); await ctx.close(); continue; }
      if (bilan === null) { console.log(`sans objet ${nom} ${scen}`); await ctx.close(); continue; }
      await attendre(500);
      const nav = await page.evaluate(() => JSON.parse(JSON.stringify(doc.mep)));
      await ctx.close();
      const base = path.join(dossier, nom + '-' + scen);
      fs.writeFileSync(base + '-etapes.json', JSON.stringify(g.etapes));
      fs.writeFileSync(base + '-nav.json', JSON.stringify(nav));
      const sortie = base + '-natif.conceptcad';
      const r = spawnSync(EXE, ['--essai-esquisse', f, '-2', sortie, base + '-etapes.json', dossier], { timeout: 280000 });
      if (r.status !== 0 || !fs.existsSync(sortie)) { faux++; console.log(`ÉCART   ${nom} ${scen} : code ${r.status}`); continue; }
      const out = [];
      AVEC_AXES = scen.startsWith('axe');
      ecart(resume(nav), resume(lire(sortie).mep), 'plan', out);
      if (out.length) {
        faux++;
        console.log(`ÉCART   ${nom} ${scen} (${bilan}) :`);
        out.forEach(l => console.log('   ' + l));
      } else {
        justes++;
        console.log(`juste   ${nom} ${scen} (${bilan}) ${Object.keys(resume(nav).sheets[nav.cur || 0].dims || {}).length} cotes`);
      }
    }
  }
  sv.kill();
  console.log(`${justes} justes, ${faux} écarts`);
  process.exit(faux ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
