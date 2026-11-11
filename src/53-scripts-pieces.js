/* ---------- scripts JSON : pièces complètes (V0.94.0) ----------
   Gestes ajoutés aux scripts de 53-scripts.js, donc au pilotage par l'IA (serveur MCP) :
     {op:'edges'}  {op:'faces'}            liste numérotée des arêtes / faces de la pièce (milieu, longueur, sens, normale…)
     {op:'fillet', edges, radius}         congé exact (xfillet) sur les arêtes choisies
     {op:'chamfer', edges, distance}      chanfrein à distances égales
     {op:'shell', faces, thickness}       coque : les faces choisies sont retirées (ouverture)
     {op:'hole', sketch, d, depth|through, kind, thread, cbore, csink, tip, flip}
                                          perçage sur les centres {hole:[x,y]} d'une esquisse du script
     {op:'pattern', features, type:'linear'|'circular'|'mirror', count, distance, axis, angle, plane}
     {op:'mirror', body, plane}           symétrie d'un corps entier (bmirror)
     {op:'set', feature, <champ>:valeur}  change une valeur d'une fonction existante
     {op:'set', sketch, dim, value}       change une cote d'esquisse (numéro de {op:'info'}), puis résout
   Arêtes et faces se désignent SANS clic, par un sélecteur :
     "all" · [3,7,8] (numéros de edges / faces) · "top" "bottom" "left" "right" "front" "back"
     faces : {normal:"+Z", at:"max"|"min", kind:"plane"|"cylinder", body}
     arêtes : {dir:"Z", kind:"line"|"curve", face:<sélecteur de face>, near:[x,y,z], body}
   Les fonctions créées sont les MÊMES que celles de l'interface : elles se modifient ensuite à la main. */
const MF_FACE_ALIAS={top:{normal:'+Z',at:'max'},bottom:{normal:'-Z',at:'min'},right:{normal:'+X',at:'max'},left:{normal:'-X',at:'min'},
  back:{normal:'+Y',at:'max'},front:{normal:'-Y',at:'min'}};
