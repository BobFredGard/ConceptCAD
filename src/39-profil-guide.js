/* ---------- courbe guide d'une répétition « suivant un profil » (V0.30.0) ----------
   Commun à la répétition de FONCTIONS (40) et à celle de COMPOSANTS (48). La courbe guide est
   une suite de lignes, arcs, cercles et splines d'une esquisse (dessinés ou projetés du 3D),
   jointes bout à bout. Un point de départ posé sur la courbe (point d'esquisse, extrémité,
   sommet, ou milieu d'une ligne) porte l'original ; les copies sont placées le long de la
   courbe, à pas constant en LONGUEUR DE COURBE (abscisse curviligne, exacte pour lignes, arcs
   et cercles ; spline : polyligne fine).
     Courbe ouverte : du départ vers l'extrémité opposée ; « réparti » : pas = longueur / (N − 1),
                      la dernière copie tombe sur l'autre extrémité.
     Courbe fermée  : « réparti » : pas = longueur / N — la dernière copie est un pas AVANT le
                      départ (le départ est aussi l'arrivée : pas de doublon).
     Pas imposé     : pas saisi, N exemplaires ; au-delà de la courbe ouverte, les copies sont
                      abandonnées (avertissement) ; sur une fermée, au-delà d'un tour, avertissement.
   Orientation : « fixe » (translation pure) ou « suit la tangente » (rotation autour de la
   normale de l'esquisse, de l'angle entre la tangente au départ et la tangente à la copie).
   Réglages (cfg) : path {sk, pt | mid}, pspace 'fit' | 'pitch', dist (pas), orient 'fixed' |
   'tangent', rev (sens inversé). Tout est pur (aucun accès à doc) : testable en Node. */
