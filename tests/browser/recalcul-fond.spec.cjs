// V0.99.52 : recalcul de fond après une modification (src/31-regen-progression.js, rebuildEdit).
// Demande de Fred : « maximiser les CPU » pour la timeline. Dans un vrai navigateur, sur Cavité Usinage :
//   1. modifier une fonction du début : la main revient aussitôt, l'ancienne pièce reste affichée, la FAO
//      attend, le bandeau ne retient rien ; puis la pièce affichée est celle d'un calcul normal ;
//   2. deux modifications de suite : la seconde l'emporte, une seule pièce à la fin, bandeau parti ;
//   3. ?sansfond : rebuild() synchrone comme avant.
//   V0.99.54 : facettes d'affichage et d'outillage FAO identiques au bit près à un calcul sans rien de gardé.
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
  // V0.99.54 : facettes d'affichage et d'outillage FAO au bit près (préparées pendant le fond, 31-fond-maillage)
  const hh=a=>{let h=2166136261;const u=new Uint32Array(a.buffer,a.byteOffset,a.byteLength>>2);for(let i=0;i<u.length;i++){h^=u[i];h=Math.imul(h,16777619);}return (h>>>0).toString(16)+':'+u.length;};
  const faoFondFao=typeof fondMaillageFao==='function'&&fondMaillageFao();
  const fac=()=>bodies.filter(b=>b.kind==='body').map(b=>{const g=b.mesh.geometry;let x=hh(g.attributes.position.array)+'/'+hh(g.attributes.normal.array);
    try{if(faoFondFao){const G=b._faoGeo||faoLegacyGeo(b);if(G)x+=' fao '+hh(G.attributes.position.array)+'/'+hh(G.attributes.normal.array);}}catch(e){}return x;}).join(' ');
  const sansMemo=()=>{try{occFaceMemoClear();occMeshMemo.clear();}catch(e){}};
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
  await stable();out.fond=emp();out.dernier=fondInfo().dernier;out.maillage=fondInfo().maillage;
  out.bandeauApres=!!document.getElementById('mfRegen');
  // la FAO repart (perçages contrôlés sur les autres cœurs, V0.99.51 : quelques secondes encore)
  for(let k=0;k<3000&&!faoSolidSettled();k++)await sleep(20);
  out.faoApres=faoSolidSettled();
  out.facFond=fac();
  // référence : même état, calcul normal sans points de contrôle ni facettes gardées
  occCkClear();sansMemo();builtVersion=-1;rebuild();await stable();out.ref=emp();out.facRef=fac();
  // 2. deux modifications de suite
  f[k]=v0*1.02;markDirty();rebuildEdit();
  await sleep(30);
  f[k]=v0*1.03;markDirty();rebuildEdit();
  while(fondInfo().enCours||!buildKeyUpToDate())await sleep(20);
  await sleep(100);await stable();
  out.double=emp();out.doubleBandeau=!!document.getElementById('mfRegen');out.facDouble=fac();
  occCkClear();sansMemo();builtVersion=-1;rebuild();await stable();out.doubleRef=emp();out.facDoubleRef=fac();
  // même modification d'un seul tenant (comparaison des durées)
  f[k]=v0*1.04;markDirty();t=performance.now();rebuild();out.sync=performance.now()-t;
  // remise
  f[k]=v0;markDirty();rebuild();
  delete window.__fondBudget;
  return out;
})`;

test('recalcul de fond : main rendue, ancienne pièce affichée, même pièce à la fin',async({browser})=>{
  test.setTimeout(1800000);
  const o=await ouvrir(browser,'/ConceptCAD.html'+(process.env.MF_FOND_Q||''));
  try{
    if(process.env.MF_FOND_BUDGET)await o.page.evaluate('window.__mfBudget='+(+process.env.MF_FOND_BUDGET));
    const r=await o.page.evaluate(SCRIPT+'('+IDX+')');
    const s=ms=>(ms/1000).toFixed(2)+' s';
    console.log(path.basename(FICHIER)+' : '+r.fonction+' — main rendue en '+s(r.main)+', pièce à jour en '+s(r.total)+', écran figé au plus '+s(r.gel)+' (d’un seul tenant : '+s(r.sync)+') ; '+JSON.stringify(r.dernier)+' ; facettes préparées : '+JSON.stringify(r.maillage));
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

// V0.99.54 : une modification, puis les facettes d'affichage et d'outillage FAO de la pièce finale ; même pièce,
// même modification, avec et sans les facettes préparées pendant le fond (31-fond-maillage). Un calcul entièrement
// neuf n'est pas une référence : la finesse d'affichage suit la boîte du solide, qui dépend des triangles déjà posés.
const SCRIPT_FAC=`(async IDX=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const stable=async()=>{for(let k=0;k<1500;k++){if(!fondInfo().enCours&&buildKeyUpToDate()&&!rebuildDepth&&!(typeof delWkPending==='function'&&delWkPending())&&!(occLive&&/⧗/.test(occLive.sig||'')))return;await sleep(20);}};
  const F=doc.features;
  const KEYS=['angle','depth','distance','dist','radius','thick','d'];
  let i=IDX?IDX-1:F.findIndex(f=>f.visible!==false&&KEYS.some(k=>typeof f[k]==='number'&&f[k]>0.5)&&f.type!=='extrude');
  if(i<0)i=F.findIndex(f=>f.visible!==false&&KEYS.some(k=>typeof f[k]==='number'&&f[k]>0.5));
  const f=F[i],k=KEYS.find(k=>typeof f[k]==='number'&&f[k]>0.5);
  const hh=a=>{let h=2166136261;const u=new Uint32Array(a.buffer,a.byteOffset,a.byteLength>>2);for(let i=0;i<u.length;i++){h^=u[i];h=Math.imul(h,16777619);}return (h>>>0).toString(16)+':'+u.length;};
  window.__fondBudget=0;
  f[k]*=1.01;markDirty();rebuildEdit();
  while(fondInfo().enCours||!buildKeyUpToDate())await sleep(20);
  await stable();
  for(let n=0;n<3000&&!faoSolidSettled();n++)await sleep(20);
  delete window.__fondBudget;
  const fac=bodies.filter(b=>b.kind==='body').map(b=>{const g=b.mesh.geometry;let x=hh(g.attributes.position.array)+'/'+hh(g.attributes.normal.array);
    try{const G=b._faoGeo||faoLegacyGeo(b);if(G)x+=' fao '+hh(G.attributes.position.array)+'/'+hh(G.attributes.normal.array);}catch(e){}return x;}).join(' ');
  return {fac,maillage:fondInfo().maillage};
})`;
test('facettes préparées pendant le fond : identiques au bit près',async({browser})=>{
  test.setTimeout(1800000);
  const R=[];
  for(const q of ['','?sansfondmaillage']){
    const o=await ouvrir(browser,'/ConceptCAD.html'+q);
    try{R.push(await o.page.evaluate(SCRIPT_FAC+'('+IDX+')'));expect(o.err).toEqual([]);}
    finally{await o.c.close();}
  }
  console.log(path.basename(FICHIER)+' : facettes préparées '+JSON.stringify(R[0].maillage)+' ; '+R[0].fac);
  expect(R[0].maillage&&R[0].maillage.rangees).toBeGreaterThan(0);
  expect(R[1].maillage).toBe(null);
  expect(R[0].fac).toBe(R[1].fac);
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
