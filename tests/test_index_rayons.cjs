// V0.96.1 — Index spatial des triangles pour la souris (src/02-index-rayons.js) :
//  les impacts d'un rayon (distance, point, faceIndex, sommets, matière, ordre) sont IDENTIQUES
//  au bit près à ceux du parcours complet de three, sur le vrai three du logiciel — maillage
//  indexé ou non, groupes de matières, drawRange, matrice de l'objet, deux faces, near/far,
//  géométrie réécrite sur place ; et le survol d'un gros maillage coûte bien moins.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
const racine=path.join(__dirname,'..');
const sandbox={console,performance,Float32Array,Uint32Array,Uint16Array,Int32Array,Math,WeakMap};
sandbox.window=sandbox;sandbox.self=sandbox;
const ctx=vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(racine,'threejs','three.min.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(racine,'src','02-index-rayons.js'),'utf8'),ctx);
sandbox.__out=m=>console.log(m);
const r=vm.runInContext(String.raw`(()=>{
  const o={installe:!!THREE.Mesh.prototype._computeIntersections.rayIdxOrigine,cas:[]};
  let graine=12345;const alea=()=>{graine=(graine*1103515245+12345)&0x7fffffff;return graine/0x7fffffff;};
  const fige=h=>h.map(x=>[x.distance,x.point.x,x.point.y,x.point.z,x.faceIndex,x.face.a,x.face.b,x.face.c,x.face.materialIndex,x.face.normal.x,x.face.normal.y,x.face.normal.z,x.uv?x.uv.x:null,x.object.id]);
  const egal=(a,b)=>{if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)for(let k=0;k<a[i].length;k++)if(!Object.is(a[i][k],b[i][k]))return false;return true;};
  const rayons=(n,R)=>{const L=[];for(let i=0;i<n;i++){
      const p=new THREE.Vector3((alea()-.5)*R*3,(alea()-.5)*R*3,(alea()-.5)*R*3);
      const c=new THREE.Vector3((alea()-.5)*R,(alea()-.5)*R,(alea()-.5)*R);
      let d=c.sub(p).normalize();
      if(i%7===0)d=new THREE.Vector3(i%3===0?1:0,i%3===1?1:0,i%3===2?1:0); // rayons parallèles aux axes
      if(i%11===0)p.set(0.5,0.25,0.125); // départ à l'intérieur
      L.push([p,d]);}return L;};
  const essai=(nom,mesh,L,near,far)=>{
    mesh.updateMatrixWorld(true);
    const rc=new THREE.Raycaster();if(near!==undefined){rc.near=near;rc.far=far;}
    const tir=()=>{const S=[];let n=0;for(const [p,d] of L){rc.set(p,d);const h=rc.intersectObject(mesh,true);n+=h.length;S.push(fige(h));}return {S,n};};
    rayIdxOff=true;const t0=performance.now();const a=tir();const ta=performance.now()-t0;
    rayIdxOff=false;tir();const t1=performance.now();const b=tir();const tb=performance.now()-t1;
    let pareil=true;for(let i=0;i<L.length;i++)if(!egal(a.S[i],b.S[i])){pareil=false;break;}
    const c={nom,pareil,impacts:a.n,avant:ta/L.length,apres:tb/L.length};o.cas.push(c);return c;
  };
  const mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  // 1. gros maillage indexé (nœud torique, ~120 000 triangles), objet déplacé, tourné, mis à l'échelle
  const g1=new THREE.TorusKnotGeometry(40,12,600,100);
  const m1=new THREE.Mesh(g1,mat);m1.position.set(3,-2,5);m1.rotation.set(0.3,1.1,-0.4);m1.scale.set(1,1.5,0.7);
  o.tris=g1.index.count/3;
  essai('indexé, deux faces',m1,rayons(120,120));
  essai('indexé, face avant seule',new THREE.Mesh(g1,new THREE.MeshBasicMaterial()),rayons(80,120));
  essai('indexé, face arrière seule',new THREE.Mesh(g1,new THREE.MeshBasicMaterial({side:THREE.BackSide})),rayons(80,120));
  essai('near / far',m1,rayons(80,120),60,140);
  // 2. non indexé
  const g2=g1.toNonIndexed();essai('non indexé',new THREE.Mesh(g2,mat),rayons(60,120));
  // 3. groupes de matières (trois matières, dont une face avant seule)
  const g3=g1.clone();const n3=g3.index.count,t3=Math.floor(n3/9)*3;
  g3.addGroup(0,t3,0);g3.addGroup(t3,t3,1);g3.addGroup(2*t3,n3-2*t3,2);
  essai('groupes de matières',new THREE.Mesh(g3,[mat,new THREE.MeshBasicMaterial(),mat]),rayons(80,120));
  // 4. drawRange
  const g4=g1.clone();g4.setDrawRange(30000,200001);essai('drawRange',new THREE.Mesh(g4,mat),rayons(80,120));
  // 5. plaque : beaucoup de triangles coplanaires, rayons rasants et à travers
  const g5=new THREE.PlaneGeometry(400,300,400,300);const m5=new THREE.Mesh(g5,mat);
  const L5=rayons(150,200);for(let i=0;i<40;i++)L5.push([new THREE.Vector3(-500,(i-20)*5,0),new THREE.Vector3(1,0,0)]); // dans le plan
  essai('plaque',m5,L5);
  // 6. boîte fine (arêtes et sommets partagés : rayons exactement sur les arêtes)
  const g6=new THREE.BoxGeometry(100,60,20,60,40,20);const L6=[];
  for(let i=0;i<=60;i++)for(let j=0;j<=4;j++)L6.push([new THREE.Vector3(-50+i*100/60,-30+j*60/40,200),new THREE.Vector3(0,0,-1)]);
  essai('rayons sur les arêtes',new THREE.Mesh(g6,mat),L6);
  // 7. géométrie réécrite sur place SANS needsUpdate, puis avec : l'arbre suit
  const g7=g1.clone(),m7=new THREE.Mesh(g7,mat),L7=rayons(60,120);
  essai('avant réécriture',m7,L7);
  const pa=g7.attributes.position.array;for(let i=0;i<pa.length;i+=3){pa[i]+=35;pa[i+1]*=0.5;}
  g7.computeBoundingSphere();g7.computeBoundingBox();
  essai('réécrite sur place sans needsUpdate',m7,L7);
  for(let i=0;i<pa.length;i+=3)pa[i+2]-=20;g7.attributes.position.needsUpdate=true;g7.computeBoundingSphere();g7.computeBoundingBox();
  essai('réécrite avec needsUpdate',m7,L7);
  // 8. petit maillage : parcours d'origine
  const avant=rayIdxStat.rayons;
  essai('petit maillage',new THREE.Mesh(new THREE.SphereGeometry(10,16,12),mat),rayons(50,30));
  o.petitSansIndex=rayIdxStat.rayons===avant;
  // 9. survol : un rayon vers la pièce, gros maillage
  const Ls=rayons(200,60).filter((x,i)=>i%7&&i%11);
  o.survol=essai('survol',m1,Ls);
  // drawRange rendu intact
  o.drawRange=g1.drawRange.start===0&&g1.drawRange.count===Infinity&&g4.drawRange.start===30000&&g4.drawRange.count===200001;
  o.stat=Object.assign({},rayIdxStat);
  return o;
})()`,ctx);
console.log('=== Index spatial des triangles pour la souris ===');
A(r.installe,'index installé sur le vrai three');
for(const c of r.cas)A(c.pareil&&(c.impacts>0||c.nom==='petit maillage'),c.nom+' : impacts identiques au bit près ('+c.impacts+' impacts ; '+c.avant.toFixed(3)+' → '+c.apres.toFixed(3)+' ms par rayon)');
A(r.petitSansIndex,'petit maillage : pas d’arbre construit');
A(r.drawRange,'drawRange des géométries intact après les rayons');
A(r.survol.apres*10<r.survol.avant,'survol d’un maillage de '+r.tris+' triangles : '+r.survol.avant.toFixed(2)+' → '+r.survol.apres.toFixed(3)+' ms par rayon (au moins 10 fois moins)');
console.log('  arbres construits : '+r.stat.construits+' en '+r.stat.msConstruction.toFixed(0)+' ms ; rayons indexés : '+r.stat.rayons+' ; replis : '+r.stat.replis);
if(ko){console.log('ÉCHEC : '+ko);process.exit(1);}
console.log('OK');
