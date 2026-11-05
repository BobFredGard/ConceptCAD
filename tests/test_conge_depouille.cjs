// « Barquette : quand on change le paramètre calibre et angle, ou l'un ou l'autre, le 1er congé
// perd son arête. » Le congé R15 porte sur l'arête du FOND d'une extrusion à dépouille (35 mm,
// −15°) : elle est décalée de |z|·tan(angle) ≈ 9,4 mm de la ligne d'esquisse qui l'a produite,
// au-delà des 8 mm de xAnchorFor — aucune ancre, repli position+hauteur figées, perdu dès que
// calibre (hauteur) ou angle (décalage) change. Correctif : xDraftDist corrige l'écart 2D de
// la dépouille dans xAnchorFor / xAnchorMatch / xAnchorStill.
// Noyau OCCT réel, document réel (tests/fixtures/barquette_depouille.json).
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  sandbox.__doc=fs.readFileSync(path.join(ROOT,'tests','fixtures','barquette_depouille.json'),'utf8');
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
  const R=[
    'const out={fails:[],log:[]};',
    'const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};',
    'occt=__realOcct;occtReady=true;',
    'await deserialise(__doc);occt=__realOcct;occtReady=true;markDirty();rebuild();',
    'const F=doc.features.find(f=>f.id==="xf_4_mvz708si");',
    'const nFaces=sh=>{let n=0;const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);while(ex.More()){n++;ex.Next();}ex.delete();return n;};',
    'const etat=()=>{const FR=occFinalShape(null);const e=F.edges[0];return{msgs:(FR.msgs||[]).filter(m=>/introuvable|impossible|perdu|aucune/i.test(m)),faces:FR.shape?nFaces(FR.shape):0,n:F.edges.length,y:+e.pos[1].toFixed(2),z:+e.pos[2].toFixed(2),anc:!!e.anchor,err:doc.features.filter(f=>f._err).map(f=>f.name)};};',
    'const pose=(cal,ang)=>{const P=n=>doc.params.find(p=>p.name===n);P("calibre").expr=String(cal);P("angle").expr=String(ang);parApplyAll();markDirty();rebuild();return etat();};',
    'A(builtEngine==="exact","rejeu exact ("+builtEngine+")");',
    'const e0=etat();',
    'A(e0.anc,"fichier : l’arête du fond reçoit une ancre d’esquisse malgré la dépouille");',
    'A(Math.abs(e0.y+59.62)<0.05&&Math.abs(e0.z+35)<0.05,"fichier : arête du fond y = −59,62, z = −35 (y "+e0.y+", z "+e0.z+")");',
    'F.visible=false;markDirty();rebuild();const nu=etat().faces;F.visible=true;markDirty();rebuild();',
    'const exp=(cal,ang)=>-(69-cal*Math.tan(ang*Math.PI/180));',
    'for(const [cal,ang] of [[40,15],[35,20],[30,10],[45,25],[35,15]]){',
    '  const s=pose(cal,ang);',
    '  A(Math.abs(s.y-exp(cal,ang))<0.05&&Math.abs(s.z+cal)<0.05,"calibre "+cal+", angle "+ang+" : arête suivie au fond (y "+s.y+" / "+exp(cal,ang).toFixed(2)+", z "+s.z+")");',
    '  A(s.faces>nu&&!s.err.length,"calibre "+cal+", angle "+ang+" : congé appliqué, "+s.faces+" faces contre "+nu+" sans congé ("+(s.err.join(" | ")||"aucune erreur")+")");',
    '}',
    'return out;'
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Congé sur arête d’une extrusion à dépouille (Barquette : calibre / angle) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
