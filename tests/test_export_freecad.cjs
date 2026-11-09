// V0.72.0 : export FreeCAD natif (.FCStd, 90-41-export-freecad). Deux aimants posés côte à côte :
// le zip est sain (CRC, Document.xml, BRep) et, si FreeCAD est installé, FreeCAD l'ouvre et
// retrouve les solides exacts (volumes), les caractéristiques des aimants et les lignes de champ.
const fs=require('fs'),vm=require('vm'),path=require('path'),os=require('os'),zlib=require('zlib'),cp=require('child_process');
const {loadApp}=require('./appvm.cjs');
function unzip(buf){
  // → Map nom → Buffer (lecture du répertoire central), CRC vérifié
  const out=new Map();let e=buf.length-22;while(e>=0&&buf.readUInt32LE(e)!==0x06054b50)e--;
  if(e<0)throw new Error('fin de zip introuvable');
  let p=buf.readUInt32LE(e+16);const n=buf.readUInt16LE(e+10);
  for(let i=0;i<n;i++){
    const meth=buf.readUInt16LE(p+10),crc=buf.readUInt32LE(p+16),cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),xl=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),lo=buf.readUInt32LE(p+42);
    const name=buf.slice(p+46,p+46+nl).toString('utf8'),ld=lo+30+buf.readUInt16LE(lo+26)+buf.readUInt16LE(lo+28);
    const raw=buf.slice(ld,ld+cs),data=meth===8?zlib.inflateRawSync(raw):raw;
    if((zlib.crc32?zlib.crc32(data):crc)!==crc)throw new Error('CRC faux : '+name);
    out.set(name,data);p+=46+nl+xl+cl;
  }
  return out;
}
function freecadCmd(){
  const c=[process.env.FREECADCMD,'C:/Program Files/FreeCAD 1.1/bin/freecadcmd.exe','C:/Program Files/FreeCAD 1.0/bin/freecadcmd.exe','/usr/bin/freecadcmd'].filter(Boolean);
  return c.find(f=>{try{return fs.statSync(f).isFile();}catch(e){return false;}})||null;
}
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;sandbox.TextEncoder=TextEncoder;
  for(const k of ["Blob","Response","CompressionStream"])if(typeof globalThis[k]!=="undefined")sandbox[k]=globalThis[k]; // compression comme dans le navigateur
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    docResetEmpty();doc.name='Deux aimants';
    const r=MAG_CAT.find(x=>x.code==='S-10-05-N');
    const sp=stdSpec('magnet',{shape:'cyl',grade:'*',art:r.code});
    const o1=(stdAddOcc(sp)||{}).occ,o2=(stdAddOcc(sp)||{}).occ;
    o2.fr={o:[25,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]}; // à côté, même sens : ils se repoussent
    o1.mag=true;
    const R=await fcBuild();
    A(R.n>=5&&R.mags===2&&R.lines>=30,'1 : '+R.n+' objets, '+R.mags+' aimants, '+R.lines+' morceaux de lignes ('+(R.bytes.length/1024).toFixed(1)+' Ko)');
    out.bytes=Array.from(R.bytes);
    out.vol=Math.PI*r.d*r.d/4*r.h;out.code=r.code;
    // V0.71.0 : disque diamétral (aimanté selon +Y) et cône tronqué : lignes et sens d'aimantation
    docResetEmpty();doc.name='Formes';
    const dn=MAG_CAT.find(x=>x.code==='S-10-05-DN'),cn=MAG_CAT.find(x=>x.s==='cone');
    if(!dn||!cn)A(false,'1b : articles diamétral et cône introuvables');
    else{
      const od=(stdAddOcc(stdSpec('magnet',{shape:dn.s,grade:'*',art:dn.code}))||{}).occ,oc=(stdAddOcc(stdSpec('magnet',{shape:cn.s,grade:'*',art:cn.code}))||{}).occ;
      oc.fr={o:[0,0,30],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
      const S3=fcCollect(),gd=S3.groups.find(g=>g.mag&&g.mag.dia);
      const R3=await fcBuild();out.bytes3=Array.from(R3.bytes);
      A(od&&oc&&R3.mags===2&&R3.lines>=20&&gd&&S3.groups.filter(g=>g.mag).every(g=>g.bodies.length===2),'1b : diamétral + cône : '+R3.mags+' aimants, '+R3.lines+' morceaux de lignes');
    }
    // pièce seule (sans assemblage) : un objet par corps, sans lignes
    docResetEmpty();doc.name='Seul';
    const S2=fcCollect();
    A(S2.groups.length===1&&S2.mags.length===0,'2 : pièce vide : aucun aimant');
    return out;
  `;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== V0.72.0 : export FreeCAD (.FCStd) ===');
  const buf=Buffer.from(o.bytes||[]);
  if(process.env.FCSTD_COPIE)fs.writeFileSync(process.env.FCSTD_COPIE,buf); // copie à ouvrir à la main
  try{
    const Z=unzip(buf),doc=String(Z.get('Document.xml')||''),gui=String(Z.get('GuiDocument.xml')||'');
    const brp=[...Z.keys()].filter(k=>/\.brp$/.test(k));
    const ok=doc.includes('<Document SchemaVersion="4"')&&gui.includes('<ViewProviderData')&&brp.length>=5&&brp.every(k=>String(Z.get(k)).startsWith('CASCADE Topology'));
    (ok?o.log:o.fails).push('3 : zip sain : Document.xml, GuiDocument.xml, '+brp.length+' formes BRep');
    (/name="Article"[^>]*group="Aimant"/.test(doc)&&doc.includes(o.code)?o.log:o.fails).push('4 : caractéristiques de l’aimant dans les propriétés (onglet Aimant)');
    // ordre des entrées = ordre où FreeCAD les demande (sinon formes vides dans sa fenêtre, pas en console)
    const want=['Document.xml'].concat([...doc.matchAll(/<Part file="([^"]+)"/g)].map(m=>m[1]),['GuiDocument.xml'],[...gui.matchAll(/<MaterialList file="([^"]+)"/g)].map(m=>m[1]));
    const keys=[...Z.keys()];
    (JSON.stringify(keys)===JSON.stringify(want)&&/<Camera /.test(gui)?o.log:o.fails).push('4b : entrées du zip dans l’ordre de lecture de FreeCAD ('+keys.length+')');
  }catch(e){o.fails.push('3 : zip illisible : '+e.message);}
  try{const t=String(unzip(Buffer.from(o.bytes3||[])).get('Document.xml')||'');(/\(0, 1, 0\) — du pôle sud/.test(t)?o.log:o.fails).push('1c : disque diamétral : sens d’aimantation (0, 1, 0) dans les propriétés');}
  catch(e){o.fails.push('1c : zip du diamétral illisible : '+e.message);}
  const fc=freecadCmd();
  if(!fc)o.log.push('5 : FreeCAD absent : ouverture non essayée');
  else{
    const dir=fs.mkdtempSync(path.join(process.env.TEMP_BANC||os.tmpdir(),'fcstd-'));
    const f=path.join(dir,'deux.FCStd').replace(/\\/g,'/'),py=path.join(dir,'lire.py'),res=path.join(dir,'res.json').replace(/\\/g,'/');
    fs.writeFileSync(f,buf);
    fs.writeFileSync(py,[
      'import FreeCAD as App, json',
      'd=App.openDocument(r"'+f+'")',
      'R={"objs":[]}',
      'for o in d.Objects:',
      '  e={"type":o.TypeId,"label":o.Label}',
      '  if hasattr(o,"Shape") and o.TypeId=="Part::Feature":',
      '    s=o.Shape; e.update(valid=s.isValid(), vol=s.Volume, solids=len(s.Solids), edges=len(s.Edges))',
      '  if hasattr(o,"Article"): e["article"]=o.Article; e["champ"]=o.Champ_face_nord',
      '  if hasattr(o,"Group"): e["kids"]=len(o.Group)',
      '  R["objs"].append(e)',
      'open(r"'+res+'","w",encoding="utf-8").write(json.dumps(R))'
    ].join('\n'));
    try{cp.execFileSync(fc,[py],{stdio:'pipe',timeout:120000});}catch(e){}
    let J=null;try{J=JSON.parse(fs.readFileSync(res,'utf8'));}catch(e){}
    if(!J)o.fails.push('5 : FreeCAD n’a pas pu ouvrir le fichier');
    else{
      const sol=J.objs.filter(x=>x.solids>0),mags=J.objs.filter(x=>x.article),fl=J.objs.filter(x=>x.type==='Part::Feature'&&x.edges>0&&!x.solids);
      const tot=sol.reduce((a,x)=>a+x.vol,0);
      (sol.length===4&&sol.every(x=>x.valid)&&Math.abs(tot-2*o.vol)<0.02*o.vol?o.log:o.fails).push('5 : FreeCAD lit 4 moitiés valides, volume '+tot.toFixed(1)+' mm³ (≈ '+(2*o.vol).toFixed(1)+' avant arrondis)');
      (mags.length===2&&mags.every(x=>x.article.startsWith(o.code)&&/mT/.test(x.champ)&&x.kids===2)?o.log:o.fails).push('6 : deux groupes d’aimant, article '+o.code+', champ « '+(mags[0]&&mags[0].champ)+' »');
      const grp=J.objs.find(x=>x.label==='Lignes de champ');
      (grp&&fl.length===grp.kids&&fl.length>=2&&fl.reduce((a,x)=>a+x.edges,0)>200?o.log:o.fails).push('7 : lignes de champ : '+fl.length+' tranches, '+fl.reduce((a,x)=>a+x.edges,0)+' segments');
    }
    try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
  }
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
