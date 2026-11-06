// PILE DU NOYAU : une erreur C++ rattrapée côté JavaScript laisse le pointeur de pile du noyau là où
// elle l'a trouvé. 8 Mo de pile, puis débordement silencieux sur ses données : plus aucun solide
// jusqu'au rechargement. Mesuré sur Barquette avant correction : 80 Ko perdus par modification, solide
// perdu à la 107e. test_barquette_120 fait la série complète ; ici, le mécanisme, en quelques secondes.
const vm=require('vm'),path=require('path');
const {loadApp}=require('./appvm.cjs');
const lireProjet=require('./lire-projet.cjs');
const ROOT=path.join(__dirname,'..');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const ouvrir=async f=>{sandbox.__json=lireProjet(path.join(ROOT,'Exemples',f));
    await vm.runInContext(String.raw`(async()=>{const raw=JSON.parse(__json);
      if(raw.doc)await bundleRestore(__json,{rebuild:false});else await deserialise(__json,{rebuild:false});
      markDirty();rebuild();})()`,ctx);};
  const corps=()=>vm.runInContext("bodies.filter(b=>b.kind==='body'&&b.shape).length",ctx);
  console.log('=== Pile du noyau ===');
  A(typeof real.stackSave==='function'&&typeof real.stackRestore==='function','la colle donne accès à la pile du noyau');
  const haut=real.stackSave();

  await ouvrir('Barquette.conceptcad');
  A(corps()===1,'Barquette ouverte : un solide');
  // Le rejeu complet ne doit plus lever d'erreur à chaque arête : la pile finit où elle a commencé.
  const avant=real.stackSave();
  vm.runInContext("parSetParam(doc.params.find(x=>x.name==='largeur_barquette'),'165.25');",ctx);
  await vm.runInContext('(async()=>{await parAfterChange(true);})()',ctx);
  const perdu=avant-real.stackSave();
  A(perdu<1024,'une modification sur Barquette : '+perdu+' octets de pile perdus (80 208 avant)');
  A(corps()===1,'… et le solide est toujours là');

  // Le cercle reste lu sur les cercles (pas de subdivision à l'aveugle), et une droite garde ses 2 points.
  const tr=JSON.parse(vm.runInContext(String.raw`(()=>{
    const r={c:null,l:null};
    const ex=new occt.TopExp_Explorer_2(occLive.shape,occt.TopAbs_ShapeEnum.TopAbs_EDGE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
    for(;ex.More()&&!(r.c&&r.l);ex.Next()){
      const e=occEdgeCur(ex),ad=new occt.BRepAdaptor_Curve_2(e),T=occt.GeomAbs_CurveType,t=ad.GetType();
      if(t===T.GeomAbs_Circle&&!r.c){
        const C=ad.Circle(),R=C.Radius(),u0=ad.FirstParameter(),u1=ad.LastParameter(),tol=0.01;
        let n=Math.ceil(Math.abs(u1-u0)/(2*Math.acos(1-tol/R)));n=Math.max(4,Math.min(600,n));
        r.c={attendu:n+1,obtenu:occCurvePts(ad,u0,u1,tol,600).length};C.delete();
      }else if(t===T.GeomAbs_Line&&!r.l)r.l=occCurvePts(ad,ad.FirstParameter(),ad.LastParameter(),0.01,600).length;
      ad.delete();e.delete();
    }
    ex.delete();return JSON.stringify(r);})()`,ctx));
  A(tr.c&&tr.c.obtenu===tr.c.attendu,'arc : points calculés d’après son rayon ('+(tr.c&&tr.c.obtenu)+', attendu '+(tr.c&&tr.c.attendu)+')');
  A(tr.l===2,'droite : 2 points ('+tr.l+')');

  // Filet : d'autres erreurs du noyau restent légitimes (congé refusé…), le rejeu suivant rattrape la pile.
  const s0=real.stackSave();
  const n=vm.runInContext(String.raw`(()=>{
    const ex=new occt.TopExp_Explorer_2(occLive.shape,occt.TopAbs_ShapeEnum.TopAbs_EDGE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
    let n=0;
    for(;ex.More()&&!n;ex.Next()){
      const e=occEdgeCur(ex),ad=new occt.BRepAdaptor_Curve_2(e);
      if(ad.GetType()===occt.GeomAbs_CurveType.GeomAbs_Line)for(let i=0;i<500;i++){try{ad.Circle();}catch(err){n++;}}
      ad.delete();e.delete();
    }
    ex.delete();return n;})()`,ctx);
  const s1=real.stackSave();
  A(n===500&&s1<s0,'500 erreurs provoquées : '+(s0-s1)+' octets de pile perdus');
  vm.runInContext('markDirty();rebuild();',ctx);
  A(real.stackSave()===haut,'le rejeu suivant remet la pile au plus haut');
  A(corps()===1,'… sans toucher au solide');
  console.log(ko?'ÉCHEC : '+ko:'*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
