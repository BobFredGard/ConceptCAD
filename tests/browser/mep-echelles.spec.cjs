// Échelles de la mise en plan (2026-11-12) : 3:4 écrit « 3:4 » dans le cartouche (et non 1:1.33),
// 1:6 et 1:8 dans la liste, « Autre… » : échelle de son choix tapée (2:3, 1/7, 0,75).
'use strict';
const {test,expect}=require('@playwright/test');

test('mise en plan : échelles 3:4, 1:6, 1:8 et échelle libre',async({page})=>{
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
    window.mepReprojectAll();
    __mepTest.setViewSel(v.id);
  });
  const sel=page.locator('#mepSide .row:has(> label:text-is("Échelle")) select').first();
  const libre=page.locator('#mepSide input.mepScaleLibre').first();
  const etat=()=>page.evaluate(()=>{
    const sh=doc.mep.sheets[doc.mep.cur];
    return{scale:sh.views.find(o=>o.id==='vF').scale,lab:__mepTest.scaleLabel(sh)};
  });
  const opts=await sel.locator('option').allTextContents();
  expect(opts).toEqual(expect.arrayContaining(['3:4','1:6','1:8','1:10','Autre…']));
  await sel.selectOption({label:'3:4'});
  expect(await etat()).toEqual({scale:0.75,lab:'3:4'});
  await sel.selectOption({label:'1:6'});
  expect((await etat()).lab).toBe('1:6');
  await sel.selectOption({label:'1:8'});
  expect(await etat()).toEqual({scale:0.125,lab:'1:8'});
  // échelle libre
  await sel.selectOption({label:'Autre…'});
  await expect(libre).toBeVisible();
  await libre.fill('2:3');await libre.press('Enter');
  const e=await etat();
  expect(e.scale).toBeCloseTo(2/3,9);expect(e.lab).toBe('2:3');
  // le panneau rouvert garde l'échelle libre affichée
  await expect(page.locator('#mepSide input.mepScaleLibre').first()).toHaveValue('2:3');
  await expect(page.locator('#mepSide .row:has(> label:text-is("Échelle")) select option:checked').first()).toHaveText('2:3');
  await page.locator('#mepSide input.mepScaleLibre').first().fill('0,75');
  await page.locator('#mepSide input.mepScaleLibre').first().press('Enter');
  expect((await etat()).lab).toBe('3:4');
  // texte illisible : rien ne change
  await sel.selectOption({label:'Autre…'});
  await page.locator('#mepSide input.mepScaleLibre').first().fill('abc');
  await page.locator('#mepSide input.mepScaleLibre').first().press('Enter');
  expect((await etat()).scale).toBe(0.75);
  // le cartouche dessiné porte bien « 3:4 »
  const svgTxt=await page.evaluate(()=>__mepTest.titleTexts(__mepTest.sheet()).join('|'));
  expect(svgTxt).toContain('3:4');
  expect(svgTxt).not.toContain('1:1.33');
  expect(err).toEqual([]);
});
