// Compatibilité « appels opencascade.js 1.1.1 » sur libcascade 3.x (OCCT 8, noyau v3).
// L'API v3 diffère de l'actuel sur quatre points ; on les comble au chargement, sans toucher à src/ :
//  1. Plus de suffixes : `new oc.gp_Pnt_3(…)`, `x.IsValid_1()`, `oc.TopoDS.Face_1(s)` → le nom nu ;
//     v3 choisit la surcharge selon le nombre ET le type des arguments. Les noms suffixés manquants
//     sont fournis à la demande (prototypes « de repli » : seul un nom absent passe par eux).
//  2. Arguments ajoutés depuis OCCT 7.4 (booléens, Message_ProgressRange, énumérations…) : complétés
//     par la valeur par défaut d'OCCT ; arguments retirés (ancien Handle_Message_ProgressIndicator) : ôtés.
//     Les signatures viennent du .d.ts de v3 (table générée, compat-v3.json).
//  3. Poignées (Handle) : v3 les rend transparentes. `new oc.Handle_X_2(o)` rend o, `h.get()` rend
//     l'objet lui-même, une poignée nulle (rendue `null` par v3) devient NULLH (IsNull() vrai).
//  4. Sorties numériques en « enveloppe » ({returnValue, First, Last…}) : on rend returnValue,
//     comme l'ancien noyau (qui ne savait pas rendre ces sorties).
//
//   Génération : node occt-build/compat-v3.cjs <v3.d.ts> <sonde-ancien.json> <compat-v3.json>
//   Usage      : require('occt-build/compat-v3.cjs').appliquer(oc, require(compat-v3.json))
'use strict';
const fs=require('fs');

// --- .d.ts de libcascade : surcharges [total, requis, types…] par classe ---
function lireDts(txt){
  const cls={};let cur=null;
  for(const l of txt.split('\n')){
    const c=/^declare class (\w+)(?: extends (\w+))? \{/.exec(l);
    if(c){cur=cls[c[1]]={base:c[2]||null,ctor:[],m:{},s:{}};continue;}
    if(!cur)continue;
    if(/^\}\s*$/.test(l)){cur=null;continue;}
    const m=/^ {2}(static )?(constructor|\w+)\((.*?)\)(?:: (.*))?;\s*$/.exec(l);
    if(!m)continue;
    const ps=m[3].trim()?m[3].split(/,\s*(?=\w+\??:)/):[];
    const types=ps.map(p=>p.slice(p.indexOf(':')+1).trim());
    const req=ps.filter(p=>!/^\w+\?:/.test(p)).length;
    const o=[ps.length,req,...types];
    if(m[2]==='constructor')cur.ctor.push(o);
    else{const t=m[1]?cur.s:cur.m;(t[m[2]]=t[m[2]]||[]).push(o);}
  }
  return cls;
}

// typedefs d'OCCT que libcascade expose sous le nom du gabarit (NCollection_…)
const ALIAS={
  TColgp_Array1OfPnt:'NCollection_Array1_gp_Pnt',
  TColStd_Array1OfReal:'NCollection_Array1_double',
  TColStd_Array1OfInteger:'NCollection_Array1_int',
  TopTools_ListOfShape:'NCollection_List_TopoDS_Shape',
};

function generer(dtsFile,sondeFile){
  const D=lireDts(fs.readFileSync(dtsFile,'utf8'));
  for(const [a,c] of Object.entries(ALIAS))if(!D[a]&&D[c])D[a]=D[c];
  const A=JSON.parse(fs.readFileSync(sondeFile,'utf8'));
  const nu=k=>k.replace(/_\d+$/,'');
  // la classe qui déclare M (la plus dérivée) : en C++ comme dans embind, elle masque les surcharges des bases
  const chercher=(c,M,stat)=>{for(let k=c,g=0;k&&D[k]&&g<40;k=D[k].base,g++){const t=stat?D[k].s:D[k].m;if(t[M])return t[M];}return null;};
  const table={ctors:{},statics:{},methods:{},manque:[],sansEquivalent:[]};
  const ok=(ovl,n)=>ovl.some(o=>o[1]<=n&&n<=o[0]);
  // suffixés : toujours enveloppés (repli), on garde leurs signatures
  for(const k of Object.keys(A.ctors||{})){const c=nu(k);if(/^Handle_/.test(c))continue;if(D[c]&&D[c].ctor.length){table.ctors[c]=D[c].ctor;
    // surcharge de l'ancien noyau qu'aucun constructeur v3 ne peut recevoir (même complété) : absente
    const ar=A.ctors[k];if(typeof ar==='number'&&!D[c].ctor.some(o=>o[0]>=ar))table.sansEquivalent.push(k);}else if(!D[c]&&!table.manque.includes('classe '+c))table.manque.push('classe '+c);}
  for(const [kind,stat] of [['statics',true],['methods',false]])for(const k of Object.keys(A[kind]||{})){
    const [c,mN]=k.split('.'),M=nu(mN);if(!D[c])continue;
    const o=chercher(c,M,stat);if(o)table[kind][c+'.'+M]=o;else table.manque.push(k);
  }
  // non suffixés appelés par l'ancien code : enveloppés seulement si le nombre d'arguments ne colle plus
  table.envelopper={ctors:[],statics:[],methods:[]};
  for(const [k,ar] of Object.entries(A.ctorsNus||{})){if(typeof ar!=='number'||!D[k])continue;
    if(!ok(D[k].ctor,ar)){table.ctors[k]=D[k].ctor;table.envelopper.ctors.push(k);}}
  for(const [src,kind,stat] of [['statiquesNues','statics',true],['methodesNues','methods',false]])
    for(const [k,ar] of Object.entries(A[src]||{})){
      if(typeof ar!=='number')continue;const [c,M]=k.split('.');if(!D[c])continue;
      const o=chercher(c,M,stat);if(!o||ok(o,ar))continue;
      table[kind][k]=o;table.envelopper[kind].push(k);
    }
  return table;
}

