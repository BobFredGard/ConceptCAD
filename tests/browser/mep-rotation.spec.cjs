// Rotation d'une vue de 90° (2026-11-10), dans un VRAI navigateur : bloc 100 × 30 percé, vue de face
// + vue de dessus projetée, cote de largeur ; boutons « ↺ 90° » et « ↻ 90° » du panneau de la vue.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');

test('mise en plan : tourner une vue de 90° dans un sens puis dans l’autre',async({page})=>{
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.addInitScript(()=>{window.__MEP_TEST_HOOKS__=true;});
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  await page.evaluate(()=>{
    const rect={id:'skB',name:'skB',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
      points:{a:{x:0,y:0},b:{x:100,y:0},c:{x:100,y:60},d:{x:0,y:60}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],
      constraints:[],dims:[],seq:20,visible:false};
    doc.sketches=[rect];
    doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skB',distance:30,op:'add',visible:true}];
    doc.bodies=[];delete doc.activeBody;markDirty();rebuild();
    mepSetActive(true);
    const sh=doc.mep.sheets[doc.mep.cur];sh.views.length=0;sh.dims.length=0;
    const v=mepAddViewStd('front');sh.views.length=0;sh.views.push(v);v.id='vF';v.x=120;v.y=90;v.scale=1;
    const t=mepProjectView('top',v);t.id='vT';
    window.mepReprojectAll();
    sh.dims.length=0;sh.dims.push({id:'dW',kind:'dist',vid:v.id,vid2:null,a:{x:0,y:0},b:{x:100,y:0},off:12,orient:'h',tol:null});
    __mepTest.setViewSel(v.id);
  });
  const etat=()=>page.evaluate(()=>{
    const sh=doc.mep.sheets[doc.mep.cur],v=sh.views.find(o=>o.id==='vF'),t=sh.views.find(o=>o.id==='vT'),b=__mepTest.viewBBox(v),d=sh.dims[0];
    return{rq:v.rq||0,w:+b.w.toFixed(2),h:+b.h.toFixed(2),cx:+(b.x+b.w/2).toFixed(2),cy:+(b.y+b.h/2).toFixed(2),
      orient:d.orient,val:+__mepTest.dimMeasure(d).toFixed(3),topBelow:t.y>v.y&&Math.abs(t.x-v.x)<1e-6,
      topW:+__mepTest.viewBBox(t).w.toFixed(2)};
  });
  const e0=await etat();
  expect(e0.w).toBeCloseTo(100,1);expect(e0.h).toBeCloseTo(30,1);
  const dir=process.env.KW_CAPTURES;
  if(dir)await page.screenshot({path:path.join(dir,'rotation-0.png')});
  await page.click('#mepRotL');
  await page.waitForFunction(()=>rebuildDepth===0);
  const e1=await etat();
  if(dir)await page.screenshot({path:path.join(dir,'rotation-gauche.png')});
  expect(e1.rq).toBe(1);
  expect(e1.w,'vue tournée : la largeur devient la hauteur').toBeCloseTo(30,1);
  expect(e1.h).toBeCloseTo(100,1);
  expect(e1.cx,'centre de la vue inchangé').toBeCloseTo(e0.cx,1);expect(e1.cy).toBeCloseTo(e0.cy,1);
  expect(e1.orient,'la cote horizontale devient verticale').toBe('v');
  expect(e1.val).toBeCloseTo(100,2);
  expect(e1.topBelow,'la vue de dessus reste dessous, alignée').toBe(true);
  expect(e1.topW,'la vue de dessus s’aligne sur la nouvelle largeur').toBeCloseTo(30,1);
  await page.click('#mepRotR');
  await page.waitForFunction(()=>rebuildDepth===0);
  const e2=await etat();
  expect(e2).toEqual(e0);
  // dans l'autre sens
  await page.click('#mepRotR');
  await page.waitForFunction(()=>rebuildDepth===0);
  const e3=await etat();
  expect(e3.rq).toBe(3);expect(e3.w).toBeCloseTo(30,1);
  if(dir)await page.screenshot({path:path.join(dir,'rotation-droite.png')});
  expect(err).toEqual([]);
});
