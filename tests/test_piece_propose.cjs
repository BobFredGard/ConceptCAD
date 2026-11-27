// La Pièce qui propose (V1.0.19 ; essayée d'abord sur la branche essai/lentilles ; Fred, 26/11 : « On y va » ; le soir :
// gardée avec la loupe, « mais il va falloir la rendre utilisable » — propositions à côté, trop
// envahissante, pas claire à utiliser).
// src/93-piece-propose.js — la suite liée à ce que l'on vient de faire (le même congé sur les arêtes
// pareilles, les coins vifs d'une poche au rayon de la plus petite fraise, les habitudes de la séance ;
// rien à l'ouverture d'une pièce ; « Non merci » retenu) ; la bande « Ensuite ? », les touches, le menu ;
// la demande écrite (« 4 trous M6 à 10 du bord » → placements contrôlés dans la matière) ;
// les futurs parallèles (A de côté, B vivante, voir, garder A / B / les deux).
// Vraies fonctions de la FAO (faoFrame, faoToolDims, faoDefaultTools), vrais filetages ISO, vrai découpage
// des noms d'arêtes ; pièce lue à la main (arêtes nommées, dedans / dehors) ; moteur de script,
// instantanés et fichiers factices qui notent leurs appels.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const racine=path.join(__dirname,'..');
let ko=0;
const sandbox={console,Math,JSON,Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array,Uint8ClampedArray,
  WeakMap,Map,Set,WeakSet,Promise,Array,Object,Number,String,Boolean,Error,TypeError,RangeError,Symbol,Proxy,Reflect,
  performance:{now:()=>sandbox.__now},__now:0,setTimeout:(f,ms)=>setTimeout(f,0),clearTimeout(){},
  localStorage:{_:{},getItem(k){return k in this._?this._[k]:null;},setItem(k,v){this._[k]=String(v);}},location:{search:''},
  document:{addEventListener(){},getElementById(){return null;},activeElement:null,body:{dataset:{ws:'cao'}}}};
sandbox.window=sandbox;sandbox.self=sandbox;sandbox.addEventListener=()=>{};
const ctx=vm.createContext(sandbox);
const src=f=>fs.readFileSync(path.join(racine,'src',f),'utf8');
const pick=(txt,re)=>{const m=txt.match(re);if(!m)throw new Error('introuvable : '+re);return m[0];};
const fn=(txt,name)=>pick(txt,new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));
{ // vraies fonctions de la FAO et vrais filetages
  const s20=src('88-fao-20-outils-brut.js'),so=src('89-fao-outils.js'),sr=src('89-fao-posage-repere.js'),s10=src('88-fao-10-etat.js'),sp=src('76-percage.js');
  vm.runInContext([pick(s20,/const FAO_DIN333A=[\s\S]*?\];/),fn(s20,'faoCenterDims'),fn(s20,'faoToolBodyD'),
    'function faoToolTipProfile(){return [[0,0],[1,1]];}',pick(so,/const faoR1=[^\n]*/),fn(so,'faoToolDims'),
    pick(sr,/const FAO_AX=[^\n]*/),fn(sr,'faoV'),fn(sr,'faoFrame'),fn(sr,'faoRotF'),fn(sr,'faoRotW'),fn(sr,'faoToW'),fn(sr,'faoOpFrame'),
    'function faoOriginPoint(){return [0,0,0];}',fn(s10,'faoDefaultTools'),fn(src('20-05-noms.js'),'nomsDecoupe'),
    pick(sp,/const ISO_THREADS=[\s\S]*?\];/),'function isoThread(s){return ISO_THREADS.find(t=>t[0]===s)||null;}'].join('\n'),ctx,{filename:'reelles'});
}
vm.runInContext('var bodies=[],doc={name:"Bloc",features:[],sketches:[],params:[],fao:null},rebuildDepth=0,skEdit=null,__wake=0,__runs=[],__ok=true,'
  +'docUndoStack=[],docRedoStack=[],__applied=0,__undoUI=0;'
  +'function viewWake(){__wake++;}'
  +'function mfScriptRun(c){__runs.push(c);return __ok?{ok:true}:{ok:false,error:"le noyau refuse"};}'
  +'function docSnapObj(){return JSON.parse(JSON.stringify(doc));}function docSnap(){return JSON.stringify(doc);}'
  +'function docApplySnap(s){const d=JSON.parse(s);Object.keys(doc).forEach(k=>{if(!(k in d))delete doc[k];});Object.keys(d).forEach(k=>{doc[k]=d[k];});__applied++;return true;}'
  +'function docUndoUI(){__undoUI++;}',ctx);
