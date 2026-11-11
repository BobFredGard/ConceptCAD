// V0.8.5 : serveur MCP (tools/mcp-conceptcad.cjs depuis V0.94.0), processus réel. Client MCP par stdio
// (initialize, tools/list, tools/call), page simulée par un client WebSocket écrit à la main
// (Node 20 n'en a pas) : outil sans page → erreur explicite ; page reliée → script transmis,
// résultat rendu ; erreur de script → isError ; origine distante refusée ; méthode inconnue.
// V0.94.0 : noms conceptcad_*, anciens noms minifusion_* acceptés, outil de géométrie, site officiel
// (application installée) accepté, faux site refusé, ancien chemin du serveur toujours lançable.
// Relais : une 2e conversation (2e serveur, même port) passe ses demandes par le 1er ; un site ne peut
// pas se faire passer pour un relais ; le 1er fermé, le 2e reprend le port.
const {spawn}=require('child_process'),http=require('http'),crypto=require('crypto'),path=require('path');
const PORT=47900+(process.pid%80);
const ATT=[],OK=[];const att=(ok,msg)=>{(ok?OK:ATT).push(msg);};
const srv=spawn(process.execPath,[path.join(__dirname,'..','tools',process.env.MCP_ANCIEN?'mcp-minifusion.cjs':'mcp-conceptcad.cjs')],{env:Object.assign({},process.env,{CONCEPTCAD_PORT:String(PORT)}),stdio:['pipe','pipe','pipe']});
let out='',errTxt='';const waiters=new Map();
srv.stdout.on('data',d=>{out+=d;let i;while((i=out.indexOf('\n'))>=0){const l=out.slice(0,i);out=out.slice(i+1);try{const m=JSON.parse(l);const w=waiters.get(m.id);if(w){waiters.delete(m.id);w(m);}}catch(e){}}});
srv.stderr.on('data',d=>{errTxt+=d;});
let rid=0;
const rpc=(method,params)=>new Promise((res,rej)=>{const id=++rid;const t=setTimeout(()=>rej(new Error('délai '+method)),20000);
  waiters.set(id,m=>{clearTimeout(t);res(m);});srv.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
function wsConnect(origin,chemin){
  // client WebSocket minimal : poignée de main, trames masquées (client), texte
  return new Promise((res,rej)=>{
    const key=crypto.randomBytes(16).toString('base64');
    const req=http.request({host:'127.0.0.1',port:PORT,path:chemin||'/',headers:Object.assign({Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Key':key,'Sec-WebSocket-Version':'13'},origin?{Origin:origin}:{})});
    req.on('upgrade',(r,sock)=>{sock.on('error',()=>{});
      const c={sock,onText:null,send(t){const p=Buffer.from(t),m=crypto.randomBytes(4);let h;
        if(p.length<126)h=Buffer.from([0x81,0x80|p.length]);else{h=Buffer.alloc(4);h[0]=0x81;h[1]=0x80|126;h.writeUInt16BE(p.length,2);}
        const q=Buffer.from(p);for(let i=0;i<q.length;i++)q[i]^=m[i&3];sock.write(Buffer.concat([h,m,q]));}};
      let buf=Buffer.alloc(0);
      sock.on('data',d=>{buf=Buffer.concat([buf,d]);for(;;){if(buf.length<2)return;let len=buf[1]&0x7f,off=2;
        if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);off=4;}else if(len===127){if(buf.length<10)return;len=Number(buf.readBigUInt64BE(2));off=10;}
        if(buf.length<off+len)return;const op=buf[0]&0x0f,data=buf.slice(off,off+len).toString();buf=buf.slice(off+len);if(op===1&&c.onText)c.onText(data);}});
      res(c);});
    req.on('response',r=>res({refused:r.statusCode}));
    req.on('error',e=>res({refused:String(e.message)}));
    req.end();
  });
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  for(let i=0;i<50&&!/écoute/.test(errTxt);i++)await pause(100);
  att(/écoute sur ws:\/\/127\.0\.0\.1:/.test(errTxt),'1 : serveur à l’écoute sur 127.0.0.1');
  const ini=await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}});
  att(ini.result&&ini.result.serverInfo.name==='conceptcad'&&ini.result.capabilities.tools&&ini.result.protocolVersion==='2025-06-18','2 : initialize (nom, capacités, version du protocole)');
  srv.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const tl=await rpc('tools/list',{});
  const names=(tl.result&&tl.result.tools||[]).map(t=>t.name).sort().join();
  att(names==='conceptcad_commands,conceptcad_geometry,conceptcad_info,conceptcad_run_script','3 : quatre outils ('+names+')');
  const doc=await rpc('tools/call',{name:'conceptcad_commands',arguments:{}});
  att(/"op":"extrude"/.test(doc.result.content[0].text)&&/"op":"fillet"/.test(doc.result.content[0].text)&&/"op":"hole"/.test(doc.result.content[0].text)&&!doc.result.isError,'4 : syntaxe des scripts (extrude, fillet, hole…)');
  const vieux=await rpc('tools/call',{name:'minifusion_commands',arguments:{}});
  att(!vieux.result.isError&&/"op":"fillet"/.test(vieux.result.content[0].text),'4b : ancien nom minifusion_commands accepté');
  const no=await rpc('tools/call',{name:'conceptcad_info',arguments:{}});
  att(no.result.isError&&/Pilotage/.test(no.result.content[0].text),'5 : sans page reliée : erreur qui dit quoi faire');
  // origine distante refusée
  const bad=await wsConnect('https://exemple.com');
  att(bad.refused!=null&&!bad.sock,'6 : page d’un site distant refusée ('+bad.refused+')');
  const faux=await wsConnect('https://bobfredgard.github.io.exemple.com');
  att(faux.refused!=null&&!faux.sock,'6b : faux site au nom ressemblant refusé');
  const site=await wsConnect('https://bobfredgard.github.io');
  att(!!site.sock,'6c : site officiel (application installée) accepté');
  try{site.sock.end();}catch(e){}
  await pause(100);
  // la page se relie
  const pg=await wsConnect('http://localhost:3125');
  att(!!pg.sock,'7 : page locale reliée');
  const got=[];
  pg.onText=t=>{const m=JSON.parse(t);got.push(m);
    if(m.info)pg.send(JSON.stringify({type:'result',id:m.id,result:{ok:true,results:[{op:'info',name:'Plaque',bodies:[{volume:22869.03}]}]}}));
    else if(m.script&&m.script[0].op==='fly')pg.send(JSON.stringify({type:'result',id:m.id,result:{ok:false,results:[],error:'op inconnue',at:1}}));
    else pg.send(JSON.stringify({type:'result',id:m.id,result:{ok:true,results:m.script.map(c=>({op:c.op,edges:[],faces:[]}))}}));};
  pg.send(JSON.stringify({type:'hello',app:'ConceptCAD',ver:'V0.94.0',doc:'Plaque'}));
  await pause(200);
  att(/page reliée : ConceptCAD V0\.94\.0/.test(errTxt),'8 : la page se présente');
  const big=[{op:'sketch',id:'s',plane:'XY',shapes:Array.from({length:40},(_,k)=>({circle:[k*3,0,1]}))},{op:'extrude',sketch:'s',distance:2}];
  const run=await rpc('tools/call',{name:'conceptcad_run_script',arguments:{commands:big}});
  const rr=JSON.parse(run.result.content[0].text);
  att(!run.result.isError&&rr.ok&&rr.results.length===2&&got[0].type==='run'&&got[0].script.length===2,'9 : script transmis à la page (trame > 126 octets), résultat rendu');
  const inf=await rpc('tools/call',{name:'minifusion_info',arguments:{}}); // ancien nom
  att(!inf.result.isError&&JSON.parse(inf.result.content[0].text).bodies[0].volume===22869.03,'10 : état du document');
  const er=await rpc('tools/call',{name:'conceptcad_run_script',arguments:{commands:[{op:'fly'}]}});
  att(er.result.isError&&/inconnue/.test(er.result.content[0].text),'11 : erreur de script → isError');
  const nc=await rpc('tools/call',{name:'conceptcad_run_script',arguments:{}});
  const geo=await rpc('tools/call',{name:'conceptcad_geometry',arguments:{}});
  const gm=got[got.length-1];
  att(gm&&gm.script&&gm.script.map(c=>c.op).join()==='edges,faces','12b : géométrie demandée à la page (edges puis faces)');
  att(nc.result.isError,'12 : arguments manquants → isError');
  const um=await rpc('resources/list',{});
  att(um.error&&um.error.code===-32601,'13 : méthode inconnue → erreur JSON-RPC');
  const pg2=await wsConnect('null'); // file:// : origine « null »
  att(!!pg2.sock,'14 : page ouverte en file:// acceptée');
  pg2.onText=t=>{const m=JSON.parse(t);pg2.send(JSON.stringify({type:'result',id:m.id,result:{ok:true,results:[{op:'info',name:'Relayée'}]}}));};
  const usurpe=await wsConnect('https://exemple.com','/relais');
  att(usurpe.refused!=null&&!usurpe.sock,'15 : un site ne peut pas se faire passer pour un relais');
  let err2='',out2='';const w2=new Map();
  const srv2=spawn(process.execPath,[path.join(__dirname,'..','tools','mcp-conceptcad.cjs')],{env:Object.assign({},process.env,{CONCEPTCAD_PORT:String(PORT)}),stdio:['pipe','pipe','pipe']});
  srv2.stderr.on('data',d=>{err2+=d;});
  srv2.stdout.on('data',d=>{out2+=d;let i;while((i=out2.indexOf('\n'))>=0){const l=out2.slice(0,i);out2=out2.slice(i+1);try{const m=JSON.parse(l);const w=w2.get(m.id);if(w){w2.delete(m.id);w(m);}}catch(e){}}});
  const rpc2=(method,params)=>new Promise((res,rej)=>{const id=++rid;const t=setTimeout(()=>rej(new Error('délai2 '+method)),20000);w2.set(id,m=>{clearTimeout(t);res(m);});srv2.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
  for(let i=0;i<50&&!/relayées/.test(err2);i++)await pause(100);
  att(/relayées/.test(err2),'16 : 2e conversation : port déjà tenu, demandes relayées');
  await rpc2('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test2',version:'1'}});
  const ri=await rpc2('tools/call',{name:'conceptcad_info',arguments:{}});
  att(!ri.result.isError&&JSON.parse(ri.result.content[0].text).name==='Relayée','17 : la 2e conversation pilote la page par le relais');
  srv.kill();
  for(let i=0;i<50&&!/écoute/.test(err2);i++)await pause(100);
  att(/écoute sur ws/.test(err2),'18 : la 1re fermée, la 2e reprend le port');
  const pg3=await wsConnect('http://localhost:3125');
  pg3.onText=t=>{const m=JSON.parse(t);pg3.send(JSON.stringify({type:'result',id:m.id,result:{ok:true,results:[{op:'info',name:'Reprise'}]}}));};
  await pause(150);
  const r3=await rpc2('tools/call',{name:'conceptcad_info',arguments:{}});
  att(!r3.result.isError&&JSON.parse(r3.result.content[0].text).name==='Reprise','19 : page reliée de nouveau, pilotée par la 2e');
  srv2.kill();
  console.log('=== serveur MCP ConceptCAD'+(process.env.MCP_ANCIEN?' (ancien chemin)':'')+' ===');
  OK.forEach(m=>console.log('  ✓ '+m));
  if(ATT.length){ATT.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+ATT.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');process.exit(0);
})().catch(e=>{try{srv.kill();}catch(e2){}console.log('FATAL',String((e&&e.stack)||e).slice(0,1200),'\n',errTxt.slice(-500));process.exit(1);});
