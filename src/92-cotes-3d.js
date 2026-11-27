/* ══ COTES 3D PILOTANTES (V1.0.20, essayées d'abord sur la branche locale essai/cotes-3d) ══
   Fred, 27/11 : « un outil de cotation dans le monde CAO, mais sur la 3D… ces cotes pilotent le 3D…
   je dessine dans le sketch, et je mets les cotes dans le 3D, un peu comme le fait Inventor… toutes les
   propriétés qui existent dans la mise en plan » ; intégrées à ConceptCAD le 27/11 (« tu peux commiter dans ConceptCAD »).
   • Outil Cote 3D (bouton de la barre de vue, touche D hors esquisse) : clic sur 2 faces (plans
     parallèles, entraxe de 2 cylindres, axe ↔ face) ou sur un cylindre puis « Coter le Ø ». Les faces
     sont retenues par leur nom unique (20-05), comme les paramètres mesurés (51-parametres-mesure) : la
     cote les suit quand la pièce change.
   • LA VALEUR EST TOUJOURS LUE SUR LA PIÈCE (relue à chaque fin de rejeu). Une cote PILOTANTE dit en plus
     quel réglage changer quand on tape une autre valeur : une cote d'esquisse (sk.dims) ou un réglage de
     fonction (distance d'extrusion, Ø ou profondeur de perçage). Une cote de référence ne fait que lire.
   • « Qu'est-ce qui bouge ? » : les réglages qui changent la cote, trouvés par les noms des faces
     (fonction, esquisse, entité) ; pour une esquisse, chaque cote est essayée sur une copie de l'esquisse
     (le solveur seul, sans rejeu) et gardée si elle déplace ce que l'on cote. Un réglage n'est piloté
     que par une seule cote 3D ; un réglage déjà tenu est proposé « à la place de … ».
   • Nouvelle valeur : méthode de la sécante sur le vrai rejeu (le réglage change, la pièce est rejouée,
     la cote relue) jusqu'à 1/10 000 mm ; la pente est gardée pour la fois suivante. Refus du solveur,
     rejeu en échec ou cote qui ne bouge pas : le réglage revient et la raison est dite. Une seule
     annulation (Ctrl+Z).
   • Propriétés de la mise en plan, mêmes données (d.tol {m:'pm'|'dbl'|'cls', s, hi, lo, cls}, cadres
     d.gdt[] {sym, dia, val, mod, refs:[{l,m}]}) : la mise en plan pourra les reprendre telles quelles.
   Fichiers : doc.cotes3d (enregistré), dessin par-dessus la vue (#c3Layer), une ligne dans 10 animate
   (c3Render), une dans buildDone (c3AfterBuild), une dans le clic de la vue (90-10). */
const C3_BLEU='#4da3ff',C3_GRIS='#a3aab5',C3_ORANGE='#ff9f0a',C3_ROUGE='#ff6b5e';
// fond clair (thème Clair) : mêmes rôles, tons foncés (Fred, 27/11 : « mieux visible en fonction du fond »)
const C3_CLAIR={bleu:'#0a5fc0',gris:'#4f5866',orange:'#c96a00',rouge:'#d0303a',note:'#1c2430'};
function c3Col(k){if(c3.clair)return C3_CLAIR[k];return k==='bleu'?C3_BLEU:k==='gris'?C3_GRIS:k==='orange'?C3_ORANGE:k==='rouge'?C3_ROUGE:'#e8edf5';}
function c3FondClair(){
  // luminance du fond de la scène (thème) → true si clair
  try{const b=scene&&scene.background;if(!b||!b.isColor)return false;return 0.2126*b.r+0.7152*b.g+0.0722*b.b>0.45;}catch(e){return false;}
}
const C3_GDT=[['straight','⏤','Rectitude'],['flat','⏥','Planéité'],['circ','○','Circularité'],['cyl','⌭','Cylindricité'],
  ['pline','⌒','Forme d’une ligne'],['psurf','⌓','Forme d’une surface'],['par','∥','Parallélisme'],['perp','⟂','Perpendicularité'],
  ['ang','∠','Inclinaison'],['pos','⌖','Localisation'],['conc','◎','Coaxialité'],['sym','⌯','Symétrie'],
  ['runc','↗','Battement circulaire'],['runt','⌰','Battement total']];
const C3_GDT_FORME=new Set(['straight','flat','circ','cyl']); // jamais de référence (comme la mise en plan)
const C3_GDT_REF=new Set(['par','perp','ang','conc','sym','runc','runt']); // référence obligatoire
const C3_MODS=[['','—'],['M','Ⓜ'],['L','Ⓛ'],['E','Ⓔ'],['P','Ⓟ'],['F','Ⓕ'],['CZ','CZ']];
const C3_LETTERS='ABCDEFGHJKLMNPRSTUVWXYZ';
const C3_RGH_PARS=['Ra','Rz','Rt','Rmax','Rq','Rp','Rv'];
const C3_RGH_PROC=[['remove','Enlèvement de matière exigé'],['any','Tout procédé'],['forbid','Enlèvement interdit']];
const C3_NOTE=new Set(['datum','rough']); // annotations posées sur une face (pas de valeur)
function c3IsNote(d){return !!(d&&C3_NOTE.has(d.k));}
const C3_CLS=['H7','H8','H9','H11','G7','F7','JS7','K7','N7','P7','h6','h7','h9','g6','f7','js6','k6','m6','n6','p6','H7/g6','H7/h6','H7/k6','H7/p6','H8/f7'];
let c3Tool=null; // outil en cours : {a:null|{ref,cy}} — lu par le clic de la vue (90-10)
const c3={sel:null,layer:null,svg:null,els:new Map(),band:null,card:null,edit:null,drag:null,msg:'',msgBad:false,msgT:0,btn:null,cardK:'',seq:0};
const C3G=new WeakMap(); // cote → dernière lecture {v, k, p1, p2, n, c, a, r, X} (jamais enregistrée)
function c3List(){if(typeof doc==='undefined'||!doc)return[];if(!Array.isArray(doc.cotes3d))doc.cotes3d=[];return doc.cotes3d;}
function c3Ws(){try{return (document.body&&document.body.dataset.ws)||'cao';}catch(e){return 'cao';}}
function c3Now(){return typeof performance!=='undefined'?performance.now():Date.now();}
function c3Wake(){try{if(typeof viewWake==='function')viewWake();}catch(e){}}
function c3Say(t,bad){c3.msg=t||'';c3.msgBad=!!bad;c3.msgT=c3Now();c3BandSync();c3Wake();}
function c3Esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
/* ── nombres et texte, comme la mise en plan ── */
function c3Num(v,prec){
  if(!isFinite(+v))return '?';
  if(prec!=null&&prec!=='')return (+v).toFixed(+prec).replace('.',',');
  return String(+(+v).toFixed(3)).replace('.',',');
}
function c3Sgn(v){const x=+v||0;if(Math.abs(x)<1e-9)return '0';return (x>0?'+':'−')+c3Num(Math.abs(x));}
function c3TolRange(d,v){
  // écarts {hi, lo} en mm, ou null (ajustement H7/g6 : la classe seule)
  const t=d&&d.tol;if(!t||!t.m)return null;
  if(t.m==='pm')return (+t.s>0)?{hi:+t.s,lo:-t.s}:null;
  if(t.m==='dbl')return {hi:+t.hi||0,lo:+t.lo||0};
  if(t.m==='cls'&&t.cls&&String(t.cls).indexOf('/')<0&&typeof iso286Range==='function'){try{return iso286Range(String(t.cls),Math.abs(v))||null;}catch(e){return null;}}
  return null;
}
function c3Mid(d,v){const r=c3TolRange(d,v);return r?v+(r.hi+r.lo)/2:v;}
function c3AutoPre(d){
  // « 2× » devant le Ø d'un trou fait par un cercle d'esquisse quand l'esquisse a plusieurs cercles pareils
  if(!d||d.k!=='dia'||typeof doc==='undefined')return '';
  const o=c3Owner(d.a&&d.a.nom);if(!o)return '';
  if(o.what==='trou'){ // Perçage : ses centres × la répétition (mise en plan ; en 3D la cote du trou le dit elle-même)
    const fh=c3Feat(o.fid);if(!fh||fh.type!=='hole')return '';let m=1;
    try{const sk=c3Sk(fh.sketchId);if(sk&&typeof holePoints==='function')m=Math.max(1,holePoints(sk).length);}catch(e){}
    const rq=c3RepOf(o.fid);if(rq)m*=c3RepCount(rq);return m>1?m+'× ':'';}
  if(o.what!=='flanc'||!o.ent)return '';
  const f=c3Feat(o.fid),sk=f&&c3Sk(f.sketchId);if(!sk)return '';
  const c=(sk.entities||[]).find(e=>e&&e.id===o.ent);if(!c||c.t!=='circle')return '';
  let n=(sk.entities||[]).filter(e=>e&&e.t==='circle'&&!e.construction&&Math.abs(+e.r-(+c.r))<1e-6).length;
  const rp=c3RepOf(o.fid);if(rp)n*=c3RepCount(rp); // répété : « 6× Ø12 »
  return n>1?n+'× ':'';
}
/* ── répétition (Fred, 27/11 : piloter nombre et pas) ── */
function c3FeatSrc(fid){
  // une instance de répétition → sa source (ses réglages seraient écrasés au rejeu)
  let f=c3Feat(fid);if(f&&f.repeatId&&f._src)f=c3Feat(f._src)||f;return f;
}
function c3RepOf(fid){
  // répétition (linéaire, circulaire, le long d'une courbe) dont fid est la source ou une instance
  const f=c3Feat(fid);if(!f)return null;
  const rp=f.repeatId?c3Feat(f.repeatId):(doc.features||[]).find(x=>x&&x.type==='repeat'&&Array.isArray(x.base)&&x.base.indexOf(fid)>=0);
  return rp&&rp.type==='repeat'&&rp.mode!=='mir'&&rp.visible!==false?rp:null;
}
function c3PolarRep(d){
  // entraxe de deux trous d'une même répétition circulaire : la cote peut devenir l'angle autour de son axe ;
  // trou ↔ face plane parallèle à l'axe : l'angle du trou depuis cette face (« la localisation des trous / à une ref »)
  if(!d||d.polar||!d.a||!d.b||d.a.edge||d.b.edge||d.a.vtx||d.b.vtx)return null;
  if(d.k==='axe'){const ra=c3CircRep(d.a),rb=c3CircRep(d.b),rq=ra||rb;if(!rq||(ra&&rb))return null;
    const g=C3G.get(d);if(!g||!g.n||typeof repAxisVec!=='function')return null;
    return Math.abs(g.n.dot(c3V(repAxisVec(rq)).normalize()))<0.02?rq:null;}
  if(d.k!=='entraxe')return null;
  const oa=c3Owner(d.a.nom),ob=c3Owner(d.b.nom);if(!oa||!ob)return null;
  const ra=c3RepOf(oa.fid),rb=c3RepOf(ob.fid);
  return ra&&rb&&ra.id===rb.id&&ra.mode==='circ'?ra:null;
}
function c3MakePolar(){
  // bouton « Angle autour de l'axe » : l'entraxe qu'on vient de poser devient le pas angulaire (même faces)
  const ch=c3.choice;if(!ch)return;const d=ch.d,rp=c3PolarRep(d);if(!rp)return;
  const k0=d.k;d.k='angle';d.polar=rp.id;d.drive=null;delete d.slope;
  const g=c3Refresh(d);
  if(!g||g.err){d.k=k0;delete d.polar;c3Refresh(d);c3Say('Angle illisible'+(g&&g.err?' : '+g.err:'')+'.',true);return;}
  const el=c3.els.get(d.id);if(el){el.g.remove();el.lab.remove();c3.els.delete(d.id);}
  c3.choice=null;c3.cardK='';c3AskDrive(d,!!ch.neuve);
}
function c3RepCount(rp){try{return parHolderVal(rp,'qty')*(rp.mode==='lin'&&rp.lin2?parHolderVal(rp,'qty2'):1);}catch(e){return 1;}}
function c3RepOfCote(d){
  for(const r of [d&&d.a,d&&d.b]){const o=r&&c3Owner(r.nom);if(!o)continue;const rp=c3RepOf(o.fid);if(rp)return rp;}
  return null;
}
/* ── cercle de trous (Fred, 27/11 : « la vraie norme ISO avec le Diamètre de perçage, tous les axes, donc l'axe de
   perçage et la localisation des trous / à une ref ou un cercle ou trou sur le diamètre du perçage ») :
   · Ø de perçage (cote k 'pcd', d.polar = la répétition) : cercle d'axe en trait mixte au bout des trous, traits d'axe
     du centre à travers chaque trou, axes des trous et de la répétition ; pilote la cote d'esquisse qui place le trou ;
   · « 6× Ø6 EQS » quand les trous font le tour complet (ISO 129-1) : plus de pas angulaire posé à la création ;
   · angle d'un trou depuis une face plane parallèle à l'axe (la référence) : trou ↔ face → « Angle depuis la face » ;
   · ⌖ Localisation ISO (ISO 1101 / 5459) : référence A = face d'entrée des trous, B = alésage (ou cylindre) centré sur
     l'axe, cadre « ⌖ Ø0,1 A B » sur le Ø des trous, Ø de perçage et angles encadrés (théoriquement exacts). ── */
function c3CircRep(ref){
  // trou (cylindre) d'une répétition circulaire → la répétition
  const o=ref&&!ref.edge&&!ref.vtx?c3Owner(ref.nom):null;if(!o)return null;
  const rp=c3RepOf(o.fid);return rp&&rp.mode==='circ'?rp:null;
}
function c3RepFull(rp){return !!rp&&rp.mode==='circ'&&Math.abs(+rp.angle||360)>=360-1e-6;}
function c3Eqs(d){
  // « EQS » derrière le Ø des trous également répartis sur un tour complet
  if(!d||d.k!=='dia'||(d.a&&d.a.edge)||c3IsRad(d))return false;
  const rp=c3CircRep(d.a);return c3RepFull(rp)&&c3RepCount(rp)>=3;
}
function c3PcdOf(rp){return rp?c3List().find(x=>x&&x.k==='pcd'&&x.polar===rp.id)||null:null;}
function c3FitCand(C,v){
  // réglage libre qui vaut la cote (ou son rayon) et la fait bouger : celui que la cote pilote d'office
  return C.find(c=>{if(!c||c.held||!c.drv||c.drv.t==='newdim'||(c.s!=null&&Math.abs(c.s)<0.3))return false;
    const u=Math.abs(c3DrvGet(c.drv)),t=1e-3*Math.max(1,v);return isFinite(u)&&(Math.abs(u-v)<t||Math.abs(2*u-v)<t);})||null;
}
function c3PcdNew(ref,rp){
  // nouvelle cote de Ø de perçage (pas encore dans la liste) → la cote | {err}
  const d=c3New(ref,null,'pcd');d.polar=rp.id;const g=c3Read(d);
  if(!g||g.err||!isFinite(+g.v))return {err:(g&&g.err)||'mesure impossible'};
  d.v=+g.v;C3G.set(d,g);
  let C=[];try{C=c3Candidates(d);}catch(e){C=[];}
  const c=c3FitCand(C,d.v);if(c){d.drive=c.drv;if(c.s!=null)d.slope=c.s;}
  return d;
}
function c3MakePcd(ref){
  // bouton « Ø de perçage » (outil, ou carte de la cote d'un trou)
  const rp=c3CircRep(ref);if(!rp){c3Say('Ø de perçage : ce trou n’est pas dans une répétition circulaire.',true);return;}
  if(c3Tool)c3ToolStop();
  const same=c3PcdOf(rp);if(same){c3Select(same);c3Say('Le Ø de perçage de cette répétition est déjà coté.');return;}
  const d=c3PcdNew(ref,rp);if(d.err){c3Say('Ø de perçage : '+d.err+'.',true);return;}
  c3Add(d);
  if(d.drive)c3Say('Ø de perçage '+c3Num(d.v)+' — pilote '+c3DrvLib(d.drive)+'.');else c3AskDrive(d,true);
}
function c3IsoOk(d){return !!d&&(d.k==='pcd'||(d.k==='dia'&&!(d.a&&d.a.edge)&&!c3IsRad(d)&&!!c3CircRep(d.a)));}
/* angle d'un trou depuis l'axe horizontal du cercle de trous (Fred, 27/11 : « il faut la cote d'angle / à un axe,
   généralement l'axe horizontal, et au moins l'angle du pas ») : cote k 'angle', d.polar = la répétition, d.hax,
   d.b vide ; ↻ (d.hv) : depuis l'axe vertical. Trou sur l'axe : 0°, donné par le trait d'axe, pas de cote. */
