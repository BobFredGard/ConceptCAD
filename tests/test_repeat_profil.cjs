// Répétition SUIVANT UN PROFIL (V0.30.0 : 39-profil-guide + 40), noyau OCCT réel.
// Plaque 100 × 100 × 10, un perçage Ø6 traversant en (10, 10). Courbe guide dans une esquisse :
//   - carré FERMÉ (10,10) → (90,10) → (90,90) → (10,90), longueur 320 : 8 réparti → pas 40, la
//     dernière copie en (10, 50), un pas AVANT le départ (pas de doublon sur l'original) ;
//   - polyligne OUVERTE (10,10) → (90,10) → (90,90), longueur 160 : 5 réparti → pas 40, de
//     l'extrémité de départ à l'autre ; départ pris à l'autre extrémité → même jeu de positions ;
//   - pas imposé au-delà de l'extrémité : copies abandonnées, avertissement ;
//   - cercle : longueur 2πR exacte, départ sur un point d'esquisse ;
//   - orientation « suit la tangente » : le repère de l'esquisse copiée tourne avec la courbe ;
//   - la courbe guide est modifiée → les copies suivent ; relecture du fichier.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);
    const base=id=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],constraints:[],dims:[],seq:20,visible:false});
    docResetEmpty();doc.name='Banc';
    doc.sketches=[Object.assign(base('skA'),{points:{a:{x:0,y:0},b:{x:100,y:0},c:{x:100,y:100},d:{x:0,y:100}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}]}),
      Object.assign(base('skH'),{origin:[0,0,10],points:{p:{x:10,y:10}},entities:[{id:'c1',t:'circle',pc:'p',r:3}]}),
      // guide FERMÉ : carré, entités volontairement dans le désordre et une ligne retournée
      Object.assign(base('skG'),{name:'Guide',points:{a:{x:10,y:10},b:{x:90,y:10},c:{x:90,y:90},d:{x:10,y:90}},
        entities:[{id:'g3',t:'line',p1:'c',p2:'d'},{id:'g1',t:'line',p1:'a',p2:'b'},{id:'g4',t:'line',p1:'a',p2:'d'},{id:'g2',t:'line',p1:'b',p2:'c'}]}),
      // guide OUVERT : deux lignes, plus un point d'esquisse hors courbe (ignoré)
      Object.assign(base('skO'),{name:'Ouvert',points:{a:{x:10,y:10},b:{x:90,y:10},c:{x:90,y:90},z:{x:50,y:50}},
        entities:[{id:'o1',t:'line',p1:'a',p2:'b'},{id:'o2',t:'line',p1:'b',p2:'c'},{id:'pz',t:'cpoint',p:'z'}]}),
      // guide CERCLE, départ sur un point d'esquisse
      Object.assign(base('skC'),{name:'Cercle',points:{o:{x:50,y:50},s:{x:80,y:50}},
        entities:[{id:'k1',t:'circle',pc:'o',r:30},{id:'ps',t:'cpoint',p:'s'}]})];
    doc.bodies=[{id:'b1',name:'Plaque',c:null}];doc.bodySeq=2;doc.activeBody='b1';
    doc.features=[{id:'F1',type:'extrude',name:'Plaque',sketchId:'skA',distance:10,op:'add',visible:true,body:'b1'},
                  {id:'F2',type:'extrude',name:'Perçage',sketchId:'skH',distance:-10,op:'cut',visible:true,body:'b1'}];
    ensureBodies();markDirty();rebuild();
    const vol=()=>{let FR=null,v=0;try{FR=occFinalShape(null);(FR.perBody||[]).forEach(pb=>{if(pb&&pb.shape)v+=occCoqueVolume(pb.shape);});}catch(e){}try{occCleanup(FR,null);}catch(e){}return v;};
    const trou=Math.PI*9*10,plein=100*100*10;
    const kids=()=>doc.features.filter(f=>f.repeatId==='rp1');
    const ctr=()=>kids().map(k=>{const s=doc.sketches.find(x=>x.id===k.sketchId);const W=(x,y)=>[s.origin[0]+x*s.axU[0]+y*s.axV[0],s.origin[1]+x*s.axU[1]+y*s.axV[1]];const q=W(10,10);return Math.round(q[0])+','+Math.round(q[1]);});
    // ── calcul seul : chaînes, longueurs ──
    const chG=pgChains(doc.sketches.find(s=>s.id==='skG'));
    A(chG.length===1&&chG[0].closed&&near(chG[0].L,320,1e-9),'0a : carré : une chaîne fermée de 320 mm — '+chG.map(c=>c.L+(c.closed?' fermée':' ouverte')).join(' / '));
    const chO=pgChains(doc.sketches.find(s=>s.id==='skO'));
    A(chO.length===1&&!chO[0].closed&&near(chO[0].L,160,1e-9),'0b : polyligne : une chaîne ouverte de 160 mm');
    const chC=pgChains(doc.sketches.find(s=>s.id==='skC'));
    A(chC.length===1&&chC[0].closed&&near(chC[0].L,2*Math.PI*30,1e-9),'0c : cercle R30 : longueur exacte 2πR = '+chC[0].L.toFixed(6));
    const choix=pgStartChoices(doc.sketches.find(s=>s.id==='skO')).map(o=>o.label);
    A(choix.some(l=>/^Extrémité A/.test(l))&&choix.some(l=>/^Extrémité B/.test(l))&&!choix.some(l=>/50 ; 50/.test(l))&&choix.some(l=>/^Milieu de ligne \(50 ; 10\)/.test(l)),'0d : départs proposés (2 extrémités, milieux, pas le point hors courbe) : '+choix.join(' | '));
    // ── 1. courbe FERMÉE, 8 réparti ──
    const rp={id:'rp1',type:'repeat',name:'',mode:'path',copies:7,q:1,base:['F2'],children:[],visible:true,
      path:{sk:'skG',pt:'a'},pspace:'fit',orient:'fixed'};
    rp.name=repTypeName(rp.mode,rp);
    doc.features.push(rp);repGenChildren(rp);markDirty();rebuild();
    A(kids().length===7,'1 : fermée, quantité 8 → 7 copies : '+kids().length);
    A(JSON.stringify(ctr())===JSON.stringify(['50,10','90,10','90,50','90,90','50,90','10,90','10,50']),'2 : pas 40 le long du carré, la dernière en (10,50), un pas avant le départ — '+ctr().join(' '));
    A(near(vol(),plein-8*trou,1e-3),'3 : volume exact, 8 perçages — '+vol().toFixed(3));
    A(rp.name==='Suivant un profil'&&/Longueur de la courbe : 320 mm · fermée · pas 40 mm/.test(repPathNote(rp)),'4 : nom « '+rp.name+' », note « '+repPathNote(rp)+' »');
    // sens inversé : mêmes positions (réparti sur une fermée), ordre opposé
    rp.rev=true;repGenChildren(rp);
    A(JSON.stringify(ctr())===JSON.stringify(['10,50','10,90','50,90','90,90','90,50','90,10','50,10']),'5 : fermée, sens inversé : mêmes positions, ordre inverse — '+ctr().join(' '));
    delete rp.rev;
    // départ au milieu d'une ligne
    rp.path={sk:'skG',mid:'g1'};rp.copies=3;repGenChildren(rp);
    A(JSON.stringify(ctr())===JSON.stringify(['50,50','10,90','-30,50']),'6 : départ au milieu de (10,10)-(90,10), 4 réparti (pas 80) → points (90,50) (50,90) (10,50), perçages décalés d’autant — '+ctr().join(' '));
    // ── 2. courbe OUVERTE ──
    rp.path={sk:'skO',pt:'a'};rp.copies=4;repGenChildren(rp);markDirty();rebuild();
    A(JSON.stringify(ctr())===JSON.stringify(['50,10','90,10','90,50','90,90']),'7 : ouverte, 5 réparti → pas 40, la dernière sur l’autre extrémité — '+ctr().join(' '));
    A(near(vol(),plein-5*trou,1e-3),'8 : volume exact, 5 perçages — '+vol().toFixed(3));
    // départ à l'autre extrémité : l'original y est (perçage déplacé en (90,90)), la courbe est parcourue à l'envers
    rp.path={sk:'skO',pt:'c'};repGenChildren(rp);
    A(JSON.stringify(ctr())===JSON.stringify(['10,-30','10,-70','-30,-70','-70,-70']),'9 : départ à l’extrémité B (90,90) : la courbe est parcourue vers A — points (90,50) (90,10) (50,10) (10,10) — '+ctr().join(' '));
    // ── 3. pas imposé ──
    rp.path={sk:'skO',pt:'a'};rp.pspace='pitch';rp.dist=30;rp.copies=6;repGenChildren(rp);
    A(kids().length===5&&/au-delà de l’extrémité/.test(repPathNote(rp)),'10 : pas 30, quantité 7 sur 160 mm : 5 copies (0…150), la 7ᵉ abandonnée — '+kids().length+' · '+repPathNote(rp));
    rp.pspace='fit';
    // ── 4. orientation « suit la tangente » sur le carré ──
    rp.path={sk:'skG',pt:'a'};rp.copies=7;rp.orient='tangent';repGenChildren(rp);
    const ax=kids().map(k=>{const s=doc.sketches.find(x=>x.id===k.sketchId);return s.axU.map(v=>Math.round(v)).join(',');});
    A(JSON.stringify(ax)===JSON.stringify(['1,0,0','0,1,0','0,1,0','-1,0,0','-1,0,0','0,-1,0','0,-1,0']),'11 : tangente : repère tourné de 90° à chaque côté (coins : tangente du côté qui commence) — '+ax.join(' | '));
    rp.orient='fixed';
    // ── 5. cercle ──
    rp.path={sk:'skC',pt:'s'};rp.copies=5;repGenChildren(rp);
    const c6=kids().map(k=>{const s=doc.sketches.find(x=>x.id===k.sketchId);return [s.origin[0]+80,s.origin[1]+50];});
    A(c6.length===5&&c6.every((q,i)=>Math.hypot(q[0]-(50+30*Math.cos((i+1)*Math.PI/3)),q[1]-(50+30*Math.sin((i+1)*Math.PI/3)))<1e-6),'12 : cercle, 6 réparti : un exemplaire tous les 60°');
    // ── 6. la courbe guide change → les copies suivent (rejeu) ──
    rp.path={sk:'skG',pt:'a'};rp.copies=7;repGenChildren(rp);markDirty();rebuild();
    const G=doc.sketches.find(s=>s.id==='skG');G.points.c.x=90;G.points.c.y=90;G.points.b.x=90;G.points.d.y=50;G.points.c.y=50; // rectangle 80 × 40 → 240 mm
    markDirty();rebuild();
    A(/Longueur de la courbe : 240 mm/.test(repPathNote(rp))&&JSON.stringify(ctr())===JSON.stringify(['40,10','70,10','90,20','90,50','60,50','30,50','10,40']),'13 : guide raccourci (240 mm) : copies recalculées au rejeu, pas 30 — '+ctr().join(' ')+' · '+repPathNote(rp));
    // ── 7. relecture ──
    const s=docSnap();docResetEmpty();docApplySnap(s);
    const rp2=doc.features.find(f=>f.id==='rp1');
    A(rp2&&rp2.mode==='path'&&rp2.path.sk==='skG'&&rp2.path.pt==='a'&&rp2.pspace==='fit'&&near(vol(),plein-8*trou,1e-3),'14 : document relu : répétition suivant un profil gardée, 8 perçages');
    // ── 8. esquisse guide supprimée : aucune copie, message ──
    doc.sketches=doc.sketches.filter(x=>x.id!=='skG');repGenChildren(rp2);
    A(doc.features.filter(f=>f.repeatId==='rp1').length===0&&/esquisse guide introuvable/.test(repPathNote(rp2)),'15 : guide supprimé : plus de copie, « '+repPathNote(rp2)+' »');
    // ── 9. courbe guide DANS l'esquisse du perçage (V0.30.1) : seule la fonction est répétée ──
    doc.features=doc.features.filter(f=>f.id!=='rp1'&&f.repeatId!=='rp1');
    const H=doc.sketches.find(x=>x.id==='skH');H.visible=true;
    Object.assign(H.points,{g1:{x:10,y:10},g2:{x:90,y:10},g3:{x:90,y:90}});
    H.entities.push({id:'u1',t:'line',p1:'g1',p2:'g2',construction:true},{id:'u2',t:'line',p1:'g2',p2:'g3',construction:true});
    H.constraints=[{type:'horizontal',line:'u1'}];
    const rp3={id:'rp3',type:'repeat',name:'Suivant un profil',mode:'path',copies:4,q:1,base:['F2'],children:[],visible:true,path:{sk:'skH',pt:'g1'},pspace:'fit',orient:'fixed'};
    doc.features.push(rp3);repGenChildren(rp3);markDirty();rebuild();
    const K3=doc.features.filter(f=>f.repeatId==='rp3').map(k=>doc.sketches.find(x=>x.id===k.sketchId));
    A(K3.length===4&&K3.every(s=>s.visible===false&&s.entities.length===1&&s.entities[0].t==='circle'&&!s.constraints.length),'16 : guide dans l’esquisse du perçage : chaque copie ne garde que le cercle, esquisse copiée jamais affichée — '+K3.map(s=>s.entities.map(e=>e.t).join('+')+(s.visible===false?'':' (visible)')).join(' | '));
    A(H.entities.length===3&&H.visible===true,'17 : l’esquisse d’origine garde sa courbe guide et reste affichée');
    A(near(vol(),plein-5*trou,1e-3),'18 : volume exact, 5 perçages le long de la courbe — '+vol().toFixed(3));
    // ── 10. esquisse posée sur la face du dessus (V0.30.3) : les copies gardent CETTE face ──
    H.plane='FACE';H.host={feat:'F1',tag:'TOP',x:0,y:0,name:'Face dessus'};
    repGenChildren(rp3);markDirty();rebuild();
    const K4=doc.features.filter(f=>f.repeatId==='rp3').map(k=>doc.sketches.find(x=>x.id===k.sketchId));
    A(K4.length===4&&K4.every(s=>s.host&&s.host.feat==='F1'&&s.host.name==='Face dessus'&&near(s.host.x,s.origin[0],1e-3)&&near(s.host.y,s.origin[1],1e-3)),'19 : chaque copie reste sur la face de l’esquisse d’origine, décalée sur cette face — '+K4.map(s=>JSON.stringify(s.host)).join(' | '));
    doc.features.find(f=>f.id==='F1').distance=14;markDirty();rebuild();
    A(K4.every(s=>near(s.origin[2],14,1e-6))&&near(vol(),plein*1.4-5*trou,1e-3),'20 : pièce épaissie à 14 : les copies suivent la face, 5 poches de 10 mm — '+vol().toFixed(3));
    return out;
  `;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Répétition suivant un profil ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
