// Fabrique ConceptCAD-autonome.html : un seul fichier qui s'ouvre par double-clic, sans Internet et
// sans serveur, avec le noyau OCCT 8 (occt/v3) et les bibliothèques de threejs/ à l'intérieur.
//   node tools/autonome.cjs [fichier de sortie]        (npm run autonome)
// Le livrable ConceptCAD.html est lu tel quel : lancer `node build.js` avant. Le wasm est compressé
// (43 → 12 Mo). Le code de l'application reconnaît ce mode à window.__EMB, posé ici (voir 96-noyau,
// 21-suppression-face-calcul, 98-rendu-rayons). Résultat trop gros pour Git : fichier ignoré, refait
// à chaque livraison dans le dépôt principal.
'use strict';
const fs=require('fs'),zlib=require('zlib'),path=require('path');
const ROOT=path.join(__dirname,'..');
const lire=p=>fs.readFileSync(path.join(ROOT,p));
function fabriquer(sortie){
  const wasm=lire('occt/v3/conceptcad_v3.wasm');
  // dans un worktree, le fichier peut n'être qu'un pointeur LFS (git lfs checkout)
  if(wasm.length<1e7)throw new Error('occt/v3/conceptcad_v3.wasm : '+wasm.length+' octets, pointeur LFS ?');
  let h=lire('ConceptCAD.html').toString('utf8');
  const rep=(a,b)=>{if(!h.includes(a))throw new Error('introuvable dans ConceptCAD.html : '+a);h=h.replace(a,()=>b);};
  for(const f of ['three.min.js','OrbitControls.js','CSG.js'])
    rep('<script src="threejs/'+f+'"></script>','<script>'+lire('threejs/'+f).toString('utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
  // la fiche d'installation (application installable) n'a pas de sens en double-clic : file:// la refuserait
  rep('<link rel="manifest" href="manifest.webmanifest">\r\n','');
  rep('<link rel="apple-touch-icon" href="icones/conceptcad-180.png">\r\n','');
  const b64=p=>lire(p).toString('base64');
  const emb='<script>window.__EMB={'+
    'js:"'+b64('occt/v3/conceptcad_v3.js')+'",compat:"'+b64('occt/v3/compat-v3.cjs')+'",table:"'+b64('occt/v3/compat-v3.json')+'",'+
    'rendu:"'+b64('threejs/rendu-rayons.js')+'",wasm:"'+zlib.gzipSync(wasm,{level:9}).toString('base64')+'",'+
    // Adresses blob : tout le reste du logiciel les lit comme les vrais fichiers. Blobs gardés pour le worker.
    'async pret(F){const oct=s=>{const t=atob(s),u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);return u;};'+
    'const B=this.blobs={};const url=(k,s,type)=>URL.createObjectURL(B[k]=new Blob([oct(s)],{type}));'+
    "F.js=url('js',this.js,'text/javascript');F.compat=url('compat',this.compat,'text/javascript');F.table=url('table',this.table,'application/json');"+
    "this.rt=url('rendu',this.rendu,'text/javascript');"+
    "const r=new Response(new Blob([oct(this.wasm)]).stream().pipeThrough(new DecompressionStream('gzip')));"+
    "F.wasm=URL.createObjectURL(B.wasm=new Blob([await r.arrayBuffer()],{type:'application/wasm'}));"+
    'this.js=this.compat=this.table=this.rendu=this.wasm=null;}};</script>';
  rep('<head>','<head>'+emb);
  fs.writeFileSync(sortie,h);
  return fs.statSync(sortie).size;
}
if(require.main===module){
  const sortie=path.resolve(process.argv[2]||path.join(ROOT,'ConceptCAD-autonome.html'));
  console.log('✓ '+sortie+' : '+(fabriquer(sortie)/1048576).toFixed(1)+' Mo');
}
module.exports={fabriquer};
