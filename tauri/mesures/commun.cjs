// Outils communs des mesures : lancer l'application ou Chrome de la même façon, les piloter, lire
// la mémoire de TOUS leurs processus. Chaque lancement a son profil : pas de brouillon, pas d'extension.
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),crypto=require('crypto');
const {spawn,execFile,execFileSync}=require('child_process');
const {chromium}=require('playwright-core');

const ICI=__dirname,DIST=path.join(ICI,'..','dist');
const EXE=process.env.CC_EXE||path.join(ICI,'..','src-tauri','target','release','ConceptCAD.exe');
const CHROME='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
// Profil d'essai à part : le vrai profil de l'application (récents, brouillon) n'est jamais touché ni vidé.
const PROFIL_APP=path.join(os.tmpdir(),'cc-essai-application');
const PROFIL_REEL=path.join(process.env.LOCALAPPDATA,'fr.conceptcad.logiciel');
// Empreinte du vrai profil : les essais passant par Windows doivent le laisser intact.
const empreinteProfil=()=>{let n=0,t=0;const voir=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())voir(p);else{n++;t=Math.max(t,fs.statSync(p).mtimeMs);}}};try{voir(PROFIL_REEL);}catch(e){}return n+'/'+t;};
const PORT_CDP=9333,PORT_WEB=+process.env.CC_PORT_WEB||3000; // CC_PORT_WEB : autre port quand 3000 sert déjà aux essais d'une autre session
// Mêmes réglages des deux côtés : un onglet ou une fenêtre masquée ne doit pas fausser le temps.
const DRAPEAUX=['--remote-debugging-port='+PORT_CDP,'--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling'];
const attendre=ms=>new Promise(k=>setTimeout(k,ms));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.json':'application/json','.cjs':'application/octet-stream'};

// Page servie à Chrome : le ConceptCAD.html d'origine (sans pont) et les mêmes noyau et bibliothèques.
function serveur(htmlOrigine){
  return new Promise((ok,ko)=>{
    const s=http.createServer((rq,rs)=>{
      let p=decodeURIComponent(new URL(rq.url,'http://x').pathname);
      if(p==='/')p='/ConceptCAD.html';
      const f=p==='/ConceptCAD.html'?htmlOrigine:path.join(DIST,p);
      if(!f.startsWith(DIST)&&f!==htmlOrigine){rs.writeHead(403);return rs.end();}
      fs.stat(f,(e,st)=>{
        if(e||!st.isFile()){rs.writeHead(404);return rs.end();}
        const etag='"'+st.size+'-'+st.mtimeMs+'"';
        // comme « npx serve » : Chrome peut garder le noyau compilé dans son cache
        if(rq.headers['if-none-match']===etag){rs.writeHead(304,{ETag:etag});return rs.end();}
        const isole=process.env.CC_ISOLE?{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}:{};
        rs.writeHead(200,{...isole,'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Content-Length':st.size,ETag:etag});
        fs.createReadStream(f).pipe(rs);
      });
    });
    s.on('error',ko);
    s.listen(PORT_WEB,'127.0.0.1',()=>ok(s));
  });
}

async function cdpPret(){
  try{const r=await fetch('http://127.0.0.1:'+PORT_CDP+'/json/version');return r.ok;}catch(e){return false;}
}

// cible : 'app' ou 'chrome'. neuf : profil vidé avant. fichier : passé à l'application (double-clic).
async function lancer(cible,{neuf=true,fichier=null,profil=null,sansPilote=false}={}){
  if(await cdpPret())throw new Error('un programme occupe déjà le port de pilotage '+PORT_CDP);
  let enfant,dossier;
  if(cible==='app'){
    dossier=PROFIL_APP;
    if(neuf)fs.rmSync(dossier,{recursive:true,force:true});
    // Une application déjà ouverte recevrait le fichier d'essai dans sa fenêtre : on refuse.
    if(execFileSync('powershell.exe',['-NoProfile','-Command','@(Get-Process ConceptCAD -ErrorAction SilentlyContinue).Count'],{encoding:'utf8'}).trim()!=='0')throw new Error('ConceptCAD est déjà ouvert : essai annulé');
    const env={...process.env,WEBVIEW2_USER_DATA_FOLDER:dossier,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:DRAPEAUX.join(' ')};
    var t0=Date.now();
    enfant=spawn(EXE,fichier?[fichier]:[],{env,stdio:'ignore',detached:false});
  }else if(cible==='chrome'){
    dossier=profil||path.join(os.tmpdir(),'cc-mesure-chrome');
    if(neuf)fs.rmSync(dossier,{recursive:true,force:true});
    var t0=Date.now();
    enfant=spawn(CHROME,[...DRAPEAUX,'--user-data-dir='+dossier,'--no-first-run','--no-default-browser-check','--window-size=1416,939','--new-window','http://localhost:'+PORT_WEB+'/ConceptCAD.html'],{stdio:'ignore'});
  }else throw new Error('cible inconnue : '+cible);
  let essais=0;
  while(!(await cdpPret())){
    if(++essais>600)throw new Error(cible+' : pilotage indisponible');
    await attendre(50);
  }
  const s={cible,enfant,t0,dossier};
  // sansPilote : le canal est ouvert mais rien n'y est branché (relevé de RAM sans influence)
  return sansPilote?s:await brancher(s);
}

