// Pièce finie gardée sur le poste (V0.94.6) :
//   1. 1re ouverture : la pièce est calculée, puis rangée (IndexedDB, clé pfin:…) ;
//   2. page rechargée, même fichier rouvert : la pièce est RELUE (aucun rejeu, aucune projection),
//      identique au calcul : volume, faces et leurs noms, empreinte du solide, maillage, outils
//      montrés à la sélection, ⚠ des fonctions ;
//   3. points de contrôle remplis en fond ; une modification donne le même solide qu'un recalcul
//      complet ;
//   4. fichier modifié : la clé change, la pièce est recalculée.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path'),fs=require('fs'),zlib=require('zlib');
const FIX=path.join(__dirname,'..','fixtures','barquette-exemple.conceptcad');

const pret=async page=>{await page.waitForFunction(()=>{try{return occtReady===true;}catch(e){return false;}},null,{timeout:180000});await page.waitForTimeout(500);};
const calme=async page=>page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&!regenRun&&!regenUi&&bodies.some(b=>b.kind==='body'),null,{timeout:180000});
const etat=()=>{
  const vol=sh=>{const G=new occt.GProp_GProps_1();try{occt.BRepGProp.VolumeProperties_1(sh,G,false,false,false);return +G.Mass().toFixed(3);}finally{G.delete();}};
  return{
    sig:occLive&&occLive.sig,
    corps:bodies.filter(b=>b.kind==='body').map(b=>{
      let nf=0;const ex=new occt.TopExp_Explorer_2(b.shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);for(;ex.More();ex.Next())nf++;ex.delete();
      const T=nomsDe(b.shape);
      return{id:b.bodyId,vol:vol(b.shape),faces:nf,noms:T?T.f.join('|'):null,tris:b.mesh.geometry.attributes.position.count/3};}),
    fantomes:bodies.filter(b=>b.ghost).length,
    alertes:doc.features.filter(f=>(f._m&&f._m.m<f._m.t)||f._err||f._perdues).map(f=>f.id+':'+JSON.stringify(f._perdues||f._m||f._err))
  };
};
const ouvrirFichier=async(page,fichier)=>{
  // comme « Ouvrir » (97) : texte du fichier (décompressé), puis chargement sans question
  const b64=fs.readFileSync(fichier).toString('base64');
  await page.evaluate(async([b64,nom])=>{
    const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    const txt=await mffFileText(new File([u8],nom));
    await mffLoadText(txt,nom,null);
  },[b64,path.basename(fichier)]);
  await calme(page);
};
const rangee=async page=>{
  for(let i=0;i<120;i++){
    if(await page.evaluate(async()=>(await idbKeys('pfin:')).some(k=>k!=='pfin:index')))return true;
    await page.waitForTimeout(1000);
  }
  return false;
};

test('pièce finie gardée : relue à l’identique, recalculée si le fichier change',async({page})=>{
  test.setTimeout(600000);
  const err=[];page.on('pageerror',e=>err.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
  await page.goto('/ConceptCAD.html');await pret(page);
  // 1. calcul puis rangement
  await ouvrirFichier(page,FIX);
  expect(await rangee(page)).toBe(true);
  const e1=await page.evaluate(etat);
  // 2. page rechargée, même fichier : relu
  await page.reload();await pret(page);await calme(page);
  await page.evaluate(()=>{window.__rejeux=0;window.__servi=0;const p=pcFR;window.pcFR=function(){const r=p.apply(this,arguments);if(r)window.__servi++;return r;};const o=occFinalShapeGen;window.__piles=[];window.occFinalShapeGen=function*(...a){if(!pcChauffe){window.__rejeux++;__piles.push(String(a[0])+' '+String(new Error().stack).split(String.fromCharCode(10)).slice(2,9).map(x=>x.trim().split(' ')[1]).join('<'));}return yield* o.apply(this,a);};});
  const t0=Date.now();
  await ouvrirFichier(page,FIX);
  const ms=Date.now()-t0;
  const r2=await page.evaluate(()=>({piles:__piles,rejeux:__rejeux,servi:__servi===1}));
  const e2=await page.evaluate(etat);
  console.log('relue en',ms,'ms',JSON.stringify(r2));
  expect(r2.servi).toBe(true);
  // ni rejeu d'affichage (complet), ni projection ; un plan de construction posé sur une face peut
  // relire la pièce jusqu'à sa place (rejeu partiel, cgResolveAll), comme à chaque calcul
  expect(r2.piles.filter(p=>/^(null|undefined) /.test(p)||/projEdgesFor|updateAllProjections|projPreUpdate/.test(p))).toEqual([]);
  expect(e2).toEqual(e1);
  // 3. préchauffe finie : une modification = même solide qu'un recalcul complet
  await page.waitForFunction(()=>!pcChauffe,null,{timeout:300000});
  const m=await page.evaluate(()=>{
    const vol=sh=>{const G=new occt.GProp_GProps_1();try{occt.BRepGProp.VolumeProperties_1(sh,G,false,false,false);return +G.Mass().toFixed(3);}finally{G.delete();}};
    const f=doc.features.find(x=>x.type==='extrude'&&x.visible!==false&&x.op==='cut'&&!x.expr&&!x.mid&&!x.repeatId);
    const d0=f.distance;f.distance=+f.distance-0.5;markDirty();
    const t=performance.now();rebuild();const ms=performance.now()-t;
    const a=vol(occLive.shape);
    occCkClear();builtVersion=-1;rebuild();
    const b=vol(occLive.shape);
    f.distance=d0;markDirty();rebuild();
    return{ms:Math.round(ms),a,b,c:vol(occLive.shape)};
  });
  console.log('modification après relecture',JSON.stringify(m));
  expect(m.a).toBe(m.b);
  expect(m.a).not.toBe(m.c);           // la modification a bien changé la pièce
  expect(m.c).toBe(e1.corps.reduce((s,c)=>s+c.vol,0)); // retour à la valeur : pièce d'origine
  // 4. fichier modifié (une cote) : autre clé, recalcul
  const b=JSON.parse(zlib.gunzipSync(fs.readFileSync(FIX)).toString());
  const d=b.doc||b;const f=d.features.find(x=>x.type==='extrude'&&x.op==='cut'&&!x.expr&&!x.mid&&!x.repeatId);f.distance=+f.distance-0.5;
  const autre=path.join(test.info().outputDir,'barquette-modifiee.conceptcad');
  fs.mkdirSync(path.dirname(autre),{recursive:true});fs.writeFileSync(autre,zlib.gzipSync(JSON.stringify(b)));
  await page.evaluate(()=>{window.__rejeux=0;window.__servi=0;});
  await ouvrirFichier(page,autre);
  const r4=await page.evaluate(()=>({rejeux:__rejeux,servi:__servi>0}));
  expect(r4.servi).toBe(false);
  expect(r4.rejeux).toBeGreaterThan(0);
  expect(err).toEqual([]);
});
