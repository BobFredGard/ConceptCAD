// tools/docs-version.cjs — garde les documents alignés sur la version (V0.47.2).
// Une seule source : APP_VER (src/00-entete-et-outils.js). Appelé par build.js :
//   node build.js          réécrit package.json, README.md, docs/manuel/developpement.md et l'en-tête du CHANGELOG
//   node build.js --check  échoue si l'un d'eux est en retard → npm run ci et ci:full bloquent
// Un passage introuvable (phrase du README reformulée…) est une ERREUR, jamais un oubli silencieux.
// Les versions citées comme historique (« renommé en V0.33.0 ») ne sont pas touchées.
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const MANUEL_DEV='docs/manuel/developpement.md'; // les chiffres du dépôt ont quitté le README pour le manuel
const lire=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

function nbSuites(f){
  const m=/const SUITES\s*=\s*\[([\s\S]*?)\];/.exec(lire(f));
  if(!m)throw new Error('liste SUITES introuvable dans '+f);
  return (m[1].match(/["']test_[^"']*["']/g)||[]).length;
}
// Titres de versions : « ## V0.x.y », « ## 2026-10-16-016 · V0.1.55 », anciens « ### `2026-09-28b` »
function nbVersions(t){return (t.match(/^#{2,3} `?(V\d|20\d\d-)/gm)||[]).length;}
function appVer(){
  const m=/const APP_VER='(V[\d.]+)'/.exec(lire('src/00-entete-et-outils.js'));
  if(!m)throw new Error('APP_VER introuvable dans src/00-entete-et-outils.js');
  return m[1];
}
// [fichier, motif, remplacement] : le motif doit exister, chaque règle garde le reste du texte intact
function regles(){
  const v=appVer();
  const nSrc=fs.readdirSync(path.join(ROOT,'src')).filter(f=>/^\d\d-.*\.js$/.test(f)).length;
  const nVers=nbVersions(lire('CHANGELOG.md'));
  return [
    ['package.json',/("version":\s*")[^"]*(")/,'$1'+v.slice(1)+'$2','version de package.json'],
    ['README.md',/(Version actuelle : \*\*)V[\d.]+(\*\*)/,'$1'+v+'$2','« Version actuelle » du README'],
    [MANUEL_DEV,/(\*\*Les sources\*\* : )\d+( fichiers)/,'$1'+nSrc+'$2','nombre de fichiers sources du manuel'],
    [MANUEL_DEV,/\d+( suites Node lancées en parallèle)/,nbSuites('tests/run.cjs')+'$1','nombre de suites du manuel'],
    [MANUEL_DEV,/\d+( rapides \(`npm run ci`\))/,nbSuites('tests/run-fast.cjs')+'$1','nombre de suites rapides du manuel'],
    ['CHANGELOG.md',/\*\*\d+ versions\*\*/,'**'+nVers+' versions**','nombre de versions du CHANGELOG'],
    ['CHANGELOG.md',/(, de `[^`]+` à `)V[\d.]+(`)/,'$1'+v+'$2','dernière version du CHANGELOG'],
  ];
}
// Retourne {retards:[…], erreurs:[…]} ; ecrire=true met les fichiers à jour.
function synchroniser(ecrire){
  const retards=[],erreurs=[],textes={};
  let v=null;
  try{
    v=appVer();
    regles().forEach(([f,re,rep,nom])=>{
      const t=textes[f]!=null?textes[f]:lire(f);
      if(!re.test(t)){erreurs.push(nom+' : passage introuvable dans '+f);textes[f]=t;return;}
      const n=t.replace(re,rep);
      if(n!==t)retards.push(nom);
      textes[f]=n;
    });
    const titre=new RegExp('^## '+v.replace(/\./g,'\\.')+' - ','m');
    if(!titre.test(textes['CHANGELOG.md']))erreurs.push('aucune entrée « ## '+v+' - … » dans CHANGELOG.md');
  }catch(e){erreurs.push(e.message);}
  if(ecrire&&!erreurs.length)Object.keys(textes).forEach(f=>{if(textes[f]!==lire(f))fs.writeFileSync(path.join(ROOT,f),textes[f],'utf8');});
  return {version:v,retards,erreurs};
}
module.exports={synchroniser,appVer,nbVersions};
