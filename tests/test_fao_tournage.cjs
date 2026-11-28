// V1.2.7 : FAO tournage, étape 1 — posage tour (profil exact lu sur le modèle), outils de tour,
// dressage, chariotage, finition (droites et arcs exacts), perçage en bout, tronçonnage,
// simulation par enlèvement de matière, programmes Fagor 8065 T et Siemens 840D T.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    // Axe tourné autour de X : Ø20 sur 20, congé R5 vers Ø30 jusqu'à 45, Ø36 jusqu'à 60, alésage Ø6 débouchant
    const prof={id:'s1',name:'s1',plane:'XZ',origin:[0,0,0],axU:[1,0,0],axV:[0,0,1],axN:[0,-1,0],
      points:{o:{x:-5,y:0},q:{x:65,y:0},a:{x:0,y:3},b:{x:0,y:10},c:{x:20,y:10},k:{x:20,y:15},d:{x:25,y:15},e:{x:45,y:15},f:{x:45,y:18},g:{x:60,y:18},h:{x:60,y:3}},
      entities:[{id:'ax',t:'line',p1:'o',p2:'q',axis:true,construction:true},
        {id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'a1',t:'arc',pc:'k',pa:'c',pb:'d',r:5},
        {id:'l3',t:'line',p1:'d',p2:'e'},{id:'l4',t:'line',p1:'e',p2:'f'},{id:'l5',t:'line',p1:'f',p2:'g'},{id:'l6',t:'line',p1:'g',p2:'h'},{id:'l7',t:'line',p1:'h',p2:'a'}],
      constraints:[],dims:[],seq:20,visible:false};
    doc.sketches=[prof];doc.bodies=[];
    doc.features=[{id:'F1',type:'revolve',name:'axe',sketchId:'s1',axis:{k:'line',id:'ax'},angle:360,op:'add',visible:true}];
    delete doc.activeBody;markDirty();rebuild();
    // maillage sans écran (comme test_fao_bornage)
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
              let rev=false;
              try{rev=(f.Orientation_1()===occt.TopAbs_Orientation.TopAbs_REVERSED);}catch(e){}
              const trsf=loc.IsIdentity()?null:loc.Transformation();
              for(let i=1;i<=nt;i++){
                const triangle=tr.Triangle(i);
                let idx=[triangle.Value(1),triangle.Value(2),triangle.Value(3)];
                if(rev)idx=[idx[0],idx[2],idx[1]];
                const tri=[];
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
        if(!v.length||!t.length)return null;
        return {v:v,t:t};
      }catch(e){return null;}
    };
    A(builtEngine==='exact'&&!doc.features.some(f=>f._err)&&bodies.length===1,'0 : axe tourné exact ('+bodies.length+' corps)');
    // ── 1. posage tour, profil
    const r=faoRoot();r.setups=[];
    const S=tourNewSetup();
    A(S&&S.proc==='tour'&&r.activeSetupId===S.id&&S.tools.length===4,'1a : nouveau posage tour actif, 4 outils de tour');
    S.tour.flip=true; // face avant = bout Ø20 : le congé R5 est tourné vers l'avant (accessible)
    let M=tourModel(S);
    A(M&&M.ok,'1b : modèle lu'+(M&&M.warns&&M.warns.length?' ('+M.warns.join(' ; ')+')':''));
    if(!M.ok)return {fails:['modèle : '+JSON.stringify(M).slice(0,600)+' bodies='+bodies.length+' '+builtEngine],log:out.log};
    out.log.push('profil : '+M.src+', L '+M.L.toFixed(3)+', Rmax '+M.Rmax.toFixed(3)+', '+M.elems.length+' éléments : '+M.elems.map(e=>e.t+(e.t==='A'?'R'+e.R.toFixed(2):'')+'['+e.z1.toFixed(1)+','+e.r1.toFixed(1)+'→'+e.z2.toFixed(1)+','+e.r2.toFixed(1)+']').join(' '));
    A(M.src==='exact'&&Math.abs(M.L-60)<1e-3&&Math.abs(M.Rmax-18)<1e-3,'1c : profil exact, longueur 60, Ø36 (Rmax '+M.Rmax.toFixed(4)+')');
    A(Math.abs(Math.abs(M.W[0])-1)<1e-9,'1d : axe de rotation trouvé seul : X');
    A(M.elems.filter(e=>e.t==='A'&&Math.abs(e.R-5)<1e-3).length===1,'1e : congé R5 gardé comme arc');
    A(M.bore&&Math.abs(M.bore.r-3)<1e-3&&M.bore.through,'1f : alésage Ø6 débouchant reconnu');
    // la face avant est un bout : face à Ø20 ou Ø16 selon le sens choisi
    const front=tourElemsEvalTop(M.elems,-0.5);
    out.log.push('face avant : r='+front.toFixed(3));
    A(Math.abs(front-10)<1e-3,'1g : « Inverser » : face avant au bout Ø20');
    const St=tourStock(S);
    A(Math.abs(St.d-38)<1e-9&&St.sortie>=61,'1h : brut Ø38 (pièce + 2), Ø'+St.d+' sortie '+St.sortie);
    // ── 2. gamme
    tourAddGamme(S);
    A(S.ops.map(o=>o.type).join(',')==='tour_face,tour_rough,tour_finish,tour_drill,tour_part','2a : gamme complète : dressage, chariotage, finition, perçage, tronçonnage');
    const gens=S.ops.map(o=>tourOpGen(S,o));
    gens.forEach((g,i)=>out.log.push(tourOpLabel(S.ops[i])+' : '+g.moves.length+' mvts'+(g.info?' · '+g.info:'')+(g.warns.length?' ⚠ '+g.warns.join(' ; '):'')));
    A(gens.every(g=>g.moves.length>=3),'2b : chaque opération a sa trajectoire');
    A(gens.every(g=>!g.warns.length),'2c : aucune alerte');
    const safe=tourSafe(S);
    A(gens.every(g=>{const a=g.moves[0],b=g.moves[g.moves.length-1];return a.rap&&b.rap&&Math.abs(b.x-safe.x)<1e-6&&Math.abs(b.z-safe.z)<1e-6;}),'2d : départ et retour au point de dégagement');
    // finition : point programmé = coin théorique → diamètres de la pièce lus tels quels
    const fin=gens[2].moves, re=tourOpTool(S,S.ops[2]).re;
    const atX=x=>fin.some(m=>!m.rap&&Math.abs(m.x-x)<2e-3);
    A(atX(10)&&atX(15)&&atX(18),'2e : finition aux diamètres 20, 30 et 36 (au coin théorique de la plaquette)');
    const arcs=fin.filter(m=>m.arc);
    out.log.push('arcs de finition : '+arcs.map(m=>'R'+m.arc.R.toFixed(3)+(m.arc.cw?' G2':' G3')).join(', '));
    A(arcs.some(m=>Math.abs(m.arc.R-(5-re))<2e-3),'2f : congé R5 usiné en un arc R'+(5-re)+' (centre du bec)');
    // aucune pénétration : le centre du bec reste à rε au moins de tout point du profil
    const prS=tourElemsSample(M.elems,0.01).filter(p=>p[0]<-1e-3&&p[0]>-59.999);
    let worst=1/0;
    for(let i=1;i<fin.length;i++){const a=fin[i-1],b=fin[i];if(b.rap)continue;
      tourMovePts(a,b).forEach(q=>{const cz=q[0]+re,cx=q[1]+re;
        prS.forEach(p=>{if(Math.abs(p[0]-cz)<re+0.01){const d=Math.hypot(p[0]-cz,p[1]-cx)-re;if(d<worst)worst=d;}});});}
    A(worst>-2e-3,'2g : finition sans pénétration (écart mini '+worst.toFixed(4)+' mm)');
    // chariotage : laisse respectée
    const ro=gens[1].moves, sx=S.ops[1].sx, reR=tourOpTool(S,S.ops[1]).re;
    let wr=1/0;
    ro.forEach(m=>{if(m.rap)return;const cz=m.z+reR,cx=m.x+reR;if(cz>-0.01||cz<-59.9)return;wr=Math.min(wr,cx-reR-tourElemsEvalTop(M.elems,cz));});
    A(wr>sx*0.5-2e-3,'2h : chariotage : la laisse reste sur la pièce (mini '+wr.toFixed(3)+' mm)');
    // perçage : débouchant dans l'axe
    const dr=gens[3].moves;
    A(dr.every(m=>Math.abs(m.x)<1e-9||m.rap)&&Math.min.apply(null,dr.map(m=>m.z))<-60,'2i : perçage dans l’axe, au-delà de la face arrière');
    // tronçonnage : jusqu'au centre derrière la pièce
    const pt=gens[4].moves;
    A(Math.abs(Math.min.apply(null,pt.map(m=>m.x))-2.7)<1e-6&&pt.every(m=>m.rap||m.z<=-60+1e-6),'2j : tronçonnage derrière la pièce, jusque dans le trou Ø6 percé (0,3 mm sous sa paroi : la pièce tombe)');
    // ── 3. simulation : la pièce finie sort de la barre
    const sm=tourSimBuild(S);
    A(sm&&sm.T>0,'3a : simulation prête ('+(sm.T/60).toFixed(2)+' min)');
    tourSimAdvance(sm,sm.T);
    let gouge=0,left=0;
    for(let k=0;k<sm.n;k++){const z=sm.z0+(k+0.5)*sm.g;if(z>-0.2||z<-59.8)continue;
      const top=tourElemsEvalTop(M.elems,z);if(Math.abs(z+20)<0.3||Math.abs(z+45)<0.3)continue; // marches
      if(sm.rout[k]<top-0.02)gouge++;
      if(sm.rout[k]>top+0.06)left++;}
    A(!gouge,'3b : simulation : rien d’enlevé dans la pièce'+(gouge?' ('+gouge+' colonnes)':''));
    A(!left,'3c : simulation : profil fini partout'+(left?' ('+left+' colonnes trop hautes)':''));
    A(sm.crash===0,'3d : aucun rapide dans la matière');
    let inside=0;for(let k=0;k<sm.n;k++){const z=sm.z0+(k+0.5)*sm.g;if(z<-0.5&&z>-59.5&&sm.rout[k]>0&&Math.abs(sm.rin[k]-3)>0.06)inside++;}
    A(!inside,'3e : alésage percé Ø6 sur toute la longueur');
    const piece=tourSimMatter(sm);
    A(piece.length===2,'3f : après tronçonnage : la pièce et la barre séparées ('+piece.length+' morceaux)');
    // ── 4. programmes
    const P=faoPost(S);
    const g=P.code;
    out.log.push('Fagor : '+g.split('\n').length+' lignes');
    A(P.ext==='nc'&&/G18 G151 G40 G54/.test(g)&&/G192 S3000/.test(g)&&!/G92 /.test(g)&&/G96 S\d+ M3/.test(g)&&/G95/.test(g)&&/M30/.test(g),'4a : Fagor 8065 T : G18 G151, G192 S (jamais G92 : présélection d’origine sur 8065), G96, G95, M30');
    A(/T1 D1/.test(g)&&/T2 D2/.test(g)&&/T3 D3/.test(g)&&/T4 D4/.test(g),'4b : 4 changements d’outil T D');
    A(/X20\.000/.test(g)&&/X30\.000/.test(g)&&/X36\.000/.test(g),'4c : diamètres 20, 30, 36 dans le programme');
    A(new RegExp('G[23] [^\\n]*R'+(5-re).toFixed(3)).test(g),'4d : arc du congé en G2/G3 R');
    A(/G97 S\d+ M3/.test(g),'4e : foret à vitesse fixe G97');
    A(!/[^\x09\x0a\x0d\x20-\x7e]/.test(g),'4f : programme sans caractère accentué');
    S.machine='siemens840dt';
    const s8=faoPost(S);
    A(s8.ext==='mpf'&&/DIAMON/.test(s8.code)&&/LIMS=3000/.test(s8.code)&&/CR=/.test(s8.code)&&/T1 D1/.test(s8.code),'4g : Siemens 840D T : DIAMON, LIMS, CR=');
    S.machine='fagor8065t';
    // ── 5. raccordements
    A(faoActiveOps(S).length===0&&faoSeqSafe(S).length===0,'5a : le fraisage ignore le posage tour');
    const st=faoStats(S);
    A(st.n===5&&st.tmin>0,'5b : estimation : 5 opérations, ≈'+st.tmin.toFixed(2)+' min');
    const n0=S.ops.length;faoRoot();A(S.ops.length===n0,'5c : opérations de tour gardées à la relecture');
    const mill=faoDefaultSetup();mill.ops.push({id:'x',type:'tour_face'});faoSanitiseOps(mill);
    A(!mill.ops.length,'5d : pas d’opération de tour dans un posage de fraisage');
    A(faoOpShortLabel(S.ops[1])==='Chariotage','5e : libellé dans l’arbre');
    const txt=n=>!n?'':(String(n.textContent||'')+' '+(n.children||[]).map(txt).join(' ')); // document du banc : textContent sans les enfants
    const p=document.createElement('div');let e1=null;
    try{sel={kind:'faoSetup',id:S.id};faoRenderProps(p,sel);}catch(e){e1=e;}
    try{tourSetupFiche(document.createElement('div'),S);}catch(e){out.log.push('e1 '+(e.stack||e).slice(0,600));}
    A(!e1&&/Posage tour/.test(txt(p))&&/Gamme complète/.test(txt(p)),'5f : fiche du posage tour');
    const p2=document.createElement('div');let e2=null;
    try{faoRenderProps(p2,{kind:'faoOp',id:S.ops[2].id,setup:S.id});}catch(e){e2=e;}
    try{tourOpFiche(document.createElement('div'),S,S.ops[2],2);}catch(e){out.log.push('e2 '+(e.stack||e).slice(0,600));}
    A(!e2&&/Finition/.test(txt(p2))&&/mouvements/.test(txt(p2)),'5g : fiche d’une opération de tour');
    const doc2=JSON.parse(JSON.stringify(doc.fao));const sT=doc2.setups.find(x=>x.id===S.id);A(sT&&sT.proc==='tour'&&sT.ops.length===5,'5h : posage tour enregistré dans le document');
    // ── 6. inversion de la pièce : l'autre bout devient la face avant
    S.tour.flip=false;M=tourModel(S);
    const f2=tourElemsEvalTop(M.elems,-0.5);
    A(M.ok&&Math.abs(f2-front)>1,'6a : « Inverser » : l’autre bout en face avant (r='+f2.toFixed(3)+')');
    const g2=tourOpGen(S,S.ops[2]);
    A(g2.moves.length>3&&g2.warns.some(w=>/creux trop raides/.test(w)),'6b : pièce retournée : congé R5 inaccessible par l’arrière signalé (matière laissée)');
    return out;`;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== V1.2.7 : FAO tournage (étape 1) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
