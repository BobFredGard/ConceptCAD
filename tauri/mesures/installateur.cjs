// Essai du vrai installateur : pose, double-clic par Windows, RAM sans pilotage, puis désinstallation.
//   node tauri/mesures/installateur.cjs <setup.exe> <dossier d'essai> <html servi à Chrome>
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {execFileSync,spawn}=require('child_process');
const C=require('./commun.cjs');
const [,,SETUP,ESSAI,HTML]=process.argv;
const ps=c=>execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',c],{encoding:'utf8'}).trim();
const DOSSIER=path.join(process.env.LOCALAPPDATA,'ConceptCAD');
const res={};
const reg=()=>ps("Test-Path 'HKCU:\\Software\\Classes\\.conceptcad'");
const procApp=()=>ps(`Get-CimInstance Win32_Process -Filter "Name like 'conceptcad%' or Name='ConceptCAD.exe'" | Select-Object -First 1 -ExpandProperty ProcessId`);
const fermerApp=()=>{try{ps(`Get-CimInstance Win32_Process -Filter "Name like 'conceptcad%'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`);}catch(e){}};
(async()=>{
  if(reg()==='True'||fs.existsSync(DOSSIER))throw new Error('déjà installé ou associé : essai annulé');
  fs.mkdirSync(ESSAI,{recursive:true});
  const piece=path.join(ESSAI,'installateur essai.conceptcad');
  fs.copyFileSync(path.join(__dirname,'..','..','Exemples','Cache Piles.conceptcad'),piece);
  res.tailleSetupMo=+(fs.statSync(SETUP).size/1048576).toFixed(1);
  let t=Date.now();
  ps(`Start-Process -FilePath '${SETUP}' -ArgumentList '/S' -Wait`);
  res.installationS=Math.round((Date.now()-t)/1000);
  res.fichiers=fs.readdirSync(DOSSIER);
  const exe=res.fichiers.find(f=>/\.exe$/i.test(f)&&!/uninstall/i.test(f));
  res.tailleInstalleeMo=+(fs.statSync(path.join(DOSSIER,exe)).size/1048576).toFixed(1);
  res.associationPosee=reg()==='True';
  try{
    t=Date.now();
    ps(`Start-Process -FilePath '${piece}'`);
    let titre='',pid='';
    for(let i=0;i<300&&!/installateur essai/.test(titre);i++){
      await C.attendre(200);
      pid=procApp();
      if(pid)titre=ps(`(Get-Process -Id ${pid}).MainWindowTitle`);
    }
    res.doubleClicOuvert=/installateur essai/.test(titre);
    res.titre=titre;
    res.doubleClicJusquauTitreMs=Date.now()-t;
    await C.attendre(30000);
    res.ramOuvertSansPilotage=await C.memoireStable({enfant:{pid:+pid}});
    delete res.ramOuvertSansPilotage.noms;
  }finally{fermerApp();await C.attendre(2000);}
  // Contrôle sans pilotage, logiciel vide
  const a=spawn(path.join(DOSSIER,exe),[],{stdio:'ignore'});
  await C.attendre(25000);
  res.ramVideSansPilotageApp=await C.memoireStable({enfant:{pid:a.pid}});
  fermerApp();await C.attendre(2000);
  const srv=await C.serveur(path.resolve(HTML));
  const prof=path.join(os.tmpdir(),'cc-mesure-chrome-sans');
  fs.rmSync(prof,{recursive:true,force:true});
  const c=spawn(C.CHROME,['--user-data-dir='+prof,'--no-first-run','--no-default-browser-check','--window-size=1416,939','http://localhost:'+C.PORT_WEB+'/ConceptCAD.html'],{stdio:'ignore'});
  await C.attendre(25000);
  res.ramVideSansPilotageChrome=await C.memoireStable({enfant:{pid:c.pid}});
  try{execFileSync('taskkill',['/PID',String(c.pid),'/T','/F'],{stdio:'ignore'});}catch(e){}
  srv.close();
  await C.attendre(2000);
  fs.rmSync(prof,{recursive:true,force:true});
  // Désinstallation
  const des=path.join(DOSSIER,res.fichiers.find(f=>/uninstall/i.test(f)));
  ps(`Start-Process -FilePath '${des}' -ArgumentList '/S' -Wait`);
  for(let i=0;i<60&&fs.existsSync(path.join(DOSSIER,exe));i++)await C.attendre(500);
  res.desinstalle=!fs.existsSync(path.join(DOSSIER,exe));
  res.associationRetiree=reg()==='False';
  res.classeRestante=ps("Get-ChildItem 'HKCU:\\Software\\Classes' -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match 'conceptcad' } | ForEach-Object { $_.PSChildName }");
  fs.writeFileSync(path.join(__dirname,'resultats','installateur.json'),JSON.stringify(res,null,1));
  console.log(JSON.stringify(res,null,1));
})().then(()=>process.exit(0),e=>{console.error(e);console.log(JSON.stringify(res));process.exit(1);});
