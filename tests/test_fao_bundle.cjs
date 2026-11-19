// Fichier dédié .miniFusion : UN conteneur qui encapsule le JSON du document ET
// son cache de trajectoires. Le document tient dans le JSON, mais les parcours de
// l'ébauche 3D (7,9 Mo, ~90 s de calcul) restent enfermés dans l'IndexedDB de CE
// navigateur : rouvrir ailleurs, ou après une purge, remet le triangle ⚠.
//  · « Enregistrer sous » produit .miniFusion (bundle = 1), l'ancien
//    .minifusion.json reste lisible (bundleIs = false) ;
//  · le bundle embarque les entrées faoMoves:* réelles (les points, pas un vide) ;
//  · rouvrir = trajectoires remises en base + mémoire amorcée : AUCUN calcul,
//    aucun triangle, aperçu valable immédiatement — même SANS IndexedDB.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const out=await vm.runInContext(`(async function(){
    const P=[]; const A=(ok,m)=>P.push((ok?'OK   ':'ECHEC')+' : '+m);

    /* ---- IndexedDB simulé (le harnais n'en a pas) ---- */
    const kv={};
    try{ indexedDB={open:function(){ return {}; }}; }catch(e){}
    idbSet=function(k,v){ kv[k]=v; return Promise.resolve(); };
    idbGet=function(k){ return Promise.resolve(
      Object.prototype.hasOwnProperty.call(kv,k)?kv[k]:undefined); };
    idbKeys=function(p){ return Promise.resolve(
      Object.keys(kv).filter(function(k){ return k.indexOf(p)===0; })); };
    A(faoMovesReady()===true,'indexedDB present : cache actif');

    /* ---- un document minimal : 2 operations 2.5D (aucune dependance au solide) ---- */
    const s=faoDefaultSetup();
    s.id='bun1';
    s.name='Posage bundle';
    s.stock={x0:0,y0:0,z0:0,x1:100,y1:80,z1:25};
    s.tools=[{id:'T1',num:1,name:'Fraise D10',kind:'flat',d:10,cornerR:0,flutes:2,vc:250,fz:0.06}];
    s.ops=[
      {id:'opA',on:true,toolId:'T1',type:'facing',z:20,ae:6},
      {id:'opB',on:true,toolId:'T1',type:'pocket',x0:10,y0:10,x1:90,y1:70,ztop:25,zbot:5,ap:8,ae:5}];
    doc.name='Piece X';
    doc.fao={setups:[s],activeSetupId:s.id};
    faoPrevOn=true;
    faoOpMovesPurge(); faoMovesReset(); faoStaleClear();

    /* ============ 1. generation comptee (2 operations) ============ */
    const gF=faoGenFacing, gP=faoGenPocket; let gen=0;
    faoGenFacing=function(){ gen++; return gF.apply(this,arguments); };
    faoGenPocket=function(){ gen++; return gP.apply(this,arguments); };
    const m1=faoOpMoves(s.ops[0],s), m2=faoOpMoves(s.ops[1],s);
    faoGenFacing=gF; faoGenPocket=gP;
    A(gen===2&&m1.length>0&&m2.length>0,
      'generation : '+gen+' calculs, '+m1.length+'/'+m2.length+' points');
    const nd=Object.keys(kv).filter(function(k){ return k.indexOf('faoMoves:')===0; });
    A(nd.length===2,'cache disque : '+nd.length+' entrees');

    /* ============ 2. export du bundle ============ */
    const txt=await bundleSerialise();
    A(bundleIs(txt)===true,'bundleIs() : c est bien un .miniFusion');
    const b=JSON.parse(txt);
    A(b.bundle===1&&b.v===APP_VER,'entete : bundle=1, version '+b.v);
    A(b.name==='Piece X','entete : nom du document');
    A(b.nMoves===2&&Object.keys(b.moves).length===2,
      'bundle : '+b.nMoves+' trajectoires embarquees');
    A(b.doc&&b.doc.fao&&b.doc.fao.setups[0].ops.length===2,
      'bundle : document complet (2 operations)');
    A(b.doc.name==='Piece X','bundle : nom conserve dans le document');
    const kb='faoMoves:'+s.id+':opA';
    A(!!b.moves[kb]&&b.moves[kb].v===1&&!b.moves[kb].mv&&!!b.moves[kb].mvz,
      'bundle : parcours rangés en colonnes (mvz), plus de liste de points');
    const z1=faoMvUnpack(b.moves[kb].mvz);
    A(Array.isArray(z1)&&z1.length===m1.length,
      'bundle : parcours REELS dans le fichier ('+(z1?z1.length:0)+' pts)');
    A(faoMvSame(z1,m1)&&faoMvSame(faoMvUnpack(b.moves['faoMoves:'+s.id+':opB'].mvz),m2),
      'bundle : points relus identiques bit à bit');

    /* ---- colonnes : cas limites gardés exacts ---- */
    const bord=[{r:1,x:-0,y:0.1+0.2,z:-30.135000228881836},{r:0,x:1e-300,y:-1e300,z:5e-324,arc:{i:1.5,j:-2,cw:true},ent:1},
      {x:1,r:0,y:2,z:3},{r:1,x:NaN,y:0,z:0},{r:true,x:0,y:0,z:0},{r:0,x:1,y:2},{r:0,x:Number.MAX_VALUE,y:-Number.MIN_VALUE,z:123456.789,tr:2}];
    const zb=faoMvPack(bord), rb=faoMvUnpack(zb);
    A(!!zb&&zb.o.length===4&&zb.x.length===2,'colonnes : '+(zb?zb.o.length:'?')+' points de forme inattendue gardés tels quels');
    A(faoMvSame(rb,bord)&&Object.is(rb[0].x,-0)&&rb[0].y===0.1+0.2,'colonnes : -0, 0,30000000000000004, extrêmes et champs en plus exacts');
    A(faoMvSame(faoMvUnpack(faoMvPack([])),[]),'colonnes : parcours vide');
    A(faoMvUnpack(Object.assign({},zb,{n:zb.n+1}))===null,'colonnes : entrée abîmée refusée');
    const vieux={moves:{a:{v:1,mv:m1}}};bundleMovesInflate(vieux);
    A(vieux.moves.a.mv===m1,'ancien fichier (mv en liste) : lu tel quel');
    const abime={moves:{a:{v:1,mvz:{v:1,n:3,f:'xx',r:'000'}}}};bundleMovesInflate(abime);
    A(!abime.moves.a,'entrée en colonnes illisible : retirée (l opération se régénère)');
    A(b.moves[kb].k===faoOpMovesKey(s.ops[0],s),
      'bundle : cle d empreinte embarquee (restauration possible)');
    A(bundleIs(serialise())===false,'ancien .minifusion.json : bundleIs = false');
    A(txt.length>500,'bundle : '+Math.round(txt.length/1024)+' Ko ecrits');

    /* ============ 3. « autre machine » : cache totalement vide ============ */
    Object.keys(kv).forEach(function(k){ delete kv[k]; });
    faoOpMovesPurge(); faoMovesReset(); faoStaleClear();
    A(!faoOpMovesHit(s.ops[0]),'cache memoire vide');
    A(Object.keys(kv).length===0,'cache disque vide');

    /* ============ 4. restauration (IndexedDB presente) ============
       Etat « machine B » : le cache local est vide, donc les deux operations sont
       marquees a regenerer et l'apercu est perime. C'est ce que l'ouverture du
       bundle doit faire disparaitre SANS calcul. */
    faoStaleScan();
    A(faoStaleCount()===2,'etat machine B : cache vide -> 2 triangles ('+faoStaleCount()+')');
    faoPrevStale=true;
    faoGenFacing=function(){ gen++; return gF.apply(this,arguments); };
    faoGenPocket=function(){ gen++; return gP.apply(this,arguments); };
    gen=0;
    const ok=await bundleRestore(txt,{rebuild:false});
    A(ok===true,'bundleRestore() : true');
    A(gen===0,'restauration : AUCUN recalcul ('+gen+')');
    A(Object.keys(kv).filter(function(k){ return k.indexOf('faoMoves:')===0; }).length===2,
      'restauration : 2 entrees remises dans IndexedDB');
    const s2=faoSetup();
    A(!!s2&&s2.id==='bun1'&&s2.ops.length===2,
      'restauration : document recharge (posage + 2 operations)');
    A(doc.name==='Piece X','restauration : nom du document conserve');
    const h=faoOpMovesHit(s2.ops[0]);
    A(!!h&&Array.isArray(h.mv)&&h.mv.length===m1.length,
      'restauration : trace en memoire ('+(h?h.mv.length:0)+' pts)');
    A(!!h&&h.key===faoOpMovesKey(s2.ops[0],s2),'restauration : cle exacte (pas de triangle)');
    A(faoStaleCount()===0,'restauration : aucun triangle rouge ('+faoStaleCount()+')');
    A(faoMovesAllReady(s2)===true,'restauration : tous les parcours en memoire');
    A(faoPrevStale===false,'restauration : apercu VALIDE sans rien presser (bouton vert)');
    A(faoPrevMissing===0,'restauration : toutes les traces dessinees ('+faoPrevMissing+')');
    A(gen===0,'restauration : toujours AUCUN calcul ('+gen+')');
    faoGenFacing=gF; faoGenPocket=gP;

    /* ============ 4b. V0.99.40 : fichier aux parcours ANCIENS, navigateur à jour ============
       Le fichier a été enregistré avec un parcours périmé (opération modifiée ensuite), puis
       « Tout régénérer » a rangé le parcours à jour dans ce navigateur. Rouvrir le fichier ne
       doit plus écraser le parcours à jour par l'ancien (triangles revenus à chaque ouverture). */
    {
      const bb=JSON.parse(txt);
      bb.doc.fao.setups[0].ops[0].z=19;                  // le document dit z=19…
      const kA='faoMoves:'+s.id+':opA';
      bb.moves[kA].at=1;                                 // …le parcours du fichier date d'avant (z=20)
      const vieux=bb.moves[kA].k;
      // navigateur : parcours à jour pour z=19 (plus récent)
      s2.ops[0].z=19; faoOpMovesPurge();
      const mz=faoOpMoves(s2.ops[0],s2);
      const kNeuf=faoOpMovesKey(s2.ops[0],s2);
      kv[kA]={v:1,ver:CACHE_VER,k:kNeuf,n:mz.length,at:Date.now(),mv:mz};
      A(kNeuf!==vieux,'4b : la clé du fichier est bien périmée');
      faoOpMovesPurge(); faoMovesReset(); faoStaleClear();
      gen=0;
      faoGenFacing=function(){ gen++; return gF.apply(this,arguments); };
      faoGenPocket=function(){ gen++; return gP.apply(this,arguments); };
      await bundleRestore(JSON.stringify(bb),{rebuild:false});
      A(kv[kA]&&kv[kA].k===kNeuf,'4b : parcours à jour du navigateur GARDÉ (pas écrasé par le fichier)');
      await faoMovesPreload(); faoStaleScan();
      A(faoStaleCount()===0,'4b : aucun triangle après réouverture ('+faoStaleCount()+')');
      A(gen===0,'4b : aucun recalcul ('+gen+')');
      // et l'inverse : rouvrir l'ANCIENNE version (z=20) sert le parcours du fichier, gardé en réserve
      faoOpMovesPurge(); faoMovesReset(); faoStaleClear();
      const bv=JSON.parse(txt); bv.moves[kA].at=1;
      await bundleRestore(JSON.stringify(bv),{rebuild:false});
      await faoMovesPreload(); faoStaleScan();
      A(faoStaleCount()===0,'4b : ancienne version rouverte, son parcours (réserve) servi ('+faoStaleCount()+')');
      A(gen===0,'4b : toujours aucun recalcul ('+gen+')');
      faoGenFacing=gF; faoGenPocket=gP;
    }

    /* ============ 5. meme fichier, navigateur SANS IndexedDB ============
       Le bundle doit suffire a lui seul : la memoire est amorcee depuis le fichier,
       sans lecture disque (c'est le cas d'une cle USB ouverte sur un autre poste). */
    delete indexedDB;
    Object.keys(kv).forEach(function(k){ delete kv[k]; });
    faoOpMovesPurge(); faoMovesReset(); faoStaleClear();
    A(faoMovesReady()===false,'sans IDB : cache persistant desactive');
    faoStaleScan();
    A(faoStaleCount()===2,'sans IDB : 2 triangles avant ouverture ('+faoStaleCount()+')');
    faoPrevStale=true;
    gen=0;
    faoGenFacing=function(){ gen++; return gF.apply(this,arguments); };
    faoGenPocket=function(){ gen++; return gP.apply(this,arguments); };
    const ok2=await bundleRestore(txt,{rebuild:false});
    A(ok2===true,'sans IDB : restauration reussie');
    A(gen===0,'sans IDB : AUCUN recalcul, la memoire est amorcee par le bundle ('+gen+')');
    const s3=faoSetup();
    A(faoMovesAllReady(s3)===true,'sans IDB : tous les parcours en memoire');
    A(faoStaleCount()===0,'sans IDB : aucun triangle ('+faoStaleCount()+')');
    A(faoPrevStale===false,'sans IDB : apercu VALIDE sans rien presser');
    const mv3=faoMovesStat(s3.ops[1],s3);
    A(!!mv3&&mv3.length===m2.length,
      'sans IDB : la 2e operation sert ses '+m2.length+' points');
    A(gen===0,'sans IDB : toujours AUCUN calcul ('+gen+')');
    faoGenFacing=gF; faoGenPocket=gP;

    /* ============ 6. ce n'est PAS un bundle : l'ancien format passe tel quel ============
       Un .minifusion.json ne contient aucun cache — on ne doit pas croire qu'on en a. */
    A(bundleIs(serialise())===false,'JSON simple : bundleIs = false (lecture directe)');
    A(bundleIs('{"app":"MiniFusion","v":1}')===false,'JSON sans bundle : bundleIs = false');
    A(bundleIs('pas du json')===false,'texte illisible : bundleIs = false');

    faoMovesReset();
    return P;
  })()`,ctx);
  let ko=0;
  out.forEach(function(l){ console.log('  '+(l.indexOf('OK')===0?'✓':'✗')+' '+l.slice(7)); if(l.indexOf('ECHEC')===0)ko++; });
  if(ko){ console.log('\n'+ko+' ECHEC(S)'); process.exit(1); }
  console.log('\nTOUT EST CONFORME');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
