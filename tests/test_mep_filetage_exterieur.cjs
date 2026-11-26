// 2026-11-26 : PLAN — filetage extérieur (fonction Filetage, filet cosmétique) dans les vues et sa cote.
// « Normalement ce Ø4 est un M4. La vue ne montre pas le filet du cylindre qui existe dans le 3D et ne
// cote pas comme un filetage. A corriger »
// Axe M4 le long de Z : bout libre en z = −18,6 avec chanfrein 0,4 × 45°, face cylindrique de z = −18,2
// à −10,6 (7,6 mm), épaulement Ø6 au-dessus. Géométrie du rejeu (threadGeo) posée à la main.
// Vue de face : x = X, y = −Z.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
let ko=0;
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);
  try{
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet();
  A(typeof T.xThreadEls==='function'&&typeof T.dimThread==='function','filetages extérieurs connus de la mise en plan');
  sh.views.length=0;sh.dims.length=0;
  const rR=(4-1.082532*0.7)/2;
  const f={id:'th1',type:'xthread',name:'Filetage M4 (toute la face)',size:'M4',p:0.7,lh:false,model:false,clear:0,lenMode:'full',len:6,flip:false,visible:true,body:null,
    cyl:{c:[0,0,-14],u:[0,0,1],r:2,p:[2,0,-14]}};
  doc.features.push(f);
  const k0=T.geomKey();
  threadGeo.set('th1',{bid:null,o:[0,0,-18.2],d:[0,0,1],R:2,rR,len:7.6,P:0.7,lh:false,free:true,f0:0.37,f1:null,span:7.6});
  A(T.geomKey()!==k0,'arrivée de la géométrie du filet (rejeu) : les vues se refont');
  const L=(x1,y1,x2,y2,k)=>({t:'L',x1,y1,x2,y2,k:k||'sharp'});
  const front=[L(2,10.6,2,18.2),L(-2,10.6,-2,18.2),L(2,18.2,1.6,18.6),L(-2,18.2,-1.6,18.6),L(-1.6,18.6,1.6,18.6),L(-2,18.2,2,18.2,'tangent'),
    L(-3,10.6,3,10.6),L(3,0,3,10.6),L(-3,0,-3,10.6)];
  const vF=mepAddViewStd('front');vF.x=100;vF.y=60;vF.scale=1;vF.axes=[];
  const xs=T.xThreadEls(vF,front);
  const roots=xs.filter(e=>e.t==='L'&&e.k==='thread');
  A(roots.length===2&&roots.every(e=>near(Math.abs(e.x1),rR)&&near(e.x1,e.x2)),'vue de côté : 2 traits fins au fond de filet (Ø '+(2*rR).toFixed(3)+')');
  const yb=e=>Math.max(e.y1,e.y2),yt=e=>Math.min(e.y1,e.y2);
  A(roots.every(e=>near(yt(e),10.6)&&near(yb(e),18.2+(2-rR),1e-6)),'de l’épaulement jusqu’à la rencontre du chanfrein ('+roots.map(e=>yt(e).toFixed(3)+' → '+yb(e).toFixed(4)).join(' ; ')+')');
  A(!xs.some(e=>e.k==='sharp'),'filet sur toute la face : pas de trait de fin de filetage');
  // chanfrein fait APRÈS le filetage dans l'historique : le rejeu du filet part du bout plat (z = −18,6)
  const g0=threadGeo.get('th1');
  threadGeo.set('th1',{bid:null,o:[0,0,-18.6],d:[0,0,1],R:2,rR,len:8,P:0.7,lh:false,free:true,f0:0.02,f1:null,span:8});
  const rc=T.xThreadEls(vF,front).filter(e=>e.k==='thread');
  A(rc.length===2&&rc.every(e=>near(yb(e),18.2+(2-rR),1e-6)&&near(yt(e),10.6)),'chanfrein posé après le filetage : le fond de filet s’arrête aussi au chanfrein ('+rc.map(e=>yb(e).toFixed(4)).join(' ; ')+')');
  const big=front.map(e=>e).concat([]);big[2]=L(2,17.6,1,18.6);big[3]=L(-2,17.6,-1,18.6);big[4]=L(-1,18.6,1,18.6);big[5]=L(-2,17.6,2,17.6,'tangent');
  const rb=T.xThreadEls(vF,big).filter(e=>e.k==='thread');
  A(rb.length===2&&rb.every(e=>near(yb(e),17.6+(2-rR),1e-6)),'grand chanfrein (1 mm) : pas de trait qui dépasse le contour');
  threadGeo.set('th1',g0);
  // longueur donnée : arrêt avant l'épaulement, trait fort de fin de filetage
  f.lenMode='len';f.len=5;threadGeo.get('th1').len=5;
  const xs2=T.xThreadEls(vF,front),r2=xs2.filter(e=>e.k==='thread'),end=xs2.filter(e=>e.k==='sharp');
  A(r2.length===2&&r2.every(e=>near(yt(e),13.2)),'longueur 5 : fond de filet jusqu’à 5 mm du bout de la face');
  A(end.length===1&&near(end[0].y1,13.2)&&near(end[0].y2,13.2)&&near(Math.abs(end[0].x1),2)&&near(Math.abs(end[0].x2),2),'trait fort de fin de filetage jusqu’au Ø nominal');
  // vues en bout : bout libre vu (dessous) → 3/4 de cercle ; dessus (épaulement devant) → rien
  const vB=mepAddViewStd('bottom'),vT=mepAddViewStd('top');
  const xb=T.xThreadEls(vB,[]),xt=T.xThreadEls(vT,[]);
  A(xb.length===1&&xb[0].t==='A'&&near(xb[0].r,rR)&&near(xb[0].cx,0)&&near(xb[0].cy,0)&&near(xb[0].a1-xb[0].a0,1.5*Math.PI)&&xb[0].k==='thread','vue de dessous : 3/4 de cercle fin au fond de filet');
  A(xt.length===0,'vue de dessus : bout libre caché, rien');
  // filet modélisé, filet masqué : rien
  f.model=true;A(T.xThreadEls(vF,front).length===0,'filet modélisé : déjà dans le solide, rien d’ajouté');f.model=false;
  f.visible=false;A(T.xThreadEls(vF,front).length===0,'fonction masquée : rien');f.visible=true;
  // cote Ø sur la partie filetée → « M4 »
  f.lenMode='full';threadGeo.get('th1').len=7.6;
  T.setViewGeo(vF,{src:'dxf',els:front.concat(T.xThreadEls(vF,front))});
  const txt=d=>{const o=[];T.drawDim((tag,a)=>{const e={a,appendChild(){},setAttribute(k,x){a[k]=x;},textContent:''};if(tag==='text')o.push(e);return e;},d);return o.map(e=>e.textContent).join('|');};
  const d1={id:'D1',kind:'dist',vid:vF.id,vid2:null,a:{x:-2,y:15},b:{x:2,y:15},orient:'h',off:12,tol:null,ref:false,dsym:'Ø'};
  sh.dims.push(d1);
  A(T.dimThread(d1)&&txt(d1)==='M4','cote Ø4 entre génératrices du cylindre fileté : « '+txt(d1)+' »');
  const d2={id:'D2',kind:'len',vid:vF.id,vid2:null,a:{x:-1.6,y:18.6,hint:{t:'seg',i:4}},b:{x:1.6,y:18.6},orient:'h',off:8,tol:null,ref:false,dsym:'Ø'};
  sh.dims.push(d2);
  A(!T.dimThread(d2)&&/^Ø3[.,]2/.test(txt(d2)),'bout chanfreiné (Ø3,2) : reste un Ø ('+txt(d2)+')');
  const d3={id:'D3',kind:'dist',vid:vF.id,vid2:null,a:{x:-3,y:5},b:{x:3,y:5},orient:'h',off:-12,tol:null,ref:false,dsym:'Ø'};
  sh.dims.push(d3);
  A(!T.dimThread(d3)&&txt(d3)==='Ø6','épaulement Ø6 : reste Ø6');
  d1.tol={m:'cls',cls:'6g'};A(txt(d1)==='M4-6g','classe de tolérance : « '+txt(d1)+' »');d1.tol=null;
  d1.pre='2×';A(txt(d1)==='2× M4','texte avant gardé');d1.pre='';
  f.p=0.5;A(txt(d1)==='M4×0,5','pas fin : « '+txt(d1)+' »');f.p=0.7;
  f.lh=true;A(txt(d1)==='M4-LH','filet à gauche : « '+txt(d1)+' »');f.lh=false;
  d1.txt='Ø4 h9';A(txt(d1)==='Ø4 h9','texte imposé : gardé');delete d1.txt;
  // longueur filetée 5 : une cote Ø4 sur la partie lisse reste Ø4
  f.lenMode='len';threadGeo.get('th1').len=5;
  const d4={id:'D4',kind:'dist',vid:vF.id,vid2:null,a:{x:-2,y:11.5},b:{x:2,y:11.5},orient:'h',off:16,tol:null,ref:false,dsym:'Ø'};
  sh.dims.push(d4);
  A(txt(d4)==='Ø4'&&txt(d1)==='M4','longueur filetée 5 : partie lisse Ø4, partie filetée M4');
  f.lenMode='full';threadGeo.get('th1').len=7.6;
  // cote de diamètre sur le cercle vu en bout
  T.setViewGeo(vB,{src:'dxf',els:[{t:'C',cx:0,cy:0,r:2,k:'sharp'},{t:'C',cx:0,cy:0,r:3,k:'sharp'}]});
  const d5={id:'D5',kind:'dia',vid:vB.id,vid2:null,a:{x:2,y:0,hint:{t:'seg',i:0}},b:{x:14,y:-10},tol:null,ref:false};
  const d6={id:'D6',kind:'dia',vid:vB.id,vid2:null,a:{x:3,y:0,hint:{t:'seg',i:1}},b:{x:14,y:10},tol:null,ref:false};
  sh.dims.push(d5,d6);
  A(txt(d5)==='M4'&&txt(d6)==='Ø6','vue en bout : cercle fileté « M4 », épaulement « Ø6 »');
  // pas de géométrie du rejeu (pas encore rejoué, ou erreur) : rien, et la cote reste Ø4
  threadGeo.delete('th1');
  A(T.xThreadEls(vF,front).length===0&&txt(d1)==='Ø4','avant le rejeu : rien d’ajouté, cote Ø4');
  }catch(e){r.fails.push('erreur : '+(e&&e.stack||e));}
  return r;
})()`,ctx);
console.log('=== PLAN : filetage extérieur dans les vues et sa cote ===');
out.log.forEach(m=>console.log('  ✓ '+m));
out.fails.forEach(m=>{ko++;console.log('  ✗ '+m);});
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(ko?1:0);
