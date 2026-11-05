function occDiskPrism(sk,Cx,Cy,r,sp){
  // Pastille pleine (cercles isolés) : cercle -> wire -> face -> UN prisme.
  // sp = plage {lo,hi} (ou nombre pour compat) : cercle construit au plan décalé z0=lo,
  // prisme unique de longueur hi-lo → même plage que les contours, sans couture coplanaire.
  const bin=[];
  try{
    const lo=(sp&&typeof sp==='object')?sp.lo:Math.min(0,+sp||0);
    const hi=(sp&&typeof sp==='object')?sp.hi:Math.max(0,+sp||0);
    const len=hi-lo;
    if(!(len>1e-9))throw new Error('prisme pastille vide (course nulle)');
    const{u,v,n}=sketchBasis(sk);
    const OP=w=>lo?[w[0]+n.x*lo,w[1]+n.y*lo,w[2]+n.z*lo]:w;
    const Cw=OP(occW(sk,Cx,Cy));
    const dir=occBinPush(bin,new occt.gp_Dir_4(n.x,n.y,n.z));
    const ax=occBinPush(bin,new occt.gp_Ax2_3(occBinPush(bin,new occt.gp_Pnt_3(Cw[0],Cw[1],Cw[2])),dir));
    const circ=occBinPush(bin,new occt.gp_Circ_2(ax,r));
    const mkW=occBinPush(bin,new occt.BRepBuilderAPI_MakeWire_1());
    // V0.11.5 : UNE arête de cercle fermée (plus 2 demi-arcs) → un seul cylindre, sans jonction
    const m1=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge_8(circ));m1.Build();
    if(!m1.IsDone())throw new Error('pastille impossible');
    mkW.Add_1(m1.Edge());mkW.Build();
    if(!mkW.IsDone())throw new Error('pastille non fermée');
    const fm=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace_15(mkW.Wire(),true));
    fm.Build();if(!fm.IsDone())throw new Error('face pastille impossible');
    const vec=occBinPush(bin,new occt.gp_Vec_4(n.x*len,n.y*len,n.z*len));
    const pr=occBinPush(bin,new occt.BRepPrimAPI_MakePrism_1(fm.Face(),vec,false,true));
    pr.Build();if(!pr.IsDone())throw new Error('prisme pastille impossible');
    const s=pr.Shape();
    nomsNomme(s,(m,fn)=>{
      occAvec(mkW.Edge(),c=>nomsChaque(pr.Generated(c),y=>{const j=m.FindIndex(y);if(j>0)fn[j-1]='cercle/flanc';}));
      const q=nomsBoutsPrisme(pr),a=m.FindIndex(q[0]),b=m.FindIndex(q[1]);occDispose(q);
      if(a>0)fn[a-1]='bas';if(b>0)fn[b-1]='haut';
    });
    return{shape:s,bin};
  }catch(err){occDispose(bin);throw err;}
}
function rimEdgeJobs(edges,o,n,d,rsTop,rsBot){
  // Arêtes de périmètre (haut/bas) du prisme — axe n depuis origine o, course d
  // (nombre signé OU plage {lo,hi} pour le mode symétrique).
  const jobs=[];
  if(!(rsTop>0||rsBot>0))return jobs;
  const tHi=(d&&typeof d==='object')?d.hi:Math.max(0,d);
  const tLo=(d&&typeof d==='object')?d.lo:Math.min(0,d);
  const tol=0.6;
  for(const e of edges){
    try{
      const p0=e.pts[0],p1=e.pts[e.pts.length-1];
      const ax=p1[0]-p0[0],ay=p1[1]-p0[1],az=p1[2]-p0[2];
      const tn=ax*n.x+ay*n.y+az*n.z,len2=ax*ax+ay*ay+az*az;
      if(len2>0&&Math.abs(tn)>Math.sqrt(len2)*0.7)continue; // arête le long de n (verticale)
      const m=e.mid;
      const t=(m[0]-o.x)*n.x+(m[1]-o.y)*n.y+(m[2]-o.z)*n.z;
      if(rsTop>0&&Math.abs(t-tHi)<tol){jobs.push({src:e.src,r:rsTop,mid:m&&m.slice()});continue;}
      if(rsBot>0&&Math.abs(t-tLo)<tol)jobs.push({src:e.src,r:rsBot,mid:m&&m.slice()});
    }catch(err){}
  }
  return jobs;
}
function xKindOf(f){return f&&f.chamfer?'chamfer':'fillet';}
function xIsChamfer(k){return k==='chamfer';}
function xLabel(k){return xIsChamfer(k)?'Chanfrein exact':'Congé exact';}
function xLabelLow(k){return xIsChamfer(k)?'chanfrein exact':'congé exact';}
function xIcon(k){return xIsChamfer(k)?'⟋':'⤢';}
function xDimPrefix(k){return xIsChamfer(k)?'D':'R';}
function xFeatName(f){return xLabel(xKindOf(f))+' ('+((f&&f.edges)||[]).length+' arête(s))';}
/* V0.11.19 : CHANFREIN à deux distances ou distance + angle (idée SolidCraft `solid.chamfer`).
   Champs de la fonction (et du mode de commande filModeX) : cmode 'eq' (défaut, distance égale,
   comme avant) | 'd2' (D1 par arête, D2 = cd2 sur la seconde face) | 'da' (D1 par arête, angle
   cang en degrés entre le chanfrein et la première face) ; cflip inverse la première face.
   Première face = celle des deux qui regarde le plus vers le haut (+Z), à égalité vers +X puis
   +Y : règle stable d'un rejeu à l'autre, l'aperçu montre le résultat et « inverser » l'échange. */
