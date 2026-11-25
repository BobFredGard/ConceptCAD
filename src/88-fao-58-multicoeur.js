/* ----- Parcours FAO sur plusieurs cœurs -----
   « Tout régénérer » confie les opérations longues (celles qui lisent le maillage) à des
   workers, une par worker, en laissant un cœur à l'écran. Le worker exécute LE MÊME code que
   le fil principal : les sections FAO du script de la page, sans copie à entretenir.
   Il ne reçoit que des données : le document et les maillages déjà calculés par le noyau.

   Ce mécanisme ne fait que REMPLIR LE CACHE : le résultat est rangé là où le calcul normal
   l'aurait rangé, sous la clé calculée ici, et la boucle habituelle de faoRefreshPreviewStream
   le relit. Toute opération non rendue par un worker est donc recalculée comme avant.

   Garde-fou : tout ce que le worker n'a pas (noyau, DOM, THREE, fonctions hors FAO) est
   remplacé par un piège. Le code FAO protège beaucoup d'appels par try/catch et sait se
   replier : un accès silencieux pourrait donner un AUTRE parcours. Un piège déclenché annule
   le résultat, et l'opération repasse par le calcul normal. */
const FAO_WK_MAX=16; // au-delà, la mémoire compte plus que les cœurs
let faoWkActifs=[];  // workers en cours, à arrêter si un autre rafraîchissement prend la main
let faoWkOff=false;  // ?mono : force le calcul historique (comparaison, secours)
try{ faoWkOff=/[?&]mono\b/.test(String(location.search||'')); }catch(e){}

