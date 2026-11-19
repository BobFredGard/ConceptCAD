// V0.99.45 : arêtes d'une pièce issue d'un STEP projetées dans l'esquisse d'une autre pièce
// (retour du 19/11 : « si la pièce insérée est issue d'un STEP ? »). Un STEP resté tel quel
// s'affiche en maillage, son solide exact est rangé à part (importGeom) et non dans occLive :
// sa capture d'assemblage n'avait ni arêtes ni faces exactes, Projeter ne le proposait pas.
// Noyau OCCT réel : socle + goupille en composants, puis une boîte 10×20×30 importée comme
// « pièce à assembler » ; dans la goupille, Projeter propose la boîte et attrape son arête.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  if(typeof sandbox.btoa!=='function')sandbox.btoa=globalThis.btoa;
  if(typeof sandbox.atob!=='function')sandbox.atob=globalThis.atob;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};confirm=window.confirm;showAll=function(){};applyView=function(){};',ctx);
  const R=String.raw`
    const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};
    const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
    const base=(id)=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],constraints:[],dims:[],seq:20,visible:false});
    const sq=(id,x0,y0,x1,y1)=>Object.assign(base(id),{points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}]});
    const ci=(id,x,y,r)=>Object.assign(base(id),{points:{p:{x,y}},entities:[{id:'c1',t:'circle',pc:'p',r}]});
    asmCtxDraw=function(){};asmDraw=function(){};asmFit=function(){};asmFill=function(){}; // pas de vue 3D réelle ici
    docResetEmpty();doc.name='Banc';
    doc.sketches=[sq('skA',-20,-20,20,20),ci('skP',60,0,5)];
    doc.bodies=[{id:'b1',name:'Socle',c:null},{id:'b2',name:'Goupille',c:null}];doc.bodySeq=3;doc.activeBody='b1';
    doc.features=[{id:'F1',type:'extrude',name:'Socle',sketchId:'skA',distance:20,op:'add',visible:true,body:'b1'},
                  {id:'F3',type:'extrude',name:'Goupille',sketchId:'skP',distance:30,op:'add',visible:true,body:'b2'}];
    ensureBodies();markDirty();rebuild();
    const res=asmCompsFromBodies(['b1','b2']);markDirty();rebuild();asmBuildSnapshots();
    const P=res.made[1].comp;
    // boîte 10×20×30 écrite en STEP, importée comme pièce à assembler (depuis la racine, mode Placer)
    asmActivatePath([]);
    const bx=new occt.BRepPrimAPI_MakeBox_2(new occt.gp_Pnt_3(0,0,0),10,20,30);bx.Build();
    const u8=Uint8Array.from(occWriteStep([bx.Shape()],'/__boite.stp','AP214',false));
    try{bx.delete();occt.FS.unlink('/__boite.stp');}catch(e){}
    asmMode='asm';
    const ok=await importAsComponent({name:'boite.step',arrayBuffer:async()=>u8.buffer});
    occt=__realOcct;occtReady=true;
    const B=asm.comps.find(c=>c.name==='boite');
    att(ok&&B&&B.doc.features.some(f=>f.type==='import'),'0 : boîte STEP importée comme composant');
    const nE=B&&B._snap&&B._snap.pedges?B._snap.pedges.length:0,nF=B&&B._snap&&B._snap.pfaces?B._snap.pfaces.length:0;
    att(nE===12,'1 : arêtes exactes de la boîte capturées ('+nE+'/12)');
    att(nF===6,'2 : faces planes de la boîte capturées ('+nF+'/6)');
    // goupille éditée, esquisse XY : Projeter propose la boîte et attrape son arête (0,0,0)→(10,0,0)
    asmMode='part';
    asmActivatePath(asmFirstPath(P.id));
    const sk=Object.assign(base('skG'),{name:'Sur la goupille',visible:true,points:{},entities:[]});
    doc.sketches.push(sk);markDirty();rebuild();
    const L=asmSkExtLists();
    att(L.some(l=>l.name==='boite'&&l.edges.length===12),'3 : Projeter propose la boîte ('+L.map(l=>l.name+':'+l.edges.length).join(', ')+')');
    const Wb=asmWorld(asmFirstPath(B.id)),Wp=asmWorld(asmFirstPath(P.id)),Fx=asmCompose(asmInverse(Wp),Wb);
    const a=asmApply(Fx,[0,0,0]),b=asmApply(Fx,[10,0,0]),m=asmApply(Fx,[5,0,0]);
    skView.s=4;
    const pr=projectEdgeAt(sk,m[0],m[1]);
    const surSeg=pr&&pr.type==='line'&&((near(pr.x1,a[0],1e-4)&&near(pr.y1,a[1],1e-4)&&near(pr.x2,b[0],1e-4)&&near(pr.y2,b[1],1e-4))||(near(pr.x1,b[0],1e-4)&&near(pr.y1,b[1],1e-4)&&near(pr.x2,a[0],1e-4)&&near(pr.y2,a[1],1e-4)));
    att(surSeg&&pr.ext&&asmPathComp(pr.ext.path)===B.id,'4 : l’arête de la boîte se projette au bon endroit, liée à la boîte ('+JSON.stringify(pr&&{t:pr.type,x1:pr.x1,y1:pr.y1,x2:pr.x2,y2:pr.y2})+')');
    // la boîte se déplace de 7 en Y : la projection voit la boîte déplacée
    asmActivatePath([]);
    const oB=asmCompOccs(B.id)[0];oB.fr={o:[oB.fr.o[0],oB.fr.o[1]+7,oB.fr.o[2]],x:oB.fr.x,y:oB.fr.y,z:oB.fr.z};
    asmActivatePath(asmFirstPath(P.id));
    const E2=asmSkExtLists().find(l=>l.name==='boite');
    att(E2&&E2.edges.some(e=>e.pts.some(p=>near(p[1],a[1]+7,1e-4))),'5 : boîte déplacée : ses arêtes suivent');
    // cache d'assemblage : un composant à import garde une clé (image reprise une fois, puis servie)
    att(asmCacheKey(B.doc)!=null,'6 : clé de cache d’un composant à import calculée');
    return {ATT,OK};
  `;
  const o=await vm.runInContext('(async function(){'+R+'})()',ctx);
  console.log('=== V0.99.45 : arêtes d’une pièce STEP projetées dans une autre pièce ===');
  o.OK.forEach(m=>console.log('  ✓ '+m));
  if(o.ATT.length){o.ATT.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.ATT.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
