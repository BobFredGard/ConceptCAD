// V0.94.0 : scripts JSON, gestes de pièce complète (53-scripts-pieces.js), noyau OCCT réel.
// Plaque 60 × 40 × 10 faite par script, puis : liste des arêtes et des faces, sélecteurs sans clic,
// congé, chanfrein, coque, perçage lisse et taraudé, répétition, symétrie de corps, modification
// d'une valeur existante, refus expliqués et script atomique. Les volumes sont calculés à la main.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};',ctx);
  const R=String.raw`
    const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
    const plaque=nom=>[{op:'new',name:nom},{op:'sketch',id:'s',name:'Contour',plane:'XY',shapes:[{rect:[0,0,60,40]}]},{op:'extrude',id:'x',sketch:'s',distance:10,name:'Plaque'}];
    const vol=()=>{const i=mfInfo();return i.bodies.reduce((s,b)=>s+b.volume,0);};
    docResetEmpty();
    // ── arêtes et faces ──
    let r=mfScriptRun(plaque('Arêtes').concat([{op:'edges'},{op:'faces'}]));
    const E=r.ok&&r.results[3],F=r.ok&&r.results[4];
    att(E&&E.count===12&&E.edges.filter(e=>e.axis==='Z').length===4&&E.edges.every(e=>e.kind==='line'),'1 : 12 arêtes droites, 4 selon Z ('+(E?E.count:r.error)+')');
    att(F&&F.count===6&&F.faces.every(f=>f.kind==='plane'),'2 : 6 faces planes');
    const G=mfGeometrie();mfGeoLibere();
    const haut=mfFacesChoisies('top',G);
    att(haut.length===1&&near(haut[0].center[2],10)&&haut[0].normal[2]===1,'3 : « top » = la face Z 10, normale +Z');
    att(mfAretesChoisies({face:'top'},G).length===4&&mfAretesChoisies({dir:'Z'},G).length===4&&mfAretesChoisies({dir:'X',face:'bottom'},G).length===2,'4 : arêtes du dessus (4), verticales (4), selon X du dessous (2)');
    att(mfAretesChoisies({near:[0,0,5]},G).length===1&&mfAretesChoisies({near:[0,0,5]},G)[0].axis==='Z','5 : « near » : l’arête verticale du coin (0,0)');
    let err='';try{mfAretesChoisies({dir:'Z',face:'top'},G);}catch(e){err=e.message;}
    att(/aucune arête/.test(err),'6 : sélecteur vide expliqué ('+err+')');
    // ── congé ──
    r=mfScriptRun(plaque('Congé').concat([{op:'fillet',id:'c',edges:{dir:'Z'},radius:5}]));
    const vC=24000-4*(25-Math.PI*25/4)*10;
    att(r.ok&&near(vol(),vC,1e-2)&&doc.features[1].type==='xfillet'&&doc.features[1].edges.length===4,'7 : congé R5 sur les 4 arêtes verticales : '+(r.ok?vol().toFixed(3):r.error)+' (attendu '+vC.toFixed(3)+')');
    const u0=docUndoStack.length;
    r=mfScriptRun([{op:'set',feature:'c',radius:3}]);
    r=mfScriptRun([{op:'set',feature:doc.features[1].name,radius:3}]);
    const vC3=24000-4*(9-Math.PI*9/4)*10;
    att(r.ok&&near(vol(),vC3,1e-2)&&doc.features[1].edges.every(e=>e.r===3),'8 : set radius 3 sur le congé existant (par son nom) : '+(r.ok?vol().toFixed(3):r.error));
    const s0=docSnap(),u1=docUndoStack.length;
    r=mfScriptRun([{op:'fillet',edges:{face:'top'},radius:30}]);
    att(!r.ok&&docSnap()===s0&&docUndoStack.length===u1,'9 : congé R30 impossible : refusé, pièce intacte ('+r.error+')');
    // ── chanfrein ──
    r=mfScriptRun(plaque('Chanfrein').concat([{op:'chamfer',edges:{face:'top',dir:'X'},distance:2}]));
    att(r.ok&&near(vol(),24000-2*60*2,1e-2)&&doc.features[1].chamfer===true&&doc.features[1].edges.every(e=>Array.isArray(e.fn)),'10 : chanfrein 2 mm sur les 2 arêtes du dessus selon X : '+(r.ok?vol().toFixed(3):r.error)+' (attendu 23 760)');
    // ── coque ──
    r=mfScriptRun(plaque('Coque').concat([{op:'shell',faces:'top',thickness:2}]));
    att(r.ok&&near(vol(),24000-56*36*8,1e-2)&&doc.features[1].type==='xshell','11 : coque 2 mm ouverte par le dessus : '+(r.ok?vol().toFixed(3):r.error)+' (attendu 7 872)');
    // ── perçages ──
    r=mfScriptRun(plaque('Perçage').concat([
      {op:'sketch',id:'h',name:'Trous',plane:'XY',offset:10,shapes:[{hole:[10,10]},{hole:[50,10]}]},
      {op:'hole',id:'t',sketch:'h',d:6,depth:5,tip:0}]));
    att(r.ok&&r.results[4].holes===2&&near(vol(),24000-2*Math.PI*9*5,1e-2),'12 : deux trous Ø6 × 5 fond plat depuis le dessus : '+(r.ok?vol().toFixed(3):r.error));
    r=mfScriptRun([{op:'set',feature:'t',depth:8}]);
    r=mfScriptRun([{op:'set',feature:doc.features[1].name,depth:8}]);
    att(r.ok&&near(vol(),24000-2*Math.PI*9*8,1e-2),'13 : set depth 8 : '+(r.ok?vol().toFixed(3):r.error));
    r=mfScriptRun(plaque('Taraudé').concat([
      {op:'sketch',id:'h',plane:'XY',offset:10,shapes:[{hole:[30,20]}]},
      {op:'hole',sketch:'h',thread:'M6',through:true}]));
    const ho=doc.features.find(f=>f.type==='hole');
    att(r.ok&&ho&&ho.thread&&ho.thread.size==='M6'&&near(ho.d,tapDrill('M6',1))&&ho.end==='through'&&vol()<24000,'14 : taraudage M6 débouchant : Ø de perçage '+(ho?ho.d:'?')+' ('+(r.ok?'ok':r.error)+')');
    r=mfScriptRun(plaque('Lamé').concat([{op:'sketch',id:'h',plane:'XY',offset:10,shapes:[{hole:[30,20]}]},{op:'hole',sketch:'h',d:6.6,through:true,cbore:{d:11,depth:6.4}}]));
    att(r.ok&&doc.features.find(f=>f.type==='hole').kind==='cbore'&&near(vol(),24000-Math.PI*(3.3*3.3*3.6+5.5*5.5*6.4),1e-1),'15 : trou lamé Ø6,6 / Ø11 × 6,4 : '+(r.ok?vol().toFixed(3):r.error));
    r=mfScriptRun(plaque('Sans centre').concat([{op:'sketch',id:'h',plane:'XY',shapes:[{circle:[5,5,1]}]},{op:'hole',sketch:'h',d:3,depth:3}]));
    att(!r.ok&&/centre de perçage/.test(r.error),'16 : perçage sans centre : expliqué');
    // ── répétition ──
    r=mfScriptRun(plaque('Plots').concat([
      {op:'sketch',id:'p',plane:'XY',offset:10,shapes:[{circle:[10,20,3]}]},
      {op:'extrude',id:'b',sketch:'p',distance:5},
      {op:'pattern',features:['b'],type:'linear',count:3,distance:15,axis:'X'}]));
    att(r.ok&&r.results[5].instances===2&&near(vol(),24000+3*Math.PI*9*5,1e-2),'17 : répétition linéaire de 3 plots : '+(r.ok?vol().toFixed(3):r.error));
    const rp=doc.features.find(f=>f.type==='repeat');
    r=mfScriptRun([{op:'set',feature:rp.name,count:4}]);
    att(r.ok&&near(vol(),24000+4*Math.PI*9*5,1e-2),'18 : set count 4 : '+(r.ok?vol().toFixed(3):r.error));
    r=mfScriptRun(plaque('Rond').concat([
      {op:'sketch',id:'p',plane:'XY',offset:10,shapes:[{circle:[45,20,3]}]},{op:'extrude',id:'b',sketch:'p',distance:5},
      {op:'sketch',id:'q',plane:'XY',offset:10,shapes:[{rect:[20,10,40,30]}]},{op:'extrude',sketch:'q',distance:1},
      {op:'pattern',features:'b',type:'circular',count:4,axis:'Z'}]));
    att(r.ok&&r.results[r.results.length-1].instances===3,'19 : répétition circulaire : 3 instances ('+(r.ok?'ok':r.error)+')');
    // ── symétrie de corps ──
    r=mfScriptRun(plaque('Symétrie').concat([{op:'mirror',plane:'YZ'},{op:'info'}]));
    const sy=r.ok&&r.results[4];
    att(sy&&sy.bodies.length>=1&&near(Math.min(...sy.bodies.map(b=>b.box.min[0])),-60,1e-6),'20 : symétrie YZ : la pièce va jusqu’à X −60 ('+(r.ok?'ok':r.error)+')');
    // ── valeurs existantes ──
    r=mfScriptRun(plaque('Set').concat([{op:'set',feature:'x',distance:20}]));
    att(r.ok&&near(vol(),48000,1e-3),'21 : set distance 20 sur l’extrusion du script : '+(r.ok?vol():r.error));
    r=mfScriptRun([{op:'set',feature:'Plaque',angle:3}]);
    att(!r.ok&&/inconnu pour extrude/.test(r.error),'22 : champ inconnu expliqué ('+r.error+')');
    r=mfScriptRun([{op:'set',sketch:'Contour',dim:0,value:5}]);
    att(!r.ok&&/cote 0 inexistante/.test(r.error),'23 : cote inexistante expliquée');
    // cote d'une esquisse cotée : longueur d'un côté du rectangle
    const sk=doc.sketches[0],ln=sk.entities.find(e=>e.t==='line');
    sk.dims.push({id:'d1',type:'length',line:ln.id,value:60,ox:0,oy:0});
    r=mfScriptRun([{op:'info'}]);
    att(r.ok&&r.results[0].sketches[0].dims&&r.results[0].sketches[0].dims[0].value===60,'24 : info liste les cotes de l’esquisse');
    r=mfScriptRun([{op:'set',sketch:'Contour',dim:0,value:80}]);
    const L=Math.hypot(sk.points[ln.p2].x-sk.points[ln.p1].x,sk.points[ln.p2].y-sk.points[ln.p1].y);
    att(r.ok&&near(L,80,1e-3),'25 : set de la cote : le côté passe à 80 ('+(r.ok?L.toFixed(3):r.error)+')');
    // ── un script entier, une étape d'annulation ──
    docResetEmpty();
    const n0=docUndoStack.length;
    r=mfScriptRun(plaque('Complet').concat([
      {op:'fillet',edges:{dir:'Z'},radius:4},
      {op:'chamfer',edges:{face:'top'},distance:1},
      {op:'sketch',id:'h',plane:'XY',offset:10,shapes:[{hole:[10,10]},{hole:[50,10]},{hole:[10,30]},{hole:[50,30]}]},
      {op:'hole',sketch:'h',thread:'M5',depth:8}]));
    att(r.ok&&doc.features.length===4&&docUndoStack.length===n0+1,'26 : pièce complète en un script, une seule étape d’annulation ('+(r.ok?'ok':r.error)+')');
    docUndo();
    att(doc.features.length===0,'27 : Ctrl+Z défait toute la pièce');
    return {ATT,OK};
  `;
  const o=await vm.runInContext('(async function(){'+R+'})()',ctx);
  console.log('=== V0.94.0 : scripts, pièces complètes ===');
  o.OK.forEach(m=>console.log('  ✓ '+m));
  if(o.ATT.length){o.ATT.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.ATT.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
