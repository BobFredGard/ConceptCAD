// Resélection des faces et arêtes perdues (V0.94.5), comme Fusion :
//   1. Barquette : « Déplacement de 7 faces » dont 5 ne sont plus retrouvées → ⚠ dans l'arbre,
//      l'édition arme « 🎯 Remplacer » sur la 1re perdue, le clic suivant la remplace à sa place ;
//      la note des faces perdues n'entre ni dans l'empreinte de la fonction ni dans le fichier.
//   2. Chanfrein dont une arête n'existe plus sur le solide : gardées dans l'édition (avant : effacées au 1er clic),
//      l'arête cliquée remplace la perdue et reprend sa distance.
//   3. Esquisse : « 🎯 Changer de face » arrête la timeline avant sa fonction, le clic la repose sur
//      la face cliquée (normale, plan), puis rend le marqueur ; Échap annule.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');
const FIX=n=>path.join(__dirname,'..','fixtures',n);

async function ouvrir(page,fichier){
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>{try{return occtReady===true;}catch(e){return false;}},null,{timeout:180000});
  await page.setInputFiles('#fileProj',fichier);
  await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&!regenRun&&!regenUi,null,{timeout:180000});
  await page.waitForTimeout(1500);
}

test('faces perdues : déplacer une face, esquisse',async({page})=>{
  test.setTimeout(300000);
  const err=[];page.on('pageerror',e=>err.push(e.message));page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await ouvrir(page,FIX('barquette-exemple.conceptcad'));
  const r=await page.evaluate(async()=>{
    const W=ms=>new Promise(k=>setTimeout(k,ms));
    const idle=async()=>{await W(200);const t=performance.now();while((rebuildDepth||regenRun||regenUi)&&performance.now()-t<120000)await W(200);await W(300);};
    const out={};
    occCkClear();markDirty();rebuild();await idle();
    const f=doc.features.find(x=>x.type==='xmove'&&(x._perdues||[]).length);
    out.perdues=f&&f._perdues.slice();
    out.icone=featIconOf(f);
    out.sigSansNote=(()=>{const a=featSig(f);const p=f._perdues;delete f._perdues;const b=featSig(f);f._perdues=p;return a===b;})();
    out.fichierSansNote=!JSON.stringify(serialise(doc)).includes('_perdues');
    // édition : la 1re perdue attend sa remplaçante
    enterMoveFaceMode(f);await idle();
    out.remp=mvMode.remp;
    out.boutons=[...document.querySelectorAll('#props button')].filter(b=>/Remplacer|Cliquez/.test(b.textContent)).length;
    out.consigne=/Face perdue/.test(faceEl.textContent);
    // clic sur une face (vraie face du solide affiché, hors sélection)
    const sh=occLive.shape;let ord=-1,ref=null;
    const pris=new Set(mvMode.faces.map(x=>coqueKey(x)));
    const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);let o=0;
    while(ex.More()&&!ref){const fc=occFaceCur(ex);const rr=occFaceRef(fc);if(rr&&!pris.has(coqueKey(rr))){ref=rr;ord=o;}try{fc.delete();}catch(e){}o++;ex.Next();}
    try{ex.delete();}catch(e){}
    const avant=mvMode.faces.length,j=mvMode.remp;
    const mfu=mvFaceUnder;mvFaceUnder=()=>{ref._ord=ord;ref._bid=bodies.find(b=>b.shape===sh)?.id;return{ref,ord,blend:null};};
    try{mvFaceCommit({clientX:0,clientY:0,button:0});}finally{mvFaceUnder=mfu;}
    out.remplacee=mvMode.faces[j]===ref&&mvMode.faces.length===avant;
    out.remp2=mvMode.remp;
    exitMoveFaceMode(true);await idle();
    out.marqueurRendu=tlMark;
    // esquisse : changer de face
    const sk=doc.sketches.find(s=>s.plane==='FACE'&&doc.features.some(x=>x.sketchId===s.id));
    out.esq=sk&&sk.name;
    sel={kind:'sketch',id:sk.id};renderProps();
    out.boutonEsq=[...document.querySelectorAll('#props button')].some(b=>/Changer de face/.test(b.textContent));
    skRedefStart(sk.id);await idle();
    out.bloque=tlMark===(doc.features.find(x=>x.sketchId===sk.id)||{}).id;
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await idle();
    out.echap={redef:!!skRedef,marqueur:tlMark};
    skRedefStart(sk.id);await idle();
    const rc=new THREE.Raycaster(new THREE.Vector3(0.3,0.2,500),new THREE.Vector3(0,0,-1));
    const h=rc.intersectObjects(bodies.filter(b=>b.visible&&b.mesh).map(b=>b.mesh),false)[0];
    out.touche=!!h;
    if(h){
      const n=faceNormalWorld(h.object,h.faceIndex).normalize();
      // face parallèle : le dessin ne glisse pas dans le plan (seul un recalage selon la normale)
      const N0=new THREE.Vector3(...sk.axN).normalize(),O0=new THREE.Vector3(...sk.origin),U0=sk.axU.slice();
      const ok=skRedefApply(sk,{mesh:h.object,point:h.point.clone(),faceIndex:h.faceIndex});
      skRedef=null;tlEditUnlock();markDirty();rebuild();await idle();
      const N=new THREE.Vector3(...sk.axN),O=new THREE.Vector3(...sk.origin);
      out.parallele=N0.dot(n)>1-1e-6;
      if(out.parallele){const d=O.clone().sub(O0);out.garde=d.clone().sub(N0.clone().multiplyScalar(d.dot(N0))).length()<2e-3&&U0.every((x,i)=>Math.abs(x-sk.axU[i])<1e-9);}
      out.repose={ok,normale:N.dot(n)>0.999,plan:Math.abs(n.dot(O.clone().sub(h.point)))<1e-2,marqueur:tlMark,perdue:skFacePerdue(sk)};
    }
    return out;
  });
  console.log(JSON.stringify(r));
  expect(r.perdues).toEqual([2,3,4,5,6]);
  expect(r.icone).toBe('⚠');
  expect(r.sigSansNote).toBe(true);
  expect(r.fichierSansNote).toBe(true);
  expect(r.remp).toBe(2);
  expect(r.boutons).toBe(5);
  expect(r.consigne).toBe(true);
  expect(r.remplacee).toBe(true);
  expect(r.remp2).toBe(3);
  expect(r.marqueurRendu).toBe(null);
  expect(r.boutonEsq).toBe(true);
  expect(r.bloque).toBe(true);
  expect(r.echap).toEqual({redef:false,marqueur:null});
  expect(r.touche).toBe(true);
  if(r.parallele)expect(r.garde).toBe(true);
  expect(r.repose).toEqual({ok:true,normale:true,plan:true,marqueur:null,perdue:null});
  expect(err).toEqual([]);
});

