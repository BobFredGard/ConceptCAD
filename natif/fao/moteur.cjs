// Le moteur FAO du programme natif : le calcul des parcours, des liaisons et du G-code reste
// le JavaScript validé du navigateur, sans une ligne changée. Le programme lance ce script seulement quand
// l'atelier FAO en a besoin et lui parle par lignes JSON :
//   entrée  : {"n":1,"cmd":"ouvrir","fichier":"…"}   sortie : §{"n":1,"ok":true,…}
// Seules les lignes qui commencent par § sont des réponses : le reste est du bavardage de l'application.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), readline = require('readline');
// Le dossier préparé par preparer-moteur.cjs : ce script y est copié ; sinon celui de sortie/
const ROOT = process.env.CONCEPTCAD_RACINE || (fs.existsSync(path.join(__dirname, 'ConceptCAD.html')) ? __dirname : path.join(__dirname, '..', 'sortie', 'fao'));
process.env.APP_FILE = process.env.APP_FILE || path.join(ROOT, 'ConceptCAD.html');
const { loadApp, documentStub } = require(path.join(ROOT, 'tests', 'appvm.cjs'));
const DOM = require(fs.existsSync(path.join(__dirname, 'minidom.cjs')) ? path.join(__dirname, 'minidom.cjs') : path.join(ROOT, 'minidom.cjs'));
const ecrireEvt = o => process.stdout.write('§' + JSON.stringify(o) + '\n');
const repondre = o => process.stdout.write('§' + JSON.stringify(o) + '\n');

