/* ---------- traits d'esquisse dans la vue 3D : épais, et visibles à travers les solides ----------
   WebGL ne trace les lignes qu'à 1 pixel (linewidth ignoré) : chaque segment devient ici un ruban
   de deux triangles, élargi en PIXELS ÉCRAN (même épaisseur quel que soit le zoom) et terminé en
   arrondi (pas de trou aux coins ni le long des courbes).
   Deux passes par style : ce qui est masqué par un solide reste dessiné, plus fin (sans test de
   profondeur) ; ce qui est vu est dessiné par-dessus, à pleine épaisseur.
   Le reflet du sol ignore ces traits (ShaderMaterial, cf. animate). */
const SK3D_FORT={vu:3,cache:2};   // traits forts (blancs ; gris foncé en thème Clair)
const SK3D_AIDE={vu:2,cache:1.5}; // construction et axe, en tiretés
const SK3D_VS=`
attribute vec3 aAutre;
attribute vec2 aCoin;
attribute float aDist;
uniform vec2 uRes;
uniform float uLarg;
varying vec2 vP;
varying float vL;
varying float vD;
void main(){
  mat4 M=projectionMatrix*modelViewMatrix;
  vec4 a=M*vec4(position,1.0),b=M*vec4(aAutre,1.0);
  if(a.z<-a.w&&b.z<-b.w){gl_Position=vec4(2.0,2.0,2.0,1.0);vP=vec2(0.0);vL=0.0;vD=0.0;return;}
  // segment coupé par le plan proche : ramené dessus, sinon la perspective l'inverse
  if(a.z<-a.w)a=mix(a,b,(-a.w-a.z)/((b.z-a.z)+(b.w-a.w)));
  else if(b.z<-b.w)b=mix(b,a,(-b.w-b.z)/((a.z-b.z)+(a.w-b.w)));
  vec2 pa=a.xy/a.w*uRes*0.5,pb=b.xy/b.w*uRes*0.5,d=pb-pa;
  float L=length(d);
  vec2 t=L>1e-4?d/L:vec2(1.0,0.0),n=vec2(-t.y,t.x);
  float h=uLarg*0.5+1.0; // +1 pixel : place du lissage du bord
  vP=vec2(aCoin.x>0.5?L+h:-h,aCoin.y*h*(aCoin.x>0.5?-1.0:1.0));
  vL=L;vD=aDist;
  // w = 1 : interpolation linéaire à l'écran. Léger recul de profondeur : un trait posé sur une face ne la dispute pas à la face.
  gl_Position=vec4((pa+n*aCoin.y*h-t*h)/(uRes*0.5),a.z/a.w-2e-4,1.0);
}`;
const SK3D_FS=`
uniform vec3 uCoul;
uniform float uLarg;
uniform float uTiret;
uniform float uVide;
varying vec2 vP;
varying float vL;
varying float vD;
void main(){
  if(uTiret>0.0&&mod(vD,uTiret+uVide)>uTiret)discard;
  float dx=vP.x<0.0?-vP.x:max(vP.x-vL,0.0);
  float al=clamp(0.5-(length(vec2(dx,vP.y))-uLarg*0.5),0.0,1.0);
  if(al<=0.01)discard;
  gl_FragColor=vec4(uCoul,al);
}`;
function sk3dRubans(polys){
  // polylignes [[{x,y,z}…]…] → sommets des rubans : 6 par segment (P et Q, un de chaque côté)
  let nb=0;polys.forEach(pl=>{nb+=Math.max(0,pl.length-1);});
  const pos=new Float32Array(nb*18),aut=new Float32Array(nb*18),coin=new Float32Array(nb*12),dist=new Float32Array(nb*6);
  let i=0;
  const som=(M,N,bout,cote,d)=>{
    pos[i*3]=M.x;pos[i*3+1]=M.y;pos[i*3+2]=M.z;
    aut[i*3]=N.x;aut[i*3+1]=N.y;aut[i*3+2]=N.z;
    coin[i*2]=bout;coin[i*2+1]=cote;dist[i]=d;i++;};
  polys.forEach(pl=>{
    let d=0;
    for(let k=0;k+1<pl.length;k++){
      const P=pl[k],Q=pl[k+1],d2=d+Math.hypot(Q.x-P.x,Q.y-P.y,Q.z-P.z);
      // Vu de Q, la normale du segment est opposée : (Q,+1) est du même côté que (P,-1)
      som(P,Q,0,1,d);som(P,Q,0,-1,d);som(Q,P,1,1,d2);
      som(P,Q,0,1,d);som(Q,P,1,1,d2);som(Q,P,1,-1,d2);
      d=d2;
    }
  });
  return{pos,aut,coin,dist,sommets:i};
}
function sk3dCoul(hex){return[(hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255];}
function sk3dTraits(grp,polys,o){
  // o : {col, larg:{vu,cache}, tiret, vide, fort}
  if(!polys.length)return;
  const R=sk3dRubans(polys);if(!R.sommets)return;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(R.pos,3));
  g.setAttribute('aAutre',new THREE.BufferAttribute(R.aut,3));
  g.setAttribute('aCoin',new THREE.BufferAttribute(R.coin,2));
  g.setAttribute('aDist',new THREE.BufferAttribute(R.dist,1));
  // couleur écrite telle quelle (ni tons ni espace colorimétrique), commune aux deux passes
  const uCoul={value:sk3dCoul(o.col)};
  const passe=(larg,ordre,prof)=>{
    const uRes={value:[1,1]};
    const mat=new THREE.ShaderMaterial({vertexShader:SK3D_VS,fragmentShader:SK3D_FS,transparent:true,depthWrite:false,depthTest:prof,side:THREE.DoubleSide,
      uniforms:{uRes,uCoul,uLarg:{value:larg},uTiret:{value:o.tiret||0},uVide:{value:o.vide||0}}});
    if(o.fort)mat.userData.skStrong=true;
    mat.color={set:h=>{uCoul.value=sk3dCoul(h);mat.uniforms.uCoul=uCoul;mat.uniformsNeedUpdate=true;}}; // changement de thème (97)
    const m=new THREE.Mesh(g,mat);
    m.renderOrder=ordre;m.frustumCulled=false;m.raycast=()=>{};
    let taille=null;
    m.onBeforeRender=r=>{taille=taille||new THREE.Vector2();r.getSize(taille);uRes.value=[taille.x||1,taille.y||1];mat.uniformsNeedUpdate=true;};
    grp.add(m);
  };
  passe(o.larg.cache,991,false); // au-dessus des arêtes d'esquisse (989/990)
  passe(o.larg.vu,992,true);
}
function sk3dPurge(){
  // retire les esquisses de la scène et libère leurs tampons (la scène est refaite à chaque rejeu)
  scene.children.filter(o=>o.name&&o.name.startsWith('sk_')).forEach(o=>{
    scene.remove(o);
    try{o.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});}catch(e){}
  });
}
function sk3dRedessine(){try{sk3dPurge();drawSketchHelpers();}catch(e){}}
