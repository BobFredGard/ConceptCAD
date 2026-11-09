// 2026-11-09 : PLAN — « textes types en filigranes à mettre sur les plans / Bon pour Fabrication, Annulé,
// Plan Interne … horizontalement ou de travers et à la dimension que l'on veut », « si texte trop long,
// 2 lignes », « pouvoir écrire ce que l'on souhaite ». Et groupes du ruban façon Fusion (épingles).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
let ko=0;
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet();
  sh.views.length=0;sh.dims.length=0;sh.sk=null;sh.format='A3';sh.orient='landscape';
  // 1. filigrane type : centre de la planche, le long de la diagonale, transparent, couleur du type
  const e=T.sk.addWm(sh,'annule');
  A(e&&e.wm===1&&e.s==='ANNULÉ'&&e.col==='#e03131'&&e.al==='middle','« ANNULÉ » rouge, centré ('+(e&&e.s)+')');
  A(e.rot===35,'en travers : angle de la diagonale A3 = 35° ('+e.rot+')');
  A(e.op>0&&e.op<0.5,'transparent ('+e.op+')');
  const L=6*e.h*0.8;A(L<Math.hypot(420,297)*0.7&&L>100,'taille : couvre environ les 2/3 de la diagonale ('+L.toFixed(0)+' mm)');
  const sk=sh.sk,p=sk.pts[e.p];
  // centre visuel (demi-capitale au-dessus de la ligne de base, perpendiculairement) au centre de la planche
  const a=e.rot*Math.PI/180,cx=p.x-0.37*e.h*Math.sin(a),cy=p.y-0.37*e.h*Math.cos(a);
  A(Math.abs(cx-210)<0.5&&Math.abs(cy-148.5)<0.5,'mot centré sur la planche ('+cx.toFixed(1)+', '+cy.toFixed(1)+')');
  // 2. sélection sur le texte incliné : le bout du mot (loin de l'horizontale de l'ancre) est visé
  const far={x:p.x+0.4*L*Math.cos(a),y:p.y-0.4*L*Math.sin(a)-0.3*e.h*Math.cos(a)};
  const hk=T.sk.hit(sh,far.x,far.y);
  A(hk==='e:'+e.id,'clic sur le bout du mot incliné : filigrane sélectionné ('+(hk)+')');
  const off={x:p.x+0.4*L*Math.cos(a),y:p.y+0.4*L*Math.sin(a)};
  const hk2=T.sk.hit(sh,off.x,off.y);A(hk2!=='e:'+e.id,'à côté du mot (symétrique) : rien');
  const poly=T.sk.entPoly(sh,e).pts;
  A(poly.length===4&&Math.abs(Math.atan2(-(poly[1].y-poly[0].y),poly[1].x-poly[0].x)*180/Math.PI-35)<0.01,'cadre de sélection incliné comme le texte');
  // 3. horizontal : rot 0
  e.rot=0;delete e.rot;const hk3=T.sk.hit(sh,p.x+0.4*L,p.y-0.3*e.h);A(hk3==='e:'+e.id,'horizontal : visé le long de l’horizontale');
  // 4. 2 lignes : texte libre, coupé au milieu
  const f=T.sk.addWm(sh,'autre','Plan à ne pas diffuser hors atelier');
  A(f.s==='Plan à ne pas diffuser hors atelier'&&f.col,'texte libre gardé tel qu’écrit');
  const h1=f.h;
  f.s=mepWmSplitT(f.s);
  A(f.s==='Plan à ne pas diffuser'+String.fromCharCode(10)+'hors atelier'||f.s==='Plan à ne pas'+String.fromCharCode(10)+'diffuser hors atelier','coupé en 2 lignes à l’espace du milieu ('+JSON.stringify(f.s)+')');
  A(mepWmSizeT(sh,f.s,f.rot)>h1,'en 2 lignes, les lettres grandissent');
  A(mepWmSplitT(f.s)==='Plan à ne pas diffuser hors atelier','et se recollent en 1 ligne');
  // 5. ruban : groupes à liste, épingles
  A(mfRbShown('Créer/Extrusion',{})&&!mfRbShown('Créer/Balayage',{}),'défaut : Extrusion dans le bandeau, Balayage dans la liste');
  A(mfRbShown('Créer/Balayage',{'Créer/Balayage':1})&&!mfRbShown('Créer/Extrusion',{'Créer/Extrusion':0}),'épingle : le choix l’emporte');
  A(MF_RB_KEYS['Créer/Extrusion']==='E'&&MF_RB_KEYS['Modifier/Congé']==='F','raccourcis affichés (E, F…)');
  return r;
})();`,ctx);
out.log.forEach(m=>console.log('  ok  '+m));
out.fails.forEach(m=>{console.log('  KO  '+m);ko++;});
console.log(ko?('test_mep_filigrane : '+ko+' échec(s)'):'test_mep_filigrane : OK ('+out.log.length+')');
process.exit(ko?1:0);
