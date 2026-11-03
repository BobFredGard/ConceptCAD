// Fichier .conceptcad compressé (V0.46.0), dans un VRAI navigateur (gzip natif, vrai fichier) :
//   1. un ancien fichier en clair (Exemples/Axe.conceptcad) s'ouvre toujours ;
//   2. l'enregistrement sûr (mffWriteSafe) écrit du gzip, plus petit, relu à l'identique,
//      marqué « ConceptCAD » ; un contenu vide est refusé et le fichier reste intact ;
//   3. le fichier compressé se rouvre par le sélecteur de fichier (même chemin que l'insertion).
'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib');

const RACINE=path.join(__dirname,'..','..');
const AXE=path.join(RACINE,'Exemples','Axe.conceptcad');

test('fichier .conceptcad : gzip à l’écriture, clair ou gzip à la lecture, jamais vide',async({page})=>{
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  await page.setInputFiles('#fileProj',AXE);
  await page.waitForFunction(()=>doc&&doc.name==='Axe'&&bodies.some(b=>b.shape),null,{timeout:120000});

  const r=await page.evaluate(async()=>{
    const dir=await navigator.storage.getDirectory();
    const h=await dir.getFileHandle('Axe.conceptcad',{create:true});
    const data=await mffData();
    await mffWriteSafe(h,data,{noBak:true});
    const f=await h.getFile(),u8=new Uint8Array(await f.arrayBuffer());
    const back=await mffFileText(f);
    let vide='';try{await mffWriteSafe(h,'',{noBak:true});}catch(e){vide=e.message;}
    const apres=await mffFileText(await h.getFile());
    let b64='';for(let i=0;i<u8.length;i+=0x8000)b64+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));
    return {gz:u8[0]===0x1f&&u8[1]===0x8b,taille:u8.length,clair:new Blob([data]).size,same:back===data,
      app:JSON.parse(back).app,vide,intact:apres===data,b64:btoa(b64)};
  });
  expect(r.gz,'écrit en gzip').toBe(true);
  expect(r.taille,'plus petit que le texte').toBeLessThan(r.clair/2);
  expect(r.same,'relu à l’identique').toBe(true);
  expect(r.app).toBe('ConceptCAD');
  expect(r.vide,'contenu vide refusé').toMatch(/annulé/);
  expect(r.intact,'fichier intact après le refus').toBe(true);

  // le même fichier, compressé, rouvert par le sélecteur ; Node le relit aussi (gunzip)
  const tmp=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'cc-gz-')),'Axe gz.conceptcad');
  fs.writeFileSync(tmp,Buffer.from(r.b64,'base64'));
  expect(JSON.parse(zlib.gunzipSync(fs.readFileSync(tmp)).toString('utf8')).name).toBe('Axe');
  await page.evaluate(()=>{doc.name='autre';mffPendingOpen=true;});
  await page.setInputFiles('#fileProj',tmp);
  await page.waitForFunction(()=>doc&&doc.name==='Axe gz'&&bodies.some(b=>b.shape),null,{timeout:120000});
  expect(err,'aucune erreur').toEqual([]);
});
