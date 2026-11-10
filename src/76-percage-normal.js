/* ═══════════════════════════════════════════════════════════════════════════
   PERÇAGE NORMAL À UNE FACE (V0.83.0)
   Demande (cavité 002) : « je dois faire des trous Ø1,5 perpendiculaires à une face de type congé et
   passant par le centre des trous Ø8 non débouchants — je choisis la face, tu fais le trou et tu
   cherches tous les trous identiques ». Le centre visé est celui du CERCLE DU FOND du trou borgne
   (jonction du fût et du cône de la pointe, ou centre du fond plat).
   Géométrie : pour un point C, le seul point P d'une face dont la normale passe par C est son pied
   (point de la face le plus proche, À L'INTÉRIEUR de la face — BRepExtrema « IsInFace » : un pied
   sur un bord ne donne pas la perpendiculaire). Le trou part de P, suit P→C, et débouche dans le
   trou borgne (0,3 mm au-delà de C).
   • f = {type:'hole', place:{k:'normal', faces:[réf. de face], grp:{r,len,u}|null, maxD, off:[[x,y,z]…]},
          d (Ø du perçage), op:'cut'} — pas d'esquisse : tous les trous borgnes du groupe choisi dont
     le fond tombe sous une des faces sont percés, sauf ceux enlevés (off : centre du fond mémorisé).
     Les trous sont re-cherchés à chaque rejeu : le perçage suit la pièce.
   • Ignorés d'office : trous déjà percés au fond (un Ø1,5 dans l'axe d'un double perçage), et ceux
     dont le chemin P→C ne traverse pas que de la matière.
   • Une seule fonction, une seule étape d'annulation ; cases à cocher sous chaque trou dans la vue.
   ═══════════════════════════════════════════════════════════════════════════ */
