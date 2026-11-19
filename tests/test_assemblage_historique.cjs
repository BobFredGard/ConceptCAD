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
    // 13. pièce supprimée : ses étapes partent
    asmDeleteOcc(oB.id);asmNotify();
    att(asmHistOf(asmRoot()).map(s=>s.k).join()==='ins','13 : pièce supprimée : ses étapes retirées (vu '+asmHistOf(asmRoot()).map(s=>s.k).join()+')');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'historique.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
