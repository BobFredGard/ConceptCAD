// 2026-11-26 : PLAN — « Les tolérances géométriques devraient avoir leur flèche perpendiculaire à l'arête
// choisie et l'on doit pouvoir écarter la boîte vers l'extérieur de la vue ». Le dernier tronçon de la
// ligne de repère (celui de la flèche) suit la normale à l'élément visé : arête droite, oblique, cercle ;
// le cadre se saisit n'importe où dans sa boîte et s'écarte loin de la vue, la flèche reste perpendiculaire.
// Vue à (100,100), échelle 1 : rectangle 0..60 × 0..30, cercle (100,15) R10, droite (120,0)-(150,30).
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
  const v=mepAddViewStd('front');v.x=100;v.y=100;v.scale=1;v.axes=[];
  T.st().zoom=1;
  const rect=(w,h)=>[{t:'L',x1:0,y1:0,x2:w,y2:0},{t:'L',x1:w,y1:0,x2:w,y2:h},{t:'L',x1:w,y1:h,x2:0,y2:h},{t:'L',x1:0,y1:h,x2:0,y2:0}];
  T.setViewGeo(v,{src:'dxf',els:rect(60,30).concat([{t:'C',cx:100,cy:15,r:10},{t:'L',x1:120,y1:0,x2:150,y2:30}])});
  const dessin=d=>{const o={lines:[],paths:[]};
    T.drawDim((tag,a)=>{const e={appendChild(){},setAttribute(k,x){a[k]=x;},textContent:''};
      if(tag==='line')o.lines.push(a);if(tag==='path')o.paths.push(a);return e;},d);return o;};
  const fleche=d=>dessin(d).lines.find(l=>l['marker-end']);
  const pose=(P1,P2)=>{mepSetTool('gdt');T.gdtClick(P1,'gdt');T.gdtClick(P2,'gdt');return sh.dims[sh.dims.length-1];};
  // 1. arête verticale (x = 60 → papier 160), cadre en haut à droite : flèche horizontale
  const g1=pose({x:160,y:115},{x:185,y:95});
  let F=fleche(g1);
  A(g1.kind==='gdt'&&near(g1.a.x,60),'cadre posé, pointe sur l’arête verticale');
  A(F&&near(+F.x2,160)&&near(+F.y2,115)&&near(+F.y1,115)&&+F.x1>160+1,'flèche horizontale, perpendiculaire à l’arête verticale ('+(F&&[F.x1,F.y1,F.x2,F.y2].map(x=>(+x).toFixed(2)).join(' '))+')');
  A(dessin(g1).lines.some(l=>!l['marker-end']&&near(+l.x1,+F.x1)&&near(+l.x2,+F.x1)&&near(+l.y2,115)),'coude : la ligne descend du cadre à la hauteur de la pointe');
  // 2. arête horizontale (y = 30 → papier 130), cadre en bas à droite : flèche verticale
  const g2=pose({x:130,y:130},{x:160,y:150});
  F=fleche(g2);
  A(F&&near(+F.x2,130)&&near(+F.y2,130)&&near(+F.x1,130)&&+F.y1>131,'flèche verticale, perpendiculaire à l’arête horizontale');
  // 3. cercle, point de droite (110,15) → papier (210,115) : flèche le long du rayon
  const g3=pose({x:210,y:115},{x:240,y:90});
  F=fleche(g3);
  A(F&&near(+F.x2,210,1e-3)&&near(+F.y2,115,1e-3)&&near(+F.y1,115,1e-3)&&+F.x1>211,'cercle : flèche le long du rayon');
  // 4. droite à 45° (milieu (135,15) → papier (235,115)), cadre en haut à droite : flèche à 45° perpendiculaire
  const g4=pose({x:235,y:115},{x:265,y:80});
  F=fleche(g4);
  const dx=+F.x1-+F.x2,dy=+F.y1-+F.y2;
  A(F&&near(+F.x2,235,1e-3)&&near(+F.y2,115,1e-3)&&dx>1&&near(dx,-dy,1e-6),'droite oblique : flèche perpendiculaire, du côté du cadre');
  // 5. dans le vide : droit vers la pointe, comme avant
  const n5=sh.dims.length,g5=pose({x:130,y:115},{x:150,y:140}); // dans le rectangle, sur aucun trait
  F=fleche(g5);
  A(sh.dims.length===n5+1&&F&&near(+F.x2,130)&&near(+F.y2,115)&&!near(+F.x1,+F.x2,0.5)&&!near(+F.y1,+F.y2,0.5)&&dessin(g5).lines.some(l=>!l['marker-end']&&near(+l.y1,+l.y2)&&near(+l.y1,+F.y1)&&(near(+l.x1,+F.x1)||near(+l.x2,+F.x1))),'pointe dans le vide : ligne droite oblique depuis l’attache, sans coude');
  // 6. le cadre se saisit n'importe où dans sa boîte (zoomé : loin du centre et des traits)
  T.st().zoom=8;window.mepFxRedraw();
  const L1=dessin(g1).lines.filter(l=>!l['marker-end']&&near(+l.y1,+l.y2));
  const xs=L1.map(l=>Math.max(+l.x1,+l.x2)),x1=Math.max(...xs),ys=L1.map(l=>+l.y1),yc=(Math.min(...ys)+Math.max(...ys))/2;
  A(T.dimAt(x1-2,yc)===g1,'zoomé, clic dans la dernière case du cadre (2 mm du bord) : le cadre est saisi');
  T.st().zoom=1;window.mepFxRedraw();
  // 7. écarté loin de la vue (hors de son cadre) : la flèche reste perpendiculaire à l'arête
  window.mepDimMoveTo(g1,{x:320,y:40});
  A(near(g1.b.x,220)&&near(g1.b.y,-60),'cadre écarté loin à droite et au-dessus de la vue');
  F=fleche(g1);
  A(F&&near(+F.y1,115)&&near(+F.y2,115)&&near(+F.x2,160)&&+F.x1>160,'écarté : flèche toujours horizontale sur l’arête');
  window.mepDimMoveTo(g1,{x:20,y:115});
  F=fleche(g1);
  A(F&&near(+F.y1,115)&&near(+F.x2,160)&&+F.x1<160,'cadre passé de l’autre côté de l’arête : la flèche se retourne, toujours horizontale');
  // 8. référence sur un cercle : triangle posé à plat sur le cercle (base perpendiculaire au rayon)
  mepSetTool('datum');T.gdtClick({x:200,y:105},'datum');T.gdtClick({x:230,y:80},'datum');
  const dR=sh.dims[sh.dims.length-1],tri=dessin(dR).paths[0].d.match(/-?[\\d.]+/g).map(Number);
  A(dR.kind==='datum'&&near(tri[1],105,1e-3)&&near(tri[3],105,1e-3)&&tri[5]<105,'référence sur le haut du cercle : base horizontale, pointe vers l’extérieur');
  }catch(e){r.fails.push('erreur : '+(e&&e.message||e));}
  return r;
})()`,ctx);
console.log('=== PLAN : tolérances géométriques, flèche perpendiculaire et cadre écarté ===');
out.log.forEach(m=>console.log('  ✓ '+m));
out.fails.forEach(m=>{ko++;console.log('  ✗ '+m);});
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(ko?1:0);
