// Le cas d'origine : Barquette, longueur ou largeur changée d'un grand coup. Le solide, le congé de 1,
// le plan et les arêtes projetées doivent arriver au même endroit que par petits pas, et revenir
// exactement au départ quand la valeur revient. Deux états de la pièce : d'origine, et avec ses renforts
// (Symétrie, Linéaire, congés copiés). Lancé seul : node tests/test_noms_barquette.cjs
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const scenario=async(txt,seq)=>{
    const {ctx,sandbox}=loadApp();
    sandbox.__realOcct=real;sandbox.__txt=txt;sandbox.__seq=seq;
    vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
    const R=String.raw`
      await bundleRestore(__txt,{name:'banc'});occt=__realOcct;occtReady=true;markDirty();rebuild();
      const P=n=>doc.params.find(p=>p.name===n);
      const nb=v=>+(+v).toFixed(3);
      const lit=()=>{
        const FR=occFinalShape(null),m={aretes:occListEdges(FR.shape).length,volume:nb(occShapeVolume(FR.shape)),box:occShapeBox(FR.shape,0).map(c=>c.map(nb)),refs:{},msgs:(FR.msgs||[]).slice()};
        try{occCleanup(FR,null);}catch(e){}
        (doc.features||[]).forEach(f=>{if(f.type==='xfillet')(f.edges||[]).forEach((e,i)=>{m.refs['congé '+f.id+'/'+i]=e.pos.map(nb);});});
        (doc.cgeo||[]).forEach(g=>{if(g.fr)m.refs['plan '+g.id]=g.fr.o.map(nb);m.refs['état '+g.id]=g.st;});
        (doc.sketches||[]).forEach(s=>(s.entities||[]).forEach(e=>{if(e.proj&&e.srcMid)m.refs['projetée '+s.id+'/'+e.id]=e.srcMid.map(nb);}));
        return m;
      };
      const out=[];
      out.push(lit());
      for(const pas of __seq){for(const [n,v] of pas){P(n).expr=String(v);parApplyAll();markDirty();rebuild();}out.push(lit());}
      return out;`;
    return vm.runInContext('(async()=>{'+R+'})()',ctx);
  };
  const fails=[],ok=[];
  const A=(c,m)=>{(c?ok:fails).push(m);};
  const ecarts=(a,b)=>{
    const D=[];
    if(Math.abs(a.volume-b.volume)>1e-2*Math.max(1,Math.abs(a.volume))*1e-3)D.push('volume '+a.volume+' / '+b.volume);
    if(JSON.stringify(a.box)!==JSON.stringify(b.box))D.push('encombrement '+a.box+' / '+b.box);
    if(a.aretes!==b.aretes)D.push('arêtes '+a.aretes+' / '+b.aretes);
    new Set([...Object.keys(a.refs),...Object.keys(b.refs)]).forEach(k=>{
      const x=a.refs[k],y=b.refs[k];
      if(Array.isArray(x)&&Array.isArray(y)?x.some((v,i)=>Math.abs(v-y[i])>2e-2):x!==y)D.push(k+' : '+x+' / '+y);
    });
    return D;
  };
  const perdues=m=>m.msgs.filter(t=>/n’existe plus|introuvable|perdu/i.test(t));
  const PIECES=[
    {nom:'d’origine',fichier:'barquette-noms.conceptcad',cas:[['longueur_barquette',230,250],['largeur_barquette',150,185],['longueur_barquette',230,287.5],['longueur_barquette',230,200]]},
    {nom:'avec renforts',fichier:'barquette-renforts.conceptcad',cas:[['longueur_barquette',235,255],['largeur_barquette',165,180],['longueur_barquette',235,292.5],['longueur_barquette',235,205]],
      // Largeur 200 : le guide des renforts s'appuie sur un point fixe, son profil de 12 mm n'atteint plus le
      // flanc. Le renfort ne peut réellement plus exister ; on exige qu'on le dise et que le retour soit exact.
      limite:[['largeur_barquette',165,200]]},
  ];
  for(const P of PIECES){
    console.log('=== Barquette '+P.nom+' : grands changements (noyau réel) ===');
    const txt=lire(path.join(ROOT,'tests','fixtures',P.fichier));
    const t=' ['+P.nom+'] ';
    for(const [n,de,a] of P.cas){
      const pas=[];const N=Math.max(1,Math.round(Math.abs(a-de)/5));for(let i=1;i<=N;i++)pas.push([n,de+(a-de)*i/N]);
      const J=await scenario(txt,[[[n,a]],[[n,de]]]);
      const S=await scenario(txt,[pas]);
      const d1=ecarts(J[1],S[1]);A(!d1.length,t+n+' '+de+' → '+a+' : d’un coup = par petits pas'+(d1.length?' — '+d1.slice(0,4).join(' ; '):''));
      const d2=ecarts(J[0],J[2]);A(!d2.length,t+n+' '+a+' → '+de+' : retour exact au départ'+(d2.length?' — '+d2.slice(0,4).join(' ; '):''));
      const al=perdues(J[1]);A(!al.length,t+n+' → '+a+' : aucune référence perdue'+(al.length?' — '+al.slice(0,2).join(' ; '):''));
    }
    for(const [n,de,a] of P.limite||[]){
      const J=await scenario(txt,[[[n,a]],[[n,de]]]);
      A(perdues(J[1]).length>0,t+n+' → '+a+' : le renfort impossible est signalé');
      const d2=ecarts(J[0],J[2]);A(!d2.length,t+n+' '+a+' → '+de+' : retour exact au départ'+(d2.length?' — '+d2.slice(0,4).join(' ; '):''));
    }
  }
  ok.forEach(m=>console.log('  ✓ '+m));
  if(fails.length){fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
