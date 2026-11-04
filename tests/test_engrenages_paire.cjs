// Paire d'engrenages sur les SOLIDES RÉELS (plan docs/plan-engrenages-niveau-1.md, tâches 7.4 et 8) : plusieurs minutes,
// donc en suite complète seulement ; le calcul et les coupes sont dans test_engrenages.cjs (suite rapide).
//  · intersection exacte sur 12 positions d'un pas : droite, hélicoïdale, couronne, crémaillère ; rapprocher de 0,3 mm doit se voir ;
//  · Exemples/Engrenages.conceptcad : se recharge, passe l'Inspection, s'exporte en STEP, se réimporte en solides valides.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    const pLab=c=>c[0]+' m'+c[1]+' α'+c[2]+' Z'+c[3]+'/'+c[4]+(c[5]?' β'+c[5]+c[6]:'')+(c[7]||c[8]?' x'+c[7]+'/'+c[8]:'');
    const pOf=(c,jn)=>gearPair({kind:c[0],m:c[1],alpha:c[2],z1:c[3],z2:c[4],beta:c[5],hand:c[6],x1:c[7],x2:c[8],b:10,jn});
    // ── 6g. intersection réelle des solides sur tout un pas ──
    const VOLC=(a,b)=>{const c=new occt.BRepAlgoAPI_Common_3(a,b);c.Build();if(!c.IsDone())throw new Error('intersection impossible');const G=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(c.Shape(),G,false,false,false);const v=Math.abs(G.Mass());G.delete();c.delete();return v;};
    const placeS=(s,F)=>{const t=asmTrsf(F),b=new occt.BRepBuilderAPI_Transform_2(s,t,true);return b.Shape();};
    [['ext',2,20,12,18,0,'R',0.4,0.2],['ext',2,20,12,18,15,'R',0.4,0.2],['int',2,20,12,30,0,'R',0.3,0],['int',2,20,12,30,15,'R',0.3,0],['rack',2,20,12,9,0,'R',0.4,0],['rack',2,20,12,9,15,'R',0.4,0]].forEach(c=>{
      const Q=pOf(c,0.1),lab=pLab(c),bin=[],s1=gearSolid(Object.assign({type:'gear'},Q.o1),bin),s2=gearSolid(Object.assign({type:'gear'},Q.o2),bin),step=2*Math.PI/Q.g1.z;
      const t0=Date.now();let vm=0,err='';
      for(let i=0;i<12;i++){
        const R=Q.roll(step*i/12);
        try{vm=Math.max(vm,VOLC(placeS(s1,R.fr1),placeS(s2,R.fr2)));}catch(e){err=e.message||String(e);}
      }
      A(!err&&vm<1e-6,lab+' : volume commun nul sur 12 positions d’un pas ('+vm.toExponential(1)+' mm³, '+(Date.now()-t0)+' ms)'+(err?' '+err:''));
      // le même contrôle voit bien une faute : pignon rapproché de 0,3 mm
      const R=Q.roll(0),F=Object.assign({},R.fr1,{o:[R.fr1.o[0]+(c[0]==='rack'?0:c[0]==='int'?0.3:0.3),R.fr1.o[1]-(c[0]==='rack'?0.3:0),0]});
      A(VOLC(placeS(s1,F),placeS(s2,R.fr2))>1e-3,lab+' : rapproché de 0,3 mm, le volume commun apparaît');
    });
    out;
  `;
  const res=vm.runInContext(R,ctx);
  // ── 8. l'exemple : se recharge, passe l'inspection, s'exporte en STEP, se réimporte en solides valides ──
  const EX=path.join(ROOT,'Exemples','Engrenages.conceptcad'),exB=fs.existsSync(EX)?fs.readFileSync(EX):null;
  if(!exB||exB.slice(0,40).toString().indexOf('git-lfs')>=0)console.log('  (Engrenages.conceptcad absent ou pointeur LFS : partie exemple sautée — git lfs checkout)');
  else{
    sandbox.__ex=require('zlib').gunzipSync(exB).toString('utf8');
    const r8=await vm.runInContext(String.raw`(async()=>{
      const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
      showAll=function(){};await deserialise(__ex);occt=__realOcct;occtReady=true;
      const oc=asmRoot().occ;
      A(oc.length===6&&doc.name!=='','E1 : l’exemple se recharge : 3 paires, 6 pièces');
      asmBuildSnapshots();
      const I=asmInspectRun();
      A(I&&I.items.length===6,'E2 : 6 solides exacts ('+(I?I.items.length:0)+')');
      A(I&&I.inter.length===0,'E3 : l’Inspection de l’application ne trouve aucune interférence ('+(I?I.inter.length:'?')+')');
      // l'Inspection a libéré ses copies : on replace les formes exactes, comme elle
      const base=asmActiveComp(),inst=asmInstances(base.id),E=asmExactCollect([...new Set(inst.map(i=>i.comp))]),placed=[];
      inst.forEach(i=>(E.get(i.comp)||[]).forEach(b=>placed.push(asmPlaced(b.shape,i.F))));
      // noms des faces (V0.50.0) : aucune face de pièce sans nom, aucun doublon
      let sans=0,dbl=0,nF=0;
      inst.forEach(i=>(E.get(i.comp)||[]).forEach(b=>{const T=nomsDe(b.shape),m=nomsCarteFaces(b.shape),N=m?m.Size():0,vus=new Set();nF+=N;
        for(let k=0;k<N;k++){const n=T?T.f[k]:null;if(!n)sans++;else{if(vus.has(n))dbl++;vus.add(n);}}try{m.delete();}catch(e){}}));
      A(nF>0&&sans===0&&dbl===0,'E6 : chaque face a un nom unique ('+nF+' faces, '+sans+' sans nom, '+dbl+' en double)');
      const bytes=occWriteStep(placed,'/g.stp','AP214',false);
      occt.FS.writeFile('/g2.stp',bytes);
      const rd=new occt.STEPControl_Reader_1();rd.ReadFile('/g2.stp');rd.TransferRoots();const sh=rd.OneShape();
      const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_SOLID,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
      let n=0,vT=0,valid=true;
      while(ex.More()){n++;const so=ex.Current();const c=new occt.BRepCheck_Analyzer(so,true);if(!c.IsValid_2())valid=false;vT+=Math.abs(asmVolCom(so).v);ex.Next();}
      const v0=I.items.reduce((a,x)=>a+Math.abs(x.v),0);
      A(n===6&&valid,'E4 : STEP réimporté : 6 solides valides ('+n+', '+Math.round(bytes.length/1024)+' Ko)');
      A(Math.abs(vT-v0)<v0*1e-3,'E5 : même volume après l’aller-retour STEP ('+Math.round(vT)+' / '+Math.round(v0)+' mm³)');
      return out;
    })()`,ctx);
    res.log.push(...r8.log);res.fails.push(...r8.fails);
  }
  res.log.forEach(l=>console.log('  ok  '+l));
  res.fails.forEach(l=>console.log('  KO  '+l));
  console.log(res.fails.length?'✗ '+res.fails.length+' échec(s)':'✓ engrenages, solides réels : '+res.log.length+' contrôles');
  process.exit(res.fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
