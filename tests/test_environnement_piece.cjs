// Chaque pièce est enregistrée avec son environnement (98-rendu-vue), sans noyau :
//   1 l'environnement à l'écran part dans le fichier et revient à l'ouverture
//   2 ancien fichier sans environnement : celui de l'écran reste
//   3 valeur abîmée ou étrangère dans un fichier : écartée
//   4 assemblage : chaque composant retrouve le sien, y compris après enregistrement et réouverture
//   5 changer d'environnement : brouillon à écrire, mais ni étape d'annulation ni rejeu
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    (async()=>{
    const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};
    const regle=(v,sol,amb,sup)=>{vEnvDocApply(vEnvNorm({v,sol,miroir:sol,ombre:!sol,rd:{amb,support:sup,fc1:'#112233'}}));};
    docResetEmpty();doc.name='Pièce A';
    // 1
    regle('atelier',false,'exterieur','');
    let txt=serialise(false),o=JSON.parse(txt);
    att(o.env&&o.env.v==='atelier'&&o.env.sol===false&&o.env.rd.amb==='exterieur','1 : environnement dans le fichier');
    att(o.env&&o.env.rd.focale===undefined&&o.env.rd.ech===undefined,'1 : ni appareil photo ni qualité d’image dans l’environnement');
    regle('studio',true,'clair','');
    await deserialise(txt,{rebuild:false});
    att(vEnv==='atelier'&&floorOn===false&&mirrorOn===false&&vShadowOn===true,'1 : ambiance, sol, miroir et ombre remis à l’ouverture');
    att(vEnvCollect().rd.amb==='exterieur'&&vEnvCollect().rd.fc1==='#112233','1 : réglages de rendu remis à l’ouverture');
    // 2
    const ancien=JSON.parse(txt);delete ancien.env;
    regle('noir',true,'noir','');
    await deserialise(JSON.stringify(ancien),{rebuild:false});
    att(vEnv==='noir'&&floorOn===true,'2 : ancien fichier : l’environnement de l’écran reste');
    // 3
    const n=vEnvNorm({v:'inconnu',rd:{amb:'studio',focale:85,fc1:{x:1}}});
    att(n.v==='actuel'&&n.rd.amb==='studio'&&n.rd.focale===undefined&&n.rd.fc1===undefined,'3 : valeurs étrangères écartées');
    att(vEnvNorm('abc')===null&&vEnvNorm(null)===null&&vEnvNorm([1])===null,'3 : environnement illisible ignoré');
    // 4
    docResetEmpty();doc.name='Racine';
    regle('atelier',true,'atelier','');
    asmEnsure();
    const rootId=asm.active,A=asmNewComp('Comp A');
    if(!A)att(false,'4 : composant non créé');
    else{
      const idA=A.comp.id;
      asmActivate(idA);
      regle('exterieur',false,'exterieur','');
      asmActivate(rootId);
      att(vEnv==='atelier'&&floorOn===true,'4 : retour à la racine : son environnement');
      asmActivate(idA);
      att(vEnv==='exterieur'&&floorOn===false,'4 : retour au composant : le sien');
      asmActivate(rootId);
      const t=serialise(false),s=JSON.parse(t);
      const cA=s.asm&&s.asm.comps.find(c=>c.id===idA);
      att(s.env.v==='atelier'&&cA&&cA.doc&&cA.doc.env&&cA.doc.env.v==='exterieur','4 : chaque composant a le sien dans le fichier');
      regle('noir',true,'noir','');
      await deserialise(t,{rebuild:false});
      att(vEnv==='atelier','4 : réouverture : celui de la pièce active');
      asmActivate(idA);
      att(vEnv==='exterieur','4 : réouverture : le composant retrouve le sien');
    }
    // 5
    docResetEmpty();doc.name='Annuler';
    regle('studio',true,'studio','');
    docUndoStack.length=0;docRedoStack.length=0;docBaseSync();
    dirty=false;const ver=_docVersion;
    vEnvSet('clair');
    att(dirty===true,'5 : réglage changé : brouillon à écrire');
    docCheckpoint();
    att(docUndoStack.length===0,'5 : pas d’étape d’annulation');
    att(_docVersion===ver,'5 : pas de rejeu');
    dirty=false;vEnvSet('clair');
    att(dirty===false,'5 : même réglage : rien à écrire');
    return {ATT,OK};
    })()`;
  const res=await vm.runInContext(R,ctx);
  res.OK.forEach(m=>console.log('  ok  '+m));
  res.ATT.forEach(m=>console.log('  KO  '+m));
  console.log(res.ATT.length?'ÉCHEC : '+res.ATT.length+' contrôle(s)':'OK : '+res.OK.length+' contrôles');
  process.exit(res.ATT.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
