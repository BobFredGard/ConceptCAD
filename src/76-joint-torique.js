/* ═══════════════════════════════════════════════════════════════════════════
   GORGE DE JOINT TORIQUE AUTOMATIQUE (arbres, alésages, faces planes circulaires)
   « CAO : Normalisés -> j'aimerais pouvoir ajouter, un peu comme pour les clavettes, des joints toriques
   normalisés pour arbre et faces circulaires planes »
   Un clic, comme la clavette (76-clavette) :
     · face cylindrique extérieure = ARBRE (piston) : gorge radiale dans l'arbre, joint étiré sur le fond ;
     · face cylindrique intérieure = ALÉSAGE (tige) : gorge radiale dans l'alésage, joint serré par son Ø ext. ;
     · face PLANE à bord circulaire = gorge AXIALE (face de bride, couvercle) : joint contre la paroi
       extérieure (pression intérieure) ou intérieure (pression extérieure).
   Le Ø lu sur la pièce donne la section d2 (ou celle choisie), la gorge d'ISO 3601-2 (largeur, profondeur)
   et le joint de la série ISO 3601-1 classe A (= AS568) qui convient. Trois éléments ordinaires :
     • un repère masqué (78) qui porte les réglages : el.orj — zx (origine et axe = le cylindre) ou
       face (centre de la face, Z = normale, recentré sur le cercle extérieur par dx, dy) ;
     • une esquisse dans son plan XZ (contient l'axe), contour RÉÉCRIT par orjSync à chaque rejeu,
       et une révolution en découpe f.orj = id du repère ;
     • le joint : une seconde esquisse (un cercle Ø d2) et une révolution en NOUVEAU CORPS, f.orjRing.
   Tout suit le Ø : un arbre de 30 passé à 40 change de joint tout seul. Répétition, FAO, mise en plan :
   une révolution ordinaire.
   el.orj = {mode:'shaft'|'bore'|'face', d2 (0 = auto), d1 (0 = auto), dyn (radial : dynamique),
             press:'int'|'ext' (face), pos (radial : centre de la gorge depuis le bout, null = milieu),
             ob, ot (largeur et profondeur saisies, 0 = norme), ring (joint posé)}
   Esquisses : X = rayon, Y = le long de l'axe (radial) ou de la normale sortante (face).
   Angles de fond de gorge vifs (r1 de la norme non modélisé : sans effet sur le joint ni sur la FAO d'ébauche).
   ═══════════════════════════════════════════════════════════════════════════ */