const HN_MAXD=30; // mm : distance maxi face → fond du trou, par défaut
const hnRun=new Map(); // id de fonction → {all:[{C,P,on,off,why}], groups:[…]} (dernier rejeu, jamais enregistré)
function hnIs(f){return !!(f&&f.type==='hole'&&f.place&&f.place.k==='normal');}
function hnV(a,b){return [b[0]-a[0],b[1]-a[1],b[2]-a[2]];}
function hnDot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function hnLen(a){return Math.hypot(a[0],a[1],a[2]);}
function hnAt(o,d,t){return [o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t];}
function hnUnit(a){const L=hnLen(a)||1;return [a[0]/L,a[1]/L,a[2]/L];}
function hnFmt(v){return String(+(+v).toFixed(2)).replace('.',',');}
function hnGrpKey(g){return g?[(+g.r).toFixed(3),(+g.len).toFixed(2),g.u.map(function(x){return (+x).toFixed(3);}).join(',')].join('|'):'*';}
function hnGrpLabel(g,n){
  const ax=g.u.map(function(x){return Math.abs(x);}),k=ax.indexOf(Math.max.apply(null,ax));
  const nom=ax[k]>0.9999?((g.u[k]>0?'+':'−')+'XYZ'[k]):'oblique';
  return 'Ø'+hnFmt(2*g.r)+' × '+hnFmt(g.len)+' (fond vers '+nom+')'+(n!=null?' — '+n+' trou'+(n>1?'s':''):'');
}
/* ----- trous borgnes d'un solide ----- */
// → [{C (centre du cercle du fond), u (sens entrée → fond), r, len, h (hauteur du cône, 0 = plat), pierced}]
function hnBlindHoles(shape){
  const out=[];if(!shape||typeof occt==='undefined'||!occt)return out;
  const T=occt.GeomAbs_SurfaceType,cyls=[],cones=[];
  let ex=null;
  try{ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);}catch(e){return out;}
  while(ex.More()){
    let f=null,ad=null;const tmp=[];
    try{
      f=occFaceCur(ex);ad=new occt.BRepAdaptor_Surface_2(f,true);
      const ty=ad.GetType();
      if(ty===T.GeomAbs_Cylinder){
        const c=ad.Cylinder(),ax=c.Axis(),L=ax.Location(),D=ax.Direction();tmp.push(c,ax,L,D);
        const o=[L.X(),L.Y(),L.Z()],d=[D.X(),D.Y(),D.Z()];
        const v1=ad.FirstVParameter(),v2=ad.LastVParameter(),du=Math.abs(ad.LastUParameter()-ad.FirstUParameter());
        if(du>Math.PI*0.9&&Math.abs(v2-v1)>1e-4)cyls.push({o:o,d:d,r:c.Radius(),E1:hnAt(o,d,v1),E2:hnAt(o,d,v2)});
      }else if(ty===T.GeomAbs_Cone){
        const c=ad.Cone(),ax=c.Axis(),D=ax.Direction(),A=c.Apex();tmp.push(c,ax,D,A);
        cones.push({apex:[A.X(),A.Y(),A.Z()],d:[D.X(),D.Y(),D.Z()],semi:Math.abs(c.SemiAngle())});
      }
    }catch(e){}
    try{if(ad)ad.delete();}catch(e){}
    occDispose(tmp);occFree(f);ex.Next();
  }
  try{ex.delete();}catch(e){}
  if(!cyls.length)return out;
  const cl=occClassifier(shape),IN=occt.TopAbs_State.TopAbs_IN;
  const inside=function(q){const p=new occt.gp_Pnt_3(q[0],q[1],q[2]);try{cl.Perform(p,1e-6);return cl.State()===IN;}finally{try{p.delete();}catch(e){}}};
  const seen=new Set();
  try{
    cyls.forEach(function(c){
      const len=hnLen(hnV(c.E1,c.E2));if(!(len>1e-3))return;
      const mid=hnAt(c.E1,hnUnit(hnV(c.E1,c.E2)),len/2);
      if(inside(mid))return; // tenon (matière dans le cylindre), pas un trou
      const ends=[[c.E1,hnUnit(hnV(c.E2,c.E1))],[c.E2,hnUnit(hnV(c.E1,c.E2))]]; // [centre, sens vers l'extérieur du fût]
      const bot=[];
      ends.forEach(function(E){
        const Ei=E[0],oi=E[1];
        // pointe : cône coaxial dont le sommet est au-delà de ce bout, à la bonne pente
        const cn=cones.find(function(k){
          if(Math.abs(hnDot(k.d,oi))<0.9999)return false;
          const w=hnV(Ei,k.apex),t=hnDot(w,oi);if(!(t>1e-4&&t<=1.8*c.r+0.01))return false;
          if(hnLen(hnV(hnAt(Ei,oi,t),k.apex))>0.01)return false;
          return Math.abs(t*Math.tan(k.semi)-c.r)<0.05;
        });
        if(cn){bot.push({C:Ei,u:oi,h:hnDot(hnV(Ei,cn.apex),oi)});return;}
        // fond plat : matière juste au-delà du centre
        if(inside(hnAt(Ei,oi,0.05)))bot.push({C:Ei,u:oi,h:0});
      });
      if(bot.length!==1)return; // débouchant, ou ambigu
      const b=bot[0],key=b.C.map(function(x){return x.toFixed(2);}).join(',')+'|'+c.r.toFixed(3);
      if(seen.has(key))return;seen.add(key); // fût coupé en deux faces : un seul trou
      // déjà percé au fond (double perçage) : vide juste au-delà de la pointe
      const pierced=!inside(hnAt(b.C,b.u,b.h+0.1));
      out.push({C:b.C,u:b.u,r:c.r,len:len,h:b.h,pierced:pierced});
    });
  }finally{try{cl.delete();}catch(e){}}
  return out;
}
/* ----- pied de la perpendiculaire sur les faces choisies ----- */
function hnFoot(C,faces,maxD){
  // → {P, d} : pied INTÉRIEUR le plus proche sur l'une des faces, ou null
  const pt=new occt.gp_Pnt_3(C[0],C[1],C[2]);const mv=new occt.BRepBuilderAPI_MakeVertex(pt);const v=mv.Vertex();
  let best=null;
  try{
    faces.forEach(function(F){
      let x=null;
      try{
        x=new occt.BRepExtrema_DistShapeShape_2(v,F,occt.Extrema_ExtFlag.Extrema_ExtFlag_MIN,occt.Extrema_ExtAlgo.Extrema_ExtAlgo_Grad);
        if(!x.IsDone())return;
        for(let i=1;i<=x.NbSolution();i++){
          if(x.SupportTypeShape2(i)!==occt.BRepExtrema_SupportType.BRepExtrema_IsInFace)continue;
          const q=x.PointOnShape2(i),P=[q.X(),q.Y(),q.Z()];try{q.delete();}catch(e){}
          const d=hnLen(hnV(P,C));
          if(d>0.05&&d<=maxD&&(!best||d<best.d))best={P:P,d:d};
        }
      }catch(e){}
      finally{try{if(x)x.delete();}catch(e){}}
    });
  }finally{occFree(v);try{mv.delete();}catch(e){}try{pt.delete();}catch(e){}}
  return best;
}
/* ----- recherche complète (création et rejeu) ----- */
// → {all:[{C,P,d,D,on,off,why}], groups:[{g,n}], faces:n} ; grp null = tous les groupes
function hnScan(base,pl,dHole){
  const res={all:[],groups:[],faces:0};
  if(!base)return res;
  const faces=(pl.faces||[]).map(function(r){try{return occFindFaceAny(base,Object.assign({},r));}catch(e){return null;}}).filter(Boolean);
  res.faces=faces.length;
  if(!faces.length){return res;}
  const cl=occClassifier(base),IN=occt.TopAbs_State.TopAbs_IN;
  const inside=function(q){const p=new occt.gp_Pnt_3(q[0],q[1],q[2]);try{cl.Perform(p,1e-6);return cl.State()===IN;}finally{try{p.delete();}catch(e){}}};
  try{
    const maxD=+pl.maxD>0?+pl.maxD:HN_MAXD,gk=hnGrpKey(pl.grp),G=new Map();
    const off=(pl.off||[]);
    hnBlindHoles(base).forEach(function(h){
      const ft=hnFoot(h.C,faces,maxD);if(!ft)return;
      const D=hnUnit(hnV(ft.P,h.C));
      // le chemin doit traverser de la matière (sinon : trou d'à côté, ou déjà relié)
      const Lm=ft.d-h.h-0.2;
      let ok=Lm>0.3;
      if(ok)[0.3,Lm/2,Lm].forEach(function(t){if(ok&&!inside(hnAt(ft.P,D,t)))ok=false;});
      const g={r:+h.r.toFixed(4),len:+h.len.toFixed(3),u:h.u.map(function(x){return +x.toFixed(4);})},k=hnGrpKey(g);
      if(!G.has(k))G.set(k,{g:g,n:0});
      if(!h.pierced&&ok)G.get(k).n++;
      if(gk!=='*'&&k!==gk)return;
      const isOff=off.some(function(o){return hnLen(hnV(o,h.C))<0.5;});
      res.all.push({C:h.C,P:ft.P,d:ft.d,D:D,on:!h.pierced&&ok&&!isOff,off:isOff,why:h.pierced?'déjà percé au fond':(!ok?'chemin hors matière':'')});
    });
    res.groups=[...G.values()].sort(function(a,b){return b.n-a.n;});
  }finally{try{cl.delete();}catch(e){}occDispose(faces);}
  return res;
}
/* ----- outil de découpe ----- */
function occShapeOfHoleNormal(f){
  const base=(typeof occThroughBase!=='undefined')?occThroughBase:null;
  if(!base)throw new Error('perçage normal : aucune pièce avant cette fonction');
  const pl=f.place,r=Math.max(0.1,+f.d||1.5)/2;
  const S=hnScan(base,pl,2*r);
  hnRun.set(f.id,S);
  if(!S.faces)throw new Error('face du congé introuvable — la pièce a changé, choisissez-la de nouveau');
  const T=S.all.filter(function(t){return t.on;});
  if(!T.length)throw new Error('aucun trou borgne'+(pl.grp?' '+hnGrpLabel(pl.grp):'')+' sous la face choisie');
  const bins=[],tool=[];
  // départ r + 0,1 AU-DESSUS du pied : sur une face courbe (congé concave de rayon ≥ r), le bord du
  // trou reste hors matière ; fin 0,3 au-delà du centre du fond, dans le vide du trou borgne
  T.forEach(function(t,i){
    const s0=r+0.1,L=s0+t.d+0.3,o=hnAt(t.P,t.D,-s0);
    const po=occBinPush(bins,new occt.gp_Pnt_3(o[0],o[1],o[2])),dd=occBinPush(bins,new occt.gp_Dir_4(t.D[0],t.D[1],t.D[2]));
    const ax=occBinPush(bins,new occt.gp_Ax2_3(po,dd));
    const mk=new occt.BRepPrimAPI_MakeCylinder_3(ax,r,L);const sh=mk.Shape();try{mk.delete();}catch(e){}
    nomsNomme(sh,function(m,fn){for(let k=0;k<fn.length;k++)fn[k]=f.id+'/c'+i+'/s0/f'+(k+1);});
    tool.push(sh);
  });
  const shp=(tool.length===1)?tool[0]:nomsCompose(tool,occCompoundOf(tool)||tool[0]);
  const w=[];const nOff=S.all.filter(function(t){return t.off;}).length;
  if(nOff)w.push(nOff+' trou(s) enlevé(s) à la main');
  return {shape:shp,bins:bins,warnings:[],thr:null,info:w,hn:S};
}
function hnName(f){
  const S=hnRun.get(f.id),n=S?S.all.filter(function(t){return t.on;}).length:null;
  return 'Perçage normal Ø'+hnFmt(+f.d||1.5)+(f.place&&f.place.grp?' → '+'Ø'+hnFmt(2*f.place.grp.r):'')+(n!=null?' ×'+n:'');
}
/* ----- création : clic sur la face ----- */
let hnPick=null; // {fid|null}
function hnStart(){
  if(!occHas()){alert('Perçage normal : noyau exact requis (attendez la fin du chargement).');return;}
  // face déjà sélectionnée : on part tout de suite
  const F=(selFaces||[]).filter(function(x){return x&&x.mesh;});
  if(F.length){
    const refs=[];let body=null;
    F.forEach(function(x){const h=occFaceOfHit(x.mesh,x.faceIndex);if(!h)return;try{const r=occFaceRefAny(h.face);if(r)refs.push(r);if(h.bd&&(doc.bodies||[]).some(function(b){return b.id===h.bd.id;}))body=h.bd.id;}finally{occFree(h.face);}});
    if(refs.length){hnCreate(refs,body);return;}
  }
  hnPick={fid:null};
  try{renderer.domElement.style.cursor='crosshair';}catch(e){}
  try{faceEl.textContent='Perçage normal : cliquez la FACE (congé…) sous laquelle sont les trous borgnes — Échap pour annuler.';}catch(e){}
}
function hnPickCancel(){hnPick=null;try{renderer.domElement.style.cursor='default';}catch(e){}}
function hnPickAt(e){
  if(!hnPick)return false;
  const h=pick(e);if(!h){try{faceEl.textContent='Perçage normal : aucune face sous le curseur.';}catch(e2){}return true;}
  const hit=occFaceOfHit(h.object,h.faceIndex);
  if(!hit||!hit.face){try{faceEl.textContent='Perçage normal : face illisible (noyau exact requis).';}catch(e2){}return true;}
  let ref=null,body=null;
  try{ref=occFaceRefAny(hit.face);if(hit.bd&&(doc.bodies||[]).some(function(b){return b.id===hit.bd.id;}))body=hit.bd.id;}finally{occFree(hit.face);}
  if(!ref)return true;
  if(!hnPick.fid){hnPickCancel();hnCreate([ref],body);return true;}
  const f=doc.features.find(function(x){return x.id===hnPick.fid;});
  if(!f){hnPickCancel();return true;}
  // clic = ajouter la face, ou la retirer si elle y est déjà
  const same=function(a,b){return JSON.stringify(a.pos)===JSON.stringify(b.pos)&&a.st===b.st;};
  docPushUndo('perçage normal : faces');
  const L=f.place.faces||[],k=L.findIndex(function(x){return same(x,ref);});
  if(k>=0){if(L.length>1)L.splice(k,1);}else L.push(ref);
  f.place.faces=L;
  markDirty();rebuild();f.name=hnName(f);renderTree();renderProps();
  try{faceEl.textContent='Perçage normal : '+L.length+' face(s) — cliquez d’autres faces pour en ajouter ou en retirer, Échap pour finir.';}catch(e2){}
  return true;
}
function hnCreate(refs,body){
  const shape=occLive&&occLive.shape;
  const pl={k:'normal',faces:refs,grp:null,maxD:HN_MAXD,off:[]};
  // groupe proposé : celui qui a le plus de trous à percer sous la face
  let S=null;try{S=hnScan(shape,pl,1.5);}catch(e){S=null;}
  const g0=S&&S.groups.find(function(g){return g.n>0;});
  if(!g0){
    try{faceEl.textContent='Perçage normal : aucun trou borgne dont le fond est sous cette face (à moins de '+HN_MAXD+' mm, dans la matière). Essayez une autre face.';}catch(e){}
    hnPick={fid:null};try{renderer.domElement.style.cursor='crosshair';}catch(e){}
    return null;
  }
  pl.grp=g0.g;
  const snap0=docSnap(),len0=docUndoStack.length;
  const nf={id:uid('ho'),type:'hole',name:'',place:pl,kind:'simple',d:1.5,end:'blind',tip:0,op:'cut',visible:true};
  if(body)nf.body=body;
  docPushUndo('perçage normal');
  addFeature(nf);
  try{fdynStart(nf,snap0,len0);}catch(e){}
  sel={kind:'feature',id:nf.id};
  markDirty();rebuild();nf.name=hnName(nf);renderTree();renderProps();
  try{faceEl.textContent='Perçage normal : '+g0.n+' trou(s) '+hnGrpLabel(g0.g)+' trouvé(s) — décochez ceux à ne pas percer, réglez le Ø, puis OK.';}catch(e){}
  return nf;
}
/* ----- panneau ----- */
function renderHoleNormProps(p,f){
  const pl=f.place,S=hnRun.get(f.id)||{all:[],groups:[],faces:0};
  const go=function(){markDirty();rebuild();f.name=hnName(f);renderTree();renderProps();};
  const row=function(lab,el){const r=document.createElement('div');r.className='pnl-row';const L=document.createElement('label');L.textContent=lab;r.appendChild(L);if(el)r.appendChild(el);p.appendChild(r);return r;};
  const note=function(t){const n=document.createElement('div');n.className='pnl-note';n.textContent=t;p.appendChild(n);return n;};
  const h=document.createElement('div');h.className='pnl-h';h.textContent='Perçage normal à une face';p.appendChild(h);
  note('Chaque trou part perpendiculairement à la face et vise le centre du fond (cercle avant le cône) d’un trou borgne.');
  const num=function(val,fn,min){const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.style.width='80px';
    i.value=String(+(+val).toFixed(3)).replace('.',',');
    const c=function(){const v=parseFloat(String(i.value).replace(',','.'));if(isFinite(v)&&v>=min&&Math.abs(v-(+val))>1e-9){docPushUndo('perçage normal');fn(v);go();}};
    i.addEventListener('change',c);i.addEventListener('keydown',function(e){if(e.key==='Enter'){c();i.blur();}e.stopPropagation();});
    i.addEventListener('click',function(e){e.stopPropagation();});return i;};
  row('Ø du perçage',num(+f.d||1.5,function(v){f.d=v;},0.2));
  // faces
  const fb=document.createElement('button');fb.textContent=hnPick&&hnPick.fid===f.id?'✓ Terminer le choix':'Choisir les faces…';
  fb.title='Cliquez des faces dans la vue : un clic ajoute la face, un autre clic la retire';
  fb.onclick=function(){if(hnPick&&hnPick.fid===f.id){hnPickCancel();renderProps();return;}
    hnPick={fid:f.id};try{renderer.domElement.style.cursor='crosshair';}catch(e){}
    try{faceEl.textContent='Perçage normal : cliquez des faces pour en ajouter ou en retirer — Échap pour finir.';}catch(e){}renderProps();};
  row((pl.faces||[]).length+' face(s)',fb);
  if((pl.faces||[]).length&&!S.faces)note('⚠ Face introuvable : la pièce a changé, choisissez-la de nouveau.');
  // groupe de trous visés
  const s=document.createElement('select');
  const gs=S.groups.slice();
  if(pl.grp&&!gs.some(function(g){return hnGrpKey(g.g)===hnGrpKey(pl.grp);}))gs.unshift({g:pl.grp,n:0});
  gs.forEach(function(g){const o=document.createElement('option');o.value=hnGrpKey(g.g);o.textContent=hnGrpLabel(g.g,g.n);s.appendChild(o);});
  const oa=document.createElement('option');oa.value='*';oa.textContent='Tous les trous borgnes';s.appendChild(oa);
  s.value=hnGrpKey(pl.grp);
  s.onchange=function(){docPushUndo('perçage normal : trous visés');const g=gs.find(function(x){return hnGrpKey(x.g)===s.value;});pl.grp=g?g.g:null;go();};
  row('Trous visés',s);
  row('Distance maxi',num(+pl.maxD||HN_MAXD,function(v){pl.maxD=v;},0.5));
  // bilan
  const nOn=S.all.filter(function(t){return t.on;}).length,nOff=S.all.filter(function(t){return t.off;}).length;
  const nSk=S.all.filter(function(t){return !t.on&&!t.off;}).length;
  note(nOn+' trou(s) percé(s)'+(nOff?' · '+nOff+' enlevé(s)':'')+(nSk?' · '+nSk+' ignoré(s) (déjà percés au fond ou chemin hors matière)':'')+
    '. Une case sous chaque trou dans la vue : décochée = pas de perçage.');
  if(nOff){const b=document.createElement('button');b.textContent='Remettre tous les trous';b.onclick=function(){docPushUndo('perçage normal : trous remis');pl.off=[];go();};row('',b);}
}
/* ----- cases à cocher dans la vue ----- */
let hn3={el:null,items:new Map(),fid:null};
function hn3Ctx(){
  if((typeof skEdit!=='undefined'&&skEdit)||typeof sel==='undefined'||!sel||sel.kind!=='feature')return null;
  const f=(doc.features||[]).find(function(x){return x&&x.id===sel.id;});
  return hnIs(f)&&f.visible!==false?f:null;
}
function hn3Toggle(f,C,on){
  docPushUndo(on?'perçage normal : trou remis':'perçage normal : trou enlevé');
  const off=(f.place.off||[]).filter(function(o){return hnLen(hnV(o,C))>=0.5;});
  if(!on)off.push(C.map(function(x){return +x.toFixed(4);}));
  f.place.off=off;
  markDirty();rebuild();f.name=hnName(f);renderTree();renderProps();
}
function hn3Tick(){
  const f=hn3Ctx(),S=f&&hnRun.get(f.id);
  if(!S||typeof camera==='undefined'||!camera||typeof renderer==='undefined'){if(hn3.el)hn3.el.style.display='none';return;}
  if(!hn3.el){const d=document.createElement('div');d.className='hnCase3d';d.style.cssText='position:fixed;left:0;top:0;width:0;height:0;z-index:35;display:none';document.body.appendChild(d);hn3.el=d;}
  if(hn3.fid!==f.id){hn3.el.innerHTML='';hn3.items.clear();hn3.fid=f.id;}
  hn3.el.style.display='';
  const r=renderer.domElement.getBoundingClientRect(),v=new THREE.Vector3(),seen=new Set();
  S.all.forEach(function(t){
    const k=t.C.map(function(x){return x.toFixed(2);}).join(',');seen.add(k);
    let it=hn3.items.get(k);
    if(!it){
      const w=document.createElement('label');
      w.style.cssText='position:fixed;transform:translate(-50%,-50%);display:flex;align-items:center;padding:1px 3px;border-radius:6px;cursor:pointer;background:var(--panel, #1e1e22);border:1px solid var(--line, #3a3a40);box-shadow:0 1px 6px rgba(0,0,0,.35)';
      const i=document.createElement('input');i.type='checkbox';i.style.margin='0';w.appendChild(i);
      i.onchange=function(){const g=hn3Ctx();if(g)hn3Toggle(g,t.C,i.checked);};
      ['pointerdown','mousedown','click','dblclick','wheel'].forEach(function(ty){w.addEventListener(ty,function(e){e.stopPropagation();});});
      hn3.el.appendChild(w);it={w:w,i:i};hn3.items.set(k,it);
    }
    it.t=t;
    v.set(t.P[0],t.P[1],t.P[2]).project(camera);
    const X=r.left+(v.x+1)/2*r.width,Y=r.top+(1-v.y)/2*r.height;
    if(v.z>1||v.z<-1||X<r.left||X>r.right||Y<r.top||Y>r.bottom){it.w.style.display='none';return;}
    it.w.style.display='flex';it.w.style.left=Math.round(X)+'px';it.w.style.top=Math.round(Y)+'px';
    const can=!t.why;it.i.disabled=!can;
    if(it.i.checked!==t.on)it.i.checked=t.on;
    it.w.title=can?(t.on?'Percé — décochez pour ne pas percer ce trou':'Enlevé — cochez pour le percer'):('Ignoré : '+t.why);
    it.w.style.borderColor=t.off?'#ff5a4e':(can?'':'#888');it.w.style.opacity=can?'1':'.5';
  });
  hn3.items.forEach(function(it,k){if(!seen.has(k)){it.w.remove();hn3.items.delete(k);}});
}
