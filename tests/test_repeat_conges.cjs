// CONGÉS ET RÉPÉTITION sur le vrai noyau OCCT. Retour utilisateur (Barquette) : « impossible de répéter
// les congés à la fin ou alors de les passer sur la répétition ».
// 1) La source a été emportée par son esquisse depuis le clic : la copie doit partir de l'endroit où la
//    source EST (pos), pas de l'image du clic (pos0), sinon elle prend une autre arête.
// 2) Une copie enregistrée sur une mauvaise arête (fichier ancien) est réparée à l'ouverture.
// 3) Un congé posé à la main va dans le corps de l'arête cliquée, même si le corps actif est masqué.
// Lancé seul : node tools/ci-moteur.cjs occt/v3 -- tests/test_repeat_conges.cjs
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  if(!real.NCollection_IndexedDataMap_TopoDS_Shape_NCollection_List_TopoDS_Shape_TopTools_ShapeMapHasher){console.log('=== Congés et répétition : noyau sans noms, sauté ===');console.log('*** TOUT PASSE ***');return;}
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const body=String.raw`
    const out={};
    const mesure=()=>{occCkClear();markDirty();rebuild();const FR=occFinalShape(null);
      const v=occShapeVolume(FR.shape);try{occCleanup(FR,null);}catch(e){}return v;};
    const rect=(sk,x0,y0,x1,y1)=>{
      [[x0,y0],[x1,y0],[x1,y1],[x0,y1]].forEach((q,i)=>{sk.points['q'+i]={x:q[0],y:q[1]};});
      for(let i=0;i<4;i++)sk.entities.push({id:'L'+i,t:'line',p1:'q'+i,p2:'q'+((i+1)%4)});
    };
    const mk=(id,z)=>({id,name:id,plane:'FACE',origin:[0,0,z],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[],visible:false});
    // bloc 200 × 100 × 20, encoche 10 de large et 10 de haut dans le flanc y = -50, en x = 40..50 ;
    // congé R1 sur le bord entre le fond de l'encoche et le flanc, ancré sur le contour du BLOC : hors de
    // la répétition, comme le congé R3,3 de Barquette
    const init=()=>{
      const b=mk('sk_b',0),p=mk('sk_p',20);rect(b,-100,-50,100,50);rect(p,40,-60,50,-30);
      doc.sketches=[b,p];doc.cgeo=[];doc.bodies=[];occCkClear();tlMark=null;
      doc.features=[
        {id:'ex_b',type:'extrude',name:'Bloc',sketchId:'sk_b',op:'add',distance:20,visible:true},
        {id:'ex_p',type:'extrude',name:'Poche',sketchId:'sk_p',op:'cut',distance:-10,visible:true},
        {id:'xf_s',type:'xfillet',name:'Congé',visible:true,tangent:false,edges:[{pos:[45,-50,10],pos0:[45,-50,10],r:1,len:10,anchor:{t:'e',sk:'sk_b',id:'L0',z:10,side:1,dist:20,far:0},name:'A',seed:1}]},
      ];
    };
    const lit=e=>({x:+e.pos[0].toFixed(2),y:+e.pos[1].toFixed(2),z:+e.pos[2].toFixed(2),len:+(+e.len).toFixed(2),nom:e.nom||''});
    // ── 1) la copie part de la position réelle de la source
    init();
    const v0=(()=>{const k=doc.features.splice(1);const v=mesure();doc.features.push(...k);return v;})();
    const v1=mesure();
    out.source=lit(doc.features.find(f=>f.id==='xf_s').edges[0]);
    // l'esquisse a été déplacée depuis le clic : pos0 périmé de 45 mm, la source se retrouve par son nom.
    // L'image de ce clic dans la copie tombe plus près de l'encoche voisine que de la sienne.
    doc.features.find(f=>f.id==='xf_s').edges[0].pos0=[90,-50,10];
    const rp={id:'rp1',type:'repeat',name:'Linéaire',mode:'lin',q:1,copies:2,dist:-60,axis:'X',base:['ex_p','xf_s'],children:[],visible:true};
    doc.features.push(rp);repGenChildren(rp);
    const v3=mesure();
    const copies=()=>doc.features.filter(f=>f.repeatId==='rp1'&&f.type==='xfillet');
    out.copies=copies().map(f=>({err:f._err||'',e:lit(f.edges[0])}));
    out.vol={v0,v1,v3};
    // ── 2) stable : une régénération ne change plus rien
    repGenChildren(rp);out.stable=mesure();
    // ── 3) nom : pur, indépendant du noyau
    const fm={ex_p:'ex_q'};
    out.nomBon=repNomCopieOk('ex_q/L0/flanc|ex_b/haut','ex_p/L0/flanc|ex_b/haut#1',fm);
    out.nomMorceau=repNomCopieOk('ex_q/L0/flanc#2|ex_b/haut#1#1','ex_p/L0/flanc|ex_b/haut',fm);
    out.nomFaux=repNomCopieOk('ex_b/L0/flanc|ex_b/haut','ex_p/L0/flanc|ex_b/haut',fm);
    out.nomHors=repNomCopieOk('ex_b/L2/flanc|ex_b/haut','ex_b/L0/flanc|ex_b/haut',fm);
    // ── 4) mauvais nom enregistré dans une copie : détecté à l'ouverture, oublié, puis réparé
    const src=doc.features.find(f=>f.id==='xf_s').edges[0];
    const cible=copies()[0];
    cible.edges[0].nom='ex_b/L0/flanc|ex_b/haut';cible.edges[0].nomDe=src.nom;
    out.detecte=!repNomCopieOk(cible.edges[0].nom,src.nom,{ex_p:doc.features.find(f=>f.repeatId==='rp1'&&f.repIndex===cible.repIndex&&f.type==='extrude').id});
    repReparation=true;repGenChildren(rp);repReparation=false; // ce que fait l'ouverture d'un fichier
    out.apres=lit(copies()[0].edges[0]);
    out.volRepare=mesure();
    out.nomApres=copies()[0].edges[0].nom||'';
    out.cloneId=doc.features.find(f=>f.repeatId==='rp1'&&f.repIndex===copies()[0].repIndex&&f.type==='extrude').id;
    // ── 5) congé à la main : corps de l'arête cliquée, pas le corps actif masqué
    init();doc.features.pop();
    doc.bodies=[{id:'b1',name:'Pièce',c:null},{id:'b2',name:'Intérieur',c:null}];doc.bodySeq=3;
    doc.features[0].body='b1';doc.features[1].body='b1';
    const b2=mk('sk_b2',100);rect(b2,-10,-10,10,10);doc.sketches.push(b2);
    doc.features.push({id:'ex_2',type:'extrude',name:'Autre',sketchId:'sk_b2',op:'add',distance:20,visible:true,body:'b2',newBody:'b2'});
    doc.activeBody='b2';doc.bodyVis={b2:false};
    const vA=mesure();
    const m=[45,-50,10];
    out.xCorps=xCorpsDesAretes([{pos:m}]);
    out.xCorps2=xCorpsDesAretes([{pos:[10,0,120]}]);
    out.xAucun=xCorpsDesAretes([{pos:[999,0,0]}]);
    filModeX={sel:[{pos:m.slice(),r:1,len:10,anchor:null,name:'A'}],seeds:[],edges:[],tang:[],radius:1,tangent:false,kind:'fillet',editing:null};
    applyExactFillet();
    const nf=doc.features[doc.features.length-1];
    out.main={type:nf.type,body:nf.body,err:nf._err||''};
    out.vMain=mesure();out.vA=vA;
    return out;`;
  const o=await vm.runInContext('(async()=>{'+body+'})()',ctx);
  const near=(a,b,t)=>a!=null&&Math.abs(a-b)<=(t||1e-3)*Math.max(1,Math.abs(b));
  console.log('=== Congés et répétition (noyau OCCT réel) ===');
  A(o.source.x===45&&o.source.len===10,'congé source au fond de l’encoche : x = '+o.source.x+', '+o.source.len+' mm');
  A(o.copies.length===2,'2 copies du congé : '+o.copies.length);
  const xs=o.copies.map(c=>c.e.x).sort((a,b)=>b-a);
  A(xs[0]===-15&&xs[1]===-75,'chaque copie suit SA poche, malgré un clic d’origine périmé : x = '+xs.join(' ; ')+' (attendu -15 ; -75)');
  A(o.copies.every(c=>c.e.len===10&&c.e.z===10&&c.e.y===-50),'même arête que la source : '+o.copies.map(c=>c.e.len+' mm').join(', '));
  A(o.copies.every(c=>!c.err),'aucun congé copié en erreur '+o.copies.map(c=>c.err).join(' '));
  const un=o.vol.v0-o.vol.v1;
  A(un>0&&near(o.vol.v0-o.vol.v3,3*un),'3 poches + congés identiques : '+(o.vol.v0-o.vol.v3).toFixed(2)+' mm³ = 3 × '+un.toFixed(2));
  A(near(o.stable,o.vol.v3),'régénérer ne change rien ('+o.stable.toFixed(2)+')');
  A(o.nomBon&&o.nomMorceau,'nom de copie reconnu, morceaux #n compris');
  A(!o.nomFaux,'nom sans rapport avec la poche copiée : refusé');
  A(o.nomHors,'nom entre faces hors répétition : sans objet, accepté');
  A(o.detecte,'nom de copie faux reconnu');
  A(o.apres.x===xs[0]||o.apres.x===xs[1],'à l’ouverture, copie réparée à sa place : x = '+o.apres.x);
  A(near(o.volRepare,o.vol.v3),'volume intact après réparation');
  A(o.nomApres.indexOf(o.cloneId)>=0,'nom refait sur la poche copiée : '+o.nomApres);
  A(o.xCorps==='b1','arête de la pièce : corps de la pièce, pas le corps actif masqué ('+o.xCorps+')');
  A(o.xCorps2==='b2','arête seule dans le corps masqué : ce corps ('+o.xCorps2+')');
  A(o.xAucun===null,'arête introuvable : le corps actif reste la règle ('+o.xAucun+')');
  A(o.main.type==='xfillet'&&o.main.body==='b1','congé à la main rangé dans la pièce : '+o.main.body);
  A(o.vMain<o.vA-1e-3,'congé à la main : la pièce change vraiment ('+o.vA.toFixed(2)+' → '+o.vMain.toFixed(2)+')');
  if(ko){console.log('\n*** '+ko+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
