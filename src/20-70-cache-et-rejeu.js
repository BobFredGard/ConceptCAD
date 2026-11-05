function occCleanup(FR,keepShape){
  if(!FR)return;
  occDispose(FR.bin);
  // Au rebuild, le solide d'un corps fait d'une seule extrusion EST son item : il est affiché
  // (b.shape), donc gardé, sinon mesures et faces exactes échouent dès qu'il y a deux corps.
  const affiches=new Set(keepShape?(FR.perBody||[]).map(p=>p.shape):[]);
  (FR.itemShapes||[]).forEach(s=>{if(s!==keepShape&&!affiches.has(s)){try{s.delete();}catch(e){}}});
  if(FR.shape&&FR.shape!==keepShape){try{FR.shape.delete();}catch(e){}}
  if(FR.shapeFao){try{FR.shapeFao.delete();}catch(e){}}
  (FR.preThr||[]).forEach(p=>{try{p.shape.delete();}catch(e){}});
  // Rejeux jetables (projections, export : keepShape==null) : les solides par corps
  // partent aussi, sinon chaque passe upto fuit ses solides. Au rebuild (keep = occLive),
  // ce sont eux qui sont AFFICHÉS : on n'y touche jamais (b.shape les référence).
  if(!keepShape)(FR.perBody||[]).forEach(p=>{try{if(p.shape&&p.shape!==FR.shape)p.shape.delete();}catch(e){}});
}
/* ---------- cache de rejeu : solide accumulé en « points de contrôle » ----------
   Mesuré sur le noyau exact : une fusion costs 67-170 ms, une COPIE du solide
   accumulé 1-4 ms (30 a 80x moins cher). On memorise donc le solide tel qu'il est
   apres chaque fonction. Si le DEBUT de la timeline est inchange, on repart de la
   derniere copie correspondante et on ne refait QUE les fusions a partir de la
   modification — exactement le principe « reconstruire a partir de la modification ».
   Les cles sont des signatures de prefixe cumulatives : un seul octet de difference
   invalide tout ce qui suit, donc aucune geometrie perimee ne peut etre reutilisee. */
