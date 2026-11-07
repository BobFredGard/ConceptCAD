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
  sandbox.__realOcct = real;
  sandbox.btoa = globalThis.btoa;
  sandbox.atob = globalThis.atob;
  // THREE du harnais = stub : BufferGeometry minimale (maillage FAO des imports STEP)
  const T0 = sandbox.THREE;
  class BG {
    constructor() { this.attributes = {}; this.userData = {}; this.index = null; }
    setAttribute(n, a) { this.attributes[n] = a; return this; } getAttribute(n) { return this.attributes[n]; }
    setIndex(i) { this.index = i; return this; } computeVertexNormals() {} computeBoundingBox() {} computeBoundingSphere() {} dispose() {}
  }
  class F32 { constructor(a, n) { this.array = a instanceof Float32Array ? a : Float32Array.from(a); this.itemSize = n; this.count = this.array.length / n; } }
  // Le maillage garde sa vraie géométrie et la boîte englobante se calcule pour de bon : le point
  // d'origine d'un repère d'opération (« dessus du modèle ») en dépend, donc l'empreinte des parcours.
  const IDENTITE = { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
  const V3 = T0.Vector3;
  V3.prototype.fromBufferAttribute = function (a, i) { const r = a.array, n = a.itemSize || 3; this.x = r[i * n]; this.y = r[i * n + 1]; this.z = r[i * n + 2]; return this; };
  V3.prototype.applyMatrix4 = function (m) {
    const e = m.elements, x = this.x, y = this.y, z = this.z, w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w; this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w; this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  };
  const Mesh = function (g, m) {
    const o = new T0.Mesh();
    if (g && g.attributes) o.geometry = g;
    if (m) o.material = m;
    o.matrixWorld = IDENTITE;
    o.updateMatrixWorld = function () {};
    return o;
  };
  class Box3 {
    constructor() { this.min = new V3(Infinity, Infinity, Infinity); this.max = new V3(-Infinity, -Infinity, -Infinity); }
    isEmpty() { return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z; }
    makeEmpty() { this.min.set(Infinity, Infinity, Infinity); this.max.set(-Infinity, -Infinity, -Infinity); return this; }
    expandByPoint(p) {
      this.min.x = Math.min(this.min.x, p.x); this.min.y = Math.min(this.min.y, p.y); this.min.z = Math.min(this.min.z, p.z);
      this.max.x = Math.max(this.max.x, p.x); this.max.y = Math.max(this.max.y, p.y); this.max.z = Math.max(this.max.z, p.z);
      return this;
    }
    expandByObject(o) {
      const a = o && o.geometry && o.geometry.attributes && o.geometry.attributes.position;
      if (a) { const v = new V3(); for (let i = 0; i < a.count; i++) this.expandByPoint(v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld || IDENTITE)); }
      return this;
    }
    setFromObject(o) { return this.makeEmpty().expandByObject(o); }
    getCenter(t) { t.x = (this.min.x + this.max.x) / 2; t.y = (this.min.y + this.max.y) / 2; t.z = (this.min.z + this.max.z) / 2; return t; }
    getSize(t) { t.x = this.max.x - this.min.x; t.y = this.max.y - this.min.y; t.z = this.max.z - this.min.z; return t; }
  }
  const PROPRES = { BufferGeometry: BG, Float32BufferAttribute: F32, BufferAttribute: F32, Mesh, Box3 };
  sandbox.THREE = new Proxy({}, { get(t, k) { return PROPRES[k] || T0[k]; } });
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
      return {frame:{X:F.X,Y:F.Y,Z:F.Z,O:F.O,id:F.id},stock:faoStock(job),ops:O};
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
    function __natifSig(){
      const j=faoDoc(),o=[];
      (j.ops||[]).forEach(function(op){const h=faoOpMovesHit(op);o.push([op.id,op.on!==false,op.hidden===true,op.stale===true,h?h.key:'',h&&h.mv?h.mv.length:0]);});
      return JSON.stringify([j.id,j.stock,j.origin,j.orient,j.wcs,o,faoPrevOn,faoViewerRap]);
    }
    function __natifAction(nom,type){
      const clic=function(id){document.getElementById(id).click();};
      if(nom==='posage'){const b=Array.from(document.querySelectorAll('#faoTreeWrap button')).find(function(x){return x.textContent.indexOf('+ Posage')>=0;});if(b)b.click();return;}
      if(nom==='outils')return clic('faoToolsBtn');
      if(nom==='usinage')return clic('faoVwBtn');
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
    function faoOpMovesPurgeOp(op){try{if(faoOpMovesMap)faoOpMovesMap.delete(op);}catch(e){}}
  `, ctx);
}
let baseMoves = null;
function vue() {
  const v = vm.runInContext('__natifVue()', ctx);
  return { active: v.active, prev: v.prev, perime: v.perime, rap: v.rap, message: v.message, calcul: v.calcul, sig: vm.runInContext('__natifSig()', ctx), arbre: DOM.decrire(v.arbreEl), fiche: DOM.decrire(v.ficheEl), outils: v.outilsEl ? DOM.decrire(v.outilsEl) : null };
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
  return { frame: t.frame, stock: t.stock, ops };
}
const attendreCalcul = () => new Promise(fin => {
  const t = setInterval(() => {
    const v = vm.runInContext('({c:!!(faoGenBtnEl&&faoGenBtnEl.disabled),m:String(faceEl&&faceEl.textContent||"")})', ctx);
    if (!v.c) { clearInterval(t); fin(); } else ecrireEvt({ evt: 'message', texte: v.m });
  }, 400);
});
const COMMANDES = {
  vue,
  tracesFichier,
  toucher(a) {
    DOM.toucher(a.el, a.sorte, a.valeur, { ctrlKey: !!a.ctrl, shiftKey: !!a.maj, key: a.touche || '' });
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
