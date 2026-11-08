// V0.70.2 : congé / chanfrein SANS TANGENCE (case « tangentes » décochée) sur une arête droite de coin intérieur (Barquette 2 :
// fond plat d'une rainure bordé de deux arcs tangents). Le noyau suivait toute la chaîne tangente ; ici la
// matière n'est ajoutée que dans le coin de l'arête et s'arrête sur les faces voisines (pas de face plane
// au bout) — congés créés depuis V0.70.2 seulement (drapeau droit). Chaîne tangente cochée : directions exactes aux bouts, une arête en biais n'entre plus.
// Pièce : plaque 60 × 40 × 10 creusée d'une poche oblongue (2 droites + 2 demi-cercles R6) de 5 mm.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "const rect={id:'s1',name:'s1',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:-30,y:-20},b:{x:30,y:-20},c:{x:30,y:20},d:{x:-30,y:20}},entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:9,visible:false};",
    "const ob={id:'s2',name:'s2',plane:'XY',origin:[0,0,10],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{p1:{x:-10,y:6},p2:{x:10,y:6},p3:{x:10,y:-6},p4:{x:-10,y:-6},p5:{x:-10,y:0},p6:{x:10,y:0}},",
    "  entities:[{id:'e1',t:'line',p1:'p1',p2:'p2'},{id:'e2',t:'line',p1:'p4',p2:'p3'},{id:'e3',t:'arc',pc:'p5',pa:'p1',pb:'p4',r:6},{id:'e4',t:'arc',pc:'p6',pa:'p3',pb:'p2',r:6}],constraints:[],dims:[],seq:9,visible:false};",
    "doc.sketches=[rect,ob];doc.bodies=[];doc.features=[{id:'F1',type:'extrude',name:'plaque',sketchId:'s1',distance:10,op:'add',visible:true},{id:'F2',type:'extrude',name:'poche',sketchId:'s2',distance:-5,op:'cut',visible:true}];",
    "freshHard=true;occCkClear();markDirty();rebuild();",
    "const base=occLive.shape,E=occListEdges(base);",
    "const vol=sh=>occCoqueVolume(sh),nees=(a,b)=>{const k=new Set(occFaceKeys(a));return occFaceKeys(b).filter(x=>x==='?'||!k.has(x));};",
    "const e=E.find(x=>Math.hypot(x.mid[0],x.mid[1]-6,x.mid[2]-5)<1e-6);", // fond de la poche, côté y=+6 (coin intérieur)
    "A(!!e,'1 : arête de coin intérieur trouvée');",
    "let w=[];const f=occFilletRun(base,[{src:e.src,r:2,mid:e.mid}],w,false,{single:'droit'});",
    "const nf=f?nees(base,f):[];",
    "A(f&&occCoqueValide(f),'2 : congé R2 sur l\\u2019arête seule : solide valide');",
    "A(nf.length===1&&/^C/.test(nf[0]),'3 : une seule face neuve, cylindrique — pas de face plane au bout ('+JSON.stringify(nf)+')');",
    // matière ajoutée : section (r² − πr²/4) sur la longueur droite 20, plus les bouts qui suivent les arcs
    "const dv=f?vol(f)-vol(base):0,sec=4-Math.PI;",
    "A(dv>sec*20&&dv<sec*20+sec*2*6,'4 : matière ajoutée dans le coin seulement ('+dv.toFixed(3)+' mm³)');",
    "A(!w.some(x=>/cha\\u00eene tangente/.test(x)),'5 : pas de repli sur la chaîne tangente du noyau');",
    "const vive=sh=>occListEdges(sh).some(x=>Math.hypot(x.mid[0],x.mid[1]+6,x.mid[2]-5)<1e-6);", // l'autre droite reste vive
    "A(f&&vive(f),'6 : l\\u2019arête d\\u2019en face reste vive');",
    "w=[];const c=occFilletRun(base,[{src:e.src,r:1.5,mid:e.mid}],w,true,{single:'droit'});",
    "const nc=c?nees(base,c):[];",
    "A(c&&occCoqueValide(c)&&nc.length===1&&/^P/.test(nc[0])&&vol(c)>vol(base),'7 : chanfrein sur l\\u2019arête seule : une face plane neuve ('+JSON.stringify(nc)+')');",
    // chaîne tangente (case cochée) : le fond de la poche = 4 arêtes, pas plus
    "const S=occSharpEdges(base),i0=S.findIndex(x=>Math.hypot(x.mid[0],x.mid[1]-6,x.mid[2]-5)<1e-6);",
    "const ch=xTangentChainOf(S,i0);",
    "A(ch.length===4&&ch.every(i=>Math.abs(S[i].mid[2]-5)<1e-6),'8 : chaîne tangente = le fond de la poche (4 arêtes, '+ch.length+')');",
    "A(S.every(x=>Array.isArray(x.ta)&&x.ta.length===2),'9 : directions exactes aux bouts sur chaque arête');",
    // V0.70.3 : plusieurs arêtes d'un coup — morceaux soudés en une fois, chaque arête retrouvée
    "const e2=E.find(x=>Math.hypot(x.mid[0],x.mid[1]+6,x.mid[2]-5)<1e-6);",
    "w=[];const d2=occFilletRun(base,[{src:e.src,r:2,mid:e.mid},{src:e2.src,r:2,mid:e2.mid}],w,false,{single:'droit'});",
    "const n2=d2?nees(base,d2):[];",
    "A(d2&&occCoqueValide(d2)&&n2.length===2&&n2.every(k=>/^C/.test(k))&&Math.abs(vol(d2)-vol(base)-2*dv)<1e-3&&!w.length,'12 : deux arêtes d\\u2019un coup : 2 faces neuves, deux fois la matière d\\u2019une ('+JSON.stringify(n2)+', '+w.join('|')+')');",
    // rejeu dans le document : congé créé depuis V0.70.2 (droit) = arête seule ; congé d'un ancien
    // document (sans le drapeau) = chaîne du noyau, comme avant — sa forme ne change pas
    "const v0=vol(base),pose=c=>{doc.features=doc.features.filter(x=>x.type!=='xfillet');doc.features.push(Object.assign({id:'X',type:'xfillet',name:'C',visible:true,tangent:false,edges:[{pos:e.mid.slice(),pos0:e.mid.slice(),r:2,len:e.len,seed:1}]},c?{droit:true}:{}));freshHard=true;occCkClear();markDirty();rebuild();return vol(occLive.shape)-v0;};",
    "const dNeuf=pose(true),dAncien=pose(false);",
    "A(Math.abs(dNeuf-dv)<1e-3,'10 : rejeu d\u2019un congé V0.70.2 : arête seule ('+dNeuf.toFixed(3)+' mm³)');",
    "A(dAncien>dNeuf+1,'11 : ancien document : le congé suit la chaîne du noyau, comme avant ('+dAncien.toFixed(3)+' mm³)');",
    "JSON.stringify(out);"
  ].join('\n');
  const res=JSON.parse(vm.runInContext(R,ctx));
  res.log.forEach(m=>console.log('  ✓ '+m));
  res.fails.forEach(m=>console.log('  ✗ '+m));
  if(res.fails.length){console.log('\n*** '+res.fails.length+' ÉCHEC(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.error(e);process.exit(1);});
