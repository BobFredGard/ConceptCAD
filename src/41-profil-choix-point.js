/* ---------- répétition suivant un profil : départ choisi à la souris dans la vue 3D (V0.30.1) ----------
   Demande : « je préfèrerai sélectionner moi-même le point à la souris directement sur l'esquisse
   depuis le monde 3D ». 🎯 dans le panneau de la répétition (pièce ou assemblage) : les courbes
   guides sont tracées en orange avec leurs points de départ possibles (points d'esquisse sur la
   courbe, extrémités, sommets, milieux des lignes — pgStartChoices, 39), un clic près d'un point
   (≤ 14 px) le prend comme départ, esquisse comprise. Échap ou 🎯 de nouveau : abandon.
   pgPick = {D (document dont les esquisses sont proposées), onPick(path), grp, cands} ; les
   coordonnées d'esquisse sont dans le repère de la scène (pièce active / composant porteur actif). */
let pgPick=null;
const PG_PICK_COL=0xff9f0a;
function pgPickW(sk,q){
  const O=sk.origin||[0,0,0],U=sk.axU||[1,0,0],V=sk.axV||[0,1,0];
  return [O[0]+q.x*U[0]+q.y*V[0],O[1]+q.x*U[1]+q.y*V[1],O[2]+q.x*U[2]+q.y*V[2]];
}
function pgPickSketches(D,cur){
  // Esquisses proposées : celles affichées dans la vue + la courbe guide en cours (toutes à défaut)
  const G=pgGuideSketches(D),V=G.filter(sk=>sk.visible!==false||sk.id===cur);
  return V.length?V:G;
}
function pgPickCands(D,cur){
  // Points proposés des esquisses guides : [{sk, v, label, w}]
  const out=[];
  pgPickSketches(D,cur).forEach(sk=>{
    try{ensureSketchBasis(sk);}catch(e){}
    pgStartChoices(sk).forEach(c=>out.push({sk,v:c.v,label:c.label,w:pgPickW(sk,c.q)}));
  });
  return out;
}
function pgPickDraw(){
  // Courbes guides + points de départ possibles, par-dessus la pièce
  if(!pgPick||typeof THREE==='undefined'||typeof scene==='undefined')return;
  const g=new THREE.Group();g.name='pgPick';g.renderOrder=999;
  const lm=new THREE.LineBasicMaterial({color:PG_PICK_COL,depthTest:false,transparent:true,opacity:.9});
  pgPickSketches(pgPick.D,pgPick.cur).forEach(sk=>{
    pgChains(sk).forEach(ch=>{
      const n=Math.max(16,Math.min(400,Math.ceil(ch.L/1.5)));
      const pts=[];for(let i=0;i<=n;i++){const q=ch.at(ch.L*i/n);const w=pgPickW(sk,q);pts.push(new THREE.Vector3(w[0],w[1],w[2]));}
      const L=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lm);L.renderOrder=999;g.add(L);
    });
  });
  const P=[];pgPick.cands.forEach(c=>P.push(c.w[0],c.w[1],c.w[2]));
  if(P.length){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
    const pm=new THREE.PointsMaterial({color:PG_PICK_COL,size:11,sizeAttenuation:false,depthTest:false,transparent:true});
    const pts=new THREE.Points(geo,pm);pts.renderOrder=1000;g.add(pts);
  }
  scene.add(g);pgPick.grp=g;
}
function pgPickClear(){
  const g=pgPick&&pgPick.grp;if(!g)return;
  try{g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});scene.remove(g);}catch(e){}
  pgPick.grp=null;
}
function pgPickStart(D,onPick,cur){
  pgPickStop();
  const cands=pgPickCands(D,cur);
  if(!cands.length){try{faceEl.textContent='Départ : aucune courbe guide avec un point proposable (dessinez la courbe, avec un point dessus, dans une esquisse).';}catch(e){}return false;}
  pgPick={D,onPick,grp:null,cands,cur:cur||null};
  pgPickDraw();
  try{faceEl.textContent='Départ : cliquez un point orange de la courbe guide (point d’esquisse, extrémité, sommet, milieu de ligne) — Échap pour annuler.';}catch(e){}
  return true;
}
function pgPickStop(){pgPickClear();pgPick=null;}
function pgPickNear(cands,mx,my,W,H,proj){
  // Candidat le plus proche du curseur à l'écran (≤ 14 px) ; proj(w) → [x, y, z] en NDC
  let best=null,bd=14;
  cands.forEach(c=>{
    const p=proj(c.w);if(!p||Math.abs(p[2])>1)return;
    const d=Math.hypot((p[0]+1)/2*W-mx,(1-p[1])/2*H-my);
    if(d<bd){bd=d;best=c;}
  });
  return best;
}
function pgPickAt(e){
  if(!pgPick)return false;
  const r=renderer.domElement.getBoundingClientRect(),v=new THREE.Vector3();
  const c=pgPickNear(pgPick.cands,e.clientX-r.left,e.clientY-r.top,r.width,r.height,w=>{v.set(w[0],w[1],w[2]).project(camera);return [v.x,v.y,v.z];});
  if(!c){try{faceEl.textContent='Départ : aucun point de la courbe guide sous le curseur — cliquez un point orange (Échap pour annuler).';}catch(err){}return true;}
  const fn=pgPick.onPick;pgPickStop();
  try{faceEl.textContent='Départ : '+c.label+' · '+(c.sk.name||c.sk.id);}catch(err){}
  fn(Object.assign({sk:c.sk.id},c.v));
  return true;
}
(function(){
  try{
    if(typeof document==='undefined')return;
    document.addEventListener('keydown',e=>{
      if(!pgPick||e.key!=='Escape')return;
      e.preventDefault();e.stopPropagation();pgPickStop();
      try{faceEl.textContent='Choix du départ annulé.';}catch(err){}
    },true);
  }catch(e){}
})();
