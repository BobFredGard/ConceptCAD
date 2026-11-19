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
    const b0=new occt.BRepPrimAPI_MakeBox_2(new occt.gp_Pnt_3(0,0,0),60,40,20);
    // V0.99.37 : bloc percé Ø10 de part en part — le trou doit pouvoir être supprimé après import
    const axT=new occt.gp_Ax2_3(new occt.gp_Pnt_3(30,20,-5),new occt.gp_Dir_4(0,0,1));
    const t=new occt.BRepPrimAPI_MakeCylinder_3(axT,5,30);
    const b=new occt.BRepAlgoAPI_Cut_3(b0.Shape(),t.Shape(),new occt.Message_ProgressRange_1());
    const ax=new occt.gp_Ax2_3(new occt.gp_Pnt_3(100,0,0),new occt.gp_Dir_4(0,0,1));
    const c=new occt.BRepPrimAPI_MakeCylinder_3(ax,10,30);
    const w=new occt.IGESControl_Writer_1();
    // faces planes du bloc écrites en B-splines (comme SolidWorks) : elles doivent revenir planes
    const bs=occt.ShapeCustom.ConvertToBSpline(b.Shape(),false,false,false,true);
    w.AddShape(bs);w.AddShape(c.Shape());w.ComputeModel();
    if(!w.Write('/__t.igs'))return null;
    const u=occt.FS.readFile('/__t.igs');try{occt.FS.unlink('/__t.igs');}catch(e){}
    [w,b,c,ax,b0,axT,t,bs].forEach(o=>{try{o.delete();}catch(e){}});
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
    out.nSol=nSol;out.vol=+vol.toFixed(1);out.last=importIgesSolidify.last;out.ana=importIgesAnalytic.last;
    // V0.99.37 : surfaces vraies (plans, cylindres) et trou supprimable
    {const sh2=importReadShape(u8);const k={};let trou=null;
     const fe=new occt.TopExp_Explorer_2(sh2,E.TopAbs_FACE,E.TopAbs_SHAPE);
     for(;fe.More();fe.Next()){const f=occFaceCur(fe);const t=occSurfKind(f);k[t]=(k[t]||0)+1;const bx=occFaceBox(f);
       if(!trou&&t==='Cylinder'&&bx&&Math.abs(bx.pos[0]-30)<0.1&&Math.abs(bx.pos[1]-20)<0.1)trou=f;else f.delete();}
     fe.delete();out.kinds=k;
     const exs=new occt.TopExp_Explorer_2(sh2,E.TopAbs_SOLID,E.TopAbs_SHAPE);let blocV=null;
     for(;exs.More()&&trou;exs.Next()){const so=occSolidCur(exs);let y=false;{const fx=new occt.TopExp_Explorer_2(so,E.TopAbs_FACE,E.TopAbs_SHAPE);for(;fx.More();fx.Next()){const c=fx.Current();if(c.IsSame(trou))y=true;c.delete();}fx.delete();}
       if(y){
       try{const r=occDeleteFacesOnce(so,[trou]);const gp=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(r,gp,false,false,false);blocV=+gp.Mass().toFixed(1);gp.delete();r.delete();}catch(e){blocV=String(e.message||e);}}
       so.delete();}
     exs.delete();if(trou)trou.delete();sh2.delete();out.trouSuppr=blocV;}
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
    // V0.99.33 : « pièce à assembler » — un composant neuf qui porte l'import, mode Placer
    window.__al=[];
    asmCtxDraw=function(){};asmDraw=function(){};asmFit=function(){};asmFill=function(){}; // pas de vue 3D réelle ici
    const rootDoc=doc,nRoot=doc.features.length;
    const okA=await importAsComponent({name:'pieces.igs',arrayBuffer:async()=>__iges});
    const cp=asm&&asm.comps.find(c=>c.name==='pieces');
    const fi=cp&&cp.doc.features.find(x=>x.type==='import');
    const occA=cp&&asmComp(asm.root).occ.find(o=>o.comp===cp.id);
    out.asm={ok:okA,comp:!!cp,imp:!!(fi&&fi._mesh&&fi.src&&fi.src.fmt==='iges'),occ:!!occA,sel:!!(occA&&asmSelId===occA.id),
      mode:asmMode,racineIntacte:asmComp(asm.root).doc===rootDoc&&rootDoc.features.length===nRoot,dx:occA&&occA.fr.o[0],al:(window.__al||[]).length,
      msg:String(faceEl.textContent||'')};
    // enregistré puis rouvert : le composant revient avec son import
    {
      const b2=await bundleSerialise();
      asm=null;doc.features=[];markDirty();rebuild();docUndoStack.length=0;docRedoStack.length=0;importHydrate();importSrc.clear();importGeom.clear();
      occt=__realOcct;occtReady=true;
      await bundleRestore(b2,{name:'reouvert2'});
      for(let i=0;i<40&&_importRestoring;i++)await new Promise(r=>setTimeout(r,10));
      const c2=asm&&asm.comps.find(c=>c.name==='pieces'),f2=c2&&c2.doc.features.find(x=>x.type==='import');
      out.asm.revenu=!!(f2&&f2._mesh&&importGeom.get(f2.id)&&importGeom.get(f2.id).brep);
    }
    // import refusé en pièce à assembler : aucun composant vide ne reste
    const nC=asm.comps.length;
    await importAsComponent({name:'faux.igs',arrayBuffer:async()=>new TextEncoder().encode('pas un iges').buffer});
    out.asm.refusPropre=asm.comps.length===nC;
    // question posée à l'import : « Nouveau corps » par défaut hors mode Placer
    let q=null;mffAsk=async(m,b)=>{q={m,b};return 'cancel';};
    asmMode='part';await importAskWhere('x.step');out.askPart=q&&q.b.find(x=>x[2])[0];
    asmMode='asm';await importAskWhere('x.step');out.askAsm=q&&q.b.find(x=>x[2])[0];
    return out;
  })()`,ctx);
  console.log('=== V0.99.32-33 : import IGES, pièce à assembler ===');
  console.log('  '+JSON.stringify(o));
  A(o.reconnu,'IGES reconnu à son contenu (colonne 73 = S)');
  A(o.stepPasIges,'un STEP n\'est pas pris pour un IGES');
  A(o.nSol===2,'faces libres cousues en 2 solides ('+o.nSol+')');
  const V=60*40*20-Math.PI*25*20+Math.PI*100*30;
  A(Math.abs(o.vol-V)<V*1e-3,'volume des solides cousus = '+o.vol+' mm³ (attendu '+V.toFixed(1)+')');
  A(o.kinds&&!Object.keys(o.kinds).some(k=>!/^(Plane|Cylinder)$/.test(k))&&(o.ana&&o.ana.nPlan>=6),'surfaces vraies : seulement des plans et des cylindres, B-splines planes remises en plans ('+JSON.stringify(o.kinds)+', '+JSON.stringify(o.ana)+')');
  A(o.trouSuppr===48000,'trou Ø10 supprimable après import : bloc plein 48000 mm³ ('+o.trouSuppr+')');
  A(o.import&&o.fmt==='iges'&&o.brep,'import : fonction, source « iges », solide exact gardé');
  A(/IGES importé/.test(o.msg)&&/2 solide/.test(o.msg),'message : « IGES importé … 2 solide(s) » ('+o.msg+')');
  A(o.al0===0,'aucune alerte à l\'import');
  A(o.revenu,'réouverture : l\'IGES revient (même id, affiché, solide exact)');
  A(/Import IGES impossible.*ne ressemble pas à un IGES/.test(o.fauxMsg)&&o.fauxRien,'faux .igs : refus explicite, rien ajouté');
  const S=o.asm||{};
  A(S.ok&&S.comp&&S.imp&&S.occ,'pièce à assembler : composant « pieces » neuf, avec son import IGES et son occurrence');
  A(S.mode==='asm'&&S.sel,'pièce à assembler : retour en mode Placer, occurrence sélectionnée');
  A(S.racineIntacte,'pièce à assembler : la pièce d\'origine n\'a pas reçu de corps');
  // position à droite de l'existant : boîtes THREE factices ici, vérifiée dans le navigateur
  A(S.revenu,'pièce à assembler : revient avec son import après enregistrement et réouverture');
  A(S.refusPropre,'pièce à assembler refusée (fichier illisible) : aucun composant vide ne reste');
  A(o.askPart==='body'&&o.askAsm==='asm','question à l\'import : « Nouveau corps » par défaut, « Pièce à assembler » en mode Placer');
  console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
