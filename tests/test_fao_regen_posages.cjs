// V0.96.6 (demandes de Fred) :
//  1. « Régénérer » ne recalcule que les posages ACTIFS (non gelés) et leurs opérations
//     activées — tous, pas seulement le posage affiché ; les posages gelés et les
//     opérations désactivées gardent leurs parcours (avant : tout le cache était jeté) ;
//  2. « Retrait minimum » : l'outil ne monte que de la valeur choisie au-dessus de sa
//     passe et ne contourne que la matière qu'il balaierait vraiment (la paroi qu'il
//     quitte n'est plus un obstacle ; une paroi verticale de la pièce ne remplit plus
//     tout le carré qui l'entoure).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const out=vm.runInContext(`(function(){
    const P=[]; const A=(ok,m)=>P.push((ok?'OK   ':'ECHEC')+' : '+m);
    const tools=[{id:'T1',num:1,name:'Fraise D10',kind:'flat',d:10,cornerR:0,flutes:2,vc:250,fz:0.06}];
    const mk=function(nom){
      const s=faoDefaultSetup(); s.name=nom;
      s.stock={x0:0,y0:0,z0:0,x1:100,y1:80,z1:25};
      s.tools=JSON.parse(JSON.stringify(tools));
      s.ops=[{id:nom+'1',on:true,toolId:'T1',type:'facing',z:25,ae:6},
             {id:nom+'2',on:true,toolId:'T1',type:'pocket',x0:10,y0:10,x1:90,y1:70,ztop:25,zbot:5,ap:10,ae:5}];
      return s;
    };

    /* ============ 1. Régénérer : posages non gelés seulement ============ */
    const sA=mk('A'), sB=mk('B'), sC=mk('C');
    sA.ops[1].on=false; // opération désactivée du posage affiché
    doc.fao={setups:[sA,sB,sC],activeSetupId:sA.id};
    faoPrevOn=true;
    faoSetupStrike(sC.id,true); // posage gelé
    A(faoSetupStruck(sC)&&sC.ops.every(function(o){return o.on===false;}),'posage C gelé, ses opérations désactivées');
    const avant=new Map();
    [sA,sB,sC].forEach(function(s){ s.ops.forEach(function(op){ avant.set(op,faoOpMoves(op,s)); }); });
    A([sA,sB,sC].every(function(s){ return s.ops.every(function(op){ return faoOpMovesTry(op,s)===avant.get(op); }); }),'départ : chaque parcours est en mémoire');
    faoPreviewGenerate();
    const neuf=function(op,s){ const m=faoOpMovesTry(op,s); return !!m&&m!==avant.get(op)&&m.length===avant.get(op).length; };
    const garde=function(op,s){ return faoOpMovesTry(op,s)===avant.get(op); };
    A(neuf(sA.ops[0],sA),'posage affiché A : opération activée recalculée');
    A(garde(sA.ops[1],sA),'posage affiché A : opération désactivée gardée telle quelle');
    A(neuf(sB.ops[0],sB)&&neuf(sB.ops[1],sB),'posage B non gelé (pas affiché) : recalculé aussi');
    A(garde(sC.ops[0],sC)&&garde(sC.ops[1],sC),'posage C gelé : parcours gardés, rien recalculé');
    A(faoRoot().activeSetupId===sA.id,'le posage affiché reste A');
    const rs=typeof faoRegenSetups==='function'?faoRegenSetups().map(function(s){return s.name;}).join(','):'?';
    A(rs==='A,B','posages régénérés : A et B ('+rs+')');

    /* ============ 2. Retrait minimum : la paroi quittée n'est pas un obstacle ============ */
    const J=faoDefaultSetup(); J.name='LIAISON';
    J.stock={x0:0,y0:0,z0:-20,x1:100,y1:80,z1:5};
    J.tools=JSON.parse(JSON.stringify(tools));
    J.planes={clear:{ref:'brutHaut',dz:100},retr:{ref:'brutHaut',dz:50},mode:'min5'};
    J.ops=[{id:'p',on:true,toolId:'T1',type:'pocket',x0:10,y0:10,x1:90,y1:70,ztop:5,zbot:-10,ap:5,ae:5}];
    faoSanitiseOps(J);
    // zone 15..85 × 15..65 vidée à -5 par un balayage en X, qui finit dans le coin (15,65),
    // collé à la matière restée pleine (y > 70, x < 10), puis liaison vers (60,40) :
    // l'outil s'éloigne des parois, il ne monte que de 3 mm.
    const mv=[{r:1,x:15,y:15,z:10},{x:15,y:15,z:-5}];
    for(let y=15;y<=65;y+=5){ mv.push({x:85,y:y,z:-5}); mv.push({x:15,y:y,z:-5}); if(y<65)mv.push({x:15,y:y+5,z:-5}); }
    mv.push({r:1,x:15,y:65,z:10},{r:1,x:60,y:40,z:10},{x:60,y:40,z:-6});
    const cx=faoLinkCtx(J,J.ops); cx.lift=3;
    const o=faoOpLinks(J,J.ops[0],mv,null,cx);
    let zL=null,p=null; o.forEach(function(m){ if(p&&m.r&&Math.abs(m.x-60)<1e-6&&Math.abs(p.x-15)<1e-6)zL=Math.min(p.z,m.z); p=m; });
    A(zL!==null&&Math.abs(zL-(-2))<1e-6,'liaison qui quitte la paroi : -5 + 3 = -2, pas 3 mm au-dessus du brut (vu '+zL+')');
    // vers la matière restée pleine (au-delà de y = 70) : elle est franchie, jamais traversée
    const mv2=mv.slice(0,mv.length-3).concat([{r:1,x:15,y:65,z:10},{r:1,x:50,y:78,z:10},{x:50,y:78,z:0}]);
    const cx2=faoLinkCtx(J,J.ops); cx2.lift=3;
    let z2=null; p=null; faoOpLinks(J,J.ops[0],mv2,null,cx2).forEach(function(m){ if(p&&m.r&&Math.abs(m.x-50)<1e-6&&Math.abs(p.x-15)<1e-6)z2=Math.min(p.z,m.z); p=m; });
    A(z2!==null&&z2>=5+3-1e-6,'liaison vers la matière restée pleine : au-dessus du brut (vu '+z2+')');

    /* ============ 3. paroi verticale en biais : un trait, pas un carré ============ */
    const G={x0:0,y0:0,cell:1,nx:60,ny:60};
    const H=new Float32Array(3600).fill(-Infinity), F=new Float32Array(3600).fill(-Infinity);
    faoHMapRaster(H,F,G,{v:[[5,5,0],[50,50,0],[50,50,30]],t:[[0,1,2]]});
    A(F[40*60+10]===-Infinity,'paroi verticale de (5,5) à (50,50) : rien en (10,40), loin du trait');
    A(F[27*60+27]>=30-1e-6,'paroi verticale : sa hauteur sur le trait (27,27) = '+F[27*60+27]);
    // triangle couché en pente : jamais au-dessus du triangle, jamais en dessous du plan
    const H2=new Float32Array(3600).fill(-Infinity), F2=new Float32Array(3600).fill(-Infinity);
    faoHMapRaster(H2,F2,G,{v:[[0,0,0],[40,0,20],[0,40,0]],t:[[0,1,2]]});
    const k=10*60+20, zv=(20.5)/2; // centre (20.5,10.5) : z = x/2
    A(F2[k]>=zv-1e-6&&F2[k]<=zv+0.75*0.5+1e-6,'pente 1/2 : maille (20,10) entre '+zv+' et '+(zv+0.375)+' (vu '+F2[k]+')');
    return P;
  })()`,ctx);
  let ko=0;
  out.forEach(function(l){ console.log('  '+l); if(l.indexOf('ECHEC')===0)ko++; });
  if(ko){ console.log('\n'+ko+' ECHEC(S)'); process.exit(1); }
  console.log('\nTOUT EST CONFORME');
  process.exit(0);
})().catch(e=>{console.error('ERREUR',e);process.exit(1);});
