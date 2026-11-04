function occFsDiag(){
  // Photo du FS interne pour diagnostiquer (console F12).
  try{
    const L={cwd:'?',root:[],wrk:'?'};
    try{L.cwd=occt.FS.cwd();}catch(e){L.cwd='ERR '+e.message;}
    try{L.root=occt.FS.readdir('/').slice(0,20);}catch(e){L.root=['ERR '+e.message];}
    try{L.wrk=occt.FS.readdir(L.cwd).slice(0,20);}catch(e){L.wrk=['ERR '+e.message];}
    try{console.log('[OCCT-FS]',JSON.stringify(L));}catch(e){}
    return L;
  }catch(e){return null;}
}
/* ---- Schéma STEP de sortie : AP214 (défaut) ou AP203. Le dernier choix est
   retenu (localStorage).
   Le noyau écrit TOUJOURS de l'AP214 IS ({ 1 0 10303 214 1 1 1 1 }) : dans cette
   build d'opencascade.js les noms passés en chaîne n'arrivent pas au C++
   (Interface_Static.IsPresent('write.step.schema') === false, SetCVal → false),
   write.step.schema est donc inaccessible. L'AP203 est obtenu en réécrivant le
   texte comme le ferait OCCT en schéma 3 : en-tête CONFIG_CONTROL_DESIGN,
   contextes AP203 et entités de gestion obligatoires (approbation,
   classification, personne/organisation, dates — STEPConstruct_AP203Context). ---- */
