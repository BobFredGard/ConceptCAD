// Noyau des tests : OCCT 8 (occt/v3) et son traducteur des appels, comme l'application.
//   const real=await require('./noyau.cjs').charger();
// OCCT_DIR=<dossier> essaie un autre noyau fabriqué par occt-build/ (voir tools/ci-moteur.cjs) :
// colle .js, .wasm et table compat-v3.json dans ce dossier.
// charger({colle:src=>…}) : retouche le texte de la colle avant de l'évaluer (test_fuite_noyau).
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),url=require('url'),os=require('os');
const ROOT=path.join(__dirname,'..');
const DIR=path.resolve(process.env.OCCT_DIR||path.join(ROOT,'occt','v3'));
function fichier(ext){
  const l=fs.readdirSync(DIR).filter(f=>f.endsWith(ext)&&!f.endsWith('.d.ts')&&!f.endsWith('.worker.js'));
  if(!l.length)throw new Error('noyau : aucun '+ext+' dans '+DIR);
  return path.join(DIR,l.find(f=>/conceptcad/i.test(f))||l[0]);
}
const JS=fichier('.js'),WASM=fichier('.wasm');
let fabrique=null;
function evaluer(retouche){
  // La colle est un module ES d'Emscripten 6, évaluée ici comme un script : la fabrique devient
  // globale, import.meta et import("node:module") n'existant pas dans un script.
  let src=fs.readFileSync(JS,'utf8');
  if(retouche)src=retouche(src);
  if(/em-pthread/.test(src))return evaluerMultifil(src);
  src=src.replace(/export default (\w+);\s*$/,'globalThis.opencascadeFactory=$1;\n')
    .replace(/import\.meta\.url/g,'globalThis.__occtGlueUrl')
    .replace(/await import\("node:module"\)/g,'globalThis.__occtRequire("node:module")');
  globalThis.__occtRequire=require;
  globalThis.__occtGlueUrl=url.pathToFileURL(JS).href;
  vm.runInThisContext(src,{filename:'occt.js'});
  const {appliquer}=require(path.join(ROOT,'occt-build','compat-v3.cjs'));
  const table=JSON.parse(fs.readFileSync(path.join(DIR,'compat-v3.json'),'utf8'));
  const f=globalThis.opencascadeFactory;
  return async o=>appliquer(await f(o),table);
}
function evaluerMultifil(src){
  // Noyau multicœur (occt/mt) : sa colle doit rester un vrai module, ses fils se relancent depuis ce fichier.
  // OCCT_FILS=<n> met les booléens en parallèle, comme ?mt=<n> dans la page.
  const mjs=path.join(DIR,'conceptcad_mt_'+process.pid+'.mjs'); // à côté du .wasm, que les fils relisent
  fs.writeFileSync(mjs,src);
  process.on('exit',()=>{try{fs.unlinkSync(mjs);}catch(e){}});
  const {appliquer}=require(path.join(ROOT,'occt-build','compat-v3.cjs'));
  const table=JSON.parse(fs.readFileSync(path.join(DIR,'compat-v3.json'),'utf8'));
  // Les fils en attente ne doivent pas empêcher le test de se terminer
  const wt=require('worker_threads'),fils0=[],W0=wt.Worker;
  wt.Worker=class extends W0{constructor(...a){super(...a);fils0.push(this);}};
  return async o=>{
    const oc=appliquer(await (await import(url.pathToFileURL(mjs).href)).default(o),table);
    fils0.forEach(w=>w.unref());
    const fils=+process.env.OCCT_FILS||0;
    if(fils){oc.OSD_ThreadPool.DefaultPool(fils).SetNbDefaultThreadsToLaunch(fils);oc.BOPAlgo_Options.SetParallelMode(true);}
    return oc;
  };
}
async function charger(opts){
  const {colle,...o}=opts||{};
  if(!fabrique)fabrique=evaluer(colle);
  return fabrique({wasmBinary:fs.readFileSync(WASM),...o});
}
// Pour les tests du vrai code du worker (worker_threads) : occtFileUrl de la page pointée sur les vrais
// fichiers du noyau. Node ne prend la colle pour un module ES qu'avec l'extension .mjs : copie temporaire.
function brancherFichiers(sandbox,ctx){
  const f=path.join(os.tmpdir(),'conceptcad_v3_'+process.pid+'.mjs');
  fs.copyFileSync(JS,f);
  process.on('exit',()=>{try{fs.unlinkSync(f);}catch(e){}});
  sandbox.__racine=url.pathToFileURL(ROOT+path.sep).href;
  sandbox.__colle=url.pathToFileURL(f).href;
  vm.runInContext("occtFileUrl=p=>/\\.js$/.test(p)?__colle:__racine+p;",ctx);
}
module.exports={charger,brancherFichiers,DIR,JS,WASM};
