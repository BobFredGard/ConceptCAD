// Mesure honnête : opération Finition seule (opérations précédentes en cache), part de la
// descente d'outil, puis grilles JS / GPU v1 (listes) / GPU v2 (par primitive).
// node mesure3.cjs <worktree> <port> chrome
'use strict';
const path=require('path'),fs=require('fs'),{spawn}=require('child_process');
const WT=process.argv[2],PORT=+process.argv[3]||3187,MODE=process.argv[4]||'chrome';
const {chromium}=require(path.join(WT,'node_modules','@playwright','test'));
const FICHIER='D:\\Copies-PLM\\SIRAP-14\\SIRAP-14-002-1114.conceptcad';
(async()=>{
  const srv=spawn(process.execPath,[path.join(WT,'tests','browser','serveur.cjs'),String(PORT)],{stdio:'inherit'});
  await new Promise(r=>setTimeout(r,800));
  const br=await chromium.launch({headless:true,channel:MODE==='chrome'?'chrome':undefined,args:['--enable-unsafe-webgpu','--enable-gpu','--ignore-gpu-blocklist','--use-angle=d3d11']});
  const page=await br.newPage({viewport:{width:1400,height:900}});
  page.on('pageerror',e=>console.log('pageerror',e.message));
  page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await page.goto('http://127.0.0.1:'+PORT+'/ConceptCAD.html?mono');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:300000});
  await page.setInputFiles('#fileProj',FICHIER);
  await page.waitForFunction(()=>doc&&/SIRAP/.test(doc.name)&&builtEngine==='exact'&&bodies.some(b=>b.shape)&&faoSolidSettled(),null,{timeout:600000,polling:1000});
  await page.addScriptTag({path:path.join(__dirname,'webgpu-descente.js')});
  await page.addScriptTag({path:path.join(__dirname,'webgpu-descente2.js')});
  const R=await page.evaluate(async()=>{
    const out={};
    const P=faoRoot().setups.find(s=>s.id==='setup_3_mweoq7ys');const op=P.ops.find(o=>o.id==='op_3_mwg0dqks');
    // opérations précédentes en cache (calculées une fois)
    P.ops.forEach(q=>{if(q!==op&&q.on!==false){try{faoOpMoves(q,P);}catch(e){}}});
    const hit0=faoOpMovesHit,drop0=faoScDropper;let nTip=0,tTip=0,tBuild=0,cap=null;
    faoOpMovesHit=function(q){return q===op?null:hit0(q);};
    faoScDropper=function(mesh,kind,D,cr,L,ns){const t=performance.now();const d=drop0(mesh,kind,D,cr,L,ns);tBuild+=performance.now()-t;
      if(!cap&&kind==='ball')cap={mesh:mesh,D:D,L:L};
      const tip=d.tip;d.tip=function(x,y){nTip++;const t=performance.now();const z=tip(x,y);tTip+=performance.now()-t;return z;};return d;};
    const runs=[];
    for(let r=0;r<2;r++){nTip=0;tTip=0;tBuild=0;
      const t=performance.now();const mv=faoOpMoves(op,P);
      runs.push({opMs:Math.round(performance.now()-t),pts:mv.length,scallopMs:op.geoDiag&&op.geoDiag.ms,restMapMs:op.restDiag&&op.restDiag.ms,
        preparationDescenteMs:Math.round(tBuild),descentes:nTip,descentesMs:Math.round(tTip)});}
    out.operation=runs;
    faoOpMovesHit=hit0;faoScDropper=drop0;
    const mesh=cap.mesh,D=cap.D,L=cap.L||0;
    out.maillage={triangles:mesh.t.length,sommets:mesh.v.length,D:D};
    let bx0=1/0,by0=1/0,bx1=-1/0,by1=-1/0;
    mesh.v.forEach(p=>{if(p[0]<bx0)bx0=p[0];if(p[0]>bx1)bx1=p[0];if(p[1]<by0)by0=p[1];if(p[1]>by1)by1=p[1];});
    bx0-=D/2;by0-=D/2;bx1+=D/2;by1+=D/2;
    out.boite=[+(bx1-bx0).toFixed(1),+(by1-by0).toFixed(1)];
    const cmp=(zj,z)=>{let dmax=0,n1=0,inf=0;for(let k=0;k<zj.length;k++){const a=zj[k],b=z[k];
      if(!(a>-1/0)||!(b>-1/0)){if((a>-1/0)!==(b>-1/0))inf++;continue;}const e=Math.abs(a-b);if(e>dmax)dmax=e;if(e>0.001)n1++;}
      return {ecartMax:+dmax.toFixed(5),plusDe1um:n1,videsDiff:inf};};
    out.grilles=[];
    await gpuDropGrid2(mesh,D,L,bx0,by0,1,10,10); // compilation du shader
    for(const g of [0.7,0.25,0.1]){
      const nx=Math.ceil((bx1-bx0)/g)+1,ny=Math.ceil((by1-by0)/g)+1;const G={pas:g,noeuds:nx*ny};
      let t=performance.now();const zj=gpuDropJs(mesh,D,L,bx0,by0,g,nx,ny);G.jsMs=Math.round(performance.now()-t);
      const r1=await gpuDropGrid(mesh,D,L,bx0,by0,g,nx,ny);G.gpuListesMs=Math.round(r1.t.total);G.gpuListesCalculMs=+r1.t.calcul.toFixed(1);
      const r2=await gpuDropGrid2(mesh,D,L,bx0,by0,g,nx,ny);G.carte=r2.carte;G.via=r2.via;
      G.gpuPrimitivesMs=Math.round(r2.t.total);G.detail={};for(const k in r2.t)G.detail[k]=+r2.t[k].toFixed(1);
      G.cmpListes=cmp(zj,r1.z);G.cmpPrimitives=cmp(zj,r2.z);
      out.grilles.push(G);}
    out.repli=(await gpuDropGrid2(mesh,D,L,bx0,by0,0.7,Math.ceil((bx1-bx0)/0.7)+1,Math.ceil((by1-by0)/0.7)+1,{forceJs:true})).via;
    return out;
  });
  console.log(JSON.stringify(R,null,1));
  fs.writeFileSync(path.join(__dirname,'resultat3-'+MODE+'.json'),JSON.stringify(R,null,1));
  await br.close();srv.kill();
})().catch(e=>{console.error(e);process.exit(1);});
