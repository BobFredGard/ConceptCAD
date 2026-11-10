// V0.81.0 : EXEMPLAIRES ENLEVÉS d'une répétition (rp.skip, cases « ✂ Exemplaires à enlever »).
// Retour : « une case à cocher pour enlever une répétition qui ne tombe pas comme on le veut ».
// Plaque 100 × 100 × 10, perçage Ø6 en (10, 10). Linéaire 4 au pas de 20, grille, circulaire :
// l'exemplaire coché disparaît (volume exact), les autres gardent leur place ET leur id, l'aperçu
// rouge l'omet, la quantité réduite oublie les cases devenues sans objet, relecture du fichier.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);
    const base=id=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],constraints:[],dims:[],seq:20,visible:false});
    docResetEmpty();doc.name='Banc';
    doc.sketches=[Object.assign(base('skA'),{points:{a:{x:0,y:0},b:{x:100,y:0},c:{x:100,y:100},d:{x:0,y:100}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}]}),
      Object.assign(base('skH'),{origin:[0,0,10],points:{p:{x:10,y:10}},entities:[{id:'c1',t:'circle',pc:'p',r:3}]})];
    doc.bodies=[{id:'b1',name:'Plaque',c:null}];doc.bodySeq=2;doc.activeBody='b1';
    doc.features=[{id:'F1',type:'extrude',name:'Plaque',sketchId:'skA',distance:10,op:'add',visible:true,body:'b1'},
                  {id:'F2',type:'extrude',name:'Perçage',sketchId:'skH',distance:-10,op:'cut',visible:true,body:'b1'}];
    ensureBodies();markDirty();rebuild();
    const vol=()=>{let FR=null,v=0;try{FR=occFinalShape(null);(FR.perBody||[]).forEach(pb=>{if(pb&&pb.shape)v+=occCoqueVolume(pb.shape);});}catch(e){}try{occCleanup(FR,null);}catch(e){}return v;};
    const trou=Math.PI*9*10,plein=100*100*10;
    const rp={id:'rp1',type:'repeat',name:'Linéaire',mode:'lin',copies:3,q:1,dist:20,axis:'X',base:['F2'],children:[],visible:true};
    doc.features.push(rp);repGenChildren(rp);markDirty();rebuild();
    const kids=()=>doc.features.filter(f=>f.repeatId==='rp1');
    const xs=()=>kids().map(k=>doc.sketches.find(s=>s.id===k.sketchId).origin[0]+10).sort((a,b)=>a-b).join(',');
    A(kids().length===3&&near(vol(),plein-4*trou),'0 : linéaire 4 → 4 perçages');
    const L=repCellKeys(rp);
    A(L.length===3&&L.map(x=>x.label).join(' ')==='2 3 4','1 : cases n° 2, 3, 4 (l’original n° 1 n’a pas de case) — '+L.map(x=>x.label).join(' '));
    const id3=kids().find(k=>k.repIndex===3).id;
    rp.skip=['2,0'];repGenChildren(rp);markDirty();rebuild();
    A(kids().length===2&&xs()==='30,70'&&near(vol(),plein-3*trou),'2 : n° 3 (x = 50) enlevé → perçages en 10, 30, 70 seulement ('+xs()+')');
    A(kids().some(k=>k.id===id3),'3 : le n° 4 garde son id (rien ne se décale)');
    A(repPreviewXforms(rp).length===2,'4 : aperçu rouge : 2 copies, sans l’exemplaire enlevé');
    A(rp.children.length===2,'5 : enfants de la répétition à jour');
    // quantité réduite à 2 : la case n° 3 n'existe plus, elle est oubliée
    rp.copies=1;repGenChildren(rp);
    A(!rp.skip&&kids().length===1,'6 : quantité 2 → case « n° 3 » oubliée');
    rp.copies=3;repGenChildren(rp);markDirty();rebuild();
    A(kids().length===3&&near(vol(),plein-4*trou),'7 : quantité 4 de nouveau → les 4 perçages (rien de caché ne reste enlevé)');
    // grille 4 × 2 : enlever la case colonne 2, rangée 2
    rp.lin2=true;rp.axis2='Y';rp.copies2=1;rp.dist2=25;rp.skip=['1,1','0,1'];repGenChildren(rp);markDirty();rebuild();
    A(kids().length===5&&near(vol(),plein-6*trou),'8 : grille 4 × 2, deux cases enlevées → 6 perçages ('+kids().length+' copies)');
    A(repCellKeys(rp).find(x=>x.k==='1,1').label==='2·2','9 : étiquette colonne·rangée');
    // relecture
    const s=docSnap();docResetEmpty();docApplySnap(s);
    const rp2=doc.features.find(f=>f.id==='rp1');
    A(rp2&&JSON.stringify(rp2.skip)==='["1,1","0,1"]'&&near(vol(),plein-6*trou),'10 : relu depuis le fichier : cases enlevées gardées, 6 perçages');
    // circulaire : 6 autour du centre de la plaque, le n° 4 enlevé
    delete rp2.lin2;rp2.skip=['3'];rp2.mode='circ';rp2.copies=5;rp2.angle=360;rp2.axis='Face';rp2.dir=[0,0,1];
    // axe passant par l'origine : perçage en (10,10) → copies hors plaque ; on recentre la plaque
    doc.sketches.find(x=>x.id==='skA').origin=[-50,-50,0];
    repGenChildren(rp2);markDirty();rebuild();
    A(doc.features.filter(f=>f.repeatId==='rp1').length===4&&near(vol(),plein-5*trou),'11 : circulaire 6, n° 4 enlevé → 5 perçages');
    A(repPreviewXforms(rp2).length===4,'12 : aperçu circulaire sans le n° 4');
    // symétrie : pas de cases, skip ignoré
    rp2.mode='mir';rp2.plane='YZ';repGenChildren(rp2);
    A(repSkipSet(rp2).size===0&&doc.features.filter(f=>f.repeatId==='rp1').length===1,'13 : symétrie : aucune case, l’image est faite');
    return out;
  `;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Répétition : exemplaires enlevés ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
