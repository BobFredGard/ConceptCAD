// Essai réel de la mise à jour par Internet, sans rien publier : deux versions d'un programme d'essai
// (autre nom, autre dossier, autres données que le vrai ConceptCAD) et un petit serveur local à la place de GitHub.
// Les installateurs sont signés avec la vraie clé ; une autre clé sert à vérifier le refus d'un faux fichier.
//   node tauri/mesures/mise-a-jour.cjs <dossier d'essai vide>
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const {execFileSync,spawn,spawnSync}=require('child_process');
const C=require('./commun.cjs');
const ESSAI=path.resolve(process.argv[2]);
const TAURI=path.join(__dirname,'..','src-tauri');
const EX=path.join(__dirname,'..','..','Exemples');
const CLE=path.join(os.homedir(),'.tauri','conceptcad-maj.key');
const NOM='ConceptCADEssai',V_A='0.0.1',V_B='0.0.2',PORT=9340;
const DOSSIER=path.join(process.env.LOCALAPPDATA,NOM),EXE=path.join(DOSSIER,NOM+'.exe');
const DONNEES=path.join(process.env.LOCALAPPDATA,'fr.conceptcad.essaimaj');
const DESINST=path.join(DOSSIER,'uninstall.exe');
const PILOTE='--remote-debugging-port=9333 --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling';
const bilan=[];
const note=(nom,ok,detail)=>{bilan.push({nom,ok:!!ok,detail});console.log((ok?'OK   ':'ÉCHEC ')+nom+(detail!==undefined?' : '+JSON.stringify(detail):''));};
const ps=c=>execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',c],{encoding:'utf8'}).trim();
const assoc=()=>ps("Test-Path 'HKCU:\\Software\\Classes\\.conceptcad'")==='True';
const versionExe=()=>ps(`(Get-Item '${EXE}').VersionInfo.ProductVersion`);
const processus=()=>ps(`@(Get-Process ${NOM} -ErrorAction SilentlyContinue).Count`);
const titreFenetre=()=>ps(`[Console]::OutputEncoding=[Text.Encoding]::UTF8;Get-Process ${NOM} -ErrorAction SilentlyContinue | Where-Object MainWindowTitle | Select-Object -First 1 -ExpandProperty MainWindowTitle`);
const toutFermer=()=>{try{ps(`Get-Process ${NOM} -ErrorAction SilentlyContinue | Stop-Process -Force`);}catch(e){}};

// Une version d'essai : mêmes réglages que la vraie, sauf son identité et l'adresse consultée.
function fabriquer(version,sortie){
  const cfg={productName:NOM,mainBinaryName:NOM,identifier:'fr.conceptcad.essaimaj',version,plugins:{updater:{endpoints:[`http://127.0.0.1:${PORT}/latest.json`],dangerousInsecureTransportProtocol:true}}};
  const f=path.join(ESSAI,'config-'+version+'.json');
  fs.writeFileSync(f,JSON.stringify(cfg));
  const r=spawnSync('cargo',['tauri','build','--config','tauri.installateur.json','--config',f],{cwd:TAURI,encoding:'utf8',env:{...process.env,TAURI_SIGNING_PRIVATE_KEY:fs.readFileSync(CLE,'utf8').trim(),TAURI_SIGNING_PRIVATE_KEY_PASSWORD:''},shell:true,maxBuffer:1e8});
  if(r.status!==0)throw new Error('compilation '+version+' : '+(r.stderr||'').slice(-800));
  const nsis=path.join(TAURI,'target','release','bundle','nsis'),n=`${NOM}_${version}_x64-setup.exe`;
  fs.copyFileSync(path.join(nsis,n),sortie);
  fs.copyFileSync(path.join(nsis,n+'.sig'),sortie+'.sig');
  fs.rmSync(path.join(nsis,n));fs.rmSync(path.join(nsis,n+'.sig'));
}