let stepSchema='AP214';
try{if(localStorage.getItem('minifusion_stepSchema')==='AP203')stepSchema='AP203';}catch(e){}
function stepToAp203(bytes){
  // octets AP214 OCCT → octets AP203. Latin-1 : aller-retour octet pour octet.
  let t='';for(let i=0;i<bytes.length;i+=8192)t+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
  t=t.replace(/FILE_SCHEMA\s*\(\s*\(\s*'[^']*'\s*\)\s*\)/,"FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'))")
     .replace(/APPLICATION_PROTOCOL_DEFINITION\s*\(\s*'([^']*)'\s*,\s*'automotive_design'\s*,\s*\d+\s*,/g,"APPLICATION_PROTOCOL_DEFINITION('$1','config_control_design',1994,")
     .replace(/APPLICATION_CONTEXT\s*\(\s*'core data for automotive mechanical design processes'\s*\)/g,"APPLICATION_CONTEXT('configuration controlled 3D designs of mechanical parts and assemblies')")
     .replace(/=\s*PRODUCT_CONTEXT\s*\(/g,'= MECHANICAL_CONTEXT(')
     .replace(/=\s*PRODUCT_DEFINITION_CONTEXT\s*\(\s*'part definition'/g,"= DESIGN_CONTEXT('detailed design'");
  const ids=(re)=>{const r=[];let m;re.lastIndex=0;while((m=re.exec(t)))r.push('#'+m[1]);return r;};
  const prod=ids(/#(\d+)\s*=\s*PRODUCT\s*\(/g),
        pdf=ids(/#(\d+)\s*=\s*PRODUCT_DEFINITION_FORMATION(?:_WITH_SPECIFIED_SOURCE)?\s*\(/g),
        pd=ids(/#(\d+)\s*=\s*PRODUCT_DEFINITION\s*\(/g);
  if(!prod.length||!pdf.length||!pd.length)throw new Error('AP203 : produit introuvable dans le STEP');
  let n=0;const re=/#(\d+)\s*=/g;let m;while((m=re.exec(t)))n=Math.max(n,+m[1]);
  const L=[],e=(s)=>{n++;L.push('#'+n+' = '+s+';');return '#'+n;};
  const d=new Date();
  const L1=(a)=>'('+a.join(',')+')';
  const pers=e("PERSON('UNKNOWN','UNKNOWN','',$,$,$)");
  const org=e("ORGANIZATION('UNKNOWN','UNKNOWN','')");
  const po=e('PERSON_AND_ORGANIZATION('+pers+','+org+')');
  const off=-d.getTimezoneOffset();
  const zone=e('COORDINATED_UNIVERSAL_TIME_OFFSET('+Math.floor(Math.abs(off)/60)+','+(Math.abs(off)%60)+','+(off<0?'.BEHIND.':'.AHEAD.')+')');
  const dt=e('DATE_AND_TIME('+e('CALENDAR_DATE('+d.getFullYear()+','+d.getDate()+','+(d.getMonth()+1)+')')+','
                            +e('LOCAL_TIME('+d.getHours()+','+d.getMinutes()+','+d.getSeconds()+'.,'+zone+')')+')');
  const sec=e("SECURITY_CLASSIFICATION('','',"+e("SECURITY_CLASSIFICATION_LEVEL('unclassified')")+')');
  const appr=e("APPROVAL("+e("APPROVAL_STATUS('not_yet_approved')")+",'')");
  e('APPROVAL_PERSON_ORGANIZATION('+po+','+appr+','+e("APPROVAL_ROLE('approver')")+')');
  e('APPROVAL_DATE_TIME('+dt+','+appr+')');
  e('CC_DESIGN_APPROVAL('+appr+','+L1([sec].concat(pdf,pd))+')');
  e('CC_DESIGN_SECURITY_CLASSIFICATION('+sec+','+L1(pdf)+')');
  const role=(r,items)=>e('CC_DESIGN_PERSON_AND_ORGANIZATION_ASSIGNMENT('+po+','+e("PERSON_AND_ORGANIZATION_ROLE('"+r+"')")+','+L1(items)+')');
  role('design_owner',prod);role('design_supplier',pdf);role('classification_officer',[sec]);role('creator',pdf.concat(pd));
  e('CC_DESIGN_DATE_AND_TIME_ASSIGNMENT('+dt+','+e("DATE_TIME_ROLE('creation_date')")+','+L1(pd)+')');
  e('CC_DESIGN_DATE_AND_TIME_ASSIGNMENT('+dt+','+e("DATE_TIME_ROLE('classification_date')")+','+L1([sec])+')');
  const k=t.lastIndexOf('ENDSEC;');
  if(k<0)throw new Error('AP203 : fin de section DATA introuvable');
  t=t.slice(0,k)+L.join('\n')+'\n'+t.slice(k);
  const out=new Uint8Array(t.length);for(let i=0;i<t.length;i++)out[i]=t.charCodeAt(i)&255;
  return out;
}
/* ---- Sans courbes 2D (case « vieux logiciels », cochée par défaut, retenue).
   OCCT écrit chaque arête en SURFACE_CURVE / SEAM_CURVE : la courbe 3D plus une
   PCURVE (et son contexte 2D) par face voisine. Les vieux logiciels de l'utilisateur
   refusent ces fichiers (essai Griffe du 29/10 : assemblage sans courbes 2D lu,
   pièce seule avec courbes 2D refusée) ; FreeCAD n'en écrit aucune. Le réglage
   write.surfacecurve.mode étant inaccessible (cf. AP203 ci-dessus), on réécrit le
   texte : chaque arête pointe directement sur sa courbe 3D, puis on ne garde que
   les entités encore atteignables depuis les racines d'origine. Géométrie
   inchangée : le lecteur recalcule les courbes 2D. ---- */
let stepNoPcurve=true;
try{if(localStorage.getItem('minifusion_stepNoPcurve')==='0')stepNoPcurve=false;}catch(e){}
function stepRefsMap(s,f){
  // Remplace chaque #n hors chaîne par f(n) ; null → '#!' (référence retirée).
  let o='',q=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(c==="'"){q=!q;o+=c;continue;}
    if(!q&&c==='#'){let j=i+1;while(j<s.length&&s[j]>='0'&&s[j]<='9')j++;
      const r=f(+s.slice(i+1,j));o+=(r==null?'#!':'#'+r);i=j-1;continue;}
    o+=c;
  }
  return o;
}
function stepStripPcurves(bytes){
  let t='';for(let i=0;i<bytes.length;i+=8192)t+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
  const a=t.indexOf('DATA;'),z=t.lastIndexOf('ENDSEC;');
  if(a<0||z<a)throw new Error('courbes 2D : section DATA introuvable');
  const E=new Map(),order=[];
  let cur='',q=false;const body=t.slice(a+5,z);
  for(let i=0;i<body.length;i++){
    const c=body[i];
    if(c==="'")q=!q;
    if(c===';'&&!q){const m=/^\s*#(\d+)\s*=\s*([\s\S]*)$/.exec(cur);
      if(m){E.set(+m[1],m[2].trim());order.push(+m[1]);}
      cur='';continue;}
    cur+=c;
  }
  const refs=(s)=>{const r=[];stepRefsMap(s,n=>{r.push(n);return n;});return r;};
  // Racines : entités que personne ne référence (avant retouche).
  const used=new Set();for(const id of order)for(const n of refs(E.get(id)))used.add(n);
  const roots=order.filter(id=>!used.has(id));
  const alias=new Map();
  for(const id of order){const m=/^(?:SURFACE_CURVE|SEAM_CURVE)\s*\(\s*'[^']*'\s*,\s*#(\d+)/.exec(E.get(id));if(m)alias.set(id,+m[1]);}
  if(!alias.size)return bytes;
  for(const id of alias.keys())E.delete(id);
  for(const [id,s] of E)E.set(id,stepRefsMap(s,n=>alias.has(n)?alias.get(n):n));
  const keep=new Set(),st=roots.filter(r=>E.has(r));
  while(st.length){const id=st.pop();if(keep.has(id))continue;keep.add(id);
    for(const n of refs(E.get(id)))if(E.has(n)&&!keep.has(n))st.push(n);}
  const kept=order.filter(id=>keep.has(id));
  const nu=new Map();kept.forEach((id,i)=>nu.set(id,i+1));
  const L=kept.map(id=>{const s=stepRefsMap(E.get(id),n=>nu.has(n)?nu.get(n):null);
    if(s.includes('#!'))throw new Error('courbes 2D : référence morte dans #'+id);
    return '#'+nu.get(id)+' = '+s+';';});
  t=t.slice(0,a+5)+'\n'+L.join('\n')+'\n'+t.slice(z);
  const out=new Uint8Array(t.length);for(let i=0;i<t.length;i++)out[i]=t.charCodeAt(i)&255;
  return out;
}
function stepLabel(sch){return sch+(stepNoPcurve?' sans courbes 2D':'');}
function stepAskSchema(titre){
  // Petite fenêtre « AP214 / AP203 » ; résout le schéma choisi, ou null (Échap / fond).
  return new Promise(res=>{
    let ov=document.getElementById('stepSchDlg');if(ov)ov.remove();
    ov=document.createElement('div');ov.id='stepSchDlg';
    ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center';
    const box=document.createElement('div');
    box.style.cssText='background:#1c1c20;color:#e8e8ea;border:1px solid #3a3a40;border-radius:10px;padding:14px 16px;width:360px;max-width:92vw;font-size:13px;box-shadow:0 14px 40px rgba(0,0,0,.6)';
    box.innerHTML='<b style="font-size:15px">'+(titre||'Export STEP')+'</b><div style="opacity:.7;margin:4px 0 10px">Format du fichier :</div>';
    const fin=(v)=>{document.removeEventListener('keydown',kd,true);ov.remove();
      if(v){stepSchema=v;try{localStorage.setItem('minifusion_stepSchema',v);}catch(e){}}
      res(v);};
    const kd=(e)=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();fin(null);}
      else if(e.key==='Enter'){e.stopPropagation();e.preventDefault();fin(stepSchema);}};
    [['AP214','AP214 — automotive design','Recommandé : lu par tous les logiciels récents.'],
     ['AP203','AP203 — config control design','Pour les logiciels plus anciens ou exigeant l’AP203.']].forEach(([v,lab,sub])=>{
      const b=document.createElement('button');
      const on=v===stepSchema;
      b.style.cssText='display:block;width:100%;text-align:left;margin:0 0 8px;padding:8px 10px;border-radius:7px;cursor:pointer;color:#e8e8ea;background:'+(on?'#24324a':'#101012')+';border:1px solid '+(on?'#4a8cff':'#3a3a40');
      b.innerHTML='<b>'+lab+'</b><div style="opacity:.7;font-size:12px;margin-top:2px">'+sub+'</div>';
      b.onclick=()=>fin(v);
      box.appendChild(b);
    });
    const pc=document.createElement('label');
    pc.style.cssText='display:flex;gap:8px;align-items:flex-start;margin:2px 0 10px;cursor:pointer';
    pc.innerHTML='<input type="checkbox" style="margin-top:2px"'+(stepNoPcurve?' checked':'')+'><span><b>Sans courbes 2D</b><div style="opacity:.7;font-size:12px;margin-top:2px">Pour les vieux logiciels : arêtes en 3D seulement, fichier plus léger.</div></span>';
    pc.querySelector('input').onchange=(e)=>{stepNoPcurve=!!e.target.checked;
      try{localStorage.setItem('minifusion_stepNoPcurve',stepNoPcurve?'1':'0');}catch(_){}};
    box.appendChild(pc);
    const an=document.createElement('button');an.textContent='Annuler';
    an.style.cssText='float:right;padding:4px 12px;border-radius:6px;cursor:pointer';
    an.onclick=()=>fin(null);box.appendChild(an);
    ov.onclick=(e)=>{if(e.target===ov)fin(null);};
    ov.appendChild(box);document.body.appendChild(ov);
    document.addEventListener('keydown',kd,true);
  });
}
// Fonctions du FS présentes dans les DEUX noyaux : le noyau OCCT 8 (occt/v3) n'expose plus
// FS.analyzePath ni FS.isDir ; FS.stat reste disponible partout.
function occFsExists(path){try{occt.FS.stat(path);return true;}catch(e){return false;}}
function occFsIsDir(st){return (st.mode&0o170000)===0o040000;}
function occWriteStep(shapes,path,schema,noPcurve){
  // schema : 'AP214' | 'AP203' ; noPcurve : booléen (défaut : derniers choix de l'utilisateur).
  let b=occWriteStepAp214(shapes,path);
  if(noPcurve==null?stepNoPcurve:noPcurve)b=stepStripPcurves(b);
  return (schema||stepSchema)==='AP203'?stepToAp203(b):b;
}
function occWriteStepAp214(shapes,path){
  // shapes : liste de TopoDS_Shape -> octets STEP via le FS OCCT. Chaque étape est vérifiée.
  const RD=occt.IFSelect_ReturnStatus;
  const wr=new occt.STEPControl_Writer_1();
  const AsIs=occt.STEPControl_StepModelType.STEPControl_AsIs;
  shapes.forEach((s,i)=>{
    let st=null;
    try{st=wr.Transfer(s,AsIs,true);}catch(e){throw new Error(`transfert ${i} impossible (${e.message||e})`);}
    if(st!==RD.IFSelect_RetDone)throw new Error(`transfert ${i} refusé par le noyau`);
  });
  let wst=null;
  try{wst=wr.Write(path);}catch(e){occFsDiag();throw new Error(`écriture impossible (${e.message||e}) — voir console F12 [OCCT-FS]`);}
  let bytes=null;
  try{bytes=occt.FS.readFile(path);}catch(e){bytes=null;} // lecture AVANT toute libération
  try{wr.delete();}catch(e){}
  if(wst!==RD.IFSelect_RetDone){occFsDiag();throw new Error(`écriture refusée par le noyau — voir console F12 [OCCT-FS]`);}
  const ok=occFsExists(path);
  if(bytes&&bytes.length>1000)return bytes;
  if(!ok){
    // Ultime recours : balaye le FS pour retrouver le fichier (CWD inattendu ?).
    let seen='';
    try{
      const walk=(d)=>{
        for(const n of occt.FS.readdir(d)){
          if(n==='.'||n==='..')continue;
          const p=(d==='/'?'':d)+'/'+n;
          try{
            const st=occt.FS.stat(p);
            if(st&&st.size>0&&/\.stp$/i.test(p)){seen=p;return true;}
            if(occFsIsDir(st)&&!/^\/(dev|proc)(\/|$)/.test(p)){if(walk(p))return true;}
          }catch(e){}
        }
        return false;
      };
      walk('/');
    }catch(e){}
    try{console.log('[OCCT-FS] fichier cherché : '+path+' · autre .stp trouvé : '+(seen||'aucun'));}catch(e){}
    if(seen){
      try{return occt.FS.readFile(seen);}
      catch(e){throw new Error(`fichier retrouvé ailleurs (${seen}) mais illisible`);}
    }
    throw new Error('fichier non créé ('+path+') — console F12 : [OCCT-FS]');
  }
  try{return occt.FS.readFile(path);}
  catch(e){throw new Error(`lecture du fichier interne impossible (${e.message||e})`);}
}
async function occExportPreflight(){
  // 1) FS JS, 2) écriture C++ d'une boîte témoin. Retourne [ok, détail].
  try{occt.FS.writeFile('/pre_t.txt','hello');}
  catch(e){return[false,'FS interne inscriptible ? NON ('+e.message+')'];}
  let rd=null;
  try{rd=occt.FS.readFile('/pre_t.txt');}catch(e){return[false,'FS lecture impossible ('+e.message+')'];}
  if(!rd||rd.length!==5)return[false,'FS lecture incohérente'];
  try{occt.FS.unlink('/pre_t.txt');}catch(e){}
  try{
    const RD=occt.IFSelect_ReturnStatus;
    const b=new occt.BRepPrimAPI_MakeBox_2(new occt.gp_Pnt_3(0,0,0),10,10,10);
    b.Build();
    const wr=new occt.STEPControl_Writer_1();
    wr.Transfer(b.Shape(),occt.STEPControl_StepModelType.STEPControl_AsIs,true);
    const st=wr.Write('/pre_b.stp');
    try{b.delete();}catch(e){}try{wr.delete();}catch(e){}
    if(st!==RD.IFSelect_RetDone)return[false,'Write boîte refusé par le noyau'];
    if(!occFsExists('/pre_b.stp'))return[false,'Write boîte OK mais fichier absent (traversée des noms rompue — rechargez la page)'];
    let n=0;try{n=occt.FS.readFile('/pre_b.stp').length;}catch(e){}
    try{occt.FS.unlink('/pre_b.stp');}catch(e){}
    if(!(n>1000))return[false,'boîte écrite mais vide'];
    return[true,'pré-test OK'];
  }catch(e){return[false,'boîte témoin : '+(e.message||e)];}
}
$('btnExportStep').onclick=async()=>{
  if(!occHas()){alert('Export STEP exact nécessite OCCT (chargement en cours ou échec — servez la page en http://). Export STL/OBJ dispo.');return;}
  const sch=await stepAskSchema('Export STEP');
  if(!sch)return;
  faceEl.textContent='Export STEP : pré-test…';
  const[pok,pdetail]=await occExportPreflight();
  try{console.log('[STEP-OUT] pré-test : '+pdetail);}catch(e){}
  if(!pok){alert('Export STEP impossible : '+pdetail+'.');faceEl.textContent='Export STEP : '+pdetail;return;}
  try{
    // Exporte le solide exact : même pipeline que l'affichage (prismes + booléens + congés exacts).
    const FR=occFinalShape();
    const lone=importLoneShapes(FR,null); // STEP seuls dans leur corps (hors perBody)
    const all=[FR.shape].concat(lone.map(p=>p.shape)).filter(Boolean);
    if(!all.length){alert('Solide vide, rien à exporter.');return;}
    const path='/o.stp'; // chemin court fixe (les chemins longs échouent dans certains onglets)
    try{occt.FS.unlink(path);}catch(e){}
    try{console.log('[STEP-OUT] path='+JSON.stringify(path)+' typeof='+(typeof path)+' cwd='+occt.FS.cwd()+' avant='+occt.FS.readdir('/').slice(0,12).join(','));}catch(e){}
    let bytes;
    try{bytes=occWriteStep(all,path,sch);}finally{lone.forEach(p=>{try{p.shape.delete();}catch(e){}});}
    try{console.log('[STEP-OUT] après='+occt.FS.readdir('/').slice(0,12).join(','));}catch(e){}
    const blob=new Blob([bytes],{type:'application/step'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(doc.name||'piece')+'.step';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    try{occt.FS.unlink(path);}catch(e){}
    occCleanup(FR,null);
    faceEl.textContent='STEP '+stepLabel(sch)+' exact exporté ('+(bytes.length/1024).toFixed(1)+' Ko).';
  }catch(e){alert('Export STEP impossible : '+e.message);}
};
$('btnExportStl').onclick=()=>downloadMesh('stl');
$('btnExportObj').onclick=()=>downloadMesh('obj');
function downloadMesh(fmt){
  const vis=bodies.filter(b=>b.visible&&!b.ghost);if(!vis.length){alert('Rien à exporter (que des outils de découpe ?).');return;}
  let blob;
  if(fmt==='stl')blob=new Blob([meshesToSTL(vis.map(b=>b.mesh))],{type:'model/stl'});
  else blob=new Blob([meshesToOBJ(vis.map(b=>b.mesh))],{type:'text/plain'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(doc.name||'piece')+'.'+fmt;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function meshesToSTL(meshes){
  let count=0;meshes.forEach(m=>{const g=m.geometry;count+= (g.index?g.index.count:g.attributes.position.count)/3;});
  const buf=new ArrayBuffer(84+count*50);const dv=new DataView(buf);
  dv.setUint32(80,count,true);let off=84;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3(),e1=new THREE.Vector3(),e2=new THREE.Vector3();
  meshes.forEach(m=>{m.updateMatrixWorld(true);const g=m.geometry;const p=g.attributes.position;const idx=g.index;
    const triN=(idx?idx.count:p.count)/3;
    for(let i=0;i<triN;i++){
      const ia=idx?idx.getX(i*3):i*3,ib=idx?idx.getX(i*3+1):i*3+1,ic=idx?idx.getX(i*3+2):i*3+2;
      a.fromBufferAttribute(p,ia).applyMatrix4(m.matrixWorld);b.fromBufferAttribute(p,ib).applyMatrix4(m.matrixWorld);c.fromBufferAttribute(p,ic).applyMatrix4(m.matrixWorld);
      e1.subVectors(b,a);e2.subVectors(c,a);n.crossVectors(e1,e2).normalize();
      dv.setFloat32(off,n.x,true);dv.setFloat32(off+4,n.y,true);dv.setFloat32(off+8,n.z,true);
      [a,b,c].forEach((v,k)=>{dv.setFloat32(off+12+k*12,v.x,true);dv.setFloat32(off+16+k*12,v.y,true);dv.setFloat32(off+20+k*12,v.z,true);});
      dv.setUint16(off+48,0,true);off+=50;
    }});
  return buf;
}
function meshesToOBJ(meshes){
  let s='# ConceptCAD\n',vo=1;
  meshes.forEach(m=>{m.updateMatrixWorld(true);s+=`o ${m.name||'part'}\n`;const p=m.geometry.attributes.position;const v=new THREE.Vector3();
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);s+=`v ${v.x} ${v.y} ${v.z}\n`;}
    const idx=m.geometry.index;const n=(idx?idx.count:p.count)/3;
    for(let i=0;i<n;i++){const a=(idx?idx.getX(i*3):i*3)+vo,b=(idx?idx.getX(i*3+1):i*3+1)+vo,c=(idx?idx.getX(i*3+2):i*3+2)+vo;s+=`f ${a} ${b} ${c}\n`;}
    vo+=p.count;});
  return s;
}
