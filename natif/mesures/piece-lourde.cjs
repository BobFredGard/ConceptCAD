// Fabrique une pièce d'essai plus lourde, faite uniquement d'extrusions et de découpes (ce que sait le natif) :
// une plaque, puis des poches rondes en quinconce dans une découpe unique.
//   node natif/mesures/piece-lourde.cjs <sortie.conceptcad> <trous par côté>
// Ce n'est pas une pièce de Fred : elle sert seulement à voir si l'écart de mémoire tient quand la pièce grossit.
'use strict';
const fs = require('fs');
const [, , sortie, nS] = process.argv;
const N = +(nS || 14), pas = 12, cote = pas * (N + 1);
const points = (o) => o;
const esquisse1 = {
  id: 'sk_1', name: 'Plaque', plane: 'XY', seq: 10, visible: false, origin: [0, 0, 0], axU: [1, 0, 0], axV: [0, 1, 0], axN: [0, 0, 1],
  points: points({ O: { x: 0, y: 0 }, a: { x: 0, y: 0 }, b: { x: cote, y: 0 }, c: { x: cote, y: cote }, d: { x: 0, y: cote } }),
  entities: [['e1', 'a', 'b'], ['e2', 'b', 'c'], ['e3', 'c', 'd'], ['e4', 'd', 'a']].map(([id, p1, p2]) => ({ id, t: 'line', p1, p2 })),
  constraints: [], dims: [],
};
const pts = { O: { x: 0, y: 0 } }, ents = [];
for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
  const id = 'c' + i + '_' + j;
  pts[id] = { x: i * pas, y: j * pas };
  ents.push({ id: 'e' + id, t: 'circle', pc: id, r: 3 + ((i + j) % 3) });
}
const esquisse2 = {
  id: 'sk_2', name: 'Poches', plane: 'FACE', seq: 10, visible: false, origin: [0, 0, 20], axU: [1, 0, 0], axV: [0, 1, 0], axN: [0, 0, 1],
  host: { feat: 'ex_1', tag: 'TOP', x: 0, y: 0, name: 'Face 1' }, points: pts, entities: ents, constraints: [], dims: [],
};
const doc = {
  app: 'ConceptCAD', v: 'V0.64.3', name: 'Plaque essai', bodies: [{ id: 'b1', name: 'Corps 1', c: [0, 0, 0], open: true }], bodySeq: 1, activeBody: 'b1',
  params: [], sketches: [esquisse1, esquisse2],
  features: [
    { id: 'ex_1', type: 'extrude', name: 'Plaque', sketchId: 'sk_1', distance: 20, op: 'add', visible: true, mid: false, upto: null, body: 'b1' },
    { id: 'ex_2', type: 'extrude', name: 'Poches', sketchId: 'sk_2', distance: -8, op: 'cut', visible: true, mid: false, upto: null, body: 'b1' },
  ],
};
fs.writeFileSync(sortie, JSON.stringify(doc));
console.log('écrit', sortie, N * N, 'poches');
