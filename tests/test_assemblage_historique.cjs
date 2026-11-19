// V0.99.38 : historique de l'assemblage (48-assemblage-historique), modèle seul, sans noyau :
// étapes dans l'ordre de création (insertions, déplacements fusionnés, relations), marqueur
// (positions d'avant, pièce pas encore insérée masquée, relations retirées), l'état réel est
// enregistré même marqueur en arrière, retour en fin, Ctrl+Z, fichier, ancien fichier, suppression.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    confirm=function(){return true;};alert=function(){};
    const near=(a,b,t)=>Array.isArray(a)&&a.length===3&&a.every((x,i)=>Math.abs(x-b[i])<(t||1e-6));
    const V=(a,b,msg)=>att(near(a,b),msg+' : vu ['+(a||[]).map(x=>+(+x).toFixed(4)).join(', ')+'] attendu ['+b.join(', ')+']');
    const pl=(c,n)=>({k:'plane',c,n});
    docResetEmpty();doc.name='Montage';asmEnsure();
    const Rt=asmRoot();
    asmNewComp('Support');const oA=Rt.occ[0];oA.fixed=true;asmNotify();
    asmNewComp('Patin');const oB=Rt.occ[1];asmNotify();
    const ks=()=>asmHistOf(Rt).map(s=>s.k).join(',');
    att(ks()==='ins,ins','1 : deux insertions (vu '+ks()+')');
    // 2. déplacements à la main : une seule étape pour deux gestes à la suite
    const f0=JSON.parse(JSON.stringify(oB.fr));
    oB.fr=Object.assign({},oB.fr,{o:[30,0,40]});asmNotify();
    oB.fr=Object.assign({},oB.fr,{o:[30,5,40]});asmNotify();
    att(ks()==='ins,ins,move','2 : déplacements fusionnés (vu '+ks()+')');
    const mv=asmHistOf(Rt)[2];V(mv.fr0.o,f0.o,'2b : déplacement : position de départ');V(mv.fr1.o,[30,5,40],'2c : déplacement : arrivée');
    // 3. deux relations, chacune son étape
    const rel=(id,a,b)=>({id,t:'coinc',a:{path:[],f:a},b:{path:[oA.id],f:b},v:0,inv:false});
    oB.cons=[rel('r1',pl([0,0,0],[0,0,-1]),pl([0,0,10],[0,0,1]))];asmResolve();asmNotify();
    const zAfter1=oB.fr.o[2];
    oB.cons=oB.cons.concat([rel('r2',pl([0,0,0],[1,0,0]),pl([50,0,0],[-1,0,0]))]);asmResolve();asmNotify();
    att(ks()==='ins,ins,move,rel,rel','3 : deux relations (vu '+ks()+')');
    const final=JSON.parse(JSON.stringify(oB.fr));
    // 4. marqueur après la 1re relation : la 2e ne compte pas, la pièce repart d'où elle était
    asmHistSetPtr(4);
    att(oB.cons&&oB.cons.length===1,'4 : marqueur : une seule relation appliquée');
    att(Math.abs(oB.fr.o[2]-zAfter1)<1e-6,'4b : marqueur : posée par la 1re relation');
    att(!near(oB.fr.o,final.o),'4c : marqueur : pas la position finale');
    // 5. marqueur avant le déplacement : position d'insertion, aucune relation
    asmHistSetPtr(2);V(oB.fr.o,f0.o,'5 : marqueur avant le déplacement : position d’insertion');att(!oB.cons,'5b : aucune relation');
    // 6. marqueur avant l'insertion du patin : masqué
    asmHistSetPtr(1);att(oB.visible===false,'6 : marqueur avant l’insertion : pièce masquée');
    // 7. enregistrer marqueur en arrière : l'état réel part dans le fichier
    {const js=serialise();const o=JSON.parse(js);const all=JSON.stringify(o);
      att(all.indexOf('_histReal')<0,'7 : rien de transitoire dans le fichier');
      const oc=(o.asm?o.asm:o).comps?((o.asm||o).comps.find(c=>c.id===Rt.id).occ.find(q=>q.id===oB.id)):null;
      att(oc&&oc.cons&&oc.cons.length===2&&oc.visible!==false,'7b : fichier : la pièce réelle (2 relations, visible)');}
    // 8. retour en fin : tout revient
    asmHistSetPtr(null);
    att(oB.cons&&oB.cons.length===2&&oB.visible!==false,'8 : fin : relations rendues');V(oB.fr.o,final.o,'8b : fin : position finale');
    // 9. une modification en arrière revient d'abord en fin (asmPush)
    asmHistSetPtr(3);asmPush('test');att(!asmHistView&&oB.cons&&oB.cons.length===2,'9 : modification : marqueur remis en fin');
    // 10. retirer une relation : son étape part ; Ctrl+Z la rend
    oB.cons=oB.cons.slice(0,1);asmResolve();asmNotify();
    att(ks()==='ins,ins,move,rel','10 : relation retirée : étape retirée (vu '+ks()+')');
    asmUndo();att(ks()==='ins,ins,move,rel,rel','10b : Ctrl+Z : étape rendue (vu '+ks()+')');
    att(ks()==='ins,ins,move,rel,rel'&&asmHistOf(Rt).length===5,'10c : Ctrl+Z n’ajoute pas de déplacement');
    // 11. fichier
    const ids=asmHistOf(Rt).map(s=>s.id).join();
    const js=serialise();await deserialise(js,{rebuild:false});
    const Rt2=asmRoot();att(asmHistOf(Rt2).map(s=>s.id).join()===ids,'11 : fichier : historique relu à l’identique');
    // 12. ancien fichier (sans historique) : reconstruit dans l'ordre des pièces
    delete Rt2.hist;asmHistReset();
    att(asmHistOf(Rt2).map(s=>s.k).join()==='ins,ins,rel,rel','12 : ancien fichier : insertions puis relations (vu '+asmHistOf(Rt2).map(s=>s.k).join()+')');
    // 14. V0.99.40 : clic droit sur une étape → supprimer UNE relation, Ctrl+Z la rend
    {const R3=asmRoot(),q=R3.occ.find(x=>x.id===oB.id);const ksR=()=>asmHistOf(R3).map(s=>s.k).join(',');
      const sr=asmHistOf(R3).filter(s=>s.k==='rel');
      att(asmHistCanDel(R3,sr[1])&&!asmHistCanDel(R3,{k:'move',occ:q.id}),'14 : relation supprimable, déplacement non');
      att(asmHistDelete(R3,sr[1],true)===true,'14b : suppression faite');
      att(q.cons&&q.cons.length===1&&q.cons[0].id==='r1','14c : la 2e relation seule est partie');
      att(ksR()==='ins,ins,rel','14d : son étape aussi (vu '+ksR()+')');
      asmUndo();const q2=asmRoot().occ.find(x=>x.id===oB.id);
      att(q2.cons&&q2.cons.length===2&&ksR()==='ins,ins,rel,rel','14e : Ctrl+Z la rend (vu '+ksR()+')');
      asmHistSetPtr(1);asmHistDelete(asmRoot(),asmHistOf(asmRoot()).filter(s=>s.k==='rel')[0],true);
      att(!asmHistView,'14f : supprimer marqueur en arrière : marqueur remis en fin d’abord');
      asmUndo();}
    // 13. pièce supprimée : ses étapes partent
    asmHistDelete(asmRoot(),asmHistOf(asmRoot()).find(s=>s.k==='ins'&&s.occ===oB.id),true);asmNotify();
    att(asmHistOf(asmRoot()).map(s=>s.k).join()==='ins','13 : pièce supprimée : ses étapes retirées (vu '+asmHistOf(asmRoot()).map(s=>s.k).join()+')');
    // 15. V0.99.40 : couleurs d'un STEP multi-corps (relues du fichier, choisies pièce par pièce) : valeurs vérifiées
    {const O={nOcc:3};
      att(JSON.stringify(importOccColOf({occCol:{0:0xff0000,2:'x',5:0x00ff00,1:-3}},O))==='{"0":16711680}','15 : couleurs à la main : seules les valides restent');
      att(importOccColOf({},O)===null&&importOccColOf({occCol:{}},O)===null,'15b : aucune couleur à la main → null');
      att(importFileColOf({stepCol:[0xb0b0b0,-1,0x808080]},O)!==null,'15c : couleurs du fichier acceptées (-1 = sans couleur)');
      att(importFileColOf({stepCol:[1,2]},O)===null&&importFileColOf({stepCol:[1,2,0x1000000]},O)===null,'15d : longueur ou valeur fausse refusée');}
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'historique.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
