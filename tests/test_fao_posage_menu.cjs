// V0.95.3 — FAO : menu du posage (G-code de ce posage), posage gelé / dégelé
// (état de chaque opération mémorisé), export de TOUS les posages actifs,
// copie / duplication d'un posage gelé.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const out=await vm.runInContext(`(async function(){
    const P=[]; const A=(ok,m)=>P.push((ok?'OK   ':'ECHEC')+' : '+m);
    const mk=function(id,name,nops){
      const s=faoDefaultSetup(); s.id=id; s.name=name; s.ops=[];
      for(let i=0;i<nops;i++) s.ops.push({id:id+'_op'+(i+1),on:true,toolId:'T1',
        type:'facing',x0:5,y0:5,x1:95,y1:75,ztop:25,zbot:0,ae:6+i,np:0});
      return s;
    };
    const a=mk('sA','PA',3), b=mk('sB','PB',2);
    a.ops[1].on=false; // état à retrouver au dégel
    doc.fao={setups:[a,b],activeSetupId:'sA'};
    faoPrevStale=false;
    const dl=[]; // téléchargements interceptés
    const _st=setTimeout; setTimeout=function(f,ms){ f(); return 0; };
    const _ce=document.createElement.bind(document);
    document.createElement=function(t){ const e=_ce(t); if(String(t).toLowerCase()==='a')e.click=function(){ dl.push(e.download); }; return e; };

    /* 1. geler : toutes les opérations OFF, état mémorisé */
    A(faoSetupStrike('sA',true)===true,'geler PA');
    A(a.struck===true&&a.ops.every(o=>o.on===false),'PA gelé : 3 opérations désactivées');
    A(a.struckOn&&a.struckOn.sA_op1===true&&a.struckOn.sA_op2===false&&a.struckOn.sA_op3===true,'état de chaque opération mémorisé');
    faoRoot(); A(a.ops.every(o=>o.on===false),'invariant gardé après relecture');

    /* 2. export global : seul PB */
    faoPrevStale=false; window.faoLastExport=[]; faoExport(); dl.length=0; window.faoLastExport.forEach(x=>dl.push(x.name));
    A(dl.length===1&&/^PB\\./.test(dl[0]),'Exporter G-code : PB seul ('+dl.join()+')');
    /* 3. G-code du posage gelé refusé, de PB accepté */
    window.faoLastExport=[]; faoPrevStale=false; A(faoExportSetup("sA")===0&&window.faoLastExport.length===0,'G-code de PA gelé refusé');
    A(faoExportSetup('sB')===1&&window.faoLastExport.length===1&&/^PB\./.test(window.faoLastExport[0].name),'G-code de PB seul');
    A(faoRoot().activeSetupId==='sA','posage actif inchangé après export');

    /* 4. opération ajoutée pendant le gel : OFF, mémorisée active */
    a.ops.push({id:'sA_op4',on:true,toolId:'T1',type:'facing',x0:5,y0:5,x1:95,y1:75,ztop:25,zbot:0,ae:6,np:0});
    faoRoot();
    A(a.ops[3].on===false&&a.struckOn.sA_op4===true,'op ajoutée sur posage gelé : OFF, retenue active');

    /* 5. dupliquer le posage gelé : mémoire recopiée avec les ids neufs */
    faoSelectSetup('sA'); faoCopy(); faoPaste();
    const c=faoRoot().setups[1];
    A(c.name==='PA_COPIE'&&c.struck===true,'copie gelée elle aussi');
    A(c.ops.every(o=>o.on===false)&&c.ops.map(o=>c.struckOn[o.id]).join()==='true,false,true,true','mémoire suivie sur les ids neufs');

    /* 6. dégeler : chaque opération retrouve son état */
    A(faoSetupStrike('sA',false)===true,'dégeler PA');
    A(!a.struck&&!a.struckOn,'plus de marque ni de mémoire');
    A(a.ops.map(o=>o.on).join()==='true,false,true,true','états retrouvés (op2 restée OFF)');

    /* 7. export global : PA + PB, copie gelée exclue */
    faoPrevStale=false; window.faoLastExport=[]; faoExport(); dl.length=0; window.faoLastExport.forEach(x=>dl.push(x.name));
    A(dl.length===2&&/^PA\\./.test(dl[0])&&/^PB\\./.test(dl[1]),'Exporter G-code : PA et PB ('+dl.join()+')');

    /* 8. menu contextuel : entrées */
    faoSetupCtx(10,10,'sA');
    const m=faoCtxEl;
    const acts=m?m.children.filter(x=>x.tagName==="BUTTON").map(x=>x.dataset.act).join():'';
    A(acts==='gcode,strike,copy,dup','menu : G-code, geler, copier, dupliquer ('+acts+')');
    faoCtxHide();

    setTimeout=_st;
    const bad=P.filter(function(x){return x.indexOf('ECHEC')===0;});
    if(bad.length){P.push('');P.push('ECHECS ('+bad.length+') :');bad.forEach(function(m){P.push('  x '+m);});}
    else P.push('TOUT EST CONFORME');
    return P.join('\\n');
  })()`,ctx);
  console.log(out);
  process.exit(/ECHECS/.test(out)?1:0);
})().catch(e=>{console.error('FATAL',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
