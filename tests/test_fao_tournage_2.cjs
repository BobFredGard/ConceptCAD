// V1.2.7 : FAO tournage, étape 2 — intérieur (chariotage intérieur et alésage, à la barre),
// gorges extérieures et intérieures (là où la finition ne passe pas), filetage pris sur le
// filet du modèle (cycle G86 Fagor, passes G33 Siemens), reprise de la 2e face (pièce
// retournée : brut = résultat du premier posage).
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    // Douille tournée autour de X (face avant à x = 0) :
    //  extérieur Ø30 sur 15 (filet M30×2 sur 12), gorge de dégagement Ø27 × 3 (15 → 18), Ø30 jusqu'à 30, Ø40 jusqu'à 50 ;
    //  intérieur Ø20 sur 20 avec une gorge Ø22 × 3 (10 → 13), puis Ø12 débouchant.
    const P=(x,y)=>({x:x,y:y});
    const prof={id:'s1',name:'s1',plane:'XZ',origin:[0,0,0],axU:[1,0,0],axV:[0,0,1],axN:[0,-1,0],
      points:{o:P(-5,0),q:P(55,0),p1:P(0,10),p2:P(0,15),p3:P(15,15),p4:P(15,13.5),p5:P(18,13.5),p6:P(18,15),p7:P(30,15),p8:P(30,20),
        p9:P(50,20),p10:P(50,6),p11:P(20,6),p12:P(20,10),p13:P(13,10),p14:P(13,11),p15:P(10,11),p16:P(10,10)},
      entities:[{id:'ax',t:'line',p1:'o',p2:'q',axis:true,construction:true}],
      constraints:[],dims:[],seq:40,visible:false};
    const ring=['p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p11','p12','p13','p14','p15','p16'];
    ring.forEach((k,i)=>prof.entities.push({id:'l'+i,t:'line',p1:k,p2:ring[(i+1)%ring.length]}));
    doc.sketches=[prof];doc.bodies=[];
    doc.features=[{id:'F1',type:'revolve',name:'douille',sketchId:'s1',axis:{k:'line',id:'ax'},angle:360,op:'add',visible:true},
      {id:'TH1',type:'xthread',name:'',cyl:{c:[0,0,0],u:[1,0,0],r:15,p:[5,0,15]},size:'M30',p:2,lh:false,model:false,clear:0,lenMode:'len',len:12,flip:false,visible:true}];
    delete doc.activeBody;markDirty();rebuild();
