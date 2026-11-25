// FAO — V0.99.96, retours de Fred sur Renfort.conceptcad (1ers usinages) :
// 1. congés en G2 / G3 (src/89-fao-arcs.js) : arcs retrouvés dans la chaîne, re-découpés sur le
//    vrai cercle, passes du Contour / Chanfrein en blocs circulaires exacts ;
// 2. chanfrein : Ø de pointe 0 (pointe vive) accepté, Z au bout de l'outil, clé de parcours qui
//    suit l'angle et le Ø de pointe ;
// 3. perçage en fraisage hélicoïdal : « Parois » (matière laissée pour la finition de l'alésage) ;
// 4. correction de Ø des fraises cylindriques / toriques, dans l'outil et dans l'opération.
// Pur logique (aucun OCCT).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    "const r3=v=>Math.round(v*1000)/1000;",
    // profil de Renfort : 251 × 17, congés R5 en 9 cordes de 10°, points au µm (comme la chaîne d'OCCT)
    "const rr=function(a,b,rc,step){const L=[];const C=[[a-rc,-b+rc,-90],[a-rc,b-rc,0],[-a+rc,b-rc,90],[-a+rc,-b+rc,180]];",
    "  C.forEach(function(c){for(let k=0;k<=90/step;k++){const t=(c[2]+k*step)*Math.PI/180;L.push([r3(c[0]+rc*Math.cos(t)),r3(c[1]+rc*Math.sin(t))]);}});",
    "  L.push(L[0].slice());return L;};",
    "const LOOP=rr(125.5,8.5,5,10);",
    // distance signée au rectangle arrondi (demi-côtés a, b, rayon rc)
    "const sdRR=function(x,y,a,b,rc){const qx=Math.abs(x)-(a-rc),qy=Math.abs(y)-(b-rc);return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-rc;};",
    // points d'un parcours, arcs développés
    "const pts=function(mv,keep){const o=[];let pv=null;mv.forEach(function(m){if(pv&&!m.r&&keep(m)){if(m.arc)faoArcSegs(pv,m).forEach(function(q){o.push(q);});o.push([m.x,m.y,m.z]);}pv=m;});return o;};",
    // --- 1. arcs de la boucle
    "const LA=faoLoopArcs(LOOP);",
    "att(LA&&LA.arcs.length===4,'boucle Renfort : 4 congés retrouvés (vu '+(LA?LA.arcs.length:'-')+')');",
    "att(LA&&LA.arcs.every(A=>Math.abs(A.r-5)<0.002&&Math.abs(Math.abs(A.x)-120.5)<0.002&&Math.abs(Math.abs(A.y)-3.5)<0.002),'congés : R5 centrés à ±120,5 / ±3,5 (2 µm)');",
    "const hexa=[];for(let k=0;k<=6;k++){const t=k*Math.PI/3;hexa.push([r3(20*Math.cos(t)),r3(20*Math.sin(t))]);}",
    "const oct=[];for(let k=0;k<=8;k++){const t=k*Math.PI/4;oct.push([r3(20*Math.cos(t)),r3(20*Math.sin(t))]);}",
    "att(!faoLoopArcs(hexa).arcs.length&&!faoLoopArcs(oct).arcs.length,'hexagone, octogone : sommets sur un cercle mais pas des arcs');",
    "const circ=[];for(let k=0;k<=40;k++){const t=k*Math.PI/20;circ.push([r3(115.5+6.5*Math.cos(t)),r3(6.5*Math.sin(t))]);}",
    "const LC=faoLoopArcs(circ);",
    "att(LC&&LC.arcs.length===1&&LC.arcs[0].b-LC.arcs[0].a===40&&Math.abs(LC.arcs[0].r-6.5)<0.002,'trou Ø13 : un seul arc de 360°');",
    "const DA=faoLoopArcDense(LOOP);",
    "let dev=0;DA.loop.forEach(q=>{dev=Math.max(dev,Math.abs(sdRR(q[0],q[1],125.5,8.5,5)));});",
    "att(DA.arcs===4&&DA.loop.length>300&&dev<0.002,'boucle re-découpée sur le vrai cercle ('+DA.loop.length+' points, écart '+dev.toFixed(4)+')');",
    "att(DA.centers.filter(c=>c.r>0).length===4,'centres des 4 congés gardés');",
    "const DR=faoLoopArcDense([[0,0],[50,0],[50,30],[0,30],[0,0]]);",
    "att(DR.arcs===0&&DR.loop.length===5&&DR.centers.length===4,'rectangle : boucle inchangée, 4 coins vifs (centres des arrondis du décalage)');",
    // --- 2. contour de l'opération 3 (fraise D10) : G2 / G3
    "const mk=function(){const j=faoDefaultJob();j.name='Arcs';j.machine='fagor8065';j.stock={x0:-130,y0:-12,z0:-20,x1:130,y1:12,z1:1};",
    "  j.tools=[{id:'T1',num:1,name:'Fraise D10',kind:'flat',d:10,cornerR:0,flutes:4,vc:250,fz:0.03},",
    "    {id:'T2',num:2,name:'Ch 6',kind:'chamfer',d:6,ang:90,dt:0.5,cornerR:0,flutes:2,vc:150,fz:0.05},",
    "    {id:'T3',num:3,name:'D8',kind:'flat',d:8,cornerR:0,flutes:4,vc:200,fz:0.03},",
    "    {id:'T4',num:4,name:'Torique D25 R2',kind:'bull',d:25,cornerR:2,flutes:3,vc:600,fz:0.2}];",
    "  j.ops=[{id:'c1',type:'contour',strat:'profil',toolId:'T1',limit:{mode:'chain',loop:LOOP,closed:true,nEdges:8},",
    "    ztop:0.5,zbot:-10,ap:10,ae:2,nR:1,fin:0,cside:'ext',sens:'avalant',overlap:1,sautVide:false,radial:0,axial:0}];return j;};",
    "const J=mk(),C1=J.ops[0];",
    "const mv=faoOpMoves(C1,J);",
    "const arcs=mv.filter(m=>m.arc),g1=mv.filter(m=>!m.r&&!m.arc);",
    "p('contour : '+mv.length+' mouvements, '+arcs.length+' arcs, '+g1.length+' G1');",
    // 2 niveaux (−9,5 et −10) : entrée G3, 4 congés G2, 4 côtés G1, sortie G3 ; G1 restants = plongées
    // (V0.99.97 : entre les niveaux, la fraise reste en bas — retour à plat + plongée sur place)
    "const lv=mv.filter(m=>!m.r&&!m.arc&&!m.ent).length,pl=g1.filter(m=>m.ent&&!m.stay).length+(g1.some(m=>m.stay)?1:0);",
    "att(arcs.length>=12&&arcs.length<=14&&lv===8&&pl===2,'contour : par niveau entrée G3 + 4 congés G2 + sortie G3 (+ recouvrement), seuls les 4 côtés en G1 (vu '+arcs.length+' arcs, '+lv+' G1 de côté, '+pl+' plongées)');",
    "const rad={};let pv=null,badR=0;mv.forEach(m=>{if(m.arc&&pv){const r=Math.hypot(m.arc.i,m.arc.j),re=Math.hypot(pv.x+m.arc.i-m.x,pv.y+m.arc.j-m.y);rad[r.toFixed(3)]=1;if(Math.abs(r-re)>0.001)badR++;}pv=m;});",
    "att(rad['10.000']&&badR===0,'congés : G2 de rayon 10 (R5 + rayon de fraise), même rayon au départ et à l’arrivée (rayons '+Object.keys(rad).join(' ')+')');",
    "const fond=pts(mv,m=>!m.ent&&Math.abs(m.z+10)<1e-6);",
    "let e0=1/0,e1=-1/0;fond.forEach(q=>{const d=sdRR(q[0],q[1],125.5,8.5,5);if(d<e0)e0=d;if(d>e1)e1=d;});",
    "att(fond.length>50&&e0>5-0.003&&e1<5+0.003,'passe au fond : à 5 mm du vrai profil partout, congés compris ('+e0.toFixed(4)+' à '+e1.toFixed(4)+' ; avant : 4,981 dans les congés)');",
    "const code=faoPost(J).code,L=code.split(String.fromCharCode(10));",
    "att(L.filter(l=>/ G2 X/.test(l)).length>=4&&L.some(l=>/ G3 X/.test(l))&&L.some(l=>/ G2 X.* I-?[0-9.]+ J-?[0-9.]+/.test(l)),'G-code : congés en G2, entrée / sortie en G3, centre en I J');",
    // descente en pente : hélice le long du profil (Z linéaire dans les arcs)
    "const J2=mk();Object.assign(J2.ops[0],{descente:'pente',penteTour:2});",
    "const mv2=faoOpMoves(J2.ops[0],J2);let hel=0;pv=null;mv2.forEach(m=>{if(m.arc&&pv&&Math.abs(m.z-pv.z)>1e-4)hel++;pv=m;});",
    "att(hel>=4,'descente en pente : congés en arcs hélicoïdaux (Z qui descend dans le bloc), vu '+hel);",
    // documents : clé de parcours marquée pour les profils (recalcul des anciens tracés)
    "att(String(faoOpMovesKey(C1,J)||'arcs-g2g3').indexOf('arcs-g2g3')>=0,'clé de parcours du contour marquée arcs-g2g3');",
    // --- 3. chanfrein
    "const J3=mk();J3.ops=[{id:'h1',type:'chamfer',toolId:'T2',limit:{mode:'chain',loop:LOOP,closed:true,nEdges:8},w:0.3,tipOff:1,z:0,cside:'ext',sens:'avalant',overlap:1}];",
    "const CH=J3.ops[0],T2=J3.tools[1];",
    "const G1=faoChamferGeom(CH,T2);",
    "att(Math.abs(G1.d-1.25)<1e-9&&Math.abs(G1.zTip+1.3)<1e-9,'chanfrein 0,3, décalage 1, pointe Ø0,5 : axe à 1,25 de l’arête, bout de l’outil à Z −1,3');",
    "const mc=faoOpMoves(CH,J3);const rc={};pv=null;mc.forEach(m=>{if(m.arc&&pv)rc[Math.hypot(m.arc.i,m.arc.j).toFixed(3)]=1;pv=m;});",
    "att(rc['6.250'],'chanfrein : congés en arcs R6,25 (vu '+Object.keys(rc).join(' ')+')');",
    "const k0=JSON.stringify(faoToolKeyObj(T2));T2.dt=0;const k1=JSON.stringify(faoToolKeyObj(T2));",
    "const G2=faoChamferGeom(CH,T2);",
    "att(Math.abs(G2.d-1)<1e-9&&k0!==k1&&/\"dt\":0/.test(k1)&&/\"ang\":90/.test(k1),'pointe vive : axe à 1,00, clé d’outil changée (dt, angle) — le chanfrein est recalculé');",
    "const mc0=faoOpMoves(CH,J3);const rc0={};pv=null;mc0.forEach(m=>{if(m.arc&&pv)rc0[Math.hypot(m.arc.i,m.arc.j).toFixed(3)]=1;pv=m;});",
    "att(rc0['6.000'],'pointe vive : arcs R6 (vu '+Object.keys(rc0).join(' ')+')');",
    // fiche du chanfrein : Ø de pointe modifiable, 0 accepté, avertissement si méplat
    "const find=function(n,f){if(f(n))return n;const c=n.children||[];for(let i=0;i<c.length;i++){const r=find(c[i],f);if(r)return r;}return null;};",
    "const txt=function(n){let s=n.textContent||'';(n.children||[]).forEach(c=>{s+=' '+txt(c);});return s;};",
    "T2.dt=0.5;let dv=document.createElement('div');faoChamferRows(dv,J3,CH);",
    "att(/BOUT de l’outil/.test(txt(dv))&&/ne ferait que 0\\.05 mm au lieu de 0\\.30/.test(txt(dv)),'fiche : Z au bout de l’outil, pointe vive = 0,05 au lieu de 0,30');",
    "const iP=find(dv,n=>n.title&&/méplat au bout de la fraise à chanfreiner/.test(n.title));",
    "if(iP){iP.value='0';iP.onchange();}",
    "att(iP&&T2.dt===0,'fiche : Ø de pointe 0 accepté (vu '+(iP?T2.dt:'champ absent')+')');",
    "dv=document.createElement('div');faoChamferRows(dv,J3,CH);",
    "att(/pointe vive/.test(txt(dv))&&!/ne ferait que/.test(txt(dv)),'pointe vive : plus d’avertissement');",
    // fiche outil : le champ « Ø de pointe » accepte 0
    "T2.dt=0.5;faoToolSelId='T2';",
    "const fe=faoToolsElement(J3);",
    "const lT=find(fe,n=>n.title&&/0 = pointe vive/.test(n.title)),iT=lT&&find(lT,n=>typeof n.onchange==='function');",
    "if(iT){iT.value='0';try{iT.onchange();}catch(e){}}",
    "att(iT&&T2.dt===0,'fiche outil : Ø de pointe 0 accepté (vu '+(iT?T2.dt:'champ absent')+')');",
    // --- 4. perçage hélicoïdal : Parois
    "const J4=mk();J4.ops=[{id:'d1',type:'drill',cycle:'helix',src:'model',toolId:'T3',holeSel:[{d:13,z:0}],",
    "  holes:[{x:0,y:0,d:13,ztop:0,zbot:-8,zSurf:0,through:false,tipAng:0,chD:0}],depthMode:'full',ztop:1,zbot:-8,helixP:2,radial:0}];",
    "const DR1=J4.ops[0];",
    "const rH=function(){const a=faoOpMoves(DR1,J4).find(m=>m.arc);return a?Math.hypot(a.arc.i,a.arc.j):null;};",
    "const h0=rH();DR1.radial=0.1;const h1=rH();",
    "att(Math.abs(h0-2.5)<1e-6&&Math.abs(h1-2.4)<1e-6,'hélice Ø13 / D8 : rayon 2,5, Parois 0,1 → 2,4 (vu '+h0+' / '+h1+')');",
    "let dd=document.createElement('div');faoDrillSections(J4,DR1,dd);",
    "att(/laisse 0\\.1 à la paroi \\(fraisé à Ø12\\.8\\)/.test(txt(dd))&&find(dd,n=>n.title&&/Matière laissée sur la paroi du trou/.test(n.title)),'fiche du perçage hélicoïdal : champ Parois, Ø fraisé 12,8');",
    "DR1.cycle='drill';dd=document.createElement('div');faoDrillSections(J4,DR1,dd);",
    "att(!find(dd,n=>n.title&&/Matière laissée sur la paroi du trou/.test(n.title)),'perçage au foret : pas de Parois');",
    "DR1.cycle='helix';",
    // --- 5. correction de Ø
    "const J5=mk(),C5=J5.ops[0],T1=J5.tools[0];",
    "const dist=function(mv){const f=pts(mv,m=>!m.ent&&Math.abs(m.z+10)<1e-6);let a=1/0,b=-1/0;f.forEach(q=>{const d=sdRR(q[0],q[1],125.5,8.5,5);if(d<a)a=d;if(d>b)b=d;});return [a,b];};",
    "const kT0=JSON.stringify(faoToolKeyObj(T1));",
    "T1.dCor=-0.035;",
    "const dA=dist(faoOpMoves(C5,J5));",
    "att(Math.abs(dA[0]-4.9825)<0.003&&Math.abs(dA[1]-4.9825)<0.003,'outil −0,035 : passe à 4,9825 du profil (vu '+dA.map(v=>v.toFixed(4)).join(' à ')+')');",
    "att(JSON.stringify(faoToolKeyObj(T1))!==kT0&&faoToolKeyObj(T1).dCor===-0.035,'clé d’outil : correction comprise');",
    "C5.dCor=0.015;",
    "const dB=dist(faoOpMoves(C5,J5));",
    "att(Math.abs(faoOpDCor(C5,T1)+0.02)<1e-9&&Math.abs(dB[0]-4.99)<0.003,'outil −0,035 + opération +0,015 = −0,02 : passe à 4,99 (vu '+dB[0].toFixed(4)+')');",
    "att(/\\[T1 D10 corr -0\\.02\\]/.test(faoOpLabel(C5,J5)),'libellé et commentaire du programme : [T1 D10 corr -0.02] (vu '+faoOpLabel(C5,J5)+')');",
    "delete T1.dCor;delete C5.dCor;att(!/corr/.test(faoOpLabel(C5,J5))&&JSON.stringify(faoToolKeyObj(T1))===kT0,'sans correction : libellé et clé inchangés');",
    "att(faoOpToolD({dCor:0.05},J5.tools[3])===25.05&&faoOpToolD({dCor:0.05},T2)===6&&faoOpToolD({dCor:0.05},J5.tools[1])===6,'torique : corrigée ; fraise à chanfreiner : jamais');",
    // hélice : la correction de Ø de la fraise compte aussi
    "J4.tools[2].dCor=0.02;const h2=rH();delete J4.tools[2].dCor;",
    "att(Math.abs(h2-2.39)<1e-6,'hélice : Parois 0,1 + fraise +0,02 → rayon 2,39 (vu '+h2+')');",
    // sanitise
    "const sx={ops:[{type:'contour',dCor:'abc'},{type:'contour',dCor:9},{type:'contour',dCor:0}],tools:[{id:'T1',kind:'flat',d:10,dCor:-0.0351234}]};faoSanitiseOps(sx);",
    "att(sx.ops[0].dCor===undefined&&sx.ops[1].dCor===2&&sx.ops[2].dCor===undefined&&sx.tools[0].dCor===-0.0351,'document : correction invalide retirée, bornée à ±2, arrondie au 0,1 µm');",
    // fiches : champ de l'opération (onglet Outil) et de l'outil
    "const so=faoOpToolSection(J5,C5);",
    "const iO=find(so,n=>n.title&&/Correction du Ø pour CETTE opération/.test(n.title));",
    "if(iO){iO.value='-0.01';iO.onchange();}",
    "att(iO&&C5.dCor===-0.01,'onglet Outil : Correction Ø de l’opération saisie (vu '+C5.dCor+')');",
    "att(!find(faoOpToolSection(J3,CH),n=>n.title&&/Correction du Ø pour CETTE opération/.test(n.title)),'opération à la fraise à chanfreiner : pas de correction de Ø');",
    "faoToolSelId='T1';const ft=faoToolsElement(J5);",
    "const lK=find(ft,n=>n.title&&/Vaut pour toutes les opérations de cet outil/.test(n.title)),iK=lK&&find(lK,n=>typeof n.onchange==='function');",
    "if(iK){iK.value='-0.035';try{iK.onchange();}catch(e){}}",
    "att(iK&&T1.dCor===-0.035,'fiche outil : Correction Ø −0,035 saisie (vu '+T1.dCor+')');",
    "if(iK){iK.value='0';try{iK.onchange();}catch(e){}}",
    "att(iK&&T1.dCor===undefined,'fiche outil : 0 retire la correction');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}",
    "else p('TOUT EST CONFORME');",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_arcs_correction.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
