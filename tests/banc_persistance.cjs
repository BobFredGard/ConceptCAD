// BANC DE PERSISTANCE : un grand saut de valeur doit donner EXACTEMENT le même modèle que le même
// changement fait par petits pas, et revenir à la valeur de départ doit tout remettre en place.
// Pour chaque exemple et chaque valeur réglable (paramètre, cote d'esquisse, distance d'extrusion),
// il compare le solide, les arêtes des congés, les plans de construction, les projetées, les points
// d'esquisse et les contraintes, et contrôle qu'aucune référence ne pointe vers un élément disparu.
// Ce n'est pas une suite de la CI : il sert d'état des lieux, fonction par fonction.
//   node tests/banc_persistance.cjs [--j 6] [--sortie fichier.json] [--saut 0.25] [nom d'exemple…]
//   APP_FILE=autre.html compare une autre version de l'application.
// Les fichiers d'Exemples/ sont seulement lus.
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),os=require('os');
const {spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const ARGS=process.argv.slice(2);
const opt=(n,d)=>{const i=ARGS.indexOf('--'+n);if(i<0)return d;const v=ARGS[i+1];ARGS.splice(i,2);return v;};

/* ----- code exécuté DANS l'application (bac à sable) ----- */
const DANS_APP=String.raw`
const TOL=1e-3;
const nb=v=>+(+v).toFixed(4);
async function charger(){
  if(bundleIs(__txt))await bundleRestore(__txt,{name:'banc'});
  else{await deserialise(__txt);rebuild();}
  occt=__realOcct;occtReady=true;markDirty();rebuild();
}
function reglages(){
  const L=[];
  (doc.params||[]).forEach(p=>{if(p&&/^\s*-?[\d.]+\s*$/.test(String(p.expr))&&+p.value)L.push({k:'param',id:p.name,v:+p.value,nom:'paramètre '+p.name});});
  (doc.sketches||[]).forEach(s=>(s.dims||[]).forEach(d=>{if(d&&!d.ref&&!d.expr&&+d.value)L.push({k:'cote',sk:s.id,id:d.id,v:+d.value,nom:(s.name||s.id)+' / cote '+(d.name||d.id)+' ('+d.type+')'});}));
  (doc.features||[]).forEach(f=>{if(f&&f.type==='extrude'&&!f.through&&!f.upto&&!(f.expr&&f.expr.distance)&&+f.distance)L.push({k:'distance',id:f.id,v:+f.distance,nom:(f.name||f.id)+' / distance'});});
  return L;
}
function poser(R,v){
  if(R.k==='param'){const p=doc.params.find(x=>x.name===R.id);p.expr=String(v);parApplyAll();}
  else if(R.k==='cote'){const s=doc.sketches.find(x=>x.id===R.sk),d=s.dims.find(x=>x.id===R.id);d.value=v;solveSketch(s);parApplyAll();}
  else{const f=doc.features.find(x=>x.id===R.id);f.distance=v;parApplyAll();}
  markDirty();rebuild();
}
const CHAMPS_ENT=['line','ent','a','b','mid','e'],CHAMPS_PT=['p','p1','p2','pc','pa','pb'];
function integrite(){
  // Toute référence nommée doit désigner un élément qui existe encore
  const pb=[];
  const SK=new Map((doc.sketches||[]).map(s=>[s.id,s])),FE=new Set((doc.features||[]).map(f=>f.id));
  (doc.sketches||[]).forEach(s=>{
    const P=s.points||{},E=new Set((s.entities||[]).map(e=>e.id));
    const vus=new Set();
    [...(s.entities||[]),...(s.constraints||[]),...(s.dims||[])].forEach(x=>{if(x&&x.id!=null){if(vus.has(x.id))pb.push('nom en double '+s.id+'/'+x.id);vus.add(x.id);}});
    (s.entities||[]).forEach(e=>{['p','p1','p2','pc','pa','pb'].forEach(c=>{if(e[c]!==undefined&&!P[e[c]])pb.push('entité '+s.id+'/'+e.id+' : point '+e[c]+' disparu');});});
    [...(s.constraints||[]),...(s.dims||[])].forEach(c=>{if(!c)return;
      CHAMPS_ENT.forEach(k=>{const v=c[k];if(typeof v==='string'&&!E.has(v)&&!P[v])pb.push('contrainte '+s.id+'/'+c.id+' : '+k+'='+v+' disparu');});
      CHAMPS_PT.forEach(k=>{const v=c[k];if(typeof v==='string'&&!P[v]&&!E.has(v))pb.push('contrainte '+s.id+'/'+c.id+' : '+k+'='+v+' disparu');});});
    if(s.host&&s.host.feat&&!FE.has(s.host.feat))pb.push('esquisse '+s.id+' : fonction hôte disparue');
  });
  const anc=(qui,a)=>{if(!a||!a.sk)return;const s=SK.get(a.sk);if(!s){pb.push(qui+' : esquisse '+a.sk+' disparue');return;}
    if(a.t==='p'?!s.points[a.id]:!(s.entities||[]).some(e=>e.id===a.id))pb.push(qui+' : '+a.sk+'/'+a.id+' disparu');};
  (doc.features||[]).forEach(f=>{
    if(f.sketchId&&!SK.has(f.sketchId))pb.push('fonction '+f.id+' : esquisse disparue');
    [...(f.edges||[]),...(f.faces||[])].forEach(r=>r&&anc('fonction '+f.id,r.anchor));
    if(f.ref)anc('fonction '+f.id,f.ref.anchor);
  });
  (doc.cgeo||[]).forEach(g=>(g.refs||[]).forEach(r=>anc('construction '+g.id,r.anchor)));
  return pb;
}
function mesure(){
  const m={solide:{},refs:{},alertes:[]};
  let FR=null;
  try{
    FR=occFinalShape(null);
    if(FR&&FR.shape&&!FR.shape.IsNull()){
      const S=FR.shape;
      const compte=t=>{let n=0;const ex=new occt.TopExp_Explorer_2(S,t,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);while(ex.More()){n++;ex.Next();}ex.delete();return n;};
      m.solide.faces=compte(occt.TopAbs_ShapeEnum.TopAbs_FACE);
      m.solide.aretes=compte(occt.TopAbs_ShapeEnum.TopAbs_EDGE);
      try{m.solide.volume=nb(occShapeVolume(S));}catch(e){m.solide.volume=null;}
      try{const b=occShapeBox(S);if(b&&b.pos)m.solide.boite=[...b.pos,...b.dim].map(nb);}catch(e){}
    }else m.solide.vide=1;
    (FR&&FR.msgs||[]).forEach(t=>{if(/introuvable|impossible|perdu|aucune|refus|divergente|NURBS/i.test(t)&&m.alertes.indexOf(t)<0)m.alertes.push(t);});
  }catch(e){m.alertes.push('rejeu : '+String(e&&e.message||e).slice(0,120));}
  finally{try{if(FR)occCleanup(FR,null);}catch(e){}}
  (doc.features||[]).forEach(f=>{
    if(f._err)m.alertes.push(f.name+' : '+f._err);
    if(f.type==='xfillet'){
      (f.edges||[]).forEach((e,i)=>{if(e&&e.pos)m.refs['congé '+f.id+' arête '+i]=e.pos.map(nb);});
      if(f._m&&f._m.m<f._m.t)m.alertes.push(f.name+' : '+f._m.m+'/'+f._m.t+' arêtes');
    }
    if(Array.isArray(f.faces)&&f.type!=='xfillet')f.faces.forEach((r,i)=>{if(r&&r.pos)m.refs[f.type+' '+f.id+' face '+i]=r.pos.map(nb);});
    if(f._miss||f._lost)m.alertes.push(f.name+' : référence perdue');
  });
  (doc.cgeo||[]).forEach(g=>{
    if(g.fr)m.refs['construction '+g.id]=[...g.fr.o,...g.fr.z].map(nb);
    if(g.st&&g.st!=='ok')m.alertes.push('construction '+(g.name||g.id)+' : '+g.st+' '+(g.msg||''));
  });
  (doc.sketches||[]).forEach(s=>{
    if(s.origin&&s.plane==='FACE')m.refs['hôte '+s.id]=[...s.origin,...(s.axN||[])].map(nb);
    (s.entities||[]).forEach(e=>{if(e&&e.proj&&e.srcMid)m.refs['projetée '+s.id+'/'+e.id]=e.srcMid.map(nb);});
    const P=s.points||{};Object.keys(P).forEach(k=>{if(P[k])m.refs['point '+s.id+'/'+k]=[nb(P[k].x),nb(P[k].y)];});
    try{const v=skAudit(s).residual;if(v>1e-3)m.alertes.push('contraintes '+(s.name||s.id)+' : écart '+nb(v));}catch(e){}
  });
  const pb=integrite();pb.forEach(t=>m.alertes.push('intégrité : '+t));
  return m;
}
function ecarts(A,B){
  const D=[];
  ['faces','aretes'].forEach(k=>{if(A.solide[k]!==B.solide[k])D.push('solide : '+k+' '+A.solide[k]+' / '+B.solide[k]);});
  if(A.solide.volume!=null&&B.solide.volume!=null&&Math.abs(A.solide.volume-B.solide.volume)>Math.max(1e-3,1e-6*Math.abs(A.solide.volume)))D.push('solide : volume '+A.solide.volume+' / '+B.solide.volume);
  if(A.solide.boite&&B.solide.boite&&A.solide.boite.some((v,i)=>Math.abs(v-B.solide.boite[i])>TOL))D.push('solide : encombrement');
  new Set([...Object.keys(A.refs),...Object.keys(B.refs)]).forEach(k=>{
    const a=A.refs[k],b=B.refs[k];
    if(!a||!b){D.push(k+' : présent d’un seul côté');return;}
    if(a.length!==b.length||a.some((v,i)=>Math.abs(v-b[i])>TOL))D.push(k+' : '+a.join(',')+' / '+b.join(','));
  });
  return D;
}
function alertesNeuves(M,base){return M.alertes.filter(t=>base.alertes.indexOf(t)<0);}
async function banc(){
  await charger();
  const liste=reglages();
  __emit({type:'liste',n:liste.length,noms:liste.map(r=>r.nom),integrite:integrite()});
  for(let i=__from;i<liste.length;i++){
    const R=liste[i];
    __emit({type:'debut',i,nom:R.nom});
    const t0=Date.now();
    try{
      await charger();
      const base=mesure();
      const v1=R.v*(1+__saut);
      poser(R,v1);const saut=mesure();
      poser(R,R.v);const retour=mesure();
      await charger();
      for(let s=1;s<=__pas;s++)poser(R,R.v+(v1-R.v)*s/__pas);
      const pas=mesure();
      __emit({type:'res',i,nom:R.nom,de:R.v,a:nb(v1),ms:Date.now()-t0,
        sautPas:ecarts(saut,pas),retour:ecarts(base,retour),
        alSaut:alertesNeuves(saut,base),alPas:alertesNeuves(pas,base),alBase:base.alertes});
    }catch(e){__emit({type:'res',i,nom:R.nom,ms:Date.now()-t0,echec:String(e&&e.message||e).slice(0,200),sautPas:[],retour:[],alSaut:[],alPas:[],alBase:[]});}
  }
  __emit({type:'fin'});
}
`;

/* ----- côté processus d'un exemple ----- */
async function ouvrier(fichier,from,saut,pas){
  const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  Object.assign(sandbox,{__realOcct:real,__txt:lire(fichier),__from:from,__saut:saut,__pas:pas,
    __emit:o=>fs.writeSync(1,'BANC '+JSON.stringify(o)+'\n')});
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};showAll=function(){};applyView=function(){};',ctx);
  await vm.runInContext('(async()=>{'+DANS_APP+'\nawait banc();})()',ctx);
}

