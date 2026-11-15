/* ============ FAO : perçage — trous reconnus sur le modèle ============
   2026-10-15-011 — retour : « l'opération Perçage ne fait rien, pas d'outil ni
   parcours » (elle créait UN trou au centre du brut, sur toute la hauteur, avec la
   fraise T1, et n'affichait rien avant « Tout régénérer »).
   • RECONNAISSANCE (géométrie exacte OCCT, pas le maillage) : un trou = cylindre
     intérieur (face REVERSED) d'axe vertical, couverture ≥ 270° ; on relève X/Y, Ø,
     Z haut/bas, débouchant (classifieur : sous le fond = hors matière) ou borgne,
     angle de pointe (cône coaxial sous le fond), chanfrein / lamage d'entrée (cône
     ou cylindre coaxial plus large au-dessus).
   • SÉLECTION : par GROUPE (même Ø + même hauteur de départ) — cases dans la fiche
     ou clic sur un trou dans la vue. op.holeSel = [{d,z}] ; les trous sont re-résolus
     sur le modèle à chaque reconstruction (op.holes = instantané → clé de cache).
   • PROFONDEUR : plein Ø au fond du trou (défaut : + longueur de pointe), pointe au
     fond, ou cote manuelle ; débouchant : + débouchage (1 mm) ; pointage : Ø de
     chanfrein voulu → profondeur selon l'angle du foret à centrer.
   • ORDRE : plus court chemin (plus proche voisin + 2-opt) ou zigzag.
   • OUTIL : types « Foret », « Foret à pointer » et « Foret à centrer » DIN 333 A
     (2026-10-22-001 : pilote + cône 60°) (angle de pointe, avance par tour
     F = f × S) ; sélectionner un groupe affecte le foret du même Ø de la
     bibliothèque, ou le CRÉE. */