// ----- code envoyé au worker -----
const FAO_WK_SECTION=/^(88-fao|89-fao)/;
const FAO_WK_BANDEAU=/\/\* ═+ (\S+) — [^\n]*?═+ \*\//g;
// Noms que le worker fournit lui-même, ou qui n'ont aucun effet sur un parcours
const FAO_WK_FOURNIS={doc:1,bodies:1,faoFineGeo:1,faoMeshFromBodyFine:1,faoMeshFromBodyMid:1};
const FAO_WK_MUETS={faceEl:1}; // message d'état : sans effet sur le calcul
function faoWkDecoupe(texte){
  // Le script de la page, découpé par ses bandeaux (build.js) : {dedans, dehors}
  const m=[];let x;
  FAO_WK_BANDEAU.lastIndex=0;
  while((x=FAO_WK_BANDEAU.exec(texte)))m.push({nom:x[1],i:x.index});
  const dedans=[],dehors=[];
  m.forEach(function(s,k){
    const bloc=texte.slice(s.i,k+1<m.length?m[k+1].i:texte.length);
    (FAO_WK_SECTION.test(s.nom)?dedans:dehors).push(bloc);
  });
  return {dedans:dedans.join('\n'),dehors:dehors.join('\n')};
}
function faoWkNoms(code){
  // Déclarations de haut niveau (colonne 0) : {fn:[], val:[]}
  const fn=new Set(),val=new Set();let x;
  const rf=/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm;
  while((x=rf.exec(code)))fn.add(x[1]);
  const rc=/^class\s+([A-Za-z_$][\w$]*)/gm;
  while((x=rc.exec(code)))val.add(x[1]);
  const rv=/^(?:let|const|var)\s+([^\n]*)/gm;
  while((x=rv.exec(code))){
    // noms en tête d'instruction : on coupe aux virgules hors parenthèses, crochets, accolades, chaînes
    const l=x[1];let prof=0,chaine='',debut=true,mot='';
    for(let i=0;i<l.length;i++){
      const c=l[i];
      if(chaine){ if(c==='\\')i++; else if(c===chaine)chaine=''; continue; }
      if(c==='"'||c==="'"||c==='`'){ chaine=c; continue; }
      if(c==='/'&&l[i+1]==='/')break;
      if(c==='('||c==='['||c==='{'){ prof++; continue; }
      if(c===')'||c===']'||c==='}'){ prof--; continue; }
      if(prof>0)continue;
      if(c===';')break;
      if(c===','){ debut=true; mot=''; continue; }
      if(debut){
        if(/[A-Za-z_$\d]/.test(c))mot+=c;
        else if(mot){ val.add(mot); debut=false; }
      }
    }
    if(debut&&mot)val.add(mot);
  }
  return {fn:Array.from(fn),val:Array.from(val)};
}
function faoWkPrelude(){
  // Hors de toute portée de la page : exécuté en tête du worker.
  self.__wkArme=false; self.__wkPiege=null;
  self.__wkTouche=function(n){
    if(!self.__wkArme)return;
    if(!self.__wkPiege){self.__wkPiege=n;self.__wkPile=String(new Error().stack||'');}
    throw new Error('[multicœur] '+n+' indisponible');
  };
  self.__wkFaux=function(n,muet){
    // Objet qui accepte tout au chargement du script ; une fois armé, le moindre usage le note.
    const touche=function(){ if(!muet)self.__wkTouche(n); };
    const f=function(){};
    const P=new Proxy(f,{
      get:function(t,k){ if(typeof k==='symbol')return undefined; touche(); return P; },
      set:function(){ touche(); return true; },
      has:function(){ touche(); return true; },
      apply:function(){ touche(); return P; },
      construct:function(){ touche(); return P; }
    });
    return P;
  };
}
function faoWkPrincipal(){
  // Fin du worker : maillages reçus -> mêmes fonctions de lecture que la page.
  const lire=function(m){
    if(!m)return null;
    const v=new Array(m.v.length/3),t=new Array(m.t.length/3);
    for(let i=0;i<v.length;i++)v[i]=[m.v[3*i],m.v[3*i+1],m.v[3*i+2]];
    for(let i=0;i<t.length;i++)t[i]=[m.t[3*i],m.t[3*i+1],m.t[3*i+2]];
    return {v:v,t:t};
  };
  // undefined = finesse non envoyée (≠ null : le noyau n'a rien donné). Tomber sur le repli
  // changerait le parcours en silence : c'est un piège.
  const finesse=function(b,cle){
    const v=b&&b.__m?b.__m[cle]:null;
    if(v===undefined)self.__wkTouche('maillage '+cle);
    return v;
  };
  faoMeshFromBody=function(b){return finesse(b,'bas');};
  faoMeshFromBodyMid=function(b){return finesse(b,'mid');};
  faoMeshFromBodyFine=function(b){return finesse(b,'fin');};
  faoFineGeo=function(b){
    const v=finesse(b,'geoFin');
    return v?{userData:{occGroups:b.__m.groupes}}:null;
  };
  // Corps reçus : toute autre propriété que celles envoyées (solide, maillage d'affichage…) est un piège
  const corpsRecu=function(c){
    return new Proxy(c,{get:function(t,k){
      if(typeof k==='symbol'||k in t)return t[k];
      self.__wkTouche('corps.'+k);
    }});
  };
  // Le cache vit sur le fil principal : ici la clé ne sert qu'à passer par le chemin de rangement
  faoOpMovesKey=function(){return '1';};
  // V0.99.46 : brut restant — parcours des opérations précédentes, tels que rangés par la page
  let prec=null;
  faoOpMovesHit=function(op){ const mv=prec&&op&&op.id?prec[op.id]:null; return mv?{key:'1',mv:mv}:null; };
  faoMovesSave=function(){};
  let capte=null,boites=null;
  faoOpMovesStore=function(op,cle,mv){capte=mv;};
  // Boîtes du modèle : lues par la page sur les maillages d'affichage (THREE), jointes au travail.
  // Demandées pour un autre posage que prévu : piège, donc calcul normal.
  const boite=function(s,cle,nom){
    const b=boites&&boites[(s&&s.__opJob)?'op':'pos'];
    if(!b||!s||s.id!==boites.id)self.__wkTouche(nom);
    return b[cle];
  };
  faoModelBox=function(s){return boite(s,'box','faoModelBox');};
  faoModelZBox=function(s){return boite(s,'zbox','faoModelZBox');};
  const poser=function(m){
    doc=new Proxy(m.doc,{get:function(t,k){
      if(typeof k==='symbol'||k in t)return t[k];
      self.__wkTouche('doc.'+k);
    }});
    boites=m.boites;
    prec=m.prec||null;
    if(m.precPaq){ prec={}; for(const id in m.precPaq)prec[id]=faoWkMvDepaq(m.precPaq[id]); }
    bodies=(m.corps||[]).map(function(c){
      return corpsRecu({id:c.id,kind:c.kind,ghost:c.ghost,visible:c.visible,cached:c.cached,
        __m:{bas:lire(c.bas),mid:c.mid===undefined?undefined:lire(c.mid),fin:c.fin===undefined?undefined:lire(c.fin),
          geoFin:c.geoFin,groupes:c.groupes}});
    });
    return (doc.fao.setups||[]).find(function(s){return s.id===m.setupId;});
  };
  self.onmessage=function(ev){
    const m=ev.data||{};
    if(m.t==='seq'){
      // V0.99.48 : séquence du posage (liaisons, retrait minimum) — faoSeqSafe, comme la page
      try{
        const job=poser(m);
        if(!job)throw new Error('posage introuvable');
        self.__wkArme=true;
        const res=faoSeqSafe(job,false);
        self.__wkArme=false;
        if(self.__wkPiege)throw new Error('[multicœur] '+self.__wkPiege+' indisponible');
        const tr=[];
        const out=res.map(function(b){
          const p=b.absent?null:faoWkMvPaq(b.moves,tr);
          return {opId:b.op&&b.op.id,absent:!!b.absent,xf:b.xf===undefined?undefined:b.xf,tail:b.tail===undefined?undefined:b.tail,mv:p};
        });
        self.postMessage({t:'seqfin',res:out},tr);
      }catch(e){
        self.__wkArme=false;
        self.postMessage({t:'ko',err:String((e&&e.message)||e),piege:self.__wkPiege,pile:self.__wkPile});
      }
      return;
    }
    if(m.t!=='job')return;
    try{
      const job=poser(m);
      const op=job&&(job.ops||[]).find(function(o){return o.id===m.opId;});
      if(!op)throw new Error('opération introuvable');
      const avant={};
      for(const k in op)avant[k]=JSON.stringify(op[k]);
      // V0.99.72 : ébauche 3D répartie par couches — m.niv : ne calculer que SES couches et
      // rendre la mémoire des parois ; m.memo : calcul final, mémoire des autres workers reprise
      faoNivPart=(m.niv&&m.niv.n>1)?{n:+m.niv.n,i:+m.niv.i}:null;
      faoGeoMemo=(faoNivPart||m.memo)?new Map(m.memo||[]):null;
      self.__wkArme=true;
      const it=faoOpMovesIt(op,job);
      let n=0,r=it.next();
      while(!r.done){
        const a=r.value;
        if(Array.isArray(a)&&a.length>n&&m.flux){
          self.postMessage({t:'flux',opId:m.opId,delta:a.slice(n)});
          n=a.length;
        }
        r=it.next();
      }
      self.__wkArme=false;
      if(self.__wkPiege)throw new Error('[multicœur] '+self.__wkPiege+' indisponible');
      if(faoNivPart){ self.postMessage({t:'memo',opId:m.opId,entries:Array.from(faoGeoMemo)}); return; }
      if(!capte)throw new Error('aucun parcours rangé');
      // Champs de l'opération écrits par le calcul (diagnostic de la fiche…)
      const champs={};
      for(const k in op){ if(k!=='stale'&&JSON.stringify(op[k])!==avant[k])champs[k]=op[k]; }
      self.postMessage({t:'fin',opId:m.opId,mv:capte,champs:champs});
    }catch(e){
      self.__wkArme=false;
      self.postMessage({t:'ko',opId:m.opId,err:String((e&&e.message)||e),piege:self.__wkPiege,pile:self.__wkPile});
    }
  };
}
function faoWkSource(texte){
  // Code complet d'un worker, à partir du texte du script de la page.
  const d=faoWkDecoupe(texte);
  const nd=faoWkNoms(d.dedans),nh=faoWkNoms(d.dehors);
  const pris=new Set(nd.fn.concat(nd.val));
  const lignes=[
    '('+faoWkPrelude+')();',
    'var doc=null,bodies=[];',
    // fonctions redéfinies en fin de worker : déclarées ici si elles sont hors des sections FAO
    'var faoFineGeo=null,faoMeshFromBodyFine=null,faoMeshFromBodyMid=null;'
  ];
  nh.fn.forEach(function(n){
    if(pris.has(n)||FAO_WK_FOURNIS[n])return;
    lignes.push('function '+n+'(){self.__wkTouche('+JSON.stringify(n)+');}');
    pris.add(n);
  });
  nh.val.forEach(function(n){
    if(pris.has(n)||FAO_WK_FOURNIS[n])return;
    lignes.push('var '+n+'=self.__wkFaux('+JSON.stringify(n)+','+(FAO_WK_MUETS[n]?'true':'false')+');');
    pris.add(n);
  });
  // Fournis par le navigateur sur la page, absents ou sans objet dans un worker
  ['THREE','document','window','occt','localStorage','sessionStorage','indexedDB','requestAnimationFrame','alert','confirm','getComputedStyle','HTMLElement','Image'].forEach(function(n){
    if(pris.has(n))return;
    lignes.push('var '+n+'=self.__wkFaux('+JSON.stringify(n)+',false);');
  });
  lignes.push(d.dedans);
  lignes.push('('+faoWkPrincipal+')();');
  return lignes.join('\n');
}
let faoWkCache=null;
function faoWkUrl(){
  // Le texte du script principal, reconnu à ses bandeaux. null : mode historique.
  if(faoWkCache!==null)return faoWkCache||null;
  faoWkCache='';
  try{
    if(typeof Worker==='undefined'||typeof Blob==='undefined'||typeof URL==='undefined')return null;
    const S=document.getElementsByTagName('script');
    for(let i=0;i<S.length;i++){
      const t=S[i].textContent||'';
      if(t.length>1e5&&t.indexOf('88-fao-58-multicoeur.js')>=0){
        faoWkCache=URL.createObjectURL(new Blob([faoWkSource(t)],{type:'text/javascript'}));
        break;
      }
    }
  }catch(e){ faoWkCache=''; }
  return faoWkCache||null;
}

