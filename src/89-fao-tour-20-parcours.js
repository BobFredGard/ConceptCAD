/* ═══ Tournage : trajectoires (V1.2.7) ═══
   Coordonnées (z, x) : z le long de l'axe (0 = face avant de la pièce finie),
   x = RAYON (le programme écrit le diamètre). Les mouvements rendus sont ceux du
   POINT PROGRAMMÉ de l'outil :
   - plaquette : coin théorique (z = centre du bec − rε, x = centre − rε), celui
     que la machine mesure quand on touche une face puis un diamètre ;
   - foret : la pointe, sur l'axe ;
   - lame de tronçonnage : son coin AVANT (côté pièce), en bas.
   Mouvement : {rap:1|0, z, x, arc?:{cz,cx,R,cw}} — cw vu Z à droite, X en haut.

   Calcul : pour chaque position z du CENTRE du bec, le rayon le plus bas où la
   plaquette entière (bec + deux arêtes) ne touche pas le profil (« contrainte »).
   La finition suit cette contrainte et retrouve les vraies lignes et les vrais
   arcs du profil décalé (G1 / G2 / G3) ; là où les arêtes de la plaquette
   empêchent de descendre (creux trop raide), elle passe au-dessus et le dit. */

function tourInsertGeo(t,s){
  // Plaquette : bec de rayon rε (+ surépaisseur s), arête principale à κ de l'avance
  // (vers −Z), arête secondaire à ε de la première. Centre du bec en (0, 0).
  const D=Math.PI/180;
  const re=Math.max(0.01,+t.re||0.4)+(s>0?s:0);
  const eps=Math.max(20,Math.min(100,+t.eps||80))*D, kap=Math.max(60,Math.min(120,+t.kap||95))*D;
  const l=Math.max(2,+t.l||12);
  const d1=[-Math.cos(kap),Math.sin(kap)];
  const d2=[d1[0]*Math.cos(eps)+d1[1]*Math.sin(eps),-d1[0]*Math.sin(eps)+d1[1]*Math.cos(eps)];
  const bl=Math.hypot(d1[0]+d2[0],d1[1]+d2[1]), b=[(d1[0]+d2[0])/bl,(d1[1]+d2[1])/bl];
  const k=re/Math.sin(eps/2), V=[-b[0]*k,-b[1]*k], tt=re/Math.tan(eps/2);
  const T1=[V[0]+d1[0]*tt,V[1]+d1[1]*tt], T2=[V[0]+d2[0]*tt,V[1]+d2[1]*tt];
  const A1=[V[0]+d1[0]*l,V[1]+d1[1]*l], A2=[V[0]+d2[0]*l,V[1]+d2[1]*l];
  const F=[V[0]+(d1[0]+d2[0])*l,V[1]+(d1[1]+d2[1])*l];
  const a1=Math.atan2(T1[1],T1[0]), a2=a1+(Math.PI-eps);
  const edges=[[T2,A2],[A2,F],[F,A1],[A1,T1]];
  const poly=[];
  for(let i=0;i<=16;i++){ const a=a1+(a2-a1)*i/16; poly.push([re*Math.cos(a),re*Math.sin(a)]); }
  poly.push(A2,F,A1);
  let x0=1/0,x1=-1/0; poly.forEach(function(p){ if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; });
  const E=edges.map(function(e){ const p=e[0],q=e[1]; return {lo:Math.min(p[0],q[0]),hi:Math.max(p[0],q[0]),
    p:p,q:q,m:Math.abs(q[0]-p[0])>1e-12?(q[1]-p[1])/(q[0]-p[0]):null}; });
  // dz où le point BAS du bec est sur l'arc du bec
  const low=function(dz){
    let v=1/0;
    if(dz>=-re&&dz<=re){
      const y=-Math.sqrt(Math.max(0,re*re-dz*dz));
      if(tourAngIn(Math.atan2(y,dz),a1,a2))v=y;
    }
    for(let i=0;i<4;i++){ const e=E[i];
      if(dz<e.lo-1e-12||dz>e.hi+1e-12)continue;
      const y=e.m===null?Math.min(e.p[1],e.q[1]):e.p[1]+e.m*(dz-e.p[0]);
      if(y<v)v=y; }
    return v;
  };
  const lowNose=function(dz){ return (dz>=-re&&dz<=re)?-Math.sqrt(Math.max(0,re*re-dz*dz)):1/0; };
  return {re:re,poly:poly,x0:x0,x1:x1,low:low,lowNose:lowNose};
}
function tourProfilePts(M,zEnd,ext){
  // Nuage du profil, la face arrière remplacée par un prolongement horizontal
  // (la pièce continue dans la barre jusqu'au tronçonnage).
  const L=M.L, out=[];
  let rBack=0;
  M.pts.forEach(function(p){ if(p[0]>-L+1e-6)out.push(p); });
  // rayon au ras de la face arrière
  out.forEach(function(p){ if(p[0]<=-L+0.02&&p[1]>rBack)rBack=p[1]; });
  if(!(rBack>0))rBack=Math.max(0,tourElemsEvalTop(M.elems,-L+0.01));
  const z1=Math.min(zEnd,-L)-Math.max(1,ext||0);
  for(let z=-L;z>=z1;z-=0.01)out.push([z,rBack]);
  return out;
}
function tourConstraint(pts,geo,zTop,zBot,h,dr,bz){
  // C[i] = rayon mini du centre du bec à z = zTop − i·h (−Infinity = rien sous l'outil)
  const N=Math.max(2,Math.floor((zTop-zBot)/h+1e-9)+1);
  // un point par case de 0,0002 mm en z (le plus haut) : les points d'une même face verticale se
  // dominent ; une case plus large perdrait les points bas d'une pente raide (bec trop enfoncé)
  const hb=2e-4;
  const mp=new Map();
  pts.forEach(function(p){ const k=Math.round(p[0]/hb), e=mp.get(k); if(!e||p[1]>e[1])mp.set(k,p); });
  const P=Array.from(mp.values()).sort(function(a,b){return b[0]-a[0];});
  const PZ=new Float64Array(P.length), PR=new Float64Array(P.length);
  P.forEach(function(p,i){ PZ[i]=p[0]; PR[i]=p[1]; });
  const lowB=bz>0?function(dz){ let v=1/0; for(let j=0;j<=4;j++){ const w=geo.low(dz-bz+bz*j/2); if(w<v)v=w; } return v; }:geo.low;
  const C=new Float64Array(N), CN=new Float64Array(N);
  let j0=0;
  const zmin=geo.x0-bz, zmax=geo.x1+bz;
  for(let i=0;i<N;i++){
    const zi=zTop-i*h, hi=zi+zmax, lo=zi+zmin;
    while(j0<P.length&&PZ[j0]>hi)j0++;
    let c=-1/0, cn=-1/0;
    for(let j=j0;j<P.length&&PZ[j]>=lo;j++){
      const dz=PZ[j]-zi;
      const w=lowB(dz);
      if(w<1/0){ const v=PR[j]+dr-w; if(v>c)c=v; }
      const wn=geo.lowNose(dz);
      if(wn<1/0){ const v=PR[j]+dr-wn; if(v>cn)cn=v; }
    }
    C[i]=c; CN[i]=cn;
  }
  return {zTop:zTop,h:h,N:N,C:C,CN:CN};
}
function tourOpTool(setup,op){ return tourToolById(setup,op.toolId)||tourToolFor(setup,op.type,tourOpCote(op)); }
function tourCut(setup,op){
  const t=tourOpTool(setup,op)||{};
  const vc=(isFinite(+op.vc)&&+op.vc>0)?+op.vc:(+t.vc>0?+t.vc:150);
  let f=(isFinite(+op.f)&&+op.f>0)?+op.f:(+t.f>0?+t.f:0.1), D=0;
  if(op.type==='tour_thread'){ const th=tourOpGen(setup,op).thread; f=th?th.P:f; D=th?th.D:0; } // avance = pas, broche constante au Ø du filet
  return {vc:vc,f:f,t:t,D:D};
}
// Ø qui fixe la vitesse de broche : foret et filetage à vitesse constante (G97), sinon le Ø coupé (G96)
function tourSpinD(cut,x){ const t=cut.t||{}; if(t.kind==='tdrill'||t.kind==='ldrill')return Math.max(0.5,+t.d||10); if(cut.D>0)return cut.D; return Math.max(1,2*Math.abs(x)); }
function tourFrontZ(setup,op){
  // surface avant de la matière quand l'opération commence : dressée par un
  // Dressage actif placé avant, sinon celle du brut
  const S=tourStock(setup); let z=S.face;
  const ops=setup.ops||[];
  for(let i=0;i<ops.length&&ops[i]!==op;i++){ const o=ops[i]; if(o&&o.on!==false&&o.type==='tour_face')z=Math.min(z,Math.max(0,+o.laisse||0)); }
  return z;
}
function tourSafe(setup){ const S=tourStock(setup), C=tourCfg(setup); return {x:S.R+C.clrX, z:S.face+C.clrZ}; }

