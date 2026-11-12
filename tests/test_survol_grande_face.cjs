// Survol (pré-sélection bleue) d'une GRANDE face (V0.95.6) : la face d'une plaque très percée compte plus de
// 4000 triangles ; le survol s'arrêtait au 4000ᵉ et n'allumait qu'un morceau (un triangle bleu), alors que la
// sélection orange prenait toute la face. On prouve : survol = tous les triangles de la face, et les mêmes que
// la sélection ; petite face inchangée ; triangle hors face BRep (repli) toujours allumé.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
const {ctx}=loadApp();
const R=`
  const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
  const vus=[];highlightTris=function(mesh,tris,color){vus.push({n:tris?tris.length:0,first:tris&&tris[0],last:tris&&tris[tris.length-1],color});};
  // grande face (groupe BRep de 12 000 triangles) puis petite face voisine
  const mesh={uuid:'m1',geometry:{userData:{occGroups:[{f:0,start:0,count:12000},{f:1,start:12000,count:40}]}}};
  let fi=5000;
  pick=()=>({object:mesh,faceIndex:fi,distance:100});
  edgePickScreen=()=>null;triadHoverAt=()=>false;if(typeof faoPoseHoverAt==='function')faoPoseHoverAt=()=>false;
  mesScene=()=>({add(){}});ctrlMesureEv=()=>false;
  skEdit=null;filMode=false;filModeX=false;faoChainMode=false;
  const ev={buttons:0,clientX:0,clientY:0};
  const survol=()=>{lastHoverT=-1e9;hoverKey='';hoverGroup=null;hoverMove(ev);return vus[vus.length-1];}; // THREE simulé : survol remis à zéro à la main
  let v=survol();
  A(v&&v.n===12000&&v.first===0&&v.last===11999,'1 : grande face allumée en entier au survol (12000 triangles) — vu '+(v&&v.n));
  A(v&&v.color===0x0a84ff,'2 : couleur bleue de la pré-sélection');
  A(v&&v.n===faceTrisFor(mesh,fi).length,'3 : mêmes triangles que la sélection orange');
  fi=12010;v=survol();
  A(v&&v.n===40&&v.first===12000,'4 : petite face : ses 40 triangles — vu '+(v&&v.n));
  // repli sans faces BRep : la région propagée (growTris) ou le triangle seul
  mesh.geometry.userData.occGroups=[];growTris=()=>null;fi=7;v=survol();
  A(v&&v.n===1&&v.first===7,'5 : sans face BRep, le triangle survolé reste allumé');
  JSON.stringify(out);
`;
const r=JSON.parse(vm.runInContext(R,ctx));
r.log.forEach(m=>console.log('  ✓ '+m));
r.fails.forEach(m=>console.log('  ✗ '+m));
console.log(r.fails.length?'ECHECS : '+r.fails.length:'TOUT EST CONFORME');
process.exit(r.fails.length?1:0);
