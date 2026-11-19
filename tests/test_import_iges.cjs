// V0.99.32 : import IGES (.igs / .iges), par le même chemin que le STEP.
// Un IGES écrit en faces libres (cas courant) doit revenir en SOLIDE cousu, volume exact ;
// le format est reconnu au contenu (rejeu, ouverture, corps dérivés) ; un X_T (Parasolid)
// est refusé avec un message clair ; un fichier .igs qui n'en est pas un aussi.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  if(typeof sandbox.btoa!=='function')sandbox.btoa=globalThis.btoa;
  if(typeof sandbox.atob!=='function')sandbox.atob=globalThis.atob;
  if(typeof sandbox.TextEncoder!=='function')sandbox.TextEncoder=globalThis.TextEncoder;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(m){(window.__al=window.__al||[]).push(String(m));};window.confirm=function(){return true;};showAll=function(){};applyView=function(){};',ctx);
  // IGES de test : un bloc 60×40×20 et un cylindre Ø20×30 à part (2 solides), écrits en faces
  sandbox.__iges=vm.runInContext(`(function(){
    const b=new occt.BRepPrimAPI_MakeBox_2(new occt.gp_Pnt_3(0,0,0),60,40,20);
    const ax=new occt.gp_Ax2_3(new occt.gp_Pnt_3(100,0,0),new occt.gp_Dir_4(0,0,1));
    const c=new occt.BRepPrimAPI_MakeCylinder_3(ax,10,30);
    const w=new occt.IGESControl_Writer_1();
    w.AddShape(b.Shape());w.AddShape(c.Shape());w.ComputeModel();
    if(!w.Write('/__t.igs'))return null;
    const u=occt.FS.readFile('/__t.igs');try{occt.FS.unlink('/__t.igs');}catch(e){}
    [w,b,c,ax].forEach(o=>{try{o.delete();}catch(e){}});
    return Uint8Array.from(u).buffer;
  })()`,ctx);
  if(!sandbox.__iges){console.log('  ✗ IGES de test impossible à produire');process.exit(1);}
  const o=await vm.runInContext(`(async()=>{
    const out={};
    const u8=new Uint8Array(__iges);
    out.reconnu=importIsIges(u8);
    out.stepPasIges=!importIsIges(new TextEncoder().encode('ISO-10303-21;\\nHEADER;'+' '.repeat(200)));
    // solides avant tout : le shape lu, sans import
    const sh=importReadShape(u8);
    const E=occt.TopAbs_ShapeEnum;let nSol=0,vol=0;
    const ex=new occt.TopExp_Explorer_2(sh,E.TopAbs_SOLID,E.TopAbs_SHAPE);
    for(;ex.More();ex.Next()){const s=occSolidCur(ex);const gp=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(s,gp,false,false,false);vol+=gp.Mass();nSol++;gp.delete();s.delete();}
    ex.delete();sh.delete();
    out.nSol=nSol;out.vol=+vol.toFixed(1);out.last=importIgesSolidify.last;
    // import réel
    window.__al=[];
    await importSTEP({name:'pieces.igs',arrayBuffer:async()=>__iges});
    const f=doc.features.find(x=>x.type==='import');
    out.import=!!(f&&f._mesh);out.fmt=f&&f.src&&f.src.fmt;
    out.brep=!!(f&&importGeom.get(f.id)&&importGeom.get(f.id).brep);
    out.msg=String(faceEl.textContent||'');
    out.al0=(window.__al||[]).length;
    out.id=f&&f.id;
    // enregistrer puis rouvrir sur une machine vierge
    const bundle=await bundleSerialise();
    doc.features=[];markDirty();rebuild();docUndoStack.length=0;docRedoStack.length=0;importHydrate();importSrc.clear();
    occt=__realOcct;occtReady=true;
    await bundleRestore(bundle,{name:'reouvert'});
    for(let i=0;i<20&&_importRestoring;i++)await new Promise(r=>setTimeout(r,10));
    const g=doc.features.find(x=>x.type==='import');
    out.revenu=!!(g&&g.id===out.id&&g._mesh&&importGeom.get(g.id)&&importGeom.get(g.id).brep);
    // faux .igs : message explicite, rien n'est ajouté
    window.__al=[];const n0=doc.features.length;
    await importSTEP({name:'faux.igs',arrayBuffer:async()=>new TextEncoder().encode('pas un iges').buffer});
    out.fauxMsg=(window.__al||[]).join(' | ');
    out.fauxRien=doc.features.length===n0;
    return out;
  })()`,ctx);
  console.log('=== V0.99.32 : import IGES ===');
  console.log('  '+JSON.stringify(o));
  A(o.reconnu,'IGES reconnu à son contenu (colonne 73 = S)');
  A(o.stepPasIges,'un STEP n\'est pas pris pour un IGES');
  A(o.nSol===2,'faces libres cousues en 2 solides ('+o.nSol+')');
  const V=60*40*20+Math.PI*100*30;
  A(Math.abs(o.vol-V)<V*1e-3,'volume des solides cousus = '+o.vol+' mm³ (attendu '+V.toFixed(1)+')');
  A(o.import&&o.fmt==='iges'&&o.brep,'import : fonction, source « iges », solide exact gardé');
  A(/IGES importé/.test(o.msg)&&/2 solide/.test(o.msg),'message : « IGES importé … 2 solide(s) » ('+o.msg+')');
  A(o.al0===0,'aucune alerte à l\'import');
  A(o.revenu,'réouverture : l\'IGES revient (même id, affiché, solide exact)');
  A(/ne ressemble pas à un IGES/.test(o.fauxMsg)&&o.fauxRien,'faux .igs : refus explicite, rien ajouté');
  console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