/* ----- opérations ----- */
function tourGenFace(setup,op){
  const S=tourStock(setup), sf=tourSafe(setup), t=tourOpTool(setup,op), re=+t.re||0.4;
  const zf=Math.max(0,+op.laisse||0), ap=Math.max(0.05,+op.ap||1);
  const mv=[], W=[];
  if(t.kind!=='turn')W.push('outil de dressage : prendre une plaquette');
  const span=S.face-zf;
  const n=Math.max(1,Math.ceil(span/ap-1e-9));
  const xe=-(re+0.1); // le bec passe le centre
  mv.push({rap:1,z:sf.z,x:sf.x});
  for(let k=1;k<=n;k++){
    const z=span>1e-9?S.face-span*k/n:zf;
    mv.push({rap:1,z:z,x:sf.x});
    mv.push({rap:0,z:z,x:xe});
    mv.push({rap:0,z:z+0.5,x:xe});
    mv.push({rap:1,z:z+0.5,x:sf.x});
  }
  mv.push({rap:1,z:sf.z,x:sf.x});
  return {moves:mv,warns:W,info:n+' passe'+(n>1?'s':'')+' de '+(+(span/n).toFixed(3))+' mm jusqu’à Z'+(+zf.toFixed(3))};
}
/* ----- contexte d'usinage : extérieur, ou intérieur vu en MIROIR -----
   L'intérieur (alésage) se calcule comme l'extérieur dans le repère (z, −r) : la paroi
   devient un profil avec la pièce DESSOUS, la barre d'alésage une plaquette ordinaire,
   l'axe (le trou percé) le côté dégagé. Les mouvements sont rendus au repère réel
   (x → −x, sens des arcs inversé) par tourCtxBack. */
