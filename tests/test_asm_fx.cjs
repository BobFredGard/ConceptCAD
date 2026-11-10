// V0.87.0 : paramètres dans les champs de l'assemblage (48-assemblage-fx.js) — Aligner, Placement,
// Répétitions gardent leur expression : évaluée avec les paramètres du composant PORTEUR,
// réévaluée à chaque résolution (paramètre changé → pièce replacée, répétition refaite), gardée
// à l'enregistrement (asmAlignNorm / asmPatNorm), effacée par un nombre tapé, et l'annulation
// revient à l'expression d'avant. Modèle seul (VM) ; le panneau est essayé dans le navigateur.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);else p('ok : '+msg);};
    asmEnsure();
    doc.params=[{id:'p1',name:'pas',expr:'200',value:200},{id:'p2',name:'nb',expr:'3',value:3}];parResolve();
    const c=asmNewComp('A').comp,o=asmComp(asm.active).occ.find(q=>q.comp===c.id);
    // ── évaluation ──
    att(asmFxEval('pas/2+1')===101,'1 : expression évaluée avec les paramètres du porteur');
    let err='';try{asmFxEval('inconnu*2');}catch(e){err=e.message;}
    att(/inconnu/.test(err),'2 : nom inconnu : erreur, pas de valeur');
    // ── alignement ──
    o.align={src:{path:[],cg:null},dst:{path:[],cg:null},flip:false,rz:0,off:[0,0,0],fx:{off0:'-pas',rz:'nb*30'}};
    asmResolve();
    att(o.align.off[0]===-200&&o.align.rz===90,'3 : résolution : valeurs tirées des expressions');
    att(Math.abs(o.fr.o[0]+200)<1e-9,'4 : la pièce est placée en conséquence');
    doc.params[0].expr='250';parAfterChange();
    att(o.align.off[0]===-250&&Math.abs(o.fr.o[0]+250)<1e-9,'5 : paramètre changé → pièce replacée');
    const n=asmAlignNorm(JSON.parse(JSON.stringify(o.align)));
    att(n.fx&&n.fx.off0==='-pas'&&n.fx.rz==='nb*30','6 : expressions gardées à la relecture du fichier');
    att(!asmAlignNorm({src:null,dst:null,fx:{off0:'',rz:3}}).fx,'7 : expressions vides ou non textuelles écartées');
    // ── répétition ──
    const pat={id:'rp1',name:'R',type:'lin',src:[o.id],ref:{cg:null},axis:'X',copies:1,dist:10,angle:360,skip:[],lin2:true,axis2:'Y',copies2:1,dist2:10,
      fx:{dist:'pas',qty:'nb',qty2:'nb+1'}};
    const owner=asmComp(asm.active);owner.pats=[pat];asmResolve();
    att(pat.dist===250&&pat.copies===2&&pat.copies2===3,'8 : répétition : pas et quantités (original compris) tirés des paramètres');
    att(owner.occ.filter(q=>q.pat).length===3*4-1,'9 : instances refaites ('+owner.occ.filter(q=>q.pat).length+')');
    doc.params[1].expr='4';parAfterChange();
    att(pat.copies===3&&pat.copies2===4&&owner.occ.filter(q=>q.pat).length===4*5-1,'10 : paramètre changé → répétition refaite');
    const pn=asmPatNorm(JSON.parse(JSON.stringify([pat])))[0];
    att(pn.fx&&pn.fx.qty2==='nb+1','11 : expressions de la répétition gardées à la relecture');
    // ── expression qui échoue : dernière valeur gardée ──
    pat.fx.dist='zz';asmResolve();
    att(pat.dist===250&&pat._fxErr&&pat._fxErr.dist,'12 : expression en échec : dernière valeur gardée, erreur notée');
    pat.fx.dist='pas';asmResolve();
    att(!pat._fxErr.dist,'13 : expression réparée : erreur effacée');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fx.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
