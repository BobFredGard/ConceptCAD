// TEXTE D'ESQUISSE (V0.96.0) : lecture des polices (TrueType, OpenType CFF, collections), lettres posées en
// vraies entités (lignes + splines exactes), zones avec trous (A, B, 8), modification, annulation, ancre qui
// entraîne le texte, suppression d'un coup, extrusion par le vrai noyau (volume = aire × hauteur).
// Polices prises sur l'ordinateur (Windows, Linux, macOS) : sans police trouvée, la partie concernée est sautée.
const fs=require('fs'),vm=require('vm'),path=require('path');
const {loadApp}=require('./appvm.cjs');
const trouve=l=>l.find(p=>{try{return fs.statSync(p).isFile();}catch(e){return false;}});
const TTF=trouve(['C:/Windows/Fonts/arial.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/TTF/DejaVuSans.ttf','/Library/Fonts/Arial.ttf','/System/Library/Fonts/Supplemental/Arial.ttf']);
const dirs=['C:/Windows/Fonts','/usr/share/fonts/opentype','/usr/share/fonts','/Library/Fonts','/System/Library/Fonts'];
let OTF=null;for(const d of dirs){try{const f=fs.readdirSync(d).find(n=>/\.otf$/i.test(n));if(f){OTF=path.join(d,f);break;}}catch(e){}}
const TTC=trouve(['C:/Windows/Fonts/cambria.ttc','C:/Windows/Fonts/msgothic.ttc','/System/Library/Fonts/Helvetica.ttc']);
(async()=>{
  if(!TTF){console.log('Aucune police TrueType trouvée sur cet ordinateur — test sauté.\nTOUT EST CONFORME');process.exit(0);}
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  const lire=p=>{const b=fs.readFileSync(p);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);};
  sandbox.__ttf=lire(TTF);sandbox.__ttfName=path.basename(TTF);
  sandbox.__otf=OTF?lire(OTF):null;sandbox.__otfName=OTF?path.basename(OTF):'';
  sandbox.__ttc=TTC?lire(TTC):null;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);else p('  ✓ '+msg);};",
    // ---------- lecture des polices ----------
    "const F=fontParse(__ttf);",
    "p('police : '+F.family+' '+F.style+' ('+F.kind+', '+F.upm+' unités, majuscules '+F.cap+')');",
    "att(F.kind==='tt'&&F.gid(65)>0&&F.glyph(F.gid(65)).contours.length===2,'TrueType lue : « A » = 2 contours (le tour et le trou)');",
    "const gB=F.glyph(F.gid(66));att(gB.contours.length===3,'« B » = 3 contours');",
    "if(__ttc){const L=fontParseAll(__ttc);att(L.length>=2&&L.every(x=>x.ps),'collection .ttc : '+L.length+' polices, chacune nommée');}",
    // ---------- esquisse : un texte posé ----------
    "doc.features=[];doc.sketches=[];",
    "const sk={id:'sk_t',name:'Texte',plane:'XY',visible:true,origin:[0,0,0],points:{},entities:[],constraints:[],dims:[],seq:5};",
    "ensureSketchBasis(sk);doc.sketches.push(sk);openSketch('sk_t');",
    "skTxtAddFile(__ttfName,__ttf);const ps=F.ps;",
    "skTool='text';Object.assign(skTxt,{str:'AB8',ps,h:10,ang:0,sp:0,lh:1,al:'g',mir:false,cur:null});",
    "await skTxtDown(sk,5,3);",
    "const rec=skTxtRecs(sk)[0];",
    "att(rec&&rec.str==='AB8'&&rec.font.ps===ps,'texte posé : fiche avec le texte et la police');",
    "const nE=sk.entities.filter(e=>e.txt===rec.id).length,nS=sk.entities.filter(e=>e.txt===rec.id&&e.t==='spline').length;",
    "att(nE>20&&nS>5,'lettres en vraies entités : '+nE+' traits dont '+nS+' splines exactes');",
    "att(sk.entities.filter(e=>e.t==='spline'&&e.txt).every(e=>e.mode==='ctrl'&&e.knots&&e.knots.length===e.pts.length+e.deg+1),'splines : points de contrôle et nœuds cohérents');",
    "const fx=skFixed(sk);att(Object.keys(sk.points).filter(k=>sk.points[k].txt).every(k=>fx.has(k)),'points des lettres fixes pour le solveur');",
    "att(!fx.has(rec.pa),'point d’ancrage libre (cotable, glissable)');",
    // hauteur des majuscules
    "const bbT=()=>{let a=1e9,b=1e9,c=-1e9,d=-1e9;sk.entities.filter(e=>e.txt).forEach(e=>{const pl=e.t==='spline'?skSplinePoly(sk,e,8):[[sk.points[e.p1].x,sk.points[e.p1].y],[sk.points[e.p2].x,sk.points[e.p2].y]];pl.forEach(q=>{a=Math.min(a,q[0]);b=Math.min(b,q[1]);c=Math.max(c,q[0]);d=Math.max(d,q[1]);});});return[a,b,c,d];};",
    "let B=bbT();p('  boîte : x '+B[0].toFixed(2)+'..'+B[2].toFixed(2)+', y '+B[1].toFixed(2)+'..'+B[3].toFixed(2));",
    "att(Math.abs(B[1]-3)<0.2&&Math.abs(B[3]-13)<0.35,'hauteur des majuscules = 10 mm au-dessus de la ligne de base (y 3 → 13)');",
    // zones : A (1 trou), B (2 trous), 8 (2 trous)
    "const mat=()=>skRegionsCached(sk).regs.filter(R=>R.inDef);const regs=mat();",
    "const holes=regs.map(r=>r.hb.length).sort().join(',');",
    "att(regs.length===3&&holes==='1,2,2'&&skRegionsCached(sk).regs.length===8,'zones : 3 lettres pleines avec leurs trous ('+holes+'), et les 5 contre-formes choisissables à part');",
    "const H=skHealth(sk);att(!H.opens.length&&!H.dupes.length,'contours fermés, aucun point en double');",
    // aire exacte : profil comparé aux courbes de la police (polygone fin)
    "const L=skTxtLayout(F,Object.assign(skTxtOpts(rec,sk)));",
    "const bz=(c)=>{const out=[c.s];let cur=c.s;c.seg.forEach(g=>{for(let i=1;i<=40;i++){const t=i/40,u=1-t;let q;if(g.k==='L')q=[cur[0]+(g.p[0]-cur[0])*t,cur[1]+(g.p[1]-cur[1])*t];else if(g.k==='Q')q=[u*u*cur[0]+2*u*t*g.c[0]+t*t*g.p[0],u*u*cur[1]+2*u*t*g.c[1]+t*t*g.p[1]];else q=[u*u*u*cur[0]+3*u*u*t*g.c1[0]+3*u*t*t*g.c2[0]+t*t*t*g.p[0],u*u*u*cur[1]+3*u*u*t*g.c1[1]+3*u*t*t*g.c2[1]+t*t*t*g.p[1]];out.push(q);if(g.k==='L')break;}cur=g.p;});return out;};",
    "const sh=pl=>{let a=0;for(let i=0;i<pl.length;i++){const A=pl[i],Bq=pl[(i+1)%pl.length];a+=A[0]*Bq[1]-Bq[0]*A[1];}return a/2;};",
    "const aFont=Math.abs(L.contours.reduce((s,c)=>s+sh(bz(c)),0));",
    "const aReg=regs.reduce((s,r)=>s+r.area,0);",
    "p('  aire : police '+aFont.toFixed(3)+' mm², zones '+aReg.toFixed(3)+' mm²');",
    "att(Math.abs(aReg-aFont)/aFont<0.01,'aire des zones = aire des lettres de la police (à 1 %)');",
    // ---------- extrusion par le noyau ----------
    "closeSketch(true);",
    "doc.features=[{id:'ex_t',type:'extrude',name:'Relief',sketchId:'sk_t',op:'add',distance:2}];occSkipFeat=null;",
    "try{occCk.length=0;}catch(e){}",
    "let FR=occFinalShape(null);const V=FR&&FR.shape?occShapeVolume(FR.shape):0;",
    "p('  volume extrudé : '+V.toFixed(3)+' mm³ (attendu ≈ '+(aFont*2).toFixed(3)+')');",
    "att(V>0&&Math.abs(V-aFont*2)/(aFont*2)<0.01,'extrusion de 2 mm : volume = aire × 2 (à 1 %)');",
    "if(FR&&FR.shape)FR.shape.delete();",
    // ---------- modification, annulation ----------
    "openSketch('sk_t');",
    "await skTxtEdit(sk,rec.id);skTxt.str='Hi';await skTxtApply();skTxtFinish();",
    "const rec2=skTxtRecs(sk)[0];",
    "att(rec2&&rec2.str==='Hi'&&mat().length===3,'texte modifié « Hi » : 3 zones (H, i, point du i)');",
    "skUndoTrans();",
    "att(skTxtRecs(sk)[0].str==='AB8'&&mat().length===3,'Ctrl+Z : « AB8 » revient en une étape');",
    // ---------- l'ancre entraîne le texte ----------
    "const r3=skTxtRecs(sk)[0];const A0=sk.points[r3.pa];const b0=bbT();",
    "skPushUndo();A0.x+=7;A0.y-=2;solveSketch(sk);const b1=bbT();",
    "att(Math.abs(b1[0]-b0[0]-7)<1e-6&&Math.abs(b1[1]-b0[1]+2)<1e-6,'ancre déplacée de (7, −2) : le texte suit exactement');",
    "Object.keys(sk.points).forEach(k=>{if(k!==SK_ORIGIN){sk.points[k].x+=1;}});solveSketch(sk);const b2=bbT();",
    "att(Math.abs(b2[0]-b1[0]-1)<1e-6,'déplacement de tous les points : le texte n’est pas décalé deux fois');",
    "sk.dims.push({id:skNewEid(sk),type:'distance',a:SK_ORIGIN,b:r3.pa,orient:'h',value:20,ox:0,oy:0});solveSketch(sk);",
    "const Qr=sk.points[r3.ref],Ar=sk.points[r3.pa];att(Math.abs(Ar.x-20)<1e-4&&Math.abs(Qr.x-(Ar.x+r3.rx))<1e-6&&Math.abs(Qr.y-(Ar.y+r3.ry))<1e-6,'ancre cotée à 20 mm de l’origine : le texte reste calé dessus');",
    // ---------- angle, centre, miroir ----------
    "await skTxtEdit(sk,r3.id);Object.assign(skTxt,{ang:90});await skTxtApply();skTxtFinish();",
    "B=bbT();att(B[2]-B[0]<B[3]-B[1],'angle 90° : le texte monte (plus haut que large)');",
    "await skTxtEdit(sk,r3.id);Object.assign(skTxt,{ang:0,al:'c'});await skTxtApply();skTxtFinish();",
    "B=bbT();const ax=sk.points[r3.pa].x;att(Math.abs((B[0]+B[2])/2-ax)<0.6,'centré : le texte est centré sur son ancre');",
    "await skTxtEdit(sk,r3.id);Object.assign(skTxt,{al:'g',mir:true});await skTxtApply();skTxtFinish();",
    "B=bbT();att(B[2]<=sk.points[r3.pa].x+0.6,'miroir : le texte part vers la gauche de l’ancre');att(mat().length===3,'miroir : toujours 3 lettres pleines');",
    // ---------- texte sur deux lignes ----------
    "await skTxtEdit(sk,r3.id);Object.assign(skTxt,{mir:false,str:'AB\\n8'});await skTxtApply();skTxtFinish();",
    "B=bbT();att(B[1]<sk.points[r3.pa].y-5,'deux lignes : la 2ᵉ ligne est sous la 1re');",
    // ---------- suppression d'un coup ----------
    "const one=sk.entities.find(e=>e.txt&&e.t==='line');skSel={kind:'ent',id:one.id};skSelX=[];deleteSkSel();",
    "att(!sk.entities.some(e=>e.txt||e.t==='text')&&!Object.keys(sk.points).some(k=>sk.points[k].txt),'Suppr sur un trait : tout le texte disparaît');",
    "skUndoTrans();att(skTxtRecs(sk).length===1,'Ctrl+Z : le texte revient');",
    // ---------- rechargement ----------
    "const js=JSON.parse(JSON.stringify(sk));att(js.entities.some(e=>e.t==='text')&&Object.keys(js.points).some(k=>js.points[k].txt),'fichier : fiche et contours enregistrés');",
    // ---------- vitesse : 40 caractères ----------
    "let t0=Date.now();await skTxtEdit(sk,r3.id);skTxt.str='ConceptCAD 0123456789 abcdefghijklmnopq';await skTxtApply();skTxtFinish();const tA=Date.now()-t0;",
    "t0=Date.now();drawSketch2D();const tD=Date.now()-t0;t0=Date.now();const rg=mat();const tR=Date.now()-t0;",
    "p('  40 caractères : '+sk.entities.filter(e=>e.txt).length+' traits, pose '+tA+' ms, dessin '+tD+' ms, zones '+tR+' ms ('+rg.length+' zones)');",
    "att(tA<4000&&tD<1500,'40 caractères : pose et dessin rapides');",
    // ---------- pièges des polices : contours en contour, chevauchés, bords communs ----------
    "const fake=(C)=>({upm:1000,cap:700,asc:800,desc:-200,gap:0,ps:'Fausse',family:'Fausse',style:'Regular',gid:()=>1,adv:()=>1000,kernPair:()=>0,glyph:()=>({adv:1000,contours:JSON.parse(JSON.stringify(C))})});",
    "const sq=(x0,y0,x1,y1,cw)=>{const P=cw?[[x0,y0],[x0,y1],[x1,y1],[x1,y0]]:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];return{s:P[0],seg:[1,2,3,0].map(i=>({k:'L',p:P[i]}))};};",
    "const cq=(cx,cy,r,cw)=>{const n=8,a=i=>(cw?-1:1)*i*Math.PI*2/n,R=r/Math.cos(Math.PI/n),pt=(t,rr)=>[cx+rr*Math.cos(t),cy+rr*Math.sin(t)];return{s:pt(0,r),seg:Array.from({length:n},(_,i)=>({k:'Q',c:pt((a(i)+a(i+1))/2,R),p:pt(a(i+1),r)}))};};",
    "const cc=(cx,cy,r,cw)=>{const K=0.5523*r,sg=cw?-1:1;const P=[[cx+r,cy],[cx,cy+sg*r],[cx-r,cy],[cx,cy-sg*r]];const T=[[0,sg],[-1,0],[0,-sg],[1,0]];return{s:P[0],seg:P.map((q,i)=>{const n=P[(i+1)%4],t0=T[i],t1=T[(i+1)%4];return{k:'C',c1:[q[0]+t0[0]*K,q[1]+t0[1]*K],c2:[n[0]-t1[0]*K,n[1]-t1[1]*K],p:n};})};};",
    "const vrai=(F)=>{const k=10/700,raw=[];F.glyph().contours.forEach(c=>{const pl=[];let cur=c.s;c.seg.forEach(g=>{const B=skTxtBz(g,cur);cur=g.p;const n=B.length===2?1:200;for(let i=1;i<=n;i++){const q=skTxtBzAt(B,i/n).p;pl.push([q[0]*k,q[1]*k]);}});raw.push(pl);});",
    "  let y0=1e9,y1=-1e9;raw.forEach(pl=>pl.forEach(q=>{y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}));let A=0;const NY=3000,dy=(y1-y0)/NY;",
    "  for(let i=0;i<NY;i++){const y=y0+(i+0.5)*dy,X=[];raw.forEach(pl=>{for(let a=0,b=pl.length-1;a<pl.length;b=a++){const P=pl[b],Q=pl[a];if((P[1]<=y)!==(Q[1]<=y))X.push([P[0]+(y-P[1])/(Q[1]-P[1])*(Q[0]-P[0]),Q[1]>P[1]?1:-1]);}});X.sort((u,v)=>u[0]-v[0]);let w=0;for(let j=0;j<X.length;j++){if(w!==0&&j>0)A+=(X[j][0]-X[j-1][0])*dy;w+=X[j][1];}}return A;};",
    "const essai=(nom,C)=>{const F=fake(C);const s2={id:'sF',name:'F',plane:'XY',visible:true,origin:[0,0,0],points:{},entities:[],constraints:[],dims:[],seq:5};ensureSketchBasis(s2);",
    "  const rc={id:skNewEid(s2),t:'text',pa:addPoint(s2,0,0),str:'X',font:{ps:'Fausse'},h:10,ang:0,sp:1,lh:1,al:'g',mir:false};s2.entities.push(rc);skTxtRegen(s2,rc,F);",
    "  const M=skRegionsCached(s2).regs.filter(R=>R.inDef).reduce((t,R)=>t+R.area,0),A=vrai(F);att(Math.abs(M-A)/A<0.005,nom+' : matière '+M.toFixed(3)+' pour '+A.toFixed(3)+' mm²');};",
    "essai('lettre « contour » (4 contours emboîtés)',[sq(0,0,1000,1000,true),sq(100,100,900,900,false),sq(300,300,700,700,true),sq(400,400,600,600,false)]);",
    "essai('deux grandes boucles qui se chevauchent, barre en travers',[cq(500,350,420,true),cq(500,350,250,false),cq(500,1050,380,true),cq(500,1050,220,false),sq(330,650,670,760,true)]);",
    "essai('bord commun dans le même sens (barre collée au bord)',[{s:[0,0],seg:[{k:'L',p:[0,1000]},{k:'L',p:[800,1000]},{k:'Q',c:[800,700],p:[800,400]},{k:'Q',c:[800,200],p:[800,0]},{k:'L',p:[0,0]}]},sq(600,-300,800,600,true)]);",
    "essai('trous d’une police CFF (cercles cubiques, sens PostScript)',[cc(500,500,480,false),cc(500,300,120,true),cc(500,700,150,true)]);",
    // ---------- OpenType CFF ----------
    "if(__otf){const O=fontParse(__otf);skTxtAddFile(__otfName,__otf);p('police CFF : '+O.family+' '+O.style);",
    "  await skTxtEdit(sk,r3.id);Object.assign(skTxt,{ps:O.ps,str:'AB8'});await skTxtApply();skTxtFinish();",
    "  const rr=mat();att(O.kind==='cff'&&rr.length>=3&&sk.entities.some(e=>e.txt&&e.t==='spline'&&e.deg===3),'OpenType CFF : courbes du 3ᵉ degré, '+rr.length+' zones');",
    "  closeSketch(true);try{occCk.length=0;}catch(e){}const F2=occFinalShape(null);const V2=F2&&F2.shape?occShapeVolume(F2.shape):0;",
    "  const a2=rr.reduce((s,r)=>s+r.area,0);att(V2>0&&Math.abs(V2-a2*2)/(a2*2)<0.02,'OpenType CFF extrudé : volume '+V2.toFixed(2)+' mm³');if(F2&&F2.shape)F2.shape.delete();}",
    "else p('  (aucune police .otf sur cet ordinateur : partie CFF sautée)');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  ✗ '+m));}",
    "else{p('');p('TOUT EST CONFORME');}",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'texte.js'});
  console.log('=== V0.96.0 : texte d’esquisse et extrusion ===');
  console.log(r);
  process.exit(/ECHECS/.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
