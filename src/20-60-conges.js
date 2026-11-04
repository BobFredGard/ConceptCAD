function distSeg2(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy||1e-18;let t=((px-ax)*dx+(py-ay)*dy)/L2;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}
function rotP(Q,Cx,Cy,a){const dx=Q.x-Cx,dy=Q.y-Cy,c=Math.cos(a),s=Math.sin(a);Q.x=Cx+dx*c-dy*s;Q.y=Cy+dx*s+dy*c;}
function pairKey(a,b){return a<b?a+'_'+b:b+'_'+a;}
// Écart 2D d'une arête à son entité d'esquisse, corrigé de la DÉPOUILLE : une extrusion à
// dépouille pivote sur le plan d'esquisse, ses arêtes à la hauteur z sont décalées de
// |z|·tan(angle) de l'entité qui les a produites (Barquette : fond à 35 mm, 15° → 9,4 mm).
// Sans correction, l'arête du fond n'avait jamais d'ancre (hors des 8 mm) et retombait sur
// le repli position+hauteur figées : changer calibre ou angle lui faisait perdre son arête.
function xDraftDist(skId,z2,d){
  let best=d;
  (doc.features||[]).forEach(f=>{
    if(f.type!=='extrude'||f.sketchId!==skId||f.visible===false)return;
    const a=Math.abs(+f.draft||0);if(!(a>1e-9&&a<89))return;
    best=Math.min(best,Math.abs(d-Math.abs(z2)*Math.tan(a*Math.PI/180)));
  });
  return best;
}
function xAnchorFor(m){
  // Nommage persistant d'une arête : ancre sketch (point ou entité) qui suit les éditions.
  // Le recalage se fait en 2D esquisse (insensible aux découpes qui scindent en hauteur).
  // m = milieu monde [x,y,z]. Retourne {t:'p'|'e',sk,id,z,side,far} ou null. side: 0=bas,1=haut (suit l'épaisseur).
  // Toutes les esquisses comptent (masquées = consommées : ce sont LEURS profils qui ont produit
  // les arêtes) et on garde la MEILLEURE candidature (2D d'abord, plan ensuite) — le premier
  // sketch trouvé revenait à ancrer une arête de découpe sur le profil de la plaque (ligne 2D
  // identique, autre plan) : l'ancre dérivait sur de mauvaises arêtes.
  // DEUXIÈME PASSE (RAD=8, ancre marquée far:1) : une arête née d'un CONGÉ/CHANFREIN n'est pas
  // sur l'esquisse — l'arc d'un rayon remplace le coin et se trouve à ~6 mm de toute entité 2D.
  // La passe stricte à 1 mm ne trouvait donc RIEN et l'ancre revenait null : l'arête retombait
  // sur le repli fragile position+longueur d'occApplyXFillets, puis perdait sa référence (⚠ dans
  // l'arbre) dès que le solide bougeait. Élargir seul confondait l'arc et son segment
  // colinéaire (8 sélections → 4 arêtes) : xAnchorMatch lève donc la tolérance 2D pour far:1
  // ET départage sur la position d'origine (pos0), qui est l'arête réellement cliquée.
  const scan=(RAD,far)=>{
    let best=null;
    const consider=(res,d2,w)=>{
      const sc=d2+0.25*Math.abs(w)+(res.t==='p'?-0.001:0); // plan proche avant, point avant ligne à égalité
      if(!best||sc<best.sc)best={sc,res};
    };
    for(const s of (doc.sketches||[])){
      if(!s)continue;
      let B;try{B=sketchBasis(s);}catch(e){continue;}
      const dx=m[0]-B.o.x,dy=m[1]-B.o.y,dz=m[2]-B.o.z;
      const x2=dx*B.u.x+dy*B.u.y+dz*B.u.z,y2=dx*B.v.x+dy*B.v.y+dz*B.v.z,z2=dx*B.n.x+dy*B.n.y+dz*B.n.z;
      let bestP=null,bdP=RAD;
      Object.keys(s.points||{}).forEach(pid=>{const p=s.points[pid];if(!p)return;const d=Math.hypot(p.x-x2,p.y-y2);if(d<bdP){bdP=d;bestP=pid;}});
      // z = NIVEAU du clic (repère de l'esquisse, voyage avec l'origine) : sans lui une
      // ancre point n'a AUCUNE information de hauteur — xAnchorMatch ne peut pas distinguer
      // le fond, le rebord et la couture d'une poche qui projetent tous sur ce point.
      if(bestP)consider({t:'p',sk:s.id,id:bestP,z:+z2.toFixed(3),far:far?1:0},bdP,z2);
      let bestE=null,bdE=RAD;
      (s.entities||[]).forEach(e=>{
        if(e.construction||e.ref)return; // ancre = géométrie de profil uniquement
        if(e.t==='line'){
          const A0=s.points[e.p1],B0=s.points[e.p2];if(!A0||!B0)return;
          const d=xDraftDist(s.id,z2,distSeg2(x2,y2,A0.x,A0.y,B0.x,B0.y));
          if(d<bdE){bdE=d;bestE=e;}
        }else if(e.t==='circle'||e.t==='arc'){
          const C=s.points[e.pc];if(!C||!(e.r>0))return;
          if(e.t==='arc'){
            const an=arcAngles(s,e);if(!an)return;
            const TAU=Math.PI*2;
            const rel=((Math.atan2(y2-C.y,x2-C.x)-an.a1)%TAU+TAU)%TAU;
            if(rel>an.a2-an.a1+0.05)return; // hors du span : pas cette entité
          }
          const d=xDraftDist(s.id,z2,Math.abs(Math.hypot(x2-C.x,y2-C.y)-e.r));
          if(d<bdE){bdE=d;bestE=e;}
        }
      });
      if(bestE){
        // side suit l'épaisseur : bas≈0, haut≈distance
        const dists=(doc.features||[]).filter(f=>f.type==='extrude'&&f.sketchId===s.id&&f.visible!==false).map(f=>extrudeSpan(f));
        let side=0; // 0=bas,1=haut
        if(dists.length){
          // Une découpe « à travers tout » a une étendue SENTINELLE (±5000) : ni lo ni hi ne
          // décrit un niveau réel, isBottom ET isTop sont donc FAUX, et le repli
          // « isBottom?0:1 » tombait toujours sur 1 (HAUT). Conséquence mesurée : les arcs du
          // BAS d'une poche se voyaient ancrer sur son échelle HAUT, le bas n'était jamais
          // adouci et les 4 sélections se regroupaient sur les mêmes arêtes. Sans étendue
          // exploitable, le seul repère restant est le plan de l'esquisse : au-dessus (ou
          // dessus) = haut, en dessous = bas.
          const sentinelle=dists.every(d=>!isFinite(d.lo)||!isFinite(d.hi)||Math.abs(d.lo)>1000||Math.abs(d.hi)>1000);
          if(sentinelle){
            side=(z2>=-0.5)?1:0;
          }else{
            const isBottom=dists.some(d=>Math.abs(z2 - d.lo)<1.0);
            const isTop=dists.some(d=>Math.abs(z2 - d.hi)<1.0);
            side=isBottom?0:1;
            if(isBottom&&isTop)side=Math.abs(z2)<1.0?0:1;
          }
        } else side=Math.abs(z2)<1.0?0:1;
        consider({t:'e',sk:s.id,id:bestE.id,z:+z2.toFixed(3),side,dist:dists[0]?dists[0].hi:0,far:far?1:0},bdE,z2);
      }
    }
    return best?best.res:null;
  };
  return scan(1.0,false)||scan(8.0,true);
}
function xAnchorMatch(se,edges){
  // Arêtes du solide courant correspondant à l'ancre (test géométrique en 2D esquisse).
  // 'p' : verticales passant par le point. 'e' : milieux sur l'entité courante, à même hauteur.
  // Règle : UNE sélection = UNE arête. On ne retient jamais plusieurs candidates, sinon le
  // chanfrein se disperse sur plusieurs arêtes (une échoue) et la position mémorisée part
  // sur l'arête voisine : la référence est perdue à jamais dès que le solide change.
  const out=[];
  if(!se||!se.anchor)return out;
  const a=se.anchor,s=doc.sketches.find(k=>k.id===a.sk);
  if(!s)return out;
  let B;try{B=sketchBasis(s);}catch(e){return out;}
  const proj=m=>{
    const dx=m[0]-B.o.x,dy=m[1]-B.o.y,dz=m[2]-B.o.z;
    return[dx*B.u.x+dy*B.u.y+dz*B.u.z,dx*B.v.x+dy*B.v.y+dz*B.v.z,dx*B.n.x+dy*B.n.y+dz*B.n.z];
  };
  // Hauteur de référence : le NIVEAU ENREGISTRÉ À LA CRÉATION (ancre z, repère local qui
  // suit l'origine de l'esquisse) plutôt que la position courante. ⚠ pos0 est figé en
  // coordonnées MONDE : une poche qui suit la face porteuse glisse de 20 mm et
  // proj(se.pos0) devient périmé (−32 au lieu de −12, mesuré) — l'ancre, elle, reste juste.
  // repli (anciens documents sans z) : projeter pos0 comme un point (q[2] est RELATIF au
  // plan ; comparer tel quels inversait haut et bas) — corrigé pour 'p' par a.z (B).
  const zRef=(a.z!==undefined&&a.z!==null&&isFinite(+a.z))?+a.z
    :((se.pos0&&se.pos0.length===3)?proj(se.pos0)[2]:(a.z||0));
  if(a.t==='p'){
    const p=s.points[a.id];if(!p)return out;
    // Hauteurs « naturelles » du solide pour cette esquisse (bas/haut des volumes qu'elle
    // a produits) : un coin empilé a une verticale par niveau — on prend celle du bon niveau.
    const spans=(doc.features||[]).filter(f=>f.type==='extrude'&&f.sketchId===a.sk&&f.visible!==false).map(f=>extrudeSpan(f));
    const dzPref=q2=>{
      if(!spans.length)return Math.abs(q2-zRef);
      let m=1e9;for(const d of spans){m=Math.min(m,Math.abs(q2-d.lo),Math.abs(q2-d.hi));}
      return Math.min(m,Math.abs(q2-zRef)+2); // à défaut, la position d'origine
    };
    // CANDIDATURES UNIFIÉES (toutes orientations) + NIVEAU + POS0. Les trois arêtes d'une
    // poche //XZ (fond, rebord, couture verticale) projetent au MÊME point d'esquisse et
    // dzPref les égalise (lo/hi du même prisme) : sans niveau ni distance au clic elles se
    // départageaient au PREMIER RENCONTRÉ — le premier loop n'acceptait que les verticales
    // et rendait aussitôt (la couture gagnait quoi que soit l'ordre), le repli sans pos0
    // prenait tout autre chose au hasard. L'ordre d'énumération d'OCCT, bouleversé par
    // toute édition amont, faisait donc basculer le congé sur l'arête extérieure (retour
    // utilisateur). On reprend la mécanique de la branche 'e' : buckets de NIVEAU (zRef =
    // niveau du clic), score avec distance au clic (pos0, plafonnée 60 mm), départage par
    // pos0 à score équivalent — sans orientation forcée, sans dépendance à l'ordre.
    const rows=[];
    edges.forEach((e,i)=>{
      const q=proj(e.mid);
      const d2=Math.hypot(q[0]-p.x,q[1]-p.y);
      if(d2>5.0)return;
      const P0=e.pts[0],P1=e.pts[e.pts.length-1],L=Math.hypot(P1[0]-P0[0],P1[1]-P0[1],P1[2]-P0[2]);
      if(L<1e-9)return;
      const d0=(se.pos0&&se.pos0.length===3)
        ?Math.hypot(e.mid[0]-se.pos0[0],e.mid[1]-se.pos0[1],e.mid[2]-se.pos0[2]):0;
      const lvl=Math.abs(q[2]-zRef);
      const sc=d2+0.3*dzPref(q[2])+0.6*Math.min(d0,60);
      rows.push({i,sc,lvl,d0});
    });
    const pick=bk=>{
      if(!bk.length)return null;
      bk.sort((x,y)=>x.sc-y.sc);
      const g0=bk[0].sc;
      const near=bk.filter(c=>c.sc<=g0+6);
      if(near.length<2)return near[0].i;
      near.sort((x,y)=>x.d0-y.d0); // à score équivalent : l'arête du CLIQUE l'emporte
      return near[0].i;
    };
    let c=pick(rows.filter(r=>r.lvl<=2.0));
    if(c===null)c=pick(rows.filter(r=>r.lvl<=8.0));
    if(c===null)c=pick(rows);
    if(c!==null)out.push(c);
    return out;
  }
  const e=(s.entities||[]).find(k=>k.id===a.id);if(!e)return out;
  if(e.construction||e.ref)return out;
  // épaisseur courante pour recaler haut/bas (le z absolu change avec distance)
  const curDists=(doc.features||[]).filter(f=>f.type==='extrude'&&f.sketchId===a.sk&&f.visible!==false).map(f=>extrudeSpan(f));
  const curSideZ=(side)=>{
    if(!curDists.length)return side===0?0:(a.dist||a.z||10);
    if(side===0)return curDists[0].lo;
    return curDists[0].hi;
  };
  // Une découpe « à travers tout » a une étendue SENTINELLE (±5000) : l'attendue vaut alors
  // 5000, son terme de hauteur noie tous les autres critères (0.2×5000 = 1000) et une arête
  // voisine à 6 mm passe devant l'arête visée. On retombe sur la position d'origine.
  const rawZ=(a.side!==undefined)?curSideZ(a.side):(Math.abs(a.z)<0.6?curSideZ(0):curSideZ(1));
  const expectedZ=(!isFinite(rawZ)||Math.abs(rawZ)>1000)?zRef:rawZ;
  // Trois niveaux de tolérance, du plus strict au plus large : la hauteur
  // tolérances emboîtées, de la plus stricte à la plus large : la hauteur
  // attendue d'abord ; sinon la candidate la plus proche en hauteur ; sinon la plus proche
  // en 2D (le solide a bougé en Z parce qu'une AUTRE fonction a changé de hauteur).
  let bA=[],bB=[],bC=[];
  edges.forEach((ed,i)=>{
    const q=proj(ed.mid);
    const P0=ed.pts[0],P1=ed.pts[ed.pts.length-1];
    const dz2=Math.abs(P1[2]-P0[2]),dxy2=Math.hypot(P1[0]-P0[0],P1[1]-P0[1]);
    const vert=dz2>dxy2;
    const ldiff=Math.abs((ed.len||0)-(se.len||0));
    let d2=null;
    if(e.t==='line'){
      const A0=s.points[e.p1],B0=s.points[e.p2];if(!A0||!B0)return;
      d2=distSeg2(q[0],q[1],A0.x,A0.y,B0.x,B0.y);
    }else if(e.t==='circle'||e.t==='arc'){
      const C=s.points[e.pc];if(!C||!(e.r>0))return;
      if(e.t==='arc'){
        const an=arcAngles(s,e);if(!an)return;
        const TAU=Math.PI*2;
        const rel=((Math.atan2(q[1]-C.y,q[0]-C.x)-an.a1)%TAU+TAU)%TAU;
        if(rel>an.a2-an.a1+0.05)return; // hors du span : pas cette entité
      }
      d2=Math.abs(Math.hypot(q[0]-C.x,q[1]-C.y)-e.r);
    } else return;
    d2=xDraftDist(a.sk,q[2],d2); // dépouille : l'arête suit l'angle et la hauteur courants
    // Ancre « far » (arête née d'un congé/chanfrein) : l'arc est à quelques mm de l'entité 2D
    // qui l'a produit → tolérance élargie, sinon plus aucune candidate et référence perdue.
    if(d2>(a.far?8.0:2.5))return;
    // Buckets : le niveau ATTENDU (épaisseur courante) OU le niveau du CLIQUE (zRef, figé
    // à la création) — le min ne peut qu'AJOUTER la candidate au niveau du clic, jamais
    // écarter celle attendue : une ancre de côté faux ne peut plus faire partir le clic.
    const zErr=Math.min(Math.abs(q[2]-expectedZ),Math.abs(q[2]-zRef));
    // DISTANCE À LA POSITION D'ORIGINE — terme UNIFORME, présent dans les deux branches.
    // pos0 est la donnée la plus durable qui soit (elle ne bouge jamais). Sans elle, deux
    // arêtes très proches en 2D se départagent au hasard, le mauvais choix est écrit dans
    // se.pos/se.len par take() et le treuil s'enclenche : à chaque rejeu l'erreur s'aggrave
    // (constaté : un congé R2 sur le bord d'une poche « à travers tout » dérivait sur la bande
    // de coin, puis le document devenait illisible). Plafonné à 60 mm : après un déplacement
    // volontaire du modèle le terme sature et la géométrie de l'esquisse reprend la main.
    const d0=(se.pos0&&se.pos0.length===3)
      ?Math.hypot(ed.mid[0]-se.pos0[0],ed.mid[1]-se.pos0[1],ed.mid[2]-se.pos0[2]):0;
    const p0t=0.6*Math.min(d0,60);
    const sc=vert?(d2+0.3*Math.min(ldiff,20)+0.2*Math.abs(q[2]-zRef)+p0t):(d2+0.3*Math.min(ldiff,30)+0.2*zErr+p0t);
    const row={i,sc,d0};
    if(zErr<=1.0)bA.push(row);
    else if(zErr<=8.0)bB.push(row);
    else bC.push(row);
  });
  // Une seule arête par sélection. Deux départages successifs, tous deux fondés sur pos0 :
  //  1) le score ci-dessus (qui punit l'écart à la position d'origine) ;
  //  2) à score géométrique équivalent (fenêtre de 6 mm) — c'est le cas de l'arc d'un congé
  //     et de son segment collinéaire, tous deux à moins de 8 mm de la MÊME entité 2D et dont
  //     le 2D ne peut pas les distinguer (le segment a même un d2 nul). Sans ce second
  //     départage, l'arc et le segment se rejoignent sur une arête et l'une des deux
  //     sélections est perdue. La fenêtre borne l'effet : au-delà de 6 mm, c'est la géométrie
  //     de l'esquisse qui fait foi (un déplacement volontaire d'esquisse reste suivi).
  const pick=(bk)=>{
    if(!bk.length)return null;
    bk.sort((x,y)=>x.sc-y.sc);
    const g0=bk[0].sc;
    const near=bk.filter(c=>c.sc<=g0+6);
    if(near.length<2)return bk[0].i;
    near.sort((x,y)=>x.d0-y.d0);
    return near[0].i;
  };
  const chosen=pick(bA);
  if(chosen!==null){out.push(chosen);return out;}
  const c2=pick(bB);
  if(c2!==null){out.push(c2);return out;}
  const c3=pick(bC);
  if(c3!==null)out.push(c3);
  return out;
}
function xAnchorStill(se){
  // Le point CLIQUÉ (pos0, monde, figé) est-il encore là où l'ancre le décrit — sur son
  // entité d'esquisse, au niveau mémorisé ? true : l'esquisse n'a pas bougé sous le clic,
  // une ancre qui vise ailleurs a donc divergé. false : l'esquisse a emporté l'arête (plan
  // porteur décalé, origine ou entité déplacée) et l'ancre fait foi, même loin du clic.
  // null : indécidable (sans ancre, sans pos0, esquisse ou entité absente) → règle historique.
  // V0.11.22, Cavité Test : Plan 1 (porteur de l'Esquisse 3) décalé de 25 à 20 mm — l'arête
  // du flanc BAS de la nervure (ancre côté 0) est à 9 mm du clic, mais le flanc HAUT (x = 24)
  // passe à 1 mm du clic d'origine (x = 25) : la garde « divergente » prenait cette jumelle,
  // les deux entrées du congé visaient la même arête et la passe « doublons » en effaçait une
  // pour toujours (retour à 25 : une seule arête restait).
  try{
    const a=se&&se.anchor,P0=se&&se.pos0;
    if(!a||!P0||P0.length!==3)return null;
    const s=(doc.sketches||[]).find(k=>k.id===a.sk);if(!s)return null;
    const B=sketchBasis(s);
    const dx=P0[0]-B.o.x,dy=P0[1]-B.o.y,dz=P0[2]-B.o.z;
    const q=[dx*B.u.x+dy*B.u.y+dz*B.u.z,dx*B.v.x+dy*B.v.y+dz*B.v.z,dx*B.n.x+dy*B.n.y+dz*B.n.z];
    if(a.t==='p'){
      const p=s.points[a.id];if(!p)return null;
      return Math.hypot(q[0]-p.x,q[1]-p.y)<=2.5;
    }
    const e=(s.entities||[]).find(k=>k.id===a.id);if(!e)return null;
    let d2;
    if(e.t==='line'){const A0=s.points[e.p1],B0=s.points[e.p2];if(!A0||!B0)return null;d2=distSeg2(q[0],q[1],A0.x,A0.y,B0.x,B0.y);}
    else if(e.t==='circle'||e.t==='arc'){const C=s.points[e.pc];if(!C||!(e.r>0))return null;d2=Math.abs(Math.hypot(q[0]-C.x,q[1]-C.y)-e.r);}
    else return null;
    d2=xDraftDist(a.sk,q[2],d2);
    if(d2>(a.far?8.0:2.5))return false; // l'entité n'est plus sous le clic : elle a été déplacée
    // Niveau : celui mémorisé au clic (a.z) OU le niveau courant du côté (l'épaisseur a pu
    // changer légitimement, comme dans xAnchorMatch) ; hors des deux, l'esquisse a bougé.
    const zs=[];
    if(a.z!==undefined&&a.z!==null&&isFinite(+a.z))zs.push(+a.z);
    if(a.side!==undefined){
      const sp=(doc.features||[]).filter(f=>f.type==='extrude'&&f.sketchId===a.sk&&f.visible!==false).map(f=>extrudeSpan(f));
      if(sp.length){const z=a.side===0?sp[0].lo:sp[0].hi;if(isFinite(z)&&Math.abs(z)<=1000)zs.push(z);}
    }
    if(!zs.length)return true;
    return zs.some(z=>Math.abs(q[2]-z)<=1.5);
  }catch(err){return null;}
}

