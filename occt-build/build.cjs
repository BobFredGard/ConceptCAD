// Fabrique un noyau OCCT (WebAssembly) pour ConceptCAD dans Docker, SANS toucher à occt/.
//   node occt-build/build.cjs v3   → occt-build/out/v3/  (libcascade 3.1, OCCT 8.0.1, API sans suffixes)
//   node occt-build/build.cjs mt   → occt-build/out/mt/  (le même, avec fils : noyau multicœur)
// Puis : node tools/ci-moteur.cjs occt-build/out/v3
// Prérequis : Docker Desktop lancé. Détails : occt-build/README.md.
'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');

const HERE=__dirname;
const VARIANTES={
  // Fork maintenu (taucad, « libcascade ») : OCCT 8.0.1, Emscripten 6, exceptions WebAssembly natives.
  v3:{
    image:'ghcr.io/taucad/opencascade.js@sha256:d7bf97ada840afb0f0e0f6bba04b1b55dd0d276e1679a3e40c1431a2cf44900b', // single-threaded, 3.1.0
    args:(yml)=>['--config','single-threaded','link','/src/'+yml],
  },
  // Même recette avec fils. La réserve de fils (8) est OCCT_MT_FILS_MAX de src/96 : garder les deux égaux.
  mt:{
    image:'ghcr.io/taucad/opencascade.js:3.1.0-multi-threaded',
    args:(yml)=>['--config','multi-threaded','link','/src/'+yml],
    flags:['-pthread','-sSHARED_MEMORY=1','-sPTHREAD_POOL_SIZE=Math.min(navigator.hardwareConcurrency||4,8)','-sENVIRONMENT=web,worker,node'],
  },
};

function sh(cmd,args,opts={}){
  console.log('> '+cmd+' '+args.join(' '));
  const r=spawnSync(cmd,args,{stdio:opts.capture?['ignore','pipe','inherit']:'inherit',encoding:'utf8',maxBuffer:1<<28});
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error(cmd+' : code '+r.status);
  return r.stdout;
}

function rendre(work,v){
  let yml=fs.readFileSync(path.join(HERE,'recettes',`conceptcad-v3.yml`),'utf8');
  fs.copyFileSync(path.join(HERE,'extras','conceptcad_extras.cpp'),path.join(work,'conceptcad_extras.cpp'));
  // Liste complète des classes du noyau publié (full.yml de l'image).
  const full=sh('docker',['run','--rm','--entrypoint','cat',VARIANTES[v].image,'/opencascade.js/build-configs/full.yml'],{capture:true});
  const syms=[...full.matchAll(/^\s*- symbol: (\S+)\s*$/gm)].map(m=>m[1]);
  if(syms.length<1000)throw new Error('full.yml illisible ('+syms.length+' classes)');
  yml=yml.replace('  # @BINDINGS@',syms.map(s=>'  - symbol: '+s).join('\n'));
  if(VARIANTES[v].flags)yml=yml.replace('    - -O3',['    - -O3',...VARIANTES[v].flags.map(f=>'    - '+f)].join('\n'));
  fs.writeFileSync(path.join(work,'conceptcad.yml'),yml);
}

function main(){
  const v=process.argv[2];
  if(!VARIANTES[v]){console.error('usage : node occt-build/build.cjs v3|mt');process.exit(2);}
  const work=path.join(HERE,'work',v),out=path.join(HERE,'out',v);
  fs.mkdirSync(work,{recursive:true});fs.mkdirSync(out,{recursive:true});
  sh('docker',['pull',VARIANTES[v].image]);
  rendre(work,v);
  const t0=Date.now();
  sh('docker',['run','--rm','-v',work+':/src','-w','/src',VARIANTES[v].image,...VARIANTES[v].args('conceptcad.yml')]);
  const min=((Date.now()-t0)/60000).toFixed(1);
  // Le résultat (conceptcad.js/.wasm/.d.ts) atterrit à côté de la recette : on le range dans out/.
  // libcascade suffixe parfois le nom par la variante (conceptcad_single.js…).
  for(const f of fs.readdirSync(work))
    if(/^conceptcad.*\.(js|wasm|d\.ts|json|symbols)$/.test(f))fs.renameSync(path.join(work,f),path.join(out,f));
  // la colle sort parfois sans extension (nom de build sans « .js ») : on la renomme
  for(const f of fs.readdirSync(out))if(/^conceptcad[\w-]*$/.test(f))fs.renameSync(path.join(out,f),path.join(out,f+'.js'));
  // table compat-v3.json : signatures OCCT 8 des appels 1.1.1 écrits dans src/ et tests/. La liste de ces
  // appels (sonde-1.1.1.json) a été relevée une fois pour toutes sur opencascade.js 1.1.1 : voir le README.
  sh(process.execPath,[path.join(HERE,'compat-v3.cjs'),path.join(out,'conceptcad_v3.d.ts'),path.join(HERE,'sonde-1.1.1.json'),path.join(out,'compat-v3.json')]);
  const wasm=fs.readdirSync(out).filter(f=>f.endsWith('.wasm')).map(f=>`${f} ${(fs.statSync(path.join(out,f)).size/1e6).toFixed(1)} Mo`);
  const img=sh('docker',['image','inspect','--format','{{index .RepoDigests 0}}',VARIANTES[v].image],{capture:true}).trim();
  fs.writeFileSync(path.join(out,'PROVENANCE.txt'),
    `image : ${img}\nrecette : occt-build/recettes/conceptcad-v3.yml + extras/conceptcad_extras.cpp\n`+
    `date : ${new Date().toISOString()}\ndurée : ${min} min\n${wasm.join('\n')}\n`);
  console.log(`\nmoteur ${v} prêt en ${min} min → ${out}\n${wasm.join('\n')}\nessai : node tools/ci-moteur.cjs ${path.relative(process.cwd(),out)}`);
}
try{main();}catch(e){console.error('ÉCHEC : '+e.message);process.exit(1);}