// Signature par une autre clé : ce que ferait quelqu'un qui remplacerait le fichier.
function fausseSignature(setup){
  const cle=path.join(ESSAI,'autre.key'),copie=path.join(ESSAI,'faux.exe');
  fs.copyFileSync(setup,copie);
  for(const a of [['signer','generate','-w',cle,'-p','""','--ci','-f'],['signer','sign','-f',cle,'-p','""',copie]]){
    const r=spawnSync('cargo',['tauri',...a],{cwd:TAURI,encoding:'utf8',shell:true});
    if(r.status!==0)throw new Error('fausse signature : '+r.stderr);
  }
  return fs.readFileSync(copie+'.sig','utf8');
}

// Le serveur local remplace GitHub ; `etat` décide de ce qu'il répond.
const etat={annonce:null,setup:null,demandes:0,telechargements:0};
const serveur=http.createServer((rq,rs)=>{
  if(rq.url==='/latest.json'){
    etat.demandes++;
    if(!etat.annonce){rs.writeHead(404);return rs.end();}
    rs.writeHead(200,{'Content-Type':'application/json'});return rs.end(JSON.stringify(etat.annonce));
  }
  if(rq.url==='/setup.exe'){
    etat.telechargements++;
    const b=fs.readFileSync(etat.setup);
    rs.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':b.length});return rs.end(b);
  }
  rs.writeHead(404);rs.end();
});
const annonce=(version,signature)=>({version,notes:'essai',pub_date:new Date().toISOString(),platforms:{'windows-x86_64':{signature,url:`http://127.0.0.1:${PORT}/setup.exe`}}});

const questionMaj=s=>s.page.waitForFunction(()=>[...document.querySelectorAll('.mffDlg button')].some(b=>b.textContent==='Installer maintenant'),null,{timeout:30000,polling:100});
const cliquer=(s,t)=>s.page.click('.mffDlg button:text-is("'+t+'")');
const aQuestion=s=>s.page.evaluate(()=>[...document.querySelectorAll('.mffDlg button')].some(b=>b.textContent==='Installer maintenant'));
const modifier=(s,plus)=>s.page.evaluate(async plus=>{
  const sk=doc.sketches.find(k=>(k.dims||[]).some(d=>d.type!=='angle'&&!d.expr&&parDimUser(d)>2)),d=sk.dims.find(d=>d.type!=='angle'&&!d.expr&&parDimUser(d)>2);
  parSetDim(sk,d,String(+(parDimUser(d)+plus).toFixed(3)));await parAfterChange(false);
  return {sk:sk.id,cote:d.id,valeur:d.value,modifie:mffModified()};
},plus);
const valeur=(s,m)=>s.page.evaluate(({sk,cote})=>{const x=(doc.sketches||[]).find(k=>k.id===sk),d=x&&x.dims.find(y=>y.id===cote);return d?d.value:null;},m);
// La pièce d'essai est donnée par double-clic simulé : l'application la reçoit au démarrage.
async function ouvrirAvecPiece(f){
  toutFermer();
  for(let i=0;i<150;i++){try{if(!(await fetch('http://127.0.0.1:9333/json/version')).ok)break;}catch(e){break;}await C.attendre(100);}
  await C.attendre(1000);
  const enfant=spawn(EXE,[f],{env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:PILOTE},stdio:'ignore',detached:false});
  for(let i=0;i<300;i++){try{if((await fetch('http://127.0.0.1:9333/json/version')).ok)break;}catch(e){}await C.attendre(100);}
  const s=await C.brancher({cible:'app',enfant,t0:Date.now(),dossier:DONNEES});
  try{
    await s.page.waitForFunction(c=>{try{return !!fileHandle&&fileHandle.chemin===c&&occtReady===true&&rebuildDepth===0&&!regenRun&&!regenUi;}catch(e){return false;}},f,{timeout:90000,polling:100});
  }catch(e){
    const vu=await s.page.evaluate(()=>{try{return {titre:document.title,question:[...document.querySelectorAll('.mffDlg')].map(d=>d.textContent),chemin:fileHandle&&fileHandle.chemin,occt:occtReady,calcul:[rebuildDepth,regenRun,regenUi]};}catch(x){return String(x);}}).catch(x=>String(x));
    throw new Error('pièce non ouverte : '+JSON.stringify({vu,dialogues:s.dialogues,erreurs:s.erreurs}));
  }
  await C.attendre(2000);
  const c=await s.page.evaluate(()=>fileHandle&&fileHandle.chemin);
  if(!c||!c.toLowerCase().startsWith(ESSAI.toLowerCase()+path.sep))throw new Error('ARRÊT : fichier hors du dossier d’essai : '+c);
  return s;
}

