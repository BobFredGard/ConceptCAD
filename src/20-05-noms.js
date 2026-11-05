/* NOMS UNIQUES DES FACES ET DES ARÊTES — socle.
   Retrouver un élément par sa position échoue dès qu'une voisine arrive plus près de l'ancien
   endroit (Barquette, longueur 230 → 237 : l'esquisse sautait sur l'arête intérieure). Le noyau
   sait pourtant dire ce que chaque face devient à chaque opération : on s'en sert.
   - Une FACE reçoit un nom à sa naissance (« ex_3/e6/flanc », « ex_3/haut »), le garde quand une
     opération la modifie ; coupée, chaque morceau reçoit un nom dérivé (#1, #2…) ; un congé naît
     du nom de son arête (« xf_4[ex_3/haut|ex_3/e6/flanc] »).
   - Une ARÊTE n'a pas de nom propre transmis : elle se nomme par les faces qu'elle sépare, ce qui
     évite tout calcul tant que personne ne la demande.
   Ce module OBSERVE : il ne change jamais un solide, et aucune de ses erreurs ne remonte.
   Table d'un solide : {f:[nom par rang], a:{ancien nom → nom gardé}} ; rang = FindIndex de la
   carte des faces, moins 1. Une copie exacte garde l'ordre, donc sa table (points de contrôle). */
