/* ---------- FAO : opération CHANFREIN (V0.7.9) ----------
   « L'opération Poche n'a pas l'air utile car l'Ébauche 3D fait aussi bien le travail. Il faudrait la
   transformer en opération à chanfreiner. » La Poche reste lisible et calculée (anciens fichiers),
   mais le ruban propose Chanfrein à sa place.
   Arêtes : une CHAÎNE d'arêtes du haut de la paroi (même saisie que le Contour). Outil : fraise à
   chanfreiner (angle, Ø de pointe) ou foret à pointer (pointe vive). Réglages : largeur du chanfrein
   (sur le dessus), décalage de pointe (la pointe descend sous le chanfrein pour couper avec le flanc).
   Géométrie, outil de demi-angle θ, pointe plate de rayon rt, largeur a, décalage t :
     jambe sur la paroi   b = a / tan θ
     pointe à             z = Z arête − b − t
     axe décalé de        d = rt + t·tan θ   (vers le vide, depuis l'arête)
     contact haut à       ρ = d + a ≤ Ø/2 de l'outil (sinon ⚠ : outil trop petit)
   Le parcours est un contour à la distance d, à la cote de pointe, une passe, avec entrées et sorties
   tangentes (faoGenContourProfil) — côté de l'outil déduit de la matière (bossage ou alésage).
   V0.26.4 : option « Parcours 3D » (op.c3d) pour les arêtes NON PLANES (dessus en pente, bord de
   forme gauche) : la pointe suit le Z de l'arête, l'axe de l'outil reste en Z. La boucle garde le Z de chaque point (L.loop3) ; le contour XY est le même qu'en
   plan (axe à d de l'arête), puis chaque point reçoit la cote de pointe Z arête(x,y) − b − t, Z
   lu sur l'arête au pied de la normale (rééchantillonnage à 0,5 mm, simplification 3D 2 µm). */