vm.runInContext(src('93-piece-propose.js'),ctx,{filename:'93-piece-propose.js'});
const r=vm.runInContext(String.raw`(async()=>{
  const out=[];const ok=(c,m)=>out.push([!!c,m]);
  // ── la pièce : bloc x −50..50, y −30..30, z 0..20 ; poche x −20..20, y −10..10, z 10..20 ──
  const inBox=p=>p[0]>-50&&p[0]<50&&p[1]>-30&&p[1]<30&&p[2]>0&&p[2]<20;
  const inPoche=p=>p[0]>-20&&p[0]<20&&p[1]>-10&&p[1]<10&&p[2]>10;
  const st=p=>inBox(p)&&!inPoche(p)?1:0;st.free=()=>{st.freed=(st.freed||0)+1;};
  const E=(a,b,frac)=>{const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],len=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    return {mid,pts:[a,b],len,line:true,dir:[(b[0]-a[0])/len,(b[1]-a[1])/len,(b[2]-a[2])/len],frac};};
  const rect=(x0,x1,y0,y1,z,f)=>[E([x0,y0,z],[x1,y0,z],f),E([x1,y0,z],[x1,y1,z],f),E([x1,y1,z],[x0,y1,z],f),E([x0,y1,z],[x0,y0,z],f)];
  const verts=(x0,x1,y0,y1,z0,z1,f)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(p=>E([p[0],p[1],z0],[p[0],p[1],z1],f));
  const piece=()=>[{id:'b1',st,faces:[{c:[0,0,20],s:[100,60],n:[0,0,1]},{c:[0,0,10],s:[40,20],n:[0,0,1]},{c:[0,0,0],s:[100,60],n:[0,0,-1]}],
    edges:[].concat(rect(-50,50,-30,30,20,0.25),rect(-50,50,-30,30,0,0.25),verts(-50,50,-30,30,0,20,0.25), // dehors : saillantes
      rect(-20,20,-10,10,20,0.25),verts(-20,20,-10,10,10,20,0.75),rect(-20,20,-10,10,10,0.75))}];        // poche : bord saillant, coins creux
  doc.fao={setups:[{id:'P1',name:'POSAGE1',ops:[],tools:[{id:'T1',kind:'flat',d:10},{id:'T2',kind:'flat',d:6},{id:'T3',kind:'drill',d:3},{id:'T4',kind:'chamfer',d:12}]}]};

  // ── 1. la suite liée à ce que l'on vient de faire ──
  ok(JSON.stringify(ppAxes())==='[[0,0,1]]','1 : axe d’outil lu dans le posage (+Z)');
  ok(ppMill()===6,'2 : plus petite fraise Ø6 (le foret Ø3 et le chanfrein ne font pas de coin)');
  ok(ppFeatName({name:'Découpe Esquisse 2 -6mm'})==='Découpe Esquisse 2'&&ppFeatName({name:'Congé exact (4 arête(s))'})==='Congé exact'&&ppFeatName({type:'extrude',op:'cut'})==='Découpe','3 : noms courts des fonctions (sans la cote, sans le nombre d’arêtes)');
  const F1={id:'ex_1',type:'extrude',name:'Extrusion Esquisse 1 20mm',sketchId:'s1',distance:20},
    F2={id:'ex_2',type:'extrude',op:'cut',name:'Découpe Esquisse 2 -10mm',sketchId:'s2',distance:-10},
    F3={id:'ex_3',type:'extrude',op:'cut',name:'Découpe Esquisse 3 -6mm',sketchId:'s3',distance:-6};
  doc.features=[F1,F2,F3];
  // bloc x −50..50, y −30..30, z 0..20 ; poche A (ex_2) x −40..−10, y −10..10, fond 10 ; poche B (ex_3) x 10..40, fond 14
  const inA=p=>p[0]>-40&&p[0]<-10&&p[1]>-10&&p[1]<10&&p[2]>10,inB=p=>p[0]>10&&p[0]<40&&p[1]>-10&&p[1]<10&&p[2]>14;
  const N=(a,b,f,nom)=>Object.assign(E(a,b,f),{nom});
  const poche=(id,x0,x1,zb)=>{const P=[[x0,-10],[x1,-10],[x1,10],[x0,10]],L=[];
    for(let i=0;i<4;i++){const a=P[i],b=P[(i+1)%4];
      L.push(N([a[0],a[1],20],[b[0],b[1],20],0.25,id+'/e'+i+'/flanc|ex_1/haut'));   // bord : saillant
      L.push(N([a[0],a[1],zb],[b[0],b[1],zb],0.75,id+'/e'+i+'/flanc|'+id+'/bas'));   // fond : creux
      L.push(N([a[0],a[1],zb],[a[0],a[1],20],0.75,id+'/e'+((i+3)%4)+'/flanc|'+id+'/e'+i+'/flanc'));} // coin : creux
    return L;};
  const bloc=()=>{const P=[[-50,-30],[50,-30],[50,30],[-50,30]],L=[];
    for(let i=0;i<4;i++){const a=P[i],b=P[(i+1)%4];
      L.push(N([a[0],a[1],20],[b[0],b[1],20],0.25,'ex_1/e'+i+'/flanc|ex_1/haut'),N([a[0],a[1],0],[b[0],b[1],0],0.25,'ex_1/e'+i+'/flanc|ex_1/bas'),
        N([a[0],a[1],0],[a[0],a[1],20],0.25,'ex_1/e'+((i+3)%4)+'/flanc|ex_1/e'+i+'/flanc'));}
    return L;};
  const lire=drop=>{const s=p=>inBox(p)&&!inA(p)&&!inB(p)?1:0;s.free=()=>{};const C=ppOwnerCtx();
    const L=[].concat(bloc(),poche('ex_2',-40,-10,10),poche('ex_3',10,40,14)).filter(e=>!(drop||[]).includes(e.nom));
    L.forEach(e=>{e.own=ppOwners(e.nom,C);});
    return [{id:'b1',st:s,faces:[{c:[0,0,20],s:[100,60],n:[0,0,1]}],edges:L}];};
  const coinA='ex_2/e3/flanc|ex_2/e0/flanc',bordA='ex_2/e0/flanc|ex_1/haut';
  const R0=lire();
  const eA=R0[0].edges.find(e=>e.nom===coinA),bA=R0[0].edges.find(e=>e.nom===bordA),fA=R0[0].edges.find(e=>e.nom==='ex_2/e0/flanc|ex_2/bas');
  ok(JSON.stringify(eA.own)==='["ex_2","ex_2"]'&&JSON.stringify(bA.own)==='["ex_2","ex_1"]','4 : chaque arête rattachée aux fonctions de ses deux faces');
  let c=ppCls(eA,[[0,0,1]]),c2=ppCls(bA,[[0,0,1]]),c3=ppCls(fA,[[0,0,1]]);
  ok(c.conv+c.ori+c.role==='inaxint'&&c2.conv+c2.ori+c2.role==='outflatbord'&&c3.conv+c3.ori+c3.role==='inflatint','5 : coin de poche, bord de poche, arête du fond');
  ok(!ppSharp({frac:0.375},'out')&&!ppSharp({frac:0.625},'in')&&ppSharp({frac:0.25},'out')&&ppSharp({frac:0.75},'in'),'6 : le pli à 135° laissé par un chanfrein n’est pas une arête vive');
  const C0={top:new Map([['ex_2','ex_2'],['co_7','rp_6']]),fil:new Map([[ppNomKey(coinA),'xf_4']])};
  ok(JSON.stringify(ppOwners('congé['+coinA+']|ex_2/bas',C0))==='["xf_4","ex_2"]'&&ppOwnerOf('co_7/e1/flanc',C0)==='rp_6'&&ppOwnerOf('ex_2#2/haut',C0)==='ex_2'
    &&ppNomKey('ex_2/e0/flanc#1|ex_2/e3/flanc')===ppNomKey(coinA),'7 : face d’un congé → le congé ; copie d’une répétition → la répétition ; suffixes de départage ignorés');
  // ce que l'on vient de faire
  let b0=ppSnapBase();
  ok(ppAction(null,b0)===null,'8 : première lecture (pièce ouverte) : rien à suivre');
  doc.features=[F1,F2,F3,{id:'ex_9',type:'extrude',name:'X',distance:5}];let b1=ppSnapBase(),A=ppAction(b0,b1);
  ok(A&&A.f.id==='ex_9'&&A.nouv,'9 : fonction ajoutée');
  doc.features[3]=Object.assign({},doc.features[3],{distance:8});A=ppAction(b1,ppSnapBase());
  ok(A&&A.f.id==='ex_9'&&!A.nouv,'10 : cote changée : la fonction modifiée');
  doc.features=[F1,F2,F3];ok(ppAction(b1,ppSnapBase())===null,'11 : fonction retirée (annulation) : rien');
  doc.sketches=[{id:'s2',points:[[0,0]],entities:[],dims:[{value:30}]}];b0=ppSnapBase();doc.sketches[0].dims[0].value=40;A=ppAction(b0,ppSnapBase());
  ok(A&&A.f.id==='ex_2'&&!A.nouv,'12 : esquisse retouchée : sa fonction');
  const docA=doc;doc={features:[F1]};ok(ppAction(b0,ppSnapBase())===null,'13 : autre pièce ouverte : rien');doc=docA;doc.sketches=[];
  ok(!ppSuggestCtx(R0,null,null).length,'14 : pièce ouverte, rien fait : rien proposé');
  // une poche : ses coins vifs
  let S=ppSuggestCtx(R0,{f:F2,nouv:true},null);
  ok(S.length===1&&S[0].title==='Arrondir les 4 coins de Découpe Esquisse 2 · R3'&&/ta plus petite \(Ø6\) laissera R3/.test(S[0].why),'15 : après la poche A : ses 4 coins à R3 (fraise Ø6), pas ceux de B ni le fond ('+S.map(s=>s.title)+')');
  let C=S[0].cmds();
  ok(C.length===1&&C[0].op==='fillet'&&C[0].radius===3&&C[0].edges.length===4&&C[0].edges.every(e=>e.body==='b1'&&e.near[0]<-5&&e.near[2]===15),'16 : une commande Congé, arêtes désignées par leur milieu');
  // un congé R4 posé sur un coin : le même sur les autres
  const X1={id:'xf_4',type:'xfillet',name:'Congé exact (1 arête(s))',edges:[{nom:coinA,pos:[-40,-10,15],r:4}]};
  doc.features=[F1,F2,F3,X1];
  ok(ppTreated(X1,R0).length===1&&ppTreated({edges:[{pos:[-40,-10,15],r:4}]},R0)[0].e===eA&&!ppTreated({edges:[{nom:'zz|yy',pos:[0,0,99]}]},R0).length,'17 : l’arête traitée retrouvée par son nom, sinon par sa position');
  let R1=lire([coinA]);
  S=ppSuggestCtx(R1,{f:X1,nouv:true},R0);
  ok(S.length===2&&S[0].title==='Même congé R4 sur les 3 autres coins'&&S[1].title==='Même congé R4 sur les 4 coins de Découpe Esquisse 3','18 : même congé sur les 3 autres coins de A, puis sur ceux de B ('+S.map(s=>s.title)+')');
  ok(S[0].why==='Tu viens de le poser sur le coin de Découpe Esquisse 2 : les 3 autres sont pareils.'&&S[0].cmds()[0].radius===4&&S[0].cmds()[0].edges.length===3,'19 : pourquoi, en une phrase ('+S[0].why+')');
  ok(pp.habits.length===1&&pp.habits[0].k==='in ax int f'&&pp.habits[0].v===4&&pp.habits[0].from==='Découpe Esquisse 2','20 : habitude retenue : les coins reçoivent R4');
  // un chanfrein 0,5 sur une arête du bord de A
  const X2={id:'xf_5',type:'xfillet',chamfer:true,name:'Chanfrein exact (1 arête(s))',edges:[{nom:bordA,pos:[-25,-10,20],r:0.5}]};
  doc.features=[F1,F2,F3,X1,X2];
  S=ppSuggestCtx(lire([coinA,bordA]),{f:X2,nouv:true},R1);
  ok(S.map(s=>s.title).join(' | ')==='Même chanfrein 0,5 sur les 3 autres arêtes du bord | Même chanfrein 0,5 sur les 4 arêtes du bord de Découpe Esquisse 3','21 : chanfrein du bord : les 3 autres de A, puis le bord de B — pas le tour du bloc ('+S.map(s=>s.title)+')');
  ok(S[0].kind==='chamfer'&&S[0].cmds()[0].op==='chamfer'&&S[0].cmds()[0].distance===0.5,'22 : chanfrein = distance');
  // une nouvelle poche : les habitudes de la séance
  S=ppSuggestCtx(R0,{f:F3,nouv:true},null);
  ok(S.map(s=>s.title).join(' | ')==='Arrondir les 4 coins de Découpe Esquisse 3 · R4 | Chanfrein 0,5 sur les 4 arêtes du bord de Découpe Esquisse 3','23 : poche B : coins R4 comme A, chanfrein du bord comme A ('+S.map(s=>s.title)+')');
  ok(S[0].why==='Comme les coins de Découpe Esquisse 2 ; ta plus petite fraise (Ø6) y passe.'&&S[1].why==='Comme tu l’as fait sur Découpe Esquisse 2.','24 : pourquoi : l’habitude ('+S[0].why+' / '+S[1].why+')');
  const H=pp.habits;pp.habits=[{k:'in ax int f',c:{conv:'in',ori:'ax',role:'int'},cham:false,v:2,from:'Découpe Esquisse 2'}];
  S=ppSuggestCtx(R0,{f:F3,nouv:true},null);
  ok(S.length===1&&/· R3$/.test(S[0].title)&&/laissera R3/.test(S[0].why),'25 : habitude R2 plus petite que la fraise : R3 (la fraise ne passe pas en R2)');
  pp.habits=H;pp.refus.add('coins:ex_3');
  S=ppSuggestCtx(R0,{f:F3,nouv:true},null);
  ok(S.length===1&&/^Chanfrein/.test(S[0].title),'26 : « Non merci » retenu pour cette fonction');
  pp.refus.clear();
  doc.features.push({id:'h1',type:'hole'});
  ok(ppMots({conv:'out',ori:'curve'},4,['h1']).txt==='4 trous'&&ppMots({conv:'out',ori:'curve'},1,['h1']).txt==='le trou'&&ppMots({conv:'in',ori:'flat'},2,['ex_2']).txt==='2 arêtes du fond','27 : les mots : trous, arêtes du fond');
  doc.features=[];pp.habits=[];
  const plat=[{id:'b2',st:p=>p[0]>-10&&p[0]<10&&p[1]>-10&&p[1]<10&&p[2]>0&&p[2]<5?1:0,faces:[{c:[0,0,5],s:[20,20],n:[0,0,1]}],
    edges:[].concat(rect(-10,10,-10,10,5,0.25),verts(-10,10,-10,10,0,5,0.25))}]; // petite plaque sans poche
  // une fraise doit pouvoir descendre dans le coin (Perçages, 26/11 : fond d'une poche ouverte sur le côté,
  // sous un plafond — le congé faisait tout le tour du fond, +73 mm³, aucune fraise verticale n'y va)
  let pr=ppProbe(st,[-20,-10,15],[0,0,1],0.25);
  ok(Math.abs(pr.frac-0.75)<0.1&&Math.abs(pr.out[0]-Math.SQRT1_2)<0.05&&Math.abs(pr.out[1]-Math.SQRT1_2)<0.05&&Math.abs(pr.out[2])<1e-9,'28 : coin de poche : ¾ de matière, le vide vers l’intérieur de la poche ('+pr.frac.toFixed(2)+' ; '+pr.out.map(v=>v.toFixed(2))+')');
  const B0=ppBox(piece());
  ok(ppReach(st,Object.assign({},E([-20,-10,10],[-20,-10,20],0.75),{out:pr.out}),[[0,0,1]],B0),'29 : poche ouverte vers le haut : la fraise y descend');
  const st2=p=>p[0]>-50&&p[0]<50&&p[1]>-30&&p[1]<30&&p[2]>0&&p[2]<20&&!(p[0]>40&&Math.abs(p[1])<10&&p[2]>5&&p[2]<15)?1:0;st2.free=()=>{};
  const Ep=(a,b,nom)=>{const e=E(a,b,0);const q=ppProbe(st2,e.mid,e.dir,0.25);e.frac=q.frac;e.out=q.out;e.nom=nom;e.own=['ex_9','ex_9'];return e;};
  const cote=()=>[{id:'b3',st:st2,faces:[{c:[0,0,20],s:[100,60],n:[0,0,1]}],
    edges:[].concat(bloc().map(e=>Object.assign(e,{own:['ex_1','ex_1']})),
      [Ep([40,-10,5],[40,-10,15],'a'),Ep([40,10,5],[40,10,15],'b'),                                       // fond de la poche de côté, sous le plafond
       Ep([40,-10,5],[50,-10,5],'c'),Ep([40,10,5],[50,10,5],'d'),Ep([40,-10,15],[50,-10,15],'e'),Ep([40,10,15],[50,10,15],'f'), // le long de X
       Ep([50,-10,5],[50,-10,15],'g'),Ep([50,10,5],[50,10,15],'h')])}];                                    // bouche : saillantes
  const RC=cote(),F9={id:'ex_9',type:'extrude',op:'cut',name:'Poche de côté'};doc.features=[F1,F9];
  ok(RC[0].edges[12].frac>0.62&&!ppReach(st2,RC[0].edges[12],[[0,0,1]],ppBox(RC)),'30 : fond d’une poche ouverte sur le côté : creux, mais aucune fraise verticale n’y descend');
  const S31=ppSuggestCtx(RC,{f:F9,nouv:true},null);
  ok(!S31.some(s=>s.key.indexOf('coins:')===0)&&S31.length===1&&S31[0].key==='plot:ex_9:vert'&&S31[0].lines.every(P=>P.every(q=>q[0]===50))&&/Aucune arête vive dans les coins intérieurs/.test(ppReqItems(ppParse('congés dans les coins intérieurs'),RC).err),'31 : coins du fond ni proposés ni acceptés dans une demande écrite ; seulement les 2 arêtes verticales de la bouche (V1.1.3) ('+S31.map(s=>s.title)+')');
  { // ── V1.1.3 : après un plot (Fred, 27/11 : « une esquisse une extrusion » → « rien ») ──
    const F0=doc.features,H0=pp.habits;pp.habits=[];pp.refus.clear();
    const lit=(L,s)=>{const C=ppOwnerCtx();L.forEach(e=>{e.own=ppOwners(e.nom,C);});return [{id:'b1',st:s||(p=>inBox(p)?1:0),faces:[],edges:L}];};
    doc.features=[F1];
    let S4=ppSuggestCtx(lit(bloc()),{f:F1,nouv:true},null);
    const kv=S4.find(s=>s.key==='plot:ex_1:vert'),kh=S4.find(s=>s.key==='plot:ex_1:haut');
    ok(S4.length===2&&kv&&kh&&S4[0]===kv&&kv.lines.length===4&&kh.lines.length===4&&kh.lines.every(P=>P.every(q=>q[2]===20)),
      '101b : bloc seul : arrondir ses 4 arêtes verticales, chanfrein sur les 4 arêtes du dessus (pas celles du dessous) ('+S4.map(s=>s.title)+')');
    const cv=kv.cmds(),ch=kh.cmds();
    ok(/^Arrondir les 4 arêtes verticales de Extrusion Esquisse 1 · R6$/.test(kv.title)&&cv[0].op==='fillet'&&cv[0].radius===6&&cv[0].edges.length===4
      &&/^Chanfrein 1 sur les 4 arêtes du dessus de Extrusion Esquisse 1$/.test(kh.title)&&ch[0].op==='chamfer'&&ch[0].distance===1,
      '101c : R6 = valeur ronde du dixième de la largeur (60 mm) ; chanfrein 1 (pièce de plus de 80 mm)');
    // plot posé sur le bloc : ex_5, x −10..10, y −10..10, z 20..30
    const F5={id:'ex_5',type:'extrude',name:'Extrusion Esquisse 5 10mm',sketchId:'s5',distance:10};doc.features=[F1,F5];
    const inP=p=>p[0]>-10&&p[0]<10&&p[1]>-10&&p[1]<10&&p[2]>=20&&p[2]<30,sp=p=>inBox(p)||inP(p)?1:0;
    const Q=[[-10,-10],[10,-10],[10,10],[-10,10]],LP=[];
    for(let i=0;i<4;i++){const a=Q[i],b=Q[(i+1)%4];
      LP.push(N([a[0],a[1],30],[b[0],b[1],30],0.25,'ex_5/e'+i+'/flanc|ex_5/haut'),N([a[0],a[1],20],[b[0],b[1],20],0.75,'ex_5/e'+i+'/flanc|ex_1/haut'),
        N([a[0],a[1],20],[a[0],a[1],30],0.25,'ex_5/e'+((i+3)%4)+'/flanc|ex_5/e'+i+'/flanc'));}
    S4=ppSuggestCtx(lit(bloc().concat(LP),sp),{f:F5,nouv:true},null);
    ok(S4.map(s=>s.key).join()==='plot:ex_5:vert,plot:ex_5:haut,plot:ex_5:pied'&&/· R2$/.test(S4[0].title)&&S4[1].lines.every(P=>P.every(q=>q[2]===30))
      &&/^Congé R1 au pied de Extrusion Esquisse 5 \(4 arêtes\)$/.test(S4[2].title)&&S4[2].lines.every(P=>P.every(q=>q[2]===20)),
      '101d : plot sur la pièce : ses arêtes verticales (R2), le dessus du plot seulement, le congé au pied ('+S4.map(s=>s.title)+')');
    // perçage : 2 trous débouchants Ø6 dans le bloc
    const Fh={id:'h1',type:'hole',name:''};doc.features=[F1,Fh];
    const rim=(cx,z,k)=>{const P=ppCircle([cx,0,z],[0,0,1],3,24);return {mid:P[6],pts:P,len:2*Math.PI*3,line:false,dir:null,frac:0.25,nom:'h1/c'+k+'/s1/f2|ex_1/'+(z>0?'haut':'bas')};};
    S4=ppSuggestCtx(lit(bloc().concat([rim(-20,20,0),rim(20,20,1),rim(-20,0,0),rim(20,0,1)])),{f:Fh,nouv:true},null);
    ok(S4.length===1&&S4[0].key==='plot:h1:haut'&&/^Chanfrein 1 à l’entrée des 2 trous de Perçage$/.test(S4[0].title)&&S4[0].lines.length===2,
      '101e : perçage : chanfrein à l’entrée des trous seulement ('+S4.map(s=>s.title)+')');
    // une habitude sur ces arêtes passe avant (ici : chanfrein 0,5 sur le dessus) : rien de plus
    doc.features=[F1];pp.habits=[{k:'out flat int c',c:{conv:'out',ori:'flat',role:'int'},cham:true,v:0.5,from:'Bride'}];
    S4=ppSuggestCtx(lit(bloc()),{f:F1,nouv:true},null);
    ok(S4.length===1&&S4[0].key.indexOf('hab:')===0&&/^Chanfrein 0,5 sur les 8 arêtes du bord de Extrusion Esquisse 1$/.test(S4[0].title),'101f : habitude de la séance : elle seule ('+S4.map(s=>s.title)+')');
    doc.features=F0;pp.habits=H0;pp.refus.clear();
  }
  doc.fao.setups[0].ops=[{id:'o1',type:'pocket',name:'Poche de côté',frame:{z:'+X',x:'-Z'}}];
  const AX2=ppAxes();
  ok(AX2.length===2&&AX2[0][2]===1&&Math.abs(AX2[1][0]-1)<1e-9,'32 : axe 3+2 de l’opération ajouté après celui du posage ('+JSON.stringify(AX2)+')');
  S=ppSuggestCtx(cote(),{f:F9,nouv:true},null);
  ok(S.length===1&&S[0].title==='Arrondir les 4 coins de Poche de côté · R3'&&S[0].lines.every(P=>Math.abs(P[0][0]-P[1][0])===10),'33 : avec l’opération en 3+2 le long de X : les 4 coins le long de X, pas ceux du fond ('+S.map(s=>s.title)+')');
  doc.fao.setups[0].ops=[];doc.features=[];

  // ── 2. en direct : rien à l'ouverture, la suite après une fonction ──
  let U='u1';const corps=ppBodies;ppBodies=()=>[{id:'b1',mesh:{geometry:{uuid:U}}}];
  const lect=ppRead;let nLu=0;ppRead=async()=>{nLu++;return lire();};
  const att=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setTimeout(r,0));};
  doc.features=[F1];ppSetAuto(true);
  ok(pp.on&&localStorage._.ppAuto==='1'&&/^<div class="r1 m">Fais une fonction : je te proposerai la suite ici\.<\/div>$/.test(ppStripParts().r1),'34 : allumé : une ligne dit comment ça marche');
  ppTick(10000);ppTick(10700);await att();
  ok(nLu===1&&pp.sig===pp.want&&!pp.all.length&&!pp.list.length,'35 : pièce ouverte : lue, rien proposé');
  doc.features=[F1,F2];U='u2';ppTick(11200);ppTick(11900);await att();
  ok(nLu===2&&pp.list.length===1&&pp.list[0].title==='Arrondir les 4 coins de Découpe Esquisse 2 · R3'&&pp.act.f===F2,'36 : la poche faite : ses coins proposés ('+pp.list.map(s=>s.title)+')');
  const PS=ppStripParts();
  ok(/Ensuite \?/.test(PS.r1)&&/data-no="1"[^>]*>Non merci/.test(PS.r1)&&/<kbd>1<\/kbd><span>Arrondir les 4 coins/.test(PS.r1)&&/^Survole une proposition pour la voir sur la pièce · 1 ou un clic/.test(PS.r2.txt),'37 : la bande : « Ensuite ? », la proposition, Non merci, l’aide');
  pp.hover=0;ok(ppStripParts().r2.txt===pp.list[0].why&&ppKeysTxt(3)==='1, 2, 3','38 : survol : pourquoi ; « 1, 2, 3 ou un clic »');pp.hover=-1;
  ppTick(13000);ok(nLu===2,'39 : rien n’a changé : pas relue');
  ppBodies=corps;ppRead=lect;

  // ── 3. touches ──
  pp.on=true;__runs=[];__ok=true;
  const ev=(key,o)=>Object.assign({key,preventDefault(){this.pd=true;},stopPropagation(){}},o||{});
  const trois=p=>[{key:p+'1',title:'Un',why:'',cmds:()=>[{op:'fillet'}]},{key:p+'2',title:'Deux',why:'',cmds:()=>[{op:'chamfer'}]},{key:p+'3',title:'Trois',why:'',cmds:()=>[{op:'fillet'}]},{key:p+'4',title:'Quatre',why:'',cmds:()=>[]}];
  pp.all=trois('k');pp.sig=pp.want='s1';ppListSync();
  ok(pp.list.length===3,'40 : 3 propositions au plus');
  let k=ev('Tab');ppKey(k);ok(pp.focus===0&&k.pd,'41 : Tab → la 1re');
  ppKey(ev('Tab'));ppKey(ev('Tab'));ppKey(ev('Tab'));ok(pp.focus===0,'42 : Tab fait le tour');
  ppKey(ev('Tab',{shiftKey:true}));ok(pp.focus===2,'43 : Maj+Tab revient en arrière');
  ppKey(ev('Escape'));ok(pp.focus===-1&&pp.list.length===3,'44 : Échap retire d’abord la mise en avant');
  k=ev('2',{ctrlKey:true});ppKey(k);ok(!__runs.length&&!k.pd,'45 : Ctrl+2 laissé à la page');
  document.activeElement={tagName:'INPUT'};ppKey(ev('1'));ok(!__runs.length,'46 : on tape dans un champ : rien n’est fait');document.activeElement=null;
  document.body.dataset.ws='fao';ppKey(ev('1'));ok(!__runs.length,'47 : espace FAO : rien n’est fait');document.body.dataset.ws='cao';
  __ok=false;ppKey(ev('2'));
  ok(__runs.length===1&&__runs[0][0].op==='chamfer'&&pp.list.length===3&&/^Refusé : le noyau refuse/.test(pp.msg),'48 : refusé par le noyau : les propositions restent, la raison est dite');
  __ok=true;__runs=[];ppKey(ev('Tab'));ppKey(ev('Tab'));ppKey(ev('Enter'));
  ok(__runs.length===1&&__runs[0][0].op==='chamfer'&&!pp.list.length&&pp.sig===''&&pp.msg==='Fait : Deux · Ctrl+Z pour revenir','49 : Tab Tab Entrée fait la 2e, la pièce sera relue ('+pp.msg+')');
  ok(/^<div class="r1 m">Fait : Deux/.test(ppStripParts().r1),'50 : la bande dit ce qui a été fait');
  pp.msg='';pp.all=trois('k');ppListSync();
  ppKey(ev('Escape'));ok(!pp.list.length&&pp.refus.has('k1')&&pp.refus.has('k3')&&!pp.refus.has('k4'),'51 : Échap = Non merci : les 3 montrées écartées');
  ppListSync();ok(pp.list.length===1&&pp.list[0].key==='k4','52 : … et ne reviennent pas');
  pp.all=trois('m');ppListSync();ok(pp.list.length===3,'53 : une autre fonction : de nouvelles propositions');
  let foc=0;pp.ask={value:'',focus(){foc++;},select(){},blur(){}};
  k=ev('/');ppKey(k);ok(foc===1&&k.pd&&pp.askOpen,'54 : / ouvre la demande écrite');pp.askOpen=false;
  __runs=[];ppKey(ev('9'));ok(!__runs.length,'55 : touche au-delà de la liste : rien');
  ok(/aria-checked="true"[^>]*data-m="auto"/.test(ppMenuHtml())&&/data-m="ask"/.test(ppMenuHtml())&&/data-m="var"/.test(ppMenuHtml()),'56 : le menu : Proposer la suite (coché), Écrire une demande, Essayer une variante');

  // ── 4. la demande écrite : lecture ──
  const P=t=>JSON.stringify(ppParse(t));
  let q=ppParse('4 trous M6 à 10 du bord');
  ok(q.kind==='holes'&&q.n===4&&q.thread==='M6'&&q.e===10&&!q.through&&q.where===null,'57 : « 4 trous M6 à 10 du bord » ('+P('4 trous M6 à 10 du bord')+')');
  q=ppParse('2 trous Ø8 traversants');ok(q.n===2&&q.d===8&&q.through&&!q.thread,'58 : « 2 trous Ø8 traversants »');
  q=ppParse('6 trous Ø5 en cercle au centre');ok(q.n===6&&q.d===5&&q.where==='centre','59 : « en cercle au centre »');
  q=ppParse('deux taraudages M8 profondeur 12');ok(q.n===2&&q.thread==='M8'&&q.tap&&q.depth===12,'60 : nombre en lettres, profondeur ('+P('deux taraudages M8 profondeur 12')+')');
  q=ppParse('un trou de diamètre 10');ok(q.n===1&&q.d===10,'61 : « un trou de diamètre 10 »');
  q=ppParse('4 trous M2,5');ok(q.thread==='M2.5','62 : M2,5 écrit à la française → M2.5 du tableau ISO');
  q=ppParse('4 trous M99');ok(/Filetage « M99 » inconnu/.test(q.err),'63 : filetage inconnu refusé');
  q=ppParse('4 trous');ok(/Quel Ø/.test(q.err),'64 : trou sans Ø : question');
  q=ppParse('40 trous M6');ok(/Entre 1 et 24/.test(q.err),'65 : trop de trous');
  q=ppParse('congés R2 sur les arêtes extérieures');ok(q.kind==='fillet'&&q.r===2&&q.target==='out','66 : congés R2 extérieurs');
  q=ppParse('chanfrein 0,5 sur le dessus');ok(q.kind==='chamfer'&&q.d===0.5&&q.target==='top','67 : chanfrein 0,5 dessus');
  q=ppParse('congés dans les coins intérieurs');ok(q.kind==='fillet'&&q.r==null&&q.target==='in','68 : congés dans les coins intérieurs, rayon à trouver');
  q=ppParse('casser les angles 1 mm');ok(q.kind==='chamfer'&&q.d===1,'69 : « casser les angles 1 mm » = chanfrein 1');
  q=ppParse('fais une coque');ok(q.err&&q.ex,'70 : demande inconnue : exemples proposés');
  ok(ppParse('  ').err,'71 : demande vide');

  // ── 5. la demande écrite : placements ──
  const T={x0:-50,x1:50,y0:-30,y1:30};
  let L=ppLayouts(T,4,10,null);
  ok(L[0].lab==='aux coins'&&JSON.stringify(L[0].pts)==='[[-40,-20],[40,-20],[40,20],[-40,20]]'&&L[1].lab==='au milieu des côtés','72 : 4 trous : aux coins puis au milieu des côtés');
  L=ppLayouts(T,2,10,null);ok(L[0].lab==='en diagonale'&&JSON.stringify(L[1].pts)==='[[-40,0],[40,0]]','73 : 2 trous : diagonale puis milieu des petits côtés');
  L=ppLayouts(T,6,10,'centre');ok(L[0].pts.length===6&&Math.abs(Math.hypot(L[0].pts[0][0],L[0].pts[0][1])-20)<1e-9&&L[0].lab==='en cercle Ø40','74 : 6 en cercle au centre : Ø40 (30 − 10 de bord)');
  L=ppLayouts(T,1,10,null);ok(L.length===1&&L[0].lab==='au centre','75 : 1 trou au centre');
  L=ppLayouts(T,3,10,'coins');ok(L[0].lab==='aux coins'&&L[0].pts.length===3,'76 : 3 trous « aux coins » d’abord');
  let R=ppReqItems(ppParse('4 trous M6 à 10 du bord'),piece());
  ok(R.items.length===2&&R.items[0].title==='4 taraudages M6 aux coins, à 10 du bord'&&R.items[1].title==='4 taraudages M6 au milieu des côtés, à 10 du bord','77 : M6 à 10 : coins et milieux des côtés ('+R.items.map(i=>i.title)+')');
  C=R.items[0].cmds();ok(C[1].thread==='M6'&&C[1].depth===15&&!C[1].through&&C[0].offset===20,'78 : taraudage borgne 2,5 × Ø, esquisse sur le dessus');
  R=ppReqItems(ppParse('2 trous Ø8 traversants'),piece());
  ok(R.items[0].title==='2 trous Ø8 en diagonale, à 15 du bord'&&R.items[0].cmds()[1].through===true&&R.items[0].cmds()[1].d===8,'79 : Ø8 traversants à 15 du bord (2 × Ø arrondi à 5)');
  R=ppReqItems(ppParse('1 trou Ø10 au centre'),piece());
  ok(!R.items&&/Pas la place pour 1 trou Ø10 sur le dessus autour du centre/.test(R.err),'80 : au centre il y a la poche : refusé ('+R.err+')');
  R=ppReqItems(ppParse('4 trous Ø5 profondeur 25'),piece());ok(/la pièce ne fait que 20/.test(R.err),'81 : plus profond que la pièce : refusé');
  R=ppReqItems(ppParse('4 trous Ø8 à 15 du bord'),piece());
  ok(R.items.length===1&&/aux coins/.test(R.items[0].title),'82 : à 15 du bord les milieux des côtés touchent la poche : seuls les coins restent ('+(R.items?R.items.map(i=>i.title):R.err)+')');
  R=ppReqItems({kind:'holes',n:2,d:8,e:null,where:null,through:true},[{id:'c',st:p=>(Math.abs(p[0])<50&&Math.abs(p[1])<30&&p[2]>0&&p[2]<20&&!(Math.abs(p[0])<30&&Math.abs(p[1])<10))?1:0,
    faces:[{c:[0,0,20],s:[100,60],n:[0,0,1]}],edges:rect(-50,50,-30,30,20,0.25).concat(rect(-50,50,-30,30,0,0.25))}]);
  ok(R.items&&R.items[0].title==='2 trous Ø8 en diagonale, à 12 du bord','83 : dessus en cadre de 20 : à 15 le trou mord dans le creux, la distance au bord se recentre sur le cadre ('+(R.items?R.items[0].title:R.err)+')');
  R=ppReqItems(ppParse('congés R2 sur les arêtes extérieures'),piece());
  ok(R.items.length===1&&R.items[0].title==='Congés R2 sur les 4 arêtes extérieures'&&R.items[0].cmds()[0].radius===2,'84 : congés R2 extérieurs');
  R=ppReqItems(ppParse('congés'),piece());
  ok(R.items.map(i=>i.title).join(' | ')==='Congés R3 dans les 4 coins intérieurs | Congés R1 sur les 4 arêtes extérieures | Congés R1 sur les 16 arêtes vives','85 : « congés » seul : intérieurs, extérieurs, toutes ('+R.items.map(i=>i.title)+')');
  R=ppReqItems(ppParse('chanfrein 0,5'),piece());ok(R.items[0].title==='Chanfrein 0,5 × 45° sur les 8 arêtes vives du dessus','86 : « chanfrein 0,5 » : le dessus d’abord');
  R=ppReqItems(ppParse('congés dans les coins intérieurs'),plat);ok(/Aucune arête vive dans les coins intérieurs/.test(R.err),'87 : pas de coin intérieur : dit');
  ok(/Pas encore de pièce/.test(ppReqItems(ppParse('congés'),[]).err),'88 : pas de pièce : dit');

  // ── 6. les futurs parallèles ──
  pp.msg='';doc.features=[{id:'f1',type:'extrude',op:'cut',name:'Découpe Esquisse 2 (face)',distance:-6}];docUndoStack=['u1'];docRedoStack=[];
  ppVarStart();const V=pp.var;
  ok(V&&V.live==='B'&&JSON.parse(V.A.snap).features[0].distance===-6&&V.A.undo.join()==='u1','89 : variante : A gardée de côté avec son historique, on travaille sur B');
  ok(JSON.stringify(ppDiff(JSON.parse(V.A.snap),docSnapObj()))==='["identique","identique pour l’instant"]','90 : tant que rien ne change : identique');
  doc.features[0].distance=-3;docUndoStack=['u1','u2','u3'];
  ppVarLabels();ok(V.labels[0]==='Découpe Esquisse 2 : 6 mm'&&V.labels[1]==='Découpe Esquisse 2 : 3 mm','91 : ce qui les distingue en mots courts ('+V.labels+')');
  ok(ppVarShow('A')&&doc.features[0].distance===-6&&V.live==='A'&&docUndoStack.join()==='u1'&&JSON.parse(V.B.snap).features[0].distance===-3&&V.B.undo.length===3,'92 : voir A : la pièce et son annulation reviennent, B mise de côté');
  ok(ppVarShow('B')&&doc.features[0].distance===-3&&docUndoStack.length===3,'93 : voir B : retour à B et à ses 3 étapes d’annulation');
  ok(!ppVarShow('B'),'94 : B déjà affichée : rien');
  doc.features.push({id:'f2',type:'xfillet',name:'Congé (2)',edges:[{r:2}]});ppVarLabels();
  ok(/\+ Congé/.test(V.labels[1])&&/sans Congé/.test(V.labels[0]),'95 : fonction ajoutée dans B : « + Congé » / « sans Congé » ('+V.labels+')');
  ok(ppVarKeep('A')&&!pp.var&&doc.features.length===1&&doc.features[0].distance===-6&&/Variante A gardée, B oubliée/.test(pp.msg),'96 : garder A : A revient, B oubliée');
  // garder les deux : l'autre dans son fichier
  doc.features=[{id:'f1',type:'extrude',op:'cut',name:'Découpe',distance:-6}];ppVarStart();doc.features[0].distance=-3;
  globalThis.serialiseObj=(d)=>d;globalThis.mffCheckData=()=>null;globalThis.mffPack=async t=>t;globalThis.mffBlob=d=>({size:d.length,d});globalThis.MFF_TYPES=[];globalThis.mffName='Bloc';
  let saved=null;window.showSaveFilePicker=async o=>({name:o.suggestedName,createWritable:async()=>({write:async b=>{saved=b.d;},close:async()=>{}})});
  ok(await ppVarKeepBoth()&&!pp.var&&doc.features[0].distance===-3&&JSON.parse(saved).features[0].distance===-6&&/« Bloc — variante A\.conceptcad »/.test(pp.msg),'97 : garder les deux : B reste ici, A enregistrée dans « Bloc — variante A » ('+pp.msg+')');
  ppVarStart();window.showSaveFilePicker=async()=>{const e=new Error('annulé');e.name='AbortError';throw e;};
  ok(!(await ppVarKeepBoth())&&pp.var&&/annulé/.test(pp.msg),'98 : enregistrement annulé : les deux variantes restent');
  pp.var.doc={};ppVarTick(1e6);ok(!pp.var,'99 : autre pièce ouverte : la variante de côté est oubliée');
  pp.req={text:'2 trous Ø6',items:[{key:'r1',title:'2 trous Ø6 en diagonale'}]};ppSetAuto(false);
  ok(!pp.on&&localStorage._.ppAuto==='0'&&pp.req&&pp.list.length===1,'100 : Proposer la suite éteint (retenu) : la demande écrite reste');
  ppReqClose();ok(!pp.list.length,'101 : demande fermée : plus rien');
  return out;
})()`,ctx);
r.then(out=>{
  for(const [c,m] of out){console.log((c?'  ok  ':'  ÉCHEC ')+m);if(!c)ko++;}
  console.log(ko?ko+' échec(s) sur '+out.length:'test_piece_propose : '+out.length+'/'+out.length+' ok');
  process.exit(ko?1:0);
}).catch(e=>{console.error('ÉCHEC',e);process.exit(1);});
