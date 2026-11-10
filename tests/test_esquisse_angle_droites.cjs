// V0.80.2 : Butoir ZE4 — la ligne de base O→p36 change de sens quand le centre de l'arc passe de 50 à 75 ;
// la cote de 3° (tangente ↔ base) visait alors l'autre côté, rien n'était résolu et la cote de 75 n'était
// pas tenue (centre resté à 50). Reprise « droites » : l'angle est tenu entre les droites, tout se résout.
const vm=require('vm');const path=require('path');const {loadApp}=require('./appvm.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  x '+m);}else console.log('  ✓ '+m);};
const {ctx}=loadApp();
ctx.__sk=require(path.join(__dirname,'fixtures','butoir-ze4-esquisse.json'));
const r=vm.runInContext(`(function(){const o={};
  const sk=JSON.parse(JSON.stringify(__sk));doc.sketches=[sk];
  o.avant=skResid(sk);solveSketch(sk);const P=sk.points;
  o.res=skResid(sk);o.c=[P.p22.x,P.p22.y];o.p36=P.p36.x;o.p45=P.p45.x;
  const fr=angleFrame(sk,sk.dims.find(d=>d.id==='e38'||d.id==='e44'));o.d44=fr&&fr.delta*180/Math.PI;
  solveSketch(sk);o.res2=skResid(sk);o.c2=[P.p22.x,P.p22.y];
  // une cote impossible (centre à 40 : la base passerait derrière l'origine) reste refusée, rien ne se retourne
  const sk2=JSON.parse(JSON.stringify(sk));doc.sketches=[sk2];sk2.dims.find(d=>d.id==='e25').value=40;solveSketch(sk2);
  o.imp=skResid(sk2);o.impTan=sk2.points.p37.y>0;
  return o;})()`,ctx);
A(r.avant>1,'fichier ouvert : esquisse en défaut ('+r.avant.toFixed(1)+')');
A(r.res<1e-3,'résolue (résidu '+r.res.toExponential(1)+')');
A(Math.abs(r.c[0]-75)<1e-3&&Math.abs(r.c[1]+57)<1e-3,'centre de l’arc à X75 / Y−57 (cote 75, hauteur 3) '+JSON.stringify(r.c));
A(Math.abs(r.p36-16.1854)<1e-3&&Math.abs(r.p45-133.8146)<1e-3,'tangentes à 3° : départs à X16,19 et X133,81 ('+r.p36.toFixed(3)+', '+r.p45.toFixed(3)+')');
A(Math.abs(Math.abs(r.d44)-177)<1e-3,'la tangente monte de 3° vers la droite (secteur 177° avec la base vers O)');
A(r.res2<1e-3&&Math.abs(r.c2[0]-75)<1e-6,'nouvelle résolution : rien ne bouge');
A(r.imp>0.05&&r.impTan,'cote 40 impossible : signalée, tangente restée au-dessus');
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');process.exit(ko?1:0);
