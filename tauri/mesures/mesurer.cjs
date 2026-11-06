// Mesures de la maquette, mêmes gestes dans l'application et dans Chrome :
//   node tauri/mesures/mesurer.cjs explorer <html>             liste les cotes des deux pièces
//   node tauri/mesures/mesurer.cjs demarrage <html> [n]        temps de démarrage (profil neuf puis déjà servi)
//   node tauri/mesures/mesurer.cjs ram <html> [cibles] [n]     RAM après ouverture puis après 120 modifications
// <html> : le ConceptCAD.html servi à Chrome, celui-là même que l'application emballe.
'use strict';
const fs=require('fs'),path=require('path');
const C=require('./commun.cjs');
const [,,action,html,a3,a4]=process.argv;
const EX=path.join(__dirname,'..','..','Exemples');
const SORTIES=path.join(__dirname,'resultats');
fs.mkdirSync(SORTIES,{recursive:true});
const journal=(nom,o)=>{fs.appendFileSync(path.join(SORTIES,nom+'.jsonl'),JSON.stringify(o)+'\n');console.log(JSON.stringify(o));};

// Quelle cote modifier (voir « explorer ») : une cote qui change vraiment le solide final.
const PIECES=[
  {nom:'Cache Piles',fichier:'Cache Piles.conceptcad'},
  {nom:'Barquette',fichier:'Barquette.conceptcad'}
];
const NB=+(process.env.CC_NB||120);
// Écart entre deux valeurs. Barquette perd son solide à 164,45 : pas de 0,01 mm trop large pour elle.
const PAS=+(process.env.CC_PAS||0.01);
const RETENUES=process.env.CC_PIECES?process.env.CC_PIECES.split(','):null;

const lireTas=()=>{
  const m=(typeof occt!=='undefined'&&occt)?(occt.HEAP8||occt.HEAPU8):null;
  return {
    tasNoyau:m?Math.round(m.buffer.byteLength/1048576):null,
    tasJS:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null,
    corps:bodies.filter(b=>b.kind==='body'&&b.shape).length,
    echecs:(doc.features||[]).filter(f=>f.failed||f.err).length
  };
};

// Cible de la modification : un paramètre nommé s'il existe, sinon la première cote qui agit.
async function choisirCible(page){
  return await page.evaluate(async()=>{
    const sig=()=>{try{return bodies.filter(b=>b.kind==='body'&&b.shape).map(b=>{const g=b.mesh&&b.mesh.geometry;return g&&g.attributes.position?g.attributes.position.count:0;}).join('|')+'#'+(doc.features||[]).filter(f=>f.failed||f.err).length;}catch(e){return '';}};
    const p=(doc.params||[]).find(x=>x.name==='largeur_barquette');
    if(p)return {type:'param',nom:p.name,v0:parseFloat(p.expr)};
    for(const sk of doc.sketches||[])for(const d of sk.dims||[]){
      if(d.type==='angle'||d.expr)continue;
      const v0=parDimUser(d);
      if(!(v0>2))continue;
      const av=JSON.stringify(volumes());
      if(parSetDim(sk,d,String(v0+0.05))!==true)continue;
      await parAfterChange(false);
      const ap=JSON.stringify(volumes()),ok=ap!==av&&(doc.features||[]).every(f=>!f.failed&&!f.err);
      parSetDim(sk,d,String(v0));await parAfterChange(false);
      if(ok)return {type:'cote',esquisse:sk.id,cote:d.id,nomEsquisse:sk.name,v0};
    }
    return null;
    function volumes(){return bodies.filter(b=>b.kind==='body'&&b.shape).map(b=>{const g=b.mesh&&b.mesh.geometry,a=g&&g.attributes.position;if(!a)return 0;g.computeBoundingBox();const s=g.boundingBox;return [a.count,+(s.max.x-s.min.x).toFixed(3),+(s.max.y-s.min.y).toFixed(3),+(s.max.z-s.min.z).toFixed(3)];});}
  });
}

// Une modification : valeur jamais vue, pour que rien ne vienne d'un calcul déjà fait.
async function modifier(page,cible,i){
  return await page.evaluate(async({cible,i,PAS})=>{
    const delta=(i%2?1:-1)*PAS*(1+(i>>1));
    const val=String(+(cible.v0+delta).toFixed(4));
    let r;
    if(cible.type==='param')r=parSetParam(doc.params.find(x=>x.name===cible.nom),val);
    else{const sk=doc.sketches.find(s=>s.id===cible.esquisse),d=sk.dims.find(x=>x.id===cible.cote);r=parSetDim(sk,d,val);}
    if(r!==true)throw new Error('modification refusée : '+r);
    const t=performance.now();
    await parAfterChange(true);
    while(rebuildDepth!==0||regenRun||regenUi)await new Promise(k=>setTimeout(k,5));
    return performance.now()-t;
  },{cible,i,PAS},{timeout:600000});
}

const median=l=>{const s=[...l].sort((a,b)=>a-b);return s[s.length>>1];};

