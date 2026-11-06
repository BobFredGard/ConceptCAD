// Contrôle : la RAM de Chrome sans canal de pilotage (mêmes réglages de fenêtre que la série mesurée).
//   node tauri/mesures/controle-chrome.cjs <html>
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawn,execFileSync}=require('child_process');
const C=require('./commun.cjs');
(async()=>{
  const srv=await C.serveur(path.resolve(process.argv[2]));
  const servis=[];srv.on('request',r=>servis.push(r.url));
  const prof=path.join(os.tmpdir(),'cc-mesure-chrome-sans');
  const l=[];
  for(let i=0;i<2;i++){
    fs.rmSync(prof,{recursive:true,force:true});
    const c=spawn(C.CHROME,['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling','--user-data-dir='+prof,'--no-first-run','--no-default-browser-check','--window-size=1416,939','http://localhost:'+C.PORT_WEB+'/ConceptCAD.html'],{stdio:'ignore'});
    await C.attendre(40000);
    const m=await C.memoireStable({enfant:{pid:c.pid}});
    l.push({prive:m.prive,engage:m.engage,ws:m.ws,gpuDed:m.gpuDed,noms:m.noms,detail:m.detail.slice(0,5),noyauDemande:servis.some(u=>/conceptcad_v3\.wasm/.test(u))});
    try{execFileSync('taskkill',['/PID',String(c.pid),'/T','/F'],{stdio:'ignore'});}catch(e){}
    await C.attendre(2000);
  }
  fs.rmSync(prof,{recursive:true,force:true});
  srv.close();
  fs.writeFileSync(path.join(__dirname,'resultats','controle-chrome.json'),JSON.stringify(l,null,1));
  console.log(JSON.stringify(l));
})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
