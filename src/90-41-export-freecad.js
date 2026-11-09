/* ---------- export FreeCAD natif (.FCStd) (V0.72.0) ----------
   Un .FCStd est un zip : Document.xml (objets, propriétés), GuiDocument.xml (couleurs,
   visibilité) et un fichier BRep par forme — le format natif du noyau OCCT, que FreeCAD
   partage avec nous : la géométrie arrive EXACTE, sans conversion.
     · pièce seule : un objet Part::Feature par corps visible, à sa couleur ;
     · assemblage (composant actif qui contient des occurrences) : un groupe par occurrence,
       ses corps placés dedans ;
     · aimants : le groupe de l'aimant porte ses caractéristiques (onglet « Aimant » des
       propriétés de FreeCAD) et un groupe « Lignes de champ » reprend les lignes du champ
       additionné de tous les aimants (48-aimants-champ), rangées par intensité : un objet
       par tranche, à la couleur de l'écran, que l'on peut masquer à part.
   Format vérifié par ouverture dans FreeCAD 1.1 (tests/test_export_freecad.cjs). */
const FC_GRIS=0xb4b4b8;
// tranches d'intensité des lignes de champ (tesla) : bornes basses
const FC_BANDES=[[0,'moins de 5 mT'],[0.005,'5 à 20 mT'],[0.02,'20 à 50 mT'],[0.05,'50 à 100 mT'],[0.1,'100 à 300 mT'],[0.3,'plus de 300 mT']];
// caractéristiques de l'aimant, dans l'ordre de magCtxRows (48-aimants-interface)
const FC_MAG_PROPS=['Article','Matiere','Remanence_Br','Coercivite_HcB','Coercivite_HcJ','Energie_BHmax','Force_adherence','Temperature_maxi','Aimantation','Champ_face_nord'];
function fcX(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');}
function fcPacked(hex,alpha){return ((((hex>>>16)&255)<<24)|(((hex>>>8)&255)<<16)|((hex&255)<<8)|(alpha==null?255:alpha))>>>0;}
function fcAppearance(hex){
  // fichier ShapeAppearance (App::PropertyMaterialList, version 3) : 1 matériau, couleurs RGBA
  const b=new ArrayBuffer(40),v=new DataView(b);
  v.setUint32(0,1,true);
  v.setUint32(4,0x555555ff,true);       // ambiante
  v.setUint32(8,fcPacked(hex),true);    // diffuse = couleur du corps
  v.setUint32(12,0x888888ff,true);      // spéculaire
  v.setUint32(16,0x000000ff,true);      // émissive
  v.setFloat32(20,0.9,true);            // brillance
  v.setFloat32(24,0,true);              // transparence ; puis 3 chaînes vides (image, chemin, uuid)
  return new Uint8Array(b);
}
/* ── zip (méthode « deflate » quand le navigateur sait compresser, sinon stockage simple) ── */
let fcCrcT=null;
function fcCrc32(u8){
  if(!fcCrcT){fcCrcT=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;fcCrcT[n]=c>>>0;}}
  let c=0xffffffff;for(let i=0;i<u8.length;i++)c=fcCrcT[(c^u8[i])&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
async function fcDeflate(u8){
  try{
    if(typeof CompressionStream==='undefined'||typeof Response==='undefined')return null;
    const s=new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }catch(e){return null;}
}
async function fcZip(files){
  // files : [{name, data: Uint8Array}] → octets du zip
  const enc=new TextEncoder(),parts=[],cen=[];let off=0;
  const d=new Date(),dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xffff,dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xffff;
  for(const f of files){
    const nm=enc.encode(f.name),crc=fcCrc32(f.data);
    let z=await fcDeflate(f.data),meth=8;
    if(!z||z.length>=f.data.length){z=f.data;meth=0;}
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,meth,true);
    h.setUint16(10,dt,true);h.setUint16(12,dd,true);h.setUint32(14,crc,true);h.setUint32(18,z.length,true);h.setUint32(22,f.data.length,true);
    h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,z);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,meth,true);
    c.setUint16(12,dt,true);c.setUint16(14,dd,true);c.setUint32(16,crc,true);c.setUint32(20,z.length,true);c.setUint32(24,f.data.length,true);
    c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    cen.push(new Uint8Array(c.buffer),nm);
    off+=30+nm.length+z.length;
  }
  const cs=cen.reduce((a,u)=>a+u.length,0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
  const all=parts.concat(cen,[new Uint8Array(e.buffer)]),n=all.reduce((a,u)=>a+u.length,0),out=new Uint8Array(n);
  let p=0;all.forEach(u=>{out.set(u,p);p+=u.length;});
  return out;
}
/* ── lignes de champ : polylignes rangées par tranche d'intensité ── */
function fcFieldBands(M){
  // M : [{m, F}] dans le repère exporté → [{label, color, polys:[[[x,y,z],…],…]}] (tranches non vides)
  const A=M.map(x=>({m:x.m,F:x.F,on:true}));
  const brMax=Math.max(...A.map(x=>x.m.Br),2e-3),lo=Math.log(1e-3),hi=Math.log(brMax);
  const mag=p=>{const B=magFieldMulti(A,p);return Math.hypot(B[0],B[1],B[2]);};
  const band=t=>{let k=0;for(let i=0;i<FC_BANDES.length;i++)if(t>=FC_BANDES[i][0])k=i;return k;};
  const out=FC_BANDES.map(([t0,lab],i)=>{
    const t1=i+1<FC_BANDES.length?FC_BANDES[i+1][0]:brMax,tm=t0>0?Math.sqrt(t0*Math.max(t1,t0)):Math.min(t1,0.005)/2;
    return {label:'Champ '+lab,color:fcMagHex(Math.max(0,Math.min(1,(Math.log(Math.max(tm,1e-3))-lo)/(hi-lo)))),polys:[]};
  });
  magLinesMulti(A).forEach(L=>{
    const Q=L.pts;if(Q.length<2)return;
    const st=Math.max(1,Math.round(Q.length/120)),P=[];
    for(let i=0;i<Q.length;i+=st)P.push(Q[i]);
    if(P[P.length-1]!==Q[Q.length-1])P.push(Q[Q.length-1]);
    let cur=null,kb=-1;
    for(let i=1;i<P.length;i++){
      const a=P[i-1],b=P[i],k=band(mag([(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]));
      if(k!==kb){cur=[a];out[k].polys.push(cur);kb=k;}
      cur.push(b);
    }
    // flèche au milieu (sens nord → sud), comme à l'écran
    if(Q.length<4)return;
    const w=magSize(M[L.from].m)*0.05,i=Math.floor(Q.length/2),a=Q[i],b=Q[Math.min(i+1,Q.length-1)];
    let d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];const l=Math.hypot(d[0],d[1],d[2]);if(!(l>0))return;d=d.map(v=>v/l);
    let u=[-d[2],0,d[0]];if(Math.hypot(u[0],u[1],u[2])<1e-3)u=[1,0,0];
    const lu=Math.hypot(u[0],u[1],u[2]);u=u.map(v=>v/lu);
    const k=band(mag(a));
    out[k].polys.push([[0,1,2].map(j=>a[j]-w*d[j]+w*.5*u[j]),a,[0,1,2].map(j=>a[j]-w*d[j]-w*.5*u[j])]);
  });
  return out.filter(b=>b.polys.length);
}
function fcPolyShape(polys){
  // polylignes → composé de fils (TopoDS_Compound, à libérer par l'appelant), ou null
  const comp=new occt.TopoDS_Compound(),bd=new occt.TopoDS_Builder();let n=0;
  try{
    bd.MakeCompound(comp);
    polys.forEach(P=>{
      const pg=new occt.BRepBuilderAPI_MakePolygon_1(),pts=[];
      try{
        P.forEach(p=>{const q=new occt.gp_Pnt_3(p[0],p[1],p[2]);pts.push(q);pg.Add_1(q);});
        if(!pg.IsDone())return;
        const w=pg.Wire();
        try{bd.Add(comp,w);n++;}finally{try{w.delete();}catch(e){}}
      }catch(e){}
      finally{pts.forEach(q=>{try{q.delete();}catch(e){}});try{pg.delete();}catch(e){}}
    });
  }finally{try{bd.delete();}catch(e){}}
  if(!n){try{comp.delete();}catch(e){}return null;}
  return comp;
}
/* ── collecte : ce qui est visible, placé, avec couleurs et aimants ── */
function fcHex(v){
  // couleur sous toutes ses formes (nombre, THREE.Color, '#rrggbb') → nombre, ou null
  if(typeof v==='number'&&isFinite(v))return v>>>0&0xffffff;
  if(v&&typeof v.getHex==='function'){const h=v.getHex();return typeof h==='number'?h:null;}
  if(typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v))return parseInt(v.slice(1),16);
  return null;
}
function fcMagHex(t){
  // même teinte que magColor (48-aimants-champ) : TSL (270 − 255 t)°, 85 %, 58 %, calculée sans THREE
  const h=(270-255*t)/360,s=0.85,l=0.58,q=l+s-l*s,p=2*l-q;
  const f=x=>{x=(x%1+1)%1;return x<1/6?p+(q-p)*6*x:x<1/2?q:x<2/3?p+(q-p)*(2/3-x)*6:p;};
  return [h+1/3,h,h-1/3].reduce((a,x)=>(a<<8)|Math.round(f(x)*255),0)>>>0;
}
function fcBodyColor(c,bid,active){
  const it=c&&c._snap&&(c._snap.items||[]).find(i=>i.bid===bid);
  let v=it?fcHex(it.color):null;
  const b=c&&c.doc&&(c.doc.bodies||[]).find(x=>x.id===bid);
  if(v==null&&b)v=fcHex(b.color);
  if(v==null&&active){try{v=fcHex(bodyColorOf(bid));}catch(e){}}
  return v==null?FC_GRIS:v;
}
function fcCollect(){
  // → {name, groups:[{label, mag?, F?, bodies:[{label, shape, color}]}], mags:[{m,F}]} ; groups[0].label null = racine
  const out={name:doc.name||'piece',groups:[],mags:[]};
  const base=(typeof asmActiveComp==='function')?asmActiveComp():null;
  if(base&&base.occ&&base.occ.length){
    asmEnsure();
    const inst=asmVisibleInstances(base),ex=asmExactCollect([...new Set(inst.map(i=>i.comp))]);
    const name=path=>{const n=[];let c=base;path.forEach(id=>{const o=c&&c.occ.find(q=>q.id===id);n.push(o?o.name:id);c=o?asmComp(o.comp):null;});return n.join(' › ');};
    out.name=base.name||out.name;
    inst.forEach(I=>{
      const c=asmComp(I.comp),m=magOfComp(c),G={label:I.path.length?name(I.path):null,mag:m,F:I.F,bodies:[]};
      (ex.get(I.comp)||[]).forEach(b=>G.bodies.push({label:b.name,shape:asmPlaced(b.shape,I.F),color:fcBodyColor(c,b.id,c.id===asm.active)}));
      if(m)out.mags.push({m,F:I.F});
      if(G.bodies.length||m)out.groups.push(G);
    });
    return out;
  }
  const c=base||null,G={label:null,bodies:[]};
  asmExactActive(true).forEach(b=>G.bodies.push({label:b.name,shape:b.shape,color:fcBodyColor(c,b.id,true)}));
  const m=doc.std&&doc.std.mag&&doc.std.mag.s?doc.std.mag:null; // pièce ouverte qui est un aimant
  if(m){G.mag=m;G.F={o:[0,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};out.mags.push({m,F:G.F});}
  out.groups.push(G);
  return out;
}
/* ── écriture des deux fichiers XML ── */
function fcDocXml(O){
  const I='    ',prop=(n,t,inner,extra)=>I+I+I+I+'<Property name="'+n+'" type="'+t+'"'+(extra||'')+'>\n'+I+I+I+I+I+inner+'\n'+I+I+I+I+'</Property>';
  const str=v=>'<String value="'+fcX(v)+'"/>';
  const L=["<?xml version='1.0' encoding='utf-8'?>",'<!--',' FreeCAD Document, see https://www.freecad.org for more information...',' Écrit par ConceptCAD.','-->',
    '<Document SchemaVersion="4" ProgramVersion="1.0R0 (ConceptCAD '+fcX(typeof APP_VER!=='undefined'?APP_VER:'')+')" FileVersion="1">',
    I+'<Properties Count="2" TransientCount="0">',
    I+I+'<Property name="CreatedBy" type="App::PropertyString">\n'+I+I+I+str('ConceptCAD')+'\n'+I+I+'</Property>',
    I+I+'<Property name="Label" type="App::PropertyString">\n'+I+I+I+str(O.docLabel)+'\n'+I+I+'</Property>',
    I+'</Properties>',
    I+'<Objects Count="'+O.list.length+'" Dependencies="1">'];
  O.list.forEach(o=>{
    if(o.kids&&o.kids.length){L.push(I+I+'<ObjectDeps Name="'+o.name+'" Count="'+o.kids.length+'">');o.kids.forEach(k=>L.push(I+I+I+'<Dep Name="'+k+'"/>'));L.push(I+I+'</ObjectDeps>');}
    else L.push(I+I+'<ObjectDeps Name="'+o.name+'" Count="0"/>');
  });
  O.list.forEach((o,i)=>L.push(I+I+'<Object type="'+o.type+'" name="'+o.name+'" id="'+(i+1)+'" />'));
  L.push(I+'</Objects>',I+'<ObjectData Count="'+O.list.length+'">');
  O.list.forEach(o=>{
    const P=[];
    (o.props||[]).forEach(p=>P.push(prop(p.name,'App::PropertyString',str(p.value),' group="'+fcX(p.group)+'" doc="'+fcX(p.doc)+'" attr="0" ro="0" hide="0"')));
    if(o.type==='App::DocumentObjectGroup')
      P.push(prop('Group','App::PropertyLinkList','<LinkList count="'+o.kids.length+'">'+o.kids.map(k=>'<Link value="'+k+'"/>').join('')+'</LinkList>'));
    P.push(prop('Label','App::PropertyString',str(o.label)));
    if(o.file){
      P.push(prop('Placement','App::PropertyPlacement','<PropertyPlacement Px="0" Py="0" Pz="0" Q0="0" Q1="0" Q2="0" Q3="1" A="0" Ox="0" Oy="0" Oz="1"/>'));
      P.push(prop('Shape','Part::PropertyPartShape','<Part file="'+o.file+'"/>'));
    }
    P.push(prop('Visibility','App::PropertyBool','<Bool value="true"/>'));
    L.push(I+I+'<Object name="'+o.name+'"'+(o.type==='App::DocumentObjectGroup'?' Extensions="True"':'')+'>');
    if(o.type==='App::DocumentObjectGroup')L.push(I+I+I+'<Extensions Count="1">\n'+I+I+I+I+'<Extension type="App::GroupExtension" name="GroupExtension">\n'+I+I+I+I+'</Extension>\n'+I+I+I+'</Extensions>');
    L.push(I+I+I+'<Properties Count="'+P.length+'" TransientCount="0">',...P,I+I+I+'</Properties>',I+I+'</Object>');
  });
  L.push(I+'</ObjectData>','</Document>','');
  return L.join('\n');
}
function fcGuiXml(O){
  const I='    ',prop=(n,t,inner)=>I+I+I+I+'<Property name="'+n+'" type="'+t+'">\n'+I+I+I+I+I+inner+'\n'+I+I+I+I+'</Property>';
  const L=["<?xml version='1.0' encoding='utf-8'?>",'<Document SchemaVersion="1">',I+'<ViewProviderData Count="'+O.list.length+'">'];
  O.list.forEach(o=>{
    const P=[];
    if(o.file){
      if(o.line!=null){
        P.push(prop('LineColor','App::PropertyColor','<PropertyColor value="'+fcPacked(o.line,0)+'"/>')); // octet bas 0 : opaque partout (FreeCAD 1.x le lit comme une transparence nulle)
        P.push(prop('LineWidth','App::PropertyFloatConstraint','<Float value="'+(o.width||2)+'"/>'));
        // sommets des polylignes de la couleur du trait : sinon la ligne paraît en pointillé
        P.push(prop('PointColor','App::PropertyColor','<PropertyColor value="'+fcPacked(o.line,0)+'"/>'));
        P.push(prop('PointSize','App::PropertyFloatConstraint','<Float value="'+(o.width||2)+'"/>'));
      }
      if(o.appear){
        P.push(prop('ShapeAppearance','App::PropertyMaterialList','<MaterialList file="'+o.appear+'" version="3"/>'));
        P.push(prop('ShapeColor','App::PropertyColor','<PropertyColor value="'+fcPacked(o.color,0)+'"/>')); // FreeCAD 0.21 et avant
      }
    }
    P.push(prop('Visibility','App::PropertyBool','<Bool value="true"/>'));
    L.push(I+I+'<ViewProvider name="'+o.name+'" expanded="'+(o.kids&&o.kids.length?1:0)+'">',I+I+I+'<Properties Count="'+P.length+'" TransientCount="0">',...P,I+I+I+'</Properties>',I+I+'</ViewProvider>');
  });
  L.push(I+'</ViewProviderData>',I+'<Camera settings=""/>','</Document>',''); // Camera : FreeCAD l'attend après les objets
  return L.join('\n');
}
function fcBrepClean(b){
  // le noyau fait précéder le BRep d'une ligne « DBRep_DrawableShape » (format de son outil de
  // test) : on la retire, le fichier commence alors comme ceux de FreeCAD (« CASCADE Topology »)
  const k='CASCADE Topology',n=Math.min(b.length,200);
  for(let i=0;i<n;i++)if(b[i]===67&&String.fromCharCode.apply(null,b.subarray(i,i+k.length))===k)return i?b.subarray(i):b;
  return b;
}
/* ── l'export ── */
async function fcBuild(){
  // → {bytes, name, n (objets), lines (polylignes de champ), mags}
  const S=fcCollect(),files=[],gfiles=[],list=[],free=[];
  // ORDRE du zip imposé : FreeCAD lit les entrées dans l'ordre où il les demande (Document.xml, formes
  // dans l'ordre des objets, GuiDocument.xml, puis les apparences) ; une entrée en avance fait sauter
  // les suivantes (formes vides à l'ouverture dans la fenêtre de FreeCAD, essai du 09/11)
  const enc=new TextEncoder();
  let seq=0;
  const add=(o)=>{o.name=o.name||('Obj'+(++seq));list.push(o);return o;};
  try{
    const shapeObj=(label,shape,color,line,width)=>{
      const o={type:'Part::Feature',label,name:'Forme'+(++seq)};
      o.file=o.name+'.brp';files.push({name:o.file,data:fcBrepClean(occBrepWrite(shape))});
      if(line!=null){o.line=line;o.width=width;}
      else{o.color=color;o.appear='Apparence'+seq;gfiles.push({name:o.appear,data:fcAppearance(color)});}
      return add(o);
    };
    S.groups.forEach(G=>{
      G.bodies.forEach(b=>free.push(b.shape));
      const kids=G.bodies.map(b=>shapeObj(b.label,b.shape,b.color).name);
      if(G.label==null&&!G.mag)return; // racine : corps au premier niveau
      const g={type:'App::DocumentObjectGroup',label:G.label||(G.mag?'Aimant '+(G.mag.code||''):'Pièce'),name:'Groupe'+(++seq),kids,props:[]};
      if(G.mag){
        magCtxRows(G.mag).forEach(([lab,val],i)=>g.props.push({name:FC_MAG_PROPS[i]||('Info'+i),value:val,group:'Aimant',doc:lab}));
        const z=(G.mag.dia?G.F.y:G.F.z).map(v=>+v.toFixed(6)); // diamétral : aimanté selon +Y de l'aimant (48-aimants-champ)
        g.props.push({name:'Sens_aimantation',value:'('+z.join(', ')+') — du pôle sud vers le pôle nord',group:'Aimant',doc:'Direction de l’aimantation dans le repère du fichier'});
      }
      add(g);
    });
    let nl=0;
    if(S.mags.length){
      const kids=[];
      fcFieldBands(S.mags).forEach(B=>{
        const sh=fcPolyShape(B.polys);if(!sh)return;
        free.push(sh);nl+=B.polys.length;
        kids.push(shapeObj(B.label,sh,null,B.color,2).name);
      });
      if(kids.length)add({type:'App::DocumentObjectGroup',label:'Lignes de champ',name:'Groupe'+(++seq),kids,props:[
        {name:'Note',value:'Champ additionné de '+S.mags.length+' aimant(s), calculé par ConceptCAD : aimants seuls dans l’air, à Br moyen ; l’acier voisin et la température n’y entrent pas. Sens des flèches : du nord vers le sud à l’extérieur des aimants.',group:'Champ',doc:'Comment ces lignes ont été calculées'}]});
    }
    if(!list.some(o=>o.file))throw new Error('rien de visible à exporter');
    const O={list,docLabel:S.name};
    files.unshift({name:'Document.xml',data:enc.encode(fcDocXml(O))});
    files.push({name:'GuiDocument.xml',data:enc.encode(fcGuiXml(O))},...gfiles);
    const bytes=await fcZip(files);
    return {bytes,name:S.name,n:list.filter(o=>o.file).length,lines:nl,mags:S.mags.length};
  }finally{
    free.forEach(s=>{try{s.delete();}catch(e){}});
  }
}
async function fcExport(){
  if(!occHas()){alert('L’export FreeCAD a besoin du noyau OCCT (chargement en cours ou échec). Réessayez dans quelques secondes.');return;}
  faceEl.textContent='Export FreeCAD : préparation…';
  try{
    const R=await fcBuild();
    const blob=new Blob([R.bytes],{type:'application/zip'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(R.name||'piece')+'.FCStd';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    faceEl.textContent='FreeCAD exporté : '+R.n+' objet(s)'+(R.mags?', '+R.mags+' aimant(s) et '+R.lines+' lignes de champ':'')+' ('+(R.bytes.length/1024).toFixed(1)+' Ko).';
  }catch(e){faceEl.textContent='Export FreeCAD : '+(e.message||e);alert('Export FreeCAD impossible : '+(e.message||e));}
}
$('btnExportFcstd').onclick=()=>fcExport();
