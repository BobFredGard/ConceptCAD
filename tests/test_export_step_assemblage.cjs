// Export STEP de tout l'assemblage visible : à la racine, le bouton STEP répondait « Solide vide »
// (occFinalShape ne lit que le document actif, la racine n'a pas de solide propre). Noyau réel,
// VRAI clic et VRAI pré-test ; le fichier écrit est relu, chaque solide contrôlé :
//   A. racine, vue d'assemblage : occurrences répétées, tournée, sous-ensemble ; masquées absentes ;
//   B. racine, mode Modéliser : même résultat, au lieu de « Solide vide » ;
//   C. pièce en cours de modélisation : elle seule, à sa place d'origine (comportement d'avant) ;
//   D. pièce seule sans assemblage : comportement d'avant ;
//   E. composant fait d'un STEP importé seul dans son corps ;
//   F. Exemples/Engrenages.conceptcad, s'il est là (6 solides valides aux bonnes positions).
// Lancer sur les deux moteurs : node tests/test_export_step_assemblage.cjs (ancien) ;
// node tests/test_export_step_assemblage.cjs (OCCT 8).
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs'),lireProjet=require('./lire-projet.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  // géométrie minimale (comme test_export_step_import) : userData.impOcc doit survivre à l'import
  const T0=sandbox.THREE;
  class BG{constructor(){this.attributes={};this.userData={};this.index=null;}
    setAttribute(n,a){this.attributes[n]=a;return this;} getAttribute(n){return this.attributes[n];}
    setIndex(i){this.index=i;return this;} computeVertexNormals(){} computeBoundingBox(){} computeBoundingSphere(){} dispose(){}
    clone(){const g=new BG();g.attributes=this.attributes;return g;}}
  class F32{constructor(a,n){this.array=Float32Array.from(a);this.itemSize=n;this.count=this.array.length/n;}}
  sandbox.THREE=new Proxy({},{get(t,k){if(k==='BufferGeometry')return BG;if(k==='Float32BufferAttribute')return F32;
    if(k==='Mesh')return function(g,m){const o=new T0.Mesh();o.geometry=g;if(m)o.material=m;return o;};return T0[k];}});
  sandbox.__realOcct=real;
  const E=path.join(ROOT,'Exemples','Engrenages.conceptcad');
  const pointeur=fs.existsSync(E)&&fs.readFileSync(E).slice(0,40).toString().indexOf('git-lfs')>=0;
  sandbox.__engrenages=fs.existsSync(E)&&!pointeur?lireProjet(E):null;
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);
    occt=__realOcct;occtReady=true;confirm=function(){return true;};showAll=function(){};
    const AL=[];alert=function(m){AL.push(String(m));};window.alert=alert;
    stepAskSchema=async function(){return 'AP214';};
    let wrote=[],dl=null;const _w=occWriteStep;
    occWriteStep=function(s,p,c){const b=_w(s,p,c);wrote.push(b);return b;};
    Blob=class{constructor(parts){this.parts=parts;}};
    URL={createObjectURL:function(){return 'blob:t';},revokeObjectURL:function(){}};
    const _ce=document.createElement.bind(document);
    document.createElement=function(t){const n=_ce(t);if(String(t).toLowerCase()==='a')n.click=function(){dl=n.download;};return n;};
    const relire=b=>{ // solides du fichier : validité, volume, centre
      occt.FS.writeFile('/rl.stp',b);const rd=new occt.STEPControl_Reader_1();rd.ReadFile('/rl.stp');rd.TransferRoots();
      const sh=rd.OneShape();const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_SOLID,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
      const L=[];
      while(ex.More()){const s=ex.Current(),c=new occt.BRepCheck_Analyzer(s,true),vc=asmVolCom(s);
        L.push({ok:c.IsValid_2(),v:vc.v,c:vc.c});try{c.delete();}catch(e){}ex.Next();}
      try{ex.delete();rd.delete();sh.delete();occt.FS.unlink('/rl.stp');}catch(e){}
      return L;
    };
    const clic=async()=>{AL.length=0;wrote=[];dl=null;
      await $('btnExportStep').onclick();
      return wrote.length===1?relire(wrote[0]):[];};
    // Chaque solide attendu [v,x,y,z] trouvé une fois, et rien d'autre
    const memes=(L,att)=>{
      if(L.length!==att.length||!L.every(s=>s.ok))return false;
      const rest=L.slice();
      return att.every(a=>{const i=rest.findIndex(s=>near(s.v,a[0],0.5)&&near(s.c[0],a[1])&&near(s.c[1],a[2])&&near(s.c[2],a[3]));
        if(i<0)return false;rest.splice(i,1);return true;});
    };
    const dire=L=>L.map(s=>(s.ok?'':'INVALIDE ')+s.v.toFixed(1)+'@'+s.c.map(v=>v.toFixed(2)).join(',')).join(' | ');
    const sq=(id,x0,y0,x1,y1)=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
      points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false});
    const deux=()=>{
      docResetEmpty();doc.name='Banc';
      doc.sketches=[sq('skA',-20,-20,20,20),sq('skB',50,-5,60,5)];
      doc.bodies=[{id:'b1',name:'Socle',c:null},{id:'b2',name:'Colonne',c:null}];doc.bodySeq=3;doc.activeBody='b1';
      doc.features=[{id:'F1',type:'extrude',name:'Socle',sketchId:'skA',distance:20,op:'add',visible:true,body:'b1'},
                    {id:'F2',type:'extrude',name:'Colonne',sketchId:'skB',distance:50,op:'add',visible:true,body:'b2'}];
      ensureBodies();markDirty();rebuild();
    };
    const fr=(o,x,y)=>({o,x:x||[1,0,0],y:y||[0,1,0],z:[0,0,1]});
    // ── D. pièce seule, sans assemblage (avant d'en créer un) ──
    deux();
    let L=await clic();
    A(memes(L,[[32000,0,0,10],[5000,55,0,25]])&&!AL.length&&dl==='Banc.step','D : pièce multicorps sans assemblage : ses 2 corps, fichier Banc.step ('+dire(L)+' '+AL.join(' ')+' '+dl+')');
    // ── l'assemblage ──
    const res=asmCompsFromBodies(['b1','b2']);markDirty();rebuild();
    const S=res.made[0].comp,C=res.made[1].comp,rootId=asm.root;
    asmAddOcc(C.id,fr([100,0,0]),rootId);
    asmAddOcc(C.id,fr([0,200,0],[0,1,0],[-1,0,0]),rootId); // quart de tour autour de Z
    const cache=asmAddOcc(C.id,fr([999,0,0]),rootId);cache.visible=false;
    const SE=asmNewComp('Sous-ensemble',rootId);
    asmAddOcc(C.id,fr([0,0,100]),SE.comp.id);
    SE.occ.fr=fr([0,300,0]);
    asmAddOcc(SE.comp.id,fr([777,0,0]),rootId).visible=false; // sous-ensemble masqué : son contenu aussi
    const attendu=[[32000,0,0,10],[5000,55,0,25],[5000,155,0,25],[5000,0,255,25],[5000,55,300,125]];
    // ── B. racine, mode Modéliser ──
    A(asmMode==='part'&&asm.active===rootId,'B : racine, mode Modéliser');
    L=await clic();
    A(memes(L,attendu)&&!AL.length,'B : racine sans solide propre : 5 solides placés, au lieu de « Solide vide » ('+dire(L)+' '+AL.join(' ')+')');
    A(asm.active===rootId&&doc===asmRoot().doc,'B : retour au composant actif');
    // ── A. racine, vue d'assemblage ──
    asmMode='asm'; // la scène du banc n'a pas de vue d'assemblage (asmDraw) : on pose le mode
    A(asmMode==='asm'&&asm.active===rootId,'A : vue d’assemblage à la racine');
    L=await clic();
    A(memes(L,attendu)&&!AL.length,'A : 5 solides valides aux bonnes positions, masqués absents ('+dire(L)+' '+AL.join(' ')+')');
    A(dl===asmRoot().name+'.step','A : fichier au nom de l’assemblage ('+dl+')');
    A(asmMode==='asm'&&asm.active===rootId&&doc===asmRoot().doc,'A : on reste à la racine, en vue d’assemblage');
    // pièce masquée après coup, puis tout masqué
    const oS=asmRoot().occ.find(o=>o.comp===S.id);oS.visible=false;
    L=await clic();
    A(memes(L,attendu.slice(1)),'A : socle masqué : absent du fichier ('+dire(L)+')');
    const vis=asmRoot().occ.map(o=>o.visible);asmRoot().occ.forEach(o=>{o.visible=false;});
    L=await clic();
    A(!wrote.length&&AL.length===1&&/Solide vide/.test(AL[0]),'A : tout masqué : « Solide vide », aucun fichier');
    asmRoot().occ.forEach((o,i)=>{o.visible=vis[i];});oS.visible=true;
    // ── C. une pièce en cours de modélisation ──
    asmMode='part';asmActivate(C.id);
    A(asmMode==='part'&&doc===C.doc,'C : colonne en cours de modélisation');
    L=await clic();
    A(memes(L,[[5000,55,0,25]])&&!AL.length,'C : la pièce seule, à sa place d’origine ('+dire(L)+')');
    A(dl===C.doc.name+'.step','C : fichier au nom de la pièce ('+dl+')');
    asmActivate(rootId);
    // inspection : les STEP seuls restent hors de ses calculs (inchangée), solides affichés intacts
    const r=asmInspectRun();
    A(r&&near(r.total.v,32000+4*5000,0.5),'inspection inchangée après export ('+(r&&r.total.v.toFixed(1))+' mm³)');
    asmInspectClear();
    // ── E. composant fait d'un STEP importé seul dans son corps ──
    docResetEmpty();doc.name='ImportBanc';
    const bx=new occt.BRepPrimAPI_MakeBox_2(new occt.gp_Pnt_3(0,0,0),10,20,30);bx.Build();
    const pas=_w([bx.Shape()],'/__box.stp','AP214',false);try{bx.delete();occt.FS.unlink('/__box.stp');}catch(e){}
    const u8=Uint8Array.from(pas);
    await importSTEP({name:'boite.step',arrayBuffer:async()=>u8.buffer});
    occt=__realOcct;occtReady=true;
    const fi=doc.features.find(x=>x.type==='import');
    A(!!fi&&importGeom.get(fi.id),'E : STEP importé');
    const bid=(fi.body&&doc.bodies.some(e=>e.id===fi.body))?fi.body:doc.bodies[0].id;
    const res2=asmCompsFromBodies([bid]);markDirty();rebuild();
    const I=res2.made[0].comp;
    asmAddOcc(I.id,fr([100,0,0]),asm.root);
    L=await clic();
    A(memes(L,[[6000,5,10,15],[6000,105,10,15]])&&!AL.length,'E : STEP importé, placé deux fois ('+dire(L)+' '+AL.join(' ')+')');
    // ── F. Exemples/Engrenages.conceptcad ──
    if(__engrenages){
      await deserialise(__engrenages);occt=__realOcct;occtReady=true;
      asmMode='asm';
      A(asm.active===asm.root,'F : Engrenages ouvert à la racine');
      L=await clic();
      A(L.length===6&&L.every(s=>s.ok&&s.v>0)&&!AL.length,'F : Engrenages : 6 solides valides ('+dire(L)+' '+AL.join(' ')+')');
      // les roues tournent autour de l'origine de leur occurrence (centre décalé seulement par la rainure)
      const roues=asmRoot().occ.filter(o=>!/Crémaillère/.test(o.name));
      A(roues.length===5&&roues.every(o=>{const k=L.findIndex(s=>Math.hypot(s.c[0]-o.fr.o[0],s.c[1]-o.fr.o[1])<2);if(k<0)return false;L.splice(k,1);return true;})&&L.length===1,'F : 5 roues centrées sur leur occurrence, reste la crémaillère');
      const o=asmRoot().occ.find(o=>/Crémaillère/.test(o.name));
      A(L.length===1&&o&&L[0].c[0]>o.fr.o[0]-1&&near(L[0].c[2],10,1),'F : crémaillère à sa place, Z milieu de denture ('+dire(L)+')');
    }else out.log.push('F : Engrenages.conceptcad '+(${pointeur}?'en pointeur LFS':'absent de cette version')+' : contrôle sauté');
    return out;
  `;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Export STEP de l’assemblage visible ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
