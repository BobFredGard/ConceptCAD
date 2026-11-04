// Scène de l'atelier RENDU (V0.14.0, src/98-rendu-scene.js) : HDRI importée, supports, studio courbe.
//   1. un vrai fichier Radiance .hdr (fabriqué ici : ciel, sol, soleil de 2° à l'azimut 30°, élévation 35°,
//      convention de l'image Y en haut) lu par le chargeur du three récent (threejs/rendu-rayons.js) ;
//   2. soleil repéré, direction rendue dans le monde Z en haut (azimut −30° : l'axe Z de l'image devient −Y),
//      éclairement du disque solaire ; « Rotation » le fait tourner autour de Z ;
//   3. image du monde (convention équirectangulaire commune aux deux moteurs) : soleil au bon pixel,
//      zénith bleu, nadir brun ; soleil ôté pour le moteur rapide (la lampe le remplace) ;
//   4. supports : tuiles périodiques (bords qui se raccordent) ; studio : profil continu, croissant.
'use strict';
const vm=require('vm'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const c={console,TextDecoder,TextEncoder};c.window=c;c.self=c;vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(ROOT,'threejs','rendu-rayons.js'),'utf8'),c,{filename:'rendu-rayons.js'});
for(const f of ['threejs/three.min.js','src/98-rendu-surface.js','src/98-rendu-scene.js','src/98-rendu-supports.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),c,{filename:f});
// 1. fichier .hdr
const W=512,H=256,sun=[Math.cos(35*Math.PI/180)*Math.cos(30*Math.PI/180),Math.sin(35*Math.PI/180),Math.cos(35*Math.PI/180)*Math.sin(30*Math.PI/180)];
const rgbe=(r,g,b)=>{const v=Math.max(r,g,b);if(v<1e-32)return [0,0,0,0];const e=Math.ceil(Math.log2(v)),f=256/Math.pow(2,e);return [Math.min(255,Math.floor(r*f)),Math.min(255,Math.floor(g*f)),Math.min(255,Math.floor(b*f)),e+128];};
const px=Buffer.alloc(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const th=((x+0.5)/W-0.5)*2*Math.PI,ph=(y+0.5)/H*Math.PI,d=[Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th)];
  let col=d[1]>=0?[0.3,0.5,1.4]:[0.45,0.3,0.15];
  if(d[0]*sun[0]+d[1]*sun[1]+d[2]*sun[2]>Math.cos(2*Math.PI/180))col=[2600,2500,2300];
  rgbe(...col).forEach((v,i)=>{px[(y*W+x)*4+i]=v;});
}
const hdr=Buffer.concat([Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y '+H+' +X '+W+'\n','ascii'),px]);
c.__buf=hdr.buffer.slice(hdr.byteOffset,hdr.byteOffset+hdr.byteLength);
const r=vm.runInContext(`(()=>{
  const P=[],ATT=[];const p=s=>P.push(String(s)),att=(ok,m)=>{if(!ok)ATT.push(m);};
  const L=RDPT,I=rdHdriParse(L,__buf,'ciel.hdr');
  p('HDRI lue : '+I.w+' × '+I.h);
  att(I.w===512&&I.h===256&&I.data.length===512*256*4,'dimensions');
  const Hd={name:'ciel',w:I.w,h:I.h,data:I.data,sun:null,at:1};Hd.sun=rdHdriSun(Hd);
  att(!!Hd.sun,'soleil non repéré');
  const k=rdHdriSunKey(Hd);
  p('soleil : azimut '+k.az.toFixed(1)+'°, élévation '+k.el.toFixed(1)+'°, éclairement '+k.E.toFixed(2));
  att(Math.abs(k.az+30)<2&&Math.abs(k.el-35)<2,'direction du soleil (attendu −30°, 35°)');
  const Esun=2500*2*Math.PI*(1-Math.cos(2*Math.PI/180));
  att(Math.abs(k.E-Esun)<0.35*Esun,'éclairement du soleil '+k.E.toFixed(2)+' (≈ '+Esun.toFixed(2)+')');
  // 3. image du monde : pixel le plus lumineux = direction du soleil
  const Ww=256,Hw=128,dirOf=(i,j)=>{const th=((i+0.5)/Ww-0.5)*2*Math.PI,ph=(1-(j+0.5)/Hw)*Math.PI;return [Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th)];};
  const best=D=>{let b=-1,bi=0,bj=0;for(let j=0;j<Hw;j++)for(let i=0;i<Ww;i++){const v=D[(j*Ww+i)*4];if(v>b){b=v;bi=i;bj=j;}}const d=dirOf(bi,bj);
    return {az:Math.atan2(d[1],d[0])*180/Math.PI,el:Math.asin(d[2])*180/Math.PI,v:b};};
  const w0=rdHdriWorld(Hd,0,Ww,1,false),b0=best(w0);
  p('monde, rotation 0 : soleil à '+b0.az.toFixed(1)+'° / '+b0.el.toFixed(1)+'°');
  att(Math.abs(b0.az+30)<3&&Math.abs(b0.el-35)<3,'image du monde : soleil mal placé');
  const w90=rdHdriWorld(Hd,Math.PI/2,Ww,1,false),b90=best(w90);
  p('monde, rotation 90° : soleil à '+b90.az.toFixed(1)+'°');
  att(Math.abs(b90.az-60)<3,'rotation : soleil attendu à 60°');
  const at=(D,d)=>{let b=0,bv=-2;for(let j=0;j<Hw;j++)for(let i=0;i<Ww;i++){const q=dirOf(i,j),s=q[0]*d[0]+q[1]*d[1]+q[2]*d[2];if(s>bv){bv=s;b=(j*Ww+i)*4;}}return [D[b],D[b+1],D[b+2]];};
  const zen=at(w0,[0,0,1]),nad=at(w0,[0,0,-1]);
  att(zen[2]>zen[0]&&nad[0]>nad[2],'zénith bleu, nadir brun attendus (Z en haut)');
  const wc=rdHdriWorld(Hd,0,Ww,1,true);
  att(best(wc).v<0.05*b0.v,'moteur rapide : le soleil doit être ôté de la PMREM');
  const w2=rdHdriWorld(Hd,0,Ww,2,false);
  att(Math.abs(best(w2).v/b0.v-2)<0.01,'« Lampe » doit régler la force du soleil');
  const g=rdHdriGround(Hd);att(g[0]>g[2]&&Math.abs(g[0]-0.45)<0.05,'couleur du sol de l\\u2019image');
  att(rdLinHex([1,1,1])==='#ffffff'&&rdLinHex([0,0,0])==='#000000'&&rdLinHex([0.2195,0.2195,0.2195])==='#818181','rdLinHex');
  // 4. supports périodiques
  // raccord : passer du dernier pixel au premier ne doit pas sauter plus que deux pixels voisins DANS la tuile
  RD_SUPPORTS.filter(s=>s[0]).forEach(([kk])=>{const S=rdSupTex(kk,128),N=S.N,a=S.data,px=(x,y,ch)=>a[(y*N+x)*4+ch];
    const col=(x1,x2)=>{let d=0;for(let y=0;y<N;y++)for(let ch=0;ch<3;ch++)d+=Math.abs(px(x1,y,ch)-px(x2,y,ch));return d/N/3;};
    const lig=(y1,y2)=>{let d=0;for(let x=0;x<N;x++)for(let ch=0;ch<3;ch++)d+=Math.abs(px(x,y1,ch)-px(x,y2,ch));return d/N/3;};
    let mc=0,ml=0;for(let i=0;i<N-1;i++){mc=Math.max(mc,col(i,i+1));ml=Math.max(ml,lig(i,i+1));}
    const dc=col(N-1,0),dl=lig(N-1,0);
    att(dc<=mc*1.3+6&&dl<=ml*1.3+6,kk+' : la tuile ne se raccorde pas ('+dc.toFixed(1)+' pour '+mc.toFixed(1)+', '+dl.toFixed(1)+' pour '+ml.toFixed(1)+')');
    let moy=0,nan=false;for(let i=0;i<a.length;i+=4){moy+=a[i]+a[i+1]+a[i+2];if(a[i+3]!==255)nan=true;}moy/=3*a.length/4;
    att(!nan&&moy>3,kk+' : tuile noire ou incomplète');});
  // catalogue : au moins 70 sols, chaque famille demandée présente, tenue à la lumière cohérente
  const S2=RD_SUPPORTS.filter(s=>s[0]),fam=new Set(S2.map(s=>s[2]));
  p(S2.length+' supports, '+fam.size+' familles');
  att(S2.length>=70,'catalogue trop court : '+S2.length);
  ['Textiles','Verres dépolis','LED','Peintures','Pierre et béton','Bois','Métal','Atelier','Carrelage et construction'].forEach(f=>att(fam.has(f),'famille absente : '+f));
  att(new Set(S2.map(s=>s[0])).size===S2.length,'clés de supports en double');
  S2.forEach(([kk])=>{const d=RD_SUP_DEF[kk];att(d&&d.t>0&&d.r>=0&&d.r<=1,kk+' : tuile ou rugosité');});
  att(S2.filter(s=>s[2]==='LED').every(s=>RD_SUP_DEF[s[0]].em>0),'les LED doivent émettre');
  att(RD_SUP_DEF.pMateNoir.k===0&&RD_SUP_DEF.pBrilNoir.k>RD_SUP_DEF.pSatinAnth.k&&RD_SUP_DEF.verreDep.b>0,'mate sans reflet, laque nette, dépoli flou');
  // studio
  const pr=rdStudioProfile(10);let ok=true;for(let i=1;i<pr.length;i++){const d=Math.hypot(pr[i][0]-pr[i-1][0],pr[i][1]-pr[i-1][1]);if(pr[i][0]<pr[i-1][0]-1e-9||pr[i][1]<pr[i-1][1]-1e-9||d>40)ok=false;}
  att(ok&&pr[0][0]===0&&pr[pr.length-1][1]>=50,'profil du studio');
  const sg=rdStudioGeo(THREE,10);sg.computeBoundingBox();
  att(sg.boundingBox.max.z>=59&&Math.abs(sg.boundingBox.min.z)<1e-6,'studio : couché sur Z (sol à 0, mur jusqu\\u2019à 6 R)');
  if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(x=>p('  ✗ '+x));}else{p('');p('TOUT EST CONFORME');}
  return P.join('\\n');
})()`,c,{filename:'rendu_scene.js'});
console.log(r);
process.exit(/ECHECS|✗/.test(r)?1:0);
