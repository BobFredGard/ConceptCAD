// V1.0.8 — Zoom et déplacement de la vue 3D qui ne s'emballent plus (demande de Fred : « Des fois, le
// zoom part trop vite et le déplacement devient incontrôlable »). src/10-scene-3d.js : viewVoidPoint
// (molette dans le vide : profondeur de la pièce voisine, plus le plan de la cible loin derrière),
// viewPanBy / viewPanDown / viewPanMove (le point saisi au clic droit reste sous le curseur, rien ne
// glisse après le lâcher), orbitTick (amorti du zoom compté en millisecondes, VIEW_ZOOM_TAU) et
// orbitZoomWheel (zoom en attente plafonné, VIEW_ZOOM_PEND_MAX).
// V1.0.9 (Fred : « Oui, la rotation aussi ») : inertie de la rotation comptée en temps (ORBIT_ROT_TAU).
// Vrai three du logiciel, vraie caméra, vrai lancer de rayons sur un cube de 40 mm ; la souris et
// les images sont rejouées à la main (heure de performance.now pilotée par le test).
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const racine=path.join(__dirname,'..');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
const L={}; // écouteurs posés par orbitWire
const on=k=>(t,f)=>{(L[k+t]=L[k+t]||[]).push(f);};
let T=1000;
const sandbox={console,Math,JSON,Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array,Uint8ClampedArray,
  WeakMap,Map,Set,WeakSet,Promise,Array,Object,Number,String,Boolean,Error,TypeError,RangeError,Symbol,Proxy,Reflect,
  performance:{now:()=>T},setTimeout,clearTimeout,
  localStorage:{getItem(){return null;},setItem(){}},location:{search:''},
  document:{addEventListener(){},getElementById(){return null;},body:null}};
