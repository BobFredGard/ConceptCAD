// Gorge de joint torique, dans un VRAI navigateur : bouton du ruban, vrai clic sur un arbre, un alésage, puis la face
// plane d'une bride percée ; cotes ISO 3601-2, joint ISO 3601-1 / AS568 posé en corps séparé, réglage, suppression.
'use strict';
const {test,expect}=require('@playwright/test');

test('joint torique : arbre, alésage et face plane reconnus au clic',async({page})=>{
  const err=[];
  page.on('pageerror',e=>err.push('pageerror : '+e.message));
  page.on('dialog',d=>{err.push('dialog : '+d.message());d.dismiss().catch(()=>{});});
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&(occtReady===true||/échec|indisponible/.test(occBaseMsg)),null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);

  const scene=(sks,fts,cam,tgt,P)=>page.evaluate(([sks,fts,cam,tgt,P])=>{
    doc.sketches=sks;doc.features=fts;doc.bodies=[];doc.cgeo=[];delete doc.activeBody;selFaces=[];sel={kind:null,id:null};
    markDirty();rebuild();renderTree();renderProps();
    camera.position.set(cam[0],cam[1],cam[2]);controls.target.set(tgt[0],tgt[1],tgt[2]);camera.lookAt(controls.target);controls.update();camera.updateMatrixWorld(true);
    const v=new THREE.Vector3(P[0],P[1],P[2]).project(camera),r=renderer.domElement.getBoundingClientRect();
    return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};
  },[sks,fts,cam,tgt,P]);
  const rond=(id,r,org)=>({id:'sk'+id,name:id,plane:'YZ',origin:org||[0,0,0],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],points:{c:{x:0,y:0}},
    entities:[{id:'e1',t:'circle',pc:'c',r}],constraints:[],dims:[],seq:10,visible:false});
  const plein=(s,d,op)=>({id:'F'+s,type:'extrude',name:s,sketchId:'sk'+s,distance:d,op:op||'add',visible:true});
  const inside=q=>page.evaluate(q=>{const cl=occClassifier(occLive.shape),p=new occt.gp_Pnt_3(q[0],q[1],q[2]);cl.Perform(p,1e-6);
    const r=cl.State()===occt.TopAbs_State.TopAbs_IN;p.delete();cl.delete();return r;},q);
  const etat=()=>page.evaluate(()=>{const el=doc.cgeo.find(c=>c.orj),f=doc.features.find(x=>x.orj),r=doc.features.find(x=>x.orjRing);
    return el&&f?{mode:el.orj.mode,O:el._orjOut,err:(f._err||'')+(r&&r._err||''),ring:!!r,bodies:doc.bodies.length,
      mat:r?(doc.bodies.find(b=>b.id===r.body)||{}).mat:null,sel:sel.id===f.id}:null;});
  const pret=()=>page.waitForFunction(()=>doc.features.some(f=>f.orj)&&rebuildDepth===0);
  const bouton=page.getByRole('button',{name:'Joint',exact:true}).first();
  await expect(bouton).toBeVisible();

  // ── Arbre Ø30, clic au sommet à x = 30 : gorge 3,6 × 2 centrée là, joint 25,07 × 2,62 étiré de 3,7 % ──
  let E=await scene([rond('A',15)],[plein('A',80)],[120,-110,90],[40,0,0],[30,0,15]);
  await bouton.click();
  expect(await page.evaluate(()=>holeFacePick&&holeFacePick.which)).toBe('cylOrj');
  await page.mouse.click(E.x,E.y);
  await pret();
  let S=await etat();
  expect([S.mode,S.O.b,S.O.t,S.O.d1,S.O.d2,S.O.dash,S.err,S.ring,S.bodies,S.mat,S.sel]).toEqual(['shaft',3.6,2,25.07,2.62,120,'',true,2,'caoutchouc',true]);
  expect(Math.abs(S.O.pos-30)).toBeLessThan(0.6);
  const xc=S.O.pos; // gorge centrée sur le clic
  expect(await inside([xc+1.7,0,13.2])).toBe(false); // gorge vide à côté du joint
  expect(await inside([xc+2.2,0,14])).toBe(true);   // hors gorge : matière
  expect(await inside([xc,0,12.8])).toBe(true);     // sous le fond Ø26
  expect(await inside([xc,0,14])).toBe(true);       // le joint dans la gorge
  await expect(page.locator('text=AS568-120').first()).toBeVisible();
  // vrai réglage : section 3,53 → gorge 4,8 × 2,7, joint d'un autre rang
  await page.locator('.pnl-row',{hasText:'Section d2'}).locator('select').selectOption('3.53');
  await page.waitForFunction(()=>doc.cgeo.find(c=>c.orj)._orjOut.d2===3.53&&rebuildDepth===0);
  S=await etat();
  expect([S.O.b,S.O.t,S.O.d1]).toEqual([4.8,2.7,23.39]);
  // quadrilobe (X-ring) : mêmes joints AS568, gorge Minnesota Rubber 3,94 × 3,1 ; profil à 4 lobes
  await page.locator('.pnl-row',{hasText:'Type de joint'}).locator('select').selectOption('x');
  await page.waitForFunction(()=>doc.cgeo.find(c=>c.orj).orj.kind==='x'&&rebuildDepth===0);
  S=await etat();
  expect([S.O.b,S.O.t,S.O.d1,S.err]).toEqual([3.94,3.1,23.39,'']);
  expect(await page.evaluate(()=>doc.features.find(f=>f.orjRing).name)).toBe('Joint quadrilobe 23,39 × 3,53');
  {
    const d2=3.53,yc=S.O.pos,xc=15-3.1+d2/2; // section au fond de la gorge (Ø fond 23,8, joint étiré)
    expect(await inside([yc,0,xc])).toBe(true);                       // cœur
    expect(await inside([yc+0.28*d2,0,xc+0.28*d2])).toBe(true);       // lobe (coin)
    expect(await inside([yc,0,xc+d2/2-0.06])).toBe(false);            // creux au milieu d'un côté
    expect(await inside([yc+d2/2-0.06,0,xc])).toBe(false);
  }
  await page.locator('button.fdynOk').click();

  // ── Moyeu Ø80 percé Ø30 : clic sur la paroi intérieure → gorge dans l'alésage, joint 29,82 × 2,62 ──
  E=await scene([rond('H',40),rond('B',15,[-1,0,0])],[plein('H',40),plein('B',42,'cut')],[-130,0,42],[20,0,0],[20,0,-15]);
  await bouton.click();
  await page.mouse.click(E.x,E.y);
  await pret();
  S=await etat();
  expect([S.mode,S.O.b,S.O.t,S.O.d1,S.err]).toEqual(['bore',3.6,2,29.82,'']);
  const yb=S.O.pos;
  expect(await inside([yb+1.7,0,-16.8])).toBe(false); // gorge creusée jusqu'à Ø34
  expect(await inside([yb,0,-17.2])).toBe(true);       // matière au-delà du fond
  await page.locator('button.fdynOk').click();

  // ── Bride Ø80 percée Ø20, face plane à x = 20 : gorge axiale, joint contre la paroi extérieure ──
  E=await scene([rond('H',40),rond('B',10,[-1,0,0])],[plein('H',20),plein('B',22,'cut')],[90,-60,50],[20,0,0],[20,0,-25]);
  await bouton.click();
  await page.mouse.click(E.x,E.y);
  await pret();
  S=await etat();
  expect([S.mode,S.O.d1,S.O.d2,S.O.b,S.O.t,S.err]).toEqual(['face',47.22,3.53,5,2.7,'']);
  expect(await inside([19.5,0,-(S.O.ri+0.2)])).toBe(false); // gorge vide côté intérieur
  expect(await inside([19.5,0,-(S.O.ro+0.3)])).toBe(true);  // paroi extérieure
  expect(await inside([17,0,-(S.O.ri+S.O.ro)/2])).toBe(true); // sous le fond (profondeur 2,7)
  // supprimer la gorge emporte le joint, son corps et le repère caché
  await page.evaluate(()=>{const f=doc.features.find(x=>x.orj);delFeature(f);markDirty();rebuild();renderTree();renderProps();});
  await page.waitForFunction(()=>rebuildDepth===0);
  expect(await page.evaluate(()=>[doc.features.length,doc.bodies.length,doc.cgeo.length,doc.sketches.length])).toEqual([2,1,0,2]);

  // ── Échap ──
  await bouton.click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>holeFacePick)).toBeFalsy();

  // ── Plaque CARRÉE 100 × 100 percée Ø40 : le cercle est un TROU, la gorge l'entoure (pas dedans) ──
  const carre={id:'skQ',name:'Q',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
    points:{a:{x:-50,y:-50},b:{x:50,y:-50},c:{x:50,y:50},d:{x:-50,y:50}},
    entities:[{id:'e1',t:'line',p1:'a',p2:'b'},{id:'e2',t:'line',p1:'b',p2:'c'},{id:'e3',t:'line',p1:'c',p2:'d'},{id:'e4',t:'line',p1:'d',p2:'a'}],
    constraints:[],dims:[],seq:10,visible:false};
  const trou={id:'skT',name:'T',plane:'XY',origin:[0,0,-1],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{c:{x:0,y:0}},
    entities:[{id:'e1',t:'circle',pc:'c',r:20}],constraints:[],dims:[],seq:10,visible:false};
  E=await scene([carre,trou],[{id:'FQ',type:'extrude',name:'Q',sketchId:'skQ',distance:10,op:'add',visible:true},
    {id:'FT',type:'extrude',name:'T',sketchId:'skT',distance:12,op:'cut',visible:true}],[60,-80,90],[20,0,10],[36,0,10]);
  await bouton.click();
  await page.mouse.click(E.x,E.y);
  await pret();
  S=await etat();
  expect([S.mode,S.O.Din,S.O.D,S.err,S.O.warn]).toEqual(['face',40,100,'','']);
  expect(S.O.ri).toBeGreaterThan(20.5); // portée entre le trou et la gorge
  expect(S.O.ro).toBeLessThan(30);
  expect(await inside([0,-(S.O.ri+0.2),9])).toBe(false); // gorge creusée autour du trou (côté vide, joint contre la paroi ext.)
  expect(await inside([0,-(S.O.ri-0.3),9])).toBe(true); // portée gardée entre le trou et la gorge
  // joint CENTRÉ dans la gorge par défaut : même jeu des deux côtés
  expect((S.O.ri+S.O.ro)/2).toBeCloseTo((S.O.d1+S.O.d2)/2,6);
  // Ø visé saisi (centré) : joint normalisé au Ø moyen le plus proche de 60, gorge centrée sur lui
  const dwIn=()=>page.locator('.pnl-row',{hasText:/Ø du joint visé|Ø d’appui/}).locator('input');
  await dwIn().fill('60');await dwIn().press('Enter');
  await page.waitForFunction(()=>doc.cgeo.find(c=>c.orj)._orjOut.Dw===60&&rebuildDepth===0);
  S=await etat();
  expect(Math.abs(S.O.d1+S.O.d2-60)).toBeLessThan(1.7);
  expect((S.O.ri+S.O.ro)/2).toBeCloseTo((S.O.d1+S.O.d2)/2,6);
  // contre une paroi, pression intérieure : paroi extérieure à Ø60, Ø ext. du joint 1 à 3 % au-dessus
  await page.locator('.pnl-row',{hasText:'Joint dans la gorge'}).locator('select').selectOption('wall');
  await page.waitForFunction(()=>doc.cgeo.find(c=>c.orj).orj.place==='wall'&&rebuildDepth===0);
  S=await etat();
  expect(S.O.ro).toBeCloseTo(30,6);
  expect((S.O.d1+2*S.O.d2)/60-1).toBeGreaterThanOrEqual(0.01-1e-9);
  expect((S.O.d1+2*S.O.d2)/60-1).toBeLessThanOrEqual(0.03);
  // ⌖ puis vrai clic sur l'arête du trou, côté face du dessus : Ø d'appui = 40, pression extérieure (paroi intérieure)
  await page.locator('.pnl-row',{hasText:/^Pression/}).locator('select').selectOption('ext');
  await page.waitForFunction(()=>rebuildDepth===0);
  await page.locator('.pnl-row',{hasText:'Ø d’appui'}).locator('button',{hasText:'⌖'}).click();
  const A=await page.evaluate(()=>{const v=new THREE.Vector3(0,-20,10).project(camera),r=renderer.domElement.getBoundingClientRect();
    return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};});
  await page.mouse.click(A.x,A.y);
  await page.waitForFunction(()=>{const el=doc.cgeo.find(c=>c.orj);return el.orj.eref&&el._orjOut.Dw>0&&rebuildDepth===0;});
  S=await etat();
  expect([S.O.Dw,S.O.ri]).toEqual([40,20]);
  expect(S.O.d1).toBeLessThanOrEqual(40/1.01+1e-9);
  await page.locator('button.fdynOk').click();

  // ── Normalisés : le joint seul ──
  expect(await page.evaluate(()=>{const sp=stdSpec('oring',{cs:'1.78',size:'9.25'});return [sp.name,stdDoc(sp).features.map(f=>f.type).join()];}))
    .toEqual(['Joint torique 9,25 × 1,78','revolve']);
  expect(await page.evaluate(()=>{const sp=stdSpec('oring',{kind:'x',cs:'2.62',size:'20.29'});return [sp.name,sp.key,stdDoc(sp).features.map(f=>f.type).join()];}))
    .toEqual(['Joint quadrilobe 20,29 × 2,62','XRING|20.29|2.62','revolve']);
  expect(err).toEqual([]);
});