// V0.99.9 : alésoir (kind 'ream') — outil à avance par tour comme un foret, bout plat à
// chanfrein d'entrée 45° (faoReamLead), cycle « Alésage » (CYCLE85 / G85 : entrée ET sortie en avance).
const FAO_DRILL_KINDS={drill:1,spot:1,center:1,ream:1};
function faoToolIsDrill(t){ return !!(t&&FAO_DRILL_KINDS[t.kind]); }
function faoToolAngle(t){ const a=t&&+t.ang; return (isFinite(a)&&a>20&&a<180)?a:(t&&(t.kind==='spot'||t.kind==='chamfer'||t.kind==='ream')?90:118); }
function faoReamLead(t){ const D=(t&&+t.d>0)?+t.d:6; return +Math.max(0.2,Math.min(1,D*0.05)).toFixed(3); } // chanfrein d'entrée (mm)
function faoToolTipLen(t){ if(t&&t.kind==='ream')return faoReamLead(t); const D=(t&&+t.d>0)?+t.d:6; return (D/2)/Math.tan(faoToolAngle(t)*Math.PI/360); }
function faoToolFr(t){
  // Avance par tour (mm/tr) d'un foret : saisie, sinon règle d'atelier (carbure).
  const v=t&&+t.fr; if(isFinite(v)&&v>0)return v;
  const D=(t&&+t.d>0)?+t.d:6;
  if(t&&t.kind==='ream')return Math.round((0.015*D+0.08)*1000)/1000; // alésoir carbure : 0,1 à 0,4 mm/tr
  return t&&(t.kind==='spot'||t.kind==='center')?0.05:Math.round((0.012*D+0.03)*1000)/1000;
}
// Surépaisseur d'alésage sur le Ø (mm) : règle d'atelier, si la fonction n'en donne pas.
function faoReamAllow(D){ return D<=3?0.1:(D<=6?0.2:(D<=12?0.3:(D<=25?0.4:0.5))); }
/* ----- reconnaissance des trous ----- */
let faoHoleCache={shape:null,list:null};
function faoHoleShapes(){
  // 2026-10-16-019 : solides tournés dans le repère du posage actif (trous « verticaux » = selon SON Z)
  let Fr=null;try{Fr=faoFrameCur||faoFrame(faoSetup());}catch(e){}
  return faoHoleShapesW().map(function(s){return (Fr&&!Fr.id)?faoShapeToF(s,Fr):s;});
}
function faoHoleShapesW(){
  const out=[];
  // V0.21.19 : pièce SANS filets modélisés quand il y en a (le taraud fait le filet ;
  // l'avant-trou y est un vrai cylindre au Ø de perçage)
  try{ if(typeof occLive!=='undefined'&&occLive&&occLive.shape)out.push(occLive.shapeFao||occLive.shape); }catch(e){}
  try{
    (typeof bodies!=='undefined'&&bodies?bodies:[]).forEach(function(b){
      if(!b||b.kind!=='import'||b.visible===false||b.ghost)return;
      const e=(typeof importGeom!=='undefined')?importGeom.get(b.ref||b.id):null;
      if(e&&e.brep)out.push(e.brep);
    });
  }catch(e){}
  return out;
}
// V0.33.3 : axe d'une fonction Perçage vu dans le repère où les trous sont détectés (celui de
// l'opération 3+2 ou du posage, comme faoHoleShapes) — sinon un trou de flanc taraudé perdait
// sa fonction (filet, lamage) dès que l'opération le voyait « vertical ».
function faoHoleAxisF(f,sk){
  const A=holeAxis(f,sk);
  let Fr=null;try{Fr=faoFrameCur||faoFrame(faoSetup());}catch(e){}
  if(!Fr||Fr.id)return A;
  const d=faoRotF(Fr,[A.dir.x,A.dir.y,A.dir.z]);
  return {dir:{x:d[0],y:d[1],z:d[2]},pts:A.pts.map(function(p){const q=faoToF(Fr,[p.x,p.y,p.z]);return {id:p.id,x:q[0],y:q[1],z:q[2]};})};
}
function faoHolesDetect(shapes){
  // V0.99.10 : repère d'une opération 3+2 (faoFrameCur) : trous gardés par repère (faoHoleMemo) — une
  // gamme sur 16 orientations relisait la pièce tournée à chaque appel (SIRAP-14-002 : 30 s)
  if(!shapes&&faoFrameCur&&!faoFrameCur.id){
    const k=faoHoleMemoKey();
    if(k&&faoHoleMemo.has(k))return faoHoleMemo.get(k);
    const l=faoHolesDetect0(faoHoleShapes());
    if(k){if(faoHoleMemo.size>=48)faoHoleMemo.clear();faoHoleMemo.set(k,l);}
    return l;
  }
  return faoHolesDetect0(shapes);
}
function faoHolesDetect0(shapes){
  // Liste des trous verticaux (axe ±Z) des solides donnés. Pur OCCT : testable en Node.
  shapes=shapes||faoHoleShapes();
  if(!shapes.length||typeof occt==='undefined'||!occt)return [];
  if(shapes.length===1&&faoHoleCache.shape===shapes[0]&&faoHoleCache.list)return faoHoleCache.list;
  const groups=new Map(), cones=[];
  const T=occt.GeomAbs_SurfaceType, REV=occt.TopAbs_Orientation.TopAbs_REVERSED;
  shapes.forEach(function(sh,si){
    let ex=null;
    try{ ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE); }catch(e){ return; }
    let k=0;
    while(ex.More()){
      let f=null,ad=null;const tmp=[];
      try{
        f=occFaceCur(ex);
        ad=new occt.BRepAdaptor_Surface_2(f,true);
        const ty=ad.GetType();
        if(ty===T.GeomAbs_Cylinder){
          const c=ad.Cylinder(),ax=c.Axis(),L=ax.Location(),Dd=ax.Direction();tmp.push(c,ax,L,Dd);
          // Orientation de face NON fiable (repère direct/indirect selon la construction :
          // une découpe extrudée en −Z donne des trous « FORWARD ») → tri par la matière
          // autour du cylindre, plus bas (faoHoleIsHole).
          // V0.99.13 : orientation ET sens du repère du cylindre ENSEMBLE donnent le côté de la matière,
          // lu sur la face elle-même (repère direct + face FORWARD = normale vers l'extérieur du cylindre
          // = matière dedans, pion ; chaque inversion retourne le sens) → vote « trou » par face (hv).
          if(Math.abs(Dd.Z())>0.9999){
            const r=c.Radius(),u=Math.abs(ad.LastUParameter()-ad.FirstUParameter());
            const za=L.Z()+Dd.Z()*ad.FirstVParameter(),zb=L.Z()+Dd.Z()*ad.LastVParameter();
            const key=L.X().toFixed(2)+'|'+L.Y().toFixed(2)+'|'+r.toFixed(3);
            let g=groups.get(key);
            if(!g){g={x:+L.X().toFixed(3),y:+L.Y().toFixed(3),r:r,rng:[],shape:si};groups.set(key,g);}
            let hv=null;try{const P3=c.Position();tmp.push(P3);hv=(P3.Direct()===(f.Orientation_1()===REV));}catch(e){hv=null;}
            g.rng.push({lo:Math.min(za,zb),hi:Math.max(za,zb),u:u,f:si+':'+k,hv:hv});
          }
        }else if(ty===T.GeomAbs_Cone){
          const c=ad.Cone(),ax=c.Axis(),Dd=ax.Direction();tmp.push(c,ax,Dd);
          if(Math.abs(Dd.Z())>0.9999){
            const A=c.Apex(),za=ad.FirstVParameter(),zb=ad.LastVParameter();tmp.push(A);
            // v = distance le long de la génératrice depuis la base : z = Lz + v·cos(semi)·dz
            const L=ax.Location(),cs=Math.cos(c.SemiAngle());tmp.push(L);
            const z1=L.Z()+Dd.Z()*za*cs,z2=L.Z()+Dd.Z()*zb*cs;
            cones.push({x:A.X(),y:A.Y(),apex:A.Z(),semi:Math.abs(c.SemiAngle()),zLo:Math.min(z1,z2),zHi:Math.max(z1,z2),rev:f.Orientation_1()===REV});
          }
        }
      }catch(e){}
      try{ if(ad)ad.delete(); }catch(e){}
      occDispose(tmp);occFree(f);
      k++;ex.Next();
    }
    try{ ex.delete(); }catch(e){}
  });
  // V0.21.19 : un filet modélisé est un vide construit d'un bloc (src/76,
  // occHoleThreadVoid) : crête et fût sont des faces réglées, sans cylindre analytique.
  // Le trou est alors repris de la fonction Perçage (axe, Ø de crête, profondeur).
  try{
    (doc.features||[]).forEach(function(f){
      if(!f||f.type!=='hole'||f.visible===false||!f.thread||!f.thread.model)return;
      const sk=doc.sketches.find(function(q){return q.id===f.sketchId;});if(!sk)return;
      const th=(typeof isoHoleThread==='function')?isoHoleThread(f.thread.size,f.thread.p,f.thread.clear):null;if(!th)return;
      const A=faoHoleAxisF(f,sk);if(Math.abs(A.dir.z)<0.9999)return;
      const N=holeNorm(f),rb=Math.max((+f.d)/2,th.D1/2+th.c);
      const off=holeEntryOff(N);
      let zEndAll=null;
      A.pts.forEach(function(P){
        let known=false;
        groups.forEach(function(G){if(Math.abs(G.r-rb)<0.03&&Math.hypot(G.x-P.x,G.y-P.y)<0.03)known=true;});
        if(known)return;
        let depth=N.end==='blind'?N.depth:(N.end==='upto'?holePlaneDist(f.uptoPlane,P,A.dir):null);
        let z2;
        if(depth!=null)z2=P.z+A.dir.z*depth;
        else{ // débouchant : jusqu'à la face de la pièce traversée
          if(zEndAll===null){const bb=new occt.Bnd_Box_1();shapes.forEach(function(s){occt.BRepBndLib.Add(s,bb,true);});
            zEndAll=A.dir.z<0?bb.CornerMin().Z():bb.CornerMax().Z();try{bb.delete();}catch(e){}}
          z2=zEndAll;
        }
        const z1=P.z+A.dir.z*off;
        groups.set('filet|'+P.x.toFixed(2)+'|'+P.y.toFixed(2)+'|'+rb.toFixed(3),
          {x:+P.x.toFixed(3),y:+P.y.toFixed(3),r:rb,rng:[{lo:Math.min(z1,z2),hi:Math.max(z1,z2),u:Math.PI*2,f:'filet:'+f.id}],shape:0});
      });
    });
  }catch(e){}
  // Un même axe peut porter PLUSIEURS tronçons (trou qui traverse une cavité) :
  // chaque intervalle Z contigu est un trou à part.
  const segs=new Map();
  groups.forEach(function(G,key){
    // Filet modélisé : la gorge hélicoïdale découpe la paroi cylindrique en bandes
    // étroites. On les recolle en UN tronçon continu (sinon la FAO perd le trou).
    let mod=false;
    try{
      (doc.features||[]).forEach(function(f){
        if(mod||!f||f.type!=='hole'||!f.thread||!f.thread.model)return;
        const sk=doc.sketches.find(function(q){return q.id===f.sketchId;});if(!sk)return;
        const th=(typeof isoHoleThread==='function')?isoHoleThread(f.thread.size,f.thread.p,f.thread.clear):null;if(!th)return;
        const A=faoHoleAxisF(f,sk),rb=Math.max((+f.d)/2,th.D1/2+th.c);
        A.pts.forEach(function(P){if(Math.abs(G.r-rb)<0.03&&Math.hypot(G.x-P.x,G.y-P.y)<0.03)mod=true;});
      });
    }catch(e){}
    if(mod&&G.rng.length>1){
      const R0=G.rng.slice().sort(function(a,b){return a.lo-b.lo;});
      G.rng=[{lo:R0[0].lo,hi:R0[R0.length-1].hi,u:Math.PI*2,f:R0[0].f}];
    }
    const R=G.rng.slice().sort(function(a,b){return a.lo-b.lo;});
    const out=[];
    R.forEach(function(q){const c=out[out.length-1];
      const vt=function(o){if(q.hv===true)o.vy++;else if(q.hv===false)o.vn++;else o.vx++;return o;};
      if(c&&q.lo<=c.zHi+0.01){c.zHi=Math.max(c.zHi,q.hi);c.cov+=q.u;c.faces.push(q.f);vt(c);}
      else out.push(vt({x:G.x,y:G.y,r:G.r,zLo:q.lo,zHi:q.hi,cov:q.u,faces:[q.f],shape:G.shape,modeled:mod,vy:0,vn:0,vx:0}));});
    out.forEach(function(g,i){segs.set(key+'#'+i,g);});
  });
  groups.clear();segs.forEach(function(v,k){groups.set(k,v);});
  const cls=new Map(); // un classificateur par solide, partagé (libéré en fin de détection)
  const clOf=function(i){let c=cls.get(i);if(!c){c=new occt.BRepClass3d_SolidClassifier_2(shapes[i]);cls.set(i,c);}return c;};
  const holes=[];
  groups.forEach(function(g){
    // filet modélisé : couverture/classification perturbées par la gorge → trou d'office
    if(!g.modeled){
      if(g.cov<Math.PI*1.5)return; // < 270° : congé, rainure, demi-lune — pas un trou
      // pion / bossage : matière DEDANS. V0.99.13 : faces du tronçon d'accord (toutes « trou » ou toutes
      // « pion ») → leur vote suffit (même verdict que la classification sur tous les tronçons des pièces
      // d'essai ; SIRAP-14-002 : 1,9 s → 16 ms) ; désaccord ou face illisible → classification de la matière
      // autour (faoHoleIsHole, 16 points sur le solide entier, ~7 ms par trou) comme avant.
      const vote=faoHoleVoteOff?null:(!g.vx&&g.vy&&!g.vn)?true:(!g.vx&&g.vn&&!g.vy)?false:null;
      if(vote===false||(vote===null&&!faoHoleIsHole(shapes[g.shape],g,clOf(g.shape))))return;
    }
    const h={x:g.x,y:g.y,d:+(2*g.r).toFixed(3),ztop:+g.zHi.toFixed(3),zbot:+g.zLo.toFixed(3),
      through:false,tipAng:0,zSurf:+g.zHi.toFixed(3),chD:0,cb:null,faces:g.faces};
    cones.forEach(function(c){
      if(Math.hypot(c.x-g.x,c.y-g.y)>0.01)return;
      if(c.zHi<=g.zLo+0.01&&c.apex<g.zLo)h.tipAng=+(2*c.semi*180/Math.PI).toFixed(1); // pointe de forage
      if(c.zLo>=g.zHi-0.01){ // chanfrein d'entrée
        h.chD=+(2*Math.abs(c.zHi-c.apex)*Math.tan(c.semi)).toFixed(3);h.chA=+(2*c.semi*180/Math.PI).toFixed(1);
        h.zSurf=+Math.max(h.zSurf,c.zHi).toFixed(3);
      }
    });
    holes.push(h);
  });
  // lamage / trou étagé : cylindre coaxial plus large posé sur le haut du trou
  holes.forEach(function(h){
    holes.forEach(function(o){
      if(o===h||Math.hypot(o.x-h.x,o.y-h.y)>0.01||o.d<=h.d+0.01)return;
      if(Math.abs(o.zbot-h.ztop)<0.02){h.cb={d:o.d,depth:+(o.ztop-o.zbot).toFixed(3)};h.zSurf=Math.max(h.zSurf,o.zSurf);o.step=true;}
      // double perçage (V0.31.0) : avant-trou plus large dont la pointe de foret (cône)
      // descend jusqu'au trou — ce cône n'est pas un chanfrein d'entrée du petit trou
      else if(h.chD>0&&Math.abs(o.d-h.chD)<0.05&&Math.abs(o.zbot-h.zSurf)<0.02){
        h.pre={d:o.d,depth:+(o.ztop-o.zbot).toFixed(3)};h.chD=0;h.zSurf=Math.max(h.ztop,o.zSurf);o.step=true;}
    });
  });
  // débouchant : SOUS la pointe éventuelle (le vide du cône n'est pas « sous la
  // pièce »), hors matière. Un cylindre posé sur un trou plus petit (lamage) a un
  // fond plat annulaire : borgne.
  holes.forEach(function(h,i){
    if(h.step){h.through=false;delete h.step;return;}
    const g=Array.from(groups.values()).find(function(q){return Math.abs(q.x-h.x)<1e-6&&Math.abs(q.y-h.y)<1e-6&&Math.abs(2*q.r-h.d)<1e-6;});
    let zTest=h.zbot-0.3;
    cones.forEach(function(c){ if(Math.hypot(c.x-h.x,c.y-h.y)<=0.01&&c.zHi<=h.zbot+0.01&&c.apex<h.zbot)zTest=Math.min(zTest,c.apex-0.3); });
    try{
      const cl=clOf(g?g.shape:0);
      const P=new occt.gp_Pnt_3(h.x,h.y,zTest);
      cl.Perform(P,1e-6);
      h.through=(cl.State()===occt.TopAbs_State.TopAbs_OUT);
      try{P.delete();}catch(e){}
    }catch(e){}
  });
  // Trous créés par la fonction 3D « Perçage » (src/76) : nature reconnue d'office
  // (taraudé M…, lamage, fraisure) — un STEP n'a pas cette information.
  try{
    (doc.features||[]).forEach(function(f){
      if(!f||f.type!=='hole'||f.visible===false)return;
      const sk=doc.sketches.find(function(q){return q.id===f.sketchId;});if(!sk)return;
      const A=faoHoleAxisF(f,sk);if(Math.abs(A.dir.z)<0.9999)return;
      A.pts.forEach(function(P){
        holes.forEach(function(h){
          if(Math.hypot(h.x-P.x,h.y-P.y)>0.02)return;
          // filet modélisé : le noyau est percé au Ø mineur + jeu, pas au Ø de taraud
          let de=+f.d;
          if(f.thread&&f.thread.model){const th=(typeof isoHoleThread==='function')?isoHoleThread(f.thread.size,f.thread.p,f.thread.clear):null;if(th)de=Math.max(+f.d,th.D1+2*th.c);}
          // alésé (V0.24.0) : l'alésage Ø reamD (tolérance ISO) et son perçage Ø d
          const Nr=f.kind==='ream'?holeNorm(f):null,isReam=!!Nr&&Math.abs(h.d-Nr.reamD)<0.02;
          if(Nr)de=Nr.d;
          // double perçage (V0.31.0) : l'avant-trou Ø stD est un perçage à part (foret, pointe)
          const isPre=f.kind==='step'&&Math.abs(h.d-holeNorm(f).stD)<0.02;
          if(Math.abs(h.d-de)>0.02&&!(f.kind==='cbore'&&Math.abs(h.d-(+f.cbD))<0.02)&&!isReam&&!isPre)return;
          h.feat={id:f.id,name:f.name,kind:f.kind||'simple',thread:(!Nr&&!isPre&&f.thread&&f.thread.size)?Object.assign({size:f.thread.size,p:+f.thread.p,len:+f._thLen||+f.thread.len||0},f.thread.lh?{lh:true}:{}):null,
            role:(f.kind==='cbore'&&Math.abs(h.d-(+f.cbD))<0.02)?'lamage':(isReam?'alesage':(isPre?'avant-trou':'trou'))};
          if(f.kind==='csink')h.feat.csA=+f.csA||90;
          if(isReam){h.feat.tol=f.reamTol||'H7';h.feat.reamOff=(+f.reamOff>0)?+f.reamOff:null;}
        });
      });
    });
  }catch(e){}
  holes.sort(function(a,b){return b.ztop-a.ztop||a.d-b.d||a.x-b.x||a.y-b.y;});
  cls.forEach(function(c){try{c.delete();}catch(e){}});
  if(shapes.length===1){faoHoleCache={shape:shapes[0],list:holes};}
  return holes;
}
function faoHoleIsHole(sh,g,clShared){
  // Trou = vide juste à l'intérieur du rayon, matière juste à l'extérieur, à mi-hauteur
  // (8 directions ; majorité — un perçage voisin ou une poche peut en manger une).
  // clShared (V0.21.19) : classificateur du solide partagé par tous les trous — sa
  // construction coûte cher sur une pièce aux filets modélisés (centaines de faces).
  let inOut=0,outIn=0;
  const zm=(g.zLo+g.zHi)/2,e=Math.min(0.3,g.r*0.25);
  try{
    const cl=clShared||new occt.BRepClass3d_SolidClassifier_2(sh);
    const st=function(x,y,z){const P=new occt.gp_Pnt_3(x,y,z);cl.Perform(P,1e-6);const r=cl.State();try{P.delete();}catch(e2){}return r;};
    const IN=occt.TopAbs_State.TopAbs_IN,OUT=occt.TopAbs_State.TopAbs_OUT;
    for(let k=0;k<8;k++){
      const a=k*Math.PI/4,c=Math.cos(a),s=Math.sin(a);
      if(st(g.x+(g.r+e)*c,g.y+(g.r+e)*s,zm)===IN)inOut++;
      if(st(g.x+(g.r-e)*c,g.y+(g.r-e)*s,zm)===OUT)outIn++;
    }
    if(!clShared){try{cl.delete();}catch(e2){}}
  }catch(e){return false;}
  return inOut>=5&&outIn>=5;
}
function faoHoleGroups(holes){
  // Groupes « même Ø + même départ (Z haut) » — l'unité de sélection.
  const m=new Map();
  (holes||[]).forEach(function(h){
    const k=h.d.toFixed(2)+'@'+h.ztop.toFixed(2);
    let g=m.get(k);if(!g){g={d:h.d,z:h.ztop,holes:[]};m.set(k,g);}
    g.holes.push(h);
  });
  return Array.from(m.values());
}
function faoHoleInSel(op,h){
  return (op.holeSel||[]).some(function(s){return Math.abs(s.d-h.d)<0.02&&Math.abs(s.z-h.ztop)<0.05;});
}
function faoSetupOfOp(op){
  try{const r=faoRoot();return ((r&&r.setups)||[]).find(function(s){return (s.ops||[]).indexOf(op)>=0;})||null;}catch(e){return null;}
}
function faoHoleThread(h,setup){
  // Filet d'un trou : fonction Perçage (reconnu) sinon choix STEP du posage.
  // V0.33.3 : lh = filet à gauche (fonction Perçage, ou choix « à gauche » du STEP)
  if(h.feat&&h.feat.thread)return Object.assign({size:h.feat.thread.size,p:+h.feat.thread.p,len:+h.feat.thread.len||0,src:'fonction'},h.feat.thread.lh?{lh:true}:{});
  const key=(+h.d).toFixed(2)+'@'+(+h.ztop).toFixed(2);
  const i=setup&&setup.holeInfo&&setup.holeInfo[key];
  if(i&&i.thread&&i.thread.size)return Object.assign({size:i.thread.size,p:+i.thread.p,len:0,src:'STEP'},i.thread.lh?{lh:true}:{});
  return null;
}
function faoHoleReamInfo(h,setup){
  // Alésage d'un trou : {tol, off} (off = surépaisseur sur le Ø voulue par la fonction, ou null).
  if(h.feat&&h.feat.role==='alesage')return {tol:h.feat.tol||'H7',off:h.feat.reamOff||null};
  if(h.feat)return null;
  const key=(+h.d).toFixed(2)+'@'+(+h.ztop).toFixed(2);
  const i=setup&&setup.holeInfo&&setup.holeInfo[key];
  return (i&&i.ream)?{tol:i.ream.tol||'H7',off:null}:null;
}
function faoReamPilot(h,all,ri){
  // Perçage pilote juste sous l'alésage (fonction « + perçage »), assez proche du Ø pour servir de pré-trou.
  const a=(ri&&ri.off>0)?+ri.off:faoReamAllow(h.d);
  return (all||[]).filter(function(q){return q!==h&&q.d<h.d-0.01&&h.d-q.d<=Math.max(1,2*a)+1e-6&&
    Math.hypot(q.x-h.x,q.y-h.y)<0.02&&Math.abs(q.ztop-h.zbot)<0.05;}).sort(function(x,y){return y.d-x.d;})[0]||null;
}
function faoHoleFilt(hf,o){
  // Trous d'un groupe gardés par une opération de la gamme (V0.99.9) ; sans filtre : tous.
  if(!hf)return true;
  const skip=!!(o.pre&&o.through); // petit trou débouchant d'un double perçage : fait par l'autre côté
  if(hf==='plain')return !o.ream&&!skip;
  if(hf==='ream')return !!o.ream;
  if(hf==='csk')return !!o.csk;
  if(hf==='spot')return !o.pre&&!(o.ream&&o.ream.pil);
  return true;
}
function faoWithOpFrame(op,fn){
  // Exécute fn avec les trous vus dans le repère PROPRE de l'opération (onglet Repère, 3+2) :
  // un perçage sur la tranche voit les trous de la tranche « verticaux ». Sans repère propre :
  // celui du posage. fn(Fr) — Fr = repère de l'opération, ou null.
  let Fr=null;try{const s=faoSetupOfOp(op);Fr=s?faoOpFrame(s,op):null;}catch(e){Fr=null;}
  const k=faoFrameCur;faoFrameCur=Fr||null;
  try{return fn(Fr);}finally{faoFrameCur=k;}
}
// V0.33.3 : clé d'un filet (taille, pas, sens) — un M8 et un M8-LH de même Ø et même départ
// sont dans le même groupe de sélection, mais jamais dans le même taraudage (op.thKey).
function faoThreadKey(th){ return th.size+'|'+(+th.p)+(th.lh?'|lh':''); }
// V0.99.13 : true = ancien tri, toujours par classification de la matière (test_fao_trous_vote ; ?sansvote)
let faoHoleVoteOff=(()=>{try{return /[?&]sansvote\b/.test(location.search);}catch(e){return false;}})();
const faoHoleMemo=new Map(); // clé (pièce + imports + repère) → trous reconnus
const faoHoleBrepNo=new WeakMap();let faoHoleBrepSeq=0; // numéro de chaque forme importée vue
function faoHoleMemoKey(Fr){
  // null : pas de mémoire (pièce sans empreinte, repli maillage). Le repère est celui que faoHoleShapes lit.
  try{
    if(!(typeof occLive!=='undefined'&&occLive&&occLive.shape&&occLive.sig))return null;
    let F=null;try{F=faoFrameCur||faoFrame(faoSetup());}catch(e){F=null;}
    const kF=!F?'-':F.id?'id':F.X.join(',')+'|'+F.Y.join(',')+'|'+F.Z.join(',')+'|'+(F.O||[]).join(',');
    let kI='';
    (typeof bodies!=='undefined'&&bodies?bodies:[]).forEach(function(b){
      if(!b||b.kind!=='import'||b.visible===false||b.ghost)return;
      const e=(typeof importGeom!=='undefined')?importGeom.get(b.ref||b.id):null;
      if(e&&e.brep){let n=faoHoleBrepNo.get(e.brep);if(!n){n=++faoHoleBrepSeq;faoHoleBrepNo.set(e.brep,n);}kI+=(b.ref||b.id)+'#'+n+';';} // forme elle-même : un corps dérivé change de forme sans changer de nom
    });
    return occLive.sig+(occLive.shapeFao?'sansfilets':'')+''+kI+''+kF;
  }catch(e){return null;}
}
function faoDrillResolve(op){
  // Re-résout les trous sélectionnés sur le modèle COURANT (suit les modifications).
  // Retourne true si op.holes a changé. Sans modèle exact : instantané conservé.
  if(!op||op.type!=='drill'||op.src!=='model')return false;
  // trous vus dans le repère de l'opération : ceux qu'on y a choisis s'y retrouvent
  // V0.89.3 : même pièce (empreinte du composé), mêmes imports, même repère → trous déjà reconnus : ni copie
  // tournée de la pièce ni relecture de ses faces (Perçages : 28 ms à chaque reconstruction sans changement).
  const all=faoWithOpFrame(op,function(Fr){
    const k=faoHoleMemoKey(Fr);
    if(k&&faoHoleMemo.has(k))return faoHoleMemo.get(k);
    const shapes=faoHoleShapes();const l=shapes.length?faoHolesDetect(shapes):null;
    if(k&&l){if(faoHoleMemo.size>=48)faoHoleMemo.clear();faoHoleMemo.set(k,l);}
    return l;});
  if(!all)return false;
  const setup=faoSetupOfOp(op);
  const nh=all.filter(function(h){return faoHoleInSel(op,h);}).map(function(h){
    const o={x:h.x,y:h.y,d:h.d,ztop:h.ztop,zbot:h.zbot,zSurf:h.zSurf,through:h.through,tipAng:h.tipAng,chD:h.chD};
    const th=faoHoleThread(h,setup);if(th)o.thread=th;
    if(h.feat&&h.feat.role==='lamage')o.cbore=true;
    // V0.99.9 : alésé (fonction Perçage, ou « Alésé » choisi pour un STEP) ; trou fraisé ;
    // petit trou d'un double perçage (avant-trou plus large au-dessus)
    const ri=faoHoleReamInfo(h,setup);
    if(ri){o.ream=ri;const pq=faoReamPilot(h,all,ri);if(pq)ri.pil=true;}
    if(h.feat&&h.feat.kind==='csink'&&h.feat.role==='trou'&&h.chD>0)o.csk=+h.feat.csA||90; // angle de la fraisure
    if(!h.feat){ // STEP : nature donnée dans la fenêtre de la gamme (faoDrillGammeDlg) ou la fiche
      const hi=setup&&setup.holeInfo&&setup.holeInfo[(+h.d).toFixed(2)+'@'+(+h.ztop).toFixed(2)];
      if(hi&&hi.cbore)o.cbore=true;
      if(hi&&hi.csk&&h.chD>0)o.csk=+h.chA||90;
    }
    if(h.pre)o.pre=true;
    return o;}).filter(function(o){ // taraudage de la gamme : seulement les trous de SON filet
    return !op.thKey||op.cycle!=='tap'||(o.thread&&faoThreadKey(o.thread)===op.thKey);})
    .filter(function(o){return faoHoleFilt(op.hf,o);}); // gamme : même groupe (Ø, départ), trous de natures différentes
  const a=JSON.stringify(op.holes||[]),b=JSON.stringify(nh);
  if(a===b)return false;
  op.holes=nh;return true;
}
function faoDrillReplay(){
  // Fin de reconstruction : chaque perçage « trous du modèle » suit la pièce.
  try{
    faoHoleCache={shape:null,list:null};
    const r=faoRoot();let ch=false;
    ((r&&r.setups)||[]).forEach(function(s){((s&&s.ops)||[]).forEach(function(op){if(faoDrillResolve(op))ch=true;});});
    if(ch){try{faoChanged();}catch(e){}}
  }catch(e){}
}
/* ----- profondeur, ordre, mouvements ----- */
function faoDrillDepthOf(op,t,h){
  // Z de la POINTE de l'outil au fond, pour un trou.
  const L=faoToolTipLen(t),brk=isFinite(+op.brk)?Math.max(0,+op.brk):1;
  const cyc=op.cycle||'drill';
  const mode0=op.depthMode||'full';
  if(cyc==='helix'){
    // fraisage : fond PLAT au fond du trou (lamage) ; débouchant : + débouchage
    if(mode0==='manual'&&isFinite(+op.zbot))return +op.zbot;
    return h.through?(h.zbot-brk):h.zbot;
  }
  if(cyc==='spot'){
    // Ø de pointage : saisi, sinon chanfrein du modèle, sinon Ø NOMINAL + 0,4 pour un
    // trou taraudé (entrée du taraud), sinon Ø du trou + 0,4.
    const T=(h.thread&&typeof isoThread==='function')?isoThread(h.thread.size):null;
    // V0.99.9 : le pointage d'une gamme ne fait pas la fraisure (opération « Fraisure » à part, après le perçage)
    const mch=(h.chD>0&&!(op.gRole==='pointage'&&h.csk))?h.chD:0;
    const chD=(+op.chD>0)?+op.chD:(mch>0?mch:(T?(T[1]+0.4):(h.d+0.4)));
    if(t&&t.kind==='center'){ // foret à centrer : pilote puis cône 60° (profil réel)
      // tp = [pointe, bout du cône 118°, haut du pilote, haut du cône 60°] : le chanfrein
      // se lit sur le cône 60° ; plus petit que le pilote → le pilote entier entre
      const tp=faoToolTipProfile(t),r1=tp[2][0],lp=tp[2][1],rr=Math.min(chD/2,tp[3][0]);
      return h.zSurf-(lp+Math.max(0,rr-r1)/Math.tan(Math.PI/6));
    }
    const Dt=(t&&+t.d>0)?+t.d:10;
    const r=Math.min(chD,Dt)/2;
    // fraise à chanfreiner : le cône part du méplat de bout (Ø dt), pas d'une pointe
    const rt=(t&&t.kind==='chamfer')?Math.max(0,Math.min(r,isFinite(+t.dt)&&+t.dt>=0?+t.dt/2:0.25)):0;
    return h.zSurf-(r-rt)/Math.tan(faoToolAngle(t)*Math.PI/360);
  }
  if(cyc==='ream'){
    // Alésoir : tout le Ø jusqu'au fond de l'alésage ; débouchant : chanfrein d'entrée sorti + débouchage
    if(mode0==='manual'&&isFinite(+op.zbot))return +op.zbot;
    return h.through?(h.zbot-brk-L):h.zbot;
  }
  if(cyc==='tap'){
    // Taraud : longueur filetée (fonction) ; STEP borgne : profondeur − 2 pas ; débouchant : traverse.
    const th=h.thread||{};const pz=+th.p||(t&&+t.p)||1;
    if(isFinite(+op.tapLen)&&+op.tapLen>0)return h.zSurf-(+op.tapLen);
    if(th.len>0)return h.zSurf-th.len;
    if(h.through)return h.zbot-Math.max(brk,pz);
    return Math.max(h.zbot+2*pz,h.zSurf-Math.max(pz,(h.zSurf-h.zbot)-2*pz));
  }
  const mode=op.depthMode||'full';
  if(mode==='manual'&&isFinite(+op.zbot))return +op.zbot;
  const bottom=h.through?(h.zbot-brk):h.zbot;
  return mode==='tip'?bottom:bottom-L;
}
function faoDrillOrder(pts,mode,start){
  // pts : [{x,y,…}] → ordre. 'auto' : plus proche voisin + 2-opt ; 'zigzag' : rangées en Y.
  const P=pts.slice();if(P.length<3||mode==='sel')return P;
  if(mode==='zigzag'){
    const ys=P.map(function(p){return p.y;}).sort(function(a,b){return a-b;});
    const tol=Math.max(1,(ys[ys.length-1]-ys[0])/50);
    P.sort(function(a,b){return Math.abs(a.y-b.y)>tol?a.y-b.y:a.x-b.x;});
    const rows=[];P.forEach(function(p){const r=rows[rows.length-1];if(r&&Math.abs(r[0].y-p.y)<=tol)r.push(p);else rows.push([p]);});
    return rows.reduce(function(o,r,i){return o.concat(i%2?r.reverse():r);},[]);
  }
  const s=start||{x:P[0].x,y:P[0].y};
  const out=[];let cx=s.x,cy=s.y;const left=P.slice();
  while(left.length){let bi=0,bd=Infinity;for(let i=0;i<left.length;i++){const d=Math.hypot(left[i].x-cx,left[i].y-cy);if(d<bd){bd=d;bi=i;}}
    const p=left.splice(bi,1)[0];out.push(p);cx=p.x;cy=p.y;}
  const D=function(a,b){return Math.hypot(a.x-b.x,a.y-b.y);};
  for(let pass=0;pass<4;pass++){let imp=false;
    for(let i=0;i<out.length-2;i++)for(let j=i+2;j<out.length;j++){
      const a=out[i],b=out[i+1],c=out[j],d2=out[j+1];
      const before=D(a,b)+(d2?D(c,d2):0),after=D(a,c)+(d2?D(b,d2):0);
      if(after<before-1e-9){out.splice(i+1,j-i,...out.slice(i+1,j+1).reverse());imp=true;}
    }
    if(!imp)break;}
  return out;
}
function faoDrillPlan(op,job){
  // Trous à percer dans l'ordre : [{x,y,rfp,zTip,d}] (Z pièce). Modèle ou saisie XY.
  const t=faoToolById(job,op.toolId);
  let list=[];
  if(op.src==='model'){
    list=(op.holes||[]).map(function(h){return {x:h.x,y:h.y,rfp:h.zSurf,zTip:faoDrillDepthOf(op,t,h),d:h.d};});
  }else{
    const D=(t&&+t.d>0)?+t.d:10;
    list=faoLimitDrillPts(op,D).map(function(p){return {x:+p[0],y:+p[1],rfp:+op.ztop,zTip:+op.zbot,d:D};});
  }
  // V0.23.20 : trou dont la pointe descendrait dans un corps FAO -> retiré
  list=faoWallDrillFilter(list,job,(t&&+t.d>0)?+t.d:10);
  // saisie XY historique : ordre saisi (programmes existants inchangés) sauf choix explicite
  return faoDrillOrder(list,op.order||(op.src==='model'?'auto':'sel'));
}
function faoGenDrillPlan(plan,secuAbs,op){
  // Taraudage : le taraud RESSORT à la MÊME avance qu'il est entré (F = pas × S),
  // seul le sens de rotation s'inverse — jamais en rapide (aperçu + estimation ;
  // le G-code, lui, laisse CYCLE84 / G84 rigide le faire).
  const tap=!!(op&&(op.cycle==='tap'||op.cycle==='ream')); // alésoir : ressort aussi en avance
  const moves=[];
  plan.forEach(function(p){
    const s=Math.max(+secuAbs||0,p.rfp+2);
    const zr=p.rfp+Math.min(2,Math.max(0.5,s-p.rfp));
    moves.push({r:1,x:p.x,y:p.y,z:s});
    moves.push({r:1,x:p.x,y:p.y,z:zr});
    moves.push({r:0,x:p.x,y:p.y,z:p.zTip});
    if(tap)moves.push({r:0,x:p.x,y:p.y,z:zr,tapOut:1});
    moves.push({r:1,x:p.x,y:p.y,z:s});
  });
  return moves;
}
/* ----- outil : affectation automatique ----- */
function faoDrillAutoTool(setup,op,d){
  // Foret du bon Ø dans la bibliothèque, sinon création ; foret à centrer pour un pointage.
  if(op.cycle==='helix')return faoHelixTool(setup,op,d);
  if(op.cycle==='spot'&&op.gRole==='fraisure')return faoCskTool(setup,op);
  if(op.cycle==='spot'){const r=faoSpotToolCfg(setup,op);if(r!==undefined)return r;}
  const want=(op.cycle==='spot')?'spot':(op.cycle==='tap'?'tap':(op.cycle==='ream'?'ream':'drill'));
  const cur=faoToolById(setup,op.toolId);
  const tools=setup.tools||(setup.tools=[]);
  if(want==='tap'){
    // taraud : taille et pas du filet du 1er trou fileté sélectionné
    const h0=(op.holes||[]).find(function(h){return h.thread;});
    if(!h0){return null;}
    const th=h0.thread,T=isoThread(th.size);
    // même filet ET même sens (taraud à droite / à gauche)
    const same=function(x){return x&&x.kind==='tap'&&x.size===th.size&&Math.abs(+x.p-th.p)<1e-6&&!!x.lh===!!th.lh;};
    if(same(cur))return null;
    let tt=tools.find(same);
    let mk=false;
    if(!tt){const n=tools.reduce(function(m,x){return Math.max(m,+x.num||0);},0)+1;
      tt={id:'T'+n+'_'+Date.now().toString(36),num:n,name:'Taraud '+holeThreadLabel(th),kind:'tap',d:T?T[1]:+d,size:th.size,p:th.p,cornerR:0,flutes:3,vc:12,fz:0.1};
      if(th.lh)tt.lh=true;
      tools.push(tt);mk=true;}
    op.toolId=tt.id;delete op.cut;return {tool:tt,made:mk};
  }
  // pointage : foret à pointer OU foret à centrer de la bibliothèque
  const fits=function(x){ return want==='spot'?(x.kind==='spot'||x.kind==='center'):(x.kind===want&&Math.abs(+x.d-d)<0.011); };
  if(cur&&fits(cur))return null;
  let t=tools.find(fits);
  let made=false;
  if(!t){
    const n=tools.reduce(function(m,x){return Math.max(m,+x.num||0);},0)+1;
    const h0=(op.holes||[]).find(function(h){return h.ream;});
    t=want==='ream'
      ?{id:'T'+n+'_'+Date.now().toString(36),num:n,name:'Alésoir D'+(+d.toFixed(3))+(h0?' '+h0.ream.tol:''),kind:'ream',d:+d.toFixed(3),cornerR:0,flutes:6,vc:30,fz:0.03,ang:90}
      :want==='spot'
      ?{id:'T'+n+'_'+Date.now().toString(36),num:n,name:'Foret à pointer D10',kind:'spot',d:10,cornerR:0,flutes:2,vc:60,fz:0.03,ang:90}
      :{id:'T'+n+'_'+Date.now().toString(36),num:n,name:'Foret D'+(+d.toFixed(2)),kind:'drill',d:+d.toFixed(3),cornerR:0,flutes:2,vc:80,fz:0.05,ang:118};
    tools.push(t);made=true;
  }
  op.toolId=t.id;delete op.cut;
  return {tool:t,made:made};
}
/* ----- V0.99.9 : réglages de la gamme automatique (posage) -----
   pointage : 'auto' (foret à pointer ou à centrer de la bibliothèque, sinon foret à pointer
   D10 créé), 'spot' (foret à pointer), 'center' (foret à centrer), 'none' (sans pointage),
   ou l'id d'un outil de la bibliothèque. finition des alésages : 'ream' (alésoir) ou 'mill'
   (fraise, interpolation hélicoïdale). Réglés AVANT la gamme : fiche du posage ou d'un Perçage. */
