// V0.99.83 : le nom du fichier va à la RACINE de l'assemblage, jamais à la pièce en cours de
// modification. Fichier de Fred (MERLIN-39-000, 25/11) : enregistré pendant qu'il modifiait la
// pièce liée MERLIN-39-001 (doc de premier niveau = composant actif), rouvert → la pièce prenait le
// nom du fichier hôte et s'affichait « MERLIN-39-000:1 ». 90-50 bundleNomFichier / docNomFichier ;
// 46 asmLinkNomsRepare répare à l'ouverture les fichiers déjà touchés. Modèle seul, dossier de
// projets simulé en mémoire (comme test_composants_lies).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    confirm=function(){return true;};alert=function(m){p("alerte : "+m);};showAll=function(){};
    const FS={};
    const mkFile=path=>({kind:'file',name:path.split('/').pop(),_p:path,
      async getFile(){if(!(path in FS))throw new Error('NotFound');return {name:path.split('/').pop(),text:async()=>FS[path]};},
      async createWritable(){let buf='';return {write:async t=>{buf=t;},close:async()=>{FS[path]=buf;}};},
      async queryPermission(){return 'granted';},async requestPermission(){return 'granted';},
      async isSameEntry(o){return !!o&&o._p===path;}});
    const mkDir=prefix=>({kind:'directory',
      async getDirectoryHandle(n){return mkDir(prefix+n+'/');},
      async getFileHandle(n){const q=prefix+n;if(!(q in FS))throw new Error('NotFound');return mkFile(q);},
      async resolve(h){return h&&h._p&&h._p.startsWith(prefix)?h._p.slice(prefix.length).split('/'):null;},
      async queryPermission(){return 'granted';},async requestPermission(){return 'granted';}});
    mffFolder=mkDir('');
    const piece=nm=>{docResetEmpty();doc.name=nm;FS[nm+'.conceptcad']=serialise();};
    piece('MERLIN-39-001');piece('MERLIN-39-002');
    const lier=async nm=>asmLinkInsert(mkFile(nm+'.conceptcad'),FS[nm+'.conceptcad'],nm+'.conceptcad');
    const ouvrir=async(txt,nm)=>{await bundleRestore(txt,{name:nm,rebuild:false});asmNamesSync();};
    const parLien=nm=>asm.comps.find(c=>c.link&&c.link.name===nm+'.conceptcad');
    const occDe=c=>asmCompOccs(c.id).map(o=>o.name).join(',');
    // ── l'assemblage de Fred : deux pièces liées ──
    docResetEmpty();doc.name='MERLIN-39-000';asmEnsure();
    const A=await lier('MERLIN-39-001'),B=await lier('MERLIN-39-002');
    att(A.name==='MERLIN-39-001'&&B.name==='MERLIN-39-002'&&occDe(A)==='MERLIN-39-001:1','1 : pièces liées nommées d après leur fichier');
    // ── enregistré pendant qu'on modifie la 001, puis rouvert ──
    asmActivatePath([asmCompOccs(A.id)[0].id]);
    att(asmActiveComp()===A&&doc===A.doc,'2 : la 001 est la pièce en cours de modification');
    let txt=await mffData();
    att(JSON.parse(txt).doc.name==='MERLIN-39-001','3 : (le document de premier niveau du fichier est bien la 001)');
    await ouvrir(txt,'MERLIN-39-000');
    let a=parLien('MERLIN-39-001');
    att(a&&a.name==='MERLIN-39-001'&&a.doc.name==='MERLIN-39-001'&&occDe(a)==='MERLIN-39-001:1','4 : rouvert : la 001 garde son nom (avant : MERLIN-39-000 et MERLIN-39-000:1)');
    att(asmRoot().name==='MERLIN-39-000'&&asmRoot().doc.name==='MERLIN-39-000','5 : la racine porte le nom du fichier');
    att(asmActiveComp()===a&&doc.name==='MERLIN-39-001','6 : on rouvre toujours dans la 001');
    att(parLien('MERLIN-39-002').name==='MERLIN-39-002','7 : la 002 n a pas bougé');
    // ── même fichier rouvert sous un autre nom : la racine suit, la pièce non ──
    await ouvrir(txt,'Ensemble B');
    att(asmRoot().name==='Ensemble B'&&parLien('MERLIN-39-001').name==='MERLIN-39-001','8 : fichier renommé : la racine prend le nouveau nom, la pièce garde le sien');
    // ── racine active : comme avant ──
    asmActivatePath([]);
    att(asmActiveComp()===asmRoot(),'9 : (racine active)');
    txt=await mffData();
    await ouvrir(txt,'Ensemble C');
    att(asmRoot().name==='Ensemble C'&&doc.name==='Ensemble C'&&parLien('MERLIN-39-001').name==='MERLIN-39-001','10 : racine active : elle prend le nom du fichier, comme avant');
    // ── « Enregistrer sous » / ancien .json pendant qu'on modifie une pièce ──
    a=parLien('MERLIN-39-001');asmActivatePath([asmCompOccs(a.id)[0].id]);
    docNomFichier('Ensemble D');asmNamesSync();
    att(asmRoot().name==='Ensemble D'&&a.name==='MERLIN-39-001'&&doc.name==='MERLIN-39-001'&&occDe(a)==='MERLIN-39-001:1','11 : nouveau nom de fichier pendant la modification d une pièce : la racine le prend');
    await deserialise(serialise(),{rebuild:false});docNomFichier('Ensemble E');asmNamesSync();
    att(asmRoot().name==='Ensemble E'&&parLien('MERLIN-39-001').name==='MERLIN-39-001','12 : ancien format (.json) : idem');
    // ── fichier déjà abîmé (comme MERLIN-39-000 sur le serveur) : réparé à l'ouverture ──
    asmActivatePath([]);asmRoot().doc.name='MERLIN-39-000';asmNamesSync();
    a=parLien('MERLIN-39-001');
    const casse=c=>{c.name='MERLIN-39-000';c.doc.name='MERLIN-39-000';asmCompOccs(c.id).forEach(o=>{o.name=o.name.replace(/^MERLIN-39-00\\d/,'MERLIN-39-000');});};
    casse(a);
    const nl=asmNewComp('Thermique - iC60');nl.comp.name='Vis libre';nl.comp.doc.name='Vis libre';
    const B2=parLien('MERLIN-39-002');B2.name='Roue avant';B2.doc.name='Roue avant';
    asmCompOccs(B2.id).forEach(o=>{o.name='Roue avant:1';});
    // comme le vrai fichier : nom donné à l'ouverture, rien « à écrire » (pas de pend ; ici, la
    // première activation sans rejeu du test laissait un pend des étapes précédentes)
    asmLinked().forEach(c=>{delete c.link.pend;});asmLinkRebase();
    txt=await mffData();
    att(!JSON.parse(txt).doc.asm.comps.some(c=>c.link&&c.link.pend),'13b : (fichier abîmé sans modification en attente)');
    att(JSON.parse(txt).doc.asm.comps.filter(c=>c.name==='MERLIN-39-000').length===2,'13 : (fichier abîmé : la 001 porte le nom de l assemblage)');
    await ouvrir(txt,'MERLIN-39-000');asmLinkRebase();
    a=parLien('MERLIN-39-001');
    att(a.name==='MERLIN-39-001'&&a.doc.name==='MERLIN-39-001'&&occDe(a)==='MERLIN-39-001:1','14 : réparé à l ouverture : nom, document et occurrence de la 001');
    att(asmRoot().name==='MERLIN-39-000','15 : la racine garde son nom');
    att(parLien('MERLIN-39-002').name==='Roue avant'&&occDe(parLien('MERLIN-39-002'))==='Roue avant:1','16 : pièce liée renommée exprès : gardée');
    att(asm.comps.some(c=>c.name==='Vis libre'&&!c.link),'17 : composant non lié : jamais touché');
    att(!asmLinkDirty(a),'18 : la réparation ne demande pas de réécrire la source');
    txt=await mffData();await ouvrir(txt,'MERLIN-39-000');
    att(parLien('MERLIN-39-001').name==='MERLIN-39-001'&&asmLinkNomsRepare()===0,'19 : enregistré puis rouvert : rien à réparer');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'nom_fichier.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
