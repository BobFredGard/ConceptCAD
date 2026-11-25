// V0.99.81 : outil Projeter, appui long = liste de tout ce qui est sous le clic, arêtes des AUTRES
// PIÈCES de l'assemblage comprises (50-esquisse-1 projectEdgesAt, 60 skProjeterClic / skProjeterPr,
// 90-15 skProjChoixListe). Demande de Fred : « quand je travaille dans une pièce de l'assemblage,
// je voudrais pour projeter une arête d'une autre pièce […] je reste appuyé et une fenêtre me
// montre les arêtes disponibles du modèle et des autres ».
// Banc sans noyau : arêtes de la pièce active fournies par un faux solide ({edges}), arêtes du
// socle injectées dans son instantané (_snap.pedges), comme test_composants_aretes_esquisse.
// La pièce et le socle ont une arête au MÊME tracé vu depuis le plan : le clic ordinaire prend
// celle de la pièce ; seule la liste donne accès à celle du socle.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};
    confirm=function(){return true;};alert=function(){};
    const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
    const at=(o,x)=>{o.fr={o:x,x:[1,0,0],y:[0,1,0],z:[0,0,1]};};
    const attendre=ms=>new Promise(r=>setTimeout(r,ms));
    docResetEmpty();doc.name='Banc';asmEnsure();
    const Rt=asmRoot();
    const A=asmNewComp('Socle').comp,oA=Rt.occ[0];
    const B=asmNewComp('Capot').comp,oB=Rt.occ[1];
    at(oA,[0,0,0]);at(oB,[0,0,0]);
    const ligne=(y,z)=>{const p=[];for(let i=0;i<=10;i++)p.push([2*i,y,z]);return {pts:p,mid:[10,y,z]};};
    // socle : une arête DANS le plan d'esquisse du capot (z0), y=0, x 0 → 20 ; une autre à y=30
    const inject=(y,h)=>{A._snap=A._snap||{items:[],edges:null};A._snap.pedges=[ligne(y,0),ligne(30,0)];A._snap.hash=h;};
    inject(0,'h1');
    asmActivatePath([oB.id]);
    const sk={id:'skc',name:'Esquisse capot',plane:'XY',visible:true,origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[],seq:1};
    doc.sketches.push(sk);markDirty();rebuild();
    inject(0,'h1'); // un rejeu peut avoir recapturé le socle
    // pièce active (capot) : une arête au même tracé, mais 5 mm SOUS le plan (z=-5)
    const _occHas=occHas,_occRefShape=occRefShape,_occLive=occLive;
    const piece={edges:[ligne(0,-5)]};
    occHas=()=>true;occRefShape=()=>piece;occLive={shape:piece};
    openSketch('skc');skView.s=4;skUpdateTols();
    const sk2=skEdit;
    // ── 1. le clic ordinaire : l'arête de la pièce gagne (celle du socle est inatteignable) ──
    const p0=projectEdgeAt(sk2,10,0.05);
    att(p0&&p0.type==='line'&&!p0.ext&&near(p0.y1,0)&&near(p0.y2,0),'1 : clic ordinaire : l’arête de la pièce gagne, pas celle du socle');
    // ── 2. la liste : les deux arêtes, celle du plan d'abord ──
    const L=projectEdgesAt(sk2,10,0.05);
    att(L.length===2,'2 : la liste trouve 2 arêtes sous le clic ('+L.length+')');
    att(L[0]&&L[0].src==='ext'&&L[0].pr.ext&&L[0].pr.ext.path.join()===oA.id&&L[0].nom==='Socle:1'&&near(L[0].dz,0),'3 : 1ʳᵉ ligne : l’arête du socle, dans le plan, avec le nom de l’instance');
    att(L[1]&&L[1].src==='piece'&&!L[1].pr.ext&&near(L[1].dz,5),'4 : 2ᵉ ligne : l’arête de la pièce, à 5 mm du plan');
    att(projectEdgesAt(sk2,10,40).length===0,'5 : loin de tout : liste vide');
    const rows=skProjChoixListe(sk2,10,0.05);
    att(rows[0].txt==='Arête L20'&&rows[0].note.indexOf('pièce « Socle:1 »')===0&&rows[0].note.indexOf('dans le plan')>0,'6 : libellé de l’autre pièce : « '+rows[0].txt+' · '+rows[0].note+' »');
    att(rows[1].note.indexOf('cette pièce « Capot »')===0&&rows[1].note.indexOf('à 5 mm du plan')>0,'7 : libellé de la pièce : « '+rows[1].note+' »');
    // ── souris ──
    skTool='project';
    const C=(wx,wy)=>{const r=svg.getBoundingClientRect();const p=w2s(wx,wy);return [r.left+p[0],r.top+p[1]];};
    const ev=(type,x,y,extra)=>{const r=Object.assign({type:type,button:0,buttons:0,shiftKey:false,pointerType:'mouse',
      ctrlKey:false,altKey:false,detail:1,pointerId:1,preventDefault:function(){},stopPropagation:function(){},stopImmediatePropagation:function(){}},extra||{});
      r.clientX=x;r.clientY=y;return r;};
    const bas=(wx,wy)=>{const p=C(wx,wy);svg.dispatchEvent(ev('pointerdown',p[0],p[1],{buttons:1}));};
    const haut=(wx,wy)=>{const p=C(wx,wy);svg.dispatchEvent(ev('pointerup',p[0],p[1]));};
    const proj=()=>skEdit.entities.filter(e=>e.proj);
    // ── 8. clic court : projeté au relâcher, l'arête de la pièce ──
    bas(10,0.05);
    att(proj().length===0,'8 : rien n’est projeté à l’appui (on attend le relâcher)');
    haut(10,0.05);
    att(proj().length===1&&!proj()[0].ext,'9 : clic court : l’arête de la pièce est projetée au relâcher');
    await attendre(650);
    att(!choixMenuOuvert(),'10 : clic court : aucune liste ne s’ouvre ensuite');
    // ── 11. appui long : la liste s'ouvre, le relâcher ne projette rien ──
    bas(10,0.05);
    await attendre(650);
    att(choixMenuOuvert()&&choixMenu.items.length===2,'11 : appui long : la liste s’ouvre avec 2 arêtes');
    att(/Projeter — 2 éléments sous le clic \\(dont 1 d’autres pièces\\)/.test(choixMenu.el.children[0].textContent),'12 : titre « '+choixMenu.el.children[0].textContent+' »');
    haut(10,0.05);
    att(proj().length===1,'13 : relâcher avec la liste ouverte : rien de plus n’est projeté');
    choixMenuActive(1);
    att(skProjectHover===choixMenu.items[1].pr,'14 : survol d’une ligne : l’élément s’allume en orange');
    choixMenuActive(0);
    choixMenuValider();
    const x=proj().find(e=>e.ext);
    att(proj().length===2&&x&&x.ext.path.join()===oA.id&&x.ext.ctx.join()===oB.id&&x.ext.sig,'15 : choix de l’arête du socle : projetée, liée à l’instance du socle');
    att(!choixMenuOuvert()&&skProjectHover===null,'16 : liste fermée, plus rien d’allumé');
    att(/de « Socle » \\(suit ce composant\\)/.test((document.getElementById('skStatus')||{}).textContent||''),'17 : message : « '+((document.getElementById('skStatus')||{}).textContent||'')+' »');
    // ── 18. Échap : rien de projeté ──
    bas(10,0.05);await attendre(650);
    att(choixMenuOuvert(),'18 : nouvel appui long : liste ouverte');
    choixMenuFermer();haut(10,0.05);
    att(proj().length===2&&skProjectHover===null,'19 : liste fermée sans choix : rien de projeté');
    // ── 20. une seule arête sous le clic : pas de liste, le relâcher la projette ──
    bas(10,30);await attendre(650);
    att(!choixMenuOuvert(),'20 : une seule arête sous le clic : pas de liste');
    haut(10,30);
    att(proj().length===3&&proj().some(e=>e.ext&&e.t==='line'&&near(skEdit.points[e.p1].y,30)),'21 : …et le relâcher la projette (arête du socle à y=30)');
    // ── 22. l'arête choisie suit le socle ──
    closeSketch(true);
    occHas=_occHas;occRefShape=_occRefShape;occLive=_occLive;
    asmPush('déplacer');at(oA,[0,7,0]);
    att(asmExtStale().includes(B),'22 : socle déplacé : capot signalé à rejouer');
    asmExtSync();inject(0,'h1');
    const s3=B.doc.sketches.find(s=>s.id==='skc'),e3=s3&&s3.entities.find(e=>e.ext&&near(s3.points[e.p1].y,7,1e-3));
    att(!!e3&&near(s3.points[e3.p2].y,7,1e-3),'23 : l’arête choisie dans la liste suit le socle (y 0 → 7)');
    return {ATT,OK};
  `;
  const o=await vm.runInContext('(async function(){'+R+'})()',ctx);
  console.log('=== V0.99.81 : Projeter — appui long, arêtes des autres pièces ===');
  o.OK.forEach(m=>console.log('  ✓ '+m));
  if(o.ATT.length){o.ATT.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.ATT.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
  process.exit(0);
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
