// V0.99.79 : budget mémoire des workers FAO (src/88-fao-58-multicoeur.js, faoWkRemplir0).
// STEP.conceptcad de Fred : « Tout régénérer » relançait la page — 2 ébauches 3D × 8 couches =
// 16 workers dans le même tas JavaScript (≈ 4 Go sous Chrome / Edge / l'appli). La répartition
// compte un poids par calcul lancé et n'en lance pas plus que le budget ; le premier part
// toujours ; toutes les tâches finissent ; l'avancement annonce les cœurs vraiment utilisés.
// Workers SIMULÉS : ils répondent « ko » (ou « memo » pour une couche) après quelques ms —
// le test ne regarde que la répartition, pas les parcours.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx,sandbox}=loadApp();
  sandbox.navigator.hardwareConcurrency=25; // 24 cœurs de travail → 16 workers au plus
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    const BUD=faoWkBudget;
    const warn=console.warn; console.warn=function(){};
    faoWkUrl=function(){ return 'blob:essai'; };
    faoWkAccepte=function(){ return true; };
    faoWkPrecOps=function(){ return []; };
    const CORPS=[{id:'b1',bas:{v:new Float64Array(3*1024*1024/8),t:new Int32Array(0)}}]; // 3 Mo
    faoWkCorps=function(){ return CORPS; };
    faoWkDocData=function(){ return {}; };
    faoWkBoites=function(){ return null; };
    faoActiveMesh=function(){};
    faoOpMovesKey=function(o){ return 'k:'+o.id; };
    faoOpMovesHit=function(){ return null; };
    const job={id:'s1',ops:[]};
    const ebauche=function(id){ return {id:id,type:'rough3d',ap:1,ztop:20,zbot:0}; };
    const finition=function(id){ return {id:id,type:'geofinish'}; };
    job.ops=[ebauche('r1'),ebauche('r2'),finition('f1'),finition('f2'),finition('f3')];
    const nC=faoWkNivNb(job.ops[0],job);
    att(nC===8,'ébauche 3D découpée en 8 couches sur 24 cœurs : '+nC);
    // poids : type de calcul + 4 × maillages envoyés (3 Mo ici)
    const pR=faoWkPoids(job.ops[0],job,CORPS),pC=faoWkPoids(job.ops[0],job,CORPS,{n:8,i:0}),pF=faoWkPoids(job.ops[2],job,CORPS);
    att(pR===FAO_WK_POIDS.rough3d+12&&pC===FAO_WK_POIDS.couche+12&&pF===FAO_WK_POIDS.geofinish+12,'poids ébauche '+pR+', couche '+pC+', finition '+pF);
    p('poids : ébauche 3D entière '+pR+' Mo, couche '+pC+' Mo, finition '+pF+' Mo');
    // Workers simulés : chacun compte le poids de sa tâche (lu dans le message reçu)
    let actifs=0,pic=0,lances=0,niv=0,charge=0,picCharge=0;
    Worker=function(){ this.dead=false; };
    Worker.prototype.postMessage=function(m){
      const w=this,op=job.ops.find(function(o){ return o.id===m.opId; });
      const q=faoWkPoids(op,job,CORPS,m.niv);
      actifs++; lances++; if(m.niv)niv++; if(actifs>pic)pic=actifs;
      charge+=q; if(charge>picCharge)picCharge=charge;
      setTimeout(function(){
        actifs--; charge-=q; if(w.dead)return;
        w.onmessage({data:m.niv?{t:'memo',entries:[]}:{t:'ko',err:'simulé'}});
      },5+Math.floor(Math.random()*10));
    };
    Worker.prototype.terminate=function(){ this.dead=true; };
    const essai=async function(budget){
      faoWkBudget=function(){ return budget; };
      actifs=0;pic=0;lances=0;niv=0;charge=0;picCharge=0;
      const annonces=[];
      const n=await faoWkRemplir0(job,job.ops,function(){ return false; },null,function(f,t,c){ annonces.push(c); });
      return {pic:pic,lances:lances,niv:niv,rangees:n,picCharge:picCharge,annonce:annonces[annonces.length-1],total:annonces.length};
    };
    // 1. Budget large : 16 workers à la fois comme avant (2 × 8 couches)
    let r=await essai(1e9);
    p('budget large : '+r.pic+' workers à la fois, '+r.lances+' lancés ('+r.niv+' couches)');
    att(r.pic===16,'budget large : 16 workers à la fois ('+r.pic+')');
    att(r.lances===2*8+2+3&&r.niv===16,'toutes les tâches lancées : 16 couches, 2 calculs finaux, 3 finitions ('+r.lances+')');
    // 2. Budget pour 3 couches : la somme des poids en cours ne le dépasse jamais, tout est lancé
    const B3=3*pC+1;
    r=await essai(B3);
    p('budget '+B3+' Mo : '+r.pic+' workers à la fois (pointe '+r.picCharge+' Mo), '+r.lances+' lancés, cœurs annoncés : '+r.annonce);
    att(r.picCharge<=B3,'budget '+B3+' Mo jamais dépassé ('+r.picCharge+' Mo)');
    att(r.pic>=3&&r.pic<=4,'budget pour 3 couches : 3 ou 4 workers à la fois ('+r.pic+')');
    att(r.lances===21&&r.niv===16,'budget pour 3 couches : toutes les tâches lancées ('+r.lances+')');
    att(r.annonce===r.pic,'avancement : cœurs vraiment utilisés annoncés ('+r.annonce+' pour '+r.pic+'), pas 16');
    // 3. Budget plus petit qu'un seul calcul : un à la fois, rien n'est bloqué
    r=await essai(10);
    p('budget minuscule : '+r.pic+' worker à la fois, '+r.lances+' lancés');
    att(r.pic===1&&r.lances===21,'budget minuscule : un à la fois, tout lancé ('+r.pic+', '+r.lances+')');
    faoWkBudget=BUD; console.warn=warn;
    return P.join('\\n')+'\\n'+ATT.length+' échec(s)'+(ATT.length?'\\n  - '+ATT.join('\\n  - '):'');
  `;
  const out=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log(out);
  // Budget calculé : 75 % du tas commun (4 Go au plus) moins 1,5 × ce que la page occupe déjà
  const b=vm.runInContext(`(function(){
    performance={memory:{jsHeapSizeLimit:4395630592,usedJSHeapSize:500*1048576}};
    const a=Math.round(faoWkBudget());
    performance={memory:{jsHeapSizeLimit:4395630592,usedJSHeapSize:2500*1048576}};
    const c=Math.round(faoWkBudget());
    performance={};
    const d=Math.round(faoWkBudget());
    return [a,c,d];
  })()`,ctx);
  console.log('budget : page à 500 Mo → '+b[0]+' Mo ; page à 2,5 Go → '+b[1]+' Mo ; sans mesure (Firefox) → '+b[2]+' Mo');
  let ko=/^[1-9]\d* échec/m.test(out)?1:0;
  if(b[0]!==4096*0.75-750){ko++;console.log('  KO budget page à 500 Mo : '+b[0]);}
  if(b[1]!==0){ko++;console.log('  KO budget page à 2,5 Go (plancher) : '+b[1]);}
  if(b[2]!==4096*0.75-600){ko++;console.log('  KO budget sans mesure : '+b[2]);}
  console.log(ko?'ÉCHEC':'OK');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
