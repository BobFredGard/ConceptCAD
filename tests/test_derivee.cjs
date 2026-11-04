// V0.47.0 : Dérivée (52-derivee.js) — paramètres et corps venus d'un autre fichier, noyau réel,
// dossier de projets SIMULÉ en mémoire. Le lien va dans un seul sens : la source n'est jamais
// réécrite, et ce qu'on ajoute à un corps dérivé dans le fichier récepteur survit à ses mises à jour.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=`
    const P=[];const ATT=[];const att=(ok,msg)=>{P.push((ok?'  ✓ ':'  ✗ ')+msg);if(!ok)ATT.push(msg);};
    alert=function(m){P.push('  alerte : '+m);};confirm=function(){return true;};showAll=function(){};
    const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
    // ── dossier de projets en mémoire ──
    const FS={};let writes=0;
    const mkFile=p=>({kind:'file',name:p.split('/').pop(),_p:p,
      async getFile(){if(!(p in FS))throw new Error('NotFound');return {name:p.split('/').pop(),text:async()=>FS[p]};},
      async createWritable(){let buf='';return {write:async t=>{buf=t;},close:async()=>{FS[p]=buf;writes++;}};},
      async queryPermission(){return 'granted';},async requestPermission(){return 'granted';},
      async isSameEntry(o){return !!o&&o._p===p;}});
    const mkDir=pre=>({kind:'directory',
      async getDirectoryHandle(n){return mkDir(pre+n+'/');},
      async getFileHandle(n){const q=pre+n;if(!(q in FS))throw new Error('NotFound');return mkFile(q);},
      async resolve(h){return h&&h._p&&h._p.startsWith(pre)?h._p.slice(pre.length).split('/'):null;},
      async queryPermission(){return 'granted';},async requestPermission(){return 'granted';}});
    mffFolder=mkDir('');
    // ── géométrie : une boîte d'esquisse extrudée ──
    const skBox=(id,x0,y0,w,h)=>{const L=(i,a,b)=>({id:i,t:'line',p1:a,p2:b});
      const s={id,name:id,plane:'XY',visible:true,points:{O:{x:0,y:0},p0:{x:x0,y:y0},p1:{x:x0+w,y:y0},p2:{x:x0+w,y:y0+h},p3:{x:x0,y:y0+h}},
        entities:[L('e0','p0','p1'),L('e1','p1','p2'),L('e2','p2','p3'),L('e3','p3','p0')],constraints:[],dims:[],seq:50};
      ensureSketchBasis(s);return s;};
    const extr=(id,sk,dist,op,body)=>({id,type:'extrude',name:id,sketchId:sk,distance:dist,op:op||'add',visible:true,body});
    const vol=sh=>{const G=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(sh,G,false,false,false);const v=G.Mass();G.delete();return v;};
    const bodyVol=bid=>{occStepForce=true;try{builtVersion=-1;builtHash=null;markDirty();rebuild();}finally{occStepForce=false;}
      const b=bodies.find(x=>x.bodyId===bid&&x.shape);return b?vol(b.shape):NaN;};
    // ── SOURCE : des paramètres et une broche 10 × 10 × 30, plus un second corps ──
    const ecrireSource=(lg,cote)=>{
      docResetEmpty();doc.name='Cotes';
      doc.params=[{name:'Entraxe',expr:String(cote),value:cote},{name:'Jeu',expr:'0,2',value:0.2}];
      doc.bodies=[{id:'b1',name:'Broche',c:null,open:true},{id:'b2',name:'Socle',c:null,open:true}];doc.bodySeq=3;doc.activeBody='b1';
      doc.sketches=[skBox('sa',10,10,10,10),skBox('sb',100,100,5,5)];
      doc.features=[extr('fa','sa',lg,'add','b1'),extr('fb','sb',5,'add','b2')];
      FS['Cotes.conceptcad']=serialise();
    };
    ecrireSource(30,40);
    const srcAvant=FS['Cotes.conceptcad'];
    // ── RÉCEPTEUR : un bloc 50 × 50 × 20 ──
    docResetEmpty();doc.name='Bloc';
    doc.bodies=[{id:'b1',name:'Bloc',c:null,open:true}];doc.bodySeq=2;doc.activeBody='b1';
    doc.params=[{name:'Jeu',expr:'1',value:1}]; // même nom que dans la source
    doc.sketches=[skBox('s1',0,0,50,50)];doc.features=[extr('f1','s1',20,'add','b1')];
    builtVersion=-1;rebuild();
    att(near(bodyVol('b1'),50000,1),'0 : bloc de départ 50 000 mm³');
    // ── ce que propose la source ──
    {const t=derTree(JSON.parse(FS['Cotes.conceptcad']));const B=derBodies(t),Pr=derReadParams(t.comps[0].doc);
      att(B.map(x=>x.name).join()==='Broche,Socle','1 : les deux corps sont proposés ('+B.map(x=>x.name).join()+')');
      att(Pr.map(x=>x.name).sort().join()==='Entraxe,Jeu','2 : les paramètres sont proposés');}
    // ── dériver paramètres et un corps ──
    const r=await derInsert(mkFile('Cotes.conceptcad'),FS['Cotes.conceptcad'],'Cotes.conceptcad',{params:['Entraxe','Jeu'],bodies:['#b1'],auto:true});
    const L=doc.derive[0],fB=doc.features.find(f=>f.id===r.features[0]);
    att(L&&L.rel==='Cotes.conceptcad'&&!L.key,'3 : lien par chemin dans le dossier de projets');
    att(parValueNow('Entraxe')===40,'4 : paramètre dérivé utilisable');
    att(L.params.find(p=>p.src==='Jeu').name==='Jeu_2'&&parValueNow('Jeu')===1&&near(parValueNow('Jeu_2'),0.2),'5 : nom déjà pris : suffixe, le paramètre local reste intact');
    att(fB&&fB.type==='import'&&fB.derive&&fB.body!=='b1','6 : corps dérivé dans un corps neuf');
    const bO=fB.body;
    att(near(bodyVol(bO),3000,1),'7 : volume du corps dérivé 3 000 mm³ ('+bodyVol(bO).toFixed(1)+')');
    // ── une cote pilotée par le paramètre dérivé ──
    doc.params.push({name:'Double',expr:'Entraxe*2',value:0});parApplyAll();
    att(doc.params.find(p=>p.name==='Double').value===80,'8 : expression sur un paramètre dérivé');
    // ── soustraction : le corps dérivé devient l'outil ──
    const cb={id:'cb1',type:'combine',name:'Soustraction',body:'b1',tools:[bO],mode:'cut',keep:false,visible:true};
    doc.features.push(cb);
    att(near(bodyVol('b1'),50000-2000,1),'9 : soustraction : bloc − broche sur 20 mm de haut ('+bodyVol('b1').toFixed(1)+')');
    att(!bodies.some(b=>b.kind==='import'&&b.bodyId===bO),'10 : le corps outil consommé ne s affiche plus');
    // ── la source change : tout suit ──
    const srcEdit=fn=>{const o=JSON.parse(FS['Cotes.conceptcad']);fn(o);FS['Cotes.conceptcad']=JSON.stringify(o,null,2);};
    const setParam=(o,n,v)=>{const q=o.params.find(x=>x.name===n);q.expr=String(v);q.value=v;};
    const setLg=(o,v)=>{o.features.find(f=>f.id==='fa').distance=v;};
    writes=0;
    srcEdit(o=>{setParam(o,'Entraxe',55);setLg(o,10);});
    let c=await derCheck(false);
    att(c.updated.length===1&&parValueNow('Entraxe')===55,'11 : paramètre suivi (55)');
    att(doc.params.find(p=>p.name==='Double').value===110,'12 : expression recalculée (110)');
    att(near(bodyVol('b1'),50000-1000,1),'13 : la soustraction suit la nouvelle forme ('+bodyVol('b1').toFixed(1)+')');
    att(writes===0,'14 : la source n est jamais réécrite');
    // ── changement sans effet sur le corps : la forme garde sa clé ──
    const k0=fB.src.key;
    srcEdit(o=>{o.name='Cotes bis';});
    c=await derCheck(false);
    att(fB.src.key===k0&&!c.updated.length,'15 : rien de neuf pour ce corps : pas de rejeu');
    c=await derCheck(false);
    att(!c.updated.length&&!c.warn.length,'16 : deuxième vérification : rien à faire');
    // ── MODIFIER un corps dérivé dans le fichier récepteur : gardé à la mise à jour ──
    const r2=await derInsert(mkFile('Cotes.conceptcad'),FS['Cotes.conceptcad'],'Cotes.conceptcad',{params:[],bodies:['#b2']});
    att(doc.derive.length===1,'17 : même source : même lien');
    const fS=doc.features.find(f=>f.id===r2.features[0]),bS=fS.body;
    att(near(bodyVol(bS),125,0.5),'18 : Socle dérivé 125 mm³');
    doc.sketches.push(skBox('s2',100,100,5,5));
    doc.features.push(Object.assign(extr('f2','s2',-3,'add',bS),{name:'Bossage ajouté ici'}));
    const v1=bodyVol(bS);
    att(near(v1,125+75,0.5),'19 : fonction ajoutée au corps dérivé dans le récepteur ('+v1.toFixed(1)+')');
    srcEdit(o=>{o.features.find(f=>f.id==='fb').distance=9;});
    await derCheck(false);
    const v2=bodyVol(bS);
    att(near(v2,225+75,0.5),'20 : source changée : la modification locale est gardée ('+v2.toFixed(1)+')');
    att(doc.features.some(f=>f.id==='f2'),'21 : la fonction ajoutée est toujours là');
    // ── enregistrer et rouvrir le récepteur ──
    const txt=serialise();
    await deserialise(txt);
    att(doc.derive&&doc.derive.length===1&&doc.derive[0].rel==='Cotes.conceptcad','22 : lien relu du fichier');
    att(parValueNow('Entraxe')===55,'23 : valeur relue sans la source');
    await importRestorePending();
    att(near(bodyVol(bS),225+75,0.5),'24 : corps dérivé et modification relus ('+bodyVol(bS).toFixed(1)+')');
    att(near(bodyVol('b1'),50000-1000,1),'24b : soustraction relue : elle ne se perd pas à la réouverture ('+bodyVol('b1').toFixed(1)+')');
    const fRe=doc.features.find(f=>f.id===fS.id);
    att(fRe&&fRe.derive&&fRe.src.sig===fS.src.sig,'25 : fonction dérivée relue');
    // ── mini-liste : noms et valeurs ──
    const rows=parMiniRows();
    att(rows.some(x=>x.name==='Entraxe'&&x.val==='55'&&x.link)&&rows.some(x=>x.name==='Double'&&x.val==='110'&&!x.link),'26 : mini-liste : paramètres et valeurs');
    // ── une valeur dérivée ne se règle pas par une configuration ──
    att(cfgSetExpr('Entraxe','1')===false,'27 : paramètre dérivé non modifiable ici');
    // ── paramètre et corps disparus de la source ──
    srcEdit(o=>{o.params=o.params.filter(q=>q.name!=='Entraxe');o.features=o.features.filter(f=>f.id!=='fb');});
    c=await derCheck(false);
    const Ln=doc.derive[0];
    att(Ln.st==='warn'&&/Entraxe/.test(Ln.msg)&&/Socle/.test(Ln.msg),'28 : disparus de la source : signalé ('+Ln.msg+')');
    att(parValueNow('Entraxe')===55&&near(bodyVol(bS),225+75,0.5),'29 : dernière valeur et dernière forme gardées');
    // ── source introuvable ──
    const sauve=FS['Cotes.conceptcad'];delete FS['Cotes.conceptcad'];
    c=await derCheck(false);
    att(c.warn.length===1&&doc.derive[0].st==='warn','30 : source introuvable : signalé, rien de cassé');
    FS['Cotes.conceptcad']=sauve;
    // ── rompre ──
    derBreak(doc.derive[0]);
    att(!(doc.derive||[]).length&&doc.params.some(p=>p.name==='Entraxe'&&p.value===55),'31 : rompre : la valeur devient un paramètre d ici');
    att(!doc.features.some(f=>f.derive)&&near(bodyVol(bS),225+75,0.5),'32 : rompre : le corps garde sa forme');
    docUndo();
    att(doc.derive&&doc.derive.length===1&&doc.features.some(f=>f.derive),'33 : Ctrl+Z rétablit le lien');
    // ── source en assemblage : le corps arrive à sa place dans l'assemblage ──
    const sauveDoc=doc;
    const piece={name:'Pce',sketches:[skBox('sp',0,0,10,10)],features:[extr('fp','sp',10,'add','b1')],bodies:[{id:'b1',name:'Cube',c:null,open:true}],bodySeq:2,activeBody:'b1',cgeo:[],params:[]};
    const racine={name:'Asm',sketches:[],features:[],bodies:[{id:'b1',name:'Corps 1',c:null,open:true}],bodySeq:2,activeBody:'b1',cgeo:[],params:[]};
    const topA=serialiseObj(racine,false);
    topA.asm={v:2,name:'Asm',root:'r',active:'r',path:[],mode:'part',comps:[
      {id:'r',kind:'comp',name:'Asm',doc:null,occ:[{id:'o1',comp:'c1',name:'Pce:1',fr:{o:[200,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]},fixed:true,visible:true,align:null}],link:null},
      {id:'c1',kind:'comp',name:'Pce',doc:serialiseObj(piece,false),occ:[],link:null}]};
    FS['Asm.conceptcad']=JSON.stringify(topA);
    const tA=derTree(topA),BA=derBodies(tA);
    att(BA.length===1&&BA[0].name==='Pce:1 › Cube','34 : corps d un composant proposé ('+BA.map(x=>x.name).join()+')');
    const r3=await derInsert(mkFile('Asm.conceptcad'),FS['Asm.conceptcad'],'Asm.conceptcad',{params:[],bodies:[BA[0].key]});
    const eA=importGeom.get(r3.features[0]),bx=new occt.Bnd_Box_1();occt.BRepBndLib.Add(eA.brep,bx,false);
    const xmin=bx.CornerMin().X();bx.delete();
    att(near(xmin,200,0.01),'35 : placé comme dans l assemblage (x = '+xmin.toFixed(3)+')');
    att(doc===sauveDoc,'36 : le document courant n a pas changé');
    return {ATT,P,FS:Object.keys(FS),srcAvant:!!srcAvant};
  `;
  const res=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log(res.P.join('\n'));
  process.exit(res.ATT.length?1:0);
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