function faoDrillCfg(setup){
  const c=(setup&&setup.drillCfg)||{};
  return {spot:c.spot||'auto',ream:c.ream==='mill'?'mill':'ream',csk:c.csk==='chamfer'?'chamfer':'spot'};
}
function faoDrillCfgRows(setup){
  const c=faoDrillCfg(setup);
  const set=function(k,v){setup.drillCfg=Object.assign({},setup.drillCfg||{});setup.drillCfg[k]=v;};
  const opts=faoDrillSpotOpts(setup);
  const r1=faoRow();
  r1.appendChild(faoLab('Pointage'));
  r1.appendChild(faoSel(opts,opts.some(function(o){return o[0]===c.spot;})?c.spot:'auto',function(v){set('spot',v);},
    'Gamme automatique : outil de pointage (ou aucun) — pris pour tous les trous (lisses, taraudés, lamés, fraisés, alésés)'));
  r1.appendChild(faoLab('Finition alésage'));
  r1.appendChild(faoSel([['ream','Alésoir'],['mill','Fraise (hélicoïdal)']],c.ream,function(v){set('ream',v);},
    'Gamme automatique : un trou alésé est pré-percé puis fini à l’alésoir (cycle d’alésage) ou à la fraise (interpolation hélicoïdale)'));
  const r2=faoRow();
  r2.appendChild(faoLab('Fraisure'));
  r2.appendChild(faoSel([['spot','Foret à pointer'],['chamfer','Fraise à chanfreiner']],c.csk,function(v){set('csk',v);},
    'Gamme automatique : outil des fraisures (même angle que la fraisure, Ø ≥ Ø de fraisure + 1), passé après le perçage'));
  const w=document.createElement('div');w.appendChild(r1);w.appendChild(r2);
  return w;
}
function faoSpotToolCfg(setup,op){
  // Outil de pointage choisi dans les réglages de la gamme ; undefined = règle automatique.
  const c=faoDrillCfg(setup).spot;
  if(c==='auto'||c==='none')return undefined;
  const tools=setup.tools||(setup.tools=[]);
  const cur=faoToolById(setup,op.toolId);
  if(c!=='spot'&&c!=='center'){
    const t=tools.find(function(x){return x.id===c;});
    if(!t)return undefined; // outil retiré de la bibliothèque : règle automatique
    if(cur===t)return null;
    op.toolId=t.id;delete op.cut;return {tool:t,made:false};
  }
  if(cur&&cur.kind===c)return null;
  let t=tools.find(function(x){return x.kind===c;}),made=false;
  if(!t){
    const n=tools.reduce(function(m,x){return Math.max(m,+x.num||0);},0)+1;
    t=c==='spot'?{id:'T'+n+'_'+Date.now().toString(36),num:n,name:'Foret à pointer D10',kind:'spot',d:10,cornerR:0,flutes:2,vc:60,fz:0.03,ang:90}
      :{id:'T'+n+'_'+Date.now().toString(36),num:n,name:'Foret à centrer A2,5',kind:'center',d:2.5,cornerR:0,flutes:2,vc:25,fz:0.03,ang:118};
    tools.push(t);made=true;
  }
  op.toolId=t.id;delete op.cut;return {tool:t,made:made};
}
function faoCskTool(setup,op){
  // Fraisure : foret à pointer de l'ANGLE de la fraisure, de Ø ≥ Ø de fraisure + 1 (sinon elle serait tronquée).
  const hs=(op.holes||[]).filter(function(h){return h.csk;});
  const csD=hs.reduce(function(m,h){return Math.max(m,+h.chD||0);},0),ang=hs.length?+hs[0].csk:90;
  const tools=setup.tools||(setup.tools=[]);
  const kind=faoDrillCfg(setup).csk; // V0.99.9 : foret à pointer ou fraise à chanfreiner
  const ok=function(t){return t&&t.kind===kind&&Math.abs(faoToolAngle(t)-ang)<0.6&&+t.d>=csD+1-1e-6;};
  if(ok(faoToolById(setup,op.toolId)))return null;
  let t=tools.filter(ok).sort(function(a,b){return +a.d-(+b.d);})[0],made=false;
  if(!t){
    const D=[6,8,10,12,16,20,25,32,40].find(function(x){return x>=csD+1;})||Math.ceil(csD+2);
    const n=tools.reduce(function(m,x){return Math.max(m,+x.num||0);},0)+1;
    t=kind==='chamfer'
      ?{id:'T'+n+'_'+Date.now().toString(36),num:n,name:'Fraise à chanfreiner D'+D+' '+ang+'°',kind:'chamfer',d:D,dt:0.5,cornerR:0,flutes:3,vc:120,fz:0.03,ang:ang}
      :{id:'T'+n+'_'+Date.now().toString(36),num:n,name:'Foret à pointer D'+D+' '+ang+'°',kind:'spot',d:D,cornerR:0,flutes:2,vc:60,fz:0.03,ang:ang};
    tools.push(t);made=true;
  }
  op.toolId=t.id;delete op.cut;return {tool:t,made:made};
}
/* ----- sélection dans la vue ----- */
let faoHolePick=null; // {setupId,opId}
function faoHolePickStart(setupId,opId){
  faoHolePick={setupId:setupId,opId:opId};
  faoHoleMarks();
  try{renderer.domElement.style.cursor='crosshair';}catch(e){}
  try{faceEl.textContent='Perçage : cliquez un trou dans la vue — tous les trous de même Ø et même départ sont pris (re-clic = retirer). Échap pour finir.';}catch(e){}
}
function faoHolePickExit(){
  faoHolePick=null;
  try{const o=faoGet3D('faoHoleMarks');if(o)faoDel3D(o);}catch(e){}
  try{renderer.domElement.style.cursor='default';}catch(e){}
  try{faoRefreshFaoUI();}catch(e){}
}
function faoHolePickAt(e){
  // Clic : trou dont l'axe passe au plus près du point d'impact (≤ Ø/2 + 0,5 mm).
  if(!faoHolePick)return false;
  const setup=faoSetup(faoHolePick.setupId),op=(setup.ops||[]).find(function(o){return o.id===faoHolePick.opId;});
  if(!op){faoHolePickExit();return false;}
  const h0=pick(e);if(!h0)return false;
  const Fr=faoOpFrameOf(setup.id,op.id),hq=Fr.id?[h0.point.x,h0.point.y,h0.point.z]:faoToF(Fr,[h0.point.x,h0.point.y,h0.point.z]);
  const h={point:{x:hq[0],y:hq[1],z:hq[2]}}; // point cliqué en repère de l'opération (sinon du posage)
  const kF=faoFrameCur;faoFrameCur=Fr.id?null:Fr;let holes=[];
  try{holes=faoHolesDetect();}finally{faoFrameCur=kF;}
  let best=null,bd=Infinity;
  holes.forEach(function(H){
    if(h.point.z>H.zSurf+0.5||h.point.z<H.zbot-0.5)return;
    const d=Math.hypot(h.point.x-H.x,h.point.y-H.y);
    if(d<=Math.max(H.d,H.chD||0)/2+0.5&&d<bd){bd=d;best=H;} // V0.99.9 : clic sur le cône d’une fraisure ou d’un chanfrein compris
  });
  if(!best){try{faceEl.textContent='Perçage : ce n’est pas un trou vertical reconnu.';}catch(e){}return true;}
  faoHoleToggle(setup,op,best.d,best.ztop);
  faoHoleMarks();
  return true;
}
function faoDrillInherit(from,to){
  // Opération de perçage née d'une autre (nouveau Ø, gamme) : même repère 3+2 et mêmes
  // hauteurs — les trous choisis l'ont été dans CE repère.
  if(from&&from.frame)to.frame=JSON.parse(JSON.stringify(from.frame));
  ['z','ztop','zbot'].forEach(function(k){if(from&&from[k]!==undefined)to[k]=from[k];});
  return to;
}
function faoHoleToggle(setup,op,d,z){
  faoSnapshot('sélection de trous');
  // UN diamètre par opération de perçage (un foret) : ajouter un autre Ø crée une
  // NOUVELLE opération avec son foret — sinon les trous déjà pris seraient percés au
  // nouveau Ø. Le pointage (foret à centrer) accepte tous les Ø.
  const cyc=op.cycle||'drill';
  const other=(op.holeSel||[]).some(function(s){return Math.abs(s.d-d)>=0.02;});
  const already=(op.holeSel||[]).some(function(s){return Math.abs(s.d-d)<0.02&&Math.abs(s.z-z)<0.05;});
  if(cyc!=='spot'&&other&&!already){
    const no=faoOpDefaults('drill');
    ['cycle','depthMode','brk','order','peck','dwell'].forEach(function(k){if(op[k]!==undefined)no[k]=op[k];});
    faoDrillInherit(op,no);
    no.holeSel=[{d:+(+d).toFixed(3),z:+(+z).toFixed(3)}];
    const idx=(setup.ops||[]).indexOf(op);
    setup.ops.splice(idx<0?setup.ops.length:idx+1,0,no);
    faoDrillResolve(no);
    const r=faoDrillAutoTool(setup,no,d);
    faoChanged();
    try{faceEl.textContent='Perçage : Ø'+(+(+d).toFixed(2))+' ≠ Ø de cette opération → nouvelle opération Perçage ('+(no.holes||[]).length+' trou(s), T'+faoToolById(setup,no.toolId).num+' '+faoToolById(setup,no.toolId).name+(r&&r.made?' créé':'')+').';}catch(e){}
    return no;
  }
  op.src='model';
  op.holeSel=op.holeSel||[];
  const i=op.holeSel.findIndex(function(s){return Math.abs(s.d-d)<0.02&&Math.abs(s.z-z)<0.05;});
  if(i>=0)op.holeSel.splice(i,1);else op.holeSel.push({d:+(+d).toFixed(3),z:+(+z).toFixed(3)});
  faoDrillResolve(op);
  let msg='Perçage : '+(op.holes||[]).length+' trou(s) sélectionné(s).';
  if(i<0){const r=faoDrillAutoTool(setup,op,d);if(r)msg+=r.made?(' Outil créé : T'+r.tool.num+' '+r.tool.name+' (bibliothèque).'):(' Outil : T'+r.tool.num+' '+r.tool.name+'.');}
  faoChanged();
  try{faceEl.textContent=msg;}catch(e){}
  return op;
}
function faoHoleMarks(){
  // Anneaux sur les trous reconnus : gris = disponibles, orange = sélectionnés.
  try{
    const old=faoGet3D('faoHoleMarks');if(old)faoDel3D(old);
    if(!faoHolePick)return;
    const setup=faoSetup(faoHolePick.setupId),op=(setup.ops||[]).find(function(o){return o.id===faoHolePick.opId;});
    const grp=new THREE.Group();grp.name='faoHoleMarks';
    const segOf=function(H,r){const a=[];const N=40;for(let k=0;k<N;k++){const t0=k/N*Math.PI*2,t1=(k+1)/N*Math.PI*2;
      a.push(H.x+r*Math.cos(t0),H.y+r*Math.sin(t0),H.zSurf+0.05,H.x+r*Math.cos(t1),H.y+r*Math.sin(t1),H.zSurf+0.05);}return a;};
    const on=[],off=[];
    // trous du repère de l'opération ; anneaux ramenés dans le repère du posage pour le dessin
    faoWithOpFrame(op,function(Fr){
      faoHolesDetect().forEach(function(H){
        let s=segOf(H,H.d/2+0.6);
        if(Fr){const o=[];for(let i=0;i<s.length;i+=3){const w=faoPtOpToPos(Fr,[s[i],s[i+1],s[i+2]]);o.push(w[0],w[1],w[2]);}s=o;}
        (op&&faoHoleInSel(op,H)?on:off).push.apply(op&&faoHoleInSel(op,H)?on:off,s);});
    });
    if(off.length)grp.add(faoThickSegs(off,0x8e8e93,1,2));
    if(on.length)grp.add(faoThickSegs(on,0xff9f0a,1,3));
    faoAdd3D(grp);
  }catch(e){}
}
/* ----- fiche : sections Trous + Cycle ----- */
function faoDrillSections(setup,op,d){
  const t=faoToolById(setup,op.toolId);
  // ── cycle (Réglages)
  const rc=faoRow();
  rc.appendChild(faoLab('Cycle'));
  rc.appendChild(faoSel([['spot','Pointage (centrage)'],['drill','Perçage simple'],['peck','Débourrage (dégagement total)'],['chip','Brise-copeaux'],['tap','Taraudage'],['ream','Alésage (alésoir)'],['helix','Fraisage hélicoïdal (lamage, alésage)']],op.cycle||'drill',
    function(v){op.cycle=v; if(op.src==='model'&&(op.holes||[]).length){faoDrillAutoTool(setup,op,op.holes[0].d);} },
    'Pointage : G81/CYCLE81 à faible profondeur · Simple : G81 (G82 si temporisation) · Débourrage : G83/CYCLE83 remontée complète · Brise-copeaux : petit recul à chaque passe · Alésage : G85/CYCLE85, entrée et sortie en avance'));
  if(op.cycle==='peck'||op.cycle==='chip'){
    rc.appendChild(faoLab('Q'));
    rc.appendChild(faoNumFx(op,'peck',(+op.peck)||Math.max(1,+(((+t.d)||6)*1).toFixed(1)),function(v){op.peck=Math.max(0.1,v);},48,0.5,'Profondeur de chaque passe (mm)'));
  }
  rc.appendChild(faoLab('Tempo'));
  rc.appendChild(faoNumFx(op,'dwell',(+op.dwell)||0,function(v){op.dwell=Math.max(0,v);},44,0.1,'Temporisation au fond (s) — 0 = aucune'));
  d.appendChild(rc);
  const rd=faoRow();
  if(op.cycle==='helix'){
    const tH=faoToolById(setup,op.toolId),dT=(+tH.d>0)?+tH.d:6;
    rd.appendChild(faoLab('Pas d’hélice'));
    rd.appendChild(faoNumFx(op,'helixP',(+op.helixP)||0,function(v){op.helixP=Math.max(0,v);},48,0.1,'Descente par tour (mm) — 0 = automatique (rampe ≈ 2,5°, ≤ 25 % du Ø fraise)'));
    const h0=(op.holes||[])[0];
    const nt=document.createElement('span');nt.className='fao-meta';
    if(h0){const Rr=(h0.d-dT)/2;nt.textContent=Rr>0.02?('fraise Ø'+dT+' dans Ø'+(+h0.d.toFixed(2))+' · rayon de trajectoire '+Rr.toFixed(2)+(Rr>dT/2*0.9?' · plusieurs anneaux':'')+' · pas '+faoHelixPitch(op,Rr,dT).toFixed(2)):('⚠ fraise Ø'+dT+' trop grosse pour Ø'+(+h0.d.toFixed(2)));}
    rd.appendChild(nt);
  }else if(op.cycle==='tap'){
    rd.appendChild(faoLab('Longueur filetée'));
    rd.appendChild(faoNumFx(op,'tapLen',(+op.tapLen)||0,function(v){op.tapLen=Math.max(0,v);},52,0.5,'Longueur taraudée depuis le dessus (mm) — 0 = longueur de la fonction Perçage, sinon profondeur du trou − 2 pas'));
    const th0=(op.holes||[]).find(function(h){return h.thread;});
    const tt=faoToolById(setup,op.toolId);
    const nt=document.createElement('span');nt.className='fao-meta';
    nt.textContent=th0?('filet '+holeThreadLabel(th0.thread)+' · F = pas × S'):'⚠ aucun trou fileté sélectionné (fonction Perçage taraudée, ou « Taraudé M… » choisi dans la liste)';
    rd.appendChild(nt);
    if(th0&&tt.kind==='tap'&&(tt.size!==th0.thread.size||Math.abs(+tt.p-th0.thread.p)>1e-6||!!tt.lh!==!!th0.thread.lh)){
      const w=document.createElement('div');w.className='fao-note';w.textContent='⚠ Le taraud T'+tt.num+' ('+holeThreadLabel({size:tt.size,p:tt.p,lh:tt.lh})+') ne correspond pas au filet '+holeThreadLabel(th0.thread)+'.';d.appendChild(w);}
  }else if(op.cycle==='ream'){
    const h0=(op.holes||[]).find(function(h){return h.ream;})||(op.holes||[])[0],tR=faoToolById(setup,op.toolId);
    const nt=document.createElement('span');nt.className='fao-meta';
    nt.textContent=h0?('alésage Ø'+(+h0.d.toFixed(3))+(h0.ream?' '+h0.ream.tol:'')+' · entrée et sortie en avance (G85 / CYCLE85)'+(tR&&tR.kind==='ream'&&Math.abs(+tR.d-h0.d)>0.011?' · ⚠ alésoir Ø'+tR.d:'')):'aucun trou';
    rd.appendChild(nt);
  }else if(op.cycle==='spot'){
    rd.appendChild(faoLab('Ø pointage'));
    rd.appendChild(faoNumFx(op,'chD',(+op.chD)||0,function(v){op.chD=Math.max(0,v);},52,0.1,'Ø du chanfrein laissé par le foret à pointer / à centrer (0 = chanfrein du modèle, sinon Ø du trou + 0,4)'));
  }else{
    rd.appendChild(faoLab('Profondeur'));
    rd.appendChild(faoSel([['full','Plein Ø au fond du trou'],['tip','Pointe au fond'],['manual','Cote manuelle']],op.depthMode||'full',function(v){op.depthMode=v;},
      'Plein Ø : la pointe descend en plus de sa longueur (angle du foret) · Pointe au fond : la pointe s’arrête au fond · Cote manuelle : Z de pointe saisi'));
    if((op.depthMode||'full')==='manual'){rd.appendChild(faoLab('Z')); rd.appendChild(faoNum(faoDsp(op,op.zbot,2),function(v){op.zbot=faoInp(op,v,2);},52,null,'Z de la pointe (mm)'));}
    rd.appendChild(faoLab('Débouchage'));
    rd.appendChild(faoNumFx(op,'brk',isFinite(+op.brk)?+op.brk:1,function(v){op.brk=Math.max(0,v);},44,0.5,'Trous débouchants : dépassement sous la pièce (mm)'));
  }
  rd.appendChild(faoLab('Ordre'));
  rd.appendChild(faoSel([['auto','Plus court'],['zigzag','Zigzag']],op.order||'auto',function(v){op.order=v;},'Ordre de passage des trous'));
  d.appendChild(rd);
  if(!faoToolIsDrill(t)&&!(op.cycle==='tap'&&t.kind==='tap')&&!(op.cycle==='helix'&&(t.kind==='flat'||t.kind==='bull'))&&!(op.cycle==='spot'&&t.kind==='chamfer')){
    const w=document.createElement('div');w.className='fao-note';
    w.textContent='⚠ L’outil T'+t.num+' n’est pas un foret ('+faoKindLabel(t.kind)+') — choisissez des trous : le foret du bon Ø est pris ou créé.';
    d.appendChild(w);
  }
  // ── trous (Zone)
  d.appendChild(faoH('Trous'));
  const rs=faoRow();
  rs.appendChild(faoLab('Source'));
  rs.appendChild(faoSel([['model','Trous du modèle'],['xy','Coordonnées XY']],op.src||'xy',function(v){op.src=v;faoDrillResolve(op);},'Trous reconnus sur la pièce, ou points saisis'));
  if(op.src==='model'&&(op.holeSel||[]).length)rs.appendChild(faoMini('⚙ Gamme',function(){faoDrillGammeAsk(setup,op,true);},
    'Crée la gamme des trous sélectionnés : pointage → perçage (un Ø par opération, débourrage si profond) → taraudage des trous filetés'));
  if(op.src==='model')d.appendChild(faoDrillCfgRows(setup)); // V0.99.9 : réglages de la gamme automatique
  if(op.src==='model')rs.appendChild(faoMini(faoHolePick?'✔ Fin':'Choisir dans la vue',function(){
    if(faoHolePick)faoHolePickExit();else faoHolePickStart(setup.id,op.id);},'Cliquer un trou de la pièce : tous les trous de même Ø et même départ'));
  d.appendChild(rs);
  if(op.src==='model'){
    const holes=faoWithOpFrame(op,function(){return faoHolesDetect();}); // repère de l'opération (3+2)
    if(!holes.length){const n=document.createElement('div');n.className='fao-empty';n.textContent='Aucun trou vertical reconnu sur le modèle (noyau exact requis).';d.appendChild(n);}
    faoHoleGroups(holes).forEach(function(g){
      const r=faoRow();
      const cb=document.createElement('input');cb.type='checkbox';cb.checked=faoHoleInSel(op,{d:g.d,ztop:g.z});
      cb.onchange=function(){faoHoleToggle(setup,op,g.d,g.z);};
      r.appendChild(cb);
      const h0=g.holes[0];
      const s=document.createElement('span');s.className='fao-meta';
      s.textContent='Ø'+(+g.d.toFixed(2))+' × '+g.holes.length+' · Z '+(+g.z.toFixed(2))+' → '+(+h0.zbot.toFixed(2))+' · '+(h0.through?'débouchant':'borgne')+
        (h0.tipAng?(' · pointe '+h0.tipAng+'°'):'')+(h0.chD?(' · chanfrein Ø'+(+h0.chD.toFixed(2))):'')+(h0.cb?(' · lamage Ø'+h0.cb.d):'')+(h0.pre?(' · sous avant-trou Ø'+h0.pre.d):'');
      r.appendChild(s);
      // nature : reconnue (fonction Perçage) ou choisie (STEP) — trou lisse / taraudé
      const fe=g.holes.find(function(h){return h.feat;});
      if(fe&&fe.feat.thread){
        const t=document.createElement('span');t.className='fao-meta';t.style.color='#ff9f0a';
        t.textContent='taraudé '+holeThreadLabel(fe.feat.thread)+' (fonction Perçage)';r.appendChild(t);
      }else if(fe&&fe.feat.role==='lamage'){
        const t=document.createElement('span');t.className='fao-meta';t.textContent='lamage (fonction Perçage)';r.appendChild(t);
      }else if(fe&&fe.feat.role==='avant-trou'){
        const t=document.createElement('span');t.className='fao-meta';t.textContent='avant-trou d’un double perçage (fonction Perçage)';r.appendChild(t);
      }else if(fe&&fe.feat.role==='alesage'){
        const t=document.createElement('span');t.className='fao-meta';t.style.color='#ff9f0a';t.textContent='alésé '+fe.feat.tol+' (fonction Perçage)';r.appendChild(t);
      }else if(!fe){
        const key=g.d.toFixed(2)+'@'+g.z.toFixed(2);
        const info=(setup.holeInfo&&setup.holeInfo[key])||{};
        const opts=faoStepHoleOpts(g,holes); // V0.99.9 : + alésé, lamage, fraisure
        r.appendChild(faoSel(opts,faoStepHoleVal(info),function(v){
          faoStepInfoSet(setup,key,v,!!(info.thread&&info.thread.lh));
        },'Pièce importée (STEP) : la nature du trou n’est pas dans la géométrie — indiquez s’il est taraudé (Ø mesuré compatible avec le taraud) ou alésé.'));
        // V0.33.3 : sens du filet (le STEP ne le dit pas non plus)
        if(info.thread)r.appendChild(faoSel([['rh','À droite'],['lh','À gauche (LH)']],info.thread.lh?'lh':'rh',function(v){
          if(v==='lh')info.thread.lh=true;else delete info.thread.lh;
        },'Sens du filet : à gauche (LH) → taraud à gauche, broche inversée pendant le taraudage.'));
      }
      d.appendChild(r);
    });
  }else{
    const pts=(op.pts||[]).map(function(q){return (+q[0])+','+(+q[1]);}).join('; ');
    const rp=faoRow();
    rp.appendChild(faoLab('XY'));
    rp.appendChild(faoTxt(pts,function(v){
      const lst=String(v).split(';').map(function(s){const q=s.split(',').map(function(x){return parseFloat(x);});
        return (q.length>=2&&isFinite(q[0])&&isFinite(q[1]))?[q[0],q[1]]:null;}).filter(function(q){return q;});
      op.pts=lst;},150,'Points X,Y séparés par « ; »'));
    rp.appendChild(faoLab('Haut'));rp.appendChild(faoNum(faoDsp(op,op.ztop,2),function(v){op.ztop=faoInp(op,v,2);},52));
    rp.appendChild(faoLab('Bas'));rp.appendChild(faoNum(faoDsp(op,op.zbot,2),function(v){op.zbot=faoInp(op,v,2);},52));
    d.appendChild(rp);
  }
}

