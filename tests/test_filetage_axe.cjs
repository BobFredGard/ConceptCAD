// V0.35.0 : FILETAGE d'un axe (76-filetage). Demande : « une fonction filetage pour les
// axes, pour faire des vis, appliquée au standard de visserie de l'Assemblage » ; spirales
// comme les trous taraudés, cachées avec leur corps.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(m){window.__al=m;};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "occt=__realOcct;occtReady=true;",
    // bloc 30 × 30 × 10, axe Ø8 de 20 mm dessus (épaulement en z = 10, bout libre en z = 30)
    "const box={id:'skB',name:'Bloc',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:30,y:0},c:{x:30,y:30},d:{x:0,y:30}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false};",
    "const ax={id:'skA',name:'Axe',plane:'XY',origin:[0,0,10],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{c:{x:15,y:15}},entities:[{id:'ci',t:'circle',pc:'c',r:4}],constraints:[],dims:[],seq:5,visible:false};",
    "doc.sketches=[box,ax];",
    "doc.features=[{id:'E',type:'extrude',name:'Bloc',sketchId:'skB',distance:10,op:'add',visible:true},{id:'E2',type:'extrude',name:'Axe',sketchId:'skA',distance:20,op:'add',visible:true}];",
    "doc.bodies=[];delete doc.activeBody;markDirty();rebuild();",
    "const v0=occCoqueVolume(occLive.shape);",
    "const T={id:'T1',type:'xthread',name:'',cyl:{c:[15,15,0],u:[0,0,1],r:4,p:[19,15,20]},size:'M8',p:1.25,lh:false,model:true,clear:0,lenMode:'full',len:10,flip:false,visible:true};",
    "T.name=threadName(T);addFeature(T);markDirty();rebuild();",
    "A(builtEngine==='exact'&&!T._err,'1 : rejeu exact du filetage modélisé sans erreur '+(T._err||''));",
    "const g=threadGeo.get('T1');",
    "A(g&&g.free&&Math.abs(g.o[2]-30)<1e-6&&g.d[2]<0,'2 : départ au bout LIBRE (z = 30), vers l’épaulement');",
    "const v1=occCoqueVolume(occLive.shape);out.log.push('volume '+v0.toFixed(1)+' → '+v1.toFixed(1)+' mm3');",
    "A(v1<v0-150&&v1>v0-450,'3 : matière retirée par le filet plausible ('+(v0-v1).toFixed(1)+' mm3)');",
    "{const ex=new occt.TopExp_Explorer_2(occLive.shape,occt.TopAbs_ShapeEnum.TopAbs_SOLID,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);let n=0;for(;ex.More();ex.Next())n++;A(n===1,'4 : un seul solide ('+n+')');}",
    "const cl=occClassifier(occLive.shape); // V0.44.1 : parité de rayon (20), ~40× plus rapide sous OCCT 8",
    "const OUT=occt.TopAbs_State.TopAbs_OUT;",
    "const st=(x,y,z)=>{const p=new occt.gp_Pnt_3(x,y,z);cl.Perform(p,1e-6);const s=cl.State();p.delete();return s;};",
    "const fracOut=(r,z)=>{let n=0,N=144;for(let k=0;k<N;k++){const a=k/N*Math.PI*2;if(st(15+r*Math.cos(a),15+r*Math.sin(a),z)===OUT)n++;}return n/N;};",
    "const th=threadDims('M8',1.25,0,4),rMid=(th.rC+th.rR)/2;",
    "const q=fracOut(rMid,20);",
    "A(q>0.25&&q<0.75,'5a : à mi-hauteur, '+Math.round(q*100)+' % de la circonférence à rMid usinée (gorge hélicoïdale)');",
    "A(fracOut(th.rR-0.1,20)<0.02,'5b : sous le Ø mineur, matière intacte');",
    "A(fracOut(3.995,20)>0.98,'5c : peau du cylindre retirée (crête 0,01 sous le Ø)');",
    "A(fracOut(rMid,29.5)>0.25,'5d : le filet débouche au bout libre');",
    "A(fracOut(5,9.9)<0.02&&fracOut(4.3,9.95)<0.02,'5e : épaulement intact (le filet s’arrête avant)');",
    // coupe axiale : rayon où commence le vide, flancs à 60°
    "{const rad=z=>{let a=3,b=4.2;for(let k=0;k<14;k++){const m=(a+b)/2;if(st(15+m,15,z)===OUT)b=m;else a=m;}return (a+b)/2;};",
    " const rs=[];for(let z=22;z>19;z-=0.02)rs.push(rad(z));",
    " const mx=Math.max(...rs),mn=Math.min(...rs);",
    " A(Math.abs(mx-3.99)<0.01,'6a : crête au Ø majeur (R'+mx.toFixed(3)+')');",
    " A(Math.abs(mn-th.rR)<0.01,'6b : racine au Ø d1 (R'+mn.toFixed(3)+' / '+th.rR.toFixed(3)+')');",
    " let sl=[];for(let i=1;i<rs.length;i++){const d=Math.abs(rs[i]-rs[i-1]);if(d>0.015&&d<0.08)sl.push(d/0.02);}",
    " const sm=sl.reduce((a,b)=>a+b,0)/Math.max(1,sl.length);",
    " A(sl.length>4&&Math.abs(sm-Math.sqrt(3))<0.2,'6c : flancs à 60° (pente '+sm.toFixed(2)+')');}",
    "try{cl.delete();}catch(e){}",
    // filet modélisé : aucune spirale superposée ; cosmétique : spirale comme un taraudage
    "A(!holeThreadPaths().length,'7a : filet modélisé → pas de spirale cosmétique');",
    "T.model=false;T.lenMode='len';T.len=12;T.name=threadName(T);markDirty();rebuild();",
    "A(Math.abs(occCoqueVolume(occLive.shape)-v0)<0.5,'7b : filet cosmétique → axe lisse');",
    "const P=holeThreadPaths();",
    "A(P.length===1&&P[0].bodyId&&P[0].helix.length>20,'7c : spirale cosmétique du filetage, rattachée à son corps');",
    "{const zs=P[0].helix.map(p=>p[2]);A(Math.abs(Math.max(...zs)-30)<1e-6&&Math.abs(Math.min(...zs)-18)<1e-6,'7d : spirale sur les 12 mm filetés depuis le bout libre');}",
    // groupe affiché reconstitué comme dans test_filet_visibilite (THREE réduit sous Node)
    "const ov={parent:scene,children:[]};P.forEach(t=>{for(let k=0;k<2;k++)ov.children.push({visible:true,userData:{bodyId:t.bodyId}});});holeThreadGrp=ov;holeThreadVisSync();",
    "A(ov.children.every(o=>o.visible===true),'7e : corps visible → spirale visible');",
    "doc.bodyVis=doc.bodyVis||{};doc.bodyVis[P[0].bodyId]=false;holeThreadVisSync();",
    "A(ov.children.every(o=>o.visible===false),'7f : corps caché → spirale cachée');",
    "delete doc.bodyVis[P[0].bodyId];holeThreadVisSync();",
    // à gauche : la spirale tourne dans l'autre sens
    "T.lh=true;T.name=threadName(T);markDirty();rebuild();{const h=holeThreadPaths()[0].helix,ang=p=>Math.atan2(p[1]-15,p[0]-15);",
    " const da=Math.atan2(Math.sin(ang(h[1])-ang(h[0])),Math.cos(ang(h[1])-ang(h[0])));",
    " A(/-LH/.test(T.name)&&da*threadGeo.get('T1').d[2]<0,'8 : filet à gauche — désignation -LH, spirale en sens inverse');}",
    // persistance
    "const sv=JSON.parse(serialise(false)).features.find(x=>x.id==='T1');",
    "A(sv&&sv.type==='xthread'&&sv.size==='M8'&&sv.cyl&&sv.cyl.r===4,'9 : filetage persisté dans le document');",
    // l'axe change de longueur : le filetage suit (référence par l'axe)
    "doc.features.find(f=>f.id==='E2').distance=30;T.lenMode='full';T.lh=false;markDirty();rebuild();",
    "A(!T._err&&Math.abs(threadGeo.get('T1').o[2]-40)<1e-6&&Math.abs(T._thLen-30)<1e-6,'10 : axe rallongé → filetage suivi (départ z = 40, 30 mm)');",
    // visserie normalisée (48) : la tige des vis porte le filetage de la norme
    "const sp=stdSpec('iso',{type:'chc',size:'M6',pitch:'1',len:'40',fil:'cos'}),sd=stdDoc(sp);",
    "const ft=sd.features.find(f=>f.type==='xthread');",
    "A(ft&&ft.size==='M6'&&ft.lenMode==='len'&&Math.abs(ft.len-24)<1e-9,'11a : CHC M6×40 → filetage M6 sur b = 2d + 12 = 24 mm');",
    "A(stdDoc(stdSpec('iso',{type:'chc',size:'M6',pitch:'1',len:'16',fil:'cos'})).features.find(f=>f.type==='xthread').lenMode==='full','11b : CHC M6×16 → filetée jusqu’à la tête');",
    "A(stdSpec('iso',{type:'chc',size:'M6',pitch:'1',len:'40',fil:'mod'}).key!==sp.key,'11c : filet modélisé = autre pièce (clé distincte)');",
    "A(stdDoc(stdSpec('ansi',{type:'chc',size:'1/4',thr:'UNC',len:'1',fil:'cos'})).features.some(f=>f.type==='xthread'&&f.size==='1/4-20 UNC'),'11d : SHCS 1/4-20 UNC → filetage UNC');",
    "A(stdDoc(stdSpec('plug',{type:'din908',size:'G 1/4'})).features.some(f=>f.type==='xthread'&&f.size==='G1/4'&&!f.model),'11e : bouchon DIN 908 → filetage G cosmétique');",
    "doc.sketches=sd.sketches;doc.features=sd.features;doc.bodies=sd.bodies;doc.activeBody=sd.activeBody;threadCk.clear();markDirty();rebuild();",
    "{const g2=threadGeo.get(ft.id);A(!ft._err&&g2&&g2.free&&Math.abs(g2.o[2]-(-40+Math.min(1,0.9)))<1e-3&&g2.d[2]>0,'11f : départ du filet à la pointe de la vis, vers la tête ('+(g2&&g2.o[2])+')');",
    " const P3=holeThreadPaths();A(P3.length===1&&Math.abs(Math.max(...P3[0].helix.map(p=>p[2]))-(-39.1+24))<1e-3,'11g : spirale cosmétique sur 24 mm');}",
    "const vC=occCoqueVolume(occLive.shape);ft.model=true;markDirty();rebuild();",
    "{const vM=occCoqueVolume(occLive.shape);A(!ft._err&&vM<vC-100,'11h : vis à filet modélisé (matière retirée '+(vC-vM).toFixed(1)+' mm3)');",
    " const cl2=occClassifier(occLive.shape),O2=occt.TopAbs_State.TopAbs_OUT;let n=0;",
    " for(let k=0;k<72;k++){const a=k/72*Math.PI*2,q=new occt.gp_Pnt_3(2.8*Math.cos(a),2.8*Math.sin(a),-1);cl2.Perform(q,1e-6);if(cl2.State()===O2)n++;q.delete();}",
    " A(n===0,'11i : sous la tête (au-delà de b), tige intacte');try{cl2.delete();}catch(e){}}",
    // assemblage : spirales capturées avec l'occurrence (dessinées avec elle, cachées avec elle)
    "docResetEmpty();doc.name='Banc';doc.sketches=[box];doc.features=[{id:'E',type:'extrude',name:'Bloc',sketchId:'skB',distance:10,op:'add',visible:true}];",
    "ensureBodies();markDirty();rebuild();asmEnsure();",
    "const spA=stdSpec('iso',{type:'chc',size:'M6',pitch:'1',len:'40',fil:'cos'});const rA=stdAddOcc(spA,asm.active,null);asmBuildSnapshots();",
    "{const cS=asm.comps.find(c=>c.doc&&c.doc.std&&c.doc.std.key===spA.key);",
    " A(cS&&cS._snap&&cS._snap.thr&&cS._snap.thr.length===1&&cS._snap.thr[0].helix.length>20,'12a : instantané de la vis : sa spirale de filet');",
    " const pk=asmCachePack(cS._snap),un=pk&&asmCacheUnpack(pk,'');",
    " A(un&&un.thr&&un.thr.length===1,'12b : spirale gardée par le cache des instantanés');",
    " A(typeof asmThrLines==='function'&&!!asmThrLines(cS._snap),'12c : traits de la spirale construits pour l’occurrence');}",
    "return out;"
  ].join('\n');
  try{
    const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
    console.log('=== V0.35.0 : filetage d’un axe ===');
    (o.log||[]).forEach(m=>console.log('  ✓ '+m));
    if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
    console.log('\n*** TOUT PASSE ***');
  }catch(e){
    console.log('FATAL',String((e&&e.stack)||e).slice(0,1600));process.exit(1);
  }
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
