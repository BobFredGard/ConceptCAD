// « Barquette : je fais une Face de 5 mm […] je pensais que les parois […] allaient être
// continuées. » Dessus d'un corps à dépouille 15° dont les coins arrondis sont des cylindres
// OBLIQUES (DraftAngle) tangents aux parois planes : la reprise par Defeaturing échouait
// (« les faces voisines ne se rejoignent pas ») et la Face restait une extrusion droite.
// Correctif V0.40.1 : occMoveFaceRuledTool relève le contour le long de chaque voisine.
// Noyau OCCT réel, document réel (tests/fixtures/barquette_face_depouille.json).
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  sandbox.__doc=fs.readFileSync(path.join(ROOT,'tests','fixtures','barquette_face_depouille.json'),'utf8');
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
  const R=[
    'const out={fails:[],log:[]};',
    'const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};',
    'await deserialise(__doc);occt=__realOcct;occtReady=true;',
    'doc.features.find(f=>f.type==="combine").visible=false;markDirty();rebuild();',
    'A(builtEngine==="exact","rejeu exact ("+builtEngine+")");',
    'const FR=occFinalShape(null);',
    'const mv=(FR.msgs||[]).filter(m=>/Déplacement de face/.test(m));',
    'A(!mv.length,"Face +5 mm sans alerte ("+(mv.join(" | ")||"aucune")+")");',
    'const b4=(FR.perBody||[]).find(p=>p.bodyId==="b4");',
    'A(!!(b4&&b4.shape),"corps « Corps 1 (2) (2) » reconstruit");',
    'if(b4&&b4.shape){',
    '  const b=occBoxMinMax(b4.shape),t=5*Math.tan(15*Math.PI/180);',
    '  A(Math.abs(b.hi[2]-(-3.135+5))<0.01,"dessus monté de 5 mm (z "+b.hi[2].toFixed(3)+")");',
    '  A(Math.abs(b.hi[0]-(102.71+t))<0.02&&Math.abs(b.hi[1]-(64.71+t))<0.02,"parois prolongées dans leur pente : dessus élargi de "+t.toFixed(2)+" mm par côté ("+b.hi[0].toFixed(2)+" × "+b.hi[1].toFixed(2)+")");',
    '  const nf=occSubShapes(b4.shape,"TopAbs_FACE").length;',
    '  A(nf===18,"prolongements recollés aux parois et aux coins d’origine : "+nf+" faces (18 attendues)");',
    '  A(occCoqueValide(b4.shape),"solide valide");',
    '}',
    'return out;'
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Face sur un dessus à dépouille aux coins tangents (Barquette) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