// ----- données envoyées -----
function faoWkAplat(mm){
  // Maillage en tableaux plats : mêmes nombres (Float64), copie bien plus rapide
  if(!mm||!mm.v||!mm.t)return null;
  const v=new Float64Array(mm.v.length*3),t=new Int32Array(mm.t.length*3);
  for(let i=0;i<mm.v.length;i++){const p=mm.v[i];v[3*i]=p[0];v[3*i+1]=p[1];v[3*i+2]=p[2];}
  for(let i=0;i<mm.t.length;i++){const q=mm.t[i];t[3*i]=q[0];t[3*i+1]=q[1];t[3*i+2]=q[2];}
  return {v:v,t:t};
}
function faoWkBesoin(op,job){
  // Finesses de maillage lues par cette opération. Le fin coûte cher : seulement s'il sert
  // (finition, faces choisies, intouchables, brut = corps). Une erreur ici n'est pas
  // dangereuse : le worker tombe sur un piège et l'opération repasse au calcul normal.
  let fin=op.type==='geofinish'||op.type==='geodesic'||(Array.isArray(op.protect)&&op.protect.length>0)||(Array.isArray(op.faces)&&op.faces.length>0);
  try{ if(faoStockBodyId(job)!=null)fin=true; }catch(e){ fin=true; }
  return {mid:op.type!=='geofinish'&&op.type!=='geodesic',fin:fin};
}
function faoWkCorps(ops,job){
  // Les maillages de tous les corps, dans les finesses dont ces opérations ont besoin.
  // Calculés ICI, avec le noyau, une seule fois : ils restent en cache pour la suite.
  const B=ops.map(function(o){return faoWkBesoin(o,job);});
  const fin=B.some(function(x){return x.fin;}),mid=B.some(function(x){return x.mid;});
  return (bodies||[]).filter(function(b){return !!b;}).map(function(b){
    const c={id:b.id,kind:b.kind,ghost:b.ghost,visible:b.visible,cached:b.cached};
    c.bas=faoWkAplat(faoMeshFromBodyCached(b));
    if(mid)c.mid=faoWkAplat(faoMeshFromBodyMidCached(b));
    if(fin){
      c.fin=faoWkAplat(faoMeshFromBodyFineCached(b));
      let g=null;
      try{ g=faoFineGeo(b); }catch(e){ g=null; }
      c.geoFin=!!g;
      c.groupes=(g&&g.userData&&g.userData.occGroups)||null;
    }
    return c;
  });
}
function faoWkCorpsPour(corps,op,job){
  // Chaque worker ne reçoit que ce que SON opération lit
  const B=faoWkBesoin(op,job);
  return corps.map(function(c){
    const r=Object.assign({},c);
    if(!B.mid)delete r.mid;
    if(!B.fin){ delete r.fin; delete r.geoFin; delete r.groupes; }
    return r;
  });
}
function faoWkBoites(job,op){
  // Boîtes du modèle, vues du posage et, en repère propre (3+2), vues de l'opération
  const lire=function(s){ return {box:faoModelBox(s),zbox:faoModelZBox(s)}; };
  const r={id:job.id,pos:lire(job),op:null};
  const fr=faoOpFrame(job,op);
  if(fr)r.op=lire(faoOpJob(job,op,fr));
  return r;
}
function faoWkDocData(){
  // La racine FAO seule : le reste du document peut contenir des objets THREE, impossibles à
  // copier vers un worker, et ne sert pas aux parcours (sinon : piège, donc calcul normal).
  return {fao:doc.fao};
}
function faoWkAccepte(op,job){
  // Opérations confiées aux workers : les longues. Le chanfrein dure moins que le démarrage
  // d'un worker. Les corps FAO (murs) passent par une triangulation THREE : calcul normal.
  // V0.99.48 (demande de Fred : « toutes les opérations vers d'autres CPU ») : contour sur
  // arêtes accepté — avec « Rapide dans le vide », sa carte de matière rejoue les parcours
  // des précédentes (1,9 s par contour sur SIRAP-14-002, écran figé) : joints comme au brut restant.
  if(!op||op.on===false||!faoMeshOp(op)||op.type==='chamfer')return false;
  if(faoWallList(job).length)return false;
  // V0.99.0 : brut restant — lit les parcours des opérations précédentes. V0.99.46 : accepté,
  // lancé quand elles sont finies, avec leurs parcours joints (faoWkPrecOps / faoWkPrec)
  return true;
}
function faoWkPrecOps(op,job){
  // Opérations précédentes dont le parcours sert au brut restant de `op` ([] sinon) ;
  // V0.99.48 : aussi à la carte de matière d'un contour « Rapide dans le vide »
  if(!faoRestOn(op)&&!(typeof faoContourVideOn==='function'&&faoContourVideOn(op)))return [];
  const out=[];
  try{
    faoRestPrev(faoRestBase(job),op).forEach(function(E){ if(E&&E.op&&out.indexOf(E.op)<0)out.push(E.op); });
  }catch(e){ return null; }
  return out;
}
function faoWkPrec(op,job){
  // {id: parcours rangé} des opérations précédentes ; null si l'un manque (calcul normal)
  const L=faoWkPrecOps(op,job);
  if(L===null)return null;
  const r={};
  for(let i=0;i<L.length;i++){
    const h=faoOpMovesHit(L[i]);
    if(!h||!h.mv||!L[i].id)return null;
    r[L[i].id]=h.mv;
  }
  return r;
}
function faoWkNivNb(op,job){
  // V0.99.72 : workers de couches pour une ébauche 3D (0 : calcul d'un seul tenant)
  if(!op||op.type!=='rough3d')return 0;
  const c=faoWkNbCoeurs();
  if(c<3)return 0;
  const ap=+op.ap,H=(+op.ztop)-(+op.zbot);
  if(!(ap>0)||!(H>0))return 0;
  const nL=Math.ceil(H/ap-1e-9);
  return Math.max(0,Math.min(c,nL,8));
}
function faoWkNbCoeurs(){
  let n=4;
  try{ const h=+navigator.hardwareConcurrency; if(h>0)n=h; }catch(e){}
  return Math.max(1,Math.min(FAO_WK_MAX,n-1));
}
/* ----- V0.99.79 : budget mémoire des workers -----
   STEP.conceptcad de Fred : « Tout régénérer » relançait la page sur 24 cœurs. Sous Chrome, Edge
   et l'appli, TOUS les workers d'une page partagent le même tas JavaScript (≈ 4 Go,
   performance.memory.jsHeapSizeLimit) ; chaque calcul y garde ses données et des déchets que le
   ramasse-miettes laisse grossir. 2 ébauches 3D × 8 couches = 16 workers dépassaient ce plafond.
   Chaque calcul lancé compte un poids (Mo de pointe estimés) et la répartition attend qu'un worker
   finisse plutôt que de dépasser le budget ; le premier part toujours. Les parcours ne changent pas,
   seul le nombre de calculs simultanés baisse quand la mémoire manque.
   Poids mesurés sur STEP.conceptcad (pointe du tas, Node) : couche d'ébauche 3D 410 à 590 Mo,
   ébauche entière 1,1 à 1,4 Go, finition 65 à 140 Mo. */
