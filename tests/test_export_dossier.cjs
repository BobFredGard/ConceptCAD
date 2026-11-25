// V0.99.70 : « Assemblage → dossier » (src/90-42-export-dossier.js). Dossier de projets SIMULÉ
// en mémoire (comme test_composants_lies) : l'assemblage, ses pièces liées (lien imbriqué
// compris) copiés avec leurs sous-dossiers ; les copies pointent vers les copies ; les
// originaux ne bougent pas ; modification pas encore enregistrée incluse ; fichiers déjà là
// → question ; dossier hors du dossier de projets → handle mémorisé, essayé d'abord ;
// la copie de l'assemblage rouverte ne voit aucun changement dans ses sources.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    confirm=function(){return true;};alert=function(m){p("alerte : "+m);};
    const near=(a,b,t)=>Array.isArray(a)&&a.length===3&&a.every((x,i)=>Math.abs(x-b[i])<(t||1e-7));
    const FR=(id,name,o)=>({id,kind:'frame',how:'zx',name,refs:[],p:{},at:null,visible:true,fr:{o,x:[1,0,0],y:[0,1,0],z:[0,0,1]},st:'ok',msg:''});
    const FS={};
    const mkFile=path=>({kind:'file',name:path.split('/').pop(),_p:path,
      async getFile(){if(!(path in FS))throw new Error('NotFound');return {name:path.split('/').pop(),text:async()=>FS[path]};},
      async createWritable(){let buf='';return {write:async t=>{buf=t;},close:async()=>{FS[path]=buf;}};},
      async queryPermission(){return 'granted';},async requestPermission(){return 'granted';},
      async isSameEntry(o){return !!o&&o._p===path;}});
    const mkDir=(prefix,name,root)=>({kind:'directory',name:name||'projets',_d:prefix,
      async getDirectoryHandle(n){return mkDir(prefix+n+'/',n,root);},
      async getFileHandle(n,o){const q=prefix+n;if(!(q in FS)){if(o&&o.create)FS[q]='';else throw new Error('NotFound');}return mkFile(q);},
      async resolve(h){const s=h&&(h._p||h._d);if(s==null||!s.startsWith(prefix))return null;return s.slice(prefix.length).split('/').filter(Boolean);},
      async queryPermission(){return 'granted';},async requestPermission(){return 'granted';}});
    const IDB=new Map();idbSet=async(k,v)=>{IDB.set(k,v);};idbGet=async k=>IDB.get(k);
    mffPack=async t=>t; // fichiers en clair : lisibles par le test
    mffFolder=mkDir('');
    // ── les sources : une roue, une vis, un essieu (assemblage qui lie la roue) ──
    docResetEmpty();doc.name='Roue';doc.cgeo.push(FR('moyeu','Moyeu',[0,0,10]));
    FS['Pieces/Roue.miniFusion']=serialise();
    docResetEmpty();doc.name='Vis';doc.cgeo.push(FR('tete','Tête',[0,0,6]));
    FS['Visserie/Vis.miniFusion']=serialise();
    docResetEmpty();doc.name='Essieu';asmEnsure();
    await asmLinkInsert(mkFile('Pieces/Roue.miniFusion'),FS['Pieces/Roue.miniFusion'],'Roue.miniFusion');
    FS['Pieces/Essieu.miniFusion']=serialise();
    // ── l'hôte : un chariot (Moteur/Chariot) qui lie l'essieu et la vis ──
    docResetEmpty();doc.name='Chariot';asmEnsure();
    const E=await asmLinkInsert(mkFile('Pieces/Essieu.miniFusion'),FS['Pieces/Essieu.miniFusion'],'Essieu.miniFusion');
    const V=await asmLinkInsert(mkFile('Visserie/Vis.miniFusion'),FS['Visserie/Vis.miniFusion'],'Vis.miniFusion');
    mffHandle=mkFile('Moteur/Chariot.miniFusion');FS['Moteur/Chariot.miniFusion']=serialise();
    const nested=asmLinked().find(c=>c!==E&&c!==V);
    att(E&&V&&nested&&nested.name==='Roue'&&packDepth(nested)===1&&packDepth(E)===0,'1 : lien imbriqué (roue dans l essieu)');
    // modification pas encore enregistrée de la vis
    V.doc.cgeo[0].fr.o=[0,0,8];
    const orig={};Object.keys(FS).forEach(k=>orig[k]=FS[k]);
    // ── copie dans un dossier du dossier de projets ──
    let b=await packRun(mkDir('Copie/','Copie'),{cn:false});
    const C=k=>FS['Copie/'+k];
    att(b&&b.host==='Moteur/Chariot.miniFusion'&&b.parts.length===3&&!b.failed.length,'2 : assemblage + 3 pièces copiés ('+JSON.stringify(b)+')');
    att(C('Moteur/Chariot.miniFusion')&&C('Visserie/Vis.miniFusion')&&C('Pieces/Roue.miniFusion')&&C('Pieces/Essieu.miniFusion'),'3 : sous-dossiers gardés');
    att(Object.keys(orig).every(k=>FS[k]===orig[k]),'4 : originaux inchangés');
    const host=JSON.parse(C('Moteur/Chariot.miniFusion'));
    const hl=(host.doc||host).asm.comps.filter(c=>c.link);
    att(hl.length===3&&hl.every(c=>/^Copie\\//.test(c.link.rel)&&!c.link.key&&!c.link.pend),'5 : les liens de l assemblage copié vont vers les copies');
    const lv=hl.find(c=>c.name==='Vis');
    att(lv&&lv.link.sig===asmHash(C('Visserie/Vis.miniFusion')),'6 : empreinte = copie écrite');
    const vis=JSON.parse(C('Visserie/Vis.miniFusion'));
    att(near((vis.doc||vis).cgeo[0].fr.o,[0,0,8]),'7 : modification pas encore enregistrée incluse');
    const es=JSON.parse(C('Pieces/Essieu.miniFusion'));
    const el=(es.doc||es).asm.comps.find(c=>c.link);
    att(el&&el.link.rel==='Copie/Pieces/Roue.miniFusion'&&el.link.sig===asmHash(C('Pieces/Roue.miniFusion')),'8 : lien imbriqué de l essieu copié → roue copiée');
    // ── fichiers déjà là : question, refus → rien d'écrit ──
    let asked=0;FS['Copie/Visserie/Vis.miniFusion']='x';
    b=await packRun(mkDir('Copie/','Copie'),{cn:false,ask:async()=>{asked++;return false;}});
    att(asked===1&&b===null&&FS['Copie/Visserie/Vis.miniFusion']==='x','9 : déjà là → une question, refus respecté');
    b=await packRun(mkDir('Copie/','Copie'),{cn:false,ask:async()=>true});
    att(b&&FS['Copie/Visserie/Vis.miniFusion']!=='x','10 : accepté → remplacé');
    // ── dossier hors du dossier de projets ──
    const D=mkDir('USB/','Clé USB');
    b=await packRun(Object.assign(D,{_d:undefined}),{cn:false});
    const hx=JSON.parse(FS['USB/Moteur/Chariot.miniFusion']);
    const lx=(hx.doc||hx).asm.comps.filter(c=>c.link);
    att(b&&b.outside&&lx.length===3&&lx.every(c=>c.link.key&&IDB.get(c.link.key)&&IDB.get(c.link.key)._p.startsWith('USB/')&&!/^USB/.test(c.link.rel)),'11 : hors du dossier de projets → handle mémorisé + chemin relatif');
    {const L={link:lx.find(c=>c.name==='Vis').link};const r=await asmLinkHandle(L,false);
     att(r.h&&r.h._p==='USB/Visserie/Vis.miniFusion','12 : le handle passe avant le chemin (pas l original du même nom)');}
    // ── la copie rouverte : liens vers les copies, rien de changé dans les sources ──
    const txt=FS['Copie/Moteur/Chariot.miniFusion'];
    {const o=JSON.parse(txt);await deserialise(JSON.stringify(o.bundle===1?o.doc:o),{rebuild:false});asmLinkRebase();}
    const lk=asmLinked();
    att(lk.length===3&&lk.every(c=>/^Copie\\//.test(c.link.rel)),'13 : copie rouverte : 3 liens vers les copies');
    const rc=await asmLinksCheck(false);
    att(rc&&!rc.updated.length&&!rc.warn.length&&lk.every(c=>c.link.st!=='warn'),'14 : sources copiées à jour ('+JSON.stringify(rc)+')');
    att(packCnList().length===0,'15 : aucune pièce avec FAO : pas de programme');
    // ── V0.99.79 : sources des Dérivées copiées aussi (demande de Fred) ──
    // Base ← Barquette (dérive de Base) ← Moule (dérive de Barquette ET de l'assemblage Presse,
    // qui le lie : cycle) ; Presse dérive aussi de Base (empreinte en retard) et d'un fichier absent.
    const dv=(id,rel,sig,src,name,value)=>({id,rel,key:null,name:rel.split('/').pop(),sig,auto:false,params:[{src,name,value}]});
    docResetEmpty();doc.name='Base';doc.params=[{name:'E',expr:'5',value:5}];
    FS['Cotes/Base.miniFusion']=serialise();
    docResetEmpty();doc.name='Barquette';doc.params=[{name:'L',expr:'120',value:120}];
    doc.derive=[dv('dvB','Cotes/Base.miniFusion',asmHash(FS['Cotes/Base.miniFusion']),'E','E',5)];
    FS['Cotes/Barquette.miniFusion']=serialise();
    docResetEmpty();doc.name='Moule';
    doc.derive=[dv('dvQ','Cotes/Barquette.miniFusion',asmHash(FS['Cotes/Barquette.miniFusion']),'L','L',120),
      dv('dvH','Atelier/Presse.miniFusion','ancienne','P','P',3)];
    FS['Pieces/Moule.miniFusion']=serialise();
    docResetEmpty();doc.name='Presse';doc.params=[{name:'P',expr:'3',value:3}];
    doc.derive=[dv('dvE','Cotes/Base.miniFusion','vieille','E','E2',5),dv('dvX','Cotes/Absente.miniFusion','x','Z','Z',1)];
    asmEnsure();
    const M=await asmLinkInsert(mkFile('Pieces/Moule.miniFusion'),FS['Pieces/Moule.miniFusion'],'Moule.miniFusion');
    mffHandle=mkFile('Atelier/Presse.miniFusion');FS['Atelier/Presse.miniFusion']=serialise();
    att(M&&M.doc.derive&&M.doc.derive.length===2,'16 : pièce liée avec ses deux dérivées');
    const orig2={};Object.keys(FS).forEach(k=>orig2[k]=FS[k]);
    b=await packRun(mkDir('Copie2/','Copie2'),{cn:false});
    const C2=k=>FS['Copie2/'+k];
    att(b&&b.host==='Atelier/Presse.miniFusion'&&b.parts.length===1&&b.derived.length===2
      &&b.derived.includes('Cotes/Barquette.miniFusion')&&b.derived.includes('Cotes/Base.miniFusion'),'17 : sources des dérivées copiées, de proche en proche ('+JSON.stringify(b)+')');
    att(b&&b.failed.length===1&&/source de dérivée « Absente/.test(b.failed[0]),'18 : source introuvable signalée ('+(b&&b.failed)+')');
    att(packBilanCourt(b).includes('1 pièce(s) liée(s), 2 pièce(s) source(s) de dérivée')&&packBilanLong(b).includes('pièce source de dérivée : Cotes/Base'),'19 : bilan ('+packBilanCourt(b)+')');
    att(Object.keys(orig2).every(k=>FS[k]===orig2[k]),'20 : originaux inchangés');
    att(C2('Cotes/Base.miniFusion')===FS['Cotes/Base.miniFusion'],'21 : source sans lien copiée à l octet près');
    const bq=JSON.parse(C2('Cotes/Barquette.miniFusion')),lb=(bq.doc||bq).derive[0];
    att(lb.rel==='Copie2/Cotes/Base.miniFusion'&&lb.name==='Base.miniFusion'&&lb.sig===asmHash(C2('Cotes/Base.miniFusion')),'22 : dérivée d une source → sa copie');
    const mo=JSON.parse(C2('Pieces/Moule.miniFusion')),dq=(mo.doc||mo).derive;
    const q1=dq.find(L=>L.id==='dvQ'),q2=dq.find(L=>L.id==='dvH');
    att(q1&&q1.rel==='Copie2/Cotes/Barquette.miniFusion'&&q1.sig===asmHash(C2('Cotes/Barquette.miniFusion')),'23 : à jour avec l original → à jour avec la copie');
    att(q2&&q2.rel==='Copie2/Atelier/Presse.miniFusion'&&q2.sig==='ancienne','24 : dérivée de l assemblage (écrit après) → sa copie, empreinte gardée');
    const hd=JSON.parse(C2('Atelier/Presse.miniFusion'));const hdoc=hd.doc||hd;
    const e1=hdoc.derive.find(L=>L.id==='dvE'),e2=hdoc.derive.find(L=>L.id==='dvX');
    att(e1&&e1.rel==='Copie2/Cotes/Base.miniFusion'&&e1.sig==='vieille','25 : en retard avec l original → reste en retard (mise à jour à l ouverture)');
    att(e2&&e2.rel==='Cotes/Absente.miniFusion'&&e2.sig==='x','26 : source introuvable : lien laissé tel quel');
    const mc=hdoc.asm.comps.find(c=>c.link);
    const mcd=mc&&mc.doc&&(mc.doc.derive||[]).find(L=>L.id==='dvQ');
    att(mc&&mc.link.rel==='Copie2/Pieces/Moule.miniFusion'&&mcd&&mcd.rel==='Copie2/Cotes/Barquette.miniFusion','27 : copie de la pièce gardée dans l assemblage : dérivée vers la copie');
    // hors du dossier de projets : handle mémorisé (même pour l'assemblage, écrit après) + chemin relatif
    b=await packRun(Object.assign(mkDir('USB2/','Clé 2'),{_d:undefined}),{cn:false});
    const mo2=JSON.parse(FS['USB2/Pieces/Moule.miniFusion']),d2=(mo2.doc||mo2).derive;
    const k1=d2.find(L=>L.id==='dvQ'),k2=d2.find(L=>L.id==='dvH');
    att(b&&b.outside&&k1&&k1.key&&IDB.get(k1.key)&&IDB.get(k1.key)._p==='USB2/Cotes/Barquette.miniFusion'&&k1.rel==='Cotes/Barquette.miniFusion','28 : hors du dossier de projets : handle + chemin relatif');
    att(k2&&k2.key&&IDB.get(k2.key)&&IDB.get(k2.key)._p==='USB2/Atelier/Presse.miniFusion','29 : handle de l assemblage mémorisé (écrit après la pièce)');
    {const r=await asmLinkHandle({link:k1},false,'read');att(r.h&&r.h._p==='USB2/Cotes/Barquette.miniFusion','30 : la copie retrouve la source copiée, pas l originale');}
    // la pièce copiée rouverte : ses dérivées lisent les copies, la source à jour n'est pas relue
    {const o=JSON.parse(C2('Pieces/Moule.miniFusion'));docResetEmpty();await deserialise(JSON.stringify(o.bundle===1?o.doc:o),{rebuild:false});}
    const rd=await derCheck(false);
    const lq=doc.derive.find(L=>L.id==='dvQ'),lh=doc.derive.find(L=>L.id==='dvH');
    att(rd&&!rd.warn.length&&!rd.updated.length&&lq.st==='ok'&&lh.st==='ok'&&parValueNow('L')===120&&parValueNow('P')===3,'31 : copie rouverte : dérivées à jour depuis les copies ('+JSON.stringify(rd)+')');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'dossier.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