/* ----- Perçage créé sur une sélection : trous retrouvés + gamme posée — V0.33.2 -----
   Faces de trous cliquées dans la vue (selFaces, Ctrl+clic pour plusieurs) ou fonction
   Perçage sélectionnée : chaque face désigne le trou reconnu dont l'axe passe au plus
   près (comme « Choisir dans la vue ») ; un trou issu d'une fonction Perçage entraîne
   TOUS les trous de cette fonction (lamage, avant-trou d'un double perçage…). Les
   groupes trouvés deviennent la sélection de l'opération, puis faoDrillGamme. V0.33.3 :
   trou d'axe autre que le Z du posage → repère 3+2 de l'opération (faoDrillSelAxis). */
function faoDrillSelAxis(setup,op){
  // 3+2 : trou d'axe autre que le Z du posage → repère propre de l'opération, Z = axe du
  // trou SORTANT par son entrée (l'utilisateur règle X ensuite). Sens : celui où le trou
  // cliqué est vu borgne (fond dans la matière, ou lamage posé dessus) ; débouchant des
  // deux côtés : sens de la fonction Perçage, sinon celui le plus proche du Z du posage.
  const P=faoFrame(setup);
  let a=null,pt=null,ac=null,fz=null;
  const f0=(typeof selFaces!=='undefined'&&selFaces||[]).find(function(f){return f&&f.point&&f.geom&&f.geom.kind==='cyl'&&f.geom.axis;});
  if(f0){a=[f0.geom.axis.x,f0.geom.axis.y,f0.geom.axis.z];pt=[f0.point.x,f0.point.y,f0.point.z];
    const c=f0.geom.center;ac=c?[c.x,c.y,c.z]:pt; // point de l'axe
    // V0.99.10 : trou d'un perçage normal : sens connu (de la face vers le trou visé), Z sortant par l'entrée
    if(f0.drillDir)fz=[-f0.drillDir.x,-f0.drillDir.y,-f0.drillDir.z];}
  try{
    // sens de perçage de la fonction : sur l'axe cliqué, ou fonction sélectionnée dans l'arbre
    (doc.features||[]).forEach(function(f){
      if(fz||!f||f.type!=='hole'||f.visible===false)return;
      const sk=doc.sketches.find(function(q){return q.id===f.sketchId;});if(!sk)return;
      const A=holeAxis(f,sk),d=[A.dir.x,A.dir.y,A.dir.z];
      if(!a){if(sel&&sel.kind==='feature'&&sel.id===f.id&&A.pts.length){fz=d.map(function(q){return -q;});}return;}
      if(Math.abs(d[0]*a[0]+d[1]*a[1]+d[2]*a[2])<0.9999)return;
      if(A.pts.some(function(p){const w=[p.x-ac[0],p.y-ac[1],p.z-ac[2]],t=w[0]*a[0]+w[1]*a[1]+w[2]*a[2];
        return Math.hypot(w[0]-t*a[0],w[1]-t*a[1],w[2]-t*a[2])<0.05;}))fz=d.map(function(q){return -q;});
    });
  }catch(e){}
  if(!a&&fz)a=fz;
  if(!a)return false;
  const rel=function(w){const r=P.id?w.slice():faoRotF(P,w);return r.map(function(q){return Math.abs(q)<1e-9?0:Math.round(q*1e9)/1e9;});};
  const setZ=function(w){
    const r=rel(w);
    faoOpFrameEdit(setup,op,function(){
      if(r[2]>0.9999){delete op.frame;return;} // axe du posage : rien à changer
      let v=r;for(const k in FAO_AX){const q=FAO_AX[k];if(Math.abs(q[0]-r[0])<1e-7&&Math.abs(q[1]-r[1])<1e-7&&Math.abs(q[2]-r[2])<1e-7){v=k;break;}}
      op.frame=Object.assign({},op.frame||{},{z:v,flipZ:false});delete op.frame.o;faoFrameFixX(op);
      // V0.99.10 (demande de Fred) : trou incliné → X du côté où penche l'outil, vers la poche / la
      // matière (projection horizontale de Z) : le plateau pivote toujours dans le même sens
      const L=Math.hypot(r[0],r[1]);
      if(L>1e-3&&L<0.9999){op.frame.x=[r[0]/L,r[1]/L,0].map(function(q){return Math.abs(q)<1e-9?0:Math.round(q*1e9)/1e9;});op.frame.flipX=false;}
    });
  };
  // trous du même axe vus avec Z = w : l'un d'eux est-il borgne ?
  const blind=function(w){
    setZ(w);
    if(!pt)return null;
    const Fr=faoOpFrameOf(setup.id,op.id),q=Fr.id?pt:faoToF(Fr,pt);
    const kF=faoFrameCur;faoFrameCur=Fr.id?null:Fr;let hs=[];
    try{hs=faoHolesDetect();}finally{faoFrameCur=kF;}
    hs=hs.filter(function(H){return Math.hypot(q[0]-H.x,q[1]-H.y)<0.05;});
    return hs.length?hs.some(function(H){return !H.through;}):null;
  };
  const n=a.map(function(q){return -q;});
  if(fz){setZ(fz);return true;}
  const bp=blind(a),bn=blind(n);
  let w;
  if(bp&&!bn)w=a;else if(bn&&!bp)w=n;
  else w=(rel(a)[2]>=rel(n)[2])?a:n;
  setZ(w);
  return true;
}
function faoDrillSelHoles(setup,op){
  try{faoDrillSelAxis(setup,op);}catch(e){}
  const Fr=faoOpFrameOf(setup.id,op.id);
  const kF=faoFrameCur;faoFrameCur=Fr.id?null:Fr;let holes=[];
  try{holes=faoHolesDetect();}finally{faoFrameCur=kF;}
  if(!holes.length)return [];
  const hit=[],feats={};
  (typeof selFaces!=='undefined'&&selFaces||[]).forEach(function(f){
    if(!f||!f.point)return;
    const w=[f.point.x,f.point.y,f.point.z],q=Fr.id?w:faoToF(Fr,w);
    let best=null,bd=Infinity;
    holes.forEach(function(H){
      if(q[2]>H.zSurf+0.5||q[2]<H.zbot-0.5)return;
      const d=Math.hypot(q[0]-H.x,q[1]-H.y);
      if(d<=Math.max(H.d,H.chD||0)/2+0.5&&d<bd){bd=d;best=H;} // V0.99.9 : clic sur le cône d’une fraisure ou d’un chanfrein compris
    });
    if(best){hit.push(best);if(best.feat)feats[best.feat.id]=1;}
  });
  try{ if(sel&&sel.kind==='feature'){const f=(doc.features||[]).find(function(x){return x.id===sel.id;});if(f&&f.type==='hole')feats[f.id]=1;} }catch(e){}
  holes.forEach(function(H){if(H.feat&&feats[H.feat.id]&&hit.indexOf(H)<0)hit.push(H);});
  const out=[];
  hit.forEach(function(H){if(!out.some(function(s){return Math.abs(s.d-H.d)<0.02&&Math.abs(s.z-H.ztop)<0.05;}))
    out.push({d:+(+H.d).toFixed(3),z:+(+H.ztop).toFixed(3)});});
  return out;
}
/* ----- V0.99.9 : trous d'un STEP — nature demandée avant la gamme -----
   La géométrie d'un STEP ne dit ni filet ni tolérance : une fenêtre liste les groupes de trous
   sans fonction Perçage, propose Trou / Taraudé M… / Alésé H7 / Lamage / Fraisure (selon ce que
   la forme permet) et range le choix dans setup.holeInfo, comme la liste de la fiche. */
