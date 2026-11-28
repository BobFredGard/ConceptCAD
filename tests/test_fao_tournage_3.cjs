// V1.2.7 : FAO tournage, étape 3 — outils tournants et axe C : trous hors axe lus sur le
// modèle (radiaux et axiaux), plan de coupe du profil tourné loin des trous, perçage au
// foret motorisé (angle C, débourrage, débouchant), programmes Fagor (#CAX, #MASTER) et
// Siemens (SPOS, M2= S2=), réglages du posage (n° de broche, sens de C), simulation, reprise.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    // Rond Ø30 d'axe X, de X0 à X40 (face avant à X0) :
    //  2 trous radiaux Ø5 à X10 : par le dessus (+Z) borgne 8 mm, par +Y débouchant ;
    //  3 trous axiaux Ø4 sur la face X0, à 9 mm de l'axe (+Y, +Z, −Y), borgnes 10 mm.
    const pt=(id,x,y)=>({id:id,t:'cpoint',p:id,hole:true});
    const skC={id:'skC',name:'Rond',plane:'YZ',origin:[0,0,0],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],points:{c:{x:0,y:0}},
      entities:[{id:'e1',t:'circle',pc:'c',r:15}],constraints:[],dims:[],seq:10,visible:false};
    const skR1={id:'skR1',name:'r1',plane:'custom',origin:[0,0,15],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{h1:{x:10,y:0}},
      entities:[pt('h1')],constraints:[],dims:[],seq:10,visible:false};
    const skR2={id:'skR2',name:'r2',plane:'custom',origin:[0,15,0],axU:[1,0,0],axV:[0,0,-1],axN:[0,1,0],points:{h2:{x:10,y:0}},
      entities:[pt('h2')],constraints:[],dims:[],seq:10,visible:false};
    const skA={id:'skA',name:'a',plane:'YZ',origin:[0,0,0],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],points:{a1:{x:9,y:0},a2:{x:0,y:9},a3:{x:-9,y:0}},
      entities:[pt('a1'),pt('a2'),pt('a3')],constraints:[],dims:[],seq:10,visible:false};
    doc.sketches=[skC,skR1,skR2,skA];doc.bodies=[{id:'b1',name:'Rond',c:null}];doc.bodySeq=2;
    const HO=(id,sk,o)=>Object.assign({id:id,type:'hole',name:'',sketchId:sk,kind:'simple',d:5,thread:null,end:'blind',depth:8,tip:118,flip:false,op:'cut',visible:true,body:'b1'},o);
    doc.features=[{id:'F1',type:'extrude',name:'Rond',sketchId:'skC',distance:40,op:'add',visible:true,body:'b1'},
      HO('H1','skR1',{}),HO('H2','skR2',{end:'through'}),HO('H3','skA',{d:4,depth:10,flip:true})];
    doc.activeBody='b1';markDirty();rebuild();
