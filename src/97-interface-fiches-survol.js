/* ---------- Fiches illustrées au survol des icônes ----------
   Au survol d'une icône, une petite fiche animée montre AVANT → APRÈS ce que fait la commande, en une
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
/* dessin animé : boucle de 3 s commune — la scène de gauche se tasse, la flèche saute, le résultat
   jaillit du sol en rebondissant, les étoiles éclatent, la mascotte saute de joie */
const MF_FI_STAR='M0-5L1.4-1.5 5-1 2.3 1.3 3 5 0 3-3 5-2.3 1.3-5-1-1.4-1.5Z';
const MF_FI_STARS=[[14,14,1.1],[86,12,.9],[90,58,1],[10,60,.8]].map((p,i)=>'<g transform="translate('+p[0]+' '+p[1]+') scale('+p[2]+')"><path class="mfFiSt mfFiSt'+i+'" d="'+MF_FI_STAR+'" fill="#ffd21f" stroke="#1e293b" stroke-width="1" stroke-linejoin="round"/></g>').join('');
const MF_FI_MASCOTTE='<svg class="mfFiM" viewBox="0 0 34 34" aria-hidden="true"><path d="M17 3L29 10V24L17 31 5 24V10Z" fill="#ffd21f" stroke="#1e293b" stroke-width="2" stroke-linejoin="round"/><path d="M9 11.5L17 7" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'+
  '<circle cx="9" cy="20.5" r="2" fill="#fb7185" opacity=".8"/><circle cx="25" cy="20.5" r="2" fill="#fb7185" opacity=".8"/>'+
  '<g class="mfFiYe"><ellipse cx="12.5" cy="14.5" rx="3.3" ry="4" fill="#fff" stroke="#1e293b" stroke-width="1.2"/><ellipse cx="21.5" cy="14.5" rx="3.3" ry="4" fill="#fff" stroke="#1e293b" stroke-width="1.2"/><circle cx="13.3" cy="15" r="1.7" fill="#1e293b"/><circle cx="22.3" cy="15" r="1.7" fill="#1e293b"/></g>'+
  '<path class="mfFiMs" d="M12.5 22Q17 26.5 21.5 22" fill="none" stroke="#1e293b" stroke-width="1.7" stroke-linecap="round"/><path class="mfFiMo" d="M12 21.5H22Q21 27.5 17 27.5T12 21.5Z" fill="#7f1d1d" stroke="#1e293b" stroke-width="1.2" stroke-linejoin="round"/></svg>';
