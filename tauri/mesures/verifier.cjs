// Vérifie le fonctionnement de l'application : noyau, calcul de fond, fichiers, double-clic.
//   node tauri/mesures/verifier.cjs <dossier d'essai vide>
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const {execFileSync,spawnSync}=require('child_process');
const C=require('./commun.cjs');
const ESSAI=path.resolve(process.argv[2]);
const EX=path.join(__dirname,'..','..','Exemples');
const PS=path.join(__dirname,'fenetre-windows.ps1');
const SORTIE=path.join(__dirname,'resultats');
fs.mkdirSync(SORTIE,{recursive:true});
fs.mkdirSync(ESSAI,{recursive:true});
const bilan=[];
const note=(nom,ok,detail)=>{bilan.push({nom,ok,detail});console.log((ok?'OK   ':'ÉCHEC ')+nom+(detail!==undefined?' : '+JSON.stringify(detail):''));};
const fenetre=(pid,args)=>{
  const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',PS,'-AppId',String(pid),...args],{encoding:'utf8',timeout:40000});
  return (r.stdout||'').trim();
};
// Le processus qui ouvre les fenêtres est le programme lui-même.
const lireProjet=f=>{let b=fs.readFileSync(f);const gz=b[0]===0x1f;if(gz)b=zlib.gunzipSync(b);const o=JSON.parse(b.toString());return {gz,o,d:o.doc||o};};
const titre=pid=>execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${pid}).MainWindowTitle`],{encoding:'utf8'}).trim();
// Garde-fou : une vraie fenêtre reste à l'écran, quelqu'un peut y choisir un autre fichier. On s'arrête
// avant d'écrire si le fichier ouvert n'est pas dans le dossier d'essai (incident Axe du 05/11).
const garde=async s=>{const c=await s.page.evaluate(()=>fileHandle&&fileHandle.chemin);if(!c||!c.toLowerCase().startsWith(ESSAI.toLowerCase()+path.sep))throw new Error('ARRÊT : fichier hors du dossier d’essai : '+c);};
const attendreQue=async(s,fn,arg,ms=120000)=>s.page.waitForFunction(fn,arg,{timeout:ms,polling:100});

async function noyauEtCalcul(){
  const s=await C.lancer('app');
  try{
    const reseau=[];
    s.page.on('request',r=>reseau.push(r.url()));
    await s.page.reload();
    await C.noyauPret(s);
    const info=await s.page.evaluate(()=>({ver:APP_VER,pret:occtReady,origine:location.origin,msg:typeof occBaseMsg==='string'?occBaseMsg:'',sur:isSecureContext,tas:Math.round((occt.HEAP8||occt.HEAPU8).buffer.byteLength/1048576)}));
    const mt=await s.page.evaluate(()=>({isolee:self.crossOriginIsolated,fils:occtMtFils,avis:occtMtAvis}));
    note('Noyau multicœur choisi tout seul (4 fils)',mt.isolee===true&&mt.fils===4,mt);
    note('Noyau OCCT 8 compilé dans WebView2',info.pret===true,info);
    const dehors=reseau.filter(u=>!/^(http:\/\/tauri\.localhost|ipc:|blob:|data:|http:\/\/ipc\.localhost)/.test(u));
    note('Aucune demande vers Internet au démarrage',dehors.length===0,{demandes:reseau.length,dehors});
    await C.ouvrirPiece(s,path.join(EX,'Cache Piles.conceptcad'));
    const w=await s.page.evaluate(async()=>{
      const att=ms=>new Promise(k=>setTimeout(k,ms));
      const essais=[];
      for(let i=0;i<12;i++){
        while(rebuildDepth!==0||regenRun||regenUi)await att(50);
        const b=bodies.find(x=>x.kind==='body'&&x.shape); // à relire : la fin d'un calcul relance le rejeu
        const h=occFaceAt(b.shape,i);if(!h)break;
        const cle='essai'+i,t=performance.now();
        const a=delWkAsk(cle,b.shape,[h],'essaiF'+i,'');
        const me=delWk;
        while(!(delWkRes.get(cle)&&delWkRes.get(cle).st==='fin')&&performance.now()-t<90000)await att(50);
        const e=delWkRes.get(cle)||{};
        essais.push({face:i,ms:Math.round(performance.now()-t),kept:e.kept,err:e.err?String(e.err).slice(0,80):null,brep:e.brep?e.brep.length:0});
        if(e.kept>0&&e.brep)break;
      }
      return {pret:!!(delWk&&delWk.ready),hs:delWkOff||null,essais};
    }).catch(e=>({erreur:String(e)}));
    const dernier=w.essais&&w.essais[w.essais.length-1];
    note('Calcul de fond (suppression de face) dans son worker',!!(w.pret&&dernier&&dernier.brep>0),w);
    const rendu=await s.page.evaluate(async()=>{try{await rtLoad();return !!window.RDPT;}catch(e){return String(e);}});
    note('Bibliothèque de rendu chargée',rendu===true,rendu);
    const gl=await s.page.evaluate(()=>{const g=document.createElement('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return g.getParameter(e.UNMASKED_RENDERER_WEBGL);});
    note('Carte graphique utilisée par la 3D',/NVIDIA/i.test(gl),gl);
    const lieu=await s.page.evaluate(async()=>{const e=await navigator.storage.estimate();return {quotaGo:Math.round(e.quota/1073741824),persiste:await navigator.storage.persisted(),demande:await navigator.storage.persist()};});
    note('Stockage local : place disponible',lieu.quotaGo>1,lieu);
    await s.page.screenshot({path:path.join(SORTIE,'application-cache-piles.png')});
    note('Aucune erreur de page',s.erreurs.length===0,s.erreurs);
    note('Aucun message inattendu',s.dialogues.length===0,s.dialogues);
  }finally{await C.arreter(s);}
}

async function fichiers(){
  const f0=path.join(ESSAI,'Pièce d’essai é.conceptcad');
  fs.copyFileSync(path.join(EX,'Cache Piles.conceptcad'),f0);
  const s=await C.lancer('app');
  const pid=s.enfant.pid;
  try{
    await C.noyauPret(s);
    // Ouvrir
    await s.page.evaluate(()=>{window.__o=mffOpen();});
    const v1=fenetre(pid,['-Chemin',f0]);
    if(!/OK/.test(v1))throw new Error('fenêtre Ouvrir : '+v1);
    await attendreQue(s,()=>typeof mffName==='string'&&mffName.length>0&&doc.features.length>0&&rebuildDepth===0&&!regenRun&&!regenUi);
    const lien=await s.page.evaluate(()=>({nom:mffName,chemin:fileHandle&&fileHandle.chemin,fct:doc.features.length}));
    note('Ouvrir : vraie fenêtre Windows',/OK/.test(v1)&&lien.chemin===f0,{fenetre:v1,lien});
    await garde(s);
    await C.attendre(2000);
    // Enregistrer : réécrit le même fichier, sans fenêtre ni question
    const avant=fs.statSync(f0).mtimeMs;
    const r=await s.page.evaluate(async()=>{
      const sk=doc.sketches.find(k=>(k.dims||[]).some(d=>d.type!=='angle'&&!d.expr&&parDimUser(d)>2)),d=sk.dims.find(d=>d.type!=='angle'&&!d.expr&&parDimUser(d)>2);
      const nv=+(parDimUser(d)+0.25).toFixed(3);
      const set=parSetDim(sk,d,String(nv));await parAfterChange(false);
      const ok=await mffSave();
      return {set,ok,sk:sk.id,cote:d.id,valeur:d.value,modifie:mffModified(),msg:faceEl.textContent};
    });
    const relu=lireProjet(f0),dd=(relu.d.sketches.find(k=>k.id===r.sk).dims||[]).find(x=>x.id===r.cote);
    note('Enregistrer : même fichier, sans fenêtre, compressé, relu juste',r.ok===true&&relu.gz&&Math.abs(dd.value-r.valeur)<1e-9&&fs.statSync(f0).mtimeMs>avant&&!fs.existsSync(f0+'.ecriture'),{r,gz:relu.gz});
    note('Titre de la fenêtre suit le fichier',/essai/.test(titre(pid)),titre(pid));
    // Enregistrer sous, nom tapé sans extension
    const f1=path.join(ESSAI,'copie enregistrée');
    await s.page.evaluate(()=>{window.__s=mffSaveAs();});
    const v2=fenetre(pid,['-Chemin',f1]);
    const ok2=await s.page.evaluate(()=>window.__s);
    const f1x=f1+'.conceptcad';
    await garde(s);
    note('Enregistrer sous : vraie fenêtre Windows',/OK/.test(v2)&&ok2===true&&fs.existsSync(f1x)&&lireProjet(f1x).d.features.length>0,{fenetre:v2,ok2,fichier:fs.existsSync(f1x)});
    // Annuler une fenêtre : rien ne change
    await s.page.evaluate(()=>{window.__s=mffSaveAs();});
    const v3=fenetre(pid,['-Annuler']);
    note('Annuler « Enregistrer sous » : rien ne change',(await s.page.evaluate(()=>window.__s))===false,v3);
    // Récents : le lien survit au rangement
    const rec=await s.page.evaluate(async()=>{const l=await mffRecentList();const f=l.length?await l[0].h.getFile():null;return {n:l.length,nom:l[0]&&l[0].name,taille:f&&f.size};});
    note('Fichiers récents relus',rec.n>=2&&rec.taille>0,rec);
    // Dossier de projets + copie .bak à côté du fichier
    // La fenêtre s'ouvre sur le dossier du fichier courant et « Sélectionner » le prend tel quel.
    await s.page.evaluate(()=>{window.__d=window.showDirectoryPicker({startIn:fileHandle});});
    const v4=fenetre(pid,['-Chemin','']);
    const dos=await s.page.evaluate(async()=>{const h=await window.__d;const l=[];if(h)for await(const [n,x] of h.entries())l.push(n);return {nom:h&&h.name,chemin:h&&h.chemin,l};});
    if(String(dos.chemin).toLowerCase()!==ESSAI.toLowerCase())throw new Error('ARRÊT : dossier choisi hors essai : '+dos.chemin);
    await s.page.evaluate(async()=>{mffFolder=await window.__d;await idbSet('mff:folder',mffFolder);});
    note('Dossier de projets : vraie fenêtre Windows et liste',dos.l.length>=2,{fenetre:v4,dos});
    await garde(s);
    const r3=await s.page.evaluate(async()=>{
      const sk=doc.sketches.find(k=>(k.dims||[]).some(d=>d.type!=='angle'&&!d.expr&&parDimUser(d)>2)),d=sk.dims.find(d=>d.type!=='angle'&&!d.expr&&parDimUser(d)>2);
      parSetDim(sk,d,String(+(parDimUser(d)+0.1).toFixed(3)));await parAfterChange(false);
      const ok=await mffSave();return {ok,bak:mffLastBak};
    });
    note('Copie de secours .bak à côté du fichier',r3.ok&&fs.existsSync(f1x+'.bak'),r3);
    // Export (téléchargement remplacé par la vraie fenêtre)
    const f2=path.join(ESSAI,'export essai.nc');
    await s.page.evaluate(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['G0 X0\n']));a.download='piece.nc';a.click();});
    const v5=fenetre(pid,['-Chemin',f2]);
    await C.attendre(800);
    note('Export : vraie fenêtre Windows',/OK/.test(v5)&&fs.existsSync(f2)&&fs.readFileSync(f2,'utf8')==='G0 X0\n',v5);
    // Persistance avant fermeture
    await s.page.evaluate(async()=>{const big=new Uint8Array(30*1048576);for(let i=0;i<big.length;i+=4096)big[i]=i%251;await idbSet('essai-gros',big);await idbSet('faoMoves:essai',{v:1,mv:[1,2,3]});localStorage.setItem('essai-ls','oui');});
    await C.attendre(800);
    await garde(s);
    note('Fermeture normale par la croix',await C.fermer(s));
  }finally{await C.arreter(s);}
  // Redémarrage sans vider le profil : brouillon, récents, dossier, IndexedDB
  const s2=await C.lancer('app',{neuf:false});
  try{
    await C.noyauPret(s2);
    await C.attendre(1500);
    const p=await s2.page.evaluate(async()=>{
      const big=await idbGet('essai-gros'),l=await mffRecentList();
      await mffFolderLoad();
      let dossier=null;if(mffFolder){dossier=0;for await(const x of mffFolder.keys())dossier++;}
      return {gros:big&&big.length,fao:await idbGet('faoMoves:essai'),ls:localStorage.getItem('essai-ls'),recents:l.length,recent0:l[0]&&(await l[0].h.getFile()).size,dossier};
    });
    note('Après redémarrage : IndexedDB, réglages, récents, dossier conservés',p.gros===30*1048576&&p.ls==='oui'&&p.recents>=2&&p.recent0>0&&p.dossier>=2,p);
  }finally{await C.arreter(s2);}
  // Double-clic : Windows passe le chemin au programme
  const f3=path.join(ESSAI,'Pièce d’essai é.conceptcad');
  const s3=await C.lancer('app',{fichier:f3});
  try{
    await attendreQue(s3,()=>{try{return mffName.length>0&&doc.features.length>0&&rebuildDepth===0&&!regenRun&&!regenUi;}catch(e){return false;}});
    const o=await s3.page.evaluate(()=>({nom:mffName,chemin:fileHandle&&fileHandle.chemin}));
    note('Fichier reçu au démarrage (ce que fait le double-clic)',o.chemin===f3,o);
  }finally{await C.arreter(s3);}
  await association();
}

// Vrai double-clic : l'association est posée pour l'utilisateur, essayée, puis retirée.
async function association(){
  const ps=(cmd)=>execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',cmd],{encoding:'utf8',env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:C.PROFIL_APP}}).trim();
  const ASSO=path.join(__dirname,'..','associer.ps1');
  const choix=ps("(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.conceptcad\\UserChoice' -ErrorAction SilentlyContinue).ProgId");
  const avant=ps("Test-Path 'HKCU:\\Software\\Classes\\.conceptcad'");
  if(avant==='True'){note('Association : essai sauté, une association existe déjà',false);return;}
  const profilAvant=C.empreinteProfil();
  fs.rmSync(C.PROFIL_APP,{recursive:true,force:true});
  try{
    ps(`& '${ASSO}' -Exe '${C.EXE}'`);
    const lanceur=path.join(ESSAI,'double clic essai.conceptcad');
    fs.copyFileSync(path.join(EX,'Cache Piles.conceptcad'),lanceur);
    ps(`Start-Process -FilePath '${lanceur}'`);
    let vu='';
    for(let i=0;i<300&&!/double clic essai/.test(vu);i++){
      await C.attendre(200);
      vu=ps("Get-Process ConceptCAD -ErrorAction SilentlyContinue | ForEach-Object { $_.MainWindowTitle }");
    }
    note('Double-clic réel (association Windows)',/double clic essai/.test(vu),{titre:vu,choixPrecedent:choix||null});
  }catch(e){note('Double-clic réel (association Windows)',false,String(e));}
  finally{
    try{ps("Get-Process ConceptCAD -ErrorAction SilentlyContinue | Stop-Process -Force");}catch(e){}
    ps(`& '${ASSO}' -Retirer`);
    await C.attendre(1500);
    note('Vraies données de l’application intactes',C.empreinteProfil()===profilAvant);
    note('Association retirée, Windows comme avant',ps("Test-Path 'HKCU:\\Software\\Classes\\.conceptcad'")==='False');
  }
}

(async()=>{
  try{
    if(process.argv[3]==='association')await association();
    else{await noyauEtCalcul();await fichiers();}
  }
  catch(e){note('Interruption',false,String(e&&e.stack||e));}
  fs.writeFileSync(path.join(SORTIE,'verification.json'),JSON.stringify(bilan,null,1));
  const ko=bilan.filter(x=>!x.ok).length;
  console.log(ko?ko+' échec(s)':'Tout est bon');
  process.exit(ko?1:0);
})();