function tourMirrorElems(E){
  return E.map(function(e){ const o={t:e.t,z1:e.z1,r1:-e.r1,z2:e.z2,r2:-e.r2};
    if(e.t==='A'){ o.cz=e.cz; o.cr=-e.cr; o.R=e.R; o.ccw=!e.ccw; } return o; });
}
function tourHoleR(setup,op){
  // trou déjà là quand l'opération commence : le plus grand foret actif placé avant
  // {r, depth (au Ø plein, depuis la face avant)} ; ou le brut d'une reprise
  let r=0, depth=0;
  const ops=setup.ops||[];
  for(let i=0;i<ops.length&&ops[i]!==op;i++){
    const o=ops[i]; if(!o||o.on===false||o.type!=='tour_drill')continue;
    const t=tourOpTool(setup,o); if(!t||t.kind!=='tdrill')continue;
    const g=tourOpGen(setup,o); let zt=0; g.moves.forEach(function(m){ if(m.z<zt)zt=m.z; });
    const d=Math.max(0.5,+t.d||10), half=Math.max(30,Math.min(90,(+t.ang||118)/2))*Math.PI/180, tip=(d/2)/Math.tan(half);
    if(d/2>r){ r=d/2; depth=-zt-tip; }
  }
  const SP=tourStockProfile(setup);
  if(SP&&SP.rin0>r){ r=SP.rin0; depth=SP.rinDepth; }
  return {r:r,depth:depth};
}
function tourCtx(setup,op){
  const M=tourModel(setup); if(!M||!M.ok)return {err:(M&&M.warns&&M.warns[0])||'profil introuvable',M:M};
  const S=tourStock(setup), sf=tourSafe(setup);
  const zS=tourFrontZ(setup,op);
  if(op.cote!=='int'){
    const zEnd=tourZEnd(setup,op);
    return {M:M,inner:false,top:S.R,topAt:tourStockTopFn(setup),safe:sf,zS:zS,zEnd:zEnd,floor:null,src:M.src,
      pts:function(ext){ return tourProfilePts(M,zEnd,ext); },
      cand:function(ext){
        // profil prolongé (pour les candidats) : face arrière remplacée par l'horizontale
        const E=[];
        M.elems.forEach(function(e){ if(Math.min(e.z1,e.z2)<-M.L+1e-6&&Math.abs(e.z1-e.z2)<1e-9)return; E.push(e); });
        if(E.length){ const e=E[E.length-1]; E.push({t:'L',z1:e.z2,r1:e.r2,z2:Math.min(zEnd,-M.L)-ext,r2:e.r2}); }
        return E;
      }};
  }
  const I=M.inner;
  if(!I)return {err:M.src==='exact'?'pas d’alésage dans la pièce (axe plein à l’avant)':'intérieur : profil exact requis (noyau)',M:M};
  const H=tourHoleR(setup,op);
  if(!(H.r>0))return {err:'intérieur : percer d’abord (Perçage en bout avant cette opération)',M:M};
  const warns=[];
  let zEnd=I.through?tourZEnd(setup,op):I.zb;
  if(isFinite(+op.zEnd)&&op.zEnd!==null&&op.zEnd!=='')zEnd=Math.max(+op.zEnd,I.through?-1/0:I.zb);
  // trou percé moins profond que la paroi (débouchant : la longueur de la pièce) : intérieur arrêté au trou
  const need=I.through?M.L:-I.zb;
  if(H.depth>0&&H.depth<need-1e-6)warns.push('trou percé sur '+(+H.depth.toFixed(2))+' mm seulement : intérieur arrêté là');
  if(H.depth>0&&-zEnd>H.depth)zEnd=-H.depth;
  const Rf=Math.max(I.r0,tourElemsEvalTop(M.elems,-1e-3));
  const ME=tourMirrorElems([{t:'L',z1:0,r1:Rf,z2:0,r2:I.r0}].concat(I.elems));
  const clr=Math.min(1,0.3*H.r);
  const tail=function(ext){
    const e=ME[ME.length-1], z1=Math.min(zEnd,e.z2)-ext;
    return I.through?{t:'L',z1:e.z2,r1:e.r2,z2:z1,r2:e.r2}:{t:'L',z1:e.z2,r1:0,z2:z1,r2:0};
  };
  return {M:M,inner:true,top:-H.r,topAt:null,safe:{x:-(H.r-clr),z:sf.z},outSafe:sf,zS:zS,zEnd:zEnd,floor:-1/0,src:M.src,hole:H,
    cap:I.through?null:(-H.r),warns:warns,
    pts:function(ext){ return tourElemsSample(ME.concat([tail(ext)]),0.01); },
    cand:function(ext){ return ME.concat([tail(ext)]); }};
}
function tourOpZEnd(setup,op){ // Z de fin affiché dans la fiche
  if(op.cote==='int'){ const c=tourCtx(setup,op); return c.err?tourZEnd(setup,op):+c.zEnd.toFixed(3); }
  return tourZEnd(setup,op);
}
function tourCtxBack(ctx,r){
  // mouvements du repère miroir → repère réel, avec l'entrée et la sortie par l'avant
  if(!ctx.inner||!r||!r.moves.length)return r;
  const mv=r.moves.map(function(m){ const o={rap:m.rap,z:m.z,x:-m.x}; if(m.arc)o.arc={cz:m.arc.cz,cx:-m.arc.cx,R:m.arc.R,cw:!m.arc.cw}; return o; });
  const sf=ctx.outSafe;
  mv.unshift({rap:1,z:sf.z,x:sf.x});
  mv.push({rap:1,z:sf.z,x:sf.x});
  r.moves=mv;
  return r;
}
function tourBarCheck(ctx,t,r){
  const dm=+t.dmin||0;
  if(dm>0&&2*ctx.hole.r<dm-1e-6)r.warns.push('barre pour Ø'+(+dm.toFixed(2))+' mini dans un trou Ø'+(+(2*ctx.hole.r).toFixed(2)));
}
function tourGenRough(setup,op){
  const t=tourOpTool(setup,op), inner=op.cote==='int';
  if(t.kind!==(inner?'bore':'turn'))return {moves:[],warns:[inner?'chariotage intérieur : choisir une barre d’alésage':'chariotage : choisir une plaquette'],info:''};
  const ctx=tourCtx(setup,op); if(ctx.err)return {moves:[],warns:[ctx.err],info:''};
  const r=tourRoughCore(ctx,op,t);
  if(ctx.warns)r.warns=ctx.warns.concat(r.warns);
  if(inner)tourBarCheck(ctx,t,r);
  return tourCtxBack(ctx,r);
}
function tourRoughCore(ctx,op,t){
  const re=+t.re||0.4, W=[];
  const ap=Math.max(0.1,+op.ap||2), sx=Math.max(0,isFinite(+op.sx)?+op.sx:0.3), sz=Math.max(0,isFinite(+op.sz)?+op.sz:0.1);
  const m=Math.min(sx,sz), geo=tourInsertGeo(t,m);
  const zEnd=ctx.zEnd, zS=ctx.zS, sf=ctx.safe, S={R:ctx.top};
  const pts=ctx.pts(geo.x1+2);
  const h=0.02;
  const zTop=zS+re+1, zBot=zEnd+re;
  const K=tourConstraint(pts,geo,zTop,zBot,h,sx-m,sz-m);
  const N=K.N, zAt=function(i){ return zTop-i*h; };
  let C=K.C;
  let cmin=1/0; for(let i=0;i<N;i++)if(C[i]>-1/0&&C[i]<cmin)cmin=C[i];
  if(!(cmin<1/0))return {moves:[],warns:['rien à charioter'],info:''};
  // devant la pièce (rien dessous) : passes jusqu'au plus petit rayon de la pièce, le reste au dressage
  const C0=C; C=new Float64Array(N); for(let i=0;i<N;i++)C[i]=C0[i]>-1/0?C0[i]:cmin;
  const mv=[];
  const P=function(rap,z,c){ mv.push({rap:rap,z:z-re,x:c-re}); }; // centre du bec → point programmé
  const top=S.R+re;
  // brut d'une reprise (pas un cylindre) : rien à couper là où la matière est sous le niveau
  const TA=ctx.topAt, mat=TA?function(i,c){ const z=zAt(i)-re; return Math.max(TA(z),TA(z-re),TA(z+re))>c-re+0.01; }:function(){ return true; };
  const lev=[];
  for(let c=top-ap;c>cmin+1e-6;c-=ap)lev.push(c);
  if(!lev.length||lev[lev.length-1]-cmin>0.005)lev.push(cmin);
  const xs=sf.x+re; // dégagement radial (centre)
  mv.push({rap:1,z:sf.z,x:sf.x});
  let nPass=0;
  lev.forEach(function(c,li){
    const cp=li?lev[li-1]:top;
    let i=0;
    while(i<N){
      if(!(C[i]<c-1e-9)||!mat(i,c)){ i++; continue; }
      let ia=i; while(i<N&&C[i]<c-1e-9&&mat(i,c))i++;
      const ib=i-1;
      if(ib-ia<1&&ia>0)continue; // morceau d'une case : rien à enlever
      nPass++;
      if(ia===0){
        P(1,zAt(0),xs); P(1,zAt(0),c);
      }else{
        let j=ia-1; while(j>0&&C[j]<cp)j--;
        const j1=Math.min(j+1,ia);
        P(1,zAt(j1),xs);
        const e0=Math.min(C[j1],cp);
        P(1,zAt(j1),Math.min(cp+0.5,xs));
        const seg=[]; for(let q=j1;q<ia;q++)seg.push([zAt(q),Math.min(C[q],cp)]);
        seg.push([zAt(ia),c]);
        tourSimplify([[zAt(j1),e0]].concat(seg),0.005).forEach(function(p){ P(0,p[0],p[1]); });
      }
      P(0,zAt(ib),c);
      if(ib>=N-1){ P(0,zAt(ib)+0.5,c+0.5); }
      else{
        const seg=[[zAt(ib),c]]; let q=ib+1;
        for(;q<N&&C[q]<cp;q++)seg.push([zAt(q),C[q]]);
        if(q<N)seg.push([zAt(q),cp]);
        const S2=tourSimplify(seg,0.005); S2.shift();
        S2.forEach(function(p){ P(0,p[0],p[1]); });
        const last=S2.length?S2[S2.length-1]:[zAt(ib),c];
        P(0,last[0]+0.5,last[1]+0.5);
      }
      const l=mv[mv.length-1];
      mv.push({rap:1,z:l.z,x:sf.x});
    }
  });
  if(op.profil!==false){
    // passe de profil : enlève les marches laissées entre les passes
    let f=0; while(f<N&&!(C0[f]>-1/0))f++;
    if(f<N){
      const seg=[]; for(let q=f;q<N;q++)seg.push([zAt(q),Math.max(C[q]>-1/0?C[q]:-1/0,cmin)]);
      const S2=tourSimplify(seg,0.005);
      P(1,S2[0][0]+1,xs); P(1,S2[0][0]+1,Math.min(S2[0][1],xs));
      S2.forEach(function(p){ P(0,p[0],p[1]); });
      const last=S2[S2.length-1]; P(0,last[0]+0.5,last[1]+0.5);
      const l=mv[mv.length-1]; mv.push({rap:1,z:l.z,x:sf.x});
    }
  }
  mv.push({rap:1,z:sf.z,x:sf.x});
  // matière laissée : seulement là où le brut (reprise) en a encore au-dessus du bec
  const TL=ctx.topAt, held=function(i,cn){ return !TL||TL(zAt(i))>cn-re+0.02; };
  let left=0; for(let i=0;i<N;i++)if(C0[i]>-1/0&&C0[i]>K.CN[i]+0.02&&held(i,K.CN[i]))left++;
  if(left*h>0.2)W.push('creux trop raides pour cette plaquette sur '+(+(left*h).toFixed(1))+' mm : matière laissée (outil plus pointu à prévoir)');
  return {moves:mv,warns:W,info:lev.length+' niveau'+(lev.length>1?'x':'')+' de '+(+ap.toFixed(2))+' mm, '+nPass+' passe'+(nPass>1?'s':'')+(op.profil!==false?' + passe de profil':'')+', laisse '+(+sx.toFixed(2))+' / '+(+sz.toFixed(2))+' mm'};
}
/* ----- finition : contrainte → vraies lignes et vrais arcs ----- */
function tourCands(E,Rp){
  const C=[];
  E.forEach(function(e){
    if(e.t==='L'){
      const dz=e.z2-e.z1, dr=e.r2-e.r1, l=Math.hypot(dz,dr); if(l<1e-9)return;
      const d=[dz/l,dr/l], n=[d[1],-d[0]];
      C.push({t:'L',pz:e.z1+n[0]*Rp,pr:e.r1+n[1]*Rp,dz:d[0],dr:d[1],vert:Math.abs(d[0])<1e-9});
    }else{
      const a1=Math.atan2(e.r1-e.cr,e.z1-e.cz), a2=Math.atan2(e.r2-e.cr,e.z2-e.cz);
      let d=a2-a1; const T=2*Math.PI; if(e.ccw){ while(d<=0)d+=T; } else { while(d>=0)d-=T; }
      const am=a1+d/2, mz=e.cz+e.R*Math.cos(am), mr=e.cr+e.R*Math.sin(am);
      const tg=e.ccw?[-Math.sin(am),Math.cos(am)]:[Math.sin(am),-Math.cos(am)], n=[tg[1],-tg[0]];
      const vex=n[0]*(mz-e.cz)+n[1]*(mr-e.cr)>0;
      const R2=vex?e.R+Rp:e.R-Rp;
      if(R2>1e-6)C.push({t:'C',cz:e.cz,cr:e.cr,R:R2});
    }
    C.push({t:'C',cz:e.z1,cr:e.r1,R:Rp});
  });
  if(E.length){ const e=E[E.length-1]; C.push({t:'C',cz:e.z2,cr:e.r2,R:Rp}); }
  return C;
}
function tourCandDist(c,z,r){
  if(c.t==='L')return Math.abs((z-c.pz)*c.dr-(r-c.pr)*c.dz);
  return Math.abs(Math.hypot(z-c.cz,r-c.cr)-c.R);
}
function tourCandProj(c,z,r){
  if(c.t==='L'){ const s=(z-c.pz)*c.dz+(r-c.pr)*c.dr; return [c.pz+c.dz*s,c.pr+c.dr*s]; }
  const a=Math.atan2(r-c.cr,z-c.cz); return [c.cz+c.R*Math.cos(a),c.cr+c.R*Math.sin(a)];
}
function tourCandX(A,B){
  // intersections de deux candidats (droite / cercle)
  const out=[];
  if(A.t==='L'&&B.t==='L'){
    const den=A.dz*B.dr-A.dr*B.dz; if(Math.abs(den)<1e-12)return out;
    const s=((B.pz-A.pz)*B.dr-(B.pr-A.pr)*B.dz)/den; out.push([A.pz+A.dz*s,A.pr+A.dr*s]); return out;
  }
  if(A.t==='C'&&B.t==='L')return tourCandX(B,A);
  if(A.t==='L'){
    const fz=A.pz-B.cz, fr=A.pr-B.cr, b=fz*A.dz+fr*A.dr, c=fz*fz+fr*fr-B.R*B.R, D=b*b-c;
    if(D<-1e-12)return out; const s=Math.sqrt(Math.max(0,D));
    [-b-s,-b+s].forEach(function(t){ out.push([A.pz+A.dz*t,A.pr+A.dr*t]); }); return out;
  }
  const dx=B.cz-A.cz, dy=B.cr-A.cr, d=Math.hypot(dx,dy);
  if(d<1e-12||d>A.R+B.R+1e-9||d<Math.abs(A.R-B.R)-1e-9)return out;
  const l=(A.R*A.R-B.R*B.R+d*d)/(2*d), h=Math.sqrt(Math.max(0,A.R*A.R-l*l));
  const mx=A.cz+dx*l/d, my=A.cr+dy*l/d;
  out.push([mx-dy*h/d,my+dx*h/d],[mx+dy*h/d,my-dx*h/d]);
  return out;
}
function tourFitPath(K,cands,pre,tol){
  // K : contrainte échantillonnée ; pre : {cand, z, r} = montée le long de la face avant.
  // Rend une suite de segments {z,r,arc?:{cz,cr,R,ccw}} depuis le point de départ.
  const N=K.N, h=K.h, Z=function(i){ return K.zTop-i*h; };
  const on=function(c,i){ return K.C[i]>-1/0&&tourCandDist(c,Z(i),K.C[i])<tol; };
  const asg=new Int32Array(N).fill(-1);
  let cur=-1;
  for(let i=0;i<N;i++){
    if(!(K.C[i]>-1/0)){ cur=-1; continue; }
    if(cur>=0&&on(cands[cur],i)){ asg[i]=cur; continue; }
    let pick=-1;
    for(let c=0;c<cands.length;c++){
      if(!on(cands[c],i))continue;
      if(pick<0)pick=c;
      if(i+1<N&&on(cands[c],i+1)&&!(cands[c].vert)){ pick=c; break; }
    }
    asg[i]=pick; cur=pick;
  }
  // morceaux : la montée le long de la face avant, puis un morceau par candidat
  const P=[{c:pre.cand,s:[pre.z,pre.r],e:null,pre:1}];
  for(let i=0;i<N;){
    const a=asg[i]; let j=i; while(j+1<N&&asg[j+1]===a)j++;
    if(K.C[i]>-1/0){
      const c=a>=0?cands[a]:null, s0=[Z(i),K.C[i]], s1=[Z(j),K.C[j]], mi=(i+j)>>1;
      const pc={c:c,i0:i,i1:j};
      if(c){ pc.s=tourCandProj(c,s0[0],s0[1]); pc.e=tourCandProj(c,s1[0],s1[1]); pc.m=tourCandProj(c,Z(mi),K.C[mi]); }
      else{ pc.s=s0; pc.e=s1; }
      P.push(pc);
    }
    i=j+1;
  }
  const pickX=function(L,q){ let b=null,bd=1/0; L.forEach(function(X){ const d=Math.hypot(X[0]-q[0],X[1]-q[1]); if(d<bd){bd=d;b=X;} }); return b; };
  const link=[]; // segment droit à insérer entre P[k−1] et P[k]
  for(let k=1;k<P.length;k++){
    const A=P[k-1], B=P[k];
    const aEnd=A.e||[A.s[0],B.s[1]];
    if(A.c&&B.c){
      const X=pickX(tourCandX(A.c,B.c),B.s);
      const lim=4*h+(A.pre?Math.abs(B.s[1]-A.s[1]):0);
      if(X&&Math.hypot(X[0]-B.s[0],X[1]-B.s[1])<lim&&(A.pre||Math.hypot(X[0]-aEnd[0],X[1]-aEnd[1])<lim+Math.abs(aEnd[1]-B.s[1]))){
        A.e=X; B.s=X; continue;
      }
      let done=false;
      for(let c=0;c<cands.length&&!done;c++){
        const V=cands[c]; if(!V.vert||V===A.c||V===B.c)continue;
        if(V.pz<Math.min(aEnd[0],B.s[0])-2*h||V.pz>Math.max(aEnd[0],B.s[0])+2*h)continue;
        const X1=pickX(tourCandX(A.c,V),aEnd), X2=pickX(tourCandX(V,B.c),B.s);
        if(X1&&X2&&Math.hypot(X1[0]-aEnd[0],X1[1]-aEnd[1])<4*h&&Math.hypot(X2[0]-B.s[0],X2[1]-B.s[1])<4*h){
          A.e=X1; B.s=X2; link[k]=1; done=true;
        }
      }
      if(done)continue;
    }
    if(!A.e)A.e=aEnd;
    link[k]=1;
  }
  const last=P[P.length-1]; if(!last.e)last.e=last.s;
  const out=[];
  const pushTo=function(c,from,to,mid){
    if(Math.hypot(to[0]-from[0],to[1]-from[1])<1e-6)return;
    if(c&&c.t==='C'&&c.R>1e-6&&mid){
      const T=2*Math.PI, a0=Math.atan2(from[1]-c.cr,from[0]-c.cz), am=Math.atan2(mid[1]-c.cr,mid[0]-c.cz), a1=Math.atan2(to[1]-c.cr,to[0]-c.cz);
      const ccw=((am-a0)%T+T)%T<=((a1-a0)%T+T)%T;
      let sw=a1-a0; if(ccw){ while(sw<=0)sw+=T; } else { while(sw>=0)sw-=T; }
      if(Math.abs(sw)<1e-7)return;
      if(Math.abs(sw)>Math.PI*0.95){ const ah=a0+sw/2; out.push({z:c.cz+c.R*Math.cos(ah),r:c.cr+c.R*Math.sin(ah),arc:{cz:c.cz,cr:c.cr,R:c.R,ccw:ccw}}); }
      out.push({z:to[0],r:to[1],arc:{cz:c.cz,cr:c.cr,R:c.R,ccw:ccw}});
    }else out.push({z:to[0],r:to[1]});
  };
  let at=P[0].s;
  P.forEach(function(pc,k){
    if(k&&link[k])pushTo(null,at,pc.s,null);
    if(pc.c){
      // milieu : sur l'arc entre le début et la fin réels (après jonctions)
      let mid=pc.m;
      if(pc.c.t==='C'&&mid){
        const T=2*Math.PI, ang=function(q){ return Math.atan2(q[1]-pc.c.cr,q[0]-pc.c.cz); };
        const a0=ang(pc.s), am=ang(mid), a1=ang(pc.e), ccw=((am-a0)%T+T)%T<=((a1-a0)%T+T)%T;
        let sw=a1-a0; if(ccw){ while(sw<=0)sw+=T; } else { while(sw>=0)sw-=T; }
        const ah=a0+sw/2; mid=[pc.c.cz+pc.c.R*Math.cos(ah),pc.c.cr+pc.c.R*Math.sin(ah)];
      }
      pushTo(pc.c,pc.s,pc.e,mid);
    }else{
      const seg=[pc.s]; for(let i=pc.i0;i<=pc.i1;i++)seg.push([Z(i),K.C[i]]);
      const S=tourSimplify(seg,0.002); S.shift();
      S.forEach(function(q){ out.push({z:q[0],r:q[1]}); });
    }
    at=pc.e||at;
  });
  return out;
}
function tourGenFinish(setup,op){
  const t=tourOpTool(setup,op), inner=op.cote==='int';
  if(t.kind!==(inner?'bore':'turn'))return {moves:[],warns:[inner?'alésage : choisir une barre d’alésage':'finition : choisir une plaquette'],info:''};
  const ctx=tourCtx(setup,op); if(ctx.err)return {moves:[],warns:[ctx.err],info:''};
  const r=tourFinishCore(ctx,op,t);
  if(ctx.warns)r.warns=ctx.warns.concat(r.warns);
  if(inner)tourBarCheck(ctx,t,r);
  return tourCtxBack(ctx,r);
}
function tourFinishCore(ctx,op,t){
  const sf=ctx.safe, re=+t.re||0.4;
  const s=Math.max(0,+op.laisse||0), geo=tourInsertGeo(t,s), Rp=geo.re;
  const zEnd=ctx.zEnd;
  const pts=ctx.pts(geo.x1+2);
  const E=ctx.cand(geo.x1+2);
  const h=0.01, zTop=Rp-1e-4, zBot=zEnd+re;
  const K=tourConstraint(pts,geo,zTop,zBot,h,0,0);
  const cands=tourCands(E,Rp);
  // départ : face avant, 1 mm sous son coin
  let r0=0; for(let i=0;i<E.length;i++){ const e=E[i]; if(Math.abs(e.z1)<1e-6&&Math.abs(e.z2)<1e-6){ r0=Math.max(e.r1,e.r2); continue; } break; }
  const rS=Math.max(ctx.floor===null?re:ctx.floor,r0-1+Rp-re);
  const front={t:'L',pz:Rp,pr:0,dz:0,dr:1,vert:true};
  let segs=tourFitPath(K,cands,{cand:front,z:Rp,r:rS},6e-4);
  if(ctx.cap!=null){
    // fond d'un alésage borgne : la remontée le long du fond s'arrête au trou percé
    const cap=ctx.cap+Rp, out=[]; let pz=Rp, pr=rS;
    for(let i=0;i<segs.length;i++){ const g=segs[i];
      if(g.r>cap+1e-9){ if(!g.arc&&g.r-pr>1e-9){ const u=(cap-pr)/(g.r-pr); if(u>1e-6)out.push({z:pz+(g.z-pz)*u,r:cap}); } break; }
      out.push(g); pz=g.z; pr=g.r; }
    segs=out;
  }
  const mv=[];
  const P=function(rap,z,c,arc){ const m={rap:rap,z:z-re,x:c-re}; if(arc)m.arc={cz:arc.cz-re,cx:arc.cr-re,R:arc.R,cw:!arc.ccw}; mv.push(m); };
  mv.push({rap:1,z:sf.z,x:sf.x});
  P(1,Rp+2,rS); P(0,Rp,rS);
  let nArc=0, nLin=0;
  segs.forEach(function(g){ if(g.arc)nArc++; else nLin++; P(0,g.z,g.r,g.arc); });
  const l=mv[mv.length-1];
  mv.push({rap:0,z:l.z,x:l.x+1});
  mv.push({rap:1,z:l.z,x:sf.x});
  mv.push({rap:1,z:sf.z,x:sf.x});
  const W=[];
  const TL=ctx.topAt;
  let left=0; for(let i=0;i<K.N;i++)if(K.C[i]>K.CN[i]+0.01&&(!TL||TL(zTop-i*h)>K.CN[i]-Rp+0.02))left++;
  if(left*h>0.05)W.push('creux trop raides pour cette plaquette sur '+(+(left*h).toFixed(1))+' mm : la finition passe au-dessus (matière laissée)');
  return {moves:mv,warns:W,info:nLin+' droite'+(nLin>1?'s':'')+', '+nArc+' arc'+(nArc>1?'s':'')+' (G2/G3)'+(s?', laisse '+s+' mm':'')+(ctx.src==='exact'?'':' — profil du maillage')};
}
function tourGenDrill(setup,op){
  const M=tourModel(setup), S=tourStock(setup), sf=tourSafe(setup), t=tourOpTool(setup,op);
  if(t.kind!=='tdrill')return {moves:[],warns:['perçage : choisir un foret'],info:''};
  const d=Math.max(0.5,+t.d||10), half=Math.max(30,Math.min(90,(+t.ang||118)/2))*Math.PI/180, tip=(d/2)/Math.tan(half);
  const W=[];
  let depth=+op.depth, plein=op.plein!==false, src='saisie';
  const B=M&&M.ok?M.bore:null;
  if(!(depth>0)){
    if(B){ depth=B.through?(M.L+0.5):(plein?B.full:B.end); src=B.through?'trou débouchant':'trou du modèle'; if(B.through)plein=true;
      const rr=(M.inner&&M.inner.rmin<1/0)?Math.min(B.r,M.inner.rmin):B.r; if(Math.abs(2*rr-d)>0.05)W.push('foret Ø'+(+d.toFixed(2))+' pour un trou Ø'+(+(2*rr).toFixed(2))); }
    else { depth=2*d; src='par défaut'; }
  }
  const zTip=-(depth+(plein?tip:0));
  const zS=tourFrontZ(setup,op)+1;
  const q=Math.max(0,+op.q||0);
  const mv=[{rap:1,z:sf.z,x:sf.x},{rap:1,z:sf.z,x:0},{rap:1,z:zS,x:0}];
  let zc=zS, nb=0;
  if(q>0){
    let z=zS;
    while(z>zTip+1e-9){
      const zn=Math.max(zTip,z-q);
      if(nb)mv.push({rap:1,z:Math.min(zS,z+0.5),x:0});
      mv.push({rap:0,z:zn,x:0}); nb++;
      if(zn>zTip+1e-9)mv.push({rap:1,z:zS,x:0});
      z=zn;
    }
  }else{ mv.push({rap:0,z:zTip,x:0}); nb=1; }
  zc=zTip;
  mv.push({rap:1,z:sf.z,x:0},{rap:1,z:sf.z,x:sf.x});
  if(zTip-tip<S.chuck+1)W.push('le foret atteint le mandrin');
  return {moves:mv,warns:W,info:'Ø'+(+d.toFixed(2))+', profondeur '+(+depth.toFixed(2))+' mm'+(plein?' au Ø plein':' à la pointe')+' ('+src+'), pointe à Z'+(+zc.toFixed(3))+(nb>1?', '+nb+' débourrages':'')};
}
function tourGenPart(setup,op){
  const M=tourModel(setup), S=tourStock(setup), sf=tourSafe(setup), t=tourOpTool(setup,op);
  if(t.kind!=='part')return {moves:[],warns:['tronçonnage : choisir une lame de tronçonnage'],info:''};
  const w=Math.max(0.5,+t.w||3);
  const L=M&&M.ok?M.L:S.L;
  const RP=tourRepriseOf(setup), zr=(isFinite(+op.z)&&op.z!==null&&op.z!=='')?+op.z:-L-(RP?tourCfg(RP).rep.sur:0);
  // pièce percée de part en part : la lame s'arrête 0,3 mm dans le trou (la pièce tombe)
  const HR=(+op.dEnd>0)?null:tourHoleR(setup,op);
  const xe=(+op.dEnd>0)?(+op.dEnd)/2:((HR&&HR.r>0.5&&HR.depth>=-zr-1e-6)?HR.r-0.3:-0.2);
  const W=[];
  if(zr-w<S.chuck+1)W.push('la lame touche le mandrin : sortir la barre davantage');
  if(S.R-xe>(+t.h||20)+1e-6)W.push('profondeur de coupe '+(+(S.R-xe).toFixed(1))+' mm > profondeur utile de la lame ('+(+t.h||20)+' mm)');
  const q=Math.max(0,+op.q||0);
  const mv=[{rap:1,z:sf.z,x:sf.x},{rap:1,z:zr,x:sf.x},{rap:1,z:zr,x:S.R+0.5}];
  if(q>0){
    let x=S.R+0.5;
    while(x>xe+1e-9){ const xn=Math.max(xe,x-q); mv.push({rap:0,z:zr,x:xn}); if(xn>xe+1e-9)mv.push({rap:1,z:zr,x:xn+0.3}); x=xn; }
  }else mv.push({rap:0,z:zr,x:xe});
  mv.push({rap:1,z:zr,x:sf.x},{rap:1,z:sf.z,x:sf.x});
  return {moves:mv,warns:W,info:'coupe à Z'+(+zr.toFixed(3))+' (coin avant de la lame, largeur '+w+' mm) jusqu’à Ø'+(+Math.max(0,2*xe).toFixed(2))};
}
/* ----- gorges (étape 2) -----
   Zones : là où la plaquette de FINITION du même côté laisse de la matière (sa trace
   balayée reste au-dessus du profil), l'outil à gorge plonge, au pas de 0,8 × sa
   largeur, jusqu'au fond permis (la lame entière ne touche jamais la pièce), puis
   une passe de fond reprend la surépaisseur fin. Point programmé : coin AVANT bas
   de la lame (comme le tronçonnage) ; à l'intérieur, coin avant côté paroi. */
