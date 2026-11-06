// Gestes propres à l'application : une seule fenêtre, question à la fermeture, reprise du dernier
// fichier, raccourcis, vrai calcul FAO comparé à Chrome. Ne travaille que sur des copies d'essai.
//   node tauri/mesures/application.cjs <dossier d'essai vide> [html servi à Chrome]
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {execFileSync,spawn,spawnSync}=require('child_process');
const C=require('./commun.cjs');
const ESSAI=path.resolve(process.argv[2]);
const HTML=path.resolve(process.argv[3]||path.join(__dirname,'..','..','ConceptCAD.html'));
const EX=path.join(__dirname,'..','..','Exemples');
const SORTIE=path.join(__dirname,'resultats');
fs.mkdirSync(ESSAI,{recursive:true});
const bilan=[];
const note=(nom,ok,detail)=>{bilan.push({nom,ok:!!ok,detail});console.log((ok?'OK   ':'ÉCHEC ')+nom+(detail!==undefined?' : '+JSON.stringify(detail):''));};
const copie=(ex,nom)=>{const f=path.join(ESSAI,nom+'.conceptcad');fs.copyFileSync(path.join(EX,ex+'.conceptcad'),f);return f;};
const pret=()=>{try{return occtReady===true&&rebuildDepth===0&&!regenRun&&!regenUi&&!skEdit;}catch(e){return false;}};
const attendreFichier=async(s,f)=>{
  await s.page.waitForFunction(c=>{try{return !!fileHandle&&fileHandle.chemin===c&&occtReady===true&&rebuildDepth===0&&!regenRun&&!regenUi;}catch(e){return false;}},f,{timeout:120000,polling:100});
  await C.attendre(2000); // l'empreinte « enregistré » est reprise 1,5 s après l'ouverture
};
// Garde-fou : jamais d'écriture hors du dossier d'essai.
const garde=async s=>{const c=await s.page.evaluate(()=>fileHandle&&fileHandle.chemin);if(!c||!c.toLowerCase().startsWith(ESSAI.toLowerCase()+path.sep))throw new Error('ARRÊT : fichier hors du dossier d’essai : '+c);};
const modifier=(s,plus=0.25)=>s.page.evaluate(async plus=>{
  const sk=doc.sketches.find(k=>(k.dims||[]).some(d=>d.type!=='angle'&&!d.expr&&parDimUser(d)>2)),d=sk.dims.find(d=>d.type!=='angle'&&!d.expr&&parDimUser(d)>2);
  parSetDim(sk,d,String(+(parDimUser(d)+plus).toFixed(3)));await parAfterChange(false);
  return {sk:sk.id,cote:d.id,valeur:d.value,modifie:mffModified()};
},plus);
const valeur=(s,m)=>s.page.evaluate(({sk,cote})=>{const x=(doc.sketches||[]).find(k=>k.id===sk),d=x&&x.dims.find(y=>y.id===cote);return d?d.value:null;},m);
const question=s=>s.page.waitForSelector('.mffDlg',{timeout:15000});
const repondre=async(s,texte)=>{await question(s);await s.page.click('.mffDlg button:text-is("'+texte+'")');};
const croix=s=>{try{execFileSync('taskkill',['/PID',String(s.enfant.pid)],{stdio:'ignore'});}catch(e){}};
const ferme=async(s,ms=20000)=>{for(let i=0;i<ms/100&&s.enfant.exitCode===null;i++)await C.attendre(100);return s.enfant.exitCode!==null;};
const env={...process.env,WEBVIEW2_USER_DATA_FOLDER:C.PROFIL_APP};
const secondLancement=f=>new Promise(ok=>{const p=spawn(C.EXE,[f],{env,stdio:'ignore'});const t=setTimeout(()=>ok(false),15000);p.on('exit',()=>{clearTimeout(t);ok(true);});});
const nbProgrammes=()=>+execFileSync('powershell.exe',['-NoProfile','-Command','@(Get-Process ConceptCAD -ErrorAction SilentlyContinue).Count'],{encoding:'utf8'}).trim();
const fenetreMessage=pid=>spawnSync('powershell.exe',['-NoProfile','-Command',`Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes;$c=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,${pid});$l=[System.Windows.Automation.AutomationElement]::RootElement.FindAll('Children',$c);$n=0;foreach($f in $l){if($f.Current.ClassName -eq '#32770'){$n++}};$n`],{encoding:'utf8'}).stdout.trim();

