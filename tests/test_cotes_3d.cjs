// Cotes 3D pilotantes (V1.0.20 ; Fred, 27/11 : « un outil de cotation dans le
// monde CAO, mais sur la 3D… ces cotes pilotent le 3D… un peu comme le fait Inventor », « C'est un essai »).
// src/92-cotes-3d.js — lecture des noms de faces (fonction, entité, bout, trou), texte de la cote comme la
// mise en plan (±, écarts, classe ISO 286 réelle, précision, texte avant / après, référence entre
// parenthèses), règles des cadres de tolérance, Ø et profondeurs de la fonction Perçage, sécante sur une
// pièce simulée (valeur atteinte, refus, réglage sans effet, pente gardée), réglage tenu par une seule cote,
// enregistrement (serialiseObj / docFromSerial gardent doc.cotes3d), crochets posés dans les autres fichiers.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const racine=path.join(__dirname,'..');
const src=f=>fs.readFileSync(path.join(racine,'src',f),'utf8');
let ko=0;
const sandbox={console,Math,JSON,Map,Set,WeakMap,Array,Object,Number,String,Boolean,Error,isFinite,parseFloat,
  performance:{now:()=>0},setTimeout:f=>{f();return 1;},clearTimeout(){},
  document:{getElementById(){return null;},head:{appendChild(){}},createElement(){return {};},activeElement:null,body:{dataset:{ws:'cao'}}}};
sandbox.window=sandbox;sandbox.addEventListener=()=>{};
const ctx=vm.createContext(sandbox);
vm.runInContext(src('05-iso286.js'),ctx,{filename:'05-iso286.js'});
vm.runInContext(fs.readFileSync(path.join(racine,'threejs','three.min.js'),'utf8'),ctx); // vrai three (arêtes : géométrie)
vm.runInContext('var doc={features:[],sketches:[],cotes3d:[]},rebuildDepth=0,builtEngine="exact",docUndoStack=[],__dirty=0,__built=0;'
  +'function docPushUndo(l){docUndoStack.push({label:l});}function markDirty(){__dirty++;}function viewWake(){}'
  +'function parDimUser(d){return d.type==="angle"?d.value*180/Math.PI:(d.dia?2*d.value:d.value);}'
  +'function parHolderVal(h,k){if(k==="qty"||k==="qty2")return (+h[k==="qty"?"copies":"copies2"]||1)+1;const v=+h[k];return k==="distance"?Math.abs(v):v;}'
  +'function parApplyAll(){}function parDimFromUser(d,u){return d.dia?u/2:u;}'
  +'function solveSketch(s){const d=(s.dims||[]).find(x=>x&&x.id==="d1");if(d&&s.points.p1)s.points.p1.x=-d.value;}',ctx);