function xChamOpts(f){
  if(!f||!f.chamfer)return null;
  const m=f.cmode==='d2'||f.cmode==='da'?f.cmode:'eq';
  if(m==='eq')return null;
  return{mode:m,d2:+f.cd2>0?+f.cd2:0,ang:+f.cang>0&&+f.cang<90?+f.cang:45,flip:!!f.cflip};
}
function xChamKey(c){return c?c.mode+':'+(+c.d2||0)+':'+(+c.ang||0)+':'+(c.flip?1:0):'eq';}
function xChamLabel(f){
  // Suffixe lisible du mode d'un chanfrein : « D1 × D2 » ou « D1 ∠ 30° »
  const c=xChamOpts(f);if(!c)return '';
  const n=v=>String(+(+v).toFixed(2)).replace('.',',');
  return (c.mode==='d2'?' · D2 '+n(c.d2):' · ∠ '+n(c.ang)+'°')+(c.flip?' ⇄':'');
}
function occEdgeAt(shape,src){
  // Handle de l'arête de rang `src` (rang explorateur TopExp, le même que occListEdges). À libérer.
  const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_EDGE,SH);
  let k=0,out=null;
  while(ex.More()){if(k===src){out=occEdgeCur(ex);break;}k++;ex.Next();}
  try{ex.delete();}catch(e){}
  return out;
}
function occEdgeFaces(shape,edge){
  // Faces qui portent `edge` (au plus 2), avec leur normale SORTANTE au milieu de l'arête
  // (pcurve → UV → normale de surface, signe par l'orientation de la face). Handles des faces
  // à libérer par l'appelant ; n = null si la surface ne donne pas de normale.
  const out=[],bin=[];
  try{
    const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
    const fx=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);bin.push(fx);
    while(fx.More()&&out.length<2){
      const f=occFaceCur(fx);
      let has=false;
      const ee=new occt.TopExp_Explorer_2(f,occt.TopAbs_ShapeEnum.TopAbs_EDGE,SH);bin.push(ee);
      while(ee.More()){if(ee.Current().IsSame(edge)){has=true;break;}ee.Next();}
      if(!has){try{f.delete();}catch(e){}fx.Next();continue;}
      let n=null;
      try{
        const g=new occt.BRepAdaptor_Curve2d_2(edge,f);bin.push(g);
        const w0=g.FirstParameter(),w1=g.LastParameter();
        const q=g.Value((w0+w1)/2);bin.push(q);
        const loc=new occt.TopLoc_Location_1();bin.push(loc);
        const s=occt.BRep_Tool.Surface_1(f,loc);bin.push(s);
        n=occSurfNormalAt(s,q.X(),q.Y());
        if(n){
          let rev=false;try{rev=(f.Orientation_1()===occt.TopAbs_Orientation.TopAbs_REVERSED);}catch(e){}
          const L=Math.hypot(n[0],n[1],n[2])||1,sg=rev?-1:1;
          n=[n[0]*sg/L,n[1]*sg/L,n[2]*sg/L];
        }
      }catch(e){n=null;}
      out.push({f,n});fx.Next();
    }
  }catch(e){}
  occDispose(bin);
  return out;
}
function occChamferFirstFace(shape,edge,flip,fn){
  // Première face d'un chanfrein asymétrique (voir xChamOpts) : {f (handle à libérer), n}.
  // `fn` (normale mémorisée par l'arête à la création, transformée avec une répétition) :
  // la face dont la normale s'en rapproche le plus — l'image de la première face de la
  // source, quelle que soit la rotation ou la symétrie de la copie. Sans `fn` : la règle
  // « regarde le plus vers le haut, sinon +X puis +Y ».
  const fl=occEdgeFaces(shape,edge);
  if(!fl.length)return null;
  const byFn=Array.isArray(fn)&&fn.length===3;
  const score=o=>!o.n?[-2,-2,-2]:byFn?[o.n[0]*fn[0]+o.n[1]*fn[1]+o.n[2]*fn[2],0,0]:[o.n[2],o.n[0],o.n[1]];
  const cmp=(a,b)=>{const A=score(a),B=score(b);for(let k=0;k<3;k++){const d=A[k]-B[k];if(Math.abs(d)>1e-6)return d;}return 0;};
  let best=0;for(let i=1;i<fl.length;i++)if(cmp(fl[i],fl[best])>0)best=i;
  const pick=(flip&&fl.length>1)?(best===0?1:0):best;
  fl.forEach((o,i)=>{if(i!==pick){try{o.f.delete();}catch(e){}}});
  return{f:fl[pick].f,n:fl[pick].n};
}
/* V0.11.19 : DÉPOUILLE à angle signé + inversion. L'angle enregistré peut être négatif ;
   `flip` inverse en plus le sens sans toucher à la valeur (une expression ƒx reste liée).
   Angle effectif positif = la pièce se resserre le long de la normale de la face de référence
   (démoulage dans ce sens) ; négatif = elle s'évase (démoulage dans l'autre sens). */
