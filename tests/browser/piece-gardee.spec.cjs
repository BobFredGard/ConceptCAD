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

// V0.96.3 : la clé ne porte plus le numéro de version (APP_VER) mais le tampon FORMES_VER : une nouvelle
// version qui ne touche pas au calcul des formes ne fait plus recalculer chaque fichier. Filet : le rejeu
// de fond qui suit une pièce relue la compare au solide recalculé ; une pièce gardée qui ne correspond
// plus (ici : remplacée exprès par un cube dans le magasin) est jetée, la pièce recalculée et rangée.
test('pièce finie gardée : clé sans numéro de version, pièce périmée détectée et recalculée',async({page})=>{
  test.setTimeout(600000);
  const err=[];page.on('pageerror',e=>err.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
  const volume=()=>page.evaluate(()=>{const G=new occt.GProp_GProps_1();try{occt.BRepGProp.VolumeProperties_1(occLive.shape,G,false,false,false);return +G.Mass().toFixed(3);}finally{G.delete();}});
  const controle=()=>page.evaluate(()=>({ok:pcVerif.ok,ecart:pcVerif.ecart}));
  const fini=()=>page.waitForFunction(()=>!pcChauffe&&rebuildDepth===0&&(pcVerif.ok+pcVerif.ecart)>0,null,{timeout:300000});
  await page.goto('/ConceptCAD.html');await pret(page);
  await page.evaluate(async()=>{const db=await idbOpen();await new Promise(r=>{const tx=db.transaction('kv','readwrite'),st=tx.objectStore('kv');const q=st.getAllKeys();q.onsuccess=()=>{q.result.filter(k=>/^pfin:/.test(k)).forEach(k=>st.delete(k));};tx.oncomplete=tx.onerror=()=>r();});db.close();});
  await ouvrirFichier(page,FIX);
  expect(await rangee(page)).toBe(true);
  const v0=await volume();
  const cles=await page.evaluate(async()=>({k:(await idbKeys('pfin:')).filter(k=>k!=='pfin:index'),app:APP_VER,formes:FORMES_VER}));
  expect(cles.k.length).toBeGreaterThan(0);
  for(const k of cles.k){expect(k.startsWith('pfin:'+cles.formes+':')).toBe(true);expect(k.includes(cles.app)).toBe(false);}
  // relue : le rejeu de fond la contrôle et la trouve bonne
  await page.reload();await pret(page);await calme(page);
  await ouvrirFichier(page,FIX);
  await fini();
  expect(await controle()).toEqual({ok:1,ecart:0});
  expect(await volume()).toBe(v0);
  // pièce gardée faussée dans le magasin : un cube à la place du solide
  const fausse=await page.evaluate(async()=>{
    const m=new occt.BRepPrimAPI_MakeBox_2(10,10,10),s=m.Shape();const octets=occBrepWrite(s);s.delete();m.delete();
    const db=await idbOpen();let n=0;
    await new Promise(r=>{const tx=db.transaction('kv','readwrite'),st=tx.objectStore('kv');const q=st.openCursor();
      q.onsuccess=()=>{const c=q.result;if(!c)return;const e=c.value;
        if(/^pfin:/.test(String(c.key))&&e&&Array.isArray(e.corps)){e.corps.forEach(x=>{x.brep=octets;x.noms=null;if(x.pre)delete x.pre;});c.update(e);n++;}
        c.continue();};
      tx.oncomplete=tx.onerror=()=>r();});
    db.close();return n;});
  expect(fausse).toBeGreaterThan(0);
  await page.reload();await pret(page);await calme(page);
  await ouvrirFichier(page,FIX);
  await fini();
  expect(await controle()).toEqual({ok:0,ecart:1});
  await calme(page);
  expect(await volume()).toBe(v0); // recalculée : le vrai solide est revenu
  expect(await page.evaluate(()=>faceEl.textContent)).toContain('Pièce gardée périmée');
  // … et rangée à la place de la fausse : la réouverture suivante est bonne
  await page.waitForTimeout(6000);
  await page.reload();await pret(page);await calme(page);
  await ouvrirFichier(page,FIX);
  await fini();
  expect(await controle()).toEqual({ok:1,ecart:0});
  expect(await volume()).toBe(v0);
  expect(err).toEqual([]);
});

// V0.99.16 : image complète de la pièce DANS le fichier (champ pfin du paquet). Un poste qui n'a jamais
// ouvert la pièce la relit depuis le fichier sans la recalculer et sans en garder de copie locale ;
// le contrôle de fond la trouve bonne. Un fichier dont le document a changé (image d'une autre version
// de la pièce) n'est pas servi : recalcul.
test('image de la pièce dans le fichier : relue sans calcul ni copie locale',async({page})=>{
  test.setTimeout(600000);
  const err=[];page.on('pageerror',e=>err.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
  const viderPfin=()=>page.evaluate(async()=>{const db=await idbOpen();await new Promise(r=>{const tx=db.transaction('kv','readwrite'),st=tx.objectStore('kv');const q=st.getAllKeys();q.onsuccess=()=>{q.result.filter(k=>/^pfin:/.test(k)).forEach(k=>st.delete(k));};tx.oncomplete=tx.onerror=()=>r();});db.close();});
  const locales=()=>page.evaluate(async()=>(await idbKeys('pfin:')).filter(k=>k!=='pfin:index').length);
  await page.goto('/ConceptCAD.html');await pret(page);
  await viderPfin();
  await ouvrirFichier(page,FIX);
  await page.waitForFunction(()=>!pcChauffe&&rebuildDepth===0,null,{timeout:300000});
  const e1=await page.evaluate(etat);
  const txt=await page.evaluate(()=>bundleSerialise());
  const b=JSON.parse(txt);
  expect(b.pfin&&b.pfin.bin&&b.pfin.sig&&b.pfin.formes).toBeTruthy();
  const avec=path.join(test.info().outputDir,'barquette-image.conceptcad');
  fs.mkdirSync(path.dirname(avec),{recursive:true});fs.writeFileSync(avec,zlib.gzipSync(txt));
  // poste « vierge » : magasin local vidé, page rechargée
  await page.waitForTimeout(3000);await viderPfin();
  await page.reload();await pret(page);await calme(page);
  await page.evaluate(()=>{window.__rejeux=0;window.__servi=0;window.__piles=[];const p=pcFR;window.pcFR=function(){const r=p.apply(this,arguments);if(r)window.__servi++;return r;};const o=occFinalShapeGen;window.occFinalShapeGen=function*(...a){if(!pcChauffe){window.__rejeux++;__piles.push(String(a[0])+' '+String(new Error().stack).split(String.fromCharCode(10)).slice(2,9).map(x=>x.trim().split(' ')[1]).join('<'));}return yield* o.apply(this,a);};});
  await ouvrirFichier(page,avec);
  const r=await page.evaluate(()=>({servi:__servi,piles:__piles}));
  console.log('image du fichier',JSON.stringify(r));
  expect(r.servi).toBe(1);
  // comme ci-dessus : ni rejeu complet ni projection (un plan posé sur une face peut relire la pièce jusqu'à sa place)
  expect(r.piles.filter(p=>/^(null|undefined) /.test(p)||/projEdgesFor|updateAllProjections|projPreUpdate/.test(p))).toEqual([]);
  expect(await page.evaluate(etat)).toEqual(e1);
  await page.waitForFunction(()=>!pcChauffe&&rebuildDepth===0&&(pcVerif.ok+pcVerif.ecart+pcVerif.sans)>0,null,{timeout:300000});
  expect(await page.evaluate(()=>({ok:pcVerif.ok,ecart:pcVerif.ecart}))).toEqual({ok:1,ecart:0});
  await page.waitForTimeout(4000);
  expect(await locales()).toBe(0); // rien de rangé sur le poste : l'image reste dans le fichier
  // document modifié, image d'origine laissée dans le fichier : pas servie
  const d=b.doc;const f=d.features.find(x=>x.type==='extrude'&&x.op==='cut'&&!x.expr&&!x.mid&&!x.repeatId);f.distance=+f.distance-0.5;
  const faux=path.join(test.info().outputDir,'barquette-image-perimee.conceptcad');
  fs.writeFileSync(faux,zlib.gzipSync(JSON.stringify(b)));
  await page.evaluate(()=>{window.__rejeux=0;window.__servi=0;});
  await ouvrirFichier(page,faux);
  const r2=await page.evaluate(()=>({servi:__servi,rejeux:__rejeux}));
  expect(r2.servi).toBe(0);
  expect(r2.rejeux).toBeGreaterThan(0);
  expect(err).toEqual([]);
});
