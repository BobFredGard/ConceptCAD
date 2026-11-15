// V0.99.9 : FAO — gamme automatique des trous alésés (4 cas de la fonction Perçage), finition
// alésoir ou fraise, outil de pointage choisi avant la gamme (ou aucun), fraisure faite après le
// perçage, double perçage : petit trou débouchant laissé pour l'autre côté.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "occt=__realOcct;occtReady=true;",
    "const box={id:'skA',name:'Bloc',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:120,y:0},c:{x:120,y:60},d:{x:0,y:60}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false};",
    "const mk=(id,pts)=>{const P={},E=[];pts.forEach((q,i)=>{P['h'+i]={x:q[0],y:q[1]};E.push({id:'e'+i,t:'cpoint',p:'h'+i,hole:true});});",
    "  return {id:id,name:id,plane:'XY',origin:[0,0,40],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:P,entities:E,constraints:[],dims:[],seq:30,visible:false};};",
    "doc.sketches=[box,mk('s1',[[15,15]]),mk('s2',[[40,15]]),mk('s3',[[65,15]]),mk('s4',[[90,15]]),mk('sK',[[15,45]]),mk('sS',[[40,45]]),mk('sB',[[65,45]])];",
    "doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skA',distance:40,op:'add',visible:true}];",
    "doc.bodies=[];delete doc.activeBody;markDirty();rebuild();",
    "const ream=(sk,o)=>{askHole(sk);const f=doc.features[doc.features.length-1];Object.assign(f,{kind:'ream',reamTol:'H7'},o);f.d=holeReamDrill(f);return f;};",
    "ream('s1',{pilot:'none',reamD:8,reamH:12,reamOff:0.5});",          // alésage fond plat seul
    "ream('s2',{pilot:'blind',reamD:10,reamH:8,reamOff:0.5,depth:25});", // + perçage Ø9,5 borgne
    "ream('s3',{pilot:'through',reamD:12,reamH:10,reamOff:null,d:6});",  // + perçage Ø6 débouchant (loin du Ø)
    "ream('s4',{pilot:'open',reamD:6,reamOff:0.5});",                  // alésage débouchant
    "askHole('sK');Object.assign(doc.features[doc.features.length-1],{kind:'csink',d:6.6,csD:13,csA:90,end:'through'});",
    "askHole('sS');Object.assign(doc.features[doc.features.length-1],{kind:'step',d:1.5,stD:8,stH:5,end:'through'});",
    "askHole('sB');Object.assign(doc.features[doc.features.length-1],{kind:'step',d:3,stD:8,stH:5,end:'blind',depth:15});",
    "markDirty();rebuild();faoHoleCache={shape:null,list:null};",
    "A(builtEngine==='exact'&&!doc.features.some(f=>f._err),'0 : pièce exacte (4 alésés, fraisé, 2 doubles perçages)');",
    "const S=faoSetup();S.ops=[];S.tools=[];S.name='ALE';S.stock={x0:0,y0:0,z0:0,x1:120,y1:60,z1:40};",
    "const all=faoHolesDetect();",
    "const G=faoHoleGroups(all).map(g=>({d:+g.d.toFixed(3),z:+g.z.toFixed(3)}));",
    "out.log.push('trous : '+faoHoleGroups(all).map(g=>'Ø'+g.d+'@'+g.z+(g.holes[0].feat?' '+g.holes[0].feat.role:'')).join(', '));",
    "const gamme=(cfg,pick)=>{S.ops=[];S.drillCfg=cfg;const op=faoOpDefaults('drill');op.src='model';op.holeSel=(pick?G.filter(pick):G).slice();S.ops.push(op);return faoDrillGamme(S,op,true)||[];};",
    "const desc=()=>S.ops.map(o=>faoOpShortLabel(o)+' T'+faoToolById(S,o.toolId).num+' '+faoToolById(S,o.toolId).name+' ['+faoToolById(S,o.toolId).kind+']').join(' → ');",
    "const has=(d,pred)=>S.ops.filter(o=>(o.holes||[]).some(h=>Math.abs(h.d-d)<0.02)&&pred(o));",
    "const T=o=>faoToolById(S,o.toolId);",
    // ── 1. alésoir, pointage automatique
    "let made=gamme({});out.log.push('gamme alésoir : '+desc());",
    "A(S.ops[0].cycle==='spot'&&S.ops[0].gRole==='pointage','1a : pointage en tête');",
    "A(has(8,o=>o.cycle==='ream'&&T(o).kind==='ream'&&Math.abs(T(o).d-8)<0.011&&/H7/.test(T(o).name)).length===1,'1b : fond plat Ø8 : alésoir Ø8 H7');",
    "A(has(8,o=>o.gRole==='pretrou'&&o.depthMode==='tip'&&Math.abs(T(o).d-7.5)<0.011).length===1,'1c : … pré-trou Ø7,5 (écart de la fonction), pointe au fond (rien sous le fond plat)');",
    "A(has(10,o=>o.gRole==='pretrou').length===0&&has(9.5,o=>o.cycle==='drill'||o.cycle==='peck').length===1&&has(10,o=>o.cycle==='ream').length===1,'1d : + perçage Ø9,5 : le perçage de la fonction sert de pré-trou, puis alésoir Ø10');",
    "A(has(12,o=>o.gRole==='pretrou'&&Math.abs(T(o).d-11.7)<0.011).length===1&&has(6,o=>(o.cycle==='drill'||o.cycle==='peck')&&!o.gRole).length===1,'1e : + perçage Ø6 débouchant (loin du Ø12) : Ø6, puis pré-trou Ø11,7 (surépaisseur 0,3), puis alésoir');",
    "A(has(6,o=>o.gRole==='pretrou'&&o.depthMode==='full'&&Math.abs(T(o).d-5.5)<0.011).length===1&&has(6,o=>o.cycle==='ream').length===1,'1f : alésage débouchant Ø6 : pré-trou Ø5,5 débouchant puis alésoir');",
    "const iR=S.ops.findIndex(o=>o.cycle==='ream'),iD=S.ops.map(o=>o.cycle==='drill'||o.cycle==='peck').lastIndexOf(true);",
    "A(iR>iD,'1g : alésages après tous les perçages');",
    "const rO=S.ops.find(o=>o.cycle==='ream'&&o.holes.some(h=>Math.abs(h.d-6)<0.02));",
    "const mv=faoOpMoves(rO,S),cut=mv.filter(m=>!m.r);",
    "A(cut.length>=2&&Math.min.apply(null,cut.map(m=>m.z))<0,'1h : alésage débouchant : l’alésoir sort sous la pièce');",
    "A(mv.some(m=>!m.r&&m.tapOut),'1i : alésoir : sortie en avance (pas de rapide dans l’alésage)');",
    "const g8=faoPost(S,'siemens630').code,fg=faoPost(S,'fagor8065').code;",
    "A(/CYCLE85\\(/.test(g8),'1j : Siemens : CYCLE85');",
    "A(/G98 G85 /.test(fg),'1k : Fagor : G85');",
    // ── 2. fraisure : après le perçage, foret à pointer Ø ≥ Ø13 + 1, pas dans le pointage
    "const fr=S.ops.find(o=>o.gRole==='fraisure');",
    "A(fr&&fr.cycle==='spot'&&T(fr).d>=14&&Math.abs(faoToolAngle(T(fr))-90)<0.6,'2a : fraisure Ø13 : foret à pointer 90° Ø'+(fr&&T(fr).d));",
    "A(fr&&S.ops.indexOf(fr)>S.ops.findIndex(o=>(o.cycle==='drill'||o.cycle==='peck')&&o.holes.some(h=>Math.abs(h.d-6.6)<0.02)),'2b : fraisure après le perçage Ø6,6');",
    "const sp=S.ops[0],hK=sp.holes.find(h=>Math.abs(h.d-6.6)<0.02),zK=faoDrillDepthOf(sp,T(sp),hK);",
    "A(hK&&40-zK<3.6,'2c : le pointage ne fait pas la fraisure ('+(40-zK).toFixed(2)+' mm de profondeur)');",
    "const zF=faoDrillDepthOf(fr,T(fr),fr.holes[0]);",
    "A(Math.abs((40-zF)-6.5)<0.05,'2d : fraisure Ø13 à 90° : 6,5 mm de profondeur');",
    "gamme({csk:'chamfer'});const fc=S.ops.find(o=>o.gRole==='fraisure'),tc=fc&&T(fc);",
    "A(tc&&tc.kind==='chamfer'&&tc.d>=14&&Math.abs(faoToolAngle(tc)-90)<0.6,'2e : fraisure à la fraise à chanfreiner : '+(tc&&tc.name));",
    "A(fc&&Math.abs((40-faoDrillDepthOf(fc,tc,fc.holes[0]))-6.25)<0.05,'2f : … méplat Ø0,5 compté : 6,25 mm de profondeur');",
    "gamme({});",
    // ── 3. double perçage : petit trou débouchant laissé pour l'autre côté, petit borgne gardé
    "A(!S.ops.some(o=>(o.holes||[]).some(h=>Math.abs(h.d-1.5)<0.02)),'3a : Ø1,5 débouchant sous l’avant-trou Ø8 : pas fait de ce côté');",
    "A(S.ops.some(o=>(o.cycle==='drill'||o.cycle==='peck')&&o.holes.some(h=>Math.abs(h.d-3)<0.02)),'3b : Ø3 borgne sous l’avant-trou : gardé');",
    "A(!sp.holes.some(h=>Math.abs(h.d-3)<0.02),'3c : … sans pointage au fond de l’avant-trou');",
    "A(S.ops.some(o=>(o.cycle==='drill'||o.cycle==='peck')&&o.holes.length===2&&o.holes.every(h=>Math.abs(h.d-8)<0.02)),'3d : les deux avant-trous Ø8 percés');",
    "A(S.ops.filter(o=>o.cycle==='ream').every(o=>o.holes.every(h=>h.ream)),'3e : les alésoirs ne passent que dans les alésages');",
    // pilote non sélectionné : repris d'office (l'alésage seul est cliqué)
    "gamme({},g=>Math.abs(g.d-10)<0.02);out.log.push('alésage Ø10 seul : '+desc());",
    "A(has(9.5,o=>o.cycle==='drill'||o.cycle==='peck').length===1&&has(10,o=>o.cycle==='ream').length===1&&!has(10,o=>o.gRole==='pretrou').length,'3f : alésage Ø10 seul choisi → son perçage Ø9,5 repris, puis alésoir');",
    // ── 4. finition à la fraise
    "gamme({ream:'mill'});out.log.push('gamme fraise : '+desc());",
    "A(!S.ops.some(o=>o.cycle==='ream')&&has(10,o=>o.cycle==='helix'&&o.gRole==='alesage'&&T(o).kind==='flat').length===1,'4a : finition fraise : Ø10 en hélicoïdal, fraise cylindrique');",
    "A(has(8,o=>o.gRole==='pretrou').length===1,'4b : pré-trou gardé avant la fraise');",
    // ── 5. pointage choisi avant la gamme
    "gamme({spot:'none'});A(!S.ops.some(o=>o.cycle==='spot'&&o.gRole==='pointage')&&S.ops.some(o=>o.gRole==='fraisure'),'5a : sans pointage : aucun pointage, la fraisure reste');",
    "gamme({spot:'center'});A(T(S.ops[0]).kind==='center','5b : foret à centrer imposé : '+T(S.ops[0]).name);",
    "const own={id:'Tx',num:9,name:'Pointe maison D6',kind:'spot',d:6,flutes:2,vc:60,ang:120};S.tools.push(own);",
    "gamme({spot:'Tx'});A(S.ops[0].toolId==='Tx','5c : outil de la bibliothèque choisi : T9 Pointe maison');",
    "gamme({spot:'Tzz'});A(S.ops[0].cycle==='spot'&&T(S.ops[0]),'5d : outil retiré de la bibliothèque : règle automatique');",
    // ── 6. STEP : « Alésé H7 » choisi dans la liste
    "S.holeInfo={};S.holeInfo[(6).toFixed(2)+'@'+(40).toFixed(2)]={ream:{tol:'H7'}};",
    "A(faoHoleReamInfo({d:6,ztop:40},S).tol==='H7','6a : trou d’un STEP déclaré alésé H7');",
    // ── 7. pièce sans fonction Perçage (comme un STEP) : fenêtre « Nature des trous » avant la gamme
    "const hA=holeAxis;holeAxis=function(){throw 0;};faoHoleCache={shape:null,list:null};faoHoleMemo.clear();S.holeInfo={};",
    "let asked=null;const dA=faoDrillGammeDlg;",
    "try{",
    "  faoDrillGammeDlg=function(st,op,list,fl,done){asked=list;asked.fl=fl;faoStepInfoSet(st,(10).toFixed(2)+'@'+(40).toFixed(2),'ream|H7');done();};",
    "  S.ops=[];S.drillCfg={};const op7=faoOpDefaults('drill');op7.src='model';op7.holeSel=G.filter(g=>Math.abs(g.d-10)<0.02||Math.abs(g.d-9.5)<0.02);S.ops.push(op7);",
    "  faoDrillGammeAsk(S,op7,true);",
    "  out.log.push('STEP : '+desc());",
    "  A(asked&&asked.length===2&&asked.fl.ream,'7a : fenêtre ouverte pour les 2 groupes sans fonction Perçage (avec le choix alésoir / fraise)');",
    "  const g10=asked&&asked.find(q=>Math.abs(q.g.d-10)<0.02);",
    "  A(g10&&faoStepHoleOpts(g10.g,g10.all).some(o=>o[0]==='cbore')&&faoStepHoleOpts(g10.g,g10.all).some(o=>o[0]==='ream|H7'),'7b : Ø10 au-dessus d’un Ø9,5 : lamage ou alésé proposés');",
    "  A(has(10,o=>o.cycle==='ream').length===1&&has(9.5,o=>o.cycle==='drill'||o.cycle==='peck').length===1,'7c : « Alésé H7 » choisi → perçage Ø9,5 puis alésoir Ø10');",
    "  S.holeInfo={};faoStepInfoSet(S,(10).toFixed(2)+'@'+(40).toFixed(2),'cbore');",
    "  S.ops=[];const op8=faoOpDefaults('drill');op8.src='model';op8.holeSel=op7.holeSel.slice();S.ops.push(op8);faoDrillGamme(S,op8,true);",
    "  A(has(10,o=>o.cycle==='helix').length===1&&!has(10,o=>o.cycle==='ream').length,'7d : « Lamage » choisi → Ø10 fraisé en hélicoïdal');",
    "}finally{holeAxis=hA;faoDrillGammeDlg=dA;faoHoleCache={shape:null,list:null};faoHoleMemo.clear();}",
    // fenêtre aussi pour une pièce CAO : choix alésoir / fraise et outil de fraisure si la sélection en a
    "let fl8=null;const dB=faoDrillGammeDlg;faoDrillGammeDlg=function(st,op,list,fl,done){fl8=fl;fl8.list=list.length;st.drillCfg={ream:'mill',csk:'chamfer'};done();};",
    "try{S.ops=[];S.drillCfg={};const op9=faoOpDefaults('drill');op9.src='model';op9.holeSel=G.filter(g=>Math.abs(g.d-8)<0.02||Math.abs(g.d-6.6)<0.02);S.ops.push(op9);faoDrillGammeAsk(S,op9,true);}finally{faoDrillGammeDlg=dB;}",
    "A(fl8&&fl8.ream&&fl8.csk&&fl8.list===0,'8a : alésage + fraisure sélectionnés → la fenêtre propose alésoir / fraise et l’outil de fraisure');",
    "A(has(8,o=>o.cycle==='helix'&&o.gRole==='alesage').length===1&&T(S.ops.find(o=>o.gRole==='fraisure')).kind==='chamfer','8b : choix de la fenêtre appliqués (fraise, fraise à chanfreiner)');",
    // clic sur le cône de la fraisure (et pas sur le trou) : le trou fraisé est retrouvé
    "S.ops=[];S.drillCfg={};faoDrillGammeAsk.off=true;selFaces=[{point:{x:15+5,y:45,z:38.5}}];sel={kind:null,id:null};",
    "const op10=faoOpDefaults('drill');S.ops.push(op10);const m10=faoDrillFromSel(S,op10);faoDrillGammeAsk.off=false;",
    "A(m10&&S.ops.some(o=>o.gRole==='fraisure'&&o.holes.some(h=>Math.abs(h.d-6.6)<0.02)),'9a : clic sur le cône de la fraisure → trou fraisé retrouvé, gamme avec fraisure');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== V0.99.9 : gamme automatique des alésages, pointage et fraisure ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
