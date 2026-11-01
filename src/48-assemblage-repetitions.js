/* ---------- répétitions de composants (V0.29.0) ----------
   Les répétitions de la pièce (40 : linéaire, deux directions, circulaire, symétrie, symétrie
   double), appliquées à des OCCURRENCES. Une répétition appartient au composant porteur :
     owner.pats = [{id, name, type:'lin'|'circ'|'mir', src:[ids d'occurrences du porteur],
                    ref:{cg} (repère du porteur : son origine si cg null, sinon un repère de
                    construction), axis 'X'|'Y'|'Z' (direction, axe de rotation ou normale du plan,
                    dans ce repère), copies (original exclu), dist, angle, lin2/axis2/copies2/dist2
                    (2ᵉ direction), plane2 (symétrie double : normale du 2ᵉ plan), skip:[clés]}]
   Les instances sont des occurrences ordinaires du porteur, marquées o.pat = {id, k} (k = source
   + case de la grille) : leur position est DÉRIVÉE (transformation × position de la source),
   recalculée par asmResolveIn — associative : la source bouge (manipulateur, liaison), le repère
   de référence bouge → les instances suivent. Une instance garde son identifiant d'un calcul à
   l'autre (les références vers elle tiennent) ; supprimée, sa clé va dans skip ; une source
   supprimée emporte ses instances.
   Symétrie : vraie symétrie (repère indirect, déterminant −1) — la pièce est dessinée et
   inspectée en miroir, comme la fonction Symétrie de la pièce.
   Suivant un profil (V0.30.0, type 'path', calcul : 39-profil-guide) : path {sk, pt | mid}
   (esquisse GUIDE du porteur, point de départ), pspace 'fit' | 'pitch' (pas = dist), orient
   'fixed' | 'tangent', rev. La source est posée sur le départ (courbe tracée par son centre) :
   chaque instance est la source déplacée du départ à sa station, tournée avec la tangente au
   besoin. */
