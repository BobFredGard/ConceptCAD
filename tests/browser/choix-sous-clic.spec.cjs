// Clic long = liste de tout ce qui est sous le clic (90-15-choix-sous-clic), comme Fusion :
// esquisse (ligne posée sur un cercle) et 3D (face cachée derrière une autre).
'use strict';
const {test,expect}=require('@playwright/test');

async function demarrer(page){
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&occtReady===true,null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  return err;
}
const appuiLong=async(page,x,y)=>{await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(800);await page.mouse.up();};
const lignes=page=>page.locator('#mfChoixSous .mfcL');

test('esquisse : ligne tangente à un cercle, appui long → liste, flèche + Entrée choisit le cercle',async({page})=>{
  const err=await demarrer(page);
  const ids=await page.evaluate(()=>{
    newSketch('XY');const sk=skEdit;
    const c=addPoint(sk,0,0),a=addPoint(sk,-20,10),b=addPoint(sk,20,10);
    sk.entities.push({id:'C1',t:'circle',pc:c,r:10},{id:'L1',t:'line',p1:a,p2:b});
    skView.cx=0;skView.cy=5;skView.s=8;skUpdateTols();drawSketch2D();skTool='select';
    return {c:'C1',l:'L1'};
  });
  const pt=await page.evaluate(()=>{const r=svg.getBoundingClientRect(),[x,y]=w2s(0,10);return {x:r.left+x,y:r.top+y};});
  await appuiLong(page,pt.x,pt.y);
  await expect(page.locator('#mfChoixSous')).toBeVisible();
  const txt=await lignes(page).allTextContents();
  expect(txt.length).toBeGreaterThanOrEqual(2);
  expect(txt.some(t=>/Ligne/.test(t))).toBe(true);
  expect(txt.some(t=>/Cercle/.test(t))).toBe(true);
  // la 1re ligne est allumée d'office ; la flèche passe à la suivante et la sélectionne en aperçu
  const iC=txt.findIndex(t=>/Cercle/.test(t));
  for(let k=0;k<iC;k++)await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(()=>skSel&&skSel.id)).toBe(ids.c);
  await page.keyboard.press('Enter');
  await expect(page.locator('#mfChoixSous')).toHaveCount(0);
  expect(await page.evaluate(()=>({sel:skSel,x:skSelX.length,sk:!!skEdit}))).toEqual({sel:{kind:'ent',id:ids.c},x:0,sk:true});
  // la ligne choisie par un clic sur sa ligne dans la liste
  await appuiLong(page,pt.x,pt.y);
  await lignes(page).filter({hasText:'Ligne'}).first().click();
  expect(await page.evaluate(()=>skSel)).toEqual({kind:'ent',id:ids.l});
  // Échap : rien ne change, l'esquisse reste ouverte
  await appuiLong(page,pt.x,pt.y);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mfChoixSous')).toHaveCount(0);
  expect(await page.evaluate(()=>!!skEdit)).toBe(true);
  // clic court : pas de liste
  await page.mouse.click(pt.x,pt.y);await page.waitForTimeout(700);
  await expect(page.locator('#mfChoixSous')).toHaveCount(0);
  expect(err).toEqual([]);
});

test('3D : appui long sur un bloc → la face de derrière peut être choisie',async({page})=>{
  const err=await demarrer(page);
  await page.evaluate(()=>{
    newSketch('XY');const sk=skEdit;const P=[[0,0],[40,0],[40,30],[0,30]].map(([x,y])=>addPoint(sk,x,y));
    for(let i=0;i<4;i++)sk.entities.push({id:'L'+i,t:'line',p1:P[i],p2:P[(i+1)%4]});
    closeSketch(true);
    addFeature({id:uid('ex'),type:'extrude',name:'Bloc',sketchId:sk.id,op:'add',distance:20});markDirty();rebuild();
  });
  await page.waitForFunction(()=>builtEngine==='exact'&&rebuildDepth===0&&builtVersion===_docVersion&&!!(occLive&&occLive.shape),null,{timeout:60000});
  await page.waitForTimeout(500);
  const pt=await page.evaluate(()=>{
    const r=renderer.domElement.getBoundingClientRect(),v=new THREE.Vector3(20,15,10).project(camera);
    return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};
  });
  const avant=await page.evaluate(([x,y])=>{const h=pick({clientX:x,clientY:y});return h?h.faceIndex:null;},[pt.x,pt.y]);
  expect(avant).not.toBeNull();
  await appuiLong(page,pt.x,pt.y);
  await expect(page.locator('#mfChoixSous')).toBeVisible();
  const txt=await lignes(page).allTextContents();
  expect(txt.length).toBeGreaterThanOrEqual(2);
  expect(txt.every(t=>/Face/.test(t))).toBe(true);
  expect(/derrière/.test(txt[1])).toBe(true);
  // le relâcher de l'appui long n'a rien sélectionné
  expect(await page.evaluate(()=>selFaces.length)).toBe(0);
  await lignes(page).nth(1).click();
  const apres=await page.evaluate(()=>({n:selFaces.length,fi:selFaces[0]&&selFaces[0].faceIndex,force:mfPickForce}));
  expect(apres.n).toBe(1);
  expect(apres.force).toBeNull();
  const grp=await page.evaluate(([a,b])=>{const m=bodies[0].mesh,G=m.geometry.userData.occGroups||[],g=i=>{const x=G.find(g=>i>=g.start&&i<g.start+g.count);return x?x.f:i;};return [g(a),g(b)];},[avant,apres.fi]);
  expect(grp[0]).not.toBe(grp[1]);
  expect(err).toEqual([]);
});

