// Aimants permanents (V0.57.0), dans un VRAI navigateur : la commande du ruban ouvre l'onglet Aimants,
// un article s'insère et se dessine, un vrai clic droit sur la pièce affiche puis masque ses lignes de
// champ, les autres occurrences ne bougent pas.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');

test('aimants : insertion, clic droit, lignes de champ',async({page})=>{
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  expect(await page.evaluate(()=>APP_VER)).toMatch(/^V\d/);

  // la commande du ruban
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Bibliothèque d’aimants/.test(x.title||''));window.__magBtn=!!b;if(b)b.click();});
  expect(await page.evaluate(()=>window.__magBtn),'bouton Aimants dans le ruban').toBe(true);
  const dlg=page.locator('#stdDlg');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.stdTabs button.on')).toHaveText('Aimants');
  const dir=process.env.MAG_CAPTURES;
  if(dir)await page.screenshot({path:path.join(dir,'1-fenetre.png')});

  // un grand anneau, puis un pavé et un disque
  const pose=async(shape,pick)=>{
    await dlg.locator('select[data-k="shape"]').selectOption(shape);
    const v=await page.evaluate(([s,p])=>{const R=MAG_CAT.filter(r=>r.s===s&&r.mat==='NdFeB');return R[p==='last'?R.length-1:Math.floor(R.length*0.7)].code;},[shape,pick]);
    await dlg.locator('select[data-k="art"]').selectOption(v);
    await dlg.locator('.stdFoot button.primary').click();
    await page.waitForFunction(c=>asm&&asm.comps.some(q=>q.doc&&q.doc.std&&q.doc.std.desig===c&&q._snap&&q._snap.items.length),v,{timeout:120000});
    return v;
  };
  const codes=[await pose('ring','mid'),await pose('box','mid'),await pose('cyl','mid')];
  await dlg.locator('.stdHead button').click();
  await page.evaluate(()=>{asmDraw();asmFit();});
  await page.waitForTimeout(400);
  const coords=c=>page.evaluate(code=>{
    const o=asmRoot().occ.find(q=>asmComp(q.comp).doc.std.desig===code);
    const G=asmSceneGet().getObjectByName('asmOcc').children.find(g=>g.userData.occ===o.id);
    const box=new THREE.Box3().expandByObject(G.children.find(m=>m.isMesh)),p=box.getCenter(new THREE.Vector3());
    p.z=box.max.z;
    if(asmComp(o.comp).doc.std.mag.s==='ring')p.x+=(asmComp(o.comp).doc.std.mag.d+asmComp(o.comp).doc.std.mag.di)/4;
    camera.updateMatrixWorld();p.project(camera);
    const r=renderer.domElement.getBoundingClientRect();
    return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height,id:o.id};
  },c);

  // vrai clic droit sur chacun : menu, puis lignes affichées
  for(const code of codes){
    const P=await coords(code);
    await page.mouse.click(P.x,P.y,{button:'right'});
    const m=page.locator('#magCtxLines');
    await expect(m,'menu de l’aimant '+code).toBeVisible();
    await expect(m).toHaveText(/Afficher/);
    await m.click();
    await expect(page.locator('#magCtx')).toHaveCount(0);
    expect(await page.evaluate(id=>!!asmOcc(id).mag,P.id)).toBe(true);
  }
  const n=await page.evaluate(()=>{let k=0;asmSceneGet().getObjectByName('asmOcc').traverse(o=>{if(o.name==='magLines')k++;});return k;});
  expect(n,'un groupe de lignes par aimant').toBe(3);
  await page.waitForTimeout(400);
  if(dir)await page.screenshot({path:path.join(dir,'2-lignes.png')});

  // caractéristiques
  const P0=await coords(codes[0]);
  await page.mouse.click(P0.x,P0.y,{button:'right'});
  await page.locator('#magCtxInfo').click();
  await expect(page.locator('#magCtx')).toContainText('Rémanence Br');
  await expect(page.locator('#magCtx')).toContainText(codes[0]);
  if(dir)await page.screenshot({path:path.join(dir,'3-caracteristiques.png')});

  // second clic droit : masqué, les deux autres restent
  await page.locator('#magCtxLines').click();
  expect(await page.evaluate(id=>!!asmOcc(id).mag,P0.id)).toBe(false);
  const n2=await page.evaluate(()=>{let k=0;asmSceneGet().getObjectByName('asmOcc').traverse(o=>{if(o.name==='magLines')k++;});return k;});
  expect(n2).toBe(2);

  // Ctrl+Z réaffiche
  await page.evaluate(()=>{asmUndo();asmDraw();});
  expect(await page.evaluate(id=>!!asmOcc(id).mag,P0.id)).toBe(true);
  expect(err,'aucune erreur de page').toEqual([]);
});
