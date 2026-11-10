// Coque soufflée (V0.79.0, src/87-coque-souffle.js), sur noyau réel.
// Pièce : bloc 100 × 60 × 30 (dessus z = 30, la face poussée), creusé par dessous d'une rainure
// ÉTROITE (14 mm de large, 8 de profondeur) et d'une rainure LARGE (40 mm, 8 de profondeur).
// Distance 5 mm :
//  - creux enjambés 0 (parallèle pure) : la rainure étroite reste un sillon de 4 mm dans la peau ;
//  - creux enjambés 20 : la bille de 20 mm n'y entre pas, la peau passe par-dessus ;
//  - la rainure large (40 − 2×5 = 30 mm > 20) est suivie dans les deux cas ;
//  - la peau déborde de 5 mm sur les côtés, s'arrête au plan du dessus ;
//  - coque = bloc plein − pièce (volumes), solides valides, la pièce reste creuse dedans ;
//  - rejeu (occApplySouffle) : face retrouvée, nom, signature de cache sensible aux réglages.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=String.raw`
  const out={fails:[],log:[]};
  const A=(c,m)=>{(c?out.log:out.fails).push(m);};
  const vol=s=>{const g=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_2(s,g,1e-4,false,false,false);const m=g.Mass();g.delete();return m;};
  const box=(x0,y0,z0,x1,y1,z1)=>{const p=new occt.gp_Pnt_3(x0,y0,z0),q=new occt.gp_Pnt_3(x1,y1,z1);const m=new occt.BRepPrimAPI_MakeBox_3(p,q);const s=m.Shape();[m,p,q].forEach(o=>o.delete());return s;};
  let piece=box(0,0,0,100,60,30);
  for(const [x0,x1] of [[15,29],[50,90]]){const t=box(x0,-1,-1,x1,61,8);const n=occCut(piece,t);piece.delete();t.delete();piece=n;}
  const v0=vol(piece);
  A(Math.abs(v0-(100*60*30-14*60*8-40*60*8))<1,'pièce : '+v0.toFixed(0)+' mm³');
  const faces=occSubShapes(piece,'TopAbs_FACE');
  const top=faces.find(f=>{const r=occFaceRef(f);return r&&Math.abs(r.pos[2]-30)<1e-6;});
  A(!!top,'dessus trouvé (face poussée)');
  const IN=occt.TopAbs_State.TopAbs_IN;
  const dedans=(s,x,y,z)=>{const c=new occt.BRepClass3d_SolidClassifier_1();c.Load(s);const p=new occt.gp_Pnt_3(x,y,z);c.Perform(p,1e-6);const r=c.State()===IN;c.delete();p.delete();return r;};
  const env={};
  for(const pont of [0,20]){
    const t0=Date.now();let s=null,err=null;
    try{s=occSoufEnveloppe(piece,top,{vers:'ext',dist:5,lis:0,pont,plein:true},null);}catch(e){err=String((e&&e.message)||e);}
    A(!!s,'bloc plein, creux '+pont+' : calculé en '+(Date.now()-t0)+' ms'+(err?' — '+err:''));
    if(!s)continue;
    env[pont]=s;
    A(occCoqueValide(s),'bloc plein, creux '+pont+' : solide valide');
    const v=vol(s);
    // bords mesurés par points (la boîte du noyau englobe les pôles de la surface, pas la surface)
    const bord=z=>{let lo=-9,hi=0;for(let i=0;i<30;i++){const m=(lo+hi)/2;if(dedans(s,m,30,z))hi=m;else lo=m;}return -(lo+hi)/2;};
    const L=[29.5,25,15,5,0].map(bord);
    A(L.every(x=>Math.abs(x-5)<1.3),'creux '+pont+' : 5 mm de plus sur le côté (paroi verticale, pas de 1 mm : '+L.map(x=>x.toFixed(2)).join(' ')+')');
    A(dedans(s,50,30,29.9)&&!dedans(s,50,30,30.1)&&!dedans(s,-4,30,30.2),'creux '+pont+' : arrêtée au plan du dessus');
    A(dedans(s,35,30,-4.4)&&!dedans(s,35,30,-5.6),'creux '+pont+' : 5 mm sous la pièce (à ±0,6 mm)');
    A(v>v0,'creux '+pont+' : la peau contient la pièce ('+v.toFixed(0)+' > '+v0.toFixed(0)+')');
    A(dedans(s,22,30,15)&&dedans(s,50,30,-3)&&dedans(s,-3,30,15),'creux '+pont+' : pièce et couche de 5 mm à l’intérieur');
    A(!dedans(s,70,30,1)&&!dedans(s,-7,30,15),'creux '+pont+' : rainure large suivie, rien au-delà de 5 mm');
  }
  if(env[0]&&env[20]){
    A(!dedans(env[0],22,30,2),'creux 0 (parallèle) : la rainure étroite reste un sillon dans la peau');
    A(dedans(env[20],22,30,2),'creux 20 : la rainure étroite est enjambée');
  }
  // précision fine (0,5 mm) : la paroi verticale est tenue deux fois mieux
  {const s=occSoufEnveloppe(piece,top,{vers:'ext',dist:5,lis:0,pont:20,plein:true,pas:0.5},null);
    const bord=z=>{let lo=-9,hi=0;for(let i=0;i<30;i++){const m=(lo+hi)/2;if(dedans(s,m,30,z))hi=m;else lo=m;}return -(lo+hi)/2;};
    const L=[29.5,25,15,5,0].map(bord);
    A(occCoqueValide(s)&&L.every(x=>Math.abs(x-5)<0.7),'précision fine : 5 mm sur le côté à ±0,7 ('+L.map(x=>x.toFixed(2)).join(' ')+')');
    s.delete();}
  // coque : la pièce creusée dans la peau, sans booléen
  let c=null,err=null;const t1=Date.now();
  try{c=occSoufEnveloppe(piece,top,{vers:'ext',dist:5,lis:0,pont:20},null);}catch(e){err=String((e&&e.message)||e);}
  A(!!c,'coque : calculée en '+(Date.now()-t1)+' ms'+(err?' — '+err:''));
  if(c&&env[20]){
    A(occCoqueValide(c),'coque : solide valide');
    const vc=vol(c),ve=vol(env[20]);
    A(Math.abs(vc-(ve-v0))<1e-3*ve,'coque = bloc plein − pièce ('+vc.toFixed(0)+' / '+(ve-v0).toFixed(0)+')');
    A(!dedans(c,50,30,20)&&dedans(c,50,30,-3)&&dedans(c,22,30,2),'coque : la pièce est creuse dedans, la peau et le pont autour');
  }
  // rejeu : face retrouvée par sa référence, entrée libérée, nom et signature
  const ref=occFaceRef(top);
  const f={type:'xshell',kind:'souffle',vers:'ext',faces:[ref],dist:5,lis:0,pont:20,plein:true};
  const cp=occShapeCopy(piece);
  const r=occApplySouffle(cp,f);
  A(r&&r.shape&&r.shape!==cp&&!r.fatal&&!f._err,'rejeu : coque soufflée appliquée');
  A(r&&r.shape&&Math.abs(vol(r.shape)-vol(env[20]))<1e-6*vol(env[20]),'rejeu : même solide que le calcul direct');
  A(soufName(f)==='Peau soufflée 5 mm · creux de 20 mm enjambés · bloc plein','nom : '+soufName(f));
  A(shellName(f)===soufName(f),'nom de coque : délégué à la coque soufflée');
  const s1=soufSig(f);f.pont=10;const s2=soufSig(f);f.flip=true;const s3=soufSig(f);
  A(s1!==s2&&s2!==s3,'signature de cache : change avec les creux et le sens');
  const r2=occApplySouffle(occShapeCopy(piece),{type:'xshell',kind:'souffle',faces:[],dist:5,pont:20});
  A(r2&&r2.fatal,'rejeu : sans face poussée, refus signalé');
  // ===== vers l'intérieur (défaut) : la face poussée descend dans la pièce jusqu'à 5 mm de l'extérieur =====
  // bloc 100 × 60 × 30, rainure étroite par-dessous (x 15…29, haut z 8), pied large de 16 mm (x 62…78, z −10…0)
  let p2=box(0,0,0,100,60,30);
  {const t=box(15,-1,-1,29,61,8);const n=occCut(p2,t);p2.delete();t.delete();p2=n;}
  {const t=box(62,0,-10,78,60,0.5);const n=occFuse(p2,t);p2.delete();t.delete();p2=occUnify(n);}
  const top2=occSubShapes(p2,'TopAbs_FACE').find(f=>{const r=occFaceRef(f);return r&&Math.abs(r.pos[2]-30)<1e-6;});
  const v2=vol(p2);
  const cr={};
  for(const pont of [0,20]){
    let s=null,err=null;const t0=Date.now();
    try{s=occSoufEnveloppe(p2,top2,{dist:5,lis:0,pont},null);}catch(e){err=String((e&&e.message)||e);}
    A(!!s,'creuser, creux '+pont+' : calculé en '+(Date.now()-t0)+' ms'+(err?' — '+err:''));
    if(!s)continue;cr[pont]=s;
    A(occCoqueValide(s),'creuser, creux '+pont+' : solide valide');
    const v=vol(s);A(v<v2*0.8&&v>0,'creuser, creux '+pont+' : matière retirée ('+v.toFixed(0)+' / '+v2.toFixed(0)+')');
    A(dedans(s,98,30,20)&&dedans(s,95.6,30,20)&&!dedans(s,94.4,30,20)&&dedans(s,50,55.6,20)&&!dedans(s,50,54.4,20),'creuser, creux '+pont+' : parois de 5 mm (à ±0,6), l’extérieur intact');
    A(dedans(s,40,30,4.4)&&!dedans(s,40,30,5.6),'creuser, creux '+pont+' : fond de 5 mm');
    A(dedans(s,22,30,12.4)&&!dedans(s,22,30,14.5),'creuser, creux '+pont+' : le fond remonte au-dessus de la rainure (5 mm au-dessus de son plafond)');
    A(!dedans(s,50,30,29.9)&&dedans(s,2,30,29.9),'creuser, creux '+pont+' : ouvert par la face poussée, bord gardé');
    A(!dedans(s,-1,30,15)&&!dedans(s,50,30,31),'creuser, creux '+pont+' : rien hors de la pièce');
  }
  if(cr[0]&&cr[20]){
    A(!dedans(cr[0],70,30,-3),'creuser, creux 0 : la face descend dans le pied (poche de 6 mm)');
    A(dedans(cr[20],70,30,-3),'creuser, creux 20 : le pied n’est pas creusé (poche plus étroite que 20 mm)');
  }
  { // lissage : arrondit sans jamais amincir (creuser : jamais plus profond ; peau : jamais plus près)
    const G={nu:40,nv:30,h:1,H:null},N=1200,E0=new Float32Array(N);
    for(let c=0;c<N;c++){const i=c%40,j=(c/40)|0;E0[c]=i<3?-Infinity:10+((i>>2)&1)*4+Math.sin(j)*0.5;}
    const Ei=soufLisse(E0,G,3,true),Ee=soufLisse(E0,G,3,false);let okI=true,okE=true,bouge=false;
    for(let c=0;c<N;c++){if(E0[c]===-Infinity){if(Ei[c]!==-Infinity)okI=false;continue;}if(Ei[c]>E0[c]+1e-6)okI=false;if(Ee[c]<E0[c]-1e-6)okE=false;if(Math.abs(Ei[c]-E0[c])>0.1)bouge=true;}
    A(okI&&okE&&bouge,'lissage : plis arrondis, jamais du côté de l’extérieur');
    let s0=null;try{s0=occSoufEnveloppe(p2,top2,{dist:5,pont:20,lis:3},null);}catch(e){}
    A(s0&&cr[20]&&occCoqueValide(s0)&&vol(s0)>=vol(cr[20])-1e-6*v2&&dedans(s0,95.6,30,20)&&!dedans(s0,94.4,30,20)&&dedans(s0,40,30,4.4)&&!dedans(s0,50,30,29.9),'lissage 3 mm : solide valide, autant ou plus de matière, parois et fond de 5 mm gardés, ouvert');
    if(s0)s0.delete();
    const fa={type:'xshell',kind:'souffle',dist:5,pont:20};
    A(soufLis(fa)===3&&soufSig(fa)!==soufSig(Object.assign({},fa,{lis:0})),'lissage : 3 mm par défaut, signature sensible');}
  {const f2={type:'xshell',kind:'souffle',faces:[occFaceRef(top2)],dist:5,lis:0,pont:20};
    A(soufName(f2)==='Coque soufflée · paroi 5 mm · creux de 20 mm enjambés','nom (creuser) : '+soufName(f2));
    A(soufSig(f2)!==soufSig(Object.assign({},f2,{vers:'ext'})),'signature : change avec le sens intérieur / extérieur');
    const r3=occApplySouffle(occShapeCopy(p2),f2);
    A(r3&&!r3.fatal&&r3.shape&&cr[20]&&Math.abs(vol(r3.shape)-vol(cr[20]))<1e-6*v2,'rejeu (creuser) : même solide');}
  return out;`
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Coque soufflée ===');
  o.log.forEach(m=>console.log('  ✓ '+m));
  o.fails.forEach(m=>console.log('  ✗ '+m));
  console.log(o.fails.length?'ÉCHEC : '+o.fails.length:'*** TOUT PASSE ***');
  process.exit(o.fails.length?1:0);
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