function faoStepHoleOpts(g,all){
  const opts=[['','Trou lisse']];
  if(typeof ALL_THREADS!=='undefined')ALL_THREADS.forEach(function(t){for(let k=2;k<t.length;k++){const td=tapDrill(t[0],t[k]);if(Math.abs(td-g.d)<=0.3)opts.push([t[0]+'|'+t[k],'Taraudé '+holeThreadLabel({size:t[0],p:t[k]})]);}}); // V0.20.3 : + UNC/UNF, gaz
  ['H7','H6','H8'].forEach(function(t){opts.push(['ream|'+t,'Alésé '+t]);});
  const h0=g.holes[0];
  if(faoStepIsUpper(h0,all))opts.push(['cbore','Lamage (fraisé)']);
  if(h0.chD>0)opts.push(['csk','Fraisure Ø'+(+h0.chD.toFixed(2))+(h0.chA?(' '+h0.chA+'°'):'')]);
  return opts;
}
function faoStepHoleVal(info){
  info=info||{};
  if(info.ream)return 'ream|'+(info.ream.tol||'H7');
  if(info.cbore)return 'cbore';
  if(info.csk)return 'csk';
  return info.thread?(info.thread.size+'|'+info.thread.p):'';
}
function faoStepIsUpper(h,all){
  // Étage supérieur d'un trou étagé : un trou plus petit du même axe commence à son fond.
  return (all||[]).some(function(q){return q!==h&&q.d<h.d-0.01&&Math.hypot(q.x-h.x,q.y-h.y)<0.02&&Math.abs(q.ztop-h.zbot)<0.05;});
}
function faoStepUnknown(setup,op){
  // Groupes sélectionnés sans fonction Perçage (pièce importée) : ceux à faire préciser.
  const all=faoWithOpFrame(op,function(){return faoHolesDetect();});
  // V0.99.10 : trous d'un perçage normal (fonction de la pièce, sans esquisse) : pas à demander
  const hnXY=[];
  try{
    if(typeof hnIs==='function'&&typeof hnRun!=='undefined'){
      let F=null;try{const s=faoSetupOfOp(op);F=(s&&faoOpFrame(s,op))||faoFrame(s||faoSetup());}catch(e){F=null;}
      (doc.features||[]).forEach(function(f){
        if(!f||!hnIs(f)||f.visible===false)return;
        const R=hnRun.get(f.id);
        ((R&&R.all)||[]).forEach(function(it){
          if(!it.on)return;
          const p=(F&&!F.id)?faoToF(F,it.P):it.P,c=(F&&!F.id)?faoToF(F,it.C):it.C;
          if(Math.hypot(p[0]-c[0],p[1]-c[1])<0.05)hnXY.push(p); // axe du trou = Z de ce repère
        });
      });
    }
  }catch(e){}
  const isHn=function(h){return hnXY.some(function(p){return Math.hypot(p[0]-h.x,p[1]-h.y)<0.1;});};
  return faoHoleGroups(all).filter(function(g){
    return faoHoleInSel(op,{d:g.d,ztop:g.z})&&!g.holes.some(function(h){return h.feat||isHn(h);})&&!g.holes.every(function(h){return h.pre&&h.through;});
  }).map(function(g){return {g:g,all:all};});
}
function faoStepInfoSet(setup,key,v,lh){
  setup.holeInfo=setup.holeInfo||{};
  if(!v)delete setup.holeInfo[key];
  else if(v.indexOf('ream|')===0)setup.holeInfo[key]={ream:{tol:v.slice(5)}};
  else if(v==='cbore'||v==='csk'){const o={};o[v]=true;setup.holeInfo[key]=o;}
  else{const p=v.split('|');setup.holeInfo[key]={thread:Object.assign({size:p[0],p:+p[1]},lh?{lh:true}:{})};}
}
function faoDrillSpotOpts(setup){
  const opts=[['auto','Automatique (bibliothèque)'],['spot','Foret à pointer'],['center','Foret à centrer'],['none','Sans pointage']];
  (setup.tools||[]).forEach(function(t){if(t.kind==='spot'||t.kind==='center'||t.kind==='drill')opts.push([t.id,'T'+t.num+' '+t.name]);});
  return opts;
}
/* V0.99.9 : fenêtre « Gamme de perçage » — ouverte à la création de la gamme (Perçage sur des
   trous sélectionnés, bouton ⚙ Gamme) : outil de pointage, finition des alésages et outil des
   fraisures (seulement s'il y en a dans la sélection), nature des trous de STEP. Les choix
   restent ceux du posage pour la gamme suivante (setup.drillCfg). Entrée = créer, Échap = annuler. */