const NOMS_TABLES=new WeakMap();
let nomsActif=true;
let NOMS_CARTE=null;
function nomsCarte(s,t,a){
  if(!NOMS_CARTE)NOMS_CARTE=occt.NCollection_IndexedDataMap_TopoDS_Shape_NCollection_List_TopoDS_Shape_TopTools_ShapeMapHasher||null;
  if(!NOMS_CARTE)return null;
  const m=new NOMS_CARTE();
  occt.TopExp.MapShapesAndAncestors(s,t,a,m);
  return m;
}
function nomsCarteFaces(s){const E=occt.TopAbs_ShapeEnum;return nomsCarte(s,E.TopAbs_FACE,E.TopAbs_SHELL);} // coques ouvertes comprises
function nomsListe(l){
  // Le noyau rend une référence vers sa liste interne : copie avant de la consommer
  const R=[];if(!l)return R;
  const n=l.Size();if(!n)return R;
  const cp=new occt.TopTools_ListOfShape_1();
  try{cp.Assign(l);for(let i=0;i<n;i++){R.push(cp.First_1?cp.First_1():cp.First());cp.RemoveFirst();}}
  finally{try{cp.delete();}catch(e){}}
  return R;
}
function nomsDe(s){return s?(NOMS_TABLES.get(s)||null):null;}
function nomsPartage(src,dst){
  // dst = copie exacte de src, ou src elle-même sous un autre objet
  if(!nomsActif||!src||!dst)return dst;
  const t=NOMS_TABLES.get(src);if(t)NOMS_TABLES.set(dst,t);
  return dst;
}
function nomsCentre(f){
  try{const b=occFaceBox(f);if(b&&b.pos)return b.pos;}catch(e){}
  return[0,0,0];
}
function nomsTransmet(entrees,api,res,opts){
  // entrees : solides d'entrée ; api : builder (Modified, éventuellement Generated, IsDeleted) ;
  // res : solide obtenu. opts.gen(x,nom) : nom d'une face née de la face x.
  if(!nomsActif||!res)return res;
  let mR=null;
  try{
    const avec=(entrees||[]).filter(s=>s&&NOMS_TABLES.get(s));
    if(!avec.length)return res;
    mR=nomsCarteFaces(res);if(!mR)return res;
    const N=mR.Size(),par=Array.from({length:N},()=>[]),seen=new Set();
    avec.forEach(s=>{
      const T=NOMS_TABLES.get(s);let mS=null;
      try{
        mS=nomsCarteFaces(s);if(!mS)return;
        const n=mS.Size();
        for(let i=1;i<=n;i++){
          const nom=T.f[i-1];if(!nom)continue;
          const x=mS.FindKey(i);
          const ici=mR.FindIndex(x);
          if(ici>0)par[ici-1].push({nom,seul:true});
          let L=[];try{L=nomsListe(api.Modified(x));}catch(e){L=[];}
          // Dépouille : ses faces inclinées ne sont données que par ModifiedShape
          if(!L.length&&ici<=0&&api.ModifiedShape){try{const y=api.ModifiedShape(x);if(y&&!y.IsNull())L=[y];}catch(e){}}
          const pieces=[];
          L.forEach(y=>{const j=mR.FindIndex(y);if(j>0&&pieces.every(p=>p.j!==j))pieces.push({j,y});});
          if(pieces.length===1)par[pieces[0].j-1].push({nom,seul:true});
          else if(pieces.length>1){
            // Morceaux d'une face coupée : ordre géométrique, pas celui du noyau
            pieces.forEach(p=>{p.c=nomsCentre(p.y);});
            pieces.sort((a,b)=>(a.c[0]-b.c[0])||(a.c[1]-b.c[1])||(a.c[2]-b.c[2]));
            pieces.forEach((p,k)=>par[p.j-1].push({nom:nom+'#'+(k+1),seul:false}));
          }
        }
        Object.keys(T.a||{}).forEach(k=>seen.add(JSON.stringify([k,T.a[k]])));
      }finally{try{if(mS)mS.delete();}catch(e){}}
    });
    const f=new Array(N).fill(null),a={};
    seen.forEach(j=>{const q=JSON.parse(j);a[q[0]]=q[1];});
    par.forEach((P,i)=>{
      if(!P.length)return;
      // Faces fusionnées (unification) : le plus petit nom reste, les autres y renvoient
      const noms=[...new Set(P.map(p=>p.nom))].sort();
      f[i]=noms[0];
      noms.slice(1).forEach(x=>{a[x]=noms[0];});
    });
    if(opts&&opts.nais)opts.nais(mR,f);
    // Deux faces de même nom (contours d'une même esquisse, chacun son dessus) : #2, #3… dans l'ordre géométrique
    const vus=new Map();
    f.forEach((n,i)=>{if(n){if(!vus.has(n))vus.set(n,[]);vus.get(n).push(i);}});
    vus.forEach((L,n)=>{
      if(L.length<2)return;
      const q=L.map(i=>({i,c:nomsCentre(mR.FindKey(i+1))}));
      q.sort((x,y)=>(x.c[0]-y.c[0])||(x.c[1]-y.c[1])||(x.c[2]-y.c[2]));
      q.forEach((x,k)=>{if(k)f[x.i]=n+'#'+(k+1);});
    });
    NOMS_TABLES.set(res,{f,a});
  }catch(e){}
  finally{try{if(mR)mR.delete();}catch(e){}}
  return res;
}
function nomsNomme(res,fn){
  // Naissance : fn(carte des faces, tableau des noms par rang)
  if(!nomsActif||!res)return res;
  let m=null;
  try{
    m=nomsCarteFaces(res);if(!m)return res;
    const f=new Array(m.Size()).fill(null);
    fn(m,f);
    NOMS_TABLES.set(res,{f,a:{}});
  }catch(e){}
  finally{try{if(m)m.delete();}catch(e){}}
  return res;
}
function nomsApresUnify(u,s,r){
  // ShapeUpgrade_UnifySameDomain : l'historique passe par une poignée
  if(!nomsActif||!NOMS_TABLES.get(s))return;
  try{
    const h=u.History(),H=h&&h.get?h.get():h;
    nomsTransmet([s],{Modified:x=>H.Modified(x)},r);
  }catch(e){}
}
function nomsApresConge(mf,base,s,chamfer){
  // Faces gardées : historique. Face née : nom de l'arête dont elle vient (stable d'un rejeu à l'autre)
  if(!nomsActif||!NOMS_TABLES.get(base))return;
  let R=null;
  try{
    R=nomsAretes(base);
    nomsTransmet([base],mf,s,{nais:(m,f)=>{
      if(!R)return;
      const n=R.carte.Size(),pre=chamfer?'chanfrein':'congé';
      for(let i=1;i<=n;i++){
        let k=0;
        nomsListe(mf.Generated(R.carte.FindKey(i))).forEach(y=>{
          const j=m.FindIndex(y);
          if(j>0&&!f[j-1]){f[j-1]=pre+'['+R.noms[i-1]+']'+(k?'#'+(k+1):'');k++;}
        });
      }
    }});
  }catch(e){}
  finally{try{if(R)R.carte.delete();}catch(e){}}
}
function nomsPrefixe(s,pre){
  // Le prisme ne connaît que son esquisse : la fonction ajoute son identifiant
  const T=s&&NOMS_TABLES.get(s);if(!T)return s;
  const a={};Object.keys(T.a||{}).forEach(k=>{a[pre+'/'+k]=pre+'/'+T.a[k];});
  NOMS_TABLES.set(s,{f:T.f.map(n=>n?pre+'/'+n:null),a});
  return s;
}
function nomsBoutsPrisme(pr){
  // Les deux noyaux ne nomment pas pareil cette surcharge
  return[pr.FirstShape_1?pr.FirstShape_1():pr.FirstShape(),pr.LastShape_1?pr.LastShape_1():pr.LastShape()];
}
function nomsPrismeFaces(pr,res,cotes){
  // cotes : [{e:arête du contour,id:entité d'esquisse}]
  // Vaut aussi pour la révolution (pas de bouts sur un tour complet) et le balayage (un côté du
  // profil peut faire plusieurs faces, une par tronçon du chemin : #2, #3…).
  return nomsNomme(res,(m,f)=>{
    const pris=new Set();
    const pose=(x,nom)=>{
      const j=m.FindIndex(x);if(j<=0||f[j-1])return;
      let n=nom;for(let k=2;pris.has(n);k++)n=nom+'#'+k;
      f[j-1]=n;pris.add(n);
    };
    (cotes||[]).forEach(c=>{try{nomsListe(pr.Generated(c.e)).forEach(y=>pose(y,c.id+'/flanc'));}catch(e){}});
    try{
      const bouts=nomsBoutsPrisme(pr);
      if(bouts[0]&&!bouts[0].IsNull())pose(bouts[0],'bas');
      if(bouts[1]&&!bouts[1].IsNull())pose(bouts[1],'haut');
    }catch(e){}
  });
}
/* ----- arêtes : nom déduit des faces qu'elles séparent ----- */
function nomsAretes(s){
  // → {noms:[nom par rang de la carte des arêtes], carte} ; l'appelant libère la carte
  const T=NOMS_TABLES.get(s);if(!T)return null;
  const E=occt.TopAbs_ShapeEnum;
  const mE=nomsCarte(s,E.TopAbs_EDGE,E.TopAbs_FACE),mF=nomsCarteFaces(s);
  const mV=nomsCarte(s,E.TopAbs_VERTEX,E.TopAbs_FACE);
  try{
    const nomF=x=>{const j=mF.FindIndex(x);return j>0?(T.f[j-1]||'?'):'?';};
    const N=mE.Size(),rows=[];
    for(let i=1;i<=N;i++){
      const paire=[...new Set(nomsListe(mE.FindFromIndex(i)).map(nomF))].sort();
      rows.push({i,cle:paire.join('|'),paire});
    }
    // Deux arêtes entre les mêmes faces : départagées par les faces qui touchent leurs bouts
    const grp=new Map();rows.forEach(r=>{if(!grp.has(r.cle))grp.set(r.cle,[]);grp.get(r.cle).push(r);});
    grp.forEach(L=>{
      if(L.length<2)return;
      L.forEach(r=>{
        const e=occt.TopoDS.Edge_1(mE.FindKey(r.i)),v=new Set();
        [occt.TopExp.FirstVertex(e,false),occt.TopExp.LastVertex(e,false)].forEach(q=>{
          const j=mV.FindIndex(q);if(j>0)nomsListe(mV.FindFromIndex(j)).forEach(fx=>v.add(nomF(fx)));});
        r.bouts=[...v].filter(n=>r.paire.indexOf(n)<0).sort().join(',');
      });
      const g2=new Map();L.forEach(r=>{if(!g2.has(r.bouts))g2.set(r.bouts,[]);g2.get(r.bouts).push(r);});
      g2.forEach((M,b)=>{
        // Vraies jumelles : ordre géométrique, pas celui du noyau
        if(M.length>1){
          M.forEach(r=>{
            r.c=[0,0,0];
            try{const ad=new occt.BRepAdaptor_Curve_2(occt.TopoDS.Edge_1(mE.FindKey(r.i)));const p=ad.Value((ad.FirstParameter()+ad.LastParameter())/2);r.c=[p.X(),p.Y(),p.Z()];try{p.delete();}catch(e){}try{ad.delete();}catch(e){}}catch(e){}
          });
          M.sort((x,y)=>(x.c[0]-y.c[0])||(x.c[1]-y.c[1])||(x.c[2]-y.c[2]));
        }
        M.forEach((r,k)=>{r.cle+=(b?'<'+b+'>':'')+(M.length>1?'#'+(k+1):'');});
      });
    });
    return{noms:rows.map(r=>r.cle),carte:mE};
  }finally{try{mF.delete();}catch(e){}try{mV.delete();}catch(e){}}
}
function nomsAreteDe(s,x){
  // Nom de l'arête x du solide s, ou null
  let R=null;
  try{R=nomsAretes(s);if(!R)return null;const j=R.carte.FindIndex(x);return j>0?R.noms[j-1]:null;}
  catch(e){return null;}
  finally{try{if(R)R.carte.delete();}catch(e){}}
}
/* ----- composés, morceaux, opérations sans historique ----- */
function nomsCompose(parts,res,ids){
  // res = composé de parts, ou morceau de parts[0] : mêmes faces, donc mêmes noms. Un nom déjà pris
  // dans un autre corps (découpe rejouée dans plusieurs corps, scission) reçoit l'identifiant du corps.
  if(!nomsActif||!res)return res;
  if(parts.length===1&&parts[0]===res)return res;
  let m=null;
  try{
    m=nomsCarteFaces(res);if(!m)return res;
    const f=new Array(m.Size()).fill(null),a={},vus=new Set();
    parts.forEach((p,k)=>{
      const T=p&&NOMS_TABLES.get(p);if(!T)return;
      let mP=null;
      try{
        mP=nomsCarteFaces(p);
        for(let i=1;i<=mP.Size();i++){
          const n=T.f[i-1];if(!n)continue;
          const j=m.FindIndex(mP.FindKey(i));if(j<=0)continue;
          const q=vus.has(n)?n+'@'+((ids&&ids[k])||k):n;
          vus.add(q);f[j-1]=q;
        }
        Object.assign(a,T.a||{});
      }finally{try{if(mP)mP.delete();}catch(e){}}
    });
    NOMS_TABLES.set(res,{f,a});
  }catch(e){}
  finally{try{if(m)m.delete();}catch(e){}}
  return res;
}
function nomsMemeRangs(src,dst){
  // dst = src transformé (déplacement, échelle) : même structure, donc mêmes rangs
  if(!nomsActif||!src||!dst||!NOMS_TABLES.get(src))return dst;
  let a=null,b=null;
  try{
    a=nomsCarteFaces(src);b=nomsCarteFaces(dst);
    if(a&&b&&a.Size()===b.Size())NOMS_TABLES.set(dst,NOMS_TABLES.get(src));
  }catch(e){}
  finally{try{if(a)a.delete();}catch(e){}try{if(b)b.delete();}catch(e){}}
  return dst;
}
function nomsInstantane(s){
  // Photo de l'entrée d'une opération dont le noyau ne donne pas l'historique : surface + centre par nom
  if(!nomsActif||!s)return null;
  const T=NOMS_TABLES.get(s);if(!T)return null;
  let m=null;
  try{
    m=nomsCarteFaces(s);if(!m)return null;
    const L=[];
    for(let i=1;i<=m.Size();i++){
      const nom=T.f[i-1];if(!nom)continue;
      const x=occt.TopoDS.Face_1(m.FindKey(i));
      try{L.push({nom,d:occSurfDesc(x),c:nomsCentre(x)});}catch(e){}
      finally{try{x.delete();}catch(e){}}
    }
    return{L,a:Object.assign({},T.a||{})};
  }catch(e){return null;}
  finally{try{if(m)m.delete();}catch(e){}}
}
function nomsCompleter(res,fid,snap){
  // Aucune face sans nom après une opération. 1) snap : une face restée sur la surface d'une face
  // d'entrée reprend son nom. 2) fid : les autres sont nées de la fonction (« fid/~k », dans l'ordre
  // géométrique). Sans fid, elles restent à nommer plus loin.
  if(!nomsActif||!res)return res;
  let T=NOMS_TABLES.get(res);
  if(T&&T.f.length&&T.f.indexOf(null)<0)return res;
  let m=null;
  try{
    m=nomsCarteFaces(res);if(!m)return res;
    const N=m.Size();
    if(T&&T.f.length!==N)T=null;
    const f=T?T.f:new Array(N).fill(null);
    const a=T?(T.a=T.a||{}):(snap?Object.assign({},snap.a):{});
    const pris=new Set(f.filter(Boolean));
    const libre=n=>{if(!pris.has(n))return n;for(let k=2;;k++){const q=n+'#'+k;if(!pris.has(q))return q;}};
    let vides=[];
    for(let i=0;i<N;i++)if(!f[i]){const x=occt.TopoDS.Face_1(m.FindKey(i+1));vides.push({i,x,c:nomsCentre(x)});}
    vides.sort((p,q)=>(p.c[0]-q.c[0])||(p.c[1]-q.c[1])||(p.c[2]-q.c[2]));
    if(snap&&snap.L.length)vides=vides.filter(v=>{
      let d=null;try{d=occSurfDesc(v.x);}catch(e){return true;}
      const c=snap.L.filter(q=>{try{return occSameSurf(q.d,d);}catch(e){return false;}});
      if(!c.length)return true;
      const dist=q=>Math.hypot(q.c[0]-v.c[0],q.c[1]-v.c[1],q.c[2]-v.c[2]);
      c.sort((p,q)=>dist(p)-dist(q));
      const q=c.find(z=>!pris.has(z.nom))||c[0];
      const n=libre(q.nom);f[v.i]=n;pris.add(n);
      return false;
    });
    if(fid)vides.forEach((v,k)=>{const n=libre(fid+'/~'+(k+1));f[v.i]=n;pris.add(n);});
    if(!T)NOMS_TABLES.set(res,{f,a});
  }catch(e){}
  finally{try{if(m)m.delete();}catch(e){}}
  return res;
}
function nomsFaceSurSurface(res,nom,nd){
  // Déplacer une face : la nouvelle face, née de l'outil, garde le nom de celle qu'elle remplace
  if(!nomsActif||!res||!nom)return res;
  const T=NOMS_TABLES.get(res);if(!T)return res;
  let m=null;
  try{
    m=nomsCarteFaces(res);if(!m||T.f.length!==m.Size())return res;
    const pris=new Set(T.f.filter(Boolean));let k=0;
    for(let i=0;i<T.f.length;i++){
      if(T.f[i])continue;
      const x=occt.TopoDS.Face_1(m.FindKey(i+1));
      try{
        if(occSameSurf(occSurfDesc(x),nd)){
          let n=nom;while(pris.has(n))n=nom+'#'+(++k+1);
          T.f[i]=n;pris.add(n);
        }
      }catch(e){}
      finally{try{x.delete();}catch(e){}}
    }
  }catch(e){}
  finally{try{if(m)m.delete();}catch(e){}}
  return res;
}
/* ----- retrouver une référence par son nom ----- */
const NOMS_CLES={nom:1,srcNom:1,nomDe:1,srcNomDe:1};
function nomsSansCles(k,v){return NOMS_CLES[k]?undefined:v;} // ni signature, ni empreinte : le nom ne change pas la géométrie
let NOMS_PERTES=[]; // pertes de la fonction en cours de rejeu
const NOMS_PERTES_ESQ=new Map(); // pertes hors rejeu (projections, construction) : affichées tant qu'elles durent
function nomsPerteLue(){const L=NOMS_PERTES;NOMS_PERTES=[];return L;}
function nomsPerteNote(cle,msg){NOMS_PERTES_ESQ.set(cle,msg);}
function nomsPerteOubli(cle){NOMS_PERTES_ESQ.delete(cle);}
function nomsPos(p){return Array.isArray(p)?'('+p.map(v=>(+v).toFixed(1)).join(', ')+')':'';}
function nomsFaceDe(shape,face){
  // Nom de la face (handle sur shape), ou null
  const T=shape&&NOMS_TABLES.get(shape);if(!T||!face)return null;
  let m=null;
  try{m=nomsCarteFaces(shape);if(!m)return null;const j=m.FindIndex(face);return j>0?(T.f[j-1]||null):null;}
  catch(e){return null;}
  finally{try{if(m)m.delete();}catch(e){}}
}
function nomsRefFace(shape,ref){
  // Face désignée par ref.nom, handle neuf à libérer ; null si pas de nom ou nom absent de ce solide
  if(!nomsActif||!ref||!ref.nom||!shape)return null;
  const T=NOMS_TABLES.get(shape);if(!T)return null;
  let m=null;
  try{
    m=nomsCarteFaces(shape);if(!m||T.f.length!==m.Size())return null;
    let nom=ref.nom,g=0,i=T.f.indexOf(nom);
    const a=T.a||{};
    while(i<0&&a[nom]&&g++<8){nom=a[nom];i=T.f.indexOf(nom);}
    const proche=L=>{
      if(L.length<2||!Array.isArray(ref.pos))return L[0];
      let b=L[0],bd=1e18;
      L.forEach(k=>{const x=m.FindKey(k+1),c=nomsCentre(x),d=Math.hypot(c[0]-ref.pos[0],c[1]-ref.pos[1],c[2]-ref.pos[2]);if(d<bd){bd=d;b=k;}});
      return b;
    };
    if(i<0){
      // Face coupée depuis (#1, #2…) ou nom d'un morceau recollé depuis : le morceau le plus proche
      const base=nom.replace(/(#\d+)+$/,''),L=[];
      T.f.forEach((n,k)=>{if(n&&(n===base||n.indexOf(nom+'#')===0||n.indexOf(base+'#')===0))L.push(k);});
      if(L.length)i=proche(L);
    }
    if(i<0){NOMS_PERTES.push('la face d’origine n’existe plus'+(ref.pos?' près de '+nomsPos(ref.pos):'')+' — recherche par position');return null;}
    return occt.TopoDS.Face_1(m.FindKey(i+1));
  }catch(e){return null;}
  finally{try{if(m)m.delete();}catch(e){}}
}
function nomsRefNote(shape,ref,face){
  // Première résolution par la géométrie (document ancien, sélection neuve) : le nom est retenu
  if(!nomsActif||!ref||ref.nom||!face)return;
  const n=nomsFaceDe(shape,face);if(n)ref.nom=n;
}
function nomsDecoupe(nom){
  // Nom d'arête → noms de ses faces (crochets et chevrons respectés)
  let prof=0,cur='';const fa=[];
  for(let i=0;i<nom.length;i++){
    const c=nom[i];
    if(c==='[')prof++;else if(c===']')prof--;
    if(!prof&&c==='<')break;
    if(!prof&&c==='|'){fa.push(cur);cur='';continue;}
    cur+=c;
  }
  fa.push(cur);
  return fa;
}
function nomsBase(n,a){
  // Tous les numéros : une copie de répétition porte « flanc#1#1 », et quand la face n'est plus coupée
  // il ne reste que « flanc » (Barquette, largeur 175 : la copie du congé ne se retrouvait plus)
  n=n.replace(/(#\d+)+$/,'');
  let g=0;while(a&&a[n]&&g++<8)n=a[n].replace(/(#\d+)+$/,'');
  return n;
}
function nomsSurAretes(shape,edges){
  // Pose .nom sur la liste d'occListEdges (src = rang de l'explorateur)
  if(!nomsActif||!shape||!edges||!edges.length)return edges;
  const T=NOMS_TABLES.get(shape);if(!T)return edges;
  let R=null,ex=null;
  try{
    R=nomsAretes(shape);if(!R)return edges;
    const E=occt.TopAbs_ShapeEnum,par=new Map(edges.map(e=>[e.src,e]));
    ex=new occt.TopExp_Explorer_2(shape,E.TopAbs_EDGE,E.TopAbs_SHAPE);
    for(let k=0;ex.More();k++,ex.Next()){
      const e=par.get(k);if(!e)continue;
      const j=R.carte.FindIndex(ex.Current());
      if(j>0)e.nom=R.noms[j-1];
    }
    edges.alias=T.a||{};
  }catch(e){}
  finally{try{if(ex)ex.delete();}catch(e){}try{if(R)R.carte.delete();}catch(e){}}
  return edges;
}
function nomsTrouveArete(edges,nom,pos){
  // Rang dans la liste, ou -1. Nom exact ; sinon mêmes faces (morceaux, fusions), au plus près de pos.
  if(!nom||!edges||!edges.length)return -1;
  const i=edges.findIndex(e=>e.nom===nom);if(i>=0)return i;
  const a=edges.alias||{};
  const cle=n=>nomsDecoupe(n).map(x=>nomsBase(x,a)).sort().join('|');
  const c=cle(nom),L=[];
  edges.forEach((e,k)=>{if(e.nom&&cle(e.nom)===c)L.push(k);});
  if(!L.length)return -1;
  if(L.length===1||!Array.isArray(pos))return L[0];
  const d=k=>{const m=edges[k].mid;return Math.hypot(m[0]-pos[0],m[1]-pos[1],m[2]-pos[2]);};
  L.sort((x,y)=>d(x)-d(y));
  return L[0];
}
