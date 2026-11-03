// Fabrique un noyau OCCT (WebAssembly) pour ConceptCAD dans Docker, SANS toucher à occt/.
//   node occt-build/build.cjs v2   → occt-build/out/v2/  (opencascade.js 2.0 bêta, OCCT 7.6, même API `_N` que l'actuel)
//   node occt-build/build.cjs v3   → occt-build/out/v3/  (libcascade 3.1, OCCT 8.0.1, API sans suffixes)
//   node occt-build/build.cjs v2 --dry   → écrit seulement la recette rendue (work/<v>/conceptcad.yml)
// Puis : node tools/ci-moteur.cjs occt-build/out/v2
// Prérequis : Docker Desktop lancé. Détails : occt-build/README.md.
'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');

const HERE=__dirname;
const VARIANTES={
  // Image d'origine d'opencascade.js 2.0 (mars 2023) : OCCT et liaisons déjà compilés dedans,
  // une construction personnalisée ne refait que l'édition de liens (quelques minutes).
  v2:{
    image:'donalffons/opencascade.js:2.0.0-beta.b5ff984',
    args:(yml)=>[yml],
  },
  // Fork maintenu (taucad, « libcascade ») : OCCT 8.0.1, Emscripten 6, exceptions WebAssembly natives.
  v3:{
    image:'ghcr.io/taucad/opencascade.js:single-threaded',
    args:(yml)=>['--config','single-threaded','link','/src/'+yml],
  },
};

function sh(cmd,args,opts={}){
  console.log('> '+cmd+' '+args.join(' '));
  const r=spawnSync(cmd,args,{stdio:opts.capture?['ignore','pipe','inherit']:'inherit',encoding:'utf8',maxBuffer:1<<28});
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error(cmd+' : code '+r.status);
  return r.stdout;
}

function rendre(v,work){
  const extras=fs.readFileSync(path.join(HERE,'extras','conceptcad_extras.cpp'),'utf8');
  let yml=fs.readFileSync(path.join(HERE,'recettes',`conceptcad-${v}.yml`),'utf8');
  if(v==='v2'){
    // opencascade.js 2.x ne lit pas de fichier : le C++ est donné en texte dans la recette.
    const bloc=extras.split('\n').map(l=>'    '+l).join('\n');
    yml=yml.replace('    // @EXTRAS@',bloc);
    // Les scripts Python de l'image lisent/écrivent avec l'encodage par défaut : ASCII seul.
    yml=yml.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[«»]/g,'"')
      .replace(/[⇄→≈—’]/g,'-').replace(/…/g,'...');
    if(/[^\x00-\x7f]/.test(yml))throw new Error('caractère non ASCII restant dans la recette v2');
  }else{
    fs.copyFileSync(path.join(HERE,'extras','conceptcad_extras.cpp'),path.join(work,'conceptcad_extras.cpp'));
    // Liste complète des classes du noyau publié (full.yml de l'image), comme le moteur actuel.
    const full=sh('docker',['run','--rm','--entrypoint','cat',VARIANTES.v3.image,'/opencascade.js/build-configs/full.yml'],{capture:true});
    const syms=[...full.matchAll(/^\s*- symbol: (\S+)\s*$/gm)].map(m=>m[1]);
    if(syms.length<1000)throw new Error('full.yml illisible ('+syms.length+' classes)');
    yml=yml.replace('  # @BINDINGS@',syms.map(s=>'  - symbol: '+s).join('\n'));
  }
  fs.writeFileSync(path.join(work,'conceptcad.yml'),yml);
}

function main(){
  const v=process.argv[2];
  if(!VARIANTES[v]){console.error('usage : node occt-build/build.cjs v2|v3 [--dry]');process.exit(2);}
  const work=path.join(HERE,'work',v),out=path.join(HERE,'out',v);
  fs.mkdirSync(work,{recursive:true});fs.mkdirSync(out,{recursive:true});
  if(!process.argv.includes('--dry'))sh('docker',['pull',VARIANTES[v].image]);
  if(v==='v2'||!process.argv.includes('--dry'))rendre(v,work);
  if(process.argv.includes('--dry')){console.log('recette rendue : '+path.join(work,'conceptcad.yml'));return;}
  const t0=Date.now();
  sh('docker',['run','--rm','-v',work+':/src','-w','/src',VARIANTES[v].image,...VARIANTES[v].args('conceptcad.yml')]);
  const min=((Date.now()-t0)/60000).toFixed(1);
  // Le résultat (conceptcad.js/.wasm/.d.ts) atterrit à côté de la recette : on le range dans out/.
  // libcascade suffixe parfois le nom par la variante (conceptcad_single.js…).
  for(const f of fs.readdirSync(work))
    if(/^conceptcad.*\.(js|wasm|d\.ts|json|symbols)$/.test(f))fs.renameSync(path.join(work,f),path.join(out,f));
  // la colle sort parfois sans extension (nom de build sans « .js ») : on la renomme
  for(const f of fs.readdirSync(out))if(/^conceptcad[\w-]*$/.test(f))fs.renameSync(path.join(out,f),path.join(out,f+'.js'));
  if(v==='v2'){
    // table de compatibilité des appels 1.1.1 (suffixes renumérotés, arguments ajoutés) : sondes
    // de l'ancien noyau (occt/) et du nouveau, puis compat-v1.json lu par tests/occt-moteur.cjs
    const ROOT=path.join(HERE,'..'),sA=path.join(work,'sonde-ancien.json'),sB=path.join(work,'sonde-nouveau.json');
    sh(process.execPath,[path.join(HERE,'sonde-surcharges.cjs'),path.join(ROOT,'occt','opencascade.full.js'),path.join(ROOT,'occt','opencascade.wasm.wasm'),sA]);
    sh(process.execPath,[path.join(HERE,'sonde-surcharges.cjs'),path.join(out,'conceptcad.js'),path.join(out,'conceptcad.wasm'),sB]);
    sh(process.execPath,[path.join(HERE,'compat-v1.cjs'),path.join(out,'conceptcad.d.ts'),sA,sB,path.join(out,'compat-v1.json')]);
  }
  const wasm=fs.readdirSync(out).filter(f=>f.endsWith('.wasm')).map(f=>`${f} ${(fs.statSync(path.join(out,f)).size/1e6).toFixed(1)} Mo`);
  const img=sh('docker',['image','inspect','--format','{{index .RepoDigests 0}}',VARIANTES[v].image],{capture:true}).trim();
  fs.writeFileSync(path.join(out,'PROVENANCE.txt'),
    `image : ${img}\nrecette : occt-build/recettes/conceptcad-${v}.yml + extras/conceptcad_extras.cpp\n`+
    `date : ${new Date().toISOString()}\ndurée : ${min} min\n${wasm.join('\n')}\n`);
  console.log(`\nmoteur ${v} prêt en ${min} min → ${out}\n${wasm.join('\n')}\nessai : node tools/ci-moteur.cjs ${path.relative(process.cwd(),out)}`);
}
try{main();}catch(e){console.error('ÉCHEC : '+e.message);process.exit(1);}