function faoDrillGammeDlg(setup,op,list,flags,done){
  const mk=function(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
  const bg=mk('div','mffDlgBg'),d=mk('div','mffDlg fao-imp');
  d.appendChild(mk('div','fao-imp-t','Gamme de perçage'));
  d.appendChild(mk('div','fao-imp-s',(flags.n||0)+' trou(s) sélectionné(s)'+(flags.nFr?(', '+flags.nFr+' orientations du plateau (3+2)'):'')+'. Choisissez les outils, la gamme est créée ensuite (pointage, perçage, fraisure, lamage, alésage, taraudage).'));
  const c=faoDrillCfg(setup);
  const cfgL=mk('div','fao-imp-list');d.appendChild(cfgL);
  const pick=function(label,opts,val,tip){
    const row=mk('label','fao-imp-it'),tx=mk('div','fao-imp-x');
    tx.appendChild(mk('div','fao-imp-n',label));if(tip)tx.appendChild(mk('div','fao-imp-d',tip));
    row.appendChild(tx);
    const sl=mk('select','fao-sel');opts.forEach(function(o){const e=mk('option','',o[1]);e.value=o[0];sl.appendChild(e);});
    sl.value=opts.some(function(o){return o[0]===val;})?val:opts[0][0];
    row.appendChild(sl);cfgL.appendChild(row);return sl;
  };
  const sSpot=pick('Pointage',faoDrillSpotOpts(setup),c.spot,'Outil de pointage de tous les trous (ou aucun)');
  const sReam=flags.ream?pick('Finition des alésages',[['ream','Alésoir'],['mill','Fraise (hélicoïdal)']],c.ream,'Après le pré-trou : alésoir (entrée et sortie en avance) ou fraise en hélice'):null;
  const sCsk=flags.csk?pick('Fraisures',[['spot','Foret à pointer'],['chamfer','Fraise à chanfreiner']],c.csk,'Même angle que la fraisure, après le perçage'):null;
  const sels=[];
  if(list.length){
    d.appendChild(mk('div','fao-imp-s','Pièce importée : la forme ne dit pas si un trou est taraudé ou alésé. Indiquez la nature de chaque groupe :'));
    const lst=mk('div','fao-imp-list');d.appendChild(lst);
    list.forEach(function(it){
      const g=it.g,h0=g.holes[0],key=g.d.toFixed(2)+'@'+g.z.toFixed(2);
      const info=(setup.holeInfo&&setup.holeInfo[key])||{};
      const row=mk('label','fao-imp-it');
      const tx=mk('div','fao-imp-x');
      tx.appendChild(mk('div','fao-imp-n','Ø'+(+g.d.toFixed(3))+' × '+g.holes.length));
      tx.appendChild(mk('div','fao-imp-d','Z '+(+g.z.toFixed(2))+' → '+(+h0.zbot.toFixed(2))+' · '+(h0.through?'débouchant':'borgne')+(h0.chD?(' · chanfrein Ø'+(+h0.chD.toFixed(2))):'')+(h0.cb?(' · sous lamage Ø'+h0.cb.d):'')));
      row.appendChild(tx);
      const opts=faoStepHoleOpts(g,it.all);
      const sl=mk('select','fao-sel');
      opts.forEach(function(o){const e=mk('option','',o[1]);e.value=o[0];sl.appendChild(e);});
      let v=faoStepHoleVal(info);
      if(!v&&faoStepIsUpper(h0,it.all))v='cbore'; // étage du dessus : lamage le plus probable
      sl.value=opts.some(function(o){return o[0]===v;})?v:'';
      row.appendChild(sl);lst.appendChild(row);sels.push({sl:sl,key:key,info:info});
    });
  }
  const rowB=mk('div','mffBtns');
  const bC=mk('button','','Annuler'),bOk=mk('button','primary','Créer la gamme'),sp=mk('span','fao-imp-sp');
  const close=function(){try{document.removeEventListener('keydown',key,true);}catch(e){}try{bg.remove();}catch(e){}};
  const ok=function(){
    close();
    setup.drillCfg=Object.assign({},setup.drillCfg||{},{spot:sSpot.value});
    if(sReam)setup.drillCfg.ream=sReam.value;
    if(sCsk)setup.drillCfg.csk=sCsk.value;
    sels.forEach(function(q){faoStepInfoSet(setup,q.key,q.sl.value,!!(q.info.thread&&q.info.thread.lh));});
    done();
  };
  const key=function(e){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
    else if(e.key==='Enter'&&!(e.target&&e.target.tagName==='SELECT')){e.preventDefault();e.stopPropagation();ok();}
  };
  bC.onclick=close;bOk.onclick=ok;
  [sp,bC,bOk].forEach(function(b){rowB.appendChild(b);});
  d.appendChild(rowB);bg.appendChild(d);document.body.appendChild(bg);
  try{document.addEventListener('keydown',key,true);}catch(e){}
  try{bOk.focus();}catch(e){}
  return bg;
}
function faoDrillGammeAsk(setup,op,noSnap){
  // Gamme, après la fenêtre « Gamme de perçage » (outils, nature des trous de STEP).
  // V0.99.10 : op peut être une liste (une opération par orientation 3+2) : une seule fenêtre.
  const ops=Array.isArray(op)?op:[op];
  const run=function(){
    if(ops.length===1)return faoDrillGamme(setup,ops[0],true);
    const m=faoDrillGammeOrder(setup,ops.map(function(o){return faoDrillGamme(setup,o,true,true)||[];}));return m; // rafraichi par l'appelant (fenetre, creation)
  };
  if(typeof document==='undefined'||!document.body||faoDrillGammeAsk.off){
    if(!noSnap)faoSnapshot('gamme de perçage');
    return run();
  }
  let list=[],H=[];
  ops.forEach(function(o){
    try{list=list.concat(faoStepUnknown(setup,o));}catch(e){}
    try{faoDrillResolve(o);}catch(e){}
    H=H.concat(o.holes||[]);
  });
  const flags={n:H.length,
    ream:H.some(function(h){return h.ream;})||list.length>0,
    csk:H.some(function(h){return h.csk;})||list.some(function(it){return it.g.holes[0].chD>0;})};
  if(ops.length>1)flags.nFr=ops.length;
  faoDrillGammeDlg(setup,ops[0],list,flags,function(){
    if(!noSnap)faoSnapshot('gamme de perçage');
    const made=run();
    faoChanged();
    try{if(made&&made.length)faoSelectOp(setup.id,made[0].id);}catch(e){}
  });
  try{faceEl.textContent='Gamme de perçage : choisissez les outils, puis « Créer la gamme ».';}catch(e){}
  return null;
}
/* ----- V0.99.10 : trous d'axes différents → une opération par orientation du plateau (3+2) -----
   Trous cliqués sur plusieurs faces, ou perçage normal (trous dans un congé, chacun perpendiculaire
   à la face) : les faces sont rangées par axe, chaque axe devient une opération Perçage à son repère
   (faoDrillSelHoles). Après la gamme, les opérations sont triées étape par étape (pointage, perçage,
   fraisure, lamage, alésage, taraudage), chaque outil d'un seul tenant, les orientations voisines à la
   suite : moins de changements d'outil et de pivotements. Le post dégage (SUPA Z puis X) à chaque
   pivotement et approche en deux temps. */
function faoDrillSelFaces(){
  // Faces de la sélection + trous des perçages normaux concernés (fonction choisie dans l'arbre, ou
  // un de ses trous cliqué : tous ses trous, comme une fonction Perçage), avec leur sens de perçage.
  const fs=((typeof selFaces!=='undefined'&&selFaces)||[]).filter(function(f){return f&&f.point;});
  const out=fs.slice(),hn=[];
  if(typeof hnIs!=='function'||typeof hnRun==='undefined')return {faces:out,hn:0};
  const un=function(v){const L=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/L,v[1]/L,v[2]/L];};
  const items=function(f){const R=hnRun.get(f.id);return ((R&&R.all)||[]).filter(function(it){return it.on;});};
  const onIt=function(q,it){
    if(!(q.geom&&q.geom.kind==='cyl'&&q.geom.axis))return false;
    const u=un([it.C[0]-it.P[0],it.C[1]-it.P[1],it.C[2]-it.P[2]]),a=q.geom.axis;
    if(Math.abs(u[0]*a.x+u[1]*a.y+u[2]*a.z)<0.9999)return false;
    const w=[q.point.x-it.P[0],q.point.y-it.P[1],q.point.z-it.P[2]],t=w[0]*u[0]+w[1]*u[1]+w[2]*u[2];
    return Math.hypot(w[0]-t*u[0],w[1]-t*u[1],w[2]-t*u[2])<0.1;
  };
  try{
    (doc.features||[]).forEach(function(f){
      if(!f||!hnIs(f)||f.visible===false)return;
      const its=items(f);if(!its.length)return;
      const picked=(typeof sel!=='undefined'&&sel&&sel.kind==='feature'&&sel.id===f.id)||fs.some(function(q){return its.some(function(it){return onIt(q,it);});});
      if(picked)hn.push(its);
    });
  }catch(e){}
  hn.forEach(function(its){its.forEach(function(it){
    const u=un([it.C[0]-it.P[0],it.C[1]-it.P[1],it.C[2]-it.P[2]]),V=function(v){return {x:v[0],y:v[1],z:v[2]};};
    // milieu du chemin : dans le trou, ni sur la face d'entrée ni dans le trou visé
    out.unshift({point:V([(it.P[0]+it.C[0])/2,(it.P[1]+it.C[1])/2,(it.P[2]+it.C[2])/2]),geom:{kind:'cyl',axis:V(u),center:V(it.P)},drillDir:V(u)});
  });});
  return {faces:out,hn:hn.length};
}
function faoDrillAxisGroups(setup,faces){
  // Faces rangées par axe (au signe près) ; faces sans axe : avec l'axe unique s'il n'y en a qu'un.
  const G=[],loose=[];
  faces.forEach(function(f){
    const a=f.geom&&f.geom.kind==='cyl'&&f.geom.axis;
    if(!a){loose.push(f);return;}
    let g=G.find(function(g){return Math.abs(g.a[0]*a.x+g.a[1]*a.y+g.a[2]*a.z)>0.99995;});
    if(!g){g={a:[a.x,a.y,a.z],faces:[]};G.push(g);}
    if(f.drillDir)g.faces.unshift(f);else g.faces.push(f); // le sens connu d'abord (faoDrillSelAxis lit la 1re)
  });
  if(loose.length){if(G.length===1)G[0].faces=G[0].faces.concat(loose);else G.push({a:null,faces:loose});}
  if(G.length<2)return G;
  // ordre : l'axe le plus proche du Z du posage, puis toujours l'orientation la plus proche
  const P=faoFrame(setup),zr=function(a){if(!a)return 1;const r=P.id?a:faoRotF(P,a);return Math.abs(r[2]);};
  const ang=function(p,q){if(!p||!q)return (p===q)?1:0;return Math.abs(p[0]*q[0]+p[1]*q[1]+p[2]*q[2]);};
  const rest=G.slice().sort(function(p,q){return zr(q.a)-zr(p.a);}),out=[rest.shift()];
  while(rest.length){
    const last=out[out.length-1].a;let bi=0,bv=-1;
    rest.forEach(function(g,i){const v=ang(last,g.a);if(v>bv+1e-9){bv=v;bi=i;}});
    out.push(rest.splice(bi,1)[0]);
  }
  return out;
}
function faoDrillGammeOrder(setup,lists){
  // Opérations des gammes de chaque orientation (lists[k] = gamme de l'orientation k) remises dans
  // l'ordre d'atelier : étape, puis outil (dans l'ordre où il apparaît), puis orientation.
  const all=[];lists.forEach(function(L,k){(L||[]).forEach(function(o,i){all.push({o:o,k:k,i:i});});});
  if(!all.length)return [];
  const ph=function(o){
    if(o.gRole==='pointage'||o.cycle==='spot'&&o.gRole!=='fraisure')return 0;
    if(o.gRole==='fraisure')return 2;
    if(o.gRole==='alesage')return 4;
    if(o.cycle==='tap')return 5;
    if(o.cycle==='helix')return 3;
    return 1;
  };
  const rk={};
  all.slice().sort(function(p,q){return ph(p.o)-ph(q.o)||p.k-q.k||p.i-q.i;}).forEach(function(e,n){const t=e.o.toolId||'';if(!(t in rk))rk[t]=n;});
  const pos=Math.min.apply(null,all.map(function(e){return setup.ops.indexOf(e.o);}).filter(function(i){return i>=0;}));
  all.forEach(function(e){const i=setup.ops.indexOf(e.o);if(i>=0)setup.ops.splice(i,1);});
  all.sort(function(p,q){return ph(p.o)-ph(q.o)||rk[p.o.toolId||'']-rk[q.o.toolId||'']||p.k-q.k||p.i-q.i;});
  const at=isFinite(pos)?pos:setup.ops.length;
  setup.ops.splice.apply(setup.ops,[at,0].concat(all.map(function(e){return e.o;})));
  const made=all.map(function(e){return e.o;});
  const nT=Object.keys(rk).length;
  try{faceEl.textContent='Gamme créée sur '+lists.filter(function(L){return L&&L.length;}).length+' orientations du plateau (3+2) : '+made.length+' opérations, '+nT+' outil(s), chaque outil d’un seul tenant — le programme dégage et pivote entre deux orientations.';}catch(e){}
  return made;
}
function faoDrillFromSel(setup,op){
  // Appelé juste après la création d'une opération Perçage (barre « + Usinage », ruban).
  // V0.99.10 : trous de plusieurs axes → une opération par orientation (faoDrillAxisGroups)
  let SF=null;try{SF=faoDrillSelFaces();}catch(e){SF=null;}
  const groups=SF?faoDrillAxisGroups(setup,SF.faces):[];
  if(groups.length>1||(SF&&SF.hn)){
    const keep=selFaces,ops=[];
    try{
      groups.forEach(function(g,k){
        const o=k?faoOpDefaults('drill'):op;
        if(k)setup.ops.splice(setup.ops.indexOf(ops.length?ops[ops.length-1]:op)+1,0,o);
        selFaces=g.faces;
        let gs=[];try{gs=faoDrillSelHoles(setup,o);}catch(e){gs=[];}
        if(!gs.length){if(k)setup.ops.splice(setup.ops.indexOf(o),1);return;}
        o.src='model';o.holeSel=gs;ops.push(o);
      });
    }finally{selFaces=keep;}
    if(ops.length){
      if(ops.indexOf(op)<0){const i=setup.ops.indexOf(op);if(i>=0)setup.ops.splice(i,1);} // 1er axe sans trou
      const made=faoDrillGammeAsk(setup,ops.length>1?ops:ops[0],true);
      try{ if(typeof clearMeasure==='function')clearMeasure(); }catch(e){}
      return made||(ops[0]===op?null:[ops[0]]);
    }
  }
  let gs=[];try{gs=faoDrillSelHoles(setup,op);}catch(e){gs=[];}
  if(!gs.length)return null;
  op.src='model';op.holeSel=gs;
  const made=faoDrillGammeAsk(setup,op,true);
  try{ if(typeof clearMeasure==='function')clearMeasure(); }catch(e){}
  if(made&&op.frame){try{faceEl.textContent+=' Repère 3+2 : Z = axe des trous ('+faoFrameLabel(op.frame.z)+') — réglez X dans l’onglet Repère de chaque opération.';}catch(e){}}
  return made;
}

