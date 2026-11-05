// ConceptCAD.html ouvert par double-clic (file://) : le navigateur refuse le noyau. La page le dit et
// renvoie vers ce qui marche ; elle ne tente aucun chargement du noyau et ne se replie pas en silence.
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');

const HTML=path.join(__dirname,'..','..','ConceptCAD.html');

test('double-clic : message clair, aucun noyau chargé',async({page})=>{
  const noyau=[],err=[];
  page.on('request',r=>{if(/occt\//.test(r.url()))noyau.push(r.url());});
  page.on('pageerror',e=>err.push(e.message));
  await page.goto('file:///'+HTML.split(path.sep).join('/'));
  const ecran=page.locator('#occtDoubleClic');
  await expect(ecran).toBeVisible();
  await expect(ecran).toContainText('ne peut pas démarrer par double-clic');
  await expect(ecran).toContainText('ConceptCAD-autonome.html');
  await expect(ecran).toContainText('Server.bat');
  await expect(ecran.locator('a[href="http://localhost:3000"]')).toBeVisible();
  await expect(ecran.locator('a[href="https://bobfredgard.github.io/ConceptCAD/"]')).toBeVisible();
  // L'écran couvre bien toute la page : rien n'est cliquable dessous
  const couvre=await page.evaluate(()=>document.elementFromPoint(innerWidth/2,innerHeight-5).closest('#occtDoubleClic')!==null);
  expect(couvre).toBe(true);
  const etat=await page.evaluate(()=>({pret:occtReady,msg:occBaseMsg}));
  expect(etat.pret).toBe(false);
  expect(etat.msg).toContain('ConceptCAD-autonome.html');
  expect(noyau).toEqual([]);
  expect(err).toEqual([]);
});