test('arêtes perdues d’un chanfrein : gardées, remplacées avec leur distance',async({page})=>{
  test.setTimeout(300000);
  const err=[];page.on('pageerror',e=>err.push(e.message));page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await ouvrir(page,FIX('merlin_proj_fix_perdus.conceptcad'));
  const r=await page.evaluate(async()=>{
    const W=ms=>new Promise(k=>setTimeout(k,ms));
    const idle=async()=>{await W(200);const t=performance.now();while((rebuildDepth||regenRun||regenUi)&&performance.now()-t<120000)await W(200);await W(300);};
    const out={};
    // une arête ajoutée là où le solide n'en a pas : perdue au rejeu
    const f=doc.features.find(x=>x.type==='xfillet');
    const e0=f.edges[0];f.edges.push({pos:[e0.pos[0]+400,e0.pos[1]+400,e0.pos[2]],pos0:[e0.pos[0]+400,e0.pos[1]+400,e0.pos[2]],r:e0.r,len:e0.len||0,anchor:null,name:'Arête fictive'});
    occCkClear();markDirty();rebuild();await idle();
    out.miss=(f._miss||[]).length;
    enterExactFilletMode(f);await idle();
    out.perdues=(filModeX.perdues||[]).length;out.remp=filModeX.remp;
    out.consigne=/Arête perdue/.test(faceEl.innerHTML);
    const q=filModeX.perdues[0];q.r=1.7;
    // un clic ordinaire ailleurs ne les efface plus
    const libre=filModeX.edges.map((e,i)=>i).filter(i=>!xIsSel(i));
    filModeX.remp=null;
    const ep=exactPick;exactPick=()=>libre[0];
    try{exactToggle({clientX:0,clientY:0,button:0});}finally{exactPick=ep;}
    out.gardees=filModeX.sel.filter(s=>s._perdue).length;
    // remplacement : l'arête cliquée reprend la distance de la perdue
    filModeX.remp=0;
    exactPick=()=>libre[1];
    try{exactToggle({clientX:0,clientY:0,button:0});}finally{exactPick=ep;}
    const m=filModeX.edges[libre[1]].mid;
    const nv=filModeX.sel.find(s=>Math.hypot(s.pos[0]-m[0],s.pos[1]-m[1],s.pos[2]-m[2])<0.75);
    out.reprise=nv&&nv.r;out.restantes=filModeX.perdues.length;out.remp2=filModeX.remp;
    exitFilletMode(true);await idle();
    return out;
  });
  console.log(JSON.stringify(r));
  expect(r.miss).toBe(1);
  expect(r.perdues).toBe(1);
  expect(r.remp).toBe(0);
  expect(r.consigne).toBe(true);
  expect(r.gardees).toBe(1);
  expect(r.reprise).toBe(1.7);
  expect(r.restantes).toBe(0);
  expect(r.remp2).toBe(null);
  expect(err).toEqual([]);
});
