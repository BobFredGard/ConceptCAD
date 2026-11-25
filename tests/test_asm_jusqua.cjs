// V0.99.94 : « Jusqu'à » une face, une arête ou un sommet d'une AUTRE pièce (48-assemblage-jusqua),
// avec décalage + / − (extrusion, fin de perçage, longueur filetée). Sans noyau : les faces et arêtes
// exactes du socle (_snap.pfaces / pedges, capturées à la fin de son rejeu) sont injectées.
// Distances, décalage, arête parallèle ou non, sommet, suivi du socle déplacé / modifié (capot actif
// et inactif), cible perdue, décalage refusé, perçage, fichier, choix de l'arête au clic.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};
    confirm=function(){return true;};alert=function(){};
    const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
    const at=(o,x)=>{o.fr={o:x,x:[1,0,0],y:[0,1,0],z:[0,0,1]};};
    docResetEmpty();doc.name='Banc';asmEnsure();
    const Rt=asmRoot();
    const A=asmNewComp('Socle').comp,oA=Rt.occ[0];
    const B=asmNewComp('Capot').comp,oB=Rt.occ[1];
    at(oA,[0,0,10]);at(oB,[0,0,0]);
    // socle (dans SON repère) : face plane à Z30, arête parallèle à Z25, arête verticale X5 de Z0 à Z40
    const lineZ=z=>{const p=[];for(let i=0;i<=10;i++)p.push([2*i,0,z]);return {pts:p,mid:[10,0,z],nom:'A'+z};};
    const vert={pts:[[5,5,0],[5,5,20],[5,5,40]],mid:[5,5,20],nom:'V'};
    const inject=(zf,h)=>{A._snap=A._snap||{items:[],edges:null};
      A._snap.pfaces=[{ref:{id:'F1'},nom:'F1',plane:{o:[0,0,zf],n:[0,0,1]}},{ref:{id:'C1'},axis:{o:[3,0,0],d:[0,0,1],rad:2}}];
      A._snap.pedges=[lineZ(zf-5),vert];A._snap.hash=h;};
    inject(30,'h1');
    // capot actif : esquisse sur XY, rectangle, extrusion « jusqu'à » la face du socle
    asmActivatePath([oB.id]);
    const sk={id:'skc',name:'Esquisse capot',plane:'XY',visible:true,origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[],seq:1};
    const P=(x,y)=>addPoint(sk,x,y),p1=P(0,0),p2=P(10,0),p3=P(10,10),p4=P(0,10);
    [[p1,p2],[p2,p3],[p3,p4],[p4,p1]].forEach((q,i)=>sk.entities.push({id:'l'+i,t:'line',p1:q[0],p2:q[1]}));
    doc.sketches.push(sk);
    const mkXf=()=>({k:'xf',ctx:[oB.id],path:[oA.id],ref:{id:'F1'},loc:{plane:{o:[0,0,30],n:[0,0,1]}},name:'Face · '+oA.name,sig:null}),xf=mkXf();
    const f={id:'exj',type:'extrude',name:'',sketchId:'skc',distance:20,op:'add',visible:true,mid:false,upto:{x:xf,side:1}};
    f.name=extName(f);doc.features.push(f);
    markDirty();rebuild();inject(30,'h1');
    const F=()=>B.doc.features.find(x=>x.id==='exj');
    att(asmUptoDispo(),'1 : capot actif dans un assemblage : les autres pièces offrent des cibles');
    att(near(F().distance,40),'2 : jusqu’à la face du socle (Z30 dans le socle, socle à Z10) : 40 mm ('+F().distance+')');
    att(/→ Face · /.test(extName(F())),'3 : nom de la fonction : « → Face · '+oA.name+' » ('+extName(F())+')');
    att(asmExtStale().length===0,'4 : rien à rejouer tant que rien ne bouge');
    // décalage + / −
    F().upto.off=1;resolveExtrudeUpto(F());
    att(near(F().distance,41),'5 : décalage +1 : 41 mm, plus loin que la face');
    F().upto.off=-1;resolveExtrudeUpto(F());
    att(near(F().distance,39)&&/−1/.test(extName(F())),'6 : décalage −1 : 39 mm, nom « −1 » ('+extName(F())+')');
    F().upto.off=-45;const d0=F().distance;const okNeg=resolveExtrudeUpto(F());
    att(!okNeg&&F().upto.err==='décalage'&&near(F().distance,d0),'7 : décalage −45 (repartirait sous l’esquisse) : refusé, distance gardée');
    F().upto.off=-1;resolveExtrudeUpto(F());
    // arête parallèle au plan de l'esquisse : sa hauteur
    const xeA={k:'xe',ctx:[oB.id],path:[oA.id],sub:'edge',pos:[10,0,25],len:20,name:'Arête · '+oA.name,sig:null};
    F().upto={x:xeA,side:1};resolveExtrudeUpto(F());
    att(near(F().distance,35),'8 : jusqu’à une arête parallèle (Z25 + 10) : 35 mm ('+F().distance+')');
    const plA=asmUptoPlane(xeA,[0,0,1]);
    att(plA&&near(plA.n[2],1)&&near(plA.p[2],35),'9 : arête → plan perpendiculaire à la direction, passant par elle');
    // sommet
    const xeV={k:'xe',ctx:[oB.id],path:[oA.id],sub:'vtx',pos:[5,5,20],len:40,vpos:[5,5,40],name:'Sommet · '+oA.name,sig:null};
    F().upto={x:xeV,side:1,off:1};resolveExtrudeUpto(F());
    att(near(F().distance,51),'10 : jusqu’à un sommet (Z40 + 10) avec +1 : 51 mm ('+F().distance+')');
    // arête non parallèle (verticale) : son milieu
    const xeN={k:'xe',ctx:[oB.id],path:[oA.id],sub:'edge',pos:[5,5,20],len:40,name:'Arête · '+oA.name,sig:null};
    const plN=asmUptoPlane(xeN,[0,0,1]);
    att(plN&&near(plN.p[2],30),'11 : arête non parallèle lue par son milieu (Z20 + 10)');
    // retour à la face, décalage −1
    F().upto={x:mkXf(),side:1,off:-1};markDirty();rebuild();inject(30,'h1');
    att(near(F().distance,39),'12 : retour à la face avec −1 : 39 mm');
    // le socle se déplace : capot ACTIF
    asmPush('déplacer');at(oA,[0,0,20]);
    att(asmExtStale().length===1&&asmExtStale()[0]===B,'13 : socle déplacé : capot signalé à rejouer');
    asmExtSync();inject(30,'h1');
    att(near(F().distance,49),'14 : l’extrusion suit le socle déplacé (30 + 20 − 1 = 49) ('+F().distance+')');
    // le socle change (sa face passe à Z35) : capot INACTIF
    asmActivatePath([]);inject(35,'h2');
    att(asmExtStale().includes(B),'15 : socle modifié : capot inactif signalé');
    asmExtSync();
    att(near(F().distance,54),'16 : capot inactif rejoué : l’extrusion suit la face modifiée (35 + 20 − 1 = 54) ('+F().distance+')');
    att(asm.active===Rt.id,'17 : retour au composant actif d’avant');
    att(asmExtStale().length===0,'18 : stable après synchronisation');
    // perçage du capot : fin « jusqu'à » la face du socle, puis jusqu'à une arête, décalage
    asmActivatePath([oB.id]);inject(35,'h2');
    const sh={id:'skh',name:'Centres',plane:'XY',visible:true,origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[],seq:1};
    const c0=addPoint(sh,5,5);sh.entities.push({id:'cp',t:'cpoint',p:c0,hole:true});doc.sketches.push(sh);
    const xh=mkXf();
    const ho={id:'hoj',type:'hole',name:'',sketchId:'skh',kind:'simple',d:6,thread:null,end:'upto',depth:15,tip:118,flip:true,op:'cut',visible:true,
      uptoPlane:{p:[0,0,0],n:[0,0,1],x:xh}};
    ho.name=holeName(ho);doc.features.push(ho);
    markDirty();rebuild();inject(35,'h2');
    const H=()=>B.doc.features.find(x=>x.id==='hoj');
    const U=holeUptoDir(H());
    att(U&&near(U.D[2],1),'19 : perçage retourné : axe +Z');
    att(H().uptoPlane&&near(H().uptoPlane.p[2],55)&&!H().uptoPlane.perdu,'20 : fin du trou relue sur la face du socle (Z55) avant le rejeu');
    att(near(holePlaneDist(H().uptoPlane,U.A.pts[0],U.A.dir),55),'21 : profondeur jusqu’à la face : 55 mm');
    H().uptoPlane.off=-2;
    att(near(holePlaneDist(H().uptoPlane,U.A.pts[0],U.A.dir),53),'22 : décalage −2 : 53 mm');
    H().uptoPlane.off=-60;
    att(holePlaneDist(H().uptoPlane,U.A.pts[0],U.A.dir)===null,'23 : décalage qui ramène derrière le début du trou : aucune profondeur (avertissement)');
    H().uptoPlane.off=1;H().uptoPlane.x={k:'xe',ctx:[oB.id],path:[oA.id],sub:'edge',pos:[10,0,30],len:20,name:'Arête · '+oA.name,sig:null};
    asmUptoHoleSync(H());
    att(near(H().uptoPlane.p[2],50)&&near(holePlaneDist(H().uptoPlane,U.A.pts[0],U.A.dir),51),'24 : fin du trou jusqu’à une arête (Z50) +1 : 51 mm');
    // une face de la pièce dans le même plan ne « vole » pas la cible (holePlaneSuit ignore pl.x)
    const pl0=JSON.stringify(H().uptoPlane);holePlaneSuit(H().uptoPlane,{});
    att(JSON.stringify(H().uptoPlane)===pl0,'25 : holePlaneSuit laisse la cible d’une autre pièce');
    // cible perdue : distance gardée, ⚠
    asmActivatePath([oB.id]);
    const dAv=F().distance;F().upto.x.ref={id:'zz'};F().upto.x.nom='zz';F().upto.x.loc={plane:{o:[0,0,35],n:[1,0,0]}};
    A._snap.pfaces=[];resolveExtrudeUpto(F());
    att(F().upto.perdu&&near(F().distance,dAv),'26 : face disparue : distance gardée, cible marquée perdue');
    inject(35,'h2');F().upto.x=mkXf();resolveExtrudeUpto(F());
    att(!F().upto.perdu&&near(F().distance,54),'27 : face retrouvée : la cible revient');
    // en attente du clic : aucune fonction antérieure, mais d'autres pièces
    const g={id:'exw',type:'extrude',name:'',sketchId:'skc',distance:12,op:'add',visible:true,mid:false,upto:{side:1}};
    const rw=resolveExtrudeUpto(g);
    att(rw===false&&g.upto&&near(g.distance,12),'28 : « jusqu’à » sans cible encore choisie : rien ne change, l’étendue reste');
    // fichier
    asmActivatePath([]);
    const js=serialise();await deserialise(js,{rebuild:false});
    const f2=asmComp(B.id).doc.features.find(x=>x.id==='exj'),h2=asmComp(B.id).doc.features.find(x=>x.id==='hoj');
    att(f2&&f2.upto&&f2.upto.x&&f2.upto.x.path.join()===oA.id&&f2.upto.off===-1,'29 : fichier : l’extrusion garde sa cible et son décalage');
    att(h2&&h2.uptoPlane&&h2.uptoPlane.x&&h2.uptoPlane.x.k==='xe'&&h2.uptoPlane.off===1,'30 : fichier : le perçage garde sa cible et son décalage');
    // choix au clic : arête parallèle → arête, non parallèle → sommet le plus proche, bout d'arête → sommet
    const toS=p=>[p[0]*10,p[1]*10,0];
    const Lx={ext:{ctx:[],path:[oA.id]},name:'Socle'};
    const E1={pts:[[0,0,25],[10,0,25],[20,0,25]]},raw1={pts:E1.pts,mid:[10,0,25]};
    const r1=asmUptoEdgeRef({Lx,E:E1,raw:raw1,toS,mx:100,my:0},[0,0,1]);
    att(r1.k==='xe'&&r1.sub==='edge'&&/^Arête/.test(r1.name),'31 : clic au milieu d’une arête parallèle : l’arête');
    const E2={pts:[[5,5,0],[5,5,20],[5,5,40]]},raw2={pts:E2.pts,mid:[5,5,20]};
    const toZ=p=>[p[2]*10,p[1]*10,0];
    const r2=asmUptoEdgeRef({Lx,E:E2,raw:raw2,toS:toZ,mx:200,my:50},[1,0,0]);
    att(r2.sub==='edge','32 : arête verticale, direction X : parallèle au plan de départ → l’arête');
    const r3=asmUptoEdgeRef({Lx,E:E2,raw:raw2,toS:toZ,mx:150,my:50},[0,0,1]);
    att(r3.sub==='vtx'&&r3.vpos&&r3.vpos[2]===0,'33 : arête non parallèle : un sommet');
    const r4=asmUptoEdgeRef({Lx,E:E1,raw:raw1,toS,mx:198,my:0},[0,0,1]);
    att(r4.sub==='vtx'&&r4.vpos[0]===20&&/^Sommet/.test(r4.name),'34 : clic près d’un bout : le sommet');
    // décalage saisi
    att(asmUptoOff('+1')===1&&asmUptoOff('-1,5')===-1.5&&asmUptoOff('2 mm')===2&&asmUptoOff('')===0&&isNaN(asmUptoOff('abc')),'35 : décalage saisi : « +1 », « -1,5 », « 2 mm »');
    // pièce seule : aucune cible d'une autre pièce
    docResetEmpty();
    att(!asmUptoDispo(),'36 : pièce sans composants : aucune autre pièce proposée');
    return {ATT,OK};
  `;
  const o=await vm.runInContext('(async function(){'+R+'})()',ctx);
  console.log('=== V0.99.94 : « jusqu’à » une face, une arête, un sommet d’une autre pièce ===');
  o.OK.forEach(m=>console.log('  ✓ '+m));
  if(o.ATT.length){o.ATT.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.ATT.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
