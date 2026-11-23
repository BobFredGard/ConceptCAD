// Ctrl+clic de faces (90-10-selection-mesure) : 2 faces = mesure (cote verte) ;
// dès la 3e, plus de mesure (cotes vertes et étiquettes retirées), sélection seule
// pour Suppr ; Ctrl+clic sur une face prise la retire et la mesure revient à 2.
'use strict';
const {test,expect}=require('@playwright/test');

test('3 faces = sélection sans mesure, Suppr les supprime',async({page})=>{
  const err=[];page.on('pageerror',e=>err.push('pageerror : '+e.message));
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&occtReady===true,null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  await page.evaluate(()=>{
    newSketch('XY');const sk=skEdit;const P=[[0,0],[40,0],[40,30],[0,30]].map(([x,y])=>addPoint(sk,x,y));
    for(let i=0;i<4;i++)sk.entities.push({id:'L'+i,t:'line',p1:P[i],p2:P[(i+1)%4]});
    closeSketch(true);
    addFeature({id:uid('ex'),type:'extrude',name:'Bloc',sketchId:sk.id,op:'add',distance:20});markDirty();rebuild();
  });
  await page.waitForFunction(()=>builtEngine==='exact'&&rebuildDepth===0&&builtVersion===_docVersion&&!!(occLive&&occLive.shape),null,{timeout:60000});
  await page.waitForTimeout(500);
  // une face visible par direction : on cherche, sur une grille, 3 faces planes de normales différentes
  const pts=await page.evaluate(()=>{
    const r=renderer.domElement.getBoundingClientRect(),vus=new Map();
    for(let i=1;i<40;i++)for(let j=1;j<40;j++){
      const x=r.left+r.width*i/40,y=r.top+r.height*j/40,h=pick({clientX:x,clientY:y});
      if(!h||!h.face)continue;const n=h.face.normal.clone().transformDirection(h.object.matrixWorld);
      const k=[n.x,n.y,n.z].map(v=>Math.round(v)).join(',');if(!vus.has(k)&&Math.abs(n.x)+Math.abs(n.y)+Math.abs(n.z)>0.99)vus.set(k,{x,y});
    }
    return [...vus.values()].slice(0,3);
  });
  expect(pts.length).toBe(3);
  const etat=()=>page.evaluate(()=>({n:selFaces.length,vert:!!measureGroup,lab:labelsDiv.children.length,txt:faceEl.textContent}));
  await page.mouse.click(pts[0].x,pts[0].y);
  await page.keyboard.down('Control');
  await page.mouse.click(pts[1].x,pts[1].y);
  let s=await etat();
  expect(s.n).toBe(2);expect(s.vert).toBe(true); // 2 faces : mesure
  await page.mouse.click(pts[2].x,pts[2].y);
  s=await etat();
  expect(s.n).toBe(3);expect(s.vert).toBe(false);expect(s.lab).toBe(0);
  expect(s.txt).toMatch(/3 faces sélectionnées/);
  expect(await page.locator('.parMesBtn, .parMesFx').count()).toBe(0);
  // Ctrl+clic sur la 3e : retirée, la mesure revient
  await page.mouse.click(pts[2].x,pts[2].y);
  s=await etat();
  expect(s.n).toBe(2);expect(s.vert).toBe(true);
  await page.mouse.click(pts[2].x,pts[2].y);
  await page.keyboard.up('Control');
  expect((await etat()).n).toBe(3);
  await page.keyboard.press('Delete');
  const f=await page.evaluate(()=>{const f=doc.features.find(x=>x.type==='xdelface');return f?f.faces.length:0;});
  expect(f).toBe(3);
  expect(err).toEqual([]);
});
