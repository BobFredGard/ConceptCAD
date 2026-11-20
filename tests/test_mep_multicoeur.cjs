// V0.99.50 : vues de la mise en plan sur plusieurs cœurs (src/21-vues-plan-calcul.js, 98-mep-10 mepHlrPrecalcul).
// Demande de Fred : « faire pareil [que la FAO] pour la mise à jour des vues de la mise en plan ».
// Le harnais n'a pas de Worker : on en fournit un, bâti sur worker_threads, qui exécute le VRAI code du
// worker (delWkSource) avec un VRAI noyau. Pour chaque planche d'exemple :
//   1. référence : toutes les vues calculées sur la page (comme avant) ;
//   2. mêmes vues par les workers : un worker par vue (dans la limite des cœurs), écran rendu tout de suite,
//      puis CHAQUE vue identique à la référence, trait pour trait, au nombre près.
//   node tests/test_mep_multicoeur.cjs                   exemples
//   node tests/test_mep_multicoeur.cjs --chemin D:/x.conceptcad   un fichier hors Exemples (pièce d'essai)
const fs=require('fs'),vm=require('vm'),path=require('path');
const {Worker:NodeWorker}=require('worker_threads');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
const argv=process.argv.slice(2);
const iC=argv.indexOf('--chemin');
// [fichier, vues attendues sur les workers] — Cavité Usinage : 9 vues, 1,1 s d'écran figé sur la page ;
// Griffe : 8 petites vues (72 ms) que la page calcule plus vite qu'un worker ne démarre
const FICHIERS=iC>=0?[[argv[iC+1],true]]:[['Cavité Usinage.conceptcad',true],['Griffe.conceptcad',false]].map(f=>[path.join(ROOT,'Exemples',f[0]),f[1]]);
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};

const stats={created:0,jobs:0,terminated:0,actifs:0,maxActifs:0};
const blobs=new Map();
class Blob{constructor(parts){this.text=parts.join('');}}
const URLs={createObjectURL(b){const k='blob:t'+blobs.size;blobs.set(k,b.text);return k;}};
const PRE=`const {parentPort}=require('worker_threads');const fs=require('fs'),path=require('path'),vm=require('vm');
globalThis.require=require;globalThis.self=globalThis;
const lire=u=>fs.readFileSync(require('url').fileURLToPath(String(u)));
self.postMessage=(m,t)=>parentPort.postMessage(m,t);
globalThis.fetch=async u=>({ok:true,text:async()=>lire(u).toString('utf8'),json:async()=>JSON.parse(lire(u).toString('utf8')),
  arrayBuffer:async()=>{const b=lire(u);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
parentPort.on('message',d=>self.onmessage&&self.onmessage({data:d}));
`;
class Worker{
  constructor(url){
    stats.created++;
    this.nw=new NodeWorker(PRE+blobs.get(url),{eval:true,resourceLimits:{maxOldGenerationSizeMb:4096}});
    this.nw.on('message',d=>{if(d&&d.t==='fin'){stats.actifs--;}this.onmessage&&this.onmessage({data:d});});
    this.nw.on('error',e=>this.onerror&&this.onerror({message:String((e&&e.message)||e),preventDefault(){}}));
  }
  postMessage(m,t){if(m&&m.t==='job'){stats.jobs++;stats.actifs++;stats.maxActifs=Math.max(stats.maxActifs,stats.actifs);}this.nw.postMessage(m,t);}
  terminate(){stats.terminated++;this.nw.terminate();}
}

