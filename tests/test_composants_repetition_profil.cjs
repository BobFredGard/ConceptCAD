// Répétition de composants SUIVANT UN PROFIL (48-assemblage-repetitions, type 'path', V0.30.0),
// modèle seul, sans noyau : courbe guide dans une esquisse du porteur (carré fermé de 320 mm,
// polyligne ouverte), source posée sur le départ, réparti / pas imposé, orientation fixe ou
// tangente, associativité (la courbe change, la source bouge), aller-retour du fichier, guide
// supprimé (instances laissées en place, message).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    confirm=function(){return true;};
    const near=(a,b,t)=>Array.isArray(a)&&a.length===3&&a.every((x,i)=>Math.abs(x-b[i])<(t||1e-7));
    const V=(a,b,msg)=>att(near(a,b),msg+' : vu ['+(a||[]).map(x=>+(+x).toFixed(6)).join(', ')+'] attendu ['+b.map(x=>+(+x).toFixed(6)).join(', ')+']');
    const base=id=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],constraints:[],dims:[],seq:20,visible:false});
    docResetEmpty();doc.name='Banc';
    doc.sketches=[Object.assign(base('skG'),{name:'Guide',points:{a:{x:10,y:10},b:{x:90,y:10},c:{x:90,y:90},d:{x:10,y:90}},
        entities:[{id:'g1',t:'line',p1:'a',p2:'b'},{id:'g2',t:'line',p1:'b',p2:'c'},{id:'g3',t:'line',p1:'c',p2:'d'},{id:'g4',t:'line',p1:'d',p2:'a'}]}),
      Object.assign(base('skO'),{name:'Ouvert',origin:[0,0,5],points:{a:{x:0,y:0},b:{x:60,y:0},m:{x:0,y:0}},
        entities:[{id:'o1',t:'line',p1:'a',p2:'b'}]})];
    asmEnsure();
    const Rt=asmRoot();
    const nv=asmNewComp('Goupille');const oV=nv.occ;
    oV.fr={o:[10,10,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
    const inst=pid=>Rt.occ.filter(o=>o.pat&&o.pat.id===pid);
    // ── fermée, 8 réparti ──
    const L1=asmPatNew(Rt,[oV.id],'path');
    att(L1.type==='path'&&L1.path.sk==='skO','type profil : la dernière esquisse guide est proposée — '+JSON.stringify(L1.path));
    L1.path={sk:'skG',pt:'a'};L1.copies=7;
    asmResolve();
    let I=inst(L1.id);
    att(I.length===7,'fermée, quantité 8 : 7 instances — vu '+I.length);
    const pos=()=>inst(L1.id).map(o=>o.fr.o.map(v=>Math.round(v*1e6)/1e6).slice(0,2).join(',')).join(' ');
    att(pos()==='50,10 90,10 90,50 90,90 50,90 10,90 10,50','pas 40, la dernière un pas avant le départ — '+pos());
    att(asmPatName(L1)==='Suivant un profil','nom du type « '+asmPatName(L1)+' »');
    const ids0=inst(L1.id).map(o=>o.id).join(',');
    // ── tangente : l'axe x des instances tourne avec la courbe ──
    L1.orient='tangent';asmResolve();
    I=inst(L1.id);
    V(I[2].fr.x,[0,1,0],'tangente : 3e instance (côté montant) tournée de 90°');
    V(I[4].fr.x,[-1,0,0],'tangente : 5e instance (côté haut) tournée de 180°');
    V(I[2].fr.o,[90,50,0],'tangente : la position ne change pas');
    att(inst(L1.id).map(o=>o.id).join(',')===ids0,'identifiants des instances stables');
    L1.orient='fixed';
    // ── la source bouge (décalée en Z) : les instances suivent ──
    oV.fr={o:[10,10,7],x:[1,0,0],y:[0,1,0],z:[0,0,1]};asmResolve();
    V(inst(L1.id)[1].fr.o,[90,10,7],'source décalée en Z : instances décalées d’autant');
    oV.fr={o:[10,10,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
    // ── la courbe guide change (rectangle 80 × 40) ──
    const G=doc.sketches.find(s=>s.id==='skG');G.points.c.y=50;G.points.d.y=50;asmResolve();
    att(pos()==='40,10 70,10 90,20 90,50 60,50 30,50 10,40','guide raccourci à 240 mm : pas 30 — '+pos());
    // ── ouverte + pas imposé ──
    const L2=asmPatNew(Rt,[oV.id],'path');L2.path={sk:'skO',pt:'a'};L2.copies=3;L2.pspace='pitch';L2.dist=25;
    oV.fr={o:[0,0,5],x:[1,0,0],y:[0,1,0],z:[0,0,1]};asmResolve();
    const p2=inst(L2.id).map(o=>o.fr.o[0]).join(',');
    att(p2==='25,50','ouverte, pas 25, quantité 4 sur 60 mm : 2 instances (la 4e au-delà) — vu '+p2);
    att(/au-delà/.test(asmPatPlan(Rt,L2).warn),'avertissement « au-delà de l’extrémité »');
    // ── aller-retour du fichier ──
    const S=serialise(false);
    const back=JSON.parse(S);
    const pats=((back.asm&&back.asm.comps)||[]).map(c=>c.pats).filter(Boolean)[0]||[];
    const q1=pats.find(q=>q.id===L1.id);
    att(q1&&q1.type==='path'&&q1.path.sk==='skG'&&q1.path.pt==='a'&&q1.pspace==='fit'&&q1.orient==='fixed','fichier : réglages du profil enregistrés — '+JSON.stringify(q1&&{type:q1.type,path:q1.path,pspace:q1.pspace,orient:q1.orient}));
    const nn=asmPatNorm(pats);
    att(nn&&nn.find(q=>q.id===L2.id).pspace==='pitch'&&nn.find(q=>q.id===L2.id).dist===25,'relecture (asmPatNorm) : pas imposé gardé');
    // ── départ choisi à la souris (V0.30.1, 41-profil-choix-point) ──
    const C=pgPickCands(doc);
    att(C.some(c=>c.sk.id==='skG'&&c.v.pt==='a')&&C.some(c=>c.sk.id==='skO'&&c.v.pt==='b')&&C.every(c=>Array.isArray(c.w)&&c.w.length===3),'souris : points proposés de toutes les esquisses guides, en 3D — '+C.length);
    const oo=C.find(c=>c.sk.id==='skO'&&c.v.pt==='b');
    att(oo&&near(oo.w,[60,0,5]),'souris : point placé avec le repère de l’esquisse (origine z = 5)');
    // vue de dessus 200 × 200 px : x écran = (x + 100) · 1, y écran = (100 − y) · 1
    const proj=w=>[w[0]/100,w[1]/100,0];
    const hit=pgPickNear(C,100+90+6,100-50-5,200,200,proj);
    att(hit&&hit.sk.id==='skG'&&JSON.stringify(hit.v)===JSON.stringify({pt:'c'}),'souris : clic à 8 px du coin (90, 50) → ce sommet — '+JSON.stringify(hit&&hit.v));
    att(!pgPickNear(C,100+70,100-30,200,200,proj),'souris : clic loin de tout point → rien');
    let got=null;
    att(pgPickStart(doc,p=>{got=p;})&&pgPick&&pgPick.cands.length===C.length,'souris : mode de choix actif');
    pgPick.onPick(Object.assign({sk:hit.sk.id},hit.v));pgPickStop();
    att(got&&got.sk==='skG'&&got.pt==='c'&&!pgPick,'souris : départ rendu {sk, pt}, mode refermé — '+JSON.stringify(got));
    // ── guide supprimé : instances laissées en place, message ──
    doc.sketches=doc.sketches.filter(s=>s.id!=='skG');asmResolve();
    att(inst(L1.id).length===7&&L1.st==='warn'&&/esquisse guide introuvable/.test(L1.msg),'guide supprimé : instances gardées, ⚠ « '+L1.msg+' »');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'repetition_profil.js'});
  console.log('=== Répétition de composants suivant un profil ===');
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
