// Modification d'un paramètre sur une vraie pièce (Barquette), dans un VRAI navigateur : un
// bandeau « calcul en cours » est peint avant le recalcul, sans le ralentir ; le solide obtenu est
// celui du rejeu synchrone et un seul Ctrl+Z ramène la valeur d'origine.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');
const PIECE=path.join(__dirname,'..','fixtures','barquette-guides.conceptcad');

test('modifier un paramètre affiche un bandeau avant le recalcul',async({page})=>{
  test.setTimeout(300000);
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  await page.setInputFiles('#fileProj',PIECE);
  await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&!regenRun&&!regenUi,null,{timeout:120000});
  await page.waitForTimeout(2000);

  const r=await page.evaluate(async()=>{
    const att=ms=>new Promise(k=>setTimeout(k,ms));
    const P=doc.params.find(p=>p.name==='largeur_barquette');
    const v0=P.expr,pile0=docUndoStack.length;
    const signe=()=>bodies.filter(b=>b.kind==='body'&&b.shape).map(b=>b.id).join('|')+'#'+(doc.features||[]).filter(f=>f.failed||f.err).length;
    const out={v0,neuf:String(+v0+5)};
    // le bandeau doit exister lors d'une image réellement peinte, avant le recalcul
    let images=0,barre=false,vivant=true;
    const tick=()=>{if(!vivant)return;images++;if(document.getElementById('mfRegen'))barre=true;requestAnimationFrame(tick);};
    requestAnimationFrame(tick);
    const set=parSetParam(P,out.neuf);out.set=set;
    const t=performance.now();
    const pr=parAfterChange(true);
    out.promesse=!!(pr&&pr.then);
    await pr;
    out.ms=Math.round(performance.now()-t);
    vivant=false;
    out.images=images;out.barre=barre;out.apres=!!document.getElementById('mfRegen');out.voile=!!document.getElementById('mfRegenBlk');
    out.got=signe();
    // même document rejoué de façon synchrone : même résultat
    builtVersion=-1;builtHash=null;rebuild();out.ref=signe();
    // une seule étape d'annulation pour ce geste
    await att(600);
    out.pile=docUndoStack.length-pile0;
    await docUndo();
    await att(300);
    out.apresZ=doc.params.find(p=>p.name==='largeur_barquette').expr;
    // référence de temps : le même geste sans bandeau
    await att(600);
    parSetParam(doc.params.find(p=>p.name==='largeur_barquette'),String(+v0+10)); // valeur jamais vue : pas de points de contrôle tout prêts
    const t2=performance.now();parAfterChange();out.msRef=Math.round(performance.now()-t2);
    return out;
  });
  expect(err).toEqual([]);
  expect(r.set).toBe(true);
  expect(r.promesse).toBe(true);
  expect(r.barre).toBe(true);
  expect(r.ms).toBeLessThan(r.msRef*1.5+500);
  expect(r.apres).toBe(false);
  expect(r.voile).toBe(false);
  expect(r.got).toBe(r.ref);
  expect(r.pile).toBe(1);
  expect(r.apresZ).toBe(r.v0);
});
