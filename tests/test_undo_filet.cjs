// Filet universel d'annulation (45-annuler-document.js), sans noyau.
// Ctrl+Z / Ctrl+Y doivent couvrir TOUT ce qui modifie le document — CAO, FAO, mise en plan,
// rendu — et l'esquisse, y compris un module qui a oublié d'appeler docPushUndo :
//   1 modification « oubliée » (mutation + markDirty) → une étape, Ctrl+Z / Ctrl+Y au clavier
//   2 docPushUndo explicite puis mutation → UNE étape, pas deux
//   3 pile travaillée par un module (fenêtre dynamique annulée) → recalage, rien d'empilé
//   4 transitoires « _… » et dérive du solveur (1e-9) → aucune étape
//   5 mode en cours (dépouillage) → rien pendant, une étape à la sortie
//   6 FAO (faoTouch), mise en plan (doc.mep), rendu (doc.rendu) → une étape chacun
//   7 champ focalisé non modifié → Ctrl+Z va au document ; champ en cours de frappe → au champ
//   8 esquisse : tracé sans skPushUndo → relevé, Ctrl+Z le retire, Ctrl+Y le remet
//   9 plan : le recalage automatique (cotes qui suivent la pièce, première entrée) ne fait pas d'étape ;
//     un vrai geste de plan, oui ; une modification de pièce non relevée reste UNE étape
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};
    confirm=function(){return true;};alert=function(){};
    const key=(k,o)=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,ctrlKey:true},o||{})));
    const vide=()=>{docUndoStack.length=0;docRedoStack.length=0;docBaseSync();};
    docResetEmpty();doc.name='Filet';
    doc.sketches=[{id:'skP',name:'Plaque',plane:'XY',visible:true,origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
      points:{a:{x:0,y:0},b:{x:80,y:0},c:{x:80,y:50},d:{x:0,y:50}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],
      constraints:[],dims:[]}];
    doc.features=[{id:'F1',type:'extrude',name:'Plaque',sketchId:'skP',distance:10,op:'add',visible:true}];
    markDirty();rebuild();
    vide();
    // 1
    doc.features[0].name='Oubli';markDirty();docCheckpoint();
    att(docUndoStack.length===1,'1 : modification sans docPushUndo → une étape');
    key('z');
    att(doc.features[0].name==='Plaque'&&docRedoStack.length===1,'1 : Ctrl+Z la retire');
    key('y');
    att(doc.features[0].name==='Oubli'&&docUndoStack.length===1,'1 : Ctrl+Y la remet');
    key('z');key('z',{shiftKey:true});
    att(doc.features[0].name==='Oubli','1 : Ctrl+Maj+Z = rétablir');
    // 2
    vide();
    docPushUndo('distance');doc.features[0].distance=25;markDirty();docCheckpoint();
    att(docUndoStack.length===1&&docUndoStack[0].label==='distance','2 : docPushUndo puis mutation → une seule étape, son libellé');
    key('z');
    att(doc.features[0].distance===10,'2 : Ctrl+Z rend la distance d’avant');
    // 3
    vide();
    const s0=docSnap(),n0=docUndoStack.length;
    docPushUndo('fenêtre');doc.features[0].distance=40;
    docApplySnap(s0);docUndoStack.length=n0;docRedoStack.length=0; // comme extDynCancel
    docCheckpoint();
    att(docUndoStack.length===0&&doc.features[0].distance===10,'3 : pile ramenée par le module → rien d’empilé');
    // 4
    vide();
    doc.sketches[0]._fade='bodies';doc.sketches[0].points.b.x=80+1e-9;docCheckpoint();
    att(docUndoStack.length===0,'4 : transitoire « _fade » + dérive 1e-9 → aucune étape');
    delete doc.sketches[0]._fade;doc.sketches[0].points.b.x=80;
    // 5
    vide();
    draftMode={};doc.features[0].distance=12;markDirty();docCheckpoint();
    const pendant=docUndoStack.length;
    draftMode=null;docCheckpoint();
    att(pendant===0&&docUndoStack.length===1,'5 : mode en cours → rien pendant, une étape à la sortie');
    key('z');att(doc.features[0].distance===10,'5 : Ctrl+Z annule le mode entier');
    // 6
    vide();
    const S=faoRoot().setups[0];const nm=S.name;S.name='Posage test';faoTouch();docCheckpoint();
    att(docUndoStack.length===1,'6 : FAO (faoTouch) → une étape');
    key('z');att(faoRoot().setups[0].name===nm,'6 : FAO : Ctrl+Z');
    vide();
    doc.mep={sheets:[{id:'s1',views:[]}]};docCheckpoint();
    att(docUndoStack.length===1,'6 : mise en plan (doc.mep) → une étape');
    key('z');att(!doc.mep||!doc.mep.sheets||!doc.mep.sheets.length,'6 : PLAN : Ctrl+Z');
    vide();
    doc.rendu={cams:[{n:'Vue 1',p:[1,2,3],t:[0,0,0],u:[0,0,1],f:50}]};docCheckpoint();
    att(docUndoStack.length===1,'6 : rendu (doc.rendu) → une étape');
    key('z');att(!doc.rendu||!doc.rendu.cams,'6 : Rendu : Ctrl+Z');
    // 7
    vide();
    doc.features[0].distance=33;docCheckpoint();
    const champ={tagName:'INPUT',type:'number',_mfEdit:false};
    const ev=new KeyboardEvent('keydown',{key:'z',ctrlKey:true});ev.target=champ;
    att(!undoKeyNative(champ),'7 : champ validé (Entrée) : Ctrl+Z rendu à l’application');
    champ._mfEdit=true;
    att(undoKeyNative(champ),'7 : champ en cours de frappe : son propre Ctrl+Z');
    att(!undoKeyNative({tagName:'INPUT',type:'checkbox',_mfEdit:true}),'7 : case à cocher : Ctrl+Z à l’application');
    key('z');att(doc.features[0].distance===10,'7 : Ctrl+Z hors champ → document');
    // 8
    skEdit=doc.sketches[0];skUndoStack=[];skRedoStack=[];skBaseSync();
    skEdit.entities.push({id:'lx',t:'line',p1:'a',p2:'c'});skCheckpoint();
    att(skUndoStack.length===1,'8 : esquisse : tracé sans skPushUndo → relevé');
    key('z');
    att(!doc.sketches[0].entities.some(e=>e.id==='lx'),'8 : esquisse : Ctrl+Z le retire');
    key('y');
    att(doc.sketches[0].entities.some(e=>e.id==='lx'),'8 : esquisse : Ctrl+Y le remet');
    skPushUndo();skEdit.entities.push({id:'ly',t:'line',p1:'b',p2:'d'});skCheckpoint();
    att(skUndoStack.length===2,'8 : esquisse : skPushUndo puis tracé → une seule étape');
    skEdit=null;
    // 9
    mepSetActive(false);doc.mep=null;vide();
    mepSetActive(true);docCheckpoint();
    att(doc.mep&&doc.mep.sheets.length===1&&docUndoStack.length===0,'9 : première entrée en Plan → planche créée, aucune étape');
    const sh=doc.mep.sheets[doc.mep.cur];
    const vue={id:'vF',kind:'base',dir:[0,0,1],u:[1,0,0],v:[0,-1,0],x:100,y:100,scale:1,mode:'hide',axes:[]};
    sh.views=[vue];
    const geo=cx=>({src:'OCCT',els:[{t:'C',cx,cy:0,r:5}]});
    const trou=cx=>({id:'dT',kind:'dia',vid:'vF',vid2:null,a:{x:cx,y:0,hint:{t:'ctr',i:0,s:{t:'C',cx,cy:0,r:5}}},off:8,ref:false});
    const poser=(v,cx)=>{__mepTest.setViewGeo(v,geo(cx));window.mepRefresh();};
    const dim=()=>doc.mep.sheets[doc.mep.cur].dims[0];
    const vueDoc=()=>doc.mep.sheets[doc.mep.cur].views[0];
    sh.dims=[trou(10)];poser(vue,10);vide();
    const dist0=doc.features[0].distance;
    // la pièce change (étape relevée), le plan se recale ensuite au dessin
    docPushUndo('distance');doc.features[0].distance=dist0+34;docCheckpoint();
    poser(vueDoc(),14);docCheckpoint();
    att(dim().a.x===14,'9 : la cote a suivi la géométrie');
    att(docUndoStack.length===1,'9 : recalage du plan après une modification de pièce → aucune étape en plus');
    key('z');
    att(doc.features[0].distance===dist0&&dim().a.x===10&&docUndoStack.length===0,'9 : un seul Ctrl+Z ramène la pièce et sa cote');
    key('y');
    att(doc.features[0].distance===dist0+34&&dim().a.x===14,'9 : Ctrl+Y remet la pièce et la cote recalée');
    // recalage sans aucune modification de la pièce (rejeu tardif, plan ouvert)
    vide();
    poser(vueDoc(),17);docCheckpoint();
    att(dim().a.x===17&&docUndoStack.length===0,'9 : recalage seul → aucune étape');
    // vrai geste de plan, passé par le rendu et sans docPushUndo
    vide();
    dim().off=21;window.mepRefresh();docCheckpoint();
    att(docUndoStack.length===1,'9 : geste de plan sans docPushUndo → une étape');
    key('z');
    att(dim().off===8,'9 : geste de plan : Ctrl+Z le retire');
    // vrai geste de plan par mepEdit : une étape, annulable
    vide();
    window.mepAddViewStd('front');docCheckpoint();
    att(docUndoStack.length===1&&doc.mep.sheets[doc.mep.cur].views.length===2,'9 : ajout de vue → une étape');
    key('z');
    att(doc.mep.sheets[doc.mep.cur].views.length===1,'9 : ajout de vue : Ctrl+Z la retire');
    // réglage du plan (recopié dans doc.mep au rendu) : reste un geste
    const st={};
    localStorage.getItem=k=>Object.prototype.hasOwnProperty.call(st,k)?st[k]:null;
    localStorage.setItem=(k,v)=>{st[k]=String(v);};
    localStorage.removeItem=k=>{delete st[k];};
    vide();
    const fl0=__mepTest.dimStyle().arrowLen;
    __mepTest.setDimStyle({arrowLen:fl0+3});docCheckpoint();
    att(docUndoStack.length===1,'9 : réglage du plan → une étape');
    key('z');
    att(__mepTest.dimStyle().arrowLen===fl0,'9 : réglage du plan : Ctrl+Z le retire');
    vide();
    // pièce modifiée SANS relevé, plan recalé avant le relevé : UNE seule étape, retour complet
    const d0=doc.features[0].distance,x0=dim().a.x;
    doc.features[0].distance=d0+1;markDirty();
    poser(vueDoc(),x0+2);docCheckpoint();
    att(dim().a.x===x0+2&&docUndoStack.length===1,'9 : pièce non relevée + recalage → une seule étape');
    key('z');
    att(doc.features[0].distance===d0&&dim().a.x===x0,'9 : Ctrl+Z ramène la pièce et la cote');
    // docPushUndo inerte pendant le travail automatique ; recalage juste après un docPushUndo : pas de doublon
    vide();
    docSansEtape(()=>docPushUndo('auto'));
    att(docUndoStack.length===0,'9 : docPushUndo pendant docSansEtape → ignoré');
    docPushUndo('geste');poser(vueDoc(),dim().a.x+3);docCheckpoint();
    att(docUndoStack.length===1,'9 : docPushUndo puis recalage → une seule étape');
    mepSetActive(false);
    return {ATT,OK};
  `;
  const o=vm.runInContext('(function(){'+R+'})()',ctx);
  console.log('=== filet universel Ctrl+Z / Ctrl+Y ===');
  o.OK.forEach(m=>console.log('  ✓ '+m));
  if(o.ATT.length){o.ATT.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.ATT.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
  process.exit(0);
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
