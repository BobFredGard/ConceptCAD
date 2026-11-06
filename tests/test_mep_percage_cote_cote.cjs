// Mise en plan : la cotation de perçage marche dans toutes les vues, le trou vu de bout OU de côté.
// Demande : « Permettre de coter dans toutes les vues, que le perçage soit du côté du trou ou sens long ».
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
    const pts=(id,list,pl)=>{const P={},E=[];list.forEach((q,i)=>{P['h'+i]={x:q[0],y:q[1]};E.push({id:'e'+i,t:'cpoint',p:'h'+i,hole:true});});
      return Object.assign({id,name:id,plane:'XY',origin:[0,0,30],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:P,entities:E,constraints:[],dims:[],seq:30,visible:false},pl||{});};
    mepSetActive(true);
    const sh=doc.mep.sheets[doc.mep.cur];
    const COM={kind:'base',x:100,y:100,scale:1,mode:'dash',tangent:false,hlrExact:true,axes:[]};
    const DESSUS=Object.assign({id:'vDessus',dir:[0,0,1],u:[1,0,0],v:[0,-1,0]},COM);
    const FACE=Object.assign({id:'vFace',dir:[0,-1,0],u:[1,0,0],v:[0,0,-1]},COM);
    const BIAIS=Object.assign({id:'vBiais'},COM,{camera:true,dir:[0.5,-0.5,0.7071]});
    const COUPE=Object.assign({id:'vCoupe',dir:[0,-1,0],u:[1,0,0],v:[0,0,-1]},COM,{kind:'section',mode:'hide',parent:'vDessus',label:'A',
      section:{p:[0,30,0],n:[0,-1,0],a:[0,-30],b:[100,-30],pid:'vDessus'}});
    const cas=(hPts,hole,pl)=>{
      doc.sketches=[rect('skB',0,0,0,100,60),pts('skH',hPts,pl)];
      doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skB',distance:30,op:'add',visible:true}];
      doc.bodies=[];delete doc.activeBody;markDirty();rebuild();
      askHole('skH');
      const f=doc.features[doc.features.length-1];
      Object.assign(f,hole);f.name=holeName(f);
      markDirty();rebuild();
      sh.views=[DESSUS,FACE,BIAIS,COUPE].map(v=>JSON.parse(JSON.stringify(v)));sh.dims=[];
      T.geoClear();
      return {f,engine:builtEngine,err:doc.features.filter(x=>x._err).map(x=>x.name+':'+x._err)};
    };
    // ce qui est reconnu dans une vue : traits, cercles, et le texte de la cote
    const bilan=vid=>{
      const v=sh.views.find(x=>x.id===vid),g=T.geo(v);
      const L=g.els.map((e,i)=>({e,i})).filter(o=>o.e.t==='L');
      const pris=L.filter(o=>T.holeAtLine(sh,vid,o.e,o.i));
      const arcs=g.els.filter(e=>e.t==='C'||e.t==='A').map(e=>[e.t,e.cx,e.cy,e.r,e.a0,e.a1,e.k].map(q=>typeof q==='number'?+q.toFixed(2):q));
      const circ=g.els.map((e,i)=>({e,i})).filter(o=>(o.e.t==='C'||o.e.t==='A')&&T.holeAt(sh,vid,o.e,o.i));
      const brut=pris.slice(0,40).map(o=>[o.e.x1,o.e.y1,o.e.x2,o.e.y2].map(q=>+q.toFixed(2)));
      const parois=pris.filter(o=>Math.abs(o.e.x1-o.e.x2)<0.01&&Math.abs(o.e.y1-o.e.y2)>1).map(o=>+o.e.x1.toFixed(2));
      const d=pris[0]?T.holeDraft(sh,vid,pris[0].e,pris[0].i):null;
      return {arcs,nL:L.length,nC:g.els.filter(e=>e.t==='C'||e.t==='A').length,pris:pris.length,circ:circ.length,brut,parois:[...new Set(parois)].sort((a,b)=>a-b),
        draft:d&&{t:d.holeText,n:d.holeN,hint:d.a.hint&&d.a.hint.t}};
    };
    // ---------- débouchant : de bout en haut, parois en face et en coupe
    {
      const c=cas([[50,30]],{d:8,end:'through'});
      out.deb={engine:c.engine,err:c.err,dessus:bilan('vDessus'),face:bilan('vFace'),coupe:bilan('vCoupe'),biais:bilan('vBiais')};
      const gb=T.geo(sh.views.find(x=>x.id==='vBiais'));
      out.deb.arcsBiais=gb.els.map((e,i)=>({e,i})).filter(o=>o.e.t==='A').map(o=>{const d=T.holeDraft(sh,'vBiais',o.e,o.i);return d&&d.holeText;});
      const gd=T.geo(sh.views.find(x=>x.id==='vDessus')),ic=gd.els.findIndex(e=>e.t==='C');
      const dc=T.holeDraft(sh,'vDessus',gd.els[ic],ic);
      out.deb.bout={t:dc&&dc.holeText,hint:dc&&dc.a.hint.t};
    }
    // ---------- borgne : la paroi s'arrête au fond ; lamage ; alésage
    {
      const c=cas([[50,30]],{d:8,end:'blind',depth:12,tip:118});
      out.borgne={err:c.err,coupe:bilan('vCoupe')};
      // une arête de la pièce alignée sur la paroi mais hors du trou n'est pas un trou
      const v=sh.views.find(x=>x.id==='vCoupe');
      out.borgne.horsLong=!!T.holeAtLine(sh,'vCoupe',{t:'L',x1:46,y1:-14,x2:46,y2:-3},0);
      out.borgne.dansLong=!!T.holeAtLine(sh,'vCoupe',{t:'L',x1:46,y1:-30,x2:46,y2:-20},0);
    }
    {
      const c=cas([[50,30]],{kind:'cbore',d:8,cbD:14,cbH:6,end:'through'});
      out.lamage={err:c.err,coupe:bilan('vCoupe')};
    }
    // ---------- deux trous de la même fonction : superposés de côté, cote « 2× »
    {
      const c=cas([[25,30],[75,30]],{d:6,end:'through'});
      out.deux={err:c.err,coupe:bilan('vFace')};
      const g=T.geo(sh.views.find(x=>x.id==='vFace'));
      const i=g.els.findIndex((e,k)=>e.t==='L'&&Math.abs(e.x1-e.x2)<0.01&&T.holeAtLine(sh,'vFace',e,k));
      const d=T.holeDraft(sh,'vFace',g.els[i],i,g.els[i].x1,(g.els[i].y1+g.els[i].y2)/2);
      out.deux.tip={ax:d.a.x,ay:d.a.y,x1:g.els[i].x1,y1:g.els[i].y1,y2:g.els[i].y2};
      // cote posée, puis trou agrandi : le texte suit, sans décrocher
      delete d.__ghost;sh.dims=[d];
      const f=doc.features[doc.features.length-1];
      f.d=10;f.name=holeName(f);markDirty();rebuild();window.mepReprojectAll();T.geoClear();
      const lines=[],node=(tag,at)=>{if(tag==='line')lines.push(at);return {setAttribute(){},getBBox(){return {width:10,height:3};},getComputedTextLength(){return 10;},style:{},appendChild(){},textContent:''};};
      T.drawDim(node,sh.dims[0]);
      out.deux.apres={t:sh.dims[0].holeText,n:sh.dims[0].holeN,hint:sh.dims[0].a.hint&&sh.dims[0].a.hint.t,fleche:lines[0]&&{x:lines[0].x2,y:lines[0].y2},ent:(T.entByHint(sh.views.find(x=>x.id==='vFace'),sh.dims[0].a.hint)||{}).t,a:sh.dims[0].a};
    }
    // ---------- trou percé sur le flanc : en long vu de dessus, de bout vu de côté
    {
      const c=cas([[30,15]],{d:8,end:'through'},{origin:[100,0,0],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0]});
      out.flanc={err:c.err,dessus:bilan('vDessus'),face:bilan('vFace')};
    }
    // ---------- arêtes extérieures jamais prises pour un trou
    {
      cas([[50,30]],{d:8,end:'through'});
      const f=T.geo(sh.views.find(x=>x.id==='vFace'));
      out.bords=f.els.map((e,i)=>({e,i})).filter(o=>o.e.t==='L'&&Math.hypot(o.e.x2-o.e.x1,o.e.y2-o.e.y1)>25&&Math.abs(o.e.x1-46)>0.01&&Math.abs(o.e.x1-54)>0.01).map(o=>!!T.holeAtLine(sh,'vFace',o.e,o.i));
    }
    return out;
  })()`,ctx);
  console.log('  · '+JSON.stringify(r).slice(0,600));
  const D=r.deb;
  A(D.engine==='exact'&&!D.err.length,'pièce de référence construite');
  A(D.dessus.circ===1&&D.dessus.pris===0&&D.bout.t==='Ø8 déb.'&&D.bout.hint==='ctr','de bout : toujours le cercle, cote inchangée');
  A(D.face.parois.join()==='46,54'&&D.face.draft&&D.face.draft.t==='Ø8 déb.','vue de face : parois cachées reconnues, Ø8 déb.');
  A(D.coupe.parois.join()==='46,54'&&D.coupe.draft&&D.coupe.draft.t==='Ø8 déb.'&&D.coupe.draft.hint==='seg','coupe : parois reconnues, flèche sur le trait');
  A(D.biais.pris>10&&D.biais.draft&&D.biais.draft.t==='Ø8 déb.','vue en biais : ellipses et parois reconnues');
  A(D.arcsBiais.length>0&&D.arcsBiais.every(t=>t==='Ø8 déb.'),'vue en biais : les petits arcs de l’ellipse aussi');
  const B=r.borgne;
  A(!B.err.length&&B.coupe.parois.join()==='46,54'&&B.coupe.draft.t==='Ø8 ↧12','borgne en coupe : parois reconnues, Ø8 ↧12');
  A(B.coupe.brut.some(l=>l[0]===46&&l[2]===50),'borgne en coupe : le cône du fond est reconnu');
  A(B.dansLong,'borgne : un trait dans la longueur du trou est reconnu');
  A(!B.horsLong,'borgne : un trait aligné au-delà du fond n’est pas un trou');
  const L=r.lamage;
  A(!L.err.length&&L.coupe.parois.join()==='43,46,54,57'&&/Lamage Ø14/.test(L.coupe.draft.t),'lamage en coupe : les deux Ø reconnus, texte complet');
  const X=r.deux;
  A(!X.err.length&&X.coupe.draft.n===2,'deux trous de la même fonction : « 2× », bien que superposés de côté');
  A(X.apres.t==='Ø10 déb.'&&X.apres.n===2&&X.apres.ent==='L','trou agrandi après la cote : le texte suit, 2× conservé');
  A(X.apres.fleche&&Math.abs(X.apres.fleche.x-(100+20))<0.05,'trou agrandi : la flèche reste sur la paroi (x = 20)');
  const F=r.flanc;
  A(!F.err.length&&F.dessus.pris>=2&&F.dessus.draft.t==='Ø8 déb.'&&F.face.pris>=2,'trou percé sur le flanc : reconnu en long dans les autres vues');
  A(r.bords.length>0&&r.bords.every(x=>!x),'arêtes extérieures de la pièce : jamais prises pour un trou');
  console.log(ko?'ÉCHEC '+ko:'OK');
  process.exit(ko?1:0);
})();
