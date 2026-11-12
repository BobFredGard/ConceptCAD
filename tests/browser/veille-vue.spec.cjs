// Veille du dessin (V0.95.9) : à l'arrêt, la vue 3D n'est plus redessinée à chaque image
// (carte graphique à fond sur un portable avec une pièce lourde, sans toucher la souris) ;
// un geste (molette) rend la pleine cadence ; ?sansveille garde l'ancienne cadence continue.
'use strict';
const {test,expect}=require('@playwright/test');

async function mesure(page,url){
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  await page.goto(url);
  await page.waitForFunction(()=>typeof renderer!=='undefined'&&renderer&&typeof camera!=='undefined'&&typeof viewRaf==='function',null,{timeout:120000});
  await page.waitForTimeout(3000);
  const r=await page.evaluate(async()=>{
    window.__n=0;const o=renderer.render.bind(renderer);
    renderer.render=function(s,c){if(c===camera)window.__n++;return o(s,c);};
    let k=0;const f=()=>{k++;viewRaf(f);};f(); // viewRaf : compte les images sans réveiller la vue
    await new Promise(r=>setTimeout(r,3000));
    const idle=window.__n,frames=k;window.__n=0;
    const cv=renderer.domElement,bb=cv.getBoundingClientRect();
    const z0=camera.position.distanceTo(controls.target);
    cv.dispatchEvent(new WheelEvent('wheel',{deltaY:-200,clientX:bb.left+bb.width/2,clientY:bb.top+bb.height/2,bubbles:true}));
    await new Promise(r=>setTimeout(r,1000));
    return {frames,idle,active:window.__n,zoom:Math.abs(camera.position.distanceTo(controls.target)-z0)>1e-6};
  });
  expect(err).toEqual([]);
  return r;
}

test('vue 3D en veille à l\'arrêt, pleine cadence au moindre geste',async({page})=>{
  const r=await mesure(page,'/ConceptCAD.html');
  expect(r.frames).toBeGreaterThan(60);           // la page tourne bien
  expect(r.idle).toBeLessThan(r.frames/5);        // à l'arrêt : quelques images seulement (≈ 2,5 par seconde)
  expect(r.idle).toBeGreaterThan(0);              // filet : la vue se redessine encore de temps en temps
  expect(r.zoom).toBe(true);
  expect(r.active).toBeGreaterThan(20);           // après la molette : pleine cadence
});

test('?sansveille : ancienne cadence continue',async({page})=>{
  const r=await mesure(page,'/ConceptCAD.html?sansveille');
  expect(r.idle).toBeGreaterThan(r.frames*0.8);
});
