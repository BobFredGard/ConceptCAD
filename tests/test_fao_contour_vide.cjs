// V0.99.18 : CONTOUR — RAPIDE DANS LE VIDE. Demande : « si la fraise se trouve dans le vide,
// aller au prochain point d'entrée en matière en rapide ». Vide = hors du brut ou matière déjà
// enlevée par les opérations précédentes du posage.
//  1. faoContourTrimAir (matière imposée) : moitié droite vide -> un saut (rapide au-dessus,
//     descente d'1 mm), aucune coupe longue dans le vide, 1 mm de coupe gardé de chaque côté ;
//     tout vide -> passes retirées ; tout plein -> parcours identique ;
//  2. dispatch : Haut au-dessus du brut -> le niveau au-dessus du brut disparaît ; un surfaçage
//     placé avant enlève le niveau suivant ; case décochée -> parcours d'origine ;
//  3. clé : la case et les opérations précédentes changent la clé ; sanitise ; fiche.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const r=vm.runInContext(`(function(){
    const P=[]; const A=(ok,m)=>P.push((ok?'OK   ':'ECHEC')+' : '+m);
    const mkBox=function(x0,x1,y0,y1,z0,z1){return {v:[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],t:[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]};};
    const merge=function(){const o={v:[],t:[]};for(let a=0;a<arguments.length;a++){const B=arguments[a],off=o.v.length;o.v=o.v.concat(B.v);o.t=o.t.concat(B.t.map(function(t){return [t[0]+off,t[1]+off,t[2]+off];}));}return o;};
    const BOSS=merge(mkBox(0,100,0,60,0,5),mkBox(30,70,20,40,5,20));
    const loopB=[[30,20],[70,20],[70,40],[30,40],[30,20]];
    const o={toolD:6,secu:30,ztop:20,zbot:5,ap:6,ae:2.4,nR:2,fin:0.2,sens:'climb',overlap:1};
    const mv=faoGenContourProfil(BOSS,loopB,o);
    const cutLen=function(m,pred){let L=0;for(let i=1;i<m.length;i++){const a=m[i-1],b=m[i];if(b.r)continue;
      const l=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(l/0.25));
      for(let k=0;k<n;k++){const t=(k+0.5)/n;if(pred(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t))L+=l/n;}}return L;};
    // --- 1. matière seulement à gauche de x = 50
    const matL=function(x,y,z){return x<50;};
    const t1=faoContourTrimAir(mv,matL,6);
    const airBefore=cutLen(mv,function(x){return x>=52;}),airAfter=cutLen(t1,function(x){return x>=52;});
    P.push('coupe dans le vide (x >= 52) : '+airBefore.toFixed(0)+' -> '+airAfter.toFixed(1)+' mm, '+JSON.stringify(t1.vide));
    A(airBefore>200&&airAfter<1e-6,'moitié vide : plus aucune coupe au-delà de la marge');
    A(t1.vide&&t1.vide.sauts>=4,'moitié vide : un saut par passe ('+(t1.vide&&t1.vide.sauts)+')');
    A(cutLen(t1,function(x){return x>=50&&x<51.6;})>1,'1 mm de coupe gardé après la matière');
    A(Math.abs(cutLen(t1,function(x){return x<49;})-cutLen(mv,function(x){return x<49;}))<1e-6,'coupe dans la matière inchangée');
    // chaque saut : rapide à z+1 puis descente en avance d'1 mm au même point
    let okJ=0,badJ=0;for(let i=1;i+1<t1.length;i++){const m=t1[i];if(m.r&&!t1[i-1].r&&t1[i+1]&&!t1[i+1].r){const n=t1[i+1];
      if(Math.abs(n.x-m.x)<1e-9&&Math.abs(n.y-m.y)<1e-9&&Math.abs(m.z-n.z-1)<1e-6&&n.ent)okJ++;else badJ++;}}
    A(okJ>=4&&badJ===0,'sauts : rapide au-dessus du point d\\'entrée, descente d\\'1 mm ('+okJ+' / '+badJ+' faux)');
    const t0=faoContourTrimAir(mv,function(){return false;},6);
    A(t0.filter(m=>!m.r).length===0&&t0.vide.passes>0,'tout vide : aucune coupe ('+t0.vide.passes+' passes retirées)');
    const tP=faoContourTrimAir(mv,function(){return true;},6);
    A(tP.length===mv.length&&tP.every(function(m,i){return m===mv[i];}),'tout plein : parcours identique');
    A(t1.diag===mv.diag,'diag conservé');
    // --- 2. dispatch avec le brut du posage et un surfaçage placé avant
    const keepAM=faoActiveMesh;faoActiveMesh=function(){return {mesh:BOSS,box:{x0:0,y0:0,x1:100,y1:60}};};
    // corps factice (clé du parcours : empreinte du solide)
    const arr=[];BOSS.t.forEach(function(t){t.forEach(function(k){arr.push(BOSS.v[k][0],BOSS.v[k][1],BOSS.v[k][2]);});});
    bodies.length=0;
    bodies.push({id:'b1',kind:'import',visible:true,mesh:{visible:true,matrixWorld:null,geometry:{attributes:{position:{array:Float32Array.from(arr),count:arr.length/3}},index:null}}});
    try{
      const s=faoDefaultSetup();s.name='VIDE';
      s.stock={x0:0,y0:0,z0:0,x1:100,y1:60,z1:20};
      s.tools=[{id:'T1',num:1,name:'D6',kind:'flat',d:6,cornerR:0,flutes:3,vc:250,fz:0.04},
               {id:'T3',num:3,name:'D50',kind:'flat',d:50,cornerR:0,flutes:5,vc:250,fz:0.1}];
      const c=faoOpDefaults('contour');c.id='c1';c.on=true;c.toolId='T1';
      c.limit={mode:'chain',loop:loopB,closed:true,nEdges:4,tangent:true,side:'center',extra:0};
      c.ztop=30;c.zbot=5;c.ap=6;c.nR=1;c.fin=0;c.radial=0;c.axial=0;
      s.ops=[c];doc.fao={setups:[s],activeSetupId:s.id};faoSanitiseOps(s);
      const lv=function(m){const z={};m.filter(q=>!q.r&&!q.ent).forEach(q=>{z[q.z.toFixed(2)]=1;});return Object.keys(z).sort().join(' ');};
      const mA=faoOpMoves(c,s),kA=faoOpMovesKey(c,s);
      P.push('brut seul : niveaux '+lv(mA)+' '+JSON.stringify(c.geoDiag&&c.geoDiag.vide));
      c.sautVide=false;faoSanitiseOps(s);
      const mO=faoOpMoves(c,s),kO=faoOpMovesKey(c,s);
      P.push('case décochée : niveaux '+lv(mO));
      A(c.sautVide===false,'sanitise : case décochée gardée');
      A(/24\\.00/.test(lv(mO))&&!/24\\.00/.test(lv(mA)),'au-dessus du brut (z 24) : passe retirée');
      A(/18\\.00/.test(lv(mA))&&/12\\.00/.test(lv(mA))&&/5\\.00/.test(lv(mA)),'niveaux dans le brut gardés');
      A(kA!==kO,'clé : la case change la clé');
      delete c.sautVide;
      const f={id:'f1',on:true,toolId:'T3',type:'facing',z:14,ae:30,radial:0,axial:0};
      s.ops=[f,c];faoSanitiseOps(s);
      const mF=faoOpMoves(c,s),kF=faoOpMovesKey(c,s);
      P.push('après surfaçage à 14 : niveaux '+lv(mF));
      A(!/18\\.00/.test(lv(mF))&&/12\\.00/.test(lv(mF)),'surfaçage avant : le niveau 18 (déjà vidé) disparaît, 12 reste');
      A(kF!==kA,'clé : une opération placée avant change la clé');
      f.z=10;const kF2=faoOpMovesKey(c,s);
      A(kF2!==kF,'clé : modifier l\\'opération précédente met le contour à régénérer');
      // contour sur un autre type : champ purgé
      const q={id:'q',type:'pocket',sautVide:false};faoSanitiseOps({ops:[q]});
      A(!('sautVide' in q),'sanitise : hors contour purgé');
      const all=function(root){const out=[];(function w(n){out.push(n);(n.children||[]).forEach(w);})(root);return out;};
      const card=faoOpCardElement(s,c,1);
      A(/Rapide dans le vide/.test(all(card).map(n=>String(n.textContent||'')).join('|')),'fiche : case « Rapide dans le vide »');
    }finally{faoActiveMesh=keepAM;}
    return P.join('\\n');
  })()`,ctx);
  console.log(r);
  const ko=(r.match(/ECHEC/g)||[]).length;
  console.log(ko?'ECHECS : '+ko:'TOUT EST CONFORME');
  process.exit(ko?1:0);
})().catch(e=>{console.log('FATAL',e&&e.stack||e);process.exit(1);});