const FAO_WK_POIDS={rough3d:900,couche:600,geofinish:200,geodesic:200,defaut:300};
function faoWkPoids(op,job,corps,niv){
  let p=niv?FAO_WK_POIDS.couche:(FAO_WK_POIDS[op&&op.type]||FAO_WK_POIDS.defaut);
  // maillages envoyés à CE worker (faoWkCorpsPour) : copiés, puis remis en points et
  // triangles là-bas (≈ 4 fois la taille des tableaux plats)
  try{
    const B=faoWkBesoin(op,job);
    let o=0;
    const n=function(m){ return m&&m.v&&m.t?m.v.byteLength+m.t.byteLength:0; };
    (corps||[]).forEach(function(c){ o+=n(c.bas); if(B.mid)o+=n(c.mid); if(B.fin)o+=n(c.fin); });
    p+=4*o/1048576;
  }catch(e){}
  return Math.round(p);
}
function faoWkBudget(){
  // Mo laissés aux workers : 75 % du tas commun (4 Go au plus), moins la page elle-même et ses
  // déchets à venir (1,5 fois ce qu'elle occupe) ; sans mesure (Firefox, Safari) : page à 400 Mo
  let lim=4096,pris=400;
  try{
    const m=performance.memory;
    if(m&&m.jsHeapSizeLimit>0){ lim=m.jsHeapSizeLimit/1048576; pris=m.usedJSHeapSize/1048576; }
  }catch(e){}
  return Math.max(0,Math.min(lim,4096)*0.75-1.5*pris);
}