function tourBladeGeo(w,rc){
  const half=w/2, r=Math.max(0,Math.min(half-0.005,rc||0));
  const low=function(dz){ const a=Math.abs(dz); if(a>half+1e-12)return 1/0; if(a<=half-r)return 0; const u=a-(half-r); return r-Math.sqrt(Math.max(0,r*r-u*u)); };
  return {re:0,x0:-half,x1:half,low:low,lowNose:low};
}
function tourGroovesFor(ctx,setup,h){
  // zones où la finition laisse de la matière : [{ja, jb}] sur la grille de pas h, depuis zTop
  const inner=ctx.inner;
  const fop=(setup.ops||[]).filter(function(o){ return o&&o.on!==false&&o.type==='tour_finish'&&(o.cote==='int')===inner; })[0];
  const ft=fop?tourOpTool(setup,fop):tourToolFor(setup,'tour_finish',inner?'int':'ext');
  if(!ft||ft.kind!==(inner?'bore':'turn'))return {err:'pas de plaquette de finition '+(inner?'intérieure':'extérieure')+' pour situer les gorges'};
  const fg=tourInsertGeo(ft,0), ext=Math.max(fg.x1,6)+2;
  const pts=ctx.pts(ext);
  const zTop=Math.max(fg.re,1)+1, zBot=ctx.zEnd;
  const K=tourConstraint(pts,fg,zTop,zBot,h,0,0);
  const N=K.N;
  // trace balayée de la finition : le point le plus bas de la plaquette au-dessus de chaque z
  const Sw=new Float64Array(N).fill(1/0);
  const w0=Math.ceil(-fg.x0/h)+1, w1=Math.ceil(fg.x1/h)+1;
  for(let i=0;i<N;i++){ const c=K.C[i]; if(!(c>-1/0))continue;
    for(let j=Math.max(0,i-w1);j<=Math.min(N-1,i+w0);j++){ const lw=fg.low((i-j)*h); if(lw<1/0){ const v=c+lw; if(v<Sw[j])Sw[j]=v; } } }
  // dessus de la pièce par case
  const Pt=new Float64Array(N).fill(-1/0);
  pts.forEach(function(p){ const j=Math.round((zTop-p[0])/h); if(j>=0&&j<N&&p[1]>Pt[j])Pt[j]=p[1]; });
  const left=function(j){ return Pt[j]>-1/0&&Sw[j]<1/0&&Sw[j]-Pt[j]>0.02; };
  const Z=[]; let j=0;
  while(j<N){
    if(!left(j)){ j++; continue; }
    const a=j; while(j<N&&left(j))j++;
    const b=j-1;
    if(Z.length&&a-Z[Z.length-1].jb<=Math.ceil(0.2/h))Z[Z.length-1].jb=b; else Z.push({ja:a,jb:b});
  }
  // un coin rentrant garde le rayon du bec de finition : pas une gorge
  const keep=function(z){ let dm=0; for(let k=z.ja;k<=z.jb;k++){ const d=Sw[k]-Pt[k]; if(d>dm)dm=d; }
    return (z.jb-z.ja)*h>=0.05&&(dm>1.05*fg.re+0.01||(z.jb-z.ja)*h>2*fg.re+0.1); };
  return {zones:Z.filter(keep),Sw:Sw,Pt:Pt,zTop:zTop,N:N,pts:pts,ft:ft};
}
function tourGenGroove(setup,op){
  const t=tourOpTool(setup,op), inner=op.cote==='int';
  if(t.kind!=='groove'||!!t.int!==inner)return {moves:[],warns:['gorge : choisir un outil à gorge '+(inner?'intérieur':'extérieur')],info:''};
  const ctx=tourCtx(setup,op); if(ctx.err)return {moves:[],warns:[ctx.err],info:''};
  const r=tourGrooveCore(ctx,op,t,setup);
  if(ctx.warns)r.warns=ctx.warns.concat(r.warns);
  if(inner)tourBarCheck(ctx,t,r);
  return tourCtxBack(ctx,r);
}
function tourGrooveCore(ctx,op,t,setup){
  const W=[], h=0.02, sf=ctx.safe;
  const w=Math.max(0.3,+t.w||2), half=w/2, hU=Math.max(0.5,+t.h||4);
  const G=tourGroovesFor(ctx,setup,h); if(G.err)return {moves:[],warns:[G.err],info:''};
  if(!G.zones.length)return {moves:[],warns:['aucune gorge : la finition atteint tout le profil'],info:''};
  // morceaux d'une même gorge séparés de moins d'une largeur d'outil : une seule
  const ZN=[]; G.zones.forEach(function(z){ const p=ZN[ZN.length-1]; if(p&&(z.ja-p.jb)*h<w)p.jb=z.jb; else ZN.push({ja:z.ja,jb:z.jb}); });
  const lai=Math.max(0,+op.laisse||0), fin=Math.max(0,isFinite(+op.fin)?+op.fin:0.1), q=Math.max(0,+op.q||0);
  const geo=tourBladeGeo(w,+t.rc||0);
  const zTop=G.zTop, hb=0.005;
  const K=tourConstraint(G.pts,geo,zTop,ctx.zEnd-half,hb,lai,0);
  const Cb=function(z){ const i=Math.round((zTop-z)/hb); return (i>=0&&i<K.N)?K.C[i]:-1/0; };
  const mv=[{rap:1,z:sf.z,x:sf.x}];
  let nP=0; const info=[];
  ZN.forEach(function(Zn){
    const za=zTop-Zn.ja*h, zb=zTop-Zn.jb*h, span=za-zb;
    let top=-1/0; for(let j=Zn.ja;j<=Zn.jb;j++)if(G.Sw[j]<1/0&&G.Sw[j]>top)top=G.Sw[j];
    const xr=Math.min(top+0.5,sf.x);
    // centres utiles : là où la lame descend sous la matière laissée (contre les parois, à 0,005 mm)
    let qa=null, qb=null;
    const i0=Math.max(0,Math.ceil((zTop-za-half)/hb)), inR=function(i){ return i<K.N&&zTop-i*hb>=zb-half-1e-9; };
    let lo=1/0; for(let i=i0;inR(i);i++)if(K.C[i]<lo)lo=K.C[i];
    // la lame descend au moins aux 3/4 de la gorge (une position à cheval sur un épaulement ne sert à rien)
    const thr=top-0.75*Math.max(0.02,top-lo);
    for(let i=i0;inR(i);i++){ if(K.C[i]<=thr+1e-9){ const z=zTop-i*hb; if(qa===null)qa=z; qb=z; } }
    const C=[];
    if(qa===null){ W.push('gorge de '+(+span.toFixed(2))+' mm plus étroite que l’outil ('+w+' mm) à Z'+(+za.toFixed(2))); }
    else{ const sp=qa-qb, n=sp>1e-6?Math.max(1,Math.ceil(sp/(0.8*w)-1e-9))+1:1; for(let k=0;k<n;k++)C.push(n>1?qa-sp*k/(n-1):qa); }
    let bot=1/0;
    C.forEach(function(zc){
      const b=Cb(zc); if(!(b>-1/0))return;
      if(b<bot)bot=b;
      const d=C.length>1&&fin>0?b+fin:b, zp=zc+half;
      mv.push({rap:1,z:zp,x:sf.x},{rap:1,z:zp,x:xr});
      if(q>0){ let x=xr; while(x>d+1e-9){ const xn=Math.max(d,x-q); mv.push({rap:0,z:zp,x:xn}); if(xn>d+1e-9)mv.push({rap:1,z:zp,x:Math.min(xr,xn+0.3)}); x=xn; } }
      else mv.push({rap:0,z:zp,x:d});
      mv.push({rap:1,z:zp,x:xr});
      nP++;
    });
    if(C.length>1&&fin>0){
      // passe de fond, de l'avant vers l'arrière, en suivant le fond permis
      const z0=C[0], z1=C[C.length-1], seg=[];
      for(let z=z0;z>=z1-1e-9;z-=hb){ const b=Cb(z); if(b>-1/0)seg.push([z+half,b]); }
      const S2=tourSimplify(seg,0.002);
      if(S2.length){ mv.push({rap:1,z:S2[0][0],x:xr},{rap:0,z:S2[0][0],x:S2[0][1]});
        S2.slice(1).forEach(function(p){ mv.push({rap:0,z:p[0],x:p[1]}); });
        const l=S2[S2.length-1]; mv.push({rap:0,z:l[0],x:xr}); }
    }
    if(top-bot>hU+1e-6)W.push('gorge de '+(+(top-bot).toFixed(2))+' mm de profondeur > profondeur utile de l’outil ('+hU+' mm)');
    mv.push({rap:1,z:mv[mv.length-1].z,x:sf.x});
    info.push('Z'+(+za.toFixed(2))+' → '+(+zb.toFixed(2)));
  });
  mv.push({rap:1,z:sf.z,x:sf.x});
  return {moves:mv,warns:W,info:ZN.length+' gorge'+(ZN.length>1?'s':'')+' ('+info.join(', ')+'), '+nP+' plongée'+(nP>1?'s':'')+(fin>0?' + passe de fond':'')};
}
/* ----- filetage (étape 2) -----
   Le filet vient du MODÈLE : fonction Filetage d'un axe (extérieur) ou trou taraudé
   (intérieur), dans l'axe du tour, son bout libre vers l'avant. Pas et Ø du filet ;
   profondeur ISO de l'outil : 0,6134·P à l'extérieur, (D − D1)/2 à l'intérieur.
   Passes à section constante (profondeur √k), puis passes à vide ; vitesse de broche
   constante (G97). Le programme Fagor écrit le cycle G86, le Siemens les passes G33. */
