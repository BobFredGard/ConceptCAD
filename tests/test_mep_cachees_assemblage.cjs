// V0.97.1 : mise en plan — cachées sous les traits visibles retirées, vues d'assemblage plus rapides.
//  A. « ne montrer que les arêtes qui ne sont pas derrière des traits forts » : pavé percé, vues de face
//     et de dessus en « cachées en pointillé » — les arêtes arrière superposées aux arêtes avant
//     disparaissent, le perçage caché reste ; recouvrements partiels (droite, arc, cercle) découpés.
//  B. assemblage (une occurrence tournée) : maillage fait une fois par solide de composant puis placé,
//     classement des arêtes partagé — mêmes triangles et même vue que le calcul occurrence par occurrence.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};showAll=function(){};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);
    const T=window.__mepTest;
    try{mepSetActive(true);}catch(e){}
    // ── A. pavé 40 × 30 × 10 percé Ø10 en (20,15), axe Z
    const box=new occt.BRepPrimAPI_MakeBox_2(new occt.gp_Pnt_3(0,0,0),40,30,10).Shape();
    const cyl=new occt.BRepPrimAPI_MakeCylinder_3(new occt.gp_Ax2_3(new occt.gp_Pnt_3(20,15,-1),new occt.gp_Dir_4(0,0,1)),5,12).Shape();
    const cut=new occt.BRepAlgoAPI_Cut_3(box,cyl);
    const bd={id:'__pv__',bodyId:'__pv__',shape:cut.Shape(),mesh:{visible:true}};
    bodies.push(bd);
    const sh=doc.mep.sheets[doc.mep.cur];
    const face={id:'__vf__',kind:'base',dir:[0,-1,0],u:[1,0,0],v:[0,0,1],x:100,y:100,scale:1,mode:'dash',tangent:false,hlrExact:true,bodyId:'__pv__',axes:[]};
    const dessus={id:'__vd__',kind:'base',dir:[0,0,1],u:[1,0,0],v:[0,1,0],x:200,y:100,scale:1,mode:'dash',tangent:false,hlrExact:true,bodyId:'__pv__',axes:[]};
    sh.views.push(face,dessus);
    const gf=T.geo(face),gd=T.geo(dessus);
    const H=g=>g.els.filter(e=>e.k==='hidden');
    const hf=H(gf);
    A(gf.src==='OCCT HLR','A1 : HLR exact ('+gf.src+')');
    A(hf.length===2&&hf.every(e=>e.t==='L'&&near(Math.abs(e.x1-e.x2),0)&&near(Math.abs(e.y1-e.y2),10)&&(near(e.x1,15)||near(e.x1,25))),
      'A2 : vue de face : seules les deux génératrices du perçage restent cachées ('+hf.length+' : '+hf.map(e=>e.t+[e.x1,e.y1,e.x2,e.y2].map(x=>x!=null?x.toFixed(1):'').join(',')).join(' ; ')+')');
    A(gf.els.filter(e=>e.k==='sharp').length>=4,'A3 : vue de face : contour visible gardé');
    A(H(gd).length===0,'A4 : vue de dessus : arêtes du dessous et cercle du bas sous les traits du dessus : aucune cachée ('+H(gd).length+')');
    face.mode='hide';
    A(H(T.geo(face)).length===0,'A5 : sans cachées choisies : aucune cachée');
    // recouvrements partiels
    const D=T.dropHidden;
    let r=D([{t:'L',x1:0,y1:0,x2:10,y2:0,k:'sharp'},{t:'L',x1:5,y1:0,x2:20,y2:0,k:'hidden'}]).filter(e=>e.k==='hidden');
    A(r.length===1&&near(Math.min(r[0].x1,r[0].x2),10,0.02)&&near(Math.max(r[0].x1,r[0].x2),20),'A6 : droite à moitié sous un trait : reste 10 → 20');
    r=D([{t:'L',x1:4,y1:0,x2:6,y2:0,k:'sharp'},{t:'L',x1:0,y1:0,x2:10,y2:0,k:'hidden'}]).filter(e=>e.k==='hidden');
    A(r.length===2,'A7 : trait au milieu d’une cachée : deux morceaux ('+r.length+')');
    r=D([{t:'L',x1:0,y1:0.5,x2:10,y2:0.5,k:'sharp'},{t:'L',x1:0,y1:0,x2:10,y2:0,k:'hidden'}]).filter(e=>e.k==='hidden');
    A(r.length===1&&near(r[0].x2-r[0].x1,10),'A8 : droite parallèle voisine : cachée gardée entière');
    r=D([{t:'A',cx:0,cy:0,r:5,a0:0,a1:Math.PI,k:'sharp'},{t:'C',cx:0,cy:0,r:5,k:'hidden'}]).filter(e=>e.k==='hidden');
    A(r.length===1&&r[0].t==='A'&&near(r[0].a1-r[0].a0,Math.PI,0.01)&&Math.sin((r[0].a0+r[0].a1)/2)<-0.99,'A9 : cercle caché à moitié sous un arc visible : demi-cercle du bas');
    r=D([{t:'A',cx:0,cy:0,r:5,a0:-0.5,a1:0.5,k:'sharp'},{t:'A',cx:0,cy:0,r:5,a0:6.2,a1:6.4,k:'hidden'}]).filter(e=>e.k==='hidden');
    A(r.length===0,'A10 : arc caché sous un arc visible, angles de part et d’autre de 0 : retiré ('+r.length+')');
    r=D([{t:'C',cx:0,cy:0,r:5,k:'sharp'},{t:'C',cx:0,cy:0,r:6,k:'hidden'}]).filter(e=>e.k==='hidden');
    A(r.length===1&&r[0].t==='C','A11 : cercle caché d’un autre rayon : gardé');
    bodies.splice(bodies.indexOf(bd),1);sh.views.length=0;
    // ── B. assemblage : socle + deux colonnes, l'une tournée de 90°
    const sq=(id,x0,y0,x1,y1)=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
      points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false});
    docResetEmpty();doc.name='Banc';
    doc.sketches=[sq('skA',-20,-20,20,20),sq('skB',25,-5,45,5)];
    doc.bodies=[{id:'b1',name:'Socle',c:null},{id:'b2',name:'Colonne',c:null}];doc.bodySeq=3;doc.activeBody='b1';
    doc.features=[{id:'F1',type:'extrude',name:'Socle',sketchId:'skA',distance:20,op:'add',visible:true,body:'b1'},
                  {id:'F2',type:'extrude',name:'Colonne',sketchId:'skB',distance:50,op:'add',visible:true,body:'b2'}];
    ensureBodies();markDirty();rebuild();
    const res=asmCompsFromBodies(['b1','b2']);markDirty();rebuild();asmBuildSnapshots();
    const C=res.made[1].comp;
    asmAddOcc(C.id,{o:[-60,10,0],x:[0,1,0],y:[-1,0,0],z:[0,0,1]},asm.root);
    asmBuildSnapshots();
    const TN=[];const tn0=occTriNormals;occTriNormals=function(T){TN.push(T);return tn0.apply(this,arguments);};
    let L;try{L=asmPlanBodies();}finally{occTriNormals=tn0;}
    A(L.length===3&&L.every(b=>b.shape&&b.shape._asmSrc),'B1 : trois corps placés, solide du composant retenu ('+L.length+')');
    const bb=a=>{const m=[1e9,1e9,1e9,-1e9,-1e9,-1e9];for(let i=0;i<a.length;i+=3)for(let k=0;k<3;k++){m[k]=Math.min(m[k],a[i+k]);m[3+k]=Math.max(m[3+k],a[i+k]);}return m;};
    let okT=true;const msg=[];
    L.forEach(b=>{const D0=occTriPos(b.shape,0.3,0.4,true),b0=bb(D0.pos),b1=bb(b.tri);
      const same=D0.pos.length===b.tri.length&&b0.every((x,k)=>near(x,b1[k],1e-4));
      if(!same)okT=false;msg.push(b.tri.length/9+'/'+D0.pos.length/9);});
    A(okT,'B2 : triangles placés = maillage du solide placé (occurrence tournée comprise ; '+msg.join(' ')+')');
    let okN=TN.length===3,nN=0;
    TN.forEach(t=>{const pp=t.pos,nn=t.nrm;if(!nn){okN=false;return;}
      for(let i=0;i<pp.length;i+=9){const ax=pp[i+3]-pp[i],ay=pp[i+4]-pp[i+1],az=pp[i+5]-pp[i+2],bx=pp[i+6]-pp[i],by=pp[i+7]-pp[i+1],bz=pp[i+8]-pp[i+2];
        const cx=ay*bz-az*by,cy=az*bx-ax*bz,cz=ax*by-ay*bx;if(!isFinite(nn[i]))continue;nN++;if(cx*nn[i]+cy*nn[i+1]+cz*nn[i+2]<=0){okN=false;break;}}});
    A(okN,'B3 : occurrence tournée comprise : normales sortantes cohérentes avec les triangles ('+nN+' triangles)');
    const sh2=T.sheet();sh2.views.length=0;
    const views=['front','top','right'].map(vk=>T.addView({kind:'base',vk,asm:true,mode:'dash',tangent:true}));
    const sig=g=>g.els.map(e=>e.t+e.k+[e.x1,e.y1,e.x2,e.y2,e.cx,e.cy,e.r].map(x=>x==null?'':x.toFixed(3)).join(',')).sort().join(';');
    const g1=views.map(v=>sig(T.geo(v)));
    // même calcul SANS le partage (solides placés non annotés) : référence d'avant
    asmPlanFree();const ap=asmPlaced;asmPlaced=function(){return Object.preventExtensions(ap.apply(this,arguments));};
    try{
      T.geoClear();const L2=asmPlanBodies();
      A(L2.every(b=>!b.shape._asmSrc),'B4 : référence calculée occurrence par occurrence');
      const g2=views.map(v=>sig(T.geo(v)));
      A(g1.every((s,i)=>s===g2[i]&&s.length>0),'B5 : vues face, dessus, droite identiques au calcul occurrence par occurrence');
    }finally{asmPlaced=ap;}
    return out;
  `;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== V0.97.1 : cachées sous les traits visibles, vues d’assemblage ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