const ASM_PAT_MAX=500; // instances par répétition (garde-fou d'une saisie aberrante)
const ASM_PAT_TYPES={lin:'Linéaire',circ:'Circulaire',mir:'Symétrie',path:'Suivant un profil'};
function asmPatName(p){
  if(!p)return '';
  if(p.type==='mir')return p.plane2?'Symétrie double':'Symétrie';
  if(p.type==='lin'&&p.lin2)return 'Linéaire 2 directions';
  return ASM_PAT_TYPES[p.type]||'Répétition';
}
function asmPatNorm(list){
  // Répétitions lues d'un fichier : tout est vérifié, une entrée inutilisable est écartée
  if(!Array.isArray(list))return undefined;
  const ax=v=>v==='Y'||v==='Z'?v:'X',num=(v,d)=>isFinite(+v)?+v:d,cnt=v=>Math.max(1,Math.min(ASM_PAT_MAX,Math.floor(+v)||1));
  const out=list.filter(p=>p&&typeof p.id==='string'&&ASM_PAT_TYPES[p.type]&&Array.isArray(p.src)).map(p=>{
    const o={id:p.id,name:typeof p.name==='string'?p.name:'',type:p.type,src:p.src.filter(x=>typeof x==='string'),
      ref:{cg:p.ref&&typeof p.ref.cg==='string'?p.ref.cg:null},axis:ax(p.axis),copies:cnt(p.copies),dist:num(p.dist,10),angle:num(p.angle,360),
      skip:Array.isArray(p.skip)?p.skip.filter(x=>typeof x==='string'):[]};
    if(p.lin2){o.lin2=true;o.axis2=ax(p.axis2);o.copies2=cnt(p.copies2);o.dist2=num(p.dist2,10);}
    if(p.plane2)o.plane2=ax(p.plane2);
    if(p.type==='path'){
      const q=p.path&&typeof p.path==='object'?p.path:{};
      o.path={sk:typeof q.sk==='string'?q.sk:null};
      if(typeof q.pt==='string')o.path.pt=q.pt;else if(typeof q.mid==='string')o.path.mid=q.mid;
      o.pspace=p.pspace==='pitch'?'pitch':'fit';o.orient=p.orient==='tangent'?'tangent':'fixed';
      if(p.rev)o.rev=true;
    }
    return o;
  }).filter(p=>p.src.length);
  return out.length?out:undefined;
}
function asmPatSerial(c){
  const L=c&&c.pats;if(!Array.isArray(L)||!L.length)return undefined;
  return L.map(p=>{const o={};Object.keys(p).forEach(k=>{if(k!=='st'&&k!=='msg'&&k[0]!=='_')o[k]=p[k];});return JSON.parse(JSON.stringify(o));});
}
function asmPatRemap(list,M){
  // Identifiants renouvelés (insertion d'un fichier, composant lié) : sources, clés des instances
  if(!Array.isArray(list))return list;
  return list.map(p=>Object.assign({},p,{src:(p.src||[]).map(M),skip:(p.skip||[]).map(k=>asmPatKeyRemap(k,M))}));
}
function asmPatKeyRemap(k,M){const i=String(k).indexOf('|');return i<0?k:M(k.slice(0,i))+k.slice(i);}
function asmPatOccRemap(pat,M){return pat&&typeof pat==='object'?{id:pat.id,k:asmPatKeyRemap(pat.k,M)}:undefined;}
/* ── transformations (repères {o,x,y,z} : asmCompose / asmApply, 46) ── */
function asmPatUnit(v){const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}
function asmPatAxis(F,a){return asmPatUnit(a==='Y'?F.y:a==='Z'?F.z:F.x);}
function asmPatTrans(d){return {o:d.slice(),x:[1,0,0],y:[0,1,0],z:[0,0,1]};}
function asmPatRot(P,a,ang){
  // Rotation d'angle ang (rad) autour de la droite (P, a) — Rodrigues
  const c=Math.cos(ang),s=Math.sin(ang),[x,y,z]=a;
  const R=v=>{const d=x*v[0]+y*v[1]+z*v[2];
    return [v[0]*c+(y*v[2]-z*v[1])*s+x*d*(1-c),v[1]*c+(z*v[0]-x*v[2])*s+y*d*(1-c),v[2]*c+(x*v[1]-y*v[0])*s+z*d*(1-c)];};
  const rp=R(P);
  return {o:[P[0]-rp[0],P[1]-rp[1],P[2]-rp[2]],x:R([1,0,0]),y:R([0,1,0]),z:R([0,0,1])};
}
function asmPatMirror(P,n){
  // Symétrie par rapport au plan (P, n) : R = I − 2 n nᵀ (repère indirect)
  const R=v=>{const d=2*(n[0]*v[0]+n[1]*v[1]+n[2]*v[2]);return [v[0]-d*n[0],v[1]-d*n[1],v[2]-d*n[2]];};
  const rp=R(P);
  return {o:[P[0]-rp[0],P[1]-rp[1],P[2]-rp[2]],x:R([1,0,0]),y:R([0,1,0]),z:R([0,0,1])};
}
function asmPatRefFrame(owner,p){return p&&p.ref&&p.ref.cg?asmCompFrame(owner.id,p.ref.cg):asmFr0();}
function asmPatCells(owner,p){
  // Cases de la répétition (original exclu) : [{k, M}] — M dans le repère du porteur ; null si
  // le repère de référence a disparu
  const F=asmPatRefFrame(owner,p);if(!F)return null;
  const out=[];
  if(p.type==='lin'){
    const d1=asmPatAxis(F,p.axis),n1=Math.max(1,+p.copies||1),s1=+p.dist||0;
    const two=!!p.lin2,d2=two?asmPatAxis(F,p.axis2):[0,0,0],n2=two?Math.max(1,+p.copies2||1):0,s2=two?(+p.dist2||0):0;
    for(let j=0;j<=n2;j++)for(let i=0;i<=n1;i++){
      if(!i&&!j)continue;
      out.push({k:i+','+j,M:asmPatTrans([d1[0]*s1*i+d2[0]*s2*j,d1[1]*s1*i+d2[1]*s2*j,d1[2]*s1*i+d2[2]*s2*j])});
    }
  }else if(p.type==='circ'){
    const a=asmPatAxis(F,p.axis),n=Math.max(1,+p.copies||1);
    const step=typeof repCircStep==='function'?repCircStep({angle:p.angle,copies:n}):(Math.abs(+p.angle||360)>=360-1e-9?(+p.angle||360)/(n+1):(+p.angle||360)/n);
    for(let i=1;i<=n;i++)out.push({k:'r'+i,M:asmPatRot(F.o,a,step*i*Math.PI/180)});
  }else if(p.type==='path'){
    const P=asmPatPlan(owner,p);
    if(P.err){p._why=P.err;return null;}
    P.cells.forEach((q,i)=>{
      const M=asmPatRot(q.P0,asmPatUnit(q.N),q.ang*Math.PI/180);
      M.o=[M.o[0]+q.Pi[0]-q.P0[0],M.o[1]+q.Pi[1]-q.P0[1],M.o[2]+q.Pi[2]-q.P0[2]];
      out.push({k:'s'+(i+1),M});
    });
  }else if(p.type==='mir'){
    const M1=asmPatMirror(F.o,asmPatAxis(F,p.axis));
    out.push({k:'m1',M:M1});
    if(p.plane2){const M2=asmPatMirror(F.o,asmPatAxis(F,p.plane2));out.push({k:'m2',M:M2},{k:'m12',M:asmCompose(M1,M2)});}
  }
  return out.slice(0,ASM_PAT_MAX);
}
function asmPatPlan(owner,p){
  // Courbe guide (esquisse du porteur) → pgPlan : {L, closed, step, cells, warn, err}
  const sk=p.path&&((owner.doc&&owner.doc.sketches)||[]).find(s=>s.id===p.path.sk);
  if(!sk)return {err:'esquisse guide introuvable dans « '+owner.name+' »',cells:[]};
  try{ensureSketchBasis(sk);}catch(e){}
  return pgPlan(sk,p,Math.max(1,+p.copies||1)+1);
}
function asmPatGen(owner){
  // Instances des répétitions du porteur, créées / placées / retirées → true si quelque chose a changé
  if(!owner)return false;
  let ch=false;
  const byId=new Map(owner.occ.map(o=>[o.id,o]));
  // une répétition sans source restante disparaît (ses instances avec elle)
  if(Array.isArray(owner.pats)){
    owner.pats.forEach(p=>{p.src=(p.src||[]).filter(id=>{const o=byId.get(id);return o&&!o.pat;});});
    const n0=owner.pats.length;owner.pats=owner.pats.filter(p=>p.src.length);
    if(owner.pats.length!==n0)ch=true;
    if(!owner.pats.length)delete owner.pats;
  }
  const pats=owner.pats||[],have=new Map(),keep=new Set();
  owner.occ.forEach(o=>{if(o.pat)have.set(o.pat.id+'#'+o.pat.k,o);});
  const fresh=[];
  pats.forEach(p=>{
    p.st='ok';p.msg='';
    const cells=asmPatCells(owner,p);
    if(!cells){ // repère de référence introuvable : les instances restent où elles sont
      p.st='warn';p.msg=p._why||'repère de référence introuvable : instances laissées en place';delete p._why;
      owner.occ.forEach(o=>{if(o.pat&&o.pat.id===p.id)keep.add(o.id);});return;
    }
    const skip=new Set(p.skip||[]);
    p.src.forEach(sid=>{
      const s=byId.get(sid);if(!s)return;
      cells.forEach(cell=>{
        const k=sid+'|'+cell.k;if(skip.has(k))return;
        let o=have.get(p.id+'#'+k);
        if(!o){o=asmNewOccObj(s.comp,asmOccName(s.comp));o.pat={id:p.id,k};fresh.push(o);ch=true;}
        if(o.comp!==s.comp){o.comp=s.comp;ch=true;}
        const fr=asmRound(asmCompose(cell.M,s.fr));
        if(['o','x','y','z'].some(q=>fr[q].some((v,j)=>Math.abs(v-o.fr[q][j])>1e-9))){o.fr=fr;ch=true;}
        if(o.align){o.align=null;ch=true;}
        if(o.fixed)o.fixed=false;
        // apparence de la source (intensité, transparence, arêtes, rendu) : les instances la suivent
        const lk=s.look?JSON.stringify(s.look):'',rd=s.rendu?JSON.stringify(s.rendu):'';
        if((o.look?JSON.stringify(o.look):'')!==lk){if(lk)o.look=JSON.parse(lk);else delete o.look;ch=true;}
        if((o.rendu?JSON.stringify(o.rendu):'')!==rd){if(rd)o.rendu=JSON.parse(rd);else delete o.rendu;ch=true;}
        o.st='ok';o.msg='';
        keep.add(o.id);
      });
    });
  });
  if(fresh.length){
    // les instances neuves se rangent après leur source (arbre, ordre des occurrences)
    fresh.forEach(o=>{
      const sid=o.pat.k.split('|')[0];
      let at=-1;owner.occ.forEach((q,i)=>{if(q.id===sid||(q.pat&&q.pat.id===o.pat.id&&q.pat.k.split('|')[0]===sid))at=i;});
      owner.occ.splice(at<0?owner.occ.length:at+1,0,o);
    });
    // numéros suivis (« Goupille:2 », « Goupille:3 »…) : nommées une à une, une fois toutes rangées
    fresh.forEach(o=>{o.name='';});fresh.forEach(o=>{o.name=asmOccName(o.comp);});
  }
  // (une instance sur le chemin de l'instance éditée reste : on ne retire pas la pièce sous les pieds)
  const gone=owner.occ.filter(o=>o.pat&&!keep.has(o.id)&&!(asm.path||[]).includes(o.id)).map(o=>o.id);
  if(gone.length){
    ch=true;
    const G=new Set(gone);
    owner.occ=owner.occ.filter(o=>!G.has(o.id));
    // ce qui s'alignait sur une instance disparue garde sa position
    asm.comps.forEach(c=>c.occ.forEach(q=>{const a=q.align;
      if(a&&((a.dst&&a.dst.path.some(x=>G.has(x)))||(a.src&&a.src.path.some(x=>G.has(x)))))q.align=null;}));
  }
  return ch;
}
function asmPatOf(o){
  // Répétition dont l'occurrence est une instance → {owner, pat} ou null
  if(!o||!o.pat)return null;
  const owner=asmOccOwner(o.id);const p=owner&&(owner.pats||[]).find(q=>q.id===o.pat.id);
  return p?{owner,pat:p}:null;
}
function asmPatOnDelete(owner,o){
  // Suppression d'une occurrence (asmDeleteOcc, 46) : instance → notée dans skip (elle ne revient
  // pas) ; source → retirée de ses répétitions (asmPatGen emporte ses instances)
  if(!owner||!o)return;
  if(o.pat){const p=(owner.pats||[]).find(q=>q.id===o.pat.id);if(p){p.skip=p.skip||[];if(p.skip.indexOf(o.pat.k)<0)p.skip.push(o.pat.k);}return;}
  (owner.pats||[]).forEach(p=>{p.src=(p.src||[]).filter(id=>id!==o.id);});
}
function asmPatNew(owner,ids,type){
  // Nouvelle répétition des occurrences ids (enfants directs du porteur, hors instances)
  const src=(ids||[]).filter(id=>owner.occ.some(o=>o.id===id&&!o.pat));
  if(!src.length)return null;
  const n=(owner.pats||[]).length+1;
  // pas proposé : la taille de la première source le long de X (sinon 50 mm)
  let dist=50;
  try{const s=asmOcc(src[0]),c=s&&asmComp(s.comp);
    if(c&&c._snap&&typeof asmSnapBox==='function'){const b=asmSnapBox(c._snap);if(!b.isEmpty())dist=Math.max(5,Math.ceil(1.2*(b.max.x-b.min.x)));}}catch(e){}
  const p={id:uid('pt'),name:'Répétition '+n,type:ASM_PAT_TYPES[type]?type:'lin',src,ref:{cg:null},axis:type==='circ'?'Z':'X',
    copies:type==='mir'?1:2,dist,angle:360,skip:[]};
  if(p.type==='path')asmPatPathInit(owner,p);
  owner.pats=(owner.pats||[]).concat(p);
  return p;
}
function asmPatPathInit(owner,p){
  // Passage au type « suivant un profil » : dernière esquisse guide du porteur, départ proposé
  if(p.path&&p.path.sk)return;
  const G=pgGuideSketches(owner.doc);
  p.path=G.length?pgDefaultPath(G[G.length-1]):{sk:null};
  p.pspace=p.pspace||'fit';p.orient=p.orient||'fixed';
}
function asmPatDelete(owner,pid){
  // Supprime la répétition : ses instances partent, les sources restent
  if(!owner||!owner.pats)return false;
  const n0=owner.pats.length;owner.pats=owner.pats.filter(p=>p.id!==pid);
  if(!owner.pats.length)delete owner.pats;
  if(n0===((owner.pats||[]).length))return false;
  asmPatGen(owner);
  return true;
}
/* ── interface (mode Placer) : panneau d'édition, comme Aligner (asmRenderProps, 47) ──
   Les réglages s'appliquent en direct (les instances sont recalculées à chaque changement) ;
   une étape d'annulation pour toute l'édition ; Annuler / Échap revient à l'état d'avant. */
