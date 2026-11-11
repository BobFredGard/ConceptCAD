// Application installable (V0.93.0) dans un vrai navigateur : fiche d'installation lisible, service worker
// (?sw, comme sur le site), réserve hors ligne remplie, puis réseau coupé : la page se rouvre, le noyau
// exact démarre et une pièce d'exemple déjà vue s'ouvre et se reconstruit.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');
const RACINE=path.join(__dirname,'..','..');

test('démarrage sans réseau après une première visite',async({browser})=>{
  test.setTimeout(600000);
  const c=await browser.newContext({viewport:{width:1400,height:900},serviceWorkers:'allow'});
  const page=await c.newPage();
  const err=[],logs=[];
  page.on('pageerror',e=>err.push(e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  page.on('console',m=>logs.push(m.text()));
  const pret=async()=>{
    await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:240000});
    expect(await page.evaluate(()=>occtReady)).toBe(true);
  };
  try{
    // fiche d'installation
    await page.goto('/ConceptCAD.html?sw');
    const fiche=await page.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]');const r=await fetch(l.href);return {ok:r.ok,j:await r.json()};});
    expect(fiche.ok).toBe(true);
    expect(fiche.j.name).toBe('ConceptCAD');
    expect(fiche.j.display).toBe('standalone');
    for(const ic of fiche.j.icons){const ok=await page.evaluate(async s=>(await fetch(s)).ok,ic.src);expect(ok,ic.src).toBe(true);}
    // première visite : le service worker s'installe ; la page suivante passe par lui
    await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()),null,{timeout:30000});
    await page.reload();
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});
    await pret();
    expect(await page.evaluate(()=>APP_VER)).toBeTruthy();
    // une pièce d'exemple vue en ligne
    await page.setInputFiles('#fileProj',path.join(RACINE,'Exemples','Perçages.conceptcad'));
    await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&builtEngine==='exact',null,{timeout:240000});
    // la réserve se remplit après le démarrage du noyau
    await page.waitForFunction(()=>pwaHorsLigne&&pwaHorsLigne.manquants.length===0,null,{timeout:120000});
    // un fichier lu sur le site pendant la visite (ici l'exemple) est gardé lui aussi
    expect(await page.evaluate(async()=>(await fetch('Exemples/Per%C3%A7ages.conceptcad')).ok)).toBe(true);
    const ex=await page.evaluate(async()=>{const c=await caches.open('conceptcad-hors-ligne');return (await c.keys()).map(r=>r.url);});
    expect(ex.some(u=>/conceptcad_v3\.wasm$/.test(u))).toBe(true);
    // réseau coupé : on rouvre
    await c.setOffline(true);
    await page.reload();
    await pret();
    expect(await page.evaluate(()=>navigator.onLine)).toBe(false);
    expect(await page.evaluate(()=>document.querySelector('link[rel=manifest]')!==null)).toBe(true);
    // le service worker répond aussi pour les fichiers déjà lus (ici, l'exemple)
    const lu=await page.evaluate(async()=>{const r=await fetch('Exemples/Per%C3%A7ages.conceptcad');return r.ok;});
    expect(lu).toBe(true);
    expect(err).toEqual([]);
  }finally{
    await c.setOffline(false).catch(()=>{});
    await c.close();
  }
});
