// 2026-11-10 : « Mise en plan : pouvoir tourner une vue de 90° dans un sens ou dans l'autre ».
// Vue de face 40 × 20 (trou Ø6) à (100,100), échelle 1 ; cotes horizontale, verticale, Ø ;
// vue de dessus projetée. ↺ puis ↻, et 4 × ↺ : retour exact ; la vue tourne autour de son centre,
// les cotes suivent (h ↔ v), la projection reste dessous et regarde depuis le nouveau haut du papier.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
let ko=0;
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  const near=(a,b,e)=>Math.abs(a-b)<(e||1e-6),vnear=(a,b)=>a.every((x,i)=>near(x,b[i]));
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet();
  sh.views.length=0;sh.dims.length=0;
  const v=mepAddViewStd('front');v.x=100;v.y=100;v.scale=1;v.axes=[];
  const els0=[
    {t:'L',x1:0,y1:0,x2:40,y2:0,k:'sharp'},{t:'L',x1:40,y1:0,x2:40,y2:20,k:'sharp'},
    {t:'L',x1:40,y1:20,x2:0,y2:20,k:'sharp'},{t:'L',x1:0,y1:20,x2:0,y2:0,k:'sharp'},
    {t:'C',cx:10,cy:5,r:3}];
  // géométrie projetée (le HLR n'existe pas ici) : els0 tournés de n quarts de tour ↺
  const rot=(x,y,n)=>{for(let i=0;i<((n%4)+4)%4;i++)[x,y]=[y,-x];return[x,y];};
  const geoN=n=>({src:'dxf',els:els0.map(e=>{const o=Object.assign({},e);
    if(e.t==='L'){[o.x1,o.y1]=rot(e.x1,e.y1,n);[o.x2,o.y2]=rot(e.x2,e.y2,n);}else{[o.cx,o.cy]=rot(e.cx,e.cy,n);}return o;})});
  T.setViewGeo(v,geoN(0));
  const b0={u:v.u.slice(),v:v.v.slice(),x:v.x,y:v.y};
  sh.dims.push({id:'dH',kind:'dist',vid:v.id,vid2:null,a:{x:0,y:0,hint:{t:'seg',i:0}},b:{x:40,y:0,hint:{t:'seg',i:1}},off:-8,orient:'h',tol:null});
  sh.dims.push({id:'dV',kind:'dist',vid:v.id,vid2:null,a:{x:40,y:0,hint:{t:'seg',i:1}},b:{x:40,y:20,hint:{t:'seg',i:2}},off:10,orient:'v',tol:null});
  sh.dims.push({id:'dD',kind:'dia',vid:v.id,vid2:null,a:{x:10,y:5,hint:{t:'ctr',i:4}},b:{x:-12,y:-10},off:0,tol:null});
  const top=mepProjectView('top',v);
  const D=id=>sh.dims.find(d=>d.id===id),M=id=>T.dimMeasure(D(id));
  const S=(q)=>({x:v.x+q.x*v.scale,y:v.y+q.y*v.scale});
  const sa0=S(D('dH').a),sd0=S(D('dD').b),C={x:120,y:110};
  // ↺ 90°
  T.rotateView(v,1);T.setViewGeo(v,geoN(1));
  A(vnear(v.u,b0.v)&&vnear(v.v,b0.u.map(x=>-x)),'↺ : u’ = v, v’ = −u');
  A(v.rq===1,'↺ : quart de tour retenu (rq = 1)');
  const bb=T.viewBBox(v);
  A(bb&&near(bb.x+bb.w/2,C.x)&&near(bb.y+bb.h/2,C.y),'↺ : la vue tourne autour de son centre (120,110) : '+(bb&&[bb.x+bb.w/2,bb.y+bb.h/2]));
  A(bb&&near(bb.w,20)&&near(bb.h,40),'↺ : 40 × 20 devient 20 × 40 sur le papier');
  const R=(p)=>({x:C.x+(p.y-C.y),y:C.y-(p.x-C.x)}); // ↺ sur le papier (y vers le bas)
  const sa1=S(D('dH').a),ra=R(sa0);
  A(near(sa1.x,ra.x)&&near(sa1.y,ra.y),'↺ : le point de cote suit la rotation du papier');
  const sd1=S(D('dD').b),rd=R(sd0);
  A(near(sd1.x,rd.x)&&near(sd1.y,rd.y),'↺ : l’étiquette du Ø suit la rotation');
  A(D('dH').orient==='v'&&near(D('dH').off,-8),'↺ : cote horizontale → verticale, même côté ('+D('dH').orient+' '+D('dH').off+')');
  A(D('dV').orient==='h'&&near(D('dV').off,-10),'↺ : cote verticale → horizontale, même côté ('+D('dV').orient+' '+D('dV').off+')');
  A(near(M('dH'),40)&&near(M('dV'),20)&&near(M('dD'),6),'↺ : valeurs 40 / 20 / Ø6 : '+[M('dH'),M('dV'),M('dD')]);
  A(vnear(top.dir,v.v.map(x=>-x)),'↺ : la vue de dessus regarde depuis le haut du papier tourné');
  A(near(top.x,v.x)&&top.y>v.y,'↺ : la vue de dessus reste sous la mère, alignée');
  // ↻ 90° : retour
  T.rotateView(v,-1);T.setViewGeo(v,geoN(0));
  A(vnear(v.u,b0.u)&&vnear(v.v,b0.v)&&!v.rq,'↻ : retour à la base d’origine');
  A(near(v.x,b0.x)&&near(v.y,b0.y),'↻ : retour à la place d’origine');
  A(D('dH').orient==='h'&&near(D('dH').off,-8)&&near(D('dH').a.x,0)&&near(D('dH').b.x,40),'↻ : cote horizontale d’origine');
  A(D('dV').orient==='v'&&near(D('dV').off,10),'↻ : cote verticale d’origine');
  // 4 × ↺
  for(let i=1;i<=4;i++){T.rotateView(v,1);T.setViewGeo(v,geoN(i));}
  A(vnear(v.u,b0.u)&&vnear(v.v,b0.v)&&!v.rq&&near(v.x,b0.x)&&near(v.y,b0.y),'4 × ↺ : tour complet, tout revient');
  A(near(D('dD').b.x,-12)&&near(D('dD').b.y,-10)&&D('dH').orient==='h'&&near(D('dH').off,-8),'4 × ↺ : cotes revenues');
  // vue projetée tournée elle-même : la rotation survit au rejeu
  T.rotateView(top,-1);T.reproject(v.id);
  A(top.rq===3,'vue projetée ↻ : rq = 3 gardé au rejeu');
  const X=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const td=v.v.map(x=>-x),tv=X(v.u,td); // dessus : dir = −v, u = u ; ↻ : u' = −v, v' = u
  A(vnear(top.dir,td)&&vnear(top.u,tv.map(x=>-x))&&vnear(top.v,v.u),'vue projetée ↻ : base de dessus tournée d’un quart horaire');
  return r;
})()`,ctx);
console.log('=== PLAN : tourner une vue de 90° ===');
out.log.filter(Boolean).forEach(m=>console.log('  ✓ '+m));
out.fails.forEach(m=>{ko++;console.log('  ✗ '+m);});
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(ko?1:0);