/* ----- chef d'orchestre ----- */
const SILENCE_MS=240000;
function unExemple(fichier,saut,pas){
  return new Promise(fin=>{
    const res={fichier:path.basename(fichier),liste:null,integrite:[],reglages:[]};
    let from=0;
    const tour=()=>{
      const c=spawn(process.execPath,[__filename,'--ouvrier',fichier,'--from',String(from),'--saut',String(saut),'--pas',String(pas)],{stdio:['ignore','pipe','pipe'],env:process.env});
      let reste='',enCours=null,fini=false,montre=null;
      const veille=()=>{clearTimeout(montre);montre=setTimeout(()=>{try{c.kill();}catch(e){}},SILENCE_MS);};
      veille();
      c.stdout.on('data',b=>{
        reste+=b;const L=reste.split('\n');reste=L.pop();
        L.forEach(l=>{
          if(!l.startsWith('BANC '))return;
          let o;try{o=JSON.parse(l.slice(5));}catch(e){return;}
          veille();
          if(o.type==='liste'){res.liste=o.noms;res.integrite=o.integrite;}
          else if(o.type==='debut')enCours=o;
          else if(o.type==='res'){res.reglages.push(o);enCours=null;from=o.i+1;}
          else if(o.type==='fin')fini=true;
        });
      });
      c.stderr.on('data',()=>{});
      c.on('close',()=>{
        clearTimeout(montre);
        if(fini||!res.liste&&from>0){fin(res);return;}
        if(!res.liste){res.echec='ouverture impossible ou trop longue';fin(res);return;}
        // L'ouvrier s'est arrêté sur ce réglage : on le note et on reprend au suivant
        const i=enCours?enCours.i:from;
        res.reglages.push({i,nom:enCours?enCours.nom:'?',echec:'calcul interrompu (plus de '+SILENCE_MS/60000+' min, ou plantage)',sautPas:[],retour:[],alSaut:[],alPas:[],alBase:[]});
        from=i+1;
        if(from>=res.liste.length){fin(res);return;}
        tour();
      });
    };
    tour();
  });
}
const famille=t=>{
  const m=/^(congé|construction|projetée|hôte|point|solide|xmove|xdraft|xshell|xdelface|xsplit|\w+)/.exec(t);
  const n=m?m[1]:'autre';
  return ({congé:'congés et chanfreins',construction:'plans, axes et points',projetée:'projections',hôte:'esquisses sur face',point:'points d’esquisse',solide:'solide final',xmove:'déplacement de face',xdraft:'dépouille',xshell:'coque',xdelface:'suppression de face'})[n]||n;
};
function bilan(R){
  const F={};const ajoute=(k,c)=>{(F[k]=F[k]||{sautPas:0,retour:0});F[k][c]++;};
  let n=0,bons=0,echecs=0,alertes=0;
  R.forEach(r=>(r.reglages||[]).forEach(x=>{
    n++;
    if(x.echec){echecs++;return;}
    if(!x.sautPas.length&&!x.retour.length&&!x.alSaut.length)bons++;
    if(x.alSaut.length)alertes++;
    new Set(x.sautPas.map(famille)).forEach(k=>ajoute(k,'sautPas'));
    new Set(x.retour.map(famille)).forEach(k=>ajoute(k,'retour'));
  }));
  return{n,bons,echecs,alertes,F};
}
async function chef(){
  const J=+opt('j',Math.max(2,Math.min(8,os.cpus().length>>1)));
  const sortie=opt('sortie',path.join(ROOT,'test-results','banc_persistance.json'));
  const saut=+opt('saut',0.25),pas=+opt('pas',5);
  const dir=path.join(ROOT,'Exemples');
  let L=fs.readdirSync(dir).filter(n=>/\.conceptcad$/i.test(n));
  if(ARGS.length)L=L.filter(n=>ARGS.some(a=>n.toLowerCase().includes(a.toLowerCase())));
  const R=[];let k=0;
  const ecrire=()=>{fs.mkdirSync(path.dirname(sortie),{recursive:true});fs.writeFileSync(sortie,JSON.stringify({app:process.env.APP_FILE||'ConceptCAD.html',saut,pas,exemples:R},null,1));};
  await Promise.all(Array.from({length:J},async()=>{
    while(k<L.length){
      const n=L[k++];
      const r=await unExemple(path.join(dir,n),saut,pas);R.push(r);ecrire();
      const b=bilan([r]);
      console.log(n.padEnd(50),r.echec?r.echec:(b.bons+'/'+b.n+' sans écart'+(b.echecs?', '+b.echecs+' interrompus':'')+(r.integrite.length?', '+r.integrite.length+' défauts d’intégrité':'')));
    }
  }));
  const b=bilan(R);
  console.log('\n=== BILAN : '+b.bons+'/'+b.n+' réglages sans écart, '+b.alertes+' avec alerte nouvelle sur le saut, '+b.echecs+' interrompus ===');
  console.log('Réglages touchés, par famille (saut ≠ petits pas | retour ≠ départ) :');
  Object.keys(b.F).sort((x,y)=>b.F[y].sautPas-b.F[x].sautPas).forEach(k=>console.log('  '+k.padEnd(26)+String(b.F[k].sautPas).padStart(5)+' |'+String(b.F[k].retour).padStart(5)));
  console.log('Détail : '+sortie);
}
if(ARGS[0]==='--ouvrier'){
  const f=ARGS[1];opt('ouvrier');
  ouvrier(f,+opt('from',0),+opt('saut',0.25),+opt('pas',5)).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
}else chef().catch(e=>{console.error(e);process.exit(1);});