async function uneFenetre(){
  const A=copie('Cache Piles','Une fenêtre A'),B=copie('Axe','Une fenêtre B');
  const s=await C.lancer('app',{fichier:A});
  try{
    await attendreFichier(s,A);
    const seul=await secondLancement(B);
    await attendreFichier(s,B);
    note('Double-clic, application déjà ouverte : même fenêtre',seul&&nbProgrammes()===1,{secondLancementTermine:seul,programmes:nbProgrammes()});
    await garde(s);
    const m=await modifier(s);
    await secondLancement(A);
    await repondre(s,'Annuler');
    await C.attendre(800);
    const r=await s.page.evaluate(()=>({chemin:fileHandle.chemin,modifie:mffModified()}));
    note('Double-clic sur pièce modifiée : la question protège, « Annuler » garde tout',r.chemin===B&&r.modifie===true&&Math.abs(await valeur(s,m)-m.valeur)<1e-9,r);
    await secondLancement(A);
    await repondre(s,'Ne pas enregistrer');
    await attendreFichier(s,A);
    note('« Ne pas enregistrer » : la pièce demandée s’ouvre',true);
    note('Aucune erreur de page (une fenêtre)',s.erreurs.length===0,s.erreurs);
  }finally{await C.arreter(s);}
}

async function fermeture(){
  const F=copie('Cache Piles','Fermeture');
  const s=await C.lancer('app',{fichier:F});
  let m;
  try{
    await attendreFichier(s,F);
    await garde(s);
    m=await modifier(s);
    croix(s);
    await repondre(s,'Annuler');
    await C.attendre(1500);
    note('Croix, pièce modifiée, « Annuler » : rien ne ferme',s.enfant.exitCode===null&&Math.abs(await valeur(s,m)-m.valeur)<1e-9);
    const avant=fs.statSync(F).mtimeMs;
    await garde(s);
    croix(s);
    await repondre(s,'Enregistrer');
    const fin=await ferme(s);
    note('Croix, « Enregistrer » : fichier écrit, application fermée',fin&&fs.statSync(F).mtimeMs>avant,{fin});
  }finally{await C.arreter(s);}
  // La pièce revient depuis son fichier, sans « modifié »
  const s2=await C.lancer('app',{neuf:false});
  try{
    await attendreFichier(s2,F);
    const r=await s2.page.evaluate(()=>({chemin:fileHandle.chemin,modifie:mffModified(),titre:document.title}));
    note('Redémarrage : dernier fichier repris, non marqué modifié, avec la cote enregistrée',r.modifie===false&&Math.abs(await valeur(s2,m)-m.valeur)<1e-9,r);
    await garde(s2);
    var m2=await modifier(s2,0.5);
    const avant=fs.statSync(F).mtimeMs;
    croix(s2);
    await repondre(s2,'Ne pas enregistrer');
    const fin=await ferme(s2);
    note('Croix, « Ne pas enregistrer » : fichier intact, application fermée',fin&&fs.statSync(F).mtimeMs===avant,{fin});
  }finally{await C.arreter(s2);}
  const s3=await C.lancer('app',{neuf:false});
  try{
    await attendreFichier(s3,F);
    const r=await s3.page.evaluate(()=>mffModified());
    const v=await valeur(s3,m2);
    note('Modification refusée : elle ne revient pas',r===false&&Math.abs(v-m.valeur)<1e-9,{modifie:r,lu:v,attendu:m.valeur});
    croix(s3);
    const fin=await ferme(s3);
    note('Croix, pièce non modifiée : ferme sans question',fin);
  }finally{await C.arreter(s3);}
  // Arrêt brutal : le brouillon reste le filet
  const s4=await C.lancer('app',{neuf:false});
  let m4;
  try{
    await attendreFichier(s4,F);
    await garde(s4);
    m4=await modifier(s4,0.75);
    await C.attendre(70000); // WebView2 pose son stockage sur le disque jusqu’à une minute plus tard
  }finally{await C.arreter(s4);}
  const s5=await C.lancer('app',{neuf:false});
  try{
    await s5.page.waitForFunction(pret,null,{timeout:120000,polling:100});
    await C.attendre(2500);
    const v=await valeur(s5,m4);
    note('Arrêt brutal : le brouillon revient',v!==null&&Math.abs(v-m4.valeur)<1e-9,{lu:v,attendu:m4.valeur,titre:await s5.page.title()});
    // Logiciel bloqué par un calcul : on peut quand même sortir
    await s5.page.evaluate(()=>{setTimeout(()=>{const t=Date.now();while(Date.now()-t<11000);},0);});
    await C.attendre(300);
    croix(s5);
    await C.attendre(7500);
    note('Logiciel occupé : Windows propose de fermer quand même',fenetreMessage(s5.enfant.pid)==='1');
  }finally{await C.arreter(s5);}
}

