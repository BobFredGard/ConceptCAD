'use strict';
const {test,expect}=require('@playwright/test');const fs=require('fs'),path=require('path');
const FIX=path.join(__dirname,'..','..','Exemples','Cache Piles.conceptcad');
// V0.95.1 : pièce rouverte sans changement = non modifiée, malgré le bruit d'arrondi du recalcul de fond (arêtes de congé)
test('pièce rouverte après une modification refusée : non marquée modifiée',async({page})=>{
  test.setTimeout(400000);
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>{try{return occtReady===true;}catch(e){return false;}},null,{timeout:180000});
  const b64=fs.readFileSync(FIX).toString('base64');
  const go=async()=>{await page.evaluate(async([b64,nom])=>{
    const om=mffMark;window.__snaps=[];window.mffMark=function(){__snaps.push(serialise(false));return om.apply(this,arguments);};
    const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const txt=await mffFileText(new File([u8],nom));await mffLoadText(txt,nom,null);},[b64,'Cache Piles.conceptcad']);
    await page.waitForFunction(()=>rebuildDepth===0&&!regenRun&&!regenUi,null,{timeout:180000});
    await page.waitForTimeout(6000);
    return page.evaluate(()=>{const a=JSON.parse(__snaps[__snaps.length-1]),b=JSON.parse(serialise(false));const diff=[];
      const w=(x,y,p)=>{if(JSON.stringify(x)===JSON.stringify(y))return;if(x&&y&&typeof x==='object'&&typeof y==='object'&&diff.length<20){for(const k of new Set([...Object.keys(x),...Object.keys(y)]))w(x[k],y[k],p+'.'+k);}else diff.push(p+' : '+JSON.stringify(x)?.slice(0,120)+' → '+JSON.stringify(y)?.slice(0,120));};
      w(a,b,'');return {mod:mffModified(),n:__snaps.length,diff:diff.filter(d=>!/^\.(view|sel|fold|originVis)/.test(d))};});
  };
  expect((await go()).mod).toBe(false);
  // modifie une cote, puis rouvre (comme « Ne pas enregistrer » puis reprise)
  await page.evaluate(async()=>{const sk=doc.sketches.find(k=>(k.dims||[]).some(d=>d.type!=='angle'&&!d.expr&&parDimUser(d)>2)),d=sk.dims.find(d=>d.type!=='angle'&&!d.expr&&parDimUser(d)>2);parSetDim(sk,d,String(+(parDimUser(d)+0.5).toFixed(3)));await parAfterChange(false);});
  await page.waitForTimeout(3000);
  expect((await go()).mod).toBe(false);
});
