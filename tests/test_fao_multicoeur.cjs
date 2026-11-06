// Parcours FAO sur plusieurs cœurs (src/88-fao-58-multicoeur.js) : un worker doit ranger
// EXACTEMENT le parcours du calcul normal, au nombre près.
// Le code du worker est celui de la page : il tourne ici dans un vrai fil (worker_threads).
//   node tests/test_fao_multicoeur.cjs                  exemples courts
//   node tests/test_fao_multicoeur.cjs --tout           toutes les opérations longues des exemples
//   node tests/test_fao_multicoeur.cjs --fichier Cavité seulement ces fichiers
const fs = require('fs'), vm = require('vm'), path = require('path'), { Worker } = require('worker_threads');
const ROOT = path.join(__dirname, '..');
const { loadApp } = require('./appvm.cjs');
const argv = process.argv.slice(2);
const TOUT = argv.includes('--tout');
const iF = argv.indexOf('--fichier'), FILTRE = iF >= 0 ? argv[iF + 1] : null;
const COURTS = ['Perçages.conceptcad'];
const RELAIS = `
const { parentPort, workerData } = require('worker_threads');
const vm = require('vm');
globalThis.self = globalThis;
globalThis.postMessage = m => parentPort.postMessage(m);
vm.runInThisContext(workerData);
parentPort.on('message', m => { globalThis.onmessage({ data: m }); });
`;
let ok = 0, ko = 0, piegeVu = false;
const verif = (c, n, d) => { if (c) { ok++; console.log('  ok ' + n); } else { ko++; console.log('  KO ' + n + (d ? ' : ' + d : '')); } };

function cote(fichier, setupId, opId, corps, donnees, source, boites) {
  return new Promise((res, rej) => {
    const w = new Worker(RELAIS, { eval: true, workerData: source, resourceLimits: { maxOldGenerationSizeMb: 8192 } });
    const fin = r => { w.terminate(); res(r); };
    w.on('error', rej);
    w.on('message', m => {
      if (m.t === 'fin') fin({ mv: m.mv, champs: m.champs });
      else if (m.t === 'ko') fin({ err: m.err + (m.pile ? '\n' + m.pile.split('\n').slice(2, 9).join('\n') : ''), piege: m.piege });
    });
    w.postMessage({ t: 'job', setupId, opId, flux: false, doc: donnees, corps, boites });
  });
}

// Comparaison stricte : mêmes clés, mêmes nombres (Object.is : -0 et NaN comptent)
function ecart(a, b, ou) {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return ou + ' : ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b);
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
  if (ka.length !== kb.length) return ou + ' : champs ' + ka.join(',').slice(0, 80) + ' ≠ ' + kb.join(',').slice(0, 80);
  for (const k of ka) { const e = ecart(a[k], b[k], ou + '.' + k); if (e) return e; }
  return null;
}

