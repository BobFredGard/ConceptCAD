// V0.46.2 : fichiers d'Exemples/ jamais vides ni tronqués (vu : Barquette.conceptcad à 0 octet dans le
// dépôt principal le 03/11/2026, cause extérieure à l'application). Rouge = ne pas livrer : remettre la
// version de Git (`git restore -- Exemples/<fichier>`) ou réenregistrer depuis l'application.
// Un pointeur Git LFS (copie de travail sans `git lfs checkout`) est accepté tel quel.
const fs=require('fs'),path=require('path');
// argument facultatif : autre dossier (au cpt, celui du dépôt principal D:\ConceptCAD\Exemples)
const DIR=process.argv[2]?path.resolve(process.argv[2]):path.join(__dirname,'..','Exemples');
const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};
const isPointer=t=>/^version https:\/\/git-lfs\.github\.com\/spec\/v1\r?\n/.test(t);
const files=fs.readdirSync(DIR).filter(n=>/\.(conceptcad|minifusion|step|stp)$/i.test(n));
att(files.length>0,'Exemples/ contient des projets ('+files.length+')');
for(const n of files){
  const st=fs.statSync(path.join(DIR,n));
  if(st.size===0){att(false,n+' : VIDE (0 octet)');continue;}
  const buf=fs.readFileSync(path.join(DIR,n));
  // fichier compressé (gzip 1f 8b, zip PK) : décompressé par zlib s'il est en gzip, sinon taille seule
  if(buf[0]===0x1f&&buf[1]===0x8b){
    let ok=false,why='';try{const t=require('zlib').gunzipSync(buf).toString('utf8');const o=JSON.parse(t);ok=!!o&&typeof o==='object';}catch(e){why=e.message;}
    att(ok,n+(ok?' : compressé (gzip), complet ('+st.size+' octets)':' : compressé mais abîmé ('+why.slice(0,60)+')'));continue;
  }
  if(buf[0]===0x50&&buf[1]===0x4b){att(st.size>22,n+' : compressé (zip, '+st.size+' octets)');continue;}
  const txt=buf.toString('utf8');
  if(isPointer(txt)){att(true,n+' : pointeur LFS');continue;}
  if(/\.(step|stp)$/i.test(n)){
    att(/^\s*ISO-10303-21;/.test(txt)&&/END-ISO-10303-21;\s*$/.test(txt),n+' : STEP complet ('+st.size+' octets)');
    continue;
  }
  let o=null,err='';try{o=JSON.parse(txt);}catch(e){err=e.message;}
  const d=o&&typeof o==='object'?(o.doc&&typeof o.doc==='object'?o.doc:o):null;
  att(!!d&&(d.app==='MiniFusion'||Array.isArray(d.features)||Array.isArray(d.sketches)),
    n+(err?' : illisible ('+err.slice(0,60)+')':(d?' : projet lisible ('+st.size+' octets)':' : pas un projet ConceptCAD')));
}
console.log('=== Exemples/ : fichiers complets ===');
OK.forEach(m=>console.log('  ✓ '+m));
if(ATT.length){ATT.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+ATT.length+' PROBLEME(S) ***');process.exit(1);}
console.log('\n*** TOUT PASSE ***');
