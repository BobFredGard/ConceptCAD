// SYMÉTRIE + LINÉAIRE + SYMÉTRIE (V0.95.5) : dans une seule fonction Symétrie, l'étape Linéaire répète la
// pièce et son image en ligne, puis la 2ᵉ symétrie reprend le tout. Vrai moteur : comptes, position de chaque
// copie, solide final, stabilité des ids, compatibilité, signature du cache et rechargement.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    "const bb=function(sh){const b=new occt.Bnd_Box_1();occt.BRepBndLib.Add(sh,b,true);const a=b.CornerMin(),z=b.CornerMax();b.delete();return [a.X(),a.Y(),a.Z(),z.X(),z.Y(),z.Z()];};",
    "const f1=v=>v.toFixed(1);",
    "const nsolide=function(sh){let n=0;const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);while(ex.More()){n++;ex.Next();}ex.delete();return n;};",
    "const nbsol=function(sh){let n=0;const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_SOLID,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);while(ex.More()){n++;ex.Next();}ex.delete();return n;};",
    // boite décentrée : x 10..30, y 5..15, z 0..20 — le miroir se voit dans les chiffres
    "const sk={id:'sk_t',name:'Plot',plane:'XY',origin:[0,0,0],points:{},entities:[],constraints:[],dims:[]};",
    "[['p0',10,5,'e0','p1'],['p1',30,5,'e1','p2'],['p2',30,15,'e2','p3'],['p3',10,15,'e3','p0']].forEach(l=>{",
    "  sk.points[l[0]]={x:l[1],y:l[2]};sk.entities.push({id:l[3],t:'line',p1:l[0],p2:l[4]});});",
    "doc.sketches=[sk];",
    "doc.features=[{id:'ex_t',type:'extrude',name:'Plot',sketchId:'sk_t',op:'add',distance:20}];",
    "occSkipFeat=null;",
    "const rejouer=()=>{try{occCk.length=0;}catch(e){}return occFinalShape(null);};",
    "const formeDe=f=>{const r=occShapeOfExtrude(f);const b=bb(r.shape);try{if(typeof occDispose!=='undefined')occDispose(r.bins);}catch(e){}return b;};",
    "let FR=rejouer();",
    "p('base seule : '+f1(bb(FR.shape)[0])+'..'+f1(bb(FR.shape)[3])+' x '+f1(bb(FR.shape)[1])+'..'+f1(bb(FR.shape)[4]));",
    "att(Math.abs(bb(FR.shape)[0]-10)<0.5&&Math.abs(bb(FR.shape)[3]-30)<0.5,'base : x attendu 10..30');",
    "if(FR.shape)FR.shape.delete();",
    // ---------- symétrie YZ + linéaire Y (2 en ligne, pas 40) + symétrie XZ ----------
    "const rp={id:'rp_t',type:'repeat',name:'',mode:'mir',plane:'YZ',mlin:true,axis:'Y',copies:1,dist:40,plane2:'XZ',base:['ex_t'],children:[],visible:true};",
    "rp.name=repTypeName(rp.mode,rp);doc.features.push(rp);",
    "p('nom : '+rp.name);att(rp.name==='Symétrie + Linéaire + Symétrie','nom attendu « Symétrie + Linéaire + Symétrie »');",
    "const n1=repGenChildren(rp);",
    "const kids=()=>doc.features.filter(f=>f.repeatId==='rp_t');",
    "p('chaîne complète : '+n1+' instance(s), repIndex ['+kids().map(k=>k.repIndex).join(',')+']');",
    "att(n1===7,'chaîne complète : 7 instances attendues (1 + 2 + 4), obtenu '+n1);",
    "att(kids().map(k=>k.repIndex).join(',')==='1,1001,1001,2,2,2,2','repIndex attendus [1,1001,1001,2,2,2,2]');",
    "const ap=repPreviewXforms(rp);p('aperçu : '+ap.length+' copies');att(ap.length===7,'aperçu : 7 copies attendues');",
    "const bs=kids().map(formeDe);",
    "const a=(x0,y0)=>bs.some(b=>Math.abs(b[0]-x0)<0.6&&Math.abs(b[1]-y0)<0.6);",
    "[[-30,5],[10,45],[-30,45],[10,-15],[-30,-15],[10,-55],[-30,-55]].forEach(c=>att(a(c[0],c[1]),'copie attendue à x '+c[0]+', y '+c[1]+' introuvable'));",
    "FR=rejouer();",
    "let B=bb(FR.shape);",
    "p('solide final : '+nbsol(FR.shape)+' solide(s), x '+f1(B[0])+'..'+f1(B[3])+', y '+f1(B[1])+'..'+f1(B[4]));",
    "att(nbsol(FR.shape)===8,'solide final : 8 solides disjoints attendus');",
    "att(Math.abs(B[0]+30)<0.6&&Math.abs(B[3]-30)<0.6&&Math.abs(B[1]+55)<0.6&&Math.abs(B[4]-55)<0.6,'solide final : boîte attendue x ±30, y ±55');",
    "(FR.msgs||[]).forEach(m=>p('  ! '+m));",
    "if(FR.shape)FR.shape.delete();",
    // stabilité
    "const ids1=kids().map(k=>k.id).join(','),sk1=kids().map(k=>k.sketchId).join(',');",
    "repGenChildren(rp);repGenChildren(rp);",
    "att(ids1===kids().map(k=>k.id).join(','),'stabilité : ids des instances ont changé');",
    "att(sk1===kids().map(k=>k.sketchId).join(','),'stabilité : ids des esquisses ont changé');",
    "p('stabilité : ids et esquisses identiques après 2 régénérations');",
    // sans 2ᵉ symétrie : symétrie + linéaire
    "delete rp.plane2;rp.name=repTypeName(rp.mode,rp);",
    "const n2=repGenChildren(rp);",
    "FR=rejouer();B=bb(FR.shape);",
    "p('Symétrie + Linéaire : '+n2+' instances, '+nbsol(FR.shape)+' solides, y '+f1(B[1])+'..'+f1(B[4]));",
    "att(rp.name==='Symétrie + Linéaire','nom attendu « Symétrie + Linéaire »');",
    "att(n2===3&&nbsol(FR.shape)===4,'Symétrie + Linéaire : 3 instances et 4 solides attendus');",
    "att(Math.abs(B[1]-5)<0.6&&Math.abs(B[4]-55)<0.6,'Symétrie + Linéaire : y attendu 5..55');",
    "if(FR.shape)FR.shape.delete();",
    // 3 en ligne
    "rp.copies=2;const n3=repGenChildren(rp);p('3 en ligne : '+n3+' instances');att(n3===5,'3 en ligne : 5 instances attendues');",
    // compatibilité : sans + Linéaire, symétrie simple d'avant
    "delete rp.mlin;const n4=repGenChildren(rp);p('sans + Linéaire : '+n4+' instance');att(n4===1,'sans + Linéaire : 1 instance attendue (symétrie simple)');",
    "rp.plane2='XZ';const n5=repGenChildren(rp);p('symétrie double d’avant : '+n5+' instances');att(n5===3,'symétrie double : 3 instances attendues');",
    // signature du cache
    "const s0=featSig(rp);rp.mlin=true;const s1=featSig(rp);",
    "att(s0!==s1,'signature : + Linéaire ne change pas la signature → cache périmé');",
    // rechargement
    "rp.copies=1;repGenChildren(rp);",
    "const json=JSON.stringify(doc);",
    "try{await deserialise(json,{rebuild:false});}catch(e){p('  (cadre de vue ignoré : harnais)');}",
    "const rp2=doc.features.find(f=>f.type==='repeat');",
    "p('après rechargement : mlin='+(rp2&&rp2.mlin)+', instances='+doc.features.filter(f=>f.repeatId===(rp2&&rp2.id)).length);",
    "att(rp2&&rp2.mlin===true,'rechargement : + Linéaire perdu');",
    "att(doc.features.filter(f=>f.repeatId===rp2.id).length===7,'rechargement : 7 instances attendues');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  ✗ '+m));}",
    "else p('');p('TOUT EST CONFORME');",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'mirlin.js'});
  console.log(r);
  process.exit(/ECHECS|✗/.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.message)||e).slice(0,500));process.exit(1);});
