// V0.9.1 : 3+2 Siemens en CYCLE800 (comme PostPro/1520-5axes.cps et 630-5axes.cps) — pivotement du plan
// « TABLE », mode 27 (Z, Y, X), coordonnées écrites dans le plan incliné, arcs gardés en G2/G3 ;
// réglage machine « traori » pour l'ancienne sortie ; avance F modale (écrite seulement quand elle change).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
const {ctx}=loadApp();
const R=[
  "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
  // angles du repère : R = Rz(C)·Ry(B)·Rx(A)
  "{const S=faoSwivelZYX([1,0,0],[0,1,0],[0,0,1]);A(S.a===0&&S.b===0&&S.c===0,'1 : repère du posage : angles nuls');}",
  "{const c=Math.SQRT1_2;const S=faoSwivelZYX([c,0,-c],[0,1,0],[c,0,c]);A(S.a===0&&S.b===45&&S.c===0,'2 : face à 45° autour de Y : B 45 ('+JSON.stringify(S)+')');}",
  "{const S=faoSwivelZYX([0,1,0],[0,0,1],[1,0,0]);A(S.a===90&&S.b===0&&S.c===90,'3 : Z = +X, X = +Y : C 90 puis A 90 ('+JSON.stringify(S)+')');}",
  "{const S=faoSwivelZYX([0,0,-1],[0,1,0],[1,0,0]);A(S.b===90&&S.a===0,'4 : outil couché (X le long de −Z) : A = 0, B = 90 ('+JSON.stringify(S)+')');}",
  // recomposition : R(angles) redonne les axes
  "{const rad=Math.PI/180;const M=(S)=>{const ca=Math.cos(S.a*rad),sa=Math.sin(S.a*rad),cb=Math.cos(S.b*rad),sb=Math.sin(S.b*rad),cc=Math.cos(S.c*rad),sc=Math.sin(S.c*rad);",
  " return [[cc*cb,cc*sb*sa-sc*ca,cc*sb*ca+sc*sa],[sc*cb,sc*sb*sa+cc*ca,sc*sb*ca-cc*sa],[-sb,cb*sa,cb*ca]];};",
  " const n=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};const cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];",
  " let worst=0;for(let i=0;i<50;i++){const Z=n([Math.sin(i*1.7),Math.cos(i*2.3),Math.sin(i*0.9)+0.2]);const X=n(cr([0.3,1,0.1],Z));const Y=cr(Z,X);",
  "  const S=faoSwivelZYX(X,Y,Z),m=M(S);for(let r=0;r<3;r++)worst=Math.max(worst,Math.abs(m[r][0]-X[r]),Math.abs(m[r][1]-Y[r]),Math.abs(m[r][2]-Z[r]));}",
  " A(worst<1e-4,'5 : 50 repères quelconques : Rz(C)·Ry(B)·Rx(A) redonne les axes (écart '+worst.toExponential(1)+')');}",
  // programme : opération au repère propre Z = +X (face X1 du brut)
  "const s=faoDefaultSetup();s.name='C800';s.stock={x0:-10,y0:-20,z0:-5,x1:30,y1:40,z1:15};",
  "s.tools=[{id:'T1',num:1,name:'Fraise',kind:'flat',d:10,cornerR:0,flutes:2,vc:250,fz:0.06}];",
  "const op=faoOpDefaults('facing');op.toolId='T1';s.ops=[op];op.frame={z:'+X',x:'+Y'};delete op.z;",
  "const g=faoPost(s,'siemens1520').code;",
  "A(/CYCLE800\\(1,\"TABLE\",0,27,0,0,0,90\\.000,0\\.000,90\\.000,0,0,0,1,,1\\)/.test(g),'6 : CYCLE800 du plan de l’opération (C 90, B 0, A 90), jeu TABLE, mode 27');",
  "A(!/TRAORI|TRAFOOF|G0 B/.test(g),'7 : plus de TRAORI ni de B/C machine');",
  "const iT=g.indexOf('T1 D1'),iC=g.indexOf('CYCLE800(1,\"TABLE\",0,27,0,0,0,90');A(iT>0&&iC>iT,'8 : pivotement après le changement d’outil (comme le post Fusion)');",
  // V0.89.0 : box du brut + plan remis à plat en début de programme (_DIR 0), comme le post Fusion
  "A(/\\nWORKPIECE\\(,\"C\",,\"BOX\",112,/.test(g)&&g.indexOf('WORKPIECE')<g.indexOf('G71'),'8b : WORKPIECE « BOX » du brut en tête, avant G71');",
  "{const i0=g.indexOf('CYCLE800(1,\"TABLE\",0,27,0,0,0,0.000,0.000,0.000,0,0,0,0,,1)');A(i0>0&&i0<iT&&g.slice(0,i0).indexOf('G0 SUPA Z600 D0')>0,'8c : plan remis à plat avant le 1er outil, _DIR 0, après le dégagement');}",
  "const pre=g.slice(0,iC).split('\\n').slice(-4,-1).join('|');A(pre==='G0 SUPA Z600 D0|G0 SUPA X-430|D1','9 : dégagement de la 1520 avant le pivotement ('+pre+')');",
  "const iR=g.lastIndexOf('CYCLE800(1,\"TABLE\",0,27,0,0,0,0.000,0.000,0.000,0,0,0,1,,1)');A(iR>iC&&iR<g.indexOf('M30'),'10 : table remise à plat avant M30');",
  // coordonnées dans le plan incliné : le dessus de l'opération (face X1 = 40 du centre commun) en Z
  "const zs=(g.slice(iC,iR).match(/G1 [^\\n]*Z(-?[0-9.]+)/g)||[]).map(l=>+l.match(/Z(-?[0-9.]+)/)[1]);",
  "A(zs.length>0&&zs.every(z=>Math.abs(z-40)<1e-6),'11 : surfaçage de la face X1 écrit à Z40 dans le plan incliné ('+zs.slice(0,3).join(',')+'…)');",
  // F modal
  "const fl=g.split('\\n').filter(l=>/^G1 /.test(l));const withF=fl.filter(l=>/ F[0-9]/.test(l)).length;",
  "A(fl.length>4&&withF<fl.length/2,'12 : F modal : '+withF+' mots F sur '+fl.length+' lignes G1');",
  "{let cur=null,bad=0;g.split('\\n').forEach(l=>{const m=l.match(/ F([0-9.]+)/);if(m&&!/^;/.test(l)){if(m[1]===cur)bad++;cur=m[1];}if(/^T[0-9]/.test(l))cur=null;});A(bad===0,'13 : jamais deux fois le même F de suite ('+bad+')');}",
  // arcs : opération à repère propre avec un G3 dans son plan
  "{const mv=[{r:1,x:10,y:0,z:5},{r:0,x:10,y:0,z:0},{r:0,x:0,y:10,z:0,arc:{i:-10,j:0,cw:false}},{r:1,x:0,y:10,z:5}];",
  " const fr=faoOpFrame(s,op);const P=faoMovesOpToPos(mv,fr);const sv=faoOpMovesTry;",
  " faoOpMovesTry=function(){return P;};const sv2=faoOpMoves;faoOpMoves=function(){return P;};let g2='';",
  " try{g2=faoPost(s,'siemens630').code;}finally{faoOpMovesTry=sv;faoOpMoves=sv2;}",
  " A(/\\nG3 X0\\.000 Y10\\.000 Z0\\.000 I-10\\.000 J0\\.000/.test(g2),'14 : arc de l’opération réécrit en un seul G3 dans le plan incliné');",
  " A((g2.match(/\\nG1 /g)||[]).length<6,'15 : pas de segments de l’arc linéarisé');",
  " const pre2=g2.slice(0,g2.indexOf('CYCLE800')).split('\\n').slice(-4,-1).join('|');A(pre2==='G0 SUPA Z600 D0|G0 SUPA X-200|D1','16 : dégagement de la 630 ('+pre2+')');}",
  // réglage TRAORI conservé
  "faoMachine({id:'tstTraori',kind:'siemens',label:'Essai TRAORI',swivel:'traori'});",
  "{const gt=faoPost(s,'tstTraori').code;A(/TRAORI\\(1\\)/.test(gt)&&/G0 B-90\\.000 C0\\.000/.test(gt)&&!/CYCLE800/.test(gt),'17 : réglage machine swivel:\\'traori\\' : ancienne sortie TRAORI + B/C');}",
  // 3 axes : aucune trace
  "delete op.frame;op.z=15;{const g3=faoPost(s,'siemens1520').code;const c=(g3.match(/CYCLE800\\([^)]*\\)/g)||[]);",
  " A(!/TRAORI/.test(g3)&&c.length>=2&&c.every(l=>/,0,27,0,0,0,0\\.000,0\\.000,0\\.000,/.test(l)),'18 : sans repère incliné : CYCLE800 à plat seulement (début + après chaque outil, comme le post Fusion) ('+c.length+')');",
  " const s2=JSON.parse(JSON.stringify(s));s2.tools.push({id:'T2',num:2,name:'F2',kind:'flat',d:6,cornerR:0,flutes:2,vc:200,fz:0.05});const o2=faoOpDefaults('facing');o2.toolId='T2';o2.z=15;s2.ops.push(o2);",
  " const g4=faoPost(s2,'siemens630').code,i2=g4.indexOf('T2 D1');A(i2>0&&/CYCLE800/.test(g4.slice(i2)),'18b : plan recommandé après le 2e changement d’outil');",
  " const g5=faoPost(s,'fagor8065').code;A(!/CYCLE800|WORKPIECE/.test(g5),'18c : Fagor : ni CYCLE800 ni WORKPIECE');}",
  // ancien 3+2 du posage : pivotement du plan B/C inverse
  "s.orient={b:-30,c:10};{const gl=faoPost(s,'siemens1520').code;A(/CYCLE800\\(1,\"TABLE\",0,27,0,0,0,-10\\.000,30\\.000,0\\.000,/.test(gl),'19 : ancien 3+2 du posage (B−30 C10) : plan pivoté C−10 B30');}",
  "delete s.orient;",
  // sens de pivotement (_DIR) réglable par machine : plateau tourné vers les outils
  "op.frame={z:'+X',x:'+Y'};delete op.z;faoMachine({id:'tstDir',kind:'siemens',label:'Essai DIR',swivel:'cycle800',swivelDir:-1});",
  "{const gd=faoPost(s,'tstDir').code;A(/CYCLE800\\(1,\"TABLE\",0,27,0,0,0,90\\.000,0\\.000,90\\.000,0,0,0,-1,,1\\)/.test(gd)&&!/,0,0,0,1,,1\\)/.test(gd),'20 : swivelDir −1 : _DIR = −1 sur tous les CYCLE800');}",
  "A(/,0,0,0,1,,1\\)/.test(faoPost(s,'siemens630').code),'21 : 630 par défaut : _DIR = +1 (comme le post Fusion)');",
  "out",
].join('\n');
let res;
try{res=vm.runInContext(R,ctx);}catch(e){console.log('FATAL',e.stack);process.exit(1);}
res.log.forEach(m=>console.log('  ok',m));
res.fails.forEach(m=>console.log('  ÉCHEC',m));
console.log(res.fails.length?('test_post_cycle800 : '+res.fails.length+' échec(s)'):('test_post_cycle800 : '+res.log.length+'/'+res.log.length+' OK'));
process.exit(res.fails.length?1:0);
