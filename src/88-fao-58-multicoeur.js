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
  faoOpMovesHit=function(){return null;};
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
  self.onmessage=function(ev){
    const m=ev.data||{};
    if(m.t!=='job')return;
    try{
      doc=new Proxy(m.doc,{get:function(t,k){
        if(typeof k==='symbol'||k in t)return t[k];
        self.__wkTouche('doc.'+k);
      }});
      boites=m.boites;
      bodies=(m.corps||[]).map(function(c){
        return corpsRecu({id:c.id,kind:c.kind,ghost:c.ghost,visible:c.visible,cached:c.cached,
          __m:{bas:lire(c.bas),mid:c.mid===undefined?undefined:lire(c.mid),fin:c.fin===undefined?undefined:lire(c.fin),
            geoFin:c.geoFin,groupes:c.groupes}});
      });
      const job=(doc.fao.setups||[]).find(function(s){return s.id===m.setupId;});
      const op=job&&(job.ops||[]).find(function(o){return o.id===m.opId;});
      if(!op)throw new Error('opération introuvable');
      const avant={};
      for(const k in op)avant[k]=JSON.stringify(op[k]);
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
  // Opérations confiées aux workers : les longues. Contour et chanfrein durent moins que le
  // démarrage d'un worker. Les corps FAO (murs) passent par une triangulation THREE : calcul normal.
  if(!op||op.on===false||!faoMeshOp(op)||op.type==='chamfer'||faoContourProfil(op))return false;
  if(faoWallList(job).length)return false;
  // V0.99.0 : brut restant — lit les parcours des opérations précédentes : calcul normal, après elles
  if(faoRestOn(op))return false;
  return true;
}
function faoWkNbCoeurs(){
  let n=4;
  try{ const h=+navigator.hardwareConcurrency; if(h>0)n=h; }catch(e){}
  return Math.max(1,Math.min(FAO_WK_MAX,n-1));
}

// ----- répartition -----
function faoWkRemplir(job,ops,estCaduc,surFlux,surAvance){
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
      corps=faoWkCorps(liste,job);
      donnees=faoWkDocData();
    }catch(e){ return fini(0); }
    // Les plus longues d'abord serait mieux, mais leur durée n'est pas connue : ordre du posage.
    const file=liste.slice();
    const total=liste.length;
    let enCours=0,finies=0,rangees=0,stop=false;
    const nb=Math.min(faoWkNbCoeurs(),total);
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
      while(enCours<nb&&file.length)lancer(file.shift());
      if(!enCours&&!file.length)termine();
    };
    const lancer=function(op){
      let w=null;
      try{ w=new Worker(url); }catch(e){
        // Impossible de créer un worker : la boucle normale s'en charge.
        file.length=0;
        return;
      }
      enCours++;
      faoWkActifs.push(w);
      miens.push(w);
      let clos=false;
      const clore=function(){
        if(clos)return;
        clos=true;
        try{ w.terminate(); }catch(e){}
        faoWkActifs=faoWkActifs.filter(function(x){return x!==w;});
        miens=miens.filter(function(x){return x!==w;});
        enCours--;finies++;
        try{ if(surAvance)surAvance(finies,total,nb); }catch(e){}
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
              rangees++;
            }
          }catch(e){}
          clore();
        }
      };
      try{
        w.postMessage({t:'job',setupId:job.id,opId:op.id,flux:!!surFlux&&op.hidden!==true,doc:donnees,corps:faoWkCorpsPour(corps,op,job),boites:faoWkBoites(job,op)});
      }catch(e){
        try{ console.warn('[FAO multicœur] envoi impossible : '+((e&&e.message)||e)+' — calcul normal'); }catch(e2){}
        clore();
      }
    };
    try{ if(surAvance)surAvance(0,total,nb); }catch(e){}
    suite();
  });
}
