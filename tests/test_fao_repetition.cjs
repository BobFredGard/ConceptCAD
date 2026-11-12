// V0.95.3 — FAO : répétition d'opérations (rectangulaire, circulaire, symétrie,
// autres origines), usinage PAR OPÉRATION, G-code (copies, G55, perçages
// déplacés), répétition désactivée, copier / coller, source supprimée.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const out=await vm.runInContext(`(async function(){
    const P=[]; const A=(ok,m)=>P.push((ok?'OK   ':'ECHEC')+' : '+m);
    const s=faoDefaultSetup(); s.id='sR'; s.name='PR';
    s.stock={x0:0,y0:0,z0:0,x1:100,y1:80,z1:25};
    const fac={id:'f1',on:true,toolId:'T1',type:'facing',z:25,ae:6,np:0};
    const dri={id:'d1',on:true,toolId:'T1',type:'drill',src:'xy',pts:[[10,10]],cycle:'drill',ztop:25,zbot:15,depthMode:'full'};
    const pat=faoPatternDefaults(s); pat.id='p1'; pat.srcs=['f1','d1']; pat.kind='rect'; pat.nx=2; pat.dx=100; pat.ny=1;
    s.ops=[fac,dri,pat];
    doc.fao={setups:[s],activeSetupId:'sR'};
    faoRoot();
    const cut=mv=>mv.filter(m=>!m.r);
    const xmax=mv=>Math.max.apply(null,cut(mv).map(m=>+m.x));

    /* 1. séquence par opération : f1, f1', d1, d1' */
    let Q=faoOpsSeq(s);
    A(Q.map(e=>e.op.id+(e.xf?"'":'')).join()==="f1,f1',d1,d1'",'ordre par opération ('+Q.map(e=>e.op.id+(e.xf?"'":'')).join()+')');
    const S=faoSeqSafe(s);
    A(S.length===4,'faoSeqSafe : 4 blocs');
    const m0=xmax(S[0].moves), m1=xmax(S[1].moves);
    A(Math.abs(m1-m0-100)<1e-6,'copie décalée de 100 mm en X ('+m0.toFixed(2)+' → '+m1.toFixed(2)+')');

    /* 2. G-code : copies commentées, trou déplacé */
    let g=faoPost(s).code;
    A(/copie 2\\/2/.test(g),'G-code : copie 2/2 commentée');
    A(/X10\\.000 Y10\\.000/.test(g)&&/X110\\.000 Y10\\.000/.test(g),'perçage : trou d’origine et trou déplacé');

    /* 3. circulaire : 4 copies à 90° autour du centre */
    pat.kind='circ'; pat.n=4; pat.ang=360; pat.cx=50; pat.cy=40; pat.srcs=['d1']; faoRoot();
    Q=faoOpsSeq(s);
    A(Q.length===5&&Q[0].op.id==='f1','circulaire : f1 seule + 4 copies du perçage ('+Q.length+')');
    const xf=Q[2].xf, p=faoXfPt(xf,10,10);
    A(Math.abs(p[0]-80)<1e-6&&Math.abs(p[1]-0)<1e-6,'rotation de 90° : (10,10) → ('+p[0].toFixed(3)+','+p[1].toFixed(3)+')');
    g=faoPost(s).code;
    A(/X80\\.000 Y0\\.000/.test(g)&&/X90\\.000 Y70\\.000/.test(g)&&/X20\\.000 Y80\\.000/.test(g),'G-code : 4 trous en couronne');

    /* 4. symétrie : arc inversé */
    pat.kind='mirror'; pat.axis='x'; pat.at=50; faoRoot();
    const mv=faoXfMoves([{x:0,y:0,z:0,r:0},{x:10,y:0,z:0,r:0,arc:{i:5,j:0,cw:true}}],faoPatternXfs(s,pat)[1]);
    A(mv[1].x===90&&mv[1].arc.i===-5&&mv[1].arc.cw===false,'miroir X=50 : point, centre et sens d’arc');

    /* 5. autres origines : G55 puis retour G54 */
    pat.kind='wcs'; pat.wcs=['G55']; pat.srcs=['f1']; faoRoot();
    Q=faoOpsSeq(s);
    A(Q.map(e=>e.op.id+(e.xf?'@'+e.xf.wcs:'')).join()==='d1,f1,f1@G55','origines : d1, f1, f1 en G55 ('+Q.map(e=>e.op.id+(e.xf?'@'+e.xf.wcs:'')).join()+')');
    // la répétition est APRÈS d1 : remonter la répétition en tête
    s.ops=[pat,fac,dri]; faoRoot();
    g=faoPost(s).code.split('\\n');
    const i55=g.findIndex(l=>/^N?\\d*\\s*G55\\s*$/.test(l.trim())||l.trim().endsWith(' G55'));
    const i54=g.findIndex((l,i)=>i>i55&&(l.trim().endsWith(' G54')||l.trim()==='G54'));
    const iDr=g.findIndex(l=>/CYCLE81|G81/.test(l));
    A(i55>0&&i54>i55&&iDr>i54,'G-code : G55 pour la copie, retour en G54 avant le perçage ('+i55+','+i54+','+iDr+')');

    /* 6. répétition désactivée : sources une fois, à leur place */
    pat.on=false; faoRoot();
    A(faoOpsSeq(s).map(e=>e.op.id).join()==='f1,d1','répétition ○ : f1, d1 une fois');
    pat.on=true;

    /* 7. pas de parcours propre, jamais « à régénérer » */
    A(faoActiveOps(s).every(o=>o.type!=='pattern'),'répétition hors des opérations à générer');
    faoStaleScan(); A(pat.stale===false,'répétition jamais ⚠');

    /* 8. une source n'appartient qu'à UNE répétition */
    const p2=faoPatternDefaults(s); p2.id='p2'; p2.srcs=['f1','d1']; s.ops.push(p2); faoRoot();
    A(p2.srcs.join()==='d1','2e répétition : f1 déjà prise, d1 seule ('+p2.srcs.join()+')');
    s.ops.pop(); faoRoot();

    /* 9. copier / coller la répétition avec sa source : sources suivies */
    faoSelectOp('sR','p1'); faoMulti=['f1'];
    A(faoCopy()===2,'copie répétition + source');
    faoSelectOp('sR','d1'); faoPaste();
    const np=s.ops.filter(o=>o.type==='pattern'&&o.id!=='p1')[0], nf=s.ops.filter(o=>o.type==='facing'&&o.id!=='f1')[0];
    A(np&&nf&&np.srcs.join()===nf.id,'collage : la répétition collée vise la source collée');

    /* 10. source supprimée : retirée de la répétition */
    s.ops=s.ops.filter(o=>o.id!=='f1'); faoRoot();
    A(pat.srcs.length===0,'source supprimée → répétition vide');

    /* 11. posage dupliqué : sources suivies */
    pat.srcs=['d1']; faoRoot();
    faoSelectSetup('sR'); faoCopy(); faoPaste();
    const c=faoRoot().setups[1], cp=c.ops.filter(o=>o.type==='pattern')[0], cd=c.ops.filter(o=>o.type==='drill'&&o.src==='xy')[0];
    A(cp&&cd&&cp.srcs.indexOf(cd.id)>=0,'posage dupliqué : répétition reliée à SON perçage');

    const bad=P.filter(function(x){return x.indexOf('ECHEC')===0;});
    if(bad.length){P.push('');P.push('ECHECS ('+bad.length+') :');bad.forEach(function(m){P.push('  x '+m);});}
    else P.push('TOUT EST CONFORME');
    return P.join('\\n');
  })()`,ctx);
  console.log(out);
  process.exit(/ECHECS/.test(out)?1:0);
})().catch(e=>{console.error('FATAL',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