async function gestes(){
  const F=copie('Cache Piles','Gestes');
  const s=await C.lancer('app',{fichier:F});
  try{
    await attendreFichier(s,F);
    await garde(s);
    await s.page.evaluate(()=>{window.__vus={};window.__repere=1;addEventListener('keydown',e=>{window.__vus[e.key.toLowerCase()]=e.defaultPrevented;});document.activeElement&&document.activeElement.blur&&document.activeElement.blur();});
    await s.page.keyboard.press('F5');
    await C.attendre(1500);
    note('F5 ne recharge plus la page',await s.page.evaluate(()=>window.__repere===1));
    await s.page.keyboard.press('Control+p');
    await s.page.keyboard.press('Control+f');
    const vus=await s.page.evaluate(()=>window.__vus);
    note('Ctrl+P et Ctrl+F : action du navigateur retirée',vus.p===true&&vus.f===true,vus);
    const m=await modifier(s);
    await C.attendre(1200);
    await s.page.keyboard.press('Control+z');
    await s.page.waitForFunction(pret,null,{timeout:60000,polling:100});
    const v1=await valeur(s,m);
    await s.page.keyboard.press('Control+y');
    await s.page.waitForFunction(pret,null,{timeout:60000,polling:100});
    const v2=await valeur(s,m);
    note('Ctrl+Z et Ctrl+Y',Math.abs(v1-m.valeur)>1e-6&&Math.abs(v2-m.valeur)<1e-9,{v1,v2,attendu:m.valeur});
    await garde(s);
    const avant=fs.statSync(F).mtimeMs;
    await s.page.keyboard.press('Control+s');
    for(let i=0;i<100&&fs.statSync(F).mtimeMs===avant;i++)await C.attendre(100);
    note('Ctrl+S enregistre sans fenêtre',fs.statSync(F).mtimeMs>avant);
    const menu=await s.page.evaluate(()=>{
      const clic=c=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});c.dispatchEvent(e);return e.defaultPrevented;};
      const i=document.createElement('input');document.body.appendChild(i);const champ=clic(i);i.remove();
      return {vue:clic(document.body),champ};
    });
    note('Clic droit : menu du navigateur retiré, gardé dans les champs',menu.vue===true&&menu.champ===false,menu);
    const n=s.dialogues.length;
    await s.page.evaluate(()=>prompt('Nom d’essai :','x'));
    note('Message de saisie (renommer, cote) affiché',s.dialogues.length===n+1&&s.dialogues[n]==='Nom d’essai :',s.dialogues.slice(n));
    note('Aucune erreur de page (gestes)',s.erreurs.length===0,s.erreurs);
  }finally{await C.arreter(s);}
}

// Vrai calcul de parcours, sans cache, et G-code : le résultat doit être identique à celui de Chrome.
const calculFAO=async s=>s.page.evaluate(async()=>{
  const t0=performance.now(),ops=[];
  faoOpMovesMap=new WeakMap();
  for(const j of faoRoot().setups||[])for(const o of j.ops||[]){
    o.stale=false;
    const t=performance.now(),mv=faoOpMoves(o,j);
    let h=2166136261;const txt=JSON.stringify(mv||[]);
    for(let i=0;i<txt.length;i++){h^=txt.charCodeAt(i);h=Math.imul(h,16777619);}
    ops.push({type:o.type,mouvements:mv?mv.length:0,ms:Math.round(performance.now()-t),empreinte:(h>>>0).toString(36)});
  }
  return {ms:Math.round(performance.now()-t0),ops};
},null,{timeout:600000});

