// V0.92.0 : catalogues d'outils des fabricants — lecture d'un fichier .cccatalogue, conditions de
// coupe par matière interpolées au Ø, insertion dans la bibliothèque. Pur logique + DOM bouchonné.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm'),fs=require('fs'),path=require('path');
(async()=>{
  const {ctx}=loadApp();
  ctx.__CAT=fs.readFileSync(path.join(__dirname,'..','docs','manuel','catalogue-exemple.cccatalogue'),'utf8');
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "const all=function(root){const o=[];(function w(n){o.push(n);(n.children||[]).forEach(w);})(root);return o;};",
    "const S=faoSetup();S.tools=faoDefaultJob().tools;S.ops=[];const n0=S.tools.length;",
    // ── 1. lecture
    "const C=faoCatParse(__CAT);",
    "A(!C.err&&C.series.length===3&&C.series[0].outils.length===4&&C.series[0].coupe.length===2,'1a : fichier d’exemple lu : 3 séries, 4 fraises, 2 matières');",
    "A(!!faoCatParse('zz').err&&!!faoCatParse('{\"format\":\"conceptcad-outils\",\"tools\":[]}').err&&!!faoCatParse('{\"format\":\"conceptcad-catalogue\",\"series\":[{\"outils\":[{\"ref\":\"x\"}]}]}').err,'1b : fichiers étrangers ou vides refusés');",
    "const sale=faoCatClean({format:'conceptcad-catalogue',series:[{kind:'laser',outils:[{d:5,lc:-2,piege:{}}],coupe:[{matiere:'X'},{matiere:'Y',vc:[[10,100],[2,50],['a',1]]}]}]});",
    "A(sale.series[0].kind==='flat'&&sale.series[0].outils[0].lc===undefined&&sale.series[0].coupe.length===1&&JSON.stringify(sale.series[0].coupe[0].vc)==='[[2,50],[10,100]]','1c : catalogue assaini (type inconnu, valeurs fausses, matière sans Vc, tableau trié)');",
    // ── 2. valeur au diamètre
    "const T=[[3,0.02],[6,0.04],[10,0.06]];",
    "A(faoCatAt(T,6)===0.04&&Math.abs(faoCatAt(T,8)-0.05)<1e-12&&faoCatAt(T,1)===0.02&&faoCatAt(T,40)===0.06&&faoCatAt(120,7)===120&&faoCatAt(null,7)===0,'2 : tableau par Ø : valeur exacte, interpolée, bornée aux extrémités ; nombre seul accepté');",
    // ── 3. fiche d'une référence pour une matière
    "const F=C.series[0],alu=F.coupe[0],acier=F.coupe[1];",
    "const t6=faoCatTool(C,F,F.outils[1],alu);",
    "A(t6.kind==='flat'&&t6.d===6&&t6.lc===13&&t6.dq===6&&t6.lt===57&&t6.flutes===2&&t6.vc===300&&t6.fz===0.04&&t6.matiere==='Aluminium','3a : fraise Ø6 en aluminium : géométrie du catalogue, Vc 300, fz 0,04');",
    "A(faoCatTool(C,F,F.outils[1],acier).vc===120&&faoCatTool(C,F,F.outils[1],acier).fz===0.025,'3b : la même en acier : Vc 120, fz 0,025');",
    "const t3=faoCatTool(C,F,F.outils[0],alu);A(t3.lCq===4&&faoToolDims(t3).lCq===4,'3c : fraise Ø3 queue Ø6 : cône de raccord repris');",
    "const sf=faoToolSF(t6,S);A(sf.s===Math.round(300000/(Math.PI*6))&&sf.f===Math.round(0.04*2*sf.s),'3d : S et F calculés par la fiche (S'+sf.s+' F'+sf.f+')');",
    "const dr=faoCatTool(C,C.series[1],C.series[1].outils[1],C.series[1].coupe[0]);",
    "A(dr.kind==='drill'&&dr.ang===140&&Math.abs(dr.fr-0.2014)<1e-4&&faoToolSF(dr,S).f===Math.round(dr.fr*faoToolSF(dr,S).s),'3e : foret Ø6,8 : avance par tour interpolée ('+dr.fr+'), angle 140°');",
    "const tp=faoCatTool(C,C.series[2],C.series[2].outils[1],C.series[2].coupe[1]);",
    "A(tp.kind==='tap'&&tp.size==='M8'&&tp.p===1.25&&faoToolSF(tp,S).f===Math.round(1.25*faoToolSF(tp,S).s),'3f : taraud M8 : avance = pas × S');",
    "A(faoCatTool(C,F,F.outils[1],null).vc===250,'3g : sans condition de coupe : valeurs par défaut');",
    // ── 4. insertion directe
    "const add=faoCatInsert(S,C,F,[F.outils[1],F.outils[2]],alu);",
    "A(add.length===2&&S.tools.length===n0+2&&new Set(S.tools.map(t=>t.num)).size===S.tools.length&&new Set(S.tools.map(t=>t.id)).size===S.tools.length,'4a : 2 références insérées, numéros T et identifiants distincts');",
    "A(/EX-F2-06/.test(add[0].name)&&add[0].vc===300&&/EX-F2 EX-F2-06/.test(add[0].cat),'4b : fiche nommée d’après la référence, origine gardée ('+add[0].name+')');",
    // ── 5. catalogues gardés dans le navigateur
    "faoCatSave([]);A(faoCatList().length===0,'5a : aucun catalogue au départ');",
    "A(faoCatAdd(C)===0&&faoCatList().length===1&&faoCatList()[0].series.length===3,'5b : catalogue gardé');",
    "A(faoCatAdd(C)===0&&faoCatList().length===1,'5c : recharger le même fabricant le remplace');",
    // ── 6. la page
    "faoCatSel={c:0,s:0,m:0};const dlg=faoCatOpen(S);",
    "const sels=()=>all(dlg).filter(n=>n.tagName==='SELECT');",
    "A(sels().length===3&&all(sels()[2]).filter(n=>n.tagName==='OPTION').length===2,'6a : page : Fabricant, Série, Matière usinée');",
    "const cbs=()=>all(dlg).filter(n=>n.tagName==='INPUT'&&n.type==='checkbox');",
    "A(cbs().length===4&&cbs().every(c=>!c.checked),'6b : 4 références, aucune cochée');",
    "const lig=()=>all(dlg).filter(n=>n.className==='fao-cat-c').map(n=>n.textContent);",
    "A(/Vc 300/.test(lig()[1])&&/fz 0,04/.test(lig()[1]),'6c : conditions affichées pour l’aluminium : '+lig()[1]);",
    "sels()[2].value='1';sels()[2].onchange();",
    "A(/Vc 120/.test(lig()[1])&&/fz 0,025/.test(lig()[1]),'6d : changer de matière recalcule : '+lig()[1]);",
    "sels()[1].value='1';sels()[1].onchange();A(cbs().length===3&&lig()[0].indexOf('mm/tr')>0,'6e : série des forets : 3 références, avance par tour');",
    "const ok=()=>all(dlg).find(n=>n.tagName==='BUTTON'&&n.className==='primary');",
    "A(ok().disabled===true,'6f : rien de coché : Insérer inactif');",
    "const m0=S.tools.length;cbs()[2].checked=true;cbs()[2].onchange();A(ok().textContent==='Insérer (1)','6g : « '+ok().textContent+' »');",
    "ok().onclick();const last=S.tools[S.tools.length-1];",
    "A(S.tools.length===m0+1&&last.kind==='drill'&&last.d===8.5&&last.vc===180&&faoToolSelId===last.id,'6h : foret Ø8,5 inséré avec les conditions de la matière choisie, sélectionné dans la bibliothèque');",
    // ── 7. page vide + bouton
    "faoCatSave([]);const vide=faoCatOpen(S);",
    "A(all(vide).some(n=>/Aucun catalogue chargé/.test(n.textContent||''))&&all(vide).some(n=>n.tagName==='BUTTON'&&n.textContent==='Charger un catalogue…'),'7a : sans catalogue : explication et bouton « Charger un catalogue… »');",
    "A(all(faoToolsElement(S)).some(n=>n.tagName==='BUTTON'&&n.textContent==='📖 Catalogue…'),'7b : bouton « 📖 Catalogue… » dans la page Outils');",
    // ── 8. fourchettes et plages de diamètres, comme dans les catalogues
    "const PL={plages:[[2,5,0.03,0.06],[6,10,0.05,0.10],[12,20,0.05,0.12]]};",
    "A(JSON.stringify(faoCatTable(PL))===JSON.stringify(PL)&&faoCatTable({plages:[['x',1,2,3]]})===null&&JSON.stringify(faoCatTable({min:100,max:160}))==='{\"min\":100,\"max\":160}','8a : plages et fourchettes reconnues, plage fausse refusée');",
    "A(Math.abs(faoCatAt(PL,8)-0.075)<1e-12&&faoCatAt(PL,8,0)===0.05&&faoCatAt(PL,8,1)===0.10,'8b : Ø8 dans « 6-10 » : bas 0,05 · milieu 0,075 · haut 0,10');",
    "A(Math.abs(faoCatAt(PL,5)-0.045)<1e-12&&Math.abs(faoCatAt(PL,6)-0.075)<1e-12&&faoCatAt(PL,11,0)===0.05&&faoCatAt(PL,11.5,1)===0.12,'8c : bornes de plage, et entre deux plages la plus proche');",
    "A(faoCatAt(PL,1)===0&&faoCatAt(PL,25)===0&&faoCatRange(PL,1)===null,'8d : hors de toute plage : pas de valeur');",
    "A(faoCatAt({min:120,max:180},7,0)===120&&faoCatAt({min:120,max:180},7)===150,'8e : fourchette de Vc : bas 120, milieu 150');",
    "const CP=faoCatClean({format:'conceptcad-catalogue',fabricant:'Essai',series:[{ref:'S',nom:'n',kind:'flat',flutes:2,outils:[{ref:'A1',d:1,dq:4,lCq:5.6},{ref:'A8',d:8}],coupe:[{matiere:'Acier',vc:{min:120,max:180},fz:PL}]}]});",
    "const a8=faoCatTool(CP,CP.series[0],CP.series[0].outils[1],CP.series[0].coupe[0],0);",
    "A(a8.vc===120&&a8.fz===0.05&&!a8.horsTableau&&faoCatTool(CP,CP.series[0],CP.series[0].outils[1],CP.series[0].coupe[0],1).vc===180,'8f : fiche prise en bas ou en haut de la fourchette');",
    "const a1=faoCatTool(CP,CP.series[0],CP.series[0].outils[0],CP.series[0].coupe[0],0.5);",
    "A(a1.horsTableau===true&&a1.fz===0.001&&a1.vc===150,'8g : Ø1 hors du tableau du fabricant : fiche marquée, avance minuscule (rien d’inventé)');",
    "faoCatSave([CP]);faoCatSel={c:0,s:0,m:0,p:0.5};const dp=faoCatOpen(S);",
    "const sp=()=>all(dp).filter(n=>n.tagName==='SELECT');",
    "A(sp().length===4&&all(sp()[3]).filter(n=>n.tagName==='OPTION').length===3,'8h : page : choix « Dans la fourchette du fabricant » (bas / milieu / haut)');",
    "const lp=()=>all(dp).filter(n=>n.className==='fao-cat-c').map(n=>n.textContent);",
    "A(/Vc 150/.test(lp()[1])&&/fz 0,075/.test(lp()[1]),'8i : milieu par défaut : '+lp()[1]);",
    "sp()[3].value='0';sp()[3].onchange();A(/Vc 120/.test(lp()[1])&&/fz 0,05 /.test(lp()[1]),'8j : bas : '+lp()[1]);",
    "A(all(dp).filter(n=>n.className==='fao-imp-has'&&/hors tableau/.test(n.textContent)).length===1,'8k : la référence Ø1 est signalée « Ø hors tableau »');",
    "faoCatSave([]);",
    // ── 9. nom : fabricant entier ou abrégé lisiblement, référence toujours entière
    "A(faoCatName('Vargus','VMSC-020C060-Z2C04G-VM9')==='Vargus VMSC-020C060-Z2C04G-VM9','9a : fabricant + référence');",
    "A(faoCatName('Vargus','VDS-0100-0055-04-Z2-3D-C-VM10')==='VDS-0100-0055-04-Z2-3D-C-VM10','9b : référence longue : fabricant omis plutôt que « Va »');",
    "A(faoCatName('Vargus','VDS-0100-0055-04-Z2-3D-VM10')==='Varg VDS-0100-0055-04-Z2-3D-VM10','9c : fabricant abrégé à 4 lettres au moins');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_catalogue.js'});
  console.log('=== V0.92.0 : catalogues d’outils des fabricants ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,900));process.exit(1);});
