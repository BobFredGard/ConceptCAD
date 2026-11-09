// Congés de plusieurs arêtes : arête suivie sur un solide déjà arrondi (raccourcie, rallongée, jamais le
// bord du congé voisin), arêtes refusées signalées sur la fonction au lieu de passer pour réussies.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const o=await vm.runInContext(`(async()=>{
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    const seg=(a,b,n)=>{const p=[];for(let i=0;i<=n;i++)p.push([0,1,2].map(k=>a[k]+(b[k]-a[k])*i/n));return p;};
    const ar=(a,b,src)=>{const pts=seg(a,b,10),len=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);return {src,pts,len,mid:pts[5]};};
    const j={mid:[50,0,0],pts:seg([0,0,0],[100,0,0],10)};
    A(occAreteSuivie([ar([10,0,0],[100,0,0],1)],j,false),'1 : raccourcie par sa voisine, son milieu a bougé : retrouvée');
    A(occAreteSuivie([ar([-2,0,0],[102,0,0],1)],j,false),'2 : rallongée : retrouvée');
    A(!occAreteSuivie([ar([0,2,0],[100,2,0],1)],j,false),'3 : bord du congé voisin à 2 mm : refusé (l’ancienne recherche à 3 mm le prenait)');
    A(!occAreteSuivie([],j,false),'4 : disparue : rien');
    const ac=[];for(let i=0;i<=10;i++){const t=i/10*Math.PI/2;ac.push([30*Math.cos(t),30*Math.sin(t),0]);}
    const ac2=[];for(let i=0;i<=10;i++){const t=0.2+i/10*(Math.PI/2-0.2);ac2.push([30*Math.cos(t),30*Math.sin(t),0]);}
    A(occAreteSuivie([{src:1,pts:ac2,len:40,mid:ac2[5]}],{mid:ac[5],pts:ac},false),'5 : arc raccourci, autre échantillonnage : retrouvé malgré la flèche des cordes');
    const rect=(id,x0,y0,x1,y1)=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[]});
    doc.sketches=[rect('s1',0,0,40,20)];doc.features=[];doc.bodies=[];delete doc.activeBody;ensureBodies();
    const B=doc.bodies[0].id;
    doc.features.push({id:'F1',type:'extrude',name:'Bloc',sketchId:'s1',distance:10,op:'add',visible:true,body:B});
    // les 4 arêtes du dessus, en un seul congé : toutes tangentes entre elles une fois comptées, pas de reste
    const haut=[[20,0,10,40],[40,10,10,20],[20,20,10,40],[0,10,10,20]];
    const xf={id:'X1',type:'xfillet',name:'Congé',visible:true,tangent:false,body:B,edges:haut.map(h=>({r:2,pos:h.slice(0,3),len:h[3]}))};
    doc.features.push(xf);markDirty();rebuild();
    let R=occFinalShape(null),v=asmVolCom(R.shape).v;occCleanup(R,null);
    A(!xf._rate&&!xf._err&&v<8000-20,'6 : 4 arêtes du dessus faites, rien de signalé ('+v.toFixed(1)+' mm³)');
    // une arête possible, une impossible (R30 sur un bord de 10 mm dans un bloc de 20)
    xf.edges=[{r:1,pos:[20,0,10],len:40},{r:60,pos:[40,10,10],len:20}];delete xf._rate;markDirty();rebuild();
    R=occFinalShape(null);const msgs=(R.msgs||[]).join(' | ');occCleanup(R,null);
    A(xf._rate&&xf._rate.n===1&&xf._rate.t===2,'7 : R60 refusé : la fonction le dit ('+JSON.stringify(xf._rate||null)+')');
    A(/NON FAIT sur 1.2/.test(msgs),'8 : le message nomme l’arête non faite');
    A(featIconOf(xf).includes('⚠'),'9 : l’arbre affiche ⚠');
    xf.edges=[{r:1,pos:[20,0,10],len:40}];markDirty();rebuild();R=occFinalShape(null);occCleanup(R,null);
    A(!xf._rate,'10 : corrigé : le ⚠ disparaît');
    return out;
  })()`,ctx);
  o.log.forEach(m=>console.log('  ✓ '+m));o.fails.forEach(m=>console.log('  ✗ '+m));
  console.log(o.fails.length?'*** ÉCHEC ***':'*** TOUT PASSE ***');process.exit(o.fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
