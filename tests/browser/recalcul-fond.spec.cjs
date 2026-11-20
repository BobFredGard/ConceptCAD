// V0.99.52 : recalcul de fond après une modification (src/31-regen-progression.js, rebuildEdit).
// Demande de Fred : « maximiser les CPU » pour la timeline. Dans un vrai navigateur, sur Cavité Usinage :
//   1. modifier une fonction du début : la main revient aussitôt, l'ancienne pièce reste affichée, la FAO
//      attend, le bandeau ne retient rien ; puis la pièce affichée est celle d'un calcul normal ;
//   2. deux modifications de suite : la seconde l'emporte, une seule pièce à la fin, bandeau parti ;
//   3. ?sansfond : rebuild() synchrone comme avant.
//   MF_FOND_FICHIER=D:/x.conceptcad  MF_FOND_IDX=2  une autre pièce (mesure de l'écran figé)
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');
const RACINE=path.join(__dirname,'..','..');
const FICHIER=process.env.MF_FOND_FICHIER||path.join(RACINE,'Exemples','Cavité Usinage.conceptcad');
const IDX=+(process.env.MF_FOND_IDX||0);

async function ouvrir(browser,url){
  const c=await browser.newContext({viewport:{width:1400,height:900}});
  const page=await c.newPage();
  const err=[];
  page.on('pageerror',e=>err.push(e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.goto(url);
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&occtReady===true,null,{timeout:200000});
  await page.setInputFiles('#fileProj',FICHIER);
  await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&builtEngine==='exact'&&bodies.some(b=>b.shape),null,{timeout:600000});
  await page.waitForTimeout(3000);
  return {c,page,err};
}
const SCRIPT=`(async IDX=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  // pièce posée : plus de suppression de face au calcul de fond (21), plus de solide provisoire (⧗)
  const stable=async()=>{for(let k=0;k<1500;k++){if(!fondInfo().enCours&&buildKeyUpToDate()&&!rebuildDepth&&!(typeof delWkPending==='function'&&delWkPending())&&!(occLive&&/⧗/.test(occLive.sig||'')))return;await sleep(20);}};
  const F=doc.features;
  const KEYS=['angle','depth','distance','dist','radius','thick','d'];
  let i=IDX?IDX-1:F.findIndex(f=>f.visible!==false&&KEYS.some(k=>typeof f[k]==='number'&&f[k]>0.5)&&f.type!=='extrude');
  if(i<0)i=F.findIndex(f=>f.visible!==false&&KEYS.some(k=>typeof f[k]==='number'&&f[k]>0.5));
  const f=F[i],k=KEYS.find(k=>typeof f[k]==='number'&&f[k]>0.5),v0=f[k];
  const emp=()=>{const sh=occLive&&occLive.shape;if(!sh)return null;
    const a=occSubShapes(sh,'TopAbs_FACE'),b=occSubShapes(sh,'TopAbs_EDGE');const r={faces:a.length,aretes:b.length};occDispose(a);occDispose(b);
    try{r.vol=+occShapeVolume(sh).toFixed(4);}catch(e){}
    r.corps=bodies.filter(x=>x.kind==='body').length;return r;};
  // veille : plus long moment sans que la page réponde
  let dernier=performance.now(),gel=0,actif=true;
  const veille=()=>{if(!actif)return;const t=performance.now();if(t-dernier>gel)gel=t-dernier;dernier=t;setTimeout(veille,10);};
  const out={fonction:f.type+' n°'+(i+1)+'/'+F.length+' ('+k+')',info:fondInfo()};
  const avant=emp();
  // 1. modification au fond
  window.__fondBudget=+(window.__mfBudget!=null?window.__mfBudget:0);
  f[k]=v0*1.01;markDirty();
  veille();
  let t=performance.now();
  rebuildEdit(()=>{out.apres=true;});
  out.main=performance.now()-t;
  out.enCours=fondInfo().enCours;
  out.ancienne=!buildKeyUpToDate()&&JSON.stringify(emp())===JSON.stringify(avant);
  out.faoAttend=fondInfo().enCours?faoSolidSettled()===false:null;
  out.voile=!!document.getElementById('mfRegenBlk');
  out.bandeau=!!document.getElementById('mfRegen');
  while(fondInfo().enCours||!buildKeyUpToDate())await sleep(20);
  out.total=performance.now()-t;actif=false;out.gel=gel;
  await stable();out.fond=emp();out.dernier=fondInfo().dernier;
  out.bandeauApres=!!document.getElementById('mfRegen');
  // la FAO repart (perçages contrôlés sur les autres cœurs, V0.99.51 : quelques secondes encore)
  for(let k=0;k<3000&&!faoSolidSettled();k++)await sleep(20);
  out.faoApres=faoSolidSettled();
  // référence : même état, calcul normal sans points de contrôle
  occCkClear();builtVersion=-1;rebuild();await stable();out.ref=emp();
  // 2. deux modifications de suite
  f[k]=v0*1.02;markDirty();rebuildEdit();
  await sleep(30);
  f[k]=v0*1.03;markDirty();rebuildEdit();
  while(fondInfo().enCours||!buildKeyUpToDate())await sleep(20);
  await sleep(100);await stable();
  out.double=emp();out.doubleBandeau=!!document.getElementById('mfRegen');
  occCkClear();builtVersion=-1;rebuild();await stable();out.doubleRef=emp();
  // même modification d'un seul tenant (comparaison des durées)
  f[k]=v0*1.04;markDirty();t=performance.now();rebuild();out.sync=performance.now()-t;
  // remise
  f[k]=v0;markDirty();rebuild();
  delete window.__fondBudget;
  return out;
})`;

