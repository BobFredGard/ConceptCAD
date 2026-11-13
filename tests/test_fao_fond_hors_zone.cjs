// V0.96.4 — Ébauche 3D : un fond HORS de la limite de l'opération ne coupe plus la descente en deux.
// Cas réel : SIRAP-14-002, rainures de 6 mm (ap ≥ 6) et un épaulement à Z 73 sur le pourtour,
// hors de la limite : deux passes (73 puis 70,2) au lieu d'une. Cause : faoFloorInZone comparait
// les cotes au millionième alors que faoUpFloors les arrondit au millième — aucun fond n'était
// jamais reconnu dans la zone — et les arrêts de fond ne regardaient pas la zone du tout.
// Pièce de synthèse (colonnes jointives, maillage fermé) : épaulements à 7 aux deux bouts,
// rainure de 6 de large au fond 4, dessus 10 ; outil Ø6, ap 10.
//  1. avec limite (épaulements hors de portée) : un seul niveau, au fond de la rainure ;
//  2. sans limite : l'épaulement reste un arrêt (7 puis 4), comme avant ;
//  3. faoFloorInZone reconnaît un fond à 7,0000003 (bruit du maillage) dans la zone.
'use strict';
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
const {ctx}=loadApp();
const r=vm.runInContext(String.raw`(()=>{
  const v=[],t=[];
  const boite=(x0,x1,y0,y1,z0,z1)=>{
    const b=v.length;
    [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]].forEach(p=>v.push(p));
    [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]]
      .forEach(q=>t.push([b+q[0],b+q[1],b+q[2]]));
  };
  const Z7=7.0000003; // bruit du maillage (Float32, tessellation)
  boite(0,8,0,60,0,Z7); boite(8,40,0,60,0,10); boite(40,46,0,60,0,4); boite(46,92,0,60,0,10); boite(92,100,0,60,0,Z7);
  const mesh={v:v,t:t}, box={x0:0,y0:0,x1:100,y1:60};
  const niveaux=zoneAt=>{
    faoSliceCache=null;
    const g=faoGenRough3DIt(mesh,box,10,4,{ap:10,ae:3,toolD:6,mode:'anneaux',sens:'avalant',secu:20,zoneAt:zoneAt});
    let it=g.next(); while(!it.done)it=g.next();
    const mv=it.value||[], L={};
    for(let i=1;i<mv.length;i++){const p=mv[i-1],m=mv[i];
      if(m.r||p.r||Math.abs(m.z-p.z)>1e-6)continue;
      const k=(Math.round(m.z*1000)/1000).toFixed(3);L[k]=(L[k]||0)+Math.hypot(m.x-p.x,m.y-p.y);}
    return Object.keys(L).filter(k=>L[k]>5).sort((a,b)=>b-a);
  };
  // zone du CENTRE de l'outil : limite x 11..89 rétrécie du rayon (3)
  const zone=(x,y)=>x>=14&&x<=86&&y>=-3&&y<=63;
  const o={};
  o.floors=faoUpFloors(mesh,4,10);
  o.avec=niveaux(zone);
  o.sans=niveaux(null);
  o.dansZone=faoFloorInZone(mesh,4,zone,3);
  o.ledgeHors=faoFloorInZone(mesh,7,zone,3);
  o.ledgeLarge=faoFloorInZone(mesh,7,(x,y)=>x>=4&&x<=96,0);
  return o;
})()`,ctx);
console.log('=== FAO : fond hors de la limite de l’ébauche 3D ===');
console.log('  fonds : '+JSON.stringify(r.floors)+' ; niveaux avec limite '+JSON.stringify(r.avec)+', sans '+JSON.stringify(r.sans));
A(r.floors.includes(7)&&r.floors.includes(4),'les deux fonds (épaulement 7, rainure 4) sont détectés');
A(r.avec.length===1&&r.avec[0]==='4.000','avec limite : une seule passe, au fond de la rainure');
A(r.sans.includes('7.000')&&r.sans.includes('4.000'),'sans limite : l’épaulement reste un arrêt (7 puis 4)');
A(r.dansZone&&!r.ledgeHors,'faoFloorInZone : rainure dans la zone, épaulement hors de portée');
A(r.ledgeLarge,'faoFloorInZone : fond à 7,0000003 reconnu (tolérance du millième)');
if(ko){console.log('ÉCHEC : '+ko);process.exit(1);}
console.log('OK');
