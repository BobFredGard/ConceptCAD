// Une valeur impossible ne doit rien laisser derrière elle : revenir à la valeur d'origine redonne le
// solide d'origine. Cache Piles (largeur 81 : Esquisse 7 déformée, projections perdues) et Support Pédale
// (Esquisse 6 : profil ouvert, projetées allongées par erreur).
// Lancé seul : node tests/test_noms_retour.cjs
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const fails=[],ok=[];
  const A=(c,m)=>{(c?ok:fails).push(m);};
  const cas=[
    // V0.89.2 : l'exemple Cache Piles a été refait ; la pièce du défaut d'origine est gardée dans tests/fixtures
    {f:'../tests/fixtures/cache-piles-v1.conceptcad',sk:'Esquisse 1',id:'e23'},
    {f:'Support Pédale Déportée R1200RT 2011.conceptcad',sk:'Esquisse 6 (face)',id:'e48'},
  ];
  console.log('=== Retour exact après une valeur impossible (noyau réel) ===');
  for(const c of cas){
    const {ctx,sandbox}=loadApp();
    Object.assign(sandbox,{__realOcct:real,__txt:lire(path.join(ROOT,'Exemples',c.f)),__c:c});
    vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
    const R=String.raw`
      const c=__c,nb=v=>+(+v).toFixed(3);
      await bundleRestore(__txt,{name:'banc'});occt=__realOcct;occtReady=true;markDirty();rebuild();
      const sk=doc.sketches.find(x=>x.name===c.sk),d=sk.dims.find(x=>x.id===c.id),v0=d.value;
      const pose=v=>{d.value=v;solveSketch(sk);parApplyAll();markDirty();rebuild();};
      const lit=()=>{
        const FR=occFinalShape(null),o={v:nb(occShapeVolume(FR.shape)),ar:occListEdges(FR.shape).length,p:{},e:{}};
        try{occCleanup(FR,null);}catch(e){}
        doc.sketches.forEach(s=>{
          if(repCloneSkName(s))return;
          Object.keys(s.points||{}).forEach(k=>{o.p[s.id+'/'+k]=[nb(s.points[k].x),nb(s.points[k].y)];});
          (s.entities||[]).forEach(e=>{if(e.proj&&e.srcMid)o.e[s.id+'/'+e.id]=e.srcMid.map(nb);});
        });
        return o;
      };
      const a=lit();pose(v0*1.25);const s=lit();pose(v0);const b=lit();
      return JSON.stringify({a,s,b});`;
    const {a,s,b}=JSON.parse(await vm.runInContext('(async()=>{'+R+'})()',ctx));
    const nom=c.f.slice(0,11)+' '+c.id;
    A(a.v!==s.v||a.ar!==s.ar,nom+' : le saut change bien le solide ('+a.v+' → '+s.v+')');
    A(Math.abs(a.v-b.v)<1e-2,nom+' : même volume au retour ('+a.v+' / '+b.v+')');
    A(a.ar===b.ar,nom+' : mêmes arêtes au retour ('+a.ar+' / '+b.ar+')');
    const ecart=(x,y)=>Object.keys(x).filter(k=>!y[k]||x[k].some((u,i)=>Math.abs(u-y[k][i])>2e-3));
    const dp=ecart(a.p,b.p),de=ecart(a.e,b.e);
    A(!dp.length,nom+' : points d’esquisse revenus'+(dp.length?' — '+dp.slice(0,5).join(', '):''));
    A(!de.length,nom+' : arêtes projetées revenues'+(de.length?' — '+de.slice(0,5).join(', '):''));
  }
  // Le souvenir du bon état ne doit jamais défaire un geste de l'utilisateur
  {
    const {ctx,sandbox}=loadApp();
    sandbox.__c=1;
    const r=vm.runInContext(String.raw`(()=>{
      const sk={points:{a:{x:0,y:0},b:{x:10,y:0}},entities:[{id:'l',t:'line',p1:'a',p2:'b'}],constraints:[],dims:[]};
      SK_PTS.set(sk,{a:[0,0],b:[10,0]});
      SK_BON.set(sk,{snap:{P:{a:{x:0,y:0},b:{x:5,y:0}},R:{}},vals:new Map(),mauvais:true});
      sk.points.b.x=30;            // l'utilisateur a déplacé le point
      skBonReprise(sk);
      const garde=sk.points.b.x===30&&!SK_BON.has(sk);
      SK_PTS.set(sk,{a:[0,0],b:[30,0]});
      SK_BON.set(sk,{snap:{P:{a:{x:0,y:0},b:{x:5,y:0}},R:{}},vals:new Map(),mauvais:true});
      skBonReprise(sk);            // rien n'a bougé depuis l'état raté : retour au bon état
      return JSON.stringify({garde,revient:sk.points.b.x===5});
    })()`,ctx);
    const o=JSON.parse(r);
    A(o.garde,'un point déplacé à la main n’est pas remis en place');
    A(o.revient,'un état raté repart du dernier bon état');
  }
  ok.forEach(m=>console.log('  ✓ '+m));
  if(fails.length){fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
