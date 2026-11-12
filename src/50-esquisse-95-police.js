/* ---------- Esquisse : lecture des polices de caractères (V0.96.0) ----------
   Lecteur maison, sans bibliothèque : TrueType (.ttf, contours « glyf », courbes du 2ᵉ degré),
   OpenType CFF (.otf, charstrings Type 2, courbes du 3ᵉ degré, polices CID comprises) et
   collections (.ttc / .otc : la police voulue choisie par son nom PostScript ou son rang).
   Sortie d'un glyphe : {adv, contours:[{s:[x,y], seg:[{k:'L',p} | {k:'Q',c,p,imp} | {k:'C',c1,c2,p}]}]}
   en unités de la police (y vers le haut). imp = bout de courbe IMPLICITE de TrueType (milieu de deux
   points hors courbe) : la courbe y est tangente, le texte (50-esquisse-96) y prolonge la même spline.
   Hors champ : WOFF / WOFF2 (polices du web, pas des polices installées), CFF2 (polices variables
   OpenType, rares), réglage des polices variables (instance par défaut seulement), crénage GPOS. */
function fontU8(buf){return buf instanceof Uint8Array?buf:new Uint8Array(buf);}
function fontReader(u8){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  return{u8,dv,len:u8.byteLength,
    u8at:o=>dv.getUint8(o),u16:o=>dv.getUint16(o),i16:o=>dv.getInt16(o),u32:o=>dv.getUint32(o),i32:o=>dv.getInt32(o),
    tag:o=>String.fromCharCode(dv.getUint8(o),dv.getUint8(o+1),dv.getUint8(o+2),dv.getUint8(o+3))};
}
// Collection : décalages des polices qu'elle contient (une seule pour un fichier simple)
function fontFaceOffsets(buf){
  const R=fontReader(fontU8(buf));if(R.len<12)throw new Error('fichier de police trop court');
  if(R.tag(0)==='ttcf'){const n=R.u32(8),out=[];for(let i=0;i<n;i++)out.push(R.u32(12+4*i));return out;}
  return[0];
}
function fontNames(R,o,len){
  // table « name » : 1 famille, 2 style, 4 nom complet, 6 PostScript, 16/17 famille et style typographiques
  const out={},cnt=R.u16(o+2),so=o+R.u16(o+4);
  const score={};
  for(let i=0;i<cnt;i++){
    const r=o+6+12*i,pl=R.u16(r),en=R.u16(r+2),la=R.u16(r+4),id=R.u16(r+6),l=R.u16(r+8),of=R.u16(r+10);
    if([1,2,4,6,16,17].indexOf(id)<0||so+of+l>R.len)continue;
    let s='',sc=0;
    if(pl===3||pl===0){for(let k=0;k+1<l;k+=2)s+=String.fromCharCode(R.u16(so+of+k));sc=pl===3?(la===0x409?4:(la===0x40c?3:2)):2;}
    else if(pl===1&&en===0){for(let k=0;k<l;k++)s+=String.fromCharCode(R.u8at(so+of+k));sc=1;}
    else continue;
    if(s&&(score[id]==null||sc>score[id])){score[id]=sc;out[id]=s;}
  }
  return{family:out[16]||out[1]||'',style:out[17]||out[2]||'',full:out[4]||'',ps:out[6]||''};
}
function fontCmap(R,o){
  // table « cmap » : format 12 (Unicode complet) de préférence, puis 4 (BMP), 6, 0 ; Symbol (3,0) en dernier
  const n=R.u16(o+2),subs=[];
  for(let i=0;i<n;i++){const pl=R.u16(o+4+8*i),en=R.u16(o+6+8*i),of=o+R.u32(o+8+8*i);
    const fm=R.u16(of);let sc=-1;
    if(pl===3&&en===10&&fm===12)sc=10;else if(pl===0&&fm===12)sc=9;
    else if(pl===3&&en===1&&fm===4)sc=8;else if(pl===0&&fm===4)sc=7;
    else if(pl===3&&en===0&&fm===4)sc=5;else if(fm===6)sc=3;else if(fm===0)sc=2;
    if(sc>=0)subs.push({sc,of,fm,sym:pl===3&&en===0});}
  subs.sort((a,b)=>b.sc-a.sc);
  const S=subs[0];if(!S)return()=>0;
  const of=S.of;
  if(S.fm===12){const ng=R.u32(of+12),G=[];for(let i=0;i<ng;i++){const g=of+16+12*i;G.push([R.u32(g),R.u32(g+4),R.u32(g+8)]);}
    return cp=>{let lo=0,hi=G.length-1;while(lo<=hi){const m=(lo+hi)>>1,g=G[m];if(cp<g[0])hi=m-1;else if(cp>g[1])lo=m+1;else return g[2]+cp-g[0];}return 0;};}
  if(S.fm===4){
    const sx2=R.u16(of+6),segs=sx2/2,ends=of+14,starts=ends+sx2+2,dels=starts+sx2,rgo=dels+sx2;
    const look=cp=>{if(cp>0xffff)return 0;
      let lo=0,hi=segs-1;while(lo<hi){const m=(lo+hi)>>1;if(R.u16(ends+2*m)<cp)lo=m+1;else hi=m;}
      const m=lo;if(R.u16(ends+2*m)<cp)return 0;
      const st=R.u16(starts+2*m);if(cp<st)return 0;const d=R.i16(dels+2*m),ro=R.u16(rgo+2*m);
      if(!ro)return(cp+d)&0xffff;
      const ga=rgo+2*m+ro+2*(cp-st);if(ga+2>R.len)return 0;const g=R.u16(ga);return g?(g+d)&0xffff:0;};
    // police Symbol : caractères rangés en F000–F0FF
    return S.sym?(cp=>look(cp)||(cp<0x100?look(0xf000+cp):0)):look;}
  if(S.fm===6){const first=R.u16(of+6),cnt=R.u16(of+8);return cp=>cp>=first&&cp<first+cnt?R.u16(of+10+2*(cp-first)):0;}
  if(S.fm===0)return cp=>cp<256?R.u8at(of+6+cp):0;
  return()=>0;
}
/* ----- TrueType : contours « glyf » ----- */
function fontGlyfPoints(F,gid,depth){
  // [{pts:[[x,y,on]…]}] d'un glyphe, composites dépliés (décalage + échelle / matrice)
  const R=F.R;if(gid<0||gid>=F.numGlyphs||(depth||0)>8)return[];
  const lo=F.loca;const a=F.locFmt?R.u32(lo+4*gid):2*R.u16(lo+2*gid),b=F.locFmt?R.u32(lo+4*gid+4):2*R.u16(lo+2*gid+2);
  if(b<=a)return[];
  const o=F.glyf+a,nc=R.i16(o);
  if(nc>=0){
    const ends=[];for(let i=0;i<nc;i++)ends.push(R.u16(o+10+2*i));
    const np=nc?ends[nc-1]+1:0;let p=o+10+2*nc;p+=2+R.u16(p);
    const fl=[];while(fl.length<np){const f=R.u8at(p++);fl.push(f);if(f&8){let r=R.u8at(p++);while(r-->0&&fl.length<np)fl.push(f);}}
    const X=[],Y=[];let v=0;
    for(let i=0;i<np;i++){const f=fl[i];if(f&2){const d=R.u8at(p++);v+=(f&16)?d:-d;}else if(!(f&16)){v+=R.i16(p);p+=2;}X.push(v);}
    v=0;
    for(let i=0;i<np;i++){const f=fl[i];if(f&4){const d=R.u8at(p++);v+=(f&32)?d:-d;}else if(!(f&32)){v+=R.i16(p);p+=2;}Y.push(v);}
    const out=[];let s=0;
    ends.forEach(e=>{const pts=[];for(let i=s;i<=e;i++)pts.push([X[i],Y[i],fl[i]&1]);s=e+1;if(pts.length)out.push({pts});});
    return out;
  }
  // composite
  let p=o+10,flags,out=[];
  do{
    flags=R.u16(p);const g=R.u16(p+2);p+=4;
    let dx,dy;
    if(flags&1){dx=R.i16(p);dy=R.i16(p+2);p+=4;}else{dx=(R.u8at(p)<<24)>>24;dy=(R.u8at(p+1)<<24)>>24;p+=2;}
    if(!(flags&2)){dx=0;dy=0;} // points appariés (rare) : posé sans décalage
    let m=[1,0,0,1];const f2=o2=>R.i16(o2)/16384;
    if(flags&8){const s=f2(p);m=[s,0,0,s];p+=2;}
    else if(flags&0x40){m=[f2(p),0,0,f2(p+2)];p+=4;}
    else if(flags&0x80){m=[f2(p),f2(p+2),f2(p+4),f2(p+6)];p+=8;}
    fontGlyfPoints(F,g,(depth||0)+1).forEach(c=>{
      out.push({pts:c.pts.map(q=>[m[0]*q[0]+m[2]*q[1]+dx,m[1]*q[0]+m[3]*q[1]+dy,q[2]])});});
  }while(flags&0x20);
  return out;
}
function fontTTContour(pts){
  // points TrueType (sur / hors courbe) → segments ; milieu implicite entre deux points hors courbe
  const n=pts.length;if(n<2)return null;
  let k=pts.findIndex(q=>q[2]);
  let P=pts.map(q=>[q[0],q[1],!!q[2]]);
  if(k<0){const a=P[n-1],b=P[0];P=[[(a[0]+b[0])/2,(a[1]+b[1])/2,true,1]].concat(P);k=0;} // aucun point sur la courbe
  P=P.slice(k).concat(P.slice(0,k));
  const s=[P[0][0],P[0][1]],seg=[];let ctrl=null;
  const N=P.length;
  for(let i=1;i<=N;i++){
    const q=P[i%N],pt=[q[0],q[1]];
    if(q[2]){if(ctrl){seg.push({k:'Q',c:ctrl,p:pt,imp:!!(i===N?P[0][3]:q[3])});ctrl=null;}else seg.push({k:'L',p:pt});}
    else{if(ctrl){const m=[(ctrl[0]+pt[0])/2,(ctrl[1]+pt[1])/2];seg.push({k:'Q',c:ctrl,p:m,imp:true});}ctrl=pt;}
  }
  // segments nuls retirés (points doublés)
  const out=[];let cur=s;
  seg.forEach(g=>{if(g.k==='L'&&Math.abs(g.p[0]-cur[0])<1e-9&&Math.abs(g.p[1]-cur[1])<1e-9)return;out.push(g);cur=g.p;});
  return out.length?{s,seg:out}:null;
}
/* ----- CFF : dictionnaires, index et charstrings Type 2 ----- */
function cffIndex(R,o){
  // {items:[[début, fin]…], end}
  const cnt=R.u16(o);if(!cnt)return{items:[],end:o+2};
  const osz=R.u8at(o+2),rd=q=>{let v=0;for(let i=0;i<osz;i++)v=v*256+R.u8at(q+i);return v;};
  const base=o+3+(cnt+1)*osz-1,items=[];
  for(let i=0;i<cnt;i++)items.push([base+rd(o+3+i*osz),base+rd(o+3+(i+1)*osz)]);
  return{items,end:base+rd(o+3+cnt*osz)};
}
function cffDict(R,a,b){
  const out={},st=[];let p=a;
  while(p<b){
    const v=R.u8at(p);
    if(v<=21){let op=v;p++;if(v===12){op=1200+R.u8at(p);p++;}out[op]=st.slice();st.length=0;}
    else if(v===28){st.push(R.i16(p+1));p+=3;}
    else if(v===29){st.push(R.i32(p+1));p+=5;}
    else if(v===30){p++;let s='',done=false;const nib='0123456789.EE?-';
      while(!done&&p<b){const byte=R.u8at(p++);for(const n of[byte>>4,byte&15]){if(n===15){done=true;break;}s+=n===12?'E-':(n===13?'?':nib[n]);}}
      st.push(parseFloat(s)||0);}
    else if(v>=32&&v<=246){st.push(v-139);p++;}
    else if(v>=247&&v<=250){st.push((v-247)*256+R.u8at(p+1)+108);p+=2;}
    else if(v>=251&&v<=254){st.push(-(v-251)*256-R.u8at(p+1)-108);p+=2;}
    else p++;
  }
  return out;
}
function cffBias(n){return n<1240?107:(n<33900?1131:32768);}
function cffPrivate(R,cff,ent){
  // [taille, décalage] → {subrs, nominal}
  if(!ent||ent.length<2)return{subrs:[],nominal:0};
  const sz=ent[0],off=cff+ent[1],D=cffDict(R,off,off+sz);
  const subrs=D[19]?cffIndex(R,off+D[19][0]).items:[];
  return{subrs,nominal:D[21]?D[21][0]:0};
}
function fontCffInit(F,cff){
  const R=F.R,hs=R.u8at(cff+2);
  const nameI=cffIndex(R,cff+hs),topI=cffIndex(R,nameI.end),strI=cffIndex(R,topI.end),gsI=cffIndex(R,strI.end);
  const top=topI.items[0];if(!top)throw new Error('CFF sans dictionnaire');
  const T=cffDict(R,top[0],top[1]);
  if(T[1206]&&T[1206][0]!==2)throw new Error('charstrings de type '+T[1206][0]+' non lues');
  F.cs=cffIndex(R,cff+T[17][0]).items;F.gsubrs=gsI.items;
  if(T[1236]){ // police CID : un dictionnaire privé par groupe de glyphes
    const fdI=cffIndex(R,cff+T[1236][0]);F.fds=fdI.items.map(it=>cffPrivate(R,cff,cffDict(R,it[0],it[1])[18]));
    const fo=cff+T[1237][0],fm=R.u8at(fo),sel=new Uint16Array(F.cs.length);
    if(fm===0)for(let i=0;i<F.cs.length;i++)sel[i]=R.u8at(fo+1+i);
    else if(fm===3){const nr=R.u16(fo+1);for(let r=0;r<nr;r++){const a=R.u16(fo+3+3*r),fd=R.u8at(fo+5+3*r),b=R.u16(fo+6+3*r);for(let g=a;g<b&&g<sel.length;g++)sel[g]=fd;}}
    F.fdSel=sel;
  }else F.priv=cffPrivate(R,cff,T[18]);
}
function fontCffGlyph(F,gid){
  const R=F.R,it=F.cs[gid];if(!it)return[];
  const pv=F.fds?(F.fds[F.fdSel[gid]]||F.fds[0]):F.priv;
  const lsub=pv.subrs,lb=cffBias(lsub.length),gb=cffBias(F.gsubrs.length);
  const conts=[];let cur=null,x=0,y=0,st=[],nStem=0,haveW=false,depth=0;
  const close=()=>{if(cur&&cur.seg.length){const L=cur.seg[cur.seg.length-1].p;if(Math.abs(L[0]-cur.s[0])>1e-9||Math.abs(L[1]-cur.s[1])>1e-9)cur.seg.push({k:'L',p:cur.s.slice()});conts.push(cur);}cur=null;};
  const move=(dx,dy)=>{close();x+=dx;y+=dy;cur={s:[x,y],seg:[]};};
  const line=(dx,dy)=>{x+=dx;y+=dy;if(!cur)cur={s:[x-dx,y-dy],seg:[]};cur.seg.push({k:'L',p:[x,y]});};
  const curve=(a,b,c,d,e,f)=>{const c1=[x+a,y+b],c2=[c1[0]+c,c1[1]+d];x=c2[0]+e;y=c2[1]+f;if(!cur)cur={s:c1.slice(),seg:[]};cur.seg.push({k:'C',c1,c2,p:[x,y]});};
  const width=(nArgs)=>{if(!haveW){if(st.length>nArgs)st.shift();haveW=true;}};
  const stems=()=>{width(st.length%2?st.length-1:st.length);nStem+=st.length>>1;st=[];};
  let done=false;
  const run=(a,b)=>{
    if(++depth>12)throw new Error('sous-programmes trop imbriqués');
    let p=a;
    while(p<b&&!done){
      const v=R.u8at(p);
      if(v>=32||v===28){
        if(v===28){st.push(R.i16(p+1));p+=3;}
        else if(v<=246){st.push(v-139);p++;}
        else if(v<=250){st.push((v-247)*256+R.u8at(p+1)+108);p+=2;}
        else if(v<=254){st.push(-(v-251)*256-R.u8at(p+1)-108);p+=2;}
        else{st.push(R.i32(p+1)/65536);p+=5;}
        continue;
      }
      p++;
      switch(v){
        case 1:case 3:case 18:case 23:stems();break;
        case 19:case 20:stems();p+=(nStem+7)>>3;break; // hintmask / cntrmask
        case 21:width(2);move(st[0],st[1]);st=[];break;
        case 22:width(1);move(st[0],0);st=[];break;
        case 4:width(1);move(0,st[0]);st=[];break;
        case 5:for(let i=0;i+1<st.length;i+=2)line(st[i],st[i+1]);st=[];break;
        case 6:case 7:{let h=v===6;for(let i=0;i<st.length;i++){if(h)line(st[i],0);else line(0,st[i]);h=!h;}st=[];break;}
        case 8:for(let i=0;i+5<st.length;i+=6)curve(st[i],st[i+1],st[i+2],st[i+3],st[i+4],st[i+5]);st=[];break;
        case 24:{let i=0;for(;i+5<st.length-2;i+=6)curve(st[i],st[i+1],st[i+2],st[i+3],st[i+4],st[i+5]);line(st[i],st[i+1]);st=[];break;}
        case 25:{let i=0;for(;i+1<st.length-6;i+=2)line(st[i],st[i+1]);curve(st[i],st[i+1],st[i+2],st[i+3],st[i+4],st[i+5]);st=[];break;}
        case 26:{let i=0,dx1=0;if(st.length%2){dx1=st[0];i=1;}for(;i+3<st.length;i+=4){curve(dx1,st[i],st[i+1],st[i+2],0,st[i+3]);dx1=0;}st=[];break;}
        case 27:{let i=0,dy1=0;if(st.length%2){dy1=st[0];i=1;}for(;i+3<st.length;i+=4){curve(st[i],dy1,st[i+1],st[i+2],st[i+3],0);dy1=0;}st=[];break;}
        case 30:case 31:{let h=v===31,i=0;
          while(i+3<st.length){const last=st.length-i===5;
            if(h)curve(st[i],0,st[i+1],st[i+2],last?st[i+4]:0,st[i+3]);
            else curve(0,st[i],st[i+1],st[i+2],st[i+3],last?st[i+4]:0);
            i+=last?5:4;h=!h;}
          st=[];break;}
        case 10:{const n=st.pop()+lb,s=lsub[n];if(s)run(s[0],s[1]);break;}
        case 29:{const n=st.pop()+gb,s=F.gsubrs[n];if(s)run(s[0],s[1]);break;}
        case 11:depth--;return;
        case 14:width(st.length>=4?4:0);done=true;st=[];break;
        case 12:{const e=R.u8at(p++);const S=st;
          if(e===35){curve(S[0],S[1],S[2],S[3],S[4],S[5]);curve(S[6],S[7],S[8],S[9],S[10],S[11]);}
          else if(e===34){const y0=y;curve(S[0],0,S[1],S[2],S[3],0);curve(S[4],0,S[5],y0-y,S[6],0);}
          else if(e===36){const y0=y;curve(S[0],S[1],S[2],S[3],S[4],0);curve(S[5],0,S[6],S[7],S[8],y0-(y+S[7]));}
          else if(e===37){const x0=x,y0=y;const dx=S[0]+S[2]+S[4]+S[6]+S[8],dy=S[1]+S[3]+S[5]+S[7]+S[9];
            curve(S[0],S[1],S[2],S[3],S[4],S[5]);
            if(Math.abs(dx)>Math.abs(dy))curve(S[6],S[7],S[8],S[9],S[10],y0-(y+S[7]+S[9]));
            else curve(S[6],S[7],S[8],S[9],x0-(x+S[6]+S[8]),S[10]);}
          st=[];break;}
        default:st=[];
      }
    }
    depth--;
  };
  run(it[0],it[1]);close();
  return conts;
}
/* ----- police lue ----- */
function fontParse(buf,want){
  // want : nom PostScript (collection) ou rang de la police dans le fichier
  const u8=fontU8(buf),R=fontReader(u8),offs=fontFaceOffsets(u8);
  const faces=offs.map(o=>fontParseFace(R,o));
  if(typeof want==='number')return faces[want]||faces[0];
  if(want){const w=String(want).toLowerCase();const f=faces.find(x=>x.ps.toLowerCase()===w||x.full.toLowerCase()===w);if(f)return f;}
  return faces[0];
}
function fontParseAll(buf){const u8=fontU8(buf),R=fontReader(u8);return fontFaceOffsets(u8).map(o=>fontParseFace(R,o));}
function fontParseFace(R,base){
  const ver=R.tag(base);
  if(ver==='wOFF'||ver==='wOF2')throw new Error('police du web (WOFF) : choisissez le fichier .ttf ou .otf');
  const nt=R.u16(base+4),T={};
  for(let i=0;i<nt;i++){const r=base+12+16*i;T[R.tag(r)]={o:R.u32(r+8),l:R.u32(r+12)};}
  if(!T.head||!T.maxp||!T.hhea||!T.hmtx||!T.cmap)throw new Error('tables de police manquantes');
  const F={R,T,upm:R.u16(T.head.o+18)||1000,numGlyphs:R.u16(T.maxp.o+4)};
  Object.assign(F,T.name?fontNames(R,T.name.o,T.name.l):{family:'',style:'',full:'',ps:''});
  F.asc=R.i16(T.hhea.o+4);F.desc=R.i16(T.hhea.o+6);F.gap=R.i16(T.hhea.o+8);F.nhm=R.u16(T.hhea.o+34)||1;
  F.cap=0;
  if(T['OS/2']){const o=T['OS/2'].o,v=R.u16(o);if(v>=2&&T['OS/2'].l>=90)F.cap=R.i16(o+88);
    if(T['OS/2'].l>=74&&R.i16(o+68)){F.typoAsc=R.i16(o+68);F.typoDesc=R.i16(o+70);F.typoGap=R.i16(o+72);}}
  F.cmap=fontCmap(R,T.cmap.o);
  if(T.glyf&&T.loca){F.kind='tt';F.glyf=T.glyf.o;F.loca=T.loca.o;F.locFmt=R.i16(T.head.o+50);}
  else if(T['CFF ']){F.kind='cff';fontCffInit(F,T['CFF '].o);}
  else if(T.CFF2)throw new Error('police variable OpenType (CFF2) non lue');
  else throw new Error('police sans contours');
  // crénage simple (table « kern », format 0) : paires de glyphes
  F.kern=null;
  if(T.kern){try{const o=T.kern.o,n=R.u16(o+2);let p=o+4;const K=new Map();
    for(let t=0;t<n;t++){const len=R.u16(p+2),cov=R.u16(p+4);
      if((cov>>8)===0&&(cov&1)&&!(cov&4)){const np=R.u16(p+6);for(let i=0;i<np;i++){const q=p+14+6*i;K.set(R.u16(q)*65536+R.u16(q+2),R.i16(q+4));}}
      p+=len;}
    if(K.size)F.kern=K;}catch(e){F.kern=null;}}
  const cache=new Map();
  F.gid=cp=>F.cmap(cp)||0;
  F.adv=gid=>{const i=Math.min(gid,F.nhm-1);return R.u16(T.hmtx.o+4*i);};
  F.kernPair=(a,b)=>F.kern?(F.kern.get(a*65536+b)||0):0;
  F.glyph=gid=>{
    if(cache.has(gid))return cache.get(gid);
    let contours=[];
    try{
      if(F.kind==='tt')contours=fontGlyfPoints(F,gid).map(c=>fontTTContour(c.pts)).filter(Boolean);
      else contours=fontCffGlyph(F,gid).filter(c=>c.seg.length);
    }catch(e){contours=[];}
    const g={adv:F.adv(gid),contours};cache.set(gid,g);return g;
  };
  if(!F.cap){ // hauteur des majuscules mesurée sur « H »
    const g=F.glyph(F.gid(72));let m=0;g.contours.forEach(c=>{m=Math.max(m,c.s[1]);c.seg.forEach(s=>{m=Math.max(m,s.p[1]);});});
    F.cap=m||Math.round(F.asc*0.7)||F.upm*0.7;
  }
  return F;
}
