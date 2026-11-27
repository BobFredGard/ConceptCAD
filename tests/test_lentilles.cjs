// Lentilles (V1.0.19 ; essayées d'abord sur la branche essai/lentilles) — étape 1 : la loupe et la lentille Coupe
// (demande de Fred du 26/11 : « Les Lentilles, oui »). src/91-lentilles.js : plan de coupe face à
// l'écran compté depuis l'avant de la pièce (lensPlaneFor), bornes de la loupe (lensClamp), ajout /
// retrait (lensAdd, lensRemove, lensToggle), loupe sous le curseur (lensAt), profondeur à la molette
// (lensDepthStep), sélection à travers la loupe (Raycaster enveloppé : la matière enlevée ne se prend
// pas), dessin (lensRender : passes dans l'ordre, plans de coupe du moteur et cible rendus intacts,
// aucun matériau du logiciel touché). Vrai three du logiciel, vraie caméra, vrai lancer de rayons sur
// un cube de 40 mm ; le moteur de dessin est un faux qui note ses appels (pas de WebGL sous Node).
// Étape 2 (« Tu peux aller à la suite ») : lentille FAO — temps de coupe des passes sous la loupe
// (lensFaoScan : milieu des segments de coupe dans le cercle, avance de l'opération, rapides et
// opérations masquées exclus), opération et fraise de la zone, texte de l'étiquette, recompte limité
// (lensFaoTick), fraise posée sur la passe (lensToolPlace), passe de dessin (racine FAO allumée
// puis remise, fraise dessinée), rien d'enlevé pour la sélection, rien en PLAN.
// Étape 3 (« FAO sur Coupe ») : zone commune de deux loupes (lensOverlap, lensOverlapMid), fraise posée
// derrière le plan de coupe (lensFaoPick, recherche limitée), passe de dessin de plus limitée à la zone
// commune (pièce coupée, peaux, racine FAO seule coupée, fraise, carré masqué par les deux cercles),
// sélection : la matière enlevée ne se prend pas dans la zone commune, même FAO dessus.
// Étape 4 (lentille PLAN) : la pièce au trait sur papier dans une scène à part (lensPlanSync : papier +
// coque de contour par corps, aucun matériau touché ; lensPlanEdges : arêtes vives / tangentes / cachées,
// lues sur l'affichage des arêtes ou sur le maillage), cotes de la zone (lensPlanScan : Ø des trous, longueurs
// entières sous la loupe, sans doublon ni arête cachée, tour à tour ; lensDimLayout : textes dans le cercle,
// sans chevauchement), recomptées quand la vue est calme (lensPlanTick), recopie sans les tons de l'écran 3D.
// Étape 5 (lentille RENDU) : scène à part où chaque corps prend sa matière de rendu (apparence de rendu, bibliothèque),
// reflets de l'ambiance RENDU préparés une fois, fond tel quel et pièce en tons ACES, matière nommée sous le centre.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const racine=path.join(__dirname,'..');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
const sandbox={console,Math,JSON,Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array,Uint8ClampedArray,
  WeakMap,Map,Set,WeakSet,Promise,Array,Object,Number,String,Boolean,Error,TypeError,RangeError,Symbol,Proxy,Reflect,
  performance:{now:()=>sandbox.__now},__now:0,setTimeout:()=>0,clearTimeout(){},
  localStorage:{getItem(){return null;},setItem(){}},location:{search:''},
  document:{addEventListener(){},getElementById(){return null;},body:null}};
