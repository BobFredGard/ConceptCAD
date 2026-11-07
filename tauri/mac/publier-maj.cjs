// Prépare le Mac pour une publication, à lancer sous Windows après construire-windows.cjs et une fois
// le passage GitHub de ce commit réussi. Dans target/release/bundle/publication :
//   ConceptCAD-Mac.dmg : à télécharger par les nouveaux utilisateurs
//   ConceptCAD-Mac-maj.tar.gz : la mise à jour, signée ici : la clé secrète ne va jamais sur GitHub
//   latest.json : complété pour le Mac, s'il existe
//   node tauri/mac/publier-maj.cjs
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {execFileSync,spawnSync}=require('child_process');
const CLE=path.join(os.homedir(),'.tauri','conceptcad-maj.key');
const RACINE=path.join(__dirname,'..','..');
const version=require(path.join(RACINE,'package.json')).version;
const DEPOT='https://github.com/BobFredGard/ConceptCAD/releases/download/V'+version;
const SORTIE=path.join(RACINE,'tauri','src-tauri','target','release','bundle','publication');
const TAR='ConceptCAD-Mac-maj.tar.gz';
const gh=(...a)=>execFileSync('gh',a,{cwd:RACINE,encoding:'utf8'}).trim();
if(!fs.existsSync(CLE))throw new Error('clé secrète absente : '+CLE);

const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:RACINE,encoding:'utf8'}).trim();
const passage=gh('run','list','--workflow','application-mac.yml','--commit',sha,'--status','success','--json','databaseId','--jq','.[0].databaseId // ""');
if(!passage)throw new Error('aucun passage GitHub réussi pour '+sha);

fs.mkdirSync(SORTIE,{recursive:true});
const recu=fs.mkdtempSync(path.join(os.tmpdir(),'cc-mac-'));
gh('run','download',passage,'-n','ConceptCAD-Mac-dmg','-D',recu);
gh('run','download',passage,'-n','ConceptCAD-Mac-maj','-D',recu);
const dmg=fs.readdirSync(recu).find(n=>n.endsWith('.dmg'));
if(!dmg||!dmg.includes('_'+version+'_'))throw new Error('DMG inattendu pour la version '+version+' : '+dmg);
fs.copyFileSync(path.join(recu,dmg),path.join(SORTIE,'ConceptCAD-Mac.dmg'));
const tar=path.join(SORTIE,TAR);
fs.copyFileSync(path.join(recu,'ConceptCAD.app.tar.gz'),tar);
fs.rmSync(recu,{recursive:true,force:true});

const r=spawnSync('cargo',['tauri','signer','sign','-f',CLE,'-p','""',tar],{cwd:path.join(RACINE,'tauri','src-tauri'),stdio:['ignore','ignore','inherit'],shell:true});
if(r.status!==0||!fs.existsSync(tar+'.sig'))throw new Error('signature impossible');
const signature=fs.readFileSync(tar+'.sig','utf8');

const annonce=path.join(SORTIE,'latest.json');
if(fs.existsSync(annonce)){
  const a=JSON.parse(fs.readFileSync(annonce,'utf8'));
  if(a.version!==version)throw new Error('latest.json annonce '+a.version+', et non '+version);
  for(const p of ['darwin-aarch64','darwin-x86_64'])a.platforms[p]={signature,url:DEPOT+'/'+TAR};
  fs.writeFileSync(annonce,JSON.stringify(a,null,2));
}
console.log('✓ Mac prêt pour V'+version+' (passage '+passage+') : '+SORTIE);
