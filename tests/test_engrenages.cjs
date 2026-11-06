// Engrenages (plan docs/plan-engrenages-niveau-1.md), étapes 1 à 7 : roue, couronne, crémaillère et paire, droites et
// hélicoïdales, déport, pied taillé, sous-coupe, alésage et rainure.
// Calcul : cotes, épaisseur au primitif, contour fermé, et surtout SIMULATION DU TAILLAGE,
// indépendante du calcul : l'outil crémaillère ISO 53 est roulé autour de la roue ; chaque point du
// contour (lu sur les B-splines données au noyau) doit être tout juste effleuré, jamais entamé.
// Fenêtre : valeurs libres bornées, contrôles, clé, aller-retour du fichier, « Modifier… ».
// Noyau réel : solide valide, volume = aire du contour × largeur, une face par courbe.
// Paire : entraxe, jeu, coupes sur tout un pas. Solides réels et fichier d'exemple : test_engrenages_paire.cjs (suite complète).
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    const area=P=>{let s=0;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];s+=a[0]*b[1]-b[0]*a[1];}return s/2;};
    const near=(a,b,e)=>Math.abs(a-b)<=e;
    // m, Z, α, x : sans et avec sous-coupe, déports, tête d'outil toute ronde (25°), effleurement (x ≈ xMin)
    const CASES=[[2,20,20,0],[1,6,20,0],[1,8,20,0],[2,12,20,0],[2,12,20,0.3],[2,14,20,0.17],[2,14,20,0.18],[2,17,20,0],[2,18,20,0],
      [0.5,12,14.5,0],[3,42,20,0],[2,60,25,0],[10,200,20,0],[2,30,25,0.5],[2,30,20,-0.3],[1,25,25,0],[1,10,25,0],[4,26,14.5,0.4]];
    const labOf=([m,z,a,x])=>'m'+m+' Z'+z+' α'+a+' x'+x;
    // ── 1. cotes ──
    {
      const g=gearGeom({m:2,z:20,alpha:20,b:10});
      A(near(g.rp,20,1e-12)&&near(g.ra,22,1e-12)&&near(g.rf,17.5,1e-12),'1 : m2 Z20 : Ø primitif 40, tête 44, pied 35');
      A(near(g.rb,20*Math.cos(Math.PI/9),1e-12)&&near(g.pitchB,Math.PI*2*Math.cos(Math.PI/9),1e-12),'2 : cercle de base et pas de base');
      const gx=gearGeom({m:2,z:20,alpha:20,b:10,x:0.5});
      A(near(gx.ra,23,1e-12)&&near(gx.rf,18.5,1e-12)&&near(gx.rp,20,1e-12),'2b : déport +0,5 : tête et pied montent d’un demi-module, primitif inchangé');
      ['m','z','alpha','b'].forEach(k=>{
        const o={m:2,z:20,alpha:20,b:10};o[k]=0;let e=null;try{gearGeom(o);}catch(x){e=x;}
        A(!!e,'3 : réglage nul refusé ('+k+')');
      });
      let e=null;try{gearGeom({m:2,z:20,alpha:20,b:10,x:3});}catch(x){e=x;}
      A(e&&/pointe/.test(e.message),'4 : dent en pointe refusée');
      // limite classique : 17,1 dents à 20° sans déport
      A(gearGeom({m:1,z:17,alpha:20,b:1}).undercut&&!gearGeom({m:1,z:18,alpha:20,b:1}).undercut,'4b : sous-coupe en dessous de 18 dents à 20° (limite 17,1)');
    }
    // ── 2. contour : jointif, épaisseur, et conforme à la simulation du taillage ──
    const bezier=(C,per)=>{ // points lus sur la B-spline C1 (celle du noyau), à l'intérieur de chaque morceau
      const n=C.knots.length-1,P=C.poles,J=i=>i===0?P[0]:i===n?P[P.length-1]:[(P[2*i][0]+P[2*i+1][0])/2,(P[2*i][1]+P[2*i+1][1])/2],o=[];
      for(let i=0;i<n;i++){const a=J(i),b=P[2*i+1],c=P[2*i+2],d=J(i+1);
        for(let k=0;k<=per;k++){const t=k/per,u=1-t;o.push([0,1].map(j=>u*u*u*a[j]+3*u*u*t*b[j]+3*u*t*t*c[j]+t*t*t*d[j]));}}
      return o;
    };
    const rackClear=(g,q)=>{
      // Plus petite distance entre le point q de la roue et l'outil, sur tout le roulement (< 0 : l'outil l'entame).
      // L'outil est décrit ici par ses seules cotes ISO 53, sans passer par le calcul testé.
      // Hélicoïdal : l'outil reste ISO 53 dans son plan normal, incliné de β : on y ramène la coordonnée tangentielle (× cos β).
      const m=g.m,p=Math.PI*m,ta=Math.tan(g.a),ca=Math.cos(g.a),rho=Math.min(0.38*m,m*(Math.PI/4-1.25*ta)/(1/ca-ta)),cb=Math.cos((+g.betaDeg||0)*Math.PI/180);
      const hfp=1.25*m,dc=hfp-rho,H=d=>p/4-d*ta,wc=H(dc)-rho/ca,Th=Math.min(1.8,16/g.z),N=4000; // course de l'outil : au-delà du dernier contact, déport négatif compris
      const at=th=>{
        const c=Math.cos(th),s=Math.sin(th),X=q[0]*c-q[1]*s,Y=q[0]*s+q[1]*c;
        const d=g.x*m-(X-g.rp),u=((((Y-g.rp*th)*cb)%p)+p)%p,w=Math.abs(u-p/2),vx=w-wc,vy=d-dc;
        return (vx<=0&&vy>=0)?d-hfp:(vx>0&&vy>=vx*ta)?Math.hypot(vx,vy)-rho:(w-H(d))*ca;
      };
      let best=Infinity,bt=0;
      for(let i=-N;i<=N;i+=4){const th=Th*i/N,v=at(th);if(v<best){best=v;bt=th;}}
      // affinage autour du meilleur roulement : le résultat ne dépend plus du pas de la simulation
      let w=4*Th/N;
      for(let k=0;k<6;k++){const c=bt;for(let i=-10;i<=10;i++){const th=c+w*i/10,v=at(th);if(v<best){best=v;bt=th;}}w/=5;}
      return best;
    };
    CASES.forEach(c=>{
      const [m,z,a,x]=c,lab=labOf(c),g=gearGeom({m,z,alpha:a,b:10,x}),O=gearOutline(g);
      const phiP=Math.tan(g.a),F=gearFlankAt(g,phiP),s=2*g.rp*Math.abs(Math.atan2(F.p[1],F.p[0]));
      A(near(s,m*(Math.PI/2+2*x*Math.tan(g.a)),1e-9*Math.max(1,m)*100),lab+' : épaisseur au primitif = m(π/2 + 2x·tan α) ('+s.toFixed(5)+')');
      const deb=q=>q.k==='bs'?q.poles[0]:[q.r*Math.cos(q.a0),q.r*Math.sin(q.a0)],fin=q=>q.k==='bs'?q.poles[q.poles.length-1]:[q.r*Math.cos(q.a1),q.r*Math.sin(q.a1)];
      let gap=0;O.forEach((q,i)=>{const y=O[(i+1)%O.length],e=fin(q),f=deb(y);gap=Math.max(gap,Math.hypot(e[0]-f[0],e[1]-f[1]));});
      A(gap<1e-6*m,lab+' : contour jointif ('+gap.toExponential(1)+')');
      A(area(gearPolyline(g))>0,lab+' : contour dans le sens direct');
      // tous les points d'une dent sauf le cercle de tête, que l'outil ne touche pas
      const pts=[];
      O.slice(0,O.length/z).forEach(q=>{
        if(q.k==='bs')pts.push(...bezier(q,3));
        else if(q.r===g.rf){for(let k=0;k<=4;k++){const t=q.a0+(q.a1-q.a0)*k/4;pts.push([q.r*Math.cos(t),q.r*Math.sin(t)]);}}
      });
      A(pts.length>=60,lab+' : la simulation porte sur de vrais points ('+pts.length+')');
      let lo=Infinity,hi=-Infinity;pts.forEach(q=>{const v=rackClear(g,q);lo=Math.min(lo,v);hi=Math.max(hi,v);});
      const tol=1e-4*m; // 0,2 µm à m = 2
      A(lo>-tol,lab+' : l’outil n’entame jamais le contour ('+(lo/m).toExponential(1)+' m)');
      A(hi<tol,lab+' : l’outil touche partout le contour, rien de resté en trop ('+(hi/m).toExponential(1)+' m)');
    });
    // ── 2b. hélicoïdal : cotes apparentes, section droite conforme à l'outil incliné ──
    {
      const g=gearGeom({m:2,z:20,alpha:20,b:20,beta:15}),b=15*Math.PI/180,a=Math.PI/9;
      A(near(g.mt,2/Math.cos(b),1e-12)&&near(g.rp,20/Math.cos(b),1e-12)&&near(g.ra,g.rp+2,1e-12)&&near(g.rf,g.rp-2.5,1e-12),'H1 : primitif en module apparent, saillie et creux en module normal');
      A(near(Math.tan(g.at),Math.tan(a)/Math.cos(b),1e-12)&&near(g.rb,g.rp*Math.cos(g.at),1e-12),'H2 : angle apparent et cercle de base apparent');
      A(near(g.twist,20*Math.tan(b)/g.rp,1e-12)&&near(gearGeom({m:2,z:20,alpha:20,b:20,beta:15,hand:'L'}).twist,-g.twist,1e-12),'H3 : torsion = b·tan β / rp, opposée en main gauche');
      A(near(g.overlap,20*Math.sin(b)/(Math.PI*2),1e-12),'H4 : recouvrement ε_β = b·sin β / (π·m)');
      const d=gearGeom({m:2,z:20,alpha:20,b:20});
      A(d.twist===0&&d.overlap===0&&d.at===d.a&&d.mt===2,'H5 : β = 0 : exactement la roue droite');
      let e=null;try{gearGeom({m:2,z:20,alpha:20,b:20,beta:46});}catch(x){e=x;}
      A(e&&/hélice/.test(e.message),'H6 : angle d’hélice hors limites refusé');
      // limite de sous-coupe : Zv ≈ z/cos³β : à 15°, z = 16 passe mieux que la roue droite équivalente
      A(gearGeom({m:1,z:16,alpha:20,b:1}).undercut&&!gearGeom({m:1,z:16,alpha:20,b:1,beta:15}).undercut,'H7 : Z16 : sous-coupe en droit, pas à β = 15°');
    }
    const HCASES=[[2,20,20,0,15],[2,60,20,0,15],[1,12,20,0,20],[1,10,20,0,30],[2,20,20,0.4,15],[2,30,20,-0.3,25],[1,20,25,0,15],[1,8,20,0,45],[0.5,12,14.5,0.2,10]];
    const hLab=c=>'m'+c[0]+' Z'+c[1]+' α'+c[2]+' x'+c[3]+' β'+c[4];
    HCASES.forEach(c=>{
      const [m,z,a,x,beta]=c,lab=hLab(c),g=gearGeom({m,z,alpha:a,b:10,x,beta});
      const O=gearOutline(g),F=gearFlankAt(g,Math.tan(g.at)).p,st=2*g.rp*Math.abs(Math.atan2(F[1],F[0]));
      A(near(st*g.cb,m*(Math.PI/2+2*x*Math.tan(g.a)),1e-9*m*100),lab+' : épaisseur au primitif, ramenée au plan normal = m(π/2 + 2x·tan α) ('+(st*g.cb).toFixed(5)+')');
      const deb=q=>q.k==='bs'?q.poles[0]:[q.r*Math.cos(q.a0),q.r*Math.sin(q.a0)],fin=q=>q.k==='bs'?q.poles[q.poles.length-1]:[q.r*Math.cos(q.a1),q.r*Math.sin(q.a1)];
      let gap=0;O.forEach((q,i)=>{const y=O[(i+1)%O.length],e=fin(q),f=deb(y);gap=Math.max(gap,Math.hypot(e[0]-f[0],e[1]-f[1]));});
      A(gap<1e-6*m,lab+' : contour jointif ('+gap.toExponential(1)+')');
      const pts=[];
      O.slice(0,O.length/z).forEach(q=>{
        if(q.k==='bs')pts.push(...bezier(q,3));
        else if(q.r===g.rf){for(let k=0;k<=4;k++){const t=q.a0+(q.a1-q.a0)*k/4;pts.push([q.r*Math.cos(t),q.r*Math.sin(t)]);}}
      });
      let lo=Infinity,hi=-Infinity;pts.forEach(q=>{const v=rackClear(g,q);lo=Math.min(lo,v);hi=Math.max(hi,v);});
      A(pts.length>=60&&lo>-1e-4*m,lab+' : l’outil incliné n’entame jamais la section ('+(lo/m).toExponential(1)+' m)');
      A(hi<1e-4*m,lab+' : l’outil incliné touche partout la section ('+(hi/m).toExponential(1)+' m)');
    });
    // le contrôle sait-il voir une faute ? point du flanc à 0,1 % du module de sa place, vers le plein puis vers le creux
    {
      const g=gearGeom({m:2,z:20,alpha:20,b:10}),P=gearFlankAt(g,Math.tan(g.a)).p,r=Math.hypot(P[0],P[1]),t=Math.atan2(P[1],P[0]),e=0.002/r;
      const v=a=>rackClear(g,[r*Math.cos(a),r*Math.sin(a)]);
      A(v(t+e)>1e-4*g.m,'simulation : matière laissée en trop détectée ('+(v(t+e)/g.m).toExponential(1)+' m)');
      A(v(t-e)<-1e-4*g.m,'simulation : matière entamée détectée ('+(v(t-e)/g.m).toExponential(1)+' m)');
    }
    // ── 3. réglages libres, contrôles ──
    {
      const d=stdNormState('gear',{});
      A(d.m==='2'&&d.z==='20'&&d.alpha==='20'&&d.b==='20'&&d.x==='0','5 : par défaut m2, Z20, 20°, sans déport, largeur 20 ('+JSON.stringify(d)+')');
      let st=stdNormState('gear',{m:'1,75',z:'33',alpha:'25',b:'12.5',x:'0,4'});
      A(st.m==='1.75'&&st.z==='33'&&st.b==='12.5'&&st.x==='0.4','6 : module hors liste gardé, virgule acceptée ('+JSON.stringify(st)+')');
      st=stdNormState('gear',{m:'-3',z:'2.6',b:'n’importe quoi',x:'9'});
      A(st.m==='0.1'&&st.z==='6'&&st.b==='20'&&st.x==='2','7 : valeurs bornées, illisible = défaut ('+JSON.stringify(st)+')');
      A(stdNormState('gear',{z:'33.4'}).z==='33','8 : nombre de dents entier');
      const sp=stdSpec('gear',{m:'2',z:'20',alpha:'20',b:'20',x:'0'});
      A(sp.name==='Engrenage m2 Z20 × 20'&&sp.cat==='gear','9 : désignation ('+sp.name+')');
      A(stdSpec('gear',{m:'2',z:'20',alpha:'25',b:'20',x:'0'}).name==='Engrenage m2 Z20 α25° × 20','10 : angle non usuel dans la désignation');
      const spx=stdSpec('gear',{m:'2',z:'20',alpha:'20',b:'20',x:'0.3'});
      A(spx.name==='Engrenage m2 Z20 x+0,3 × 20'&&spx.key!==sp.key,'10b : déport dans la désignation et la clé');
      A(/<path/.test(stdSvg(sp)),'11 : aperçu dessiné');
      const warns=(z,x)=>stdSpec('gear',{m:'2',z:String(z),alpha:'20',b:'20',x:String(x)}).checks.filter(c=>c.lvl==='warn').map(c=>c.txt);
      A(warns(20,0).length===0,'11b : Z20 sans déport : aucune alerte');
      A(warns(12,0).length===1&&/Sous-coupe.*x ≥ 0,3/.test(warns(12,0)[0]),'11c : Z12 sans déport : sous-coupe, déport conseillé 0,3 ('+warns(12,0)+')');
      A(warns(12,0.3).length===0,'11d : Z12 avec le déport conseillé : plus d’alerte ('+warns(12,0.3)+')');
      A(warns(8,0.55).some(t=>/Tête de dent très fine/.test(t)),'11e : Z8 au déport conseillé : la tête devient trop fine, alerte');
      let e=null;try{stdSpec('gear',{m:'2',z:'8',alpha:'20',b:'20',x:'1.5'});}catch(x){e=x;}
      A(e&&/pointe/.test(e.message),'11f : géométrie impossible refusée avec son motif');
    }
    // ── 4. assemblage, aller-retour, « Modifier… » ──
    docResetEmpty();doc.name='Banc';
    const sp1=stdSpec('gear',{m:'2',z:'20',alpha:'20',b:'20',x:'0'});
    const o1=(stdAddOcc(sp1)||{}).occ;
    A(o1&&asmComp(o1.comp).doc.std.key===sp1.key,'12 : insérée comme composant');
    const o2=(stdAddOcc(sp1)||{}).occ;
    A(o2&&o2.comp===o1.comp,'13 : même roue : nouvelle occurrence');
    const b=JSON.parse(serialise()),t=asmTreeOfFile(b.doc||b),c2=t.comps.find(c=>c.doc&&c.doc.std);
    const S=c2&&stdStateOf(c2.doc.std);
    A(S&&S.cat==='gear'&&S.st.z==='20'&&c2.doc.features[0].type==='gear'&&+c2.doc.features[0].z===20,'14 : réglages et fonction relus depuis le fichier');
    const sp2=stdSpec('gear',{m:'1.75',z:'33',alpha:'20',b:'12',x:'0.2'});
    const rp=stdReplace(o1.id,sp2,true);
    A(rp&&rp.n===2&&asmComp(o1.comp).doc.std.key===sp2.key&&asmComp(o1.comp).doc.features[0].z===33&&asmComp(o1.comp).doc.features[0].x===0.2,'15 : « Modifier… » refait la roue et son déport, pour toutes ses occurrences');
    // Ctrl+Z sur « Modifier… » : la forme affichée suit le document (elle restait l'ancienne)
    {
      const c=asmComp(o1.comp);
      asmBuildSnapshots();const h33=c._snap&&c._snap.hash;
      const ok=asmUndo(),apres=asmComp(o1.comp);
      A(ok&&apres.doc.features[0].z===20&&!apres._stale&&apres._snap&&apres._snap.hash!==h33,'15b : Ctrl+Z refait aussi l’image de la pièce');
      A(asmRedo()&&asmComp(o1.comp).doc.features[0].z===33&&!asmComp(o1.comp)._stale&&asmComp(o1.comp)._snap.hash===h33,'15c : rétablir aussi');
    }
    // valeur hors liste de contrôle : la recherche des anciennes pièces ne doit pas s'y perdre
    A(stdStateOf({key:'inconnue'})===null,'16 : clé inconnue sans réglages : réponse nulle, sans blocage');
    // ── 4b. alésage et rainure : réglages ──
    {
      const st=(o)=>Object.assign({m:'2',z:'20',alpha:'20',b:'20',x:'0',d:'0'},o);
      A(stdNormState('gear',{}).d==='0'&&stdNormState('gear',{}).kw==='none','17 : par défaut roue pleine, sans rainure');
      A(stdNormState('gear',st({d:'20'})).kw==='iso','18 : un alésage propose d’emblée sa rainure ISO 773');
      A(stdNormState('gear',st({d:'3'})).kw==='none','19 : Ø 3 : hors ISO 773, pas de rainure proposée');
      A(stdIso773For(6)[2]===2&&stdIso773For(8)[2]===2&&stdIso773For(8.01)[2]===3&&stdIso773For(20)[2]===6&&stdIso773For(130)[2]===32&&!stdIso773For(131),'20 : ligne ISO 773 : bornes (6 à 8 inclus, puis « plus de »)');
      const sp=stdSpec('gear',st({d:'20',kw:'iso'})),B=sp.ops.find(o=>o.k==='bore');
      A(B&&B.b===6&&B.t2===2.8&&sp.name==='Engrenage m2 Z20 × 20 Ø20 rainure 6×2,8'&&/clavette 6×6/.test(sp.info),'21 : Ø20 : rainure 6, profondeur 2,8, clavette 6×6 ('+sp.name+')');
      const sn=stdSpec('gear',st({d:'20',kw:'none'}));
      A(sn.key!==sp.key&&sn.name==='Engrenage m2 Z20 × 20 Ø20'&&!sn.ops.find(o=>o.k==='bore').b,'22 : sans rainure : autre pièce');
      const pl=sn.checks.find(c=>/Paroi/.test(c.txt)),pr=sp.checks.find(c=>/Paroi/.test(c.txt));
      A(pl.lvl==='ok'&&/7,5 mm/.test(pl.txt)&&pr.lvl==='ok'&&/4,7 mm/.test(pr.txt),'23 : paroi lue au pied de dent : 7,5 sans rainure, 4,7 sous la rainure ('+pr.txt+')');
      A(stdSpec('gear',st({d:'26',kw:'iso'})).checks.some(c=>c.lvl==='warn'&&/mince : 1,2 mm/.test(c.txt)),'23b : Ø26 : 1,2 mm sous la rainure, moins de 2 modules : alerte');
      const refus=(o,re,t)=>{let e=null;try{stdSpec('gear',st(o));}catch(x){e=x;}A(e&&re.test(e.message),t+' ('+(e&&e.message)+')');};
      refus({d:'36',kw:'none'},/alésage trop grand/,'24 : Ø36 sur pied Ø35 : refusé');
      refus({d:'32',kw:'iso'},/sa rainure atteint/,'25 : Ø32 + rainure de 3,3 qui atteint le pied : refusé');
      A(stdSpec('gear',st({d:'32',kw:'none'})).checks.some(c=>c.lvl==='warn'&&/mince/.test(c.txt)),'26 : Ø32 sans rainure : possible, paroi mince signalée');
      A(stdSpec('gear',st({b:'4',d:'20',kw:'iso'})).checks.some(c=>c.lvl==='warn'&&/plus étroite/.test(c.txt)),'27 : roue plus étroite que la rainure : signalée');
      const L=gearBoreLoop({d:20,b:6,t2:2.8}),ends=[L[0],L[1]].every(q=>near(Math.hypot(q[0],q[1]),10,1e-12));
      A(ends&&near(L[2][0],12.8,1e-12)&&near(L[3][1],3,1e-12),'28 : contour : bords de rainure sur l’alésage, fond à d/2 + t2');
      A(/fill="var\(--bg\)"/.test(stdSvg(sp))&&/fill="var\(--bg\)"/.test(stdSvg(sn)),'29 : aperçu avec l’alésage');
    }
    // ── 5. noyau exact ──
    const root=asm.root;
    CASES.forEach(c=>{
      const [m,z,a,x]=c,lab=labOf(c),bw=m*10,sp=stdSpec('gear',{m:String(m),z:String(z),alpha:String(a),b:String(bw),x:String(x)});
      const o=(stdAddOcc(sp,root)||{}).occ;
      if(!o){A(false,lab+' : insertion refusée');return;}
      asmActivate(o.comp);
      const f=doc.features[0],FR=occFinalShape(null),sh=FR.perBody[0]&&FR.perBody[0].shape;
      if(!sh){A(false,lab+' : pas de solide ('+(f._err||'?')+')');occCleanup(FR,null);return;}
      const g=gearGeom(f),v=occCoqueVolume(sh),ex=area(gearPolyline(g,0.002))*bw;
      A(Math.abs(v/ex-1)<2e-4,lab+' : volume = aire × largeur ('+v.toFixed(2)+' / '+ex.toFixed(2)+')');
      const an=new occt.BRepCheck_Analyzer(sh,true);
      A(an.IsValid_2?an.IsValid_2():an.IsValid_1(),lab+' : solide valide');
      const fs=occSubShapes(sh,'TopAbs_FACE'),nf=fs.length;occDispose(fs);
      const parDent=gearOutline(g).length/z;
      A(nf===z*parDent+2,lab+' : '+nf+' faces, une seule par courbe ('+parDent+' par dent)');
      occCleanup(FR,null);
    });
    // ── 6. alésage et rainure dans le noyau : volume, forme, faces ──
    const BORES=[[2,20,20,0,20,'iso'],[2,20,20,0,20,'none'],[3,42,20,0,50,'iso'],[2,60,25,0,30,'iso'],[1,12,20,0,6,'iso'],[2,12,20,0.3,8,'iso'],[10,200,20,0,120,'iso'],[2,30,20,-0.3,16,'none']];
    BORES.forEach(([m,z,a,x,d,kw])=>{
      const lab='m'+m+' Z'+z+' Ø'+d+(kw==='iso'?' rainure':''),bw=m*10,sp=stdSpec('gear',{m:String(m),z:String(z),alpha:String(a),b:String(bw),x:String(x),d:String(d),kw});
      const o=(stdAddOcc(sp,root)||{}).occ;
      if(!o){A(false,lab+' : insertion refusée');return;}
      asmActivate(o.comp);
      const B=sp.ops.find(q=>q.k==='bore'),r=d/2,t0=Date.now(),FR=occFinalShape(null),sh=FR.perBody[0]&&FR.perBody[0].shape;
      if(!sh){A(false,lab+' : pas de solide');occCleanup(FR,null);return;}
      const ms=Date.now()-t0,g=gearGeom(doc.features[0]);
      let hole=Math.PI*r*r;
      if(B.b){const h=B.b/2,xe=Math.sqrt(r*r-h*h);hole+=-(r*r*Math.asin(h/r)-h*xe)+B.b*(r+B.t2-xe);} // sans le segment coupé, avec le rectangle
      const v=occCoqueVolume(sh),ex=(area(gearPolyline(g,0.002))-hole)*bw;
      A(Math.abs(v/ex-1)<2e-4,lab+' : volume = (denture − alésage) × largeur ('+v.toFixed(1)+' / '+ex.toFixed(1)+', '+ms+' ms)');
      const an=new occt.BRepCheck_Analyzer(sh,true);
      A(an.IsValid_2?an.IsValid_2():an.IsValid_1(),lab+' : solide valide');
      const fs=occSubShapes(sh,'TopAbs_FACE'),nf=fs.length;occDispose(fs);
      A(nf===z*gearOutline(g).length/z+2+(B.b?4:1),lab+' : '+nf+' faces : la denture intacte, plus '+(B.b?'l’alésage et 3 faces de rainure':'l’alésage'));
      occCleanup(FR,null);
    });
    // ── 6b. hélicoïdal dans le noyau : réglages, volume, et surtout le flanc réel à toutes les hauteurs ──
    {
      const sr=stdSpec('gear',{m:'2',z:'20',alpha:'20',b:'20',x:'0',beta:'15',hand:'R'}),sl=stdSpec('gear',{m:'2',z:'20',alpha:'20',b:'20',x:'0',beta:'15',hand:'L'}),s0=stdSpec('gear',{m:'2',z:'20',alpha:'20',b:'20',x:'0',beta:'0',hand:'L'});
      A(sr.name==='Engrenage m2 Z20 β15° D × 20'&&sl.name==='Engrenage m2 Z20 β15° G × 20'&&sr.key!==sl.key,'H8 : désignation et clé selon le sens ('+sr.name+')');
      A(s0.st.hand==='R'&&s0.name==='Engrenage m2 Z20 × 20','H9 : sans hélice, le sens n’a pas de sens : pièce droite unique');
      A(stdNormState('gear',{}).beta==='0'&&stdNormState('gear',{}).hand==='R'&&stdNormState('gear',{beta:'60'}).beta==='45','H10 : par défaut sans hélice ; angle borné à 45°');
      A(sr.checks.some(c=>c.lvl==='ok'&&/ε_β : 0,82/.test(c.txt))&&!s0.checks.some(c=>/ε_β/.test(c.txt)),'H11 : recouvrement affiché en hélicoïdal seulement');
      A(/Module apparent 2,07/.test(sr.info),'H12 : module apparent dans la fiche ('+sr.info+')');
      const oh=(stdAddOcc(sr,root)||{}).occ,fich=JSON.parse(serialise()),tree=asmTreeOfFile(fich.doc||fich),cf=tree.comps.find(c=>c.doc&&c.doc.std&&c.doc.std.key===sr.key),Sf=cf&&stdStateOf(cf.doc.std);
      A(oh&&Sf&&Sf.st.beta==='15'&&Sf.st.hand==='R'&&+cf.doc.features[0].beta===15&&cf.doc.features[0].hand==='R','H13 : hélice et sens relus depuis le fichier');
    }
    // angle du bord de la dent, mesuré sur le solide par le classifieur : aucune donnée du balayage n'y entre
    const flankAngle=(cl,r,z,a0,span)=>{
      const P=t=>new occt.gp_Pnt_3(r*Math.cos(t),r*Math.sin(t),z);
      const inn=t=>{const p=P(t);cl.Perform(p,1e-9);const s=cl.State();p.delete();return s===occt.TopAbs_State.TopAbs_IN;};
      let lo=a0-span,hi=a0+span;
      if(inn(lo)||!inn(hi))return null;
      for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(inn(mid))hi=mid;else lo=mid;}
      return (lo+hi)/2;
    };
    const HSOL=[[2,20,20,0,15,'R',20,''],[2,20,20,0,15,'L',20,''],[2,60,20,0,15,'R',20,''],[2,20,20,0,30,'R',40,''],[1,12,20,0,20,'R',20,''],[1,8,20,0,45,'R',40,''],[2,20,20,0.4,15,'L',20,''],[2,30,20,-0.3,25,'R',30,''],[10,200,20,0,15,'R',100,''],[2,20,20,0,15,'R',20,'20'],[2,60,25,0,15,'L',20,'30']];
    HSOL.forEach(([m,z,a,x,beta,hand,bw,dd])=>{
      const lab='m'+m+' Z'+z+' α'+a+' x'+x+' β'+beta+hand+' b'+bw+(dd?' Ø'+dd:'');
      const sp=stdSpec('gear',{m:String(m),z:String(z),alpha:String(a),b:String(bw),x:String(x),beta:String(beta),hand,d:dd||'0',kw:dd?'iso':'none'});
      const o=(stdAddOcc(sp,root)||{}).occ;
      if(!o){A(false,lab+' : insertion refusée');return;}
      asmActivate(o.comp);
      const t0=Date.now(),FR=occFinalShape(null),sh=FR.perBody[0]&&FR.perBody[0].shape,ms=Date.now()-t0;
      if(!sh){A(false,lab+' : pas de solide ('+(doc.features[0]._err||'?')+')');occCleanup(FR,null);return;}
      const g=gearGeom(doc.features[0]),B=sp.ops.find(q=>q.k==='bore');
      let hole=0;
      if(B){const r=B.d/2,h=B.b/2,xe=Math.sqrt(r*r-h*h);hole=Math.PI*r*r-(r*r*Math.asin(h/r)-h*xe)+B.b*(r+B.t2-xe);}
      const v=occCoqueVolume(sh),ex=(area(gearPolyline(g,0.002))-hole)*bw;
      A(Math.abs(v/ex-1)<5e-5,lab+' : volume = aire de la section × largeur, à 0,005 % ('+((v/ex-1)*100).toFixed(4)+' %, '+ms+' ms)');
      const an=new occt.BRepCheck_Analyzer(sh,true);
      A(an.IsValid_2?an.IsValid_2():an.IsValid_1(),lab+' : solide valide');
      const fs=occSubShapes(sh,'TopAbs_FACE'),nf=fs.length;occDispose(fs);
      A(nf===gearOutline(g).length+2+(B?4:0),lab+' : '+nf+' faces, une par courbe'+(B?', plus alésage et rainure':''));
      // le flanc réel, à plusieurs hauteurs et rayons, contre la développante tournée de l'hélice théorique
      const cl=new occt.BRepClass3d_SolidClassifier_2(sh);
      const rMin=Math.max(g.rb*1.001,g.rf+(g.ra-g.rf)*0.45);
      let worst=0,miss=0;
      [0.13,0.5,0.81].forEach(fz=>{for(let k=0;k<=2;k++){
        const r=rMin+(g.ra*0.995-rMin)*k/2,z=bw*fz,a0=-g.psiB+g.twist*fz+gearInv(Math.acos(g.rb/r)),t=flankAngle(cl,r,z,a0,0.1*g.m/r);
        if(t===null){miss++;continue;}
        worst=Math.max(worst,Math.abs(t-a0)*r);
      }});
      A(!miss&&worst<1e-3,lab+' : flanc réel à moins d’un micron de la théorie ('+(worst*1000).toFixed(3)+' µm)'+(miss?' '+miss+' hors de portée':''));
      // angle d'hélice mesuré au primitif : la dent se déplace de combien entre deux hauteurs ?
      if(g.rp>g.rb){
        const z1=bw*0.2,z2=bw*0.8,a1=-g.psiB+gearInv(Math.acos(g.rb/g.rp)),T1=flankAngle(cl,g.rp,z1,a1+g.twist*0.2,0.1*g.m/g.rp),T2=flankAngle(cl,g.rp,z2,a1+g.twist*0.8,0.1*g.m/g.rp);
        const mes=T1===null||T2===null?NaN:Math.atan2(g.rp*(T2-T1),z2-z1)*180/Math.PI;
        A(near(mes,hand==='L'?-beta:beta,0.01),lab+' : hélice mesurée au primitif '+mes.toFixed(4)+'° (positif : main droite)');
      }
      cl.delete();
      occCleanup(FR,null);
    });
    // sur une roue hélicoïdale aussi, la clavette se pose
    {
      docResetEmpty();asm=null;doc.name='Banc';asmEnsure();
      const sp=stdSpec('gear',{m:'2',z:'20',alpha:'20',b:'20',x:'0',beta:'15',hand:'R',d:'20',kw:'iso'}),ow=asmRoot();
      const o=(stdAddOcc(sp,ow.id,{o:[100,50,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]})||{}).occ;
      asmBuildSnapshots();
      const Gs=asmSnapGeomOf(asmComp(o.comp)),R=Gs&&stdKeyPick(null,Gs,[12.8,0,10],[-1,0,0]);
      const ks=R?stdAddInKeyways(stdSpec('key',{type:'B',size:'6x6',len:'20'}),ow.id,[o.id],R.items,R.mode):[];
      A(ks.length===1&&ks[0].st==='ok','H14 : clavette posée dans la rainure d’une roue hélicoïdale');
    }
    // ── 6c. couronne (denture intérieure) ──
    {
      const G=(o)=>gearGeom(Object.assign({m:2,z:60,alpha:20,b:20,kind:'int'},o)),g=G({});
      A(near(g.rp,60,1e-12)&&near(g.ra,58,1e-12)&&near(g.rf,62.5,1e-12),'I1 : m2 Z60 : Ø primitif 120, tête 116 vers l’axe, pied 125');
      A(near(g.D,137,1e-12)&&G({D:150}).D===150,'I2 : Ø extérieur automatique ou imposé');
      const gx=G({x:0.3});
      A(near(gx.ra,57.4,1e-12)&&near(gx.rf,61.9,1e-12),'I3 : déport + : tête et pied vont vers l’axe (DIN 3960)');
      let e=null;try{G({D:120});}catch(x){e=x;}
      A(e&&/Ø extérieur trop petit/.test(e.message),'I4 : Ø extérieur sous le pied : refusé ('+(e&&e.message)+')');
    }
    // Le creux doit être exactement la dent de la roue extérieure de même Z : déport opposé, largeur complémentaire
    const ICASES=[[2,60,20,0,0],[2,60,20,0.3,0],[2,60,20,-0.3,0],[1,40,20,0,0],[3,100,25,0,0],[0.5,50,14.5,0.2,0],[2,60,20,0,15],[1,48,20,0.2,25],[2,24,20,0,0],[10,200,20,0,0]];
    const iLab=c=>'m'+c[0]+' Z'+c[1]+' α'+c[2]+' x'+c[3]+' β'+c[4];
    ICASES.forEach(c=>{
      const [m,z,a,x,beta]=c,lab='couronne '+iLab(c),g=gearGeom({m,z,alpha:a,b:10,x,beta,kind:'int'}),e=gearGeom({m,z,alpha:a,b:10,x:-x,beta});
      const O=gearOutline(g),F=gearFlankAt(g,Math.tan(g.at)).p,sp=2*g.rp*Math.abs(Math.atan2(F[1],F[0]));
      A(near(sp*g.cb,m*(Math.PI/2-2*x*Math.tan(g.a)),1e-9*m*100),lab+' : creux au primitif = m(π/2 − 2x·tan α) ('+(sp*g.cb).toFixed(5)+')');
      const Fe=gearFlankAt(e,Math.tan(e.at)).p;
      A(near(sp,2*e.rp*Math.abs(Math.atan2(Fe[1],Fe[0])),1e-9*m*100),lab+' : creux = épaisseur de la dent extérieure de même Z, déport opposé');
      const deb=q=>q.k==='bs'?q.poles[0]:[q.r*Math.cos(q.a0),q.r*Math.sin(q.a0)],fin=q=>q.k==='bs'?q.poles[q.poles.length-1]:[q.r*Math.cos(q.a1),q.r*Math.sin(q.a1)];
      let gap=0;O.forEach((q,i)=>{const y=O[(i+1)%O.length],en=fin(q),f=deb(y);gap=Math.max(gap,Math.hypot(en[0]-f[0],en[1]-f[1]));});
      A(gap<1e-6*m,lab+' : contour jointif ('+gap.toExponential(1)+')');
      A(area(gearPolyline(g))>0,lab+' : contour dans le sens direct');
      // tangence flanc / arc / fond : pas d'angle vif au pied
      const P=gearProfile(g),fl=P.flank.poles,fi=P.fillet.poles,dir=(a,b)=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]);return [(b[0]-a[0])/L,(b[1]-a[1])/L];};
      const t1=dir(fl[fl.length-2],fl[fl.length-1]),t2=dir(fi[0],fi[1]),t3=dir(fi[fi.length-2],fi[fi.length-1]),R=fi[fi.length-1],rad=[R[0]/g.rf,R[1]/g.rf];
      A(Math.abs(t1[0]*t2[1]-t1[1]*t2[0])<1e-6&&t1[0]*t2[0]+t1[1]*t2[1]>0,lab+' : arc de pied tangent au flanc');
      A(Math.abs(t3[0]*rad[0]+t3[1]*rad[1])<1e-6&&near(Math.hypot(R[0],R[1]),g.rf,1e-9),lab+' : arc de pied tangent au fond');
      // les flancs sont touchés partout par l'outil crémaillère de la roue extérieure équivalente, jamais entamés
      const pts=[];bezier(O[0],3).forEach(q=>pts.push(q));
      let lo=Infinity,hi=-Infinity;pts.filter(q=>Math.hypot(q[0],q[1])>e.rb*Math.hypot(1,Math.max(e.phiF,0))*1.001).forEach(q=>{const v=rackClear(e,q);lo=Math.min(lo,v);hi=Math.max(hi,v);});
      A(lo>-1e-4*m&&hi<1e-4*m,lab+' : flanc = développante de la dent extérieure équivalente ('+(lo/m).toExponential(1)+' / '+(hi/m).toExponential(1)+' m)');
    });
    {
      const st=o=>Object.assign({kind:'int',m:'2',z:'60',alpha:'20',b:'20',x:'0'},o);
      const sp=stdSpec('gear',st({}));
      A(sp.name==='Couronne m2 Z60 × 20 Ø137'&&sp.ops.length===1&&sp.ops[0].D===137,'I5 : désignation, Ø automatique figé dans la pièce ('+sp.name+')');
      A(stdSpec('gear',st({D:'150'})).name==='Couronne m2 Z60 × 20 Ø150'&&stdSpec('gear',st({D:'150'})).key!==sp.key,'I6 : Ø extérieur réglable : autre pièce');
      A(sp.reach===68.5&&stdSpec('gear',{m:'2',z:'20',alpha:'20',b:'20',x:'0'}).reach===22,'I6b : place réservée à l’insertion : le rayon extérieur de la pièce, roue ou couronne');
      A(stdNormState('gear',{}).kind==='ext'&&stdNormState('gear',{}).D==='0','I7 : extérieure par défaut');
      const n=stdNormState('gear',st({d:'20',kw:'iso'}));
      A(n.d==='0'&&n.kw==='none','I8 : couronne : pas d’alésage ni de rainure, même hérités des réglages d’avant');
      A(stdNormState('gear',{kind:'ext',D:'150'}).D==='0','I9 : roue extérieure : pas de Ø de couronne');
      A(/fill="var\(--bg\)"/.test(stdSvg(sp)),'I10 : aperçu : le bord intérieur');
      const w=o=>stdSpec('gear',st(o)).checks.filter(c=>c.lvl==='warn').map(c=>c.txt);
      A(w({}).length===0,'I11 : Z60 : aucune alerte ('+w({})+')');
      A(w({z:'24'}).some(t=>/Dents raccourcies.*x ≤/.test(t)),'I12 : Z24 : la tête passerait sous le cercle de base : alerte ('+w({z:'24'})+')');
      A(w({D:'127'}).some(t=>/Couronne mince : 1 mm/.test(t)),'I13 : couronne mince signalée');
      A(sp.checks.some(c=>c.lvl==='ok'&&/arc simple/.test(c.txt)),'I14 : pied en arc signalé dans la fiche');
      A(stdSpec('gear',st({beta:'15',hand:'L'})).name==='Couronne m2 Z60 β15° G × 20 Ø'+stdF(gearGeom({m:2,z:60,alpha:20,b:20,beta:15,kind:'int'}).D),'I15 : hélice dans la désignation');
      const r=(o,re,t)=>{let e=null;try{stdSpec('gear',st(o));}catch(x){e=x;}A(e&&re.test(e.message),t+' ('+(e&&e.message)+')');};
      r({D:'120'},/Ø extérieur trop petit/,'I16 : refus dans la fenêtre avec son motif');
      r({z:'16',alpha:'25',x:'-0.5'},/creux en pointe/,'I17 : Z16 α25 x−0,5 : le creux finit en pointe avant le pied : refusé avec son motif');
    }
    const ISOL=[[1,16,20,0,0,'R',10,0],[1,20,25,0.3,20,'L',10,0],[2,60,20,0,0,'R',20,0],[2,60,20,0.3,0,'R',20,150],[1,40,20,0,0,'R',10,0],[2,24,20,0,0,'R',20,0],[3,100,25,0,0,'R',30,0],[10,200,20,0,0,'R',100,0],[2,60,20,0,15,'R',20,0],[2,60,20,0,15,'L',20,0],[1,48,20,0.2,25,'R',20,0],[10,200,20,0,15,'R',100,0]];
    ISOL.forEach(([m,z,a,x,beta,hand,bw,D])=>{
      const lab='couronne m'+m+' Z'+z+' α'+a+' x'+x+' β'+beta+hand+' b'+bw;
      const sp=stdSpec('gear',{kind:'int',m:String(m),z:String(z),alpha:String(a),b:String(bw),x:String(x),beta:String(beta),hand,D:String(D)});
      const o=(stdAddOcc(sp,asmRoot().id)||{}).occ;
      if(!o){A(false,lab+' : insertion refusée');return;}
      asmActivate(o.comp);
      const t0=Date.now(),f0=doc.features[0];delete f0._err;
      const bin=[],sh=gearSolid(f0,bin),ms=Date.now()-t0;
      const g=gearGeom(f0),ex=(Math.PI*g.D*g.D/4-area(gearPolyline(g,0.002)))*bw,v=occCoqueVolume(sh);
      A(Math.abs(v/ex-1)<1e-4,lab+' : volume = (disque − bord intérieur) × largeur ('+((v/ex-1)*100).toFixed(4)+' %, '+ms+' ms)');
      const an=new occt.BRepCheck_Analyzer(sh,true);
      A(an.IsValid_2?an.IsValid_2():an.IsValid_1(),lab+' : solide valide');
      const fsh=occSubShapes(sh,'TopAbs_FACE'),nf=fsh.length;occDispose(fsh);
      A(nf===gearOutline(g).length+3,lab+' : '+nf+' faces, une par courbe, plus l’extérieur et les 2 bases');
      const sols=occSubShapes(sh,'TopAbs_SOLID'),ns=sols.length;occDispose(sols);
      A(ns===1,lab+' : un seul solide');
      // le flanc réel contre la théorie. Couronne : dehors du côté creux. On regarde le côté bas du creux d'axe +X.
      const cl=new occt.BRepClass3d_SolidClassifier_2(sh);
      const rMax=g.ra+(g.rf-g.ra)*0.55;
      let worst=0,miss=0;
      [0.13,0.5,0.81].forEach(fz=>{for(let k=0;k<=2;k++){
        const r=g.ra*1.002+(rMax-g.ra*1.002)*k/2,z=bw*fz,a0=-g.psiB+g.twist*fz+gearInv(Math.acos(g.rb/r)),t=(()=>{
          const P=t=>new occt.gp_Pnt_3(r*Math.cos(t),r*Math.sin(t),z);
          const inn=t=>{const p=P(t);cl.Perform(p,1e-9);const s=cl.State();p.delete();return s===occt.TopAbs_State.TopAbs_IN;};
          let lo=a0-0.1*m/r,hi=a0+0.1*m/r; // côté angles bas : la dent ; côté angles hauts : le creux
          if(!inn(lo)||inn(hi))return null;
          for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(inn(mid))lo=mid;else hi=mid;}
          return (lo+hi)/2;
        })();
        if(t===null){miss++;continue;}
        worst=Math.max(worst,Math.abs(t-a0)*r);
      }});
      A(!miss&&worst<1e-3,lab+' : flanc réel à moins d’un micron ('+(worst*1000).toFixed(3)+' µm)'+(miss?' '+miss+' hors de portée':''));
      cl.delete();
      // la vraie chaîne de l'application refait le même solide
      const FR=occFinalShape(null),s2=FR.perBody[0]&&FR.perBody[0].shape;
      A(!!s2&&Math.abs(occCoqueVolume(s2)/ex-1)<1e-4,lab+' : même solide par le rejeu de l’application');
      occCleanup(FR,null);
    });
    // ── 6d. crémaillère ──
    {
      const G=o=>gearGeom(Object.assign({kind:'rack',m:2,z:30,alpha:20,b:20},o)),g=G({});
      A(g.rack&&near(g.pt,Math.PI*2,1e-12)&&near(g.L,30*Math.PI*2,1e-12)&&g.ya===2&&g.yf===-2.5&&g.yb===-8.5,'R1 : pas π·m, longueur z pas, saillie m, creux 1,25 m, corps 3 m par défaut');
      const gb=G({beta:15}),b=15*Math.PI/180;
      A(near(gb.pt,Math.PI*2/Math.cos(b),1e-12)&&near(gb.shift,-20*Math.tan(b),1e-12)&&near(G({beta:15,hand:'L'}).shift,20*Math.tan(b),1e-12),'R2 : inclinée : pas apparent π·m/cos β, pousse selon le sens');
      const deb=q=>q.k==='ln'?q.a:q.poles[0],fin=q=>q.k==='ln'?q.b:q.poles[q.poles.length-1];
      [[2,30,20,0],[2,30,25,0],[1,6,14.5,0],[2,30,20,15],[1,7,25,30]].forEach(([m,z,a,beta])=>{
        const lab='crémaillère m'+m+' Z'+z+' α'+a+' β'+beta,h=G({m,z,alpha:a,beta}),O=gearOutline(h);
        let gap=0;O.forEach((q,i)=>{const y=O[(i+1)%O.length],e=fin(q),f=deb(y);gap=Math.max(gap,Math.hypot(e[0]-f[0],e[1]-f[1]));});
        A(gap<1e-6*m,lab+' : contour jointif ('+gap.toExponential(1)+')');
        A(area(gearPolyline(h))>0,lab+' : contour dans le sens direct');
        // au plan normal : flanc à l'angle α
        const ta=Math.tan(h.a),fl=O.filter(q=>q.k==='ln'&&Math.abs(q.a[1]-q.b[1])>m&&Math.abs(q.a[0]-q.b[0])>1e-9).map(q=>({dx:(q.b[0]-q.a[0])*h.cb,dy:q.b[1]-q.a[1]}));
        A(fl.length===2*z&&fl.every(q=>near(Math.abs(q.dx/q.dy),ta,1e-9)),lab+' : '+fl.length+' flancs droits à α dans le plan normal');
        // arrondi tangent au fond et au flanc
        const fi=O.find(q=>q.k==='bs'),P=fi.poles,dir=(a,c)=>{const L=Math.hypot(c[0]-a[0],c[1]-a[1]);return [(c[0]-a[0])/L,(c[1]-a[1])/L];},t0=dir(P[0],P[1]),t1=dir(P[P.length-2],P[P.length-1]);
        A(Math.abs(t0[1])<1e-7&&near(Math.abs(t1[0]/t1[1]),ta/h.cb,1e-6),lab+' : arrondi de pied tangent au fond et au flanc');
      });
      const st=o=>Object.assign({kind:'rack',m:'2',z:'30',alpha:'20',b:'20'},o),sp=stdSpec('gear',st({}));
      A(sp.name==='Crémaillère m2 Z30 × 20 H10,5'&&sp.ops[0].H===6&&near(sp.reach,g.L/2,1e-9),'R3 : désignation, hauteur figée, place réservée ('+sp.name+')');
      A(stdSpec('gear',st({H:'12'})).key!==sp.key&&stdSpec('gear',st({beta:'15',hand:'R'})).name==='Crémaillère m2 Z30 β15° D × 20 H10,5','R4 : hauteur et inclinaison dans la clé et le nom');
      const n=stdNormState('gear',st({x:'0.5',d:'20',kw:'iso',D:'99'}));
      A(n.x==='0'&&n.d==='0'&&n.kw==='none'&&n.D==='0','R5 : ni déport, ni alésage, ni Ø de couronne sur une crémaillère');
      A(stdNormState('gear',{kind:'ext',H:'9'}).H==='0','R6 : pas de hauteur de corps sur une roue');
      A(stdSpec('gear',st({H:'1'})).checks.some(c=>c.lvl==='warn'&&/Corps mince : 1 mm/.test(c.txt)),'R7 : corps mince signalé');
      A(/<path/.test(stdSvg(sp)),'R8 : aperçu dessiné');
    }
    // mesure sur le solide : x du flanc droit d'une dent, par le classifieur, à la hauteur y et à z
    const rackEdge=(cl,y,z,x0,span)=>{
      const inn=x=>{const p=new occt.gp_Pnt_3(x,y,z);cl.Perform(p,1e-9);const s=cl.State();p.delete();return s===occt.TopAbs_State.TopAbs_IN;};
      let lo=x0-span,hi=x0+span; // à gauche la dent, à droite le creux
      if(!inn(lo)||inn(hi))return null;
      for(let i=0;i<34;i++){const mid=(lo+hi)/2;if(inn(mid))lo=mid;else hi=mid;}
      return (lo+hi)/2;
    };
    [[2,30,20,0,'R',20],[2,30,25,0,'R',20],[1,6,14.5,0,'R',10],[2,30,20,15,'R',20],[2,30,20,15,'L',20],[1,12,20,30,'R',30],[3,100,20,20,'L',40],[10,50,20,15,'R',100]].forEach(([m,z,a,beta,hand,bw])=>{
      const lab='crémaillère m'+m+' Z'+z+' α'+a+' β'+beta+hand;
      const sp=stdSpec('gear',{kind:'rack',m:String(m),z:String(z),alpha:String(a),b:String(bw),beta:String(beta),hand});
      const o=(stdAddOcc(sp,asmRoot().id)||{}).occ;
      if(!o){A(false,lab+' : insertion refusée');return;}
      asmActivate(o.comp);
      const f0=doc.features[0],g=gearGeom(f0),bin=[],t0=Date.now(),sh=gearSolid(f0,bin),ms=Date.now()-t0;
      const v=occCoqueVolume(sh),ex=area(gearPolyline(g,0.002))*bw;
      A(Math.abs(v/ex-1)<1e-5,lab+' : volume = aire × largeur ('+((v/ex-1)*100).toFixed(5)+' %, '+ms+' ms)');
      const an=new occt.BRepCheck_Analyzer(sh,true);
      A(an.IsValid_2?an.IsValid_2():an.IsValid_1(),lab+' : solide valide');
      const sols=occSubShapes(sh,'TopAbs_SOLID'),ns=sols.length;occDispose(sols);
      A(ns===1,lab+' : un seul solide');
      // bouts d'équerre : un point juste dedans et juste dehors de chaque bout, en bas du corps, à deux hauteurs
      const cl=new occt.BRepClass3d_SolidClassifier_2(sh);
      const st3=(x,y,z)=>{const p=new occt.gp_Pnt_3(x,y,z);cl.Perform(p,1e-9);const s=cl.State();p.delete();return s===occt.TopAbs_State.TopAbs_IN;};
      const yB=g.yb+0.1,eps=1e-3;
      const dedans=[0.05,0.95].every(f=>st3(-g.L/2+eps,yB,bw*f)&&st3(g.L/2-eps,yB,bw*f));
      const dehors=[0.05,0.95].every(f=>!st3(-g.L/2-eps,yB,bw*f)&&!st3(g.L/2+eps,yB,bw*f));
      A(dedans&&dehors,lab+' : bouts d’équerre, longueur juste au micron ('+g.L.toFixed(3)+')');
      // pas, angle de flanc et inclinaison mesurés sur le solide, au milieu pour éviter les bouts
      const ta=Math.tan(g.a),i0=Math.floor(z/2),u0=(i0-z/2+0.5)*g.pitch,zm=bw/2,x0=(u0+g.pitch/4)/g.cb+g.shift*0.5,span=0.3*m;
      const E1=rackEdge(cl,0,zm,x0,span),Eh=rackEdge(cl,0.6*m,zm,x0-0.6*m*ta/g.cb,span),El=rackEdge(cl,-0.6*m,zm,x0+0.6*m*ta/g.cb,span);
      const E2=rackEdge(cl,0,zm,x0+g.pt,span);
      if(E1===null||Eh===null||El===null||E2===null)A(false,lab+' : flanc hors de portée');
      else{
        A(near(E2-E1,g.pt,1e-4),lab+' : pas mesuré '+(E2-E1).toFixed(5)+' = π·m/cos β');
        const nAng=Math.atan(Math.abs(El-Eh)*g.cb/(1.2*m))*180/Math.PI;
        A(near(nAng,a,1e-3),lab+' : flanc droit, angle mesuré au plan normal '+nAng.toFixed(4)+'°');
        A(near((El+Eh)/2,E1,1e-4),lab+' : flanc bien droit (le milieu est sur la ligne)');
        A(near(E1,x0,1e-4),lab+' : dent au pas prévu, à la ligne de référence');
      }
      if(beta){
        const z1=bw*0.3,z2=bw*0.7,xz=f=>(u0+g.pitch/4)/g.cb+g.shift*f,A1=rackEdge(cl,0,z1,xz(0.3),span),A2=rackEdge(cl,0,z2,xz(0.7),span);
        const mes=A1===null||A2===null?NaN:Math.atan2(A2-A1,z2-z1)*180/Math.PI;
        A(near(mes,hand==='L'?beta:-beta,0.001),lab+' : inclinaison mesurée '+mes.toFixed(4)+'° (main droite : x recule en montant)');
      }
      cl.delete();
      const FR=occFinalShape(null),s2=FR.perBody[0]&&FR.perBody[0].shape;
      A(!!s2&&Math.abs(occCoqueVolume(s2)/ex-1)<1e-5,lab+' : même solide par le rejeu de l’application');
      occCleanup(FR,null);
    });
    const T0=Date.now();
    // ── 6e. paire : entraxe, conduite, engrènement en coupe sur tout un pas ──
    {
      const P=gearPair({kind:'ext',m:2,alpha:20,z1:20,z2:40,b:20,jn:0.1});
      A(near(P.a,60,1e-9)&&near(P.awDeg,20,1e-9)&&near(P.epsA,1.635,0.001)&&P.ratio===2,'P1 : m2 Z20/Z40 : entraxe 60, 20°, rapport de conduite 1,635 (calcul à la main)');
      const Px=gearPair({kind:'ext',m:2,alpha:20,z1:12,z2:40,x1:0.3,b:20,jn:0});
      const a0=52,c=Math.cos(Px.aw);
      A(near(Px.a*c,a0*Math.cos(Math.PI/9),1e-9)&&Px.a>a0&&Px.a<a0+0.6,'P2 : déport : a·cos α_w = a0·cos α ('+Px.a.toFixed(4)+')');
      // sans jeu, les épaisseurs sur les cercles de fonctionnement remplissent exactement le pas
      const sw=(g,rw)=>2*rw*(g.psiB-gearInv(Math.acos(g.rb/rw)));
      [[12,40,0.3,0],[20,40,0.5,0.2],[17,23,-0.1,0.4],[25,31,0,0]].forEach(([z1,z2,x1,x2])=>{
        const Q=gearPair({kind:'ext',m:2,alpha:20,z1,z2,x1,x2,b:20,jn:0}),r1=Q.g1.rb/Math.cos(Q.aw),r2=Q.g2.rb/Math.cos(Q.aw);
        A(near(sw(Q.g1,r1)+sw(Q.g2,r2),2*Math.PI*r1/z1,1e-9),'P3 : Z'+z1+'/'+z2+' x '+x1+'/'+x2+' : dents jointives au cercle de fonctionnement, donc entraxe juste');
      });
      [[20,60,0,0],[20,60,0.3,0.1],[18,50,0.2,0]].forEach(([z1,z2,x1,x2])=>{
        const Q=gearPair({kind:'int',m:2,alpha:20,z1,z2,x1,x2,b:20,jn:0}),r1=Q.g1.rb/Math.cos(Q.aw),r2=Q.g2.rb/Math.cos(Q.aw);
        A(near(sw(Q.g1,r1),sw(Q.g2,r2),1e-9),'P3b : couronne Z'+z1+'/'+z2+' x '+x1+'/'+x2+' : la dent du pignon a la largeur du creux');
      });
      const K=gearPair({kind:'ext',m:2,alpha:20,z1:20,z2:40,x1:0.5,x2:0.5,b:20,jn:0.1});
      A(K.g1.ks>0&&K.g2.ks>0&&near(K.a-K.g1.ra-K.g2.rf,0.5,1e-9)&&K.checks.some(c=>/Têtes raccourcies/.test(c.txt)),'P4 : gros déports : têtes raccourcies, 0,25 m gardé au fond de dent');
      const I=gearPair({kind:'int',m:2,alpha:20,z1:20,z2:60,b:20,jn:0.1});
      A(I.g2.ks>0&&!I.checks.some(c=>/Interférence/.test(c.txt)),'P5 : couronne Z60 / pignon Z20 : têtes de couronne raccourcies, plus d’interférence ('+I.g2.ks.toFixed(4)+' m)');
      A(gearPair({kind:'ext',m:2,alpha:20,z1:12,z2:60,b:20,jn:0.1}).checks.some(c=>/Interférence/.test(c.txt)),'P6 : pignon Z12 sans déport : interférence signalée');
      A(gearPair({kind:'int',m:2,alpha:20,z1:50,z2:55,b:20,jn:0.1}).checks.some(c=>/trop proches/.test(c.txt)),'P7 : couronne à 5 dents du pignon : signalé');
      A(gearPair({kind:'ext',m:2,alpha:20,z1:20,z2:40,b:20,jn:0}).checks.some(c=>c.lvl==='warn'&&/Jeu nul/.test(c.txt)),'P8 : jeu nul signalé');
      A(gearPair({kind:'ext',m:1,alpha:20,z1:10,z2:10,x1:0.5,x2:0.5,b:5,jn:0.1}).checks.some(c=>c.lvl==='warn'&&/Rapport de conduite/.test(c.txt)),'P9 : rapport de conduite trop faible signalé');
      let e=null;try{gearPair({kind:'int',m:2,alpha:20,z1:60,z2:40,b:20});}catch(x){e=x;}
      A(e&&/plus de dents/.test(e.message),'P10 : couronne plus petite que le pignon : refusé');
      A(P.hand1==='R'&&P.hand2==='L'&&gearPair({kind:'int',m:2,alpha:20,z1:20,z2:60,b:20,beta:15,hand:'L'}).hand2==='L'&&gearPair({kind:'rack',m:2,alpha:20,z1:20,z2:30,b:20,beta:15,hand:'L'}).hand2==='R','P11 : sens déduit : opposé sur roue et crémaillère, identique sur couronne');
      A(gearHandsOk('ext','R','L')&&!gearHandsOk('ext','R','R')&&gearHandsOk('int','R','R')&&!gearHandsOk('rack','L','L'),'P12 : mains incompatibles reconnues');
      // pièces amincies : flanc décalé, pied toujours raccordé, simulation d'outil juste
      const gj=gearGeom({m:2,z:20,alpha:20,b:10,j:0.1}),g0=gearGeom({m:2,z:20,alpha:20,b:10});
      const O=gearOutline(gj);let gp=0;const deb=q=>q.k==='bs'?q.poles[0]:[q.r*Math.cos(q.a0),q.r*Math.sin(q.a0)],fin=q=>q.k==='bs'?q.poles[q.poles.length-1]:[q.r*Math.cos(q.a1),q.r*Math.sin(q.a1)];
      O.forEach((q,i)=>{const y=O[(i+1)%O.length],en=fin(q),f=deb(y);gp=Math.max(gp,Math.hypot(en[0]-f[0],en[1]-f[1]));});
      const Fj=gearFlankAt(gj,Math.tan(gj.at)).p,sj=2*gj.rp*Math.abs(Math.atan2(Fj[1],Fj[0]));
      A(gp<1e-6&&near(sj,g0.thick-0.1,1e-9),'P13 : dent amincie de 0,1 au primitif, contour toujours jointif');
    }
    // deux contours placés : se recoupent-ils ? À quelle distance ?
    const PLC=new Map(),plOf=g=>{if(!PLC.has(g))PLC.set(g,gearPolyline(g,0.01,1));return PLC.get(g);};
    const placed=(g,F,zf)=>{
      const P=plOf(g),t=g.rack?0:g.twist*zf,dx=g.rack?g.shift*zf:0,c=Math.cos(t),s=Math.sin(t);
      return P.map(q=>{const X=q[0]*c-q[1]*s+dx,Y=q[0]*s+q[1]*c;return [F.o[0]+X*F.x[0]+Y*F.y[0],F.o[1]+X*F.x[1]+Y*F.y[1]];});
    };
    // segments rangés par tranche de 1 mm en y : le dedans/dehors et la distance ne lisent que leur voisinage
    const gridOf=S=>{const G=new Map();S.forEach((a,i)=>{const b=S[(i+1)%S.length],y0=Math.floor(Math.min(a[1],b[1])),y1=Math.floor(Math.max(a[1],b[1]));for(let y=y0;y<=y1;y++){if(!G.has(y))G.set(y,[]);G.get(y).push([a,b]);}});return G;};
    const inPoly=(q,G)=>{let k=false;for(const [a,b] of G.get(Math.floor(q[1]))||[])if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<a[0]+(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1]))k=!k;return k;};
    const meshAt=(Q,R,zf)=>{
      // → {over (points d'une pièce dans la matière de l'autre), gap (plus petite distance entre contours)}
      const A1=placed(Q.g1,R.fr1,zf),A2=placed(Q.g2,R.fr2,zf),O1=R.fr1.o;
      const hub=Q.kind==='rack'?[O1[0],O1[1]-Q.g1.rp]:Q.kind==='int'?[O1[0]+Q.g1.rp,O1[1]]:[O1[0]+Q.g1.rp,O1[1]];
      const win=5*Q.g1.pitch/Q.g1.cb,near2=q=>Math.hypot(q[0]-hub[0],q[1]-hub[1])<win;
      const P1=A1.filter(near2),P2=A2.filter(near2),F1=gridOf(A1),F2=gridOf(A2);
      let over=0;
      P1.forEach(q=>{const i=inPoly(q,F2);if(Q.kind==='int'?!i:i)over++;});
      P2.forEach(q=>{if(inPoly(q,F1))over++;});
      let gap=Infinity;
      const ds=(q,a,b)=>{const ux=b[0]-a[0],uy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*ux+(q[1]-a[1])*uy)/(ux*ux+uy*uy||1)));return Math.hypot(q[0]-a[0]-t*ux,q[1]-a[1]-t*uy);};
      P1.forEach(q=>{const y=Math.floor(q[1]);for(let r=y-1;r<=y+1;r++)for(const [a,b] of F2.get(r)||[]){if(Math.abs(a[0]-q[0])>2)continue;const d=ds(q,a,b);if(d<gap)gap=d;}});
      return {over,gap};
    };
    const PAIRS=[['ext',2,20,20,40,0,'R',0,0],['ext',2,20,14,31,0,'R',0.3,0.1],['ext',2,25,17,23,0,'R',0,0],['ext',2,20,20,40,15,'R',0,0],['ext',1,20,18,30,25,'L',0.2,0],
      ['int',2,20,20,60,0,'R',0,0],['int',2,20,20,60,15,'R',0,0],['int',1,20,18,50,0,'R',0.3,0],['int',2,25,24,70,20,'L',0,0],
      ['rack',2,20,20,30,0,'R',0,0],['rack',2,20,20,31,0,'R',0,0],['rack',2,20,20,30,15,'L',0,0],['rack',1,20,14,25,0,'R',0.3,0]];
    const pLab=c=>c[0]+' m'+c[1]+' α'+c[2]+' Z'+c[3]+'/'+c[4]+(c[5]?' β'+c[5]+c[6]:'')+(c[7]||c[8]?' x'+c[7]+'/'+c[8]:'');
    const pOf=(c,jn)=>gearPair({kind:c[0],m:c[1],alpha:c[2],z1:c[3],z2:c[4],beta:c[5],hand:c[6],x1:c[7],x2:c[8],b:10,jn});
    PAIRS.forEach(c=>{
      const Q=pOf(c,0.1),step=2*Math.PI/Q.g1.z;
      let over=0,gMin=Infinity,gMax=0;
      for(let i=0;i<12;i++)[0.15,0.85].forEach(zf=>{
        const M=meshAt(Q,Q.roll(step*i/12),zf);over+=M.over;gMin=Math.min(gMin,M.gap);gMax=Math.max(gMax,M.gap);
      });
      A(over===0,pLab(c)+' : aucune dent ne rentre dans l’autre, sur 12 positions d’un pas, à 2 hauteurs ('+over+')');
      // jeu : il reste de l'air, mais pas plus que prévu (coupe droite : jn/2 agrandi par l'hélice, à la précision du tracé)
      const lo=0.05*0.8,hi=0.05/Q.g1.cb/Math.cos(Q.aw)+0.02;
      A(gMin>lo&&gMax<hi,pLab(c)+' : les flancs se suivent à jeu constant ('+gMin.toFixed(4)+' à '+gMax.toFixed(4)+' mm)');
    });
    // le contrôle sait-il voir une faute ?
    {
      const c=PAIRS[0],Q=pOf(c,0.1),R=Q.roll(0);
      const bad=(lab,R2)=>{const M=meshAt(Q,R2,0.5);A(M.over>0,'faute détectée : '+lab+' ('+M.over+' points)');};
      bad('entraxe trop court de 0,2 mm (le jeu de 0,1 mm en absorbe 0,146)',Object.assign({},R,{fr2:Object.assign({},R.fr2,{o:[Q.a-0.2,0,0]})}));
      const q=Q.roll(0),t=Math.PI-Math.PI/40+0.25*2*Math.PI/40;
      bad('quart de pas de décalage',Object.assign({},q,{fr2:Object.assign({},q.fr2,{x:[Math.cos(t),Math.sin(t),0],y:[-Math.sin(t),Math.cos(t),0]})}));
      const H=pOf(['ext',2,20,20,40,15,'R',0,0],0.1),W=gearGeom(Object.assign({},H.o2,{hand:'R'})),M=meshAt(Object.assign({},H,{g2:W}),H.roll(0),0.9);
      A(M.over>0,'faute détectée : deux roues extérieures de même main ('+M.over+' points)');
    }
    out.tSec=Date.now()-T0;
    // ── 6f. onglet Paire, pose, annulation ──
    {
      docResetEmpty();asm=null;doc.name='Banc';asmEnsure();
      const st={kind:'ext',m:'2',z1:'20',z2:'40',alpha:'20',beta:'15',hand:'R',x1:'0',x2:'0',b:'20',jn:'0.1',d1:'10',d2:'20'};
      const sp=stdSpec('gearPair',st);
      A(sp.name==='Paire m2 Z20/40 β15° × 20'&&sp.pair.length===2&&/Entraxe 62,117/.test(sp.info)&&/roue main gauche/.test(sp.info),'S1 : désignation et fiche ('+sp.name+' : '+sp.info+')');
      A(/<path/.test(stdSvg(sp)),'S2 : aperçu des deux pièces');
      A(stdNormState('gearPair',{kind:'rack',x2:'0.5',d2:'8'}).x2==='0'&&stdNormState('gearPair',{kind:'rack',d2:'8'}).d2==='0','S3 : crémaillère : ni déport ni alésage de l’autre pièce');
      const nU=asmUndoStack.length,occ=stdInsertPair(sp,asmRoot()),oc=asmRoot().occ;
      A(occ&&oc.length===2&&near(oc[1].fr.o[0]-oc[0].fr.o[0],sp.calc.a,1e-6),'S4 : deux pièces posées à l’entraxe, sur le même plan');
      const c1=asmComp(oc[0].comp),c2=asmComp(oc[1].comp),f1=c1.doc.features[0],f2=c2.doc.features[0];
      A(+f1.j>0&&+f2.j>0&&f1.hand==='R'&&f2.hand==='L'&&c1.doc.features.length===2&&!!c1._snap&&!!c2._snap,'S5 : pièces réelles : hélices opposées, dents amincies, alésages faits');
      A(!f1._err&&!f2._err,'S6 : pas d’erreur de construction');
      const fich=JSON.parse(serialise()),t=asmTreeOfFile(fich.doc||fich),cf=t.comps.find(q=>q.doc&&q.doc.std&&q.doc.std.key===c1.doc.std.key),Sf=stdStateOf(cf.doc.std);
      A(Sf&&Sf.st.j&&stdSpec(Sf.cat,Sf.st).key===c1.doc.std.key,'S7 : relue depuis le fichier, la pièce garde son jeu : même clé');
      A(asmUndoStack.length===nU+1&&asmUndo()&&asmRoot().occ.length===0,'S8 : un seul Ctrl+Z retire la paire entière');
      A(asmRedo()&&asmRoot().occ.length===2,'S9 : rétablir la remet');
    }
    // ── 7. la clavette existante se pose dans la rainure de la roue ──
    {
      docResetEmpty();asm=null;doc.name='Banc';asmEnsure();
      const sp=stdSpec('gear',{m:'2',z:'20',alpha:'20',b:'20',x:'0',d:'20',kw:'iso'}),ow=asmRoot();
      const o=(stdAddOcc(sp,ow.id,{o:[100,50,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]})||{}).occ;
      asmBuildSnapshots();
      const c=asmComp(o.comp),Gs=asmSnapGeomOf(c);
      A(!!Gs,'30 : formes exactes de la roue lues');
      const R=Gs&&stdKeyPick(null,Gs,[12.8,0,10],[-1,0,0]);
      A(R&&R.K.form==='rect'&&near(R.K.w,6,1e-6)&&near(R.K.len,20,1e-6)&&Math.abs(R.K.ax[2])>0.999,'31 : fond reconnu : 6 de large, 20 de long, le long de l’axe ('+(R&&R.K.w)+' × '+(R&&R.K.len)+')');
      const kp=stdSpec('key',{type:'B',size:'6x6',len:'20'});
      const ks=R?stdAddInKeyways(kp,ow.id,[o.id],R.items,R.mode):[];
      const K=ks[0];
      const r3=v=>v.map(x=>+x.toFixed(3)).join(',');
      A(ks.length===1&&K.st==='ok','32 : clavette 6×6 posée en liaison rigide');
      // dessous sur le fond (x = 12,8), hauteur vers l'axe, longueur selon l'axe, centrée sur la largeur de la roue
      A(K&&r3(K.fr.o)==='112.8,50,10'&&near(Math.abs(K.fr.x[2]),1,1e-9)&&near(K.fr.z[0],-1,1e-9),'33 : couchée sur le fond, tournée vers l’axe, au milieu ('+(K&&r3(K.fr.o))+' z '+(K&&r3(K.fr.z))+')');
      const fk=K&&K.fr,sommet=fk?fk.o[0]+fk.z[0]*6:0;
      A(near(sommet,100+6.8,1e-6),'34 : elle dépasse dans l’alésage de 3,2, comme le prévoit ISO 773 (h − t2 = 6 − 2,8)');
      A(asmUndo()&&ow.occ.length===1,'35 : Ctrl+Z retire la clavette, pas la roue');
    }
    out;
  `;
  const res=vm.runInContext(R,ctx);
  // le pré-test du bouton STEP, sans le remplacer par un faux : il doit réussir sur chaque noyau
  const pf=await vm.runInContext('occExportPreflight()',ctx);
  if(pf[0])res.log.push('T1 : pré-test de l’export STEP réussi ('+pf[1]+')');else res.fails.push('T1 : pré-test de l’export STEP refusé : '+pf[1]);
  if(res.tSec!=null)console.log('  (coupes : '+res.tSec+' ms)');
  res.log.forEach(l=>console.log('  ok  '+l));
  res.fails.forEach(l=>console.log('  KO  '+l));
  console.log(res.fails.length?'✗ '+res.fails.length+' échec(s)':'✓ engrenages : '+res.log.length+' contrôles');
  process.exit(res.fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
