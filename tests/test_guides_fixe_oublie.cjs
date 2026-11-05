// Barquette, Guide Rengort 2 : un point resté « fixe » après la suppression de la projection qui le portait.
// La référence bougeait, pas lui : l'esquisse ne se résolvait plus et les congés des renforts échouaient.
// Et le copieur de solides jamais libéré : 200 Mo perdus à chaque changement de cote.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
let ko=0;const A=(c,m)=>{if(c)console.log('  ✓ '+m);else{ko++;console.log('  ✗ '+m);}};
(async()=>{
  console.log('=== « Fixe » d’une projection supprimée ===');
  {
    const {ctx}=loadApp();
    const r=vm.runInContext(String.raw`(function(){
      const o={};
      let sk={id:'s',name:'s',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],seq:50,dims:[],
        points:{a:{x:0,y:0},b:{x:10,y:0},c:{x:20,y:5},d:{x:30,y:5},u:{x:40,y:0}},
        entities:[{id:'P',t:'line',p1:'a',p2:'b',construction:true,proj:true},{id:'Q',t:'line',p1:'c',p2:'d',construction:true,proj:true},{id:'L',t:'line',p1:'b',p2:'c'},{id:'M',t:'line',p1:'c',p2:'u'}],
        constraints:[{id:'f1',type:'fix',p:'a'},{id:'f2',type:'fix',p:'b'},{id:'f3',type:'fix',p:'c'},{id:'f4',type:'fix',p:'d'},{id:'f5',type:'fix',p:'u'}]};
      doc.sketches=[sk];skEdit=sk;skSel={kind:'ent',id:'P'};skSelX=[];deleteSkSel();
      const fixe=p=>sk.constraints.some(c=>c.type==='fix'&&c.p===p);
      o.bLibre=!fixe('b');o.aParti=!sk.points.a;o.cGarde=fixe('c');o.uGarde=fixe('u');
      // deux projections sur un même point : en supprimer une ne le libère pas
      sk.entities.push({id:'R',t:'line',p1:'c',p2:'u',construction:true,proj:true});
      skSel={kind:'ent',id:'Q'};skSelX=[];deleteSkSel();
      o.partage=fixe('c');
      // réparation à l'ouverture
      sk={id:'t',points:{a:{x:0,y:0},b:{x:10,y:0},e:{x:10,y:0},m:{x:5,y:0},v:{x:5,y:5},w:{x:7,y:5},h:{x:0,y:9},i:{x:9,y:9},n:{x:4,y:9}},
        entities:[{id:'P',t:'line',p1:'a',p2:'b',proj:true},{id:'L1',t:'line',p1:'e',p2:'v'},{id:'L2',t:'line',p1:'m',p2:'w'},{id:'H',t:'line',p1:'h',p2:'i'},{id:'L3',t:'line',p1:'n',p2:'v'}],
        constraints:[{id:'f1',type:'fix',p:'a'},{id:'f2',type:'fix',p:'b'},{id:'f3',type:'fix',p:'e'},{id:'o3',type:'online',p:'e',line:'P'},{id:'f4',type:'fix',p:'m'},{id:'o4',type:'online',p:'m',line:'P'},{id:'f5',type:'fix',p:'v'},{id:'f6',type:'fix',p:'n'},{id:'o6',type:'online',p:'n',line:'H'}],dims:[],seq:9};
      o.n=skFixSurProjRepair(sk);
      const fx=p=>sk.constraints.some(c=>c.type==='fix'&&c.p===p);
      o.eLibre=!fx('e');o.eLie=sk.constraints.some(c=>c.type==='coincident'&&c.a==='e'&&c.b==='b');
      o.mLibre=!fx('m');o.mSansBout=!sk.constraints.some(c=>c.type==='coincident'&&c.a==='m');
      o.vGarde=fx('v');o.nGarde=fx('n');o.projGarde=fx('a')&&fx('b');
      o.encore=skFixSurProjRepair(sk);
      return o;})()`,ctx);
    A(r.bLibre&&r.aParti,'supprimer la projection libère le point partagé et retire son bout isolé');
    A(r.cGarde&&r.uGarde,'les autres « fixe » restent');
    A(r.partage,'un point encore tenu par une autre projection reste fixe');
    A(r.n===2&&r.eLibre&&r.eLie,'ouverture : point fixe sur le bout d’une projection → attaché à ce bout');
    A(r.mLibre&&r.mSansBout,'ouverture : point fixe au milieu d’une projection → reste seulement sur la ligne');
    A(r.vGarde&&r.nGarde&&r.projGarde,'ouverture : « fixe » de l’utilisateur hors projection et « fixe » des projections intacts');
    A(r.encore===0,'réparation sans effet la deuxième fois');
  }
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  if(!real.NCollection_IndexedDataMap_TopoDS_Shape_NCollection_List_TopoDS_Shape_TopTools_ShapeMapHasher){
    console.log('=== Barquette : noyau sans carte indexée, sauté ===');
  }else{
    console.log('=== Barquette avec deux guides : largeur (noyau réel) ===');
    const {ctx,sandbox}=loadApp();
    sandbox.__realOcct=real;sandbox.__txt=lire(path.join(ROOT,'tests','fixtures','barquette-guides.conceptcad'));
    vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
    const m=await vm.runInContext('(async()=>{'+String.raw`
      await bundleRestore(__txt,{name:'banc'});occt=__realOcct;occtReady=true;markDirty();rebuild();
      const P=doc.params.find(p=>p.name==='largeur_barquette');
      const G=doc.sketches.find(s=>s.id==='sk_68_mw34aio8');
      const lit=()=>{const FR=occFinalShape(null);const o={msgs:(FR.msgs||[]).slice(),vol:+occShapeVolume(FR.shape),
        ecart:Math.hypot(G.points.p64.x-G.points.p73.x,G.points.p64.y-G.points.p73.y)};occCleanup(FR,null);return o;};
      const out={d:lit(),L:{}};
      for(const v of [170,175,160,165]){P.expr=String(v);parApplyAll();markDirty();rebuild();out.L[v]=lit();}
      const FR=occFinalShape(null);const h0=occt.HEAP8.length;
      for(let i=0;i<150;i++){const c=occShapeCopy(FR.shape);if(!c)throw new Error('copie');c.delete();}
      out.heap=(occt.HEAP8.length-h0)/1048576;occCleanup(FR,null);
      return out;`+'})()',ctx);
    A(m.d.msgs.length===0,'à l’ouverture : aucun message');
    for(const v of [170,175,160,165]){
      A(m.L[v].msgs.length===0,'largeur '+v+' : aucun message'+(m.L[v].msgs.length?' — '+m.L[v].msgs.slice(0,2).join(' ; '):''));
      A(m.L[v].ecart<1e-3,'largeur '+v+' : le haut de Guide Rengort 2 suit sa référence (écart '+m.L[v].ecart.toFixed(4)+')');
    }
    const pente=(m.L[175].vol-m.L[170].vol)/5,pente2=(m.L[170].vol-m.d.vol)/5;
    A(Math.abs(pente-pente2)<1,'volume régulier : '+pente2.toFixed(1)+' puis '+pente.toFixed(1)+' mm³ par mm de largeur');
    A(Math.abs(m.L[165].vol-m.d.vol)<1,'retour à 165 : même volume ('+m.L[165].vol.toFixed(1)+' / '+m.d.vol.toFixed(1)+')');
    A(m.heap<64,'150 copies du solide : mémoire du noyau stable (+'+m.heap.toFixed(0)+' Mo)');
  }
  if(ko){console.log('\n*** '+ko+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
