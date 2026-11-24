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

    /* 12. V0.99.73 : répétition d'une répétition (couronne de 4 trous, refaite 2 fois en X) */
    const t=faoDefaultSetup(); t.id='sN'; t.name='PN';
    t.stock={x0:0,y0:0,z0:0,x1:100,y1:80,z1:25};
    const fN={id:'nf',on:true,toolId:'T1',type:'facing',z:25,ae:6,np:0};
    const dN={id:'nd',on:true,toolId:'T1',type:'drill',src:'xy',pts:[[10,10]],cycle:'drill',ztop:25,zbot:15,depthMode:'full'};
    const P1=faoPatternDefaults(t); P1.id='q1'; P1.kind='circ'; P1.n=4; P1.ang=360; P1.cx=50; P1.cy=40; P1.srcs=['nd'];
    const P2=faoPatternDefaults(t); P2.id='q2'; P2.kind='rect'; P2.nx=2; P2.dx=100; P2.ny=1; P2.srcs=['q1'];
    t.ops=[fN,dN,P1,P2];
    doc.fao={setups:[t],activeSetupId:'sN'};
    faoRoot();
    A(P2.srcs.join()==='q1','une répétition peut être la source d’une autre ('+P2.srcs.join()+')');
    Q=faoOpsSeq(t);
    const qd=Q.filter(e=>e.op.id==='nd');
    A(qd.length===8&&qd.every(e=>e.pat===P2&&e.n===8),'2 × 4 = 8 perçages, usinés à la place de la répétition englobante ('+qd.length+')');
    A(Q.map(e=>e.op.id).join()==='nf,nd,nd,nd,nd,nd,nd,nd,nd','surfaçage à sa place puis les 8 copies ('+Q.map(e=>e.op.id).join()+')');
    A(faoPatternOwner(t,P1)===P2&&faoPatternOwner(t,dN)===P1,'arbre : la répétition intérieure porte ↻ de l’englobante');
    A(faoPatternTotal(t,P1)===8&&faoPatternTotal(t,P2)===2,'nombre total de copies : 8 pour la couronne, 2 pour la rangée');
    g=faoPost(t).code;
    A(['X10\\.000 Y10\\.000','X80\\.000 Y0\\.000','X90\\.000 Y70\\.000','X20\\.000 Y80\\.000',
       'X110\\.000 Y10\\.000','X180\\.000 Y0\\.000','X190\\.000 Y70\\.000','X120\\.000 Y80\\.000'].every(r=>new RegExp(r).test(g)),
      'G-code : les 8 trous (2 couronnes de 4)');
    A(/copie 8\\/8/.test(g),'G-code : copie 8/8 commentée');

    /* 13. par opération à travers les niveaux : surfaçage ×8 puis perçage ×8 */
    P1.srcs=['nf','nd']; faoRoot();
    Q=faoOpsSeq(t);
    A(Q.map(e=>e.op.id).join()===Array(8).fill('nf').concat(Array(8).fill('nd')).join(),'ordre par opération : surfaçage sur les 8 copies, puis perçage');
    P1.srcs=['nd']; faoRoot();

    /* 14. répétition intérieure ○ : transparente ; englobante ○ : l’intérieure seule */
    P1.on=false; faoRoot();
    Q=faoOpsSeq(t).filter(e=>e.op.id==='nd');
    A(Q.length===2&&Q[1].xf&&Math.abs(Q[1].xf.tx-100)<1e-9,'couronne ○ : le trou n’est copié que par la rangée ('+Q.length+')');
    P1.on=true; P2.on=false; faoRoot();
    Q=faoOpsSeq(t).filter(e=>e.op.id==='nd');
    A(Q.length===4&&Q.every(e=>e.pat===P1),'rangée ○ : la couronne seule, à sa place ('+Q.length+')');
    A(faoPatternOwner(t,P1)===null,'rangée ○ : plus de ↻ sur la couronne');
    P2.on=true; faoRoot();

    /* 15. jamais de boucle : soi-même, A dans B dans A */
    P1.srcs=['q1','nd']; faoRoot();
    A(P1.srcs.join()==='nd','une répétition ne se contient pas elle-même');
    P1.srcs=['nd','q2']; faoRoot();
    A(!(P1.srcs.indexOf('q2')>=0&&P2.srcs.indexOf('q1')>=0),'boucle A dans B dans A coupée ('+P1.srcs.join()+' | '+P2.srcs.join()+')');
    A(faoOpsSeq(t).length<100,'séquence finie après une boucle');
    P1.srcs=['nd']; P2.srcs=['q1']; faoRoot();

    /* 16. fiche : la couronne est proposée dans la rangée, la rangée pas dans la couronne */
    const txt=n=>(n.textContent||'')+(n.children||[]).map(txt).join('\\n');
    let fd=document.createElement('div'); faoPatternFiche(fd,t,P2,3);
    A(/↻ Répétition circulaire ×4/.test(txt(fd)),'fiche de la rangée : la couronne est cochable');
    A(/8 copies de chacune de ses opérations/.test(txt(fd)),'fiche de la rangée : 8 copies annoncées');
    fd=document.createElement('div'); faoPatternFiche(fd,t,P1,2);
    A(!/Répétition rectangulaire/.test(txt(fd)),'fiche de la couronne : la rangée qui la contient n’est pas proposée');
    A(/faites 8 fois en tout/.test(txt(fd)),'fiche de la couronne : faite 8 fois en tout');

    /* 17. symétrie de symétrie = demi-tour : sens de coupe d’origine */
    const mx={a:-1,b:0,c:0,d:1,tx:100,ty:0,mir:true,lab:'mx'}, my={a:1,b:0,c:0,d:-1,tx:0,ty:80,mir:true,lab:'my'};
    const mm=faoXfMoves([{x:0,y:0,z:0,r:0},{x:10,y:0,z:0,r:0,arc:{i:5,j:2,cw:true}}],faoXfCompose(mx,my));
    A(mm[1].x===90&&mm[1].y===80&&mm[1].arc.i===-5&&mm[1].arc.j===-2&&mm[1].arc.cw===true,'miroir ∘ miroir : point, centre et sens d’arc conservé');

    /* 18. autres origines d’une rangée : copies déplacées ET en G55 */
    P2.kind='wcs'; P2.wcs=['G55']; P1.kind='rect'; P1.nx=2; P1.dx=30; P1.ny=1; faoRoot();
    Q=faoOpsSeq(t).filter(e=>e.op.id==='nd');
    A(Q.map(e=>(e.xf&&e.xf.wcs||'G54')+(faoXfGeo(e.xf)?'+':'')).join()==='G54,G54+,G55,G55+','origines d’une rangée : G54, G54 décalée, G55, G55 décalée ('+Q.map(e=>(e.xf&&e.xf.wcs||'G54')+(faoXfGeo(e.xf)?'+':'')).join()+')');
    g=faoPost(t).code;
    const g55=g.split('\\n').findIndex(l=>/G55\\s*$/.test(l.trim()));
    A(g55>0&&g.split('\\n').slice(g55).join('\\n').match(/X40\\.000 Y10\\.000/),'G-code : trou décalé refait en G55');
    // origines d’origines : une seule origine par copie
    P1.kind='wcs'; P1.wcs=['G56']; faoRoot();
    Q=faoOpsSeq(t).filter(e=>e.op.id==='nd');
    A(Q.map(e=>e.xf?e.xf.wcs:'G54').join()==='G54,G56,G55','origines d’origines : G54, G56, G55 sans copie double ('+Q.map(e=>e.xf?e.xf.wcs:'G54').join()+')');

    /* 19. plafond : 100 × 100 dans 100 × 1 → 10 000 copies au plus */
    P1.kind='rect'; P1.nx=100; P1.ny=100; P1.dx=1; P1.dy=1; P2.kind='rect'; P2.nx=100; P2.ny=1; faoRoot();
    Q=faoOpsSeq(t).filter(e=>e.op.id==='nd');
    A(Q.length===FAO_PAT_MAX,'copies plafonnées à '+FAO_PAT_MAX+' ('+Q.length+')');

    /* 20. copier / coller la rangée avec la couronne et le perçage : liens suivis */
    P1.nx=2; P1.ny=1; P2.nx=2; faoRoot();
    faoSelectOp('sN','q2'); faoMulti=['q1','nd'];
    A(faoCopy()===3,'copie rangée + couronne + perçage');
    faoSelectOp('sN','q2'); faoPaste();
    const c2=t.ops.filter(o=>o.type==='pattern'&&o.kind==='rect'&&o.id!=='q2'&&o.id!=='q1');
    const outer=c2.filter(o=>o.srcs.length===1&&t.ops.some(q=>q.id===o.srcs[0]&&q.type==='pattern'))[0];
    const innr=outer&&t.ops.filter(q=>q.id===outer.srcs[0])[0];
    const drl=innr&&t.ops.filter(q=>q.id===innr.srcs[0])[0];
    A(outer&&innr&&drl&&drl.type==='drill'&&drl.id!=='nd'&&innr.id!=='q1','collage : rangée → couronne → perçage collés, reliés entre eux');

    const bad=P.filter(function(x){return x.indexOf('ECHEC')===0;});
    if(bad.length){P.push('');P.push('ECHECS ('+bad.length+') :');bad.forEach(function(m){P.push('  x '+m);});}
    else P.push('TOUT EST CONFORME');
    return P.join('\\n');
  })()`,ctx);
  console.log(out);
  process.exit(/ECHECS/.test(out)?1:0);
})().catch(e=>{console.error('FATAL',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
