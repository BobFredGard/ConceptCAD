// Mesure depuis un plan du repère (90-10-selection-mesure, V0.99.61) : Ctrl+clic sur le petit
// plan XY / XZ / YZ du repère, puis Ctrl+clic sur une face (ou l'inverse) = distance exacte
// face ↔ plan ; rien n'est sélectionné, Échap/clic dans le vide efface la mesure.
'use strict';
const {test,expect}=require('@playwright/test');

test('Ctrl+clic plan du repère + face = distance au plan',async({page})=>{
  const err=[];page.on('pageerror',e=>err.push('pageerror : '+e.message));
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&occtReady===true,null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  // bloc 40 × 30 × 20 décalé de l'origine : X 10→50, Y 5→35, Z 0→20
  await page.evaluate(()=>{
    newSketch('XY');const sk=skEdit;const P=[[10,5],[50,5],[50,35],[10,35]].map(([x,y])=>addPoint(sk,x,y));
    for(let i=0;i<4;i++)sk.entities.push({id:'L'+i,t:'line',p1:P[i],p2:P[(i+1)%4]});
    closeSketch(true);
    addFeature({id:uid('ex'),type:'extrude',name:'Bloc',sketchId:sk.id,op:'add',distance:20});markDirty();rebuild();
  });
  await page.waitForFunction(()=>builtEngine==='exact'&&rebuildDepth===0&&builtVersion===_docVersion&&!!(occLive&&occLive.shape),null,{timeout:60000});
  await page.waitForTimeout(500);
  // point écran du milieu d'un petit plan du repère, et d'une face de normale donnée
  const planPt=id=>page.evaluate(id=>{
    const m=axHelper.userData.planes[id];axHelper.updateMatrixWorld(true);m.updateMatrixWorld(true);
    const L={XY:[.38,.38,0],XZ:[.38,0,.38],YZ:[0,.38,.38]}[id];
    const w=m.localToWorld(new THREE.Vector3(...L)).project(camera),r=renderer.domElement.getBoundingClientRect();
    return {x:r.left+(w.x*.5+.5)*r.width,y:r.top+(-w.y*.5+.5)*r.height};
  },id);
  const facePt=nv=>page.evaluate(nv=>{
    const r=renderer.domElement.getBoundingClientRect();
    for(let i=2;i<38;i++)for(let j=2;j<38;j++){
      const x=r.left+r.width*i/40,y=r.top+r.height*j/40,e={clientX:x,clientY:y};
      if(mesPlanAt(e))continue; // pas sous le repère
      const h=pick(e);if(!h||!h.face)continue;
      const n=h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if(n.x*nv[0]+n.y*nv[1]+n.z*nv[2]>0.99)return {x,y};
    }
    return null;
  },nv);
  const etat=()=>page.evaluate(()=>({plan:mesPlan&&mesPlan.plane,n:selFaces.length,vert:!!measureGroup,txt:faceEl.textContent,sel:sel.kind}));
  const haut=await facePt([0,0,1]);expect(haut).not.toBeNull();
  const pXY=await planPt('XY');
  await page.keyboard.down('Control');
  // plan puis face : dessus à 20 mm de XY
  await page.mouse.click(pXY.x,pXY.y);
  let s=await etat();
  expect(s.plan).toBe('XY');expect(s.vert).toBe(false);expect(s.sel).not.toBe('plane'); // la mesure ne sélectionne rien
  await page.mouse.click(haut.x,haut.y);
  s=await etat();
  expect(s.plan).toBe('XY');expect(s.n).toBe(1);expect(s.vert).toBe(true);
  expect(s.txt).toMatch(/Face parallèle au plan XY : 20\.00 mm/);
  // face puis plan : la face de normale +X (x=50) ou −X (x=10) est à 50 ou 10 mm de YZ
  await page.keyboard.up('Control');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>clearMeasure());
  const cote=(await facePt([1,0,0]))||(await facePt([-1,0,0]));expect(cote).not.toBeNull();
  await page.mouse.click(cote.x,cote.y);
  await page.keyboard.down('Control');
  const pYZ=await planPt('YZ');
  await page.mouse.click(pYZ.x,pYZ.y);
  s=await etat();
  expect(s.plan).toBe('YZ');expect(s.vert).toBe(true);
  expect(s.txt).toMatch(/Face parallèle au plan YZ : (50|10)\.00 mm/);
  // un autre plan remplace le premier : XY perpendiculaire à cette face → angle 90°
  await page.mouse.click(pXY.x,pXY.y);
  s=await etat();
  expect(s.plan).toBe('XY');expect(s.txt).toMatch(/angle=90\.00°/);
  await page.keyboard.up('Control');
  expect(err).toEqual([]);
});
