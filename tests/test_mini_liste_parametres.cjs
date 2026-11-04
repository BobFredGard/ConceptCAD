// V0.47.1 : modifier les valeurs depuis la mini-liste ƒx (52-derivee.js, réglages de 51-parametres.js),
// sans noyau. Plaque (rectangle coté L × l, extrudée E), paramètre libre et formule, triangle coté.
// Vérifie : paramètre, formule, cote (la géométrie suit, l'esquisse étant fermée), valeur de fonction 3D,
// refus sans dégât (formule fausse, cote impossible), lecture seule (dérivé, cote de référence).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};
    confirm=function(){return true;};alert=function(){};showAll=function(){};
    const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
    docResetEmpty();doc.name='Plaque';
    const sk={id:'skP',name:'Plaque',plane:'XY',visible:true,origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],seq:10,
      points:{a:{x:0,y:0},b:{x:80,y:0},c:{x:80,y:50},d:{x:0,y:50}},
      entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],
      constraints:[{id:'k1',type:'fix',p:'a'},{id:'k2',type:'h',line:'l1'},{id:'k3',type:'v',line:'l2'},{id:'k4',type:'h',line:'l3'},{id:'k5',type:'v',line:'l4'}],
      dims:[{id:'dL',type:'distance',a:'a',b:'b',value:80,name:'L'},{id:'dl',type:'distance',a:'b',b:'c',value:50,name:'Larg',ref:true}]};
    const skT={id:'skT',name:'Triangle',plane:'XY',visible:true,origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],seq:11,
      points:{p:{x:0,y:100},q:{x:10,y:100},s:{x:5,y:108}},
      entities:[{id:'t1',t:'line',p1:'p',p2:'q'},{id:'t2',t:'line',p1:'q',p2:'s'},{id:'t3',t:'line',p1:'s',p2:'p'}],
      constraints:[{id:'k6',type:'fix',p:'p'}],
      dims:[{id:'d1',type:'distance',a:'p',b:'q',value:10},{id:'d2',type:'distance',a:'q',b:'s',value:Math.hypot(5,8)},{id:'dB',type:'distance',a:'p',b:'s',value:Math.hypot(5,8),name:'Base'}]};
    doc.sketches=[sk,skT];
    doc.features=[{id:'F1',type:'extrude',name:'Plaque',sketchId:'skP',distance:10,op:'add',visible:true,pname:{distance:'E'}}];
    doc.params=[{name:'P',expr:'3',value:3},{name:'Double',expr:'P*2',value:6}];
    doc.derive=[{id:'D1',rel:'Source.conceptcad',name:'Source',params:[{src:'Lien',name:'Lien',value:7}]}];
    parResolve();
    const row=n=>parMiniRows().find(r=>r.name===n);
    const pose=(n,t)=>{const r=row(n).set(t);if(r===true)parAfterChange();return r;};
    // ── ce que le champ propose ──
    att(row('P').val==='3'&&row('P').edit==='3','1 : paramètre : valeur et texte à éditer');
    att(row('Double').val==='6'&&row('Double').edit==='P*2','2 : formule : le champ montre la valeur, puis la formule au clic');
    att(row('L').edit==='80'&&row('E').edit==='10','3 : cote et fonction 3D : texte à éditer');
    // ── paramètre et formule ──
    att(pose('P','12,5')===true&&near(parValueNow('P'),12.5)&&near(parValueNow('Double'),25),'4 : paramètre modifié, la formule suit');
    att(pose('Double','P+1')===true&&near(parValueNow('Double'),13.5)&&row('Double').edit==='P+1','5 : formule modifiée');
    att(pose('P','Lien*2')===true&&near(parValueNow('P'),14),'6 : un paramètre dérivé sert dans une formule');
    // ── refus : rien ne change ──
    pose('P','4');
    const faux=pose('P','2*(');
    att(typeof faux==='string'&&near(parValueNow('P'),4)&&doc.params[0].expr==='4'&&!doc.params[0].err,'7 : formule fausse refusée, valeur gardée ('+faux+')');
    const cycle=pose('P','Double');
    att(typeof cycle==='string'&&doc.params[0].expr==='4','8 : référence circulaire refusée');
    // ── cote : la géométrie suit, esquisse fermée ──
    att(pose('L','120')===true&&near(sk.dims[0].value,120)&&near(sk.points.b.x,120,1e-3)&&near(sk.points.c.x,120,1e-3),'9 : cote modifiée : le rectangle suit ('+sk.points.b.x+')');
    att(pose('L','P*20')===true&&near(sk.points.b.x,80,1e-3)&&row('L').edit==='P*20','10 : cote en formule');
    pose('P','5');
    att(near(sk.points.b.x,100,1e-3),'11 : le paramètre pilote la cote ('+sk.points.b.x+')');
    // ── cote impossible : refusée, l'esquisse garde sa forme ──
    const bx=skT.points.s.x,by=skT.points.s.y,bv=row('Base').edit;
    const imp=pose('Base','500');
    att(typeof imp==='string'&&near(skT.points.s.x,bx)&&near(skT.points.s.y,by)&&row('Base').edit===bv,'12 : cote impossible refusée ('+imp+')');
    att(pose('Base','0')!==true,'13 : cote nulle refusée');
    // ── valeur de fonction 3D ──
    const F1=doc.features[0];
    att(pose('E','25')===true&&near(F1.distance,25)&&!F1._fxDirty,'14 : distance d’extrusion modifiée');
    att(/25/.test(F1.name)||!/\\d/.test(F1.name),'15 : nom de la fonction à jour ('+F1.name+')');
    att(pose('E','P*2')===true&&near(F1.distance,10)&&row('E').edit==='P*2','16 : distance en formule');
    // ── lecture seule ──
    att(!row('Lien').set&&row('Lien').link,'17 : paramètre dérivé en lecture seule');
    att(!row('Larg').set,'18 : cote de référence en lecture seule');
    att(near(parValueNow('Lien'),7),'19 : valeur dérivée intacte');
    // ── le fichier garde les changements ──
    const txt=serialise();
    await deserialise(txt);
    att(near(parValueNow('P'),5)&&near(parValueNow('L'),100,1e-3)&&near(parValueNow('E'),10),'20 : valeurs relues du fichier');
    return {ATT,OK};
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  r.OK.forEach(m=>console.log('  ✓ '+m));
  r.ATT.forEach(m=>console.log('  ✗ '+m));
  if(r.ATT.length){console.log('ÉCHEC : '+r.ATT.length);process.exit(1);}
  console.log('OK : mini-liste des paramètres, '+r.OK.length+' contrôles');
})().catch(e=>{console.error(e);process.exit(1);});
