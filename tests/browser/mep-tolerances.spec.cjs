// Écarts d'une classe ISO (5 H7) dans un VRAI navigateur : quel que soit le sens de tracé de la cote,
// l'écart inférieur reste au niveau de la valeur, l'écart supérieur au-dessus, et rien ne touche la ligne.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');

test('écarts de tolérance au niveau de la valeur, dans les deux sens de la cote',async({page})=>{
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);

  const R=await page.evaluate(()=>{
    mepSetActive(true);
    const sh=doc.mep.sheets[doc.mep.cur];
    sh.views=[{id:'vT',kind:'base',dir:[0,0,1],u:[1,0,0],v:[0,-1,0],x:120,y:120,scale:4,mode:'hide',tangent:false,hlrExact:true,axes:[]}];
    const cote=(id,xa,xb,y)=>({id,kind:'dist',vid:'vT',vid2:null,a:{x:xa,y},b:{x:xb,y},off:8,orient:'h',ref:false,value:5,tol:{m:'cls',cls:'H7'}});
    sh.dims=[cote('dDroite',-2.5,2.5,0),cote('dGauche',22.5,17.5,0)]; // tracée de droite à gauche
    window.mepRefresh();
    const svg=document.getElementById('mepSvg')||document.querySelector('#mepWrap svg');
    const txt=[...svg.querySelectorAll('text')];
    const lit=t=>t.textContent.trim();
    const boite=t=>{const r=t.getBoundingClientRect();return{x:r.left,h:r.top,b:r.bottom,milieu:(r.top+r.bottom)/2};};
    // chaque cote : sa valeur, puis les écarts écrits juste après elle
    return [...txt.keys()].filter(i=>lit(txt[i])==='5 H7').map(i=>{
      const suite=txt.slice(i+1,i+9);
      const zero=suite.find(t=>lit(t)==='0');
      const plus=suite.find(t=>/^\+0/.test(lit(t))||lit(t)==='+0');
      return{val:boite(txt[i]),base:+txt[i].getAttribute('y'),inf:+zero.getAttribute('y'),sup:+plus.getAttribute('y'),
        supTxt:lit(plus),infTxt:lit(zero)};
    });
  });
  expect(R.length,'les deux cotes sont dessinées').toBe(2);
  for(const c of R){
    expect(c.supTxt.startsWith('+0'),'écart supérieur trouvé').toBe(true);
    expect(c.inf,'écart inférieur au niveau de la valeur').toBeCloseTo(c.base,6);
    expect(c.sup,'écart supérieur au-dessus de l’écart inférieur').toBeLessThan(c.inf);
  }
  const dir=process.env.KW_CAPTURES;
  if(dir)await page.screenshot({path:path.join(dir,'mep-tolerances.png')});
  expect(err).toEqual([]);
});
