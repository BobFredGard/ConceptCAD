// FAO : surfaçage avec passe de finition (case à cocher) — épaisseur laissée par l'ébauche,
// nombre de passes de finition, finition toujours dans le même sens. Pur logique (aucun OCCT).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    "const St={x0:0,y0:0,z0:0,x1:100,y1:80,z1:40};",
    "const B={toolD:10,z:30,secu:50,ae:6,sortie:5};",
    "const O=x=>Object.assign({},B,x);",
    "const zs=mv=>{const L=[];mv.filter(m=>!m.r).forEach(m=>{if(L.indexOf(m.z)<0)L.push(m.z);});return L;};",
    "const coupes=(mv,z)=>{const L=[];for(let i=1;i<mv.length;i++){const a=mv[i-1],b=mv[i];if(!b.r&&Math.abs(b.z-z)<1e-9&&Math.abs(a.z-z)<1e-9&&Math.abs(b.x-a.x)>1)L.push(b.x-a.x);}return L;};",
    // --- sans finition : rien ne change, quels que soient les réglages de finition laissés
    "const h=faoGenFacing(St,O({npz:2}));",
    "const h2=faoGenFacing(St,O({npz:2,fin:false,finEp:0.5,finN:3,finUni:true}));",
    "att(JSON.stringify(h)===JSON.stringify(h2),'case décochée : parcours identique à l’historique');",
    "att(JSON.stringify(zs(h))===JSON.stringify([35,30]),'historique pz=2 : niveaux 35/30 : '+JSON.stringify(zs(h)));",
    // --- finition en va-et-vient : ébauche jusqu'à Z+épaisseur, puis N passes égales
    "const f1=faoGenFacing(St,O({npz:2,fin:true,finEp:0.6,finN:1}));",
    "att(JSON.stringify(zs(f1))===JSON.stringify([35.3,30.6,30]),'finition 0,6 × 1 : niveaux 35,3 / 30,6 / 30 : '+JSON.stringify(zs(f1)));",
    "const f3=faoGenFacing(St,O({fin:true,finEp:0.6,finN:3}));",
    "att(JSON.stringify(zs(f3))===JSON.stringify([30.6,30.4,30.2,30]),'finition 0,6 × 3 : niveaux 30,6 / 30,4 / 30,2 / 30 : '+JSON.stringify(zs(f3)));",
    "const c3=coupes(f3,30);",
    "att(c3.some(d=>d>0)&&c3.some(d=>d<0),'va-et-vient : lignes dans les deux sens à la cote');",
    "att(f3.filter(m=>m.r).every(m=>m.z>=30-1e-9)&&f3.filter((m,i)=>i>1&&i<f3.length-1&&m.r).length===0,'va-et-vient : aucun rapide entre le début et la fin');",
    "att(c3.length===coupes(h,30).length,'finition : autant de lignes que l’ébauche (même écart)');",
    // --- finition toujours dans le même sens
    "const u=faoGenFacing(St,O({npz:2,fin:true,finEp:0.6,finN:2,finUni:true}));",
    "att(JSON.stringify(zs(u))===JSON.stringify([35.3,30.6,30.3,30]),'même sens : niveaux 35,3 / 30,6 / 30,3 / 30 : '+JSON.stringify(zs(u)));",
    "const cu=coupes(u,30),cu2=coupes(u,30.3),ce=coupes(u,30.6);",
    "att(cu.length===c3.length&&cu.every(d=>d>0),'même sens : toutes les lignes à la cote vers X+ ('+cu.length+')');",
    "att(cu2.length===c3.length&&cu2.every(d=>d>0),'même sens : toutes les lignes de la 1ʳᵉ finition vers X+');",
    "att(ce.some(d=>d>0)&&ce.some(d=>d<0),'même sens : l’ébauche reste en va-et-vient');",
    // retours : en rapide à la hauteur de sécurité, jamais en travers de la pièce au contact
    "let bas=0;for(let i=1;i<u.length;i++){const a=u[i-1],b=u[i];if(b.r&&(Math.abs(b.x-a.x)>1||Math.abs(b.y-a.y)>1e-6)&&(a.z<50-1e-9||b.z<50-1e-9))bas++;}",
    "att(bas===0,'même sens : tout déplacement rapide en XY se fait à la hauteur de sécurité ('+bas+')');",
    "let plonge=0;for(let i=1;i<u.length;i++){const a=u[i-1],b=u[i];if(b.z<a.z-1e-9&&!(b.x<=-10+1e-9||b.x>=110-1e-9))plonge++;}",
    "att(plonge===0,'même sens : toute descente se fait hors matière');",
    "att(u[u.length-1].r===1&&u[u.length-1].z===50,'même sens : fin à la hauteur de sécurité');",
    "att(u.every(m=>m.y>=-5.01&&m.y<=85.01),'même sens : Y dans [y0−r ; y1+r]');",
    // --- épaisseur plus grande que la matière : pas d'ébauche, finition sur ce qui reste
    "const g=faoGenFacing(St,O({z:39.5,fin:true,finEp:2,finN:2}));",
    "att(JSON.stringify(zs(g))===JSON.stringify([39.75,39.5]),'épaisseur > matière : 2 passes sur les 0,5 mm présents : '+JSON.stringify(zs(g)));",
    "att(faoGenFacing(St,O({z:39.5,fin:true,finEp:2,finN:2})).filter(m=>!m.r).every(m=>m.z<=40+1e-9),'aucune coupe au-dessus du brut');",
    // --- rien à enlever (cote au-dessus du brut) : la passe unique est la finition
    "const n0=faoGenFacing(St,O({z:40,fin:true,finEp:0.5,finN:3,finUni:true}));",
    "att(JSON.stringify(zs(n0))===JSON.stringify([40])&&coupes(n0,40).every(d=>d>0),'rien à enlever : une seule passe à la cote, dans le même sens');",
    // --- sens d'usinage : X (historique), Y, direction libre (face / arête), inversion
    "const lignes=mv=>{const L=[];for(let i=1;i<mv.length;i++){const a=mv[i-1],b=mv[i];if(!b.r&&Math.abs(a.z-b.z)<1e-9){const dx=b.x-a.x,dy=b.y-a.y;if(Math.hypot(dx,dy)>30)L.push([dx,dy]);}}return L;};",
    "att(JSON.stringify(faoGenFacing(St,O({dir:'x'})))===JSON.stringify(faoGenFacing(St,O({}))),'sens X : parcours identique à l’historique');",
    "att(faoFacingDir({})===null&&faoFacingDir({dir:[1,0]})===null,'sens X : aucune rotation');",
    "const dy=faoGenFacing(St,O({dir:'y'})),Ly=lignes(dy);",
    "att(Ly.length>0&&Ly.every(d=>Math.abs(d[0])<1e-6&&Math.abs(Math.abs(d[1])-100)<1e-6),'sens Y : lignes le long de Y, sur toute la longueur (80 + 2×10) : '+JSON.stringify(Ly[0]));",
    "att(dy.every(m=>m.x>=-5.01&&m.x<=105.01&&m.y>=-10.01&&m.y<=90.01),'sens Y : parcours dans le brut élargi du rayon et de la sortie');",
    "const xs=[];dy.forEach(m=>{if(!m.r&&xs.indexOf(m.x)<0)xs.push(m.x);});",
    "att(Math.min(...xs)<=0+1e-6&&Math.max(...xs)>=100-1e-6,'sens Y : toute la largeur X est couverte : '+Math.min(...xs)+' → '+Math.max(...xs));",
    "const uy=lignes(faoGenFacing(St,O({dir:'y',fin:true,finEp:0.5,finUni:true,z:30}))).length;",
    "const cy=faoGenFacing(St,O({dir:'y',fin:true,finEp:0.5,finUni:true}));",
    "const Lf=[];for(let i=1;i<cy.length;i++){const a=cy[i-1],b=cy[i];if(!b.r&&a.z===30&&b.z===30&&Math.abs(b.y-a.y)>30)Lf.push(b.y-a.y);}",
    "att(Lf.length>0&&Lf.every(d=>d>0),'sens Y + même sens : finition toujours vers Y+');",
    "const ci=faoGenFacing(St,O({dir:'y',dirInv:true,fin:true,finEp:0.5,finUni:true}));",
    "const Li=[];for(let i=1;i<ci.length;i++){const a=ci[i-1],b=ci[i];if(!b.r&&a.z===30&&b.z===30&&Math.abs(b.y-a.y)>30)Li.push(b.y-a.y);}",
    "att(Li.length>0&&Li.every(d=>d<0),'sens Y inversé : finition toujours vers Y−');",
    "const xi=coupes(faoGenFacing(St,O({dirInv:true,fin:true,finEp:0.5,finUni:true})),30);",
    "att(xi.length>0&&xi.every(d=>d<0),'sens X inversé : finition toujours vers X−');",
    "const s2=Math.SQRT1_2,d45=faoGenFacing(St,O({dir:[1,1]})),L45=lignes(d45);",
    "att(L45.length>0&&L45.every(d=>Math.abs(Math.abs(d[0])-Math.abs(d[1]))<1e-4),'direction libre 45° : lignes à 45°');",
    // couverture : chaque coin du brut est à moins d'un rayon d'une ligne de coupe
    "const dseg=(p,a,b)=>{const vx=b.x-a.x,vy=b.y-a.y,L2=vx*vx+vy*vy||1e-12;const t=Math.max(0,Math.min(1,((p[0]-a.x)*vx+(p[1]-a.y)*vy)/L2));return Math.hypot(p[0]-a.x-t*vx,p[1]-a.y-t*vy);};",
    "const couvre=(mv,p)=>{let m=1/0;for(let i=1;i<mv.length;i++)if(!mv[i].r)m=Math.min(m,dseg(p,mv[i-1],mv[i]));return m;};",
    "att([[0,0],[100,0],[100,80],[0,80],[50,40]].every(p=>couvre(d45,p)<=5+1e-6),'direction libre 45° : coins et centre du brut couverts par la fraise');",
    "att([[0,0],[100,0],[100,80],[0,80],[50,40]].every(p=>couvre(dy,p)<=5+1e-6),'sens Y : coins et centre du brut couverts par la fraise');",
    "att(d45.filter(m=>!m.r).every(m=>m.z===30)&&d45[d45.length-1].z===50,'direction libre : cotes Z inchangées');",
    // direction cliquée ramenée dans le plan usiné ; rangée sous le nom de l'axe quand elle s'aligne
    "att(faoFacingDirOf(null,[0,0,1])===null,'direction le long de l’outil : refusée');",
    "const oa={};faoFacingDirSet(oa,faoFacingDirOf(null,[0,-1,0]),'Face');att(oa.dir==='y'&&oa.dirInv===true&&!oa.dirSrc,'face de normale −Y : rangée « Y inversé »');",
    "const ob={};faoFacingDirSet(ob,faoFacingDirOf(null,[1,0,0.5]),'Arête');att(ob.dir===undefined&&!ob.dirInv,'arête inclinée dans XZ : sa projection est X');",
    "const oc={};faoFacingDirSet(oc,faoFacingDirOf(null,[1,1,0]),'Arête');att(Array.isArray(oc.dir)&&Math.abs(oc.dir[0]-s2)<1e-8&&oc.dirSrc==='Arête','arête à 45° : direction libre gardée');",
    // --- par l'opération : réglages lus, clé de cache sensible
    "const job=faoDefaultJob();job.stock=St;",
    "const op={type:'facing',z:30,ae:6};job.ops=[op];",
    "const k0=faoOpMovesKey(op,job),m0=faoOpMoves(op,job);",
    "op.finPasse=true;op.finEp=0.4;op.finN=2;op.finUni=true;",
    "const k1=faoOpMovesKey(op,job),m1=faoOpMoves(op,job);",
    "att(k0!==k1,'opération : la finition change la clé du parcours');",
    "att(JSON.stringify(zs(m0))===JSON.stringify([30])&&JSON.stringify(zs(m1))===JSON.stringify([30.4,30.2,30]),'opération : niveaux 30,4 / 30,2 / 30 : '+JSON.stringify(zs(m1)));",
    "att(coupes(m1,30).every(d=>d>0)&&coupes(m1,30.2).every(d=>d>0),'opération : finition dans le même sens');",
    "op.axial=1;const m2=faoOpMoves(op,job);",
    "att(JSON.stringify(zs(m2))===JSON.stringify([31.4,31.2,31]),'opération : « laisse Z » décale ébauche et finition : '+JSON.stringify(zs(m2)));",
    "const k2=faoOpMovesKey(op,job);op.dir='y';const k3=faoOpMovesKey(op,job),m3=faoOpMoves(op,job);",
    "att(k2!==k3&&lignes(m3).every(d=>Math.abs(d[0])<1e-6),'opération : le sens Y change la clé et tourne les lignes');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}",
    "else p('TOUT EST CONFORME');",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_surfacage_finition.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.message)||e).slice(0,500));process.exit(1);});
