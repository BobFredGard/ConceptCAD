// V0.99.34 : règle supprimée à la demande de Fred — la pièce est centrée sur toute la vue,
// bandeaux ou pas (viewMidOffset retirée ; viewCenterShift ne fait plus que retirer un décalage).
// Historique — V0.2.5 : le CENTRE de rotation de la vue 3D suit la zone VISIBLE du grand
// panneau — entre le bandeau vertical de gauche (arborescence des corps, panneau
// Usinage en moderne FAO) et les overlays de droite (barre + panneau FAO en
// classique). Sans ça, le pivot d'orbite reste au centre du CANVAS : la pièce
// est excentrée et « fuit » en orbite dès qu'un bandeau est déplié.
// Suite : mesure PURE (viewMidOffset) + application (viewCenterShift via
// setViewOffset, no-op silencieux si la caméra du harnais n'a pas la méthode) +
// appels branchés aux points de changement (fit, repli arbre, repli FAO, espace).
const fs=require('fs'),path=require('path'),vm=require('vm');
const {loadApp}=require('./appvm.cjs');
const APP=path.join(__dirname,'..','ConceptCAD.html');
const SRC=fs.readFileSync(APP,'utf8');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const faoSrc=fs.readdirSync(path.join(__dirname,'..','src'))
  .filter(f=>/^88-fao-.*\.js$/.test(f)).sort().map(src).join('\n');
const S={s10:src('10-scene-3d.js'),s95:src('95-toolbar.js'),s88:faoSrc,s97:src('97-interface-moderne.js')};
const hasSrc=s=>SRC.indexOf(s)>=0;
const str=v=>JSON.stringify(v);
const HOST=[
];

