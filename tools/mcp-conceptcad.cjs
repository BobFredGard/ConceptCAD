#!/usr/bin/env node
// Serveur MCP de ConceptCAD (V0.8.5, pièces complètes en V0.94.0) — sans dépendance.
//
//   Claude (ou tout client MCP) ──stdio, JSON-RPC──▶ ce serveur ──WebSocket 127.0.0.1──▶ la page ConceptCAD
//
// La page se relie au serveur quand l'utilisateur clique « 🔌 Pilotage (MCP)… » (menu Projet) ;
// le serveur lui transmet des scripts JSON (53-scripts.js) et rend leurs résultats.
// Outils : conceptcad_run_script, conceptcad_info, conceptcad_geometry, conceptcad_commands
// (les noms minifusion_* d'avant V0.94.0 restent acceptés).
//
// Installation (Claude Code) :  claude mcp add conceptcad -- node <chemin>/tools/mcp-conceptcad.cjs
// Port : CONCEPTCAD_PORT (ou MINIFUSION_PORT), 47811 par défaut. Écoute sur 127.0.0.1 seulement.
// Pages admises : servies sur ce PC, le site officiel (et donc l'application installée depuis lui),
// les applications Windows et Mac. Jamais un autre site.
'use strict';
const http=require('http'),crypto=require('crypto');
const PORT=+(process.env.CONCEPTCAD_PORT||process.env.MINIFUSION_PORT)||47811;
const VERSION='0.94.0';
const log=(...a)=>process.stderr.write('[conceptcad-mcp] '+a.join(' ')+'\n');

/* ── WebSocket minimal (RFC 6455) : poignée de main, trames texte, ping / close ── */
let page=null;           // {sock, hello}
const pending=new Map(); // id → {resolve, timer}
let seq=0;
function wsSend(sock,text){
  const p=Buffer.from(text,'utf8'),n=p.length;
  let h;
  if(n<126)h=Buffer.from([0x81,n]);
  else if(n<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(n,2);}
  else{h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(n),2);}
  sock.write(Buffer.concat([h,p]));
}
function wsFrames(state,chunk,onText,onClose,sock){
  state.buf=Buffer.concat([state.buf,chunk]);
  for(;;){
    const b=state.buf;if(b.length<2)return;
    const op=b[0]&0x0f,fin=!!(b[0]&0x80),masked=!!(b[1]&0x80);let len=b[1]&0x7f,off=2;
    if(len===126){if(b.length<4)return;len=b.readUInt16BE(2);off=4;}
    else if(len===127){if(b.length<10)return;len=Number(b.readBigUInt64BE(2));off=10;}
    const mk=masked?b.slice(off,off+4):null;if(masked)off+=4;
    if(b.length<off+len)return;
    let data=b.slice(off,off+len);
    if(mk){data=Buffer.from(data);for(let i=0;i<data.length;i++)data[i]^=mk[i&3];}
    state.buf=b.slice(off+len);
    if(op===0x8){onClose();try{sock.end(Buffer.from([0x88,0]));}catch(e){}return;}
    if(op===0x9){try{sock.write(Buffer.concat([Buffer.from([0x8a,data.length]),data]));}catch(e){}continue;}
    if(op===0x1||op===0x0){state.parts.push(data);if(fin){onText(Buffer.concat(state.parts).toString('utf8'));state.parts=[];}}
  }
}
const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/plain; charset=utf-8'});
  res.end('Serveur MCP ConceptCAD '+VERSION+' — page '+(page?'reliée':'non reliée')+'\n');});
