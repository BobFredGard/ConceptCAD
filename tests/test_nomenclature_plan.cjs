// V0.99.80 : nomenclature de la mise en plan (mepDrawBom) — posée au-dessus d'un cartouche dessiné,
// son bord gauche suit le TRAIT du cartouche, pas le cadre (cartouche Schneider A3H : texte vertical
// « Les informations techniques… » entre le cadre et le trait, caché avant) ; colonne RÉFÉRENCE
// après QTÉ dès qu'une ligne a une référence (pont NumPLans : ref « MERLIN-39-001 », refLabel
// « RÉF. JUSTET »), même largeur totale ; matière vide = case vide, plus de « — ».
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
    const T=window.__mepTest;
    docResetEmpty();
    // modèle à la Schneider A3H : bord du cartouche (trait de toute la hauteur) à 395,51 mm du coin,
    // texte vertical de confidentialité à 398,04 mm (entre le cadre et ce trait), hauteur réservée 60
    const sk={pts:{a:{x:-395.511,y:-276.49},b:{x:-395.511,y:0},c:{x:-395.511,y:-60},d:{x:0,y:-60},t1:{x:-398.042,y:-1.478},t2:{x:-200,y:-30}},
      ents:[{id:'e1',t:'line',p1:'a',p2:'b'},{id:'e2',t:'line',p1:'c',p2:'d'},
        {id:'e3',t:'text',p:'t1',f:'txt',s:'Les informations techniques contenues dans ce document…',h:1.955,al:'start',rot:90},
        {id:'e4',t:'text',p:'t2',f:'tth',h:3}],cons:[],seq:10};
    const M={kind:'sk',name:'Essai A3H',sk,hRes:60.02,page:{format:'A3',orient:'landscape'},
      frame:{l:11,r:9.02,t:9.5,b:11,lw:1,zones:true,zw:42,zh:74,zx0:32,zy0:64.5},vals:{},cust:{}};
    const pack=JSON.parse(JSON.stringify({format:'miniFusion-cartouches',v:1,tbs:{[M.name]:M}})).tbs[M.name];
    const sh=T.sheet();
    T.sk.tbApply(sh,pack);
    // lignes d'un assemblage telles que le pont NumPLans les rend (matière vide = une espace)
    let ROWS=[];
    asmPlanOn=function(){return true;};
    asmBomRows=function(){return ROWS.map(r=>Object.assign({},r));};
    const nl=(ref,lab,mat)=>[1,2,3,4].map(i=>Object.assign({ids:['c'+i],rep:i,qty:1,name:'215-01-00'+i+'-O-Support Guide',mat,dims:'50,0 × 50,9 × 50,0'},ref?{ref:'MERLIN-39-00'+i}:{},lab?{refLabel:lab}:{}));
    sh.bom={on:true,mat:{},lvl:'comp1'};
    const draw=()=>{
      const pd=T.pageDim(sh),ty=pd.H-pd.fr.b-pd.th,els=[];
      T.drawBom((tag,o)=>{const e={tag,a:Object.assign({},o),textContent:'',setAttribute(k,v){this.a[k]=v;}};els.push(e);return e;},sh,pd,ty);
      const rect=els.find(e=>e.tag==='rect'),tx=els.filter(e=>e.tag==='text');
      const hy=Math.max(...tx.map(e=>e.a.y)); // en-tête : la rangée du bas
      const rowEls=k=>{const ys=[...new Set(tx.map(e=>e.a.y))].sort((a,b)=>b-a);return tx.filter(e=>e.a.y===ys[k+1]);};
      // largeur de chaque colonne : entre deux traits verticaux (bords du tableau compris)
      const xs=[...new Set(els.filter(e=>e.tag==='line'&&e.a.x1===e.a.x2).map(e=>e.a.x1))];
      if(rect)xs.push(rect.a.x,rect.a.x+rect.a.width);xs.sort((a,b)=>a-b);
      return {pd,ty,rect,head:tx.filter(e=>e.a.y===hy).map(e=>e.textContent),
        row:k=>rowEls(k).map(e=>e.textContent),rowEls,
        widths:xs.slice(1).map((x,i)=>+(x-xs[i]).toFixed(3)),
        tx:tx.map(e=>e.textContent)};
    };
    // 1-4 : alignement sur le trait du cartouche
    ROWS=nl(true,'RÉF. JUSTET',' ');
    let D=draw();
    const trait=D.pd.ix+D.pd.iw-395.511,texte=D.pd.ix+D.pd.iw-398.042;
    att(near(D.pd.ix,11)&&D.pd.th>59&&D.pd.th<61,'1 : cartouche A3H appliqué (cadre à 11 mm, 60 mm réservés)');
    att(D.rect&&near(D.rect.a.x,trait,1e-3),'2 : bord gauche sur le trait du cartouche ('+(D.rect&&D.rect.a.x.toFixed(2))+' mm, trait à '+trait.toFixed(2)+')');
    att(D.rect&&D.rect.a.x>texte+1.9,'3 : le texte vertical (ancré à '+texte.toFixed(2)+' mm) n’est plus caché');
    att(D.rect&&near(D.rect.a.y+D.rect.a.height,D.ty),'4 : posée au-dessus du cartouche (pas de place à côté)');
    // 5-8 : colonne de référence
    att(D.head.join('|')==='REP.|QTÉ|RÉF. JUSTET|DÉSIGNATION|MATIÈRE|DIMENSIONS (mm)','5 : en-tête avec la colonne de référence après QTÉ : '+D.head.join(' | '));
    att(D.rect&&near(D.rect.a.width,164)&&D.widths.join()==='10,10,30,50,24,40','6 : même largeur totale (164 mm), colonnes '+D.widths.join(' / '));
    const r1=D.row(0);
    att(r1[2]==='MERLIN-39-001'&&r1[3]==='215-01-001-O-Support Guide','7 : référence et désignation entières : '+r1.slice(2,4).join(' / '));
    att(r1[4]===''&&!D.tx.includes('—'),'8 : matière vide (espace du pont) : case vide, pas de « — »');
    const e1=D.rowEls(0);
    att(e1[3].a.lengthAdjust==='spacingAndGlyphs'&&+e1[3].a.textLength<=47.5&&!e1[2].a.textLength&&!e1[5].a.textLength,
      '8b : désignation trop longue pour sa case resserrée (textLength '+e1[3].a.textLength+' mm), référence et dimensions laissées telles quelles');
    // 9 : référence sans titre → « RÉFÉRENCE »
    ROWS=nl(true,'',' ');D=draw();
    att(D.head[2]==='RÉFÉRENCE','9 : référence sans titre : « RÉFÉRENCE » ('+D.head[2]+')');
    // 10-11 : aucune référence (le titre seul ne suffit pas) → colonnes d'avant, matière vide sans « — »
    ROWS=nl(false,'RÉF. JUSTET','');D=draw();
    att(D.head.join('|')==='REP.|QTÉ|DÉSIGNATION|MATIÈRE|DIMENSIONS (mm)'&&D.widths.join()==='10,10,62,40,42'&&!D.rowEls(0)[2].a.textLength,'10 : aucune référence : colonnes d’avant ('+D.head.join(' | ')+')');
    att(!D.tx.includes('—')&&D.row(0)[3]==='','11 : sans référence aussi, matière vide = case vide');
    ROWS=nl(false,'','Acier S235');D=draw();
    att(D.row(0)[3]==='Acier S235','12 : matière renseignée écrite');
    // 16-21 (V1.0.4, « Il faut aussi pouvoir enlever des colonnes au tableau ») : colonnes retirées au
    // choix — le tableau se resserre d'autant, chaque ligne suit, REP. reste (numéro des bulles)
    ROWS=nl(true,'RÉF. JUSTET',' ');
    const w0=draw().rect.a.width;
    sh.bom.hide=['mat','dims'];D=draw();
    att(D.head.join('|')==='REP.|QTÉ|RÉF. JUSTET|DÉSIGNATION'&&D.widths.join()==='10,10,30,50'&&near(D.rect.a.width,100)&&near(w0,164),'16 : MATIÈRE et DIMENSIONS retirées : 4 colonnes, tableau de 164 à 100 mm ('+D.head.join(' | ')+')');
    att(D.row(0).join('|')==='1|1|MERLIN-39-001|215-01-001-O-Support Guide','17 : chaque ligne suit les colonnes gardées : '+D.row(0).join(' / '));
    sh.bom.hide=['rep','qty','ref','name','mat','dims'];D=draw();
    att(D.head.join('|')==='REP.'&&near(D.rect.a.width,10)&&D.row(0).join('|')==='1','18 : REP. ne se retire pas (numéro des bulles)');
    delete sh.bom.hide;D=draw();
    att(D.head.length===6&&T.bomCols(sh,true).length===6&&T.bomCols(sh).length===6,'19 : toutes les colonnes revenues');
    const boxes=()=>{const root=document.createElement('div');T.sideHome(root);const o={};
      (function w(n){if(n.tagName==='INPUT'&&/^Afficher la colonne « (.*) »/.test(n.title||''))o[/« (.*) »/.exec(n.title)[1]]=n;(n.children||[]).forEach(w);})(root);return o;};
    let B=boxes();
    att(Object.keys(B).join('|')==='QTÉ|RÉF. JUSTET|DÉSIGNATION|MATIÈRE|DIMENSIONS (mm)'&&Object.values(B).every(c=>c.checked),'20 : panneau de la planche : une case cochée par colonne, sauf REP. ('+Object.keys(B).join(' | ')+')');
    if(B['MATIÈRE']){B['MATIÈRE'].checked=false;B['MATIÈRE'].onchange();}
    D=draw();B=boxes();
    att(sh.bom.hide&&sh.bom.hide.join()==='mat'&&D.head.indexOf('MATIÈRE')<0&&near(D.rect.a.width,140)&&B['MATIÈRE']&&!B['MATIÈRE'].checked,'21 : case MATIÈRE décochée : colonne retirée du tableau (140 mm), la case reste décochée');
    if(B['MATIÈRE']){B['MATIÈRE'].checked=true;B['MATIÈRE'].onchange();}
    att(!sh.bom.hide&&draw().head.length===6,'22 : recochée : colonne revenue, rien d’écrit dans le fichier');
    ROWS=nl(false,'','Acier S235');
    // 13 : cartouche étroit, pas de place à côté : jamais hors du cadre à droite
    sh.format='A4';sh.orient='portrait';
    const ptsA=sh.title.tb.sk.pts;ptsA.a.x=ptsA.b.x=ptsA.c.x=-100;ptsA.t1.x=-102;ptsA.a.y=-60;
    D=draw();
    att(D.rect&&near(D.rect.a.x+D.rect.a.width,D.pd.ix+D.pd.iw,1e-3)&&D.rect.a.x>=D.pd.ix,'13 : cartouche de 100 mm sur A4 : tableau calé à droite du cadre, dedans ('+(D.rect&&D.rect.a.x.toFixed(1))+' mm)');
    // 14 : place à côté du cartouche : en bas à gauche du cadre, comme avant
    sh.format='A3';sh.orient='landscape';
    D=draw();
    att(D.rect&&near(D.rect.a.x,D.pd.ix)&&near(D.rect.a.y+D.rect.a.height,D.pd.iy+D.pd.ih+D.pd.th),'14 : place à côté du cartouche : en bas à gauche du cadre');
    // 15 : cartouche classique (non dessiné) : au-dessus, contre le cadre, comme avant
    delete sh.title.tb;
    D=draw();
    att(D.rect&&near(D.rect.a.x,D.pd.ix)&&near(D.rect.a.y+D.rect.a.height,D.ty),'15 : cartouche classique : au-dessus, contre le cadre');
    return {ATT,OK};
  `;
  const o=await vm.runInContext('(async function(){'+R+'})()',ctx);
  console.log('=== V0.99.80 : nomenclature de la mise en plan ===');
  o.OK.forEach(m=>console.log('  ✓ '+m));
  if(o.ATT.length){o.ATT.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.ATT.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
