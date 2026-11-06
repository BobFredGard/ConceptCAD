// Noyau multicœur dans un vrai navigateur (V0.67.0) : choisi tout seul sur une page isolée et écrit dans la barre
// d'état, noyau normal sinon, service worker du site, et mêmes pièces et mêmes parcours FAO avec et sans fils.
'use strict';
const {test,expect}=require('@playwright/test');
const crypto=require('crypto'),path=require('path');
const RACINE=path.join(__dirname,'..','..');

const pret=pg=>pg.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
const etat=pg=>pg.evaluate(()=>({pret:occtReady,fils:occtMtFils,coi:self.crossOriginIsolated,msg:occBaseMsg}));
async function ouvrir(browser,url){
  const c=await browser.newContext({viewport:{width:1400,height:900}});
  const page=await c.newPage();
  const err=[];
  page.on('pageerror',e=>err.push(e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.goto(url);await pret(page);
  return {c,page,err};
}
async function piece(page,nom){
  await page.setInputFiles('#fileProj',nom==='Barquette'?path.join(RACINE,'tests','fixtures','barquette-exemple.conceptcad'):path.join(RACINE,'Exemples',nom+'.conceptcad'));
  await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&builtEngine==='exact'&&bodies.some(b=>b.shape),null,{timeout:200000});
  await page.waitForTimeout(1500);
  const r=await page.evaluate(async()=>{
    occCkClear();markDirty();rebuild();
    const E=occt.TopAbs_ShapeEnum,nb=(s,t)=>{let n=0;const x=new occt.TopExp_Explorer_2(s,t,E.TopAbs_SHAPE);for(;x.More();x.Next())n++;x.delete();return n;};
    const corps=bodies.filter(b=>b.shape).map(b=>[b.name,nb(b.shape,E.TopAbs_FACE),nb(b.shape,E.TopAbs_EDGE),+occShapeVolume(b.shape).toFixed(3)]);
    const job=faoDoc(),ops=(job.ops||[]).filter(o=>o&&o.on!==false);
    if(ops.length)await faoPreviewGenerateAsync();
    const parcours=ops.map(o=>{const h=faoOpMovesHit(o);return [o.id,h&&h.mv?h.mv.length:-1,h&&h.mv?JSON.stringify(h.mv):''];});
    return {corps,parcours};
  });
  r.parcours=r.parcours.map(p=>[p[0],p[1],crypto.createHash('sha1').update(p[2]).digest('hex')]);
  return r;
}

test('page isolée : multicœur tout seul, écrit à l’écran, mêmes pièces et parcours que le noyau normal',async({browser})=>{
  test.setTimeout(900000);
  for(const nom of ['Barquette','Perçages']){
    const m=await ouvrir(browser,'/ConceptCAD.html?isole');
    const n=await ouvrir(browser,'/ConceptCAD.html?isole&mt=0');
    try{
      const em=await etat(m.page),en=await etat(n.page);
      expect(em.coi).toBe(true);expect(em.fils).toBe(4);expect(em.msg).toContain('Multicœur : 4 cœurs');
      expect(en.fils).toBe(0);expect(en.msg).toContain('Un seul cœur');
      await m.page.waitForFunction(()=>/multicœur 4 cœurs/.test(document.getElementById('mfStEng').textContent),null,{timeout:10000});
      const rm=await piece(m.page,nom),rn=await piece(n.page,nom);
      expect(rm.corps.length).toBeGreaterThan(0);
      expect(rm.corps).toEqual(rn.corps);
      expect(rm.parcours).toEqual(rn.parcours);
      expect(m.err).toEqual([]);expect(n.err).toEqual([]);
    }finally{await m.c.close();await n.c.close();}
  }
});

test('page non isolée : noyau normal, et la raison est écrite',async({browser})=>{
  const o=await ouvrir(browser,'/ConceptCAD.html');
  try{
    const e=await etat(o.page);
    expect(e.pret).toBe(true);expect(e.coi).toBe(false);expect(e.fils).toBe(0);
    expect(e.msg).toContain('Un seul cœur');
    expect(o.err).toEqual([]);
  }finally{await o.c.close();}
});

test('service worker du site : multicœur à la deuxième ouverture, sans rechargement forcé',async({browser})=>{
  test.setTimeout(400000);
  const c=await browser.newContext({viewport:{width:1400,height:900}});
  const page=await c.newPage();
  const err=[];page.on('pageerror',e=>err.push(e.message));
  let nav=0;page.on('framenavigated',f=>{if(f===page.mainFrame())nav++;});
  try{
    await page.goto('/ConceptCAD.html?sw');await pret(page);
    let e=await etat(page);
    expect(e.coi).toBe(false);expect(e.fils).toBe(0);expect(nav).toBe(1);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await pret(page);
    e=await etat(page);
    expect(e.coi).toBe(true);expect(e.fils).toBe(4);
    await piece(page,'Axe');
    expect(err).toEqual([]);
  }finally{await c.close();}
});
