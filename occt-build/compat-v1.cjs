// Compatibilité « appels opencascade.js 1.1.1 » sur un noyau plus récent (OCCT ≥ 7.5).
// Deux écarts couvrent l'essentiel :
//  1. OCCT 7.5 a remplacé Handle(Message_ProgressIndicator) par un argument Message_ProgressRange,
//     ajouté EN DERNIER à beaucoup de constructeurs et méthodes (Build, booléens, maillage…).
//     embind exige le nombre exact d'arguments : on complète par un Message_ProgressRange neuf,
//     et on substitue un ancien Handle_Message_ProgressIndicator passé à cette place.
//  2. Des surcharges nouvelles décalent les suffixes (_1, _2…) : table ancien → nouveau, établie
//     par le nombre d'arguments de chaque surcharge dans les deux noyaux (sonde-surcharges.cjs).
//
//   Génération : node occt-build/compat-v1.cjs <nouveau.d.ts> <sonde-ancien.json> <sonde-nouveau.json> <table.json>
//   Usage      : require('occt-build/compat-v1.cjs').appliquer(oc, require(table.json))
'use strict';
const fs=require('fs');

// --- lecture du .d.ts : signatures (types des paramètres) par classe ---
function lireDts(txt){
  const cls={};let cur=null;
  for(const l of txt.split('\n')){
    const c=/^\s*export declare class (\w+)(?: extends (\w+))? \{/.exec(l);
    if(c){cur=cls[c[1]]={base:c[2]||null,ctor:null,m:{},s:{}};continue;}
    if(!cur)continue;
    if(/^\s*\}\s*$/.test(l)){cur=null;continue;}
    const m=/^\s+(static\s+)?(constructor|\w+)\((.*)\)\s*(?::.*|;)?\s*$/.exec(l);
    if(!m)continue;
    const types=m[3].trim()?m[3].split(/,\s*(?=\w+\??:)/).map(p=>p.split(':').slice(1).join(':').trim()):[];
    if(m[2]==='constructor')cur.ctor=types;
    else (m[1]?cur.s:cur.m)[m[2]]=types;
  }
  return cls;
}
const RANGE='Message_ProgressRange';

