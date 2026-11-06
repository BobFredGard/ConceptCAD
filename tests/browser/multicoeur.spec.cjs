// « Tout régénérer » sur plusieurs cœurs, dans un vrai navigateur : mêmes parcours qu'avec ?mono
// (calcul historique sur un seul cœur), au nombre près, sur les vrais maillages de la page.
//   MF_MC_FICHIERS="Cavité Usinage,Malaxeur Retard" pour d'autres exemples (mesure de gain).
'use strict';
const {test,expect}=require('@playwright/test');
const crypto=require('crypto'),path=require('path');
const RACINE=path.join(__dirname,'..','..');
const FICHIERS=(process.env.MF_MC_FICHIERS||'Perçages').split(',').map(s=>s.trim()).filter(Boolean);

async function regenerer(browser,nom,url,secours){
  const c=await browser.newContext({viewport:{width:1400,height:900}});
  const page=await c.newPage();
  const err=[],avis=[];
  page.on('pageerror',e=>err.push(e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  page.on('console',m=>{if(/multicœur/.test(m.text()))avis.push(m.text());});
  try{
    await page.goto(url);
    await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
    expect(await page.evaluate(()=>occtReady)).toBe(true);
    await page.setInputFiles('#fileProj',path.join(RACINE,'Exemples',nom+'.conceptcad'));
    await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&builtEngine==='exact'&&bodies.some(b=>b.shape||b.kind==='import')&&faoSolidSettled(),null,{timeout:300000});
    await page.waitForTimeout(1500);
    const r=await page.evaluate(async(secours)=>{
      // Préparation commune hors chrono : maillages déjà faits, comme après un premier calcul
      const job=faoDoc();
      const ops=(job.ops||[]).filter(o=>o&&o.on!==false);
      try{faoWkCorps(ops.filter(o=>faoWkAccepte(o,job)),job);}catch(e){}
      if(secours)window.Worker=function(){throw new Error('worker refusé');}; // navigateur qui refuse les workers
      // Réactivité : plus long moment sans que la page ait pu répondre
      let dernier=performance.now(),gel=0,actif=true;
      const veille=()=>{if(!actif)return;const t=performance.now();if(t-dernier>gel)gel=t-dernier;dernier=t;setTimeout(veille,10);};
      veille();
      const t0=performance.now();
      await faoPreviewGenerateAsync();
      const ms=performance.now()-t0;
      actif=false;
      const parcours=ops.map(o=>{const h=faoOpMovesHit(o);return {id:o.id,type:o.type,long:faoMeshOp(o),n:h&&h.mv?h.mv.length:-1,mv:h&&h.mv?JSON.stringify(h.mv):''};});
      return {ms,gel,ver:APP_VER,parcours,nCoeurs:faoWkNbCoeurs(),trace:!!faoPrevGroup&&faoPrevGroup.children.length>0};
    },!!secours);
    r.parcours.forEach(p=>{p.empreinte=crypto.createHash('sha1').update(p.mv).digest('hex');delete p.mv;});
    return {...r,err,avis};
  }finally{await c.close();}
}

for(const nom of FICHIERS){
  test('parcours identiques : '+nom,async({browser})=>{
    test.setTimeout(900000);
    const mono=await regenerer(browser,nom,'/ConceptCAD.html?mono');
    const multi=await regenerer(browser,nom,'/ConceptCAD.html');
    const s=ms=>(ms/1000).toFixed(1)+' s';
    console.log(nom+' ('+multi.ver+', '+multi.nCoeurs+' cœurs) : un cœur '+s(mono.ms)+' (écran figé '+s(mono.gel)+'), plusieurs cœurs '+s(multi.ms)+' (écran figé '+s(multi.gel)+')');
    multi.parcours.forEach(p=>console.log('  '+p.type+' '+p.id+' : '+p.n+' mouvements'));
    if(multi.avis.length)console.log('  avis : '+multi.avis.join(' | '));
    expect(multi.err).toEqual([]);
    expect(mono.err).toEqual([]);
    expect(multi.avis).toEqual([]); // aucune opération longue n'est retombée sur le calcul normal
    expect(multi.trace).toBe(mono.trace);
    expect(multi.parcours.map(p=>[p.id,p.n,p.empreinte])).toEqual(mono.parcours.map(p=>[p.id,p.n,p.empreinte]));
  });
}

test('bouton Régénérer du ruban : calcul réparti, parcours dessinés, page utilisable pendant le calcul',async({page})=>{
  test.setTimeout(600000);
  const err=[],avis=[];
  page.on('pageerror',e=>err.push(e.message));
  page.on('console',m=>{if(/multicœur/.test(m.text()))avis.push(m.text());});
  await page.addInitScript(()=>{const N=window.Worker;window.__nbW=0;window.Worker=function(u){window.__nbW++;return new N(u);};});
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&occtReady===true,null,{timeout:200000});
  await page.setInputFiles('#fileProj',path.join(RACINE,'Exemples','Cavité Test.conceptcad'));
  await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&builtEngine==='exact'&&bodies.some(b=>b.shape)&&faoSolidSettled(),null,{timeout:300000});
  await page.locator('[data-mfws="fao"]').first().click();
  await expect(page.locator('body')).toHaveAttribute('data-ws','fao');
  const avant=await page.evaluate(()=>window.__nbW);
  await page.locator('#mfRibbon button.mfRb:visible',{hasText:'Régénérer'}).first().click();
  // Pendant le calcul, la page répond et l'état dit où on en est
  await page.waitForFunction(()=>/génération sur \d+ cœur/.test(faceEl.textContent),null,{timeout:60000});
  await page.waitForFunction(()=>!faoPrevStale&&/FAO : \d+ points de parcours/.test(faceEl.textContent),null,{timeout:300000});
  const r=await page.evaluate(()=>({msg:faceEl.textContent,nb:window.__nbW,restants:faoWkActifs.length,
    enCache:faoDoc().ops.filter(o=>o&&o.on!==false).every(o=>!!faoOpMovesHit(o))}));
  console.log('Ruban : '+r.msg+' ('+(r.nb-avant)+' workers)');
  expect(r.nb-avant).toBeGreaterThan(1);
  expect(r.restants).toBe(0);
  expect(r.enCache).toBe(true);
  expect(avis).toEqual([]);
  expect(err).toEqual([]);
  if(process.env.MF_MC_CAPTURE)await page.screenshot({path:process.env.MF_MC_CAPTURE});
});

