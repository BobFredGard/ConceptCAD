// Esquisse → outil Décalage comme Fusion (2026-11-10, demande de Fred) :
//  - un clic prend la CHAÎNE TANGENTE (oblong : 2 lignes + 2 arcs), pas les coins vifs ;
//  - aperçu proposé à 3 mm du côté extérieur, sans rien écrire dans l'esquisse ;
//  - Inverser = l'autre côté ; clic dans le vide = côté le plus proche ;
//  - Des deux côtés = une copie de chaque côté ;
//  - la copie n'est JAMAIS en construction, même si la référence l'est ;
//  - Échap vide d'abord la sélection (l'outil reste actif).
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const {ctx,loadErr}=loadApp();
  if(loadErr)console.log('  (harnais : buildScene interrompu — comportement normal du stub)');
  const body=[
    "const out={fails:[],log:[]};",
    "const A=(c,m)=>{if(!c)out.fails.push(m);};",
    "const step=m=>out.log.push(m);",
    "const sk={id:'k1',name:'K',plane:'XY',visible:true,seq:300,constraints:[],dims:[],",
    "  points:{a:{x:-20,y:-5},b:{x:20,y:-5},c:{x:20,y:5},d:{x:-20,y:5},c1:{x:20,y:0},c2:{x:-20,y:0},",
    "    q1:{x:30,y:-10},q2:{x:50,y:-10},q3:{x:50,y:10},q4:{x:30,y:10},cc:{x:0,y:30}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'a1',t:'arc',pc:'c1',pa:'b',pb:'c',r:5},{id:'l2',t:'line',p1:'c',p2:'d'},{id:'a2',t:'arc',pc:'c2',pa:'d',pb:'a',r:5},",
    "    {id:'r1',t:'line',p1:'q1',p2:'q2'},{id:'r2',t:'line',p1:'q2',p2:'q3'},{id:'r3',t:'line',p1:'q3',p2:'q4'},{id:'r4',t:'line',p1:'q4',p2:'q1'},",
    "    {id:'k',t:'circle',pc:'cc',r:6,construction:true}]};",
    "ensureSketchBasis(sk);doc.sketches=[sk];doc.features=[];openSketch(sk.id);",
    "const S=skEdit;skTool='offset';skOffOpt={D:3,flip:false,both:false,chain:true};",
    "const ev=o=>Object.assign({detail:1,ctrlKey:false,metaKey:false,shiftKey:false},o||{});",
    "const ids=()=>skOffSelIds().slice().sort().join(',');",
    // chaîne tangente
    "skOffClick(S,0,-5,ev());",
    "step('oblong : '+ids());A(ids()==='a1,a2,l1,l2','chaîne tangente de l oblong : '+ids());",
    "skOffClick(S,30,0,ev());",
    "step('rectangle (coins vifs) : '+ids());A(ids()==='r4','rectangle : un seul côté attendu, obtenu '+ids());",
    "skOffClick(S,40,10,ev({ctrlKey:true}));A(ids()==='r3,r4','Ctrl+clic ajoute : '+ids());",
    "skOffClick(S,40,10,ev({ctrlKey:true}));A(ids()==='r4','Ctrl+clic retire : '+ids());",
    "skOffOpt.chain=false;skOffClick(S,0,-5,ev());A(ids()==='l1','chaîne coupée : un seul trait attendu, obtenu '+ids());",
    "skOffClick(S,0,-5,ev({detail:2}));A(ids()==='a1,a2,l1,l2','double-clic = chaîne : '+ids());skOffOpt.chain=true;",
    // aperçu sans écriture
    "const n0=S.entities.length,d0=S.dims.length,p0=Object.keys(S.points).length;",
    "const pv=skOffPreview(S);",
    "A(pv&&pv.parts.length===1&&pv.parts[0].ents.length===4,'aperçu : 4 copies attendues');",
    "A(S.entities.length===n0&&S.dims.length===d0&&Object.keys(S.points).length===p0,'l aperçu a écrit dans l esquisse');",
    "const rOf=pv=>pv.parts[0].ents.filter(e=>e.t==='arc').map(e=>e.r);",
    "step('aperçu 3 mm, rayons '+rOf(pv).join('/'));A(rOf(pv).every(r=>Math.abs(r-8)<1e-6),'côté proposé : extérieur (R8) attendu');",
    "skOffOpt.flip=true;skOffPv=null;const pvI=skOffPreview(S);A(rOf(pvI).every(r=>Math.abs(r-2)<1e-6),'Inverser : intérieur (R2) attendu, '+rOf(pvI).join('/'));",
    "skOffClick(S,0,-12,ev());A(skOffOpt.flip===false,'clic dehors : côté extérieur attendu');",
    "skOffClick(S,0,-3,ev());A(skOffOpt.flip===true,'clic dedans : côté intérieur attendu');",
    "A(ids()==='a1,a2,l1,l2','le clic de côté a changé la sélection');",
    // deux côtés, application
    "skOffOpt.both=true;skOffOpt.D=2;skOffApplyNow();",
    "const nw=S.entities.slice(n0);",
    "step('deux côtés : '+nw.map(e=>e.t+(e.r?e.r:'')).join(' '));",
    "A(nw.length===8,'deux côtés : 8 copies attendues, '+nw.length);",
    "A(nw.filter(e=>e.t==='arc').map(e=>e.r).sort().join()==='3,3,7,7','rayons 3 et 7 attendus');",
    "A(S.dims.filter(d=>d.type==='gap'&&d.value===2).length===2,'une cote de 2 mm par côté attendue');",
    "A(skTool==='offset'&&!skOffSelIds().length,'après OK : outil actif, sélection vide');",
    // référence en construction → copie normale
    "skOffOpt.both=false;skOffOpt.flip=false;skOffClick(S,0,36,ev());A(ids()==='k','cercle de construction non pris');",
    "const n1=S.entities.length;skOffApplyNow();const kc=S.entities.slice(n1);",
    "step('copie du cercle de construction : r='+(kc[0]&&kc[0].r)+' construction='+!!(kc[0]&&kc[0].construction));",
    "A(kc.length===1&&Math.abs(kc[0].r-8)<1e-6,'copie du cercle : R8 attendu');",
    "A(kc.length===1&&!kc[0].construction,'la copie est en construction');",
    "A(!S.entities.some(e=>e.id!=='k'&&e.construction),'une copie est en construction');",
    // Échap
    "skOffClick(S,30,0,ev());A(skOffEscape()===true&&!skOffSelIds().length,'Échap : la sélection n est pas vidée');",
    "A(skOffEscape()===false,'2e Échap : doit laisser la main (retour à Sélection)');",
    "if(out.fails.length){out.log.push('');out.log.push('ECHECS ('+out.fails.length+') :');out.fails.forEach(m=>out.log.push('  x '+m));}",
    "else out.log.push('TOUT EST CONFORME');",
    "return out.log.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+body+'})()',ctx,{filename:'skdecalage.js'});
  console.log('=== esquisse : outil Décalage (chaîne tangente, aperçu, inverser, deux côtés, jamais construction) ===');
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.message)||e).slice(0,600));process.exit(1);});
