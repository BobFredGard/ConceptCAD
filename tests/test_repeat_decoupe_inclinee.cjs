// SYMÉTRIE DOUBLE D'UNE DÉCOUPE « À TRAVERS TOUT » INCLINÉE, ET DE SON CONGÉ, sur le vrai noyau OCCT.
// Retour utilisateur (Barquette) : découpe Ø30 inclinée au coin de la pièce, « je voulais le congé avec
// mais impossible ». La longueur de l'outil se mesurait sur 2 coins seulement de la boîte de la pièce :
// juste si l'axe penche vers (+,+,+) comme l'original, trop court sur ses images (axes (−,+,+)…). Les copies
// enlevaient presque rien, et le congé copié ne trouvait pas son arête.
// Ici : plaque 200×120×40, cylindre Ø20 incliné près du coin. Chaque coin doit enlever la même matière.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const body=String.raw`
    const out={};
    const vol=s=>{const G=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(s,G,false,false,false);const m=G.Mass();G.delete();return m;};
    const mesure=()=>{occCkClear();markDirty();rebuild();const FR=occFinalShape(null);
      const v=FR.shape?vol(FR.shape):null;if(FR.shape)try{FR.shape.delete();}catch(e){}return v;};
    const norm=a=>{const n=Math.hypot(a[0],a[1],a[2]);return a.map(x=>x/n);};
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const plaque={id:'sk_p',name:'Plaque',plane:'FACE',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],visible:false,constraints:[],dims:[],
      points:{a:{x:-100,y:-60},b:{x:100,y:-60},c:{x:100,y:60},d:{x:-100,y:60}},
      entities:[{id:'e1',t:'line',p1:'a',p2:'b'},{id:'e2',t:'line',p1:'b',p2:'c'},{id:'e3',t:'line',p1:'c',p2:'d'},{id:'e4',t:'line',p1:'d',p2:'a'}]};
    // esquisse du cylindre : centrée sur le coin, normale penchée vers (+,+,+) comme dans Barquette
    const N=norm([0.3236,0.3236,0.889]),U=norm(cross([0,1,0],N)),V=cross(N,U);
    const trou={id:'sk_t',name:'Trou',plane:'FACE',origin:[92,52,0],axU:U,axV:V,axN:N,visible:false,constraints:[],dims:[],
      points:{O:{x:0,y:0}},entities:[{id:'c1',t:'circle',pc:'O',r:10}]};
    doc.sketches=[plaque,trou];doc.cgeo=[];doc.bodies=[];tlMark=null;
    doc.features=[
      {id:'ex_p',type:'extrude',name:'Plaque',sketchId:'sk_p',distance:-40,op:'add',visible:true},
      {id:'ex_t',type:'extrude',name:'Découpe',sketchId:'sk_t',distance:null,through:true,op:'cut',visible:true}];
    out.plein=(()=>{const k=doc.features.splice(1);const v=mesure();doc.features.push(...k);return v;})();
    out.unTrou=mesure();
    const rp={id:'rp1',type:'repeat',name:'Symétrie double',mode:'mir',copies:2,q:1,plane:'YZ',plane2:'XZ',base:['ex_t'],children:[],visible:true};
    doc.features.push(rp);repGenChildren(rp);
    out.axes=doc.features.filter(f=>f.repeatId==='rp1').map(f=>doc.sketches.find(s=>s.id===f.sketchId).axN.map(x=>Math.sign(x)).join());
    out.quatre=mesure();
    // l'étendue de l'outil couvre toute la pièce, quel que soit le sens de l'axe
    const box=(()=>{const FR=occFinalShape(null);return FR.shape;})();
    out.etendues=[[1,1,1],[-1,1,1],[1,-1,1],[-1,-1,1]].map(s=>{
      const n=norm(s);
      const r=occSpanFromShape(box,{o:{x:0,y:0,z:0},n:{x:n[0],y:n[1],z:n[2]}});
      return r.hi-r.lo;});
    try{box.delete();}catch(e){}
    return out;`;
  const o=await vm.runInContext('(async()=>{'+body+'})()',ctx);
  const near=(a,b,t)=>a!=null&&Math.abs(a-b)<=(t||1e-3)*Math.max(1,Math.abs(b));
  console.log('=== Symétrie double d’une découpe inclinée (noyau OCCT réel) ===');
  const une=o.plein-o.unTrou;
  A(near(o.plein,960000),'plaque pleine : '+o.plein);
  A(une>5000,'le trou d’origine enlève de la matière : '+une.toFixed(1));
  A(o.axes.length===3,'3 copies : axes '+o.axes.join(' / '));
  A(near(o.plein-o.quatre,4*une),'les 4 coins enlèvent autant : '+(o.plein-o.quatre).toFixed(1)+' (attendu '+(4*une).toFixed(1)+')');
  A(o.etendues.every(e=>near(e,o.etendues[0],1e-2)),'même étendue pour tous les axes symétriques : '+o.etendues.map(e=>e.toFixed(1)).join(' / '));
  console.log(ko?'ÉCHEC : '+ko:'OK');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
