// Champs de valeurs : une valeur saisie reste, et le clic qui suit la saisie n'est pas perdu.
// Dans un vrai navigateur : le clic perdu tient à l'ordre appui → enregistrement → panneau redessiné → relâché,
// que les tests VM ne voient pas.
'use strict';
const {test,expect}=require('@playwright/test');

const champ=page=>page.locator('#props input[type=text]').first();
const valider=page=>page.locator('#props button',{hasText:'Valider'});
const taper=async(page,txt)=>{await champ(page).click();await page.keyboard.press('Control+a');await page.keyboard.type(txt);};
const plan=page=>page.evaluate(()=>{const c=doc.cgeo[0];return {p:c.p,z:c.fr.o[2]};});
const ferme=page=>page.waitForFunction(()=>!cgMode&&rebuildDepth===0);

test.beforeEach(async({page})=>{
  await page.goto('/ConceptCAD.html');
  await page.waitForFunction(()=>typeof occtReady!=='undefined'&&occtReady===true,null,{timeout:200000});
  await page.waitForFunction(()=>!skEdit&&rebuildDepth===0);
  await page.evaluate(()=>{cgStart('plane');cgRefAccept({k:'o',id:'XY'});});
});

test('valeur tapée puis UN clic sur Valider : le plan est posé à cette distance',async({page})=>{
  await taper(page,'25,5');
  await valider(page).click();
  await ferme(page);
  const r=await plan(page);
  expect(r.p.d).toBe(25.5);
  expect(r.z).toBe(25.5);
  expect(Object.keys(r.p).filter(k=>k[0]==='_')).toEqual([]);
});

test('valeur tapée puis clic sur une case : valeur gardée et case cochée',async({page})=>{
  await taper(page,'30');
  await page.locator('#props input[type=checkbox]').first().click();
  await expect.poll(()=>page.evaluate(()=>cgMode.draft.p)).toMatchObject({d:30,flip:true});
  await expect(champ(page)).toHaveValue('30');
});

test('valeur tapée puis clic sur un plan de l’arbre : valeur gardée et référence prise',async({page})=>{
  await page.evaluate(()=>{cgMode.draft.refs[0]=null;cgMode.slot=0;cgRefresh();});
  await taper(page,'44');
  await page.locator('.tnode',{hasText:'Plan XZ'}).first().click();
  await expect.poll(()=>page.evaluate(()=>cgMode.draft.refs[0]&&cgMode.draft.refs[0].id)).toBe('XZ');
  expect(await page.evaluate(()=>cgMode.draft.p.d)).toBe(44);
});

test('valeur nommée : le plan rouvert accepte une nouvelle valeur sous le même nom',async({page})=>{
  await taper(page,'Dist = 30');
  await page.keyboard.press('Enter');
  await valider(page).click();
  await ferme(page);
  await page.evaluate(()=>cgEdit(doc.cgeo[0].id));
  await expect(champ(page)).toHaveValue('Dist = 30');
  // traverser le champ sans rien changer : le nom reste affiché
  await champ(page).click();
  await page.locator('#props .pnl-h').first().click();
  await expect(champ(page)).toHaveValue('Dist = 30');
  await taper(page,'Dist = 35');
  await page.keyboard.press('Enter');
  await expect(champ(page)).toHaveValue('Dist = 35');
  await valider(page).click();
  await ferme(page);
  const r=await plan(page);
  expect(r.p.d).toBe(35);
  expect(r.p.pname.d).toBe('Dist');
  expect(r.z).toBe(35);
});

test('X, Tab, Y, Tab, Z : les trois valeurs d’un point sont gardées',async({page})=>{
  await page.evaluate(()=>{cgCancel();cgStart('point');});
  await taper(page,'1');
  await page.keyboard.press('Tab');
  await expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll('#props input[type=text]')].indexOf(document.activeElement))).toBe(1);
  await page.keyboard.type('2');
  await page.keyboard.press('Tab');
  await expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll('#props input[type=text]')].indexOf(document.activeElement))).toBe(2);
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>cgMode.draft.p)).toMatchObject({dx:1,dy:2,dz:3});
});

test('la distance d’un plan survit à l’enregistrement et à la réouverture du fichier',async({page})=>{
  await taper(page,'Dist = 12,5');
  await page.keyboard.press('Enter');
  await valider(page).click();
  await ferme(page);
  await page.evaluate(async()=>{await deserialise(serialise());});
  await page.waitForFunction(()=>rebuildDepth===0&&(doc.cgeo||[]).length===1);
  const r=await plan(page);
  expect(r.p.d).toBe(12.5);
  expect(r.p.pname.d).toBe('Dist');
  expect(r.z).toBe(12.5);
});
