// V1.0.6 : icônes des pièces normalisées (48-composants-icones), modèle seul, sans noyau.
// Demande de Fred : « Dans la timeline de l'assemblage, si le composant entré est un composant
// normalisé, l'icône devrait être identique au composant : 1 vis -> dessin de la vis etc... ».
// Chaque type de chaque onglet de la fenêtre « Composants normalisés » a son dessin ; une pièce
// d'un fichier ancien (clé seule, sans réglages enregistrés) a le même ; chaque dessin est un SVG
// bien formé dont les dégradés sont définis dans le dessin même, sous des identifiants neufs ;
// étape d'insertion de la timeline, arborescence (occurrence et groupe ×N) : le dessin pour une
// pièce normalisée, le cube pour une pièce ordinaire ; famille inconnue : 🔩.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    confirm=function(){return true;};alert=function(){};
    // 1. chaque type de chaque onglet : le bon dessin (fiche complète, puis clé seule)
    const EXP={iso:{chc:'chc',fhc:'fhc'},ansi:{chc:'chc',fhc:'fhc'},plug:{din906:'plugCone',din908:'plug908',nptf:'plugCone'},
      pin:{iso2338:'pin',iso8734:'pin',iso2339:'pinCone',iso8752:'pinSpring',dowel:'pin',spring:'pinSpring'},
      key:{A:'keyA',B:'keyB',C:'keyC'},oring:{o:'oring',x:'xring'},wiper:{'':'wiper'},
      washer:{iso7089:'washer',iso7090:'washer',iso7092:'washer',iso7093:'washer',din127:'grower',ansiN:'washer',ansiW:'washer',ansiLock:'grower'},
      insert:{iso:'insert',ansi:'insert'},gear:{ext:'gear',int:'gearInt',rack:'rack'},
      magnet:{cyl:'magCyl',cube:'magCube',box:'magBox',ring:'magRing',cone:'magCone',cs:'magCs',csq:'magBox'}};
    const kf={iso:'type',ansi:'type',plug:'type',pin:'type',key:'type',oring:'kind',wiper:null,washer:'type',insert:'type',gear:'kind',magnet:'shape'};
    let n=0;
    Object.keys(EXP).forEach(cat=>{
      const C=stdCat(cat);att(C.k===cat,'1 : onglet '+cat+' introuvable');
      const f=kf[cat],opts=f?C.fields.find(q=>q.k===f).opts({}).map(o=>o[0]):[''];
      att(opts.length===Object.keys(EXP[cat]).length,'1b : '+cat+' : '+opts.length+' types, '+Object.keys(EXP[cat]).length+' attendus');
      opts.forEach(v=>{
        const st=f?{[f]:v}:{},sp=stdSpec(cat,st),std=stdDoc(sp).std,want=EXP[cat][v];n++;
        att(stdIcKind(std)===want,'1c : '+cat+' '+v+' ('+sp.name+') : '+stdIcKind(std)+' au lieu de '+want);
        const old={key:std.key,norm:std.norm,desig:std.desig};if(std.mag)old.mag=std.mag; // fichier V0.21.0 : ni cat ni st
        att(stdIcKind(old)===want,'1d : '+cat+' '+v+' sans réglages enregistrés : '+stdIcKind(old)+' au lieu de '+want);
      });
    });
    att(n>=39,'1e : '+n+' types seulement');
    // la paire d'engrenages donne deux roues : chacune la sienne
    {const sp=stdSpec('gearPair',{kind:'rack'});const K=sp.pair.map(q=>stdIcKind(stdDoc(q.sp).std)).join(',');
      att(K==='gear,rack','1f : paire pignon + crémaillère : '+K);}
    // 2. chaque dessin : SVG bien formé, dégradés définis dans le dessin, identifiants neufs
    const KINDS=['chc','fhc','plug908','plugCone','pin','pinCone','pinSpring','keyA','keyB','keyC','oring','xring','wiper','washer','grower','insert','gear','gearInt','gearPair','rack','magCyl','magCs','magRing','magCone','magCube','magBox'];
    const ids=new Set();
    KINDS.forEach(k=>{
      const s=stdIcSvg(k);
      att(/^<svg class="stdIc" data-std="/.test(s)&&/<\\/svg>$/.test(s),'2 : '+k+' : pas un SVG');
      att(!/NaN|undefined|Infinity/.test(s),'2b : '+k+' : valeur invalide dans le dessin');
      const st=[];let ok=true;s.replace(/<(\\/?)([a-zA-Z]+)[^>]*?(\\/?)>/g,(m,cl,t,self)=>{if(self)return m;if(cl){if(st.pop()!==t)ok=false;}else st.push(t);return m;});
      att(ok&&!st.length,'2c : '+k+' : balises mal fermées');
      const def=new Set((s.match(/ id="[^"]+"/g)||[]).map(x=>x.slice(5,-1)));
      (s.match(/url\\(#[^)]+\\)/g)||[]).forEach(u=>att(def.has(u.slice(5,-1)),'2d : '+k+' : '+u+' non défini dans le dessin'));
      def.forEach(i=>{att(!ids.has(i),'2e : identifiant répété '+i);ids.add(i);});
      att(s.length<6000,'2f : '+k+' : dessin trop lourd ('+s.length+')');
    });
    att(stdIcSvg('xyz')===''&&stdIcSvg(null)==='','2g : famille sans dessin : rien');
    STD_CATS.forEach(c=>att(/data-std=/.test(stdCatIcon(c.k)),'2h : onglet '+c.k+' sans dessin'));
    // 3. icône d'un composant
    att(asmCompIcon({name:'Bride',doc:{}})==='📦'&&asmCompIcon(null)==='📦','3 : pièce ordinaire : le cube');
    att(asmCompIcon({doc:{std:{key:'FUTUR|x'}}})==='🔩','3b : famille inconnue : 🔩');
    att(/data-std="chc"/.test(asmCompIcon({doc:{std:{key:'ISO 4762|M6|20'}}})),'3c : CHC reconnue par sa clé');
    // 4. timeline et arborescence d'un assemblage : vis CHC (×3, groupe), goupille, pièce ordinaire
    docResetEmpty();doc.name='Montage';asmEnsure();
    asmNewComp('Support');asmNotify();
    const Rt=asmRoot();
    const vis=stdSpec('iso',{type:'chc',size:'M6'}),gp=stdSpec('pin',{type:'iso2338'});
    for(let i=0;i<3;i++)stdAddOcc(vis,Rt.id);
    stdAddOcc(gp,Rt.id);asmNotify();
    const H=asmHistOf(Rt).filter(s=>s.k==='ins');
    const ic=H.map(s=>{const o=asmHistOcc(Rt,s),h=asmHistIcon(Rt,s),m=/data-std="([a-zA-Z]+)"/.exec(h);return asmComp(o.comp).name.split(' ')[0]+'='+(m?m[1]:h);}).join(',');
    att(ic==='Support=📦,CHC=chc,CHC=chc,CHC=chc,Goupille=pin','4 : timeline : '+ic);
    {const o=Rt.occ[0];o.cons=[{id:'r1',t:'coinc',a:{path:[],f:{k:'plane',c:[0,0,0],n:[0,0,1]}},b:{path:[],f:{k:'plane',c:[0,0,0],n:[0,0,-1]}},v:0,inv:false}];asmNotify();
      const s=asmHistOf(Rt).find(q=>q.k==='rel');att(s&&/^🧲/.test(asmHistIcon(Rt,s)),'4b : relation : toujours l’aimant');}
    {const L=[];treeComps(L,null);const h=L.map(r=>r.html||'').join('\\n');
      const g=L.find(r=>/tgrp/.test(r.cls||'')&&/CHC M6/.test(r.html||''));att(g&&/data-std="chc"/.test(g.html)&&/×3/.test(g.html),'4c : arbre : groupe des 3 vis dessiné');
      att(/data-std="pin"/.test(h),'4d : arbre : goupille dessinée');
      const sup=L.find(r=>/Support:1/.test(r.html||''));att(sup&&/📦/.test(sup.html)&&!/stdIc/.test(sup.html),'4e : arbre : pièce ordinaire = cube');}
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME ('+n+' types, '+KINDS.length+' dessins)');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'icones.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
