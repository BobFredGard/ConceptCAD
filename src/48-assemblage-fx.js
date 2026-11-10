/* ---------- paramètres dans les champs de l'assemblage (V0.87.0) ----------
   Demandé : « les paramètres ne restent pas dans les champs des fonctions de l'assemblage ».
   Le filet ƒx global (51) remplaçait « long_plaquette/2 » par sa valeur : le lien était perdu.
   Désormais un champ numérique d'Aligner, du Placement et des Répétitions GARDE son expression :
     · porteur.fx = {clé: expression} — sur l'alignement (o.align : rz, off0..off2) et sur la
       répétition (pat : dist, dist2, angle, qty, qty2 = quantité original compris) ;
     · évaluée avec les paramètres du composant PORTEUR (celui qui contient l'occurrence ou la
       répétition : ses paramètres, cotes nommées, paramètres dérivés) ;
     · réévaluée à chaque résolution de l'assemblage (asmResolve) : un paramètre change → la
       pièce se replace, la répétition se refait. Une expression qui échoue garde la dernière
       valeur, ⚠ dans le champ (bord orange, message au survol).
   Un nombre tapé efface l'expression (valeur figée), comme dans les fonctions de la pièce. */
const ASM_FX_QTY={qty:'copies',qty2:'copies2'}; // quantité affichée = copies + 1
function asmFxGet(h,k){
  if(ASM_FX_QTY[k])return (+h[ASM_FX_QTY[k]]||1)+1;
  const m=/^off(\d)$/.exec(k);if(m)return +((h.off||[])[+m[1]])||0;
  return +h[k]||0;
}
function asmFxPut(h,k,v){
  // → true si la valeur change
  if(ASM_FX_QTY[k]){const c=Math.max(1,Math.min(typeof ASM_PAT_MAX!=='undefined'?ASM_PAT_MAX:500,Math.floor(v)-1)),rk=ASM_FX_QTY[k];
    if((+h[rk]||1)===c)return false;h[rk]=c;return true;}
  const m=/^off(\d)$/.exec(k);
  if(m){const i=+m[1],o=Array.isArray(h.off)?h.off.slice():[0,0,0];if(Math.abs((+o[i]||0)-v)<1e-9)return false;o[i]=v;h.off=o;return true;}
  if(Math.abs((+h[k]||0)-v)<1e-9)return false;h[k]=v;return true;
}
function asmFxEval(expr,d){
  // Valeur d'une expression avec les noms du document d (composant porteur)
  const bd=doc;if(d)doc=d;
  try{const v=parEval(String(expr),parValueNow);if(!isFinite(v))throw new Error('valeur non finie');return v;}
  finally{doc=bd;}
}
function asmFxNorm(fx){
  // Lecture d'un fichier : seulement des textes non vides
  if(!fx||typeof fx!=='object')return undefined;
  const o={};Object.keys(fx).forEach(k=>{if(typeof fx[k]==='string'&&fx[k].trim())o[k]=fx[k];});
  return Object.keys(o).length?o:undefined;
}
function asmFxHolder(h,d){
  // Réévalue les expressions d'un porteur → true si une valeur a changé
  if(!h||!h.fx)return false;let ch=false;
  Object.keys(h.fx).forEach(k=>{
    let v;try{v=asmFxEval(h.fx[k],d);}catch(e){h._fxErr=h._fxErr||{};h._fxErr[k]=e.message;return;}
    if(h._fxErr)delete h._fxErr[k];
    if(asmFxPut(h,k,v))ch=true;
  });
  return ch;
}
function asmFxSync(){
  // Toutes les expressions de l'assemblage (début de asmResolve) → true si une valeur a changé
  if(!asm||!Array.isArray(asm.comps))return false;let ch=false;
  asm.comps.forEach(c=>{if(!c||!c.doc)return;
    (c.occ||[]).forEach(o=>{if(o&&o.align&&o.align.fx&&asmFxHolder(o.align,c.doc))ch=true;});
    (c.pats||[]).forEach(p=>{if(p&&p.fx&&asmFxHolder(p,c.doc))ch=true;});
  });
  return ch;
}
function asmFxInput(h,k,apply,o){
  // Champ numérique qui garde son expression. h : porteur (lu à l'affichage, fx écrit à la
  // validation) ; apply(v) applique la valeur et résout. o : {w, int, d, push} (largeur, entier,
  // document porteur — par défaut le composant actif —, étape d'annulation prise AVANT que
  // l'expression ne change : sinon Ctrl+Z gardait la nouvelle expression, qui reprenait la main).
  o=o||{};
  const i=document.createElement('input');i.type='text';i.inputMode='decimal';
  i._parFx=1; // le filet global ƒx (51) laisse ce champ à son gestionnaire
  const ex=h&&h.fx&&h.fx[k];
  i.value=ex||String(+(+asmFxGet(h,k)).toFixed(3)).replace('.',',');
  i.style.width=Math.max(o.w||64,ex?Math.min(220,8*i.value.length+20):0)+'px';
  i.title='Valeur, expression (L/2 + 3) ou paramètre — le lien est gardé';
  const err=h&&h._fxErr&&h._fxErr[k];if(err){i.style.borderColor='#ff9f0a';i.title='⚠ '+err+' — dernière valeur gardée';}
  let done=i.value;
  const go=()=>{
    const s=String(i.value).trim().replace(/\s*(mm|°|deg)\s*$/i,'');
    if(s===done)return;done=s;
    if(!s)return;
    if(parIsNumber(s)){
      let v=parseFloat(s.replace(',','.'));if(o.int)v=Math.round(v);
      if(o.push)o.push();
      if(h&&h.fx){delete h.fx[k];if(!Object.keys(h.fx).length)delete h.fx;}
      apply(v);return;
    }
    let v;try{v=asmFxEval(s,o.d||null);}
    catch(e){try{faceEl.textContent='ƒx : '+e.message+' — valeur inchangée.';}catch(x){}
      i.value=(h&&h.fx&&h.fx[k])||String(+(+asmFxGet(h,k)).toFixed(3)).replace('.',',');done=i.value;return;}
    if(o.int)v=Math.round(v);
    if(o.push)o.push();
    if(h){h.fx=h.fx||{};h.fx[k]=s;if(h._fxErr)delete h._fxErr[k];}
    try{faceEl.textContent='ƒx : '+s+' → '+(+v.toFixed(4))+' (lien gardé)';}catch(x){}
    apply(v);
  };
  i.addEventListener('change',go);i.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
  try{if(typeof parNumKeys==='function')parNumKeys(i);}catch(e){}
  return i;
}
