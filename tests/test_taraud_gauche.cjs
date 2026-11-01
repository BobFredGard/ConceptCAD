// V0.33.3 : filets à gauche (LH) — CAO (fonction Perçage, filet modélisé) → FAO (taraud à
// gauche, gamme) → G-code (Siemens CYCLE84 pas négatif, Fagor M04 le temps du G84).
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "occt=__realOcct;occtReady=true;",
    "const box={id:'skA',name:'Bloc',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:80,y:0},c:{x:80,y:40},d:{x:0,y:40}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false};",
    "const mk=(id,pts)=>{const P={},E=[];pts.forEach((q,i)=>{P['h'+i]={x:q[0],y:q[1]};E.push({id:'e'+i,t:'cpoint',p:'h'+i,hole:true});});",
    "  return {id:id,name:id,plane:'XY',origin:[0,0,30],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:P,entities:E,constraints:[],dims:[],seq:30,visible:false};};",
    "doc.sketches=[box,mk('sL',[[20,20]]),mk('sR',[[60,20]])];",
    "doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skA',distance:30,op:'add',visible:true}];",
    "doc.bodies=[];delete doc.activeBody;markDirty();rebuild();",
    "askHole('sL');const fL=doc.features[doc.features.length-1];fL.thread={size:'M8',p:1.25,len:12,lh:true};fL.d=6.75;fL.depth=16;",
    "askHole('sR');const fR=doc.features[doc.features.length-1];fR.thread={size:'M8',p:1.25,len:12};fR.d=6.75;fR.depth=16;",
    "markDirty();rebuild();faoHoleCache={shape:null,list:null};",
    "A(builtEngine==='exact'&&!doc.features.some(f=>f._err),'0 : pièce exacte (M8-LH et M8, cosmétiques)');",
    // ── CAO : libellés
    "A(holeThreadLabel(fL.thread)==='M8-LH'&&holeThreadLabel(fR.thread)==='M8','1a : libellé ISO 965 : M8-LH / M8');",
    "A(holeThreadLabel({size:'M8',p:1,lh:true})==='M8×1-LH'&&holeThreadLabel({size:'1/4-20 UNC',p:1.27,lh:true})==='1/4-20 UNC-LH','1b : pas fin M8×1-LH, ANSI 1/4-20 UNC-LH');",
    // filet cosmétique : hélice dessinée dans l'autre sens
    "const tp=holeThreadPaths(24,0);const hL=tp[0].helix,hR=tp[1].helix;",
    "const turn=h=>{const c=[h[0][0]-0,h[0][1]];let s=0;for(let i=1;i<h.length;i++){const a=h[i-1],b=h[i];s+=(a[0]-h[0][0])*(b[1]-h[0][1])-(a[1]-h[0][1])*(b[0]-h[0][0]);}return s;};",
    "const cw=(h,cx,cy)=>{let s=0;for(let i=1;i<h.length;i++){const a=Math.atan2(h[i-1][1]-cy,h[i-1][0]-cx),b=Math.atan2(h[i][1]-cy,h[i][0]-cx);let d=b-a;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;s+=d;}return s;};",
    "const wL=cw(hL,20,20),wR=cw(hR,60,20);",
    "A(wL*wR<0&&Math.abs(Math.abs(wL)-Math.abs(wR))<1e-6,'1c : filet cosmétique : hélice à gauche tournée en sens inverse ('+wL.toFixed(2)+' / '+wR.toFixed(2)+' rad)');",
    // ── FAO : gamme, taraud à gauche
    "const S=faoSetup();S.ops=[];S.name='LH';S.stock={x0:0,y0:0,z0:0,x1:80,y1:40,z1:30};",
    "const op=faoOpDefaults('drill');S.ops.push(op);",
    "faoHoleGroups(faoHolesDetect()).forEach(g=>op.holeSel.push({d:g.d,z:g.z}));faoDrillResolve(op);",
    "A(op.holes.length===2&&op.holes.filter(h=>h.thread&&h.thread.lh).length===1,'2a : FAO : le trou M8-LH porte son sens (fonction Perçage)');",
    "faoDrillGamme(S,op);",
    "const taps=S.ops.filter(o=>o.cycle==='tap').map(o=>({o:o,t:faoToolById(S,o.toolId)}));",
    "out.log.push('gamme : '+S.ops.map(o=>o.cycle+'('+o.holes.length+') '+faoToolById(S,o.toolId).name).join(' → '));",
    "A(taps.length===2&&taps.some(x=>x.t.lh&&x.t.name==='Taraud M8-LH'&&x.o.holes.length===1&&x.o.holes[0].x===20)&&taps.some(x=>!x.t.lh&&x.t.name==='Taraud M8'&&x.o.holes[0].x===60),'2b : deux taraudages : taraud M8-LH (créé) sur le trou à gauche, M8 sur l\\u2019autre');",
    "A(S.ops.filter(o=>o.cycle==='drill'||o.cycle==='peck').length===1,'2c : un seul perçage Ø6,75 (le sens ne change pas l\\u2019avant-trou)');",
    // ── G-code
    "const g8=faoPost(S,'siemens630').code,fg=faoPost(S,'fagor8065').code;",
    "A(/CYCLE84\\([^)]*, 3, , -1\\.250, 0, /.test(g8)&&/CYCLE84\\([^)]*, 3, , 1\\.250, 0, /.test(g8),'3a : Siemens : CYCLE84 pas −1,25 (à gauche) et +1,25 (à droite)');",
    "const lines=fg.split('\\n'),iM4=lines.findIndex(l=>/ M04\\b/.test(l)||/^N\\d+ M04$/.test(l.trim())),iG84=lines.findIndex((l,i)=>i>iM4&&/G84/.test(l)),iG80=lines.findIndex((l,i)=>i>iG84&&/G80/.test(l)),iM3=lines.findIndex((l,i)=>i>iG80&&/M03\\b/.test(l));",
    "A(iM4>=0&&iG84>iM4&&iG80>iG84&&iM3===iG80+1,'3b : Fagor : M04 → G84 → G80 → M03 pour le taraud à gauche');",
    "A((fg.match(/M04\\b/g)||[]).length===1,'3c : Fagor : le taraud à droite reste en M03 (un seul M04)');",
    // ── STEP : sens choisi dans la fiche
    "const t2=faoOpDefaults('drill');t2.cycle='tap';S.ops.push(t2);",
    "const kR=(6.75).toFixed(2)+'@'+(30).toFixed(2);S.holeInfo={};S.holeInfo[kR]={thread:{size:'M10',p:1.5,lh:true}};",
    "const H0=faoHolesDetect().find(h=>h.x===60);delete H0.feat;",
    "const thS=faoHoleThread(H0,S);",
    "A(thS&&thS.lh&&thS.src==='STEP','4a : STEP « Taraudé M10 » + « À gauche » → filet à gauche');",
    // ── CAO : filet MODÉLISÉ à gauche = symétrique du filet à droite (plan axe + départ U)
    "fL.thread.model=true;fL.thread.clear=0;fR.thread.model=true;fR.thread.clear=0;markDirty();rebuild();",
    "A(builtEngine==='exact'&&!doc.features.some(f=>f._err),'5a : rejeu exact des filets modélisés M8-LH et M8');",
    "const cl=new occt.BRepClass3d_SolidClassifier_2(occLive.shape),OUT=occt.TopAbs_State.TopAbs_OUT;",
    "const st=(x,y,z)=>{const p=new occt.gp_Pnt_3(x,y,z);cl.Perform(p,1e-6);const s=cl.State();p.delete();return s===OUT;};",
    // départ des hélices (occHoleThreadVoid) : U = U0·cos 0,65 + V0·sin 0,65, U0 = (0,−1,0), V0 = (−1,0,0) pour D = −Z
    "const U=[-Math.sin(0.65),-Math.cos(0.65)];",
    "let same=0,mir=0,n=0;for(let k=0;k<72;k++){const a=k/72*Math.PI*2,r=3.7,px=r*Math.cos(a),py=r*Math.sin(a),d=2*(px*U[0]+py*U[1]),mx=d*U[0]-px,my=d*U[1]-py;",
    "  for(let z=17;z<26;z+=0.37){n++;const sL=st(20+px,20+py,z);if(sL===st(60+px,20+py,z))same++;if(sL===st(60+mx,20+my,z))mir++;}}",
    "A(mir/n>0.98&&same/n<0.8,'5b : M8-LH = miroir du M8 ('+(100*mir/n).toFixed(1)+' % des points), différent du M8 non réfléchi ('+(100*same/n).toFixed(1)+' %)');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== V0.33.3 : filets à gauche (CAO → FAO → G-code) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
