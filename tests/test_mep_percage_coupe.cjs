// Mise en plan : un perçage coupé par une extrusion reste reconnu par la cotation de perçage.
// Demande : « si l'on coupe cet alésage par une extrusion d'un rectangle, l'alésage n'est plus
// reconnu par la cotation de perçage ». Vu de bout, le trou coupé n'est plus un cercle mais des arcs.
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
      return {id,name:id,plane:'XY',origin:[0,0,30],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:P,entities:E,constraints:[],dims:[],seq:30,visible:false};};
    mepSetActive(true);
    const sh=doc.mep.sheets[doc.mep.cur];
    const VUE={id:'vTop',kind:'base',dir:[0,0,1],u:[1,0,0],v:[0,-1,0],x:100,y:100,scale:1,mode:'hide',tangent:false,hlrExact:true,axes:[]};
    // pointe de la flèche d'une cote de perçage (repère de la vue)
    const tip=(v,d)=>{
      const lines=[];
      const node=(tag,at)=>{if(tag==='line')lines.push(at);return {setAttribute(){},getBBox(){return {width:10,height:3};},getComputedTextLength(){return 10;},style:{},appendChild(){},textContent:''};};
      T.drawDim(node,d);
      const l=lines[0];return l?{x:(l.x2-v.x)/v.scale,y:(l.y2-v.y)/v.scale}:null;
    };
    const inArc=(e,a)=>{const lo=Math.min(e.a0,e.a1),hi=Math.max(e.a0,e.a1);let x=a;while(x<lo)x+=2*Math.PI;return x<=hi+1e-6;};
    const cas=(hPts,cuts,hole)=>{
      doc.sketches=[rect('skB',0,0,0,100,60),pts('skH',hPts)];
      doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skB',distance:30,op:'add',visible:true}];
      doc.bodies=[];delete doc.activeBody;markDirty();rebuild();
      askHole('skH');
      const f=doc.features[doc.features.length-1];
      Object.assign(f,hole);f.name=holeName(f);
      cuts.forEach((c,i)=>{doc.sketches.push(rect('skC'+i,c.z,c.x0,c.y0,c.x1,c.y1));
        doc.features.push({id:'C'+i,type:'extrude',name:'Coupe'+i,sketchId:'skC'+i,distance:c.h,op:'cut',visible:true});});
      markDirty();rebuild();
      sh.views=[Object.assign({},VUE,{axes:[]})];sh.dims=[];
      T.geoClear();
      const v=sh.views[0],g=T.geo(v);
      const arcs=g.els.map((e,i)=>({e,i})).filter(o=>o.e.t==='C'||o.e.t==='A');
      const res={engine:builtEngine,err:doc.features.filter(x=>x._err).map(x=>x.name+':'+x._err),
        ents:arcs.map(o=>o.e.t+' r'+o.e.r.toFixed(2)),holeAt:arcs.map(o=>{const m=T.holeAt(sh,v.id,o.e,o.i);return !!m&&m.f.id===f.id;})};
      const first=arcs.find(o=>T.holeAt(sh,v.id,o.e,o.i));
      const draft=first?T.holeDraft(sh,v.id,first.e,first.i):null;
      res.draft=draft?draft.holeText:null;
      res.auto=T.autoHoles();
      res.dims=sh.dims.map(d=>{
        const e=T.entByHint(v,d.a.hint),P=tip(v,d);
        const onArc=!!P&&arcs.some(o=>Math.abs(Math.hypot(P.x-o.e.cx,P.y-o.e.cy)-o.e.r)<0.05&&(o.e.t==='C'||inArc(o.e,Math.atan2(P.y-o.e.cy,P.x-o.e.cx))));
        return {n:d.holeN,t:d.holeText,ent:e?e.t:null,onArc};
      });
      return res;
    };
    const ALE={kind:'ream',reamD:20,reamH:30,reamTol:'H7',pilot:'open',reamOff:0.5,d:19.5};
    // témoin : alésage entier
    out.entier=cas([[50,30]],[],ALE);
    // moitié de l'alésage enlevée sur toute la hauteur
    out.moitie=cas([[50,30]],[{z:0,h:30,x0:50,y0:-5,x1:120,y1:65}],ALE);
    // rainure à travers : deux arcs de part et d'autre
    out.rainure=cas([[50,30]],[{z:0,h:30,x0:45,y0:-5,x1:55,y1:65}],ALE);
    // poche de 10 de haut, sur le dessus seulement
    out.poche=cas([[50,30]],[{z:20,h:10,x0:50,y0:-5,x1:120,y1:65}],ALE);
    // deux trous de la même fonction, un seul coupé
    out.deux=cas([[25,30],[75,30]],[{z:0,h:30,x0:75,y0:-5,x1:120,y1:65}],ALE);
    // perçage simple coupé
    out.simple=cas([[50,30]],[{z:0,h:30,x0:50,y0:-5,x1:120,y1:65}],{d:8,end:'through'});
    // un arc qui n'a pas de perçage derrière n'est pas pris pour un perçage
    out.faux=!!T.holeAt(sh,sh.views[0].id,{t:'A',cx:10,cy:-10,r:4,a0:0,a1:1},0);
    // cote posée AVANT la coupe : elle suit après « Rejeter »
    {
      const p=cas([[50,30]],[],ALE);
      doc.sketches.push(rect('skC9',0,50,-5,120,65));
      doc.features.push({id:'C9',type:'extrude',name:'Coupe9',sketchId:'skC9',distance:30,op:'cut',visible:true});
      markDirty();rebuild();
      window.mepReprojectAll();
      const v=sh.views[0],d=sh.dims[0],e=d?T.entByHint(v,d.a.hint):null;
      out.avant={pose:p.dims.length,n:sh.dims.length,t:d&&d.holeText,ent:e?e.t:null,r:e?e.r:null};
      // étiquette glissée du côté enlevé (x > 50) : la flèche reste au bord de la matière (x = 50)
      d.b={x:90,y:-30};
      const P=tip(v,d);
      out.glisse=P?{x:P.x,dc:Math.hypot(P.x-50,P.y+30)}:null;
    }
    return out;
  })()`,ctx);
  console.log('  · '+JSON.stringify(r));
  const ok=c=>c&&c.engine==='exact'&&!c.err.length;
  A(ok(r.entier)&&r.entier.dims.length===1&&r.entier.dims[0].t==='Ø20 déb.','témoin : alésage entier coté Ø20 déb.');
  A(ok(r.moitie)&&r.moitie.ents.every(s=>s[0]==='A')&&r.moitie.holeAt.every(Boolean),'moitié enlevée : les arcs sont reconnus comme le perçage');
  A(r.moitie.draft==='Ø20 déb.','moitié enlevée : l’outil Perçage donne Ø20 déb.');
  A(r.moitie.dims.length===1&&r.moitie.dims[0].n===1&&r.moitie.dims[0].ent==='A','moitié enlevée : « Coter les perçages » pose 1 cote, trou compté une fois');
  A(r.moitie.dims[0]&&r.moitie.dims[0].onArc,'moitié enlevée : la flèche pointe sur la matière restante');
  A(ok(r.rainure)&&r.rainure.dims.length===1&&r.rainure.dims[0].n===1&&r.rainure.dims[0].onArc,'rainure à travers : les arcs de part et d’autre = 1 trou, flèche sur un arc');
  A(ok(r.poche)&&r.poche.dims.length===1&&r.poche.dims[0].n===1&&r.poche.dims[0].t==='Ø20 déb.','poche sur le dessus : reste Ø20 déb., 1 trou');
  A(ok(r.deux)&&r.deux.dims.length===1&&r.deux.dims[0].n===2&&r.deux.dims[0].ent==='C','deux trous dont un coupé : « 2× », étiquette sur le trou entier');
  A(ok(r.simple)&&r.simple.dims.length===1&&/^Ø8 déb/.test(r.simple.dims[0].t),'perçage simple coupé : reconnu aussi');
  A(!r.faux,'arc sans perçage derrière : pas reconnu');
  A(r.avant.pose===1&&r.avant.n===1&&r.avant.ent==='A'&&Math.abs(r.avant.r-10)<0.05,'cote posée avant la coupe : reste accrochée au trou coupé');
  A(r.glisse&&Math.abs(r.glisse.x-50)<0.05&&Math.abs(r.glisse.dc-10)<0.05,'étiquette glissée côté enlevé : la flèche reste au bord de la matière');
  console.log(ko?'ÉCHEC '+ko:'OK');
  process.exit(ko?1:0);
})();
