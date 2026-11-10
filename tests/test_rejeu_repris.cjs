// V0.89.2 : ce qui n'a pas changé n'est pas recalculé.
//  A. Congé copié par une répétition : son arête reçoit son ancre PENDANT le premier calcul, l'empreinte
//     du congé change. Le point de contrôle doit être retrouvé au rejeu suivant (barquette d'exemple :
//     6 points de contrôle ratés, dont la soustraction entre corps — 1,9 s au lieu de 0,07 s).
//  B. Facettes d'affichage gardées par corps : un rejeu sans changement ne remaille rien ; une cote
//     modifiée ne remaille que le corps touché ; les facettes reprises sont celles d'un maillage neuf ;
//     le rafraîchissement dur jette tout.
//  C. Arêtes affichées : même liste reprise tant qu'aucun corps ne change, refaite sinon.
const vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
const lireProjet=require('./lire-projet.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
// Géométrie minimale mais réelle : le THREE simulé du harnais n'a ni compteur ni copie.
class Attr{constructor(a,n){this.array=a instanceof Float32Array?a:new Float32Array(a);this.itemSize=n;this.count=this.array.length/n;}
  clone(){return new Attr(this.array.slice(),this.itemSize);}}
class Geo{constructor(){this.attributes={};this.userData={};this.index=null;}
  setAttribute(k,a){this.attributes[k]=a;return this;}
  computeVertexNormals(){}
  dispose(){this.jete=true;}
  clone(){const g=new Geo();for(const k in this.attributes)g.attributes[k]=this.attributes[k].clone();g.userData=this.userData;return g;}}
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  const T0=sandbox.THREE;
  sandbox.THREE=new Proxy({},{get(t,k){return k==='BufferGeometry'?Geo:k==='Float32BufferAttribute'?Attr:T0[k];}});
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};',ctx);

  console.log('=== A. congé répété : point de contrôle retrouvé au rejeu suivant ===');
  sandbox.__json=lireProjet(path.join(ROOT,'tests','fixtures','barquette-exemple.conceptcad'));
  const a=await vm.runInContext(`(async()=>{
    const raw=JSON.parse(__json);
    if(raw.doc)await bundleRestore(__json,{rebuild:false});else await deserialise(__json,{rebuild:false});
    const g0=occCkGet;let rate=0;occCkGet=function(k){const r=g0(k);if(!r)rate++;return r;};
    const vol=F=>(F.perBody||[]).map(p=>+occCoqueVolume(p.shape).toFixed(3)).join(' / ');
    occCkClear();
    const s0=doc.features.map(f=>featSig(f));
    let F=occFinalShape(null);const v1=vol(F);occCleanup(F,null);
    const change=doc.features.filter((f,i)=>featSig(f)!==s0[i]).length;
    rate=0;const t=performance.now();F=occFinalShape(null);const ms=performance.now()-t;const v2=vol(F);occCleanup(F,null);
    occCkGet=g0;
    return {change,rate,ms,v1,v2};})()`,ctx);
  A(a.change>0,'la pièce contient bien le cas : '+a.change+' congé(s) dont l’empreinte change au premier calcul');
  A(a.rate===0,'rejeu suivant : aucun point de contrôle raté ('+a.rate+' ; 6 avant) — '+a.ms.toFixed(0)+' ms');
  A(a.v1===a.v2&&a.v1.length>0,'même solide aux deux rejeux (volumes '+a.v1+')');

  console.log('=== B. facettes d’affichage gardées par corps ===');
  const b=await vm.runInContext(`(async()=>{
    const out={};
    const rect=(id,x0,y0,x1,y1)=>({id:id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
      points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],
      constraints:[],dims:[],seq:10,visible:false});
    docResetEmpty();doc.name='Repris';
    doc.sketches=[rect('s1',0,0,40,20),rect('s2',60,0,80,20)];
    doc.bodies=[{id:'b1',name:'Un',c:null},{id:'b2',name:'Deux',c:null}];doc.bodySeq=3;doc.activeBody='b1';
    doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'s1',distance:10,op:'add',visible:true,body:'b1'},
      {id:'F2',type:'extrude',name:'Plot',sketchId:'s2',distance:5,op:'add',visible:true,body:'b2'}];
    edgeMode='on';
    let nT=0,nE=0;const t0=occTessellate,e0=occSharpEdges;
    occTessellate=function(){nT++;return t0.apply(this,arguments);};
    occSharpEdges=function(){nE++;return e0.apply(this,arguments);};
    const tour=()=>{nT=0;nE=0;markDirty();rebuild();occVisibleSharpEdges();return {nT,nE};};
    out.premier=tour();
    out.exact=builtEngine==='exact';out.corps=bodies.filter(x=>x.kind==='body').length;
    out.repos=tour();
    // facettes reprises = facettes d'un maillage neuf, corps par corps
    const pareil=()=>bodies.filter(x=>x.kind==='body').every(x=>{
      const m=occMeshMemo.get(x.id);if(!m)return false;
      const D=occDisplayDefl(occLive.shape);const g=t0(x.shape,D.lin,D.ang);
      const p=g.attributes.position.array,q=m.geo.attributes.position.array;
      if(p.length!==q.length||!p.length)return false;
      for(let i=0;i<p.length;i++)if(p[i]!==q[i])return false;
      return true;});
    out.pareilRepos=pareil();
    // arêtes reprises = arêtes d'un classement neuf
    const lst=l=>JSON.stringify(l.map(e=>[e.sharp,e.pts]));
    out.aretesPareil=lst(occVisibleSharpEdges())===lst(e0(occLive.shape));
    // une cote du corps 2 : seul le corps 2 est remaillé, les arêtes sont refaites
    doc.features[1].distance=7;out.modif=tour();
    out.pareilModif=pareil();
    out.aretesModif=lst(occVisibleSharpEdges())===lst(e0(occLive.shape));
    out.haut=2*occSolidBox(bodies.find(x=>x.id==='b2').shape).c[2];
    // retour à la valeur d'avant : le corps 2 a changé d'empreinte entre-temps, il est remaillé
    doc.features[1].distance=5;out.retour=tour();out.pareilRetour=pareil();
    // corps supprimé : sa mémoire est rendue
    doc.features.pop();doc.bodies.pop();tour();out.restants=[...occMeshMemo.keys()].join(',');
    // rafraîchissement dur : tout est jeté puis refait
    nT=0;hardRefresh();out.dur=nT;
    occTessellate=t0;occSharpEdges=e0;
    return out;})()`,ctx);
  A(b.exact&&b.corps===2,'pièce exacte à 2 corps');
  A(b.premier.nT===2,'premier affichage : 2 corps maillés ('+b.premier.nT+')');
  A(b.repos.nT===0,'rejeu sans changement : aucun maillage refait ('+b.repos.nT+')');
  A(b.repos.nE===0,'rejeu sans changement : arêtes reprises, pas reclassées ('+b.repos.nE+')');
  A(b.pareilRepos,'facettes gardées identiques à un maillage neuf');
  A(b.aretesPareil,'arêtes reprises identiques à un classement neuf');
  A(b.modif.nT===1,'cote du corps 2 modifiée : un seul corps remaillé ('+b.modif.nT+')');
  A(b.modif.nE>=1,'cote modifiée : arêtes reclassées ('+b.modif.nE+')');
  A(b.pareilModif&&b.aretesModif,'après modification : facettes et arêtes à jour');
  A(Math.abs(b.haut-7)<1e-6,'le corps 2 affiché fait bien 7 mm de haut ('+b.haut+')');
  A(b.retour.nT===1&&b.pareilRetour,'retour à 5 mm : corps 2 remaillé, facettes à jour ('+b.retour.nT+')');
  A(b.restants==='b1','corps supprimé : ses facettes gardées sont rendues ('+b.restants+')');
  A(b.dur>=1,'rafraîchissement dur : maillage refait ('+b.dur+')');

  console.log('=== D. suivi FAO et recousage repris quand la pièce ne change pas (V0.89.3) ===');
  sandbox.__json=lireProjet(path.join(ROOT,'tests','fixtures','percages-fao.conceptcad'));
  const d=await vm.runInContext(`(async()=>{
    const out={};
    showAll=function(){};applyView=function(){};
    await bundleRestore(__json,{name:'banc'});markDirty();rebuild();
    const ops=[];(faoRoot().setups||[]).forEach(s=>(s.ops||[]).forEach(o=>{if(o.type==='drill'&&o.src==='model'&&(o.holes||[]).length)ops.push(o);}));
    out.nOps=ops.length;out.nTrous=ops.reduce((a,o)=>a+o.holes.length,0);
    let nH=0,nE=0,nU=0;const h0=faoHolesDetect,e0=occSharpEdges,u0=occUnify;
    faoHolesDetect=function(){nH++;return h0.apply(this,arguments);};
    occSharpEdges=function(){nE++;return e0.apply(this,arguments);};
    occUnify=function(){nU++;return u0.apply(this,arguments);};
    const etat=()=>JSON.stringify(ops.map(o=>o.holes));
    const frais=()=>{faoHoleMemo.clear();edgeAllMemo=null;faoDrillReplay();return etat();};
    const tour=()=>{nH=0;nE=0;nU=0;markDirty();rebuild();return {nH,nE,nU};};
    tour();const s0=etat();
    out.repos=tour();out.reposPareil=etat()===s0&&frais()===s0;
    // un perçage change de diamètre : les trous suivent, comme sans mémoire
    const f=doc.features.find(x=>x.type==='hole'&&+x.d>0);const d0=+f.d;
    f.d=d0+0.4;out.modif=tour();const s1=etat();out.modifSuivi=s1!==s0;out.modifPareil=frais()===s1;
    f.d=d0;tour();out.retour=etat()===s0;
    // recousage : le solide repris est celui d'un rejeu sans aucun point de contrôle
    const vol=()=>{const F=occFinalShape(null);const v=(F.perBody||[]).map(p=>occCoqueVolume(p.shape).toFixed(3)+'/'+occSubShapes(p.shape,'TopAbs_FACE').length).join(' ');occCleanup(F,null);return v;};
    const v1=vol();occCkClear();const v2=vol();out.recousu=v1===v2&&v1.length>0;out.v=v1;
    faoHolesDetect=h0;occSharpEdges=e0;occUnify=u0;
    return out;})()`,ctx);
  A(d.nOps>0&&d.nTrous>0,'pièce à perçages FAO « trous du modèle » ('+d.nOps+' opération(s), '+d.nTrous+' trous)');
  A(d.repos.nH===0,'rejeu sans changement : trous non redétectés ('+d.repos.nH+')');
  A(d.repos.nE===0,'rejeu sans changement : arêtes non reclassées, ni pour l’affichage ni pour la FAO ('+d.repos.nE+')');
  A(d.repos.nU===0,'rejeu sans changement : aucun recousage refait ('+d.repos.nU+')');
  A(d.reposPareil,'trous repris identiques à une détection neuve');
  A(d.modif.nH>=1&&d.modifSuivi,'Ø d’un perçage modifié : trous redétectés, les opérations suivent');
  A(d.modifPareil,'après modification : mêmes trous qu’une détection sans mémoire');
  A(d.retour,'retour au Ø d’origine : trous d’origine');
  A(d.recousu,'recousage repris = recousage refait (volume/faces '+d.v+')');

  console.log('=== E. étapes empruntées, projections au repos, fantômes gardés (V0.89.5) ===');
  sandbox.__json=lireProjet(path.join(ROOT,'tests','fixtures','barquette-exemple.conceptcad'));
  const e=await vm.runInContext(`(async()=>{
    const out={};
    await bundleRestore(__json,{name:'banc'});markDirty();rebuild();markDirty();rebuild();
    const desc=()=>{const F=occFinalShape(null);const v=(F.perBody||[]).map(p=>occCoqueVolume(p.shape).toFixed(3)+'/'+occSubShapes(p.shape,'TopAbs_FACE').length+'/'+occSubShapes(p.shape,'TopAbs_EDGE').length).join(' ');occCleanup(F,null);return v;};
    // 1. un rejeu sans changement ne copie plus chaque étape
    let nC=0;const c0=occShapeCopy;occShapeCopy=function(){nC++;return c0.apply(this,arguments);};
    const d0=desc();nC=0;const d1=desc();out.copies=nC;out.etapes=doc.features.filter(f=>f.visible!==false).length;out.memeRepos=d0===d1;
    occShapeCopy=c0;
    // 2. les points de contrôle empruntés restent intacts : cote modifiée = rejeu sans aucun point de contrôle
    const P=doc.params.find(x=>x.name==='largeur_barquette');
    parSetParam(P,'165.5');markDirty();rebuild();const a1=desc();out.a1=a1;
    parSetParam(P,'165');markDirty();rebuild();const b1=desc();out.retour=b1===d0;
    parSetParam(P,'165.5');markDirty();rebuild();const a3=desc();out.revenu=a3===a1&&a1!==d0;
    parSetParam(P,'165');markDirty();rebuild();markDirty();rebuild();
    // 3. projections : au repos, plus de recherche d'arête ; après une cote, même résultat que sans mémoire
    let nP=0;const p0=findClosestProjectedEdge;findClosestProjectedEdge=function(){nP++;return p0.apply(this,arguments);};
    const esq=()=>JSON.stringify(doc.sketches.map(s=>[s.id,s.origin,s.points]));
    doc.sketches.forEach(s=>_projRepos.delete(s));nP=0;markDirty();rebuild();out.projNeuf=nP;
    nP=0;markDirty();rebuild();out.projRepos=nP;
    parSetParam(P,'166');markDirty();rebuild();const s1=esq();
    doc.sketches.forEach(s=>_projRepos.delete(s));markDirty();rebuild();out.projSuit=esq()===s1;
    parSetParam(P,'165');markDirty();rebuild();
    findClosestProjectedEdge=p0;
    return out;})()`,ctx);
  A(e.memeRepos,'rejeu sans changement : même solide');
  A(e.copies<e.etapes/2,'rejeu sans changement : '+e.copies+' copie(s) de solide pour '+e.etapes+' fonctions (une par étape avant)');
  A(e.retour,'retour à la cote d’origine : solide d’origine');
  A(e.revenu,'cote remise à 165,5 : solide repris des étapes gardées, identique au premier calcul');
  A(e.projNeuf>0&&e.projRepos<e.projNeuf,'projections : '+e.projNeuf+' recherches d’arête sans mémoire, '+e.projRepos+' au repos (restent les esquisses à sources particulières)');
  A(e.projSuit,'projections après une cote : mêmes esquisses qu’une recherche sans mémoire');
  sandbox.__json=lireProjet(path.join(ROOT,'tests','fixtures','percages-fao.conceptcad'));
  const g=await vm.runInContext(`(async()=>{
    const out={};
    await bundleRestore(__json,{name:'banc'});markDirty();rebuild();markDirty();rebuild();
    let nT=0;const t0=occTessellate;occTessellate=function(){nT++;return t0.apply(this,arguments);};
    const fant=()=>bodies.filter(b=>b.kind==='ghost').length;
    out.f0=fant();nT=0;markDirty();rebuild();out.repos=nT;out.f1=fant();
    // partiels (projections, plans) : aucun fantôme maillé
    nT=0;const F=occFinalShape(null);out.partiel=nT;out.partielFant=(F.ghostShapes||[]).length;occCleanup(F,null);
    // rafraîchissement dur : tout est refait
    nT=0;hardRefresh();out.dur=nT;out.f2=fant();
    occTessellate=t0;
    return out;})()`,ctx);
  A(g.f0>0&&g.f1===g.f0,'outils de découpe toujours montrés ('+g.f1+' fantômes)');
  A(g.repos===0,'rejeu sans changement : aucun maillage refait, ni corps ni fantômes ('+g.repos+')');
  A(g.partiel===0&&g.partielFant===0,'rejeu hors affichage : aucun fantôme maillé ('+g.partiel+')');
  A(g.dur>0&&g.f2===g.f0,'rafraîchissement dur : fantômes refaits ('+g.dur+' maillages)');
  console.log(ko?'ÉCHEC : '+ko:'*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