(async()=>{
  const real=await require('./noyau.cjs').charger();
  for(const [fichier,attendu] of FICHIERS){
    console.log('\n'+path.basename(fichier));
    const json=require('./lire-projet.cjs')(fichier);
    const {ctx,sandbox}=loadApp();
    sandbox.__realOcct=real;sandbox.Worker=Worker;sandbox.Blob=Blob;sandbox.URL=URLs;
    require('./noyau.cjs').brancherFichiers(sandbox,ctx);
    vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};',ctx);
    const j0=stats.jobs;stats.maxActifs=0;
    const o=await vm.runInContext(`(async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      await bundleRestore(${JSON.stringify(json)},{rebuild:false});
      occCkClear();markDirty();rebuild();
      const out={feuilles:[]};
      // page et worker partent du même solide relu en BRep binaire (mepHlrExact) : mêmes traits, même ordre
      // (les cotes s'accrochent par rang d'entité) ; nombres à 1e-7 mm près (le noyau neuf du worker peut
      // différer au dernier chiffre, ~1e-14 mm, un peu plus sur le rayon d'un cercle reconnu par 3 points)
      const sig=g=>({src:g&&g.src,els:g&&g.els,hatch:g&&g.hatch});
      const egal=(a,b)=>{
        if(typeof a==='number'&&typeof b==='number')return a===b||Math.abs(a-b)<1e-7;
        if(!a||!b||typeof a!=='object'||typeof b!=='object')return a===b;
        const ka=Object.keys(a),kb=Object.keys(b);
        return ka.length===kb.length&&ka.every(k=>egal(a[k],b[k]));
      };
      const feuilles=(doc.mep&&doc.mep.sheets)||[];
      // 1. référence : calcul sur la page
      window.__mepSync=true;
      mepSetActive(true);
      for(let si=0;si<feuilles.length;si++){
        doc.mep.cur=si;window.mepRefresh();
        const ref={};let t=performance.now();
        window.__mepTest.geoClear();
        feuilles[si].views.forEach(v=>{ref[v.id]=sig(window.mepDebugGeo(v.id));});
        out.feuilles.push({n:feuilles[si].views.length,ref,tPage:performance.now()-t});
      }
      
      // 2. workers
      window.__mepSync=false;
      for(let si=0;si<feuilles.length;si++){
        const F=out.feuilles[si];
        doc.mep.cur=si;
        window.__mepTest.geoClear();
        const t=performance.now();
        window.mepRefresh();
        F.rendu=performance.now()-t;                 // l'écran reprend la main tout de suite
        F.enCours=window.mepHlrInfo().enCours;
        const tA=Date.now();while(window.mepHlrInfo().enCours&&Date.now()-tA<300000)await sleep(20);
        F.tWk=performance.now()-t;
        F.dernier=window.mepHlrInfo().dernier;
        F.pre=window.__mepHlr.pre.size;
        F.diff=[];
        // rendu refait : les vues sont en cache, sans calcul supplémentaire
        feuilles[si].views.forEach(v=>{if(!egal(sig(window.mepDebugGeo(v.id)),F.ref[v.id]))F.diff.push(v.id+' '+v.kind);});
        // 3. rendu suivant sans changement : rien ne repart
        F.jobsAvant=0;window.mepRefresh();F.repart=window.mepHlrInfo().enCours;
      }
      out.coeurs=window.mepHlrInfo().coeurs;
      return out;
    })()`,ctx);
    const jobs=stats.jobs-j0;
    o.feuilles.forEach((F,i)=>{
      const D=F.dernier||{};
      console.log(`  planche ${i+1} : ${F.n} vue(s), page ${Math.round(F.tPage)} ms ; workers ${Math.round(F.tWk)} ms (relevé ${Math.round(D.relev||0)} ms, rendu rendu en ${Math.round(F.rendu)} ms)`);
      if(!F.n)return;
      if(!attendu){
        A(!F.enCours,`planche ${i+1} : petite planche calculée sur la page, sans attendre un worker`);
        A(F.diff.length===0,`planche ${i+1} : vues inchangées`);
        return;
      }
      A(F.enCours,`planche ${i+1} : vues confiées aux workers, l'écran reprend la main (${Math.round(F.rendu)} ms)`);
      A(F.diff.length===0,`planche ${i+1} : les ${F.n} vues sont identiques au calcul sur la page`+(F.diff.length?' — écarts : '+F.diff.join(', '):''));
      A(F.pre===0,`planche ${i+1} : réponses des workers libérées après le rendu`);
      A(!F.repart,`planche ${i+1} : rendu suivant sans changement → aucun calcul relancé`);
    });
    if(!attendu){A(jobs===0,'aucun worker sollicité ('+jobs+')');continue;}
    A(jobs>0,`${jobs} calcul(s) d'arêtes cachées faits par les workers`);
    A(stats.maxActifs>1||jobs<2,`plusieurs vues calculées en même temps (jusqu'à ${stats.maxActifs})`);
    A(stats.maxActifs<=o.coeurs,`jamais plus de workers que de cœurs moins un (${stats.maxActifs} ≤ ${o.coeurs})`);
  }
  console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
