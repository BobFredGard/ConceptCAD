// V0.99.50 : vues de la mise en plan sur plusieurs cœurs, dans un vrai navigateur. Passage CAO → PLAN :
// mêmes vues qu'avec ?mono (calcul sur la page seule), écran qui répond pendant le calcul.
//   MF_MEP_FICHIER=D:/x.conceptcad   un autre fichier (pièce d'essai, mesure de gain)
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');
const RACINE=path.join(__dirname,'..','..');
const FICHIER=process.env.MF_MEP_FICHIER||path.join(RACINE,'Exemples','Cavité Usinage.conceptcad');

async function ouvrirPlan(browser,url){
  const c=await browser.newContext({viewport:{width:1400,height:900}});
  const page=await c.newPage();
  const err=[];
  page.on('pageerror',e=>err.push(e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  try{
    await page.goto(url);
    await page.waitForFunction(()=>typeof occtReady!=='undefined'&&occtReady===true,null,{timeout:200000});
    await page.setInputFiles('#fileProj',FICHIER);
    await page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&builtEngine==='exact'&&bodies.some(b=>b.shape),null,{timeout:600000});
    await page.waitForTimeout(2500); // rejeu de fond de la pièce gardée (pcChauffer) : laissé finir
    const r=await page.evaluate(async()=>{
      // Réactivité : plus long moment sans que la page ait pu répondre
      let dernier=performance.now(),gel=0,actif=true;
      const veille=()=>{if(!actif)return;const t=performance.now();if(t-dernier>gel)gel=t-dernier;dernier=t;setTimeout(veille,10);};
      veille();
      const t0=performance.now();
      document.querySelector('[data-mfws="plan"]').click();
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      await sleep(300);
      while(window.mepHlrInfo().enCours||(document.getElementById('mepBusy')&&document.getElementById('mepBusy').classList.contains('on')))await sleep(20);
      const ms=performance.now()-t0;
      actif=false;
      const vues=[];
      (doc.mep.sheets[doc.mep.cur].views||[]).forEach(v=>{const g=window.mepDebugGeo(v.id);vues.push({id:v.id,kind:v.kind,src:g&&g.src,els:g?g.els:[]});});
      const diag={usable:typeof hlrWkUsable==='function'&&hlrWkUsable(),off:typeof hlrWkOff!=='undefined'?String(hlrWkOff):null,delOff:typeof delWkOff!=='undefined'?String(delWkOff):null,durees:null};return {diag,ms,gel,ver:APP_VER,vues,info:window.mepHlrInfo(),traits:document.querySelectorAll('#mepWrap svg line,#mepWrap svg path').length};
    });
    return {...r,err};
  }finally{await c.close();}
}
const egal=(a,b)=>{
  if(typeof a==='number'&&typeof b==='number')return a===b||Math.abs(a-b)<1e-7;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return a===b;
  const ka=Object.keys(a),kb=Object.keys(b);
  return ka.length===kb.length&&ka.every(k=>egal(a[k],b[k]));
};

test('plan : vues sur plusieurs cœurs identiques au calcul sur la page, écran libre',async({browser})=>{
  test.setTimeout(1800000);
  const mono=await ouvrirPlan(browser,'/ConceptCAD.html?mono');
  const multi=await ouvrirPlan(browser,'/ConceptCAD.html');
  const s=ms=>(ms/1000).toFixed(1)+' s';
  console.log(path.basename(FICHIER)+' ('+multi.ver+', '+multi.info.coeurs+' cœurs pour les vues) : '+multi.vues.length+' vues');
  console.log('  page seule      : '+s(mono.ms)+' (écran figé '+s(mono.gel)+')');
  console.log('  plusieurs cœurs : '+s(multi.ms)+' (écran figé '+s(multi.gel)+'), état : '+JSON.stringify(multi.info));
  console.log('  diag : '+JSON.stringify(multi.diag)+' err '+JSON.stringify(multi.err));
  expect(multi.err).toEqual([]);
  expect(mono.err).toEqual([]);
  expect(multi.info.dernier&&multi.info.dernier.n).toBeGreaterThan(0); // les vues sont bien parties sur les workers
  expect(multi.vues.map(v=>[v.id,v.src,v.els.length])).toEqual(mono.vues.map(v=>[v.id,v.src,v.els.length]));
  multi.vues.forEach((v,i)=>expect(egal(v.els,mono.vues[i].els),'vue '+v.id).toBe(true));
  expect(multi.traits).toBeGreaterThan(0);
  expect(multi.gel).toBeLessThan(mono.gel);
});