function occApplyXFillets(base,xfils){
  // Congés/chanfreins exacts : 1) ancre esquisse recalculée (suit les éditions), 2) repli position+longueur.
  // Add_2 par arête, échec isolé (jamais de crash app).
  const warns=[];
  const chamfer=(xfils||[]).some(x=>x&&x.chamfer);
  const lab=xLabelLow(chamfer?'chamfer':'fillet');
  const dp=chamfer?'D':'R';
  const edges=occListEdges(base);
  if(!edges.length){warns.push(lab+' : aucune arête détectée');return{shape:base,warnings:warns};}
  // 2026-10-16-015 : migration — les entrées « tangente » ajoutées par d'anciens rejeux sont
  // retirées (la chaîne se re-déduit au calcul) dès qu'il reste au moins une arête CLIQUÉE.
  (xfils||[]).forEach(xf=>{if(xf&&Array.isArray(xf.edges)&&xf.edges.some(e=>e&&e.name!=='tangente'))xf.edges=xf.edges.filter(e=>!e||e.name!=='tangente');});
  // Anciennes sélections corrompues (anciennes passes multi-candidats) : positions en double →
  // fusion des jumeaux AVANT le réappariement. ATTENTION : trois arêtes distinctes d'une bande
  // de coin (coincidence de deux congé/chanfrein) ont le MÊME milieu — les fusionner sur la
  // seule position détruit la sélection (constaté : « 8 doublon(s) fusionné(s) », 4 arêtes
  // perdues). On exige donc aussi la même longueur : deux vraies arêtes jumelles se
  // ressemblent jusque dans leur longueur ; deux arêtes d'un coin, non. La fusion exacte est
  // garantie plus bas, sur l'index d'arête réellement résolu.
  // V0.11.22 : deux entrées d'ANCRES différentes (autre côté, autre entité) ou de CLICS
  // différents (pos0 à plus de 2 mm) sont deux sélections distinctes, même si un rejeu les a
  // momentanément appariées sur la même arête (se.pos identiques) : on ne les fusionne jamais,
  // le rejeu suivant les sépare. Les vrais doublons anciens (même position, ancre recalée sur
  // cette position, pos0 figé sur elle) sont fusionnés comme avant.
  const ancKey=e=>e.anchor?[e.anchor.t,e.anchor.sk,e.anchor.id,e.anchor.side,Math.round((+e.anchor.z||0)*10)].join('|'):'';
  const sameSel=(u,se)=>(!u.anchor||!se.anchor||ancKey(u)===ancKey(se))
    &&(!u.pos0||!se.pos0||u.pos0.length!==3||se.pos0.length!==3||Math.hypot(u.pos0[0]-se.pos0[0],u.pos0[1]-se.pos0[1],u.pos0[2]-se.pos0[2])<=2.0);
  xfils.forEach(xf=>{
    const uniq=[];let nd=0;
    (xf.edges||[]).forEach(se=>{
      if(uniq.some(u=>Math.abs((u.r||0)-(se.r||0))<1e-9
        &&Math.abs((u.len||0)-(se.len||0))<=Math.max(0.01,0.02*(se.len||0))
        &&Math.hypot(u.pos[0]-se.pos[0],u.pos[1]-se.pos[1],u.pos[2]-se.pos[2])<=0.75
        &&sameSel(u,se))){nd++;return;}
      uniq.push(se);
    });
    if(nd){xf.edges=uniq;warns.push(`${xf.name||lab} : ${nd} doublon(s) fusionné(s)`);}
  });
  const near=(a,b,tol)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<tol;
  const xNum=v=>String(+(+v).toFixed(2)).replace('.',','); // rayon/longueur : 16 et non 16,0
  const jobs=[],matchedSe=new Set(),seBi=new Map();
  const take=(bi,r,se,fnChain)=>{
    if(se){matchedSe.add(se);seBi.set(se,bi);if(!se.pos0)se.pos0=se.pos.slice(); // POSITION D'ORIGINE figée : c'est elle la référence durable
      se.pos=edges[bi].mid.slice();se.len=+edges[bi].len.toFixed(3);} // snapshot rafraîchi (repli plus tard)
    const dup=jobs.find(j=>j.bi===bi);
    // fn (V0.11.19) : normale de la première face d'un chanfrein asymétrique, portée par
    // l'entrée (ou par le germe pour une arête de chaîne)
    const fn=(se&&Array.isArray(se.fn))?se.fn:(fnChain||null);
    if(dup){dup.r=Math.max(dup.r,r);if(!dup.fn&&fn)dup.fn=fn;}else jobs.push({bi,r,fn});
  };
  xfils.forEach(xf=>{
    (xf.edges||[]).forEach(se=>{
      if(!(se.r>0))return;
      // Passe 0 : ancre absente (anciens projets avant persistance anchor) → recalée sur se.pos.
      // XY inchangé (changement de hauteur) : retrouve point/entité → passe 1 suit la cote/distance.
      if(!se.anchor){try{const a0=xAnchorFor(se.pos);if(a0)se.anchor=a0;}catch(e){}}
      // Passe 1 : ancre esquisse (test géométrique en 2D : suit points/lignes/cercles
      // déplacés + arêtes scindées en hauteur par les découpes).
      // La POSITION D'ORIGINE (pos0 = point cliqué) est la référence la plus fiable : une
      // sélection d'arête se fait d'un clic, donc à 0,75 mm près. On s'en sert pour RECADRER
      // les candidats de l'ancre : sans ce contrôle, une ancre d'esquisse qui dérive (mauvaise
      // entité, sketch rejoué sur un autre corps) fait Applying un congé sur une arête à
      // 15+ mm du clic, en silence (constaté : arête de 20 mm sélectionnée → arrondi tenté
      // sur une arête de 28,9 mm à 17,6 mm, le R demandé refusé à tort). On garde
      // l'ANCRAGE quand même (une arête peut légitimement s'être déplacée avec son sketch :
      // c'est tout l'intérêt de l'ancre), mais on refuse un candidat d'ancre qui est à plus de
      // 2 mm du clic ET dont la longueur s'écarte — sauf si c'est le SEUL candidat.
      const anchored=xAnchorMatch(se,edges);
      if(anchored.length){
        const ref=se.pos0&&se.pos0.length===3?se.pos0:se.pos;
        const dRef=i=>{const e=edges[i];return Math.hypot(e.mid[0]-ref[0],e.mid[1]-ref[1],e.mid[2]-ref[2]);};
        let best=-1,bd=1e9;
        anchored.forEach(i=>{const d=dRef(i);if(d<bd){bd=d;best=i;}});
        // Ancre « saine » : le meilleur candidat est au droit du clic.
        if(bd<=2.0){anchored.forEach(i=>take(i,se.r,se));return;}
        // Ancre « divergente » : l'arête est-elle encore là où l'utilisateur a cliqué ?
        // (On ne se fie PAS à se.len : ce champ est réécrit à chaque réappariement, il a donc
        //  pu hériter de la longueur d'une mauvaise arête — le critère fiable est la distance
        //  au clic, une sélection d'arête se fait à 0,75 mm près.)
        const born=[];
        edges.forEach((e,i)=>{if(dRef(i)<=2.0)born.push(i);});
        // … sauf si le CLIC lui-même n'est plus là où l'ancre le décrit (plan porteur de
        // l'esquisse décalé, entité déplacée) : c'est l'esquisse qui a emporté l'arête, l'ancre
        // fait foi, et l'arête « au droit du clic » est une étrangère — la jumelle de l'autre
        // flanc d'une nervure (Cavité Test, Plan 1 → 20 mm). Voir xAnchorStill (V0.11.22).
        if(born.length&&xAnchorStill(se)!==false){ // l'arête sélectionnée existe toujours → l'ancre a divergé, on l'ignore
          born.sort((a,b)=>dRef(a)-dRef(b));
          take(born[0],se.r,se);
          // Une seule ligne par divergence (le rejeu passe à chaque édition : inutile de
          // répéter le même avertissement 20 fois dans le journal).
          const clef=+bd.toFixed(1);
          if(se._div!==clef){se._div=clef;
            warns.push(`congé ${dp}${xNum(se.r)} : ancre d'esquisse divergente ignorée (pointait ${xNum(bd)} mm du clic) — arête sélectionnée rétablie`);}
          return;
        }
        anchored.forEach(bi=>take(bi,se.r,se));return;
      }
      // Passe 2 : MEILLEUR candidat unique (une sélection = UNE arête ; hit multiples →
      // positions réécrites en doublons + arêtes étrangères dans le lot d'arrondi).
      // Verticale : MÊME coin en XY (tol 3 mm — ignore Z/longueur : suit épaisseur).
      // Horizontale : plan Z de référence + longueur proche (avant : 10 mm XY + Z optionnel
      // acceptait les arêtes latérales du canal — cas « Sans titre »).
      const cands=[];
      edges.forEach((e,i)=>{
        const xyd=Math.hypot(e.mid[0]-se.pos[0],e.mid[1]-se.pos[1]);
        if(xyd>10.0)return; // préfilter local
        const p0=e.pts[0],p1=e.pts[e.pts.length-1];
        const dz=Math.abs(p1[2]-p0[2]),dxy=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);
        if(dz>dxy){
          if(xyd>3.0)return;
          cands.push({i,s:xyd+0.2*Math.min(Math.abs(e.mid[2]-se.pos[2]),10)+0.15*Math.min(Math.abs(e.len-se.len),20)});
          return;
        }
        let zref=se.pos[2];
        if(se.anchor&&se.anchor.t==='e'){
          const curDists=(doc.features||[]).filter(f=>f.type==='extrude'&&f.sketchId===se.anchor.sk&&f.visible!==false).map(f=>extrudeSpan(f));
          const zr=(se.anchor.z!==undefined&&se.anchor.z!==null)?se.anchor.z:se.pos[2];
          const cd=curDists[0]||{lo:0,hi:0};
          zref=(se.anchor.side!==undefined)?(se.anchor.side===0?cd.lo:cd.hi):(Math.abs(zr)<0.6?cd.lo:cd.hi);
        } else if(se.anchor&&se.anchor.t==='p'){
          return; // ancre point = verticales (passée 1)
        }
        if(Math.abs(e.mid[2]-zref)>1.5)return;
        if(se.len>0&&Math.abs(e.len-se.len)>Math.max(1.5,0.25*se.len))return;
        cands.push({i,s:xyd+0.2*Math.abs(e.mid[2]-zref)+0.15*Math.abs(e.len-se.len)});
      });
      if(cands.length){cands.sort((a,b)=>a.s-b.s);take(cands[0].i,se.r,se);}
    });
  });
  // Passe 2b : congé à TANGENCE PERSISTÉE (f.tangent) — UNE arête germe suffit : à chaque
  // rejeu la chaîne tangente est recalculée sur les arêtes du solide ACTUEL, exactement
  // comme xSelSync le fait à la création, mais rejouée. Une entrée déduite perdue se
  // rattache à la chaîne (par sa position d'origine), une arête APPARUE après édition amont
  // rejoint la bande avec le RAYON DU GERME : « tangence cochée sur une seule arête = toute
  // la chaîne, à chaque fois ». Les entrées sans drapeau seed (documents antérieurs) ne
  // déduisent rien : passe 1/2/3 se comportent comme avant.
  xfils.forEach(xf=>{
    if(!xf.tangent)return;
    const es=(xf.edges||[]).filter(se=>se.r>0);
    if(!es.length)return;
    const seeded=es.filter(se=>se.seed);
    const roots=(seeded.length?seeded:es).filter(se=>matchedSe.has(se)); // rétrocompat sans drapeau
    if(!roots.length)return;
    const chain=new Set();
    roots.forEach(se=>{const bi=seBi.get(se);if(bi==null)return;
      xTangentChainOf(edges,bi).forEach(j=>chain.add(j));});
    if(!chain.size)return;
    const hasJob=j=>jobs.some(job=>job.bi===j);
    // 1) entrées PERDUES se rattachent à la chaîne (ancre pos0, tol 60 mm — comme p0t)
    es.forEach(se=>{
      if(matchedSe.has(se))return;
      const ref=se.pos0&&se.pos0.length===3?se.pos0:se.pos;
      let best=-1,bd=60;
      chain.forEach(j=>{
        if(hasJob(j))return;
        const m=edges[j].mid;
        const d=Math.hypot(m[0]-ref[0],m[1]-ref[1],m[2]-ref[2]);
        if(d<bd){bd=d;best=j;}
      });
      if(best>=0)take(best,se.r,se);
    });
    // 2) arêtes de la chaîne SANS entrée → ajoutées AU CALCUL seulement, avec le rayon du germe
    //    le plus proche. 2026-10-16-015 : plus jamais enregistrées dans la fonction (avant :
    //    entrées « tangente » qui gonflaient la liste — une arête cliquée suffit).
    chain.forEach(j=>{
      if(hasJob(j))return;
      const m=edges[j].mid;
      const at=ref=>Math.hypot(ref[0]-m[0],ref[1]-m[1],ref[2]-m[2]);
      if(es.some(se=>at(se.pos0&&se.pos0.length===3?se.pos0:se.pos)<0.75))return; // doublon d'une entrée
      let bs=null,bd=1e9;
      roots.forEach(se=>{const d=at(se.pos0&&se.pos0.length===3?se.pos0:se.pos);if(d<bd){bd=d;bs=se;}});
      if(!bs)return;
      take(j,bs.r,null,Array.isArray(bs.fn)?bs.fn:null);
    });
  });
  // Passe 3 : signature de groupe pour orphelins (anciennes sélections déplacées).
  // Sûr : applique seulement si #candidats == #orphelins du groupe (bijection, même R).
  const orphans=[];
  xfils.forEach(xf=>(xf.edges||[]).forEach(se=>{if(se.r>0&&!matchedSe.has(se))orphans.push({se,xf});}));
  const groups=new Map();
  orphans.forEach(o=>{
    const k=Math.round(o.se.pos[2]*2)/2+'|'+o.se.r;
    if(!groups.has(k))groups.set(k,[]);
    groups.get(k).push(o);
  });
  groups.forEach(list=>{
    if(!list.length)return;
    const zref=list[0].se.pos[2],rr=list[0].se.r;
    const taken=new Set(jobs.map(j=>j.bi));
    const cands=[];
    // z tol large pour suivre l'épaisseur (haut/bas déplacés)
    const zTol=25;
    edges.forEach((e,i)=>{
      if(taken.has(i))return;
      if(Math.abs(e.mid[2]-zref)>zTol+10)return;
      cands.push(i);
    });
    if(cands.length===list.length&&cands.length>0){
      cands.forEach((bi,k)=>take(bi,list[k].se.r,list[k].se));
      warns.push(`boucle de ${cands.length} arête(s) retrouvée par signature (z≈${zref.toFixed(1)}, ${dp}${rr})`);
    }else{
      list.forEach(o=>warns.push(`${chamfer?'chanfrein':'congé'} ${dp}${o.se.r} : arête introuvable près de (${o.se.pos.map(v=>v.toFixed(1)).join(', ')}) — géométrie modifiée ? (re-sélectionnez la boucle)`));
    }
  });
  xfils.forEach(xf=>{
    const es=(xf.edges||[]).filter(se=>se.r>0);
    xf._m={m:es.filter(se=>matchedSe.has(se)).length,t:es.length};
    // position des arêtes PERDUES (non retrouvées dans la géométrie actuelle) : sans
    //elles, le panneau ne pouvait dire que « 6/8 » sans indiquer lesquelles.
    const manque=es.filter(se=>!matchedSe.has(se));
    if(manque.length)xf._miss=manque.map(se=>se.pos.map(v=>+v.toFixed(2)));
    else delete xf._miss;
  });
  if(!jobs.length)return{shape:base,warnings:warns};
  const js=jobs.map(j=>({src:edges[j.bi].src,r:j.r,mid:edges[j.bi].mid.slice(),fn:j.fn||null}));
  const single=(xfils||[]).length>0&&(xfils||[]).every(x=>x&&x.tangent===false); // case décochée : arête seule
  const cham=chamfer?xChamOpts((xfils||[]).find(x=>x&&x.chamfer)):null; // V0.11.19 : une fonction par appel
  const wA=[];
  // reprise déjà calculée sur ce même solide (rejeu puis affichage) : le calcul exact, qui
  // échouerait encore, n'est pas retenté (~0,3 s par congé)
  let rN=occNurbsMemoGet(occNurbsMemoKey(js,chamfer,single,edges,cham));
  // RÉSULTAT INVALIDE REFUSÉ (2026-10-27) : MakeFillet peut rendre « IsDone » un solide déchiré
  // (Cavité Test, nervure dépouillée de 25°, congé R3 d'une arête : faces et contours invalides,
  // −1 220 mm³, éclats triangulaires à l'écran). Contrôle LOCAL, faces dont la boîte touche la
  // zone des arêtes (~10 ms ; le corps entier coûtait 30 à 80 ms par congé et par rejeu).
  const zone=occFilletZone(jobs.map(j=>edges[j.bi]),Math.max.apply(null,js.map(j=>j.r)));
  // Zone DÉJÀ invalide avant le congé (corps hérité d'une reprise NURBS sur le corps entier,
  // Cavité Test à la longueur 70) : ce congé n'y est pour rien et n'est pas refusé.
  let invalide=false,baseSaine=null;
  const refuse=sh=>{
    if(!sh||occFacesValides(sh,zone))return false;
    if(baseSaine===null)baseSaine=occFacesValides(base,zone);
    if(!baseSaine)return false;
    invalide=true;try{sh.delete();}catch(e){}return true;
  };
  let s=rN?null:occFilletRun(base,js,wA,chamfer,{single,cham});
  if(refuse(s))s=null;
  if(!s&&!rN)rN=occFilletNurbs(base,js,chamfer,single,edges,cham);
  if(rN&&refuse(rN.shape))rN=null;
  if(rN){
    s=rN.shape;
    // les refus « isolé impossible » de la voie analytique ne concernent plus le résultat
    const qui=`${xfils.map(x=>x.name||lab).join(', ')} : ${lab} ${dp}${xNum(Math.min.apply(null,js.map(j=>j.r)))} refusé par le noyau sur les surfaces exactes — calculé en NURBS`;
    warns.push(rN.local
      ?`${qui} dans un bloc autour des arêtes, recollé au corps (faces de ce bloc en NURBS et scindées à son bord : esquisse sur ces faces et reconnaissance FAO peuvent en souffrir)`
      :`${qui} sur une copie du corps entier (faces de ce corps en NURBS à partir d'ici : esquisse sur face plane, reconnaissance FAO et cotes de cercles en aval peuvent ne plus fonctionner)`);
  }else warns.push(...wA);
  if(!s){
    // ÉCHEC : l'appli ne peut pas appliquer la fonction, mais « rouge + refus muet » est le
    // pire des messages. On cherche le plus grand rayon qui MARCHE (échelle descendante, chemin
    // d'échec rare) pour proposer une correction VÉRIFIÉE au lieu d'un « rayon trop grand ? ».
    const rMax=Math.min.apply(null,js.map(j=>j.r));
    const lMin=Math.min.apply(null,jobs.map(j=>edges[j.bi].len||0));
    const dl=lMin>0?` sur une arête de ${xNum(lMin)} mm`:'';
    // PAROI MINCE (2026-10-27) : l'arête la plus courte de la chaîne n'est souvent pas la cause.
    // Cavité Test après une dépouille trop forte : « arête de 0,73 mm trop courte » alors que la
    // nervure ne faisait plus que 1,2 mm d'épaisseur. Une paroi plus mince que 2 × R est nommée.
    let mince=null;
    if(!invalide){try{const w=occWallAt(base,jobs.map(j=>edges[j.bi]));if(w&&w.t<2*rMax)mince=w;}catch(e){mince=null;}}
    const pMince=mince?`paroi de ${xNum(+mince.t.toFixed(2))} mm seulement près de (${mince.p.map(v=>xNum(+v.toFixed(1))).join(' ; ')}) — une opération précédente l’a-t-elle amincie (dépouille…) ?`:null;
    let ok=null,okSh=null,kOk=0,kKo=1,ref=null,v0=null;
    try{v0=occCoqueVolume(base);}catch(e){v0=null;}
    const essai=k=>{
      const r2=Math.max(0.5,+(rMax*k).toFixed(2));
      const w2=[];
      const cham2=cham?Object.assign({},cham,{d2:+(cham.d2*k).toFixed(2)}):null; // D2 réduit dans le même rapport
      const t=occFilletRun(occShapeCopy(base),js.map(j=>({src:j.src,r:r2,mid:j.mid.slice(),fn:j.fn||null})),w2,chamfer,{single,cham:cham2});
      let bon=t&&(occFacesValides(t,zone)||baseSaine===false); // un rayon « vérifié » doit aussi donner un solide valide
      // VOLUME PLAUSIBLE (V0.44.1) : un congé « valide » peut être faux (slot de 12 mm, R6 :
      // +1 866 mm³ au lieu d'en retirer). La matière ôtée ou ajoutée croît comme r² : même sens
      // et pas plus de 1,5 × (r / r_réf)² fois l'écart du petit rayon de référence.
      if(bon&&v0!=null){
        let dv=null;try{dv=occCoqueVolume(t)-v0;}catch(e){dv=null;}
        if(dv!=null){
          if(!ref)ref={r:r2,dv};
          else if(Math.abs(ref.dv)>1e-6&&(dv*ref.dv<0&&Math.abs(dv)>1e-3*Math.abs(v0)||Math.abs(dv)>1.5*Math.abs(ref.dv)*(r2/ref.r)*(r2/ref.r)))bon=false;
        }
      }
      if(!bon){try{if(t)t.delete();}catch(e){}return false;}
      try{if(okSh)okSh.delete();}catch(e){}
      ok=r2;okSh=t;kOk=k;return true;
    };
    // V0.44.1 (OCCT 8 refuse les congés trop grands que l'ancien noyau laissait passer) : le plus
    // grand rayon qui passe est cherché (petit rayon de référence d'abord, puis échelle et 3
    // dichotomies) puis APPLIQUÉ, avec un ⚠ — la pièce se construit au lieu de rester bloquée.
    // Le rayon demandé reste enregistré : si la géométrie s'agrandit, il revient tout seul.
    if(essai(0.2)){
      const sh0=okSh,ok0=ok;okSh=null; // la référence reste la solution si rien de plus grand ne passe
      for(const k of [0.7,0.5,0.4,0.3]){if(essai(k))break;kKo=k;}
      if(okSh){try{sh0.delete();}catch(e){}for(let i=0;i<3;i++){const k=(kOk+kKo)/2;if(!essai(k))kKo=k;}}
      else{okSh=sh0;ok=ok0;}
    }
    if(okSh){
      const adj=`${dp}${xNum(rMax)} impossible ici${invalide?' (le noyau rend un solide déchiré)':''}${mince?' — '+pMince:''} — appliqué ${dp}${xNum(ok)}, le plus grand qui passe`;
      warns.push(`${lab} ${adj}`);
      xfils.forEach(xf=>{delete xf._err;xf._adj=adj;});
      try{base.delete();}catch(e){}
      return{shape:okSh,warnings:warns};
    }
    const why=chamfer?'distance trop grande':'rayon trop grand';
    const dechire=invalide?' : le noyau rend un solide déchiré (faces invalides), refusé':'';
    warns.push(`${lab} ${dp}${xNum(rMax)} impossible sur ${js.length} arête(s)${mince?'':dl}${dechire} — `+(mince?pMince:`${why} ou faces déjà consommées par un autre congé ?`)
      +(ok?` ESSAYEZ ${dp}${xNum(ok)} (vérifié)`:(mince?' Aucun rayon testé ne passe.':' — arête trop courte, aucun rayon testé ne passe')));
    const conseil=ok?`${dp}${xNum(rMax)} impossible${mince?' — '+pMince:dl}${dechire} — essayez ${dp}${xNum(ok)} (vérifié)`
      :mince?`${dp}${xNum(rMax)} impossible — ${pMince}`
      :`${dp}${xNum(rMax)} impossible${dl}${dechire} — arête trop courte ou faces déjà consommées par un autre congé`;
    xfils.forEach(xf=>{xf._err=conseil;delete xf._adj;});
    return{shape:base,warnings:warns};
  }
  xfils.forEach(xf=>{delete xf._err;delete xf._adj;}); // plus d'erreur : le rayon courant passe
  try{base.delete();}catch(e){}
  return{shape:s,warnings:warns};
}
function occWallAt(shape,eds){
  // Épaisseur de matière mesurée DEPUIS des arêtes (2026-10-27) : de quelques points de chaque
  // arête, un rayon part vers l'intérieur de chaque face plane qui la borde (−normale sortante)
  // et la première sortie du solide donne l'épaisseur dans cette direction. Au pied d'une
  // nervure, le flanc donne l'épaisseur de la nervure, le fond celle du fond : on garde la plus
  // petite. → {t, p} ou null. Faces non planes ignorées (normale variable).
  const bin=[];let best=null;
  try{
    const P=[];
    const ex=occBinPush(bin,new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE));
    for(;ex.More();ex.Next()){
      const f=occBinPush(bin,occt.TopoDS.Face_1(ex.Current()));
      const ad=occBinPush(bin,new occt.BRepAdaptor_Surface_2(f,true));
      if(ad.GetType()!==occt.GeomAbs_SurfaceType.GeomAbs_Plane)continue;
      const n=occFaceOutNormal(f);if(!n)continue;
      const L=occBinPush(bin,ad.Plane().Location()),b=occFaceBox(f);
      P.push({f,n,o:[L.X(),L.Y(),L.Z()],c:b?b.pos:null});
    }
    const I=occBinPush(bin,new occt.IntCurvesFace_ShapeIntersector());I.Load(shape,1e-6);
    for(const e of eds){
      const pts=(e&&e.pts)||[];if(!pts.length)continue;
      const pick=pts.length<=3?pts:[0.2,0.5,0.8].map(k=>pts[Math.round(k*(pts.length-1))]);
      for(const p of pick){
        let vx=null;
        for(const F of P){
          // sur le plan de la face, puis DANS la face (distance au sommet) : face qui borde l'arête
          if(Math.abs((p[0]-F.o[0])*F.n[0]+(p[1]-F.o[1])*F.n[1]+(p[2]-F.o[2])*F.n[2])>1e-3)continue;
          if(!vx){const mv=occBinPush(bin,new occt.BRepBuilderAPI_MakeVertex(occBinPush(bin,new occt.gp_Pnt_3(p[0],p[1],p[2]))));vx=mv.Vertex();bin.push(vx);}
          const dd=occFaceDist(vx,F.f);if(!dd||dd.d>1e-3||!F.c)continue;
          // départ décalé de 0,05 mm DANS la face, vers son centre : lancé depuis l'arête même, le
          // rayon longerait la face voisine (intersections dégénérées)
          const v=[F.c[0]-p[0],F.c[1]-p[1],F.c[2]-p[2]],vn=v[0]*F.n[0]+v[1]*F.n[1]+v[2]*F.n[2];
          for(let k=0;k<3;k++)v[k]-=vn*F.n[k];
          const lv=Math.hypot(v[0],v[1],v[2]);if(!(lv>1e-6))continue;
          const s=Math.min(0.05,lv)/lv,q=[p[0]+v[0]*s,p[1]+v[1]*s,p[2]+v[2]*s];
          const lin=occBinPush(bin,new occt.gp_Lin_3(occBinPush(bin,new occt.gp_Pnt_3(q[0],q[1],q[2])),occBinPush(bin,new occt.gp_Dir_4(-F.n[0],-F.n[1],-F.n[2]))));
          I.Perform_1(lin,1e-3,1e4);
          if(!I.IsDone())continue;
          let t=Infinity;for(let k=1;k<=I.NbPnt();k++){const w=I.WParameter(k);if(w>1e-3&&w<t)t=w;}
          if(isFinite(t)&&(!best||t<best.t))best={t,p:p.slice()};
        }
      }
    }
  }catch(e){best=null;}finally{occDispose(bin);}
  return best;
}
function occFilletZone(eds,r){
  // Boîte des arêtes d'un congé (points échantillonnés) gonflée de R + 1 mm → {lo, hi}
  const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9],m=(+r||0)+1;
  (eds||[]).forEach(e=>((e&&e.pts&&e.pts.length)?e.pts:(e&&e.mid?[e.mid]:[])).forEach(q=>{
    for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],q[k]-m);hi[k]=Math.max(hi[k],q[k]+m);}}));
  return{lo,hi};
}
function occFacesValides(sh,zone){
  // Faces du solide dont la boîte touche la zone : chacune passe BRepCheck seule (contours,
  // arêtes, sommets). Les grandes faces voisines modifiées par l'arrondi la touchent aussi.
  // Doute (exception, zone vide) → valide : ce contrôle ne doit jamais refuser à tort.
  if(!sh||!zone||!(zone.hi[0]>=zone.lo[0]))return true;
  const bin=[];
  try{
    const ex=occBinPush(bin,new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE));
    for(;ex.More();ex.Next()){
      const f=occBinPush(bin,occt.TopoDS.Face_1(ex.Current()));
      const b=occBinPush(bin,new occt.Bnd_Box_1());occt.BRepBndLib.Add(f,b,false);
      const a=occBinPush(bin,b.CornerMin()),z=occBinPush(bin,b.CornerMax());
      const A=[a.X(),a.Y(),a.Z()],Z=[z.X(),z.Y(),z.Z()];
      if(![0,1,2].every(k=>Z[k]>=zone.lo[k]&&A[k]<=zone.hi[k]))continue;
      const C=occBinPush(bin,new occt.BRepCheck_Analyzer(f,true));
      if(!C.IsValid_2())return false;
    }
    return true;
  }catch(e){return true;}finally{occDispose(bin);}
}
function occFilletNurbs(base,js,chamfer,single,edges,cham){
  // REPRISE DE DERNIER RECOURS (2026-10-26) : le même arrondi sur des surfaces converties en
  // NURBS (BRepBuilderAPI_NurbsConvert). Cavité Test : le congé R3,3 au pied de la nervure
  // ne passait qu'à la longueur 80 du bloc — 70, 79, 81, 100, même RETOUR à 80 : exception dans
  // BRepFilletAPI_MakeFillet. Les deux solides découpés autour de la nervure étaient identiques
  // à 1e-8 mm (sommets, arêtes, tolérances) : seul le PARAMÉTRAGE des surfaces analytiques
  // diffère (origine du cylindre R10 qui suit le bout de poche). ShapeFix, UnifySameDomain,
  // tolérances, régularité, forme de congé, SetParams, germe, rayon ±1e-5..0,6 : rien n'y fait ;
  // en NURBS l'arrondi passe partout.
  // 1) LOCALE : seul un bloc autour de la chaîne (boîte des arêtes + R + 1 mm) est converti et
  //    arrondi, puis recollé au reste du corps resté analytique (fusion en mode collage). Le corps
  //    entier en NURBS coûtait 6,8 s de conversion par congé (rejeu Cavité Test 2,9 → 12..20 s) ;
  //    ici ~0,8 s, volume ajouté 38,58 mm³ contre 38,66 pour le congé exact à 80. Garde-fous :
  //    les faces de coupe du bloc doivent sortir intactes de l'arrondi (sinon il a débordé du
  //    bloc), le recollage doit rendre un solide valide, de même nombre de solides, au bilan de
  //    faces exact (voir plus bas).
  // 2) CORPS ENTIER si la reprise locale échoue (lent, tout le corps reste NURBS en aval) —
  //    Cavité Test à 70 : le bloc englobe les raccords BSpline des coins de poche et le découpage
  //    échoue quelle que soit la marge (r+1, r+1,37, r+2,13 essayées).
  // Mesures Cavité Test (rejeu après la cote) : exact à 80 ≈ 3 s ; reprise locale ≈ 7 s puis
  // 2,5 s (mémoire) ; corps entier ≈ 18 s.
  // → {shape,local} ou null. Arêtes relocalisées par leur milieu (index changés par la conversion).
  const nSol=sh=>{let n=0;try{const x=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_SOLID,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);while(x.More()){n++;x.Next();}x.delete();}catch(e){}return n;};
  const del=(...l)=>l.forEach(h=>{try{if(h)h.delete();}catch(e){}});
  const filletNurbs=sh=>{
    let nb=null;
    try{
      const nc=new occt.BRepBuilderAPI_NurbsConvert_2(sh,false);
      try{nb=occShapeCopy(nc.Shape());}finally{del(nc);}
      if(!nb||nb.IsNull())return null;
      const E=occListEdges(nb),js2=[];
      for(const j of js){
        let b=null,bd=1e-3;
        E.forEach(e=>{const d=Math.hypot(e.mid[0]-j.mid[0],e.mid[1]-j.mid[1],e.mid[2]-j.mid[2]);if(d<bd){bd=d;b=e;}});
        if(!b){del(nb);return null;}
        js2.push({src:b.src,r:j.r,mid:j.mid.slice(),fn:j.fn||null});
      }
      const w=[];
      // LOT SEUL (2026-10-27) : la passe arête par arête sur des surfaces NURBS peut FIGER le
      // noyau (Cavité Test, congé voisin R10 → R8 : un MakeFillet.Build sur la chaîne R3,3 ne
      // rend jamais la main) ; et un résultat partiel serait refusé juste après de toute façon.
      const s=occFilletRun(nb,js2,w,chamfer,{single,cham,lot:true});
      // résultat PARTIEL (arête par arête) refusé : la reprise doit rendre la fonction entière
      if(!s||w.some(m=>/partiel|impossible|introuvable/.test(m))){if(s&&s!==nb)del(s);del(nb);return null;}
      if(s!==nb)del(nb);
      return s;
    }catch(e){del(nb);return null;}
  };
  const local=()=>{
    const bin=[];
    try{
      const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
      js.forEach(j=>{const e=(edges||[]).find(x=>x.src===j.src);(e?e.pts:[j.mid]).forEach(q=>{for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],q[k]);hi[k]=Math.max(hi[k],q[k]);}});});
      const m=Math.max.apply(null,js.map(j=>j.r))+1;
      for(let k=0;k<3;k++){lo[k]-=m;hi[k]+=m;}
      const bx=occBinPush(bin,new occt.BRepPrimAPI_MakeBox_3(occBinPush(bin,new occt.gp_Pnt_3(lo[0],lo[1],lo[2])),occBinPush(bin,new occt.gp_Pnt_3(hi[0],hi[1],hi[2])))).Shape();
      // UNE passe (Splitter : corps coupé par le bloc, solides triés dedans / dehors) au lieu de
      // Common + Cut — deux booléens sur le corps entier, ~0,6 s chacun
      let loc=null,rest=null;const tri=Math.min(0.5,m/4);
      try{
        const L1=occBinPush(bin,new occt.TopTools_ListOfShape_1());L1.Append_1(base);
        const L2=occBinPush(bin,new occt.TopTools_ListOfShape_1());L2.Append_1(bx);
        const SP=occBinPush(bin,new occt.BRepAlgoAPI_Splitter_1());SP.SetArguments(L1);SP.SetTools(L2);
        try{SP.Build();}catch(e){SP.Build(new occt.Message_ProgressRange());}
        if(SP.IsDone()){
          const ins=[],out=[];
          const x=occBinPush(bin,new occt.TopExp_Explorer_2(SP.Shape(),occt.TopAbs_ShapeEnum.TopAbs_SOLID,occt.TopAbs_ShapeEnum.TopAbs_SHAPE));
          while(x.More()){const so=x.Current();const bb=new occt.Bnd_Box_1();occt.BRepBndLib.Add(so,bb,false);
            const q=bb.CornerMin(),z=bb.CornerMax(),A=[q.X(),q.Y(),q.Z()],Z=[z.X(),z.Y(),z.Z()];bb.delete();
            // boîte OCCT gonflée (tolérances, pôles des BSplines) : marge de tri m/4 — un solide
            // du dehors déborde du bloc de toute la taille du corps, pas de quelques dixièmes
            ([0,1,2].every(k=>A[k]>=lo[k]-tri&&Z[k]<=hi[k]+tri)?ins:out).push(occBinPush(bin,occShapeCopy(so)));x.Next();}
          if(ins.length&&out.length){loc=occCompoundOf(ins);rest=occCompoundOf(out);if(ins.length>1)bin.push(loc);if(out.length>1)bin.push(rest);}
        }
      }catch(e){loc=rest=null;}
      if(!loc||!rest){loc=occBinPush(bin,occCommon(base,bx));rest=occBinPush(bin,occCut(base,bx));}
      // aire des faces posées sur les plans du bloc (faces de coupe) : l'arrondi ne doit pas les toucher
      const coupe=sh=>{let a=0;const x=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
        while(x.More()){const f=occt.TopoDS.Face_1(x.Current());const G=new occt.GProp_GProps_1();occt.BRepGProp.SurfaceProperties_1(f,G,false,false);
          const c=G.CentreOfMass(),q=[c.X(),c.Y(),c.Z()];
          if([0,1,2].some(k=>Math.abs(q[k]-lo[k])<1e-6||Math.abs(q[k]-hi[k])<1e-6))a+=G.Mass();
          G.delete();x.Next();}
        x.delete();return a;};
      const f=filletNurbs(loc);if(!f){refusNurbs=true;return null;}bin.push(f);
      const a0=coupe(loc),a1=coupe(f);
      if(!(Math.abs(a1-a0)<=1e-6*Math.max(1,a0)))return null; // l'arrondi a débordé du bloc
      let g=null;
      try{
        const L1=occBinPush(bin,new occt.TopTools_ListOfShape_1());L1.Append_1(rest);
        const L2=occBinPush(bin,new occt.TopTools_ListOfShape_1());L2.Append_1(f);
        const F=occBinPush(bin,new occt.BRepAlgoAPI_Fuse_1());F.SetArguments(L1);F.SetTools(L2);
        F.SetGlue(occt.BOPAlgo_GlueEnum.BOPAlgo_GlueShift); // le bloc et le reste ne se touchent que par les faces de coupe
        try{F.Build();}catch(e){F.Build(new occt.Message_ProgressRange());}
        if(F.IsDone())g=occShapeCopy(F.Shape());
      }catch(e){g=null;}
      // BILAN DE FACES : en collage, recollé = reste + bloc − faces de coupe (des deux côtés).
      // Marge large mesurée : 49 faces au lieu de 53 et +2 375 mm³ d'un solide pourtant « valide ».
      // Pas de bilan de volume (intégrer le corps entier coûtait 7 s par rejeu) ni d'unification
      // (UnifySameDomain a déformé un recollage : +1,19 mm³) — faces scindées au bord du bloc.
      const nF=sh=>{let n=0;const x=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);while(x.More()){n++;x.Next();}x.delete();return n;};
      const nCaps=sh=>{let n=0;const x=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
        while(x.More()){const bb=new occt.Bnd_Box_1();occt.BRepBndLib.Add(x.Current(),bb,false);const q=bb.CornerMin(),z=bb.CornerMax(),A=[q.X(),q.Y(),q.Z()],Z=[z.X(),z.Y(),z.Z()];
          if([0,1,2].some(k=>[lo[k],hi[k]].some(c=>Math.abs(A[k]-c)<1e-4&&Math.abs(Z[k]-c)<1e-4)))n++;
          bb.delete();x.Next();}
        x.delete();return n;};
      const sain=sh=>!!sh&&nF(sh)===nF(rest)+nF(f)-nCaps(rest)-nCaps(f)&&nSol(sh)===nSol(base)&&occCoqueValide(sh);
      if(sain(g))return g;
      // collage refusé (Cavité Test à 70 : 2 solides, invalide) → fusion ordinaire
      del(g);g=null;try{g=occFuse(rest,f);}catch(e){g=null;}
      if(sain(g))return g;
      del(g);return null;
    }catch(e){return null;}finally{occDispose(bin);}
  };
  // MÉMOIRE : le rejeu puis l'affichage (occFinalShape) rejouent le même congé sur le même
  // solide — chaque reprise (~1,5 s) était payée deux fois. Clé : arêtes demandées (milieu,
  // rayon), nombre d'arêtes du corps et somme de leurs longueurs ; résultat rendu en copie.
  const key=occNurbsMemoKey(js,chamfer,single,edges,cham);
  const hit=occNurbsMemoGet(key);if(hit)return hit;
  // PAS DE CORPS ENTIER quand l'arrondi NURBS a déjà échoué sur le bloc (2026-10-27) : la cause
  // est l'arrondi lui-même, pas le découpage, et le corps entier ne fait pas mieux — pire, Cavité
  // Test avec le congé voisin passé de R10 à R8 : la chaîne R3,3 y FIGE le noyau (un
  // MakeFillet.Build arête par arête ne rend jamais la main, onglet bloqué). La fonction
  // reçoit alors son _err « impossible » comme tout congé refusé.
  let refusNurbs=false;
  const g=local();
  const r=g?{shape:g,local:true}:refusNurbs?null:(()=>{const s=filletNurbs(base);return s?{shape:s,local:false}:null;})();
  if(r){const c=occShapeCopy(r.shape);if(c){OCC_NURBS_MEMO.unshift({key,shape:c,local:r.local});
    while(OCC_NURBS_MEMO.length>8){const o=OCC_NURBS_MEMO.pop();try{o.shape.delete();}catch(e){}}}}
  return r;
}
const OCC_NURBS_MEMO=[]; // reprises NURBS récentes {key, shape, local} (voir occFilletNurbs)
function occNurbsMemoKey(js,chamfer,single,edges,cham){
  return (chamfer?'C':'F')+(single?'1':'t')+(cham?'|'+xChamKey(cham):'')+'|'+(edges||[]).length+'|'+(edges||[]).reduce((a,e)=>a+e.len,0).toFixed(6)
    +'|'+js.map(j=>j.mid.map(v=>v.toFixed(5)).join(',')+'@'+j.r).join(';');
}
function occNurbsMemoGet(key){
  const hit=OCC_NURBS_MEMO.find(o=>o.key===key);if(!hit)return null;
  const c=occShapeCopy(hit.shape);return c?{shape:c,local:hit.local}:null;
}
function occXDefl(){
  // Finesse adaptative : les petits rayons exigent une déflection fine pour un aspect lisse.
  let mr=1e9;
  doc.features.filter(x=>x.type==='xfillet'&&x.visible!==false).forEach(xf=>(xf.edges||[]).forEach(se=>{if(se.r>0&&se.r<mr)mr=se.r;}));
  if(!(mr<1e9))return{lin:0.5,ang:0.5};
  return{lin:Math.min(0.5,Math.max(0.04,mr/10)),ang:0.25};
}
const OCC_DISPLAY_TRIS=400000; // budget de triangles d'AFFICHAGE (la FAO a les siens)
function occDisplayDefl(shape){
  // Déflection d'AFFICHAGE, commune au natif et aux imports : même maillage ⇒ même
  // normales lissées (smoothNormals 35°) ⇒ même ombrage faces/surfaces des deux côtés.
  // • linéaire proportionnel à la taille de la pièce (0,05 à 0,35 mm) : la finesse ne
  //   dépend plus de la présence d'un congé, elle suit l'objet réel ;
  // • angulaire 0,2 rad (~11°) au lieu de 0,5 rad (~29°) : les cercles/cylindres
  //   cessent d'être des polygones visibles.
  // CALIBRÉ sur le banc d'attente (bench_phase5, three.js réel, pièce 10 fonctions) :
  //   0,3/0,25 (avant) 5 300 tris / 176 ms  ·  0,1/0,2 8 500 tris / 242 ms
  //   0,04/0,2 12 100 tris / 300 ms  →  dg/1600 plafonne le surcoût de rejeu à ~+60 ms
  //   (+12 % de l'attente après modification) pour un gain net : cercles lisses et
  //   congés 3× plus fins qu'auparavant. Plus fin que dg/1600 coûte le double pour
  //   presque plus rien à l'écran.
  // NE PAS UTILISER pour l'outillage : occXDefl() reste la référence FAO (inchangée).
  let dg=100;
  try{const b=occSolidBox(shape);if(b&&b.dg>0)dg=b.dg;}catch(e){}
  return{lin:Math.min(0.35,Math.max(0.05,dg/1600)),ang:0.2};
}
function occTessellateBudget(shape,D,maxTris,countFn){
  // Tessellation d'affichage BORNÉE : si la définition voulue sortir trop de triangles,
  // on repasse en grossier (au plus deux paliers, D muté pour la suite du rejeu) - le
  // temps d'attente après modification reste prévisible quel que soit le fichier.
  // countFn : sonde optionnelle de comptage (le harnais Node n'a pas de compteurs
  // d'attributs THREE) ; par défaut on lit g.attributes.position.count.
  let g=null;
  for(let k=0;k<3;k++){
    try{g=occTessellate(shape,D.lin,D.ang);}catch(e){return null;}
    let n=0;
    if(typeof countFn==='function'){try{n=+countFn(g)||0;}catch(e){n=0;}}
    else{try{n=(g&&g.attributes&&g.attributes.position)?(Number(g.attributes.position.count)||0):0;}catch(e){n=0;}}
    if(!maxTris||n/3<=maxTris)return g;
    try{if(g&&g.dispose)g.dispose();}catch(e){}
    g=null;
    D.lin=Math.min(0.5,D.lin*4);D.ang=Math.min(0.6,D.ang*2);
    if(D.lin>=0.5&&D.ang>=0.6)break;
  }
  return g;
}
