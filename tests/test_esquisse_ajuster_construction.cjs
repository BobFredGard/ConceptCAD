// Outil Ajuster : la coupe partage aussi les lignes qui passent par le point de coupe.
// Une ligne de construction partagée ainsi doit le rester sur ses deux moitiés : la moitié
// neuve perdait son drapeau, devenait une ligne normale et pouvait compter dans les profils.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    'const out={fails:[],log:[]};',
    'const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push("ok · "+m);};',
    'const mk=(pts,ents)=>{const sk={id:"t1",name:"T",plane:"XY",visible:true,points:pts,entities:ents,constraints:[],dims:[],seq:100};',
    '  ensureSketchBasis(sk);doc.features=[];doc.sketches=[sk];openSketch(sk.id);return skEdit;};',
    // L et N se croisent en (5,5), la construction C passe aussi par ce point.
    'const sk=mk({a:{x:-15,y:5},b:{x:25,y:5},c:{x:5,y:-15},d:{x:5,y:25},e:{x:-5,y:-5},f:{x:15,y:15}},[',
    '  {id:"L",t:"line",p1:"a",p2:"b"},{id:"N",t:"line",p1:"c",p2:"d"},{id:"C",t:"line",p1:"e",p2:"f",construction:true}]);',
    'const avant=new Set(sk.entities.map(e=>e.id));',
    'const msg=trimEntity(sk,entById(sk,"L"),20,5);',
    'A(/ajust/i.test(msg),"1a : L est ajustée au croisement ("+msg+")");',
    'const neuves=sk.entities.filter(e=>!avant.has(e.id));',
    'const pid=entById(sk,"L").p2;',
    'const moitieC=neuves.find(e=>e.p1===pid&&e.p2==="f"),moitieN=neuves.find(e=>e.p1===pid&&e.p2==="d");',
    'A(!!moitieC&&entById(sk,"C").p2===pid,"1b : C est partagée au point de coupe");',
    'A(!!moitieC&&moitieC.construction===true,"1c : la nouvelle moitié de C reste en construction");',
    'A(entById(sk,"C").construction===true,"1d : la moitié conservée de C reste en construction");',
    'A(!!moitieN&&entById(sk,"N").p2===pid,"1e : N est partagée au point de coupe");',
    'A(!!moitieN&&!("construction" in moitieN),"1f : la moitié d’une ligne normale reste normale, sans champ ajouté au fichier");',
    // Conséquence dans les profils : la moitié neuve de D fermerait le triangle a-b-(20,20) si elle redevenait normale.
    // (a n’est pas en (0,0) : un point à l’origine y est fusionné à l’ouverture de l’esquisse.)
    'const sk2=mk({a:{x:2,y:2},b:{x:20,y:2},g:{x:20,y:30},h:{x:10,y:20},i:{x:30,y:20},e:{x:40,y:40}},[',
    '  {id:"B",t:"line",p1:"a",p2:"b"},{id:"V",t:"line",p1:"b",p2:"g"},{id:"H",t:"line",p1:"h",p2:"i"},{id:"D",t:"line",p1:"e",p2:"a",construction:true}]);',
    'A(skLoopTrace(sk2).solids.length===0,"2a : aucun profil fermé avant la coupe");',
    'trimEntity(sk2,entById(sk2,"V"),20,25);',
    'const moitieD=sk2.entities.find(e=>e.p2==="a"&&e.id!=="D");',
    'A(!!moitieD&&moitieD.construction===true,"2b : la moitié de la diagonale de construction reste en construction");',
    'A(skLoopTrace(sk2).solids.length===0,"2c : elle ne ferme aucun profil après la coupe ("+skLoopTrace(sk2).solids.length+")");',
    // Même chose pour une ligne de référence 3D : partagée au point de coupe…
    'const sk3=mk({a:{x:2,y:2},b:{x:20,y:2},g:{x:20,y:30},h:{x:10,y:20},i:{x:30,y:20},e:{x:40,y:40}},[',
    '  {id:"B",t:"line",p1:"a",p2:"b"},{id:"V",t:"line",p1:"b",p2:"g"},{id:"H",t:"line",p1:"h",p2:"i"},{id:"D",t:"line",p1:"e",p2:"a",ref:true}]);',
    'trimEntity(sk3,entById(sk3,"V"),20,25);',
    'const moitieR=sk3.entities.find(e=>e.p2==="a"&&e.id!=="D");',
    'A(!!moitieR&&moitieR.ref===true,"3a : la moitié neuve d’une référence 3D reste une référence");',
    'A(entById(sk3,"D").ref===true,"3b : la moitié conservée reste une référence");',
    'A(skLoopTrace(sk3).solids.length===0,"3c : elle ne ferme aucun profil après la coupe ("+skLoopTrace(sk3).solids.length+")");',
    // …ou ajustée elle-même au milieu : les deux tronçons restants restent des références.
    'const sk4=mk({a:{x:-10,y:5},b:{x:30,y:5},c:{x:0,y:-5},d:{x:0,y:15},e:{x:20,y:-5},f:{x:20,y:15}},[',
    '  {id:"R",t:"line",p1:"a",p2:"b",ref:true},{id:"V1",t:"line",p1:"c",p2:"d"},{id:"V2",t:"line",p1:"e",p2:"f"}]);',
    'const avant4=new Set(sk4.entities.map(e=>e.id));',
    'const msg4=trimEntity(sk4,entById(sk4,"R"),10,5);',
    'const bouts=sk4.entities.filter(e=>e.p1==="a"||e.p2==="b");',
    'A(/Tronçon/.test(msg4)&&bouts.length===2,"3d : le milieu de la référence est retiré ("+msg4+")");',
    'A(bouts.length===2&&bouts.every(e=>e.ref===true),"3e : les deux tronçons restants restent des références");',
    'A(sk4.entities.filter(e=>!avant4.has(e.id)&&e.ref!==true&&e.p1!=="a"&&e.p2!=="b").every(e=>!("ref" in e)),"3f : les moitiés de lignes normales restent normales, sans champ ajouté au fichier");',
    'return out;'
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Ajuster : une ligne de construction partagée reste en construction ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m.replace(/^ok · /,'')));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,900));process.exit(1);});
