// RÉPÉTITION D'UN BALAYAGE sur le vrai noyau OCCT. Retour utilisateur : « impossible de répéter un
// balayage » — le type 'sweep' manquait à repCanFeature, et une copie doit transformer ses DEUX
// esquisses (profil ET chemin). Solide de référence : carré 10×10 le long d'un L 50+50 = 10 000 mm³.
// Exigence : les esquisses copiées ne se voient nulle part — seul le balayage apparaît dans la répétition.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const body=String.raw`
    const out={};
    const vol=s=>{const G=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(s,G,false,false,false);const m=G.Mass();G.delete();return m;};
    const mesure=()=>{occCkClear();markDirty();rebuild();const FR=occFinalShape(null);
      const v=FR.shape?vol(FR.shape):null;const msgs=(FR.msgs||[]).filter(m=>/impossible|introuvable|vide|non fermé/.test(m));
      if(FR.shape)try{FR.shape.delete();}catch(e){}return{v,msgs};};
    const poly=(sk,pts,closed)=>{const ids=pts.map((q,i)=>{const id='q'+i+'_'+sk.id;sk.points[id]={x:q[0],y:q[1]};return id;});
      for(let i=0;i<ids.length-(closed?0:1);i++)sk.entities.push({id:'L'+i+'_'+sk.id,t:'line',p1:ids[i],p2:ids[(i+1)%ids.length]});};
    const mk=(id,u,v,n,o)=>({id,name:id,plane:'FACE',origin:o||[0,0,0],axU:u,axV:v,axN:n,points:{},entities:[],constraints:[],dims:[],visible:false});
    // profil carré 10×10 dans YZ en x = X0, chemin en L dans XY partant de (X0, 0)
    const init=(X0,op)=>{
      const pr=mk('sk_pr',[0,1,0],[0,0,1],[1,0,0],[X0,0,0]);poly(pr,[[-5,-5],[5,-5],[5,5],[-5,5]],true);
      const ch=mk('sk_ch',[1,0,0],[0,1,0],[0,0,1]);poly(ch,[[X0,0],[X0+50,0],[X0+50,50]],false);
      doc.sketches=[pr,ch];doc.cgeo=[];
      doc.features=[{id:'sw_s',type:'sweep',name:'Balayage',sketchId:'sk_pr',pathId:'sk_ch',op:op||'add',visible:true}];
      doc.bodies=[];occCkClear();tlMark=null;
    };
    const repete=c=>{const rp=Object.assign({id:'rp1',type:'repeat',name:'R',q:1,base:['sw_s'],children:[],visible:true},c);
      doc.features.push(rp);repGenChildren(rp);return rp;};
    // 1) proposée et répétable
    init(100);out.can=repCanFeature('sw_s');out.hint=repCanFeatureHint(doc.features[0]);
    out.src=mesure().v;
    // 2) linéaire en Z : 3 exemplaires séparés
    let rp=repete({mode:'lin',copies:2,dist:30,axis:'Z'});
    out.lin=mesure();
    const kids=doc.features.filter(f=>f.repeatId===rp.id);
    out.kidsT=kids.map(f=>f.type);
    out.chemins=new Set(kids.map(k=>k.pathId)).size;out.profils=new Set(kids.map(k=>k.sketchId)).size;
    out.ckOk=kids.every(k=>sweepCheck(k).ok);
    out.ids=kids.map(k=>k.id+k.sketchId+k.pathId).join();
    // ── aucune esquisse copiée visible : arbre, fil, sélecteurs, vue 3D, « Tout afficher »
    const copies=doc.sketches.filter(s=>s.id!=='sk_pr'&&s.id!=='sk_ch');
    out.nCopies=copies.length;out.cachees=copies.every(s=>s.visible===false);
    out.copieDetectee=copies.every(s=>skIsRepCopy(s));
    out.sourcesVues=!skIsRepCopy(doc.sketches[0])&&!skIsRepCopy(doc.sketches[1]);
    out.sweepList=sweepSketches().map(s=>s.id).join();
    out.guideList=pgGuideSketches(doc).map(s=>s.id).join();
    try{showAll2();}catch(e){}
    out.toutAfficher=copies.every(s=>s.visible===false);
    // 3) régénération : ids stables
    repGenChildren(rp);
    out.stable=doc.features.filter(f=>f.repeatId===rp.id).map(k=>k.id+k.sketchId+k.pathId).join()===out.ids;
    out.nCopies2=doc.sketches.length-2;
    // 4) le chemin source édité : les copies suivent (branche finale 50 → 30 : L 80 mm → 8 000 mm³ par exemplaire)
    const pts=doc.sketches[1].points;pts[Object.keys(pts)[2]].y=30;
    repSyncForSketch('sk_ch');out.suit=mesure().v;
    pts[Object.keys(pts)[2]].y=50;repSyncForSketch('sk_ch');
    // 5) réduction de la quantité : les esquisses (profil ET chemin) des copies retirées partent
    rp.copies=1;repGenChildren(rp);out.apresReduc=doc.sketches.length;
    // 6) suppression de la répétition : plus aucune esquisse copiée, sources intactes
    repRemoveRepeat(rp);out.apresSuppr=doc.sketches.map(s=>s.id).join();
    // 7) circulaire : 4 exemplaires autour de Z
    init(100);rp=repete({mode:'circ',copies:3,angle:360,axis:'Z'});out.circ=mesure();
    // 8) symétrie et symétrie double
    init(100);rp=repete({mode:'mir',copies:1,plane:'YZ'});out.mir=mesure();
    init(100);rp=repete({mode:'mir',copies:1,plane:'YZ',plane2:'XZ'});out.mir2=mesure();
    // 9) suivant un profil dont la guide est le chemin même du balayage : la copie garde son chemin entier
    init(100);rp=repete({mode:'path',copies:1,path:pgDefaultPath(doc.sketches[1]),pspace:'fit',orient:'fixed'});
    const kg=doc.features.filter(f=>f.repeatId===rp.id);
    out.guide=kg.map(k=>sweepCheck(k).ok);
    out.guideN=kg.map(k=>doc.sketches.find(s=>s.id===k.pathId).entities.length);
    // 10) nouveau corps : un corps par exemplaire
    init(100);ensureBodies();const b0=doc.bodies.length;rp=repete({mode:'lin',copies:2,dist:30,axis:'Z',op:'new'});
    out.corps=doc.bodies.length-b0;
    // 11) découpe répétée : bloc − 2 rainures
    init(10,'cut');
    const bl=mk('sk_bl',[1,0,0],[0,1,0],[0,0,1]);poly(bl,[[0,-100],[100,-100],[100,100],[0,100]],true);
    doc.sketches.push(bl);
    doc.features.unshift({id:'ex_b',type:'extrude',name:'Bloc',sketchId:'sk_bl',op:'add',distance:100,mid:true,visible:true});
    const blocSeul=(()=>{const k=doc.features.splice(1);const v=mesure().v;doc.features.push(...k);return v;})();
    const uneR=blocSeul-mesure().v;
    rp=repete({mode:'lin',copies:1,dist:30,axis:'Z'});
    out.cut={bloc:blocSeul,une:uneR,deux:blocSeul-mesure().v};
    // 12) rechargement du fichier : rien n'est purgé, même volume
    init(100);rp=repete({mode:'lin',copies:2,dist:30,axis:'Z'});
    const j=JSON.stringify({s:doc.sketches,f:doc.features});
    doc.sketches=JSON.parse(j).s;doc.features=JSON.parse(j).f;
    const nAv=doc.sketches.length;docSanitise();out.sani=doc.sketches.length===nAv;out.recharge=mesure();
    // 13) aperçu rouge : le volume balayé
    try{out.apercu=repFeatPreviewGeos(doc.features.find(f=>f.id==='sw_s')).length;}catch(e){out.apercu='ERR '+e.message;}
    return out;`;
  const o=await vm.runInContext('(async()=>{'+body+'})()',ctx);
  const near=(a,b)=>a!=null&&Math.abs(a-b)<=1e-3*Math.max(1,Math.abs(b));
  console.log('=== Répétition d’un balayage (noyau OCCT réel) ===');
  A(o.can===true,'le balayage est proposé dans la liste des fonctions à répéter');
  A(/Balayage/.test(o.hint),'infobulle : « '+o.hint+' »');
  A(near(o.src,10000),'balayage seul : '+o.src);
  A(near(o.lin.v,30000)&&!o.lin.msgs.length,'linéaire ×3 : '+o.lin.v+' (attendu 30 000) '+JSON.stringify(o.lin.msgs));
  A(o.kidsT.length===2&&o.kidsT.every(t=>t==='sweep'),'les copies sont des balayages : '+o.kidsT.join());
  A(o.chemins===2&&o.profils===2,'chaque copie a son propre profil et son propre chemin');
  A(o.ckOk,'chaque copie est valide');
  A(o.nCopies===4,'4 esquisses copiées (2 copies × profil + chemin) : '+o.nCopies);
  A(o.cachees,'esquisses copiées masquées dans la vue 3D');
  A(o.copieDetectee,'esquisses copiées (profil ET chemin) absentes de l’arbre et du fil');
  A(o.sourcesVues,'esquisses d’origine toujours présentes dans l’arbre');
  A(o.sweepList==='sk_pr,sk_ch','sélecteurs du balayage : seulement les originales ('+o.sweepList+')');
  A(o.guideList==='sk_pr,sk_ch','courbes guides : seulement les originales ('+o.guideList+')');
  A(o.toutAfficher,'« Tout afficher » laisse les esquisses copiées cachées');
  A(o.stable&&o.nCopies2===4,'régénération : mêmes identifiants, aucune esquisse en plus');
  A(near(o.suit,24000),'chemin source modifié : les copies suivent ('+o.suit+', attendu 24 000)');
  A(o.apresReduc===4,'quantité réduite : esquisses retirées avec leur copie ('+o.apresReduc+' restantes, attendu 4)');
  A(o.apresSuppr==='sk_pr,sk_ch','répétition supprimée : restent les esquisses d’origine ('+o.apresSuppr+')');
  A(near(o.circ.v,40000)&&!o.circ.msgs.length,'circulaire ×4 : '+o.circ.v+' '+JSON.stringify(o.circ.msgs));
  A(near(o.mir.v,20000)&&!o.mir.msgs.length,'symétrie : '+o.mir.v+' '+JSON.stringify(o.mir.msgs));
  // les L et leurs images par XZ se chevauchent sur 55 × 10 × 10 = 5 500 mm³, de chaque côté de YZ
  A(near(o.mir2.v,40000-2*5500)&&!o.mir2.msgs.length,'symétrie double : '+o.mir2.v+' '+JSON.stringify(o.mir2.msgs));
  A(o.guide.length>=1&&o.guide.every(Boolean)&&o.guideN.every(n=>n===2),'guide = chemin du balayage : la copie garde son chemin entier ('+o.guideN+' traits)');
  A(o.corps===2,'« Nouveau corps » : 2 corps en plus ('+o.corps+')');
  A(o.cut.une>100&&near(o.cut.deux,2*o.cut.une),'découpe répétée : '+o.cut.deux+' enlevés = 2 × '+o.cut.une);
  A(o.sani&&near(o.recharge.v,30000),'fichier rechargé : esquisses conservées, volume '+o.recharge.v);
  A(typeof o.apercu==='number'&&o.apercu>=1,'aperçu rouge : volume balayé affiché ('+o.apercu+')');
  if(ko){console.log('\n*** '+ko+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
