// Survol et sélection à la souris (V0.96.1) sur une vraie pièce, dans le vrai logiciel :
//   1. face sous le curseur : l'index spatial (src/02-index-rayons) rend les MÊMES impacts que le
//      parcours complet de three (?sansindex), sur une grille de points de l'écran, deux vues ;
//   2. arête sous le curseur : la projection gardée par position de caméra rend le MÊME choix que
//      l'ancien calcul point par point, et suit la caméra quand la vue tourne ;
//   3. les temps des deux méthodes sont affichés (information).
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path'),fs=require('fs');
const PIECE=path.join(__dirname,'..','..','Exemples','Cavité Usinage.conceptcad');

const pret=async page=>{await page.waitForFunction(()=>{try{return occtReady===true;}catch(e){return false;}},null,{timeout:180000});await page.waitForTimeout(500);};
const calme=async page=>page.waitForFunction(()=>doc.features.length>0&&rebuildDepth===0&&!regenRun&&!regenUi&&bodies.some(b=>b.kind==='body'),null,{timeout:180000});

test('survol : mêmes faces et mêmes arêtes, bien plus vite',async({page})=>{
  await page.goto('/ConceptCAD.html');
  await pret(page);
  const b64=fs.readFileSync(PIECE).toString('base64');
  await page.evaluate(async([b64,nom])=>{
    const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    const txt=await mffFileText(new File([u8],nom));
    await mffLoadText(txt,nom,null);
  },[b64,path.basename(PIECE)]);
  await calme(page);
  await page.waitForTimeout(1500);
  const r=await page.evaluate(()=>{
    const o={installe:!!THREE.Mesh.prototype._computeIntersections.rayIdxOrigine,vues:[]};
    o.tris=bodies.filter(b=>b.visible&&b.mesh).reduce((s,b)=>s+(b.mesh.geometry.index?b.mesh.geometry.index.count:b.mesh.geometry.attributes.position.count)/3,0);
    const R=renderer.domElement.getBoundingClientRect();
    const pts=[];for(let i=1;i<24;i++)for(let j=1;j<16;j++)pts.push({clientX:R.left+R.width*i/24+0.37,clientY:R.top+R.height*j/16+0.21});
    // ancien choix d'arête, recopié tel qu'il était avant V0.96.1 (référence)
    const ancien=(e,segs,faceHit,tolPx)=>{
      if(!segs||!segs.length)return null;
      const r=renderer.domElement.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
      const v=new THREE.Vector3(),vz=new THREE.Vector3(),toS=p=>{vz.set(p[0],p[1],p[2]).applyMatrix4(camera.matrixWorldInverse);v.set(p[0],p[1],p[2]).project(camera);return[(v.x+1)/2*r.width,(1-v.y)/2*r.height,v.z,-vz.z];};
      let slack=0.3;
      if(faceHit){const wpp=camera.isOrthographicCamera?(camera.top-camera.bottom)/(camera.zoom||1)/r.height:2*faceHit.distance*Math.tan(camera.fov*Math.PI/360)/r.height;slack=Math.min(0.3,2*wpp);}
      let best=null,bd=(tolPx||6)*(window.mfmEdgeK||1);
      segs.forEach((P,pi)=>{
        if(!P||P.length<2)return;
        let a=toS(P[0]);
        for(let k=1;k<P.length;k++){
          const b=toS(P[k]);
          if(a[2]<1&&b[2]<1&&a[2]>-1&&b[2]>-1){
            const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1e-9;
            let t=((mx-a[0])*dx+(my-a[1])*dy)/L2;t=Math.max(0,Math.min(1,t));
            const d=Math.hypot(mx-(a[0]+t*dx),my-(a[1]+t*dy));
            if(d<bd+(best?1:0)){
              if(!camera.isOrthographicCamera){const za=a[3],zb=b[3];const den=(1-t)*zb+t*za;if(Math.abs(den)>1e-12)t=t*za/den;}
              const w=[P[k-1][0]+(P[k][0]-P[k-1][0])*t,P[k-1][1]+(P[k][1]-P[k-1][1])*t,P[k-1][2]+(P[k][2]-P[k-1][2])*t];
              const dc=camera.position.distanceTo(new THREE.Vector3(w[0],w[1],w[2]));
              const better=!best||d<bd-1||(d<bd+1?dc<best.dc:false);
              if(better&&(!faceHit||dc<=faceHit.distance*1.004+slack)){bd=Math.min(d,bd);best={pi,dc,d};}
            }
          }
          a=b;
        }
      });
      return best;
    };
    const fige=h=>h?[h.distance,h.faceIndex,h.point.x,h.point.y,h.point.z,h.object.uuid]:null;
    const mesure=nom=>{
      camera.updateMatrixWorld(true);camera.updateProjectionMatrix&&camera.updateProjectionMatrix();
      const V={nom,faces:true,aretes:true,touchees:0,aretesTrouvees:0};
      rayIdxOff=true;let t=performance.now();const A=pts.map(e=>pick(e));V.msFaceAvant=(performance.now()-t)/pts.length;
      rayIdxOff=false;pick(pts[0]);t=performance.now();const B=pts.map(e=>pick(e));V.msFaceApres=(performance.now()-t)/pts.length;
      for(let i=0;i<pts.length;i++){const a=fige(A[i]),b=fige(B[i]);if(JSON.stringify(a)!==JSON.stringify(b))V.faces=false;if(a)V.touchees++;}
      const segs=edgeHoverSegs();V.polylignes=segs.length;V.points=segs.reduce((s,P)=>s+P.length,0);
      t=performance.now();const C=pts.map((e,i)=>ancien(e,segs,B[i],6));V.msAreteAvant=(performance.now()-t)/pts.length;
      edgePickScreen(pts[0],segs,B[0],6);
      t=performance.now();const D=pts.map((e,i)=>edgePickScreen(e,segs,B[i],6));V.msAreteApres=(performance.now()-t)/pts.length;
      for(let i=0;i<pts.length;i++){if(JSON.stringify(C[i])!==JSON.stringify(D[i]))V.aretes=false;if(C[i])V.aretesTrouvees++;}
      // points sur des arêtes : le curseur posé exactement sur le milieu de quelques polylignes
      const v=new THREE.Vector3();let n=0;
      for(let pi=0;pi<segs.length&&n<60;pi+=Math.max(1,(segs.length/60)|0)){const P=segs[pi],p=P[(P.length/2)|0];
        v.set(p[0],p[1],p[2]).project(camera);if(v.z<-1||v.z>1)continue;
        const e={clientX:R.left+(v.x+1)/2*R.width,clientY:R.top+(1-v.y)/2*R.height};
        const h=pick(e);if(JSON.stringify(ancien(e,segs,h,6))!==JSON.stringify(edgePickScreen(e,segs,h,6)))V.aretes=false;
        if(edgePickScreen(e,segs,h,6))V.aretesTrouvees++;n++;}
      o.vues.push(V);
    };
    mesure('vue de départ');
    // la vue tourne : la projection gardée doit suivre
    camera.position.applyAxisAngle(new THREE.Vector3(0.3,1,0.2).normalize(),0.9);camera.lookAt(controls.target);
    mesure('vue tournée');
    o.stat=Object.assign({},rayIdxStat);
    return o;
  });
  for(const V of r.vues)console.log('  '+V.nom+' : face '+V.msFaceAvant.toFixed(3)+' → '+V.msFaceApres.toFixed(3)+' ms ; arête '+V.msAreteAvant.toFixed(3)+' → '+V.msAreteApres.toFixed(3)+' ms par mouvement ('+r.tris+' triangles, '+V.points+' points d’arêtes, '+V.touchees+' points sur la pièce, '+V.aretesTrouvees+' arêtes trouvées)');
  console.log('  arbres : '+r.stat.construits+' en '+r.stat.msConstruction.toFixed(1)+' ms ; rayons indexés '+r.stat.rayons+' ; replis '+r.stat.replis);
  expect(r.installe).toBe(true);
  for(const V of r.vues){
    expect(V.touchees,V.nom+' : des points tombent sur la pièce').toBeGreaterThan(20);
    expect(V.aretesTrouvees,V.nom+' : des arêtes sont trouvées').toBeGreaterThan(5);
    expect(V.faces,V.nom+' : mêmes faces').toBe(true);
    expect(V.aretes,V.nom+' : mêmes arêtes').toBe(true);
  }
  expect(r.stat.rayons).toBeGreaterThan(0);
});
