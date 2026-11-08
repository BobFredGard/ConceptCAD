// Fabrique natif/src/conceptcad.ico, l'icône de la version native : le logo de la barre de ConceptCAD
// (carré arrondi de 15 unités, cadre de 2, rayon 4, trait central de 2), moitié gauche en dégradé bleu
// comme l'application habituelle, moitié droite orange pour la reconnaître (choix de Fred, 08/11/2026).
//   node natif/outils/icone.cjs
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SORTIE = path.join(__dirname, '..', 'src', 'conceptcad.ico');
const TAILLES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const TRAIT = '#f5f5f7', ORANGE = '#ff8a00';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15">
<defs><linearGradient id="g" x1="0.33" y1="0" x2="0.67" y2="1">
<stop offset="0" stop-color="#3aa0ff"/><stop offset="0.45" stop-color="#0a84ff"/><stop offset="1" stop-color="#5e5ce6"/></linearGradient>
<clipPath id="c"><rect x="2" y="2" width="11" height="11" rx="2"/></clipPath></defs>
<rect width="15" height="15" rx="4" fill="${TRAIT}"/>
<g clip-path="url(#c)"><rect width="15" height="15" fill="${ORANGE}"/><rect width="7.5" height="15" fill="url(#g)"/></g>
<rect x="6.5" width="2" height="15" fill="${TRAIT}"/></svg>`;

// Format classique des petites icônes (lu par tous les outils de Windows) ; 256 px reste en PNG
function bmp(px, t) {
  const masque = Math.ceil(t / 32) * 4 * t, o = Buffer.alloc(40 + t * t * 4 + masque);
  o.writeUInt32LE(40, 0); o.writeInt32LE(t, 4); o.writeInt32LE(t * 2, 8); o.writeUInt16LE(1, 12); o.writeUInt16LE(32, 14);
  o.writeUInt32LE(t * t * 4 + masque, 20);
  for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) {
    const s = (y * t + x) * 4, d = 40 + ((t - 1 - y) * t + x) * 4;
    o[d] = px[s + 2]; o[d + 1] = px[s + 1]; o[d + 2] = px[s]; o[d + 3] = px[s + 3];
  }
  return o;
}

(async () => {
  const nav = await chromium.launch({ executablePath: CHROME, headless: true });
  const images = [];
  try {
    for (const t of TAILLES) {
      const page = await nav.newPage({ viewport: { width: t, height: t } });
      await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${t}px;height:${t}px}</style>${SVG}`);
      const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t, height: t } });
      if (t === 256) images.push(png);
      else {
        const px = await page.evaluate(async b64 => {
          const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
          const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
          const g = c.getContext('2d'); g.drawImage(im, 0, 0);
          return Array.from(g.getImageData(0, 0, im.width, im.height).data);
        }, png.toString('base64'));
        images.push(bmp(px, t));
      }
      await page.close();
    }
  } finally { await nav.close(); }
  const tete = Buffer.alloc(6 + 16 * TAILLES.length);
  tete.writeUInt16LE(1, 2); tete.writeUInt16LE(TAILLES.length, 4);
  let pos = tete.length;
  TAILLES.forEach((t, i) => {
    const e = 6 + 16 * i;
    tete[e] = t % 256; tete[e + 1] = t % 256;
    tete.writeUInt16LE(1, e + 4); tete.writeUInt16LE(32, e + 6);
    tete.writeUInt32LE(images[i].length, e + 8); tete.writeUInt32LE(pos, e + 12);
    pos += images[i].length;
  });
  fs.writeFileSync(SORTIE, Buffer.concat([tete, ...images]));
  console.log(`${SORTIE} : ${TAILLES.join(', ')} px, ${pos} octets`);
})();
