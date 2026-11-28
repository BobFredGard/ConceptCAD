/* ═══ Tournage : fiches, aperçu, simulation (V1.2.7) ═══ */

/* ----- création ----- */
function tourNewSetup(){
  try{
    const r=faoRoot();
    faoSnapshot('nouveau posage tour');
    const s=tourDefaultSetup();
    let k=1; while(r.setups.some(function(x){return x.name==='TOUR'+k;}))k++;
    s.name='TOUR'+k;
    r.setups.push(s); r.activeSetupId=s.id;
    faoChanged();
    faoSelectSetup(s.id);
    return s;
  }catch(e){ return null; }
}
function tourActiveOrNew(){
  const cur=faoSetup();
  if(tourIs(cur))return cur;
  const r=faoRoot();
  const t=r.setups.filter(tourIs)[0];
  if(t){ r.activeSetupId=t.id; return t; }
  return tourNewSetup();
}
function tourAddOp(type,setup,cote){
  try{
    const s=setup||tourActiveOrNew(); if(!s)return null;
    const op=tourOpDefaults(type,s,cote); if(!op)return null;
    faoSnapshot('nouvelle opération « '+tourOpLabel(op)+' »');
    s.ops.push(op);
    faoChanged();
    faoSelectOp(s.id,op.id);
    return op;
  }catch(e){ return null; }
}
function tourAddAuto(type,setup){
  // gorge, filetage : extérieur si la pièce en demande un, sinon intérieur
  const s=setup||tourActiveOrNew(); if(!s)return null;
  let c='ext';
  try{
    if(type==='tour_thread'){ const T=tourThreadsOf(s).filter(function(x){ return x.dz<0; }); if(!T.some(function(x){ return !x.int; })&&T.some(function(x){ return x.int; }))c='int'; }
    if(type==='tour_groove'){
      const z=function(k){ const o=tourOpDefaults('tour_groove',s,k), cx=tourCtx(s,o); if(cx.err)return 0; const G=tourGroovesFor(cx,s,0.02); return G.err?0:G.zones.length; };
      if(!z('ext')&&z('int'))c='int';
    }
  }catch(e){}
  return tourAddOp(type,s,c);
}
function tourCDrillGroups(s){
  // groupes (sens, Ø) des trous hors axe faisables dans ce posage
  const G=[];
  try{ tourCHolesOf(s).forEach(function(h){ if(!h.ok||(h.ax!=='rad'&&h.ax!=='ax'))return; if(!G.some(function(g){ return g.dir===h.ax&&Math.abs(g.d-h.d)<0.01; }))G.push({dir:h.ax,d:h.d}); }); }catch(e){}
  return G.sort(function(a,b){ return (a.dir===b.dir?0:(a.dir==='ax'?1:-1))||a.d-b.d; });
}
function tourCDrillOps(s){
  // une opération par groupe, le foret motorisé au Ø du trou
  const out=[];
  if(!s.tour)s.tour={};
  s.tour.cax=true;
  tourCDrillGroups(s).forEach(function(g){
    if((s.ops||[]).some(function(o){ return o&&o.type==='tour_cdrill'&&o.dir===g.dir&&Math.abs(+o.dsel-g.d)<0.01; }))return;
    const o=tourOpDefaults('tour_cdrill',s,g.dir); const t=tourLiveDrillFor(s,g.dir,g.d); o.toolId=t.id; o.dsel=g.d; out.push(o);
  });
  return out;
}
function tourAddCDrill(setup){
  // perçages à l'axe C : un par sens et par Ø de trou hors axe du modèle (active l'axe C du posage)
  const s=setup||tourActiveOrNew(); if(!s)return null;
  faoSnapshot('perçage axe C');
  let L=tourCDrillOps(s);
  if(!L.length&&!(s.ops||[]).some(function(o){ return o&&o.type==='tour_cdrill'; }))L=[tourOpDefaults('tour_cdrill',s,'rad')];
  // avant le tronçonnage
  const ip=s.ops.findIndex(function(o){ return o&&o.type==='tour_part'; });
  if(ip>=0)s.ops.splice.apply(s.ops,[ip,0].concat(L)); else L.forEach(function(o){ s.ops.push(o); });
  faoChanged();
  if(L.length)faoSelectOp(s.id,L[L.length-1].id); else faoSelectSetup(s.id);
  return L[0]||null;
}
function tourAddBoring(setup){
  // alésage : ébauche et finition intérieures, le perçage d'abord s'il manque
  const s=setup||tourActiveOrNew(); if(!s)return null;
  faoSnapshot('alésage');
  if(!(s.ops||[]).some(function(o){ return o&&o.on!==false&&o.type==='tour_drill'; }))s.ops.push(tourOpDefaults('tour_drill',s));
  const a=tourOpDefaults('tour_rough',s,'int'), b=tourOpDefaults('tour_finish',s,'int');
  s.ops.push(a,b);
  faoChanged(); faoSelectOp(s.id,b.id);
  return b;
}
function tourAddGamme(setup){
  // ordre d'atelier : dressage, extérieur (ébauche, finition, gorges, filet), perçage, intérieur
  // (ébauche, alésage, gorges, filet), tronçonnage — chaque opération seulement si la pièce la demande
  const s=setup||tourActiveOrNew(); if(!s)return;
  faoSnapshot('gamme de tournage complète');
  const M=tourModel(s), ok=!!(M&&M.ok), add=function(t,c){ const o=tourOpDefaults(t,s,c); s.ops.push(o); return o; };
  const grooves=function(c){ const o=tourOpDefaults('tour_groove',s,c), cx=tourCtx(s,o); if(cx.err)return false;
    const G=tourGroovesFor(cx,s,0.02); return !G.err&&G.zones.length>0; };
  const thr=ok?tourThreadsOf(s).filter(function(x){ return x.dz<0; }):[];
  add('tour_face'); add('tour_rough'); add('tour_finish');
  if(ok&&grooves('ext'))add('tour_groove');
  if(thr.some(function(x){ return !x.int; }))add('tour_thread');
  if(ok&&M.bore){
    add('tour_drill');
    const d=tourDrillFor(s), I=M.inner;
    if(I&&d&&I.rmax>d.d/2+0.05){ add('tour_rough','int'); add('tour_finish','int'); if(grooves('int'))add('tour_groove','int'); }
    if(thr.some(function(x){ return x.int; }))add('tour_thread','int');
  }
  if(tourCfg(s).cax)tourCDrillOps(s).forEach(function(o){ s.ops.push(o); }); // outils tournants : trous hors axe
  if(!tourCfg(s).rep)add('tour_part');
  faoChanged(); faoSelectSetup(s.id);
}

function tourAddReprise(setup){
  // reprise de la 2e face : posage retourné, brut = la pièce sortie de celui-ci,
  // dressage à la longueur puis chariotage et finition du côté repris
  try{
    const src=setup||faoSetup(); if(!tourIs(src))return null;
    const r=faoRoot();
    faoSnapshot('reprise de la 2e face');
    const s=tourDefaultSetup();
    let k=1; while(r.setups.some(function(x){return x.name==='TOUR'+k;}))k++;
    s.name='TOUR'+k;
    s.machine=src.machine; s.wcs=src.wcs==='G54'?'G55':src.wcs; s.bodies=JSON.parse(JSON.stringify(src.bodies||'all'));
    s.coolant=src.coolant; s.rapide=src.rapide; s.toolChg=src.toolChg;
    s.tour=JSON.parse(JSON.stringify(src.tour||{}));
    s.tour.flip=!src.tour.flip; s.tour.d=0; s.tour.face=1; s.tour.sortie=0;
    s.tour.reprise={from:src.id,sur:1,pince:Math.max(5,Math.min(15,Math.round((tourModel(src)||{}).L/4)||10))};
    s.tools=JSON.parse(JSON.stringify(src.tools||tourDefaultTools()));
    r.setups.push(s); r.activeSetupId=s.id;
    ['tour_face','tour_rough','tour_finish'].forEach(function(t){ s.ops.push(tourOpDefaults(t,s)); });
    faoChanged();
    faoSelectSetup(s.id);
    return s;
  }catch(e){ return null; }
}

