// Fabrique natif/mac/ConceptCAD.iconset, l'icône de la version native pour Mac : le même dessin que
// natif/outils/icone.cjs (version native Windows, choix de Fred du 08/11/2026) : carré arrondi, moitié gauche
// en dégradé bleu, moitié droite orange, trait central clair. Sur Mac, le dessin est posé avec la marge
// habituelle des icônes d'application (824 sur 1024). Le Mac de GitHub en fait le .icns avec iconutil.
//   node natif/mac/icone.cjs
'use strict';
const fs = require('fs'), path = require('path');
const racine = path.join(__dirname, '..', '..');
let pw;
for (const d of [path.join(racine, 'node_modules', 'playwright-core'), path.join(racine, '..', '..', '..', 'node_modules', 'playwright-core')])
  if (fs.existsSync(d)) { pw = require(d); break; }
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SORTIE = path.join(__dirname, 'ConceptCAD.iconset');
const TRAIT = '#f5f5f7', ORANGE = '#ff8a00';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15">
<defs><linearGradient id="g" x1="0.33" y1="0" x2="0.67" y2="1">
<stop offset="0" stop-color="#3aa0ff"/><stop offset="0.45" stop-color="#0a84ff"/><stop offset="1" stop-color="#5e5ce6"/></linearGradient>
<clipPath id="c"><rect x="2" y="2" width="11" height="11" rx="2"/></clipPath></defs>
<rect width="15" height="15" rx="4" fill="${TRAIT}"/>
<g clip-path="url(#c)"><rect width="15" height="15" fill="${ORANGE}"/><rect width="7.5" height="15" fill="url(#g)"/></g>
<rect x="6.5" width="2" height="15" fill="${TRAIT}"/></svg>`;

(async () => {
  const nav = await pw.chromium.launch({ executablePath: CHROME, headless: true });
  fs.mkdirSync(SORTIE, { recursive: true });
  try {
    for (const t of [16, 32, 128, 256, 512]) for (const k of [1, 2]) {
      const px = t * k, m = Math.round(px * 100 / 1024), d = px - 2 * m;
      const page = await nav.newPage({ viewport: { width: px, height: px } });
      await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{position:absolute;left:${m}px;top:${m}px;width:${d}px;height:${d}px}</style>${SVG}`);
      await page.screenshot({ path: path.join(SORTIE, `icon_${t}x${t}${k === 2 ? '@2x' : ''}.png`), omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } });
      await page.close();
    }
  } finally { await nav.close(); }
  console.log('Pret : ' + SORTIE);
})();
