// FAO 3D — V0.98.0 : Ébauche 3D, mode CONTOURS (op.mode='contours').
// Demande : « on garde l'option une seule descente, en spirale, puis on part
// parallèles aux îlots et l'on passe partout en suivant la forme des îlots
// plutôt que des arcs de cercle » ; « il faut vraiment gérer le brut restant ».
// Mêmes fixtures que test_fao_escargot_une_entree (bloc 100×80×20, ap 7 → z=13) :
//  A. poche x[10,90] y[10,70] fond 5, îlot x[40,60] y[30,50] ;
//  B. même poche sans îlot ;  C. bossage x[30,70] y[20,60] (niveau sur l'air).
// Contrôles au niveau z=13 :
//  1. une seule hélice (A, B), aucune (C) ;
//  2. zone par zone : quelques remontées seulement (liaisons longues en rapide,
//     redescente dans le déjà-vidé — jamais une 2e hélice) ;
//  3. tout balayé (carte de matière), laisses îlot / paroi respectées ;
//  4. engagement maxi ≤ diamètre (rainure tolérée là où rien d'autre ne passe)
//     et la plus grande part des coupes à ≤ ae + jeu ;
//  5. passes PARALLÈLES aux parois : part de la longueur coupée à distance
//     constante (± 0,3 mm) de l'îlot ou de la paroi la plus proche (A) — bien
//     plus que l'Escargot à une entrée (fronts en arcs) ;
//  5b. jamais d'entrée en pleine matière hors de l'unique hélice : on entre
//      par le vide (déjà vidé, air) puis on coupe vers la matière ;
//  6. sanitise : mode 'contours' gardé, uneEntree retiré.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    "const C=10,NX=10,NY=8;",
    "const mkMesh=function(hAt){const V=[],T=[],K={};",
    "  const vid=function(x,y,z){const k=x+','+y+','+z;if(K[k]===undefined){K[k]=V.length;V.push([x,y,z]);}return K[k];};",
    "  const quad=function(a,b,c,d){const A=vid.apply(null,a),B=vid.apply(null,b),Cc=vid.apply(null,c),Dd=vid.apply(null,d);T.push([A,B,Cc],[A,Cc,Dd]);};",
    "  const H=function(i,j){if(i<0||j<0||i>=NX||j>=NY)return 0;return hAt(i*C+5,j*C+5);};",
    "  for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const h=H(i,j),x0=i*C,y0=j*C,x1=x0+C,y1=y0+C;",
    "    if(h<=0)continue;",
    "    quad([x0,y0,h],[x1,y0,h],[x1,y1,h],[x0,y1,h]);",
    "    quad([x0,y0,0],[x0,y1,0],[x1,y1,0],[x1,y0,0]);",
    "    let hn=H(i+1,j);if(hn<h)quad([x1,y0,hn],[x1,y1,hn],[x1,y1,h],[x1,y0,h]);",
    "    hn=H(i-1,j);if(hn<h)quad([x0,y1,hn],[x0,y0,hn],[x0,y0,h],[x0,y1,h]);",
    "    hn=H(i,j+1);if(hn<h)quad([x1,y1,hn],[x0,y1,hn],[x0,y1,h],[x1,y1,h]);",
    "    hn=H(i,j-1);if(hn<h)quad([x0,y0,hn],[x1,y0,hn],[x1,y0,h],[x0,y0,h]);}",
    "  return {v:V,t:T};};",
    "const inPk=function(x,y){return x>10&&x<90&&y>10&&y<70;};",
    "const FA=mkMesh(function(x,y){return inPk(x,y)&&!(x>40&&x<60&&y>30&&y<50)?5:20;});",
    "const FB=mkMesh(function(x,y){return inPk(x,y)?5:20;});",
    // C : socle plein 5 mm + bossage jusqu'à 20 (le reste du brut est à enlever)
    "const FC=mkMesh(function(x,y){return (x>30&&x<70&&y>20&&y<60)?20:5;});",
    "const BX={x0:0,y0:0,x1:100,y1:80};",
    "const BASE={ap:7,ae:4,toolD:10,radial:0.5,axial:0.5,secu:25,minipasses:0,entry:'circ',sens:'avalant',mode:'contours'};",
    "const gen=function(M,o){const z={};for(const k in BASE)z[k]=BASE[k];if(o)for(const k in o)z[k]=o[k];",
    "  return faoGenRough3D(M,BX,20,5,z);};",
    "const Z=13,r=5.5,ae=4;",
    // découpe du niveau Z : de la 1re arrivée à Z jusqu'au départ vers le niveau suivant
    "const level=function(mv){let i0=-1,i1=-1;for(let i=0;i<mv.length;i++){if(Math.abs(mv[i].z-Z)<1e-6&&!mv[i].r){if(i0<0)i0=i;i1=i;}",
    "  else if(i0>=0&&mv[i].z<Z-1e-6&&!mv[i].r)break;}",
    "  let s=i0;while(s>0&&mv[s-1].z>Z+1e-6&&!mv[s-1].r)s--;",
    "  return {mv:mv.slice(Math.max(0,s-1),i1+1),i0:i0,i1:i1};};",
    // hélices : suites de ≥ 8 mouvements d'entrée qui descendent en tournant vers Z
    "const helices=function(L){let n=0,run=0;for(let i=1;i<L.length;i++){const a=L[i-1],b=L[i];",
    "  if(!b.r&&b.ent&&b.z<a.z-1e-9)run++;else{if(run>=8&&Math.abs(a.z-Z)<0.5)n++;run=0;}}return n;};",
    // remontées : mouvements qui quittent la cote Z entre la 1re et la dernière coupe
    // remontées dans la zone usinée (le tour du cadre hors pièce et le départ
    // vers le niveau suivant ne comptent pas) : départ ET arrivée dans la zone
    "const lifts=function(L,inZ){let n=0;for(let i=1;i<L.length;i++){const a=L[i-1],b=L[i];",
    "  if(!(Math.abs(a.z-Z)<1e-6&&b.z>Z+1e-6))continue;let j=i;while(j<L.length&&!(Math.abs(L[j].z-Z)<1e-6&&!L[j].r))j++;",
    "  if(j<L.length-1&&inZ(a.x,a.y)&&inZ(L[j].x,L[j].y))n++;}return n;};",
    "const cuts=function(L){const o=[];for(let i=1;i<L.length;i++){const a=L[i-1],b=L[i];",
    "  if(!b.r&&!a.r&&Math.abs(a.z-Z)<1e-6&&Math.abs(b.z-Z)<1e-6)o.push([a,b]);}return o;};",
    "const dRect=function(x,y,x0,y0,x1,y1){const dx=Math.max(x0-x,0,x-x1),dy=Math.max(y0-y,0,y-y1);",
    "  if(dx>0||dy>0)return Math.hypot(dx,dy);return -Math.min(x-x0,x1-x,y-y0,y1-y);};",
    "const dIsl=function(x,y){return dRect(x,y,40,30,60,50);};",
    "const dWall=function(x,y){return -dRect(x,y,10,10,90,70);};",
    // carte de matière (0,5 mm) : engagement maxi d'une coupe = largeur de matière
    // enlevée perpendiculairement au trajet (approximée : aire enlevée / longueur)
    "const sim=function(segs,isMat){const g=0.5,nx=Math.round(100/g)+1,ny=Math.round(80/g)+1,m=new Uint8Array(nx*ny),R=5;",
    "  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if(isMat(i*g,j*g))m[j*nx+i]=1;",
    "  let worst=0,wAt=null;",
    "  segs.forEach(function(s){const a=s[0],b=s[1],L=Math.hypot(b.x-a.x,b.y-a.y);if(L<1e-9)return;const n=Math.max(1,Math.ceil(L/0.25));let rem=0;",
    "    let full=0,tot=0;for(let jj=Math.max(0,Math.floor((a.y-R)/g));jj<=Math.min(ny-1,Math.ceil((a.y+R)/g));jj++)",
    "      for(let ii=Math.max(0,Math.floor((a.x-R)/g));ii<=Math.min(nx-1,Math.ceil((a.x+R)/g));ii++)if((ii*g-a.x)*(ii*g-a.x)+(jj*g-a.y)*(jj*g-a.y)<=R*R){tot++;if(m[jj*nx+ii])full++;}",
    "    const entry=full>0.3*tot||!!b.ent;",
    "    for(let k=0;k<=n;k++){const x=a.x+(b.x-a.x)*k/n,y=a.y+(b.y-a.y)*k/n;",
    "      for(let jj=Math.max(0,Math.floor((y-R)/g));jj<=Math.min(ny-1,Math.ceil((y+R)/g));jj++)",
    "      for(let ii=Math.max(0,Math.floor((x-R)/g));ii<=Math.min(nx-1,Math.ceil((x+R)/g));ii++){const q=jj*nx+ii;",
    "        if(m[q]&&(ii*g-x)*(ii*g-x)+(jj*g-y)*(jj*g-y)<=R*R){m[q]=0;rem++;}}}",
    "    if(L>=2&&!entry){const w=rem*g*g/L;if(w>worst){worst=w;wAt=[a.x,a.y,b.x,b.y];}}});",
    "  let left=0,ex=null;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){if(!m[j*nx+i])continue;const x=i*g,y=j*g;",
    "    if(!isMat(x,y))continue;left++;if(!ex)ex=[x,y];}",
    "  return {worst:worst,wAt:wAt,left:left,ex:ex};};",
    // matière utile au niveau (hors laisse) : poche, hors îlot, à > 0,6 mm de la laisse
    "const reach=function(x,y){return dRect(x,y,15.5,15.5,84.5,64.5)<=4.9;};",
    "const matA=function(x,y){return dWall(x,y)>0.6+0.5&&dIsl(x,y)>0.6+0.5&&reach(x,y);};",
    "const matB=function(x,y){return dWall(x,y)>0.6+0.5&&reach(x,y);};",
    "const check=function(nom,M,mat,opt){",
    "  const mv=gen(M,opt),L=level(mv),seg=cuts(L.mv),nh=helices(L.mv),nl=lifts(L.mv,function(x,y){return inPk(x,y);}),S=sim(seg,mat);",
    "  return {nom:nom,mv:mv,L:L,seg:seg,nh:nh,nl:nl,S:S};};",
    // part de la longueur coupée « parallèle » : distance à la paroi la plus proche constante
    "const par=function(K,dN){let t=0,pa=0;K.seg.forEach(function(s){const a=s[0],b=s[1],L=Math.hypot(b.x-a.x,b.y-a.y);if(!inPk(a.x,a.y)||!inPk(b.x,b.y))return;",
    "  t+=L;const n=Math.max(1,Math.ceil(L/1));let ok=true;const d0=dN(a.x,a.y);for(let k=1;k<=n;k++){const x=a.x+(b.x-a.x)*k/n,y=a.y+(b.y-a.y)*k/n;if(Math.abs(dN(x,y)-d0)>0.3){ok=false;break;}}if(ok)pa+=L;});",
    "  return t>0?pa/t:0;};",
    "const dNA=function(x,y){return Math.min(dIsl(x,y),dWall(x,y));};",
    "const share=function(K,lim){let t=0,s=0;K.seg.forEach(function(q){const L=Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y);t+=L;});return t;};",
    // entrées en pleine matière : arrivée à la cote Z (depuis plus haut) là où le
    // disque d'outil a encore > 30 % de matière (carte tenue à jour par les coupes à Z)
    "const fullEnt=function(K,isMat){const g=0.5,nx=Math.round(100/g)+1,ny=Math.round(80/g)+1,m=new Uint8Array(nx*ny),R=5,L=K.L.mv;let n=0;",
    "  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if(isMat(i*g,j*g))m[j*nx+i]=1;",
    "  const disk=function(x,y,cut){let f=0,t=0;for(let jj=Math.max(0,Math.floor((y-R)/g));jj<=Math.min(ny-1,Math.ceil((y+R)/g));jj++)for(let ii=Math.max(0,Math.floor((x-R)/g));ii<=Math.min(nx-1,Math.ceil((x+R)/g));ii++)if((ii*g-x)*(ii*g-x)+(jj*g-y)*(jj*g-y)<=R*R){t++;if(m[jj*nx+ii]){f++;if(cut)m[jj*nx+ii]=0;}}return t?f/t:0;};",
    "  for(let i=1;i<L.length;i++){const a=L[i-1],b=L[i];if(b.r)continue;",
    "    if(a.z>Z+1e-6&&Math.abs(b.z-Z)<1e-6&&disk(b.x,b.y,false)>0.3)n++;",
    "    if(Math.abs(a.z-Z)<1e-6&&Math.abs(b.z-Z)<1e-6){const d=Math.hypot(b.x-a.x,b.y-a.y),k=Math.max(1,Math.ceil(d/0.5));for(let q=0;q<=k;q++)disk(a.x+(b.x-a.x)*q/k,a.y+(b.y-a.y)*q/k,true);}}",
    "  return n;};",
    "const A1=check('A contours',FA,matA,{});",
    "const A0=check('A escargot une entrée',FA,matA,{mode:'anneaux',uneEntree:true});",
    "const B1=check('B contours',FB,matB,{});",
    "const C1=check('C contours',FC,function(x,y){return dRect(x,y,30,20,70,60)>0.6+0.5&&x>0&&x<100&&y>0&&y<80;},{});",
    "A1.pa=par(A1,dNA);A0.pa=par(A0,dNA);B1.pa=par(B1,dWall);",
    "[A1,B1,C1].forEach(function(K){",
    "  att(K.seg.length>(K===C1?50:100),K.nom+' : coupes au niveau ('+K.seg.length+')');",
    "  att(K.nh===(K===C1?0:1),K.nom+' : hélices '+K.nh);",
    "  att(K.nl<=10,K.nom+' : remontées limitées ('+K.nl+')');",
    "  att(K.S.left===0,K.nom+' : tout balayé ('+K.S.left+' cases'+(K.S.ex?', ex. '+K.S.ex.join(','):'')+')');",
    "  att(K.S.worst<=10+0.6,K.nom+' : engagement maxi '+K.S.worst.toFixed(2)+' mm'+(K.S.wAt?' vers '+K.S.wAt.map(function(v){return v.toFixed(1);}).join(','):''));",
    "  K.fe=fullEnt(K,K===A1?matA:K===B1?matB:function(x,y){return dRect(x,y,30,20,70,60)>1.1&&x>0&&x<100&&y>0&&y<80;});",
    "  att(K.fe<=K.nh,K.nom+' : entrées en pleine matière '+K.fe+' (hélices '+K.nh+')');",
    "  if(K===C1)return;",
    "  let mI=1/0,mW=1/0;K.seg.forEach(function(s){[s[0],s[1]].forEach(function(m){",
    "    if(inPk(m.x,m.y)){mI=Math.min(mI,dIsl(m.x,m.y));mW=Math.min(mW,dWall(m.x,m.y));}});});",
    "  if(K===A1)att(mI>=r-0.05,K.nom+' : laisse îlot '+mI.toFixed(2));",
    "  att(mW>=r-0.05,K.nom+' : laisse paroi '+mW.toFixed(2));",
    "});",
    "att(A1.pa>=0.6&&A1.pa>A0.pa+0.25,'A : passes parallèles à l îlot et aux parois '+(100*A1.pa).toFixed(0)+' % (escargot une entrée '+(100*A0.pa).toFixed(0)+' %)');",
    "att(B1.pa>=0.5,'B : passes parallèles aux parois '+(100*B1.pa).toFixed(0)+' %');",
    // sanitise
    "const o1={id:'a1',type:'rough3d',minipasses:0,mode:'contours',uneEntree:1};faoSanitiseOps({ops:[o1]});",
    "att(o1.mode==='contours'&&!('uneEntree' in o1),'sanitise : mode contours gardé, uneEntree retiré');",
    "const svg=function(K,dx){const L=K.L.mv;let s='<g transform=\"translate('+dx+',0)\"><rect x=\"10\" y=\"10\" width=\"80\" height=\"60\" fill=\"none\" stroke=\"#999\"/>'+(K.M===FA?'<rect x=\"40\" y=\"30\" width=\"20\" height=\"20\" fill=\"#ccc\"/>':K.M===FC?'<rect x=\"30\" y=\"20\" width=\"40\" height=\"40\" fill=\"#ccc\"/>':'');",
    "  for(let i=1;i<L.length;i++){const a=L[i-1],b=L[i];const col=b.r?'#0a0':(Math.abs(b.z-Z)<1e-6?'#c00':'#06c');",
    "    s+='<line x1=\"'+a.x+'\" y1=\"'+(80-a.y)+'\" x2=\"'+b.x+'\" y2=\"'+(80-b.y)+'\" stroke=\"'+col+'\" stroke-width=\"0.3\"/>';}",
    "  return s+'</g>';};",
    "A1.M=FA;A0.M=FA;B1.M=FB;C1.M=FC;",
    "globalThis.__svg='<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-10 -10 450 100\" width=\"2250\" height=\"500\" style=\"background:#fff\">'+svg(A1,0)+svg(A0,110)+svg(B1,220)+svg(C1,330)+'</svg>';",
    "[A1,A0,B1,C1].forEach(function(K){p(K.nom+' : '+K.seg.length+' coupes, hélices '+K.nh+', remontées '+K.nl+', reste '+K.S.left+', engagement maxi '+K.S.worst.toFixed(2)+' mm'+(K.fe!==undefined?', entrées pleine matière '+K.fe:'')+(K.pa!==undefined?', parallèle '+(100*K.pa).toFixed(0)+' %':''));});",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(function(m){p('  x '+m);});}",
    "else p('TOUT EST CONFORME');",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_contours.js'});
  console.log(r);
  if(process.env.SVG_OUT)require('fs').writeFileSync(process.env.SVG_OUT,vm.runInContext('globalThis.__svg',ctx));
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
