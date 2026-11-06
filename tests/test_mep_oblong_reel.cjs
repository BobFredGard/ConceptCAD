// 2026-11-06 : PLAN — oblong sur une VRAIE pièce : bloc percé d'un oblong (fonctions Esquisse + Extrusion),
// projection exacte du noyau : reconnu dans la vue, axes, entraxe et position qui suivent un allongement.
// Bloc 100 × 60 × 20 ; oblong débouchant, centres (30,30) et (70,30), R6.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};showAll=function(){};rebuild=function(){};applyView=function(){};refreshParts=function(){};',ctx);
  const r=await vm.runInContext(`(async()=>{
    const out={fails:[],log:[]};const A=(c,m)=>{(c?out.log:out.fails).push(m);};
    const near=(x,y,t)=>Math.abs(x-y)<(t||1e-3);
    const T=window.__mepTest;
    mepSetActive(true);
    const bloc={id:'sk_b',name:'Bloc',plane:'XY',origin:[0,0,0],points:{},entities:[],constraints:[],dims:[],seq:1,visible:true};
    [['p0',0,0,'e0','p1'],['p1',100,0,'e1','p2'],['p2',100,60,'e2','p3'],['p3',0,60,'e3','p0']].forEach(l=>{
      bloc.points[l[0]]={x:l[1],y:l[2]};bloc.entities.push({id:l[3],t:'line',p1:l[0],p2:l[4]});});
    const sl={id:'sk_s',name:'Oblong',plane:'XY',origin:[0,0,0],points:{},entities:[],constraints:[],dims:[],seq:2,visible:true};
    const place=(x1,y1,x2,y2,R)=>{
      const a=Math.atan2(y2-y1,x2-x1),nx=-Math.sin(a)*R,ny=Math.cos(a)*R;
      Object.assign(sl.points,{p1:{x:x1+nx,y:y1+ny},p2:{x:x2+nx,y:y2+ny},p3:{x:x2-nx,y:y2-ny},p4:{x:x1-nx,y:y1-ny},p5:{x:x1,y:y1},p6:{x:x2,y:y2}});
      sl.entities=[{id:'e1',t:'line',p1:'p1',p2:'p2'},{id:'e2',t:'line',p1:'p4',p2:'p3'},{id:'e3',t:'arc',pc:'p5',pa:'p1',pb:'p4',r:R},{id:'e4',t:'arc',pc:'p6',pa:'p3',pb:'p2',r:R}];
    };
    doc.sketches=[bloc,sl];
    const rejoue=()=>{
      doc.features=[{id:'ex_b',type:'extrude',name:'Bloc',sketchId:'sk_b',op:'add',distance:20,dist:20,d2:0,visible:true},
        {id:'ex_s',type:'extrude',name:'Oblong',sketchId:'sk_s',op:'cut',distance:20,dist:20,d2:0,visible:true}];
      freshHard=true;occCkClear();
      const F=occFinalShape(null);
      return F&&F.shape;
    };
    const sh=doc.mep.sheets[doc.mep.cur];sh.views.length=0;sh.dims.length=0;
    const bd={id:'__p__',bodyId:'__p__',shape:null,mesh:{visible:true}};bodies.push(bd);
    let n=0;
    const v={id:'__v__',kind:'base',dir:[0,0,-1],u:[1,0,0],v:[0,-1,0],x:100,y:100,scale:1,mode:'hide',tangent:false,hlrExact:true,bodyId:'__p__',axes:[]};
    sh.views.push(v);
    const projette=()=>{bd.shape=rejoue();T.geoClear&&T.geoClear();const g=T.geo(v);n++;return g;};
    place(30,30,70,30,6);
    let g=projette();
    A(/^OCCT/.test(g.src||''),'projection exacte du noyau ('+g.src+')');
    out.arcs=g.els.filter(e=>e.t==='A').map(e=>[e.cx,e.cy,e.r,e.a0,e.a1].map(x=>+x.toFixed(3)));
    let S=T.slotsOf(v);
    A(S.length===1,'oblong reconnu dans la vraie vue ('+S.length+')');
    if(!S.length)return out;
    const c=S[0],cs=[[c.x1,c.y1],[c.x2,c.y2]].sort((p,q)=>p[0]-q[0]);
    A(near(cs[0][0],30)&&near(Math.abs(cs[0][1]),30)&&near(cs[1][0],70)&&near(c.r,6),'centres en x = 30 et 70, R6');
    const yC=c.y1;
    // arc gauche et arc droit : clics à la position papier
    T.st().zoom=1;
    const hitA=T.hitEnt(100+24,100+yC),hitB=T.hitEnt(100+76,100+yC);
    A(hitA&&hitA.e.t==='A'&&hitB&&hitB.e.t==='A','les 2 bouts se cliquent comme des arcs');
    mepSetTool('dim');
    T.dimSelect(hitA);T.dimAdd(hitB);T.dimCommit({x:150,y:100+yC+30});
    const dE=sh.dims[sh.dims.length-1];
    A(dE&&near(T.dimMeasure(dE),40),'entraxe 40 ('+(dE&&T.dimMeasure(dE))+')');
    // position depuis le bord x = 0 du bloc
    const hitBord=g.els.map((e,i)=>({e,i})).find(q=>q.e.t==='L'&&near(q.e.x1,0)&&near(q.e.x2,0));
    A(!!hitBord,'bord gauche du bloc présent');
    mepSetTool('dim');
    T.dimSelect(T.hitEnt(100+24,100+yC));
    T.dimAdd({vid:v.id,i:hitBord.i,e:hitBord.e,lx:0,ly:yC});
    T.dimCommit({x:115,y:100+yC+45});
    const dP=sh.dims[sh.dims.length-1];
    A(dP&&near(T.dimMeasure(dP),30),'position du centre depuis le bord : 30 ('+(dP&&T.dimMeasure(dP))+')');
    // axe d'un clic
    mepSetTool('axis');
    T.axisClick({x:150,y:100+yC+6});
    A(v.axes.length===1&&v.axes[0].kind==='slot','Axes : un clic sur le côté droit');
    // allongement dissymétrique du côté droit : de 40 à 60
    place(30,30,90,30,6);
    g=projette();
    A(g.src&&/^OCCT/.test(g.src),'pièce rejouée et reprojetée');
    A(near(T.dimMeasure(dE),60),'allongé : entraxe 60 ('+T.dimMeasure(dE)+')');
    A(near(T.dimMeasure(dP),30),'allongé : position du centre fixe 30 ('+T.dimMeasure(dP)+')');
    const P=T.axisManual(v,v.axes[0]);
    A(P.length===3&&near(Math.max(P[0].x1,P[0].x2),99),'allongé : l’axe suit jusqu’à 99 ('+(P[0]&&Math.max(P[0].x1,P[0].x2))+')');
    // oblique
    sh.dims.length=0;v.axes.length=0;
    place(30,15,70,45,5);
    g=projette();
    S=T.slotsOf(v);
    A(S.length===1&&near(S[0].d,50),'oblong oblique reconnu, entraxe 50');
    return out;
  })()`,ctx);
  r.log.forEach(m=>console.log('  ok  '+m));
  r.fails.forEach(m=>console.log('  KO  '+m));
  if(process.env.DETAIL)console.log(JSON.stringify(r.arcs));
  console.log(r.fails.length?'test_mep_oblong_reel : '+r.fails.length+' échec(s)':'test_mep_oblong_reel : OK ('+r.log.length+')');
  process.exit(r.fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