server.on('upgrade',(req,sock)=>{
  const key=req.headers['sec-websocket-key'];
  if(req.url==='/relais'){
    // autre conversation Claude : elle passe ses demandes par ce serveur (un seul tient le port).
    // Pas d'en-tête Origin : un navigateur en envoie toujours un, donc aucun site ne peut l'utiliser.
    if(!key||req.headers.origin){sock.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
    const acc=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+acc+'\r\n\r\n');
    const st={buf:Buffer.alloc(0),parts:[]};log('relais ouvert');
    sock.on('data',c=>wsFrames(st,c,async txt=>{
      let m;try{m=JSON.parse(txt);}catch(e){return;}
      if(m.type!=='run')return;
      const rid=m.id;delete m.id;const ms=Math.min(+m.ms||300000,600000);delete m.ms;
      const r=await toPage(m,ms,true);
      try{wsSend(sock,JSON.stringify({type:'result',id:rid,result:r}));}catch(e){}
    },()=>{},sock));
    sock.on('error',()=>{});
    return;
  }
  // origine : la page servie en local (http://localhost, file://, null), le site officiel, les applications — jamais un autre site
  const org=String(req.headers.origin||'null');
  if(!key||!/^(null|file:\/\/.*|https?:\/\/(localhost|127\.0\.0\.1|tauri\.localhost)(:\d+)?|tauri:\/\/localhost|https:\/\/bobfredgard\.github\.io)$/.test(org)){sock.end('HTTP/1.1 403 Forbidden\r\n\r\n');log('refusé, origine',org);return;}
  const acc=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+acc+'\r\n\r\n');
  if(page){try{page.sock.end();}catch(e){}}
  const me={sock,hello:null};page=me;
  const st={buf:Buffer.alloc(0),parts:[]};
  const gone=()=>{if(page===me){page=null;log('page déconnectée');}};
  sock.on('data',c=>wsFrames(st,c,txt=>{
    let m;try{m=JSON.parse(txt);}catch(e){return;}
    if(m.type==='hello'){me.hello=m;log('page reliée :',m.app,m.ver,'«',m.doc,'»');return;}
    if(m.type==='result'&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);p.resolve(m.result);}
  },gone,sock));
  sock.on('close',gone);sock.on('error',gone);
});
function toPage(msg,ms,local){
  if(!local&&relais)return viaRelais(msg,ms);
  return new Promise(resolve=>{
    if(!page){resolve({ok:false,error:'ConceptCAD n’est pas relié : ouvrez ConceptCAD (site, application installée ou serveur local), menu Projet → « 🔌 Pilotage (MCP)… ».'});return;}
    const id=++seq;msg.id=id;msg.type='run';
    const timer=setTimeout(()=>{pending.delete(id);resolve({ok:false,error:'pas de réponse de la page en '+(ms/1000)+' s'});},ms);
    pending.set(id,{resolve,timer});
    try{wsSend(page.sock,JSON.stringify(msg));}catch(e){clearTimeout(timer);pending.delete(id);resolve({ok:false,error:'envoi impossible : '+e.message});}
  });
}

/* ── Relais : quand une autre conversation tient déjà le port, ce serveur lui confie ses demandes ── */
let relais=null;          // WebSocket vers le serveur qui tient le port
const rpending=new Map();
function viaRelais(msg,ms){
  return new Promise(resolve=>{
    const id=++seq;
    const timer=setTimeout(()=>{rpending.delete(id);resolve({ok:false,error:'pas de réponse de la page en '+(ms/1000)+' s'});},ms+5000);
    rpending.set(id,{resolve,timer});
    try{relais.send(JSON.stringify(Object.assign({},msg,{type:'run',id,ms})));}catch(e){clearTimeout(timer);rpending.delete(id);resolve({ok:false,error:'relais coupé : '+e.message});}
  });
}
function ouvrirRelais(){
  if(typeof WebSocket!=='function'){log('relais impossible : Node 22 ou plus récent requis');return;}
  const w=new WebSocket('ws://127.0.0.1:'+PORT+'/relais');
  w.onopen=()=>{relais=w;log('port',PORT,'déjà tenu par une autre conversation : demandes relayées par elle');};
  w.onmessage=ev=>{let m;try{m=JSON.parse(String(ev.data));}catch(e){return;}
    const p=m.type==='result'&&rpending.get(m.id);if(p){rpending.delete(m.id);clearTimeout(p.timer);p.resolve(m.result);}};
  w.onerror=()=>{};
  w.onclose=()=>{const etait=relais===w;if(etait)relais=null;
    for(const [id,p] of rpending){clearTimeout(p.timer);p.resolve({ok:false,error:'la conversation qui tenait la prise s’est fermée : recliquer la prise dans ConceptCAD'});}
    rpending.clear();
    // le serveur qui tenait le port a disparu : essayer de le reprendre
    setTimeout(ecouter,etait?300:3000);};
}
function ecouter(){server.listen(PORT,'127.0.0.1');}
server.on('listening',()=>log('à l’écoute sur ws://127.0.0.1:'+PORT));
server.on('error',e=>{
  if(e.code==='EADDRINUSE'){ouvrirRelais();return;}
  log('port',PORT,'indisponible :',e.message);
});