function tourThreadsOf(setup){
  const M=tourModel(setup), out=[];
  if(!M||!M.ok||typeof doc==='undefined'||!doc||!Array.isArray(doc.features))return out;
  const onAx=function(o,d){
    const v=[o[0]-M.Pf[0],o[1]-M.Pf[1],o[2]-M.Pf[2]], z=v[0]*M.W[0]+v[1]*M.W[1]+v[2]*M.W[2];
    const off=Math.hypot(v[0]-z*M.W[0],v[1]-z*M.W[1],v[2]-z*M.W[2]);
    const dz=d[0]*M.W[0]+d[1]*M.W[1]+d[2]*M.W[2];
    return {z:z,dz:dz,ok:off<0.05&&Math.abs(Math.abs(dz)-1)<1e-3};
  };
  doc.features.forEach(function(f){
    if(!f||f.visible===false)return;
    try{
      if(f.type==='xthread'&&f.size&&typeof threadGeo!=='undefined'){
        const g=threadGeo.get(f.id); if(!g||!Array.isArray(g.o)||!Array.isArray(g.d))return;
        const a=onAx(g.o,g.d); if(!a.ok)return;
        const t=typeof isoThread==='function'?isoThread(f.size):null;
        const P=+g.P||+f.p||(t?t[2]:0); if(!(P>0))return;
        const D=t?+t[1]:2*g.R;
        out.push({int:false,fid:f.id,label:typeof threadLabel==='function'?threadLabel(f):f.size,P:P,D:D,
          rc:Math.min(D/2,g.R+0.01),depth:0.6134*P,z0:a.z,z1:a.z+g.len*a.dz,lh:!!(f.lh||g.lh),dz:a.dz});
      }
      if(f.type==='hole'&&f.thread&&f.thread.size&&typeof holeNorm==='function'&&typeof holeAxis==='function'){
        const sk=(doc.sketches||[]).find(function(s){ return s.id===f.sketchId; }); if(!sk)return;
        const t=isoThread(f.thread.size); if(!t)return;
        const P=+f.thread.p||+t[2], N=holeNorm(f), A=holeAxis(f,sk), d=[A.dir.x,A.dir.y,A.dir.z];
        const off=(N.kind==='cbore'||N.kind==='step')?holeEntryOff(N):0;
        const len=Math.max(P,+f._thLen||+f.thread.len||N.depth);
        A.pts.forEach(function(p){
          const o=[p.x+d[0]*off,p.y+d[1]*off,p.z+d[2]*off], a=onAx(o,d); if(!a.ok)return;
          const D=+t[1], D1=2*N.r;
          out.push({int:true,fid:f.id,label:typeof holeThreadLabel==='function'?holeThreadLabel(f.thread):f.thread.size,P:P,D:D,
            rc:D1/2,depth:Math.max(0.05,(D-D1)/2),z0:a.z,z1:a.z+len*a.dz,lh:!!f.thread.lh,dz:a.dz});
        });
      }
    }catch(e){}
  });
  return out;
}
function tourGenThread(setup,op){
  const t=tourOpTool(setup,op), inner=op.cote==='int', sf=tourSafe(setup), S=tourStock(setup);
  if(t.kind!=='thread'||!!t.int!==inner)return {moves:[],warns:['filetage : choisir un outil à fileter '+(inner?'intérieur':'extérieur')],info:''};
  const W=[];
  let T=null;
  if(op.src!=='man'){
    const L=tourThreadsOf(setup).filter(function(x){ return x.int===inner; });
    const k=Math.max(0,Math.min(L.length-1,+op.idx||0));
    T=L[k]||null;
    if(T&&T.dz>0){ W.push('filet '+T.label+' commencé côté mandrin : à faire en reprise (posage retourné)'); T=null; }
    else if(!T)W.push('pas de filet '+(inner?'intérieur (trou taraudé)':'extérieur (fonction Filetage)')+' dans l’axe du tour : saisir le filet');
  }
  if(!T){
    const P=+op.P, D=+op.D;
    if(!(P>0&&D>0&&isFinite(+op.zA)&&isFinite(+op.zB)&&op.zA!==''&&op.zB!==''))return {moves:[],warns:W,info:''};
    const dep=inner?0.5413*P:0.6134*P;
    T={int:inner,label:'Ø'+D+'×'+P,P:P,D:D,rc:inner?D/2-dep:D/2,depth:dep,z0:+op.zA,z1:+op.zB,lh:!!op.lh,dz:-1};
  }
  const P=T.P, dep=T.depth, n=+op.n>0?Math.round(+op.n):Math.max(3,Math.ceil(dep/0.1));
  const nr=Math.max(0,Math.min(5,isFinite(+op.ressort)?Math.round(+op.ressort):1));
  const zS=Math.max(T.z0,tourFrontZ(setup,op))+Math.max(2,2*P), zE=T.z1;
  const sg=inner?1:-1; // vers la matière : −x dehors, +x dedans
  const xc=T.rc, xs=inner?Math.max(0.2,xc-Math.min(1,0.4*xc)):xc+1;
  if(inner&&2*xs<(+t.dmin||0)-1e-6)W.push('outil pour Ø'+(+t.dmin)+' mini dans un trou Ø'+(+(2*xc).toFixed(2)));
  const mv=[{rap:1,z:sf.z,x:sf.x}];
  if(inner)mv.push({rap:1,z:zS,x:sf.x},{rap:1,z:zS,x:xs}); else mv.push({rap:1,z:zS,x:xs});
  const D=[];
  for(let k=1;k<=n;k++)D.push(dep*Math.sqrt(k/n));
  for(let k=0;k<nr;k++)D.push(dep);
  D.forEach(function(d){
    const x=xc+sg*d;
    mv.push({rap:1,z:zS,x:x},{rap:0,z:zE,x:x,thr:P},{rap:1,z:zE,x:xs},{rap:1,z:zS,x:xs});
  });
  if(inner)mv.push({rap:1,z:sf.z,x:xs});
  mv.push({rap:1,z:sf.z,x:sf.x});
  if(T.lh)W.push('filet à gauche : broche inversée');
  if(zE-1<S.chuck+1)W.push('le filet va jusqu’au mandrin');
  return {moves:mv,warns:W,thread:{int:inner,xc:xc,zS:zS,zE:zE,P:P,dep:dep,n:n,nr:nr,B:dep/Math.sqrt(n),A:isFinite(+op.A)?Math.max(0,Math.min(60,+op.A)):30,lh:T.lh,D:T.D,label:T.label},
    info:T.label+', pas '+P+', Z'+(+T.z0.toFixed(2))+' → '+(+zE.toFixed(2))+', profondeur '+(+dep.toFixed(3))+' mm en '+n+' passe'+(n>1?'s':'')+(nr?' + '+nr+' à vide':'')};
}
let tourGenCache=new WeakMap();
function tourOpGen(setup,op){
  // Parcours d'une opération (calcul en quelques millisecondes : refait quand l'opération,
  // l'outil, le posage ou la pièce changent).
  const t=tourOpTool(setup,op);
  // dépendances : dressages et perçages placés avant, finitions (gorges), filets du modèle
  const prev=[];(setup.ops||[]).some(function(o){ if(o===op)return true; if(o&&o.on!==false&&(o.type==='tour_face'||o.type==='tour_drill'))prev.push([o.type,o.laisse||0,o.depth,o.plein,o.q,tourOpTool(setup,o)]); return false; });
  if(op.type==='tour_groove')(setup.ops||[]).forEach(function(o){ if(o&&o.on!==false&&o.type==='tour_finish')prev.push([o.cote,tourOpTool(setup,o)]); });
  if(op.type==='tour_thread')prev.push(tourThreadsOf(setup));
  if(op.type==='tour_cdrill'){ prev.push(tourCHolesOf(setup)); const RP=tourCfg(setup).rep, src=RP?tourSetupById(RP.from):null; prev.push(src?(src.ops||[]).filter(function(o){ return o&&o.on!==false&&o.type==='tour_cdrill'; }).map(function(o){ return [o.dir,o.dsel,tourOpTool(src,o)]; }):0); }
  if(op.type==='tour_part'){ const RP=tourRepriseOf(setup); prev.push(RP?tourCfg(RP).rep.sur:-1); } // surépaisseur laissée pour la reprise
  if(op.type==='tour_rough'||op.type==='tour_finish')prev.push((setup.ops||[]).filter(function(o){ return o&&o.on!==false&&o.type==='tour_groove'; }).map(function(o){ return o.cote||'ext'; }));
  const sig=JSON.stringify([op,t,setup.tour,setup.bodies,prev])+'|'+tourModelSig(setup)+'|'+tourStockSig(setup);
  const e=tourGenCache.get(op);
  if(e&&e.sig===sig)return e.r;
  let r;
  try{
    if(op.type==='tour_face')r=tourGenFace(setup,op);
    else if(op.type==='tour_rough')r=tourGenRough(setup,op);
    else if(op.type==='tour_finish')r=tourGenFinish(setup,op);
    else if(op.type==='tour_drill')r=tourGenDrill(setup,op);
    else if(op.type==='tour_part')r=tourGenPart(setup,op);
    else if(op.type==='tour_groove')r=tourGenGroove(setup,op);
    else if(op.type==='tour_thread')r=tourGenThread(setup,op);
    else if(op.type==='tour_cdrill')r=tourGenCDrill(setup,op);
    else r={moves:[],warns:[],info:''};
  }catch(err){ r={moves:[],warns:['calcul : '+((err&&err.message)||err)],info:''}; }
  const M=tourModel(setup);
  if(M&&M.warns&&M.warns.length&&op.type!=='tour_face')r.warns=M.warns.concat(r.warns);
  if((op.type==='tour_rough'||op.type==='tour_finish')&&(setup.ops||[]).some(function(o){ return o&&o!==op&&o.on!==false&&o.type==='tour_groove'&&(o.cote==='int')===(op.cote==='int'); })){
    // creux repris par une gorge du même côté : plus une alerte
    const n0=r.warns.length; r=Object.assign({},r,{warns:r.warns.filter(function(w){ return !/creux trop raides/.test(w); })});
    if(r.warns.length<n0)r.info=(r.info?r.info+' · ':'')+'creux repris par la gorge';
  }
  tourGenCache.set(op,{sig:sig,r:r});
  return r;
}
/* ----- temps ----- */
function tourMoveLen(a,b){
  if(b.arc){
    const A=b.arc, a0=Math.atan2(a.x-A.cx,a.z-A.cz), a1=Math.atan2(b.x-A.cx,b.z-A.cz), T=2*Math.PI;
    let d=a1-a0; if(!A.cw){ while(d<=0)d+=T; } else { while(d>=0)d-=T; }
    return Math.abs(d)*A.R;
  }
  return Math.hypot(b.z-a.z,b.x-a.x);
}
function tourOpTime(setup,op,mv){
  // minutes : coupe en mm/tour à vitesse de coupe constante (bornée par la vitesse maxi)
  const C=tourCfg(setup), cut=tourCut(setup,op), t=cut.t||{};
  const rapide=Math.max(500,+setup.rapide||10000);
  const rpm=function(x){ return Math.min(tourNmax(C,cut),cut.vc*1000/(Math.PI*tourSpinD(cut,x))); };
  let tm=0, lc=0, lr=0;
  for(let i=1;i<mv.length;i++){
    const a=mv[i-1], b=mv[i], l=tourMoveLen(a,b);
    if(b.rap){ tm+=l/rapide; lr+=l; }
    else{ const n=rpm((a.x+b.x)/2); tm+=l/Math.max(1e-6,cut.f*n); lc+=l; }
  }
  return {tmin:tm,cut:lc,rap:lr};
}
function tourStats(setup){
  let tm=0, lc=0, lr=0, n=0, ch=0, last=null;
  (setup.ops||[]).forEach(function(op){
    if(!op||op.on===false)return;
    const g=tourOpGen(setup,op), e=tourOpTime(setup,op,g.moves);
    tm+=e.tmin; lc+=e.cut; lr+=e.rap; n++;
    if(last!==null&&last!==op.toolId)ch++;
    last=op.toolId;
  });
  const tc=ch*(Math.max(0,+setup.toolChg||5)/60);
  return {n:n,copies:n,cut:lc,rap:lr,groups:ch+(n?1:0),tchg:tc,tmin:tm+tc,missing:0};
}

