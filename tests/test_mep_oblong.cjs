// 2026-11-06 : PLAN — un oblong se repère par ses 2 centres : reconnu à sa forme, axe et centres
// d'un clic (outil Axes), cotes accrochées aux centres qui suivent un allongement. Valeurs à la main.
// Vue à (100,100), échelle 1. Oblong de référence : centres (10,0) et (40,0), R5.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
let ko=0;
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  const near=(p,x,y,t)=>!!p&&Math.abs(p.x-x)<(t||1e-6)&&Math.abs(p.y-y)<(t||1e-6);
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet();
  sh.views.length=0;sh.dims.length=0;
  const v=mepAddViewStd('front');v.x=100;v.y=100;v.scale=1;v.axes=[];
  T.st().zoom=1;
  // oblong d'entraxe c1→c2, de rayon R ; arcs tournés vers l'extérieur
  const slot=(x1,y1,x2,y2,R)=>{
    const a=Math.atan2(y2-y1,x2-x1),nx=-Math.sin(a)*R,ny=Math.cos(a)*R;
    return [
      {t:'A',cx:x1,cy:y1,r:R,a0:a+Math.PI/2,a1:a+3*Math.PI/2},
      {t:'A',cx:x2,cy:y2,r:R,a0:a-Math.PI/2,a1:a+Math.PI/2},
      {t:'L',x1:x1+nx,y1:y1+ny,x2:x2+nx,y2:y2+ny},
      {t:'L',x1:x1-nx,y1:y1-ny,x2:x2-nx,y2:y2-ny}];
  };
  const bord={t:'L',x1:-20,y1:-30,x2:-20,y2:30};
  const geo=els=>T.setViewGeo(v,{src:'dxf',els});
  // 1. reconnaissance
  geo(slot(10,0,40,0,5).concat([bord]));
  let S=T.slotsOf(v);
  A(S.length===1&&near({x:S[0].x1,y:S[0].y1},10,0)&&near({x:S[0].x2,y:S[0].y2},40,0)&&S[0].r===5,'oblong horizontal : centres (10,0) et (40,0), R5');
  geo(slot(0,0,30,40,4));
  A(T.slotsOf(v).length===1&&Math.abs(T.slotsOf(v)[0].d-50)<1e-9,'oblong oblique reconnu, entraxe 50');
  const dbl=slot(10,0,40,0,5);
  geo(dbl.concat(dbl.map(e=>Object.assign({},e,{k:'hid'}))));
  A(T.slotsOf(v).length===1,'arcs et côtés en double (vu + caché) : un seul oblong');
  const decoupe=slot(10,0,40,0,5);
  decoupe[0]={t:'A',cx:10,cy:0,r:5,a0:Math.PI/2,a1:Math.PI};decoupe.push({t:'A',cx:10,cy:0,r:5,a0:Math.PI,a1:3*Math.PI/2});
  geo(decoupe);
  A(T.slotsOf(v).length===1,'demi-cercle en 2 quarts : reconnu');
  geo(slot(10,0,40,0,5).slice(0,3));
  A(T.slotsOf(v).length===0,'un seul côté droit : pas un oblong');
  const inv=slot(10,0,40,0,5);
  inv[0]={t:'A',cx:10,cy:0,r:5,a0:-Math.PI/2,a1:Math.PI/2};
  geo(inv);
  A(T.slotsOf(v).length===0,'arcs tournés vers l’intérieur : pas un oblong');
  geo([{t:'A',cx:0,cy:0,r:5,a0:0,a1:Math.PI/2},{t:'A',cx:30,cy:0,r:5,a0:0,a1:Math.PI/2}]);
  A(T.slotsOf(v).length===0,'congés : pas un oblong');
  // arcs décrits à rebours, angles négatifs (vue de dessus du noyau) : reconnus ET cliquables partout
  const rebours=slot(10,0,40,0,5);
  rebours[0]={t:'A',cx:10,cy:0,r:5,a0:-Math.PI/2,a1:-3*Math.PI/2};
  rebours[1]={t:'A',cx:40,cy:0,r:5,a0:Math.PI/2,a1:-Math.PI/2};
  geo(rebours);
  A(T.slotsOf(v).length===1,'arcs à rebours : oblong reconnu');
  const k45=5*Math.SQRT1_2;
  [[110-k45,100+k45],[110-k45,100-k45],[140+k45,100+k45],[140+k45,100-k45]].forEach(p=>{
    const h=T.hitEnt(p[0],p[1]);
    A(h&&h.e.t==='A','arc à rebours cliquable en ('+p[0].toFixed(1)+','+p[1].toFixed(1)+')');
  });
  const snR=T.snapPt(110-k45-0.2,100+k45+0.2,{noAxes:true});
  A(snR&&snR.hit&&snR.hit.t==='onC'&&near(snR,110-k45,100+k45,1e-6),'accrochage sur l’arc à rebours : le point cliqué, pas un bout');
  // 2. outil Axes : un clic sur le côté droit pose l'axe et les 2 centres
  geo(slot(10,0,40,0,5).concat([bord]));
  mepSetTool('axis');
  T.axisClick({x:125,y:105});
  const ann=v.axes[v.axes.length-1];
  A(v.axes.length===1&&ann.kind==='slot','Axes : clic sur le côté droit → axe d’oblong');
  let P=T.axisManual(v,ann);
  A(P.length===3,'3 traits : axe + 1 trait perpendiculaire par centre');
  A(near({x:P[0].x1,y:P[0].y1},2,0)&&near({x:P[0].x2,y:P[0].y2},48,0),'axe prolongé de 3 au-delà du contour (de 2 à 48)');
  A(near({x:(P[1].x1+P[1].x2)/2,y:(P[1].y1+P[1].y2)/2},10,0)&&near({x:(P[2].x1+P[2].x2)/2,y:(P[2].y1+P[2].y2)/2},40,0),'traits perpendiculaires centrés sur les 2 centres');
  T.axisClick({x:145,y:100.1});
  A(v.axes.length===1,'2ᵉ clic sur le même oblong : pas de doublon');
  // oblong oblique : le trait d'axe suit sa direction
  v.axes.length=0;
  geo(slot(0,0,30,40,4));
  T.axisClick({x:100+15-3.2,y:100+20+2.4});
  P=v.axes.length?T.axisManual(v,v.axes[0]):[];
  A(P.length===3&&Math.abs((P[0].y2-P[0].y1)/(P[0].x2-P[0].x1)-4/3)<1e-9,'oblique : axe dans le sens de l’oblong');
  A(P.length===3&&Math.abs((P[1].y2-P[1].y1)/(P[1].x2-P[1].x1)+3/4)<1e-9,'oblique : centres marqués perpendiculairement');
  // 3. outil Cote : les 2 arcs → entraxe
  v.axes.length=0;
  geo(slot(10,0,40,0,5).concat([bord]));
  mepSetTool('dim');
  A(T.dimSelect(T.hitEnt(105,100)),'1ᵉʳ arc sélectionné');
  A(T.dimAdd(T.hitEnt(145,100)),'2ᵉ arc ajouté');
  T.dimCommit({x:125,y:80});
  const dE=sh.dims[sh.dims.length-1];
  A(dE&&dE.kind==='dist'&&Math.abs(T.dimMeasure(dE)-30)<1e-6,'entraxe = 30 ('+(dE&&T.dimMeasure(dE))+')');
  A(dE&&dE.a.hint&&dE.a.hint.t==='slot'&&dE.b.hint&&dE.b.hint.t==='slot','entraxe accroché aux centres de l’oblong');
  // arc + bord : position d'un centre
  mepSetTool('dim');
  T.dimSelect(T.hitEnt(105,100));T.dimAdd(T.hitEnt(80,110));
  T.dimCommit({x:95,y:60});
  const dP=sh.dims[sh.dims.length-1];
  A(dP&&dP.kind==='dist'&&Math.abs(T.dimMeasure(dP)-30)<1e-6,'position du centre depuis le bord = 30 ('+(dP&&T.dimMeasure(dP))+')');
  // accrochage automatique sur le centre d'un arc
  const sn=T.snapPt(110.5,100.5);
  A(near(sn,110,100,1e-6)&&sn.hit&&sn.hit.t==='ctr','accrochage : centre de l’arc');
  // 4. allongement : l'oblong passe à des centres (10,0) et (70,0), bien au-delà du suivi d'un cercle seul
  mepSetTool('axis');
  T.axisClick({x:125,y:105});
  const annL=v.axes[v.axes.length-1];
  geo(slot(10,0,70,0,5).concat([bord]));
  A(Math.abs(T.dimMeasure(dE)-60)<1e-6,'allongé : l’entraxe suit, 60 ('+T.dimMeasure(dE)+')');
  A(Math.abs(T.dimMeasure(dP)-30)<1e-6,'allongé : la position du centre fixe reste 30 ('+T.dimMeasure(dP)+')');
  P=T.axisManual(v,annL);
  A(near({x:P[0].x2,y:P[0].y2},78,0),'allongé : l’axe suit (jusqu’à 78)');
  // arcs rendus dans l'autre ordre : chaque point garde son centre
  geo(slot(70,0,10,0,5).concat([bord]));
  A(near(dE.a,10,0)&&near(dE.b,70,0)&&Math.abs(T.dimMeasure(dE)-60)<1e-6,'arcs inversés : chaque point garde son centre');
  // 5. plusieurs oblongs : chacun suit le sien
  sh.dims.length=0;v.axes.length=0;
  geo(slot(10,0,40,0,5).concat(slot(10,30,40,30,5)));
  A(T.slotsOf(v).length===2,'2 oblongs reconnus');
  mepSetTool('dim');
  T.dimSelect(T.hitEnt(105,130));T.dimAdd(T.hitEnt(145,130));T.dimCommit({x:125,y:150});
  const d2=sh.dims[sh.dims.length-1];
  geo(slot(10,0,40,0,5).concat(slot(10,30,60,30,5)));
  A(Math.abs(T.dimMeasure(d2)-50)<1e-6&&near(d2.a,10,30),'le 2ᵉ oblong s’allonge : sa cote suit, pas celle du 1ᵉʳ');
  // 6. oblong disparu : dernière position connue, sans erreur
  geo([bord]);
  A(Math.abs(T.dimMeasure(d2)-50)<1e-6,'oblong supprimé : la cote garde sa dernière valeur');
  // 7. axes automatiques : l'oblong a ses 2 centres et son axe, une fois
  sh.dims.length=0;v.axes.length=0;
  geo(slot(10,0,40,0,5).concat([bord]));
  v.autoAxes=true;
  const au=T.axisAuto(v);
  A(au.filter(p=>p.cls==='mepAxis').length===1&&au.filter(p=>p.cls==='mepAxisCross').length===2,'axes automatiques : 1 axe et 2 centres');
  v.axes.push({id:'axS',kind:'slot',s:{x1:10,y1:0,x2:40,y2:0,r:5}});
  A(T.axisAuto(v).length===0,'axe manuel déjà posé : pas de doublon automatique');
  return r;
})();`,ctx);
out.log.forEach(m=>console.log('  ok  '+m));
out.fails.forEach(m=>{console.log('  KO  '+m);ko++;});
console.log(ko?('test_mep_oblong : '+ko+' échec(s)'):'test_mep_oblong : OK ('+out.log.length+')');
process.exit(ko?1:0);