sandbox.window=sandbox;sandbox.self=sandbox;
sandbox.addEventListener=on('win:');sandbox.requestAnimationFrame=()=>0;
const ctx=vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(racine,'threejs','three.min.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(racine,'threejs','OrbitControls.js'),'utf8'),ctx);
vm.runInContext('var scene=null,camera=null,renderer=null,controls=null,rayc=new THREE.Raycaster(),bodies=[],skEdit=null,viewUserMoved=false;',ctx);
vm.runInContext(fs.readFileSync(path.join(racine,'src','10-scene-3d.js'),'utf8'),ctx,{filename:'10-scene-3d.js'});
sandbox.__L=L;sandbox.__on=on;sandbox.__tick=dt=>{T+=dt;};
const r=vm.runInContext(String.raw`(()=>{
  const out=[];const ok=(c,m)=>out.push([!!c,m]);
  const W=1000,H=600;
  renderer={domElement:{clientWidth:W,clientHeight:H,style:{},ownerDocument:{},
    getBoundingClientRect(){return {left:0,top:0,right:W,bottom:H,width:W,height:H};},
    addEventListener:__on('el:'),removeEventListener(){},setPointerCapture(){},releasePointerCapture(){}}};
  camera=new THREE.PerspectiveCamera(50,W/H,0.1,5000);camera.up.set(0,0,1);
  const cube=new THREE.Mesh(new THREE.BoxGeometry(40,40,40),new THREE.MeshBasicMaterial());cube.updateMatrixWorld(true);
  bodies=[{id:'b1',visible:true,mesh:cube}];
  controls={target:new THREE.Vector3(),enabled:true,enableDamping:true,enableRotate:true,rotateSpeed:1,mouseButtons:{},
    update(){camera.lookAt(this.target);camera.updateMatrixWorld();}};
  orbitWire(renderer.domElement);
  const fire=(k,ev)=>(__L[k]||[]).forEach(f=>f(ev));
  const pev=(x,y,btn,buttons,mods)=>Object.assign({clientX:x,clientY:y,button:btn,buttons,pointerId:1,ctrlKey:false,metaKey:false,shiftKey:false,preventDefault(){},stopPropagation(){}},mods||{});
  const down=(x,y,btn,mods)=>fire('el:pointerdown',pev(x,y,btn,btn===2?2:btn===1?4:1,mods));
  const move=(x,y,buttons,mods)=>fire('win:pointermove',pev(x,y,-1,buttons,mods));
  const up=(x,y,btn)=>fire('win:pointerup',pev(x,y,btn,0));
  const wheel=(x,y,dy)=>orbitZoomWheel({deltaY:dy,deltaMode:0,clientX:x,clientY:y,preventDefault(){}});
  const frame=dt=>{__tick(dt);orbitTick();controls.update();};
  const settle=()=>{for(let i=0;i<200&&_fz;i++)frame(1000/60);};
  const proj=P=>{camera.updateMatrixWorld();const v=P.clone().project(camera);return [(v.x+1)/2*W,(1-v.y)/2*H];};
  const depth=P=>viewDepthOf(P);
  const IN=-100; // « inverser le zoom » non coché : molette vers l'avant = rapprocher
  // vue : caméra 200 mm devant le cube (face avant à 180 mm) ; cible en option loin derrière
  const place=tgtY=>{camera.position.set(0,-200,0);controls.target.set(0,tgtY,0);camera.up.set(0,0,1);controls.update();
    _fz=null;_fzHit=null;_fp=null;frame(1000/60);};
  const front=()=>depth(new THREE.Vector3(camera.position.x,-20,camera.position.z)); // profondeur de la face avant
  const near=()=>{let m=Infinity;for(let x=0;x<=W;x+=20)for(let y=0;y<=H;y+=20){const h=viewHitAt(x,y);if(h){const d=depth(h);if(d<m)m=d;}}return m;};

  // ── 1. molette SUR la pièce : inchangé — le point visé reste sous le curseur, 15 % par cran ──
  place(0);
  wheel(500,300,IN);settle();
  const p1=proj(new THREE.Vector3(0,-20,0));
  ok(Math.abs(p1[0]-500)<1e-6&&Math.abs(p1[1]-300)<1e-6,'1 : sur la pièce, le point visé reste sous le curseur ('+p1.map(v=>v.toFixed(4))+')');
  ok(Math.abs(front()/180-Math.exp(-0.16))<2e-4,'2 : un cran rapproche de 15 % (face avant '+front().toFixed(3)+' mm)');
  for(let i=0;i<60;i++){wheel(500,300,IN);settle();}
  ok(front()>=0.5-1e-9&&front()<0.6,'3 : butée à 0,5 mm du point visé respectée ('+front().toFixed(4)+')');

  // ── 2. molette dans le VIDE, cible loin derrière (1 000 mm) : la pièce ne fonce plus sur la caméra ──
  const vide=n=>{place(800);const v=[];let d0=near();for(let i=0;i<n;i++){wheel(650,300,IN);settle();const d=near();v.push(d/d0);d0=d;}return v;};
  place(800);ok(!viewHitAt(650,300),'4 : le curseur (650, 300) est bien dans le vide');
  const P0=(place(800),viewAimAt(650,300));
  ok(Math.abs(depth(P0)-180)<1e-6,'5 : point visé dans le vide à la profondeur de la pièce voisine (180 mm, pas 1 000 : '+depth(P0).toFixed(3)+')');
  const v1=vide(10);
  ok(v1.every(k=>Math.abs(k-Math.exp(-0.16))<0.02),'6 : dans le vide aussi, chaque cran rapproche la pièce de 15 % ('+v1.map(k=>k.toFixed(3)).join(' ')+')');
  ok(near()>0&&near()<Infinity,'7 : 10 crans dans le vide : la pièce est toujours devant la caméra ('+near().toFixed(2)+' mm)');
  // ancien comportement rejoué (plan de la cible) : le premier cran avale 82 % de la distance, le second traverse
  const vvp=viewVoidPoint;viewVoidPoint=function(){return null;};
  const v0=vide(2);viewVoidPoint=vvp;
  ok(!(v0[0]>0.8),'8 : ancien comportement rejoué (plan de la cible) : la pièce fonce sur la caméra ('+v0.map(k=>k.toFixed(3)).join(' ')+') — attendu : échec de l essai 6');
  // rien autour du curseur : centre des pièces ; aucune pièce : plan de la cible
  place(800);
  const P2=viewAimAt(990,10);
  ok(Math.abs(depth(P2)-200)<1e-6,'9 : aucune pièce autour du curseur : profondeur du centre des pièces (200 mm : '+depth(P2).toFixed(3)+')');
  bodies=[];const P3=viewAimAt(650,300);bodies=[{id:'b1',visible:true,mesh:cube}];
  ok(Math.abs(depth(P3)-1000)<1e-6,'10 : aucune pièce affichée : plan de la cible, comme avant ('+depth(P3).toFixed(3)+')');

  // ── 3. amorti du zoom en TEMPS : même douceur à 60 images/s, fini aussitôt sur une pièce lourde ──
  place(0);wheel(500,300,IN);frame(1000/60);
  const f60=Math.log(front()/180)/-0.16;
  ok(Math.abs(f60-0.3)<0.005,'11 : 60 images/s : 30 % du cran à la première image, comme avant ('+(f60*100).toFixed(1)+' %)');
  place(0);wheel(500,300,IN);frame(200);
  const f5=Math.log(front()/180)/-0.16;
  ok(f5>0.98,'12 : 5 images/s : le cran est appliqué dès la première image ('+(f5*100).toFixed(1)+' %)');
  const dampF=viewDampF;viewDampF=function(){return 0.3;}; // ancien amorti : 30 % par image quelle que soit la cadence
  place(0);wheel(500,300,IN);frame(200);viewDampF=dampF;
  const f5a=Math.log(front()/180)/-0.16;
  ok(!(f5a>0.98),'13 : ancien comportement rejoué (30 % par image) : à 5 images/s il traînait ('+(f5a*100).toFixed(1)+' % à la première image) — attendu : échec de l essai 12');
  // molette lancée ou images très lentes : au plus ≈ 4 crans en attente
  place(0);for(let i=0;i<20;i++)wheel(500,300,IN);
  ok(Math.abs(_fz.ln+VIEW_ZOOM_PEND_MAX)<1e-12,'14 : 20 crans avant la moindre image : zoom en attente plafonné ('+_fz.ln.toFixed(3)+')');
  settle();
  ok(Math.abs(front()/180-Math.exp(-VIEW_ZOOM_PEND_MAX))<2e-4,'15 : pas de bond : ×'+(180/front()).toFixed(2)+' au plus');
  place(0);wheel(500,300,-IN);settle();
  ok(Math.abs(front()/180-Math.exp(0.16))<2e-4,'16 : dans l autre sens, un cran éloigne de 17 %');

  // ── 4. déplacement au clic droit : le point saisi reste sous le curseur ──
  place(800); // cible loin derrière : l'ancien déplacement allait 5,6 fois trop vite
  const S=new THREE.Vector3(0,-20,0);
  down(500,300,2);for(let i=1;i<=5;i++)move(500+24*i,300-12*i,2);
  const s1=proj(S);
  ok(Math.abs(s1[0]-620)<1e-6&&Math.abs(s1[1]-240)<1e-6,'17 : clic droit glissé de (120, −60) px : le point saisi suit la souris au pixel près ('+s1.map(v=>v.toFixed(4))+')');
  ok(Math.abs(depth(S)-180)<1e-9&&Math.abs(depth(controls.target)-1000)<1e-9,'18 : déplacement parallèle à l écran (profondeurs inchangées)');
  up(620,240,2);
  const c1=camera.position.clone();for(let i=0;i<60;i++)frame(1000/60);
  ok(camera.position.equals(c1),'19 : rien ne glisse après le lâcher');
  ok(viewUserMoved===true,'20 : la vue est marquée « bougée par l utilisateur » (pas de recadrage automatique)');
  // ancien comportement rejoué : profondeur de la cible
  place(800);const aim=viewAimAt;viewAimAt=function(x,y){return viewTargetPlaneAt(x,y);};
  down(500,300,2);for(let i=1;i<=5;i++)move(500+24*i,300-12*i,2);up(620,240,2);viewAimAt=aim;
  const s0=proj(S);
  ok(!(Math.abs(s0[0]-620)<1),'21 : ancien comportement rejoué (vitesse de la cible) : la pièce part à x = '+s0[0].toFixed(1)+' au lieu de 620 — attendu : échec de l essai 17');
  // dans le vide : la pièce voisine suit la souris
  place(800);const E=new THREE.Vector3(20,-20,0),e0=proj(E);
  down(650,300,2);move(600,350,2);up(600,350,2);
  const e1=proj(E);
  ok(Math.abs(e1[0]-e0[0]+50)<1e-6&&Math.abs(e1[1]-e0[1]-50)<1e-6,'22 : saisi dans le vide : le bord de la pièce voisine suit la souris (Δ = '+(e1[0]-e0[0]).toFixed(3)+', '+(e1[1]-e0[1]).toFixed(3)+')');
  // Ctrl + molette enfoncée : même déplacement
  place(800);down(500,300,1,{ctrlKey:true});move(560,330,4,{ctrlKey:true});up(560,330,1);
  const m1=proj(S);
  ok(Math.abs(m1[0]-560)<1e-6&&Math.abs(m1[1]-330)<1e-6,'23 : Ctrl + molette enfoncée glissée : même déplacement ('+m1.map(v=>v.toFixed(3))+')');
  // ce qui ne déplace pas : Ctrl / Maj + clic droit (rotation), clic gauche, molette seule, esquisse, vue bloquée
  const fige=(nom,f)=>{place(800);const c=camera.position.clone();f();ok(camera.position.equals(c)&&_fp===null,'24 : pas de déplacement : '+nom);};
  fige('Ctrl + clic droit',()=>{down(500,300,2,{ctrlKey:true});move(560,330,2,{ctrlKey:true});up(560,330,2);});
  fige('Maj + clic droit',()=>{down(500,300,2,{shiftKey:true});move(560,330,2,{shiftKey:true});up(560,330,2);});
  fige('clic droit court (menu)',()=>{down(500,300,2);up(500,300,2);});
  fige('esquisse ouverte',()=>{skEdit={id:'s'};down(500,300,2);move(560,330,2);up(560,330,2);skEdit=null;});
  fige('vue bloquée (manipulateur, film)',()=>{controls.enabled=false;down(500,300,2);move(560,330,2);up(560,330,2);controls.enabled=true;});
  fige('bouton lâché hors de la fenêtre',()=>{down(500,300,2);move(500,300,0);move(560,330,0);});
  // ── 5. V1.0.9 : rotation — inertie comptée en temps (« Oui, la rotation aussi ») ──
  // clic gauche glissé de 100 px vers la droite, lâché, puis des images : azimut autour du point saisi
  const Pv=new THREE.Vector3(0,-20,0),az=()=>Math.atan2(camera.position.y-Pv.y,camera.position.x-Pv.x);
  const TOT=100*2*Math.PI/H; // angle total d'un glisser de 100 px (vitesse inchangée)
  const tourne=()=>{place(0);_fo=null;const a0=az();down(500,300,0);for(let i=1;i<=5;i++)move(500+20*i,300,1);up(600,300,0);return a0;};
  const part=a0=>{let d=az()-a0;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return Math.abs(d)/TOT;};
  let a0=tourne();frame(1000/60);
  ok(Math.abs(part(a0)-0.2)<0.005,'27 : rotation à 60 images/s : 20 % du glissement à la première image, comme avant ('+(part(a0)*100).toFixed(1)+' %)');
  for(let i=0;i<300&&_fo;i++)frame(1000/60);const fin60=part(a0);
  a0=tourne();frame(200);frame(200);const r5=part(a0);
  ok(r5>0.99,'28 : rotation à 5 images/s : arrêtée en 2 images, 0,4 s ('+(r5*100).toFixed(1)+' % du glissement appliqué)');
  for(let i=0;i<300&&_fo;i++)frame(200);
  ok(Math.abs(part(a0)-fin60)<1e-3&&Math.abs(fin60-1)<1e-3,'29 : même angle final à 60 et à 5 images/s ('+fin60.toFixed(4)+' / '+part(a0).toFixed(4)+' du glisser)');
  ok(_fo===null,'30 : rotation finie : plus rien en cours');
  viewDampF=function(){return 0.2;}; // ancien amorti : 20 % par image quelle que soit la cadence
  a0=tourne();frame(200);frame(200);viewDampF=dampF;const r5a=part(a0);_fo=null;
  ok(!(r5a>0.99),'31 : ancien comportement rejoué (20 % par image) : à 5 images/s, '+(r5a*100).toFixed(0)+' % seulement en 0,4 s, la pièce tournait encore seule — attendu : échec de l essai 28');
  // téléphone (mfmPan) et sans profondeur : comme avant, 1 px = 1 px au plan de la cible
  place(0);const O=new THREE.Vector3();viewPanBy(30,-20);const o1=proj(O);
  ok(Math.abs(o1[0]-530)<1e-6&&Math.abs(o1[1]-280)<1e-6,'32 : sans profondeur donnée : le plan de la cible suit (comme avant)');
  // OrbitControls refait (haut de la vue en FAO) : son déplacement reste coupé
  controls=new THREE.OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);
  viewControlsRebuild();
  ok(controls.enablePan===false&&controls.enableZoom===false,'33 : OrbitControls refait : son déplacement et son zoom restent coupés');
  return out;
})()`,ctx,{filename:'test_zoom_deplacement'});
r.forEach(([c,m])=>A(c,m));
const attendus=r.filter(([c,m])=>/attendu : échec/.test(m));
console.log(ko?`\n${ko} échec(s)`:`\nTout est bon (${r.length} contrôles, dont ${attendus.length} anciens comportements rejoués qui échouent bien)`);
process.exit(ko?1:0);