// V0.99.81 : outil Projeter dans une pièce d'assemblage — un capot posé sur un socle, mêmes contours.
// Le clic court prend l'arête du capot (projetée au relâcher) ; l'appui long liste aussi celles du socle.
test('Projeter : appui long → arêtes de la pièce ET des autres pièces de l’assemblage',async({page})=>{
  const err=await demarrer(page);
  await page.evaluate(async()=>{
    const attendre=async()=>{for(let i=0;i<600;i++){await new Promise(r=>setTimeout(r,200));if(builtEngine==='exact'&&rebuildDepth===0&&builtVersion===_docVersion)return;}};
    docResetEmpty();doc.name='Banc';asmEnsure();
    const Rt=asmRoot(),A=asmNewComp('Socle').comp,oA=Rt.occ[0],B=asmNewComp('Capot').comp,oB=Rt.occ[1];
    oA.fr={o:[0,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};oB.fr={o:[0,0,20],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
    const bloc=h=>{newSketch('XY');const sk=skEdit;const P=[[0,0],[40,0],[40,30],[0,30]].map(([x,y])=>addPoint(sk,x,y));
      for(let i=0;i<4;i++)sk.entities.push({id:'L'+i,t:'line',p1:P[i],p2:P[(i+1)%4]});sk.visible=false;closeSketch(true);
      addFeature({id:uid('ex'),type:'extrude',name:'Bloc',sketchId:sk.id,op:'add',distance:h});markDirty();rebuild();};
    asmActivatePath([oA.id]);bloc(20);await attendre();
    asmActivatePath([oB.id]);bloc(10);await attendre();
    window.__oA=oA.id;
    newSketch('XY');skView.cx=20;skView.cy=15;skView.s=8;skUpdateTols();skTool='project';drawSketch2D();
  });
  const pt=await page.evaluate(()=>{const r=svg.getBoundingClientRect(),[x,y]=w2s(20,0);return {x:r.left+x,y:r.top+y};});
  const projetees=()=>page.evaluate(()=>skEdit.entities.filter(e=>e.proj).map(e=>e.ext?'socle':'capot'));
  // clic court : rien à l'appui, l'arête du capot au relâcher, pas de liste
  await page.mouse.click(pt.x,pt.y);await page.waitForTimeout(700);
  await expect(page.locator('#mfChoixSous')).toHaveCount(0);
  expect(await projetees()).toEqual(['capot']);
  // appui long : la liste montre les arêtes du capot et du socle
  await appuiLong(page,pt.x,pt.y);
  await expect(page.locator('#mfChoixSous')).toBeVisible();
  await expect(page.locator('#mfChoixSous .mfcT')).toContainText('d’autres pièces');
  const txt=await lignes(page).allTextContents();
  expect(txt.length).toBe(4);
  expect(txt.filter(t=>/cette pièce « Capot »/.test(t)).length).toBe(2);
  expect(txt.filter(t=>/pièce « Socle:1 »/.test(t)).length).toBe(2);
  expect(await projetees()).toEqual(['capot']); // le relâcher de l'appui long n'a rien projeté
  // survol puis clic sur l'arête du socle dans le plan
  const i=txt.findIndex(t=>/Socle:1 » · dans le plan/.test(t));
  await lignes(page).nth(i).hover();
  expect(await page.evaluate(()=>!!(skProjectHover&&skProjectHover.ext))).toBe(true);
  await lignes(page).nth(i).click();
  await expect(page.locator('#mfChoixSous')).toHaveCount(0);
  expect(await projetees()).toEqual(['capot','socle']);
  expect(await page.evaluate(()=>skEdit.entities.find(e=>e.ext).ext.path.join()===window.__oA)).toBe(true);
  expect(err).toEqual([]);
});
