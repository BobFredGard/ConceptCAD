// V0.41.0 — FAO : suppression de plusieurs opérations d'un coup (Suppr) et retour par Ctrl+Z.
//  · Ctrl+clic / Maj+clic sélectionnent 3 opérations, Suppr les retire toutes ;
//  · la numérotation suit (l'arbre renumérote d'après l'ordre restant) ;
//  · un SEUL Ctrl+Z rend les 3 opérations, à leur place ;
//  · Suppr dans un champ de saisie ne touche à rien.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const out=await vm.runInContext(`(async function(){
    const P=[]; const A=(ok,m)=>P.push((ok?'OK   ':'ECHEC')+' : '+m);
    const T1={id:'T1',num:1,name:'Fraise D10',kind:'flat',d:10,cornerR:0,flutes:2,vc:250,fz:0.06};
    const s=faoDefaultSetup(); s.id='sA'; s.name='PA'; s.tools=[T1]; s.ops=[];
    for(let i=0;i<6;i++) s.ops.push({id:'op'+(i+1),on:true,toolId:'T1',
      type:'facing',x0:5,y0:5,x1:95,y1:75,ztop:25,zbot:0,ae:6+i,np:0});
    doc.fao={setups:[s],activeSetupId:'sA'};
    docUndoStack.length=0; docRedoStack.length=0; docBaseSync();
    const ids=function(){ return faoSetup('sA').ops.map(function(o){return o.id;}).join(); };
    const ev=function(o){ return Object.assign({ctrlKey:false,shiftKey:false,metaKey:false},o||{}); };
    const key=function(k,t){ let stop=0; const e={key:k,target:t||null,ctrlKey:false,metaKey:false,altKey:false,
      preventDefault:function(){},stopImmediatePropagation:function(){stop++;}}; return {used:faoDelKey(e),stop:stop}; };

    /* 1. op2 puis Maj+clic op3, Ctrl+clic op5 -> 3 opérations */
    faoSelectOp('sA','op2');
    faoMultiClick(ev({shiftKey:true}),s,s.ops[2]);
    faoMultiClick(ev({ctrlKey:true}),s,s.ops[4]);
    const so=faoSelectedOps();
    A(so&&so.ops.map(o=>o.id).join()==='op2,op3,op5','3 opérations sélectionnées ('+(so?so.ops.map(o=>o.id).join():'-')+')');

    /* 2. Suppr dans un champ de saisie : rien */
    const r0=key('Delete',{tagName:'INPUT'});
    A(!r0.used&&ids()==='op1,op2,op3,op4,op5,op6','Suppr dans un champ : aucune suppression');

    /* 3. Suppr : 3 de moins */
    docCheckpoint(); // l'état de départ (posage du test) devient sa propre étape
    const n0=docUndoStack.length;
    const r1=key('Delete');
    A(r1.used&&r1.stop===1,'Suppr consommée');
    A(ids()==='op1,op4,op6','6 -> 3 opérations ('+ids()+')');
    A(docUndoStack.length===n0+1,'une seule étape d annulation ('+(docUndoStack.length-n0)+')');
    A(sel&&sel.kind==='faoOp'&&sel.id==='op6'&&faoMulti.length===0,'sélection sur l opération suivante ('+(sel&&sel.id)+')');
    const lb=faoSetup('sA').ops.map(function(o,i){return (i+1)+'. '+faoOpShortLabel(o);}).join(' | ');
    A(lb==='1. Surfaçage | 2. Surfaçage | 3. Surfaçage','numérotation 1..3 ('+lb+')');

    /* 4. Ctrl+Z : retour des 3 */
    undoDispatch(false);
    A(ids()==='op1,op2,op3,op4,op5,op6','Ctrl+Z : 6 opérations, ordre d origine ('+ids()+')');
    A(faoSetup('sA').ops[4].ae===10,'paramètres rétablis');

    /* 5. Ctrl+Y : de nouveau supprimées */
    undoDispatch(true);
    A(ids()==='op1,op4,op6','Ctrl+Y : de nouveau 3 opérations ('+ids()+')');

    /* 6. Toutes supprimées : sélection sur le posage */
    faoSelectOp('sA','op1');
    faoMultiClick(ev({shiftKey:true}),faoSetup('sA'),faoSetup('sA').ops[2]);
    A(faoDeleteSelected()===3&&ids()===''&&sel.kind==='faoSetup','tout supprimé : posage sélectionné');
    A(!key('Delete').used,'Suppr sans opération sélectionnée : ignorée');

    const bad=P.filter(function(x){return x.indexOf('ECHEC')===0;});
    if(bad.length){P.push('');P.push('ECHECS ('+bad.length+') :');bad.forEach(function(m){P.push('  x '+m);});}
    else P.push('TOUT EST CONFORME');
    return P.join('\\n');
  })()`,ctx);
  console.log(out);
  process.exit(/ECHECS/.test(out)?1:0);
})().catch(e=>{console.error('FATAL',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
