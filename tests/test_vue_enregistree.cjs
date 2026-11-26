// V1.0.7 : la vue 3D est enregistrée dans le fichier et revient à l'ouverture (demande de Fred :
// « Quand je sauvegarde le modèle, j'aimerais qu'à la prochaine ouverture, le modèle retrouve sa
// position sauvegardée »). 10-scene-3d viewCamGet / viewCamRead / viewSavedTake / viewFitAll ;
// 90-50 bundleSerialise (cam) et bundleRestore (viewSaved). Caméra et cible concrètes dans le
// harnais ; pièce vide : le recadrage ordinaire met la caméra en (90,-90,90) vers l'origine.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
const fs=require('fs'),path=require('path');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    confirm=function(){return true;};alert=function(m){p("alerte : "+m);};
    const C0=camera||new THREE.PerspectiveCamera(),K0=controls||new THREE.OrbitControls();
    const concret=(base,own)=>new Proxy(own,{get:(t,k)=>k in t?t[k]:base[k]}); // propriétés réelles, le reste du harnais
    camera=concret(C0,{position:new THREE.Vector3(1,1,1),up:new THREE.Vector3(0,0,1),lookAt(){}});
    controls=concret(K0,{target:new THREE.Vector3(),update(){}});
    viewControlsRebuild=function(){}; // harnais : pas de vraies commandes d orbite à refaire (le navigateur reprend la cible)
    const V=(x,y,z)=>new THREE.Vector3(x,y,z);
    const place=(pp,tt)=>{camera.position.set(pp[0],pp[1],pp[2]);controls.target.set(tt[0],tt[1],tt[2]);};
    const est=(pp,tt)=>Math.hypot(camera.position.x-pp[0],camera.position.y-pp[1],camera.position.z-pp[2])<1e-6
      &&Math.hypot(controls.target.x-tt[0],controls.target.y-tt[1],controls.target.z-tt[2])<1e-6;
    const SAUVE=[120,-80,60],VISE=[5,6,7],FIT=[90,-90,90],O=[0,0,0];
    // comme mffLoadText (97) : relecture du fichier puis recadrage de l'ouverture
    const ouvrir=async t=>{place([1,2,3],O);viewUserMoved=true;await bundleRestore(t,{name:'Essai vue',rebuild:false});try{showAll();}catch(e){}};
    // ── 1. enregistrer : la vue part dans le fichier ──
    docResetEmpty();doc.name='Essai vue';
    place(SAUVE,VISE);camera.up.set(0,0,1);
    const txt=await mffData();const B=JSON.parse(txt);
    att(B.cam&&B.cam.p.join()===SAUVE.join()&&B.cam.t.join()===VISE.join()&&B.cam.up.join()==='0,0,1','1 : vue enregistrée dans le fichier ('+JSON.stringify(B.cam)+')');
    att(B.cam&&B.cam.ctx===viewCtxKey(),'2 : avec le composant affiché');
    // ── 2. tourner la vue ne compte pas comme une modification (pas de ●) ──
    const s1=mffSig();place([7,7,7],O);const s2=mffSig();
    att(s1===s2,'3 : la vue ne change pas l empreinte du document');
    // ── 3. rouvrir : la vue revient, et reste pendant les recadrages de l'ouverture ──
    await ouvrir(txt);
    att(est(SAUVE,VISE),'4 : rouvert : la caméra retrouve sa place ('+[camera.position.x,camera.position.y,camera.position.z]+')');
    att(viewUserMoved===false,'5 : vue pas encore touchée après l ouverture');
    showAll();
    att(est(SAUVE,VISE),'6 : recadrage automatique suivant (rejeu exact, image) : la vue enregistrée reste');
    asmFit();
    att(est(SAUVE,VISE),'7 : recadrage de l assemblage : la vue enregistrée reste');
    // ── 4. l'utilisateur bouge la vue : les recadrages suivants redeviennent ordinaires ──
    viewUserMoved=true;place([9,9,9],O);showAll();
    att(est(FIT,O)&&viewSaved===null,'8 : vue bougée à la souris : plus de retour à la vue enregistrée');
    // ── 5. cube de vue / esquisse : caméra changée sans la souris ──
    await ouvrir(txt);place([0,-300,0],VISE);showAll();
    att(est(FIT,O)&&viewSaved===null,'9 : caméra changée depuis la remise : vue enregistrée oubliée');
    await ouvrir(txt);try{setView('front');}catch(e){}
    att(viewSaved===null,'10 : vue de face choisie : vue enregistrée oubliée');
    // ── 6. Recadrer / Tout afficher, Nouveau ──
    await ouvrir(txt);viewFitAll();
    att(est(FIT,O)&&viewSaved===null,'11 : « Recadrer » cadre toute la pièce');
    await ouvrir(txt);docResetEmpty();
    att(viewSaved===null,'12 : Nouveau / autre fichier : vue oubliée');
    // ── 7. autre composant affiché : pas la même vue ──
    await ouvrir(txt);viewSaved.ctx='autre|composant';showAll();
    att(est(FIT,O)&&viewSaved===null,'13 : autre composant affiché après la remise : recadrage ordinaire, vue oubliée');
    // pendant l'ouverture (MERLIN-39-000 en mode Assembler : passage par Modéliser avant) : la vue attend
    viewSaved=viewCamRead({p:SAUVE,t:VISE,ctx:'pas encore'});viewUserMoved=false;showAll();
    att(est(FIT,O)&&viewSaved&&!viewSaved.mis,'13b : composant ou mode pas encore revenu : recadrage ordinaire, la vue attend');
    viewSaved.ctx=viewCtxKey();asmFit();
    att(est(SAUVE,VISE),'13c : composant et mode revenus : la vue enregistrée est remise');
    // ── 8. anciens fichiers et vues abîmées ──
    const sans=JSON.parse(txt);delete sans.cam;
    await ouvrir(JSON.stringify(sans));
    att(est(FIT,O),'14 : fichier sans vue (avant V1.0.7) : recadrage ordinaire');
    const bad=[{p:[1,2,'x'],t:[0,0,0]},{p:[1,2,3],t:[1,2,3]},{p:[1,2],t:[0,0,0]},{p:[null,0,0],t:[0,0,0]},'n importe quoi',{p:[1e400,0,0],t:[0,0,0]}];
    for(const c of bad){const b=JSON.parse(txt);b.cam=c;await ouvrir(JSON.stringify(b));
      att(est(FIT,O)&&viewSaved===null,'15 : vue abîmée ignorée : '+JSON.stringify(c));}
    const b2=JSON.parse(txt);b2.cam.up=[0,0,0];await ouvrir(JSON.stringify(b2));
    att(est(SAUVE,VISE)&&Math.abs(camera.up.z-1)<1e-9,'16 : verticale abîmée : vue gardée, verticale par défaut');
    // ── 9. enregistré pendant une esquisse : la vue 3D d'avant l'esquisse ──
    skEdit={id:'s'};_skPrevCam={pos:V(10,20,30),target:V(1,1,1),up:V(0,0,1),rot:true};place([0,0,500],O);
    const ce=viewCamGet();skEdit=null;_skPrevCam=null;
    att(ce&&ce.p.join()==='10,20,30'&&ce.t.join()==='1,1,1','17 : esquisse ouverte : la vue 3D d avant l esquisse est enregistrée');
    // ── 10. ancien comportement rejoué : l'essai 4 échoue ──
    const take0=viewSavedTake;viewSavedTake=function(){return false;};
    await ouvrir(txt);const avant=est(SAUVE,VISE);viewSavedTake=take0;
    att(!avant,'18 : (contrôle : sans la remise, la vue ne revenait pas)');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'vue_enregistree.js'});
  // textes : chaque import et chaque « Tout afficher » oublient la vue enregistrée
  const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
  const T=[];
  if((src('90-30-import.js').match(/viewSaved=null/g)||[]).length!==3)T.push('  x 19 : les trois imports (réimport, STL, STEP/IGES) oublient la vue');
  if(!/\$\('btnFit'\)\.onclick=\(\)=>viewFitAll\(\)/.test(src('95-toolbar.js')))T.push('  x 20 : bouton Recadrer → viewFitAll');
  if(!/Tout afficher',\(\)=>viewFitAll\(\)/.test(src('40-50-panneau-proprietes.js')))T.push('  x 21 : « Tout afficher » du corps → viewFitAll');
  const out=r+(T.length?'\nECHECS (textes) :\n'+T.join('\n'):'');
  console.log(out);
  process.exit(/ECHECS|  x /.test(out)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