let asmPatEd=null; // {owner, pat, before} : répétition ouverte dans le panneau
function asmPatCur(){
  const o=asmPatEd&&asmComp(asmPatEd.owner),p=o&&(o.pats||[]).find(q=>q.id===asmPatEd.pat);
  return p?{owner:o,pat:p}:null;
}
function asmPatStart(ids,type){
  // Nouvelle répétition des occurrences sélectionnées (enfants directs du composant actif)
  if(asmMode!=='asm')return false;
  const owner=asmActiveComp();if(!owner)return false;
  ids=(ids||[]).filter(id=>owner.occ.some(o=>o.id===id&&!o.pat));
  if(!ids.length){try{faceEl.textContent='Répétition : sélectionnez d’abord une ou plusieurs occurrences (une instance de répétition ne se répète pas : modifiez sa répétition).';}catch(e){}return false;}
  try{if(asmMeas)asmMeasStop(true);}catch(e){}
  asmPush('répétition');
  const p=asmPatNew(owner,ids,type);if(!p){asmUndoStack.pop();return false;}
  asmPatEd={owner:owner.id,pat:p.id,before:null};
  asmResolve();asmNotify();
  try{faceEl.textContent='Répétition de '+ids.length+' occurrence(s) : type, direction, quantité et pas dans le panneau (aperçu en direct) · ✓ OK pour garder · Échap pour annuler.';}catch(e){}
  return p;
}
function asmRibbonPattern(){
  // Bouton du bandeau : mode Placer au besoin (depuis une pièce : son assemblage, elle
  // sélectionnée) ; occurrence ou lot sélectionné → nouvelle répétition ; instance → sa répétition
  if(typeof skEdit!=='undefined'&&skEdit){try{faceEl.textContent='Fermez d’abord l’esquisse.';}catch(e){}return;}
  if(asmMode!=='asm'&&asmEnter()===false)return;
  if(asmPatEd)return;
  const o=asmOcc(asmSelId),R=o&&o.pat?asmPatOf(o):null;
  if(R){asmPatEdit(R.owner.id,R.pat.id);return;}
  const L=asmLotIds();
  if(!L.length){try{faceEl.textContent='Répétition : cliquez d’abord l’occurrence à répéter (Ctrl+clic pour un lot), puis « Répétition ».';}catch(e){}return;}
  asmPatStart(L);
}
function asmPatEdit(ownerId,pid){
  const o=asmComp(ownerId),p=o&&(o.pats||[]).find(q=>q.id===pid);if(!p)return false;
  try{if(asmMeas)asmMeasStop(true);}catch(e){}
  asmPush('modifier « '+(p.name||'répétition')+' »');
  asmPatEd={owner:o.id,pat:p.id,before:JSON.stringify(o.pats)};
  try{renderTree();renderProps();}catch(e){}
  return true;
}
function asmPatSet(fn){
  const P=asmPatCur();if(!P)return;
  fn(P.pat);asmResolve();asmNotify();
}
function asmPatOk(){
  try{pgPickStop();}catch(e){}
  const E=asmPatEd,o=E&&asmComp(E.owner);asmPatEd=null;
  if(E&&E.before!=null&&o&&JSON.stringify(o.pats)===E.before)asmUndoStack.pop(); // rien changé : pas d'étape
  try{renderTree();renderProps();}catch(e){}
}
function asmPatCancel(){
  try{pgPickStop();}catch(e){}
  if(!asmPatEd)return;
  asmPatEd=null;
  if(asmUndo())asmRedoStack.pop(); // l'état d'avant l'édition, sans rien à rétablir
  asmNotify();
  try{faceEl.textContent='Répétition annulée.';}catch(e){}
}
function asmPatDeleteCmd(ownerId,pid){
  const o=asmComp(ownerId),p=o&&(o.pats||[]).find(q=>q.id===pid);if(!p)return;
  const n=o.occ.filter(q=>q.pat&&q.pat.id===pid).length;
  if(!confirm('Supprimer « '+(p.name||'Répétition')+' » ? Ses '+n+' instance(s) partent, les sources restent (Ctrl+Z pour annuler).'))return;
  if(asmPatEd&&asmPatEd.pat===pid){asmPatEd=null;asmUndoStack.pop();} // l'étape de l'édition ouverte devient celle de la suppression
  asmPush('supprimer « '+(p.name||'répétition')+' »');
  asmPatDelete(o,pid);asmResolve();
  if(asmSelId&&!asmOcc(asmSelId))asmSelId=null;
  asmNotify();
}
function asmPatProps(p){
  // Panneau de la répétition ouverte → true s'il a été dessiné
  const P=asmPatCur();if(!P){asmPatEd=null;return false;}
  const {owner,pat}=P;
  const mk=(tag,cls,txt)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d;};
  const Row=(lab,ctl)=>{const r=mk('div','pnl-row');r.appendChild(mk('label',null,lab));if(ctl)r.appendChild(ctl);p.appendChild(r);return r;};
  const sel=(opts,v,fn)=>{const s=document.createElement('select');opts.forEach(([k,t])=>{const o=document.createElement('option');o.value=k;o.textContent=t;if(k===v)o.selected=true;s.appendChild(o);});s.onchange=()=>fn(s.value);return s;};
  const num=(v,fn,int)=>{const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.style.width='64px';i.value=String(+(+v).toFixed(3)).replace('.',',');
    const go=()=>{const x=parseFloat(String(i.value).replace(',','.'));if(isFinite(x))fn(int?Math.round(x):x);};i.addEventListener('change',go);i.addEventListener('keydown',e=>{if(e.key==='Enter')go();});return i;};
  const chk=(v,fn)=>{const c=document.createElement('input');c.type='checkbox';c.checked=!!v;c.onchange=()=>fn(c.checked);return c;};
  const cnt=v=>Math.max(1,Math.min(ASM_PAT_MAX,Math.floor(v)-1)); // quantité saisie (original compris) → copies
  const AX=[['X','X'],['Y','Y'],['Z','Z']],PL=[['X','YZ (normale X)'],['Y','XZ (normale Y)'],['Z','XY (normale Z)']];
  p.appendChild(mk('div','pnl-h','🔁 '+(pat.name||'Répétition')+' · '+asmPatName(pat)));
  const n=owner.occ.filter(o=>o.pat&&o.pat.id===pat.id).length;
  p.appendChild(mk('div','pnl-note','Sources : '+pat.src.map(id=>(asmOcc(id)||{}).name||'?').join(', ')+' · '+n+' instance(s)'+(pat.type==='mir'?' (en miroir)':'')));
  if(pat.st==='warn')p.appendChild(mk('div','pnl-note','⚠ '+pat.msg));
  const nm=document.createElement('input');nm.type='text';nm.value=pat.name||'';nm.onchange=()=>asmPatSet(q=>{q.name=nm.value.trim()||q.name;});Row('Nom',nm);
  Row('Type',sel([['lin','Linéaire'],['circ','Circulaire'],['mir','Symétrie'],['path','Suivant un profil']],pat.type,v=>asmPatSet(q=>{
    if(q.type===v)return;q.type=v;
    if(v==='path'){asmPatPathInit(owner,q);if(q.copies<2)q.copies=3;}
    if(v==='circ'){q.axis='Z';if(q.copies<2)q.copies=5;}
    if(v==='mir'){q.copies=1;}
    if(v==='lin'&&q.copies<2)q.copies=2;})));
  // repère de référence : origine du porteur ou un de ses repères de construction (associatif)
  const fr=[['','Origine de « '+owner.name+' »']].concat((owner.doc.cgeo||[]).filter(k=>k&&k.kind==='frame').map(k=>[k.id,k.name]));
  if(pat.type!=='path')Row('Référence',sel(fr,(pat.ref&&pat.ref.cg)||'',v=>asmPatSet(q=>{q.ref={cg:v||null};})));
  if(pat.type==='path'){
    const G=pgGuideSketches(owner.doc),sk=pat.path&&(owner.doc.sketches||[]).find(s=>s.id===pat.path.sk);
    if(!G.length)p.appendChild(mk('div','pnl-note','Aucune esquisse de « '+owner.name+' » ne contient de ligne, d’arc ou de spline : en mode Modéliser, dessinez la courbe guide (ou projetez des arêtes des composants) en la faisant passer par le centre de la pièce à répéter.'));
    else{
      Row('Courbe guide',sel([['','— choisir —']].concat(G.map(k=>[k.id,k.name||k.id])),sk?sk.id:'',v=>asmPatSet(q=>{const k=(owner.doc.sketches||[]).find(s=>s.id===v);q.path=k?pgDefaultPath(k):{sk:null};})));
      if(sk){
        const ch=pgStartChoices(sk),cur=ch.findIndex(o=>pgSameStart(o.v,pat.path));
        Row('Départ',sel(ch.map((o,i)=>[String(i),o.label]).concat(cur<0?[['-1','(départ actuel)']]:[]),String(cur),v=>asmPatSet(q=>{const o=ch[+v];if(o)q.path=Object.assign({sk:sk.id},o.v);})));
        Row('',repPathPickBtn(owner.doc,fn=>asmPatSet(fn),sk.id));
      }else Row('Départ',repPathPickBtn(owner.doc,fn=>asmPatSet(fn),null));
    }
    Row('Quantité',num(pat.copies+1,v=>asmPatSet(q=>{q.copies=cnt(v);}),true));
    const P=asmPatPlan(owner,pat);
    Row('Espacement',sel([['fit','Réparti sur la longueur'],['pitch','Pas imposé']],pat.pspace==='pitch'?'pitch':'fit',v=>asmPatSet(q=>{
      q.pspace=v;if(v==='pitch')q.dist=P.step>0?+P.step.toFixed(3):(q.dist||10);})));
    if(pat.pspace==='pitch')Row('Pas le long de la courbe (mm)',num(pat.dist,v=>asmPatSet(q=>{if(v>0)q.dist=v;})));
    Row('Orientation',sel([['fixed','Fixe (translation)'],['tangent','Suit la tangente']],pat.orient==='tangent'?'tangent':'fixed',v=>asmPatSet(q=>{q.orient=v;})));
    const bi=mk('button','mini','⇄ Inverser le sens');bi.onclick=()=>asmPatSet(q=>{if(q.rev)delete q.rev;else q.rev=true;});Row('Sens',bi);
    const f=v=>String(+(+v).toFixed(3)).replace('.',',');
    if(!P.err)p.appendChild(mk('div','pnl-note','Longueur de la courbe : '+f(P.L)+' mm · '+(P.closed?'fermée':'ouverte')+' · pas '+f(P.step)+' mm'+(P.warn?' — ⚠ '+P.warn:'')));
    p.appendChild(mk('div','pnl-note','La pièce suit la courbe depuis le départ (tracez la courbe par son centre). Courbe fermée : la dernière instance s’arrête un pas avant le départ. Quantité = original compris.'));
  }else if(pat.type==='lin'){
    Row('Direction',sel(AX,pat.axis,v=>asmPatSet(q=>{q.axis=v;})));
    Row('Quantité',num(pat.copies+1,v=>asmPatSet(q=>{q.copies=cnt(v);}),true));
    Row('Pas (mm)',num(pat.dist,v=>asmPatSet(q=>{q.dist=v;})));
    Row('2ᵉ direction',chk(pat.lin2,v=>asmPatSet(q=>{if(v){q.lin2=true;q.axis2=q.axis2||(q.axis==='X'?'Y':'X');q.copies2=q.copies2||1;if(q.dist2==null)q.dist2=q.dist;}else{delete q.lin2;}})));
    if(pat.lin2){
      Row('Direction 2',sel(AX,pat.axis2,v=>asmPatSet(q=>{q.axis2=v;})));
      Row('Quantité 2',num((pat.copies2||1)+1,v=>asmPatSet(q=>{q.copies2=cnt(v);}),true));
      Row('Pas 2 (mm)',num(pat.dist2||0,v=>asmPatSet(q=>{q.dist2=v;})));
    }
    p.appendChild(mk('div','pnl-note','Pas négatif = sens inverse. Quantité = original compris.'));
  }else if(pat.type==='circ'){
    Row('Axe',sel(AX,pat.axis,v=>asmPatSet(q=>{q.axis=v;})));
    Row('Quantité',num(pat.copies+1,v=>asmPatSet(q=>{q.copies=cnt(v);}),true));
    Row('Angle total (°)',num(pat.angle,v=>asmPatSet(q=>{q.angle=v||360;})));
    p.appendChild(mk('div','pnl-note','Autour de l’axe passant par l’origine de la référence · 360° = tour complet réparti.'));
  }else{
    Row('Plan',sel(PL,pat.axis,v=>asmPatSet(q=>{q.axis=v;})));
    Row('Symétrie double',chk(!!pat.plane2,v=>asmPatSet(q=>{if(v)q.plane2=q.axis==='X'?'Y':'X';else delete q.plane2;})));
    if(pat.plane2)Row('Plan 2',sel(PL,pat.plane2,v=>asmPatSet(q=>{q.plane2=v;})));
    p.appendChild(mk('div','pnl-note','Vraie symétrie : la pièce est en miroir (un filetage à droite devient à gauche).'));
  }
  if((pat.skip||[]).length){
    const b=mk('div','pnl-btns'),r=mk('button','mini','↺ Rétablir '+pat.skip.length+' instance(s) supprimée(s)');
    r.onclick=()=>asmPatSet(q=>{q.skip=[];});b.appendChild(r);p.appendChild(b);
  }
  const b=mk('div','pnl-btns');
  const ok=mk('button','primary','✓ OK');ok.onclick=asmPatOk;b.appendChild(ok);
  const an=mk('button',null,'Annuler');an.title='Revenir à l’état d’avant (Échap)';an.onclick=asmPatCancel;b.appendChild(an);
  const dl=mk('button','danger','🗑 Supprimer');dl.title='Supprimer la répétition (les sources restent)';dl.onclick=()=>asmPatDeleteCmd(owner.id,pat.id);b.appendChild(dl);
  p.appendChild(b);
  return true;
}
function asmPatOccProps(p,o){
  // Panneau de placement d'une instance : sa position est imposée par la répétition (48-assemblage-placement)
  const R=asmPatOf(o);
  const mk=(tag,cls,txt)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d;};
  p.appendChild(mk('div','pnl-h','Placement'));
  p.appendChild(mk('div','pnl-note','🔁 Instance de « '+(R?R.pat.name||'Répétition':'?')+' »'+(R?' ('+asmPatName(R.pat)+')':'')+' : position imposée par la répétition — elle suit sa source.'));
  if(R){const b=mk('div','pnl-btns'),e=mk('button','primary','🔁 Modifier la répétition');e.onclick=()=>asmPatEdit(R.owner.id,R.pat.id);b.appendChild(e);p.appendChild(b);}
}
