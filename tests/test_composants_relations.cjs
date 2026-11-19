// V0.99.34 : relations entre faces (48-assemblage-relations), modèle seul, sans noyau : faces
// décrites par leur signature (type, centre, normale ou axe, rayon), plans des repères.
// Coïncidente plan / plan (vis-à-vis, décalage, affleurant), cylindre dans cylindre, tangente
// cylindre / plan et cylindre / cylindre, angle, parallèle, plan système d'un repère, degrés de
// liberté restants, la pièce suit sa cible, relations incompatibles (⚠), fichier, suppression
// de la cible, champs Distance / Angle du panneau.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};
    confirm=function(){return true;};alert=function(){};
    const near=(a,b,t)=>Array.isArray(a)&&a.length===3&&a.every((x,i)=>Math.abs(x-b[i])<(t||1e-6));
    const V=(a,b,msg,t)=>att(near(a,b,t),msg+' : vu ['+(a||[]).map(x=>+(+x).toFixed(5)).join(', ')+'] attendu ['+b.map(x=>+(+x).toFixed(5)).join(', ')+']');
    const N=(a,b,msg,t)=>att(Math.abs(a-b)<(t||1e-6),msg+' : vu '+(+a).toFixed(6)+' attendu '+b);
    const FR=(id,name,o,z,x)=>({id,kind:'frame',how:'zx',name,refs:[],p:{},at:null,visible:true,fr:{o,x:x||[1,0,0],y:asmV.cross(z||[0,0,1],x||[1,0,0]),z:z||[0,0,1]},st:'ok',msg:''});
    const pl=(c,n)=>({k:'plane',c,n});const cy=(c,n,r)=>({k:'cyl',c,n,r});
    docResetEmpty();doc.name='Montage';asmEnsure();
    const Rt=asmRoot();
    const A=asmNewComp('Support').comp,oA=Rt.occ[0];
    const B=asmNewComp('Patin').comp,oB=Rt.occ[1];
    oA.fixed=true;
    // B quelque part, tourné de 30° autour de X
    const c30=Math.cos(Math.PI/6),s30=Math.sin(Math.PI/6);
    oB.fr={o:[40,-20,30],x:[1,0,0],y:[0,c30,s30],z:[0,-s30,c30]};
    const W=(o,v)=>asmApply(o.fr,v),Wd=(o,v)=>asmRot(o.fr,v);
    const rel=(t,a,b,extra)=>Object.assign({id:uid('rl'),t,a:{path:[],f:a},b:{path:[oA.id],f:b},v:0,inv:false},extra||{});
    // 1. dessous du patin contre le dessus du support (vis-à-vis)
    oB.cons=[rel('coinc',pl([5,5,0],[0,0,-1]),pl([0,0,10],[0,0,1]))];
    asmResolve();
    V(Wd(oB,[0,0,-1]),[0,0,-1],'1 : coïncidente : la normale du dessous regarde vers le bas');
    N(W(oB,[5,5,0])[2],10,'1b : coïncidente : dessous à Z 10');
    att(oB.st==='ok','1c : relation satisfaite ('+oB.msg+')');
    att(oB._dof===3,'1d : face contre face : 3 degrés de liberté restants (vu '+oB._dof+')');
    const xy1=W(oB,[5,5,0]);
    // 2. décalage 2 mm
    oB.cons[0].v=2;asmResolve();
    N(W(oB,[5,5,0])[2],12,'2 : décalage 2 mm');
    V([W(oB,[5,5,0])[0],W(oB,[5,5,0])[1],0],[xy1[0],xy1[1],0],'2b : la pièce ne glisse pas dans le plan (mouvement minimal)',1e-5);
    // 3. Inverser : affleurant (mêmes sens)
    oB.cons[0].v=0;oB.cons[0].inv=true;asmResolve();
    V(Wd(oB,[0,0,-1]),[0,0,1],'3 : inverser : normales dans le même sens');N(W(oB,[5,5,0])[2],10,'3b : affleurant à Z 10');
    oB.cons[0].inv=false;asmResolve();
    // 4. + cylindre dans cylindre : le trou du patin sur la goupille du support
    oB.cons.push(rel('coinc',cy([5,5,5],[0,0,1],3),cy([20,0,15],[0,0,1],3),{sg:1}));
    asmResolve();
    const ax=W(oB,[5,5,5]);
    N(ax[0],20,'4 : concentrique : axe en X 20');N(ax[1],0,'4b : concentrique : axe en Y 0');
    N(W(oB,[5,5,0])[2],10,'4c : la face reste posée');
    att(oB._dof===1,'4d : face + axe : 1 degré de liberté (rotation autour de l axe) — vu '+oB._dof);
    // 5. la cible bouge : la pièce suit
    oA.fr={o:[0,0,7],x:[1,0,0],y:[0,1,0],z:[0,0,1]};asmResolve();
    N(W(oB,[5,5,0])[2],17,'5 : support monté de 7 : le patin suit');N(W(oB,[5,5,5])[0],20,'5b : axe suivi');
    oA.fr=asmFr0();asmResolve();
    // 6. incompatibles : deux plans opposés impossibles
    oB.cons.push(rel('coinc',pl([5,5,0],[0,0,-1]),pl([0,0,30],[0,0,1])));
    asmResolve();
    att(oB.st==='warn'&&/incompatibles/.test(oB.msg),'6 : relations incompatibles : ⚠ ('+oB.msg+')');
    oB.cons.pop();asmResolve();att(oB.st==='ok','6b : relation retirée : de nouveau satisfaite');
    // 7. tangente cylindre / plan
    const C=asmNewComp('Rouleau').comp,oC=Rt.occ[2];
    oC.fr={o:[0,50,40],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
    oC.cons=[{id:'t1',t:'tan',a:{path:[],f:cy([0,0,0],[0,1,0],5)},b:{path:[oA.id],f:pl([0,0,10],[0,0,1])},v:0,inv:false}];
    asmResolve();
    N(W(oC,[0,0,0])[2],15,'7 : tangente : axe à rayon au-dessus du plan (Z 15)');
    N(asmV.dot(Wd(oC,[0,1,0]),[0,0,1]),0,'7b : tangente : axe parallèle au plan');
    oC.cons[0].inv=true;asmResolve();N(W(oC,[0,0,0])[2],5,'7c : inverser : de l autre côté (Z 5)');
    // 8. tangente cylindre / cylindre (extérieur, intérieur)
    oC.cons=[{id:'t2',t:'tan',a:{path:[],f:cy([0,0,0],[0,1,0],5)},b:{path:[oA.id],f:cy([0,0,40],[0,1,0],8)},v:0,inv:false}];
    asmResolve();
    {const q=W(oC,[0,0,0]);N(Math.hypot(q[0],q[2]-40),13,'8 : tangente extérieure : entraxe 5 + 8');}
    oC.cons[0].inv=true;asmResolve();
    {const q=W(oC,[0,0,0]);N(Math.hypot(q[0],q[2]-40),3,'8b : tangente intérieure : entraxe 8 − 5');}
    // 9. angle de 45° entre deux faces
    oC.cons=[{id:'a1',t:'angle',a:{path:[],f:pl([0,0,0],[0,0,1])},b:{path:[oA.id],f:pl([0,0,10],[0,0,1])},v:45,inv:false}];
    oC.fr={o:[0,50,40],x:[1,0,0],y:[0,1,0],z:[0,0,1]};asmResolve();
    N(asmV.dot(Wd(oC,[0,0,1]),[0,0,1]),Math.cos(Math.PI/4),'9 : angle 45° (partant de faces parallèles)');
    // 10. parallèle
    oC.cons=[{id:'p1',t:'par',a:{path:[],f:pl([0,0,0],[1,0,0])},b:{path:[oA.id],f:pl([0,0,10],[0,0,1])},v:0,inv:false,sg:1}];
    asmResolve();V(Wd(oC,[1,0,0]),[0,0,1],'10 : parallèle : normales alignées');
    // 11. plan système d'un repère : le plan XZ de l'origine du rouleau sur le plan YZ d'un repère du support
    A.doc.cgeo.push(FR('fa','Repère A',[30,0,0]));
    oC.cons=[{id:'r1',t:'coinc',a:{path:[],pl:{cg:null,p:'XZ'}},b:{path:[oA.id],pl:{cg:'fa',p:'YZ'}},v:0,inv:false}];
    asmResolve();
    V(Wd(oC,[0,1,0]),[-1,0,0],'11 : plan de repère : normale Y du rouleau opposée au X du repère');
    N(W(oC,[0,0,0])[0],30,'11b : plan de repère : origine du rouleau dans le plan X = 30');
    // 12. fichier
    const js=serialise();await deserialise(js,{rebuild:false});
    const oB2=asmOcc(oB.id),oC2=asmOcc(oC.id);
    att(oB2&&oB2.cons&&oB2.cons.length===2&&oB2.cons[1].a.f.k==='cyl'&&oB2.cons[1].a.f.r===3,'12 : fichier : relations relues');
    att(oC2&&oC2.cons[0].b.pl&&oC2.cons[0].b.pl.cg==='fa'&&oC2.cons[0].b.pl.p==='YZ','12b : fichier : plan de repère relu');
    att(js.indexOf('_dof')<0,'12c : rien de transitoire dans le fichier');
    // 13. la cible supprimée : ses relations tombent, la pièce garde sa position
    const fr=JSON.stringify(oB2.fr);asmDeleteOcc(asmOcc(oA.id).id);
    att(!asmOcc(oB.id).cons,'13 : cible supprimée : relations retirées');
    att(JSON.stringify(asmOcc(oB.id).fr)===fr,'13b : la pièce garde sa position');
    // 14. champs Distance / Angle depuis la position de départ
    const oD=asmOcc(oB.id);oD.fixed=false;
    asmMoveRef=null;const M=asmMoveRefOf(oD),o0=oD.fr.o.slice();
    asmMoveBy(oD,0,12);V(oD.fr.o,[o0[0]+12,o0[1],o0[2]],'14 : Distance X 12');
    asmMoveBy(oD,5,90);N(M.v[5],90,'14b : Angle Z noté 90');V(oD.fr.o,[o0[0]+12,o0[1],o0[2]],'14c : rotation autour de l origine de la pièce');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'relations.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
