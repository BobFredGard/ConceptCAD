/* ---------- Journal d'erreurs local (V0.59.0) ----------
   Note les plantages du logiciel dans le navigateur, pour pouvoir les faire analyser ensuite.
   Tout reste sur l'ordinateur : aucun envoi réseau. Le fichier n'en sort que par « Enregistrer »
   ou « Copier » (fenêtre d'Aide). Contenu : message, emplacement dans le code, version, navigateur
   et les 5 derniers boutons cliqués. Jamais le contenu du document ni les valeurs saisies.
   Chargé tout de suite après APP_VER pour attraper aussi les erreurs du démarrage.
   Limite : seules les erreurs NON rattrapées arrivent ici (un try/catch de l'application
   les traite lui-même) ; les tâches de fond (Worker) non plus. */
const JOURNAL_KEY='minifusion_journal',JOURNAL_MAX=50,JOURNAL_GESTES=5;
const journalGestes=[];
let journalListe=[],journalT=null;
try{
  const t=JSON.parse(localStorage.getItem(JOURNAL_KEY)||'[]');
  if(Array.isArray(t))journalListe=t.slice(-JOURNAL_MAX);
}catch(e){}

function journalEcrire(){
  if(journalT){clearTimeout(journalT);journalT=null;}
  try{localStorage.setItem(JOURNAL_KEY,JSON.stringify(journalListe));}catch(e){}
}
// Ne garde que le nom du fichier : le chemin complet peut contenir le nom de l'utilisateur.
function journalNettoie(s,max){
  return String(s==null?'':s)
    .replace(/(?:file:\/\/\/?|https?:\/\/|blob:)[^\s)'"]*\/([^/\s)'"]+)/g,'$1')
    .replace(/[A-Za-z]:\\[^\s)'"]*\\([^\\\s)'"]+)/g,'$1')
    .slice(0,max);
}
// Une erreur répétée (boucle d'affichage : 60 fois par seconde) n'occupe qu'une ligne, avec son
// compteur ; elle n'écrit qu'une fois par seconde pour ne pas ralentir ce qui plante déjà.
function journalAjouter(genre,message,lieu,pile){
  try{
    const msg=journalNettoie(message,500);
    if(/^ResizeObserver loop/.test(msg))return; // avis bénin du navigateur, pas une panne
    const place=journalNettoie(lieu,160),now=new Date().toISOString();
    const i=journalListe.findIndex(x=>x.version===APP_VER&&x.genre===genre&&x.message===msg&&x.lieu===place);
    if(i>=0){
      const x=journalListe.splice(i,1)[0];
      x.fois++;x.derniere=now;x.gestes=journalGestes.slice();journalListe.push(x);
      if(!journalT)journalT=setTimeout(journalEcrire,1000);
      return;
    }
    journalListe.push({genre,message:msg,lieu:place,pile:journalNettoie(pile,1500),version:APP_VER,
      premiere:now,derniere:now,fois:1,gestes:journalGestes.slice()});
    if(journalListe.length>JOURNAL_MAX)journalListe.shift();
    journalEcrire();
  }catch(e){} // le journal ne doit jamais provoquer une panne à son tour
}
function journalTexte(){
  const L=['Journal d\'erreurs ConceptCAD','Exporté le : '+new Date().toISOString(),'Version en cours : '+APP_VER,
    'Navigateur : '+((typeof navigator!=='undefined'&&navigator.userAgent)||'?'),
    'Erreurs différentes : '+journalListe.length];
  journalListe.forEach((x,i)=>{
    L.push('','--- '+(i+1)+' ---','Type : '+x.genre,'Version : '+x.version,'Fois : '+x.fois,
      'Première : '+x.premiere,'Dernière : '+x.derniere,'Message : '+x.message);
    if(x.lieu)L.push('Lieu : '+x.lieu);
    if(x.gestes&&x.gestes.length)L.push('Derniers boutons : '+x.gestes.join(' > '));
    if(x.pile)L.push('Pile :',x.pile);
  });
  return L.join('\n');
}
function journalVider(){journalListe=[];journalEcrire();}

window.addEventListener('error',e=>{
  const er=e&&e.error;
  const lieu=e&&e.filename?e.filename+':'+e.lineno+':'+e.colno:'';
  journalAjouter('erreur',(e&&e.message)||(er&&er.message)||'Erreur inconnue',lieu,er&&er.stack);
});
window.addEventListener('unhandledrejection',e=>{
  const r=e&&e.reason;
  journalAjouter('tache',(r&&r.message)||String(r),'',r&&r.stack);
});
// Fil d'Ariane : le libellé des boutons seulement, jamais ce qui est tapé dans les champs.
try{document.addEventListener('click',e=>{
  try{
    const b=e.target&&e.target.closest&&e.target.closest('button,[role="button"],[role="menuitem"],summary');
    if(!b)return;
    const nom=journalNettoie((b.textContent||b.title||b.id||'').replace(/\s+/g,' ').trim(),40);
    if(!nom)return;
    journalGestes.push(nom);
    if(journalGestes.length>JOURNAL_GESTES)journalGestes.shift();
  }catch(_){}
},true);}catch(e){}

/* Bloc de la fenêtre d'Aide (src/96-aide-raccourcis.js) */
function journalAideHtml(){
  return '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #3a3a40">'+
    '<div style="font-weight:700;color:#ff9f0a;margin-bottom:4px">🩺 Journal d’erreurs</div>'+
    '<div id="journalEtat" style="opacity:.9;margin-bottom:6px"></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
    '<button id="journalSave">💾 Enregistrer…</button><button id="journalCopy">📋 Copier</button><button id="journalClear">✕ Vider</button>'+
    '<span id="journalMsg" style="opacity:.75"></span></div>'+
    '<div style="opacity:.6;margin-top:6px">Reste sur cet ordinateur : rien n’est envoyé. Contient les messages d’erreur et les derniers boutons cliqués, jamais votre pièce.</div></div>';
}
function journalAideBranche(){
  const $j=id=>document.getElementById(id);
  const etat=()=>{
    const n=journalListe.length,e=$j('journalEtat');if(!e)return;
    e.textContent=n?n+(n>1?' erreurs différentes notées. Dernière : ':' erreur notée : ')+journalListe[n-1].message:'Aucune erreur notée.';
    ['journalSave','journalCopy','journalClear'].forEach(id=>{const b=$j(id);if(b)b.disabled=!n;});
  };
  const msg=t=>{const m=$j('journalMsg');if(m)m.textContent=t;};
  etat();
  const s=$j('journalSave');
  if(s)s.onclick=()=>{
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([journalTexte()],{type:'text/plain;charset=utf-8'}));
    a.download='ConceptCAD-journal-'+new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')+'.txt';
    document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);
    msg('Fichier enregistré.');
  };
  const c=$j('journalCopy');
  if(c)c.onclick=async()=>{
    try{await navigator.clipboard.writeText(journalTexte());msg('Copié.');}
    catch(e){msg('Copie refusée par le navigateur : utilisez Enregistrer.');}
  };
  const v=$j('journalClear');
  if(v)v.onclick=()=>{journalVider();etat();msg('Journal vidé.');};
}
