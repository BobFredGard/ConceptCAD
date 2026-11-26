// 2026-11-26 : PLAN — « Quand on a des cotes avec un axe de symétrie évident, généralement on rajoute 2 cotes
// alignées avec des points à la place des flèches et un "=" à la place du chiffre. Peux-tu me proposer un outil
// automatique ? » — bouton « Égalités » (et clic droit d'une cote) : bord → axe → bord, points, « = ».
// Vue à (100,100), échelle 1 : pièce en U 0..60 × 0..30 (rainure 20..40 × 15..30), axes libres x = 30 et y = 15.
// Cotes : d1 = 60 (bas, ligne y = 160), d2 = 20 (rainure, y = 150), d3 = longueur du haut (y = 90),
// d4 = 0 → 40 (pas symétrique, y = 70), d5 = 30 verticale (gauche, x = 90). Valeurs calculées à la main.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
let ko=0;
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
  try{
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet();
  sh.views.length=0;sh.dims.length=0;
  const v=mepAddViewStd('front');v.x=100;v.y=100;v.scale=1;
  v.axes=[{id:1,kind:'free',a:{x:30,y:-5},b:{x:30,y:40}},{id:2,kind:'free',a:{x:-5,y:15},b:{x:65,y:15}}];
  T.st().zoom=1;
  const geo=(x4,x5)=>[{t:'L',x1:0,y1:0,x2:60,y2:0},{t:'L',x1:60,y1:0,x2:60,y2:30},{t:'L',x1:60,y1:30,x2:0,y2:30},{t:'L',x1:0,y1:30,x2:0,y2:0},
    {t:'L',x1:x4,y1:30,x2:x4,y2:15},{t:'L',x1:x5,y1:15,x2:x5,y2:30},{t:'L',x1:x4,y1:15,x2:x5,y2:15}];
  T.setViewGeo(v,{src:'dxf',els:geo(20,40)});
  const S=(i)=>({t:'seg',i});
  const D=(id,kind,a,b,orient,off)=>{const d={id,kind,vid:v.id,vid2:null,a,b,orient,off,tol:null,ref:false};sh.dims.push(d);return d;};
  const d1=D('d1','dist',{x:0,y:30,hint:S(3)},{x:60,y:30,hint:S(1)},'h',30);
  const d2=D('d2','dist',{x:20,y:30,hint:S(4)},{x:40,y:30,hint:S(5)},'h',20);
  const d3=D('d3','len',{x:0,y:0,hint:S(0)},{x:60,y:0},'h',-10);
  const d4=D('d4','dist',{x:0,y:30,hint:S(3)},{x:40,y:30,hint:S(5)},'h',-60);
  const d5=D('d5','dist',{x:0,y:0,hint:S(0)},{x:0,y:30,hint:S(2)},'v',-10);
  window.mepFxRedraw();
  // 1. qui est symétrique
  A(T.eqFind(d1)&&T.eqFind(d2)&&T.eqFind(d3)&&T.eqFind(d5),'cotes 60, 20, longueur du haut et 30 verticale : coupées en leur milieu par un axe');
  A(!T.eqFind(d4),'cote 0 → 40 : pas symétrique, rien');
  // 2. clic droit sur la cote de la rainure : « Cotes d'égalité »
  const LAB='Cotes d’égalité « = » de part et d’autre de l’axe';
  const it=T.ctxAt({P:{x:123,y:150}});
  A(it.indexOf(LAB)>=0,'clic droit sur la cote 20 : '+it.join(' | '));
  A(T.ctxAt({P:{x:103,y:70}}).indexOf(LAB)<0,'clic droit sur la cote 0 → 40 : pas de cotes d’égalité');
  T.ctxAt({P:{x:123,y:150}});
  const n0=sh.dims.length;
  A(T.ctxPick(LAB)&&sh.dims.length===n0+2,'choisi : 2 cotes ajoutées');
  const pair=id=>sh.dims.filter(x=>x.eqOf===id).sort((p,q)=>T.dimLineOf(p).a1.x+T.dimLineOf(p).a1.y-T.dimLineOf(q).a1.x-T.dimLineOf(q).a1.y);
  let [h1,h2]=pair('d2');
  A(h1&&h2&&h1.eq&&h1.eq===h2.eq&&h1.txt==='='&&h2.txt==='='&&h1.term==='dot'&&h1.orient==='h','2 moitiés liées, « = », à points, horizontales');
  A(near(T.dimMeasure(h1),10)&&near(T.dimMeasure(h2),10),'bord 20 → axe 30 → bord 40 : 10 et 10');
  A(near(h1.a.x,20)&&near(h1.b.x,30)&&h1.b.hint&&h1.b.hint.t==='axp'&&near(h2.b.x,40)&&h2.b.hint&&h2.b.hint.t==='seg','point du milieu sur l’axe (suit l’axe), bords sur les arêtes de la rainure');
  A(near(T.dimLineOf(h1).a1.y,143)&&near(T.dimLineOf(h2).a1.y,143),'entre la pièce (y 130) et la cote 20 (y 150) : ligne y = 143');
  // 3. dessin : un point au lieu de chaque flèche, « = » au lieu du chiffre
  const dessin=d=>{const o={lines:[],circles:[],texts:[]};
    T.drawDim((tag,a)=>{const e={a,appendChild(){},setAttribute(k,x){a[k]=x;},textContent:''};
      if(tag==='line')o.lines.push(a);if(tag==='circle')o.circles.push(a);if(tag==='text')o.texts.push(e);return e;},d);return o;};
  const g1=dessin(h1);
  A(g1.circles.length===2&&g1.circles.every(c=>/mepGdtFill/.test(c.class)&&+c.r>0.2&&+c.r<1)&&g1.circles.some(c=>near(+c.cx,120)&&near(+c.cy,143))&&g1.circles.some(c=>near(+c.cx,130)&&near(+c.cy,143)),'2 points pleins aux bouts de la ligne (120 et 130)');
  A(!g1.lines.some(l=>l['marker-end']||l['marker-start']),'aucune flèche');
  A(g1.texts.some(t=>t.textContent==='='),'valeur écrite « = »');
  // 4. bouton « Égalités » : toute la planche (rien de sélectionné)
  T.selDim(null);T.st().sel=null;
  const n1=sh.dims.length,nb=window.mepEqAuto();
  A(nb===3&&sh.dims.length===n1+6,'bouton : 3 cotes symétriques de plus, 6 cotes « = » ('+nb+')');
  const [k1,k2]=pair('d1');
  A(k1&&near(T.dimMeasure(k1),30)&&near(T.dimMeasure(k2),30)&&near(k1.a.x,0)&&near(k1.a.y,30),'cote 60 : 30 et 30, depuis le coin bas gauche');
  A(near(T.dimLineOf(k1).a1.y,167)&&near(T.dimLineOf(k2).a1.y,167),'cote 60 : entre-deux occupé par la cote 20 → au-delà, y = 167');
  const [t1,t2]=pair('d3');
  A(t1&&near(T.dimMeasure(t1),30)&&near(T.dimMeasure(t2),30)&&near(T.dimLineOf(t1).a1.y,83)&&t2.b.hint&&t2.b.hint.t==='seg','longueur du haut : 30 et 30 au-dessus, y = 83, bout droit sur l’arête');
  const [v1,v2]=pair('d5');
  A(v1&&v1.orient==='v'&&near(T.dimMeasure(v1),15)&&near(T.dimMeasure(v2),15)&&near(T.dimLineOf(v1).a1.x,83)&&near(T.dimLineOf(v2).a1.x,83),'cote verticale 30 : axe horizontal y = 15, 15 et 15 à gauche, x = 83');
  A(!pair('d4').length,'cote 0 → 40 : aucune égalité');
  // 5. deuxième fois : rien de nouveau
  const n2=sh.dims.length;
  A(window.mepEqAuto()===0&&sh.dims.length===n2,'bouton une 2ᵉ fois : rien en double');
  // 6. une moitié glissée : sa voisine suit
  T.dimMoveTo(h1,{x:125,y:175},{off0:h1.off,sx:125,sy:143,txtOff0:0});
  A(near(T.dimLineOf(h1).a1.y,175)&&near(T.dimLineOf(h2).a1.y,175),'moitié glissée à y = 175 : l’autre aussi');
  // 7. clic droit sur une moitié : pas de changement d'orientation, « Retirer »
  const it2=T.ctxAt({P:{x:122,y:175}});
  A(it2.indexOf('Retirer les cotes « = »')>=0&&it2.indexOf('Alignée (A)')<0,'clic droit sur une cote « = » : '+it2.join(' | '));
  // 8. la pièce change : les bords suivent les arêtes, le milieu reste sur l'axe
  T.setViewGeo(v,{src:'dxf',els:geo(21,41)});T.dimPts(h1);T.dimPts(h2);
  A(near(h1.a.x,21,1e-6)&&near(T.dimMeasure(h1),9,1e-6)&&near(T.dimMeasure(h2),11,1e-6),'rainure décalée de 1 : 9 et 11 (bords suivis, milieu sur l’axe)');
  // 9. enregistrées avec le plan ; Suppr d'une moitié retire les deux
  const J=JSON.parse(JSON.stringify(sh.dims)).find(x=>x.id===h1.id);
  A(J&&J.term==='dot'&&J.txt==='='&&J.eq===h1.eq&&J.eqOf==='d2','enregistrées avec le plan');
  const n3=sh.dims.length;
  T.selDim(h2.id);T.key('Delete');
  A(sh.dims.length===n3-2&&!sh.dims.some(x=>x.eq===h1.eq)&&sh.dims.indexOf(d2)>=0&&pair('d1').length===2,'Suppr sur une moitié : les 2 partent, la cote 20 et les autres restent');
  }catch(e){r.fails.push('erreur : '+(e&&e.message||e));}
  return r;
})()`,ctx);
console.log('=== PLAN : cotes d’égalité « = » de part et d’autre d’un axe ===');
out.log.forEach(m=>console.log('  ✓ '+m));
out.fails.forEach(m=>{ko++;console.log('  ✗ '+m);});
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(ko?1:0);
