// Parcours avec carte graphique (faoOpMovesStream) vs JavaScript (faoOpMoves) : égalité et temps.
// node compare.cjs <worktree> <port> <fichier> [setupId]
'use strict';
const path=require('path'),fs=require('fs'),{spawn}=require('child_process');
const WT=process.argv[2],PORT=+process.argv[3]||3187,FICHIER=process.argv[4],SETUP=process.argv[5]||'';
const {chromium}=require(path.join(WT,'node_modules','@playwright','test'));
(async()=>{
  const srv=spawn(process.execPath,[path.join(WT,'tests','browser','serveur.cjs'),String(PORT)],{stdio:'inherit'});
  await new Promise(r=>setTimeout(r,800));
  const br=await chromium.launch({headless:true,channel:'chrome',args:['--enable-unsafe-webgpu','--enable-gpu','--ignore-gpu-blocklist']});
  const page=await br.newPage({viewport:{width:1400,height:900}});
  page.on('pageerror',e=>console.log('pageerror',e.message));
  page.on('console',m=>{if(/carte graphique|WGSL|error/i.test(m.text()))console.log('console',m.type(),m.text().slice(0,600));});
  page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await page.goto('http://127.0.0.1:'+PORT+'/ConceptCAD.html?mono');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:300000});
  await page.setInputFiles('#fileProj',FICHIER);
  await page.waitForFunction(()=>doc&&doc.name&&builtEngine==='exact'&&bodies.some(b=>b.shape)&&faoSolidSettled(),null,{timeout:600000,polling:1000});
  const R=await page.evaluate(async(SETUP)=>{
    const out={gpu:!!navigator.gpu,ops:[]};
    const setups=faoRoot().setups.filter(s=>!SETUP||s.id===SETUP);
    const hit0=faoOpMovesHit;
    for(const P of setups){
      for(const op of P.ops){
        if(op.on===false)continue;
        const meshy=['rough3d','geofinish','geodesic'].indexOf(op.type)>=0;
        if(!meshy){try{faoOpMoves(op,P);}catch(e){}continue;}
        const row={setup:P.id,op:op.id,type:op.type,traj:op.traj,brut:op.brut};
        faoOpMovesHit=function(q){return q===op?null:hit0(q);};
        try{
          let t=performance.now();const A=faoOpMoves(op,P);row.jsMs=Math.round(performance.now()-t);
          const n0=faoGpuStat.n;
          t=performance.now();const B=await faoOpMovesStream(op,P,null);row.gpuMs=Math.round(performance.now()-t);
          row.demandesCarte=faoGpuStat.n-n0;row.pre=[faoGpuStat.pre,Math.round(faoGpuStat.preMs||0),faoGpuStat.preTours];faoGpuStat.pre=0;faoGpuStat.preMs=0;faoGpuStat.preTours=0;row.cand=[faoGpuStat.candT,Math.round(faoGpuStat.polMs||0)];faoGpuStat.candT=0;faoGpuStat.polMs=0;row.carte=faoGpuStat.carte;row.err=faoGpuStat.err;
          t=performance.now();faoOpMoves(op,P);row.js2Ms=Math.round(performance.now()-t);
          t=performance.now();await faoOpMovesStream(op,P,null);row.gpu2Ms=Math.round(performance.now()-t);
          faoGpuOff=true;t=performance.now();await faoOpMovesStream(op,P,null);row.streamSansCarteMs=Math.round(performance.now()-t);faoGpuOff=false;
          row.pts=[A.length,B.length];
          let diff=0,dmax=0,first=-1;
          for(let i=0;i<Math.min(A.length,B.length);i++){const a=A[i],b=B[i];
            const e=Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.z-b.z));
            if(e>0||!!a.r!==!!b.r){diff++;if(first<0)first=i;if(e>dmax)dmax=e;}}
          row.pointsDifferents=diff+Math.abs(A.length-B.length);row.ecartMax=dmax;row.premier=first;
        }catch(e){row.exc=String(e&&e.stack||e).slice(0,500);}
        faoOpMovesHit=hit0;
        out.ops.push(row);
      }
    }
    return out;
  },SETUP);
  console.log(JSON.stringify(R,null,1));
  await br.close();srv.kill();
})().catch(e=>{console.error(e);process.exit(1);});
