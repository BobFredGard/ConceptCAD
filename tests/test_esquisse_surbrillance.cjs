// Panneau d'esquisse : une contrainte ou une cote sélectionnée surligne ses cibles dans la vue
// (skConTargets / skDrawConHalo) ; les centres de perçage se distinguent des points ordinaires
// (skHolePids : rond orange au lieu du carré, « perçage… » dans les listes).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const r=vm.runInContext(`(function(){
    const F=[],P=[];const A=(c,m)=>{if(!c)F.push(m);else P.push(m);};
    const s={id:'skT',name:'T',plane:'XY',entities:[],points:{},constraints:[],dims:[],seq:1};
    const a=addPoint(s,0,0),b=addPoint(s,40,0),h=addPoint(s,20,10),q=addPoint(s,5,5);
    const L={id:skNewEid(s),t:'line',p1:a,p2:b};s.entities.push(L,{id:skNewEid(s),t:'cpoint',p:h,hole:true},{id:skNewEid(s),t:'cpoint',p:q});
    const on={id:skNewEid(s),type:'online',p:h,line:L.id},fx={id:skNewEid(s),type:'fix',p:q};
    const dm={id:skNewEid(s),type:'distance',a:a,b:h,value:22};
    s.constraints.push(on,fx);s.dims.push(dm);
    let T=skConTargets(s,on);A(T.pts.has(h)&&T.ents.has(L.id)&&T.pts.size===1&&T.ents.size===1,'point sur ligne : le point et la ligne visés');
    T=skConTargets(s,dm);A(T.pts.has(a)&&T.pts.has(h)&&!T.ents.size,'cote de distance : ses 2 points');
    const H=skHolePids(s);A(H.has(h)&&!H.has(q),'centre de perçage reconnu, point de construction non');
    A(/perçage/.test(conDesc(s,on))&&!/perçage/.test(conDesc(s,fx)),'liste : « perçage… » pour un centre de perçage seulement ('+conDesc(s,on)+' | '+conDesc(s,fx)+')');
    return P.map(m=>'  ✓ '+m).concat(F.map(m=>'  ✗ '+m)).join(String.fromCharCode(10))+(F.length?String.fromCharCode(10)+'ECHECS':'');
  })()`,ctx);
  console.log('=== esquisse : surbrillance des cibles, points de perçage ===');console.log(r);
  process.exit(/ECHECS/.test(r)?1:0);
})().catch(e=>{console.error('FATAL',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
