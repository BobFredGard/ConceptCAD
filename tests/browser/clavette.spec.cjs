// Rainure de clavette, dans un VRAI navigateur : bouton du ruban, vrai clic sur la face extérieure d'un arbre
// puis sur la face intérieure d'un alésage (c'est le clic qui distingue les deux), panneau, OK.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');

test('clavette : arbre et alésage reconnus au clic',async({page})=>{
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  const dir=process.env.KW_CAPTURES;

  // Pose la pièce et la caméra, renvoie l'écran du point visé
  const scene=(sks,fts,cam,tgt,P)=>page.evaluate(([sks,fts,cam,tgt,P])=>{
    doc.sketches=sks;doc.features=fts;doc.bodies=[];doc.cgeo=[];delete doc.activeBody;selFaces=[];sel={kind:null,id:null};
    markDirty();rebuild();renderTree();renderProps();
    camera.position.set(cam[0],cam[1],cam[2]);controls.target.set(tgt[0],tgt[1],tgt[2]);camera.lookAt(controls.target);controls.update();camera.updateMatrixWorld(true);
    const v=new THREE.Vector3(P[0],P[1],P[2]).project(camera),r=renderer.domElement.getBoundingClientRect();
    return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};
  },[sks,fts,cam,tgt,P]);
  const rond=(id,r,org)=>({id:'sk'+id,name:id,plane:'YZ',origin:org||[0,0,0],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],points:{c:{x:0,y:0}},
    entities:[{id:'e1',t:'circle',pc:'c',r}],constraints:[],dims:[],seq:10,visible:false});
  const plein=(s,d,op)=>({id:'F'+s,type:'extrude',name:s,sketchId:'sk'+s,distance:d,op:op||'add',visible:true});
  const inside=q=>page.evaluate(q=>{const cl=occClassifier(occLive.shape),p=new occt.gp_Pnt_3(q[0],q[1],q[2]);cl.Perform(p,1e-6);
    const r=cl.State()===occt.TopAbs_State.TopAbs_IN;p.delete();cl.delete();return r;},q);
  const etat=()=>page.evaluate(()=>{const f=doc.features.find(x=>x.kw),el=doc.cgeo.find(c=>c.kw);return f&&el?{name:f.name,err:f._err||'',bore:el.kw.bore,form:el.kw.form,O:el._kwOut,sel:sel.id===f.id}:null;});
  const bouton=page.getByRole('button',{name:/Clavette/}).first();
  await expect(bouton).toBeVisible();
  expect(await bouton.locator('svg').count(),'icône du ruban, pas le nom interne').toBeGreaterThan(0);

  // ── Arbre Ø30 : clic au sommet ──
  let E=await scene([rond('A',15)],[plein('A',80)],[120,-110,90],[40,0,0],[40,0,15]);
  await bouton.click();
  expect(await page.evaluate(()=>holeFacePick&&holeFacePick.which)).toBe('cylKw');
  await page.mouse.click(E.x,E.y);
  await page.waitForFunction(()=>doc.features.some(f=>f.kw)&&rebuildDepth===0);
  let S=await etat();
  expect(S.bore,'face extérieure = arbre').toBe(false);
  expect([S.form,S.O.b,S.O.t,S.err,S.sel]).toEqual(['A',8,4,'',true]);
  // la clavette, corps séparé, occupe la rainure : fond 11, sommet 18
  expect(await page.evaluate(()=>doc.bodies.length)).toBe(2);
  expect(await inside([40,0,17.5])).toBe(true);
  expect(await inside([40,0,18.5])).toBe(false);
  const panneau=page.locator('text=ISO 773 : clavette 8 × 7');
  await expect(panneau.first()).toBeVisible();
  // vraie saisie : hauteur non standard, le reste ne bouge pas
  const hauteur=page.locator('.pnl-row',{hasText:'Hauteur (mm)'}).locator('input');
  await hauteur.fill('10');
  await hauteur.press('Enter');
  await page.waitForFunction(()=>doc.cgeo.find(c=>c.kw)._kwOut.h===10&&rebuildDepth===0);
  expect(await inside([40,0,20.5])).toBe(true);
  expect(await inside([40,0,21.5])).toBe(false);
  await expect(page.locator('text=cotes modifiées').first()).toBeVisible();
  if(dir)await page.screenshot({path:path.join(dir,'arbre.png')});
  await page.locator('button.fdynOk').click();
  expect(await page.evaluate(()=>sel.id)).toBeFalsy();

  // ── Moyeu Ø80 percé Ø30 : clic sur la paroi intérieure, vue par l'ouverture ──
  E=await scene([rond('H',40),rond('B',15,[-1,0,0])],[plein('H',40),plein('B',42,'cut')],[-130,0,42],[20,0,0],[20,0,-15]);
  await bouton.click();
  await page.mouse.click(E.x,E.y);
  await page.waitForFunction(()=>doc.features.some(f=>f.kw)&&rebuildDepth===0);
  S=await etat();
  expect(S.bore,'face intérieure = alésage').toBe(true);
  expect([S.form,S.O.b,S.O.t,S.err]).toEqual(['T',8,3.3,'']);
  // fond à 18,3, clavette jusqu'à 11,3 vers l'axe
  expect(await inside([20,0,-12])).toBe(true);
  expect(await inside([20,0,-11])).toBe(false);
  expect(await inside([20,0,-18])).toBe(true);
  if(dir)await page.screenshot({path:path.join(dir,'alesage.png')});
  await page.locator('button.fdynOk').click();

  // ── Échap : la commande se retire sans rien créer ──
  await bouton.click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>holeFacePick)).toBeFalsy();
  expect(err).toEqual([]);
});
