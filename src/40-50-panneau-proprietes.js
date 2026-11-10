function renderProps(){
  if(typeof extNew!=='undefined'&&extNew)extNew=null; // une sélection annule le formulaire en cours
  if(typeof revNew!=='undefined'&&revNew)revNew=null; // idem pour le formulaire de révolution
  const p=$('props');p.innerHTML='';p.className='col';
  if(typeof bmMarks==='function'){try{bmMarks();}catch(e){}} // axes d'un Déplacer sélectionné (85) : affichés tant qu'il l'est
  // FAO : les fiches posage/opération vivent dans src/88-fao.js (arbre FAO dédié).
  if(sel&&(sel.kind==='faoSetup'||sel.kind==='faoOp')){
    try{ faoRenderProps(p,sel); }catch(e){}
    return;
  }
  if(asmInspect){try{if(asmInspectProps(p))return;}catch(e){}} // résultats d'inspection (48)
  if(asmMode==='asm'&&asm){try{asmRenderProps(p);}catch(e){}return;} // vue d'assemblage (47)
  // Géométrie de construction (79) : création / modification en cours, ou élément sélectionné
  if(cgMode||(sel&&sel.kind==='cg')){try{cgRenderProps(p);}catch(e){}return;}
  /* ── helpers layout PLAN (mêmes classes que #mepSide de 98) ── */
  const pH=t=>{const h=document.createElement('div');h.className='pnl-h';h.textContent=t;p.appendChild(h);return h;};
  const pRow=(lab,el)=>{const r=document.createElement('div');r.className='pnl-row';
    const L=document.createElement('label');L.textContent=lab;r.appendChild(L);
    if(el)r.appendChild(el);p.appendChild(r);return r;};
  const pChk=(lab,val,fn)=>{const c=document.createElement('input');c.type='checkbox';c.checked=!!val;
    c.onchange=()=>fn(c.checked);pRow(lab,c);return c;};
  const pBtns=list=>{const d=document.createElement('div');d.className='pnl-btns';
    list.forEach(([t,fn,cls])=>{const b=document.createElement('button');b.textContent=t;
      if(cls)b.className=cls;b.onclick=fn;d.appendChild(b);});
    p.appendChild(d);return d;};
  const pNote=t=>{const n=document.createElement('div');n.className='pnl-note';n.textContent=t;p.appendChild(n);return n;};
  const pInfo=h=>{const d=document.createElement('div');d.className='pnl-note';d.innerHTML=h;p.appendChild(d);return d;};
  const pIn=(val,fn)=>{const i=document.createElement('input');i.type='text';i.inputMode='decimal';
    i.value=val;i.onchange=()=>fn(i.value);return i;};
  const pSel=(opts,val,fn)=>{const s=document.createElement('select');
    opts.forEach(o=>{const op=document.createElement('option');op.value=o[0];op.textContent=o[1];if(o[2])op.title=o[2];s.appendChild(op);});
    s.value=val;s.onchange=()=>fn(s.value);return s;};
  const visDel=f=>pBtns([
    ['👁 Visible',()=>{f.visible=!(f.visible!==false);markDirty();rebuild();renderTree();renderProps();}],
    ['🗑 Supprimer',()=>{treeSel=[f.id];sel={kind:'feature',id:f.id};treeDeleteSel();}, 'danger']]);
  /* ── nom du document (toujours en haut) ── */
  const nmIn=document.createElement('input');nmIn.type='text';nmIn.id='docNameIn';nmIn.value=doc.name;
  nmIn.onchange=e=>{doc.name=e.target.value;$('docName').textContent=doc.name;markDirty();};
  pRow('Nom du document',nmIn);
  $('docName').textContent=doc.name;
  /* ═══════ esquisse ═══════ */
  if(sel.kind==='sketch'){
    const sk=doc.sketches.find(s=>s.id===sel.id);if(!sk){pNote('Esquisse supprimée.');return;}
    pH('Esquisse');
    pInfo(`<b>${sk.name}</b> · plan ${sketchFaceLabel(sk)} · ${sk.entities.length} entités`);
    pBtns([
      ['🔧 Éditer',()=>openSketch(sk.id)],
      ['🧱 Extruder',()=>askExtrude(sk.id)],
      ['👁 Visible',()=>{sk.visible=sk.visible===false;rebuild();renderTree();renderProps();}]]);
    return;
  }
  /* ═══════ fonction ═══════ */
  if(sel.kind==='feature'){
    const f=doc.features.find(x=>x.id===sel.id);if(!f){pNote('Fonction supprimée.');return;}
    if(tlLocked(f)){
      pH('Fonction verrouillée');
      pInfo(`⏱ <b>${f.name}</b> est exclue du rejeu : le marqueur temps s'arrête avant elle.`);
      pBtns([
        ['🔓 Lever le marqueur',()=>{tlSetPtr(null);markDirty();rebuild();renderTree();renderProps();}],
        ['👁 Afficher / masquer',()=>{f.visible=!(f.visible!==false);markDirty();rebuild();renderTree();renderProps();}],
        ['🗑 Supprimer',()=>{treeSel=[f.id];sel={kind:'feature',id:f.id};treeDeleteSel();},'danger']]);
      return;
    }
    if(typeof bmPick!=='undefined'&&bmPick&&bmPick.fid!==f.id)bmPickExit(true); // saisie d'un autre Déplacer (85)
    /* — déplacer un corps (85) — */
    if(f.type==='bmove'){bmoveProps(p,f);visDel(f);return;}
    if(f.type==='bremove'){
      const be=(doc.bodies||[]).find(x=>x.id===f.body);
      pInfo('⊘ <b>'+(be?be.name:f.body)+'</b> est retiré à partir de cette étape de la timeline. Rien n’est effacé : supprimez cette étape (ou reculez le marqueur avant elle) pour le faire revenir.');
      visDel(f);return;
    }
    if(f.type==='bcopy'){bcopyProps(p,f);visDel(f);return;} // copier un corps (85-copier-corps)
    if(f.type==='bmirror'){bmirrorProps(p,f);visDel(f);return;} // symétrie du corps (85-symetrie-corps)
    if(f.type==='bscale'){bscaleProps(p,f);visDel(f);return;} // échelle (85-echelle-corps)
    if(f.type==='xsplit'){splitProps(p,f);visDel(f);return;} // scinder (85-scinder)
    /* — déplacement de face — */
    if(f.type==='xmove'){
      pH('Déplacement de face');
      pInfo(`<b>${f.name}</b>`);
      const mvR=mvRefs(f);
      if(mvR.length===1)pNote('Face visée : centre ('+mvR[0].pos.map(v=>(+v).toFixed(1)).join(' ; ')+') mm, normale ('+mvR[0].n.map(v=>(+v).toFixed(2)).join(' ; ')+').');
      else if(mvR.length>1)pNote(mvR.length+' faces visées : '+mvR.map(r=>'('+r.pos.map(v=>(+v).toFixed(1)).join(' ; ')+')').join(', ')+' mm.');
      const d=document.createElement('input');d.type='text';d.inputMode='decimal';
      d.value=String(+f.dist||0).replace('.',',');parFx(d,f,'dist');
      d.addEventListener('change',()=>{
        const v=parseFloat(String(d.value).replace(',','.').replace(/\s/g,''));
        if(!isFinite(v)){d.value=String(+f.dist||0).replace('.',',');return;}
        if(v===+f.dist)return;
        f.dist=Math.abs(v)<1e-9?0:v;f.name=mvName(f);repSyncForFeature(f);
        markDirty();rebuild();renderTree();renderProps();
      });
      pRow('Distance (mm)',d);
      pNote('Positif : la face avance. Négatif : elle rentre. 0 : la fonction ne fait rien.');
      pBtns([
        ['📐 Re-sélectionner',()=>{try{if(filMode||filModeX)exitFilletMode(true);}catch(e){}enterMoveFaceMode(f);}],
        ...[]]);
      visDel(f);
      return;
    }
    /* — dépouillage — */
    if(f.type==='xdraft'){
      pH('Dépouillage');
      pInfo(`<b>${f.name}</b> · ${(f.faces||[]).length} face(s)`);
      if(f._m&&f._m.t&&f._m.m<f._m.t){
        pInfo(`<span style="color:var(--warn)">⚠ <b>${f._m.m}/${f._m.t}</b> face(s) retrouvée(s) — ${f._m.t-f._m.m} perdue(s).</span>`);
        pNote('Les faces sont retrouvées à chaque rejeu par leur position et leur normale.');
      }
      if(f._thin)pInfo(`<span style="color:var(--warn)">⚠ ${f._thin}</span>`);
      if(f.ref)pNote('Face de référence (plan neutre) : centre ('+f.ref.pos.map(v=>(+v).toFixed(1)).join(' ; ')+') mm.');
      const d=document.createElement('input');d.type='text';d.inputMode='decimal';
      d.value=String(+f.angle||0).replace('.',',');parFx(d,f,'angle');
      d.addEventListener('change',()=>{
        const v=parseFloat(String(d.value).replace(',','.').replace(/\s/g,''));
        if(!isFinite(v)){d.value=String(+f.angle||0).replace('.',',');return;}
        if(!draftAngleOk(v)){d.value=String(+f.angle||0).replace('.',',');faceEl.textContent='Angle hors bornes : −90 < a < 90°, non nul (négatif = sens inversé).';return;}
        if(v===+f.angle)return;
        docPushUndo();
        f.angle=v;f.name=draftName(f);repSyncForFeature(f);
        markDirty();rebuild();renderTree();renderProps();
      });
      pRow('Angle (°)',d);
      // V0.11.19 : inversion du sens sans toucher à la valeur (une expression ƒx reste liée)
      const fb=document.createElement('input');fb.type='checkbox';fb.checked=!!f.flip;
      fb.onchange=()=>{docPushUndo();f.flip=fb.checked;f.name=draftName(f);repSyncForFeature(f);markDirty();rebuild();renderTree();renderProps();};
      pRow('⇄ Inverser le sens',fb);
      pNote('Angle de démoulage : chaque face retenue pivote de cet angle autour de sa ligne d\'intersection avec le plan neutre. Sens effectif '+String(Math.round(draftAngleEff(f)*100)/100).replace('.',',').replace('-','−')+'° : la pièce '+(draftAngleEff(f)>=0?'se resserre':'s\'évase')+' le long de la normale du plan neutre.');
      pBtns([['📐 Re-sélectionner les faces',()=>{exitDraftMode(true);try{if(filMode||filModeX)exitFilletMode(true);}catch(e){}enterDraftMode(f);}]]);
      visDel(f);
      return;
    }
    /* — coque — */
    if(f.type==='xshell'&&f.kind==='souffle'){soufProps(p,f);visDel(f);return;} // coque soufflée (87-coque-souffle)
    if(f.type==='xshell'){
      pH('Coque (évidage)');
      pInfo(`<b>${f.name}</b> · ${(f.faces||[]).length} face(s) retirée(s)`);
      if(f._m&&f._m.t&&f._m.m<f._m.t){
        pInfo(`<span style="color:var(--warn)">⚠ <b>${f._m.m}/${f._m.t}</b> face(s) retrouvée(s) — ${f._m.t-f._m.m} perdue(s).</span>`);
      }
      if((f.faces||[]).length)pNote('Ouverture(s) : '+f.faces.map(r=>'('+r.pos.map(v=>(+v).toFixed(1)).join(' ; ')+')').join(' · '));
      const d=document.createElement('input');d.type='text';d.inputMode='decimal';
      d.value=String(+f.thick||0).replace('.',',');parFx(d,f,'thick');
      d.addEventListener('change',()=>{
        const v=parseFloat(String(d.value).replace(',','.').replace(/\s/g,''));
        if(!isFinite(v)){d.value=String(+f.thick||0).replace('.',',');return;}
        if(!(v>0)){d.value=String(+f.thick||0).replace('.',',');faceEl.textContent='La paroi doit être strictement positive.';return;}
        if(v===+f.thick)return;
        docPushUndo();
        f.thick=v;f.name=shellName(f);repSyncForFeature(f);
        markDirty();rebuild();renderTree();renderProps();
      });
      pRow('Paroi (mm)',d);
      pNote('L\'intérieur est creusé de cette épaisseur sous chaque face conservée.');
      pBtns([['🥚 Re-sélectionner les faces',()=>{exitCoqueMode(true);try{if(filMode||filModeX)exitFilletMode(true);}catch(e){}enterCoqueMode(f);}]]);
      visDel(f);
      return;
    }
    /* — suppression de faces — */
    if(f.type==='xdelface'){
      pH('Suppression de face');
      pInfo(`<b>${f.name}</b>`);
      if(f._m&&f._m.t&&f._m.m<f._m.t){
        pInfo(`<span style="color:var(--warn)">⚠ <b>${f._m.m}/${f._m.t}</b> face(s) supprimée(s) — ${f._m.t-f._m.m} perdue(s) ou refusée(s).</span>`);
      }
      if((f.faces||[]).length)pNote('Face(s) retirée(s) : '+f.faces.map(r=>'('+r.pos.map(v=>(+v).toFixed(1)).join(' ; ')+')').join(' · '));
      pNote('Les faces voisines sont prolongées jusqu\'à se rejoindre (congé → arête vive, trou → rebouché). Pour revenir en arrière : Ctrl+Z ou supprimer cette fonction.');
      pBtns([['⌫ Modifier les faces',()=>{exitCoqueMode(true);try{if(filMode||filModeX)exitFilletMode(true);}catch(e){}enterCoqueMode(f);}]]);
      visDel(f);
      return;
    }
    /* — en-tête commun (extrude, fillet, xfillet, repeat, hole, revolve, combine…) — */
    const filRims=f.rims||((f.rimTop||f.rimBot)?{top:!!f.rimTop,bottom:!!f.rimBot}:null);
    const typeLabel=f.type==='extrude'?((f.op||'add')==='cut'?'➖ ':'➕ ')+extName(f)
      :f.type==='fillet'?'Congé R'+f.radius+' · '+(f.corners||[]).length+' verticale(s)'
      :f.type==='xfillet'?xLabel(xKindOf(f))+' · '+(f.edges||[]).length+' arête(s)'+xChamLabel(f)
      :f.type==='repeat'?'Répétition'
      :f.type==='hole'?'Perçage'
      :f.type==='revolve'?'Révolution'
      :f.type==='sweep'?'Balayage'
      :f.type==='combine'?'Combiner'
      :f.type==='gear'?'Fonction'
      :'Import';
    pH(typeLabel);
    pInfo(`<b>${f.name}</b>`);
    if(f.type==='xfillet'&&f._m&&f._m.t&&f._m.m<f._m.t){
      const manquant=f._m.t-f._m.m;
      pInfo(`<span style="color:var(--warn)">⚠ <b>${f._m.m}/${f._m.t}</b> arêtes retrouvées — ${manquant} perdue(s).</span>`);
      if(f._miss&&f._miss.length)pNote('Introuvables, près de : '+f._miss.map(q=>'('+q.join(', ')+')').join('  '));
      if(f._err)pNote(f._err);
      else pNote('La pièce a bougé depuis la sélection. Re-sélectionnez l\'arête.');
    }
    if(f.type==='xfillet'&&f._rate){
      pInfo(`<span style="color:var(--warn)">⚠ <b>Non fait sur ${f._rate.n}/${f._rate.t}</b> arête(s) : le noyau les refuse ou les ignore.</span>`);
      pNote('Près de : '+f._rate.pos.slice(0,6).map(q=>'('+q.join(', ')+')').join('  '));
    }
    /* — répétition — */
    if(f.type==='repeat'){
      const majEntete=()=>{
        const k=doc.features.filter(c=>c.repeatId===f.id).length;
        entete.innerHTML=`<b>${f.name}</b> · ${repTypeName(f.mode,f)} · ${f.copies||1} copie(s) · ${k} instance(s)`;
      };
      const entete=document.createElement('div');p.appendChild(entete);majEntete();
      p.appendChild(repSourceList(f.base,function(b){
        docPushUndo('sources de « '+f.name+' »');f.base=b;
        repGenChildren(f);markDirty();rebuild();renderTree();refreshParts();
      },function(){majEntete();},f));
      const applyCfg=()=>{repGenChildren(f);markDirty();rebuild();renderTree();renderProps();refreshParts();};
      // ✂ exemplaires à enlever (repSkipFill) : la case reste en place, le panneau se refait après le clic
      const skipUI=()=>p.appendChild(repSkipFill(document.createElement('div'),f,v=>{
        docPushUndo('exemplaires enlevés de « '+f.name+' »');if(v)f.skip=v;else delete f.skip;
        repHoverRemove();setTimeout(applyCfg,0);
      },()=>(f.base||[]).slice()));
      // 🎯 / ⇄ sur la LIGNE de l'axe qu'ils règlent (et non en bas du panneau)
      const icoBtns=(row,list)=>{list.forEach(([ic,tip,fn])=>{const b=document.createElement('button');b.className='mini repDirBtn';b.textContent=ic;b.title=tip;b.style.cssText='padding:1px 6px;margin-left:4px;flex:none';b.onclick=fn;row.appendChild(b);});return row;};
      const pickTip='Prendre la direction de la sélection dans la vue : arête droite (sa direction), cercle ou arc (son axe), sinon face (sa normale)';
      const typ=pSel([['lin','Linéaire'],['circ','Circulaire'],['mir','Symétrie'],['path','Suivant un profil']],f.mode||'lin',
        v=>{docPushUndo('type de « '+f.name+' »');f.mode=v;
          if(v==='path'&&!f.path){const G=pgGuideSketches(doc);if(G.length)f.path=pgDefaultPath(G[G.length-1]);}
          f.name=repTypeName(f.mode,f);applyCfg();});
      pRow('Type',typ);
      const opS=pSel(REP_OPS.map(o=>[o[0],o[1]]),repIsNewBody(f)?'new':'join',v=>{
        docPushUndo('opération de « '+f.name+' »');
        if(v==='new')f.op='new';else delete f.op;
        applyCfg();
      });
      opS.classList.add('repOpSel');opS.title=REP_OPS.find(o=>o[0]===(repIsNewBody(f)?'new':'join'))[2];
      pRow('Opération',opS);
      if(repIsNewBody(f)){
        const nb=new Set(doc.features.filter(k=>k.repeatId===f.id).map(k=>k.body));
        pNote('◧ '+nb.size+' corps créé(s) — un par exemplaire'+(repNewBodyEmpty(f)?'':' ; renommer, colorer ou combiner chacun dans l’arbre')+'.');
        if(repNewBodyEmpty(f))pNote('⚠ Aucune source n’ajoute de matière (découpe, congé, dépouille…) : les corps créés restent vides. Cochez aussi l’extrusion de base, ou choisissez « Unir ».');
        if((f.dropKeys||[]).length)pBtns([['↺ Rétablir '+f.dropKeys.length+' exemplaire(s) supprimé(s)',()=>{
          docPushUndo('exemplaires de « '+f.name+' » rétablis');
          delete f.dropKeys;applyCfg();
        }]]);
      }
      // 2026-10-23 : QUANTITÉ, original compris (6 = l'original + 5 copies) ; stocké : copies = quantité − 1
      const cnt=repQtyInput((+f.copies||1)+1,'Quantité, original compris (6 = l’original + 5 copies)');
      if(f.mode!=='mir')parFx(cnt,f,'qty'); // ƒx : « N », « N*2 », « N = 6 » — nombre sans unité, arrondi
      cnt.onchange=()=>{f.copies=repMaxCopies(repQtyRead(cnt)-1);applyCfg();};
      if(f.mode!=='mir')pRow('Quantité',cnt);
      if(f.mode==='path'){
        repPathUI(f,f.id,(lab,ctl)=>pRow(lab,ctl),t=>pNote(t),fn=>{docPushUndo('profil de « '+f.name+' »');fn(f);applyCfg();});
        skipUI();visDel(f);
        return;
      }
      const axOpts=['X','Y','Z','Face'].map(v=>[v,f.mode==='mir'?(v==='X'?'YZ':v==='Y'?'XZ':v==='Z'?'XY':v):(v==='Face'?'Face / arête':v)]);
      const axCur=f.mode==='mir'?(f.plane==='XY'?'Z':f.plane==='XZ'?'Y':f.plane==='Face'?'Face':'X'):(f.axis||'X');
      icoBtns(pRow(f.mode==='mir'?'Plan':'Axe',pSel(axOpts,axCur,
        v=>{if(f.mode==='mir'){f.plane=v==='X'?'YZ':v==='Y'?'XZ':v==='Z'?'XY':'Face';delete f.planeN;}else{f.axis=v;delete f.dir;}applyCfg();})),
        f.mode==='mir'?[['🎯','Prendre le plan de la face sélectionnée dans la vue (sa normale)',()=>repUseFaceFor(f)]]
          :[['🎯',pickTip,()=>repUseFaceFor(f)],['⇄','Inverser la direction',()=>repFlipDir(f,1)]]);
      if(f.mode==='mir'){
        pChk('2ᵉ plan (double)',!!f.plane2,v=>{
          docPushUndo('2ᵉ plan de « '+f.name+' »');
          if(v){if(!f.plane2)f.plane2=(f.plane||'YZ')==='XZ'?'YZ':'XZ';}
          else{delete f.plane2;delete f.planeN2;}
          f.name=repTypeName(f.mode,f);applyCfg();
        });
        if(f.plane2){
          const ax2=pSel(['X','Y','Z','Face'].map(v=>[v,v==='X'?'YZ':v==='Y'?'XZ':v==='Z'?'XY':v]),
            f.plane2==='XY'?'Z':f.plane2==='XZ'?'Y':f.plane2==='Face'?'Face':'X',
            v=>{docPushUndo('2ᵉ plan');f.plane2=v==='X'?'YZ':v==='Y'?'XZ':v==='Z'?'XY':'Face';delete f.planeN2;applyCfg();});
          icoBtns(pRow('2ᵉ plan',ax2),[['🎯','Prendre le 2ᵉ plan de la face sélectionnée dans la vue (sa normale)',()=>repUseFaceFor(f,2)]]);
        }
        if(f._samePlane)pNote('⚠ Les deux plans sont identiques : la 2ᵉ passe est sans effet.');
      }
      if(f.mode!=='mir')pNote('🎯 : sélectionnez une arête (ou une face) dans la vue, puis cliquez 🎯 — la direction devient « Face / arête ». ⇄ : sens opposé.');
      if(f.mode==='lin'){
        const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';inp.value=f.dist;parFx(inp,f,'dist');
        inp.addEventListener('change',()=>{f.dist=parseFloat(String(inp.value).replace(',','.'))||0;applyCfg();});
        pRow('Distance (mm)',inp);
        // 2ᵉ DIRECTION (grille)
        pChk('2ᵉ direction (grille)',!!f.lin2,v=>{
          docPushUndo('2ᵉ direction de « '+f.name+' »');
          if(v){f.lin2=true;if(!f.axis2)f.axis2=(f.axis||'X')==='X'?'Y':'X';if(!f.copies2)f.copies2=1;if(f.dist2==null)f.dist2=f.dist||10;}
          else{delete f.lin2;}
          f.name=repTypeName(f.mode,f);applyCfg();
        });
        if(f.lin2){
          icoBtns(pRow('2ᵉ axe',pSel(['X','Y','Z','Face'].map(v=>[v,v==='Face'?'Face / arête':v]),f.axis2||'Y',v=>{docPushUndo('2ᵉ direction');f.axis2=v;delete f.dir2;applyCfg();})),
            [['🎯',pickTip,()=>repUseFaceFor(f,2)],['⇄','Inverser la 2ᵉ direction',()=>repFlipDir(f,2)]]);
          const c2=repQtyInput((+f.copies2||1)+1,'Quantité dans la 2ᵉ direction, original compris');parFx(c2,f,'qty2');
          c2.onchange=()=>{docPushUndo('2ᵉ direction');f.copies2=repMaxCopies(repQtyRead(c2)-1);applyCfg();};
          pRow('Quantité 2',c2);
          const i2=document.createElement('input');i2.type='text';i2.inputMode='decimal';i2.value=f.dist2;parFx(i2,f,'dist2');
          i2.addEventListener('change',()=>{docPushUndo('2ᵉ direction');f.dist2=parseFloat(String(i2.value).replace(',','.'))||0;applyCfg();});
          pRow('Distance 2 (mm)',i2);
          const tot=(repMaxCopies(f.copies)+1)*(repMaxCopies(f.copies2)+1);
          pNote('Grille '+(repMaxCopies(f.copies)+1)+' × '+(repMaxCopies(f.copies2)+1)+' = '+tot+' exemplaires, original compris'+(tot-1>REPEAT_MAX?' — limité à '+REPEAT_MAX+' copies':'')+'.');
        }
      }
      if(f.mode==='circ'){
        const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';inp.value=f.angle;parFx(inp,f,'angle');
        inp.addEventListener('change',()=>{f.angle=parseFloat(String(inp.value).replace(',','.'))||360;applyCfg();});
        pRow('Angle total (°)',inp);
      }
      if(f.mode!=='mir')skipUI();
      visDel(f);
      return;
    }
    /* — congé simple (fillet legacy) — */
    if(f.type==='fillet'){
      const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';inp.value=f.radius;parFx(inp,f,'radius');
      const commit=()=>{
        const v=parseFloat(String(inp.value).replace(',','.'));
        if(v>0&&isFinite(v)){f.radius=v;const nc=(f.corners||[]).length+((filRims&&(filRims.top||filRims.bottom))?1:0);f.name=`Congé R${v} (${nc} arête(s))`;markDirty();rebuild();renderProps();}
      };
      inp.addEventListener('change',commit);inp.addEventListener('blur',commit);
      inp.addEventListener('keydown',e=>{if(e.key==='Enter'){commit();inp.blur();}});
      pRow('Rayon (mm)',inp);
    }
    if(f.type==='combine'&&typeof combineProps==='function'){combineProps(p,f);}
    /* — congé exact (xfillet) — */
    if(f.type==='xfillet'){
      if(f._m)pInfo(f._m.m>=f._m.t?`✅ ${f._m.m}/${f._m.t} arêtes retrouvées`:`⚠ ${f._m.m}/${f._m.t} arêtes retrouvées — cliquez « Modifier la sélection »`);
      if(f._err){const e=document.createElement('div');e.style.cssText='font-size:.78rem;color:#ff6b60;background:rgba(255,69,58,.09);border:1px solid rgba(255,69,58,.3);border-radius:6px;padding:5px 7px;margin-top:6px';e.textContent='⚠ '+f._err;p.appendChild(e);}
      if(f._adj&&!f._err){const e=document.createElement('div');e.style.cssText='font-size:.78rem;color:var(--warn);background:rgba(255,159,10,.09);border:1px solid rgba(255,159,10,.3);border-radius:6px;padding:5px 7px;margin-top:6px';e.textContent='⚠ '+f._adj;p.appendChild(e);} // V0.44.1 : rayon ramené (20)
      const lst=document.createElement('div');lst.className='col';lst.style.marginTop='6px';lst.style.maxHeight='180px';lst.style.overflow='auto';
      (f.edges||[]).forEach((s,i)=>{
        const r=document.createElement('div');r.className='tnode';
        const k=xKindOf(f),dp=xDimPrefix(k);
        r.innerHTML=`<span>${xIcon(k)}</span><span class="nm">${s.name?`<b>${s.name}</b> · `:''}${dp} <b>${s.r}</b>${s.anchor?' ⌖':''} · (${s.pos.map(v=>v.toFixed(1)).join(', ')})</span>`;
        const num=document.createElement('input');num.type='text';num.inputMode='decimal';num.value=s.r;num.title=(f.chamfer?'Distance':'Rayon')+' de cette arête';parFx(num,s,'r');
        num.onclick=ev=>ev.stopPropagation();
        const c2=()=>{const v=parseFloat(String(num.value).replace(',','.'));if(v>0&&isFinite(v)){s.r=v;repSyncForFeature(f);markDirty();rebuild();renderProps();}};
        num.addEventListener('change',c2);num.addEventListener('blur',c2);
        num.addEventListener('keydown',e=>{if(e.key==='Enter'){c2();num.blur();}e.stopPropagation();});
        r.appendChild(num);
        const x=document.createElement('span');x.textContent='✕';x.title='Retirer';x.style.cursor='pointer';
        x.onclick=ev=>{ev.stopPropagation();f.edges.splice(i,1);f.name=xFeatName(f);repSyncForFeature(f);markDirty();rebuild();renderProps();};
        r.appendChild(x);lst.appendChild(r);
      });
      p.appendChild(lst);
      if(f.chamfer){
        // V0.11.19 : type du chanfrein — distance égale / deux distances / distance + angle, inversion
        const sm=document.createElement('select');
        [['eq','Distance égale'],['d2','Deux distances'],['da','Distance + angle']].forEach(o=>{const op=document.createElement('option');op.value=o[0];op.textContent=o[1];sm.appendChild(op);});
        sm.value=(f.cmode==='d2'||f.cmode==='da')?f.cmode:'eq';
        sm.onclick=ev=>ev.stopPropagation();
        sm.onchange=()=>{
          docPushUndo();f.cmode=sm.value;
          if(sm.value==='d2'&&!(+f.cd2>0))f.cd2=+((f.edges||[])[0]&&f.edges[0].r)||1;
          if(sm.value==='da'&&!(+f.cang>0&&+f.cang<90))f.cang=45;
          if(sm.value==='eq'){delete f.cflip;}
          repSyncForFeature(f);markDirty();rebuild();renderTree();renderProps();
        };
        pRow('Type',sm);
        if(sm.value!=='eq'){
          const da=sm.value==='da',key=da?'cang':'cd2';
          const i2=document.createElement('input');i2.type='text';i2.inputMode='decimal';i2.value=String(+f[key]||(da?45:1)).replace('.',',');parFx(i2,f,key);
          i2.onclick=ev=>ev.stopPropagation();
          const c3=()=>{
            const v=parseFloat(String(i2.value).replace(',','.'));
            if(!isFinite(v)||v<=0||(da&&v>=90)){i2.value=String(+f[key]).replace('.',',');faceEl.textContent=da?'Angle du chanfrein : 0 < a < 90°.':'Distance 2 : valeur strictement positive.';return;}
            if(v===+f[key])return;
            docPushUndo();f[key]=v;repSyncForFeature(f);markDirty();rebuild();renderTree();renderProps();
          };
          i2.addEventListener('change',c3);i2.addEventListener('blur',c3);
          i2.addEventListener('keydown',e=>{if(e.key==='Enter'){c3();i2.blur();}e.stopPropagation();});
          pRow(da?'Angle (°)':'Distance 2 (mm)',i2);
          const fb=document.createElement('input');fb.type='checkbox';fb.checked=!!f.cflip;
          fb.onchange=()=>{docPushUndo();f.cflip=fb.checked;repSyncForFeature(f);markDirty();rebuild();renderTree();renderProps();};
          pRow('⇄ Inverser les faces',fb);
          pNote((da?'D1 (distance par arête) sur la première face, angle entre le chanfrein et cette face.':'D1 (distance par arête) sur la première face, D2 sur l’autre.')+' Première face : celle qui regarde le plus vers le haut, sinon vers +X puis +Y.');
        }
      }
      pBtns([['✏️ Modifier la sélection',()=>enterExactFilletMode(f)]]);
      // V0.8.0 : une valeur pour toutes les arêtes (comme la flèche dans la vue), OK / Annuler
      if((f.edges||[]).length){
        const all=fdynNumIn(+(f.edges[0].r)||1,v=>fdynSet((f.chamfer?'distance':'rayon')+' de « '+f.name+' »',g=>{(g.edges||[]).forEach(s=>{s.r=v;});}),'fdynAll',80);
        pRow((f.chamfer?'Distance':'Rayon')+' (toutes)',all);
      }
      fdynFoot(p,f);
    }
    {const cb=cutBodiesField(f)||featBodyField(f);if(cb)p.appendChild(cb);} // V0.15.12 : plusieurs corps visibles → tous ou un seul ; sinon corps de la fonction
    if(f.type==='xthread')renderThreadProps(p,f); // V0.35.0 : filetage d'un axe (76-filetage)
    if(f.type==='gear')renderGearProps(p,f); // engrenage (76-engrenage)
    if(f.type==='hole'){fdynEnsure(f);renderHoleProps(p,f);fdynFoot(p,f);} // V0.8.0 : OK / Annuler, flèche de profondeur
    /* — révolution — V0.8.0 : fenêtre dynamique (71-fenetre-dynamique) */
    if(f.type==='revolve'){ fdynRevolvePanel(p,f); }
    if(f.type==='sweep'){ sweepPanel(p,f); } // 75-balayage
    if(f.type==='import'&&f.derive)derProps(p,f); // V0.47.0 : corps dérivé (52)
    if(f.type==='import'){ importColorsPanel(p,f,pRow,pSel,pNote); } // STEP multi-corps : couleur par pièce / occurrence (90)
    /* — extrusion — */
    if(f.type==='extrude'){
      // V0.7.6 : fenêtre de l'extrusion dynamique — boutons à icônes, flèche dans la vue (70-extrusion-dynamique)
      if(f.kw)kwPanel(p,f);else if(f.kwKey)kwKeyPanel(p,f);else extDynPanel(p,f);
    }
    visDel(f);
    return;
  }
  /* ═══════ corps ═══════ */
  if(sel.kind==='body'){
    let e=null;try{e=bodyEntryOf(sel.id);}catch(err){}
    const shown=bodies.filter(x=>!x.ghost&&bodyIdOfRuntime(x)===sel.id);
    const b=shown.find(x=>x.kind==='body')||shown[0]||null;
    const kids=doc.features.filter(f=>!f.repeatId&&f.body===sel.id);
    pH('Corps');
    pInfo(b?`<b>${e?e.name:sel.id}</b> · ${kids.length} fonction(s)`:(e?`<b>${e.name}</b> · corps vide — esquissez puis extrudez.`:'Corps non reconstruit.'));
    if(doc.activeBody!==sel.id)pBtns([['● Activer ce corps',()=>{
      if(!tlActivateBody(sel.id)){renderTree();return;}
      renderTree();renderProps();refreshParts();
      try{faceEl.textContent='« '+((e&&e.name)||sel.id)+' » ACTIF : les nouvelles fonctions naîtront dedans.';}catch(err){}
    }]]);
    p.appendChild(bodyStyleField(sel.id));
    pBtns([
      ['🎯 Isoler',()=>isolate(b.id)],
      ['✅ Tout afficher',showAll],
      ['🗑 Supprimer',()=>delBody(sel.id),'danger']]);
    return;
  }
  /* ═══════ axe d'origine ═══════ */
  if(sel.kind==='originAxis'){
    pH('Axe '+sel.id+' de l’origine');
    pInfo('Référence des constructions : plan à un angle, axe, repère.');
    pBtns([['▱ Plan normal à cet axe',()=>{const a=sel.id;cgStart('plane');if(cgMode){cgSetHow('normal');cgMode.draft.refs[0]={k:'o',id:a};cgNextSlot();cgRefresh();}}]]);
    return;
  }
  /* ═══════ plan d'origine ═══════ */
  if(sel.kind==='plane'){
    const P=PLANES[sel.id]||{role:'',label:''};
    pH('Plan '+sel.id);
    pInfo(`${P.role} — ${P.label}`);
    pBtns([['✏️ Esquisse sur ce plan',()=>newSketch(sel.id)],['▱ Plan décalé',()=>cgStart('plane')]]);
    pChk('Visible',originVis[sel.id]!==false,v=>setOriginVis(sel.id,v));
    return;
  }
  pNote('Sélectionnez un plan / esquisse / fonction / corps dans l\'arbre.');
}
const skName=id=>(doc.sketches.find(s=>s.id===id)||{name:'?'}).name;
const exName=id=>(doc.features.find(f=>f.id===id)||{name:'?'}).name;
function bodyStyleField(id){
  // ── Couleur + transparence du CORPS : la fiche doc.bodies fait foi PARTOUT ──
  // (panneau ci-dessous, clic-droit arbre + vue 3D, rendu). Ni couleur ni opacité
  // par fonction, et surtout AUCUN bouton « Auto » : ce qu'on choisit est ce
  // qu'on a. Tout est appliqué en direct (applyBodyStyleLive) : le glisser ne
  // déclenche aucun rejeu, il n'y a donc rien à « valider » à la fin.
  const holder=document.createElement('div');holder.className='col';
  // V0.10.0 : matériau (bibliothèque 12-materiaux) — donne la couleur, la masse estimée et l'aspect du RENDU
  const wrapM=document.createElement('div');wrapM.className='skrow';
  const labM=document.createElement('label');labM.textContent='Matériau';labM.style.flex='1';
  const selM=matSelect(bodyMatOf(id),k=>{
    setBodyMat(id,k);applyBodyStyleLive(id);
    try{buildEdgeOverlay();}catch(e){} // verre : voile des arêtes arrière (comme le réglage Transparence)
    try{renderTree();}catch(e){}
    try{ctxStyleSync();}catch(e){}
    markDirty();renderProps();
  });
  selM.style.flex='2';selM.style.minWidth='0';
  selM.title='Matériau du corps : sa couleur à l’écran, sa masse estimée et son aspect dans l’atelier RENDU';
  wrapM.appendChild(labM);wrapM.appendChild(selM);holder.appendChild(wrapM);
  const md=matDef(bodyMatOf(id));
  if(md&&md.rho){
    const vol=bodyVolumeMm3(id);
    if(vol>0){const n=document.createElement('div');n.className='pnl-note';
      n.textContent='Masse ≈ '+fmtMasse(vol/1000*md.rho)+'  ('+md.rho.toString().replace('.',',')+' g/cm³ · '+(vol/1000).toFixed(1).replace('.',',')+' cm³)';
      holder.appendChild(n);}
  }
  const wrap=document.createElement('div');wrap.className='skrow';
  const lab=document.createElement('label');lab.textContent='Couleur du corps';lab.style.flex='1';
  const inp=document.createElement('input');
  inp.type='color';inp.value=cssHex(bodyColorOf(id));
  inp.style.width='44px';inp.style.height='26px';inp.style.padding='0';inp.style.border='none';inp.style.background='none';
  inp.title='Couleur de CE corps — la même dans l\u2019arbre, au clic-droit et à l\u2019écran';
  const readHex=()=>{const m=/^#?([0-9a-fA-F]{6})$/.exec(String(inp.value||'').trim());return m?parseInt(m[1],16):null;};
  const sw=swatchRow(c=>{inp.value=cssHex(c);commitColor(c,true);});
  sw.dataset.sw='1'; // repéré par ctxStyleSync : l'anneau suit la source
  const commitColor=(c,fin)=>{
    if(c==null)return;
    setBodyColor(id,c);          // source unique
    applyBodyStyleLive(id);      // écran immédiat, sans rejeu
    try{renderTree();}catch(e){} // nom du corps dans l'arbre : dans sa couleur
    swatchMark(sw,cssHex(c));
    try{ctxStyleSync();}catch(e){}
    if(fin){markDirty();renderProps();}
  };
  inp.addEventListener('input',()=>commitColor(readHex(),false));
  inp.addEventListener('change',()=>commitColor(readHex(),true));
  wrap.appendChild(lab);wrap.appendChild(inp);
  holder.appendChild(wrap);
  holder.appendChild(sw);
  swatchMark(sw,cssHex(bodyColorOf(id)));
  const row=document.createElement('div');row.className='skrow';
  const lab2=document.createElement('label');lab2.textContent='Intensité';lab2.style.flex='1';
  const r=document.createElement('input');r.type='range';r.min='15';r.max='100';r.step='1';
  r.value=Math.round(bodyOpOf(id)*100);r.style.flex='2';
  r.title='100 % = opaque · on voit au travers SANS que la pièce perde son éclat';
  const v=document.createElement('span');v.textContent=r.value+'%';v.style.minWidth='38px';v.style.textAlign='right';v.style.fontSize='.78rem';
  const commitOp=(fin)=>{
    v.textContent=r.value+'%';
    setBodyOp(id,+r.value/100);  // source unique
    applyBodyStyleLive(id);      // direct : pas de rejeu, donc fluide
    try{ctxStyleSync();}catch(e){}
    if(fin){markDirty();renderProps();}
  };
  r.addEventListener('input',()=>commitOp(false));
  r.addEventListener('change',()=>commitOp(true));
  row.appendChild(lab2);row.appendChild(r);row.appendChild(v);
  holder.appendChild(row);
  // 2026-10-16-009 : vraie TRANSPARENCE (on voit l'intérieur), enregistrée avec la pièce
  const rowG=document.createElement('div');rowG.className='skrow';
  const labG=document.createElement('label');labG.textContent='Transparence';labG.style.flex='1';
  const rg=document.createElement('input');rg.type='range';rg.min='0';rg.max='90';rg.step='1';
  rg.value=Math.round((1-bodyGlassOf(id))*100);rg.style.flex='2';
  rg.title='0 % = opaque · on voit au travers de la pièce : poches, perçages, arêtes cachées';
  const vg=document.createElement('span');vg.textContent=rg.value+'%';vg.style.minWidth='38px';vg.style.textAlign='right';vg.style.fontSize='.78rem';
  const commitG=(fin)=>{vg.textContent=rg.value+'%';setBodyGlass(id,1-(+rg.value/100));applyBodyStyleLive(id);try{buildEdgeOverlay();}catch(e){}if(fin){markDirty();renderProps();}};
  rg.addEventListener('input',()=>commitG(false));
  rg.addEventListener('change',()=>commitG(true));
  rowG.appendChild(labG);rowG.appendChild(rg);rowG.appendChild(vg);
  holder.appendChild(rowG);
  return holder;
}