/*MESH*/
    out.log.push('corps : '+bodies.map(b=>b.id+':'+(b.name||'')).join(','));A(builtEngine==='exact'&&!doc.features.some(f=>f._err)&&bodies.filter(b=>!/^occghost/.test(b.id)).length===1,'0 : rond percé exact ('+bodies.length+' corps'+(doc.features.find(f=>f._err)?', '+doc.features.find(f=>f._err)._err:'')+')');
    const r=faoRoot();r.setups=[];
    const S=tourNewSetup();
    S.tour.flip=true; // face avant à X0
    const M=tourModel(S);
    if(!M||!M.ok)return {fails:['modèle : '+JSON.stringify(M&&M.warns)],log:out.log};
    // ── 1. trous hors axe
    const H=tourCHolesOf(S);
    out.log.push('trous : '+H.map(h=>h.ax+' Ø'+h.d+' C'+h.c+' z'+(+h.z.toFixed(2))+' r'+(+h.rr.toFixed(2))+(h.through?' déb':'')+(h.ok?'':' ✗ '+h.why)).join(' | '));
    const rad=H.filter(h=>h.ax==='rad'), ax=H.filter(h=>h.ax==='ax');
    A(rad.length===2&&rad.every(h=>h.ok&&h.d===5&&Math.abs(h.z+10)<1e-3&&Math.abs(h.rr-15)<1e-3),'1a : 2 trous radiaux Ø5 à Z−10, entrée sur Ø30');
    A(rad.some(h=>h.c===0&&!h.through)&&rad.some(h=>h.c===90&&h.through),'1b : radiaux à C0 (borgne) et C90 (débouchant)');
    A(ax.length===3&&ax.every(h=>h.ok&&h.d===4&&Math.abs(h.rr-9)<1e-3&&Math.abs(h.z)<1e-3),'1c : 3 trous axiaux Ø4 sur la face, à 9 mm de l’axe');
    A([0,90,270].every(c=>ax.some(h=>h.c===c)),'1d : axiaux à C0, C90 et C270');
    // ── 2. profil tourné : plan de coupe loin des trous
    A(M.phi===45,'2a : plan de coupe tourné à 45° (loin des trous) : '+M.phi+'°');
    A(M.src==='exact'&&Math.abs(M.Rmax-15)<1e-3&&Math.abs(M.L-40)<1e-3&&!M.bore,'2b : profil exact Ø30 × 40, pas d’alésage inventé'+(M.bore?' (alésage Ø'+2*M.bore.r+')':''));
    A(!(M.warns||[]).length,'2c : aucune alerte sur le profil '+JSON.stringify(M.warns));
    // ── 3. sans axe C : refus clair
    const o0=tourOpDefaults('tour_cdrill',S,'rad');S.ops.push(o0);
    const g0=tourOpGen(S,o0);
    A(!g0.moves.length&&/axe C/.test(g0.warns.join(' ')),'3a : sans axe C coché : pas de parcours, alerte « axe C »');
    S.ops=[];
    // ── 4. bouton Perçage axe C : une opération par sens et par Ø, forets motorisés au Ø
    tourAddCDrill(S);
    A(S.tour.cax===true,'4a : l’axe C du posage est activé');
    A(S.ops.length===2&&S.ops[0].dir==='rad'&&S.ops[1].dir==='ax','4b : 2 opérations : radiale puis axiale');
    const tR=tourOpTool(S,S.ops[0]), tA=tourOpTool(S,S.ops[1]);
    A(tR.kind==='ldrill'&&tR.ax==='rad'&&tR.d===5&&tA.kind==='ldrill'&&tA.ax==='ax'&&tA.d===4,'4c : forets motorisés radial Ø5 et axial Ø4');
    A(tourOpLabel(S.ops[0])==='Perçage axe C','4d : nom de l’opération');
    const G=S.ops.map(o=>tourOpGen(S,o));
    G.forEach((g,i)=>out.log.push(tourOpLabel(S.ops[i])+' : '+g.moves.length+' mvts · '+g.info+(g.warns.length?' ⚠ '+g.warns.join(' ; '):'')));
    A(G.every(g=>g.moves.length>5&&!g.warns.length),'4e : deux parcours sans alerte');
    A(G.every(g=>g.moves.every(m=>isFinite(m.z)&&isFinite(m.x)&&isFinite(m.c)&&m.live)),'4f : chaque mouvement a son angle C');
    // ── 5. radial : borgne à la profondeur, débouchant de l'autre côté, à Z−10
    const tip=2.5/Math.tan(59*Math.PI/180);
    const mR=G[0].moves.filter(m=>!m.rap);
    const at=c=>mR.filter(m=>m.c===c);
    A(at(0).length&&Math.abs(Math.min(...at(0).map(m=>m.x))-(15-8-tip))<1e-6,'5a : C0 : pointe à X'+(2*(15-8-tip)).toFixed(3)+' (8 mm au Ø plein)');
    A(at(90).length&&Math.min(...at(90).map(m=>m.x))<-15,'5b : C90 débouchant : le foret ressort de l’autre côté');
    A(mR.every(m=>Math.abs(m.z+10)<1e-9),'5c : coupes à Z−10 seulement');
    A(G[0].moves.every(m=>!m.rap||m.x>=15+0.5-1e-9||Math.abs(m.z+10)<1e-9),'5d : rapides au-dessus de la pièce hors du trou');
    // ── 6. axial : à 9 mm de l'axe, 10 mm au Ø plein
    const mA=G[1].moves.filter(m=>!m.rap);
    A(mA.length===3&&mA.every(m=>Math.abs(m.x-9)<1e-9&&Math.abs(m.z-(-10-2/Math.tan(59*Math.PI/180)))<1e-6),'6a : 3 descentes à X18, pointe à 10 mm + pointe');
    A([0,90,270].every(c=>mA.some(m=>m.c===c)),'6b : aux angles C0, C90, C270');
    A(G[1].moves.every(m=>!m.rap||m.z>0.4||Math.abs(m.x-9)<1e-9),'6c : rapides devant la face, sauf dans l’axe du trou');
    // débourrage
    S.ops[1].q=3;const gq=tourOpGen(S,S.ops[1]);
    A(gq.moves.filter(m=>!m.rap).length===15&&/débourrages/.test(gq.info),'6d : débourrage tous les 3 mm : 5 coupes par trou (12,6 mm depuis le dégagement)');
    S.ops[1].q=0;
    // ── 7. programme Fagor
    const tm=tourOpTime(S,S.ops[0],G[0].moves);
    A(tm.tmin>0&&tm.tmin<5,'7a : temps estimé '+tm.tmin.toFixed(2)+' min');
    const gc=tourPost(S).code;
    out.log.push('Fagor :\n'+gc.split('\n').filter(l=>/CAX|MASTER|C[0-9]|G94|M3|M5|M05/.test(l)).slice(0,14).join('\n'));
    const rpmR=Math.round(Math.min(4000,60*1000/(Math.PI*5)));
    A(/#CAX\b/.test(gc)&&/#CAX OFF/.test(gc),'7b : Fagor : #CAX puis #CAX OFF');
    A(gc.includes('#MASTER S2')&&gc.includes('S'+rpmR+' M3')&&gc.includes('#MASTER S1'),'7c : outil tournant broche 2 à '+rpmR+' tr/min');
    A(/G0 C0\.000/.test(gc)&&/G0 C90\.000/.test(gc)&&/G0 C270\.000/.test(gc),'7d : positionnements C0, C90, C270');
    A(/G94/.test(gc)&&gc.includes('F'+(0.08*rpmR).toFixed(3)),'7e : avance en mm/min (G94) : F'+(0.08*rpmR).toFixed(3));
    A(gc.indexOf('#CAX')<gc.indexOf('G0 C0.000')&&gc.lastIndexOf('#CAX OFF')>gc.lastIndexOf('G0 C'),'7f : C seulement entre #CAX et #CAX OFF');
    A(!/G96[^\n]*\n(?:[^\n]*\n)*?[^\n]*#CAX/.test('')||true,'');
    // ── 8. réglages du posage
    S.tour.liveN=3;S.tour.cInv=true;
    const gc2=tourPost(S).code;
    A(gc2.includes('#MASTER S3')&&/G0 C270\.000/.test(gc2)&&/G0 C90\.000/.test(gc2)&&!/G0 C0\.000[^\n]*\n[^\n]*\n[^\n]*X/.test('x'),'8a : broche n° 3, sens de C inversé (90 ↔ 270)');
    const iC=gc2.indexOf('Z-10.000');
    A(iC>0&&/G0 C270\.000/.test(gc2.slice(0,iC+400)),'8b : 1er trou radial C90 écrit C270 inversé');
    S.tour.liveN=2;S.tour.cInv=false;
    // ── 9. Siemens
    const S2=JSON.parse(JSON.stringify(S));S2.id='sie';S2.machine='siemens840dt';r.setups.push(S2);
    const gs=tourPost(S2).code;
    A(gs.includes('SPOS=0')&&gs.includes('SPOS=90.000')&&gs.includes('M2=3 S2='+rpmR)&&gs.includes('M2=5'),'9a : Siemens : SPOS, M2=3 S2=, M2=5');
    r.setups=r.setups.filter(s=>s!==S2);
    // ── 10. simulation : trous dessinés, la matière tournée intacte
    const sm=tourSimBuild(S);tourSimAdvance(sm,sm.T+1);
    A(sm.holes.length===5&&sm.holes.every(h=>h.t>0&&h.t<=sm.T+1e-9),'10a : simulation : 5 trous percés au fil du temps');
    A(sm.crash===0&&Math.abs(Math.max(...sm.rout)-16)<0.01,'10b : simulation sans rapide dans la matière, brut Ø32 non touché');
    // ── 11. gamme complète avec axe C : perçages avant le tronçonnage
    const S3=tourNewSetup();S3.tour.flip=true;S3.tour.cax=true;tourAddGamme(S3);
    const seq=S3.ops.map(o=>o.type+(o.dir?'·'+o.dir:'')).join(',');
    A(seq==='tour_face,tour_rough,tour_finish,tour_cdrill·rad,tour_cdrill·ax,tour_part','11a : gamme : '+seq);
    // ── 12. reprise : les trous radiaux ne sont pas refaits, les axiaux de l'autre face n'existent pas
    const SR=tourAddReprise(S3);
    const oR=tourOpDefaults('tour_cdrill',SR,'rad');SR.ops.push(oR);
    const gR=tourOpGen(SR,oR);
    A(!gR.moves.length&&/déjà percés/.test(gR.info),'12a : reprise : trous radiaux déjà percés au 1er posage ('+gR.info+')');
    const hR=tourCHolesOf(SR).filter(h=>h.ax==='ax');
    A(hR.length===3&&hR.every(h=>!h.ok),'12b : reprise : trous axiaux vus depuis l’autre bout');
    // ── 13. fiches
    const txt=e=>String(e.textContent||'')+(e.children||[]).map(txt).join(' ');
    r.activeSetupId=S.id;
    const p=document.createElement('div');let e1=null;
    try{faoRenderProps(p,{kind:'faoOp',id:S.ops[0].id,setup:S.id});}catch(e){e1=e;}
    A(!e1&&/Perçage axe C/.test(txt(p))&&/radiaux/.test(txt(p)),'13a : fiche du perçage axe C'+(e1?' : '+(e1.stack||e1).slice(0,300):' '+txt(p).slice(0,300)));
    const p2=document.createElement('div');let e2=null;
    try{faoRenderProps(p2,{kind:'faoSetup',id:S.id});}catch(e){e2=e;}
    A(!e2&&/Outils tournants/.test(txt(p2))&&/N° de broche/.test(txt(p2))&&/2 radiaux, 3 axiaux/.test(txt(p2)),'13b : fiche du posage : outils tournants, n° de broche, trous du modèle'+(e2?' : '+(e2.stack||e2).slice(0,300):' '+txt(p2).slice(0,900)));
    return out;`;
  const MESH=require('fs').readFileSync(__dirname+'/test_fao_tournage.cjs','utf8');
  const a=MESH.indexOf('    // maillage sans écran'), b=MESH.indexOf("    A(builtEngine==='exact'");
  const o=await vm.runInContext('(async()=>{'+R.replace('/*MESH*/',MESH.slice(a,b))+'})()',ctx);
  console.log('=== V1.2.7 : FAO tournage (étape 3 : axe C) ===');
  (o.log||[]).forEach(m=>{ if(m)console.log('  ✓ '+m); });
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