function generer(dtsFile,sondeA,sondeB){
  const D=lireDts(fs.readFileSync(dtsFile,'utf8'));
  const A=JSON.parse(fs.readFileSync(sondeA,'utf8')),B=JSON.parse(fs.readFileSync(sondeB,'utf8'));
  const table={range:{methodes:{},statiques:{},ctors:{}},alias:{ctors:{},statiques:{}},doutes:[]};
  // 1. tout ce qui finit par un Message_ProgressRange (méthodes, statiques, constructeurs suffixés)
  for(const [c,d] of Object.entries(D)){
    for(const [n,t] of Object.entries(d.m))if(t.length&&t[t.length-1]===RANGE)table.range.methodes[c+'.'+n]=t.length;
    for(const [n,t] of Object.entries(d.s))if(t.length&&t[t.length-1]===RANGE)table.range.statiques[c+'.'+n]=t.length;
    if(d.ctor&&d.ctor.length&&d.ctor[d.ctor.length-1]===RANGE)table.range.ctors[c]=d.ctor.length;
  }
  // 2. renumérotation des constructeurs et statiques suffixés connus de l'ancien noyau
  const grp=o=>{const g={};for(const [k,v] of Object.entries(o)){const m=/^(.*)_(\d+)$/.exec(k);if(m)(g[m[1]]=g[m[1]]||{})[+m[2]]=v;}return g;};
  const typesDe=(kind,g,j)=>{
    if(kind==='ctors'){const d=D[g+'_'+j];return d&&d.ctor;}
    const [c,n]=g.split('.');const d=D[c];return d&&d.s[n+'_'+j];
  };
  for(const kind of ['ctors','statics']){
    const GA=grp(A[kind]),GB=grp(B[kind]);
    for(const [g,ia] of Object.entries(GA)){
      const ib=GB[g];if(!ib)continue;
      for(const [iStr,ar] of Object.entries(ia)){
        const i=+iStr;if(typeof ar!=='number')continue;
        // candidats, par ordre de préférence : même nombre d'arguments sans Message_ProgressRange final ;
        // un de plus finissant par Message_ProgressRange (ajouté par OCCT 7.5) ; même nombre finissant
        // par Message_ProgressRange (l'ancien passait là un Handle_Message_ProgressIndicator).
        const fin=j=>{const t=typesDe(kind,g,j);return !!(t&&t.length&&t[t.length-1]===RANGE);};
        const ks=Object.keys(ib).map(Number).sort((x,y)=>x-y);
        const cand=[ks.filter(j=>ib[j]===ar&&!fin(j)),ks.filter(j=>ib[j]===ar+1&&fin(j)),ks.filter(j=>ib[j]===ar&&fin(j))]
          .find(l=>l.length)||[];
        const memesA=Object.keys(ia).map(Number).filter(k=>ia[k]===ar).sort((x,y)=>x-y);
        let j=null;
        if(cand.length===1)j=cand[0];
        else if(cand.length>1){
          // même rang parmi les surcharges de même taille (ordre de déclaration conservé)
          const r=memesA.indexOf(i);j=cand[Math.min(r,cand.length-1)];
          if(!(cand.length===memesA.length&&cand.includes(i)&&j===i))table.doutes.push(`${g}_${i} (${ar} arg.) → _${j} parmi ${cand}`);
        }
        if(j===null){table.doutes.push(`${g}_${i} (${ar} arg.) : aucune surcharge équivalente`);continue;}
        if(j!==i){
          if(kind==='ctors')table.alias.ctors[g+'_'+i]=g+'_'+j;
          else{const [c,n]=g.split('.');table.alias.statiques[c+'.'+n+'_'+i]=n+'_'+j;}
        }
      }
    }
  }
  // 3. paramètres ajoutés EN FIN depuis OCCT 7.4 (constructeurs et méthodes non suffixés appelés
  //    par l'app) : on complète par la valeur par défaut d'OCCT (faux, Message_ProgressRange neuf,
  //    1re valeur d'énumération). Un type inconnu à compléter est signalé, pas deviné.
  table.pad={ctors:{},methodes:{},statiques:{}};
  const OK=t=>t==='Standard_Boolean'||t==='boolean'||t===RANGE||/^[A-Z]\w*_\w+$/.test(t);
  const pads=[['ctorsNus','ctors',k=>D[k]&&D[k].ctor],
    ['methodesNues','methodes',k=>{const [c,n]=k.split('.');return D[c]&&D[c].m[n];}],
    ['statiquesNues','statiques',k=>{const [c,n]=k.split('.');return D[c]&&D[c].s[n];}]];
  for(const [src,dst,types] of pads)for(const [k,ar] of Object.entries(A[src]||{})){
    const bv=(B[src]||{})[k];
    if(typeof ar!=='number'||typeof bv!=='number'||bv<=ar)continue;
    const t=types(k);if(!t||t.length!==bv){table.doutes.push(`${k} : ${ar} → ${bv} arguments, types inconnus`);continue;}
    const extra=t.slice(ar);
    if(!extra.every(OK)){table.doutes.push(`${k} : ajoutés ${extra.join(', ')} — non complété`);continue;}
    table.pad[dst][k]={n:ar,extra};
    delete table.range.methodes[k];delete table.range.statiques[k];delete table.range.ctors[k];
  }
  return table;
}