/*MESH*/
    A(builtEngine==='exact'&&!doc.features.some(f=>f._err)&&bodies.length===1,'0 : douille tournée exacte, filetage M30×2 ('+bodies.length+' corps'+(doc.features.find(f=>f._err)?', '+doc.features.find(f=>f._err)._err:'')+')');
    const r=faoRoot();r.setups=[];
    const S=tourNewSetup();
    S.tour.flip=true; // face avant à x = 0
    const M=tourModel(S);
    if(!M||!M.ok)return {fails:['modèle : '+JSON.stringify(M&&M.warns)],log:out.log};
    // ── 1. profil intérieur
    const I=M.inner;
    out.log.push('intérieur : '+(I?I.elems.map(e=>e.t+'['+e.z1.toFixed(1)+','+e.r1.toFixed(1)+'→'+e.z2.toFixed(1)+','+e.r2.toFixed(1)+']').join(' '):'—'));
    A(I&&I.through&&Math.abs(I.r0-10)<1e-3&&Math.abs(I.rmin-6)<1e-3&&Math.abs(I.rmax-11)<1e-3,'1a : paroi intérieure : Ø20 à l’avant, gorge Ø22, Ø12 débouchant');
    A(M.bore&&M.bore.through,'1b : alésage débouchant reconnu');
    // ── 2. gamme : dressage, chariotage, finition, perçage, chariotage intérieur, alésage, gorges, filetage
    ['tour_face','tour_rough','tour_finish','tour_drill'].forEach(t=>S.ops.push(tourOpDefaults(t,S)));
    S.ops.push(tourOpDefaults('tour_rough',S,'int'),tourOpDefaults('tour_finish',S,'int'));
    S.ops.push(tourOpDefaults('tour_groove',S),tourOpDefaults('tour_groove',S,'int'),tourOpDefaults('tour_thread',S));
    const OP=k=>S.ops[k];
    const drill=tourOpTool(S,OP(3));
    A(drill.kind==='tdrill'&&Math.abs(drill.d-12)<1e-9,'2a : foret au plus petit Ø de l’alésage : Ø'+drill.d);
    A(tourOpTool(S,OP(4)).kind==='bore'&&tourOpTool(S,OP(5)).kind==='bore','2b : barre d’alésage ajoutée pour l’intérieur');
    A(tourOpTool(S,OP(6)).kind==='groove'&&!tourOpTool(S,OP(6)).int&&tourOpTool(S,OP(7)).int,'2c : outils à gorge extérieur et intérieur ajoutés');
    A(tourOpTool(S,OP(8)).kind==='thread','2d : outil à fileter ajouté');
    A(tourOpLabel(OP(4))==='Chariotage intérieur'&&tourOpLabel(OP(5))==='Alésage (finition)'&&tourOpLabel(OP(7))==='Gorge intérieure','2e : noms des opérations intérieures');
    const G=S.ops.map(o=>tourOpGen(S,o));
    G.forEach((g,i)=>out.log.push(tourOpLabel(S.ops[i])+' : '+g.moves.length+' mvts'+(g.info?' · '+g.info:'')+(g.warns.length?' ⚠ '+g.warns.join(' ; '):'')));
    A(G.every(g=>g.moves.length>=3),'2f : chaque opération a sa trajectoire');
    const bad=G.map((g,i)=>[i,g.warns.filter(w=>!/creux trop raides/.test(w))]).filter(x=>x[1].length);
    A(!bad.length,'2g : aucune alerte autre que les creux laissés aux gorges'+(bad.length?' ('+JSON.stringify(bad)+')':''));
    A(G.every(g=>g.moves.every(m=>isFinite(m.z)&&isFinite(m.x))),'2h : aucune coordonnée invalide');
    // ── 3. intérieur : jamais dans la paroi, jamais au-delà du trou percé en rapide
    const wall=tourElemsSample(I.elems,0.01);
    const inWall=(z,x)=>{ let best=1/0; wall.forEach(p=>{ if(Math.abs(p[0]-z)<0.006&&p[1]<best)best=p[1]; }); return best; };
    const fin=G[5].moves, rB=tourOpTool(S,OP(5)).re;
    // point programmé de la barre = coin théorique côté paroi : centre du bec à (z+rε, x−rε)
    let pen=0; fin.forEach(m=>{ if(m.rap)return; const cz=m.z+rB, cx=m.x-rB; wall.forEach(p=>{ const d=Math.hypot(p[0]-cz,p[1]-cx); if(d<rB-0.003)pen=Math.max(pen,rB-d); }); });
    A(pen<0.003,'3a : alésage : le bec ne pénètre jamais la paroi (écart maxi '+pen.toFixed(4)+')');
    const atX=x=>fin.some(m=>!m.rap&&Math.abs(m.x-x)<2e-3);
    A(atX(10)&&atX(6),'3b : alésage aux Ø20 et Ø12 (coin théorique de la barre)');
    const rH=drill.d/2;
    A(G[4].moves.concat(G[5].moves).every(m=>!m.rap||m.z>0.5||m.x<rH+1e-6),'3c : intérieur : rapides dans le trou percé (Ø'+drill.d+')');
    // ── 4. gorges
    const gE=G[6].moves.filter(m=>!m.rap), gI=G[7].moves.filter(m=>!m.rap);
    const wE=tourOpTool(S,OP(6)).w, wI=tourOpTool(S,OP(7)).w;
    A(gE.length&&Math.abs(Math.min(...gE.map(m=>m.x))-13.5)<2e-3,'4a : gorge extérieure : fond Ø27 atteint');
    A(gE.every(m=>m.z<=-15+1e-6+0*wE&&m.z-wE>=-18-1e-6),'4b : gorge extérieure : lame entre les parois Z−15 et Z−18');
    A(Math.abs(Math.max(...gE.map(m=>m.z))+15)<0.006&&Math.abs(Math.min(...gE.map(m=>m.z))-wE+18)<0.006,'4c : gorge extérieure : parois atteintes à 0,005 mm');
    A(gI.length&&Math.abs(Math.max(...gI.map(m=>m.x))-11)<2e-3,'4d : gorge intérieure : fond Ø22 atteint');
    A(gI.every(m=>m.z<=-10+1e-6&&m.z-wI>=-13-1e-6),'4e : gorge intérieure : lame entre les parois Z−10 et Z−13');
    // ── 5. filetage pris sur le modèle
    const T=tourThreadsOf(S);
    out.log.push('filets du modèle : '+JSON.stringify(T.map(t=>({l:t.label,P:t.P,D:t.D,z0:+t.z0.toFixed(3),z1:+t.z1.toFixed(3),int:t.int}))));
    A(T.length===1&&!T[0].int&&T[0].P===2&&T[0].D===30&&Math.abs(T[0].z0)<1e-3&&Math.abs(T[0].z1+12)<1e-3,'5a : filet M30×2 lu sur le modèle, de Z0 à Z−12');
    const th=G[8].thread, tm=G[8].moves.filter(m=>m.thr);
    A(th&&Math.abs(th.dep-0.6134*2)<1e-9&&tm.length===th.n+th.nr,'5b : profondeur ISO 0,6134·P = '+(th&&th.dep.toFixed(4))+' en '+(th&&th.n)+' passes + '+(th&&th.nr)+' à vide');
    A(tm.length&&Math.abs(Math.min(...tm.map(m=>m.x))-(15-0.6134*2))<1e-6&&tm.every(m=>Math.abs(m.z+12)<1e-9),'5c : dernière passe au fond du filet, jusqu’à Z−12');
    // ── 6. programmes
    const gc=tourPost(S).code;
    A(/G86 X30\.000 Z4\.000 Q30\.000 R-12\.000 I1\.227 B0\.\d+ E0\.050 D1\.000 L0 C2\.000 J0 A30\.000 W0/.test(gc),'6a : Fagor : cycle G86 avec Ø, Z début / fin, profondeur, pas');
    A(/G97 S\d+ M3/.test(gc)&&!/G33/.test(gc),'6b : Fagor : broche constante G97 pour le filet, sans G33 à la main');
    const S2m=JSON.parse(JSON.stringify(S));S2m.machine='siemens840dt';
    const gs=tourPost(S2m).code;
    const g33=gs.split('\n').filter(l=>/G33/.test(l));
    A(g33.length===th.n+th.nr&&g33.every(l=>/G33 Z-12\.000 K2\.000/.test(l)),'6c : Siemens : '+g33.length+' passes G33 Z−12 K2');
    // ── 7. simulation : rien de coupé en rapide, gorges et alésage creusés
    const sm=tourSimBuild(S);tourSimAdvance(sm,sm.T+1);
    const at=z=>Math.floor((z-sm.z0)/sm.g);
    A(sm.crash===0,'7a : simulation : aucun rapide dans la matière ('+sm.crash+')');
    A(Math.abs(sm.rout[at(-16.5)]-13.5)<0.01&&Math.abs(sm.rin[at(-11.5)]-11)<0.01&&Math.abs(sm.rin[at(-5)]-10)<0.01&&Math.abs(sm.rin[at(-30)]-6)<0.01,
      '7b : simulation : gorge Ø'+(2*sm.rout[at(-16.5)]).toFixed(3)+', gorge intérieure Ø'+(2*sm.rin[at(-11.5)]).toFixed(3)+', alésage Ø'+(2*sm.rin[at(-5)]).toFixed(3)+' / Ø'+(2*sm.rin[at(-30)]).toFixed(3));
    // ── 8. reprise de la 2e face
    S.ops.push(tourOpDefaults('tour_part',S));
    tourOpGen(S,S.ops[S.ops.length-1]); // calculé AVANT la reprise : doit être refait avec la surépaisseur
    const S2=tourAddReprise(S);
    A(S2&&S2.tour.reprise.from===S.id&&S2.tour.flip===false&&r.activeSetupId===S2.id,'8a : posage de reprise créé, pièce retournée');
    const gp=tourOpGen(S,S.ops[S.ops.length-1]), zp=Math.max(...gp.moves.filter(m=>!m.rap).map(m=>m.z));
    A(Math.abs(zp+51)<1e-6,'8b : tronçonnage à Z'+zp+' : 1 mm laissé pour la reprise');
    const St2=tourStock(S2);
    out.log.push('brut de reprise : face Z'+St2.face+', Ø'+St2.d+', mandrin Z'+St2.chuck);
    A(St2.rep&&Math.abs(St2.face-1)<0.06&&St2.d>=40-1e-6&&St2.d<41,'8c : brut de reprise = pièce du 1er posage : face à 1 mm, Ø'+St2.d.toFixed(3)+' (Ø40 + la surépaisseur laissée derrière la pièce)');
    A(Math.abs(St2.rep.Rat(-10)-20)<0.01&&Math.abs(St2.rep.Rat(-40)-15)<0.01,'8d : brut de reprise : Ø40 côté reprise, Ø30 déjà tourné côté mandrin');
    const G2=S2.ops.map(o=>tourOpGen(S2,o));
    G2.forEach((g,i)=>out.log.push('reprise · '+tourOpLabel(S2.ops[i])+' : '+g.moves.length+' mvts'+(g.info?' · '+g.info:'')+(g.warns.length?' ⚠ '+g.warns.join(' ; '):'')));
    A(S2.ops[0].type==='tour_face'&&G2[0].moves.some(m=>!m.rap&&Math.abs(m.z)<1e-9),'8e : reprise : dressage à la longueur (Z0)');
    const sm2=tourSimBuild(S2);tourSimAdvance(sm2,sm2.T+1);
    A(sm2&&sm2.crash===0&&Math.abs(sm2.rout[Math.floor((-10-sm2.z0)/sm2.g)]-20)<0.01,'8f : simulation de la reprise sans choc, Ø40 gardé');
    // ── 9. fiches
    const txt=e=>String(e.textContent||'')+(e.children||[]).map(txt).join(' ');
    const p=document.createElement('div');let e1=null;
    try{faoRenderProps(p,{kind:'faoOp',id:OP(8).id,setup:S.id});}catch(e){e1=e;}
    A(!e1&&/Filetage/.test(txt(p))&&/M30/.test(txt(p)),'9a : fiche du filetage'+(e1?' : '+(e1.stack||e1).slice(0,300):''));
    const p2=document.createElement('div');let e2=null;
    try{faoRenderProps(p2,{kind:'faoSetup',id:S2.id});}catch(e){e2=e;}
    A(!e2&&/Reprise/.test(txt(p2)),'9b : fiche du posage de reprise'+(e2?' : '+(e2.stack||e2).slice(0,300):''));
    // ── 10. gamme complète : ce que la douille demande, dans l'ordre d'atelier
    const S3=tourNewSetup();S3.tour.flip=true;tourAddGamme(S3);
    const seq=S3.ops.map(o=>o.type+(o.cote==='int'?'·int':'')).join(',');
    A(seq==='tour_face,tour_rough,tour_finish,tour_groove,tour_thread,tour_drill,tour_rough·int,tour_finish·int,tour_groove·int,tour_part','10a : gamme complète de la douille : '+seq);
    const G3=S3.ops.map(o=>tourOpGen(S3,o));
    A(G3.every(g=>g.moves.length>=3),'10b : gamme complète : chaque opération a sa trajectoire');
    return out;`;
  const MESH=require('fs').readFileSync(__dirname+'/test_fao_tournage.cjs','utf8');
  const a=MESH.indexOf('    // maillage sans écran'), b=MESH.indexOf("    A(builtEngine==='exact'");
  const o=await vm.runInContext('(async()=>{'+R.replace('/*MESH*/',MESH.slice(a,b))+'})()',ctx);
  console.log('=== V1.2.7 : FAO tournage (étape 2) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
