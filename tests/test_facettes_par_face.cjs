// V0.96.1 — Facettes d'affichage gardées face par face (src/20-25-facettes-par-face.js) :
//  1. chaque face maillée SEULE rend les mêmes triangles et normales que maillée avec toute la pièce
//     (c'est ce qui autorise à ne mailler que les faces modifiées) ;
//  2. occTriPosFaces = occTriPos au bit près (positions, normales, groupes de faces), au premier
//     passage (tout maillé), au second (tout repris) et après des modifications (reprise partielle) ;
//  3. le solide ressort ENTIÈREMENT maillé, comme par l'ancien chemin : même boîte (centre du corps),
//     et relu à une autre finesse (comme le fait la FAO) il rend les mêmes triangles ;
//  4. les faces intactes ne repassent pas par le mailleur (triangulation gardée greffée) ;
//  5. arêtes affichées : occSharpEdgesMemo rend la même liste, dans le même ordre, avec les mêmes
//     fiches que le classement complet (occSharpEdgesPlein), à chaque étape.
'use strict';
const path=require('path'),vm=require('vm');
const {loadApp}=require('./appvm.cjs');
const lireProjet=require('./lire-projet.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
const CAS=[
  {f:path.join(__dirname,'fixtures','barquette-exemple.conceptcad'),modifs:[[3,'distance',-2.6],[5,'distance',-9],[0,'distance',36],[3,'distance',-2.3]]},
  {f:path.join(__dirname,'..','Exemples','Cavité Usinage.conceptcad'),modifs:[[24,'distance',-4.5],[23,'distance',-6],[1,'distance',-29],[24,'distance',-4]]}
];
(async()=>{
  const real=await require('./noyau.cjs').charger();
  console.log('=== Facettes gardées face par face ===');
  for(const cas of CAS){
    const {ctx,sandbox}=loadApp();
    sandbox.__realOcct=real;
    vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
    const R=s=>vm.runInContext(s,ctx);
    sandbox.__json=lireProjet(cas.f);sandbox.__modifs=cas.modifs;
    await R(String.raw`(async()=>{const raw=JSON.parse(__json);if(raw.doc)await bundleRestore(__json,{rebuild:false});else await deserialise(__json,{rebuild:false});markDirty();rebuild();})()`);
    const r=R(String.raw`(()=>{
      const E=occt.TopAbs_ShapeEnum,o={etapes:[]};
      const propre=sh=>{const cb=new occt.BRepBuilderAPI_Copy_2(sh,true,false);const s=cb.Shape();cb.delete();return s;};
      const faces=sh=>{const L=[];const ex=new occt.TopExp_Explorer_2(sh,E.TopAbs_FACE,E.TopAbs_SHAPE);while(ex.More()){L.push(occFaceCur(ex));ex.Next();}ex.delete();return L;};
      const mailles=sh=>{let n=0;faces(sh).forEach(f=>{const loc=new occt.TopLoc_Location_1(),h=occt.BRep_Tool.Triangulation(f,loc);if(h&&!h.IsNull())n++;try{h.delete();}catch(e){}loc.delete();f.delete();});return n;};
      const egal=(a,b)=>{if(!a||!b||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))return false;return true;};
      const memeT=(a,b)=>egal(a.pos,b.pos)&&egal(a.nrm,b.nrm)&&JSON.stringify(a.groups)===JSON.stringify(b.groups);
      const memeN=(a,b)=>egal(occTriNormals(a),occTriNormals(b));
      const corps=()=>bodies.filter(b=>b.kind==='body'&&b.shape);
      const D=occDisplayDefl(occLive.shape);o.dispo=occFaceMemoDispo();
      // 1. chaque face seule = la même face dans le maillage complet
      {const S=propre(corps()[0].shape),T=occTriPos(S,D.lin,D.ang,true),par=new Map();T.groups.forEach(g=>par.set(g.f,g));
        const S1=propre(corps()[0].shape),F1=faces(S1);let d=0;
        F1.forEach((f,i)=>{const b=new occt.BRep_Builder(),c=new occt.TopoDS_Compound();b.MakeCompound(c);b.Add(c,f);
          const t=occTriPos(c,D.lin,D.ang,true),g=par.get(i);
          const ok=g?(egal(t.pos,T.pos.slice(g.start*9,(g.start+g.count)*9))&&egal(t.nrm,T.nrm.slice(g.start*9,(g.start+g.count)*9))):t.pos.length===0;
          if(!ok)d++;b.delete();c.delete();f.delete();});
        o.seules={n:F1.length,diff:d};S.delete();S1.delete();}
      // 2 à 4. comparaison à chaque étape, sur chaque corps
      const etape=(nom,avant)=>{
        const st0=Object.assign({},occFaceMemoStat);
        const e={nom,corps:[]};
        for(const b of corps()){
          const ref=propre(b.shape),T0=occTriPos(ref,D.lin,D.ang,true);
          const s=propre(b.shape),T1=occTriPosFaces(s,D.lin,D.ang);
          const boite=JSON.stringify(occSolidBox(ref))===JSON.stringify(occSolidBox(s));
          const etat=mailles(s)===mailles(ref)&&mailles(s)>0;
          const A1=occTriPos(ref,0.1,0.3,true),A2=occTriPos(s,0.1,0.3,true); // relecture à une autre finesse, comme la FAO
          // maillage d'outillage de la FAO (faoLegacyGeo) : solide nettoyé, puis finesse occXDefl
          const X=occXDefl(),o1=propre(b.shape),o2=propre(b.shape),O1=occTriPos(o1,X.lin,X.ang,true),O2=occTriPosFaces(o2,X.lin,X.ang);
          const outil=!!O2&&memeT(O1,O2)&&memeN(O1,O2)&&mailles(o1)===mailles(o2)&&JSON.stringify(occSolidBox(o1))===JSON.stringify(occSolidBox(o2));
          o1.delete();o2.delete();
          e.corps.push({id:b.id,rendu:!!T1,pareil:!!T1&&memeT(T0,T1),normales:!!T1&&memeN(T0,T1),centre:boite,sansTriangles:etat,fao:memeT(A1,A2)&&outil,tris:T0.pos.length/9});
          ref.delete();s.delete();
        }
        {const a0=avant||Object.assign({},occAreteMemoStat);const P=occSharpEdgesPlein(occLive.shape),M=occSharpEdgesMemo(occLive.shape);
          e.aretes={n:P.length,vives:P.filter(x=>x.sharp).length,rendu:!!M,pareil:!!M&&JSON.stringify(P)===JSON.stringify(M),
            reprises:occAreteMemoStat.reprises-a0.reprises,classees:occAreteMemoStat.classees-a0.classees};
          const parCorps=corps().every(b=>{const p=occSharpEdgesPlein(b.shape),m=occSharpEdgesMemo(b.shape);return !!m&&JSON.stringify(p)===JSON.stringify(m);});
          e.aretes.parCorps=parCorps;}
        e.faces=occFaceMemoStat.faces-st0.faces;e.reprises=occFaceMemoStat.reprises-st0.reprises;e.maillees=occFaceMemoStat.maillees-st0.maillees;
        o.etapes.push(e);
      };
      occFaceMemoClear();
      etape('premier passage');etape('second passage');
      for(const [i,champ,v] of __modifs){const f=doc.features[i];f[champ]=v;if(f.expr)delete f.expr[champ];const av=Object.assign({},occAreteMemoStat);markDirty();rebuild();try{occVisibleSharpEdges();}catch(e){}etape(f.type+' '+i+' '+champ+'='+v,av);}
      // affichage réel : le solide des corps affichés est sans triangles
      o.affiches=corps().map(b=>mailles(b.shape)-faces(b.shape).map(f=>f.delete()).length);
      o.stat=Object.assign({},occFaceMemoStat);o.coupe=occFaceMemoOff;
      return o;
    })()`);
    console.log('— '+path.basename(cas.f));
    A(r.dispo,'voie disponible dans ce noyau');
    A(r.seules.diff===0,r.seules.n+' faces maillées une par une : mêmes triangles et normales que maillées ensemble');
    r.etapes.forEach((e,k)=>{
      const tous=e.corps.length>0&&e.corps.every(c=>c.rendu&&c.pareil&&c.normales&&c.centre&&c.sansTriangles&&c.fao);
      A(tous,e.nom+' : identique au maillage complet, même boîte, solide entièrement maillé, même relecture à 0,1 mm, même maillage d’outillage FAO ('+e.corps.map(c=>c.tris).join('+')+' triangles ; '+e.reprises+' faces reprises, '+e.maillees+' maillées)');
      if(!tous)console.log('    '+JSON.stringify(e.corps));
      A(e.aretes.rendu&&e.aretes.pareil&&e.aretes.parCorps&&e.aretes.n>0,e.nom+' : arêtes identiques au classement complet ('+e.aretes.n+' arêtes dont '+e.aretes.vives+' vives ; '+e.aretes.reprises+' reprises, '+e.aretes.classees+' classées)');
      if(k===0)A(e.aretes.reprises===0,'premier passage : toutes les arêtes sont classées');
      if(k===1)A(e.aretes.classees===0,'second passage : toutes les arêtes sont reprises');
      if(k===0)A(e.reprises===0&&e.maillees===e.faces,'premier passage : tout est maillé');
      if(k===1)A(e.maillees*20<=e.faces,'second passage : tout est repris, sauf les faces à position propre ('+e.maillees+' sur '+e.faces+' repassent par le mailleur)');
      if(k>1)A(e.reprises>0,e.nom+' : des faces sont reprises ('+e.maillees+' faces sur '+e.faces+' remaillées)');
    });
    A(r.etapes.filter((e,k)=>k>1&&e.aretes.classees>0&&e.aretes.reprises>e.aretes.classees).length>=1,'au moins une modification ne reclasse qu’une partie des arêtes');
    A(r.etapes.filter((e,k)=>k>1&&e.maillees>0&&e.maillees<e.faces).length>=2,'au moins deux modifications ne remaillent qu’une partie des faces');
    A(r.affiches.every(n=>n===0),'corps affichés : toutes les faces du solide portent leur triangulation');
    A(!r.coupe&&r.stat.replis===0,'aucun repli sur l’ancien chemin');
  }
  if(ko){console.log('ÉCHEC : '+ko);process.exit(1);}
  console.log('OK');
})().catch(e=>{console.error(e);process.exit(1);});