/* ----- fiche du posage ----- */
function tourNumRow(p,label,val,fn,unit,title){
  const r=faoRow(); r.appendChild(faoLab(label));
  r.appendChild(faoNum(val,fn,56,null,title||label));
  if(unit)r.appendChild(faoLab(unit));
  p.appendChild(r); return r;
}
function tourChk(label,val,fn,title){
  const l=document.createElement('label'); l.className='fao-check';
  const c=document.createElement('input'); c.type='checkbox'; c.checked=!!val;
  c.onchange=function(){ faoSnapshot(title||label); fn(c.checked); faoChanged(); };
  l.appendChild(c); l.appendChild(document.createTextNode(' '+label));
  if(title)l.title=title;
  return l;
}
function tourSetupFiche(p,setup){
  const C=tourCfg(setup), T=setup.tour, M=tourModel(setup), S=tourStock(setup);
  p.appendChild(faoH('Posage tour · '+setup.name));
  const rN=faoRow(); rN.appendChild(faoLab('Nom'));
  rN.appendChild(faoTxt(setup.name,function(v){ setup.name=faoProgName(v)||setup.name; },120));
  if(faoRoot().setups.length>1)rN.appendChild(faoMini('Supprimer',function(){
    const r=faoRoot(); r.setups=r.setups.filter(function(s){return s.id!==setup.id;});
    r.activeSetupId=(r.setups[0]||{}).id||null; try{ sel={kind:null,id:null}; }catch(e){}
  },'Supprimer ce posage'));
  p.appendChild(rN);
  const rM=faoRow(); rM.appendChild(faoLab('Machine'));
  const P=tourPosts();
  rM.appendChild(faoSel(Object.keys(P).map(function(k){return [k,P[k].label];}),tourPostOf(setup).id,function(v){ setup.machine=v; },'Commande du tour'));
  rM.appendChild(faoLab('Origine'));
  rM.appendChild(faoSel(['G54','G55','G56','G57','G58','G59'].map(function(g){return [g,g];}),setup.wcs||'G54',function(v){ setup.wcs=v; },'Origine pièce'));
  p.appendChild(rM);
  p.appendChild(faoHelp('Origine du programme : sur l’axe, à la face avant de la pièce finie (côté opposé au mandrin). X en diamètre.'));
  // pièce
  p.appendChild(faoH('Pièce'));
  const rA=faoRow(); rA.appendChild(faoLab('Axe de rotation'));
  rA.appendChild(faoSel([['auto','Automatique'],['x','X du modèle'],['y','Y du modèle'],['z','Z du modèle']],C.axis,function(v){ T.axis=v; },'Axe de la pièce autour duquel elle tourne'));
  rA.appendChild(tourChk('Inverser',C.flip,function(v){ T.flip=v; },'Retourne la pièce : l’autre bout devient la face avant'));
  p.appendChild(rA);
  if(M&&M.ok){
    p.appendChild(faoHelp('Pièce Ø'+(+(2*M.Rmax).toFixed(3))+' × '+(+M.L.toFixed(3))+' mm · axe '+'XYZ'[M.W.indexOf(M.W.find(function(q){return q!==0;}))]+(M.W.some(function(q){return q<0;})?' (inversé)':'')
      +' · profil '+(M.src==='exact'?'exact ('+M.elems.length+' éléments)':'pris sur le maillage')
      +(M.bore?(' · alésage Ø'+(+(2*M.bore.r).toFixed(2))+(M.bore.through?' débouchant':' sur '+(+M.bore.full.toFixed(2))+' mm')):'')
      +(M.inner&&M.inner.rmax>M.inner.rmin+0.01?(' · intérieur Ø'+(+(2*M.inner.rmin).toFixed(2))+' à Ø'+(+(2*M.inner.rmax).toFixed(2))):'')
      +(function(){ const T=tourThreadsOf(setup); return T.length?' · filet'+(T.length>1?'s':'')+' '+T.map(function(x){ return x.label+(x.int?' int.':''); }).join(', '):''; })()));
    (M.warns||[]).forEach(function(w){ const h=faoHelp('⚠ '+w); h.style.color='#ff9f0a'; p.appendChild(h); });
  }else{
    const h=faoHelp('⚠ '+(((M&&M.warns)||[]).join(' ; ')||'aucune pièce')); h.style.color='#ff9f0a'; p.appendChild(h);
  }
  // brut
  if(C.rep){
    // reprise de la 2e face : le brut est la pièce sortie du posage d'origine, retournée
    const src=tourSetupById(C.rep.from);
    p.appendChild(faoH('Reprise de la 2e face'));
    p.appendChild(faoHelp('Brut = la pièce sortie du posage '+(src?src.name:'(introuvable)')+', retournée dans le mandrin et tenue sur la partie déjà tournée.'));
    tourNumRow(p,'Surépaisseur sur la face',C.rep.sur,function(v){ T.reprise.sur=Math.max(0,v); },'mm','Matière laissée derrière la pièce au tronçonnage du premier posage, enlevée ici par le dressage à la longueur');
    tourNumRow(p,'Longueur tenue',C.rep.pince,function(v){ T.reprise.pince=Math.max(1,v); },'mm','Longueur de la pièce serrée dans les mors (côté déjà tourné)');
    if(S.rep)p.appendChild(faoHelp('Pièce Ø'+(+S.d.toFixed(2))+' maxi, face à reprendre à Z'+(+S.face.toFixed(2))+', mors à Z'+(+S.chuck.toFixed(2))+(S.rep.rin0>0?', trou Ø'+(+(2*S.rep.rin0).toFixed(2))+' déjà fait':'')+'.'));
    else{ const h=faoHelp('⚠ posage d’origine sans simulation possible : brut inconnu'); h.style.color='#ff9f0a'; p.appendChild(h); }
  }else{
    p.appendChild(faoH('Brut'));
    tourNumRow(p,'Ø du brut',C.d||S.d,function(v){ T.d=Math.max(0,v); },'mm','Diamètre de la barre (0 = Ø de la pièce arrondi au mm, + 2 mm)');
    tourNumRow(p,'Surépaisseur en bout',C.face,function(v){ T.face=Math.max(0,v); },'mm','Matière devant la face avant de la pièce, enlevée par le dressage');
    tourNumRow(p,'Sortie du mandrin',C.sortie||S.sortie,function(v){ T.sortie=Math.max(0,v); },'mm','Longueur de barre qui dépasse des mors (0 = longueur de la pièce + 15 mm)');
    p.appendChild(faoHelp('Barre Ø'+(+S.d.toFixed(2))+', mors du mandrin à Z'+(+S.chuck.toFixed(2))+'.'));
  }
  // machine
  p.appendChild(faoH('Broche et déplacements'));
  tourNumRow(p,'Vitesse maxi',C.smax,function(v){ T.smax=Math.max(1,v); },'tr/min','Limite de broche en vitesse de coupe constante (G192 S / LIMS=)');
  const rD=faoRow(); rD.appendChild(faoLab('Sens de broche'));
  rD.appendChild(faoSel([['M3','M3'],['M4','M4']],C.dir,function(v){ T.dir=v; },'Sens de rotation de la broche pour ces outils'));
  rD.appendChild(tourChk('Inverser G2 / G3',C.arcInv,function(v){ T.arcInv=v; },'Arcs vus Z à droite, X en haut (outil au-dessus de l’axe) ; à cocher si la machine les voit dans l’autre sens'));
  p.appendChild(rD);
  tourNumRow(p,'Dégagement radial',C.clrX,function(v){ T.clrX=Math.max(0.5,v); },'mm','Au-dessus du brut (sur le rayon) pour les rapides');
  tourNumRow(p,'Dégagement axial',C.clrZ,function(v){ T.clrZ=Math.max(0.5,v); },'mm','Devant la face du brut pour les approches');
  const rT=faoRow(); rT.appendChild(faoLab('Changement d’outil X'));
  rT.appendChild(faoNum(C.tcX,function(v){ T.tcX=v; },56,null,'Point de changement d’outil : X en diamètre'));
  rT.appendChild(faoLab('Z')); rT.appendChild(faoNum(C.tcZ,function(v){ T.tcZ=v; },56,null,'Point de changement d’outil : Z'));
  p.appendChild(rT);
  const rR=faoRow(); rR.appendChild(faoLab('Rapide'));
  rR.appendChild(faoNum(+setup.rapide||10000,function(v){ setup.rapide=Math.max(500,v); },64,null,'Vitesse des G0 (estimation du temps)'));
  rR.appendChild(faoLab('mm/min'));
  rR.appendChild(faoLab('Arrosage'));
  rR.appendChild(faoSel([['flood','Oui'],['off','Non']],setup.coolant==='off'?'off':'flood',function(v){ setup.coolant=v; },'Arrosage (M08 / M09)'));
  p.appendChild(rR);
  // outils tournants (étape 3)
  p.appendChild(faoH('Outils tournants (axe C)'));
  const rC=faoRow(); rC.appendChild(tourChk('Le tour a un axe C et des outils motorisés',C.cax,function(v){ T.cax=v; },'Permet les perçages hors de l’axe : broche positionnée en angle (axe C), foret motorisé radial ou axial'));
  p.appendChild(rC);
  { const H=tourCHolesOf(setup), nr=H.filter(function(h){ return h.ax==='rad'; }).length, na=H.filter(function(h){ return h.ax==='ax'; }).length, nx=H.filter(function(h){ return !h.ok; }).length;
    p.appendChild(faoHelp(H.length?('Trous hors axe du modèle : '+[nr?nr+' radia'+(nr>1?'ux':'l'):'',na?na+' axia'+(na>1?'ux':'l'):''].filter(Boolean).join(', ')+(nx?' ('+nx+' impossible'+(nx>1?'s':'')+' ici)':'')+'.'):'Aucun trou hors axe dans le modèle (fonction Perçage).')); }
  if(C.cax){
    tourNumRow(p,'N° de broche de l’outil tournant',C.liveN,function(v){ T.liveN=Math.max(1,Math.round(v)); },'','Numéro de la broche motorisée dans la commande (souvent 2 ; voir le manuel du tour) : N du Fagor, M2= / S2= du Siemens');
    tourNumRow(p,'Vitesse maxi outil tournant',C.smaxL,function(v){ T.smaxL=Math.max(1,v); },'tr/min','Régime maxi de la broche motorisée');
    const rI=faoRow(); rI.appendChild(tourChk('Inverser le sens de C',C.cInv,function(v){ T.cInv=v; },'Angles écrits 360 − C : à cocher si la machine tourne C dans l’autre sens')); p.appendChild(rI);
    p.appendChild(faoHelp('C = 0 : côté du profil dessiné (direction U du modèle). Les lignes de l’axe C et de l’outil tournant se règlent dans la fiche de la machine (PostPro). À valider sur la machine.'));
  }
  // outils
  p.appendChild(faoH('Outils'));
  (setup.tools||[]).forEach(function(t,i){ p.appendChild(tourToolCard(setup,t,i)); });
  const rTo=faoRow();
  [['turn','+ Plaquette'],['bore','+ Barre d’alésage'],['tdrill','+ Foret'],['part','+ Tronçonnage'],['groove','+ Gorge'],['groovei','+ Gorge int.'],['thread','+ Filetage'],['threadi','+ Filetage int.']].concat(C.cax?[['ldrillr','+ Foret motorisé radial'],['ldrilla','+ Foret motorisé axial']]:[]).forEach(function(a){
    rTo.appendChild(faoMini(a[1],function(){ setup.tools.push(tourToolNew(a[0],setup)); },'Ajouter un outil de tour'));
  });
  p.appendChild(rTo);
  // opérations
  p.appendChild(faoH('Opérations'));
  const rO=faoRow();
  TOUR_OP_TYPES.filter(function(ty){ return ty!=='tour_cdrill'; }).map(function(ty){ return [ty,'ext',TOUR_OP_NAMES[ty]]; }).concat(Object.keys(TOUR_OP_NAMES_INT).map(function(ty){ return [ty,'int',TOUR_OP_NAMES_INT[ty]]; })).forEach(function(a){
    const b=document.createElement('button'); b.className='fao-mini'; b.textContent='+ '+a[2];
    b.title='Ajouter « '+a[2]+' » à ce posage';
    b.onclick=function(){ tourAddOp(a[0],setup,a[1]); };
    rO.appendChild(b);
  });
  { const bc=document.createElement('button'); bc.className='fao-mini'; bc.textContent='+ Perçage axe C';
    bc.title='Trous hors de l’axe (radiaux ou axiaux) au foret motorisé : un perçage par sens et par Ø (active l’axe C du posage)';
    bc.onclick=function(){ tourAddCDrill(setup); }; rO.appendChild(bc); }
  const bg=document.createElement('button'); bg.className='fao-mini'; bg.textContent='+ Gamme complète';
  bg.title='Dressage, chariotage, finition, gorges et filet extérieurs, perçage, intérieur (ébauche, alésage, gorges, filet), tronçonnage : ce que la pièce demande, dans cet ordre';
  bg.onclick=function(){ tourAddGamme(setup); };
  rO.appendChild(bg);
  if(!C.rep){
    const br=document.createElement('button'); br.className='fao-mini'; br.textContent='+ Reprise 2e face';
    br.title='Nouveau posage : la pièce tronçonnée, retournée dans le mandrin, pour usiner l’autre bout (brut = résultat de ce posage)';
    br.onclick=function(){ tourAddReprise(setup); };
    rO.appendChild(br);
  }
  p.appendChild(rO);
  const rX=faoRow();
  const bs=document.createElement('button'); bs.textContent='▶ Simulation'; bs.className='primary';
  bs.title='Fait tourner la barre et enlève la matière opération par opération (Échap pour sortir)';
  bs.onclick=function(){ tourSimToggle(); };
  rX.appendChild(bs);
  const be=document.createElement('button'); be.textContent='Exporter le programme';
  be.title='Programme CN de ce posage ('+tourPostOf(setup).label+')';
  be.onclick=function(){ try{ faoExportSetups([setup]); }catch(e){} };
  rX.appendChild(be);
  p.appendChild(rX);
  const st=tourStats(setup);
  const sd=document.createElement('div'); sd.className='fao-note';
  sd.textContent=st.n+' op · coupe '+(st.cut/1000).toFixed(2)+' m · rapides '+(st.rap/1000).toFixed(2)+' m · ≈'+st.tmin.toFixed(1)+' min';
  p.appendChild(sd);
  const note=document.createElement('div'); note.className='fao-note';
  note.textContent='Tour 2 axes : G0 / G1 / G2 / G3, filetage G86 (Fagor) ou G33 (Siemens), X en diamètre. Point programmé : coin théorique de la plaquette ou de la barre, pointe du foret et de l’outil à fileter, coin avant de la lame. Validez toujours le premier programme à vide sur la machine.';
  p.appendChild(note);
}
function tourToolCard(setup,t,i){
  const d=faoCard();
  const r=faoRow();
  r.appendChild(faoLab('T'));
  r.appendChild(faoNum(+t.num||i+1,function(v){ t.num=Math.max(1,Math.round(v)); },36,null,'Numéro d’outil (tourelle) et de correcteur'));
  r.appendChild(faoTxt(t.name||'',function(v){ t.name=v; },150,'Nom de l’outil'));
  r.appendChild(faoLab((TOUR_KIND_LABEL[t.kind]||t.kind)+(t.int?' int.':'')));
  if((setup.tools||[]).length>1)r.appendChild(faoMini('✕',function(){
    setup.tools=setup.tools.filter(function(x){return x!==t;});
    (setup.ops||[]).forEach(function(o){ if(o.toolId===t.id)o.toolId=tourToolEnsure(setup,o.type,tourOpCote(o)).id; });
  },'Supprimer cet outil'));
  d.appendChild(r);
  const g=faoRow();
  const N=function(lab,k,unit,title,min){ g.appendChild(faoLab(lab)); g.appendChild(faoNum(+t[k],function(v){ t[k]=Math.max(min||0,v); },48,null,title)); if(unit)g.appendChild(faoLab(unit)); };
  if(t.kind==='turn'||t.kind==='bore'){
    N('rε','re','mm','Rayon de bec de la plaquette',0.01);
    N('ε','eps','°','Angle de la plaquette (80 : C, 55 : D, 35 : V)',20);
    N('κ','kap','°','Angle d’attaque de l’arête principale (95 : épaulement à angle droit)',60);
    N('arête','l','mm','Longueur d’arête de coupe',2);
  }else if(t.kind==='tdrill'||t.kind==='ldrill'){
    N('Ø','d','mm','Diamètre du foret',0.5);
    N('pointe','ang','°','Angle de pointe',60);
    if(t.kind==='ldrill'){ g.appendChild(faoSel([['rad','radial'],['ax','axial']],t.ax==='ax'?'ax':'rad',function(v){ t.ax=v; },'Radial : le foret vise l’axe du tour ; axial : parallèle à l’axe, sur la face')); }
  }else if(t.kind==='part'){
    N('largeur','w','mm','Largeur de la lame',0.5);
    N('prof. utile','h','mm','Profondeur maximale de coupe de la lame',1);
  }else if(t.kind==='groove'){
    N('largeur','w','mm','Largeur de la plaquette à gorge',0.3);
    N('prof. utile','h','mm','Profondeur maximale de gorge',0.5);
    N('r coin','rc','mm','Rayon des deux coins de la plaquette',0);
  }else if(t.kind==='thread'){
    N('angle','ang','°','Angle du filet (60 : métrique ISO)',29);
  }
  if(t.kind==='bore'||t.int){ const h=faoRow(); h.appendChild(faoLab('Ø mini')); h.appendChild(faoNum(+t.dmin||0,function(v){ t.dmin=Math.max(0,v); },48,null,'Plus petit trou où la barre passe')); h.appendChild(faoLab('mm')); d.appendChild(g); d.appendChild(h); }
  else d.appendChild(g);
  const c=faoRow();
  c.appendChild(faoLab('Vc')); c.appendChild(faoNum(+t.vc||0,function(v){ t.vc=Math.max(1,v); },48,null,'Vitesse de coupe (m/min)')); c.appendChild(faoLab('m/min'));
  if(t.kind!=='thread'){ c.appendChild(faoLab('f')); c.appendChild(faoNum(+t.f||0,function(v){ t.f=Math.max(0.001,v); },48,null,'Avance par tour (mm/tr)')); c.appendChild(faoLab('mm/tr')); }
  else c.appendChild(faoLab('avance = pas du filet'));
  d.appendChild(c);
  d.appendChild(tourToolSvg(t));
  return d;
}
function tourToolSvg(t){
  // petit dessin de l'outil, à l'échelle
  const NS='http://www.w3.org/2000/svg';
  const sv=document.createElementNS(NS,'svg');
  sv.setAttribute('width','120'); sv.setAttribute('height','64');
  try{
    let pts=[];
    if(t.kind==='turn')pts=tourInsertGeo(t,0).poly;
    else if(t.kind==='bore')pts=tourInsertGeo(t,0).poly.map(function(p){ return [p[0],-p[1]]; }).concat([[8,-2],[8,-6]]);
    else if(t.kind==='thread'){ const a=((+t.ang||60)/2)*Math.PI/180, h=3; pts=[[0,0],[h*Math.tan(a),t.int?-h:h],[h*Math.tan(a),(t.int?-1:1)*(h+6)],[-h*Math.tan(a),(t.int?-1:1)*(h+6)],[-h*Math.tan(a),t.int?-h:h]]; }
    else if(t.kind==='groove'){ const w=+t.w||2, h=Math.min(+t.h||4,6*w)+w, s=t.int?-1:1; pts=[[0,0],[0,s*h],[-w,s*h],[-w,0]]; }
    else if(t.kind==='tdrill'){ const r=(+t.d||10)/2, tp=r/Math.tan(((+t.ang||118)/2)*Math.PI/180); pts=[[0,0],[tp,r],[tp+4*r,r],[tp+4*r,-r],[tp,-r]]; }
    else { const w=+t.w||3, h=Math.min(+t.h||20,8*w); pts=[[0,0],[0,h],[-w,h],[-w,0]]; }
    let x0=1/0,x1=-1/0,y0=1/0,y1=-1/0; pts.forEach(function(p){ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); y0=Math.min(y0,p[1]); y1=Math.max(y1,p[1]); });
    const sc=Math.min(110/(x1-x0||1),56/(y1-y0||1));
    const poly=document.createElementNS(NS,'polygon');
    poly.setAttribute('points',pts.map(function(p){ return (5+(p[0]-x0)*sc).toFixed(1)+','+(60-(p[1]-y0)*sc).toFixed(1); }).join(' '));
    poly.setAttribute('fill','#ff9f0a'); poly.setAttribute('fill-opacity','.35'); poly.setAttribute('stroke','#ff9f0a');
    sv.appendChild(poly);
  }catch(e){}
  return sv;
}
/* ----- fiche d'une opération ----- */
function tourOpFiche(p,setup,op,i){
  p.appendChild(faoH('Opération · '+setup.name));
  const d=faoCard();
  if(op.on===false)d.style.opacity='0.55';
  const r=faoRow();
  const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=op.on!==false;
  cb.title='Décocher = ignorer cette opération (aperçu, temps, programme)';
  cb.onchange=function(){ faoSnapshot('activer/désactiver « '+tourOpLabel(op)+' »'); op.on=cb.checked; faoChanged(); };
  r.appendChild(cb);
  const tt=document.createElement('span'); tt.className='fao-opnum'; tt.textContent=(i+1)+'. '+tourOpLabel(op); r.appendChild(tt);
  const kind=tourToolKind(op.type,tourOpCote(op));
  r.appendChild(faoSel((setup.tools||[]).filter(function(t){return tourToolMatch(t,kind);}).map(function(t){ return [t.id,'T'+t.num+' '+t.name]; }),op.toolId,function(v){ op.toolId=v; },'Outil de cette opération'));
  r.appendChild(faoMini('↑',function(){ if(i>0){ setup.ops.splice(i,1); setup.ops.splice(i-1,0,op); } },'Usinée plus tôt'));
  r.appendChild(faoMini('↓',function(){ if(i<setup.ops.length-1){ setup.ops.splice(i,1); setup.ops.splice(i+1,0,op); } },'Usinée plus tard'));
  r.appendChild(faoMini('✕',function(){ setup.ops.splice(i,1); try{ sel={kind:'faoSetup',id:setup.id}; }catch(e){} },'Supprimer cette opération'));
  d.appendChild(r);
  const S=tourStock(setup), M=tourModel(setup);
  const N=function(lab,val,fn,unit,title){ tourNumRow(d,lab,val,fn,unit,title); };
  if(op.type==='tour_face'){
    N('Profondeur par passe',+op.ap||1,function(v){ op.ap=Math.max(0.05,v); },'mm','Épaisseur enlevée à chaque passe de dressage');
    N('Laisse sur la face',+op.laisse||0,function(v){ op.laisse=Math.max(0,v); },'mm','Matière laissée devant Z0 pour une reprise');
  }else if(op.type==='tour_rough'){
    N('Profondeur par passe',+op.ap||2,function(v){ op.ap=Math.max(0.1,v); },'mm','Profondeur de passe sur le rayon');
    N('Laisse radiale',isFinite(+op.sx)?+op.sx:0.3,function(v){ op.sx=Math.max(0,v); },'mm','Matière laissée sur les diamètres pour la finition (sur le rayon)');
    N('Laisse axiale',isFinite(+op.sz)?+op.sz:0.1,function(v){ op.sz=Math.max(0,v); },'mm','Matière laissée sur les faces pour la finition');
    const rp=faoRow(); rp.appendChild(tourChk('Passe de profil à la fin',op.profil!==false,function(v){ op.profil=v; },'Une passe le long du profil enlève les marches laissées entre les passes')); d.appendChild(rp);
    N('Z de fin',tourOpZEnd(setup,op),function(v){ op.zEnd=v; },'mm',op.cote==='int'?'Limite arrière dans l’alésage (par défaut : le fond, ou 1 mm derrière la pièce si débouchant)':'Limite arrière de la pointe (par défaut 1 mm derrière la pièce)');
  }else if(op.type==='tour_finish'){
    N('Laisse',+op.laisse||0,function(v){ op.laisse=Math.max(0,v); },'mm','0 = à la cote');
    N('Z de fin',tourOpZEnd(setup,op),function(v){ op.zEnd=v; },'mm',op.cote==='int'?'Limite arrière dans l’alésage (par défaut : le fond, ou 1 mm derrière la pièce si débouchant)':'Limite arrière de la pointe (par défaut 1 mm derrière la pièce)');
  }else if(op.type==='tour_drill'){
    const B=M&&M.ok?M.bore:null;
    N('Profondeur',+op.depth>0?+op.depth:(B?(B.through?+(M.L+0.5).toFixed(3):+(op.plein!==false?B.full:B.end).toFixed(3)):0),function(v){ op.depth=Math.max(0,v); },'mm','Depuis la face avant (0 = celle de l’alésage du modèle)');
    const rp=faoRow(); rp.appendChild(tourChk('Profondeur au Ø plein',op.plein!==false,function(v){ op.plein=v; },'Coché : la profondeur est celle du Ø plein, la pointe va plus loin ; décoché : profondeur à la pointe')); d.appendChild(rp);
    N('Débourrage tous les',+op.q||0,function(v){ op.q=Math.max(0,v); },'mm','0 = d’un trait ; sinon le foret ressort à chaque fois pour vider les copeaux');
  }else if(op.type==='tour_part'){
    N('Z de coupe',(isFinite(+op.z)&&op.z!==null&&op.z!=='')?+op.z:-(M&&M.ok?M.L:S.L),function(v){ op.z=v; },'mm','Position du coin avant de la lame (par défaut la face arrière de la pièce)');
    N('Jusqu’au Ø',+op.dEnd||0,function(v){ op.dEnd=Math.max(0,v); },'mm','0 = jusqu’au trou percé de part en part, sinon jusqu’au centre (la pièce tombe)');
    N('Brise-copeau tous les',+op.q||0,function(v){ op.q=Math.max(0,v); },'mm','0 = d’un trait');
  }else if(op.type==='tour_groove'){
    d.appendChild(faoHelp('Gorges trouvées seules : là où la plaquette de finition '+(op.cote==='int'?'intérieure':'extérieure')+' laisse de la matière.'));
    N('Laisse',+op.laisse||0,function(v){ op.laisse=Math.max(0,v); },'mm','Matière laissée sur le fond et les parois (0 = à la cote)');
    N('Passe de fond',isFinite(+op.fin)?+op.fin:0.1,function(v){ op.fin=Math.max(0,v); },'mm','Les plongées s’arrêtent à cette distance du fond, une passe le long du fond le termine (0 = plongées seules)');
    N('Brise-copeau tous les',+op.q||0,function(v){ op.q=Math.max(0,v); },'mm','0 = d’un trait');
  }else if(op.type==='tour_cdrill'){
    const rs=faoRow(); rs.appendChild(faoLab('Trous'));
    rs.appendChild(faoSel([['rad','radiaux (vers l’axe)'],['ax','axiaux (sur la face)']],op.dir==='ax'?'ax':'rad',function(v){ op.dir=v; op.toolId=tourToolEnsure(setup,op.type,v).id; },'Sens des trous percés par cette opération'));
    const HS=tourCDrillHoles(setup,op), Ls=[]; HS.all.forEach(function(h){ if(Ls.indexOf(h.d)<0)Ls.push(h.d); });
    if(Ls.length){ rs.appendChild(faoLab('Ø')); rs.appendChild(faoSel([['0','celui du foret']].concat(Ls.sort(function(a,b){ return a-b; }).map(function(x){ return [String(x),'Ø'+x+' ('+HS.all.filter(function(h){ return h.d===x; }).length+')']; })),String(+op.dsel>0?+op.dsel:0),function(v){ op.dsel=+v; if(+v>0){ const t=tourLiveDrillFor(setup,op.dir==='ax'?'ax':'rad',+v); op.toolId=t.id; } },'Ø des trous du modèle percés ici')); }
    d.appendChild(rs);
    N('Débourrage tous les',+op.q||0,function(v){ op.q=Math.max(0,v); },'mm','0 = d’un trait ; sinon le foret ressort à chaque fois pour vider les copeaux');
    if(!tourCfg(setup).cax){ const h=faoHelp('⚠ Le posage n’a pas d’axe C : cochez « Outils tournants (axe C) » dans sa fiche.'); h.style.color='#ff9f0a'; d.appendChild(h); }
  }else if(op.type==='tour_thread'){
    const L=tourThreadsOf(setup).filter(function(x){ return x.int===(op.cote==='int'); });
    const rs=faoRow(); rs.appendChild(faoLab('Filet'));
    const opts=L.map(function(x,k){ return ['m'+k,x.label+' · Z'+(+x.z0.toFixed(2))+' → '+(+x.z1.toFixed(2))+(x.dz>0?' (côté mandrin)':'')]; }).concat([['man','Saisi ici']]);
    rs.appendChild(faoSel(opts,op.src==='man'||!L.length?'man':'m'+Math.max(0,Math.min(L.length-1,+op.idx||0)),function(v){ if(v==='man')op.src='man'; else { op.src='auto'; op.idx=+v.slice(1); } },'Filet pris sur le modèle (fonction Filetage, trou taraudé) ou saisi'));
    d.appendChild(rs);
    if(op.src==='man'||!L.length){
      N('Ø nominal',+op.D||0,function(v){ op.D=Math.max(0,v); },'mm','Ø du filet (M10 : 10)');
      N('Pas',+op.P||0,function(v){ op.P=Math.max(0,v); },'mm','Pas du filet');
      N('Z de début',isFinite(+op.zA)&&op.zA!==''&&op.zA!=null?+op.zA:0,function(v){ op.zA=v; },'mm','Bout libre du filet, côté face avant');
      N('Z de fin',isFinite(+op.zB)&&op.zB!==''&&op.zB!=null?+op.zB:0,function(v){ op.zB=v; },'mm','Fin du filet, côté mandrin');
      const rl=faoRow(); rl.appendChild(tourChk('Filet à gauche',!!op.lh,function(v){ op.lh=v; },'Broche inversée')); d.appendChild(rl);
    }
    N('Passes',+op.n||0,function(v){ op.n=Math.max(0,Math.round(v)); },'','Nombre de passes de coupe, à section constante (0 = une passe par 0,1 mm de profondeur, 3 au moins)');
    N('Passes à vide',isFinite(+op.ressort)?+op.ressort:1,function(v){ op.ressort=Math.max(0,Math.min(5,Math.round(v))); },'','Passes répétées au fond, sans prise de passe');
    N('Angle de pénétration',isFinite(+op.A)?+op.A:30,function(v){ op.A=Math.max(0,Math.min(60,v)); },'°','Cycle G86 du Fagor (A) : pénétration le long du flanc ; les passes G33 du Siemens pénètrent en radial');
  }
  // conditions de coupe (vides = celles de l'outil)
  const cut=tourCut(setup,op);
  const rc=faoRow();
  rc.appendChild(faoLab('Vc')); rc.appendChild(faoNum(cut.vc,function(v){ op.vc=Math.max(1,v); },48,null,'Vitesse de coupe (m/min) de cette opération'));
  rc.appendChild(faoLab('m/min'));
  if(op.type!=='tour_thread'){ rc.appendChild(faoLab('f')); rc.appendChild(faoNum(cut.f,function(v){ op.f=Math.max(0.001,v); },48,null,'Avance (mm/tr) de cette opération'));
  rc.appendChild(faoLab(op.type==='tour_cdrill'?'mm/tr du foret (G94 en mm/min)':'mm/tr')); }
  else rc.appendChild(faoLab('avance = pas, broche constante (G97)'));
  if(isFinite(+op.vc)||isFinite(+op.f))rc.appendChild(faoMini('Outil',function(){ delete op.vc; delete op.f; },'Reprendre les conditions de coupe de l’outil'));
  d.appendChild(rc);
  const g=tourOpGen(setup,op), e=tourOpTime(setup,op,g.moves);
  const info=document.createElement('div'); info.className='fao-note';
  info.textContent=(g.info?g.info+' · ':'')+g.moves.length+' mouvements · coupe '+(e.cut/1000).toFixed(2)+' m · ≈'+e.tmin.toFixed(2)+' min';
  d.appendChild(info);
  (g.warns||[]).forEach(function(w){ const h=faoHelp('⚠ '+w); h.style.color='#ff9f0a'; d.appendChild(h); });
  p.appendChild(d);
  const back=faoRow();
  const bb=document.createElement('button'); bb.textContent='← Posage '+setup.name; bb.style.fontSize='.72rem';
  bb.onclick=function(){ faoSelectSetup(setup.id); };
  back.appendChild(bb);
  p.appendChild(back);
}