let occCk=[]; // [{key,shape}] du plus ancien au plus recent
let occCkWarn={}; // avertissements de congé par point de contrôle (mêmes entrées = mêmes messages)
// V0.16.0 : relevé pos/len des arêtes d'un congé exact tel qu'au point de contrôle. Il n'est plus
// dans la clé (featSig) : un point de contrôle retrouvé le RESTITUE, comme un recalcul l'aurait
// rafraîchi (retour à une valeur précédente : relevé de cet état-là, pas du dernier rejeu).
let occCkEdges={};
let occProjPass=0; // 0 = rejeu principal ; >=1 = passe de projection imbriquée (rebuild(pass))
// Limite adaptative : 8 points de contrôle sur une timeline de 13 fonctions évacuaient les
// prÉfixes (les projections upto<13 ne trouvaient JAMAIS leur point de contrôle → rejeu
// complet 4 fois par reconstruction). On couvre toute la timeline, bornée pour la mémoire.
function occCkMax(){
  const n=(((typeof doc!=='undefined')&&doc&&doc.features)?doc.features.length:0)+2;
  // 2026-10-16-003 : 3 × la timeline (bornée) — après une modification, l'ancien ET le nouveau
  // préfixe coexistent pendant les passes de projection ; à 1 × ils s'évinçaient mutuellement.
  const base=Math.max(8,Math.min(3*n,120));
  // V0.29.0 : assemblage — la file est commune à tous les composants (clés préfixées, asmCkPrefix)
  // mais bornée par la timeline de la pièce OUVERTE : une petite pièce évinçait les points de
  // contrôle de toutes les autres, et revenir dans une grosse pièce la rejouait en entier
  // (1,1 à 1,7 s → 0,2 s gardée). Plafond large tant que le tas du noyau reste raisonnable.
  try{
    if(typeof asm!=='undefined'&&asm&&asm.comps&&asm.comps.length>1&&!(occt&&occt.HEAP8&&occt.HEAP8.length>OCC_CK_HEAP))return Math.max(base,OCC_CK_ASM);
  }catch(e){}
  return base;
}
const OCC_CK_ASM=200;          // points de contrôle gardés en assemblage (toutes pièces confondues)
const OCC_CK_HEAP=1536*1048576; // au-delà de 1,5 Go de tas du noyau : retour à la borne d'une pièce
function occShapeCopy(sh){
  try{return nomsPartage(sh,new occt.BRepBuilderAPI_Copy_2(sh,true,true).Shape());}catch(e){return null;}
}
// 2026-10-16-003 : cache des OUTILS (prisme d'extrusion / révolution / perçage) par clé de
// préfixe — la même que les points de contrôle. Sur un point de contrôle trouvé, l'outil
// était quand même reconstruit (fusion des profils ≈ 45 % d'un rejeu « sans changement »).
let occToolCk=new Map(); // ckKey → {shape, warnings, thr}
let occThreadSkip=false; // V0.21.19 : rejeu partiel en cours — filets modélisés sautés
function occToolCkGet(key){
  if(freshHard&&!(occProjPass>=1))return null;
  const t=occToolCk.get(key);if(!t)return null;
  occToolCk.delete(key);occToolCk.set(key,t); // fraîcheur
  const sh=occShapeCopy(t.shape);if(!sh)return null;
  return {shape:sh,bins:[],warnings:t.warnings.slice(),thr:t.thr?occShapeCopy(t.thr):null};
}
function occToolCkPut(key,r){
  if(freshHard&&!(occProjPass>=1))return;
  if(!r||!r.shape||occToolCk.has(key))return;
  const cp=occShapeCopy(r.shape);if(!cp)return;
  occToolCk.set(key,{shape:cp,warnings:(r.warnings||[]).slice(),thr:r.thr?occShapeCopy(r.thr):null});
  while(occToolCk.size>occCkMax()){const k=occToolCk.keys().next().value;const o=occToolCk.get(k);occToolCk.delete(k);try{o.shape.delete();}catch(e){}try{if(o.thr)o.thr.delete();}catch(e){}}
}
function occCkClear(){
  for(const c of occCk){try{c.shape.delete();}catch(e){}}
  occCk=[];occCkWarn={};occCkEdges={};
  occToolCk.forEach(o=>{try{o.shape.delete();}catch(e){}try{if(o.thr)o.thr.delete();}catch(e){}});occToolCk=new Map();
}
function skSig(sk){
  // Signature numerique d'une esquisse : base (position + axes), points, entites,
  // contraintes, cotes. MarcheArithmetique directe — pas de JSON.stringify (40x moins cher).
  let h=2166136261;
  const mix=v=>{h^=(+v||0)|0;h=Math.imul(h,16777619);};
  // ARRONDI (pas troncature `|0`) : une cote ronde portée par le solveur à ±1e-9 près
  // (−10,999999999 / −11,000000001) tombait de part et d'autre d'un entier → signature
  // instable, point de contrôle raté et tout l'aval rejoué.
  mix(sk.seq);
  const u=sk.axU||[1,0,0],v=sk.axV||[0,1,0],w=sk.axN||[0,0,1],o=sk.origin||[0,0,0];
  for(let i=0;i<3;i++){mix(Math.round(+u[i]*1e6));mix(Math.round(+v[i]*1e6));mix(Math.round(+w[i]*1e6));mix(Math.round(+o[i]*1e6));}
  // Seul le PROFIL compte : construction et références 3D ne participent jamais au solide
  // (extrusion, ancrages) — les projeter ne doit donc pas invalider les points de contrôle.
  const C=sk.constraints||[],D=sk.dims||[],P=sk.points||{};
  const E=(sk.entities||[]).filter(e=>!e.construction&&!e.ref);
  const used=new Set();
  for(const e of E){used.add(e.p1);used.add(e.p2);used.add(e.pc);used.add(e.pa);used.add(e.pb);used.add(e.p);}
  mix(E.length);mix(C.length);mix(D.length);
  const K=Object.keys(P).filter(k=>used.has(k));mix(K.length);
  for(const k of K){
    for(let i=0;i<k.length;i++)mix(k.charCodeAt(i));
    const p=P[k]||{};mix(Math.round(+p.x*1000));mix(Math.round(+p.y*1000));
  }
  for(const e of E){mix(e.t?e.t.length:0);mix(Math.round(+e.r*1000));mix(e.p1?e.p1.length:0);mix(e.p2?e.p2.length:0);}
  for(const c of C)mix(c.type?c.type.length:0);
  return (h>>>0).toString(36);
}
function featSig(f){
  // Signature COMPLÈTE des entrées dont dépend le solide : toute propriété lue par
  // extrudeSpan / occShapeOfExtrude / occApplyXFillets doit y figurer, sinon le cache
  // pourrait réutiliser un solide périmé.(paramètres d'extrusion, à travers tout, congés
  // et rims 2D rattachés, arêtes et rayon des chanfreins/congés exacts, répétitions).
  // flip (sens inversé) et draft (dépouille d'extrusion) modifient le prisme : sans eux
  // dans la signature, basculer le sens ou l'angle réutiliserait le solide périmé.
  let s=f.type+'|'+(f.op||'add')+'|'+(+f.distance||0)+'|'+(f.mid?1:0)+'|'+(f.visible!==false?1:0)+'|'+(f.through?1:0)+'|'+(f.upto?JSON.stringify(f.upto):'')+'|'+(f.flip?1:0)+'|'+(+f.draft||0)+'|b'+(f.body||'');
  if(f.type==='import'&&f.derive)s+='|k'+((f.src&&f.src.key)||''); // corps dérivé (52) : sa forme suit la source
  // V0.47.0 : import pas encore restauré (ouverture, F5 : le noyau rejoue avant importRestorePending).
  // Sans cette marque, une combinaison dont il est l'outil gardait en mémoire son résultat SANS
  // l'outil, repris tel quel une fois l'import revenu : la soustraction disparaissait.
  if(f.type==='import'&&!(typeof importGeom!=='undefined'&&(importGeom.get(f.id)||{}).brep))s+='|!';
  if(f.type==='hole'){
    // Perçage : esquisse (centres) + tous les paramètres qui façonnent l'outil de découpe.
    const skH=doc.sketches.find(x=>x.id===f.sketchId);
    s+='|'+f.sketchId+'|'+(skH?skSig(skH):'?')+'|'+JSON.stringify([f.kind,f.d,f.thread||null,f.cbD,f.cbH,f.csD,f.csA,f.end,f.depth,f.tip,!!f.flip,f.uptoPlane||null].concat(f.kind==='ream'?[f.reamD,f.reamH,f.pilot,f.reamOff]:(f.kind==='step'?[f.stD,f.stH,f.stTip]:[])));
    if(skH)(skH.entities||[]).forEach(e=>{if(e&&e.t==='cpoint'&&e.hole){const Q=skH.points[e.p];if(Q)s+=';h'+Q.x.toFixed(4)+','+Q.y.toFixed(4);}});
  }
  if(f.type==='xthread'){
    // Filetage (76-filetage) : axe visé, taille, pas, sens, longueur, départ, filet modélisé ou non
    s+='|'+JSON.stringify([f.cyl||null,f.size,+f.p||0,!!f.lh,!!f.model,+f.clear||0,f.lenMode||'full',+f.len||0,!!f.flip]);
  }
  if(f.type==='gear')s+='|'+JSON.stringify(gearSig(f)); // Engrenage (76-engrenage) : ses réglages font tout le solide
  if(f.type==='sweep'){
    // Balayage (75-balayage) : profil ET chemin — éditer l'un ou l'autre change le solide
    const sk=doc.sketches.find(x=>x.id===f.sketchId),pk=doc.sketches.find(x=>x.id===f.pathId);
    s+='|'+f.sketchId+'|'+(sk?skSig(sk):'?')+'|pa'+f.pathId+'|'+(pk?skSig(pk):'?');
  }
  if(f.type==='extrude'||f.type==='revolve'){
    s+='|'+f.sketchId;
    const sk=doc.sketches.find(x=>x.id===f.sketchId);s+='|'+(sk?skSig(sk):'?');
    if(f.type==='revolve')s+='|ax'+JSON.stringify(f.axis||null)+'|an'+(+f.angle||360);
    // Congés 2D et rims rattachés à CETTE extrusion (ils modifient son prisme)
    (doc.features||[]).forEach(x=>{
      if(x.type!=='fillet'||x.target!==f.id||x.visible===false)return;
      s+=';fill'+(+x.radius||0)+(x.rimTop?1:0)+(x.rimBot?1:0)+JSON.stringify(x.rims||null);
    });
  }else if(f.type==='xfillet'){
    // Le RAYON et l'ANCRE font partie de la géométrie : sans eux, changer le rayon d'un
    // congé laissait la signature inchangée et le point de contrôle réappliquait l'ancien
    // solide (le congé nouveau n'apparaissait pas). `pos`/`len` sont rafraîchis par
    // occApplyXFillets à chaque appariage réussi, donc ils décrivent l'arête réellement
    // résolue ; l'ancre décrit le ciblage (même position, arête voisine possible).
    // tangent (chaîne déduite à chaque rejeu) et seed (arête germe) changent la GÉOMÉTRIE
    // appliquée : les mettre dans la signature force le cache à rejouer quand on décoche
    // « arêtes tangentes » ou qu'on change de germe — sinon le solide périmé persiste.
    // V0.11.19 : mode du chanfrein (deux distances / angle / inversion) = géométrie aussi.
    s+='|'+(f.chamfer?1:0)+'|'+(f.chamfer?xChamKey(xChamOpts(f)):'')+'|'+(f.tangent?1:0)+'|'+((f.edges||[]).map(e=>
      // 2026-10-16-008 : position d'ORIGINE figée (pos0) et non le relevé pos/len rafraîchi à
      // chaque appariement — sinon la signature changeait APRÈS chaque rejeu (point de contrôle
      // jamais retrouvé). Un changement en amont change déjà le préfixe : aucune fraîcheur perdue.
      (+e.r||0)+(e.seed?'s':'')+(Array.isArray(e.fn)?'n'+e.fn.map(x=>(+x).toFixed(2)).join(','):'')+'@'+(e.pos0||e.pos||[]).map(x=>(+x).toFixed(3)).join(',')
      +((e.anchor)?('#'+e.anchor.t+(e.anchor.sk||'')+(e.anchor.id||'')+'z'+(e.anchor.z||0)+'s'+(e.anchor.side||0)+'d'+(e.anchor.dist||0)+'f'+(e.anchor.far||0)):'')).join(';'));
  }else if(f.type==='combine'){
    // mode + historique COMPLET des corps outils jusqu'à la combinaison
    s+='|'+(f.mode||'union')+'|'+(f.keep?1:0)+'|'+(f.tools||[]).map(t=>t+':'+occCombinePrefix(f,t).map(featSig).join(',')).join('/');
  }else if(f.type==='xmove'){
    // La DISTANCE fait partie de la géométrie, et la face visée par sa référence durable
    // (centre + normale + dimensions) : sans elle, changer la distance d'un déplacement
    // laisserait la signature inchangée et le point de contrôle réappliquerait l'ancien.
    s+='|d'+(+f.dist||0)+'@'+JSON.stringify(mvRefs(f).map(r=>r.st&&!r.n?[r.pos,r.st,r.dim]:[r.pos,r.n,r.dim]))+(f.tangent?'|t':'');
  }else if(f.type==='bmove'){
    // Déplacer un corps : ses étapes (translations, rotations, point à point) font la géométrie
    s+='|'+JSON.stringify(f.steps||[]);
  }else if(f.type==='bscale'){
    // Échelle : centre, facteur(s) et, en copie, l'historique du corps source (comme xsplit)
    s+='|'+JSON.stringify([f.o||[0,0,0],bsFactors(f),f.copy?1:0]);
    if(occSplitNewBody(f))s+='|src:'+occCombinePrefix(f,occBodyOfFeat(f)).map(featSig).join(',');
  }else if(f.type==='xdelface'){
    s+='|'+((f.faces||[]).map(r=>JSON.stringify([r.pos,r.n||r.st,r.dim])).join(';'));
  }else if(f.type==='xsplit'){
    // Plan RÉSOLU (un plan de construction peut bouger sans que la fonction change) et,
    // pour le corps neuf, l'historique du corps source jusqu'à la scission (comme combine).
    const P=splitPlaneOf(f);
    s+='|'+P.o.map(v=>(+v).toFixed(4)).join(',')+'/'+P.n.map(v=>(+v).toFixed(6)).join(',');
    if(occSplitNewBody(f))s+='|src:'+occCombinePrefix(f,occBodyOfFeat(f)).map(featSig).join(',');
  }else if(f.type==='xdraft'){
    // L'ANGLE fait partie de la géométrie, ainsi que la face de référence (plan neutre)
    // et les faces visées (références durables pos/n/dim). Sans elles, changer l'angle
    // laissait la signature inchangée et le point de contrôle réappliquait l'ancien
    // solide — la dépouille semblait « valide » mais restait invisible (Pièce 7).
    const q=r=>r?((r.pos||[]).map(v=>(+v).toFixed(2)).join(',')+'/'+(r.n||[]).map(v=>(+v).toFixed(3)).join(',')+'/'+(r.dim||[]).map(v=>(+v).toFixed(2)).join(',')):'?';
    s+='|a'+draftAngleEff(f)+'@'+q(f.ref)+'|'+((f.faces||[]).map(q).join(';')); // V0.11.19 : angle signé + flip
  }else if(f.type==='xshell'){
    // L'ÉPAISSEUR et les faces RETIRÉES (ouvertures) font partie de la géométrie :
    // sans elles le cache réappliquerait l'ancien évidage après un changement.
    const q=r=>r?((r.pos||[]).map(v=>(+v).toFixed(2)).join(',')+'/'+(r.n||[]).map(v=>(+v).toFixed(3)).join(',')+'/'+(r.dim||[]).map(v=>(+v).toFixed(2)).join(',')):'?';
    s+='|t'+(+f.thick||0)+'|'+((f.faces||[]).map(q).join(';'));
  }else if(f.type==='repeat'){
    s+='|'+(f.base||[]).join(',')+'|'+(+f.copies||1)+'|'+(+f.dist||0)+'|'+(+f.angle||0)+'|'+(f.axis||f.plane||'')+'|'+JSON.stringify(f.planeN||null)+'|'+(f.plane2||'')+'|'+JSON.stringify(f.planeN2||null)
      +'|'+JSON.stringify(f.dir||null)+'|'+(f.lin2?[f.axis2,JSON.stringify(f.dir2||null),+f.copies2||1,+f.dist2||0].join(','):''); // 2ᵉ direction (grille)
  }
  // Filet (2026-10-02-011) : la fonction ENTIÈRE entre dans la signature — toute
  // propriété, connue ou future, invalide le suffixe dès qu'elle bouge, donc jamais
  // de solide périmé réutilisé si un champ se rajoute au moteur. Exclus :
  // _mesh/_m (état dérivé vivant, non géométrique — _mesh est une référence THREE
  // non sérialisable), name/open (affichage pur : replier un nœud ou renommer ne
  // change pas le solide et invaliderait tout). _calc : suppression au worker (21), état
  // dérivé lui aussi — dans la clé, la réponse du worker ne serait jamais retrouvée.
  // V0.16.0 : congé exact — le relevé pos/len, rafraîchi à chaque appariement (bruit ~1e-9),
  // est exclu du filet quand pos0 le fige : il y rentrait par la fonction entière et changeait la
  // clé après chaque rejeu (point de contrôle raté, tout l'aval rejoué sans changement).
  const jf={};for(const k in f){if(k==='name'||k==='open'||k==='_m'||k==='_mesh'||k==='_calc')continue;jf[k]=f[k];}
  if(f.type==='xfillet'&&Array.isArray(f.edges))jf.edges=f.edges.map(e=>{if(!e||typeof e!=='object')return e;const q=Object.assign({},e);if(q.pos0)delete q.pos;delete q.len;return q;});
  s+='|j'+JSON.stringify(jf,nomsSansCles);
  return s;
}
function occCkGet(key){
  for(let i=occCk.length-1;i>=0;i--)if(occCk[i].key===key)return occCk[i].shape;
  return null;
}
function occCkPut(key,mkShape){
  // Mode frais (2026-10-02-014) : le rejeu principal (pass 0) ne MÉMORISE rien —
  // fraîcheur absolue et copie BRep (1 à 4 ms) économisée à chaque fonction. Seules
  // les passes de projection imbriquées (rebuild(pass>=1)) posent leurs points de
  // contrôle : elles rejouent un préfixe déjà stabilisé par le rejeu courant.
  if(freshHard&&!(occProjPass>=1))return;
  const mk=(typeof mkShape==='function')?mkShape:null;
  const i=occCk.findIndex(c=>c.key===key);
  if(i>=0){
    // Déjà mémorisé : on GARDE l'existant, on remonte sa fraîcheur (fin de file = à évacuer
    // en dernier). (Ne comparer qu'à la dernière clé laissait les doublons gonfler la file
    // et évacuer les vrais points de contrôle.) La copie n'est même plus fabriquée.
    const old=occCk[i];occCk.splice(i,1);occCk.push(old);
    if(!mk&&mkShape){try{mkShape.delete();}catch(e){}}
    return;
  }
  const shape=mk?mk():mkShape;
  if(!shape)return;
  occCk.push({key,shape});
  while(occCk.length>occCkMax()){const old=occCk.shift();try{old.shape.delete();}catch(e){}delete occCkEdges[old.key];}
}
// V0.23.26 : occPrefixTap(bid,f,solide) — observateur du rejeu (occFaceCreator, 90) : appelé après
// CHAQUE fonction du rejeu de premier niveau (pas celui d'un corps outil de combinaison), solide
// accumulé à ce point de la timeline, prêté (ne pas le garder ni le libérer).
let occPrefixTap=null,occReplayNest=0;
function occReplayBody(bid,list){
  occReplayNest++;
  try{return occReplayBodyIn(bid,list);}finally{occReplayNest--;}
}
// V0.42.0 : le rejeu est un GÉNÉRATEUR qui rend la main avant chaque fonction ({bid,fs}).
// La voie synchrone (occReplayBodyIn, occFinalShape) le vide d'une traite : même code, même
// ordre, même résultat. La régénération avec barre de progression (31) le vide par tranches.
function occDrain(g){for(;;){const r=g.next();if(r.done)return r.value;}}
function* occNestGen(g){
  // occReplayNest +1 SEULEMENT pendant que le rejeu du corps calcule (pas pendant qu'il attend
  // entre deux tranches : un rejeu synchrone glissé dans l'intervalle reste de premier niveau).
  for(;;){
    let r;occReplayNest++;
    try{r=g.next();}finally{occReplayNest--;}
    if(r.done)return r.value;
    yield r.value;
  }
}
function occReplayBodyIn(bid,list){return occDrain(occReplayBodyGen(bid,list));}
function* occReplayBodyGen(bid,list){
  // Rejeu ISOLÉ d'un corps : mêmes règles que l'ancien rejeu global (ordre timeline,
  // Fuse/Cut, congés/déplacements/dépouilles/coques entrelacés, cache par points de
  // contrôle), mais l'accumulateur ne voit QUE les fonctions du corps — une découpe du
  // corps A ne retire jamais de matière au corps B (Fusion). Les clés de cache sont
  // préfixées du corps : deux corps aux signatures identiques ne se partagent rien.
  const bin=[],itemShapes=[],imports=[];let result=null;const msgs=[],ghostShapes=[];
  let ckKey=asmCkPrefix()+bid+'|'+(occSkipFeat||'')+'|'; // signature cumulée du préfixe — SANS marqueur upto :
  // ALL et UPn parcourent les MÊMES préfixes cumulatifs ; un marqueur dans la clé privait
  // les projections (upto<n) de tous les points de contrôle posés par le rejeu complet.
  const items=[]; // extrudes réussies, dans l'ordre (affichage nA/nC)
  const threads=[]; // V0.21.19 : filets modélisés (vides filetés), creusés en fin de rejeu
  // Un import SEUL reste affiché comme avant (son mesh, son nom dans Pièces) ;
  // dès qu'AU MOINS une autre fonction coexiste dans le corps, il entre dans la
  // chaîne exacte et devient le volume à unir / soustraire.
  // Outil de face ouvert sur un STEP seul (occStepForce) : il entre aussi dans la chaîne.
  const importSeul=!occStepForce&&!list.some(f=>f&&f.type!=='import');
  const step=f=>{
    const ckPre=ckKey; // clé du solide d'entrée de cette fonction (worker de suppression, 21)
    ckKey+=featSig(f)+';';
    if(f.type==='xfillet'){
      if(!result){msgs.push(`${f.name} : aucun volume à congédier — ignoré`);return;}
      // Préfixe inchangé : ce congé exact est déjà appliqué dans la copie mémorisée —
      // solide ET avertissements réutilisés sans rejouer l'opération (6 congés ≈ 30 ms/pièce).
      const ckX=occCkGet(ckKey);
      const cpX=ckX?occShapeCopy(ckX):null;
      if(cpX){
        try{result.delete();}catch(e){}result=cpX;
        const w=occCkWarn[ckKey];if(w&&w.length)msgs.push(...w.map(x=>`${f.name} : ${x}`));
        const sv=occCkEdges[ckKey];
        if(sv&&Array.isArray(f.edges)&&sv.length===f.edges.length)f.edges.forEach((e,i)=>{if(e&&sv[i]){if(sv[i].pos)e.pos=sv[i].pos.slice();if(sv[i].len!=null)e.len=sv[i].len;}});
        return;
      }
      const snapX=nomsInstantane(result); // reprise NURBS : pas d'historique du noyau
      const r=occApplyXFillets(result,[f]);
      nomsCompleter(r.shape,null,snapX);
      result=r.shape;msgs.push(...r.warnings.map(w=>`${f.name} : ${w}`));
      if(r.warnings.length)occCkWarn[ckKey]=r.warnings.slice();else delete occCkWarn[ckKey];
      occCkEdges[ckKey]=(f.edges||[]).map(e=>e?{pos:Array.isArray(e.pos)?e.pos.slice():null,len:e.len!=null?e.len:null}:null);
      occCkPut(ckKey,()=>occShapeCopy(result));
      return;
    }
    if(f.type==='xmove'||f.type==='xdelface'||f.type==='bmove'){
      if(!result){msgs.push(`${f.name} : aucun volume à `+(f.type==='bmove'?'déplacer':'déformer')+` — ignoré`);return;}
      const ckM=occCkGet(ckKey);
      const cpM=ckM?occShapeCopy(ckM):null;
      if(cpM){
        try{result.delete();}catch(e){}result=cpM;
        const w=occCkWarn[ckKey];if(w&&w.length)msgs.push(...w.map(x=>`${f.name} : ${x}`));
        return;
      }
      const snapM=f.type==='bmove'?null:nomsInstantane(result); // suppression (dans le worker), décalage : pas d'historique
      const r=f.type==='xmove'?occApplyMoveFace(result,f):f.type==='bmove'?occApplyBodyMove(result,f):occApplyDeleteFaces(result,f,ckKey,ckPre); // bmove : 85-deplacer-corps
      if(!r.pending&&snapM)nomsCompleter(r.shape,null,snapM);
      result=r.shape;msgs.push(...r.warnings.map(w=>`${f.name} : ${w}`));
      // Suppression partie au worker : corps affiché SANS elle, et rien de mémorisé en aval
      // sous une clé qui la supposerait faite (même marque que le STEP en cours de restauration).
      if(r.pending){ckKey+=DEL_WK_MARK+f.id+';';return;}
      if(r.warnings.length)occCkWarn[ckKey]=r.warnings.slice();else delete occCkWarn[ckKey];
      occCkPut(ckKey,()=>occShapeCopy(result));
      return;
    }
    if(f.type==='bscale'){
      // Échelle (85-echelle-corps) : corps modifié sur place, ou — « Nouveau corps » — copie
      // du corps source mise à l'échelle dans le corps neuf (le source n'est pas touché).
      const nb=occSplitNewBody(f);
      if(nb&&bid!==nb)return;
      const neuf=nb===bid;
      const ckS=occCkGet(ckKey);
      const cpS=ckS?occShapeCopy(ckS):null;
      if(cpS){
        if(result)try{result.delete();}catch(e){}result=cpS;
        const w=occCkWarn[ckKey];if(w&&w.length)msgs.push(...w.map(x=>f.name+' : '+x));
        return;
      }
      let src=result;
      if(neuf){
        if(result){msgs.push(f.name+' : fonctions du corps neuf placées avant l’échelle — ignorées');try{result.delete();}catch(e){}result=null;}
        try{src=occCombineTool(f,occBodyOfFeat(f),bin);}catch(err){src=null;msgs.push(f.name+' : corps source illisible ('+err.message+')');}
      }
      if(!src){msgs.push(f.name+' : aucun volume à mettre à l’échelle — ignoré');return;}
      const r=occApplyBodyScale(src,f);
      result=r.shape;msgs.push(...r.warnings.map(w=>f.name+' : '+w));
      if(r.warnings.length)occCkWarn[ckKey]=r.warnings.slice();else delete occCkWarn[ckKey];
      if(result)occCkPut(ckKey,()=>occShapeCopy(result));
      return;
    }
    if(f.type==='xsplit'){
      // Scinder : côté gardé dans le corps de la fonction ; en tête du corps NEUF (mode
      // corps), l'autre côté du corps source tel qu'il est à cet endroit de la timeline.
      const neuf=occSplitNewBody(f)===bid;
      const ckP=occCkGet(ckKey);
      const cpP=ckP?occShapeCopy(ckP):null;
      if(cpP){
        if(result)try{result.delete();}catch(e){}result=cpP;
        const w=occCkWarn[ckKey];if(w&&w.length)msgs.push(...w.map(x=>`${f.name} : ${x}`));
        return;
      }
      let src=result;
      if(neuf){
        if(result){msgs.push(`${f.name} : fonctions du corps neuf placées avant la scission — ignorées`);try{result.delete();}catch(e){}result=null;}
        try{src=occCombineTool(f,occBodyOfFeat(f),bin);}catch(err){src=null;msgs.push(`${f.name} : corps source illisible (${err.message})`);}
      }
      if(!src){if(!neuf)msgs.push(`${f.name} : aucun volume à scinder — ignoré`);return;}
      const r=occApplySplit(src,f,neuf?'pos':'neg');
      result=r.shape;
      const w=neuf?(r.fatal?r.warnings:[]):r.warnings; // le corps d'origine porte déjà les avertissements
      msgs.push(...w.map(x=>`${f.name} : ${x}`));
      if(w.length)occCkWarn[ckKey]=w.slice();else delete occCkWarn[ckKey];
      if(result)occCkPut(ckKey,()=>occShapeCopy(result));
      return;
    }
    if(f.type==='xdraft'){
      // Dépouillage (angle de démoulage) : sans cette branche la fonction était
      // silencieusement SAUTÉE par le `return` générique ci-dessous — l'arbre
      // l'affichait « valide » (4 faces, pas d'erreur) mais le solide restait
      // inchangé (Pièce 7). Même pattern que xmove : cache + warnings.
      if(!result){msgs.push(`${f.name} : aucun volume à dépouiller — ignoré`);return;}
      const ckD=occCkGet(ckKey);
      const cpD=ckD?occShapeCopy(ckD):null;
      // alerte « paroi amincie » portée par la fonction (⚠ dans l'arbre, note du panneau),
      // relue aussi depuis le cache : le point de contrôle ne rejoue pas la dépouille
      const minceDe=w=>{const m=(w||[]).find(x=>/amincie|rétréci|se rejoignent/.test(x));if(m)f._thin=m;else delete f._thin;};
      if(cpD){
        try{result.delete();}catch(e){}result=cpD;
        const w=occCkWarn[ckKey];if(w&&w.length)msgs.push(...w.map(x=>`${f.name} : ${x}`));
        minceDe(w);
        return;
      }
      const snapD=nomsInstantane(result);
      const r=occApplyDraft(result,f);
      nomsCompleter(r.shape,null,snapD);
      minceDe(r.warnings);
      result=r.shape;msgs.push(...r.warnings.map(w=>`${f.name} : ${w}`));
      if(r.warnings.length)occCkWarn[ckKey]=r.warnings.slice();else delete occCkWarn[ckKey];
      occCkPut(ckKey,()=>occShapeCopy(result));
      return;
    }
    if(f.type==='xshell'){
      // Coque (évidage paroi mince) : même pattern que dépouillage/déplacement —
      // cache par point de contrôle + warnings. Sans cette branche la fonction
      // serait silencieusement sautée par le `return` générique ci-dessous.
      if(!result){msgs.push(`${f.name} : aucun volume à évider — ignoré`);return;}
      const ckS=occCkGet(ckKey);
      const cpS=ckS?occShapeCopy(ckS):null;
      if(cpS){
        try{result.delete();}catch(e){}result=cpS;
        const w=occCkWarn[ckKey];if(w&&w.length)msgs.push(...w.map(x=>`${f.name} : ${x}`));
        return;
      }
      const snapC=nomsInstantane(result); // recette BSpline, réparation : pas d'historique
      const r=occApplyCoque(result,f);
      nomsCompleter(r.shape,null,snapC);
      result=r.shape;msgs.push(...r.warnings.map(w=>`${f.name} : ${w}`));
      if(r.warnings.length)occCkWarn[ckKey]=r.warnings.slice();else delete occCkWarn[ckKey];
      occCkPut(ckKey,()=>occShapeCopy(result));
      return;
    }
    if(f.type==='xthread'){
      // Filetage (76-filetage) : solide inchangé ; le vide fileté (filet modélisé) rejoint ceux
      // des taraudages, creusés en fin de rejeu. Clé = préfixe : résolution mémorisée.
      threadReplayStep(f,result,ckKey,msgs,threads,bid,bin);
      return;
    }
    if(f.type==='gear'){
      // Engrenage (76-engrenage) : solide construit d'après ses réglages, point de contrôle comme les autres
      const ckG=occCkGet(ckKey);
      const cpG=ckG?occShapeCopy(ckG):null;
      if(cpG){if(result)try{result.delete();}catch(e){}result=cpG;delete f._err;return;}
      let gs=null;
      try{gs=gearSolid(f,bin);}catch(err){f._err=String(err.message||err);msgs.push(`${f.name} : ${f._err}`);return;}
      delete f._err;
      if(result){const uG=occUnify(occFuse(result,gs));try{result.delete();}catch(e){}try{gs.delete();}catch(e){}result=uG;}
      else result=gs;
      occCkPut(ckKey,()=>occShapeCopy(result));
      return;
    }
    let shape=null;
    if(f.type==='import'){
      // UNI / SOUSTRACTION avec un STEP importé : la voie exacte ne rejouait que
      // extrude/revolve — le STEP n'entraît JAMAIS dans l'accumulateur, donc
      // « Uni » restait deux pièces affichées côte à côte et « Soustraction »
      // tombait dans le vide (« découpe dans le vide — ignorée »).
      if(importSeul)return; // seul : affichage d'origine (mesh + nom du fichier)
      const e=(typeof importGeom!=='undefined')?importGeom.get(f.id):null;
      const bp=e&&e.brep;
      if(!bp){
        // 2026-10-26 : la clé des points de contrôle ne disait pas si le STEP était là. Au
        // rechargement (Ctrl+R), le noyau rejoue AVANT importRestorePending : les points
        // mémorisés SANS le STEP étaient ensuite repris tels quels, une fois le STEP
        // restauré → seule l'opération restait affichée. Marque d'absence dans la clé.
        ckKey+='!'+f.id+';';
        msgs.push(`${f.name} : `+(f.src&&f.src.fmt==='step'?'STEP en cours de restauration':'solide exact indisponible (import STL) — combinaison réservée au repli maillage'));
        return;
      }
      shape=occShapeCopy(bp); // COPIE : la table reste propriétaire de son BRep
      if(!shape){msgs.push(`${f.name} : copie exacte impossible — ignoré`);return;}
      nomsCompleter(shape,f.id,null); // fichier figé : l'ordre géométrique est stable
      imports.push(f.id);
      if(!result){result=shape;occCkPut(ckKey,()=>occShapeCopy(result));return;}
      // Mêmes règles qu'une fonction additive (ci-dessous) : point de contrôle
      // avant de refaire la fusion la plus coûteuse.
      const ckI=occCkGet(ckKey);
      const cpI=ckI?occShapeCopy(ckI):null;
      if(cpI){try{result.delete();}catch(e2){}try{shape.delete();}catch(e2){}result=cpI;return;}
      const uI=occUnify(occFuse(result,shape));
      try{result.delete();}catch(e2){}try{shape.delete();}catch(e2){}
      result=uI;
      occCkPut(ckKey,()=>occShapeCopy(result));
      return;
    }
    if(f.type==='combine'){
      if(!result){msgs.push(`${f.name} : corps cible vide — ignoré`);return;}
      const ckB=occCkGet(ckKey);const cpB=ckB?occShapeCopy(ckB):null;
      if(cpB){try{result.delete();}catch(e){}result=cpB;return;}
      let r2=result;
      (f.tools||[]).forEach(tb=>{
        if(tb===bid)return;
        let ts=null;try{ts=occCombineTool(f,tb,bin);}catch(err){msgs.push(`${f.name} : corps outil illisible (${err.message})`);}
        if(!ts){msgs.push(`${f.name} : corps outil vide à cet endroit de la timeline`);return;}
        // V0.47.2 : un outil sans solide ne retire rien : on le dit au lieu de ne rien faire en silence
        {const so=occSubShapes(ts,'TopAbs_SOLID');if(!so.length)msgs.push(`${f.name} : le corps outil n’est pas un volume fermé — la combinaison risque de rester sans effet`);occDispose(so);}
        try{
          const n=f.mode==='cut'?occCut(r2,ts):(f.mode==='intersect'?occCommon(r2,ts):occUnify(occFuse(r2,ts)));
          try{r2.delete();}catch(e){}r2=n;
        }catch(err){msgs.push(`${f.name} : ${err.message}`);}
        try{ts.delete();}catch(e){}
      });
      result=r2;
      occCkPut(ckKey,()=>occShapeCopy(result));
      return;
    }
    if(f.type!=='extrude'&&f.type!=='revolve'&&f.type!=='sweep'&&f.type!=='hole')return; // sweep : 75-balayage ; hole : fonction Perçage (src/76), toujours une découpe
    // Pour une découpe « à travers tout », l'étendue se mesure sur le solide DÉJÀ reconstruit
    // (tout ce qui précède dans la timeline) — jamais sur l'affichage de l'édition précédente.
    occThroughBase=(((f.type==='extrude'&&f.through)||f.type==='hole')&&result)?result:null; // perçage : débouchant / prochaine face
    const xtra=occBodyOfFeat(f)!==bid; // découpe rejouée dans un corps visé en plus : un seul fantôme (celui de son corps)
    try{
      let r=occToolCkGet(ckKey);
      if(!r){r=(f.type==='revolve')?occShapeOfRevolve(f):(f.type==='sweep'?occShapeOfSweep(f):(f.type==='hole'?occShapeOfHole(f):occShapeOfExtrude(f)));occToolCkPut(ckKey,r);}
      bin.push(...r.bins);itemShapes.push(r.shape);
      if(r.thr)threads.push({f,thr:r.thr});
      if(r.warnings.length)msgs.push(...r.warnings.map(w=>`${f.name} : ${w}`));
      shape=r.shape;if(!xtra)items.push({f,shape});
    }catch(err){
      // Isolation : UNE esquisse fautive ne fait plus basculer tout le solide en maillage.
      msgs.push(`${f.name} : exclu de l'exact (${err.message})`);
      try{
        const gl=(f.type==='revolve')?legacyRevolveGeos(f,msgs):(f.type==='sweep'?legacySweepGeos(f,msgs):(f.type==='hole'?legacyHoleGeos(f,msgs):legacyPrismGeos(f,msgs)));
        gl.forEach(g=>ghostShapes.push({geo:g,orphan:true,inexact:f.name,fid:f.id}));
      }catch(e2){msgs.push(`${f.name} : même le maillage échoue (${e2.message})`);}
      return;
    }
    const op=(f.type==='hole')?'cut':(f.op||'add');
    if(op==='cut'){
      // Fantôme tessellé AVANT delete (use-after-delete = crash + repli fantôme).
      // Filet hélicoïdal : le fantôme est un simple aperçu → maillage plus grossier
      // (2× plus rapide), la géométrie exacte et le solide final ne changent pas.
      const ghostGeo=xtra?null:(()=>{try{return f.type==='hole'?occTessellate(shape,1,0.8):occTessellate(shape,0.5);}catch(e){msgs.push(`${f.name} : outil illisible`);return null;}})();
      if(!result){if(!xtra){msgs.push(`${f.name} : découpe dans le vide — ignorée`);if(ghostGeo)ghostShapes.push({geo:ghostGeo,orphan:true,fid:f.id});}return;}
      if(ghostGeo&&!xtra)ghostShapes.push({geo:ghostGeo,orphan:false,fid:f.id});
      // Préfixe inchangé : le solide accumulé contient DÉJÀ cette découpe → on saute le
      // booléen (le plus coûteux) et on adopte la copie mémorisée.
      const ckC=occCkGet(ckKey);
      const cpC=ckC?occShapeCopy(ckC):null;
      if(cpC){try{result.delete();}catch(e){}result=cpC;return;}
      const c=occUnifyCutSeams((f.type==='hole'?occCutEach:occCut)(result,shape),result,shape); // fond pile sur une face : pas de mini surface
      try{result.delete();}catch(e){}try{shape.delete();}catch(e){}
      result=c;
    }else{
      if(!result){result=shape;occCkPut(ckKey,()=>occShapeCopy(result));return;}
      // Préfixe inchangé : la fusion est déjà faite dans la copie mémorisée.
      const ckA=occCkGet(ckKey);
      const cpA=ckA?occShapeCopy(ckA):null;
      if(cpA){try{result.delete();}catch(e){}result=cpA;return;}
      // Union additive "Uni" : unification des faces coplanaires (pas de couture au
      // passage d'une fonction à l'autre — face verticale = UNE face, pas 2).
      const u=occUnify(occFuse(result,shape));
      try{result.delete();}catch(e){}try{shape.delete();}catch(e){}
      result=u;
    }
    occCkPut(ckKey,()=>occShapeCopy(result)); // point de contrôle pour le rejeu suivant
  };
  // V0.30.1 : copies CONSÉCUTIVES d'une même répétition (extrusion / perçage, même opération,
  // corps de la fonction) → UN SEUL booléen à outils multiples au lieu de N booléens enchaînés
  // sur une pièce de plus en plus percée (24 perçages : 1,4 s → voir CHANGELOG). Clé du point de
  // contrôle = la même que le rejeu une à une (préfixe cumulé) : rien d'autre ne change en aval.
  // Le moindre souci (outil illisible, composé à étapes, booléen refusé) → rejeu une à une.
  const batchLen=i=>{
    const f=list[i];if(!f||!f.repeatId||!result)return 1;
    const opOf=g=>g.type==='hole'?'cut':g.type==='extrude'?(g.op||'add'):null;
    const op=opOf(f);if(op!=='cut'&&op!=='add')return 1;
    let n=0;
    while(i+n<list.length){const g=list[i+n];if(g.repeatId!==f.repeatId||opOf(g)!==op||occBodyOfFeat(g)!==bid||g.visible===false)break;n++;}
    return n;
  };
  const kidsOf=s=>{
    const CP=occt.TopAbs_ShapeEnum.TopAbs_COMPOUND;
    if(s.ShapeType()!==CP)return [s];
    const out=[];const it=new occt.TopoDS_Iterator_2(s,true,true);
    try{for(;it.More();it.Next())out.push(it.Value());}finally{try{it.delete();}catch(e){}}
    if(out.some(k=>k.ShapeType()===CP))return null; // composé à étapes (filet modélisé) : une à une
    return out;
  };
  const batch=run=>{
    const keys=[];let key=ckKey;run.forEach(g=>{key+=featSig(g)+';';keys.push(key);});
    const cut=run[0].type==='hole'||(run[0].op||'add')==='cut';
    const rs=[],tools=[];
    const drop=()=>rs.forEach(r=>{try{r.shape.delete();}catch(e){}occDispose(r.bins);try{if(r.thr)r.thr.delete();}catch(e){}});
    try{
      occThroughBase=cut?result:null; // « à travers tout » : mesuré sur la pièce avant les copies
      for(let k=0;k<run.length;k++){
        const g=run[k];
        let r=occToolCkGet(keys[k]);
        if(!r){r=g.type==='hole'?occShapeOfHole(g):occShapeOfExtrude(g);occToolCkPut(keys[k],r);}
        rs.push(r);
        const kk=kidsOf(r.shape);if(!kk){drop();return false;}
        tools.push(...kk);
      }
    }catch(err){drop();return false;}
    let next=null;const ck=occCkGet(key);
    if(ck)next=occShapeCopy(ck);
    if(!next){
      const la=new occt.TopTools_ListOfShape_1(),lt=new occt.TopTools_ListOfShape_1();
      const c=cut?new occt.BRepAlgoAPI_Cut_1():new occt.BRepAlgoAPI_Fuse_1();
      try{
        la.Append_1(result);tools.forEach(t=>lt.Append_1(t));
        c.SetArguments(la);c.SetTools(lt);if(cut)c.SetCheckInverted(false);c.Build();
        const s=c.IsDone()?c.Shape():null;
        if(!s||s.IsNull())throw new Error('booléen groupé refusé');
        nomsTransmet([result,...rs.map(r=>r.shape)],c,s); // l'outil entier : ses enfants ne portent pas les noms
        if(cut){const all=occCompoundOf(rs.map(r=>r.shape));next=occUnifyCutSeams(s,result,all);if(rs.length>1)try{all.delete();}catch(e){}}
        else next=occUnify(s);
      }catch(err){drop();return false;}
      finally{try{c.delete();}catch(e){}try{la.delete();}catch(e){}try{lt.delete();}catch(e){}}
    }
    // succès : mêmes traces que le rejeu une à une (fantômes, éléments, filets, avertissements).
    // Fantôme : une extrusion simple (ni « à travers tout », ni « jusqu'à ») copiée est l'outil de
    // sa source déplacé avec son esquisse — maillage du premier recopié par la matrice
    // (repère d'esquisse de la copie × inverse de celui du premier) au lieu d'un maillage noyau
    // par copie (≈ 8 ms chacun). Symétrie (repère indirect) : maillée normalement.
    let g0=null;
    const basisM=g=>{
      const sk=doc.sketches.find(s=>s.id===g.sketchId);if(!sk)return null;
      const b=sketchBasis(sk),M=new THREE.Matrix4().makeBasis(b.u,b.v,b.n);M.setPosition(b.o);
      return M.determinant()>0?M:null;
    };
    run.forEach((g,k)=>{
      const r=rs[k];
      bin.push(...r.bins);itemShapes.push(r.shape);items.push({f:g,shape:r.shape});
      if(r.thr)threads.push({f:g,thr:r.thr});
      if(r.warnings.length)msgs.push(...r.warnings.map(w=>`${g.name} : ${w}`));
      if(!cut)return;
      try{
        const M=g.type==='extrude'&&!g.through&&!g.upto&&g._src?basisM(g):null;
        let gg=null;
        if(M&&g0&&g0.src===g._src){gg=g0.geo.clone();gg.applyMatrix4(new THREE.Matrix4().multiplyMatrices(M,g0.inv));}
        else{
          gg=g.type==='hole'?occTessellate(r.shape,1,0.8):occTessellate(r.shape,0.5);
          if(M&&gg)g0={geo:gg,inv:M.clone().invert(),src:g._src};
        }
        if(gg)ghostShapes.push({geo:gg,orphan:false,fid:g.id});
      }catch(e){msgs.push(`${g.name} : outil illisible`);}
    });
    try{result.delete();}catch(e){}result=next;ckKey=key;
    if(!ck)occCkPut(ckKey,()=>occShapeCopy(result));
    return true;
  };
  const tap=occPrefixTap&&occReplayNest===1?occPrefixTap:null;
  for(let i=0;i<list.length;){
    const n=tap?1:batchLen(i);
    yield {bid,fs:list.slice(i,i+n)}; // régénération par tranches (31) : fonction(s) sur le point d'être calculée(s)
    if(n>1&&batch(list.slice(i,i+n))){nomsCompleter(result,list[i].id,null);i+=n;continue;}
    const f=list[i++];
    NOMS_PERTES=[];
    step(f);
    nomsCompleter(result,f.id,null); // aucune face sans nom, quelle que soit la fonction
    const perdu=nomsPerteLue();
    if(perdu.length){
      const w=[...new Set(perdu)];
      msgs.push(...w.map(x=>`${f.name} : ${x}`));
      occCkWarn[ckKey]=[...new Set((occCkWarn[ckKey]||[]).concat(w))];
    }
    if(tap)try{tap(bid,f,result);}catch(e){}
  }
  // V0.21.19 : filets modélisés creusés EN DERNIER, en une seule découpe (src/76,
  // occShapeOfHole) : dans l'arbre, chaque perçage n'a laissé qu'un avant-trou lisse,
  // et les fonctions suivantes n'ont jamais vu les faces hélicoïdales.
  // Rejeu partiel (références d'esquisse, occFinalShape(upto)) : inutile, filets sautés.
  // V0.21.19 : en navigateur, le calcul part dans le worker de calcul (src/21, thrWkAsk) :
  // le corps est affiché tout de suite SANS les filets (= filet cosmétique), puis repris
  // quand le worker répond. preThr : corps sans filets, gardé pour la FAO.
  let preThr=null;
  const thrOn=!!(threads.length&&result&&!occThreadSkip);
  // Recousage des coutures de congé (occFinalShape) fait AVANT les filets : après, il
  // reconstruirait aussi leurs centaines de faces et jetterait le maillage du worker.
  if(thrOn&&occUnifyAfterFillets(list)){try{const u=occUnify(occShapeCopy(result));if(u&&u!==result){try{result.delete();}catch(e){}result=u;}}catch(e){}}
  if(thrOn){
    const ckT=ckKey+'|filets;';
    const names=threads.map(x=>x.f.name).join(', ');
    const ckF=occCkGet(ckT);
    const cpF=ckF?occShapeCopy(ckF):null;
    if(cpF){preThr=result;result=cpF;}
    else{
      try{
        const voids=occCompoundOf(threads.map(x=>x.thr));
        // maillage d'affichage fait AUSSI par le worker (voyage avec le BRep) : à la réponse,
        // le fil principal n'a plus à trianguler les centaines de faces du filet
        let D=null;try{D=occDisplayDefl(result);}catch(e){}
        const w=(typeof thrWkAsk==='function')?thrWkAsk(ckT,result,voids,threads.map(x=>x.f.id),D):{res:null};
        if(w.pending){
          occThrPending=true;
          msgs.push(`${names} : filets modélisés en calcul… (pièce affichée avec le filet cosmétique)`);
        }else{
          const t=w.res?w.res.r:occThrCut(result,voids);
          if(w.res&&w.res.err)throw new Error(w.res.err);
          preThr=result;result=t;
          occCkPut(ckT,()=>occShapeCopy(result));
        }
      }catch(err){msgs.push(`${names} : filet modélisé impossible (${err.message})`);}
    }
  }
  return{shape:result,preThr,unified:thrOn,ghostShapes,msgs,bin,itemShapes,items,imports};
}
// congé exact dans le corps, sans scission de face : coutures à recoudre (occFinalShape)
function occUnifyAfterFillets(list){
  return (list||[]).some(f=>f.type==='xfillet')&&!(list||[]).some(f=>f.type==='xsplit'&&f.mode!=='body');
}
// Vides filetés (src/76) découpés du corps. Exécuté sur le thread principal (Node, pas
// de worker) OU dans le worker (sérialisé par delWkSource, src/21). base n'est pas modifiée.
function occThrCut(base,voids){
  return occCutEach(base,voids);
}
let occThrPending=false; // un filet modélisé attend le worker (filet cosmétique affiché)
function occFinalShape(upto){return occDrain(occFinalShapeGen(upto));}
function* occFinalShapeGen(upto,warm){
  // warm (31, préchauffe de la régénération) : filets modélisés sautés — le rejeu final les fait.
  // Partition par corps (ordre de première apparition dans la timeline), rejeu isolé
  // par corps, puis composé GRATUIT pour occLive (picking, ancrages, overlay, aperçu
  // et export continuent de voir l'ensemble, inchangés).
  // upto = indice exclusif (rejeu partiel pour références d'esquisse) ; null = tout.
  // Retourne {shape, perBody:[{bodyId,shape}], ghostShapes, msgs, bin, itemShapes, items}.
  ensureBodies();
  const feats=doc.features.filter(f=>f.visible!==false);
  const list=(upto==null?feats:feats.slice(0,upto)).filter(f=>!(occSkipFeat&&f.id===occSkipFeat));
  const order=[],byBody={};
  list.forEach(f=>{
    const b=(f.body&&doc.bodies.some(e=>e.id===f.body))?f.body:doc.bodies[0].id;
    if(!byBody[b]){byBody[b]=[];order.push(b);}
    byBody[b].push(f);
    const nb=occSplitNewBody(f); // scission de corps : l'autre côté naît dans le corps neuf
    if(nb){if(!byBody[nb]){byBody[nb]=[];order.push(nb);}byBody[nb].push(f);}
    occCutExtraBodies(f).forEach(xb=>{if(!byBody[xb]){byBody[xb]=[];order.push(xb);}byBody[xb].push(f);}); // découpe multi-corps
  });
  const perBody=[],bin=[],itemShapes=[],ghostShapes=[],msgs=[],items=[],imports=[];
  // corps OUTILS consommés par une combinaison (sans « garder ») : plus affichés
  const consumed=new Set();list.forEach(f=>{if(f.type==='combine'&&!f.keep)(f.tools||[]).forEach(t=>consumed.add(t));});
  // « Retirer » (bremove, comme Fusion 360) : le corps disparaît à partir de cette étape ;
  // marqueur reculé avant elle, il revient. Rien n'est effacé du document.
  list.forEach(f=>{if(f.type==='bremove'&&f.body)consumed.add(f.body);});
  // rejeu partiel = la liste s'arrête avant la fin (références d'esquisse) ; le rejeu
  // complet passe aussi un upto (marqueur de la timeline) : seule la longueur compte
  const partial=list.length<feats.filter(f=>!(occSkipFeat&&f.id===occSkipFeat)).length;
  occThreadSkip=partial||!!occPrefixTap||!!warm; // reposé à chaque appel : jamais d'état périmé (observateur : filets inutiles)
  if(!partial&&!occPrefixTap&&!warm)occThrPending=false;
  const preThr=[]; // {bodyId, shape} : corps SANS filets modélisés (FAO)
  for(const bid of order){
    if(consumed.has(bid))continue;
    const r=yield* occNestGen(occReplayBodyGen(bid,byBody[bid]));
    if(r.shape){
      let sh=r.shape;
      // 2026-10-19 : quand un congé/chanfrein exact a été appliqué, recoudre les faces de MÊME
      // surface qu'il a pu scinder (surtout via le repli ARÊTE PAR ARÊTE quand le lot OCCT
      // échoue) : une face voisine — ou le congé — restait coupée en DEUX par une couture
      // parasite. occUnify est celui des fusions additives. PAS d'unify sans congé : les
      // coutures d'esquisse (scission d'une face à un point du profil) restent cliquables —
      // notamment comme ancre d'un congé (cf. test_conge_fond_poche).
      // Une face SCINDÉE (xsplit 'face') serait recousue : pas d'unify dans ce corps.
      if(!r.unified&&occUnifyAfterFillets(byBody[bid])){
        try{const u=occUnify(occShapeCopy(sh));if(u&&u!==sh){try{sh.delete();}catch(e){}sh=u;}}catch(e){}
      }
      perBody.push({bodyId:bid,shape:sh});
      if(r.preThr)preThr.push({bodyId:bid,shape:r.preThr});
    }else if(r.preThr){try{r.preThr.delete();}catch(e){}}
    bin.push(...r.bin);itemShapes.push(...r.itemShapes);
    ghostShapes.push(...r.ghostShapes);msgs.push(...r.msgs);items.push(...r.items);
    imports.push(...r.imports); // imports entrés dans la chaîne exacte (affichés par le corps)
  }
  const shape=nomsCompose(perBody.map(p=>p.shape),occCompoundOf(perBody.map(p=>p.shape)),perBody.map(p=>p.bodyId));
  // pièce SANS filets modélisés (FAO : le taraud fait le filet) — seulement s'il y en a
  const shapeFao=preThr.length?occCompoundOf(perBody.map(p=>{const q=preThr.find(x=>x.bodyId===p.bodyId);return q?q.shape:p.shape;})):null;
  return{shape,shapeFao,preThr,perBody,ghostShapes,msgs,bin,itemShapes,items,imports};
}
function legacyPrismGeos(f,warnArr){
  // Prisme maillage (monde) d'une extrusion — même construction que la voie repli. Jette si profil vide.
  const sk=doc.sketches.find(s=>s.id===f.sketchId);if(!sk)throw new Error('esquisse introuvable');
  const fils=doc.features.filter(x=>x.type==='fillet'&&x.target===f.id&&x.visible!==false);
  let built=sketchShape(sk,f.profiles);
  if(fils.length){
    const rf=applyFilletsToSketch(sk,fils);
    if(warnArr)warnArr.push(...rf.warnings.map(w=>`${f.name} : ${w}`));
    built=sketchShape(rf.sk,f.profiles);
  }
  if(!built.shapes.length){
    let m=`Esquisse ${sk.name} : contour non fermé`;
    const ends=(built.opens||[]).slice(0,3).map(o=>`(${o.x.toFixed(1)}, ${o.y.toFixed(1)})`);
    if(ends.length)m+=` — bouts ouverts : ${ends.join(' · ')}`;
    throw new Error(m);
  }
  const{u,v,n,o}=sketchBasis(sk);
  const m=new THREE.Matrix4().makeBasis(u,v,n);m.setPosition(o);
  let bevelR=0;fils.forEach(fi=>{const r=fi.rims||(fi.rimTop||fi.rimBot?{top:!!fi.rimTop,bottom:!!fi.rimBot}:null);if(r&&(r.top&&r.bottom)&&fi.radius>bevelR)bevelR=fi.radius;});
  // simple face = pas de bevel symétrique : l'indépendant haut OU bas se fait en exact OCCT (⤢)
  const sp=Object.assign({},extrudeSpan(f));
  // V0.9.3 : DÉCOUPE EN MAILLAGE — l'outil posé pile sur la face hôte (esquisse sur la
  // face du dessus) a des faces coplanaires à celles du corps : le CSG (BSP) ne sait pas
  // trancher et rend un solide cassé (Cavité Test en file:// : bloc absent, parois de
  // poche seules). L'outil dépasse de 0,01 mm du côté du plan d'esquisse ; la profondeur
  // de la découpe est inchangée.
  if((f.op||'add')==='cut'){const eps=0.01;if(Math.abs(sp.hi)<1e-9)sp.hi=eps;if(Math.abs(sp.lo)<1e-9)sp.lo=-eps;}
  const len=Math.max(1e-6,sp.hi-sp.lo);
  if(bevelR>0){bevelR=Math.min(bevelR,len/2.2,8);if(bevelR<0.05)bevelR=0;}
  const geos=[];
  // V0.9.3 : CONTOUR NETTOYÉ — le dernier point d'un contour arc/droite retombait à
  // ~1e-15 mm du premier (Cavité Test, coins R8) : 8 triangles d'aire nulle dans le
  // prisme, sur lesquels le CSG (BSP) se perd — découpe rendue comme un solide cassé.
  // Points consécutifs confondus (< 1e-6 mm) retirés, contour et trous redessinés en
  // polylignes à la même finesse que ExtrudeGeometry (curveSegments 48).
  const clean=function(pts){
    const out=[];
    for(const q of pts)if(!out.length||Math.hypot(q.x-out[out.length-1].x,q.y-out[out.length-1].y)>1e-6)out.push(q);
    while(out.length>2&&Math.hypot(out[0].x-out[out.length-1].x,out[0].y-out[out.length-1].y)<=1e-6)out.pop();
    return out;};
  built.shapes=built.shapes.map(function(s0){
    if(typeof s0.extractPoints!=='function')return s0; // stub du banc VM
    const ex=s0.extractPoints(48),s=new THREE.Shape(clean(ex.shape));
    ex.holes.forEach(function(h){s.holes.push(new THREE.Path(clean(h)));});
    return s;});
  built.shapes.forEach(shape=>{
    const g=bevelR>0
      ?new THREE.ExtrudeGeometry(shape,{depth:Math.max(0.5,len-bevelR),bevelEnabled:true,bevelThickness:bevelR,bevelSize:Math.max(0.05,bevelR*0.9),bevelSegments:4,curveSegments:48})
      :new THREE.ExtrudeGeometry(shape,{depth:len,bevelEnabled:false,curveSegments:48});
    g.translate(0,0,sp.lo); // plage [lo,hi] (symétrique = -h..+h ; négatif = lo<0, hi=0)
    g.applyMatrix4(m);
    geos.push(g);
  });
  return geos;
}
function occSolidBox(sh){
  // Boîte + diagonale d'un solide (pour les tolérances relatives), ou null.
  try{
    const box=new occt.Bnd_Box_1();occt.BRepBndLib.Add(sh,box,true);
    const a=box.CornerMin(),b=box.CornerMax();
    const r={c:[(a.X()+b.X())/2,(a.Y()+b.Y())/2,(a.Z()+b.Z())/2],
      dg:Math.hypot(b.X()-a.X(),b.Y()-a.Y(),b.Z()-a.Z())};
    try{box.delete();}catch(e){}
    return r;
  }catch(e){return null;}
}
function occBodyOfMesh(mesh){
  // Corps exact affiché par son mesh (multi-corps : chaque mesh a ses propres
  // ordinaux de faces — on résout toujours sur le SOLIDE DU CORPS, jamais sur
  // le composé occLive dont les ordinaux globaux diffèrent dès qu'il y a 2 corps).
  if(!mesh)return null;
  const bd=bodies.find(b=>b.mesh===mesh);
  return (bd&&bd.kind==='body'&&bd.shape)?bd:null;
}
function occFaceOfHit(mesh,fi){
  // Face BRep d'un triangle cliqué : {face, ord, bd}. La face retournée est un
  // handle neuf — à l'appelant de la supprimer après occFaceRef (comme occFaceAt).
  // Un import STEP SEUL n'entre pas dans la chaîne exacte (occReplayBody : importSeul)
  // mais son BRep (importGeom.brep) est celui que la chaîne copiera dès qu'une fonction
  // le rejoint dans son corps, et son maillage porte occGroups : on résout la face dessus
  // (même repère : le mesh d'un import n'est jamais transformé).
  let bd=occBodyOfMesh(mesh),shape=bd&&bd.shape;
  if(!bd&&mesh){
    const bi=bodies.find(b=>b.mesh===mesh&&b.kind==='import');
    const e=bi&&typeof importGeom!=='undefined'?importGeom.get(bi.ref||bi.id):null;
    if(e&&e.brep){bd=bi;shape=e.brep;}
  }
  if(!bd||fi===undefined||fi===null)return null;
  try{
    const groups=mesh.geometry.userData.occGroups||[];
    const g=groups.find(g=>fi>=g.start&&fi<g.start+g.count);
    if(!g)return null;
    const face=occFaceAt(shape,g.f);
    if(!face)return null;
    return {face:face,ord:g.f,bd:bd};
  }catch(e){return null;}
}
// Outils de face (congé/chanfrein, déplacement, dépouille, coque) sur un STEP SEUL : hors
// chaîne exacte (importSeul), occLive restait null et chaque outil refusait d'entrer
// (« solide exact indisponible »). Le temps du mode, l'import entre dans la chaîne
// (occStepForce) : arêtes, faces et aperçus voient son BRep comme une pièce native. À la
// sortie, s'il est resté seul (annulation), il retrouve son affichage d'origine — la FAO
// d'un STEP seul (faoGeo) n'est donc pas touchée ; la fonction créée, elle, l'y garde.
let occStepForce=false;
function occLoneStep(){
  // Un corps dont toutes les fonctions visibles sont des imports, dont un avec son BRep.
  const by={},b0=(doc.bodies&&doc.bodies[0]&&doc.bodies[0].id)||'';
  (doc.features||[]).forEach(f=>{if(!f||f.visible===false||(occSkipFeat&&f.id===occSkipFeat))return;const b=f.body||b0;(by[b]=by[b]||[]).push(f);});
  return Object.keys(by).some(b=>by[b].every(f=>f.type==='import')&&by[b].some(f=>{
    const e=(typeof importGeom!=='undefined')?importGeom.get(f.id):null;return !!(e&&e.brep);}));
}
function occExactForTool(again){
  // Solide exact prêt pour un outil de face : recalcul paresseux, STEP seul compris.
  // again : rejouer quand même (édition : occSkipFeat vient de changer — sans la fonction
  // éditée, un STEP peut redevenir seul).
  if(!again&&occLive&&occLive.shape)return true;
  if(!occHas())return false;
  if(occLoneStep())occStepForce=true;
  try{rebuild();}catch(e){}
  if(occLive&&occLive.shape)return true;
  if(occStepForce){occStepForce=false;try{rebuild();}catch(e){}}
  return false;
}
function occStepForceEnd(){
  // Appelé à la sortie de chaque mode. Différé : un mode qui en remplace un autre (ou la
  // validation qui rejoue juste après) garde le STEP dans la chaîne sans rejeu inutile.
  if(!occStepForce)return;
  setTimeout(()=>{
    if(!occStepForce)return;
    try{if((typeof filModeX!=='undefined'&&filModeX)||(typeof mvMode!=='undefined'&&mvMode)||
      (typeof draftMode!=='undefined'&&draftMode)||(typeof coqueMode!=='undefined'&&coqueMode))return;}catch(e){}
    occStepForce=false;
    if(occLoneStep()){try{rebuild();renderTree();}catch(e){}}
  },0);
}
function bodyEntry(id){
  // Fiche persistée d'un corps (nom/couleur/centroïde) : la créer si besoin.
  if(!doc.bodies)doc.bodies=[];
  let e=doc.bodies.find(x=>x.id===id);
  if(!e){e={id:id,name:id,c:null};doc.bodies.push(e);}
  return e;
}
function ensureBodies(){
  // Normalise les corps CONTENEURS (vrais conteneurs façon Fusion, pas des étiquettes
  // dérivées) : au moins un corps, compteur et actif valides, chaque fonction rangée
  // dans un corps existant. Idempotent — appelé au rebuild et au chargement, donc les
  // anciens documents (sans corps ni f.body) migrent tout seuls vers « Corps 1 ».
  if(!doc.bodies)doc.bodies=[];
  doc.bodies=doc.bodies.filter(e=>e&&typeof e.id==='string');
  if(!(doc.bodySeq>0)){
    let mx=0;
    doc.bodies.forEach(e=>{const m=/^b(\d+)$/.exec(e.id||'');if(m)mx=Math.max(mx,+m[1]);});
    (doc.features||[]).forEach(f=>{const m=/^b(\d+)$/.exec(f.body||'');if(m)mx=Math.max(mx,+m[1]);});
    doc.bodySeq=mx+1;
  }
  if(!doc.bodies.length){
    const n=doc.bodySeq++;
    doc.bodies.push({id:'b'+n,name:'Corps '+n,c:null});
  }
  const ids=new Set(doc.bodies.map(e=>e.id));
  (doc.features||[]).forEach(f=>{if(!f||typeof f!=='object')return;if(!ids.has(f.body))f.body=doc.bodies[0].id;});
  if(!ids.has(doc.activeBody))doc.activeBody=doc.bodies[0].id;
  // Migration « la couleur et la transparence vivent dans le CORPS » : l'ancien
  // modèle portait f.color / f.opacity sur la FONCTION (+ une teinte pièce globale).
  // On les reporte sur la fiche du corps puis on les SUPPRIME — une seule source
  // pour le panneau du corps, le clic-droit et le rendu, quel que soit le moteur
  // (exact ou maillage). Idempotent : rejoué à chaque rejeu, sans effet ensuite.
  try{
    (doc.features||[]).forEach(f=>{
      if(!f)return;
      if(f.color>0||(f.opacity>0&&f.opacity<1)){
        const e=bodyEntry(ids.has(f.body)?f.body:doc.bodies[0].id);
        if(e){
          if(f.color>0&&!(e.color>0))e.color=f.color;
          if(f.opacity>0&&f.opacity<1&&!(e.op>0))e.op=Math.round(f.opacity*1000)/1000;
        }
      }
      if(f.color>0)delete f.color;
      if(f.opacity!==undefined)delete f.opacity;
    });
    if(doc.tint>0){ // teinte pièce : reportée sur chaque corps déjà colorié, puis retirée
      const t=doc.tint;
      doc.bodies.forEach(e=>{if(e&&!(e.color>0))e.color=t;});
      delete doc.tint;
    }
  }catch(err){}
  return doc.bodies;
}
function ensureActiveBody(){
  // Corps de destination des NOUVELLES fonctions : l'actif s'il existe, sinon le
  // premier (jamais de fonction orpheline, même après un undo exotique).
  try{
    ensureBodies();
    if(!doc.bodies.some(e=>e.id===doc.activeBody))doc.activeBody=doc.bodies[0].id;
    // V0.15.12 : marqueur reculé avant la naissance du corps actif → son corps d'origine
    try{tlSyncActiveBody();}catch(e){}
    return doc.activeBody;
  }catch(e){return 'b1';}
}
function occCompoundOf(shapes){
  // Composé SANS booléen (gratuit : ~0 ms contre ~100 ms par fuse) pour occLive :
  // picking d'arêtes, ancrages, overlay et aperçu continuent de voir l'ensemble.
  // Les handles partagent les TShapes (compteur OCCT) : suppression habituelle.
  const list=(shapes||[]).filter(Boolean);
  if(!list.length)return null;
  if(list.length===1)return list[0];
  try{
    const comp=new occt.TopoDS_Compound();
    const bd=new occt.TopoDS_Builder();
    bd.MakeCompound(comp);
    list.forEach(s=>{try{bd.Add(comp,s);}catch(e){}});
    try{bd.delete();}catch(e){}
    return comp;
  }catch(e){}
  // Repli : fusions en chaîne (une union de disjoints rend le même composé).
  try{
    let acc=occShapeCopy(list[0]);
    for(let i=1;i<list.length;i++){const u=occFuse(acc,list[i]);try{acc.delete();}catch(e){}acc=u;}
    return acc;
  }catch(e){return list[0];}
}
function occRebuild(){
  // Retourne true si la voie exacte a abouti (même partiellement), false pour repli maillage.
  occDropLive();
  let FR=null;
  try{
    const _tr=performance.now();
    FR=occFinalShape(tlReplayCount());
    phAdd('replay',performance.now()-_tr);
    const _ts=performance.now();
    // UN mesh PAR CORPS, rejoué isolément : l'id affiché EST l'id du corps (stable,
    // persisté - plus aucun rapprochement par centroïdes). occLive garde le COMPOSÉ :
    // congés, ancrages, picking d'arêtes, overlay et cache voient l'ensemble, inchangés.
    const parts=(FR.perBody||[]).filter(p=>p&&p.shape);
    // Déflection d'AFFICHAGE commune au natif et aux imports (même ombrage) et bornée
    // en triangles : occXDefl() — la référence FAO — n'intervient PAS ici, intentionnellement.
    const D=occDisplayDefl(FR.shape||(parts[0]&&parts[0].shape)||null);
    let trisTot=0;
    if(parts.length){
      parts.forEach(p=>{
        const e=bodyEntry(p.bodyId);
        let g=null;
        try{
          g=occTessellateBudget(p.shape,D,Math.max(1,OCC_DISPLAY_TRIS-trisTot));
          if(!g)g=occTessellate(p.shape,D.lin,D.ang);
        }catch(err){FR.msgs.push(e.name+' : maillage impossible, ignoré');return;}
        // Compteur d'attributs parfois illisible (harnais Node, geometry exotique) :
        // ce n'est PAS une géométrie vide — on affiche quand même, plutôt que de
        // faire échouer tout le rebuild exact et de basculer sur le moteur maillage.
        let tris=0,lit=true;
        try{tris=(g.attributes.position.count/3)|0;}catch(err){lit=false;}
        trisTot+=lit?tris:0; // budget global : dépassement ⇒ D muté grossier pour les corps suivants
        if(lit&&!(tris>0)){try{g.dispose&&g.dispose();}catch(err){}return;}
        try{const info=occSolidBox(p.shape);if(info)e.c=info.c;}catch(err){}
        const col=bodyColorOf(e.id); // fiche du corps : couleur unique (plus de couleur par fonction)
        const mat=new THREE.MeshStandardMaterial({color:col,metalness:.35,roughness:.4,clippingPlanes:clipPlane?[clipPlane]:null});
        try{if(typeof importBodyColors==='function'&&importBodyColors(g,e.id,D.lin))mat.vertexColors=true;}catch(err){} // STEP multicolore dans le corps (90)
        applyBodyStyle(mat,e.id); // + transparence du corps (100 % = opaque, inchangé)
        const mesh=new THREE.Mesh(g,mat);mesh.userData.bid=e.id;scene.add(mesh);
        const vis=!doc.bodyVis||!Object.prototype.hasOwnProperty.call(doc.bodyVis,e.id)?true:!!doc.bodyVis[e.id];
        mesh.visible=vis;
        const pre=(FR.preThr||[]).find(x=>x.bodyId===p.bodyId); // corps sans filets modélisés (FAO)
        bodies.push({id:e.id,name:e.name+' · '+(lit?tris.toLocaleString('fr'):'?')+' tris',mesh,color:col,visible:vis,kind:'body',ref:null,bodyId:e.id,shape:p.shape,shapeFao:pre?pre.shape:null});
      });
      if(!bodies.some(b=>b.kind==='body'))faceEl.textContent+=(faceEl.textContent?'\n':'')+'Solide exact vide (tout a été découpé).';
      if(FR.shape){occLive={shape:FR.shape,shapeFao:FR.shapeFao||null,preThr:FR.preThr||[]};FR.shape=null;FR.shapeFao=null;FR.preThr=null;} // conservé pour le picking d'arêtes
      try{faoFacesSuivre();}catch(err){}
    }
    FR.ghostShapes.forEach((gh,i)=>{
      try{
        if(!gh.geo)return;
        const mat=ghostMaterial(gh.inexact?0xff9f0a:0xff453a);
        const mesh=new THREE.Mesh(gh.geo,mat);mesh.userData.bid='occghost_'+i;mesh.raycast=()=>{};mesh.visible=false;mesh.renderOrder=20;
        scene.add(mesh);
        // Fantôme masqué par défaut (sinon il dépasse là où un congé a rajouté de la matière).
        // Visible quand sa découpe est sélectionnée, ou via 👁 dans Pièces.
        bodies.push({id:'occghost_'+i,name:gh.inexact?`⚠ ${gh.inexact} (maillage — exclu de l'exact)`:'🔧 Outil '+(gh.orphan?'(orphelin)':'(découpe)'),mesh,color:0xff453a,visible:false,kind:'ghost',ref:gh.fid||null,ghost:true});
      }catch(e){FR.msgs.push('fantôme illisible, ignoré');}
    });
    // Imports mesh : affichés tels quels SAUF s'ils sont entrés dans la chaîne exacte
    // (ils SONT alors le corps : un second affichage montrerait le solide deux fois).
    const consommes=new Set(FR.imports||[]);
    // V0.47.0 : corps outil consommé par Combiner : son import ne s'affiche plus
    const manges=new Set(),visT=doc.features.filter(f=>f.visible!==false),nT=tlReplayCount();(nT==null?visT:visT.slice(0,nT)).forEach(f=>{if(f.type==='combine'&&!f.keep)(f.tools||[]).forEach(t=>manges.add(t));});
    doc.features.filter(f=>f.visible!==false&&f.type==='import'&&f._mesh).forEach(f=>{
      if(consommes.has(f.id)||manges.has(f.body)){try{scene.remove(f._mesh);}catch(e){}return;}
      const col=bodyColorOf(f.body); // l'import appartient à un corps : SA couleur
      f._mesh.material=applyBodyStyle(importColorMat(f,FreshMat(col)),f.body);scene.add(f._mesh);
      bodies.push({id:f.id,name:f.name,mesh:f._mesh,color:col,visible:true,kind:'import',ref:f.id,bodyId:f.body||null});
    });
    occCleanup(FR,(occLive&&occLive.shape)||null);
    if(NOMS_PERTES_ESQ.size)FR.msgs.push(...NOMS_PERTES_ESQ.values());
    if(FR.msgs.length)faceEl.textContent+=(faceEl.textContent?'\n':'')+FR.msgs.slice(0,4).join('\n');
    phAdd('mesh',performance.now()-_ts);
    return true;
  }catch(e){
    try{if(FR)occCleanup(FR,null);}catch(_){}
    occDropLive();
    faceEl.textContent+=(faceEl.textContent?'\n':'')+'OCCT : '+e.message;
    return false;
  }
}
function projRefreshRerun(pass){
  // Projections associatives : si une esquisse a bougé après rejeu, le solide est rejoué
  // aussitôt (garde : une seule passe imbriquée — jamais de récursion infinie).
  // AVANT de rejouer : les projections ne déplacent que des entités de CONSTRUCTION (hors
  // profil) — on compare donc les entrées du solide. Signature identique = le second rejeu
  // reconstruirait exactement le même volume : c'était ~la moitié du temps de rebuild.
  const sigOf=()=>{let s='';const F=(doc&&doc.features)||[];for(let i=0;i<F.length;i++){if(F[i].visible!==false)s+=featSig(F[i])+';';}return s;};
  const s0=sigOf();
  let ch=false;
  const _tp=performance.now();
  try{ch=updateAllProjections();}catch(e){}
  phAdd('proj',performance.now()-_tp);
  if(!ch)return false;
  try{if(typeof cgResolveAll==='function'&&cgResolveAll())resolveAllSketchHosts();}catch(e){} // plans posés sur ce qui vient de bouger
  if(sigOf()===s0){
    // Projeté recalé sans effet sur le profil : on ne rejoue pas, mais on persiste les
    // nouvelles coordonnées et on redessine l'esquisse ouverte (tracé 2D non rafraîchi).
    try{autosave();}catch(e){}
    try{if(typeof skEdit!=='undefined'&&skEdit)drawSketch2D();}catch(e){}
    return false;
  }
  if((pass||0)<REGEN_MAX_PASS){ try{rebuild((pass||0)+1);}catch(e){} return true; }
  try{autosave();}catch(e){} // coordonnées déjà écrites : au moins les persister
  try{faceEl.textContent+=(faceEl.textContent?'\n':'')+'⚠ Régénération : le modèle ne s’est pas stabilisé en '+REGEN_MAX_PASS+' passes (référence circulaire ?).';}catch(e){}
  return false;
}
