// Repère posé sur une face : origine sur l'un des 9 points cardinaux de la face (centre, milieux
// des côtés, coins du rectangle qui l'englobe), Z = normale sortante, X au choix (arête ou axe).
// Calcul pur (cgCardPts : droites, cercle, arc, base tournée) puis VRAI noyau OCCT : pavé, face
// ronde (extrêmes exacts), suivi de la pièce, ancien élément sans point choisi inchangé.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    const near=(a,b,t)=>Array.isArray(a)&&a.every((x,i)=>Math.abs(x-b[i])<(t||1e-6));
    const V=(a,b,msg,t)=>att(near(a,b,t),msg+' : vu ['+(a||[]).map(x=>+(+x).toFixed(6)).join(', ')+'] attendu ['+b.join(', ')+']');
    const faces=sh=>{const out=[];const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);while(ex.More()){out.push(occt.TopoDS.Face_1(ex.Current()));ex.Next();}ex.delete();return out;};
    const mkRect=(id,x0,y0,w,h)=>{const sk={id,name:id,plane:'XY',origin:[0,0,0],points:{},entities:[],constraints:[],dims:[],seq:1,visible:true};
      [['p0',x0,y0],['p1',x0+w,y0],['p2',x0+w,y0+h],['p3',x0,y0+h]].forEach(q=>{sk.points[q[0]]={x:q[1],y:q[2]};});
      sk.entities.push({id:id+'e0',t:'line',p1:'p0',p2:'p1'},{id:id+'e1',t:'line',p1:'p1',p2:'p2'},{id:id+'e2',t:'line',p1:'p2',p2:'p3'},{id:id+'e3',t:'line',p1:'p3',p2:'p0'});return sk;};
    const replay=()=>{cgResolveAll();try{resolveAllSketchHosts();}catch(e){}occCk.length=0;const FR=occFinalShape(null);occLive={shape:FR.shape};return FR;};
    const S2=Math.SQRT1_2,X=[1,0,0],Y=[0,1,0];
    const K=(L,w)=>L.find(q=>q.w===w).o;
    // ── calcul pur ──
    const sq=[{k:'pts',pts:[[0,0,0],[10,0,0]]},{k:'pts',pts:[[10,0,0],[10,10,0]]},{k:'pts',pts:[[10,10,0],[0,10,0]]},{k:'pts',pts:[[0,10,0],[0,0,0]]}];
    let L=cgCardPts(sq,X,Y);
    att(L.length===9,'9 points cardinaux');
    V(K(L,'c'),[5,5,0],'carré : centre');V(K(L,'ne'),[10,10,0],'carré : coin nord-est');V(K(L,'so'),[0,0,0],'carré : coin sud-ouest');
    V(K(L,'n'),[5,10,0],'carré : nord');V(K(L,'o'),[0,5,0],'carré : ouest');
    L=cgCardPts(sq,[S2,S2,0],[-S2,S2,0]);
    V(K(L,'e'),[10,10,0],'carré, X à 45° : est = le coin dans la direction X');V(K(L,'c'),[5,5,0],'carré, X à 45° : centre');
    V(K(L,'ne'),[5,15,0],'carré, X à 45° : coin du rectangle tourné');
    const rond=[{k:'circ',c:[3,4,0],x:X,y:Y,r:10,u0:0,u1:2*Math.PI}];
    L=cgCardPts(rond,X,Y);
    V(K(L,'e'),[13,4,0],'cercle : est à +r exactement',1e-12);V(K(L,'s'),[3,-6,0],'cercle : sud à −r exactement',1e-12);V(K(L,'no'),[-7,14,0],'cercle : coin',1e-12);
    L=cgCardPts(rond,[S2,S2,0],[-S2,S2,0]);
    V(K(L,'e'),[3+10*S2,4+10*S2,0],'cercle, X à 45° : est sur le cercle',1e-12);
    L=cgCardPts([{k:'circ',c:[0,0,0],x:X,y:Y,r:10,u0:Math.PI/4,u1:3*Math.PI/4}],X,Y);
    V(K(L,'n'),[0,10,0],'arc : le sommet de l arc compte',1e-12);V(K(L,'s'),[0,10*S2,0],'arc : le bas s arrête aux bouts',1e-12);
    V(K(L,'e'),[10*S2,(10+10*S2)/2,0],'arc : est au bout, pas à +r',1e-12);
    att(cgCardPts([],X,Y)===null,'aucun bord : pas de points');
    // ── pavé 100 × 60 × 40 ──
    docResetEmpty();
    doc.sketches=[mkRect('skA',0,0,100,60)];
    doc.bodies=[{id:'b1',name:'Corps 1',c:null}];doc.bodySeq=2;doc.activeBody='b1';
    doc.features=[{id:'exA',type:'extrude',name:'Bloc',sketchId:'skA',op:'add',distance:40,body:'b1'}];
    let FR=replay();
    const refN=(nx,ny,nz)=>{const L2=faces(FR.shape);const r=L2.map(f=>occFaceRefAny(f)).find(r=>r&&r.n&&r.n[0]*nx+r.n[1]*ny+r.n[2]*nz>0.99);L2.forEach(f=>f.delete());return {k:'face',ref:r,name:'Face'};};
    att(CG_DEF_HOW.frame==='face','un nouveau repère démarre sur une face');
    const f0=cgNew('frame','face',[refN(0,0,1)]);
    att(f0.st==='ok','repère sur la face du dessus résolu ('+f0.msg+')');
    att(f0.p.w==='c','par défaut : centre');
    V(f0.fr.o,[50,30,40],'centre de la face du dessus');V(f0.fr.z,[0,0,1],'Z = normale sortante');V(f0.fr.x,[1,0,0],'X par défaut');
    att(Array.isArray(f0._card)&&f0._card.length===9,'les 9 points sont offerts à l affichage');
    att(!('_card' in cgClean(f0)),'les points ne sont pas enregistrés dans le fichier');
    const f1=cgNew('frame','face',[refN(0,0,1)],{w:'ne'});
    V(f1.fr.o,[100,60,40],'coin nord-est du dessus');
    const f2=cgNew('frame','face',[refN(0,0,1)],{w:'so',dx:5});
    V(f2.fr.o,[5,0,40],'coin sud-ouest puis décalage X de 5');
    const f3=cgNew('frame','face',[refN(0,0,1)],{w:'e',rz:90});
    V(f3.fr.o,[100,30,40],'est : la rotation autour de Z ne déplace pas le point');V(f3.fr.x,[0,1,0],'rotation de 90° : X tourné');
    const f4=cgNew('frame','face',[refN(0,0,1)],{w:'n',flip:true});
    V(f4.fr.o,[50,60,40],'nord, repère inversé : même point');V(f4.fr.z,[0,0,-1],'inversé : Z rentrant');
    // X suivant une arête : celle du dessus parallèle à Y (x = 100)
    const f5=cgNew('frame','face',[refN(0,0,1),{k:'edge',pos:[100,30,40],len:60,name:'Arête'}],{w:'ne'});
    att(f5.st==='ok','repère avec X sur une arête résolu ('+f5.msg+')');
    att(Math.abs(Math.abs(f5.fr.x[1])-1)<1e-9,'X suit l arête (vu '+f5.fr.x.join(', ')+')');
    V(f5.fr.o,f5.fr.x[1]>0?[0,60,40]:[100,0,40],'nord-est dans la base tournée : +X et +Y du repère');
    att(Math.abs(cgDot(cgCross(f5.fr.x,f5.fr.y),f5.fr.z)-1)<1e-9,'repère direct');
    // face de côté (normale +X)
    const f6=cgNew('frame','face',[refN(1,0,0)],{w:'ne'});
    V(f6.fr.z,[1,0,0],'face de côté : Z = sa normale');V(f6.fr.o,[100,60,40],'face de côté : coin haut');
    const f7=cgNew('frame','face',[refN(1,0,0)],{w:'s'});
    V(f7.fr.o,[100,30,0],'face de côté : milieu du bas');
    // ancien fichier : pas de point choisi → centre de la boîte de la face, comme avant
    const f8=cgNew('frame','face',[refN(0,0,1)]);delete f8.p.w;cgResolveOne(f8,{});
    V(f8.fr.o,[50,30,40],'ancien repère sans point : inchangé');
    // un plan d'origine n'a pas de bords : origine du plan, aucun point offert
    const f9=cgNew('frame','face',[{k:'o',id:'XY'}],{w:'ne'});
    V(f9.fr.o,[0,0,0],'plan d origine : pas de points cardinaux');att(!f9._card,'plan d origine : rien à cliquer');
    // ── X par une face, un plan ou le plan d'un autre repère : X = leur normale ; sens de X et de Z ──
    const h1=cgNew('frame','face',[refN(0,0,1),refN(0,1,0)],{w:'c'});
    att(h1.st==='ok','X par une face de côté résolu ('+h1.msg+')');
    V(h1.fr.x,[0,1,0],'X perpendiculaire à la face choisie');V(h1.fr.z,[0,0,1],'X par une face : Z reste la normale de la face d appui');
    const h2=cgNew('frame','face',[refN(0,0,1),{k:'o',id:'XZ'}]);
    V(h2.fr.x,[0,-1,0],'X par un plan d origine : sa normale');
    const h3=cgNew('frame','face',[refN(1,0,0),{k:'cg',id:h1.id,sub:'XY'}],{w:'so'});
    att(h3.st==='ok','X par le plan d un autre repère résolu ('+h3.msg+')');
    V(h3.fr.z,[1,0,0],'plan d un autre repère : Z = normale de la face');V(h3.fr.x,[0,0,1],'plan XY du repère h1 : X = sa normale');
    const h4=cgNew('frame','face',[refN(0,0,1),{k:'cg',id:h1.id}]);
    V(h4.fr.x,[1,0,0],'X par un repère entier : X remplacé (son Z est parallèle), signalé');att(h4.st==='warn'&&/parallèle/.test(h4.msg),'X parallèle à Z signalé ('+h4.msg+')');
    const h5=cgNew('frame','face',[refN(0,0,1),refN(0,0,1)]);
    att(h5.st==='warn'&&/parallèle/.test(h5.msg),'X par la face d appui elle-même : signalé ('+h5.msg+')');
    const h6=cgNew('frame','face',[refN(0,0,1),refN(0,1,0)],{w:'ne',flipx:true});
    V(h6.fr.x,[0,-1,0],'Inverser X : X retourné');V(h6.fr.z,[0,0,1],'Inverser X : Z gardé');
    const h6b=cgNew('frame','face',[refN(0,0,1),refN(0,1,0)],{w:'ne'});
    V(h6.fr.o,h6b.fr.o,'Inverser X : l origine ne bouge pas');
    att(Math.abs(cgDot(cgCross(h6.fr.x,h6.fr.y),h6.fr.z)-1)<1e-9,'Inverser X : repère direct');
    const h7=cgNew('frame','face',[refN(0,0,1),refN(0,1,0)],{w:'ne',flip:true,flipx:true});
    V(h7.fr.x,[0,-1,0],'Inverser Z et X : X retourné');V(h7.fr.z,[0,0,-1],'Inverser Z et X : Z retourné');V(h7.fr.o,h6b.fr.o,'Inverser Z et X : même origine');
    att(Math.abs(cgDot(cgCross(h7.fr.x,h7.fr.y),h7.fr.z)-1)<1e-9,'Inverser Z et X : repère direct');
    const h8=cgNew('frame','zx',[{k:'o',id:'O'},{k:'o',id:'Z'},{k:'o',id:'YZ'}],{flipx:true});
    V(h8.fr.x,[-1,0,0],'Origine, Z et X : X par un plan, puis retourné');
    // la pièce change : les repères suivent
    doc.features[0].distance=50;doc.sketches[0].points.p1.x=120;doc.sketches[0].points.p2.x=120;
    FR=replay();
    V(f1.fr.o,[120,60,50],'le coin suit la pièce');V(f0.fr.o,[60,30,50],'le centre suit la pièce');
    // ── face ronde : extrêmes exacts ──
    doc.sketches.push({id:'skC',name:'Rond',plane:'XY',origin:[0,0,0],points:{c:{x:200,y:30}},entities:[{id:'c1',t:'circle',pc:'c',r:10}],constraints:[],dims:[],seq:1,visible:true});
    doc.features.push({id:'exC',type:'extrude',name:'Cylindre',sketchId:'skC',op:'add',distance:30,body:'b1'});
    FR=replay();
    const Lf=faces(FR.shape);
    const rr=Lf.map(f=>occFaceRefAny(f)).find(r=>r&&r.n&&r.n[2]>0.99&&r.st!=='Cylinder'&&Math.abs(r.pos[0]-200)<1&&Math.abs(r.pos[2]-30)<0.01);
    Lf.forEach(f=>f.delete());
    att(!!rr,'dessus du cylindre trouvé');
    const g1=cgNew('frame','face',[{k:'face',ref:rr,name:'Rond'}],{w:'e'});
    V(g1.fr.o,[210,30,30],'face ronde : est à un rayon du centre',1e-6);
    const g2=cgNew('frame','face',[{k:'face',ref:rr,name:'Rond'}],{w:'so'});
    V(g2.fr.o,[190,20,30],'face ronde : coin du carré qui l entoure',1e-6);
    const g3=cgNew('frame','face',[{k:'face',ref:rr,name:'Rond'}]);
    V(g3.fr.o,[200,30,30],'face ronde : centre',1e-6);
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'repere_face.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
