// Outil Polygone de l'esquisse : nombre de côtés + Ø intérieur tangent aux côtés.
// La forme doit rester régulière quand on change le Ø ou qu'on tire un sommet, y compris à nombre
// de côtés pair (« tangents + côtés égaux » y laisserait les sommets alterner).
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const {ctx}=loadApp();
  const R=[
'const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};',
'const mount=id=>{const sk={id,name:"P",plane:"XY",visible:true,points:{O:{x:0,y:0}},entities:[],constraints:[],dims:[],seq:10};ensureSketchBasis(sk);doc.sketches=[sk];doc.features=[];openSketch(id);skView={s:5,cx:0,cy:0};skUpdateTols();$("skSnap").checked=false;return skEdit;};',
'const C=(wx,wy)=>{const r=svg.getBoundingClientRect();const p=w2s(wx,wy);return [r.left+p[0],r.top+p[1]];};',
'const ev=(type,p,ex)=>Object.assign({type,button:0,buttons:0,shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,detail:1,pointerId:1,clientX:p[0],clientY:p[1],preventDefault(){},stopPropagation(){}},ex||{});',
'const down=(x,y)=>svg.dispatchEvent(ev("pointerdown",C(x,y),{buttons:1}));',
'const up=(x,y)=>svg.dispatchEvent(ev("pointerup",C(x,y)));',
'const move=(x,y)=>svg.dispatchEvent(ev("pointermove",C(x,y)));',
'const click=(x,y)=>{down(x,y);up(x,y);};',
// mesure : régularité réelle des points résolus
'const shape=sk=>{const ls=sk.entities.filter(e=>e.t==="line"&&!e.construction&&e.id!=="lx"),cs=sk.entities.filter(e=>e.t==="circle"&&e.construction);',
' const inner=cs[0],c=sk.points[inner.pc],P=sk.points;',
' const lens=ls.map(l=>Math.hypot(P[l.p2].x-P[l.p1].x,P[l.p2].y-P[l.p1].y));',
' const aps=ls.map(l=>{const a=P[l.p1],b=P[l.p2],L=Math.hypot(b.x-a.x,b.y-a.y);return Math.abs((c.x-a.x)*(b.y-a.y)-(c.y-a.y)*(b.x-a.x))/L;});',
' const spread=v=>Math.max(...v)-Math.min(...v);',
' return {n:ls.length,lens,aps,dL:spread(lens),dA:spread(aps),r:inner.r,c,ls};};',
'const regular=(s,n,d)=>skAudit(skEdit).score<1e-3&&s.n===n&&s.dL<1e-3&&s.dA<1e-3&&Math.abs(s.aps[0]-d/2)<1e-3&&Math.abs(s.lens[0]-d*Math.tan(Math.PI/n))<1e-3;',
// création réelle à la souris, Ø imposé
'for(const n of [3,5,6,7,8,12,24]){',
' const sk=mount("n"+n);skPoly.n=n;skPoly.d=40;skTool="polygon";',
' click(10,5);A(skDown&&!sk.entities.length,n+" côtés : le 1er clic pose seulement le centre");',
' move(10,30);click(10,30);',
' let s=shape(sk);A(regular(s,n,40),n+" côtés créés : réguliers, Ø intérieur 40 tangent à chaque côté");',
' A(sk.dims.length===1&&sk.dims[0].type==="diameter"&&sk.dims[0].value===40&&!sk.dims[0].ref,n+" côtés : une cote Ø 40, pilotante");',
' A(sk.constraints.filter(c=>c.type==="tangent").length===n,n+" côtés : "+n+" tangences au cercle intérieur");',
' A(sk.constraints.some(c=>c.type==="h"&&c.line===s.ls[0].id),n+" côtés : orienté vers le haut, le 1er côté est horizontal");',
' let I=skDofInfo(sk);A(I.dof===2,n+" côtés : seul le centre reste libre ("+I.dof+" DDL)");',
' sk.dims[0].value=90;A(skSolveOrRevert(sk,"Cote")!==false,n+" côtés : Ø 90 accepté");s=shape(sk);',
' A(regular(s,n,90),n+" côtés : Ø 40 → 90, forme toujours régulière (écart "+s.dL.toExponential(1)+")");',
' A(Math.hypot(s.c.x-10,s.c.y-5)<1e-6,n+" côtés : centre libre, le Ø grandit autour de lui sans le déplacer");',
' sk.dims[0].value=12;skSolveOrRevert(sk,"Cote");s=shape(sk);A(regular(s,n,12),n+" côtés : Ø 90 → 12, toujours régulière");',
'}',
// côté pair, orientation libre : tirer un sommet ne fait pas alterner les sommets
'{const sk=mount("t");skPoly.n=6;skPoly.d=40;skTool="polygon";click(0,0);const a=0.31,q=[30*Math.cos(a),30*Math.sin(a)];move(q[0],q[1]);click(q[0],q[1]);',
' A(!sk.constraints.some(c=>c.type==="h"||c.type==="v"),"orientation libre : ni H ni V");',
' A(skDofInfo(sk).dof===1,"orientation libre : rotation libre seule, le centre est sur l\\u2019origine ("+skDofInfo(sk).dof+" DDL)");',
' const l=shape(sk).ls[0],p=sk.points[l.p1];skTool="select";const w0=[p.x,p.y];down(w0[0],w0[1]);for(let k=1;k<=8;k++)move(w0[0]+k,w0[1]+k*1.5);up(w0[0]+8,w0[1]+12);',
' const s=shape(sk);A(regular(s,6,40),"6 pans : tirer un sommet garde la forme régulière (écart "+s.dL.toExponential(1)+" mm)");}',
// Ø à la souris + aimantation d'angle
'{const sk=mount("m");skPoly.n=5;skPoly.d=null;skTool="polygon";click(0,0);A(!sk.entities.length,"Ø à la souris : le 1er clic ne crée rien");',
' move(0,20);A(skDraft&&skDraft.t==="polygon"&&Math.abs(skDraft.r-20)<1e-6,"Ø à la souris : aperçu vivant, rayon intérieur = distance au curseur");drawSketch2D();',
' click(0.5,20);const s=shape(sk);A(s.n===5&&s.dL<1e-3&&Math.abs(s.aps[0]-sk.dims[0].value/2)<1e-3,"Ø à la souris : pentagone régulier, cote Ø = "+sk.dims[0].value);',
' A(sk.constraints.some(c=>c.type==="h"),"aimantation : curseur à 1,4° de la verticale → côté à plat");}',
// centre sur l'origine : plus rien de libre, et le Ø grandit exactement autour du centre
'for(const n of [5,6]){const sk=mount("o"+n);skPoly.n=n;skPoly.d=40;skTool="polygon";click(0,0);move(0,30);click(0,30);',
' const I=skDofInfo(sk);A(I.dof===0&&sk.entities.every(e=>I.entFull(e)),n+" côtés sur l\\u2019origine, côté à plat : 0 DDL, tout blanc ("+I.dof+")");',
' sk.dims[0].value=70;skSolveOrRevert(sk,"Cote");const s=shape(sk);A(regular(s,n,70)&&Math.hypot(s.c.x,s.c.y)<1e-9,n+" côtés sur l\\u2019origine : Ø 70, centre inchangé");}',
// sur-contrainte : une cote de côté en plus devient une référence
'{const sk=mount("r");skPoly.n=6;skPoly.d=40;skTool="polygon";click(0,0);move(0,30);click(0,30);const l=shape(sk).ls[0];',
' sk.dims.push({id:"x",type:"length",line:l.id,value:99,ox:0,oy:0});afterEdit();const x=sk.dims.find(d=>d.id==="x");',
' A(x.ref===true,"cote de côté en plus : elle devient une RÉFÉRENCE");A(regular(shape(sk),6,40),"… et le 6 pans ne bouge pas");}',
// 1re cote de l'esquisse : pas de mise à l'échelle générale, la ligne voisine reste en place
'{const sk=mount("e");skPoly.n=5;skPoly.d=30;skTool="polygon";click(-30,-10);move(-30,20);click(-30,20);',
' const a=addPoint(sk,40,0),b=addPoint(sk,60,0);sk.entities.push({id:"lx",t:"line",p1:a,p2:b});',
' const d=sk.dims[0];A(skFirstDimScale(sk,d,60)===false,"Ø d\\u2019un polygone : l\\u2019esquisse entière n\\u2019est pas mise à l\\u2019échelle");',
' d.value=60;skSolveOrRevert(sk,"Cote");const s=shape(sk);A(regular(s,5,60)&&Math.hypot(s.c.x+30,s.c.y+10)<1e-6,"… le pentagone grandit autour de son centre");',
' A(sk.points[b].x===60,"… et la ligne voisine ne bouge pas");}',
// clavier : Entrée valide, Échap annule, une seule annulation retire tout
'{const sk=mount("k");skPoly.n=8;skPoly.d=30;skTool="polygon";click(5,5);A(skPolyEnter()===true,"Entrée : valide après le centre");',
' const s=shape(sk);A(regular(s,8,30)&&sk.constraints.some(c=>c.type==="h"),"Entrée : octogone Ø 30, côté à plat en haut");',
' const n0=sk.entities.length;A(n0===10,"8 côtés + 1 cercle et 1 rayon de construction");A(skEdit.entities.filter(e=>e.t==="circle").every(e=>e.construction),"le cercle est en construction : hors profil");',
' skUndoTrans();A(skEdit.entities.length===0,"Annuler retire le polygone d\\u2019un coup");',
' skPoly.d=null;skTool="polygon";click(5,5);A(skPolyEnter()===false&&!skEdit.entities.length,"Entrée sans Ø connu : rien n\\u2019est créé");skEscapeToSelect();A(skTool==="select"&&!skDown,"Échap : retour à la sélection");}',
'return out;'
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Esquisse : polygone régulier ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,900));process.exit(1);});