sandbox.window=sandbox;sandbox.self=sandbox;sandbox.addEventListener=()=>{};
const ctx=vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(racine,'threejs','three.min.js'),'utf8'),ctx);
vm.runInContext('var scene=new THREE.Scene(),camera=null,renderer=null,controls=null,bodies=[],__wake=0;function viewWake(){__wake++;}'
  +'var faoRootG=null,faoPrevOps=null,faoPrevGroup=null,__job=null;function faoDoc(){return __job;}'
  +'function faoOpCutting(op,job){return {f:op.__f,plunge:op.__fp,tool:job.tools.find(t=>t.id===op.toolId)};}',ctx);
{ // vraie lecture droite / cercle des références de construction (cgEdgeGeom et ses outils)
  const cg=fs.readFileSync(path.join(racine,'src','78-construction-modele.js'),'utf8');
  const pick=re=>{const m=cg.match(re);if(!m)throw new Error('introuvable : '+re);return m[0];};
  const helpers=cg.split('\n').filter(l=>/^const cg(Add|Sub|Mul|Dot|Cross|Len)=/.test(l)||/^function cgUnit\(/.test(l)).join('\n');
  vm.runInContext(helpers+'\n'+pick(/function cgEdgeGeom\(P\)\{[\s\S]*?\n\}/),ctx,{filename:'78-cgEdgeGeom'});
}
vm.runInContext('var edgeMode=\'on\',__edges=[];function edgeOverlayData(){return __edges;}'
  // lentille RENDU : apparence de rendu, bibliothèque, ambiance — branchées dans la section 9
  +'var vEnvLookOf=null,matDef=null,rdEnvTex=null,REL_ID={brosse:1},REL_TYPES=[[\'brosse\',\'Brossé\']];',ctx);
vm.runInContext(fs.readFileSync(path.join(racine,'src','91-lentilles.js'),'utf8'),ctx,{filename:'91-lentilles.js'});
const r=vm.runInContext(String.raw`(()=>{
  const out=[];const ok=(c,m)=>out.push([!!c,m]);
  const W=1000,H=600;
  const calls=[];
  const rtNow={v:null};
  renderer={domElement:{clientWidth:W,clientHeight:H,parentNode:null},clippingPlanes:[],autoClear:true,
    getDrawingBufferSize(v){return v.set(W*2,H*2);}, // écran à 2 pixels par point
    getRenderTarget(){return rtNow.v;},setRenderTarget(t){calls.push(['cible',t?'loupe':'écran']);rtNow.v=t;},
    clear(){calls.push(['efface',rtNow.v?'loupe':'écran']);},
    getClearColor(c){return c.set(0x101418);},getClearAlpha(){return 1;},setClearColor(c,a){calls.push(['fond',new THREE.Color(c).getHexString()]);},
    render(S,c){calls.push(['dessin',S===scene?'pièce':S===lens.capScene?'peaux':S===lens.quadScene?(lens.quad&&lens.quad.material===lens.quadFlat?'carré-plat':lens.quad&&lens.quad.material===lens.quadRendu?'carré-rendu':'carré'):S===lens.toolScene?'outil':lens.plan&&S===lens.plan.scene?'plan':lens.rendu&&S===lens.rendu.scene?'rendu':'?',rtNow.v?'loupe':'écran',this.clippingPlanes.length,this.autoClear,faoRootG?faoRootG.visible:null]);}};
  camera=new THREE.PerspectiveCamera(50,W/H,0.1,5000);camera.up.set(0,0,1);
  camera.position.set(0,-200,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  controls={target:new THREE.Vector3()};
  const mat=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,color:0x8899aa});
  const cube=new THREE.Mesh(new THREE.BoxGeometry(40,40,40),mat);scene.add(cube);scene.updateMatrixWorld(true);
  bodies=[{id:'b1',visible:true,mesh:cube}];

  // ── 1. plan de coupe : face à l'écran, profondeur comptée depuis l'avant de la pièce ──
  const l0={x:500,y:300,r:100,depth:null};
  const P=new THREE.Plane();
  let info=lensPlaneFor(l0,P);
  ok(Math.abs(info.extent-40)<1e-9&&Math.abs(info.depth-20)<1e-9,'1 : cube de 40 mm vu de face : épaisseur 40, coupe par défaut au milieu ('+info.depth+')');
  ok(Math.abs(P.normal.y-1)<1e-9&&Math.abs(P.distanceToPoint(new THREE.Vector3(0,0,0)))<1e-9,'2 : plan face à l écran (normale = regard), passant par le milieu');
  ok(P.distanceToPoint(new THREE.Vector3(0,-20,0))<0&&P.distanceToPoint(new THREE.Vector3(0,20,0))>0,'3 : face avant enlevée, face arrière gardée');
  l0.depth=5;info=lensPlaneFor(l0,P);
  ok(Math.abs(P.distanceToPoint(new THREE.Vector3(0,-15,0)))<1e-9,'4 : profondeur 5 mm = 5 mm derrière la face avant');
  l0.depth=999;info=lensPlaneFor(l0,P);
  ok(Math.abs(info.depth-40)<1e-9,'5 : profondeur bornée à l épaisseur de la pièce ('+info.depth+')');
  camera.position.set(-200,0,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  l0.depth=null;info=lensPlaneFor(l0,P);
  ok(Math.abs(P.normal.x-1)<1e-9&&P.distanceToPoint(new THREE.Vector3(-20,0,0))<0,'6 : la vue tourne, le plan suit le regard');
  camera.position.set(0,-200,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  // corps fantôme, caché ou transparent : hors du calcul
  const big=new THREE.Mesh(new THREE.BoxGeometry(400,400,400),new THREE.MeshBasicMaterial());scene.add(big);scene.updateMatrixWorld(true);
  bodies.push({id:'g',ghost:true,visible:true,mesh:big});
  ok(Math.abs(lensPlaneFor(l0,P).extent-40)<1e-9,'7 : un corps fantôme ne compte pas dans l épaisseur');
  bodies[1].ghost=false;bodies[1].visible=false;
  ok(Math.abs(lensPlaneFor(l0,P).extent-40)<1e-9,'8 : un corps caché non plus');
  bodies.pop();scene.remove(big);

  // ── 2. loupes : ajout, bornes, retrait ──
  const a=lensAdd('coupe');
  ok(a&&a.x===500&&a.y===300&&Math.abs(a.r-132)<1e-9&&a.depth===null,'9 : loupe posée au centre de la vue, rayon 22 % du petit côté ('+(a&&a.r)+')');
  ok(lens.list.length===1&&__wake>0,'10 : la vue est réveillée');
  a.r=5;lensClamp(a);ok(a.r===LENS_R_MIN,'11 : rayon minimum '+LENS_R_MIN+' points');
  a.r=5000;lensClamp(a);ok(Math.abs(a.r-360)<1e-9,'12 : rayon maximum 60 % du petit côté ('+a.r+')');
  a.x=-50;a.y=9999;lensClamp(a);ok(a.x===0&&a.y===H,'13 : le centre reste dans la vue');
  a.x=500;a.y=300;a.r=48;
  const b=lensAdd('coupe',{x:520,y:300,r:60});
  ok(lensAt(510,300)===b,'14 : deux loupes superposées : la dernière posée est dessus');
  ok(lensAt(5,5)===null,'15 : hors des loupes : aucune');
  lensRemove(b.id);ok(lens.list.length===1&&lensAt(510,300)===a,'16 : × retire la loupe, l autre reste');
  for(let i=0;i<6;i++)lensAdd('coupe');ok(lens.list.length===LENS_MAX,'17 : '+LENS_MAX+' loupes au plus');
  lensToggle();ok(lens.list.length===0,'18 : bouton loupe : tout retiré');
  lensToggle();ok(lens.list.length===1,'19 : bouton loupe : une loupe reposée');
  const l=lens.list[0];l.r=48;

  // ── 3. profondeur à la molette ──
  ok(Math.abs(lensDepthStep(l,1,false)-21)<1e-9,'20 : un cran = 1/40 de l épaisseur (20 → 21 mm)');
  ok(Math.abs(lensDepthStep(l,-1,true)-20.8)<1e-9,'21 : avec Maj, 1/200 (21 → 20,8 mm)');
  for(let i=0;i<80;i++)lensDepthStep(l,-1,false);
  ok(l.depth===0,'22 : butée à la face avant');
  l.depth=null;
  ok(lensFmt(22.5)==='22,5'&&lensFmt(3)==='3,0','23 : profondeur affichée au dixième, virgule française');

  // ── 4. sélection à travers la loupe ──
  const rc=new THREE.Raycaster();
  const ndc=(x,y)=>new THREE.Vector2(x/W*2-1,1-y/H*2);
  rc.setFromCamera(ndc(500,300),camera);
  let hits=rc.intersectObject(cube);
  ok(hits.length===1&&Math.abs(hits[0].point.y-20)<1e-6,'24 : dans la loupe, la face avant enlevée ne se prend plus : seule la face arrière ('+hits.map(h=>h.point.y.toFixed(1))+')');
  hits=rc.intersectObjects([cube],true);
  ok(hits.length===1&&Math.abs(hits[0].point.y-20)<1e-6,'25 : idem pour intersectObjects');
  rc.setFromCamera(ndc(560,300),camera);hits=rc.intersectObject(cube);
  ok(hits.length===2&&Math.abs(hits[0].point.y+20)<1e-6,'26 : hors de la loupe, rien ne change (face avant puis arrière)');
  rc.set(new THREE.Vector3(3,-300,2),new THREE.Vector3(0,1,0));hits=rc.intersectObject(cube);
  ok(hits.length===2,'27 : rayon qui ne part pas de la caméra (outil, reflet…) : rien ne change');
  const keep=lens.list.slice();lens.list.length=0;
  rc.setFromCamera(ndc(500,300),camera);hits=rc.intersectObject(cube);
  ok(hits.length===2,'28 : sans loupe, la sélection est celle d avant');
  lens.list.push(...keep);

  // ── 5. dessin : ordre des passes, rien de touché ──
  const clipBefore=renderer.clippingPlanes;
  calls.length=0;lensRender(scene);
  const seq=calls.map(c=>c.join(' ')).join(' | ');
  const iPiece=calls.findIndex(c=>c[0]==='dessin'&&c[1]==='pièce'),iPeaux=calls.findIndex(c=>c[0]==='dessin'&&c[1]==='peaux'),iCarre=calls.findIndex(c=>c[0]==='dessin'&&c[1]==='carré');
  ok(iPiece>=0&&calls[iPiece][2]==='loupe'&&calls[iPiece][3]===1,'29 : la pièce est redessinée dans la cible de la loupe, coupée par 1 plan ('+seq+')');
  ok(iPeaux>iPiece&&calls[iPeaux][2]==='loupe'&&calls[iPeaux][3]===1&&calls[iPeaux][4]===false,'30 : puis les faces coupées, dans la même cible, sans effacer');
  ok(iCarre>iPeaux&&calls[iCarre][2]==='écran'&&calls[iCarre][3]===0&&calls[iCarre][4]===false,'31 : puis le carré recopié à l écran, sans plan de coupe ni effacement');
  ok(renderer.clippingPlanes===clipBefore&&renderer.autoClear===true&&rtNow.v===null,'32 : plans de coupe, effacement et cible du moteur rendus intacts');
  ok(mat.clippingPlanes===null&&mat.version===0,'33 : aucun matériau de la pièce n est modifié');
  ok(lens.caps.length===1&&lens.capScene.children.length===3,'34 : faces coupées : 2 pochoirs + 1 peau pour le corps');
  const cap=lens.caps[0].cap;
  ok(lens.plane.distanceToPoint(cap.position)>0&&lens.plane.distanceToPoint(cap.position)<0.01,'35 : la peau est posée sur le plan, un rien du côté gardé');
  const ex=new THREE.Color(0x8899aa).multiplyScalar(0.72);
  ok(lens.caps[0].mat.color.equals(ex),'36 : la peau prend la couleur du corps, assombrie');
  const u=lens.quadMat.uniforms;
  ok(u.uC.value.x===1000&&u.uC.value.y===600&&u.uR.value===96&&u.uSize.value.x===2000,'37 : cercle au bon endroit en pixels réels (×2, origine en bas)');
  ok(lens.rt&&lens.rt.stencilBuffer&&lens.rt.width===2000&&lens.rt.scissorTest&&lens.rt.scissor.z<=2*96+6,'38 : cible avec pochoir, limitée au carré de la loupe');
  // une erreur pendant le dessin ne laisse pas le moteur coupé
  const rdr=renderer.render;renderer.render=function(S){if(S===scene)throw new Error('boum');return rdr.apply(this,arguments);};
  let err=null;try{lensRender(scene);}catch(e){err=e;}
  renderer.render=rdr;
  ok(err&&renderer.clippingPlanes===clipBefore&&renderer.autoClear===true&&rtNow.v===null,'39 : erreur en plein dessin : moteur remis comme avant');
  // corps reconstruit : les peaux suivent la nouvelle géométrie
  cube.geometry=new THREE.BoxGeometry(30,30,30);lensRender(scene);
  ok(lens.caps.length===1&&lens.caps[0].geo===cube.geometry,'40 : corps reconstruit : pochoirs refaits sur la nouvelle forme');
  lensClearAll();
  calls.length=0;lensRender(scene);
  ok(calls.length===0&&lens.capScene.children.length===0,'41 : sans loupe : aucun dessin en plus, peaux libérées');

  // ── 6. lentille FAO ──
  // posage : origine sur la face avant du cube (monde y = −20) ; racine FAO cachée comme en CAO
  faoRootG=new THREE.Group();faoRootG.matrixAutoUpdate=false;faoRootG.matrix.makeTranslation(0,-20,0);
  faoRootG.visible=false;scene.add(faoRootG);faoPrevGroup=new THREE.Group();faoRootG.add(faoPrevGroup);
  scene.updateMatrixWorld(true);
  const T1={id:'T1',d:6,kind:'flat'},T2={id:'T2',d:10,kind:'ball'};
  __job={name:'POSAGE1',tools:[T1,T2]};
  const opA={id:'a',toolId:'T1',__f:600,__fp:200},opB={id:'b',toolId:'T2',__f:1200},opH={id:'h',toolId:'T1',__f:600,hidden:true};
  const ligne=(x0,x1,n,z)=>{const mv=[{r:1,x:x0,y:0,z:30},{r:0,x:x0,y:0,z:z}];for(let i=1;i<=n;i++)mv.push({r:0,x:x0+(x1-x0)*i/n,y:0,z:z});mv.push({r:1,x:x1,y:0,z:30});return mv;};
  // A : 20 mm au centre de la vue (4 segments de 5 mm) ; B : loin à droite ; H : au centre mais masquée ;
  // rapides au centre : jamais comptés
  faoPrevOps=new Map([[opA,{src:[{b:{moves:ligne(-10,10,4,0)}}]}],[opB,{src:[{b:{moves:ligne(100,120,2,0)}}]}],
    [opH,{src:[{b:{moves:ligne(-10,10,4,0)}}]}]]);
  ok(lensDur(0.5)==='30 s'&&lensDur(3.5)==='3 min 30 s'&&lensDur(2)==='2 min'&&lensDur(75)==='1 h 15 min'&&lensDur(61/60)==='1 min 01 s','42 : durées lisibles (30 s, 3 min 30 s, 2 min, 1 h 15 min)');
  const fl=lensAdd('fao');
  ok(fl&&fl.kind==='fao'&&fl.x===500&&fl.y===300,'43 : lentille FAO posée au centre');
  fl.r=48;
  // référence à la force brute : segments de COUPE seulement, 20 000 points chacun, part dans le cercle
  const sous=(mv,cx,cy,r)=>{let L=0;for(let i=1;i<mv.length;i++){const a=mv[i-1],m=mv[i];if(m.r)continue;let k=0;const N=20000;
    for(let j=0;j<N;j++){const t=(j+0.5)/N,p=new THREE.Vector3(a.x+(m.x-a.x)*t,a.y+(m.y-a.y)*t-20,a.z+(m.z-a.z)*t).project(camera);
      const sx=(p.x+1)/2*W-cx,sy=(1-p.y)/2*H-cy;if(sx*sx+sy*sy<=r*r)k++;}
    L+=k/N*Math.hypot(m.x-a.x,m.y-a.y,m.z-a.z);}return L;};
  let F=lensFaoScan(fl);
  const LA=ligne(-10,10,4,0),refP=sous(LA.slice(1,6),500,300,48),refPl=sous(LA.slice(0,2),500,300,48),refA=refP+refPl;
  const tA=refP/600+refPl/200;
  ok(F.ok&&Math.abs(refP-20)<0.01&&refPl>1&&Math.abs(F.t-tA)<1e-5,'44 : temps ici = passe sous la loupe à 600 mm/min + bas de la plongée à 200 mm/min ('+(F.t*60).toFixed(3)+' s pour '+(tA*60).toFixed(3)+' s ; '+refP.toFixed(2)+' + '+refPl.toFixed(2)+' mm ; rapides et opération masquée non comptés)');
  ok(F.op===opA&&F.tool===T1&&F.pt&&Math.abs(F.pt[0])<1e-6&&Math.abs(F.pt[2])<1e-9,'45 : opération et fraise de la zone, point de passe le plus proche du centre ('+F.pt+')');
  ok(lensFaoText(F)==='POSAGE1 · Ø6 · ≈ '+lensDur(tA)&&/^POSAGE1 · Ø6 · ≈ \d+ s$/.test(lensFaoText(F)),'46 : étiquette « posage · Ø · temps » ('+lensFaoText(F)+')');
  const v0=__wake;
  __now=1000;fl.fao=null;fl.faoSig='';lensFaoTick(fl);const t0=fl.fao.t;
  fl.x=100;__now=1050;lensFaoTick(fl);
  ok(fl.fao.t===t0&&fl.faoDirty&&__wake>v0,'47 : loupe déplacée : pas de recompte avant 120 ms (la vue reste éveillée pour le faire)');
  __now=1130;lensFaoTick(fl);
  ok(fl.fao.t===0&&!fl.faoDirty&&lensFaoText(fl.fao)==='rien ici','48 : 120 ms après : recompté — « rien ici »');
  const proj=new THREE.Vector3(110,-20,0).project(camera);fl.x=(proj.x+1)/2*W;fl.y=(1-proj.y)/2*H;
  F=lensFaoScan(fl);
  const refB=sous(ligne(100,120,2,0),fl.x,fl.y,48);
  ok(F.op===opB&&F.tool===T2&&Math.abs(F.t*1200-refB)<0.01,'49 : sur l autre passe : son opération, sa fraise Ø10, son avance ('+(F.t*1200).toFixed(3)+' mm pour '+refB.toFixed(3)+')');
  const ops0=faoPrevOps;faoPrevOps=null;
  ok(lensFaoText(lensFaoScan(fl))==='aucun parcours','50 : sans parcours en mémoire : « aucun parcours »');
  // fichier ouvert dont les parcours ne sont pas en mémoire : opérations présentes, sans passes
  faoPrevOps=new Map([[opA,{absent:true,n:0,src:[]}],[opB,{absent:true,n:0,src:[]}]]);
  const sA=lensFaoScan(fl);
  faoPrevOps=new Map([[opH,{src:[{b:{moves:ligne(-10,10,4,0)}}]}]]);
  ok(lensFaoText(sA)==='aucun parcours'&&lensFaoText(lensFaoScan(fl))==='aucun parcours','50 b : opérations sans passes en mémoire, ou seulement masquées : « aucun parcours » (pas « rien ici »)');
  faoPrevOps=ops0;
  // fraise posée sur la passe
  ok(lensToolPlace(F)&&lens.tool&&lens.tool.g.parent===lens.toolScene,'51 : fraise construite dans sa scène à part');
  const tp=new THREE.Vector3().setFromMatrixPosition(lens.tool.g.matrix);
  ok(Math.abs(tp.x-F.pt[0])<1e-9&&Math.abs(tp.y-(-20))<1e-9&&Math.abs(tp.z-0)<1e-9,'52 : bout de la fraise sur la passe, dans le repère du posage ('+tp.toArray().map(v=>v.toFixed(2))+')');
  ok(lens.tool.g.children.length===3,'53 : fraise boule : bout rond + partie coupante + queue');
  const kB=lens.tool.key;lensToolPlace(F);
  ok(lens.tool.key===kB,'54 : même outil : la fraise n est pas refaite');
  // passe de dessin
  fl.x=500;fl.y=300;fl.fao=null;fl.faoSig='';
  calls.length=0;lensRender(scene);
  const iP=calls.findIndex(c=>c[0]==='dessin'&&c[1]==='pièce'),iO=calls.findIndex(c=>c[0]==='dessin'&&c[1]==='outil'),iC=calls.findIndex(c=>c[0]==='dessin'&&c[1]==='carré');
  ok(iP>=0&&calls[iP][2]==='loupe'&&calls[iP][3]===0&&calls[iP][5]===true,'55 : la pièce est redessinée dans la loupe, sans coupe, avec la FAO allumée ('+calls.map(c=>c.join(' ')).join(' | ')+')');
  ok(iO>iP&&calls[iO][2]==='loupe'&&calls[iO][4]===false&&iC>iO&&calls[iC][5]===false,'56 : puis la fraise dans la même image, puis le carré à l écran, FAO de nouveau cachée');
  ok(faoRootG.visible===false&&renderer.autoClear===true&&rtNow.v===null,'57 : racine FAO, effacement et cible remis comme avant');
  const rdr2=renderer.render;renderer.render=function(S){if(S===scene)throw new Error('boum');return rdr2.apply(this,arguments);};
  try{lensRender(scene);}catch(e){}
  renderer.render=rdr2;
  ok(faoRootG.visible===false,'59 : erreur en plein dessin : la FAO reste cachée en CAO');
  rc.setFromCamera(ndc(500,300),camera);hits=rc.intersectObject(cube);
  ok(hits.length===2,'60 : la lentille FAO n enlève rien à la sélection');
  ok(lens.capScene.children.length===0,'61 : lentille FAO seule : aucune peau de coupe');
  const body0=document.body;document.body={getAttribute:()=> 'plan'};
  calls.length=0;lensRender(scene);document.body=body0;
  ok(calls.length===0,'62 : espace PLAN : rien n est dessiné');
  // passe longue qui traverse la loupe sans s'y arrêter : la fraise se pose sur son milieu
  const opL={id:'l',toolId:'T1',__f:600};
  faoPrevOps=new Map([[opL,{src:[{b:{moves:[{r:0,x:-100,y:0,z:0},{r:0,x:100,y:0,z:0}]}}]}]]);
  fl.x=500;fl.y=300;F=lensFaoScan(fl);
  // corde attendue : 2 × 48 points à l'écran, ramenés en mm à 180 mm de la caméra
  const mmpp=2*180*Math.tan(25*Math.PI/180)/H,corde=2*48*mmpp;
  ok(F.op===opL&&F.pt&&Math.abs(F.pt[0])<1e-6&&Math.abs(F.t*600-corde)<0.01,'63 : passe longue qui traverse la loupe : seule la part dans le cercle compte ('+(F.t*600).toFixed(3)+' mm pour '+corde.toFixed(3)+'), fraise au centre ('+F.pt+')');
  // passe en biais (arrière plus loin) : la part comptée suit la perspective
  faoPrevOps=new Map([[opL,{src:[{b:{moves:[{r:0,x:-100,y:-60,z:0},{r:0,x:100,y:60,z:0}]}}]}]]);
  F=lensFaoScan(fl);
  let inside=0;const N=200000;for(let i=0;i<N;i++){const t=(i+0.5)/N,p=new THREE.Vector3(-100+200*t,-20+(-60+120*t),0).project(camera);
    const sx=(p.x+1)/2*W-500,sy=(1-p.y)/2*H-300;if(sx*sx+sy*sy<=48*48)inside++;}
  const vrai=inside/N*Math.hypot(200,120);
  ok(Math.abs(F.t*600-vrai)<0.01,'64 : passe en biais : '+(F.t*600).toFixed(3)+' mm comptés pour '+vrai.toFixed(3)+' mm réellement sous la loupe');
  faoPrevOps=ops0;
  lensClearAll();

  // ── 7. FAO posée sur Coupe : la zone commune montre la pièce coupée et la FAO ──
  cube.geometry=new THREE.BoxGeometry(40,40,40);
  const mid=(a,b)=>{const m=lensOverlapMid(a,b);return m.x.toFixed(2)+','+m.y.toFixed(2);};
  ok(mid({x:0,y:0,r:10},{x:15,y:0,r:10})==='7.50,0.00'&&mid({x:0,y:0,r:50},{x:10,y:0,r:10})==='10.00,0.00'&&mid({x:3,y:4,r:10},{x:3,y:4,r:20})==='3.00,4.00'
    &&lensOverlap({x:0,y:0,r:10},{x:15,y:0,r:10})&&!lensOverlap({x:0,y:0,r:10},{x:25,y:0,r:10}),'65 : milieu de la zone commune (deux loupes, l une dans l autre, même centre) ; loupes séparées : pas de zone commune');
  // deux passes au même endroit de l'écran : l'une devant le plan de coupe (matière enlevée), l'autre derrière
  const ligneY=y=>[{r:1,x:-10,y,z:30},{r:0,x:-10,y,z:0},{r:0,x:0,y,z:0},{r:0,x:10,y,z:0},{r:1,x:10,y,z:30}];
  const opD={id:'d',toolId:'T1',__f:600},opK={id:'k',toolId:'T2',__f:900};
  faoPrevOps=new Map([[opD,{src:[{b:{moves:ligneY(5)}}]}],[opK,{src:[{b:{moves:ligneY(30)}}]}]]);
  const lc=lensAdd('coupe',{x:530,y:300,r:48}),lf2=lensAdd('fao',{x:470,y:300,r:48});
  const pl=new THREE.Plane();lensPlaneFor(lc,pl);
  let Pk=lensFaoPick(lf2,lc,pl);
  ok(Pk.ok&&Pk.op===opK&&Pk.tool===T2&&Pk.pt&&Math.abs(Pk.pt[1]-30)<1e-9&&Math.abs(Pk.pt[0])<1e-6,'66 : la fraise se pose sur la passe restée derrière le plan (dans la matière), pas sur celle d avant ('+Pk.pt+')');
  faoPrevOps=new Map([[opD,{src:[{b:{moves:ligneY(5)}}]}]]);
  Pk=lensFaoPick(lf2,lc,pl);
  ok(Pk.op===opD&&Math.abs(Pk.pt[1]-5)<1e-9,'67 : seule une passe devant le plan : la fraise s y pose quand même');
  faoPrevOps=new Map([[opD,{src:[{b:{moves:ligneY(5)}}]}],[opK,{src:[{b:{moves:ligneY(30)}}]}]]);
  lc.x=560;
  Pk=lensFaoPick(lf2,lc,pl);
  const sp=new THREE.Vector3(Pk.pt[0],Pk.pt[1]-20,Pk.pt[2]).project(camera),sx=(sp.x+1)/2*W;
  ok(Pk.op===opK&&Math.abs(sx-515)<0.01,'68 : fraise au milieu de la zone commune (point écran '+sx.toFixed(3)+' pour 515)');
  lc.x=900;
  ok(!lensFaoPick(lf2,lc,pl).ok,'69 : loupes séparées : rien de commun');
  lc.x=530;
  // dessin : passe de plus, limitée à la zone commune
  const vis=[];const rdr3=renderer.render;
  renderer.render=function(S){vis.push([S===scene?'pièce':S===lens.quadScene?'carré':'x',cube.visible,faoRootG.visible,scene.background,lens.quadMat?lens.quadMat.uniforms.uR2.value:-1]);return rdr3.apply(this,arguments);};
  scene.background=new THREE.Color(0x203040);const bg0=scene.background;
  __now=5000;calls.length=0;lensRender(scene);
  renderer.render=rdr3;
  const lastE=calls.map(c=>c[0]).lastIndexOf('efface'),cb=calls.slice(lastE+1),cs=cb.map(c=>c.slice(1).join(' ')).join(' | ');
  const nCar=calls.filter(c=>c[1]==='carré').length;
  ok(nCar===3&&cb.length===6&&cb[0][1]==='pièce'&&cb[0][3]===1&&cb[0][5]===false&&cb[1][1]==='peaux'&&cb[1][3]===1,'70 : zone commune : la pièce coupée (passes cachées), puis ses faces coupées ('+cs+')');
  ok(cb[2][1]==='pièce'&&cb[2][3]===1&&cb[2][5]===true&&cb[2][4]===false,'71 : puis les passes, coupées par le même plan, par-dessus sans effacer');
  ok(cb[3][1]==='outil'&&cb[3][3]===0&&cb[4][0]==='cible'&&cb[5][1]==='carré'&&cb[5][2]==='écran','72 : puis la fraise entière, puis le carré recopié à l écran');
  const vF=vis.filter(v=>v[0]==='pièce');
  ok(vF.length===4&&vF[3][1]===false&&vF[3][2]===true&&vF[3][3]===null,'73 : pour les passes, seule la racine FAO est dessinée (pièce cachée, sans fond)');
  const vC=vis.filter(v=>v[0]==='carré');
  ok(vC.length===3&&vC[0][4]===0&&vC[1][4]===0&&Math.abs(vC[2][4]-96)<1e-9&&lens.quadMat.uniforms.uR2.value===0,'74 : le dernier carré ne garde que la zone commune aux deux cercles (rayon 2 × 48 px), puis le masque est retiré');
  ok(cube.visible===true&&scene.background===bg0&&faoRootG.visible===false&&renderer.clippingPlanes===clipBefore&&renderer.autoClear===true&&rtNow.v===null,'75 : pièce, fond, racine FAO, plans de coupe, effacement et cible remis comme avant');
  const C=lf2.combo[lc.id].pick,tp2=new THREE.Vector3().setFromMatrixPosition(lens.tool.g.matrix);
  ok(C&&C.op===opK&&Math.abs(tp2.y-10)<1e-9&&Math.abs(tp2.x)<1e-6,'76 : la fraise de la zone commune est sur la passe derrière le plan (y monde '+tp2.y.toFixed(2)+')');
  // recompte limité, comme l'étiquette
  const C0=lf2.combo[lc.id].pick;lc.depth=30;__now=5050;lensRender(scene);
  ok(lf2.combo[lc.id].pick===C0&&lf2.combo[lc.id].dirty,'77 : coupe déplacée : la fraise n est pas recherchée avant 120 ms');
  __now=5200;lensRender(scene);
  ok(lf2.combo[lc.id].pick!==C0&&!lf2.combo[lc.id].dirty,'78 : 120 ms après : recherchée de nouveau');
  lc.depth=null;
  // sélection : dans la zone commune, la matière enlevée ne se prend pas, même si la FAO est dessus
  rc.setFromCamera(ndc(500,300),camera);hits=rc.intersectObject(cube);
  ok(lensAt(500,300)===lf2&&hits.length===1&&Math.abs(hits[0].point.y-20)<1e-6,'79 : zone commune : la face avant enlevée ne se prend pas, la FAO posée dessus n y change rien');
  rc.setFromCamera(ndc(450,300),camera);hits=rc.intersectObject(cube);
  ok(hits.length===2,'80 : sur la FAO seule, hors de la Coupe : rien n est enlevé');
  lc.x=900;calls.length=0;lensRender(scene);
  ok(calls.filter(c=>c[1]==='carré').length===2,'81 : loupes séparées : pas de passe en plus');
  scene.background=null;faoPrevOps=ops0;
  lensClearAll();

  // ── 8. lentille PLAN : la pièce au trait, cotée ──
  faoRootG.parent.remove(faoRootG);faoRootG=null;faoPrevOps=null;
  camera.position.set(0,-200,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  ok(lensNum(10)==='10'&&lensNum(7.6)==='7,6'&&lensNum(16.123)==='16,12'&&lensNum(-0.001)==='0','82 : nombres des cotes : au centième, virgule française, sans zéros inutiles');
  // arêtes du cube de 40 (vives), un trou Ø10 traversant (cercles avant et arrière), une arête tangente
  const cu=[[-20,-20,-20],[20,-20,-20],[20,20,-20],[-20,20,-20],[-20,-20,20],[20,-20,20],[20,20,20],[-20,20,20]];
  const ar=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].map(([i,j])=>({pts:[cu[i],cu[j]],sharp:true}));
  const cercle=(y,r)=>{const pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push([r*Math.cos(a),y,r*Math.sin(a)]);}return {pts,sharp:true};};
  __edges=ar.concat([cercle(-20,5),cercle(20,5),{pts:[[-20,-20,10],[20,-20,10]],sharp:false}]);
  ok(lensEdgeKind(cercle(-20,5).pts).circ&&Math.abs(lensEdgeKind(cercle(-20,5).pts).circ.r-5)<1e-9&&lensEdgeKind(ar[0].pts).line,'83 : arête droite et cercle reconnus (lecture des références de construction)');
  const lp=lensAdd('plan',{x:500,y:300,r:200});
  ok(lp&&lp.kind==='plan'&&LENS_KINDS.plan.nom==='Plan','84 : lentille Plan posée');
  __now=10000;calls.length=0;lensRender(scene);
  const P8=lens.plan,sq=calls.map(c=>c.join(' ')).join(' | ');
  ok(P8&&P8.edges.length===14&&P8.edges.filter(e=>e.k==='D').length===2&&P8.vis.visible&&P8.tan.visible,'85 : 12 arêtes droites + 2 cercles lus ; arêtes vives, tangentes et cachées en trois traits');
  const iF=calls.findIndex(c=>c[0]==='fond'&&c[1]==='f4f6f9'),iPl=calls.findIndex(c=>c[1]==='plan'),iCp=calls.findIndex(c=>c[1]==='carré-plat');
  ok(iF>=0&&iPl>iF&&calls[iPl][2]==='loupe'&&calls[iPl][3]===0&&calls[iPl][4]===false&&calls[iF+2]&&calls[iF+2][0]==='fond'&&calls[iF+2][1]==='101418','86 : fond papier dans la loupe (puis fond du moteur remis), la pièce au trait par-dessus, sans coupe ('+sq+')');
  ok(iCp>iPl&&calls[iCp][2]==='écran'&&!calls.some(c=>c[1]==='pièce')&&lens.quad.material===lens.quadMat,'87 : recopie sans les tons de l écran 3D (papier tel quel), la scène normale n est pas redessinée');
  ok(P8.items.length===1&&P8.items[0].fill.geometry===cube.geometry&&P8.items[0].hull&&P8.scene.children.length===5,'88 : la scène à part reprend la géométrie du corps (papier + coque de contour), sans la copier');
  ok(mat.version===0&&cube.material===mat,'89 : aucun matériau de la pièce n est modifié');
  ok(lp.planDirty&&!lp.dims&&lensPlanText(lp)==='…','90 : vue qui vient de bouger : cotes pas encore posées (« … »)');
  __now=10200;lensRender(scene);
  const dd=(lp.dims||[]).map(c=>c.t+':'+lensNum(c.v));
  ok(dd.join(' ')==='D:10 L:40 L:40'&&lensPlanText(lp)==='3 cotes','91 : vue calme : Ø10 (une fois pour le trou), puis 40 en largeur et 40 en hauteur ; arêtes arrière (cachées) et de profil (trop courtes) écartées ('+dd.join(' ')+')');
  const Ls=lp.dims.filter(c=>c.t==='L');
  const hz=c=>Math.abs(c.B.y-c.A.y)<1e-6,vt=c=>Math.abs(c.B.x-c.A.x)<1e-6;
  ok(Ls.length===2&&Ls.some(hz)&&Ls.some(vt),'92 : une cote par direction (côtés opposés égaux : une seule)');
  const bx=lp.dims.map(c=>c.lay.box);let chev=false;
  for(let i=0;i<bx.length;i++)for(let j=i+1;j<bx.length;j++)if(bx[i].x0<bx[j].x1&&bx[i].x1>bx[j].x0&&bx[i].y0<bx[j].y1&&bx[i].y1>bx[j].y0)chev=true;
  const dedans=bx.every(b=>[[b.x0,b.y0],[b.x1,b.y1],[b.x0,b.y1],[b.x1,b.y0]].every(([x,y])=>Math.hypot(x-500,y-300)<=200-6));
  ok(!chev&&dedans,'93 : textes des cotes dans le cercle, sans chevauchement');
  const Lh=Ls.find(c=>Math.abs(c.B.y-c.A.y)<1e-6);
  ok(Lh&&Math.abs(Lh.lay.T.y-300)>Math.abs((Lh.A.y+Lh.B.y)/2-300),'94 : cote d une arête posée du côté extérieur de la pièce');
  // cercle seulement à l'arrière : caché par la face avant → pas de cote
  __edges=ar.concat([cercle(20,5)]);P8.edgeKey=null;__now=10400;lensRender(scene);__now=10600;lensRender(scene);
  ok(!(lp.dims||[]).some(c=>c.t==='D')&&(lp.dims||[]).length===2,'95 : un cercle caché derrière la face avant n est pas coté');
  // deux trous Ø6 traversants et quatre arcs R4 sur la face avant : « 2× Ø6 », « 4× R4 »
  const cercleX=(x,y,r)=>{const c=cercle(y,r);c.pts=c.pts.map(p=>[p[0]+x,p[1],p[2]]);return c;};
  const arc=(cx,cz,a0)=>{const pts=[];for(let i=0;i<=12;i++){const a=a0+i/12*Math.PI/2;pts.push([cx+4*Math.cos(a),-20,cz+4*Math.sin(a)]);}return {pts,sharp:true};};
  __edges=ar.concat([cercleX(-10,-20,3),cercleX(-10,20,3),cercleX(10,-20,3),cercleX(10,20,3),arc(-12,-12,Math.PI),arc(12,-12,-Math.PI/2),arc(12,12,0),arc(-12,12,Math.PI/2)]);
  P8.edgeKey=null;__now=10610;lensRender(scene);__now=10800;lensRender(scene);
  const tx=(lp.dims||[]).map(c=>lensDimText(c));
  ok(tx.includes('2× Ø6')&&tx.includes('4× R4')&&tx.filter(t=>/Ø6|R4/.test(t)).length===2,'95 b : trous et rayons égaux : une seule cote chacun, avec leur nombre ('+tx.join(' · ')+')');
  __edges=ar.concat([cercle(20,5)]);P8.edgeKey=null;__now=11000;lensRender(scene);__now=11200;lensRender(scene);
  camera.position.set(0,-200,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  // la vue tourne : cotes rangées, puis refaites quand elle s'arrête
  camera.position.set(0,-200,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  __now=11220;lensRender(scene);
  ok(!lp.dims&&lp.planDirty,'96 : la vue bouge : cotes rangées');
  __now=11400;lensRender(scene);
  ok(lp.dims&&lp.dims.length>0&&!lp.planDirty,'97 : la vue s arrête : cotes refaites');
  camera.position.set(0,-200,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  // sélection : la lentille Plan n'enlève rien
  rc.setFromCamera(ndc(500,300),camera);hits=rc.intersectObject(cube);
  ok(hits.length===2,'98 : la lentille Plan n enlève rien à la sélection');
  // sans affichage des arêtes : arêtes du maillage
  edgeMode='off';P8.edgeKey=null;__now=11600;lensRender(scene);
  ok(P8.edges.length===12&&P8.edges.every(e=>e.k==='L'),'99 : arêtes masquées à l écran : la loupe les tire du maillage ('+P8.edges.length+')');
  edgeMode='on';
  // corps reconstruit : la scène à part suit
  cube.geometry=new THREE.BoxGeometry(40,40,40);__now=11800;lensRender(scene);
  ok(P8.items[0].geo===cube.geometry&&P8.scene.children.length===5,'100 : corps reconstruit : papier et coque refaits sur la nouvelle forme');
  lensRemove(lp.id);
  ok(lens.plan===null&&lens.list.length===0,'101 : loupe retirée : scène à part libérée');
  lensClearAll();

  // ── 9. lentille RENDU : la matière réelle ──
  let __rel=null;
  vEnvLookOf=m=>m===cube?{mat:'alu',color:0xd3d6d9,rel:__rel}:{mat:null,color:0x777777,rel:null};
  matDef=k=>k==='alu'?{k:'alu',nom:'Aluminium usiné',metal:1,rough:0.28}:null;
  const lr=lensAdd('rendu',{x:500,y:300,r:120});
  ok(lr&&lr.kind==='rendu'&&LENS_KINDS.rendu.nom==='Rendu','102 : lentille Rendu posée');
  __now=20000;calls.length=0;lensRender(scene);
  const Rd=lens.rendu,it9=Rd&&Rd.items[0],sq9=calls.map(c=>c.join(' ')).join(' | ');
  ok(Rd&&Rd.items.length===1&&it9.o.geometry===cube.geometry&&it9.o.material.isMeshPhysicalMaterial&&it9.o.material.metalness===1&&Math.abs(it9.o.material.roughness-0.28)<1e-9,
    '103 : le corps reçoit sa matière de rendu (aluminium : métal, rugosité 0,28), sur sa propre géométrie');
  ok(it9.o.material.color.equals(new THREE.Color(0xd3d6d9).convertSRGBToLinear()),'104 : couleur de l apparence de rendu, comme l atelier');
  ok(cube.material===mat&&mat.version===0,'105 : la matière de la vue n est pas touchée');
  const iRd=calls.findIndex(c=>c[1]==='rendu'),iCr=calls.findIndex(c=>c[1]==='carré-rendu');
  ok(iRd>=0&&calls[iRd][2]==='loupe'&&calls[iRd][3]===0&&calls[iRd][4]===false&&iCr>iRd&&calls[iCr][2]==='écran'&&!calls.some(c=>c[1]==='pièce')&&lens.quad.material===lens.quadMat,
    '106 : la pièce dans sa matière, dans la loupe, puis recopiée avec les tons du rendu ('+sq9+')');
  { const fq=lens.quadRendu.fragmentShader;
    ok(/lensSrgb\(lensAces\(c\.rgb\)\)/.test(fq)&&/c\.a > 0\.5/.test(fq)&&!/colorspace_fragment|tonemapping_fragment/.test(fq)&&/, 0\.0\); \}$/.test(Rd.bg.material.fragmentShader),
      '107 : tons ACES puis sortie sRGB sur la pièce (comme le Rendu direct), fond de l ambiance écrit tel quel (alpha 0)'); }
  ok(Rd.scene.environment===null,'108 : sans ambiance disponible : pas de reflets, rien ne casse');
  let envN=0,envD=0;rdEnvTex=(pm,amb,rot)=>{envN++;return {rt:{texture:new THREE.Texture(),dispose(){envD++;}},key:[0,0]};};
  Rd.envSig=null;lensRender(scene);const env1=Rd.scene.environment;lensRender(scene);
  ok(env1&&env1.isTexture&&Rd.scene.environment===env1&&envN===1,'109 : reflets de l ambiance RENDU, préparés une seule fois');
  ok(lr.rdName==='Aluminium usiné','110 : étiquette : la matière sous le centre (« '+lr.rdName+' »)');
  const m0=it9.o.material;let freed=false;m0.addEventListener('dispose',()=>{freed=true;});
  __rel={t:'brosse'};__now=20300;lensRender(scene);
  const m1=Rd.items[0].o.material;
  __now=20500;lensRender(scene);
  ok(m1!==m0&&freed&&lr.rdName==='Aluminium usiné · brossé','111 : apparence changée : nouvelle matière (l ancienne libérée), « '+lr.rdName+' »');
  lr.x=40;lr.y=40;__now=20600;lensRender(scene);__now=20800;lensRender(scene);
  ok(lr.rdName==='rien ici','112 : loupe à côté de la pièce : « rien ici »');
  lr.x=500;lr.y=300;
  rc.setFromCamera(ndc(500,300),camera);hits=rc.intersectObject(cube);
  ok(hits.length===2,'113 : la lentille Rendu n enlève rien à la sélection');
  lensRemove(lr.id);
  ok(lens.rendu===null&&envD===1&&lens.list.length===0,'114 : loupe retirée : matières et reflets libérés');
  lensClearAll();
  return out;
})()`,ctx);
for(const [c,m] of r)A(c,m);
console.log(ko?'✗ test_lentilles : '+ko+' échec(s)':'✓ test_lentilles : '+r.length+' contrôles');
process.exit(ko?1:0);
