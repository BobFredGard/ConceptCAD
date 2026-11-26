// 2026-11-26 : PLAN, cotes d'ordonnées — « Il manque aux cotes d'ordonnées la possibilité du clic droit
// qui existe pour la cotation normale ». L'outil Ordonnées X / Y a le même menu d'accrochage que l'outil
// Cote (extrémité, milieu, centre, point extrême X / Y, intersection même prolongée) ; le choix vaut
// pour l'origine et les points du groupe jusqu'à ce qu'on en change ; Échap n'annule qu'une
// intersection en cours. Suite : « Et aussi ajouter le moyen qu'une des cotes d'ordonnée soit une cote de
// référence » — Maj + clic à la pose, clic droit sur la valeur, case du panneau. Valeurs calculées à la main.
// Vue à (100,100), échelle 1 : L1 (0,0)-(20,0), L2 (40,10)-(40,30), cercle C (70,0) R10.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
let ko=0;
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  const near=(p,x,y,t)=>!!p&&Math.abs(p.x-x)<(t||1e-6)&&Math.abs(p.y-y)<(t||1e-6);
    try{
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet(),key=k=>T.key(k); // le vrai gestionnaire du clavier du plan
  sh.views.length=0;sh.dims.length=0;
  const v=mepAddViewStd('front');v.x=100;v.y=100;v.scale=1;v.axes=[];
  const L1={t:'L',x1:0,y1:0,x2:20,y2:0},L2={t:'L',x1:40,y1:10,x2:40,y2:30},C={t:'C',cx:70,cy:0,r:10};
  T.setViewGeo(v,{src:'dxf',els:[L1,L2,C]});
  T.st().zoom=1;
  // 1. clic droit dans l'outil Ordonnées : le menu d'accrochage de l'outil Cote
  mepSetTool('dim');
  const refItems=T.ctxAt({}).filter(s=>s!=='Accrochage');
  mepSetTool('ordx');
  const items=T.ctxAt({});
  A(items[0]==='Accrochage','titre du menu : Accrochage ('+items[0]+')');
  A(items.slice(1).join('|')===refItems.join('|')&&items.length===8,'mêmes 7 choix que l’outil Cote : '+items.slice(1).join(', '));
  A(items.indexOf('✓ Automatique')>=0,'Automatique coché au départ');
  // 2. intersection dans le vide pour l'origine « 0 » (L1 × L2 prolongées = (40,0))
  A(T.ctxPick('Intersection (même prolongée)')&&T.snapMode()==='int','choix « Intersection » pris');
  T.ordClick({x:110,y:100.3},'x');
  A(sh.dims.length===0&&T.st().intPick&&T.st().intPick.i===0,'1ᵉʳ clic : L1 retenue, pas encore d’origine');
  key('Escape');
  A(!T.st().intPick&&T.st().tool==='ordx'&&T.snapMode()==='int','Échap : seule l’intersection en cours est annulée, l’outil reste');
  T.ordClick({x:110,y:100.3},'x');
  const hv=T.snapHover({x:140.2,y:120});
  A(near(hv,140,100)&&hv.mode==='int','survol de L2 : repère sur le croisement (140,100)');
  const mk=[];T.drawSnapHov((tag,a)=>{mk.push(Object.assign({tag},a));return{};});
  A(mk.some(o=>o.class==='mepSnap')&&mk.some(o=>o.tag==='line'&&/mepDimGhost/.test(o.class||'')),'repère et prolongements dessinés pendant le survol');
  T.ordClick({x:140.2,y:120},'x');
  const d=sh.dims[sh.dims.length-1];
  A(d&&d.kind==='ord'&&near(d.o,40,0)&&d.o.hint&&d.o.hint.t==='int','origine « 0 » = intersection (40,0), référencée');
  A(T.snapMode()==='int','le choix reste pour les points suivants');
  // 3. points : centre, point extrême X, puis retour à Automatique
  const items2=T.ctxAt({});
  A(items2.indexOf('✓ Intersection (même prolongée)')>=0,'groupe en cours : clic droit encore possible, choix actuel coché');
  T.ctxPick('Centre');T.ordClick({x:166,y:102},'x');
  A(d.pts.length===1&&near(d.pts[0],70,0)&&Math.abs(T.ordValue(d,d.pts[0])-30)<1e-9,'Centre : point (70,0), valeur 30');
  T.ctxPick('Point extrême suivant X');T.ordClick({x:179,y:101},'x');
  A(d.pts.length===2&&near(d.pts[1],80,0)&&Math.abs(T.ordValue(d,d.pts[1])-40)<1e-9,'Point extrême X du cercle : (80,0), valeur 40');
  T.ordClick({x:300,y:300},'x');
  A(d.pts.length===2,'rien sous le curseur : aucun point ajouté');
  T.ctxPick('Automatique');
  A(T.snapMode()===null,'retour à Automatique');
  T.ordClick({x:120.3,y:100.2},'x');
  A(d.pts.length===3&&near(d.pts[2],20,0,1e-3),'Automatique : extrémité de L1 (20,0) comme avant');
  // 4. Échap pendant une intersection : le groupe continue ; Entrée le termine
  T.ctxPick('Intersection (même prolongée)');T.ordClick({x:110,y:100.3},'x');
  key('Escape');
  A(T.st().ord===d.id&&!T.st().intPick,'Échap sur l’intersection en cours : le groupe d’ordonnées continue');
  key('Enter');
  A(!T.st().ord&&T.st().tool==='select'&&d.pts.length===3,'Entrée : groupe terminé, 3 points');
  // 5. prolongements dessinés avec le groupe, et suivi du point d'intersection
  const lines=[];T.drawDim((tag,a)=>{if(tag==='line')lines.push(a);return{appendChild(){},setAttribute(){},textContent:''};},d);
  A(lines.some(p=>Math.abs(p.y1-100)<1e-6&&Math.abs(p.x1-120)<1e-6&&p.x2>140),'prolongement de L1 tracé jusqu’à l’origine');
  A(lines.some(p=>Math.abs(p.x1-140)<1e-6&&Math.abs(p.y1-110)<1e-6&&p.y2<100),'prolongement de L2 tracé jusqu’à l’origine');
  T.setViewGeo(v,{src:'dxf',els:[L1,{t:'L',x1:45,y1:10,x2:45,y2:30},C]});T.dimPts(d);
  A(near(d.o,45,0)&&Math.abs(T.ordValue(d,d.pts[0])-25)<1e-9,'L2 déplacée à x = 45 : l’origine suit, le centre vaut 25');
  // 6. hors de l'outil Ordonnées : le clic droit ne change pas
  mepSetTool('select');
  A(T.ctxAt({}).indexOf('Accrochage')<0,'outil Sélection : pas de menu d’accrochage');
  // 7. « qu'une des cotes d'ordonnée soit une cote de référence » : Maj + clic à la pose, clic droit
  //    sur la valeur, case du panneau (mepOrdSetRef) — valeur entre parenthèses, en gris
  sh.dims.length=0;T.setViewGeo(v,{src:'dxf',els:[L1,L2,C]});
  mepSetTool('ordx');
  T.ctxAt({});T.ctxPick('Extrémité'); // points exacts : extrémités de L1 et de L2
  T.ordClick({x:100.2,y:100.2},'x');T.ordClick({x:120.2,y:100.2},'x',true);T.ordClick({x:139.8,y:110.2},'x');
  key('Enter');
  const d2=sh.dims[sh.dims.length-1];
  A(d2&&d2.kind==='ord'&&d2.pts.length===2&&d2.pts[0].ref===true&&!d2.pts[1].ref,'Maj + clic : ce point seul en cote de référence');
  const texts=dd=>{const o=[];T.drawDim((tag,a)=>{const n={a,appendChild(){},setAttribute(){},textContent:''};if(tag==='text')o.push(n);return n;},dd);return o;};
  let tx=texts(d2);
  const tRef=tx.find(n=>n.textContent==='(20)'),t40=tx.find(n=>n.textContent==='40'),t0=tx.find(n=>n.textContent==='0');
  A(tRef&&/mepDimRef/.test(tRef.a.class),'valeur 20 écrite « (20) », en gris de référence');
  A(t40&&!/mepDimRef/.test(t40.a.class)&&t0&&!/mepDimRef/.test(t0.a.class),'les autres valeurs (0, 40) restent normales');
  mepSetTool('select');
  const pRef={x:140,y:95}; // sur la ligne d'attache de la valeur 40 (x = 140), entre le point et la ligne des valeurs
  // (banc : innerHTML='' ne vide pas le menu, on lit à partir de son titre)
  const menu=P=>{const o=T.ctxAt({P});const k=o.findIndex(s=>/^Cote d’ordonnée/.test(s));return k>=0?o.slice(k):o;};
  const it=menu(pRef);
  A(it[0]==='Cote d’ordonnée 40'&&it.indexOf('Cote de référence (entre parenthèses)')>=0&&it.indexOf('Supprimer ce point')>=0,'clic droit sur la valeur 40 : ses choix ('+it.join(' | ')+')');
  A(T.st().selDim===d2.id&&T.st().ordPt&&T.st().ordPt.i===1,'clic droit : la valeur 40 est désignée');
  A(T.ctxPick('Cote de référence (entre parenthèses)')&&d2.pts[1].ref===true,'« Cote de référence » : 40 devient une cote de référence');
  tx=texts(d2);
  A(tx.some(n=>n.textContent==='(40)'),'40 s’écrit « (40) »');
  A(menu(pRef).indexOf('✓ Cote de référence (entre parenthèses)')>=0,'clic droit suivant : la case est cochée');
  T.ctxPick('Cote de référence (entre parenthèses)');
  A(!d2.pts[1].ref&&texts(d2).some(n=>n.textContent==='40'),'second choix : 40 redevient une cote normale');
  // le texte de la valeur lui-même (au bout de la ligne d'attache, y = 79 → 79 − longueur) : zoom 4,
  // tolérance 1,5 mm — loin de la ligne d'attache (y ≤ 80 → 4,5 mm), sur le texte seulement
  T.st().zoom=4;window.mepFxRedraw();
  A(menu({x:140,y:75.5})[0]==='Cote d’ordonnée 40','clic droit sur le texte « 40 » (pas sur son trait) : son menu');
  T.ctxPick('Supprimer ce point');T.st().zoom=1;window.mepFxRedraw();
  A(d2.pts.length===1&&near(d2.pts[0],20,0),'« Supprimer ce point » : la valeur 40 est retirée');
  A(T.ctxAt({P:{x:100,y:95}}).length===0&&T.st().ordPt&&T.st().ordPt.i===-1,'clic droit sur l’origine « 0 » : pas de cote de référence possible');
  A(T.ordSetRef(d2,0,false)&&!d2.pts[0].ref&&T.ordSetRef(d2,0,true)&&d2.pts[0].ref===true,'case du panneau : (20) redevient normale, puis de référence');
  A(JSON.parse(JSON.stringify(d2)).pts[0].ref===true,'la cote de référence est enregistrée avec le plan');
  }catch(e){r.fails.push('erreur : '+(e&&e.message||e));}
  return r;
})()`,ctx);
console.log('=== PLAN : cotes d’ordonnées, clic droit (accrochage, cote de référence) ===');
out.log.forEach(m=>console.log('  ✓ '+m));
out.fails.forEach(m=>{ko++;console.log('  ✗ '+m);});
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(ko?1:0);
