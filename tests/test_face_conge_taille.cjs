// « Déplacer une face » sur la face d'un congé ou d'un chanfrein (V0.41.0) : occBlendOfFace
// retrouve la fonction et l'arête qui ont fait la face (rayon, chaîne tangente, chanfrein),
// et ne prend pas une face ordinaire pour un congé. Puis le rayon changé est rejoué, et un
// chanfrein posé après un congé « arête seule » s'applique (V0.41.0).
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    "const vol=sh=>{const g=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(sh,g,false,false,false);const m=g.Mass();g.delete();return m;};",
    "const faces=sh=>occSubShapes(sh,'TopAbs_FACE');",
    "const box=occFaceBox;",
    "const sk={id:'sk_t',name:'Carré',plane:'XY',origin:[0,0,0],points:{},entities:[],constraints:[],dims:[]};",
    "[['p0',0,0,'e0','p1'],['p1',100,0,'e1','p2'],['p2',100,60,'e2','p3'],['p3',0,60,'e3','p0']].forEach(l=>{",
    "  sk.points[l[0]]={x:l[1],y:l[2]};sk.entities.push({id:l[3],t:'line',p1:l[0],p2:l[4]});});",
    "doc.sketches=[sk];",
    "const EX={id:'ex_t',type:'extrude',name:'Extrusion 1',sketchId:'sk_t',op:'add',distance:40,dist:40,d2:0};",
    // A. congé R10 sur l'arête verticale (100,60)
    "const XA={id:'xa',type:'xfillet',name:'Congé A',visible:true,tangent:false,edges:[{pos:[100,60,20],pos0:[100,60,20],r:10}]};",
    "doc.features=[EX,XA];",
    "occSkipFeat=null;freshHard=true;occCkClear();",
    "let FR=occFinalShape(null);",
    "att(!!FR.shape,'aucune forme');if(!FR.shape)return P.concat(ATT).join(String.fromCharCode(10));",
    "(FR.msgs||[]).forEach(m=>p('  ! '+m));",
    "const sh=FR.shape;",
    "const L=faces(sh);",
    "p('faces : '+L.map(f=>occSurfKind(f)).join(' '));",
    "const of=(fn)=>L.find(f=>{const b=box(f);return b&&fn(occSurfKind(f),b);});",
    // congé A : cylindre vertical près du coin (100,60)
    "const fa=of((k,b)=>k==='Cylinder'&&b.dim[2]>20);",
    "const ba=fa&&occBlendOfFace(fa,sh,null);",
    "p('A : '+JSON.stringify(ba));",
    "att(ba&&ba.feat==='xa'&&ba.idx.join()==='0'&&Math.abs(ba.r-10)<1e-9&&!ba.cham,'A : congé vertical non reconnu');",
    // faces ordinaires : dessous et côté -X → rien
    "const fz=of((k,b)=>k==='Plane'&&b.pos[2]<1e-6);",
    "const fx=of((k,b)=>k==='Plane'&&b.pos[0]<1e-6);",
    "att(fz&&occBlendOfFace(fz,sh,null)===null,'dessous pris pour un congé');",
    "att(fx&&occBlendOfFace(fx,sh,null)===null,'côté -X pris pour un congé');",
    // la face voisine du congé A (côté +X) : pas un congé
    "const fpx=of((k,b)=>k==='Plane'&&b.pos[0]>99.99&&b.dim[0]<1e-6);",
    "att(fpx&&occBlendOfFace(fpx,sh,null)===null,'face +X prise pour un congé');",
    // le rayon changé est rejoué : R10 → R15 enlève de la matière
    "const v0=vol(sh);",
    "XA.edges[0].r=15;freshHard=true;occCkClear();",
    "const FR2=occFinalShape(null);",
    "const v1=FR2.shape?vol(FR2.shape):0;",
    "p('volume R10 '+v0.toFixed(1)+' → R15 '+v1.toFixed(1));",
    "att(FR2.shape&&v1<v0-100,'R15 : le congé n a pas grandi');",
    "XA.edges[0].r=10;",
    // B. chaîne tangente : oblong (2 droites + 2 demi-cercles) congé R2 sur le bord haut, une
    // seule arête mémorisée (germe au milieu de y=6) — les faces du bout arrondi aussi.
    "const sl={id:'sk_s',name:'Slot',plane:'XY',origin:[0,0,0],points:{},entities:[],constraints:[],dims:[],seq:1,visible:true};",
    "[['p1',-20,6],['p2',20,6],['p3',20,-6],['p4',-20,-6],['p5',-20,0],['p6',20,0]].forEach(q=>{sl.points[q[0]]={x:q[1],y:q[2]};});",
    "sl.entities.push({id:'e1',t:'line',p1:'p1',p2:'p2'},{id:'e2',t:'line',p1:'p4',p2:'p3'},{id:'e3',t:'arc',pc:'p5',pa:'p1',pb:'p4',r:6},{id:'e4',t:'arc',pc:'p6',pa:'p3',pb:'p2',r:6});",
    "doc.sketches=[sk,sl];",
    "const XB={id:'xb',type:'xfillet',name:'Congé B',visible:true,tangent:true,edges:[{pos:[0,6,40],pos0:[0,6,40],r:2,seed:1}]};",
    "doc.features=[{id:'ex_s',type:'extrude',name:'Slot',sketchId:'sk_s',op:'add',distance:40,dist:40,d2:0,visible:true},XB];freshHard=true;occCkClear();",
    "const FRB=occFinalShape(null);(FRB.msgs||[]).forEach(m=>p('  ! '+m));",
    "if(FRB.shape){",
    "  const LB=faces(FRB.shape);p('B faces : '+LB.map(f=>occSurfKind(f)).join(' '));",
    "  const near=LB.find(f=>{const b=box(f);return occSurfKind(f)==='Cylinder'&&b.pos[1]>3&&b.pos[2]>37;});",
    "  const far=LB.filter(f=>{const b=box(f);return occSurfKind(f)!=='Plane'&&b.pos[2]>37&&b.pos[0]>20;});",
    "  const fb=near&&occBlendOfFace(near,FRB.shape,null);p('B germe : '+JSON.stringify(fb));",
    "  att(fb&&fb.feat==='xb'&&Math.abs(fb.r-2)<1e-9,'B : congé du germe non reconnu');",
    "  att(far.length>0,'B : pas de face de congé au bout arrondi');",
    "  far.forEach((f,i)=>{const r=occBlendOfFace(f,FRB.shape,null);p('B bout '+i+' ('+occSurfKind(f)+') : '+JSON.stringify(r));att(r&&r.feat==='xb','B : face '+occSurfKind(f)+' de la chaîne tangente non reconnue');});",
    "  const side=LB.find(f=>{const b=box(f);return occSurfKind(f)==='Cylinder'&&b.pos[2]<30&&b.pos[0]>20;});",
    "  att(side&&occBlendOfFace(side,FRB.shape,null)===null,'B : bout arrondi de l oblong (R6) pris pour le congé');",
    "}else att(false,'B : aucune forme');",
    // C. chanfrein 6 sur l'arête verticale (0,0)
    "const XC={id:'xc',type:'xfillet',name:'Chanfrein C',visible:true,chamfer:true,cmode:'eq',tangent:false,edges:[{pos:[0,0,20],pos0:[0,0,20],r:6}]};",
    "doc.features=[EX,XC];freshHard=true;occCkClear();",
    "const FR3=occFinalShape(null);",
    "const s3=FR3.shape;att(!!s3,'chanfrein : aucune forme');",
    "if(s3){",
    "  const L3=faces(s3);(FR3.msgs||[]).forEach(m=>p('  ! '+m));",
    "  const ch=L3.find(f=>{const b=box(f),n=occFaceOutNormal(f);return occSurfKind(f)==='Plane'&&n&&n[0]<-0.5&&n[1]<-0.5;});",
    "  const bch=ch&&occBlendOfFace(ch,s3,null);",
    "  p('C : '+JSON.stringify(bch));",
    "  att(bch&&bch.feat==='xc'&&bch.cham&&Math.abs(bch.r-6)<1e-9,'C : chanfrein non reconnu');",
    "  const side=L3.find(f=>{const n=occFaceOutNormal(f);return occSurfKind(f)==='Plane'&&n&&n[1]<-0.99;});",
    "  att(side&&occBlendOfFace(side,s3,null)===null,'C : face -Y voisine prise pour le chanfrein');",
    "}",
    // D. congé « arête seule » puis chanfrein sur le même corps : le congé ne laisse plus de
    // languettes (2 faces de 0,002 mm² le long des tangences) et le chanfrein s'applique
    // (avant : découpe « réussie » sans rien enlever, compteur 1/1, aucune alerte).
    "doc.features=[EX,XA];freshHard=true;occCkClear();",
    "const FD1=occFinalShape(null);",
    "att(FD1.shape&&faces(FD1.shape).length===7,'D : congé R10 seul : '+(FD1.shape?faces(FD1.shape).length:0)+' faces au lieu de 7 (languettes)');",
    "doc.features=[EX,XA,XC];freshHard=true;occCkClear();",
    "const FD=occFinalShape(null);",
    "const vD=FD.shape?vol(FD.shape):0,vAtt=240000-(100-Math.PI*25)*40-720;",
    "p('D : congé R10 + chanfrein 6 : volume '+vD.toFixed(1)+' (attendu '+vAtt.toFixed(1)+')');",
    "att(Math.abs(vD-vAtt)<0.5,'D : chanfrein après congé non appliqué (volume '+vD.toFixed(1)+')');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  ✗ '+m));}",
    "else{p('');p('TOUT EST CONFORME');}",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'face_conge_taille.js'});
  console.log(r);
  process.exit(/ECHECS|✗/.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.message)||e).slice(0,500));process.exit(1);});