/* ----- aperçu 3D ----- */
function tourUc(M,c){ if(!c)return M.U; const a=c*Math.PI/180, k=Math.cos(a), s=Math.sin(a); return [k*M.U[0]+s*M.V[0],k*M.U[1]+s*M.V[1],k*M.U[2]+s*M.V[2]]; }
function tourW(M,z,x,c){ const U=tourUc(M,c); return [M.Pf[0]+M.W[0]*z+U[0]*x,M.Pf[1]+M.W[1]*z+U[1]*x,M.Pf[2]+M.W[2]*z+U[2]*x]; }
function tourBasis(M){
  // repère local (X → U, Y → axe, Z → U × axe) : LatheGeometry tourne autour de son Y
  const U=M.U, W=M.W, Z=[U[1]*W[2]-U[2]*W[1],U[2]*W[0]-U[0]*W[2],U[0]*W[1]-U[1]*W[0]];
  const m=new THREE.Matrix4().makeBasis(new THREE.Vector3(U[0],U[1],U[2]),new THREE.Vector3(W[0],W[1],W[2]),new THREE.Vector3(Z[0],Z[1],Z[2]));
  m.setPosition(M.Pf[0],M.Pf[1],M.Pf[2]);
  return m;
}
function tourMovePts(a,b){ // points (z, x) d'un mouvement, arcs développés
  if(!b.arc)return [[b.z,b.x]];
  const A=b.arc, T=2*Math.PI, a0=Math.atan2(a.x-A.cx,a.z-A.cz), a1=Math.atan2(b.x-A.cx,b.z-A.cz);
  let d=a1-a0; if(!A.cw){ while(d<=0)d+=T; } else { while(d>=0)d-=T; }
  const n=Math.max(2,Math.ceil(Math.abs(d)/(Math.PI/48))), out=[];
  for(let i=1;i<=n;i++){ const q=a0+d*i/n; out.push([A.cz+A.R*Math.cos(q),A.cx+A.R*Math.sin(q)]); }
  return out;
}
function tourPreviewDraw(g,setup){
  const M=tourModel(setup); if(!M||!M.ok)return 0;
  const S=tourStock(setup);
  let selOp=null; try{ if(sel&&sel.kind==='faoOp')selOp=(setup.ops||[]).filter(function(o){return o.id===sel.id;})[0]||null; }catch(e){}
  const B=tourBasis(M);
  // brut (barre) et mors
  try{
    const cy=new THREE.CylinderGeometry(S.R,S.R,S.sortie,64,1,true);
    cy.translate(0,S.face-S.sortie/2,0);
    const mm=new THREE.Mesh(cy,new THREE.MeshBasicMaterial({color:0xffb340,transparent:true,opacity:.10,depthWrite:false,side:THREE.DoubleSide}));
    mm.applyMatrix4(B); mm.raycast=function(){}; mm.renderOrder=5; g.add(mm);
    const ch=new THREE.CylinderGeometry(S.R+18,S.R+18,30,48);
    ch.translate(0,S.chuck-15,0);
    const cm=new THREE.Mesh(ch,new THREE.MeshBasicMaterial({color:0x5b6170,transparent:true,opacity:.35,depthWrite:false}));
    cm.applyMatrix4(B); cm.raycast=function(){}; g.add(cm);
    const ax=new THREE.BufferGeometry().setFromPoints([tourW(M,S.chuck-30,0),tourW(M,S.face+15,0)].map(function(q){return new THREE.Vector3(q[0],q[1],q[2]);}));
    const al=new THREE.Line(ax,new THREE.LineDashedMaterial({color:0x9aa3b2,dashSize:3,gapSize:2}));
    try{ al.computeLineDistances(); }catch(e){}
    al.raycast=function(){}; g.add(al);
  }catch(e){}
  let n=0;
  (setup.ops||[]).forEach(function(op){
    if(!op||op.on===false||op.hidden===true)return;
    const gen=tourOpGen(setup,op), mv=gen.moves; if(!mv.length)return;
    const t=tourOpTool(setup,op)||{}, re=t.kind==='turn'?(+t.re||0.4):0;
    const cut=[], rap=[];
    for(let i=1;i<mv.length;i++){
      const a=mv[i-1], b=mv[i], L=b.rap?rap:cut;
      let pz=a.z, px=a.x;
      tourMovePts(a,b).forEach(function(q){
        const p0=tourW(M,pz+re,px+re,a.c||b.c), p1=tourW(M,q[0]+re,q[1]+re,b.c);
        L.push(p0[0],p0[1],p0[2],p1[0],p1[1],p1[2]); pz=q[0]; px=q[1];
      });
    }
    n+=mv.length;
    const dim=selOp&&selOp!==op;
    const add=function(arr,col,op2){
      if(!arr.length)return;
      const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
      // par-dessus la pièce : le parcours est dans le plan de l'axe, au ras du profil (caché sinon)
      const l=new THREE.LineSegments(bg,new THREE.LineBasicMaterial({color:col,transparent:true,opacity:op2,depthTest:false}));
      l.raycast=function(){}; l.renderOrder=20; g.add(l);
    };
    add(cut,0x2f80ff,dim?0.25:1);
    add(rap,typeof FAO_COL_RAPIDE!=='undefined'?FAO_COL_RAPIDE:0xffd60a,dim?0.12:0.55);
  });
  return n;
}

