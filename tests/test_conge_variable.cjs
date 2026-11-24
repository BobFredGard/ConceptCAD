// V0.99.69 : CONGÉ VARIABLE — rayon de départ et d'arrivée par arête, 0 permis à un bout (demande de Fred :
// « une valeur de départ et une d'arrivée, et les valeurs de 0 […] pour faire un cône »). Noyau réel.
// Pièce : boîte 40×30×20 ; arête du haut y=0, de x=0 (départ) à x=40. Contrôles : volume enlevé (≈ (1−π/4)·∫r²),
// sections près de chaque bout (la matière part du côté du grand rayon), inversion ⇄, rejeu par le document,
// création et édition par la commande, case « tangentes » décochée.
const vm=require('vm'),path=require('path');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "const sk={id:'s',name:'s',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:40,y:0},c:{x:40,y:30},d:{x:0,y:30}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:9,visible:false};",
    "doc.sketches=[sk];doc.features=[{id:'F',type:'extrude',name:'P',sketchId:'s',distance:20,op:'add',visible:true}];doc.bodies=[];markDirty();rebuild();",
    "const vol=sh=>{const G=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(sh,G,false,false,false);const v=G.Mass();try{G.delete();}catch(e){}return v;};",
    "const ok=sh=>{try{const c=new occt.BRepCheck_Analyzer(sh,true,false);return c.IsValid();}catch(e){return null;}};",
    // matière enlevée dans la section x = cte (aire 30×20 = 600 au départ)
    "const ote=(sh,x)=>{const pl=new occt.gp_Pln_3(new occt.gp_Pnt_3(x,0,0),new occt.gp_Dir_4(1,0,0));const f=new occt.BRepBuilderAPI_MakeFace_8(pl,-100,100,-100,100).Face();",
    "  const c=new occt.BRepAlgoAPI_Common_3(sh,f,new occt.Message_ProgressRange_1());const G=new occt.GProp_GProps_1();occt.BRepGProp.SurfaceProperties_1(c.Shape(),G,false,false);return 600-G.Mass();};",
    "const near=(a,b,t)=>Math.abs(a-b)<=t;",
    "const base=occLive.shape,E=occListEdges(base);",
    "const e0=E.find(e=>near(e.mid[0],20,1e-6)&&near(e.mid[1],0,1e-6)&&near(e.mid[2],20,1e-6));",
    "A(!!e0,'0 : arête du haut y=0 trouvée');",
    "const K=1-Math.PI/4,ideal=K*64*40/3;", // 0 → 8 linéaire sur 40 mm : 182,9 mm³
    "const run=(rv,opts)=>{const w=[];const s=occFilletRun(base,[{src:e0.src,r:Math.max(rv.a,rv.b),mid:e0.mid.slice(),pts:e0.pts,rv}],w,false,opts||null);return {s,w,v:s?24000-vol(s):NaN};};",
    // 1. 0 → 8, départ à x=0
    "const a=run({a:0,b:8,p0:[0,0,20]});",
    "A(a.s&&ok(a.s)!==false,'1 : 0 → 8 : solide rendu et valide');",
    "A(a.s&&a.v>0.8*ideal&&a.v<1.3*ideal,'1 : 0 → 8 : matière enlevée '+(a.s?a.v.toFixed(1):'?')+' mm³ (≈ '+ideal.toFixed(1)+' en loi linéaire)');",
    "const a4=a.s?ote(a.s,4):NaN,a36=a.s?ote(a.s,36):NaN;",
    "A(a4<1&&a36>8,'1 : pointe au départ (x=4 : '+a4.toFixed(2)+' mm²), grand rayon à l’arrivée (x=36 : '+a36.toFixed(2)+' mm², R7,2 ≈ '+(K*7.2*7.2).toFixed(2)+')');",
    // 2. ⇄ : 8 → 0, même départ : symétrique
    "const b=run({a:8,b:0,p0:[0,0,20]});",
    "const b4=b.s?ote(b.s,4):NaN,b36=b.s?ote(b.s,36):NaN;",
    "A(b.s&&near(b.v,a.v,0.5)&&b4>8&&b36<1,'2 : 8 → 0 : même volume ('+(b.s?b.v.toFixed(1):'?')+'), pointe à l’arrivée');",
    // 3. le départ pris à l'autre bout de l'arête : même effet que ⇄
    "const c=run({a:0,b:8,p0:[40,0,20]});",
    "A(c.s&&ote(c.s,4)>8&&ote(c.s,36)<1,'3 : départ posé à x=40 : la pointe y est');",
    // 4. deux valeurs non nulles
    "const d=run({a:2,b:6,p0:[0,0,20]});",
    "const idD=K*40*(4+12+36)/3;", // ∫(2+x/10)² sur 0..40 = 40·(a²+ab+b²)/3
    "A(d.s&&d.v>0.85*idD&&d.v<1.2*idD&&ote(d.s,4)<ote(d.s,36),'4 : 2 → 6 : '+(d.s?d.v.toFixed(1):'?')+' mm³ (≈ '+idD.toFixed(1)+')');",
    // 5. case tangentes décochée (single) : passe quand même par le noyau
    "const e=run({a:0,b:8,p0:[0,0,20]},{single:'droit'});",
    "A(e.s&&near(e.v,a.v,0.5),'5 : tangentes décochées : même résultat ('+(e.s?e.v.toFixed(1):'?')+')');",
    // 6. par le DOCUMENT : fonction xfillet + rejeu
    "const xf={id:'C',type:'xfillet',name:'c',tangent:true,droit:true,visible:true,edges:[{pos:e0.mid.slice(),pos0:e0.mid.slice(),r:8,len:40,anchor:null,name:'e',seed:1,rv:{a:0,b:8,p0:[0,0,20]}}]};",
    "doc.features.push(xf);",
    "const final=()=>{freshHard=true;occCkClear();markDirty();rebuild();const FR=occFinalShape(null);const sh=FR.perBody[0].shape;const r={v:24000-vol(sh),x4:ote(sh,4),x36:ote(sh,36),m:xf._m?xf._m.m+'/'+xf._m.t:'?'};occCleanup(FR,null);return r;};",
    "const f1=final();",
    "A(near(f1.v,a.v,0.5)&&f1.x4<1&&f1.m==='1/1','6 : fonction au rejeu : '+f1.v.toFixed(1)+' mm³, pointe au départ, '+f1.m);",
    "const s1=featSig(xf);xf.edges[0].rv={a:8,b:0,p0:[0,0,20]};",
    "A(featSig(xf)!==s1,'6 : changer départ / arrivée change la signature de rejeu');",
    "const f2=final();",
    "A(f2.x36<1&&f2.x4>8,'6 : 8 → 0 au rejeu : pointe à l’arrivée');",
    // 7. par la COMMANDE
    "doc.features=doc.features.filter(f=>f.type!=='xfillet');freshHard=true;occCkClear();markDirty();rebuild();",
    "enterExactFilletMode(null,'fillet');filModeX.radius=0;filModeX.vari=true;filModeX.radius2=8;",
    "let i0=-1;filModeX.edges.forEach((e,i)=>{if(near(e.mid[0],20,1e-3)&&near(e.mid[1],0,1e-3)&&near(e.mid[2],20,1e-3))i0=i;});",
    "A(i0>=0,'7 : arête listée par la commande');xSeedAdd(i0);xSelSync();",
    "const s0=filModeX.sel[0];",
    "A(s0&&s0.rv&&s0.rv.a===0&&s0.rv.b===8&&s0.r===8,'7 : arête choisie en variable : 0 → 8, r = 8 ('+JSON.stringify(s0&&s0.rv)+')');",
    "const pDep=s0.rv.p0.slice();",
    "applyExactFillet();",
    "const made=doc.features.find(f=>f.type==='xfillet');",
    "A(made&&made.edges[0].rv&&made.edges[0].rv.a===0&&made.edges[0].rv.b===8&&made.edges[0].r===8,'7 : fonction créée avec départ 0 et arrivée 8');",
    "const f7=(()=>{freshHard=true;occCkClear();markDirty();rebuild();const FR=occFinalShape(null);const sh=FR.perBody[0].shape;const xa=ote(sh,pDep[0]<20?4:36),xb=ote(sh,pDep[0]<20?36:4);occCleanup(FR,null);return {xa,xb};})();",
    "A(f7.xa<1&&f7.xb>8,'7 : rejeu : pointe du côté du point vert ('+pDep.map(v=>+v.toFixed(1)).join(', ')+')');",
    // édition : la loi est rechargée, ⇄ échange
    "enterExactFilletMode(made);",
    "A(filModeX.vari===true&&filModeX.sel[0].rv&&filModeX.sel[0].rv.b===8,'7 : édition : mode variable et valeurs rechargés');",
    "xRvPose(filModeX.sel[0],filModeX.sel[0].rv.b,filModeX.sel[0].rv.a);applyExactFillet();",
    "A(made.edges[0].rv.a===8&&made.edges[0].rv.b===0,'7 : ⇄ enregistré : 8 → 0');",
    // retour au constant
    "enterExactFilletMode(made);filModeX.vari=false;filModeX.sel.forEach(s=>{s.r=Math.max(s.rv.a,s.rv.b);s.rv=null;});applyExactFillet();",
    "A(!made.edges[0].rv&&made.edges[0].r===8,'7 : retour au rayon constant R8');",
    // 8. tour FERMÉ de tangentes (dessus d'une boîte aux coins arrondis R5) : rampe sur l'arête cliquée, retour
    //    sur le reste du tour ; le 0 y devient 0,01 (sommet intérieur du contour, refusé tel quel par le noyau)
    "const bx=new occt.BRepPrimAPI_MakeBox_2(50,30,20).Shape();",
    "const vert=occListEdges(bx).filter(e=>Math.abs(e.pts[0][2]-e.pts[e.pts.length-1][2])>10);",
    "const b1=occFilletRun(bx,vert.map(e=>({src:e.src,r:5,mid:e.mid.slice()})),[],false,null);",
    "const E1=occListEdges(b1),V1=vol(b1);",
    "const t0=E1.find(e=>near(e.mid[1],0,1e-6)&&near(e.mid[2],20,1e-6)&&near(e.mid[0],25,1e-6));",
    "A(!!t0&&xTangentChainOf(E1,E1.indexOf(t0)).length===8,'8 : arête du dessus dans un tour de 8 arêtes tangentes');",
    // tranche de 0,2 mm du côté avant (y < 15) : matière enlevée par le congé de l'arête cliquée seule
    "const tranche=(sh,x)=>{const k=new occt.BRepPrimAPI_MakeBox_3(new occt.gp_Pnt_3(x-0.1,-1,0),new occt.gp_Pnt_3(x+0.1,15,21)).Shape();const c=new occt.BRepAlgoAPI_Common_3(sh,k,new occt.Message_ProgressRange_1());return (0.2*15*20-vol(c.Shape()))/0.2;};",
    "const run1=rv=>{const w=[];const s=occFilletRun(b1,[{src:t0.src,r:Math.max(rv.a,rv.b),mid:t0.mid.slice(),pts:t0.pts,rv}],w,false,null);return s;};",
    "const pA=t0.pts[0],pB=t0.pts[t0.pts.length-1],xA=pA[0]<pB[0]?8:42,xB=pA[0]<pB[0]?42:8;",
    "const g=run1({a:0,b:4,p0:pA});",
    "A(g&&ok(g)!==false,'8 : 0 → 4 sur le tour fermé : solide valide ('+(g?(V1-vol(g)).toFixed(1):'?')+' mm³ enlevés)');",
    "A(g&&tranche(g,xA)<0.5&&tranche(g,xB)>2,'8 : pointe du côté du départ ('+(g?tranche(g,xA).toFixed(2)+' / '+tranche(g,xB).toFixed(2):'?')+' mm²)');",
    "const h2=run1({a:1,b:4,p0:pB});",
    "A(h2&&ok(h2)!==false&&tranche(h2,xB)<tranche(h2,xA),'8 : 1 → 4 départ à l’autre bout : le petit rayon y est');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== V0.99.69 : congé variable (départ → arrivée, 0 permis) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