const ORJ_OVER=1; // mm : l'outil dépasse de la matière (jamais de face confondue)
// Sections ISO 3601-1 classe A (AS568) : d2, n° de série de base, Ø intérieurs d1 (mm)
const ORJ_CS=[1.78,2.62,3.53,5.33,6.99];
const ORJ_ID={
  1.78:[[4,1.78],[5,2.57],[6,2.9],[7,3.68],[8,4.47],[9,5.28],[10,6.07],[11,7.65],[12,9.25],[13,10.82],[14,12.42],[15,14],
    [16,15.6],[17,17.17],[18,18.77],[19,20.35],[20,21.95],[21,23.52],[22,25.12],[23,26.7],[24,28.3],[25,29.87],[26,31.47],
    [27,33.05],[28,34.65],[29,37.82],[30,41],[31,44.17],[32,47.35],[33,50.52],[34,53.7],[35,56.87],[36,60.05],[37,63.22],
    [38,66.4],[39,69.57],[40,72.75],[41,75.92],[42,82.27],[43,88.62],[44,94.97],[45,101.32],[46,107.67],[47,114.02],
    [48,120.37],[49,126.72],[50,133.07]],
  2.62:[[102,1.24],[103,2.06],[104,2.84],[105,3.63],[106,4.42],[107,5.23],[108,6.02],[109,7.59],[110,9.19],[111,10.77],
    [112,12.37],[113,13.94],[114,15.54],[115,17.12],[116,18.72],[117,20.29],[118,21.89],[119,23.47],[120,25.07],[121,26.64],
    [122,28.24],[123,29.82],[124,31.42],[125,32.99],[126,34.59],[127,36.17],[128,37.77],[129,39.34],[130,40.94],[131,42.52],
    [132,44.12],[133,45.69],[134,47.29],[135,48.9],[136,50.47],[137,52.07],[138,53.64],[139,55.25],[140,56.82],[141,58.42],
    [142,59.99],[143,61.6],[144,63.17],[145,64.77],[146,66.34],[147,67.95],[148,69.52],[149,71.12],[150,72.69],[151,75.87],
    [152,82.22],[153,88.57],[154,94.92],[155,101.27],[156,107.62],[157,113.97],[158,120.32],[159,126.67],[160,133.02],
    [161,139.37],[162,145.72],[163,152.07],[164,158.42],[165,164.77],[166,171.12],[167,177.47],[168,183.82],[169,190.17],
    [170,196.52],[171,202.87],[172,209.22],[173,215.57],[174,221.92],[175,228.27],[176,234.62],[177,240.97],[178,247.32]],
  3.53:[[201,4.34],[202,5.94],[203,7.52],[204,9.12],[205,10.69],[206,12.29],[207,13.87],[208,15.47],[209,17.04],[210,18.64],
    [211,20.22],[212,21.82],[213,23.39],[214,24.99],[215,26.57],[216,28.17],[217,29.74],[218,31.34],[219,32.92],[220,34.52],
    [221,36.09],[222,37.69],[223,40.87],[224,44.04],[225,47.22],[226,50.39],[227,53.57],[228,56.74],[229,59.92],[230,63.09],
    [231,66.27],[232,69.44],[233,72.62],[234,75.79],[235,78.97],[236,82.14],[237,85.32],[238,88.49],[239,91.67],[240,94.84],
    [241,98.02],[242,101.19],[243,104.37],[244,107.54],[245,110.72],[246,113.89],[247,117.07],[248,120.24],[249,123.42],
    [250,126.59],[251,129.77],[252,132.94],[253,136.12],[254,139.29],[255,142.47],[256,145.64],[257,148.82],[258,151.99],
    [259,158.34],[260,164.69],[261,171.04],[262,177.39],[263,183.74],[264,190.09],[265,196.44],[266,202.79],[267,209.14],
    [268,215.49],[269,221.84],[270,228.19],[271,234.54],[272,240.89],[273,247.24],[274,253.59],[275,266.29],[276,278.99],
    [277,291.69],[278,304.39],[279,329.79],[280,355.19],[281,380.59],[282,405.26],[283,430.66],[284,456.06]],
  5.33:[[309,10.46],[310,12.07],[311,13.64],[312,15.24],[313,16.81],[314,18.42],[315,19.99],[316,21.59],[317,23.16],
    [318,24.77],[319,26.34],[320,27.94],[321,29.51],[322,31.12],[323,32.69],[324,34.29],[325,37.47],[326,40.64],[327,43.82],
    [328,46.99],[329,50.17],[330,53.34],[331,56.52],[332,59.69],[333,62.87],[334,66.04],[335,69.22],[336,72.39],[337,75.57],
    [338,78.74],[339,81.92],[340,85.09],[341,88.27],[342,91.44],[343,94.62],[344,97.79],[345,100.97],[346,104.14],
    [347,107.32],[348,110.49],[349,113.67],[350,116.84],[351,120.02],[352,123.19],[353,126.37],[354,129.54],[355,132.72],
    [356,135.89],[357,139.07],[358,142.24],[359,145.42],[360,148.59],[361,151.77],[362,158.12],[363,164.47],[364,170.82],
    [365,177.17],[366,183.52],[367,189.87],[368,196.22],[369,202.57],[370,208.92],[371,215.27],[372,221.62],[373,227.97],
    [374,234.32],[375,240.67],[376,247.02],[377,253.37],[378,266.07],[379,278.77],[380,291.47],[381,304.17],[382,329.57],
    [383,354.97],[384,380.37],[385,405.26],[386,430.66],[387,456.06],[388,481.46],[389,506.86],[390,532.26],[391,557.66],
    [392,582.68],[393,608.08],[394,633.48],[395,658.88]],
  6.99:[[425,113.67],[426,116.84],[427,120.02],[428,123.19],[429,126.37],[430,129.54],[431,132.72],[432,135.89],
    [433,139.07],[434,142.24],[435,145.42],[436,148.59],[437,151.77],[438,158.12],[439,164.47],[440,170.82],[441,177.17],
    [442,183.52],[443,189.87],[444,196.22],[445,202.57],[446,215.27],[447,227.97],[448,240.67],[449,253.37],[450,266.07],
    [451,278.77],[452,291.47],[453,304.17],[454,316.87],[455,329.57],[456,342.27],[457,354.97],[458,367.67],[459,380.37],
    [460,393.07],[461,405.26],[462,417.96],[463,430.66],[464,443.36],[465,456.06],[466,468.76],[467,481.46],[468,494.16],
    [469,506.86],[470,532.26],[471,557.66],[472,582.68],[473,608.08],[474,633.48],[475,658.88]]
};
// ISO 3601-2 (gorges sans bague anti-extrusion), cotes nominales : [d2, radial statique t, b1, radial dynamique t, b1, axial h, b4]
const ORJ_GORGE=[[1.78,1.3,2.4,1.45,2.4,1.3,2.6],[2.62,2,3.6,2.25,3.6,2,3.8],[3.53,2.7,4.8,3.1,4.8,2.7,5],
  [5.33,4.3,7.1,4.7,7.1,4.3,7.3],[6.99,5.8,9.5,6.1,9.5,5.8,9.7]]; // catalogue Trelleborg (suit ISO 3601-2), recoupé ERIKS à 0,1 mm