/* ----- gamme automatique : pointage → perçage → taraudage — 2026-10-15-013 ----- */
function faoDrillGamme(setup,op,noSnap,quiet){
  // À partir des groupes sélectionnés de l'opération : remplace l'opération par la
  // séquence d'atelier. Lamages : signalés (fraisage = interpolation, étape suivante).
  // noSnap : l'appelant a déjà pris l'instantané (création + gamme = un seul Ctrl+Z).
  if(!op||op.type!=='drill')return null;
  if(!noSnap)faoSnapshot('gamme de perçage');
  faoDrillResolve(op);
  const holes=op.holes||[];
  const sel=(op.holeSel||[]).slice();
  if(!sel.length||!holes.length){try{faceEl.textContent='Gamme : sélectionnez d’abord des trous.';}catch(e){}return null;}
  const of=function(s){return holes.filter(function(h){return Math.abs(h.d-s.d)<0.02&&Math.abs(h.ztop-s.z)<0.05;});};
  const cfg=faoDrillCfg(setup);
  // V0.99.9 : tri TROU PAR TROU (un groupe « même Ø, même départ » peut mêler un alésage et
  // des avant-trous de double perçage) ; chaque opération garde ses trous (op.hf, faoHoleFilt)
  const any=function(s,hf){return of(s).some(function(h){return faoHoleFilt(hf,h);});};
  const skipped=sel.filter(function(s){return of(s).some(function(h){return h.pre&&h.through;});});
  const cbores=sel.filter(function(s){return of(s).some(function(h){return h.cbore;});});
  const reams=sel.filter(function(s){return cbores.indexOf(s)<0&&any(s,'ream');});
  // pilote d'un alésage : percé même s'il n'était pas sélectionné
  const key=function(d,z){return (+d).toFixed(2)+'@'+(+z).toFixed(2);};
  reams.forEach(function(s){of(s).forEach(function(h){
    if(!h.ream||!h.ream.pil)return;
    const all=faoWithOpFrame(op,function(){return faoHolesDetect();}),q=faoReamPilot(h,all,h.ream);
    if(q&&!sel.some(function(t){return key(t.d,t.z)===key(q.d,q.ztop);})){
      const g={d:+(+q.d).toFixed(3),z:+(+q.ztop).toFixed(3)};sel.push(g);op.holeSel.push(g);
      faoDrillResolve(op);holes.length=0;Array.prototype.push.apply(holes,op.holes||[]);}
  });});
  const plain=sel.filter(function(s){return cbores.indexOf(s)<0&&any(s,'plain');});
  const base={depthMode:op.depthMode||'full',brk:isFinite(+op.brk)?+op.brk:1,order:op.order||'auto',dwell:0};
  const idx=Math.max(0,setup.ops.indexOf(op));
  setup.ops.splice(idx,1);
  const made=[];let at=idx;
  const push=function(o){faoDrillInherit(op,o);setup.ops.splice(at++,0,o);faoDrillResolve(o);if((o.holes||[]).length)made.push(o);else setup.ops.splice(--at,1);return o;};
  const hsel=function(list){return list.map(function(s){return {d:s.d,z:s.z};});};
  // perçages à faire : {s (groupe), d (Ø du foret), mode, hf}
  const drills=[];
  plain.forEach(function(s){drills.push({s:s,d:+s.d,mode:base.depthMode,hf:'plain'});});
  // alésages sans pilote proche : pré-trou Ø alésage − surépaisseur (écart de la fonction, sinon
  // règle d'atelier) ; borgne : pointe au fond (rien sous le fond plat)
  reams.forEach(function(s){
    const hs=of(s).filter(function(h){return h.ream;}),h0=hs[0],D=+s.d;
    if(hs.every(function(h){return h.ream.pil;}))return;
    const a=(h0.ream.off>0)?+h0.ream.off:faoReamAllow(D);
    drills.push({s:s,d:+Math.max(0.2,D-a).toFixed(3),mode:h0.through?'full':'tip',hf:'ream',pre:true});
  });
  // 1. pointage (sauf au fond d'un avant-trou ou au-dessus d'un pilote : déjà centrés)
  const toSpot=sel.filter(function(s){return drills.some(function(q){return q.s===s;})&&any(s,'spot');});
  if(toSpot.length&&cfg.spot!=='none'){
    const sp=Object.assign(faoOpDefaults('drill'),base,{cycle:'spot',gRole:'pointage',hf:'spot',holeSel:hsel(toSpot)});
    push(sp);faoDrillAutoTool(setup,sp,toSpot[0].d);
  }
  // 2. perçage : un Ø (et une profondeur) par opération, débourrage si profond (> 4 × Ø) ; gros Ø d'abord
  const byD=new Map();
  drills.slice().sort(function(x,y){return y.d-x.d;}).forEach(function(q){const k=q.d.toFixed(2)+'|'+q.mode+'|'+q.hf;if(!byD.has(k))byD.set(k,[]);byD.get(k).push(q);});
  byD.forEach(function(list){
    const hs=[].concat.apply([],list.map(function(q){return of(q.s).filter(function(h){return faoHoleFilt(q.hf,h);});}));
    const d=list[0].d,depth=hs.reduce(function(m,h){return Math.max(m,h.zSurf-h.zbot);},0);
    const deep=depth>4*d;
    const dr=Object.assign(faoOpDefaults('drill'),base,{cycle:deep?'peck':'drill',depthMode:list[0].mode,hf:list[0].hf,peck:deep?+(+d).toFixed(1):0,holeSel:hsel(list.map(function(q){return q.s;}))});
    if(list[0].pre)dr.gRole='pretrou';
    push(dr);faoDrillAutoTool(setup,dr,d);
  });
  // 3. fraisures : foret à pointer de l'angle de la fraisure, après le perçage
  const csks=plain.filter(function(s){return any(s,'csk');});
  if(csks.length){
    const byA=new Map();csks.forEach(function(s){const k=String(of(s).find(function(h){return h.csk;}).csk);if(!byA.has(k))byA.set(k,[]);byA.get(k).push(s);});
    byA.forEach(function(list){
      const fs=Object.assign(faoOpDefaults('drill'),base,{cycle:'spot',gRole:'fraisure',hf:'csk',holeSel:hsel(list)});
      push(fs);faoDrillAutoTool(setup,fs,list[0].d);
    });
  }
  // 4. lamages : fraisage hélicoïdal, un Ø par opération
  const byC=new Map();cbores.forEach(function(s){const k=(+s.d).toFixed(2);if(!byC.has(k))byC.set(k,[]);byC.get(k).push(s);});
  byC.forEach(function(list){
    const hl=Object.assign(faoOpDefaults('drill'),base,{cycle:'helix',holeSel:hsel(list)});
    push(hl);faoHelixTool(setup,hl,list[0].d);
  });
  // 5. finition des alésages : alésoir (cycle d'alésage) ou fraise (hélicoïdal), un Ø par opération
  const byR=new Map();reams.forEach(function(s){const k=(+s.d).toFixed(3);if(!byR.has(k))byR.set(k,[]);byR.get(k).push(s);});
  byR.forEach(function(list){
    const ro=Object.assign(faoOpDefaults('drill'),base,{cycle:cfg.ream==='mill'?'helix':'ream',gRole:'alesage',hf:'ream',holeSel:hsel(list)});
    push(ro);faoDrillAutoTool(setup,ro,list[0].d);
  });
  // 6. taraudage : un filet par opération
  const byT=new Map();
  plain.forEach(function(s){
    // un groupe (même Ø, même départ) peut mêler filets à droite / à gauche, ou trous lisses
    const ks=[];of(s).forEach(function(x){if(x.thread){const k=faoThreadKey(x.thread);if(ks.indexOf(k)<0)ks.push(k);}});
    ks.forEach(function(k){if(!byT.has(k))byT.set(k,[]);byT.get(k).push(s);});});
  byT.forEach(function(list,k){
    const tp=Object.assign(faoOpDefaults('drill'),base,{cycle:'tap',thKey:k,hf:'plain',holeSel:hsel(list)});
    push(tp);faoDrillAutoTool(setup,tp,list[0].d);
  });
  if(!quiet)faoChanged(); // V0.99.10 : plusieurs orientations → un seul rafraîchissement, à la fin
  const names=made.map(function(o){const t=faoToolById(setup,o.toolId);
    const nm=o.gRole==='fraisure'?'Fraisure':(o.gRole==='alesage'?(o.cycle==='ream'?'Alésage':'Alésage fraisé'):(o.gRole==='pretrou'?'Pré-trou d’alésage':({spot:'Pointage',drill:'Perçage',peck:'Perçage (débourrage)',tap:'Taraudage',helix:'Lamage fraisé'}[o.cycle]||o.cycle)));
    return nm+' T'+t.num+' '+t.name;});
  let msg='Gamme créée : '+names.join(' → ')+'.';
  if(skipped.length)msg+=' Petit trou du double perçage (Ø'+skipped.map(function(s){return +(+s.d).toFixed(2);}).join(', Ø')+') laissé pour l’autre côté.';
  if(!made.length)msg='Gamme : rien à usiner de ce côté.';
  try{faceEl.textContent=msg;}catch(e){}
  return made;
}