// --- application au module chargé ---
function appliquer(oc,table){
  const R=()=>new oc.Message_ProgressRange_1();
  const estRange=x=>x instanceof oc.Message_ProgressRange;
  const complete=(f,n)=>function(...a){
    let pr=null;
    if(a.length===n-1)a.push(pr=R());
    else if(a.length===n&&!estRange(a[n-1]))a[n-1]=pr=R(); // ancien Handle_Message_ProgressIndicator
    try{return f.apply(this,a);}finally{if(pr)try{pr.delete();}catch(e){}}
  };
  // instantanés AVANT toute réaffectation (les renumérotations se croisent)
  const snapC={},snapS={};
  for(const [o,n] of Object.entries(table.alias.ctors))if(oc[n])snapC[o]=oc[n];
  for(const [o,n] of Object.entries(table.alias.statiques)){const [c]=o.split('.');if(oc[c]&&oc[c][n])snapS[o]=oc[c][n];}
  let nm=0,ns=0,nc=0;
  for(const [k,n] of Object.entries(table.range.methodes)){
    const [c,m]=k.split('.');const P=oc[c]&&oc[c].prototype;
    if(P&&Object.prototype.hasOwnProperty.call(P,m)&&typeof P[m]==='function'){P[m]=complete(P[m],n);nm++;}
  }
  const statWrap={};
  for(const [k,n] of Object.entries(table.range.statiques)){
    const [c,m]=k.split('.');if(oc[c]&&typeof oc[c][m]==='function'){statWrap[k]=complete(oc[c][m],n);ns++;}
  }
  for(const [k,f] of Object.entries(statWrap)){const [c,m]=k.split('.');oc[c][m]=f;}
  const ctorWrap=(C,n)=>{
    const W=function(...a){
      let pr=null;
      if(a.length===n-1)a.push(pr=R());
      else if(a.length===n&&!estRange(a[n-1]))a[n-1]=pr=R();
      return new C(...a); // le Message_ProgressRange ne sert que pendant la construction
    };
    W.prototype=C.prototype;return W;
  };
  const ctorsOrig={};for(const c of Object.keys(table.range.ctors))if(oc[c])ctorsOrig[c]=oc[c];
  for(const [c,C] of Object.entries(ctorsOrig)){oc[c]=ctorWrap(C,table.range.ctors[c]);nc++;}
  for(const [o,n] of Object.entries(table.alias.ctors))if(snapC[o]){
    const C=ctorsOrig[n]?oc[n]:snapC[o];oc[o]=C;
  }
  for(const [o,n] of Object.entries(table.alias.statiques)){
    const [c]=o.split('.');if(!snapS[o])continue;
    oc[c][o.split('.')[1]]=statWrap[c+'.'+n]||snapS[o];
  }
  // paramètres ajoutés en fin (table.pad)
  const defaut=t=>{
    if(t==='Standard_Boolean'||t==='boolean')return {v:false};
    if(t===RANGE)return {v:R(),tmp:true};
    const E=oc[t];
    if(E&&typeof E==='object'){const z=Object.values(E).find(x=>x&&x.value===0);if(z)return {v:z};}
    return {v:0};
  };
  const pad=(f,{n,extra},ctor)=>function(...a){
    const tmp=[];
    if(a.length===n)for(const t of extra){const d=defaut(t);a.push(d.v);if(d.tmp&&!ctor)tmp.push(d.v);}
    try{return ctor?new f(...a):f.apply(this,a);}finally{tmp.forEach(x=>{try{x.delete();}catch(e){}});}
  };
  let np=0;
  for(const [k,p] of Object.entries((table.pad||{}).methodes||{})){
    const [c,m]=k.split('.');const P=oc[c]&&oc[c].prototype;
    if(P&&Object.prototype.hasOwnProperty.call(P,m)){P[m]=pad(P[m],p,false);np++;}
  }
  for(const [k,p] of Object.entries((table.pad||{}).statiques||{})){
    const [c,m]=k.split('.');if(oc[c]&&typeof oc[c][m]==='function'){oc[c][m]=pad(oc[c][m],p,false);np++;}
  }
  for(const [c,p] of Object.entries((table.pad||{}).ctors||{}))if(oc[c]){
    const C=oc[c],W=pad(C,p,true);W.prototype=C.prototype;
    for(const s of Object.getOwnPropertyNames(C))if(!(s in W))try{W[s]=C[s];}catch(e){}
    oc[c]=W;np++;
  }
  oc.__compatV1={complements:np,methodes:nm,statiques:ns,ctors:nc,alias:Object.keys(table.alias.ctors).length+Object.keys(table.alias.statiques).length};
  return oc;
}

module.exports={generer,appliquer,lireDts};
if(require.main===module){
  const [,,dts,a,b,out]=process.argv;
  const t=generer(dts,a,b);
  fs.writeFileSync(out,JSON.stringify(t,null,1));
  console.log(out,':',Object.keys(t.range.methodes).length,'méthodes,',Object.keys(t.range.statiques).length,'statiques,',
    Object.keys(t.range.ctors).length,'constructeurs à progression ;',Object.keys(t.alias.ctors).length+Object.keys(t.alias.statiques).length,'renumérotations ;',t.doutes.length,'doutes');
  t.doutes.forEach(d=>console.log('  ? '+d));
  console.log('  alias :',JSON.stringify(t.alias));
}
