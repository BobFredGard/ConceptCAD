// Chaque noyau de la carte contre le JavaScript, nœud par nœud.
'use strict';
const path=require('path'),{spawn}=require('child_process');
const WT=process.argv[2],PORT=+process.argv[3]||3187,FICHIER=process.argv[4],SETUP=process.argv[5];
const {chromium}=require(path.join(WT,'node_modules','@playwright','test'));
(async()=>{
  const srv=spawn(process.execPath,[path.join(WT,'tests','browser','serveur.cjs'),String(PORT)],{stdio:'inherit'});
  await new Promise(r=>setTimeout(r,800));
  const br=await chromium.launch({headless:true,channel:'chrome',args:['--enable-unsafe-webgpu','--enable-gpu','--ignore-gpu-blocklist']});
  const page=await br.newPage({viewport:{width:1400,height:900}});
  page.on('pageerror',e=>console.log('pageerror',e.message));
  page.on('console',m=>{if(/carte graphique|WGSL|error/i.test(m.text()))console.log('console',m.type(),m.text().slice(0,800));});
  page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await page.goto('http://127.0.0.1:'+PORT+'/ConceptCAD.html?mono');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:300000});
  await page.setInputFiles('#fileProj',FICHIER);
  await page.waitForFunction(()=>doc&&doc.name&&builtEngine==='exact'&&bodies.some(b=>b.shape)&&faoSolidSettled(),null,{timeout:600000,polling:1000});
  const R=await page.evaluate(async(SETUP)=>{
    const P=faoRoot().setups.find(s=>s.id===SETUP)||faoSetup();
    const mesh=faoActiveMesh(P,true).mesh;
    let bx0=1/0,by0=1/0,bx1=-1/0,by1=-1/0;
    mesh.v.forEach(p=>{if(p[0]<bx0)bx0=p[0];if(p[0]>bx1)bx1=p[0];if(p[1]<by0)by0=p[1];if(p[1]>by1)by1=p[1];});
    const out={tri:mesh.t.length,cas:[]};
    const cases=[
      {kind:'drop',tool:'ball',D:6,r:3,L:0,g:0.7},
      {kind:'drop',tool:'ball',D:6,r:3,L:0.3,g:0.7},
      {kind:'drop',tool:'flat',D:10,r:0,L:0.2,g:0.5},
      {kind:'drop',tool:'bull',D:10,r:1,L:0,g:0.7},
      {kind:'torus',D:10,rc:1,L:0.2,g:0.5},
    ];
    for(const c of cases){
      const req=Object.assign({mesh:mesh,x0:bx0-c.D,y0:by0-c.D},c);
      req.nx=Math.ceil((bx1-bx0+2*c.D)/c.g)+1;req.ny=Math.ceil((by1-by0+2*c.D)/c.g)+1;
      let t=performance.now();
      const d=c.kind==='torus'?faoTorusDropper(mesh,c.D,c.rc,c.L):faoScDropper(mesh,c.tool,c.D,c.r,c.L);
      const zj=new Float64Array(req.nx*req.ny);
      for(let j=0;j<req.ny;j++)for(let i=0;i<req.nx;i++)zj[j*req.nx+i]=d.tip(req.x0+i*c.g,req.y0+j*c.g);
      const jsMs=performance.now()-t;
      t=performance.now();const r=await faoGpuServe(req);const gpuMs=performance.now()-t;
      const row={cas:JSON.stringify(c),noeuds:zj.length,jsMs:Math.round(jsMs),gpuMs:Math.round(gpuMs),cand:faoGpuStat.cand,err:faoGpuStat.err};
      if(!r){row.echec=1;out.cas.push(row);continue;}
      const z=r.value;let neq=0,dmax=0,ex=[];
      for(let k=0;k<z.length;k++){const a=zj[k],b=z[k];if(a===b)continue;neq++;
        const e=(a>-1/0&&b>-1/0)?Math.abs(a-b):99;if(e>dmax)dmax=e;
        if(ex.length<5)ex.push({k:k,i:k%req.nx,j:Math.floor(k/req.nx),js:a,gpu:b});}
      row.differents=neq;row.ecartMax=dmax;row.exemples=ex;out.cas.push(row);
    }
    return out;
  },SETUP);
  console.log(JSON.stringify(R,null,1));
  await br.close();srv.kill();
})().catch(e=>{console.error(e);process.exit(1);});