/* ── MCP : JSON-RPC 2.0 sur stdio (une ligne par message) ── */
const COMMANDS=`Script ConceptCAD = liste de commandes JSON exécutées dans l'ordre sur le document ouvert.
Le script est atomique : à la première erreur, le document revient tel qu'avant (le résultat donne le numéro de la commande et l'erreur). Une seule étape d'annulation (Ctrl+Z) pour tout le script. Unités : mm, degrés. Repère : Z vers le haut.

Esquisses et volumes
  {"op":"new","name":"Bride"}                                   nouveau document vide
  {"op":"param","name":"L","expr":"60"}                          paramètre ƒx (crée ou modifie ; expressions : "L/2+3", sqrt, sin…)
  {"op":"sketch","id":"s1","name":"Contour","plane":"XY","offset":0,"shapes":[...]}
       plane : XY, XZ ou YZ ; offset : décalage le long de la normale du plan (XY offset 10 = à Z 10)
       shapes : {"rect":[x0,y0,x1,y1]} {"circle":[cx,cy,r]} {"poly":[[x,y],...]} {"line":[x1,y1,x2,y2]} (+ "construction":true)
                {"hole":[x,y]} = centre de perçage (pour "hole")
       (un cercle à l'intérieur d'un rectangle fait un trou dans le profil)
  {"op":"extrude","sketch":"s1","distance":10,"cut":false,"symmetric":false,"name":"Plaque"}
  {"op":"revolve","sketch":"s1","axis":"Z","angle":360,"cut":false}

Voir la pièce (avant de choisir des arêtes ou des faces)
  {"op":"edges"}   arêtes numérotées : index, body, kind (line|curve), axis (X|Y|Z si droite alignée), dir, mid, start, end, length
  {"op":"faces"}   faces numérotées : index, body, kind (plane|cylinder|cone|…), center, size (boîte), normal (sortante), radius
  {"op":"info"}    esquisses (avec leurs cotes numérotées), fonctions, paramètres, configurations, corps (volume mm³, centre, boîte)

Choisir sans cliquer (champ "edges" ou "faces")
  "all" · [3,7,8] (index de edges / faces) · "top" "bottom" "left" "right" "front" "back" (face extrême : top = normale +Z la plus haute)
  face  : {"normal":"+Z","at":"max"|"min","kind":"plane"|"cylinder","radius":3,"body":"Corps 1"}
  arête : {"dir":"Z","kind":"line"|"curve","face":<face>,"near":[x,y,z],"body":"Corps 1"}   (filtres cumulés)
  exemples : arêtes verticales {"dir":"Z"} ; contour du dessus {"face":"top"} ; arêtes du trou {"face":{"kind":"cylinder","radius":3}}
  Une liste mélange numéros et sélecteurs : [0, {"dir":"Z"}].

Finitions et opérations (mêmes fonctions qu'à la souris : modifiables ensuite dans l'arbre)
  {"op":"fillet","edges":{"dir":"Z"},"radius":5}                congé exact ; refusé s'il n'est pas fait tel quel (rayon trop grand…)
  {"op":"chamfer","edges":{"face":"top"},"distance":1}          chanfrein à distances égales
  {"op":"shell","faces":"top","thickness":2}                    coque : les faces choisies sont retirées (ouverture)
  {"op":"hole","sketch":"h","d":6.6,"depth":10,"tip":118}       perçage sur les centres "hole" de l'esquisse h, vers la matière
       "through":true au lieu de "depth" : débouchant ; "tip":0 : fond plat ; "flip":true : sens inverse
       "thread":"M8" (et "pitch":1 pour un pas fin) : taraudé, Ø de perçage du taraud mis tout seul, "threadLength" en option
       "cbore":{"d":11,"depth":6.4} : lamage ; "csink":{"d":13,"angle":90} : fraisure
  {"op":"pattern","features":["b"],"type":"linear","count":3,"distance":15,"axis":"X"}   count = nombre total, source comprise
       "type":"circular","count":6,"axis":"Z","angle":360 ; "type":"mirror","plane":"YZ"
       se répètent : extrusions, révolutions, balayages, perçages, congés, chanfreins, dépouilles
  {"op":"mirror","plane":"YZ","body":"Corps 1"}                symétrie d'un corps entier (corps actif par défaut)

Modifier l'existant
  {"op":"set","feature":"Plaque","distance":20}                 valeur d'une fonction (par "id" du script, id réel ou nom)
       extrude : distance · revolve : angle · fillet/chamfer : radius (ou distance) · shell : thickness
       hole : d, depth, tip · pattern : count, distance, angle
  {"op":"set","sketch":"Contour","dim":0,"value":80}            cote d'esquisse n° dim (voir info), l'esquisse est résolue
       (la valeur donnée remplace une formule ƒx ; refus si l'esquisse ne se résout plus)
  {"op":"config","name":"Grande"}                               active une configuration (table de variantes)
  {"op":"undo"}

Une commande vise une esquisse ou une fonction par l'"id" donné dans le script, son id réel ou son nom.
Les résultats de fillet, chamfer, shell et hole donnent le volume après coup : comparez-le à votre calcul.`;
const TOOLS=[
  {name:'conceptcad_run_script',description:'Exécute un script de commandes JSON dans ConceptCAD (CAO paramétrique) : esquisses, extrusions, révolutions, congés, chanfreins, perçages (taraudés, lamés), coques, répétitions, symétries, modification de valeurs existantes. Atomique. Lire conceptcad_commands pour la syntaxe.',
    inputSchema:{type:'object',properties:{commands:{type:'array',items:{type:'object'},description:'Liste de commandes {op, …}'}},required:['commands']}},
  {name:'conceptcad_info',description:'État du document ouvert dans ConceptCAD : esquisses et leurs cotes, fonctions, paramètres, configurations, corps avec volume (mm³), centre de gravité et boîte englobante.',
    inputSchema:{type:'object',properties:{}}},
  {name:'conceptcad_geometry',description:'Arêtes et faces numérotées de la pièce ouverte (sens, milieu, longueur, normale, rayon), pour choisir celles d’un congé, d’un chanfrein ou d’une coque.',
    inputSchema:{type:'object',properties:{}}},
  {name:'conceptcad_commands',description:'Syntaxe des scripts ConceptCAD (commandes, champs, sélecteurs d’arêtes et de faces).',
    inputSchema:{type:'object',properties:{}}}
];
// Noms d'avant V0.94.0 (MiniFusion) : toujours acceptés
const ALIAS={minifusion_run_script:'conceptcad_run_script',minifusion_info:'conceptcad_info',minifusion_commands:'conceptcad_commands'};
const txt=(o,err)=>({content:[{type:'text',text:typeof o==='string'?o:JSON.stringify(o,null,1)}],isError:!!err});
async function callTool(name,args){
  name=ALIAS[name]||name;
  if(name==='conceptcad_commands')return txt(COMMANDS);
  if(name==='conceptcad_info'){const r=await toPage({info:true},30000);return txt(r.ok?r.results[0]:r.error,!r.ok);}
  if(name==='conceptcad_geometry'){const r=await toPage({script:[{op:'edges'},{op:'faces'}]},120000);return txt(r.ok?{edges:r.results[0].edges,faces:r.results[1].faces}:r.error,!r.ok);}
  if(name==='conceptcad_run_script'){
    const cmds=args&&args.commands;if(!Array.isArray(cmds))return txt('« commands » : liste attendue',true);
    const r=await toPage({script:cmds},300000);
    return txt(r,!r.ok);
  }
  return txt('outil inconnu : '+name,true);
}
function reply(id,result){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n');}
function replyErr(id,code,message){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,error:{code,message}})+'\n');}
async function handle(m){
  if(!m||m.jsonrpc!=='2.0')return;
  const isReq=m.id!==undefined&&m.id!==null;
  try{
    switch(m.method){
      case 'initialize':
        return reply(m.id,{protocolVersion:(m.params&&m.params.protocolVersion)||'2025-06-18',capabilities:{tools:{}},
          serverInfo:{name:'conceptcad',version:VERSION},
          instructions:'Pilote ConceptCAD (CAO paramétrique, FAO, mise en plan). L’utilisateur doit relier la page : menu Projet → « 🔌 Pilotage (MCP)… ». Lire conceptcad_commands avant d’écrire un script ; regarder la pièce avec conceptcad_geometry avant de choisir des arêtes ou des faces ; vérifier les volumes rendus.'});
      case 'ping':return reply(m.id,{});
      case 'tools/list':return reply(m.id,{tools:TOOLS});
      case 'tools/call':return reply(m.id,await callTool(m.params&&m.params.name,(m.params&&m.params.arguments)||{}));
      default:
        if(isReq)return replyErr(m.id,-32601,'méthode inconnue : '+m.method);
    }
  }catch(e){if(isReq)replyErr(m.id,-32603,String(e&&e.message||e));}
}
let inBuf='';
process.stdin.setEncoding('utf8');
process.stdin.on('data',d=>{inBuf+=d;let i;while((i=inBuf.indexOf('\n'))>=0){const line=inBuf.slice(0,i).trim();inBuf=inBuf.slice(i+1);
  if(!line)continue;let m;try{m=JSON.parse(line);}catch(e){replyErr(null,-32700,'JSON illisible');continue;}handle(m);}});
process.stdin.on('end',()=>process.exit(0));
ecouter();