const mfR=(v,k)=>+(+v).toFixed(k==null?3:k);
function mfAxe(s,what){
  // "+Z", "-X", "Y" ou [x,y,z] → vecteur unitaire
  if(Array.isArray(s)&&s.length===3){const v=s.map(x=>mfNum(x,what)),n=Math.hypot(v[0],v[1],v[2]);if(!(n>1e-12))throw new Error(what+' : vecteur nul');return v.map(x=>x/n);}
  const m=/^([+-]?)([XYZ])$/i.exec(String(s||''));if(!m)throw new Error(what+' : "+X", "-Y", "Z"… ou [x,y,z] attendu');
  const v=[0,0,0];v['XYZ'.indexOf(m[2].toUpperCase())]=m[1]==='-'?-1:1;return v;
}
function mfDot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
// Géométrie de la pièce : arêtes et faces de chaque corps visible, numérotées une fois pour tout le document.
function mfGeometrie(){
  if(!(typeof occHas==='function'&&occHas()))throw new Error('noyau exact indisponible : arêtes et faces non listables');
  markDirty();rebuild();
  const corps=asmExactActive(),edges=[],faces=[];
  try{
    corps.forEach(b=>{
      occListEdges(b.shape).forEach(e=>{
        const a=e.pts[0],z=e.pts[e.pts.length-1],c=[z[0]-a[0],z[1]-a[1],z[2]-a[2]],L=Math.hypot(c[0],c[1],c[2]);
        let droite=L>1e-6;
        if(droite){const u=c.map(v=>v/L);droite=e.pts.every(p=>{const w=[p[0]-a[0],p[1]-a[1],p[2]-a[2]],t=mfDot(w,u);return Math.hypot(w[0]-t*u[0],w[1]-t*u[1],w[2]-t*u[2])<1e-4;});}
        const o={index:edges.length,body:b.id,kind:droite?'line':'curve',mid:e.mid.map(v=>mfR(v)),length:mfR(e.len),start:a.map(v=>mfR(v)),end:z.map(v=>mfR(v))};
        if(droite){const u=c.map(v=>v/L);o.dir=u.map(v=>mfR(v,4));const k=u.findIndex(v=>Math.abs(v)>0.9999);if(k>=0)o.axis='XYZ'[k];}
        else if(L<1e-6)o.closed=true;
        Object.defineProperty(o,'_src',{value:e.src});Object.defineProperty(o,'_pts',{value:e.pts});
        edges.push(o);
      });
      const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
      const ex=new occt.TopExp_Explorer_2(b.shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);
      try{
        while(ex.More()){
          const f=occFaceCur(ex);
          try{
            const ref=occFaceRef(f);
            if(ref){
              let kind='other',radius;
              const ad=new occt.BRepAdaptor_Surface_2(f,true);
              try{
                const t=ad.GetType(),T=occt.GeomAbs_SurfaceType;
                if(t===T.GeomAbs_Plane)kind='plane';
                else if(t===T.GeomAbs_Cylinder){kind='cylinder';try{const cy=ad.Cylinder();radius=mfR(cy.Radius());occFree(cy);}catch(e){}}
                else if(t===T.GeomAbs_Cone)kind='cone';else if(t===T.GeomAbs_Sphere)kind='sphere';else if(t===T.GeomAbs_Torus)kind='torus';
                else if(t===T.GeomAbs_BSplineSurface||t===T.GeomAbs_BezierSurface)kind='bspline';
              }finally{try{ad.delete();}catch(e){}}
              const o={index:faces.length,body:b.id,kind,center:ref.pos,size:ref.dim,normal:ref.n};
              if(radius!=null)o.radius=radius;
              Object.defineProperty(o,'_ref',{value:ref});
              faces.push(o);
            }
          }finally{try{f.delete();}catch(e){}}
          ex.Next();
        }
      }finally{try{ex.delete();}catch(e){}}
    });
  }finally{
    // les arêtes de chanfrein relisent leur face d'appui dans le corps : on garde les copies jusqu'au bout
    mfGeometrie.corps=corps;
  }
  return {edges,faces};
}
function mfGeoLibere(){(mfGeometrie.corps||[]).forEach(b=>{try{b.shape.delete();}catch(e){}});mfGeometrie.corps=null;}
function mfFacesChoisies(sel,G,what){
  what=what||'faces';
  if(sel==='all')return G.faces.slice();
  if(typeof sel==='string'){const a=MF_FACE_ALIAS[sel.toLowerCase()];if(!a)throw new Error(what+' : « '+sel+' » inconnu (top, bottom, left, right, front, back, all)');sel=a;}
  if(typeof sel==='number')sel=[sel];
  if(Array.isArray(sel)){
    const out=[];sel.forEach(s=>{
      if(typeof s==='number'){const f=G.faces[s];if(!f)throw new Error(what+' : face '+s+' inexistante (0 à '+(G.faces.length-1)+')');out.push(f);}
      else mfFacesChoisies(s,G,what).forEach(f=>out.push(f));
    });
    return [...new Set(out)];
  }
  if(!sel||typeof sel!=='object')throw new Error(what+' : sélecteur attendu');
  let L=G.faces.slice();
  if(sel.body!=null)L=L.filter(f=>f.body===sel.body||mfCorpsNom(f.body)===sel.body);
  if(sel.kind)L=L.filter(f=>f.kind===sel.kind);
  if(sel.normal!=null){const n=mfAxe(sel.normal,what+'.normal');L=L.filter(f=>f.normal&&mfDot(f.normal,n)>0.999);}
  if(sel.radius!=null){const r=mfNum(sel.radius,what+'.radius');L=L.filter(f=>f.radius!=null&&Math.abs(f.radius-r)<1e-3);}
  if(sel.at==='max'||sel.at==='min'){
    const n=sel.normal!=null?mfAxe(sel.normal,what+'.normal'):[0,0,1];
    const h=f=>mfDot(f.center,n);
    if(L.length){const e=sel.at==='max'?Math.max(...L.map(h)):Math.min(...L.map(h));L=L.filter(f=>Math.abs(h(f)-e)<1e-3);}
  }
  if(!L.length)throw new Error(what+' : aucune face ne répond à '+JSON.stringify(sel));
  return L;
}
// Volume total des corps visibles, d'un rejeu frais : une fonction qui ne change rien a échoué sans le dire
function mfVolume(){
  markDirty();rebuild();
  let v=0;asmExactActive().forEach(b=>{try{v+=asmVolCom(b.shape).v;}finally{try{b.shape.delete();}catch(e){}}});
  return v;
}
function mfDoitChanger(v0,quoi){
  const v1=mfVolume();
  if(Math.abs(v1-v0)<=1e-7*Math.max(1,Math.abs(v0)))throw new Error(quoi+' : la pièce n’a pas changé (valeur trop grande, ou rien à enlever ici ?)');
  return mfR(v1);
}
// Ce que l'arbre marque d'un ⚠ sur un congé ou un chanfrein (40-10, 40-50) : pour un script, c'est un refus
function mfAlerteArrondi(f){
  if(!f)return null;
  if(f._err)return f._err;
  if(f._adj)return f._adj;
  if(f._rate)return 'non fait sur '+f._rate.n+'/'+f._rate.t+' arête(s), le noyau les refuse';
  if(f._m&&f._m.m<f._m.t)return f._m.m+'/'+f._m.t+' arêtes retrouvées';
  return null;
}
function mfCorpsNom(id){const e=(doc.bodies||[]).find(x=>x.id===id);return e?e.name:id;}
function mfAreteSurFace(e,f){
  // toutes les positions de l'arête dans la boîte de la face, et sur son plan pour une face plane
  const c=f.center,d=f.size,tol=2e-3;
  return e._pts.every(p=>Math.abs(p[0]-c[0])<=d[0]/2+tol&&Math.abs(p[1]-c[1])<=d[1]/2+tol&&Math.abs(p[2]-c[2])<=d[2]/2+tol&&
    (f.kind!=='plane'||Math.abs(mfDot([p[0]-c[0],p[1]-c[1],p[2]-c[2]],f.normal))<tol));
}
function mfAretesChoisies(sel,G,what){
  what=what||'edges';
  if(sel==='all')return G.edges.slice();
  if(typeof sel==='number')sel=[sel];
  if(typeof sel==='string'){if(!MF_FACE_ALIAS[sel.toLowerCase()])throw new Error(what+' : « '+sel+' » inconnu');sel={face:sel};}
  if(Array.isArray(sel)){
    const out=[];sel.forEach(s=>{
      if(typeof s==='number'){const e=G.edges[s];if(!e)throw new Error(what+' : arête '+s+' inexistante (0 à '+(G.edges.length-1)+')');out.push(e);}
      else mfAretesChoisies(s,G,what).forEach(e=>out.push(e));
    });
    return [...new Set(out)];
  }
  if(!sel||typeof sel!=='object')throw new Error(what+' : sélecteur attendu');
  let L=G.edges.slice();
  if(sel.body!=null)L=L.filter(e=>e.body===sel.body||mfCorpsNom(e.body)===sel.body);
  if(sel.kind)L=L.filter(e=>e.kind===sel.kind);
  if(sel.dir!=null){const u=mfAxe(sel.dir,what+'.dir');L=L.filter(e=>e.dir&&Math.abs(mfDot(e.dir,u))>0.999);}
  if(sel.face!=null){const F=mfFacesChoisies(sel.face,G,what+'.face');L=L.filter(e=>F.some(f=>f.body===e.body&&mfAreteSurFace(e,f)));}
  if(sel.near!=null){
    const p=(sel.near||[]).map(v=>mfNum(v,what+'.near'));const d=e=>Math.hypot(e.mid[0]-p[0],e.mid[1]-p[1],e.mid[2]-p[2]);
    if(L.length){const m=Math.min(...L.map(d));L=L.filter(e=>d(e)<=m+1e-3);}
  }
  if(!L.length)throw new Error(what+' : aucune arête ne répond à '+JSON.stringify(sel));
  return L;
}
function mfCorpsDe(L){
  // corps commun aux éléments choisis (un congé, une coque ne travaillent que sur un corps)
  const s=[...new Set(L.map(x=>x.body))];
  if(s.length>1)throw new Error('les éléments choisis appartiennent à plusieurs corps ('+s.map(mfCorpsNom).join(', ')+') : une fonction par corps');
  return s[0];
}
function mfFeatureFind(ref,ids){
  if(ref==null)return null;const r=String(ref),id=ids[r]||r;
  const F=doc.features||[];
  return F.find(f=>f.id===id)||F.find(f=>f.name===r)||null;
}
// Champs qu'un script peut changer, par type de fonction : [nom dans le script, champ réel, contrôle]
const MF_SET_CHAMPS={
  extrude:{distance:'distance'},revolve:{angle:'angle'},
  xfillet:{radius:'*r',distance:'*r'},xshell:{thickness:'thick'},
  hole:{d:'d',depth:'depth',tip:'tip'},
  repeat:{count:'copies',distance:'dist',angle:'angle'}
};
function mfSet(c,ids){
  if(c.sketch!=null){
    const sk=mfSketchFind(c.sketch,ids);if(!sk)throw new Error('set : esquisse « '+c.sketch+' » introuvable');
    const i=+c.dim;const d=(sk.dims||[])[i];
    if(!Number.isInteger(i)||!d)throw new Error('set : cote '+c.dim+' inexistante dans « '+sk.name+' » ('+(sk.dims||[]).length+' cote(s), voir info)');
    const v=mfNum(c.value,'set.value');
    if(d.expr||d.pname){delete d.expr;delete d.pname;} // la valeur donnée remplace la formule
    d.value=v;solveSketch(sk);
    if(skResid(sk)>SK_OK_RES)throw new Error('set : « '+sk.name+' » ne se résout plus avec cette cote ('+(skWorstViol(sk)||'contraintes en conflit')+')');
    return {op:'set',sketch:sk.name,dim:i,value:v};
  }
  const f=mfFeatureFind(c.feature,ids);if(!f)throw new Error('set : fonction « '+c.feature+' » introuvable');
  const T=MF_SET_CHAMPS[f.type];if(!T)throw new Error('set : la fonction « '+f.name+' » ('+f.type+') ne se modifie pas par script');
  const faits={};
  Object.keys(c).filter(k=>!['op','feature','id'].includes(k)).forEach(k=>{
    const champ=T[k];if(!champ)throw new Error('set : « '+k+' » inconnu pour '+f.type+' (champs : '+Object.keys(T).join(', ')+')');
    let v=mfNum(c[k],'set.'+k);
    if(['radius','thickness','d','count'].includes(k)&&!(v>0))throw new Error('set : '+k+' > 0 attendu');
    if(k==='count'){v=Math.round(v);if(v<2)throw new Error('set : count ≥ 2 attendu (source comprise)');v=repMaxCopies(v-1);}
    if(champ==='*r'){(f.edges||[]).forEach(e=>{e.r=v;if(e.expr)delete e.expr.r;if(e.pname)delete e.pname.r;});}
    else{f[champ]=v;if(f.expr)delete f.expr[champ];if(f.pname)delete f.pname[champ];}
    faits[k]=v;
  });
  if(f.type==='xfillet')f.name=xFeatName(f);
  else if(f.type==='xshell')f.name=shellName(f);
  else if(f.type==='hole'){try{f.name=holeName(f);}catch(e){}}
  if(f.type==='repeat'){try{repGenChildren(f);}catch(e){}}
  else{try{repSyncForFeature(f);}catch(e){}}
  return Object.assign({op:'set',feature:f.name},faits);
}
function mfHoleThread(nf,size){
  // ISO, UNC/UNF, gaz : la table du perçage (76-percage) ; le pas fin se donne à part ("pitch")
  const s=String(size).replace(/\s+/g,'');const t=isoThread(s);
  if(!t)throw new Error('hole : taraudage « '+s+' » inconnu (M3, M8, 1/4-20 UNC… ; pas fin : "pitch")');
  return t;
}
const MF_OPS_PIECES={
  edges(c){const G=mfGeometrie();mfGeoLibere();return {op:'edges',count:G.edges.length,edges:G.edges};},
  faces(c){const G=mfGeometrie();mfGeoLibere();return {op:'faces',count:G.faces.length,faces:G.faces};},
  fillet(c,ids){return MF_OPS_PIECES._arrondi(c,ids,false);},
  chamfer(c,ids){return MF_OPS_PIECES._arrondi(c,ids,true);},
  _arrondi(c,ids,cham){
    const what=cham?'chamfer':'fillet';
    const r=mfNum(cham?c.distance:c.radius,what+(cham?'.distance':'.radius'));if(!(r>0))throw new Error(what+' : '+(cham?'distance':'rayon')+' > 0 attendu');
    if(c.edges==null)throw new Error(what+' : « edges » attendu (sélecteur d’arêtes)');
    const v0=mfVolume(),G=mfGeometrie();
    try{
      const L=mfAretesChoisies(c.edges,G,what+'.edges'),body=mfCorpsDe(L);
      const shape=(mfGeometrie.corps.find(b=>b.id===body)||{}).shape;
      const nf={id:uid('xf'),type:'xfillet',name:'',edges:L.map(e=>{
        const o={pos:e.mid.slice(),pos0:e.mid.slice(),r,len:+e.length,anchor:null,name:entName('edge')};
        if(cham&&shape){ // normale de la première face, comme à la création à la souris (rejeu, répétitions)
          let eh=null,ff=null;
          try{eh=occEdgeAt(shape,e._src);ff=eh?occChamferFirstFace(shape,eh,false,null):null;if(ff&&ff.n)o.fn=ff.n.map(v=>+v.toFixed(4));}catch(err){}
          try{if(ff&&ff.f)ff.f.delete();}catch(err){}try{if(eh)eh.delete();}catch(err){}
        }
        return o;}),visible:true,tangent:c.tangent!==false,droit:true,body};
      if(cham){nf.chamfer=true;nf.cmode='eq';}
      nf.name=c.name?String(c.name):xFeatName(nf);
      addFeature(nf);if(c.id!=null)ids[String(c.id)]=nf.id;
      mfGeoLibere();
      const v=mfDoitChanger(v0,what),al=mfAlerteArrondi(nf);
      if(al)throw new Error(what+' : '+al);
      return {op:what,id:nf.id,name:nf.name,edges:L.map(e=>e.index),volume:v};
    }finally{mfGeoLibere();}
  },
  shell(c,ids){
    const t=mfNum(c.thickness,'shell.thickness');if(!(t>0))throw new Error('shell : épaisseur > 0 attendue');
    if(c.faces==null)throw new Error('shell : « faces » attendu (faces retirées, l’ouverture)');
    const v0=mfVolume(),G=mfGeometrie();
    try{
      const L=mfFacesChoisies(c.faces,G,'shell.faces'),body=mfCorpsDe(L);
      const faces=L.map(f=>{const r=f._ref;return {pos:r.pos.slice(),dim:r.dim.slice(),n:r.n.slice()};});
      const nf={id:uid('sh'),type:'xshell',name:'',faces,thick:t,visible:true,body};
      nf.name=c.name?String(c.name):shellName(nf);
      addFeature(nf);if(c.id!=null)ids[String(c.id)]=nf.id;
      mfGeoLibere();
      return {op:'shell',id:nf.id,name:nf.name,faces:L.map(f=>f.index),volume:mfDoitChanger(v0,'shell')};
    }finally{mfGeoLibere();}
  },
  hole(c,ids){
    const sk=mfSketchFind(c.sketch,ids);if(!sk)throw new Error('hole : esquisse « '+c.sketch+' » introuvable');
    if(!holePoints(sk).length)throw new Error('hole : l’esquisse « '+sk.name+' » n’a aucun centre de perçage ({"hole":[x,y]} dans shapes)');
    const kind=c.kind||(c.cbore?'cbore':c.csink?'csink':'simple');
    if(!['simple','cbore','csink'].includes(kind))throw new Error('hole : kind simple, cbore ou csink');
    const nf={id:uid('ho'),type:'hole',name:'',sketchId:sk.id,kind,d:6.6,thread:null,
      cbD:11,cbH:6.4,csD:13,csA:90,end:c.through?'through':'blind',depth:15,tip:118,flip:false,op:'cut',visible:true};
    if(c.thread){
      const t=mfHoleThread(nf,c.thread),p=c.pitch!=null?mfNum(c.pitch,'hole.pitch'):t[2];
      nf.thread={size:t[0],p};
      if(!threadInfo(t[0]).model)nf.thread.model=false;
      nf.d=tapDrill(t[0],p);
    }
    if(c.d!=null){nf.d=mfNum(c.d,'hole.d');}
    if(!(nf.d>0))throw new Error('hole : Ø d > 0 attendu');
    if(c.depth!=null){nf.depth=mfNum(c.depth,'hole.depth');if(!(nf.depth>0))throw new Error('hole : profondeur > 0 attendue');}
    else if(!c.through)throw new Error('hole : « depth » (mm) ou "through":true attendu');
    if(c.tip!=null)nf.tip=mfNum(c.tip,'hole.tip');
    if(nf.thread&&!(nf.thread.len>0))nf.thread.len=c.threadLength!=null?mfNum(c.threadLength,'hole.threadLength'):Math.max(2*isoThread(nf.thread.size)[1],+nf.depth-2*nf.thread.p);
    if(kind==='cbore'){const b=c.cbore||{};if(b.d!=null)nf.cbD=mfNum(b.d,'hole.cbore.d');if(b.depth!=null)nf.cbH=mfNum(b.depth,'hole.cbore.depth');if(!(nf.cbD>nf.d))throw new Error('hole : lamage Ø > Ø du trou attendu');}
    if(kind==='csink'){const b=c.csink||{};if(b.d!=null)nf.csD=mfNum(b.d,'hole.csink.d');if(b.angle!=null)nf.csA=mfNum(b.angle,'hole.csink.angle');if(!(nf.csD>nf.d))throw new Error('hole : fraisure Ø > Ø du trou attendu');}
    // sens : vers la matière, comme à la création à la souris (sauf "flip" donné)
    const v0=mfVolume();
    if(c.flip!=null)nf.flip=!!c.flip;
    else try{
      markDirty();rebuild();
      if(occHas()&&occLive&&occLive.shape){
        const A=holeAxis(nf,sk),P=A.pts[0],D=A.dir,cl=occClassifier(occLive.shape),IN=occt.TopAbs_State.TopAbs_IN;
        const st=s=>{const p=new occt.gp_Pnt_3(P.x+D.x*s,P.y+D.y*s,P.z+D.z*s);cl.Perform(p,1e-6);const r=cl.State();try{p.delete();}catch(e){}return r;};
        if(st(0.6)!==IN&&st(-0.6)===IN)nf.flip=true;
        try{cl.delete();}catch(e){}
      }
    }catch(e){}
    sk.visible=false;
    nf.name=c.name?String(c.name):holeName(nf);
    addFeature(nf);if(c.id!=null)ids[String(c.id)]=nf.id;
    return {op:'hole',id:nf.id,name:nf.name,holes:holePoints(sk).length,volume:mfDoitChanger(v0,'hole')};
  },
  pattern(c,ids){
    const ty={linear:'lin',circular:'circ',mirror:'mir'}[String(c.type||'linear')];
    if(!ty)throw new Error('pattern : type linear, circular ou mirror');
    const src=(Array.isArray(c.features)?c.features:[c.features]).map(r=>{
      const f=mfFeatureFind(r,ids);if(!f)throw new Error('pattern : fonction « '+r+' » introuvable');
      if(!repCanFeature(f.id))throw new Error('pattern : « '+f.name+' » ('+f.type+') ne se répète pas');
      return f;});
    const rp={id:uid('rp'),type:'repeat',name:'',mode:ty,copies:2,q:1,dist:20,angle:360,axis:'X',plane:'YZ',
      base:src.sort((a,b)=>doc.features.indexOf(a)-doc.features.indexOf(b)).map(f=>f.id),children:[],visible:true};
    if(ty!=='mir'){const n=Math.round(mfNum(c.count,'pattern.count'));if(!(n>=2))throw new Error('pattern : count ≥ 2 attendu (source comprise)');rp.copies=repMaxCopies(n-1);}
    if(ty==='lin'){rp.dist=mfNum(c.distance,'pattern.distance');rp.axis=String(c.axis||'X').toUpperCase();}
    if(ty==='circ'){rp.angle=c.angle!=null?mfNum(c.angle,'pattern.angle'):360;rp.axis=String(c.axis||'Z').toUpperCase();}
    if(ty!=='mir'&&!['X','Y','Z'].includes(rp.axis))throw new Error('pattern : axe X, Y ou Z');
    if(ty==='mir'){rp.plane=String(c.plane||'YZ').toUpperCase();if(!['XY','XZ','YZ'].includes(rp.plane))throw new Error('pattern : plan XY, XZ ou YZ');}
    rp.name=c.name?String(c.name):repTypeName(ty,rp);
    addFeature(rp);const nb=repGenChildren(rp);if(c.id!=null)ids[String(c.id)]=rp.id;
    return {op:'pattern',id:rp.id,name:rp.name,instances:nb};
  },
  mirror(c,ids){
    const has=id=>id&&(doc.bodies||[]).some(b=>b.id===id);
    let id=c.body!=null?(((doc.bodies||[]).find(b=>b.id===c.body||b.name===c.body))||{}).id:(has(doc.activeBody)?doc.activeBody:((doc.bodies||[])[0]||{}).id);
    if(!id)throw new Error('mirror : corps « '+c.body+' » introuvable');
    const pl=String(c.plane||'YZ').toUpperCase();if(!['XY','XZ','YZ'].includes(pl))throw new Error('mirror : plan XY, XZ ou YZ');
    const f={id:uid('bm'),type:'bmirror',name:'',body:id,plane:pl,visible:true};
    f.name=c.name?String(c.name):bmirName(f);
    addFeature(f);if(c.id!=null)ids[String(c.id)]=f.id;
    return {op:'mirror',id:f.id,name:f.name};
  },
  set(c,ids){return mfSet(c,ids);}
};