test('recalcul de fond : main rendue, ancienne pièce affichée, même pièce à la fin',async({browser})=>{
  test.setTimeout(1800000);
  const o=await ouvrir(browser,'/ConceptCAD.html');
  try{
    if(process.env.MF_FOND_BUDGET)await o.page.evaluate('window.__mfBudget='+(+process.env.MF_FOND_BUDGET));
    const r=await o.page.evaluate(SCRIPT+'('+IDX+')');
    const s=ms=>(ms/1000).toFixed(2)+' s';
    console.log(path.basename(FICHIER)+' : '+r.fonction+' — main rendue en '+s(r.main)+', pièce à jour en '+s(r.total)+', écran figé au plus '+s(r.gel)+' (d’un seul tenant : '+s(r.sync)+') ; '+JSON.stringify(r.dernier));
    expect(o.err).toEqual([]);
    expect(r.enCours).toBe(true);
    expect(r.ancienne).toBe(true);
    expect(r.faoAttend).toBe(true);
    expect(r.voile).toBe(false);
    expect(r.bandeau).toBe(true);
    expect(r.apres).toBe(true);
    expect(r.bandeauApres).toBe(false);
    expect(r.faoApres).toBe(true);
    expect(r.fond).toEqual(r.ref);
    expect(r.double).toEqual(r.doubleRef);
    expect(r.doubleBandeau).toBe(false);
    expect(r.main).toBeLessThan(600); // une seule fonction ne se coupe pas (SIRAP-14-002 : 0,32 s)
  }finally{await o.c.close();}
});

test('?sansfond : calcul synchrone comme avant',async({browser})=>{
  test.setTimeout(1800000);
  const o=await ouvrir(browser,'/ConceptCAD.html?sansfond');
  try{
    const r=await o.page.evaluate(`(()=>{const f=doc.features.find(f=>f.visible!==false&&typeof f.angle==='number'&&f.angle>0.5)||doc.features.find(f=>typeof f.distance==='number');
      const k=typeof f.angle==='number'?'angle':'distance',v0=f[k];f[k]=v0*1.01;markDirty();rebuildEdit();const a=buildKeyUpToDate()&&!fondInfo().enCours;f[k]=v0;markDirty();rebuild();return {a,off:fondInfo().off};})()`);
    expect(r.off).toBe(true);
    expect(r.a).toBe(true);
    expect(o.err).toEqual([]);
  }finally{await o.c.close();}
});
