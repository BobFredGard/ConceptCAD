// Perçage normal à une face (V0.83.0) : un congé creux, des trous Ø8 borgnes à pointe dessous ;
// chaque trou reçoit un Ø1,5 perpendiculaire au congé qui vise le centre du cercle du fond.
// Trous jumeaux trouvés d'office, déjà percés ignorés, autre Ø à part, case « enlever », annulation.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(m){window.__al=m;};',ctx);
  const R=`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    // Profil (Y,Z) extrudé sur X = 0..100 : sol z=20 (y<32), mur y=40 (z>28), congé creux R8 de centre (32,28)
    const prof={id:'skP',name:'Profil',plane:'YZ',origin:[0,0,0],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],
      points:{a:{x:0,y:0},b:{x:60,y:0},c:{x:60,y:40},d:{x:40,y:40},e:{x:40,y:28},f:{x:32,y:20},g:{x:0,y:20},o:{x:32,y:28}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'e'},
        {id:'k',t:'arc',pc:'o',pa:'f',pb:'e',r:8},{id:'l5',t:'line',p1:'f',p2:'g'},{id:'l6',t:'line',p1:'g',p2:'a'}],constraints:[],dims:[],seq:20,visible:false};
    const pts=(id,L)=>{const P={},E=[];L.forEach((q,i)=>{P['h'+i]={x:q[0],y:q[1]};E.push({id:'e'+i,t:'cpoint',p:'h'+i,hole:true});});
      return {id:id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:P,entities:E,constraints:[],dims:[],seq:30,visible:false};};
    doc.sketches=[prof,pts('s8',[[15,36],[35,36],[55,36],[50,10]]),pts('sD',[[75,36]]),pts('s6',[[90,36]])];
    const H=(id,sk,o)=>Object.assign({id:id,type:'hole',name:id,sketchId:sk,kind:'simple',d:8,end:'blind',depth:14,tip:118,flip:true,op:'cut',visible:true},o);
    doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skP',distance:100,op:'add',visible:true},
      H('H8','s8'),H('HD','sD',{kind:'step',stD:8,stH:14,stTip:118,d:1.5,end:'through'}),H('H6','s6',{d:6})];
    doc.bodies=[];doc.cgeo=[];delete doc.activeBody;markDirty();rebuild();
    A(builtEngine==='exact','0a : pièce exacte');
    const inside=(q)=>{const cl=occClassifier(occLive.shape);const p=new occt.gp_Pnt_3(q[0],q[1],q[2]);cl.Perform(p,1e-6);const r=cl.State()===occt.TopAbs_State.TopAbs_IN;p.delete();cl.delete();return r;};
    A(inside([10,45,30])&&!inside([10,20,30])&&inside([10,39,21])&&!inside([10,34,26]),'0b : congé creux bien placé');
    const B=hnBlindHoles(occLive.shape);
    const b8=B.filter(h=>Math.abs(h.r-4)<1e-6);
    A(b8.length===5&&B.filter(h=>Math.abs(h.r-3)<1e-6).length===1,'1a : trous borgnes trouvés : 5 × Ø8, 1 × Ø6 (vu '+B.map(h=>'Ø'+2*h.r+(h.pierced?'*':'')).join(' ')+')');
    const h15=b8.find(h=>Math.abs(h.C[0]-15)<1e-6);
    A(h15&&Math.abs(h15.C[2]-14)<1e-4&&h15.u[2]>0.9999&&Math.abs(h15.h-4/Math.tan(59*Math.PI/180))<1e-3,'1b : centre du cercle avant le cône (z = 14), sens vers le fond, hauteur de pointe');
    A(b8.filter(h=>h.pierced).length===1&&b8.find(h=>h.pierced).C[0]===75,'1c : le double perçage (Ø1,5 au fond) est reconnu déjà percé');
    // ── 2. création : clic sur le congé ──
    const fil=occSubShapes(occLive.shape,'TopAbs_FACE').find(f=>occSurfKind(f)==='Cylinder'&&Math.abs(occFaceBox(f).dim[0]-100)<0.1);
    const ref=occFaceRefAny(fil);
    const u0=docUndoStack.length;
    const f=hnCreate([ref],null);if(!f){out.fails.push("creation");return out;}
    A(f&&hnIs(f)&&docUndoStack.length===u0+1,'2a : fonction créée, une seule étape d’annulation');
    A(f.place.grp&&Math.abs(f.place.grp.r-4)<1e-6,'2b : groupe proposé = Ø8 (le plus nombreux) — '+(f.place.grp?hnGrpLabel(f.place.grp):'?'));
    const S=hnRun.get(f.id);
    const on=S.all.filter(t=>t.on);
    A(on.length===3&&on.map(t=>t.C[0]).sort((a,b)=>a-b).join(',')==='15,35,55','2c : 3 trous Ø8 percés sous le congé (vu '+on.map(t=>t.C[0]).join(',')+')');
    A(S.all.some(t=>t.C[0]===75&&!t.on&&t.why),'2d : le trou déjà percé est montré mais ignoré');
    A(!S.all.some(t=>Math.abs(t.C[1]-10)<1e-6),'2e : le trou hors congé (y = 10) n’est pas retenu');
    A(builtEngine==='exact'&&!f._err&&/Perçage normal Ø1,5/.test(f.name)&&/×3/.test(f.name),'2f : rejeu exact, nom « '+f.name+' »');
    // perpendiculaire au congé : la droite P→C passe par l'axe du congé (y=32, z=28)
    const t0=on[0],O=[t0.C[0],32,28],w=[t0.C[0]-O[0],t0.C[1]-O[1],t0.C[2]-O[2]],L=Math.hypot(...w);
    const cr=Math.hypot(t0.D[1]*w[2]/L-t0.D[2]*w[1]/L,t0.D[0]);
    A(cr<1e-6&&Math.abs(Math.hypot(t0.P[1]-32,t0.P[2]-28)-8)<1e-6,'2g : trou normal au congé (écart '+cr.toExponential(1)+'), départ sur le congé');
    const mid=t=>[(t.P[0]+t.C[0])/2,(t.P[1]+t.C[1])/2,(t.P[2]+t.C[2])/2];
    A(on.every(t=>!inside(mid(t))),'2h : la matière est enlevée entre le congé et le fond de chaque Ø8');
    A(inside([75,35.12,17.08]),'2i : rien sur le trou déjà percé');
    // ── 3. case décochée : un trou en moins ──
    hn3Toggle(f,on[1].C,false);
    const S2=hnRun.get(f.id);
    A(S2.all.filter(t=>t.on).length===2&&S2.all.filter(t=>t.off).length===1&&inside(mid(on[1])),'3a : trou enlevé = matière remise, les autres restent');
    docUndo();
    A(hnRun.get(f.id).all.filter(t=>t.on).length===3&&on.every(t=>!inside(mid(t))),'3b : Ctrl+Z remet le trou');
    // ── 4. autre groupe : Ø6 ──
    const f4=doc.features.find(x=>x.id===f.id);
    const g6=hnRun.get(f.id).groups.find(g=>Math.abs(g.g.r-3)<1e-6);
    A(g6&&g6.n===1,'4a : le Ø6 est proposé à part ('+(g6?hnGrpLabel(g6.g,g6.n):'?')+')');
    f4.place.grp=g6.g;markDirty();rebuild();
    A(hnRun.get(f.id).all.filter(t=>t.on).length===1&&hnRun.get(f.id).all[0].C[0]===90,'4b : groupe Ø6 : un seul trou');
    // ── 5. le perçage suit la pièce : Ø8 déplacés ──
    f4.place.grp={r:4,len:14,u:[0,0,1]};
    const s8=doc.sketches.find(s=>s.id==='s8');s8.points.h0.x=20;markDirty();rebuild();
    const on5=hnRun.get(f.id).all.filter(t=>t.on).map(t=>t.C[0]).sort((a,b)=>a-b).join(',');
    A(on5==='20,35,55','5a : un Ø8 déplacé est suivi (vu '+on5+')');
    // ── 6. enregistrement : pas d'esquisse, réglages gardés ──
    const js=JSON.parse(JSON.stringify(f4));
    A(js.place&&js.place.k==='normal'&&js.place.faces.length===1&&!js.sketchId,'6a : enregistré avec la face et le groupe, sans esquisse');
    A(!repCanFeature(f.id),'6b : pas de répétition d’un perçage normal (il trouve déjà tous ses trous)');
    // ── 6c. plusieurs faces : chaque Ø8 va à la face qui est au-dessus de son fond ──
    {const sol=occSubShapes(occLive.shape,'TopAbs_FACE').find(q=>occSurfKind(q)==='Plane'&&Math.abs(occFaceBox(q).pos[2]-20)<1e-6&&occFaceBox(q).dim[2]<1e-3);
     f4.place.faces.push(occFaceRefAny(sol));markDirty();rebuild();
     const T=hnRun.get(f.id).all.filter(t=>t.on),t10=T.find(t=>Math.abs(t.C[1]-10)<1e-6);
     A(T.length===4&&t10&&Math.abs(t10.D[2]+1)<1e-9&&Math.abs(t10.P[2]-20)<1e-6&&T.filter(t=>t!==t10).every(t=>Math.abs(Math.hypot(t.P[1]-32,t.P[2]-28)-8)<1e-6),
       '6c : congé + sol : 4 trous dans UNE fonction — celui sous le sol part droit du sol, les 3 autres du congé');
     f4.place.faces.pop();markDirty();rebuild();}
    // ── 7. annulation de la création ──
    docUndo();docUndo();docUndo();
    out.log.push('7 : '+doc.features.length+' fonctions après annulations');
    return out;`;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Perçage normal à une face ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
