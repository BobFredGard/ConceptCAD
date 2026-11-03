// Lecture d'un projet .conceptcad pour les tests : gzip (V0.46.0) ou texte en clair
const fs = require('fs'), zlib = require('zlib');
module.exports = function lireProjet(p) {
  const b = fs.readFileSync(p);
  return (b[0] === 0x1f && b[1] === 0x8b ? zlib.gunzipSync(b) : b).toString('utf8');
};
