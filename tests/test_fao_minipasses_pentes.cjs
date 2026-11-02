// Ébauche 3D — mini-passes « seulement sur les pentes » (V0.38.0).
// Îlot 60×40×18 : trois flancs verticaux, le flanc +X en dépouille (dessus
// x=70, pied x=80). Mode 'pentes' : les mini-passes ne gardent que les
// morceaux de paroi où le niveau du dessous a laissé une marche (flanc +X) ;
// mode partout : inchangé (champ absent = 'partout').
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    // îlot : bas 20..80 × 20..60, haut 20..70 × 20..60 (flanc +X incliné)
    "const IL={v:[[20,20,0],[80,20,0],[80,60,0],[20,60,0],[20,20,18],[70,20,18],[70,60,18],[20,60,18]],",
    " t:[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]};",
    "const BX={x0:-5,y0:-5,x1:105,y1:85};",
    "const O={ap:6,ae:6,toolD:10,radial:0.5,axial:0,secu:45,strategy:'adaptive',minipasses:2};",
    "const gen=function(x){return faoGenRough3D(IL,BX,18,0,Object.assign({},O,x));};",
    "const lv={12:1,6:1,0:1};",
    "const mz={16:1,14:1,10:1,8:1,4:1,2:1};",
    // point de mini-passe = coupe horizontale à une cote de mini-passe (le
    // point d'approche d'un niveau principal, à niveau + 2, en est exclu)
    "const minis=function(ms){return ms.filter((m,i)=>i>0&&!m.r&&!m.ent&&!ms[i-1].r&&Math.abs(ms[i-1].z-m.z)<1e-6&&mz[Math.round(m.z*1000)/1000]);};",
    "const lenMini=function(ms){let L=0;for(let i=1;i<ms.length;i++){const a=ms[i-1],b=ms[i];if(!b.r&&!a.r&&!b.ent&&Math.abs(a.z-b.z)<1e-6&&mz[Math.round(b.z*1000)/1000])L+=Math.hypot(b.x-a.x,b.y-a.y);}return L;};",
    // --- mode partout : absent = 'partout' (même tracé), mini-passes sur les 4 flancs
    "const mA=gen({}),mB=gen({minipassesMode:'partout'});",
    "att(JSON.stringify(mA)===JSON.stringify(mB),'partout : champ absent et partout donnent le même tracé');",
    "const nA=minis(mA);",
    "att(nA.some(m=>m.x<20),'partout : mini-passes le long du flanc vertical -X ('+nA.filter(m=>m.x<20).length+')');",
    // --- mode pentes
    "const mP=gen({minipassesMode:'pentes'});",
    "const nP=minis(mP);",
    "p('mini-passes : partout '+nA.length+' points / '+lenMini(mA).toFixed(0)+' mm ; pentes '+nP.length+' points / '+lenMini(mP).toFixed(0)+' mm');",
    "att(nP.length>0,'pentes : des mini-passes restent sur le flanc incliné');",
    // tout point de mini-passe est au droit du flanc incliné (x ≥ 70) — les
    // coins le touchent, les flancs verticaux -X, ±Y (x < 70) jamais
    "att(nP.every(m=>m.x>=69),'pentes : aucun point au droit des flancs verticaux (x min '+Math.min.apply(null,nP.map(m=>m.x)).toFixed(2)+')');",
    // au droit de la paroi inclinée À SA COTE (x paroi = 80 − 10·z/18) : les
    // coins s'enroulent autour d'elle, jamais le long des flancs ±Y
    "att(nP.every(m=>m.x>=80-10*m.z/18-0.1),'pentes : chaque point au droit de la paroi inclinée à sa cote');",
    "att(nP.some(m=>m.x>=80-10*m.z/18+5.4),'pentes : contour de la paroi inclinée à r = 5,5');",
    "att(lenMini(mP)<0.5*lenMini(mA),'pentes : longueur de mini-passes au moins divisée par deux');",
    // chaque cote de mini-passe (16,14,10,8,4,2) est présente au flanc incliné
    "[16,14,10,8,4,2].forEach(function(zz){att(nP.some(m=>Math.abs(m.z-zz)<1e-6),'pentes : mini-passe à z='+zz);});",
    // niveaux principaux identiques dans les deux modes
    "const lvl=function(ms){return JSON.stringify(ms.filter(m=>!m.r&&lv[Math.round(m.z*1000)/1000]).map(m=>[m.x,m.y,m.z]));};",
    "att(lvl(mA)===lvl(mP),'pentes : niveaux principaux inchangés');",
    // aucun gouge : outil (r = 5 + 0,5) à distance de l'îlot à chaque cote
    "att(mP.filter(m=>!m.r).every(m=>faoDiscClear(faoSliceZ(IL,Math.max(0,m.z)),m.x,m.y,0,5.49)),'pentes : aucun point dans la matière (r 5,5)');",
    // --- sans pente : îlot droit -> aucune mini-passe en mode pentes
    "const DR={v:[[20,20,0],[80,20,0],[80,60,0],[20,60,0],[20,20,18],[80,20,18],[80,60,18],[20,60,18]],t:IL.t};",
    "const mD=faoGenRough3D(DR,BX,18,0,Object.assign({},O,{minipassesMode:'pentes'}));",
    "att(minis(mD).length===0,'îlot droit : aucune mini-passe en mode pentes ('+minis(mD).length+')');",
    "att(minis(faoGenRough3D(DR,BX,18,0,O)).length>0,'îlot droit : mini-passes en mode partout');",
    // --- outil torique D10 R2 (V0.38.0, tranche 2) : mêmes zones gardées
    "const OT=Object.assign({},O,{kind:'bull',cornerR:2});",
    "const tA=faoGenRough3D(IL,BX,18,0,OT),tB=faoGenRough3D(IL,BX,18,0,Object.assign({},OT,{minipassesMode:'partout'}));",
    "att(JSON.stringify(tA)===JSON.stringify(tB),'torique partout : champ absent et partout donnent le même tracé');",
    "const tP=faoGenRough3D(IL,BX,18,0,Object.assign({},OT,{minipassesMode:'pentes'}));",
    "const nTA=minis(tA),nTP=minis(tP);",
    "p('torique : partout '+nTA.length+' points / '+lenMini(tA).toFixed(0)+' mm ; pentes '+nTP.length+' points / '+lenMini(tP).toFixed(0)+' mm');",
    "att(nTA.some(m=>m.x<20),'torique partout : mini-passes le long du flanc vertical -X');",
    "att(nTP.length>0,'torique pentes : des mini-passes restent sur le flanc incliné');",
    // tore : s'enroule sur l'arête haute de la pente (x 70 à z 18) — tolérance 0,5
    "att(nTP.every(m=>m.x>=80-10*m.z/18-0.5),'torique pentes : chaque point au droit de la paroi inclinée (x min '+Math.min.apply(null,nTP.map(m=>m.x)).toFixed(2)+')');",
    "att(lenMini(tP)<0.5*lenMini(tA),'torique pentes : longueur de mini-passes au moins divisée par deux');",
    "[16,14,10,8,4,2].forEach(function(zz){att(nTP.some(m=>Math.abs(m.z-zz)<1e-6),'torique pentes : mini-passe à z='+zz);});",
    "const tD=faoGenRough3D(DR,BX,18,0,Object.assign({},OT,{minipassesMode:'pentes'}));",
    "att(minis(tD).length===0,'torique îlot droit : aucune mini-passe en mode pentes ('+minis(tD).length+')');",
    // --- nettoyage et clé de parcours
    "const sj={ops:[{id:'a',type:'rough3d',minipasses:2,minipassesMode:'pentes'},{id:'b',type:'rough3d',minipasses:2,minipassesMode:'xx'},{id:'c',type:'rough3d',minipasses:2,minipassesMode:'partout'}]};",
    "faoSanitiseOps(sj);",
    "att(sj.ops[0].minipassesMode==='pentes','nettoyage : pentes conservé');",
    "att(!('minipassesMode' in sj.ops[1])&&!('minipassesMode' in sj.ops[2]),'nettoyage : autre valeur ou partout -> champ retiré (clé des documents existants inchangée)');",
    "att(JSON.stringify(faoOpSig(sj.ops[0]))!==JSON.stringify(faoOpSig(Object.assign({},sj.ops[0],{minipassesMode:undefined}))),'clé : le mode pentes change la signature de l opération');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}",
    "else p('TOUT EST CONFORME');",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_minipasses_pentes.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.message)||e).slice(0,500));process.exit(1);});
