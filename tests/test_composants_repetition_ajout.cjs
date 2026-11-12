// Répétition de composants (V0.95.4) : plusieurs composants dans une même répétition, ajoutés ou
// retirés pendant l'édition — clic sur une occurrence (asmSelClick → asmPatToggleSrc), ✕ du
// panneau ; la dernière source ne part pas ; une instance ne devient pas source ; une seule étape
// d'annulation pour l'édition ; Annuler revient aux sources d'avant.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    confirm=function(){return true;};
    docResetEmpty();doc.name='Banc';
    asmEnsure();
    const Rt=asmRoot();
    const a=asmNewComp('Vis'),b=asmNewComp('Écrou'),c=asmNewComp('Rondelle');
    a.occ.fr={o:[0,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
    b.occ.fr={o:[0,10,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
    c.occ.fr={o:[0,20,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
    asmMode='asm';
    att(asmActiveComp()===Rt,'composant actif = racine');
    const inst=pid=>Rt.occ.filter(o=>o.pat&&o.pat.id===pid);
    const pat=asmPatStart([a.occ.id],'lin');
    att(!!pat&&asmPatEd,'répétition ouverte');
    pat.copies=2;pat.dist=30;asmResolve();
    att(inst(pat.id).length===2,'1 source : 2 instances — vu '+inst(pat.id).length);
    const nUndo=asmUndoStack.length;
    // clic simple sur une autre occurrence : ajoutée à la répétition
    att(asmSelClick(b.occ.id,{})===true,'clic consommé par la répétition ouverte');
    att(pat.src.length===2&&pat.src[1]===b.occ.id,'Écrou ajouté aux sources');
    let I=inst(pat.id);
    att(I.length===4,'2 sources : 4 instances — vu '+I.length);
    att(I.some(o=>o.comp===b.comp.id&&Math.abs(o.fr.o[0]-30)<1e-9&&Math.abs(o.fr.o[1]-10)<1e-9),'instance de l écrou en [30,10,0]');
    att(asmLotIds().length===2,'les sources sont en surbrillance');
    // un 3e
    asmSelClick(c.occ.id,{ctrlKey:true});
    att(pat.src.length===3&&inst(pat.id).length===6,'3 sources : 6 instances');
    // une instance ne devient pas source
    const i0=inst(pat.id)[0];
    asmSelClick(i0.id,{});
    att(pat.src.length===3,'instance cliquée : pas ajoutée');
    // retirer (✕ ou clic)
    asmPatToggleSrc(a.occ.id);
    att(pat.src.join(',')===[b.occ.id,c.occ.id].join(',')&&inst(pat.id).length===4,'Vis retirée : 4 instances');
    att(!inst(pat.id).some(o=>o.comp===a.comp.id),'plus d instance de la vis');
    asmPatToggleSrc(b.occ.id);
    asmPatToggleSrc(c.occ.id);
    att(pat.src.length===1&&pat.src[0]===c.occ.id,'la dernière source reste');
    att(asmUndoStack.length===nUndo,'une seule étape d annulation pour l édition');
    asmPatToggleSrc(a.occ.id);
    asmPatOk();
    att(!asmPatEd,'OK : fermée');
    att(asmSelClick(b.occ.id,{})===false,'répétition fermée : clic simple = sélection ordinaire');
    // réouverture puis Annuler : sources d'avant
    asmPatEdit(Rt.id,pat.id);
    att(asmLotIds().length===2,'réouverte : sources en surbrillance');
    asmSelClick(b.occ.id,{});
    att(pat.src.length===3,'réouverte : Écrou ajouté');
    asmPatCancel();
    const pp=(Rt.pats||[]).find(q=>q.id===pat.id);
    att(pp&&pp.src.length===2&&inst(pat.id).length===4,'Annuler : retour aux 2 sources');
    // fichier : relu avec ses sources
    const t=serialise(false);
    att(JSON.parse(t).asm,'enregistré');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'repetition-ajout.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