async function explorer(){
  const srv=await C.serveur(path.resolve(html));
  try{
    for(const P of PIECES){
      const s=await C.lancer('app');
      try{
        await C.noyauPret(s);
        await C.ouvrirPiece(s,path.join(EX,P.fichier));
        await C.attendre(2000);
        console.log(P.nom,JSON.stringify(await choisirCible(s.page)),JSON.stringify(await s.page.evaluate(lireTas)),'dialogues',s.dialogues,'erreurs',s.erreurs);
      }finally{await C.arreter(s);}
    }
  }finally{srv.close();}
}

async function demarrage(){
  const n=+(a3||5),srv=await C.serveur(path.resolve(html));
  try{
    for(const cible of ['app','chrome'])for(let i=0;i<=n;i++){
      const s=await C.lancer(cible,{neuf:i===0});
      try{
        const ms=await C.noyauPret(s);
        journal('demarrage',{cible,tour:i,neuf:i===0,ms,version:await s.page.evaluate(()=>APP_VER),v3:await s.page.evaluate(()=>OCCT_V3&&occtReady)});
        await C.attendre(4000); // laisser le cache s'écrire
      }finally{await C.arreter(s);}
    }
  }finally{srv.close();}
}

async function ram(){
  const cibles=(a3||'app,chrome').split(','),n=+(a4||2),srv=await C.serveur(path.resolve(html));
  try{
    for(let rep=0;rep<n;rep++)for(const P of PIECES.filter(x=>!RETENUES||RETENUES.includes(x.nom)))for(const cible of (rep%2?[...cibles].reverse():cibles)){
      const s=await C.lancer(cible);
      const o={cible,piece:P.nom,rep,nb:NB,pas:PAS};
      try{
        o.demarrageMs=await C.noyauPret(s);
        o.version=await s.page.evaluate(()=>APP_VER);
        o.gpu=await s.page.evaluate(()=>{try{const g=document.createElement('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return g.getParameter(e.UNMASKED_RENDERER_WEBGL);}catch(e){return String(e);}});
        await C.attendre(10000);
        o.vide=await C.memoireStable(s);
        o.ouvertureMs=await C.ouvrirPiece(s,path.join(EX,P.fichier));
        await C.attendre(15000);
        o.ouvert=await C.memoireStable(s);
        o.tasOuvert=await s.page.evaluate(lireTas);
        const cible2=await choisirCible(s.page);
        if(!cible2)throw new Error('aucune cote utilisable');
        o.modifiee=cible2;
        const temps=[];const t0=Date.now();
        for(let i=0;i<NB;i++){
          temps.push(await modifier(s.page,cible2,i));
          if((i+1)%30===0)console.log('  ',cible,P.nom,i+1,'/',NB);
        }
        o.modifsTotalS=Math.round((Date.now()-t0)/1000);
        o.modifMedianeMs=Math.round(median(temps));
        o.modifPremieresMs=Math.round(median(temps.slice(0,10)));
        o.modifDernieresMs=Math.round(median(temps.slice(-10)));
        await C.attendre(15000);
        o.apres=await C.memoireStable(s);
        o.tasApres=await s.page.evaluate(lireTas);
        o.dialogues=s.dialogues;o.erreurs=s.erreurs;
      }catch(e){o.echec=String(e&&e.message||e);}
      finally{await C.arreter(s);}
      journal('ram',o);
    }
  }finally{srv.close();}
}

// Suit une modification à la fois : temps, solide, noyau (le solide de Barquette disparaît en cours de série).
async function suivre(){
  const cible=a3||'app',P=PIECES.find(x=>x.nom===(a4||'Barquette')),srv=await C.serveur(path.resolve(html));
  const s=await C.lancer(cible);
  try{
    await C.noyauPret(s);
    await C.ouvrirPiece(s,path.join(EX,P.fichier));
    await C.attendre(5000);
    const c=await choisirCible(s.page);
    for(let i=0;i<NB;i++){
      const ms=await modifier(s.page,c,i);
      const e=await s.page.evaluate(()=>({
        tas:Math.round((occt.HEAP8||occt.HEAPU8).buffer.byteLength/1048576),
        corps:bodies.filter(b=>b.kind==='body'&&b.shape).length,tous:bodies.length,
        ko:(doc.features||[]).filter(f=>f.failed||f.err||f.error||f._err).map(f=>f.name||f.id).slice(0,4),
        val:(doc.params.find(p=>p.name==='largeur_barquette')||{}).expr,
        msg:faceEl.textContent.slice(0,90),regen:!!regenRun,
        pending:typeof delWkPending==='function'?delWkPending():null
      }));
      journal('suivi',{cible,i,ms:Math.round(ms),...e});
    }
  }finally{await C.arreter(s);srv.close();}
}

// À quel moment et pourquoi le solide disparaît : messages de la page et état juste après.
async function perte(){
  const cible=a3||'chrome',P=PIECES.find(x=>x.nom==='Barquette'),srv=await C.serveur(path.resolve(html));
  const s=await C.lancer(cible),msgs=[];
  s.page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')msgs.push(m.text().slice(0,300));});
  const o={cible};
  try{
    await C.noyauPret(s);
    o.version=await s.page.evaluate(()=>APP_VER);
    await C.ouvrirPiece(s,path.join(EX,P.fichier));
    await C.attendre(5000);
    const c=await choisirCible(s.page);
    let i=0;
    for(;i<NB;i++){
      await modifier(s.page,c,i);
      const n=await s.page.evaluate(()=>bodies.filter(b=>b.kind==='body'&&b.shape).length);
      if(!n){o.perteA=i;break;}
      msgs.length=Math.min(msgs.length,20);
    }
    o.messages=msgs.slice(-12);
    o.etat=await s.page.evaluate(()=>{
      const r={val:(doc.params.find(p=>p.name==='largeur_barquette')||{}).expr,fonctions:(doc.features||[]).length,
        corps:bodies.map(b=>[b.kind,b.id,!!b.shape,b.failed||b.err||null].join(':')).slice(0,10),
        pile:docUndoStack.length,msg:faceEl.textContent.slice(0,240),
        journal:(typeof journalListe!=='undefined'?journalListe.slice(-6):[]),
        arret:typeof timelineStop!=='undefined'?timelineStop:null};
      try{builtVersion=-1;builtHash=null;rebuild();r.rejeu='sans erreur';}catch(e){r.rejeu=String(e&&e.stack||e).slice(0,700);}
      r.corpsApres=bodies.filter(b=>b.kind==='body'&&b.shape).length;
      return r;
    });
    o.messagesApres=msgs.slice(-6);
  }catch(e){o.echec=String(e&&e.stack||e);}
  finally{await C.arreter(s);srv.close();}
  journal('perte',o);
}

// Série de référence : RAM lue quand aucun pilote n'est branché (le pilote alourdit Chrome d'environ 150 Mo).
// La pièce revient par son brouillon, comme après une fermeture normale ; le pilote se branche ensuite
// pour vérifier qu'elle est bien là, faire les modifications, puis se débranche avant le relevé suivant.
async function repos(){
  const cibles=(a3||'app,chrome').split(','),n=+(a4||2),srv=await C.serveur(path.resolve(html));
  const profil=require('path').join(require('os').tmpdir(),'cc-mesure-chrome-repos');
  const sansPilote=async()=>{await C.attendre(45000);};
  try{
    for(let rep=0;rep<n;rep++)for(const P of PIECES.filter(x=>!RETENUES||RETENUES.includes(x.nom)))for(const cible of (rep%2?[...cibles].reverse():cibles)){
      const o={cible,piece:P.nom,rep,nb:NB,pas:P.nom==='Barquette'?0.001:0.01};
      let s=null;
      try{
        s=await C.lancer(cible,{profil,sansPilote:true});
        await sansPilote();
        o.vide=await C.memoireStable(s);
        await C.brancher(s);
        await C.noyauPret(s);
        o.version=await s.page.evaluate(()=>APP_VER);
        await C.ouvrirPiece(s,path.join(EX,P.fichier));
        await C.attendre(3000);
        await s.page.evaluate(()=>{autosaveWrite();});
        await C.attendre(6000);
        await C.fermer(s);s=null;
        s=await C.lancer(cible,{neuf:false,profil,sansPilote:true});
        await sansPilote();
        o.ouvert=await C.memoireStable(s);
        await C.brancher(s);
        await C.noyauPret(s);
        o.tasOuvert=await s.page.evaluate(lireTas);
        o.nomOuvert=await s.page.evaluate(()=>doc.features.length);
        const c=await choisirCible(s.page);
        if(!c)throw new Error('aucune cote utilisable');
        o.modifiee=c;
        const t=[];
        for(let i=0;i<NB;i++){
          t.push(await s.page.evaluate(async({c,i,pas})=>{
            const delta=(i%2?1:-1)*pas*(1+(i>>1)),val=String(+(c.v0+delta).toFixed(4));
            let r;
            if(c.type==='param')r=parSetParam(doc.params.find(x=>x.name===c.nom),val);
            else{const sk=doc.sketches.find(k=>k.id===c.esquisse);r=parSetDim(sk,sk.dims.find(x=>x.id===c.cote),val);}
            if(r!==true)throw new Error('refus : '+r);
            const d=performance.now();await parAfterChange(true);
            while(rebuildDepth!==0||regenRun||regenUi)await new Promise(k=>setTimeout(k,5));
            return performance.now()-d;
          },{c,i,pas:o.pas},{timeout:600000}));
        }
        o.modifMedianeMs=Math.round(median(t));
        o.tasApres=await s.page.evaluate(lireTas);
        await s.navigateur.close();s.navigateur=null;
        await C.attendre(30000);
        o.apres=await C.memoireStable(s);
      }catch(e){o.echec=String(e&&e.stack||e);}
      finally{if(s)await C.arreter(s);}
      journal('repos',o);
    }
  }finally{srv.close();require('fs').rmSync(profil,{recursive:true,force:true});}
}

({explorer,demarrage,ram,suivre,perte,repos})[action]().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
