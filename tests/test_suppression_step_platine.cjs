// V0.99.65 : suppressions de faces sur une platine STEP (copie figée du fichier de Fred,
// tests/fixtures/platine-suppressions-step.conceptcad : import, déplacement, copie, 3 suppressions).
// Constats de Fred : « la 1ère suppression est rouge alors que les faces ont bien disparu », « la 2nd
// n'a pas d'erreur mais aucune face enlevée », « autres faces non supprimées ».
//  1. occFaceBox : une face SANS triangles a presque la même boîte (< 0,3 mm) qu'une fois maillée — avant,
//     la boîte « grossière » des surfaces libres décalait le centre de 2 à 3 mm et la face n'était
//     plus retrouvée au rejeu ;
//  2. les 22 faces de la 1re suppression et les 6 de la 3e sont toutes retrouvées ;
//  3. la 2e : 5 faces DISTINCTES (deux références portaient le nom d'une face voisine) ;
//  4. faces de chaque suppression rendues pour l'allumage (fantôme orange lié à la fonction) ;
//  5. rainure entière (8 faces : parois, fond, bouts) : le noyau refusait au bout de 73 s, ses 5 congés
//     de raccord restaient ; ils partent avec elle (« enlever, rapprocher les faces restantes, coudre ») ;
//  6. après la réponse du calcul de fond, le rejeu reprend le point de contrôle : le ⏳ disparaît, le bilan revient.
const vm=require('vm'),path=require('path');
const {loadApp}=require('./appvm.cjs');
const json=require('./lire-projet.cjs')(path.join(__dirname,'fixtures','platine-suppressions-step.conceptcad'));
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;sandbox.__J=json;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};',ctx);
  const o=await vm.runInContext(`(async()=>{
    const out={};
    await bundleRestore(__J,{rebuild:false});
    await importRestorePending();
    const E=occt.TopAbs_ShapeEnum;
    const faces=sh=>{const L=[];const ex=new occt.TopExp_Explorer_2(sh,E.TopAbs_FACE,E.TopAbs_SHAPE);for(;ex.More();ex.Next())L.push(occFaceCur(ex));ex.delete();return L;};
    const corps=(m,b)=>{occSkipFeat=null;occCk.length=0;const FR=occFinalShape(m);const q=FR.perBody.find(x=>x.bodyId===b);return {FR,sh:q&&q.shape};};
    // 1. boîte d'une surface libre : sans triangles = maillée
    {const {sh}=corps(2,'b1');
     const cp=new occt.BRepBuilderAPI_Copy_2(sh,true,false);const nu=cp.Shape();
     const F=faces(nu).filter(f=>occSurfKind(f)==='BSplineSurface');
     const avant=F.map(f=>occFaceBox(f));
     const gros=F.map(f=>{const b=new occt.Bnd_Box_1();occt.BRepBndLib.Add(f,b,true);const a=occXyz(b.CornerMin()),z=occXyz(b.CornerMax());b.delete();return [(a[0]+z[0])/2,(a[1]+z[1])/2,(a[2]+z[2])/2];});
     occTessellate(nu,0.05,0.3);
     let ecart=0;F.forEach((f,i)=>{const b=occFaceBox(f);for(let k=0;k<3;k++)ecart=Math.max(ecart,Math.abs(b.pos[k]-avant[i].pos[k]),Math.abs(b.dim[k]-avant[i].dim[k]));});
     let ecartAncien=0;F.forEach((f,i)=>{const b=occFaceBox(f);for(let k=0;k<3;k++)ecartAncien=Math.max(ecartAncien,Math.abs(b.pos[k]-gros[i][k]));});
     out.nBs=F.length;out.ecart=ecart;out.ecartAncien=ecartAncien;F.forEach(f=>f.delete());nu.delete();cp.delete();}
    // 2-3. faces retrouvées, distinctes
    const dels=doc.features.filter(f=>f.type==='xdelface');
    out.dist=dels.map(f=>{const i=doc.features.indexOf(f);const {sh}=corps(i,'b1');
      const hs=f.faces.map(r=>occFindFaceAny(sh,Object.assign({},r))).filter(Boolean);
      const d=[];hs.forEach(h=>{if(!d.some(x=>x.IsSame(h)))d.push(h);});
      const n=[hs.length,d.length];hs.forEach(h=>h.delete());return n;});
    // 5. rainure vers x = −33 sur la pièce d'avant la 2e suppression
    {const i=doc.features.indexOf(dels[1]);const {sh}=corps(i,'b1');
     const F=faces(sh).filter(f=>{const b=occBoxMinMax(f);const c=b.lo.map((v,k)=>(v+b.hi[k])/2),d=b.hi.map((v,k)=>v-b.lo[k]);
       const ok=Math.abs(c[0]+33)<6&&c[1]<-30&&d[0]<15&&['Cylinder','Plane','BSplineSurface'].includes(occSurfKind(f))&&!(occSurfKind(f)==='Cylinder'&&d[0]>50);if(!ok)f.delete();return ok;});
     out.nRainure=F.length;
     const t0=Date.now();const r=occDelFacesTry(sh,F);out.tRainure=Date.now()-t0;
     out.rainure={kept:r.kept,w:r.warnings,err:r.err};
     if(r.r){const a=faces(r.r);out.rainure.valide=occCoqueValide(r.r);
       out.rainure.reste=a.filter(f=>{const b=occBoxMinMax(f);return b.hi[0]<-24&&b.lo[0]>-42&&b.lo[1]>-50&&b.hi[1]<-27;}).length;
       out.rainure.dv=occShapeVolume(r.r)-occShapeVolume(sh);a.forEach(f=>f.delete());r.r.delete();}
     F.forEach(f=>f.delete());}
    // rejeu complet, fantômes voulus comme à l'affichage
    occSkipFeat=null;occCk.length=0;occFantomesVoulus=true;let FR;
    try{FR=occFinalShape(doc.features.length);}finally{occFantomesVoulus=false;}
    out.m=dels.map(f=>f._m);out.msgs=FR.msgs;
    out.fant=dels.map(f=>{const g=FR.ghostShapes.find(x=>x.fid===f.id);return g?{col:g.col,n:g.geo&&g.geo.attributes&&g.geo.attributes.position?1:0}:null;});
    // 6. reprise du point de contrôle (après la réponse du calcul de fond) : plus de ⏳, bilan rendu
    dels.forEach(f=>{f._calc=true;delete f._m;});
    occFinalShape(doc.features.length);
    out.repris=dels.map(f=>({calc:!!f._calc,m:f._m||null}));
    return out;})()`,ctx);
  console.log(JSON.stringify(o));
  A(o.nBs>10&&o.ecart<0.3,`1 : boîte d'une surface libre sans triangles ≈ maillée (${o.nBs} faces, écart ${o.ecart.toFixed(3)} mm ; ancienne boîte : ${o.ecartAncien.toFixed(2)} mm)`);
  A(o.dist[0][0]===22&&o.dist[0][1]===22,'2 : 1re suppression, 22 faces retrouvées ('+o.dist[0]+')');
  A(o.dist[2][0]===6&&o.dist[2][1]===6,'2 : 3e suppression, 6 faces retrouvées ('+o.dist[2]+')');
  A(o.dist[1][0]===5&&o.dist[1][1]===5,'3 : 2e suppression, 5 faces distinctes ('+o.dist[1]+')');
  A(o.m[0]&&o.m[0].m===22&&o.m[0].t===22,'2 : 1re suppression sans ⚠ ('+JSON.stringify(o.m[0])+')');
  A(o.m[2]&&o.m[2].m===6&&o.m[2].t===6,'2 : 3e suppression sans ⚠ ('+JSON.stringify(o.m[2])+')');
  A(!o.msgs.some(m=>/introuvable/.test(m)),'aucune face introuvable ('+o.msgs.join(' | ')+')');
  A(o.fant.every(g=>g&&g.col===0xff9f0a&&g.n>0),'4 : faces de chaque suppression prêtes à s\'allumer ('+JSON.stringify(o.fant)+')');
  A(o.nRainure===8,'5 : rainure, 8 faces choisies ('+o.nRainure+')');
  A(o.rainure.kept===8&&o.rainure.valide&&o.rainure.reste===0&&o.rainure.dv>100,'5 : rainure enlevée, solide refermé ('+JSON.stringify(o.rainure)+')');
  A(o.rainure.w.some(w=>/raccord/.test(w)),'5 : congés de raccord signalés');
  A(o.tRainure<20000,'5 : en moins de 20 s, délai du calcul de fond ('+o.tRainure+' ms)');
  A(o.repris.every((r,i)=>!r.calc&&r.m&&JSON.stringify(r.m)===JSON.stringify(o.m[i])),'6 : repris du point de contrôle, plus de ⏳ et même bilan ('+JSON.stringify(o.repris)+')');
  console.log(ko?`✗ ${ko} échec(s)`:'✓ suppressions de faces sur la platine STEP');
  process.exit(ko?1:0);
})();
