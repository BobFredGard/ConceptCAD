// V0.99.82 : fenêtre « ⚠ Liens perdus » d'une esquisse (50-esquisse-97), comme Fusion. Demande de Fred :
// « quand une ou des arêtes ou faces manquent pour une esquisse, l'outil nous propose une fenêtre qui les
// recense et nous propose de les réattribuer », « ou de supprimer tout lien ou supprimer l'arête aussi »,
// « à chaque Réattribuer, il faut cacher la fenêtre pour accéder à la vue 3D ».
// Banc sans noyau : arêtes de la pièce fournies par un faux solide ({edges}), comme test_projeter_appui_long.
// Une projetée P (y=0) porte une ligne L parallèle cotée à 10 mm : Réattribuer P sur l'arête y=5 doit
// garder la cote (L passe à y=15) ; Couper la garde aussi ; Supprimer l'emporte.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};
    confirm=function(){return true;};alert=function(){};
    const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
    docResetEmpty();doc.name='Banc';
    const ligne=(x0,x1,y)=>{const p=[];for(let i=0;i<=10;i++)p.push([x0+(x1-x0)*i/10,y,0]);return {pts:p,mid:[(x0+x1)/2,y,0]};};
    const cercle=(cx,cy,r)=>{const p=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI*2;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a),0]);}return {pts:p,mid:[cx+r,cy,0]};};
    const sk={id:'skA',name:'Esquisse A',plane:'XY',visible:true,origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[],seq:1};
    doc.sketches.push(sk);migrateSketch(sk);
    // projetée P (y=0, x 0 → 20) + ligne L parallèle à 10 mm
    const nouvelle=()=>{
      const eid=skProjectCreate(sk,{type:'line',x1:0,y1:0,x2:20,y2:0,srcMid:[10,0,0]});
      const P=entById(sk,eid);P.srcNom='F1|F2';
      const a=addPoint(sk,0,10),b=addPoint(sk,20,10),lid=skNewEid(sk);
      sk.entities.push({id:lid,t:'line',p1:a,p2:b});
      sk.constraints.push({id:skNewEid(sk),type:'parallel',a:P.id,b:lid});
      sk.dims.push({id:skNewEid(sk),type:'gap',a:P.id,b:lid,value:10,ox:0,oy:0});
      solveSketch(sk);
      return {P,L:entById(sk,lid)};
    };
    const perdre=e=>nomsPerteNote(sk.id+'/'+e.id,sk.name+' : l’arête projetée n’existe plus près de (10.0, 0.0, 0.0) — recherche par position');
    let {P,L}=nouvelle();perdre(P);
    // ── 1. recensement ──
    let Li=lpListe(sk);
    att(Li.length===1&&Li[0].eid===P.id&&Li[0].verif&&Li[0].reat&&Li[0].garder&&Li[0].couper&&Li[0].suppr,'1 : la projetée perdue est recensée, « à vérifier », 4 actions');
    att(/Projetée \\d+ · Arête \\d+/.test(Li[0].nom)&&/raccrochée à la plus proche/.test(Li[0].raison),'2 : libellé « '+Li[0].nom+' — '+Li[0].raison+' »');
    att(lpResume(sk)==='1 arête à vérifier','3 : résumé du ⚠ de l’arbre : « '+lpResume(sk)+' »');
    // ── 4. Garder ──
    lpOuvrir(sk.id);
    att(!!lpEtat&&lpEtat.sk===sk.id&&!lpEtat.cache,'4 : la fenêtre s’ouvre');
    lpGarder(lpListe(sk)[0]);
    att(!P.srcNom&&!NOMS_PERTES_ESQ.has(sk.id+'/'+P.id)&&P.proj,'5 : Garder : nom perdu oublié, elle reste projetée');
    att(lpEtat===null&&lpResume(sk)===null,'6 : plus rien de perdu : fenêtre fermée, plus de ⚠');
    // ── 7. Couper le lien ──
    P.srcNom='F1|F2';perdre(P);lpOuvrir(sk.id);
    lpCouper(lpListe(sk)[0]);
    att(!P.proj&&!P.srcMid&&!P.srcNom&&!P.projName&&P.sansLien===1,'7 : Couper : plus aucun lien');
    att(sk.constraints.some(c=>c.type==='fix'&&c.p===P.p1)&&sk.constraints.some(c=>c.type==='fix'&&c.p===P.p2),'8 : Couper : ses deux bouts restent fixés (📌)');
    att(!projEstProjetee(sk,P),'9 : Couper : la règle « ligne de construction aux 2 bouts fixes » ne la reprend pas');
    att(sk.dims.some(d=>d.type==='gap'&&d.a===P.id)&&near(sk.points[P.p1].y,0),'10 : Couper : elle reste à sa place, sa cote reste');
    att(lpEtat===null,'11 : liste vide : fenêtre fermée');
    // ── 12. Supprimer ──
    ({P,L}=nouvelle());perdre(P);
    const p=lpPerdus(sk,P);
    att(p.cotes===1&&p.contraintes===1,'12 : Supprimer emporterait 1 cote et 1 contrainte ('+p.cotes+', '+p.contraintes+')');
    lpOuvrir(sk.id);
    let demande='';confirm=function(m){demande=m;return true;};
    lpSupprimer(lpListe(sk)[0]);
    att(/1 cote et 1 contrainte/.test(demande),'13 : confirmation : « '+demande.replace(/\\n/g,' ')+' »');
    att(!entById(sk,P.id)&&!sk.dims.some(d=>d.a===P.id)&&!!entById(sk,L.id),'14 : Supprimer : la projetée et sa cote partent, la ligne reste');
    att(!sk.constraints.some(c=>c.type==='fix'&&(c.p===P.p1||c.p===P.p2)),'15 : Supprimer : ses « fixe » partent avec elle');
    confirm=function(){return true;};
    // ── 16. Réattribuer, esquisse ouverte, vrai clic ──
    ({P,L}=nouvelle());perdre(P);
    const piece={edges:[ligne(0,20,5),cercle(60,0,4)]};
    const _occHas=occHas,_occRefShape=occRefShape,_occLive=occLive;
    occHas=()=>true;occRefShape=()=>piece;occLive={shape:piece};
    lpFermer();
    openSketch('skA');skView.s=4;skUpdateTols();
    att(!!lpEtat&&lpEtat.sk==='skA'&&!lpEtat.cache,'16 : ouverture de l’esquisse : la fenêtre s’ouvre seule');
    const it=lpListe(skEdit).find(x=>x.eid===P.id);
    lpReattribuer(it);
    att(lpEtat&&lpEtat.cache&&skLienRe&&skLienRe.eid===P.id&&skTool==='project','17 : Réattribuer : fenêtre cachée, outil Projeter en attente du clic');
    const C=(wx,wy)=>{const r=svg.getBoundingClientRect();const q=w2s(wx,wy);return [r.left+q[0],r.top+q[1]];};
    const ev=(type,x,y,extra)=>{const r=Object.assign({type:type,button:0,buttons:0,shiftKey:false,pointerType:'mouse',
      ctrlKey:false,altKey:false,detail:1,pointerId:1,preventDefault:function(){},stopPropagation:function(){},stopImmediatePropagation:function(){}},extra||{});
      r.clientX=x;r.clientY=y;return r;};
    const clic=(wx,wy)=>{const q=C(wx,wy);svg.dispatchEvent(ev('pointerdown',q[0],q[1],{buttons:1}));svg.dispatchEvent(ev('pointerup',q[0],q[1]));};
    const nEnt=skEdit.entities.length;
    clic(60,4); // le cercle : pas le bon genre
    att(skLienRe&&skLienRe.eid===P.id&&near(skEdit.points[P.p1].y,0),'18 : un cercle pour une ligne : refusé, on attend toujours');
    att(/il faut une arête droite/.test((document.getElementById('skStatus')||{}).textContent||skMsg),'19 : message : « '+skMsg+' »');
    clic(10,5.05);
    const P2=entById(skEdit,P.id);
    att(!skLienRe&&skEdit.entities.length===nEnt&&!!P2,'20 : arête cliquée : même élément (rien de créé), Réattribuer fini');
    att(near(skEdit.points[P2.p1].y,5,1e-6)&&near(skEdit.points[P2.p2].y,5,1e-6)&&P2.srcMid&&near(P2.srcMid[1],5),'21 : la projetée est posée sur l’arête y=5 et la suit');
    att(near(skEdit.points[L.p1].y,15,1e-3)&&skEdit.dims.some(d=>d.type==='gap'&&d.a===P.id),'22 : sa cote est gardée : la ligne parallèle passe à y=15 (y='+(+skEdit.points[L.p1].y).toFixed(3)+')');
    att(!NOMS_PERTES_ESQ.has('skA/'+P.id)&&lpEtat===null,'23 : plus de perte : la fenêtre ne revient pas (rien à régler)');
    // ── 24. Réattribuer puis Échap : la fenêtre revient ──
    P2.srcNom='X';perdre(P2);lpOuvrir('skA');
    lpReattribuer(lpListe(skEdit)[0]);
    att(lpEtat.cache,'24 : Réattribuer : fenêtre cachée');
    skEscapeToSelect(); // ce que fait Échap dans l'esquisse (60) — le banc ne sait pas que #sketchOverlay est « open »
    att(!skLienRe&&lpEtat&&!lpEtat.cache&&skTool==='select','25 : Échap : Réattribuer annulé, la fenêtre revient');
    // survol d'une ligne : l'élément s'allume (dessin appelé sans erreur)
    lpSurvol={sk:'skA',eid:P2.id};let ok=true;try{drawSketch2D();}catch(e){ok=false;}
    att(ok,'26 : survol : dessin de l’élément allumé sans erreur');lpSurvol=null;
    lpFermer();
    closeSketch(true);
    occHas=_occHas;occRefShape=_occRefShape;occLive=_occLive;
    // ── 27. face porteuse ──
    const F={id:'skF',name:'Esquisse F',plane:'FACE',visible:true,origin:[0,0,10],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
      host:null,hostFace:{nom:'Fx',pos:[0,0,10],name:'Face 9'},points:{},entities:[],constraints:[],dims:[],seq:1};
    doc.sketches.push(F);migrateSketch(F);
    nomsPerteNote('skF/face','Esquisse F : sa face porteuse n’existe plus près de (0.0, 0.0, 10.0) — plan gardé');
    Li=lpListe(F);
    att(Li.length===1&&Li[0].k==='face'&&Li[0].reat&&Li[0].couper&&!Li[0].suppr,'27 : face perdue recensée (Réattribuer, Couper, pas Supprimer)');
    att(/face porteuse n’existe plus/.test(lpResume(F)),'28 : résumé : « '+lpResume(F)+' »');
    lpOuvrir('skF');lpReattribuer(lpListe(F)[0]);
    att(skRedef&&skRedef.id==='skF'&&lpEtat.cache,'29 : Réattribuer la face : « Changer de face » armé, fenêtre cachée');
    window.dispatchEvent({type:'keydown',key:'Escape',preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});
    att(!skRedef&&lpEtat&&!lpEtat.cache,'30 : Échap : la fenêtre revient');
    lpCouper(lpListe(F)[0]);
    att(F.planFige===1&&!F.hostFace&&F.host===null&&skFacePerdue(F)===null,'31 : Couper : plan figé, plus de face perdue');
    att(/^plan figé @/.test(sketchFaceLabel(F)),'32 : libellé : « '+sketchFaceLabel(F)+' »');
    att(!skFaceNommeeSuit(F)&&F.origin[2]===10,'33 : plan figé : il ne cherche plus de face');
    lpFermer();
    // ── 34. trait d'une autre esquisse supprimé ──
    const S={id:'skS',name:'Esquisse S',plane:'XY',visible:true,origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[],seq:1};
    doc.sketches.push(S);migrateSketch(S);
    const s1=addPoint(S,0,30),s2=addPoint(S,20,30),s3=addPoint(S,0,40),s4=addPoint(S,20,40);
    S.entities.push({id:'eS1',t:'line',p1:s1,p2:s2},{id:'eS2',t:'line',p1:s3,p2:s4});
    const T={id:'skT',name:'Esquisse T',plane:'XY',visible:true,origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[],seq:1};
    doc.sketches.push(T);migrateSketch(T);
    const tid=skpCreer(T,{type:'line',x1:0,y1:30,x2:20,y2:30,srcName:'Esquisse S',skSrc:{sk:'skS',ent:'eS1'}});
    S.entities=S.entities.filter(e=>e.id!=='eS1');
    skpNotesPurge();skpTrack(T,entById(T,tid));
    Li=lpListe(T);
    att(Li.length===1&&Li[0].reat&&!Li[0].verif&&/élément source n’existe plus — figée/.test(Li[0].raison),'34 : trait source supprimé : « '+(Li[0]&&Li[0].raison)+' »');
    openSketch('skT');
    att(lpEtat&&lpEtat.sk==='skT','35 : ouverture : la fenêtre s’ouvre');
    lpReattribuer(lpListe(skEdit)[0]);
    const pr=skpHit(skEdit,10,40);
    lpReChoix(skEdit,pr);
    const t2=entById(skEdit,tid);
    att(t2&&t2.skSrc&&t2.skSrc.ent==='eS2'&&near(skEdit.points[t2.p1].y,40)&&!NOMS_PERTES_ESQ.has('skp:skT/'+tid),'36 : réattribuée au 2ᵉ trait de S (y=40), plus d’avertissement');
    closeSketch(true);
    // ── 37. arête d'une autre pièce : instance disparue ──
    asmEnsure();
    const X={id:'skX',name:'Esquisse X',plane:'XY',visible:true,origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[],seq:1};
    doc.sketches.push(X);migrateSketch(X);
    const xid=skProjectCreate(X,{type:'line',x1:0,y1:0,x2:5,y2:0,srcMid:[2.5,0,0],ext:{ctx:[],path:['absente']}});
    const ex=entById(X,xid);
    lpNoteExt(X,ex,false);
    Li=lpListe(X);
    att(Li.length===1&&/n’est plus dans l’assemblage/.test(Li[0].raison)&&Li[0].reat,'37 : arête d’une pièce absente de l’assemblage : « '+(Li[0]&&Li[0].raison)+' »');
    lpNoteExt(X,ex,true);
    att(!lpListe(X).length,'38 : pièce revenue : l’avertissement part');
    // ── 39. tout couper / tout supprimer ──
    lpNoteExt(X,ex,false);
    const xid2=skProjectCreate(X,{type:'circle',cx:0,cy:0,r:3,srcMid:[3,0,0]});const ex2=entById(X,xid2);ex2.srcNom='n';
    nomsPerteNote('skX/'+xid2,'Esquisse X : l’arête projetée n’existe plus près de (3.0, 0.0, 0.0) — recherche par position');
    lpOuvrir('skX');
    att(lpListe(X).length===2,'39 : deux éléments perdus dans X');
    lpToutSupprimer();
    att(!entById(X,xid)&&!entById(X,xid2)&&lpEtat===null,'40 : Supprimer les éléments perdus : les deux partent, fenêtre fermée');
    // ── 41. document suivant : rien ne reste ──
    nomsPerteNote('skA/e1','reste');lpOuvrir('skX');
    docResetEmpty();
    att(NOMS_PERTES_ESQ.size===0&&lpEtat===null,'41 : nouveau document : avertissements et fenêtre effacés');
    return {ATT,OK};
  `;
  const o=await vm.runInContext('(async function(){'+R+'})()',ctx);
  console.log('=== V0.99.82 : esquisse — fenêtre des liens perdus ===');
  o.OK.forEach(m=>console.log('  ✓ '+m));
  if(o.ATT.length){o.ATT.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.ATT.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
  process.exit(0);
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
