// FAO — V0.99.88 : plus de pente nulle part, des mm/tour partout (demande de Fred :
// « enlever la pente partout où elle existe, Hélices comprises, et remplacer toutes ces pentes
// par des mm/tour », « tu proposes les valeurs que tu aurais mis en automatique et on peut les
// changer »).
// 1. faoZigzag : allers-retours sur 2·Ø au plus, un aller-retour = un tour qui descend de
//    « tour » au plus, fin exacte au départ à la cote, jamais sous le tracé (finition 3D) ;
// 2. faoRampTour / faoPasTourAuto : valeur proposée (10 % du Ø, 0,5 mini) ou réglage de l'op ;
// 3. poche et contour rectangle : la rampe zigzague sur le 1er côté puis le rectangle repart
//    du coin à la cote ; entrée circulaire du contour : zigzag sur l'arc, arc à plat ;
// 4. hélice (perçage, entrées) : mm/tour proposé ;
// 5. sanitise : rampAng (°) retiré, rampTour borné ; faoEntryCfg ;
// 6. fiche d'entrée : « Rampe : descente / tour » avec la valeur proposée affichée.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    // descente maxi entre deux passages au point de départ (= par aller-retour)
    "const parAR=function(mv,x0,y0,zDep){let zp=zDep,mx=0;mv.forEach(function(m){if(Math.abs(m.x-x0)<1e-6&&Math.abs(m.y-y0)<1e-6){mx=Math.max(mx,zp-m.z);zp=m.z;}});return mx;};",
    // --- 1. faoZigzag
    "const z1=faoZigzag([[0,0],[30,0]],10,0,1,12);",
    "att(z1&&z1.length===20,'zigzag : 10 allers-retours de 1 mm pour 10 mm (vu '+(z1&&z1.length)+' mouvements)');",
    "att(z1&&z1.every(m=>m.ent===1&&!m.r),'zigzag : mouvements de coupe marqués entrée');",
    "att(z1&&Math.max.apply(null,z1.map(m=>m.x))===12,'zigzag : limité à 2·Ø (12 mm sur 30)');",
    "const f1=z1&&z1[z1.length-1];",
    "att(f1&&f1.x===0&&f1.y===0&&f1.z===0,'zigzag : fin au départ, à la cote');",
    "att(z1&&z1.every((m,i)=>i===0||m.z<=z1[i-1].z+1e-9)&&z1.every(m=>m.z>=-1e-9),'zigzag : descente continue, jamais sous la cote');",
    "att(z1&&Math.abs(parAR(z1,0,0,10)-1)<1e-6,'zigzag : 1 mm par aller-retour (vu '+(z1&&parAR(z1,0,0,10))+')');",
    "const z2=faoZigzag([[0,0],[30,0]],10,0,3,12);",
    "att(z2&&z2.length===8&&parAR(z2,0,0,10)<=3+1e-6,'zigzag : 3 mm/tour maxi sur 10 mm -> 4 allers-retours de 2,5 (vu '+(z2&&z2.length/2)+', '+(z2&&parAR(z2,0,0,10))+')');",
    "att(faoZigzag([[0,0],[0.01,0]],10,0,1,12)===null,'zigzag : trajet trop court -> null (repli de l appelant)');",
    "const z3=faoZigzag([[0,0],[5,0],[5,5],[0,5]],4,0,1,12);",
    "att(z3&&z3.some(m=>m.x===5&&m.y===5)&&Math.max.apply(null,z3.map(m=>m.y))<=5+1e-9&&z3[z3.length-1].x===0&&z3[z3.length-1].y===0,'zigzag : suit une polyligne (coin 5,5) et revient au départ');",
    // profil 3D (finition) : jamais sous le tracé linéaire
    "const z4=faoZigzag([[0,0,5],[10,0,8]],12,5,1,12);",
    "att(z4&&z4.every(m=>m.z>=5+0.3*m.x-1e-6),'zigzag 3D : toujours au-dessus du tracé (5 + 0,3·x)');",
    "att(z4&&z4[z4.length-1].x===0&&z4[z4.length-1].z===5,'zigzag 3D : fin au début de chaîne, à sa cote');",
    // --- 2. valeurs proposées et réglage
    "att(faoPasTourAuto(6)===0.6&&faoPasTourAuto(3)===0.5&&faoPasTourAuto(25)===2.5,'proposé : 10 % du Ø, 0,5 mm au moins');",
    "faoEntryCur=null;",
    "att(faoRampTour(10)===1,'rampe sans réglage : valeur proposée');",
    "faoEntryCur={rampTour:0.3};",
    "att(faoRampTour(10)===0.3,'rampe : réglage de l opération suivi');",
    "faoEntryCur=null;",
    // --- 3. poche rectangle (Ø25, 25 -> 20 -> 15) : rampe zigzag sur le 1er côté
    "const gp=faoGenPocket({x0:10,y0:10,x1:90,y1:70},25,15,{toolD:25,secu:30,ap:5,entry:'ramp'});",
    "const ring1=function(mv){const k=mv.findIndex(m=>!m.r&&!m.ent);return mv.slice(0,k);};",
    "const ge=ring1(gp).filter(m=>m.ent&&!m.r&&m.z<25-1e-9);",
    "att(ge.length>=4&&ge.every(m=>Math.abs(m.y-22.5)<1e-9&&m.x>=22.5-1e-9&&m.x<=72.5+1e-9),'poche : rampe sur le 1er côté, 2·Ø au plus (x 22,5..72,5)');",
    "att(parAR(ring1(gp).filter(m=>m.ent&&!m.r),22.5,22.5,25)<=2.5+1e-6,'poche : 2,5 mm par aller-retour au plus (Ø25)');",
    "const gi=gp.findIndex(m=>!m.r&&Math.abs(m.x-22.5)<1e-9&&Math.abs(m.y-22.5)<1e-9&&Math.abs(m.z-20)<1e-9);",
    "att(gi>-1&&gp[gi+1]&&Math.abs(gp[gi+1].x-77.5)<1e-9&&Math.abs(gp[gi+1].z-20)<1e-9,'poche : le rectangle repart du coin à la cote 20');",
    "faoEntryCur={rampTour:1};",
    "const gp1=faoGenPocket({x0:10,y0:10,x1:90,y1:70},25,15,{toolD:25,secu:30,ap:5,entry:'ramp'});",
    "faoEntryCur=null;",
    "const ge1=ring1(gp1).filter(m=>m.ent&&!m.r&&m.z<25-1e-9);",
    "att(ge1.length===10&&parAR(ring1(gp1).filter(m=>m.ent&&!m.r),22.5,22.5,25)<=1+1e-6,'poche : 1 mm/tour réglé -> 5 allers-retours (vu '+ge1.length/2+')');",
    // --- contour rectangle : repli sur le 1er côté, entrée circulaire
    "const gc=faoGenContour({x0:10,y0:10,x1:90,y1:70},5,0,{toolD:10,secu:30,entry:'ramp'});",
    "const gce=gc.filter(m=>m.ent&&!m.r&&m.z<5-1e-9);",
    "att(gce.length===10&&gce.every(m=>Math.abs(m.y-5)<1e-9&&m.x>=5-1e-9&&m.x<=25+1e-9),'contour : zigzag sur le 1er côté (1 mm/tour, x 5..25 ; vu '+gce.length+')');",
    "att(gc.some(m=>!m.r&&Math.abs(m.x-5)<1e-9&&Math.abs(m.y-5)<1e-9&&Math.abs(m.z)<1e-9),'contour : fin au coin, à la cote 0');",
    "const gk=faoGenContour({x0:10,y0:10,x1:90,y1:70},5,0,{toolD:10,secu:30,entry:'circ'});",
    "const ka=gk.filter(m=>m.arc);",
    "att(ka.length===1&&Math.abs(ka[0].z)<1e-9&&Math.abs(ka[0].x-5)<1e-9&&Math.abs(ka[0].y-5)<1e-9,'contour circ : un seul arc, à plat à la cote, vers le coin');",
    "const ki=gk.indexOf(ka[0]),kz=gk.slice(0,ki).filter(m=>m.ent&&!m.r);",
    "att(kz.length>=10&&kz[kz.length-1].z===0&&parAR(kz,kz[kz.length-1].x,kz[kz.length-1].y,5)<=1+1e-6,'contour circ : zigzag sur l arc (1 mm/tour), fin en S à la cote');",
    // --- ébauche 3D, rampe forcée (canal entre deux plots, Ø10) : droite dans l'air, zigzag en matière
    "const mkBox=function(x0,x1,y0,y1,z0,z1){return {v:[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],t:[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]};};",
    "const merge=function(A,B){const off=A.v.length;return {v:A.v.concat(B.v),t:A.t.concat(B.t.map(function(t){return [t[0]+off,t[1]+off,t[2]+off];}))};};",
    "const CN=merge(mkBox(0,20,0,60,0,40),mkBox(80,100,0,60,0,40));",
    "const rn=faoGenRough3D(CN,{x0:-5,y0:-5,x1:105,y1:65},40,30,{ap:10,ae:6,toolD:10,radial:0,axial:0,secu:45,entry:'ramp'});",
    "att(rn[1]&&!rn[1].r&&rn[1].z===30&&rn[1].x===rn[0].x&&rn[1].y===rn[0].y,'ébauche 3D : hors brut (air), descente droite, pas de zigzag');",
    "const ri=rn.findIndex((m,i)=>i>1&&m.ent&&!m.r&&rn[i+1]&&rn[i+1].ent&&rn[i+1].x!==m.x);",
    "const rz=[];for(let i=ri;i<rn.length&&rn[i].ent&&!rn[i].r;i++)rz.push(rn[i]);",
    "const r0=rz[0]||{};",
    "att(rz.length>=20&&rz.every(m=>m.y===r0.y&&Math.abs(m.x-r0.x)<=20+1e-9),'ébauche 3D : zigzag en matière sur 2·Ø au plus (vu '+rz.length+' mouvements)');",
    "att(rz.length&&rz[rz.length-1].x===r0.x&&rz[rz.length-1].z===30&&parAR(rz,r0.x,r0.y,r0.z)<=1+1e-6,'ébauche 3D : 1 mm par aller-retour, fin au départ à la cote 30');",
    // --- 4. hélices
    "const hx=faoHelixEntry(0,0,10,0,3,10);",
    "const hz=hx.filter(m=>!m.r);",
    "att(hz.length===11*10&&Math.abs(hz[9].z-9)<1e-6,'hélice d entrée Ø10 : 1 mm par tour proposé (10 tours + tour à plat)');",
    "faoEntryCur={helixPas:2.5};",
    "const hx2=faoHelixEntry(0,0,10,0,3,10).filter(m=>!m.r);",
    "faoEntryCur=null;",
    "att(hx2.length===5*10&&Math.abs(hx2[9].z-7.5)<1e-6,'hélice d entrée : 2,5 mm/tour réglé');",
    "att(Math.abs(faoHelixPitch({},2,8)-0.8)<1e-9&&faoHelixPitch({helixP:0.3},2,8)===0.3,'perçage hélice : proposé 10 % du Ø, réglage gardé');",
    // --- 5. sanitise et réglages d'entrée
    "const o1={type:'rough3d',rampAng:5,rampTour:500,expr:{rampAng:'a'},pname:{rampAng:'b'}};",
    "faoSanitiseOps({tools:[{id:'T1',d:10}],ops:[o1]});",
    "att(o1.rampAng===undefined&&!('rampAng' in o1.expr)&&!('rampAng' in o1.pname)&&o1.rampTour===100,'sanitise : angle retiré, mm/tour borné à 100');",
    "const o2={type:'rough3d',rampTour:0};faoSanitiseOps({tools:[{id:'T1',d:10}],ops:[o2]});",
    "att(o2.rampTour===undefined,'sanitise : 0 = valeur proposée (rien de stocké)');",
    "const c1=faoEntryCfg({rampTour:0.4});",
    "att(c1&&c1.rampTour===0.4,'faoEntryCfg : rampTour transmis au calcul');",
    "att(faoEntryCfg({rampAng:5})===null,'faoEntryCfg : plus d angle');",
    // --- 6. fiche : valeurs proposées affichées
    "const all=function(root){const out=[];(function w(n){out.push(n);(n.children||[]).forEach(w);})(root);return out;};",
    "const op3=faoOpDefaults('rough3d');",
    "let card=null;try{card=faoOpCardElement(faoSetup(),op3,0);}catch(e){att(false,'fiche ébauche 3D : exception '+e.message);}",
    "const txt=card?all(card).map(n=>String(n.textContent||'')).join('|'):'';",
    "const t3=faoToolById(faoSetup(),op3.toolId),d3=t3&&+t3.d;",
    "const inp=card?all(card).find(n=>n.tagName==='INPUT'&&/Descente des rampes/.test(String(n.title||''))):null;",
    "att(txt.indexOf('Rampe : descente / tour')>=0,'fiche ébauche 3D : Rampe : descente / tour');",
    "att(txt.indexOf('pente maxi')<0,'fiche ébauche 3D : plus de pente maxi');",
    "att(inp&&+inp.value===+faoPasTourAuto(d3).toFixed(2),'fiche ébauche 3D : valeur proposée affichée ('+(inp&&inp.value)+' pour Ø'+d3+')');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(function(m){p('  x '+m);});}",
    "else p('TOUT EST CONFORME');",
    "return {txt:P.join(String.fromCharCode(10)),ko:ATT.length};"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_rampe_tour.js'});
  console.log(r.txt);
  process.exit(r.ko?1:0);
})().catch(e=>{console.log('FATAL',e&&e.stack||e);process.exit(1);});
