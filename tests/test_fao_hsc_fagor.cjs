// FAO : usinage grande vitesse HSC du Fagor 8065 (G501 / G500), comme le post Fusion
// (« Use HSC high speed machining » + « Smoothing contouring acceleration »), réglé dans le posage.
// Pur logique (aucun OCCT).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    "const lignes=c=>c.split(String.fromCharCode(10)).map(l=>l.replace(/^N[0-9]+ /,''));",
    "const idx=(L,re,from)=>{for(let i=from||0;i<L.length;i++)if(re.test(L[i]))return i;return -1;};",
    "const nb=(c,re)=>(c.match(re)||[]).length;",
    // --- fiche machine : Automatique et 60 % par défaut
    "att(FAO_POSTS.fagor8065.hsc==='auto'&&FAO_POSTS.fagor8065.hscAccel===60,'fiche machine Fagor : hsc auto, accélération 60');",
    "att(JSON.stringify(faoHscReglage({},FAO_POSTS.fagor8065))==='{\"on\":true,\"accel\":60}','réglage absent : celui de la fiche machine');",
    "att(!faoHscReglage({hsc:'auto'},FAO_POSTS.siemens630).on,'Siemens : jamais de HSC Fagor');",
    "att(faoHscReglage({hscAccel:250},FAO_POSTS.fagor8065).accel===200&&faoHscReglage({hscAccel:10},FAO_POSTS.fagor8065).accel===30,'accélération bornée de 30 à 200 %');",
    // --- tolérance comme les défauts Fusion : E = tolérance × 1,2
    "const RH={on:true,accel:60};",
    "att(faoHscBloc(RH,{type:'contour'})==='G501 A60 E0.012 J100 M1','contour : G501 A60 E0.012 J100 M1 (vu '+faoHscBloc(RH,{type:'contour'})+')');",
    "att(faoHscBloc(RH,{type:'rough3d'})==='G501 A60 E0.12 J100 M1','ébauche 3D : E0.12');",
    "att(faoHscBloc(RH,{type:'pocket',strat:'adaptive'})==='G501 A60 E0.12 J100 M1'&&/E0\\.012 /.test(faoHscBloc(RH,{type:'pocket'})),'poche adaptative E0.12, poche classique E0.012');",
    "att(faoHscBloc(RH,{type:'drill'})===null&&faoHscBloc(RH,{type:'drill',cycle:'peck'})===null,'perçage en cycle : pas de HSC');",
    "att(/E0\\.012 /.test(faoHscBloc(RH,{type:'drill',cycle:'helix'})),'perçage en hélice (fraisage) : HSC');",
    "att(faoHscBloc({on:true,accel:72.5},{type:'facing'})==='G501 A72.5 E0.012 J100 M1','accélération 72,5 écrite A72.5');",
    "att(faoHscBloc({on:false,accel:60},{type:'facing'})===null,'Arrêt : aucune ligne');",
    // --- programme : surfaçage + poche (T1), contour (T2), perçage (T3)
    "const mk=function(){const j=faoDefaultJob();j.name='HSC';j.machine='fagor8065';j.stock={x0:0,y0:0,z0:0,x1:100,y1:80,z1:25};",
    "  j.ops=[{type:'facing',z:25,ae:6,toolId:'T1'},{type:'pocket',x0:10,y0:10,x1:90,y1:70,ztop:25,zbot:5,ap:10,ae:5,toolId:'T1'},",
    "    {type:'contour',x0:10,y0:10,x1:90,y1:70,ztop:5,zbot:0,ap:5,toolId:'T2'},{type:'drill',pts:[[20,20],[80,60]],ztop:25,zbot:5,toolId:'T3'}];return j;};",
    "const jA=mk();const cA=faoPost(jA).code, LA=lignes(cA);",
    "att(nb(cA,/G501 A60 E0\\.012 J100 M1/g)===2,'Automatique : un G501 par outil de fraisage (T1, T2), vu '+nb(cA,/G501/g));",
    "att(nb(cA,/\\nN[0-9]+ G500\\n/g)===2,'G500 avant les deux changements d’outil (T2, T3), vu '+nb(cA,/G500/g));",
    // ordre au 1er outil : broche, arrosage, G501, puis l'opération
    "const i1=idx(LA,/^G501 /),iS=idx(LA,/^S[0-9]+ M03$/),iC=idx(LA,/^\\( Surfa/);",
    "att(iS>=0&&iS<i1&&i1<iC&&LA[i1-1]==='M08','1er outil : S M03, M08, G501, puis l’opération ('+LA.slice(iS,iC+1).join(' | ')+')');",
    // changement d'outil : M09, G500, dégagement, outil, broche, arrosage, G501
    "const iT2=idx(LA,/^T2 D1 M06$/);",
    "att(LA[iT2-4]==='M09'&&LA[iT2-3]==='G500'&&/^G0 Z/.test(LA[iT2-2])&&/^\\( OUTIL T2/.test(LA[iT2-1]),'changement d’outil : M09, G500, G0 Z, outil T2 ('+LA.slice(iT2-4,iT2+1).join(' | ')+')');",
    "att(LA[iT2+3]==='G501 A60 E0.012 J100 M1'&&/^\\( Contour/.test(LA[iT2+4]),'T2 : G501 juste avant le contour');",
    // perçage : aucun G501, et plus de G500 à la fin (déjà coupé)
    "const iT3=idx(LA,/^T3 D1 M06$/);",
    "att(LA[iT3-3]==='G500'&&idx(LA,/^G501 /,iT3)<0,'perçage T3 : G500 avant, aucun G501 ensuite');",
    "att(idx(LA,/^G500$/,iT3)<0,'fin après un perçage : pas de second G500');",
    // rien d'autre ne change : sans les lignes G501 / G500, programme identique à « Arrêt »
    "const jO=mk();jO.hsc='off';const cO=faoPost(jO).code;",
    "att(!/G50[01]/.test(cO),'Arrêt : aucun G501 / G500');",
    "att(JSON.stringify(LA.filter(l=>!/^G50[01]( |$)/.test(l)))===JSON.stringify(lignes(cO)),'Automatique = Arrêt + les seules lignes G501 / G500');",
    // fin de programme sur une opération de fraisage : G500 avant M09
    "const jE=mk();jE.ops=jE.ops.slice(0,3);const LE=lignes(faoPost(jE).code);",
    "const iE=idx(LE,/^G500$/,idx(LE,/^T2 D1 M06$/));",
    "att(iE>0&&LE[iE+1]==='M09'&&LE[iE+2].indexOf('G0 Z')===0&&LE[iE+3]==='#MSG[\"\"]'&&LE[iE+4]==='M30','fin : G500, M09, G0 Z, #MSG, M30 ('+LE.slice(iE,iE+5).join(' | ')+')');",
    // accélération du posage
    "const jK=mk();jK.hscAccel=85;const cK=faoPost(jK).code;",
    "att(nb(cK,/G501 A85 E0\\.012 J100 M1/g)===2&&!/A60/.test(cK),'posage à 85 % : G501 A85');",
    // même outil : fraisage → perçage en cycle → fraisage = dégagement, G500 / G501
    "const jM=mk();jM.ops=[jM.ops[2],{type:'drill',pts:[[20,20],[80,60]],ztop:25,zbot:5,toolId:'T2'},Object.assign({},jM.ops[2],{zbot:1})];",
    "const LM=lignes(faoPost(jM).code);",
    "const iD=idx(LM,/^\\( Per/),iG5=idx(LM,/^G500$/);",
    "att(iG5>0&&iG5===iD-1&&/^G0 Z/.test(LM[iG5-1]),'même outil, puis perçage : dégagement, G500, perçage ('+LM.slice(iG5-1,iD+1).join(' | ')+')');",
    "const iR=idx(LM,/^G501 /,iD);",
    "att(iR>0&&/^G0 Z/.test(LM[iR-1])&&/^\\( Contour/.test(LM[iR+1])&&idx(LM,/^G80$/,iD)<iR,'retour au fraisage : dégagement, G501, contour');",
    "att(nb(LM.join('\\n'),/^G501 /gm)===2&&LM.filter(l=>l==='G500').length===2,'2 G501, 2 G500 (perçage, fin)');",
    // Siemens : inchangé
    "const jS=mk();jS.machine='siemens630';att(!/G50[01]/.test(faoPost(jS).code),'Siemens : aucun G501 / G500');",
    // document : valeurs inconnues retirées
    "const sx={ops:[],hsc:'peut-etre',hscAccel:-4};faoSanitiseOps(sx);",
    "att(sx.hsc===undefined&&sx.hscAccel===undefined,'valeurs inconnues retirées du posage');",
    "const sy={ops:[],hsc:'off',hscAccel:90};faoSanitiseOps(sy);",
    "att(sy.hsc==='off'&&sy.hscAccel===90,'valeurs valides gardées');",
    // fiche du posage
    "const ceHas=function(n,t){if(n.textContent&&n.textContent.indexOf(t)>=0)return true;const c=n.children||[];for(let i=0;i<c.length;i++)if(ceHas(c[i],t))return true;return false;};",
    "const st=faoSetup();const m0=st.machine;",
    "st.machine='fagor8065';const pF=document.createElement('div');faoSetupFiche(pF,st);",
    "att(ceHas(pF,'Usinage grande vitesse HSC')&&ceHas(pF,'Accélération de lissage')&&ceHas(pF,'G501 A60'),'fiche Fagor : HSC + accélération');",
    "st.hsc='off';const pO=document.createElement('div');faoSetupFiche(pO,st);",
    "att(ceHas(pO,'Usinage grande vitesse HSC')&&!ceHas(pO,'Accélération de lissage'),'fiche Fagor, Arrêt : accélération masquée');",
    "delete st.hsc;st.machine='siemens630';const pS=document.createElement('div');faoSetupFiche(pS,st);",
    "att(!ceHas(pS,'Usinage grande vitesse HSC'),'fiche Siemens : pas de réglage HSC');",
    "st.machine=m0;",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}",
    "else p('TOUT EST CONFORME');",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_hsc_fagor.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.message)||e).slice(0,500));process.exit(1);});
