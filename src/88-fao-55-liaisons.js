/* ===================== LIAISONS ENTRE PASSES ===================== */
// V0.61.0 : rôle de chaque plan (demande utilisateur) :
//  - Dégagement : position avant le travail de chaque opération, changement
//    d'outil, rotation du plateau, fin de programme ;
//  - Retrait : hauteur des rapides ENTRE LES PASSES d'une opération ;
//  - mode 'min5' (« Retrait minimum ») : la liaison ne monte que de job.liftMin
//    au-dessus du plus haut de ses deux bouts ET de la matière survolée, sans
//    dépasser le plan de retrait.
// Tout se joue ici, APRÈS le calcul des parcours : aucun parcours à régénérer
// (CACHE_VER inchangé, liftMin hors de faoOpMovesKey).
//
// La matière survolée vient d'une carte de hauteurs refaite à chaque séquence :
// le brut plein, le modèle et les corps à éviter comme plancher, puis ce que les
// passes précédentes ont réellement enlevé. Elle ne descend que là où l'outil a
// entièrement balayé la maille : en cas de doute, elle reste trop haute.
const FAO_LIFT_DEF=5;
function faoLiftMin(job){
  const v=job?+job.liftMin:NaN;
  return (isFinite(v)&&v>0)?v:FAO_LIFT_DEF;
}
function faoLinkPlane(op,job){
  // Plan de retrait de l'opération, jamais sous le dessus du brut.
  const top=(job&&job.stock&&isFinite(+job.stock.z1))?+job.stock.z1:
    (op&&isFinite(+op.z))?+op.z:(op&&isFinite(+op.ztop))?+op.ztop:0;
  return Math.max(faoRetractAbs(op,job),top);
}
function faoHMapDisc(rad,cell,prof){
  // Mailles entières sous un disque : [di, dj, surélévation due au profil d'outil]
  const out=[], n=Math.ceil(rad/cell);
  for(let j=-n;j<=n;j++)for(let i=-n;i<=n;i++){
    const d=Math.hypot(i,j)*cell;
    if(d<=rad)out.push([i,j,prof?prof(d):0]);
  }
  return out;
}
function faoHMapRaster(H,F,G,mesh){
  // Plancher = dessus du maillage, par maille (triangles dilatés d'une maille).
  const v=mesh.v, c=G.cell;
  for(let t=0;t<mesh.t.length;t++){
    const a=v[mesh.t[t][0]], b=v[mesh.t[t][1]], d=v[mesh.t[t][2]];
    const zMax=Math.max(a[2],b[2],d[2]);
    const i0=Math.max(0,Math.floor((Math.min(a[0],b[0],d[0])-G.x0)/c)-1), i1=Math.min(G.nx-1,Math.ceil((Math.max(a[0],b[0],d[0])-G.x0)/c)+1);
    const j0=Math.max(0,Math.floor((Math.min(a[1],b[1],d[1])-G.y0)/c)-1), j1=Math.min(G.ny-1,Math.ceil((Math.max(a[1],b[1],d[1])-G.y0)/c)+1);
    const ux=b[0]-a[0], uy=b[1]-a[1], wx=d[0]-a[0], wy=d[1]-a[1];
    const det=ux*wy-uy*wx, L=Math.max(Math.hypot(ux,uy),Math.hypot(wx,wy),1e-9);
    const flat=Math.abs(det)<1e-6*L*L; // triangle vu par la tranche : sa boîte entière
    const eU=flat?0:1.5*c*Math.hypot(wx,wy)/Math.abs(det), eW=flat?0:1.5*c*Math.hypot(ux,uy)/Math.abs(det);
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      let z=zMax;
      if(!flat){
        const px=G.x0+(i+0.5)*c-a[0], py=G.y0+(j+0.5)*c-a[1];
        const s=(px*wy-py*wx)/det, q=(ux*py-uy*px)/det;
        if(s<-eU||q<-eW||s+q>1+eU+eW)continue;
        z=Math.min(zMax,a[2]+s*(b[2]-a[2])+q*(d[2]-a[2])+(eU+eW)*Math.max(Math.abs(b[2]-a[2]),Math.abs(d[2]-a[2])));
      }
      const k=j*G.nx+i;
      if(z>F[k])F[k]=z;
      if(z>H[k])H[k]=z;
    }
  }
}
function faoLinkCtx(job,ops){
  // Carte de hauteurs du posage ; null = matière inconnue -> plan de retrait.
  const st=job&&job.stock;
  if(!st||!isFinite(+st.x0)||!isFinite(+st.x1)||!isFinite(+st.y0)||!isFinite(+st.y1)||!isFinite(+st.z1))return null;
  const meshes=[];
  try{
    if(typeof bodies!=='undefined'&&bodies&&bodies.length){
      const am=faoActiveMesh(job);
      if(!am||!am.mesh)return null;
      meshes.push(am.mesh);
    }
    const wm=(typeof faoWallsMesh==='function')?faoWallsMesh(job):null;
    if(wm)meshes.push(wm);
    ops.forEach(function(op){
      if(op&&Array.isArray(op.protect)&&op.protect.length){ const rb=faoProtectBodiesMesh(job,op); if(rb)meshes.push(rb); }
    });
  }catch(e){ return null; }
  // Étendue : le brut et tout ce qui dépasse ; maille de 2 mm à D/6, 1500 × 1500 au plus.
  let x0=+st.x0,x1=+st.x1,y0=+st.y0,y1=+st.y1,dMin=1/0;
  meshes.forEach(function(M){ M.v.forEach(function(p){
    if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1];
  }); });
  ops.forEach(function(op){ const t=faoToolById(job,op&&op.toolId); if(t&&+t.d>0&&+t.d<dMin)dMin=+t.d; });
  const dim=Math.max(x1-x0,y1-y0,1);
  const cell=Math.max(dim/1500,Math.min(2,isFinite(dMin)?dMin/6:2));
  const G={x0:x0,y0:y0,cell:cell,nx:Math.ceil((x1-x0)/cell)+1,ny:Math.ceil((y1-y0)/cell)+1};
  const H=new Float32Array(G.nx*G.ny).fill(-Infinity), F=new Float32Array(G.nx*G.ny).fill(-Infinity);
  const i0=Math.max(0,Math.floor((+st.x0-x0)/cell)), i1=Math.min(G.nx-1,Math.ceil((+st.x1-x0)/cell));
  const j0=Math.max(0,Math.floor((+st.y0-y0)/cell)), j1=Math.min(G.ny-1,Math.ceil((+st.y1-y0)/cell));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)H[j*G.nx+i]=+st.z1;
  meshes.forEach(function(M){ faoHMapRaster(H,F,G,M); });
  const fx=job.fixture;
  const floor=(fx&&isFinite(+fx.z1))?+fx.z1:-Infinity; // bridage connu en Z seulement
  const stamps=new Map(), discs=new Map();
  const stampOf=function(t){
    // Outil cylindrique, torique, boule ; les autres (pointes, chanfrein) n'enlèvent rien ici.
    const kind=t&&t.kind, R=t?(+t.d)/2:0;
    if(!(R>0)||(kind!=='flat'&&kind!=='ball'&&kind!=='bull'))return null;
    const key=kind+':'+R+':'+(t.cornerR||0);
    if(!stamps.has(key)){
      const rc=kind==='ball'?R:(kind==='bull'?Math.min(R,Math.max(0,+t.cornerR||0)):0);
      const m=cell*0.75; // maille entièrement sous l'outil, surélévation prise à son coin
      const prof=function(d){ const e=d+m-(R-rc); return (rc>0&&e>0)?rc-Math.sqrt(Math.max(0,rc*rc-e*e)):0; };
      stamps.set(key,R-m>0?{list:faoHMapDisc(R-m,cell,prof),step:Math.max(cell,R/3),R:R}:{list:[],step:1e9,R:R});
    }
    return stamps.get(key);
  };
  const stampAt=function(S,x,y,z){
    const ci=Math.round((x-G.x0)/cell-0.5), cj=Math.round((y-G.y0)/cell-0.5), L=S.list;
    for(let n=0;n<L.length;n++){
      const i=ci+L[n][0], j=cj+L[n][1];
      if(i<0||j<0||i>=G.nx||j>=G.ny)continue;
      const k=j*G.nx+i, h=z+L[n][2];
      if(h<H[k])H[k]=h>F[k]?h:F[k];
    }
  };
  const ctx={lift:0,
    cut:function(S,a,b){
      // Enlèvement d'un mouvement de coupe a -> b (arcs développés).
      if(!S||!S.list.length)return;
      const seg=function(p,q){
        const L=Math.hypot(q[0]-p[0],q[1]-p[1]), n=Math.max(1,Math.ceil(L/S.step));
        for(let i=0;i<=n;i++){ const t=i/n; stampAt(S,p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t); }
      };
      if(b.arc){
        let pv=[+a.x,+a.y,+a.z];
        (faoArcSegs(a,b)||[]).forEach(function(q){ seg(pv,q); pv=q; });
        seg(pv,[+b.x,+b.y,+b.z]);
      }else seg([+a.x,+a.y,+a.z],[+b.x,+b.y,+b.z]);
    },
    tool:function(op){ return stampOf(faoToolById(job,op&&op.toolId)); },
    top:function(a,b,R){
      // Plus haut point de matière sous le passage d'un outil de rayon R.
      const step=Math.max(cell,R/2), rad=R+step/2+cell;
      const kd=String(rad);
      if(!discs.has(kd))discs.set(kd,faoHMapDisc(rad,cell,null));
      const D=discs.get(kd), L=Math.hypot(b.x-a.x,b.y-a.y), n=Math.max(1,Math.ceil(L/step));
      let top=floor;
      for(let s=0;s<=n;s++){
        const t=s/n, ci=Math.round((a.x+(b.x-a.x)*t-G.x0)/cell-0.5), cj=Math.round((a.y+(b.y-a.y)*t-G.y0)/cell-0.5);
        for(let q=0;q<D.length;q++){
          const i=ci+D[q][0], j=cj+D[q][1];
          if(i<0||j<0||i>=G.nx||j>=G.ny)continue;
          const h=H[j*G.nx+i];
          if(h>top)top=h;
        }
      }
      return top;
    }
  };
  return ctx;
}
function faoOpLinks(job,op,mv,prev,ctx){
  // Rapides d'une opération (repère du posage) : approche au dégagement, puis
  // liaisons au plan de retrait ou au retrait minimum.
  const out=[], safe=faoClearAbs(op,job);
  const drill=op.type==='drill'; // le cycle machine repose à sa hauteur : déroulé identique
  const plane=drill?faoZoneSecu(op,job):faoLinkPlane(op,job);
  const tool=faoToolById(job,op.toolId), R=tool?(+tool.d)/2:0;
  const low=ctx&&!drill&&R>0?ctx:null;
  const S=ctx?ctx.tool(op):null;
  let p=prev, first=true;
  const put=function(m){ out.push(m); p=m; };
  for(let i=0;i<mv.length;i++){
    const m=mv[i];
    if(first){
      first=false;
      const ins=faoSafeAhead(prev,m,safe);
      if(ins)ins.forEach(function(J){ out.push(J); });
      if(!m.r&&ctx&&p)ctx.cut(S,p,m);
      put(m);
      continue;
    }
    if(!m.r){ if(ctx&&p)ctx.cut(S,p,m); put(m); continue; }
    let k=i;
    while(k+1<mv.length&&mv[k+1].r)k++;
    let B=mv[k];
    if(Math.hypot(B.x-p.x,B.y-p.y)<=1e-9||drill){
      // sur place (ou perçage) : rapides conservés, jamais une translation sous le plan
      for(let q=i;q<=k;q++){
        const ins=faoSafeAhead(p,mv[q],plane);
        if(ins)ins.forEach(function(J){ out.push(J); });
        put(mv[q]);
      }
    }else{
      let zL=Math.max(plane,+p.z,+B.z);
      if(low){
        // Plongée verticale qui suit : le rapide s'arrête à la montée choisie au-dessus
        // de la matière, plutôt qu'à la hauteur de calcul du parcours (brut + Sortie).
        const N=mv[k+1];
        if(N&&!N.r&&!N.arc&&+N.z<+B.z&&Math.hypot(N.x-B.x,N.y-B.y)<=1e-9){
          const zB=low.top(B,B,R)+low.lift;
          if(zB<+B.z-1e-9&&zB>+N.z+1e-9)B={r:1,x:B.x,y:B.y,z:zB};
        }
        const top=low.top(p,B,R);
        zL=Math.max(Math.min(Math.max(+p.z,top)+low.lift,plane),+p.z,+B.z,top);
      }
      if(p.z<zL-1e-9)out.push({r:1,x:p.x,y:p.y,z:zL});
      if(B.z<zL-1e-9)out.push({r:1,x:B.x,y:B.y,z:zL});
      put(B);
    }
    i=k;
  }
  return out;
}
