// Noms uniques partout (src/20-05-noms.js) : sur chaque exemple, chaque face de chaque corps a un nom,
// aucun doublon ; chaque référence (congé, face, projection) a retenu le sien ; chaque élément d'esquisse
// est désigné sans ambiguïté et ses contraintes et cotes visent des éléments qui existent.
// Lancé seul : node tests/test_noms_partout.cjs [filtre]
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
const filtre=process.argv[2]||'';
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const dir=path.join(ROOT,'Exemples');
  const L=fs.readdirSync(dir).filter(n=>n.endsWith('.conceptcad')&&n.toLowerCase().includes(filtre.toLowerCase()));
  let bad=0;
  console.log('=== Noms uniques partout (exemples, noyau réel) ===');
  for(const nom of L){
    const txt=lire(path.join(dir,nom));
    if(!txt||txt.length<10)continue;
    const {ctx,sandbox}=loadApp();
    sandbox.__realOcct=real;sandbox.__txt=txt;
    vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
    const R=String.raw`
      await bundleRestore(__txt,{name:'banc'});occt=__realOcct;occtReady=true;markDirty();rebuild();markDirty();rebuild();
      const o={corps:0,faces:0,sans:0,doublons:[],nes:0,refs:0,refsSans:[],proj:0,projSans:0,esq:[],types:{}};
      (doc.bodies||[]).forEach(b=>{
        const list=doc.features.filter(f=>f.visible!==false&&(f.body===b.id||occSplitNewBody(f)===b.id||occCutExtraBodies(f).indexOf(b.id)>=0));
        if(!list.length||list.every(f=>f.type==='repeat'))return;
        let r=null;
        try{r=occReplayBodyIn(b.id,list);}catch(e){o.esq.push('corps '+b.id+' : '+e.message);return;}
        if(r&&r.shape){
          o.corps++;
          const T=nomsDe(r.shape),m=nomsCarteFaces(r.shape),N=m?m.Size():0;
          const noms=[];
          for(let i=0;i<N;i++){const n=T?T.f[i]:null;if(!n)o.sans++;else{noms.push(n);if(/\/~\d+/.test(n))o.nes++;}}
          o.faces+=N;
          const vus=new Set();noms.forEach(n=>{if(vus.has(n))o.doublons.push(n);vus.add(n);});
          try{m.delete();}catch(e){}
        }
        try{occCleanup(r,null);}catch(e){}
      });
      const refFace=r=>{if(!r||typeof r!=='object'||!Array.isArray(r.pos))return;o.refs++;if(!r.nom)o.refsSans.push(JSON.stringify(r.pos));};
      (doc.features||[]).forEach(f=>{
        if(f.visible===false)return;
        o.types[f.type]=(o.types[f.type]||0)+1;
        if(f.type==='xfillet')(f.edges||[]).forEach(refFace);
        if(f.type==='xmove')mvRefs(f).forEach(refFace);
        if(f.type==='xdelface'||f.type==='xshell'||f.type==='xdraft')(f.faces||[]).forEach(refFace);
      });
      (doc.sketches||[]).forEach(sk=>{
        const P=sk.points||{},E=sk.entities||[];
        const ids=new Set();E.forEach(e=>{if(ids.has(e.id))o.esq.push(sk.id+' : élément '+e.id+' en double');ids.add(e.id);});
        const cid=new Set();(sk.constraints||[]).forEach(c=>{if(c.id!=null){if(cid.has(c.id))o.esq.push(sk.id+' : contrainte '+c.id+' en double');cid.add(c.id);}});
        const did=new Set();(sk.dims||[]).forEach(d=>{if(d.id!=null){if(did.has(d.id))o.esq.push(sk.id+' : cote '+d.id+' en double');did.add(d.id);}});
        E.forEach(e=>{
          ['p1','p2','pc','pa','pb','p'].forEach(k=>{if(e[k]!=null&&!P[e[k]])o.esq.push(sk.id+'/'+e.id+' : point '+e[k]+' absent');});
          if(e.proj&&e.srcMid&&!e.ext&&!e.isect&&!repCloneSkName(sk)&&sk.id!==(skEdit&&skEdit.id)){o.proj++;if(!e.srcNom){o.projSans++;o.projDetail=(o.projDetail||[]).concat(sk.id+'/'+e.id+':'+e.t);}}
        });
        (sk.constraints||[]).forEach(c=>{['p','p1','p2','a','b'].forEach(k=>{const v=c[k];if(typeof v==='string'&&!P[v]&&!ids.has(v))o.esq.push(sk.id+' : contrainte '+c.type+' vise '+v+' absent');});});
      });
      return o;`;
    let o;
    try{o=await vm.runInContext('(async()=>{'+R+'})()',ctx);}
    catch(e){console.log('  ✗ '+nom+' : '+String(e&&e.message||e).slice(0,200));bad++;continue;}
    const pb=[];
    if(o.sans)pb.push(o.sans+' face(s) sans nom');
    if(o.doublons.length)pb.push(o.doublons.length+' doublon(s) ('+o.doublons.slice(0,3).join(', ')+')');
    if(o.corps&&o.refsSans.length)pb.push(o.refsSans.length+' référence(s) sans nom');
    if(o.esq.length)pb.push(o.esq.length+' esquisse(s) : '+o.esq.slice(0,2).join(' ; '));
    const info=o.corps+' corps, '+o.faces+' faces (dont '+o.nes+' nommées à la naissance), '+o.refs+' réf., '+(o.proj-o.projSans)+'/'+o.proj+' proj.';
    if(pb.length){bad++;console.log('  ✗ '+nom+' : '+info+' — '+pb.join(' ; '));}
    else console.log('  ✓ '+nom+' : '+info+(o.projDetail?' — sans nom : '+o.projDetail.slice(0,5).join(', '):''));
  }
  if(bad){console.log('\n*** '+bad+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
