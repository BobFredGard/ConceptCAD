// V0.99.76 — FAO : ordre d'usinage par outil (demande de Fred : « Au moment de visualiser
// l'usinage et de générer le G-Code, il faudrait pouvoir choisir de faire les outils dans
// l'ordre, en respectant les répétitions »). Réglage du posage setup.toolOrder : absent =
// ordre de la liste, 'tool' = par outil (ordre d'apparition), 'num' = par numéro d'outil.
// Séquence, aperçu / ▶ Usinage (faoSeqSafe), G-code, temps (groupes d'outil), brut restant.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const out=await vm.runInContext(`(async function(){
    const P=[]; const A=(ok,m)=>P.push((ok?'OK   ':'ECHEC')+' : '+m);
    const s=faoDefaultSetup(); s.id='sO'; s.name='PO';
    s.stock={x0:0,y0:0,z0:0,x1:100,y1:80,z1:25};
    s.tools=[{id:'T1',num:1,name:'Foret D5',kind:'drill',d:5,flutes:2,vc:60,fz:0.05},
             {id:'T2',num:2,name:'Fraise D10',kind:'flat',d:10,cornerR:0,flutes:2,vc:250,fz:0.06}];
    const dr=(id,t,x,y)=>({id:id,on:true,toolId:t,type:'drill',src:'xy',pts:[[x,y]],cycle:'drill',ztop:25,zbot:15,depthMode:'full'});
    const a={id:'a',on:true,toolId:'T2',type:'facing',z:25,ae:6,np:0};
    const b=dr('b','T1',10,10), c=dr('c','T2',20,20), e=dr('e','T1',50,50);
    const pat=faoPatternDefaults(s); pat.id='p'; pat.srcs=['b','c']; pat.kind='rect'; pat.nx=2; pat.dx=30; pat.ny=1;
    s.ops=[a,b,c,pat,e];
    doc.fao={setups:[s],activeSetupId:'sO'};
    faoRoot();
    const ids=Q=>Q.map(E=>E.op.id+(E.xf?"'":'')).join();

    /* 1. ordre de la liste : inchangé (répétition par opération, à sa place) */
    let Q=faoOpsSeq(s);
    A(faoToolOrder(s)==='list'&&s.toolOrder===undefined,'défaut : ordre de la liste, aucun champ');
    A(ids(Q)==="a,b,b',c,c',e",'liste : a, b ×2, c ×2, e ('+ids(Q)+')');
    A(faoToolChanges(Q,s)===4,'liste : 4 groupes d’outil ('+faoToolChanges(Q,s)+')');

    /* 2. par outil, ordre d'apparition : T2 (1re op) puis T1 ; copies à la suite */
    s.toolOrder='tool'; faoRoot();
    Q=faoOpsSeq(s);
    A(ids(Q)==="a,c,c',b,b',e",'par outil : a, c ×2, puis b ×2, e ('+ids(Q)+')');
    A(faoToolChanges(Q,s)===2,'par outil : 2 groupes, 1 changement d’outil');
    A(Q[1].xf===null&&Q[2].xf&&Math.abs(Q[2].xf.tx-30)<1e-9,'répétition respectée : original puis copie décalée de 30');
    A(faoOrderSummary(s)==='T2 (1, 3 ×2) → T1 (2 ×2, 5)','résumé : '+faoOrderSummary(s));

    /* 3. par numéro d'outil : T1 d'abord */
    s.toolOrder='num'; faoRoot();
    Q=faoOpsSeq(s);
    A(ids(Q)==="b,b',e,a,c,c'",'par numéro : b ×2, e, puis a, c ×2 ('+ids(Q)+')');
    // numéro modifié : T2 devient T0 → passe en tête
    s.tools[1].num=0; faoRoot();
    A(ids(faoOpsSeq(s))==="a,c,c',b,b',e",'numéro modifié (T0) : la fraise passe en tête ('+ids(faoOpsSeq(s))+')');
    s.tools[1].num=2;

    /* 4. aperçu / ▶ Usinage : faoSeqSafe et le dessin de la simulation suivent l'ordre */
    s.toolOrder='tool'; faoRoot();
    const S=faoSeqSafe(s);
    A(S.map(x=>x.op.id).join()==='a,c,c,b,b,e','faoSeqSafe : même ordre ('+S.map(x=>x.op.id).join()+')');
    const vb=faoViewerBuild(s);
    A(vb&&vb.pts&&vb.pts.length>0,'simulation construite ('+(vb&&vb.pts?vb.pts.length:0)+' points)');
    const G=faoJobMoves(s);
    A(G.length===2&&G[0].tool.id==='T2'&&G[1].tool.id==='T1','groupes du G-code : T2 puis T1 ('+G.map(g=>g.tool.id).join()+')');

    /* 5. G-code : deux outils seulement, T2 d'abord, trous et copies présents */
    let g=faoPost(s).code;
    const tc=g.split('\\n').filter(l=>/OUTIL T\\d/.test(l));
    A(tc.length===2&&/OUTIL T2/.test(tc[0])&&/OUTIL T1/.test(tc[1]),'G-code : 2 outils, T2 puis T1 ('+tc.length+')');
    A(/X20\\.000 Y20\\.000/.test(g)&&/X50\\.000 Y20\\.000/.test(g)&&/X10\\.000 Y10\\.000/.test(g)&&/X40\\.000 Y10\\.000/.test(g)&&/X50\\.000 Y50\\.000/.test(g),
      'G-code : tous les trous, copies comprises');
    const iC=g.indexOf('X20.000 Y20.000'), iB=g.indexOf('X10.000 Y10.000');
    A(iC>0&&iB>iC,'G-code : le perçage T2 (c) avant le perçage T1 (b)');
    s.toolOrder=undefined; faoRoot();
    g=faoPost(s).code;
    A(g.split('\\n').filter(l=>/OUTIL T\\d/.test(l)).length===4,'ordre de la liste : 4 groupes d’outil dans le G-code');

    /* 6. temps estimé : changements d'outil comptés sur la séquence réelle */
    A(faoStatsGroups(s)===4,'stats liste : 4 groupes ('+faoStatsGroups(s)+')');
    s.toolOrder='tool';
    A(faoStatsGroups(s)===2,'stats par outil : 2 groupes ('+faoStatsGroups(s)+')');

    /* 7. brut restant : ce qui est VRAIMENT usiné avant */
    s.toolOrder=undefined; faoRoot();
    A(ids(faoRestPrev(s,c))==='a','liste : avant c = a (règle d’avant, inchangée)');
    s.toolOrder='num'; faoRoot();
    A(ids(faoRestPrev(s,c))==="b,b',e,a",'par numéro : avant c = b ×2, e, a ('+ids(faoRestPrev(s,c))+')');
    A(ids(faoRestPrev(s,a))==="b,b',e",'par numéro : avant a = b ×2, e');
    // opération désactivée (hors séquence) : règle de la liste
    e.on=false; faoRoot();
    A(faoRestPrev(s,e).length===5,'désactivée : tout ce qui est au-dessus dans la liste ('+faoRestPrev(s,e).length+')');
    e.on=true; faoRoot();
    let d0=null,d1=null;
    try{ s.toolOrder=undefined; faoRoot(); d0=JSON.stringify(faoRestDep(c,s)); s.toolOrder='num'; faoRoot(); d1=JSON.stringify(faoRestDep(c,s)); }catch(x){}
    A(d0&&d1&&d0!==d1,'clé de la reprise : change avec l’ordre (reprise à régénérer)');

    /* 8. réglage : nettoyé à la lecture, enregistré tel quel */
    s.toolOrder='n’importe'; faoRoot();
    A(s.toolOrder===undefined&&faoToolOrder(s)==='list','valeur inconnue retirée');
    s.toolOrder='num'; faoRoot();
    A(s.toolOrder==='num','par numéro gardé');
    const back=JSON.parse(JSON.stringify(doc.fao)); doc.fao=back; faoRoot();
    A(faoSetup('sO').toolOrder==='num'&&ids(faoOpsSeq(faoSetup('sO')))==="b,b',e,a,c,c'",'enregistré puis relu : même ordre');

    /* 9. fiche du posage : liste et ordre réel */
    const s2=faoSetup('sO'); s2.toolOrder='tool'; faoRoot();
    const pn=document.createElement('div'); pn.children=[];
    faoOrderRows(pn,s2);
    const txt=pn.children.map(n=>n.textContent||'').join(' | ');
    A(/Ordre réel : T2 \\(1, 3 ×2\\) → T1 \\(2 ×2, 5\\) — 1 changement d’outil au lieu de 3/.test(txt),'fiche : ordre réel et gain ('+txt.slice(0,160)+')');
    A(/changent de place/.test(txt),'fiche : avertissement quand des opérations changent de place');

    /* 10. répétitions imbriquées : copies composées toujours à la suite */
    const t=faoDefaultSetup(); t.id='sN'; t.name='PN';
    t.stock={x0:0,y0:0,z0:0,x1:200,y1:200,z1:25};
    t.tools=s.tools.map(x=>Object.assign({},x));
    const n1=dr('n1','T2',10,10), n2=dr('n2','T1',10,20);
    const q1=faoPatternDefaults(t); q1.id='q1'; q1.kind='rect'; q1.nx=2; q1.dx=20; q1.ny=1; q1.srcs=['n1','n2'];
    const q2=faoPatternDefaults(t); q2.id='q2'; q2.kind='rect'; q2.nx=1; q2.ny=2; q2.dy=50; q2.srcs=['q1'];
    t.ops=[n1,n2,q1,q2]; t.toolOrder='num';
    doc.fao.setups.push(t); faoRoot();
    Q=faoOpsSeq(t);
    A(Q.map(E=>E.op.id).join()==='n2,n2,n2,n2,n1,n1,n1,n1','imbriquées par numéro : 4 copies de n2 puis 4 de n1 ('+Q.map(E=>E.op.id).join()+')');

    /* 11. l'ordre ne périme aucun parcours propre : clé d'une opération inchangée */
    const s3=faoSetup('sO');
    s3.toolOrder=undefined; faoRoot(); const k0=faoOpMovesKey(s3.ops[0],s3);
    s3.toolOrder='num'; faoRoot(); const k1=faoOpMovesKey(s3.ops[0],s3);
    A(k0&&k0===k1,'clé du surfaçage identique quel que soit l’ordre');

    /* 12. finition : entrée en hélice seulement si l'ébauche passe vraiment avant */
    const u=faoDefaultSetup(); u.id='sU'; u.name='PU';
    u.stock={x0:0,y0:0,z0:0,x1:100,y1:80,z1:25};
    u.tools=s.tools.map(x=>Object.assign({},x));
    const r3={id:'r3',on:true,toolId:'T2',type:'rough3d',ap:2,ae:5,ztop:25,zbot:0};
    const g3={id:'g3',on:true,toolId:'T1',type:'geofinish',step:1,ztop:25,zbot:0};
    u.ops=[r3,g3]; doc.fao.setups.push(u); faoRoot();
    A(faoGeoHasRrough(u,g3)===true,'liste : ébauche avant la finition');
    u.toolOrder='tool'; faoRoot();
    A(faoGeoHasRrough(u,g3)===true,'par outil : l’ébauche reste avant');
    u.toolOrder='num'; faoRoot();
    A(faoOpsSeq(u).map(E=>E.op.id).join()==='g3,r3'&&faoGeoHasRrough(u,g3)===false&&faoGeoHasRroughListe(u,g3)===true,
      'par numéro : finition T1 avant l’ébauche T2 → pas d’hélice (rampe)');

    /* 13. V0.99.77 — temps estimé : chaque copie d'une répétition comptée */
    const s4=faoSetup('sO'); s4.toolOrder=undefined; doc.fao.activeSetupId='sO'; faoRoot();
    faoPost(s4); // parcours en mémoire
    const st=faoStats(s4);
    let cutAtt=0;
    faoOpsSeq(s4).forEach(E=>{ const sf=faoOpCutting(E.op,s4); cutAtt+=faoEstimate(faoMovesStat(E.op,s4),sf.f,sf.rapid,faoAccel(s4)).cut; });
    A(st.n===4&&st.copies===6,'stats : 4 opérations, 6 passages avec les copies ('+st.n+', '+st.copies+')');
    A(cutAtt>0&&Math.abs(st.cut-cutAtt)<1e-6,'stats : coupe de toutes les copies ('+st.cut.toFixed(1)+' / '+cutAtt.toFixed(1)+')');
    A(/^4 op \\(6 avec les répétitions\\) · coupe/.test(faoStatsText()),'texte : « '+faoStatsText().slice(0,50)+' »');
    const pq=s4.ops.filter(o=>o.type==='pattern')[0]; pq.on=false; faoRoot();
    const st2=faoStats(s4);
    A(st2.copies===4&&st2.cut<st.cut,'répétition désactivée : 4 passages, moins de coupe');
    A(/^4 op · coupe/.test(faoStatsText()),'texte sans répétition : « '+faoStatsText().slice(0,30)+' »');
    pq.on=true; faoRoot();

    const bad=P.filter(function(x){return x.indexOf('ECHEC')===0;});
    if(bad.length){P.push('');P.push('ECHECS ('+bad.length+') :');bad.forEach(function(m){P.push('  x '+m);});}
    else P.push('TOUT EST CONFORME');
    return P.join('\\n');
  })()`,ctx);
  console.log(out);
  process.exit(/ECHECS/.test(out)?1:0);
})().catch(e=>{console.error('FATAL',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
