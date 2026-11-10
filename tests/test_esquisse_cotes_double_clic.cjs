// V0.83.0 : cotes d'esquisse — double-clic sur le chiffre, la ligne de cote, les lignes de rappel
// ou la ligne d'attache d'un rayon : la saisie s'ouvre de suite.
// Symptôme : « les cotes s'éditent très mal » — le 1er clic redessine l'esquisse, l'élément sous la
// souris est remplacé et le navigateur perd souvent le dblclick ; les lignes de rappel n'étaient pas
// reconnues. Le double-clic est maintenant détecté à l'APPUI (2 appuis < 500 ms, < 8 px, même cote).
// Aussi : rayon vu de dos — texte et trait d'épaulement du même côté du coude (rdScreen).
// Contrôles (rectangle 60×40 à (10,10), congé R5 au coin haut droit) :
//  A. 2 appuis sur la ligne de rappel gauche de la cote 60 → saisie de cette cote ;
//  B. 2 appuis sur la ligne de cote 40 → sa saisie ; le dblclick natif qui suit ne la rouvre pas ;
//  C. 2 appuis sur la ligne d'attache du rayon → saisie du rayon ;
//  D. 2 appuis sur le chiffre 40 → saisie ;
//  E. double-clic sur la ligne du haut (géométrie, sans cote) → sa cote de longueur créée, pas de saisie volée ;
//  F. vue de dos : le centre du texte R est du côté AFFICHÉ où file le trait d'épaulement.
// Harnais : DOM/THREE stubbé, sans OCCT.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
function inVm(){
  const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
  confirm=function(){return true;};alert=function(){};prompt=function(){return null;};
  const S=(px,py)=>{const r=svg.getBoundingClientRect();const p=skOrbFwd(px,py);return [r.left+p[0],r.top+p[1]];};
  const C=(wx,wy)=>S(...w2s(wx,wy));
  const ev=(t,x,y,ex)=>{const r=Object.assign({type:t,button:0,buttons:0,shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,detail:1,pointerId:1,preventDefault(){},stopPropagation(){}},ex||{});r.clientX=x;r.clientY=y;return r;};
  const press=p=>{svg.dispatchEvent(ev('pointermove',p[0],p[1]));svg.dispatchEvent(ev('pointerdown',p[0],p[1],{buttons:1}));svg.dispatchEvent(ev('pointerup',p[0],p[1]));};
  const dbl=p=>{press(p);press(p);};
  const close=()=>{if(skDimEditInp)skDimEditInp._cancel();skDimPress=null;};
  const sk={id:'s1',name:'S',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[],seq:20,visible:true};
  [['p0',10,10,'e0','p1'],['p1',70,10,'e1','p2'],['p2',70,50,'e2','p3'],['p3',10,50,'e3','p0']].forEach(l=>{sk.points[l[0]]={x:l[1],y:l[2]};sk.entities.push({id:l[3],t:'line',p1:l[0],p2:l[4]});});
  sk.constraints.push({id:'c0',type:'h',line:'e0'},{id:'c1',type:'v',line:'e1'},{id:'c2',type:'h',line:'e2'},{id:'c3',type:'v',line:'e3'});
  sk.dims.push({id:'d0',type:'length',line:'e0',value:60,w:-8},{id:'d1',type:'length',line:'e1',value:40,w:8});
  doc.sketches=[sk];doc.features=[];openSketch('s1');
  skTool='fillet';press(C(70,50));skTool='select';drawSketch2D();
  const R=sk.dims.find(d=>d.type==='radius');A(!!R,'congé R posé');
  // A
  dbl(C(10,5));A(skDimEditInp&&skDimEditInp._dimId==='d0','A. ligne de rappel de la cote 60 → saisie ('+(skDimEditInp&&skDimEditInp._dimId)+')');close();
  // B
  const Sg=dimSeg(sk,dimById(sk,'d1'));
  const pB=C((Sg.a.x+Sg.b.x)/2,(Sg.a.y+Sg.b.y)/2+10);
  dbl(pB);const iB=skDimEditInp;A(iB&&iB._dimId==='d1','B. ligne de cote 40 → saisie');
  svg.dispatchEvent(ev('dblclick',pB[0],pB[1],{detail:2}));A(skDimEditInp===iB,'B. le dblclick natif qui suit garde la même saisie');close();
  // C
  if(R){const L=rdLayout(sk,R);dbl(C((L.P.x+L.K.x)/2,(L.P.y+L.K.y)/2));A(skDimEditInp&&skDimEditInp._dimId===R.id,'C. ligne d\'attache du rayon → saisie');close();}
  // D
  const lp=dimLabelPos(sk,dimById(sk,'d1'));dbl(C(lp.x,lp.y));A(skDimEditInp&&skDimEditInp._dimId==='d1','D. chiffre 40 → saisie');close();
  // E
  const n0=sk.dims.length;const pE=C(30,50);press(pE);press(pE);svg.dispatchEvent(ev('dblclick',pE[0],pE[1],{detail:2}));
  const nl=sk.dims[sk.dims.length-1];
  A(!skDimEditInp||skDimEditInp._dimId===(nl&&nl.id),'E. double-clic sur la ligne du haut : aucune autre cote ouverte');
  A(sk.dims.length===n0+1&&nl.type==='length'&&nl.line==='e2','E. sa cote de longueur est créée ('+n0+' → '+sk.dims.length+')');close();
  // F
  if(R){skOrb={R:[-1,0,0],U:[0,1,0],D:[0,0,-1]};drawSketch2D();
    const L=rdLayout(sk,R),K=S(...w2s(L.K.x,L.K.y)),P=S(...w2s(L.P.x,L.P.y)),c=dimLabelPos(sk,R),T=S(...w2s(c.x,c.y));
    const side=Math.sign(K[0]-P[0]);
    const made=[],skEl0=skEl;skEl=function(n,a,p){const el=skEl0(n,a,p);if(n==='text')made.push([el,a]);return el;};
    try{drawSketch2D();}finally{skEl=skEl0;}
    const hit=made.find(m=>m[0].dataset&&m[0].dataset.dim===R.id),anc=hit?hit[1]['text-anchor']:null;
    A(anc===(side>0?'start':'end'),'F. vue de dos : texte R ancré « '+anc+' », il file du côté affiché du trait (côté '+side+')');
    A(Math.sign(T[0]-K[0])===side,'F. vue de dos : texte R du côté affiché de la ligne d\'attache ('+(T[0]-K[0]).toFixed(1)+' px, côté '+side+')');
    skOrb={R:[1,0,0],U:[0,1,0],D:[0,0,1]};drawSketch2D();}
  return JSON.stringify(out);
}
const {ctx}=loadApp();
let out;
try{out=JSON.parse(vm.runInContext('('+inVm.toString()+')()',ctx,{filename:'test_esquisse_cotes_double_clic.js'}));}
catch(e){console.log('ÉCHEC — exception :',e&&e.stack||e);process.exit(1);}
out.log.forEach(m=>console.log('  ✓ '+m));out.fails.forEach(m=>console.log('  ✗ '+m));
if(out.fails.length){console.log('ÉCHEC — '+out.fails.length+' contrôle(s)');process.exit(1);}
console.log('OK — double-clic des cotes d\'esquisse');