let sandbox = null, ctx = null;
// La page construit ses fiches dans un vrai petit DOM au lieu des éléments vides du harnais
const PAR_ID = new Map();
function poserDom() {
  DOM.Element.ctx2d = documentStub.getElementById('__canvas').getContext('2d');
  const creer = t => {
    const e = new DOM.Element(t);
    const proprio = { v: '' };
    Object.defineProperty(e, 'id', { get: () => proprio.v, set(v) { proprio.v = String(v); if (v) PAR_ID.set(proprio.v, e); } });
    return e;
  };
  const corps = creer('body');
  documentStub.body = corps;
  documentStub.head = creer('head');
  documentStub.documentElement = creer('html');
  documentStub.createElement = creer;
  documentStub.createElementNS = (ns, t) => creer(t);
  documentStub.createTextNode = t => new DOM.Noeud('#text', 3).avec(t === undefined ? '' : t);
  documentStub.createDocumentFragment = () => new DOM.Noeud('#fragment', 11);
  documentStub.getElementById = id => { let e = PAR_ID.get(id); if (!e) { e = creer('div'); e.id = id; } return e; };
  const racines = () => { const v = new Set(); PAR_ID.forEach(e => { let r = e; while (r.parentNode) r = r.parentNode; v.add(r); }); return [...v].filter(r => r.nodeType === 1); };
  documentStub.querySelectorAll = sel => { const R = []; racines().forEach(r => { if (r._correspond(sel)) R.push(r); R.push(...r.querySelectorAll(sel)); }); return R; };
  documentStub.querySelector = sel => documentStub.querySelectorAll(sel)[0] || null;
  documentStub.activeElement = corps;
}
async function demarrer() {
  const real = await require(path.join(ROOT, 'tests', 'noyau.cjs')).charger();
  poserDom();
  ({ ctx, sandbox } = loadApp());
  sandbox.Event = class { constructor(t, i) { return DOM.evenement(t, i); } };
  // Un fichier « téléchargé » par la page (G-code…) : c'est le programme qui demande où l'écrire
  const BLOBS = new Map();
  sandbox.Blob = class { constructor(p) { this.texte = (p || []).join(''); } };
  sandbox.URL = { createObjectURL(b) { const k = 'blob:' + (BLOBS.size + 1); BLOBS.set(k, b); return k; }, revokeObjectURL(k) { BLOBS.delete(k); } };
  const clic = DOM.Element.prototype.click;
  DOM.Element.prototype.click = function () {
    if (this.tagName === 'A' && this.download && BLOBS.has(this.href)) { ecrireEvt({ evt: 'telecharger', nom: this.download, texte: BLOBS.get(this.href).texte }); return; }
    if (this.tagName === 'INPUT' && this.type === 'file') { ecrireEvt({ evt: 'indisponible', texte: 'Choisir un fichier' }); return; }
    clic.call(this);
  };
  sandbox.alert = t => ecrireEvt({ evt: 'alerte', texte: String(t) });
  sandbox.__natifEvt = t => ecrireEvt(JSON.parse(t));
  sandbox.__realOcct = real;
  sandbox.btoa = globalThis.btoa;
  sandbox.atob = globalThis.atob;
  // Le vrai Three.js, sauf ce qui demande un écran : les boîtes, les repères, le brut et les marques
  // se construisent comme dans la page, et le programme dessine ce qu'ils sont devenus.
  const T0 = sandbox.THREE;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'threejs', 'three.min.js'), 'utf8'), ctx, { filename: 'three.min.js' });
  const T1 = sandbox.THREE;
  const ECRAN = /^(WebGL|OrbitControls|TransformControls|PMREM|CanvasTexture)/;
  sandbox.THREE = new Proxy({}, { get(t, k) { return typeof k === 'string' && !ECRAN.test(k) && T1[k] !== undefined ? T1[k] : T0[k]; } });
  vm.runInContext('scene=new THREE.Scene();camera=new THREE.PerspectiveCamera();camera.matrixAutoUpdate=false;rayc=new THREE.Raycaster();', ctx);
  // La souris : les gestionnaires de la page écoutent ce faux écran
  const ecran = documentStub.getElementById('viewport');
  sandbox.__ecran = ecran;
  sandbox.__tailleEcran = { w: 800, h: 600 };
  ecran.getBoundingClientRect = () => { const t = sandbox.__tailleEcran; return { left: 0, top: 0, right: t.w, bottom: t.h, width: t.w, height: t.h, x: 0, y: 0 }; };
  vm.runInContext('(function(){const r0=renderer;renderer=new Proxy({},{get(t,k){return k==="domElement"?__ecran:r0[k];},set(t,k,v){return true;}});wirePick();})()', ctx);
  documentStub.body.setAttribute('data-ws', 'fao');
  vm.runInContext('occt=__realOcct;occtReady=true;window.confirm=function(){return true;};viewUserMoved=true;', ctx);
  // Les fonctions qui parlent au programme natif, dans le bac à sable de l'application
  vm.runInContext(`
    function __natifArbre(){
      const r=faoRoot();
      return {active:r.activeSetupId,setups:(r.setups||[]).map(function(s){
        const O=faoOrient(s);
        return {id:s.id,name:s.name,open:s.open!==false,
          label:'▤ '+s.name+' · '+(FAO_POSTS[s.machine||s.post]?FAO_POSTS[s.machine||s.post].label:s.machine)+(faoOrientOn(s)?(' · 3+2 B'+O.b+' C'+O.c):''),
          ops:(s.ops||[]).map(function(op,i){
            const t=faoToolById(s,op.toolId)||{};
            return {id:op.id,type:op.type,label:(i+1)+'. '+faoOpShortLabel(op),outil:'T'+(t.num||'?'),on:op.on!==false,hidden:op.hidden===true,stale:op.stale===true,aParcours:faoOpMovesTry(op,s)!=null};
          })};
      })};
    }
    function __natifSemer(moves){
      let n=0;
      (faoRoot().setups||[]).forEach(function(s){(s.ops||[]).forEach(function(op){
        const e=moves['faoMoves:'+s.id+':'+op.id];
        if(e&&e.v===1&&e.k&&cacheVerOK(e.ver)&&Array.isArray(e.mv)&&e.k===faoOpMovesKey(op,s)){faoOpMovesStore(op,e.k,e.mv);n++;}
      });});
      if(n)try{faoMovesDone();}catch(e){}
      return n;
    }
    function __natifPosage(id){return (faoRoot().setups||[]).find(function(s){return s.id===id;})||faoDoc();}
    function __natifTraces(id){
      const job=__natifPosage(id),F=faoFrame(job),O=[];
      faoSeqSafe(job,true).forEach(function(b){
        const op=b.op;
        if(b.absent){O.push({id:op.id,absent:true});return;}
        const sp=faoSegSplit(b.moves,faoSegClipper(op,job));
        O.push({id:op.id,hidden:op.hidden===true,n:b.moves.length,cut:sp.cut,rap:sp.rap,ret:sp.ret,plg:sp.plg});
      });
      return {frame:{X:F.X,Y:F.Y,Z:F.Z,O:F.O,id:F.id},stock:faoStock(job),ops:O,cache:!!faoVw};
    }
    function __natifRegenerer(id,opId){
      const job=__natifPosage(id);let n=0;
      (job.ops||[]).forEach(function(op){
        if(opId&&op.id!==opId)return;
        if(op.on===false&&!opId)return;
        faoOpMovesPurgeOp(op);
        op.stale=false;
        n+=(faoOpMoves(op,job)||[]).length;
      });
      return n;
    }
    function __natifVue(){
      const r=faoRoot();
      try{faoRenderTree();}catch(e){}
      return {active:r.activeSetupId,prev:!!faoPrevOn,perime:!!faoPrevStale,rap:faoViewerRap,message:String(faceEl&&faceEl.textContent||''),
        calcul:!!(faoGenBtnEl&&faoGenBtnEl.disabled),
        arbreEl:document.getElementById('faoTree'),ficheEl:document.getElementById('props'),outilsEl:(faoToolsWin&&faoToolsWin.style.display!=='none')?faoToolsWin:null};
    }
    // Tout ce que la page a posé dans la scène FAO, hors traces : en coordonnées de la pièce
    function __natifScene(){
      try{faoPoseSync();}catch(e){}
      try{faoWalls3D();}catch(e){}
      const O=[];
      const g=faoRoot3D();
      if(!g)return O;
      g.updateWorldMatrix(true,true);
      const v=new THREE.Vector3();
      const voir=function(o){
        if(o===faoPrevGroup||o.visible===false||o.name==='faoViewerTool'||o.name==='faoMatter'||o.name==='faoViewerLine')return;
        const m=o.material,ge=o.geometry,p=ge&&ge.attributes&&ge.attributes.position;
        const mat=Array.isArray(m)?m[0]:m;
        if(p&&mat&&!o.isInstancedMesh&&!mat.isShaderMaterial){
          const k=o.isMesh?'T':(o.isLineSegments?'S':(o.isLine?(o.isLineLoop?'B':'L'):(o.isPoints?'P':'')));
          if(k){
            const idx=ge.index?ge.index.array:null,n=idx?idx.length:p.count,a=new Float32Array(n*3);
            let tr=null;for(let q=o;q;q=q.parent)if(q.userData&&q.userData.triad){tr=q;break;}
            const ancre=tr?new THREE.Vector3().setFromMatrixPosition(tr.matrixWorld):null,ech=tr?(tr.userData.px||70)/(new THREE.Vector3().setFromMatrixScale(tr.matrixWorld).x||1):1;
            for(let i=0;i<n;i++){const q=idx?idx[i]:i;v.fromBufferAttribute(p,q).applyMatrix4(o.matrixWorld);if(ancre)v.sub(ancre).multiplyScalar(ech);a[3*i]=v.x;a[3*i+1]=v.y;a[3*i+2]=v.z;}
            const E={k:k,nom:o.name||'',a:a,c:mat.color?mat.color.getHex():0xffffff,al:mat.transparent?mat.opacity:1,pl:mat.size||0,dep:mat.depthTest!==false,ancre:ancre?[ancre.x,ancre.y,ancre.z]:null};
            // La matière creusée d'un posage 3+2 est éclairée comme dans la page
            if(k==='T'&&mat.isMeshPhongMaterial&&ge.attributes.normal){
              const nr=ge.attributes.normal,N=new Float32Array(n*3),M=new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
              for(let i=0;i<n;i++){const q=idx?idx[i]:i;v.fromBufferAttribute(nr,q).applyMatrix3(M).normalize();N[3*i]=v.x;N[3*i+1]=v.y;N[3*i+2]=v.z;}
              E.nrm=N;E.sp=mat.specular?mat.specular.getHex():0x111111;E.sh=mat.shininess||30;
            }
            O.push(E);
          }
        }
        (o.children||[]).forEach(voir);
      };
      (g.children||[]).forEach(voir);
      return O;
    }
    function __natifSig(){
      const j=faoDoc(),o=[];
      (j.ops||[]).forEach(function(op){const h=faoOpMovesHit(op);o.push([op.id,op.on!==false,op.hidden===true,op.stale===true,h?h.key:'',h&&h.mv?h.mv.length:0]);});
      return JSON.stringify([j.id,j.stock,j.origin,j.orient,j.wcs,o,faoPrevOn,faoViewerRap,!!faoVw]);
    }
    faoSkOpen=function(id){
      const f=faoSkFind(id);if(!f||faoSkEditId)return false;
      f.sk.fao=f.setup.id;faoSkEditId=id;
      __natifEvt(JSON.stringify({evt:'esquisseFao',id:id,sk:f.sk}));
      return true;
    };
    function __natifEsquisseFin(id,sk){
      const f=faoSkFind(id);faoSkEditId=null;
      if(!f)return;
      if(sk){Object.keys(f.sk).forEach(function(k){delete f.sk[k];});Object.assign(f.sk,sk);f.sk.fao=f.setup.id;}
      faoSkAfterEdit(f.sk);
    }
    function __natifAction(nom,type){
      if(nom==='esquisse')return faoSkNew();
      if(nom==='extrusion')return faoWallNew();
      const clic=function(id){document.getElementById(id).click();};
      if(nom==='posage'){const b=Array.from(document.querySelectorAll('#faoTreeWrap button')).find(function(x){return x.textContent.indexOf('+ Posage')>=0;});if(b)b.click();return;}
      if(nom==='outils')return clic('faoToolsBtn');
      if(nom==='usinage')return faoViewerToggle();
      if(nom==='rapides')return clic('faoRapBtn');
      if(nom==='regenerer')return clic('faoGenBtn');
      if(nom==='gcode')return faoExport();
      if(nom==='ajout'){const sp=faoAddOpsSpec().find(function(a){return String(a[1]).replace('+ ','')===type;});if(sp)mfFaoAdd(sp[0],type);return;}
    }
    function __natifEtat(base){
      const moves={};
      (faoRoot().setups||[]).forEach(function(s){(s.ops||[]).forEach(function(op){
        const c='faoMoves:'+s.id+':'+op.id,h=faoOpMovesHit(op);
        if(!h||!h.mv)return;
        const b=base&&base[c];
        moves[c]=(b&&b.k===h.key)?b:{v:1,ver:CACHE_VER,k:h.key,n:h.mv.length,at:Date.now(),mv:h.mv};
      });});
      return {fao:faoRoot(),moves:moves};
    }
    // La lecture d'usinage : la page taille sa grille, le programme dessine. Ses maillages restent vides :
    // on note seulement les colonnes qu'elle voulait réécrire.
    faoDetailCfg.forEach(function(c){c.F*=0.5;});
    var __natifCols=[],__natifVu={m:null,look:null,lisse:false},__natifOutil=null;
    faoViewerMatterWriteCol=function(vw,c){__natifCols.push(c);};
    faoViewerMatterHFUpdate=function(vw,chg){for(let i=0;i<chg.length;i++)__natifCols.push(chg[i]);};
    function __natifBarre(){
      if(!faoVw||!faoVwBar)return null;
      faoVwBar.className='fao-row';
      if(faoVwEngSel)faoVwEngSel.style.display='none';
      if(faoVwBarT)faoVwBarT.textContent='';
      return faoVwBar;
    }
    function __natifMatrice(o){o.updateWorldMatrix(true,false);return Array.from(o.matrixWorld.elements);}
    // L'outil, dans son propre repère, seulement quand il change
    function __natifPiecesOutil(vw){
      const T=vw.tool,sp=vw.toolSpin,a0=sp?sp.rotation.y:0,L=[],I=new THREE.Matrix4(),R=new THREE.Matrix4(),N=new THREE.Matrix3(),v=new THREE.Vector3();
      if(sp)sp.rotation.y=0;
      T.updateWorldMatrix(true,true);
      I.copy(T.matrixWorld).invert();
      T.traverse(function(o){
        if(!o.isMesh||!o.geometry||!o.geometry.attributes.position)return;
        for(let p=o;p&&p!==T;p=p.parent)if(p.visible===false)return;
        let tourne=false;for(let p=o;p&&p!==T;p=p.parent)if(p===sp)tourne=true;
        const ge=o.geometry,P=ge.attributes.position,Q=ge.attributes.normal,idx=ge.index?ge.index.array:null,n=idx?idx.length:P.count,A=new Float32Array(n*3),B=new Float32Array(n*3);
        R.multiplyMatrices(I,o.matrixWorld);N.getNormalMatrix(R);
        for(let i=0;i<n;i++){const q=idx?idx[i]:i;v.fromBufferAttribute(P,q).applyMatrix4(R);A[3*i]=v.x;A[3*i+1]=v.y;A[3*i+2]=v.z;if(Q){v.fromBufferAttribute(Q,q).applyMatrix3(N).normalize();B[3*i]=v.x;B[3*i+1]=v.y;B[3*i+2]=v.z;}}
        const m=o.material;
        L.push({a:A,nrm:B,c:m.color?m.color.getHex():0x9ad1ff,sp:m.specular?m.specular.getHex():0x111111,sh:m.shininess||30,tourne:tourne});
      });
      if(sp)sp.rotation.y=a0;
      return L;
    }
    function __natifTrame(dt){
      const vw=faoVw;
      if(!vw){__natifCols=[];__natifVu={m:null,look:null,lisse:false};__natifOutil=null;return {sim:false};}
      if(dt>0&&vw.playing)faoViewerAdvance(dt);
      faoViewerBarUpdate();
      const R={sim:true,jouer:!!vw.playing,fin:vw.t>=vw.T,temps:faoVwBarT?faoVwBarT.textContent:'',vox:vw.voxAt||0,piece:!(vw.matterOn!==false||faoVwHideBody)};
      const G=faoRoot3D();
      R.racine=G?__natifMatrice(G):null;
      const g=vw.matterGrid,m=vw.matter;
      if(m&&g&&vw.mTops&&!vw.eng){
        const L=FAO_LOOKS[faoMatterLook]||FAO_LOOKS.beige,lisse=!!vw.mH,nc=g.nx*g.ny;
        let cols=__natifCols;
        if(m!==__natifVu.m||faoMatterLook!==__natifVu.look||lisse!==__natifVu.lisse){
          __natifVu={m:m,look:faoMatterLook,lisse:lisse};
          R.grille={nx:g.nx,ny:g.ny,pas:g.pas,ox:g.ox,oy:g.oy,oz:g.oz,sx1:g.sx1,sy1:g.sy1,full:g.full,lisse:lisse,c:L.color,sp:L.specular,sh:L.shininess};
          cols=null;
        }
        const n=cols?cols.length:nc,F=new Float32Array(n*8),T=vw.mTops,N=g.nrm,W=g.wn,C=vw.cav;
        for(let i=0;i<n;i++){
          const c=cols?cols[i]:i,o=i*8;
          F[o]=c;F[o+1]=T[c];F[o+2]=N?N[c*4]:0;F[o+3]=N?N[c*4+1]:0;F[o+4]=N?N[c*4+2]:1;F[o+5]=W?W[c*2]:0;F[o+6]=W?W[c*2+1]:0;F[o+7]=C&&C[c]?1:0;
        }
        if(n)R.cols=F;
      }else{__natifVu.m=null;R.sans=true;}
      __natifCols=[];
      if(vw.tool){
        const cle=[vw.toolSig,vw.toolBody?vw.toolBody.scale.x:0,vw.toolHold?vw.toolHold.visible:false,vw.toolHold?vw.toolHold.scale.x:0].join('|');
        if(cle!==__natifOutil){__natifOutil=cle;R.pieces=__natifPiecesOutil(vw);}
        R.outil=__natifMatrice(vw.tool);
        R.spin=vw.toolSpin?vw.toolSpin.rotation.y:0;
      }
      if(vw.line){
        const ge=vw.line.geometry,P=ge.attributes.position.array,C=ge.attributes.color.array,d=ge.drawRange.start,n=Math.min(ge.drawRange.count,ge.attributes.position.count-d);
        if(n>1){
          const F=new Float32Array(n*6);
          for(let i=0;i<n;i++){const j=d+i;F[6*i]=P[3*j];F[6*i+1]=P[3*j+1];F[6*i+2]=P[3*j+2];F[6*i+3]=C[3*j];F[6*i+4]=C[3*j+1];F[6*i+5]=C[3*j+2];}
          R.ligne=F;
        }
      }
      return R;
    }
    function faoOpMovesPurgeOp(op){try{if(faoOpMovesMap)faoOpMovesMap.delete(op);}catch(e){}}
  `, ctx);
}
let baseMoves = null;
function vue() {
  const v = vm.runInContext('__natifVue()', ctx);
  const barre = vm.runInContext('__natifBarre()', ctx);
  return { active: v.active, prev: v.prev, perime: v.perime, rap: v.rap, message: v.message, calcul: v.calcul, sig: vm.runInContext('__natifSig()', ctx), arbre: DOM.decrire(v.arbreEl), fiche: DOM.decrire(v.ficheEl), outils: v.outilsEl ? DOM.decrire(v.outilsEl) : null, sim: !!barre, barre: barre ? DOM.decrire(barre) : null };
}
// Les traces en nombres bruts dans un fichier : Perçages en a déjà plusieurs Mo
function tracesFichier(a) {
  sandbox.__id = a.posage || null;
  const t = vm.runInContext('__natifTraces(__id||faoRoot().activeSetupId)', ctx);
  const B = [];
  const ops = t.ops.map(o => {
    const L = {};
    if (o.absent) return { id: o.id, absent: true };
    for (const k of ['cut', 'rap', 'ret', 'plg']) { const f = Float32Array.from(o[k] || []); L[k] = f.length; B.push(Buffer.from(f.buffer, f.byteOffset, f.byteLength)); }
    return { id: o.id, hidden: o.hidden, ...L };
  });
  fs.writeFileSync(a.fichier, Buffer.concat(B));
  return { frame: t.frame, stock: t.stock, ops, cache: t.cache };
}
const attendreCalcul = () => new Promise(fin => {
  const t = setInterval(() => {
    const v = vm.runInContext('({c:!!(faoGenBtnEl&&faoGenBtnEl.disabled),m:String(faceEl&&faceEl.textContent||"")})', ctx);
    if (!v.c) { clearInterval(t); fin(); } else ecrireEvt({ evt: 'message', texte: v.m });
  }, 400);
});
// La scène FAO hors traces, dans un fichier : les nombres à la suite, la description en réponse
function sceneFichier(a) {
  const O = vm.runInContext('__natifScene()', ctx);
  const B = [];
  const objets = O.map(o => {
    const f = Float32Array.from(o.a);
    B.push(Buffer.from(f.buffer, f.byteOffset, f.byteLength));
    const x = { k: o.k, nom: o.nom, n: f.length, c: o.c, al: o.al, pl: o.pl, dep: o.dep, ancre: o.ancre ? Array.from(o.ancre) : null };
    if (o.nrm) { const g = Float32Array.from(o.nrm); B.push(Buffer.from(g.buffer, g.byteOffset, g.byteLength)); x.lit = true; x.sp = o.sp; x.sh = o.sh; }
    return x;
  });
  fs.writeFileSync(a.fichier, Buffer.concat(B));
  return { objets };
}
const b64 = f => Buffer.from(f.buffer, f.byteOffset, f.byteLength).toString('base64');
const COMMANDES = {
  // Une image de la lecture d'usinage : le temps écoulé, puis ce qui a changé
  esquisseFin(a) {
    sandbox.__id = a.id;
    sandbox.__sk = a.sk ? JSON.stringify(a.sk) : null;
    vm.runInContext('__natifEsquisseFin(__id,__sk?JSON.parse(__sk):null)', ctx);
    return vue();
  },
  simuler(a) {
    sandbox.__dt = +a.dt || 0;
    const r = vm.runInContext('__natifTrame(__dt)', ctx);
    if (r.cols) r.cols = b64(r.cols);
    if (r.ligne) r.ligne = b64(r.ligne);
    if (r.pieces) r.pieces = r.pieces.map(p => ({ ...p, a: b64(p.a), nrm: b64(p.nrm) }));
    return r;
  },
  vue,
  tracesFichier,
  sceneFichier,
  toucher(a) {
    DOM.toucher(a.el, a.sorte, a.valeur, { ctrlKey: !!a.ctrl, shiftKey: !!a.maj, key: a.touche || '' });
    return vue();
  },
  // Un clic dans la vue : la caméra du programme, puis les mêmes événements que la page
  souris(a) {
    sandbox.__tailleEcran = { w: a.w, h: a.h };
    sandbox.__cam = a;
    vm.runInContext(`(function(a){
      const c=camera;
      c.isPerspectiveCamera=!!a.persp;c.isOrthographicCamera=!a.persp;c.near=a.near;c.far=a.far;
      c.projectionMatrix.fromArray(a.proj);c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
      c.matrixWorldInverse.fromArray(a.vue);c.matrixWorld.copy(c.matrixWorldInverse).invert();c.matrix.copy(c.matrixWorld);
      c.position.setFromMatrixPosition(c.matrixWorld);
    })(__cam)`, ctx);
    const m = { clientX: a.x, clientY: a.y, offsetX: a.x, offsetY: a.y, button: a.bouton || 0, buttons: 0, ctrlKey: !!a.ctrl, shiftKey: !!a.maj, altKey: false, metaKey: false };
    const e = documentStub.getElementById('viewport');
    for (const s of a.sortes || ['pointerdown', 'pointerup']) e.dispatchEvent(DOM.evenement(s, { ...m, bubbles: false }));
    return vue();
  },
  touche(a) {
    documentStub.dispatchEvent(DOM.evenement('keydown', { key: a.key, code: a.code || '', ctrlKey: !!a.ctrl, shiftKey: !!a.maj, target: documentStub.body }));
    if (a.key === 'Escape') vm.runInContext("if(faoToolsWin)faoToolsWindowClose();else if(faoVw){faoViewerClose();faoViewerMsg('FAO : mode lecture usinage quitté (Échap) — traces ré-affichées.');}", ctx);
    return vue();
  },
  async action(a) {
    sandbox.__nom = a.nom; sandbox.__type = a.type || null;
    vm.runInContext('__natifAction(__nom,__type)', ctx);
    if (a.nom === 'regenerer') { ecrireEvt({ evt: 'message', texte: 'FAO : génération…' }); await new Promise(r => setTimeout(r, 50)); await attendreCalcul(); }
    return vue();
  },
  // Ce que le programme écrira dans le fichier : doc.fao et les parcours
  etat(a) {
    sandbox.__base = baseMoves;
    const e = vm.runInContext('__natifEtat(__base)', ctx);
    fs.writeFileSync(a.fichier, JSON.stringify(e));
    sandbox.__base = null;
    return { moves: Object.keys(e.moves).length };
  },
  async ouvrir(a) {
    const b = JSON.parse(require(path.join(ROOT, 'tests', 'lire-projet.cjs'))(a.fichier));
    sandbox.__doc = JSON.stringify(b);
    sandbox.__moves = b.moves || {};
    // bundleRestore sème les parcours avant que le solide existe : on les sème après le rejeu, comme la relecture différée de la page
    await vm.runInContext(`(async function(){await bundleRestore(__doc,{rebuild:false});occCkClear();markDirty();rebuild();__natifSemer(__moves);})()`, ctx);
    baseMoves = sandbox.__moves;
    sandbox.__moves = null;
    sandbox.__doc = null;
    vm.runInContext('try{faoSelectSetup(faoRoot().activeSetupId||faoRoot().setups[0].id);}catch(e){}', ctx);
    return vm.runInContext('__natifArbre()', ctx);
  },
  arbre() { return vm.runInContext('__natifArbre()', ctx); },
  traces(a) { sandbox.__id = a.posage; return vm.runInContext('__natifTraces(__id)', ctx); },
  regenerer(a) { sandbox.__id = a.posage; sandbox.__op = a.op || null; return { n: vm.runInContext('__natifRegenerer(__id,__op)', ctx) }; },
  evaluer(a) { return { valeur: vm.runInContext(a.code, ctx) }; },
};
(async () => {
  await demarrer();
  repondre({ pret: true });
  const lignes = readline.createInterface({ input: process.stdin });
  // Une commande à la fois, dans l'ordre
  let file = Promise.resolve();
  lignes.on('line', l => {
    file = file.then(async () => {
      let m = null;
      try {
        m = JSON.parse(l);
        const r = await COMMANDES[m.cmd](m);
        repondre({ n: m.n, ok: true, r });
      } catch (e) {
        repondre({ n: m && m.n, ok: false, erreur: String((e && e.stack) || e).slice(0, 1500) });
      }
    });
  });
  lignes.on('close', () => file.then(() => process.exit(0)));
})().catch(e => { repondre({ pret: false, erreur: String((e && e.stack) || e).slice(0, 1500) }); process.exit(1); });
