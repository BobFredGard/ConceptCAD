/* ---------- catalogue des supports (sols) de l'atelier RENDU et de la vue 3D ----------
   Chaque support : une tuile périodique calculée à la demande (albédo sRGB, à l'échelle réelle) et sa
   tenue à la lumière. Champs de RD_SUP_DEF : t tuile (mm) · r rugosité · g générateur (u, v, T, x, y) → [r, g, b]
   · m métal · cc vernis (lancer de rayons) · k force du reflet (moteur rapide, vue 3D ; absent = 1)
   · b flou du reflet (fraction de l'image reflétée : verre dépoli, satiné) · em lumière émise (LED).
   Les générateurs ne dépendent que de bruits périodiques (sfNoise, sfFbm) : les bords de tuile se raccordent. */
const _sN=(u,v,c,s)=>sfNoise(u*c,v*c,c,c,s);
const _sF=(u,v,c,s)=>sfFbm(u*c,v*c,c,c,s);
const _sA=(u,v,cx,cy,s)=>sfNoise(u*cx,v*cy,cx,cy,s); // bruit étiré (fibres, fil, brossage)
const _sK=(c,k)=>[c[0]*k,c[1]*k,c[2]*k];
const _sMix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const _sMod=(a,p)=>((a%p)+p)%p;
function _sCell(u,v,c,s){ // cellules périodiques : d1, d2 (distances aux 2 germes les plus proches), h (hasard de la plus proche)
  const x=u*c,y=v*c,i=Math.floor(x),j=Math.floor(y);let d1=9,d2=9,h=0;
  for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
    const a=_sMod(i+di,c),b=_sMod(j+dj,c),d=Math.hypot(i+di+sfHash(a,b,s)-x,j+dj+sfHash(a,b,s+1)-y);
    if(d<d1){d2=d1;d1=d;h=sfHash(a,b,s+2);}else if(d<d2)d2=d;
  }
  return [d1,d2,h];
}
function _sLames(u,v,n,c,s){ // lames de bois : n par tuile, fil le long de u, abouts décalés, joints sombres
  const l=Math.floor(v*n),vv=v*n-l,du=(u+sfHash(l,0,s+7))%1;
  const cerne=sfTri(vv*9+(sfFbm(u*8,vv*2+l*3.1,8,1e6,s+l)-0.5)*3),trait=sfNoise(u*6,vv*60,6,1e6,s+20+l);
  const t=0.8+0.14*cerne*cerne+0.1*(trait-0.5)+(sfHash(l,0,s+1)-0.5)*0.2;
  return _sK(c,t*(vv<0.012||vv>0.988||du<0.002||du>0.998?0.35:1));
}
function _sChevrons(u,v,c,s){ // parquet à chevrons : 4 colonnes en V, 8 rangs
  const xx=u*4,col=Math.floor(xx),fx=xx-col,w=v*8+(col%2?fx:1-fx),row=Math.floor(w),fw=w-row,id=_sMod(row,8);
  const t=0.8+0.12*sfNoise(fx*5,fw*30,1e6,1e6,s+col*11+id)+(sfHash(col,id,s)-0.5)*0.22;
  return _sK(c,t*(fw<0.03||fw>0.97||fx<0.01||fx>0.99?0.4:1));
}
function _sCarr(u,v,nx,ny,dec,jx,jy,jc,fc){ // carreaux en quinconce (dec : décalage d'un rang sur deux, en carreaux)
  const yy=v*ny,j=Math.floor(yy),fy=yy-j,xx=u*nx+(j%2?dec:0),i=_sMod(Math.floor(xx),nx),fx=xx-Math.floor(xx);
  if(fx<jx||fx>1-jx||fy<jy||fy>1-jy)return jc;
  return fc(i,j,fx,fy);
}
function _sTisse(u,v,n,a,b,serge){ // armure toile (2 fils) ou sergé (diagonale de 4)
  const X=u*n,Y=v*n,i=Math.floor(X),j=Math.floor(Y),fx=X-i,fy=Y-j,top=serge?(i+j)%4<2:(i+j)%2===0;
  const ombre=0.62+0.38*Math.sin(Math.PI*(top?fx:fy));
  return _sK(top?a:b,ombre*(0.94+0.12*sfHash(top?i:j,top?0:1,77)));
}
function _sTartan(t,B){let c=0;for(const q of B){c+=q[0];if(t*16<c)return q[1];}return B[B.length-1][1];} // bandes d'un écossais (somme des largeurs : 16)
const _sLuxe=(u,v,c,s)=>_sK(c,0.72+0.56*_sF(u,v,5,s)+0.1*(_sN(u,v,256,s+5)-0.5)); // velours : plages d'écrasement du poil
const _sPaillette=(x,y,s,c,f)=>{const h=sfHash(x,y,s);return h>1-f?_sMix(c,[255,255,255],0.55):h<f?_sK(c,0.72):c;};
const _sMet=(c,s)=>(u,v,T,x,y)=>_sPaillette(x,y,s,_sK(c,0.92+0.16*_sF(u,v,4,s+1)),0.03); // peinture métallisée
const _sUni=(c,s,a)=>(u,v)=>_sK(c,1+(a||0.015)*(_sF(u,v,6,s)-0.5)); // peinture unie, à peine nuagée
const _sNacre=(a,b,s)=>(u,v,T,x,y)=>_sPaillette(x,y,s,_sMix(a,b,Math.min(1,Math.max(0,_sF(u,v,5,s+1)*2-0.5))),0.015);
const _sLed=(pas,coul,rayon,fond)=>(u,v)=>{ // points lumineux en grille, halo baké
  const X=u*pas,Y=v*pas,i=Math.floor(X),j=Math.floor(Y),d=Math.hypot(X-i-0.5,Y-j-0.5);
  const c=typeof coul==='function'?coul(i,j):coul,cœur=d<rayon?1:Math.exp(-(d-rayon)*(d-rayon)*40)*0.55;
  return _sMix(fond,c,cœur);
};
const _sPeint=(mat)=>mat==='mate'?{r:0.92,cc:0,k:0}:mat==='satin'?{r:0.4,cc:0.3,k:0.35,b:0.012}:mat==='brillante'?{r:0.08,cc:1,k:0.9}:mat==='metal'?{r:0.32,m:0.45,cc:1,k:0.7}:{r:0.2,cc:1,k:0.75,b:0.004}; // nacre
[
  // ── pierre et béton ──
  ['beton2','Béton sombre','Pierre et béton',{t:400,r:0.8,k:0.25,b:0.012,g:(u,v)=>{const n=_sF(u,v,7,131)*0.7+_sN(u,v,64,134)*0.3,p=_sN(u,v,320,135),c=78+(n-0.5)*40-(p>0.93?16:0);return [c,c,c*1.02];}}],
  ['marbreNoir','Marbre noir','Pierre et béton',{t:500,r:0.15,cc:1,k:1,g:(u,v)=>{const w=_sF(u,v,6,141)*2.2,f=Math.pow(sfTri(u*3+v*2+w),14),c=18+f*205+(_sN(u,v,32,142)-0.5)*6;return [c,c,c*1.02];}}],
  ['ardoise','Ardoise','Pierre et béton',{t:500,r:0.75,k:0.2,b:0.015,g:(u,v)=>{const n=_sA(u,v,6,64,151)*0.6+_sF(u,v,8,152)*0.4,c=46+(n-0.5)*42;return [c,c*1.05,c*1.14];}}],
  ['granit','Granit','Pierre et béton',{t:200,r:0.3,cc:0.5,k:0.6,g:(u,v,T,x,y)=>{const h=sfHash(x>>1,y>>1,161),n=_sN(u,v,128,162),c=h>0.8?205:h<0.25?38:125+(n-0.5)*50;return [c,c*0.98,c*0.97];}}],
  ['granitNoir','Granit noir (marbre de contrôle)','Pierre et béton',{t:200,r:0.12,cc:1,k:1,g:(u,v,T,x,y)=>{const h=sfHash(x>>1,y>>1,171),c=h>0.965?130:h>0.86?56:20+_sN(u,v,128,172)*12;return [c,c,c*1.05];}}],
  ['terrazzo','Terrazzo','Pierre et béton',{t:300,r:0.25,cc:1,k:0.6,g:(u,v)=>{const A=_sCell(u,v,48,181),B=_sCell(u,v,20,185);
    if(B[1]-B[0]>0.3&&B[0]<0.42)return _sMix([120,84,66],[208,190,168],B[2]);
    if(A[1]-A[0]>0.14&&A[0]<0.38)return A[2]>0.66?[64,68,74]:A[2]>0.33?[176,126,100]:[232,228,220];
    const c=206+(_sF(u,v,8,189)-0.5)*12;return [c,c*0.98,c*0.94];}}],
  ['travertin','Travertin','Pierre et béton',{t:600,r:0.55,k:0.3,b:0.012,g:(u,v)=>{const n=_sA(u,v,6,48,191),t=sfTri(v*12+(_sF(u,v,4,192)-0.5)*1.4),p=_sA(u,v,32,128,194);return _sK([222,202,170],(0.86+0.1*t+0.08*(n-0.5))*(p>0.86?0.72:1));}}],
  ['sable','Sable','Pierre et béton',{t:300,r:1,cc:0,k:0,g:(u,v,T,x,y)=>{const o=sfTri(v*18+(_sF(u,v,4,201)-0.5)*3);return _sPaillette(x,y,202,_sK([214,186,138],0.88+0.14*o+(_sN(u,v,256,203)-0.5)*0.1),0.05);}}],
  ['asphalte','Asphalte','Pierre et béton',{t:200,r:0.95,cc:0,k:0,g:(u,v,T,x,y)=>{const h=sfHash(x>>1,y>>1,211),c=h>0.9?108:h>0.5?56:34;return [c,c,c];}}],
  // ── bois ──
  ['noyer','Noyer','Bois',{t:720,r:0.4,cc:0.5,k:0.6,g:(u,v)=>_sLames(u,v,6,[112,74,50],221)}],
  ['chene','Chêne clair','Bois',{t:800,r:0.5,k:0.4,b:0.008,g:(u,v)=>_sLames(u,v,4,[214,178,130],231)}],
  ['hetre','Établi en hêtre','Bois',{t:320,r:0.55,k:0.25,b:0.012,g:(u,v)=>_sLames(u,v,8,[220,180,136],241)}],
  ['wenge','Wengé','Bois',{t:600,r:0.35,cc:0.6,k:0.7,g:(u,v)=>_sLames(u,v,5,[70,48,38],251)}],
  ['chevrons','Parquet à chevrons','Bois',{t:640,r:0.35,cc:0.6,k:0.6,g:(u,v)=>_sChevrons(u,v,[186,136,90],261)}],
  // ── carrelage ──
  ['brique','Brique','Carrelage et construction',{t:480,r:0.9,cc:0,k:0,g:(u,v)=>_sCarr(u,v,2,8,0.5,0.02,0.08,[150,144,134],(i,j)=>{const b=sfHash(i,_sMod(j,8),271);return _sK(_sMix([142,62,42],[176,92,62],b),0.9+0.2*_sF(u,v,16,272));})}],
  ['metro','Carrelage métro','Carrelage et construction',{t:600,r:0.1,cc:1,k:0.8,g:(u,v)=>_sCarr(u,v,4,8,0.5,0.012,0.024,[148,148,146],(i,j)=>{const c=238+(sfHash(i,_sMod(j,8),281)-0.5)*14;return [c,c,c*0.99];})}],
  ['damier','Damier noir et blanc','Carrelage et construction',{t:400,r:0.12,cc:1,k:0.9,g:(u,v)=>_sCarr(u,v,4,4,0,0.006,0.006,[80,80,80],(i,j)=>{const w=_sF(u,v,8,291);return (i+j)%2?_sK([38,38,42],0.8+0.4*w):_sK([236,234,228],0.92+0.1*w);})}],
  ['ciment','Carreaux de ciment','Carrelage et construction',{t:400,r:0.5,k:0.3,b:0.012,g:(u,v)=>_sCarr(u,v,4,4,0,0.008,0.008,[176,170,158],(i,j,fx,fy)=>{const r=Math.hypot(fx-0.5,fy-0.5),l=Math.abs(fx-0.5)+Math.abs(fy-0.5),q=Math.min(Math.hypot(fx,fy),Math.hypot(1-fx,fy),Math.hypot(fx,1-fy),Math.hypot(1-fx,1-fy));
    return r<0.13?[188,92,62]:l<0.42?[46,78,102]:q<0.2?[46,78,102]:[226,216,194];})}],
  // ── métal ──
  ['tole','Tôle larmée','Métal',{t:120,r:0.4,m:0.5,cc:0,k:0.45,b:0.012,g:(u,v)=>{const X=u*4,Y=v*4,i=Math.floor(X),j=Math.floor(Y),s=(i+j)%2?1:-1,a=X-i-0.5,b=Y-j-0.5,p=(a+s*b)*Math.SQRT1_2,q=(a-s*b)*Math.SQRT1_2,d=Math.hypot(p/0.42,q/0.1),n=_sK([136,140,146],0.94+0.12*_sF(u,v,8,301));
    return d<1?_sK(n,1.28-0.5*d+(p+q)*0.5):d<1.2?_sK(n,0.7):n;}}],
  ['acier','Acier brossé','Métal',{t:200,r:0.35,m:0.6,cc:0,k:0.5,b:0.018,g:(u,v)=>{const c=146+(_sA(u,v,6,512,311)-0.5)*44+(_sA(u,v,16,128,312)-0.5)*16;return [c,c*1.01,c*1.03];}}],
  ['laiton','Laiton brossé','Métal',{t:200,r:0.3,m:0.6,cc:0,k:0.55,b:0.015,g:(u,v)=>_sK([200,164,86],0.92+0.3*(_sA(u,v,6,512,321)-0.5))}],
  ['cuivre','Cuivre brossé','Métal',{t:200,r:0.3,m:0.6,cc:0,k:0.55,b:0.015,g:(u,v)=>_sK([190,112,76],0.92+0.3*(_sA(u,v,6,512,331)-0.5))}],
  ['perfore','Tôle perforée','Métal',{t:100,r:0.4,m:0.5,cc:0,k:0.3,b:0.015,g:(u,v)=>{const yy=v*10,j=Math.floor(yy),xx=u*10+(j%2?0.5:0),d=Math.hypot(xx-Math.floor(xx)-0.5,yy-j-0.5);return d<0.3?[14,14,16]:d<0.34?[86,88,92]:_sK([168,171,176],0.95+0.1*_sA(u,v,6,256,341));}}],
  // ── peintures ──
  ['pMateNoir','Peinture mate noire','Peintures',Object.assign(_sPeint('mate'),{t:200,g:_sUni([30,30,32],351)})],
  ['pMateBlanc','Peinture mate blanche','Peintures',Object.assign(_sPeint('mate'),{t:200,g:_sUni([232,231,226],352)})],
  ['pMateRouge','Peinture mate rouge','Peintures',Object.assign(_sPeint('mate'),{t:200,g:_sUni([164,42,36],353)})],
  ['pMateSauge','Peinture mate vert sauge','Peintures',Object.assign(_sPeint('mate'),{t:200,g:_sUni([132,150,124],354)})],
  ['pMateBleu','Peinture mate bleu nuit','Peintures',Object.assign(_sPeint('mate'),{t:200,g:_sUni([36,52,84],355)})],
  ['pSatinAnth','Peinture satinée anthracite','Peintures',Object.assign(_sPeint('satin'),{t:200,g:_sUni([62,66,72],356)})],
  ['pSatinCreme','Peinture satinée crème','Peintures',Object.assign(_sPeint('satin'),{t:200,g:_sUni([228,216,190],357)})],
  ['pBrilNoir','Laque noire brillante','Peintures',Object.assign(_sPeint('brillante'),{t:200,g:_sUni([12,12,14],358,0)})],
  ['pBrilBlanc','Laque blanche brillante','Peintures',Object.assign(_sPeint('brillante'),{t:200,g:_sUni([240,240,238],359,0)})],
  ['pBrilRouge','Laque rouge brillante','Peintures',Object.assign(_sPeint('brillante'),{t:200,g:_sUni([176,18,22],360,0)})],
  ['pBrilBleu','Laque bleue brillante','Peintures',Object.assign(_sPeint('brillante'),{t:200,g:_sUni([16,64,150],361,0)})],
  ['pMetArgent','Peinture métallisée argent','Peintures',Object.assign(_sPeint('metal'),{t:100,g:_sMet([176,180,186],362)})],
  ['pMetGraph','Peinture métallisée graphite','Peintures',Object.assign(_sPeint('metal'),{t:100,g:_sMet([70,74,80],363)})],
  ['pMetBleu','Peinture métallisée bleue','Peintures',Object.assign(_sPeint('metal'),{t:100,g:_sMet([34,70,136],364)})],
  ['pMetRouge','Peinture métallisée rouge','Peintures',Object.assign(_sPeint('metal'),{t:100,g:_sMet([146,24,32],365)})],
  ['pMetOr','Peinture pailletée or','Peintures',Object.assign(_sPeint('metal'),{t:100,g:_sMet([190,150,70],366)})],
  ['pNacre','Peinture nacrée blanche','Peintures',Object.assign(_sPeint('nacre'),{t:200,g:_sNacre([236,232,226],[218,226,240],367)})],
  ['pNacreViolet','Peinture nacrée violette','Peintures',Object.assign(_sPeint('nacre'),{t:200,g:_sNacre([86,44,126],[42,70,140],368)})],
  ['pMartele','Peinture martelée','Peintures',{t:100,r:0.4,m:0.3,cc:0.6,k:0.45,b:0.012,g:(u,v)=>{const A=_sCell(u,v,24,369);return _sK([84,104,108],0.72+0.75*A[0]);}}],
  ['pCraquele','Peinture craquelée','Peintures',{t:200,r:0.85,cc:0,k:0,g:(u,v)=>{const A=_sCell(u,v,28,373);return A[1]-A[0]<0.05?[52,42,32]:_sK([206,190,158],0.92+0.14*A[2]);}}],
  ['pEpoxy','Sol époxy d’atelier','Peintures',{t:300,r:0.2,cc:1,k:0.7,g:(u,v)=>{const A=_sCell(u,v,64,377);if(A[0]<0.2)return A[2]>0.66?[230,230,226]:A[2]>0.33?[36,38,42]:[160,164,170];return _sK([118,124,132],0.96+0.08*_sF(u,v,6,381));}}],
  // ── textiles ──
  ['feutre','Feutre gris','Textiles',{t:100,r:1,cc:0,k:0,g:(u,v,T,x,y)=>{const h=sfHash(x,y,391);return _sK([122,124,128],0.82+0.24*_sF(u,v,16,392)+(h-0.5)*0.2);}}],
  ['lin','Toile de lin','Textiles',{t:64,r:0.95,cc:0,k:0,g:(u,v)=>_sK(_sTisse(u,v,64,[208,196,172],[194,180,154]),0.94+0.12*_sA(u,v,4,64,401))}],
  ['jute','Toile de jute','Textiles',{t:80,r:1,cc:0,k:0,g:(u,v)=>_sK(_sTisse(u,v,32,[172,136,88],[150,114,68]),0.85+0.3*_sF(u,v,16,411))}],
  ['denim','Denim','Textiles',{t:48,r:0.95,cc:0,k:0,g:(u,v)=>_sK(_sTisse(u,v,64,[46,72,116],[192,198,206],true),0.88+0.24*_sA(u,v,4,32,421))}],
  ['velRouge','Velours rouge','Textiles',{t:300,r:1,cc:0,k:0,g:(u,v)=>_sLuxe(u,v,[132,18,34],431)}],
  ['velNoir','Velours noir','Textiles',{t:300,r:1,cc:0,k:0,g:(u,v)=>_sLuxe(u,v,[26,26,30],441)}],
  ['velBleu','Velours bleu roi','Textiles',{t:300,r:1,cc:0,k:0,g:(u,v)=>_sLuxe(u,v,[28,48,120],451)}],
  ['soie','Soie ivoire','Textiles',{t:200,r:0.35,cc:0,k:0.25,b:0.02,g:(u,v)=>_sK([234,222,196],0.82+0.3*_sF(u,v,4,461)+0.05*(_sA(u,v,4,256,464)-0.5))}],
  ['tweed','Tweed','Textiles',{t:64,r:1,cc:0,k:0,g:(u,v,T,x,y)=>_sPaillette(x,y,471,_sTisse(u,v,64,[116,104,88],[72,78,74],true),0.04)}],
  ['tartan','Écossais','Textiles',{t:160,r:0.95,cc:0,k:0,g:(u,v)=>{const B=[[4,[28,60,44]],[1,[20,20,28]],[4,[24,40,88]],[1,[20,20,28]],[1,[176,36,36]],[1,[20,20,28]],[3,[28,60,44]],[1,[210,190,110]]];return _sTisse(u,v,128,_sTartan(u,B),_sTartan(v,B),true);}}],
  ['moquette','Moquette','Textiles',{t:100,r:1,cc:0,k:0,g:(u,v)=>_sK([104,92,84],0.62+0.5*_sN(u,v,128,481)+0.22*_sF(u,v,8,482))}],
  ['alcantara','Alcantara','Textiles',{t:150,r:1,cc:0,k:0,g:(u,v,T,x,y)=>_sK([54,56,60],0.82+0.34*_sF(u,v,8,491)+(sfHash(x,y,492)-0.5)*0.14)}],
  ['cuir','Cuir noir','Textiles',{t:100,r:0.5,cc:0.1,k:0.2,b:0.02,g:(u,v)=>{const A=_sCell(u,v,48,501),c=A[1]-A[0]<0.07?16:30+A[0]*18;return [c,c,c*1.02];}}],
  ['cuirFauve','Cuir fauve','Textiles',{t:100,r:0.5,cc:0.1,k:0.2,b:0.02,g:(u,v)=>{const A=_sCell(u,v,48,505);return _sK([150,92,52],A[1]-A[0]<0.07?0.55:0.84+0.3*A[0]);}}],
  ['carbone','Tissu de carbone','Textiles',{t:48,r:0.22,cc:1,k:0.55,g:(u,v)=>{const X=u*24,Y=v*24,i=Math.floor(X),j=Math.floor(Y),top=(i+j)%4<2,f=top?X-i:Y-j,c=18+44*Math.pow(Math.sin(Math.PI*f),2)*(top?1:0.55);return [c,c,c*1.05];}}],
  // ── verres dépolis (aspect : un sol opaque, reflet flou ; on ne voit pas au travers) ──
  ['verreDep','Verre dépoli','Verres dépolis',{t:200,r:0.5,cc:0,k:0.45,b:0.03,g:(u,v,T,x,y)=>_sK([222,232,232],0.96+0.05*_sF(u,v,4,511)+(sfHash(x,y,512)-0.5)*0.03)}],
  ['verreBleu','Verre dépoli bleuté','Verres dépolis',{t:200,r:0.5,cc:0,k:0.45,b:0.03,g:(u,v,T,x,y)=>_sK([172,206,226],0.96+0.06*_sF(u,v,4,521)+(sfHash(x,y,522)-0.5)*0.03)}],
  ['verreFume','Verre dépoli fumé','Verres dépolis',{t:200,r:0.45,cc:0,k:0.5,b:0.025,g:(u,v,T,x,y)=>_sK([62,66,70],0.94+0.1*_sF(u,v,4,531)+(sfHash(x,y,532)-0.5)*0.05)}],
  ['verreGivre','Verre givré','Verres dépolis',{t:150,r:0.55,cc:0,k:0.35,b:0.035,g:(u,v)=>{const A=_sCell(u,v,32,541);return _sK([226,236,240],0.84+0.2*Math.min(1,A[1]-A[0])+0.04*_sN(u,v,128,545));}}],
  ['verreStrie','Verre strié','Verres dépolis',{t:120,r:0.3,cc:0.6,k:0.45,b:0.02,g:(u,v)=>{const f=u*24-Math.floor(u*24);return _sK([214,228,226],0.8+0.24*Math.sin(Math.PI*f));}}],
  // ── LED (émettent de la lumière ; le lancer de rayons éclaire la pièce avec) ──
  ['ledBlanc','Matrice de LED blanches','LED',{t:160,r:0.7,cc:0,k:0.15,em:2.5,g:_sLed(16,[255,250,236],0.14,[14,14,16])}],
  ['ledRvb','Matrice de LED RVB','LED',{t:160,r:0.7,cc:0,k:0.15,em:2.5,g:_sLed(18,(i,j)=>[[255,40,40],[40,255,70],[50,90,255]][(i+j)%3],0.14,[10,10,12])}],
  ['ledBleu','Matrice de LED bleues','LED',{t:160,r:0.7,cc:0,k:0.15,em:2.5,g:_sLed(16,[50,120,255],0.14,[8,10,16])}],
  ['ledAmbre','Matrice de LED ambre','LED',{t:160,r:0.7,cc:0,k:0.15,em:2.5,g:_sLed(16,[255,160,40],0.14,[14,10,8])}],
  ['ledBande','Bandeaux de LED','LED',{t:240,r:0.7,cc:0,k:0.15,em:2,g:(u,v)=>{const f=v*6-Math.floor(v*6),d=Math.abs(f-0.5);return _sMix([18,18,22],[255,250,236],Math.exp(-d*d*220));}}],
  ['ledDalle','Dalle lumineuse','LED',{t:200,r:0.5,cc:0,k:0.2,b:0.03,em:1.6,g:(u,v)=>{const c=246+6*_sF(u,v,4,551);return [c,c,c*0.98];}}],
  ['ledNeon','Néons en grille','LED',{t:300,r:0.7,cc:0,k:0.15,em:2,g:(u,v)=>{const d=q=>{const f=q*3-Math.floor(q*3);return Math.abs(f-0.5);},e=Math.min(d(u),d(v));return _sMix([12,8,20],[255,70,220],Math.exp(-e*e*700));}}],
  // ── atelier ──
  ['caoutchouc','Tapis caoutchouc strié','Atelier',{t:100,r:0.75,cc:0,k:0.1,b:0.02,g:(u,v)=>{const c=28+22*Math.pow(Math.sin(Math.PI*(v*20-Math.floor(v*20))),2)+(_sN(u,v,64,561)-0.5)*5;return [c,c,c];}}],
  ['papier','Papier millimétré','Atelier',{t:100,r:0.9,cc:0,k:0,g:(u,v,T)=>{const G=p=>{const X=u*T,Y=v*T;return Math.min(Math.min(X%p,p-X%p),Math.min(Y%p,p-Y%p));};return G(10)<0.13?[226,120,70]:G(5)<0.08?[236,160,118]:G(1)<0.05?[244,206,178]:[250,246,234];}}],
  ['planBleu','Plan bleu','Atelier',{t:100,r:0.7,cc:0,k:0.05,g:(u,v,T)=>{const G=p=>{const X=u*T,Y=v*T;return Math.min(Math.min(X%p,p-X%p),Math.min(Y%p,p-Y%p));};return G(50)<0.3?[214,228,246]:G(10)<0.13?[118,156,212]:_sK([26,70,136],0.94+0.12*_sF(u,v,8,571));}}],
  ['kraft','Carton kraft','Atelier',{t:150,r:0.9,cc:0,k:0,g:(u,v,T,x,y)=>_sPaillette(x,y,581,_sK([176,132,88],0.88+0.2*_sA(u,v,8,256,582)),0.02)}],
  ['liege','Liège','Atelier',{t:120,r:0.85,cc:0,k:0,g:(u,v)=>{const A=_sCell(u,v,64,591);return _sK(_sMix([146,100,62],[206,164,112],A[2]),A[1]-A[0]<0.06?0.62:1);}}]
].forEach(([k,lab,grp,d])=>{RD_SUPPORTS.push([k,lab,grp]);RD_SUP_DEF[k]=d;});
function rdSupSelect(cur,fn){ // liste des supports, rangée par familles (fenêtre RENDU et réglages de la vue 3D)
  const s=document.createElement('select'),gr={};
  RD_SUPPORTS.forEach(([v,t,g])=>{
    const o=document.createElement('option');o.value=v;o.textContent=t;
    if(!g){s.appendChild(o);return;}
    if(!gr[g]){gr[g]=document.createElement('optgroup');gr[g].label=g;s.appendChild(gr[g]);}
    gr[g].appendChild(o);
  });
  s.value=cur||'';if(s.selectedIndex<0)s.value='';
  s.onchange=()=>fn(s.value);
  return s;
}
/* ── galerie : une vignette par sol, par famille (calculée à la première ouverture : 80 vignettes, quelques dizaines de ms) ── */
let _rdSupGalOuverte=false;
const _rdSupVign={};
function rdSupMark(k){document.querySelectorAll('button[data-sup]').forEach(b=>{b.style.outline=b.dataset.sup===(k||'')?'2px solid var(--primary,#0a84ff)':'none';});}
function rdSupGallery(cur,fn){
  const d=document.createElement('details');d.className='rdSupGal';d.style.cssText='margin:3px 0 6px;font-size:.7rem';
  const sm=document.createElement('summary');sm.textContent='Voir tous les sols';sm.style.cursor='pointer';d.appendChild(sm);
  let fait=false;
  const remplir=()=>{
    if(fait)return;fait=true;const grilles={};
    RD_SUPPORTS.forEach(([k,t,g])=>{
      const fam=g||'Sans matière';
      if(!grilles[fam]){
        const h=document.createElement('div');h.textContent=fam;h.style.cssText='margin:6px 0 2px;opacity:.7';d.appendChild(h);
        grilles[fam]=document.createElement('div');grilles[fam].style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:3px';d.appendChild(grilles[fam]);}
      const grille=grilles[fam],b=document.createElement('button');b.type='button';b.title=t;b.dataset.sup=k;b.setAttribute('aria-label',t);
      b.style.cssText='padding:0;border:1px solid var(--border,#555);border-radius:4px;background:none;cursor:pointer;aspect-ratio:1;overflow:hidden;outline-offset:1px';
      const c=document.createElement('canvas');c.width=c.height=48;c.style.cssText='display:block;width:100%;height:100%';
      if(k){const S=_rdSupVign[k]||(_rdSupVign[k]=rdSupTex(k,48));c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(S.data),48,48),0,0);}
      b.appendChild(c);b.onclick=()=>{fn(k);rdSupMark(k);};grille.appendChild(b);
    });
    rdSupMark(typeof cur==='function'?cur():cur); // cur : la valeur, ou une fonction qui la lit
  };
  d.ontoggle=()=>{_rdSupGalOuverte=d.open;if(d.open)remplir();};
  if(_rdSupGalOuverte){d.open=true;remplir();}
  return d;
}
