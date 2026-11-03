// Aiguillage de moteur OCCT pour les tests : OCCT_DIR=<dossier> fait lire aux tests un autre
// noyau que occt/ SANS toucher à occt/. Chargé par `node -r tests/occt-moteur.cjs` (ou via
// NODE_OPTIONS, que tools/ci-moteur.cjs pose pour toute la suite).
// Le dossier contient une colle .js et un .wasm (noms libres : opencascade.full.js,
// mon_build.js…). Les tests lisent occt/opencascade.full.js puis occt/opencascade.wasm.wasm :
// on redirige ces deux lectures. Une colle compilée en module ES (`export default Module;`,
// opencascade.js 2.x) est ramenée au format attendu (globalThis.opencascadeFactory).
'use strict';
const fs=require('fs'),path=require('path');
const DIR=process.env.OCCT_DIR;
if(DIR){
  const dir=path.resolve(DIR);
  const files=fs.readdirSync(dir);
  const pick=(ext)=>{
    const l=files.filter(f=>f.endsWith(ext)&&!f.endsWith('.d.ts')&&!f.endsWith('.worker.js'));
    const pref=l.find(f=>/full|occt|conceptcad/i.test(f));
    return path.join(dir,pref||l[0]);
  };
  const jsFile=pick('.js'),wasmFile=pick('.wasm');
  const ROOT_OCCT=path.resolve(__dirname,'..','occt');
  const orig=fs.readFileSync;
  let glue=null;
  const compatFile=path.join(dir,'compat-v1.json');
  const compat=fs.existsSync(compatFile)?JSON.parse(orig.call(fs,compatFile,'utf8')):null;
  if(compat){
    const {appliquer}=require(path.join(__dirname,'..','occt-build','compat-v1.cjs'));
    globalThis.__occtCompatWrap=f=>async(o)=>appliquer(await f(o),compat);
  }
  function adaptGlue(src){
    // module ES → script : la fabrique devient globalThis.opencascadeFactory
    if(/export default (\w+);\s*$/.test(src))
      src=src.replace(/export default (\w+);\s*$/,'try{globalThis.opencascadeFactory=$1;}catch(e){}\n');
    if(!/opencascadeFactory/.test(src))src+='\n;try{globalThis.opencascadeFactory=opencascade;}catch(e){}\n';
    // noyau plus récent qu'OCCT 7.4 : couche de compatibilité des appels 1.1.1 (occt-build/compat-v1.cjs)
    if(compat)src+='\n;globalThis.opencascadeFactory=globalThis.__occtCompatWrap(globalThis.opencascadeFactory);\n';
    // import.meta n'existe pas dans un script : la colle ne s'en sert que pour situer le .wasm
    return src.replace(/import\.meta\.url/g,'("file://"+__filename)');
  }
  fs.readFileSync=function(p,...rest){
    try{
      if(typeof p==='string'||p instanceof URL){
        const abs=path.resolve(String(p instanceof URL?p.pathname:p));
        if(path.dirname(abs).toLowerCase()===ROOT_OCCT.toLowerCase()){
          const b=path.basename(abs);
          if(b==='opencascade.full.js'){
            if(glue===null)glue=adaptGlue(orig.call(fs,jsFile,'utf8'));
            return rest.length&&rest[0]?glue:Buffer.from(glue,'utf8');
          }
          if(b==='opencascade.wasm.wasm')return orig.call(fs,wasmFile,...rest);
        }
      }
    }catch(e){}
    return orig.call(fs,p,...rest);
  };
  if(!process.env.OCCT_MOTEUR_SILENCE){
    process.env.OCCT_MOTEUR_SILENCE='1';
    console.log(`[moteur] OCCT_DIR=${dir} → ${path.basename(jsFile)} + ${path.basename(wasmFile)}`);
  }
}
