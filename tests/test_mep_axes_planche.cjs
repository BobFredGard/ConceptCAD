// 2026-11-09 : PLAN — « coter le rayon ou diamètre d'un arc de cercle en traits d'axes … et ses 2 droites
// pour coter l'angle » (axe d'une rainure courbe tracé dans l'esquisse de planche) ; « supprimer un trait
// d'axe de centre de cercle » (croix automatique). Valeurs à la main.
// Vue à (100,100), échelle 2 : un tracé de planche de rayon 20 mm papier vaut R10 sur la pièce.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
let ko=0;
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet();
  sh.views.length=0;sh.dims.length=0;
  const v=mepAddViewStd('front');v.x=100;v.y=100;v.scale=2;v.axes=[];
  T.st().zoom=1;
  // contour de la pièce : carré de 60 (repère vue), la vue couvre 40..160 sur la planche
  T.setViewGeo(v,{src:'dxf',els:[{t:'L',x1:-30,y1:-30,x2:30,y2:-30},{t:'L',x1:30,y1:-30,x2:30,y2:30},
    {t:'L',x1:30,y1:30,x2:-30,y2:30},{t:'L',x1:-30,y1:30,x2:-30,y2:-30}]});
  // 1. axe de rainure courbe dans l'esquisse de planche : arc R20 papier centré (100,140), de -150° à -30°
  T.sk.style({lt:'axis'});
  const C={x:100,y:140},P=(a,R)=>({x:C.x+R*Math.cos(a*Math.PI/180),y:C.y+R*Math.sin(a*Math.PI/180)});
  const arc=T.sk.addArc(sh,C,P(-150,20),P(-30,20));
  T.sk.addLine(sh,C,P(-150,35));T.sk.addLine(sh,C,P(-30,35));
  A(arc&&arc.lt==='axis','arc tracé en trait d’axe');
  mepSetTool('dim');
  const hA=T.hitEnt(100,120,{axes:true});
  A(hA&&hA.i==='sk:'+arc.id&&hA.e.t==='A','outil Cote : l’arc de la planche est visé ('+(hA&&hA.i)+')');
  A(T.dimSelect(hA),'arc sélectionné');
  T.dimCommit({x:130,y:95});
  const dR=sh.dims[sh.dims.length-1];
  A(dR&&dR.kind==='rad'&&Math.abs(T.dimMeasure(dR)-10)<1e-6,'cote R = 10 sur la pièce ('+(dR&&dR.kind)+' '+(dR&&T.dimMeasure(dR))+')');
  A(/R10/.test(T.dimText(dR).replace(/\\s/g,'')),'texte « R10 » ('+T.dimText(dR)+')');
  const dD=Object.assign({},dR,{id:'dD',kind:'dia'});
  A(Math.abs(T.dimMeasure(dD)-20)<1e-6,'en diamètre : Ø20');
  // l'arc change de rayon : la cote suit
  const se=sh.sk.ents.find(e=>e.id===arc.id);se.r=30;
  A(Math.abs(T.dimMeasure(dR)-15)<1e-6,'arc agrandi à 30 papier : la cote suit, R15 ('+T.dimMeasure(dR)+')');
  se.r=20;
  // 2. les 2 droites : angle
  mepSetTool('dim');
  const l1=T.hitEnt(P(-150,27).x,P(-150,27).y,{axes:true}),l2=T.hitEnt(P(-30,27).x,P(-30,27).y,{axes:true});
  A(l1&&l2&&/^sk:/.test(l1.i)&&/^sk:/.test(l2.i)&&l1.e.t==='L'&&l2.e.t==='L','les 2 droites de la planche sont visées');
  A(T.dimSelect(l1)&&T.dimAdd(l2),'2 droites sélectionnées');
  T.dimCommit({x:100,y:115});
  const dA=sh.dims[sh.dims.length-1];
  A(dA&&dA.kind==='ang'&&Math.abs(T.dimMeasure(dA)-120)<1e-6,'angle entre les 2 droites = 120° ('+(dA&&dA.kind)+' '+(dA&&T.dimMeasure(dA))+')');
  // 3. croix de centre automatique : Suppr la retire en entier, Réafficher la rend
  const auto=[{t:'L',x1:-5,y1:0,x2:5,y2:0,cls:'mepAxisCross'},{t:'L',x1:0,y1:-5,x2:0,y2:5,cls:'mepAxisCross'},
    {t:'L',x1:20,y1:-25,x2:20,y2:25,cls:'mepAxis'}];
  let L=T.axisLines(v,auto);
  A(L.length===3,'3 axes automatiques');
  A(T.axisHide(v,L[0].ak),'Suppr sur un trait de la croix');
  L=T.axisLines(v,auto);
  A(L.length===1&&L[0].x1===20,'la croix part en entier, l’autre axe reste ('+L.length+')');
  A(Array.isArray(v.axHide)&&v.axHide.length===2,'2 clés mémorisées dans la vue');
  delete v.axHide;
  A(T.axisLines(v,auto).length===3,'Réafficher : la croix revient');
  // 4. rainure circulaire (V0.73.0) : axe R12, demi-largeur 3, de -150° à -30° autour de (0,10) — axes
  //    automatiques (arc d'axe, 2 traits vers les bouts, croix du centre) : l'arc se cote en R / Ø, les 2 traits en angle
  sh.dims.length=0;sh.sk=null;
  const c0={x:0,y:10},q=(a,R)=>({x:c0.x+R*Math.cos(a*Math.PI/180),y:c0.y+R*Math.sin(a*Math.PI/180)});
  const ra0=-150*Math.PI/180,ra1=-30*Math.PI/180,S0=q(-150,12),S1=q(-30,12);
  const carre=[{t:'L',x1:-30,y1:-30,x2:30,y2:-30},{t:'L',x1:30,y1:-30,x2:30,y2:30},{t:'L',x1:30,y1:30,x2:-30,y2:30},{t:'L',x1:-30,y1:30,x2:-30,y2:-30}];
  T.setViewGeo(v,{src:'dxf',els:carre.concat([{t:'A',cx:0,cy:10,r:15,a0:ra0,a1:ra1},{t:'A',cx:0,cy:10,r:9,a0:ra0,a1:ra1},
    {t:'A',cx:S0.x,cy:S0.y,r:3,a0:ra0+Math.PI,a1:ra0+2*Math.PI},{t:'A',cx:S1.x,cy:S1.y,r:3,a0:ra1,a1:ra1+Math.PI}])});
  A(T.aslotsOf(v).length===1,'rainure circulaire reconnue');
  v.autoAxes=true;
  const sc=p=>({x:v.x+p.x*v.scale,y:v.y+p.y*v.scale});
  mepSetTool('dim');
  const pa=sc(q(-90,12)),hR=T.hitEnt(pa.x,pa.y,{axes:true});
  A(hR&&/^ax:/.test(hR.i)&&hR.e.t==='A','outil Cote : l’arc d’axe automatique est visé ('+(hR&&hR.i)+')');
  A(T.dimSelect(hR),'arc d’axe sélectionné');
  T.dimCommit({x:pa.x+20,y:pa.y-25});
  const dR2=sh.dims[sh.dims.length-1];
  A(dR2&&dR2.kind==='rad'&&Math.abs(T.dimMeasure(dR2)-12)<1e-6,'arc d’axe : R12 ('+(dR2&&dR2.kind)+' '+(dR2&&T.dimMeasure(dR2))+')');
  const hors=sc(q(90,12)),hH=T.hitEnt(hors.x,hors.y,{axes:true});
  A(!hH||hH.e.t!=='A','hors de l’arc (même rayon, de l’autre côté) : rien de visé');
  mepSetTool('dim');
  const m1=sc(q(-150,6)),m2=sc(q(-30,6)),h1=T.hitEnt(m1.x,m1.y,{axes:true}),h2=T.hitEnt(m2.x,m2.y,{axes:true});
  A(h1&&h2&&h1.e.t==='L'&&h2.e.t==='L'&&T.dimSelect(h1)&&T.dimAdd(h2),'les 2 traits vers les bouts sélectionnés');
  T.dimCommit(sc(q(-90,5)));
  const dA2=sh.dims[sh.dims.length-1];
  A(dA2&&dA2.kind==='ang'&&Math.abs(T.dimMeasure(dA2)-120)<1e-6,'angle de la rainure = 120° ('+(dA2&&T.dimMeasure(dA2))+')');
  let LL=T.axisLines(v);
  const n0=LL.length,cr=LL.find(p=>p.cls==='mepAxisCross');
  A(cr&&T.axisHide(v,cr.ak),'Suppr sur la croix du centre (axe automatique)');
  LL=T.axisLines(v);
  A(LL.length===n0-2&&!LL.some(p=>p.cls==='mepAxisCross')&&LL.some(p=>p.t==='A'),'la croix part, l’arc et ses traits restent ('+n0+' → '+LL.length+')');
  A(Math.abs(T.dimMeasure(dR2)-12)<1e-6&&Math.abs(T.dimMeasure(dA2)-120)<1e-6,'les cotes R et angle restent justes');
  delete v.axHide;v.autoAxes=false;
  // 5. même rainure, axe posé à la main : Suppr sur la croix ne retire que la croix ; ailleurs, l'axe entier
  v.axes.push({id:'axR',kind:'aslot',s:{cx:0,cy:10,R:12,w:3,a0:ra0,sw:ra1-ra0}});
  mepSetTool('dim'); // redessin : traits d'axe recalculés
  LL=T.axisLines(v);
  const m0=LL.length,crm=LL.find(p=>p.ann&&p.cls==='mepAxisCross'),arcm=LL.find(p=>p.ann&&p.t==='A');
  A(crm&&T.axisHide(v,crm.ak),'axe à la main : Suppr sur sa croix');
  LL=T.axisLines(v);
  A(LL.length===m0-2&&v.axes.length===1&&LL.some(p=>p.t==='A'),'la croix part, l’axe reste ('+m0+' → '+LL.length+')');
  A(arcm&&!T.axisHide(v,arcm.ak),'Suppr sur l’arc d’un axe à la main : pas un simple masquage (l’axe entier sera supprimé)');
  delete v.axHide;v.axes.length=0;
  return r;
})();`,ctx);
out.log.forEach(m=>console.log('  ok  '+m));
out.fails.forEach(m=>{console.log('  KO  '+m);ko++;});
console.log(ko?('test_mep_axes_planche : '+ko+' échec(s)'):'test_mep_axes_planche : OK ('+out.log.length+')');
process.exit(ko?1:0);
