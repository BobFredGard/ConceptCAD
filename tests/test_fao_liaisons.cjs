// V0.61.0 — rôle des plans : Dégagement = approche, changement d'outil, rotation ;
// Retrait = entre les passes ; « Retrait minimum » = montée au choix au-dessus de la
// matière survolée. Le contrôle de collision refait sa propre carte de matière,
// indépendante de celle de l'application, sur une pièce réelle.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
const json=require('./lire-projet.cjs')(path.join(ROOT,'tests','fixtures','cavite_usinage.minifusion.json'));
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real; sandbox.__docJson=json;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const out=await vm.runInContext(`(async function(){
    const R=[]; const A=function(c,m){ R.push([!!c,m]); };
    // translations XY en rapide d'une liste de mouvements
    const trans=function(mv,p0){ const o=[]; let p=p0||null;
      mv.forEach(function(m){ if(p&&m.r&&Math.hypot(m.x-p.x,m.y-p.y)>1e-9)o.push({a:p,b:m,z:Math.min(p.z,m.z)}); p=m; });
      return o; };

    // ---- 1. le cas de la capture : brut z1 = 5 ----
    const mk=function(cl,re,mode,lift){
      const J=faoDefaultSetup(); J.name='LIAISON'; J.stock={x0:0,y0:0,z0:-20,x1:100,y1:80,z1:5};
      J.planes={clear:{ref:'brutHaut',dz:cl},retr:{ref:'brutHaut',dz:re},mode:mode};
      if(lift)J.liftMin=lift;
      J.ops=[{id:'a',on:true,toolId:'T1',type:'pocket',x0:10,y0:10,x1:40,y1:70,ztop:5,zbot:-10,ap:5,ae:5},
             {id:'b',on:true,toolId:'T1',type:'pocket',x0:60,y0:10,x1:90,y1:70,ztop:5,zbot:-10,ap:5,ae:5},
             {id:'c',on:true,toolId:'T2',type:'facing',z:5,ae:6}];
      faoSanitiseOps(J);
      return J;
    };
    const zs=function(J){ const S=faoSeqSafe(J), appr=[], inner=[]; let last=null;
      S.forEach(function(b){ const T=trans(b.moves,last);
        T.forEach(function(t,i){ (i===0&&last?appr:inner).push(t.z); });
        if(b.moves.length)last=b.moves[b.moves.length-1];
        if(b.tail&&b.tail.length)last=b.tail[b.tail.length-1]; });
      return {appr:appr,inner:inner}; };
    let Z=zs(mk(100,5,'plan'));
    // V0.94.9 : changement d'outil (b → c, T1 → T2) : l'approche part droit au-dessus de
    // l'entrée de c, jamais d'abord à l'XY où b a fini ; b remonte sur place (tail)
    { const J=mk(100,5,'plan'), S=faoSeqSafe(J), b=S[1], c=S[2], fb=b.moves[b.moves.length-1], c0=c.moves[0], c1=c.moves[1];
      A(b.tail&&b.tail.length===1&&Math.abs(b.tail[0].x-fb.x)<1e-9&&Math.abs(b.tail[0].y-fb.y)<1e-9&&b.tail[0].z>=105-1e-6,
        'changement d’outil : l’outil précédent remonte sur place au dégagement');
      A(c0&&c0.r&&c0.z>=105-1e-6&&Math.hypot(c0.x-fb.x,c0.y-fb.y)>1e-6&&Math.abs(c0.x-c1.x)<1e-9&&Math.abs(c0.y-c1.y)<1e-9,
        'changement d’outil : 1er rapide directement au-dessus de l’entrée (pas de passage à l’XY de fin de l’outil précédent)');
      A(!S[0].tail,'même outil (a → b) : pas de remontée ajoutée'); }
    A(Z.appr.every(function(z){return z>=105-1e-6;}),'Dégagement 100, Retrait 5 : approche de chaque opération à 105');
    A(Z.inner.length>0&&Z.inner.every(function(z){return Math.abs(z-10)<1e-6;}),'Dégagement 100, Retrait 5 : entre passes à 10, jamais à 105 ('+Z.inner.length+' liaisons, maxi '+Math.max.apply(null,Z.inner)+')');
    Z=zs(mk(10,100,'plan'));
    A(Z.inner.length>0&&Z.inner.every(function(z){return Math.abs(z-105)<1e-6;}),'Retrait 100 : entre passes à 105');
    let code=faoPost(mk(100,5,'plan'),'siemens630').code;
    const oz=faoOriginPoint(mk(100,5,'plan'))[2];
    const f3=function(v){return (v-oz).toFixed(3);};
    const lignes=code.split(String.fromCharCode(10));
    const iT=lignes.findIndex(function(l,i){return i>0&&l.indexOf('OUTIL T')>=0&&lignes.slice(0,i).some(function(q){return q.indexOf('OUTIL T')>=0;});});
    A(iT>0&&lignes.slice(iT-3,iT).indexOf('G0 Z'+f3(105))>=0,'G-code : changement d’outil au dégagement');
    const lignesG0=code.split(String.fromCharCode(10)).filter(function(l){return l.indexOf('G0 X')===0&&l.indexOf(' Z'+f3(10))>0;});
    A(lignesG0.length>0,'G-code : liaisons au retrait ('+lignesG0.length+' lignes à Z'+f3(10)+')');

    // ---- 2. retrait minimum ----
    const lifts=[3,5,10].map(function(n){ const z=zs(mk(100,50,'min5',n)); return {n:n,inner:z.inner}; });
    A(lifts.every(function(q){return q.inner.length>0&&q.inner.every(function(z){return z<55-1e-6;});}),
      'retrait minimum : aucune liaison au plan de retrait (55)');
    A(Math.min.apply(null,lifts[0].inner)<Math.min.apply(null,lifts[2].inner),'retrait minimum : 3 mm passe plus bas que 10 mm');
    const J2=mk(100,50,'min5',3); J2.ops=[J2.ops[0]];
    const seq1=faoSeqSafe(J2)[0].moves;
    const dernier=seq1[seq1.length-1];
    const tt=trans(seq1,null).filter(function(t){return t.b!==dernier&&t.z<105;}); // ni l'approche ni la sortie finale
    A(tt.length>0&&tt.every(function(t){return t.z<=5+3+1e-6;}),'retrait minimum 3 : dans une poche, jamais plus de 3 mm au-dessus du brut');
    // matière entre deux zones déjà ouvertes : la liaison franchit le brut resté plein
    const J3=mk(100,50,'min5',3); J3.ops=[J3.ops[0]];
    const mv3=[{r:1,x:20,y:40,z:10},{x:20,y:40,z:-5},{x:30,y:40,z:-5},{r:1,x:30,y:40,z:10},{r:1,x:80,y:40,z:10},{x:80,y:40,z:-5}];
    const ctx3=faoLinkCtx(J3,J3.ops); ctx3.lift=3;
    const o3=faoOpLinks(J3,J3.ops[0],mv3,null,ctx3), t3=trans(o3,null).filter(function(t){return Math.abs(t.b.x-80)<1e-6;});
    A(t3.length===1&&Math.abs(t3[0].z-8)<1e-3,'matière restée entre deux zones : liaison à 3 mm au-dessus du brut ('+(t3[0]&&t3[0].z)+')');
    const mv4=[{r:1,x:15,y:15,z:10},{x:15,y:15,z:-5}];
    for(let y=15;y<=65;y+=5){ mv4.push({x:15,y:y,z:-5}); mv4.push({x:85,y:y,z:-5}); mv4.push({x:15,y:y,z:-5}); }
    mv4.push({x:40,y:40,z:-5},{r:1,x:40,y:40,z:10},{r:1,x:60,y:40,z:10},{x:60,y:40,z:-5});
    const ctx4=faoLinkCtx(J3,J3.ops); ctx4.lift=3;
    const t4=trans(faoOpLinks(J3,J3.ops[0],mv4,null,ctx4),null).filter(function(t){return Math.abs(t.a.x-40)<1e-6;});
    A(t4.length===1&&Math.abs(t4[0].z-(-2))<1e-3,'zone déjà ouverte : liaison à 3 mm au-dessus du fond ('+(t4[0]&&t4[0].z)+')');
    const haut=zs(mk(100,1,'min5',20)).inner;
    A(haut.every(function(z){return z<=6+1e-6;}),'retrait minimum : le plan de retrait reste le plafond');
    // sans bouger les parcours
    const JK=mk(100,50,'min5',5); const k1=faoOpMovesKey(JK.ops[0],JK); JK.liftMin=2;
    A(k1===faoOpMovesKey(JK.ops[0],JK),'changer le retrait minimum ne périme aucun parcours');
    const JS=mk(100,50,'min5',-1); A(JS.liftMin===undefined,'valeur négative retirée à l’ouverture');

    // ---- 3. pièce réelle : collision contrôlée par une carte indépendante ----
    await deserialise(__docJson,{rebuild:false});
    occCkClear();markDirty();await rebuild();
    faoMeshFromBody=function(b){
      try{
        if(!b||!b.shape)return null;
        const D=occXDefl();
        new occt.BRepMesh_IncrementalMesh_2(b.shape,D.lin,false,D.ang,false);
        const v=[],t=[],map={};
        const ex=new occt.TopExp_Explorer_2(b.shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
        while(ex.More()){
          const f=occt.TopoDS.Face_1(ex.Current());
          const loc=new occt.TopLoc_Location_1();
          try{
            const h=occt.BRep_Tool.Triangulation(f,loc);
            if(h&&!h.IsNull()){
              const tr=h.get(),nt=tr.NbTriangles();
              const trsf=loc.IsIdentity()?null:loc.Transformation();
              for(let i=1;i<=nt;i++){
                const T=tr.Triangle(i), idx=[T.Value(1),T.Value(2),T.Value(3)], tri=[];
                for(const k of idx){
                  const p=tr.Node(k);let x,y,z;
                  if(trsf){const q=p.Transformed(trsf);x=q.X();y=q.Y();z=q.Z();}else{x=p.X();y=p.Y();z=p.Z();}
                  const key=x.toFixed(4)+","+y.toFixed(4)+","+z.toFixed(4);
                  let j=map[key];if(j===undefined){j=v.length;v.push([x,y,z]);map[key]=j;}
                  tri.push(j);
                }
                t.push(tri);
              }
            }
          }catch(e){}
          try{loc.delete();}catch(e){}
          ex.Next();
        }
        try{ex.delete();}catch(e){}
        return (v.length&&t.length)?{v:v,t:t}:null;
      }catch(e){return null;}
    };
    const job=faoDoc();
    const longueurG0=function(sq){ let L=0,p=null; sq.forEach(function(b){ b.moves.forEach(function(m){ if(p&&m.r)L+=Math.hypot(m.x-p.x,m.y-p.y,m.z-p.z); p=m; }); }); return L; };
    job.planes=Object.assign({},job.planes||{},{mode:'min5'}); job.liftMin=3;
    const t0=Date.now(); const sq=faoSeqSafe(job); const dtGen=Date.now()-t0;
    const t1=Date.now(); faoSeqSafe(job); const dt=Date.now()-t1;
    // carte indépendante : maille 0,5 mm, brut plein, enlèvement = centre de maille sous l'outil
    const st=job.stock, c=0.5, nx=Math.ceil((st.x1-st.x0)/c)+1, ny=Math.ceil((st.y1-st.y0)/c)+1;
    const H=new Float32Array(nx*ny).fill(st.z1);
    const hit=function(x,y,r,z){ // matière au-dessus de z sous le disque ?
      const n=Math.ceil(r/c), ci=Math.round((x-st.x0)/c), cj=Math.round((y-st.y0)/c); let top=-Infinity;
      for(let j=-n;j<=n;j++)for(let i=-n;i<=n;i++){ if(i*i+j*j>n*n)continue; const a=ci+i,b=cj+j;
        if(a<0||b<0||a>=nx||b>=ny)continue; const h=H[b*nx+a]; if(h>top)top=h; }
      return top>z+1e-3?top:null; };
    const cut=function(x,y,R,kind,rc,z){ const n=Math.ceil(R/c), ci=Math.round((x-st.x0)/c), cj=Math.round((y-st.y0)/c);
      for(let j=-n;j<=n;j++)for(let i=-n;i<=n;i++){ const d=Math.hypot(i,j)*c; if(d>R)continue; const a=ci+i,b=cj+j;
        if(a<0||b<0||a>=nx||b>=ny)continue;
        const e=d-(R-rc), h=z+((rc>0&&e>0)?rc-Math.sqrt(Math.max(0,rc*rc-e*e)):0);
        if(h<H[b*nx+a])H[b*nx+a]=h; } };
    let nL=0,nC=0,pire=0; let last=null;
    sq.forEach(function(b){
      const t=faoToolById(job,b.op.toolId), Rt=(+t.d)/2, kind=t.kind;
      const rc=kind==='ball'?Rt:(kind==='bull'?(+t.cornerR||0):0), usine=kind==='flat'||kind==='ball'||kind==='bull';
      let p=last;
      b.moves.forEach(function(m){
        if(p){
          const L=Math.hypot(m.x-p.x,m.y-p.y), n=Math.max(1,Math.ceil(L/0.5));
          if(m.r){ if(L>1e-9){ nL++;
            for(let i=0;i<=n;i++){ const u=i/n, zz=Math.min(p.z,m.z);
              const h=hit(p.x+(m.x-p.x)*u,p.y+(m.y-p.y)*u,Rt,zz);
              if(h!==null){ nC++; if(h-zz>pire)pire=h-zz; break; } } } }
          else if(usine&&!b.op.frame){
            const pts=m.arc?faoArcSegs(p,m):null;
            if(pts&&pts.length)pts.forEach(function(q){ cut(q[0],q[1],Rt,kind,rc,q[2]); });
            else for(let i=0;i<=n;i++){ const u=i/n; cut(p.x+(m.x-p.x)*u,p.y+(m.y-p.y)*u,Rt,kind,rc,p.z+(m.z-p.z)*u); }
          }
        }
        p=m;
      });
      last=p;
    });
    A(nL>20,'pièce réelle : '+nL+' translations rapides contrôlées');
    A(nC===0,'pièce réelle, retrait minimum 3 : aucune traversée de matière ('+nC+', pire '+pire.toFixed(2)+' mm)');
    A(dt<3000,'carte de matière : '+dt+' ms par séquence (1re : '+dtGen+' ms)');
    const lgMin=longueurG0(sq);
    job.planes=Object.assign({},job.planes,{clear:{ref:'brutHaut',dz:100},mode:'plan',retr:{ref:'brutHaut',dz:100}});
    const lgPlan=longueurG0(faoSeqSafe(job));
    A(lgMin<lgPlan,'pièce réelle : rapides '+Math.round(lgMin)+' mm en retrait minimum contre '+Math.round(lgPlan)+' mm au plan haut');
    return R;
  })()`,ctx);
  out.forEach(function(r){ A(r[0],r[1]); });
  if(ko){ console.log('\n'+ko+' ECHEC(S)'); process.exit(1); }
  console.log('\nTOUT EST CONFORME');
  process.exit(0);
})().catch(e=>{console.error('ERREUR',e);process.exit(1);});
