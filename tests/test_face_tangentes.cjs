// « Pour la fonction Face, il faudrait pouvoir sélectionner toutes les faces tangentes entre
// elles et en faire un décalage, peu importe le type de face […] sur la Barquette, décaler
// toutes les faces intérieures d'un seul coup » (V0.45.1).
// Barquette (Exemples), corps « Corps 1 » : un clic sur le fond + « Faces tangentes » =
// 17 faces (8 parois dont 4 coins obliques, 8 congés du fond dont 4 B-splines, le fond),
// décalées par le noyau (CCFaceOffset, OCCT 8). Volume ≈ aire de l'intérieur × distance.
// Ancien noyau (OCCT_DIR=actuel) : la chaîne est trouvée, mais seule la face cliquée bouge
// (calcul historique), avec une alerte.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  sandbox.__doc=require('./lire-projet.cjs')(path.join(ROOT,'Exemples','Barquette.conceptcad'));
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
  const R=[
    'const out={fails:[],log:[]};',
    'const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};',
    'await bundleRestore(__doc,{rebuild:false});resolveAllSketchHosts();',
    'const etat=()=>{occSkipFeat=null;occCk.length=0;const FR=occFinalShape(null);return {sh:FR.perBody.find(p=>p.bodyId==="b1").shape,msgs:FR.msgs||[]};};',
    'const E0=etat(),sh=E0.sh,V0=occShapeVolume(sh);',
    'const faces=occSubShapes(sh,"TopAbs_FACE");',
    // le fond : face plane tournée vers le haut, la plus basse
    'let fond=-1,zb=1e9;faces.forEach((f,i)=>{const n=occFaceOutNormal(f),b=occFaceBox(f);if(n&&n[2]>0.99&&b.pos[2]<zb){zb=b.pos[2];fond=i;}});',
    'A(fond>=0&&Math.abs(zb+33.25)<0.05,"fond de la barquette trouvé (z "+zb.toFixed(2)+")");',
    'const t0=Date.now(),ch=occTangentChainOrds(sh,[fond]),ms=Date.now()-t0;',
    'const kinds={};ch.forEach(i=>{const k=occSurfKind(faces[i]);kinds[k]=(kinds[k]||0)+1;});',
    'A(ch.length===17,"chaîne tangente depuis le fond : "+ch.length+" faces (17 attendues) "+JSON.stringify(kinds)+", "+ms+" ms");',
    'A(kinds.BSplineSurface===4&&kinds.SurfaceOfExtrusion===4,"congés B-splines et coins obliques compris");',
    'const aire=ch.reduce((s,i)=>s+occFaceArea(faces[i]),0);',
    'A(!ch.some(i=>{const n=occFaceOutNormal(faces[i]),b=occFaceBox(faces[i]);return n&&n[2]>0.99&&b.pos[2]>-1;}),"le bord du dessus (arête vive) n’est pas entraîné");',
    'const refFond=occFaceRefAny(faces[fond]);occDispose(faces);',
    'const essai=(dist,tangent,ref)=>{',
    '  const f={id:"mv_t"+Math.random().toString(36).slice(2,7),type:"xmove",name:"Essai",faces:[ref],ref:ref,dist,body:"b1",visible:true};',
    '  if(tangent)f.tangent=true;',
    '  doc.features.push(f);markDirty();',
    '  const E=etat();doc.features.pop();markDirty();',
    '  return {sh:E.sh,v:occShapeVolume(E.sh),msgs:E.msgs.filter(m=>/Essai/.test(m))};',
    '};',
    'if(!occHasFaceOffset()){',
    '  const r=essai(1,true,refFond);',
    '  A(r.v>V0&&r.v<V0+aire&&r.msgs.some(m=>/décalage indisponible/.test(m)),"ancien noyau : le fond seul bouge ("+(r.v-V0).toFixed(0)+" mm³), alerte ("+r.msgs.join(" | ")+")");',
    '  return out;',
    '}',
    'for(const d of [1,-1]){',
    '  const t1=Date.now(),r=essai(d,true,refFond),ms2=Date.now()-t1,dv=r.v-V0,q=dv/(aire*d);',
    '  A(!r.msgs.length,"Face "+(d>0?"+":"")+d+" mm, faces tangentes : sans alerte ("+(r.msgs.join(" | ")||"aucune")+")");',
    '  A(q>0.95&&q<1.05,"Face "+(d>0?"+":"")+d+" mm : volume "+(dv>0?"+":"")+dv.toFixed(0)+" mm³ pour "+aire.toFixed(0)+" mm² d’intérieur ("+ms2+" ms)");',
    '  A(occCoqueValide(r.sh),"Face "+(d>0?"+":"")+d+" mm : solide valide");',
    '  const fs2=occSubShapes(r.sh,"TopAbs_FACE");let z=null;fs2.forEach(f=>{const n=occFaceOutNormal(f),b=occFaceBox(f);if(n&&n[2]>0.99&&b.pos[2]<-20)z=b.pos[2];});',
    '  A(z!=null&&Math.abs(z-(zb+d))<0.01,"fond déplacé de "+d+" mm (z "+(z==null?"?":z.toFixed(3))+")");',
    '  let bord=false;fs2.forEach(f=>{const n=occFaceOutNormal(f),b=occFaceBox(f);if(n&&n[2]>0.99&&Math.abs(b.pos[2])<1e-3)bord=true;});',
    '  A(bord,"bord du dessus resté à z 0");occDispose(fs2);',
    '}',
    // sans la case : le fond seul est plan, calcul historique (prisme) — le fond monte, les congés ne suivent pas
    '{const r=essai(1,false,refFond);A(r.v>V0&&r.v<V0+aire,"sans « Faces tangentes » : le fond seul ("+(r.v-V0).toFixed(0)+" mm³)");}',
    // une face B-spline seule, cliquable avec OCCT 8 : le noyau la décale avec ses tangentes
    '{const fs3=occSubShapes(sh,"TopAbs_FACE");const bs=ch.find(i=>occSurfKind(fs3[i])==="BSplineSurface");const ref=occFaceRefAny(fs3[bs]);occDispose(fs3);',
    ' const r=essai(0.5,false,ref),q=(r.v-V0)/(aire*0.5);',
    ' A(!r.msgs.length&&q>0.95&&q<1.05,"congé B-spline seul (+0,5) : décalé par le noyau avec ses tangentes ("+(r.msgs.join(" | ")||(r.v-V0).toFixed(0)+" mm³")+")");}',
    'return out;'
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Fonction Face : faces tangentes décalées d’un bloc (Barquette) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
