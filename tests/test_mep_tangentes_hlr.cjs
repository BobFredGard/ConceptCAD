// V0.83.0 : « Pourquoi, alors que le 3D n'a que des arêtes de tangente grises, dans la mise en plan
// elles sont noires ? » (Fred, 10/11, barquette SIRAP). Le HLR exact d'OCCT lit seulement le drapeau
// de continuité : une jonction tangente sans drapeau G1 (congé sur congé) sortait VIVE, noire, alors
// que la 3D (occSharpEdges) mesure les normales et l'affiche grise. La mise en plan reprend
// maintenant ce classement — sauf de profil, où l'arête est le contour de la pièce et reste noire.
// Pièce réelle : la pédale (Exemples), mêmes jonctions que test_conge_sur_conge.
const vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
const json=require('./lire-projet.cjs')(path.join(ROOT,'Exemples','Support Pédale Déportée R1200RT 2011.conceptcad'));
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.confirm=function(){return true;};window.alert=function(){};',ctx);
  const o=await vm.runInContext(`(async()=>{
    await bundleRestore(${JSON.stringify(json)},{rebuild:false});
    occCkClear();markDirty();rebuild();
    const FR=occFinalShape(null);if(!FR||!FR.shape)throw new Error('shape nulle au rejeu');
    const es=occSharpEdges(FR.shape);
    const out={rg:es.filter(e=>e.rg).length,rgSharp:es.filter(e=>e.rg&&e.sharp).length,views:[]};
    mepSetActive(true);
    const sh=doc.mep.sheets[doc.mep.cur];
    const cnt=v=>{const g=window.mepDebugGeo(v.id),c={},len={};(g.els||[]).forEach(e=>{c[e.k]=(c[e.k]||0)+1;
        len[e.k]=(len[e.k]||0)+(e.t==='L'?Math.hypot(e.x2-e.x1,e.y2-e.y1):e.t==='C'?2*Math.PI*e.r:e.r*Math.abs(e.a1-e.a0));});
      const bb=k=>{let a=[1e9,1e9,-1e9,-1e9];(g.els||[]).forEach(e=>{if(k&&e.k!==k)return;const P=e.t==='L'?[[e.x1,e.y1],[e.x2,e.y2]]:[[e.cx-e.r,e.cy-e.r],[e.cx+e.r,e.cy+e.r]];P.forEach(p=>{a=[Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[2],p[0]),Math.max(a[3],p[1])];});});return a;};
      return{src:g.src,c,len,all:bb(null),sharp:bb('sharp')};};
    ['front','top','right'].forEach(vk=>{
      sh.views.length=0;sh.dims.length=0;
      const v=mepAddViewStd(vk);v.tangent=true;v.mode='dash';
      const a=cnt(v);
      v.tangent=false;
      const b=cnt(v);
      out.views.push({vk,a,b});
    });
    // V0.86.0 : « les arêtes tangentes […] pas dans les coupes tous types » (Fred, 10/11) — une coupe
    // A-A par le milieu de la vue de dessus : ses tangentes sont grises, plus en trait de coupe épais
    {
      sh.views.length=0;sh.dims.length=0;
      const par=mepAddViewStd('top');par.tangent=true;par.mode='hide';
      const bb=cnt(par).all,cx=(bb[0]+bb[2])/2;
      // plan contenant le regard de la vue de dessus et son axe v, passant par x = cx ; on regarde selon u
      const P0=[par.u[0]*cx,par.u[1]*cx,par.u[2]*cx];
      const sv=window.__mepTest.addView({kind:'section',vk:'',dir:par.u.slice(),u:par.v.slice(),v:par.dir.map(x=>-x),parent:par.id,label:'A',
        bodyId:par.bodyId,mode:'hide',tangent:true,hlrExact:true,scale:par.scale,
        section:{p:P0,n:par.u.slice(),a:[cx,bb[1]-5],b:[cx,bb[3]+5],pid:par.id}});
      sv.tangent=true;const a=cnt(sv);sv.tangent=false;const b=cnt(sv);
      out.sec={a,b};
    }
    // référence : même vues sans le classement de la 3D (drapeau OCCT seul)
    const ref=window.occSharpEdges;
    window.occSharpEdges=s=>(ref(s)||[]).map(e=>{const c=Object.assign({},e);delete c.rg;return c;});
    out.base=[];
    // forme neuve : le classement mémorisé par forme ne sert pas
    occCkClear();markDirty();rebuild();
    ['front','top','right'].forEach(vk=>{sh.views.length=0;const v=mepAddViewStd(vk);v.tangent=true;v.mode='dash';out.base.push(cnt(v));});
    window.occSharpEdges=ref;
    return out;
  })()`,ctx);
  let ko=0;const A=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)ko++;};
  console.log('=== PLAN : arêtes tangentes grises comme en 3D (HLR exact) ===');
  A(o.rg>0&&o.rgSharp===0,'la 3D repère '+o.rg+' jonction(s) tangentes que le drapeau OCCT dit vives');
  let mieux=0;
  o.views.forEach((w,i)=>{
    const B=o.base[i],near=(p,q)=>p.every((x,k)=>Math.abs(x-q[k])<1e-6),n=(c,k)=>c[k]||0;
    A(w.a.src==='OCCT HLR'&&B.src==='OCCT HLR','vue '+w.vk+' : HLR exact');
    A(n(w.a.c,'sharp')<=n(B.c,'sharp'),'vue '+w.vk+' : traits noirs '+n(B.c,'sharp')+' → '+n(w.a.c,'sharp')+', gris '+n(B.c,'tangent')+' → '+n(w.a.c,'tangent'));
    if(n(w.a.c,'sharp')<n(B.c,'sharp'))mieux++;
    A(n(w.a.c,'sharp')+n(w.a.c,'tangent')===n(B.c,'sharp')+n(B.c,'tangent'),'vue '+w.vk+' : aucun trait perdu ni ajouté');
    A(near(w.a.sharp,B.sharp),'vue '+w.vk+' : le contour noir est le même qu’avant');
    A(!w.b.c.tangent&&Math.abs(n(w.b.len,'sharp')-n(w.a.len,'sharp'))<1e-3,'vue '+w.vk+' : sans « Arêtes tangentielles », plus aucun gris, les noirs restent ('+n(w.b.len,'sharp').toFixed(1)+' mm)');
  });
  {const S=o.sec,n=(c,k)=>c[k]||0;
    A(S&&S.a.src==='OCCT HLR','coupe A-A : HLR exact');
    A(S&&n(S.a.c,'tangent')>0,'coupe A-A : '+n(S.a.c,'tangent')+' arête(s) tangente(s) grise(s), '+n(S.a.c,'sect')+' trait(s) de coupe');
    A(S&&!S.b.c.tangent&&n(S.b.c,'sect')<n(S.a.c,'sect')+n(S.a.c,'tangent'),'coupe A-A : sans « Arêtes tangentielles », plus aucun gris');
  }
  A(mieux>=2,'au moins 2 vues sur 3 gagnent des gris ('+mieux+')');
  console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
