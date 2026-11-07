// Mac à Safari ancien, simulé sous Windows : la page perd la compression du navigateur, le pont doit
// alors passer par l'application. Pièce venue de Windows, enregistrement, relecture, fichier coupé.
//   node tauri/mesures/compression-sans-safari.cjs <dossier d'essai vide>
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const {spawn}=require('child_process');
const C=require('./commun.cjs');
const ESSAI=path.resolve(process.argv[2]);
const EX=path.join(__dirname,'..','..','Exemples');
fs.mkdirSync(ESSAI,{recursive:true});
const bilan=[];
const note=(nom,ok,detail)=>{bilan.push({nom,ok:!!ok,detail});console.log((ok?'OK   ':'ÉCHEC ')+nom+(detail!==undefined?' : '+JSON.stringify(detail):''));};
const env={...process.env,WEBVIEW2_USER_DATA_FOLDER:C.PROFIL_APP};
const ouvrir=f=>new Promise(ok=>{const p=spawn(C.EXE,[f],{env,stdio:'ignore'});const t=setTimeout(()=>ok(false),15000);p.on('exit',()=>{clearTimeout(t);ok(true);});});
const attendreFichier=async(s,f)=>{
  await s.page.waitForFunction(c=>{try{return !!fileHandle&&fileHandle.chemin===c&&occtReady===true&&rebuildDepth===0&&!regenRun&&!regenUi;}catch(e){return false;}},f,{timeout:120000,polling:100});
  await C.attendre(2000);
};
const nature=f=>{const b=fs.readFileSync(f);return {octets:b.length,gzip:b[0]===0x1f&&b[1]===0x8b};};

(async()=>{
  const A=path.join(ESSAI,'Venue de Windows.conceptcad');
  const COUPE=path.join(ESSAI,'Coupee.conceptcad');
  fs.copyFileSync(path.join(EX,'Griffe.conceptcad'),A);
  const entier=fs.readFileSync(A);
  if(entier[0]!==0x1f||entier[1]!==0x8b)throw new Error('la pièce d’essai n’est pas compressée');
  fs.writeFileSync(COUPE,entier.subarray(0,Math.floor(entier.length/2)));

  const s=await C.lancer('app');
  try{
    await s.page.addInitScript(()=>{delete window.CompressionStream;delete window.DecompressionStream;});
    await s.page.reload();
    await C.noyauPret(s);
    const pont=await s.page.evaluate(()=>({comp:/invoke|morceaux/.test(String(window.CompressionStream)),decomp:/invoke|morceaux/.test(String(window.DecompressionStream))}));
    note('Compression du navigateur retirée, celle de l’application prend le relais',pont.comp&&pont.decomp,pont);

    await ouvrir(A);
    await attendreFichier(s,A);
    const lu=await s.page.evaluate(()=>({corps:(doc.features||[]).length,nom:mffName}));
    note('Pièce compressée sous Windows : elle s’ouvre',lu.corps>0&&s.dialogues.length===0,{...lu,messages:s.dialogues});

    const texte=await s.page.evaluate(async()=>{await mffWrite(fileHandle);return await mffData();});
    await C.attendre(500);
    const n=nature(A);
    let contenu='';try{contenu=zlib.gunzipSync(fs.readFileSync(A)).toString('utf8');}catch(e){contenu='';}
    note('Enregistrement : fichier compressé, lisible par un autre logiciel',n.gzip&&contenu.length>n.octets&&contenu.length>0,{...n,texte:contenu.length,attendu:texte&&texte.length});

    await ouvrir(COUPE);
    await s.page.waitForFunction(()=>true);
    for(let i=0;i<100&&!s.dialogues.length;i++)await C.attendre(100);
    const reste=await s.page.evaluate(()=>fileHandle&&fileHandle.chemin);
    note('Fichier coupé : refusé avec un message, la pièce ouverte reste',/compression illisible/.test(s.dialogues.join(' '))&&reste===A,{messages:s.dialogues,reste});

    note('Aucune erreur de page',s.erreurs.length===0,s.erreurs);
  }finally{await C.arreter(s);}

  // Relecture dans une application neuve, compression du navigateur retirée à nouveau
  const r=await C.lancer('app');
  try{
    await r.page.addInitScript(()=>{delete window.CompressionStream;delete window.DecompressionStream;});
    await r.page.reload();
    await C.noyauPret(r);
    await ouvrir(A);
    await attendreFichier(r,A);
    const m=await r.page.evaluate(()=>({corps:(doc.features||[]).length,modifie:mffModified()}));
    note('Fichier enregistré de cette façon : il se rouvre',m.corps>0&&r.dialogues.length===0,{...m,messages:r.dialogues});
  }finally{await C.arreter(r);}

  const faux=bilan.filter(x=>!x.ok).length;
  console.log(faux?faux+' ÉCHEC(S)':'Tout est bon : '+bilan.length+' vérifications');
  process.exit(faux?1:0);
})().catch(e=>{console.error('ARRÊT : '+(e&&e.stack||e));process.exit(2);});
