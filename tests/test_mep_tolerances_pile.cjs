// 2026-11-26 : PLAN — « Pouvoir empiler/ajouter une autre tolérance géométrique en dessous une existante. Le menu
// permet la création d'un 2nd et une 3ème » : clic droit sur un cadre (ou bouton du panneau) → un cadre collé
// dessous, sans flèche, réglé à part ; 3 au plus ; glisser un cadre de la pile déplace toute la pile ;
// Suppr du 1er retire la pile, d'un cadre du milieu : celui d'en dessous remonte.
// Vue à (100,100), échelle 1 : rectangle 0..60 × 0..30, cote 0 → 60 en bas.
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
  T.setViewGeo(v,{src:'dxf',els:[{t:'L',x1:0,y1:0,x2:60,y2:0},{t:'L',x1:60,y1:0,x2:60,y2:30},{t:'L',x1:60,y1:30,x2:0,y2:30},{t:'L',x1:0,y1:30,x2:0,y2:0}]});
  const dessin=d=>{const o={lines:[],texts:[]};
    T.drawDim((tag,a)=>{const e={a,appendChild(){},setAttribute(k,x){a[k]=x;},textContent:''};
      if(tag==='line')o.lines.push(a);if(tag==='text')o.texts.push(e);return e;},d);return o;};
  // boîte d'un cadre : ses traits horizontaux (les bords haut et bas)
  // (le petit trait d'attache de la ligne de repère, horizontal lui aussi, est à mi-hauteur : écarté)
  const boite=d=>{const H=dessin(d).lines.filter(l=>!l['marker-end']&&near(+l.y1,+l.y2)&&Math.abs(+l.x2-+l.x1)>3);
    const ys=H.map(l=>+l.y1),y0=Math.min(...ys),y1=Math.max(...ys);
    const xs=H.filter(l=>near(+l.y1,y0)).flatMap(l=>[+l.x1,+l.x2]);return{x0:Math.min(...xs),x1:Math.max(...xs),y0,y1};};
  const menu=P=>{const o=T.ctxAt({P});const k=o.findIndex(s=>/^Tolérance géométrique/.test(s));return k>=0?o.slice(k):o;};
  // 1. un cadre sur l'arête droite (x = 60 → papier 160), cadre en haut à droite
  mepSetTool('gdt');T.gdtClick({x:160,y:115},'gdt');T.gdtClick({x:185,y:95},'gdt');
  const g1=sh.dims[sh.dims.length-1];mepSetTool('select');
  const B1=boite(g1),H=B1.y1-B1.y0;
  A(g1.kind==='gdt'&&near(B1.x0,185)&&H>5,'1er cadre posé ('+B1.x0.toFixed(2)+', hauteur '+H.toFixed(2)+')');
  // 2. clic droit sur le cadre : « Ajouter un cadre en dessous (2ᵉ) »
  const P1={x:B1.x0+2,y:(B1.y0+B1.y1)/2};
  let it=menu(P1);
  A(it[0]==='Tolérance géométrique'&&it.indexOf('Ajouter un cadre en dessous (2ᵉ)')>=0&&it.indexOf('Supprimer ce cadre')>=0,'clic droit sur le cadre : '+it.join(' | '));
  A(T.ctxPick('Ajouter un cadre en dessous (2ᵉ)'),'choisi');
  const g2=sh.dims[sh.dims.length-1];
  A(g2!==g1&&g2.kind==='gdt'&&g2.under===g1.id&&T.st().selDim===g2.id,'2ᵉ cadre créé sous le 1er, désigné pour le régler');
  g2.g={sym:'perp',dia:false,val:'0.01',mod:'',refs:[{l:'A',m:''}]};
  let B2=boite(g2);
  A(near(B2.x0,B1.x0)&&near(B2.y0,B1.y1)&&near(B2.y1,B1.y1+H),'collé sous le 1er, bords gauches alignés');
  const d2=dessin(g2);
  A(!d2.lines.some(l=>l['marker-end'])&&d2.texts.some(t=>t.textContent==='0.01')&&d2.texts.some(t=>t.textContent==='A'),'pas de flèche, ses propres réglages (0.01, réf. A)');
  A(T.dimAt(B2.x0+2,(B2.y0+B2.y1)/2)===g2,'clic dans le 2ᵉ cadre : c’est lui qui est pris');
  // 3. 3ᵉ, puis plus rien (3 au plus)
  it=menu({x:B2.x0+2,y:(B2.y0+B2.y1)/2});
  A(it[0]==='Tolérance géométrique — cadre 2 / 2'&&T.ctxPick('Ajouter un cadre en dessous (3ᵉ)'),'clic droit sur le 2ᵉ : « Ajouter … (3ᵉ) »');
  const g3=sh.dims[sh.dims.length-1];
  let B3=boite(g3);
  A(g3.under===g2.id&&near(B3.y0,B2.y1)&&near(B3.x0,B1.x0),'3ᵉ cadre sous le 2ᵉ');
  it=menu({x:B3.x0+2,y:(B3.y0+B3.y1)/2});
  A(it[0]==='Tolérance géométrique — cadre 3 / 3'&&!it.some(s=>/Ajouter/.test(s)),'pile pleine : plus d’« Ajouter » ('+it.join(' | ')+')');
  A(T.gdtStack(g3).map(d=>d.id).join()===[g1,g2,g3].map(d=>d.id).join(),'pile : 1er, 2ᵉ, 3ᵉ');
  // 4. glisser le 3ᵉ : toute la pile part, le 3ᵉ reste désigné
  T.dimDragStart({x:B3.x0+2,y:(B3.y0+B3.y1)/2},g3);
  A(T.st().pick&&T.st().pick.id===g1.id&&T.st().selDim===g3.id,'saisie du 3ᵉ : on déplace le 1er (la pile), le 3ᵉ reste désigné');
  window.mepDimMoveTo(g1,{x:B3.x0+2+20,y:(B3.y0+B3.y1)/2+10},T.st().pick);
  const C1=boite(g1),C3=boite(g3);
  A(near(C1.x0,B1.x0+20)&&near(C1.y0,B1.y0+10)&&near(C3.x0,B3.x0+20)&&near(C3.y0,B3.y0+10),'pile déplacée de (20, 10), toujours collée');
  A(window.mepDimMoveTo(g2,{x:0,y:0})===false,'un cadre empilé ne part pas seul');
  // 5. enregistrement
  A(JSON.parse(JSON.stringify(sh.dims)).find(x=>x.id===g3.id).under===g2.id,'pile enregistrée avec le plan');
  // 6. Suppr du 2ᵉ : le 3ᵉ remonte sous le 1er ; Suppr du 1er : la pile part
  T.selDim(g2.id);T.key('Delete');
  A(sh.dims.indexOf(g2)<0&&g3.under===g1.id&&near(boite(g3).y0,boite(g1).y1),'Suppr du 2ᵉ : le 3ᵉ remonte sous le 1er');
  T.selDim(g1.id);T.key('Delete');
  A(sh.dims.indexOf(g1)<0&&sh.dims.indexOf(g3)<0,'Suppr du 1er : toute la pile part');
  // 7. cadre sous la valeur d'une cote (comme 9.6 / 17.9) : le 2ᵉ se colle dessous
  const L={id:'L1',kind:'dist',vid:v.id,vid2:null,a:{x:0,y:30},b:{x:60,y:30},orient:'h',off:20,tol:null,ref:false};sh.dims.push(L);
  window.mepFxRedraw();
  mepSetTool('gdt');T.gdtClick({x:130,y:150},'gdt');mepSetTool('select');
  const g4=sh.dims[sh.dims.length-1];
  A(g4.kind==='gdt'&&g4.on==='L1','cadre accroché sous la valeur de la cote');
  const B4=boite(g4);
  T.ctxAt({P:{x:B4.x0+1.5,y:(B4.y0+B4.y1)/2}});T.ctxPick('Ajouter un cadre en dessous (2ᵉ)');
  const g5=sh.dims[sh.dims.length-1],B5=boite(g5);
  A(g5.under===g4.id&&near(B5.x0,B4.x0)&&near(B5.y0,B4.y1),'2ᵉ cadre sous celui de la cote');
  T.selDim('L1');T.key('Delete');
  A(!sh.dims.some(x=>x.id==='L1'||x===g4||x===g5),'Suppr de la cote : son cadre et le cadre empilé partent');
  // 8. ligne de repère à droite : cadres alignés à droite
  mepSetTool('gdt');T.gdtClick({x:100,y:115},'gdt');T.gdtClick({x:70,y:95},'gdt');
  const g6=sh.dims[sh.dims.length-1];mepSetTool('select');
  const B6=boite(g6);
  T.ctxAt({P:{x:B6.x1-2,y:(B6.y0+B6.y1)/2}});T.ctxPick('Ajouter un cadre en dessous (2ᵉ)');
  const g7=sh.dims[sh.dims.length-1];g7.g={sym:'flat',dia:false,val:'0.1',mod:'',refs:[]};
  const B7=boite(g7);
  A(g7.under===g6.id&&near(B7.x1,B6.x1)&&near(B7.y0,B6.y1),'flèche à droite du cadre : la pile est alignée à droite');
  }catch(e){r.fails.push('erreur : '+(e&&e.message||e));}
  return r;
})()`,ctx);
console.log('=== PLAN : cadres de tolérance empilés ===');
out.log.forEach(m=>console.log('  ✓ '+m));
out.fails.forEach(m=>{ko++;console.log('  ✗ '+m);});
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(ko?1:0);
