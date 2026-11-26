// 2026-11-26 : PLAN — « Mise en plan, traits d'axes → mettre en surbrillance légère les traits qui servent
// à leur réalisation ». Trait d'axe sélectionné (ou en cours de création) : ses traits d'origine sont
// soulignés (classe mepAxisSrc), et eux seuls ; avec l'outil Axes, dès le survol et juste après la création. Partie 1 sans noyau (vue DXF, valeurs à la main) ;
// partie 2 sur le vrai noyau : perçage (cercle de bout, parois de côté) et cylindre extrudé.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  // ───────── partie 1 : vue DXF
  {
    const {ctx}=loadApp();
    vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};rebuild=function(){};showAll=function(){};applyView=function(){};refreshParts=function(){};',ctx);
    const r=vm.runInContext(`(function(){
      const o={};
      mepSetActive(true);
      const T=window.__mepTest,sh=T.sheet();
      sh.views.length=0;sh.dims.length=0;
      // vue de dessus (repère : x → u, y → v), à (100,100), échelle 2
      const v={id:'vA',kind:'base',dir:[0,0,1],u:[1,0,0],v:[0,1,0],x:100,y:100,scale:2,mode:'hide',tangent:false,flip:false,axes:[]};
      sh.views.push(v);T.st().zoom=1;
      const els=[
        {t:'L',x1:-30,y1:-30,x2:30,y2:-30},{t:'L',x1:30,y1:-30,x2:30,y2:30},{t:'L',x1:30,y1:30,x2:-30,y2:30},{t:'L',x1:-30,y1:30,x2:-30,y2:-30}, // 0-3 contour
        {t:'L',x1:-10,y1:-20,x2:-10,y2:20},{t:'L',x1:10,y1:-20,x2:10,y2:20}, // 4-5 deux droites parallèles
        {t:'L',x1:20,y1:-20,x2:20,y2:20}, // 6 une troisième, jamais prise
        {t:'C',cx:15,cy:15,r:3},{t:'C',cx:-15,cy:15,r:3},{t:'C',cx:-15,cy:-15,r:5}, // 7-9 cercles
        // 10-13 oblong : centres (-5,-25) et (5,-25), R2
        {t:'A',cx:-5,cy:-25,r:2,a0:Math.PI/2,a1:3*Math.PI/2},{t:'A',cx:5,cy:-25,r:2,a0:-Math.PI/2,a1:Math.PI/2},
        {t:'L',x1:-5,y1:-23,x2:5,y2:-23},{t:'L',x1:-5,y1:-27,x2:5,y2:-27}];
      T.setViewGeo(v,{src:'dxf',els});
      const sel=id=>{T.selAxis(id?{vid:v.id,id,ak:'m'+id+'.0'}:null);return T.axisSrc(v).join();};
      // 1. axe de symétrie : ses 2 droites
      v.axes.push({id:'axS',kind:'sym',l1:Object.assign({},els[4]),l2:Object.assign({},els[5])});
      o.sym=sel('axS');
      // dessin : un halo par trait d'origine, aux coordonnées de la planche
      const drawn=[];T.drawAxisSrc((tag,at)=>{drawn.push(Object.assign({tag},at));return{};},v);
      o.drawn=drawn.map(d=>d.tag+':'+d.class+':'+d.x1+','+d.y1+','+d.x2+','+d.y2);
      // 2. trou sur un cercle de la vue : ce cercle seul
      v.axes.push({id:'axC',kind:'hole',ref:{vid:v.id,c:{cx:15,cy:15,r:3}}});
      o.hole=sel('axC');
      const dc=[];sel('axC');T.drawAxisSrc((tag,at)=>{dc.push(Object.assign({tag},at));return{};},v);
      o.drawnC=dc.map(d=>d.tag+':'+d.cx+','+d.cy+','+d.r);
      // 3. alignement de 2 trous : les 2 cercles
      v.axes.push({id:'axL',kind:'align',refs:[{vid:v.id,c:{cx:15,cy:15,r:3}},{vid:v.id,c:{cx:-15,cy:15,r:3}}]});
      o.align=sel('axL');
      // 4. axe libre : rien
      v.axes.push({id:'axF',kind:'free',a:{x:-25,y:0},b:{x:25,y:0}});
      o.free=sel('axF');
      // 5. rien de sélectionné : rien
      o.none=sel(null);
      // 6. oblong en automatique : ses 2 bouts et ses 2 côtés
      v.autoAxes=true;
      const L=T.axisLines(v),ps=L.filter(p=>!p.ann&&p.src&&p.src[0]&&p.src[0].slot);
      o.slotAuto=ps.length;
      T.selAxis(ps[0]?{vid:v.id,id:null,ak:ps[0].ak}:null);o.slot=T.axisSrc(v).join();
      v.autoAxes=false;
      // 7. création : 1re droite d'un axe de symétrie soulignée dès le 1er clic
      T.selAxis(null);
      T.setAxisMode('sym');
      T.axisClick({x:100-10*2,y:100+5*2});
      o.symPick=T.axisSrc(v).join();
      T.axisClick({x:100+10*2,y:100+5*2});
      o.symDone=T.axisSrc(v).join();o.nAxes=v.axes.length;
      // 7b. survol (outil Axes, mode trou) : ce que prendrait le clic s'allume avant le clic, puis reste allumé
      T.setAxisMode('hole');
      o.hovNew=T.axisSrc(v).join(); // autre mode : l'axe précédent n'est plus allumé
      T.axisHover({x:100-15*2-5*2,y:100-15*2});o.hov9=T.axisSrc(v).join();
      T.axisHover({x:100,y:54});o.hovSlot=T.axisSrc(v).join(); // côté de l'oblong : tout l'oblong
      T.axisHover({x:100+25*2,y:100+5*2});o.hovRien=T.axisSrc(v).join();
      T.axisClick({x:100-15*2-5*2,y:100-15*2});
      const nw=T.axisNew();o.newKind=nw&&(v.axes.find(a=>a.id===nw.id)||{}).kind;
      T.axisHover({x:100+25*2,y:100+5*2});o.apresClic=T.axisSrc(v).join(); // souris ailleurs : l'axe créé reste allumé
      T.axisHover({x:100+15*2+3*2,y:100+15*2});o.newEtHov=T.axisSrc(v).join(); // + le trou survolé
      T.setAxisMode('free');T.axisHover({x:100-15*2-5*2,y:100-15*2});o.hovLibre=T.axisSrc(v).join();
      mepSetTool('select');o.quitte=T.axisSrc(v).join();
      o.apres=nw?sel(nw.id):''; // après : sélectionné plus tard, il se rallume
      T.selAxis(null);
      // 8. création : trous choisis pour un alignement
      T.setAxisMode('align');
      T.axisClick({x:100+15*2+3*2,y:100+15*2});T.axisClick({x:100-15*2+3*2,y:100+15*2});
      o.pick=T.axisPick().length;o.alignPick=T.axisSrc(v).join();
      mepSetTool('select');o.afterTool=T.axisSrc(v).join();
      // 9. révolution du solide : de côté, génératrices dans la longueur ; de bout, cercles concentriques
      o.revSide=T.axisSrcMatch(v,{rev:{o:[0,0,0],d:[0,1,0],t0:-20,t1:20,r:10,rs:[10]}}).join();
      o.revEnd=T.axisSrcMatch(v,{rev:{o:[15,-15,0],d:[0,0,1],t0:0,t1:5,r:3,rs:[3]}}).join(); // y planche = −v : le cercle (15,15) de la vue
      o.revBout=T.axisSrcMatch(v,{rev:{o:[0,0,0],d:[0,1,0],t0:-30,t1:30,r:30,rs:[30]}}).join(); // arêtes vues par la tranche
      // 9b. bords dessinés en petits segments (trou qui débouche dans une face courbe) — autre vue
      const vB={id:'vB',kind:'base',dir:[0,0,1],u:[1,0,0],v:[0,1,0],x:300,y:100,scale:1,mode:'hide',tangent:false,flip:false,axes:[]};
      sh.views.push(vB);
      const cs=a=>[40+2.5*Math.cos(a),2.5*Math.sin(a)];
      T.setViewGeo(vB,{src:'dxf',els:[
        {t:'L',x1:-2.5,y1:-2,x2:-1.5,y2:-1},{t:'L',x1:-1.5,y1:-1,x2:0,y2:-0.5},{t:'L',x1:0,y1:-0.5,x2:1.5,y2:-1},{t:'L',x1:1.5,y1:-1,x2:2.5,y2:-2}, // 0-3 sortie au bout
        {t:'L',x1:-1,y1:-11,x2:1,y2:-13}, // 4 trou en travers, au milieu
        {t:'L',x1:-2.5,y1:-3,x2:-2.5,y2:-22}, // 5 génératrice
        {t:'L',x1:cs(0)[0],y1:cs(0)[1],x2:cs(0.5)[0],y2:cs(0.5)[1]},{t:'L',x1:cs(0.5)[0],y1:cs(0.5)[1],x2:cs(1)[0],y2:cs(1)[1]}, // 6-7 cercle en segments
        {t:'L',x1:40,y1:0,x2:43,y2:1}, // 8 depuis le centre
        {t:'P',pts:[cs(2),cs(2.5),cs(3)]}]}); // 9 polyligne sur le cercle
      o.segCote=T.axisSrcMatch(vB,{rev:{o:[0,0,0],d:[0,1,0],t0:0,t1:25,r:2.5,rs:[2.5]}}).join();
      o.segBout=T.axisSrcMatch(vB,{rev:{o:[40,0,0],d:[0,0,1],t0:0,t1:5,r:2.5,rs:[2.5]}}).join();
      sh.views.splice(sh.views.indexOf(vB),1);
      // 9c. « L'illumination des arêtes ne fonctionne pas avec la fonction Symétrie des Axes » : arête faite
      //     d'un long trait et de morceaux posés dessus (comme Support Pédale) — toute l'arête s'allume
      const vS={id:'vS',kind:'base',dir:[0,0,1],u:[1,0,0],v:[0,1,0],x:500,y:100,scale:1,mode:'hide',tangent:false,flip:false,axes:[]};
      sh.views.push(vS);
      T.setViewGeo(vS,{src:'dxf',els:[
        {t:'L',x1:0,y1:0,x2:0,y2:40},{t:'L',x1:0,y1:10,x2:0,y2:20},{t:'L',x1:0,y1:40,x2:0,y2:50}, // 0-2 arête gauche : long, morceau dessus, suite qui touche
        {t:'L',x1:0,y1:60,x2:0,y2:70}, // 3 alignée mais après un vide : pas la même arête
        {t:'L',x1:20,y1:0,x2:20,y2:50},{t:'L',x1:20,y1:20,x2:20,y2:30}, // 4-5 arête droite et son morceau
        {t:'L',x1:0.5,y1:0,x2:0.5,y2:50}]}); // 6 parallèle tout près, pas alignée
      T.selAxis(null);T.setAxisMode('sym');
      T.axisHover({x:500,y:115});o.symHovEdge=T.axisSrc(vS).join();
      T.axisClick({x:500,y:115});T.axisClick({x:520,y:125});
      T.axisHover({x:600,y:300});o.symNewEdge=T.axisSrc(vS).join();
      mepSetTool('select');
      const axS=vS.axes[vS.axes.length-1];o.symSelEdge=axS&&axS.kind==='sym'?(T.selAxis({vid:vS.id,id:axS.id,ak:'m'+axS.id+'.0'}),T.axisSrc(vS).join()):'';
      T.selAxis(null);
      sh.views.splice(sh.views.indexOf(vS),1);
      // 10. export (SVG, PDF, impression) : le halo ne sort jamais
      const gone=[],node={parentNode:{removeChild:n=>gone.push(n)}};
      const clone={style:{setProperty(){},removeProperty(){}},querySelectorAll:s=>String(s).split(',').indexOf('.mepAxisSrc')>=0?[node]:[]};
      T.exportPrep(clone,false);o.export=gone.length;
      return o;
    })()`,ctx);
    console.log('  · '+JSON.stringify(r));
    A(r.sym==='4,5','axe de symétrie sélectionné : ses 2 droites soulignées, pas la 3e parallèle');
    A(r.drawn.length===2&&r.drawn.every(d=>/^line:mepAxisSrc:/.test(d))&&r.drawn[0]==='line:mepAxisSrc:80,60,80,140','halo dessiné sous chaque droite, en coordonnées de planche');
    A(r.hole==='7','axe d’un cercle de la vue : ce cercle seul');
    A(r.drawnC.length===1&&r.drawnC[0]==='circle:130,130,6','halo du cercle à l’échelle de la vue (R3 × 2)');
    A(r.align==='7,8','alignement : les 2 cercles alignés, pas le 3e');
    A(r.free==='','axe libre : aucun trait d’origine');
    A(r.none==='','aucun axe sélectionné : rien de souligné');
    A(r.slotAuto>0&&r.slot==='10,11,12,13','oblong automatique : ses 2 bouts et ses 2 côtés');
    A(r.symPick==='4','création d’un axe de symétrie : la 1re droite soulignée dès le 1er clic');
    A(r.symDone==='4,5'&&r.nAxes===5,'2e droite : axe créé, ses 2 droites restent allumées');
    A(r.hovNew==='','changement de mode : l’axe précédent s’éteint');
    A(r.hov9==='9','survol d’un cercle (mode trou) : il s’allume avant le clic');
    A(r.hovSlot==='10,11,12,13','survol d’un côté d’oblong : tout l’oblong s’allume');
    A(r.hovRien==='','survol du vide : rien');
    A(r.newKind==='hole','clic : axe de trou créé');
    A(r.apresClic==='9','juste après la création, souris ailleurs : son cercle reste allumé');
    A(r.newEtHov==='7,9','axe créé + trou survolé : les deux allumés');
    A(r.hovLibre==='','axe libre : rien au survol');
    A(r.quitte==='','outil quitté : plus rien d’allumé');
    A(r.apres==='9','après : l’axe sélectionné plus tard rallume son cercle');
    A(r.pick===2&&r.alignPick==='7,8','création d’un alignement : les trous choisis soulignés');
    A(r.afterTool==='','outil quitté : plus rien de souligné');
    A(r.revSide==='4,5','révolution vue de côté : génératrices dans la longueur, rien d’autre');
    A(r.revEnd==='7','révolution vue de bout : son cercle seul');
    A(r.revBout.split(',').indexOf('0')>=0&&r.revBout.split(',').indexOf('2')>=0&&r.revBout.split(',').indexOf('4')<0,'révolution de côté : arêtes vues par la tranche aux 2 bouts, pas les droites hors rayon');
    A(r.segCote==='0,1,2,3,5','de côté : sortie en petits segments au bout et génératrice ; pas un trou en travers au milieu');
    A(r.segBout==='6,7,9','de bout : cercle dessiné en segments ou en polyligne ; pas un trait partant du centre');
    A(r.symHovEdge==='0,1,2','Symétrie, survol d’un morceau d’arête : toute l’arête alignée s’allume (pas la partie après un vide, ni la parallèle voisine) — '+r.symHovEdge);
    A(r.symNewEdge==='0,1,2,4,5','Symétrie, axe créé : ses 2 arêtes entières restent allumées — '+r.symNewEdge);
    A(r.symSelEdge==='0,1,2,4,5','axe de symétrie sélectionné ensuite : ses 2 arêtes entières — '+r.symSelEdge);
    A(r.export===1,'export : le halo est retiré');
  }
  // ───────── partie 2 : vrai noyau
  {
    const real=await require('./noyau.cjs').charger();
    const {ctx,sandbox}=loadApp();
    sandbox.__realOcct=real;
    vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};showAll=function(){};',ctx);
    const r=await vm.runInContext(`(async()=>{
      const out={},T=window.__mepTest;
      const rect=(id,z,x0,y0,x1,y1)=>({id,name:id,plane:'XY',origin:[0,0,z],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
        points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},
        entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],
        constraints:[],dims:[],seq:20,visible:false});
      const pts=(id,list)=>{const P={},E=[];list.forEach((q,i)=>{P['h'+i]={x:q[0],y:q[1]};E.push({id:'e'+i,t:'cpoint',p:'h'+i,hole:true});});
        return {id,name:id,plane:'XY',origin:[0,0,30],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:P,entities:E,constraints:[],dims:[],seq:30,visible:false};};
      mepSetActive(true);
      const sh=doc.mep.sheets[doc.mep.cur];
      const COM={kind:'base',x:100,y:100,scale:1,mode:'dash',tangent:false,hlrExact:true,axes:[],autoAxes:true};
      const DESSUS=Object.assign({id:'vDessus',dir:[0,0,1],u:[1,0,0],v:[0,-1,0]},COM);
      const FACE=Object.assign({id:'vFace',dir:[0,-1,0],u:[1,0,0],v:[0,0,-1]},COM,{y:220}); // sous la vue de dessus, sans chevauchement
      const vues=()=>{sh.views=[DESSUS,FACE].map(v=>JSON.parse(JSON.stringify(v)));sh.dims=[];T.geoClear();
        return{dessus:sh.views[0],face:sh.views[1]};};
      const els=v=>T.geo(v).els;
      const desc=(v,idx)=>idx.map(i=>{const e=els(v)[i];return e.t==='L'?['L',e.x1,e.y1,e.x2,e.y2].map(q=>typeof q==='number'?+q.toFixed(2):q).join(' '):[e.t,e.cx,e.cy,e.r].map(q=>typeof q==='number'?+q.toFixed(2):q).join(' ');});
      // a) bloc 100 × 60 × 30, trou Ø8 débouchant en (50,30)
      doc.sketches=[rect('skB',0,0,0,100,60),pts('skH',[[50,30]])];
      doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skB',distance:30,op:'add',visible:true}];
      doc.bodies=[];delete doc.activeBody;markDirty();rebuild();
      askHole('skH');
      const f=doc.features[doc.features.length-1];Object.assign(f,{d:8,end:'through'});f.name=holeName(f);
      markDirty();rebuild();
      let V=vues();
      const pick=(v,cls)=>{const p=T.axisLines(v).find(q=>!q.ann&&q.cls===cls&&q.src);T.selAxis(p?{vid:v.id,id:null,ak:p.ak}:null);return p?desc(v,T.axisSrc(v)):null;};
      out.croix=pick(V.dessus,'mepAxisCross');
      out.cote=pick(V.face,'mepAxis');
      // axe posé à la main d'un clic sur le cercle du trou (outil Axes), vue de dessus
      T.selAxis(null);T.setAxisMode('hole');
      V.dessus.autoAxes=false;T.axisHover({x:100+54,y:100-30});out.survol=desc(V.dessus,T.axisSrc(V.dessus));
      T.axisClick({x:100+54,y:100-30});T.axisHover({x:100+90,y:100-55});out.neuf=desc(V.dessus,T.axisSrc(V.dessus));
      const an=V.dessus.axes[V.dessus.axes.length-1];
      out.main=an&&an.ref&&an.ref.fid?(T.selAxis({vid:'vDessus',id:an.id,ak:'m'+an.id+'.0'}),desc(V.dessus,T.axisSrc(V.dessus))):null;
      // perçage vu de côté, référence Perçage (fid) : les parois sont retrouvées sur la fonction
      out.mainCote=an?desc(V.face,T.axisSrcMatch(V.face,{hole:{fid:an.ref.fid,pid:an.ref.pid,x:50,y:-30,r:4,facing:NaN,dir2:[NaN,NaN]}})):null;
      // b) cercle Ø20 en (5,7) extrudé de 30 : cylindre (révolution du solide exact)
      doc.sketches=[{id:'sk_c',name:'sk_c',plane:'XY',origin:[0,0,0],points:{c:{x:5,y:7}},entities:[{id:'e',t:'circle',pc:'c',r:10}],constraints:[],dims:[]}];
      doc.features=[{id:'ex_c',type:'extrude',name:'Cylindre',sketchId:'sk_c',op:'add',distance:30,visible:true}];
      doc.bodies=[];delete doc.activeBody;markDirty();rebuild();
      V=vues();
      out.cylBout=pick(V.dessus,'mepAxisCross');
      out.cylCote=pick(V.face,'mepAxis');
      return out;
    })()`,ctx);
    console.log('  · '+JSON.stringify(r));
    A(Array.isArray(r.croix)&&r.croix.length>=1&&r.croix.every(s=>/^C 50 -30 4$/.test(s)),'perçage vu de bout : croix sélectionnée → le cercle Ø8 du trou seul');
    const murs=a=>Array.isArray(a)&&a.length>=2&&a.every(s=>/^L (46|54) -?\d/.test(s)&&s.split(' ')[1]===s.split(' ')[3])&&a.some(s=>s.split(' ')[1]==='46')&&a.some(s=>s.split(' ')[1]==='54');
    A(murs(r.cote),'perçage vu de côté : trait d’axe automatique → les 2 parois (x 46 et 54) seules');
    const cercle=a=>Array.isArray(a)&&a.length>=1&&a.every(s=>/^C 50 -30 4$/.test(s));
    A(cercle(r.survol),'outil Axes, survol du trou : son cercle s’allume avant le clic');
    A(cercle(r.neuf),'trou cliqué, souris ailleurs : le cercle de l’axe créé reste allumé');
    A(Array.isArray(r.main)&&r.main.length>=1&&r.main.every(s=>/^C 50 -30 4$/.test(s)),'axe posé à la main d’un clic sur le trou → le cercle du trou');
    A(murs(r.mainCote),'même perçage vu de côté (référence Perçage) → les 2 parois');
    A(Array.isArray(r.cylBout)&&r.cylBout.length>=1&&r.cylBout.every(s=>/^[CA] 5 -7 10$/.test(s)),'cylindre vu de bout : son cercle R10');
    const cyl=Array.isArray(r.cylCote)?r.cylCote:[];
    A(cyl.some(s=>/^L -5 /.test(s))&&cyl.some(s=>/^L 15 /.test(s)),'cylindre vu de côté : ses 2 génératrices');
    A(cyl.filter(s=>{const q=s.split(' ').map(Number);return Math.abs(q[2]-q[4])<0.01;}).length>=2,'cylindre vu de côté : ses 2 bouts vus par la tranche');
  }
  console.log(ko?'test_mep_axes_sources : '+ko+' échec(s)':'test_mep_axes_sources : OK');
  process.exit(ko?1:0);
})().catch(e=>{console.log('  ✗ '+(e&&e.stack||e));process.exit(1);});
