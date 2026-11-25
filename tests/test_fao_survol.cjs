// FAO — SURVOL d'une opération dans l'arbre (V0.99.86, src/88-fao-61-survol.js).
// 1. découpage : entrée avant la coupe, sortie après, liaison, rapide, remontée ;
//    même coupe / rapides / remontées que l'aperçu, entrées + sorties + liaisons =
//    tracé vert de l'aperçu ; 2. vrai Contour sur profil : arcs d'entrée ET de sortie ;
// 3. allumage : l'opération survolée seule, même masquée, les autres en gris puis
//    remises ; rien sans parcours en mémoire ; lignes de l'arbre câblées.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    "const nseg=a=>a.length/6;",
    // --- 1. découpage d'une suite écrite à la main
    "const M=[",
    "  {r:1,x:0,y:0,z:30},{r:1,x:10,y:0,z:30},{r:1,x:10,y:0,z:5},",          // rapide, rapide qui descend
    "  {r:0,ent:1,x:10,y:0,z:0},{r:0,ent:1,x:12,y:2,z:0},",                   // entrée (descente + arc)
    "  {r:0,x:20,y:2,z:0},{r:0,x:20,y:10,z:0},",                               // coupe
    "  {r:0,ent:1,x:22,y:12,z:0},{r:0,ent:1,x:24,y:12,z:0},",                 // sortie
    "  {r:1,x:24,y:12,z:30},{r:1,x:40,y:12,z:30},",                            // remontée, rapide
    "  {r:0,x:40,y:12,z:-2},{r:0,x:50,y:12,z:-2},",                            // plongée (entrée), coupe
    "  {r:0,tr:1,x:50,y:15,z:-2},{r:0,ent:1,x:51,y:16,z:-2},{r:0,x:60,y:16,z:-2},", // liaison, entrée, coupe
    "  {r:1,x:60,y:16,z:30}];",
    "const o=faoSurvolDecoupe(M,null);",
    "p('découpage : coupe '+nseg(o.cut)+', entrée '+nseg(o.ent)+', sortie '+nseg(o.sor)+', liaison '+nseg(o.lia)+', rapide '+nseg(o.rap)+', remontée '+nseg(o.ret));",
    "att(nseg(o.ent)===4,'entrées : descente + arc + plongée + entrée après liaison (vu '+nseg(o.ent)+')');",
    "att(nseg(o.sor)===2,'sorties : les 2 mouvements ent après la coupe (vu '+nseg(o.sor)+')');",
    "att(o.sor[0]===20&&o.sor[1]===10&&o.sor[3]===22,'sortie : part de la fin de la coupe');",
    "att(nseg(o.lia)===1,'liaison au contact : 1 (vu '+nseg(o.lia)+')');",
    "att(nseg(o.cut)===4,'coupe : 4 segments (vu '+nseg(o.cut)+')');",
    "att(nseg(o.ret)===2&&nseg(o.rap)===3,'remontées 2 / rapides 3 (vu '+nseg(o.ret)+' / '+nseg(o.rap)+')');",
    "const s=faoSegSplit(M,null);",
    "att(o.cut.join()===s.cut.join()&&o.rap.join()===s.rap.join()&&o.ret.join()===s.ret.join(),'coupe, rapides et remontées identiques à l\\'aperçu');",
    "att(o.ent.length+o.sor.length+o.lia.length===s.plg.length,'entrées + sorties + liaisons = tracé vert de l\\'aperçu');",
    // ébauche : hélice entre deux niveaux (après la coupe, suivie de coupe) = ENTRÉE ;
    // sortie suivie d'une remontée en avance puis d'un rapide = SORTIE
    "const M2=[{r:1,x:0,y:0,z:10},{r:0,ent:1,x:0,y:0,z:0},{r:0,x:10,y:0,z:0},",
    "  {r:0,ent:1,x:12,y:2,z:-1},{r:0,ent:1,x:10,y:4,z:-2},{r:0,x:0,y:4,z:-2},",
    "  {r:0,ent:1,x:-2,y:6,z:-2},{r:0,x:-2,y:6,z:3},{r:1,x:-2,y:6,z:10}];",
    "const o2=faoSurvolDecoupe(M2,null),s2=faoSegSplit(M2,null);",
    "att(nseg(o2.ent)===3&&nseg(o2.sor)===1,'hélice entre deux niveaux = entrée, dernière = sortie (vu entrée '+nseg(o2.ent)+', sortie '+nseg(o2.sor)+')');",
    "att(o2.sor[0]===0&&o2.sor[3]===-2,'sortie : celle d\\'avant la remontée');",
    "att(o2.cut.join()===s2.cut.join()&&nseg(o2.cut)===3,'remontée verticale en avance : coupe, comme l\\'aperçu');",
    // zone : seule la coupe est bornée, pas les rapides
    "const clip=function(ax,ay,az,bx,by,bz,push){ if(Math.max(ax,bx)<=30)push(ax,ay,az,bx,by,bz); };",
    "const oc=faoSurvolDecoupe(M,clip);",
    "att(nseg(oc.cut)===2&&nseg(oc.rap)===3,'zone : coupe bornée (2), rapides libres (3)');",
    // pointillés
    "const t=faoSurvolTirets([0,0,0,10,0,0],[1,0.8]);",
    "att(nseg(t)===6&&t[3]===1&&t[t.length-3]===10,'pointillés : 6 traits de 1 sur 10 mm, le dernier coupé au bout');",
    "const pas=faoSurvolPas({cut:[0,0,0,100,0,0],ent:[],sor:[],lia:[],rap:[],ret:[]});",
    "att(Math.abs(pas[0]-1.2)<1e-9&&Math.abs(pas[1]-0.84)<1e-9,'pointillés à 1,2 % de l\\'encombrement (vu '+pas+')');",
    // --- 2. vrai Contour sur profil (bossage) : entrées et sorties tangentes
    "const mkBox=function(x0,x1,y0,y1,z0,z1){return {v:[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],t:[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]};};",
    "const merge=function(){const r={v:[],t:[]};for(let a=0;a<arguments.length;a++){const B=arguments[a],off=r.v.length;r.v=r.v.concat(B.v);r.t=r.t.concat(B.t.map(function(q){return [q[0]+off,q[1]+off,q[2]+off];}));}return r;};",
    "const BOSS=merge(mkBox(0,100,0,60,0,5),mkBox(30,70,20,40,5,20));",
    "const mv=faoGenContourProfil(BOSS,[[30,20],[70,20],[70,40],[30,40],[30,20]],{toolD:6,secu:30,ztop:20,zbot:5,ap:6,ae:2.4,nR:2,fin:0.2,sens:'climb',overlap:1});",
    "const oC=faoSurvolDecoupe(mv,null),sC=faoSegSplit(mv,null);",
    "p('contour : coupe '+nseg(oC.cut)+', entrée '+nseg(oC.ent)+', sortie '+nseg(oC.sor)+', rapide '+nseg(oC.rap)+', remontée '+nseg(oC.ret));",
    "att(nseg(oC.ent)>0&&nseg(oC.sor)>0,'contour : arcs d\\'entrée ET de sortie');",
    "att(Math.abs(nseg(oC.ent)-nseg(oC.sor))<=nseg(oC.ent)*0.5,'contour : autant de sorties que d\\'entrées, à peu près');",
    "att(oC.ent.length+oC.sor.length+oC.lia.length===sC.plg.length&&oC.cut.length===sC.cut.length,'contour : même tracé que l\\'aperçu');",
    // --- 3. allumage : objets d'aperçu factices
    "const C=function(h){return {h:h,clone(){return C(this.h);},copy(c){this.h=c.h;return this;},setHex(x){this.h=x;return this;}};};",
    "const matT=function(h){return {uniforms:{col:{value:C(h)},op:{value:1},w:{value:2}},transparent:false,depthWrite:true};};",
    "const matL=function(h){return {color:C(h),opacity:1,transparent:false,depthWrite:true};};",
    "const grp=function(mats){const kids=mats.map(function(m){return {material:m};});return {visible:true,traverse(f){kids.forEach(f);}};};",
    "const op1={id:'a',type:'contour'},op2={id:'b',type:'pocket'},op3={id:'c',type:'pocket',hidden:true};",
    "const m1=matL(0x2f80ff),m2=matT(0xffd60a),m3=matL(0x2f80ff);",
    "const g1=grp([matL(0x2f80ff)]),g2=grp([m1,m2]),g3=grp([m3]);g3.visible=false;",
    "faoPrevOn=true;faoPrevStreamG=null;",
    "faoPrevGroup={children:[],add(x){this.children.push(x);x.parent=this;},remove(){}};",
    "faoPrevOps=new Map();",
    "faoPrevOps.set(op1,{g:g1,parts:[],n:5,src:[{b:{moves:M},clip:null}]});",
    "faoPrevOps.set(op2,{g:g2,parts:[],n:5,src:[{b:{moves:M},clip:null}]});",
    "faoPrevOps.set(op3,{g:g3,parts:[],n:5,src:[{b:{moves:M},clip:null}]});",
    "const row={cl:{},classList:{add(c){row.cl[c]=1;},remove(c){delete row.cl[c];}}};",
    "let ok=false;try{ok=faoSurvolDebut(op1,row);}catch(e){att(false,'survol : exception '+e.message);}",
    "att(ok===true,'survol de l\\'opération 1 allumé');",
    "att(g1.visible===false,'survol : tracé habituel de l\\'opération remplacé par celui du survol');",
    "att(m1.color.h===FAO_SURVOL.gris&&m1.opacity<=0.22&&m1.transparent===true,'survol : autre opération en gris pâle (trait fin)');",
    "att(m2.uniforms.col.value.h===FAO_SURVOL.gris&&m2.uniforms.w.value===1&&m2.uniforms.op.value<=0.22,'survol : autre opération en gris pâle (trait épais)');",
    "att(m3.color.h===0x2f80ff,'survol : opération masquée non survolée laissée cachée et intacte');",
    "att(row.cl.survol===1,'survol : ligne de l\\'arbre marquée');",
    "att(faoPrevGroup.children.length===1,'survol : tracé ajouté à l\\'aperçu');",
    "faoSurvolFin();",
    "att(m1.color.h===0x2f80ff&&m1.opacity===1&&m1.transparent===false&&m1.depthWrite===true,'fin : couleurs remises (trait fin)');",
    "att(m2.uniforms.col.value.h===0xffd60a&&m2.uniforms.w.value===2&&m2.uniforms.op.value===1,'fin : couleurs remises (trait épais)');",
    "att(g1.visible===true&&g2.visible===true&&g3.visible===false,'fin : affichage de chaque opération remis');",
    "att(!row.cl.survol,'fin : ligne de l\\'arbre démarquée');",
    // opération MASQUÉE survolée : montrée quand même
    "ok=faoSurvolDebut(op3,null);",
    "att(ok===true&&m1.color.h===FAO_SURVOL.gris,'opération masquée survolée : montrée, les autres en gris');",
    "faoSurvolFin();",
    "att(g3.visible===false&&m1.color.h===0x2f80ff,'opération masquée : cachée de nouveau après le survol');",
    // sans parcours en mémoire / simulation ouverte / dessin en cours : rien
    "faoPrevOps.set(op2,{g:g2,parts:[],n:0,src:[]});",
    "att(faoSurvolDebut(op2,null)===false&&m1.color.h===0x2f80ff,'sans parcours en mémoire : rien');",
    "faoPrevStreamG=faoPrevGroup;",
    "att(faoSurvolDebut(op1,null)===false,'pendant un dessin progressif : rien');",
    "faoPrevStreamG=null;",
    // aperçu jeté pendant le survol : état oublié
    "faoSurvolDebut(op1,row);faoSurvolOublie();",
    "att(faoSurvolEtat===null&&faoSurvolCache===null&&!row.cl.survol,'aperçu jeté : survol oublié');",
    "faoPrevGroup=null;faoPrevOps=null;",
    // lignes de l'arbre câblées
    "const S=faoSetup();",
    "if(!S.ops.length)S.ops.push(Object.assign(faoOpDefaults('contour'),{id:'o1'}));",
    "faoRenderTree();",
    "const tree=document.getElementById('faoTree');",
    "const rows=(tree.children||[]).filter(function(n){return /^fao-op( |$)/.test(n.className||'')&&!/fao-(grp|sub)/.test(n.className||'');});",
    "att(rows.length>0&&rows.every(function(n){return typeof n.onmouseenter==='function'&&typeof n.onmouseleave==='function';}),'arbre : survol câblé sur les lignes d\\'opération ('+rows.length+')');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(function(m){p('  x '+m);});}",
    "else p('TOUT EST CONFORME');",
    "return {txt:P.join(String.fromCharCode(10)),ko:ATT.length};"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_survol.js'});
  console.log(r.txt);
  process.exit(r.ko?1:0);
})().catch(e=>{console.log('FATAL',e&&e.stack||e);process.exit(1);});
