// Le multicœur est-il permis ? Pas de calcul du noyau ici (il reste sur un cœur) : on vérifie la condition
// (mémoire partagée entre fils de calcul) et un vrai calcul réparti.
//   node tauri/mesures/multicoeur.cjs <html servi à Chrome>
// Le programme essayé vient de CC_EXE (variante compilée avec tauri.multicoeur.json).
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const C=require('./commun.cjs');
const EX=path.join(__dirname,'..','..','Exemples');
const html=path.resolve(process.argv[2]);

// Même travail réparti sur n fils qui partagent leur mémoire ; 0 fil partagé si c'est interdit.
const essai=async()=>{
  const out={isole:self.crossOriginIsolated,sab:typeof SharedArrayBuffer!=='undefined',coeurs:navigator.hardwareConcurrency};
  try{new WebAssembly.Memory({initial:1,maximum:2,shared:true});out.memoireWasmPartagee=true;}catch(e){out.memoireWasmPartagee=String(e);}
  if(!out.sab)return out;
  const code=`onmessage=e=>{const {m,de,a}=e.data,t=new Float64Array(m);let s=0;for(let i=de;i<a;i++){let x=i*1e-6;for(let k=0;k<400;k++)x=Math.sqrt(x*x+1)-0.5;s+=x;t[i%t.length]=x;}postMessage(s);}`;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  const N=4e6,mem=new SharedArrayBuffer(8*1024);
  const tourner=n=>new Promise(k=>{
    const t=performance.now();let fin=0;
    for(let j=0;j<n;j++){const w=new Worker(url);w.onmessage=()=>{w.terminate();if(++fin===n)k(Math.round(performance.now()-t));};w.postMessage({m:mem,de:Math.floor(j*N/n),a:Math.floor((j+1)*N/n)});}
  });
  out.ms={};
  for(const n of [1,4,12])out.ms[n]=await tourner(n);
  out.gain4=+(out.ms[1]/out.ms[4]).toFixed(1);out.gain12=+(out.ms[1]/out.ms[12]).toFixed(1);
  return out;
};

(async()=>{
  const res={};
  // application, variante multicœur : le logiciel marche-t-il toujours ?
  const s=await C.lancer('app');
  try{
    await C.noyauPret(s);
    res.applicationMulticoeur=await s.page.evaluate(essai);
    await C.ouvrirPiece(s,path.join(EX,'Cache Piles.conceptcad'));
    res.logicielDansCetteVariante=await s.page.evaluate(async()=>{
      const att=ms=>new Promise(k=>setTimeout(k,ms));
      const me=delWk||delWkStart(),a=performance.now();
      while(!me.ready&&delWk===me&&performance.now()-a<60000)await att(200);
      let rendu;try{await rtLoad();rendu=!!window.RDPT;}catch(e){rendu=String(e);}
      return {v3:OCCT_V3&&occtReady,corps:bodies.filter(b=>b.kind==='body'&&b.shape).length,calculDeFond:me.ready,rendu};
    });
    res.erreurs=s.erreurs;res.dialogues=s.dialogues;
  }finally{await C.arreter(s);}
  // Chrome : page ordinaire, page avec les réglages, fichier ouvert par double-clic
  for(const [nom,isole] of [['chromeLocalhostActuel',false],['chromeLocalhostAvecReglages',true]]){
    process.env.CC_ISOLE=isole?'1':'';
    const srv=await C.serveur(html),c=await C.lancer('chrome');
    try{await C.noyauPret(c);res[nom]=await c.page.evaluate(essai);}finally{await C.arreter(c);srv.close();}
  }
  const srv=await C.serveur(html),c=await C.lancer('chrome');
  try{
    const f=path.join(os.tmpdir(),'cc-essai-fichier.html');fs.writeFileSync(f,'<!doctype html><title>essai</title>');
    await c.page.goto('file:///'+f.split(path.sep).join('/'));
    res.chromeDoubleClicFichier=await c.page.evaluate(essai);
    fs.rmSync(f,{force:true});
  }finally{await C.arreter(c);srv.close();}
  fs.mkdirSync(path.join(__dirname,'resultats'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'resultats','multicoeur.json'),JSON.stringify(res,null,1));
  console.log(JSON.stringify(res,null,1));
})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