function mfFiHtml(f){
  const fig=(svg,cap,cls,extra)=>'<figure class="'+cls+'"><svg viewBox="0 0 100 76" aria-hidden="true"><g class="mfFiS">'+svg+'</g>'+(extra||'')+'</svg><figcaption>'+cap+'</figcaption></figure>';
  return '<div class="mfFiT">'+MF_FI_MASCOTTE+'<b>'+f.t+'</b>'+(f.k?'<kbd>'+f.k+'</kbd>':'')+'</div>'+
    '<div class="mfFiI">'+fig(f.a,f.la,'mfFiA')+'<svg class="mfFiF" viewBox="0 0 16 24" aria-hidden="true"><path d="M2 7h6V2l7 10-7 10v-5H2z" fill="#ff9f1c" stroke="#1e293b" stroke-width="1.6" stroke-linejoin="round"/></svg>'+fig(f.b,f.lb,'mfFiB',MF_FI_STARS)+'</div>'+
    '<p class="mfFiD">'+f.d+'</p>'+
    (f.h&&f.h.length?'<ol class="mfFiH">'+f.h.map(x=>'<li>'+x+'</li>').join('')+'</ol>':'');
}
function mfFiCss(){
  if(document.getElementById('mfFiCss'))return;
  // dégradés à marches : ombrage en aplats, comme un dessin animé
  const cel=(id,a,b,c)=>'<linearGradient id="'+id+'" x1="0" x2="1"><stop offset=".3" stop-color="'+a+'"/><stop offset=".3" stop-color="'+b+'"/><stop offset=".72" stop-color="'+b+'"/><stop offset=".72" stop-color="'+c+'"/></linearGradient>';
  const d=document.createElementNS('http://www.w3.org/2000/svg','svg');d.setAttribute('width','0');d.setAttribute('height','0');d.setAttribute('aria-hidden','true');d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
  d.innerHTML='<defs>'+cel('mfFcHb','#c4e6ff','#70b8f5','#3b87d8')+cel('mfFcHm','#f3f6fa','#c0cbd8','#8c9aab')+cel('mfFcHo','#ffdc55','#ff9f1c','#ee7a00')+cel('mfFcHw','#ffe6b0','#f4bb68','#d98f36')+'</defs>';
  document.body.appendChild(d);
  const st=document.createElement('style');st.id='mfFiCss';
  st.textContent=[
  '#mfFiche{position:fixed;z-index:100000;width:340px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:10px 12px 12px;border-radius:18px;pointer-events:none;color:var(--text);background:var(--bg);background-image:linear-gradient(var(--surface),var(--surface));border:2.5px solid var(--primary);box-shadow:5px 6px 0 rgba(0,0,0,.38);font-size:.78rem;line-height:1.35;opacity:0;transform:scale(.7);transform-origin:50% 0;transition:opacity .1s,transform .28s cubic-bezier(.2,1.8,.4,1)}',
  '#mfFiche.on{opacity:1;transform:none}',
  '.mfFiT{display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:1rem}',
  '.mfFiT b{flex:1;min-width:0;font-family:"Comic Sans MS","Comic Neue","Chalkboard SE",cursive}',
  '.mfFiT kbd{flex:none;padding:1px 6px;font-size:.68rem;font-weight:600;border-radius:7px;border:1.5px solid var(--border);background:rgba(127,127,127,.14);color:var(--text)}',
  '.mfFiM{flex:none;width:32px;height:32px;overflow:visible;transform-origin:50% 100%;animation:mfFiHop 3s linear infinite}',
  '.mfFiYe{transform-origin:17px 14.5px;animation:mfFiBlink 3s linear infinite}',
  '.mfFiMo{opacity:0;animation:mfFiOuvre 3s step-end infinite}.mfFiMs{animation:mfFiFerme 3s step-end infinite}',
  '.mfFiI{display:flex;align-items:center;gap:3px}',
  '.mfFiI figure{flex:1 1 0;min-width:0;margin:0;overflow:hidden;border-radius:14px;border:2.5px solid #1e293b}',
  '.mfFiA{background:#e3f3ff}.mfFiB{background:#fff5cf}',
  '.mfFiI figure svg{display:block;width:100%;height:auto;overflow:hidden}',
  '.mfFiS{filter:drop-shadow(1.5px 2px 0 rgba(15,23,42,.22))}',
  '.mfFiA .mfFiS{transform-origin:50px 66px;animation:mfFiTasse 3s linear infinite}',
  '.mfFiB .mfFiS{transform-origin:50px 66px;animation:mfFiJaillit 3s linear infinite}',
  '.mfFiI figcaption{padding:0 2px 3px;font-size:.68rem;font-weight:700;text-align:center;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.mfFiF{flex:none;width:16px;height:24px;overflow:visible;animation:mfFiSaut 3s linear infinite}',
  '.mfFiSt{transform:scale(0);animation:mfFiEtoile 3s linear infinite}',
  '.mfFiSt1{animation-delay:.08s}.mfFiSt2{animation-delay:.16s}.mfFiSt3{animation-delay:.04s}',
  '.mfFiD{margin:8px 0 0}',
  '.mfFiH{margin:6px 0 0;padding:0 0 0 18px;color:var(--muted);font-size:.73rem}',
  '.mfFiH li{margin:1px 0}',
  /* la scène de gauche prend son élan */
  '@keyframes mfFiTasse{0%,24%,55%,70%,100%{transform:none}5%{transform:scale(1.04,.96)}10%{transform:scale(1.14,.82)}15%{transform:scale(.92,1.1) translateY(-3px)}20%{transform:scale(1.03,.98)}60%{transform:rotate(-2deg)}65%{transform:rotate(2deg)}}',
  '@keyframes mfFiSaut{0%,12%,27%,100%{transform:none}17%{transform:translate(3px,-7px) scale(1.35)}22%{transform:translateX(2px) scale(.95,1.1)}}',
  /* le résultat sort du sol, s'étire, s'écrase, se stabilise, puis repart */
  '@keyframes mfFiJaillit{0%,17%,100%{transform:scale(.2,0)}24%{transform:scale(.82,1.24)}29%{transform:scale(1.18,.8)}34%{transform:scale(.94,1.08)}39%{transform:scale(1.04,.97)}44%,60%,70%,90%{transform:none}65%{transform:translateY(-3px)}94%{transform:scale(1.1,.9)}}',
  '@keyframes mfFiEtoile{0%,24%{transform:scale(0) rotate(0);opacity:1}31%{transform:scale(1.5) rotate(50deg);opacity:1}40%{transform:scale(1) rotate(100deg);opacity:1}50%,100%{transform:scale(0) rotate(180deg);opacity:0}}',
  '@keyframes mfFiHop{0%,20%,50%,100%{transform:none}24%{transform:scale(1.15,.82)}30%{transform:translateY(-8px) rotate(-8deg) scale(.95,1.1)}36%{transform:scale(1.12,.86)}41%{transform:translateY(-4px) rotate(6deg)}46%{transform:scale(1.05,.95)}}',
  '@keyframes mfFiBlink{0%,74%,80%,100%{transform:none}77%{transform:scaleY(.08)}}',
  '@keyframes mfFiOuvre{0%{opacity:0}24%{opacity:1}50%{opacity:0}}',
  '@keyframes mfFiFerme{0%{opacity:1}24%{opacity:0}50%{opacity:1}}',
  /* mouvement réduit demandé par le système : dessin fixe, sans étoiles */
  '@media (prefers-reduced-motion:reduce){#mfFiche{transition:none;transform:none}.mfFiM,.mfFiYe,.mfFiMo,.mfFiMs,.mfFiF,.mfFiA .mfFiS,.mfFiB .mfFiS,.mfFiSt{animation:none}.mfFiSt{display:none}}'
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
