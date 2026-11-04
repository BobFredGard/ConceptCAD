// V0.48.0 : fiches illustrées au survol. Chaque icône du ruban, de la barre rapide et du bandeau
// d'esquisse doit avoir sa fiche complète ; une icône ajoutée sans fiche fait échouer ce test.
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  x '+m);}else console.log('  ✓ '+m);};
const src=fs.readFileSync(path.join(ROOT,'src','97-interface-moderne.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'ConceptCAD.html'),'utf8');
const {ctx,sandbox}=loadApp();
const LS={};sandbox.localStorage.getItem=k=>(k in LS?LS[k]:null);sandbox.localStorage.setItem=(k,v)=>{LS[k]=String(v);};
const T=vm.runInContext(`(function(){mfFiFiche('q/undo');return mfFiTab;})()`,ctx);
const plain=l=>l.replace(/<span class="mfLabA">.*?<\/span>/,'').replace(/<[^>]+>/g,'');
const keys=[];
// groupes CAO
const cao=src.slice(src.indexOf('const MF_CAO='),src.indexOf('const MF_FAO_ICON'));
for(const part of cao.split(/\n\s*(?=\['[^']+',\[\[)/)){
  const t=part.match(/\['([^']+)',\[\[/);if(!t)continue;
  for(const m of part.matchAll(/\['\w+','([^']+)',/g))keys.push(t[1]+'/'+m[1]);
}
// groupes grp('Titre',[...]) de mfRibbon
const rib=src.slice(src.indexOf('function mfRibbon'),src.indexOf('let mfWsCur'));
const parts=rib.split(/(?=grp\(')/).slice(1);
for(const part of parts){
  const t=part.match(/^grp\('([^']+)'/)[1];
  if(t==='Opérations')continue;
  for(const m of part.matchAll(/\['\w+','((?:<span.*?<\/span>)+|[^']+)',(?:\(\)|'|mep)/g))keys.push(t+'/'+plain(m[1]));
}
for(const a of vm.runInContext('faoAddOpsSpec()',ctx))keys.push('Opérations/'+String(a[1]).replace(/^\+ /,''));
A(keys.length>=75,'ruban : '+keys.length+' icônes recensées');
// barre rapide
for(const q of ['undo','redo','new','open','recent','save','saveas','folder'])keys.push('q/'+q);
// bandeau d'esquisse : boutons du livrable + outils ajoutés par le code
for(const m of html.matchAll(/<button class="(?:tool|con)[^"]*" data-(?:tool|con)="(\w+)"/g))keys.push('sk/'+m[1]);
for(const k of ['spline','cspline','isect','offset','chamfer','fillet','skFit','skOrbit','skGrid','skRefs','skParams'])keys.push('sk/'+k);
const manque=[...new Set(keys)].filter(k=>!T[k]);
A(!manque.length,'toutes les icônes ont une fiche'+(manque.length?' — manquent : '+manque.join(', '):''));
const vides=Object.keys(T).filter(k=>{const f=T[k];return !f.t||!f.d||!f.a||!f.b||!f.la||!f.lb;});
A(!vides.length,Object.keys(T).length+' fiches complètes : titre, phrase, deux images, deux légendes'+(vides.length?' — incomplètes : '+vides.join(', '):''));
const bad=Object.keys(T).filter(k=>[T[k].a,T[k].b].some(s=>/undefined|NaN/.test(s)));
A(!bad.length,'aucune image avec une valeur manquante'+(bad.length?' : '+bad.join(', '):''));
const r=vm.runInContext(`(function(){const o=[mfFiOn];mfFiSet(false);o.push(mfFiOn,mfLS('minifusion_fiches'));mfFiSet(true);o.push(mfFiOn,mfLS('minifusion_fiches'));
  o.push(mfFiKey({dataset:{tool:'line'}}),mfFiKey({dataset:{con:'h'}}),mfFiKey({dataset:{fi:'Créer/Extrusion'}}));return o;})()`,ctx);
A(r[0]===true,'option active par défaut');
A(r[1]===false&&r[2]==='off'&&r[3]===true&&r[4]==='on','option désactivable et mémorisée');
A(r[5]==='sk/line'&&r[6]==='sk/h'&&r[7]==='Créer/Extrusion','clé de fiche retrouvée depuis le bouton');
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');process.exit(ko?1:0);
