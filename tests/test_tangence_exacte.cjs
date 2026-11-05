// V0.63.6 : CHANFREIN AU FOND D'UNE RAINURE dont l'extrémité est tangente au bord de la pièce, sur le
// vrai noyau (MERLIN-32-002-E, réduit à l'essentiel). Le solveur laisse la tangence ligne/arc à 4e-11 mm
// près : le point de jonction glisse de 7 µm (√(2·r·écart)) et la ligne s'arrête 7 µm avant le flanc x=6.
// La découpe laissait une face cylindrique de 7 µm de large et 4 micro-arêtes ; le chanfrein du fond la
// rendait invalide : l'aperçu la montrait, « Appliquer » la refusait.
//  1. sans correction (skTangencesExactes neutralisée), le défaut est là : micro-arêtes, refus au rejeu,
//     et l'aperçu ne montre plus le solide déchiré — il dit pourquoi, comme Appliquer ;
//  2. skTangencesExactes : copie seulement si besoin, esquisse d'origine intacte, vraie non-tangence ignorée ;
//  3. avec la correction, par la commande réelle : plus de micro-arête, chanfrein appliqué, solide valide,
//     matière enlevée = 1/2 × D² × 1,2 mm.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "const vol=sh=>{const G=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(sh,G,false,false,false);const v=G.Mass();G.delete();return v;};",
    "const near=(a,b,t)=>Math.abs(a-b)<=t;",
    // pièce : bloc x −3..6, y ±2,5, z 0..4,5 ; rainure de largeur 1,2 sur 2,5 de haut, centre d'arc sur le flanc x=6.
    // Coordonnées de l'esquisse du fichier : elles portent le défaut du solveur.
    "const bloc={id:'s1',name:'s1',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:-3,y:-2.5},b:{x:6,y:-2.5},c:{x:6,y:2.5},d:{x:-3,y:2.5}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:9,visible:false};",
    "const rainure={id:'s2',name:'s2',plane:'XY',origin:[0,0,4.5],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{",
    "  p2:{x:-1.1000158313288684,y:0.5999999997911443},p3:{x:5.999992979485821,y:0.5999999997911443},p4:{x:-1.100015831329617,y:-0.5999999997911416},p5:{x:5.9999929794868505,y:-0.5999999997911416},",
    "  p6:{x:-1.1000000000771943,y:1.3357837943287045e-15},p7:{x:5.999999999922806,y:1.3357837943287045e-15}},",
    "  entities:[{id:'e8',t:'line',p1:'p2',p2:'p3'},{id:'e9',t:'line',p1:'p4',p2:'p5'},{id:'e10',t:'arc',pc:'p6',pa:'p2',pb:'p4',r:0.6},{id:'e11',t:'arc',pc:'p7',pa:'p5',pb:'p3',r:0.599999999832215},{id:'e12',t:'line',p1:'p6',p2:'p7',construction:true}],",
    "  constraints:[],dims:[],seq:20,visible:false};",
    "const construit=()=>{doc.sketches=[bloc,rainure];doc.bodies=[];doc.features=[{id:'F1',type:'extrude',name:'bloc',sketchId:'s1',distance:4.5,op:'add',visible:true},{id:'F2',type:'extrude',name:'rainure',sketchId:'s2',distance:-2.5,op:'cut',visible:true}];freshHard=true;occCkClear();markDirty();rebuild();};",
    "const micro=sh=>occListEdges(sh).filter(e=>e.len<0.001).length;",
    "const fond=sh=>{const E=occListEdges(sh);return E.find(e=>Math.hypot(e.mid[0]-6,e.mid[1],e.mid[2]-2)<1e-3);};",
    "const jobDe=e=>[{src:e.src,r:1,mid:e.mid.slice(),pts:e.pts,fn:null}];",
    "const vrai=skTangencesExactes;",
    // 1. sans la correction
    "skTangencesExactes=s=>s;construit();",
    "A(micro(occLive.shape)===4,'1 : sans correction, 4 micro-arêtes de 7 µm au bord de la rainure ('+micro(occLive.shape)+')');",
    "enterExactFilletMode(null,'chamfer');",
    "const pv=xPreviewShape(occLive.shape,jobDe(fond(occLive.shape)),true);",
    "A(pv&&!pv.shape&&(pv.warns||[]).join().indexOf('déchiré')>=0,'1 : l\\u2019aperçu ne montre plus le solide déchiré et dit pourquoi ('+((pv&&pv.warns)||[]).join()+')');",
    "exitFilletMode(true);",
    "doc.features.push({id:'C0',type:'xfillet',name:'c',chamfer:true,cmode:'eq',tangent:true,visible:true,edges:[{pos:[6,0,2],pos0:[6,0,2],r:1,len:1.2,anchor:null,name:'e',seed:1}]});",
    "freshHard=true;occCkClear();markDirty();rebuild();",
    "const c0=doc.features.find(f=>f.id==='C0');",
    "A(/déchiré/.test(c0._err||c0._adj||''),'1 : au rejeu, même verdict que l\\u2019aperçu ('+(c0._err||c0._adj||'aucune erreur')+')');",
    "skTangencesExactes=vrai;",
    // 2. la fonction
    "const x0=rainure.points.p3.x,c1=skTangencesExactes(rainure);",
    "A(c1!==rainure&&rainure.points.p3.x===x0,'2 : copie corrigée, esquisse enregistrée intacte');",
    "A(near(c1.points.p3.x,rainure.points.p7.x,1e-9)&&near(c1.points.p5.x,rainure.points.p7.x,1e-9),'2 : jonctions au pied de la perpendiculaire ('+c1.points.p3.x+')');",
    "A(near(c1.points.p2.x,rainure.points.p6.x,1e-9)&&c1.points.p3.y===rainure.points.p3.y,'2 : les deux bouts, et seulement le long de la ligne');",
    "A(skTangencesExactes(c1)===c1,'2 : rien à corriger = même objet (aucun coût, aucun changement pour les pièces saines)');",
    "A(skTangencesExactes(bloc)===bloc,'2 : esquisse sans arc inchangée');",
    "const nt={points:{a:{x:0,y:0.5},b:{x:5,y:0.5},c:{x:5.4,y:0},d:{x:5.4,y:-0.64}},entities:[{id:'l',t:'line',p1:'a',p2:'b'},{id:'k',t:'arc',pc:'c',pa:'d',pb:'b',r:0.64}]};",
    "A(skTangencesExactes(nt)===nt,'2 : jonction non tangente (coin réel) : ignorée');",
    // 2 bis. rainure qui s'arrête dans la matière (flanc à x=7) : aucune micro-arête, donc tangences laissées telles
    // quelles — appliquée partout, la correction décalait des contours alignés sur d'autres esquisses.
    "const xFlanc=bloc.points.b.x;bloc.points.b.x=7;bloc.points.c.x=7;construit();",
    "const fins=occListEdges(occLive.shape).filter(e=>e.pts.some(q=>Math.abs(q[0]-5.99999298)<1e-6));",
    "A(fins.length>0&&micro(occLive.shape)===0,'2 : découpe sans défaut : solide inchangé, jonction restée à x=5,999993 ('+fins.length+' arêtes)');",
    "bloc.points.b.x=xFlanc;bloc.points.c.x=xFlanc;",
    // 3. par la commande réelle
    "construit();const V0=vol(occLive.shape);",
    "A(micro(occLive.shape)===0,'3 : plus aucune micro-arête dans la découpe');",
    "enterExactFilletMode(null,'chamfer');filModeX.radius=1;",
    "let i0=-1;filModeX.edges.forEach((e,i)=>{if(Math.hypot(e.mid[0]-6,e.mid[1],e.mid[2]-2)<1e-3)i0=i;});",
    "A(i0>=0,'3 : l\\u2019arête du fond (1,2 mm) est proposée par la commande');",
    "const pv2=xPreviewShape(occLive.shape,jobDe(fond(occLive.shape)),true);",
    "A(pv2&&pv2.shape&&near(V0-vol(pv2.shape),0.6,1e-3),'3 : aperçu du chanfrein : 0,6 mm³ enlevés');try{pv2.shape.delete();}catch(e){}",
    "xSeedAdd(i0);xSelSync();applyExactFillet();",
    "const fait=doc.features.find(f=>f.type==='xfillet');",
    "A(fait&&!fait._err&&!fait._adj,'3 : Appliquer : aucune erreur, distance demandée respectée ('+((fait&&(fait._err||fait._adj))||'ok')+')');",
    "const FR=occFinalShape(null),sh=FR.perBody[0].shape,V1=vol(sh);",
    "A(near(V0-V1,0.6,1e-3),'3 : 0,6 mm³ enlevés au rejeu ('+(V0-V1).toFixed(4)+')');",
    "A(occCoqueValide(sh),'3 : solide final valide');",
    "A(fait.edges[0].r===1,'3 : D1 enregistré');",
    "occCleanup(FR,null);",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== V0.63.6 : tangences exactes, chanfrein au fond d’une rainure tangente au bord ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