const b=[
"  return new Promise(function(REZ){",
"  const P=[],ATT=[];",
"  const p=s=>P.push(String(s));",
"  const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
"  const fin=function(){",
"    if(ATT.length){p('');p('ÉCHECS ('+ATT.length+') :');ATT.forEach(function(m){p('  ✗ '+m);});}",
"    else{p('');p('TOUT EST CONFORME');}",
"    REZ(P.join('\\n'));",
"  };",
// --- A) contrat source : la mesure et son application existent, branchées partout ---
"  const seg=function(s,fn){const i=s.indexOf('function '+fn);if(i<0)return '';const j=s.indexOf('\\nfunction ',i+1);return s.slice(i,j<0?undefined:j);};",
"  att(!/function viewMidOffset/.test("+str(S.s10)+"),'src/10 : viewMidOffset doit avoir disparu (V0.99.34)');",
"  att(!/setViewOffset/.test(seg("+str(S.s10)+",'viewCenterShift')),'src/10 : viewCenterShift ne décale plus la projection');",
"  att(/clearViewOffset/.test(seg("+str(S.s10)+",'viewCenterShift')),'src/10 : viewCenterShift retire un ancien décalage');",
"  att(/function viewCenterShift/.test("+str(S.s10)+"),'src/10 : viewCenterShift absente');",
"  att(seg("+str(S.s10)+",'fit').indexOf('viewCenterShift')>=0,'src/10 : fit() applique le décalage');",
"  att(seg("+str(S.s95)+",'treeFoldSet').indexOf('viewCenterShift')>=0,'src/95 : treeFoldSet applique le décalage');",
"  att(seg("+str(S.s88)+",'faoFoldSet').indexOf('viewCenterShift')>=0,'src/88 : faoFoldSet applique le décalage');",
"  att(seg("+str(S.s97)+",'mfWs').indexOf('viewCenterShift')>=0,'src/97 : mfWs applique le décalage');",
// V0.21.5 : pendant une fonction (congé, dépouille, coque), l'aperçu remplace la pièce : il compte pour le point sous la souris
"  att(/b\\.preview/.test(seg("+str(S.s10)+",'viewHitAt'))&&/Mesh\\.prototype\\.raycast\\.call/.test(seg("+str(S.s10)+",'viewHitAt')),'src/10 : viewHitAt vise aussi l\\'aperçu d\\'une fonction (raycast lancé à la main)');",
// --- B) géométrie mesurée : rectangles substitués au cas par cas (harnais) ---
"  const VP=document.getElementById('vpwrap');VP.clientWidth=1000;VP.clientHeight=600;",
"  VP.getBoundingClientRect=function(){return{left:0,top:0,right:1000,bottom:600,width:1000,height:600};};",
// B) V0.99.34 : la règle de centrage entre bandeaux (viewMidOffset) est supprimée — voir en-tête
// --- C) application : viewCenterShift ne doit JAMAIS lever sous harnais (caméra stub) ---
"  {try{viewCenterShift();att(true,'s7 viewCenterShift sans setViewOffset (harnais) : no-op silencieux');}catch(e){att(false,'s7 viewCenterShift a levé : '+((e&&e.message)||e));}}",
"  {skEdit={points:{},entities:[],seq:1};try{viewCenterShift();att(true,'s8 viewCenterShift pendant esquisse : sans effet');}catch(e){att(false,'s8 a levé : '+((e&&e.message)||e));}skEdit=null;}",
// --- D) repères de la coque (le test lit le livrable reconstruit) ---
"  att("+hasSrc('#faoWrap{position:absolute;top:10px;right:10px;')+",\"coque : #faoWrap overlay à droite du canvas (classique)\");",
"  att(/document\\.body\\.classList\\.contains\\('ui-modern'\\)/.test("+str(S.s10)+"),'src/10 : le mode moderne (ui-modern) est détecté');",
"  att(/data-ws/.test("+str(S.s10)+"),'src/10 : la détection lit data-ws (espace CAO/FAO)');",
// --- E) simulation FAO : le rayon de la souris trouve la matière taillée (marche : 10 mm pour x<5, 2 mm au-delà) ---
"  {const B={x0:0,x1:10,y0:0,y1:10,z0:0,z1:10},M=[{ox:0,oy:0,pas:0.5,nx:20,ny:20,U:[1,0,0],V:[0,1,0],A:[0,0,1],at:function(ix){return ix<10?10:2;}}];",
"   const T=function(ro,rd){return faoMatterRayHit(M,B,ro,rd);},pres=function(a,b){return a!=null&&Math.abs(a-b)<0.01;};",
"   att(pres(T([2,5,20],[0,0,-1]),10),'s9 dessus intact : point sur la face du brut');",
"   att(pres(T([7,5,20],[0,0,-1]),18),'s10 zone creusée : le fond (z=2), pas le dessus du brut');",
"   att(pres(T([15,5,5],[-1,0,0]),10),'s11 de côté : la paroi de la marche (x=5)');",
"   att(T([20,5,20],[0,0,-1])===null,'s12 rayon hors du brut : rien');",
"   att(pres(T([12,5,7],[-Math.SQRT1_2,0,-Math.SQRT1_2]),5*Math.SQRT2),'s13 rayon oblique : le fond (x=7, z=2)');",
"   att(faoViewerMatterOn()===false&&faoViewerMatterBox()===null,'s14 hors simulation : le pivot habituel reste en place');}",
// V0.69.2 : « mettre le point sur les faces du solide et pas du brut » : en simulation, la pièce masquée est visée avant la matière
"  att(seg("+str(S.s10)+",'viewHitAt').indexOf('hideBodies')>=0&&seg("+str(S.s10)+",'viewHitAt').indexOf('hideBodies')<seg("+str(S.s10)+",'viewHitAt').lastIndexOf('faoViewerMatterHit'),'src/10 : en simulation, viewHitAt vise la pièce masquée avant la matière');",
"  fin();",
"  });",
];
(async()=>{
  const {ctx}=loadApp();
  const code='(async()=>{\n'+b.join('\n')+'\n})()';
  const r=await vm.runInContext(code,ctx,{filename:'vuecentre.js'});
  console.log(r);
  if(/ÉCHECS/.test(r))process.exit(1);
})().catch(e=>{console.error('FATAL',String(e&&e.stack||e).slice(0,900));process.exit(1);});
