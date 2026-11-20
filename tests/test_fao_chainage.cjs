// V0.99.47 — faoChainSegs (raccord des morceaux de contour, src/88-fao-94-selection.js) :
// la recherche par cases doit rendre EXACTEMENT les chaînes de l'ancien chaînage glouton
// (segment libre de plus petit indice, même ordre des 4 tests), dont dépendent les parcours.
// Référence : l'ancien code, recopié ici tel quel. Puis un gros contour mélangé : rapide.
'use strict';
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','src','88-fao-94-selection.js'),'utf8');
const m=src.match(/function faoChainSegs\(segs,tol\)\{[\s\S]*?\r?\n\}\r?\n/);
if(!m){console.log('ECHEC : faoChainSegs introuvable');process.exit(1);}
const nouveau=new Function(m[0]+';return faoChainSegs;')();
function ancien(segs,tol){
  const t2=(tol||1e-4), chains=[];
  const used=new Array(segs.length).fill(false);
  const key=function(p){return p.p;};
  const deq=function(a,b){ const dx=a[0]-b[0],dy=a[1]-b[1],dz=a[2]-b[2];
    return dx*dx+dy*dy+dz*dz<t2*t2; };
  for(let s=0;s<segs.length;s++){
    if(used[s])continue;
    used[s]=true;
    const chain=[segs[s][0],segs[s][1]];
    let grew=true, guard=0;
    while(grew&&guard++<100000){
      grew=false;
      for(let k=0;k<segs.length;k++){
        if(used[k])continue;
        const A=segs[k][0], B=segs[k][1];
        if(deq(key(chain[chain.length-1]),key(A))){chain.push(B);used[k]=true;grew=true;break;}
        if(deq(key(chain[chain.length-1]),key(B))){chain.push(A);used[k]=true;grew=true;break;}
        if(deq(key(chain[0]),key(B))){chain.unshift(A);used[k]=true;grew=true;break;}
        if(deq(key(chain[0]),key(A))){chain.unshift(B);used[k]=true;grew=true;break;}
      }
    }
    chains.push(chain);
  }
  return chains;
}
let echecs=0;const A=(ok,msg)=>{console.log((ok?'  ✓  ':'  ✗  ')+msg);if(!ok)echecs++;};
let rnd=7;const R=()=>{rnd=(rnd*16807)%2147483647;return rnd/2147483647;};
const sig=(segs,ch)=>JSON.stringify(ch.map(c=>c.map(q=>{for(let i=0;i<segs.length;i++){if(segs[i][0]===q)return i+'a';if(segs[i][1]===q)return i+'b';}return '?';})));
let ecarts=0,premier=-1;
for(let cas=0;cas<3000;cas++){
  const n=1+Math.floor(R()*60),grid=[0.5,1,3][cas%3],tol=[1e-4,1e-3,0.2][cas%3===2?2:cas%2];
  // points sur une grille grossière (beaucoup de coïncidences, nœuds de degré 4), bruit < tol,
  // quelques z différents, quelques coordonnées non finies
  const P=()=>{const q=[Math.round(R()*4)*grid+(R()<0.3?(R()-0.5)*tol*1.9:0),Math.round(R()*4)*grid,cas%5===0?Math.round(R()*2):0];
    if(R()<0.01)q[R()<0.5?0:1]=R()<0.5?NaN:Infinity;return {p:q};};
  const segs=[];for(let i=0;i<n;i++)segs.push([P(),P()]);
  if(sig(segs,ancien(segs,tol))!==sig(segs,nouveau(segs,tol))){ecarts++;if(premier<0)premier=cas;}
}
A(ecarts===0,'3 000 cas mélangés : mêmes chaînes que l\'ancien chaînage ('+ecarts+' écarts'+(premier>=0?', 1er cas '+premier:'')+')');
// longueurs attachées
{const segs=[[{p:[0,0,0]},{p:[3,4,0]}],[{p:[3,4,0]},{p:[3,8,0]}]];const c=nouveau(segs,1e-4);
 A(c.length===1&&Math.abs(c.lens[0]-9)<1e-12,'longueur d\'arc de la chaîne ('+c.lens+')');}
// gros contour mélangé : 20 000 morceaux d'un cercle
const big=[];for(let i=0;i<20000;i++){const t0=i/20000*2*Math.PI,t1=(i+1)/20000*2*Math.PI;
  big.push([{p:[Math.cos(t0)*50,Math.sin(t0)*50,0]},{p:[Math.cos(t1)*50,Math.sin(t1)*50,0]}]);}
for(let i=big.length-1;i>0;i--){const j=Math.floor(R()*(i+1));const t=big[i];big[i]=big[j];big[j]=t;}
const t=Date.now();const c=nouveau(big,1e-4);const ms=Date.now()-t;
A(c.length===1&&c[0].length===20001,'cercle de 20 000 morceaux mélangés : une seule chaîne fermée ('+c.length+' chaîne(s))');
A(ms<1500,'raccord en '+ms+' ms (ancien : ~2 s ; quadratique)');
console.log(echecs?echecs+' ECHEC(S)':'TOUT PASSE');
process.exit(echecs?1:0);