async function brancher(s){
  const {cible}=s;
  const navigateur=await chromium.connectOverCDP('http://127.0.0.1:'+PORT_CDP);
  let page=null;
  for(let i=0;i<400&&!page;i++){
    for(const c of navigateur.contexts())for(const p of c.pages())if(/ConceptCAD\.html|tauri\.localhost/.test(p.url()))page=p;
    if(!page)await attendre(50);
  }
  if(!page)throw new Error(cible+' : page introuvable');
  const dialogues=[];
  page.on('dialog',d=>{dialogues.push(d.message());d.dismiss().catch(()=>{});});
  const erreurs=[];
  page.on('pageerror',e=>erreurs.push(e.message));
  return Object.assign(s,{navigateur,page,dialogues,erreurs});
}

// Fermeture normale, comme la croix de la fenêtre (les données en attente sont écrites).
async function fermer(s){
  try{execFileSync('taskkill',['/PID',String(s.enfant.pid)],{stdio:'ignore'});}catch(e){}
  for(let i=0;i<150&&s.enfant.exitCode===null;i++)await attendre(100);
  const ferme=s.enfant.exitCode!==null;
  await arreter(s);
  return ferme;
}

async function arreter(s){
  try{if(s.navigateur)await s.navigateur.close();}catch(e){}
  try{execFileSync('taskkill',['/PID',String(s.enfant.pid),'/T','/F'],{stdio:'ignore'});}catch(e){}
  for(let i=0;i<100&&await cdpPret();i++)await attendre(100);
  await attendre(1000);
}

// Noyau prêt : le logiciel est utilisable. Renvoie le temps depuis le lancement.
async function noyauPret(s){
  await s.page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000,polling:100});
  const ms=Date.now()-s.t0;
  await s.page.waitForFunction(()=>!skEdit&&rebuildDepth===0,null,{timeout:60000});
  return ms;
}

const PS_MEM=`
$p=Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name
$m=Get-CimInstance Win32_PerfRawData_PerfProc_Process | Select-Object IDProcess,WorkingSetPrivate,WorkingSet,PrivateBytes
$g=@(); try{$g=Get-CimInstance Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory | Select-Object Name,DedicatedUsage,SharedUsage}catch{}
@{p=$p;m=$m;g=$g} | ConvertTo-Json -Depth 3 -Compress`;
function memoire(racine){
  return new Promise((ok,ko)=>{
    execFile('powershell.exe',['-NoProfile','-Command',PS_MEM],{maxBuffer:64e6},(e,sortie)=>{
      if(e)return ko(e);
      const d=JSON.parse(sortie),famille=new Set([racine]);
      for(let ajout=true;ajout;){ajout=false;for(const x of d.p)if(famille.has(x.ParentProcessId)&&!famille.has(x.ProcessId)){famille.add(x.ProcessId);ajout=true;}}
      const noms={};for(const x of d.p)if(famille.has(x.ProcessId))noms[x.Name]=(noms[x.Name]||0)+1;
      let prive=0,ws=0,engage=0,gpuDed=0,gpuPart=0;const detail=[];
      for(const x of d.m)if(famille.has(x.IDProcess)){prive+=+x.WorkingSetPrivate;ws+=+x.WorkingSet;engage+=+x.PrivateBytes;detail.push(Math.round(x.WorkingSetPrivate/1048576));}
      for(const x of d.g||[]){const q=/pid_(\d+)_/.exec(x.Name||'');if(q&&famille.has(+q[1])){gpuDed+=+x.DedicatedUsage;gpuPart+=+x.SharedUsage;}}
      const Mo=v=>Math.round(v/1048576);
      ok({prive:Mo(prive),ws:Mo(ws),engage:Mo(engage),gpuDed:Mo(gpuDed),gpuPart:Mo(gpuPart),processus:famille.size,noms,detail:detail.sort((a,b)=>b-a)});
    });
  });
}
// Trois relevés espacés : on garde le médian de la mémoire privée.
async function memoireStable(s,pause=3000){
  const l=[];
  for(let i=0;i<3;i++){l.push(await memoire(s.enfant.pid));if(i<2)await attendre(pause);}
  return l.sort((a,b)=>a.prive-b.prive)[1];
}

// Ouvre une pièce avec le code du logiciel, sans passer par une fenêtre : même chemin des deux côtés.
async function ouvrirPiece(s,fichier){
  const b64=fs.readFileSync(fichier).toString('base64'),nom=path.basename(fichier);
  return await s.page.evaluate(async({b64,nom})=>{
    const t=atob(b64),u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);
    const txt=await mffFileText(new Blob([u]));
    const d=performance.now();
    await mffLoadText(txt,nom,null);
    while(rebuildDepth!==0||regenRun||regenUi)await new Promise(k=>setTimeout(k,50));
    return Math.round(performance.now()-d);
  },{b64,nom},{timeout:600000});
}

const empreinte=f=>crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
module.exports={PROFIL_REEL,empreinteProfil,EXE,CHROME,PROFIL_APP,PORT_WEB,attendre,serveur,lancer,brancher,arreter,fermer,noyauPret,memoire,memoireStable,ouvrirPiece,empreinte};