test('un nouveau calcul lancé pendant le premier arrête ses workers',async({page})=>{
  test.setTimeout(600000);
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&occtReady===true,null,{timeout:200000});
  await page.setInputFiles('#fileProj',path.join(RACINE,'Exemples','Cavité Test.conceptcad'));
  await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&builtEngine==='exact'&&bodies.some(b=>b.shape)&&faoSolidSettled(),null,{timeout:300000});
  const r=await page.evaluate(async()=>{
    const un=faoPreviewGenerateAsync();
    const a=performance.now();
    while(!faoWkActifs.length&&performance.now()-a<60000)await new Promise(k=>setTimeout(k,50));
    const pendant=faoWkActifs.length;
    const deux=faoPreviewGenerateAsync(); // prend la main
    await Promise.all([un,deux]);
    return {pendant,apres:faoWkActifs.length,ok:faoDoc().ops.filter(o=>o&&o.on!==false).every(o=>!!faoOpMovesHit(o))};
  });
  expect(r.pendant).toBeGreaterThan(0);
  expect(r.apres).toBe(0);
  expect(r.ok).toBe(true);
});

test('workers refusés : même résultat par le calcul normal',async({browser})=>{
  test.setTimeout(600000);
  const mono=await regenerer(browser,'Perçages','/ConceptCAD.html?mono');
  const refus=await regenerer(browser,'Perçages','/ConceptCAD.html',true);
  expect(refus.err).toEqual([]);
  expect(refus.parcours.map(p=>[p.id,p.n,p.empreinte])).toEqual(mono.parcours.map(p=>[p.id,p.n,p.empreinte]));
});

test('fichier autonome hors ligne : les workers de parcours démarrent',async({browser})=>{
  test.setTimeout(600000);
  const os=require('os'),fs=require('fs');
  const {fabriquer}=require('../../tools/autonome.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autonome-mc-'));
  const f=path.join(dir,'ConceptCAD-autonome.html');
  fabriquer(f);
  try{
    const ligne=await regenerer(browser,'Perçages','/ConceptCAD.html');
    const c=await browser.newContext({viewport:{width:1400,height:900},offline:true});
    const page=await c.newPage();
    const avis=[];
    page.on('console',m=>{if(/multicœur/.test(m.text()))avis.push(m.text());});
    await page.goto('file:///'+f.split(path.sep).join('/'));
    await page.waitForFunction(()=>{try{return occtReady===true;}catch(e){return false;}},null,{timeout:200000});
    await page.setInputFiles('#fileProj',path.join(RACINE,'Exemples','Perçages.conceptcad'));
    await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&builtEngine==='exact'&&bodies.some(b=>b.shape||b.kind==='import')&&faoSolidSettled(),null,{timeout:300000});
    await page.waitForTimeout(1500);
    const r=await page.evaluate(async()=>{
      const N0=window.Worker;let n=0;
      window.Worker=function(u){n++;return new N0(u);};
      await faoPreviewGenerateAsync();
      window.Worker=N0;
      return {n,parcours:faoDoc().ops.filter(o=>o&&o.on!==false).map(o=>{const h=faoOpMovesHit(o);return {id:o.id,mv:h&&h.mv?JSON.stringify(h.mv):''};})};
    });
    await c.close();
    r.parcours.forEach(p=>{p.empreinte=crypto.createHash('sha1').update(p.mv).digest('hex');});
    expect(r.n).toBeGreaterThan(0);
    expect(avis).toEqual([]);
    expect(r.parcours.map(p=>[p.id,p.empreinte])).toEqual(ligne.parcours.map(p=>[p.id,p.empreinte]));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