/* ----- étape 3 : perçage à l'axe C (outil tournant) ----- */
// La broche s'arrête et devient l'axe C (positionnée à l'angle du trou), le foret motorisé tourne :
//  radial : le foret descend en X vers l'axe ; axial : il avance en Z, à X = 2 × rayon du trou.
// Mouvements : {z, x, c (degrés), live:1} ; x reste le rayon (négatif au-delà de l'axe).
function tourNmax(C,cut){ return (cut&&cut.t&&cut.t.kind==='ldrill')?C.smaxL:C.smax; }
function tourCDrillHoles(setup,op){
  // trous de cette opération : sens, Ø (dsel, sinon celui du foret), côté de ce posage
  const t=tourOpTool(setup,op)||{}, dir=op.dir==='ax'?'ax':'rad';
  const all=tourCHolesOf(setup).filter(function(h){ return h.ax===dir; });
  const d=+op.dsel>0?+op.dsel:+t.d;
  const sel=all.filter(function(h){ return Math.abs(h.d-d)<0.01; });
  return {all:all,sel:sel,d:d};
}
function tourGenCDrill(setup,op){
  const C=tourCfg(setup), M=tourModel(setup), S=tourStock(setup), sf=tourSafe(setup), t=tourOpTool(setup,op);
  const dir=op.dir==='ax'?'ax':'rad', W=[];
  if(!M||!M.ok)return {moves:[],warns:['pas de pièce'],info:''};
  if(!C.cax)return {moves:[],warns:['cocher « Outils tournants (axe C) » dans la fiche du posage : le tour doit avoir un axe C et des outils motorisés'],info:''};
  if(!t||t.kind!=='ldrill'||(t.ax==='ax')!==(dir==='ax'))return {moves:[],warns:['choisir un foret motorisé '+(dir==='ax'?'axial':'radial')],info:''};
  const HS=tourCDrillHoles(setup,op);
  let H=HS.sel;
  if(!HS.all.length)return {moves:[],warns:['aucun trou '+(dir==='ax'?'axial hors de l’axe':'radial')+' dans le modèle (fonction Perçage)'],info:''};
  if(!H.length){
    const L=[]; HS.all.forEach(function(h){ if(L.indexOf(h.d)<0)L.push(h.d); });
    return {moves:[],warns:['aucun trou Ø'+(+HS.d.toFixed(2))+' : trous '+(dir==='ax'?'axiaux':'radiaux')+' Ø'+L.join(', Ø')],info:''};
  }
  H.filter(function(h){ return !h.ok; }).forEach(function(h){ W.push('trou Ø'+h.d+' à C'+(+h.c.toFixed(1))+' : '+h.why); });
  const notes={}; H.forEach(function(h){ if(h.ok&&h.note)notes[h.note]=1; if(h.ok&&h.thr)notes['taraudage '+h.thr+' non fait (perçage seul)']=1; });
  Object.keys(notes).forEach(function(k){ W.push(k); });
  H=H.filter(function(h){ return h.ok; });
  // reprise : les trous radiaux faits au premier posage ne sont pas refaits
  if(dir==='rad'&&C.rep){
    const src=tourSetupById(C.rep.from);
    if(src&&(src.ops||[]).some(function(o){ return o&&o.on!==false&&o.type==='tour_cdrill'&&o.dir!=='ax'&&Math.abs(tourCDrillHoles(src,o).d-HS.d)<0.01; })){
      return {moves:[],warns:[],info:'trous radiaux Ø'+(+HS.d.toFixed(2))+' déjà percés au posage '+src.name};
    }
  }
  if(!H.length)return {moves:[],warns:W,info:''};
  const d=+t.d||6, tip=(d/2)/Math.tan(Math.max(30,Math.min(90,(+t.ang||118)/2))*Math.PI/180);
  if(Math.abs(d-HS.d)>0.01)W.push('foret Ø'+(+d.toFixed(2))+' pour des trous Ø'+(+HS.d.toFixed(2)));
  const top=function(z){ const r=tourElemsEvalTop(M.elems,z); return r>-1/0?r:0; };
  const q=Math.max(0,+op.q||0), clr=Math.max(0.5,Math.min(C.clrX,C.clrZ,2));
  const mv=[], holes=[];
  const push=function(m){ mv.push(m); };
  // ordre : radiaux par Z puis C, axiaux par C (le moins de rotation)
  H=H.slice().sort(function(a,b){ return dir==='rad'?(Math.abs(a.z-b.z)>0.01?b.z-a.z:a.c-b.c):(a.c-b.c||b.rr-a.rr); });
  let cCur=H[0].c;
  push({rap:1,z:sf.z,x:sf.x,c:cCur,live:1});
  const peck=function(a,b,set){ // a = départ (1 mm devant la matière), b = pointe ; set(v) donne le point
    let nb=0;
    if(q>0){
      let v=a; const s=b<a?-1:1;
      while((b-v)*s>1e-9){
        const vn=s<0?Math.max(b,v-q):Math.min(b,v+q);
        if(nb)push(Object.assign({rap:1},set(v-s*0.5)));
        push(Object.assign({rap:0},set(vn))); nb++;
        if((b-vn)*s>1e-9)push(Object.assign({rap:1},set(a)));
        v=vn;
      }
    }else{ push(Object.assign({rap:0},set(b))); nb=1; }
    push(Object.assign({rap:1},set(a)));
    return nb;
  };
  let nPk=0, last=null;
  H.forEach(function(h){
    if(dir==='rad'){
      const xe=Math.max(h.rr,top(h.z)), xa=xe+clr;
      const xt=h.through?-(top(h.z)+0.5+tip):(h.rr-h.depth-tip);
      const sameZ=!!last&&Math.abs(last.z-h.z)<=0.01;
      if(!sameZ){ if(last)push({rap:1,z:last.z,x:sf.x,c:cCur,live:1}); push({rap:1,z:h.z,x:sf.x,c:cCur,live:1}); cCur=h.c; push({rap:1,z:h.z,x:sf.x,c:cCur,live:1}); }
      else{ cCur=h.c; push({rap:1,z:h.z,x:last.xa,c:cCur,live:1}); }
      push({rap:1,z:h.z,x:xa,c:cCur,live:1});
      const n=peck(xa,xt,function(v){ return {z:h.z,x:v,c:cCur,live:1}; }); if(n>1)nPk+=n-1;
      holes.push({ax:'rad',z:h.z,x0:xe,x1:xt+tip,c:h.c,r:h.r,mi:mv.length-2});
      last={z:h.z,xa:xa};
    }else{
      const za=Math.max(h.z,Math.min(S.face,tourFrontZ(setup,op)))+clr;
      let zt;
      if(h.through){
        // de part en part : jusqu'au bout de la matière à ce rayon
        let z=h.z; while(z>-M.L-0.01&&top(z-0.05)>h.rr-h.r+1e-6)z-=0.05;
        zt=Math.max(-M.L,z)-0.5-tip;
      }else zt=h.z-h.depth-tip;
      const same=!!last&&Math.abs(last.rr-h.rr)<=0.01&&Math.abs(last.za-za)<=0.01;
      if(!same){
        if(last)push({rap:1,z:sf.z,x:last.rr,c:cCur,live:1});
        cCur=h.c;
        push({rap:1,z:sf.z,x:last?last.rr:sf.x,c:cCur,live:1}); // rotation C au dégagement
        push({rap:1,z:sf.z,x:h.rr,c:cCur,live:1});
      }else cCur=h.c;
      push({rap:1,z:za,x:h.rr,c:cCur,live:1});
      const n=peck(za,zt,function(v){ return {z:v,x:h.rr,c:cCur,live:1}; }); if(n>1)nPk+=n-1;
      holes.push({ax:'ax',z:h.z,z1:zt+tip,x0:h.rr,c:h.c,r:h.r,mi:mv.length-2});
      last={rr:h.rr,za:za};
      if(zt<S.chuck+1)W.push('le foret atteint le mandrin');
    }
  });
  if(dir==='rad')push({rap:1,z:last.z,x:sf.x,c:cCur,live:1});
  else push({rap:1,z:sf.z,x:last.rr,c:cCur,live:1});
  push({rap:1,z:sf.z,x:sf.x,c:cCur,live:1});
  const Cs=H.map(function(h){ return +h.c.toFixed(1); });
  return {moves:mv,warns:W,holes:holes,live:{dir:dir},
    info:H.length+' trou'+(H.length>1?'s':'')+' '+(dir==='ax'?'axia':'radia')+(H.length>1?'ux':'l')+' Ø'+(+HS.d.toFixed(2))+', C '+Cs.join(' / ')+'°'+(nPk?', '+nPk+' débourrages':'')};
}
