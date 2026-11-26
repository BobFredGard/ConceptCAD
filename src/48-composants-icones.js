/* ---------- icônes des pièces normalisées (V1.0.6) ----------
   Demande de Fred : « Dans la timeline de l'assemblage, si le composant entré est un composant
   normalisé, l'icône devrait être identique au composant : 1 vis -> dessin de la vis etc... ».
   Petit dessin (SVG 24 × 24, axe vertical, vu un peu de dessus) d'après la fiche doc.std de la
   pièce : vis CHC / FHC (ISO, ANSI), bouchons (à collerette, coniques), goupilles (cylindrique,
   conique, élastique), clavettes A / B / C, joints toriques et quadrilobes, racleurs, rondelles
   (plates, Grower), douilles autotaraudeuses, engrenages (roue, couronne, crémaillère), aimants
   (pôle nord rouge, pôle sud vert, comme dans la vue). Une pièce ordinaire garde le cube 📦.
   Mêmes dessins partout (asmCompIcon) : étape d'insertion de la timeline (48-assemblage-historique),
   arborescence (42-arbre-modele), en-tête du panneau d'une occurrence (47-assemblage-interface),
   onglets de la fenêtre « Composants normalisés » (stdCatIcon).
   Reconnaissance par la clé (std.key) : les fichiers anciens, sans réglages enregistrés, aussi.
   Chaque dessin porte ses dégradés sous des identifiants neufs (stdIcSeq) : un même identifiant
   répété dans la page, pris dans un panneau masqué, laisserait l'icône sans couleur. */