// « Tout régénérer » réparti sur plusieurs cœurs (V0.66.0) : mêmes parcours que Chrome, sans repli.
const calculMulti=async s=>{
  const avis=[];s.page.on('console',m=>{if(/multicœur/.test(m.text()))avis.push(m.text());});
  await s.page.waitForFunction(()=>{try{return doc.features.length>0&&rebuildDepth===0&&builtEngine==='exact'&&bodies.some(b=>b.shape)&&faoSolidSettled();}catch(e){return false;}},null,{timeout:300000,polling:200});
  await C.attendre(1500);
  const r=await s.page.evaluate(async()=>{
    const N=window.Worker;let nb=0;window.Worker=function(u){nb++;return new N(u);};
    const job=faoDoc(),ops=(job.ops||[]).filter(o=>o&&o.on!==false),t0=performance.now();
    await faoPreviewGenerateAsync();
    const ms=Math.round(performance.now()-t0);
    window.Worker=N;
    return {ms,workers:nb,coeurs:faoWkNbCoeurs(),restants:faoWkActifs.length,parcours:ops.map(o=>{const h=faoOpMovesHit(o);return {id:o.id,type:o.type,n:h&&h.mv?h.mv.length:-1,mv:h&&h.mv?JSON.stringify(h.mv):''};})};
  },null,{timeout:900000});
  r.parcours.forEach(p=>{p.empreinte=crypto.createHash('sha1').update(p.mv).digest('hex').slice(0,10);delete p.mv;});
  return {...r,avis};
};

async function fao(){
  const F=copie('Poche et Contour','FAO'),G=copie('Cavité Test','FAO cœurs');
  let chromeMulti,appMulti;
  const srv=await C.serveur(HTML);
  let chrome,app;
  try{
    const c=await C.lancer('chrome');
    try{
      await C.noyauPret(c);
      await C.ouvrirPiece(c,F);
      await C.attendre(1500);
      chrome=await calculFAO(c);
      await C.ouvrirPiece(c,G);
      chromeMulti=await calculMulti(c);
    }finally{await C.arreter(c);}
  }finally{srv.close();}
  const s=await C.lancer('app',{fichier:F});
  try{
    await attendreFichier(s,F);
    app=await calculFAO(s);
    const pleins=app.ops.filter(o=>o.mouvements>0).length;
    const memes=app.ops.length===chrome.ops.length&&app.ops.every((o,i)=>o.empreinte===chrome.ops[i].empreinte);
    note('Vrai calcul FAO dans l’application, identique à Chrome',pleins===app.ops.length&&pleins>0&&memes,{app,chrome});
    await C.attendre(2500);
    const cache=await s.page.evaluate(async()=>{const k=await new Promise((ok,ko)=>{const r=indexedDB.databases?indexedDB.databases():null;ok(r);});return k&&k.length;});
    note('Base locale du cache de parcours présente',cache>=1,{bases:cache});
    note('Aucune erreur de page (FAO)',s.erreurs.length===0,s.erreurs);
  }finally{await C.arreter(s);}
  const s2=await C.lancer('app',{fichier:G});
  try{
    await attendreFichier(s2,G);
    appMulti=await calculMulti(s2);
    const sig=r=>JSON.stringify(r.parcours.map(p=>[p.id,p.n,p.empreinte]));
    note('Tout régénérer sur plusieurs cœurs, identique à Chrome',appMulti.workers>1&&appMulti.restants===0&&!appMulti.avis.length&&appMulti.parcours.every(p=>p.n>0)&&sig(appMulti)===sig(chromeMulti),{app:appMulti,chrome:chromeMulti});
    note('Aucune erreur de page (plusieurs cœurs)',s2.erreurs.length===0,s2.erreurs);
  }finally{await C.arreter(s2);}
}

(async()=>{
  for(const [nom,f] of [['une fenêtre',uneFenetre],['fermeture',fermeture],['gestes',gestes],['FAO',fao]]){
    try{await f();}catch(e){note('Interruption : '+nom,false,String(e&&e.stack||e).slice(0,600));}
  }
  fs.writeFileSync(path.join(SORTIE,'application.json'),JSON.stringify(bilan,null,1));
  const ko=bilan.filter(x=>!x.ok).length;
  console.log(ko?ko+' échec(s) sur '+bilan.length:'Tout est bon : '+bilan.length+' vérifications');
  process.exit(ko?1:0);
})();
