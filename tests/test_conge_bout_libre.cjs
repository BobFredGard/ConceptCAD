// V0.99.24 : congé d'un coin rentrant droit qui DÉBOUCHE DANS LE VIDE à ses deux bouts (« Pièce pour fenêtre ») :
// tube R6,7 entouré d'un anneau, une fenêtre traverse l'anneau sur toute sa longueur. L'arête patte / tube
// s'arrête aux faces de bout de l'anneau, mais le tube continue de part et d'autre : le noyau refuse le congé
// à tous les rayons (sommets à 4 arêtes). ConceptCAD le pose tout droit et le coupe au ras des faces de bout.
// Le repli arête par arête prenait aussi la PREMIÈRE arête à moins de 3 mm, pas la plus proche.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    // Profil tourné autour de X : alésage R4, tube R6,7 de 0 à 20, anneau R11 de 8 à 14
    const prof={id:'s1',name:'s1',plane:'XZ',origin:[0,0,0],axU:[1,0,0],axV:[0,0,1],axN:[0,-1,0],
      points:{a:{x:0,y:0},b:{x:20,y:0},c:{x:0,y:4},d:{x:8,y:4},e:{x:8,y:6.7},f:{x:8,y:11},g:{x:14,y:11},h:{x:14,y:6.7},i:{x:20,y:6.7},j:{x:20,y:4}},
      entities:[{id:'ax',t:'line',p1:'a',p2:'b',axis:true,construction:true},{id:'l1',t:'line',p1:'c',p2:'j'},{id:'l2',t:'line',p1:'j',p2:'i'},
        {id:'l3',t:'line',p1:'i',p2:'h'},{id:'l4',t:'line',p1:'h',p2:'g'},{id:'l5',t:'line',p1:'g',p2:'f'},{id:'l6',t:'line',p1:'f',p2:'e'},
        {id:'l7',t:'line',p1:'e',p2:'d'},{id:'l8',t:'line',p1:'d',p2:'c'}],constraints:[],dims:[],seq:20,visible:false};
    // Fenêtre : secteur R6,7 → R10 entre deux rayons, tirée à travers tout l'anneau (x 8 → 14)
    const k=Math.PI/180,P=(r,a)=>({x:r*Math.cos(a*k),y:r*Math.sin(a*k)});
    const fen={id:'s2',name:'s2',plane:'YZ',origin:[8,0,0],axU:[0,-1,0],axV:[0,0,1],axN:[-1,0,0],
      points:{O:{x:0,y:0},p1:P(6.7,10),p2:P(6.7,170),p3:P(10,170),p4:P(10,10)},
      entities:[{id:'a1',t:'arc',pc:'O',pa:'p1',pb:'p2',r:6.7},{id:'m1',t:'line',p1:'p2',p2:'p3'},{id:'a2',t:'arc',pc:'O',pa:'p4',pb:'p3',r:10},{id:'m2',t:'line',p1:'p4',p2:'p1'}],
      constraints:[],dims:[],seq:20,visible:false};
    doc.sketches=[prof,fen];doc.bodies=[];
    doc.features=[{id:'F1',type:'revolve',name:'tube',sketchId:'s1',axis:{k:'line',id:'ax'},angle:360,op:'add',visible:true},
      {id:'F2',type:'extrude',name:'fenêtre',sketchId:'s2',distance:-6,op:'cut',visible:true}];
    freshHard=true;occCkClear();markDirty();rebuild();
    const base=occLive.shape,E=occListEdges(base),vol=sh=>occCoqueVolume(sh);
    // arêtes patte / tube : droites le long de X, à R6,7 sur les deux rayons de la fenêtre
    const pied=a=>{const p=P(6.7,a);return E.find(x=>Math.hypot(x.mid[0]-11,x.mid[1]+p.x,x.mid[2]-p.y)<1e-3&&Math.abs(x.len-6)<1e-3);};
    const e1=pied(10),e2=pied(170);
    A(e1&&e2,'1 : les deux arêtes patte / tube sont trouvées');
    // le noyau seul refuse (c'est la cause chez Fred)
    let noyau=false;
    try{const h=occEdgeAt(base,e1.src),mf=new occt.BRepFilletAPI_MakeFillet(base,0);mf.Add_2(0.5,h);mf.Build();noyau=mf.IsDone();mf.delete();h.delete();}catch(e){noyau=false;}
    A(!noyau,'2 : le noyau seul refuse ce congé (bout libre)');
    const v0=vol(base),sec=r=>r*r*(1-Math.PI/4)*6;
    for(const r of [0.5,1])for(const single of [false,'droit']){
      const w=[];const s=occFilletRun(base,[{src:e1.src,r,mid:e1.mid.slice(),pts:e1.pts}],w,false,{single});
      const dv=s?vol(s)-v0:0;
      // le sol est convexe : un peu plus que la section d'un coin plan, jamais plus de 15 %
      A(s&&occCoqueValide(s)&&dv>sec(r)&&dv<1.15*sec(r),'3 : R'+r+(single?' sans tangence':' avec tangence')+' : solide valide, '+dv.toFixed(3)+' mm³ ajoutés'+(w.length?' ('+w.join(' | ')+')':''));
      if(s){
        // coupé au ras : rien ne dépasse des faces de bout de l'anneau (x 8 et 14)
        const neuves=occListEdges(s).filter(x=>x.pts.some(q=>{const d=Math.hypot(q[1],q[2]);return d>6.7+1e-3&&d<6.7+r+1e-3;})&&x.pts.some(q=>q[0]<8-1e-3||q[0]>14+1e-3));
        A(!neuves.length,'4 : R'+r+(single?' sans tangence':' avec tangence')+' : le congé s’arrête au ras des bouts de l’anneau');
        s.delete();
      }
    }
    // les deux d'un coup (fonction rejouée dans le document, tangence cochée comme par défaut)
    doc.features.push({id:'X',type:'xfillet',name:'C',visible:true,tangent:true,droit:true,
      edges:[e1,e2].map(e=>({pos:e.mid.slice(),pos0:e.mid.slice(),r:0.5,len:e.len,seed:1}))});
    freshHard=true;occCkClear();markDirty();rebuild();
    const xf=doc.features.find(f=>f.id==='X'),dv2=vol(occLive.shape)-v0;
    A(!xf._err&&!xf._rate&&dv2>2*sec(0.5)&&dv2<2.3*sec(0.5),'5 : fonction Congé R0,5 sur les deux arêtes : faite ('+dv2.toFixed(3)+' mm³'+(xf._err?', '+xf._err:'')+')');
    // Chanfrein du cercle au bout du tube, posé juste après la révolution : son ancre tombe sur le point de
    // l'axe (à 6,7 mm), qui ne mène à aucune arête — l'arête était déclarée perdue au rejeu (0/1).
    doc.features=[doc.features[0]];freshHard=true;occCkClear();markDirty();rebuild();
    const vR=vol(occLive.shape),C=occListEdges(occLive.shape).find(x=>Math.abs(x.mid[0]-20)<1e-3&&Math.abs(Math.hypot(x.mid[1],x.mid[2])-6.7)<1e-3);
    const anc=C?xAnchorFor(C.mid):null;
    A(C&&anc&&anc.t==='p','6 : cercle du bout du tube trouvé, ancré sur un point de l’esquisse ('+JSON.stringify(anc)+')');
    doc.features.push({id:'CH',type:'xfillet',name:'Ch',visible:true,tangent:false,droit:true,chamfer:true,cmode:'eq',
      edges:[{pos:C.mid.slice(),pos0:C.mid.slice(),r:1,len:+C.len.toFixed(3),anchor:anc,fn:[1,0,0],seed:1}]});
    freshHard=true;occCkClear();markDirty();rebuild();
    const ch=doc.features.find(f=>f.id==='CH'),dvc=vR-vol(occLive.shape),att=Math.PI*(2*6.7-2/3*1)*0.5; // anneau triangulaire 1×1 (Pappus)
    A(ch._m&&ch._m.m===1&&!ch._miss&&Math.abs(dvc-att)<0.05,'7 : chanfrein 1 mm rejoué sur son arête ('+JSON.stringify(ch._m)+', '+dvc.toFixed(3)+' mm³ ôtés, attendu '+att.toFixed(3)+')');
    A(!!ch.edges[0].nom,'8 : l’arête retrouvée garde désormais son nom ('+ch.edges[0].nom+')');
    JSON.stringify(out);`;
  const res=JSON.parse(vm.runInContext(R,ctx));
  res.log.forEach(m=>console.log('  ✓ '+m));
  res.fails.forEach(m=>console.log('  ✗ '+m));
  if(res.fails.length){console.log('\n*** '+res.fails.length+' ÉCHEC(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.error(e);process.exit(1);});