// ----- répartition -----
async function faoWkRemplir(job,ops,estCaduc,surFlux,surAvance){
  // V0.99.48 : maillages fin et intermédiaire préparés d'abord par le worker du noyau
  // (faoFineGeoAsync / faoMidGeoAsync, src/90-60) — sur le fil principal, ils figeaient l'écran au
  // premier calcul (SIRAP-14-002 : 4,9 s puis 1,5 s).
  try{
    if(!faoWkOff&&typeof faoFineGeoAsync==='function'){
      const L=ops.filter(function(o){return faoWkAccepte(o,job);});
      const fin=L.some(function(o){return faoWkBesoin(o,job).fin;}),mid=L.some(function(o){return faoWkBesoin(o,job).mid;});
      const B=(bodies||[]).filter(function(b){return !!b;}),P=[];
      B.forEach(function(b){
        if(mid)P.push(faoMidGeoAsync(b).catch(function(){return null;}));
        if(fin)P.push(faoFineGeoAsync(b).catch(function(){return null;}));
      });
      if(P.length)await Promise.all(P);
    }
  }catch(e){}
  return faoWkRemplir0(job,ops,estCaduc,surFlux,surAvance);
}
function faoWkRemplir0(job,ops,estCaduc,surFlux,surAvance){
  // Calcule en parallèle ce qui peut l'être et range les résultats dans le cache.
  // Résout toujours (jamais d'échec) : ce qui manque sera calculé par le chemin normal.
  return new Promise(function(fini){
    let url=null,liste=[];
    try{
      if(faoWkOff)return fini(0);
      url=faoWkUrl();
      if(!url)return fini(0);
      liste=ops.filter(function(o){return faoWkAccepte(o,job);});
      if(!liste.length)return fini(0);
    }catch(e){ return fini(0); }
    let corps=null,donnees=null;
    const cles=new Map();
    try{
      // Clés d'abord : elles alignent aussi Haut/Bas de l'opération (faoHtsSync)
      liste=liste.filter(function(o){
        try{ faoActiveMesh(job); }catch(e){}
        const k=faoOpMovesKey(o,job);
        if(k===null)return false;
        const h=faoOpMovesHit(o);
        if(h&&h.key===k)return false; // déjà à jour
        cles.set(o,k);
        return true;
      });
      if(!liste.length)return fini(0);
      // Brut restant, contour dans le vide : les précédentes que les workers ne font pas (2.5D : courtes)
      // sont calculées ici d'abord ; leurs parcours partiront avec l'opération.
      liste.forEach(function(o){
        const L=faoWkPrecOps(o,job)||[];
        L.forEach(function(q){
          if(liste.indexOf(q)>=0)return;
          try{
            const k=faoOpMovesKey(q,job),h=faoOpMovesHit(q);
            if(k!==null&&!(h&&h.key===k)){ if(q.stale===true)q.stale=false; faoOpMoves(q,job); }
          }catch(e){}
        });
      });
      corps=faoWkCorps(liste,job);
      donnees=faoWkDocData();
    }catch(e){ return fini(0); }
    // Les plus longues d'abord serait mieux, mais leur durée n'est pas connue : ordre du posage.
    const file=liste.slice();
    // V0.99.72 (idée de Fred : « chaque couche et sous-couche de passes pourrait être calculée
    // dans un cœur différent ») : une ébauche 3D est d'abord découpée en workers de couches
    // (mémoire des parois, faoGeoMemo), puis un worker final assemble le parcours avec elle.
    const couches=new Map();
    liste.forEach(function(o){ const n=faoWkNivNb(o,job); if(n>1)couches.set(o,n); });
    let total=0;
    liste.forEach(function(o){ total+=couches.has(o)?couches.get(o)+1:1; });
    const sous=[]; // tâches prêtes avant la file : couches, puis calcul final
    let enCours=0,finies=0,rangees=0,stop=false;
    // V0.99.46 : une opération en brut restant attend les précédentes confiées aux workers
    const faites=new Set(),ratees=new Set();
    const attend=new Map();
    liste.forEach(function(o){ attend.set(o,(faoWkPrecOps(o,job)||[]).filter(function(q){ return liste.indexOf(q)>=0; })); });
    const pret=function(o){ return (attend.get(o)||[]).every(function(q){ return faites.has(q); }); };
    const perdue=function(o){ return (attend.get(o)||[]).some(function(q){ return ratees.has(q); }); };
    const nb=Math.min(faoWkNbCoeurs(),total);
    // V0.99.79 : budget mémoire des workers (Mo) — voir faoWkBudget
    const budget=faoWkBudget();
    let charge=0,pic=0;
    // Un autre rafraîchissement a pris la main : on n'attend pas la fin d'une opération longue
    const veille=setInterval(function(){ if(estCaduc())suite(); },250);
    let miens=[]; // SES workers : le calcul suivant a peut-être déjà démarré les siens
    const termine=function(){
      clearInterval(veille);
      fini(rangees);
    };
    const suite=function(){
      if(stop)return;
      if(estCaduc()){
        stop=true;
        miens.forEach(function(w){ try{ w.terminate(); }catch(e){} });
        faoWkActifs=faoWkActifs.filter(function(x){return miens.indexOf(x)<0;});
        miens=[];
        return termine();
      }
      // précédente ratée : calcul normal, après elle (boucle habituelle)
      for(let i=file.length-1;i>=0;i--)if(perdue(file[i])){ ratees.add(file[i]); file.splice(i,1); finies++; }
      while(enCours<nb){
        let t=null,fi=-1;
        if(sous.length)t=sous[0];
        else{
          fi=file.findIndex(pret);
          if(fi<0)break;
          const o=file[fi];
          const n=couches.get(o);
          if(n){
            file.splice(fi,1);
            const agg={n:n,fin:0,memo:[]};
            for(let k=0;k<n;k++)sous.push({op:o,niv:{n:n,i:k},agg:agg});
            continue;
          }
          t={op:o};
        }
        // V0.99.79 : mémoire partagée par tous les workers de la page — on attend qu'un
        // worker finisse plutôt que de dépasser le budget (le premier part toujours)
        const p=faoWkPoids(t.op,job,corps,t.niv);
        if(enCours>0&&charge+p>budget)break;
        if(fi<0)sous.shift(); else file.splice(fi,1);
        t.poids=p;
        lancer(t);
      }
      if(!enCours){
        while(sous.length){ const t=sous.shift(); finies++; if(!t.niv)ratees.add(t.op); else if(++t.agg.fin===t.agg.n)ratees.add(t.op); }
        // rien en cours et plus rien de prêt : ce qui reste repasse au calcul normal
        while(file.length){ ratees.add(file.shift()); finies++; }
        termine();
      }
    };
    const lancer=function(t){
      const op=t.op;
      let w=null;
      try{ w=new Worker(url); }catch(e){
        // Impossible de créer un worker : la boucle normale s'en charge.
        file.length=0;
        return;
      }
      enCours++;
      charge+=t.poids||0;
      if(enCours>pic)pic=enCours;
      faoWkActifs.push(w);
      miens.push(w);
      let clos=false,reussi=false;
      const clore=function(){
        if(clos)return;
        clos=true;
        charge-=t.poids||0;
        if(t.niv){
          // dernier worker de couches : le calcul final passe en tête (avec ou sans mémoire)
          const A=t.agg;
          if(++A.fin===A.n)sous.unshift({op:op,memo:A.memo.length?A.memo:null});
        }
        else (reussi?faites:ratees).add(op);
        try{ w.terminate(); }catch(e){}
        faoWkActifs=faoWkActifs.filter(function(x){return x!==w;});
        miens=miens.filter(function(x){return x!==w;});
        enCours--;finies++;
        try{ if(surAvance)surAvance(finies,total,Math.max(1,pic)); }catch(e){}
        suite();
      };
      w.onerror=function(ev){
        try{ ev.preventDefault(); }catch(e){}
        try{ console.warn('[FAO multicœur] '+op.id+' : '+((ev&&ev.message)||'erreur')+' — calcul normal'); }catch(e){}
        clore();
      };
      w.onmessage=function(ev){
        const m=ev.data||{};
        if(estCaduc()){ clore(); return; }
        if(m.t==='flux'){ try{ if(surFlux)surFlux(op,m.delta); }catch(e){} return; }
        if(m.t==='memo'&&t.niv){
          const E=m.entries||[];
          for(let i=0;i<E.length;i++)t.agg.memo.push(E[i]);
          reussi=true; clore(); return;
        }
        if(m.t==='ko'){
          try{ console.warn('[FAO multicœur] '+op.id+' : '+m.err+' — calcul normal'); }catch(e){}
          clore();
          return;
        }
        if(m.t==='fin'){
          try{
            // Le document a pu changer pendant le calcul : on ne range que sous la clé du moment
            const k=faoOpMovesKey(op,job);
            if(k!==null&&k===cles.get(op)){
              for(const c in m.champs)op[c]=m.champs[c];
              faoOpMovesStore(op,k,m.mv);
              faoMovesSave(job,op,k,m.mv);
              op.stale=false;
              rangees++; reussi=true;
            }
          }catch(e){}
          clore();
        }
      };
      let prec=null;
      const LP=faoWkPrecOps(op,job);
      if(LP===null||LP.length){ // brut restant, contour « Rapide dans le vide » (V0.99.48)
        prec=faoWkPrec(op,job);
        if(!prec){ clore(); return; } // une précédente manque : calcul normal
      }
      try{
        w.postMessage({t:'job',setupId:job.id,opId:op.id,niv:t.niv||null,memo:t.memo||null,flux:!!surFlux&&op.hidden!==true&&!t.niv,doc:donnees,corps:faoWkCorpsPour(corps,op,job),boites:faoWkBoites(job,op),prec:prec});
      }catch(e){
        try{ console.warn('[FAO multicœur] envoi impossible : '+((e&&e.message)||e)+' — calcul normal'); }catch(e2){}
        clore();
      }
    };
    try{ if(surAvance)surAvance(0,total,nb); }catch(e){}
    suite();
  });
}

