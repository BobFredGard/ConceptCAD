// V0.99.55 : planche fluide. Traits des vues regroupés et gardés, survol d'une vue sans tout redessiner,
// panoramique et zoom par la carte graphique. Comparé à ?sanstraitsgroupes&sansgeste (comme V0.99.54) :
// même export DXF, même cadrage après les mêmes gestes, beaucoup moins d'éléments recréés.
//   MF_MEP_FICHIER=D:/x.conceptcad   un autre fichier
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');
const RACINE=path.join(__dirname,'..','..');
const FICHIER=process.env.MF_MEP_FICHIER||path.join(RACINE,'Exemples','Cavité Usinage.conceptcad');

async function gestes(browser,q){
  const c=await browser.newContext({viewport:{width:1400,height:900}});
  const page=await c.newPage();
  const err=[];
  page.on('pageerror',e=>err.push(e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  try{
    await page.goto('/ConceptCAD.html'+q);
    await page.waitForFunction(()=>typeof occtReady!=='undefined'&&occtReady===true,null,{timeout:200000});
    await page.setInputFiles('#fileProj',FICHIER);
    await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&builtEngine==='exact'&&bodies.some(b=>b.shape),null,{timeout:600000});
    await page.waitForTimeout(2500);
    await page.evaluate(async()=>{
      document.querySelector('[data-mfws="plan"]').click();
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      await sleep(300);
      while(window.mepHlrInfo().enCours||(document.getElementById('mepBusy')&&document.getElementById('mepBusy').classList.contains('on')))await sleep(20);
      await sleep(500);
    });
    const o=await page.evaluate(()=>{
      const svg=document.querySelector('#mepSvg');
      window.__ajouts=0;
      new MutationObserver(l=>l.forEach(m=>window.__ajouts+=m.addedNodes.length)).observe(svg,{childList:true,subtree:true});
      return {elements:svg.querySelectorAll('*').length,traits:svg.querySelectorAll('.mepEnt').length,dxf:mepDxfBuild()};
    });
    const r=await page.evaluate(()=>{const b=document.querySelector('#mepSheet').getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};});
    const cx=r.x+r.w/2,cy=r.y+r.h/2;
    // survol : la souris traverse la planche (vues survolées l'une après l'autre)
    await page.mouse.move(r.x+30,cy);
    await page.evaluate(()=>{window.__ajouts=0;});
    for(let i=0;i<40;i++){await page.mouse.move(r.x+30+i*(r.w-60)/40,cy+Math.sin(i/4)*80);await page.waitForTimeout(10);}
    o.survol=await page.evaluate(()=>window.__ajouts);
    // molette : pendant le geste, viewBox inchangé et image déplacée ; à la fin, planche redessinée
    await page.mouse.move(cx,cy);
    const vb0=await page.evaluate(()=>{window.__mepGesteMs=4000;return document.querySelector('#mepSvg').getAttribute('viewBox');}); // navigateur de test lent : geste tenu
    for(let i=0;i<6;i++){await page.mouse.move(cx+i*15,cy-i*8);await page.mouse.wheel(0,-100);await page.waitForTimeout(20);}
    o.pendant=await page.evaluate(()=>{const s=document.querySelector('#mepSvg');return {vb:s.getAttribute('viewBox'),tr:s.style.transform};});
    o.vb0=vb0;
    await page.waitForTimeout(4500);
    await page.evaluate(()=>{window.__mepGesteMs=0;});
    for(let i=0;i<4;i++){await page.mouse.move(cx-i*20,cy+i*10);await page.mouse.wheel(0,100);await page.waitForTimeout(20);}
    await page.waitForTimeout(600);
    o.vbMolette=await page.evaluate(()=>document.querySelector('#mepSvg').getAttribute('viewBox'));
    // panoramique (bouton du milieu)
    await page.mouse.move(cx,cy);await page.mouse.down({button:'middle'});
    for(let i=1;i<=20;i++){await page.mouse.move(cx+i*7,cy+i*4);await page.waitForTimeout(10);}
    await page.mouse.up({button:'middle'});
    await page.waitForTimeout(300);
    o.fin=await page.evaluate(()=>{const s=document.querySelector('#mepSvg');return {vb:s.getAttribute('viewBox'),tr:s.style.transform};});
    o.err=err;
    return o;
  }finally{await c.close();}
}

test('plan : traits regroupés, survol léger, pan et zoom par la carte graphique — mêmes résultats',async({browser})=>{
  test.setTimeout(1800000);
  const avant=await gestes(browser,'?sanstraitsgroupes&sansgeste');
  const apres=await gestes(browser,'');
  console.log(path.basename(FICHIER)+' : éléments '+avant.elements+' → '+apres.elements+' (traits '+avant.traits+' → '+apres.traits+
    '), ajoutés au survol '+avant.survol+' → '+apres.survol+', cadrage '+apres.fin.vb);
  expect(avant.err).toEqual([]);
  expect(apres.err).toEqual([]);
  expect(apres.dxf).toEqual(avant.dxf);                 // export DXF identique
  expect(apres.elements).toBeLessThan(avant.elements);
  // même cadrage après la molette et après le panoramique (au centième de mm : l'ancien chemin
  // arrondissait le viewBox au millième à chaque cran)
  const proche=(a,b)=>{const A=a.split(' ').map(Number),B=b.split(' ').map(Number);return A.length===4&&A.every((x,i)=>Math.abs(x-B[i])<0.01);};
  expect(proche(apres.vbMolette,avant.vbMolette)).toBe(true);
  expect(proche(apres.fin.vb,avant.fin.vb)).toBe(true);
  expect(apres.fin.tr).toBe('');                        // geste fini : plus de transformation
  expect(apres.pendant.vb).toBe(apres.vb0);             // pendant le geste : image déplacée, pas redessinée
  expect(apres.pendant.tr).toMatch(/^matrix\(/);
  expect(avant.pendant.vb).not.toBe(avant.vb0);
  expect(apres.survol).toBeLessThan(avant.survol);
});
