// Fabrique icons/icon.ico à partir du logo de la barre du logiciel, à toutes les tailles utilisées
// par Windows. Les règles sont relues dans ConceptCAD.html : l'icône est ce logo, pas un dessin à part.
//   node tauri/icone.cjs
'use strict';
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const DOSSIER=path.join(__dirname,'src-tauri','icons');
const CHROME='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TAILLES=[16,24,32,48,64,128,256];
const COTE=15;              // côté du logo dans la barre, en pixels
const TRAIT='#f5f5f7';      // --text du thème par défaut
const FOND='#2a2a2c';       // la barre telle qu'on la voit : --surface posée sur --bg
function reglesDuLogo(){
  const html=fs.readFileSync(path.join(__dirname,'..','ConceptCAD.html'),'utf8');
  const regles=html.match(/\.brand \.mk(?:::(?:before|after))?\{[^}]*\}/g)||[];
  if(regles.length!==3)throw new Error('logo introuvable dans ConceptCAD.html : '+regles.length+' règles au lieu de 3');
  return regles.join('\n');
}
// Format classique des petites icônes : lu par tous les outils de Windows, même anciens.
function bmp(px,t){
  const masque=Math.ceil(t/32)*4*t,o=Buffer.alloc(40+t*t*4+masque);
  o.writeUInt32LE(40,0);o.writeInt32LE(t,4);o.writeInt32LE(t*2,8);o.writeUInt16LE(1,12);o.writeUInt16LE(32,14);
  o.writeUInt32LE(t*t*4+masque,20);
  for(let y=0;y<t;y++)for(let x=0;x<t;x++){
    const s=(y*t+x)*4,d=40+((t-1-y)*t+x)*4;
    o[d]=px[s+2];o[d+1]=px[s+1];o[d+2]=px[s];o[d+3]=px[s+3];
  }
  return o;
}
(async()=>{
  const regles=reglesDuLogo();
  const nav=await chromium.launch({executablePath:CHROME,headless:true});
  const images=[];
  try{
    for(const t of TAILLES){
      // Le logo est agrandi comme sur un écran à haute densité : ses proportions ne bougent pas.
      const page=await nav.newPage({viewport:{width:COTE,height:COTE},deviceScaleFactor:t/COTE});
      await page.setContent('<!doctype html><style>html,body{margin:0;background:transparent}'+regles+
        '.brand{color:'+TRAIT+'}.brand .mk{display:block;margin:0;background:'+FOND+'}</style>'+
        '<div class="brand"><span class="mk"></span></div>');
      const png=await page.screenshot({omitBackground:true,clip:{x:0,y:0,width:COTE,height:COTE}});
      if(t===256)images.push(png); // la grande taille reste en PNG, comme le veut Windows
      else{
        const px=await page.evaluate(async b64=>{
          const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();
          const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
          const g=c.getContext('2d');g.drawImage(im,0,0);
          return Array.from(g.getImageData(0,0,im.width,im.height).data);
        },png.toString('base64'));
        images.push(bmp(px,t));
      }
      await page.close();
    }
  }finally{await nav.close();}
  // Format .ico : un en-tête, une ligne par taille, puis les images à la suite.
  const tete=Buffer.alloc(6+16*TAILLES.length);
  tete.writeUInt16LE(1,2);tete.writeUInt16LE(TAILLES.length,4);
  let pos=tete.length;
  TAILLES.forEach((t,i)=>{
    const e=6+16*i;
    tete[e]=t%256;tete[e+1]=t%256; // 256 s'écrit 0
    tete.writeUInt16LE(1,e+4);tete.writeUInt16LE(32,e+6);
    tete.writeUInt32LE(images[i].length,e+8);tete.writeUInt32LE(pos,e+12);
    pos+=images[i].length;
  });
  fs.writeFileSync(path.join(DOSSIER,'icon.ico'),Buffer.concat([tete,...images]));
  console.log('icon.ico : '+TAILLES.join(', ')+' px, '+pos+' octets');
})().catch(e=>{console.error(e);process.exit(1);});
