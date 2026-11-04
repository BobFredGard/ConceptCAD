/* ---------- Fiches illustrées au survol des icônes ----------
   Au survol d'une icône, une petite fiche montre AVANT → APRÈS ce que fait la commande, en une
   phrase simple, avec ce qu'il faut faire et le raccourci. Option du menu ⚙ → Affichage, active
   par défaut (minifusion_fiches). Option désactivée : l'infobulle habituelle du navigateur.
   Les dessins et les textes sont dans 97-interface-fiches-dessins.js.
   • écoute unique sur le document : les boutons recréés (ruban, bandeaux) n'ont rien à déclarer ;
   • souris seulement : sur écran tactile, rien ne change ;
   • bouton sans fiche : il garde simplement son infobulle ;
   • la fiche ne capte aucun clic (pointer-events:none) et ne touche à aucune commande. */
let mfFiOn=true;
function mfFiKey(b){
  const d=b.dataset||{};
  if(d.fi)return d.fi;
  if(d.tool)return 'sk/'+d.tool;
  if(d.con)return 'sk/'+d.con;
  if(d.mfws)return 'ws/'+d.mfws;
  if(d.mfrd)return 'ws/rendu';
  if(b.id)return (b.closest('#skToolbar')?'sk/':'id/')+b.id;
  const g=(b.textContent||'').trim();
  if(b.closest('#mfTl'))return 'tl/'+g;
  if(b.closest('#mfPosTabs'))return 'pos/'+g;
  if(b.classList.contains('mepAdd'))return 'mep/'+g;
  return null;
}
function mfFiHtml(f){
  const fig=(svg,cap)=>'<figure><svg viewBox="0 0 100 76" aria-hidden="true">'+svg+'</svg><figcaption>'+cap+'</figcaption></figure>';
  return '<div class="mfFiT"><b>'+f.t+'</b>'+(f.k?'<kbd>'+f.k+'</kbd>':'')+'</div>'+
    '<div class="mfFiI">'+fig(f.a,f.la)+'<svg class="mfFiF" viewBox="0 0 12 24" aria-hidden="true"><path d="M2 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'+fig(f.b,f.lb)+'</div>'+
    '<p class="mfFiD">'+f.d+'</p>'+
    (f.h&&f.h.length?'<ol class="mfFiH">'+f.h.map(x=>'<li>'+x+'</li>').join('')+'</ol>':'');
}
function mfFiCss(){
  if(document.getElementById('mfFiCss'))return;
  const st=document.createElement('style');st.id='mfFiCss';
  st.textContent=[
  '#mfFiche{position:fixed;z-index:100000;width:330px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:10px 12px 11px;border-radius:12px;pointer-events:none;color:var(--text);background:var(--bg);background-image:linear-gradient(var(--surface),var(--surface));border:1px solid var(--border);box-shadow:0 14px 38px rgba(0,0,0,.45);font-size:.78rem;line-height:1.35;opacity:0;transform:translateY(3px);transition:opacity .12s,transform .12s}',
  '#mfFiche.on{opacity:1;transform:none}',
  '.mfFiT{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;font-size:.88rem}',
  '.mfFiT kbd{flex:none;padding:1px 6px;font-size:.68rem;font-weight:600;border-radius:5px;border:1px solid var(--border);background:rgba(127,127,127,.14);color:var(--text)}',
  '.mfFiI{display:flex;align-items:center;gap:3px}',
  '.mfFiI figure{flex:1 1 0;min-width:0;margin:0;overflow:hidden;border-radius:8px;background:#f6f8fb;border:1px solid rgba(100,116,139,.35)}',
  '.mfFiI figure svg{display:block;width:100%;height:auto}',
  '.mfFiI figcaption{padding:1px 2px 3px;font-size:.66rem;font-weight:600;text-align:center;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.mfFiF{flex:none;width:12px;height:24px;color:var(--primary)}',
  '.mfFiD{margin:8px 0 0}',
  '.mfFiH{margin:6px 0 0;padding:0 0 0 18px;color:var(--muted);font-size:.73rem}',
  '.mfFiH li{margin:1px 0}',
  '@media (prefers-reduced-motion:reduce){#mfFiche{transition:none;transform:none}}'
  ].join('\n');
  document.head.appendChild(st);
}
/* le bouton survolé perd son title le temps du survol : sinon l'infobulle du navigateur se superpose à la fiche */
function mfFiTitleOff(b){if(b&&b.hasAttribute('title')){b._mfFiT=b.getAttribute('title');b.removeAttribute('title');}}
function mfFiTitleOn(b){if(b&&b._mfFiT!==undefined){if(!b.hasAttribute('title'))b.setAttribute('title',b._mfFiT);delete b._mfFiT;}}
let mfFiCur=null,mfFiTimer=0,mfFiLast=0;
function mfFiEl(){
  let el=document.getElementById('mfFiche');
  if(!el){el=document.createElement('div');el.id='mfFiche';el.setAttribute('role','tooltip');document.body.appendChild(el);}
  return el;
}
function mfFiHide(){
  clearTimeout(mfFiTimer);mfFiTimer=0;
  const el=document.getElementById('mfFiche');
  if(el&&el.classList.contains('on')){el.classList.remove('on');el.style.visibility='hidden';mfFiLast=Date.now();}
}
function mfFiLeave(){mfFiHide();mfFiTitleOn(mfFiCur);mfFiCur=null;}
function mfFiPlace(el,b){
  const r=b.getBoundingClientRect(),W=window.innerWidth,H=window.innerHeight,w=el.offsetWidth,h=el.offsetHeight,G=8;
  let y=r.bottom+G;
  if(y+h>H-6)y=r.top-h-G>=6?r.top-h-G:Math.max(6,H-h-6);
  el.style.left=Math.round(Math.max(6,Math.min(W-w-6,r.left+r.width/2-w/2)))+'px';
  el.style.top=Math.round(y)+'px';
}
function mfFiShow(b){
  mfFiTimer=0;
  if(!mfFiOn||b!==mfFiCur||!b.isConnected)return;
  const f=mfFiFiche(mfFiKey(b));if(!f)return;
  const r=b.getBoundingClientRect();if(!r.width||!r.height)return;
  const el=mfFiEl();el.innerHTML=mfFiHtml(f);el.style.visibility='';
  mfFiPlace(el,b);el.classList.add('on');
}
function mfFiOver(e){
  if(e.pointerType==='touch'||!mfFiOn)return;
  const t=e.target,b=t&&t.closest?t.closest('button'):null;
  if(b===mfFiCur)return;
  mfFiLeave();
  if(!b)return;
  const k=mfFiKey(b);if(!k||!mfFiFiche(k))return;
  mfFiCur=b;mfFiTitleOff(b);
  // d'une icône à la suivante, la fiche suit sans attendre
  mfFiTimer=setTimeout(()=>mfFiShow(b),Date.now()-mfFiLast<500?40:350);
}
function mfFiSet(on){
  mfFiOn=!!on;mfLS('minifusion_fiches',mfFiOn?'on':'off');
  if(!mfFiOn)mfFiLeave();
  const c=document.getElementById('optFiches');if(c)c.checked=mfFiOn;
}
(function(){
  try{
    mfFiOn=mfLS('minifusion_fiches')!=='off';
    mfFiCss();
    // l'option se range dans ⚙ → Affichage, sous la taille des icônes
    const sz=document.getElementById('optIcSize'),row=sz&&sz.closest?sz.closest('.setRow'):null;
    if(row&&row.parentNode&&!document.getElementById('optFiches')){
      const n=document.createElement('div');n.className='setRow';
      n.innerHTML='<label title="Au survol d’une icône : une image avant / après et une phrase simple. Décoché : l’infobulle habituelle."><input type="checkbox" id="optFiches"> Fiches illustrées au survol</label>';
      row.parentNode.insertBefore(n,row.nextSibling);
      const c=n.querySelector('input');c.checked=mfFiOn;c.onchange=()=>mfFiSet(c.checked);
    }
    document.addEventListener('pointerover',mfFiOver,true);
    document.documentElement.addEventListener('pointerleave',mfFiLeave);
    // le clic masque la fiche ; le title revient juste le temps du clic (certaines commandes le lisent)
    document.addEventListener('pointerdown',mfFiHide,true);
    document.addEventListener('click',()=>{const b=mfFiCur;if(!b)return;mfFiTitleOn(b);setTimeout(()=>{if(b===mfFiCur)mfFiTitleOff(b);},0);},true);
    document.addEventListener('keydown',mfFiHide,true);
    document.addEventListener('wheel',mfFiHide,{capture:true,passive:true});
  }catch(e){}
})();