// ---------------------------------------------------------------------------------------------
function appliquer(oc,table){
  if(oc.__compatV3)return oc;
  const NULLH=Object.freeze({IsNull:()=>true,get:()=>null,delete(){},Nullify(){},__nullh:true});
  // chaîne des noms de classes d'un objet v3 (pour reconnaître le bon type d'argument)
  const typesDe=o=>{const s=new Set();for(let p=Object.getPrototypeOf(o),g=0;p&&p!==Object.prototype&&g<40;p=Object.getPrototypeOf(p),g++)if(p.constructor&&p.constructor.name)s.add(p.constructor.name);return s;};
  const accepte=(t,a)=>{
    if(a===undefined)return true;
    if(typeof a==='number')return /^number\b/.test(t);
    if(typeof a==='boolean')return t==='boolean';
    if(typeof a==='string')return t==='string'||(oc[t]&&typeof oc[t]==='object');
    if(a&&typeof a==='object')return typesDe(a).has(t)||t==='any'||/^emscripten/.test(t);
    return true;
  };
  const defaut=t=>{
    if(/^number\b/.test(t))return 0;
    if(t==='boolean')return false;
    if(t==='Message_ProgressRange')return new oc.Message_ProgressRange();
    if(oc[t]&&typeof oc[t]==='object'){const v=Object.values(oc[t]).filter(x=>typeof x==='string');if(v.length)return v[0];}
    return undefined;
  };
  // arguments : poignées → objets, NULLH → undefined, puis ajustés à une surcharge de v3
  const ajuster=(args,ovl)=>{
    let a=args.map(x=>x===NULLH||(x&&x.__nullh)?undefined:x);
    while(a.length&&a[a.length-1]===undefined)a.pop();
    if(!ovl||!ovl.length)return a;
    const n=a.length;
    if(ovl.some(o=>o[1]<=n&&n<=o[0]&&a.every((x,i)=>accepte(o[2+i],x))))return a;
    const max=Math.max(...ovl.map(o=>o[0]));
    if(n>max)return a.slice(0,max);
    const cand=ovl.filter(o=>o[0]>n&&a.every((x,i)=>accepte(o[2+i],x))).sort((x,y)=>x[1]-y[1]||x[0]-y[0]);
    if(!cand.length)return a;
    const o=cand[0];
    for(let i=n;i<o[1];i++)a.push(defaut(o[2+i]));
    return a;
  };
  const sortie=r=>{
    if(r===null)return NULLH;
    if(r&&typeof r==='object'&&Object.getPrototypeOf(r)===Object.prototype){
      if('returnValue' in r)return sortie(r.returnValue);
      return undefined; // void C++ avec sorties : l'ancien noyau ne rendait rien
    }
    return r;
  };
  const T=table||{ctors:{},statics:{},methods:{}};
  for(const [a,c] of Object.entries(ALIAS))if(oc[a]===undefined&&oc[c]!==undefined)oc[a]=oc[c];
  const fabCtor=(C,ovl)=>{const W=function(...a){return new C(...ajuster(a,ovl));};W.prototype=C.prototype;Object.setPrototypeOf(W,C);return W;};
  const fabStat=(C,M,ovl)=>function(...a){return sortie(C[M](...ajuster(a,ovl)));};
  // 1. module : noms absents (X_N, Handle_X_N)
  const repliModule=new Proxy(Object.create(Object.getPrototypeOf(oc)),{get(t,k,recv){
    if(typeof k!=='string')return Reflect.get(t,k,recv);
    let m=/^Handle_(\w+?)(?:_(\d+))?$/.exec(k);
    // Handle_Message_ProgressIndicator : OCCT 7.5+ attend à sa place un Message_ProgressRange
    if(m&&m[1]==='Message_ProgressIndicator'){const W=function(){return new oc.Message_ProgressRange();};oc[k]=W;return W;}
    if(m){const W=function(o){return o===undefined||o===null?NULLH:o;};oc[k]=W;return W;}
    m=/^(\w+?)_(\d+)$/.exec(k);
    if(m&&(T.sansEquivalent||[]).includes(k))return undefined; // l'app teste sa présence (ex. BRepOffsetAPI_MakeThickSolid_2)
    if(m&&oc[m[1]]!==undefined&&typeof oc[m[1]]==='function'){const W=fabCtor(oc[m[1]],T.ctors[m[1]]);oc[k]=W;return W;}
    return Reflect.get(t,k,recv);
  }});
  Object.setPrototypeOf(oc,repliModule);
  // 2. statiques : M_N absent sur la classe → M ; 3. méthodes : repli à la racine des prototypes
  let racine=null;
  for(const [k,C] of Object.entries(oc)){
    if(typeof C!=='function'||!C.prototype||!/^[A-Z]/.test(k))continue;
    if(!racine){let p=C.prototype;while(Object.getPrototypeOf(p)&&Object.getPrototypeOf(p)!==Object.prototype)p=Object.getPrototypeOf(p);racine=p;}
    const base=Object.getPrototypeOf(C);
    Object.setPrototypeOf(C,new Proxy(base,{get(t,key,recv){
      if(typeof key==='string'){const m=/^([A-Z]\w*?)_(\d+)$/.exec(key);
        if(m&&typeof C[m[1]]==='function'){const W=fabStat(C,m[1],T.statics[k+'.'+m[1]]);try{Object.defineProperty(C,key,{value:W,configurable:true,writable:true});}catch(e){}return W;}}
      return Reflect.get(t,key,recv);
    }}));
  }
  if(racine){
    const ovlMeth=(obj,M)=>{for(const c of typesDe(obj)){const o=T.methods[c+'.'+M];if(o)return o;}return null;};
    Object.setPrototypeOf(racine,new Proxy(Object.getPrototypeOf(racine),{get(t,key,recv){
      if(typeof key==='string'){
        if(key==='get')return function(){return this;};
        if(key==='IsNull')return function(){return false;};
        const m=/^([A-Z]\w*?)_(\d+)$/.exec(key);
        if(m)return function(...a){const f=this[m[1]];if(typeof f!=='function')throw new TypeError(key+' : méthode absente du noyau v3');return sortie(f.apply(this,ajuster(a,ovlMeth(this,m[1]))));};
      }
      return Reflect.get(t,key,recv);
    }}));
  }
  // 4. noms nus dont le nombre d'arguments a changé : enveloppés sur place. Le répartiteur de
  //    surcharges d'embind relit sa table (overloadTable) sur la fonction EN PLACE : on la recopie.
  const E=T.envelopper||{};
  for(const c of E.ctors||[])if(typeof oc[c]==='function')oc[c]=fabCtor(oc[c],T.ctors[c]);
  for(const k of E.statics||[]){const [c,M]=k.split('.');const C=oc[c];if(C&&typeof C[M]==='function'){const f=C[M],ovl=T.statics[k];C[M]=Object.assign(function(...a){return sortie(f.apply(C,ajuster(a,ovl)));},f);}}
  for(const k of E.methods||[]){const [c,M]=k.split('.');const C=oc[c];if(!C||!C.prototype)continue;const f=C.prototype[M];if(typeof f!=='function')continue;
    const ovl=T.methods[k];C.prototype[M]=Object.assign(function(...a){return sortie(f.apply(this,ajuster(a,ovl)));},f);}
  // 5. erreurs : v3 lance des exceptions WebAssembly natives, sans texte (« [object WebAssembly.Exception] »
  //    dans les messages de l'app) ; on leur donne le type et le texte d'OCCT, lus comme e.message / String(e).
  const WE=typeof WebAssembly!=='undefined'&&WebAssembly.Exception;
  if(WE&&typeof oc.getExceptionMessage==='function'){
    const lire=e=>{try{const r=oc.getExceptionMessage(e);return 'OCCT '+(Array.isArray(r)?r:[r]).filter(Boolean).join(' : ');}catch(x){return 'exception OCCT';}};
    Object.defineProperty(WE.prototype,'message',{get(){return lire(this);},configurable:true});
    Object.defineProperty(WE.prototype,'toString',{value(){return this.message;},configurable:true,writable:true});
  }
  oc.__compatV3={NULLH};
  return oc;
}

module.exports={generer,appliquer,lireDts};

if(require.main===module){
  const [,,dts,sonde,out]=process.argv;
  if(!out){console.error('usage : node occt-build/compat-v3.cjs <v3.d.ts> <sonde-ancien.json> <compat-v3.json>');process.exit(2);}
  const t=generer(dts,sonde);
  fs.writeFileSync(out,JSON.stringify(t));
  const n=o=>Object.keys(o).length;
  console.log(`${out} : ${n(t.ctors)} constructeurs, ${n(t.statics)} statiques, ${n(t.methods)} méthodes ; `+
    `enveloppés sur place : ${t.envelopper.ctors.length}/${t.envelopper.statics.length}/${t.envelopper.methods.length}`);
  if(t.manque.length)console.log('  absents de v3 ('+t.manque.length+') : '+t.manque.slice(0,40).join(', ')+(t.manque.length>40?' …':''));
}
