// V0.95.10 — Fluidité des grosses pièces (plaque SIRAP-14-003, 109 fonctions, 684 faces) :
//  1. noyau multicœur : faces maillées en parallèle — triangles et normales IDENTIQUES au bit près
//     au maillage d'un seul fil (la FAO lit ce maillage) ;
//  2. normales : face plane lue une fois ; lissage sauté quand toutes les normales sont exactes —
//     mêmes valeurs que le calcul nœud par nœud d'avant ;
//  3. points de contrôle : un point RELU remonte en fin de file, il n'est plus évincé le premier.
'use strict';
const path=require('path'),vm=require('vm');
process.env.OCCT_DIR=path.join(__dirname,'..','occt','mt'); // noyau multicœur, lu au chargement de noyau.cjs
process.env.OCCT_FILS=process.env.OCCT_FILS||'4';
const {loadApp}=require('./appvm.cjs');
const lireProjet=require('./lire-projet.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;occtMtFils='+(+process.env.OCCT_FILS)+';',ctx);
  const R=s=>vm.runInContext(s,ctx);
  console.log('=== Maillage en parallèle, normales, points de contrôle ===');
  for(const f of [path.join(__dirname,'fixtures','barquette-exemple.conceptcad'),path.join(__dirname,'..','Exemples','Cavité Usinage.conceptcad')]){
    sandbox.__json=lireProjet(f);
    await R(String.raw`(async()=>{const raw=JSON.parse(__json);if(raw.doc)await bundleRestore(__json,{rebuild:false});else await deserialise(__json,{rebuild:false});markDirty();rebuild();})()`);
    const r=R(String.raw`(()=>{
      const sh=occLive.shape,o={};
      const mesh=(D,par)=>{const s=occShapeCopy(sh);occt.BRepTools.Clean(s,true);
        const m=new occt.BRepMesh_IncrementalMesh_2(s,D.lin,false,D.ang,par);m.delete();
        const T=occTriPos(s,D.lin,D.ang,true);return {s,T};};
      const egal=(a,b)=>{if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!(a[i]===b[i]||(a[i]!==a[i]&&b[i]!==b[i])))return false;return true;};
      o.par=[];
      for(const D of [occDisplayDefl(sh),{lin:0.01,ang:0.1}]){
        const a=mesh(D,false),b=mesh(D,true);
        o.par.push({tris:a.T.pos.length/9,pos:egal(a.T.pos,b.T.pos),nrm:egal(a.T.nrm,b.T.nrm)});
        // normales de référence : BRepGProp_Face à CHAQUE nœud (calcul d’avant V0.95.10)
        const ref=[],gP=new occt.gp_Pnt_1(),gV=new occt.gp_Vec_1();
        const ex=new occt.TopExp_Explorer_2(a.s,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
        let plans=0;
        while(ex.More()){const fc=occFaceCur(ex),loc=new occt.TopLoc_Location_1();const h=occt.BRep_Tool.Triangulation(fc,loc);
          if(h&&!h.IsNull()){const t=h.get();if(occFacePlane(fc))plans++;
            let rev=false;try{rev=fc.Orientation_1()===occt.TopAbs_Orientation.TopAbs_REVERSED;}catch(e){}
            const nn=[];if(t.HasUVNodes()){const bf=new occt.BRepGProp_Face_2(fc,false);
              for(let k=1;k<=t.NbNodes();k++){const uv=t.UVNode(k);bf.Normal(uv.X(),uv.Y(),gP,gV);uv.delete();const l=Math.hypot(gV.X(),gV.Y(),gV.Z());nn[k]=l>1e-12?[gV.X()/l,gV.Y()/l,gV.Z()/l]:[NaN,NaN,NaN];}bf.delete();}
            for(let i=1;i<=t.NbTriangles();i++){const tr=t.Triangle(i);let idx=[tr.Value(1),tr.Value(2),tr.Value(3)];tr.delete();if(rev)idx=[idx[0],idx[2],idx[1]];
              for(const k of idx)ref.push(...(nn[k]||[NaN,NaN,NaN]));}}
          occFree(h);occFree(fc);loc.delete();ex.Next();}
        ex.delete();gP.delete();gV.delete();
        o.par[o.par.length-1].ref=egal(ref,a.T.nrm);o.par[o.par.length-1].plans=plans;
        a.s.delete();b.s.delete();
      }
      // occTriNormals : sans normale manquante, le résultat est celui de l'ancien calcul (lissage recouvert)
      const T=occTriPos(sh,0.3,0.3,true),neuf=occTriNormals(T),vieux=smoothNormals(T.pos,35);
      for(let i=0;i<vieux.length;i+=3)if(T.nrm[i]===T.nrm[i]){vieux[i]=T.nrm[i];vieux[i+1]=T.nrm[i+1];vieux[i+2]=T.nrm[i+2];}
      o.tn=egal(Array.from(neuf),Array.from(vieux));
      // repli : une normale manquante garde le lissage
      // quelques normales manquantes (pointe de perçage) : lissées seules, même résultat que tout lisser
      const ancien=nr=>{const v=smoothNormals(T.pos,35);for(let i=0;i<v.length;i+=3)if(nr[i]===nr[i]){v[i]=nr[i];v[i+1]=nr[i+1];v[i+2]=nr[i+2];}return Array.from(v);};
      o.repli=true;
      for(const pas of [1e9,97,23]){const T2={pos:T.pos,nrm:T.nrm.slice()};
        for(let v=0;v<T2.nrm.length/3;v+=Math.min(pas,T2.nrm.length/3-1))T2.nrm[v*3]=T2.nrm[v*3+1]=T2.nrm[v*3+2]=NaN;
        if(!egal(Array.from(occTriNormals(T2)),ancien(T2.nrm)))o.repli=false;}
      return o;})()`);
    const nom=path.basename(f);
    r.par.forEach(p=>{
      A(p.pos&&p.nrm,nom+' : '+p.tris+' triangles, parallèle = un seul fil au bit près (positions et normales)');
      A(p.ref,nom+' : normales = calcul nœud par nœud d’avant ('+p.plans+' faces planes lues une fois)');
    });
    A(r.tn,nom+' : normales exactes partout → même résultat sans le lissage');
    A(r.repli,nom+' : normales manquantes (1, 1/97, 1/23 des nœuds) → lissées seules, même résultat que tout lisser');
  }
  A(R('occMeshParallele()')===true,'noyau multicœur : maillage en parallèle demandé');
  A(R('(()=>{const f=occtMtFils;occtMtFils=0;const r=occMeshParallele();occtMtFils=f;return r;})()')===false,'noyau normal : maillage d’un seul fil, comme avant');
  // Points de contrôle : un point relu n'est plus évincé le premier
  const lru=R(String.raw`(()=>{
    occCkClear();const max=occCkMax(),mk=()=>occShapeCopy(occLive.shape);
    occCkPut('banc|debut',mk);
    for(let i=0;i<max-1;i++){occCkPut('banc|'+i,mk);occCkGet('banc|debut');}
    for(let i=0;i<5;i++)occCkPut('banc|plus'+i,mk);
    const r={debut:!!occCkGet('banc|debut'),premier:!!occCkGet('banc|0'),taille:occCk.length,max};
    occCkClear();return r;})()`);
  A(lru.debut,'point de contrôle relu à chaque rejeu : toujours là après '+(lru.max+4)+' écritures');
  A(!lru.premier,'le plus ancien jamais relu est évincé à sa place');
  A(lru.taille===lru.max,'file bornée ('+lru.taille+' / '+lru.max+')');
  console.log(ko?'ÉCHEC : '+ko:'*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
