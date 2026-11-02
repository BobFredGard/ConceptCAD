// Lance la CI (ou la suite complète) avec un AUTRE noyau OCCT que occt/, sans toucher à occt/.
//   node tools/ci-moteur.cjs <dossier du moteur>            → npm run ci
//   node tools/ci-moteur.cjs <dossier du moteur> --complet  → npm run ci:full
//   node tools/ci-moteur.cjs <dossier> -- tests/test_x.cjs   → un seul test
// Le dossier contient la colle .js et le .wasm (ex. occt-build/out/v2-equivalent/).
// Voir tests/occt-moteur.cjs pour la redirection, occt-build/README.md pour fabriquer un moteur.
'use strict';
const {spawnSync}=require('child_process'),path=require('path'),fs=require('fs');
const argv=process.argv.slice(2);
const dir=argv[0];
if(!dir||!fs.existsSync(dir)){console.error('usage : node tools/ci-moteur.cjs <dossier du moteur> [--complet | -- tests/test_x.cjs]');process.exit(2);}
// barres obliques : NODE_OPTIONS lit les « \ » entre guillemets comme des échappements
const hook=path.join(__dirname,'..','tests','occt-moteur.cjs').split(path.sep).join('/');
const env={...process.env,OCCT_DIR:path.resolve(dir),
  NODE_OPTIONS:((process.env.NODE_OPTIONS||'')+' --require "'+hook+'"').trim()};
const iSep=argv.indexOf('--');
const t0=Date.now();
const r=iSep>=0
  ?spawnSync(process.execPath,argv.slice(iSep+1),{stdio:'inherit',env})
  :spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',argv.includes('--complet')?'ci:full':'ci'],{stdio:'inherit',env,shell:process.platform==='win32'});
console.log(`[moteur] ${path.resolve(dir)} — ${((Date.now()-t0)/1000).toFixed(0)} s, code ${r.status}`);
process.exit(r.status==null?1:r.status);
