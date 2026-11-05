// Fichier autonome : seul dans un dossier vide, ouvert depuis le disque (file://) et hors ligne, il
// démarre OCCT 8, recalcule Barquette, démarre le noyau de calcul annexe et le rendu par rayons.
'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('fs'),os=require('os'),path=require('path');
const {fabriquer}=require('../../tools/autonome.cjs');
const PIECE=path.join(__dirname,'..','fixtures','barquette-guides.conceptcad');

test('le fichier autonome fonctionne seul, sans réseau ni serveur',async({browser})=>{
  test.setTimeout(300000);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autonome-'));
  const f=path.join(dir,'ConceptCAD-autonome.html');
  fabriquer(f);
  const c=await browser.newContext({viewport:{width:1400,height:900},offline:true});
  const page=await c.newPage();
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  page.on('requestfailed',r=>err.push('échec : '+r.url().slice(0,120)));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  try{
    await page.goto('file:///'+f.split(path.sep).join('/'));
    await page.waitForFunction(()=>{try{return occtReady===true||/échec|indisponible/.test(occBaseMsg);}catch(e){return false;}},null,{timeout:120000});
    expect(await page.evaluate(()=>occtReady)).toBe(true);
    await page.setInputFiles('#fileProj',PIECE);
    await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&!regenRun&&!regenUi,null,{timeout:180000});
    await page.waitForTimeout(1500);
    const r=await page.evaluate(async()=>{
      const att=ms=>new Promise(k=>setTimeout(k,ms));
      const out={lib:!!(window.THREE&&THREE.OrbitControls&&window.CSG)};
      parSetParam(doc.params.find(p=>p.name==='largeur_barquette'),'170');
      await parAfterChange(true);
      out.corps=bodies.filter(b=>b.kind==='body'&&b.shape).length;
      const me=delWk||delWkStart(),a=performance.now();
      while(!me.ready&&delWk===me&&performance.now()-a<60000)await att(200);
      out.annexe=me.ready;
      try{await rtLoad();out.rendu=!!window.RDPT;}catch(e){out.rendu=e.message;}
      return out;
    });
    expect(r).toEqual({lib:true,corps:1,annexe:true,rendu:true});
    expect(err).toEqual([]);
  }finally{
    await c.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
