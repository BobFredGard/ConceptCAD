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
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'dossier.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
