// Les formules restent dans les champs (V0.94.8) :
//   1. création d'une répétition : « nb+1 » et « pas_SM_chaud/50 » (paramètre local et paramètre dérivé)
//      restent affichés dans les champs après leur validation (avant : le résultat « 4,51 » les remplaçait),
//      la valeur est appliquée et la formule passe à la fonction créée ;
//   2. nouveau repère : la formule reste affichée même quand son résultat ne change pas la valeur (0 → 0) ;
//   3. fiche du repère validé : chaque décalage avec sa formule et son résultat ;
//   4. FAO (V0.95.0) : « Descente ap » d'une opération = « nb/2 » → valeur appliquée, formule gardée dans le
//      champ et dans le fichier, recalculée quand nb change ; la clé de cache n'embarque pas la formule ;
//   5. branchement universel parFxBind (mise en plan…) : formule gardée, valeur donnée au gestionnaire, suivie.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');

test('formules gardées dans les champs : répétition et repère',async({page})=>{
  test.setTimeout(300000);
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>{try{return occtReady===true;}catch(e){return false;}},null,{timeout:180000});
  await page.setInputFiles('#fileProj',path.join(__dirname,'..','..','Exemples','Axe.conceptcad'));
  await page.waitForFunction(()=>doc.name==='Axe'&&bodies.some(b=>b.shape)&&rebuildDepth===0,null,{timeout:180000});
  const r=await page.evaluate(async()=>{
    doc.derive=[{name:'Source.conceptcad',auto:false,params:[{src:'pas_SM_chaud',name:'pas_SM_chaud',value:225.5}]}];
    doc.params=[{name:'nb',expr:'3',value:3}];parApplyAll();
    const type=async(inp,txt)=>{inp.focus();inp.value=txt;inp.dispatchEvent(new Event('change',{bubbles:true}));inp.blur();await new Promise(r=>setTimeout(r,30));};
    const out={};
    enterRepMode();const hole=doc.features.find(f=>f.type==='hole'&&!f.repeatId);repMode.feats=[hole.id];renderRepPanel();
    const P=$('props'),cnt=P.querySelector('input[type=text]');await type(cnt,'nb+1');
    const dist=[...P.querySelectorAll('label')].find(l=>/Distance/.test(l.textContent)).querySelector('input');await type(dist,'pas_SM_chaud/50');
    out.champs=[cnt.value,dist.value];out.mode=[repMode.copies,repMode.dist];
    applyRepPattern();
    const rp=doc.features.find(f=>f.type==='repeat'&&f.expr);out.rp=rp&&rp.expr;
    cgStart('frame');cgRefAccept({k:'o',id:'XY'});
    const F=l=>[...document.querySelectorAll('*')].find(e=>e.textContent===l).parentElement.querySelector('input');
    await type(F('Décalage Y'),'nb-3');await type(F('Décalage X'),'pas_SM_chaud*2');
    out.cg=[F('Décalage X').value,F('Décalage Y').value];
    cgCommit();
    out.fiche=[...$('props').querySelectorAll('.cgParVal')].map(n=>n.textContent);
    return out;
  });
  expect(r.champs,'formules affichées dans les champs').toEqual(['nb+1','pas_SM_chaud/50']);
  expect(r.mode,'valeurs appliquées').toEqual([3,4.51]);
  expect(r.rp,'formules passées à la répétition').toEqual({qty:'nb+1',dist:'pas_SM_chaud/50'});
  expect(r.cg,'repère : formules affichées').toEqual(['pas_SM_chaud*2','nb-3']);
  expect(r.fiche[0]).toBe('Décalage X : pas_SM_chaud*2 → 451 mm');
  expect(r.fiche[1]).toBe('Décalage Y : nb-3 → 0 mm');
});

test('formules gardées : FAO, mise en plan, fichier',async({page})=>{
  test.setTimeout(300000);
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>{try{return occtReady===true;}catch(e){return false;}},null,{timeout:180000});
  await page.setInputFiles('#fileProj',path.join(__dirname,'..','..','Exemples','Poche et Contour.conceptcad'));
  await page.waitForFunction(()=>/Poche/.test(doc.name)&&bodies.some(b=>b.shape)&&rebuildDepth===0,null,{timeout:180000});
  const r=await page.evaluate(async()=>{
    doc.params=[{name:'nb',expr:'4',value:4}];parApplyAll();
    const type=async(inp,txt)=>{inp.focus();inp.value=txt;inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));inp.blur();await new Promise(r=>setTimeout(r,50));};
    const setup=faoRoot().setups[0],op=setup.ops.find(o=>o.type==='pocket');
    const out={};
    sel={kind:'faoOp',id:op.id,setup:setup.id};renderProps();
    const iap=[...$('props').querySelectorAll('input.fao-num')].find(i=>i._parFx&&/Descente/.test(i.title||'')&&parseFloat(i.value)===+op.ap)
      ||[...$('props').querySelectorAll('input.fao-num')].find(i=>i._parFx&&parseFloat(i.value)===+op.ap);
    out.trouve=!!iap;
    await type(iap,'nb/2');
    const iap2=[...$('props').querySelectorAll('input.fao-num')].find(i=>i.value==='nb/2');
    out.champ=iap2&&iap2.value;out.v1=op.ap;out.expr=op.expr;
    doc.params[0].expr='6';await parAfterChange();out.v2=op.ap;
    out.sigSansFormule=!/nb\/2/.test(JSON.stringify(faoOpSig(op)));
    const m={w:3};doc.mep=doc.mep||{cur:0,sheets:[]};doc.mep.sheets.push({id:'essai',x:m});
    const i=document.createElement('input');i.type='number';i.value='3';document.body.appendChild(i);let got=null;i.onchange=()=>{got=+i.value;m.w=got;};
    parFxBind(i,m,'w');i.focus();i.value='nb+1';i.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,20));
    out.mep={got,champ:i.value,expr:m.expr};doc.params[0].expr='10';await parAfterChange();out.mep.suivi=m.w;
    doc.mep.sheets.pop();i.remove();
    const J=JSON.parse(await mffData()),D=typeof J.doc==='string'?JSON.parse(J.doc):(J.doc||J);
    const o2=D.fao.setups[0].ops.find(o=>o.id===op.id);out.fichier=o2&&o2.expr;
    return out;
  });
  expect(r.trouve,'champ « Descente ap » lié').toBe(true);
  expect(r.champ,'formule gardée dans le champ FAO').toBe('nb/2');
  expect([r.v1,r.v2],'valeur appliquée puis recalculée').toEqual([2,3]);
  expect(r.expr).toEqual({ap:'nb/2'});
  expect(r.sigSansFormule,'clé de cache sans la formule').toBe(true);
  expect(r.mep,'branchement universel').toEqual({got:7,champ:'nb+1',expr:{w:'nb+1'},suivi:11});
  expect(r.fichier,'formule dans le fichier').toEqual({ap:'nb/2'});
});
