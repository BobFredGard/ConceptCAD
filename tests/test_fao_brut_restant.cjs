// V0.99.0 : ÉBAUCHE 3D SUR LE BRUT RESTANT (usinage de reprise, comme Fusion 360).
// Demande : « l'ébauche 3D prend en compte soit le brut, soit le brut restant, pour éviter
// de repasser là où l'on a déjà enlevé de la matière dans l'opération précédente » ;
// « il faudra quand même prendre en compte le 3+2 ».
// Pièce : bloc 100×80×20, poche x[10,90] y[10,70] fond 5, coins VIFS (une fraise D16
// laisse un quart de cercle de matière dans chaque coin).
//  1. Ébauche D16 (brut du posage), puis reprise D6 (brut restant) : la reprise coupe
//     bien moins que la même D6 sur le brut du posage, et seulement près des coins ;
//  2. après les deux opérations (simulation indépendante), la matière des coins
//     accessible à la D6 est enlevée, comme avec la D6 seule sur le brut du posage ;
//  3. la reprise ne recoupe pas la surépaisseur laissée par la D16 le long des parois
//     (même laisse, « Ignorer moins de ») ;
//  4. clé : modifier l'ébauche D16 met la reprise à régénérer ; une ébauche sans
//     « brut restant » garde sa clé (documents existants inchangés) ;
//  5. 3+2 : un surfaçage incliné de 30° placé avant (repère propre) abaisse le brut
//     restant le long de son plan : la reprise ne coupe plus au-dessus de ce plan ;
//  6. reprise dans un repère propre (3+2) : la carte suit l'axe de l'opération.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const r=vm.runInContext(`(function(){
    const P=[]; const A=(ok,m)=>P.push((ok?'OK   ':'ECHEC')+' : '+m);
    const C=10,NX=10,NY=8;
    const mkMesh=function(hAt){const V=[],T=[],K={};
      const vid=function(x,y,z){const k=x+','+y+','+z;if(K[k]===undefined){K[k]=V.length;V.push([x,y,z]);}return K[k];};
      const quad=function(a,b,c,d){const A1=vid.apply(null,a),B=vid.apply(null,b),Cc=vid.apply(null,c),Dd=vid.apply(null,d);T.push([A1,B,Cc],[A1,Cc,Dd]);};
      const H=function(i,j){if(i<0||j<0||i>=NX||j>=NY)return 0;return hAt(i*C+5,j*C+5);};
      for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const h=H(i,j),x0=i*C,y0=j*C,x1=x0+C,y1=y0+C;
        if(h<=0)continue;
        quad([x0,y0,h],[x1,y0,h],[x1,y1,h],[x0,y1,h]);
        quad([x0,y0,0],[x0,y1,0],[x1,y1,0],[x1,y0,0]);
        let hn=H(i+1,j);if(hn<h)quad([x1,y0,hn],[x1,y1,hn],[x1,y1,h],[x1,y0,h]);
        hn=H(i-1,j);if(hn<h)quad([x0,y1,hn],[x0,y0,hn],[x0,y0,h],[x0,y1,h]);
        hn=H(i,j+1);if(hn<h)quad([x1,y1,hn],[x0,y1,hn],[x0,y1,h],[x1,y1,h]);
        hn=H(i,j-1);if(hn<h)quad([x0,y0,hn],[x1,y0,hn],[x1,y0,h],[x0,y0,h]);}
      return {v:V,t:T};};
    const inPk=function(x,y){return x>10&&x<90&&y>10&&y<70;};
    const M=mkMesh(function(x,y){return inPk(x,y)?5:20;});
    // corps factice : BufferGeometry non indexée lue par faoMeshFromBody
    const arr=[];M.t.forEach(function(t){t.forEach(function(k){arr.push(M.v[k][0],M.v[k][1],M.v[k][2]);});});
    bodies.length=0;
    bodies.push({id:'b1',kind:'import',visible:true,mesh:{visible:true,matrixWorld:null,geometry:{attributes:{position:{array:Float32Array.from(arr),count:arr.length/3}},index:null}}});
    const s=faoDefaultSetup(); s.name='REPRISE';
    s.stock={x0:0,y0:0,z0:0,x1:100,y1:80,z1:20};
    s.tools=[{id:'T1',num:1,name:'D16',kind:'flat',d:16,cornerR:0,flutes:3,vc:250,fz:0.06},
             {id:'T2',num:2,name:'D6',kind:'flat',d:6,cornerR:0,flutes:3,vc:250,fz:0.04},
             {id:'T3',num:3,name:'Surfaçage D50',kind:'flat',d:50,cornerR:0,flutes:5,vc:250,fz:0.1}];
    const rough=function(id,tool,ae,extra){return Object.assign({id:id,on:true,toolId:tool,type:'rough3d',ztop:20,zbot:5,ap:7.5,ae:ae,
      radial:0.5,axial:0.5,entry:'circ',minipasses:0,parRegion:true,mode:'anneaux',sens:'avalant',arrondi:0},extra||{});};
    s.ops=[rough('o16','T1',9),rough('o6','T2',3,{brut:'restant'})];
    doc.fao={setups:[s],activeSetupId:s.id};
    faoSanitiseOps(s);
    const o16=s.ops[0],o6=s.ops[1];
    const t0=Date.now();
    const mv16=faoOpMoves(o16,s);
    const mvR=faoOpMoves(o6,s);
    const tR=Date.now()-t0;
    const o6b=rough('o6b','T2',3); s.ops.push(o6b);
    const mvP=faoOpMoves(o6b,s);
    s.ops.pop();
    const cutLen=function(mv){let L=0;for(let i=1;i<mv.length;i++)if(!mv[i].r&&!mv[i-1].r)L+=Math.hypot(mv[i].x-mv[i-1].x,mv[i].y-mv[i-1].y,mv[i].z-mv[i-1].z);return L;};
    const LR=cutLen(mvR),LP=cutLen(mvP),L16=cutLen(mv16);
    P.push('  · coupe : D16 '+L16.toFixed(0)+' mm ; D6 sur le brut du posage '+LP.toFixed(0)+' mm ; D6 reprise '+LR.toFixed(0)+' mm ('+(100*LR/LP).toFixed(0)+' %), '+mvR.length+' mouvements, '+tR+' ms (dont D16)');
    P.push('  · carte : '+JSON.stringify(o6.restDiag));
    A(mvR.length>20&&LR>50,'la reprise usine quelque chose');
    A(LR<0.3*LP,'la reprise coupe bien moins que la D6 sur le brut du posage ('+(100*LR/LP).toFixed(0)+' %)');
    A(o6.restDiag&&o6.restDiag.n===1,'une opération précédente rejouée');
    // 1b. coupes à la cote de la poche : près des coins seulement (à moins de 14 mm d'un coin)
    const corners=[[10,10],[90,10],[10,70],[90,70]];
    let far=0,farL=0,ex=null;
    for(let i=1;i<mvR.length;i++){const a=mvR[i-1],b=mvR[i];if(a.r||b.r)continue;
      if(!(Math.abs(a.z-b.z)<1e-6&&a.z<19.9))continue;
      const m=[(a.x+b.x)/2,(a.y+b.y)/2];if(!inPk(m[0],m[1]))continue;
      const dc=Math.min.apply(null,corners.map(function(c){return Math.hypot(m[0]-c[0],m[1]-c[1]);}));
      if(dc>14){far++;farL+=Math.hypot(b.x-a.x,b.y-a.y);if(!ex)ex=[a.x,a.y,a.z,b.x,b.y];}}
    A(farL<0.05*LR,'coupes de la reprise dans la poche : près des coins ('+farL.toFixed(1)+' mm loin des coins'+(ex?', ex. '+ex.map(function(v){return v.toFixed(1);}).join(','):'')+')');
    // 2. simulation indépendante : matière restante dans les coins après D16 + reprise
    const simLeft=function(lists){
      const g=faoMatterGrid({x0:0,y0:0,z0:0,x1:100,y1:80,z1:20},0.4);
      lists.forEach(function(L){const mv=L[0],r=L[1];for(let i=1;i<mv.length;i++){const a=mv[i-1],b=mv[i];if(b.r)continue;
        faoMatterCarveSeg(g,a.x,a.y,a.z,b.x,b.y,b.z,r,null,0,null);}});
      // dans les coins : à plus de 3,5 mm des parois (rayon D6 + laisse), à moins de 8 mm du coin
      let left=0,ex2=null;
      for(let j=0;j<g.ny;j++)for(let i=0;i<g.nx;i++){const x=g.ox+(i+0.5)*g.pas,y=g.oy+(j+0.5)*g.pas;
        if(!(x>10+0.5+0.4&&x<90-0.5-0.4&&y>10+0.5+0.4&&y<70-0.5-0.4))continue;
        const dc=Math.min.apply(null,corners.map(function(c){return Math.hypot(x-c[0],y-c[1]);}));
        if(dc>12)continue;
        const top=g.h[j*g.nx+i];if(top>5+0.5+0.6){left++;if(!ex2)ex2=[x,y,top];}}
      return {left:left,ex:ex2};};
    const S16=simLeft([[mv16,8]]),S2=simLeft([[mv16,8],[mvR,3]]),SP=simLeft([[mvP,3]]);
    P.push('  · matière des coins (cases) : après D16 '+S16.left+' ; après reprise '+S2.left+' ; D6 seule sur le brut '+SP.left);
    A(S16.left>10,'la D16 laisse de la matière dans les coins ('+S16.left+')');
    A(S2.left<=SP.left+2,'après la reprise, les coins sont vidés comme par la D6 seule ('+S2.left+(S2.ex?' ex. '+S2.ex.map(function(v){return v.toFixed(2);}).join(','):'')+')');
    // 3. pas de passe le long des parois loin des coins (surépaisseur de la D16 = même laisse)
    let wall=0;
    for(let i=1;i<mvR.length;i++){const a=mvR[i-1],b=mvR[i];if(a.r||b.r)continue;
      const m=[(a.x+b.x)/2,(a.y+b.y)/2];if(!inPk(m[0],m[1]))continue;
      const dW=Math.min(m[0]-10,90-m[0],m[1]-10,70-m[1]);
      const dc=Math.min.apply(null,corners.map(function(c){return Math.hypot(m[0]-c[0],m[1]-c[1]);}));
      if(dW<4&&dc>14)wall+=Math.hypot(b.x-a.x,b.y-a.y);}
    A(wall<1,'aucune passe le long des parois loin des coins ('+wall.toFixed(1)+' mm)');
    // 4. clés
    const k0=faoOpMovesKey(o6,s),kP=faoOpMovesKey(o6b,s);
    o16.ae=8.5;
    const k1=faoOpMovesKey(o6,s);
    o16.ae=9;
    const k2=faoOpMovesKey(o6,s);
    A(k0!==k1&&k0===k2,'modifier l’ébauche précédente change la clé de la reprise (et revient)');
    A(kP&&kP.indexOf('restant')<0,'ébauche sur le brut du posage : clé sans dépendance aux opérations précédentes');
    // 5. 3+2 : surfaçage incliné de 30° (autour de Y) avant la reprise — le plan passe par
    //    z = -10 sous l'origine du posage : en repère posage z ≈ 8,5 + x·tan30, il enlève le coin x < 20
    const th=30*Math.PI/180;
    s.ops=[{id:'f30',on:true,toolId:'T3',type:'facing',frame:{z:[-Math.sin(th),0,Math.cos(th)],x:'+X'},z:-10,ae:30,arrondi:0},
           rough('o6t','T2',3,{brut:'restant'})];
    faoSanitiseOps(s);
    const oF=s.ops[0],oT=s.ops[1];
    const mvF=faoOpMoves(oF,s);
    const mvT=faoOpMoves(oT,s);
    P.push('  · 3+2 : surfaçage '+mvF.length+' mouvements, reprise '+mvT.length+' mouvements, carte '+JSON.stringify(oT.restDiag));
    A(oT.restDiag&&oT.restDiag.tilt===1,'le surfaçage incliné est compté (3+2)');
    // plan du surfaçage (repère posage) : points de coupe du surfaçage, plan ajusté
    let zPlane=null;
    { const cutsF=mvF.filter(function(m){return !m.r;});
      if(cutsF.length>4){ // z = a·x + c (incliné autour de Y)
        let sx=0,sz=0,sxx=0,sxz=0,n=0;cutsF.forEach(function(m){sx+=m.x;sz+=m.z;sxx+=m.x*m.x;sxz+=m.x*m.z;n++;});
        const a=(n*sxz-sx*sz)/(n*sxx-sx*sx),c=(sz-a*sx)/n;zPlane=function(x){return a*x+c;};
        P.push('  · plan du surfaçage : z = '+a.toFixed(3)+'·x + '+c.toFixed(2)); } }
    A(!!zPlane,'surfaçage incliné calculé');
    if(zPlane){
      // aucune coupe de la reprise au-dessus du plan surfacé (+ jeu)
      let ex3=null;
      const aboveOf=function(mv){let L=0;for(let i=1;i<mv.length;i++){const a=mv[i-1],b=mv[i];if(a.r||b.r)continue;
        const zs=Math.min(20,zPlane((a.x+b.x)/2));
        if(Math.min(a.z,b.z)>zs+0.3&&Math.min(a.z,b.z)<19.9){L+=Math.hypot(b.x-a.x,b.y-a.y);if(!ex3&&mv===mvT)ex3=[a.x,a.y,a.z,zs];}}return L;};
      const above=aboveOf(mvT),aboveP=aboveOf(mvP);
      A(aboveP>50,'sans brut restant, la D6 couperait au-dessus du plan surfacé ('+aboveP.toFixed(0)+' mm)');
      A(above<1,'la reprise ne coupe pas au-dessus du plan déjà surfacé en 3+2 ('+above.toFixed(1)+' mm'+(ex3?', ex. '+ex3.map(function(v){return v.toFixed(2);}).join(','):'')+')');
      // et elle coupe sous le plan, là où il reste du brut (le côté haut du plan)
      let below=0;for(let i=1;i<mvT.length;i++){const a=mvT[i-1],b=mvT[i];if(a.r||b.r)continue;if(Math.min(a.z,b.z)<19.9)below+=Math.hypot(b.x-a.x,b.y-a.y);}
      A(below>100,'la reprise usine la matière sous le plan ('+below.toFixed(0)+' mm)');
    }
    // 6. reprise dans un repère propre (Z du posage, X tourné ; origine au dessus du brut) : même carte qu'en repère du posage
    s.ops=[rough('o16','T1',9),rough('o6r','T2',3,{brut:'restant',frame:{z:'+Z',x:'+Y'},ztop:0,zbot:-15})];
    faoSanitiseOps(s);
    faoOpMoves(s.ops[0],s);
    const mvRr=faoOpMoves(s.ops[1],s);
    const LRr=cutLen(mvRr);
    P.push('  · reprise en repère propre (X = Y posage) : '+LRr.toFixed(0)+' mm de coupe, carte '+JSON.stringify(s.ops[1].restDiag));
    A(LRr>50&&LRr<0.3*LP,'reprise en repère propre : seulement les coins ('+(100*LRr/LP).toFixed(0)+' %)');
    const SR=simLeft([[mv16,8],[mvRr,3]]);
    A(SR.left<=SP.left+2,'reprise en repère propre : coins vidés ('+SR.left+')');
    // 7. reprise INCLINÉE (3+2, 30°) après l'ébauche verticale D16 : la carte, vue le long
    //    de l'axe incliné, s'arrête au fond vidé de la poche et au dessus du pourtour plein
    s.ops=[rough('o16','T1',9),rough('o6i','T2',3,{brut:'restant',frame:{z:[-Math.sin(th),0,Math.cos(th)],x:'+X'},ztop:-30,zbot:-45})];
    faoSanitiseOps(s);
    faoOpMoves(s.ops[0],s);
    { const op=s.ops[1],fr=faoOpFrame(s,op),jo=faoOpJob(s,op,fr);
      const RM=faoRestMap(op,jo,6,0.5);
      const w=function(p){return faoToF(fr,faoToW(fr.P,p));};
      const a=w([50,40,5.5]),b=w([5,40,20]),c=w([50,40,12]);
      const ra=RM.raw(a[0],a[1]),rb=RM.raw(b[0],b[1]);
      P.push('  · reprise inclinée : fond de poche w '+a[2].toFixed(2)+' → carte '+ra.toFixed(2)+' ; pourtour w '+b[2].toFixed(2)+' → carte '+rb.toFixed(2)+' ; '+JSON.stringify({n:RM.n,tilt:RM.tilt,ms:RM.ms}));
      A(RM.tilt===1,'reprise inclinée : l’ébauche verticale est vue comme une autre orientation');
      A(Math.abs(ra-a[2])<0.6,'reprise inclinée : la carte s’arrête au fond vidé de la poche ('+ra.toFixed(2)+' / '+a[2].toFixed(2)+')');
      A(Math.abs(rb-b[2])<0.6,'reprise inclinée : la carte suit le dessus du pourtour plein ('+rb.toFixed(2)+' / '+b[2].toFixed(2)+')');
      A(RM.raw(c[0],c[1])<c[2]-3,'reprise inclinée : rien au milieu de la poche vidée');
    }
    return P.join(String.fromCharCode(10));
  })()`,ctx);
  console.log(r);
  process.exit(/ECHEC/.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