function c3HaxOf(rp){return rp?c3List().find(x=>x&&x.k==='angle'&&x.hax&&x.polar===rp.id)||null:null;}
function c3HaxNew(ref,rp){
  // nouvelle cote d'angle depuis l'axe (pas encore dans la liste) → la cote | {err}
  const d=c3New(ref,null,'angle');d.polar=rp.id;d.hax=true;const g=c3Read(d);
  if(!g||g.err||!isFinite(+g.v))return {err:(g&&g.err)||'mesure impossible'};
  if(+g.v<0.01||Math.abs(+g.v-90)<0.01)return {err:'le trou est sur un axe du cercle (0°, donné par le trait d’axe)',zero:true};
  d.v=+g.v;C3G.set(d,g);
  let C=[];try{C=c3Candidates(d);}catch(e){C=[];}
  const c=C.find(c=>c&&!c.held&&c.drv&&c.drv.t==='dim'&&c.s!=null&&Math.abs(c.s)>=0.3);if(c){d.drive=c.drv;d.slope=c.s;}
  return d;
}
function c3MakeHax(ref){
  // bouton « Angle depuis l'axe » (outil sur un trou d'un cercle, ou carte de la cote d'un trou / du Ø de perçage)
  const rp=c3CircRep(ref);if(!rp){c3Say('Angle depuis l’axe : ce trou n’est pas dans une répétition circulaire.',true);return;}
  if(c3Tool)c3ToolStop();
  const same=c3HaxOf(rp);if(same){c3Select(same);c3Say('L’angle depuis l’axe de ce cercle de trous est déjà coté.');return;}
  const d=c3HaxNew(ref,rp);if(d.err){c3Say('Angle depuis l’axe : '+d.err+'.',!d.zero);return;}
  c3Add(d);
  if(d.drive)c3Say('Angle '+c3Num(d.v)+'° depuis l’axe horizontal — pilote '+c3DrvLib(d.drive)+'.');else c3AskDrive(d,true);
}
function c3IsoLoc(d0){
  // ⌖ Localisation ISO d'un cercle de trous (depuis la cote du Ø des trous ou du Ø de perçage)
  if(!c3IsoOk(d0))return;
  const rp=d0.k==='pcd'?c3Feat(d0.polar):c3CircRep(d0.a);if(!rp||rp.type!=='repeat'){c3Say('Localisation : ce n’est plus un cercle de trous.',true);return;}
  const ref=d0.a;let pcd=c3PcdOf(rp);
  let hole=d0.k==='dia'?d0:c3List().find(x=>x&&x.k==='dia'&&!(x.a&&x.a.edge)&&!c3IsRad(x)&&(c3CircRep(x.a)||{}).id===rp.id)||null;
  const gp=pcd?(C3G.get(pcd)||c3Refresh(pcd)):c3Read(Object.assign(c3New(ref,null,'pcd'),{polar:rp.id}));
  if(!gp||gp.err){c3Say('Localisation : '+((gp&&gp.err)||'cercle de trous illisible')+'.',true);return;}
  const e=gp.e,bd=ref.body,ends=[gp.p.clone().addScaledVector(e,gp.hl),gp.p.clone().addScaledVector(e,-gp.hl)];
  // Perçage fraisé, lamé ou étagé : le cylindre coté s'arrête sous la fraisure / le lamage — la face d'entrée est plus
  // haut de la hauteur de l'entrée (fraisure : (Ø fraisure − Ø) / 2 / tan(angle / 2))
  try{const f=(c3HoleOf(hole)||{}).f;let x=0;
    if(f&&f.kind==='csink'&&+f.csD>+f.d)x=(+f.csD-+f.d)/2/Math.tan((+f.csA||90)*Math.PI/360);
    else if(f&&f.kind==='cbore')x=+f.cbH||0;else if(f&&f.kind==='step')x=+f.stH||0;
    if(x>0)ends.push(gp.p.clone().addScaledVector(e,gp.hl+x),gp.p.clone().addScaledVector(e,-gp.hl-x));}catch(err){}
  const dOn=nom=>c3List().find(x=>x&&x.k==='datum'&&x.a&&x.a.nom===nom)||null;
  // faces du corps : A = plane ⊥ axe à un bout des trous (la plus grande ; une référence déjà posée d'abord),
  // B = cylindre centré sur l'axe de la répétition (une référence déjà posée d'abord, sinon le plus petit : l'alésage)
  let A=null,aS=-1e18,B=null,bS=-1e18;
  c3AutoFaces('').filter(x=>!bd||x.bd.id===bd).slice(0,240).forEach(x=>{
    if(/^(congé|chanfrein)\[/.test(x.nom))return;
    const r=c3AutoRef(x);if(!r)return;const M=parMesFace(r);if(!M)return;
    try{const s=occSurfDesc(M.face),b=c3Box(M.face);if(!s)return;
      if(s.k==='pl'){const n=c3V(s.n).normalize(),p=c3V(s.p);if(Math.abs(n.dot(e))<0.999)return;
        if(!ends.some(q=>Math.abs(n.dot(p.clone().sub(q)))<0.02))return; // la boîte du trou déborde de la tolérance OCCT (≈ 0,004)
        const sc=(dOn(x.nom)?1e12:0)+(b?b.h.lengthSq()-Math.pow(c3Half(b.h,e),2):0)+1e-6*e.dot(p);
        if(sc>aS){aS=sc;A=r;}}
      else if(s.k==='cy'){const a=c3V(s.a).normalize(),p=c3V(s.p);if(Math.abs(a.dot(e))<0.999)return;
        if(p.clone().addScaledVector(e,-e.dot(p)).length()>1e-3)return;
        const sc=(dOn(x.nom)?1e12:0)-(+s.r||0);
        if(sc>bS){bS=sc;B=r;}}
    }catch(err){}finally{occFree(M.face);}
  });
  try{docPushUndo('Localisation ISO du cercle de trous');}catch(e){}
  const mk=(r,cy)=>{const x=c3New(r,null,'datum');x.l=c3NextLetter();
    // sur un cylindre : la lettre en haut à gauche de son cercle (à 135° autour de l'axe), pas sur le trait de Ø de perçage
    if(cy){try{const M=parMesFace(r),b=M&&c3Box(M.face);if(M)occFree(M.face);
      if(b){let t=new THREE.Vector3(-1,1,0.3);t.addScaledVector(e,-e.dot(t));if(t.lengthSq()<1e-6)t.set(1,0,0).addScaledVector(e,-e.x);t.normalize();
        const v=e.clone().multiplyScalar(e.dot(b.c)).add(t).sub(b.c);x.at=[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)];}}catch(err){}}
    else{try{const M=parMesFace(r),b=M&&c3Box(M.face);if(M)occFree(M.face); // face plane : hors du cercle de trous, vers l'avant droit
      if(b){let t=new THREE.Vector3(1,-1,0.3);t.addScaledVector(e,-e.dot(t));if(t.lengthSq()<1e-6)t.set(0,1,0).addScaledVector(e,-e.y);t.normalize();
        const k=Math.min(c3Half(b.h,t)*0.6,gp.r+gp.hr+8),v=gp.p.clone().addScaledVector(e,e.dot(b.c.clone().sub(gp.p))).addScaledVector(t,k).sub(b.c);
        if(k>0)x.at=[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)];}}catch(err){}}
    c3List().push(x);try{c3Refresh(x);}catch(err){}return x;};
  const la=A?(dOn(A.nom)||mk(A)).l:null,lb=B?(dOn(B.nom)||mk(B,true)).l:null;
  // Ø de perçage (posé s'il manque) et cote du Ø des trous (posée s'il manque)
  if(!pcd){const x=c3PcdNew(ref,rp);if(!x.err){x.name=c3NameNext();c3List().push(x);pcd=x;}}
  if(!hole){const h=c3New(ref,null,'dia'),g=c3Read(h);
    if(g&&!g.err&&g.k==='dia'&&!g.rad){h.v=+g.v;C3G.set(h,g);let C=[];try{C=c3Candidates(h);}catch(e){C=[];}
      const c=c3FitCand(C,h.v);if(c){h.drive=c.drv;if(c.s!=null)h.slope=c.s;}h.name=c3NameNext();c3List().push(h);hole=h;}}
  // le cadre ⌖ sur le Ø des trous ; le Ø de perçage et les angles autour de l'axe : théoriquement exacts
  if(hole){hole.gdt=hole.gdt||[];if(!hole.gdt.some(f=>f&&f.sym==='pos'))hole.gdt.push({sym:'pos',dia:true,val:0.1,mod:'',refs:[la,lb].filter(Boolean).map(l=>({l,m:''}))});}
  if(!c3HaxOf(rp)){const x=c3HaxNew(ref,rp);if(!x.err){x.name=c3NameNext();c3List().push(x);}}
  c3List().forEach(x=>{if(x&&(x===pcd||(x.k==='angle'&&x.polar===rp.id)))x.fmt='box';});
  try{c3Dirty();}catch(e){}c3.els.forEach(el=>{el.html=null;});c3.cardK='';if(c3.hidden)c3Hide(false);
  c3Select(hole||pcd);
  c3Say('Localisation ISO : '+(la?'référence '+la+' (face d’entrée)':'pas de face d’entrée plane')+(lb?', '+lb+' (cylindre centré sur l’axe)':'')
    +' ; ⌖ Ø0,1 '+[la,lb].filter(Boolean).join(' ')+' sur les trous ; Ø de perçage'+(c3List().some(x=>x.k==='angle'&&x.polar===rp.id)?' et angles':'')+' encadrés.');
}
function c3ShellOf(refs){
  // coque de la face « …/int » : la dernière coque (évidage) du corps
  const bd=(refs.find(r=>r&&r.body)||{}).body;
  const L=(doc.features||[]).filter(x=>x&&x.type==='xshell'&&x.kind!=='souffle'&&x.visible!==false&&(!bd||!x.body||x.body===bd));
  return L.length?L[L.length-1]:null;
}
function c3Name(d){
  // nom de la cote (« d1 », « Épaisseur ») : donné, sinon dN selon son rang
  if(d&&d.name)return String(d.name);
  const i=c3List().indexOf(d);return 'd'+(i>=0?i+1:'?');
}
function c3NameNext(){let m=0;c3List().forEach(x=>{const r=/^d(\d+)$/.exec(String(x.name||''));if(r)m=Math.max(m,+r[1]);});return 'd'+(Math.max(m,c3List().length)+1);}
function c3TextParts(d,v){
  // → {main, sym, up, lo, par} (même découpe que les cotes de la mise en plan)
  const pre=((d._nohole?'':c3AutoPre(d))+(d.pre?String(d.pre).trim():'')).trim();
  const post=[d.post?String(d.post).trim():'',!d._nohole&&c3Eqs(d)?'EQS':''].filter(Boolean).join(' '); // « 6× Ø6 EQS »
  const join=(a,b)=>a&&b?a+' '+b:(a||b);
  const deg=d.k==='angle'?'°':'',val=c3IsCham(d)?c3ChamTxt(d,v):(d.k==='dia'||d.k==='pcd'?(c3IsRad(d)?'R':'Ø'):'')+c3Num(v,d.prec)+deg;
  // affichage (Fred, 27/11 : nom de cote) : valeur, nom, nom = valeur
  const base=d.show==='nom'?c3Name(d):d.show==='both'?c3Name(d)+' = '+val:val;
  // cote encadrée (théoriquement exacte, ISO 1101) : jamais de tolérance ; nom seul : pas de tolérance non plus
  const t=d.fmt==='box'||d.show==='nom'?{}:(d.tol||{});
  if(t.m==='pm'&&+t.s>0)return {main:join(pre,base),sym:'±'+c3Num(t.s)+deg,up:'',lo:'',post};
  if(t.m==='dbl')return {main:join(pre,base),sym:'',up:c3Sgn(t.hi)+deg,lo:c3Sgn(t.lo)+deg,post};
  if(t.m==='cls'&&t.cls){
    const r=c3TolRange(d,v);
    if(r)return {main:join(pre,base+' '+t.cls),sym:'',up:c3Sgn(r.hi),lo:c3Sgn(r.lo),par:true,post};
    return {main:join(join(pre,base+' '+t.cls),post),sym:'',up:'',lo:'',post:''};
  }
  return {main:join(join(pre,base),post),sym:'',up:'',lo:'',post:''};
}
function c3Text(d,v){
  if(d.k==='datum')return d.l||'?';
  const HO=c3HoleOf(d);
  if(HO&&(HO.parts.length>1||HO.n>1))return HO.parts.map((q,i)=>(i===0&&HO.n>1?HO.n+'× ':'')+(q.k===HO.key?c3Text(Object.assign({},d,{_nohole:true,pre:((d.pre||'')+(q.pre?' '+q.pre:'')).trim()}),v).replace(/^\(|\)$/g,'')+(q.suf?' '+q.suf:''):(q.txt||((q.pre||'')+'Ø'+c3Num(q.dia)+(q.suf?' '+q.suf:''))))+(i===0&&HO.eqs?' EQS':'')).join(' | ');
  if(d.k==='rough')return c3RghLabel(d.r);
  // texte d'une ligne (tests, info-bulles) : « 120 ±0,1 », « Ø10 H7 (+0,015 / 0) », « (35) »
  const p=c3TextParts(d,v);let s=p.main;
  if(p.sym)s+=' '+p.sym;
  if(p.up||p.lo)s+=p.par?' ('+p.up+' / '+p.lo+')':' '+p.up+' / '+p.lo;
  if(p.post&&(p.sym||p.up||p.lo))s+=' '+p.post;
  if(d.fmt==='box')return '['+s+']';
  if(d.fmt==='insp'){const I=d.insp||{};return '⟨'+[I.lab,s,I.rate].filter(Boolean).join(' | ')+'⟩';}
  return d.drive?s:'('+s+')';
}
function c3RghLabel(r){r=r||{};const v=+r.val;return (r.par||'Ra')+' '+(isFinite(v)&&v>0?c3Num(v):'?');}
function c3RghSvg(r){
  // symbole ISO 1302 : V à branche longue ; barre = enlèvement exigé, cercle = interdit
  const p=(r&&r.proc)||'remove';
  return '<svg class="rg" viewBox="0 0 22 18" width="22" height="18" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 9 L6 17 L15 1 L21 1"/>'
    +(p==='remove'?'<path d="M1 9 L11 9"/>':'')+(p==='forbid'?'<circle cx="6.3" cy="11" r="2.6"/>':'')+'</svg>';
}
function c3IsRad(d){if(!d||d.k!=='dia')return false;if(d.a&&d.a.edge)return !!d.a.arc;const o=c3Owner(d.a&&d.a.nom);return !!(o&&(o.what==='conge'||o.what==='chanfrein'));}
function c3IsCham(d){if(!d||d.k!=='dia'||(d.a&&d.a.edge))return false;const o=c3Owner(d.a&&d.a.nom);return !!(o&&o.what==='chanfrein');}
function c3ChamTxt(d,v){
  // « 3 × 45° » (distance égale) ; « 3 × 5 » (deux distances)
  const g=typeof C3G!=='undefined'?C3G.get(d):null;
  // chanfrein « distance + angle » : la distance et l'angle, comme dans la fonction (« 3 × 30° »)
  const fd=d&&d.drive&&d.drive.t==='feat'&&typeof c3Feat==='function'?c3Feat(d.drive.f):null;
  if(((fd&&fd.chamfer&&fd.cmode==='da')||(!fd&&d&&d.chs))&&g&&g.cham&&isFinite(g.beta))return c3Num(v,d.prec)+' × '+c3Num(Math.round(g.beta*10)/10)+'°';
  if(g&&g.cham&&isFinite(g.l2)&&Math.abs(g.l2-v)>1e-3*Math.max(1,v))return c3Num(v,d.prec)+' × '+c3Num(g.l2,d.prec);
  return c3Num(v,d.prec)+' × '+c3Num(g&&g.cham&&isFinite(g.beta)?Math.round(g.beta*10)/10:45)+'°';
}
function c3HoleSuf(q){return q.sp==='thru'?'déb.':q.sp==='dep'?'↧'+c3Num(q.dv):q.sp==='ang'?'× '+c3Num(q.dv)+'°':'';}
function c3HoleSufHtml(q){
  // la profondeur (ou l'angle) cliquable : double-clic = nouvelle valeur
  if(!q.dk)return q.suf?'<span class="m">'+c3Esc(q.suf)+'</span>':'';
  const v='<span class="hv" data-hk="'+q.dk+'" title="Double-clic : changer">'+c3Esc(c3Num(q.dv))+'</span>';
  return '<span class="m">'+(q.sp==='ang'?'× '+v+'°':'↧'+v)+'</span>';
}
function c3HoleOf(d){
  // fonction Perçage du cylindre coté (cote Ø) → {f, n (nombre de trous), parts:[{k, pre, dia, suf}|{k:'thread', txt}], key}
  if(!d||d._nohole||d.k!=='dia'||typeof doc==='undefined')return null;
  const o=c3Owner(d.a&&d.a.nom),f=o&&o.what==='trou'?c3Feat(o.fid):null;if(!f||f.type!=='hole')return null;
  // chaque ligne : Ø (k) et sa profondeur (dk, ou « déb. ») — tous pilotables (Fred, 27/11 : « piloter toutes les cotes d'un trou »)
  const thru=f.end==='through',D=(sp,dk,dv)=>Object.assign({sp},dk?{dk,dv:+dv}:{}),P=[];
  const L=(k,pre,dia,sp,dk,dv)=>{const q=Object.assign({k,pre,dia:+dia},D(sp,dk,dv));q.suf=c3HoleSuf(q);return q;};
  if(f.kind==='ream'){P.push(f.pilot==='open'?L('reamD','',f.reamD,'thru'):L('reamD','',f.reamD,'dep','reamH',f.reamH));if(f.pilot&&f.pilot!=='none'&&f.pilot!=='open')P.push(thru?L('d','',f.d,'thru'):L('d','',f.d,'dep','depth',f.depth));}
  else{
    if(f.kind==='step')P.push(L('stD','',f.stD,'dep','stH',f.stH));
    if(f.thread&&f.thread.size&&typeof holeThreadLabel==='function')P.push({k:'thread',txt:holeThreadLabel(f.thread)+(f.thread.len&&(f.thread.lenMode||'len')!=='through'?' ↧'+c3Num(f.thread.len):'')});
    P.push(thru?L('d','',f.d,'thru'):L('d','',f.d,'dep','depth',f.depth));
    if(f.kind==='cbore')P.push(L('cbD','⌴',f.cbD,'dep','cbH',f.cbH));
    if(f.kind==='csink')P.push(L('csD','⌵',f.csD,'ang','csA',f.csA));
  }
  let n=1;try{const sk=c3Sk(f.sketchId);if(sk&&typeof holePoints==='function')n=Math.max(1,holePoints(sk).length);else if(f.place&&Array.isArray(f.place.off))n=Math.max(1,f.place.off.length);}catch(e){}
  {const rp=c3RepOf(o.fid);if(rp)n*=c3RepCount(rp);} // Perçage répété : « 6× »
  const key=d.drive&&d.drive.t==='feat'&&d.drive.f===f.id?d.drive.k:(c3HoleKeys(f,d)[0]||['d'])[0];
  return {f,n,parts:P,key,eqs:c3Eqs(d)};
}
function c3Html(d,v){
  if(d.k==='datum')return '<span class="dt">'+c3Esc(d.l||'?')+'</span>';
  const HO=c3HoleOf(d);
  if(HO&&HO.parts.length>1||HO&&HO.n>1){
    // la cote d'un trou de Perçage dit tout le trou, une ligne par Ø (comme la cotation de perçage du plan)
    let h='';
    HO.parts.forEach((q,i)=>{
      const pre=(i===0&&HO.n>1?HO.n+'× ':''),eq=i===0&&HO.eqs?'<span class="m">EQS</span>':'';
      if(q.k===HO.key){const dd=Object.assign({},d,{_nohole:true,drive:d.drive||{t:'ref'},pre:(pre+(d.pre||'')+(q.pre?' '+q.pre:'')).trim(),gdt:[]}); // pas de parenthèses au milieu du trou
        h+='<span class="hl">'+c3Html(dd,v).replace(/^<span class="v">|<\/span>$/g,'')+c3HoleSufHtml(q)+eq+'</span>';}
      else if(q.txt)h+='<span class="hl o">'+c3Esc(pre+q.txt)+eq+'</span>';
      else h+='<span class="hl o">'+c3Esc(pre+(q.pre?q.pre+' ':''))+'<span class="hv" data-hk="'+q.k+'" title="Double-clic : changer">Ø'+c3Esc(c3Num(q.dia))+'</span>'+c3HoleSufHtml(q)+eq+'</span>';
    });
    h='<span class="hb">'+h+'</span>';
    (d.gdt||[]).forEach(g=>{h+=c3FcfHtml(g);});
    return h;
  }
  if(d.k==='rough')return '<span class="v">'+c3RghSvg(d.r)+'<span class="m">'+c3Esc(c3RghLabel(d.r))+'</span>'+(d.r&&d.r.txt?'<span class="t">'+c3Esc(d.r.txt)+'</span>':'')+'</span>';
  const p=c3TextParts(d,v);
  let h='<span class="m">'+c3Esc(p.main)+'</span>';
  if(p.sym)h+='<span class="t">'+c3Esc(p.sym)+'</span>';
  if(p.up||p.lo)h+=(p.par?'<span class="t">(</span>':'')+'<span class="k"><i>'+c3Esc(p.up)+'</i><i>'+c3Esc(p.lo)+'</i></span>'+(p.par?'<span class="t">)</span>':'');
  if(p.post&&(p.sym||p.up||p.lo))h+='<span class="m">'+c3Esc(p.post)+'</span>';
  if(d.fmt==='box')h='<span class="bx">'+h+'</span>'; // cote encadrée : théoriquement exacte
  else if(d.fmt==='insp'){const I=d.insp||{};h='<span class="ip">'+(I.lab?'<b>'+c3Esc(I.lab)+'</b>':'')+'<span class="iv">'+h+'</span>'+(I.rate?'<b>'+c3Esc(I.rate)+'</b>':'')+'</span>';} // cote d'inspection
  else if(!d.drive)h='<span class="m">(</span>'+h+'<span class="m">)</span>';
  h='<span class="v">'+h+'</span>';
  (d.gdt||[]).forEach(g=>{h+=c3FcfHtml(g);});
  return h;
}
function c3GdtSym(k){const s=C3_GDT.find(x=>x[0]===k);return s?s[1]:'?';}
function c3ModTxt(m){const x=C3_MODS.find(y=>y[0]===m);return m?(x?x[1]:m):'';}
function c3FcfHtml(g){
  const refs=(g.refs||[]).filter(r=>r&&r.l);
  return '<span class="f"><b>'+c3GdtSym(g.sym)+'</b><b>'+(g.dia?'Ø':'')+c3Num(g.val)+(g.mod?' '+c3ModTxt(g.mod):'')+'</b>'
    +refs.map(r=>'<b>'+c3Esc(r.l)+(r.m?' '+c3ModTxt(r.m):'')+'</b>').join('')+'</span>';
}
function c3GdtCheck(g){
  // → message si le cadre est incomplet ou contraire à la norme, sinon ''
  const refs=(g.refs||[]).filter(r=>r&&r.l);
  if(C3_GDT_FORME.has(g.sym)&&refs.length)return 'Une tolérance de forme ne prend pas de référence.';
  if(C3_GDT_REF.has(g.sym)&&!refs.length)return 'Il faut une référence (A, B…).';
  if(!(+g.val>0))return 'Valeur de la zone manquante.';
  return '';
}
/* ── faces : nom → fonction, esquisse, entité ── */
function c3Feat(id){return (doc.features||[]).find(f=>f&&f.id===id)||null;}
function c3Sk(id){return (doc.sketches||[]).find(s=>s&&s.id===id)||null;}
function c3Owner(nom){
  // « ex_3/e6/flanc#2 » → {fid:'ex_3', ent:'e6', what:'flanc'} ; « ex_3/haut » → {what:'haut'} ;
  // « hl_5/c0/s1/f2 » → {what:'trou'} ; « xf_4[…] » → {what:'conge'}
  let n=String(nom||'');if(!n)return null;
  let int=false;if(/\/int$/.test(n)){int=true;n=n.slice(0,-4);} // « …/int » : face intérieure d'une coque
  const fid=n.split(/[\/\[#]/)[0];if(!fid)return null;
  const r={fid,ent:null,what:''};if(int)r.int=true;
  const rest=n.slice(fid.length);
  if(rest[0]==='['){r.what=fid==='chanfrein'?'chanfrein':'conge';return r;}
  let m=/^\/(?:([^\/#]+)\/)?(?:[^\/#]+\/)*(haut|bas)(#|$)/.exec(rest);if(m){r.what=m[2];if(m[1])r.ent=m[1];return r;} // « ex_4/e1/haut » : bossage rond
  m=/^\/([^\/#]+)\/(?:[^\/#]+\/)*flanc(#|$)/.exec(rest);if(m){r.ent=m[1];r.what='flanc';return r;}
  if(/^\/c\d+\/s\d+\/f\d+/.test(rest)){r.what='trou';return r;}
  // « ho_4/~3 » : face née de la fonction sans nom plus précis (trou lamé débouchant…) ; Perçage → trou
  if(/^\/~\d+/.test(rest)){r.what='neuve';try{const f=typeof doc!=='undefined'&&doc&&(doc.features||[]).find(x=>x&&x.id===fid);if(f&&f.type==='hole')r.what='trou';}catch(e){}}
  return r;
}
function c3FaceLib(ref){
  if(ref&&ref.vtx){const o=c3Owner(ref.nom),f=o&&c3Feat(o.fid);return (f?(f.name||f.id)+' · ':'')+'sommet';}
  if(ref&&ref.edge){const o=c3Owner(ref.nom),f=o&&c3Feat(o.fid);return (f?(f.name||f.id)+' · ':'')+(ref.arc?'arête en arc':ref.circ?'arête circulaire':'arête');}
  const o=ref&&c3Owner(ref.nom),f=o&&c3Feat(o.fid),int=o&&o.int?' (intérieur de la coque)':'';
  if(!f)return (o&&o.what==='chanfrein'?'chanfrein':o&&o.what==='conge'?'congé':(ref&&ref.lib)||'face')+int;
  const cut=f.op==='cut'&&(o.what==='haut'||o.what==='bas');
  const w=cut?'fond':f.type==='revolve'&&(o.what==='haut'||o.what==='bas')?(o.what==='haut'?'face de fin':'face de départ')
    :({haut:'dessus',bas:'dessous',flanc:'côté',trou:'trou',conge:'congé'}[o.what]||'face');
  return (f.name||f.id)+' · '+w+int;
}
function c3Lib(d){
  if(c3IsCham(d))return 'Chanfrein · '+c3FaceLib(d.a);
  if(d.k==='pcd'){const rp=c3Feat(d.polar);return 'Ø de perçage · '+(rp?(rp.name||rp.id):'répétition');}
  if(d.k==='dia')return d.a&&d.a.edge?(c3IsRad(d)?'R · ':'Ø · ')+c3FaceLib(d.a):c3IsRad(d)?'R · congé':'Ø · '+c3FaceLib(d.a);
  if(d.k==='datum')return 'Référence '+(d.l||'?')+' · '+c3FaceLib(d.a);
  if(d.k==='rough')return 'Rugosité · '+c3FaceLib(d.a);
  if(d.k==='angle'&&d.hax)return '∠ '+c3FaceLib(d.a)+' ↔ axe '+(d.hv?'vertical':'horizontal');
  if(d.k==='angle')return '∠ '+c3FaceLib(d.a)+' ↔ '+c3FaceLib(d.b);
  return c3FaceLib(d.a)+' ↔ '+c3FaceLib(d.b);
}
/* ── lecture sur la pièce ── */
function c3Read(d){
  // → {v, k, p1, p2, n} | {v, k:'dia', c, a, r, X} | {err}
  if(typeof occHas!=='function'||!occHas())return {err:'noyau exact indisponible'};
  if(c3IsNote(d))return c3ReadNote(d);
  if(d.k==='pcd')return c3ReadPcd(d); // Ø de perçage d'une répétition circulaire
  if(d.k==='angle'&&d.polar)return c3ReadPolar(d); // pas d'une répétition circulaire, autour de son axe
  if(d.k==='angle')return c3ReadAngle(d);
  if(d.a&&d.a.ord0)return c3ReadOrd0(d); // ordonnée depuis un zéro libre (origine de l'esquisse)
  if(d.k!=='dia'&&d.a&&d.b&&(d.a.vtx||d.b.vtx||!!d.a.edge!==!!d.b.edge))return c3ReadMix(d); // sommet, arête ↔ face
  if((d.a&&d.a.edge)||(d.b&&d.b.edge))return c3ReadEdges(d);
  if(c3IsCham(d))return c3ReadCham(d);
  if(d.k==='dia'){
    const A=parMesFace(d.a);if(!A)return {err:'le cylindre ('+c3FaceLib(d.a)+') n’existe plus'};
    try{
      const s=occSurfDesc(A.face);if(s.k!=='cy')return {err:'la face n’est plus un cylindre'};
      const a=new THREE.Vector3(s.a[0],s.a[1],s.a[2]).normalize(),p=new THREE.Vector3(s.p[0],s.p[1],s.p[2]);
      let q=p.clone();try{const b=occFaceBox(A.face);if(b&&b.pos)q=new THREE.Vector3(b.pos[0],b.pos[1],b.pos[2]);}catch(e){}
      const c=p.clone().addScaledVector(a,q.clone().sub(p).dot(a));
      const X=new THREE.Vector3(s.X[0],s.X[1],s.X[2]).normalize();
      const b=c3Box(A.face),hl=b?Math.max(0,Math.abs(a.x)*b.h.x+Math.abs(a.y)*b.h.y+Math.abs(a.z)*b.h.z-(1-Math.max(Math.abs(a.x),Math.abs(a.y),Math.abs(a.z)))*s.r):0;
      if(c3IsRad(d)){ // congé : le rayon, la flèche sur la face du congé (milieu)
        let q2=b?b.c.clone():q.clone();const ca=p.clone().addScaledVector(a,q2.clone().sub(p).dot(a));let rd=q2.clone().sub(ca);if(rd.lengthSq()<1e-9)rd=X.clone();rd.normalize();
        return {v:s.r,k:'dia',rad:true,c:ca,a,r:s.r,X,fp:ca.clone().addScaledVector(rd,s.r),rd};}
      return {v:2*s.r,k:'dia',c,a,r:s.r,X,e1:c.clone().addScaledVector(a,hl),e2:c.clone().addScaledVector(a,-hl)};
    }catch(e){return {err:e.message||'lecture impossible'};}
    finally{occFree(A.face);}
  }
  const r=parMesEval({a:d.a,b:d.b});
  try{
    if(r.err)return {err:r.err};
    if(r.k==='mini')return {err:'les deux faces ne sont plus parallèles'};
    const n=r.p2.clone().sub(r.p1);const L=n.length();
    // entre cylindres : la cote se mesure ET se dessine sur leurs axes (Fred, 27/11 : « La cote doit rester sur ces axes »)
    let ax=null,cyA=null,cyB=null;
    if(r.k==='entraxe'||r.k==='axe'){
      const cy=f=>{try{const q=occSurfDesc(f);if(q&&q.k==='cy')return {a:c3V(q.a).normalize(),p:c3V(q.p),r:+q.r};}catch(e){}return null;};
      cyA=cy(r.A.face);cyB=cy(r.B.face);ax=(cyA||cyB)?(cyA||cyB).a.clone():null;
    }
    return c3OrdProj(d,{v:r.v,k:r.k,p1:r.p1.clone(),p2:r.p2.clone(),n:L>1e-9?n.multiplyScalar(1/L):new THREE.Vector3(0,0,1),bA:c3Box(r.A.face),bB:c3Box(r.B.face),ax,cyA:!!cyA,cyB:!!cyB});
  }finally{parMesFree(r);}
}
function c3V(a){return new THREE.Vector3(a[0],a[1],a[2]);}
function c3MepPt(id,w,dir){
  // point d'une cote 3D reprise dans la mise en plan (98-mep-77) : 'A' / 'B' = points mesurés ;
  // 'D1' / 'D2' = bords d'un cylindre vu de côté (dir = direction de la vue)
  const d=c3List().find(x=>x&&x.id===id);if(!d)return null;
  // relue si la pièce a été refaite depuis (la cote 3D n'est relue qu'un peu après chaque rejeu)
  let g=C3G.get(d);const S=parMesShapes().map(x=>x.shape);
  if(!g||!g._sh||g._sh.length!==S.length||g._sh.some((x,i)=>x!==S[i])){g=c3Refresh(d);if(g&&!g.err)g._sh=S;}
  if(!g||g.err)return null;
  if(w==='D1'||w==='D2'){if(!g.c||!g.a||!dir)return null;const u=new THREE.Vector3().crossVectors(c3V(dir),g.a);if(u.lengthSq()<1e-9)return null;u.normalize();return g.c.clone().addScaledVector(u,w==='D1'?g.r:-g.r);}
  if(w==='P')return g.P||null; // référence, rugosité : point de la face
  if(w==='F')return g.fp||null; // chanfrein : point de sa face
  if(w==='O')return g.polar||g.k==='pcd'?g.p||null:null; // pas angulaire, Ø de perçage : centre de la répétition
  if(/^H\d+$/.test(w)){const h=g.k==='pcd'&&g.H?g.H[+w.slice(1)]:null;return h?Object.assign(h.clone(),{hr:g.hr}):null;} // Ø de perçage : centre du trou n
  if(w==='QA'||w==='QB')return (w==='QA'?g.qa:g.qb)||null; // pas angulaire : centres des deux trous
  return (w==='A'?g.p1:g.p2)||null;
}
function c3MepName(id){
  // nom vivant d'une cote 3D reprise dans la mise en plan (« d3 »)
  const d=c3List().find(x=>x&&x.id===id);if(!d)return '';
  try{return typeof c3Name==='function'?String(c3Name(d)||''):'';}catch(e){return '';}
}
function c3MepText(id){
  // texte vivant d'une cote 3D reprise en note dans la mise en plan (chanfrein « 3 × 45° »)
  const d=c3List().find(x=>x&&x.id===id);if(!d||d.err||!isFinite(+d.v))return '';
  try{return c3Text(d,+d.v);}catch(e){return '';}
}
function c3ReadCham(d){
  // face d'un chanfrein « chanfrein[A|B] » : largeur en travers de l'arête et angles avec ses deux faces
  // → distance sur la 1re face (et sur la 2e, l2), angle avec la 1re face (beta) ; dessin comme un rayon
  const A=parMesFace(d.a);if(!A)return {err:'le chanfrein ('+c3FaceLib(d.a)+') n’existe plus'};
  try{
    const s=occSurfDesc(A.face);if(s.k!=='pl')return {err:'la face du chanfrein n’est plus plane'};
    const n=c3V(occFaceOutNormal(A.face)||s.n).normalize();
    const m=/^chanfrein\[(.*)\](?:\/int)?$/.exec(String(d.a.nom||''));let P=m?c3SplitPair(m[1]):[];
    // chs : la cote lit l'autre côté (chanfrein distance + angle : la distance est sur la 2e face)
    if(d.chs&&P.length>=2)P=[P[1],P[0]];
    const nb=P.slice(0,2).map(nm=>{const F=parMesFace({nom:nm,body:d.a.body});if(!F)return null;
      try{const q=occSurfDesc(F.face),o=occFaceOutNormal(F.face);return q.k==='pl'&&o?c3V(o).normalize():null;}catch(e){return null;}finally{occFree(F.face);}});
    if(!nb[0]||!nb[1])return {err:'les faces voisines du chanfrein sont introuvables'};
    const u=new THREE.Vector3().crossVectors(nb[0],nb[1]);if(u.lengthSq()<1e-8)return {err:'les faces du chanfrein sont parallèles'};u.normalize();
    const t=new THREE.Vector3().crossVectors(n,u).normalize();
    let lo=1e9,hi=-1e9;
    (occListEdges(A.face)||[]).forEach(e=>(e.pts||[]).forEach(q=>{const x=q&&q.isVector3?t.dot(q):t.dot(c3V(q));if(x<lo)lo=x;if(x>hi)hi=x;}));
    const w=hi-lo;if(!(w>1e-6))return {err:'largeur du chanfrein illisible'};
    const bA=Math.acos(Math.min(1,Math.abs(n.dot(nb[0])))),bB=Math.acos(Math.min(1,Math.abs(n.dot(nb[1])))),sw=Math.sin(Math.PI-bA-bB); // angles aigus : l'orientation des faces ne compte pas
    if(!(sw>1e-6))return {err:'chanfrein dégénéré'};
    const lA=w*Math.sin(bB)/sw,lB=w*Math.sin(bA)/sw;
    const b=c3Box(A.face),fp=b?b.c.clone():c3V(s.p);
    return {v:lA,k:'dia',rad:true,cham:true,c:fp.clone().addScaledVector(n,-lA),a:u,r:lA,X:t,fp,rd:n,l2:lB,beta:bA*180/Math.PI};
  }catch(e){return {err:e.message||'lecture impossible'};}
  finally{occFree(A.face);}
}
/* ── arêtes (Fred, 27/11 : « coter des arêtes entre elles et des arêtes circulaires pleines ou arc ») ── */
function c3SplitPair(n){
  // « a|congé[b|c] » → ['a', 'congé[b|c]'] (le | des crochets ne coupe pas)
  const out=[];let dep=0,cur='';
  for(const ch of String(n||'')){if(ch==='['||ch==='<')dep++;else if(ch===']'||ch==='>')dep--;if(ch==='|'&&dep===0){out.push(cur);cur='';}else cur+=ch;}
  if(cur)out.push(cur);return out.map(x=>x.replace(/<.*$/,''));
}
function c3EdgeList(bd){
  // arêtes du corps, nommées : [{mid, pts, src, nom}]
  let E=[];try{E=occListEdges(bd.shape)||[];if(typeof nomsSurAretes==='function')nomsSurAretes(bd.shape,E);}catch(e){E=[];}
  return E;
}
function c3EdgeGeo(pts){
  // polyligne → {kind:'line', a, u} | {kind:'circle', c, ax, r, closed, mid} | null
  if(!Array.isArray(pts)||pts.length<2)return null;
  const W=pts.map(p=>p&&p.isVector3?[p.x,p.y,p.z]:p);
  // cercle fermé : premier et dernier point confondus (edgeGeomOf le prendrait pour une droite)
  if(W.length>3&&Math.hypot(W[0][0]-W[W.length-1][0],W[0][1]-W[W.length-1][1],W[0][2]-W[W.length-1][2])<1e-6){
    const V=W.map(c3V),p1=V[0],p2=V[Math.floor(V.length/3)],p3=V[Math.floor(2*V.length/3)];
    const a=p2.clone().sub(p1),b=p3.clone().sub(p1),n=a.clone().cross(b),nn=n.lengthSq();if(nn<1e-12)return null;
    const C=p1.clone().add(b.clone().multiplyScalar(a.lengthSq()).sub(a.clone().multiplyScalar(b.lengthSq())).cross(n).multiplyScalar(0.5/nn)),r=C.distanceTo(p1);
    if(!V.every(q=>Math.abs(q.distanceTo(C)-r)<2e-3*Math.max(1,r)))return null;
    return {kind:'circle',c:C,ax:n.normalize(),r,closed:true,mid:V[Math.floor(V.length/2)].clone(),p0:p1.clone(),pts:V};
  }
  let G=null;try{G=edgeGeomOf(W);}catch(e){G=null;}
  if(!G)return null;
  if(G.kind==='line')return {kind:'line',a:G.a.clone(),b:G.b.clone(),u:G.u.clone(),pts:G.pts};
  if(G.kind==='circle'){const V=G.pts,m=V[Math.floor(V.length/2)];return {kind:'circle',c:G.center.clone(),ax:G.axis.clone(),r:G.r,closed:!!G.closed,mid:m.clone(),p0:V[0].clone(),pts:V};}
  return null;
}
function c3EdgeFind(ref){
  // arête désignée par ref (nom, sinon position à 0,05 mm) sur les corps reconstruits → géométrie | null
  if(!ref||!ref.edge)return null;
  const L=parMesShapes(),ord=L.filter(b=>b.id===ref.body).concat(L.filter(b=>b.id!==ref.body));
  for(const bd of ord){
    const E=c3EdgeList(bd);if(!E.length)continue;
    let i=ref.en&&typeof nomsTrouveArete==='function'?nomsTrouveArete(E,ref.en,ref.pos):-1;
    if(i<0&&Array.isArray(ref.pos)){let bd2=0.05;E.forEach((e,k)=>{const q=Math.hypot(e.mid[0]-ref.pos[0],e.mid[1]-ref.pos[1],e.mid[2]-ref.pos[2]);if(q<bd2){bd2=q;i=k;}});}
    if(i>=0){const G=c3EdgeGeo(E[i].pts);if(G)return G;}
  }
  return null;
}
function c3PtsBox(pts){
  const B=new THREE.Box3();(pts||[]).forEach(p=>B.expandByPoint(p.isVector3?p:c3V(p)));
  if(B.isEmpty())return null;return {c:B.getCenter(new THREE.Vector3()),h:B.getSize(new THREE.Vector3()).multiplyScalar(.5)};
}
function c3ReadEdges(d){
  // Ø / R d'une arête circulaire ; distance entre deux arêtes droites parallèles, entraxe de deux arêtes
  // circulaires (sur les axes), axe ↔ arête droite
  const GA=d.a&&d.a.edge?c3EdgeFind(d.a):null;
  if(d.a&&d.a.edge&&!GA)return {err:'l’arête ('+c3FaceLib(d.a)+') n’existe plus'};
  if(d.k==='dia'){
    if(!GA||GA.kind!=='circle')return {err:'l’arête n’est plus circulaire'};
    const X=GA.p0.clone().sub(GA.c).normalize();
    if(d.a.arc){const rd=GA.mid.clone().sub(GA.c).normalize();return {v:GA.r,k:'dia',rad:true,c:GA.c,a:GA.ax,r:GA.r,X,fp:GA.mid.clone(),rd,edge:true};}
    return {v:2*GA.r,k:'dia',c:GA.c,a:GA.ax,r:GA.r,X,e1:GA.c.clone(),e2:GA.c.clone(),edge:true};
  }
  if(!(d.b&&d.b.edge))return {err:'une arête se cote avec une autre arête'};
  const GB=c3EdgeFind(d.b);if(!GB)return {err:'l’arête ('+c3FaceLib(d.b)+') n’existe plus'};
  return c3EdgePair(GA,GB);
}
function c3EdgePair(GA,GB){
  // → {v, k, p1, p2, n, bA, bB, ax?} | {err}
  const bA=c3PtsBox(GA.pts),bB=c3PtsBox(GB.pts);
  const out=(k,p1,p2,ax)=>{const n=p2.clone().sub(p1),L=n.length();if(L<1e-6)return {err:'les deux arêtes se touchent'};
    return {v:L,k,p1,p2,n:n.multiplyScalar(1/L),bA,bB,ax:ax||null,cyA:!!ax&&GA.kind==='circle',cyB:!!ax&&GB.kind==='circle',edge:true};};
  if(GA.kind==='line'&&GB.kind==='line'){
    if(new THREE.Vector3().crossVectors(GA.u,GB.u).length()>1e-4)return {err:'ces deux arêtes ne sont pas parallèles'};
    const m=GA.a.clone().add(GA.b).multiplyScalar(.5),q=m.clone().sub(GB.a);
    const p2=GB.a.clone().addScaledVector(GB.u,q.dot(GB.u));
    return out('plans',m,p2,null);
  }
  if(GA.kind==='circle'&&GB.kind==='circle'){
    if(new THREE.Vector3().crossVectors(GA.ax,GB.ax).length()>1e-4)return {err:'ces deux cercles n’ont pas des axes parallèles'};
    const ax=GA.ax.clone().normalize(),dv=GB.c.clone().sub(GA.c);dv.addScaledVector(ax,-dv.dot(ax));
    return out('entraxe',GA.c.clone(),GA.c.clone().add(dv),ax);
  }
  const C=GA.kind==='circle'?GA:GB,Ln=GA.kind==='circle'?GB:GA;
  const q=C.c.clone().sub(Ln.a),foot=Ln.a.clone().addScaledVector(Ln.u,q.dot(Ln.u));
  if(Math.abs(Ln.u.dot(C.ax))>1e-3){
    // arête droite dans le plan du cercle (ou de biais) : distance du centre à la droite
    const r=GA.kind==='circle'?out('axe',C.c.clone(),foot,null):out('axe',foot,C.c.clone(),null);return r;
  }
  // arête parallèle au plan du cercle : écart mesuré DANS ce plan (comme un entraxe), dessiné sur l'axe
  const dv=foot.clone().sub(C.c);dv.addScaledVector(C.ax,-dv.dot(C.ax));const f2=C.c.clone().add(dv);
  return GA.kind==='circle'?out('axe',C.c.clone(),f2,C.ax.clone()):out('axe',f2,C.c.clone(),C.ax.clone());
}
function c3EdgeRefAt(e,h){
  // arête à ≤ 6 px du curseur (devant la face touchée) → {ref, G, P} | null
  if(typeof edgePickScreen!=='function'||typeof edgeOverlayData!=='function')return null;
  // arêtes lues même si leur affichage est coupé (bouton Arêtes) ; liste gardée tant que la pièce ne change pas
  const key=(typeof _docVersion!=='undefined'?_docVersion:0)+'|'+(typeof bodyVisSig==='function'?bodyVisSig():'')+'|'+(typeof builtEngine!=='undefined'?builtEngine:'');
  if(!c3.esegs||c3.esegs.key!==key){
    let data=[];const em=typeof edgeMode!=='undefined'?edgeMode:'on';
    try{edgeMode='on';data=edgeOverlayData()||[];}catch(err){data=[];}finally{try{edgeMode=em;}catch(err){}}
    c3.esegs={key,segs:data.filter(x=>x&&x.pts&&x.pts.length>1&&!x.mw).map(x=>x.pts)};
  }
  const segs=c3.esegs.segs;if(!segs.length)return null;
  let eh=null;try{eh=edgePickScreen(e,segs,h,6);}catch(err){eh=null;}
  if(!eh)return null;
  const P=segs[eh.pi];if(!P||P.length<2)return null;
  // point cliqué sur la polyligne affichée (elle peut enchaîner plusieurs arêtes : droite + arc…)
  const rr=renderer.domElement.getBoundingClientRect(),mx=e.clientX-rr.left,my=e.clientY-rr.top,pv=new THREE.Vector3();
  let pm=null,bs=1e9;
  for(let k=1;k<P.length;k++){
    const A=c3V(P[k-1]),B=c3V(P[k]);
    for(let j=0;j<=16;j++){const q=A.clone().lerp(B,j/16);pv.copy(q).project(camera);const sx=(pv.x+1)/2*rr.width,sy=(1-pv.y)/2*rr.height,dd=Math.hypot(sx-mx,sy-my);if(dd<bs){bs=dd;pm=q;}}
  }
  if(!pm)return null;
  // l'arête du solide à cet endroit : son nom (paire de faces) la retrouve après chaque rejeu
  // (les arêtes du solide sont lues en 10 segments : un grand cercle s'écarte de sa corde → seuil selon sa taille)
  let best=null,bd=1e9;
  parMesShapes().forEach(b=>{c3EdgeList(b).forEach(x=>{
    let lim=0.6;if(x.len>0)lim=Math.max(0.6,0.02*x.len);
    for(let i=1;i<x.pts.length;i++){const A=c3V(x.pts[i-1]),B=c3V(x.pts[i]),u=B.clone().sub(A),l2=u.lengthSq()||1e-12;
      const t=Math.max(0,Math.min(1,pm.clone().sub(A).dot(u)/l2)),q=A.clone().addScaledVector(u,t).distanceTo(pm);if(q<lim&&q<bd){bd=q;best={x,b};}}});});
  if(!best)return null;
  const G=c3EdgeGeo(best.x.pts);if(!G)return null; // la géométrie de CETTE arête (pas de la chaîne affichée)
  const fs=c3SplitPair(best.x.nom||''),own=(G.kind==='circle'&&!G.closed&&fs.find(n=>/^(congé)\[/.test(n)))||fs.find(n=>{const o=c3Owner(n);return o&&o.what==='flanc';})||fs.find(n=>{const o=c3Owner(n);return o&&o.what&&o.what!=='conge';})||fs[0]||'';
  const ref={edge:true,en:best.x.nom||null,pos:best.x.mid.map(v=>+v.toFixed(4)),body:best.b.id,nom:own,lib:'Arête'};
  if(G.kind==='circle'){ref.circ=true;if(!G.closed)ref.arc=true;}
  return {ref,G,P:best.x.pts};
}
function c3EdgeHl(P){
  // arête choisie en orange (outil Cote 3D)
  try{if(c3.eg){c3.eg.removeFromParent();c3.eg=null;}if(!P)return;const g=new THREE.Group();g.name='c3EdgeHl';scene.add(g);edgeHoverDraw(P,g,0xff9f0a);c3.eg=g;}catch(e){}
}
function c3ReadNote(d){
  // référence / rugosité : point d'accroche sur la face (centre + d.at, ramené dans la face), normale sortante
  const A=parMesFace(d.a);if(!A)return {err:'la face ('+c3FaceLib(d.a)+') n’existe plus'};
  try{
    const s=occSurfDesc(A.face),b=c3Box(A.face),out=occFaceOutNormal(A.face);if(!b)return {err:'face illisible'};
    let P=b.c.clone();if(Array.isArray(d.at)&&d.at.length===3)P.add(c3V(d.at));
    P.set(Math.max(b.c.x-b.h.x,Math.min(b.c.x+b.h.x,P.x)),Math.max(b.c.y-b.h.y,Math.min(b.c.y+b.h.y,P.y)),Math.max(b.c.z-b.h.z,Math.min(b.c.z+b.h.z,P.z)));
    let n;
    let cy=null;
    if(s.k==='pl'){n=out?c3V(out):c3V(s.n).normalize();const o=c3V(s.p);P.addScaledVector(n,-n.dot(P.clone().sub(o)));}
    else if(s.k==='cy'){const a=c3V(s.a).normalize(),o=c3V(s.p),q=o.clone().addScaledVector(a,a.dot(P.clone().sub(o)));
      let r=P.clone().sub(q);if(r.lengthSq()<1e-9)r=c3V(s.X);r.normalize();P=q.clone().addScaledVector(r,s.r);
      // alésage : la normale naturelle du cylindre sort de l'axe si son repère est direct, la face retournée l'inverse ;
      // sortante vers l'axe = trou (la matière est autour)
      const rev=!!(out&&c3V(out).dot(a)<0),bore=(s.direct!==false)===rev;
      cy={a:a.clone(),o:q.clone(),r:+s.r,u:r.clone(),hl:c3Half(b.h,a),bore}; // vue 3D : bord du bout vu ; mise en plan : cercle vu de bout
      n=r.multiplyScalar(bore?-1:1);}
    else{n=out?c3V(out):new THREE.Vector3(0,0,1);}
    return {v:0,k:'note',P,n,pl:s.k==='pl',cy};
  }catch(e){return {err:e.message||'lecture impossible'};}
  finally{occFree(A.face);}
}
function c3ReadAngle(d){
  // angle entre deux faces planes : arête commune (droite d'intersection), directions dans chaque face
  const A=parMesFace(d.a);if(!A)return {err:'la 1re face ('+c3FaceLib(d.a)+') n’existe plus'};
  const B=parMesFace(d.b);if(!B){occFree(A.face);return {err:'la 2e face ('+c3FaceLib(d.b)+') n’existe plus'};}
  try{
    const sA=occSurfDesc(A.face),sB=occSurfDesc(B.face);
    if(sA.k!=='pl'||sB.k!=='pl')return {err:'les faces ne sont plus planes'};
    const nA=c3V(sA.n).normalize(),nB=c3V(sB.n).normalize(),e=new THREE.Vector3().crossVectors(nA,nB);
    if(e.lengthSq()<1e-6)return {err:'les deux faces sont devenues parallèles'};
    const dA=nA.dot(c3V(sA.p)),dB=nB.dot(c3V(sB.p)),u2=e.lengthSq();
    const p=nB.clone().multiplyScalar(dA).sub(nA.clone().multiplyScalar(dB)).cross(e).multiplyScalar(1/u2);
    e.normalize();
    const bA=c3Box(A.face),bB=c3Box(B.face);
    const mid=bA&&bB?bA.c.clone().add(bB.c).multiplyScalar(.5):p.clone();
    p.addScaledVector(e,e.dot(mid.clone().sub(p)));
    const tA=new THREE.Vector3().crossVectors(e,nA).normalize(),tB=new THREE.Vector3().crossVectors(e,nB).normalize();
    if(bA&&tA.dot(bA.c.clone().sub(p))<0)tA.negate();
    if(bB&&tB.dot(bB.c.clone().sub(p))<0)tB.negate();
    let ang=Math.acos(Math.max(-1,Math.min(1,tA.dot(tB))))*180/Math.PI,big=false;
    // faces de départ et de fin d'une révolution de plus de 180° : l'angle balayé (le grand côté)
    try{const oA=c3Owner(d.a&&d.a.nom),oB=c3Owner(d.b&&d.b.nom),f=oA&&oB&&oA.fid===oB.fid?c3Feat(oA.fid):null;
      if(f&&f.type==='revolve'&&+f.angle>180&&Math.abs(360-ang-f.angle)<Math.abs(ang-f.angle)){ang=360-ang;big=true;}}catch(x){}
    return {v:d.sup&&!big?180-ang:ang,k:'angle',p,e,tA,tB,bA,bB,big};
  }catch(e){return {err:e.message||'lecture impossible'};}
  finally{occFree(A.face);occFree(B.face);}
}
function c3NextLetter(){const used=new Set(c3List().filter(x=>x.k==='datum').map(x=>x.l));return C3_LETTERS.split('').find(l=>!used.has(l))||'A';}
function c3Box(f){
  // boîte d'une face : {c centre, h demi-dimensions} (THREE.Vector3) | null
  try{const b=occFaceBox(f);if(b&&b.pos&&b.dim)return {c:new THREE.Vector3(b.pos[0],b.pos[1],b.pos[2]),h:new THREE.Vector3(b.dim[0]/2,b.dim[1]/2,b.dim[2]/2)};}catch(e){}
  return null;
}
function c3Half(h,u){return Math.abs(u.x)*h.x+Math.abs(u.y)*h.y+Math.abs(u.z)*h.z;}
const C3_RISE=0.75; // pente du trait d'une cote de perçage déportée (monte de 0,75 par 1 vers l'extérieur)
const C3_AXES=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
function c3Refresh(d){const g=c3Read(d);if(g.err){d.err=g.err;}else{delete d.err;d.v=g.v;C3G.set(d,g);}return g;}
let c3AfterT=null;
function c3AfterBuild(){
  // fin de rejeu : toutes les cotes relues (la plus extérieure seulement, comme les paramètres mesurés)
  try{c3.hb=typeof docHash==='function'?{v:_docVersion,h:docHash()}:null;}catch(e){c3.hb=null;} // empreinte de la pièce calculée (c3Dirty) ; gardée en mémoire, reprise par builtHash
  if(c3.autoQ&&c3.autoQ.size)c3AutoSoon();
  if(!c3List().length)return;
  if(c3AfterT)clearTimeout(c3AfterT);
  c3AfterT=setTimeout(()=>{c3AfterT=null;
    if(typeof rebuildDepth!=='undefined'&&rebuildDepth>0){c3AfterBuild();return;}
    c3List().forEach(d=>{try{c3Refresh(d);}catch(e){}});c3.cardK='';c3Wake();},0);
}
function c3Dirty(){
  // V1.1.1 : une cote 3D change le document (●, annulation, enregistrement) mais pas la pièce : doc.cotes3d
  // est hors de l'empreinte. markDirty seul laissait buildKeyUpToDate() faux jusqu'au rejeu suivant ;
  // les cotes posées après chaque fonction le faisaient à chaque fois : la pièce qui propose attendait
  // sans fin « la fin du calcul » (Fred, 27/11 : « n'est jamais proposé, bouton allumé »), et
  // l'enregistrement aussi, jusqu'à 60 s, pour ne pas joindre l'image de la pièce au bout du compte.
  // Pièce à jour avant et même empreinte que celle du dernier rejeu (c3.hb, noté par c3AfterBuild) :
  // l'affichage et son image (pcDernier, 20-75) restent valables.
  const hb=c3.hb;let ok=false,v0=null;
  try{ok=!!hb&&hb.h!=='x'&&typeof buildKeyUpToDate==='function'&&buildKeyUpToDate()&&hb.v===_docVersion;v0=_docVersion;}catch(e){ok=false;}
  try{markDirty();}catch(e){}
  try{if(ok&&docHash()===hb.h){builtVersion=_docVersion;hb.v=_docVersion;
    if(typeof pcDernier!=='undefined'&&pcDernier&&pcDernier.ver===v0)pcDernier.ver=_docVersion;}}catch(e){}
}
/* ── cotes posées toutes seules à la création d'une fonction (Fred, 27/11 : « à chaque création »,
   cotes d'esquisse comprises, « sur la pièce ») ── */
function c3AutoOn(){try{return localStorage.getItem('mf.c3auto')!=='0';}catch(e){return true;}}
function c3AutoSet(on){try{localStorage.setItem('mf.c3auto',on?'1':'0');}catch(e){}}
function c3AutoNew(f){if(f&&f.id){(c3.autoQ=c3.autoQ||new Set()).add(f.id);}} // appelé par addFeature (30)
function c3AutoLive(){
  // seulement dans l'appli à l'écran (pas dans les bancs sans vue), atelier CAO, hors esquisse
  try{return typeof renderer!=='undefined'&&renderer&&renderer.domElement&&renderer.domElement.isConnected&&c3Ws()==='cao'&&!(typeof skEdit!=='undefined'&&skEdit);}catch(e){return false;}
}
let c3AutoT=null;
function c3AutoSoon(){
  if(c3AutoT)clearTimeout(c3AutoT);
  c3AutoT=setTimeout(()=>{c3AutoT=null;
    if(typeof rebuildDepth!=='undefined'&&rebuildDepth>0){c3AutoSoon();return;}
    if(typeof builtEngine!=='undefined'&&builtEngine!=='exact')return; // le solide exact arrive : buildDone rappellera
    c3AutoRun();},30);
}
function c3AutoBusy(){
  // fenêtre d'extrusion / de révolution ouverte : la fonction est un aperçu, on attend OK (Échap la retire)
  try{return (typeof extDyn!=='undefined'&&!!extDyn)||(typeof fdyn!=='undefined'&&!!fdyn);}catch(e){return false;}
}
function c3AutoRun(){
  const Q=c3.autoQ;if(!Q||!Q.size)return 0;
  if(c3AutoBusy())return 0; // gardée en file : reprise à la fermeture de la fenêtre (c3Render)
  const ids=[...Q];Q.clear();
  if(!c3AutoOn()||!c3AutoLive())return 0;
  let n=0,nm='';
  ids.forEach(id=>{const f=c3Feat(id);if(!f||f.visible===false||f.suppressed)return;
    let k=0;try{k=c3AutoFeat(f);}catch(e){k=0;}if(k){n+=k;nm=f.name||f.id;}});
  if(n){if(c3.hidden)c3Hide(false);try{c3Dirty();}catch(e){}c3.cardK='';
    c3Say(n+' cote'+(n>1?'s':'')+' 3D posée'+(n>1?'s':'')+(ids.length===1?' pour « '+nm+' »':'')+' — clic droit sur une cote pour la cacher.');c3Wake();}
  return n;
}
function c3AutoFaces(pre){
  // faces dont le nom commence par pre (« ex_3/ ») : [{nom, bd}]
  const out=[];
  parMesShapes().forEach(b=>{const T=typeof NOMS_TABLES!=='undefined'&&NOMS_TABLES.get(b.shape);if(!T||!Array.isArray(T.f))return;
    T.f.forEach(n=>{if(typeof n==='string'&&n.indexOf(pre)===0)out.push({nom:n,bd:b});});});
  return out;
}
function c3AutoRef(x){
  // {nom, bd} → référence durable de la face (comme un clic)
  if(!x)return null;
  const fc=nomsRefFace(x.bd.shape,{nom:x.nom});if(!fc)return null;
  try{const r=occFaceRefAny(fc);if(!r)return null;r.nom=x.nom;r.body=x.bd.id;r.lib='Face';return r;}
  catch(e){return null;}
  finally{occFree(fc);}
}
function c3AutoHas(drv){const k=c3DrvKey(drv);return c3List().some(x=>x.drive&&c3DrvKey(x.drive)===k);}
function c3AutoMake(ra,rb,drv,expect,kind,prep){
  // cote entre deux faces (ou Ø d'une face) qui pilote drv ; refusée si elle ne mesure pas `expect`
  if(!ra||(drv&&c3AutoHas(drv)))return null;
  let k=kind||'dia';
  if(rb&&!kind){
    const A=parMesFace(ra),B=parMesFace(rb);
    try{if(!A||!B)return null;if(A.face.IsSame(B.face))return null;const r=parMesCalc(A.face,B.face);if(!r||r.err||r.k==='mini')return null;k=r.k;}
    catch(e){return null;}
    finally{if(A)occFree(A.face);if(B)occFree(B.face);}
  }
  const d=c3New(ra,rb,k);if(prep)prep(d);const g=c3Read(d);
  if(!g||g.err||!isFinite(+g.v))return null;
  if(isFinite(expect)&&Math.abs(+g.v-expect)>1e-3*Math.max(1,Math.abs(expect)))return null;
  d.v=+g.v;d.drive=drv||null;d.auto=true;d.name=c3NameNext();
  c3List().push(d);C3G.set(d,g);
  return d;
}
function c3AutoFeat(f){
  // les cotes de la fonction neuve : sa valeur (hauteur, Ø, profondeur, rayon) puis les cotes de son esquisse
  let n=0;const ok=d=>{if(d)n++;return d;};
  const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(f.type==='extrude'&&f.end!=='through'&&!f.through){
    const F=c3AutoFaces(f.id+'/'),re=t=>new RegExp('^'+esc(f.id)+'/(?:([^/#]+)/)?'+t+'(#\\d+)?$');
    const H=F.filter(x=>re('haut').test(x.nom)),B=F.filter(x=>re('bas').test(x.nom));
    const drv={t:'feat',f:f.id,k:'distance'};
    let done=false;
    // ajoutée : dessus ↔ dessous de la même forme
    for(const h of H){if(done)break;const e=re('haut').exec(h.nom)[1]||'';const b=B.find(x=>(re('bas').exec(x.nom)[1]||'')===e)||B[0];
      if(b&&ok(c3AutoMake(c3AutoRef(b),c3AutoRef(h),drv,f.mid?NaN:Math.abs(+f.distance))))done=true;}
    // poche : le fond ↔ la face de départ (parallèle, à la distance de la découpe)
    if(!done&&(H.length||B.length)){
      const fond=(H[0]||B[0]),rf=c3AutoRef(fond),T=Math.abs(+f.distance),O=c3AutoFaces('').filter(x=>x.nom.indexOf(f.id+'/')!==0&&!/^(congé|chanfrein)\[/.test(x.nom)).slice(0,120);
      for(const o of O){if(done)break;const ro=c3AutoRef(o);if(!ro||ro.st!=='Plane')continue;if(ok(c3AutoMake(ro,rf,drv,T)))done=true;}
    }
  }
  if(f.type==='hole'){
    // Ø (toutes les valeurs du trou sur la cote) sur le premier centre
    const F=c3AutoFaces(f.id+'/');let dd=null;
    for(const x of F){const r=c3AutoRef(x);if(!r)continue;const d=c3New(r,null,'dia'),g=c3Read(d);if(!g||g.err||g.k!=='dia'||g.rad)continue;
      if(Math.abs(+g.v-(+f.d||0))<1e-3){dd=r;break;}if(!dd)dd=r;}
    if(dd){const d0=c3New(dd,null,'dia'),K=c3HoleKeys(f,Object.assign(d0,{v:+f.d||0}));if(K.length)ok(c3AutoMake(dd,null,{t:'feat',f:f.id,k:K[0][0]},NaN));}
  }
  if(f.type==='xfillet'&&Array.isArray(f.edges)){
    // un rayon (une distance de chanfrein) par valeur différente (toutes les arêtes de cette valeur ensemble)
    const rs=[];f.edges.forEach(e=>{if(e&&isFinite(+e.r)&&!rs.some(r=>Math.abs(r-+e.r)<1e-6))rs.push(+e.r);});
    const C=c3AutoFaces(f.chamfer?'chanfrein[':'congé[');
    rs.forEach(r=>{
      const E=f.edges.filter(e=>e&&Math.abs(+e.r-r)<1e-6&&Array.isArray(e.pos));let best=null,bd=1e9;
      C.forEach(x=>{const ref=c3AutoRef(x);if(!ref)return;const d=c3New(ref,null,'dia'),g=c3Read(d);if(!g||g.err||!g.rad||Math.abs(+g.v-r)>1e-3||!g.fp)return;
        E.forEach(e=>{const q=Math.hypot(e.pos[0]-g.fp.x,e.pos[1]-g.fp.y,e.pos[2]-g.fp.z);if(q<bd){bd=q;best=ref;}});});
      if(!best){
        // chanfrein à deux distances lu de l'autre côté : sa face montre la 2e distance → elle pilote cd2
        if(f.chamfer&&f.cmode==='d2'&&+f.cd2>0){const r2=+f.cd2;
          let b2=null,bd2=1e9;
          C.forEach(x=>{const ref=c3AutoRef(x);if(!ref)return;const g=c3Read(c3New(ref,null,'dia'));if(!g||g.err||!g.rad||Math.abs(+g.v-r2)>1e-3||!g.fp)return;
            E.forEach(e=>{const q=Math.hypot(e.pos[0]-g.fp.x,e.pos[1]-g.fp.y,e.pos[2]-g.fp.z);if(q<bd2){bd2=q;b2=ref;}});});
          if(b2)ok(c3AutoMake(b2,null,{t:'feat',f:f.id,k:'cd2'},r2));}
        // chanfrein distance + angle : la distance est l'autre côté de la face → la cote lit ce côté (chs)
        // et pilote la distance des arêtes (« 3 × 30° »)
        if(f.chamfer&&f.cmode==='da'){
          let b3=null,bd3=1e9;
          C.forEach(x=>{const ref=c3AutoRef(x);if(!ref)return;const g=c3Read(c3New(ref,null,'dia'));if(!g||g.err||!g.rad||!isFinite(g.l2)||Math.abs(+g.l2-r)>1e-3||!g.fp)return;
            E.forEach(e=>{const q=Math.hypot(e.pos[0]-g.fp.x,e.pos[1]-g.fp.y,e.pos[2]-g.fp.z);if(q<bd3){bd3=q;b3=ref;}});});
          if(b3){const d=c3New(b3,null,'dia');d.chs=true;const D=c3FilletDrv(f,d,true);const drv=D.length?D[D.length-1]:null;
            if(drv&&drv.f===f.id)ok(c3AutoMake(b3,null,drv,r,undefined,x=>{x.chs=true;}));}
        }
        return;
      }
      const d=c3New(best,null,'dia');const D=c3FilletDrv(f,d,!!f.chamfer);const drv=D.length?D[D.length-1]:null;
      if(drv&&drv.f===f.id)ok(c3AutoMake(best,null,drv,r));
    });
  }
  if(f.type==='xshell'&&f.kind!=='souffle'&&+f.thick>0){
    // coque : une face et sa face intérieure (le dessus d'abord) → l'épaisseur
    const I=c3AutoFaces('').filter(x=>/\/int$/.test(x.nom)).sort((a,b)=>(/\/haut\/int$/.test(b.nom)?1:0)-(/\/haut\/int$/.test(a.nom)?1:0)).slice(0,40);
    let done=false;
    for(const x of I){if(done)break;const ri=c3AutoRef(x);if(!ri||ri.st!=='Plane')continue;const ro=c3AutoRef({nom:x.nom.slice(0,-4),bd:x.bd});if(!ro)continue;
      if(ok(c3AutoMake(ro,ri,{t:'feat',f:f.id,k:'thick'},+f.thick)))done=true;}
  }
  if(f.type==='revolve'&&+f.angle>0&&+f.angle<360&&!f.orj&&!f.orjRing){
    // révolution partielle : l'angle entre sa face de départ et sa face de fin
    const F=c3AutoFaces(f.id+'/'),re=t=>new RegExp('^'+esc(f.id)+'/(?:[^/#]+/)?'+t+'(#\\d+)?$');
    const H=F.find(x=>re('haut').test(x.nom)),B=F.find(x=>re('bas').test(x.nom));
    if(H&&B)ok(c3AutoMake(c3AutoRef(B),c3AutoRef(H),{t:'feat',f:f.id,k:'angle'},+f.angle,'angle'));
  }
  if(f.type==='repeat'&&f.mode==='lin'&&isFinite(+f.dist)){
    // répétition linéaire : le pas, entre la source et le 1er exemplaire (cylindres d'abord)
    const kids=(doc.features||[]).filter(c=>c&&c.repeatId===f.id&&(c.repIndex||1)===1&&c._src);
    let done=false;
    for(const c of kids){if(done)break;
      const FS=c3AutoFaces(c._src+'/').sort((a,b)=>(/\/cercle\//.test(b.nom)?1:0)-(/\/cercle\//.test(a.nom)?1:0)).slice(0,30);
      for(const x of FS){if(done)break;const y={nom:c.id+x.nom.slice(c._src.length),bd:x.bd};
        if(ok(c3AutoMake(c3AutoRef(x),c3AutoRef(y),{t:'feat',f:f.id,k:'dist'},Math.abs(+f.dist))))done=true;}
    }
  }
  if(f.type==='repeat'&&f.mode==='lin'&&f.lin2&&isFinite(+f.dist2)){
    // 2e direction : le pas 2, entre la source et l'exemplaire (0, 1) de la grille
    const n1=typeof repMaxCopies==='function'?repMaxCopies(f.copies):Math.max(1,Math.floor(+f.copies||1));
    const kids=(doc.features||[]).filter(c=>c&&c.repeatId===f.id&&c.repIndex===n1+1&&c._src);
    let done=false;
    for(const c of kids){if(done)break;
      const FS=c3AutoFaces(c._src+'/').sort((a,b)=>(/\/cercle\//.test(b.nom)?1:0)-(/\/cercle\//.test(a.nom)?1:0)).slice(0,30);
      for(const x of FS){if(done)break;const y={nom:c.id+x.nom.slice(c._src.length),bd:x.bd};
        if(ok(c3AutoMake(c3AutoRef(x),c3AutoRef(y),{t:'feat',f:f.id,k:'dist2'},Math.abs(+f.dist2))))done=true;}
    }
  }
  if(f.type==='repeat'&&f.mode==='circ'){
    // circulaire : le Ø de perçage des trous (cylindres de la source), puis le pas angulaire entre la source et le
    // 1er exemplaire — autour de l'axe pour des trous, entre deux faces planes qui tournent sinon. Tour complet :
    // le Ø des trous dit « EQS » (ISO 129-1) et le pas angulaire est de référence
    const step=typeof repCircStep==='function'?repCircStep(f):NaN;
    {let done=!!c3PcdOf(f);
      for(const c of (doc.features||[]).filter(c=>c&&c.repeatId===f.id&&(c.repIndex||1)===1&&c._src)){if(done)break;
        for(const x of c3AutoFaces(c._src+'/').slice(0,40)){if(done)break;const ra=c3AutoRef(x);if(!ra||!/cyl/i.test(String(ra.st||'')))continue;
          const d=c3PcdNew(ra,f);if(!d||d.err)continue;d.auto=true;d.name=c3NameNext();c3List().push(d);n++;done=true;}}}
    // angle du 1er trou depuis l'axe horizontal (s'il n'est pas sur un axe)
    if(!c3HaxOf(f)){let hd=false;
      for(const c of (doc.features||[]).filter(c=>c&&c.repeatId===f.id&&(c.repIndex||1)===1&&c._src)){if(hd)break;
        for(const x of c3AutoFaces(c._src+'/').slice(0,40)){if(hd)break;const ra=c3AutoRef(x);if(!ra||!/cyl/i.test(String(ra.st||'')))continue;
          const d=c3HaxNew(ra,f);if(!d||d.err)continue;d.auto=true;d.name=c3NameNext();c3List().push(d);n++;hd=true;}}}
    // pas angulaire : toujours (Fred : « au moins l'angle du pas ») ; tour complet : de référence, le nombre de trous le fixe (EQS)
    const full=c3RepFull(f);
    if(isFinite(step)&&step>0&&step<=180&&!c3List().some(x=>x&&x.k==='angle'&&x.polar===f.id&&!x.hax)){
      // tour complet : du trou coté depuis l'axe vers son voisin qui s'éloigne de l'axe — les deux angles s'enchaînent sur le
      // même arc (Fred, 27/11 : « la cote de 30° à gauche et juste après la 60° ») ; arc partiel : le 1er exemplaire
      const N=c3RepCount(f)-1,hx=c3HaxOf(f),gh=hx?C3G.get(hx)||null:null;
      let kids=(doc.features||[]).filter(c=>c&&c.repeatId===f.id&&((c.repIndex||1)===1||(full&&N>1&&c.repIndex===N))&&c._src);
      if(gh&&gh.tA&&kids.some(c=>c.repIndex===N&&N>1)){
        const away=c=>{for(const x of c3AutoFaces(c._src+'/').slice(0,40)){const ra=c3AutoRef(x),rb=c3AutoRef({nom:c.id+x.nom.slice(c._src.length),bd:x.bd});
          if(!ra||!rb||!/cyl/i.test(String(ra.st||'')))continue;const d=c3New(ra,rb,'angle');d.polar=f.id;const g=c3Read(d);if(g&&!g.err&&g.tB)return g.tB.dot(gh.tA);}return 1;};
        const K=new Map(kids.map(c=>[c,away(c)]));kids=kids.slice().sort((a,b)=>K.get(a)-K.get(b));}
      let done=false;
      for(const c of kids){if(done)break;
        const FS=c3AutoFaces(c._src+'/').slice(0,40),pair=x=>[c3AutoRef(x),c3AutoRef({nom:c.id+x.nom.slice(c._src.length),bd:x.bd})];
        for(const x of FS){if(done)break;const [ra,rb]=pair(x);if(!ra||!rb||!/cyl/i.test(String(ra.st||'')))continue;
          if(ok(c3AutoMake(ra,rb,full?null:{t:'feat',f:f.id,k:'angle'},step,'angle',d=>{d.polar=f.id;})))done=true;}
        for(const x of FS){if(done)break;const [ra,rb]=pair(x);if(!ra||!rb||!/plan/i.test(String(ra.st||'')))continue;
          if(ok(c3AutoMake(ra,rb,full?null:{t:'feat',f:f.id,k:'angle'},step,'angle')))done=true;}
      }
    }
  }
  n+=c3AutoSketch(f);
  return n;
}
function c3AutoSketch(f){
  if(f&&f.repeatId)return 0; // instance de répétition : ses cotes sont celles de sa source
  // cotes de l'esquisse de la fonction, reprises sur la pièce : chaque cote d'esquisse qui règle
  // l'écart de deux flancs parallèles, un Ø, un entraxe ou un axe ↔ flanc devient une cote 3D qui la pilote
  const sk=f.sketchId?c3Sk(f.sketchId):null;if(!sk||!Array.isArray(sk.dims)||!sk.dims.length)return 0;
  if(f.type!=='extrude'&&f.type!=='hole'&&f.type!=='revolve')return 0;
  const free=sk.dims.filter(dm=>dm&&!dm.ref&&!(dm.expr!=null&&String(dm.expr).trim()!=='')&&dm.type!=='angle'&&isFinite(parDimUser(dm)));
  if(!free.length)return 0;
  const E=id=>(sk.entities||[]).find(e=>e&&e.id===id);
  // faces par entité : « fid/eN/flanc » (extrusion) ; « ho/cI/… » cylindre du centre I (perçage)
  const face=new Map(),F=c3AutoFaces(f.id+'/');
  if(f.type==='hole'){
    const P=(sk.entities||[]).filter(e=>e&&e.t==='cpoint'&&e.hole);
    P.forEach((e,i)=>{const L=F.filter(x=>new RegExp('^'+f.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/c'+i+'/').test(x.nom));
      for(const x of L){const r=c3AutoRef(x);if(!r)continue;const g=c3Read(c3New(r,null,'dia'));if(g&&!g.err&&g.k==='dia'&&!g.rad){face.set(e.id,r);break;}}});
  }else F.forEach(x=>{const m=/^[^/]+\/([^/#]+)\/(?:[^/#]+\/)*flanc(#\d+)?$/.exec(x.nom);/* « ex_4/e1/flanc », « ex_4/e1/cercle/flanc » */if(m&&!face.has(m[1])){const e=E(m[1]);if(e&&!e.construction){const r=c3AutoRef(x);if(r)face.set(m[1],r);}}});
  if(!face.size)return 0;
  const ids=[...face.keys()],used=new Set();let n=0;
  n+=c3AutoOrd(sk,free,face,used);
  const L=ids.filter(id=>E(id).t==='line'),C=ids.filter(id=>{const t=E(id).t;return t==='circle'||t==='arc'||t==='cpoint';});
  const dir=e=>{const A=sk.points[e.p1],B=sk.points[e.p2];if(!A||!B)return null;const dx=B.x-A.x,dy=B.y-A.y,h=Math.hypot(dx,dy);return h>1e-9?[dx/h,dy/h]:null;};
  const tryPair=(ents,dia,rb)=>{
    if(n>=12)return;
    const M=c3SkMeasureFn(sk,ents,dia,false);if(!M)return;const m=M(sk);if(!isFinite(m))return;
    const S=c3SkSlopes(sk,ents,dia,false);
    for(const x of S){if(used.has(x.dm.id))continue;const u=Math.abs(parDimUser(x.dm)),s=Math.abs(x.s);
      // la cote d'esquisse vaut ce que l'on cote (ou son rayon) et le fait bouger (pente nette : la sécante fera le reste)
      const fits=s>0.3&&(Math.abs(u-m)<1e-3*Math.max(1,m)||(dia&&Math.abs(2*u-m)<1e-3*Math.max(1,m)));
      if(!fits)continue;
      const drv={t:'dim',sk:sk.id,d:x.dm.id};
      const d=c3AutoMake(face.get(ents[0]),rb?face.get(ents[1]):null,drv,m);
      if(d){used.add(x.dm.id);n++;}
      return;
    }
  };
  // Ø des cercles (pas pour un perçage : son Ø est la fonction)
  if(f.type!=='hole')C.filter(id=>E(id).t!=='cpoint').forEach(id=>tryPair([id],true,false));
  // flancs parallèles
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=dir(E(L[i])),b=dir(E(L[j]));if(!a||!b||Math.abs(a[0]*b[1]-a[1]*b[0])>1e-6)continue;tryPair([L[i],L[j]],false,true);}
  // entraxes, puis axe ↔ flanc
  for(let i=0;i<C.length;i++)for(let j=i+1;j<C.length;j++)tryPair([C[i],C[j]],false,true);
  L.forEach(l=>C.forEach(c=>tryPair([l,c],false,true)));
  return n;
}
/* ── qu'est-ce qui bouge ? ── */
function c3DrvKey(drv){return drv?(drv.t==='dim'?'dim:'+drv.sk+':'+drv.d:'feat:'+drv.f+':'+drv.k+(Array.isArray(drv.e)?':'+drv.e.join(','):'')):'';}
function c3DrvH(R,drv){return Array.isArray(drv.e)?(R.f.edges||[])[drv.e[0]]:R.f;} // porteur du réglage (une arête de congé, ou la fonction)
function c3DrvFind(drv){
  if(!drv)return null;
  if(drv.t==='dim'){const sk=c3Sk(drv.sk),dm=sk&&(sk.dims||[]).find(x=>x&&x.id===drv.d);return dm?{sk,dm}:null;}
  const f=c3Feat(drv.f);return f?{f}:null;
}
function c3DrvGet(drv){
  const R=c3DrvFind(drv);if(!R)return NaN;
  if(drv.t==='dim')return parDimUser(R.dm);
  const h=c3DrvH(R,drv);return h?parHolderVal(h,drv.k):NaN;
}
function c3DrvSet(drv,v){
  // → true | message (refus de l'esquisse, valeur hors domaine)
  const R=c3DrvFind(drv);if(!R)return 'le réglage piloté n’existe plus';
  const txt=String(+(+v).toFixed(6));
  let r;
  if(drv.t==='dim')r=parSetDim(R.sk,R.dm,txt);
  else if(Array.isArray(drv.e)){r=true;for(const i of drv.e){const h=(R.f.edges||[])[i];if(!h){r='arête du congé introuvable';break;}r=parSetFeat(h,drv.k,R.f,txt);if(r!==true)break;}
    if(r===true)try{if(typeof repSyncForFeature==='function')repSyncForFeature(R.f);}catch(e){}}
  else r=parSetFeat(R.f,drv.k,R.f,txt);
  if(r===true)try{parApplyAll();}catch(e){} // nom de la fonction (« Perçage Ø8 ») et expressions suivent
  return r;
}
const C3_FKEY={cd2:'2e distance',cang:'angle du chanfrein',thick:'épaisseur',angle:'angle',dist:'pas',dist2:'pas 2',qty:'nombre',qty2:'nombre 2',distance:'distance',d:'Ø',depth:'profondeur',cbD:'Ø lamage',cbH:'prof. lamage',csD:'Ø fraisure',csA:'angle de fraisure',reamD:'Ø alésage',reamH:'prof. alésage',stD:'Ø avant-trou',stH:'prof. avant-trou'};
function c3DrvLib(drv){
  const R=c3DrvFind(drv);if(!R)return '?';
  const fin=typeof c3Anim!=='undefined'&&c3Anim&&c3DrvKey(c3Anim.drv)===c3DrvKey(drv)?c3Anim.p1:null; // pièce en mouvement : la valeur d'arrivée
  if(drv.t==='dim'){const dm=R.dm,v=fin!=null?fin:parDimUser(dm);
    const sym=dm.type==='angle'?'∠':(dm.type==='diameter'||dm.dia?'Ø':dm.type==='radius'?'R':'');
    return (R.sk.name||R.sk.id)+' › '+(dm.name?dm.name+' = ':'cote ')+sym+c3Num(v)+(dm.type==='angle'?'°':'');}
  if(Array.isArray(drv.e)){const h=c3DrvH(R,drv);return (R.f.name||R.f.id)+' › '+(drv.e.length>1?drv.e.length+' arêtes':'arête '+(h&&h.name||drv.e[0]+1))+(R.f.chamfer?' ':' R')+c3Num(fin!=null?fin:h?+h.r:NaN);}
  return (R.f.name||R.f.id)+' › '+(C3_FKEY[drv.k]||drv.k)+' '+c3Num(fin!=null?fin:parHolderVal(R.f,drv.k))+(drv.k==='angle'||drv.k==='csA'?'°':'');
}
function c3Holder(drv,except){const k=c3DrvKey(drv);return c3List().find(x=>x!==except&&x.drive&&c3DrvKey(x.drive)===k)||null;}
function c3SkClone(sk){const o={};for(const k in sk)if(k[0]!=='_')o[k]=sk[k];return JSON.parse(JSON.stringify(o));}
function c3SkMeasureFn(sk,ents,dia,ang){
  // ce que la cote mesure, lu dans l'esquisse (sans rejeu) — rend f(sk) → nombre ou [x, y]
  // centres : cercles, arcs ET centres de perçage (cpoint de la fonction Perçage)
  const E=id=>(sk.entities||[]).find(e=>e&&e.id===id);
  const L=ents.map(E).filter(e=>e&&e.t==='line'),C=ents.map(E).filter(e=>e&&(e.t==='circle'||e.t==='arc'));
  const K=ents.map(E).filter(e=>e&&(e.t==='circle'||e.t==='arc'||e.t==='cpoint'));
  const nOf=(s,l)=>{const A=s.points[l.p1],B=s.points[l.p2];if(!A||!B)return null;const dx=B.x-A.x,dy=B.y-A.y,h=Math.hypot(dx,dy)||1;return {A,nx:-dy/h,ny:dx/h};};
  const get=(s,e)=>(s.entities||[]).find(x=>x&&x.id===e.id);
  const ctr=(s,e)=>{const x=get(s,e);return x?s.points[x.t==='cpoint'?x.p:x.pc]:null;};
  if(dia&&C.length)return s=>{const c=get(s,C[0]);return c?2*(+c.r):NaN;};
  if(ang&&L.length>=2)return s=>{const a=get(s,L[0]),b=get(s,L[1]);if(!a||!b)return NaN;const A=s.points[a.p1],B=s.points[a.p2],P=s.points[b.p1],D=s.points[b.p2];if(!A||!B||!P||!D)return NaN;
    const ux=B.x-A.x,uy=B.y-A.y,vx=D.x-P.x,vy=D.y-P.y,l=Math.hypot(ux,uy)*Math.hypot(vx,vy)||1;return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/l)))*180/Math.PI;};
  if(L.length>=2)return s=>{const a=nOf(s,get(s,L[0])),l=get(s,L[1]);if(!a||!l)return NaN;const P=s.points[l.p1],Q=s.points[l.p2];
    return Math.abs(a.nx*((P.x+Q.x)/2-a.A.x)+a.ny*((P.y+Q.y)/2-a.A.y));};
  if(K.length>=2)return s=>{const a=ctr(s,K[0]),b=ctr(s,K[1]);return a&&b?Math.hypot(b.x-a.x,b.y-a.y):NaN;};
  if(L.length&&K.length)return s=>{const a=nOf(s,get(s,L[0])),c=ctr(s,K[0]);if(!a||!c)return NaN;return Math.abs(a.nx*(c.x-a.A.x)+a.ny*(c.y-a.A.y));};
  if(L.length){const n0=nOf(sk,L[0]);if(!n0)return null;return s=>{const l=get(s,L[0]),A=l&&s.points[l.p1];return A?n0.nx*A.x+n0.ny*A.y:NaN;};}
  if(K.length)return s=>{const P=ctr(s,K[0]);return P?[P.x,P.y]:[NaN,NaN];};
  return null;
}
function c3Delta(a,b){
  if(Array.isArray(a))return Math.hypot(b[0]-a[0],b[1]-a[1]);
  return b-a;
}
function c3SkSlopes(sk,ents,dia,ang){
  // pente de chaque cote de l'esquisse sur ce que l'on cote : [{dm, s}] (|s| > 0,001), la plus forte d'abord
  const M=c3SkMeasureFn(sk,ents,dia,ang);if(!M)return[];
  return c3SkSlopesM(sk,M,false);
}
function c3SkSlopesM(sk,M,wrap){
  // même chose pour une mesure quelconque M(esquisse) ; wrap : angle en degrés (écart ramené dans ±180)
  const m0=M(sk),out=[];
  (sk.dims||[]).forEach(dm=>{
    if(!dm||dm.ref||(dm.expr!=null&&String(dm.expr).trim()!==''))return;
    const u=parDimUser(dm);if(!isFinite(u))return;
    const du=dm.type==='angle'?1:Math.max(0.1,Math.abs(u)*0.02);
    let s=null;
    try{
      const cl=c3SkClone(sk),cd=(cl.dims||[]).find(x=>x&&x.id===dm.id);if(!cd)return;
      cd.value=parDimFromUser(cd,u+du);
      solveSketch(cl);
      if(typeof skResid==='function'&&typeof SK_OK_RES!=='undefined'&&skResid(cl)>SK_OK_RES)return;
      const m1=M(cl);let dl=c3Delta(m0,m1);if(!isFinite(dl))return;if(wrap)dl=((dl+540)%360)-180;
      s=dl/du;
    }catch(e){return;}
    if(s!=null&&Math.abs(s)>1e-3)out.push({dm,s});
  });
  out.sort((a,b)=>Math.abs(b.s)-Math.abs(a.s));
  return out;
}
function c3FilletDrv(f,d,cham){
  // congé coté : l'arête la plus proche de la face (et, si d'autres arêtes ont le même rayon, toutes ensemble)
  // la face s'appelle « congé[faceA|faceB] » : la fonction est retrouvée par l'arête la plus proche, au même rayon
  if(f&&f.type==='fillet'&&!cham)return [{t:'feat',f:f.id,k:'radius'}];
  const g=C3G.get(d)||c3Refresh(d),r=g&&isFinite(+g.v)?+g.v:NaN,fp=g&&g.fp;
  const F=(f&&f.type==='xfillet')?[f]:(doc.features||[]).filter(x=>x&&x.type==='xfillet'&&!!x.chamfer===!!cham&&x.visible!==false);
  let best=-1,bd=1e9;
  F.forEach(x=>{if(!!x.chamfer!==!!cham||!Array.isArray(x.edges))return;x.edges.forEach((e,i)=>{if(!e||!Array.isArray(e.pos))return;if(isFinite(r)&&Math.abs(+e.r-r)>1e-3)return;
    const dd=fp?Math.hypot(e.pos[0]-fp.x,e.pos[1]-fp.y,e.pos[2]-fp.z):0;if(dd<bd){bd=dd;best=i;f=x;}});});
  if(best<0&&cham&&isFinite(r)){const x=F.find(y=>y&&y.cmode==='d2'&&Math.abs(+y.cd2-r)<1e-3);if(x)return [{t:'feat',f:x.id,k:'cd2'}];}
  if(best<0||!f)return [];
  const out=[{t:'feat',f:f.id,k:'r',e:[best]}];
  const same=f.edges.map((e,i)=>i).filter(i=>Math.abs(+f.edges[i].r-+f.edges[best].r)<1e-6);
  if(same.length>1)out.push({t:'feat',f:f.id,k:'r',e:same});
  return out;
}
function c3HoleSkInfo(ref){
  // centre du trou dans son esquisse et point où l'axe de la répétition perce l'esquisse → {sk, pt, ax:[x, y]} | null
  const o=c3Owner(ref&&ref.nom);if(!o)return null;const f=c3FeatSrc(o.fid),sk=f&&c3Sk(f.sketchId);if(!sk)return null;
  let ent=o.what==='flanc'?o.ent:null;
  if(o.what==='trou'&&f.type==='hole'){const m=/\/c(\d+)\//.exec(ref.nom||''),P=typeof holePoints==='function'?holePoints(sk):[];if(m&&P[+m[1]])ent=P[+m[1]].id;else if(P.length===1)ent=P[0].id;}
  const pt=ent?c3SkPt(sk,ent):null,rp=c3CircRep(ref);if(!pt||!rp||typeof occW!=='function'||typeof repAxisVec!=='function')return null;
  try{
    const o0=c3V(occW(sk,0,0)),ux=c3V(occW(sk,1,0)).sub(o0),uy=c3V(occW(sk,0,1)).sub(o0),n=new THREE.Vector3().crossVectors(ux,uy).normalize(),e=c3V(repAxisVec(rp)).normalize();
    const ne=n.dot(e);if(Math.abs(ne)<1e-6)return null; // esquisse parallèle à l'axe
    const w=e.clone().multiplyScalar(n.dot(o0)/ne).sub(o0);
    return {sk,pt,ax:[w.dot(ux)/ux.lengthSq(),w.dot(uy)/uy.lengthSq()]};
  }catch(x){return null;}
}
function c3HoleCands(d,ref,mode){
  // cotes de l'esquisse du trou qui changent son Ø de perçage (mode 'r') ou son angle autour de l'axe ('a') ;
  // Ø de perçage coté nulle part et axe à l'origine de l'esquisse : proposer la cote centre ↔ origine
  const I=c3HoleSkInfo(ref);if(!I)return [];
  const M=s=>{const p=s.points&&s.points[I.pt];if(!p)return NaN;const x=p.x-I.ax[0],y=p.y-I.ax[1];return mode==='a'?Math.atan2(y,x)*180/Math.PI:2*Math.hypot(x,y);};
  const out=c3SkSlopesM(I.sk,M,mode==='a').slice(0,4).map(x=>({drv:{t:'dim',sk:I.sk.id,d:x.dm.id},s:x.s}));
  const O=typeof SK_ORIGIN!=='undefined'?SK_ORIGIN:'O';
  if(mode==='r'&&!out.length&&Math.hypot(I.ax[0],I.ax[1])<1e-6&&I.pt!==O&&I.sk.points&&I.sk.points[O]
    &&!(I.sk.dims||[]).some(m=>m&&m.type==='distance'&&((m.a===I.pt&&m.b===O)||(m.a===O&&m.b===I.pt))))
    out.push({drv:{t:'newdim',sk:I.sk.id,pa:I.pt,pb:O},lib:'Ajouter la cote du rayon (centre ↔ origine) à '+(I.sk.name||I.sk.id),s:2});
  return out;
}
function c3Candidates(d){
  // → [{drv, lib, s (pente estimée, signée si sûre), held (cote 3D qui le tient déjà)}]
  const out=[],seen=new Set();
  const add=(drv,s)=>{const k=c3DrvKey(drv);if(seen.has(k)||!c3DrvFind(drv))return;seen.add(k);out.push({drv,lib:c3DrvLib(drv),s:s==null?null:s,held:c3Holder(drv,d)});};
  if(d.k==='pcd'){c3HoleCands(d,d.a,'r').forEach(c=>{if(c.drv.t==='newdim')out.push(Object.assign({held:null},c));else add(c.drv,c.s);});return out;}
  // angle d'un trou depuis une face : seulement ce qui le tourne autour de l'axe — les cotes de son esquisse et, pour un
  // exemplaire, l'angle de la répétition (pas sur un tour complet : les trous ne seraient plus également répartis)
  if(d.k==='angle'&&d.polar){const ra=c3CircRep(d.a),rb=c3CircRep(d.b);if(!!ra!==!!rb){const hr=ra?d.a:d.b,rp=ra||rb;
    c3HoleCands(d,hr,'a').forEach(c=>{if(c.drv.t==='dim')add(c.drv,c.s);});
    const o=c3Owner(hr.nom),f=o&&c3Feat(o.fid);if(f&&f.repeatId===rp.id&&!c3RepFull(rp))add({t:'feat',f:rp.id,k:'angle'},null);
    return out;}}
  const refs=d.k==='dia'?[d.a]:[d.a,d.b];
  const O=refs.map(r=>c3Owner(r&&r.nom));
  // fonctions : distance d'extrusion (bout « haut »), Ø et profondeur de perçage
  O.forEach(o=>{if(!o)return;
    if((o.what==='conge'||o.what==='chanfrein')&&d.k==='dia'){c3FilletDrv(c3Feat(o.fid),d,o.what==='chanfrein').forEach(x=>add(x,1));return;}
    const f=c3FeatSrc(o.fid);if(!f)return;
    if((o.what==='haut'||(o.what==='bas'&&(f.op==='cut'||f.mid)))&&f.type==='extrude'&&d.k!=='dia'&&d.k!=='angle')add({t:'feat',f:f.id,k:'distance'},null);
    if(o.what==='trou'&&f.type==='hole'&&(d.k==='dia'||d.k==='plans'))c3HoleKeys(f,d).forEach(x=>add({t:'feat',f:f.id,k:x[0]},x[1]));
  });
  // coque : face et face intérieure → l'épaisseur (Fred, 27/11)
  if(d.k==='plans'&&O[0]&&O[1]&&!!O[0].int!==!!O[1].int){const sh=c3ShellOf(refs);if(sh)add({t:'feat',f:sh.id,k:'thick'},1);}
  // révolution : angle entre sa face de départ et sa face de fin
  if(d.k==='angle'&&O[0]&&O[1]&&O[0].fid===O[1].fid&&/^(haut|bas)$/.test(O[0].what)&&/^(haut|bas)$/.test(O[1].what)){
    const f=c3Feat(O[0].fid);if(f&&f.type==='revolve')add({t:'feat',f:f.id,k:'angle'},d.sup?-1:1);}
  // répétition : le pas (linéaire, le long d'une courbe à pas imposé), l'angle (circulaire)
  {const vu=new Set();O.forEach(o=>{if(!o||d.k==='dia')return;const rp=c3RepOf(o.fid);if(!rp||vu.has(rp.id))return;vu.add(rp.id);
    if(rp.mode==='circ')add({t:'feat',f:rp.id,k:'angle'},null);
    else if(d.k!=='angle'&&(rp.mode==='lin'||(rp.mode==='path'&&rp.pspace==='pitch'))){add({t:'feat',f:rp.id,k:'dist'},null);if(rp.mode==='lin'&&rp.lin2)add({t:'feat',f:rp.id,k:'dist2'},null);}});}
  // esquisses : cotes qui déplacent les côtés cotés (essayées sur une copie de l'esquisse)
  const bySk=new Map();
  O.forEach((o,k)=>{if(!o)return;const f=c3FeatSrc(o.fid);const sk=f&&c3Sk(f.sketchId);if(!sk)return;
    let ent=o.what==='flanc'?o.ent:null;
    if(o.what==='trou'&&f.type==='hole'&&d.k!=='dia'){ // « ho_8/c1/s0/f2 » → 2e centre de perçage de l'esquisse
      const m=/\/c(\d+)\//.exec(refs[k].nom||''),P=typeof holePoints==='function'?holePoints(sk):[];
      if(m&&P[+m[1]])ent=P[+m[1]].id;else{const i=c3HoleCenterIdx(sk,P,d,k);if(i>=0)ent=P[i].id;}}
    if(!ent)return;
    if(!bySk.has(sk))bySk.set(sk,[]);if(bySk.get(sk).indexOf(ent)<0)bySk.get(sk).push(ent);});
  const sks=[...bySk.keys()].sort((a,b)=>c3SkRank(b)-c3SkRank(a));
  sks.forEach(sk=>{
    const two=bySk.get(sk).length>=2||d.k==='dia';
    c3SkSlopes(sk,bySk.get(sk),d.k==='dia',d.k==='angle').slice(0,4).forEach(x=>add({t:'dim',sk:sk.id,d:x.dm.id},two?x.s:null));
  });
  // deux centres de la même esquisse sans cote entre eux : proposer de l'y ajouter (Fred, 27/11 : « modifier un entraxe »)
  if(d.k!=='dia'&&d.k!=='angle')sks.forEach(sk=>{const E=bySk.get(sk);if(E.length!==2)return;const P=E.map(id=>c3SkPt(sk,id));if(!P[0]||!P[1])return;
    if((sk.dims||[]).some(m=>m&&m.type==='distance'&&((m.a===P[0]&&m.b===P[1])||(m.a===P[1]&&m.b===P[0]))))return;
    out.push({drv:{t:'newdim',sk:sk.id,a:E[0],b:E[1]},lib:'Ajouter la cote d’entraxe à '+(sk.name||sk.id),s:1,held:null});});
  // les plus récentes d'abord (une fonction plus tardive bouge moins de choses) ; une cote d'entraxe à ajouter en tête
  const rank=c=>{if(c.drv.t==='newdim')return 1e9;const R=c3DrvFind(c.drv);if(!R)return -1;if(c.drv.t==='feat')return (doc.features||[]).indexOf(R.f)*2+1;return c3SkRank(R.sk)*2;};
  return out.map((c,i)=>({c,i})).sort((a,b)=>(rank(b.c)-rank(a.c))||(a.i-b.i)).map(x=>x.c);
}
function c3HoleCenterIdx(sk,P,d,k){
  // centre de perçage dont l'axe passe par la cote (face sans numéro de centre) : le plus proche de l'axe lu
  const g=C3G.get(d);if(!g||!P.length||typeof occW!=='function')return -1;
  const on=(d.k==='axe'||k===0)?g.p1:g.p2;if(!on)return -1;
  try{
    const o=c3V(occW(sk,0,0)),nx=c3V(occW(sk,1,0)).sub(o),ny=c3V(occW(sk,0,1)).sub(o),n=new THREE.Vector3().crossVectors(nx,ny).normalize();
    let best=-1,bd=1e9;
    P.forEach((q,i)=>{const w=c3V(occW(sk,q.x,q.y)).sub(on);const dd=w.addScaledVector(n,-w.dot(n)).length();if(dd<bd){bd=dd;best=i;}});
    return bd<1?best:-1;
  }catch(e){return -1;}
}
function c3HoleKeys(f,d){
  // fonction Perçage : le Ø qui vaut la cote (perçage, lamage, alésage, avant-trou, fraisure),
  // ou les profondeurs de ce type de trou — [[clé, pente]]
  if(d.k==='dia'){
    const v=+d.v||0,K=['d','cbD','reamD','stD','csD'].filter(k=>+f[k]>0&&Math.abs(+f[k]-v)<0.01);
    return (K.length?K:['d']).map(k=>[k,1]);
  }
  const K=[];
  if(f.kind==='cbore')K.push('cbH');if(f.kind==='ream')K.push('reamH');if(f.kind==='step')K.push('stH');
  if(f.end!=='through')K.push('depth');
  return K.filter(k=>+f[k]>0).map(k=>[k,null]);
}
function c3SkRank(sk){
  // rang de l'esquisse dans la timeline = rang de la 1re fonction qui l'utilise
  const i=(doc.features||[]).findIndex(f=>f&&f.sketchId===sk.id);return i<0?0:i;
}
/* ── nouvelle valeur : sécante sur le vrai rejeu ── */
function c3Secant(o){
  // o = {p0, v0, T, s0 (pente devinée ou null), apply(p) → {v}|{err}, tol, max}
  // → {ok:true, p, v, s} | {ok:false, msg}
  const tol=o.tol||1e-4,max=o.max||6;
  if(Math.abs(o.v0-o.T)<tol)return {ok:true,p:o.p0,v:o.v0,s:o.s0};
  let s=o.s0&&Math.abs(o.s0)>1e-6?o.s0:1,pA=o.p0,vA=o.v0,tried=false;
  let p=o.p0+(o.T-o.v0)/s;
  for(let it=0;it<max;it++){
    const r=o.apply(p);
    if(r.err||!isFinite(r.v)){
      // premier essai dans le mauvais sens (pente devinée) : l'autre sens
      if(it===0&&!tried&&!(o.s0&&Math.abs(o.s0)>1e-6)){tried=true;s=-s;p=o.p0+(o.T-o.v0)/s;continue;}
      return {ok:false,msg:r.err||'la pièce ne se reconstruit pas'};
    }
    if(Math.abs(r.v-o.T)<tol)return {ok:true,p,v:r.v,s:Math.abs(p-pA)>1e-12?(r.v-vA)/(p-pA):s};
    const sn=Math.abs(p-pA)>1e-12?(r.v-vA)/(p-pA):0;
    if(!(Math.abs(sn)>1e-6))return {ok:false,msg:'ce réglage ne change pas cette cote'};
    pA=p;vA=r.v;s=sn;p=p+(o.T-r.v)/sn;
  }
  return {ok:false,msg:'la cote n’atteint pas '+c3Num(o.T)+' (la pièce ne suit pas ce réglage de façon régulière)'};
}
/* ── la pièce glisse d'une valeur à l'autre : quelques vrais rejeux intermédiaires, image par image ── */
let c3Anim=null;
function c3AnimStart(drv,p0,p1,dt,S0){
  // 1) même maillage avant / après : la forme glisse d'un coup d'image à l'autre (fluide, sans rejeu) ;
  // 2) sinon quelques vrais rejeux intermédiaires. dt = durée d'un rejeu (ms) ; > 350 ms : on saute.
  if(!(isFinite(p0)&&isFinite(p1))||Math.abs(p1-p0)<1e-6)return false;
  if(S0&&c3Morph(S0,Math.abs(p1-p0)))return true;
  if(!(dt>=0)||dt>350)return false;
  try{if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)return false;}catch(e){}
  if(typeof requestAnimationFrame!=='function')return false;
  const N=Math.max(3,Math.min(14,Math.floor(650/(dt+16)))),ease=k=>1-Math.pow(1-k,3);
  const A={drv,p0,p1,N,i:1,last:null};c3Anim=A;
  const step=()=>{
    if(c3Anim!==A)return;
    // quelqu'un d'autre a touché le réglage (annulation, saisie) : on s'arrête là, sans rien forcer
    if(A.last!=null&&Math.abs(c3DrvGet(drv)-A.last)>1e-6){c3Anim=null;return;}
    if(A.i>=N){c3Anim=null;c3AnimSet(drv,p1);return;}
    const v=+(p0+(p1-p0)*ease(A.i/N)).toFixed(4);A.i++;
    if(!c3AnimSet(drv,v)){c3Anim=null;c3AnimSet(drv,p1);return;}
    A.last=v;requestAnimationFrame(step);
  };
  step(); // 1re position tout de suite : l'image suivante ne montre pas déjà la valeur finale
  return true;
}
function c3MeshSnap(){
  // copie des maillages affichés : [{id, mesh, pos, nor, ni}] (rien n'est gardé vivant)
  const out=[];
  try{(bodies||[]).forEach(b=>{const g=b&&b.mesh&&b.mesh.geometry,P=g&&g.attributes&&g.attributes.position;if(!P)return;
    const N=g.attributes.normal;
    // triangles rangés par face (occGroups) et nom de chaque face : l'appariement se fait face par face
    const T=b.shape&&typeof NOMS_TABLES!=='undefined'?NOMS_TABLES.get(b.shape):null;
    out.push({id:b.id,mesh:b.mesh,pos:P.array.slice(),nor:N?N.array.slice():null,ni:g.index?g.index.count:-1,idx:g.index?g.index.array.slice():null,
      grp:(g.userData&&g.userData.occGroups||[]).map(x=>({f:x.f,start:x.start,count:x.count})),nm:T&&Array.isArray(T.f)?T.f.slice():null});});}catch(e){}
  return out;
}
function c3MorphAlign(s0,b,g,len){
  // positions et normales d'avant, rangées comme le maillage d'après : → {p0, n0} | null
  // (Fred, 27/11 : « des glitchs au mouvement ») le noyau range les triangles dans un autre ordre d'un rejeu
  // à l'autre : on apparie chaque face par son nom, avec le même nombre de triangles
  if(g.index||s0.idx)return null;
  const G1=(g.userData&&g.userData.occGroups)||[],T=b.shape&&typeof NOMS_TABLES!=='undefined'?NOMS_TABLES.get(b.shape):null;
  if(!G1.length||!s0.grp||!s0.grp.length||!s0.nm||!T||!Array.isArray(T.f))return null;
  const old=new Map();s0.grp.forEach(x=>{const n=s0.nm[x.f];if(typeof n!=='string'||!n)return;if(old.has(n))old.set(n,null);else old.set(n,x);});
  const p0=new Float32Array(len),n0=s0.nor?new Float32Array(len):null;let cov=0;
  for(const x of G1){
    const n=T.f[x.f],o=typeof n==='string'?old.get(n):null;
    if(!o||o.count!==x.count)return null; // face nouvelle, disparue ou maillée autrement
    const a=o.start*9,l=x.count*9,d=x.start*9;if(a+l>s0.pos.length||d+l>len)return null;
    if(!c3MorphFace(s0.pos,s0.nor,a,g.attributes.position.array,d,x.count,p0,n0))return null;cov+=l;
  }
  return cov===len?{p0,n0}:null;
}
function c3MorphFace(P0,N0,a,P1,d,nt,p0,n0){
  // une face, nt triangles avant (P0 dès a) et après (P1 dès d) : chaque sommet d'après retrouve le sommet d'avant
  // à la même place RELATIVE dans la boîte de la face (le noyau range et coupe les triangles autrement d'un
  // rejeu à l'autre : diagonale inversée…). Face qui change de forme (coin d'un congé qui grandit) → false
  const box=(A,o)=>{const m=[1e9,1e9,1e9],M=[-1e9,-1e9,-1e9];for(let k=0;k<nt*9;k+=3)for(let c=0;c<3;c++){const v=A[o+k+c];if(v<m[c])m[c]=v;if(v>M[c])M[c]=v;}
    return {m,s:[M[0]-m[0],M[1]-m[1],M[2]-m[2]]};};
  const B0=box(P0,a),B1=box(P1,d),TOL=0.02;
  for(let c=0;c<3;c++)if((B0.s[c]<1e-6)!==(B1.s[c]<1e-6))return false; // la face tourne : pas de glissement
  const u=(A,o,B,c)=>B.s[c]<1e-6?0:(A[o]-B.m[c])/B.s[c];
  const G=new Map(),key=(x,y,z)=>x+','+y+','+z,cell=v=>Math.floor(v/0.04);
  for(let k=0;k<nt*9;k+=3){const o=a+k,x=cell(u(P0,o,B0,0)),y=cell(u(P0,o+1,B0,1)),z=cell(u(P0,o+2,B0,2)),kk=key(x,y,z);if(!G.has(kk))G.set(kk,[]);G.get(kk).push(o);}
  for(let k=0;k<nt*9;k+=3){
    const o1=d+k,q=[u(P1,o1,B1,0),u(P1,o1+1,B1,1),u(P1,o1+2,B1,2)],cx=cell(q[0]),cy=cell(q[1]),cz=cell(q[2]);let best=-1,bd=TOL;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let l=-1;l<=1;l++){const L=G.get(key(cx+i,cy+j,cz+l));if(!L)continue;
      for(const o of L){const e=Math.hypot(u(P0,o,B0,0)-q[0],u(P0,o+1,B0,1)-q[1],u(P0,o+2,B0,2)-q[2]);if(e<bd){bd=e;best=o;}}}
    if(best<0)return false;
    for(let c=0;c<3;c++){p0[o1+c]=P0[best+c];if(n0&&N0)n0[o1+c]=N0[best+c];}
  }
  return true;
}
function c3MorphOk(p0,n0,p1,n1,dv){
  // aucun point ne saute plus loin que le réglage ne bouge (marge pour les bras de levier d'une esquisse)
  let big=0;const lim=Math.max(0.05,4*(isFinite(dv)?dv:1e9));
  for(let k=0;k<p1.length;k+=3){const q=Math.hypot(p1[k]-p0[k],p1[k+1]-p0[k+1],p1[k+2]-p0[k+2]);if(q>big)big=q;if(big>lim)return false;}
  // les facettes gardent leur orientation
  if(n1&&n0&&n0.length===n1.length){let bad=0;const nv=n1.length/3;
    for(let k=0;k<n1.length;k+=3)if(n1[k]*n0[k]+n1[k+1]*n0[k+1]+n1[k+2]*n0[k+2]<0.3)bad++;
    if(bad>Math.max(2,nv*0.002))return false;}
  return true;
}
function c3Morph(S0,dv){
  // la forme glisse de S0 (avant) au maillage affiché (après) si chaque corps a le même maillage ; → true | false
  if(!Array.isArray(S0)||!S0.length)return false;
  try{if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)return false;}catch(e){}
  if(typeof requestAnimationFrame!=='function')return false;
  const B=(bodies||[]).filter(b=>b&&b.mesh&&b.mesh.geometry&&b.mesh.geometry.attributes&&b.mesh.geometry.attributes.position);
  if(B.length!==S0.length)return false;
  const M=[];let moved=false;
  for(let i=0;i<B.length;i++){
    const b=B[i],s0=S0[i],g=b.mesh.geometry,P=g.attributes.position,N=g.attributes.normal;
    if(b.id!==s0.id||P.array.length!==s0.pos.length||(g.index?g.index.count:-1)!==s0.ni)return false;
    const p1=P.array.slice();
    const al=c3MorphAlign(s0,b,g,p1.length);if(!al)return false; // faces maillées autrement : vrais rejeux intermédiaires
    let dif=false;for(let k=0;k<p1.length;k++){if(Math.abs(p1[k]-al.p0[k])>1e-6){dif=true;break;}}
    if(!dif)continue;
    if(!c3MorphOk(al.p0,al.n0,p1,N?N.array:null,dv))return false;
    moved=true;
    M.push({g,P,N,p0:al.p0,p1,n0:N&&al.n0&&al.n0.length===N.array.length?al.n0:null,n1:N?N.array.slice():null,mesh:b.mesh});
  }
  if(!moved)return false;
  const eo=typeof scene!=='undefined'&&scene.getObjectByName?scene.getObjectByName('edgeOverlay'):null,ev=eo?eo.visible:false;
  if(eo)eo.visible=false; // les arêtes affichées sont celles d'arrivée : cachées pendant le glissement
  const t0=c3Now(),dur=450,A={morph:true};c3Anim=A;
  const put=e=>{M.forEach(m=>{const a=m.P.array;for(let k=0;k<a.length;k++)a[k]=m.p0[k]+(m.p1[k]-m.p0[k])*e;m.P.needsUpdate=true;
    if(m.n0&&m.N){const n=m.N.array;for(let k=0;k<n.length;k++)n[k]=m.n0[k]+(m.n1[k]-m.n0[k])*e;m.N.needsUpdate=true;}});};
  const fin=()=>{put(1);M.forEach(m=>{try{m.g.computeBoundingSphere();m.g.computeBoundingBox();}catch(e){}});if(eo)eo.visible=ev;if(c3Anim===A)c3Anim=null;c3Wake();};
  A.fin=fin;
  const step=()=>{
    if(c3Anim!==A){return;}
    if(M.some(m=>!(bodies||[]).some(b=>b&&b.mesh===m.mesh))){c3Anim=null;if(eo)eo.visible=ev;return;} // rejeu entre-temps : rien à finir
    const k=Math.min(1,(c3Now()-t0)/dur),e=1-Math.pow(1-k,3);
    if(k>=1){fin();return;}
    put(e);c3Wake();requestAnimationFrame(step);
  };
  put(0);requestAnimationFrame(step);
  return true;
}
function c3AnimSet(drv,v){const r=c3DrvSet(drv,v);if(r!==true)return false;return c3Rebuild();}
function c3AnimEnd(){const A=c3Anim;if(!A)return;if(A.morph){if(A.fin)A.fin();c3Anim=null;return;}c3Anim=null;try{if(A.last==null||Math.abs(c3DrvGet(A.drv)-A.last)<1e-6)c3AnimSet(A.drv,A.p1);}catch(e){}}
function c3Round(p){const q=Math.round(p*1e4)/1e4;return Math.abs(q-p)<1e-6?q:p;}
function c3Rebuild(){try{markDirty();}catch(e){}try{rebuild();}catch(e){return false;}return typeof builtEngine==='undefined'||builtEngine==='exact';}
function c3SetValue(d,T){
  // → true | message ; une seule annulation ; le réglage revient en cas d'échec
  if(!d.drive)return 'cote de référence : elle suit la pièce';
  if(!(T>0))return 'tape une valeur positive';
  c3AnimEnd();
  const p0=c3DrvGet(d.drive);if(!isFinite(p0))return 'le réglage piloté n’existe plus';
  const g0=c3Refresh(d);if(g0.err)return g0.err;
  if(Math.abs(g0.v-T)<1e-4)return true;
  const S0=c3MeshSnap();
  const n0=typeof docUndoStack!=='undefined'?docUndoStack.length:0;
  try{docPushUndo('Cote 3D '+c3Num(T));}catch(e){}
  const pushed=typeof docUndoStack!=='undefined'&&docUndoStack.length>n0;
  let dt=0;
  const apply=p=>{
    p=c3Round(p);
    const r=c3DrvSet(d.drive,p);if(r!==true)return {err:r};
    const t0=c3Now();if(!c3Rebuild())return {err:'la pièce ne se reconstruit pas avec ce réglage'};dt=Math.max(dt,c3Now()-t0);
    const g=c3Read(d);return g.err?{err:g.err}:{v:g.v};
  };
  const R=c3Secant({p0,v0:g0.v,T,s0:d.slope||null,apply});
  if(R.ok){d.slope=R.s;c3Refresh(d);c3List().forEach(x=>{if(x!==d)try{c3Refresh(x);}catch(e){}});c3.cardK='';
    try{c3AnimStart(d.drive,p0,c3DrvGet(d.drive),dt,S0);}catch(e){}
    return true;}
  // retour à l'état d'avant
  try{c3DrvSet(d.drive,p0);c3Rebuild();}catch(e){}
  try{if(pushed&&docUndoStack.length>n0){docUndoStack.pop();if(typeof docBaseSync==='function')docBaseSync(docSnap());if(typeof docUndoUI==='function')docUndoUI();}}catch(e){}
  c3List().forEach(x=>{try{c3Refresh(x);}catch(e){}});c3.cardK='';
  return R.msg;
}
/* ── créer, choisir, supprimer ── */
function c3New(a,b,k){
  const d={id:'c3_'+Date.now().toString(36)+(++c3.seq),k:k==='dia'?'dia':k,a,b:b||null,v:0,drive:null,tol:null,pre:'',post:'',prec:null,gdt:[]};
  return d;
}
function c3Add(d){
  if(c3.hidden)c3Hide(false);
  if(!d.name&&!c3IsNote(d))d.name=c3NameNext();
  try{docPushUndo('Cote 3D');}catch(e){}
  c3List().push(d);c3Refresh(d);
  try{c3Dirty();}catch(e){}
  c3Select(d);
}
function c3Remove(d){
  const L=c3List(),i=L.indexOf(d);if(i<0)return;
  try{docPushUndo('Supprimer la cote 3D');}catch(e){}
  L.splice(i,1);if(c3.sel===d)c3.sel=null;
  const el=c3.els.get(d.id);if(el){el.g.remove();el.lab.remove();c3.els.delete(d.id);}
  try{c3Dirty();}catch(e){}c3.cardK='';c3Wake();
}
function c3Select(d){c3.sel=d||null;c3.cardK='';c3Wake();}
function c3SkPt(sk,id){const e=(sk.entities||[]).find(x=>x&&x.id===id);return e?(e.t==='cpoint'?e.p:(e.t==='circle'||e.t==='arc')?e.pc:null):null;}
function c3NewSkDim(drv){
  // ajoute à l'esquisse la cote de distance entre deux centres → {t:'dim'} | message ; essayée d'abord sur une copie
  const sk=c3Sk(drv.sk);if(!sk)return 'esquisse introuvable';
  const a=drv.pa||c3SkPt(sk,drv.a),b=drv.pb||c3SkPt(sk,drv.b),A=sk.points&&sk.points[a],B=sk.points&&sk.points[b];if(!A||!B)return 'centres introuvables';
  const v=Math.hypot(B.x-A.x,B.y-A.y);if(!(v>1e-6))return 'centres confondus';
  let id=1;(sk.dims||[]).forEach(m=>{const k=/^d(\d+)$/.exec(m&&m.id||'');if(k)id=Math.max(id,+k[1]+1);});
  while((sk.dims||[]).some(m=>m&&m.id==='d'+id))id++;
  const dm={id:'d'+id,type:'distance',a,b,value:v,ox:0,oy:0};
  try{ // la cote doit pouvoir bouger : essai à +1 sur une copie
    const cl=c3SkClone(sk);(cl.dims=cl.dims||[]).push(Object.assign({},dm,{value:v+1}));solveSketch(cl);
    const A2=cl.points[a],B2=cl.points[b];
    if((typeof skResid==='function'&&typeof SK_OK_RES!=='undefined'&&skResid(cl)>SK_OK_RES)||Math.abs(Math.hypot(B2.x-A2.x,B2.y-A2.y)-(v+1))>1e-3)
      return 'les deux centres sont déjà placés par d’autres cotes de l’esquisse : choisis l’une d’elles';
  }catch(e){return 'esquisse : '+(e.message||'essai impossible');}
  try{docPushUndo(drv.pb?'Cote du rayon ajoutée à l’esquisse':'Cote d’entraxe ajoutée à l’esquisse');}catch(e){}
  (sk.dims=sk.dims||[]).push(dm);try{solveSketch(sk);markDirty();}catch(e){}
  return {t:'dim',sk:sk.id,d:dm.id};
}
function c3SetDrive(d,drv){
  // pilote ce réglage ; une autre cote qui le tenait passe en référence
  try{docPushUndo('Cote 3D pilotante');}catch(e){}
  const o=drv?c3Holder(drv,d):null;if(o){o.drive=null;delete o.slope;}
  d.drive=drv||null;delete d.slope;
  try{c3Dirty();}catch(e){}c3.cardK='';c3Wake();
  return o;
}
/* ── l'outil ── */
function c3ToolStart(){
  if(c3.hidden)c3Hide(false);
  if(typeof occHas!=='function'||!occHas()){c3Say('Cote 3D : le noyau exact (OCCT) est requis.',true);return;}
  try{if(typeof parMesPick!=='undefined'&&parMesPick)parMesPickCancel(false);}catch(e){}
  try{clearMeasure();}catch(e){}
  c3Tool={a:null};c3.choice=null;
  try{renderer.domElement.style.cursor='crosshair';}catch(e){}
  c3BtnSync();c3Say('');c3BandSync();
}
function c3ToolStop(){
  c3Tool=null;c3EdgeHl(null);try{renderer.domElement.style.cursor='default';}catch(e){}try{clearMeasure();}catch(e){}
  c3BtnSync();c3BandSync();c3Wake();
}
function c3PickAt(e){
  if(!c3Tool)return false;
  if(c3Tool.ord)return c3OrdPick(e); // ordonnées posées en 3D
  const h=typeof pick==='function'?pick(e):null;
  // une arête près du curseur passe avant la face
  const EH=c3EdgeRefAt(e,h),VH=EH?c3VtxAt(e,EH):null;
  if(VH){
    if(!c3Tool.a){c3Tool.a={ref:VH.ref,cy:false,pt:null};c3VtxHl(VH.p);c3Say('');c3BandSync();c3Wake();return true;}
    return c3MixMake(VH.ref);
  }
  if(EH){
    if(!c3Tool.a){c3Tool.a={ref:EH.ref,cy:EH.G.kind==='circle',edge:EH.G.kind,pt:null};c3EdgeHl(EH.P);c3Say('');c3BandSync();c3Wake();return true;}
    if(!c3Tool.a.ref.edge)return c3MixMake(EH.ref); // face ou sommet ↔ arête
    if(c3Tool.a.ref.en&&c3Tool.a.ref.en===EH.ref.en&&c3Tool.a.ref.pos.join()===EH.ref.pos.join()){if(c3Tool.a.cy){c3MakeDia();return true;}c3Say('Cote 3D : c’est la même arête, clique-en une autre.',true);return true;}
    const GA=c3EdgeFind(c3Tool.a.ref),r=GA?c3EdgePair(GA,EH.G):{err:'1re arête introuvable'};
    if(r.err){c3Say('Cote 3D : '+r.err+'.',true);return true;}
    const d=c3New(c3Tool.a.ref,EH.ref,r.k);
    c3ToolStop();c3Add(d);c3AskDrive(d,true);return true;
  }
  if(c3Tool.a&&(c3Tool.a.ref.edge||c3Tool.a.ref.vtx)){
    // arête ou sommet ↔ face
    if(!h){c3Say('Cote 3D : clique une face, une arête ou un sommet de la pièce.',true);return true;}
    const R2=parMesRefOfHit(h.object,h.faceIndex);if(!R2){c3Say('Cote 3D : face illisible.',true);return true;}
    occFree(R2.face);return c3MixMake(R2.ref);
  }
  if(!h){c3Say('Cote 3D : clique une face ou une arête de la pièce.',true);return true;}
  const R=parMesRefOfHit(h.object,h.faceIndex);
  if(!R){c3Say('Cote 3D : face illisible (seules les faces des corps de la pièce se cotent).',true);return true;}
  let cy=false;try{cy=occSurfDesc(R.face).k==='cy';}catch(err){}
  if(!cy){const o=c3Owner(R.ref&&R.ref.nom);if(o&&o.what==='chanfrein')cy=true;} // chanfrein : coté seul (« 3 × 45° »)
  if(!c3Tool.a){
    occFree(R.face);
    c3Tool.a={ref:R.ref,cy,pt:h.point?h.point.clone():null};
    try{highlightTris(h.object,faceTrisFor(h.object,h.faceIndex),0xff9f0a,0.55);}catch(err){}
    c3Say('');c3BandSync();c3Wake();return true;
  }
  const A=parMesFace(c3Tool.a.ref);let r=null,plans=false;
  try{
    if(!A)r={err:'1re face introuvable'};
    else if(A.face.IsSame(R.face))r={same:true};
    else{r=parMesCalc(A.face,R.face);try{plans=occSurfDesc(A.face).k==='pl'&&occSurfDesc(R.face).k==='pl';}catch(x){}}
  }catch(err){r={err:err.message||'mesure impossible'};}
  finally{if(A)occFree(A.face);occFree(R.face);}
  if(r.same){if(c3Tool.a.cy){c3MakeDia();return true;}c3Say('Cote 3D : c’est la même face, clique-en une autre.',true);return true;}
  if(r.err){c3Say('Cote 3D : '+r.err+'.',true);return true;}
  if(r.k==='mini'&&!plans){c3Say('Cote 3D : ces deux faces ne sont pas parallèles — choisis deux faces face à face, deux plans pour un angle, deux cylindres ou un cylindre et une face.',true);return true;}
  const d=c3New(c3Tool.a.ref,R.ref,r.k==='mini'?'angle':r.k);
  const same=c3List().find(x=>x.k===d.k&&x.k!=='dia'&&((c3SameRef(x.a,d.a)&&c3SameRef(x.b,d.b))||(c3SameRef(x.a,d.b)&&c3SameRef(x.b,d.a))));
  c3ToolStop();
  if(same){c3Select(same);c3Say('Cette cote existe déjà.');return true;}
  c3Add(d);c3AskDrive(d,true);
  return true;
}
function c3MakeNote(k){
  // référence (A, B…) ou rugosité posée là où l'on a cliqué la face
  if(!c3Tool||!c3Tool.a)return;
  const a=c3Tool.a,d=c3New(a.ref,null,k);
  if(k==='datum')d.l=c3NextLetter();
  if(k==='rough')d.r={par:(c3.rgLast&&c3.rgLast.par)||'Ra',val:(c3.rgLast&&c3.rgLast.val)||'3.2',proc:(c3.rgLast&&c3.rgLast.proc)||'remove',txt:''};
  c3ToolStop();
  c3Add(d);
  // point cliqué, mémorisé par rapport au centre de la face (la note suit la face)
  try{const A=parMesFace(d.a),b=A&&c3Box(A.face);if(A)occFree(A.face);if(b&&a.pt){const v=a.pt.clone().sub(b.c);d.at=[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)];c3Refresh(d);}}catch(e){}
  c3Say(k==='datum'?'Référence '+d.l+' posée — la lettre se change dans sa carte.':'Rugosité posée — paramètre, valeur et procédé dans sa carte.');
}
function c3SameRef(a,b){return !!(a&&b&&a.nom&&a.nom===b.nom);}
function c3MakeDia(){
  if(!c3Tool||!c3Tool.a||!c3Tool.a.cy)return;
  const d=c3New(c3Tool.a.ref,null,'dia');
  // chanfrein distance + angle coté à la main : lire le côté de la distance, pour qu'elle se pilote
  if(c3IsCham(d)){try{const g=c3Read(d);if(g&&!g.err&&isFinite(g.l2)){const F=(doc.features||[]).filter(x=>x&&x.type==='xfillet'&&x.chamfer&&x.cmode==='da'&&Array.isArray(x.edges));
    const has=r=>F.some(x=>x.edges.some(e=>e&&Math.abs(+e.r-r)<1e-3));if(!has(+g.v)&&has(+g.l2))d.chs=true;}}catch(e){}}
  const same=c3List().find(x=>x.k==='dia'&&c3SameRef(x.a,d.a));
  c3ToolStop();
  if(same){c3Select(same);c3Say('Cette cote existe déjà.');return;}
  c3Add(d);c3AskDrive(d,true);
}
function c3AskDrive(d,neuve){
  // bandeau « Qu'est-ce qui bouge ? » ; neuve : la saisie s'ouvre ensuite (cote à la création)
  let C=[];try{C=c3Candidates(d);}catch(e){C=[];}
  c3.choice={d,C,neuve:!!neuve};c3BandSync();c3Wake();
}
function c3Choose(i){
  const ch=c3.choice;if(!ch)return;const d=ch.d;c3.choice=null;
  if(i==='ref'){c3SetDrive(d,null);c3Say('Cote de référence : elle suit la pièce.');c3BandSync();return;}
  if(i==='x'){c3BandSync();return;}
  const c=ch.C[i];if(!c)return;
  let drv=c.drv,lib=c.lib;
  if(drv.t==='newdim'){const r=c3NewSkDim(drv);if(typeof r==='string'){c3Say('Refusé : '+r+'.',true);c3.choice=ch;c3BandSync();return;}drv=r;lib=c3DrvLib(drv);}
  const o=c3SetDrive(d,drv);if(c.s!=null)d.slope=c.s;
  c3Say('Pilote '+lib+(o?' · la cote '+c3Num(o.v)+' passe en référence':'')+'.');
  c3BandSync();
  if(ch.neuve)setTimeout(()=>c3EditStart(d),0);
}
/* ── dessin par-dessus la vue ── */
function c3Css(){
  if(typeof document==='undefined'||document.getElementById('c3Css'))return;
  const s=document.createElement('style');s.id='c3Css';
  s.textContent=[
    '#c3Layer{position:absolute;pointer-events:none;z-index:6;overflow:hidden;font-family:inherit}',
    '#c3Svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}',
    '#c3Svg>g{filter:drop-shadow(0 0 1.2px rgba(0,0,0,.95))}.c3clair #c3Svg>g{filter:drop-shadow(0 0 1.3px #fff) drop-shadow(0 0 .6px #fff)}',
    '.c3lab{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;padding:2px 6px;border-radius:5px;background:rgba(16,20,27,.82);color:'+C3_BLEU+';font:600 13px/1.15 "Segoe UI",system-ui,sans-serif;white-space:nowrap;user-select:none;font-variant-numeric:tabular-nums}',
    '.c3lab.r{color:'+C3_GRIS+'}.c3lab.s{color:'+C3_ORANGE+';box-shadow:0 0 0 1.5px '+C3_ORANGE+'}.c3lab.e{color:'+C3_ROUGE+';box-shadow:0 0 0 1.5px '+C3_ROUGE+'}',
    '.c3lab .v{display:flex;align-items:center;gap:3px}.c3lab .t{font-size:11px}.c3lab .k{display:inline-flex;flex-direction:column;font-size:9.5px;line-height:1;gap:1px}.c3lab .k i{font-style:normal}',
    '.c3lab .f{display:inline-flex;border:1.3px solid #e8edf5;color:#e8edf5;background:rgba(16,20,27,.9);font:500 12px/1 "Segoe UI",system-ui,sans-serif}',
    '.c3lab .f b{font-weight:500;padding:3px 5px;border-left:1.3px solid #e8edf5}.c3lab .f b:first-child{border-left:0;font-size:13px}',
    '#c3Menu{position:fixed;z-index:9999;display:none;flex-direction:column;min-width:220px;padding:4px;border-radius:8px;background:#1f2228;border:1px solid rgba(255,255,255,.12);box-shadow:0 8px 24px rgba(0,0,0,.4)}',
    '#c3Menu button{all:unset;cursor:pointer;padding:6px 10px;border-radius:5px;color:#e8edf5;font-size:13px}#c3Menu button:hover{background:rgba(77,163,255,.18)}',
    '.c3lab{background:rgba(14,18,25,.92);border:1px solid rgba(255,255,255,.18);box-shadow:0 1px 5px rgba(0,0,0,.5)}',
    '.c3clair .c3lab{background:rgba(255,255,255,.95);border-color:rgba(20,30,45,.22);box-shadow:0 1px 5px rgba(20,30,45,.28);color:'+C3_CLAIR.bleu+'}',
    '.c3clair .c3lab.r{color:'+C3_CLAIR.gris+'}.c3clair .c3lab.n{color:'+C3_CLAIR.note+'}',
    '.c3clair .c3lab.s,.c3clair .c3lab.n.s{color:'+C3_CLAIR.orange+';box-shadow:0 0 0 1.5px '+C3_CLAIR.orange+'}.c3clair .c3lab.e{color:'+C3_CLAIR.rouge+';box-shadow:0 0 0 1.5px '+C3_CLAIR.rouge+'}',
    '.c3clair .c3lab .f{border-color:'+C3_CLAIR.note+';color:'+C3_CLAIR.note+';background:#fff}.c3clair .c3lab .f b{border-left-color:'+C3_CLAIR.note+'}',
    '.c3lab .bx{display:inline-flex;align-items:center;gap:3px;border:1.4px solid currentColor;padding:1px 4px}',
    '.c3lab .ip{display:inline-flex;align-items:stretch;border:1.4px solid currentColor;border-radius:999px;overflow:hidden}.c3lab .ip>b{font-weight:600;padding:1px 6px;display:flex;align-items:center}',
    '.c3lab .ip>b:first-child{border-right:1.2px solid currentColor}.c3lab .ip>b:last-child{border-left:1.2px solid currentColor}.c3lab .ip .iv{display:flex;align-items:center;gap:3px;padding:1px 6px}',
    '.c3lab .hv{cursor:text;border-bottom:1px dotted currentColor}.c3lab .hv input{width:58px}',
    '.c3lab.al{align-items:flex-start}.c3lab.ar{align-items:flex-end}.c3lab.ar .hb{align-items:flex-end}',
    '.c3lab .hb{display:flex;flex-direction:column;align-items:flex-start;gap:2px}.c3lab .hl{display:flex;align-items:center;gap:4px}.c3lab .hl.o{font-weight:500;opacity:.85}',
    '.c3lab.n{color:#e8edf5}.c3lab.n.s{color:'+C3_ORANGE+'}.c3lab .dt{display:inline-block;min-width:16px;text-align:center;padding:2px 4px;border:1.4px solid currentColor;font-weight:600}.c3lab .rg{flex:none}',
    '.c3lab input{width:76px;font:600 14px "Segoe UI",system-ui,sans-serif;text-align:center;border:1.5px solid '+C3_ORANGE+';border-radius:4px;padding:2px 4px;background:#0d131c;color:#fff}',
    '#c3Band{position:absolute;left:50%;transform:translateX(-50%);display:none;flex-wrap:wrap;align-items:center;gap:6px;max-width:calc(100% - 28px);box-sizing:border-box;padding:7px 8px 7px 12px;border-radius:10px;background:rgba(13,23,36,.97);border:1px solid #2c3d56;box-shadow:0 10px 28px rgba(0,0,0,.45);color:#e8edf5;font-size:12.5px;pointer-events:auto}',
    '#c3Band .q{font-weight:600;margin-right:2px}#c3Band .q.err{color:'+C3_ROUGE+'}',
    '#c3Band button{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:7px;border:1px solid #3a4d68;background:#1a2333;color:#e8edf5;font:inherit;cursor:pointer}',
    '#c3Band button:hover{border-color:'+C3_BLEU+'}#c3Band button.pri{background:'+C3_BLEU+';border-color:'+C3_BLEU+';color:#06111f;font-weight:600}#c3Band button small{opacity:.72;font-size:11px}',
    '#c3Card{position:absolute;right:14px;width:300px;box-sizing:border-box;display:none;flex-direction:column;gap:8px;padding:10px 12px;border-radius:12px;background:rgba(13,23,36,.97);border:1px solid #2c3d56;box-shadow:0 10px 30px rgba(0,0,0,.45);color:#e8edf5;font-size:12.5px;pointer-events:auto;overflow:auto}',
    '#c3Card h4{margin:0;font-size:13px;font-weight:600;line-height:1.3;padding-right:20px}#c3Card .x{position:absolute;right:8px;top:6px;border:0;background:none;color:#9fb0c6;font-size:15px;cursor:pointer}',
    '#c3Card .chip{display:inline-block;font-size:11px;font-weight:600;padding:0 7px;line-height:18px;border-radius:9px}#c3Card .chip.d{background:'+C3_BLEU+';color:#06111f}#c3Card .chip.r{border:1px solid '+C3_GRIS+';color:'+C3_GRIS+';line-height:16px}',
    '#c3Card .drv{padding:6px 8px;border-radius:7px;background:#16202e;color:#c5cfdc}#c3Card .drv b{color:#fff;font-weight:600}',
    '#c3Card .seg{display:flex;border:1px solid #3a4d68;border-radius:7px;overflow:hidden}#c3Card .seg button{flex:1;padding:5px;border:0;background:#16202e;color:#e8edf5;font:inherit;cursor:pointer}#c3Card .seg button.on{background:'+C3_BLEU+';color:#06111f;font-weight:600}#c3Card .seg button+button{border-left:1px solid #3a4d68}',
    '#c3Card .row{display:flex;align-items:center;gap:8px}#c3Card .row>label{flex:none;width:86px;color:#9fb0c6}#c3Card .row>input,#c3Card .row>select{flex:1;min-width:0}',
    '#c3Card input,#c3Card select{font:inherit;padding:3px 6px;border:1px solid #3a4d68;border-radius:6px;background:#0d131c;color:#e8edf5}',
    '#c3Card .sec{display:flex;flex-direction:column;gap:6px;padding-top:8px;border-top:1px solid #23324a}#c3Card .sec>.h{font-size:10.5px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:#8fa0b6}',
    '#c3Card .fc{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:6px;border:1px dashed #3a4d68;border-radius:7px}#c3Card .fc input[type=number]{width:62px}#c3Card .fc .w{flex-basis:100%;font-size:11.5px;color:'+C3_ROUGE+'}',
    '#c3Card .note{font-size:11.5px;color:#9fb0c6;line-height:1.4}#c3Card .note b{color:#e8edf5}#c3Card .act{display:flex;gap:6px}#c3Card .act button{flex:1;height:28px;border-radius:7px;border:1px solid #3a4d68;background:#16202e;color:#e8edf5;font:inherit;cursor:pointer}',
    '#c3Card label.ck{display:flex;align-items:center;gap:6px}',
    '#viewbar #btnC3.on{background:'+C3_BLEU+'!important;border-color:'+C3_BLEU+'!important;color:#06111f!important}',
    'body[data-ws="plan"] #c3Layer,body[data-ws="fao"] #c3Layer,body[data-ws="rendu"] #c3Layer{display:none!important}'
  ].join('\n');
  document.head.appendChild(s);
}
function c3Canvas(){try{return renderer&&renderer.domElement;}catch(e){return null;}}
function c3LayerSync(){
  const c=c3Canvas();if(!c||!c.parentNode||typeof document==='undefined')return null;
  let L=c3.layer;
  if(!L||!L.isConnected){
    c3Css();
    L=document.getElementById('c3Layer');
    if(!L){L=document.createElement('div');L.id='c3Layer';c.parentNode.insertBefore(L,c.nextSibling);}
    c3.layer=L;L.innerHTML='';c3.els.clear();
    const S=document.createElementNS('http://www.w3.org/2000/svg','svg');S.id='c3Svg';S.setAttribute('aria-hidden','true');L.appendChild(S);c3.svg=S;
    const B=document.createElement('div');B.id='c3Band';B.setAttribute('role','region');B.setAttribute('aria-live','polite');B.setAttribute('aria-label','Cote 3D');
    B.addEventListener('pointerdown',e=>e.stopPropagation());B.addEventListener('click',c3BandClick);L.appendChild(B);c3.band=B;
    const K=document.createElement('div');K.id='c3Card';K.setAttribute('role','region');K.setAttribute('aria-label','Propriétés de la cote 3D');
    K.addEventListener('pointerdown',e=>e.stopPropagation());K.addEventListener('keydown',e=>e.stopPropagation());L.appendChild(K);c3.card=K;
    c3BandSync();
  }
  const cl=c3FondClair();if(cl!==!!c3.clair||!L.classList.contains(cl?'c3clair':'c3nuit')){c3.clair=cl;L.classList.toggle('c3clair',cl);L.classList.toggle('c3nuit',!cl);}
  const k=c.offsetLeft+','+c.offsetTop+','+c.clientWidth+','+c.clientHeight;
  if(L.dataset.k!==k){L.dataset.k=k;Object.assign(L.style,{left:c.offsetLeft+'px',top:c.offsetTop+'px',width:c.clientWidth+'px',height:c.clientHeight+'px'});}
  return L;
}
function c3Top(){
  // sous la barre de vue et le cube (comme les variantes de la pièce qui propose)
  const L=c3.layer;if(!L)return 14;const lr=L.getBoundingClientRect();let top=14;
  ['viewbar','mfCube'].forEach(id=>{const e=document.getElementById(id);if(!e)return;const q=e.getBoundingClientRect();
    if(q.width>0&&q.right>lr.right-340&&q.top<lr.top+260)top=Math.max(top,q.bottom-lr.top+10);});
  return top;
}
function c3BandSync(){
  const B=c3.band;if(!B)return;
  let h='',show=false;
  const msg=c3.msg&&c3Now()-c3.msgT<6000?c3.msg:'';
  if(c3.choice){
    const ch=c3.choice,free=ch.C.filter(c=>!c.held);show=true;
    h+='<span class="q">'+(free.length>1?'Qu’est-ce qui bouge ?':free.length===1?'Cette cote pilotera :':ch.C.length?'Tout ce qui la change est déjà coté :':'Rien ne pilote cette cote :')+'</span>';
    let first=true;
    ch.C.forEach((c,i)=>{h+='<button type="button" data-c="'+i+'" class="'+(first&&!c.held?'pri':'')+'" title="'+c3Esc('Pilote '+c.lib+(c.held?' ; la cote '+c3Num(c.held.v)+' passe en référence':''))+'">'
      +(c.held?'À la place de '+c3Esc(c3Num(c.held.v))+' : ':'')+c3Esc(c.lib)+'</button>';if(!c.held)first=false;});
    h+='<button type="button" data-c="ref">Cote de référence</button>';
    if(c3PolarRep(ch.d))h+=ch.d.k==='axe'?'<button type="button" data-c="polar" title="Coter l’angle du trou autour de l’axe de la répétition circulaire, depuis cette face (sa normale ; ↻ dans la carte : le long de la face)">Angle depuis la face</button>'
      :'<button type="button" data-c="polar" title="Coter l’angle entre ces deux trous autour de l’axe de la répétition circulaire, au lieu de leur entraxe">Angle autour de l’axe</button>';
    h+='<button type="button" data-c="x" title="Garder telle quelle (Échap)">✕</button>';
  }else if(c3Tool){
    show=true;
    if(c3Tool.ord)h+='<span class="q">Ordonnées depuis '+c3Esc(c3FaceLib(c3Tool.ord.z))+' : clique chaque face ou trou à coter</span>';
    else if(!c3Tool.a)h+='<span class="q">Cote 3D : clique une face, un cylindre ou un trou</span>';
    else h+='<span class="q">Cote 3D : '+c3Esc(c3FaceLib(c3Tool.a.ref))+(c3Tool.a.ref.vtx?', puis une face, une arête ou un autre sommet':c3Tool.a.ref.edge?', puis une arête, une face ou un sommet':', puis la deuxième face (ou une arête, un sommet)')+'</span>'+(c3Tool.a.cy?'<button type="button" data-c="dia" class="pri">'+(((c3Owner(c3Tool.a.ref&&c3Tool.a.ref.nom)||{}).what==='chanfrein'&&!c3Tool.a.ref.edge)?'Coter le chanfrein':(c3Tool.a.ref.arc||((c3Owner(c3Tool.a.ref&&c3Tool.a.ref.nom)||{}).what==='conge'))?'Coter le rayon':'Coter le Ø')+'</button>':'')
      +(c3Tool.a.cy&&!c3Tool.a.ref.edge&&c3CircRep(c3Tool.a.ref)?'<button type="button" data-c="pcd" title="Ø du cercle de perçage des trous de cette répétition circulaire : cercle d’axe et traits d’axe de tous les trous">Ø de perçage</button>'
        +'<button type="button" data-c="hax" title="Angle de ce trou autour de l’axe de la répétition, depuis l’axe horizontal (↻ dans la carte : depuis l’axe vertical)">Angle depuis l’axe</button>':'')
      +(c3Tool.a.ref.edge||c3Tool.a.ref.vtx||c3Tool.ord?'':'<button type="button" data-c="ord" title="Cotes d’ordonnées : cette face (ou ce trou) est le zéro ; cliquez ensuite chaque face ou trou à coter">Ordonnées</button>')
      +(c3Tool.a.ref.edge||c3Tool.a.ref.vtx?'':'<button type="button" data-c="datum" title="Référence (ISO 5459) posée sur cette face">Référence '+c3NextLetter()+'</button><button type="button" data-c="rough" title="État de surface (ISO 1302) de cette face">Rugosité</button>');
    if(msg)h+='<span class="q'+(c3.msgBad?' err':'')+'">'+c3Esc(msg)+'</span>';
    h+='<button type="button" data-c="stop" title="Terminer (Échap)">✕</button>';
  }else if(msg){show=true;h+='<span class="q'+(c3.msgBad?' err':'')+'">'+c3Esc(msg)+'</span>';}
  if(B.innerHTML!==h)B.innerHTML=h;
  B.style.display=show?'flex':'none';
  if(show)B.style.top=c3Top()+'px';
}
function c3BandClick(e){
  const b=e.target&&e.target.closest&&e.target.closest('button');if(!b)return;e.stopPropagation();
  const c=b.dataset.c;
  if(c==='stop'){c3ToolStop();return;}
  if(c==='dia'){c3MakeDia();return;}
  if(c==='datum'||c==='rough'){c3MakeNote(c);return;}
  if(c==='ord'){c3OrdStart();return;}
  if(c==='polar'){c3MakePolar();return;}
  if(c==='pcd'){c3MakePcd(c3Tool&&c3Tool.a&&c3Tool.a.ref);return;}
  if(c==='hax'){c3MakeHax(c3Tool&&c3Tool.a&&c3Tool.a.ref);return;}
  if(c==='ref'||c==='x'){c3Choose(c);return;}
  c3Choose(+c);
}
function c3Proj(p,W,H){const v=new THREE.Vector3(p.x,p.y,p.z).project(camera);return [(v.x+1)/2*W,(1-v.y)/2*H,v.z];}
function c3Arrow(p,q){const dx=p[0]-q[0],dy=p[1]-q[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l,s=8,w=2.6;
  return 'M'+p[0].toFixed(1)+','+p[1].toFixed(1)+'L'+(p[0]-ux*s-uy*w).toFixed(1)+','+(p[1]-uy*s+ux*w).toFixed(1)+'L'+(p[0]-ux*s+uy*w).toFixed(1)+','+(p[1]-uy*s-ux*w).toFixed(1)+'Z';}
function c3PartBox(){
  const B=new THREE.Box3();try{(bodies||[]).forEach(b=>{if(b&&b.mesh&&!b.ghost&&b.mesh.visible!==false)B.expandByObject(b.mesh);});}catch(e){}
  return B;
}
function c3SlideEdge(g,u){
  // cote posée sur l'arête vue des faces cotées (ex. au niveau du dessus), pas à mi-hauteur derrière la pièce
  const vd=new THREE.Vector3();camera.getWorldDirection(vd);
  const w=new THREE.Vector3().crossVectors(g.n,u).normalize();if(w.dot(vd)>0)w.negate(); // w vers la caméra
  let e=null;
  [[g.bA,g.p1],[g.bB,g.p2]].forEach(x=>{if(!x[0])return;const v=w.dot(x[0].c.clone().sub(x[1]))+c3Half(x[0].h,w);e=e==null?v:Math.min(e,v);});
  if(e==null||!(e>0))return 0;
  const n=new THREE.Vector3().crossVectors(g.n,u).normalize();
  return +(e*(n.dot(w)>0?1:-1)).toFixed(3);
}
function c3Side(d,g){
  // Report de la cote : le long d'un AXE de la pièce perpendiculaire à la mesure (la cote est
  // couchée dans le plan d'une face, lignes d'attache parallèles aux arêtes, comme la maquette).
  // Choisi à la création : le plan de la cote face à la caméra, du côté vu, vers l'extérieur.
  // d.off = marge au-delà de la pièce : la cote suit la pièce quand elle grandit.
  const B=c3PartBox(),c=B.isEmpty()?g.p1.clone():B.getCenter(new THREE.Vector3()),h=B.isEmpty()?new THREE.Vector3():B.getSize(new THREE.Vector3()).multiplyScalar(.5);
  let u=null;
  if(Array.isArray(d.side)&&d.side.length===3&&isFinite(+d.off))u=new THREE.Vector3(d.side[0],d.side[1],d.side[2]);
  else if(g.ax&&!d.flat){ // entre trous : dans le sens des axes, côté vu (Fred, 27/11 : « la cote doit être dans le sens des axes »)
    const vd=new THREE.Vector3();camera.getWorldDirection(vd);u=g.ax.clone();if(u.dot(vd)>0)u.negate();
    const k=c3List().filter(x=>x!==d&&Array.isArray(x.side)&&Math.abs(x.side[0]*u.x+x.side[1]*u.y+x.side[2]*u.z)>0.99).length;
    d.side=[+u.x.toFixed(6),+u.y.toFixed(6),+u.z.toFixed(6)];d.off=8+7*(k%4);d.slide=0;
  }
  else{
    const vd=new THREE.Vector3();camera.getWorldDirection(vd);
    const sz=Math.max(1,h.length());let best=-1e9;
    C3_AXES.forEach(x=>{
      let a=new THREE.Vector3(x[0],x[1],x[2]);a.addScaledVector(g.n,-a.dot(g.n));if(a.lengthSq()<0.5)return;a.normalize();
      if(g.ax&&Math.abs(a.dot(g.ax))>0.5)return; // couchée (↻) : dans le plan du dessus
      const pl=new THREE.Vector3().crossVectors(g.n,a),sc=Math.abs(pl.dot(vd))+0.5*(-a.dot(vd))+0.3*a.dot(g.p1.clone().sub(c))/sz;
      if(sc>best){best=sc;u=a;}
    });
    if(!u)u=new THREE.Vector3(1,0,0);
    const k=c3List().filter(x=>x!==d&&Array.isArray(x.side)&&Math.abs(x.side[0]*u.x+x.side[1]*u.y+x.side[2]*u.z)>0.99).length;
    d.side=[+u.x.toFixed(6),+u.y.toFixed(6),+u.z.toFixed(6)];d.off=8+7*(k%4);
    d.slide=c3SlideEdge(g,u);
  }
  const edge=u.dot(c)+c3Half(h,u); // bord de la pièce le long de u
  const off=Math.max(2,edge-u.dot(g.p1))+(+d.off);
  return {u,off,slide:+d.slide||0};
}
function c3El(d){
  let el=c3.els.get(d.id);if(el)return el;
  const NS='http://www.w3.org/2000/svg',g=document.createElementNS(NS,'g');
  const ext=document.createElementNS(NS,'path'),ln=document.createElementNS(NS,'path'),ar=document.createElementNS(NS,'path');
  ext.setAttribute('fill','none');ext.setAttribute('stroke-width','1');ln.setAttribute('fill','none');ln.setAttribute('stroke-width','1.3');ar.setAttribute('stroke','none');
  g.append(ext,ln,ar);c3.svg.appendChild(g);
  const lab=document.createElement('div');lab.className='c3lab';lab.dataset.id=d.id;
  // la cote est retrouvée par son id : une annulation (Ctrl+Z) recrée les objets de doc.cotes3d
  const id=d.id,cur=()=>c3List().find(x=>x.id===id);
  lab.addEventListener('pointerdown',ev=>{const x=cur();if(x)c3LabDown(ev,x);else ev.stopPropagation();});
  lab.addEventListener('contextmenu',ev=>{const x=cur();if(x)c3Menu(ev,x);else ev.preventDefault();});
  lab.addEventListener('dblclick',ev=>{ev.stopPropagation();const x=cur();if(!x)return;let hv=ev.target&&ev.target.closest&&ev.target.closest('.hv');let k=hv&&hv.dataset.hk;
    if(!k&&c3.hvDown&&c3.hvDown.id===x.id&&c3Now()-c3.hvDown.t<900)k=c3.hvDown.k;
    if(k){hv=lab.querySelector('.hv[data-hk="'+k+'"]');if(hv){c3HoleEdit(x,k,hv);return;}}
    c3EditStart(x);});
  c3.layer.appendChild(lab);
  el={g,ext,ln,ar,lab,html:null};c3.els.set(d.id,el);return el;
}
function c3WRange(g,w){
  // [lo, hi] : positions le long de w où les deux faces cotées existent (par rapport à p1 / p2) ;
  // la cote y reste accrochée à sa surface (Fred, 27/11 : « pas se retrouver en l'air »)
  const R=[[g.bA,g.p1],[g.bB,g.p2]].filter(x=>x[0]).map(x=>{const m=w.dot(x[0].c.clone().sub(x[1])),h=c3Half(x[0].h,w);return [m-h,m+h];});
  if(!R.length)return [0,0];
  let lo=Math.max(...R.map(r=>r[0])),hi=Math.min(...R.map(r=>r[1]));
  if(lo>hi){lo=R[0][0];hi=R[0][1];} // faces décalées : celle de départ
  return [lo,hi];
}
function c3Geo(d,g){
  if(g.k==='note'){
    // alésage (face tournée vers l'axe, cachée dedans) : sur le bord du bout vu, la lettre vers l'extérieur de l'axe
    let P=g.P,n=g.n,rim=false;
    if(g.cy&&g.cy.u&&g.cy.bore){rim=true;const cp=camera.position,E1=g.cy.o.clone().addScaledVector(g.cy.a,g.cy.hl||0),E2=g.cy.o.clone().addScaledVector(g.cy.a,-(g.cy.hl||0));
      P=(E1.distanceTo(cp)<=E2.distanceTo(cp)?E1:E2).addScaledVector(g.cy.u,g.cy.r);n=g.cy.u.clone();}
    // longueur : celle choisie en glissant, sinon ~44 px à l'écran (le trait suit la normale de la face, toujours)
    let lead=isFinite(+d.lead)&&+d.lead>0?+d.lead:0;
    if(!lead){try{const r=c3.layer||null,W=r?r.clientWidth:1000,H=r?r.clientHeight:800,a=c3Proj(P,W,H),b=c3Proj(P.clone().add(n),W,H),k=Math.hypot(b[0]-a[0],b[1]-a[1]);lead=Math.max(4,Math.min(80,44/Math.max(k,0.3)));}catch(e){lead=10;}}
    return {P,n,Q:P.clone().addScaledVector(n,lead),lead,rim};
  }
  if(g.k==='angle'){
    // arc de rayon R autour de l'arête, de la 1re face à la 2e (ou à son prolongement : angle supplémentaire)
    const tB=d.sup?g.tB.clone().negate():g.tB.clone();
    const ext=(b,t)=>b?Math.max(0,t.dot(b.c.clone().sub(g.p))+c3Half(b.h,t)):0;
    // pas d'une répétition circulaire : l'arc passe par les centres des trous (cercle de perçage)
    const eA=ext(g.bA,g.tA),eB=ext(g.bB,g.tB),R=isFinite(+d.off)&&+d.off>0?+d.off:g.polar&&g.rA>0?g.rA:Math.max(6,0.6*Math.min(eA||20,eB||20));
    return {p:g.p,e:g.e,tA:g.tA,tB,R,eA,eB:d.sup?0:eB};
  }
  if(g.k==='pcd'){
    // cercle de perçage au bout des trous côté vue ; trait de Ø entre deux trous voisins (jamais sur un trait d'axe),
    // vers le haut à droite de l'écran à la création, gardé ensuite (d.ldir ; glisser le change)
    const cp=camera.position,L1=g.p.clone().addScaledVector(g.e,g.hl),L2=g.p.clone().addScaledVector(g.e,-g.hl);
    const near=L1.distanceTo(cp)<=L2.distanceTo(cp),C=near?L1:L2,Cf=near?L2:L1,dz=C.clone().sub(g.p);
    const b=new THREE.Vector3().crossVectors(g.e,g.t).normalize();
    let vx=null;
    if(Array.isArray(d.ldir)&&d.ldir.length===3){vx=c3V(d.ldir);vx.addScaledVector(g.e,-vx.dot(g.e));if(vx.lengthSq()<0.1)vx=null;else vx.normalize();}
    if(!vx){
      try{const Ly=c3.layer,W=Ly&&Ly.clientWidth||1000,H=Ly&&Ly.clientHeight||800,s0=c3Proj(C,W,H),n=g.H.length;
        const R=g.H.map(h=>{const u=h.clone().sub(g.p);u.addScaledVector(g.e,-g.e.dot(u));return u.normalize();}),cand=[];
        for(let i=0;i<n;i++){let m=R[i].clone().add(R[(i+1)%n]);if(m.lengthSq()<1e-6)m=new THREE.Vector3().crossVectors(g.e,R[i]);cand.push(m.normalize());}
        let best=-1e9;cand.concat(cand.map(x=>x.clone().negate())).forEach(m=>{const s1=c3Proj(C.clone().addScaledVector(m,g.r),W,H),dx=s1[0]-s0[0],dy=s1[1]-s0[1],l=Math.hypot(dx,dy)||1,sc=(0.6*dx-0.8*dy)/l;if(sc>best){best=sc;vx=m;}});
      }catch(x){vx=null;}
      if(!vx)vx=b.clone();
      d.ldir=[+vx.x.toFixed(5),+vx.y.toFixed(5),+vx.z.toFixed(5)];
    }
    return {C,Cf,b,vx,p0:C.clone().addScaledVector(vx,g.r),q0:C.clone().addScaledVector(vx,-g.r),H:g.H.map(h=>h.clone().add(dz))};
  }
  // points 3D du dessin de la cote (dessin et glissement s'en servent)
  if(g.k==='dia'){
    // bout du trou côté vue ; rayon choisi en glissant (d.ldir), sinon le long d'un axe de la pièce vers la droite
    const vd=new THREE.Vector3();camera.getWorldDirection(vd);
    if(g.rad)return {ec:g.c,vx:g.rd,aout:g.rd,lead:0,h:0,p0:g.fp,p1:g.fp,q0:g.c};
    const cp=camera.position,ec=g.e1&&g.e2?(g.e1.distanceTo(cp)<=g.e2.distanceTo(cp)?g.e1:g.e2):g.c;
    let vx=null;
    if(Array.isArray(d.ldir)&&d.ldir.length===3){vx=new THREE.Vector3(d.ldir[0],d.ldir[1],d.ldir[2]);vx.addScaledVector(g.a,-vx.dot(g.a));if(vx.lengthSq()<0.1)vx=null;else vx.normalize();}
    if(!vx){
      // vers l'extérieur de la pièce (loin des entraxes posés au milieu), en biais vers le haut de l'écran
      const B=c3PartBox();
      if(!B.isEmpty()){const o=ec.clone().sub(B.getCenter(new THREE.Vector3()));o.addScaledVector(g.a,-o.dot(g.a));
        if(o.length()>g.r*1.5){o.normalize();const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);up.addScaledVector(g.a,-up.dot(g.a));
          if(up.lengthSq()>1e-6)o.addScaledVector(up.normalize(),0.6);if(o.lengthSq()>1e-6)vx=o.normalize();}}
    }
    if(!vx){
      const sr=new THREE.Vector3().crossVectors(g.a,vd);if(sr.lengthSq()<1e-8)sr.copy(g.X);sr.normalize();
      let bs=-1;C3_AXES.forEach(x=>{const a=new THREE.Vector3(x[0],x[1],x[2]);if(Math.abs(a.dot(g.a))>0.2)return;const q=a.dot(sr);if(q>bs){bs=q;vx=a;}});
      if(!vx||bs<0.35)vx=sr;
    }
    // cote déportée EN 3D (comme la maquette) : le trait part du bord du trou et monte hors de la face,
    // en biais vers l'extérieur (pente C3_RISE), puis un palier à l'écran porte le texte
    let aout=ec.clone().sub(g.c);
    if(aout.lengthSq()<1e-6){aout=g.a.clone();if(aout.dot(vd)>0)aout.negate();}else aout.normalize();
    const p0=ec.clone().addScaledVector(vx,g.r);
    let lead=isFinite(+d.lead)&&+d.lead>0?+d.lead:0;
    if(!lead){try{const r=c3.layer||null,W=r?r.clientWidth:1000,H=r?r.clientHeight:800,a=c3Proj(p0,W,H),b=c3Proj(p0.clone().add(vx).addScaledVector(aout,C3_RISE),W,H),k=Math.hypot(b[0]-a[0],b[1]-a[1]);
      lead=Math.max(3,Math.min(60,55/Math.max(k,0.3)));}catch(e){lead=12;}}
    return {ec,vx,aout,lead,h:lead*C3_RISE,p0,q0:ec.clone().addScaledVector(vx,-g.r),p1:p0.clone().addScaledVector(vx,lead).addScaledVector(aout,lead*C3_RISE)};
  }
  if(d.ord&&Array.isArray(d.ordw)&&Array.isArray(d.side)&&g.p1&&g.p2)return c3OrdGeo(d,g);
  const sd=c3Side(d,g),u=sd.u,w=new THREE.Vector3().crossVectors(g.n,u).normalize(),wr=c3WRange(g,w);
  const along=!!(g.ax&&Math.abs(u.dot(g.ax))>0.9);
  const sl=along?0:Math.max(wr[0],Math.min(wr[1],sd.slide)),ws=w.clone().multiplyScalar(sl);
  const P1=g.p1.clone().add(ws),P2=g.p2.clone().add(ws);
  // trous / cylindres : les lignes d'attache partent de l'axe (entraxe, axe ↔ face), comme sur un plan
  const axA=g.k==='entraxe'||g.k==='axe',axB=g.k==='entraxe';
  const eA=axA?0:g.bA?Math.max(0,Math.min(sd.off,u.dot(g.bA.c.clone().sub(g.p1))+c3Half(g.bA.h,u))):0;
  const eB=axB?0:g.bB?Math.max(0,Math.min(sd.off,u.dot(g.bB.c.clone().sub(g.p2))+c3Half(g.bB.h,u))):0;
  // axes des cylindres cotés, en trait mixte, sur toute la longueur du trou (+2)
  const axl=[];
  if(g.ax){[[g.cyA,g.bA,g.p1],[g.cyB,g.bB,g.p2]].forEach(x=>{if(!x[0]||!x[1])return;const m=g.ax.dot(x[1].c.clone().sub(x[2])),h=c3Half(x[1].h,g.ax);
    let lo=m-h-2,hi=m+h+2;if(along){const t=g.ax.dot(u)*(sd.off+2);lo=Math.min(lo,t);hi=Math.max(hi,t);}
    axl.push([x[2].clone().addScaledVector(g.ax,lo),x[2].clone().addScaledVector(g.ax,hi)]);});}
  return {u,w,off:sd.off,axl,A:P1.clone().addScaledVector(u,eA),B:P2.clone().addScaledVector(u,eB),
    A2:P1.clone().addScaledVector(u,sd.off),B2:P2.clone().addScaledVector(u,sd.off),A3:P1.clone().addScaledVector(u,sd.off+2),B3:P2.clone().addScaledVector(u,sd.off+2)};
}
function c3FitBox(box){
  // recadrage : la boîte de la pièce s'agrandit des cotes 3D visibles (traits, bouts de cote déportée)
  if(!box||box.isEmpty()||c3.hidden||c3Ws()!=='cao')return;
  c3List().forEach(d=>{if(d.hid)return;const g=C3G.get(d);if(!g||d.err)return;
    try{const G=c3Geo(d,g);['A2','B2','A3','B3','p1','Q','p0','q0'].forEach(k=>{const v=G[k];if(v&&v.isVector3&&isFinite(v.x))box.expandByPoint(v);});}catch(e){}});
}
function c3So(d,sg){
  // décalage à l'écran de la cote déportée (px) : choisi en glissant (d.so), sinon en biais vers le haut, du côté sg
  if(Array.isArray(d.so)&&d.so.length===2&&isFinite(+d.so[0])&&isFinite(+d.so[1]))return [+d.so[0],+d.so[1]];
  return [34*(sg<0?-1:1),-46];
}
function c3Callout(el,s0,so){
  // trait s0 → s1 (= s0 + so), palier de 18 px, texte au bout, du côté où part le trait
  const dir=so[0]>=0?1:-1,s1=[s0[0]+so[0],s0[1]+so[1]],s2=[s1[0]+dir*18,s1[1]];
  el.ext.setAttribute('d','');el.ln.setAttribute('d','M'+s0[0].toFixed(1)+','+s0[1].toFixed(1)+'L'+s1[0].toFixed(1)+','+s1[1].toFixed(1)+'L'+s2[0].toFixed(1)+','+s2[1].toFixed(1));
  el.lab.style.transform=dir>0?'translate(0,-50%)':'translate(-100%,-50%)';
  return {s1,s2,lx:s2[0]+dir*4,ly:s2[1]};
}
function c3Render(RS){
  if(c3.autoQ&&c3.autoQ.size&&!c3AutoT&&!c3AutoBusy())c3AutoSoon(); // fenêtre de la fonction fermée : ses cotes
  const S=typeof scene!=='undefined'?scene:null;
  const L=c3.layer&&c3.layer.isConnected?c3.layer:null;
  const on=RS&&RS===S&&c3Ws()==='cao'&&!(typeof skEdit!=='undefined'&&skEdit);
  if(!on||(c3.hidden&&!c3Tool&&!c3.choice)||(!c3List().length&&!c3Tool&&!c3.choice&&!(c3.msg&&c3Now()-c3.msgT<6000))){if(L&&L.style.display!=='none')L.style.display='none';return;}
  const Ly=c3LayerSync();if(!Ly)return;if(Ly.style.display==='none')Ly.style.display='';
  const W=Ly.clientWidth,H=Ly.clientHeight,vd=new THREE.Vector3();camera.getWorldDirection(vd);
  const alive=new Set();
  c3List().forEach(d=>{
    alive.add(d.id);
    if(d.hid&&c3.sel!==d){const e0=c3.els.get(d.id);if(e0){e0.g.style.display='none';e0.lab.style.display='none';}return;}
    let g=C3G.get(d);if(!g){g=c3Refresh(d);if(g.err)g=null;}
    const note=c3IsNote(d),el=c3El(d),col=c3Col(d.err?'rouge':c3.sel===d?'orange':note?'note':d.drive?'bleu':'gris');
    el.ext.setAttribute('stroke',col);el.ln.setAttribute('stroke',col);el.ar.setAttribute('fill',col);
    let lx=-999,ly=-999,op=1;
    if(g&&g.k==='note'){
      const G=c3Geo(d,g),s0=c3Proj(G.P,W,H),s1=c3Proj(G.Q,W,H),dx=s1[0]-s0[0],dy=s1[1]-s0[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;
      el.ext.setAttribute('d','');el.ln.setAttribute('d','M'+s0[0]+','+s0[1]+'L'+s1[0]+','+s1[1]);
      if(d.k==='datum'){
        // triangle plein, base couchée DANS la face (tangente vue), pointe le long de la normale
        let t=new THREE.Vector3().crossVectors(G.n,vd);if(t.lengthSq()<1e-6)t=new THREE.Vector3().crossVectors(G.n,new THREE.Vector3(0,0,1));if(t.lengthSq()<1e-6)t.set(1,0,0);t.normalize();
        const t1=c3Proj(G.P.clone().add(t),W,H),pm=Math.hypot(t1[0]-s0[0],t1[1]-s0[1])||1,hw=7/pm,ah=10/Math.max(1e-3,l/G.lead);
        const b1=c3Proj(G.P.clone().addScaledVector(t,hw),W,H),b2=c3Proj(G.P.clone().addScaledVector(t,-hw),W,H),ap=c3Proj(G.P.clone().addScaledVector(G.n,Math.min(ah,G.lead*0.6)),W,H);
        el.ar.setAttribute('d','M'+b1[0]+','+b1[1]+'L'+b2[0]+','+b2[1]+'L'+ap[0]+','+ap[1]+'Z');}
      else el.ar.setAttribute('d','M'+(s0[0]+2.5)+','+s0[1]+'A2.5,2.5 0 1 0 '+(s0[0]-2.5)+','+s0[1]+'A2.5,2.5 0 1 0 '+(s0[0]+2.5)+','+s0[1]+'Z');
      if(d.k==='rough'){const C=c3Callout(el,s0,c3So(d,1));lx=C.lx;ly=C.ly;}
      else{lx=s1[0]+ux*4;ly=s1[1]+uy*4;el.lab.style.transform='translate('+(ux>=0.3?'0':ux<=-0.3?'-100%':'-50%')+','+(uy>=0.3?'0':uy<=-0.3?'-100%':'-50%')+')';}
      // note sur une face vue de dos : effacée
      const vis=-G.n.dot(vd);op=G.rim||vis>0.05?1:0.3; // alésage : toujours lisible (sur son bord)
      if(s0[2]>1)lx=-999;
    }else if(g&&g.k==='angle'){
      const G=c3Geo(d,g),N=24,bn=new THREE.Vector3().crossVectors(G.e,G.tA);let ang=Math.acos(Math.max(-1,Math.min(1,G.tA.dot(G.tB))));
      if(bn.dot(G.tB)<0)bn.negate();
      if(g.big){ang=2*Math.PI-ang;bn.negate();} // révolution de plus de 180° : l'arc fait le grand tour
      const at=(t,r)=>G.p.clone().addScaledVector(G.tA,Math.cos(t)*r).addScaledVector(bn,Math.sin(t)*r);
      let pth='';const pts=[];for(let i=0;i<=N;i++){const q=c3Proj(at(ang*i/N,G.R),W,H);pts.push(q);pth+=(i?'L':'M')+q[0].toFixed(1)+','+q[1].toFixed(1);}
      el.ln.setAttribute('d',pth);
      const a0=c3Proj(G.p.clone().addScaledVector(G.tA,Math.min(G.R,G.eA)),W,H),a1=c3Proj(G.p.clone().addScaledVector(G.tA,G.R+2),W,H);
      const b0=c3Proj(G.p.clone().addScaledVector(G.tB,Math.min(G.R,G.eB)),W,H),b1=c3Proj(G.p.clone().addScaledVector(G.tB,G.R+2),W,H);
      el.ext.setAttribute('d','M'+a0[0]+','+a0[1]+'L'+a1[0]+','+a1[1]+'M'+b0[0]+','+b0[1]+'L'+b1[0]+','+b1[1]);
      el.ar.setAttribute('d',c3Arrow(pts[0],pts[2])+c3Arrow(pts[N],pts[N-2]));
      const m=pts[N>>1];lx=m[0];ly=m[1];el.lab.style.transform='translate(-50%,-50%)';
      const vis=Math.abs(G.e.dot(vd));op=Math.max(.15,Math.min(1,vis*2.4));
      if(pts[0][2]>1||pts[N][2]>1)lx=-999;
    }else if(g&&g.k==='pcd'){
      // Ø de perçage : cercle d'axe (trait mixte) au bout des trous, traits d'axe du centre à travers chaque trou, croix du
      // centre, axes des trous et de la répétition sur leur longueur ; trait de Ø flèches sur le cercle, texte au bout d'un palier
      const G=c3Geo(d,g),N=72,P=q=>{const s=c3Proj(q,W,H);return s[0].toFixed(1)+','+s[1].toFixed(1);};
      let cl='';for(let i=0;i<=N;i++){const t=2*Math.PI*i/N;cl+=(i?'L':'M')+P(G.C.clone().addScaledVector(g.t,Math.cos(t)*g.r).addScaledVector(G.b,Math.sin(t)*g.r));}
      const sg=(a,b)=>{cl+='M'+P(a)+'L'+P(b);};
      const ax=G.C.clone().sub(G.Cf),al=ax.length();if(al>1e-6)ax.multiplyScalar(1/al);else ax.copy(g.e);
      const k=Math.min(4,g.r*0.25);
      sg(G.C.clone().addScaledVector(g.t,-k),G.C.clone().addScaledVector(g.t,k));sg(G.C.clone().addScaledVector(G.b,-k),G.C.clone().addScaledVector(G.b,k));
      sg(G.C.clone().addScaledVector(ax,2),G.C.clone().addScaledVector(ax,-al-2)); // axe de la répétition
      G.H.forEach(h=>{const u=h.clone().sub(G.C);u.addScaledVector(g.e,-g.e.dot(u));if(u.lengthSq()<1e-9)return;u.normalize();
        sg(G.C,G.C.clone().addScaledVector(u,g.r+g.hr+2)); // trait d'axe du centre à travers le trou
        sg(h.clone().addScaledVector(ax,2),h.clone().addScaledVector(ax,-al-2));}); // axe du trou (de perçage)
      if(!el.cl){el.cl=document.createElementNS('http://www.w3.org/2000/svg','path');el.cl.setAttribute('fill','none');el.cl.setAttribute('stroke-width','0.9');el.cl.setAttribute('stroke-dasharray','9 3 2 3');el.g.appendChild(el.cl);}
      el.cl.setAttribute('stroke',col);el.cl.setAttribute('d',cl);
      const s0=c3Proj(G.p0,W,H),s1=c3Proj(G.q0,W,H),sc=c3Proj(G.C,W,H);
      const C2=c3Callout(el,s0,c3So(d,s0[0]>=sc[0]?1:-1));
      el.ln.setAttribute('d','M'+s1[0].toFixed(1)+','+s1[1].toFixed(1)+'L'+s0[0].toFixed(1)+','+s0[1].toFixed(1)+(el.ln.getAttribute('d')||''));
      el.ar.setAttribute('d',c3Arrow(s0,sc)+c3Arrow(s1,sc));
      lx=C2.lx;ly=C2.ly;
      op=Math.max(.2,Math.min(1,Math.abs(g.e.dot(vd))*2.4));
      if(s0[2]>1||s1[2]>1)lx=-999;
    }else if(g&&g.k==='dia'&&d.inplane){
      // cote DANS LE PLAN du cercle : trait de diamètre d'un bord à l'autre (rayon : du centre au bord),
      // flèches sur le bord, texte au milieu au-dessus du trait ; effacée quand le cercle se voit de champ
      const G=c3Geo(d,g),s0=c3Proj(G.p0,W,H),s1=c3Proj(G.q0,W,H);
      el.ext.setAttribute('d','');el.ln.setAttribute('d','M'+s1[0].toFixed(1)+','+s1[1].toFixed(1)+'L'+s0[0].toFixed(1)+','+s0[1].toFixed(1));
      el.ar.setAttribute('d',c3Arrow(s0,s1)+(g.rad?'':c3Arrow(s1,s0)));
      const t=g.rad?0.5:0.5;lx=s1[0]+(s0[0]-s1[0])*t;ly=s1[1]+(s0[1]-s1[1])*t-3;el.lab.style.transform='translate(-50%,-100%)';
      const ax=g.a||null;if(ax)op=Math.max(.2,Math.min(1,Math.abs(ax.dot(vd))*2.4));
      if(s0[2]>1||s1[2]>1)lx=-999;
    }else if(g&&g.k==='dia'){
      // cote déportée (comme la planéité de la maquette) : flèche sur le bord du trou, trait en biais vers le haut, palier, texte
      const G=c3Geo(d,g),s0=c3Proj(G.p0,W,H),sc=c3Proj(G.ec,W,H);
      const so=c3So(d,s0[0]>=sc[0]?1:-1),C=c3Callout(el,s0,so);el.ar.setAttribute('d',c3Arrow(s0,C.s1));
      lx=C.lx;ly=C.ly;
      if(s0[2]>1)lx=-999;
    }else if(g&&d.ord&&Array.isArray(d.ordw)&&g.p1&&g.p2){
      const R=c3OrdDraw(d,g,el,col,W,H,vd);lx=R.lx;ly=R.ly;op=R.op;
    }else if(g){
      if(el.z)el.z.style.display='none';
      const G=c3Geo(d,g);
      const a=c3Proj(G.A,W,H),b=c3Proj(G.B,W,H),a2=c3Proj(G.A2,W,H),b2=c3Proj(G.B2,W,H),a3=c3Proj(G.A3,W,H),b3=c3Proj(G.B3,W,H);
      el.ext.setAttribute('d','M'+a[0]+','+a[1]+'L'+a3[0]+','+a3[1]+'M'+b[0]+','+b[1]+'L'+b3[0]+','+b3[1]);
      el.ln.setAttribute('d','M'+a2[0]+','+a2[1]+'L'+b2[0]+','+b2[1]);el.ar.setAttribute('d',c3Arrow(a2,b2)+c3Arrow(b2,a2));
      if(!el.cl){el.cl=document.createElementNS('http://www.w3.org/2000/svg','path');el.cl.setAttribute('fill','none');el.cl.setAttribute('stroke-width','0.9');el.cl.setAttribute('stroke-dasharray','9 3 2 3');el.g.appendChild(el.cl);}
      el.cl.setAttribute('stroke',col);
      el.cl.setAttribute('d',(G.axl||[]).map(q=>{const s0=c3Proj(q[0],W,H),s1=c3Proj(q[1],W,H);return 'M'+s0[0].toFixed(1)+','+s0[1].toFixed(1)+'L'+s1[0].toFixed(1)+','+s1[1].toFixed(1);}).join(''));
      lx=(a2[0]+b2[0])/2;ly=(a2[1]+b2[1])/2;el.lab.style.transform='translate(-50%,-50%)';
      // cote vue de champ : effacée (sauf choisie)
      const pn=new THREE.Vector3().crossVectors(g.n,G.u);if(pn.lengthSq()>1e-8)op=Math.max(.15,Math.min(1,Math.abs(pn.normalize().dot(vd))*2.4));
      if(a2[2]>1||b2[2]>1)lx=-999;
    }
    if(c3.sel===d||c3.edit===d)op=1;
    el.g.style.opacity=op;el.lab.style.opacity=Math.max(op,.3);
    el.g.style.display=lx<-900?'none':'';el.lab.style.display=lx<-900?'none':'';
    el.lab.style.left=lx+'px';el.lab.style.top=ly+'px';
    // cadres de tolérance (et lignes d'un trou) calés du côté où arrive le trait : étiquette à droite du trait → à
    // gauche, à gauche du trait → à droite ; centrés sous une cote droite (Fred, 27/11)
    {const tf=el.lab.style.transform||'';el.lab.classList.toggle('al',/^translate\(0(px)?,/.test(tf));el.lab.classList.toggle('ar',/^translate\(-100%,/.test(tf));}
    el.lab.classList.toggle('s',c3.sel===d);el.lab.classList.toggle('r',!d.drive&&!note);el.lab.classList.toggle('n',note);el.lab.classList.toggle('e',!!d.err);
    if(c3.edit!==d){const h=d.err?'⚠ '+c3Esc(note?c3Text(d,0):isFinite(+d.v)?c3Num(d.v):'?'):c3Html(d,+d.v);if(h!==el.html){el.lab.innerHTML=h;el.html=h;el.lab.title=c3Lib(d)+(d.err?' — '+d.err:'')+(note?'':d.drive?' · pilote '+c3DrvLib(d.drive):' · de référence');}}
  });
  c3.els.forEach((el,id)=>{if(!alive.has(id)){el.g.remove();el.lab.remove();c3.els.delete(id);}});
  if(c3.sel&&c3List().indexOf(c3.sel)<0){c3.sel=c3List().find(x=>x.id===c3.sel.id)||null;c3.cardK='';} // annulation : objets recréés
  c3CardSync();
  if(c3.msg&&c3Now()-c3.msgT>=6000&&!c3Tool&&!c3.choice){c3.msg='';c3BandSync();}
}
/* ── la souris sur une cote : choisir, glisser (report), double-clic (valeur) ── */
function c3LabDown(ev,d){
  // glisser une cote : la placer où l'on veut. Cote linéaire : plus ou moins loin de la pièce (le long
  // de u) et le long de la face (w). Ø : la flèche suit la souris autour du trou (direction et longueur).
  ev.stopPropagation();if(ev.button!==0||c3.edit===d)return;
  {const hv=ev.target&&ev.target.closest&&ev.target.closest('.hv');c3.hvDown=hv?{id:d.id,k:hv.dataset.hk,t:c3Now()}:null;}
  if(c3Tool){c3Say('Cote 3D : clique la pièce, pas une cote.',true);return;}
  const g=C3G.get(d),x0=ev.clientX,y0=ev.clientY;let moved=false,pushed=false;
  const W=c3.layer.clientWidth,H=c3.layer.clientHeight,R=c3.layer.getBoundingClientRect();
  let lin=null;
  if(g&&g.k!=='dia'&&g.k!=='pcd'&&g.k!=='note'&&g.k!=='angle'){
    const G=c3Geo(d,g),o=c3Proj(G.A2,W,H),pu=c3Proj(G.A2.clone().addScaledVector(G.u,10),W,H),pw=c3Proj(G.A2.clone().addScaledVector(G.w,10),W,H);
    const ux=(pu[0]-o[0])/10,uy=(pu[1]-o[1])/10,wx=(pw[0]-o[0])/10,wy=(pw[1]-o[1])/10,det=ux*wy-uy*wx;
    const wr=c3WRange(g,G.w);
    if(Math.abs(det)>1e-6)lin={ux,uy,wx,wy,det,off0:+d.off,sl0:Math.max(wr[0],Math.min(wr[1],+d.slide||0)),wr};
    else{const l=Math.hypot(ux,uy);if(l>1e-6)lin={ux,uy,det:0,off0:+d.off,l};}
  }
  const mv=e=>{const dx=e.clientX-x0,dy=e.clientY-y0;if(!moved&&Math.hypot(dx,dy)<4)return;moved=true;
    if(!pushed){pushed=true;try{docPushUndo('Déplacer la cote 3D');}catch(x){}}
    if(lin&&lin.ux!=null){
      if(lin.det){
        // d'abord l'éloignement (u, bien visible) ; le long de la face (w) seulement si w se voit
        // assez à l'écran (vue de biais) — sinon un petit geste ferait un grand saut
        const lu=Math.hypot(lin.ux,lin.uy),hx=lin.ux/lu,hy=lin.uy/lu,px=-hy,py=hx,wp=lin.wx*px+lin.wy*py,wu=lin.wx*hx+lin.wy*hy;
        const dw=Math.abs(wp)>0.35*lu?(dx*px+dy*py)/wp:0,du=(dx*hx+dy*hy-wu*dw)/lu;
        d.off=+Math.max(2,lin.off0+du).toFixed(3);d.slide=+Math.max(lin.wr[0],Math.min(lin.wr[1],lin.sl0+dw)).toFixed(3);}
      else d.off=+Math.max(2,lin.off0+(dx*lin.ux+dy*lin.uy)/(lin.l*lin.l)).toFixed(3);
      if(d.ord)c3OrdSync(d); // ordonnées : toute la famille reste alignée
    }else if(g&&(g.k==='note'||g.k==='angle')){
      const G=c3Geo(d,g),rc=new THREE.Raycaster(),q=new THREE.Vector3();
      rc.setFromCamera(new THREE.Vector2((e.clientX-R.left)/W*2-1,-(e.clientY-R.top)/H*2+1),camera);
      if(g.k==='angle'){
        // rayon de l'arc : point sous la souris dans le plan perpendiculaire à l'arête
        if(rc.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(G.e,G.p),q))d.off=+Math.max(3,q.distanceTo(G.p)).toFixed(2);
      }else if(G.rim){
        // alésage : la référence tourne sur le bord vu, la ligne de repère s'allonge vers l'extérieur
        if(rc.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(g.cy.a,G.P),q)){
          const o=g.cy.o.clone().addScaledVector(g.cy.a,g.cy.a.dot(G.P.clone().sub(g.cy.o))),w=q.clone().sub(o),L=w.length();
          if(L>1e-6){w.divideScalar(L);w.addScaledVector(g.cy.a,-g.cy.a.dot(w)).normalize();
            const A=parMesFace(d.a),b=A&&c3Box(A.face);if(A)occFree(A.face);
            if(b){const v=g.cy.o.clone().addScaledVector(w,g.cy.r).sub(b.c);d.at=[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)];}
            d.lead=+Math.max(3,L-g.cy.r).toFixed(2);c3Refresh(d);}}
      }else if(g.pl&&Math.abs(G.n.dot(rc.ray.direction))>0.15){
        // la note glisse SUR sa face (point d'accroche sous la souris, ramené dans la face à la relecture)
        if(rc.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(G.n,G.Q),q)){
          const P=q.addScaledVector(G.n,-G.lead),A=parMesFace(d.a),b=A&&c3Box(A.face);if(A)occFree(A.face);
          if(b){const v=P.sub(b.c);d.at=[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)];c3Refresh(d);}}
      }else{
        // cylindre ou face vue de profil : longueur de la ligne de repère
        const s0=c3Proj(G.P,W,H),s1=c3Proj(G.Q,W,H),lx=s1[0]-s0[0],ly=s1[1]-s0[1],l=Math.hypot(lx,ly);
        if(l>1){if(lin===null)lin={lead0:G.lead,k:G.lead/l};d.lead=+Math.max(3,lin.lead0+((dx*lx+dy*ly)/l)*lin.k).toFixed(2);}
      }
    }else if(g&&(g.k==='dia'||g.k==='pcd')){
      // point sous la souris dans le plan du bout du trou (Ø de perçage : du cercle de perçage)
      const G=c3Geo(d,g),rc=new THREE.Raycaster(),pc=g.k==='pcd',O=pc?G.C:G.ec;
      rc.setFromCamera(new THREE.Vector2((e.clientX-R.left)/W*2-1,-(e.clientY-R.top)/H*2+1),camera);
      // la flèche se place sur le bord du trou du côté de la souris ; le texte suit la souris (décalage à l'écran)
      const pl=new THREE.Plane().setFromNormalAndCoplanarPoint(pc?g.e:g.a,O),q=new THREE.Vector3();
      if(!g.rad&&rc.ray.intersectPlane(pl,q)){const v=q.sub(O);if(v.length()>g.r*(pc?0.3:0.5)){v.normalize();d.ldir=[+v.x.toFixed(5),+v.y.toFixed(5),+v.z.toFixed(5)];}}
      const G2=c3Geo(d,g),s0=c3Proj(G2.p0,W,H),mx=e.clientX-R.left,my=e.clientY-R.top,dir=mx>=s0[0]?1:-1;
      let ox=mx-22*dir-s0[0],oy=my-s0[1];if(Math.hypot(ox,oy)<14){ox=14*dir;oy=-8;}
      d.so=[+ox.toFixed(1),+oy.toFixed(1)];
    }
    c3Wake();};
  const up=()=>{removeEventListener('pointermove',mv,true);removeEventListener('pointerup',up,true);
    if(moved){try{c3Dirty();}catch(x){}return;}
    if(c3.sel===d&&d.drive){c3EditStart(d);return;}
    c3Select(d);};
  addEventListener('pointermove',mv,true);addEventListener('pointerup',up,true);
}
function c3Turn(d){
  // « Autre face » : la cote passe sur la face voisine autour de la mesure (quart de tour) ; Ø : quart de tour
  const g=C3G.get(d);if(!g)return;
  try{docPushUndo('Tourner la cote 3D');}catch(e){}
  if(g.k==='angle'){if(g.hax)d.hv=!d.hv;else if(g.polar&&g.plane)d.par=!d.par;else d.sup=!d.sup;c3Refresh(d);} // angle depuis une face : sa normale ↔ le long de la face
  else if(g.k==='dia'&&d.inplane&&!g.rad){const G=c3Geo(d,g),v=new THREE.Vector3().crossVectors(g.a,G.vx).normalize();d.ldir=[+v.x.toFixed(5),+v.y.toFixed(5),+v.z.toFixed(5)];}
  else if(g.k==='dia'&&g.rad){const so=c3So(d,1);d.so=[-so[0],so[1]];}
  else if(g.k==='dia'||g.k==='pcd'){const G=c3Geo(d,g),v=G.vx.clone().negate();d.ldir=[+v.x.toFixed(5),+v.y.toFixed(5),+v.z.toFixed(5)];const so=c3So(d,1);d.so=[-so[0],so[1]];}
  else{
    const u=c3Side(d,g).u;let w=new THREE.Vector3().crossVectors(g.n,u).normalize();
    if(g.ax){ // entre trous : dans le sens des axes ↔ couchée dans le plan du dessus
      d.flat=Math.abs(u.dot(g.ax))>0.5;d.side=null;d.off=null;d.slide=0;c3Side(d,g);try{c3Dirty();}catch(e){}c3Wake();return;}
    d.side=[+w.x.toFixed(6),+w.y.toFixed(6),+w.z.toFixed(6)];d.off=8;d.slide=c3SlideEdge(g,w);
  }
  try{c3Dirty();}catch(e){}c3Wake();
}
function c3EditStart(d){
  if(!d)return;
  if(c3IsNote(d)){c3Select(d);return;}
  if(!d.drive){c3Select(d);c3Say('Cote de référence : elle suit la pièce. Passe-la en « Pilotante » pour la changer.');return;}
  c3Select(d);c3.edit=d;
  const el=c3.els.get(d.id);if(!el){c3.edit=null;return;}
  el.lab.innerHTML='<input type="text" inputmode="decimal" aria-label="Nouvelle valeur de la cote" spellcheck="false">';el.html=null;
  const inp=el.lab.querySelector('input');inp.value=c3Num(d.v);
  setTimeout(()=>{try{inp.focus();inp.select();}catch(e){}},0);
  inp.addEventListener('pointerdown',e=>e.stopPropagation());
  inp.addEventListener('keydown',e=>{e.stopPropagation();
    if(e.key==='Enter'){e.preventDefault();const v=c3Parse(inp.value);c3.edit=null;el.html=null;
      const r=isFinite(v)?c3SetValue(d,v):'valeur illisible';
      if(r!==true){c3Say('Refusé : '+r+'.',true);setTimeout(()=>c3EditStart(d),0);}
      else c3Say('Pilote '+c3DrvLib(d.drive)+'.');c3Wake();}
    else if(e.key==='Escape'){e.preventDefault();c3.edit=null;el.html=null;c3Wake();}});
  inp.addEventListener('blur',()=>{if(c3.edit===d){c3.edit=null;el.html=null;c3Wake();}});
  c3Wake();
}
function c3HoleSet(d,k,T){
  // un réglage du Perçage pris tel quel (Ø, profondeur, angle) : → true | message ; une annulation ; la pièce passe à la nouvelle valeur
  const HO=c3HoleOf(d);if(!HO)return 'ce n’est plus un trou de Perçage';
  if(!(T>0))return 'tape une valeur positive';
  const drv={t:'feat',f:HO.f.id,k},p0=c3DrvGet(drv);if(!isFinite(p0))return 'réglage introuvable';
  if(Math.abs(p0-T)<1e-6)return true;
  c3AnimEnd();
  const S0=c3MeshSnap();
  const n0=typeof docUndoStack!=='undefined'?docUndoStack.length:0;
  try{docPushUndo('Perçage '+(C3_FKEY[k]||k)+' '+c3Num(T));}catch(e){}
  let r=c3DrvSet(drv,T);const t0=c3Now();
  if(r===true&&!c3Rebuild())r='la pièce ne se reconstruit pas avec ce réglage';
  if(r!==true){try{c3DrvSet(drv,p0);c3Rebuild();}catch(e){}
    try{if(typeof docUndoStack!=='undefined'&&docUndoStack.length>n0){docUndoStack.pop();if(typeof docBaseSync==='function')docBaseSync(docSnap());if(typeof docUndoUI==='function')docUndoUI();}}catch(e){}
    c3List().forEach(x=>{try{c3Refresh(x);}catch(e){}});c3.cardK='';return r;}
  const dt=c3Now()-t0;c3List().forEach(x=>{try{c3Refresh(x);}catch(e){}});c3.cardK='';
  try{c3AnimStart(drv,p0,T,dt,S0);}catch(e){}
  return true;
}
function c3HoleEdit(d,k,span){
  // saisie sur place d'un nombre du trou (Ø du lamage, profondeur…)
  if(!d||!span)return;c3Select(d);c3.edit=d;
  const el=c3.els.get(d.id);if(!el){c3.edit=null;return;}
  const HO=c3HoleOf(d),q=HO&&HO.parts.find(x=>x.k===k||x.dk===k);const cur=q?(q.k===k?q.dia:q.dv):NaN;
  span.innerHTML='<input type="text" inputmode="decimal" aria-label="'+c3Esc(C3_FKEY[k]||k)+'" spellcheck="false">';el.html=null;
  const inp=span.querySelector('input');inp.value=isFinite(cur)?c3Num(cur):'';
  setTimeout(()=>{try{inp.focus();inp.select();}catch(e){}},0);
  inp.addEventListener('pointerdown',e=>e.stopPropagation());inp.addEventListener('dblclick',e=>e.stopPropagation());
  const end=()=>{c3.edit=null;el.html=null;c3Wake();};
  inp.addEventListener('keydown',e=>{e.stopPropagation();
    if(e.key==='Enter'){e.preventDefault();const v=c3Parse(inp.value);end();
      const r=isFinite(v)?c3HoleSet(d,k,v):'valeur illisible';
      if(r!==true)c3Say('Refusé : '+r+'.',true);else c3Say('Pilote '+c3Esc((HO.f.name||HO.f.id))+' › '+(C3_FKEY[k]||k)+' '+c3Num(v)+'.');}
    else if(e.key==='Escape'){e.preventDefault();end();}});
  inp.addEventListener('blur',()=>{if(c3.edit===d)end();});
  c3Wake();
}
function c3Parse(t){const s=String(t||'').trim().replace(/^[ØøR]\s*/,'').replace(',','.');return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)?parseFloat(s):NaN;}
/* ── les propriétés (mêmes données que la mise en plan) ── */
function c3RepKey(d){const rp=c3RepOfCote(d);return rp?[rp.id,rp.copies,rp.copies2,rp.dist,rp.dist2,rp.angle]:null;}
function c3FeatSet(f,k,v,lab){
  // réglage d'une fonction changé depuis la carte (nombre d'une répétition…) : une annulation, retour si le rejeu échoue
  const drv={t:'feat',f:f.id,k},p0=c3DrvGet(drv);
  const n0=typeof docUndoStack!=='undefined'?docUndoStack.length:0;
  try{docPushUndo(lab);}catch(e){}
  const back=()=>{try{c3DrvSet(drv,p0);if(f.type==='repeat'&&typeof repGenChildren==='function')repGenChildren(f);c3Rebuild();}catch(e){}
    try{if(docUndoStack.length>n0){docUndoStack.pop();docBaseSync(docSnap());docUndoUI();}}catch(e){}};
  const r=c3DrvSet(drv,v);if(r!==true){back();return r;}
  try{if(f.type==='repeat'&&typeof repGenChildren==='function')repGenChildren(f);}catch(e){}
  if(!c3Rebuild()){back();c3List().forEach(x=>{try{c3Refresh(x);}catch(e){}});return 'la pièce ne se reconstruit pas avec cette valeur';}
  c3List().forEach(x=>{try{c3Refresh(x);}catch(e){}});
  try{if(typeof renderTree==='function')renderTree();}catch(e){}
  return true;
}
function c3CardSync(){
  const K=c3.card;if(!K)return;const d=c3.sel;
  if(!d||c3Tool){if(K.style.display!=='none')K.style.display='none';c3.cardK='';return;}
  const HOc=c3HoleOf(d);
  const key=d.id+'|'+JSON.stringify([d.drive,d.tol,d.pre,d.post,d.prec,d.gdt,d.err,c3Num(d.v),d.l,d.r,d.sup,HOc&&HOc.parts,d.fmt,d.insp,d.name,d.show,d.inplane,c3RepKey(d)]);
  K.style.display='flex';
  const top=c3Top();K.style.top=top+'px';K.style.maxHeight=Math.max(160,c3.layer.clientHeight-top-70)+'px';
  if(c3.cardK===key)return;
  if(K.contains(document.activeElement)&&c3.cardK.split('|')[0]===d.id)return; // pas pendant une saisie
  c3.cardK=key;
  if(c3IsNote(d)){c3NoteCard(K,d);return;}
  const t=d.tol||{};
  let h='<button class="x" data-a="close" title="Fermer (Échap)">✕</button><h4>'+c3Esc(c3Lib(d))+'</h4>';
  h+='<div>'+(d.drive?'<span class="chip d">Pilotante</span>':'<span class="chip r">De référence</span>')+(d.err?' <span class="chip r" style="color:'+C3_ROUGE+';border-color:'+C3_ROUGE+'">'+c3Esc(d.err)+'</span>':'')+'</div>';
  h+='<div class="drv">'+(d.drive?'Pilote <b>'+c3Esc(c3DrvLib(d.drive))+'</b>':'Mesure seulement : elle suit la pièce')+'</div>';
  h+='<div class="seg"><button data-a="drive" class="'+(d.drive?'on':'')+'">Pilotante</button><button data-a="ref" class="'+(d.drive?'':'on')+'">De référence</button></div>';
  h+='<div class="row"><label>Valeur</label><input data-k="val" value="'+c3Esc(c3Num(d.v))+'"'+(d.drive?'':' disabled')+'></div>';
  if(HOc){ // toutes les cotes du trou, chacune pilote la fonction Perçage
    h+='<div class="sec"><div class="h">Le trou ('+c3Esc(HOc.f.name||'Perçage')+')</div>';
    HOc.parts.forEach(q=>{if(q.txt)return;
      h+='<div class="row"><label>'+c3Esc(C3_FKEY[q.k]||q.k)+'</label><input data-k="hk:'+q.k+'" value="'+c3Esc(c3Num(q.dia))+'"></div>';
      if(q.dk)h+='<div class="row"><label>'+c3Esc(C3_FKEY[q.dk]||q.dk)+'</label><input data-k="hk:'+q.dk+'" value="'+c3Esc(c3Num(q.dv))+'"></div>';});
    h+='<div class="note">Chaque valeur pilote la fonction Perçage. Double-clic sur un nombre de la cote : même chose.</div></div>';
  }
  {const I=d.insp||{};
    h+='<div class="sec"><div class="h">Présentation</div>';
    h+='<div class="row"><label>Nom</label><input data-k="name" value="'+c3Esc(c3Name(d))+'" placeholder="d1, Épaisseur…"></div>';
    h+='<div class="row"><label>Afficher</label><select data-k="show">'+[['','Valeur'],['nom','Nom'],['both','Nom = valeur']].map(o=>'<option value="'+o[0]+'"'+((d.show||'')===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></div>';
    h+='<div class="row"><label>Cote</label><select data-k="fmt">'+[['','Normale'],['box','Encadrée (théoriquement exacte)'],['insp','D’inspection']].map(o=>'<option value="'+o[0]+'"'+((d.fmt||'')===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></div>';
    if(d.fmt==='insp')h+='<div class="row"><label>Libellé</label><input data-k="ilab" value="'+c3Esc(I.lab||'')+'" placeholder="ex. A1, CTRL"></div><div class="row"><label>Taux</label><input data-k="irate" value="'+c3Esc(I.rate||'')+'" placeholder="100%, 1/10…"></div>';
    if(d.fmt==='box')h+='<div class="note">Cote théoriquement exacte (ISO 1101) : la tolérance vient du cadre de tolérance géométrique, pas de la cote.</div>';
    if(d.fmt==='insp')h+='<div class="note">Cote à contrôler : libellé, valeur et taux de contrôle dans l’ovale.</div>';
    h+='<div class="act"><button data-a="showall" title="Même affichage (valeur / nom) pour toutes les cotes 3D">Afficher ainsi toutes les cotes</button></div></div>';}
  {const rp=c3RepOfCote(d);if(rp){
    h+='<div class="sec"><div class="h">Répétition · '+c3Esc(rp.name||rp.id)+'</div>';
    h+='<div class="row"><label>Nombre</label><input data-k="rp:qty" inputmode="numeric" value="'+c3Esc(String(parHolderVal(rp,'qty')))+'" title="Original compris"></div>';
    if(rp.mode==='lin')h+='<div class="row"><label>Pas</label><input data-k="rp:dist" inputmode="decimal" value="'+c3Esc(c3Num(+rp.dist))+'"></div>';
    if(rp.mode==='lin'&&rp.lin2)h+='<div class="row"><label>Nombre 2</label><input data-k="rp:qty2" inputmode="numeric" value="'+c3Esc(String(parHolderVal(rp,'qty2')))+'"></div><div class="row"><label>Pas 2</label><input data-k="rp:dist2" inputmode="decimal" value="'+c3Esc(c3Num(+rp.dist2))+'"></div>';
    if(rp.mode==='circ')h+='<div class="row"><label>Angle</label><input data-k="rp:angle" inputmode="decimal" value="'+c3Esc(c3Num(+rp.angle))+'"></div>';
    h+='</div>';}}
  h+='<div class="sec"><div class="h">Tolérance</div><div class="row"><label>Type</label><select data-k="tolm"'+(d.fmt==='box'?' disabled title="Cote encadrée : pas de tolérance"':'')+'>'+[['','—'],['pm','± symétrique'],['dbl','Double'],['cls','Classe ISO 286']].filter(o=>d.k!=='angle'||o[0]!=='cls').map(o=>'<option value="'+o[0]+'"'+((t.m||'')===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></div>';
  if(t.m==='pm')h+='<div class="row"><label>± mm</label><input type="number" step="0.01" data-k="tols" value="'+(+t.s||0)+'"></div>';
  if(t.m==='dbl')h+='<div class="row"><label>+</label><input type="number" step="0.01" data-k="tolhi" value="'+(+t.hi||0)+'"></div><div class="row"><label>−</label><input type="number" step="0.01" data-k="tollo" value="'+(+t.lo||0)+'"></div>';
  if(t.m==='cls'){const r=c3TolRange(d,+d.v);h+='<div class="row"><label>Classe</label><input data-k="tolcls" list="c3ClsL" value="'+c3Esc(t.cls||'')+'" placeholder="H7, g6, H7/k6…"></div><datalist id="c3ClsL">'+C3_CLS.map(c=>'<option value="'+c+'">').join('')+'</datalist>'
    +'<div class="note">'+(r?'Écarts '+c3Sgn(r.hi)+' / '+c3Sgn(r.lo)+' mm':String(t.cls||'').indexOf('/')>=0?'Ajustement : la classe seule est écrite':'Classe inconnue')+'</div>';}
  h+='<div class="row"><label>Précision</label><select data-k="prec">'+[['','Auto'],['0','0'],['1','0,0'],['2','0,00'],['3','0,000']].map(o=>'<option value="'+o[0]+'"'+(String(d.prec==null?'':d.prec)===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></div></div>';
  h+='<div class="sec"><div class="h">Texte</div><div class="row"><label>Avant</label><input data-k="pre" value="'+c3Esc(d.pre||'')+'" placeholder="ex. 2×"></div><div class="row"><label>Après</label><input data-k="post" value="'+c3Esc(d.post||'')+'"></div></div>';
  h+='<div class="sec"><div class="h">Tolérance géométrique</div>';
  (d.gdt||[]).forEach((g,i)=>{
    const forme=C3_GDT_FORME.has(g.sym),w=c3GdtCheck(g);
    h+='<div class="fc" data-g="'+i+'"><select data-gk="sym" title="Caractéristique">'+C3_GDT.map(s=>'<option value="'+s[0]+'"'+(g.sym===s[0]?' selected':'')+'>'+s[1]+' '+s[2]+'</option>').join('')+'</select>'
      +'<label class="ck"><input type="checkbox" data-gk="dia"'+(g.dia?' checked':'')+'>Ø</label><input type="number" step="0.005" data-gk="val" value="'+(+g.val||0)+'" title="Zone (mm)">'
      +'<select data-gk="mod" title="Modificateur">'+C3_MODS.map(m=>'<option value="'+m[0]+'"'+((g.mod||'')===m[0]?' selected':'')+'>'+m[1]+'</option>').join('')+'</select>'
      +[0,1,2].map(j=>{const r=(g.refs||[])[j]||{};return '<select data-gk="ref'+j+'" title="Référence '+(j+1)+'"'+(forme?' disabled':'')+'><option value="">—</option>'+C3_LETTERS.split('').slice(0,8).map(l=>'<option'+(r.l===l?' selected':'')+'>'+l+'</option>').join('')+'</select>';}).join('')
      +'<button data-a="gdel" data-i="'+i+'" title="Retirer ce cadre" style="height:24px;padding:0 7px;border-radius:6px;border:1px solid #3a4d68;background:#16202e;color:#e8edf5;cursor:pointer">✕</button>'
      +(w?'<span class="w">'+c3Esc(w)+'</span>':'')+'</div>';});
  h+='<div class="act"><button data-a="gadd">+ Cadre de tolérance</button></div></div>';
  const r=c3TolRange(d,+d.v);
  h+='<div class="note"><b>FAO</b> : '+(r&&Math.abs(r.hi+r.lo)>1e-9?'à usiner à <b>'+c3Num(c3Mid(d,+d.v))+'</b>, milieu de la tolérance.':'cote nominale.')+'</div>';
  if(c3IsoOk(d)){const rp=d.k==='pcd'?c3Feat(d.polar):c3CircRep(d.a);
    h+='<div class="sec"><div class="h">Cercle de trous (ISO)</div><div class="act">'
      +(d.k==='dia'&&!c3PcdOf(rp)?'<button data-a="pcd" title="Ø du cercle de perçage : cercle d’axe et traits d’axe de tous les trous">Ø de perçage</button>':'')
      +(!c3HaxOf(rp)?'<button data-a="hax" title="Angle d’un trou depuis l’axe horizontal du cercle de trous">Angle depuis l’axe</button>':'')
      +'<button data-a="iso" title="Références A (face d’entrée des trous) et B (alésage ou cylindre centré sur l’axe), cadre ⌖ Ø0,1 A B sur le Ø des trous, Ø de perçage et angles encadrés (théoriquement exacts)">⌖ Localisation ISO</button></div>'
      +(c3RepFull(rp)?'<div class="note">Trous répartis sur un tour complet : « EQS » derrière leur Ø ; l’angle du pas est de référence (le nombre de trous le fixe).</div>':'')+'</div>';}
  h+='<div class="note">Glisser la cote pour la placer'+(d.k==='pcd'?' autour du cercle de perçage.':d.k==='dia'?' autour du trou.':d.k==='angle'?' : plus près ou plus loin de l’arête.':' : plus loin, ou le long de la face.')+'</div>';
  h+='<div class="act"><button data-a="turn" title="'+(d.k==='angle'?'Coter l’angle supplémentaire (180° − angle)':'La cote passe sur la face voisine')+'">'+(d.k==='angle'?(d.hax?(d.hv?'↻ Depuis l’axe horizontal':'↻ Depuis l’axe vertical'):d.polar&&(C3G.get(d)||{}).plane?(d.par?'↻ Depuis la normale':'↻ Le long de la face'):'↻ Supplémentaire'):d.k==='pcd'?'↻ Autre côté':'↻ Autre face')+'</button>'+(d.k==='dia'?'<button data-a="plan" title="'+(d.inplane?'Cote déportée : trait en biais, palier et texte':'Cote couchée dans le plan du cercle : trait '+(c3IsRad(d)?'de rayon':'de diamètre')+' et flèches sur le bord')+'">'+(d.inplane?'↗ Déportée':'⊙ Dans le plan')+'</button>':'')+(d.drive?'<button data-a="choose">Ce qui bouge…</button>':'')+'<button data-a="del">Supprimer</button></div>';
  K.innerHTML=h;
  K.onclick=c3CardClick;K.onchange=c3CardChange;
}
function c3NoteCard(K,d){
  let h='<button class="x" data-a="close" title="Fermer (Échap)">✕</button><h4>'+c3Esc(c3Lib(d))+'</h4>';
  if(d.err)h+='<div><span class="chip r" style="color:'+C3_ROUGE+';border-color:'+C3_ROUGE+'">'+c3Esc(d.err)+'</span></div>';
  if(d.k==='datum'){
    const dup=c3List().some(x=>x!==d&&x.k==='datum'&&x.l===d.l);
    h+='<div class="row"><label>Lettre</label><select data-k="dl">'+C3_LETTERS.split('').map(l=>'<option'+(l===d.l?' selected':'')+'>'+l+'</option>').join('')+'</select></div>';
    if(dup)h+='<div class="note" style="color:'+C3_ROUGE+'">Une autre référence porte déjà la lettre '+c3Esc(d.l)+'.</div>';
    h+='<div class="note">Référence ISO 5459 : les cadres de tolérance des cotes 3D s’y rapportent (A, B, C).</div>';
  }else{
    const r=d.r||{};
    h+='<div class="row"><label>Paramètre</label><select data-k="rpar">'+C3_RGH_PARS.map(x=>'<option'+(x===(r.par||'Ra')?' selected':'')+'>'+x+'</option>').join('')+'</select></div>';
    h+='<div class="row"><label>Valeur µm</label><input data-k="rval" value="'+c3Esc(String(r.val||'').replace('.',','))+'"></div>';
    h+='<div class="act">'+['0.4','0.8','1.6','3.2','6.3','12.5'].map(v=>'<button data-a="rv" data-v="'+v+'">'+v.replace('.',',')+'</button>').join('')+'</div>';
    h+='<div class="row"><label>Procédé</label><select data-k="rproc">'+C3_RGH_PROC.map(x=>'<option value="'+x[0]+'"'+(x[0]===(r.proc||'remove')?' selected':'')+'>'+x[1]+'</option>').join('')+'</select></div>';
    h+='<div class="row"><label>Texte</label><input data-k="rtxt" value="'+c3Esc(r.txt||'')+'" placeholder="ex. rectifié"></div>';
  }
  h+='<div class="note">Glisser pour la déplacer sur sa face ; elle reste accrochée à la face.</div>';
  h+='<div class="act"><button data-a="del">Supprimer</button></div>';
  K.innerHTML=h;K.onclick=c3CardClick;K.onchange=c3CardChange;
}
function c3CardClick(e){
  const b=e.target&&e.target.closest&&e.target.closest('[data-a]');if(!b)return;const d=c3.sel;if(!d)return;
  const a=b.dataset.a;
  if(a==='close'){c3Select(null);return;}
  if(a==='del'){c3Remove(d);return;}
  if(a==='ref'){if(d.drive){c3SetDrive(d,null);c3Say('Cote de référence : elle suit la pièce.');}return;}
  if(a==='drive'||a==='choose'){c3AskDrive(d,false);return;}
  if(a==='turn'){c3Turn(d);return;}
  if(a==='iso'){c3IsoLoc(d);return;}
  if(a==='pcd'){c3MakePcd(d.a);return;}
  if(a==='hax'){c3MakeHax(d.a);return;}
  if(a==='showall'){try{docPushUndo('affichage des cotes');}catch(x){}c3List().forEach(x=>{if(c3IsNote(x))return;if(d.show)x.show=d.show;else delete x.show;});try{c3Dirty();}catch(x){}c3.els.forEach(el=>{el.html=null;});c3.cardK='';c3Wake();return;}
  if(a==='plan'){c3Edit(d,'présentation de la cote',()=>{if(d.inplane)delete d.inplane;else d.inplane=true;});return;}
  if(a==='gadd'){c3Edit(d,'cadre de tolérance',()=>{d.gdt=d.gdt||[];d.gdt.push({sym:d.k==='dia'?'pos':'par',dia:d.k==='dia',val:0.05,mod:'',refs:[{l:'A',m:''}]});});return;}
  if(a==='gdel'){c3Edit(d,'cadre de tolérance',()=>{d.gdt.splice(+b.dataset.i,1);});return;}
  if(a==='rv'&&d.r){c3Edit(d,'rugosité',()=>{d.r.val=b.dataset.v;c3.rgLast=Object.assign({},d.r);});return;}
}
function c3Edit(d,lab,fn){
  // une étape d'annulation seulement si la cote change vraiment (un menu envoie « input » puis « change »)
  const b=JSON.stringify(d);fn();if(JSON.stringify(d)===b)return;
  const was=JSON.parse(b);Object.keys(d).forEach(k=>{delete d[k];});Object.assign(d,was);
  try{docPushUndo(lab);}catch(e){}fn();try{c3Dirty();}catch(e){}c3.cardK='';const el=c3.els.get(d.id);if(el)el.html=null;c3Wake();}
function c3CardChange(e){
  const t=e.target,d=c3.sel;if(!t||!d)return;
  const k=t.dataset.k,gk=t.dataset.gk;
  if(k&&k.indexOf('hk:')===0){const hk=k.slice(3),v=c3Parse(t.value),r=isFinite(v)?c3HoleSet(d,hk,v):'valeur illisible';
    if(r!==true)c3Say('Refusé : '+r+'.',true);else c3Say('Pilote '+(C3_FKEY[hk]||hk)+' '+c3Num(v)+'.');c3.cardK='';c3Wake();return;}
  if(k==='dl'){c3Edit(d,'référence',()=>{d.l=t.value;});return;}
  if(k==='rpar'||k==='rproc'||k==='rtxt'||k==='rval'){c3Edit(d,'rugosité',()=>{d.r=d.r||{};const f={rpar:'par',rproc:'proc',rtxt:'txt',rval:'val'}[k];d.r[f]=k==='rval'?String(c3Parse(t.value)||''):t.value;c3.rgLast=Object.assign({},d.r);});return;}
  if(k==='val'){const v=c3Parse(t.value);const r=isFinite(v)?c3SetValue(d,v):'valeur illisible';if(r!==true){c3Say('Refusé : '+r+'.',true);t.value=c3Num(d.v);}else c3Say('Pilote '+c3DrvLib(d.drive)+'.');c3.cardK='';c3Wake();return;}
  if(k==='tolm'){c3Edit(d,'tolérance',()=>{const m=t.value;d.tol=m?{m,s:0.1,hi:0.1,lo:-0.1,cls:m==='cls'?(d.k==='dia'?'H7':'h7'):''}:null;});return;}
  if(k==='tols'){c3Edit(d,'±',()=>{d.tol.s=Math.abs(+t.value)||0;});return;}
  if(k==='tolhi'){c3Edit(d,'+',()=>{d.tol.hi=+t.value||0;});return;}
  if(k==='tollo'){c3Edit(d,'−',()=>{d.tol.lo=+t.value||0;});return;}
  if(k==='tolcls'){const v=String(t.value||'').trim();const ok=v.indexOf('/')>=0?/^[A-Za-z]{1,2}\d{1,2}\/[A-Za-z]{1,2}\d{1,2}$/.test(v):(typeof iso286Parse!=='function'||!!iso286Parse(v));
    if(!ok){c3Say('Classe ISO 286 inconnue : « '+v+' ».',true);t.value=d.tol.cls||'';return;}c3Edit(d,'classe',()=>{d.tol.cls=v;});return;}
  if(k==='prec'){c3Edit(d,'précision',()=>{d.prec=t.value===''?null:+t.value;});return;}
  if(k==='pre'||k==='post'){c3Edit(d,'texte',()=>{d[k]=t.value;});return;}
  if(k&&k.indexOf('rp:')===0){const rp=c3RepOfCote(d);if(!rp)return;const kk=k.slice(3),v=c3Parse(t.value);
    const r=isFinite(v)?c3FeatSet(rp,kk,v,'répétition « '+(rp.name||rp.id)+' »'):'valeur illisible';
    if(r!==true)c3Say('Refusé : '+r+'.',true);else c3Say((C3_FKEY[kk]||kk)+' de la répétition : '+c3Num(parHolderVal(rp,kk))+'.');
    c3.cardK='';c3Wake();return;}
  if(k==='fmt'){c3Edit(d,'présentation de la cote',()=>{if(t.value)d.fmt=t.value;else delete d.fmt;if(d.fmt==='insp'&&!d.insp)d.insp={lab:'',rate:'100%'};});return;}
  if(k==='ilab'||k==='irate'){c3Edit(d,'cote d’inspection',()=>{d.insp=d.insp||{};d.insp[k==='ilab'?'lab':'rate']=String(t.value||'').trim();});return;}
  if(k==='show'){c3Edit(d,'affichage de la cote',()=>{if(t.value)d.show=t.value;else delete d.show;});return;}
  if(k==='name'){const v=String(t.value||'').trim();
    if(v&&c3List().some(x=>x!==d&&c3Name(x)===v)){c3Say('Le nom « '+v+' » est déjà pris par une autre cote.',true);t.value=c3Name(d);return;}
    c3Edit(d,'nom de la cote',()=>{if(v)d.name=v;else delete d.name;});return;}
  if(gk){const box=t.closest('[data-g]'),g=d.gdt[+box.dataset.g];if(!g)return;
    c3Edit(d,'cadre de tolérance',()=>{
      if(gk==='sym'){g.sym=t.value;if(C3_GDT_FORME.has(g.sym))g.refs=[];}
      else if(gk==='dia')g.dia=t.checked;else if(gk==='val')g.val=Math.abs(+t.value)||0;else if(gk==='mod')g.mod=t.value;
      else if(/^ref\d$/.test(gk)){const j=+gk.slice(3);g.refs=g.refs||[];while(g.refs.length<=j)g.refs.push({l:'',m:''});g.refs[j]={l:t.value,m:(g.refs[j]&&g.refs[j].m)||''};
        g.refs=g.refs.filter((r,i)=>r.l||i<j);while(g.refs.length&&!g.refs[g.refs.length-1].l)g.refs.pop();}
    });}
}
/* ── clavier ── */
function c3Typing(){const a=typeof document!=='undefined'?document.activeElement:null;return !!(a&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable));}
function c3Key(e){
  if(c3Ws()!=='cao')return;
  try{if(typeof skEdit!=='undefined'&&skEdit)return;}catch(x){}
  if(e.ctrlKey||e.altKey||e.metaKey)return;
  try{const ov=document.getElementById('sketchOverlay');if(ov&&ov.classList.contains('open'))return;}catch(x){}
  if(e.key==='Escape'){
    if(c3.choice){e.preventDefault();e.stopPropagation();c3Choose('x');return;}
    if(c3Tool){e.preventDefault();e.stopPropagation();if(c3Tool.a){c3Tool.a=null;try{clearMeasure();}catch(x){}c3BandSync();}else c3ToolStop();return;}
    if(c3.sel&&!c3Typing()){e.preventDefault();e.stopPropagation();c3Select(null);return;}
    return;
  }
  if(c3Typing())return;
  if((e.key==='d'||e.key==='D')&&e.shiftKey){e.preventDefault();e.stopPropagation();if(c3Tool)c3ToolStop();c3Eye();return;}
  if((e.key==='d'||e.key==='D')&&!e.shiftKey){e.preventDefault();e.stopPropagation();if(c3Tool)c3ToolStop();else c3ToolStart();return;}
  if(e.key==='Enter'&&c3Tool&&c3Tool.a&&c3Tool.a.cy){e.preventDefault();e.stopPropagation();c3MakeDia();return;}
  if(e.key==='Enter'&&c3.sel&&c3.sel.drive&&!c3Tool){e.preventDefault();e.stopPropagation();c3EditStart(c3.sel);return;}
  if((e.key==='Delete'||e.key==='Backspace')&&c3.sel&&!c3Tool){e.preventDefault();e.stopPropagation();c3Remove(c3.sel);return;}
}
function c3BtnSync(){const b=c3.btn;if(!b)return;b.classList.toggle('on',!!c3Tool);b.setAttribute('aria-pressed',c3Tool?'true':'false');}
function c3Eye(){
  // bouton œil / Maj+D : quelque chose de caché → tout montrer ; sinon tout cacher
  const some=c3.hidden||c3List().some(d=>d.hid);
  if(some){let k=0;c3List().forEach(d=>{if(d.hid){delete d.hid;k++;}});if(k)try{c3Dirty();}catch(e){}c3Hide(false);}
  else c3Hide(true);
}
function c3Hide(h){
  // « tout caché » (c3.hidden) ; une cote cachée seule (clic droit) garde d.hid
  c3.hidden=h==null?!c3.hidden:!!h;
  if(c3.hidden){c3.sel=null;c3.choice=null;}
  const b=c3.btnVis;if(b){b.classList.toggle('on',!c3.hidden&&c3List().length>0);b.setAttribute('aria-pressed',c3.hidden?'false':'true');
    b.title=(c3.hidden?'Montrer':'Cacher')+' les cotes 3D (Maj+D)';b.innerHTML=c3EyeSvg(c3.hidden);}
  c3Wake();
}
function c3FeatOf(d){
  // fonction à laquelle appartient la cote : celle qu'elle pilote, sinon celle de sa 1re face
  try{
    if(d.drive&&d.drive.t==='feat')return c3Feat(d.drive.f);
    if(d.drive&&d.drive.t==='dim'){const f=(doc.features||[]).find(x=>x&&x.sketchId===d.drive.sk);if(f)return f;}
    const o=c3Owner(d.a&&d.a.nom);return o?c3Feat(o.fid):null;
  }catch(e){return null;}
}
function c3OfFeat(fid){return c3List().filter(d=>{const f=c3FeatOf(d);return f&&f.id===fid;});}
function c3HideSet(L,h){if(!L.length)return;L.forEach(d=>{if(h)d.hid=true;else delete d.hid;if(h&&c3.sel===d)c3.sel=null;});if(!h&&c3.hidden)c3.hidden=false;try{c3Dirty();}catch(e){}c3.cardK='';c3Hide(c3.hidden);}
function c3Menu(ev,d){
  // clic droit sur une cote : cacher celle-ci, cacher / montrer celles de sa fonction, tout montrer, supprimer
  ev.preventDefault();ev.stopPropagation();
  let m=document.getElementById('c3Menu');
  if(!m){m=document.createElement('div');m.id='c3Menu';document.body.appendChild(m);
    document.addEventListener('pointerdown',e=>{if(m.style.display!=='none'&&!m.contains(e.target))m.style.display='none';},true);}
  const f=c3FeatOf(d),L=f?c3OfFeat(f.id):[],nh=c3List().filter(x=>x.hid).length;
  const it=[['Cacher cette cote',()=>c3HideSet([d],true)]];
  if(f&&L.length)it.push(['Cacher les cotes de « '+(f.name||f.id)+' » ('+L.length+')',()=>c3HideSet(L,true)]);
  if(nh)it.push(['Montrer toutes les cotes ('+nh+' cachée'+(nh>1?'s':'')+')',()=>c3HideSet(c3List(),false)]);
  it.push(['Supprimer la cote',()=>c3Remove(d)]);
  it.push([(c3AutoOn()?'✓ ':'')+'Cotes 3D posées à chaque création',()=>{c3AutoSet(!c3AutoOn());c3Say(c3AutoOn()?'Les nouvelles fonctions recevront leurs cotes 3D.':'Plus de cotes 3D automatiques (les cotes posées restent).');}]);
  m.innerHTML='';it.forEach(x=>{const b=document.createElement('button');b.type='button';b.textContent=x[0];b.onclick=e=>{e.stopPropagation();m.style.display='none';x[1]();c3Wake();};m.appendChild(b);});
  m.style.display='flex';m.style.left=Math.min(ev.clientX,innerWidth-260)+'px';m.style.top=Math.min(ev.clientY,innerHeight-m.offsetHeight-8)+'px';
}
function c3CtxSync(t){
  // menu clic droit de l'arbre / de la timeline : les cotes 3D de cette fonction (ou esquisse)
  const M=document.getElementById('ctxMenu');if(!M)return;
  let b=document.getElementById('ctxC3');
  let L=[];
  if(t&&t.kind==='feature')L=c3OfFeat(t.id);
  else if(t&&t.kind==='sketch')L=c3List().filter(d=>{const f=c3FeatOf(d);return (d.drive&&d.drive.t==='dim'&&d.drive.sk===t.id)||(f&&f.sketchId===t.id);});
  let a=document.getElementById('ctxC3a');
  const fa=t&&t.kind==='feature'?c3Feat(t.id):null;
  if(fa&&!L.length){
    if(!a){a=document.createElement('button');a.type='button';a.id='ctxC3a';M.appendChild(a);}
    a.textContent='📐 Poser ses cotes 3D';a.style.display='';
    a.onclick=e=>{e.stopPropagation();try{hideCtx();}catch(x){}let k=0;try{k=c3AutoFeat(fa);}catch(x){k=0;}
      if(k){if(c3.hidden)c3Hide(false);try{c3Dirty();}catch(x){}c3Say(k+' cote'+(k>1?'s':'')+' 3D posée'+(k>1?'s':'')+'.');}else c3Say('Aucune cote 3D à poser pour « '+(fa.name||fa.id)+' ».',true);c3Wake();};
  }else if(a)a.style.display='none';
  if(!L.length){if(b)b.style.display='none';return;}
  if(!b){b=document.createElement('button');b.type='button';b.id='ctxC3';M.appendChild(b);}
  const vis=L.some(d=>!d.hid)&&!c3.hidden;
  b.textContent=(vis?'👁 Cacher ses cotes 3D (':'👁 Montrer ses cotes 3D (')+L.length+')';b.style.display='';
  b.onclick=e=>{e.stopPropagation();try{hideCtx();}catch(x){}c3HideSet(L,vis);c3Wake();};
}
function c3EyeSvg(off){return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>'+(off?'<path d="M4 20L20 4"/>':'')+'</svg>';}
function c3Init(){
  try{
    if(typeof document==='undefined'||!document.getElementById)return;
    c3Css();
    const vb=document.getElementById('viewbar'),st=document.getElementById('btnPp')||document.getElementById('btnLens')||document.getElementById('btnSettings');
    if(vb&&!document.getElementById('btnC3')){
      const b=document.createElement('button');b.id='btnC3';
      b.title='Cote 3D (D) : coter sur la pièce — la cote pilote l’esquisse ou la fonction, avec tolérances et cadres de la mise en plan';
      b.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M4 6v12M20 6v12M4 12h16"/><path d="M7 9.5L4 12l3 2.5M17 9.5l3 2.5-3 2.5"/></svg>';
      b.setAttribute('aria-label','Cote 3D');b.setAttribute('aria-pressed','false');
      b.onclick=ev=>{if(ev)ev.stopPropagation();if(c3Tool)c3ToolStop();else c3ToolStart();};
      vb.insertBefore(b,st||null);c3.btn=b;
      const v=document.createElement('button');v.id='btnC3Vis';v.setAttribute('aria-pressed','true');v.title='Cacher les cotes 3D (Maj+D)';v.innerHTML=c3EyeSvg(false);
      v.onclick=ev=>{if(ev)ev.stopPropagation();if(c3Tool)c3ToolStop();c3Eye();};
      vb.insertBefore(v,st||null);c3.btnVis=v;
    }
    if(typeof addEventListener==='function'&&!c3Init.k){c3Init.k=true;addEventListener('keydown',c3Key,true);}
  }catch(e){}
}
c3Init();
/* ── cotes d'ordonnées (27/11) ──
   Fred : « il faudrait ajouter les cotes d'ordonnées dans l'esquisse et donc le 3D et donc la mise en
   plan ». Une ordonnée d'esquisse (50-esquisse-98 : cote distance ord:1, famille og) devient une cote 3D
   du zéro au point (face ↔ face, face ↔ axe), qui la pilote comme les autres. Elle porte ord:1 et og
   (la famille) ; la famille partage side (rappels dans le plan de l'esquisse, du côté des valeurs de
   l'esquisse), off (écart au-delà de la pièce) et ordw = [W, niveau] : les pieds des rappels glissent le
   long de la normale de l'esquisse W jusqu'à ce niveau (dessus de la pièce vu à la création). Dessin :
   rappel du point jusqu'à l'alignement, la valeur au bout, sans flèche ; « 0 » au zéro (1re cote). */
function c3AutoOrd(sk,free,face,used){
  const ordD=free.filter(dm=>dm.ord&&dm.type==='distance'&&(dm.orient==='h'||dm.orient==='v'));
  if(!ordD.length)return 0;
  const facesAt=(pid,o)=>{
    // entités du point dont la face est perpendiculaire à la mesure : cercle / arc / perçage centré,
    // trait perpendiculaire à l'axe (vertical pour X)
    const out=[];
    (sk.entities||[]).forEach(e=>{if(!e||!face.has(e.id))return;
      if((e.t==='circle'||e.t==='arc')&&e.pc===pid)out.push(e.id);
      else if(e.t==='cpoint'&&e.p===pid)out.push(e.id);
      else if(e.t==='line'&&(e.p1===pid||e.p2===pid)){const A=sk.points[e.p1],B=sk.points[e.p2];if(!A||!B)return;const L=Math.hypot(B.x-A.x,B.y-A.y);if(!(L>1e-9))return;
        if(o==='h'?Math.abs(B.x-A.x)/L<1e-6:Math.abs(B.y-A.y)/L<1e-6)out.push(e.id);}});
    return out;
  };
  let n=0;const fams=new Map();
  const SB=typeof sketchBasis==='function'?sketchBasis(sk):null;if(!SB)return 0;
  const Et=id=>((sk.entities||[]).find(e=>e&&e.id===id)||{}).t;
  ordD.forEach(dm=>{
    if(n>=24||used.has(dm.id))return;
    const FA=facesAt(dm.a,dm.orient),FB=facesAt(dm.b,dm.orient),m=Math.abs(parDimUser(dm)),Pa=sk.points[dm.a];
    // la mesure se fait le long de l'axe de l'esquisse (X ou Y) : entre deux centres de trous aussi
    const Nd=(dm.orient==='v'?SB.v:SB.u).clone().normalize(),prep=x=>{x.ordN=[Nd.x,Nd.y,Nd.z].map(v=>+v.toFixed(6));};
    const Z=FA.map(id=>({r:face.get(id),id}));
    // zéro sans face (origine de l'esquisse, point libre) : un zéro libre, à sa place dans l'espace
    if(!Z.length&&Pa){const O=SB.o.clone().addScaledVector(SB.u,Pa.x).addScaledVector(SB.v,Pa.y);Z.push({r:{ord0:1,sk:sk.id,pt:dm.a,p:[O.x,O.y,O.z].map(v=>+v.toFixed(6)),lib:dm.a===(typeof SK_ORIGIN!=='undefined'?SK_ORIGIN:'')?'origine de l’esquisse':'zéro de l’esquisse',nom:''},id:null});}
    for(const z of Z){let made=null;
      for(const b of FB){if(z.id===b)continue;const t=Et(b),kind=z.r.ord0?(t==='circle'||t==='arc'||t==='cpoint'?'axe':'plans'):null;
        made=c3AutoMake(z.r,face.get(b),{t:'dim',sk:sk.id,d:dm.id},m,kind,prep);if(made)break;}
      if(made){used.add(dm.id);n++;made.ord=1;made.og=sk.id+':'+(dm.og||(dm.a+dm.orient));
        // quel bout est le zéro : le plus proche, le long de la mesure, du zéro de l'esquisse
        // (face ↔ axe : le point de l'axe vient d'abord, même si la face est le zéro)
        const g=C3G.get(made),Pa=sk.points[dm.a];
        if(g&&g.p1&&g.p2&&g.n&&SB&&Pa){const O=SB.o.clone().addScaledVector(SB.u,Pa.x).addScaledVector(SB.v,Pa.y);
          made.oz=Math.abs(g.n.dot(g.p2.clone().sub(O)))<Math.abs(g.n.dot(g.p1.clone().sub(O)))?2:1;}
        if(!fams.has(made.og))fams.set(made.og,dm);break;}
    }
  });
  fams.forEach((dm,og)=>c3OrdLayout(og,SB,dm));
  return n;
}
function c3OrdLayout(og,SB,dm){
  // réglage commun de la famille : celui de sa 1re cote s'il existe, sinon tiré de l'esquisse
  const all=c3List().filter(x=>x&&x.ord&&x.og===og);if(!all.length)return;
  const head=all.find(x=>Array.isArray(x.ordw)&&Array.isArray(x.side))||null;
  let side,ordw,off;
  if(head){side=head.side.slice();ordw=head.ordw.slice();off=+head.off;}
  else{
    const bu=SB?SB.u:new THREE.Vector3(1,0,0),bv=SB?SB.v:new THREE.Vector3(0,1,0),bn=SB?SB.n:new THREE.Vector3(0,0,1);
    const sg=(+dm.w||0)<0?-1:1,U=(dm.orient==='v'?bu:bv).clone().normalize().multiplyScalar(sg),Wn=bn.clone().normalize();
    const B=c3PartBox();let lev=SB?Wn.dot(SB.o):0;
    if(!B.isEmpty()){const vd=new THREE.Vector3();camera.getWorldDirection(vd);const c=B.getCenter(new THREE.Vector3()),h=B.getSize(new THREE.Vector3()).multiplyScalar(.5);
      lev=Wn.dot(c)+(Wn.dot(vd)<0?1:-1)*c3Half(h,Wn);}
    side=[U.x,U.y,U.z].map(v=>+v.toFixed(6));ordw=[Wn.x,Wn.y,Wn.z,lev].map(v=>+v.toFixed(6));off=8;
  }
  all.forEach(x=>{x.side=side.slice();x.ordw=ordw.slice();x.off=off;x.slide=0;});
}
function c3OrdSync(d){
  // l'écart choisi en glissant vaut pour toute la famille
  if(!d||!d.og)return;
  c3List().forEach(x=>{if(x!==d&&x.ord&&x.og===d.og)x.off=d.off;});
}
function c3OrdGeo(d,g){
  const u=new THREE.Vector3(d.side[0],d.side[1],d.side[2]).normalize(),Wn=new THREE.Vector3(d.ordw[0],d.ordw[1],d.ordw[2]).normalize(),lw=+d.ordw[3]||0;
  const at=p=>p.clone().addScaledVector(Wn,lw-Wn.dot(p)); // pied du rappel au niveau de la famille
  const B=c3PartBox(),c=B.isEmpty()?g.p1.clone():B.getCenter(new THREE.Vector3()),h=B.isEmpty()?new THREE.Vector3():B.getSize(new THREE.Vector3()).multiplyScalar(.5);
  const lev=u.dot(c)+c3Half(h,u)+Math.max(2,+d.off||8);
  const P1=at(d.oz===2?g.p2:g.p1),P2=at(d.oz===2?g.p1:g.p2); // A = le zéro, B = le point coté
  const A2=P1.clone().addScaledVector(u,lev-u.dot(P1)),B2=P2.clone().addScaledVector(u,lev-u.dot(P2));
  const w=g.n?new THREE.Vector3().crossVectors(g.n,u):new THREE.Vector3();if(w.lengthSq()>1e-9)w.normalize();
  return {u,w,off:lev-u.dot(P1),axl:[],ord:true,A:P1,B:P2,A2,B2,A3:A2.clone().addScaledVector(u,2),B3:B2.clone().addScaledVector(u,2)};
}
function c3OrdHead(d){return c3List().find(x=>x&&x.ord&&x.og===d.og&&!x.hid)||d;}
function c3OrdDraw(d,g,el,col,W,H,vd){
  const G=c3Geo(d,g),head=c3OrdHead(d)===d;
  const b=c3Proj(G.B,W,H),b3=c3Proj(G.B3,W,H),a=c3Proj(G.A,W,H),a3=c3Proj(G.A3,W,H);
  el.ext.setAttribute('d','M'+b[0]+','+b[1]+'L'+b3[0]+','+b3[1]+(head?'M'+a[0]+','+a[1]+'L'+a3[0]+','+a3[1]:''));
  el.ln.setAttribute('d','');el.ar.setAttribute('d','');if(el.cl)el.cl.setAttribute('d','');
  const dx=b3[0]-b[0],dy=b3[1]-b[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;
  const lx=b3[0]+ux*4,ly=b3[1]+uy*4;
  el.lab.style.transform='translate('+(ux>=0.3?'0':ux<=-0.3?'-100%':'-50%')+','+(uy>=0.3?'0':uy<=-0.3?'-100%':'-50%')+')';
  if(!el.z){const NS='http://www.w3.org/2000/svg';el.z=document.createElementNS(NS,'text');el.z.setAttribute('font-size','13');el.z.setAttribute('font-weight','700');
    el.z.setAttribute('text-anchor','middle');el.z.setAttribute('dominant-baseline','middle');el.z.setAttribute('paint-order','stroke');el.z.setAttribute('stroke-width','3');el.z.textContent='0';el.g.appendChild(el.z);}
  el.z.style.display=head?'':'none';
  if(head){const dz=a3[0]-a[0],ez=a3[1]-a[1],lz=Math.hypot(dz,ez)||1;
    el.z.setAttribute('x',(a3[0]+dz/lz*9).toFixed(1));el.z.setAttribute('y',(a3[1]+ez/lz*9).toFixed(1));el.z.setAttribute('fill',col);
    el.z.setAttribute('stroke',el.g.closest&&el.g.closest('.c3clair')?'#ffffff':'#0e1219');}
  let op=1;const pn=g.n?new THREE.Vector3().crossVectors(g.n,G.u):null;if(pn&&pn.lengthSq()>1e-8)op=Math.max(.15,Math.min(1,Math.abs(pn.normalize().dot(vd))*2.4));
  return {lx:b3[2]>1?-999:lx,ly,op};
}
function c3OrdProj(d,g){
  // ordonnée : la mesure se lit le long de son sens (ordN), même entre deux trous qui ne sont pas alignés
  if(!g||!Array.isArray(d.ordN))return g;
  const N=c3V(d.ordN).normalize();let s=N.dot(g.p2.clone().sub(g.p1));if(s<0){N.negate();s=-s;}
  g.v=s;g.n=N;return g;
}
function c3ReadOrd0(d){
  // zéro libre (origine de l'esquisse) ↔ face plane ou trou, le long de ordN
  const B=parMesFace(d.b);if(!B)return {err:'la face ('+c3FaceLib(d.b)+') n’existe plus'};
  try{
    const s=occSurfDesc(B.face),bx=c3Box(B.face);let O=c3V(d.a.p);
    // le zéro suit son point d'esquisse (plan ou point déplacés)
    try{const sk=d.a.sk&&(doc.sketches||[]).find(x=>x&&x.id===d.a.sk),P=sk&&sk.points&&sk.points[d.a.pt],SB=P&&typeof sketchBasis==='function'?sketchBasis(sk):null;
      if(SB)O=SB.o.clone().addScaledVector(SB.u,P.x).addScaledVector(SB.v,P.y);}catch(e){}
    if(!Array.isArray(d.ordN))return {err:'sens de mesure inconnu'};
    const N=c3V(d.ordN).normalize();let P=bx&&bx.c?bx.c.clone():null,ax=null,k='plans';
    if(s.k==='cy'){ax=c3V(s.a).normalize();const p=c3V(s.p);P=p.clone().addScaledVector(ax,ax.dot((P||p).clone().sub(p)));k='axe';}
    else if(s.k!=='pl')return {err:'la face n’est ni plane ni un trou'};
    else if(Math.abs(c3V(s.n).normalize().dot(N))<0.999)return {err:'la face n’est plus perpendiculaire à la mesure'};
    if(!P)return {err:'face illisible'};
    let v=N.dot(P.clone().sub(O));const n=N.clone();if(v<0){v=-v;n.negate();}
    return {v,k,p1:O,p2:P,n,bA:null,bB:bx,ax,cyA:false,cyB:s.k==='cy'};
  }catch(e){return {err:e.message||'lecture impossible'};}
  finally{occFree(B.face);}
}
function c3OrdStart(){
  // la 1re face cliquée devient le zéro d'une famille d'ordonnées posée en 3D
  if(!c3Tool||!c3Tool.a||c3Tool.a.ref.edge)return;
  c3Tool.ord={z:c3Tool.a.ref,og:'3d:'+Date.now().toString(36),N:null,n:0};
  c3Say('');c3BandSync();c3Wake();
}
function c3OrdLayout3(og,N){
  // famille posée en 3D : rappels le long d'un axe de la pièce ⊥ à la mesure, plan des cotes face à la
  // vue, valeurs vers le bas de l'écran, pieds au dessus de la pièce vu
  const all=c3List().filter(x=>x&&x.ord&&x.og===og);if(!all.length)return;
  const head=all.find(x=>Array.isArray(x.ordw)&&Array.isArray(x.side));
  if(head){all.forEach(x=>{x.side=head.side.slice();x.ordw=head.ordw.slice();x.off=+head.off;x.slide=0;});return;}
  const vd=new THREE.Vector3();camera.getWorldDirection(vd);const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  let U=null,bs=-1e9;
  C3_AXES.forEach(x=>{const a=new THREE.Vector3(x[0],x[1],x[2]);if(Math.abs(a.dot(N))>0.1)return;const s=Math.abs(new THREE.Vector3().crossVectors(N,a).dot(vd))-0.5*a.dot(up);if(s>bs){bs=s;U=a;}});
  if(!U)return;
  const Wn=new THREE.Vector3().crossVectors(N,U).normalize(),B=c3PartBox();let lev=0;
  if(!B.isEmpty()){const c=B.getCenter(new THREE.Vector3()),h=B.getSize(new THREE.Vector3()).multiplyScalar(.5);lev=Wn.dot(c)+(Wn.dot(vd)<0?1:-1)*c3Half(h,Wn);}
  const side=[U.x,U.y,U.z].map(v=>+v.toFixed(6)),ordw=[Wn.x,Wn.y,Wn.z,lev].map(v=>+v.toFixed(6));
  all.forEach(x=>{x.side=side.slice();x.ordw=ordw.slice();x.off=8;x.slide=0;});
}
function c3OrdPick(e){
  // une face ou un trou de plus dans la famille : cote zéro ↔ face, lue le long du sens de la famille
  const T=c3Tool.ord,h=typeof pick==='function'?pick(e):null;
  if(!h){c3Say('Ordonnées : clique une face ou un trou de la pièce.',true);return true;}
  const R=parMesRefOfHit(h.object,h.faceIndex);if(!R){c3Say('Ordonnées : face illisible.',true);return true;}
  let Z=null,sZ=null,sR=null,bad='',TN=T.N;
  try{
    Z=parMesFace(T.z);if(!Z)bad='le zéro est introuvable';
    else if(Z.face.IsSame(R.face))bad='c’est le zéro — clique une autre face';
    else{
      sZ=occSurfDesc(Z.face);sR=occSurfDesc(R.face);
      if(sR.k!=='pl'&&sR.k!=='cy')bad='une face plane ou un trou seulement';
      else if(sZ.k!=='pl'&&sZ.k!=='cy')bad='le zéro doit être une face plane ou un trou';
      else if(!TN){
        let N=null;
        if(sZ.k==='pl')N=c3V(sZ.n).normalize();
        else if(sR.k==='pl')N=c3V(sR.n).normalize();
        else{const a=c3V(sZ.a).normalize(),dv=c3V(sR.p).sub(c3V(sZ.p));dv.addScaledVector(a,-a.dot(dv));let bs=-1;
          C3_AXES.forEach(x=>{const v=new THREE.Vector3(x[0],x[1],x[2]);if(Math.abs(v.dot(a))>0.1)return;const q=Math.abs(v.dot(dv));if(q>bs){bs=q;N=v;}});}
        if(!N)bad='sens de mesure introuvable';else TN=[N.x,N.y,N.z].map(v=>+v.toFixed(6));
      }
      if(!bad&&TN){const N=c3V(TN);
        if(sR.k==='pl'&&Math.abs(c3V(sR.n).normalize().dot(N))<0.999)bad='cette face n’est pas perpendiculaire à la mesure';
        if(sR.k==='cy'&&Math.abs(c3V(sR.a).normalize().dot(N))>0.01)bad='l’axe de ce trou n’est pas perpendiculaire à la mesure';}
    }
  }catch(err){bad=err.message||'lecture impossible';}
  finally{if(Z)occFree(Z.face);occFree(R.face);}
  if(bad){c3Say('Ordonnées : '+bad+'.',true);return true;}
  if(c3List().some(x=>x.ord&&x.og===T.og&&c3SameRef(x.b,R.ref))){c3Say('Ordonnées : cette face est déjà cotée.',true);return true;}
  const k=sZ.k==='cy'&&sR.k==='cy'?'entraxe':(sZ.k==='cy'||sR.k==='cy')?'axe':'plans';
  const d=c3New(T.z,R.ref,k);d.ordN=TN.slice();d.ord=1;d.og=T.og;
  const g=c3Read(d);if(!g||g.err||!isFinite(+g.v)){c3Say('Ordonnées : '+((g&&g.err)||'mesure impossible')+'.',true);return true;}
  // le zéro : le bout posé sur la face du zéro
  const on=p=>{if(sZ.k==='pl')return Math.abs(c3V(sZ.n).normalize().dot(p.clone().sub(c3V(sZ.p))));const a=c3V(sZ.a).normalize(),v=p.clone().sub(c3V(sZ.p));v.addScaledVector(a,-a.dot(v));return Math.abs(v.length()-0);};
  d.oz=on(g.p2)<on(g.p1)?2:1;d.v=+g.v;C3G.set(d,g);
  // pilote : le premier réglage libre, sinon cote de référence
  let C=[];try{C=c3Candidates(d).filter(c=>!c.held&&c.drv&&c.drv.t!=='newdim');}catch(x){C=[];}
  if(C.length){d.drive=C[0].drv;if(C[0].s!=null)d.slope=C[0].s;}
  T.N=TN;c3Add(d);c3OrdLayout3(T.og,c3V(T.N));T.n++;
  c3Say('Ordonnée '+c3Num(d.v)+(d.drive?' · pilote '+c3DrvLib(d.drive):' · de référence')+' — clique la suivante (Échap pour finir).');
  c3BandSync();c3Wake();return true;
}
/* ── sommets ; arête, sommet ↔ face (Fred, 27/11 : tout faire avant d'essayer) ── */
function c3EdgeRaw(ref){
  // polyligne de l'arête désignée par ref ({en, epos|pos, body}) → [Vector3] | null
  const L=parMesShapes(),pos=ref.epos||ref.pos,ord=L.filter(b=>b.id===ref.body).concat(L.filter(b=>b.id!==ref.body));
  for(const bd of ord){
    const E=c3EdgeList(bd);if(!E.length)continue;
    let i=ref.en&&typeof nomsTrouveArete==='function'?nomsTrouveArete(E,ref.en,pos):-1;
    if(i<0&&Array.isArray(pos)){let b2=0.05;E.forEach((e,k)=>{const q=Math.hypot(e.mid[0]-pos[0],e.mid[1]-pos[1],e.mid[2]-pos[2]);if(q<b2){b2=q;i=k;}});}
    if(i>=0)return E[i].pts.map(p=>p&&p.isVector3?p.clone():c3V(p));
  }
  return null;
}
function c3VtxFind(ref){
  // sommet = un bout de l'arête nommée : celui qui garde le mieux sa place (et l'autre bout la sienne)
  const P=c3EdgeRaw(ref);if(!P||P.length<2)return null;
  const e0=P[0],e1=P[P.length-1],p=c3V(ref.pos),o=Array.isArray(ref.oth)?c3V(ref.oth):null;
  const s0=e0.distanceTo(p)+(o?e1.distanceTo(o):0),s1=e1.distanceTo(p)+(o?e0.distanceTo(o):0);
  return (s0<=s1?e0:e1).clone();
}
function c3VtxAt(e,EH){
  // sommet sous le curseur : un bout de l'arête trouvée, à moins de 9 px
  const P=EH&&EH.P;if(!Array.isArray(P)||P.length<2)return null;
  const V=P.map(p=>p&&p.isVector3?p:c3V(p)),e0=V[0],e1=V[V.length-1];if(e0.distanceTo(e1)<1e-6)return null; // cercle fermé : pas de sommet
  const rr=renderer.domElement.getBoundingClientRect(),mx=e.clientX-rr.left,my=e.clientY-rr.top;
  const sd=q=>{const v=q.clone().project(camera);return Math.hypot((v.x+1)/2*rr.width-mx,(1-v.y)/2*rr.height-my);};
  const d0=sd(e0),d1=sd(e1),near=d0<=d1?e0:e1,far=d0<=d1?e1:e0;if(Math.min(d0,d1)>9)return null;
  const r3=v=>[v.x,v.y,v.z].map(x=>+x.toFixed(4));
  return {ref:{vtx:true,en:EH.ref.en,epos:EH.ref.pos,pos:r3(near),oth:r3(far),body:EH.ref.body,nom:EH.ref.nom,lib:'Sommet'},p:near.clone()};
}
function c3VtxHl(p){
  // sommet choisi : un point orange
  try{if(c3.eg){c3.eg.removeFromParent();c3.eg=null;}if(!p)return;const g=new THREE.Group();g.name='c3EdgeHl';
    const geo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([p.x,p.y,p.z],3));
    const m=new THREE.Points(geo,new THREE.PointsMaterial({color:0xff9f0a,size:11,sizeAttenuation:false,depthTest:false}));m.renderOrder=999;g.add(m);scene.add(g);c3.eg=g;}catch(e){}
}
function c3GeoOf(ref){
  // un élément de la pièce, en géométrie simple : point, droite, cercle, plan, axe
  if(ref.vtx){const p=c3VtxFind(ref);if(!p)return {err:'le sommet ('+c3FaceLib(ref)+') n’existe plus'};return {kind:'pt',p,box:{c:p.clone(),h:new THREE.Vector3()}};}
  if(ref.edge){const G=c3EdgeFind(ref);if(!G)return {err:'l’arête ('+c3FaceLib(ref)+') n’existe plus'};const box=c3PtsBox(G.pts);
    if(G.kind==='line')return {kind:'line',a:G.a.clone(),u:G.u.clone().normalize(),m:G.a.clone().add(G.b).multiplyScalar(.5),box,G};
    return {kind:'circle',c:G.c.clone(),ax:G.ax.clone().normalize(),r:G.r,box,G};}
  const F=parMesFace(ref);if(!F)return {err:'la face ('+c3FaceLib(ref)+') n’existe plus'};
  try{
    const s=occSurfDesc(F.face),box=c3Box(F.face);
    if(s.k==='pl')return {kind:'plane',n:c3V(s.n).normalize(),p:c3V(s.p),box};
    if(s.k==='cy'){const ax=c3V(s.a).normalize(),p=c3V(s.p),q=box?box.c.clone():p.clone();return {kind:'axis',ax,c:p.clone().addScaledVector(ax,ax.dot(q.sub(p))),box};}
    return {err:'la face n’est ni plane ni cylindrique'};
  }catch(e){return {err:e.message||'lecture impossible'};}
  finally{occFree(F.face);}
}
function c3MixSolve(X,Y){
  // X : sommet ou arête ; Y : sommet, arête, face plane ou cylindre → {k, p (sur X), q (sur Y), cyX, cyY, ax} | {err}
  const onPlane=p=>p.clone().addScaledVector(Y.n,-Y.n.dot(p.clone().sub(Y.p)));
  const onLine=(p,a,u)=>a.clone().addScaledVector(u,u.dot(p.clone().sub(a)));
  const par=(a,b)=>new THREE.Vector3().crossVectors(a,b).length()<1e-4;
  if(X.kind==='pt'){
    const p=X.p.clone();
    if(Y.kind==='pt')return {k:'plans',p,q:Y.p.clone()};
    if(Y.kind==='plane')return {k:'plans',p,q:onPlane(p)};
    if(Y.kind==='line')return {k:'plans',p,q:onLine(p,Y.a,Y.u)};
    if(Y.kind==='axis'||Y.kind==='circle')return {k:'axe',p,q:onLine(p,Y.c,Y.ax),ax:Y.ax.clone(),cyY:true};
  }
  if(X.kind==='line'){
    if(Y.kind==='plane'){if(Math.abs(X.u.dot(Y.n))>1e-3)return {err:'l’arête n’est pas parallèle à la face'};return {k:'plans',p:X.m.clone(),q:onPlane(X.m)};}
    if(Y.kind==='axis'){if(!par(X.u,Y.ax))return {err:'l’arête n’est pas parallèle à l’axe du cylindre'};return {k:'axe',p:X.m.clone(),q:onLine(X.m,Y.c,Y.ax),ax:Y.ax.clone(),cyY:true};}
  }
  if(X.kind==='circle'){
    if(Y.kind==='plane'){
      const c=Math.abs(X.ax.dot(Y.n));
      if(c>0.999)return {k:'plans',p:X.c.clone(),q:onPlane(X.c)}; // cercle dans un plan parallèle à la face
      if(c<1e-3)return {k:'axe',p:X.c.clone(),q:onPlane(X.c),ax:X.ax.clone(),cyX:true}; // axe du cercle parallèle à la face
      return {err:'le cercle n’est ni parallèle ni perpendiculaire à la face'};
    }
    if(Y.kind==='axis'){
      if(!par(X.ax,Y.ax))return {err:'le cercle et le cylindre n’ont pas des axes parallèles'};
      const dv=Y.c.clone().sub(X.c);dv.addScaledVector(X.ax,-dv.dot(X.ax));
      return {k:'entraxe',p:X.c.clone(),q:X.c.clone().add(dv),ax:X.ax.clone(),cyX:true,cyY:true};
    }
  }
  return {err:'ces deux éléments ne se cotent pas ensemble'};
}
function c3MixPair(GA,GB){
  // → {v, k, p1, p2, n, bA, bB, ax, cyA, cyB} ; une cote « axe » commence toujours sur l'axe
  const rk=g=>g.kind==='pt'?0:(g.kind==='line'||g.kind==='circle')?1:2;
  if(rk(GA)===1&&rk(GB)===1)return c3EdgePair(GA.G,GB.G);
  if(rk(GA)===2&&rk(GB)===2)return {err:'deux faces : choisis-les sans arête ni sommet'};
  const sw=rk(GA)>rk(GB),r=c3MixSolve(sw?GB:GA,sw?GA:GB);if(r.err)return r;
  let p1=sw?r.q:r.p,p2=sw?r.p:r.q,cA=sw?!!r.cyY:!!r.cyX,cB=sw?!!r.cyX:!!r.cyY,bA=GA.box,bB=GB.box;
  if(r.k==='axe'&&!cA&&cB){[p1,p2]=[p2,p1];[cA,cB]=[cB,cA];[bA,bB]=[bB,bA];}
  const n=p2.clone().sub(p1),L=n.length();if(L<1e-6)return {err:'les deux éléments se touchent'};
  return {v:L,k:r.k,p1,p2,n:n.multiplyScalar(1/L),bA,bB,ax:r.ax||null,cyA:cA,cyB:cB,edge:true};
}
function c3ReadMix(d){
  const GA=c3GeoOf(d.a);if(GA.err)return {err:GA.err};
  const GB=c3GeoOf(d.b);if(GB.err)return {err:GB.err};
  return c3MixPair(GA,GB);
}
function c3SameEl(a,b){
  // même élément : même face (nom), même arête (nom + place), même sommet (place)
  if(!a||!b)return false;
  if(a.vtx||b.vtx)return !!(a.vtx&&b.vtx&&a.pos&&b.pos&&Math.hypot(a.pos[0]-b.pos[0],a.pos[1]-b.pos[1],a.pos[2]-b.pos[2])<1e-3);
  if(a.edge||b.edge)return !!(a.edge&&b.edge&&a.en===b.en&&String(a.pos)===String(b.pos));
  return c3SameRef(a,b);
}
function c3MixMake(rb){
  // 2e élément choisi : sommet, arête ou face avec le 1er → la cote, puis « qu'est-ce qui bouge ? »
  const ra=c3Tool&&c3Tool.a&&c3Tool.a.ref;if(!ra)return true;
  if(c3SameEl(ra,rb)){c3Say('Cote 3D : c’est le même élément, clique-en un autre.',true);return true;}
  const d=c3New(ra,rb,'plans'),g=c3Read(d);
  if(!g||g.err||!isFinite(+g.v)){c3Say('Cote 3D : '+((g&&g.err)||'mesure impossible')+'.',true);return true;}
  d.k=g.k;
  const same=c3List().find(x=>x.k===d.k&&((c3SameEl(x.a,d.a)&&c3SameEl(x.b,d.b))||(c3SameEl(x.a,d.b)&&c3SameEl(x.b,d.a))));
  c3ToolStop();
  if(same){c3Select(same);c3Say('Cette cote existe déjà.');return true;}
  c3Add(d);c3AskDrive(d,true);return true;
}
function c3ReadPolar(d){
  // pas angulaire d'une répétition circulaire : angle entre les axes de deux trous (ou les centres de deux
  // faces), autour de l'axe de la répétition (il passe par l'origine) ; trou ↔ face plane parallèle à l'axe :
  // angle depuis la normale de la face (d.par : depuis la face elle-même)
  if(d.hax)return c3ReadHax(d);
  const rp=c3Feat(d.polar);if(!rp||rp.type!=='repeat'||rp.mode!=='circ')return {err:'la répétition circulaire n’existe plus'};
  const A=parMesFace(d.a);if(!A)return {err:'la 1re face ('+c3FaceLib(d.a)+') n’existe plus'};
  const B=parMesFace(d.b);if(!B){occFree(A.face);return {err:'la 2e face ('+c3FaceLib(d.b)+') n’existe plus'};}
  try{
    const sA=occSurfDesc(A.face),sB=occSurfDesc(B.face),bA=c3Box(A.face),bB=c3Box(B.face);
    const e=c3V(typeof repAxisVec==='function'?repAxisVec(rp):[0,0,1]).normalize();
    const at=(s,b)=>{if(s&&s.k==='cy'){const a=c3V(s.a).normalize(),p=c3V(s.p);return b?p.addScaledVector(a,a.dot(b.c.clone().sub(p))):p;}return b?b.c.clone():null;};
    const pl=s=>!!s&&s.k==='pl'&&Math.abs(c3V(s.n).dot(e))<0.02,cyA=!!sA&&sA.k==='cy',cyB=!!sB&&sB.k==='cy';
    const plA=!cyA&&cyB&&pl(sA),plB=!cyB&&cyA&&pl(sB);
    const PA=plA?null:at(sA,bA),PB=plB?null:at(sB,bB);if((!PA&&!plA)||(!PB&&!plB))return {err:'face illisible'};
    const P=e.clone().multiplyScalar(e.dot(PA||PB));
    const rad=Q=>{const t=Q.clone().sub(P);t.addScaledVector(e,-e.dot(t));return t;};
    let tA=PA?rad(PA):null,tB=PB?rad(PB):null;
    if((tA&&tA.lengthSq()<1e-9)||(tB&&tB.lengthSq()<1e-9))return {err:'un élément est sur l’axe de la répétition'};
    const r0A=tA?tA.length():0,r0B=tB?tB.length():0;if(tA)tA.normalize();if(tB)tB.normalize();
    // face de référence : sa normale vers la face (ou, d.par, le long de la face du côté du trou)
    const dirPl=(s,b,tO)=>{const n=c3V(s.n);n.addScaledVector(e,-e.dot(n));n.normalize();if(b&&n.dot(b.c.clone().sub(P))<0)n.negate();
      if(!d.par)return n;const w=new THREE.Vector3().crossVectors(e,n).normalize();if(tO&&w.dot(tO)<0)w.negate();return w;};
    if(plA)tA=dirPl(sA,bA,tB);if(plB)tB=dirPl(sB,bB,tA);
    const ang=Math.acos(Math.max(-1,Math.min(1,tA.dot(tB))))*180/Math.PI;
    const rA=plA?r0B:r0A,rB=plB?r0A:r0B;
    // qa, qb : centres des deux trous dans le plan du centre P (mise en plan : angle par trois points) ; face : à même rayon
    const qa=P.clone().addScaledVector(tA,rA),qb=P.clone().addScaledVector(tB,rB);
    return {v:ang,k:'angle',p:P,e,tA,tB,bA,bB,big:false,polar:true,rA,qa,qb,plane:plA||plB};
  }catch(x){return {err:x.message||'lecture impossible'};}
  finally{occFree(A.face);occFree(B.face);}
}
function c3HaxDir(e,vert){
  // axe horizontal d'un cercle de trous : X du monde mis ⊥ à l'axe (Y si l'axe est le long de X) ; vertical : ⊥ aux deux
  const h=new THREE.Vector3(1,0,0);if(Math.abs(h.dot(e))>0.9)h.set(0,1,0);
  h.addScaledVector(e,-e.dot(h)).normalize();
  return vert?new THREE.Vector3().crossVectors(e,h).normalize():h;
}
function c3ReadHax(d){
  // angle du trou d.a autour de l'axe de la répétition depuis le demi-axe horizontal (ou vertical) le plus proche : 0 à 90°
  const rp=c3Feat(d.polar);if(!rp||rp.type!=='repeat'||rp.mode!=='circ')return {err:'la répétition circulaire n’existe plus'};
  const A=parMesFace(d.a);if(!A)return {err:'le trou ('+c3FaceLib(d.a)+') n’existe plus'};
  try{
    const s=occSurfDesc(A.face),b=c3Box(A.face);if(!s||s.k!=='cy'||!b)return {err:'ce n’est plus un trou'};
    const e=c3V(typeof repAxisVec==='function'?repAxisVec(rp):[0,0,1]).normalize(),a=c3V(s.a).normalize(),o=c3V(s.p);
    const PA=o.clone().addScaledVector(a,a.dot(b.c.clone().sub(o))),P=e.clone().multiplyScalar(e.dot(PA));
    const t=PA.clone().sub(P);t.addScaledVector(e,-e.dot(t));const rA=t.length();if(rA<1e-6)return {err:'le trou est sur l’axe de la répétition'};t.normalize();
    const h=c3HaxDir(e,!!d.hv);if(h.dot(t)<0)h.negate(); // demi-axe du côté du trou
    const ang=Math.acos(Math.max(-1,Math.min(1,t.dot(h))))*180/Math.PI;
    // tA = l'axe (trait d'axe du centre au-delà de l'arc), tB = le trou ; qa, qb : mise en plan (angle par trois points)
    return {v:ang,k:'angle',p:P,e,tA:h,tB:t,bA:null,bB:b,big:false,polar:true,hax:true,rA,qa:P.clone().addScaledVector(h,rA),qb:PA.clone(),plane:false};
  }catch(x){return {err:x.message||'lecture impossible'};}
  finally{occFree(A.face);}
}
function c3ReadPcd(d){
  // Ø de perçage d'une répétition circulaire : deux fois la distance de l'axe d'un trou à l'axe de la répétition
  // (il passe par l'origine) ; H = centres de tous les trous (source puis exemplaires), au niveau du trou lu
  const rp=c3Feat(d.polar);if(!rp||rp.type!=='repeat'||rp.mode!=='circ')return {err:'la répétition circulaire n’existe plus'};
  const A=parMesFace(d.a);if(!A)return {err:'le trou ('+c3FaceLib(d.a)+') n’existe plus'};
  try{
    const s=occSurfDesc(A.face);if(!s||s.k!=='cy')return {err:'la face n’est plus un cylindre'};
    const bA=c3Box(A.face),a=c3V(s.a).normalize(),p=c3V(s.p),e=c3V(repAxisVec(rp)).normalize();
    const PA=bA?p.clone().addScaledVector(a,a.dot(bA.c.clone().sub(p))):p.clone();
    const P=e.clone().multiplyScalar(e.dot(PA)),t=PA.clone().sub(P);t.addScaledVector(e,-e.dot(t));
    const r=t.length();if(r<1e-6)return {err:'le trou est sur l’axe de la répétition'};t.normalize();
    const hl=bA?c3Half(bA.h,e):0;
    const o=c3Owner(d.a.nom),f=o&&c3Feat(o.fid),j=f&&f.repeatId===rp.id?(+f.repIndex||0):0;
    const st=repCircStep(rp),n=Math.max(1,Math.round(c3RepCount(rp)));
    const rot=(v,deg)=>c3V(repRot([v.x,v.y,v.z],[e.x,e.y,e.z],deg));
    const S=rot(PA,-j*st),H=[];for(let i=0;i<n;i++)H.push(rot(S,i*st));
    return {v:2*r,k:'pcd',p:P,e,r,t,hr:+s.r||0,hl,H,full:c3RepFull(rp),bA};
  }catch(x){return {err:x.message||'lecture impossible'};}
  finally{occFree(A.face);}
}
