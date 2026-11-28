/* ═══ Tournage : programme CN (V1.2.7) ═══
   Fagor 8065 T et Siemens 840D en tournage : X en DIAMÈTRE (G151 / DIAMON),
   plan G18, vitesse de coupe constante G96 bornée (G192 S / LIMS=), avance en
   mm/tour (G95), arcs G2/G3 au rayon (R / CR=). Le point programmé est le coin
   théorique de la plaquette (voir 89-fao-tour-20), la pointe du foret, le coin
   avant de la lame de tronçonnage : les correcteurs d'outil de la machine
   doivent être mesurés sur ces mêmes points. */

function tourAscii(s){
  // commentaires CN : sans accents ni parenthèses (une parenthèse fermerait le commentaire Fagor)
  let t=String(s==null?'':s);
  try{ t=t.normalize('NFD').replace(/[̀-ͯ]/g,''); }catch(e){}
  return t.replace(/[()]/g,' ').replace(/[Øø]/g,'D').replace(/[«»]/g,'"').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
}
function tourFmt(n){ const v=isFinite(+n)?+n:0; let s=(Math.round(v*1000)/1000).toFixed(3); if(s==='-0.000')s='0.000'; return s; }
function tourFmtF(n){ return (Math.round((+n||0)*1000)/1000).toFixed(3); }
function tourOpsActive(setup){
  if(!setup||(typeof faoSetupStruck==='function'&&faoSetupStruck(setup)))return [];
  return (setup.ops||[]).filter(function(o){ return o&&o.on!==false&&tourOpIs(o); });
}
function tourRpm(setup,cut){
  const C=tourCfg(setup);
  return Math.max(1,Math.round(Math.min(tourNmax(C,cut),cut.vc*1000/(Math.PI*tourSpinD(cut,0)))));
}
// Étape 3 : axe C et outil tournant. Lignes réglables dans la fiche de la machine (live: {...}),
// repères {N} broche de l'outil tournant, {S} tr/min, {M} 3 ou 4, {C} angle. À valider sur la machine.
function tourLiveCfg(post){
  const fag=post.kind!=='siemens', L=post.live||{};
  const D=fag?{caxOn:['#CAX'],caxOff:['#CAX OFF'],on:['#MASTER S{N}','S{S} M{M}'],off:['M05','#MASTER S1'],c:'G0 C{C}'}
            :{caxOn:['SPOS=0'],caxOff:[],on:['M{N}={M} S{N}={S}'],off:['M{N}=5'],c:'SPOS={C}'};
  const arr=function(v,d){ return Array.isArray(v)?v:(typeof v==='string'?[v]:d); };
  return {caxOn:arr(L.caxOn,D.caxOn),caxOff:arr(L.caxOff,D.caxOff),on:arr(L.on,D.on),off:arr(L.off,D.off),c:typeof L.c==='string'?L.c:D.c};
}
function tourPost(job){
  const post=tourPostOf(job), fag=post.kind!=='siemens', C=tourCfg(job), S=tourStock(job);
  const name=faoProgName(job.name), wcs=job.wcs||'G54';
  const NUM=post.numbers; let n=NUM?(+NUM.start||10):0;
  const L=[], warns=[];
  const nc=function(s){ if(NUM){ L.push('N'+n+' '+s); n+=+NUM.step||5; } else L.push(s); };
  const cmt=function(s){ const t=tourAscii(s); if(t)L.push(fag?('( '+t+' )'):('; '+t)); };
  const ops=tourOpsActive(job);
  const gens=ops.map(function(op){ const g=tourOpGen(job,op); (g.warns||[]).forEach(function(w){ warns.push(tourOpLabel(op)+' : '+w); }); return g; });
  const X=function(x){ return 'X'+tourFmt(2*x); }, Z=function(z){ return 'Z'+tourFmt(z); };
  const tcX=C.tcX, tcZ=C.tcZ;
  if(fag){
    L.push('('+name+' - ConceptCAD FAO '+(typeof APP_VER!=='undefined'?APP_VER:'')+' - '+tourAscii(post.label)+' - '+faoToday()+')');
    L.push('( Tournage : X en diametre, origine '+wcs+' = face avant de la piece finie, sur l axe )');
    L.push('( Brut D'+tourFmt(S.d)+' sortie '+tourFmt(S.sortie)+' mm, face avant a Z'+tourFmt(S.face)+' )');
    if(warns.length)cmt('ATTENTION : '+warns.join(' ; '));
    nc('G71 G90 G18 G151 G40 '+wcs);
    nc('G192 S'+Math.round(C.smax)); // G192 = limite de broche (sur 8065, G92 = présélection d'origine)
  }else{
    L.push('; %_N_'+name+'_MPF');
    L.push('; ConceptCAD FAO '+(typeof APP_VER!=='undefined'?APP_VER:'')+' - '+tourAscii(post.label)+' - '+faoToday());
    L.push('; Tournage : X en diametre, origine '+wcs+' = face avant de la piece finie, sur l axe');
    L.push('; Brut D'+tourFmt(S.d)+' sortie '+tourFmt(S.sortie)+' mm, face avant a Z'+tourFmt(S.face));
    if(warns.length)cmt('ATTENTION : '+warns.join(' ; '));
    nc('G71 G90 G18 DIAMON G40 '+wcs);
    nc('LIMS='+Math.round(C.smax));
  }
  const CO=post.coolant||{flood:'M08',off:'M09'};
  const cool=(job.coolant==='off')?null:(CO.flood||'M08');
  let toolCur=null, coolOn=false, gCur=null, fCur=null, xCur=null, zCur=null, spinCur='';
  const lines=function(tpl,T){ (tpl||[]).forEach(function(s){ nc(String(s).replace(/\{T\}/g,String(T))); }); };
  const LV=tourLiveCfg(post);
  const lv=function(tpl,V){ (tpl||[]).forEach(function(s){ let t=String(s); Object.keys(V||{}).forEach(function(k){ t=t.split('{'+k+'}').join(String(V[k])); }); if(t.trim())nc(t); }); };
  let liveOn=false, cCur=null, fOut=0;
  const liveEnd=function(){ if(!liveOn)return; lv(LV.off,{N:C.liveN}); lv(LV.caxOff,{}); liveOn=false; cCur=null; spinCur=''; };
  ops.forEach(function(op,k){
    const g=gens[k], cut=tourCut(job,op), t=cut.t||{};
    if(!g.moves.length)return;
    if(toolCur!==t.id){
      if(toolCur!==null){
        if(coolOn&&CO.off){ nc(CO.off); coolOn=false; }
        if(liveOn)liveEnd(); else nc('M05');
        spinCur='';
        nc('G0 '+X(tcX/2)+' '+Z(tcZ)); gCur='G0'; xCur=tcX/2; zCur=tcZ;
      }
      cmt('T'+t.num+' '+t.name);
      lines(post.toolChange,t.num);
      toolCur=t.id; fCur=null;
    }
    cmt(tourOpLabel(op)+(g.info?' - '+g.info:''));
    let sp;
    const TH=g.thread||null, dir=(TH&&TH.lh)?(C.dir==='M3'?'M4':'M3'):C.dir; // filet à gauche : broche inversée
    if(t.kind==='ldrill'){
      // outil tournant : broche arrêtée et passée en axe C, avance en mm/min (G94) au régime du foret
      const rpm=tourRpm(job,cut);
      if(!liveOn){ if(spinCur)nc('M05'); spinCur=''; cmt('axe C et outil tournant broche '+C.liveN+' - a valider sur la machine'); lv(LV.caxOn,{N:C.liveN}); liveOn=true; cCur=null; }
      sp='live '+rpm;
      if(sp!==spinCur){ lv(LV.on,{N:C.liveN,S:rpm,M:dir==='M4'?4:3}); spinCur=sp; }
      if(cool&&!coolOn){ nc(cool); coolOn=true; }
      nc('G94'); fCur=null; gCur=null; fOut=cut.f*rpm;
    }else{
    if(liveOn)liveEnd();
    if(t.kind==='tdrill'||TH)sp='G97 S'+tourRpm(job,cut)+' '+dir;
    else sp='G96 S'+Math.round(cut.vc)+' '+dir;
    if(sp!==spinCur){ nc(sp); spinCur=sp; }
    if(cool&&!coolOn){ nc(cool); coolOn=true; }
    nc('G95'); fCur=null; gCur=null; fOut=cut.f; // G0 / G1 réécrit au début de chaque opération
    }
    let MV=g.moves;
    if(TH&&fag){
      // Fagor : cycle G86 (filetage longitudinal) — approche, cycle, sortie ; les passes sont celles du cycle
      let i1=-1, j1=-1; MV.forEach(function(m,i){ if(m.thr){ if(i1<0)i1=i; j1=i; } });
      const pre=MV.slice(0,Math.max(1,i1-1)), post=MV.slice(Math.min(MV.length,j1+3));
      const dS=Math.max(0.2,Math.abs(MV[i1+1].x-TH.xc));
      MV=pre;
      g._fagTail={post:post,line:'G86 '+X(TH.xc)+' '+Z(TH.zS)+' Q'+tourFmt(2*TH.xc)+' R'+tourFmt(TH.zE)+' I'+tourFmt(TH.int?-TH.dep:TH.dep)+
        ' B'+tourFmt(TH.B)+' E0.050 D'+tourFmt(dS)+' L0 C'+tourFmt(TH.P)+' J0 A'+tourFmt(TH.A)+' W0'};
    }
    const emit=function(m){
      let w;
      if(m.rap){ w='G0'; }
      else if(m.thr){ w='G33'; }
      else if(m.arc){ const cw=C.arcInv?!m.arc.cw:m.arc.cw; w=cw?'G2':'G3'; }
      else w='G1';
      if(liveOn&&m.c!=null){ const cv=C.cInv?(360-m.c)%360:m.c, cs=tourFmt(cv); if(cs!==cCur){ nc(LV.c.split('{C}').join(cs)); cCur=cs; gCur=null; } }
      const xs=X(m.x), zs=Z(m.z);
      let co='';
      if(m.arc||xCur===null||xs!==X(xCur))co+=' '+xs;
      if(m.arc||zCur===null||zs!==Z(zCur))co+=' '+zs;
      if(!co)return; // même position : rien à écrire
      let s=((w!==gCur||m.arc)?w:'')+co;
      if(m.arc)s+=(fag?' R':' CR=')+tourFmt(m.arc.R);
      if(m.thr)s+=' K'+tourFmt(m.thr); // Siemens : G33 Z… K pas
      else if(!m.rap){ const f=tourFmtF(fOut); if(f!==fCur){ s+=' F'+f; fCur=f; } }
      gCur=w; xCur=m.x; zCur=m.z;
      nc(s.trim());
    };
    MV.forEach(emit);
    if(g._fagTail){
      cmt('cycle de filetage : X Z debut, Q R fin en diametre, I profondeur au rayon, B 1re passe, C pas, A angle de penetration - a valider sur la machine');
      nc(g._fagTail.line); gCur=null;
      g._fagTail.post.forEach(emit);
      delete g._fagTail;
    }
  });
  if(coolOn&&CO.off)nc(CO.off);
  if(liveOn)liveEnd(); else nc('M05');
  nc('G0 '+X(tcX/2)+' '+Z(tcZ));
  (post.end||['M30']).forEach(function(s){ nc(String(s)); });
  return {code:L.join('\n')+'\n',ext:post.ext||'nc',warns:warns};
}