const ORJ_MODES=[['shaft','Arbre (gorge dans l’arbre)'],['bore','Alésage (gorge dans l’alésage)']];
function orjGorge(d2){return ORJ_GORGE.find(r=>Math.abs(r[0]-d2)<1e-6)||ORJ_GORGE[1];}
function orjAutoCs(D){
  // Section d'usage courant selon le Ø (petits Ø : section fine)
  return D<12?1.78:D<35?2.62:D<110?3.53:D<250?5.33:6.99;
}
function orjRows(d2){return ORJ_ID[d2]||ORJ_ID[2.62];}
function orjRef(d2,dash){return 'ISO 3601-1 A / AS568-'+String(dash).padStart(3,'0');}
function orjPickRing(o,d2,goal){
  // goal : {shaft:Ø fond} | {bore:Ø fond} | {mid:Ø moyen visé} → [dash,d1] ou null
  const L=orjRows(d2);
  if(+o.d1>0){const r=L.find(x=>Math.abs(x[1]-o.d1)<0.005);if(r)return r;}
  if(goal.shaft!=null){let b=null;L.forEach(r=>{if(r[1]<=goal.shaft+1e-9)b=r;});return b||L[0];}
  if(goal.bore!=null)return L.find(r=>r[1]+2*d2>=goal.bore-1e-9)||L[L.length-1];
  let b=L[0];L.forEach(r=>{if(Math.abs(r[1]+d2-goal.mid)<Math.abs(b[1]+d2-goal.mid))b=r;});return b;
}
function orjSketchOf(el,role){return (doc.sketches||[]).find(s=>s.plane==='CG'&&s.cg&&s.cg.id===el.id&&s.orjRole===role)||null;}
function orjFeature(el){return (doc.features||[]).find(f=>f&&f.orj===el.id)||null;}
function orjRingFeature(el){return (doc.features||[]).find(f=>f&&f.orjRing===el.id)||null;}
function orjNewSketch(el,role,name){
  const sk={id:uid('sk'),name:'Esquisse '+(doc.sketches.length+1)+' ('+name+')',plane:'CG',cg:{id:el.id,sub:'XZ'},
    points:{},entities:[],constraints:[],dims:[],seq:1,visible:false,origin:[0,0,0],orjRole:role};
  cgSyncSketch(sk);doc.sketches.push(sk);return sk;
}
function orjWrite(sk,f,shape,ya){
  // shape : contour [[x,y],…] ou {c:[x,y],r} ; l'axe (trait de construction x = 0) est réécrit avec lui
  const sig=JSON.stringify([shape,+ya.toFixed(4)],(k,v)=>typeof v==='number'?+v.toFixed(6):v);
  if(sk.orjSig!==sig||!(sk.entities||[]).length){
    sk.points={};sk.entities=[];sk.constraints=[];sk.dims=[];sk.seq=1;
    const a=addPoint(sk,0,ya-1),b=addPoint(sk,0,ya+1);
    sk.entities.push({id:skNewEid(sk),t:'line',p1:a,p2:b,construction:true});
    if(Array.isArray(shape))stdLoop(sk,shape);
    else sk.entities.push({id:skNewEid(sk),t:'circle',pc:addPoint(sk,shape.c[0],shape.c[1]),r:shape.r});
    sk.orjSig=sig;
  }
  const ax=(sk.entities||[]).find(e=>e.t==='line'&&e.construction);
  if(f&&ax)f.axis={k:'line',id:ax.id};
}
/* ----- géométrie : radial (cylindre) ou axiale (face plane) ----- */
function orjRadial(el,g0,c){
  const o=el.orj,A=g0&&g0.axis;
  if(!A||!(A.r>0)||!(A.t1>A.t0))throw new Error('cylindre introuvable');
  const R=+A.r,D=2*R,cd=cgCylDir(A.d),same=cgDot(cgUnit(A.d),cd)>0;
  const s0=same?A.t0:-A.t1,s1=same?A.t1:-A.t0,Lc=s1-s0,bore=o.mode==='bore',warn=[];
  const d2=+o.d2>0?+o.d2:orjAutoCs(D),G=orjGorge(d2);
  const t=+o.ot>0?+o.ot:(o.dyn?G[3]:G[1]),b=+o.ob>0?+o.ob:(o.dyn?G[4]:G[2]);
  const pos=o.pos!=null&&isFinite(+o.pos)?+o.pos:Lc/2;
  if(pos-b/2<-1e-6||pos+b/2>Lc+1e-6)warn.push('la gorge dépasse du cylindre (longueur '+stdF(+Lc.toFixed(2))+')');
  const fr=el.fr,P=cgAdd(A.o,cgMul(cd,s0+pos)),yc=cgDot(cgSub(P,cgArr(fr.o)),cgArr(fr.z));
  const Rb=bore?R+t:R-t;
  if(!(Rb>0.2))throw new Error('arbre trop petit pour cette section');
  const x0=bore?Math.max(R-ORJ_OVER,R*0.5):Rb,x1=bore?Rb:R+ORJ_OVER;
  if(bore){
    const sh=cgShapeFor(c),fz=cgArr(fr.z),fx=cgArr(fr.x);
    if(sh){try{const q=cgAdd(cgAdd(cgArr(fr.o),cgMul(fz,yc)),cgMul(fx,Rb+0.3));if(!kwProbe(sh,[q])[0])warn.push('paroi trop mince : la gorge traverse');}catch(e){}}
  }
  const ring=orjPickRing(o,d2,bore?{bore:2*Rb}:{shaft:2*Rb});
  const d1=ring[1];
  // étirement (arbre) : Ø fond / d1 ; serrage du Ø extérieur (alésage) : (d1 + 2 d2) / Ø fond
  const k=bore?(d1+2*d2)/(2*Rb)-1:(2*Rb)/d1-1;
  if(bore&&k<-1e-6)warn.push('joint trop petit : son Ø extérieur '+stdF(+(d1+2*d2).toFixed(2))+' ne touche pas le fond Ø '+stdF(+(2*Rb).toFixed(2)));
  else if(!bore&&k<-1e-6)warn.push('joint trop grand : d1 '+stdF(d1)+' > Ø du fond '+stdF(+(2*Rb).toFixed(2)));
  else if(k>(bore?0.05:0.06))warn.push((bore?'serrage':'étirement')+' de '+stdF(+(k*100).toFixed(1))+' % : au-delà de l’usage ('+(bore?'≤ 3 %':'1 à 5 %')+')');
  const xc=bore?Rb-d2/2:Rb+d2/2;
  return {D,d2,t,b,pos,Lc,yc,ring,k,warn,
    groove:[[x0,yc-b/2],[x1,yc-b/2],[x1,yc+b/2],[x0,yc+b/2]],circ:{c:[xc,yc],r:d2/2}};
}
function orjFaceBounds(P){
  // Bords d'une face plane → {cc (centre), Rin, Rout, round}. Face RONDE (disque, couronne, bride ronde) :
  // le plus grand cercle est le bord extérieur, Rin = cercle concentrique intérieur. Sinon (plaque de toute
  // forme percée) : le plus grand cercle est un TROU, Rin = son rayon, Rout = distance au bord le plus proche.
  const E=P.edges||[],full=e=>e.k==='circ'&&e.r>0&&Math.abs(Math.abs(e.u1-e.u0)-2*Math.PI)<1e-3;
  const C=E.filter(full);
  if(!C.length)throw new Error('cette face n’a pas de bord circulaire : choisissez une arête (⌖) ou saisissez un Ø d’appui');
  let big=C[0];C.forEach(e=>{if(e.r>big.r)big=e;});
  const cc=cgArr(big.c),dc=q=>cgLen(cgSub(cgArr(q),cc));
  const conc=C.filter(e=>dc(e.c)<0.01),oth=E.filter(e=>conc.indexOf(e)<0);
  let near=Infinity,far=0;
  oth.forEach(e=>{
    if(e.k==='circ'){const d=dc(e.c);near=Math.min(near,Math.max(0,d-e.r));far=Math.max(far,d+e.r);return;}
    const Q=e.pts||[];
    for(let k=0;k<Q.length;k++){
      far=Math.max(far,dc(Q[k]));
      if(k){const a=cgArr(Q[k-1]),b=cgArr(Q[k]),ab=cgSub(b,a),L2=cgDot(ab,ab);
        const t=L2>0?Math.max(0,Math.min(1,cgDot(cgSub(cc,a),ab)/L2)):0;near=Math.min(near,cgLen(cgSub(cc,cgAdd(a,cgMul(ab,t)))));}
      else near=Math.min(near,dc(Q[k]));
    }
  });
  if(far<=big.r+1e-6){
    // le grand cercle entoure tout : bord extérieur (les trous décentrés d'une bride sont ignorés)
    let Rin=0;conc.forEach(e=>{if(e!==big&&e.r>Rin)Rin=e.r;});
    return {cc,Rin,Rout:big.r,round:true};
  }
  return {cc,Rin:big.r,Rout:near,round:false};
}
function orjEdgeCircle(el,c){
  // Arête circulaire choisie (el.orj.eref) → {c, r, n} sur la pièce d'avant la gorge, ou null
  const ref=el.orj&&el.orj.eref;if(!ref)return null;
  const sh=cgShapeFor(c);if(!sh)return null;
  const edges=cgEdgesOf(sh,c),i=cgFindEdge(edges,ref);if(i<0)return null;
  const G=cgEdgeGeom(edges[i].pts);if(!G||!G.circ)return null;
  ref.pos=edges[i].mid.map(v=>+v.toFixed(4));ref.len=+edges[i].len.toFixed(4); // la référence suit l'arête
  return {c:G.circ.c,r:G.circ.r,n:G.circ.n};
}
function orjFace(el,g0,c){
  const o=el.orj,P=g0&&g0.plane,warn=[];
  if(!P)throw new Error('face plane introuvable');
  const nP=cgUnit(cgArr(P.n));
  let B=null;try{B=orjFaceBounds(P);}catch(e){if(!o.eref&&!(+o.dw>0))throw e;}
  // Ø d'appui : arête choisie (elle donne aussi le centre) ou valeur saisie ; sinon automatique
  let Dw=0,cc=B?B.cc:cgArr(el.fr.o);
  if(o.eref){
    const K=orjEdgeCircle(el,c);
    if(!K)warn.push('arête choisie introuvable (la pièce a changé) : Ø automatique');
    else{
      if(Math.abs(cgDot(cgUnit(K.n),nP))<0.999)warn.push('l’arête choisie n’est pas parallèle à la face');
      Dw=2*K.r;cc=cgArr(K.c);
      cc=cgSub(cc,cgMul(nP,cgDot(cgSub(cc,cgArr(el.fr.o)),nP))); // ramené dans le plan de la face
    }
  }else if(+o.dw>0)Dw=+o.dw;
  if(!B){if(!(Dw>0))throw new Error('Ø d’appui manquant');B={cc,Rin:0,Rout:Infinity,round:true};}
  // le repère se recentre (face de bride à trous, boîte décentrée, cercle d'une arête)
  const fr=el.fr,dv=cgSub(cc,cgArr(fr.o)),ex=cgDot(dv,cgArr(fr.x)),ey=cgDot(dv,cgArr(fr.y));
  if(Math.hypot(ex,ey)>1e-6){el.p.dx=+((+el.p.dx||0)+ex).toFixed(6);el.p.dy=+((+el.p.dy||0)+ey).toFixed(6);cgResolveOne(el,c);}
  const conc=cgLen(cgSub(cc,B.cc))<0.01,Rin=conc?B.Rin:0,Rout=conc?B.Rout:Infinity,ext=o.press==='ext';
  // Ø moyen visé sans Ø d'appui : milieu d'une face ronde ; près du trou d'une plaque (portée = max(1,5 ; d2))
  let d2=+o.d2>0?+o.d2:orjAutoCs(Dw||(B.round?Rin+Rout:2*Rin+6));
  if(!(+o.d2>0)&&!Dw&&isFinite(Rout))while(d2>ORJ_CS[0]&&orjGorge(d2)[6]>0.6*(Rout-Rin))d2=ORJ_CS[ORJ_CS.indexOf(d2)-1];
  const G=orjGorge(d2),h=+o.ot>0?+o.ot:G[5],b=+o.ob>0?+o.ob:G[6];
  let ring,ri,ro;
  if(o.place!=='wall'){
    // Par défaut : joint CENTRÉ dans la gorge (même jeu des deux côtés). Ø visé = Ø moyen du joint (axe de sa
    // section) : le Ø d'appui saisi ou pris sur une arête, sinon le milieu de la face ou près du trou
    const land=Math.max(1.5,d2),Dm=Dw||(B.round?Rin+Rout:2*(Rin+land+b/2));
    ring=orjPickRing(o,d2,{mid:Dm});
    const Rm=(ring[1]+d2)/2;ri=Rm-b/2;ro=Rm+b/2;
    if(Dw&&Math.abs(2*Rm-Dw)>0.03*Dw)warn.push('aucun joint normalisé proche : Ø moyen '+stdF(+(2*Rm).toFixed(2))+' pour '+stdF(+Dw.toFixed(2))+' visé');
  }else if(Dw){
    // pression intérieure : la paroi extérieure de la gorge est au Ø d'appui, Ø ext. du joint 1 à 3 % au-dessus ;
    // extérieure : la paroi intérieure y est, Ø int. du joint 1 à 3 % au-dessous
    const L=orjRows(d2),man=+o.d1>0&&L.find(x=>Math.abs(x[1]-o.d1)<0.005);
    if(man)ring=man;
    else if(ext){ring=null;L.forEach(r=>{if(r[1]<=Dw/1.01+1e-9)ring=r;});ring=ring||L[0];}
    else ring=L.find(r=>r[1]+2*d2>=Dw*1.01-1e-9)||L[L.length-1];
    if(ext){ri=Dw/2;ro=ri+b;}else{ro=Dw/2;ri=ro-b;}
    const k=ext?1-ring[1]/Dw:(ring[1]+2*d2)/Dw-1;
    if(k<-1e-6)warn.push(ext?'joint trop grand pour la paroi intérieure Ø '+stdF(+Dw.toFixed(2)):'joint trop petit : son Ø ext. '+stdF(+(ring[1]+2*d2).toFixed(2))+' ne touche pas la paroi Ø '+stdF(+Dw.toFixed(2)));
    else if(k>0.03+1e-6)warn.push('écart de '+stdF(+(k*100).toFixed(1))+' % avec la paroi d’appui : au-delà de l’usage (1 à 3 %)');
  }else{
    const land=Math.max(1.5,d2),Dm=B.round?Rin+Rout:2*(Rin+land+b/2);
    ring=orjPickRing(o,d2,{mid:Dm});
    const d1=ring[1];
    ri=ext?d1*1.01/2:(d1+2*d2)/1.01/2-b;ro=ri+b;
  }
  if(!(ri>0.2))throw new Error('Ø d’appui trop petit pour cette section');
  if(ri<Rin+0.5-1e-6||ro>Rout-0.5+1e-6)warn.push('la gorge sort de la face (Ø '+stdF(+(2*Rin).toFixed(2))+' à '+(isFinite(Rout)?stdF(+(2*Rout).toFixed(2)):'…')+') : choisissez un autre joint ou un autre Ø');
  const xc=o.place!=='wall'?(ri+ro)/2:ext?ri+d2/2:ro-d2/2;
  return {D:isFinite(Rout)?2*Rout:2*ro,Din:2*Rin,Dw,d2,t:h,b,ri,ro,ring,warn,yc:0,
    groove:[[ri,-h],[ro,-h],[ro,ORJ_OVER],[ri,ORJ_OVER]],circ:{c:[xc,-h+d2/2],r:d2/2}};
}
function orjEdgePick(f){
  // Panneau → ⌖ : clic sur une arête circulaire (bord de trou, cercle de la pièce)
  holeFacePick={which:'cylOrjEdge',fid:f.id};
  try{renderer.domElement.style.cursor='crosshair';}catch(e){}
  try{faceEl.textContent='Joint torique : cliquez une ARÊTE CIRCULAIRE — son Ø devient le Ø d’appui du joint, son centre celui de la gorge (Échap = annuler).';}catch(e){}
}
function orjEdgePickAt(e){
  const W=holeFacePick,f=doc.features.find(x=>x.id===W.fid),el=f&&cgGet(f.orj);
  const msg=t=>{try{faceEl.textContent='Joint torique : '+t;}catch(err){}};
  if(!el){holeFacePickCancel();return false;}
  let E=null;try{E=cgEdgeUnder(e,pick(e));}catch(err){}
  const G=E&&cgEdgeGeom(E.pts);
  if(!G||!G.circ){msg('aucune arête circulaire sous le curseur.');return true;}
  const ref={k:'edge',pos:E.mid.map(v=>+v.toFixed(4)),len:+E.len.toFixed(4),name:entName('edge')};
  try{const a=xAnchorFor(E.mid);if(a)ref.anchor=a;}catch(err){}
  holeFacePickCancel();
  orjSetEdge(el,ref);
  sel={kind:'feature',id:f.id};
  markDirty();rebuild();renderTree();renderProps();
  msg('arête retenue, Ø '+stdF(+(2*G.circ.r).toFixed(3))+'.');
  return true;
}
function orjSetEdge(el,ref){docPushUndo('joint torique : arête d’appui');el.orj.eref=ref;el.orj.dw=0;el.orj.d1=0;}
function orjSync(el,ctx){
  // Réécrit gorge et joint d'après la pièce. Appelé par cgResolveAll, repère tout juste résolu.
  if(!el||!el.orj||!el.fr)return;
  const skG=orjSketchOf(el,'g');if(!skG)return;
  const c=ctx||{},keep=c.self;c.self=el;
  try{
    const g0=cgEvalRef(el.refs[0],c);
    const G=el.orj.mode==='face'?orjFace(el,g0,c):orjRadial(el,g0,c);
    const f=orjFeature(el);
    orjWrite(skG,f,G.groove,G.yc);
    if(el.orj.ring)orjRingSync(el,G);
    el._orjOut={D:+G.D.toFixed(4),Din:G.Din,Dw:G.Dw,d2:G.d2,d1:G.ring[1],dash:G.ring[0],t:G.t,b:G.b,pos:G.pos,Lc:G.Lc,k:G.k,
      ri:G.ri,ro:G.ro,warn:G.warn.join(' ; ')};
    if(f)f.name=orjName(f);
  }catch(e){
    el._orjOut=Object.assign({},el._orjOut||{},{warn:String((e&&e.message)||e)});
  }finally{c.self=keep;}
}
function orjDesig(O){return O&&O.d1?stdF(O.d1)+' × '+stdF(O.d2):'';}
function orjName(f){
  const el=cgGet(f.orj),O=el&&el._orjOut;
  if(!O||!O.D)return 'Gorge de joint torique';
  const m=el.orj.mode;
  return 'Gorge de joint torique '+orjDesig(O)+' ('+(m==='face'?'face Ø'+stdF(O.D):(m==='bore'?'alésage Ø':'arbre Ø')+stdF(O.D))+')';
}
/* ----- Normalisés (48) : le joint seul, origine au centre, plan médian = XY ----- */
function stdOring(st){
  const d2=+st.cs,L=orjRows(d2),r=L.find(x=>String(x[1])===String(st.size))||L[0],d1=r[1],Rc=(d1+d2)/2,h=d2/2;
  const lab=stdF(d1)+' × '+stdF(d2);
  return {key:'ORING|'+d1+'|'+d2,norm:'ISO 3601-1 A',desig:lab,name:'Joint torique '+lab,
    info:'AS568-'+String(r[0]).padStart(3,'0')+' · Ø int. '+stdF(d1)+' · section '+stdF(d2)+' · Ø ext. '+stdF(+(d1+2*d2).toFixed(2))+' · origine au centre, plan médian XY',
    prof:[[Rc,-h,{c:[Rc,0],ccw:true}],[Rc,h,{c:[Rc,0],ccw:true}]],ops:[],mat:{name:'Caoutchouc NBR',rho:1.2},color:0x18191a,reach:Rc+h};
}
/* ----- le joint, corps séparé ----- */
function orjRingAdd(el){
  if(orjRingFeature(el))return;
  const sk=orjNewSketch(el,'r','joint torique');
  const rf={id:uid('rv'),type:'revolve',name:'Joint torique',sketchId:sk.id,axis:null,angle:360,op:'add',visible:true,orjRing:el.id,newBody:true};
  rf.body=extNewBody();
  const B=(doc.bodies||[]).find(b=>b.id===rf.body);if(B&&matDef('caoutchouc'))B.mat='caoutchouc';
  addFeature(rf);
  el.orj.ring=true;
}
function orjRingRemove(el){
  const rf=orjRingFeature(el),sk=orjSketchOf(el,'r');
  el.orj.ring=false;
  if(rf){
    doc.features=doc.features.filter(f=>f!==rf);
    doc.features.forEach(rp=>{if(rp.type==='repeat')rp.base=rp.base.filter(id=>id!==rf.id);});
    if(typeof tlMark!=='undefined'&&tlMark===rf.id)tlMark=null;
  }
  if(sk)doc.sketches=doc.sketches.filter(s=>s!==sk);
  const bid=rf&&rf.body;
  if(bid&&!doc.features.some(f=>f.body===bid||f.newBody===bid||(Array.isArray(f.newBodies)&&f.newBodies.indexOf(bid)>=0)||(f.type==='combine'&&(f.tools||[]).indexOf(bid)>=0))){
    doc.bodies=doc.bodies.filter(b=>b.id!==bid);
    if(doc.activeBody===bid)delete doc.activeBody;
  }
}
function orjRingSync(el,G){
  const rf=orjRingFeature(el),sk=orjSketchOf(el,'r');
  if(!rf||!sk){orjRingRemove(el);return;}
  orjWrite(sk,rf,G.circ,G.yc);
  rf.name='Joint torique '+stdF(G.ring[1])+' × '+stdF(G.d2);
  const B=(doc.bodies||[]).find(b=>b.id===rf.body);
  if(B&&(/^Corps \d+$/.test(B.name||'')||/^Joint torique /.test(B.name||'')))B.name=rf.name; // un nom donné à la main reste
}
function orjOnDelete(f){
  // delFeature : la gorge emporte son joint, son esquisse et son repère ; le joint seul laisse la gorge
  if(f.orj){
    const el=cgGet(f.orj);if(!el)return;
    orjRingRemove(el);
    const sk=orjSketchOf(el,'g');if(sk)doc.sketches=doc.sketches.filter(s=>s!==sk);
    doc.cgeo=doc.cgeo.filter(x=>x!==el);
  }else if(f.orjRing){
    const el=cgGet(f.orjRing);if(el)orjRingRemove(el);
  }
}
/* ----- création ----- */
function orjCreate(refs,how,orj,body,label){
  const snap0=docSnap(),len0=docUndoStack.length;
  const n=(doc.cgeo||[]).filter(c=>c&&c.orj).length+1;
  const el=cgNew('frame',how,refs,{},'Repère de joint torique '+n);
  el.visible=false;el.orj=orj;
  cgResolveOne(el,{});
  const fail=m=>{
    doc.cgeo=doc.cgeo.filter(c=>c!==el);
    doc.sketches=doc.sketches.filter(s=>!(s.cg&&s.cg.id===el.id));
    docUndoStack.length=Math.min(docUndoStack.length,len0);
    try{faceEl.textContent='Joint torique : '+m+'.';}catch(e){}
    return null;
  };
  if(!el.fr)return fail(el.msg||'repère impossible');
  const sk=orjNewSketch(el,'g','gorge de joint torique');
  orjSync(el,{});
  if(!sk.entities.length)return fail((el._orjOut&&el._orjOut.warn)||'cotes de gorge impossibles');
  const nf={id:uid('rv'),type:'revolve',name:'',sketchId:sk.id,axis:null,angle:360,op:'cut',visible:true,orj:el.id};
  if(body)nf.body=body;
  addFeature(nf);
  orjRingAdd(el);
  orjSync(el,{});
  docUndoStack.length=Math.min(docUndoStack.length,len0+1);
  fdynStart(nf,snap0,len0);
  sel={kind:'feature',id:nf.id};
  markDirty();rebuild();renderTree();renderProps();
  try{faceEl.textContent='Joint torique : '+label+' reconnu, gorge ISO 3601 et joint posés. Réglez au besoin, puis OK (Échap = annuler).';}catch(e){}
  return el;
}
function orjOnCylinder(C){
  // C : holeCylOfHit(…, true). Gorge centrée sur le point cliqué (au milieu s'il en est à moins d'1 mm).
  let pos=null;
  try{
    const A=cgEvalRef({k:'face',ref:C.ref},null).axis,cd=cgCylDir(A.d),s0=cgDot(cgUnit(A.d),cd)>0?A.t0:-A.t1,Lc=A.t1-A.t0;
    const p=C.t-s0;if(Math.abs(p-Lc/2)>=1)pos=+p.toFixed(1);
  }catch(e){}
  const r=()=>({k:'face',ref:C.ref,name:entName('face')});
  return orjCreate([r(),r(),null],'zx',{mode:C.inner?'bore':'shaft',d2:0,d1:0,dyn:false,pos,ob:0,ot:0,ring:false},C.body,C.inner?'alésage':'arbre');
}
function orjOnFace(ref,body){
  return orjCreate([{k:'face',ref,name:entName('face')},null],'face',{mode:'face',press:'int',d2:0,d1:0,ob:0,ot:0,ring:false},body,'face plane');
}
function orjHit(mesh,fi,point){
  // Face cliquée : cylindre → arbre / alésage ; plan → gorge axiale. → true si reconnue
  const hit=occFaceOfHit(mesh,fi);
  if(!hit||!hit.face){try{faceEl.textContent='Joint torique : face illisible (noyau exact requis).';}catch(e){}return false;}
  let kind='?',ref=null,body=null;
  try{
    kind=occSurfKind(hit.face);
    if(kind==='Plane'){ref=occFaceRefAny(hit.face);body=hit.bd&&(doc.bodies||[]).some(b=>b.id===hit.bd.id)?hit.bd.id:null;}
  }finally{try{hit.face.delete();}catch(e){}}
  if(kind==='Cylinder'){
    const C=holeCylOfHit(mesh,fi,point,true);
    if(C.err){try{faceEl.textContent='Joint torique : '+C.err+'.';}catch(e){}return false;}
    return !!orjOnCylinder(C);
  }
  if(kind==='Plane'&&ref)return !!orjOnFace(ref,body);
  try{faceEl.textContent='Joint torique : cliquez un arbre, un alésage ou une face plane ronde.';}catch(e){}
  return false;
}
function orjPickAt(e){
  const h=pick(e);
  if(!h){try{faceEl.textContent='Joint torique : aucune face sous le curseur.';}catch(err){}return true;}
  holeFacePickCancel();
  if(!orjHit(h.object,h.faceIndex,h.point)){holeFacePick={which:'cylOrj',fid:null};try{renderer.domElement.style.cursor='crosshair';}catch(err){}}
  return true;
}
function orjStart(){
  if(!occHas()){alert('Joint torique : le noyau exact doit être chargé.');return;}
  const F=selFaces&&selFaces[0];
  if(F&&F.mesh&&F.point&&orjHit(F.mesh,F.faceIndex,F.point))return;
  holeFacePick={which:'cylOrj',fid:null};
  try{renderer.domElement.style.cursor='crosshair';}catch(e){}
  try{faceEl.textContent='Joint torique : cliquez un ARBRE, un ALÉSAGE ou une FACE PLANE ronde (bride, couvercle) — Échap pour annuler.';}catch(e){}
}
/* ----- panneau ----- */
function orjPanel(p,f){
  const el=cgGet(f.orj),U=kwUi(p);
  fdynEnsure(f);
  if(!el||!el.orj){U.pNote('⚠ Repère du joint introuvable.');fdynFoot(p,f);return;}
  const o=el.orj,O=el._orjOut||{},face=o.mode==='face';
  U.pH('Gorge de joint torique');
  if(O.D){
    const what=face?'Face Ø '+stdF(O.D)+(O.Din?' (Ø int. '+stdF(O.Din)+')':''):(o.mode==='bore'?'Alésage Ø ':'Arbre Ø ')+stdF(O.D);
    U.pNote(what+' — joint '+orjDesig(O)+' ('+orjRef(O.d2,O.dash)+') · gorge '+stdF(O.b)+' × '+stdF(O.t)+
      (face?' · Ø '+stdF(+(2*O.ri).toFixed(2))+' à '+stdF(+(2*O.ro).toFixed(2)):(O.k!=null?' · '+(o.mode==='bore'?'serrage':'étirement')+' '+stdF(+(O.k*100).toFixed(1))+' %':'')));
  }
  if(O.warn)U.pNote('⚠ '+O.warn);
  if(face)U.pRow('Joint dans la gorge',U.select([['mid','Centré (même jeu des deux côtés)'],['wall','Contre une paroi (côté pression)']],o.place==='wall'?'wall':'mid',v=>{o.place=v;o.d1=0;}));
  if(face&&o.place==='wall')U.pRow('Pression',U.select([['int','Intérieure (joint contre la paroi extérieure)'],['ext','Extérieure (joint contre la paroi intérieure)']],o.press||'int',v=>{o.press=v;o.d1=0;}));
  if(face){
    const l=[U.num(O.Dw||0,v=>{o.dw=v;delete o.eref;o.d1=0;},()=>{o.dw=0;delete o.eref;o.d1=0;})];
    l.push(U.mini('⌖','Choisir une arête circulaire : son Ø devient le Ø d’appui, son centre celui de la gorge',()=>orjEdgePick(f)));
    if(o.eref||+o.dw>0)l.push(U.mini('↺','Ø automatique (d’après la face)',()=>U.set(()=>{o.dw=0;delete o.eref;o.d1=0;})));
    U.pRow(o.place==='wall'?'Ø d’appui du joint (mm)':'Ø du joint visé (mm)',U.span(l));
    U.pNote(o.eref?'Ø pris sur l’arête '+(o.eref.name||'')+' : il la suit si la pièce change.':+o.dw>0?'Ø saisi.':(o.place==='wall'?'Vide = automatique. Saisissez un Ø ou ⌖ pour le prendre sur une arête : la paroi '+((o.press||'int')==='ext'?'intérieure':'extérieure')+' de la gorge s’y pose, le joint est choisi pour s’y appuyer.':'Vide = automatique. Saisissez un Ø ou ⌖ pour le prendre sur une arête : le joint normalisé le plus proche (Ø moyen) est choisi, la gorge se centre sur lui.'));
  }
  else{
    U.pRow('Pièce',U.select(ORJ_MODES,o.mode,v=>{o.mode=v;o.d1=0;}));
    U.pRow('Usage',U.select([['s','Statique'],['d','Dynamique (piston, tige qui coulisse)']],o.dyn?'d':'s',v=>{o.dyn=v==='d';}));
  }
  U.pRow('Section d2',U.select([['0','Automatique ('+stdF(O.d2||2.62)+')']].concat(ORJ_CS.map(v=>[String(v),stdF(v)+' mm'])),+o.d2>0?String(o.d2):'0',v=>{o.d2=+v;o.d1=0;}));
  const d2=O.d2||2.62;
  U.pRow('Joint d1 × d2',U.select([['0','Automatique ('+(O.d1?stdF(O.d1):'—')+')']].concat(orjRows(d2).map(r=>[String(r[1]),stdF(r[1])+' × '+stdF(d2)+'  (AS568-'+String(r[0]).padStart(3,'0')+')'])),+o.d1>0?String(o.d1):'0',v=>{o.d1=+v;}));
  kwCote(U,'Largeur de gorge (mm)',O.b,+o.ob>0,v=>{o.ob=v;},()=>{o.ob=0;},'Reprendre la largeur ISO 3601-2',o);
  kwCote(U,'Profondeur (mm)',O.t,+o.ot>0,v=>{o.ot=v;},()=>{o.ot=0;},'Reprendre la profondeur ISO 3601-2',o);
  if(!face&&O.Lc){
    const l=[U.num(O.pos,v=>{o.pos=v;},()=>{o.pos=null;})];
    if(o.pos!=null)l.push(U.mini('↺','Au milieu du cylindre',()=>U.set(()=>{o.pos=null;})));
    U.pRow('Position depuis le bout (mm)',U.span(l));
  }
  const kc=document.createElement('input');kc.type='checkbox';kc.checked=!!o.ring;
  kc.title='Pose le joint torique comme un corps séparé de la pièce, dans la gorge';
  kc.onchange=()=>{
    const len=docUndoStack.length;
    docPushUndo('joint torique');
    if(kc.checked)orjRingAdd(el);else orjRingRemove(el);
    docUndoStack.length=Math.min(docUndoStack.length,len+1);
    U.go();
  };
  U.pRow('Joint (corps séparé)',kc);
  U.pNote('Gorge et joint suivent le Ø de la pièce. Une cote saisie ne suit plus la norme ; ↺ ou un champ vidé la rend automatique.');
  fdynFoot(p,f);
}
function orjRingPanel(p,f){
  const U=kwUi(p),el=cgGet(f.orjRing),O=el&&el._orjOut,gf=el&&orjFeature(el);
  if(!el||!O){U.pNote('⚠ Gorge de ce joint introuvable.');return;}
  U.pH('Joint torique');
  U.pNote(orjDesig(O)+' — '+orjRef(O.d2,O.dash)+' (Ø int. × section, mm)');
  if(O.warn)U.pNote('⚠ '+O.warn);
  if(gf){
    const d=document.createElement('div');d.className='pnl-btns';
    d.appendChild(U.mini('Régler la gorge','Section, joint, cotes et position de la gorge',()=>{sel={kind:'feature',id:gf.id};renderTree();renderProps();}));
    p.appendChild(d);
  }
}
