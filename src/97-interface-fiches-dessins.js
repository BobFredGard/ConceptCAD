/* ---------- Fiches illustrées : dessins et textes de chaque icône ----------
   Une fiche = deux images animées (avant → après), une phrase simple, les étapes, le raccourci.
   Même langage partout : pièce bleue, ORANGE = ce que l'on choisit ou ce qui change,
   bleu = trait d'esquisse ou mouvement, bois = matière à usiner. Images de 100 × 76 en SVG, dans
   le livrable (rien à charger) ; le tableau n'est construit qu'au premier survol.
   Clés : voir mfFiKey (97-interface-fiches-survol.js). */
/* style dessin animé : aplats vifs, ombre franche, gros contour d'encre */
const FIC={b:['#c4e6ff','#70b8f5','#3b87d8','#12324f'],o:['#ffdc55','#ff9f1c','#ee7a00','#5c2b00'],
  w:['#ffe6b0','#f4bb68','#d98f36','#5c3410'],m:['#f3f6fa','#c0cbd8','#8c9aab','#1f2937'],g:['#aaf7bd','#38d66b','#18a94a','#0b4d23']};
function ficXY(X,Y,Z){return [50+(X-Y)*.866,42+(X+Y)*.5-Z];}
function ficPt(X,Y,Z){const p=ficXY(X,Y,Z);return p[0].toFixed(1)+' '+p[1].toFixed(1);}
function ficPoly(pts,fill,edge,x){return '<path d="M'+pts.map(p=>ficPt(p[0],p[1],p[2])).join('L')+'Z" fill="'+fill+'" stroke="'+(edge||'#1e293b')+'" stroke-width="1.1" stroke-linejoin="round"'+(x||'')+'/>';}
function ficBox(x0,y0,z0,x1,y1,z1,k,top){
  const c=FIC[k||'b'],t=FIC[top||k||'b'];
  return ficPoly([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],c[1],c[3])+
    ficPoly([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],c[2],c[3])+
    ficPoly([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],t[0],top?t[3]:c[3])+
    (x1-x0>6&&z1-z0>4?ficL3([[x0+(x1-x0)*.12,y1,z1-(z1-z0)*.16],[x0+(x1-x0)*.12,y1,z1-(z1-z0)*.46]],'#fff',1.4):'');
}
// chemin 3D : M / L / Q / Z, comme fzPath
function ficP3(cmds,attrs){
  const d=cmds.map(c=>c[0]==='Z'?'Z':c[0]==='Q'?'Q'+ficPt(c[1],c[2],c[3])+' '+ficPt(c[4],c[5],c[6]):c[0]+ficPt(c[1],c[2],c[3])).join('');
  return '<path d="'+d+'" stroke-linejoin="round" '+attrs+'/>';
}
function ficL3(pts,c,w,dash,closed){return '<path d="M'+pts.map(p=>ficPt(p[0],p[1],p[2])).join('L')+(closed?'Z':'')+'" fill="none" stroke="'+(c||'#2563eb')+'" stroke-width="'+(w||1.9)+'" stroke-linejoin="round" stroke-linecap="round"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';}
function ficE3(X,Y,Z,r,fill,edge,w,dash){const p=ficXY(X,Y,Z);return '<ellipse cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" rx="'+(r*1.2247).toFixed(1)+'" ry="'+(r*.7071).toFixed(1)+'" fill="'+(fill||'none')+'" stroke="'+(edge||'#1e293b')+'" stroke-width="'+(w||1.1)+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';}
function ficCyl(X,Y,Z,r,h,g,k){
  const c=FIC[k||'b'],p=ficXY(X,Y,Z),rx=r*1.2247,ry=r*.7071,f=n=>n.toFixed(1);
  return '<path d="M'+f(p[0]-rx)+' '+f(p[1]-h)+'V'+f(p[1])+'A'+f(rx)+' '+f(ry)+' 0 0 0 '+f(p[0]+rx)+' '+f(p[1])+'V'+f(p[1]-h)+'Z" fill="url(#'+(g||'mfFcHb')+')" stroke="'+c[3]+'" stroke-width="1.1"/>'+ficE3(X,Y,Z+h,r,c[0],c[3]);
}
function ficHole(X,Y,Z,r){return ficE3(X,Y,Z,r,'#2b3f55','#1e293b')+'<ellipse cx="'+ficXY(X,Y,Z)[0].toFixed(1)+'" cy="'+(ficXY(X,Y,Z)[1]+r*.28).toFixed(1)+'" rx="'+(r*1.2247*.8).toFixed(1)+'" ry="'+(r*.7071*.55).toFixed(1)+'" fill="#5d7896"/>';}
function ficAr(x1,y1,x2,y2,c,w){
  c=c||'#0ea5e9';w=w||2.4;
  const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,h=Math.min(6,L*.5),hw=w*1.9,bx=x2-ux*h,by=y2-uy*h,f=n=>n.toFixed(1);
  return '<path d="M'+f(x1)+' '+f(y1)+'L'+f(bx)+' '+f(by)+'" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round" fill="none"/><path d="M'+f(x2)+' '+f(y2)+'L'+f(bx-uy*hw)+' '+f(by+ux*hw)+'L'+f(bx+uy*hw)+' '+f(by-ux*hw)+'Z" fill="'+c+'"/>';
}
function ficL(x1,y1,x2,y2,c,w,dash){return '<path d="M'+x1+' '+y1+'L'+x2+' '+y2+'" fill="none" stroke="'+(c||'#2563eb')+'" stroke-width="'+(w||2.2)+'" stroke-linecap="round"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';}
function ficD(d,c,w,dash,fill){return '<path d="'+d+'" fill="'+(fill||'none')+'" stroke="'+(c||'#2563eb')+'" stroke-width="'+(w||2.2)+'" stroke-linecap="round" stroke-linejoin="round"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';}
function ficC(x,y,r,c,w,dash,fill){return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+(fill||'none')+'" stroke="'+(c||'#2563eb')+'" stroke-width="'+(w||2.2)+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';}
function ficR(x,y,w,h,c,sw,fill,rx){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+(rx||0)+'" fill="'+(fill||'none')+'" stroke="'+(c||'#2563eb')+'" stroke-width="'+(sw||2.2)+'"/>';}
function ficDot(x,y,r,c){return '<circle cx="'+x+'" cy="'+y+'" r="'+(r||2.2)+'" fill="'+(c||'#2563eb')+'"/>';}
function ficT(x,y,s,size,c,anchor,bold){return '<text x="'+x+'" y="'+y+'" font-family="system-ui,sans-serif" font-size="'+(size||7)+'" font-weight="'+(bold===false?400:700)+'" text-anchor="'+(anchor||'middle')+'" fill="'+(c||'#334155')+'">'+s+'</text>';}
function ficG(x,y,s,inner){return '<g transform="translate('+x+' '+y+') scale('+s+')">'+inner+'</g>';}
let mfFiTab=null;
function mfFiFiche(k){if(!k)return null;if(!mfFiTab)mfFiTab=mfFiTable();return mfFiTab[k]||null;}
function mfFiTable(){
  const T={},SK='#2563eb',OR='#f97316',GR='#16a34a',RE='#ef4444',GY='#94a3b8',BL='#0ea5e9';
  const F=(key,t,d,h,a,b,k,la,lb)=>{T[key]={t,d,h,a,b,k,la:la||'Avant',lb:lb||'Après'};};
  const CL='Vos clics',RES='Résultat';
  /* --- pièces --- */
  const BK=top=>ficBox(-15,-15,-9,15,15,7,'b',top);
  const BKW=()=>ficBox(-15,-15,-9,15,15,7,'w');
  const EDGE=()=>ficL3([[-15,15,7],[15,15,7]],OR,2.6);
  const FACEO=()=>ficPoly([[-15,-15,7],[15,-15,7],[15,15,7],[-15,15,7]],'#f6a623','#c2410c');
  const PLAN=(a,z)=>ficPoly([[-a,-a,z],[a,-a,z],[a,a,z],[-a,a,z]],'#e8f0fb','#93c5fd');
  const OPL=(a,z)=>ficPoly([[-a,-a,z],[a,-a,z],[a,a,z],[-a,a,z]],'#ffb84d','#c2410c',' fill-opacity=".6"');
  const PROF=(a,z)=>ficP3([['M',-a,-a,z],['L',a,-a,z],['L',a,a,z],['L',-a,a,z],['Z']],'fill="#bfdbfe" stroke="'+SK+'" stroke-width="1.5"');
  const PEN=(x,y,s)=>ficG(x-13.5*(s||1.6),y-14.5*(s||1.6),s||1.6,FZ_PENCIL);
  const NUM=(x,y,n)=>ficC(x,y,5,'#1e293b',1.1,null,OR)+ficT(x,y+2.4,n,7,'#fff');
  const PTS=(x,y,c)=>ficDot(x,y,2.6,c||SK);
  const SEG=(x1,y1,x2,y2,c)=>ficL(x1,y1,x2,y2,c)+PTS(x1,y1,c)+PTS(x2,y2,c);
  const CURS=(x,y)=>'<path transform="translate('+x+' '+y+') scale(.7)" d="M0 0v15l4-4 3 7 3-1-3-7h6z" fill="#fff" stroke="#111827" stroke-width="1.1" stroke-linejoin="round"/>';
  const DOC=(x,y,ext,c)=>'<path d="M'+x+' '+y+'h22l9 9v37h-31z" fill="#fff" stroke="#64748b" stroke-width="1"/><path d="M'+(x+22)+' '+y+'v9h9" fill="#e2e8f0" stroke="#64748b" stroke-width="1"/><rect x="'+(x+2)+'" y="'+(y+20)+'" width="27" height="11" rx="2" fill="'+(c||'#3b82f6')+'"/>'+ficT(x+15.5,y+28.5,ext,ext.length>4?5.6:7,'#fff');
  const FOLD=(x,y,s)=>ficG(x,y,s||2.2,FZ_FOLDER);
  const DISK=(x,y,s)=>ficG(x,y,s||2.2,FZ_FLOPPY);
  const CHK=(x,y)=>ficDot(x,y,6,GR)+ficD('M'+(x-3)+' '+y+'l2.2 2.4 4-4.6','#fff',1.6);
  const LPART=(k,top)=>ficBox(-13,-9,-8,3,9,12,k||'b',top)+ficBox(3,-9,-8,15,9,1,k||'b',top);
  const MINI=(x,y,s,inner)=>ficG(x-50*s,y-42*s,s,inner);
  /* --- planche de plan --- */
  const SHEET=()=>ficR(9,5,82,66,'#94a3b8',.9,'#fff')+ficR(61,61,30,10,'#94a3b8',.7,'#f1f5f9');
  const VF=(x,y,c)=>ficD('M'+x+' '+(y+20)+'h28v-11h-12v-9h-16z',c||'#111827',1.7);
  const VT=(x,y)=>ficR(x,y,28,12,'#111827',1.7)+ficL(x+16,y,x+16,y+12,'#111827',1.4)+ficC(x+8,y+6,2.6,'#111827',1.4);
  const VR=(x,y)=>ficR(x,y,12,20,'#111827',1.7)+ficL(x,y+9,x+12,y+9,'#111827',1.4);
  const VI=(x,y,s)=>MINI(x,y,s||.8,LPART());
  const HATCH=(x,y,w,h)=>{let s='<g stroke="'+OR+'" stroke-width="1.2">';for(let i=-h;i<w;i+=4)s+='<path d="M'+Math.max(x,x+i)+' '+(y+h-Math.max(0,-i))+'L'+Math.min(x+w,x+i+h)+' '+(y+h-Math.min(h,Math.min(w-i,h)))+'"/>';return s+'</g>';};
  const AX=(x1,y1,x2,y2)=>ficL(x1,y1,x2,y2,RE,.9,'6 2 1.4 2');
  const COTE=(x1,x2,y,txt,c)=>{const q=c||GR;return ficL(x1,y-5,x1,y+3,q,.8)+ficL(x2,y-5,x2,y+3,q,.8)+ficAr(x1+(x2-x1)/2,y,x1,y,q,.9)+ficAr(x1+(x2-x1)/2,y,x2,y,q,.9)+ficT((x1+x2)/2,y-2.4,txt,6.4,q);};

  /* ========== barre rapide ========== */
  const HOLED=()=>BK()+ficHole(0,0,7,6);
  F('q/undo','Annuler','Revient en arrière : la dernière action est défaite, comme si elle n’avait pas eu lieu.',[],HOLED(),BK(),'Ctrl+Z','Dernière action','Annulée');
  F('q/redo','Rétablir','Refait l’action que vous venez d’annuler.',[],BK(),HOLED(),'Ctrl+Y','Action annulée','Refaite');
  F('q/new','Nouveau projet','Ouvre une page blanche pour commencer une nouvelle pièce.',[],BK(),PLAN(20,-4),null,'Projet en cours','Projet vide');
  F('q/open','Ouvrir','Reprend une pièce enregistrée sur votre ordinateur.',[],DOC(34,14,'.CAD','#f59e0b'),BK(),'Ctrl+O','Votre fichier','Dans l’application');
  F('q/recent','Ouvrir récent','Montre les derniers fichiers utilisés, pour les rouvrir en un clic.',[],ficC(50,38,20,'#64748b',3,null,'#fff')+ficD('M50 26v12l8 5','#1f2937',2.2),ficR(16,13,68,50,'#94a3b8',1,'#fff',3)+[0,1,2].map(i=>ficR(21,18+i*14,58,11,i?'#cbd5e1':OR,.8,i?'#f1f5f9':'#ffedd5',2)+ficT(25,25.5+i*14,['Support','Axe','Crochet'][i],6.6,'#334155','start')).join(''),null,'Vous cliquez','Derniers fichiers');
  F('q/save','Enregistrer','Garde votre travail dans son fichier, pour le retrouver plus tard.',[],BK(),DISK(23,12),'Ctrl+S','Votre travail','Dans le fichier');
  F('q/saveas','Enregistrer sous','Crée une copie sous un autre nom ou à un autre endroit. L’original ne bouge pas.',[],DOC(34,14,'V1','#64748b'),DOC(14,14,'V1','#64748b')+DOC(54,14,'V2',OR),'Ctrl+Maj+S','Un fichier','Une copie en plus');
  F('q/folder','Dossier de projets','Choisit le dossier où sont rangées vos pièces et les affiche toutes au même endroit.',[],FOLD(23,12),ficR(12,10,76,56,'#94a3b8',1,'#fff',3)+[0,1,2,3].map(i=>ficR(17+(i%2)*36,15+(i>>1)*25,30,21,'#cbd5e1',.8,'#f1f5f9',2)+MINI(32+(i%2)*36,27+(i>>1)*25,.3,BK())).join(''),null,'Votre dossier','Tous vos projets');
  /* ========== espaces ========== */
  F('ws/cao','Espace CAO','Pour dessiner et modéliser la pièce en 3D.',[],PLAN(20,-4)+PROF(11,-4),LPART(),null,'Un dessin','Une pièce 3D');
  F('ws/fao','Espace FAO','Pour préparer l’usinage : la machine reçoit le chemin que doit suivre l’outil.',[],LPART(),ficBox(-15,-15,-9,15,15,7,'w')+ficL3([[-11,-11,7],[11,-11,7],[11,-3,7],[-11,-3,7],[-11,5,7],[11,5,7],[11,11,7],[-11,11,7]],BL,1.2)+ficCyl(-11,-11,8,2.6,18,'mfFcHm','m'),null,'La pièce','Le chemin de l’outil');
  F('ws/plan','Espace PLAN','Pour faire le plan à imprimer : vues de la pièce, cotes et cartouche.',[],LPART(),SHEET()+VF(17,12)+VT(17,38)+VI(68,28,.55)+COTE(17,45,10,'40'),null,'La pièce 3D','Le plan coté');
  F('ws/rendu','Rendu','Crée une belle image réaliste de la pièce : matière, lumière et décor.',[],LPART(),ficR(0,0,100,76,'none',0,'#1f2937')+ficBox(-13,-9,-8,3,9,12,'m')+ficBox(3,-9,-8,15,9,1,'m')+ficD('M18 12l-3-5M60 7l1-5M84 22l5-3','#fde047',2.2),null,'Le modèle','L’image réaliste');
  /* ========== CAO : esquisse et création ========== */
  F('Esquisse/Esquisse','Esquisse','Commence un dessin à plat sur un plan ou une face. C’est le point de départ de presque toute pièce.',['Choisissez un plan ou une face','Dessinez : lignes, cercles…','Validez pour revenir en 3D'],PLAN(22,-3),PLAN(22,-3)+PROF(11,-3)+PEN(66,35));
  F('Créer/Extrusion','Extrusion','Donne de l’épaisseur à un dessin fermé : il monte (ou creuse) tout droit, comme une pâte qui sort d’un moule.',['Sélectionnez une esquisse fermée','Réglez la hauteur'],PLAN(22,-8)+PROF(12,-8),ficBox(-12,-12,-8,12,12,10,'b','o')+ficAr(50,31,50,8),'E');
  F('Créer/Révolution','Révolution','Fait tourner un profil autour d’un axe pour créer une forme ronde, comme un vase sur un tour de potier.',['Sélectionnez le profil','Choisissez l’axe de rotation'],ficL(38,6,38,70,'#64748b',1,'4 2 1 2')+ficD('M44 14h12c-4 14 0 30 8 42h-20z',SK,1.6,null,'#bfdbfe'),ficL(50,3,50,72,'#64748b',1,'4 2 1 2')+'<path d="M38 16C44 30 42 46 30 58A20 7 0 0 0 70 58C58 46 56 30 62 16Z" fill="url(#mfFcHb)" stroke="#1e293b" stroke-width="1.2"/><ellipse cx="50" cy="16" rx="12" ry="4.2" fill="#e3ecf5" stroke="#1e293b" stroke-width="1.2"/>'+ficD('M18 38A32 10 0 0 0 80 40',BL,1.6)+ficAr(79,43,83,35,BL,1.4),'R');
  const TUBE='M16 62C34 62 34 20 62 20H84';
  F('Créer/Balayage','Balayage','Fait glisser un profil fermé le long d’un chemin : tube, main courante, rainure.',['Choisissez le profil fermé','Choisissez le chemin (une autre esquisse)'],ficD(TUBE,SK,1.5,'3 2.4')+'<ellipse cx="16" cy="62" rx="5" ry="9" fill="#ffd27a" stroke="'+OR+'" stroke-width="1.3"/>',ficD(TUBE,'#1e293b',15)+ficD(TUBE,'#a9bfd6',13)+ficD('M16 58C33 58 33 16 62 16H84','#eef3f9',2.4)+'<ellipse cx="84" cy="20" rx="4" ry="7.5" fill="url(#mfFcHo)" stroke="#8a5200" stroke-width="1.2"/>');
  const CROSS=(X,Y,Z)=>{const p=ficXY(X,Y,Z);return ficL(p[0]-4.5,p[1],p[0]+4.5,p[1],OR,1.2)+ficL(p[0],p[1]-3.2,p[0],p[1]+3.2,OR,1.2)+ficDot(p[0],p[1],1.4,OR);};
  F('Créer/Perçage','Perçage','Fait des trous propres sur les centres de perçage de l’esquisse : simple, lamé, fraisé ou taraudé.',['Placez des centres de perçage dans une esquisse','Sélectionnez l’esquisse et cliquez Perçage','Choisissez le type de trou'],BK()+CROSS(-7,-7,7)+CROSS(7,7,7),BK()+ficHole(-7,-7,7,4)+ficHole(7,7,7,4),'H');
  F('Créer/Corps','Corps','Démarre une nouvelle pièce séparée dans le même fichier. Ce que vous créez ensuite ira dedans.',[],ficBox(-20,-6,-8,-2,12,6,'b'),ficBox(-20,-6,-8,-2,12,6,'b')+ficBox(2,-14,-8,18,2,6,'o')+ficDot(82,12,3,GR)+ficT(82,23,'actif',6,GR));
  F('Construire/Plan','Plan de construction','Ajoute un plan « invisible » pour dessiner là où il n’y a pas de face : décalé, en biais, par 3 points…',[],BK(),BK()+OPL(22,18),null);
  F('Construire/Axe','Axe de construction','Ajoute une droite de repère : pour tourner ou répéter autour d’elle.',[],ficCyl(0,0,-12,10,24),ficL(50,2,50,14,OR,1.6,'4 2')+ficCyl(0,0,-12,10,24)+ficL(50,14,50,74,OR,1.6,'4 2'));
  F('Construire/Point','Point de construction','Ajoute un point de repère : un sommet, un centre, ou des coordonnées précises.',[],BK(),BK()+ficDot(ficXY(15,15,7)[0],ficXY(15,15,7)[1],3.6,OR)+ficC(ficXY(15,15,7)[0],ficXY(15,15,7)[1],6.5,OR,1));
  const O0=ficXY(15,15,7);
  F('Construire/Repère','Repère de construction','Pose une origine et trois directions (X, Y, Z) à l’endroit que vous voulez sur la pièce.',[],BK(),BK()+ficAr(O0[0],O0[1],O0[0]+19,O0[1]+8,RE,1.4)+ficAr(O0[0],O0[1],O0[0]-19,O0[1]+8,GR,1.4)+ficAr(O0[0],O0[1],O0[0],O0[1]-22,'#3b82f6',1.4));
  /* ========== CAO : modifier ========== */
  const z1=7,z0=-9;
  const ROUND=r=>ficPoly([[-15,15,z0],[15,15,z0],[15,15,z1-r],[-15,15,z1-r]],FIC.b[1],FIC.b[3])+
    ficP3([['M',15,-15,z0],['L',15,15,z0],['L',15,15,z1-r],['Q',15,15,z1,15,15-r,z1],['L',15,-15,z1],['Z']],'fill="'+FIC.b[2]+'" stroke="'+FIC.b[3]+'" stroke-width="1.1"')+
    ficPoly([[-15,-15,z1],[15,-15,z1],[15,15-r,z1],[-15,15-r,z1]],FIC.b[0],FIC.b[3])+
    ficP3([['M',-15,15-r,z1],['L',15,15-r,z1],['Q',15,15,z1,15,15,z1-r],['L',-15,15,z1-r],['Q',-15,15,z1,-15,15-r,z1],['Z']],'fill="url(#mfFcHo)" stroke="#8a5200" stroke-width="1.1"');
  const BEVEL=r=>ficPoly([[-15,15,z0],[15,15,z0],[15,15,z1-r],[-15,15,z1-r]],FIC.b[1],FIC.b[3])+
    ficPoly([[15,-15,z0],[15,15,z0],[15,15,z1-r],[15,15-r,z1],[15,-15,z1]],FIC.b[2],FIC.b[3])+
    ficPoly([[-15,-15,z1],[15,-15,z1],[15,15-r,z1],[-15,15-r,z1]],FIC.b[0],FIC.b[3])+
    ficPoly([[-15,15-r,z1],[15,15-r,z1],[15,15,z1-r],[-15,15,z1-r]],'#f6a623','#8a5200');
  F('Modifier/Congé','Congé','Arrondit une arête vive de la pièce.',['Cliquez l’arête','Réglez le rayon'],BK()+EDGE(),ROUND(7),'F');
  F('Modifier/Chanfrein','Chanfrein','Casse une arête vive par une coupe en biais.',['Cliquez l’arête','Réglez la taille'],BK()+EDGE(),BEVEL(7),'C');
  F('Modifier/Face','Déplacer une face','Pousse ou tire une face de la pièce : la pièce s’allonge ou se raccourcit.',['Cliquez la face','Donnez la distance (négative : elle rentre)'],ficBox(-18,-12,-9,4,12,8,'b')+ficPoly([[4,-12,-9],[4,12,-9],[4,12,8],[4,-12,8]],'#f6a623','#c2410c'),ficL3([[4,12,-9],[4,12,8],[4,-12,8]],GY,.8,'2 1.6')+ficBox(-18,-12,-9,16,12,8,'b')+ficPoly([[16,-12,-9],[16,12,-9],[16,12,8],[16,-12,8]],'#f6a623','#c2410c')+ficAr(ficXY(16,0,0)[0],ficXY(16,0,0)[1],ficXY(36,0,0)[0],ficXY(36,0,0)[1]));
  const T1=9;
  F('Modifier/Dépouille','Dépouille','Incline les faces de la pièce pour qu’elle sorte facilement d’un moule.',['Choisissez les faces','Réglez l’angle'],BK(),ficPoly([[-15,15,z0],[15,15,z0],[T1,T1,z1],[-T1,T1,z1]],'#f6a623','#8a5200')+ficPoly([[15,-15,z0],[15,15,z0],[T1,T1,z1],[T1,-T1,z1]],'#d9860f','#8a5200')+ficPoly([[-T1,-T1,z1],[T1,-T1,z1],[T1,T1,z1],[-T1,T1,z1]],FIC.b[0],FIC.b[3]));
  const A1=10,HOLLOW=ficPoly([[-A1,-A1,z1],[A1,-A1,z1],[A1,-A1,z0+3],[-A1,-A1,z0+3]],FIC.b[2],FIC.b[3])+ficPoly([[-A1,-A1,z1],[-A1,A1,z1],[-A1,A1,z0+3],[-A1,-A1,z0+3]],FIC.b[1],FIC.b[3])+ficPoly([[-A1,-A1,z0+3],[A1,-A1,z0+3],[A1,A1,z0+3],[-A1,A1,z0+3]],'#5d7896',FIC.b[3])+
    '<path d="M'+ficPt(-15,-15,z1)+'L'+ficPt(15,-15,z1)+'L'+ficPt(15,15,z1)+'L'+ficPt(-15,15,z1)+'ZM'+ficPt(-A1,-A1,z1)+'L'+ficPt(A1,-A1,z1)+'L'+ficPt(A1,A1,z1)+'L'+ficPt(-A1,A1,z1)+'Z" fill="#ffd27a" fill-rule="evenodd" stroke="#8a5200" stroke-width="1.1"/>'+
    ficPoly([[-15,15,z0],[15,15,z0],[15,15,z1],[-15,15,z1]],FIC.b[1],FIC.b[3])+ficPoly([[15,-15,z0],[15,15,z0],[15,15,z1],[15,-15,z1]],FIC.b[2],FIC.b[3]);
  F('Modifier/Coque','Coque','Évide la pièce pour n’en garder qu’une paroi d’épaisseur régulière, comme une boîte.',['Cliquez la face à ouvrir','Réglez l’épaisseur'],BK()+FACEO(),HOLLOW);
  const THREADS=()=>{let s='';for(let i=0;i<7;i++)s+=ficD('M38 '+(53-i*5.6)+'Q50 '+(59-i*5.6)+' 62 '+(49-i*5.6),'#1e293b',1);return s;};
  F('Modifier/Filetage','Filetage','Ajoute un filet de vis sur un axe rond : métrique, UNC/UNF ou gaz.',['Cliquez la face cylindrique','Choisissez le filet'],ficCyl(0,0,-20,10,42,'mfFcHb','b'),ficCyl(0,0,-20,10,42,'mfFcHb','b')+THREADS());
  F('Modifier/Scinder','Scinder','Coupe avec un plan : soit les faces seules, soit la pièce en deux morceaux.',['Choisissez un plan','Choisissez ce qu’il faut couper'],ficBox(-15,-15,-12,15,15,10,'b')+OPL(22,-1),ficBox(-15,-15,-17,15,15,-5,'b')+ficBox(-15,-15,3,15,15,15,'o')+ficAr(14,44,14,28,BL,1.2));
  /* ========== CAO : ensembles, fichier ========== */
  const QUAD=k=>ficBox(-20,-20,-5,-7,-7,5,k)+ficBox(7,-20,-5,20,-7,5,k)+ficBox(-20,7,-5,-7,20,5,k)+ficBox(7,7,-5,20,20,5,k);
  F('Ensembles/Répétition','Répétition','Copie une fonction ou une pièce plusieurs fois : en ligne, en grille, en cercle, ou en miroir.',['Choisissez ce qu’il faut répéter','Réglez le nombre et l’écart'],ficBox(-20,-20,-5,-7,-7,5,'o'),QUAD('b')+ficBox(-20,-20,-5,-7,-7,5,'o'),'M');
  const CB=(k1,k2)=>ficBox(-20,-11,-9,6,11,6,k1)+ficCyl(6,0,-9,10,23,k2==='o'?'mfFcHo':'mfFcHb',k2);
  F('Ensembles/Combiner','Combiner','Réunit deux pièces en une, retire l’une de l’autre, ou garde seulement leur partie commune.',['Choisissez la pièce à garder','Choisissez l’outil','Union, soustraction ou intersection'],CB('b','o'),CB('b','b'),null,'Deux pièces','Une seule (union)');
  F('Ensembles/Déplacer','Déplacer','Change la place de la pièce : translation, rotation ou point à point. Pratique pour poser un STEP importé.',[],ficBox(-22,-6,-6,-6,10,6,'b'),ficL3([[-22,10,-6],[-6,10,-6],[-6,10,6],[-22,10,6]],GY,.8,'2 1.6',1)+ficBox(4,-14,-6,20,2,6,'b')+ficAr(30,36,60,42));
  F('Ensembles/Échelle','Échelle','Agrandit ou réduit la pièce, de façon égale ou différente selon X, Y et Z.',['Choisissez le facteur','Choisissez le centre'],ficBox(-8,-8,-9,8,8,1,'b'),ficBox(-17,-17,-14,17,17,8,'b')+ficT(50,8,'× 2',8,OR));
  const BARP=(w,v)=>ficBox(-w,-8,-9,w,8,3,'b')+ficT(50,12,'Longueur = '+v,7.4,OR);
  F('Ensembles/Paramètres','Paramètres','Donne un nom à une dimension. Changez sa valeur à un seul endroit : toute la pièce suit.',['Clic : liste courte','Clic droit : liste complète'],BARP(11,40),BARP(21,70));
  F('Fichier/Importer','Importer','Ajoute une pièce venant d’un autre logiciel, au format STEP ou STL.',['Choisissez le fichier'],DOC(34,14,'STEP',GR),LPART(),null,'Le fichier','La pièce');
  const LINK=(x,y)=>ficD('M'+(x-7)+' '+y+'a4 4 0 0 1 4-4h4a4 4 0 0 1 0 8h-2M'+(x+7)+' '+y+'a4 4 0 0 1-4 4h-4a4 4 0 0 1 0-8h2',GR,1.6);
  F('Fichier/Dériver','Dériver','Reprend les paramètres et les corps d’un autre fichier. S’il change, ceux-ci suivent, et vous pouvez toujours les modifier ici.',['Choisissez le fichier source','Cochez ce qu’il faut reprendre'],DOC(34,14,'SOURCE','#64748b'),LPART()+LINK(80,14),null,'Autre fichier','Lié dans ce fichier');
  const EXP=(ext,txt)=>F('Fichier/'+ext,'Exporter en '+ext,txt,[],LPART(),DOC(34,14,ext,OR),null,'La pièce','Le fichier');
  EXP('STEP','Crée un fichier STEP précis, que les autres logiciels de CAO savent ouvrir.');
  EXP('STL','Crée un fichier STL fait de petits triangles, pour l’impression 3D par exemple.');
  EXP('OBJ','Crée un fichier OBJ fait de petits triangles, pour la 3D et l’animation.');
  /* ========== composants ========== */
  const PA=(dx,dy,dz,k)=>ficBox(-14+dx,-9+dy,-5+dz,4+dx,9+dy,4+dz,k);
  const PB=(dx,dz,k)=>ficCyl(dx,0,dz,5,16,k==='o'?'mfFcHo':'mfFcHb',k);
  F('Composants/Assembler','Assembler / Modéliser','Passe de la pièce à l’assemblage : on place les pièces les unes par rapport aux autres. Un nouveau clic revient à la pièce.',[],PA(-14,8,-12,'b')+PB(16,4,'o'),PA(0,0,-12,'b')+PB(-5,-8,'o'),null,'Pièces séparées','Pièces assemblées');
  const TREE=(n,o)=>ficT(14,16,'Assemblage',7,'#334155','start')+[...Array(n)].map((_,i)=>ficL(18,19,18,25+i*13,'#94a3b8',.9)+ficL(18,25+i*13,27,25+i*13,'#94a3b8',.9)+ficR(29,20+i*13,9,9,o&&i===n-1?OR:'#1e293b',1,o&&i===n-1?'#ffd27a':'#cbd9e8',1)+ficT(42,27+i*13,'Pièce '+(i+1),6.6,o&&i===n-1?OR:'#334155','start')).join('');
  F('Composants/Composant','Nouveau composant','Ajoute une nouvelle pièce vide dans l’assemblage, et vous y entrez aussitôt pour la dessiner.',[],TREE(2),TREE(3,true));
  F('Composants/Occurrence','Occurrence','Ajoute un exemplaire de plus de la même pièce. Modifiez-en un : tous changent.',['Sélectionnez le composant'],ficBox(-20,-6,-6,-4,10,6,'b'),ficBox(-20,-6,-6,-4,10,6,'b')+ficBox(2,-16,-6,18,0,6,'o'));
  const PLATE=()=>ficBox(-22,-22,-7,22,22,-3,'b');
  const SCR=(x,y)=>ficCyl(x,y,-3,3,5,'mfFcHo','o');
  F('Composants/Répétition','Répéter une occurrence','Multiplie une pièce de l’assemblage : en ligne, en grille, en cercle ou en miroir.',['Sélectionnez l’occurrence','Réglez le nombre et l’écart'],PLATE()+SCR(-14,-14),PLATE()+SCR(-14,-14)+SCR(14,-14)+SCR(-14,14)+SCR(14,14));
  F('Composants/Mesurer','Mesurer','Mesure entre deux pièces : distance, entraxe ou angle.',['Cliquez une face','Cliquez une face de l’autre pièce','Échap pour finir'],ficBox(-24,-8,-6,-9,8,6,'b')+ficPoly([[-9,-8,-6],[-9,8,-6],[-9,8,6],[-9,-8,6]],'#f6a623','#c2410c')+ficBox(10,-8,-6,24,8,6,'b'),ficBox(-24,-8,-6,-9,8,6,'b')+ficBox(10,-8,-6,24,8,6,'b')+ficAr(ficXY(0,8,14)[0],ficXY(0,8,14)[1],ficXY(-9,8,14)[0],ficXY(-9,8,14)[1],GR,.9)+ficAr(ficXY(0,8,14)[0],ficXY(0,8,14)[1],ficXY(10,8,14)[0],ficXY(10,8,14)[1],GR,.9)+ficT(52,12,'19,0 mm',8,GR));
  F('Composants/Inspecter','Inspecter','Trouve les pièces qui se touchent ou se chevauchent, et donne les masses et le centre de gravité.',[],CB('b','b'),CB('b','b')+'<ellipse cx="58" cy="42" rx="10" ry="16" fill="#ef4444" fill-opacity=".65" stroke="'+RE+'"/>'+ficT(79,14,'⚠',11,RE),null,'L’assemblage','Chevauchement');
  F('Composants/Depuis corps','Composants depuis corps','Transforme les corps d’une même pièce en composants, sans rien redessiner.',['Sélectionnez un corps, ou aucun pour tous'],ficBox(-20,-6,-6,-4,10,6,'b')+ficBox(2,-14,-6,18,2,6,'b')+ficR(10,14,80,48,GY,.8,'none',4),TREE(2,true),null,'Corps d’une pièce','Composants');
  const SCREW=()=>ficCyl(0,0,-24,4,32,'mfFcHm','m')+ficCyl(0,0,8,9,8,'mfFcHm','m')+ficE3(0,0,16,4,'#374151','#374151');
  F('Composants/Normalisés','Pièces normalisées','Insère des pièces toutes prêtes : vis, bouchons, goupilles, clavettes, engrenages. Une paire d’engrenages se pose calée, au bon entraxe.',['Choisissez la famille','Choisissez la taille'],ficR(16,13,68,50,'#94a3b8',1,'#fff',3)+['Vis CHC M6','Goupille','Clavette','Engrenage'].map((s,i)=>ficT(22,25+i*11.5,s,7,i?'#334155':OR,'start')).join(''),SCREW(),null,'Le catalogue','Votre pièce');
  F('Composants/Insérer','Insérer un fichier','Ajoute une pièce d’un autre fichier à l’assemblage : liée (elle suit le fichier) ou copiée.',['Choisissez le fichier','Lié ou copié'],DOC(34,14,'.CAD',OR),PA(-10,0,-12,'b')+PB(12,-8,'o'),null,'Le fichier','Dans l’assemblage');
  /* ========== FAO ========== */
  const WD=(x0,y0,z0,x1,y1,z1)=>ficBox(x0,y0,z0,x1,y1,z1,'w');
  const VISE=()=>ficBox(-21,-21,-13,21,21,-10,'m');
  const TOOL=(X,Y,Z,h)=>ficCyl(X,Y,Z,3,h||18,'mfFcHo','o')+ficCyl(X,Y,Z+(h||18),3.8,12,'mfFcHm','m');
  const ZIG=z=>ficL3([[-12,-12,z],[12,-12,z],[12,-6,z],[-12,-6,z],[-12,0,z],[12,0,z],[12,6,z],[-12,6,z],[-12,12,z],[12,12,z]],BL,1.2);
  const OZ=ficXY(-15,15,7);
  F('Posage/Posage','Posage','Décrit comment la pièce est tenue dans la machine et où se trouve le point zéro de l’usinage.',[],BKW(),VISE()+ficBox(-15,-15,-10,15,15,6,'w')+ficAr(50,27,69,35,RE,1.3)+ficAr(50,27,31,35,GR,1.3)+ficAr(50,27,50,7,'#3b82f6',1.3),null,'La matière','Tenue, avec son zéro');
  const MILL=(x,c)=>ficR(x-3.5,10,7,24,'#4b5563',.8,'#cbd5e1')+ficD('M'+(x-3.5)+' 34h7v26l-3.5 4-3.5-4z','#8a5200',.8,null,c||'#f6a623');
  F('Posage/Outils','Outils','La liste des fraises et forets disponibles : forme, diamètre, vitesses.',[],MILL(22)+MILL(50,'#94a3b8')+MILL(78,'#60a5fa'),MILL(36)+COTE(32.5,39.5,70,'')+ficT(46,72,'Ø 8',7,GR,'start')+ficT(52,26,'3 dents',7,'#334155','start')+ficT(52,38,'6000 tr/min',7,'#334155','start'),null,'Bibliothèque','Fiche d’un outil');
  F('Limites/Esquisse','Esquisse d’usinage','Dessine une zone interdite ou utile, visible seulement en FAO.',['Dessinez sur le plan du posage'],BKW(),BKW()+PROF(9,7));
  F('Limites/Extrusion','Mur interdit','Transforme la dernière esquisse FAO en mur : aucun outil n’a le droit de le traverser. Idéal pour protéger une bride.',[],BKW()+PROF(7,7),BKW()+ficBox(-7,-7,7,7,7,22,'g')+ficT(84,14,'⛔',11,RE));
  const RAW=()=>WD(-15,-15,-9,15,15,4)+ficP3([['M',-15,15,4],['Q',-8,15,8,0,15,5],['Q',8,15,3,15,15,6],['L',15,-15,5],['Q',0,-15,9,-15,-15,5],['Z']],'fill="#fde7c2" stroke="#7a5528" stroke-width="1.1"');
  F('Opérations/Surfaçage','Surfaçage','Aplanit le dessus de la pièce : l’outil passe en allers-retours, en retirant une fine couche.',[],RAW(),WD(-15,-15,-9,15,15,3)+ZIG(3)+TOOL(12,12,4,14),null,'Dessus brut','Dessus plan');
  F('Opérations/Chanfrein','Chanfrein d’usinage','Casse les arêtes vives avec un outil en pointe, le long du contour choisi.',['Choisissez les arêtes'],BKW()+EDGE(),ficBox(-15,-15,-9,15,15,7,'w')+ficPoly([[-15,11,7],[15,11,7],[15,15,3],[-15,15,3]],'#f6a623','#8a5200')+ficL3([[-15,13,5],[15,13,5]],BL,1.3));
  F('Opérations/Contour','Contour','L’outil suit le tour de la pièce pour couper ses flancs à la bonne forme.',['Choisissez le contour'],WD(-18,-18,-9,18,18,5),WD(-11,-11,-9,11,11,5)+ficL3([[-15,15,-3],[15,15,-3],[15,-15,-3]],BL,1.5)+TOOL(15,15,-4,16));
  F('Opérations/Perçage','Perçage d’usinage','Perce les trous de la pièce : l’outil descend à chaque position. Les trous sont repris de vos fonctions Perçage.',['Sélectionnez les trous'],BKW()+CROSS(-7,-7,7)+CROSS(7,7,7),BKW()+ficHole(-7,-7,7,3.6)+ficHole(7,7,7,3.6)+TOOL(7,7,8,18));
  const STAIRS=()=>WD(-18,-18,-12,18,18,-5)+WD(-13,-13,-5,13,13,1)+WD(-8,-8,1,8,8,7);
  F('Opérations/Ébauche 3D','Ébauche 3D','Enlève vite le gros de la matière, couche après couche, en laissant un peu à finir.',[],WD(-18,-18,-12,18,18,7),STAIRS()+ficL3([[-13,13,1],[13,13,1],[13,-13,1]],BL,1.2)+ficL3([[-18,18,-5],[18,18,-5],[18,-18,-5]],BL,1.2),null,'Le bloc de matière','Couches enlevées');
  const DOME=(lines)=>'<path d="M14 48C26 18 74 18 86 48L50 66Z" fill="url(#mfFcHw)" stroke="#7a5528" stroke-width="1.2"/>'+(lines?[0,1,2,3].map(i=>ficD('M'+(20+i*6)+' '+(46+i*4)+'Q50 '+(24+i*9)+' '+(80-i*6)+' '+(46+i*4),BL,1)).join(''):'');
  F('Opérations/Finition','Finition','Passe finement sur toute la forme pour une surface lisse et précise.',[],STAIRS(),DOME(true),null,'Après ébauche','Surface finie');
  const GEO=(p)=>'<path d="M50 8c3 0 5 1.4 6.6 4L85 54c3 5-.7 11-6.3 11H21.3c-5.6 0-9.3-6-6.3-11L43.4 12c1.6-2.6 3.6-4 6.6-4z" fill="url(#mfFcHw)" stroke="#7a5528" stroke-width="1.3"/>'+(p?ficD('M50 19L76 58H24Z',BL,1.2)+ficD('M50 31L65 53H35Z',BL,1.2)+ficD('M50 42L55 49H45Z',BL,1.2):'');
  F('Opérations/Géodésique','Géodésique','Finition dont les passes suivent la surface à partir de ses bords, à écart régulier, même sur une forme gauche.',['Choisissez les faces'],GEO(false),GEO(true));
  F('Simulation/Usinage','Simulation d’usinage','Montre en film l’outil qui creuse la matière, pour vérifier avant de lancer la machine.',['▶ lecture, ⏸ pause, ⏹ arrêt','Échap pour sortir'],WD(-18,-18,-12,18,18,7)+ficDot(82,14,9,GR)+'<path d="M79 9l8 5-8 5z" fill="#fff"/>',STAIRS()+TOOL(8,8,8,16),null,'Vous lancez','L’usinage défile');
  const PATH=()=>ficD('M14 58H44V44H74V30',BL,1.8);
  const RAP=()=>ficD('M74 30L84 12H26L14 58',RE,1.2,'3 2');
  F('Simulation/Rapides','Déplacements rapides','Montre, atténue ou masque les trajets rouges : ceux où l’outil se déplace sans couper.',['Trois états : tous, fondus, masqués'],PATH()+RAP(),PATH(),null,'Avec les rapides','Masqués');
  F('Calcul/Régénérer','Tout régénérer','Recalcule tous les parcours d’outil d’après la pièce actuelle et les réaffiche.',[],'<g opacity=".45">'+PATH()+'</g>'+ficT(82,20,'⚠',11,'#d97706'),PATH()+CHK(82,18),null,'Parcours à refaire','Parcours à jour');
  F('Export/G-code','G-code','Écrit le programme que la machine va lire : Siemens 840D ou Fagor 8065.',[],PATH(),DOC(34,14,'.MPF',OR)+ficT(40,58,'G1 X12',5,'#334155','start'),null,'Le parcours','Le programme');
  /* ========== PLAN ========== */
  F('Planches/Nouvelle','Nouvelle planche','Ajoute une feuille vierge au plan.',[],SHEET(),ficG(0,0,.62,SHEET())+ficG(36,26,.62,ficR(9,5,82,66,OR,1.6,'#fff7ed')));
  F('Planches/Dupliquer','Dupliquer la planche','Crée une copie de la feuille avec tout son contenu.',[],SHEET()+VF(20,20),ficG(0,0,.62,SHEET()+VF(20,20))+ficG(36,26,.62,SHEET()+ficR(9,5,82,66,OR,1.6)+VF(20,20)));
  F('Planches/Cartouche','Cartouche','Le pavé d’informations du plan : titre, matière, échelle, traitements.',[],SHEET(),ficR(4,8,92,60,'#94a3b8',.9,'#fff')+ficR(24,28,70,38,OR,1.4,'#fff7ed')+ficL(24,41,94,41,OR,.8)+ficL(58,41,58,66,OR,.8)+ficT(27,37,'Support moteur',7,'#334155','start')+ficT(27,52,'Alu',6,'#334155','start')+ficT(61,52,'Échelle 1:2',5,'#334155','start'),null,'La planche','Le cartouche');
  F('Vues/Face','Vue de face','Pose la première vue de la pièce sur la feuille.',['Cliquez pour la placer'],LPART(),SHEET()+VF(34,24),null,'La pièce 3D','Sa vue à plat');
  F('Vues/Projection','Projection','Depuis une vue, crée celles de droite, de gauche, de dessus ou de dessous, bien alignées.',['Sélectionnez une vue','Déplacez la souris puis cliquez','Échap pour finir'],SHEET()+VF(18,12),SHEET()+VF(18,12)+VR(52,12)+VT(18,38)+ficL(47,22,51,22,GY,.8,'2 1.6')+ficL(32,33,32,37,GY,.8,'2 1.6'));
  F('Vues/ISO','Vue isométrique','Pose une vue en perspective de la pièce, pour la comprendre d’un coup d’œil.',[],LPART(),SHEET()+VI(48,32,.85),null,'La pièce 3D','Sur le plan');
  F('Vues/Caméra','Vue caméra','Pose sur le plan la pièce exactement comme vous la regardez en 3D.',[],MINI(50,42,.9,LPART())+ficG(4,4,1.1,'<path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="#cbd5e1" stroke="#334155" stroke-width="1.1"/><circle cx="12" cy="13" r="3.5" fill="#fff" stroke="#334155" stroke-width="1.1"/>'),SHEET()+VI(48,32,.85),null,'Votre point de vue','Sur le plan');
  F('Vues/Auxiliaire','Vue auxiliaire','Montre en vraie grandeur une face inclinée, regardée bien en face.',['Cliquez une arête inclinée','Placez la vue'],SHEET()+ficD('M20 54V30L44 18H58V54Z','#111827',1.7)+ficL(20,30,44,18,OR,2),SHEET()+ficD('M16 58V40L34 31H44V58Z','#111827',1.7)+ficL(16,40,34,31,OR,2)+ficG(56,14,1,'<g transform="rotate(-27)">'+ficR(0,8,27,14,'#111827',1.7)+'</g>'));
  F('Vues/Coupe','Coupe','Montre l’intérieur de la pièce, comme coupée par un trait. La matière coupée est hachurée.',['Cliquez les points du trait','Validez (✓ ou Entrée)','Placez la vue'],SHEET()+VT(30,28)+AX(24,34,64,34)+ficT(22,31,'A',7,RE)+ficT(66,31,'A',7,RE),SHEET()+VT(16,14)+AX(12,20,48,20)+ficT(32,40,'A–A',6.5,RE)+ficR(16,44,28,14,'#111827',1.7)+HATCH(16,44,28,14));
  F('Vues/Détail','Vue de détail','Agrandit une petite zone du plan pour la lire mieux.',['Cliquez le centre','Réglez le rayon','Placez la vue'],SHEET()+VF(24,24)+ficC(38,33,7,OR,1.2,'2 1.6'),SHEET()+VF(13,14)+ficC(27,23,6,OR,1.1,'2 1.6')+ficL(32,27,45,38,OR,.8)+ficC(58,42,15,OR,1.2)+ficD('M45 50H62V36H72','#111827',1.6));
  F('Vues/Coupe locale','Coupe locale','Arrache une partie de la vue pour voir dedans à cet endroit seulement.',['Dessinez une forme fermée sur la vue','Choisissez l’arête du plan de coupe'],SHEET()+ficR(24,20,44,28,'#111827',1.7)+ficD('M36 26C44 22 56 26 56 34S46 44 38 42 30 30 36 26Z',OR,1.2,'2 1.6'),SHEET()+ficR(24,20,44,28,'#111827',1.7)+ficD('M36 26C44 22 56 26 56 34S46 44 38 42 30 30 36 26Z',OR,1)+'<g stroke="'+OR+'" stroke-width="1.2"><path d="M35 34L42 25M36 40L50 25M42 42L55 30M49 42L56 35"/></g>');
  F('Vues/DXF','Importer un DXF','Pose un dessin DXF sur la feuille comme une vue. On peut le coter et s’y accrocher.',[],DOC(34,14,'DXF',GR),SHEET()+VF(34,24),null,'Le fichier','Une vue du plan');
  /* --- outils de dessin communs à l'esquisse et au plan --- */
  const LINE_A=NUM(22,58,'1')+NUM(78,18,'2'),LINE_B=SEG(22,58,78,18);
  const RECT_A=NUM(22,20,'1')+NUM(78,56,'2'),RECT_B=ficR(22,20,56,36,SK,1.6,'#dbeafe')+PTS(22,20)+PTS(78,56);
  const CIRC_A=NUM(50,38,'1')+NUM(74,38,'2'),CIRC_B=ficC(50,38,24,SK,1.6,null,'#dbeafe')+PTS(50,38);
  const ARC_A=NUM(50,54,'1')+NUM(22,54,'2')+NUM(78,54,'3')+ficC(50,54,28,GY,.6,'2 2'),ARC_B=ficD('M22 54A28 28 0 0 1 78 54')+PTS(50,54)+PTS(22,54)+PTS(78,54);
  const POINT_B=ficL(50,24,50,52,GY,.9,'2 1.6')+ficL(36,38,64,38,GY,.9,'2 1.6')+ficDot(50,38,3,OR);
  const TRIM_A=ficL(16,60,84,16)+ficL(16,16,84,60)+ficL(14,38,86,38,GY,.8,'3 2')+ficC(70,25,6,OR,1.2,'2 1.6')+CURS(71,26);
  const TRIM_B=ficL(50,38,16,60)+ficL(16,16,84,60);
  F('Dessin/Ligne','Ligne','Trace des traits sur le plan, à la suite les uns des autres.',['Cliquez chaque point','Échap pour terminer'],LINE_A,LINE_B,null,CL,RES);
  F('Dessin/Rectangle','Rectangle','Trace un rectangle à partir de deux coins opposés.',[],RECT_A,RECT_B,null,CL,RES);
  F('Dessin/Cercle','Cercle','Trace un cercle : le centre, puis un point du tour.',[],CIRC_A,CIRC_B,null,CL,RES);
  F('Dessin/Arc','Arc','Trace un morceau de cercle : le centre, le départ, l’arrivée.',[],ARC_A,ARC_B,null,CL,RES);
  F('Dessin/Point','Point','Pose un point de repère sur le plan.',[],NUM(50,38,'1'),POINT_B,null,CL,RES);
  F('Dessin/Ajuster','Ajuster','Efface un morceau de trait en le cliquant, jusqu’au croisement suivant.',[],TRIM_A,TRIM_B,null,'Clic sur le morceau',RES);
  F('Dessin/Texte','Texte','Écrit un texte libre ou un champ automatique : matière, traitements…',[],NUM(24,40,'1'),ficT(24,44,'Matière : Alu',11,'#111827','start'),null,CL,RES);
  const CHOLE=(x,y,r)=>ficC(x,y,r,'#111827',1.7);
  F('Cotes/Cote','Cote','Écrit une dimension sur le plan : longueur, distance, diamètre ou angle.',['Cliquez ce qu’il faut coter','Placez la cote'],ficR(26,30,48,26,'#111827',1.7),ficR(26,30,48,26,'#111827',1.7)+COTE(26,74,20,'80'));
  const LEAD=(x1,y1,x2,y2,t)=>ficAr(x2,y2,x1,y1,GR,.9)+ficL(x2,y2,x2+36,y2,GR,.9)+ficT(x2+1,y2-2.2,t,6,GR,'start');
  F('Cotes/Perçage','Cote de perçage','Note tout ce qu’il faut savoir sur un trou : diamètre, lamage, fraisure, taraudage.',['Cliquez le trou'],CHOLE(32,48,9),CHOLE(32,48,9)+LEAD(38,41,50,24,'M6 prof. 12'));
  const H3=()=>ficR(14,30,72,32,'#111827',1.7)+CHOLE(30,46,5)+CHOLE(50,46,5)+CHOLE(70,46,5);
  F('Cotes/Perçages auto','Perçages automatiques','Cote d’un coup tous les trous de la vue ou de la planche. « 3× » s’ils sont identiques.',[],H3(),H3()+LEAD(33,42,42,20,'3× Ø8'));
  F('Cotes/Note','Note à flèche','Écrit un texte avec une flèche qui pointe un endroit précis.',['Cliquez la pointe','Placez et écrivez le texte'],ficR(22,36,44,26,'#111827',1.7),ficR(22,36,44,26,'#111827',1.7)+LEAD(42,36,50,18,'Ébavurer'));
  const OX=(y)=>ficR(20,28,60,32,'#111827',1.7)+[20,44,80].map((x,i)=>ficL(x,28,x,y,GR,.7)+ficT(x,y-1.5,['0','24','60'][i],6.6,GR)).join('');
  F('Cotes/Ordonnées X','Ordonnées en X','Donne toutes les positions depuis un même zéro, le long de X. Les valeurs restent alignées.',['Cliquez le zéro','Cliquez les points','Entrée pour finir'],ficR(20,28,60,32,'#111827',1.7)+NUM(20,28,'0'),OX(14));
  const OY=()=>ficR(32,14,48,48,'#111827',1.7)+[62,38,14].map((y,i)=>ficL(32,y,17,y,GR,.7)+ficT(15,y+2,['0','24','48'][i],6.6,GR,'end')).join('');
  F('Cotes/Ordonnées Y','Ordonnées en Y','Donne toutes les positions depuis un même zéro, le long de Y. Les valeurs restent alignées.',['Cliquez le zéro','Cliquez les points','Entrée pour finir'],ficR(32,14,48,48,'#111827',1.7)+NUM(32,62,'0'),OY());
  F('Axes/Trou','Axes d’un trou','Dessine la croix d’axes au centre des trous cliqués.',['Cliquez les trous'],CHOLE(50,38,13),CHOLE(50,38,13)+AX(28,38,72,38)+AX(50,16,50,60));
  const PITCH=()=>[0,120,240].map(a=>{const r=a*Math.PI/180;return CHOLE(+(50+22*Math.sin(r)).toFixed(1),+(38-22*Math.cos(r)).toFixed(1),4.5);}).join('');
  F('Axes/Cercle','Cercle d’axes','Dessine le cercle qui passe par le centre de trous répartis en rond.',['Cliquez les trous'],PITCH(),PITCH()+'<circle cx="50" cy="38" r="22" fill="none" stroke="'+RE+'" stroke-width="1.3" stroke-dasharray="6 2 1.4 2"/>');
  const SYM=()=>ficD('M38 14L14 38L38 62Z','#111827',1.7)+ficD('M62 14L86 38L62 62Z','#111827',1.7);
  F('Axes/Symétrie','Axe de symétrie','Dessine l’axe au milieu de deux éléments identiques.',['Cliquez les deux éléments'],SYM(),SYM()+AX(50,6,50,70));
  const OUT=(ext,txt,lb)=>F('Sortie/'+ext,'Exporter en '+ext,txt,[],SHEET()+VF(34,24),DOC(34,14,ext,OR),null,'La planche',lb||'Le fichier');
  OUT('SVG','Crée une image vectorielle de la planche, nette à toutes les tailles.');
  OUT('DXF','Crée un fichier DXF pour les logiciels de dessin, avec des calques (contours, cotes, axes…).');
  OUT('PDF','Crée un PDF au format exact de la planche : choisissez « Enregistrer au format PDF ».');
  F('Sortie/Imprimer','Imprimer','Envoie la planche à l’imprimante.',[],SHEET()+VF(34,24),ficG(14,7,3,'<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" fill="#e2e8f0" stroke="#334155" stroke-width="1.3"/><rect x="6" y="14" width="12" height="7" fill="#fff" stroke="#334155" stroke-width="1.3"/>'),null,'La planche','Sur papier');
  /* ========== esquisse ========== */
  F('sk/select','Sélection','Choisit et déplace ce qui est dessiné. Suppr efface.',['Cliquez un élément','Glissez un point pour le déplacer'],SEG(20,56,60,20)+CURS(60,22),SEG(20,56,82,30,OR)+ficL(60,20,82,30,GY,.8,'2 1.6')+CURS(82,32),null,'Vous attrapez','Vous déplacez');
  F('sk/line','Ligne','Trace un trait entre deux points. Le deuxième clic enchaîne le trait suivant.',['Cliquez le départ','Cliquez l’arrivée'],LINE_A,LINE_B,'L',CL,RES);
  F('sk/rect','Rectangle','Trace un rectangle à partir de deux coins opposés (Ctrl : depuis le centre).',[],RECT_A,RECT_B,'R',CL,RES);
  F('sk/slot','Oblong','Trace un trou allongé aux bouts arrondis, pour une rainure.',[],NUM(16,20,'1')+NUM(84,56,'2'),ficD('M34 20H66A18 18 0 0 1 66 56H34A18 18 0 0 1 34 20Z',SK,1.6,null,'#dbeafe')+PTS(34,38)+PTS(66,38),'B',CL,RES);
  F('sk/circle','Cercle','Trace un cercle : le centre, puis un point du tour.',[],CIRC_A,CIRC_B,'C',CL,RES);
  F('sk/polygon','Polygone','Trace un polygone régulier : pentagone, 6 pans ou plus. Réglez le nombre de côtés et le Ø intérieur, celui du cercle qui touche chaque côté.',['Réglez les côtés et le Ø intérieur','Cliquez le centre, puis l’orientation'],ficC(50,38,20,GY,1,'2 1.8')+PTS(50,38),ficD('M50 12L72.5 25V51L50 64L27.5 51V25Z',SK,1.6,null,'#dbeafe')+ficC(50,38,22.5,GY,.9,'2 1.8')+PTS(50,38),'G','Le cercle intérieur','Les côtés lui sont tangents');
  F('sk/arc','Arc','Trace un morceau de cercle : le centre, le départ, l’arrivée.',[],ARC_A,ARC_B,null,CL,RES);
  const SPP=[[14,58],[36,24],[60,48],[86,18]];
  F('sk/spline','Courbe libre','Trace une courbe souple qui passe par tous vos points.',['Cliquez les points de passage','Double-clic ou Entrée pour finir'],SPP.map((p,i)=>NUM(p[0],p[1],''+(i+1))).join(''),ficD('M14 58C22 34 28 24 36 24S50 48 60 48S78 34 86 18')+SPP.map(p=>PTS(p[0],p[1])).join(''),'S',CL,RES);
  F('sk/cspline','Courbe par pôles','Trace une courbe douce attirée par vos points, sans passer forcément dessus.',['Cliquez les points de contrôle','Double-clic ou Entrée pour finir'],SPP.map((p,i)=>NUM(p[0],p[1],''+(i+1))).join(''),ficD('M14 58L36 24L60 48L86 18',GY,.9,'2 1.8')+ficD('M14 58C28 28 44 38 60 38S80 26 86 18')+SPP.map(p=>'<rect x="'+(p[0]-1.8)+'" y="'+(p[1]-1.8)+'" width="3.6" height="3.6" fill="'+SK+'"/>').join(''),'Maj+S',CL,RES);
  F('sk/cpoint','Point','Pose un point de repère, utile pour accrocher ou coter.',[],NUM(50,38,'1'),POINT_B,null,CL,RES);
  F('sk/hpoint','Centre de perçage','Marque l’emplacement d’un trou. La fonction Perçage fera ensuite le trou à cet endroit.',[],ficR(16,14,68,48,SK,1.4,'#dbeafe')+NUM(50,38,'1'),ficR(16,14,68,48,SK,1.4,'#dbeafe')+ficC(50,38,7,OR,1.3)+ficL(39,38,61,38,OR,1)+ficL(50,27,50,49,OR,1),'H',CL,RES);
  F('sk/project','Projeter','Recopie une arête de la pièce 3D sur votre dessin, pour vous appuyer dessus ou la coter.',['Cliquez l’arête'],PLAN(22,-14)+ficBox(-10,-10,-4,10,10,10,'b')+ficL3([[-10,10,-4],[10,10,-4]],OR,2.2),PLAN(22,-14)+ficL3([[-10,-10,-14],[10,-10,-14],[10,10,-14],[-10,10,-14]],GY,.8,'2 1.6',1)+ficL3([[-10,10,-14],[10,10,-14]],OR,2.2)+'<g opacity=".35">'+ficBox(-10,-10,-4,10,10,10,'b')+'</g>','P','L’arête en 3D','Sur l’esquisse');
  F('sk/isect','Intersection','Trace la ligne où le plan du dessin coupe la pièce. Elle suit le modèle s’il change.',['Cliquez des faces, ou Maj+clic pour un corps'],ficBox(-14,-14,-14,14,14,12,'b')+OPL(22,0),'<g opacity=".3">'+ficBox(-14,-14,-14,14,14,12,'b')+'</g>'+PLAN(22,0)+ficL3([[-14,-14,0],[14,-14,0],[14,14,0],[-14,14,0]],OR,2,null,1),'I','Le plan coupe','La ligne obtenue');
  F('sk/dim','Cote','Impose une dimension : le dessin se met à la bonne taille tout seul.',['Cliquez l’élément','Tapez la valeur'],ficL(24,48,64,48)+PTS(24,48)+PTS(64,48),ficL(18,48,82,48)+PTS(18,48)+PTS(82,48)+COTE(18,82,32,'80'),'D');
  F('sk/trim','Ajuster','Efface le morceau de trait que vous cliquez, jusqu’au croisement suivant.',[],TRIM_A,TRIM_B,'T','Clic sur le morceau',RES);
  F('sk/offset','Décalage','Trace une copie parallèle, à une distance donnée.',['Sélectionnez les traits','Cliquez le côté voulu'],ficR(32,24,36,28,SK,1.6),ficR(32,24,36,28,SK,1.6)+ficR(20,12,60,52,OR,1.6,null,1)+COTE(20,32,71,'')+ficT(36,73,'10',7,GR,'start'),'O');
  const CORNER=SEG(22,60,22,18)+SEG(22,18,78,18)+ficC(22,18,7,OR,1.2,'2 1.6');
  F('sk/chamfer','Chanfrein','Coupe un coin de votre dessin en biais.',['Cliquez les deux traits du coin'],CORNER,ficL(22,60,22,36)+ficL(40,18,78,18)+ficL(22,36,40,18,OR,2)+PTS(22,60)+PTS(78,18));
  F('sk/fillet','Congé','Arrondit un coin de votre dessin.',['Cliquez les deux traits du coin'],CORNER,ficL(22,60,22,40)+ficL(44,18,78,18)+ficD('M22 40A22 22 0 0 1 44 18',OR,2)+PTS(22,60)+PTS(78,18),'F');
  F('sk/h','Horizontal','Met un trait bien à plat.',['Sélectionnez le trait'],SEG(20,50,80,28),SEG(20,38,80,38,OR)+ficT(50,32,'H',8,GR),'F2');
  F('sk/v','Vertical','Met un trait bien droit, debout.',['Sélectionnez le trait'],SEG(38,62,62,14),SEG(50,62,50,14,OR)+ficT(58,40,'V',8,GR),'F2');
  F('sk/parallel','Parallèle','Rend deux traits parallèles : ils gardent toujours le même écart.',['Sélectionnez les 2 traits'],SEG(16,30,84,18)+SEG(16,48,84,66),SEG(16,28,84,28)+SEG(16,52,84,52,OR),'F5');
  F('sk/perpendicular','Perpendiculaire','Met deux traits à angle droit.',['Sélectionnez les 2 traits'],SEG(16,60,84,60)+SEG(30,60,62,14),SEG(16,60,84,60)+SEG(50,60,50,14,OR)+ficR(50,52,8,8,GR,.9),'F6');
  F('sk/collinear','Colinéaire','Aligne deux traits sur une même droite.',['Sélectionnez les 2 traits'],SEG(10,34,42,34)+SEG(58,50,90,44),SEG(10,38,42,38)+ficL(42,38,58,38,GY,.8,'2 1.6')+SEG(58,38,90,38,OR),'F9');
  F('sk/equal','Égal','Donne la même taille à deux traits ou deux cercles.',['Sélectionnez les 2 éléments'],SEG(14,26,84,26)+SEG(14,50,46,50),SEG(14,26,70,26)+SEG(14,50,70,50,OR)+ficT(82,41,'=',12,GR),'F4');
  F('sk/symmetric','Symétrie','Place deux traits en miroir de part et d’autre d’un axe.',['Sélectionnez les 2 traits','Puis l’axe'],ficL(50,6,50,70,'#64748b',1,'4 2')+SEG(18,20,38,58)+SEG(66,26,82,44),ficL(50,6,50,70,'#64748b',1,'4 2')+SEG(18,20,38,58)+SEG(82,20,62,58,OR),'F10');
  const LOCK=(x,y)=>ficR(x-5,y,10,8,'#334155',1,'#fbbf24',1.5)+ficD('M'+(x-3)+' '+y+'v-2.5a3 3 0 0 1 6 0V'+y,'#334155',1.2);
  F('sk/fix','Fixe','Bloque un élément à sa place : plus rien ne pourra le déplacer.',['Sélectionnez l’élément'],SEG(20,54,80,24)+ficL(80,24,92,14,GY,.8,'2 1.6'),SEG(20,54,80,24,OR)+LOCK(80,8),'F12');
  F('sk/tangent','Tangence','Fait se toucher un trait et un cercle en un seul point, sans casser la courbe.',['Sélectionnez le trait et le cercle'],ficC(50,46,18)+SEG(10,18,90,10),ficC(50,46,18)+SEG(10,28,90,28,OR)+ficDot(50,28,3,GR),'F3');
  F('sk/coaxial','Coaxial','Donne le même centre à deux cercles.',['Sélectionnez les 2 cercles'],ficC(40,40,20)+ficC(62,34,10),ficC(50,38,24)+ficC(50,38,11,OR)+ficDot(50,38,2,GR),'F8');
  F('sk/coincident','Coïncident','Colle un point sur un autre point, une ligne ou un cercle.',['Sélectionnez les 2 éléments'],SEG(14,58,44,30)+SEG(58,24,88,54),SEG(14,58,50,26)+SEG(50,26,88,54,OR)+ficDot(50,26,3.2,GR),'F1');
  F('sk/midpoint','Milieu','Place un point exactement au milieu d’un trait.',['Sélectionnez le point et le trait'],SEG(14,52,86,52)+PTS(30,24,OR),SEG(14,52,86,52)+ficDot(50,52,3.2,OR)+ficT(50,44,'milieu',6.6,GR),'F7');
  F('sk/construction','Construction','Change un trait en simple repère, en pointillé. Il aide à dessiner mais ne compte pas dans la forme.',['Sélectionnez le trait'],ficR(22,18,56,40)+ficL(22,58,78,18),ficR(22,18,56,40)+ficL(22,58,78,18,OR,1.3,'3 2.4'),'X');
  F('sk/skFit','Cadrer','Recentre le dessin pour le voir en entier.',[],ficG(62,6,.32,ficR(22,18,56,40)),ficR(22,18,56,40),null);
  F('sk/skOrbit','Vue inclinée','Incline la vue pendant que vous dessinez, pour voir le dessin avec la pièce en 3D. N revient à plat.',[],ficR(22,18,56,40),PLAN(20,0)+PROF(10,0),null,'À plat','Incliné');
  const GRID=()=>{let s='<g stroke="#cbd5e1" stroke-width=".6">';for(let i=10;i<100;i+=10)s+='<path d="M'+i+' 0V76"/>';for(let j=8;j<76;j+=10)s+='<path d="M0 '+j+'H100"/>';return s+'</g>';};
  F('sk/skGrid','Grille','Affiche ou masque le quadrillage derrière le dessin.',[],ficR(30,18,40,40),GRID()+ficR(30,18,40,40));
  F('sk/skRefs','Arêtes du solide','Affiche ou masque les contours de la pièce derrière le dessin, comme repères.',[],ficC(50,38,12),ficR(20,14,60,48,GY,1,null,2)+ficC(30,24,4,GY,1)+ficC(50,38,12),null,'Masquées','Affichées');
  F('sk/skParams','Paramètres','Voir et changer les valeurs nommées de la pièce, sans quitter le dessin.',['Clic : liste courte','Clic droit : liste complète'],ficL(18,48,60,48)+ficT(40,40,'L = 40',8,OR),ficL(18,48,86,48)+ficT(52,40,'L = 70',8,OR));
  /* ========== vue, timeline, divers ========== */
  F('id/mfThemeBtn','Couleurs et icônes','Change les couleurs de l’application et le style des icônes.',[],ficR(8,14,84,48,'#334155',1,'#1c1c1e',4)+ficR(14,20,40,8,'#0a84ff',0,'#0a84ff',2),ficR(8,14,84,48,'#94a3b8',1,'#e9ecf1',4)+ficR(14,20,40,8,'#0a6cff',0,'#0a6cff',2),null,'Thème sombre','Thème clair');
  F('id/treeToggle','Arborescence','Replie la liste des fonctions sur le côté pour laisser plus de place à la pièce.',[],ficR(6,8,88,60,'#94a3b8',1,'#fff',2)+ficR(6,8,28,60,'#94a3b8',.8,'#e2e8f0',2)+[0,1,2,3].map(i=>ficL(11,18+i*9,28,18+i*9,'#64748b',1.5)).join('')+MINI(66,40,.5,LPART()),ficR(6,8,88,60,'#94a3b8',1,'#fff',2)+ficR(6,28,6,20,'#94a3b8',.8,'#e2e8f0',1)+MINI(52,40,.75,LPART()),null,'Déplié','Replié');
  F('id/faoToggle','Panneau d’usinage','Replie la liste des usinages sur le côté pour laisser plus de place à la pièce.',[],ficR(6,8,88,60,'#94a3b8',1,'#fff',2)+ficR(6,8,28,60,'#94a3b8',.8,'#e2e8f0',2)+[0,1,2,3].map(i=>ficL(11,18+i*9,28,18+i*9,BL,1.5)).join('')+MINI(66,40,.5,LPART('w')),ficR(6,8,88,60,'#94a3b8',1,'#fff',2)+ficR(6,28,6,20,'#94a3b8',.8,'#e2e8f0',1)+MINI(52,40,.75,LPART('w')),null,'Déplié','Replié');
  F('id/btnRender','Rendu','Ouvre l’atelier qui crée une image réaliste : matières, ambiance, appareil photo.',[],LPART(),ficR(0,0,100,76,'none',0,'#1f2937')+ficBox(-13,-9,-8,3,9,12,'m')+ficBox(3,-9,-8,15,9,1,'m')+ficD('M18 12l-3-5M60 7l1-5M84 22l5-3','#fde047',2.2),null,'Le modèle','L’image réaliste');
  F('id/btnLive','Rendu direct','Affiche la vue de travail avec les vraies lumières, reflets et matières. On continue à travailler dessus.',['Clic droit sur une pièce : sa matière'],LPART(),ficR(0,0,100,76,'none',0,'#374151')+ficBox(-13,-9,-8,3,9,12,'m')+ficBox(3,-9,-8,15,9,1,'m'),null,'Vue normale','Vue réaliste');
  F('id/btnSettings','Réglages de la vue','Sol, reflets, arêtes, taille des icônes, perspective, coupe… et ces fiches au survol.',[],MINI(50,40,.9,LPART()),ficR(16,8,68,60,'#94a3b8',1,'#fff',3)+['Sol','Miroir','Repère','Fiches au survol'].map((s,i)=>ficR(22,15+i*13,7,7,GR,.8,GR,1.5)+ficT(33,21.5+i*13,s,6.6,'#334155','start')).join(''),null,'La vue','Ses réglages');
  F('id/mfCubeHome','Vue d’ensemble','Remet la pièce en vue isométrique et la cadre en entier.',[],MINI(68,28,.45,LPART()),LPART());
  F('id/mfOrbit','Mode d’orbite','Contrainte : le haut reste en haut. Libre : la pièce tourne dans tous les sens.',[],LPART()+ficL(50,2,50,12,'#3b82f6',1.4)+ficAr(50,12,50,2,'#3b82f6',1.4),'<g transform="rotate(38 50 42)">'+LPART()+'</g>'+ficD('M16 22A40 40 0 0 1 84 22',BL,1.4)+ficAr(80,18,86,26,BL,1.2),null,'Contrainte','Libre');
  F('id/mfStRegen','Régénérer','Recalcule tout le modèle et le contrôle, si quelque chose paraît ne pas être à jour.',[],'<g opacity=".5">'+LPART()+'</g>'+ficT(84,16,'⚠',11,'#d97706'),LPART()+CHK(84,14),'Ctrl+Maj+R','Pas à jour','Recalculé');
  const FILM=(n)=>[0,1,2,3].map(i=>ficR(10+i*21,56,17,12,i===n?OR:'#94a3b8',1,i===n?'#ffedd5':'#fff',2)).join('')+ficL(10,52,90,52,'#94a3b8',1);
  const STEP=(n)=>(n<=1?PLAN(16,-4)+PROF(9,-4):n===2?ficBox(-9,-9,-4,9,9,10,'b'):ficBox(-9,-9,-4,9,9,10,'b')+ficHole(0,0,10,4))+FILM(n);
  F('tl/⏮','Début de l’historique','Revient au tout début de la construction de la pièce.',[],STEP(3),STEP(0),null);
  F('tl/◀','Étape précédente','Remonte le temps d’une étape : la pièce s’affiche comme elle était alors.',[],STEP(3),STEP(2),null);
  F('tl/▶','Étape suivante','Avance d’une étape dans la construction de la pièce.',[],STEP(2),STEP(3),null);
  F('tl/⏭','Fin de l’historique','Revient à la pièce complète, toutes étapes appliquées.',[],STEP(1),STEP(3),null);
  F('tl/🎬','Film de construction','Rejoue en plein écran toute la construction de la pièce, étape par étape.',[],STEP(1),STEP(3),null,'Le film démarre','La pièce se construit');
  F('pos/＋','Ajouter un posage','Ajoute une nouvelle façon de tenir la pièce, pour usiner une autre face.',[],VISE()+ficBox(-15,-15,-10,15,15,6,'w'),ficG(-16,-12,.62,VISE()+ficBox(-15,-15,-10,15,15,6,'w'))+ficG(38,26,.62,VISE()+ficBox(-15,-15,-10,15,15,6,'o')),null);
  T['mep/＋']=T['Planches/Nouvelle'];
  T['mep/⧉']=T['Planches/Dupliquer'];
  F('mep/🗑','Supprimer la planche','Retire la feuille du plan, avec tout ce qu’elle contient.',[],ficG(0,0,.62,SHEET())+ficG(36,26,.62,SHEET()),ficG(0,0,.62,SHEET())+ficG(36,26,.62,'<g opacity=".3">'+SHEET()+'</g>'+ficL(14,10,86,66,RE,3)+ficL(86,10,14,66,RE,3)),null);
  return T;
}
