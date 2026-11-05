// Cotation de perçage, dans un VRAI navigateur : outil « Perçage » du ruban, vrais clics sur la paroi d'un
// trou vu de côté (vue de face, traits cachés) puis sur son cercle vu de bout.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');

test('cotation de perçage : de bout et de côté',async({page})=>{
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  const dir=process.env.KW_CAPTURES;

  await page.evaluate(()=>{
    const rect={id:'skB',name:'skB',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
      points:{a:{x:0,y:0},b:{x:100,y:0},c:{x:100,y:60},d:{x:0,y:60}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],
      constraints:[],dims:[],seq:20,visible:false};
    const pt={id:'skH',name:'skH',plane:'XY',origin:[0,0,30],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{h0:{x:50,y:30},h1:{x:20,y:30}},
      entities:[{id:'e0',t:'cpoint',p:'h0',hole:true},{id:'e1',t:'cpoint',p:'h1',hole:true}],constraints:[],dims:[],seq:30,visible:false};
    doc.sketches=[rect,pt];
    doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skB',distance:30,op:'add',visible:true}];
    doc.bodies=[];delete doc.activeBody;markDirty();rebuild();
    askHole('skH');
    const f=doc.features[doc.features.length-1];
    Object.assign(f,{d:8,end:'blind',depth:15,tip:118});f.name=holeName(f);
    markDirty();rebuild();
    mepSetActive(true);
    const sh=doc.mep.sheets[doc.mep.cur];
    const COM={kind:'base',scale:1,tangent:false,hlrExact:true,axes:[]};
    sh.views=[Object.assign({id:'vDessus',dir:[0,0,1],u:[1,0,0],v:[0,-1,0],x:60,y:90,mode:'hide'},COM),
      Object.assign({id:'vFace',dir:[0,-1,0],u:[1,0,0],v:[0,0,-1],x:60,y:170,mode:'dash'},COM)];
    sh.dims=[];
    window.mepReprojectAll();
    mepSetTool('hole');
  });
  // écran d'un point (mm locaux) d'une vue
  const ecran=(vid,x,y)=>page.evaluate(([vid,x,y])=>{
    const sh=doc.mep.sheets[doc.mep.cur],v=sh.views.find(o=>o.id===vid),svg=[...document.querySelectorAll('svg')].find(s=>s.id==='mepSvg')||document.querySelector('#mepWrap svg')||[...document.querySelectorAll('svg')].sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0];
    const m=svg.getScreenCTM(),p=svg.createSVGPoint();p.x=v.x+x*v.scale;p.y=v.y+y*v.scale;const q=p.matrixTransform(m);return {x:q.x,y:q.y};
  },[vid,x,y]);
  const nb=()=>page.evaluate(()=>doc.mep.sheets[doc.mep.cur].dims.length);
  const cote=async(vid,x,y,lx,ly)=>{
    const P=await ecran(vid,x,y);await page.mouse.move(P.x,P.y);await page.mouse.down();await page.mouse.up();
    const Q=await ecran(vid,lx,ly);await page.mouse.move(Q.x,Q.y);await page.mouse.down();await page.mouse.up();
  };

  // Vue de face : clic sur la paroi cachée du trou (x = 46), à mi-profondeur
  await cote('vFace',46,-24,20,12);
  expect(await nb(),'cote posée sur le trou vu de côté').toBe(1);
  // Vue de dessus : clic sur le cercle du trou de droite
  await page.evaluate(()=>mepSetTool('hole'));
  await cote('vDessus',54,-30,75,-50);
  expect(await nb(),'cote posée sur le trou vu de bout').toBe(2);

  const S=await page.evaluate(()=>doc.mep.sheets[doc.mep.cur].dims.map(d=>({v:d.vid,t:d.holeText,n:d.holeN,h:d.a.hint.t,ghost:!!d.__ghost})));
  expect(S[0]).toEqual({v:'vFace',t:'Ø8 ↧15',n:2,h:'seg',ghost:false});
  expect(S[1]).toEqual({v:'vDessus',t:'Ø8 ↧15',n:2,h:'ctr',ghost:false});
  await page.evaluate(()=>mepSetTool('select'));
  if(dir)await page.screenshot({path:path.join(dir,'mep-percage.png')});
  expect(err).toEqual([]);
});
