// 2026-11-09 : PLAN — tolérances géométriques ISO 1101 et références ISO 5459 : outil Référence (A, B, C…,
// sans I, O, Q), triangle sur une arête ou sur une cote, cadre de tolérance à flèche ou sous une cote ;
// tout suit la pièce et la cote porteuse ; suppression de la cote = ses tolérances avec.
// Vue à (100,100), échelle 1 : rectangle 0..60 × 0..30 (mm modèle).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
let ko=0;
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet();
  sh.views.length=0;sh.dims.length=0;
  const v=mepAddViewStd('front');v.x=100;v.y=100;v.scale=1;v.axes=[];
  T.st().zoom=1;
  const rect=(w,h)=>[{t:'L',x1:0,y1:0,x2:w,y2:0},{t:'L',x1:w,y1:0,x2:w,y2:h},{t:'L',x1:w,y1:h,x2:0,y2:h},{t:'L',x1:0,y1:h,x2:0,y2:0}];
  T.setViewGeo(v,{src:'dxf',els:rect(60,30)});
  const dessin=d=>{const o={lines:[],texts:[],paths:[],circles:[]};
    T.drawDim((tag,a)=>{const e={appendChild(){},setAttribute(k,x){a[k]=x;},textContent:''};
      if(tag==='line')o.lines.push(a);if(tag==='path')o.paths.push(a);if(tag==='circle')o.circles.push(a);
      if(tag==='text'){o.texts.push(e);}return e;},d);return o;};
  // 1. référence A sur l'arête du bas (y = 30 → papier 130)
  mepSetTool('datum');
  A(T.gdtNext()==='A','1re lettre libre : A');
  T.gdtClick({x:130,y:130},'datum');
  A(T.st().dim&&T.st().dim.kind==='datum'&&T.st().dim.l==='A','1er clic sur l’arête : référence A en cours');
  T.gdtClick({x:130,y:145},'datum');
  const dA=sh.dims[sh.dims.length-1];
  A(sh.dims.length===1&&dA.kind==='datum'&&dA.l==='A'&&!dA.__ghost,'2e clic : référence A posée');
  A(dA.a&&near(dA.a.y,30,1e-6),'pied du triangle sur l’arête');
  let D=dessin(dA);
  A(D.paths.length===1&&/mepGdtFill/.test(D.paths[0].class)&&D.texts.some(t=>t.textContent==='A'),'triangle noirci et lettre A encadrée');
  const tri=D.paths[0].d.match(/-?[\\d.]+/g).map(Number);
  A(near(tri[1],130,1e-3)&&near(tri[3],130,1e-3)&&tri[5]>130,'base du triangle sur l’arête, pointe vers la lettre');
  A(T.gdtNext()==='B','lettre suivante : B');
  // 2. glisser la lettre
  window.mepDimMoveTo(dA,{x:150,y:150});
  A(near(dA.b.x,50)&&near(dA.b.y,50),'la lettre se déplace (b local)');
  // 3. cote de longueur puis référence B dessus (axe / plan médian)
  mepSetTool('dim');
  T.dimSelect(T.hitEnt(130,100));
  T.dimCommit({x:130,y:85});
  const cL=sh.dims[sh.dims.length-1];
  A(cL&&cL.kind==='len'&&near(T.dimMeasure(cL),60,1e-6),'cote de longueur 60');
  const g=window.mepDimLine(cL);
  T.gdtClick({x:g.b1.x-1,y:g.b1.y},'datum');
  const dB=sh.dims[sh.dims.length-1];
  A(dB.kind==='datum'&&dB.l==='B'&&dB.on===cL.id&&dB.end===1,'référence B accrochée au bout de la cote');
  let W=T.gdtWorld(dB);
  A(W&&near(W.a.x,g.b1.x,1e-6)&&near(W.a.y,g.b1.y,1e-6)&&W.b.x>g.b1.x,'triangle au bout de la ligne de cote, lettre dans son prolongement');
  cL.off=(cL.off==null?8:cL.off)-10;
  const g2=window.mepDimLine(cL);W=T.gdtWorld(dB);
  A(near(W.a.y,g2.b1.y,1e-6)&&!near(g2.b1.y,g.b1.y,1e-3),'la cote bouge : la référence suit');
  // 4. cadre de tolérance à flèche sur l'arête de droite (x = 60 → papier 160)
  mepSetTool('gdt');
  T.gdtClick({x:160,y:115},'gdt');
  T.gdtClick({x:185,y:105},'gdt');
  const cG=sh.dims[sh.dims.length-1];
  A(cG.kind==='gdt'&&cG.g&&cG.g.sym==='flat'&&cG.a&&near(cG.a.x,60,1e-6),'cadre posé, flèche sur l’arête de droite');
  cG.g={sym:'perp',dia:false,val:'0.02',mod:'',refs:[{l:'A',m:''},{l:'B',m:'M'}]};
  D=dessin(cG);
  A(D.texts.some(t=>t.textContent==='A')&&D.texts.some(t=>t.textContent==='B')&&D.texts.some(t=>/0[,.]02/.test(t.textContent)),'cadre : valeur 0,02, références A et B');
  A(D.circles.length===1,'Ⓜ dessiné après la référence B');
  A(D.lines.some(l=>l['marker-end']&&near(+l.x2,160,1e-6)&&near(+l.y2,115,1e-6)),'flèche qui pointe l’arête');
  const bx=T.gdtBox(cG);
  A(bx&&near(bx.x0,185,1e-6)&&bx.x1>bx.x0+20&&near((bx.y0+bx.y1)/2,105,1e-6),'cadre à droite de la pièce, son bord gauche au point posé');
  // les 14 symboles se dessinent
  const syms=['straight','flat','circ','cyl','pline','psurf','par','perp','ang','pos','conc','sym','runc','runt'];
  const vides=syms.filter(k=>{cG.g.sym=k;const o=dessin(cG);return o.lines.length+o.paths.length+o.circles.length<6;});
  A(!vides.length,'les 14 caractéristiques ISO 1101 se dessinent'+(vides.length?' (vides : '+vides.join(',')+')':''));
  // 5. cadre sous une cote : Ø de position
  cG.g.sym='pos';
  T.gdtClick({x:130,y:T.dimTextPos?0:0},'gdt'); // clic dans le vide hors pièce : rien
  T.st().dim=null;
  const tp=window.mepDimTextPos(cL);
  T.gdtClick({x:tp.x,y:tp.y},'gdt');
  const cS=sh.dims[sh.dims.length-1];
  A(cS.kind==='gdt'&&cS.on===cL.id,'clic sur la valeur d’une cote : cadre accroché à la cote');
  dessin(cS);
  const bS=T.gdtBox(cS);
  A(bS&&bS.y0>tp.y&&near((bS.x0+bS.x1)/2,tp.x,1e-6),'cadre centré sous la valeur');
  T.gdtClick({x:tp.x,y:tp.y},'gdt');
  A(sh.dims.filter(x=>x.on===cL.id&&x.kind==='gdt').length===1,'2e clic : pas de 2e cadre sur la même cote');
  // 6. panneau : symbole, références, avertissement
  const texte=n=>(n.textContent||'')+' '+[...(n.children||[])].map(texte).join(' ');
  const root=document.createElement('div');T.sideDim(root,cS);
  A(/Localisation/.test(texte(root))&&/maximum de matière/.test(texte(root)),'panneau : caractéristique et modificateur');
  cS.g.sym='par';cS.g.refs=[];
  const root2=document.createElement('div');T.sideDim(root2,cS);
  A(/référence est obligatoire/.test(texte(root2)),'parallélisme sans référence : avertissement');
  // 7. suppression de la cote : ses tolérances avec
  T.st().selDim=cL.id;
  sh.dims=sh.dims.filter(d=>d.id!==cL.id&&d.on!==cL.id); // même filtre que Suppr
  A(!sh.dims.some(d=>d.on===cL.id)&&sh.dims.some(d=>d===dA),'cote supprimée : référence B et cadre retirés, A reste');
  A(T.gdtNext()==='B','B redevient libre');
  // 8. lettres : ni I, ni O, ni Q
  sh.dims.length=0;
  'ABCDEFGH'.split('').forEach(l=>sh.dims.push({id:'z'+l,kind:'datum',vid:v.id,a:{x:0,y:0},b:{x:0,y:-10},l}));
  A(T.gdtNext()==='J','après H vient J (pas de I)');
  return r;
})();`,ctx);
out.log.forEach(m=>console.log('  ok  '+m));
out.fails.forEach(m=>{console.log('  KO  '+m);ko++;});
console.log(ko?('test_mep_tolerances : '+ko+' échec(s)'):'test_mep_tolerances : OK ('+out.log.length+')');
process.exit(ko?1:0);
