// V0.59.0 : journal d'erreurs local (src/01-journal-erreurs.js).
// Le fichier source tourne seul dans un bac à sable : on peut y simuler un rechargement de la page.
const fs=require('fs'),path=require('path'),vm=require('vm');
const {loadApp}=require('./appvm.cjs');
const SRC=fs.readFileSync(path.join(__dirname,'..','src','01-journal-erreurs.js'),'utf8');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};

function page(stock){
  const ecoute={},doc={};
  const sb={
    APP_VER:'V9.9.9',JSON,String,Array,Date,Blob:function(){},URL:{},console,
    setTimeout:()=>1,clearTimeout(){},navigator:{userAgent:'test'},
    localStorage:{getItem:k=>stock.has(k)?stock.get(k):null,setItem:(k,v)=>{stock.set(k,v);},removeItem:k=>stock.delete(k)},
    document:{addEventListener:(t,f)=>{doc[t]=f;},getElementById:()=>null},
  };
  sb.window={addEventListener:(t,f)=>{ecoute[t]=f;}};
  const ctx=vm.createContext(sb);
  // APP_VER est fourni par src/00 dans l'application, par le bac à sable ici
  vm.runInContext(SRC+'\n;globalThis.__j={texte:journalTexte,liste:()=>journalListe,vider:journalVider,ecrire:journalEcrire};',ctx);
  return {ecoute,doc,j:sb.__j};
}
function bouton(texte){return {target:{closest:()=>({textContent:texte})}};}

console.log('=== journal d\'erreurs local ===');
const stock=new Map();
let p=page(stock);
A(p.j.liste().length===0,'journal vide au départ');

p.doc.click(bouton('  Extrusion  '));
p.ecoute.error({message:'x is not defined',filename:'file:///C:/Users/Fred/Secret/ConceptCAD.html',lineno:12,colno:3,
  error:{stack:'ReferenceError: x\n at f (file:///C:/Users/Fred/Secret/ConceptCAD.html:12:3)'}});
let x=p.j.liste()[0];
A(x&&x.message==='x is not defined'&&x.version==='V9.9.9','erreur notée avec sa version');
A(x&&x.lieu==='ConceptCAD.html:12:3','emplacement gardé, sans le chemin');
A(x&&x.gestes.join()==='Extrusion','dernier bouton noté');
A(x&&x.pile.indexOf('Fred')<0&&JSON.stringify(x).indexOf('Secret')<0,'nom d\'utilisateur et dossiers retirés');

for(let i=0;i<500;i++)p.ecoute.error({message:'x is not defined',filename:'file:///C:/Users/Fred/Secret/ConceptCAD.html',lineno:12,colno:3});
A(p.j.liste().length===1&&p.j.liste()[0].fois===501,'erreur répétée : une ligne et son compteur');

p.ecoute.unhandledrejection({reason:{message:'noyau KO',stack:'at g'}});
A(p.j.liste().length===2&&p.j.liste()[1].genre==='tache','tâche asynchrone en échec notée');
p.ecoute.unhandledrejection({reason:'simple texte'});
A(p.j.liste()[2].message==='simple texte','rejet sans objet Error noté');
p.ecoute.error({message:'ResizeObserver loop limit exceeded'});
A(p.j.liste().length===3,'avis bénin du navigateur ignoré');
p.ecoute.error(null);
A(p.j.liste().length===4,'événement vide : pas de plantage du journal');

for(let i=0;i<8;i++)p.doc.click(bouton('B'+i));
A(p.doc.click(bouton(''))===undefined,'bouton sans libellé ignoré');
p.ecoute.error({message:'après clics'});
A(p.j.liste()[4].gestes.join()==='B3,B4,B5,B6,B7','seulement les 5 derniers boutons');

const t=p.j.texte();
A(t.indexOf('V9.9.9')>=0&&t.indexOf('noyau KO')>=0&&t.indexOf('Fois : 501')>=0,'rapport texte complet');

p.j.ecrire();
const p2=page(stock);
A(p2.j.liste().length===5,'le journal survit au rechargement de la page');
for(let i=0;i<80;i++)p2.ecoute.error({message:'e'+i});
A(p2.j.liste().length===50&&p2.j.liste()[49].message==='e79','limité à 50 erreurs, les plus récentes');
p2.j.vider();
A(page(stock).j.liste().length===0,'Vider efface aussi le stockage');

stock.set('minifusion_journal','{pas du json');
A(page(stock).j.liste().length===0,'stockage abîmé : journal vide, pas de plantage');
const panne=page(new Map());
const sv=panne.j;sv.vider();
A(sv.liste().length===0,'journal utilisable sans contenu préalable');

A(!/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/.test(SRC),'aucun envoi réseau dans le code du journal');

// Dans l'application construite : chargé juste après APP_VER et relié à la fenêtre d'Aide
const {ctx}=loadApp();
A(vm.runInContext("typeof journalTexte==='function'&&typeof journalAideHtml==='function'",ctx),'fonctions présentes dans le livrable');
const html=vm.runInContext('journalAideHtml()',ctx);
A(['journalSave','journalCopy','journalClear','journalEtat'].every(i=>html.indexOf(i)>=0),'boutons Enregistrer, Copier, Vider dans l\'Aide');
const aide=fs.readFileSync(path.join(__dirname,'..','src','96-aide-raccourcis.js'),'utf8');
A(/journalAideHtml\(\)/.test(aide)&&/journalAideBranche\(\)/.test(aide),'fenêtre d\'Aide reliée au journal');

if(ko){console.log('\n*** '+ko+' PROBLEME(S) ***');process.exit(1);}
console.log('\n*** TOUT PASSE ***');
process.exit(0);
