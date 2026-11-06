// Lance la CI (ou la suite complète) avec un AUTRE noyau OCCT que occt/v3, sans toucher à occt/.
//   node tools/ci-moteur.cjs <dossier du moteur>            → npm run ci
//   node tools/ci-moteur.cjs <dossier du moteur> --complet  → npm run ci:full
//   node tools/ci-moteur.cjs <dossier> -- tests/test_x.cjs   → un seul test
// Le dossier contient la colle .js, le .wasm et compat-v3.json (occt-build/out/v3/).
// Voir tests/noyau.cjs pour le chargement, occt-build/README.md pour fabriquer un moteur.
'use strict';
const {spawnSync}=require('child_process'),path=require('path'),fs=require('fs');
const argv=process.argv.slice(2);
const dir=argv[0];
if(!dir||!fs.existsSync(dir)){console.error('usage : node tools/ci-moteur.cjs <dossier du moteur> [--complet | -- tests/test_x.cjs]');process.exit(2);}
const env={...process.env,OCCT_DIR:path.resolve(dir)};
const iSep=argv.indexOf('--');
const t0=Date.now();
const r=iSep>=0
  ?spawnSync(process.execPath,argv.slice(iSep+1),{stdio:'inherit',env})
  :spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',argv.includes('--complet')?'ci:full':'ci'],{stdio:'inherit',env,shell:process.platform==='win32'});
console.log(`[moteur] ${path.resolve(dir)} — ${((Date.now()-t0)/1000).toFixed(0)} s, code ${r.status}`);
process.exit(r.status==null?1:r.status);
