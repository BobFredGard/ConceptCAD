// 2026-11-09 : PLAN — « ajouter l'outil pour la rugosité, bien faire attention au sens des arêtes choisies /
// à la vue et de mettre la valeur comme il le faut ». Symbole touchant l'arête du côté hors matière choisi,
// valeur « Ra 3,2 » le long de l'arête, lisible du bas ou de la droite ; côté illisible → ligne de repère.
// Vue à (100,100), échelle 1 : rectangle 0..60 × 0..30 (mm modèle, papier 100..160 × 100..130).
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
  T.setViewGeo(v,{src:'dxf',els:[{t:'L',x1:0,y1:0,x2:60,y2:0},{t:'L',x1:60,y1:0,x2:60,y2:30},{t:'L',x1:60,y1:30,x2:0,y2:30},{t:'L',x1:0,y1:30,x2:0,y2:0},
    {t:'C',cx:30,cy:15,r:8}]});
  const dessin=d=>{const o={lines:[],texts:[],circles:[]};
    T.drawDim((tag,a)=>{const e={appendChild(){},setAttribute(k,x){a[k]=x;},textContent:'',a};
      if(tag==='line')o.lines.push(a);if(tag==='circle')o.circles.push(a);if(tag==='text')o.texts.push(e);return e;},d);return o;};
  const pose=(p1,p2)=>{mepSetTool('rough');T.gdtClick(p1,'rough');T.gdtClick(p2,'rough');return sh.dims[sh.dims.length-1];};
  const angOf=t=>{const s=String(t.a.transform||''),k=s.indexOf('rotate(');return k<0?0:parseFloat(s.slice(k+7));};
  // 1. arête du haut (papier y = 100), côté extérieur = au-dessus : symbole direct, valeur horizontale
  const d1=pose({x:130,y:100},{x:130,y:95});
  A(d1&&d1.kind==='rough'&&!d1.__ghost&&near(d1.a.y,0)&&d1.r.par==='Ra'&&d1.r.val==='3.2'&&d1.r.proc==='remove','rugosité posée sur l’arête du haut (Ra 3,2, usinée)');
  let D=dessin(d1);
  const t1=D.texts.find(t=>/Ra/.test(t.textContent));
  A(t1&&/Ra 3[,.]2/.test(t1.textContent),'valeur « Ra 3,2 » ('+(t1&&t1.textContent)+')');
  A(t1&&near(angOf(t1),0,1e-6),'valeur horizontale, lue du bas');
  A(t1&&+t1.a.y<100&&+t1.a.x>130,'valeur au-dessus de l’arête (hors matière), à droite de la branche longue');
  const pied=D.lines.filter(l=>near(+l.x1,130,1e-6)&&near(+l.y1,100,1e-6));
  A(pied.length===2&&pied.every(l=>+l.y2<100),'les 2 branches partent de l’arête vers l’extérieur');
  A(!D.lines.some(l=>l['marker-end']),'pas de ligne de repère');
  const L1=pied.map(l=>Math.hypot(l.x2-l.x1,l.y2-l.y1)).sort((a,b)=>a-b);
  A(L1[1]/L1[0]>2&&L1[1]/L1[0]<2.3,'branche longue ≈ 2,1 × la courte (H2 = 3 h, H1 = 1,4 h)');
  A(D.lines.length===4,'enlèvement de matière : branche courte fermée + trait horizontal ('+D.lines.length+' traits)');
  // 2. arête de gauche (x = 100), extérieur à gauche : valeur verticale lue de la droite (de bas en haut)
  const d2=pose({x:100,y:115},{x:95,y:115});D=dessin(d2);
  const t2=D.texts.find(t=>/Ra/.test(t.textContent));
  A(t2&&near(angOf(t2),-90,1e-6)&&+t2.a.x<100,'arête de gauche : valeur verticale, lue de la droite, côté extérieur ('+(t2&&angOf(t2))+')');
  A(!D.lines.some(l=>l['marker-end']),'arête de gauche : symbole direct');
  // 3. arête du bas, extérieur en dessous : se lirait à l'envers → ligne de repère à flèche
  const d3=pose({x:130,y:130},{x:130,y:136});D=dessin(d3);
  const fl=D.lines.find(l=>l['marker-end']);
  A(fl&&near(+fl.x2,130,1e-6)&&near(+fl.y2,130,1e-6),'arête du bas : ligne de repère, flèche sur la surface');
  const t3=D.texts.find(t=>/Ra/.test(t.textContent));
  A(t3&&near(angOf(t3),0,1e-6)&&+t3.a.y>130,'valeur horizontale sur le trait de repère, sous la pièce');
  // 4. arête de droite, extérieur à droite → ligne de repère aussi
  const d4=pose({x:160,y:115},{x:166,y:115});D=dessin(d4);
  A(D.lines.some(l=>l['marker-end']&&near(+l.x2,160,1e-6)),'arête de droite côté droit : ligne de repère');
  // 5. éloigné de l'arête du haut : ligne de repère
  const d5=pose({x:110,y:100},{x:90,y:60});D=dessin(d5);
  A(D.lines.some(l=>l['marker-end']),'posé loin de l’arête : ligne de repère');
  // 6. trou (cercle) : symbole perpendiculaire à la tangente, à l'extérieur du cercle → sens radial
  const d6=pose({x:130,y:107},{x:130,y:103});D=dessin(d6); // haut du cercle (y local 7), posé au-dessus
  const p6=D.lines.filter(l=>near(+l.x1,130,1e-3)&&near(+l.y1,107,1e-3));
  A(p6.length===2&&p6.every(l=>+l.y2<107),'cercle : perpendiculaire à la tangente, branches vers le haut');
  D=dessin(Object.assign({},d6,{b:{x:30,y:10}}));A(D.lines.some(l=>l['marker-end']),'cercle, côté centre (sous la tangente) : ligne de repère');
  // 7. symboles : tout procédé (V ouvert), interdit (cercle)
  d1.r.proc='any';D=dessin(d1);A(D.lines.length===3&&!D.circles.length,'tout procédé : V ouvert + trait');
  d1.r.proc='forbid';D=dessin(d1);A(D.circles.length===1,'enlèvement interdit : cercle dans le V');
  d1.r.par='Rz';d1.r.val='6.3';d1.r.txt='rectifié';D=dessin(d1);
  A(D.texts.some(t=>/Rz 6[,.]3/.test(t.textContent))&&D.texts.some(t=>t.textContent==='rectifié'),'Rz 6,3 et procédé « rectifié »');
  // 8. glisser de l'autre côté : le symbole se retourne
  window.mepDimMoveTo(d2,{x:105,y:115});D=dessin(d2);
  A(D.lines.some(l=>l['marker-end']),'arête de gauche, glissé côté droit : illisible → ligne de repère');
  A(T.gdtBox(d1)&&T.gdtBox(d1).x1>T.gdtBox(d1).x0,'cadre de saisie (clic, glisser, Suppr)');
  return r;
})();`,ctx);
out.log.forEach(m=>console.log('  ok  '+m));
out.fails.forEach(m=>{console.log('  KO  '+m);ko++;});
console.log(ko?('test_mep_rugosite : '+ko+' échec(s)'):'test_mep_rugosite : OK ('+out.log.length+')');
process.exit(ko?1:0);