let stdIcSeq=0;
const STD_IC_E='stroke="#36404c" stroke-width=".7" stroke-linejoin="round"';
const STD_IC_PAL={
  steel:{g:[[0,'#8f9ba8'],[.28,'#f4f7fa'],[.6,'#c9d1da'],[1,'#76828f']],top:'#e7ecf1',hole:'#262d36'},
  face:{g:[[0,'#f6f8fa'],[1,'#b3bdc8']]},
  rubber:{g:[[0,'#6b747f'],[.45,'#3c434b'],[1,'#1b1f24']],side:{g:[[0,'#262b31'],[.3,'#68717c'],[.62,'#3a4149'],[1,'#1b1f24']]},top:'#4d555e',e:'stroke="#0d1014" stroke-width=".6" stroke-linejoin="round"'},
  north:{g:[[0,'#a8322a'],[.3,'#ff8d80'],[.65,'#e0483c'],[1,'#932820']],top:'#f07a6f',e:'stroke="#6e1d17" stroke-width=".6" stroke-linejoin="round"'},
  south:{g:[[0,'#1f6e37'],[.3,'#78d696'],[.65,'#2f9e4f'],[1,'#185a2c']],e:'stroke="#15502a" stroke-width=".6" stroke-linejoin="round"'}
};
function stdIcN(n){return +(+n).toFixed(2);}
function stdIcGrad(id,P,vert){
  return '<linearGradient id="'+id+'" x1="0" y1="0" x2="'+(vert?0:1)+'" y2="'+(vert?1:0)+'">'+
    P.g.map(s=>'<stop offset="'+s[0]+'" stop-color="'+s[1]+'"/>').join('')+'</linearGradient>';
}
function stdIcEllD(cx,cy,rx,ry){
  const f=stdIcN;
  return 'M'+f(cx-rx)+' '+f(cy)+'A'+f(rx)+' '+f(ry)+' 0 1 0 '+f(cx+rx)+' '+f(cy)+'A'+f(rx)+' '+f(ry)+' 0 1 0 '+f(cx-rx)+' '+f(cy)+'Z';
}
function stdIcEll(cx,cy,rx,ry,fill,e){return '<path d="'+stdIcEllD(cx,cy,rx,ry)+'" fill="'+fill+'"'+(e?' '+e:'')+'/>';}
function stdIcCyl(cx,r,y0,y1,ry,fill,e){
  // flanc d'un cylindre vertical : de l'ellipse du haut (centre y0) à celle du bas (y1), bas vu de face
  const f=stdIcN;
  return '<path d="M'+f(cx-r)+' '+f(y0)+'V'+f(y1)+'A'+f(r)+' '+f(ry)+' 0 0 0 '+f(cx+r)+' '+f(y1)+'V'+f(y0)+'Z" fill="'+fill+'" '+e+'/>';
}
function stdIcThr(cx,rf,ya,yb,p,ry){
  // filet : arcs de face, de bas (yb) en haut (ya) ; rf = rayon, ou fonction du y (bouchon conique)
  const f=stdIcN;let s='';
  for(let y=yb;y>ya+1e-6;y-=p){const r=typeof rf==='function'?rf(y):rf;s+='M'+f(cx-r)+' '+f(y)+'A'+f(r)+' '+f(ry)+' 0 0 0 '+f(cx+r)+' '+f(y-p*.45);}
  return '<path d="'+s+'" fill="none" stroke="#56616e" stroke-width=".5"/>';
}
function stdIcHex(cx,cy,rx,ry,fill){
  // six pans creux vu un peu de dessus
  return '<path d="M'+[[-1,0],[-.5,-1],[.5,-1],[1,0],[.5,1],[-.5,1]].map(q=>stdIcN(cx+q[0]*rx)+' '+stdIcN(cy+q[1]*ry)).join('L')+'Z" fill="'+(fill||STD_IC_PAL.steel.hole)+'"/>';
}
function stdIcKeyD(x0,y0,x1,y1,rl,rr){
  // rectangle aux bouts arrondis (rl à gauche, rr à droite) : dessus d'une clavette, ou sa silhouette
  const f=stdIcN;
  return 'M'+f(x0+rl)+' '+f(y0)+'H'+f(x1-rr)+'A'+f(rr)+' '+f(rr)+' 0 0 1 '+f(x1)+' '+f(y0+rr)+'V'+f(y1-rr)+'A'+f(rr)+' '+f(rr)+' 0 0 1 '+f(x1-rr)+' '+f(y1)+
    'H'+f(x0+rl)+'A'+f(rl)+' '+f(rl)+' 0 0 1 '+f(x0)+' '+f(y1-rl)+'V'+f(y0+rl)+'A'+f(rl)+' '+f(rl)+' 0 0 1 '+f(x0+rl)+' '+f(y0)+'Z';
}
function stdIcGearD(cx,cy,ra,rf,n,ph){
  // contour denté vu de face : n dents, tête ra, pied rf (ra < rf : denture intérieure), ph = décalage (pas)
  const f=stdIcN,P=[],t=2*Math.PI/n,wr=t*.3,wt=t*.15;
  for(let k=0;k<n;k++){const a=(k+(ph||0))*t-Math.PI/2;
    [[rf,a-wr],[ra,a-wt],[ra,a+wt],[rf,a+wr]].forEach(q=>P.push(f(cx+q[0]*Math.cos(q[1]))+' '+f(cy+q[0]*Math.sin(q[1]))));}
  return 'M'+P.join('L')+'Z';
}
function stdIcIso(X,Y,Z){return stdIcN(12+(X-Y)*.866)+' '+stdIcN(12+(X+Y)*.5-Z);}
function stdIcIsoPoly(pts,fill,e){return '<path d="M'+pts.map(p=>stdIcIso(p[0],p[1],p[2])).join('L')+'Z" fill="'+fill+'" '+e+'/>';}
function stdIcKind(std){
  // famille du dessin d'après la fiche ; réglages enregistrés (cat / st) d'abord, sinon la clé
  if(!std||typeof std.key!=='string')return null;
  const k=std.key,st=std.st&&typeof std.st==='object'?std.st:{},cat=std.cat;
  if(std.mag||/^MAG:/.test(k)){
    const m=std.mag||{},eq=(a,b)=>Math.abs((+a||0)-(+b||0))<1e-6;
    if(m.s==='box')return eq(m.a,m.b)&&eq(m.a,m.h)?'magCube':'magBox';
    return m.s==='ring'?'magRing':m.s==='cone'?'magCone':m.holes?'magCs':'magCyl';
  }
  if((cat==='iso'||cat==='ansi')&&st.type)return st.type==='fhc'?'fhc':'chc';
  if(/^ISO 10642\||FHCS\|/.test(k))return 'fhc';
  if(/^ISO 4762\||SHCS\|/.test(k))return 'chc';
  if(/^DIN 908\|/.test(k))return 'plug908';
  if(/^(DIN 906|NPTF)\|/.test(k))return 'plugCone';
  if(/^ISO 2339\|/.test(k))return 'pinCone';
  if(/^(ISO 8752|ASME B18\.8\.2 spring)\|/.test(k))return 'pinSpring';
  if(/^(ISO 2338|ISO 8734|ASME B18\.8\.2 dowel)\|/.test(k))return 'pin';
  if(/^ISO 773\|/.test(k)){const f=k.split('|')[1];return f==='B'?'keyB':f==='C'?'keyC':'keyA';}
  if(/^ORING\|/.test(k))return 'oring';
  if(/^XRING\|/.test(k))return 'xring';
  if(/^WIPER\|/.test(k))return 'wiper';
  if(/^WASHER\|/.test(k))return /^WASHER\|(DIN 127|ASME B18\.21\.1)/.test(k)?'grower':'washer';
  if(/^ENSAT/.test(k))return 'insert';
  if(/^GEAR\|/.test(k)){
    const kind=cat==='gear'&&st.kind?st.kind:(k.split('|')[10]||'');
    return kind==='rack'?'rack':kind==='int'?'gearInt':'gear';
  }
  return 'std'; // pièce normalisée d'une famille sans dessin : l'icône de la commande « Normalisés »
}
const STD_IC_CAT={iso:'chc',ansi:'chc',plug:'plug908',pin:'pin',key:'keyA',oring:'oring',wiper:'wiper',washer:'washer',
  insert:'insert',gear:'gear',gearPair:'gearPair',magnet:'magCyl'};