/* ----- simulation ----- */
let tourSim=null, tourSimBar=null, tourSimEsc=false;
function tourSimToggle(){ if(tourSim){ tourSimClose(); return false; } return tourSimOpen(); }
function tourSimBuild(setup){
  const M=tourModel(setup); if(!M||!M.ok)return null;
  const S=tourStock(setup), C=tourCfg(setup), rapide=Math.max(500,+setup.rapide||10000);
  const segs=[], holes=[]; let T=0;
  tourOpsActive(setup).forEach(function(op){
    const g=tourOpGen(setup,op), mv=g.moves, cut=tourCut(setup,op), t=cut.t||{};
    for(let i=1;i<mv.length;i++){
      const a=mv[i-1], b=mv[i];
      let pz=a.z, px=a.x;
      tourMovePts(a,b).forEach(function(q){
        const l=Math.hypot(q[0]-pz,q[1]-px);
        let dt;
        if(b.rap)dt=l/rapide;
        else{ const D=tourSpinD(cut,(px+q[1])/2);
          const n=Math.min(tourNmax(C,cut),cut.vc*1000/(Math.PI*D)); dt=l/Math.max(1e-6,cut.f*n); }
        segs.push({op:op,t:t,z0:pz,x0:px,z1:q[0],x1:q[1],c:b.c||0,rap:!!b.rap,ta:T,tb:T+dt*60});
        T+=dt*60; pz=q[0]; px=q[1];
      });
      (g.holes||[]).forEach(function(h){ if(h.mi===i)holes.push(Object.assign({t:T},h)); }); // trou fini au bout de ce mouvement
    }
  });
  if(!segs.length)return null;
  // reprise : la pièce du premier posage, retournée, entière (la partie tenue dans le mandrin aussi)
  const g=0.05, z0=S.rep?Math.min(S.chuck,S.rep.zb):S.chuck, n=Math.max(2,Math.ceil((S.face-z0)/g));
  const r0=new Float64Array(n).fill(S.R), i0=new Float64Array(n);
  if(S.rep)for(let k=0;k<n;k++){ const zc=z0+(k+0.5)*g, ro=S.rep.Rat(zc); r0[k]=ro>0?ro:0; i0[k]=ro>0?Math.min(ro,S.rep.RIat(zc)):0; }
  return {setup:setup,M:M,S:S,segs:segs,T:T,t:0,k:0,g:g,z0:z0,n:n,r0:r0,i0:i0,
    rout:Float64Array.from(r0),rin:Float64Array.from(i0),geo:new Map(),crash:0,playing:false,speed:20,dirty:true,holes:holes,nHoles:-1};
}
function tourSimToolApply(sm,t,z,x,rap){
  // enlève la matière sous l'outil placé à (z, x) (point programmé)
  const g=sm.g, z0=sm.z0, n=sm.n, RO=sm.rout, RI=sm.rin;
  let cut=0;
  const col=function(zz){ return Math.floor((zz-z0)/g); };
  if(t.kind==='ldrill')return; // foret motorisé : trous dessinés à part (la matière tournée n'est pas touchée)
  if(t.kind==='tdrill'){
    const r=(+t.d||10)/2, tn=Math.tan(Math.max(30,Math.min(90,(+t.ang||118)/2))*Math.PI/180);
    for(let k=Math.max(0,col(z));k<n;k++){
      const zc=z0+(k+0.5)*g, rd=Math.min(r,(zc-z)*tn); if(rd<=0)continue;
      if(rd>RI[k]&&RO[k]>RI[k]){ cut+=Math.min(rd,RO[k])-RI[k]; RI[k]=Math.min(rd,RO[k]); if(RI[k]>=RO[k]-1e-6){ RI[k]=0; RO[k]=0; } }
    }
  }else if(t.kind==='thread'){
    return; // le filet n'est pas creusé dans la simulation (passes visibles)
  }else if((t.kind==='part'||t.kind==='groove')&&t.int){
    // lame intérieure : coin avant côté paroi, la lame vers l'axe
    const w=+t.w||2;
    for(let k=Math.max(0,col(z-w));k<=Math.min(n-1,col(z));k++){
      if(RO[k]>RI[k]&&x>RI[k]){ cut+=Math.min(x,RO[k])-RI[k]; RI[k]=Math.min(x,RO[k]); if(RI[k]>=RO[k]-1e-6){ RO[k]=0; RI[k]=0; } }
    }
  }else if(t.kind==='part'||t.kind==='groove'){
    const w=+t.w||3, xb=Math.max(0,x);
    for(let k=Math.max(0,col(z-w));k<=Math.min(n-1,col(z));k++){
      if(RO[k]>xb&&RO[k]>RI[k]){ cut+=RO[k]-Math.max(xb,RI[k]); RO[k]=xb; if(RO[k]<=RI[k]+1e-6){ RO[k]=0; RI[k]=0; } }
    }
  }else if(t.kind==='bore'){
    // barre d'alésage : plaquette vue en miroir (centre du bec à x − rε), la matière sous elle vers l'axe
    let G=sm.geo.get(t); if(!G){ G=tourInsertGeo(t,0); sm.geo.set(t,G); }
    const re=G.re, cz=z+re, cx=x-re;
    for(let k=Math.max(0,col(cz+G.x0));k<=Math.min(n-1,col(cz+G.x1));k++){
      const zc=z0+(k+0.5)*g, lw=G.low(zc-cz); if(!(lw<1/0))continue;
      const v=cx-lw;
      if(v>RI[k]&&RO[k]>RI[k]){ cut+=Math.min(v,RO[k])-RI[k]; RI[k]=Math.min(v,RO[k]); if(RI[k]>=RO[k]-1e-6){ RI[k]=0; RO[k]=0; } }
    }
  }else{
    let G=sm.geo.get(t); if(!G){ G=tourInsertGeo(t,0); sm.geo.set(t,G); }
    const re=G.re, cz=z+re, cx=x+re;
    for(let k=Math.max(0,col(cz+G.x0));k<=Math.min(n-1,col(cz+G.x1));k++){
      const zc=z0+(k+0.5)*g, lw=G.low(zc-cz); if(!(lw<1/0))continue;
      const v=Math.max(0,cx+lw);
      if(v<RO[k]&&RO[k]>RI[k]){ cut+=RO[k]-Math.max(v,RI[k]); RO[k]=v; if(RO[k]<=RI[k]+1e-6){ RO[k]=0; RI[k]=0; } }
    }
  }
  if(cut>0)sm.dirty=true;
  if(rap&&cut>0.05)sm.crash++;
}
function tourSimAdvance(sm,tNew){
  if(tNew<sm.t){ sm.rout.set(sm.r0); sm.rin.set(sm.i0); sm.t=0; sm.k=0; sm.crash=0; sm.dirty=true; }
  const segs=sm.segs;
  while(sm.k<segs.length&&segs[sm.k].ta<tNew){
    const s=segs[sm.k];
    const ua=Math.max(0,(sm.t-s.ta)/Math.max(1e-9,s.tb-s.ta)), ub=Math.min(1,(tNew-s.ta)/Math.max(1e-9,s.tb-s.ta));
    const l=Math.hypot(s.z1-s.z0,s.x1-s.x0)*(ub-ua), steps=Math.max(1,Math.ceil(l/0.05));
    for(let i=1;i<=steps;i++){ const u=ua+(ub-ua)*i/steps; tourSimToolApply(sm,s.t,s.z0+(s.z1-s.z0)*u,s.x0+(s.x1-s.x0)*u,s.rap); }
    if(ub>=1)sm.k++; else break;
  }
  sm.t=tNew;
}
function tourSimPos(sm){
  const segs=sm.segs; let s=segs[Math.min(sm.k,segs.length-1)];
  if(!s)return null;
  const u=Math.max(0,Math.min(1,(sm.t-s.ta)/Math.max(1e-9,s.tb-s.ta)));
  return {t:s.t,op:s.op,z:s.z0+(s.z1-s.z0)*u,x:s.x0+(s.x1-s.x0)*u,c:s.c||0};
}
function tourSimMatter(sm){
  // matière : une révolution par morceau continu (après le tronçonnage, la pièce et la barre)
  const g=sm.g, z0=sm.z0, n=sm.n, RO=sm.rout, RI=sm.rin, out=[];
  let k=0;
  while(k<n){
    while(k<n&&!(RO[k]-RI[k]>1e-3))k++;
    if(k>=n)break;
    const a=k; while(k<n&&RO[k]-RI[k]>1e-3)k++;
    const b=k-1;
    const top=[], bot=[];
    for(let j=a;j<=b;j++){ top.push([z0+j*g,RO[j]],[z0+(j+1)*g,RO[j]]); bot.push([z0+j*g,RI[j]],[z0+(j+1)*g,RI[j]]); }
    const T2=tourSimplify(top,0.005), B2=tourSimplify(bot,0.005).reverse();
    // contour (r, z) ; points confondus retirés : LatheGeometry en tirerait des normales NaN
    const raw=[[B2[B2.length-1][1],B2[B2.length-1][0]]];
    T2.forEach(function(p){ raw.push([p[1],p[0]]); });
    B2.forEach(function(p){ raw.push([p[1],p[0]]); });
    const q=raw.filter(function(p,i){ return !i||Math.hypot(p[0]-raw[i-1][0],p[1]-raw[i-1][1])>1e-6; });
    if(q.length>2&&Math.hypot(q[0][0]-q[q.length-1][0],q[0][1]-q[q.length-1][1])<=1e-6)q.pop();
    if(q.length>=3)out.push(q.map(function(p){ return new THREE.Vector2(p[0],p[1]); }));
  }
  return out;
}
function tourSimRender(sm){
  if(!sm.grp)return;
  // trous des forets motorisés déjà percés : cylindres sombres
  const nh=(sm.holes||[]).filter(function(h){ return h.t<=sm.t+1e-9; }).length;
  if(nh!==sm.nHoles){
    sm.nHoles=nh;
    if(sm.hg){ sm.grp.remove(sm.hg); sm.hg.traverse(function(o){ if(o.geometry)o.geometry.dispose(); }); sm.hg=null; }
    if(nh){
      const G=new THREE.Group(), mat=sm.holeMat||(sm.holeMat=new THREE.MeshPhongMaterial({color:0x1f2937,side:THREE.DoubleSide}));
      sm.holes.slice(0,nh).forEach(function(h){
        const a=h.ax==='rad'?tourW(sm.M,h.z,h.x0+0.3,h.c):tourW(sm.M,h.z+0.3,h.x0,h.c), b=h.ax==='rad'?tourW(sm.M,h.z,h.x1,h.c):tourW(sm.M,h.z1,h.x0,h.c);
        const A=new THREE.Vector3(a[0],a[1],a[2]), B=new THREE.Vector3(b[0],b[1],b[2]), L=A.distanceTo(B); if(!(L>1e-6))return;
        const m=new THREE.Mesh(new THREE.CylinderGeometry(h.r,h.r,L,24),mat);
        m.position.copy(A.clone().add(B).multiplyScalar(0.5));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize());
        m.raycast=function(){}; G.add(m);
      });
      sm.hg=G; sm.grp.add(G);
    }
  }
  if(sm.dirty){
    sm.dirty=false;
    if(sm.mat){ sm.grp.remove(sm.mat); sm.mat.traverse(function(o){ if(o.geometry)o.geometry.dispose(); }); }
    const G=new THREE.Group(), B=tourBasis(sm.M);
    tourSimMatter(sm).forEach(function(pts){
      // les points sont en (r, z) relatifs au repère du tour : z → Y local
      const geo=new THREE.LatheGeometry(pts,72);
      const m=new THREE.Mesh(geo,sm.matMat); m.applyMatrix4(B); m.raycast=function(){}; G.add(m);
    });
    sm.mat=G; sm.grp.add(G);
  }
  const P=tourSimPos(sm);
  if(P){
    if(!sm.tool||sm.toolT!==P.t){
      if(sm.tool){ sm.grp.remove(sm.tool); try{ sm.tool.geometry.dispose(); }catch(e){} }
      sm.tool=tourSimToolMesh(P.t); sm.toolT=P.t; sm.grp.add(sm.tool);
    }
    const re=(P.t.kind==='turn'||P.t.kind==='bore')?(+P.t.re||0.4):0;
    const w=tourW(sm.M,P.z+re,P.x+(P.t.kind==='bore'?-re:re),P.c); // centre du bec (barre : vers l'axe)
    const U=tourUc(sm.M,P.c), W=sm.M.W, N2=[W[1]*U[2]-W[2]*U[1],W[2]*U[0]-W[0]*U[2],W[0]*U[1]-W[1]*U[0]];
    const m=new THREE.Matrix4().makeBasis(new THREE.Vector3(W[0],W[1],W[2]),new THREE.Vector3(U[0],U[1],U[2]),new THREE.Vector3(N2[0],N2[1],N2[2]));
    m.setPosition(w[0],w[1],w[2]);
    sm.tool.matrixAutoUpdate=false; sm.tool.matrix.copy(m); sm.tool.matrixWorldNeedsUpdate=true;
  }
  tourSimBarSync(sm,P);
}
function tourSimToolMesh(t){
  // outil dans son plan : x local = le long de l'axe (z), y local = rayon
  let shape=null;
  const sh=function(pts){ const s=new THREE.Shape(); pts.forEach(function(p,i){ if(i)s.lineTo(p[0],p[1]); else s.moveTo(p[0],p[1]); }); return s; };
  if(t.kind==='turn')shape=sh(tourInsertGeo(t,0).poly);
  else if(t.kind==='bore')shape=sh(tourInsertGeo(t,0).poly.map(function(p){ return [p[0],-p[1]]; }).reverse()); // barre : plaquette tournée vers la paroi
  else if(t.kind==='thread'){ const a=((+t.ang||60)/2)*Math.PI/180, h=3, s=t.int?-1:1; shape=sh(s>0?[[0,0],[h*Math.tan(a),h],[h*Math.tan(a),h+15],[-h*Math.tan(a),h+15],[-h*Math.tan(a),h]]:[[0,0],[-h*Math.tan(a),-h],[-h*Math.tan(a),-h-15],[h*Math.tan(a),-h-15],[h*Math.tan(a),-h]]); }
  else if(t.int){ const w=+t.w||2, h=(+t.h||3)+6; shape=sh([[0,0],[-w,0],[-w,-h],[0,-h]]); } // lame intérieure : vers l'axe
  else if(t.kind==='tdrill'||(t.kind==='ldrill'&&t.ax==='ax')){ const r=(+t.d||10)/2, tp=r/Math.tan(((+t.ang||118)/2)*Math.PI/180); shape=sh([[0,0],[tp,r],[tp+60,r],[tp+60,-r],[tp,-r]]); }
  else if(t.kind==='ldrill'){ const r=(+t.d||6)/2, tp=r/Math.tan(((+t.ang||118)/2)*Math.PI/180); shape=sh([[0,0],[r,tp],[r,tp+40],[-r,tp+40],[-r,tp]]); } // radial : pointe vers l'axe
  else { const w=+t.w||3, h=(+t.h||20)+10; shape=sh([[0,0],[0,h],[-w,h],[-w,0]]); }
  const geo=new THREE.ExtrudeGeometry(shape,{depth:4,bevelEnabled:false});
  geo.translate(0,0,-2);
  const m=new THREE.Mesh(geo,new THREE.MeshPhongMaterial({color:0xff9f0a,side:THREE.DoubleSide}));
  m.raycast=function(){};
  return m;
}
function tourSimOpen(){
  try{
    const setup=faoSetup();
    if(!tourIs(setup)){ faoViewerMsg('Tournage : choisissez un posage tour.'); return false; }
    const sm=tourSimBuild(setup);
    if(!sm){ faoViewerMsg('Tournage : aucune trajectoire à simuler — ajoutez une opération.'); return false; }
    tourSim=sm;
    sm.grp=new THREE.Group(); sm.grp.name='tourSim';
    sm.matMat=new THREE.MeshPhongMaterial({color:0xb9bec7,side:THREE.DoubleSide,shininess:60});
    faoAdd3D(sm.grp);
    sm.hidden=[];
    try{ (typeof bodies!=='undefined'?bodies:[]).forEach(function(b){ if(b&&b.mesh&&b.mesh.visible!==false){ b.mesh.visible=false; sm.hidden.push(b); } }); }catch(e){}
    try{ if(faoPrevGroup){ sm.prevVis=faoPrevGroup.visible!==false; faoPrevGroup.visible=false; } }catch(e){}
    tourSimBarShow();
    tourSimRender(sm);
    tourSimPlay();
    if(!tourSimEsc&&typeof window!=='undefined'&&window.addEventListener){
      tourSimEsc=true;
      window.addEventListener('keydown',function(e){ if(e.key==='Escape'&&tourSim){ tourSimClose(); } });
    }
    faoViewerMsg('Tournage : simulation en cours (Échap ou ✕ pour sortir).');
    return true;
  }catch(e){ faoViewerMsg('Simulation tour : '+((e&&e.message)||e)); return false; }
}
function tourSimClose(){
  const sm=tourSim; tourSim=null;
  if(!sm)return;
  sm.playing=false;
  try{ if(sm.grp){ faoDel3D(sm.grp); sm.grp.traverse(function(o){ if(o.geometry)o.geometry.dispose(); }); } }catch(e){}
  try{ sm.hidden.forEach(function(b){ if(b.mesh)b.mesh.visible=true; }); }catch(e){}
  try{ if(faoPrevGroup)faoPrevGroup.visible=sm.prevVis!==false; }catch(e){}
  try{ if(tourSimBar)tourSimBar.style.display='none'; }catch(e){}
}
function tourSimPlay(){
  const sm=tourSim; if(!sm)return;
  if(sm.t>=sm.T)tourSimAdvance(sm,0);
  sm.playing=true;
  let last=null;
  const step=function(ts){
    if(tourSim!==sm||!sm.playing)return;
    if(last===null)last=ts;
    const dt=Math.min(0.1,(ts-last)/1000); last=ts;
    tourSimAdvance(sm,Math.min(sm.T,sm.t+dt*sm.speed));
    tourSimRender(sm);
    if(sm.t>=sm.T){ sm.playing=false; tourSimBarSync(sm,tourSimPos(sm)); return; }
    requestAnimationFrame(step);
  };
  try{ requestAnimationFrame(step); }catch(e){}
}
function tourSimSeek(u){
  const sm=tourSim; if(!sm)return;
  tourSimAdvance(sm,Math.max(0,Math.min(1,u))*sm.T);
  tourSimRender(sm);
}
function tourSimFmt(s){ s=Math.round(s); const m=Math.floor(s/60); return m+':'+((s%60)<10?'0':'')+(s%60); }
function tourSimBarShow(){
  if(tourSimBar){ tourSimBar.style.display='flex'; return; }
  try{
    const host=document.getElementById('vpwrap')||document.body;
    const bar=document.createElement('div'); bar.id='tourSimBar';
    bar.style.cssText='position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;'
      +'background:rgba(18,20,24,.94);border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:6px 10px;'
      +'z-index:30;font-size:.78rem;color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.45);max-width:calc(100% - 24px);flex-wrap:wrap;justify-content:center;';
    const mk=function(t,title,fn){ const b=document.createElement('button'); b.textContent=t; b.title=title; b.style.fontSize='.85rem'; b.onclick=fn; bar.appendChild(b); return b; };
    mk('▶','Lecture',function(){ tourSimPlay(); });
    mk('⏸','Pause',function(){ if(tourSim)tourSim.playing=false; });
    mk('⏹','Retour au début',function(){ if(tourSim){ tourSim.playing=false; tourSimSeek(0); } });
    const rg=document.createElement('input'); rg.type='range'; rg.min='0'; rg.max='1000'; rg.value='0'; rg.style.width='220px';
    rg.title='Avancer / reculer dans le programme';
    rg.oninput=function(){ if(tourSim){ tourSim.playing=false; tourSimSeek(+rg.value/1000); } };
    bar.appendChild(rg);
    const sp=document.createElement('select'); sp.title='Vitesse de lecture';
    [[1,'×1'],[5,'×5'],[20,'×20'],[100,'×100']].forEach(function(o){ const e=document.createElement('option'); e.value=o[0]; e.textContent=o[1]; sp.appendChild(e); });
    sp.value='20'; sp.onchange=function(){ if(tourSim)tourSim.speed=+sp.value; };
    bar.appendChild(sp);
    const lb=document.createElement('span'); lb.style.minWidth='220px'; bar.appendChild(lb);
    mk('✕','Quitter la simulation (Échap aussi)',function(){ tourSimClose(); });
    host.appendChild(bar);
    tourSimBar=bar; bar._rg=rg; bar._lb=lb; bar._sp=sp;
  }catch(e){}
}
function tourSimBarSync(sm,P){
  if(!tourSimBar)return;
  try{
    if(tourSimBar._sp)tourSimBar._sp.value=String(sm.speed);
    tourSimBar._rg.value=String(Math.round(1000*sm.t/Math.max(1e-9,sm.T)));
    tourSimBar._lb.textContent=tourSimFmt(sm.t)+' / '+tourSimFmt(sm.T)+(P?(' · '+tourOpLabel(P.op)+' T'+P.t.num+' · X'+tourFmt(2*P.x)+' Z'+tourFmt(P.z)):'')
      +(sm.crash?(' · ⚠ '+sm.crash+' rapide'+(sm.crash>1?'s':'')+' dans la matière'):'');
  }catch(e){}
}
