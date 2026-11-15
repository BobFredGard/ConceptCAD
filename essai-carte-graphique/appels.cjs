// Où sont faites les descentes une par une ? Compte par ligne appelante (JavaScript, ?nogpu).
'use strict';
const path=require('path'),{spawn}=require('child_process');
const WT=process.argv[2],PORT=+process.argv[3]||3187,FICHIER=process.argv[4],SETUP=process.argv[5];
const {chromium}=require(path.join(WT,'node_modules','@playwright','test'));
(async()=>{
  const srv=spawn(process.execPath,[path.join(WT,'tests','browser','serveur.cjs'),String(PORT)],{stdio:'inherit'});
  await new Promise(r=>setTimeout(r,800));
  const br=await chromium.launch({headless:true,channel:'chrome'});
  const page=await br.newPage({viewport:{width:1400,height:900}});
  page.on('pageerror',e=>console.log('pageerror',e.message));
  page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await page.goto('http://127.0.0.1:'+PORT+'/ConceptCAD.html?mono&nogpu');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:300000});
  await page.setInputFiles('#fileProj',FICHIER);
  await page.waitForFunction(()=>doc&&doc.name&&builtEngine==='exact'&&bodies.some(b=>b.shape)&&faoSolidSettled(),null,{timeout:600000,polling:1000});
  const R=await page.evaluate(async(SETUP)=>{
    const P=faoRoot().setups.find(s=>s.id===SETUP)||faoSetup();
    const out={};
    const hit0=faoOpMovesHit,sd=faoScDropper,td=faoTorusDropper;
    let stat=null,nb=0;
    const wrap=function(nom,d){const tip=d.tip;let n=0;
      d.tip=function(x,y){n++;nb++;const t=performance.now();const z=tip(x,y);const dt=performance.now()-t;
        if(n%50===1){const st=String(new Error().stack).split('\n');
          const l=st.slice(2,5).map(s=>s.replace(/^\s*at /,'').replace(/https?:\/\/[^)]*ConceptCAD\.html/,'').trim()).join(' < ');
          const k=nom+' | '+l;const e=stat[k]||(stat[k]={n:0,ms:0});e.n+=50;e.ms+=dt*50;}
        return z;};return d;};
    faoScDropper=function(m,k,D,c,L,ns){const t=performance.now();const d=sd(m,k,D,c,L,ns);stat['PREPARATION boule/plate '+k]=(stat['PREPARATION boule/plate '+k]||{n:0,ms:0});stat['PREPARATION boule/plate '+k].n++;stat['PREPARATION boule/plate '+k].ms+=performance.now()-t;return wrap('drop '+k,d);};
    faoTorusDropper=function(m,D,rc,L){const t=performance.now();const d=td(m,D,rc,L);stat['PREPARATION tore']=(stat['PREPARATION tore']||{n:0,ms:0});stat['PREPARATION tore'].n++;stat['PREPARATION tore'].ms+=performance.now()-t;return wrap('tore',d);};
    for(const op of P.ops){
      if(op.on===false)continue;
      if(['rough3d','geofinish','geodesic'].indexOf(op.type)<0){try{faoOpMoves(op,P);}catch(e){}continue;}
      stat={};nb=0;
      faoOpMovesHit=function(q){return q===op?null:hit0(q);};
      const t=performance.now();faoOpMoves(op,P);const ms=performance.now()-t;
      faoOpMovesHit=hit0;
      out[op.type+' '+op.id]={ms:Math.round(ms),descentes:nb,
        sites:Object.entries(stat).sort((a,b)=>b[1].ms-a[1].ms).slice(0,14).map(e=>Math.round(e[1].ms)+' ms  '+e[1].n+'×  '+e[0])};
    }
    faoScDropper=sd;faoTorusDropper=td;
    return out;
  },SETUP);
  console.log(JSON.stringify(R,null,1));
  await br.close();srv.kill();
})().catch(e=>{console.error(e);process.exit(1);});
