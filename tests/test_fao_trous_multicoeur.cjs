// V0.99.51 : trous débouchants de la FAO testés sur plusieurs cœurs (89-fao-percage, faoDrillReplayWk).
// Demande de Fred : « maximiser les CPU » pour la timeline. SIRAP-14-002 : changer un perçage figeait l'écran
// ~4,5 s dans faoDrillReplay (144 points « débouchant ? » classés dans la matière sur la page).
// Le harnais n'a pas de Worker : on en fournit un sur worker_threads, qui exécute le VRAI code du worker
// (delWkSource) avec un VRAI noyau. Pour chaque pièce :
//   1. référence : trous reconnus sur la page seule (?mono) ;
//   2. mêmes trous par les workers : la page rend la main aussitôt, la FAO attend (faoSolidSettled),
//      puis chaque perçage « trous du modèle » retrouve exactement la même liste ;
//   3. après une modification de la pièce : même chose, comparé au calcul sur la page du même état.
//   node tests/test_fao_trous_multicoeur.cjs                         exemple Perçages (seuil abaissé)
//   node tests/test_fao_trous_multicoeur.cjs --chemin D:/x.conceptcad un fichier hors Exemples (seuil normal)
const vm=require('vm'),path=require('path');
const {Worker:NodeWorker}=require('worker_threads');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
const argv=process.argv.slice(2);
const iC=argv.indexOf('--chemin');
const FICHIERS=iC>=0?[[argv[iC+1],false]]:[[path.join(ROOT,'Exemples','Perçages.conceptcad'),true]];
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};

const stats={jobs:0,actifs:0,maxActifs:0};
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
    this.nw=new NodeWorker(PRE+blobs.get(url),{eval:true,resourceLimits:{maxOldGenerationSizeMb:4096}});
    this.nw.on('message',d=>{if(d&&d.t==='fin'){stats.actifs--;}this.onmessage&&this.onmessage({data:d});});
    this.nw.on('error',e=>this.onerror&&this.onerror({message:String((e&&e.message)||e),preventDefault(){}}));
  }
  postMessage(m,t){if(m&&m.t==='job'){stats.jobs++;stats.actifs++;stats.maxActifs=Math.max(stats.maxActifs,stats.actifs);}this.nw.postMessage(m,t);}
  terminate(){this.nw.terminate();}
}

