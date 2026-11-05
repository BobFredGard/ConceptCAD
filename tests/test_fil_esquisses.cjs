// Fil de construction, retour utilisateur sur Barquette : esquisses « fantômes » mal placées et
// Symétrie qu'on ne pouvait pas amener juste après la Linéaire.
// 1) Une répétition vit dans le corps de ses sources, fichiers existants compris.
// 2) Un plan qui ne s'appuie pas sur le solide ne retient pas ce qui a été créé juste avant lui.
// 3) Une esquisse pas encore consommée reste à sa place de création, marqueur compris.
// 4) Une esquisse refermée sans rien dessiner disparaît, sans étape d'annulation qui la ramène.
// 5) Le corps actif se choisit dans le bandeau, corps masqué ou pas encore créé signalé.
const {loadApp}=require('./appvm.cjs');
const lire=require('./lire-projet.cjs');
const vm=require('vm'),path=require('path');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const {ctx}=loadApp();
  ctx.__barquette=lire(path.join(__dirname,'fixtures','barquette-fil.conceptcad'));
  const body=String.raw`
    const out={};
    const SYM='rp_22_mw2hsrz3',LIN='rp_49_mw2nt0n0',SOUS='cb_17_mw1s8r93';
    const charge=()=>{
      doc=JSON.parse(__barquette).doc;tlMark=null;sel={kind:null,id:null};treeSel=[];
      docSanitise();
      doc.features.filter(f=>f.type==='repeat').forEach(f=>repGenChildren(f));
    };
    const tete=()=>doc.features.filter(f=>!f.repeatId).map(f=>f.id);
    const sk=id=>doc.sketches.find(s=>s.id===id);
    const fil=()=>tlbSteps().map(s=>s.id);

    // ── 1) fichier réel : réparation à l'ouverture
    charge();
    out.linCorps=doc.features.find(f=>f.id===LIN).body;
    out.symCorps=doc.features.find(f=>f.id===SYM).body;
    out.fantomes=!!(sk('sk_38_mw2mp1yq')||sk('sk_39_mw2mp8uv'));
    out.gardees=['sk_2_mvz6l22n','sk_31_mw2iosgf','sk_51_mw2nt0n2'].every(id=>!!sk(id));

    // ── 2) arbre : la Symétrie se dépose sur la Linéaire
    out.acceptArbre=treeDropFeat(LIN).accept({kind:'feature',id:SYM});
    const violAvant=antViolations(null,true).length;
    out.deplaceArbre=treeFeatMoveTo(SYM,LIN);
    let t=tete();
    out.ordreArbre=t.indexOf(SYM)===t.indexOf(LIN)+1&&t.indexOf(SOUS)===t.indexOf(SYM)+1;
    out.pasDeNouveauLien=antViolations(null,true).length===violAvant;
    // les instances suivent leur répétition, en bloc
    const i=doc.features.findIndex(f=>f.id===SYM);
    out.blocEntier=doc.features.slice(i+1,i+5).every(f=>f.repeatId===SYM);
    // les plans créés après la Symétrie restent avant le balayage qui s'en sert
    const f=fil();
    out.planAvantBalayage=f.indexOf('cg_30_mw2iocnh')<f.indexOf('sk_31_mw2iosgf')&&f.indexOf('sk_31_mw2iosgf')<f.indexOf('sw_30_mw2mer3t');

    // ── 3) bandeau : même geste, déposé dans l'interstice juste après la Linéaire
    charge();
    let S=tlbSteps();
    out.deplaceBandeau=tlbMoveTo(SYM,S.findIndex(s=>s.id===SOUS),S);
    t=tete();
    out.ordreBandeau=t.indexOf(SYM)===t.indexOf(LIN)+1;

    // ── 4) un plan posé sur une face du solide reste une vraie dépendance
    const base=()=>{
      const m=(id,o)=>Object.assign({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],seq:1,visible:true,
        points:{a:{x:1,y:1},b:{x:9,y:1}},entities:[{id:'l',t:'line',p1:'a',p2:'b'}],constraints:[],dims:[]},o||{});
      doc.bodies=[{id:'b1',name:'Corps 1'}];doc.activeBody='b1';tlMark=null;
      doc.sketches=[m('s1'),m('s2',{plane:'CG',cg:{id:'P'}}),m('s3',{plane:'FACE',host:{feat:'E1',tag:'TOP',x:0,y:0,name:'Face 1'}})];
      doc.cgeo=[{id:'P',kind:'plane',how:'offset',name:'Plan',refs:[{k:'o',id:'XY'}],p:{d:5},at:'E2',visible:true,st:'ok'}];
      doc.features=[
        {id:'E1',type:'extrude',name:'Bloc',sketchId:'s1',distance:9,op:'add',visible:true,body:'b1'},
        {id:'E2',type:'extrude',name:'Second',sketchId:'s1',distance:9,op:'add',visible:true,body:'b1'},
        {id:'E3',type:'extrude',name:'Sur plan',sketchId:'s2',distance:9,op:'add',visible:true,body:'b1'},
        {id:'SW',type:'sweep',name:'Balayage',sketchId:'s1',pathId:'s3',op:'add',visible:true,body:'b1'}
      ];
    };
    base();
    const deps=id=>antDeps(doc.features.find(f=>f.id===id)).map(d=>d.id);
    out.planLibre=deps('E3').indexOf('E2')<0;
    doc.cgeo[0].refs=[{k:'face',ref:{pos:[0,0,0]}}];
    out.planSurFace=deps('E3').indexOf('E2')>=0;
    out.cheminHote=deps('SW').indexOf('E1')>=0;

    // ── 5) place d'une nouvelle esquisse
    base();doc.cgeo=[];doc.sketches=doc.sketches.slice(0,1);
    doc.features=doc.features.slice(0,2);
    tlMark='E2';
    newSketch('XY');
    let n=doc.sketches[doc.sketches.length-1];
    n.points.a={x:0,y:0};n.points.b={x:5,y:0};n.entities.push({id:'l',t:'line',p1:'a',p2:'b'});
    closeSketch(true);
    out.atMarqueur=n.at==='E1';
    tlMark=null;
    let g=fil();
    out.filMarqueur=g.indexOf('E1')<g.indexOf(n.id)&&g.indexOf(n.id)<g.indexOf('E2');
    newSketch('XY');
    let m=doc.sketches[doc.sketches.length-1];
    m.points.a={x:0,y:0};m.points.b={x:5,y:0};m.entities.push({id:'l',t:'line',p1:'a',p2:'b'});
    closeSketch(true);
    g=fil();
    out.atFin=m.at==='E2'&&g[g.length-1]===m.id;
    // fonctions ajoutées ensuite : l'esquisse reste où elle a été créée, pas en fin de fil
    doc.features.push({id:'E9',type:'extrude',name:'Après',sketchId:'s1',distance:9,op:'add',visible:true,body:'b1'});
    g=fil();
    out.resteEnPlace=g.indexOf(m.id)<g.indexOf('E9');
    // consommée : juste avant sa fonction, comme avant
    doc.features.push({id:'E10',type:'extrude',name:'Consomme',sketchId:m.id,distance:9,op:'add',visible:true,body:'b1'});
    g=fil();
    out.consommee=g.indexOf(m.id)===g.indexOf('E10')-1;
    // fichier ancien sans place mémorisée : règle d'avant
    delete n.at;delete n.ai;
    g=fil();
    out.ancien=g[g.length-1]===n.id;
    // la fonction d'ancrage disparaît : l'esquisse se raccroche à celle d'avant
    base();doc.cgeo=[];doc.sketches=doc.sketches.slice(0,1);doc.features=doc.features.slice(0,2);
    newSketch('XY');
    m=doc.sketches[doc.sketches.length-1];
    m.points.a={x:0,y:0};m.points.b={x:5,y:0};m.entities.push({id:'l',t:'line',p1:'a',p2:'b'});
    closeSketch(true);
    doc.features.push({id:'E9',type:'extrude',name:'Après',sketchId:'s1',distance:9,op:'add',visible:true,body:'b1'});
    m.ai=cgPos(m);
    doc.features=doc.features.filter(x=>x.id!=='E2');
    g=fil();
    out.ancreDisparue=g.indexOf('E1')<g.indexOf(m.id)&&g.indexOf(m.id)<g.indexOf('E9');

    // ── 6) esquisses vides
    base();doc.cgeo=[];doc.sketches=doc.sketches.slice(0,1);
    const nb0=doc.sketches.length;
    doc.features=doc.features.slice(0,2);
    doc.sketches.forEach(migrateSketch);rebuild(); // comme à l'ouverture d'un fichier
    docUndoStack.length=0;docBaseSync();
    newSketch('XY');const a1=doc.sketches[doc.sketches.length-1].id;
    out.ouverte=doc.sketches.length===nb0+1;
    closeSketch(false);
    out.annuleeRetiree=doc.sketches.length===nb0&&!doc.sketches.some(s=>s.id===a1);
    out.pileAnnul=docUndoStack.length===0;
    newSketch('XY');
    closeSketch(true);
    out.valideeRetiree=doc.sketches.length===nb0&&sel.kind===null;
    // dessinée : conservée
    newSketch('XY');
    n=doc.sketches[doc.sketches.length-1];
    n.points.a={x:0,y:0};n.entities.push({id:'c',t:'circle',c:'a',r:3});
    closeSketch(true);
    out.dessineeGardee=doc.sketches.some(s=>s.id===n.id)&&sel.kind==='sketch'&&sel.id===n.id;
    // vide mais citée par un plan : conservée
    const vide={id:'sV',name:'Vide',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{O:{x:0,y:0}},entities:[],constraints:[],dims:[],visible:true};
    doc.sketches.push(vide);
    doc.cgeo=[{id:'Q',kind:'plane',how:'curve',name:'Q',refs:[{k:'skent',sk:'sV',e:'x'}],p:{t:0},at:null,visible:true,st:'ok'}];
    out.citeeGardee=!skIsGhost(vide);
    doc.cgeo=[];
    out.videFantome=skIsGhost(vide);
    // une esquisse FAO a son propre cycle de vie
    out.faoGardee=!skIsGhost(Object.assign({},vide,{fao:'p1'}));
    // ── 7) choix du corps actif, dans le bandeau
    charge();
    let ch=tlbBodyChoices();
    out.corpsListe=ch.length===3&&ch.some(c=>c.id==='b1'&&c.label==='Barquette Froide');
    doc.bodyVis=doc.bodyVis||{};doc.bodyVis.b4=false;
    out.corpsMasque=tlbBodyChoices().find(c=>c.id==='b4').label==='Intérieur (masqué)';
    doc.bodyVis.b4=true;
    out.corpsPris=tlbBodyPick('b1')&&doc.activeBody==='b1';
    tlMark='ex_3_mvz6umhd';
    const pasNe=tlbBodyChoices().find(c=>c.id==='b4');
    out.corpsPasNe=pasNe.off&&/pas encore/.test(pasNe.label);
    out.corpsRefuse=!tlbBodyPick('b4')&&doc.activeBody!=='b4';
    tlMark=null;
    return JSON.stringify(out);
  `;
  const o=JSON.parse(vm.runInContext('(function(){'+body+'})()',ctx));
  console.log('=== Fil de construction : Barquette, esquisses et déplacements ===');
  A(o.linCorps==='b1','la Linéaire est rangée dans le corps de ses sources');
  A(o.symCorps==='b1','la Symétrie reste dans son corps');
  A(!o.fantomes,'« Esquisse 8 » et « Esquisse 9 », vides, sont retirées à l’ouverture');
  A(o.gardees,'les vraies esquisses et les copies de répétition sont conservées');
  A(o.acceptArbre,'arbre : la Symétrie est acceptée sur la Linéaire');
  A(o.deplaceArbre,'arbre : le déplacement a lieu');
  A(o.ordreArbre,'arbre : Symétrie juste après la Linéaire, avant la soustraction');
  A(o.pasDeNouveauLien,'aucun nouveau lien vers l’aval');
  A(o.blocEntier,'la Symétrie emporte ses copies');
  A(o.planAvantBalayage,'Plan 2 reste avant le guide et le balayage');
  A(o.deplaceBandeau,'bandeau : le déplacement a lieu');
  A(o.ordreBandeau,'bandeau : Symétrie juste après la Linéaire');
  A(o.planLibre,'plan décalé d’un plan d’origine : pas de dépendance à sa place dans le fil');
  A(o.planSurFace,'plan posé sur une face : la dépendance reste');
  A(o.cheminHote,'chemin d’un balayage posé sur une face : la dépendance est vue');
  A(o.atMarqueur,'nouvelle esquisse avec marqueur : place mémorisée avant le marqueur');
  A(o.filMarqueur,'dans le fil, elle apparaît au marqueur');
  A(o.atFin,'sans marqueur : en fin de fil');
  A(o.resteEnPlace,'des fonctions ajoutées ensuite passent après elle');
  A(o.consommee,'consommée : juste avant sa fonction');
  A(o.ancien,'fichier ancien sans place mémorisée : en fin de fil, comme avant');
  A(o.ancreDisparue,'fonction d’ancrage supprimée : l’esquisse garde sa place');
  A(o.ouverte,'une esquisse vide existe tant qu’elle est ouverte');
  A(o.annuleeRetiree,'annulée sans dessin : retirée');
  A(o.pileAnnul,'aucune étape d’annulation ne la ramène');
  A(o.valideeRetiree,'validée sans dessin : retirée, sélection vidée');
  A(o.dessineeGardee,'dessinée : conservée et sélectionnée');
  A(o.citeeGardee,'vide mais citée par un plan : conservée');
  A(o.videFantome,'vide et plus citée : fantôme');
  A(o.faoGardee,'esquisse FAO : jamais retirée ici');
  A(o.corpsListe,'bandeau : tous les corps sont proposés');
  A(o.corpsMasque,'un corps masqué est signalé');
  A(o.corpsPris,'choisir un corps l’active');
  A(o.corpsPasNe,'un corps qui naît plus loin que le marqueur est grisé');
  A(o.corpsRefuse,'et ne peut pas être activé');
  console.log(ko?'*** '+ko+' ÉCHEC(S) ***':'*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
