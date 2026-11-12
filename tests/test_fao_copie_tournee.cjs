// V0.96.2 — FAO : copie de la pièce tournée dans le repère du posage (faoShapeToF, 89-fao-posage-repere).
// Elle n'était jamais rendue au noyau : cache vidé au-delà de 6 entrées, ou entrée remplacée, sans
// libérer. Contrôles au vrai noyau :
//  1. même solide, même repère : la même copie est resservie ;
//  2. même solide, autre repère : l'ancienne copie est rendue ;
//  3. solide disparu (rejeu) : sa copie est rendue au prochain appel ;
//  4. dix solides vivants demandés d'affilée : aucune copie rendue (l'appelant les tient encore) ;
//  5. la copie est bien la pièce tournée (même volume, boîte tournée).
'use strict';
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const r=vm.runInContext(String.raw`(()=>{
    const o={};
    const boite=(dx,dy,dz)=>{const m=new occt.BRepPrimAPI_MakeBox_2(dx,dy,dz);const s=m.Shape();m.delete();return s;};
    const vol=sh=>{const G=new occt.GProp_GProps_1();try{occt.BRepGProp.VolumeProperties_1(sh,G,false,false,false);return G.Mass();}finally{G.delete();}};
    const F1={X:[1,0,0],Y:[0,0,1],Z:[0,-1,0],O:[0,0,0]},F2={X:[0,1,0],Y:[-1,0,0],Z:[0,0,1],O:[5,0,0]};
    const mort=s=>{try{return s.isDeleted();}catch(e){return true;}};
    const a=boite(10,20,30);
    const s1=faoShapeToF(a,F1),s1b=faoShapeToF(a,F1);
    o.meme=s1===s1b&&s1!==a;
    o.volume=Math.abs(vol(s1)-6000)<1e-6;
    const bx=occSolidBox(s1);o.tournee=!!bx&&Math.abs(bx.c[1]-15)<1e-3&&Math.abs(bx.c[2]+10)<1e-3; // y' = z, z' = -y
    const s2=faoShapeToF(a,F2);
    o.autreRepere=mort(s1)&&!mort(s2)&&s2!==s1;
    const b=boite(5,5,5);
    a.delete();
    const sb=faoShapeToF(b,F1);
    o.disparu=mort(s2)&&!mort(sb);
    const L=[];for(let i=0;i<10;i++)L.push(boite(1+i,2,3));
    const R=L.map(s=>faoShapeToF(s,F1));
    o.vivants=R.every(s=>!mort(s))&&!mort(sb)&&new Set(R).size===10;
    o.taille=faoShapeFCache.size;
    L.forEach(s=>s.delete());b.delete();
    const c=boite(2,2,2);const sc=faoShapeToF(c,F1);
    o.menage=R.every(mort)&&mort(sb)&&!mort(sc)&&faoShapeFCache.size===1;
    o.sansRepere=faoShapeToF(c,null)===c&&faoShapeToF(c,{id:1,X:[1,0,0],Z:[0,0,1]})===c;
    return o;
  })()`,ctx);
  console.log('=== FAO : copie tournée de la pièce rendue au noyau ===');
  A(r.meme,'même solide, même repère : la même copie est resservie');
  A(r.volume&&r.tournee,'la copie est la pièce tournée (même volume, boîte tournée)');
  A(r.autreRepere,'même solide, autre repère : l’ancienne copie est rendue');
  A(r.disparu,'solide disparu : sa copie est rendue au prochain appel');
  A(r.vivants,'dix solides vivants d’affilée : aucune copie rendue ('+r.taille+' gardées)');
  A(r.menage,'ces solides disparus : toutes leurs copies sont rendues');
  A(r.sansRepere,'sans repère, ou repère d’origine : le solide lui-même, sans copie');
  if(ko){console.log('ÉCHEC : '+ko);process.exit(1);}
  console.log('OK');
})().catch(e=>{console.error(e);process.exit(1);});