(async()=>{
  const real=await require('./noyau.cjs').charger();
  for(const [fichier,seuilBas] of FICHIERS){
    console.log('\n'+path.basename(fichier));
    const json=require('./lire-projet.cjs')(fichier);
    const {ctx,sandbox}=loadApp();
    sandbox.__realOcct=real;sandbox.Worker=Worker;sandbox.Blob=Blob;sandbox.URL=URLs;
    require('./noyau.cjs').brancherFichiers(sandbox,ctx);
    vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};',ctx);
    const j0=stats.jobs;stats.maxActifs=0;
    const o=await vm.runInContext(`(async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      ${seuilBas?'FAO_TROUS_WK_MIN=0;':''}
      await bundleRestore(${JSON.stringify(json)},{rebuild:false});
      hlrWkOff=true; // ouverture : sur la page
      // suppressions de face faites par leurs propres workers : attendues, la pièce ne bouge plus ensuite
      const stable=async()=>{const tA=Date.now();while(Date.now()-tA<600000){await sleep(100);if(!delWkPending()&&rebuildDepth===0&&!String(occLive&&occLive.sig).includes('⧗'))break;}};
      occCkClear();markDirty();rebuild();await stable();
      const ops=[];((faoRoot()&&faoRoot().setups)||[]).forEach(s=>(s.ops||[]).forEach(op=>{if(op.type==='drill'&&op.src==='model')ops.push(op);}));
      const etat=()=>JSON.stringify(ops.map(op=>op.holes||[]));
      const memo=()=>JSON.stringify([...faoHoleMemo.entries()].sort((a,b)=>a[0]<b[0]?-1:1));
      const page=()=>{hlrWkOff=true;faoHoleMemo.clear();ops.forEach(op=>{op.holes=[];});const t=performance.now();faoDrillReplay();return {ms:performance.now()-t,ops:etat(),memo:memo()};};
      const parWk=async()=>{
        hlrWkOff=false;faoHoleMemo.clear();ops.forEach(op=>{op.holes=[];});
        const t=performance.now();faoDrillReplay();const rendu=performance.now()-t;
        const attend=faoTrousAttente>0,regle=faoSolidSettled();
        const tA=Date.now();while(faoTrousAttente>0&&Date.now()-tA<300000)await sleep(20);
        return {rendu,attend,regle,ms:performance.now()-t,ops:etat(),memo:memo(),dernier:faoTrousDernier,apres:faoSolidSettled()};
      };
      const out={nOps:ops.length};
      out.ref=page();
      out.wk=await parWk();
      // modification : la profondeur du premier perçage de la timeline
      const f=doc.features.find(x=>x.type==='hole'&&x.visible!==false&&+x.depth>0);
      if(f){
        f.depth=+f.depth+0.5;hlrWkOff=true;markDirty();rebuild();await stable();
        out.ref2=page();out.wk2=await parWk();
      }
      out.trous=JSON.parse(out.ref.ops).reduce((s,l)=>s+l.length,0);
      return out;
    })()`,ctx);
    const jobs=stats.jobs-j0;
    console.log(`  ${o.nOps} perçage(s) « trous du modèle », ${o.trous} trou(s) suivis ; page ${Math.round(o.ref.ms)} ms, workers ${Math.round(o.wk.ms)} ms (main rendue en ${Math.round(o.wk.rendu)} ms) ; relevé ${JSON.stringify(o.wk.dernier)}`);
    A(o.nOps>0&&o.trous>0,'des perçages suivent des trous du modèle');
    const verif=(r,w,quand)=>{
      A(w.attend,quand+' : tests « débouchant » confiés aux workers, la page rend la main');
      A(w.regle===false,quand+' : la FAO attend les perçages (faoSolidSettled faux pendant le calcul)');
      A(w.apres===true,quand+' : puis la FAO repart (faoSolidSettled vrai)');
      A(w.dernier&&w.dernier.ok,quand+' : tous les paquets rendus par les workers');
      A(w.ops===r.ops,quand+' : trous de chaque perçage identiques au calcul sur la page');
      A(w.memo===r.memo,quand+' : trous reconnus (débouchants compris) identiques, repère par repère');
      if(w.memo!==r.memo){
        const R=new Map(JSON.parse(r.memo)),W=new Map(JSON.parse(w.memo));
        console.log('    clés page '+R.size+', workers '+W.size);
        R.forEach((l,k)=>console.log('    page : …'+k.slice(-70)+' → '+l.length));
        W.forEach((l,k)=>console.log('    wk   : …'+k.slice(-70)+' → '+l.length));
        const ks=[...W.keys()];if(ks.length>1){let i=0;while(ks[0][i]===ks[1][i])i++;console.log('    1er écart à '+i+'/'+ks[0].length+' : «'+ks[0].slice(i-30,i+50)+'» / «'+ks[1].slice(i-30,i+50)+'»');}
        R.forEach((l,k)=>{const m=W.get(k);if(!m){console.log('    absente côté workers : '+k.slice(-60));return;}
          if(JSON.stringify(l)===JSON.stringify(m))return;
          console.log('    repère '+k.slice(-40)+' : '+l.length+' / '+m.length+' trous');
          l.forEach((h,i)=>{const g=m[i];if(JSON.stringify(h)!==JSON.stringify(g))console.log('      '+i+' page '+JSON.stringify(h).slice(0,160)+'\n        wk   '+JSON.stringify(g).slice(0,160));});});
        W.forEach((l,k)=>{if(!R.has(k))console.log('    en trop côté workers : '+k.slice(-60));});
      }
    };
    verif(o.ref,o.wk,'ouverture');
    if(o.ref2)verif(o.ref2,o.wk2,'après modification');
    A(jobs>0,jobs+' paquet(s) de points calculés par les workers');
    A(stats.maxActifs>1||jobs<2,"plusieurs paquets en même temps (jusqu'à "+stats.maxActifs+')');
  }
  console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