function stdIcBody(kind,u){
  // {d: dégradés, b: dessin} ; u = préfixe des identifiants de ce dessin
  const S=STD_IC_PAL.steel,E=STD_IC_E,gS=u+'s',gV=u+'v',fS='url(#'+gS+')',fV='url(#'+gV+')';
  const dS=stdIcGrad(gS,S)+stdIcGrad(gV,STD_IC_PAL.face,true);
  const chamfer=(cx,cy,rx,ry)=>stdIcEll(cx,cy,rx,ry,'#f7f9fb','stroke="#9aa5b1" stroke-width=".4"');
  switch(kind){
    case 'chc': // tête cylindrique six pans creux, tige filetée au bout chanfreiné
      return {d:dS,b:'<path d="M9.4 8V20.3L10.3 21.3H13.7L14.6 20.3V8Z" fill="'+fS+'" '+E+'/>'+stdIcThr(12,2.6,11.6,20.2,1.5,.75)+
        stdIcCyl(12,6.2,3.6,8.3,1.7,fS,E)+stdIcEll(12,3.6,6.2,1.7,S.top,E)+stdIcHex(12,3.6,2.3,.8)};
    case 'fhc': // tête fraisée (cône), affleurante
      return {d:dS,b:'<path d="M9.4 8.6V20.3L10.3 21.3H13.7L14.6 20.3V8.6Z" fill="'+fS+'" '+E+'/>'+stdIcThr(12,2.6,11.8,20.2,1.5,.75)+
        '<path d="M4.8 3.6L9.4 8.7A2.6 .75 0 0 0 14.6 8.7L19.2 3.6Z" fill="'+fS+'" '+E+'/>'+stdIcEll(12,3.6,7.2,1.8,S.top,E)+stdIcHex(12,3.6,2.5,.85)};
    case 'plug908': // bouchon à collerette
      return {d:dS,b:'<path d="M7.6 8.8V18.7L8.6 19.8H15.4L16.4 18.7V8.8Z" fill="'+fS+'" '+E+'/>'+stdIcThr(12,4.4,10.4,18.7,1.6,1.1)+
        stdIcCyl(12,7.2,5.6,8.6,1.8,fS,E)+stdIcEll(12,5.6,7.2,1.8,S.top,E)+stdIcHex(12,5.6,2.9,1)};
    case 'plugCone': { // bouchon conique sans collerette (DIN 906, NPTF)
      const r=y=>5.7-(y-6.2)/(18.6-6.2)*1.8;
      return {d:dS,b:'<path d="M6.3 6.2L8.1 18.6L9.1 19.7H14.9L15.9 18.6L17.7 6.2Z" fill="'+fS+'" '+E+'/>'+stdIcThr(12,r,8,18.4,1.6,1.1)+
        stdIcEll(12,6.2,5.7,1.6,S.top,E)+stdIcHex(12,6.2,2.6,.9)};
    }
    case 'pin': // goupille cylindrique, bouts chanfreinés
      return {d:dS,b:stdIcCyl(12,3.5,3.6,20.2,1.2,fS,E)+'<path d="M8.5 19.3A3.5 1.2 0 0 0 15.5 19.3" fill="none" stroke="#56616e" stroke-width=".5"/>'+
        stdIcEll(12,3.6,3.5,1.2,S.top,E)+chamfer(12,3.6,2.6,.85)};
    case 'pinCone': // goupille conique 1:50 (pente exagérée pour se voir)
      return {d:dS,b:'<path d="M7.7 3.6L9.6 19.7A2.4 .85 0 0 0 14.4 19.7L16.3 3.6Z" fill="'+fS+'" '+E+'/>'+
        stdIcEll(12,3.6,4.3,1.35,S.top,E)+chamfer(12,3.6,3.2,.95)};
    case 'pinSpring': // goupille élastique : tube fendu
      return {d:dS,b:stdIcCyl(12,3.6,3.6,20.2,1.2,fS,E)+stdIcEll(12,3.6,3.6,1.2,S.top,E)+stdIcEll(12,3.6,2.4,.8,S.hole)+
        '<path d="M11.35 4.3H12.65V21.4H11.35Z" fill="'+S.hole+'"/>'};
    case 'keyA': case 'keyB': case 'keyC': { // clavette parallèle : bouts ronds, droits, un bout rond
      const R=3.6,rl=kind==='keyB'?.8:R,rr=kind==='keyA'?R:.8;
      return {d:dS,b:'<path d="'+stdIcKeyD(2.5,6.6,21.5,13.8+3.4,rl,rr)+'" fill="#8d99a6" '+E+'/>'+
        '<path d="'+stdIcKeyD(2.5,6.6,21.5,13.8,rl,rr)+'" fill="'+fV+'" '+E+'/>'};
    }
    case 'oring': case 'xring': { // joint torique ; quadrilobe : gorge au milieu du tore
      const P=STD_IC_PAL.rubber,g=u+'r';
      return {d:stdIcGrad(g,P,true),b:'<path d="'+stdIcEllD(12,12,9.6,6.3)+stdIcEllD(12,12,5.4,3.1)+'" fill-rule="evenodd" fill="url(#'+g+')" '+P.e+'/>'+
        (kind==='xring'?'<path d="'+stdIcEllD(12,12,7.5,4.7)+'" fill="none" stroke="#0d1014" stroke-width=".55"/>'+
          '<path d="M6.4 10.4A6.6 4 0 0 1 12 8.4" fill="none" stroke="#c3cad2" stroke-width=".7" stroke-linecap="round" opacity=".75"/>'
          :'')+
        '<path d="M4.4 10.2A8.2 5.2 0 0 1 12 6.8" fill="none" stroke="#c3cad2" stroke-width=".9" stroke-linecap="round" opacity=".8"/>'};
    }
    case 'wiper': { // racleur : bague épaisse, lèvre dans l'alésage
      const P=STD_IC_PAL.rubber,g=u+'r';
      return {d:stdIcGrad(g,P.side),b:stdIcCyl(12,9,8.2,14.6,3.4,'url(#'+g+')',P.e)+
        '<path d="'+stdIcEllD(12,8.2,9,3.4)+stdIcEllD(12,8.2,5.6,2.1)+'" fill-rule="evenodd" fill="'+P.top+'" '+P.e+'/>'+
        stdIcEll(12,8.2,5.6,2.1,'#0d1014')+'<path d="M7.4 9.1A4.6 1.6 0 0 0 16.6 9.1" fill="none" stroke="#8a939d" stroke-width=".6"/>'+
        '<path d="M4.4 7A8.4 3 0 0 1 10 5" fill="none" stroke="#a7b0ba" stroke-width=".7" stroke-linecap="round" opacity=".7"/>'};
    }
    case 'washer': case 'grower': { // rondelle plate ; Grower : fendue
      const c=u+'c';
      return {d:dS+'<clipPath id="'+c+'"><path d="'+stdIcEllD(12,10.5,4.4,2.1)+'"/></clipPath>',b:
        '<path d="M2.4 10.5A9.6 4.6 0 0 0 21.6 10.5V12.9A9.6 4.6 0 0 1 2.4 12.9Z" fill="'+fS+'" '+E+'/>'+
        '<path d="'+stdIcEllD(12,10.5,9.6,4.6)+stdIcEllD(12,10.5,4.4,2.1)+'" fill-rule="evenodd" fill="'+fV+'" '+E+'/>'+
        '<path d="'+stdIcEllD(12,10.5,4.4,2.1)+stdIcEllD(12,12.9,4.4,2.1)+'" fill-rule="evenodd" fill="#7f8b98" clip-path="url(#'+c+')"/>'+
        (kind==='grower'?'<path d="M14.5 12.2L17.5 14.3V16.8" fill="none" stroke="#1b2129" stroke-width="1.3"/>':'')};
    }
    case 'insert': // douille autotaraudeuse : corps fileté, taraudage, fente de coupe en bas
      return {d:dS,b:stdIcCyl(12,5.4,4.6,19.4,1.6,fS,E)+stdIcThr(12,5.4,6.8,19.2,2.1,1.6)+
        '<path d="M11.4 14.4H12.6V21H11.4Z" fill="'+S.hole+'"/>'+
        stdIcEll(12,4.6,5.4,1.6,S.top,E)+stdIcEll(12,4.6,3.1,.95,S.hole)+'<path d="M9.6 4.9A2.4 .6 0 0 0 14.4 4.9" fill="none" stroke="#6b7682" stroke-width=".45"/>'};
    case 'gear': // roue dentée vue de face, alésage
      return {d:dS,b:'<path d="'+stdIcGearD(12,12,10.2,7.7,10)+stdIcEllD(12,12,2.8,2.8)+'" fill-rule="evenodd" fill="'+fV+'" '+E+'/>'+
        '<path d="'+stdIcEllD(12,12,4.9,4.9)+'" fill="none" stroke="#8d99a6" stroke-width=".6"/>'};
    case 'gearInt': // couronne : denture intérieure
      return {d:dS,b:'<path d="'+stdIcEllD(12,12,10.6,10.6)+stdIcGearD(12,12,6.6,8.5,12)+'" fill-rule="evenodd" fill="'+fV+'" '+E+'/>'};
    case 'gearPair': // paire : deux roues en prise
      return {d:dS,b:'<path d="'+stdIcGearD(8.4,8.6,6.6,4.9,9)+stdIcEllD(8.4,8.6,1.7,1.7)+'" fill-rule="evenodd" fill="'+fV+'" '+E+'/>'+
        '<path d="'+stdIcGearD(15.9,15.4,5.4,3.9,7,.5)+stdIcEllD(15.9,15.4,1.4,1.4)+'" fill-rule="evenodd" fill="'+fV+'" '+E+'/>'};
    case 'rack': { // crémaillère
      let d='M2 18.6V12.6';for(let x=2.6;x+3.2<=22;x+=4)d+='L'+stdIcN(x+.3)+' 12.6L'+stdIcN(x+1.3)+' 8.4L'+stdIcN(x+2.5)+' 8.4L'+stdIcN(x+3.5)+' 12.6';
      return {d:dS,b:'<path d="'+d+'L22 12.6V18.6Z" fill="'+fV+'" '+E+'/>'};
    }
    case 'magCyl': case 'magCs': case 'magRing': case 'magCone': { // aimant : nord (haut) rouge, sud (bas) vert
      const N=STD_IC_PAL.north,Z=STD_IC_PAL.south,gN=u+'n',gZ=u+'z',cone=kind==='magCone';
      const top=cone?5.2:8,mid=cone?6.6:8,bot=8;
      let b='<path d="M'+stdIcN(12-mid)+' 12.5L'+(12-bot)+' 17A'+bot+' 2.8 0 0 0 '+(12+bot)+' 17L'+stdIcN(12+mid)+' 12.5A'+mid+' '+(cone?2.4:2.8)+' 0 0 1 '+stdIcN(12-mid)+' 12.5Z" fill="url(#'+gZ+')" '+Z.e+'/>'+
        '<path d="M'+stdIcN(12-top)+' 7.5L'+stdIcN(12-mid)+' 12.5A'+mid+' '+(cone?2.4:2.8)+' 0 0 0 '+stdIcN(12+mid)+' 12.5L'+stdIcN(12+top)+' 7.5Z" fill="url(#'+gN+')" '+N.e+'/>'+
        stdIcEll(12,7.5,top,cone?1.9:2.8,N.top,N.e);
      if(kind==='magCs')b+=stdIcEll(12,7.5,3.4,1.2,'#a8322a')+stdIcEll(12,7.5,1.5,.55,'#3a0f0b');
      if(kind==='magRing')b+=stdIcEll(12,7.5,3.2,1.1,'#3a0f0b',N.e);
      return {d:stdIcGrad(gN,N)+stdIcGrad(gZ,Z),b};
    }
    case 'magCube': case 'magBox': {
      const N=STD_IC_PAL.north,Z=STD_IC_PAL.south,a=kind==='magCube'?5.3:7.2,c=kind==='magCube'?5.3:4.2,h=kind==='magCube'?4.6:2.6;
      const L=(z0,z1)=>[[-a,c,z0],[a,c,z0],[a,c,z1],[-a,c,z1]],Rt=(z0,z1)=>[[a,-c,z0],[a,c,z0],[a,c,z1],[a,-c,z1]];
      return {d:'',b:stdIcIsoPoly(L(-h,0),'#2f9e4f',Z.e)+stdIcIsoPoly(Rt(-h,0),'#1f6e37',Z.e)+
        stdIcIsoPoly(L(0,h),'#e0483c',N.e)+stdIcIsoPoly(Rt(0,h),'#a8322a',N.e)+
        stdIcIsoPoly([[-a,-c,h],[a,-c,h],[a,c,h],[-a,c,h]],N.top,N.e)};
    }
  }
  return null;
}
function stdIcSvg(kind){
  const B=kind&&stdIcBody(kind,'sIc'+(++stdIcSeq)+'_');
  if(!B)return '';
  return '<svg class="stdIc" data-std="'+kind+'" viewBox="0 0 24 24" width="1.3em" height="1.3em" style="vertical-align:-.32em;flex:none;overflow:visible" aria-hidden="true">'+
    (B.d?'<defs>'+B.d+'</defs>':'')+B.b+'</svg>';
}
function stdIcon(std){
  // dessin d'une pièce normalisée (fiche doc.std) ; '' si ce n'en est pas une
  const k=stdIcKind(std);
  if(!k)return '';
  return k==='std'?'🔩':stdIcSvg(k);
}
function stdCatIcon(cat){return stdIcSvg(STD_IC_CAT[cat]);} // onglet de la fenêtre « Composants normalisés »
function asmCompIcon(c){
  // icône d'un composant : son dessin s'il est normalisé, sinon le cube
  const s=c&&c.doc&&c.doc.std?stdIcon(c.doc.std):'';
  return s||'📦';
}
