// 2026-11-09 : PLAN — « il faut pouvoir créer des axes sur une rainure circulaire » : l'oblong en arc vu de
// face est reconnu à sa forme ; l'outil Axes pose d'un clic l'arc d'axe, les traits vers les centres des
// bouts et la croix du centre ; tout suit le modèle ; les cotes s'accrochent aux centres des bouts.
// Vue à (100,100), échelle 1. Rainure de référence : centre (0,0), R30, demi-largeur 4, de 0° à 90°.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
let ko=0;
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet();
  sh.views.length=0;sh.dims.length=0;
  const v=mepAddViewStd('front');v.x=100;v.y=100;v.scale=1;v.axes=[];
  T.st().zoom=1;
  // oblong en arc : centre (cx,cy), rayon d'axe R, demi-largeur w, de a0 à a0+sw
  const rainure=(cx,cy,R,w,a0,sw)=>{
    const a1=a0+sw,P=a=>[cx+R*Math.cos(a),cy+R*Math.sin(a)];
    const S=P(a0),E=P(a1);
    return [
      {t:'A',cx,cy,r:R+w,a0,a1},
      {t:'A',cx,cy,r:R-w,a0,a1},
      {t:'A',cx:S[0],cy:S[1],r:w,a0:a0+Math.PI,a1:a0+2*Math.PI},
      {t:'A',cx:E[0],cy:E[1],r:w,a0:a1,a1:a1+Math.PI}];
  };
  const bord={t:'L',x1:-20,y1:-50,x2:-20,y2:50};
  const geo=els=>T.setViewGeo(v,{src:'dxf',els});
  // 1. reconnaissance
  geo(rainure(0,0,30,4,0,Math.PI/2).concat([bord]));
  let S=T.aslotsOf(v);
  A(S.length===1&&near(S[0].R,30)&&near(S[0].w,4)&&near(S[0].a0,0)&&near(S[0].sw,Math.PI/2),'rainure reconnue : R30, largeur 8, de 0° à 90°');
  A(T.slotsOf(v).length===0,'pas prise pour un oblong droit');
  geo(rainure(5,-3,25,3,2.5,4));
  S=T.aslotsOf(v);
  A(S.length===1&&near(S[0].sw,4,1e-9)&&near(S[0].a0,2.5,1e-9),'rainure de plus d’un demi-tour (229°) : le bon côté');
  const ext=rainure(0,0,30,4,0,Math.PI/2);
  ext[0]={t:'A',cx:0,cy:0,r:34,a0:0,a1:Math.PI/4};ext.push({t:'A',cx:0,cy:0,r:34,a0:Math.PI/4,a1:Math.PI/2});
  geo(ext);
  A(T.aslotsOf(v).length===1,'arc extérieur coupé en 2 : reconnu');
  geo(rainure(0,0,30,4,0,Math.PI/2).slice(0,3));
  A(T.aslotsOf(v).length===0,'un seul bout : pas une rainure');
  // 2. outil Axes : un clic sur l'arc extérieur
  geo(rainure(0,0,30,4,0,Math.PI/2).concat([bord]));
  mepSetTool('axis');
  const k=34*Math.SQRT1_2;
  T.axisClick({x:100+k,y:100+k});
  const ann=v.axes[v.axes.length-1];
  A(v.axes.length===1&&ann.kind==='aslot','Axes : clic sur l’arc extérieur → axe de rainure');
  let P=T.axisManual(v,ann);
  A(P.length===5&&P[0].t==='A'&&near(P[0].r,30)&&P[0].a0<0&&P[0].a1>Math.PI/2,'arc d’axe R30 prolongé au-delà des bouts');
  A(near(P[1].x1,0)&&near(P[1].y1,0)&&near(P[1].y2,0)&&P[1].x2>34,'trait du centre à travers le 1er bout');
  A(near(P[2].x2,0)&&P[2].y2>34,'trait du centre à travers le 2e bout');
  A(P.slice(3).every(p=>p.cls==='mepAxisCross'),'croix au centre de l’arc');
  T.axisClick({x:100+30,y:100-2});
  A(v.axes.length===1,'2e clic sur la même rainure : pas de doublon');
  // 3. l'axe suit le modèle : rainure ouverte jusqu'à 120°
  geo(rainure(0,0,30,4,0,2*Math.PI/3).concat([bord]));
  P=T.axisManual(v,ann);
  A(near(ann.s.sw,2*Math.PI/3,1e-9)&&near(Math.atan2(P[2].y2,P[2].x2),2*Math.PI/3,1e-9),'ouverture changée : l’axe suit (120°)');
  // 4. cote : bout ↔ bord accrochée au centre du bout
  mepSetTool('dim');
  A(T.dimSelect(T.hitEnt(100+30,100-4.3)),'bout de la rainure sélectionné');
  A(T.dimAdd(T.hitEnt(80,110)),'bord ajouté');
  T.dimCommit({x:110,y:60});
  const dP=sh.dims[sh.dims.length-1];
  A(dP&&dP.kind==='dist'&&near(T.dimMeasure(dP),50,1e-6),'centre du bout à 50 du bord ('+(dP&&T.dimMeasure(dP))+')');
  A(dP&&(dP.a.hint&&dP.a.hint.t==='aslot'||dP.b.hint&&dP.b.hint.t==='aslot'),'point accroché au centre du bout de la rainure');
  geo(rainure(0,0,40,4,0,2*Math.PI/3).concat([bord]));
  A(near(T.dimMeasure(dP),60,1e-6),'rayon passé à 40 : la cote suit (60) — '+T.dimMeasure(dP));
  // 5. axes automatiques
  sh.dims.length=0;v.axes.length=0;
  geo(rainure(0,0,30,4,0,Math.PI/2).concat([bord]));
  v.autoAxes=true;
  const au=T.axisAuto(v);
  A(au.filter(p=>p.t==='A').length===1&&au.filter(p=>p.cls==='mepAxisCross').length===2,'axes automatiques : arc d’axe et croix du centre');
  v.axes.push({id:'axA',kind:'aslot',s:{cx:0,cy:0,R:30,w:4,a0:0,sw:Math.PI/2}});
  A(T.axisAuto(v).filter(p=>p.t==='A').length===0,'axe manuel déjà posé : pas de doublon automatique');
  v.autoAxes=false;
  // 6. dessin : l'arc d'axe est un chemin SVG
  let dd=null;
  T.drawAxisPrim((tag,at)=>{if(tag==='path')dd=at.d;return{};},T.axisManual(v,{id:'axB',kind:'aslot',s:{cx:0,cy:0,R:30,w:4,a0:0,sw:Math.PI/2}})[0],v);
  A(!!dd&&/ A 30 30 0 0 1 /.test(dd),'arc d’axe dessiné en chemin SVG ('+dd+')');
  return r;
})();`,ctx);
out.log.forEach(m=>console.log('  ok  '+m));
out.fails.forEach(m=>{console.log('  KO  '+m);ko++;});
console.log(ko?('test_mep_oblong_arc : '+ko+' échec(s)'):'test_mep_oblong_arc : OK ('+out.log.length+')');
process.exit(ko?1:0);
