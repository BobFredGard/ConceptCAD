// V0.99.48 — séquence du posage dans un worker (src/88-fao-58-multicoeur.js) : les parcours
// partent et reviennent en colonnes (faoWkMvPaq / faoWkMvDepaq). L'aller-retour doit rendre
// exactement les mêmes points (valeurs, champ r, ordre des clés, points d'une autre forme,
// trous du tableau, champs posés sur le tableau) — sinon les parcours changeraient.
'use strict';
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','src','88-fao-58-multicoeur.js'),'utf8');
const prendre=n=>{const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' introuvable');const j=src.indexOf('\n}',i);return src.slice(i,j+2)+'\n';};
const F=new Function(prendre('faoWkMvSimple')+prendre('faoWkMvPaq')+prendre('faoWkMvDepaq')+';return {paq:faoWkMvPaq,depaq:faoWkMvDepaq};')();
let echecs=0;const A=(ok,msg)=>{console.log((ok?'  ✓  ':'  ✗  ')+msg);if(!ok)echecs++;};
const pareil=(a,b)=>{
  if(a.length!==b.length)return 'longueur';
  for(let i=0;i<a.length;i++){
    if((i in a)!==(i in b))return 'trou '+i;
    if(JSON.stringify(a[i])!==JSON.stringify(b[i]))return 'indice '+i;
    if(a[i]&&typeof a[i]==='object')for(const k in a[i])if(typeof a[i][k]!=='object'&&!Object.is(a[i][k],b[i][k]))return 'indice '+i+' '+k;
  }
  const ca=Object.keys(a).filter(k=>!/^\d+$/.test(k)),cb=Object.keys(b).filter(k=>!/^\d+$/.test(k));
  if(JSON.stringify(ca)!==JSON.stringify(cb))return 'champs';
  for(const k of ca)if(JSON.stringify(a[k])!==JSON.stringify(b[k]))return 'champ '+k;
  return null;
};
let rnd=11;const R=()=>{rnd=(rnd*16807)%2147483647;return rnd/2147483647;};
const mv=[];
for(let i=0;i<20000;i++){
  const x=(R()-0.5)*1e3,y=Math.PI*R()*1e-7,z=-0;
  const k=i%9;
  if(k<4)mv.push({x,y,z});
  else if(k===4)mv.push({r:1,x,y,z});
  else if(k===5)mv.push({r:0,x,y,z});
  else if(k===6)mv.push({r:true,x,y,z});
  else if(k===7)mv.push({r:false,x,y,z});
  else mv.push([{x,y,z,f:120},{z,x,y},{r:2,x,y,z},{r:1,x,y,z,arc:{cx:1}},{x:'1',y,z},null,'G4 P1'][i%7]);
}
mv[50]=undefined; delete mv[51];
mv.tail=[{x:1,y:2,z:3}]; mv.xf=7;
const tr=[];
const p=F.paq(mv,tr);
A(tr.length===4,'colonnes transférables ('+tr.length+')');
A(p.autres.length>0&&p.autres.length<mv.length/5,'points d\'une autre forme gardés tels quels ('+p.autres.length+')');
// passage par la copie structurée, comme entre le worker et la page
const q=F.depaq(structuredClone(p));
const d=pareil(mv,q);
A(!d,'aller-retour identique : '+mv.length+' points'+(d?' — '+d:''));
A(Object.is(q[0].z,-0),'zéro négatif conservé');
const vide=F.depaq(structuredClone(F.paq([],null)));
A(Array.isArray(vide)&&vide.length===0,'parcours vide');
console.log(echecs?'\nECHEC '+echecs:'\nOK');
process.exit(echecs?1:0);
