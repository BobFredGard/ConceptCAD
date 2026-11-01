// Répétitions de composants (48-assemblage-repetitions.js, V0.29.0), modèle seul, sans noyau :
// linéaire 1 et 2 directions, circulaire, symétrie (repère indirect) et symétrie double ;
// associativité (la source bouge, le repère de référence bouge), identifiants stables,
// instance supprimée (skip), source supprimée (instances et composant purgés), annuler,
// aller-retour du fichier, insertion (identifiants renouvelés), instance non déplaçable.
// Avec : liens externes vérifiés par date et taille (47-composants-lies), brouillon trop gros
// pour le stockage local écrit dans IndexedDB (90 : autosaveWrite / draftRestore).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    confirm=function(){return true;};
    const near=(a,b,t)=>Array.isArray(a)&&a.length===3&&a.every((x,i)=>Math.abs(x-b[i])<(t||1e-7));
    const V=(a,b,msg)=>att(near(a,b),msg+' : vu ['+(a||[]).map(x=>+(+x).toFixed(6)).join(', ')+'] attendu ['+b.map(x=>+(+x).toFixed(6)).join(', ')+']');
    const det=F=>F.x[0]*(F.y[1]*F.z[2]-F.y[2]*F.z[1])-F.y[0]*(F.x[1]*F.z[2]-F.x[2]*F.z[1])+F.z[0]*(F.x[1]*F.y[2]-F.x[2]*F.y[1]);
    const FR=(id,name,o)=>({id,kind:'frame',how:'zx',name,refs:[],p:{},at:null,visible:true,fr:{o,x:[1,0,0],y:[0,1,0],z:[0,0,1]},st:'ok',msg:''});
    docResetEmpty();doc.name='Banc';
    doc.cgeo.push(FR('ref','Repère R',[0,0,0]));
    asmEnsure();
    const Rt=asmRoot();
    const nv=asmNewComp('Vis');const Vs=nv.comp,oV=nv.occ;
    oV.fr={o:[10,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
    const inst=pid=>Rt.occ.filter(o=>o.pat&&o.pat.id===pid);
    // ── linéaire : 4 au total, pas 20 le long de X ──
    const L1=asmPatNew(Rt,[oV.id],'lin');L1.copies=3;L1.dist=20;L1.axis='X';
    asmResolve();
    let I=inst(L1.id);
    att(I.length===3,'linéaire : 3 instances (4 au total) — vu '+I.length);
    V(I[0].fr.o,[30,0,0],'linéaire : 1re instance');V(I[2].fr.o,[70,0,0],'linéaire : 3e instance');
    att(I.every(o=>o.comp===Vs.id&&!o.align),'linéaire : occurrences du même composant, sans liaison');
    att(asmCompOccs(Vs.id).length===4,'4 occurrences du composant Vis');
    att(new Set(asmCompOccs(Vs.id).map(o=>o.name)).size===4,'noms des instances tous différents : '+asmCompOccs(Vs.id).map(o=>o.name).join(', '));
    att(Rt.occ.indexOf(I[0])===Rt.occ.indexOf(oV)+1,'instances rangées après leur source');
    const ids0=I.map(o=>o.id).join(',');
    // associatif : la source bouge → les instances suivent, mêmes identifiants
    oV.fr={o:[10,5,0],x:[0,1,0],y:[-1,0,0],z:[0,0,1]};asmResolve();
    I=inst(L1.id);
    V(I[1].fr.o,[50,5,0],'la source bouge : l instance suit');V(I[1].fr.x,[0,1,0],'la source tourne : l instance aussi');
    att(I.map(o=>o.id).join(',')===ids0,'identifiants des instances stables');
    att(!asmMovable(I[0])&&asmMovable(oV),'instance non déplaçable, source déplaçable');
    // 2 directions : 4 × 2
    L1.lin2=true;L1.axis2='Y';L1.copies2=1;L1.dist2=15;asmResolve();
    I=inst(L1.id);
    att(I.length===7,'grille 4 × 2 : 7 instances — vu '+I.length);
    att(I.some(o=>near(o.fr.o,[70,20,0])),'grille : case (3,1) en [70,20,0]');
    att(I.map(o=>o.id).slice(0,3).join(',')===ids0,'grille : les instances de la 1re rangée gardent leur identifiant');
    delete L1.lin2;asmResolve();att(inst(L1.id).length===3,'2e direction retirée : retour à 3 instances');
    // le repère de référence (associatif) : direction X d'un repère tourné
    L1.ref={cg:'ref'};doc.cgeo[0].fr={o:[0,0,0],x:[0,1,0],y:[-1,0,0],z:[0,0,1]};asmResolve();
    V(inst(L1.id)[0].fr.o,[10,25,0],'référence tournée : la direction suit le repère');
    doc.cgeo=[];asmResolve();
    att(L1.st==='warn'&&inst(L1.id).length===3,'repère de référence disparu : ⚠, instances laissées en place');
    doc.cgeo.push(FR('ref','Repère R',[0,0,0]));L1.ref={cg:null};asmResolve();
    att(L1.st==='ok','repère retrouvé : ⚠ levé');
    // instance supprimée : notée, ne revient pas ; rétablie
    const k1=inst(L1.id)[1];
    asmDeleteOcc(k1.id);
    att(inst(L1.id).length===2&&L1.skip.length===1&&!asmOcc(k1.id),'instance supprimée : notée dans skip');
    asmResolve();att(inst(L1.id).length===2,'instance supprimée : ne revient pas au recalcul');
    L1.skip=[];asmResolve();att(inst(L1.id).length===3,'skip vidé : l instance revient');
    // ── circulaire : 6 au total autour de Z (tour complet) ──
    oV.fr={o:[10,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
    const C1=asmPatNew(Rt,[oV.id],'circ');C1.copies=5;C1.angle=360;C1.axis='Z';asmResolve();
    I=inst(C1.id);
    att(I.length===5,'circulaire : 5 instances');
    V(I[0].fr.o,[10*Math.cos(Math.PI/3),10*Math.sin(Math.PI/3),0],'circulaire : 60°');
    V(I[2].fr.o,[-10,0,0],'circulaire : 180°');
    att(I.every(o=>Math.abs(det(o.fr)-1)<1e-9),'circulaire : repères directs');
    C1.angle=90;C1.copies=2;asmResolve();V(inst(C1.id)[1].fr.o,[0,10,0],'angle partiel : 90° en 2 pas');
    // ── symétrie : plan YZ (normale X) ──
    const M1=asmPatNew(Rt,[oV.id],'mir');M1.axis='X';asmResolve();
    I=inst(M1.id);
    att(I.length===1,'symétrie : 1 instance');
    V(I[0].fr.o,[-10,0,0],'symétrie : position miroir');
    att(Math.abs(det(I[0].fr)+1)<1e-9,'symétrie : repère indirect (déterminant −1)');
    M1.plane2='Y';asmResolve();
    I=inst(M1.id);
    att(I.length===3,'symétrie double : 3 instances');
    const m12=I.find(o=>o.pat.k.endsWith('|m12'));
    att(m12&&near(m12.fr.o,[-10,0,0])&&Math.abs(det(m12.fr)-1)<1e-9,'symétrie double : la diagonale est une rotation (repère direct)');
    // ── annuler ──
    const nPat=Rt.pats.length,nOcc=Rt.occ.length;
    asmPush('test');asmPatDelete(Rt,M1.id);asmResolve();
    att(Rt.pats.length===nPat-1&&Rt.occ.length===nOcc-3,'répétition supprimée : ses instances partent');
    asmUndo();
    att(Rt.pats.length===nPat&&Rt.occ.length===nOcc,'annuler : répétition et instances revenues');
    // ── fichier : aller-retour ──
    const js=serialise();
    await deserialise(js,{rebuild:false});
    const R2=asmRoot();
    att((R2.pats||[]).length===3,'fichier : 3 répétitions relues');
    att(R2.occ.filter(o=>o.pat).length===nOcc-1,'fichier : instances relues');
    const before=JSON.stringify(R2.occ.map(o=>[o.id,o.fr]));
    asmResolve();
    att(JSON.stringify(R2.occ.map(o=>[o.id,o.fr]))===before,'fichier : rien ne bouge au recalcul (positions et identifiants)');
    const bad=JSON.parse(js);bad.asm.comps.find(c=>c.id===R2.id).pats.push({id:'z',type:'??',src:[]},{id:'y',type:'lin',src:['inconnu']});
    await deserialise(JSON.stringify(bad),{rebuild:false});
    asmResolve();
    att((asmRoot().pats||[]).length===3,'fichier abîmé : répétitions inutilisables écartées');
    // ── source supprimée : instances et composant purgés ──
    await deserialise(js,{rebuild:false});
    const R3=asmRoot(),src=R3.occ.find(o=>!o.pat&&o.comp===Vs.id);
    asmDeleteOcc(src.id);
    att(!(R3.pats||[]).length&&!R3.occ.some(o=>o.pat),'source supprimée : répétitions et instances parties');
    att(!asmComp(Vs.id),'source supprimée : composant purgé (plus aucune occurrence)');
    // ── insertion : identifiants renouvelés, répétition intacte ──
    docResetEmpty();doc.name='Atelier';
    let ok=false;try{ok=await asmInsertText(js,'Banc.miniFusion');}catch(e){p('insertion : '+e.message);}
    att(ok===true,'insertion : faite');
    if(ok){
      const ins=asmComp(asmRoot().occ[0].comp);
      const before2=ins.occ.map(o=>o.id).join(',');
      asmResolve();
      att(ins.pats&&ins.pats.length===3&&ins.pats.every(q=>q.src.every(id=>ins.occ.some(o=>o.id===id))),'insertion : sources renommées');
      att(ins.occ.map(o=>o.id).join(',')===before2,'insertion : les instances sont reconnues (clés renommées), rien de recréé');
    }
    // ── liens : date et taille ──
    const Lk={link:{sig:'abc'}};
    att(!asmLinkStampSame(Lk,{lastModified:5,size:9}),'lien jamais relevé : lecture complète');
    asmLinkStamp(Lk,{lastModified:5,size:9});
    att(asmLinkStampSame(Lk,{lastModified:5,size:9}),'même date, même taille : inchangé sans relire');
    att(!asmLinkStampSame(Lk,{lastModified:6,size:9})&&!asmLinkStampSame(Lk,{lastModified:5,size:10}),'date ou taille différente : relu');
    Lk.link.sig='autre';att(!asmLinkStampSame(Lk,{lastModified:5,size:9}),'empreinte changée depuis le relevé : relu');
    Lk.link.sig='abc';Lk.link.st='warn';att(!asmLinkStampSame(Lk,{lastModified:5,size:9}),'lien en ⚠ : relu');
    att(!('_lm' in asmLinkSerial(Lk.link)),'relevé jamais enregistré dans le fichier');
    // ── brouillon trop gros pour le stockage local ──
    const LS={},IDB={};let LIM=200;
    localStorage={getItem(k){return k in LS?LS[k]:null;},setItem(k,v){if(k==='minifusion_auto'&&String(v).length>LIM)throw new Error('quota');LS[k]=String(v);},removeItem(k){delete LS[k];}};
    idbSet=function(k,v){IDB[k]=v;return Promise.resolve();};idbGet=function(k){return Promise.resolve(IDB[k]);};
    indexedDB={};
    LS.minifusion_auto='ancien brouillon';
    att(autosaveWrite()==='idb','gros document : écrit dans IndexedDB');
    att(!('minifusion_auto' in LS)&&+LS.minifusion_auto_idb>0,'gros document : l ancien brouillon local est retiré, sa date notée');
    att(IDB.draft&&IDB.draft.txt===serialise(false),'brouillon complet dans IndexedDB');
    att(await draftRestore()===IDB.draft.txt,'restauration : le brouillon d IndexedDB');
    IDB.draft={at:1,txt:'périmé'};
    att(await draftRestore()===null,'brouillon IndexedDB plus ancien que la date notée : ignoré');
    docResetEmpty();LIM=1e9;
    att(autosaveWrite()==='ls'&&!('minifusion_auto_idb' in LS)&&LS.minifusion_auto,'petit document : stockage local, marque IndexedDB retirée');
    att(await draftRestore()===LS.minifusion_auto,'restauration : le brouillon local');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'repetitions.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