/* ----- fraisage hélicoïdal (lamages, gros trous) — 2026-10-15-014 -----
   Fraise cylindrique, descente en hélice EN AVALANT (G3 : sens trigo, broche M3)
   par quarts de tour, tour complet au fond (dressage), sortie au centre, remontée.
   Rayon de trajectoire R = (Ø trou − Ø fraise)/2 ; si R dépasse ~ le rayon de la
   fraise, le noyau central resterait : anneaux concentriques de l'intérieur vers
   l'extérieur, chacun descendu en hélice. */
const FAO_MILL_STD=[1,1.5,2,2.5,3,4,5,6,8,10,12,14,16,20,25,32];
function faoHelixPitch(op,R,toolD){
  const v=+op.helixP;if(isFinite(v)&&v>0)return v;
  return Math.max(0.1,Math.min(toolD*0.25,2*Math.PI*Math.max(R,0.2)*Math.tan(2.5*Math.PI/180)));
}
function faoGenHelixPlan(plan,toolD,op,secuAbs){
  const moves=[],rt=toolD/2;
  plan.forEach(function(p){
    const Rf=(p.d-toolD)/2;
    if(!(Rf>0.02))return; // fraise trop grosse : rien (signalé dans la fiche)
    const s=Math.max(+secuAbs||0,p.rfp+2);
    // anneaux : extérieur = Rf, pas radial ≤ 1,6 × rayon fraise, jusqu'à couvrir le centre
    const radii=[Rf];
    const ae=Math.max(0.1,1.6*rt*0.9);
    while(radii[0]>rt*0.9){radii.unshift(Math.max(0,radii[0]-ae));}
    if(radii[0]<=1e-6)radii.shift();
    radii.forEach(function(R,ri){
      if(!(R>0.02))return;
      const pitch=faoHelixPitch(op,R,toolD);
      const z0=p.rfp+0.5,z1=p.zTip;
      moves.push({r:1,x:p.x+R,y:p.y,z:s});
      moves.push({r:1,x:p.x+R,y:p.y,z:z0});
      // hélice : quarts de tour (balayage < 180° → IJK sûr sur les deux CN)
      const turns=Math.max(0.25,(z0-z1)/pitch),nq=Math.ceil(turns*4);
      let a=0;
      for(let q=1;q<=nq;q++){
        const a1=q*Math.PI/2,zq=z0-(z0-z1)*q/nq;
        const sx=p.x+R*Math.cos(a),sy=p.y+R*Math.sin(a);
        moves.push({r:0,ent:1,x:p.x+R*Math.cos(a1),y:p.y+R*Math.sin(a1),z:zq,arc:{i:p.x-sx,j:p.y-sy,cw:false}});
        a=a1;
      }
      // tour complet au fond (dressage du fond)
      for(let q=1;q<=4;q++){
        const a1=a+q*Math.PI/2,a0=a+(q-1)*Math.PI/2;
        moves.push({r:0,x:p.x+R*Math.cos(a1),y:p.y+R*Math.sin(a1),z:z1,arc:{i:-R*Math.cos(a0),j:-R*Math.sin(a0),cw:false}});
      }
      // dégagement : vers le centre (sans marquer la paroi), puis remontée
      moves.push({r:0,x:p.x,y:p.y,z:z1});
      moves.push({r:1,x:p.x,y:p.y,z:ri<radii.length-1?p.rfp+1:s});
    });
  });
  return moves;
}
function faoHelixTool(setup,op,d){
  // Plus grande fraise cylindrique de la bibliothèque entre 40 et 85 % du Ø du trou,
  // sinon création d'une fraise standard (≤ 70 % du Ø).
  const tools=setup.tools||(setup.tools=[]);
  const cur=faoToolById(setup,op.toolId);
  const ok=function(t){return t&&(t.kind==='flat'||t.kind==='bull')&&+t.d>=0.4*d&&+t.d<=0.85*d;};
  if(ok(cur))return null;
  const cands=tools.filter(ok).sort(function(a,b){return +b.d-(+a.d);});
  let t=cands[0],made=false;
  if(!t){
    const D=FAO_MILL_STD.filter(function(x){return x<=0.7*d;}).pop()||Math.max(1,+(0.6*d).toFixed(1));
    const n=tools.reduce(function(m,x){return Math.max(m,+x.num||0);},0)+1;
    t={id:'T'+n+'_'+Date.now().toString(36),num:n,name:'Fraise D'+D,kind:'flat',d:D,cornerR:0,flutes:3,vc:200,fz:0.03};
    tools.push(t);made=true;
  }
  op.toolId=t.id;delete op.cut;
  return {tool:t,made:made};
}
