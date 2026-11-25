// Contour d'extrusion dont un arc n'a pas tout à fait le rayon de ses extrémités (V0.99.95).
// Cas réel : arc R accroché à un cercle projeté d'une autre pièce, de rayon R − 3e-7 ; le solveur
// laisse les extrémités à ~1e-7 du cercle de l'arc. occWireFromChain posait l'arc sur son cercle et la
// ligne sur le point de l'esquisse : écart à peine au-dessus de la tolérance du noyau (1e-7), MakeWire
// écartait l'arête SANS ERREUR, le contour restait ouvert et l'extrusion (4 faces, moitié du volume,
// invalide) effaçait toute la pièce à la fusion.
// Attendu : outil valide à 6 faces, volume du profil × hauteur, fusion avec une plaque valide.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{p((ok?'  ok ':'  KO ')+msg);if(!ok)ATT.push(msg);};",
    "const nf=function(sh){let n=0;const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);while(ex.More()){n++;ex.Next();}ex.delete();return n;};",
    "const valide=function(sh){const a=new occt.BRepCheck_Analyzer(sh,true,false);try{return a.IsValid_2();}finally{a.delete();}};",
    // oblong 40 × 12 (R6), posé sur le dessus d'une plaque à z = 4 ; ecH / ecB : écart des extrémités
    // des arcs gauche / droit par rapport à leur rayon (le cercle de l'arc reste R6)
    "const oblong=function(id,ecG,ecD){",
    "  const sk={id:id,name:id,plane:'XY',origin:[0,0,4],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[]};",
    "  const rg=6-ecG,rd=6-ecD;",
    "  [['g1',-20,rg],['g2',-20,-rg],['d1',20,rd],['d2',20,-rd],['cg',-20,0],['cd',20,0]].forEach(q=>{sk.points[q[0]]={x:q[1],y:q[2]};});",
    "  sk.entities.push({id:'lh',t:'line',p1:'g1',p2:'d1'});",
    "  sk.entities.push({id:'lb',t:'line',p1:'g2',p2:'d2'});",
    "  sk.entities.push({id:'ag',t:'arc',pc:'cg',pa:'g1',pb:'g2',r:6});",
    "  sk.entities.push({id:'ad',t:'arc',pc:'cd',pa:'d2',pb:'d1',r:6});",
    "  return sk;",
    "};",
    "const AIRE=40*12+Math.PI*36,H=20;",
    "const cas=[['cohérent',0,0],['un arc décalé de 1,5e-7',1.5e-7,0],['deux arcs décalés de 1,5e-7',1.5e-7,1.5e-7],['deux arcs décalés de 4e-7',4e-7,4e-7]];",
    "doc.sketches=cas.map((c,i)=>oblong('sk'+i,c[1],c[2]));",
    "doc.features=cas.map((c,i)=>({id:'ex'+i,type:'extrude',name:'Oblong '+i,sketchId:'sk'+i,op:'add',distance:H,visible:true,mid:false,upto:null}));",
    "occSkipFeat=null;",
    // plaque 60 × 30 × 4 sous l'oblong (z 0..4)
    "const plaque=function(){const a=new occt.gp_Pnt_3(-30,-15,0),b=new occt.gp_Pnt_3(30,15,4);const m=new occt.BRepPrimAPI_MakeBox_4(a,b);const s=m.Shape();m.delete();a.delete();b.delete();return s;};",
    "cas.forEach((c,i)=>{",
    "  p(c[0]+' :');",
    "  const o=occShapeOfExtrude(doc.features[i]);",
    "  const v=occShapeVolume(o.shape),n=nf(o.shape);",
    "  att(valide(o.shape),'outil valide');",
    "  att(n===6,'outil à 6 faces (2 plans, 2 cylindres, dessus, dessous) : '+n);",
    "  att(Math.abs(v-AIRE*H)<1e-2,'volume de l’outil '+v.toFixed(3)+' = '+(AIRE*H).toFixed(3));",
    "  const pl=plaque(),v0=occShapeVolume(pl);",
    "  const u=occFuse(pl,o.shape),vu=occShapeVolume(u);",
    "  att(valide(u),'plaque + oblong valide');",
    "  att(Math.abs(vu-(v0+AIRE*H))<1e-2,'volume de la fusion '+vu.toFixed(3)+' = plaque + oblong '+(v0+AIRE*H).toFixed(3));",
    "  try{u.delete();pl.delete();o.shape.delete();}catch(e){}occDispose(o.bins);",
    "});",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}",
    "else{p('');p('TOUT EST CONFORME');}",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'contour_arc_rayon.js'});
  console.log(r);
  process.exit(/ECHECS \(\d+\)/.test(r)?1:0);
})().catch(e=>{console.error('FATAL',String((e&&e.message)||e).slice(0,500));process.exit(1);});
