// V0.43.0 : le noyau OCCT 8 (occt/v3) est celui de l'application. On vérifie que ses fichiers
// sont là et entiers (pas des pointeurs Git LFS), que la copie du traducteur est celle de
// occt-build/compat-v3.cjs (source unique, recopiée par occt-build/installer.cjs) et que la page
// charge bien ces fichiers (OCCT_FILES), et que plus aucun autre noyau n'est livré.
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),V3=path.join(ROOT,'occt','v3');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
console.log('=== Noyau OCCT 8 installé (occt/v3) ===');
const taille=f=>{try{return fs.statSync(path.join(V3,f)).size;}catch(e){return 0;}};
A(taille('conceptcad_v3.wasm')>30e6,'conceptcad_v3.wasm présent ('+(taille('conceptcad_v3.wasm')/1e6).toFixed(1)+' Mo — moins de 1 Ko = pointeur LFS : git lfs pull)');
try{const b=Buffer.alloc(4);const fd=fs.openSync(path.join(V3,'conceptcad_v3.wasm'),'r');fs.readSync(fd,b,0,4,0);fs.closeSync(fd);
  A(b.toString('latin1')==='\0asm','… et c\'est bien du WebAssembly');}catch(e){A(false,'wasm illisible');}
A(taille('conceptcad_v3.js')>10e3,'colle conceptcad_v3.js présente');
const lf=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
A(fs.existsSync(path.join(V3,'compat-v3.cjs'))&&lf(path.join(V3,'compat-v3.cjs'))===lf(path.join(ROOT,'occt-build','compat-v3.cjs')),
  'traducteur occt/v3/compat-v3.cjs = occt-build/compat-v3.cjs (sinon : node occt-build/installer.cjs)');
let table=null;try{table=JSON.parse(fs.readFileSync(path.join(V3,'compat-v3.json'),'utf8'));}catch(e){}
A(table&&table.ctors&&table.methods&&Object.keys(table.methods).length>50,'table compat-v3.json lisible');
// la page : les fichiers v3, sans autre noyau
const src=fs.readFileSync(path.join(ROOT,'src','96-noyau-occt-tiers-lgpl.js'),'utf8');
for(const f of ['occt/v3/conceptcad_v3.js','occt/v3/conceptcad_v3.wasm','occt/v3/compat-v3.cjs','occt/v3/compat-v3.json'])
  A(src.includes("'"+f+"'")&&fs.existsSync(path.join(ROOT,f)),'la page charge '+f);
A(!fs.readdirSync(path.join(ROOT,'occt')).some(f=>/^opencascade.[^.]+(.wasm)?$|.wasm$|.js$/.test(f)),'occt/ ne livre aucun autre noyau que v3');
// publication : Pages copie occt/v3
const pages=fs.readFileSync(path.join(ROOT,'.github','workflows','pages.yml'),'utf8');
A(/occt\/v3/.test(pages),'pages.yml publie occt/v3');
// noyau multicœur : installé, chargé par la page, publié avec son service worker, servi avec les en-têtes
const debut4=f=>{try{const b=Buffer.alloc(4);const fd=fs.openSync(f,'r');fs.readSync(fd,b,0,4,0);fs.closeSync(fd);return b.toString('latin1');}catch(e){return '';}};
A(debut4(path.join(ROOT,'occt','mt','conceptcad_v3.wasm'))==='\0asm','occt/mt/conceptcad_v3.wasm est bien du WebAssembly (sinon pointeur LFS : git lfs pull)');
for(const f of ['occt/mt/conceptcad_v3.js','occt/mt/conceptcad_v3.wasm'])
  A(src.includes("'"+f+"'")&&fs.existsSync(path.join(ROOT,f)),'la page charge '+f);
A(/occt\/mt/.test(pages)&&/isolation-sw\.js/.test(pages)&&fs.existsSync(path.join(ROOT,'isolation-sw.js')),'pages.yml publie occt/mt et isolation-sw.js');
A(/serve\.json/.test(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'))&&/Cross-Origin-Embedder-Policy/.test(fs.readFileSync(path.join(ROOT,'tools','serve.json'),'utf8')),'npm start envoie les en-têtes d’isolation');
A(/OCCT_MT_FILS_MAX=8/.test(src)&&/hardwareConcurrency\|\|4,8\)/.test(fs.readFileSync(path.join(ROOT,'occt-build','build.cjs'),'utf8')),'réserve de fils de la recette = maximum de la page');
A(/if\(window\.__EMB\)return 0/.test(src),'le fichier autonome garde le noyau normal');
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(ko?1:0);