async function traiter(fichier) {
  console.log('\n' + path.basename(fichier));
  const real = await require('./noyau.cjs').charger();
  const { ctx, sandbox } = loadApp();
  sandbox.__realOcct = real;
  sandbox.btoa = globalThis.btoa; sandbox.atob = globalThis.atob;
  const T0 = sandbox.THREE;
  class BG {
    constructor() { this.attributes = {}; this.userData = {}; this.index = null; }
    setAttribute(n, a) { this.attributes[n] = a; return this; } getAttribute(n) { return this.attributes[n]; }
    setIndex(i) { this.index = i; return this; } computeVertexNormals() {} computeBoundingBox() {} computeBoundingSphere() {} dispose() {}
  }
  class F32 { constructor(a, n) { this.array = Float32Array.from(a); this.itemSize = n; this.count = this.array.length / n; } }
  sandbox.THREE = new Proxy({}, { get(t, k) { if (k === 'BufferGeometry') return BG; if (k === 'Float32BufferAttribute') return F32; return T0[k]; } });
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};viewUserMoved=true;', ctx);
  const b = JSON.parse(require('./lire-projet.cjs')(fichier));
  delete b.moves;
  sandbox.__doc = JSON.stringify(b);
  await vm.runInContext(`(async function(){
    await bundleRestore(__doc,{rebuild:false});
    occCkClear();markDirty();rebuild();
    const D0=occXDefl();
    const parForme=function(b,D){
      const v=[],t=[],map={},groupes=[];
      new occt.BRepMesh_IncrementalMesh_2(b.shape,D.lin,false,D.ang,false);
      const ex=new occt.TopExp_Explorer_2(b.shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
      let f0=0;
      while(ex.More()){
        const f=occt.TopoDS.Face_1(ex.Current());
        const loc=new occt.TopLoc_Location_1();
        const debut=t.length;
        const h=occt.BRep_Tool.Triangulation(f,loc);
        if(h&&!h.IsNull()){
          const tr=h.get(),nt=tr.NbTriangles();
          let rev=false;
          try{rev=(f.Orientation_1()===occt.TopAbs_Orientation.TopAbs_REVERSED);}catch(e){}
          const trsf=loc.IsIdentity()?null:loc.Transformation();
          for(let i=1;i<=nt;i++){
            const tg=tr.Triangle(i);
            let idx=[tg.Value(1),tg.Value(2),tg.Value(3)];
            if(rev)idx=[idx[0],idx[2],idx[1]];
            const tri=[];
            for(const k of idx){
              const p=tr.Node(k);let x,y,z;
              if(trsf){const q=p.Transformed(trsf);x=q.X();y=q.Y();z=q.Z();}else{x=p.X();y=p.Y();z=p.Z();}
              const key=x.toFixed(4)+','+y.toFixed(4)+','+z.toFixed(4);
              let j=map[key];if(j===undefined){j=v.length;v.push([x,y,z]);map[key]=j;}
              tri.push(j);
            }
            t.push(tri);
          }
        }
        groupes.push({f:f0++,start:debut,count:t.length-debut});
        ex.Next();
      }
      return v.length?{v:v,t:t,groupes:groupes}:null;
    };
    const g=new WeakMap();
    const lu=function(b,cle,D){let e=g.get(b);if(!e){e={};g.set(b,e);}if(!(cle in e))e[cle]=b&&b.shape?parForme(b,D):null;return e[cle];};
    const orig=faoMeshFromBody;
    faoMeshFromBody=function(b,q){try{const m=lu(b,'bas',D0);return m||orig(b,q);}catch(e){return orig(b,q);}};
    faoMeshFromBodyMid=function(b){try{return lu(b,'mid',{lin:D0.lin*0.5,ang:D0.ang});}catch(e){return null;}};
    faoMeshFromBodyFine=function(b){try{return lu(b,'fin',{lin:D0.lin*0.25,ang:D0.ang});}catch(e){return null;}};
    faoFineGeo=function(b){const m=faoMeshFromBodyFine(b);return m?{userData:{occGroups:m.groupes}}:null;};
    try{faoMovesReset();}catch(e){}
  })()`, ctx);
  sandbox.__html = fs.readFileSync(process.env.APP_FILE || path.join(ROOT, 'ConceptCAD.html'), 'utf8');
  const info = vm.runInContext(`(function(){
    const t=__html.slice(__html.indexOf('<script>\\n/* ═')>=0?0:0);
    const i=__html.search(/<script>\\r?\\n\\/\\* ═/), j=__html.indexOf('</script>',i);
    globalThis.__src=faoWkSource(__html.slice(i+8,j));
    const L=[];
    (faoRoot().setups||[]).forEach(s=>(s.ops||[]).forEach(o=>{ if(faoWkAccepte(o,s))L.push({setup:s.id,op:o.id,type:o.type}); }));
    return JSON.stringify(L);
  })()`, ctx);
  const liste = JSON.parse(info);
  const source = sandbox.__src;
  verif(typeof source === 'string' && source.length > 1e5, 'code du worker généré (' + Math.round(source.length / 1024) + ' Ko)');
  for (const e of liste) {
    sandbox.__ids = [e.setup, e.op];
    // calcul normal
    const n = vm.runInContext(`(function(){
      const job=faoRoot().setups.find(s=>s.id===__ids[0]),op=job.ops.find(o=>o.id===__ids[1]);
      op.stale=false;
      const t0=Date.now();faoOpMoves(op,job);
      globalThis.__ms=Date.now()-t0;
      globalThis.__seq=JSON.stringify(faoOpMovesHit(op).mv);
      globalThis.__cle=faoOpMovesKey(op,job);
      return __seq.length;
    })()`, ctx);
    // Mêmes données que la page : mêmes fonctions de préparation, puis passage en JSON pour sortir du bac à sable
    const paquet = vm.runInContext(`(function(){
      const job=faoRoot().setups.find(s=>s.id===__ids[0]),op=job.ops.find(o=>o.id===__ids[1]);
      const c=faoWkCorps([op],job);
      return {corps:c,doc:JSON.stringify(faoWkDocData()),boites:JSON.stringify(faoWkBoites(job,op))};
    })()`, ctx);
    const corps = paquet.corps.map(c => ({ ...c,
      bas: c.bas && { v: Float64Array.from(c.bas.v), t: Int32Array.from(c.bas.t) },
      mid: c.mid && { v: Float64Array.from(c.mid.v), t: Int32Array.from(c.mid.t) },
      fin: c.fin && { v: Float64Array.from(c.fin.v), t: Int32Array.from(c.fin.t) },
      groupes: c.groupes ? JSON.parse(JSON.stringify(c.groupes)) : c.groupes }));
    const t0 = Date.now();
    const r = await cote(fichier, e.setup, e.op, corps, JSON.parse(paquet.doc), source, JSON.parse(paquet.boites));
    const msW = Date.now() - t0;
    const nom = e.type + ' ' + e.op;
    if (r.err) { verif(false, nom, r.err); continue; }
    const seq = JSON.parse(sandbox.__seq);
    const d = ecart(seq, JSON.parse(JSON.stringify(r.mv)), 'mv');
    verif(!d, nom + ' : ' + seq.length + ' mouvements identiques (normal ' + sandbox.__ms + ' ms, worker ' + msW + ' ms)', d);
    // Garde-fou : sans le maillage attendu, le worker refuse au lieu de se replier en silence
    if (e.type === 'rough3d' && !piegeVu) {
      piegeVu = true;
      const sans = corps.map(c => { const x = { ...c }; delete x.mid; return x; });
      const p = await cote(fichier, e.setup, e.op, sans, JSON.parse(paquet.doc), source, JSON.parse(paquet.boites));
      verif(p.piege === 'maillage mid', 'maillage absent : résultat refusé (' + p.piege + ')');
      const pb = await cote(fichier, e.setup, e.op, corps, JSON.parse(paquet.doc), source, null);
      // (seulement si l'origine de ce posage lit la boîte du modèle)
      if (pb.piege) verif(/faoModel/.test(pb.piege), 'boîte du modèle absente : résultat refusé (' + pb.piege + ')');
    }
  }
}

(async () => {
  const dir = path.join(ROOT, 'Exemples');
  const tous = fs.readdirSync(dir).filter(f => /\.conceptcad$/.test(f)).filter(f => {
    if (FILTRE) return f.includes(FILTRE);
    if (TOUT) return true;
    return COURTS.includes(f);
  });
  for (const f of tous) await traiter(path.join(dir, f));
  console.log('\n' + ok + ' ok, ' + ko + ' KO');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
