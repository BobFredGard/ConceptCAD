// V0.99.41 : relations sur des ARÊTES et des SOMMETS (48-assemblage-relations), modèle seul, sans
// noyau : arête droite (axe sans rayon), arête circulaire (centre + axe), sommet (point) décrits par
// leur signature. Point sur point, point dans un plan, point sur une arête, cercle sur cercle,
// arête droite dans un plan, cercle dans un plan, fichier, types permis, arête et sommet retrouvés
// après un changement du composant (asmConsFindEdge / asmConsFindVert), arêtes relevées sans noyau.
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
    docResetEmpty();doc.name='Montage';asmEnsure();
    const Rt=asmRoot();
    asmNewComp('Support');const oA=Rt.occ[0];
    asmNewComp('Patin');const oB=Rt.occ[1];
    oA.fixed=true;
    const c30=Math.cos(Math.PI/6),s30=Math.sin(Math.PI/6);
    const start={o:[40,-20,30],x:[1,0,0],y:[0,c30,s30],z:[0,-s30,c30]};
    const W=(o,v)=>asmApply(o.fr,v),Wd=(o,v)=>asmRot(o.fr,v);
    const rel=(t,a,b,extra)=>Object.assign({id:uid('rl'),t,a:Object.assign({path:[]},a),b:Object.assign({path:[oA.id]},b),v:0,inv:false},extra||{});
    const line=(m,d)=>({e:{k:'line',m,d}}),circ=(c,n,r)=>({e:{k:'circ',c,n,r}}),pt=v=>({v}),pl=(c,n)=>({f:{k:'plane',c,n}});
    const go=L=>{oB.fr=JSON.parse(JSON.stringify(start));oB.cons=L;asmResolve();};
    // 1. sommet sur sommet : le coin du patin sur le coin du support
    go([rel('coinc',pt([0,0,0]),pt([10,20,30]))]);
    V(W(oB,[0,0,0]),[10,20,30],'1 : sommet sur sommet');
    att(oB.st==='ok','1b : satisfaite ('+oB.msg+')');
    att(oB._dof===3,'1c : point sur point : 3 rotations libres (vu '+oB._dof+')');
    // 2. sommet dans un plan (décalage 2)
    go([rel('coinc',pt([0,0,0]),pl([0,0,10],[0,0,1]),{v:2})]);
    N(W(oB,[0,0,0])[2],12,'2 : sommet dans le plan, décalage 2');
    att(oB._dof===5,'2b : point dans un plan : 5 degrés libres (vu '+oB._dof+')');
    // 3. sommet sur une arête droite
    go([rel('coinc',pt([0,0,0]),line([0,5,0],[0,0,1]))]);
    const q3=W(oB,[0,0,0]);N(q3[0],0,'3 : sommet sur l’arête : X');N(q3[1],5,'3b : sommet sur l’arête : Y');
    att(oB._dof===4,'3c : point sur une droite : 4 degrés libres (vu '+oB._dof+')');
    // 4. cercle sur cercle : concentriques et dans le même plan
    go([rel('coinc',circ([0,0,0],[0,0,1],5),circ([50,0,10],[0,0,1],5),{sg:1})]);
    V(W(oB,[0,0,0]),[50,0,10],'4 : cercle sur cercle : centres confondus',1e-5);
    V(Wd(oB,[0,0,1]),[0,0,1],'4b : cercle sur cercle : axes alignés',1e-5);
    att(oB._dof===1,'4c : cercle sur cercle : rotation autour de l’axe seule (vu '+oB._dof+')');
    // 5. arête droite dans un plan, puis cercle dans un plan
    go([rel('coinc',line([0,0,0],[1,0,0]),pl([0,0,7],[0,0,1]))]);
    N(W(oB,[0,0,0])[2],7,'5 : arête dans le plan : Z');N(Wd(oB,[1,0,0])[2],0,'5b : arête parallèle au plan');
    go([rel('coinc',circ([0,0,0],[0,0,1],5),pl([0,0,-4],[0,0,1]))]);
    N(W(oB,[0,0,0])[2],-4,'5c : cercle dans le plan : Z');N(Math.abs(Wd(oB,[0,0,1])[2]),1,'5d : cercle dans le plan : axe ⟂ au plan',1e-5);
    // 6. arête droite sur arête droite (colinéaires) + sommet sur sommet
    go([rel('coinc',line([0,0,0],[1,0,0]),line([0,0,20],[0,1,0]),{sg:1}),rel('coinc',pt([0,0,0]),pt([0,3,20]))]);
    V(W(oB,[0,0,0]),[0,3,20],'6 : arête sur arête + sommet',1e-5);V(Wd(oB,[1,0,0]),[0,1,0],'6b : arêtes colinéaires',1e-5);
    // 7. angle entre une arête et un plan cible ; parallèle entre deux arêtes
    go([rel('par',line([0,0,0],[1,0,0]),line([0,0,0],[0,0,1]),{sg:1})]);
    V(Wd(oB,[1,0,0]),[0,0,1],'7 : parallèle arête / arête',1e-5);
    // 8. fichier : arêtes et sommets relus
    go([rel('coinc',pt([0,0,0]),pt([10,20,30])),rel('coinc',circ([0,0,0],[0,0,1],5),circ([10,20,30],[0,0,1],5),{sg:1})]);
    const fr8=JSON.parse(JSON.stringify(oB.fr));
    const js=serialise();await deserialise(js,{rebuild:false});
    const oB2=asmRoot().occ.find(q=>q.id===oB.id);
    att(oB2.cons&&oB2.cons.length===2&&oB2.cons[0].a.v&&oB2.cons[1].b.e&&oB2.cons[1].b.e.k==='circ','8 : fichier : sommet et cercle relus');
    asmResolve();V(oB2.fr.o,fr8.o,'8b : fichier : même position',1e-5);
    // 9. normalisation : référence fausse refusée, noms
    att(asmConsNorm([{t:'coinc',a:{path:[],e:{k:'line',m:[0,0,0]}},b:{path:[],v:[1,2,3]}}])===undefined,'9 : arête sans direction refusée');
    att(asmConsNorm([{t:'coinc',a:{path:[],v:[0,0,0]},b:{path:[],e:{k:'circ',c:[0,0,0],n:[0,0,1],r:2}}}]).length===1,'9b : sommet / cercle accepté');
    att(asmRelGeomLab({a:{v:[0,0,0]},b:{e:{k:'circ'}}})==='Point-Cercle','9c : libellé Point-Cercle (vu '+asmRelGeomLab({a:{v:[0,0,0]},b:{e:{k:'circ'}}})+')');
    // 10. types permis
    const cur=(ka,kb)=>({aG:{G:{k:ka}},bG:{G:{k:kb}}});
    att(asmRelTypeOK(cur('pt','plane'),'coinc')&&!asmRelTypeOK(cur('pt','plane'),'angle')&&!asmRelTypeOK(cur('pt','line'),'par'),'10 : sommet : Coïncidente seule');
    att(!asmRelTypeOK(cur('circ','plane'),'tan')&&asmRelTypeOK(cur('circ','plane'),'angle')&&asmRelTypeOK(cur('line','cyl'),'tan'),'10b : cercle sans Tangente, arête droite avec');
    // 11. après un rejeu : l'arête et le sommet les plus proches, de même type
    const G={edges:[{k:'line',p0:[0,0,0],p1:[10,0,0],m:[5,0,0],d:[1,0,0]},{k:'line',p0:[0,0,0],p1:[0,10,0],m:[0,5,0],d:[0,1,0]},
      {k:'circ',c:[3,3,0],n:[0,0,1],x:[1,0,0],r:2},{k:'circ',c:[3.5,3,0],n:[0,0,1],x:[1,0,0],r:4}],verts:[[0,0,0],[10,0,0],[0,10,0]]};
    att(asmConsFindEdge(G,{k:'line',m:[0,7,0],d:[0,-1,0]})===G.edges[1],'11 : arête droite retrouvée par sa direction');
    att(asmConsFindEdge(G,{k:'circ',c:[3.4,3,0],n:[0,0,-1],r:2})===G.edges[2],'11b : cercle : même Ø d’abord');
    att(asmConsFindVert(G,[9,1,0])===G.verts[1],'11c : sommet le plus proche');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'relations_aretes.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
