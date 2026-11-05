// Mise en plan : les traits fins du fond de filet apparaissent dans une COUPE LOCALE, comme dans
// une vue en coupe. Demande : « ceci est un trou taraudé mais à la coupe locale, les traits fins du
// fond de filet n'apparaissent pas ».
// Pavé 60 × 40 × 20, M8 borgne fileté sur 10 depuis le dessus, percés le long de Z ; plan de coupe Y = 20.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};showAll=function(){};',ctx);
  const r=await vm.runInContext(`(async()=>{
    const out={},T=window.__mepTest;
    const rect=(id,z,x0,y0,x1,y1)=>({id,name:id,plane:'XY',origin:[0,0,z],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
      points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],
      constraints:[],dims:[],seq:20,visible:false});
    const pts=(id,list)=>{const P={},E=[];list.forEach((q,i)=>{P['h'+i]={x:q[0],y:q[1]};E.push({id:'e'+i,t:'cpoint',p:'h'+i,hole:true});});
      return {id,name:id,plane:'XY',origin:[0,0,20],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:P,entities:E,constraints:[],dims:[],seq:30,visible:false};};
    mepSetActive(true);
    const sh=doc.mep.sheets[doc.mep.cur];
    // x = 15 : axe sur le plan ; x = 45 : 2 mm derrière le plan ; x = 30, y = 32 : derrière, pas coupé ; x = 30, y = 8 : côté enlevé
    doc.sketches=[rect('skB',0,0,0,60,40),pts('skH',[[15,20],[45,22],[30,32],[30,8]])];
    doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skB',distance:20,op:'add',visible:true}];
    doc.bodies=[];delete doc.activeBody;markDirty();rebuild();
    askHole('skH');
    const f=doc.features[doc.features.length-1];
    Object.assign(f,{d:6.8,end:'blind',depth:15,thread:{size:'M8',p:1.25,len:10,lenMode:'len'}});f.name=holeName(f);
    markDirty();rebuild();
    out.engine=builtEngine;out.err=doc.features.filter(x=>x._err).map(x=>x._err);
    // vue de face : u = X, v = −Z, l'observateur côté −Y (la matière Y < 20 est ôtée)
    const vue=(mode,locals)=>{const v={id:'v'+mode,kind:'base',vk:'front',dir:[0,-1,0],u:[1,0,0],v:[0,0,-1],x:100,y:100,scale:1,mode,tangent:false,hlrExact:true,axes:[]};if(locals)v.locals=locals;sh.views=[v];T.geoClear();return v;};
    const rf=g=>{const e=g.els.find(q=>q.t==='L'&&q.k==='hidden'&&Math.abs(q.x1-q.x2)<1e-3&&Math.abs(q.x1-(15+3.4))<1e-3);return e?{x:e.x1,y:(e.y1+e.y2)/2,s:{t:'L',x1:e.x1,y1:e.y1,x2:e.x2,y2:e.y2,k:e.k},w:e.w}:null;};
    const g0=T.geo(vue('dash'));
    const ref=rf(g0);out.w=ref?ref.w:null;
    const fmt=(g,k)=>g.els.filter(q=>q.k===k&&q.t==='L').map(q=>[q.x1,q.y1,q.x2,q.y2].map(x=>+x.toFixed(2)));
    out.avantThread=fmt(g0,'thread').length;
    // forme : X 5..55, Z 2..18 (y local −18..−2)
    const forme=[[5,-18],[55,-18],[55,-2],[5,-2]];
    const v1=vue('dash',[{id:'L1',pts:forme,ref}]);
    const g1=T.geo(v1);
    out.lost=v1.locals[0].lost;
    out.thr=fmt(g1,'thread');
    out.thrH=fmt(g1,'threadH');
    out.fin=g1.els.filter(q=>q.t==='L'&&q.k==='sharp'&&Math.abs(q.y1+10)<1e-3&&Math.abs(q.y2+10)<1e-3).map(q=>[q.x1,q.x2].map(x=>+x.toFixed(2)).sort((a,b)=>a-b));
    out.hatch=(g1.hatchLoc||[]).length;
    // mode sans cachées : le fond de filet coupé reste, le filet caché disparaît
    const v2=vue('hide',[{id:'L1',pts:forme,ref:JSON.parse(JSON.stringify(ref))}]);
    v2.locals[0].ref.s=null;
    const g2=T.geo(v2);
    out.hide=fmt(g2,'thread').length;out.hideH=fmt(g2,'threadH').length;
    // en bout (plan perpendiculaire à l'axe) : 3/4 de cercle si le plan traverse la partie filetée
    const vt={id:'vT',kind:'base',vk:'top',dir:[0,0,1],u:[1,0,0],v:[0,-1,0],x:100,y:100,scale:1,mode:'hide',tangent:false,hlrExact:true,axes:[]};
    sh.views=[vt];
    const nArc=z=>T.threadEls(vt,{planes:[[0,0,z]],n:[0,0,1]}).filter(e=>e.t==='A'&&e.k==='thread').length;
    out.arc15=nArc(15);out.arc5=nArc(5);
    return out;
  })()`,ctx);
  console.log('  · '+JSON.stringify(r));
  const X=l=>l.flatMap(q=>[q[0],q[2]]);
  const at=(l,x)=>l.filter(q=>Math.abs(q[0]-x)<0.02&&Math.abs(q[2]-x)<0.02);
  const c=Math.sqrt(16-4);
  A(r.engine==='exact'&&!r.err.length,'modèle exact sans erreur');
  A(r.avantThread===0,'vue entière : pas de fond de filet coupé');
  A(Math.abs(r.w+20)<0.01&&!r.lost,'plan de coupe à Y = 20 (arête du trou)');
  A(r.hatch===1,'coupe locale hachurée');
  A(at(r.thr,11).length===1&&at(r.thr,19).length===1,'trou coupé dans l’axe : fond de filet à Ø8 des deux côtés');
  const tr=at(r.thr,11)[0];
  A(tr&&Math.abs(Math.max(tr[1],tr[3])+10)<0.01&&Math.min(tr[1],tr[3])>-20&&Math.min(tr[1],tr[3])<-18,'trait du fond de filet sur la longueur filetée, arrêté au bord de la forme');
  A(at(r.thr,45-c).length===1&&at(r.thr,45+c).length===1,'trou coupé hors de l’axe : trait à la corde du Ø8');
  A(!X(r.thr).some(x=>x>26&&x<34),'trous non coupés : pas de fond de filet en trait fin');
  A(r.fin.some(q=>Math.abs(q[0]-11)<0.02&&Math.abs(q[1]-19)<0.02),'fin de filetage en trait fort');
  const dedans=l=>l.filter(q=>Math.abs(q[1]-q[3])>5);
  A(dedans(at(r.thrH,26)).length===1&&dedans(at(r.thrH,34)).length===1,'trou derrière le plan : filet caché en pointillé ; trou côté enlevé : aucun (pas de doublon au même endroit)');
  A(r.hide===4&&r.hideH===0,'sans cachées : fonds de filet coupés seuls ('+r.hide+')');
  A(r.arc15===4&&r.arc5===0,'plan perpendiculaire : 3/4 de cercle seulement s’il traverse le filetage');
  console.log(ko?'ÉCHEC '+ko:'OK');
  process.exit(ko?1:0);
})();
