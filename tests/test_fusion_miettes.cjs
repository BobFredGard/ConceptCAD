// MIETTES D'UNE FUSION, sur le vrai noyau OCCT. Barquette, épaisseur 4 → 3,3 : le renfort posé pile sur une
// face laissait deux solides de volume nul à côté de la pièce ; la fusion suivante, sur ce composé, rendait
// un volume nul et la pièce s'effondrait. Les miettes partent ; les vrais corps séparés restent.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const body=String.raw`
    const boite=(x,d)=>new occt.BRepPrimAPI_MakeBox_2(new occt.gp_Pnt_3(x,0,0),d,d,d).Shape();
    const compte=s=>{const so=occSubShapes(s,'TopAbs_SOLID');const n=so.length;occDispose(so);return n;};
    const out={};
    const avec=occSansMiettes(occCompoundOf([boite(0,10),boite(50,0.1),boite(80,0.1)])); // 0,001 mm³ chacune
    out.miettes={n:compte(avec),v:occShapeVolume(avec)};
    const deux=occSansMiettes(occCompoundOf([boite(0,10),boite(50,5),boite(80,0.1)]));
    out.deux={n:compte(deux),v:occShapeVolume(deux)};
    const seule=boite(0,10);
    out.seule=occSansMiettes(seule)===seule;
    const separes=occCompoundOf([boite(0,10),boite(50,5)]);
    out.separes=occSansMiettes(separes)===separes;
    return out;`;
  const o=await vm.runInContext('(async()=>{'+body+'})()',ctx);
  const near=(a,b)=>Math.abs(a-b)<1e-3;
  console.log('=== Miettes d’une fusion (noyau OCCT réel) ===');
  A(o.miettes.n===1&&near(o.miettes.v,1000),'deux miettes retirées : '+JSON.stringify(o.miettes));
  A(o.deux.n===2&&near(o.deux.v,1125),'une miette retirée, les deux vrais corps gardés : '+JSON.stringify(o.deux));
  A(o.seule,'un solide unique n’est pas touché');
  A(o.separes,'des corps séparés sans miette ne sont pas touchés');
  console.log(ko?'ÉCHEC : '+ko:'OK');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