function draftAngleEff(f){return (f&&f.flip?-1:1)*(+(f&&f.angle)||0);}
function draftAngleOk(a){return isFinite(a)&&Math.abs(a)>1e-9&&Math.abs(a)<90;}
// 2026-10-16-015 : congé / chanfrein d'UNE arête SANS suivre la chaîne tangente (OCCT la suit
// toujours) — arête DROITE et CONVEXE entre deux faces : le secteur de matière est mesuré au
// classificateur, l'outil (triangle du coin − disque du congé, ou triangle seul pour un
// chanfrein) est extrudé le long de l'arête en DÉBORDANT devant et derrière, puis soustrait.
function occSingleEdgeTool(shape,pts,r,chamfer,cham,firstN,info){
  // cham/firstN (V0.11.19) : chanfrein asymétrique — options xChamOpts et normale sortante de
  // la PREMIÈRE face (celle qui porte D1) ; sans normale utilisable, l'outil renonce (null →
  // repli noyau, qui sait faire).
  if(!pts||pts.length<2||!(r>0))return null;
  if(chamfer&&cham&&!firstN)return null;
  const A=pts[0],B=pts[pts.length-1];
  const sub=(p,q)=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]],add=(p,q)=>[p[0]+q[0],p[1]+q[1],p[2]+q[2]],mul=(p,k)=>[p[0]*k,p[1]*k,p[2]*k];
  const dot=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2],len=p=>Math.hypot(p[0],p[1],p[2]),nrm=p=>{const l=len(p)||1;return mul(p,1/l);};
  const cross=(p,q)=>[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
  const L=len(sub(B,A));if(L<1e-6)return null;
  const t=nrm(sub(B,A));
  for(const p of pts){const w=sub(p,A),d=dot(w,t);if(len(sub(w,mul(t,d)))>1e-4*Math.max(1,L))return null;} // arête droite seulement
  const M=mul(add(A,B),0.5);
  const a0=Math.abs(t[0])<0.9?[1,0,0]:[0,1,0];
  const u=nrm(sub(a0,mul(t,dot(a0,t)))),v=cross(t,u);
  const dir=th=>add(mul(u,Math.cos(th)),mul(v,Math.sin(th)));
  const bin=[];
  try{
    const cl=occClassifier(shape);bin.push(cl);
    const IN=occt.TopAbs_State.TopAbs_IN;
    const eps=Math.max(1e-3,Math.min(0.05,r*0.05));
    const inAt=th=>{const q=add(M,mul(dir(th),eps));const P=new occt.gp_Pnt_3(q[0],q[1],q[2]);cl.Perform(P,1e-7);const s=cl.State();try{P.delete();}catch(e){}return s===IN;};
    const N=180,S=[];for(let k=0;k<N;k++)S.push(inAt(2*Math.PI*k/N));
    const starts=[];for(let k=0;k<N;k++)if(S[k]&&!S[(k+N-1)%N])starts.push(k);
    if(starts.length!==1)return null; // pas une arête simple entre 2 faces
    let k1=starts[0],k2=k1;while(S[(k2+1)%N]&&((k2+1)%N)!==k1)k2=(k2+1)%N;
    const bis=(lo,hi,want)=>{for(let i=0;i<14;i++){const m=(lo+hi)/2;if(inAt(m)===want)hi=m;else lo=m;}return(lo+hi)/2;};
    const st=2*Math.PI/N;
    const th1=bis(2*Math.PI*k1/N-st,2*Math.PI*k1/N,true); // passage dehors → dedans
    const th2=bis(2*Math.PI*(k2+1)/N,2*Math.PI*k2/N,true); // passage dedans → dehors (côté fin)
    let al=th2-th1;while(al<0)al+=2*Math.PI;while(al>2*Math.PI)al-=2*Math.PI;
    if(!(al>0.05&&al<Math.PI-0.02))return null; // arête concave (ou plate) : repli OCCT
    let d1=dir(th1),d2=dir(th2);
    // Directions EXACTES dans les faces planes qui bordent l'arête : la bissection du
    // classifieur n'est juste qu'à ~1e-4 rad. Le cylindre n'était alors plus tout à fait
    // tangent et la découpe laissait deux languettes de 0,002 mm² le long des lignes de
    // tangence ; le congé ou chanfrein SUIVANT sur ce corps échouait en silence (découpe
    // « réussie », volume inchangé). Face courbe : la bissection reste.
    const snap=d=>{
      let best=null,bd=0.999;
      occSubShapes(shape,'TopAbs_FACE').forEach(f=>{
        const sd=occSurfDesc(f);
        try{f.delete();}catch(e){}
        if(sd.k!=='pl'||Math.abs(dot(sub(A,sd.p),sd.n))>1e-5||Math.abs(dot(sub(B,sd.p),sd.n))>1e-5)return;
        let c=nrm(cross(sd.n,t));if(dot(c,d)<0)c=mul(c,-1);
        if(dot(c,d)>bd){bd=dot(c,d);best=c;}
      });
      return best||d;
    };
    d1=snap(d1);d2=snap(d2);
    al=Math.acos(Math.max(-1,Math.min(1,dot(d1,d2))));
    if(!(al>0.05&&al<Math.PI-0.02))return null;
    const b=nrm(add(d1,d2));
    let s=chamfer?r:r/Math.tan(al/2),s1=s,s2=s;
    if(chamfer&&cham){
      // D1 sur la première face, D2 sur l'autre. Les directions d1/d2 sont DANS les faces :
      // celle de la première face est perpendiculaire à sa normale (produit scalaire ~0).
      const inFirst1=Math.abs(dot(d1,firstN))<Math.abs(dot(d2,firstN));
      let D2=cham.mode==='da'
        ?r*Math.sin(cham.ang*Math.PI/180)/Math.sin(al+cham.ang*Math.PI/180) // loi des sinus (triangle M,T1,T2)
        :cham.d2;
      if(!(D2>0))return null;
      s1=inFirst1?r:D2;s2=inFirst1?D2:r;s=Math.max(s1,s2);
    }
    const T1=add(M,mul(d1,s1)),T2=add(M,mul(d2,s2));
    const Eo=sub(M,mul(b,0.5*s+0.5)); // sommet du triangle repoussé HORS matière (pas de face coplanaire)
    const o=Math.max(2*s,2),half=L/2+o;
    // Le débordement ne doit traverser que du vide : l'outil dépasse la section du chanfrein (côté Eo),
    // et au bout d'une arête bornée par un mur (fond de rainure) il entaillait la matière du mur.
    // Sondes dans la partie de la section qui est HORS matière le long de l'arête : si l'une tombe
    // dans la matière après le bout, l'outil s'arrête là. La partie M,T1,T2 n'est pas sondée :
    // une face tangente qui continue (arc) doit rester chanfreinée par le débordement.
    const sect=[];
    [T1,T2].forEach(T=>[[.1,.45,.45],[.34,.33,.33],[.1,.8,.1],[.1,.1,.8],[.6,.2,.2]].forEach(w=>{
      sect.push(add(add(mul(Eo,w[0]),mul(T,w[1])),mul(M,w[2])));
    }));
    const libre=(sg,d)=>sect.every(q=>{
      const p=add(q,mul(t,sg*(L/2+d))),G=new occt.gp_Pnt_3(p[0],p[1],p[2]);
      cl.Perform(G,1e-7);const st8=cl.State();try{G.delete();}catch(e){}
      return st8!==IN;
    });
    const portee=sg=>{
      if(!libre(sg,1e-3))return 0;
      const n=8;let lo=1e-3;
      for(let k=1;k<=n;k++){
        const d=o*k/n;
        if(libre(sg,d)){lo=d;continue;}
        let hi=d;for(let i=0;i<10;i++){const m=(lo+hi)/2;if(libre(sg,m))lo=m;else hi=m;}
        return lo;
      }
      return o;
    };
    const oA=portee(-1),oB=portee(1);
    if(info)info.borne=oA<o||oB<o;
    const at0=p=>sub(p,mul(t,L/2+oA));
    const P=p=>{const q=new occt.gp_Pnt_3(p[0],p[1],p[2]);bin.push(q);return q;};
    const poly=new occt.BRepBuilderAPI_MakePolygon_3(P(at0(Eo)),P(at0(T1)),P(at0(T2)),true);bin.push(poly);
    if(!poly.IsDone())return null;
    const fm=new occt.BRepBuilderAPI_MakeFace_15(poly.Wire(),true);bin.push(fm);if(!fm.IsDone())return null;
    const lgOutil=L+oA+oB;
    const vec=new occt.gp_Vec_4(t[0]*lgOutil,t[1]*lgOutil,t[2]*lgOutil);bin.push(vec);
    const pr=new occt.BRepPrimAPI_MakePrism_1(fm.Face(),vec,false,true);bin.push(pr);pr.Build();if(!pr.IsDone())return null;
    let tool=pr.Shape();
    if(!chamfer){
      const h=r/Math.sin(al/2),C=add(M,mul(b,h)),C0=sub(C,mul(t,half+1));
      const dd=new occt.gp_Dir_4(t[0],t[1],t[2]);bin.push(dd);
      const ax=new occt.gp_Ax2_3(P(C0),dd);bin.push(ax);
      const cy=new occt.BRepPrimAPI_MakeCylinder_3(ax,r,2*half+2);bin.push(cy);
      tool=occCut(tool,cy.Shape());
    }
    return tool;
  }catch(e){return null;}
  finally{occDispose(bin);}
}
function occFilletRun(base,jobs,warns,chamfer,opts){
  // Arrondi/chanfrein BRep : 1) le lot en une passe (rapide), 2) si Build échoue → ARÊTE PAR ARÊTE
  // sur la shape courante (chaque succès conservé — une arête capricieuse ne fait plus
  // tomber toutes les autres). Les srcs changent après chaque arrondi : relocalisation
  // par le milieu mémorisé (mid). Retourne null si rien n'a pu être arrondi.
  const kindLabel=chamfer?'chanfrein':'arrondi';
  const cham=chamfer&&opts&&opts.cham?opts.cham:null; // V0.11.19 : deux distances / distance + angle
  const mk=(cur,js)=>{
    const bin=[];
    try{
      const want=new Map(js.map(j=>[j.src,j]));
      const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
      const ex=new occt.TopExp_Explorer_2(cur,occt.TopAbs_ShapeEnum.TopAbs_EDGE,SH);bin.push(ex);
      const hs=[];let k=0;
      while(ex.More()){if(want.has(k)){const h=occEdgeCur(ex);bin.push(h);const w=want.get(k);hs.push({h,r:w.r,fn:w.fn||null});}k++;ex.Next();}
      occDispose([ex]);
      if(!hs.length){occDispose(bin);return null;}
      if(chamfer&&!occt.BRepFilletAPI_MakeChamfer){occDispose(bin);return null;}
      const mf=chamfer?new occt.BRepFilletAPI_MakeChamfer(cur):new occt.BRepFilletAPI_MakeFillet(cur,0);bin.push(mf);
      let sansFace=0;
      hs.forEach(o=>{
        if(!cham){mf.Add_2(o.r,o.h);return;}
        // Add_3(D1, D2, arête, face de D1) / AddDA(D1, angle depuis cette face, arête, face)
        const ff=occChamferFirstFace(cur,o.h,cham.flip,o.fn);
        if(!ff){sansFace++;mf.Add_2(o.r,o.h);return;}
        bin.push(ff.f);
        if(cham.mode==='da')mf.AddDA(o.r,cham.ang*Math.PI/180,o.h,ff.f);
        else mf.Add_3(o.r,cham.d2>0?cham.d2:o.r,o.h,ff.f);
      });
      if(sansFace)warns.push('chanfrein : '+sansFace+' arête(s) sans face identifiable — distance égale appliquée');
      let ok=false;try{mf.Build();ok=mf.IsDone();}catch(e){ok=false;}
      if(!ok){occDispose(bin);return null;}
      const s=mf.Shape();nomsApresConge(mf,cur,s,chamfer);occDispose(bin);return s;
    }catch(e){occDispose(bin);return null;}
  };
  if(opts&&opts.single){
    // case « tangentes » DÉCOCHÉE : chaque arête seule, sans chaîne tangente
    let cur=base,done=0;
    for(const j of jobs){
      let E=null;try{E=occListEdges(cur);}catch(e){}
      const ed=(E||[]).find(e=>cur===base?e.src===j.src:(j.mid&&Math.hypot(e.mid[0]-j.mid[0],e.mid[1]-j.mid[1],e.mid[2]-j.mid[2])<3));
      let nx=null;
      let firstN=null;
      if(ed&&cham){ // normale de la première face pour l'outil asymétrique
        let eh=null,ff=null;
        try{eh=occEdgeAt(cur,ed.src);ff=eh?occChamferFirstFace(cur,eh,cham.flip,j.fn):null;firstN=ff?ff.n:null;}catch(e){firstN=null;}
        try{if(ff&&ff.f)ff.f.delete();}catch(e){}try{if(eh)eh.delete();}catch(e){}
      }
      const info={};
      const tool=ed?occSingleEdgeTool(cur,ed.pts,j.r,chamfer,cham,firstN,info):null;
      // Arête arrêtée par un mur : l'outil coupe d'équerre, le noyau suit le mur s'il est en biais ou courbe.
      // Pris s'il ne crée qu'une face, sinon il a suivi une chaîne tangente que la case écarte.
      if(tool&&info.borne){
        const k=mk(cur,[{src:ed.src,r:j.r,fn:j.fn||null}]);
        if(k){
          const avant=new Set(occFaceKeys(cur)),nees=occFaceKeys(k).filter(c=>c==='?'||!avant.has(c)).length;
          if(nees<=1&&occCoqueValide(k))nx=k;else{try{k.delete();}catch(e){}}
        }
      }
      if(tool&&!nx){try{nx=occCut(cur,tool);}catch(e){nx=null;}}
      if(tool){try{tool.delete();}catch(e){}}
      // Découpe « réussie » qui n'enlève rien (corps abîmé en amont) : repli sur le noyau
      if(nx){const v0=occCoqueVolume(cur),v1=occCoqueVolume(nx);if(v0!=null&&v1!=null&&!(v0-v1>1e-6)){try{nx.delete();}catch(e){}nx=null;}}
      if(!nx&&ed){nx=mk(cur,[{src:ed.src,r:j.r,fn:j.fn||null}]);if(nx)warns.push(kindLabel+' : arête courbe ou concave — suivi de la chaîne tangente (noyau)');}
      if(nx){if(cur!==base){try{cur.delete();}catch(e){}}cur=nx;done++;}
      else warns.push(kindLabel+' isolé impossible ('+(chamfer?'distance trop grande ?':'rayon trop grand ?')+')');
    }
    return cur===base?null:cur;
  }
  let s=mk(base,jobs);
  if(s)return s;
  if(opts&&opts.lot)return null; // lot seul (reprise NURBS, voir occFilletNurbs)
  let cur=base,done=0;
  for(const j of jobs){
    if(!j.mid||j.mid.length!==3){warns.push('arête sans repère — '+kindLabel+' abandonné');return cur===base?null:cur;}
    let edges=null;try{edges=occListEdges(cur);}catch(e){}
    const ed=(edges||[]).find(e=>Math.hypot(e.mid[0]-j.mid[0],e.mid[1]-j.mid[1],e.mid[2]-j.mid[2])<3.0);
    if(!ed){warns.push('arête introuvable ('+kindLabel+' isolé)');continue;}
    const one=mk(cur,[{src:ed.src,r:j.r,fn:j.fn||null}]);
    if(one){if(cur!==base){try{cur.delete();}catch(e){}}cur=one;done++;}
    else warns.push(kindLabel+' isolé impossible ('+(chamfer?'distance trop grande ?':'rayon trop grand ?')+')');
  }
  if(cur===base)return null;
  if(done<jobs.length)warns.push(kindLabel+' partiel : '+done+'/'+jobs.length);
  return cur;
}
function occRimFillets(base,o,n,d,rsTop,rsBot){
  // Congé du périmètre en exact (voie BRep) : arrondi des deux bords du prisme.
  // Échec isolé = jamais de crash : shape d'origine conservée + warning.
  const warns=[];
  if(!(rsTop>0||rsBot>0))return{shape:base,warnings:warns};
  let edges=[];try{edges=occListEdges(base);}catch(e){}
  const jobs=rimEdgeJobs(edges,o,n,d,rsTop,rsBot);
  if(!jobs.length){warns.push('périmètre : arête du contour introuvable');return{shape:base,warnings:warns};}
  const s=occFilletRun(base,jobs,warns);
  if(!s){warns.push('périmètre : arrondi impossible');return{shape:base,warnings:warns};}
  try{base.delete();}catch(e){}
  return{shape:s,warnings:warns};
}
// V0.63.6 : JONCTIONS LIGNE / ARC TANGENTES remises au vrai point de tangence, pour construire le
// solide. Le solveur rend la ligne tangente à 1e-10 mm près, mais le point de jonction glisse alors
// de √(2·r·écart) : 4e-11 mm d'écart, R0,6 → 7 microns le long de la ligne (MERLIN-32-002, rainure dont
// le centre d'arc est posé sur le flanc : la ligne s'arrêtait 7 µm avant le flanc, laissant une face
// cylindrique de 7 µm de large que le chanfrein du fond rendait invalide). L'esquisse enregistrée ne
// bouge pas : copie rendue seulement s'il y a quelque chose à corriger, utilisée seulement par
// occCutSansFaceFine — appliquée partout, elle décalait le contour de la pièce de quelques microns par
// rapport aux esquisses qui le projettent, et créait ailleurs les micro-arêtes qu'elle devait éviter.
function skTangencesExactes(sk){
  const P=(sk&&sk.points)||{},L=((sk&&sk.entities)||[]).filter(e=>e&&!e.construction);
  const degre={};
  L.forEach(e=>[e.p1,e.p2,e.pa,e.pb].forEach(p=>{if(p)degre[p]=(degre[p]||0)+1;}));
  let pts=null;
  L.forEach(a=>{
    if(a.t!=='arc'||!(a.r>0)||a.pa===a.pb)return;
    const C=P[a.pc];if(!C)return;
    [a.pa,a.pb].forEach(pid=>{
      if(degre[pid]!==2)return; // jonction d'une ligne et d'un arc, rien d'autre
      const l=L.find(e=>e.t==='line'&&(e.p1===pid||e.p2===pid));
      const Q=P[pid],R=l&&P[l.p1===pid?l.p2:l.p1];if(!Q||!R)return;
      const n=Math.hypot(Q.x-R.x,Q.y-R.y);if(!(n>1e-6))return;
      const ux=(Q.x-R.x)/n,uy=(Q.y-R.y)/n,t=(C.x-R.x)*ux+(C.y-R.y)*uy;
      const F={x:R.x+ux*t,y:R.y+uy*t},d=Math.hypot(F.x-Q.x,F.y-Q.y);
      // tangente à la tolérance du noyau ; déplacement visible du noyau mais sans effet sur le dessin
      if(Math.abs(Math.hypot(C.x-F.x,C.y-F.y)-a.r)>1e-7||d<=1e-7||d>0.02)return;
      if(!pts)pts=Object.assign({},P);
      pts[pid]=Object.assign({},Q,F);
    });
  });
  return pts?Object.assign({},sk,{points:pts}):sk;
}
function occMicroAretes(shape){
  // Nombre d'arêtes de moins d'un micron : restes d'une découpe, jamais du dessin voulu.
  let n=0;
  const x=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_EDGE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try{
    for(;x.More();x.Next()){
      const G=new occt.GProp_GProps_1();
      try{occAvec(x.Current(),c=>occt.BRepGProp.LinearProperties(c,G,false,false));if(G.Mass()<1e-3)n++;}finally{G.delete();}
    }
  }finally{x.delete();}
  return n;
}
// V0.63.6 : une découpe qui LAISSE des micro-arêtes est refaite avec les tangences exactes de son
// esquisse. Résultat gardé seulement s'il en a moins, s'il est valide et de même volume, sinon null :
// une découpe sans défaut, ou dont l'esquisse n'a rien à corriger, ne change pas d'un atome.
function occCutSansFaceFine(f,avant,coupe){
  try{
    const sk=doc.sketches.find(s=>s.id===f.sketchId);
    if(!sk||skTangencesExactes(sk)===sk)return null;
    const n=occMicroAretes(coupe);
    if(!n||n<=occMicroAretes(avant))return null;
    const r=occShapeOfExtrude(f,{tangencesExactes:true});
    let c=null;
    try{c=occUnifyCutSeams(occCut(avant,r.shape),avant,r.shape);}
    finally{try{r.shape.delete();}catch(e){}occDispose(r.bins);}
    const v0=occCoqueVolume(coupe),v1=occCoqueVolume(c);
    if(occMicroAretes(c)<n&&occCoqueValide(c)&&v0!=null&&v1!=null&&Math.abs(v1-v0)<=1e-3)return c;
    try{c.delete();}catch(e){}
  }catch(e){}
  return null;
}
function occShapeOfExtrude(f,opts){
  // Solide BRep exact d'une extrusion (congés 2D pré-appliqués, trous = découpes).
  const sk=doc.sketches.find(s=>s.id===f.sketchId);
  if(!sk)throw new Error('esquisse introuvable');
  const fils=doc.features.filter(x=>x.type==='fillet'&&x.target===f.id&&x.visible!==false);
  let data=sk;const warns=[];
  let rsTop=0,rsBot=0;
  fils.forEach(fi=>{const rm=fi.rims||(fi.rimTop||fi.rimBot?{top:!!fi.rimTop,bottom:!!fi.rimBot}:null);if(!rm||!(fi.radius>0))return;if(rm.top&&fi.radius>rsTop)rsTop=fi.radius;if(rm.bottom&&fi.radius>rsBot)rsBot=fi.radius;});
  if(fils.length){
    const rf=applyFilletsToSketch(sk,fils);
    warns.push(...rf.warnings);data=rf.sk;
    if(!rf.applied&&!(fils.some(fi=>fi.rims&&(fi.rims.top||fi.rims.bottom)))){/* que des rims : rien en 2D */}
  }
  if(opts&&opts.tangencesExactes)data=skTangencesExactes(data);
  const tr=skTracePick(data,f.profiles); // zones choisies (70-extrusion-profils) ; sans choix = toutes
  // Noms uniques : chaque contour de l'outil est préfixé de la fonction (et du centre pour une pastille)
  const nomme=(r,pre)=>{if(r&&r.shape)nomsPrefixe(r.shape,pre);return r;};
  if(!tr.solids.length&&!tr.circlesOut.length){
    let m=tr.picked===0?'aucune des zones choisies ne se retrouve dans l’esquisse':'profil non fermé';
    if(tr.opens&&tr.opens.length)m+=` (bout ouvert en ${tr.opens[0].x.toFixed(1)}, ${tr.opens[0].y.toFixed(1)})`;
    throw new Error(m);
  }
  const sp=extrudeSpan(f),bins=[];
  const bs=sketchBasis(data);
  const rimApply=(sh)=>{
    if(!(rsTop>0||rsBot>0))return sh;
    const rr=occRimFillets(sh,bs.o,bs.n,sp,rsTop,rsBot);
    warns.push(...rr.warnings);
    return rr.shape;
  };
  const keep=(r,what)=>{
    if(!r||!r.shape||!r.bin)throw new Error(`prisme vide (${what||'contour'} — arête dégénérée, arc aplati ou micro-segment ?)`);
    bins.push(...r.bin);return r.shape;
  };
  let shape=null;
  const fuseIn=(s)=>{if(!shape){shape=s;return;}const nx=occUnify(occFuse(shape,s));try{shape.delete();}catch(e){}try{s.delete();}catch(e){}shape=nx;};
  tr.solids.forEach((sol,si)=>{
    let s;
    if(sol.circle){const Cc=data.points[sol.circle.pc];if(!Cc)throw new Error('zone : centre introuvable');s=keep(nomme(occDiskPrism(data,Cc.x,Cc.y,sol.circle.r,sp),f.id+'/'+sol.circle.id),'zone circulaire');}
    else s=keep(nomme(occSpanPrism(data,tr,sol.chain,sp,sol.area),f.id),'contour '+tr.solids.length);
    s=rimApply(s);
    (sol.holes||[]).forEach(h=>{
      const t=keep(nomme(occSpanPrism(data,tr,h,sp,1),f.id),'trou');
      const c=occCut(s,t);try{s.delete();}catch(e){}try{t.delete();}catch(e){}s=c;
    });
    tr.circleHoles.filter(ch=>ch.solid===si).forEach(ch=>{
      const Cc=data.points[ch.circle.pc];
      if(!Cc)throw new Error('pastille : centre introuvable');
      const t=keep(nomme(occDiskPrism(data,Cc.x,Cc.y,ch.circle.r,sp),f.id+'/'+ch.circle.id),'trou circulaire');
      const c=occCut(s,t);try{s.delete();}catch(e){}try{t.delete();}catch(e){}s=c;
    });
    fuseIn(s);
  });
  tr.circlesOut.forEach(cEnt=>{
    const Cc=data.points[cEnt.pc];
    if(!Cc)throw new Error('pastille : centre introuvable');
    fuseIn(rimApply(keep(nomme(occDiskPrism(data,Cc.x,Cc.y,cEnt.r,sp),f.id+'/'+cEnt.id),'pastille')));
  });
  if(!shape){occDispose(bins);throw new Error('solide vide');}
  // Dépouille d'extrusion (f.draft, degrés signés / plan d'esquisse) : inclinaison des
  // parois de l'outil COMPLET (trous percés, contours fusionnés), pivotée sur le plan
  // d'esquisse — le profil y est exact, il s'évase ou se rétrécit selon le signe.
  // Échec (angle trop fort, parois non adjacentes au plan) : extrusion droite conservée
  // + avertissement, jamais de timeline cassée.
  if(Math.abs(+f.draft||0)>1e-9){
    try{
      const r=occExtrudeDraft(shape,bs,sp,+f.draft);
      shape=r.shape;warns.push(...r.warnings);
    }catch(e){warns.push('dépouille '+f.draft+'° impossible ('+String((e&&e.message)||e).slice(0,120)+') : extrusion droite conservée');}
  }
  return{shape,bins,warnings:warns};
}
function smoothNormals(pos,creaseDeg){
  // Normales lissées sous seuil d'angle (style Fusion) : facettes tangentes interpolées,
  // arêtes vives (> seuil) conservées. Entrée : tableau xyz non indexé. Validé par exécution.
  const nTri=(pos.length/9)|0;
  const fnx=new Float64Array(nTri),fny=new Float64Array(nTri),fnz=new Float64Array(nTri);
  const fok=new Uint8Array(nTri);
  for(let t=0;t<nTri;t++){
    const o=t*9;
    const e1x=pos[o+3]-pos[o],e1y=pos[o+4]-pos[o+1],e1z=pos[o+5]-pos[o+2];
    const e2x=pos[o+6]-pos[o],e2y=pos[o+7]-pos[o+1],e2z=pos[o+8]-pos[o+2];
    const nx=e1y*e2z-e1z*e2y,ny=e1z*e2x-e1x*e2z,nz=e1x*e2y-e1y*e2x;
    const l=Math.hypot(nx,ny,nz);
    if(l>1e-18){fnx[t]=nx/l;fny[t]=ny/l;fnz[t]=nz/l;fok[t]=1;}
  }
  const map=new Map();
  for(let v=0;v<pos.length/3;v++){
    const k=pos[v*3]+','+pos[v*3+1]+','+pos[v*3+2];
    let a=map.get(k);if(!a){a=[];map.set(k,a);}
    a.push((v/3)|0);
  }
  const lim=Math.cos((creaseDeg||35)*Math.PI/180);
  const out=new Float32Array(pos.length);
  for(let t=0;t<nTri;t++)for(let k=0;k<3;k++){
    const v=t*3+k,kk=pos[v*3]+','+pos[v*3+1]+','+pos[v*3+2];
    let ax=0,ay=0,az=0;
    const inc=map.get(kk)||[t];
    for(const t2 of inc){
      if(!fok[t2])continue;
      if(!fok[t]||fnx[t2]*fnx[t]+fny[t2]*fny[t]+fnz[t2]*fnz[t]>=lim){ax+=fnx[t2];ay+=fny[t2];az+=fnz[t2];}
    }
    let l=Math.hypot(ax,ay,az);
    if(!(l>1e-12)){if(fok[t]){ax=fnx[t];ay=fny[t];az=fnz[t];}else{ax=0;ay=0;az=1;}l=1;}
    out[v*3]=ax/l;out[v*3+1]=ay/l;out[v*3+2]=az/l;
  }
  return out;
}
function occTriNormals(T){
  // V0.11.34 : normales EXACTES de la surface BRep (T.nrm, occTriPos avec wantN) ; à défaut
  // (pas d'UV, point singulier : pôle, sommet de cône), normale lissée de smoothNormals.
  // Le lissage seul mélangeait les triangles des faces VOISINES tangentes : un fond plat
  // prenait l'inclinaison de ses congés au bord, étalée par ses longs triangles = faces « marbrées ».
  const out=smoothNormals(T.pos,35),n=T.nrm;
  if(n)for(let i=0;i<out.length;i+=3)if(n[i]===n[i]){out[i]=n[i];out[i+1]=n[i+1];out[i+2]=n[i+2];}
  return out;
}
function occTessellate(shape,defl,ang){
  // BRep -> THREE.BufferGeometry (non indexé, normales exactes de la surface). Validé par exécution.
  const T=occTriPos(shape,defl,ang,true),pos=T.pos;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  try{g.setAttribute('normal',new THREE.Float32BufferAttribute(occTriNormals(T),3));}
  catch(e){g.computeVertexNormals();}
  g.userData.occGroups=T.groups; // triangle -> face BRep (clic-face en mode exact)
  return g;
}
const OCC_MESH_SPLIT_FACES=20000; // au-delà : maillage pièce par pièce (gros assemblages STEP)
function occMeshShape(shape,defl,ang){
  // Maillage du noyau, mailleur libéré (il gardait tout son modèle de travail en mémoire).
  // V0.22.4 — gros assemblage (> OCC_MESH_SPLIT_FACES faces, 2 pièces ou plus) : maillé
  // PIÈCE PAR PIÈCE. D'un bloc, les structures de travail du mailleur s'additionnent :
  // « Moule 73-40 » (73 000 faces) saturait le tas de 2 Go, planches 1 à 32 y montait à 763 Mo
  // (229 Mo en pièces, triangles identiques au bit près). Une pièce = un solide, ou une coque /
  // face hors solide ; ses occurrences partagent leurs faces (IsPartner) : maillée UNE fois.
  // Sous le seuil (pièces natives, petits STEP) : inchangé, d'un bloc.
  const E=occt.TopAbs_ShapeEnum,parts=[];
  try{
    const typ=s=>{const t=s.ShapeType();return t===E.TopAbs_SOLID?'so':t===E.TopAbs_SHELL?'sh':t===E.TopAbs_FACE?'f':t===E.TopAbs_COMPOUND||t===E.TopAbs_COMPSOLID?'c':'';};
    const visit=(s,inSolid)=>{
      const t=typ(s);
      if(t==='so'||((t==='sh'||t==='f')&&!inSolid)){
        const p=t==='so'?occt.TopoDS.Solid_1(s):t==='sh'?occt.TopoDS.Shell_1(s):occt.TopoDS.Face_1(s);
        if(parts.some(q=>{try{return q.IsPartner(p);}catch(e){return false;}})){try{p.delete();}catch(e){}}
        else parts.push(p);
        return; // la pièce entière est maillée : on ne descend pas plus bas
      }
      if(t!=='c')return;
      const it=new occt.TopoDS_Iterator_2(s,true,true);
      try{while(it.More()){visit(it.Value(),inSolid);it.Next();}}finally{try{it.delete();}catch(e){}}
    };
    let split=false;
    if(typ(shape)==='c'){
      let nf=0;const ex=new occt.TopExp_Explorer_2(shape,E.TopAbs_FACE,E.TopAbs_SHAPE);
      while(ex.More()&&nf<=OCC_MESH_SPLIT_FACES){nf++;ex.Next();}
      try{ex.delete();}catch(e){}
      if(nf>OCC_MESH_SPLIT_FACES){visit(shape,false);split=parts.length>=2;}
    }
    if(split){
      for(const p of parts){const m=new occt.BRepMesh_IncrementalMesh_2(p,defl,false,ang,false);try{m.delete();}catch(e){}}
      return;
    }
  }finally{parts.forEach(p=>{try{p.delete();}catch(e){}});}
  const m=new occt.BRepMesh_IncrementalMesh_2(shape,defl,false,ang,false);
  try{m.delete();}catch(e){}
}
function occTriPos(shape,defl,ang,wantN){
  // BRep -> triangles bruts {pos:[x,y,z × 3 par triangle], groups:[{f,start,count}]} (V0.8.2 :
  // aussi pour les rayons des bulles de la mise en plan, qui n'ont pas besoin de THREE)
  // wantN : + nrm (parallèle à pos) = normale sortante exacte au nœud (BRepGProp_Face, orientation
  // de la face comprise), NaN si indisponible — voir occTriNormals.
  defl=defl||0.5;ang=ang||0.5;
  occMeshShape(shape,defl,ang);
  const pos=[],groups=[],nrm=wantN?[]:null;
  let gP=null,gV=null;
  if(wantN){try{gP=new occt.gp_Pnt_1();gV=new occt.gp_Vec_1();}catch(e){gP=gV=null;}}
  let faceOrd=0;
  const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);
  while(ex.More()){
    const f=occFaceCur(ex);
    const loc=new occt.TopLoc_Location_1();
    const triStart=pos.length/9;
    let h=null; // t = h.get() appartient à h : on ne libère que h
    try{
      h=occt.BRep_Tool.Triangulation(f,loc);
      if(h&&!h.IsNull()){
        const t=h.get(),nt=t.NbTriangles();
        // Orientation_1() rend un objet-enum (identité stricte, pas un nombre).
        // Sans ce flip, les faces REVERSED sont inversées = trous visuels.
        let rev=false;
        try{rev=(f.Orientation_1()===occt.TopAbs_Orientation.TopAbs_REVERSED);}catch(e){rev=false;}
        const trsf=loc.IsIdentity()?null:loc.Transformation();
        // normales exactes par nœud (une fois par nœud, pas par sommet de triangle) ;
        // BRepGProp_Face lit la surface placée (Location de la face) : pas de trsf à appliquer
        let nn=null;
        if(nrm&&gV){
          try{
            if(t.HasUVNodes()){
              const bf=new occt.BRepGProp_Face_2(f,false),nb=t.NbNodes();nn=new Float64Array(nb*3+3);
              for(let k=1;k<=nb;k++){
                const uv=t.UVNode(k);bf.Normal(uv.X(),uv.Y(),gP,gV);try{uv.delete();}catch(e){}
                const x=gV.X(),y=gV.Y(),z=gV.Z(),l=Math.hypot(x,y,z);
                if(l>1e-12){nn[k*3]=x/l;nn[k*3+1]=y/l;nn[k*3+2]=z/l;}else nn[k*3]=NaN;
              }
              try{bf.delete();}catch(e){}
            }
          }catch(e){nn=null;}
        }
        // Nœuds lus UNE fois par face et libérés : Node(), Transformed() et Triangle() rendent
        // des COPIES dans le tas du noyau ; non libérées (3 par triangle), un STEP de 18 Mo
        // (planches 1 à 32) menait le tas à son plafond de 2 Go → import impossible.
        const nb=t.NbNodes(),P=new Float64Array(nb*3+3);
        for(let k=1;k<=nb;k++){
          const p=t.Node(k);
          if(trsf){const q=p.Transformed(trsf);P[k*3]=q.X();P[k*3+1]=q.Y();P[k*3+2]=q.Z();try{q.delete();}catch(e){}}
          else{P[k*3]=p.X();P[k*3+1]=p.Y();P[k*3+2]=p.Z();}
          try{p.delete();}catch(e){}
        }
        for(let i=1;i<=nt;i++){
          const tr=t.Triangle(i);
          let idx=[tr.Value(1),tr.Value(2),tr.Value(3)];
          try{tr.delete();}catch(e){}
          if(rev)idx=[idx[0],idx[2],idx[1]];
          for(const k of idx){
            pos.push(P[k*3],P[k*3+1],P[k*3+2]);
            if(nrm){if(nn)nrm.push(nn[k*3],nn[k*3+1],nn[k*3+2]);else nrm.push(NaN,NaN,NaN);}
          }
        }
        try{if(trsf)trsf.delete();}catch(e){}
      }
    }catch(e){}
    occFree(h);occFree(f);
    try{loc.delete();}catch(e){}
    const triCount=pos.length/9-triStart;
    if(triCount>0)groups.push({f:faceOrd,start:triStart,count:triCount});
    faceOrd++;
    ex.Next();
  }
  try{ex.delete();}catch(e){}
  try{if(gP)gP.delete();if(gV)gV.delete();}catch(e){}
  return nrm?{pos,groups,nrm}:{pos,groups};
}
