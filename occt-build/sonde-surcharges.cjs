// Sonde : nombre d'arguments de chaque surcharge suffixée (_1, _2…) des classes utilisées par src/,
// dans un noyau donné. Sert à construire la table de correspondance ancien → nouveau noyau.
//   node occt-build/sonde-surcharges.cjs <colle.js> <noyau.wasm> <sortie.json>
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const [,,js,wasm,outFile]=process.argv;
const ROOT=path.join(__dirname,'..');
let src=fs.readFileSync(js,'utf8');
src=src.replace(/export default (\w+);\s*$/,'globalThis.opencascadeFactory=$1;');
if(!/opencascadeFactory/.test(src))src+='\n;globalThis.opencascadeFactory=opencascade;';
globalThis.__dirname=path.dirname(path.resolve(js)); // la colle 1.x en a besoin
try{vm.runInThisContext(src,{filename:'occt.js'});}catch(e){console.error(String(e).slice(0,300));process.exit(1);}
const appSrc=fs.readdirSync(path.join(ROOT,'src')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8')).join('\n');
// noms suffixés appelés par l'application (constructeurs, statiques, méthodes)
const toks=new Set([...appSrc.matchAll(/\.([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*?)_(\d+)\b/g)].map(m=>m[1]));
// noms non suffixés appelés (méthodes OCCT : majuscule initiale) et classes construites sans suffixe
const appels=new Set([...appSrc.matchAll(/\.([A-Z][A-Za-z0-9]*)\(/g)].map(m=>m[1]));
const nues=new Set([...appSrc.matchAll(/new (?:occt|oc|O|M)\.([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z][A-Za-z0-9]*)+)\(/g)].map(m=>m[1]));
const arity=(f,self)=>{
  try{f.call(self);return 0;}catch(e){
    const m=/expected \((\d+)\) parameters|expected (\d+) args/.exec(String(e&&e.message||e));
    if(m)return +(m[1]||m[2]);
    return 'x:'+String(e&&e.message||e).slice(0,60);
  }
};
(async()=>{
  const oc=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(wasm)});
  const out={ctors:{},statics:{},methods:{},ctorsNus:{},methodesNues:{},statiquesNues:{}};
  for(const k of Object.keys(oc)){
    const base=k.replace(/_\d+$/,'');
    const v=oc[k];
    if(typeof v!=='function')continue;
    // constructeurs surchargés : classes X_N
    if(/_\d+$/.test(k)&&toks.has(base)&&v.prototype){
      try{new v();out.ctors[k]=0;}catch(e){const m=/expected \((\d+)\)/.exec(String(e.message));out.ctors[k]=m?+m[1]:'x';}
    }
    if(nues.has(k)&&v.prototype){
      try{new v();out.ctorsNus[k]=0;}catch(e){const m=/expected \((\d+)\)/.exec(String(e.message));out.ctorsNus[k]=m?+m[1]:'x';}
    }
    // méthodes non suffixées appelées par l'app
    if(v.prototype&&!/_\d+$/.test(k))for(const s of Object.getOwnPropertyNames(v.prototype)){
      if(!appels.has(s))continue;
      let f;try{f=v.prototype[s];}catch(e){continue;}
      if(typeof f==='function')out.methodesNues[k+'.'+s]=arity(f,{});
    }
    for(const s of Object.getOwnPropertyNames(v))
      if(appels.has(s)&&typeof v[s]==='function'&&!/^(prototype|length|name)$/.test(s))out.statiquesNues[k+'.'+s]=arity(v[s],undefined);
    // statiques et méthodes suffixées dont le nom de base est appelé par l'app
    for(const s of Object.getOwnPropertyNames(v)){
      const b=s.replace(/_\d+$/,'');
      if(/_\d+$/.test(s)&&toks.has(b)&&typeof v[s]==='function')out.statics[k+'.'+s]=arity(v[s],undefined);
    }
    if(v.prototype&&!/_\d+$/.test(k))for(const s of Object.getOwnPropertyNames(v.prototype)){
      const b=s.replace(/_\d+$/,'');
      if(/_\d+$/.test(s)&&toks.has(b)){
        let f;try{f=v.prototype[s];}catch(e){continue;}
        if(typeof f==='function')out.methods[k+'.'+s]=arity(f,{});
      }
    }
  }
  fs.writeFileSync(outFile,JSON.stringify(out,null,1));
  console.log(outFile,Object.keys(out.ctors).length,'ctors',Object.keys(out.statics).length,'statiques',Object.keys(out.methods).length,'méthodes');
  process.exit(0);
})();