(async()=>{
  if(fs.existsSync(DOSSIER)||assoc())throw new Error('déjà installé ou associé : essai annulé');
  if(ps('@(Get-Process ConceptCAD -ErrorAction SilentlyContinue).Count')!=='0')throw new Error('ConceptCAD est ouvert : essai annulé');
  const profilAvant=C.empreinteProfil();
  fs.mkdirSync(ESSAI,{recursive:true});
  fs.rmSync(DONNEES,{recursive:true,force:true});
  const setupA=path.join(ESSAI,'A.exe'),setupB=path.join(ESSAI,'B.exe');
  fabriquer(V_A,setupA);
  fabriquer(V_B,setupB);
  const sigB=fs.readFileSync(setupB+'.sig','utf8'),sigFausse=fausseSignature(setupB);
  etat.setup=setupB;
  const piece=path.join(ESSAI,'Pièce mise à jour.conceptcad');
  fs.copyFileSync(path.join(EX,'Cache Piles.conceptcad'),piece);
  await new Promise(k=>serveur.listen(PORT,'127.0.0.1',k));
  ps(`Start-Process -FilePath '${setupA}' -ArgumentList '/S' -Wait`);
  await C.attendre(1500);toutFermer();
  note('Version de départ installée',versionExe()===V_A,versionExe());

  // 1. Pas de réponse du serveur, comme sans Internet
  let s=await ouvrirAvecPiece(piece);
  serveur.closeAllConnections();
  await C.attendre(9000);
  note('Rien de publié ou pas d’Internet : aucune question, aucun message',etat.demandes>=1&&!(await aQuestion(s))&&s.dialogues.length===0&&s.erreurs.length===0,{demandes:etat.demandes,dialogues:s.dialogues,erreurs:s.erreurs});
  await C.arreter(s);

  // 2. Même version publiée
  etat.annonce=annonce(V_A,sigB);
  s=await ouvrirAvecPiece(piece);
  await C.attendre(9000);
  note('Même version publiée : aucune question',!(await aQuestion(s)));
  await C.arreter(s);

  // 3. « Plus tard »
  etat.annonce=annonce(V_B,sigB);
  s=await ouvrirAvecPiece(piece);
  await questionMaj(s);
  await cliquer(s,'Plus tard');
  await C.attendre(3000);
  note('« Plus tard » : rien de téléchargé, on continue',etat.telechargements===0&&versionExe()===V_A&&await s.page.evaluate(()=>!mffModified()&&!document.getElementById('majVoile')));

  // 4. Pièce modifiée, « Annuler » à la question d'enregistrement
  await C.arreter(s);
  s=await ouvrirAvecPiece(piece);
  await questionMaj(s);
  const m0=await modifier(s,0.25);
  await cliquer(s,'Installer maintenant');
  await s.page.waitForSelector('.mffDlg button:text-is("Annuler")',{timeout:15000});
  await cliquer(s,'Annuler');
  await C.attendre(1500);
  note('Pièce modifiée, « Annuler » : pas de mise à jour, la modification reste',etat.telechargements===0&&versionExe()===V_A&&await s.page.evaluate(()=>mffModified())&&Math.abs(await valeur(s,m0)-m0.valeur)<1e-9);
  await C.arreter(s);
  fs.copyFileSync(path.join(EX,'Cache Piles.conceptcad'),piece);

  // 5. Faux fichier : refusé, rien n'est installé, on peut continuer
  etat.annonce=annonce(V_B,sigFausse);
  s=await ouvrirAvecPiece(piece);
  await questionMaj(s);
  const dlg=s.dialogues.length;
  await cliquer(s,'Installer maintenant');
  for(let i=0;i<300&&s.dialogues.length===dlg;i++)await C.attendre(100);
  await C.attendre(800);
  const apresFaux=await s.page.evaluate(()=>({voile:!!document.getElementById('majVoile'),ver:APP_VER}));
  note('Fichier signé par quelqu’un d’autre : refusé, application toujours ouverte',etat.telechargements===1&&s.dialogues.slice(dlg).some(d=>/Mise à jour impossible/.test(d))&&!apresFaux.voile&&versionExe()===V_A&&processus()!=='0',{message:s.dialogues.slice(dlg),voile:apresFaux.voile});
  await C.arreter(s);

  // 6. La vraie mise à jour : pièce modifiée, « Enregistrer », fermeture, installation, réouverture
  etat.annonce=annonce(V_B,sigB);
  s=await ouvrirAvecPiece(piece);
  await questionMaj(s);
  const m=await modifier(s,0.5);
  await s.page.evaluate(()=>localStorage.setItem('essai-maj-reglage','garde'));
  await cliquer(s,'Installer maintenant');
  await s.page.waitForSelector('.mffDlg button:text-is("Enregistrer")',{timeout:15000});
  await cliquer(s,'Enregistrer');
  const t0=Date.now();
  try{await s.navigateur.close();}catch(e){}
  let v='';
  for(let i=0;i<600&&v!==V_B;i++){await C.attendre(200);try{v=versionExe();}catch(e){}}
  note('Version installée après la mise à jour',v===V_B,v);
  let titre='';
  for(let i=0;i<300&&!/mise à jour/.test(titre);i++){await C.attendre(200);try{titre=titreFenetre();}catch(e){}}
  await C.attendre(6000); // comme à chaque ouverture, le point « modifié » s'efface quand la pièce est relue
  const titreStable=titreFenetre();
  note('Se rouvre toute seule, sur la même pièce, non marquée modifiée',/mise à jour/.test(titre)&&!/●/.test(titreStable),{titre,titreStable,secondes:Math.round((Date.now()-t0)/1000)});
  note('Association .conceptcad conservée',assoc());
  ps(`Get-Process ${NOM} | Where-Object MainWindowTitle | ForEach-Object { [void]$_.CloseMainWindow() }`);
  for(let i=0;i<100&&processus()!=='0';i++)await C.attendre(200);
  note('Après la mise à jour, la croix ferme sans question : la pièce est bien enregistrée',processus()==='0',processus());
  toutFermer();
  await C.attendre(1500);

  // 7. Relecture dans la nouvelle version
  etat.annonce=annonce(V_B,sigB);
  s=await ouvrirAvecPiece(piece);
  const lu=await valeur(s,m);
  const reglage=await s.page.evaluate(()=>localStorage.getItem('essai-maj-reglage'));
  note('Cote enregistrée avant la mise à jour bien relue',lu!==null&&Math.abs(lu-m.valeur)<1e-9,{lu,attendu:m.valeur});
  note('Réglages locaux conservés',reglage==='garde',reglage);
  await C.attendre(7000);
  note('Déjà à jour : plus de question',!(await aQuestion(s))&&s.erreurs.length===0,s.erreurs);
  await C.arreter(s);
  toutFermer();

  // Remise en état
  ps(`Start-Process -FilePath '${DESINST}' -ArgumentList '/S' -Wait`);
  for(let i=0;i<60&&fs.existsSync(EXE);i++)await C.attendre(250);
  note('Désinstallé, association retirée',!fs.existsSync(EXE)&&!assoc());
  note('Vraies données de l’application intactes',JSON.stringify(profilAvant)===JSON.stringify(C.empreinteProfil()));
  const ko=bilan.filter(b=>!b.ok).length;
  console.log(ko?ko+' ÉCHEC(S)':'Tout est bon : '+bilan.length+' vérifications');
  fs.writeFileSync(path.join(__dirname,'resultats','mise-a-jour.json'),JSON.stringify(bilan,null,1));
  process.exitCode=ko?1:0;
})().catch(e=>{console.error('ARRÊT : '+(e&&e.stack||e));process.exitCode=1;}).finally(()=>{
  serveur.close();serveur.closeAllConnections();
  toutFermer();
  try{if(fs.existsSync(DESINST))ps(`Start-Process -FilePath '${DESINST}' -ArgumentList '/S' -Wait`);}catch(e){}
  try{fs.rmSync(DONNEES,{recursive:true,force:true});}catch(e){}
});
