// 2026-10-06 « FAO limite chaîne » — intégrité de la boucle XY (Chantier A)
// La boucle d'une limite « chaîne » est ASSEMBLÉE depuis des arêtes OCCT
// (faoOrderEdges → faoLoopFromChains). Deux défauts assemblaient une boucle
// fausse et le clip (faoClipMovesPoly) excluait alors une bande entière de
// matière — usinage incomplet visible sur l'aperçu :
//   1. une arête raccordée par son ARRIVÉE n'était pas inversée → le côté
//      correspondant disparaissait de la boucle ;
//   2. le 1er point de chaque maillon suivant était sauté aveuglément →
//      en plus du côté perdu, une corde parasite apparaissait.
// Symptôme sur le document réel : segment de 181,7 mm (le vrai plus long côté
// fait 157,663) et aire 22 454 mm² au lieu de 24 528 ; 26,3 mm de matière non
// usinée dans le coin supérieur droit.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
const json=require('./lire-projet.cjs')([path.join(ROOT,'tests','fixtures','cavite_usinage.minifusion.json'),path.join(ROOT,'Cavité Usinage.minifusion.json'),path.join(ROOT,'Exemples','Cavité Usinage.minifusion.json')].find(fs.existsSync));
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  sandbox.__docJson=json;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const out=await vm.runInContext(`(async function(){
    // --- outillage local -------------------------------------------------
    // Arête 2 points, dans l'ordre p0→p1 (inverse: true = enregistrée à l'envers).
    const mk=function(a,b,inverse){
      const p=inverse?[[b[0],b[1],0],[a[0],a[1],0]]:[[a[0],a[1],0],[b[0],b[1],0]];
      return {mid:[(a[0]+b[0])/2,(a[1]+b[1])/2,0],pts:p,len:Math.hypot(b[0]-a[0],b[1]-a[1]),sharp:true};
    };
    // Qualité d'une boucle : aire, plus long segment, fermeture, milieux dessus.
    const qual=function(edges,sel){
      const ch=faoOrderEdges(edges,sel||edges.map(function(_,i){return i;}));
      const r=faoLoopFromChains(edges,ch), loop=r.loop;
      let maxSeg=0,area=0;
      for(let i=0;i+1<loop.length;i++){
        const a=loop[i],b=loop[i+1];
        const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(d>maxSeg)maxSeg=d;
        area+=a[0]*b[1]-b[0]*a[1];
      }
      let eLen=0; edges.forEach(function(e){ if(e&&e.len>eLen)eLen=e.len; });
      let far=0;
      (sel||edges.map(function(_,i){return i;})).forEach(function(i){
        const e=edges[i];
        if(!e||!e.mid)return;
        const d=faoLoopDistTo(loop,[e.mid[0],e.mid[1]]);
        if(d>far)far=d;
      });
      return {loop:loop,closed:r.closed,maxSeg:maxSeg,area:Math.abs(area/2),
              maxEdge:eLen,farMid:far};
    };
    const R=[];

    // T1 — rectangle 40×30, ordre des indices mélangé + arêtes inversées.
    let E=[mk([0,0],[40,0],false),mk([40,0],[40,30],true),
           mk([40,30],[0,30],false),mk([0,30],[0,0],true)];
    let q=qual(E,[2,0,3,1]);
    R.push([Math.abs(q.area-1200)<1e-6,'T1 rectangle 40x30 : aire 1200 (obtenu '+q.area.toFixed(3)+')']);
    R.push([q.maxSeg<=50+1e-6,'T1 : aucun segment > le plus long côté (max '+q.maxSeg.toFixed(2)+' <= 50)']);
    R.push([q.closed===true,'T1 : boucle refermée d office']);
    R.push([q.farMid<1e-6,'T1 : tous les milieux d arete sur la boucle (max '+q.farMid.toExponential(1)+' mm)']);

    // T2 — mêmes 4 arêtes mais TOUTES enregistrées à l'envers (cas nominal régressif).
    E=[mk([0,0],[40,0],true),mk([40,0],[40,30],true),
       mk([40,30],[0,30],true),mk([0,30],[0,0],true)];
    q=qual(E,[1,3,0,2]);
    R.push([Math.abs(q.area-1200)<1e-6,'T2 toutes inversées : aire 1200 (obtenu '+q.area.toFixed(3)+')']);
    R.push([q.maxSeg<=50+1e-6,'T2 toutes inversées : pas de corde parasite (max '+q.maxSeg.toFixed(2)+')']);

    // T3 — hexagone régulier r=50, orientations quelconques, sel mélangé.
    E=[];
    for(let k=0;k<6;k++){
      const a0=k*Math.PI/3, a1=(k+1)*Math.PI/3;
      E.push(mk([50*Math.cos(a0),50*Math.sin(a0)],[50*Math.cos(a1),50*Math.sin(a1)],k%3===1));
    }
    q=qual(E,[5,2,0,4,1,3]);
    const a6=3*50*50*Math.sin(Math.PI/3);
    R.push([Math.abs(q.area-a6)<0.5,'T3 hexagone : aire '+(a6-0.5).toFixed(1)+' (obtenu '+q.area.toFixed(1)+')']);
    R.push([q.maxSeg<=50+1e-6,'T3 hexagone : segment max '+q.maxSeg.toFixed(2)+' <= 50']);
    R.push([q.farMid<1e-3,'T3 hexagone : milieux sur la boucle ('+q.farMid.toExponential(1)+' mm)']);

    // T5 — V0.99.66 (constat de Fred, STEP.conceptcad, ébauche 3D) : arêtes d'une
    // pièce importée qui NE SE TOUCHENT PAS à 1e-4 près → une chaîne par arête,
    // autrefois mises à la suite dans l'ordre des clics : 2 cordes croisées dans la
    // zone. Rectangle 40×30 coupé en 8 arêtes, jours de 2 µm, ordres variés.
    const cross=function(lp){let n=0;const s=function(p,q,r){return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);};
      for(let i=0;i+1<lp.length;i++)for(let k=i+2;k+1<lp.length;k++){if(i===0&&k===lp.length-2)continue;
        const A=lp[i],B=lp[i+1],C=lp[k],D=lp[k+1];if(s(A,B,C)*s(A,B,D)<0&&s(C,D,A)*s(C,D,B)<0)n++;}return n;};
    const P8=[[0,0],[20,0],[40,0],[40,15],[40,30],[20,30],[0,30],[0,15]];
    E=P8.map(function(a,k){const b=P8[(k+1)%8];return mk([a[0]+0.002*(k%2),a[1]],b,k%3===0);});
    let worst=0,aMin=1e9;
    [[0,1,2,3,4,5,6,7],[4,0,6,2,7,1,5,3],[7,3,1,5,0,6,2,4],[2,6,4,0,3,7,1,5]].forEach(function(o){
      const qq=qual(E,o);worst=Math.max(worst,cross(qq.loop));aMin=Math.min(aMin,qq.area);});
    R.push([worst===0,'T5 arêtes disjointes (jours 2 µm) : aucune corde croisée (max '+worst+')']);
    R.push([aMin>1199,'T5 arêtes disjointes : aire pleine '+aMin.toFixed(1)+' (≈1200)']);

    // T6 — V0.99.71 (constat de Fred, 5 poches pour une même zone) : deux carrés 10×10
    // disjoints (x 0..10 et 30..40), choisis ensemble, arêtes disjointes de 2 µm. Deux
    // contours reliés par un pont aller-retour : invisible, hors zone, ni bord ni croisement.
    const sq=function(x0){const Q=[[x0,0],[x0+10,0],[x0+10,10],[x0,10]];
      return Q.map(function(a,k){const b=Q[(k+1)%4];return mk([a[0]+0.002*(k%2),a[1]],b,k===2);});};
    E=sq(0).concat(sq(30));
    [[0,1,2,3,4,5,6,7],[4,0,6,2,7,1,5,3]].forEach(function(o,t){
      const ch=faoOrderEdges(E,o),r=faoLoopFromChains(E,ch,true),lp=r.loop,pb=faoLoopPonts(lp);
      let visMax=0;for(let i=0;i+1<lp.length;i++){if(pb&&pb[i])continue;
        visMax=Math.max(visMax,Math.hypot(lp[i+1][0]-lp[i][0],lp[i+1][1]-lp[i][1]));}
      const Lz={loop:lp,side:'out',extra:0};
      const dedans=faoLimInside(5,5,Lz,3)&&faoLimInside(35,5,Lz,3);
      const entre=faoLimInside(20,5,Lz,3)||faoLimInside(20,0.5,Lz,3);
      const tra=faoPolyCross(20,-5,20,15,lp);
      R.push([visMax<=10.01,'T6.'+t+' deux carrés : aucun trait visible entre eux (plus long '+visMax.toFixed(2)+' ≤ 10)']);
      R.push([dedans&&!entre,'T6.'+t+' deux carrés : dedans chacun, rien entre eux (Tout couvrir, r=3)']);
      R.push([!tra,'T6.'+t+' deux carrés : pont ignoré au croisement']);
      R.push([Math.abs(faoLoopArea(lp)-200)<0.1,'T6.'+t+' deux carrés : aire 200 ('+faoLoopArea(lp).toFixed(2)+')']);
    });
    // Contour / chanfrein (multi absent) : chaîne unique comme avant.
    R.push([!faoLoopPonts(faoLoopFromChains(E,faoOrderEdges(E,[0,1,2,3,4,5,6,7])).loop),'T6 sans multi : pas de pont (trajet unique)']);

    // T4 — DOCUMENT RÉEL : après rejeu, la boucle doit être intégre.
    await deserialise(__docJson,{rebuild:false});
    occCkClear();markDirty();
    await rebuild();
    try{ faoChainReplay(); }catch(e){}
    const op=doc.fao.setups[0].ops[1];
    const L=op.limit, loop=L.loop;
    let maxSeg=0,area=0,i;
    for(i=0;i+1<loop.length;i++){
      const a=loop[i],b=loop[i+1];
      const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(d>maxSeg)maxSeg=d;
      area+=a[0]*b[1]-b[0]*a[1];
    }
    area=Math.abs(area/2);
    R.push([maxSeg<=158,'T4 doc réel : segment max '+maxSeg.toFixed(2)+' <= 157,663 + marge (avant fix : 181,74)']);
    R.push([area>24000&&area<25000,'T4 doc réel : aire '+area.toFixed(0)+' ∈ [24000,25000] (avant fix : 22454)']);
    R.push([L.stale===false,'T4 doc réel : stale=false (ancre unique suivie)']);
    R.push([L.nEdges===8&&loop.length>100,'T4 doc réel : 8 arêtes, '+loop.length+' points']);
    // Le côté haut (y = +61,489, x de -78,832 à 78,832) doit exister : c'est lui
    // qui avait disparu et qui créait l'îlot de 26,3 mm non usiné.
    let topSeg=false;
    for(i=0;i+1<loop.length;i++){
      const a=loop[i],b=loop[i+1];
      if(Math.abs(a[1]-61.489)<0.01&&Math.abs(b[1]-61.489)<0.01&&
         Math.abs(a[0]-b[0])>150){topSeg=true;break;}
    }
    R.push([topSeg,'T4 doc réel : côté haut (157,663 mm à y=61,489) présent']);
    return R;
  })()`,ctx);
  out.forEach(function(r){ A(r[0],r[1]); });
  if(ko){ console.log('\n'+ko+' ECHEC(S)'); process.exit(1); }
  console.log('\nTOUT EST CONFORME');
  process.exit(0);
})().catch(e=>{console.error('ERREUR',e);process.exit(1);});