vm.runInContext(src('92-cotes-3d.js'),ctx,{filename:'92-cotes-3d.js'});
const r=vm.runInContext(String.raw`(()=>{
  const out=[];const ok=(c,m)=>out.push([!!c,m]);
  // ── noms des faces ──
  const o1=c3Owner('ex_3/e6/flanc#2'),o2=c3Owner('ex_3/haut'),o3=c3Owner('ex_6_ab/e1/cercle/flanc'),o4=c3Owner('ho_8/c0/s1/f2'),o5=c3Owner('xf_4[ex_3/haut|ex_3/e6/flanc]');
  ok(o1.fid==='ex_3'&&o1.ent==='e6'&&o1.what==='flanc','côté d’extrusion : fonction + entité ('+JSON.stringify(o1)+')');
  ok(o2.what==='haut'&&o2.fid==='ex_3','bout d’extrusion');
  ok(o3.ent==='e1'&&o3.what==='flanc'&&o3.fid==='ex_6_ab','cercle entier : « …/e1/cercle/flanc » ('+JSON.stringify(o3)+')');
  ok(o4.what==='trou'&&o4.fid==='ho_8','face de Perçage');
  ok(o5.what==='conge'&&o5.fid==='xf_4','congé');
  ok(c3Owner('')===null,'nom vide');
  // ── texte, comme la mise en plan ──
  const D=o=>Object.assign({k:'plans',drive:{t:'feat',f:'x',k:'distance'},tol:null,pre:'',post:'',prec:null,gdt:[]},o);
  ok(c3Text(D({}),120)==='120','cote seule : '+c3Text(D({}),120));
  ok(c3Text(D({drive:null}),35)==='(35)','référence entre parenthèses');
  ok(c3Text(D({tol:{m:'pm',s:0.1}}),120)==='120 ±0,1','± : '+c3Text(D({tol:{m:'pm',s:0.1}}),120));
  ok(c3Text(D({tol:{m:'dbl',hi:0.05,lo:-0.02}}),20)==='20 +0,05 / −0,02','écarts : '+c3Text(D({tol:{m:'dbl',hi:0.05,lo:-0.02}}),20));
  ok(c3Text(D({k:'dia',tol:{m:'cls',cls:'H7'}}),10)==='Ø10 H7 (+0,015 / 0)','classe ISO 286 réelle : '+c3Text(D({k:'dia',tol:{m:'cls',cls:'H7'}}),10));
  ok(c3Text(D({k:'dia',tol:{m:'cls',cls:'H7/g6'}}),10)==='Ø10 H7/g6','ajustement : la classe seule');
  ok(c3Text(D({prec:2}),8)==='8,00','précision');
  ok(c3Text(D({pre:'2×',post:'mini'}),6.5)==='2× 6,5 mini','texte avant / après');
  ok(Math.abs(c3Mid(D({k:'dia',tol:{m:'cls',cls:'H7'}}),10)-10.0075)<1e-9,'FAO : milieu de la tolérance (10,0075)');
  ok(c3Mid(D({}),10)===10,'sans tolérance : nominal');
  ok(c3Parse('12,5')===12.5&&c3Parse('Ø8')===8&&isNaN(c3Parse('abc')),'saisie : virgule, Ø, refus');
  // ── cadres de tolérance (règles de la mise en plan) ──
  ok(c3GdtCheck({sym:'flat',val:0.05,refs:[{l:'A'}]})!=='','forme : pas de référence');
  ok(c3GdtCheck({sym:'par',val:0.05,refs:[]})!=='','parallélisme : référence obligatoire');
  ok(c3GdtCheck({sym:'pos',dia:true,val:0.05,refs:[{l:'A'}]})==='','localisation correcte');
  ok(c3GdtCheck({sym:'perp',val:0,refs:[{l:'A'}]})!=='','zone nulle refusée');
  ok(C3_GDT.length===14,'14 caractéristiques');
  ok(c3FcfHtml({sym:'pos',dia:true,val:0.05,mod:'M',refs:[{l:'A',m:''},{l:'B',m:'M'}]}).indexOf('Ø0,05 Ⓜ')>0,'cadre : Ø0,05 Ⓜ');
  // ── fonction Perçage : quel réglage ──
  const ho={type:'hole',kind:'cbore',d:6.6,cbD:11,cbH:6.4,end:'blind',depth:15};
  ok(JSON.stringify(c3HoleKeys(ho,{k:'dia',v:11}))==='[["cbD",1]]','Ø11 d’un lamage → Ø lamage');
  ok(JSON.stringify(c3HoleKeys(ho,{k:'dia',v:6.6}))==='[["d",1]]','Ø6,6 → Ø de perçage');
  ok(c3HoleKeys(ho,{k:'plans',v:6.4}).map(x=>x[0]).join()==='cbH,depth','profondeurs : lamage puis perçage');
  ok(c3HoleKeys(Object.assign({},ho,{kind:'simple',end:'through'}),{k:'plans',v:1}).length===0,'débouchant simple : pas de profondeur');
  // ── sécante sur une pièce simulée ──
  {let p=-6,n=0;const meas=q=>Math.abs(q);const R=c3Secant({p0:p,v0:6,T:8,s0:null,apply:q=>{n++;p=q;return {v:meas(q)};}});
   ok(R.ok&&Math.abs(R.v-8)<1e-4&&Math.abs(p+8)<1e-6,'découpe vers le bas (pente −1 devinée) : 6 → 8 en '+n+' rejeux');}
  {let n=0;const R=c3Secant({p0:100,v0:80,T:120,s0:1,apply:q=>{n++;return {v:q-20};}});
   ok(R.ok&&n===1&&Math.abs(R.s-1)<1e-9,'pente connue : un seul rejeu');}
  {const R=c3Secant({p0:10,v0:10,T:12,s0:null,apply:q=>({v:10+0.5*(q-10)+0.02*(q-10)*(q-10)})});
   ok(R.ok&&Math.abs(R.v-12)<1e-4,'cote non linéaire atteinte');}
  {const R=c3Secant({p0:5,v0:3,T:4,s0:null,apply:()=>({v:3})});ok(!R.ok&&/ne change pas/.test(R.msg),'réglage sans effet : '+R.msg);}
  {const R=c3Secant({p0:12,v0:8,T:25,s0:1,apply:()=>({err:'la 2e face n’existe plus'})});ok(!R.ok&&/n’existe plus/.test(R.msg),'rejeu en échec : la raison');}
  {let n=0;const R=c3Secant({p0:12,v0:8,T:9,s0:null,apply:q=>{n++;return q>12?{err:'non'}:{v:8-(q-12)};}});ok(R.ok&&Math.abs(R.v-9)<1e-4,'mauvais sens d’abord : l’autre sens ('+n+' rejeux)');}
  // ── c3SetValue : rejeu simulé, une annulation, retour en cas d'échec ──
  doc.features=[{id:'ex_1',type:'extrude',name:'Bloc',distance:20}];doc.cotes3d=[];
  globalThis.parSetFeat=(h,k,f,ex)=>{const v=parseFloat(ex);if(!(v>0))return 'valeur > 0';h[k]=v;return true;};
  globalThis.parSetDim=()=>true;globalThis.rebuild=()=>{__built++;};globalThis.occHas=()=>true;
  const d=c3New({nom:'ex_1/haut'},{nom:'ex_1/bas'},'plans');d.drive={t:'feat',f:'ex_1',k:'distance'};doc.cotes3d.push(d);
  globalThis.c3Read=x=>{const f=doc.features[0];return f.distance>30?{err:'trop haut'}:{v:f.distance,k:'plans'};};
  docUndoStack.length=0;
  ok(c3SetValue(d,25)===true&&doc.features[0].distance===25&&d.v===25,'25 tapé → distance 25');
  ok(docUndoStack.length===1,'une seule annulation');
  const m=c3SetValue(d,40);
  ok(m!==true&&/trop haut/.test(m)&&doc.features[0].distance===25,'40 refusé, la pièce revient (distance '+doc.features[0].distance+') : '+m);
  ok(docUndoStack.length===1,'refus : pas d’annulation en plus');
  ok(c3SetValue(Object.assign({},d,{drive:null}),30)!==true,'cote de référence : ne pilote rien');
  // ── un réglage, une seule cote pilotante ──
  const d2=c3New({nom:'ex_1/haut'},{nom:'ex_1/bas'},'plans');doc.cotes3d.push(d2);
  const pris=c3SetDrive(d2,{t:'feat',f:'ex_1',k:'distance'});
  ok(pris===d&&d.drive===null&&d2.drive&&d2.drive.k==='distance','« À la place de » : l’autre cote passe en référence');
  ok(c3Holder({t:'feat',f:'ex_1',k:'distance'},null)===d2,'réglage tenu');
  // ── la pièce passe de 20 à 30 (rejeux intermédiaires image par image) ──
  doc.features[0].distance=20;const vus=[],q=[],ps=globalThis.parSetFeat;
  globalThis.parSetFeat=(h,k,f,ex)=>{vus.push(+ex);return ps(h,k,f,ex);};
  globalThis.requestAnimationFrame=f=>q.push(f);globalThis.matchMedia=()=>({matches:false});
  ok(c3AnimStart({t:'feat',f:'ex_1',k:'distance'},20,30,20)===true,'mouvement lancé (rejeu de 20 ms)');
  ok(vus.length===1&&vus[0]>20&&vus[0]<30,'1re position tout de suite : '+vus[0]);
  while(q.length)q.shift()();
  ok(vus.length>=4&&vus.every((v,i)=>!i||v>=vus[i-1])&&doc.features[0].distance===30,'20 → 30 en passant par '+vus.map(v=>c3Num(v)).join(' → '));
  ok(c3AnimStart({t:'feat',f:'ex_1',k:'distance'},30,40,500)===false,'rejeu trop lent (500 ms) : pas de mouvement');
  vus.length=0;c3AnimStart({t:'feat',f:'ex_1',k:'distance'},30,20,20);doc.features[0].distance=31;while(q.length)q.shift()();
  ok(doc.features[0].distance===31,'réglage changé par ailleurs pendant le mouvement : on s’arrête sans rien forcer');
  globalThis.parSetFeat=ps;delete globalThis.requestAnimationFrame;
  // ── références, rugosité, angle ──
  doc.cotes3d=[{id:'n1',k:'datum',l:'A'}];
  ok(c3Text({k:'datum',l:'A'},0)==='A','référence : sa lettre');
  ok(c3NextLetter()==='B','référence suivante : B après A');
  ok(/Ra 1,6/.test(c3Text({k:'rough',r:{par:'Ra',val:1.6,proc:'any'}},0)),'rugosité : '+c3Text({k:'rough',r:{par:'Ra',val:1.6,proc:'any'}},0));
  ok(c3Text(D({k:'angle'}),70)==='70°','angle : '+c3Text(D({k:'angle'}),70));
  // ── trous de Perçage ──
  doc.cotes3d=[];
  doc.sketches=[{id:'s2'}];globalThis.holePoints=()=>[{id:'h1',x:-25,y:0},{id:'h2',x:25,y:0}];
  doc.features=[{id:'ho_4',type:'hole',sketchId:'s2',kind:'cbore',d:6.6,cbD:11,cbH:6.4,end:'through'},{id:'ex_1',type:'extrude'}];
  ok(c3Owner('ho_4/~3').what==='trou','face « ho_4/~3 » d’un Perçage (lamé débouchant) = trou');
  ok(c3Owner('ex_1/~2').what==='neuve','face « ~ » d’une extrusion : pas un trou');
  const dh=D({k:'dia',a:{nom:'ho_4/~3'},drive:{t:'feat',f:'ho_4',k:'cbD'}});
  ok(c3Text(dh,12)==='2× Ø6,6 déb. | ⌴ Ø12 ↧6,4','trou lamé entier sur la cote Ø : '+c3Text(dh,12));
  const HO=c3HoleOf(dh);ok(HO&&HO.n===2&&HO.key==='cbD'&&HO.parts.length===2,'c3HoleOf : 2 trous, lamage piloté');
  ok(c3AutoPre({k:'plans'})==='','pas de « 2× » sur une cote de distance');
  const skC={entities:[{id:'c1',t:'cpoint',p:'p1'},{id:'c2',t:'cpoint',p:'p2'}],points:{p1:{x:0,y:0},p2:{x:30,y:40}}};
  const fm=c3SkMeasureFn(skC,['c1','c2'],false,false);ok(fm&&Math.abs(fm(skC)-50)<1e-9,'entraxe de deux centres de perçage (50)');
  // ── toutes les valeurs du trou : chaque nombre connaît son réglage ──
  const HO2=c3HoleOf(dh);
  ok(HO2.parts[0].sp==='thru'&&HO2.parts[1].dk==='cbH'&&HO2.parts[1].dv===6.4,'trou lamé : Ø perçage débouchant, Ø lamage + profondeur cbH');
  ok(/data-hk="cbH"/.test(c3Html(dh,12))&&/data-hk="d"/.test(c3Html(dh,12)),'étiquette : Ø de perçage et profondeur du lamage cliquables');
  doc.features[0].end='blind';doc.features[0].depth=15;
  ok(c3HoleOf(dh).parts[0].dk==='depth'&&/↧15/.test(c3Text(dh,12)),'trou borgne : profondeur pilotable ('+c3Text(dh,12)+')');
  doc.features[0].end='through';
  ok(!/\(/.test(c3Text(Object.assign({},dh,{drive:null}),11)),'trou de référence : pas de parenthèses au milieu');
  // ── congé : rayon ──
  ok(c3IsRad(D({k:'dia',a:{nom:'congé[ex_1/e1/flanc|ex_1/e2/flanc]'}}))&&!c3IsRad(dh),'face de congé → cote R');
  ok(c3Text(D({k:'dia',a:{nom:'congé[a|b]'}}),5)==='R5','texte : R5');
  ok(c3DrvKey({t:'feat',f:'xf',k:'r',e:[0,2]})==='feat:xf:r:0,2','réglage d’arêtes de congé : clé distincte');
  ok(JSON.stringify(c3So({},-1))==='[-34,-46]'&&JSON.stringify(c3So({so:[10,-5]},1))==='[10,-5]','cote déportée : décalage par défaut et glissé');
  // ── cacher / montrer ──
  c3Hide(true);ok(c3.hidden===true,'Maj+D / œil : cotes cachées');
  c3Hide();ok(c3.hidden===false,'… et remontrées');
  // ── bossage, dessous, cacher par fonction ──
  const ob=c3Owner('ex_4/e1/haut');ok(ob&&ob.what==='haut'&&ob.ent==='e1','« ex_4/e1/haut » = dessus d’un bossage rond');
  const dA=D({k:'plans',a:{nom:'ex_1/haut'},b:{nom:'ex_1/bas'},drive:{t:'feat',f:'ex_1',k:'distance'}}),dB=D({k:'plans',a:{nom:'ho_4/~3'}});
  doc.cotes3d=[dA,dB];ok(c3FeatOf(dA)===doc.features[1]&&c3OfFeat('ex_1').length===1,'cote → sa fonction (clic droit : cacher ses cotes)');
  c3HideSet([dA],true);ok(dA.hid===true&&!dB.hid&&!c3.hidden,'cacher les cotes d’une fonction seulement');
  c3Eye();ok(!dA.hid&&!c3.hidden,'œil : quelque chose de caché → tout montrer');
  c3Eye();ok(c3.hidden===true,'œil : rien de caché → tout cacher');c3Hide(false);
  // ── cotes automatiques : réglage, dédoublonnage ──
  ok(typeof c3AutoNew==='function'&&typeof c3AutoFeat==='function'&&typeof c3AutoSketch==='function','cotes posées à la création : fonctions présentes');
  c3.autoQ=null;c3AutoNew({id:'ex_9'});ok(c3.autoQ.has('ex_9'),'fonction neuve mise en attente de ses cotes');
  ok(c3AutoRun()===0&&!c3.autoQ.size,'sans vue à l’écran : rien n’est posé (bancs), la file est vidée');
  doc.cotes3d=[dA];ok(c3AutoHas({t:'feat',f:'ex_1',k:'distance'})&&!c3AutoHas({t:'feat',f:'ex_1',k:'depth'}),'pas deux cotes pour le même réglage');
  // ── arêtes ──
  ok(JSON.stringify(c3SplitPair('a/e1/flanc|congé[b|c]'))==='["a/e1/flanc","congé[b|c]"]','nom d’arête : paire de faces (le | d’un congé ne coupe pas)');
  const V3=(x,y,z)=>new THREE.Vector3(x,y,z),Ln=(a,b)=>({kind:'line',a:V3(...a),b:V3(...b),u:V3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize(),pts:[V3(...a),V3(...b)]});
  const Ci=(c,r)=>({kind:'circle',c:V3(...c),ax:V3(0,0,1),r,closed:true,mid:V3(c[0]+r,c[1],c[2]),p0:V3(c[0]+r,c[1],c[2]),pts:[V3(c[0]+r,c[1],c[2]),V3(c[0],c[1]+r,c[2]),V3(c[0]-r,c[1],c[2])]});
  ok(Math.abs(c3EdgePair(Ln([-10,-30,20],[10,-30,20]),Ln([-10,30,20],[10,30,20])).v-60)<1e-9,'deux arêtes droites parallèles : 60');
  ok(/parallèles/.test(c3EdgePair(Ln([0,0,0],[10,0,0]),Ln([0,5,0],[0,15,0])).err||''),'arêtes non parallèles : refusé');
  const pe=c3EdgePair(Ci([-20,0,30],10),Ci([20,0,20],5));ok(pe.k==='entraxe'&&Math.abs(pe.v-40)<1e-9&&pe.ax,'deux arêtes circulaires : entraxe sur les axes (40, hauteurs différentes)');
  const pa=c3EdgePair(Ci([-20,0,30],10),Ln([50,-10,20],[50,10,20]));ok(pa.k==='axe'&&Math.abs(pa.v-70)<1e-9,'axe d’un cercle ↔ arête droite : mesuré dans le plan du cercle (70)');
  ok(c3IsRad(D({k:'dia',a:{edge:true,arc:true}}))&&!c3IsRad(D({k:'dia',a:{edge:true,circ:true}})),'arête en arc → R ; cercle plein → Ø');
  // ── lisibilité selon le fond ──
  c3.clair=false;ok(c3Col('bleu')===C3_BLEU&&c3Col('note')==='#e8edf5','fond sombre : couleurs claires');
  c3.clair=true;ok(c3Col('bleu')===C3_CLAIR.bleu&&c3Col('note')===C3_CLAIR.note,'fond clair : couleurs foncées');c3.clair=false;
  // ── cote encadrée, d'inspection, nom ──
  {const t=c3Text(D({fmt:'box',tol:{m:'pm',s:0.1}}),40);ok(t==='[40]','encadrée : pas de tolérance, cadre ('+t+')');}
  {const t=c3Text(D({fmt:'box',drive:null}),40);ok(t==='[40]','encadrée de référence : pas de parenthèses');}
  {const t=c3Text(D({fmt:'insp',insp:{lab:'A1',rate:'100%'},tol:{m:'pm',s:0.1}}),40);ok(t==='⟨A1 | 40 ±0,1 | 100%⟩','inspection : libellé | valeur | taux ('+t+')');}
  {const h=c3Html(D({fmt:'insp',insp:{lab:'A1',rate:'1/10'}}),40);ok(/class="ip"/.test(h)&&/A1/.test(h)&&/1\/10/.test(h),'inspection : ovale à trois cases');}
  {const h=c3Html(D({fmt:'box'}),40);ok(/class="bx"/.test(h),'encadrée : cadre dessiné');}
  {const save=doc.cotes3d;doc.cotes3d=[D({id:'n1',name:'Épaisseur'}),D({id:'n2'}),D({id:'n3',name:'d7'})];
    const L=doc.cotes3d;
    ok(c3Name(L[0])==='Épaisseur'&&c3Name(L[1])==='d2','nom donné, sinon dN selon le rang');
    ok(c3NameNext()==='d8','nom suivant après le plus grand dN');
    ok(c3Text(Object.assign(L[0],{show:'nom',tol:{m:'pm',s:0.1}}),20)==='Épaisseur','affichage : nom seul');
    ok(c3Text(Object.assign(L[0],{show:'both',tol:null}),20)==='Épaisseur = 20','affichage : nom = valeur');
    doc.cotes3d=save;}
  // ── chanfrein, coque, révolution, répétition ──
  {const o=c3Owner('chanfrein[ex_2/e1/flanc|ex_2/haut]');ok(o&&o.what==='chanfrein','face de chanfrein reconnue');}
  {const o=c3Owner('ex_2/e1/flanc/int');ok(o&&o.int&&o.what==='flanc'&&o.ent==='e1','face intérieure de coque : « …/int »');}
  {const d=D({k:'dia',a:{nom:'chanfrein[a|b]'}});ok(c3IsCham(d)&&c3IsRad(d),'chanfrein : coté seul, dessiné comme un rayon');
    C3G.set(d,{cham:true,l2:3,beta:45});ok(c3Text(d,3)==='3 × 45°','chanfrein égal : 3 × 45° ('+c3Text(d,3)+')');
    C3G.set(d,{cham:true,l2:5,beta:59});ok(c3Text(d,3)==='3 × 5','chanfrein à deux distances : 3 × 5');}
  {const save=doc.features;
    doc.features=[{id:'ex_1',type:'extrude'},{id:'ex_2',type:'extrude',sketchId:'s2'},{id:'rp_3',type:'repeat',mode:'lin',copies:2,dist:25,base:['ex_2']},{id:'ex_4',type:'extrude',repeatId:'rp_3',_src:'ex_2',repIndex:1},{id:'sh_5',type:'xshell',thick:2,faces:[]},{id:'rv_6',type:'revolve',angle:270}];
    ok(c3RepOf('ex_2')&&c3RepOf('ex_2').id==='rp_3'&&c3RepOf('ex_4').id==='rp_3'&&!c3RepOf('ex_1'),'répétition : source et exemplaire');
    ok(c3RepCount(c3RepOf('ex_2'))===3,'nombre de la répétition (original compris)');
    ok(c3FeatSrc('ex_4').id==='ex_2','exemplaire → sa source (ses réglages)');
    const C=c3Candidates(D({k:'plans',a:{nom:'ex_2/e1/flanc'},b:{nom:'ex_4/e1/flanc'}}));
    ok(C.some(c=>c.drv.f==='rp_3'&&c.drv.k==='dist'),'cote entre deux exemplaires : le pas');
    const S=c3Candidates(D({k:'plans',a:{nom:'ex_1/haut'},b:{nom:'ex_1/haut/int'}}));
    ok(S.length&&S[0].drv.f==='sh_5'&&S[0].drv.k==='thick','face ↔ face intérieure : l’épaisseur de la coque');
    const R=c3Candidates(D({k:'angle',a:{nom:'rv_6/bas'},b:{nom:'rv_6/haut'}}));
    ok(R.some(c=>c.drv.f==='rv_6'&&c.drv.k==='angle'),'faces de départ et de fin : l’angle de la révolution');
    doc.features=save;}
  // ── glissement : appariement des sommets face par face (Fred, 27/11 : « des glitchs au mouvement ») ──
  {const A=new Float32Array([0,0,0, 10,0,0, 10,5,0,  0,0,0, 10,5,0, 0,5,0]);               // rectangle, diagonale 0-2
   const B=new Float32Array([0,0,2, 10,0,2, 0,5.5,2,  10,0,2, 10,5.5,2, 0,5.5,2]);          // même rectangle monté, étiré, autre diagonale
   const p0=new Float32Array(18);ok(c3MorphFace(A,null,0,B,0,2,p0,null)&&p0[2]===0&&p0[7]===5&&p0[13]===5&&p0[12]===10,'diagonale inversée : chaque sommet retrouve le sien');
   const Cc=new Float32Array([0,0,0, 10,0,0, 7,5,0,  0,0,0, 7,5,0, 0,5,0]);                  // la face change de forme
   ok(!c3MorphFace(A,null,0,Cc,0,2,new Float32Array(18),null),'face qui change de forme : pas de glissement (vrais rejeux)');}
  // ── ordonnées 3D (famille reprise de l'esquisse) ──
  {const V=(x,y,z)=>new THREE.Vector3(x,y,z),pb=c3PartBox;c3PartBox=()=>new THREE.Box3(V(-50,-30,0),V(50,30,10));
   const d={ord:1,og:'s:X',oz:2,side:[0,-1,0],ordw:[0,0,1,10],off:8},g={k:'axe',p1:V(-30,10,0),p2:V(-50,10,0),n:V(-1,0,0)};
   const G=c3Geo(d,g),f=v=>v.toArray().map(x=>+x.toFixed(3)).join(',');
   ok(G.ord&&f(G.A)==='-50,10,10'&&f(G.B)==='-30,10,10','ordonnée face ↔ axe : le zéro est le bout de la face (oz 2), pieds au niveau du dessus');
   ok(f(G.A2)==='-50,-38,10'&&f(G.B2)==='-30,-38,10','valeurs alignées 8 mm au-delà de la pièce, du côté des valeurs de l’esquisse');
   const L=c3List(),n0=L.length,e={ord:1,og:'s:X',off:8},h={ord:1,og:'s:Y',off:8};L.push(d,e,h);d.off=15;c3OrdSync(d);
   ok(e.off===15&&h.off===8,'glisser une ordonnée : toute sa famille suit, pas les autres');L.length=n0;c3PartBox=pb;}
  // ── ordonnées : la valeur se lit le long de leur sens (centre à centre, trous pas alignés) ──
  {const V=(x,y,z)=>new THREE.Vector3(x,y,z);
   const g=c3OrdProj({ordN:[1,0,0]},{v:44.72,p1:V(-30,10,0),p2:V(10,-10,0),n:V(0.89,-0.45,0)});
   ok(Math.abs(g.v-40)<1e-9&&g.n.x===1,'ordonnée entre deux trous pas alignés : 40 le long de X (pas 44,7)');
   const h=c3OrdProj({ordN:[1,0,0]},{v:20,p1:V(10,0,0),p2:V(-10,0,0),n:V(-1,0,0)});
   ok(Math.abs(h.v-20)<1e-9&&h.n.x===-1,'ordonnée vers les x négatifs : valeur positive, sens retourné');
   ok(c3OrdProj({},{v:7}).v===7,'cote sans sens d’ordonnée : inchangée');}
  // ── sommets ; arête, sommet ↔ face ──
  {const V=(x,y,z)=>new THREE.Vector3(x,y,z),bx=p=>({c:p.clone(),h:V(0,0,0)});
   const pt=p=>({kind:'pt',p,box:bx(p)}),pl=(n,p)=>({kind:'plane',n:n.normalize(),p,box:bx(p)});
   const ln=(a,u)=>({kind:'line',a,u:u.normalize(),m:a.clone().addScaledVector(u,5),box:bx(a)});
   const ax=(c,a)=>({kind:'axis',c,ax:a.normalize(),box:bx(c)}),ci=(c,a,r)=>({kind:'circle',c,ax:a.normalize(),r,box:bx(c)});
   let r=c3MixPair(pt(V(50,-30,20)),pt(V(-50,-30,20)));ok(r.k==='plans'&&Math.abs(r.v-100)<1e-9,'sommet ↔ sommet : 100');
   r=c3MixPair(pt(V(50,-30,0)),pl(V(0,0,1),V(0,0,20)));ok(r.k==='plans'&&Math.abs(r.v-20)<1e-9,'sommet ↔ face : distance au plan');
   r=c3MixPair(pt(V(50,-30,20)),ax(V(-20,0,0),V(0,0,1)));ok(r.k==='axe'&&Math.abs(r.v-Math.hypot(70,30))<1e-9&&r.cyA&&!r.cyB&&r.p1.x===-20,'sommet ↔ trou : distance à l’axe, la cote part de l’axe');
   r=c3MixPair(ln(V(0,-30,0),V(1,0,0)),pl(V(0,0,1),V(0,0,20)));ok(r.k==='plans'&&Math.abs(r.v-20)<1e-9,'arête ↔ face parallèle : 20');
   r=c3MixPair(ln(V(0,-30,0),V(0,0,1)),pl(V(0,0,1),V(0,0,20)));ok(!!r.err,'arête ↔ face pas parallèle : refusée');
   r=c3MixPair(pl(V(1,0,0),V(50,0,0)),ci(V(-20,0,20),V(0,0,1),6));ok(r.k==='axe'&&Math.abs(r.v-70)<1e-9&&r.p1.x===-20,'face ↔ cercle d’un trou : 70, depuis l’axe');
   r=c3MixPair(ci(V(-20,0,20),V(0,0,1),6),pl(V(0,0,1),V(0,0,0)));ok(r.k==='plans'&&Math.abs(r.v-20)<1e-9,'cercle ↔ face parallèle à son plan : 20');
   r=c3MixPair(pl(V(0,0,1),V(0,0,0)),pl(V(0,0,1),V(0,0,5)));ok(!!r.err,'deux faces : pas par ce chemin');
   ok(c3SameEl({vtx:true,pos:[1,2,3]},{vtx:true,pos:[1,2,3.0001]})&&!c3SameEl({vtx:true,pos:[1,2,3]},{edge:true,en:'a',pos:[1,2,3]}),'même sommet reconnu, sommet ≠ arête');}
  // ── cercle de trous ISO : Ø de perçage, EQS, localisation (Fred, 27/11 : « la vraie norme ISO ») ──
  {const save=doc.features,sks=doc.sketches;
   doc.sketches=[{id:'s2',name:'Esquisse 2',points:{O:{x:0,y:0},p1:{x:-25,y:0}},entities:[{id:'e1',t:'circle',pc:'p1'}],dims:[]}];
   doc.features=[{id:'ex_1',type:'extrude'},{id:'ex_2',type:'extrude',op:'cut',sketchId:'s2'},{id:'rp_3',type:'repeat',mode:'circ',copies:5,base:['ex_2']},{id:'ex_4',type:'extrude',repeatId:'rp_3',_src:'ex_2',repIndex:1}];
   const rp=doc.features[2],H=D({k:'dia',a:{nom:'ex_2/e1/cercle/flanc'}});
   ok(c3RepFull(rp)&&!c3RepFull({mode:'circ',angle:180})&&!c3RepFull({mode:'lin'}),'tour complet : angle de 360° (ou absent) seulement');
   ok(c3CircRep(H.a)===rp&&c3CircRep({nom:'ex_4/e1/cercle/flanc'})===rp&&!c3CircRep({nom:'ex_1/haut'}),'trou d’une répétition circulaire (source ou exemplaire)');
   ok(c3Eqs(H)&&/EQS/.test(c3Text(H,6)),'6 trous sur un tour : « EQS » ('+c3Text(H,6)+')');
   rp.angle=180;ok(!c3Eqs(H)&&!/EQS/.test(c3Text(H,6)),'arc partiel : pas d’EQS ('+c3Text(H,6)+')');delete rp.angle;
   rp.copies=1;ok(!c3Eqs(H),'deux trous : pas d’EQS');rp.copies=5;
   ok(c3IsoOk(H)&&c3IsoOk({k:'pcd'})&&!c3IsoOk(D({k:'dia',a:{nom:'ex_1/e1/cercle/flanc'}})),'localisation ISO : depuis le Ø des trous d’un cercle ou le Ø de perçage');
   const P=D({k:'pcd',polar:'rp_3',a:H.a,drive:null}),L=c3List(),n0=L.length;L.push(P);
   ok(c3PcdOf(rp)===P,'un seul Ø de perçage par répétition');
   ok(c3Text(P,50)==='(Ø50)'&&c3Text(Object.assign({},P,{drive:{t:'feat',f:'x',k:'distance'}}),50)==='Ø50','Ø de perçage : « Ø50 », entre parenthèses s’il ne pilote rien ('+c3Text(P,50)+')');
   // axe de la répétition à l'origine de l'esquisse du trou : la cote du rayon centre ↔ origine
   occW=(sk,x,y)=>[x,y,0];repAxisVec=()=>[0,0,1];
   let C=c3HoleCands(P,H.a,'r');
   ok(C.length===1&&C[0].drv.t==='newdim'&&C[0].drv.pa==='p1'&&C[0].drv.pb==='O','esquisse sans cote : proposer la cote du rayon (centre ↔ origine) ('+JSON.stringify(C.map(c=>c.drv))+')');
   doc.sketches[0].dims=[{id:'d1',type:'distance',a:'p1',b:'O',value:25}];
   C=c3HoleCands(P,H.a,'r');
   ok(C.length===1&&C[0].drv.t==='dim'&&C[0].drv.d==='d1'&&Math.abs(C[0].s-2)<1e-6,'la cote du rayon pilote le Ø de perçage (pente 2) ('+JSON.stringify(C)+')');
   ok(!!c3FitCand([{drv:C[0].drv,s:2,held:null}],50)&&!c3FitCand([{drv:C[0].drv,s:2,held:{id:'x'}}],50)&&!c3FitCand([{drv:C[0].drv,s:0.1,held:null}],50),'Ø de perçage 50 = 2 × rayon 25 : pilote d’office (pas si tenu ailleurs, pas sans effet)');
   L.length=n0;doc.features=save;doc.sketches=sks;}
  // ── angle d'un trou depuis l'axe horizontal (Fred, 27/11 : « la cote d'angle / à un axe, généralement l'Axe horizontal ») ──
  {const V=(x,y,z)=>new THREE.Vector3(x,y,z),f=v=>v.toArray().map(x=>+x.toFixed(6)+0).join(',');
   ok(f(c3HaxDir(V(0,0,1)))==='1,0,0'&&f(c3HaxDir(V(0,0,1),true))==='0,1,0','axe Z : horizontal X, vertical Y');
   ok(f(c3HaxDir(V(1,0,0)))==='0,1,0'&&f(c3HaxDir(V(1,0,0),true))==='0,0,1','axe X : horizontal Y, vertical Z');
   ok(c3Lib({k:'angle',hax:true,a:{nom:'?'}}).indexOf('axe horizontal')>0&&c3Lib({k:'angle',hax:true,hv:true,a:{nom:'?'}}).indexOf('axe vertical')>0,'libellé : « ↔ axe horizontal / vertical »');}
  return out;
})()`,ctx);
r.forEach(([b,m])=>{console.log((b?'  ok ':'  KO ')+m);if(!b)ko++;});
// ── crochets dans les autres fichiers ──
const s90=src('90-50-document-sauvegarde.js'),s30=src('30-marqueur-temps.js'),s10=src('10-scene-3d.js'),s9010=src('90-10-selection-mesure.js');
let nchk=0;const chk=(c,m)=>{nchk++;console.log((c?'  ok ':'  KO ')+m);if(!c)ko++;};
chk(/cotes3d:\(Array\.isArray\(d\.cotes3d\)/.test(s90)&&/cotes3d:Array\.isArray\(o\.cotes3d\)/.test(s90),'enregistrement et relecture de doc.cotes3d');
chk(/c3AfterBuild\(\)/.test(s30),'cotes relues à chaque fin de rejeu (buildDone)');
chk(/c3Render\(RS\)/.test(s10),'dessin dans la boucle d’image');
chk(/c3Tool\)\{if\(e\.button===0\)c3PickAt\(e\)/.test(s9010),'clic de la vue pour l’outil');
chk(!/docHash[\s\S]{0,400}cotes3d/.test(s90),'l’empreinte de la pièce ignore les cotes (pas de rejeu pour une cote)');
chk(/doc\.features\.splice\(i,0,f\);\s*try\{if\(typeof c3AutoNew==='function'\)c3AutoNew\(f\)/.test(s30),'toute création de fonction (addFeature) annonce ses cotes 3D');
chk((s10.match(/c3FitBox\(box\)/g)||[]).length===2,'recadrage et « tout afficher » englobent les cotes 3D');
// ── mise en plan (98-mep-77) ──
const s70=src('98-mep-70-cotes.js'),s77=src('98-mep-77-cotes-3d.js'),s95=src('98-mep-95-export-init.js'),s97=src('97-interface-moderne.js');
chk(/h\.t==='c3'[\s\S]{0,200}c3MepPt\(h\.c,h\.w/.test(s70),'mise en plan : un point {t:c3} suit sa cote 3D');
chk(/function mepFrom3D\(vid\)/.test(s77)&&/window\.mepFrom3D=mepFrom3D/.test(s95)&&/'Cotes 3D',\(\)=>\{try\{mepSetActive\(true\);mepToggle3D\(\)/.test(s97)&&/function mepNo3D\(vid\)/.test(s77)&&/sh\.dims\.some\(x=>x&&x\.c3&&\(!tv\|\|x\.vid===tv\.id\)\)\?-mepNo3D\(vid\):mepFrom3D\(vid\)/.test(s77),'mise en plan : « Cotes 3D » par vue — la vue choisie les reçoit ou les perd, les autres ne bougent pas');
chk(/function mepC3Layout\(sh,L\)/.test(s77)&&/mepC3Layout\(sh,add\)/.test(s77)&&/function mepC3Gap\(sh\)\{const g=sh&&\+sh\.c3Gap;return g>0\?g:8;\}/.test(s77)&&/sh\.c3Gap=v;mepC3Relayout\(sh\)/.test(src('98-mep-90-proprietes.js')),'mise en plan : cotes rangées en étages, Ø / R dégagés, écart réglable (planche)');
chk(/function mepC3Ctx\(sh,v,ev\)/.test(s77)&&/mepC3Ctx\(sh,mepViewAt\(sh,P\.x,P\.y\),ev\)/.test(src('98-mep-80-souris.js')),'mise en plan : clic droit sur une vue → ses cotes 3D (mettre / retirer)');
chk(/if\(g\.k==='angle'&&g\.polar\)return [^;]*'polar'/.test(s77)&&/if\(how==='polar'\)\{/.test(s77)&&/o3:\{x:O\[0\],y:O\[1\],hint:\{t:'c3',c:d\.id,w:'O'\}\}/.test(s77)&&/if\(d\.kind==='ang'&&d\.o3\)/.test(s70)&&/if\(d\.o3&&d\.a&&d\.b\)\{/.test(src('98-mep-80-souris.js'))&&/if\(w==='QA'\|\|w==='QB'\)/.test(src('92-cotes-3d.js')),'mise en plan : pas angulaire = angle par trois points (centre, centres des trous) qui suit la pièce');
chk(/function c3PolarRep\(d\)/.test(src('92-cotes-3d.js'))&&/data-c="polar"/.test(src('92-cotes-3d.js'))&&/if\(c==='polar'\)\{c3MakePolar\(\);return;\}/.test(src('92-cotes-3d.js')),'pas angulaire posé à la main : entraxe de deux trous → « Angle autour de l’axe »');
chk(/if\(h\.rel\)\{if\(h\.lx!=null/.test(s70)&&/rel:1,lx:p\[0\],ly:p\[1\]/.test(s77)&&/d\.b\.hint\.rel\)mepPtRefresh/.test(s70),'mise en plan : la lettre d’une référence (le texte d’une note) suit sa face');
chk(/d\.gdt\.filter\(f=>f\)\.slice\(0,3\)/.test(s77)&&/if\(up\)fr\.under=up;else fr\.on=nd\.id;/.test(s77),'mise en plan : tous les cadres de tolérance (3 au plus), empilés');
chk(/nd\.c3nm='nom';nd\.c3nmv=nd\.txt/.test(s77)&&/if\(cur!==d\.c3nmv\)\{delete d\.c3nm/.test(s70)&&/function c3MepName\(id\)/.test(src('92-cotes-3d.js')),'mise en plan : le nom suit la cote 3D (sauf texte changé sur le plan)');
chk(/if\(par\(x\.v,SN\)\)s\+=3/.test(s77)&&/mepViewSheetBBox\(w\)/.test(s77)&&/ex\.some\(s=>vb\.some\(b=>segIn\(s,b\)\)\)/.test(s77)&&/k:n\+\(sd===o\.side\?0:2\.5\)/.test(s77),'mise en plan : ordonnées dans la meilleure vue ; rangement : autres vues évitées, l’autre côté avant un étage lointain, place des cadres');
chk(/if\(d\.o3\)\[aa,bb\]\.forEach[\s\S]{0,200}class:'mepAxis'/.test(s70)&&/if\(g\.ext&&!d\.o3\)/.test(s70),'pas angulaire sur le plan : traits d’axe du centre à travers les trous (calque AXE), sans rappels');
chk(/best=\{b,tb,ld,fb\}/.test(s77)&&/const fx=cs>=0\?b\.x:b\.x-FW;fb=\{x0:fx,y0:b\.y\+th0/.test(s77),'rangement : les cadres de tolérance d’un Ø / R ne touchent rien');
chk(/const str=d\.ref\?'\('\+pp\.main\+'\)':pp\.main/.test(s70)&&/mepDimDrawText\(draw,T,d\.ref\?'\('\+pp\.main\+'\)':pp\.main/.test(s70),'Ø, R et angle de référence entre parenthèses sur le plan');
chk(/Math\.abs\(g\.uy\)>0\.9/.test(src('98-mep-72-tolerances-geometriques.js')),'cadre de tolérance d’une cote verticale : sous le bout de son texte couché');
chk(/nd\.c3=d\.id;nd\.ref=!d\.drive/.test(s77)&&/has\.has\(d\.id\)/.test(s77),'reprise : cote de référence entre parenthèses, jamais deux fois');
chk(/\(\(doc\.mep&&doc\.mep\.sheets\)\|\|\[sh\]\)\.forEach\(s=>/.test(s77)&&/déjà dans une autre vue/.test(s77),'reprise : une cote déjà posée dans une vue (toute planche) ne va pas dans une autre');
// ── ordonnées dans l'esquisse (50-esquisse-98) ──
{const c2=vm.createContext({console,Math,JSON,Object,Array,isFinite,skView:{s:2},SK_TRACE_MODES:{},skTraceMode:{},SK_TR_MSG:{},SK_ICONS:{},document:{getElementById(){return null;}}});
 vm.runInContext(src('50-esquisse-98-ordonnees.js'),c2,{filename:'50-esquisse-98-ordonnees.js'});
 const q=vm.runInContext(`(()=>{const A={x:-50,y:-30},B={x:-30,y:10};
   const sx=skOrdSeg({orient:'h',w:-6},A,B),sy=skOrdSeg({orient:'v',w:-8},A,B);
   const t=skOrdTextAt(sx,{value:20,w:-6});
   return [sx.a.x,sx.a.y,sx.b.x,sx.b.y,sy.b.x,sy.b.y,+t.x.toFixed(3),+t.y.toFixed(3),SK_TRACE_MODES.ord.modes.map(m=>m[0]).join(''),skTraceMode.ord];})()`,c2);
 chk(q[0]===-30&&q[1]===10&&q[2]===-30&&q[3]===-36,'esquisse : ordonnée X — rappel du point jusqu’à l’alignement (zéro + w)');
 chk(q[4]===-58&&q[5]===10,'esquisse : ordonnée Y — rappel horizontal jusqu’à l’alignement');
 chk(q[6]===-30&&q[7]<-36,'esquisse : la valeur au bout du rappel, dans son prolongement');
 chk(q[8]==='xy'&&q[9]==='x','esquisse : bandeau « Ordonnées en » X / Y');}
const s4=src('50-esquisse-4-dessin-cotes.js'),s60=src('60-trim-et-souris.js'),s92=src('92-cotes-3d.js');
chk(/if\(d\.ord\)return skOrdSeg\(d,A,B\)/.test(s4)&&/if\(d&&d\.ord\)return skOrdTextAt\(S,d\)/.test(s4)&&/if\(d\.ord\)\{skOrdDraw\(sk,d,st\);return;\}/.test(s4)&&/if\(d\.ord\)return skOrdTextTo\(sk,d,tx,ty\)/.test(s4),'esquisse : ordonnées dessinées, déplacées en famille');
chk(/if\(skTool==='ord'\)\{skOrdClick\(sk,wx,wy\);return;\}/.test(s60)&&/skTool==='ord'&&skOrd&&\(e\.key==='Enter'\|\|e\.key==='Escape'\)/.test(s60)&&/if\(dd\.ord\)skOrdSyncW\(sk,dd\)/.test(s60),'esquisse : clic, Entrée / Échap, glisser de la ligne');
chk(/n\+=c3AutoOrd\(sk,free,face,used\)/.test(s92)&&/if\(d\.ord&&Array\.isArray\(d\.ordw\)[^\n]*return c3OrdGeo\(d,g\)/.test(s92)&&/c3OrdDraw\(d,g,el,col,W,H,vd\)/.test(s92),'3D : ordonnées d’esquisse reprises en famille, dessinées en ordonnées');
chk(/function mepC3OrdDim\(sh,v,M\)/.test(s77)&&/kind:'ord',axis/.test(s77)&&/c3m:M\.map/.test(s77)&&/x\.c3m\|\|\[\]/.test(s77),'mise en plan : une famille d’ordonnées 3D → une cote d’ordonnées, jamais deux fois');
chk(/if\(d\.k==='angle'&&d\.polar\)return c3ReadPolar\(d\)/.test(s92)&&/f\.type==='repeat'&&f\.mode==='circ'/.test(s92)&&/k:'dist2'\},Math\.abs\(\+f\.dist2\)/.test(s92)&&/g\.polar&&g\.rA>0\?g\.rA/.test(s92),'création : pas angulaire d’une répétition circulaire (arc par les centres), pas 2 d’une grille');
chk(/k:'cd2'\},r2\)/.test(s92)&&/y\.cmode==='d2'&&Math\.abs\(\+y\.cd2-r\)/.test(s92)&&/if\(f\.type==='xfillet'&&Array\.isArray\(f\.edges\)\)\{/.test(s92),'chanfreins de tout type à la création ; la 2e distance se pilote');
chk(/if\(d\.chs&&P\.length>=2\)P=\[P\[1\],P\[0\]\]/.test(s92)&&/f\.chamfer&&f\.cmode==='da'\)\{/.test(s92)&&/x=>\{x\.chs=true;\}/.test(s92)&&/\(!fd&&d&&d\.chs\)/.test(s92)&&/if\(!has\(\+g\.v\)&&has\(\+g\.l2\)\)d\.chs=true/.test(s92),'chanfrein distance + angle : la cote lit le côté de la distance (« 3 × 30° »), à la création et à la main');
chk(/VH=EH\?c3VtxAt\(e,EH\):null/.test(s92)&&/return c3MixMake\(EH\.ref\)/.test(s92)&&/return c3ReadMix\(d\)/.test(s92),'outil : sommets, arête ↔ face, sommet ↔ tout');
chk(/if\(c3Tool\.ord\)return c3OrdPick\(e\)/.test(s92)&&/data-c="ord"/.test(s92)&&/if\(d\.a&&d\.a\.ord0\)return c3ReadOrd0\(d\)/.test(s92)&&/T\.N=TN;c3Add\(d\)/.test(s92),'ordonnées posées en 3D (sens retenu à la 1re pose), zéro sur l’origine de l’esquisse');
chk(/if\(g\.k==='pcd'\)return g\.e&&g\.H&&g\.H\.length/.test(s77)&&/kind:'pitch',c3:d\.id,refs:g\.H\.map/.test(s77)&&/vv\.axes\.push\(x\._ax\)/.test(s77)&&/if\(ann\.c3\)\{/.test(s70)&&/if\(r\.c3!=null\)return 'c3'\+r\.c3/.test(s70)&&/if\(ref\.c3!=null\)/.test(s70),'mise en plan : Ø de perçage avec son cercle d’axe en trait mixte et les traits d’axe de chaque trou (suivent la pièce)');
chk(/circ=nloc\(g\.cy\.o,g\.cy\.u\)/.test(s77)&&/nn=circ\|\|nloc\(g\.P,g\.n\)/.test(s77),'mise en plan : référence B posée sur le cercle de l’alésage vu de bout');
chk(/sym:'pos',dia:true,val:0\.1/.test(s92)&&/docPushUndo\('Localisation ISO du cercle de trous'\)/.test(s92)&&/x\.fmt='box'/.test(s92)&&/data-a="iso"/.test(s92),'⌖ Localisation ISO : références A et B, cadre sur le Ø des trous, Ø de perçage et angles encadrés, une annulation');
chk(/c3PcdNew\(/.test(s92)&&/full\?null:\{t:'feat',f:f\.id,k:'angle'\}/.test(s92)&&/const d=c3HaxNew\(ra,f\)/.test(s92),'création d’une répétition circulaire : Ø de perçage, angle du 1er trou depuis l’axe horizontal, pas angulaire (de référence sur un tour complet)');
chk(/if\(d\.hax\)return c3ReadHax\(d\)/.test(s92)&&/data-c="hax"/.test(s92)&&/data-a="hax"/.test(s92)&&/if\(g\.hax\)d\.hv=!d\.hv/.test(s92)&&/if\(!c3HaxOf\(rp\)\)\{const x=c3HaxNew\(ref,rp\)/.test(s92),'angle depuis l’axe : outil, carte, ↻ axe vertical, posé par la localisation ISO');
chk(/if\(g\.cy&&g\.cy\.u&&g\.cy\.bore\)\{rim=true;/.test(s92)&&/bore=\(s\.direct!==false\)===rev/.test(s92)&&/\}else if\(G\.rim\)\{/.test(s92),'référence sur un alésage : sur le bord du bout vu, lisible, tourne en glissant');
chk(/data-c="pcd"/.test(s92)&&/>Angle depuis la face</.test(s92),'outil : « Ø de perçage » sur un trou du cercle, « Angle depuis la face » trou ↔ face');
chk(/function mepGdtOnX0\(sh,w,W\)/.test(src('98-mep-72-tolerances-geometriques.js'))&&/if\(end===true\)return\{x0:w\.b\.x-W,right:true\}/.test(src('98-mep-72-tolerances-geometriques.js'))&&/mepGdtFrame\(draw,d,mepGdtOnX0\(sh,w,W\)\.x0/.test(src('98-mep-72-tolerances-geometriques.js'))&&/const fx=cs>=0\?b\.x:b\.x-FW/.test(s77),'plan : cadre de tolérance d’un Ø / R / perçage / note calé du côté où arrive le trait (à droite si le texte est à gauche)');
chk(/classList\.toggle\('al',/.test(s92)&&/\.c3lab\.ar\{align-items:flex-end\}/.test(s92),'3D : cadres calés du côté du trait (étiquette à droite → à gauche, à gauche → à droite)');
chk(/fr=\{x0:pd\.ix\+4,y0:pd\.iy\+4/.test(s77),'rangement : rien sur le trait intérieur du cadre de la planche');
chk(/if\(d\.fmt==='box'\)\{nd\.box=true;nd\.tol=null;nd\.ref=false;\}/.test(s77),'plan : une cote encadrée (théoriquement exacte) jamais entre parenthèses');
chk(/\(full&&N>1&&c\.repIndex===N\)/.test(s92)&&/return g\.tB\.dot\(gh\.tA\)/.test(s92),'tour complet : le pas part du trou coté depuis l’axe vers le voisin qui s’en éloigne (angles enchaînés)');
chk(/c3AutoPre\(d\)/.test(s77)&&/reps\.has\(VS\[0\]\.v\.id\+'\|'\+rk\)/.test(s77),'mise en plan : « 4× » devant le Ø de trous pareils, une seule fois par vue');
{const s72=src('98-mep-72-tolerances-geometriques.js');
chk(/function mepGdtUnderY\(t,y\)/.test(s72)&&/p=\{x:tp\.x,y:mepGdtUnderY\(t,tp\.y\)\+mepGdtTh\(\)\*0\.3\}/.test(s72)&&/return y\+hh\*0\.4\+\(n-1\)\*fs\*1\.2\/2\+mepDimUnderOff\(hh\)/.test(s72)&&/th0=hh\*0\.4\+dy\+\(typeof mepDimUnderOff/.test(s77),'plan : cadre de tolérance sous le trait souligné d’un Ø, R, perçage ou note (plusieurs lignes comprises), place réservée au rangement');}
chk(/kind:'hole',vid:v\.id/.test(s77)&&/holeFid:HO\.f\.id,holeText:mepHoleFeatureText\(HO\.f\)/.test(s77)&&/if\(HO\.eqs\)nd\.eqs=true/.test(s77)&&/if\(d\.kind==='hole'&&d\.eqs&&!d\.txt\)/.test(s70)&&/nd\.kind==='hole'\|\|nd\.kind==='ang'\)\)\{/.test(s77),'plan : le Ø d’un trou de Perçage repris en cotation de perçage complète (profondeur, fraisure…), « EQS » gardé, cadres dessous');
chk(/f\.kind==='csink'&&\+f\.csD>\+f\.d\)x=\(\+f\.csD-\+f\.d\)\/2\/Math\.tan/.test(s92)&&/else if\(f&&f\.kind==='cbore'\)x=\+f\.cbH/.test(s92),'⌖ Localisation : face d’entrée A trouvée au-dessus d’une fraisure / d’un lamage');
chk(/const LKS=\(cs,sn\)=>/.test(s77)&&/if\(hit\(fb,pb\)\)s\+=700/.test(s77)&&/segIn\(ld,\{x0:fb\.x0-1\.5/.test(s77)&&/if\(hit\(tb,pb\)\)s\+=big\?250:80/.test(s77),'rangement : texte et cadre hors de la pièce, le trait ne longe pas le cadre');
console.log(ko?'ÉCHEC : '+ko:'OK ('+(r.length+nchk)+' contrôles)');
process.exit(ko?1:0);
