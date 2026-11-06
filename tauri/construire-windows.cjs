// Fabrique tout ce qu'il faut publier pour Windows, dans target/release/bundle/publication :
//   ConceptCAD-Windows-setup.exe : l'installateur, signé pour la mise à jour par Internet
//   latest.json : l'annonce que les applications installées lisent au démarrage
//   node tauri/construire-windows.cjs
// La clé secrète reste hors du dépôt : ~/.tauri/conceptcad-maj.key. Sans elle, plus aucune mise à jour possible.
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ICI=__dirname,TAURI=path.join(ICI,'src-tauri');
const CLE=path.join(os.homedir(),'.tauri','conceptcad-maj.key');
const version=require(path.join(ICI,'..','package.json')).version;
const DEPOT='https://github.com/BobFredGard/ConceptCAD/releases/download/V'+version;
const NOM='ConceptCAD-Windows-setup.exe';
if(!fs.existsSync(CLE))throw new Error('clé secrète absente : '+CLE);
const lancer=(cmd,args,cwd,env)=>{const r=spawnSync(cmd,args,{cwd,stdio:'inherit',shell:true,env:{...process.env,...env}});if(r.status!==0)throw new Error(cmd+' '+args.join(' ')+' : échec');};
lancer('node',[path.join(ICI,'preparer.cjs')],ICI);
lancer('cargo',['tauri','build','--config','tauri.installateur.json'],TAURI,{TAURI_SIGNING_PRIVATE_KEY:fs.readFileSync(CLE,'utf8').trim(),TAURI_SIGNING_PRIVATE_KEY_PASSWORD:''});
const NSIS=path.join(TAURI,'target','release','bundle','nsis'),setup=path.join(NSIS,`ConceptCAD_${version}_x64-setup.exe`);
const SORTIE=path.join(TAURI,'target','release','bundle','publication');
fs.rmSync(SORTIE,{recursive:true,force:true});
fs.mkdirSync(SORTIE,{recursive:true});
fs.copyFileSync(setup,path.join(SORTIE,NOM));
fs.writeFileSync(path.join(SORTIE,'latest.json'),JSON.stringify({
  version,
  pub_date:new Date().toISOString(),
  platforms:{'windows-x86_64':{signature:fs.readFileSync(setup+'.sig','utf8'),url:DEPOT+'/'+NOM}}
},null,2));
console.log('✓ à publier sur V'+version+' : '+SORTIE);
