// ALERTES « PAROI MINCE » sur le vrai noyau OCCT (2026-10-27). Retour utilisateur (Cavité Test) :
// une dépouille de 25° autour du dessus incliné d'une nervure de 5 mm la ramenait à 1,2 mm au
// pied, SANS AUCUN AVERTISSEMENT ; les congés posés ensuite échouaient avec « arête de 0,73 mm
// trop courte », ce qui ne disait rien de la vraie cause. Désormais :
//  1) la dépouille compare l'épaisseur entre ses faces opposées avant / après (occDraftThin) et
//     lève une alerte (journal + f._thin → ⚠ dans l'arbre) si elle chute de plus de moitié ;
//  2) un congé refusé mesure la paroi autour de ses arêtes (occWallAt) et la nomme si elle est
//     plus mince que 2 × R.
// Pièce : plaque 60 × 60 × 10, nervure 5 × 40 × 20 posée dessus (x 27,5..32,5), flancs x
// dépouillés autour du dessus de la plaque (plan neutre z = 10) : à 5° le haut de la nervure
// passe de 5 à 5 − 2·20·tan 5° ≈ 1,5 mm (alerte), à 1° ≈ 4,3 mm (rien).
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=`
  const P=[];const p=s=>P.push(String(s));
  const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
  const rect=(id,x0,y0,x1,y1,z)=>{const sk={id,name:id,plane:'XY',origin:[0,0,z||0],points:{},entities:[],constraints:[],dims:[]};
    [['p0',x0,y0,'e0','p1'],['p1',x1,y0,'e1','p2'],['p2',x1,y1,'e2','p3'],['p3',x0,y1,'e3','p0']].forEach(l=>{
      sk.points[l[0]]={x:l[1],y:l[2]};sk.entities.push({id:l[3],t:'line',p1:l[0],p2:l[4]});});return sk;};
  const faces=()=>{markDirty();rebuild();const FR=occFinalShape(null);const out=[];
    const ex=new occt.TopExp_Explorer_2(FR.shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while(ex.More()){const f=occt.TopoDS.Face_1(ex.Current());const r=occFaceRef(f);try{f.delete();}catch(e){}if(r)out.push(r);ex.Next();}
    ex.delete();try{FR.shape.delete();}catch(e){}return out;};
  const base=()=>{
    doc.sketches=[rect('sk_pl',0,0,60,60),rect('sk_nv',27.5,10,32.5,50,10)];doc.cgeo=[];
    doc.features=[{id:'ex_pl',type:'extrude',name:'Plaque',sketchId:'sk_pl',op:'add',distance:10,visible:true},
      {id:'ex_nv',type:'extrude',name:'Nervure',sketchId:'sk_nv',op:'add',distance:20,visible:true}];
    occCkClear();
    const F=faces();
    const ref=F.find(r=>r.n[2]>0.99&&Math.abs(r.pos[2]-10)<1e-3);
    const fl=F.filter(r=>Math.abs(Math.abs(r.n[0])-1)<1e-6&&r.pos[2]>10&&Math.abs(r.pos[0]-30)<3);
    att(ref&&fl.length===2,'pièce : dessus de plaque '+(ref?'trouvé':'absent')+', '+fl.length+' flanc(s) de nervure au lieu de 2');
    return{ref,fl};
  };
  const scen=(a,alerte)=>{
    const b=base();
    const dr={id:'dr_t',type:'xdraft',name:'Dépouille',ref:b.ref,faces:b.fl,angle:a,visible:true};
    doc.features.push(dr);
    occCkClear();markDirty();rebuild();const FR=occFinalShape(null);
    const m=(FR.msgs||[]).find(x=>/amincie|se rejoignent/.test(x));
    p(a+'° : dépouille '+(dr._m?dr._m.m+'/'+dr._m.t:'?')+' — '+(m||'aucune alerte'));
    att(dr._m&&dr._m.m===2,a+'° : dépouille non appliquée');
    att(!!m===alerte,a+'° : alerte '+(alerte?'absente':'inattendue : '+m));
    att(!!dr._thin===alerte,a+'° : _thin '+(alerte?'absent (pas de ⚠ dans l arbre)':'inattendu'));
    att(featIconOf(dr)===(alerte?'⚠':'📐'),a+'° : icône '+featIconOf(dr));
    if(alerte&&m){const g=/de 5 à ([0-9]+,?[0-9]*) mm/.exec(m);const t=g?+g[1].replace(',','.'):NaN;
      att(Math.abs(t-(5-2*20*Math.tan(a*Math.PI/180)))<0.1,a+'° : épaisseur annoncée '+t);}
    // rejeu depuis le point de contrôle : l'alerte reste
    markDirty();rebuild();const F2=occFinalShape(null);
    att(!!(F2.msgs||[]).find(x=>/amincie|se rejoignent/.test(x))===alerte,a+'° : alerte perdue au rejeu depuis le cache');
    att(!!dr._thin===alerte,a+'° : _thin perdu au rejeu depuis le cache');
    try{FR.shape.delete();F2.shape.delete();}catch(e){}
    return dr;
  };
  scen(1,false);
  scen(5,true);
  // ---------- congé R2 sur les deux arêtes du haut de la nervure amincie (~1,5 mm) ----------
  {
    scen(5,true);
    markDirty();rebuild();const FR=occFinalShape(null);
    const E=occListEdges(FR.shape).filter(e=>e.pts.every(q=>Math.abs(q[2]-30)<1e-3)&&e.len>30);
    try{FR.shape.delete();}catch(e){}
    att(E.length===2,'congé : '+E.length+' arête(s) longue(s) en haut de nervure au lieu de 2');
    const xf={id:'xf_t',type:'xfillet',name:'Congé',edges:E.map(e=>({pos:e.mid.slice(),r:2,len:+e.len.toFixed(3),seed:1})),tangent:true,visible:true};
    doc.features.push(xf);
    occCkClear();markDirty();rebuild();const F2=occFinalShape(null);try{F2.shape.delete();}catch(e){}
    p('congé R2 : '+(xf._err||'passé'));
    att(xf._err&&/paroi de 1,[0-9]+ mm/.test(xf._err),'congé : la paroi mince n est pas nommée ('+xf._err+')');
    att(!(xf._err&&/arête trop courte/.test(xf._err)),'congé : encore « arête trop courte »');
  }
  if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  ✗ '+m));}
  else{p('');p('TOUT EST CONFORME');}
  return P.join('\\n');`;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'alerte_paroi.js'});
  console.log(r);
  process.exit(/ECHECS|✗/.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
