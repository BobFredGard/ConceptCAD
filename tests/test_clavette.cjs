// Rainure de clavette automatique : arbre et alésage, cotes ISO 773 lues sur le Ø, suivi du Ø, formes,
// épaulement, position, annulation, sauvegarde, répétition. Noyau OCCT réel.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(m){window.__al=m;};',ctx);
  const R=`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    const shape=()=>occLive.shape;
    const inside=(x,y,z)=>{const cl=occClassifier(shape());const p=new occt.gp_Pnt_3(x,y,z);cl.Perform(p,1e-6);const r=cl.State()===occt.TopAbs_State.TopAbs_IN;p.delete();cl.delete();return r;};
    const cyls=()=>occSubShapes(shape(),'TopAbs_FACE').filter(x=>occSurfKind(x)==='Cylinder');
    const rond=(id,r,dist,extra)=>({id:'sk'+id,name:id,plane:'YZ',origin:[0,0,0],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],points:{c:{x:0,y:0}},
      entities:[{id:'e1',t:'circle',pc:'c',r}].concat(extra||[]),constraints:[],dims:[],seq:10,visible:false});
    const reset=(sks,fts)=>{doc.sketches=sks;doc.features=fts;doc.bodies=[];doc.cgeo=[];delete doc.activeBody;docUndoStack.length=0;markDirty();rebuild();};
    // Face cylindrique de rayon r → même résultat qu'un clic (pt : point cliqué ; inner : face intérieure)
    const hit=(r,pt,inner)=>{
      const f=cyls().find(x=>{const q=occFaceRefAny(x),g=cgEvalRef({k:'face',ref:q},null);return g.axis&&Math.abs(g.axis.r-r)<1e-6;});
      const ref=occFaceRefAny(f),g=cgEvalRef({k:'face',ref},null),a=g.axis,d=cgCylDir(a.d),w=cgSub(pt,a.o),t=cgDot(w,d);
      return {ref,A:{o:a.o,d,r:a.r},rad:cgUnit(cgSub(w,cgMul(d,t))),t,body:null,inner:!!inner};
    };
    const feat=()=>doc.features.find(f=>f.kw);
    // Sections sur la rainure seule : sans le corps de clavette, qui remplirait le creux contrôlé
    const poser=h=>{const e=kwOnCylinder(h);if(e){kwKeyRemove(e);markDirty();rebuild();}return e;};

    // ── 1. Arbre Ø30 × 80, clic au-dessus : ISO 773 de 22 à 30 → 8 × 7, t1 = 4 ──
    reset([rond('A',15,80)],[{id:'F1',type:'extrude',name:'Arbre',sketchId:'skA',distance:80,op:'add',visible:true}]);
    const el=poser(hit(15,[40,0,15],false)),f=feat();
    A(el&&f&&f.op==='cut'&&el.visible===false,'1a : plan masqué et découpe créés');
    A(el._kwOut.b===8&&el._kwOut.h===7&&el._kwOut.t===4&&el._kwOut.D===30,'1b : Ø30 → clavette 8 × 7, t1 4 (vu '+JSON.stringify(el._kwOut)+')');
    A(el._kwOut.L===45,'1c : longueur automatique de la série, ≤ 1,5 × Ø = 45 (vu '+el._kwOut.L+')');
    A(!el.kw.bore&&el.kw.form==='A','1d : arbre → fermée, bouts ronds');
    A(docUndoStack.length===1,'1e : une seule étape d’annulation ('+docUndoStack.length+')');
    A(builtEngine==='exact'&&!f._err,'1f : rejeu exact '+(f._err||''));
    fdynClose();sel={kind:null,id:null};
    A(!inside(40,0,11.5)&&inside(40,0,10.5),'1g : fond à R − t1 = 11, au dessus de l’axe');
    A(!inside(40,3.9,14)&&inside(40,4.2,13.5),'1h : largeur 8');
    A(!inside(40+22,0,14)&&inside(40+23,0,14),'1i : longueur 45 centrée sur le cylindre, selon l’axe');
    A(inside(40,0,-14)&&inside(40,14,0),'1j : le reste de l’arbre est intact');
    const bouts=occSubShapes(shape(),'TopAbs_FACE').filter(x=>{if(occSurfKind(x)!=='Cylinder')return false;const g=cgEvalRef({k:'face',ref:occFaceRefAny(x)},null);return g.axis&&Math.abs(g.axis.r-4)<1e-6;});
    A(bouts.length===2,'1k : deux bouts ronds de rayon 4 (vu '+bouts.length+')');

    // ── 2. Le Ø change : la rainure change de ligne d'ISO 773, sans rien toucher d'autre ──
    doc.sketches[0].entities[0].r=20;markDirty();rebuild();
    A(el._kwOut.D===40&&el._kwOut.b===12&&el._kwOut.t===5,'2a : Ø40 → 12, t1 5 (vu '+JSON.stringify(el._kwOut)+')');
    A(!inside(40,0,15.5)&&inside(40,0,14.5)&&!inside(40,5.9,19)&&inside(40,6.2,18.5),'2b : la pièce suit : fond 15, largeur 12');
    A(/12 × /.test(f.name)&&/Ø40/.test(f.name),'2c : le nom suit : '+f.name);
    doc.sketches[0].entities[0].r=15;markDirty();rebuild();

    // ── 3. Formes et réglages ──
    el.kw.form='T';markDirty();rebuild();
    A(!inside(0.5,0,14)&&!inside(79.5,0,14)&&inside(40,0,10.5),'3a : toute la longueur, des deux côtés');
    el.kw.form='C';el.kw.end=1;el.kw.L=30;markDirty();rebuild();
    A(!inside(79.5,0,14)&&!inside(51,0,14)&&inside(49,0,14),'3b : débouchante côté +X, longueur 30 depuis le bout');
    el.kw.end=-1;markDirty();rebuild();
    A(!inside(0.5,0,14)&&!inside(29,0,14)&&inside(31,0,14),'3c : débouchante de l’autre côté');
    el.kw.form='B';el.kw.L=20;markDirty();rebuild();
    A(!inside(49.5,3.9,14)&&inside(50.5,3.9,14),'3d : bouts droits : coin plein, longueur 20');
    el.kw.form='A';el.kw.L=100;markDirty();rebuild();
    A(/plus longue/.test(el._kwOut.warn),'3e : trop longue : signalé ('+el._kwOut.warn+')');
    el.kw.L=null;el.kw.iso=false;el.kw.b=6;el.kw.t=2;markDirty();rebuild();
    A(el._kwOut.b===6&&!el._kwOut.iso&&!inside(40,2.9,14)&&inside(40,3.2,13.5)&&inside(40,0,12.5),'3f : cotes manuelles 6 × 2');
    el.kw.iso=true;markDirty();rebuild();

    // ── 4. Position : direction −Y, cote depuis une face ──
    el.refs[1]={k:'o',id:'Y'};el.p.a=180;markDirty();rebuild();
    A(!inside(40,-14,0)&&inside(40,0,14),'4a : la rainure passe du côté −Y');
    el.refs[1]={k:'o',id:'Z'};el.p.a=0;
    const fx0=occSubShapes(shape(),'TopAbs_FACE').find(x=>occSurfKind(x)==='Plane'&&Math.abs(occFaceBox(x).pos[0])<1e-3);
    el.refs[2]={k:'face',ref:occFaceRefAny(fx0),name:'face'};el.p.d=30;el.p.side=1;markDirty();rebuild();
    A(!inside(30,0,14)&&!inside(50,0,14)&&inside(54,0,14),'4b : centrée à 30 de la face X0');
    A(!el._kwOut.warn,'4c : tient dans le cylindre, sans alerte');
    el.p.d=5;markDirty();rebuild();
    A(/dépasse/.test(el._kwOut.warn),'4d : déplacée au bord : signalé');
    el.refs[2]=null;el.p.d=0;markDirty();rebuild();

    // ── 5. Panneau ──
    const flat=n=>{const o=[];(function w(x){o.push(x);(x.children||[]).forEach(w);})(n);return o;};
    const pnl=document.createElement('div');sel={kind:'feature',id:f.id};kwPanel(pnl,f);
    const all=flat(pnl),tx=all.map(n=>n.textContent||'').join('|');
    A(/ISO 773 : clavette 8 × 7/.test(tx)&&/Position sur le cylindre/.test(tx)&&/Cote \\(mm\\)/.test(tx),'5a : panneau : cotes ISO et position');
    A(!/profondeur se compte/.test(tx),'5b : pas la note propre au perçage');
    fdynClose();el.kw.form='T';markDirty();rebuild();
    const pnl2=document.createElement('div');kwPanel(pnl2,f);
    A(!/Cote \\(mm\\)/.test(flat(pnl2).map(n=>n.textContent||'').join('|')),'5c : toute la longueur : pas de cote');
    fdynClose();el.kw.form='A';sel={kind:null,id:null};markDirty();rebuild();
    A(extDynFeature()===null,'5d : pas la fenêtre de l’extrusion');

    // ── 6. Sauvegarde ──
    const J=serialise();
    await deserialise(J,{rebuild:false});markDirty();rebuild();
    const el2=doc.cgeo.find(c=>c.kw),f2=feat();
    A(el2&&f2&&el2.kw.form==='A'&&el2._kwOut.b===8&&!inside(40,0,14)&&inside(40,0,10.5),'6a : relue : réglages et rainure identiques');
    doc.sketches[0].entities[0].r=20;markDirty();rebuild();
    A(el2._kwOut.b===12&&!inside(40,0,16)&&inside(40,0,14.5),'6b : relue, elle suit toujours le Ø');
    doc.sketches[0].entities[0].r=15;markDirty();rebuild();

    // ── 7. Annulation ──
    reset([rond('A',15,80)],[{id:'F1',type:'extrude',name:'Arbre',sketchId:'skA',distance:80,op:'add',visible:true}]);
    kwOnCylinder(hit(15,[40,0,15],false));
    fdynCancel();markDirty();rebuild();
    A(doc.sketches.length===1&&!(doc.cgeo||[]).length&&!feat()&&docUndoStack.length===0&&inside(40,0,14)&&(doc.bodies||[]).length<=1,'7a : Échap retire tout');
    kwOnCylinder(hit(15,[40,0,15],false));fdynClose();
    docUndo();
    A(doc.sketches.length===1&&!(doc.cgeo||[]).length&&!feat()&&doc.features.length===1&&(doc.bodies||[]).length<=1,'7b : Ctrl+Z retire tout d’un coup');
    selFaces=[];sel={kind:null,id:null};
    kwStart();
    A(holeFacePick&&holeFacePick.which==='cylKw','7c : bouton sans sélection : attend un clic');
    holeFacePickCancel();

    // ── 8. Alésage Ø30 dans un moyeu Ø80 × 40 : ISO t2 = 3,3, sur toute la longueur ──
    const trou=rond('B',15,42);trou.origin=[-1,0,0];
    reset([rond('H',40,40),trou],[{id:'F1',type:'extrude',name:'Moyeu',sketchId:'skH',distance:40,op:'add',visible:true},
      {id:'F2',type:'extrude',name:'Alésage',sketchId:'skB',distance:42,op:'cut',visible:true}]);
    A(!inside(20,0,0)&&inside(20,0,20),'8a : moyeu percé');
    const eb=poser(hit(15,[20,0,15],true)),fb=feat();
    fdynClose();sel={kind:null,id:null};
    A(eb&&eb.kw.bore&&eb.kw.form==='T','8b : face intérieure → alésage, toute la longueur');
    A(eb._kwOut.b===8&&eb._kwOut.t===3.3,'8c : Ø30 → 8, t2 3,3 (vu '+JSON.stringify(eb._kwOut)+')');
    A(!fb._err&&!inside(20,0,18.2)&&inside(20,0,18.4),'8d : fond à R + t2 = 18,3');
    A(!inside(0.5,0,16)&&!inside(39.5,0,16),'8e : débouche des deux côtés');
    A(!inside(20,3.9,15.5)&&inside(20,4.2,15.5),'8f : largeur 8, flancs nets jusqu’à l’alésage');
    A(inside(20,0,-16)&&inside(20,16,0),'8g : le reste du moyeu est intact');
    A(!eb._kwOut.warn,'8h : pas d’alerte');
    // moyeu trop mince : signalé
    doc.sketches[0].entities[0].r=17;markDirty();rebuild();
    A(/mince/.test(eb._kwOut.warn),'8i : moyeu Ø34 : signalé ('+eb._kwOut.warn+')');
    doc.sketches[0].entities[0].r=40;markDirty();rebuild();
    // l'alésage change : la rainure suit
    doc.sketches[1].entities[0].r=20;markDirty();rebuild();
    A(eb._kwOut.b===12&&eb._kwOut.t===3.3&&!inside(20,0,23.2)&&inside(20,0,23.4),'8j : alésage Ø40 → 12, t2 3,3 : le fond suit');

    // ── 9. Arbre épaulé Ø30 puis Ø50 : la rainure débouchante s'arrête contre l'épaulement ──
    const gros=rond('G',25,30);gros.origin=[40,0,0];
    reset([rond('A',15,40),gros],[{id:'F1',type:'extrude',name:'Bout',sketchId:'skA',distance:40,op:'add',visible:true},
      {id:'F2',type:'extrude',name:'Épaulement',sketchId:'skG',distance:30,op:'add',visible:true}]);
    const es=poser(hit(15,[20,0,15],false));fdynClose();sel={kind:null,id:null};
    es.kw.form='T';markDirty();rebuild();
    A(!inside(0.5,0,14)&&!inside(39.5,0,14)&&inside(40.5,0,14),'9a : s’arrête à fleur de l’épaulement, sans l’entamer');
    A(es._kwOut.L===40,'9b : longueur du seul cylindre cliqué : 40 (vu '+es._kwOut.L+')');

    // ── 10. Hors norme : Ø200, cotes proposées et signalées ──
    reset([rond('A',100,80)],[{id:'F1',type:'extrude',name:'Gros',sketchId:'skA',distance:80,op:'add',visible:true}]);
    const eh=poser(hit(100,[40,0,100],false));fdynClose();sel={kind:null,id:null};
    A(eh&&/hors d’ISO 773/.test(eh._kwOut.warn)&&!inside(40,0,99),'10a : Ø200 hors norme : signalé, rainure quand même creusée');

    // ── 11. Répétition circulaire : deux rainures à 180° ──
    reset([rond('A',15,80)],[{id:'F1',type:'extrude',name:'Arbre',sketchId:'skA',distance:80,op:'add',visible:true}]);
    poser(hit(15,[40,0,15],false));fdynClose();sel={kind:null,id:null};
    A(repCanFeature(feat().id),'11a : la rainure est répétable');
    const rp={id:'rp1',type:'repeat',name:'R',q:1,base:[feat().id],children:[],visible:true,mode:'circ',copies:1,angle:180,axis:'X'};
    doc.features.push(rp);repGenChildren(rp);markDirty();rebuild();
    A(!inside(40,0,14)&&!inside(40,0,-14)&&inside(40,14,0),'11b : deux rainures à 180°');
    doc.sketches[0].entities[0].r=20;markDirty();rebuild();
    A(!inside(40,0,16)&&!inside(40,0,-16)&&inside(40,0,14.5)&&inside(40,0,-14.5)&&inside(40,19,0),'11c : Ø40 : les deux rainures suivent');

    // ── 12. La clavette, corps séparé : arbre Ø30, 8 × 7 × 45, fond à 11, sommet à 18 ──
    const solides=()=>{const L=occSubShapes(shape(),'TopAbs_SOLID'),n=L.length;occDispose(L);return n;};
    const arbre=()=>reset([rond('A',15,80)],[{id:'F1',type:'extrude',name:'Arbre',sketchId:'skA',distance:80,op:'add',visible:true}]);
    arbre();
    const u0=docUndoStack.length,ek=kwOnCylinder(hit(15,[40,0,15],false));fdynClose();sel={kind:null,id:null};
    const kk=()=>doc.features.find(f=>f.kwKey);
    const act0=doc.activeBody;
    A(ek.kw.key&&kk()&&kk().newBody&&kk().body!==feat().body,'12a : clavette créée d’office, dans son propre corps');
    A(docUndoStack.length===u0+1,'12b : toujours une seule étape d’annulation ('+(docUndoStack.length-u0)+')');
    A(solides()===2&&doc.bodies.length===2,'12c : deux solides, deux corps (vu '+solides()+', '+doc.bodies.length+')');
    A(doc.bodies.some(b=>b.name==='Clavette 8 × 7 × 45'),'12d : corps nommé (vu '+doc.bodies.map(b=>b.name)+')');
    A(doc.activeBody===act0&&feat().body===doc.activeBody,'12e : le corps actif reste la pièce');
    A(inside(40,0,17.5)&&!inside(40,0,18.5)&&inside(40,0,11.5),'12f : du fond (11) au sommet (18)');
    A(inside(40,3.9,17)&&!inside(40,4.1,17),'12g : largeur 8');
    A(inside(40+22,0,17)&&!inside(40+23,0,17),'12h : longueur 45, le long de l’axe');
    doc.sketches[0].entities[0].r=20;markDirty();rebuild();
    A(inside(40,0,22.5)&&!inside(40,0,23.5)&&inside(40,5.9,22)&&!inside(40,6.1,22),'12i : Ø40 : clavette 12 × 8, fond 15, sommet 23');
    A(doc.bodies.some(b=>/^Clavette 12 × 8/.test(b.name)),'12j : le nom suit');
    doc.sketches[0].entities[0].r=15;markDirty();rebuild();
    // un nom donné à la main reste
    doc.bodies.find(b=>/^Clavette/.test(b.name)).name='Ma clavette';markDirty();rebuild();
    A(doc.bodies.some(b=>b.name==='Ma clavette'),'12k : un nom donné à la main reste');
    // formes
    ek.kw.form='T';markDirty();rebuild();
    A(inside(40,0,17)&&!inside(40,0,18.5)&&!inside(40-23,0,17)&&!inside(0.5,0,14),'12l : toute la longueur : clavette droite, centrée, plus courte que la rainure');
    ek.kw.form='C';ek.kw.end=1;ek.kw.L=30;markDirty();rebuild();
    A(inside(79.5,0,17)&&!inside(80.5,0,17)&&!inside(49,0,17),'12m : débouchante : clavette à fleur du bout, longueur 30');
    ek.kw.form='A';ek.kw.L=null;markDirty();rebuild();
    // panneau : décocher retire le corps, cocher le rend
    const pk=document.createElement('div');sel={kind:'feature',id:feat().id};kwPanel(pk,feat());
    const fl=n=>{const o=[];(function w(x){o.push(x);(x.children||[]).forEach(w);})(n);return o;};
    const cb=fl(pk).find(n=>n.title&&/corps séparé/.test(n.title));
    A(cb&&cb.checked,'12n : case cochée');
    const uu=docUndoStack.length;cb.checked=false;cb.onchange();
    A(!kk()&&doc.bodies.length===1&&solides()===1&&!inside(40,0,14)&&docUndoStack.length===uu+1,'12o : décochée : plus de corps, la rainure est vide, une étape');
    docUndo();
    A(kk()&&doc.bodies.length===2&&solides()===2,'12p : Ctrl+Z : la clavette revient');
    fdynClose();sel={kind:null,id:null};
    // sauvegarde
    const Jk=serialise();await deserialise(Jk,{rebuild:false});markDirty();rebuild();
    A(kk()&&solides()===2&&inside(40,0,17.5)&&!inside(40,0,18.5),'12q : relue : clavette en place');
    // suppression
    const ek2=doc.cgeo.find(c=>c.kw);
    delFeature(kk());markDirty();rebuild();
    A(!kk()&&feat()&&!ek2.kw.key&&doc.bodies.length===1&&!doc.cgeo.some(c=>c.kwKeyOf)&&!inside(40,0,14),'12r : supprimer la clavette garde la rainure');
    kwKeyAdd(ek2);markDirty();rebuild();
    A(kk()&&solides()===2,'12s : on peut la reposer');
    const nSk=doc.sketches.length;
    delFeature(feat());markDirty();rebuild();
    A(!kk()&&doc.bodies.length===1&&solides()===1&&inside(40,0,14)&&doc.sketches.length===nSk-1,'12t : supprimer la rainure retire sa clavette');
    // alésage Ø30 : du fond 18,3 vers l'axe, hauteur 7 → 11,3 ; clavette 36 centrée sur le moyeu de 40
    const tr2=rond('B',15,42);tr2.origin=[-1,0,0];
    reset([rond('H',40,40),tr2],[{id:'F1',type:'extrude',name:'Moyeu',sketchId:'skH',distance:40,op:'add',visible:true},
      {id:'F2',type:'extrude',name:'Alésage',sketchId:'skB',distance:42,op:'cut',visible:true}]);
    const ebk=kwOnCylinder(hit(15,[20,0,15],true));fdynClose();sel={kind:null,id:null};
    A(ebk._kwOut.Lk===36&&solides()===2,'12u : alésage : clavette 36 (vu '+ebk._kwOut.Lk+')');
    A(inside(20,0,12)&&!inside(20,0,11)&&inside(20,0,18)&&inside(3,0,12)&&!inside(1,0,12),'12v : du fond 18,3 vers l’axe jusqu’à 11,3, centrée');
    return out;`;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Rainure de clavette automatique ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
