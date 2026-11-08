// V0.70.4 : Barquette, Symétrie double. Dans un nom de congé « congé[A|B] », un miroir inverse l'ordre des faces.
// Le nom de la copie était jugé faux à chaque ⟳ Régénérer et oublié : la copie du congé R8 du coin −X +Y se
// recalait sur l'image du clic, prenait une arête voisine de 7,7 mm et échouait. Les quatre coins doivent rester
// identiques après l'ouverture comme après Régénérer.
// Lancé seul : node tests/test_rep_nom_ordre.cjs
const vm=require('vm'),path=require('path');
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;sandbox.__txt=lire(path.join(__dirname,'fixtures','barquette-symetrie-double.conceptcad'));
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
  const R=String.raw`
    const out={};
    const fm={ex_89_mw3txyv7:'ex_28_mw3ylnuq',sw_25_mw3yjwbe:'sw_31_mw3ylnur'};
    out.ordre=repNomCopieOk('congé[ex_28_mw3ylnuq/e1/cercle/flanc#2|ex_3_mvz6umhd/e5/flanc]#1|sw_31_mw3ylnur/e26/flanc',
      'congé[ex_3_mvz6umhd/e5/flanc|ex_89_mw3txyv7/e1/cercle/flanc]#1|sw_25_mw3yjwbe/e26/flanc',fm);
    out.faux=repNomCopieOk('congé[ex_3_mvz6umhd/e5/flanc|ex_89_mw3txyv7/e1/cercle/flanc]#1|sw_25_mw3yjwbe/e26/flanc',
      'congé[ex_3_mvz6umhd/e5/flanc|ex_89_mw3txyv7/e1/cercle/flanc]#1|sw_25_mw3yjwbe/e26/flanc',fm);
    const quarts=()=>[[1,1],[-1,1],[1,-1],[-1,-1]].map(([sx,sy])=>{
      const b=new occt.BRepPrimAPI_MakeBox_4(new occt.gp_Pnt_3(sx>0?0.5:-500,sy>0?0.5:-500,-500),499.5,499.5,1000).Shape();
      const c=occCommon(occLive.shape,b);const v=c?occCoqueVolume(c):0;occFree(c);occFree(b);return v;});
    const alertes=()=>doc.features.filter(f=>f.type==='xfillet'&&f.repeatId==='rp_27_mw3ylnup').map(f=>f.id+':'+(f._err||'')).filter(s=>!/:$/.test(s));
    await bundleRestore(__txt,{name:'banc'});occt=__realOcct;occtReady=true;markDirty();rebuild();
    out.ouvre=quarts();out.aOuvre=alertes();
    repGenAll();freshHard=true;occCkClear();markDirty();rebuild();
    out.regen=quarts();out.aRegen=alertes();
    out.nom34=(doc.features.find(f=>f.id==='xf_34_mw3ylnur').edges[0].nom)||'';
    return out;`;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  const fails=[],A=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)fails.push(m);};
  const ecart=q=>Math.max(...q)-Math.min(...q);
  console.log('=== Barquette : Symétrie double, ordre des faces dans le nom ===');
  A(o.ordre===true,'1 : nom de copie aux faces inversées accepté');
  A(o.faux===false,'2 : nom resté sur les fonctions source refusé');
  A(ecart(o.ouvre)<2,'3 : ouverture : quatre coins identiques ('+o.ouvre.map(v=>v.toFixed(2)).join(' ')+')');
  A(ecart(o.regen)<2,'4 : après Régénérer : quatre coins identiques ('+o.regen.map(v=>v.toFixed(2)).join(' ')+')');
  A(!o.aOuvre.length&&!o.aRegen.length,'5 : aucun congé copié en erreur '+JSON.stringify(o.aOuvre.concat(o.aRegen)));
  A(/sw_31_mw3ylnur/.test(o.nom34),'6 : la copie du coin −X +Y garde son nom ('+o.nom34+')');
  if(fails.length){console.log('\n*** '+fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
