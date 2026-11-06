// ESQUISSE POSÉE SUR UNE FACE DÉPLACÉE : retour utilisateur (Barquette), « l'esquisse 4 a tendance à
// perdre sa face de référence après changements dans les paramètres ». Le dessus de la pièce est baissé
// par un déplacement de face piloté par un paramètre. Aucune extrusion ne passait par ce plan : l'esquisse
// restait sans hôte, puis s'accrochait au flanc d'un renfort créé bien plus tard, posé là par hasard. Or
// ce renfort dépend de la pièce, donc de l'esquisse : une boucle, et l'esquisse ne revenait plus en place.
const path=require('path'),vm=require('vm');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const {ctx}=loadApp();
  const body=String.raw`
    const out={};
    const plaque={id:'sk_p',name:'Plaque',plane:'FACE',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],visible:false,constraints:[],dims:[],
      points:{a:{x:-100,y:-60},b:{x:100,y:-60},c:{x:100,y:60},d:{x:-100,y:60}},
      entities:[{id:'e1',t:'line',p1:'a',p2:'b'},{id:'e2',t:'line',p1:'b',p2:'c'},{id:'e3',t:'line',p1:'c',p2:'d'},{id:'e4',t:'line',p1:'d',p2:'a'}]};
    const carre=(id,z)=>({id,name:id,plane:'FACE',origin:[0,0,z],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],visible:false,constraints:[],dims:[],at:'mv_1',host:null,
      points:{a:{x:-5,y:-5},b:{x:5,y:-5},c:{x:5,y:5},d:{x:-5,y:5}},
      entities:[{id:'e1',t:'line',p1:'a',p2:'b'},{id:'e2',t:'line',p1:'b',p2:'c'},{id:'e3',t:'line',p1:'c',p2:'d'},{id:'e4',t:'line',p1:'d',p2:'a'}]});
    // le renfort : plan vertical, son flanc « e1 » tombe exactement sur le dessus baissé
    const renfort={id:'sk_r',name:'Renfort',plane:'FACE',origin:[0,0,0],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],visible:false,constraints:[],dims:[],
      points:{a:{x:-50,y:-3.3},b:{x:50,y:-3.3},c:{x:50,y:-20},d:{x:-50,y:-20}},
      entities:[{id:'e1',t:'line',p1:'a',p2:'b'},{id:'e2',t:'line',p1:'b',p2:'c'},{id:'e3',t:'line',p1:'c',p2:'d'},{id:'e4',t:'line',p1:'d',p2:'a'}]};
    const esq=carre('sk_4',-3.3);
    doc.sketches=[plaque,esq,renfort];doc.cgeo=[];doc.bodies=[];tlMark=null;
    const mv={id:'mv_1',type:'xmove',name:'Déplacement',dist:-3.3,visible:true,
      faces:[{pos:[0,0,0],dim:[200,120,0],n:[0,0,1],st:'Plane',nom:'ex_p/haut'}],ref:{pos:[0,0,0],dim:[200,120,0],n:[0,0,1],st:'Plane'}};
    doc.features=[
      {id:'ex_p',type:'extrude',name:'Plaque',sketchId:'sk_p',distance:-40,op:'add',visible:true},
      mv,
      {id:'ex_4',type:'extrude',name:'Sur la face',sketchId:'sk_4',distance:5,op:'add',visible:true},
      {id:'ex_r',type:'extrude',name:'Renfort',sketchId:'sk_r',distance:20,mid:true,op:'add',visible:true}];
    const etat=()=>({host:esq.host&&esq.host.feat,tag:esq.host&&esq.host.tag,z:esq.origin[2]});
    resolveAllSketchHosts();out.neuve=etat();
    mv.dist=-4;resolveAllSketchHosts();out.a4=etat();
    mv.dist=-3.3;resolveAllSketchHosts();out.retour=etat();
    out.violations=antViolations(doc.features).length;
    // fichier déjà accroché au renfort (Barquette telle qu'enregistrée) : réparé, sans bouger
    esq.origin[2]=-3.3;
    esq.host={feat:'ex_r',tag:'SIDE',x:0,y:-3.3,edge:'e1',h:0,name:'Face 12'};
    resolveAllSketchHosts();out.repare=etat();out.nom=esq.host.name;
    mv.dist=-4;resolveAllSketchHosts();out.repareSuit=etat();mv.dist=-3.3;resolveAllSketchHosts();
    // déplacement désactivé : l'esquisse revient avec la face
    mv.visible=false;resolveAllSketchHosts();out.sansMv=etat();mv.visible=true;resolveAllSketchHosts();
    // plan que seule une fonction de plus loin porte : pas d'accroche à une fonction future
    const seule=carre('sk_5',-20);seule.at='ex_4';doc.sketches.push(seule);
    const r2=JSON.parse(JSON.stringify(renfort));r2.id='sk_r2';r2.points={a:{x:-50,y:-20},b:{x:50,y:-20},c:{x:50,y:-30},d:{x:-50,y:-30}};doc.sketches.push(r2);
    doc.features.push({id:'ex_r2',type:'extrude',name:'Renfort 2',sketchId:'sk_r2',distance:20,mid:true,op:'add',visible:true});
    resolveAllSketchHosts();out.futur=seule.host||null;
    // l'antériorité connaît le lien vers le déplacement
    const F=doc.features,ordre=[F[0],F[2],F[1],F[3],F[4]];
    out.lienMv=antDeps(F[2],F).some(d=>d.id==='mv_1');
    out.refus=!!antNewViolation(F,ordre);
    return out;`;
  const o=await vm.runInContext('(async()=>{'+body+'})()',ctx);
  const z=(a,b)=>Math.abs(a-b)<1e-6;
  console.log('=== Esquisse sur une face déplacée ===');
  A(o.neuve.host==='ex_p'&&o.neuve.tag==='TOP','accrochée au dessus de la plaque, pas au renfort : '+JSON.stringify(o.neuve));
  A(z(o.a4.z,-4),'le déplacement passe à −4 : l’esquisse suit, z='+o.a4.z);
  A(z(o.retour.z,-3.3),'retour à −3,3 : elle revient, z='+o.retour.z);
  A(o.violations===0,'aucun lien vers l’aval : '+o.violations);
  A(o.repare.host==='ex_p'&&z(o.repare.z,-3.3),'hôte déjà sur le renfort : repris, sans bouger : '+JSON.stringify(o.repare));
  A(o.nom==='Face 12','le nom de la face est gardé : '+o.nom);
  A(z(o.repareSuit.z,-4),'après réparation elle suit le déplacement : z='+o.repareSuit.z);
  A(z(o.sansMv.z,0),'déplacement désactivé : retour au dessus d’origine, z='+o.sansMv.z);
  A(!o.futur,'une fonction placée plus loin ne devient pas porteuse : '+JSON.stringify(o.futur));
  A(o.lienMv,'l’antériorité voit le lien esquisse → déplacement');
  A(o.refus,'la fonction ne peut pas passer avant le déplacement');
  console.log(ko?'ÉCHEC : '+ko:'OK');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
