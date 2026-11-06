// 2026-11-02 : TRAITS D'AXE SUR TOUTE GÉOMÉTRIE DE RÉVOLUTION — « mettre des traits d'axe sur
// n'importe quelle géométrie du 3D, STEP ou natif, cercle extrudé… tous types de cercle ».
// Corps natif : cercle Ø20 extrudé de 30 (axe Z) + cône (chanfrein 45° sur l'arête du haut).
// Vérifie : axes lus sur le solide exact d'un corps NATIF (cylindre, cône, arêtes circulaires),
// automatique en vue de bout (croix) et de côté (trait), clic manuel sur le cercle / la génératrice,
// référence 3D suivie quand le modèle change, et repli 2D sur un cercle de la vue.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};showAll=function(){};',ctx);
  const r=await vm.runInContext(`(async()=>{
    const out={};
    const circ=(id,x,y,R)=>({id,name:id,plane:'XY',origin:[0,0,0],points:{c:{x,y}},entities:[{id:'e',t:'circle',pc:'c',r:R}],constraints:[],dims:[]});
    doc.sketches=[circ('sk_c',5,7,10)];doc.cgeo=[];
    doc.features=[{id:'ex_c',type:'extrude',name:'Cylindre',sketchId:'sk_c',op:'add',distance:30,visible:true}];
    markDirty();rebuild();
    const bd=bodies.find(b=>b.kind==='body'&&b.shape);
    out.body=!!bd;
    try{mepSetActive(true);}catch(err){out.err='mepSetActive '+err.message;}
    const T=window.__mepTest;
    try{out.revs=T.shapeRevs(bd).map(g=>({d:g.d.map(x=>+x.toFixed(3)),o:g.o.map(x=>+x.toFixed(2)),r:+g.r.toFixed(2),L:+(g.t1-g.t0).toFixed(1),u:+g.u.toFixed(2)}));}catch(err){out.err=(out.err||'')+' revs '+err.message;}
    const mk=(id,dir,u,v)=>({id,kind:'base',dir,u,v,x:100,y:100,scale:1,mode:'hide',tangent:false,hlrExact:true,flip:false,axes:[],autoAxes:true});
    const sh=T.sheet();
    const vb=mk('vb',[0,0,1],[1,0,0],[0,1,0]),vc=mk('vc',[0,-1,0],[1,0,0],[0,0,1]);
    sh.views.length=0;sh.views.push(vb,vc); // repère de vue : y planche = −v
    const cnt=ps=>({lines:ps.filter(p=>p.t==='L'&&p.cls==='mepAxis').length,cross:ps.filter(p=>p.cls==='mepAxisCross').length,ps:ps.map(p=>p.t==='L'?[+p.x1.toFixed(2),+p.y1.toFixed(2),+p.x2.toFixed(2),+p.y2.toFixed(2)]:[p.t])});
    try{out.bout=cnt(T.axisAuto(vb));out.cote=cnt(T.axisAuto(vc));}catch(err){out.err=(out.err||'')+' auto '+err.message;}
    // clic manuel : sur le cercle en vue de bout (x=5+10, y=7) et sur la génératrice en vue de côté (x=15, z=15)
    vb.autoAxes=false;vc.autoAxes=false;
    try{const g1=T.axisGeoAt(100+15,100-7);out.pickB=g1&&g1.ax?{vid:g1.vid,r:+g1.ax.r.toFixed(2)}:g1;
      const g2=T.axisGeoAt(100+15.2,100-15);out.pickC=g2&&g2.ax?{vid:g2.vid,r:+g2.ax.r.toFixed(2)}:g2;
      if(g2&&g2.ax){const ann={id:'axR',kind:'hole',ref:g2};vc.axes.push(ann);
        out.manC=cnt(T.axisManual(vc,ann));
        // le modèle change : cylindre déplacé et allongé → l'axe suit
        doc.sketches[0].points.c={x:6,y:7};doc.features[0].distance=40;markDirty();rebuild();
        out.manC2=cnt(T.axisManual(vc,ann));}
      // repli 2D : cercle de la vue sans solide exact
      const ref2={vid:'vb',c:{cx:5,cy:7,r:10}};
      const h=T.axisRefGeom(vb,ref2);out.circ=h?[+h.x.toFixed(2),+h.y.toFixed(2),+h.r.toFixed(2)]:null;
    }catch(err){out.err=(out.err||'')+' pick '+err.stack;}
    // cône et tore seuls (aucun cylindre) : axe X reconnu quand même
    try{const ax=new occt.gp_Ax2_3(new occt.gp_Pnt_3(0,2,3),new occt.gp_Dir_4(1,0,0));
      const cone=new occt.BRepPrimAPI_MakeCone_3(ax,8,3,12).Shape();
      const tor=new occt.BRepPrimAPI_MakeTorus_1(15,2).Shape();
      const lst=sh=>T.shapeRevs({id:'x'+Math.random(),shape:sh}).map(g=>({d:g.d.map(x=>+x.toFixed(3)),o:g.o.map(x=>+x.toFixed(2)),r:+g.r.toFixed(2),L:+(g.t1-g.t0).toFixed(1),u:+g.u.toFixed(2)}));
      out.cone=lst(cone);out.tor=lst(tor);}catch(err){out.err=(out.err||'')+' cone '+err.message;}
    return out;
  })()`,ctx);
  if(r.err)console.log('  (info) '+r.err);
  console.log('  · révolutions : '+JSON.stringify(r.revs));
  console.log('  · auto bout '+JSON.stringify(r.bout)+' ; côté '+JSON.stringify(r.cote));
  console.log('  · clic bout '+JSON.stringify(r.pickB)+' ; clic côté '+JSON.stringify(r.pickC)+' ; manuel '+JSON.stringify(r.manC)+' → '+JSON.stringify(r.manC2));
  A(r.body,'corps natif exact (cercle extrudé)');
  A(Array.isArray(r.revs)&&r.revs.length===1&&Math.abs(r.revs[0].d[2]-1)<1e-3&&r.revs[0].o[0]===5&&r.revs[0].o[1]===7&&r.revs[0].L===30,'un seul axe Z en (5,7), longueur 30, sur le corps natif');
  A(r.bout&&r.bout.cross===2,'vue de bout : croix de centre automatique sur le cylindre natif');
  A(r.cote&&r.cote.lines===1,'vue de côté : trait d’axe automatique sur le cylindre natif');
  A(r.pickB&&r.pickB.vid==='vb'&&r.pickB.r===10,'clic sur le cercle en vue de bout → axe 3D R10');
  A(r.pickC&&r.pickC.vid==='vc'&&r.pickC.r===10,'clic sur la génératrice en vue de côté → axe 3D R10');
  A(r.manC&&r.manC.lines===1&&r.manC.ps[0][0]===5&&r.manC.ps[0][1]===3&&r.manC.ps[0][3]===-33,'axe manuel de côté : x=5, de z −3 à 33');
  A(r.manC2&&r.manC2.lines===1&&r.manC2.ps[0][0]===6&&r.manC2.ps[0][3]===-43,'l’axe manuel suit le modèle (x=6, jusqu’à 43)');
  console.log('  · cône '+JSON.stringify(r.cone)+' ; tore '+JSON.stringify(r.tor));
  A(Array.isArray(r.cone)&&r.cone.length===1&&r.cone[0].d[0]===1&&r.cone[0].o[1]===2&&r.cone[0].o[2]===3&&r.cone[0].L===12&&r.cone[0].r===8&&r.cone[0].u>=6.28,'cône : axe X en (y2, z3), longueur 12, R8');
  A(Array.isArray(r.tor)&&r.tor.length===1&&r.tor[0].d[2]===1&&r.tor[0].o[0]===0&&r.tor[0].o[1]===0,'tore : axe Z à l’origine');
  A(Array.isArray(r.circ)&&r.circ[0]===5&&r.circ[1]===7&&r.circ[2]===10,'cercle 2D de la vue : centre et rayon retrouvés');
  console.log(ko?'ÉCHEC '+ko:'OK');
  process.exit(ko?1:0);
})();