/* ----- V0.99.48 : séquence finale du posage dans un worker -----
   Demande de Fred : « toutes les opérations vers d'autres CPU ». À la fin de « Tout régénérer »,
   faoSeqSafe (liaisons entre passes, carte de la matière pour le retrait minimum) figeait l'écran
   1,6 s sur SIRAP-14-002. Elle est faite par un worker FAO, avec le même code ; les parcours
   partent et reviennent en colonnes (faoWkMvPaq : transfert sans copie, aucun arrondi). La page
   reprend le résultat une fois, tout de suite (faoSeqPre) ; sinon : calcul habituel. */
let faoSeqPre=null; // {job, res} : séquence calculée par un worker, servie une fois par faoSeqSafe
function faoWkMvSimple(m){
  // {x,y,z} ou {r,x,y,z} (r : 0, 1, true, false), dans cet ordre de clés, coordonnées en nombres
  if(!m||typeof m!=='object')return 0;
  const k=Object.keys(m);
  if(typeof m.x!=='number'||typeof m.y!=='number'||typeof m.z!=='number')return 0;
  if(k.length===3&&k[0]==='x'&&k[1]==='y'&&k[2]==='z')return 5;
  if(k.length!==4||k[0]!=='r'||k[1]!=='x'||k[2]!=='y'||k[3]!=='z')return 0;
  return m.r===0?1:m.r===1?2:m.r===true?3:m.r===false?4:0;
}
function faoWkMvPaq(mv,tr){
  // Parcours -> colonnes : r (code), x, y, z ; les points d'une autre forme et les champs
  // posés sur le tableau (hors indices) voyagent tels quels.
  const n=mv.length,c=new Uint8Array(n),x=new Float64Array(n),y=new Float64Array(n),z=new Float64Array(n),autres=[];
  for(let i=0;i<n;i++){
    const m=mv[i],s=faoWkMvSimple(m);
    c[i]=s;
    if(s){x[i]=m.x;y[i]=m.y;z[i]=m.z;}else if(i in mv)autres.push([i,m]); // trou du tableau : reste un trou
  }
  let champs=null;
  for(const k in mv){ if(!/^\d+$/.test(k)){ if(!champs)champs={}; champs[k]=mv[k]; } }
  if(tr)tr.push(c.buffer,x.buffer,y.buffer,z.buffer);
  return {n:n,c:c,x:x,y:y,z:z,autres:autres,champs:champs};
}
function faoWkMvDepaq(p){
  const R=[undefined,0,1,true,false];
  const out=new Array(p.n);
  for(let i=0;i<p.n;i++){
    const s=p.c[i];
    if(s===5)out[i]={x:p.x[i],y:p.y[i],z:p.z[i]};
    else if(s)out[i]={r:R[s],x:p.x[i],y:p.y[i],z:p.z[i]};
  }
  for(let j=0;j<p.autres.length;j++)out[p.autres[j][0]]=p.autres[j][1];
  if(p.champs)for(const k in p.champs)out[k]=p.champs[k];
  return out;
}
function faoWkSeq(job,estCaduc){
  // Séquence du posage par un worker → Promise du tableau de faoSeqSafe(job,false), ou null.
  return new Promise(function(fini){
    let w=null,fait=false;
    const finir=function(r){ if(fait)return; fait=true; try{ if(w)w.terminate(); }catch(e){} faoWkActifs=faoWkActifs.filter(function(x){return x!==w;}); fini(r); };
    try{
      if(faoWkOff)return fini(null);
      if(faoWallList(job).length)return fini(null);
      const url=faoWkUrl();
      if(!url)return fini(null);
      const seq=faoOpsSeq(job);
      if(!seq.length)return fini(null);
      const ops=[];seq.forEach(function(E){ if(E.op&&ops.indexOf(E.op)<0)ops.push(E.op); });
      // tous les parcours en mémoire, à jour : sinon le calcul habituel (qui sait les produire)
      const tr=[],paq={},vus=new Map();
      for(let i=0;i<ops.length;i++){
        const op=ops[i];
        if(!op.id||paq[op.id])return fini(null);
        const h=faoOpMovesHit(op);
        let k=null;
        try{ k=faoOpMovesKey(op,job); }catch(e){ k=null; }
        if(!h||!h.mv||k===null||h.key!==k)return fini(null);
        paq[op.id]=faoWkMvPaq(h.mv,tr);
        vus.set(op,h.mv);
      }
      const corps=(bodies||[]).filter(function(b){return !!b;}).map(function(b){
        return {id:b.id,kind:b.kind,ghost:b.ghost,visible:b.visible,cached:b.cached,bas:faoWkAplat(faoMeshFromBodyCached(b))};
      });
      const boites={id:job.id,pos:{box:faoModelBox(job),zbox:faoModelZBox(job)},op:null};
      w=new Worker(url);
      faoWkActifs.push(w);
      w.onerror=function(ev){ try{ ev.preventDefault(); }catch(e){} finir(null); };
      w.onmessage=function(ev){
        const m=ev.data||{};
        if(m.t==='ko'){ try{ console.warn('[FAO multicœur] séquence : '+m.err+' — calcul normal'); }catch(e){} finir(null); return; }
        if(m.t!=='seqfin')return;
        try{
          if(estCaduc&&estCaduc())return finir(null);
          // rien n'a bougé pendant le calcul : mêmes parcours en mémoire
          for(const [op,mv] of vus){ const h=faoOpMovesHit(op); if(!h||h.mv!==mv)return finir(null); }
          const parId={};ops.forEach(function(o){ parId[o.id]=o; });
          const res=m.res.map(function(b){
            const op=parId[b.opId];
            if(!op)throw new Error('opération inconnue');
            const r={op:op,moves:b.absent?[]:faoWkMvDepaq(b.mv),xf:b.xf};
            if(b.absent)r.absent=true;
            if(b.tail!==undefined)r.tail=b.tail;
            return r;
          });
          finir(res);
        }catch(e){ finir(null); }
      };
      w.postMessage({t:'seq',setupId:job.id,doc:faoWkDocData(),corps:corps,boites:boites,precPaq:paq},tr);
    }catch(e){ finir(null); }
  });
}