const FAO_CHAMFER_3D_TOL=0.005; // mm — écart de Z au-delà duquel les arêtes ne sont plus planes
function faoChamferSetLoop3(L,res){
  // pose (ou retire) L.loop3 d'après la boucle reconstruite ; true si le Z a changé
  const L3=res&&res.loop3;
  let zl=1/0,zh=-1/0;
  (L3||[]).forEach(function(q){if(q[2]<zl)zl=q[2];if(q[2]>zh)zh=q[2];});
  const was=JSON.stringify(L.loop3||null);
  if(L3&&L3.length===(res.loop||[]).length&&zh-zl>FAO_CHAMFER_3D_TOL)L.loop3=L3;
  else delete L.loop3;
  return was!==JSON.stringify(L.loop3||null);
}
function faoChamferLoop3(L){
  // boucle 3D exploitable (même nombre de points et même XY que la boucle plane) ou null
  const L3=L&&L.loop3,lp=L&&L.loop;
  if(!Array.isArray(L3)||!Array.isArray(lp)||L3.length!==lp.length||L3.length<3)return null;
  for(let i=0;i<lp.length;i+=Math.max(1,Math.floor(lp.length/8)))
    if(!L3[i]||Math.abs(L3[i][0]-lp[i][0])>1e-6||Math.abs(L3[i][1]-lp[i][1])>1e-6)return null;
  let zl=1/0,zh=-1/0;
  for(let i=0;i<L3.length;i++){const z=+L3[i][2];if(!isFinite(z))return null;if(z<zl)zl=z;if(z>zh)zh=z;}
  return zh-zl>FAO_CHAMFER_3D_TOL?{pts:L3,zMin:zl,zMax:zh}:null;
}
function faoChamferZAt(P3,x,y){
  // Z de l'arête au projeté XY de (x,y) sur la boucle 3D (interpolé sur le segment)
  let bd=1/0,bz=P3[0][2];
  for(let i=0;i+1<P3.length;i++){
    const A=P3[i],B=P3[i+1],dx=B[0]-A[0],dy=B[1]-A[1],l2=dx*dx+dy*dy;
    let t=l2>0?((x-A[0])*dx+(y-A[1])*dy)/l2:0;if(t<0)t=0;else if(t>1)t=1;
    const qx=A[0]+dx*t-x,qy=A[1]+dy*t-y,d=qx*qx+qy*qy;
    if(d<bd-1e-12){bd=d;bz=A[2]+(B[2]-A[2])*t;}
  }
  return bz;
}
function faoChamferDrape(mv,P3,drop,step){
  // Pose chaque avance (r:0) à Z arête − drop : segments rééchantillonnés à step,
  // puis points alignés en 3D retirés (écart 2 µm). Rapides inchangés.
  const out=[],rnd=function(v){return Math.round(v*10000)/10000;};
  let prev=null,run=[];
  const flush=function(){
    if(run.length>2){
      const keep=new Array(run.length).fill(false);keep[0]=keep[run.length-1]=true;
      const st=[[0,run.length-1]];
      while(st.length){
        const sg=st.pop(),a=sg[0],b=sg[1];if(b-a<2)continue;
        const A=run[a],B=run[b],dx=B.x-A.x,dy=B.y-A.y,dz=B.z-A.z,l2=dx*dx+dy*dy+dz*dz;
        let md=-1,mi=-1;
        for(let q=a+1;q<b;q++){
          const P=run[q];let t=l2>1e-18?((P.x-A.x)*dx+(P.y-A.y)*dy+(P.z-A.z)*dz)/l2:0;if(t<0)t=0;else if(t>1)t=1;
          const dd=Math.hypot(P.x-A.x-dx*t,P.y-A.y-dy*t,P.z-A.z-dz*t);if(dd>md){md=dd;mi=q;}
        }
        if(md>0.002){keep[mi]=true;st.push([a,mi],[mi,b]);}
      }
      run.forEach(function(m,i){if(keep[i])out.push(m);});
    }else run.forEach(function(m){out.push(m);});
    run=[];
  };
  for(let i=0;i<mv.length;i++){
    const m=mv[i];
    if(!m||m.r||!isFinite(+m.x)){flush();out.push(m);prev=m;continue;}
    const zOf=function(x,y){return rnd(faoChamferZAt(P3,x,y)-drop);};
    const ent=m.ent||0;
    if(run.length&&(run[run.length-1].ent||0)!==ent){const last=run[run.length-1];flush();run.push(last);out.pop();}
    if(prev&&!prev.r&&isFinite(+prev.x)){
      const L=Math.hypot(m.x-prev.x,m.y-prev.y),n=Math.ceil(L/step);
      for(let k=1;k<n;k++){const u=k/n,x=rnd(prev.x+(m.x-prev.x)*u),y=rnd(prev.y+(m.y-prev.y)*u);
        run.push({r:0,ent:ent,x:x,y:y,z:zOf(x,y)});}
    }
    const q=Object.assign({},m,{z:zOf(m.x,m.y)});
    run.push(q);prev=m;
  }
  flush();
  return out;
}
function faoChamferToolOk(t){ return !!(t&&(t.kind==='chamfer'||t.kind==='spot')); }
function faoChamferTool(t){
  // {rt, th (rad, demi-angle), R} d'un outil à chanfreiner ; null = outil sans cône
  if(!faoChamferToolOk(t))return null;
  const ang=faoToolAngle(t),R=((+t.d>0)?+t.d:6)/2;
  const rt=t.kind==='chamfer'?Math.max(0,Math.min(R*0.9,isFinite(+t.dt)&&+t.dt>=0?+t.dt/2:0.25)):0;
  return {rt:rt,th:ang*Math.PI/360,R:R,ang:ang};
}
function faoChamferGeom(op,t){
  // -> {a, b, t, d, zTip, rho, R, ok, warn} ; null sans outil conique ou sans arête
  const T=faoChamferTool(t);if(!T)return null;
  const zTop=+op.z;if(!isFinite(zTop))return null;
  const a=Math.max(0.01,isFinite(+op.w)?+op.w:0.5);
  const off=Math.max(0,isFinite(+op.tipOff)?+op.tipOff:0.3);
  const tn=Math.tan(T.th);
  const b=a/tn,d=T.rt+off*tn,rho=d+a;
  const g={a:a,b:b,t:off,d:d,zTip:zTop-b-off,rho:rho,R:T.R,ang:T.ang,rt:T.rt,ok:rho<=T.R+1e-9,warn:''};
  if(!g.ok)g.warn='outil trop petit : le contact haut du chanfrein est à Ø'+(2*rho).toFixed(2)+', l’outil fait Ø'+(2*T.R).toFixed(2);
  return g;
}
function faoGenChamfer(mesh,op,job,secu){
  const L=op&&op.limit;
  if(!L||!(L.loop||[]).length||L.loop.length<3)return [];
  const t=faoToolById(job,op.toolId),G=faoChamferGeom(op,t);
  if(!G)return [];
  const Z3=op.c3d?faoChamferLoop3(L):null,drop=G.b+G.t;
  // 3D : contour XY tracé à la cote la plus haute, matière cherchée sous l'arête la plus basse
  const zTop=Z3?Z3.zMax:+op.z;
  let mv=faoGenContourProfil(mesh,L.loop,{
    toolD:2*Math.max(0.05,G.d),ztop:zTop,zbot:zTop-drop,ap:1e6,nR:1,fin:0,ae:1,
    zSide:Z3?Z3.zMin-Math.max(0.05,Math.min(G.b/2,1)):undefined,
    side:op.cside==='ext'||op.cside==='int'?op.cside:null,sens:op.sens==='opp'?'opp':'climb',
    leadR:isFinite(+op.leadR)&&+op.leadR>0?+op.leadR:Math.max(1,Math.min(4,G.rho)),
    overlap:isFinite(+op.overlap)&&+op.overlap>=0?+op.overlap:1,tabN:0,secu:secu});
  const diag=mv&&mv.diag;
  if(Z3&&mv&&mv.length){mv=faoChamferDrape(mv,Z3.pts,drop,0.5);try{mv.diag=diag;}catch(e){}}
  try{ if(diag){ diag.chamfer={zTip:+(zTop-drop).toFixed(3),d:+G.d.toFixed(3),b:+G.b.toFixed(3),rho:+G.rho.toFixed(3)};
    if(Z3)diag.chamfer.z3=[+Z3.zMin.toFixed(3),+Z3.zMax.toFixed(3)];
    op.geoDiag=diag; } }catch(e){}
  return mv;
}
function faoChamferToolMake(setup,op){
  // crée (ou reprend) une fraise à chanfreiner Ø6 90° et l'affecte à l'opération
  const tools=setup.tools||(setup.tools=[]);
  let t=tools.find(function(x){return x&&x.kind==='chamfer';});
  if(!t){
    const n=tools.reduce(function(m,x){return Math.max(m,+x.num||0);},0)+1;
    t={id:'T'+n+'_'+Date.now().toString(36),num:n,name:'Fraise à chanfreiner D6 90°',kind:'chamfer',d:6,ang:90,dt:0.5,cornerR:0,flutes:2,vc:150,fz:0.03};
    tools.push(t);
  }
  op.toolId=t.id;
  return t;
}
function faoChamferRows(d,setup,op){
  const t=faoToolById(setup,op.toolId);
  d.appendChild(faoH('Arêtes à chanfreiner'));
  const L=(op.limit&&op.limit.mode==='chain')?op.limit:null;
  const has=!!(L&&(L.loop||[]).length>=3);
  const Z3a=has?faoChamferLoop3(L):null,Z3=op.c3d?Z3a:null;
  const gd=op.geoDiag||{};
  const rc=faoRow();
  const info=document.createElement('span');info.className='fao-meta';
  info.textContent=has
    ?(L.nEdges||'?')+' arête(s), boucle '+(L.closed?'fermée':'refermée')+
      (Z3?' en 3D, Z '+faoDsp(op,Z3.zMin,2)+' → '+faoDsp(op,Z3.zMax,2):(isFinite(+op.z)?' à Z '+faoDsp(op,+op.z,2):''))+
      (gd.side?' · outil '+(gd.side==='ext'?'à l’EXTÉRIEUR (arête de bossage)':'à l’INTÉRIEUR (arête de poche / de trou)'):'')
    :'aucune arête — cliquez les arêtes du HAUT à chanfreiner';
  rc.appendChild(info);
  rc.appendChild(faoMini(has?'Re-sélectionner':'Sélectionner les arêtes',function(){ faoChainStart(setup.id,op.id); },
    'Cliquez les arêtes du haut de la paroi à chanfreiner (contour d’un bossage, bord d’une poche ou d’un trou). La cote de l’arête est prise sur la sélection.'));
  d.appendChild(rc);
  d.appendChild(faoH('Chanfrein'));
  const r1=faoRow();
  r1.appendChild(faoLab('Largeur'));
  r1.appendChild(faoNumFx(op,'w',isFinite(+op.w)?+op.w:0.5,function(v){op.w=Math.max(0.01,v);},48,0.1,'Largeur du chanfrein sur la face du dessus (mm). La hauteur sur la paroi suit l’angle de l’outil (90° : égale à la largeur).'));
  r1.appendChild(faoLab('Décalage de pointe'));
  r1.appendChild(faoNumFx(op,'tipOff',isFinite(+op.tipOff)?+op.tipOff:0.3,function(v){op.tipOff=Math.max(0,v);},48,0.1,'La pointe descend de cette valeur sous le chanfrein : le flanc coupe, pas la pointe (fragile). 0,2 à 0,5 mm.'));
  d.appendChild(r1);
  const r2=faoRow();
  r2.appendChild(faoLab('Côté'));
  r2.appendChild(faoSel([['auto','Auto (matière)'],['ext','Extérieur'],['int','Intérieur']],op.cside||'auto',function(v){op.cside=v;},'Côté de l’outil par rapport aux arêtes : déduit de la matière par défaut'));
  r2.appendChild(faoLab('Sens'));
  r2.appendChild(faoSel([['avalant','Avalant'],['opp','Opposition']],op.sens==='opp'?'opp':'avalant',function(v){op.sens=v;},'Sens de coupe'));
  d.appendChild(r2);
  const r3=faoRow();
  r3.appendChild(faoLab('Parcours'));
  r3.appendChild(faoSel([['plan','Plan · Z fixe','Une passe à plat, à la cote de l’arête la plus haute.'],
    ['3d','3D · suit l’arête','La pointe suit le Z de l’arête point par point (dessus en pente, bord gauche) ; l’axe de l’outil reste vertical (3 axes).']],
    op.c3d?'3d':'plan',function(v){ if(v==='3d')op.c3d=true; else delete op.c3d; },'Chanfrein plan ou 3D'));
  d.appendChild(r3);
  if(has&&Z3a&&!op.c3d){
    const w3=document.createElement('div');w3.className='fao-alert';
    w3.textContent='⚠ Arêtes non planes (Z '+faoDsp(op,Z3a.zMin,2)+' → '+faoDsp(op,Z3a.zMax,2)+') : choisissez « 3D » pour que le chanfrein suive l’arête.';
    d.appendChild(w3);
  }else if(has&&op.c3d&&!Z3a){
    const w3=document.createElement('div');w3.className='fao-help';
    w3.textContent='Arêtes planes : le parcours 3D est identique au parcours plan'+'.';
    d.appendChild(w3);
  }
  // outil et géométrie
  const G=faoChamferGeom(op,t);
  const n=document.createElement('div');
  if(!faoChamferToolOk(t)){
    n.className='fao-alert';
    n.textContent='⚠ L’outil T'+(t?t.num:'?')+' ('+(t?faoKindLabel(t.kind):'?')+') n’a pas de cône : choisissez une fraise à chanfreiner ou un foret à pointer.';
    d.appendChild(n);
    const rb=faoRow();
    rb.appendChild(faoMini('Créer une fraise à chanfreiner Ø6 90°',function(){ faoSnapshot('outil de chanfrein'); faoChamferToolMake(setup,op); faoChanged(); try{renderProps();}catch(e){} },
      'Ajoute à la liste d’outils une fraise à chanfreiner Ø6 à 90° (pointe Ø0,5) et l’affecte à cette opération.'));
    d.appendChild(rb);
  }else if(G){
    n.className=G.ok?'fao-help':'fao-alert';
    n.textContent=(G.ok?'':'⚠ '+G.warn+'. ')+'Outil '+G.ang+'°'+(G.rt>0?' pointe Ø'+(2*G.rt).toFixed(2):' pointe vive')+
      ' : chanfrein '+G.a.toFixed(2)+' × '+G.b.toFixed(2)+' mm ; pointe '+
      (Z3?(G.b+G.t).toFixed(3)+' mm sous l’arête (parcours 3D, axe outil en Z)':'à Z '+faoDsp(op,G.zTip,2))+
      ', axe à '+G.d.toFixed(3)+' mm de l’arête ; contact haut sur Ø'+(2*G.rho).toFixed(2)+'.';
    d.appendChild(n);
  }
}
