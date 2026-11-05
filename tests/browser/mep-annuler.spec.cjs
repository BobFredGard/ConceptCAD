// Annulation après un passage en Plan, dans un VRAI navigateur et sur une vraie pièce cotée
// (Exemples/Support Pédale) : modifier la pièce, entrer en Plan (les cotes se recalent) puis faire
// UN Ctrl+Z ramène la pièce et ses vues ; le recalage seul ne crée pas d'étape ; un geste de plan
// reste annulable.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');
const PIECE=path.join(__dirname,'..','..','Exemples','Support Pédale Déportée R1200RT 2011.conceptcad');

test('un seul Ctrl+Z après une modification de pièce et un passage en Plan',async({page})=>{
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  await page.setInputFiles('#fileProj',PIECE);
  await page.waitForFunction(()=>doc.features.length>0&&doc.mep&&rebuildDepth===0,null,{timeout:120000});
  await page.waitForTimeout(2000); // rejeu exact et relevé différé du chargement

  // positions et réglages des vues et des cotes, sans les index internes de traits (renumérotés au rejeu)
  await page.evaluate(()=>{
    window.__plan=()=>JSON.stringify(doc.mep,(k,v)=>k==='hint'?undefined:(typeof v==='number'?+v.toFixed(5):v));
  });
  // entrée de référence dans le Plan : calcule les vues de la pièce d'origine
  await page.evaluate(()=>mfWs('plan'));
  await page.waitForTimeout(4000);
  await page.evaluate(()=>{window.__planA=window.__plan();mfWs('cao');});
  await page.waitForTimeout(500);

  const A=await page.evaluate(()=>{
    docCheckpoint();
    const f=doc.features.find(x=>x.type==='extrude'&&x.distance);
    window.__fid=f.id;
    const avant={d:f.distance,n:docUndoStack.length};
    docPushUndo('distance');f.distance+=3;markDirty();rebuild();
    return avant;
  });
  await page.waitForFunction(()=>rebuildDepth===0,null,{timeout:120000});
  await page.waitForTimeout(800);
  await page.evaluate(()=>docCheckpoint());

  await page.evaluate(()=>mfWs('plan'));
  await page.waitForTimeout(4000); // planche recalculée + relevé différé du filet

  const B=await page.evaluate(()=>{
    docCheckpoint();
    return{n:docUndoStack.length,plan:window.__plan()};
  });
  expect(B.plan,'les cotes ont suivi la pièce modifiée').not.toBe(await page.evaluate(()=>window.__planA));
  expect(B.n,'entrer en Plan n’ajoute aucune étape').toBe(A.n+1);

  await page.keyboard.press('Control+z');
  await page.waitForFunction(()=>rebuildDepth===0,null,{timeout:120000});
  await page.waitForTimeout(1500);
  const C=await page.evaluate(()=>{
    docCheckpoint();
    return{d:doc.features.find(f=>f.id===window.__fid).distance,n:docUndoStack.length,plan:window.__plan(),planA:window.__planA};
  });
  expect(C.d,'un seul Ctrl+Z ramène la pièce').toBe(A.d);
  expect(C.n,'et ne laisse aucune étape parasite').toBe(A.n);
  expect(C.plan,'et ramène les vues et les cotes à l’identique').toBe(C.planA);

  // un vrai geste de plan reste annulable (ajout d'une vue par la commande du ruban)
  const D=await page.evaluate(()=>{
    const sh=doc.mep.sheets[doc.mep.cur],nv=sh.views.length,nu=docUndoStack.length;
    mepAddViewStd('iso');docCheckpoint();
    return{nv,nu,apres:sh.views.length,pile:docUndoStack.length};
  });
  expect(D.apres).toBe(D.nv+1);
  expect(D.pile).toBe(D.nu+1);
  await page.keyboard.press('Control+z');
  await page.waitForFunction(()=>rebuildDepth===0,null,{timeout:120000});
  await page.waitForTimeout(800);
  expect(await page.evaluate(()=>doc.mep.sheets[doc.mep.cur].views.length),'Ctrl+Z retire la vue ajoutée').toBe(D.nv);
  expect(err).toEqual([]);
});
