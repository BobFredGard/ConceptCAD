// V0.8.3 : enregistrement sûr + copie .bak (97-fichiers-projets.js). Système de fichiers SIMULÉ
// en mémoire (création, fichier d'échange remplacé à la fermeture, abandon, tailles) : contrôle du
// contenu, copie de la version précédente à côté du fichier (dossier de projets) et dans le
// navigateur, écriture qui échoue → original intact, relecture fausse → version précédente remise,
// fichier hors du dossier (pas de .bak sur le disque), ouverture de la copie, Ctrl+S complet.
// V1.0.2 : enregistrements qui se chevauchent (l'un après l'autre, plus de version d'avant remise),
// fichier bloqué un instant par un autre logiciel (nouvel essai), permission refusée (aucun essai de plus).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};
    confirm=function(){return true;};alert=function(){};showAll=function(){}; // pas de caméra dans le banc
    // ── système de fichiers en mémoire ──
    const FS={},IDB={};let mode='ok';
    idbSet=async(k,v)=>{IDB[k]=v;};idbGet=async k=>IDB[k];
    MFF_ESSAIS=[1,1,1]; // V1.0.2 : nouveaux essais d'écriture sans attendre dans le banc
    const mkFile=path=>({kind:'file',name:path.split('/').pop(),_p:path,
      async getFile(){if(!(path in FS))throw new Error('NotFound');const t=FS[path];return {name:path.split('/').pop(),size:t.length,lastModified:1000,text:async()=>t};},
      async createWritable(){let buf='',aborted=false;return {
        write:async t=>{if(mode==='fail')throw new Error('disque plein');buf=t;},
        close:async()=>{if(aborted)return;if(mode==='short'&&!path.endsWith('.bak')){FS[path]=buf.slice(0,buf.length>>1);mode='ok';}else FS[path]=buf;},
        abort:async()=>{aborted=true;}};},
      async queryPermission(){return 'granted';},async requestPermission(){return 'granted';},
      async isSameEntry(o){return !!o&&o._p===path;}});
    const mkDir=prefix=>({kind:'directory',name:prefix.split('/').filter(Boolean).pop()||'projets',
      async getDirectoryHandle(n){return mkDir(prefix+n+'/');},
      async getFileHandle(n,o){const q=prefix+n;if(!(q in FS)){if(o&&o.create)FS[q]='';else throw new Error('NotFound');}return mkFile(q);},
      async resolve(h){return h&&h._p&&h._p.startsWith(prefix)?h._p.slice(prefix.length).split('/'):null;},
      async queryPermission(){return 'granted';},async requestPermission(){return 'granted';}});
    mffFolder=mkDir('projets/');
    // ── 1. contrôle du contenu ──
    docResetEmpty();doc.name='Bride';
    att(/vide/.test(mffCheckData(''))&&/illisible/.test(mffCheckData('{pas du json………………………}'))&&/pas un projet/.test(mffCheckData(JSON.stringify({x:1,y:'abcdefghijklmnopqrstuvwxyz'}))),'1 : contenu vide, illisible ou étranger : refusé');
    att(mffCheckData(serialise())===''&&mffCheckData(await bundleSerialise())==='','2 : document et projet complet (bundle) : acceptés');
    // ── 2. premier enregistrement dans le dossier : pas de copie ──
    const h=await mffFolder.getFileHandle('pieces/Bride.miniFusion',{create:true});
    const v1=serialise();
    let r=await mffWriteSafe(h,v1);
    att(FS['projets/pieces/Bride.miniFusion']===v1&&!r.bak.disk&&!('projets/pieces/Bride.miniFusion.bak' in FS),'3 : premier enregistrement : écrit, rien à copier');
    // ── 3. deuxième : la version précédente part en .bak (à côté) et dans le navigateur ──
    doc.params=[{name:'e',expr:'12',value:12}];const v2=serialise();
    r=await mffWriteSafe(h,v2);
    att(FS['projets/pieces/Bride.miniFusion']===v2,'4 : nouvelle version écrite');
    att(FS['projets/pieces/Bride.miniFusion.bak']===v1&&r.bak.disk==='Bride.miniFusion.bak','5 : version précédente copiée en « Bride.miniFusion.bak » à côté du fichier');
    att(IDB['mff:bak:Bride.miniFusion']&&IDB['mff:bak:Bride.miniFusion'].txt===v1,'6 : et gardée dans le navigateur');
    // même contenu : pas de copie inutile
    r=await mffWriteSafe(h,v2);
    att(FS['projets/pieces/Bride.miniFusion.bak']===v1&&!r.bak.disk,'7 : contenu inchangé : la copie n’est pas écrasée');
    // ── 4. contenu invalide : rien n'est touché ──
    let err='';try{await mffWriteSafe(h,'');}catch(e){err=e.message;}
    att(/annulé/.test(err)&&FS['projets/pieces/Bride.miniFusion']===v2&&FS['projets/pieces/Bride.miniFusion.bak']===v1,'8 : contenu vide : enregistrement annulé, fichier et copie intacts');
    // ── 5. l'écriture échoue : abandon, original intact ──
    doc.params[0].expr='14';doc.params[0].value=14;const v3=serialise();
    mode='fail';err='';try{await mffWriteSafe(h,v3);}catch(e){err=e.message;}mode='ok';
    att(/disque plein/.test(err)&&FS['projets/pieces/Bride.miniFusion']===v2,'9 : écriture en échec : abandonnée, la version d’avant reste sur le disque');
    // ── 6. relecture fausse (fichier tronqué) : version précédente remise ──
    mode='short';err='';try{await mffWriteSafe(h,v3);}catch(e){err=e.message;}mode='ok';
    att(/relecture/.test(err)&&FS['projets/pieces/Bride.miniFusion']===v2,'10 : fichier tronqué à la relecture : version précédente remise ('+err.slice(0,60)+')');
    // ── 7. fichier hors du dossier de projets : copie dans le navigateur seulement ──
    FS['ailleurs/Axe.conceptcad']=v1;const hx=mkFile('ailleurs/Axe.conceptcad');
    r=await mffWriteSafe(hx,v2);
    att(FS['ailleurs/Axe.conceptcad']===v2&&!r.bak.disk&&r.bak.idb&&!('ailleurs/Axe.conceptcad.bak' in FS),'11 : hors du dossier de projets : pas de .bak sur le disque, copie dans le navigateur');
    // ── 8. Ctrl+S complet ──
    mffHandle=h;doc.params[0].expr='16';doc.params[0].value=16;
    const ok=await mffSave();
    att(ok&&/Bride\\.miniFusion\\.bak/.test(faceEl.textContent),'12 : Ctrl+S : enregistré, le message nomme la copie ('+faceEl.textContent+')');
    att(mffCheckData(FS['projets/pieces/Bride.miniFusion'])===''&&FS['projets/pieces/Bride.miniFusion.bak']===v2,'13 : projet complet écrit, copie = version d’avant');
    // ── 9. copies trouvées, ouverture de la copie ──
    const L=await mffBakFind(h);
    att(L.length===2&&L.some(c=>c.where==='disk')&&L.some(c=>c.where==='idb'),'14 : deux copies de secours proposées (disque, navigateur)');
    mffAsk=async()=>'drop';
    const cd=L.find(c=>c.where==='disk');
    await mffBakOpen(cd);
    att(doc.params.length===1&&doc.params[0].value===12&&mffHandle===h,'15 : copie ouverte (e = 12), rattachée au même fichier');
    // ── 10. V0.46.2 : fichier vidé sur le disque (Barquette à 0 octet) ──
    doc.params[0].expr='18';doc.params[0].value=18;
    let thrown='';try{await mffLoadText('','Vide.conceptcad',null);}catch(e){thrown=e.message;}
    att(/vide/.test(thrown)&&doc.params[0].value===18,'16 : contenu vide : le modèle ouvert n’est pas effacé ('+thrown+')');
    FS['projets/pieces/Bride.miniFusion']='';
    let asked='';mffAsk=async m=>{asked=m;return 'cancel';};
    let okO=await mffOpenHandle(h);
    att(!okO&&/vide \\(0 octet\\)/.test(asked)&&/copie de secours/.test(asked)&&doc.params[0].value===18,'17 : ouverture d’un fichier vide : copie de secours proposée, Annuler garde le modèle');
    mffAsk=async()=>'bak';
    okO=await mffOpenHandle(h);
    att(okO&&doc.params[0].value===12&&mffHandle===h&&FS['projets/pieces/Bride.miniFusion']==='','18 : « Ouvrir la copie » : la copie la plus récente (version d’avant, e = 12) est ouverte, le disque n’est pas réécrit sans Ctrl+S');
    FS['ailleurs/Neuf.conceptcad']='';delete IDB['mff:bak:Neuf.conceptcad'];let al='';alert=m=>{al=m;};
    okO=await mffOpenHandle(mkFile('ailleurs/Neuf.conceptcad'));
    att(!okO&&/Aucune copie/.test(al)&&doc.params[0].value===12,'19 : fichier vide sans copie : message clair, modèle intact');
    // ── 11. V1.0.2 : deux Ctrl+S qui se chevauchent (grosse pièce, disque lent) ──
    // Avant : la relecture du premier lisait le fichier du second, remettait l'ancienne version et
    // ouvrait « Enregistrer sous » ; le second annonçait « Enregistré » sur la version d'avant.
    const lent=ms=>new Promise(res=>setTimeout(res,ms));
    let nEcr=0;
    const mkLent=p=>Object.assign(mkFile(p),{
      async getFile(){await lent(40);const t=FS[p];return {name:p.split('/').pop(),size:t.length,lastModified:1,text:async()=>t};},
      async createWritable(){let buf='';return {write:async t=>{buf=t;},close:async()=>{await lent(30);FS[p]=buf;nEcr++;},abort:async()=>{}};}});
    const MSG=[];const fe=faceEl;let feTxt='';
    Object.defineProperty(fe,'textContent',{configurable:true,get(){return feTxt;},set(v){feTxt=String(v);MSG.push(feTxt);}});
    FS['lent/Plaque.conceptcad']=await bundleSerialise();
    const hl=mkLent('lent/Plaque.conceptcad');mffHandle=hl;mffName='Plaque';mffMark();
    doc.params[0].expr='20';doc.params[0].value=20;
    const sA=mffSave();await lent(20);const sB=mffSave();
    const rr=await Promise.all([sA,sB]);
    const lu=JSON.parse(FS['lent/Plaque.conceptcad']);
    att(rr[0]===true&&rr[1]===true&&lu.doc.params&&lu.doc.params[0].value===20&&!MSG.some(m=>/impossible|Enregistrer sous/.test(m)),
      '20 : deux Ctrl+S qui se chevauchent : la pièce modifiée (e = 20) est sur le disque, ni erreur ni « Enregistrer sous » ('+MSG.filter(m=>/impossible/.test(m)).join(' | ').slice(0,120)+')');
    att(nEcr===1&&!mffModified(),'21 : le second attend le premier et ne réécrit pas une pièce inchangée ('+nEcr+' écriture(s))');
    att(MSG.some(m=>/^Enregistrement de Plaque\\.conceptcad…$/.test(m)),'22 : « Enregistrement de … » affiché dès le début (pas de second Ctrl+S faute de signe)');
    // trois demandes d'affilée (bouton + raccourci, ou Ctrl+S tapé deux fois) : une seule écriture
    doc.params[0].expr='22';doc.params[0].value=22;nEcr=0;
    const r3=await Promise.all([mffSave(),mffSave(),mffSave()]);
    att(r3.every(x=>x===true)&&nEcr===1&&JSON.parse(FS['lent/Plaque.conceptcad']).doc.params[0].value===22,'23 : trois demandes d’affilée : une écriture, la dernière version sur le disque ('+nEcr+')');
    // ── 12. V1.0.2 : fichier bloqué un instant par un autre logiciel (Dropbox, antivirus) ──
    FS['ailleurs/Bloque.conceptcad']=v1;const hb=mkFile('ailleurs/Bloque.conceptcad');let bloque=2;
    const cw=hb.createWritable;hb.createWritable=async function(){const w=await cw.call(this);const c=w.close;w.close=async()=>{if(bloque>0){bloque--;throw new Error('Accès refusé. (os error 5)');}return c();};return w;};
    err='';try{await mffWriteSafe(hb,v2);}catch(e){err=e.message;}
    att(!err&&bloque===0&&FS['ailleurs/Bloque.conceptcad']===v2,'24 : fichier bloqué deux fois de suite : nouvel essai, enregistré ('+(err||'ok')+')');
    FS['ailleurs/Perm.conceptcad']=v1;const hp=mkFile('ailleurs/Perm.conceptcad');let nPerm=0;
    hp.createWritable=async()=>{nPerm++;throw Object.assign(new Error('refus'),{name:'NotAllowedError'});};
    err='';try{await mffWriteSafe(hp,v2);}catch(e){err=e.message;}
    att(/refus/.test(err)&&nPerm===1&&FS['ailleurs/Perm.conceptcad']===v1,'25 : permission refusée : pas de nouvel essai, original intact ('+nPerm+' essai)');
    // ── 13. V1.2.1 (Fred, 28/11 : « je sauvegarde, rien de visible », puis Nouveau → Enregistrer : « rien ») ──
    // une étape qui ne répond jamais (question d'autorisation invisible, fichier verrouillé) ne bloque plus tout
    MFF_DELAI={perm:60,disque:60,donnees:2000};
    const jamais=()=>new Promise(()=>{});
    FS['ailleurs/Muet.conceptcad']=v1;const hm=mkFile('ailleurs/Muet.conceptcad');
    hm.queryPermission=async()=>'prompt';hm.requestPermission=jamais;
    mffHandle=hm;mffName='Muet';doc.params[0].expr='30';doc.params[0].value=30;MSG.length=0;
    const t0=Date.now();const rm=await Promise.race([mffSave().then(v=>({v})),lent(3000).then(()=>'bloqué')]);
    att(rm!=='bloqué'&&Date.now()-t0<2500&&MSG.some(m=>/autorisation/.test(m))&&FS['ailleurs/Muet.conceptcad']===v1,
      '26 : autorisation d’écrire sans réponse : l’enregistrement s’arrête et le dit, le fichier est intact ('+(rm==='bloqué'?rm:MSG.filter(m=>/autorisation/.test(m)).pop())+')');
    mffHandle=h;const rs=await Promise.race([mffSave(),lent(3000).then(()=>'bloqué')]);
    att(rs===true&&JSON.parse(FS['projets/pieces/Bride.miniFusion']).doc.params[0].value===30,'27 : l’enregistrement suivant n’attend pas derrière lui : écrit (e = 30)');
    FS['ailleurs/Fige.conceptcad']=v1;const hf=mkFile('ailleurs/Fige.conceptcad');hf.createWritable=jamais;
    err='';try{await Promise.race([mffWriteSafe(hf,v2),lent(3000).then(()=>{throw new Error('bloqué');})]);}catch(e){err=e.message;}
    att(/aucune réponse/.test(err)&&FS['ailleurs/Fige.conceptcad']===v1,'28 : fichier qui ne s’ouvre jamais en écriture : erreur claire, original intact ('+err.slice(0,70)+')');
    let tst=null;try{tst=document.getElementById('mffToast');}catch(e){}
    att(!!tst&&/^⚠|^✔/.test(tst.textContent||''),'29 : bandeau d’enregistrement visible au-dessus de la vue ('+(tst&&tst.textContent||'absent').slice(0,60)+')');
    // ── 14. V1.2.2 (Fred, 28/11 : « les enregistrements en local sont longs voire n'aboutissent pas ») ──
    // écriture qui dépasse le délai : jamais relancée par-dessus elle-même (elle peut encore se finir)
    FS['ailleurs/Long.conceptcad']=v1;const hL=mkFile('ailleurs/Long.conceptcad');let nL=0;
    hL.createWritable=async()=>{nL++;return {write:async()=>{},close:jamais,abort:async()=>{}};};
    err='';try{await Promise.race([mffWriteSafe(hL,v2),lent(3000).then(()=>{throw new Error('bloqué');})]);}catch(e){err=e.message;}
    att(/aucune réponse/.test(err)&&nL===1&&FS['ailleurs/Long.conceptcad']===v1,'30 : écriture plus longue que le délai : arrêt dit, pas de nouvel essai par-dessus ('+nL+' ouverture)');
    // envoi NumPLans (lien qui n'est pas un fichier du disque) : il a le temps qu'il lui faut
    FS['np/1234.conceptcad']=v1;const hN=Object.assign(mkLent('np/1234.conceptcad'),{numplans:true});
    const cwN=hN.createWritable;hN.createWritable=async function(){const w=await cwN.call(this);const c=w.close;w.close=async()=>{await lent(200);return c();};return w;};
    err='';try{await mffWriteSafe(hN,v2);}catch(e){err=e.message;}
    att(!err&&FS['np/1234.conceptcad']===v2,'31 : envoi à NumPLans plus long que le délai du disque : enregistré ('+(err||'ok')+')');
    // bandeau : étape en cours, puis durée et étape la plus longue
    const tN=performance.now();
    mffEt={t0:tN-5000,nom:null,t:tN-5000,liste:[]};mffToast('Enregistrement de X…','cours');
    mffEt.nom='préparation du fichier';mffEt.t=tN-1000;mffEtape('écriture sur le disque');mffEt.t=tN-4000;mffToastMaj();
    const enCours=tst.textContent;const bil=mffEtBilan();mffEt=null;mffToast('fin','ok');
    att(/écriture sur le disque \\(4 s\\)/.test(enCours)&&/en 5 s ; le plus long : écriture sur le disque, 4 s/.test(bil),'32 : bandeau : étape en cours avec ses secondes, puis la durée et l’étape la plus longue ('+enCours.slice(-40)+' |'+bil+')');
    // ── 15. V1.2.3 (Fred, 28/11 : bandeau « copie de la version précédente (70 s) », modification pas enregistrée) ──
    // copie de secours dans le navigateur qui ne répond jamais (IndexedDB occupée par une autre fenêtre) : le fichier est écrit quand même
    MFF_DELAI.copie=60;const idbSet0=idbSet;idbSet=jamais;
    mffHandle=h;doc.params[0].expr='34';doc.params[0].value=34;
    const rc=await Promise.race([mffSave(),lent(3000).then(()=>'bloqué')]);idbSet=idbSet0;
    att(rc===true&&JSON.parse(FS['projets/pieces/Bride.miniFusion']).doc.params[0].value===34&&FS['projets/pieces/Bride.miniFusion.bak'],
      '33 : copie de secours dans le navigateur sans réponse : la pièce est enregistrée quand même (e = 34), copie sur le disque faite ('+rc+')');
    // ── 16. V1.2.4 (Fred, 28/11 : « Pourquoi c'est si long pour un fichier de 268 Ko ? ») ──
    // le fichier d'abord ; la copie dans le navigateur ensuite, sans l'attendre
    MFF_DELAI.copie=60;const ordre=[];idbSet=async(k,v)=>{ordre.push(k);await jamais();};
    const cwB=h.createWritable;
    mffHandle=h;doc.params[0].expr='36';doc.params[0].value=36;
    const t36=Date.now();const r36=await Promise.race([mffSave(),lent(3000).then(()=>'bloqué')]);
    att(r36===true&&Date.now()-t36<1500&&JSON.parse(FS['projets/pieces/Bride.miniFusion']).doc.params[0].value===36&&ordre.filter(k=>/^mff:bak:/.test(k)).length===1,
      '34 : copie dans le navigateur qui ne finit pas : la pièce est enregistrée tout de suite (e = 36, '+(Date.now()-t36)+' ms) '+JSON.stringify([r36,JSON.parse(FS['projets/pieces/Bride.miniFusion']).doc.params[0].value,ordre,feTxt]));
    // avant Nouveau / Ouvrir : aucune copie dans le navigateur
    ordre.length=0;doc.params[0].expr='38';doc.params[0].value=38;mffAsk=async()=>'save';
    const r38=await Promise.race([mffConfirmDiscard(),lent(3000).then(()=>'bloqué')]);idbSet=idbSet0;
    att(r38===true&&JSON.parse(FS['projets/pieces/Bride.miniFusion']).doc.params[0].value===38&&!ordre.some(k=>/^mff:bak:/.test(k)),
      '35 : « Enregistrer » avant Nouveau / Ouvrir : fichier écrit (e = 38), rien remis dans la mémoire du navigateur ('+ordre.join(',')+')');
    delete fe.textContent;
    return {ATT,OK};
  `;
  const o=await vm.runInContext('(async function(){'+R+'})()',ctx);
  console.log('=== V0.8.3 : enregistrement sûr, copie .bak ===');
  o.OK.forEach(m=>console.log('  ✓ '+m));
  if(o.ATT.length){o.ATT.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.ATT.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