const PG_TOL=0.01; // mm : écart toléré entre le point de départ et la courbe
function pgEnts(sk){return (sk&&sk.entities||[]).filter(e=>e&&!e.handle&&(e.t==='line'||e.t==='arc'||e.t==='circle'||e.t==='spline'));}
function pgEnds(e){
  // extrémités [début, fin] d'une entité ; null : courbe fermée à elle seule (cercle, spline fermée)
  if(e.t==='line')return [e.p1,e.p2];
  if(e.t==='arc')return e.pa===e.pb?null:[e.pa,e.pb];
  if(e.t==='spline'&&!e.closed){const p=e.pts||[];return p.length>=2?[p[0],p[p.length-1]]:null;}
  return null;
}
function pgNearSeg(A,B,x,y){
  const dx=B.x-A.x,dy=B.y-A.y,L2=dx*dx+dy*dy;
  let t=L2>0?((x-A.x)*dx+(y-A.y)*dy)/L2:0;t=Math.max(0,Math.min(1,t));
  return {t,d:Math.hypot(A.x+dx*t-x,A.y+dy*t-y)};
}
function pgSeg(sk,e,fwd){
  // Tronçon parcouru dans le sens fwd : {len, at(s) → {x, y, tx, ty}, near(x, y) → {s, d}}
  const P=sk.points||{};
  if(e.t==='line'){
    const A=P[fwd?e.p1:e.p2],B=P[fwd?e.p2:e.p1];if(!A||!B)return null;
    const dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy);if(!(L>1e-9))return null;
    return {e,fwd,len:L,at:s=>({x:A.x+dx*s/L,y:A.y+dy*s/L,tx:dx/L,ty:dy/L}),
      near:(x,y)=>{const n=pgNearSeg(A,B,x,y);return {s:n.t*L,d:n.d};}};
  }
  if(e.t==='arc'||e.t==='circle'){
    const C=P[e.pc],r=+e.r;if(!C||!(r>1e-9))return null;
    let a1=0,d=2*Math.PI;
    if(e.t==='arc'){const g=typeof arcAngles==='function'?arcAngles(sk,e):null;if(!g)return null;a1=g.a1;d=g.a2-g.a1;}
    const sg=fwd?1:-1,a0=fwd?a1:a1+d,L=r*d,TAU=2*Math.PI;
    const at=s=>{const a=a0+sg*s/r;return {x:C.x+r*Math.cos(a),y:C.y+r*Math.sin(a),tx:-sg*Math.sin(a),ty:sg*Math.cos(a)};};
    return {e,fwd,len:L,at,near:(x,y)=>{
      let u=sg*(Math.atan2(y-C.y,x-C.x)-a0);u=((u%TAU)+TAU)%TAU;
      let s=u*r;
      if(u>d+1e-12){ // hors de l'arc : l'extrémité la plus proche
        const q0=at(0),q1=at(L);s=Math.hypot(q0.x-x,q0.y-y)<=Math.hypot(q1.x-x,q1.y-y)?0:L;
      }
      const q=at(s);return {s,d:Math.hypot(q.x-x,q.y-y)};
    }};
  }
  if(e.t==='spline'){
    let pl=typeof skSplinePoly==='function'?skSplinePoly(sk,e,64):null;if(!pl||pl.length<2)return null;
    pl=pl.map(p=>({x:p[0],y:p[1]}));if(!fwd)pl.reverse();
    const cum=[0];for(let i=1;i<pl.length;i++)cum.push(cum[i-1]+Math.hypot(pl[i].x-pl[i-1].x,pl[i].y-pl[i-1].y));
    const L=cum[cum.length-1];if(!(L>1e-9))return null;
    const at=s=>{
      s=Math.max(0,Math.min(L,s));
      let lo=0,hi=cum.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(cum[m]<=s)lo=m;else hi=m;}
      const A=pl[lo],B=pl[hi],l=cum[hi]-cum[lo]||1,t=(s-cum[lo])/l;
      // tangente : moyenne pondérée des cordes voisines (continue d'un échantillon à l'autre)
      const dir=k=>{const a=pl[Math.max(0,k)],b=pl[Math.min(pl.length-1,k+1)],n=Math.hypot(b.x-a.x,b.y-a.y)||1;return [(b.x-a.x)/n,(b.y-a.y)/n];};
      const d0=dir(lo),dm=t<0.5?dir(lo-1):dir(lo+1),w=t<0.5?0.5-t:t-0.5;
      let tx=d0[0]*(1-w)+dm[0]*w,ty=d0[1]*(1-w)+dm[1]*w;const n=Math.hypot(tx,ty)||1;tx/=n;ty/=n;
      return {x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t,tx,ty};
    };
    return {e,fwd,len:L,at,near:(x,y)=>{
      let best={s:0,d:Infinity};
      for(let i=0;i+1<pl.length;i++){const n=pgNearSeg(pl[i],pl[i+1],x,y);if(n.d<best.d)best={s:cum[i]+n.t*(cum[i+1]-cum[i]),d:n.d};}
      return best;
    }};
  }
  return null;
}
function pgMake(segs,closed,head,tail){
  const off=[0];segs.forEach((g,i)=>off.push(off[i]+g.len));
  const L=off[segs.length];
  const at=s=>{
    if(closed){s=((s%L)+L)%L;}else s=Math.max(0,Math.min(L,s));
    let k=0;while(k<segs.length-1&&s>=off[k+1]-1e-9)k++; // à une jonction : le tronçon qui COMMENCE (tangente de sortie)
    return segs[k].at(s-off[k]);
  };
  const locate=(x,y)=>{let best={s:0,d:Infinity};segs.forEach((g,k)=>{const n=g.near(x,y);if(n.d<best.d)best={s:off[k]+n.s,d:n.d};});return best;};
  return {segs,closed:!!closed,L,at,locate,head:head||null,tail:tail||null,ids:segs.map(g=>g.e.id)};
}
function pgChains(sk){
  // Chaînes de la courbe guide : entités jointes bout à bout (même point, contrainte de
  // coïncidence ou superposition — les projections dupliquent leurs points de jonction)
  const E=pgEnts(sk),used=new Set(),out=[];
  const same=(a,b)=>typeof skJointSame==='function'?skJointSame(sk,a,b):a===b;
  E.forEach(e=>{
    if(used.has(e.id))return;used.add(e.id);
    const en=pgEnds(e);
    if(!en){const g=pgSeg(sk,e,true);if(g)out.push(pgMake([g],true));return;}
    const ord=[{e,fwd:true}];let head=en[0],tail=en[1],closed=same(head,tail);
    const grow=atTail=>{
      while(!closed){
        const pt=atTail?tail:head;
        const nx=E.find(q=>{if(used.has(q.id))return false;const qe=pgEnds(q);return !!qe&&(same(qe[0],pt)||same(qe[1],pt));});
        if(!nx)return;
        used.add(nx.id);const qe=pgEnds(nx);
        if(atTail){const fwd=same(qe[0],pt);ord.push({e:nx,fwd});tail=fwd?qe[1]:qe[0];}
        else{const fwd=same(qe[1],pt);ord.unshift({e:nx,fwd});head=fwd?qe[0]:qe[1];}
        if(same(head,tail))closed=true;
      }
    };
    grow(true);grow(false);
    const segs=ord.map(o=>pgSeg(sk,o.e,o.fwd)).filter(Boolean);
    if(segs.length)out.push(pgMake(segs,closed,closed?null:head,closed?null:tail));
  });
  return out;
}
function pgStartXY(sk,path){
  // Coordonnées (esquisse) du point de départ : point d'esquisse, ou milieu d'une ligne
  const P=sk.points||{};
  if(path&&path.mid){const e=(sk.entities||[]).find(q=>q.id===path.mid);const A=e&&P[e.p1],B=e&&P[e.p2];return A&&B?{x:(A.x+B.x)/2,y:(A.y+B.y)/2}:null;}
  if(path&&path.pt){const q=P[path.pt];return q?{x:q.x,y:q.y}:null;}
  return null;
}
function pgResolve(sk,path){
  // → {ch, s0} | {err}
  if(!sk)return {err:'esquisse guide introuvable'};
  const C=pgChains(sk);
  if(!C.length)return {err:'l’esquisse guide n’a ni ligne, ni arc, ni spline'};
  const q=pgStartXY(sk,path);
  if(!q){
    if(path&&(path.pt||path.mid))return {err:'point de départ introuvable dans l’esquisse guide'};
    const ch=C.reduce((a,b)=>b.L>a.L?b:a);return {ch,s0:0};
  }
  let best=null;C.forEach(ch=>{const n=ch.locate(q.x,q.y);if(!best||n.d<best.d)best={ch,s0:n.s,d:n.d};});
  if(best.d>PG_TOL)return {err:'le point de départ n’est pas sur la courbe guide (écart '+best.d.toFixed(3)+' mm)'};
  if(best.ch.closed&&best.s0>best.ch.L-1e-9)best.s0=0;
  return {ch:best.ch,s0:best.s0};
}
function pgStations(ch,s0,n,o){
  // Abscisses curvilignes des n exemplaires (le 1er = départ) → {S, step, dir, warn}
  o=o||{};n=Math.max(1,Math.floor(n)||1);
  const L=ch.L,pitch=o.pspace==='pitch';let warn='',dir,step;
  if(ch.closed){
    dir=o.rev?-1:1;step=pitch?Math.abs(+o.dist||0):L/n;
    if(pitch&&step*(n-1)>=L-1e-9)warn='le pas × (quantité − 1) dépasse un tour : des exemplaires se superposent';
  }else{
    dir=(s0<=L/2?1:-1)*(o.rev?-1:1);
    const avail=dir>0?L-s0:s0;
    step=pitch?Math.abs(+o.dist||0):(n>1?avail/(n-1):0);
    if(!(avail>1e-9)&&n>1)warn='aucune longueur dans ce sens : inversez le sens ou partez de l’autre extrémité';
  }
  const S=[];
  for(let i=0;i<n;i++){
    let s=s0+dir*step*i;
    if(ch.closed)s=((s%L)+L)%L;
    else if(s<-1e-6||s>L+1e-6){if(!warn)warn=(n-i)+' exemplaire(s) au-delà de l’extrémité de la courbe : abandonné(s)';break;}
    else s=Math.max(0,Math.min(L,s));
    S.push(s);
  }
  return {S,step,dir,warn};
}
function pgPlan(sk,cfg,n){
  // Transformations des copies (original exclu), dans le repère où l'esquisse est posée :
  // → {L, closed, step, cells:[{P0, Pi, N, ang (°)}], warn, err}
  const R=pgResolve(sk,cfg&&cfg.path);if(R.err)return {err:R.err,cells:[]};
  const st=pgStations(R.ch,R.s0,n,cfg);
  const O=sk.origin||[0,0,0],U=sk.axU||[1,0,0],V=sk.axV||[0,1,0];
  const N=sk.axN||[U[1]*V[2]-U[2]*V[1],U[2]*V[0]-U[0]*V[2],U[0]*V[1]-U[1]*V[0]];
  const W=(x,y)=>[O[0]+x*U[0]+y*V[0],O[1]+x*U[1]+y*V[1],O[2]+x*U[2]+y*V[2]];
  const tan=st.dir; // la tangente est prise dans le sens de parcours
  const q0=R.ch.at(st.S[0]),P0=W(q0.x,q0.y),T0=[tan*q0.tx,tan*q0.ty];
  const cells=[];
  for(let i=1;i<st.S.length;i++){
    const q=R.ch.at(st.S[i]),Ti=[tan*q.tx,tan*q.ty];
    let ang=0;
    if(cfg&&cfg.orient==='tangent'){
      // angle signé de T0 vers Ti dans le plan (u, v) ; la normale n = u × v (repère direct)
      ang=Math.atan2(T0[0]*Ti[1]-T0[1]*Ti[0],T0[0]*Ti[0]+T0[1]*Ti[1])*180/Math.PI;
      const uv=[U[1]*V[2]-U[2]*V[1],U[2]*V[0]-U[0]*V[2],U[0]*V[1]-U[1]*V[0]];
      if(uv[0]*N[0]+uv[1]*N[1]+uv[2]*N[2]<0)ang=-ang;
    }
    cells.push({P0,Pi:W(q.x,q.y),N:N.slice(),ang});
  }
  return {L:R.ch.L,closed:R.ch.closed,step:st.step,cells,warn:st.warn,err:''};
}
function pgSketchSig(sk){
  // Signature de la géométrie guide (régénération quand l'esquisse change)
  if(!sk)return '∅';
  return JSON.stringify([sk.origin,sk.axU,sk.axV,sk.axN,pgEnts(sk).map(e=>[e.id,e.t,e.p1,e.p2,e.pa,e.pb,e.pc,e.r,e.pts,e.closed]),sk.points]);
}
function pgStartChoices(sk){
  // Points de départ proposés : points d'esquisse posés sur la courbe, extrémités des
  // courbes ouvertes, sommets des fermées, milieux des lignes → [{v:{pt}|{mid}, label}]
  const out=[];if(!sk)return out;
  const C=pgChains(sk),P=sk.points||{},seen=new Set();
  const f=v=>String(+(+v).toFixed(2)).replace('.',',');
  const xy=q=>'('+f(q.x)+' ; '+f(q.y)+')';
  const onCurve=q=>C.find(ch=>ch.locate(q.x,q.y).d<=PG_TOL);
  const near=q=>out.some(o=>Math.hypot(o.q.x-q.x,o.q.y-q.y)<1e-6);
  const add=(v,label,q)=>{const k=JSON.stringify(v);if(seen.has(k)||near(q))return;seen.add(k);out.push({v,label,q});};
  (sk.entities||[]).forEach(e=>{if(e&&e.t==='cpoint'&&P[e.p]&&onCurve(P[e.p]))add({pt:e.p},'Point '+xy(P[e.p]),P[e.p]);});
  // V0.30.1 : tout autre point d'esquisse posé sur la courbe — centre du cercle d'un perçage,
  // extrémité d'une ligne d'une autre géométrie… (poignées de spline exclues)
  const hd=new Set();(sk.entities||[]).forEach(e=>{if(e&&e.handle)[e.p,e.p1,e.p2].forEach(x=>{if(x)hd.add(x);});});
  const ent=new Set();(sk.entities||[]).forEach(e=>{if(e&&!e.handle&&e.t!=='cpoint')[e.p1,e.p2,e.pa,e.pb,e.pc].concat(e.pts||[]).forEach(x=>{if(x)ent.add(x);});});
  const tour=new Set();C.forEach(ch=>ch.segs.forEach(g=>{const en=pgEnds(g.e);if(en)en.forEach(x=>tour.add(x));}));
  ent.forEach(id=>{const q=P[id];if(q&&!hd.has(id)&&!tour.has(id)&&onCurve(q))add({pt:id},'Point '+xy(q),q);});
  C.forEach((ch,k)=>{
    const tag=C.length>1?' · courbe '+(k+1):'';
    if(!ch.closed){
      if(ch.head&&P[ch.head])add({pt:ch.head},'Extrémité A '+xy(P[ch.head])+tag,P[ch.head]);
      if(ch.tail&&P[ch.tail])add({pt:ch.tail},'Extrémité B '+xy(P[ch.tail])+tag,P[ch.tail]);
    }else ch.segs.forEach(g=>{const en=pgEnds(g.e);if(!en)return;const pid=g.fwd?en[0]:en[1];if(P[pid])add({pt:pid},'Sommet '+xy(P[pid])+tag,P[pid]);});
    ch.segs.forEach(g=>{if(g.e.t!=='line')return;const q=pgStartXY(sk,{mid:g.e.id});if(q)add({mid:g.e.id},'Milieu de ligne '+xy(q)+tag,q);});
  });
  return out;
}
function pgDefaultPath(sk){
  // Départ proposé : premier point d'esquisse sur la courbe, sinon la 1ʳᵉ extrémité / le 1er sommet
  const c=pgStartChoices(sk);return c.length?Object.assign({sk:sk.id},c[0].v):{sk:sk?sk.id:null};
}
function pgSameStart(a,b){return !!a&&!!b&&(a.pt||null)===(b.pt||null)&&(a.mid||null)===(b.mid||null);}
function pgGuideSketches(D){
  // Esquisses utilisables comme guide (au moins une ligne, un arc ou une spline)
  return ((D&&D.sketches)||[]).filter(sk=>pgEnts(sk).length&&!/\(rép\s*\d+\)\s*$/.test(sk.name||''));
}
