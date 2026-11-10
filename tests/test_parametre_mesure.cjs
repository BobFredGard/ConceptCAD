// Paramètre mesuré entre 2 faces (V0.87.0) : « + Mesure » dans ƒx Paramètres puis 2 clics, ou bouton
// après une mesure Ctrl+clic. Le paramètre VAUT la mesure, suit la pièce, ne se règle pas à la main ;
// les valeurs qui l'utilisent suivent ; enregistré avec ses faces ; ⚠ si une face disparaît.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(m){window.__al=m;};',ctx);
  const R=`
    highlightTris=function(){};dimPair=function(){}; // THREE simulé : pas de tracé
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    const rect=(id,x0,y0,x1,y1)=>({id:id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
      points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],
      constraints:[],dims:[],seq:10,visible:false});
    doc.sketches=[rect('s1',0,0,40,20),rect('s2',50,0,60,20)];
    doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'s1',distance:10,op:'add',visible:true},
      {id:'F2',type:'extrude',name:'Plot',sketchId:'s2',distance:5,op:'add',visible:true}];
    doc.params=[];doc.bodies=[];doc.cgeo=[];delete doc.activeBody;markDirty();rebuild();
    A(builtEngine==='exact'&&parMesShapes().length>=1,'0 : pièce exacte');
    // ── 1. saisie par 2 clics (THREE simulé : le clic désigne directement la face, par son rang) ──
    const ordOf=(bd,test)=>{let o=-1;occSubShapes(bd.shape,'TopAbs_FACE').forEach((f,k)=>{if(o<0&&test(occSurfDesc(f),occFaceBox(f)))o=k;});return o;};
    const viser=(fn)=>{const bd=parMesShapes().find(b=>ordOf(b,fn)>=0);return{bd,ord:ordOf(bd,fn)};};
    const avecClic=(X,run)=>{
      const rp=pick,rh=occFaceOfHit;
      pick=()=>({object:X.bd.mesh,faceIndex:X.ord,point:new THREE.Vector3()});
      occFaceOfHit=(m,fi)=>({face:occFaceAt(X.bd.shape,fi),ord:fi,bd:X.bd});
      try{return run();}finally{pick=rp;occFaceOfHit=rh;}
    };
    const horiz=z=>(d,bx)=>d.k==='pl'&&Math.abs(Math.abs(d.n[2])-1)<1e-9&&Math.abs(bx.pos[2]-z)<1e-6&&bx.pos[0]<45;
    const clic=z=>avecClic(viser(horiz(z)),()=>parMesPickAt({clientX:0,clientY:0,button:0}));
    const u0=docUndoStack.length;
    parMesPickStart();A(!!parMesPick,'1a : « + Mesure » lance la saisie');
    clic(0);clic(10);
    const p=doc.params.find(q=>q.mes);
    A(!parMesPick&&p&&p.name==='Ecart1'&&Math.abs(p.value-10)<1e-9&&p.mes.k==='plans','1b : Ecart1 = 10 (plans parallèles) — vu '+(p&&p.value));
    A(p&&p.mes.a.nom&&p.mes.b.nom&&docUndoStack.length===u0+1,'1c : faces retenues par leur nom, une étape d’annulation');
    // ── 2. la mesure suit la pièce, et ce qui l'utilise suit ──
    doc.params.push({name:'Double',expr:'Ecart1*2',value:0});
    const f2=doc.features.find(f=>f.id==='F2');
    A(parSetFeat(f2,'distance',f2,'Ecart1/2')===true,'2a : une fonction peut utiliser le paramètre mesuré');
    const f1=doc.features.find(f=>f.id==='F1');f1.distance=16;markDirty();rebuild();
    for(let i=0;i<3;i++){await new Promise(r=>setTimeout(r,30));}
    A(Math.abs(p.value-16)<1e-9,'2b : épaisseur 16 → Ecart1 = 16 (vu '+p.value+')');
    A(Math.abs(doc.params.find(q=>q.name==='Double').value-32)<1e-9,'2c : Double = Ecart1*2 suit (32)');
    A(Math.abs(f2.distance-8)<1e-9&&builtEngine==='exact','2d : le plot suit : hauteur 8 = Ecart1/2 (vu '+f2.distance+')');
    // ── 3. non modifiable à la main, ni par une configuration ──
    A(parSetParam(p,'5')!==true&&Math.abs(p.value-16)<1e-9,'3a : la valeur ne se règle pas à la main');
    A(cfgSetExpr('Ecart1','5')===false,'3b : une configuration ne la pilote pas');
    const row=parMiniRows().find(r=>r.name==='Ecart1');
    A(row&&!row.set&&row.val==='16','3c : mini-liste : lecture seule, 16');
    // ── 4. bouton après une mesure Ctrl+clic ──
    {const vx=x=>(d,bx)=>d.k==='pl'&&Math.abs(Math.abs(d.n[0])-1)<1e-9&&Math.abs(bx.pos[0]-x)<1e-6;
     const XA=viser(vx(0)),XB=viser(vx(40));
     const rh=occFaceOfHit;occFaceOfHit=(m,fi)=>({face:occFaceAt(m===XA.bd.mesh&&fi===XA.ord?XA.bd.shape:XB.bd.shape,fi),ord:fi,bd:XA.bd});
     // DOM simulé : le bouton est intercepté à l'ajout, son clic rejoué par son gestionnaire
     let b=null,clicFn=null;const ra=faceEl.appendChild;
     faceEl.appendChild=e=>{b=e;};
     const rc=document.createElement;
     document.createElement=t=>{const e=rc.call(document,t);const ae=e.addEventListener;e.addEventListener=(k,fn)=>{if(k==='click')clicFn=fn;try{ae&&ae.call(e,k,fn);}catch(x){}};return e;};
     try{parMesOffer({mesh:XA.bd.mesh,faceIndex:XA.ord},{mesh:XB.bd.mesh,faceIndex:XB.ord});}
     finally{occFaceOfHit=rh;faceEl.appendChild=ra;document.createElement=rc;}
     const n0=doc.params.length;if(clicFn)clicFn({stopPropagation(){}});
     const q=doc.params[doc.params.length-1];
     A(b&&doc.params.length===n0+1&&q.mes&&Math.abs(q.value-40)<1e-9,'4 : bouton « Créer un paramètre » après Ctrl+clic : '+(q&&q.name)+' = '+(q&&q.value));}
    // ── 5. enregistrement ──
    const js=JSON.parse(JSON.stringify(serialise(doc)));
    const sp=(typeof js==='string'?JSON.parse(js):js).params.find(q=>q.name==='Ecart1');
    A(sp&&sp.mes&&sp.mes.a&&sp.mes.b&&sp.mes.k==='plans','5 : enregistré avec ses 2 faces');
    // ── 6. face disparue : ⚠, dernière valeur gardée ; revenue : plus de ⚠ ──
    f1.distance=12;doc.features.find(f=>f.id==='F2').visible=false;markDirty();rebuild();
    const q4=doc.params[doc.params.length-1];
    out.log.push('6 : '+q4.name+' '+q4.value+(q4.mesErr?' ⚠ '+q4.mesErr:''));
    A(Math.abs(p.value-12)<1e-9&&!p.mesErr,'6a : Ecart1 = 12, sans ⚠');
    return out;`;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Paramètre mesuré entre 2 faces ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
