// 2026-11-13 : PLAN, outils de cotation — « si je sélectionne un cercle ou un arc de cercle, je prends
// son centre » : un clic SUR un cercle ou un arc donne son centre (distance point → point, chaîne,
// ordonnées), jamais le point du cercle sous la souris. Le dessin libre garde le point sur le cercle.
// Vue à (100,100), échelle 1 : trait vertical x = 0 (y de 0 à 40), trou Ø10 en (30,10), arc R8 en (60,10).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  const near=(p,x,y)=>!!p&&Math.abs(p.x-x)<1e-6&&Math.abs(p.y-y)<1e-6;
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet();
  sh.views.length=0;sh.dims.length=0;
  const v=mepAddViewStd('front');v.x=100;v.y=100;v.scale=1;v.axes=[];
  T.setViewGeo(v,{src:'dxf',els:[{t:'L',x1:0,y1:0,x2:0,y2:40},
    {t:'C',cx:30,cy:10,r:5},{t:'A',cx:60,cy:10,r:8,a0:0,a1:Math.PI}]});
  T.st().zoom=1;
  // accrochage : sur le cercle → centre avec {ctr}, point du cercle sans
  const s1=T.snapPt(135.2,110,{ctr:true}),s0=T.snapPt(135.2,110);
  A(near(s1,130,110)&&s1.hit&&s1.hit.t==='ctr','cercle visé → centre ('+s1.x+','+s1.y+')');
  A(near(s0,135,110),'dessin libre : point sur le cercle ('+s0.x+','+s0.y+')');
  const s2=T.snapPt(160,118.2,{ctr:true});
  A(near(s2,160,110)&&s2.hit.t==='ctr','arc visé → centre ('+s2.x+','+s2.y+')');
  // distance : 1ᵉʳ point au milieu du trait, 2ᵉ clic sur le bord du trou → entraxe trait ↔ centre = 30
  mepSetTool('dim');
  T.setSnapMode('mid');T.dimClick({x:100.2,y:120});
  T.setSnapMode(null);T.dimClick({x:130,y:105.1});T.dimClick({x:115,y:150});
  const d1=sh.dims[sh.dims.length-1];if(!d1){r.fails.push('pas de cote : '+JSON.stringify(T.st().dim));return r;}
  A(d1&&near(d1.b,30,10),'distance : 2ᵉ point = centre du trou ('+(d1&&d1.b.x)+','+(d1&&d1.b.y)+')');
  A(d1&&d1.b.hint,'distance : centre référencé (suit la pièce)');
  // chaîne : depuis le centre du trou, clic sur l'arc → centre de l'arc (30 mm)
  T.chainStart(d1,'b');
  T.chainClick({x:160,y:118.1});
  const d2=sh.dims[sh.dims.length-1];
  A(d2&&d2!==d1&&near(d2.b,60,10),'chaîne : point suivant = centre de l’arc ('+(d2&&d2.b.x)+','+(d2&&d2.b.y)+')');
  T.chainEnd();
  // ordonnées : origine au bas du trait, point sur le trou → centre
  mepSetTool('ordx');
  T.ordClick({x:100,y:100.2},'x');
  T.ordClick({x:130,y:114.9},'x');
  const o=sh.dims[sh.dims.length-1];
  A(o&&o.kind==='ord'&&o.pts.length===1&&near(o.pts[0],30,10),'ordonnées : point = centre du trou');
  T.ordEnd();
  return r;
})()`,ctx);
out.log.forEach(m=>console.log('  ok  '+m));
out.fails.forEach(m=>console.log('  KO  '+m));
console.log(out.fails.length?'ÉCHEC ('+out.fails.length+')':'OK ('+out.log.length+' vérifications)');
process.exit(out.fails.length?1:0);
