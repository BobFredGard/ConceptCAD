// 2026-09-30s : sélection dans l'arborescence — les trois défauts signalés :
//  1. Ctrl+clic ouvrait le panneau Répétition (et y ajoutait la source) ;
//  2. après un lot, sélectionner une répétition laissait l'ancienne sélection ;
//  3. on ne voyait pas quelles fonctions sont les sources d'une répétition.
// On pilote les VRAIS gestionnaires de clic posés par renderTree() (lisibles dans
// le DOM du harnais) : on ne teste pas une réimplémentation.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  x '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext(`
    var __confirm=[]; var __confirmer=true;
    window.confirm=function(){__confirm.push(1);return __confirmer;};
    window.alert=function(){};
  `,ctx);

  const body = `
    const out={};
    const rectSk=function(id,n,x0,y0,x1,y1){
      const sk={id:id,name:n,plane:"XY",origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
        points:{},entities:[],constraints:[],dims:[],visible:false};
      [["a",x0,y0],["b",x1,y0],["c",x1,y1],["d",x0,y1]].forEach(function(q){sk.points[q[0]]={x:q[1],y:q[2]};});
      [["a","b"],["b","c"],["c","d"],["d","a"]].forEach(function(e,i){sk.entities.push({id:"l"+i,t:"line",p1:e[0],p2:e[1]});});
      return sk;
    };
    doc.sketches=[];doc.features=[];doc.entNames={};
    doc.sketches.push(rectSk("sk1","A",0,0,40,30));
    doc.sketches.push(rectSk("sk2","B",10,10,25,22));
    doc.features.push({id:"E1",type:"extrude",name:"Alpha",sketchId:"sk1",distance:20,op:"add",visible:true,mid:false,upto:null});
    doc.features.push({id:"E2",type:"extrude",name:"Poche",sketchId:"sk2",distance:30,op:"cut",visible:true,mid:false,upto:null});
    doc.features.push({id:"RP",type:"repeat",name:"Rép",mode:"lin",copies:2,dist:15,angle:0,axis:"X",plane:"YZ",
      base:["E1"],children:[],visible:true});
    doc.features.push({id:"I1",type:"extrude",name:"Zeta",sketchId:"sk1",distance:20,op:"add",visible:true,repeatId:"RP",repIndex:2,_src:"E1"});
    markDirty();rebuild();

    // ---- pilote de clic : appelle le gestionnaire RÉEL de la ligne de l'arbre
    const evClic=function(ctrl){return {ctrlKey:!!ctrl,shiftKey:false,altKey:false,metaKey:false,
      target:{classList:{contains:function(){return false;}},className:""},
      stopPropagation:function(){},preventDefault:function(){}};};
    // Le DOM du harnais n'efface PAS children quand innerHTML='' : on ne considère
    // donc que les lignes du DERNIER rendu (on compte ce que le rendu précédent avait
    // laissé, et on ne garde que ce qui est arrivé depuis).
    let total=0,nLignes=0;
    const lignes=function(){
      const t=document.getElementById('tree');
      const c=(t&&t.children)?t.children:[];
      return c.slice(Math.max(0,c.length-nLignes));
    };
    const ligneDe=function(pred){
      const ls=lignes();
      // On cherche la DERNIÈRE occurrence : les gestionnaires de clic rejouent
      // renderTree() eux-mêmes, donc la fenêtre contient plusieurs rendus et une
      // ligne périmée ne doit jamais gagner.
      for(let i=ls.length-1;i>=0;i--){ if(pred(ls[i]))return ls[i]; }
      return null;
    };
    const nomDe=function(d){return d&&d.innerHTML?d.innerHTML:'';};
    // le NOM affiché de la ligne (span.nm) : l'infobulle du badge de sources contient
    // lui aussi des noms de fonctions, et.search sur tout le HTML serait ambigu
    const nomAffiche=function(d){
      const m=/class="nm">([^<]*)/.exec(nomDe(d));
      return m?m[1]:'';
    };
    const parNom=function(nom){return ligneDe(function(d){return nomAffiche(d).indexOf(nom)>=0;});};
    const rendre=function(){
      renderTree();
      const c=document.getElementById('tree').children;
      nLignes=Math.max(0,c.length-total);
      total=c.length;
    };
    // Le harnais ne construit pas innerHTML : on cherche les cases à cocher en
    // parcourant les nœuds réellement créés.
    const chercher=function(noeud,pred,acc){
      acc=acc||[];
      if(!noeud)return acc;
      if(pred(noeud))acc.push(noeud);
      const kids=noeud.children||[];
      for(let i=0;i<kids.length;i++)chercher(kids[i],pred,acc);
      return acc;
    };
    rendre();
    out.nbLignes=nLignes;

    // ── 1) Ctrl+clic sur deux fonctions : NE DOIT PAS ouvrir la répétition
    repMode=null;treeSel=[];sel={kind:null,id:null};rendre();
    parNom("Alpha").onclick(evClic(true));
    out.t1a=treeSel.join("+");
    out.repApres1=(repMode===null)?'nul':'OUVERT';
    parNom("Poche").onclick(evClic(true));
    out.t1b=treeSel.join("+");
    out.repApres2=(repMode===null)?'nul':'OUVERT';
    out.selApres2=sel.id;

    // ── 2) clic simple sur la répétition : le lot doit être VIDÉ
    parNom("Rép").onclick(evClic(false));
    out.t2=treeSel.join("+");
    out.sel2=sel.id;
    out.repApres3=(repMode===null)?'nul':'OUVERT';

    // ── 2b) clic simple sur une INSTANCE : le lot doit être vidé aussi
    treeSel=["E1","E2"];
    parNom("Zeta").onclick(evClic(false));
    out.t2b=treeSel.join("+");
    out.sel2b=sel.id;

    // ── 3) sources visibles dans l'arbre quand la répétition est sélectionnée
    rendre();
    out.marqueSource=lignes().filter(function(d){return /srcmark/.test(nomDe(d));}).length;
    // le repère doit être sur la SOURCE (Bloc), pas sur la poche
    out.marqueSurBloc=lignes().filter(function(d){return /srcmark/.test(nomDe(d))&&nomAffiche(d).indexOf("Alpha")>=0;}).length;
    out.marqueSurPoche=/srcmark/.test(nomDe(ligneDe(function(d){return nomAffiche(d).indexOf("Poche")>=0;})))?1:0;
    out.badgeRep=/repsrc/.test(nomDe(parNom("Rép")))?1:0;
    out.htmlRep=nomDe(parNom("Rép")).slice(0,240);
    out.selAuMoment=sel.kind+':'+sel.id;
    out.badgeChiffre=(nomDe(parNom("Rép")).match(/repsrc[^>]*>[^<]*([0-9]+)</)||[])[1]||'?';
    // sans répétition sélectionnée, plus de repère
    sel={kind:'null',id:null};rendre();
    out.marqueSansSel=/srcmark/.test(nomDe(parNom("Alpha")))?1:0;

    // ── 4) V0.99.39 : création — plus de cases, les sources se choisissent dans la TIMELINE
    sel={kind:'feature',id:"RP"};
    enterRepMode();
    out.repOuvert=repMode?1:0;
    out.cochées=(repMode.feats||[]).join("+");
    const p=document.getElementById('props');
    p.children.length=0;
    renderRepPanel();
    out.nbCases=chercher(p,function(n){return n.tagName==='INPUT'&&n.className==='repsrcchk';}).length;
    out.nbItems=chercher(p,function(n){return n.className==='repSrcItem';}).length;
    out.pickCreation=repPickActive()?1:0;
    const pas=function(id){return tlbSteps().find(function(s){return s.id===id;});};
    tlbClick(pas('E1'),{});
    out.apresClicE1=(repMode.feats||[]).join("+");
    out.vertCreation=Array.from(repTlSources().ids).join("+");
    out.nbItemsApres=chercher(p,function(n){return n.className==='repSrcItem';}).length;
    tlbClick(pas('E1'),{});
    out.apresReclicE1=(repMode.feats||[]).join("+");
    out.toutesRepetables=doc.features.filter(function(f){return repCanFeature(f.id);}).map(function(f){return f.id;}).join("+");
    exitRepMode();

    // ── 5) ÉDITION : liste des sources, choix ouvert par « 🎯 Choisir dans la timeline »
    repMode=null;sel={kind:'feature',id:"RP"};
    doc.features.find(function(f){return f.id==="RP";}).base=["E1"];
    repGenChildren(doc.features.find(function(f){return f.id==="RP";}));
    const pe=document.getElementById('props');
    pe.children.length=0;
    const origRenderProps=renderProps;
    let nbRender=0;
    renderProps=function(){nbRender++;return origRenderProps.apply(this,arguments);};
    renderProps();
    out.nbCasesEdit=chercher(pe,function(n){return n.tagName==='INPUT'&&n.className==='repsrcchk';}).length;
    out.nbItemsEdit=chercher(pe,function(n){return n.className==='repSrcItem';}).length;
    out.pickAvantBouton=repPickActive()?1:0;
    out.vertEdit=Array.from((repTlSources()||{ids:[]}).ids).join("+");
    out.pasDeBoutonAjouter=chercher(pe,function(n){return n.tagName==='BUTTON';}).map(function(n){return n.textContent;}).join('|').indexOf('Ctrl')<0;
    const bt=chercher(pe,function(n){return n.className==='repPickBtn';})[0];
    out.bouton=bt?bt.textContent:'';
    if(bt)bt.onclick();
    out.pickApresBouton=repPickActive()?1:0;
    nbRender=0;
    tlbClick(pas('E2'),{});
    out.baseApresCheck=(doc.features.find(function(f){return f.id==="RP";}).base||[]).join("+");
    out.selApresCheck=sel.id;
    out.nbRenderApresCheck=nbRender;
    out.enteteApresCheck=(function(){
      const t=chercher(pe,function(n){return n.innerHTML&&n.innerHTML.indexOf('instance(s)')>=0;});
      return t.length?t[0].innerHTML.replace(/<[^>]*>/g,''):'';
    })();
    tlbClick(pas('E1'),{});
    out.baseApresUncheck=(doc.features.find(function(f){return f.id==="RP";}).base||[]).join("+");
    out.nbRenderApresUncheck=nbRender;
    // ✕ dans la liste du panneau
    const xs=chercher(pe,function(n){return n.className==='mini repsrcdel';}),x=xs[xs.length-1]; // le harnais garde les anciennes lignes : la dernière est la liste à jour
    if(x)x.onclick();
    await new Promise(function(r){setTimeout(r,5);});
    out.baseApresCroix=(doc.features.find(function(f){return f.id==="RP";}).base||[]).join("+");
    // clic sur la répétition elle-même : fin du choix ; ensuite un clic redevient une sélection
    tlbClick(pas('RP'),{});
    out.pickFin=repPickActive()?1:0;
    tlbClick(pas('E1'),{});
    out.selApresFin=sel.id;
    out.baseApresFin=(doc.features.find(function(f){return f.id==="RP";}).base||[]).join("+");
    renderProps=origRenderProps;
    return out;
  `;
  let o;
  try{o=await vm.runInContext('(async()=>{'+body+'})()',ctx);}
  catch(e){console.log('FATAL '+String(e&&e.stack||e).slice(0,700));process.exit(1);}

  console.log('=== 2026-09-30s : sélection dans l arborescence ===');
  console.log('  lignes d arbre rendues : '+o.nbLignes);
  console.log('  Ctrl+clic Bloc         : lot=['+o.t1a+']  répétition='+o.repApres1);
  console.log('  Ctrl+clic + Poche      : lot=['+o.t1b+']  répétition='+o.repApres2);
  console.log('  clic simple sur Rép    : lot=['+o.t2+']  sel='+o.sel2+'  répétition='+o.repApres3);
  console.log('  clic sur instance      : lot=['+o.t2b+']  sel='+o.sel2b);
  console.log('  sources marquées       : '+(o.marqueSource?'oui':'non')+'  (source='+o.marqueSurBloc+', non-source='+o.marqueSurPoche+')');
  console.log('  badge de la répétition : '+(o.badgeRep?'présent':'absent')+'  ◀ '+o.badgeChiffre);
  console.log('  sans répétition sélectionnée, repère : '+o.marqueSansSel+' (0 attendu)');
  console.log('  création : cases='+o.nbCases+' liste='+o.nbItems+' choix actif='+o.pickCreation+' clic E1 → '+o.apresClicE1+' (vert '+o.vertCreation+') reclic → '+o.apresReclicE1);
  console.log('  édition  : liste='+o.nbItemsEdit+' vert='+o.vertEdit+' bouton='+o.bouton+' choix '+o.pickAvantBouton+'→'+o.pickApresBouton);
  console.log('  clic E2 → '+o.baseApresCheck+' (reconstructions '+o.nbRenderApresCheck+', en-tête '+o.enteteApresCheck+') ; clic E1 → '+o.baseApresUncheck+' ; ✕ → '+o.baseApresCroix+' ; fin → choix '+o.pickFin+', sel '+o.selApresFin+', base '+o.baseApresFin);
  A(o.repOuvert===1&&o.nbCases===0,'création : plus aucune case à cocher (V0.99.39)');
  A(o.cochées==='RP'&&o.nbItems===1,'la répétition sélectionnée est déjà choisie, listée dans le panneau (V0.11.30)');
  A(o.pickCreation===1,'création : le clic dans la timeline choisit d emblée');
  A(o.apresClicE1==='RP+E1'&&o.vertCreation==='RP+E1','clic sur Alpha dans la timeline : ajoutée, entourée de vert');
  A(o.apresReclicE1==='RP','reclic : retirée');
  A(o.toutesRepetables==='E1+E2+RP','les fonctions répétables sont E1, E2 et la répétition RP (les instances sont exclues)');
  A(o.nbCasesEdit===0&&o.nbItemsEdit===1,'édition : la liste montre la source actuelle, sans case');
  A(o.vertEdit==='E1','édition : la source est entourée de vert dans la timeline');
  A(o.pasDeBoutonAjouter,'le bouton « Ajouter / retirer par Ctrl+clic » a disparu');
  A(o.pickAvantBouton===0&&o.pickApresBouton===1&&/Choisir/.test(o.bouton),'édition : le choix s ouvre par « 🎯 Choisir dans la timeline »');
  A(o.baseApresCheck==='E1+E2'&&o.selApresCheck==='RP','clic sur Poche : AJOUTÉE à la répétition, la sélection reste la répétition');
  A(o.nbRenderApresCheck===0,'le panneau ne se reconstruit pas depuis le clic');
  A(/4 instance/.test(o.enteteApresCheck),'l\'en-tête « n instance(s) » se met à jour sur place (2 sources × 2)');
  A(o.baseApresUncheck==='E2'&&o.nbRenderApresUncheck===0,'reclic sur Alpha : retirée (il reste Poche)');
  A(o.baseApresCroix==='','✕ dans le panneau : retire la source');
  A(o.pickFin===0&&o.selApresFin==='E1'&&o.baseApresFin==='','clic sur la répétition : fin du choix, puis un clic redevient une sélection');
  console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.log('FATAL',String((e&&e.message)||e).slice(0,600));process.exit(1);});