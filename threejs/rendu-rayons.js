/* miniFusion — atelier RENDU, moteur « Lancer de rayons » : bibliothèque empaquetée (script classique → window.RDPT).
   three 0.187.0 (MIT, Three.js Authors) · three-mesh-bvh 0.9.16 (MIT, Garrett Johnson) · three-gpu-pathtracer 0.0.27 (MIT, Garrett Johnson) · HDRLoader, EXRLoader et fflate (MIT) pour les images HDRI.
   Fichier GÉNÉRÉ par tools/rendu-rayons-entree.mjs (voir l’en-tête de ce fichier) : ne pas éditer. */
var RDPT=(()=>{var Kc=Object.defineProperty;var ig=Object.getOwnPropertyDescriptor;var rg=Object.getOwnPropertyNames;var sg=Object.prototype.hasOwnProperty;var cf=(i,e)=>{for(var t in e)Kc(i,t,{get:e[t],enumerable:!0})},og=(i,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of rg(e))!sg.call(i,r)&&r!==t&&Kc(i,r,{get:()=>e[r],enumerable:!(n=ig(e,r))||n.enumerable});return i};var ag=i=>og(Kc({},"__esModule",{value:!0}),i);var rb={};cf(rb,{EXRLoader:()=>$c,HDRLoader:()=>qc,PhysicalCamera:()=>As,THREE:()=>ib,WebGLPathTracer:()=>Xc,zipSync:()=>ng});var Lf=0,Ru=1,Ff=2;var ro=1,Nf=2,is=3,En=0,Kt=1,vn=2,_n=0,oi=1,so=2,Cu=3,Iu=4,Uf=5;var gr=100,Of=101,Bf=102,zf=103,kf=104,Hf=200,Gf=201,Vf=202,Wf=203,Pu=204,Du=205,Xf=206,qf=207,Yf=208,Zf=209,$f=210,Jf=211,Kf=212,Qf=213,jf=214,Ma=0,Ta=1,wa=2,Yr=3,Aa=4,Ea=5,Ra=6,Ca=7,Lu=0,ed=1,td=2,Ln=0,Fu=1,oo=2,ao=3,lo=4,Nu=5,co=6,uo=7;var Uu=300,xr=301,rs=302,ai=303,Qa=304,rn=1e3,Pt=1001,Ia=1002,Qe=1003,nd=1004;var ho=1005;var lt=1006,ja=1007;var li=1008,Ou=1008,sn=1009,ss=1010,fo=1011,Xi=1012,qi=1013,on=1014,tt=1015,ht=1016,el=1017,tl=1018,vr=1020,Bu=35902,zu=35899,ku=1021,Hu=1022,qe=1023,Mi=1026,Ai=1027,Rn=1028,os=1029,an=1030,Yi=1031;var Zi=1033,po=33776,mo=33777,go=33778,xo=33779,nl=35840,il=35841,rl=35842,sl=35843,ol=36196,al=37492,ll=37496,cl=37488,ul=37489,vo=37490,hl=37491,fl=37808,dl=37809,pl=37810,ml=37811,gl=37812,xl=37813,vl=37814,_l=37815,yl=37816,Sl=37817,bl=37818,Ml=37819,Tl=37820,wl=37821,Al=36492,El=36494,Rl=36495,Cl=36283,Il=36284,_o=36285,Pl=36286;var zs=2300,Pa=2301,Sa=2302,yu=2303,Su=2400,bu=2401,Mu=2402;var id=3200;var Dl=0,rd=1,Ei="",Tn="srgb",un="srgb-linear",ks="linear",wt="srgb";var ba=7680;var sd=519,od=512,ad=513,ld=514,Gu=515,cd=516,ud=517,Vu=518,Wu=519,hd=35044;var Xu="300 es",Wn=2e3,Hs=2001;function lg(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function cg(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function Gs(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function fd(){let i=Gs("canvas");return i.style.display="block",i}var uf={},Zr=null;function qu(...i){let e="THREE."+i.shift();Zr?Zr("log",e,...i):console.log(e,...i)}function dd(i){let e=i[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=i[1];t&&t.isStackTrace?i[0]+=" "+t.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Xe(...i){i=dd(i);let e="THREE."+i.shift();if(Zr)Zr("warn",e,...i);else{let t=i[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...i)}}function Ke(...i){i=dd(i);let e="THREE."+i.shift();if(Zr)Zr("error",e,...i);else{let t=i[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...i)}}function Bi(...i){let e=i.join(" ");e in uf||(uf[e]=!0,Xe(...i))}function pd(i,e,t){return new Promise(function(n,r){function s(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:r();break;case i.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:n()}}setTimeout(s,t)})}var md={[Ma]:Ma,[wa]:Ra,[Aa]:Aa,[Yr]:Ea,[Ta]:Ta,[Ra]:wa,[Ca]:Ca,[Ea]:Yr},si=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let r=n.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}},pn=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var Qc=Math.PI/180,Da=180/Math.PI;function yo(){let i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(pn[i&255]+pn[i>>8&255]+pn[i>>16&255]+pn[i>>24&255]+"-"+pn[e&255]+pn[e>>8&255]+"-"+pn[e>>16&15|64]+pn[e>>24&255]+"-"+pn[t&63|128]+pn[t>>8&255]+"-"+pn[t>>16&255]+pn[t>>24&255]+pn[n&255]+pn[n>>8&255]+pn[n>>16&255]+pn[n>>24&255]).toLowerCase()}function nt(i,e,t){return Math.max(e,Math.min(t,i))}function ug(i,e){return(i%e+e)%e}function jc(i,e,t){return(1-t)*i+t*e}function gd(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Yu(i){switch(i.constructor){case Uint32Array:return 4294967295;case Uint16Array:return 65535;case Uint8Array:case Uint8ClampedArray:return 255;case Int32Array:return 2147483647;case Int16Array:return 32767;case Int8Array:return 127;default:return}}function hg(i,e){if(e.constructor===Float32Array)return i;let t=Yu(e);if(t===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.max(i/t,-1)}function fg(i,e){if(e.constructor===Float32Array)return i;let t=Yu(e);if(t===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.round(i*t)}var Qu=class Qu{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=nt(this.x,e.x,t.x),this.y=nt(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=nt(this.x,e,t),this.y=nt(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(nt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(nt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*n-o*r+e.x,this.y=s*r+o*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};Qu.prototype.isVector2=!0;var Ue=Qu,Xn=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,s,o,a){let l=n[r+0],u=n[r+1],f=n[r+2],h=n[r+3],c=s[o+0],d=s[o+1],x=s[o+2],S=s[o+3];if(h!==S||l!==c||u!==d||f!==x){let p=l*c+u*d+f*x+h*S;p<0&&(c=-c,d=-d,x=-x,S=-S,p=-p);let g=1-a;if(p<.9995){let y=Math.acos(p),T=Math.sin(y);g=Math.sin(g*y)/T,a=Math.sin(a*y)/T,l=l*g+c*a,u=u*g+d*a,f=f*g+x*a,h=h*g+S*a}else{l=l*g+c*a,u=u*g+d*a,f=f*g+x*a,h=h*g+S*a;let y=1/Math.sqrt(l*l+u*u+f*f+h*h);l*=y,u*=y,f*=y,h*=y}}e[t]=l,e[t+1]=u,e[t+2]=f,e[t+3]=h}static multiplyQuaternionsFlat(e,t,n,r,s,o){let a=n[r],l=n[r+1],u=n[r+2],f=n[r+3],h=s[o],c=s[o+1],d=s[o+2],x=s[o+3];return e[t]=a*x+f*h+l*d-u*c,e[t+1]=l*x+f*c+u*h-a*d,e[t+2]=u*x+f*d+a*c-l*h,e[t+3]=f*x-a*h-l*c-u*d,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,l=Math.sin,u=a(n/2),f=a(r/2),h=a(s/2),c=l(n/2),d=l(r/2),x=l(s/2);switch(o){case"XYZ":this._x=c*f*h+u*d*x,this._y=u*d*h-c*f*x,this._z=u*f*x+c*d*h,this._w=u*f*h-c*d*x;break;case"YXZ":this._x=c*f*h+u*d*x,this._y=u*d*h-c*f*x,this._z=u*f*x-c*d*h,this._w=u*f*h+c*d*x;break;case"ZXY":this._x=c*f*h-u*d*x,this._y=u*d*h+c*f*x,this._z=u*f*x+c*d*h,this._w=u*f*h-c*d*x;break;case"ZYX":this._x=c*f*h-u*d*x,this._y=u*d*h+c*f*x,this._z=u*f*x-c*d*h,this._w=u*f*h+c*d*x;break;case"YZX":this._x=c*f*h+u*d*x,this._y=u*d*h+c*f*x,this._z=u*f*x-c*d*h,this._w=u*f*h-c*d*x;break;case"XZY":this._x=c*f*h-u*d*x,this._y=u*d*h-c*f*x,this._z=u*f*x+c*d*h,this._w=u*f*h+c*d*x;break;default:Xe("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],s=t[8],o=t[1],a=t[5],l=t[9],u=t[2],f=t[6],h=t[10],c=n+a+h;if(c>0){let d=.5/Math.sqrt(c+1);this._w=.25/d,this._x=(f-l)*d,this._y=(s-u)*d,this._z=(o-r)*d}else if(n>a&&n>h){let d=2*Math.sqrt(1+n-a-h);this._w=(f-l)/d,this._x=.25*d,this._y=(r+o)/d,this._z=(s+u)/d}else if(a>h){let d=2*Math.sqrt(1+a-n-h);this._w=(s-u)/d,this._x=(r+o)/d,this._y=.25*d,this._z=(l+f)/d}else{let d=2*Math.sqrt(1+h-n-a);this._w=(o-r)/d,this._x=(s+u)/d,this._y=(l+f)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(nt(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,s=e._z,o=e._w,a=t._x,l=t._y,u=t._z,f=t._w;return this._x=n*f+o*a+r*u-s*l,this._y=r*f+o*l+s*a-n*u,this._z=s*f+o*u+n*l-r*a,this._w=o*f-n*a-r*l-s*u,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,s=e._z,o=e._w,a=this.dot(e);a<0&&(n=-n,r=-r,s=-s,o=-o,a=-a);let l=1-t;if(a<.9995){let u=Math.acos(a),f=Math.sin(u);l=Math.sin(l*u)/f,t=Math.sin(t*u)/f,this._x=this._x*l+n*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+o*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+o*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},ju=class ju{constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(hf.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(hf.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6]*r,this.y=s[1]*t+s[4]*n+s[7]*r,this.z=s[2]*t+s[5]*n+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,s=e.elements,o=1/(s[3]*t+s[7]*n+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*n+s[8]*r+s[12])*o,this.y=(s[1]*t+s[5]*n+s[9]*r+s[13])*o,this.z=(s[2]*t+s[6]*n+s[10]*r+s[14])*o,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,s=e.x,o=e.y,a=e.z,l=e.w,u=2*(o*r-a*n),f=2*(a*t-s*r),h=2*(s*n-o*t);return this.x=t+l*u+o*h-a*f,this.y=n+l*f+a*u-s*h,this.z=r+l*h+s*f-o*u,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*r,this.y=s[1]*t+s[5]*n+s[9]*r,this.z=s[2]*t+s[6]*n+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=nt(this.x,e.x,t.x),this.y=nt(this.y,e.y,t.y),this.z=nt(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=nt(this.x,e,t),this.y=nt(this.y,e,t),this.z=nt(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(nt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,s=e.z,o=t.x,a=t.y,l=t.z;return this.x=r*l-s*a,this.y=s*o-n*l,this.z=n*a-r*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return eu.copy(this).projectOnVector(e),this.sub(eu)}reflect(e){return this.sub(eu.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(nt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};ju.prototype.isVector3=!0;var H=ju,eu=new H,hf=new Xn,eh=class eh{constructor(e,t,n,r,s,o,a,l,u){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,s,o,a,l,u)}set(e,t,n,r,s,o,a,l,u){let f=this.elements;return f[0]=e,f[1]=r,f[2]=a,f[3]=t,f[4]=s,f[5]=l,f[6]=n,f[7]=o,f[8]=u,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,s=this.elements,o=n[0],a=n[3],l=n[6],u=n[1],f=n[4],h=n[7],c=n[2],d=n[5],x=n[8],S=r[0],p=r[3],g=r[6],y=r[1],T=r[4],M=r[7],A=r[2],E=r[5],_=r[8];return s[0]=o*S+a*y+l*A,s[3]=o*p+a*T+l*E,s[6]=o*g+a*M+l*_,s[1]=u*S+f*y+h*A,s[4]=u*p+f*T+h*E,s[7]=u*g+f*M+h*_,s[2]=c*S+d*y+x*A,s[5]=c*p+d*T+x*E,s[8]=c*g+d*M+x*_,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],u=e[7],f=e[8];return t*o*f-t*a*u-n*s*f+n*a*l+r*s*u-r*o*l}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],u=e[7],f=e[8],h=f*o-a*u,c=a*l-f*s,d=u*s-o*l,x=t*h+n*c+r*d;if(x===0)return this.set(0,0,0,0,0,0,0,0,0);let S=1/x;return e[0]=h*S,e[1]=(r*u-f*n)*S,e[2]=(a*n-r*o)*S,e[3]=c*S,e[4]=(f*t-r*l)*S,e[5]=(r*s-a*t)*S,e[6]=d*S,e[7]=(n*l-u*t)*S,e[8]=(o*t-n*s)*S,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,s,o,a){let l=Math.cos(s),u=Math.sin(s);return this.set(n*l,n*u,-n*(l*o+u*a)+o+e,-r*u,r*l,-r*(-u*o+l*a)+a+t,0,0,1),this}scale(e,t){return Bi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(tu.makeScale(e,t)),this}rotate(e){return Bi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(tu.makeRotation(-e)),this}translate(e,t){return Bi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(tu.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let r=0;r<9;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}};eh.prototype.isMatrix3=!0;var je=eh,tu=new je,ff=new je().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),df=new je().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function dg(){let i={enabled:!0,workingColorSpace:un,spaces:{},convert:function(r,s,o){return this.enabled===!1||s===o||!s||!o||(this.spaces[s].transfer===wt&&(r.r=bi(r.r),r.g=bi(r.g),r.b=bi(r.b)),this.spaces[s].primaries!==this.spaces[o].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===wt&&(r.r=qr(r.r),r.g=qr(r.g),r.b=qr(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===Ei?ks:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[o].fromXYZ).multiply(this.spaces[s].toXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[un]:{primaries:e,whitePoint:n,transfer:ks,toXYZ:ff,fromXYZ:df,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Tn},outputColorSpaceConfig:{drawingBufferColorSpace:Tn}},[Tn]:{primaries:e,whitePoint:n,transfer:wt,toXYZ:ff,fromXYZ:df,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Tn}}}),i}var dt=dg();function bi(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function qr(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var Pr,La=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Pr===void 0&&(Pr=Gs("canvas")),Pr.width=e.width,Pr.height=e.height;let r=Pr.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),n=Pr}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Gs("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=bi(s[o]/255)*255;return n.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(bi(t[n]/255)*255):t[n]=bi(t[n]);return{data:t,width:e.width,height:e.height}}else return Xe("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},pg=0,hr=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:pg++}),this.uuid=yo(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width||0,t.height||0,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(nu(r[o].image)):s.push(nu(r[o]))}else s=nu(r);n.url=s}return t||(e.images[this.uuid]=n),n}};function nu(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?La.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Xe("Texture: Unable to serialize Texture."),{})}var Vs=class extends hr{constructor(e=null){Bi('Source: "Source" has been renamed to "TextureSource". Please update your code to use "THREE.TextureSource" instead.'),super(e),this.isSource=!0}},mg=0,iu=new H,Dn=class i extends si{constructor(e=i.DEFAULT_IMAGE,t=i.DEFAULT_MAPPING,n=Pt,r=Pt,s=lt,o=li,a=qe,l=sn,u=i.DEFAULT_ANISOTROPY,f=Ei){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:mg++}),this.uuid=yo(),this.name="",this.source=new hr(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=u,this.format=a,this.internalFormat=null,this.type=l,this.offset=new Ue(0,0),this.repeat=new Ue(1,1),this.center=new Ue(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new je,this.generateMipmaps=!0,this.mipmapsAutoUpdate=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=f,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.isPMREMTexture=!1,this.normalized=!1}get width(){return this.source.getSize(iu).x}get height(){return this.source.getSize(iu).y}get depth(){return this.source.getSize(iu).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.mipmapsAutoUpdate=e.mipmapsAutoUpdate,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isPMREMTexture=e.isPMREMTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){Xe(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){Xe(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,mipmapsAutoUpdate:this.mipmapsAutoUpdate,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Uu)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case rn:e.x=e.x-Math.floor(e.x);break;case Pt:e.x=e.x<0?0:1;break;case Ia:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case rn:e.y=e.y-Math.floor(e.y);break;case Pt:e.y=e.y<0?0:1;break;case Ia:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Dn.DEFAULT_IMAGE=null;Dn.DEFAULT_MAPPING=Uu;Dn.DEFAULT_ANISOTROPY=1;var th=class th{constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*n+o[8]*r+o[12]*s,this.y=o[1]*t+o[5]*n+o[9]*r+o[13]*s,this.z=o[2]*t+o[6]*n+o[10]*r+o[14]*s,this.w=o[3]*t+o[7]*n+o[11]*r+o[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,s,l=e.elements,u=l[0],f=l[4],h=l[8],c=l[1],d=l[5],x=l[9],S=l[2],p=l[6],g=l[10];if(Math.abs(f-c)<.01&&Math.abs(h-S)<.01&&Math.abs(x-p)<.01){if(Math.abs(f+c)<.1&&Math.abs(h+S)<.1&&Math.abs(x+p)<.1&&Math.abs(u+d+g-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let T=(u+1)/2,M=(d+1)/2,A=(g+1)/2,E=(f+c)/4,_=(h+S)/4,w=(x+p)/4;return T>M&&T>A?T<.01?(n=0,r=.707106781,s=.707106781):(n=Math.sqrt(T),r=E/n,s=_/n):M>A?M<.01?(n=.707106781,r=0,s=.707106781):(r=Math.sqrt(M),n=E/r,s=w/r):A<.01?(n=.707106781,r=.707106781,s=0):(s=Math.sqrt(A),n=_/s,r=w/s),this.set(n,r,s,t),this}let y=Math.sqrt((p-x)*(p-x)+(h-S)*(h-S)+(c-f)*(c-f));return Math.abs(y)<.001&&(y=1),this.x=(p-x)/y,this.y=(h-S)/y,this.z=(c-f)/y,this.w=Math.acos((u+d+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=nt(this.x,e.x,t.x),this.y=nt(this.y,e.y,t.y),this.z=nt(this.z,e.z,t.z),this.w=nt(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=nt(this.x,e,t),this.y=nt(this.y,e,t),this.z=nt(this.z,e,t),this.w=nt(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(nt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};th.prototype.isVector4=!0;var St=th,Fa=class extends si{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:lt,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new St(0,0,e,t),this.scissorTest=!1,this.viewport=new St(0,0,e,t),this.textures=[];let r=n.count;for(let s=0;s<r;s++)this.textures[s]=new Dn({width:e,height:t,depth:n.depth}),this.textures[s].isRenderTargetTexture=!0,this.textures[s].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:lt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.mipmapsAutoUpdate!==void 0&&(t.mipmapsAutoUpdate=e.mipmapsAutoUpdate),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let r=Object.assign({},e.textures[t].image);this.textures[t].source=new hr(r)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;else this.depthTexture=null;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},zt=class extends Fa{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},zi=class extends Dn{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=Qe,this.minFilter=Qe,this.wrapR=Pt,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},Ws=class extends zt{constructor(e=1,t=1,n=1,r={}){super(e,t,r),this.isWebGLArrayRenderTarget=!0,this.depth=n,this.texture=new zi(null,e,t,n),this._setTextureOptions(r),this.texture.isRenderTargetTexture=!0}},Na=class extends Dn{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=Qe,this.minFilter=Qe,this.wrapR=Pt,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}};var Ka=class Ka{constructor(e,t,n,r,s,o,a,l,u,f,h,c,d,x,S,p){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,s,o,a,l,u,f,h,c,d,x,S,p)}set(e,t,n,r,s,o,a,l,u,f,h,c,d,x,S,p){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=r,g[1]=s,g[5]=o,g[9]=a,g[13]=l,g[2]=u,g[6]=f,g[10]=h,g[14]=c,g[3]=d,g[7]=x,g[11]=S,g[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Ka().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,r=1/Dr.setFromMatrixColumn(e,0).length(),s=1/Dr.setFromMatrixColumn(e,1).length(),o=1/Dr.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*s,t[5]=n[5]*s,t[6]=n[6]*s,t[7]=0,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,s=e.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(r),u=Math.sin(r),f=Math.cos(s),h=Math.sin(s);if(e.order==="XYZ"){let c=o*f,d=o*h,x=a*f,S=a*h;t[0]=l*f,t[4]=-l*h,t[8]=u,t[1]=d+x*u,t[5]=c-S*u,t[9]=-a*l,t[2]=S-c*u,t[6]=x+d*u,t[10]=o*l}else if(e.order==="YXZ"){let c=l*f,d=l*h,x=u*f,S=u*h;t[0]=c+S*a,t[4]=x*a-d,t[8]=o*u,t[1]=o*h,t[5]=o*f,t[9]=-a,t[2]=d*a-x,t[6]=S+c*a,t[10]=o*l}else if(e.order==="ZXY"){let c=l*f,d=l*h,x=u*f,S=u*h;t[0]=c-S*a,t[4]=-o*h,t[8]=x+d*a,t[1]=d+x*a,t[5]=o*f,t[9]=S-c*a,t[2]=-o*u,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let c=o*f,d=o*h,x=a*f,S=a*h;t[0]=l*f,t[4]=x*u-d,t[8]=c*u+S,t[1]=l*h,t[5]=S*u+c,t[9]=d*u-x,t[2]=-u,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let c=o*l,d=o*u,x=a*l,S=a*u;t[0]=l*f,t[4]=S-c*h,t[8]=x*h+d,t[1]=h,t[5]=o*f,t[9]=-a*f,t[2]=-u*f,t[6]=d*h+x,t[10]=c-S*h}else if(e.order==="XZY"){let c=o*l,d=o*u,x=a*l,S=a*u;t[0]=l*f,t[4]=-h,t[8]=u*f,t[1]=c*h+S,t[5]=o*f,t[9]=d*h-x,t[2]=x*h-d,t[6]=a*f,t[10]=S*h+c}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(gg,e,xg)}lookAt(e,t,n){let r=this.elements;return Un.subVectors(e,t),Un.lengthSq()===0&&(Un.z=1),Un.normalize(),Li.crossVectors(n,Un),Li.lengthSq()===0&&(Math.abs(n.z)===1?Un.x+=1e-4:Un.z+=1e-4,Un.normalize(),Li.crossVectors(n,Un)),Li.normalize(),ea.crossVectors(Un,Li),r[0]=Li.x,r[4]=ea.x,r[8]=Un.x,r[1]=Li.y,r[5]=ea.y,r[9]=Un.y,r[2]=Li.z,r[6]=ea.z,r[10]=Un.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,s=this.elements,o=n[0],a=n[4],l=n[8],u=n[12],f=n[1],h=n[5],c=n[9],d=n[13],x=n[2],S=n[6],p=n[10],g=n[14],y=n[3],T=n[7],M=n[11],A=n[15],E=r[0],_=r[4],w=r[8],L=r[12],I=r[1],N=r[5],U=r[9],z=r[13],D=r[2],G=r[6],W=r[10],Z=r[14],le=r[3],J=r[7],se=r[11],ae=r[15];return s[0]=o*E+a*I+l*D+u*le,s[4]=o*_+a*N+l*G+u*J,s[8]=o*w+a*U+l*W+u*se,s[12]=o*L+a*z+l*Z+u*ae,s[1]=f*E+h*I+c*D+d*le,s[5]=f*_+h*N+c*G+d*J,s[9]=f*w+h*U+c*W+d*se,s[13]=f*L+h*z+c*Z+d*ae,s[2]=x*E+S*I+p*D+g*le,s[6]=x*_+S*N+p*G+g*J,s[10]=x*w+S*U+p*W+g*se,s[14]=x*L+S*z+p*Z+g*ae,s[3]=y*E+T*I+M*D+A*le,s[7]=y*_+T*N+M*G+A*J,s[11]=y*w+T*U+M*W+A*se,s[15]=y*L+T*z+M*Z+A*ae,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],s=e[12],o=e[1],a=e[5],l=e[9],u=e[13],f=e[2],h=e[6],c=e[10],d=e[14],x=e[3],S=e[7],p=e[11],g=e[15],y=l*d-u*c,T=a*d-u*h,M=a*c-l*h,A=o*d-u*f,E=o*c-l*f,_=o*h-a*f;return t*(S*y-p*T+g*M)-n*(x*y-p*A+g*E)+r*(x*T-S*A+g*_)-s*(x*M-S*E+p*_)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],r=e[8],s=e[1],o=e[5],a=e[9],l=e[2],u=e[6],f=e[10];return t*(o*f-a*u)-n*(s*f-a*l)+r*(s*u-o*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],u=e[7],f=e[8],h=e[9],c=e[10],d=e[11],x=e[12],S=e[13],p=e[14],g=e[15],y=t*a-n*o,T=t*l-r*o,M=t*u-s*o,A=n*l-r*a,E=n*u-s*a,_=r*u-s*l,w=f*S-h*x,L=f*p-c*x,I=f*g-d*x,N=h*p-c*S,U=h*g-d*S,z=c*g-d*p,D=y*z-T*U+M*N+A*I-E*L+_*w;if(D===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let G=1/D;return e[0]=(a*z-l*U+u*N)*G,e[1]=(r*U-n*z-s*N)*G,e[2]=(S*_-p*E+g*A)*G,e[3]=(c*E-h*_-d*A)*G,e[4]=(l*I-o*z-u*L)*G,e[5]=(t*z-r*I+s*L)*G,e[6]=(p*M-x*_-g*T)*G,e[7]=(f*_-c*M+d*T)*G,e[8]=(o*U-a*I+u*w)*G,e[9]=(n*I-t*U-s*w)*G,e[10]=(x*E-S*M+g*y)*G,e[11]=(h*M-f*E-d*y)*G,e[12]=(a*L-o*N-l*w)*G,e[13]=(t*N-n*L+r*w)*G,e[14]=(S*T-x*A-p*y)*G,e[15]=(f*A-h*T+c*y)*G,this}scale(e){let t=this.elements,n=e.x,r=e.y,s=e.z;return t[0]*=n,t[4]*=r,t[8]*=s,t[1]*=n,t[5]*=r,t[9]*=s,t[2]*=n,t[6]*=r,t[10]*=s,t[3]*=n,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),s=1-n,o=e.x,a=e.y,l=e.z,u=s*o,f=s*a;return this.set(u*o+n,u*a-r*l,u*l+r*a,0,u*a+r*l,f*a+n,f*l-r*o,0,u*l-r*a,f*l+r*o,s*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,s,o){return this.set(1,n,s,0,e,1,o,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,s=t._x,o=t._y,a=t._z,l=t._w,u=s+s,f=o+o,h=a+a,c=s*u,d=s*f,x=s*h,S=o*f,p=o*h,g=a*h,y=l*u,T=l*f,M=l*h,A=n.x,E=n.y,_=n.z;return r[0]=(1-(S+g))*A,r[1]=(d+M)*A,r[2]=(x-T)*A,r[3]=0,r[4]=(d-M)*E,r[5]=(1-(c+g))*E,r[6]=(p+y)*E,r[7]=0,r[8]=(x+T)*_,r[9]=(p-y)*_,r[10]=(1-(c+S))*_,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let s=this.determinantAffine();if(s===0)return n.set(1,1,1),t.identity(),this;let o=Dr.set(r[0],r[1],r[2]).length(),a=Dr.set(r[4],r[5],r[6]).length(),l=Dr.set(r[8],r[9],r[10]).length();s<0&&(o=-o),$n.copy(this);let u=1/o,f=1/a,h=1/l;return $n.elements[0]*=u,$n.elements[1]*=u,$n.elements[2]*=u,$n.elements[4]*=f,$n.elements[5]*=f,$n.elements[6]*=f,$n.elements[8]*=h,$n.elements[9]*=h,$n.elements[10]*=h,t.setFromRotationMatrix($n),n.x=o,n.y=a,n.z=l,this}makePerspective(e,t,n,r,s,o,a=Wn,l=!1){let u=this.elements,f=2*s/(t-e),h=2*s/(n-r),c=(t+e)/(t-e),d=(n+r)/(n-r),x,S;if(l)x=s/(o-s),S=o*s/(o-s);else if(a===Wn)x=-(o+s)/(o-s),S=-2*o*s/(o-s);else if(a===Hs)x=-o/(o-s),S=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return u[0]=f,u[4]=0,u[8]=c,u[12]=0,u[1]=0,u[5]=h,u[9]=d,u[13]=0,u[2]=0,u[6]=0,u[10]=x,u[14]=S,u[3]=0,u[7]=0,u[11]=-1,u[15]=0,this}makeOrthographic(e,t,n,r,s,o,a=Wn,l=!1){let u=this.elements,f=2/(t-e),h=2/(n-r),c=-(t+e)/(t-e),d=-(n+r)/(n-r),x,S;if(l)x=1/(o-s),S=o/(o-s);else if(a===Wn)x=-2/(o-s),S=-(o+s)/(o-s);else if(a===Hs)x=-1/(o-s),S=-s/(o-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return u[0]=f,u[4]=0,u[8]=0,u[12]=c,u[1]=0,u[5]=h,u[9]=0,u[13]=d,u[2]=0,u[6]=0,u[10]=x,u[14]=S,u[3]=0,u[7]=0,u[11]=0,u[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let r=0;r<16;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}};Ka.prototype.isMatrix4=!0;var Ze=Ka,Dr=new H,$n=new Ze,gg=new H(0,0,0),xg=new H(1,1,1),Li=new H,ea=new H,Un=new H,pf=new Ze,mf=new Xn,Ti=class i{constructor(e=0,t=0,n=0,r=i.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,s=r[0],o=r[4],a=r[8],l=r[1],u=r[5],f=r[9],h=r[2],c=r[6],d=r[10];switch(t){case"XYZ":this._y=Math.asin(nt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-f,d),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(c,u),this._z=0);break;case"YXZ":this._x=Math.asin(-nt(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(a,d),this._z=Math.atan2(l,u)):(this._y=Math.atan2(-h,s),this._z=0);break;case"ZXY":this._x=Math.asin(nt(c,-1,1)),Math.abs(c)<.9999999?(this._y=Math.atan2(-h,d),this._z=Math.atan2(-o,u)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-nt(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(c,d),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,u));break;case"YZX":this._z=Math.asin(nt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-f,u),this._y=Math.atan2(-h,s)):(this._x=0,this._y=Math.atan2(a,d));break;case"XZY":this._z=Math.asin(-nt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(c,u),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-f,d),this._y=0);break;default:Xe("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return pf.makeRotationFromQuaternion(e),this.setFromRotationMatrix(pf,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return mf.setFromEuler(this),this.setFromQuaternion(mf,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Ti.DEFAULT_ORDER="XYZ";var Xs=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},vg=0,gf=new H,Lr=new Xn,pi=new Ze,ta=new H,Ns=new H,_g=new H,yg=new Xn,xf=new H(1,0,0),vf=new H(0,1,0),_f=new H(0,0,1),yf={type:"added"},Sg={type:"removed"},Fr={type:"childadded",child:null},ru={type:"childremoved",child:null},qn=class i extends si{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:vg++}),this.uuid=yo(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let e=new H,t=new Ti,n=new Xn,r=new H(1,1,1);function s(){n.setFromEuler(t,!1)}function o(){t.setFromQuaternion(n,void 0,!1)}t._onChange(s),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new Ze},normalMatrix:{value:new je}}),this.matrix=new Ze,this.matrixWorld=new Ze,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Xs,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale),this.pivot!==null&&this.position.copy(this.pivot).applyMatrix4(this.matrix).sub(this.pivot)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Lr.setFromAxisAngle(e,t),this.quaternion.multiply(Lr),this}rotateOnWorldAxis(e,t){return Lr.setFromAxisAngle(e,t),this.quaternion.premultiply(Lr),this}rotateX(e){return this.rotateOnAxis(xf,e)}rotateY(e){return this.rotateOnAxis(vf,e)}rotateZ(e){return this.rotateOnAxis(_f,e)}translateOnAxis(e,t){return gf.copy(e).applyQuaternion(this.quaternion),this.position.add(gf.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(xf,e)}translateY(e){return this.translateOnAxis(vf,e)}translateZ(e){return this.translateOnAxis(_f,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(pi.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?ta.copy(e):ta.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),Ns.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?pi.lookAt(Ns,ta,this.up):pi.lookAt(ta,Ns,this.up),this.quaternion.setFromRotationMatrix(pi),r&&(pi.extractRotation(r.matrixWorld),Lr.setFromRotationMatrix(pi),this.quaternion.premultiply(Lr.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ke("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(yf),Fr.child=e,this.dispatchEvent(Fr),Fr.child=null):Ke("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Sg),ru.child=e,this.dispatchEvent(ru),ru.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),pi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),pi.multiply(e.parent.matrixWorld)),e.applyMatrix4(pi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(yf),Fr.child=e,this.dispatchEvent(Fr),Fr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let o=this.children[n].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ns,e,_g),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ns,yg,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){return!0}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*n-s[8]*r,s[13]+=n-s[1]*t-s[5]*n-s[9]*r,s[14]+=r-s[2]*t-s[6]*n-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let s=this.children;for(let o=0,a=s.length;o<a;o++)s[o].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,r.name=this.name,r.castShadow=this.castShadow,r.receiveShadow=this.receiveShadow,r.visible=this.visible,r.frustumCulled=this.frustumCulled,r.renderOrder=this.renderOrder,r.static=this.static,r.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(a=>({...a})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let u=0,f=l.length;u<f;u++){let h=l[u];s(e.shapes,h)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,u=this.material.length;l<u;l++)a.push(s(e.materials,this.material[l]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];r.animations.push(s(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),u=o(e.textures),f=o(e.images),h=o(e.shapes),c=o(e.skeletons),d=o(e.animations),x=o(e.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),u.length>0&&(n.textures=u),f.length>0&&(n.images=f),h.length>0&&(n.shapes=h),c.length>0&&(n.skeletons=c),d.length>0&&(n.animations=d),x.length>0&&(n.nodes=x)}return n.object=r,n;function o(a){let l=[];for(let u in a){let f=a[u];delete f.metadata,l.push(f)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let r=e.children[n];this.add(r.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};qn.DEFAULT_UP=new H(0,1,0);qn.DEFAULT_MATRIX_AUTO_UPDATE=!0;qn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Si=class extends qn{constructor(){super(),this.isGroup=!0,this.type="Group"}},bg={type:"move"},$r=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Si,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Si,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new H,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new H),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Si,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new H,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new H,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,s=null,o=null,a=this._targetRay,l=this._grip,u=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(u&&e.hand){o=!0;for(let S of e.hand.values()){let p=t.getJointPose(S,n),g=this._getHandJoint(u,S);p!==null&&(g.matrix.fromArray(p.transform.matrix),g.matrix.decompose(g.position,g.quaternion,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=p.radius),g.visible=p!==null}let f=u.joints["index-finger-tip"],h=u.joints["thumb-tip"],c=f.position.distanceTo(h.position),d=.02,x=.005;u.inputState.pinching&&c>d+x?(u.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!u.inputState.pinching&&c<=d-x&&(u.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,n),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.quaternion,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));a!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&s!==null&&(r=s),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.quaternion,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(bg)))}return a!==null&&(a.visible=r!==null),l!==null&&(l.visible=s!==null),u!==null&&(u.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Si;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},xd={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Fi={h:0,s:0,l:0},na={h:0,s:0,l:0};function su(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}var Je=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Tn){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,dt.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=dt.workingColorSpace){return this.r=e,this.g=t,this.b=n,dt.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=dt.workingColorSpace){if(e=ug(e,1),t=nt(t,0,1),n=nt(n,0,1),t===0)this.r=this.g=this.b=n;else{let s=n<=.5?n*(1+t):n+t-n*t,o=2*n-s;this.r=su(o,s,e+1/3),this.g=su(o,s,e),this.b=su(o,s,e-1/3)}return dt.colorSpaceToWorking(this,r),this}setStyle(e,t=Tn){function n(s){s!==void 0&&parseFloat(s)<1&&Xe("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(a))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(a))return n(s[4]),this.setRGB(Math.min(100,parseFloat(s[1]))/100,Math.min(100,parseFloat(s[2]))/100,Math.min(100,parseFloat(s[3]))/100,t);break;case"hsl":case"hsla":if(s=/^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(a))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:Xe("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(s,16),t);Xe("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Tn){let n=xd[e.toLowerCase()];return n!==void 0?this.setHex(n,t):Xe("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=bi(e.r),this.g=bi(e.g),this.b=bi(e.b),this}copyLinearToSRGB(e){return this.r=qr(e.r),this.g=qr(e.g),this.b=qr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Tn){return dt.workingToColorSpace(mn.copy(this),e),Math.round(nt(mn.r*255,0,255))*65536+Math.round(nt(mn.g*255,0,255))*256+Math.round(nt(mn.b*255,0,255))}getHexString(e=Tn){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=dt.workingColorSpace){dt.workingToColorSpace(mn.copy(this),t);let n=mn.r,r=mn.g,s=mn.b,o=Math.max(n,r,s),a=Math.min(n,r,s),l,u,f=(a+o)/2;if(a===o)l=0,u=0;else{let h=o-a;switch(u=f<=.5?h/(o+a):h/(2-o-a),o){case n:l=(r-s)/h+(r<s?6:0);break;case r:l=(s-n)/h+2;break;case s:l=(n-r)/h+4;break}l/=6}return e.h=l,e.s=u,e.l=f,e}getRGB(e,t=dt.workingColorSpace){return dt.workingToColorSpace(mn.copy(this),t),e.r=mn.r,e.g=mn.g,e.b=mn.b,e}getStyle(e=Tn){dt.workingToColorSpace(mn.copy(this),e);let t=mn.r,n=mn.g,r=mn.b;return e!==Tn?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`}offsetHSL(e,t,n){return this.getHSL(Fi),this.setHSL(Fi.h+e,Fi.s+t,Fi.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Fi),e.getHSL(na);let n=jc(Fi.h,na.h,t),r=jc(Fi.s,na.s,t),s=jc(Fi.l,na.l,t);return this.setHSL(n,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*n+s[6]*r,this.g=s[1]*t+s[4]*n+s[7]*r,this.b=s[2]*t+s[5]*n+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},mn=new Je;Je.NAMES=xd;var fr=class extends qn{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Ti,this.environmentIntensity=1,this.environmentRotation=new Ti,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),this.background=e.background!==null?e.background.clone():null,this.environment=e.environment!==null?e.environment.clone():null,this.fog=e.fog!==null?e.fog.clone():null,this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),this.overrideMaterial=e.overrideMaterial!==null?e.overrideMaterial.clone():null,this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Jn=new H,mi=new H,ou=new H,gi=new H,Nr=new H,Ur=new H,Sf=new H,au=new H,lu=new H,cu=new H,uu=new St,hu=new St,fu=new St,gn=class i{constructor(e=new H,t=new H,n=new H){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),Jn.subVectors(e,t),r.cross(Jn);let s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,n,r,s){Jn.subVectors(r,t),mi.subVectors(n,t),ou.subVectors(e,t);let o=Jn.dot(Jn),a=Jn.dot(mi),l=Jn.dot(ou),u=mi.dot(mi),f=mi.dot(ou),h=o*u-a*a;if(h===0)return s.set(0,0,0),null;let c=1/h,d=(u*l-a*f)*c,x=(o*f-a*l)*c;return s.set(1-d-x,x,d)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,gi)===null?!1:gi.x>=0&&gi.y>=0&&gi.x+gi.y<=1}static getInterpolation(e,t,n,r,s,o,a,l){return this.getBarycoord(e,t,n,r,gi)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,gi.x),l.addScaledVector(o,gi.y),l.addScaledVector(a,gi.z),l)}static getInterpolatedAttribute(e,t,n,r,s,o){return uu.setScalar(0),hu.setScalar(0),fu.setScalar(0),uu.fromBufferAttribute(e,t),hu.fromBufferAttribute(e,n),fu.fromBufferAttribute(e,r),o.setScalar(0),o.addScaledVector(uu,s.x),o.addScaledVector(hu,s.y),o.addScaledVector(fu,s.z),o}static isFrontFacing(e,t,n,r){return Jn.subVectors(n,t),mi.subVectors(e,t),Jn.cross(mi).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Jn.subVectors(this.c,this.b),mi.subVectors(this.a,this.b),Jn.cross(mi).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return i.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return i.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,r,s){return i.getInterpolation(e,this.a,this.b,this.c,t,n,r,s)}containsPoint(e){return i.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return i.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,s=this.c,o,a;Nr.subVectors(r,n),Ur.subVectors(s,n),au.subVectors(e,n);let l=Nr.dot(au),u=Ur.dot(au);if(l<=0&&u<=0)return t.copy(n);lu.subVectors(e,r);let f=Nr.dot(lu),h=Ur.dot(lu);if(f>=0&&h<=f)return t.copy(r);let c=l*h-f*u;if(c<=0&&l>=0&&f<=0&&l-f>0)return o=l/(l-f),t.copy(n).addScaledVector(Nr,o);cu.subVectors(e,s);let d=Nr.dot(cu),x=Ur.dot(cu);if(x>=0&&d<=x)return t.copy(s);let S=d*u-l*x;if(S<=0&&u>=0&&x<=0)return a=u/(u-x),t.copy(n).addScaledVector(Ur,a);let p=f*x-d*h;if(p<=0&&h-f>=0&&d-x>=0)return Sf.subVectors(s,r),a=(h-f)/(h-f+(d-x)),t.copy(r).addScaledVector(Sf,a);let g=1/(p+S+c);return o=S*g,a=c*g,t.copy(n).addScaledVector(Nr,o).addScaledVector(Ur,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},kt=class{constructor(e=new H(1/0,1/0,1/0),t=new H(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Kn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Kn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Kn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let s=n.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0&&e.isBatchedMesh!==!0)for(let o=0,a=s.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,Kn):Kn.fromBufferAttribute(s,o),Kn.applyMatrix4(e.matrixWorld),this.expandByPoint(Kn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ia.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ia.copy(n.boundingBox)),ia.applyMatrix4(e.matrixWorld),this.union(ia)}let r=e.children;for(let s=0,o=r.length;s<o;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Kn),Kn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Us),ra.subVectors(this.max,Us),Or.subVectors(e.a,Us),Br.subVectors(e.b,Us),zr.subVectors(e.c,Us),Ni.subVectors(Br,Or),Ui.subVectors(zr,Br),ar.subVectors(Or,zr);let t=[0,-Ni.z,Ni.y,0,-Ui.z,Ui.y,0,-ar.z,ar.y,Ni.z,0,-Ni.x,Ui.z,0,-Ui.x,ar.z,0,-ar.x,-Ni.y,Ni.x,0,-Ui.y,Ui.x,0,-ar.y,ar.x,0];return!du(t,Or,Br,zr,ra)||(t=[1,0,0,0,1,0,0,0,1],!du(t,Or,Br,zr,ra))?!1:(sa.crossVectors(Ni,Ui),t=[sa.x,sa.y,sa.z],du(t,Or,Br,zr,ra))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Kn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Kn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(xi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),xi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),xi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),xi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),xi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),xi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),xi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),xi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(xi),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},xi=[new H,new H,new H,new H,new H,new H,new H,new H],Kn=new H,ia=new kt,Or=new H,Br=new H,zr=new H,Ni=new H,Ui=new H,ar=new H,Us=new H,ra=new H,sa=new H,lr=new H;function du(i,e,t,n,r){for(let s=0,o=i.length-3;s<=o;s+=3){lr.fromArray(i,s);let a=r.x*Math.abs(lr.x)+r.y*Math.abs(lr.y)+r.z*Math.abs(lr.z),l=e.dot(lr),u=t.dot(lr),f=n.dot(lr);if(Math.max(-Math.max(l,u,f),Math.min(l,u,f))>a)return!1}return!0}var yi=Mg();function Mg(){let i=new ArrayBuffer(4),e=new Float32Array(i),t=new Uint32Array(i),n=new Uint32Array(512),r=new Uint32Array(512);for(let l=0;l<256;++l){let u=l-127;u<-27?(n[l]=0,n[l|256]=32768,r[l]=24,r[l|256]=24):u<-14?(n[l]=1024>>-u-14,n[l|256]=1024>>-u-14|32768,r[l]=-u-1,r[l|256]=-u-1):u<=15?(n[l]=u+15<<10,n[l|256]=u+15<<10|32768,r[l]=13,r[l|256]=13):u<128?(n[l]=31744,n[l|256]=64512,r[l]=24,r[l|256]=24):(n[l]=31744,n[l|256]=64512,r[l]=13,r[l|256]=13)}let s=new Uint32Array(2048),o=new Uint32Array(64),a=new Uint32Array(64);for(let l=1;l<1024;++l){let u=l<<13,f=0;for(;(u&8388608)===0;)u<<=1,f-=8388608;u&=-8388609,f+=947912704,s[l]=u|f}for(let l=1024;l<2048;++l)s[l]=939524096+(l-1024<<13);for(let l=1;l<31;++l)o[l]=l<<23;o[31]=1199570944,o[32]=2147483648;for(let l=33;l<63;++l)o[l]=2147483648+(l-32<<23);o[63]=3347054592;for(let l=1;l<64;++l)l!==32&&(a[l]=1024);return{floatView:e,uint32View:t,baseTable:n,shiftTable:r,mantissaTable:s,exponentTable:o,offsetTable:a}}function Tg(i){Math.abs(i)>65504&&Xe("DataUtils.toHalfFloat(): Value out of range."),i=nt(i,-65504,65504),yi.floatView[0]=i;let e=yi.uint32View[0],t=e>>23&511;return yi.baseTable[t]+((e&8388607)>>yi.shiftTable[t])}function wg(i){let e=i>>10;return yi.uint32View[0]=yi.mantissaTable[yi.offsetTable[e]+(i&1023)]+yi.exponentTable[e],yi.floatView[0]}var pe=class{static toHalfFloat(e){return Tg(e)}static fromHalfFloat(e){return wg(e)}},Zt=new H,oa=new Ue,Ag=0,yt=class extends si{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Ag++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=hd,this.updateRanges=[],this.gpuType=tt,this.version=0,this._normalizationScale=e!==void 0?Yu(e):void 0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this._normalizationScale=e._normalizationScale,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)oa.fromBufferAttribute(this,t),oa.applyMatrix3(e),this.setXY(t,oa.x,oa.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Zt.fromBufferAttribute(this,t),Zt.applyMatrix3(e),this.setXYZ(t,Zt.x,Zt.y,Zt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Zt.fromBufferAttribute(this,t),Zt.applyMatrix4(e),this.setXYZ(t,Zt.x,Zt.y,Zt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Zt.fromBufferAttribute(this,t),Zt.applyNormalMatrix(e),this.setXYZ(t,Zt.x,Zt.y,Zt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Zt.fromBufferAttribute(this,t),Zt.transformDirection(e),this.setXYZ(t,Zt.x,Zt.y,Zt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=this._denormalize(n)),n}setComponent(e,t,n){return this.normalized&&(n=this._normalize(n)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=this._denormalize(t)),t}setX(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=this._denormalize(t)),t}setY(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=this._denormalize(t)),t}setZ(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=this._denormalize(t)),t}setW(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),n=this._normalize(n)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),n=this._normalize(n),r=this._normalize(r)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,s){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),n=this._normalize(n),r=this._normalize(r),s=this._normalize(s)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}_denormalize(e){let t=this._normalizationScale;return t!==void 0?Math.max(e/t,-1):hg(e,this.array)}_normalize(e){let t=this._normalizationScale;return t!==void 0?Math.round(e*t):fg(e,this.array)}};var qs=class extends yt{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var Ys=class extends yt{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var Xt=class extends yt{constructor(e,t,n){super(new Float32Array(e),t,n)}},Eg=new kt,Os=new H,pu=new H,Jr=class{constructor(e=new H,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):Eg.setFromPoints(e).getCenter(n);let r=0;for(let s=0,o=e.length;s<o;s++)r=Math.max(r,n.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Os.subVectors(e,this.center);let t=Os.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),r=(n-this.radius)*.5;this.center.addScaledVector(Os,r/n),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(pu.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Os.copy(e.center).add(pu)),this.expandByPoint(Os.copy(e.center).sub(pu))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},Rg=0,Vn=new Ze,mu=new qn,kr=new H,On=new kt,Bs=new kt,nn=new H,Ot=class i extends si{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Rg++}),this.uuid=yo(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(lg(e)?Ys:qs)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let s=new je().getNormalMatrix(e);n.applyNormalMatrix(s),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Vn.makeRotationFromQuaternion(e),this.applyMatrix4(Vn),this}rotateX(e){return Vn.makeRotationX(e),this.applyMatrix4(Vn),this}rotateY(e){return Vn.makeRotationY(e),this.applyMatrix4(Vn),this}rotateZ(e){return Vn.makeRotationZ(e),this.applyMatrix4(Vn),this}translate(e,t,n){return Vn.makeTranslation(e,t,n),this.applyMatrix4(Vn),this}scale(e,t,n){return Vn.makeScale(e,t,n),this.applyMatrix4(Vn),this}lookAt(e){return mu.lookAt(e),mu.updateMatrix(),this.applyMatrix4(mu.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(kr).negate(),this.translate(kr.x,kr.y,kr.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let r=0,s=e.length;r<s;r++){let o=e[r];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new Xt(n,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let s=e[r];t.setXYZ(r,s.x,s.y,s.z||0)}e.length>t.count&&Xe("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new kt);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ke("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new H(-1/0,-1/0,-1/0),new H(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,r=t.length;n<r;n++){let s=t[n];On.setFromBufferAttribute(s),this.morphTargetsRelative?(nn.addVectors(this.boundingBox.min,On.min),this.boundingBox.expandByPoint(nn),nn.addVectors(this.boundingBox.max,On.max),this.boundingBox.expandByPoint(nn)):(this.boundingBox.expandByPoint(On.min),this.boundingBox.expandByPoint(On.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ke('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Jr);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ke("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new H,1/0);return}if(e){let n=this.boundingSphere.center;if(On.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){let a=t[s];Bs.setFromBufferAttribute(a),this.morphTargetsRelative?(nn.addVectors(On.min,Bs.min),On.expandByPoint(nn),nn.addVectors(On.max,Bs.max),On.expandByPoint(nn)):(On.expandByPoint(Bs.min),On.expandByPoint(Bs.max))}On.getCenter(n);let r=0;for(let s=0,o=e.count;s<o;s++)nn.fromBufferAttribute(e,s),r=Math.max(r,n.distanceToSquared(nn));if(t)for(let s=0,o=t.length;s<o;s++){let a=t[s],l=this.morphTargetsRelative;for(let u=0,f=a.count;u<f;u++)nn.fromBufferAttribute(a,u),l&&(kr.fromBufferAttribute(e,u),nn.add(kr)),r=Math.max(r,n.distanceToSquared(nn))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&Ke('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ke("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=t.position,r=t.normal,s=t.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==n.count)&&(o=new yt(new Float32Array(4*n.count),4),this.setAttribute("tangent",o));let a=[],l=[],u=new Uint8Array(n.count);for(let L=0;L<n.count;L++)a[L]=new H,l[L]=new H;let f=new H,h=new H,c=new H,d=new Ue,x=new Ue,S=new Ue,p=new H,g=new H;function y(L,I,N){u[L]=u[I]=u[N]=1,f.fromBufferAttribute(n,L),h.fromBufferAttribute(n,I),c.fromBufferAttribute(n,N),d.fromBufferAttribute(s,L),x.fromBufferAttribute(s,I),S.fromBufferAttribute(s,N),h.sub(f),c.sub(f),x.sub(d),S.sub(d);let U=1/(x.x*S.y-S.x*x.y);isFinite(U)&&(p.copy(h).multiplyScalar(S.y).addScaledVector(c,-x.y).multiplyScalar(U),g.copy(c).multiplyScalar(x.x).addScaledVector(h,-S.x).multiplyScalar(U),a[L].add(p),a[I].add(p),a[N].add(p),l[L].add(g),l[I].add(g),l[N].add(g))}let T=this.groups;T.length===0&&(T=[{start:0,count:e.count}]);for(let L=0,I=T.length;L<I;++L){let N=T[L],U=N.start,z=N.count;for(let D=U,G=U+z;D<G;D+=3)y(e.getX(D+0),e.getX(D+1),e.getX(D+2))}let M=new H,A=new H,E=new H,_=new H;function w(L){E.fromBufferAttribute(r,L),_.copy(E);let I=a[L];M.copy(I),M.sub(E.multiplyScalar(E.dot(I))).normalize(),A.crossVectors(_,I);let U=A.dot(l[L])<0?-1:1;o.setXYZW(L,M.x,M.y,M.z,U)}for(let L=0,I=n.count;L<I;++L)u[L]&&w(L);this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new yt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let c=0,d=n.count;c<d;c++)n.setXYZ(c,0,0,0);let r=new H,s=new H,o=new H,a=new H,l=new H,u=new H,f=new H,h=new H;if(e)for(let c=0,d=e.count;c<d;c+=3){let x=e.getX(c+0),S=e.getX(c+1),p=e.getX(c+2);r.fromBufferAttribute(t,x),s.fromBufferAttribute(t,S),o.fromBufferAttribute(t,p),f.subVectors(o,s),h.subVectors(r,s),f.cross(h),a.fromBufferAttribute(n,x),l.fromBufferAttribute(n,S),u.fromBufferAttribute(n,p),a.add(f),l.add(f),u.add(f),n.setXYZ(x,a.x,a.y,a.z),n.setXYZ(S,l.x,l.y,l.z),n.setXYZ(p,u.x,u.y,u.z)}else for(let c=0,d=t.count;c<d;c+=3)r.fromBufferAttribute(t,c+0),s.fromBufferAttribute(t,c+1),o.fromBufferAttribute(t,c+2),f.subVectors(o,s),h.subVectors(r,s),f.cross(h),n.setXYZ(c+0,f.x,f.y,f.z),n.setXYZ(c+1,f.x,f.y,f.z),n.setXYZ(c+2,f.x,f.y,f.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)nn.fromBufferAttribute(e,t),nn.normalize(),e.setXYZ(t,nn.x,nn.y,nn.z)}toNonIndexed(){function e(a,l){let u=a.array,f=a.itemSize,h=a.normalized,c=new u.constructor(l.length*f),d=0,x=0;for(let S=0,p=l.length;S<p;S++){a.isInterleavedBufferAttribute?d=l[S]*a.data.stride+a.offset:d=l[S]*f;for(let g=0;g<f;g++)c[x++]=u[d++]}return new yt(c,f,h)}if(this.index===null)return Xe("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new i,n=this.index.array,r=this.attributes;for(let a in r){let l=r[a],u=e(l,n);t.setAttribute(a,u)}let s=this.morphAttributes;for(let a in s){let l=[],u=s[a];for(let f=0,h=u.length;f<h;f++){let c=u[f],d=e(c,n);l.push(d)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let u=o[a];t.addGroup(u.start,u.count,u.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let u in l)l[u]!==void 0&&(e[u]=l[u]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let u=n[l];e.data.attributes[l]=u.toJSON(e.data)}let r={},s=!1;for(let l in this.morphAttributes){let u=this.morphAttributes[l],f=[];for(let h=0,c=u.length;h<c;h++){let d=u[h];f.push(d.toJSON(e.data))}f.length>0&&(r[l]=f,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let u in r){let f=r[u];this.setAttribute(u,f.clone(t))}let s=e.morphAttributes;for(let u in s){let f=[],h=s[u];for(let c=0,d=h.length;c<d;c++)f.push(h[c].clone(t));this.morphAttributes[u]=f}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let u=0,f=o.length;u<f;u++){let h=o[u];this.addGroup(h.start,h.count,h.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var gu=new H,Cg=new H,Ig=new je,wn=class{constructor(e=new H(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=gu.subVectors(n,t).cross(Cg.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(gu),s=this.normal.dot(r);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let o=-(e.start.dot(this.normal)+this.constant)/s;return n===!0&&(o<0||o>1)?null:t.copy(e.start).addScaledVector(r,o)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Ig.getNormalMatrix(e),r=this.coplanarPoint(gu).applyMatrix4(e),s=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},Pg=0,ki=class extends si{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Pg++}),this.uuid=yo(),this.name="",this.type="Material",this.blending=oi,this.side=En,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Pu,this.blendDst=Du,this.blendEquation=gr,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Je(0,0,0),this.blendAlpha=0,this.depthFunc=Yr,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=sd,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ba,this.stencilZFail=ba,this.stencilZPass=ba,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){Xe(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){Xe(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(n):r&&r.isVector2&&n&&n.isVector2||r&&r.isEuler&&n&&n.isEuler||r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.diffuseRoughness!==void 0&&(n.diffuseRoughness=this.diffuseRoughness),this.diffuseRoughnessMap&&this.diffuseRoughnessMap.isTexture&&(n.diffuseRoughnessMap=this.diffuseRoughnessMap.toJSON(e).uuid),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessMinimum!==void 0&&(n.iridescenceThicknessMinimum=this.iridescenceThicknessMinimum),this.iridescenceThicknessMaximum!==void 0&&(n.iridescenceThicknessMaximum=this.iridescenceThicknessMaximum),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(s=>s.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(s){let o=[];for(let a in s){let l=s[a];delete l.metadata,o.push(l)}return o}if(t){let s=r(e.textures),o=r(e.images);s.length>0&&(n.textures=s),o.length>0&&(n.images=o)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Je().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.diffuseRoughness!==void 0&&(this.diffuseRoughness=e.diffuseRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessMinimum!==void 0&&(this.iridescenceThicknessMinimum=e.iridescenceThicknessMinimum),e.iridescenceThicknessMaximum!==void 0&&(this.iridescenceThicknessMaximum=e.iridescenceThicknessMaximum),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessMinimum=e.iridescenceThicknessRange[0],this.iridescenceThicknessMaximum=e.iridescenceThicknessRange[1]),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(n=>new wn().fromJSON(n))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new Ue().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Ue().fromArray(e.clearcoatNormalScale)),e.diffuseRoughnessMap!==void 0&&(this.diffuseRoughnessMap=t[e.diffuseRoughnessMap]||null),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let r=t.length;n=new Array(r);for(let s=0;s!==r;++s)n[s]=t[s].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var vi=new H,xu=new H,aa=new H,la=new H,Kr=class{constructor(e=new H,t=new H(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,vi)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=vi.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(vi.copy(this.origin).addScaledVector(this.direction,t),vi.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){xu.copy(e).add(t).multiplyScalar(.5),aa.copy(t).sub(e).normalize(),la.copy(this.origin).sub(xu);let s=e.distanceTo(t)*.5,o=-this.direction.dot(aa),a=la.dot(this.direction),l=-la.dot(aa),u=la.lengthSq(),f=Math.abs(1-o*o),h,c,d,x;if(f>0)if(h=o*l-a,c=o*a-l,x=s*f,h>=0)if(c>=-x)if(c<=x){let S=1/f;h*=S,c*=S,d=h*(h+o*c+2*a)+c*(o*h+c+2*l)+u}else c=s,h=Math.max(0,-(o*c+a)),d=-h*h+c*(c+2*l)+u;else c=-s,h=Math.max(0,-(o*c+a)),d=-h*h+c*(c+2*l)+u;else c<=-x?(h=Math.max(0,-(-o*s+a)),c=h>0?-s:Math.min(Math.max(-s,-l),s),d=-h*h+c*(c+2*l)+u):c<=x?(h=0,c=Math.min(Math.max(-s,-l),s),d=c*(c+2*l)+u):(h=Math.max(0,-(o*s+a)),c=h>0?s:Math.min(Math.max(-s,-l),s),d=-h*h+c*(c+2*l)+u);else c=o>0?-s:s,h=Math.max(0,-(o*c+a)),d=-h*h+c*(c+2*l)+u;return n&&n.copy(this.origin).addScaledVector(this.direction,h),r&&r.copy(xu).addScaledVector(aa,c),d}intersectSphere(e,t){if(e.radius<0)return null;vi.subVectors(e.center,this.origin);let n=vi.dot(this.direction),r=vi.dot(vi)-n*n,s=e.radius*e.radius;if(r>s)return null;let o=Math.sqrt(s-r),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,s,o,a,l,u=1/this.direction.x,f=1/this.direction.y,h=1/this.direction.z,c=this.origin;return u>=0?(n=(e.min.x-c.x)*u,r=(e.max.x-c.x)*u):(n=(e.max.x-c.x)*u,r=(e.min.x-c.x)*u),f>=0?(s=(e.min.y-c.y)*f,o=(e.max.y-c.y)*f):(s=(e.max.y-c.y)*f,o=(e.min.y-c.y)*f),n>o||s>r||((s>n||isNaN(n))&&(n=s),(o<r||isNaN(r))&&(r=o),h>=0?(a=(e.min.z-c.z)*h,l=(e.max.z-c.z)*h):(a=(e.max.z-c.z)*h,l=(e.min.z-c.z)*h),n>l||a>r)||((a>n||n!==n)&&(n=a),(l<r||r!==r)&&(r=l),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,vi)!==null}intersectTriangle(e,t,n,r,s){let o=this.origin,a=this.direction,l=a.x,u=a.y,f=a.z,h=e.x-o.x,c=e.y-o.y,d=e.z-o.z,x=t.x-o.x,S=t.y-o.y,p=t.z-o.z,g=n.x-o.x,y=n.y-o.y,T=n.z-o.z,M=Math.abs(l),A=Math.abs(u),E=Math.abs(f),_,w,L,I,N,U,z,D,G,W,Z,le;if(M>=A&&M>=E?(L=l,U=h,G=x,le=g,l>=0?(_=u,w=f,I=c,N=d,z=S,D=p,W=y,Z=T):(_=f,w=u,I=d,N=c,z=p,D=S,W=T,Z=y)):A>=E?(L=u,U=c,G=S,le=y,u>=0?(_=f,w=l,I=d,N=h,z=p,D=x,W=T,Z=g):(_=l,w=f,I=h,N=d,z=x,D=p,W=g,Z=T)):(L=f,U=d,G=p,le=T,f>=0?(_=l,w=u,I=h,N=c,z=x,D=S,W=g,Z=y):(_=u,w=l,I=c,N=h,z=S,D=x,W=y,Z=g)),L===0)return null;let J=_/L,se=w/L,ae=1/L,ye=I-J*U,Le=N-se*U,j=z-J*G,he=D-se*G,Ce=W-J*le,Oe=Z-se*le,fe=Ce*he-Oe*j,ke=ye*Oe-Le*Ce,mt=j*Le-he*ye;if(r){if(fe<0||ke<0||mt<0)return null}else if((fe<0||ke<0||mt<0)&&(fe>0||ke>0||mt>0))return null;let Be=fe+ke+mt;if(Be===0)return null;let at=ae*(fe*U+ke*G+mt*le);return(Be>0?at<0:at>0)?null:this.at(at/Be,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Qr=class extends ki{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Je(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ti,this.combine=Lu,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},bf=new Ze,cr=new Kr,ca=new Jr,Mf=new H,ua=new H,ha=new H,fa=new H,vu=new H,da=new H,Tf=new H,pa=new H,xn=class extends qn{constructor(e=new Ot,t=new Qr){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0?this.morphTargetInfluences=e.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,e.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let r=t[n[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){let a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,s=n.morphAttributes.position,o=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let a=this.morphTargetInfluences;if(s&&a){da.set(0,0,0);for(let l=0,u=s.length;l<u;l++){let f=a[l],h=s[l];f!==0&&(vu.fromBufferAttribute(h,e),o?da.addScaledVector(vu,f):da.addScaledVector(vu.sub(t),f))}t.add(da)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),ca.copy(n.boundingSphere),ca.applyMatrix4(s),cr.copy(e.ray).recast(e.near),!(ca.containsPoint(cr.origin)===!1&&(cr.intersectSphere(ca,Mf)===null||cr.origin.distanceToSquared(Mf)>(e.far-e.near)**2))&&(bf.copy(s).invert(),cr.copy(e.ray).applyMatrix4(bf),!(n.boundingBox!==null&&cr.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,cr)))}_computeIntersections(e,t,n){let r,s=this.geometry,o=this.material,a=s.index,l=s.attributes.position,u=s.attributes.uv,f=s.attributes.uv1,h=s.attributes.normal,c=s.groups,d=s.drawRange;if(a!==null)if(Array.isArray(o))for(let x=0,S=c.length;x<S;x++){let p=c[x],g=o[p.materialIndex],y=Math.max(p.start,d.start),T=Math.min(a.count,Math.min(p.start+p.count,d.start+d.count));for(let M=y,A=T;M<A;M+=3){let E=a.getX(M),_=a.getX(M+1),w=a.getX(M+2);r=ma(this,g,e,n,u,f,h,E,_,w),r&&(r.faceIndex=Math.floor(M/3),r.face.materialIndex=p.materialIndex,t.push(r))}}else{let x=Math.max(0,d.start),S=Math.min(a.count,d.start+d.count);for(let p=x,g=S;p<g;p+=3){let y=a.getX(p),T=a.getX(p+1),M=a.getX(p+2);r=ma(this,o,e,n,u,f,h,y,T,M),r&&(r.faceIndex=Math.floor(p/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(o))for(let x=0,S=c.length;x<S;x++){let p=c[x],g=o[p.materialIndex],y=Math.max(p.start,d.start),T=Math.min(l.count,Math.min(p.start+p.count,d.start+d.count));for(let M=y,A=T;M<A;M+=3){let E=M,_=M+1,w=M+2;r=ma(this,g,e,n,u,f,h,E,_,w),r&&(r.faceIndex=Math.floor(M/3),r.face.materialIndex=p.materialIndex,t.push(r))}}else{let x=Math.max(0,d.start),S=Math.min(l.count,d.start+d.count);for(let p=x,g=S;p<g;p+=3){let y=p,T=p+1,M=p+2;r=ma(this,o,e,n,u,f,h,y,T,M),r&&(r.faceIndex=Math.floor(p/3),t.push(r))}}}};function Dg(i,e,t,n,r,s,o,a){let l;if(e.side===Kt?l=n.intersectTriangle(o,s,r,!0,a):l=n.intersectTriangle(r,s,o,e.side===En,a),l===null)return null;pa.copy(a),pa.applyMatrix4(i.matrixWorld);let u=t.ray.origin.distanceTo(pa);return u<t.near||u>t.far?null:{distance:u,point:pa.clone(),object:i}}function ma(i,e,t,n,r,s,o,a,l,u){i.getVertexPosition(a,ua),i.getVertexPosition(l,ha),i.getVertexPosition(u,fa);let f=Dg(i,e,t,n,ua,ha,fa,Tf);if(f){let h=new H;gn.getBarycoord(Tf,ua,ha,fa,h),r&&(f.uv=gn.getInterpolatedAttribute(r,a,l,u,h,new Ue)),s&&(f.uv1=gn.getInterpolatedAttribute(s,a,l,u,h,new Ue)),o&&(f.normal=gn.getInterpolatedAttribute(o,a,l,u,h,new H),f.normal.dot(n.direction)>0&&f.normal.multiplyScalar(-1));let c={a,b:l,c:u,normal:new H,materialIndex:0};gn.getNormal(ua,ha,fa,c.normal),f.face=c,f.barycoord=h}return f}var Rt=class extends Dn{constructor(e=null,t=1,n=1,r,s,o,a,l,u=Qe,f=Qe,h,c){super(null,o,a,l,u,f,r,s,h,c),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var ur=new Jr,Lg=new Ue(.5,.5),ga=new H,dr=class{constructor(e=new wn,t=new wn,n=new wn,r=new wn,s=new wn,o=new wn){this.planes=[e,t,n,r,s,o]}set(e,t,n,r,s,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Wn,n=!1){let r=this.planes,s=e.elements,o=s[0],a=s[1],l=s[2],u=s[3],f=s[4],h=s[5],c=s[6],d=s[7],x=s[8],S=s[9],p=s[10],g=s[11],y=s[12],T=s[13],M=s[14],A=s[15];if(r[0].setComponents(u-o,d-f,g-x,A-y).normalize(),r[1].setComponents(u+o,d+f,g+x,A+y).normalize(),r[2].setComponents(u+a,d+h,g+S,A+T).normalize(),r[3].setComponents(u-a,d-h,g-S,A-T).normalize(),n)r[4].setComponents(l,c,p,M).normalize(),r[5].setComponents(u-l,d-c,g-p,A-M).normalize();else if(r[4].setComponents(u-l,d-c,g-p,A-M).normalize(),t===Wn)r[5].setComponents(u+l,d+c,g+p,A+M).normalize();else if(t===Hs)r[5].setComponents(l,c,p,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),ur.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),ur.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ur)}intersectsSprite(e){ur.center.set(0,0,0);let t=Lg.distanceTo(e.center);return ur.radius=.7071067811865476+t,ur.applyMatrix4(e.matrixWorld),this.intersectsSphere(ur)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(ga.x=r.normal.x>0?e.max.x:e.min.x,ga.y=r.normal.y>0?e.max.y:e.min.y,ga.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(ga)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},wf=new Ze,Ua=class i{constructor(){this.coordinateSystem=Wn,this._frustums=[],this._count=0}setFromArrayCamera(e){let t=e.cameras,n=this._frustums;for(let r=0;r<t.length;r++){let s=t[r];wf.multiplyMatrices(s.projectionMatrix,s.matrixWorldInverse),n[r]===void 0&&(n[r]=new dr),n[r].setFromProjectionMatrix(wf,s.coordinateSystem,s.reversedDepth)}return this._count=t.length,this}getFrustum(e){return this._frustums[e]}intersectsObject(e){let t=this._frustums;for(let n=0;n<this._count;n++)if(t[n].intersectsObject(e))return!0;return!1}intersectsSprite(e){let t=this._frustums;for(let n=0;n<this._count;n++)if(t[n].intersectsSprite(e))return!0;return!1}intersectsSphere(e){let t=this._frustums;for(let n=0;n<this._count;n++)if(t[n].intersectsSphere(e))return!0;return!1}intersectsBox(e){let t=this._frustums;for(let n=0;n<this._count;n++)if(t[n].intersectsBox(e))return!0;return!1}containsPoint(e){let t=this._frustums;for(let n=0;n<this._count;n++)if(t[n].containsPoint(e))return!0;return!1}copy(e){this.coordinateSystem=e.coordinateSystem;let t=this._frustums,n=e._frustums;for(let r=0;r<e._count;r++)t[r]===void 0&&(t[r]=new dr),t[r].copy(n[r]);return this._count=e._count,this}clone(){return new i().copy(this)}};var Zs=class extends Dn{constructor(e=[],t=xr,n,r,s,o,a,l,u,f){super(e,t,n,r,s,o,a,l,u,f),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}};var wi=class extends Dn{constructor(e,t,n=on,r,s,o,a=Qe,l=Qe,u,f=Mi,h=1){if(f!==Mi&&f!==Ai)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let c={width:e,height:t,depth:h};super(c,r,s,o,a,l,f,n,u),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new hr(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},$s=class extends wi{constructor(e,t=on,n=xr,r,s,o=Qe,a=Qe,l,u=Mi){let f={width:e,height:e,depth:1},h=[f,f,f,f,f,f];super(e,e,t,n,r,s,o,a,l,u),this.image=h,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Js=class extends Dn{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},jr=class i extends Ot{constructor(e=1,t=1,n=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:s,depthSegments:o};let a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);let l=[],u=[],f=[],h=[],c=0,d=0;x("z","y","x",-1,-1,n,t,e,o,s,0),x("z","y","x",1,-1,n,t,-e,o,s,1),x("x","z","y",1,1,e,n,t,r,o,2),x("x","z","y",1,-1,e,n,-t,r,o,3),x("x","y","z",1,-1,e,t,n,r,s,4),x("x","y","z",-1,-1,e,t,-n,r,s,5),this.setIndex(l),this.setAttribute("position",new Xt(u,3)),this.setAttribute("normal",new Xt(f,3)),this.setAttribute("uv",new Xt(h,2));function x(S,p,g,y,T,M,A,E,_,w,L){let I=M/_,N=A/w,U=M/2,z=A/2,D=E/2,G=_+1,W=w+1,Z=0,le=0,J=new H;for(let se=0;se<W;se++){let ae=se*N-z;for(let ye=0;ye<G;ye++){let Le=ye*I-U;J[S]=Le*y,J[p]=ae*T,J[g]=D,u.push(J.x,J.y,J.z),J[S]=0,J[p]=0,J[g]=E>0?1:-1,f.push(J.x,J.y,J.z),h.push(ye/_),h.push(1-se/w),Z+=1}}for(let se=0;se<w;se++)for(let ae=0;ae<_;ae++){let ye=c+ae+G*se,Le=c+ae+G*(se+1),j=c+(ae+1)+G*(se+1),he=c+(ae+1)+G*se;l.push(ye,Le,he),l.push(Le,j,he),le+=6}a.addGroup(d,le,L),d+=le,c+=Z}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var Ks=class i extends Ot{constructor(e=1,t=32,n=0,r=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:r},t=Math.max(3,t);let s=[],o=[],a=[],l=[],u=new H,f=new Ue;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let h=0,c=3;h<=t;h++,c+=3){let d=n+h/t*r;u.x=e*Math.cos(d),u.y=e*Math.sin(d),o.push(u.x,u.y,u.z),a.push(0,0,1),f.x=(o[c]/e+1)/2,f.y=(o[c+1]/e+1)/2,l.push(f.x,f.y)}for(let h=1;h<=t;h++)s.push(h,h+1,0);this.setIndex(s),this.setAttribute("position",new Xt(o,3)),this.setAttribute("normal",new Xt(a,3)),this.setAttribute("uv",new Xt(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.segments,e.thetaStart,e.thetaLength)}};var Qs=class i extends Ot{constructor(e=[new Ue(0,-.5),new Ue(.5,0),new Ue(0,.5)],t=12,n=0,r=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:r},t=Math.floor(t),r=nt(r,0,Math.PI*2);let s=[],o=[],a=[],l=[],u=[],f=1/t,h=new H,c=new Ue,d=new H,x=new H,S=new H,p=0,g=0;for(let y=0;y<=e.length-1;y++)switch(y){case 0:p=e[y+1].x-e[y].x,g=e[y+1].y-e[y].y,d.x=g*1,d.y=-p,d.z=g*0,S.copy(d),d.normalize(),l.push(d.x,d.y,d.z);break;case e.length-1:S.normalize(),l.push(S.x,S.y,S.z);break;default:p=e[y+1].x-e[y].x,g=e[y+1].y-e[y].y,d.x=g*1,d.y=-p,d.z=g*0,x.copy(d),d.x+=S.x,d.y+=S.y,d.z+=S.z,d.normalize(),l.push(d.x,d.y,d.z),S.copy(x)}for(let y=0;y<=t;y++){let T=n+y*f*r,M=Math.sin(T),A=Math.cos(T);for(let E=0;E<=e.length-1;E++){h.x=e[E].x*M,h.y=e[E].y,h.z=e[E].x*A,o.push(h.x,h.y,h.z),c.x=y/t,c.y=E/(e.length-1),a.push(c.x,c.y);let _=l[3*E+0]*M,w=l[3*E+1],L=l[3*E+0]*A;u.push(_,w,L)}}for(let y=0;y<t;y++)for(let T=0;T<e.length-1;T++){let M=T+y*e.length,A=M,E=M+e.length,_=M+e.length+1,w=M+1;s.push(A,E,w),s.push(_,w,E)}this.setIndex(s),this.setAttribute("position",new Xt(o,3)),this.setAttribute("uv",new Xt(a,2)),this.setAttribute("normal",new Xt(u,3))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.points,e.segments,e.phiStart,e.phiLength)}};var pr=class i extends Ot{constructor(e=1,t=1,n=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let s=e/2,o=t/2,a=Math.floor(n),l=Math.floor(r),u=a+1,f=l+1,h=e/a,c=t/l,d=[],x=[],S=[],p=[];for(let g=0;g<f;g++){let y=g*c-o;for(let T=0;T<u;T++){let M=T*h-s;x.push(M,-y,0),S.push(0,0,1),p.push(T/a),p.push(1-g/l)}}for(let g=0;g<l;g++)for(let y=0;y<a;y++){let T=y+u*g,M=y+u*(g+1),A=y+1+u*(g+1),E=y+1+u*g;d.push(T,M,E),d.push(M,A,E)}this.setIndex(d),this.setAttribute("position",new Xt(x,3)),this.setAttribute("normal",new Xt(S,3)),this.setAttribute("uv",new Xt(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.widthSegments,e.heightSegments)}};function _r(i){let e={};for(let t in i){e[t]={};for(let n in i[t]){let r=i[t][n];if(Af(r))r.isRenderTargetTexture?(Xe("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=r.clone();else if(Array.isArray(r))if(Af(r[0])){let s=[];for(let o=0,a=r.length;o<a;o++)s[o]=r[o].clone();e[t][n]=s}else e[t][n]=r.slice();else e[t][n]=r}}return e}function yn(i){let e={};for(let t=0;t<i.length;t++){let n=_r(i[t]);for(let r in n)e[r]=n[r]}return e}function Af(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function Fg(i){let e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Zu(i){let e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:dt.workingColorSpace}var vd={clone:_r,merge:yn},Ng=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Ug=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,$t=class extends ki{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Ng,this.fragmentShader=Ug,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=_r(e.uniforms),this.uniformsGroups=Fg(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let o=this.uniforms[r].value;o&&o.isTexture?t.uniforms[r]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[r]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[r]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[r]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[r]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[r]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[r]={type:"m4",value:o.toArray()}:t.uniforms[r]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let r in this.extensions)this.extensions[r]===!0&&(n[r]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let r=e.uniforms[n];switch(this.uniforms[n]={},r.type){case"t":this.uniforms[n].value=t[r.value]||null;break;case"c":this.uniforms[n].value=new Je().setHex(r.value);break;case"v2":this.uniforms[n].value=new Ue().fromArray(r.value);break;case"v3":this.uniforms[n].value=new H().fromArray(r.value);break;case"v4":this.uniforms[n].value=new St().fromArray(r.value);break;case"m3":this.uniforms[n].value=new je().fromArray(r.value);break;case"m4":this.uniforms[n].value=new Ze().fromArray(r.value);break;default:this.uniforms[n].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Oa=class extends $t{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},es=class extends ki{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Je(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Je(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Dl,this.normalScale=new Ue(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ti,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},js=class extends es{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new Ue(1,1),this.clearcoatNormalMap=null,this.diffuseRoughnessMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return nt(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessMinimum=100,this.iridescenceThicknessMaximum=400,this.iridescenceThicknessMap=null,this.sheenColor=new Je(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Je(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Je(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._diffuseRoughness=0,this._dispersion=0,this._iridescence=0,this._retroreflectivity=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get diffuseRoughness(){return this._diffuseRoughness}set diffuseRoughness(e){this._diffuseRoughness>0!=e>0&&this.version++,this._diffuseRoughness=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get retroreflectivity(){return this._retroreflectivity}set retroreflectivity(e){this._retroreflectivity>0!=e>0&&this.version++,this._retroreflectivity=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}get iridescenceThicknessRange(){return Bi('MeshPhysicalMaterial: The "iridescenceThicknessRange" property has been replaced by "iridescenceThicknessMinimum" and "iridescenceThicknessMaximum".'),[this.iridescenceThicknessMinimum,this.iridescenceThicknessMaximum]}set iridescenceThicknessRange(e){Bi('MeshPhysicalMaterial: The "iridescenceThicknessRange" property has been replaced by "iridescenceThicknessMinimum" and "iridescenceThicknessMaximum".'),this.iridescenceThicknessMinimum=e[0],this.iridescenceThicknessMaximum=e[1]}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.diffuseRoughness=e.diffuseRoughness,this.diffuseRoughnessMap=e.diffuseRoughnessMap,this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessMinimum=e.iridescenceThicknessMinimum,this.iridescenceThicknessMaximum=e.iridescenceThicknessMaximum,this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.retroreflectivity=e.retroreflectivity,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};var Ba=class extends ki{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=id,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},za=class extends ki{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function Hr(i,e){return!i||i.constructor===e?i:typeof e.BYTES_PER_ELEMENT=="number"?new e(i):Array.prototype.slice.call(i)}function xa(i){return i!==void 0&&i.inTangents!==void 0&&i.outTangents!==void 0}var Hi=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],s=t[n-1];n:{e:{let o;t:{i:if(!(e<r)){for(let a=n+2;;){if(r===void 0){if(e<s)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(s=r,r=t[++n],e<r)break e}o=t.length;break t}if(!(e>=s)){let a=t[1];e<a&&(n=2,s=a);for(let l=n-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(r=s,s=t[--n-1],e>=s)break e}o=n,n=0;break t}break n}for(;n<o;){let a=n+o>>>1;e<t[a]?o=a:n=a+1}if(r=t[n],s=t[n-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,s,r)}return this.interpolate_(n,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,s=e*r;for(let o=0;o!==r;++o)t[o]=n[s+o];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},ka=class extends Hi{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Su,endingEnd:Su}}intervalChanged_(e,t,n){let r=this.parameterPositions,s=e-2,o=e+1,a=r[s],l=r[o];if(a===void 0)switch(this.getSettings_().endingStart){case bu:s=e,a=2*t-n;break;case Mu:s=r.length-2,a=t+r[s]-r[s+1];break;default:s=e,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case bu:o=e,l=2*n-t;break;case Mu:o=1,l=n+r[1]-r[0];break;default:o=e-1,l=t}let u=(n-t)*.5,f=this.valueSize;this._weightPrev=u/(t-a),this._weightNext=u/(l-n),this._offsetPrev=s*f,this._offsetNext=o*f}interpolate_(e,t,n,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,u=l-a,f=this._offsetPrev,h=this._offsetNext,c=this._weightPrev,d=this._weightNext,x=(n-t)/(r-t),S=x*x,p=S*x,g=-c*p+2*c*S-c*x,y=(1+c)*p+(-1.5-2*c)*S+(-.5+c)*x+1,T=(-1-d)*p+(1.5+d)*S+.5*x,M=d*p-d*S;for(let A=0;A!==a;++A)s[A]=g*o[f+A]+y*o[u+A]+T*o[l+A]+M*o[h+A];return s}},Ha=class extends Hi{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,u=l-a,f=(n-t)/(r-t),h=1-f;for(let c=0;c!==a;++c)s[c]=o[u+c]*h+o[l+c]*f;return s}},Ga=class extends Hi{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},Va=class extends Hi{interpolate_(e,t,n,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,u=l-a,f=this.inTangents,h=this.outTangents;if(!f||!h){let x=(n-t)/(r-t),S=1-x;for(let p=0;p!==a;++p)s[p]=o[u+p]*S+o[l+p]*x;return s}let c=a*2,d=e-1;for(let x=0;x!==a;++x){let S=o[u+x],p=o[l+x],g=d*c+x*2,y=h[g],T=h[g+1],M=e*c+x*2,A=f[M],E=f[M+1],_=Bg(n,t,y,A,r);s[x]=_d(_,S,T,E,p)}return s}};function _d(i,e,t,n,r){let s=1-i;return s*s*s*e+3*s*s*i*t+3*s*i*i*n+i*i*i*r}function Og(i,e,t,n,r){let s=1-i;return 3*s*s*(t-e)+6*s*i*(n-t)+3*i*i*(r-n)}function Bg(i,e,t,n,r){let s=(i-e)/(r-e);for(let o=0;o<8;o++){let a=_d(s,e,t,n,r)-i;if(Math.abs(a)<1e-10)break;let l=Og(s,e,t,n,r);if(Math.abs(l)<1e-10)break;s=Math.max(0,Math.min(1,s-a/l))}return s}var Bn=class{constructor(e,t,n,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Hr(t,this.TimeBufferType),this.values=Hr(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Hr(e.times,Array),values:Hr(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(n.interpolation=r),xa(e.settings)&&(n.settings={inTangents:Hr(e.settings.inTangents,Array),outTangents:Hr(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Ga(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Ha(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new ka(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new Va(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case zs:t=this.InterpolantFactoryMethodDiscrete;break;case Pa:t=this.InterpolantFactoryMethodLinear;break;case Sa:t=this.InterpolantFactoryMethodSmooth;break;case yu:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Xe("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return zs;case this.InterpolantFactoryMethodLinear:return Pa;case this.InterpolantFactoryMethodSmooth:return Sa;case this.InterpolantFactoryMethodBezier:return yu}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e;xa(this.settings)&&(Ef(this.settings.inTangents,e),Ef(this.settings.outTangents,e))}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e;xa(this.settings)&&(Rf(this.settings.inTangents,e),Rf(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,r=n.length,s=0,o=r-1;for(;s!==r&&n[s]<e;)++s;for(;o!==-1&&n[o]>t;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);let a=this.getValueSize();this.times=n.slice(s,o),this.values=this.values.slice(s*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Ke("KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,r=this.values,s=n.length;s===0&&(Ke("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){Ke("KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){Ke("KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(r!==void 0&&cg(r))for(let a=0,l=r.length;a!==l;++a){let u=r[a];if(isNaN(u)){Ke("KeyframeTrack: Value is not a valid number.",this,a,u),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===Sa,s=e.length-1,o=1;for(let a=1;a<s;++a){let l=!1,u=e[a],f=e[a+1];if(u!==f&&(a!==1||u!==e[0]))if(r)l=!0;else{let h=a*n,c=h-n,d=h+n;for(let x=0;x!==n;++x){let S=t[h+x];if(S!==t[c+x]||S!==t[d+x]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let h=a*n,c=o*n;for(let d=0;d!==n;++d)t[c+d]=t[h+d]}++o}}if(s>0){e[o]=e[s];for(let a=s*n,l=o*n,u=0;u!==n;++u)t[l+u]=t[a+u];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,xa(this.settings)&&(r.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),r}};function Ef(i,e){for(let t=0,n=i.length;t!==n;t+=2)i[t]+=e}function Rf(i,e){for(let t=0,n=i.length;t!==n;t+=2)i[t]*=e}Bn.prototype.ValueTypeName="";Bn.prototype.TimeBufferType=Float32Array;Bn.prototype.ValueBufferType=Float32Array;Bn.prototype.DefaultInterpolation=Pa;var Gi=class extends Bn{constructor(e,t,n){super(e,t,n)}};Gi.prototype.ValueTypeName="bool";Gi.prototype.ValueBufferType=Array;Gi.prototype.DefaultInterpolation=zs;Gi.prototype.InterpolantFactoryMethodLinear=void 0;Gi.prototype.InterpolantFactoryMethodSmooth=void 0;var Wa=class extends Bn{constructor(e,t,n,r){super(e,t,n,r)}};Wa.prototype.ValueTypeName="color";var Xa=class extends Bn{constructor(e,t,n,r){super(e,t,n,r)}};Xa.prototype.ValueTypeName="number";var qa=class extends Hi{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(n-t)/(r-t),u=e*a;for(let f=u+a;u!==f;u+=4)Xn.slerpFlat(s,0,o,u-a,o,u,l);return s}},eo=class extends Bn{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new qa(this.times,this.values,this.getValueSize(),e)}};eo.prototype.ValueTypeName="quaternion";eo.prototype.InterpolantFactoryMethodSmooth=void 0;var Vi=class extends Bn{constructor(e,t,n){super(e,t,n)}};Vi.prototype.ValueTypeName="string";Vi.prototype.ValueBufferType=Array;Vi.prototype.DefaultInterpolation=zs;Vi.prototype.InterpolantFactoryMethodLinear=void 0;Vi.prototype.InterpolantFactoryMethodSmooth=void 0;var Ya=class extends Bn{constructor(e,t,n,r){super(e,t,n,r)}};Ya.prototype.ValueTypeName="vector";var Tu={enabled:!1,files:{},add:function(i,e){this.enabled!==!1&&(Cf(i)||(this.files[i]=e))},get:function(i){if(this.enabled!==!1&&!Cf(i))return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}};function Cf(i){try{let e=i.slice(i.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}var Za=class{constructor(e,t,n){let r=this,s=!1,o=0,a=0,l,u=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(f){a++,s===!1&&r.onStart!==void 0&&r.onStart(f,o,a),s=!0},this.itemEnd=function(f){o++,r.onProgress!==void 0&&r.onProgress(f,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(f){r.onError!==void 0&&r.onError(f)},this.resolveURL=function(f){return f=f.normalize("NFC"),l?l(f):f},this.setURLModifier=function(f){return l=f,this},this.addHandler=function(f,h){return u.push(f,h),this},this.removeHandler=function(f){let h=u.indexOf(f);return h!==-1&&u.splice(h,2),this},this.getHandler=function(f){for(let h=0,c=u.length;h<c;h+=2){let d=u[h],x=u[h+1];if(d.global&&(d.lastIndex=0),d.test(f))return x}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},yd=new Za,ts=class{constructor(e){this.manager=e!==void 0?e:yd,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},this.priority="auto",this.cache="default",typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(r,s){n.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}setPriority(e){return this.priority=e,this}setCache(e){return this.cache=e,this}abort(){return this}};ts.DEFAULT_MATERIAL_NAME="__DEFAULT";var _i={},wu=class extends Error{constructor(e,t){super(e),this.response=t}},$a=class extends ts{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,n,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=Tu.get(`file:${e}`);if(s!==void 0){this.manager.itemStart(e),setTimeout(()=>{t&&t(s),this.manager.itemEnd(e)},0);return}if(_i[e]!==void 0){_i[e].push({onLoad:t,onProgress:n,onError:r});return}_i[e]=[],_i[e].push({onLoad:t,onProgress:n,onError:r});let o=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",priority:this.priority,cache:this.cache,signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),a=this.mimeType,l=this.responseType;fetch(o).then(u=>{if(u.status===200||u.status===0){if(u.status===0&&Xe("FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||u.body===void 0||u.body.getReader===void 0)return u;let f=_i[e],h=u.body.getReader(),c=u.headers.get("X-File-Size")||u.headers.get("Content-Length"),d=c?parseInt(c):0,x=d!==0,S=0,p=new ReadableStream({start(g){y();function y(){h.read().then(({done:T,value:M})=>{if(T)g.close();else{S+=M.byteLength;let A=new ProgressEvent("progress",{lengthComputable:x,loaded:S,total:d});for(let E=0,_=f.length;E<_;E++){let w=f[E];w.onProgress&&w.onProgress(A)}g.enqueue(M),y()}},T=>{g.error(T)})}}});return new Response(p)}else throw new wu(`fetch for "${u.url}" responded with ${u.status}: ${u.statusText}`,u)}).then(u=>{switch(l){case"arraybuffer":return u.arrayBuffer();case"blob":return u.blob();case"document":return u.text().then(f=>new DOMParser().parseFromString(f,a));case"json":return u.json();default:if(a==="")return u.text();{let h=/charset="?([^;"\s]*)"?/i.exec(a),c=h&&h[1]?h[1].toLowerCase():void 0,d=new TextDecoder(c);return u.arrayBuffer().then(x=>d.decode(x))}}}).then(u=>{Tu.add(`file:${e}`,u);let f=_i[e];delete _i[e];for(let h=0,c=f.length;h<c;h++){let d=f[h];d.onLoad&&d.onLoad(u)}}).catch(u=>{let f=_i[e];if(f===void 0)throw this.manager.itemError(e),u;delete _i[e];for(let h=0,c=f.length;h<c;h++){let d=f[h];d.onError&&d.onError(u)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var mr=class extends ts{constructor(e){super(e)}load(e,t,n,r){let s=this,o=new Rt,a=new $a(this.manager);return a.setPriority(this.priority),a.setCache(this.cache),a.setResponseType("arraybuffer"),a.setRequestHeader(this.requestHeader),a.setPath(this.path),a.setWithCredentials(s.withCredentials),a.load(e,function(l){let u;try{u=s.parse(l)}catch(f){r!==void 0?r(f):Ke(f);return}s._applyTexData(o,u),t&&t(o,u)},n,r),o}createDataTexture(e){let t=new Rt;return this._applyTexData(t,this.parse(e)),t}_applyTexData(e,t){t.image!==void 0?e.image=t.image:t.data!==void 0&&(e.image.width=t.width,e.image.height=t.height,e.image.data=t.data),e.wrapS=t.wrapS!==void 0?t.wrapS:Pt,e.wrapT=t.wrapT!==void 0?t.wrapT:Pt,e.magFilter=t.magFilter!==void 0?t.magFilter:lt,e.minFilter=t.minFilter!==void 0?t.minFilter:lt,e.anisotropy=t.anisotropy!==void 0?t.anisotropy:1,t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.mipmaps!==void 0&&(e.mipmaps=t.mipmaps,e.minFilter=li),t.mipmapCount===1&&(e.minFilter=lt),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),e.needsUpdate=!0}};var va=new H,_a=new Xn,ri=new H,to=class extends qn{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ze,this.projectionMatrix=new Ze,this.projectionMatrixInverse=new Ze,this.coordinateSystem=Wn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(va,_a,ri),ri.x===1&&ri.y===1&&ri.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(va,_a,ri.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(va,_a,ri),ri.x===1&&ri.y===1&&ri.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(va,_a,ri.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Oi=new H,If=new Ue,Pf=new Ue,cn=class extends to{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Da*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Qc*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Da*2*Math.atan(Math.tan(Qc*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Oi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Oi.x,Oi.y).multiplyScalar(-e/Oi.z),Oi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Oi.x,Oi.y).multiplyScalar(-e/Oi.z)}getViewSize(e,t){return this.getViewBounds(e,If,Pf),t.subVectors(Pf,If)}setViewOffset(e,t,n,r,s,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Qc*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,s=-.5*r,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,u=o.fullHeight;s+=o.offsetX*r/l,t-=o.offsetY*n/u,r*=o.width/l,n*=o.height/u}let a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var Wi=class extends to{constructor(e=-1,t=1,n=1,r=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,s=n-e,o=n+e,a=r+t,l=r-t;if(this.view!==null&&this.view.enabled){let u=(this.right-this.left)/this.view.fullWidth/this.zoom,f=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=u*this.view.offsetX,o=s+u*this.view.width,a-=f*this.view.offsetY,l=a-f*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}};var Gr=-90,Vr=1,ns=class extends qn{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new cn(Gr,Vr,e,t);r.layers=this.layers,this.add(r);let s=new cn(Gr,Vr,e,t);s.layers=this.layers,this.add(s);let o=new cn(Gr,Vr,e,t);o.layers=this.layers,this.add(o);let a=new cn(Gr,Vr,e,t);a.layers=this.layers,this.add(a);let l=new cn(Gr,Vr,e,t);l.layers=this.layers,this.add(l);let u=new cn(Gr,Vr,e,t);u.layers=this.layers,this.add(u)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,s,o,a,l]=t;for(let u of t)this.remove(u);if(e===Wn)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Hs)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let u of t)this.add(u),u.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[s,o,a,l,u,f]=this.children,h=e.getRenderTarget(),c=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),x=e.xr.enabled;e.xr.enabled=!1;let S=n.texture.mipmapsAutoUpdate;n.texture.mipmapsAutoUpdate=!1;let p=!1;e.isWebGLRenderer===!0?p=e.state.buffers.depth.getReversed():p=e.reversedDepthBuffer,e.setRenderTarget(n,0,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,1,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,2,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,3,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,u),n.texture.mipmapsAutoUpdate=S,e.setRenderTarget(n,5,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,f),e.setRenderTarget(h,c,d),e.xr.enabled=x,n.texture.needsPMREMUpdate=!0}},Ja=class extends cn{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e,this.perCameraFrustumCulled=!1}};var $u="\\[\\]\\.:\\/",zg=new RegExp("["+$u+"]","g"),Ju="[^"+$u+"]",kg="[^"+$u.replace("\\.","")+"]",Hg=/((?:WC+[\/:])*)/.source.replace("WC",Ju),Gg=/(WCOD+)?/.source.replace("WCOD",kg),Vg=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Ju),Wg=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Ju),Xg=new RegExp("^"+Hg+Gg+Vg+Wg+"$"),qg=["material","materials","bones","map"],Au=class{constructor(e,t,n){let r=n||Ut.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=n.length;r!==s;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},Ut=class i{constructor(e,t,n){this.path=t,this.parsedPath=n||i.parseTrackName(t),this.node=i.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new i.Composite(e,t,n):new i(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(zg,"")}static parseTrackName(e){let t=Xg.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=n.nodeName.substring(r+1);qg.indexOf(s)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=s)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(s){for(let o=0;o<s.length;o++){let a=s[o];if(a.name===t||a.uuid===t)return a;let l=n(a.children);if(l)return l}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,r=t.propertyName,s=t.propertyIndex;if(e||(e=i.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Xe("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let u=t.objectIndex;switch(n){case"materials":if(!e.material){Ke("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ke("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ke("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let f=0;f<e.length;f++)if(e[f].name===u){u=f;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ke("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ke("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){Ke("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(u!==void 0){if(e[u]===void 0){Ke("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[u]}}let o=e[r];if(o===void 0){let u=t.nodeName;Ke("PropertyBinding: Trying to update property for track: "+u+"."+r+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){Ke("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ke("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Ut.Composite=Au;Ut.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Ut.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Ut.prototype.GetterByBindingType=[Ut.prototype._getValue_direct,Ut.prototype._getValue_array,Ut.prototype._getValue_arrayElement,Ut.prototype._getValue_toArray];Ut.prototype.SetterByBindingTypeAndVersioning=[[Ut.prototype._setValue_direct,Ut.prototype._setValue_direct_setNeedsUpdate,Ut.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Ut.prototype._setValue_array,Ut.prototype._setValue_array_setNeedsUpdate,Ut.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Ut.prototype._setValue_arrayElement,Ut.prototype._setValue_arrayElement_setNeedsUpdate,Ut.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Ut.prototype._setValue_fromArray,Ut.prototype._setValue_fromArray_setNeedsUpdate,Ut.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var ob=new Float32Array(1);var no=class{constructor(e=!0){this.autoStart=e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1,Xe("Clock: This module has been deprecated. Please use THREE.Timer instead.")}start(){this.startTime=performance.now(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){let t=performance.now();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}},io=class{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=nt(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(nt(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var nh=class nh{constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let s=this.elements;return s[0]=e,s[2]=t,s[1]=n,s[3]=r,this}};nh.prototype.isMatrix2=!0;var Eu=nh;var Df=new H,ya=new H,Wr=new H,Xr=new H,_u=new H,Yg=new H,Zg=new H,An=class{constructor(e=new H,t=new H){this.start=e,this.end=t}set(e,t){return this.start.copy(e),this.end.copy(t),this}copy(e){return this.start.copy(e.start),this.end.copy(e.end),this}getCenter(e){return e.addVectors(this.start,this.end).multiplyScalar(.5)}delta(e){return e.subVectors(this.end,this.start)}distanceSq(){return this.start.distanceToSquared(this.end)}distance(){return this.start.distanceTo(this.end)}at(e,t){return this.delta(t).multiplyScalar(e).add(this.start)}closestPointToPointParameter(e,t){Df.subVectors(e,this.start),ya.subVectors(this.end,this.start);let n=ya.dot(ya);if(n===0)return 0;let s=ya.dot(Df)/n;return t&&(s=nt(s,0,1)),s}closestPointToPoint(e,t,n){let r=this.closestPointToPointParameter(e,t);return this.delta(n).multiplyScalar(r).add(this.start)}distanceSqToLine3(e,t=Yg,n=Zg){let r=10000000000000001e-32,s,o,a=this.start,l=e.start,u=this.end,f=e.end;Wr.subVectors(u,a),Xr.subVectors(f,l),_u.subVectors(a,l);let h=Wr.dot(Wr),c=Xr.dot(Xr),d=Xr.dot(_u);if(h<=r&&c<=r)return t.copy(a),n.copy(l),t.distanceToSquared(n);if(h<=r)s=0,o=d/c,o=nt(o,0,1);else{let x=Wr.dot(_u);if(c<=r)o=0,s=nt(-x/h,0,1);else{let S=Wr.dot(Xr),p=h*c-S*S;p!==0?s=nt((S*d-x*c)/p,0,1):s=0,o=(S*s+d)/c,o<0?(o=0,s=nt(-x/h,0,1)):o>1&&(o=1,s=nt((S-x)/h,0,1))}}return t.copy(a).addScaledVector(Wr,s),n.copy(l).addScaledVector(Xr,o),t.distanceToSquared(n)}applyMatrix4(e){return this.start.applyMatrix4(e),this.end.applyMatrix4(e),this}equals(e){return e.start.equals(this.start)&&e.end.equals(this.end)}clone(){return new this.constructor().copy(this)}};function Ku(i,e,t,n){let r=$g(n);switch(t){case ku:return i*e;case Rn:return i*e/r.components*r.byteLength;case os:return i*e/r.components*r.byteLength;case an:return i*e*2/r.components*r.byteLength;case Yi:return i*e*2/r.components*r.byteLength;case Hu:return i*e*3/r.components*r.byteLength;case qe:return i*e*4/r.components*r.byteLength;case Zi:return i*e*4/r.components*r.byteLength;case po:case mo:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case go:case xo:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case il:case sl:return Math.max(i,16)*Math.max(e,8)/4;case nl:case rl:return Math.max(i,8)*Math.max(e,8)/2;case ol:case al:case cl:case ul:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case ll:case vo:case hl:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case fl:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case dl:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case pl:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case ml:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case gl:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case xl:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case vl:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case _l:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case yl:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case Sl:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case bl:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case Ml:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case Tl:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case wl:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case Al:case El:case Rl:return Math.ceil(i/4)*Math.ceil(e/4)*16;case Cl:case Il:return Math.ceil(i/4)*Math.ceil(e/4)*8;case _o:case Pl:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function $g(i){switch(i){case sn:case ss:return{byteLength:1,components:1};case Xi:case fo:case ht:return{byteLength:2,components:1};case el:case tl:return{byteLength:2,components:4};case on:case qi:case tt:return{byteLength:4,components:1};case Bu:case zu:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"187"}}));typeof window<"u"&&(window.__THREE__?Xe("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="187");function Gd(){let i=null,e=!1,t=null,n=null;function r(s,o){n=i.requestAnimationFrame(r),t(s,o)}return{start:function(){e!==!0&&t!==null&&i!==null&&(n=i.requestAnimationFrame(r),e=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){i=s}}}function Jg(i){let e=new WeakMap;function t(a,l){let u=a.array,f=a.usage,h=u.byteLength,c=i.createBuffer();i.bindBuffer(l,c),i.bufferData(l,u,f),a.onUploadCallback();let d;if(u instanceof Float32Array)d=i.FLOAT;else if(typeof Float16Array<"u"&&u instanceof Float16Array)d=i.HALF_FLOAT;else if(u instanceof Uint16Array)a.isFloat16BufferAttribute?d=i.HALF_FLOAT:d=i.UNSIGNED_SHORT;else if(u instanceof Int16Array)d=i.SHORT;else if(u instanceof Uint32Array)d=i.UNSIGNED_INT;else if(u instanceof Int32Array)d=i.INT;else if(u instanceof Int8Array)d=i.BYTE;else if(u instanceof Uint8Array)d=i.UNSIGNED_BYTE;else if(u instanceof Uint8ClampedArray)d=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+u);return{buffer:c,type:d,bytesPerElement:u.BYTES_PER_ELEMENT,version:a.version,size:h}}function n(a,l,u){let f=l.array,h=l.updateRanges;if(i.bindBuffer(u,a),h.length===0)i.bufferSubData(u,0,f);else{h.sort((d,x)=>d.start-x.start);let c=0;for(let d=1;d<h.length;d++){let x=h[c],S=h[d];S.start<=x.start+x.count+1?x.count=Math.max(x.count,S.start+S.count-x.start):(++c,h[c]=S)}h.length=c+1;for(let d=0,x=h.length;d<x;d++){let S=h[d];i.bufferSubData(u,S.start*f.BYTES_PER_ELEMENT,f,S.start,S.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=e.get(a);l&&(i.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let f=e.get(a);(!f||f.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let u=e.get(a);if(u===void 0)e.set(a,t(a,l));else if(u.version<a.version){if(u.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(u.buffer,a,l),u.version=a.version}}return{get:r,remove:s,update:o}}var Kg=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Qg=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,jg=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,e0=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,t0=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,n0=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,i0=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,r0=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,s0=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,o0=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,a0=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,l0=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,c0=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,u0=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,h0=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,f0=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,d0=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,p0=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,m0=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,g0=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,x0=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,v0=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,_0=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,y0=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,S0=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,b0=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,M0=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,T0=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,w0=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,A0="gl_FragColor = linearToOutputTexel( gl_FragColor );",E0=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,R0=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,C0=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	uniform samplerCube envMap;
	#ifdef ENVMAP_TYPE_PMREM
		float roughnessToMip( const in float roughness ) {
			float r = clamp( roughness, 0.0, 1.0 );
			return ENVMAP_MAX_LOD * r * ( 2.0 - r );
		}
	#endif
#endif`,I0=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,P0=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,D0=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,L0=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,F0=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,N0=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,U0=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,O0=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,B0=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,z0=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,k0=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,H0=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,G0=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * worldNormal, ENVMAP_MAX_LOD );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * reflectVec, roughnessToMip( roughness ) );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureLod( envMap, envMapRotation * retroVec, roughnessToMip( roughness ) );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_PMREM
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,V0=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,W0=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,X0=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,q0=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Y0=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.045 );
material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef USE_DIFFUSE_ROUGHNESS
	float diffuseRoughnessFactor = diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		diffuseRoughnessFactor *= texture2D( diffuseRoughnessMap, vDiffuseRoughnessMapUv ).r;
	#endif
	material.diffuseRoughness = saturate( diffuseRoughnessFactor );
#endif
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.045 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Z0=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float diffuseRoughness;
	#endif
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
#ifdef USE_DIFFUSE_ROUGHNESS
	const float EON_EPSILON = 1e-7;
	float FON_DirectionalAlbedo( const in float mu, const in float roughness, const in float A ) {
		float muComp = 1.0 - mu;
		float gOverPi = muComp * ( 0.0571085289 + muComp * ( 0.491881867 + muComp * ( - 0.332181442 + muComp * 0.0714429953 ) ) );
		return A * ( 1.0 + roughness * gOverPi );
	}
	vec3 BRDF_EON( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 diffuseColor, const in float roughness ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return BRDF_Lambert( rho );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float s = dot( lightDir, viewDir ) - dotNL * dotNV;
		float sOverT = ( s > 0.0 ) ? s / max( max( dotNL, dotNV ), EON_EPSILON ) : s;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		vec3 singleScatter = rho * RECIPROCAL_PI * A * ( 1.0 + roughness * sOverT );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		float albedoV = FON_DirectionalAlbedo( dotNV, roughness, A );
		float albedoL = FON_DirectionalAlbedo( dotNL, roughness, A );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		vec3 multiScatter = rhoMultiScatter * RECIPROCAL_PI
			* max( EON_EPSILON, 1.0 - albedoV )
			* max( EON_EPSILON, 1.0 - albedoL )
			/ max( EON_EPSILON, 1.0 - averageAlbedo );
		return singleScatter + multiScatter;
	}
	vec3 EON_DirectionalAlbedo( const in vec3 diffuseColor, const in float roughness, const in float dotNV ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return rho;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		float directionalAlbedo = FON_DirectionalAlbedo( dotNV, roughness, A );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		return rho * directionalAlbedo + rhoMultiScatter * ( 1.0 - directionalAlbedo );
	}
#endif
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = max( material.clearcoatRoughness, 0.045 );
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = max( material.roughness, 0.045 );
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float alphaT = max( material.alphaT, alpha );
		float V = V_GGX_SmithCorrelated_Anisotropic( alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		vec3 diffuseBRDF = BRDF_EON( directLight.direction, geometryViewDir, geometryNormal, material.diffuseColor, material.diffuseRoughness ) * ( 1.0 - material.metalness );
	#else
		vec3 diffuseBRDF = BRDF_Lambert( material.diffuseContribution );
	#endif
	reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuseAlbedo = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness );
		vec3 diffuse = irradiance * RECIPROCAL_PI * diffuseAlbedo * ( 1.0 - singleScattering - multiScattering );
	#else
		vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#endif
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuse = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness ) * ( 1.0 - totalScatteringDielectric );
	#else
		vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	#endif
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,$0=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_LIGHT_PROBE_GRIDS > 0
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		int probeGrid = - 1;
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( isInsideLightProbeGrid( probeWorldPos, probeWorldNormal, probesMin[ i ], probesMax[ i ], probesResolution[ i ] ) ) probeGrid = UNROLLED_LOOP_INDEX;
		}
		#pragma unroll_loop_end
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( probeGrid == UNROLLED_LOOP_INDEX ) irradiance += getLightProbeGridIrradiance( probesSH[ i ], probesMin[ i ], probesMax[ i ], probesResolution[ i ], probeWorldPos, probeWorldNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,J0=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_PMREM )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,K0=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Q0=`#if NUM_LIGHT_PROBE_GRIDS > 0
uniform highp sampler3D probesSH[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMin[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMax[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesResolution[ NUM_LIGHT_PROBE_GRIDS ];
bool isInsideLightProbeGrid( vec3 worldPos, vec3 worldNormal, vec3 probesMin, vec3 probesMax, vec3 probesResolution ) {
	vec3 spacing = ( probesMax - probesMin ) / probesResolution;
	vec3 samplePos = worldPos + worldNormal * spacing * 0.5;
	vec3 margin = spacing * 0.01;
	return all( greaterThanEqual( samplePos, probesMin - margin ) ) && all( lessThanEqual( samplePos, probesMax + margin ) );
}
vec3 getLightProbeGridIrradiance( highp sampler3D probesSH, vec3 probesMin, vec3 probesMax, vec3 probesResolution, vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 probeSpacing = gridRange / res;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.5 / res, 1.0 - 0.5 / res );
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,j0=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,ex=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,tx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,nx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,ix=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,rx=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,sx=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,ox=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ax=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,lx=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,cx=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,ux=`#if defined( USE_MORPHCOLORS )
	#if defined( USE_COLOR_ALPHA )
		vColor *= morphTargetBaseInfluence;
	#elif defined( USE_COLOR )
		vColor.rgb *= morphTargetBaseInfluence;
	#endif
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor.rgb += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,hx=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,fx=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,dx=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,px=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,mx=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,gx=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,xx=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,vx=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,_x=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,yx=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Sx=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,bx=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Mx=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Tx=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,wx=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Ax=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Ex=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Rx=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Cx=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Ix=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Px=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Dx=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				vec2 radius = shadowRadius * texelSize;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float lightDistance = length( lightToPosition );
			float depthRange = shadowCameraFar - shadowCameraNear;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float depthA = - shadowCameraNear / depthRange - shadowBias;
				float depthB = shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#else
				float depthA = shadowCameraFar / depthRange + shadowBias;
				float depthB = - shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			shadow = 0.0;
			for ( int i = 0; i < 5; i ++ ) {
				vec2 offset = vogelDiskSample( i, 5, phi );
				vec3 direction = bd3D + ( tangent * offset.x + bitangent * offset.y ) * texelSize;
				vec3 absDirection = abs( direction );
				float dp = depthA + depthB / max( max( absDirection.x, absDirection.y ), absDirection.z );
				shadow += texture( shadowMap, vec4( direction, dp ) );
			}
			shadow *= 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Lx=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Fx=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Nx=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Ux=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Ox=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Bx=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,zx=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,kx=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Hx=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Gx=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Vx=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Wx=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Xx=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,qx=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Yx=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	uniform mat3 diffuseRoughnessMapTransform;
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Zx=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	vDiffuseRoughnessMapUv = ( diffuseRoughnessMapTransform * vec3( DIFFUSE_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,$x=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Jx=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Kx=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Qx=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,jx=`uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <envmap_common_pars_fragment>
void main() {
	#ifdef ENVMAP_TYPE_PMREM
		vec4 texColor = textureLod( envMap, backgroundRotation * vWorldDirection, roughnessToMip( backgroundBlurriness ) );
	#else
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ev=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,tv=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,nv=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,iv=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,rv=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,sv=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,ov=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,av=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,lv=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,cv=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,uv=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,hv=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,fv=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,dv=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,pv=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,mv=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,gv=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,xv=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,vv=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,_v=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,yv=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Sv=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DIFFUSE_ROUGHNESS
	uniform float diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		uniform sampler2D diffuseRoughnessMap;
	#endif
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,bv=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Mv=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Tv=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,wv=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Av=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ev=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Rv=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Cv=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,ct={alphahash_fragment:Kg,alphahash_pars_fragment:Qg,alphamap_fragment:jg,alphamap_pars_fragment:e0,alphatest_fragment:t0,alphatest_pars_fragment:n0,aomap_fragment:i0,aomap_pars_fragment:r0,batching_pars_vertex:s0,batching_vertex:o0,begin_vertex:a0,beginnormal_vertex:l0,bsdfs:c0,iridescence_fragment:u0,bumpmap_pars_fragment:h0,clipping_planes_fragment:f0,clipping_planes_pars_fragment:d0,clipping_planes_pars_vertex:p0,clipping_planes_vertex:m0,color_fragment:g0,color_pars_fragment:x0,color_pars_vertex:v0,color_vertex:_0,common:y0,defaultnormal_vertex:S0,displacementmap_pars_vertex:b0,displacementmap_vertex:M0,emissivemap_fragment:T0,emissivemap_pars_fragment:w0,colorspace_fragment:A0,colorspace_pars_fragment:E0,envmap_fragment:R0,envmap_common_pars_fragment:C0,envmap_pars_fragment:I0,envmap_pars_vertex:P0,envmap_physical_pars_fragment:G0,envmap_vertex:D0,fog_vertex:L0,fog_pars_vertex:F0,fog_fragment:N0,fog_pars_fragment:U0,gradientmap_pars_fragment:O0,lightmap_pars_fragment:B0,lights_lambert_fragment:z0,lights_lambert_pars_fragment:k0,lights_pars_begin:H0,lights_toon_fragment:V0,lights_toon_pars_fragment:W0,lights_phong_fragment:X0,lights_phong_pars_fragment:q0,lights_physical_fragment:Y0,lights_physical_pars_fragment:Z0,lights_fragment_begin:$0,lights_fragment_maps:J0,lights_fragment_end:K0,lightprobes_pars_fragment:Q0,logdepthbuf_fragment:j0,logdepthbuf_pars_fragment:ex,logdepthbuf_pars_vertex:tx,logdepthbuf_vertex:nx,map_fragment:ix,map_pars_fragment:rx,map_particle_fragment:sx,map_particle_pars_fragment:ox,metalnessmap_fragment:ax,metalnessmap_pars_fragment:lx,morphinstance_vertex:cx,morphcolor_vertex:ux,morphnormal_vertex:hx,morphtarget_pars_vertex:fx,morphtarget_vertex:dx,normal_fragment_begin:px,normal_fragment_maps:mx,normal_pars_fragment:gx,normal_pars_vertex:xx,normal_vertex:vx,normalmap_pars_fragment:_x,clearcoat_normal_fragment_begin:yx,clearcoat_normal_fragment_maps:Sx,clearcoat_pars_fragment:bx,iridescence_pars_fragment:Mx,opaque_fragment:Tx,packing:wx,premultiplied_alpha_fragment:Ax,project_vertex:Ex,dithering_fragment:Rx,dithering_pars_fragment:Cx,roughnessmap_fragment:Ix,roughnessmap_pars_fragment:Px,shadowmap_pars_fragment:Dx,shadowmap_pars_vertex:Lx,shadowmap_vertex:Fx,shadowmask_pars_fragment:Nx,skinbase_vertex:Ux,skinning_pars_vertex:Ox,skinning_vertex:Bx,skinnormal_vertex:zx,specularmap_fragment:kx,specularmap_pars_fragment:Hx,tonemapping_fragment:Gx,tonemapping_pars_fragment:Vx,transmission_fragment:Wx,transmission_pars_fragment:Xx,uv_pars_fragment:qx,uv_pars_vertex:Yx,uv_vertex:Zx,worldpos_vertex:$x,background_vert:Jx,background_frag:Kx,backgroundCube_vert:Qx,backgroundCube_frag:jx,cube_vert:ev,cube_frag:tv,depth_vert:nv,depth_frag:iv,distance_vert:rv,distance_frag:sv,equirect_vert:ov,equirect_frag:av,linedashed_vert:lv,linedashed_frag:cv,meshbasic_vert:uv,meshbasic_frag:hv,meshlambert_vert:fv,meshlambert_frag:dv,meshmatcap_vert:pv,meshmatcap_frag:mv,meshnormal_vert:gv,meshnormal_frag:xv,meshphong_vert:vv,meshphong_frag:_v,meshphysical_vert:yv,meshphysical_frag:Sv,meshtoon_vert:bv,meshtoon_frag:Mv,points_vert:Tv,points_frag:wv,shadow_vert:Av,shadow_frag:Ev,sprite_vert:Rv,sprite_frag:Cv},Fe={common:{diffuse:{value:new Je(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new je},alphaMap:{value:null},alphaMapTransform:{value:new je},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new je}},envmap:{envMap:{value:null},envMapRotation:{value:new je},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new je}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new je}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new je},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new je},normalScale:{value:new Ue(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new je},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new je}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new je}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new je}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Je(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:[]},probesMin:{value:[]},probesMax:{value:[]},probesResolution:{value:[]}},points:{diffuse:{value:new Je(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new je},alphaTest:{value:0},uvTransform:{value:new je}},sprite:{diffuse:{value:new Je(16777215)},opacity:{value:1},center:{value:new Ue(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new je},alphaMap:{value:null},alphaMapTransform:{value:new je},alphaTest:{value:0}}},ui={basic:{uniforms:yn([Fe.common,Fe.specularmap,Fe.envmap,Fe.aomap,Fe.lightmap,Fe.fog]),vertexShader:ct.meshbasic_vert,fragmentShader:ct.meshbasic_frag},lambert:{uniforms:yn([Fe.common,Fe.specularmap,Fe.envmap,Fe.aomap,Fe.lightmap,Fe.emissivemap,Fe.bumpmap,Fe.normalmap,Fe.displacementmap,Fe.fog,Fe.lights,{emissive:{value:new Je(0)},envMapIntensity:{value:1}}]),vertexShader:ct.meshlambert_vert,fragmentShader:ct.meshlambert_frag},phong:{uniforms:yn([Fe.common,Fe.specularmap,Fe.envmap,Fe.aomap,Fe.lightmap,Fe.emissivemap,Fe.bumpmap,Fe.normalmap,Fe.displacementmap,Fe.fog,Fe.lights,{emissive:{value:new Je(0)},specular:{value:new Je(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:ct.meshphong_vert,fragmentShader:ct.meshphong_frag},standard:{uniforms:yn([Fe.common,Fe.envmap,Fe.aomap,Fe.lightmap,Fe.emissivemap,Fe.bumpmap,Fe.normalmap,Fe.displacementmap,Fe.roughnessmap,Fe.metalnessmap,Fe.fog,Fe.lights,{emissive:{value:new Je(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:ct.meshphysical_vert,fragmentShader:ct.meshphysical_frag},toon:{uniforms:yn([Fe.common,Fe.aomap,Fe.lightmap,Fe.emissivemap,Fe.bumpmap,Fe.normalmap,Fe.displacementmap,Fe.gradientmap,Fe.fog,Fe.lights,{emissive:{value:new Je(0)}}]),vertexShader:ct.meshtoon_vert,fragmentShader:ct.meshtoon_frag},matcap:{uniforms:yn([Fe.common,Fe.bumpmap,Fe.normalmap,Fe.displacementmap,Fe.fog,{matcap:{value:null}}]),vertexShader:ct.meshmatcap_vert,fragmentShader:ct.meshmatcap_frag},points:{uniforms:yn([Fe.points,Fe.fog]),vertexShader:ct.points_vert,fragmentShader:ct.points_frag},dashed:{uniforms:yn([Fe.common,Fe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:ct.linedashed_vert,fragmentShader:ct.linedashed_frag},depth:{uniforms:yn([Fe.common,Fe.displacementmap]),vertexShader:ct.depth_vert,fragmentShader:ct.depth_frag},normal:{uniforms:yn([Fe.common,Fe.bumpmap,Fe.normalmap,Fe.displacementmap,{opacity:{value:1}}]),vertexShader:ct.meshnormal_vert,fragmentShader:ct.meshnormal_frag},sprite:{uniforms:yn([Fe.sprite,Fe.fog]),vertexShader:ct.sprite_vert,fragmentShader:ct.sprite_frag},background:{uniforms:{uvTransform:{value:new je},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:ct.background_vert,fragmentShader:ct.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new je}},vertexShader:ct.backgroundCube_vert,fragmentShader:ct.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:ct.cube_vert,fragmentShader:ct.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:ct.equirect_vert,fragmentShader:ct.equirect_frag},distance:{uniforms:yn([Fe.common,Fe.displacementmap,{referencePosition:{value:new H},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:ct.distance_vert,fragmentShader:ct.distance_frag},shadow:{uniforms:yn([Fe.lights,Fe.fog,{color:{value:new Je(0)},opacity:{value:1}}]),vertexShader:ct.shadow_vert,fragmentShader:ct.shadow_frag}};ui.physical={uniforms:yn([ui.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new je},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new je},clearcoatNormalScale:{value:new Ue(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new je},diffuseRoughness:{value:0},diffuseRoughnessMap:{value:null},diffuseRoughnessMapTransform:{value:new je},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new je},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new je},sheen:{value:0},sheenColor:{value:new Je(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new je},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new je},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new je},transmissionSamplerSize:{value:new Ue},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new je},attenuationDistance:{value:0},attenuationColor:{value:new Je(0)},specularColor:{value:new Je(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new je},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new je},anisotropyVector:{value:new Ue},anisotropyMap:{value:null},anisotropyMapTransform:{value:new je}}]),vertexShader:ct.meshphysical_vert,fragmentShader:ct.meshphysical_frag};var Ll={r:0,b:0,g:0},Iv=new Ze,Vd=new je;Vd.set(-1,0,0,0,1,0,0,0,1);function Pv(i,e,t,n,r,s){let o=new Je(0),a=r===!0?0:1,l,u,f=null,h=0,c=null;function d(y){let T=y.isScene===!0?y.background:null;if(T&&T.isTexture){let M=y.backgroundBlurriness>0;T=e.get(T,M)}return T}function x(y){let T=!1,M=d(y);M===null?p(o,a):M&&M.isColor&&(p(M,1),T=!0);let A=i.xr.getEnvironmentBlendMode();A==="additive"?t.buffers.color.setClear(0,0,0,1,s):A==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,s),(i.autoClear||T)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function S(y,T){let M=d(T);M&&M.isCubeTexture?(u===void 0&&(u=new xn(new jr(1,1,1),new $t({name:"BackgroundCubeMaterial",uniforms:_r(ui.backgroundCube.uniforms),vertexShader:ui.backgroundCube.vertexShader,fragmentShader:ui.backgroundCube.fragmentShader,side:Kt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(A,E,_){this.matrixWorld.copyPosition(_.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(u)),u.material.uniforms.envMap.value=M,u.material.uniforms.backgroundBlurriness.value=T.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,u.material.uniforms.backgroundRotation.value.setFromMatrix4(Iv.makeRotationFromEuler(T.backgroundRotation)).transpose(),M.isRenderTargetTexture===!1&&u.material.uniforms.backgroundRotation.value.premultiply(Vd),u.material.toneMapped=dt.getTransfer(M.colorSpace)!==wt,(f!==M||h!==M.version||c!==i.toneMapping)&&(u.material.needsUpdate=!0,f=M,h=M.version,c=i.toneMapping),u.layers.enableAll(),y.unshift(u,u.geometry,u.material,0,0,null)):M&&M.isTexture&&(l===void 0&&(l=new xn(new pr(2,2),new $t({name:"BackgroundMaterial",uniforms:_r(ui.background.uniforms),vertexShader:ui.background.vertexShader,fragmentShader:ui.background.fragmentShader,side:En,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=M,l.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,l.material.toneMapped=dt.getTransfer(M.colorSpace)!==wt,M.matrixAutoUpdate===!0&&M.updateMatrix(),l.material.uniforms.uvTransform.value.copy(M.matrix),(f!==M||h!==M.version||c!==i.toneMapping)&&(l.material.needsUpdate=!0,f=M,h=M.version,c=i.toneMapping),l.layers.enableAll(),y.unshift(l,l.geometry,l.material,0,0,null))}function p(y,T){y.getRGB(Ll,Zu(i)),t.buffers.color.setClear(Ll.r,Ll.g,Ll.b,T,s)}function g(){u!==void 0&&(u.geometry.dispose(),u.material.dispose(),u=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(y,T=1){o.set(y),a=T,p(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(y){a=y,p(o,a)},render:x,addToRenderList:S,dispose:g}}function Dv(i,e){let t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},r=c(null),s=r,o=!1;function a(N,U,z,D,G){let W=!1,Z=h(N,D,z,U);s!==Z&&(s=Z,u(s.object)),W=d(N,D,z,G),W&&x(N,D,z,G),G!==null&&e.update(G,i.ELEMENT_ARRAY_BUFFER),(W||o)&&(o=!1,M(N,U,z,D),G!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(G).buffer))}function l(){return i.createVertexArray()}function u(N){return i.bindVertexArray(N)}function f(N){return i.deleteVertexArray(N)}function h(N,U,z,D){let G=D.wireframe===!0,W=n[U.id];W===void 0&&(W={},n[U.id]=W);let Z=N.isInstancedMesh===!0?N.id:0,le=W[Z];le===void 0&&(le={},W[Z]=le);let J=le[z.id];J===void 0&&(J={},le[z.id]=J);let se=J[G];return se===void 0&&(se=c(l()),J[G]=se),se}function c(N){let U=[],z=[],D=[];for(let G=0;G<t;G++)U[G]=0,z[G]=0,D[G]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:U,enabledAttributes:z,attributeDivisors:D,object:N,attributes:{},index:null}}function d(N,U,z,D){let G=s.attributes,W=U.attributes,Z=0,le=z.getAttributes();for(let J in le)if(le[J].location>=0){let ae=G[J],ye=W[J];if(ye===void 0&&(J==="instanceMatrix"&&N.instanceMatrix&&(ye=N.instanceMatrix),J==="instanceColor"&&N.instanceColor&&(ye=N.instanceColor)),ae===void 0||ae.attribute!==ye||ye&&ae.data!==ye.data)return!0;Z++}return s.attributesNum!==Z||s.index!==D}function x(N,U,z,D){let G={},W=U.attributes,Z=0,le=z.getAttributes();for(let J in le)if(le[J].location>=0){let ae=W[J];ae===void 0&&(J==="instanceMatrix"&&N.instanceMatrix&&(ae=N.instanceMatrix),J==="instanceColor"&&N.instanceColor&&(ae=N.instanceColor));let ye={};ye.attribute=ae,ae&&ae.data&&(ye.data=ae.data),G[J]=ye,Z++}s.attributes=G,s.attributesNum=Z,s.index=D}function S(){let N=s.newAttributes;for(let U=0,z=N.length;U<z;U++)N[U]=0}function p(N){g(N,0)}function g(N,U){let z=s.newAttributes,D=s.enabledAttributes,G=s.attributeDivisors;z[N]=1,D[N]===0&&(i.enableVertexAttribArray(N),D[N]=1),G[N]!==U&&(i.vertexAttribDivisor(N,U),G[N]=U)}function y(){let N=s.newAttributes,U=s.enabledAttributes;for(let z=0,D=U.length;z<D;z++)U[z]!==N[z]&&(i.disableVertexAttribArray(z),U[z]=0)}function T(N,U,z,D,G,W,Z){Z===!0?i.vertexAttribIPointer(N,U,z,G,W):i.vertexAttribPointer(N,U,z,D,G,W)}function M(N,U,z,D){S();let G=D.attributes,W=z.getAttributes(),Z=U.defaultAttributeValues;for(let le in W){let J=W[le];if(J.location>=0){let se=G[le];if(se===void 0&&(le==="instanceMatrix"&&N.instanceMatrix&&(se=N.instanceMatrix),le==="instanceColor"&&N.instanceColor&&(se=N.instanceColor)),se!==void 0){let ae=se.normalized,ye=se.itemSize,Le=e.get(se);if(Le===void 0)continue;let j=Le.buffer,he=Le.type,Ce=Le.bytesPerElement,Oe=he===i.INT||he===i.UNSIGNED_INT||se.gpuType===qi;if(se.isInterleavedBufferAttribute){let fe=se.data,ke=fe.isInterleavedBuffer===!0?fe.stride:fe.itemSize,mt=se.offset;if(fe.isInstancedInterleavedBuffer||fe.isInstancedBufferAttribute){for(let Be=0;Be<J.locationSize;Be++)g(J.location+Be,fe.meshPerAttribute);N.isInstancedMesh!==!0&&D._maxInstanceCount===void 0&&(D._maxInstanceCount=fe.meshPerAttribute*fe.count)}else for(let Be=0;Be<J.locationSize;Be++)p(J.location+Be);i.bindBuffer(i.ARRAY_BUFFER,j);for(let Be=0;Be<J.locationSize;Be++)T(J.location+Be,ye/J.locationSize,he,ae,ke*Ce,(mt+ye/J.locationSize*Be)*Ce,Oe)}else{if(se.isInstancedBufferAttribute){for(let fe=0;fe<J.locationSize;fe++)g(J.location+fe,se.meshPerAttribute);N.isInstancedMesh!==!0&&D._maxInstanceCount===void 0&&(D._maxInstanceCount=se.meshPerAttribute*se.count)}else for(let fe=0;fe<J.locationSize;fe++)p(J.location+fe);i.bindBuffer(i.ARRAY_BUFFER,j);for(let fe=0;fe<J.locationSize;fe++)T(J.location+fe,ye/J.locationSize,he,ae,ye*Ce,ye/J.locationSize*fe*Ce,Oe)}}else if(Z!==void 0){let ae=Z[le];if(ae!==void 0)switch(ae.length){case 2:i.vertexAttrib2fv(J.location,ae);break;case 3:i.vertexAttrib3fv(J.location,ae);break;case 4:i.vertexAttrib4fv(J.location,ae);break;default:i.vertexAttrib1fv(J.location,ae)}}}}y()}function A(){L();for(let N in n){let U=n[N];for(let z in U){let D=U[z];for(let G in D){let W=D[G];for(let Z in W)f(W[Z].object),delete W[Z];delete D[G]}}delete n[N]}}function E(N){if(n[N.id]===void 0)return;let U=n[N.id];for(let z in U){let D=U[z];for(let G in D){let W=D[G];for(let Z in W)f(W[Z].object),delete W[Z];delete D[G]}}delete n[N.id]}function _(N){for(let U in n){let z=n[U];for(let D in z){let G=z[D];if(G[N.id]===void 0)continue;let W=G[N.id];for(let Z in W)f(W[Z].object),delete W[Z];delete G[N.id]}}}function w(N){for(let U in n){let z=n[U],D=N.isInstancedMesh===!0?N.id:0,G=z[D];if(G!==void 0){for(let W in G){let Z=G[W];for(let le in Z)f(Z[le].object),delete Z[le];delete G[W]}delete z[D],Object.keys(z).length===0&&delete n[U]}}}function L(){I(),o=!0,s!==r&&(s=r,u(s.object))}function I(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:L,resetDefaultState:I,dispose:A,releaseStatesOfGeometry:E,releaseStatesOfObject:w,releaseStatesOfProgram:_,initAttributes:S,enableAttribute:p,disableUnusedAttributes:y}}function Lv(i,e,t){let n;function r(l){n=l}function s(l,u){i.drawArrays(n,l,u),t.update(u,n,1)}function o(l,u,f){f!==0&&(i.drawArraysInstanced(n,l,u,f),t.update(u,n,f))}function a(l,u,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,u,0,f);let c=0;for(let d=0;d<f;d++)c+=u[d];t.update(c,n,1)}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a}function Fv(i,e,t,n){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let _=e.get("EXT_texture_filter_anisotropic");r=i.getParameter(_.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(_){return!(_!==qe&&n.convert(_)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(_){let w=_===ht&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(_!==sn&&_!==tt&&!w&&n.convert(_)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function l(_){if(_==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";_="mediump"}return _==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let u=t.precision!==void 0?t.precision:"highp",f=l(u);f!==u&&(Xe("WebGLRenderer:",u,"not supported, using",f,"instead."),u=f);let h=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),c=t.logarithmicDepthBuffer===!0&&h===!1;t.reversedDepthBuffer===!0&&h===!1&&Xe("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer."),t.logarithmicDepthBuffer===!0&&h===!0&&Xe("WebGLRenderer: Logarithmic depth buffer is ignored when reversed depth buffer is enabled.");let d=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),x=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),S=i.getParameter(i.MAX_TEXTURE_SIZE),p=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),g=i.getParameter(i.MAX_VERTEX_ATTRIBS),y=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),T=i.getParameter(i.MAX_VARYING_VECTORS),M=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),A=i.getParameter(i.MAX_SAMPLES),E=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:u,logarithmicDepthBuffer:c,reversedDepthBuffer:h,maxTextures:d,maxVertexTextures:x,maxTextureSize:S,maxCubemapSize:p,maxAttributes:g,maxVertexUniforms:y,maxVaryings:T,maxFragmentUniforms:M,maxSamples:A,samples:E}}function Nv(i){let e=this,t=null,n=0,r=!1,s=!1,o=new wn,a=new je,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,c){let d=h.length!==0||c||n!==0||r;return r=c,n=h.length,d},this.beginShadows=function(){s=!0,f(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(h,c){t=f(h,c,0)},this.setState=function(h,c,d){let x=h.clippingPlanes,S=h.clipIntersection,p=h.clipShadows,g=i.get(h);if(!r||x===null||x.length===0||s&&!p)s?f(null):u();else{let y=s?0:n,T=y*4,M=g.clippingState||null;l.value=M,M=f(x,c,T,d);for(let A=0;A!==T;++A)M[A]=t[A];g.clippingState=M,this.numIntersection=S?this.numPlanes:0,this.numPlanes+=y}};function u(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function f(h,c,d,x){let S=h!==null?h.length:0,p=null;if(S!==0){if(p=l.value,x!==!0||p===null){let g=d+S*4,y=c.matrixWorldInverse;a.getNormalMatrix(y),(p===null||p.length<g)&&(p=new Float32Array(g));for(let T=0,M=d;T!==S;++T,M+=4)o.copy(h[T]).applyMatrix4(y,a),o.normal.toArray(p,M),p[M+3]=o.constant}l.value=p,l.needsUpdate=!0}return e.numPlanes=S,e.numIntersection=0,p}}var Mo=class extends zt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new Zs(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new jr(5,5,5),s=new $t({name:"CubemapFromEquirect",uniforms:_r(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Kt,blending:_n});s.uniforms.tEquirect.value=t;let o=new xn(r,s),a=t.minFilter;return t.minFilter===li&&(t.minFilter=lt),new ns(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,n,r);e.setRenderTarget(s)}},Sd=256,Uv=3,Ov=20,Wd=256,Xd=16,Bv=3,zv=new H,kv=new Je,Nl=class i{constructor(e){this._renderer=e,this._cubeSize=0,this._sourceTarget=null,this._cubeCamera=new ns(1,10,null),this._boxMesh=new xn(new jr(5,5,5),null),this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null,this._integrationMaterial=null}fromScene(e,t=0,n=.1,r=100,s={}){let{size:o=256,position:a=zv}=s,l=this._renderer;this._setSize(o);let u=this._allocateTarget(),f=this._getSourceTarget(!0);t>0&&(f.texture.mipmapsAutoUpdate=!1);let h=l.autoClear,c=l.autoClearColor,d=l.autoClearDepth,x=l.autoClearStencil,S=e.background;l.autoClear=!0,l.autoClearColor=!0,l.autoClearDepth=!0,l.autoClearStencil=!0,S===null&&(e.background=l.getClearColor(kv));let p=new ns(n,r,f);return p.position.copy(a),p.update(l,e),l.autoClear=h,l.autoClearColor=c,l.autoClearDepth=d,l.autoClearStencil=x,e.background=S,t>0&&(f.texture.mipmapsAutoUpdate=!0,this._blur(u,t)),this._applyPMREM(u),u}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Td(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Md(),this._compileMaterial(this._equirectMaterial))}dispose(){this._sourceTarget!==null&&this._sourceTarget.dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._integrationMaterial!==null&&this._integrationMaterial.dispose(),this._boxMesh.geometry.dispose()}static lodToRoughness(e,t){return t>0?1-Math.sqrt(1-e/t):0}_setSize(e){this._cubeSize=Math.max(Sd,gd(e))}_fromTexture(e,t){e.mapping===xr||e.mapping===rs?this._setSize(e.image.length===0?Sd:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4);let n=t||this._allocateTarget();return this._textureToCubemap(e),this._applyPMREM(n),n}_allocateTarget(){let e=this._cubeSize,t=bd(e,!1,!1),n=Math.log2(e)-Uv;for(let r=0;r<=n;r++)t.texture.mipmaps.push({width:e>>r,height:e>>r});return t.texture.name="PMREM",t.texture.isPMREMTexture=!0,t}_getSourceTarget(e=!1){let t=this._cubeSize,n=this._sourceTarget;return(n===null||n.width!==t||e&&n.depthBuffer===!1)&&(n!==null&&n.dispose(),this._sourceTarget=bd(t,!0,e)),this._sourceTarget}_compileMaterial(e){this._boxMesh.material=e,this._renderer.compile(this._boxMesh,this._cubeCamera.children[0])}_renderCube(e,t,n){let r=this._boxMesh,s=this._cubeCamera;r.material=n,s.renderTarget=e,s.activeMipmapLevel=t;let o=e.width>>t;e.viewport.set(0,0,o,o),s.update(this._renderer,r),e.viewport.set(0,0,e.width,e.height)}_textureToCubemap(e){let t;e.mapping===xr||e.mapping===rs?(this._cubemapMaterial===null&&(this._cubemapMaterial=Td()),t=this._cubemapMaterial,t.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):(this._equirectMaterial===null&&(this._equirectMaterial=Md()),t=this._equirectMaterial),t.uniforms.envMap.value=e,this._renderCube(this._getSourceTarget(),0,t)}_applyPMREM(e){this._ggxMaterial===null&&(this._ggxMaterial=Hv(),this._integrationMaterial=Gv());let t=this._cubeSize,n=e.texture.mipmaps.length-1,r=this._ggxMaterial.uniforms;r.envMap.value=this._sourceTarget.texture;let s=this._integrationMaterial.uniforms;s.envMap.value=this._sourceTarget.texture,s.sourceLod.value=Math.log2(t/Xd);for(let o=0;o<=n;o++){let a=i.lodToRoughness(o,n);if(o>n-Bv)s.roughness.value=a,this._renderCube(e,o,this._integrationMaterial);else{let l=a>0?Math.log2(t)+.5*Math.log2(6/(Wd*Math.pow(a,4)))+.5:0;r.roughness.value=a,r.lodBias.value=l,this._renderCube(e,o,this._ggxMaterial)}}}_blur(e,t){this._blurMaterial===null&&(this._blurMaterial=Vv());let n=this._blurMaterial,r=n.uniforms,s=this._sourceTarget;r.sigma.value=Math.min(t,Math.PI)/Math.SQRT2,r.envMap.value=s.texture,this._renderCube(e,0,n),r.envMap.value=e.texture,this._renderCube(s,0,n)}};function bd(i,e,t){return new Mo(i,{minFilter:li,generateMipmaps:e,type:ht,colorSpace:un,depthBuffer:t})}function To(i,e,t){return new $t({name:i,uniforms:e,vertexShader:ct.cube_vert,fragmentShader:t,side:Kt,blending:_n,depthTest:!1,depthWrite:!1})}function Hv(){return To("PMREMGGXConvolution",{envMap:{value:null},roughness:{value:0},lodBias:{value:0}},`

		#define GGX_SAMPLES ${Wd}u

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float lodBias;

		#include <common>

		// Van der Corput radical inverse
		float radicalInverse_VdC( uint bits ) {

			bits = ( bits << 16u ) | ( bits >> 16u );
			bits = ( ( bits & 0x55555555u ) << 1u ) | ( ( bits & 0xAAAAAAAAu ) >> 1u );
			bits = ( ( bits & 0x33333333u ) << 2u ) | ( ( bits & 0xCCCCCCCCu ) >> 2u );
			bits = ( ( bits & 0x0F0F0F0Fu ) << 4u ) | ( ( bits & 0xF0F0F0F0u ) >> 4u );
			bits = ( ( bits & 0x00FF00FFu ) << 8u ) | ( ( bits & 0xFF00FF00u ) >> 8u );
			return float( bits ) * 2.3283064365386963e-10; // / 0x100000000

		}

		// Hammersley sequence
		vec2 hammersley( uint i, uint N ) {

			return vec2( float( i ) / float( N ), radicalInverse_VdC( i ) );

		}

		void main() {

			vec3 N = normalize( vWorldDirection );

			// For very low roughness, just sample the environment directly
			if ( roughness < 0.001 ) {

				gl_FragColor = vec4( textureLod( envMap, N, 0.0 ).rgb, 1.0 );
				return;

			}

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			// Tangent space basis for VNDF sampling
			vec3 up = abs( N.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, N ) );
			vec3 bitangent = cross( N, tangent );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			for ( uint i = 0u; i < GGX_SAMPLES; i ++ ) {

				vec2 Xi = hammersley( i, GGX_SAMPLES );

				// With V = N, sample the reflected direction directly.
				float invQ = 1.0 / ( 1.0 - Xi.x + alpha2 * Xi.x );
				float NdotL = ( 1.0 - Xi.x - alpha2 * Xi.x ) * invQ;

				if ( NdotL > 0.0 ) {

					float phi = 2.0 * PI * Xi.y;
					float sinTheta = 2.0 * alpha * sqrt( Xi.x * ( 1.0 - Xi.x ) ) * invQ;
					vec3 L = N * NdotL + ( tangent * cos( phi ) + bitangent * sin( phi ) ) * sinTheta;

					// Match the source mip to the sample's solid angle. The terms
					// independent of the sample are precomputed in lodBias.
					float d = alpha2 * invQ;
					float lod = max( log2( d ) + lodBias, 0.0 );

					// Weight by NdotL for the split-sum approximation
					prefilteredColor += textureLod( envMap, L, lod ).rgb * NdotL;
					totalWeight += NdotL;

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function Gv(){return To("PMREMGGXIntegration",{envMap:{value:null},roughness:{value:0},sourceLod:{value:0},sourceSize:{value:Xd}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float sourceLod;
		uniform int sourceSize;

		void main() {

			vec3 N = normalize( vWorldDirection );

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			float texelSize = 2.0 / float( sourceSize );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			// Pair opposite texels: only the one in N's hemisphere contributes.
			for ( int face = 0; face < 3; face ++ ) {

				for ( int y = 0; y < sourceSize; y ++ ) {

					for ( int x = 0; x < sourceSize; x ++ ) {

						vec2 uv = ( vec2( x, y ) + 0.5 ) * texelSize - 1.0;
						vec3 texelDirection = face == 0 ? vec3( 1.0, uv ) : ( face == 1 ? vec3( uv.x, 1.0, uv.y ) : vec3( uv, 1.0 ) );

						float invDistance = inversesqrt( 1.0 + dot( uv, uv ) );
						float NdotL = dot( N, texelDirection );
						texelDirection *= NdotL < 0.0 ? - 1.0 : 1.0;
						NdotL = abs( NdotL ) * invDistance;

						// With V = N, NdotH squared is ( 1 + NdotL ) / 2. Common factors
						// in the GGX distribution and texel solid angle cancel when normalized.
						float d = 1.0 + alpha2 + ( alpha2 - 1.0 ) * NdotL;
						float weight = NdotL * invDistance * invDistance * invDistance / ( d * d );

						prefilteredColor += textureLod( envMap, texelDirection, sourceLod ).rgb * weight;
						totalWeight += weight;

					}

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function Vv(){return To("PMREMSphericalGaussianBlur",{envMap:{value:null},sigma:{value:0}},`

		#define SAMPLES ${Ov}
		#define GOLDEN_ANGLE 2.39996322973

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float sigma;

		#include <common>

		void main() {

			vec3 outputDirection = normalize( vWorldDirection );

			vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, outputDirection ) );
			vec3 bitangent = cross( outputDirection, tangent );

			// Truncate the kernel at three standard deviations or at the antipode.
			float thetaMax = min( 3.0 * sigma, PI );
			float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

			vec3 accumColor = vec3( 0.0 );
			float accumWeight = 0.0;

			for ( int i = 0; i < SAMPLES; i ++ ) {

				// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
				float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
				float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
				float phi = float( i ) * GOLDEN_ANGLE;

				vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
				vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

				// Correct the planar sample density to solid angle.
				float weight = sin( theta ) / theta;

				accumColor += weight * textureLod( envMap, sampleDirection, 0.0 ).rgb;
				accumWeight += weight;

			}

			gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

		}
	`)}function Md(){return To("PMREMEquirectangularToCubemap",{envMap:{value:null}},`

		varying vec3 vWorldDirection;

		uniform sampler2D envMap;

		#include <common>

		void main() {

			// Average four subpixel samples to preserve small, bright features.
			vec3 direction = normalize( vWorldDirection );
			vec3 dx = dFdx( direction ) * 0.25;
			vec3 dy = dFdy( direction ) * 0.25;

			vec3 color = textureLod( envMap, equirectUv( normalize( direction - dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction - dx + dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx + dy ) ), 0.0 ).rgb;
			gl_FragColor = vec4( color * 0.25, 1.0 );

		}
	`)}function Td(){return To("PMREMCubemapToCubemap",{envMap:{value:null},flipEnvMap:{value:-1}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float flipEnvMap;

		void main() {

			gl_FragColor = vec4( textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) ).rgb, 1.0 );

		}
	`)}function Wv(i){let e=new WeakMap,t=new WeakMap,n=null;function r(c,d=!1){return c==null?null:d?o(c):s(c)}function s(c){if(c&&c.isTexture){let d=c.mapping;if(d===ai||d===Qa)if(e.has(c)){let x=e.get(c).texture;return a(x,c.mapping)}else{let x=c.image;if(x&&x.height>0){let S=new Mo(x.height);return S.fromEquirectangularTexture(i,c),e.set(c,S),c.addEventListener("dispose",u),a(S.texture,c.mapping)}else return null}}return c}function o(c){if(c&&c.isTexture&&c.isPMREMTexture!==!0){let d=c.mapping,x=d===ai||d===Qa,S=d===xr||d===rs;if(x||S){let p=t.get(c),g=p!==void 0?p.texture.pmremVersion:0;if(c.isRenderTargetTexture&&c.pmremVersion!==g)return n===null&&(n=new Nl(i)),p=x?n.fromEquirectangular(c,p):n.fromCubemap(c,p),p.texture.pmremVersion=c.pmremVersion,t.set(c,p),p.texture;if(p!==void 0)return p.texture;{let y=c.image;return x&&y&&y.height>0||S&&y&&l(y)?(n===null&&(n=new Nl(i)),p=x?n.fromEquirectangular(c):n.fromCubemap(c),p.texture.pmremVersion=c.pmremVersion,t.set(c,p),c.addEventListener("dispose",f),p.texture):null}}}return c}function a(c,d){return d===ai?c.mapping=xr:d===Qa&&(c.mapping=rs),c}function l(c){let d=0,x=6;for(let S=0;S<x;S++)c[S]!==void 0&&d++;return d===x}function u(c){let d=c.target;d.removeEventListener("dispose",u);let x=e.get(d);x!==void 0&&(e.delete(d),x.dispose())}function f(c){let d=c.target;d.removeEventListener("dispose",f);let x=t.get(d);x!==void 0&&(t.delete(d),x.dispose())}function h(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:r,dispose:h}}function Xv(i){let e={};function t(n){if(e[n]!==void 0)return e[n];let r=i.getExtension(n);return e[n]=r,r}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let r=t(n);return r===null&&Bi("WebGLRenderer: "+n+" extension not supported."),r}}}function qv(i,e,t,n){let r={},s=new WeakMap,o=new FinalizationRegistry(x=>delete r[x]);function a(x){l(x.target)}function l(x){x.index!==null&&e.remove(x.index);for(let p in x.attributes)e.remove(x.attributes[p]);x.removeEventListener("dispose",a),delete r[x.id],o.unregister(x);let S=s.get(x);S&&(e.remove(S),s.delete(x)),n.releaseStatesOfGeometry(x),x.isInstancedBufferGeometry===!0&&delete x._maxInstanceCount,t.memory.geometries--}function u(x,S){return r[S.id]!==void 0||(S.addEventListener("dispose",a),r[S.id]=new WeakRef(S),o.register(S,S.id,S),t.memory.geometries++),S}function f(x){let S=x.attributes;for(let p in S)e.update(S[p],i.ARRAY_BUFFER)}function h(x){let S=x.index,p=x.attributes.position,g=0;if(p===void 0)return;let y=S!==null?S.array.length:p.array.length/3-1,T=p.count>=65535?Ys:qs,M=new T(Math.ceil(y/3)*6,1),A=M.array;if(S!==null){let _=S.array;g=S.version;for(let w=0,L=0;w<y;w+=3){let I=_[w+0],N=_[w+1],U=_[w+2];A[L++]=I,A[L++]=N,A[L++]=N,A[L++]=U,A[L++]=U,A[L++]=I}}else{g=p.version;for(let _=0,w=0;_<y;_+=3){let L=_+0,I=_+1,N=_+2;A[w++]=L,A[w++]=I,A[w++]=I,A[w++]=N,A[w++]=N,A[w++]=L}}M.version=g;let E=s.get(x);E&&e.remove(E),s.set(x,M)}function c(x){let S=s.get(x);if(S){let p=x.index;p!==null&&S.version<p.version&&h(x)}else h(x);return s.get(x)}function d(){for(let x in r){let S=r[x].deref();S!==void 0&&l(S)}}return{get:u,update:f,getWireframeAttribute:c,dispose:d}}function Yv(i,e,t){let n;function r(h){n=h}let s,o;function a(h){s=h.type,o=h.bytesPerElement}function l(h,c){i.drawElements(n,c,s,h*o),t.update(c,n,1)}function u(h,c,d){d!==0&&(i.drawElementsInstanced(n,c,s,h*o,d),t.update(c,n,d))}function f(h,c,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,c,0,s,h,0,d);let S=0;for(let p=0;p<d;p++)S+=c[p];t.update(S,n,1)}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=u,this.renderMultiDraw=f}function Zv(i){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,o,a){switch(t.calls++,o){case i.TRIANGLES:t.triangles+=a*(s/3);break;case i.LINES:t.lines+=a*(s/2);break;case i.LINE_STRIP:t.lines+=a*(s-1);break;case i.LINE_LOOP:t.lines+=a*s;break;case i.POINTS:t.points+=a*s;break;default:Ke("WebGLInfo: Unknown draw mode:",o);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:n}}function $v(i,e,t){let n=new WeakMap,r=new St;function s(o,a,l){let u=o.morphTargetInfluences,f=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,h=f!==void 0?f.length:0,c=n.get(a);if(c===void 0||c.count!==h){let L=function(){_.dispose(),n.delete(a),a.removeEventListener("dispose",L)};c!==void 0&&c.texture.dispose();let d=a.morphAttributes.position!==void 0,x=a.morphAttributes.normal!==void 0,S=a.morphAttributes.color!==void 0,p=a.morphAttributes.position||[],g=a.morphAttributes.normal||[],y=a.morphAttributes.color||[],T=0;d===!0&&(T=1),x===!0&&(T=2),S===!0&&(T=3);let M=a.attributes.position.count*T,A=1;M>e.maxTextureSize&&(A=Math.ceil(M/e.maxTextureSize),M=e.maxTextureSize);let E=new Float32Array(M*A*4*h),_=new zi(E,M,A,h);_.type=tt,_.needsUpdate=!0;let w=T*4;for(let I=0;I<h;I++){let N=p[I],U=g[I],z=y[I],D=M*A*4*I;for(let G=0;G<N.count;G++){let W=G*w;d===!0&&(r.fromBufferAttribute(N,G),E[D+W+0]=r.x,E[D+W+1]=r.y,E[D+W+2]=r.z,E[D+W+3]=0),x===!0&&(r.fromBufferAttribute(U,G),E[D+W+4]=r.x,E[D+W+5]=r.y,E[D+W+6]=r.z,E[D+W+7]=0),S===!0&&(r.fromBufferAttribute(z,G),E[D+W+8]=r.x,E[D+W+9]=r.y,E[D+W+10]=r.z,E[D+W+11]=z.itemSize===4?r.w:1)}}c={count:h,texture:_,size:new Ue(M,A)},n.set(a,c),a.addEventListener("dispose",L)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",o.morphTexture,t);else{let d=0;for(let S=0;S<u.length;S++)d+=u[S];let x=a.morphTargetsRelative?1:1-d;l.getUniforms().setValue(i,"morphTargetBaseInfluence",x),l.getUniforms().setValue(i,"morphTargetInfluences",u)}l.getUniforms().setValue(i,"morphTargetsTexture",c.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",c.size)}return{update:s}}function Jv(i,e,t,n,r){let s=new WeakMap;function o(u){let f=r.render.frame,h=u.geometry,c=e.get(u,h);if(s.get(c)!==f&&(e.update(c),s.set(c,f)),u.isInstancedMesh&&(u.hasEventListener("dispose",l)===!1&&u.addEventListener("dispose",l),s.get(u)!==f&&(t.update(u.instanceMatrix,i.ARRAY_BUFFER),u.instanceColor!==null&&t.update(u.instanceColor,i.ARRAY_BUFFER),s.set(u,f))),u.isSkinnedMesh){let d=u.skeleton;s.get(d)!==f&&(d.update(),s.set(d,f))}return c}function a(){s=new WeakMap}function l(u){let f=u.target;f.removeEventListener("dispose",l),n.releaseStatesOfObject(f),t.remove(f.instanceMatrix),f.instanceColor!==null&&t.remove(f.instanceColor)}return{update:o,dispose:a}}var Kv={[Fu]:"LINEAR_TONE_MAPPING",[oo]:"REINHARD_TONE_MAPPING",[ao]:"CINEON_TONE_MAPPING",[lo]:"ACES_FILMIC_TONE_MAPPING",[co]:"AGX_TONE_MAPPING",[uo]:"NEUTRAL_TONE_MAPPING",[Nu]:"CUSTOM_TONE_MAPPING"};function Qv(i,e,t,n,r,s){let o=new zt(e,t,{type:i,depthBuffer:r,stencilBuffer:s,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,u=null,f=new Ot;f.setAttribute("position",new Xt([-1,3,0,-1,-1,0,3,-1,0],3)),f.setAttribute("uv",new Xt([0,2,0,0,2,0],2));let h=new Oa({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),c=new xn(f,h),d=new Wi(-1,1,1,-1,0,1),x=null,S=null,p=!1,g,y=null,T=[],M=!1;this.setSize=function(A,E){o.setSize(A,E),a!==null&&a.setSize(A,E),l!==null&&l.setSize(A,E);for(let _=0;_<T.length;_++){let w=T[_];w.setSize&&w.setSize(A,E)}},this.setEffects=function(A){T=A,M=T.length>0&&T[0].isRenderPass===!0;let E=o.width,_=o.height;T.length>0&&a===null&&(a=new zt(E,_,{type:ht,depthBuffer:!1,stencilBuffer:!1}),l=new zt(E,_,{type:ht,depthBuffer:!1,stencilBuffer:!1}));let w=r===!0&&T.some(L=>L.needsDepthTexture===!0);w!==(o.depthTexture!==null)&&(w===!0&&u===null&&(u=new wi(E,_),s===!0&&(u.format=Ai,u.type=vr)),o.dispose(),o.depthTexture=w?u:null,o.resolveDepthBuffer=w,o.storeMultisampledDepthBuffer=w);for(let L=0;L<T.length;L++){let I=T[L];I.setSize&&I.setSize(E,_),w&&I.needsDepthTexture===!0&&I.setDepthTexture&&I.setDepthTexture(u)}},this.begin=function(A,E){if(p||A.toneMapping===Ln&&T.length===0)return!1;if(y=E,E!==null){let _=E.width,w=E.height;(o.width!==_||o.height!==w)&&this.setSize(_,w)}return M===!1&&A.setRenderTarget(o),g=A.toneMapping,A.toneMapping=Ln,!0},this.hasRenderPass=function(){return M},this.end=function(A,E){A.toneMapping=g,p=!0;let _=o,w=a;for(let L=0;L<T.length;L++){let I=T[L];I.enabled!==!1&&(I.render(A,w,_,E),I.needsSwap!==!1&&(_=w,w=w===a?l:a))}if(x!==A.outputColorSpace||S!==A.toneMapping){x=A.outputColorSpace,S=A.toneMapping,h.defines={},dt.getTransfer(x)===wt&&(h.defines.SRGB_TRANSFER="");let L=Kv[S];L&&(h.defines[L]=""),h.needsUpdate=!0}h.uniforms.tDiffuse.value=_.texture,A.setRenderTarget(y),A.render(c,d),y=null,p=!1},this.isCompositing=function(){return p},this.dispose=function(){o.dispose(),a!==null&&a.dispose(),l!==null&&l.dispose(),f.dispose(),h.dispose()}}var qd=new Dn,Yd=new wi(1,1),Zd=new $s(1),$d=new zi,Jd=new Na,Kd=new Zs,wd=[],Ad=[],Ed=new Float32Array(16),Rd=new Float32Array(9),Cd=new Float32Array(4);function cs(i,e,t){let n=i[0];if(n<=0||n>0)return i;let r=e*t,s=wd[r];if(s===void 0&&(s=new Float32Array(r),wd[r]=s),e!==0){n.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,i[o].toArray(s,a)}return s}function Qt(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function jt(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Ol(i,e){let t=Ad[e];t===void 0&&(t=new Int32Array(e),Ad[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function jv(i,e){let t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function e_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Qt(t,e))return;i.uniform2fv(this.addr,e),jt(t,e)}}function t_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Qt(t,e))return;i.uniform3fv(this.addr,e),jt(t,e)}}function n_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Qt(t,e))return;i.uniform4fv(this.addr,e),jt(t,e)}}function i_(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(Qt(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),jt(t,e)}else{if(Qt(t,n))return;Cd.set(n),i.uniformMatrix2fv(this.addr,!1,Cd),jt(t,n)}}function r_(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(Qt(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),jt(t,e)}else{if(Qt(t,n))return;Rd.set(n),i.uniformMatrix3fv(this.addr,!1,Rd),jt(t,n)}}function s_(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(Qt(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),jt(t,e)}else{if(Qt(t,n))return;Ed.set(n),i.uniformMatrix4fv(this.addr,!1,Ed),jt(t,n)}}function o_(i,e){let t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function a_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Qt(t,e))return;i.uniform2iv(this.addr,e),jt(t,e)}}function l_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Qt(t,e))return;i.uniform3iv(this.addr,e),jt(t,e)}}function c_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Qt(t,e))return;i.uniform4iv(this.addr,e),jt(t,e)}}function u_(i,e){let t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function h_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Qt(t,e))return;i.uniform2uiv(this.addr,e),jt(t,e)}}function f_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Qt(t,e))return;i.uniform3uiv(this.addr,e),jt(t,e)}}function d_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Qt(t,e))return;i.uniform4uiv(this.addr,e),jt(t,e)}}function Bl(i){return i.version===0&&(i.compareFunction=Wu,i.needsUpdate=!0),i}function p_(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r);let s;this.type===i.SAMPLER_2D_SHADOW?s=Bl(Yd):s=qd,t.setTexture2D(e||s,r)}function m_(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture3D(e||Jd,r)}function g_(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r);let s;this.type===i.SAMPLER_CUBE_SHADOW?s=Bl(Zd):s=Kd,t.setTextureCube(e||s,r)}function x_(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture2DArray(e||$d,r)}function v_(i){switch(i){case 5126:return jv;case 35664:return e_;case 35665:return t_;case 35666:return n_;case 35674:return i_;case 35675:return r_;case 35676:return s_;case 5124:case 35670:return o_;case 35667:case 35671:return a_;case 35668:case 35672:return l_;case 35669:case 35673:return c_;case 5125:return u_;case 36294:return h_;case 36295:return f_;case 36296:return d_;case 35678:case 36198:case 36298:case 36306:case 35682:return p_;case 35679:case 36299:case 36307:return m_;case 35680:case 36300:case 36308:case 36293:return g_;case 36289:case 36303:case 36311:case 36292:return x_}}function __(i,e){i.uniform1fv(this.addr,e)}function y_(i,e){let t=cs(e,this.size,2);i.uniform2fv(this.addr,t)}function S_(i,e){let t=cs(e,this.size,3);i.uniform3fv(this.addr,t)}function b_(i,e){let t=cs(e,this.size,4);i.uniform4fv(this.addr,t)}function M_(i,e){let t=cs(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function T_(i,e){let t=cs(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function w_(i,e){let t=cs(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function A_(i,e){i.uniform1iv(this.addr,e)}function E_(i,e){i.uniform2iv(this.addr,e)}function R_(i,e){i.uniform3iv(this.addr,e)}function C_(i,e){i.uniform4iv(this.addr,e)}function I_(i,e){i.uniform1uiv(this.addr,e)}function P_(i,e){i.uniform2uiv(this.addr,e)}function D_(i,e){i.uniform3uiv(this.addr,e)}function L_(i,e){i.uniform4uiv(this.addr,e)}function F_(i,e,t){let n=this.cache,r=e.length,s=Ol(t,r);Qt(n,s)||(i.uniform1iv(this.addr,s),jt(n,s));let o;this.type===i.SAMPLER_2D_SHADOW?o=Bl(Yd):o=qd;for(let a=0;a!==r;++a)t.setTexture2D(e[a]||o,s[a])}function N_(i,e,t){let n=this.cache,r=e.length,s=Ol(t,r);Qt(n,s)||(i.uniform1iv(this.addr,s),jt(n,s));for(let o=0;o!==r;++o)t.setTexture3D(e[o]||Jd,s[o])}function U_(i,e,t){let n=this.cache,r=e.length,s=Ol(t,r);Qt(n,s)||(i.uniform1iv(this.addr,s),jt(n,s));let o;this.type===i.SAMPLER_CUBE_SHADOW?o=Bl(Zd):o=Kd;for(let a=0;a!==r;++a)t.setTextureCube(e[a]||o,s[a])}function O_(i,e,t){let n=this.cache,r=e.length,s=Ol(t,r);Qt(n,s)||(i.uniform1iv(this.addr,s),jt(n,s));for(let o=0;o!==r;++o)t.setTexture2DArray(e[o]||$d,s[o])}function B_(i){switch(i){case 5126:return __;case 35664:return y_;case 35665:return S_;case 35666:return b_;case 35674:return M_;case 35675:return T_;case 35676:return w_;case 5124:case 35670:return A_;case 35667:case 35671:return E_;case 35668:case 35672:return R_;case 35669:case 35673:return C_;case 5125:return I_;case 36294:return P_;case 36295:return D_;case 36296:return L_;case 35678:case 36198:case 36298:case 36306:case 35682:return F_;case 35679:case 36299:case 36307:return N_;case 35680:case 36300:case 36308:case 36293:return U_;case 36289:case 36303:case 36311:case 36292:return O_}}var sh=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=v_(t.type)}},oh=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=B_(t.type)}},ah=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let s=0,o=r.length;s!==o;++s){let a=r[s];a.setValue(e,t[a.id],n)}}},ih=/(\w+)(\])?(\[|\.)?/g;function Id(i,e){i.seq.push(e),i.map[e.id]=e}function z_(i,e,t){let n=i.name,r=n.length;for(ih.lastIndex=0;;){let s=ih.exec(n),o=ih.lastIndex,a=s[1],l=s[2]==="]",u=s[3];if(l&&(a=a|0),u===void 0||u==="["&&o+2===r){Id(t,u===void 0?new sh(a,i,e):new oh(a,i,e));break}else{let h=t.map[a];h===void 0&&(h=new ah(a),Id(t,h)),t=h}}}var as=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let o=0;o<n;++o){let a=e.getActiveUniform(t,o),l=e.getUniformLocation(t,a.name);z_(a,l,this)}let r=[],s=[];for(let o of this.seq)o.type===e.SAMPLER_2D_SHADOW||o.type===e.SAMPLER_CUBE_SHADOW||o.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(o):s.push(o);r.length>0&&(this.seq=r.concat(s))}setValue(e,t,n,r){let s=this.map[t];s!==void 0&&s.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let s=0,o=t.length;s!==o;++s){let a=t[s],l=n[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,s=e.length;r!==s;++r){let o=e[r];o.id in t&&n.push(o)}return n}};function Pd(i,e,t){let n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}var k_=37297,H_=0;function G_(i,e){let t=i.split(`
`),n=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let o=r;o<s;o++){let a=o+1;n.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return n.join(`
`)}var Dd=new je;function V_(i){dt._getMatrix(Dd,dt.workingColorSpace,i);let e=`mat3( ${Dd.elements.map(t=>t.toFixed(4))} )`;switch(dt.getTransfer(i)){case ks:return[e,"LinearTransferOETF"];case wt:return[e,"sRGBTransferOETF"];default:return Xe("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function Ld(i,e,t){let n=i.getShaderParameter(e,i.COMPILE_STATUS),s=(i.getShaderInfoLog(e)||"").trim();if(n&&s==="")return"";let o=/ERROR: 0:(\d+)/.exec(s);if(o){let a=parseInt(o[1]);return t.toUpperCase()+`

`+s+`

`+G_(i.getShaderSource(e),a)}else return s}function W_(i,e){let t=V_(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( ${t[0]} * value.rgb, value.a ) );`,"}"].join(`
`)}var X_={[Fu]:"Linear",[oo]:"Reinhard",[ao]:"Cineon",[lo]:"ACESFilmic",[co]:"AgX",[uo]:"Neutral",[Nu]:"Custom"};function q_(i,e){let t=X_[e];return t===void 0?(Xe("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var Fl=new H;function Y_(){dt.getLuminanceCoefficients(Fl);let i=Fl.x.toFixed(4),e=Fl.y.toFixed(4),t=Fl.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Z_(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(bo).join(`
`)}function $_(i){let e=[];for(let t in i){let n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function J_(i,e){let t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let r=0;r<n;r++){let s=i.getActiveAttrib(e,r),o=s.name,a=1;s.type===i.FLOAT_MAT2&&(a=2),s.type===i.FLOAT_MAT3&&(a=3),s.type===i.FLOAT_MAT4&&(a=4),t[o]={type:s.type,location:i.getAttribLocation(e,o),locationSize:a}}return t}function bo(i){return i!==""}function Fd(i,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows).replace(/NUM_LIGHT_PROBE_GRIDS/g,e.numLightProbeGrids)}function Nd(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var K_=/^[ \t]*#include +<([\w\d./]+)>/gm;function lh(i){return i.replace(K_,Q_)}function Q_(i,e){let t=ct[e];if(t===void 0)throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">");return lh(t)}var j_=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Ud(i){return i.replace(j_,ey)}function ey(i,e,t,n){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function Od(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}var ty={[ro]:"SHADOWMAP_TYPE_PCF",[is]:"SHADOWMAP_TYPE_VSM"};function ny(i){return ty[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var iy={[rs]:"ENVMAP_MODE_REFRACTION"};function ry(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":iy[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var sy={[Lu]:"ENVMAP_BLENDING_MULTIPLY",[ed]:"ENVMAP_BLENDING_MIX",[td]:"ENVMAP_BLENDING_ADD"};function oy(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":sy[i.combine]||"ENVMAP_BLENDING_NONE"}function ay(i,e,t,n){let r=i.getContext(),s=t.defines,o=t.vertexShader,a=t.fragmentShader,l=ny(t),u=t.envMapPMREM===!0?"ENVMAP_TYPE_PMREM":"ENVMAP_TYPE_CUBE",f=ry(t),h=oy(t),c=Z_(t),d=$_(s),x=r.createProgram(),S,p,g=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(S=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,d].filter(bo).join(`
`),S.length>0&&(S+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,d].filter(bo).join(`
`),p.length>0&&(p+=`
`)):(S=[Od(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,d,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+f:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.diffuseRoughnessMapUv?"#define DIFFUSE_ROUGHNESSMAP_UV "+t.diffuseRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(bo).join(`
`),p=[Od(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,d,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.envMap?"#define "+f:"",t.envMap?"#define "+h:"",t.envMapPMREM?"#define ENVMAP_MAX_LOD "+t.envMapMaxLod+".0":"",t.envMapPMREM?"#define ENVMAP_SIZE "+t.envMapSize+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.diffuseRoughness?"#define USE_DIFFUSE_ROUGHNESS":"",t.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Ln?"#define TONE_MAPPING":"",t.toneMapping!==Ln?ct.tonemapping_pars_fragment:"",t.toneMapping!==Ln?q_("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",ct.colorspace_pars_fragment,W_("linearToOutputTexel",t.outputColorSpace),Y_(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(bo).join(`
`)),o=lh(o),o=Fd(o,t),o=Nd(o,t),a=lh(a),a=Fd(a,t),a=Nd(a,t),o=Ud(o),a=Ud(a),t.isRawShaderMaterial!==!0&&(g=`#version 300 es
`,S=[c,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+S,p=["#define varying in",t.glslVersion===Xu?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Xu?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);let y=g+S+o,T=g+p+a,M=Pd(r,r.VERTEX_SHADER,y),A=Pd(r,r.FRAGMENT_SHADER,T);r.attachShader(x,M),r.attachShader(x,A),t.index0AttributeName!==void 0?r.bindAttribLocation(x,0,t.index0AttributeName):t.hasPositionAttribute===!0&&r.bindAttribLocation(x,0,"position"),r.linkProgram(x);function E(I){if(i.debug.checkShaderErrors){let N=r.getProgramInfoLog(x)||"",U=r.getShaderInfoLog(M)||"",z=r.getShaderInfoLog(A)||"",D=N.trim(),G=U.trim(),W=z.trim(),Z=!0,le=!0;if(r.getProgramParameter(x,r.LINK_STATUS)===!1)if(Z=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(r,x,M,A);else{let J=Ld(r,M,"vertex"),se=Ld(r,A,"fragment");Ke("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(x,r.VALIDATE_STATUS)+`

Material Name: `+I.name+`
Material Type: `+I.type+`

Program Info Log: `+D+`
`+J+`
`+se)}else D!==""?Xe("WebGLProgram: Program Info Log:",D):(G===""||W==="")&&(le=!1);le&&(I.diagnostics={runnable:Z,programLog:D,vertexShader:{log:G,prefix:S},fragmentShader:{log:W,prefix:p}})}r.deleteShader(M),r.deleteShader(A),_=new as(r,x),w=J_(r,x)}let _;this.getUniforms=function(){return _===void 0&&E(this),_};let w;this.getAttributes=function(){return w===void 0&&E(this),w};let L=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return L===!1&&(L=r.getProgramParameter(x,k_)),L},this.destroy=function(){n.releaseStatesOfProgram(this),r.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=H_++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=M,this.fragmentShader=A,this}var ly=0,ch=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new uh(e),t.set(e,n)),n}},uh=class{constructor(e){this.id=ly++,this.code=e,this.usedTimes=0}};function cy(i){return i===an||i===vo||i===_o}function uy(i,e,t,n,r,s){let o=new Xs,a=new ch,l=new Set,u=[],f=new Map,h=n.logarithmicDepthBuffer,c={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function d(_){return l.add(_),_===0?"uv":`uv${_}`}function x(_,w,L,I,N,U){let z=I.fog,D=N.geometry,G=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?I.environment:null,W=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,Z=e.get(_.envMap||G,W),le=c[_.type],J=n.precision;_.precision!==null&&(J=n.getMaxPrecision(_.precision),J!==_.precision&&Xe("WebGLProgram.getParameters:",_.precision,"not supported, using",J,"instead."));let se=D.morphAttributes.position||D.morphAttributes.normal||D.morphAttributes.color,ae=se!==void 0?se.length:0,ye=0;D.morphAttributes.position!==void 0&&(ye=1),D.morphAttributes.normal!==void 0&&(ye=2),D.morphAttributes.color!==void 0&&(ye=3);let Le,j,he,Ce;if(le){let Pe=ui[le];Le=Pe.vertexShader,j=Pe.fragmentShader}else{Le=_.vertexShader,j=_.fragmentShader;let Pe=a.getVertexShaderStage(_),_t=a.getFragmentShaderStage(_);a.update(_,Pe,_t),he=Pe.id,Ce=_t.id}let Oe=i.getRenderTarget(),fe=i.state.buffers.depth.getReversed(),ke=N.isInstancedMesh===!0,mt=N.isBatchedMesh===!0,Be=!!_.map,at=!!_.matcap,ft=!!Z,rt=ft&&Z.isPMREMTexture===!0,Ht=!!_.aoMap,Bt=!!_.lightMap,en=!!_.bumpMap&&_.wireframe===!1,Ft=!!_.normalMap,Gn=!!_.displacementMap,Vt=!!_.emissiveMap,Sn=!!_.metalnessMap,bn=!!_.roughnessMap,In=_.anisotropy>0,q=_.clearcoat>0,Mn=_.diffuseRoughness>0,Ct=_.dispersion>0,It=_.retroreflectivity>0,Ee=_.iridescence>0,Wt=_.sheen>0,Ge=_.transmission>0,et=In&&!!_.anisotropyMap,B=q&&!!_.clearcoatMap,R=q&&!!_.clearcoatNormalMap,K=q&&!!_.clearcoatRoughnessMap,xe=Mn&&!!_.diffuseRoughnessMap,ce=Ee&&!!_.iridescenceMap,be=Ee&&!!_.iridescenceThicknessMap,Re=Wt&&!!_.sheenColorMap,ne=Wt&&!!_.sheenRoughnessMap,re=!!_.specularMap,Me=!!_.specularColorMap,k=!!_.specularIntensityMap,ie=Ge&&!!_.transmissionMap,Q=Ge&&!!_.thicknessMap,we=!!_.gradientMap,ve=!!_.alphaMap,Te=_.alphaTest>0,ze=!!_.alphaHash,st=!!_.extensions,_e=Ln;_.toneMapped&&(Oe===null||Oe.isXRRenderTarget===!0)&&(_e=i.toneMapping);let He=rt?Z.isCompressedCubeTexture?Z.image[0].mipmaps:Z.mipmaps:null,it={shaderID:le,shaderType:_.type,shaderName:_.name,vertexShader:Le,fragmentShader:j,defines:_.defines,customVertexShaderID:he,customFragmentShaderID:Ce,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:J,batching:mt,batchingColor:mt&&N._colorsTexture!==null,instancing:ke,instancingColor:ke&&N.instanceColor!==null,instancingMorph:ke&&N.morphTexture!==null,outputColorSpace:Oe===null?i.outputColorSpace:Oe.isXRRenderTarget===!0?Oe.texture.colorSpace:dt.workingColorSpace,alphaToCoverage:!!_.alphaToCoverage,map:Be,matcap:at,envMap:ft,envMapMode:ft&&Z.mapping,envMapPMREM:rt,envMapMaxLod:rt?He.length-1:null,envMapSize:rt?He[0].width:null,aoMap:Ht,lightMap:Bt,bumpMap:en,normalMap:Ft,displacementMap:Gn,emissiveMap:Vt,normalMapObjectSpace:Ft&&_.normalMapType===rd,normalMapTangentSpace:Ft&&_.normalMapType===Dl,packedNormalMap:Ft&&_.normalMapType===Dl&&cy(_.normalMap.format),metalnessMap:Sn,roughnessMap:bn,anisotropy:In,anisotropyMap:et,clearcoat:q,clearcoatMap:B,clearcoatNormalMap:R,clearcoatRoughnessMap:K,diffuseRoughness:Mn,diffuseRoughnessMap:xe,dispersion:Ct,retroreflection:It,iridescence:Ee,iridescenceMap:ce,iridescenceThicknessMap:be,sheen:Wt,sheenColorMap:Re,sheenRoughnessMap:ne,specularMap:re,specularColorMap:Me,specularIntensityMap:k,transmission:Ge,transmissionMap:ie,thicknessMap:Q,gradientMap:we,opaque:_.transparent===!1&&_.blending===oi&&_.alphaToCoverage===!1,alphaMap:ve,alphaTest:Te,alphaHash:ze,combine:_.combine,mapUv:Be&&d(_.map.channel),aoMapUv:Ht&&d(_.aoMap.channel),lightMapUv:Bt&&d(_.lightMap.channel),bumpMapUv:en&&d(_.bumpMap.channel),normalMapUv:Ft&&d(_.normalMap.channel),displacementMapUv:Gn&&d(_.displacementMap.channel),emissiveMapUv:Vt&&d(_.emissiveMap.channel),metalnessMapUv:Sn&&d(_.metalnessMap.channel),roughnessMapUv:bn&&d(_.roughnessMap.channel),anisotropyMapUv:et&&d(_.anisotropyMap.channel),clearcoatMapUv:B&&d(_.clearcoatMap.channel),clearcoatNormalMapUv:R&&d(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:K&&d(_.clearcoatRoughnessMap.channel),diffuseRoughnessMapUv:xe&&d(_.diffuseRoughnessMap.channel),iridescenceMapUv:ce&&d(_.iridescenceMap.channel),iridescenceThicknessMapUv:be&&d(_.iridescenceThicknessMap.channel),sheenColorMapUv:Re&&d(_.sheenColorMap.channel),sheenRoughnessMapUv:ne&&d(_.sheenRoughnessMap.channel),specularMapUv:re&&d(_.specularMap.channel),specularColorMapUv:Me&&d(_.specularColorMap.channel),specularIntensityMapUv:k&&d(_.specularIntensityMap.channel),transmissionMapUv:ie&&d(_.transmissionMap.channel),thicknessMapUv:Q&&d(_.thicknessMap.channel),alphaMapUv:ve&&d(_.alphaMap.channel),vertexTangents:!!D.attributes.tangent&&(Ft||In),vertexNormals:!!D.attributes.normal,vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!D.attributes.color&&D.attributes.color.itemSize===4,pointsUvs:N.isPoints===!0&&!!D.attributes.uv&&(Be||ve),fog:!!z,useFog:_.fog===!0,fogExp2:!!z&&z.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||D.attributes.normal===void 0&&Ft===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:h,reversedDepthBuffer:fe,skinning:N.isSkinnedMesh===!0,hasPositionAttribute:D.attributes.position!==void 0,morphTargets:D.morphAttributes.position!==void 0,morphNormals:D.morphAttributes.normal!==void 0,morphColors:D.morphAttributes.color!==void 0,morphTargetsCount:ae,morphTextureStride:ye,numSunLights:w.sun.length,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numSunLightShadows:w.sunShadowMap.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numLightProbeGrids:U.filter(Pe=>Pe.texture!==null).length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:_.dithering,shadowMapEnabled:i.shadowMap.enabled&&L.length>0,shadowMapType:i.shadowMap.type,toneMapping:_e,decodeVideoTexture:Be&&_.map.isVideoTexture===!0&&dt.getTransfer(_.map.colorSpace)===wt,decodeVideoTextureEmissive:Vt&&_.emissiveMap.isVideoTexture===!0&&dt.getTransfer(_.emissiveMap.colorSpace)===wt,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===vn,flipSided:_.side===Kt,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:st&&_.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(st&&_.extensions.multiDraw===!0||mt)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return it.vertexUv1s=l.has(1),it.vertexUv2s=l.has(2),it.vertexUv3s=l.has(3),l.clear(),it}function S(_){let w=[];if(_.shaderID?w.push(_.shaderID):(w.push(_.customVertexShaderID),w.push(_.customFragmentShaderID)),_.defines!==void 0)for(let L in _.defines)w.push(L),w.push(_.defines[L]);return _.isRawShaderMaterial===!1&&(p(w,_),g(w,_),w.push(i.outputColorSpace)),w.push(_.customProgramCacheKey),w.join()}function p(_,w){_.push(w.precision),_.push(w.outputColorSpace),_.push(w.envMapMode),_.push(w.envMapPMREM),_.push(w.envMapMaxLod),_.push(w.envMapSize),_.push(w.mapUv),_.push(w.alphaMapUv),_.push(w.lightMapUv),_.push(w.aoMapUv),_.push(w.bumpMapUv),_.push(w.normalMapUv),_.push(w.displacementMapUv),_.push(w.emissiveMapUv),_.push(w.metalnessMapUv),_.push(w.roughnessMapUv),_.push(w.anisotropyMapUv),_.push(w.clearcoatMapUv),_.push(w.clearcoatNormalMapUv),_.push(w.clearcoatRoughnessMapUv),_.push(w.diffuseRoughnessMapUv),_.push(w.iridescenceMapUv),_.push(w.iridescenceThicknessMapUv),_.push(w.sheenColorMapUv),_.push(w.sheenRoughnessMapUv),_.push(w.specularMapUv),_.push(w.specularColorMapUv),_.push(w.specularIntensityMapUv),_.push(w.transmissionMapUv),_.push(w.thicknessMapUv),_.push(w.combine),_.push(w.fogExp2),_.push(w.sizeAttenuation),_.push(w.morphTargetsCount),_.push(w.numSunLights),_.push(w.numDirLights),_.push(w.numPointLights),_.push(w.numSpotLights),_.push(w.numSpotLightMaps),_.push(w.numHemiLights),_.push(w.numRectAreaLights),_.push(w.numSunLightShadows),_.push(w.numDirLightShadows),_.push(w.numPointLightShadows),_.push(w.numSpotLightShadows),_.push(w.numSpotLightShadowsWithMaps),_.push(w.numLightProbes),_.push(w.numLightProbeGrids),_.push(w.shadowMapType),_.push(w.toneMapping),_.push(w.numClippingPlanes),_.push(w.numClipIntersection),_.push(w.depthPacking)}function g(_,w){o.disableAll(),w.instancing&&o.enable(0),w.instancingColor&&o.enable(1),w.instancingMorph&&o.enable(2),w.matcap&&o.enable(3),w.envMap&&o.enable(4),w.normalMapObjectSpace&&o.enable(5),w.normalMapTangentSpace&&o.enable(6),w.clearcoat&&o.enable(7),w.iridescence&&o.enable(8),w.alphaTest&&o.enable(9),w.vertexColors&&o.enable(10),w.vertexAlphas&&o.enable(11),w.vertexUv1s&&o.enable(12),w.vertexUv2s&&o.enable(13),w.vertexUv3s&&o.enable(14),w.vertexTangents&&o.enable(15),w.anisotropy&&o.enable(16),w.alphaHash&&o.enable(17),w.batching&&o.enable(18),w.dispersion&&o.enable(19),w.retroreflection&&o.enable(24),w.diffuseRoughness&&o.enable(25),w.batchingColor&&o.enable(20),w.gradientMap&&o.enable(21),w.packedNormalMap&&o.enable(22),w.vertexNormals&&o.enable(23),_.push(o.mask),o.disableAll(),w.fog&&o.enable(0),w.useFog&&o.enable(1),w.flatShading&&o.enable(2),w.logarithmicDepthBuffer&&o.enable(3),w.reversedDepthBuffer&&o.enable(4),w.skinning&&o.enable(5),w.morphTargets&&o.enable(6),w.morphNormals&&o.enable(7),w.morphColors&&o.enable(8),w.premultipliedAlpha&&o.enable(9),w.shadowMapEnabled&&o.enable(10),w.doubleSided&&o.enable(11),w.flipSided&&o.enable(12),w.useDepthPacking&&o.enable(13),w.dithering&&o.enable(14),w.transmission&&o.enable(15),w.sheen&&o.enable(16),w.opaque&&o.enable(17),w.pointsUvs&&o.enable(18),w.decodeVideoTexture&&o.enable(19),w.decodeVideoTextureEmissive&&o.enable(20),w.alphaToCoverage&&o.enable(21),w.numLightProbeGrids>0&&o.enable(22),w.hasPositionAttribute&&o.enable(23),_.push(o.mask)}function y(_){let w=c[_.type],L;if(w){let I=ui[w];L=vd.clone(I.uniforms)}else L=_.uniforms;return L}function T(_,w){let L=f.get(w);return L!==void 0?++L.usedTimes:(L=new ay(i,w,_,r),u.push(L),f.set(w,L)),L}function M(_){if(--_.usedTimes===0){let w=u.indexOf(_);u[w]=u[u.length-1],u.pop(),f.delete(_.cacheKey),_.destroy()}}function A(_){a.remove(_)}function E(){a.dispose()}return{getParameters:x,getProgramCacheKey:S,getUniforms:y,acquireProgram:T,releaseProgram:M,releaseShaderCache:A,programs:u,dispose:E}}function hy(){let i=new WeakMap;function e(o){return i.has(o)}function t(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function r(o,a,l){i.get(o)[a]=l}function s(){i=new WeakMap}return{has:e,get:t,remove:n,update:r,dispose:s}}function fy(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.materialVariant!==e.materialVariant?i.materialVariant-e.materialVariant:i.z!==e.z?i.z-e.z:i.id-e.id}function Bd(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function zd(){let i=[],e=0,t=[],n=[],r=[];function s(){e=0,t.length=0,n.length=0,r.length=0}function o(c){let d=0;return c.isInstancedMesh&&(d+=2),c.isSkinnedMesh&&(d+=1),d}function a(c,d,x,S,p,g){let y=i[e];return y===void 0?(y={id:c.id,object:c,geometry:d,material:x,materialVariant:o(c),groupOrder:S,renderOrder:c.renderOrder,z:p,group:g},i[e]=y):(y.id=c.id,y.object=c,y.geometry=d,y.material=x,y.materialVariant=o(c),y.groupOrder=S,y.renderOrder=c.renderOrder,y.z=p,y.group=g),e++,y}function l(c,d,x,S,p,g,y){y.reversedDepth===!0&&(p=-p);let T=a(c,d,x,S,p,g);x.transmission>0?n.push(T):x.transparent===!0?r.push(T):t.push(T)}function u(c,d,x,S,p,g){let y=a(c,d,x,S,p,g);x.transmission>0?n.unshift(y):x.transparent===!0?r.unshift(y):t.unshift(y)}function f(c,d){t.length>1&&t.sort(c||fy),n.length>1&&n.sort(d||Bd),r.length>1&&r.sort(d||Bd)}function h(){for(let c=e,d=i.length;c<d;c++){let x=i[c];if(x.id===null)break;x.id=null,x.object=null,x.geometry=null,x.material=null,x.group=null}}return{opaque:t,transmissive:n,transparent:r,init:s,push:l,unshift:u,finish:h,sort:f}}function dy(){let i=new WeakMap;function e(n,r){let s=i.get(n),o;return s===void 0?(o=new zd,i.set(n,[o])):r>=s.length?(o=new zd,s.push(o)):o=s[r],o}function t(){i=new WeakMap}return{get:e,dispose:t}}function py(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new H,color:new Je};break;case"SpotLight":t={position:new H,direction:new H,color:new Je,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new H,color:new Je,distance:0,decay:0};break;case"HemisphereLight":t={direction:new H,skyColor:new Je,groundColor:new Je};break;case"RectAreaLight":t={color:new Je,position:new H,halfWidth:new H,halfHeight:new H};break}return i[e.id]=t,t}}}function my(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ue};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ue};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ue,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}var gy=0;function xy(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function vy(i){let e=new py,t=my(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let u=0;u<9;u++)n.probe.push(new H);let r=new H,s=new Ze,o=new Ze;function a(u){let f=0,h=0,c=0;for(let U=0;U<9;U++)n.probe[U].set(0,0,0);let d=0,x=0,S=0,p=0,g=0,y=0,T=0,M=0,A=0,E=0,_=0,w=0,L=0,I=0;u.sort(xy);for(let U=0,z=u.length;U<z;U++){let D=u[U],G=D.color,W=D.intensity,Z=D.distance,le=null;if(D.shadow&&D.shadow.map&&(D.shadow.map.texture.format===an?le=D.shadow.map.texture:le=D.shadow.map.depthTexture||D.shadow.map.texture),D.isAmbientLight)f+=G.r*W,h+=G.g*W,c+=G.b*W;else if(D.isLightProbe){for(let J=0;J<9;J++)n.probe[J].addScaledVector(D.sh.coefficients[J],W);I++}else if(D.isSunLight){let J=e.get(D);if(J.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){let se=D.shadow,ae=t.get(D);ae.shadowIntensity=se.intensity,ae.shadowBias=se.bias,ae.shadowNormalBias=se.normalBias,ae.shadowRadius=se.radius,ae.shadowMapSize.copy(se.mapSize).multiply(se.getFrameExtents()),n.sunShadow[x]=ae,n.sunShadowMap[x]=le;let ye=se.getViewportCount();for(let Le=0;Le<ye;Le++)n.sunShadowMatrix[S+Le]=se.getMatrix(Le),n.sunShadowCascade[S+Le]=se._cascadeData[Le];S+=ye,x++}n.sun[d]=J,d++}else if(D.isDirectionalLight){let J=e.get(D);if(J.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){let se=D.shadow,ae=t.get(D);ae.shadowIntensity=se.intensity,ae.shadowBias=se.bias,ae.shadowNormalBias=se.normalBias,ae.shadowRadius=se.radius,ae.shadowMapSize=se.mapSize,n.directionalShadow[p]=ae,n.directionalShadowMap[p]=le,n.directionalShadowMatrix[p]=D.shadow.matrix,A++}n.directional[p]=J,p++}else if(D.isSpotLight){let J=e.get(D);J.position.setFromMatrixPosition(D.matrixWorld),J.color.copy(G).multiplyScalar(W),J.distance=Z,J.coneCos=Math.cos(D.angle),J.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),J.decay=D.decay,n.spot[y]=J;let se=D.shadow;if(D.map&&(n.spotLightMap[w]=D.map,w++,se.updateMatrices(D),D.castShadow&&L++),n.spotLightMatrix[y]=se.matrix,D.castShadow){let ae=t.get(D);ae.shadowIntensity=se.intensity,ae.shadowBias=se.bias,ae.shadowNormalBias=se.normalBias,ae.shadowRadius=se.radius,ae.shadowMapSize=se.mapSize,n.spotShadow[y]=ae,n.spotShadowMap[y]=le,_++}y++}else if(D.isRectAreaLight){let J=e.get(D);J.color.copy(G).multiplyScalar(W),J.halfWidth.set(D.width*.5,0,0),J.halfHeight.set(0,D.height*.5,0),n.rectArea[T]=J,T++}else if(D.isPointLight){let J=e.get(D);if(J.color.copy(D.color).multiplyScalar(D.intensity),J.distance=D.distance,J.decay=D.decay,D.castShadow){let se=D.shadow,ae=t.get(D);ae.shadowIntensity=se.intensity,ae.shadowBias=se.bias,ae.shadowNormalBias=se.normalBias,ae.shadowRadius=se.radius,ae.shadowMapSize=se.mapSize,ae.shadowCameraNear=se.camera.near,ae.shadowCameraFar=se.camera.far,n.pointShadow[g]=ae,n.pointShadowMap[g]=le,n.pointShadowMatrix[g]=D.shadow.matrix,E++}n.point[g]=J,g++}else if(D.isHemisphereLight){let J=e.get(D);J.skyColor.copy(D.color).multiplyScalar(W),J.groundColor.copy(D.groundColor).multiplyScalar(W),n.hemi[M]=J,M++}}T>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Fe.LTC_FLOAT_1,n.rectAreaLTC2=Fe.LTC_FLOAT_2):(n.rectAreaLTC1=Fe.LTC_HALF_1,n.rectAreaLTC2=Fe.LTC_HALF_2)),n.ambient[0]=f,n.ambient[1]=h,n.ambient[2]=c;let N=n.hash;(N.sunLength!==d||N.directionalLength!==p||N.pointLength!==g||N.spotLength!==y||N.rectAreaLength!==T||N.hemiLength!==M||N.numSunShadows!==x||N.numDirectionalShadows!==A||N.numPointShadows!==E||N.numSpotShadows!==_||N.numSpotMaps!==w||N.numLightProbes!==I)&&(n.sun.length=d,n.directional.length=p,n.spot.length=y,n.rectArea.length=T,n.point.length=g,n.hemi.length=M,n.sunShadow.length=x,n.sunShadowMap.length=x,n.sunShadowMatrix.length=S,n.sunShadowCascade.length=S,n.directionalShadow.length=A,n.directionalShadowMap.length=A,n.directionalShadowMatrix.length=A,n.pointShadow.length=E,n.pointShadowMap.length=E,n.pointShadowMatrix.length=E,n.spotShadow.length=_,n.spotShadowMap.length=_,n.spotLightMatrix.length=_+w-L,n.spotLightMap.length=w,n.numSpotLightShadowsWithMaps=L,n.numLightProbes=I,N.sunLength=d,N.directionalLength=p,N.pointLength=g,N.spotLength=y,N.rectAreaLength=T,N.hemiLength=M,N.numSunShadows=x,N.numDirectionalShadows=A,N.numPointShadows=E,N.numSpotShadows=_,N.numSpotMaps=w,N.numLightProbes=I,n.version=gy++)}function l(u,f){let h=0,c=0,d=0,x=0,S=0,p=0,g=f.matrixWorldInverse;for(let y=0,T=u.length;y<T;y++){let M=u[y];if(M.isSunLight){let A=n.sun[h];A.direction.setFromMatrixPosition(M.matrixWorld),A.direction.transformDirection(g),h++}else if(M.isDirectionalLight){let A=n.directional[c];A.direction.setFromMatrixPosition(M.matrixWorld),r.setFromMatrixPosition(M.target.matrixWorld),A.direction.sub(r),A.direction.transformDirection(g),c++}else if(M.isSpotLight){let A=n.spot[x];A.position.setFromMatrixPosition(M.matrixWorld),A.position.applyMatrix4(g),A.direction.setFromMatrixPosition(M.matrixWorld),r.setFromMatrixPosition(M.target.matrixWorld),A.direction.sub(r),A.direction.transformDirection(g),x++}else if(M.isRectAreaLight){let A=n.rectArea[S];A.position.setFromMatrixPosition(M.matrixWorld),A.position.applyMatrix4(g),o.identity(),s.copy(M.matrixWorld),s.premultiply(g),o.extractRotation(s),A.halfWidth.set(M.width*.5,0,0),A.halfHeight.set(0,M.height*.5,0),A.halfWidth.applyMatrix4(o),A.halfHeight.applyMatrix4(o),S++}else if(M.isPointLight){let A=n.point[d];A.position.setFromMatrixPosition(M.matrixWorld),A.position.applyMatrix4(g),d++}else if(M.isHemisphereLight){let A=n.hemi[p];A.direction.setFromMatrixPosition(M.matrixWorld),A.direction.transformDirection(g),p++}}}return{setup:a,setupView:l,state:n}}function kd(i){let e=new vy(i),t=[],n=[],r=[];function s(h){f.camera=h,t.length=0,n.length=0,r.length=0}function o(h){h.isLightProbeGrid?r.push(h):t.push(h)}function a(h){n.push(h)}function l(){e.setup(t),r.sort((h,c)=>h.priority-c.priority||h.id-c.id)}function u(h){e.setupView(t,h)}let f={lightsArray:t,shadowsArray:n,lightProbeGridArray:r,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:f,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:a}}function _y(i){let e=new WeakMap;function t(r,s=0){let o=e.get(r),a;return o===void 0?(a=new kd(i),e.set(r,[a])):s>=o.length?(a=new kd(i),o.push(a)):a=o[s],a}function n(){e=new WeakMap}return{get:t,dispose:n}}var yy=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Sy=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,by=[new H(1,0,0),new H(-1,0,0),new H(0,1,0),new H(0,-1,0),new H(0,0,1),new H(0,0,-1)],My=[new H(0,-1,0),new H(0,-1,0),new H(0,0,1),new H(0,0,-1),new H(0,-1,0),new H(0,-1,0)],Hd=new Ze,So=new H,rh=new H;function Ty(i,e,t){let n=new dr,r=new Ue,s=new Ue,o=new St,a=new Ba,l=new za,u={},f=t.maxTextureSize,h={[En]:Kt,[Kt]:En,[vn]:vn},c=new $t({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ue},radius:{value:4}},vertexShader:yy,fragmentShader:Sy}),d=c.clone();d.defines.HORIZONTAL_PASS=1;let x=new Ot;x.setAttribute("position",new yt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let S=new xn(x,c),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=ro;let g=this.type;this.render=function(E,_,w){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||E.length===0)return;this.type===Nf&&(Xe("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=ro);let L=i.getRenderTarget(),I=i.getActiveCubeFace(),N=i.getActiveMipmapLevel(),U=i.state;U.setBlending(_n),U.buffers.depth.getReversed()===!0?U.buffers.color.setClear(0,0,0,0):U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);let z=g!==this.type;z&&_.traverse(function(D){D.material&&(Array.isArray(D.material)?D.material.forEach(G=>G.needsUpdate=!0):D.material.needsUpdate=!0)});for(let D=0,G=E.length;D<G;D++){let W=E[D],Z=W.shadow;if(Z===void 0){Xe("WebGLShadowMap:",W,"has no shadow.");continue}if(Z.autoUpdate===!1&&Z.needsUpdate===!1)continue;r.copy(Z.mapSize);let le=Z.getFrameExtents();r.multiply(le),s.copy(Z.mapSize),(r.x>f||r.y>f)&&(r.x>f&&(s.x=Math.floor(f/le.x),r.x=s.x*le.x,Z.mapSize.x=s.x),r.y>f&&(s.y=Math.floor(f/le.y),r.y=s.y*le.y,Z.mapSize.y=s.y));let J=i.state.buffers.depth.getReversed();if(Z.camera._reversedDepth=J,Z.map===null||z===!0){if(Z.map!==null&&(Z.map.depthTexture!==null&&(Z.map.depthTexture.dispose(),Z.map.depthTexture=null),Z.map.dispose()),this.type===is){if(W.isPointLight){Xe("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}Z.map=new zt(r.x,r.y,{format:an,type:ht,minFilter:lt,magFilter:lt,generateMipmaps:!1}),Z.map.texture.name=W.name+".shadowMap",Z.map.depthTexture=new wi(r.x,r.y,tt),Z.map.depthTexture.name=W.name+".shadowMapDepth",Z.map.depthTexture.format=Mi,Z.map.depthTexture.compareFunction=null,Z.map.depthTexture.minFilter=Qe,Z.map.depthTexture.magFilter=Qe}else W.isPointLight?(Z.map=new Mo(r.x),Z.map.depthTexture=new $s(r.x,on)):(Z.map=new zt(r.x,r.y),Z.map.depthTexture=new wi(r.x,r.y,on)),Z.map.depthTexture.name=W.name+".shadowMap",Z.map.depthTexture.format=Mi,this.type===ro?(Z.map.depthTexture.compareFunction=J?Vu:Gu,Z.map.depthTexture.minFilter=lt,Z.map.depthTexture.magFilter=lt):(Z.map.depthTexture.compareFunction=null,Z.map.depthTexture.minFilter=Qe,Z.map.depthTexture.magFilter=Qe);Z.camera.updateProjectionMatrix()}Z.map.isWebGLCubeRenderTarget!==!0&&(Z.map.width!==r.x||Z.map.height!==r.y)&&Z.map.setSize(r.x,r.y);let se=Z.map.isWebGLCubeRenderTarget?6:Z.getViewportCount();W.isPointLight!==!0&&Z.updateMatrices(W,w);let ae=(Z.camera.layers.mask&4294967294)!==0?Z.camera.layers:w.layers;for(let ye=0;ye<se;ye++){let Le=Z.getCamera(ye);if(W.isPointLight){let j=Z.camera,he=Z.matrix,Ce=W.distance||j.far;Ce!==j.far&&(j.far=Ce,j.updateProjectionMatrix()),So.setFromMatrixPosition(W.matrixWorld),j.position.copy(So),rh.copy(j.position),rh.add(by[ye]),j.up.copy(My[ye]),j.lookAt(rh),j.updateMatrixWorld(),he.makeTranslation(-So.x,-So.y,-So.z),Hd.multiplyMatrices(j.projectionMatrix,j.matrixWorldInverse),Z._frustum.setFromProjectionMatrix(Hd,j.coordinateSystem,j.reversedDepth)}if(Z.map.isWebGLCubeRenderTarget)i.setRenderTarget(Z.map,ye),i.clear();else{ye===0&&(i.setRenderTarget(Z.map),i.clear());let j=Z.getViewport(ye);o.set(s.x*j.x,s.y*j.y,s.x*j.z,s.y*j.w),U.viewport(o)}n=Z.getFrustum(ye),M(_,w,Le,W,ae,this.type)}Z.isPointLightShadow!==!0&&this.type===is&&y(Z,w),Z.needsUpdate=!1}g=this.type,p.needsUpdate=!1,i.setRenderTarget(L,I,N)};function y(E,_){let w=e.update(S);c.defines.VSM_SAMPLES!==E.blurSamples&&(c.defines.VSM_SAMPLES=E.blurSamples,d.defines.VSM_SAMPLES=E.blurSamples,c.needsUpdate=!0,d.needsUpdate=!0),E.mapPass===null?E.mapPass=new zt(r.x,r.y,{format:an,type:ht}):(E.mapPass.width!==E.map.width||E.mapPass.height!==E.map.height)&&E.mapPass.setSize(E.map.width,E.map.height),c.uniforms.shadow_pass.value=E.map.depthTexture,c.uniforms.resolution.value.set(E.map.width,E.map.height),c.uniforms.radius.value=E.radius,i.setRenderTarget(E.mapPass),i.clear(),i.renderBufferDirect(_,null,w,c,S,null),d.uniforms.shadow_pass.value=E.mapPass.texture,d.uniforms.resolution.value.set(E.map.width,E.map.height),d.uniforms.radius.value=E.radius,i.setRenderTarget(E.map),i.clear(),i.renderBufferDirect(_,null,w,d,S,null)}function T(E,_,w,L){let I=null,N=w.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(N!==void 0)I=N;else if(I=w.isPointLight===!0?l:a,i.localClippingEnabled&&_.clipShadows===!0&&Array.isArray(_.clippingPlanes)&&_.clippingPlanes.length!==0||_.displacementMap&&_.displacementScale!==0||_.alphaMap&&_.alphaTest>0||_.map&&_.alphaTest>0||_.alphaToCoverage===!0){let U=I.uuid,z=_.uuid,D=u[U];D===void 0&&(D={},u[U]=D);let G=D[z];G===void 0&&(G=I.clone(),D[z]=G,_.addEventListener("dispose",A)),I=G}if(I.visible=_.visible,I.wireframe=_.wireframe,L===is?I.side=_.shadowSide!==null?_.shadowSide:_.side:I.side=_.shadowSide!==null?_.shadowSide:h[_.side],I.alphaMap=_.alphaMap,I.alphaTest=_.alphaToCoverage===!0?.5:_.alphaTest,I.map=_.map,I.clipShadows=_.clipShadows,I.clippingPlanes=_.clippingPlanes,I.clipIntersection=_.clipIntersection,I.displacementMap=_.displacementMap,I.displacementScale=_.displacementScale,I.displacementBias=_.displacementBias,I.wireframeLinewidth=_.wireframeLinewidth,I.linewidth=_.linewidth,w.isPointLight===!0&&I.isMeshDistanceMaterial===!0){let U=i.properties.get(I);U.light=w}return I}function M(E,_,w,L,I,N){if(E.visible===!1)return;if(E.layers.test(I)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&N===is)&&(!E.frustumCulled||E.intersectsFrustum(n))){E.modelViewMatrix.multiplyMatrices(w.matrixWorldInverse,E.matrixWorld);let D=e.update(E),G=E.material;if(Array.isArray(G)){let W=D.groups;for(let Z=0,le=W.length;Z<le;Z++){let J=W[Z],se=G[J.materialIndex];if(se&&se.visible){let ae=T(E,se,L,N);E.onBeforeShadow(i,E,_,w,D,ae,J),i.renderBufferDirect(w,null,D,ae,E,J),E.onAfterShadow(i,E,_,w,D,ae,J)}}}else if(G.visible){let W=T(E,G,L,N);E.onBeforeShadow(i,E,_,w,D,W,null),i.renderBufferDirect(w,null,D,W,E,null),E.onAfterShadow(i,E,_,w,D,W,null)}}let z=E.children;for(let D=0,G=z.length;D<G;D++)M(z[D],_,w,L,I,N)}function A(E){E.target.removeEventListener("dispose",A);for(let w in u){let L=u[w],I=E.target.uuid;I in L&&(L[I].dispose(),delete L[I])}}}function wy(i,e){function t(){let k=!1,ie=new St,Q=null,we=new St(0,0,0,0);return{setMask:function(ve){Q!==ve&&!k&&(i.colorMask(ve,ve,ve,ve),Q=ve)},setLocked:function(ve){k=ve},setClear:function(ve,Te,ze,st,_e){_e===!0&&(ve*=st,Te*=st,ze*=st),ie.set(ve,Te,ze,st),we.equals(ie)===!1&&(i.clearColor(ve,Te,ze,st),we.copy(ie))},reset:function(){k=!1,Q=null,we.set(-1,0,0,0)}}}function n(){let k=!1,ie=!1,Q=null,we=null,ve=null;return{setReversed:function(Te){if(ie!==Te){let ze=e.get("EXT_clip_control");Te?ze.clipControlEXT(ze.LOWER_LEFT_EXT,ze.ZERO_TO_ONE_EXT):ze.clipControlEXT(ze.LOWER_LEFT_EXT,ze.NEGATIVE_ONE_TO_ONE_EXT),ie=Te;let st=ve;ve=null,this.setClear(st)}},getReversed:function(){return ie},setTest:function(Te){Te?fe(i.DEPTH_TEST):ke(i.DEPTH_TEST)},setMask:function(Te){Q!==Te&&!k&&(i.depthMask(Te),Q=Te)},setFunc:function(Te){if(ie&&(Te=md[Te]),we!==Te){switch(Te){case Ma:i.depthFunc(i.NEVER);break;case Ta:i.depthFunc(i.ALWAYS);break;case wa:i.depthFunc(i.LESS);break;case Yr:i.depthFunc(i.LEQUAL);break;case Aa:i.depthFunc(i.EQUAL);break;case Ea:i.depthFunc(i.GEQUAL);break;case Ra:i.depthFunc(i.GREATER);break;case Ca:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}we=Te}},setLocked:function(Te){k=Te},setClear:function(Te){ve!==Te&&(ve=Te,ie&&(Te=1-Te),i.clearDepth(Te))},reset:function(){k=!1,Q=null,we=null,ve=null,ie=!1}}}function r(){let k=!1,ie=null,Q=null,we=null,ve=null,Te=null,ze=null,st=null,_e=null;return{setTest:function(He){k||(He?fe(i.STENCIL_TEST):ke(i.STENCIL_TEST))},setMask:function(He){ie!==He&&!k&&(i.stencilMask(He),ie=He)},setFunc:function(He,it,Pe){(Q!==He||we!==it||ve!==Pe)&&(i.stencilFunc(He,it,Pe),Q=He,we=it,ve=Pe)},setOp:function(He,it,Pe){(Te!==He||ze!==it||st!==Pe)&&(i.stencilOp(He,it,Pe),Te=He,ze=it,st=Pe)},setLocked:function(He){k=He},setClear:function(He){_e!==He&&(i.clearStencil(He),_e=He)},reset:function(){k=!1,ie=null,Q=null,we=null,ve=null,Te=null,ze=null,st=null,_e=null}}}let s=new t,o=new n,a=new r,l={},u=new WeakMap,f={},h={},c={},d=new WeakMap,x=[],S=null,p=!1,g=null,y=null,T=null,M=null,A=null,E=null,_=null,w=new Je(0,0,0),L=0,I=!1,N=null,U=null,z=null,D=null,G=null,W=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),Z=!1,le=0,J=i.getParameter(i.VERSION);J.indexOf("WebGL")!==-1?(le=parseFloat(/^WebGL (\d)/.exec(J)[1]),Z=le>=1):J.indexOf("OpenGL ES")!==-1&&(le=parseFloat(/^OpenGL ES (\d)/.exec(J)[1]),Z=le>=2);let se=null,ae={},ye=i.getParameter(i.SCISSOR_BOX),Le=i.getParameter(i.VIEWPORT),j=new St().fromArray(ye),he=new St().fromArray(Le);function Ce(k,ie,Q,we){let ve=new Uint8Array(4),Te=i.createTexture();i.bindTexture(k,Te),i.texParameteri(k,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(k,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let ze=0;ze<Q;ze++)k===i.TEXTURE_3D||k===i.TEXTURE_2D_ARRAY?i.texImage3D(ie,0,i.RGBA,1,1,we,0,i.RGBA,i.UNSIGNED_BYTE,ve):i.texImage2D(ie+ze,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,ve);return Te}let Oe={};Oe[i.TEXTURE_2D]=Ce(i.TEXTURE_2D,i.TEXTURE_2D,1),Oe[i.TEXTURE_CUBE_MAP]=Ce(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),Oe[i.TEXTURE_2D_ARRAY]=Ce(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),Oe[i.TEXTURE_3D]=Ce(i.TEXTURE_3D,i.TEXTURE_3D,1,1),s.setClear(0,0,0,1),o.setClear(1),a.setClear(0),fe(i.DEPTH_TEST),o.setFunc(Yr),en(!1),Ft(Ru),fe(i.CULL_FACE),Ht(_n);function fe(k){f[k]!==!0&&(i.enable(k),f[k]=!0)}function ke(k){f[k]!==!1&&(i.disable(k),f[k]=!1)}function mt(k,ie){return c[k]!==ie?(i.bindFramebuffer(k,ie),c[k]=ie,k===i.DRAW_FRAMEBUFFER&&(c[i.FRAMEBUFFER]=ie),k===i.FRAMEBUFFER&&(c[i.DRAW_FRAMEBUFFER]=ie),!0):!1}function Be(k,ie){let Q=x,we=!1;if(k){Q=d.get(ie),Q===void 0&&(Q=[],d.set(ie,Q));let ve=k.textures;if(Q.length!==ve.length||Q[0]!==i.COLOR_ATTACHMENT0){for(let Te=0,ze=ve.length;Te<ze;Te++)Q[Te]=i.COLOR_ATTACHMENT0+Te;Q.length=ve.length,we=!0}}else Q[0]!==i.BACK&&(Q[0]=i.BACK,we=!0);we&&i.drawBuffers(Q)}function at(k){return S!==k?(i.useProgram(k),S=k,!0):!1}let ft={[gr]:i.FUNC_ADD,[Of]:i.FUNC_SUBTRACT,[Bf]:i.FUNC_REVERSE_SUBTRACT};ft[zf]=i.MIN,ft[kf]=i.MAX;let rt={[Hf]:i.ZERO,[Gf]:i.ONE,[Vf]:i.SRC_COLOR,[Pu]:i.SRC_ALPHA,[$f]:i.SRC_ALPHA_SATURATE,[Yf]:i.DST_COLOR,[Xf]:i.DST_ALPHA,[Wf]:i.ONE_MINUS_SRC_COLOR,[Du]:i.ONE_MINUS_SRC_ALPHA,[Zf]:i.ONE_MINUS_DST_COLOR,[qf]:i.ONE_MINUS_DST_ALPHA,[Jf]:i.CONSTANT_COLOR,[Kf]:i.ONE_MINUS_CONSTANT_COLOR,[Qf]:i.CONSTANT_ALPHA,[jf]:i.ONE_MINUS_CONSTANT_ALPHA};function Ht(k,ie,Q,we,ve,Te,ze,st,_e,He){if(k===_n){p===!0&&(ke(i.BLEND),p=!1);return}if(p===!1&&(fe(i.BLEND),p=!0),k!==Uf){if(k!==g||He!==I){if((y!==gr||A!==gr)&&(i.blendEquation(i.FUNC_ADD),y=gr,A=gr),He)switch(k){case oi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case so:i.blendFunc(i.ONE,i.ONE);break;case Cu:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Iu:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Ke("WebGLState: Invalid blending: ",k);break}else switch(k){case oi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case so:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case Cu:Ke("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Iu:Ke("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ke("WebGLState: Invalid blending: ",k);break}T=null,M=null,E=null,_=null,w.set(0,0,0),L=0,g=k,I=He}return}ve=ve||ie,Te=Te||Q,ze=ze||we,(ie!==y||ve!==A)&&(i.blendEquationSeparate(ft[ie],ft[ve]),y=ie,A=ve),(Q!==T||we!==M||Te!==E||ze!==_)&&(i.blendFuncSeparate(rt[Q],rt[we],rt[Te],rt[ze]),T=Q,M=we,E=Te,_=ze),(st.equals(w)===!1||_e!==L)&&(i.blendColor(st.r,st.g,st.b,_e),w.copy(st),L=_e),g=k,I=!1}function Bt(k,ie){k.side===vn?ke(i.CULL_FACE):fe(i.CULL_FACE);let Q=k.side===Kt;ie&&(Q=!Q),en(Q),k.blending===oi&&k.transparent===!1?Ht(_n):Ht(k.blending,k.blendEquation,k.blendSrc,k.blendDst,k.blendEquationAlpha,k.blendSrcAlpha,k.blendDstAlpha,k.blendColor,k.blendAlpha,k.premultipliedAlpha),o.setFunc(k.depthFunc),o.setTest(k.depthTest),o.setMask(k.depthWrite),s.setMask(k.colorWrite);let we=k.stencilWrite;a.setTest(we),we&&(a.setMask(k.stencilWriteMask),a.setFunc(k.stencilFunc,k.stencilRef,k.stencilFuncMask),a.setOp(k.stencilFail,k.stencilZFail,k.stencilZPass)),Vt(k.polygonOffset,k.polygonOffsetFactor,k.polygonOffsetUnits),k.alphaToCoverage===!0?fe(i.SAMPLE_ALPHA_TO_COVERAGE):ke(i.SAMPLE_ALPHA_TO_COVERAGE)}function en(k){N!==k&&(k?i.frontFace(i.CW):i.frontFace(i.CCW),N=k)}function Ft(k){k!==Lf?(fe(i.CULL_FACE),k!==U&&(k===Ru?i.cullFace(i.BACK):k===Ff?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):ke(i.CULL_FACE),U=k}function Gn(k){k!==z&&(Z&&i.lineWidth(k),z=k)}function Vt(k,ie,Q){k?(fe(i.POLYGON_OFFSET_FILL),(D!==ie||G!==Q)&&(D=ie,G=Q,o.getReversed()&&(ie=-ie,Q=-Q),i.polygonOffset(ie,Q))):ke(i.POLYGON_OFFSET_FILL)}function Sn(k){k?fe(i.SCISSOR_TEST):ke(i.SCISSOR_TEST)}function bn(k){k===void 0&&(k=i.TEXTURE0+W-1),se!==k&&(i.activeTexture(k),se=k)}function In(k,ie,Q){Q===void 0&&(se===null?Q=i.TEXTURE0+W-1:Q=se);let we=ae[Q];we===void 0&&(we={type:void 0,texture:void 0},ae[Q]=we),(we.type!==k||we.texture!==ie)&&(se!==Q&&(i.activeTexture(Q),se=Q),i.bindTexture(k,ie||Oe[k]),we.type=k,we.texture=ie)}function q(){let k=ae[se];k!==void 0&&k.type!==void 0&&(i.bindTexture(k.type,null),k.type=void 0,k.texture=void 0)}function Mn(){try{i.compressedTexImage2D(...arguments)}catch(k){Ke("WebGLState:",k)}}function Ct(){try{i.compressedTexImage3D(...arguments)}catch(k){Ke("WebGLState:",k)}}function It(){try{i.texSubImage2D(...arguments)}catch(k){Ke("WebGLState:",k)}}function Ee(){try{i.texSubImage3D(...arguments)}catch(k){Ke("WebGLState:",k)}}function Wt(){try{i.compressedTexSubImage2D(...arguments)}catch(k){Ke("WebGLState:",k)}}function Ge(){try{i.compressedTexSubImage3D(...arguments)}catch(k){Ke("WebGLState:",k)}}function et(){try{i.texStorage2D(...arguments)}catch(k){Ke("WebGLState:",k)}}function B(){try{i.texStorage3D(...arguments)}catch(k){Ke("WebGLState:",k)}}function R(){try{i.texImage2D(...arguments)}catch(k){Ke("WebGLState:",k)}}function K(){try{i.texImage3D(...arguments)}catch(k){Ke("WebGLState:",k)}}function xe(k){return h[k]!==void 0?h[k]:i.getParameter(k)}function ce(k,ie){h[k]!==ie&&(i.pixelStorei(k,ie),h[k]=ie)}function be(k){j.equals(k)===!1&&(i.scissor(k.x,k.y,k.z,k.w),j.copy(k))}function Re(k){he.equals(k)===!1&&(i.viewport(k.x,k.y,k.z,k.w),he.copy(k))}function ne(k,ie){let Q=u.get(ie);Q===void 0&&(Q=new WeakMap,u.set(ie,Q));let we=Q.get(k);we===void 0&&(we=i.getUniformBlockIndex(ie,k.name),i.uniformBlockBinding(ie,we,we),Q.set(k,we))}function re(k,ie,Q){let ve=u.get(ie).get(k);l[ve]!==Q&&(i.bindBufferBase(i.UNIFORM_BUFFER,ve,Q),l[ve]=Q)}function Me(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),f={},h={},se=null,ae={},c={},l={},d=new WeakMap,x=[],S=null,p=!1,g=null,y=null,T=null,M=null,A=null,E=null,_=null,w=new Je(0,0,0),L=0,I=!1,N=null,U=null,z=null,D=null,G=null,j.set(0,0,i.canvas.width,i.canvas.height),he.set(0,0,i.canvas.width,i.canvas.height),s.reset(),o.reset(),a.reset()}return{buffers:{color:s,depth:o,stencil:a},enable:fe,disable:ke,bindFramebuffer:mt,drawBuffers:Be,useProgram:at,setBlending:Ht,setMaterial:Bt,setFlipSided:en,setCullFace:Ft,setLineWidth:Gn,setPolygonOffset:Vt,setScissorTest:Sn,activeTexture:bn,bindTexture:In,unbindTexture:q,compressedTexImage2D:Mn,compressedTexImage3D:Ct,texImage2D:R,texImage3D:K,pixelStorei:ce,getParameter:xe,updateUBOMapping:ne,uniformBlockBinding:re,texStorage2D:et,texStorage3D:B,texSubImage2D:It,texSubImage3D:Ee,compressedTexSubImage2D:Wt,compressedTexSubImage3D:Ge,scissor:be,viewport:Re,reset:Me}}function Ay(i,e,t,n,r,s,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),u=new Ue,f=new WeakMap,h=new Set,c,d=new WeakMap,x=new Set,S=new FinalizationRegistry(B=>x.delete(B)),p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(B,R){return p?new OffscreenCanvas(B,R):Gs("canvas")}function y(B,R,K){let xe=1,ce=et(B);if((ce.width>K||ce.height>K)&&(xe=K/Math.max(ce.width,ce.height)),xe<1)if(typeof HTMLImageElement<"u"&&B instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&B instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&B instanceof ImageBitmap||typeof VideoFrame<"u"&&B instanceof VideoFrame){let be=Math.floor(xe*ce.width),Re=Math.floor(xe*ce.height);c===void 0&&(c=g(be,Re));let ne=R?g(be,Re):c;return ne.width=be,ne.height=Re,ne.getContext("2d").drawImage(B,0,0,be,Re),Xe("WebGLRenderer: Texture has been resized from ("+ce.width+"x"+ce.height+") to ("+be+"x"+Re+")."),ne}else return"data"in B&&Xe("WebGLRenderer: Image in DataTexture is too big ("+ce.width+"x"+ce.height+")."),B;return B}function T(B){return B.generateMipmaps}function M(B){i.generateMipmap(B)}function A(B){return B.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:B.isWebGL3DRenderTarget?i.TEXTURE_3D:B.isWebGLArrayRenderTarget||B.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function E(B,R,K,xe,ce,be=!1){if(B!==null){if(i[B]!==void 0)return i[B];Xe("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+B+"'")}let Re;xe&&(Re=e.get("EXT_texture_norm16"),Re||Xe("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let ne=R;if(R===i.RED&&(K===i.FLOAT&&(ne=i.R32F),K===i.HALF_FLOAT&&(ne=i.R16F),K===i.UNSIGNED_BYTE&&(ne=i.R8),K===i.UNSIGNED_SHORT&&Re&&(ne=Re.R16_EXT),K===i.SHORT&&Re&&(ne=Re.R16_SNORM_EXT)),R===i.RED_INTEGER&&(K===i.UNSIGNED_BYTE&&(ne=i.R8UI),K===i.UNSIGNED_SHORT&&(ne=i.R16UI),K===i.UNSIGNED_INT&&(ne=i.R32UI),K===i.BYTE&&(ne=i.R8I),K===i.SHORT&&(ne=i.R16I),K===i.INT&&(ne=i.R32I)),R===i.RG&&(K===i.FLOAT&&(ne=i.RG32F),K===i.HALF_FLOAT&&(ne=i.RG16F),K===i.UNSIGNED_BYTE&&(ne=i.RG8),K===i.UNSIGNED_SHORT&&Re&&(ne=Re.RG16_EXT),K===i.SHORT&&Re&&(ne=Re.RG16_SNORM_EXT)),R===i.RG_INTEGER&&(K===i.UNSIGNED_BYTE&&(ne=i.RG8UI),K===i.UNSIGNED_SHORT&&(ne=i.RG16UI),K===i.UNSIGNED_INT&&(ne=i.RG32UI),K===i.BYTE&&(ne=i.RG8I),K===i.SHORT&&(ne=i.RG16I),K===i.INT&&(ne=i.RG32I)),R===i.RGB_INTEGER&&(K===i.UNSIGNED_BYTE&&(ne=i.RGB8UI),K===i.UNSIGNED_SHORT&&(ne=i.RGB16UI),K===i.UNSIGNED_INT&&(ne=i.RGB32UI),K===i.BYTE&&(ne=i.RGB8I),K===i.SHORT&&(ne=i.RGB16I),K===i.INT&&(ne=i.RGB32I)),R===i.RGBA_INTEGER&&(K===i.UNSIGNED_BYTE&&(ne=i.RGBA8UI),K===i.UNSIGNED_SHORT&&(ne=i.RGBA16UI),K===i.UNSIGNED_INT&&(ne=i.RGBA32UI),K===i.BYTE&&(ne=i.RGBA8I),K===i.SHORT&&(ne=i.RGBA16I),K===i.INT&&(ne=i.RGBA32I)),R===i.RGB&&(K===i.UNSIGNED_SHORT&&Re&&(ne=Re.RGB16_EXT),K===i.SHORT&&Re&&(ne=Re.RGB16_SNORM_EXT),K===i.UNSIGNED_INT_5_9_9_9_REV&&(ne=i.RGB9_E5),K===i.UNSIGNED_INT_10F_11F_11F_REV&&(ne=i.R11F_G11F_B10F)),R===i.RGBA){let re=be?ks:dt.getTransfer(ce);K===i.FLOAT&&(ne=i.RGBA32F),K===i.HALF_FLOAT&&(ne=i.RGBA16F),K===i.UNSIGNED_BYTE&&(ne=re===wt?i.SRGB8_ALPHA8:i.RGBA8),K===i.UNSIGNED_SHORT&&Re&&(ne=Re.RGBA16_EXT),K===i.SHORT&&Re&&(ne=Re.RGBA16_SNORM_EXT),K===i.UNSIGNED_SHORT_4_4_4_4&&(ne=i.RGBA4),K===i.UNSIGNED_SHORT_5_5_5_1&&(ne=i.RGB5_A1)}return(ne===i.R16F||ne===i.R32F||ne===i.RG16F||ne===i.RG32F||ne===i.RGBA16F||ne===i.RGBA32F)&&e.get("EXT_color_buffer_float"),ne}function _(B,R){let K;return B?R===null||R===on||R===vr?K=i.DEPTH24_STENCIL8:R===tt?K=i.DEPTH32F_STENCIL8:R===Xi&&(K=i.DEPTH24_STENCIL8,Xe("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):R===null||R===on||R===vr?K=i.DEPTH_COMPONENT24:R===tt?K=i.DEPTH_COMPONENT32F:R===Xi&&(K=i.DEPTH_COMPONENT16),K}function w(B,R){return T(B)===!0||B.isFramebufferTexture&&B.minFilter!==Qe&&B.minFilter!==lt?Math.log2(Math.max(R.width,R.height))+1:B.mipmaps.length>0?B.mipmaps.length:B.isCompressedTexture&&Array.isArray(B.image)?R.mipmaps.length:1}function L(B){let R=new WeakRef(B);n.get(B).__ref=R,x.add(R),S.register(B,R,R)}function I(B){let R=n.get(B).__ref;R!==void 0&&(x.delete(R),S.unregister(R))}function N(B){z(B.target)}function U(B){D(B.target)}function z(B){B.removeEventListener("dispose",N),I(B),W(B),B.isVideoTexture&&f.delete(B),B.isHTMLTexture&&h.delete(B)}function D(B){B.removeEventListener("dispose",U),I(B),le(B)}function G(){for(let B of x){let R=B.deref();R!==void 0&&(R.isRenderTarget===!0?D(R):z(R))}x.clear(),h.clear()}function W(B){let R=n.get(B);if(R.__webglInit===void 0)return;let K=B.source,xe=d.get(K);if(xe){let ce=xe[R.__cacheKey];ce.usedTimes--,ce.usedTimes===0&&Z(B),Object.keys(xe).length===0&&d.delete(K)}n.remove(B)}function Z(B){let R=n.get(B);i.deleteTexture(R.__webglTexture);let K=B.source,xe=d.get(K);delete xe[R.__cacheKey],o.memory.textures--}function le(B){let R=n.get(B);R.__depthDisposeCallback&&R.__depthDisposeCallback();let K=B.depthTexture;if(K&&K.renderTarget===B&&z(K),B.isWebGLCubeRenderTarget)for(let ce=0;ce<6;ce++){if(Array.isArray(R.__webglFramebuffer[ce]))for(let be=0;be<R.__webglFramebuffer[ce].length;be++)i.deleteFramebuffer(R.__webglFramebuffer[ce][be]);else i.deleteFramebuffer(R.__webglFramebuffer[ce]);R.__webglDepthbuffer&&i.deleteRenderbuffer(R.__webglDepthbuffer[ce])}else{if(Array.isArray(R.__webglFramebuffer))for(let ce=0;ce<R.__webglFramebuffer.length;ce++)i.deleteFramebuffer(R.__webglFramebuffer[ce]);else i.deleteFramebuffer(R.__webglFramebuffer);if(R.__webglDepthbuffer&&i.deleteRenderbuffer(R.__webglDepthbuffer),R.__webglMultisampledFramebuffer&&i.deleteFramebuffer(R.__webglMultisampledFramebuffer),R.__webglColorRenderbuffer)for(let ce=0;ce<R.__webglColorRenderbuffer.length;ce++)R.__webglColorRenderbuffer[ce]&&i.deleteRenderbuffer(R.__webglColorRenderbuffer[ce]);R.__webglDepthRenderbuffer&&i.deleteRenderbuffer(R.__webglDepthRenderbuffer)}let xe=B.textures;for(let ce=0,be=xe.length;ce<be;ce++){let Re=n.get(xe[ce]);Re.__webglTexture&&(i.deleteTexture(Re.__webglTexture),o.memory.textures--),n.remove(xe[ce])}n.remove(B)}let J=0;function se(){J=0}function ae(){return J}function ye(B){J=B}function Le(){let B=J;return B>=r.maxTextures&&Xe("WebGLTextures: Trying to use "+(B+1)+" texture units while this GPU supports only "+r.maxTextures),J+=1,B}function j(B){let R=[];return R.push(B.wrapS),R.push(B.wrapT),R.push(B.wrapR||0),R.push(B.magFilter),R.push(B.minFilter),R.push(B.anisotropy),R.push(B.internalFormat),R.push(B.format),R.push(B.type),R.push(B.generateMipmaps),R.push(B.mipmapsAutoUpdate),R.push(B.premultiplyAlpha),R.push(B.flipY),R.push(B.unpackAlignment),R.push(B.colorSpace),R.join()}function he(B,R){let K=n.get(B);if(B.isVideoTexture&&Wt(B),B.isRenderTargetTexture===!1&&B.isExternalTexture!==!0&&B.version>0&&K.__version!==B.version){let xe=B.image;if(xe===null)Xe("WebGLRenderer: Texture marked for update but no image data found.");else if(xe.complete===!1)Xe("WebGLRenderer: Texture marked for update but image is incomplete");else{Bt(K,B,R);return}}else B.isExternalTexture&&(K.__webglTexture=B.sourceTexture?B.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,K.__webglTexture,i.TEXTURE0+R)}function Ce(B,R){let K=n.get(B);if(B.isRenderTargetTexture===!1&&B.version>0&&K.__version!==B.version){Bt(K,B,R);return}else B.isExternalTexture&&(K.__webglTexture=B.sourceTexture?B.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,K.__webglTexture,i.TEXTURE0+R)}function Oe(B,R){let K=n.get(B);if(B.isRenderTargetTexture===!1&&B.version>0&&K.__version!==B.version){Bt(K,B,R);return}t.bindTexture(i.TEXTURE_3D,K.__webglTexture,i.TEXTURE0+R)}function fe(B,R){let K=n.get(B);if(B.version>0&&K.__version!==B.version){en(K,B,R);return}t.bindTexture(i.TEXTURE_CUBE_MAP,K.__webglTexture,i.TEXTURE0+R)}let ke={[rn]:i.REPEAT,[Pt]:i.CLAMP_TO_EDGE,[Ia]:i.MIRRORED_REPEAT},mt={[Qe]:i.NEAREST,[nd]:i.NEAREST_MIPMAP_NEAREST,[ho]:i.NEAREST_MIPMAP_LINEAR,[lt]:i.LINEAR,[ja]:i.LINEAR_MIPMAP_NEAREST,[li]:i.LINEAR_MIPMAP_LINEAR},Be={[od]:i.NEVER,[Wu]:i.ALWAYS,[ad]:i.LESS,[Gu]:i.LEQUAL,[ld]:i.EQUAL,[Vu]:i.GEQUAL,[cd]:i.GREATER,[ud]:i.NOTEQUAL};function at(B,R){if(R.type===tt&&e.has("OES_texture_float_linear")===!1&&(R.magFilter===lt||R.magFilter===ja||R.magFilter===ho||R.magFilter===li||R.minFilter===lt||R.minFilter===ja||R.minFilter===ho||R.minFilter===li)&&Xe("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(B,i.TEXTURE_WRAP_S,ke[R.wrapS]),i.texParameteri(B,i.TEXTURE_WRAP_T,ke[R.wrapT]),(B===i.TEXTURE_3D||B===i.TEXTURE_2D_ARRAY)&&i.texParameteri(B,i.TEXTURE_WRAP_R,ke[R.wrapR]),i.texParameteri(B,i.TEXTURE_MAG_FILTER,mt[R.magFilter]),i.texParameteri(B,i.TEXTURE_MIN_FILTER,mt[R.minFilter]),R.compareFunction&&(i.texParameteri(B,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(B,i.TEXTURE_COMPARE_FUNC,Be[R.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(R.magFilter===Qe||R.minFilter!==ho&&R.minFilter!==li||R.type===tt&&e.has("OES_texture_float_linear")===!1)return;if(R.anisotropy>1||n.get(R).__currentAnisotropy){let K=e.get("EXT_texture_filter_anisotropic");i.texParameterf(B,K.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(R.anisotropy,r.getMaxAnisotropy())),n.get(R).__currentAnisotropy=R.anisotropy}}}function ft(B,R){let K=!1;B.__webglInit===void 0&&(B.__webglInit=!0,R.addEventListener("dispose",N),L(R));let xe=R.source,ce=d.get(xe);ce===void 0&&(ce={},d.set(xe,ce));let be=j(R);if(be!==B.__cacheKey){ce[be]===void 0&&(ce[be]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,K=!0),ce[be].usedTimes++;let Re=ce[B.__cacheKey];Re!==void 0&&(ce[B.__cacheKey].usedTimes--,Re.usedTimes===0&&Z(R)),B.__cacheKey=be,B.__webglTexture=ce[be].texture}return K}function rt(B,R,K){return Math.floor(Math.floor(B/K)/R)}function Ht(B,R,K,xe){let be=B.updateRanges;if(be.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,R.width,R.height,K,xe,R.data);else{be.sort((k,ie)=>k.start-ie.start);let Re=0;for(let k=1;k<be.length;k++){let ie=be[Re],Q=be[k],we=ie.start+ie.count,ve=rt(Q.start,R.width,4),Te=rt(ie.start,R.width,4);Q.start<=we+1&&ve===Te&&rt(Q.start+Q.count-1,R.width,4)===ve?ie.count=Math.max(ie.count,Q.start+Q.count-ie.start):(++Re,be[Re]=Q)}be.length=Re+1;let ne=t.getParameter(i.UNPACK_ROW_LENGTH),re=t.getParameter(i.UNPACK_SKIP_PIXELS),Me=t.getParameter(i.UNPACK_SKIP_ROWS);t.pixelStorei(i.UNPACK_ROW_LENGTH,R.width);for(let k=0,ie=be.length;k<ie;k++){let Q=be[k],we=Math.floor(Q.start/4),ve=Math.ceil(Q.count/4),Te=we%R.width,ze=Math.floor(we/R.width),st=ve,_e=1;t.pixelStorei(i.UNPACK_SKIP_PIXELS,Te),t.pixelStorei(i.UNPACK_SKIP_ROWS,ze),t.texSubImage2D(i.TEXTURE_2D,0,Te,ze,st,_e,K,xe,R.data)}B.clearUpdateRanges(),t.pixelStorei(i.UNPACK_ROW_LENGTH,ne),t.pixelStorei(i.UNPACK_SKIP_PIXELS,re),t.pixelStorei(i.UNPACK_SKIP_ROWS,Me)}}function Bt(B,R,K){let xe=i.TEXTURE_2D;(R.isDataArrayTexture||R.isCompressedArrayTexture)&&(xe=i.TEXTURE_2D_ARRAY),R.isData3DTexture&&(xe=i.TEXTURE_3D);let ce=ft(B,R),be=R.source;t.bindTexture(xe,B.__webglTexture,i.TEXTURE0+K);let Re=n.get(be);if(be.version!==Re.__version||ce===!0){if(t.activeTexture(i.TEXTURE0+K),(typeof ImageBitmap<"u"&&R.image instanceof ImageBitmap)===!1){let _e=dt.getPrimaries(dt.workingColorSpace),He=R.colorSpace===Ei?null:dt.getPrimaries(R.colorSpace),it=R.colorSpace===Ei||_e===He?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,R.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,R.premultiplyAlpha),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,it)}t.pixelStorei(i.UNPACK_ALIGNMENT,R.unpackAlignment);let re=y(R.image,!1,r.maxTextureSize);re=Ge(R,re);let Me=s.convert(R.format,R.colorSpace),k=s.convert(R.type),ie=E(R.internalFormat,Me,k,R.normalized,R.colorSpace,R.isVideoTexture);at(xe,R);let Q,we=R.mipmaps,ve=R.isVideoTexture!==!0,Te=Re.__version===void 0||ce===!0,ze=be.dataReady,st=w(R,re);if(R.isDepthTexture)ie=_(R.format===Ai,R.type),Te&&(ve?t.texStorage2D(i.TEXTURE_2D,1,ie,re.width,re.height):t.texImage2D(i.TEXTURE_2D,0,ie,re.width,re.height,0,Me,k,null));else if(R.isDataTexture)if(we.length>0){ve&&Te&&t.texStorage2D(i.TEXTURE_2D,st,ie,we[0].width,we[0].height);for(let _e=0,He=we.length;_e<He;_e++)Q=we[_e],ve?ze&&t.texSubImage2D(i.TEXTURE_2D,_e,0,0,Q.width,Q.height,Me,k,Q.data):t.texImage2D(i.TEXTURE_2D,_e,ie,Q.width,Q.height,0,Me,k,Q.data);R.generateMipmaps=!1}else ve?(Te&&t.texStorage2D(i.TEXTURE_2D,st,ie,re.width,re.height),ze&&Ht(R,re,Me,k)):t.texImage2D(i.TEXTURE_2D,0,ie,re.width,re.height,0,Me,k,re.data);else if(R.isCompressedTexture)if(R.isCompressedArrayTexture){ve&&Te&&t.texStorage3D(i.TEXTURE_2D_ARRAY,st,ie,we[0].width,we[0].height,re.depth);for(let _e=0,He=we.length;_e<He;_e++)if(Q=we[_e],R.format!==qe)if(Me!==null)if(ve){if(ze)if(R.layerUpdates.size>0){let it=Ku(Q.width,Q.height,R.format,R.type);for(let Pe of R.layerUpdates){let _t=Q.data.subarray(Pe*it/Q.data.BYTES_PER_ELEMENT,(Pe+1)*it/Q.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,_e,0,0,Pe,Q.width,Q.height,1,Me,_t)}}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,_e,0,0,0,Q.width,Q.height,re.depth,Me,Q.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,_e,ie,Q.width,Q.height,re.depth,0,Q.data,0,0);else Xe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else ve?ze&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,_e,0,0,0,Q.width,Q.height,re.depth,Me,k,Q.data):t.texImage3D(i.TEXTURE_2D_ARRAY,_e,ie,Q.width,Q.height,re.depth,0,Me,k,Q.data);R.layerUpdates.size>0&&R.clearLayerUpdates()}else{ve&&Te&&t.texStorage2D(i.TEXTURE_2D,st,ie,we[0].width,we[0].height);for(let _e=0,He=we.length;_e<He;_e++)Q=we[_e],R.format!==qe?Me!==null?ve?ze&&t.compressedTexSubImage2D(i.TEXTURE_2D,_e,0,0,Q.width,Q.height,Me,Q.data):t.compressedTexImage2D(i.TEXTURE_2D,_e,ie,Q.width,Q.height,0,Q.data):Xe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):ve?ze&&t.texSubImage2D(i.TEXTURE_2D,_e,0,0,Q.width,Q.height,Me,k,Q.data):t.texImage2D(i.TEXTURE_2D,_e,ie,Q.width,Q.height,0,Me,k,Q.data)}else if(R.isDataArrayTexture)if(ve){if(Te&&t.texStorage3D(i.TEXTURE_2D_ARRAY,st,ie,re.width,re.height,re.depth),ze)if(R.layerUpdates.size>0){let _e=Ku(re.width,re.height,R.format,R.type);for(let He of R.layerUpdates){let it=re.data.subarray(He*_e/re.data.BYTES_PER_ELEMENT,(He+1)*_e/re.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,He,re.width,re.height,1,Me,k,it)}R.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,re.width,re.height,re.depth,Me,k,re.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,ie,re.width,re.height,re.depth,0,Me,k,re.data);else if(R.isData3DTexture)ve?(Te&&t.texStorage3D(i.TEXTURE_3D,st,ie,re.width,re.height,re.depth),ze&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,re.width,re.height,re.depth,Me,k,re.data)):t.texImage3D(i.TEXTURE_3D,0,ie,re.width,re.height,re.depth,0,Me,k,re.data);else if(R.isFramebufferTexture){if(Te)if(ve)t.texStorage2D(i.TEXTURE_2D,st,ie,re.width,re.height);else{let _e=re.width,He=re.height;for(let it=0;it<st;it++)t.texImage2D(i.TEXTURE_2D,it,ie,_e,He,0,Me,k,null),_e>>=1,He>>=1}}else if(R.isHTMLTexture){if("texElementImage2D"in i){let _e=i.canvas;if(_e.hasAttribute("layoutsubtree")||_e.setAttribute("layoutsubtree","true"),re.parentNode!==_e){_e.appendChild(re),h.add(R),_e.onpaint=He=>{let it=He.changedElements;for(let Pe of h)it.includes(Pe.image)&&(Pe.needsUpdate=!0)},_e.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,re);else{let it=i.RGBA,Pe=i.RGBA,_t=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,it,Pe,_t,re)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(we.length>0){if(ve&&Te){let _e=et(we[0]);t.texStorage2D(i.TEXTURE_2D,st,ie,_e.width,_e.height)}for(let _e=0,He=we.length;_e<He;_e++)Q=we[_e],ve?ze&&t.texSubImage2D(i.TEXTURE_2D,_e,0,0,Me,k,Q):t.texImage2D(i.TEXTURE_2D,_e,ie,Me,k,Q);R.generateMipmaps=!1}else if(ve){if(Te){let _e=et(re);t.texStorage2D(i.TEXTURE_2D,st,ie,_e.width,_e.height)}ze&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,Me,k,re)}else t.texImage2D(i.TEXTURE_2D,0,ie,Me,k,re);T(R)&&R.mipmapsAutoUpdate===!0&&M(xe),Re.__version=be.version,R.onUpdate&&R.onUpdate(R)}B.__version=R.version}function en(B,R,K){if(R.image.length!==6)return;let xe=ft(B,R),ce=R.source;t.bindTexture(i.TEXTURE_CUBE_MAP,B.__webglTexture,i.TEXTURE0+K);let be=n.get(ce);if(ce.version!==be.__version||xe===!0){t.activeTexture(i.TEXTURE0+K);let Re=dt.getPrimaries(dt.workingColorSpace),ne=R.colorSpace===Ei?null:dt.getPrimaries(R.colorSpace),re=R.colorSpace===Ei||Re===ne?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,R.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,R.premultiplyAlpha),t.pixelStorei(i.UNPACK_ALIGNMENT,R.unpackAlignment),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,re);let Me=R.isCompressedTexture||R.image[0].isCompressedTexture,k=R.image[0]&&R.image[0].isDataTexture,ie=[];for(let Pe=0;Pe<6;Pe++)!Me&&!k?ie[Pe]=y(R.image[Pe],!0,r.maxCubemapSize):ie[Pe]=k?R.image[Pe].image:R.image[Pe],ie[Pe]=Ge(R,ie[Pe]);let Q=ie[0],we=s.convert(R.format,R.colorSpace),ve=s.convert(R.type),Te=E(R.internalFormat,we,ve,R.normalized,R.colorSpace),ze=R.isVideoTexture!==!0,st=be.__version===void 0||xe===!0,_e=ce.dataReady,He=w(R,Q);at(i.TEXTURE_CUBE_MAP,R);let it;if(R.isDepthTexture){if(Te=_(R.format===Ai,R.type),st)if(ze)t.texStorage2D(i.TEXTURE_CUBE_MAP,1,Te,Q.width,Q.height);else for(let Pe=0;Pe<6;Pe++)t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,0,Te,Q.width,Q.height,0,we,ve,null)}else if(Me){ze&&st&&t.texStorage2D(i.TEXTURE_CUBE_MAP,He,Te,Q.width,Q.height);for(let Pe=0;Pe<6;Pe++){it=ie[Pe].mipmaps;for(let _t=0;_t<it.length;_t++){let Yt=it[_t];R.format!==qe?we!==null?ze?_e&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,_t,0,0,Yt.width,Yt.height,we,Yt.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,_t,Te,Yt.width,Yt.height,0,Yt.data):Xe("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):ze?_e&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,_t,0,0,Yt.width,Yt.height,we,ve,Yt.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,_t,Te,Yt.width,Yt.height,0,we,ve,Yt.data)}}}else{if(it=R.mipmaps,ze&&st){it.length>0&&He++;let Pe=et(ie[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,He,Te,Pe.width,Pe.height)}for(let Pe=0;Pe<6;Pe++)if(k){ze?_e&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,0,0,0,ie[Pe].width,ie[Pe].height,we,ve,ie[Pe].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,0,Te,ie[Pe].width,ie[Pe].height,0,we,ve,ie[Pe].data);for(let _t=0;_t<it.length;_t++){let ti=it[_t].image[Pe].image;ze?_e&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,_t+1,0,0,ti.width,ti.height,we,ve,ti.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,_t+1,Te,ti.width,ti.height,0,we,ve,ti.data)}}else{ze?_e&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,0,0,0,we,ve,ie[Pe]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,0,Te,we,ve,ie[Pe]);for(let _t=0;_t<it.length;_t++){let Yt=it[_t];ze?_e&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,_t+1,0,0,we,ve,Yt.image[Pe]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Pe,_t+1,Te,we,ve,Yt.image[Pe])}}}T(R)&&R.mipmapsAutoUpdate===!0&&M(i.TEXTURE_CUBE_MAP),be.__version=ce.version,R.onUpdate&&R.onUpdate(R)}B.__version=R.version}function Ft(B,R,K,xe,ce,be){let Re=s.convert(K.format,K.colorSpace),ne=s.convert(K.type),re=E(K.internalFormat,Re,ne,K.normalized,K.colorSpace),Me=n.get(R),k=n.get(K);if(k.__renderTarget=R,!Me.__hasExternalTextures){let ie=Math.max(1,R.width>>be),Q=Math.max(1,R.height>>be);ce===i.TEXTURE_3D||ce===i.TEXTURE_2D_ARRAY?t.texImage3D(ce,be,re,ie,Q,R.depth,0,Re,ne,null):t.texImage2D(ce,be,re,ie,Q,0,Re,ne,null)}t.bindFramebuffer(i.FRAMEBUFFER,B),Ee(R)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,xe,ce,k.__webglTexture,0,It(R)):(ce===i.TEXTURE_2D||ce>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&ce<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,xe,ce,k.__webglTexture,be),t.bindFramebuffer(i.FRAMEBUFFER,null)}function Gn(B,R,K){if(i.bindRenderbuffer(i.RENDERBUFFER,B),R.depthBuffer){let xe=R.depthTexture,ce=xe&&xe.isDepthTexture?xe.type:null,be=_(R.stencilBuffer,ce),Re=R.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;Ee(R)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,It(R),be,R.width,R.height):K?i.renderbufferStorageMultisample(i.RENDERBUFFER,It(R),be,R.width,R.height):i.renderbufferStorage(i.RENDERBUFFER,be,R.width,R.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,Re,i.RENDERBUFFER,B)}else{let xe=R.textures;for(let ce=0;ce<xe.length;ce++){let be=xe[ce],Re=s.convert(be.format,be.colorSpace),ne=s.convert(be.type),re=E(be.internalFormat,Re,ne,be.normalized,be.colorSpace);Ee(R)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,It(R),re,R.width,R.height):K?i.renderbufferStorageMultisample(i.RENDERBUFFER,It(R),re,R.width,R.height):i.renderbufferStorage(i.RENDERBUFFER,re,R.width,R.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Vt(B,R,K){let xe=R.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,B),!(R.depthTexture&&R.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let ce=n.get(R.depthTexture);ce.__renderTarget=R;let be=xe?R.depthTexture.image[0]:R.depthTexture.image;(!ce.__webglTexture||be.width!==R.width||be.height!==R.height)&&(be.width=R.width,be.height=R.height,R.depthTexture.needsUpdate=!0),xe?fe(R.depthTexture,0):he(R.depthTexture,0);let Re=ce.__webglTexture,ne=It(R),re=xe?i.TEXTURE_CUBE_MAP_POSITIVE_X+K:i.TEXTURE_2D,Me=R.depthTexture.format===Ai?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(R.depthTexture.format===Mi)Ee(R)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,Me,re,Re,0,ne):i.framebufferTexture2D(i.FRAMEBUFFER,Me,re,Re,0);else if(R.depthTexture.format===Ai)Ee(R)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,Me,re,Re,0,ne):i.framebufferTexture2D(i.FRAMEBUFFER,Me,re,Re,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Sn(B){let R=n.get(B),K=B.isWebGLCubeRenderTarget===!0;if(R.__boundDepthTexture!==B.depthTexture){let xe=B.depthTexture;if(R.__depthDisposeCallback&&R.__depthDisposeCallback(),xe){let ce=()=>{delete R.__boundDepthTexture,delete R.__depthDisposeCallback,xe.removeEventListener("dispose",ce)};xe.addEventListener("dispose",ce),R.__depthDisposeCallback=ce}R.__boundDepthTexture=xe}if(B.depthTexture&&!R.__autoAllocateDepthBuffer)if(K)for(let xe=0;xe<6;xe++)Vt(R.__webglFramebuffer[xe],B,xe);else B.texture.mipmaps.length>0?Vt(R.__webglFramebuffer[0],B,0):Vt(R.__webglFramebuffer,B,0);else if(K){R.__webglDepthbuffer=[];for(let xe=0;xe<6;xe++)if(t.bindFramebuffer(i.FRAMEBUFFER,R.__webglFramebuffer[xe]),R.__webglDepthbuffer[xe]===void 0)R.__webglDepthbuffer[xe]=i.createRenderbuffer(),Gn(R.__webglDepthbuffer[xe],B,!1);else{let ce=B.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,be=R.__webglDepthbuffer[xe];i.bindRenderbuffer(i.RENDERBUFFER,be),i.framebufferRenderbuffer(i.FRAMEBUFFER,ce,i.RENDERBUFFER,be)}}else if(B.texture.mipmaps.length>0?t.bindFramebuffer(i.FRAMEBUFFER,R.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,R.__webglFramebuffer),R.__webglDepthbuffer===void 0)R.__webglDepthbuffer=i.createRenderbuffer(),Gn(R.__webglDepthbuffer,B,!1);else{let ce=B.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,be=R.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,be),i.framebufferRenderbuffer(i.FRAMEBUFFER,ce,i.RENDERBUFFER,be)}t.bindFramebuffer(i.FRAMEBUFFER,null)}function bn(B,R,K){let xe=n.get(B);R!==void 0&&Ft(xe.__webglFramebuffer,B,B.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),K!==void 0&&Sn(B)}function In(B){let R=B.texture,K=n.get(B),xe=n.get(R);B.addEventListener("dispose",U),L(B);let ce=B.textures,be=B.isWebGLCubeRenderTarget===!0,Re=ce.length>1;if(Re||(xe.__webglTexture===void 0&&(xe.__webglTexture=i.createTexture()),xe.__version=R.version,o.memory.textures++),be){K.__webglFramebuffer=[];for(let ne=0;ne<6;ne++)if(R.mipmaps.length>0){K.__webglFramebuffer[ne]=[];for(let re=0;re<R.mipmaps.length;re++)K.__webglFramebuffer[ne][re]=i.createFramebuffer()}else K.__webglFramebuffer[ne]=i.createFramebuffer()}else{if(R.mipmaps.length>0){K.__webglFramebuffer=[];for(let ne=0;ne<R.mipmaps.length;ne++)K.__webglFramebuffer[ne]=i.createFramebuffer()}else K.__webglFramebuffer=i.createFramebuffer();if(Re)for(let ne=0,re=ce.length;ne<re;ne++){let Me=n.get(ce[ne]);Me.__webglTexture===void 0&&(Me.__webglTexture=i.createTexture(),o.memory.textures++)}if(B.samples>0&&Ee(B)===!1){K.__webglMultisampledFramebuffer=i.createFramebuffer(),K.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,K.__webglMultisampledFramebuffer);for(let ne=0;ne<ce.length;ne++){let re=ce[ne];K.__webglColorRenderbuffer[ne]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,K.__webglColorRenderbuffer[ne]);let Me=s.convert(re.format,re.colorSpace),k=s.convert(re.type),ie=E(re.internalFormat,Me,k,re.normalized,re.colorSpace,B.isXRRenderTarget===!0),Q=It(B);i.renderbufferStorageMultisample(i.RENDERBUFFER,Q,ie,B.width,B.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ne,i.RENDERBUFFER,K.__webglColorRenderbuffer[ne])}i.bindRenderbuffer(i.RENDERBUFFER,null),B.depthBuffer&&(K.__webglDepthRenderbuffer=i.createRenderbuffer(),Gn(K.__webglDepthRenderbuffer,B,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(be){t.bindTexture(i.TEXTURE_CUBE_MAP,xe.__webglTexture),at(i.TEXTURE_CUBE_MAP,R);for(let ne=0;ne<6;ne++)if(R.mipmaps.length>0)for(let re=0;re<R.mipmaps.length;re++)Ft(K.__webglFramebuffer[ne][re],B,R,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ne,re);else Ft(K.__webglFramebuffer[ne],B,R,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0);T(R)?M(i.TEXTURE_CUBE_MAP):R.mipmaps.length>0&&i.texParameteri(i.TEXTURE_CUBE_MAP,i.TEXTURE_MAX_LEVEL,R.mipmaps.length-1),t.unbindTexture()}else if(Re){for(let ne=0,re=ce.length;ne<re;ne++){let Me=ce[ne],k=n.get(Me),ie=i.TEXTURE_2D;(B.isWebGL3DRenderTarget||B.isWebGLArrayRenderTarget)&&(ie=B.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(ie,k.__webglTexture),at(ie,Me),Ft(K.__webglFramebuffer,B,Me,i.COLOR_ATTACHMENT0+ne,ie,0),T(Me)&&M(ie)}t.unbindTexture()}else{let ne=i.TEXTURE_2D;if((B.isWebGL3DRenderTarget||B.isWebGLArrayRenderTarget)&&(ne=B.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(ne,xe.__webglTexture),at(ne,R),R.mipmaps.length>0)for(let re=0;re<R.mipmaps.length;re++)Ft(K.__webglFramebuffer[re],B,R,i.COLOR_ATTACHMENT0,ne,re);else Ft(K.__webglFramebuffer,B,R,i.COLOR_ATTACHMENT0,ne,0);T(R)?M(ne):R.mipmaps.length>0&&i.texParameteri(ne,i.TEXTURE_MAX_LEVEL,R.mipmaps.length-1),t.unbindTexture()}B.depthBuffer&&Sn(B)}function q(B){let R=B.textures;for(let K=0,xe=R.length;K<xe;K++){let ce=R[K];if(T(ce)&&ce.mipmapsAutoUpdate===!0){let be=A(B),Re=n.get(ce).__webglTexture;t.bindTexture(be,Re),M(be),t.unbindTexture()}}}let Mn=[];function Ct(B){if(B.samples>0){if(Ee(B)===!1){let R=B.textures,K=B.width,xe=B.height,ce=i.COLOR_BUFFER_BIT,be=B.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Re=n.get(B),ne=R.length>1;if(ne)for(let Me=0;Me<R.length;Me++)t.bindFramebuffer(i.FRAMEBUFFER,Re.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Me,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,Re.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Me,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,Re.__webglMultisampledFramebuffer),B.texture.mipmaps.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Re.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Re.__webglFramebuffer);for(let Me=0;Me<R.length;Me++){if(B.resolveDepthBuffer&&(B.depthBuffer&&(ce|=i.DEPTH_BUFFER_BIT),B.stencilBuffer&&B.resolveStencilBuffer&&(ce|=i.STENCIL_BUFFER_BIT)),ne){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,Re.__webglColorRenderbuffer[Me]);let k=n.get(R[Me]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,k,0)}i.blitFramebuffer(0,0,K,xe,0,0,K,xe,ce,i.NEAREST),l===!0&&(Mn.length=0,Mn.push(i.COLOR_ATTACHMENT0+Me),B.depthBuffer&&B.storeMultisampledDepthBuffer===!1&&Mn.push(be),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,Mn))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),ne)for(let Me=0;Me<R.length;Me++){t.bindFramebuffer(i.FRAMEBUFFER,Re.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Me,i.RENDERBUFFER,Re.__webglColorRenderbuffer[Me]);let k=n.get(R[Me]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,Re.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Me,i.TEXTURE_2D,k,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Re.__webglMultisampledFramebuffer)}else if(B.depthBuffer&&B.storeMultisampledDepthBuffer===!1&&l){let R=B.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[R])}}}function It(B){return Math.min(r.maxSamples,B.samples)}function Ee(B){let R=n.get(B);return B.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&R.__useRenderToTexture!==!1}function Wt(B){let R=o.render.frame;f.get(B)!==R&&(f.set(B,R),B.update())}function Ge(B,R){let K=B.colorSpace,xe=B.format,ce=B.type;return B.isCompressedTexture===!0||B.isVideoTexture===!0||K!==un&&K!==Ei&&(dt.getTransfer(K)===wt?(xe!==qe||ce!==sn)&&Xe("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ke("WebGLTextures: Unsupported texture color space:",K)),R}function et(B){return typeof HTMLImageElement<"u"&&B instanceof HTMLImageElement?(u.width=B.naturalWidth||B.width,u.height=B.naturalHeight||B.height):typeof VideoFrame<"u"&&B instanceof VideoFrame?(u.width=B.displayWidth,u.height=B.displayHeight):(u.width=B.width,u.height=B.height),u}this.allocateTextureUnit=Le,this.resetTextureUnits=se,this.getTextureUnits=ae,this.setTextureUnits=ye,this.setTexture2D=he,this.setTexture2DArray=Ce,this.setTexture3D=Oe,this.setTextureCube=fe,this.rebindTextures=bn,this.setupRenderTarget=In,this.updateRenderTargetMipmap=q,this.updateMultisampleRenderTarget=Ct,this.setupDepthRenderbuffer=Sn,this.setupFrameBufferTexture=Ft,this.useMultisampledRTT=Ee,this.dispose=G}function Ey(i,e){function t(n,r=Ei){let s,o=dt.getTransfer(r);if(n===sn)return i.UNSIGNED_BYTE;if(n===el)return i.UNSIGNED_SHORT_4_4_4_4;if(n===tl)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Bu)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===zu)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===ss)return i.BYTE;if(n===fo)return i.SHORT;if(n===Xi)return i.UNSIGNED_SHORT;if(n===qi)return i.INT;if(n===on)return i.UNSIGNED_INT;if(n===tt)return i.FLOAT;if(n===ht)return i.HALF_FLOAT;if(n===ku)return i.ALPHA;if(n===Hu)return i.RGB;if(n===qe)return i.RGBA;if(n===Mi)return i.DEPTH_COMPONENT;if(n===Ai)return i.DEPTH_STENCIL;if(n===Rn)return i.RED;if(n===os)return i.RED_INTEGER;if(n===an)return i.RG;if(n===Yi)return i.RG_INTEGER;if(n===Zi)return i.RGBA_INTEGER;if(n===po||n===mo||n===go||n===xo)if(o===wt)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(n===po)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===mo)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===go)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===xo)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(n===po)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===mo)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===go)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===xo)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===nl||n===il||n===rl||n===sl)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(n===nl)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===il)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===rl)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===sl)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===ol||n===al||n===ll||n===cl||n===ul||n===vo||n===hl)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(n===ol||n===al)return o===wt?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(n===ll)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(n===cl)return s.COMPRESSED_R11_EAC;if(n===ul)return s.COMPRESSED_SIGNED_R11_EAC;if(n===vo)return s.COMPRESSED_RG11_EAC;if(n===hl)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===fl||n===dl||n===pl||n===ml||n===gl||n===xl||n===vl||n===_l||n===yl||n===Sl||n===bl||n===Ml||n===Tl||n===wl)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(n===fl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===dl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===pl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===ml)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===gl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===xl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===vl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===_l)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===yl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Sl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===bl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Ml)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Tl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===wl)return o===wt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Al||n===El||n===Rl)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(n===Al)return o===wt?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===El)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Rl)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Cl||n===Il||n===_o||n===Pl)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(n===Cl)return s.COMPRESSED_RED_RGTC1_EXT;if(n===Il)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===_o)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Pl)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===vr?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}var Ry=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Cy=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,hh=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Js(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new $t({vertexShader:Ry,fragmentShader:Cy,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new xn(new pr(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},fh=class extends si{constructor(e,t){super();let n=this,r=null,s=1,o=null,a="local-floor",l=1,u=null,f=null,h=null,c=null,d=null,x=null,S=typeof XRWebGLBinding<"u",p=new hh,g={},y=t.getContextAttributes(),T=null,M=null,A=[],E=[],_=new Ue,w=null,L=null,I=new cn;I.viewport=new St;let N=new cn;N.viewport=new St;let U=[I,N],z=new Ja,D=null,G=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(j){let he=A[j];return he===void 0&&(he=new $r,A[j]=he),he.getTargetRaySpace()},this.getControllerGrip=function(j){let he=A[j];return he===void 0&&(he=new $r,A[j]=he),he.getGripSpace()},this.getHand=function(j){let he=A[j];return he===void 0&&(he=new $r,A[j]=he),he.getHandSpace()};function W(j){let he=E.indexOf(j.inputSource);if(he===-1)return;let Ce=A[he];Ce!==void 0&&(Ce.update(j.inputSource,j.frame,u||o),Ce.dispatchEvent({type:j.type,data:j.inputSource}))}function Z(){r.removeEventListener("select",W),r.removeEventListener("selectstart",W),r.removeEventListener("selectend",W),r.removeEventListener("squeeze",W),r.removeEventListener("squeezestart",W),r.removeEventListener("squeezeend",W),r.removeEventListener("end",Z),r.removeEventListener("inputsourceschange",le);for(let j=0;j<A.length;j++){let he=E[j];he!==null&&(E[j]=null,A[j].disconnect(he))}D=null,G=null,p.reset();for(let j in g)delete g[j];if(e.setRenderTarget(T),d=null,c=null,h=null,r=null,M=null,Le.stop(),n.isPresenting=!1,e.setPixelRatio(w),e.setSize(_.width,_.height,!1),L!==null){let j=L.camera;j.fov=L.fov,j.zoom=L.zoom,j.updateProjectionMatrix(),L=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(j){s=j,n.isPresenting===!0&&Xe("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(j){a=j,n.isPresenting===!0&&Xe("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return u||o},this.setReferenceSpace=function(j){u=j},this.getBaseLayer=function(){return c!==null?c:d},this.getBinding=function(){return h===null&&S&&(h=new XRWebGLBinding(r,t)),h},this.getFrame=function(){return x},this.getSession=function(){return r},this.setSession=async function(j){if(r=j,r!==null){if(T=e.getRenderTarget(),r.addEventListener("select",W),r.addEventListener("selectstart",W),r.addEventListener("selectend",W),r.addEventListener("squeeze",W),r.addEventListener("squeezestart",W),r.addEventListener("squeezeend",W),r.addEventListener("end",Z),r.addEventListener("inputsourceschange",le),y.xrCompatible!==!0&&await t.makeXRCompatible(),w=e.getPixelRatio(),e.getSize(_),S&&"createProjectionLayer"in XRWebGLBinding.prototype){let Ce=null,Oe=null,fe=null;y.depth&&(fe=y.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,Ce=y.stencil?Ai:Mi,Oe=y.stencil?vr:on);let ke={colorFormat:t.RGBA8,depthFormat:fe,scaleFactor:s};h=this.getBinding(),c=h.createProjectionLayer(ke),r.updateRenderState({layers:[c]}),e.setPixelRatio(1),e.setSize(c.textureWidth,c.textureHeight,!1),M=new zt(c.textureWidth,c.textureHeight,{format:qe,type:sn,depthTexture:new wi(c.textureWidth,c.textureHeight,Oe,void 0,void 0,void 0,void 0,void 0,void 0,Ce),stencilBuffer:y.stencil,colorSpace:e.outputColorSpace,samples:y.antialias?4:0,resolveDepthBuffer:c.ignoreDepthValues===!1,resolveStencilBuffer:c.ignoreDepthValues===!1,storeMultisampledDepthBuffer:c.ignoreDepthValues===!1,storeMultisampledStencilBuffer:c.ignoreDepthValues===!1})}else{let Ce={antialias:y.antialias,alpha:!0,depth:y.depth,stencil:y.stencil,framebufferScaleFactor:s};d=new XRWebGLLayer(r,t,Ce),r.updateRenderState({baseLayer:d}),e.setPixelRatio(1),e.setSize(d.framebufferWidth,d.framebufferHeight,!1),M=new zt(d.framebufferWidth,d.framebufferHeight,{format:qe,type:sn,colorSpace:e.outputColorSpace,stencilBuffer:y.stencil,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}M.isXRRenderTarget=!0,this.setFoveation(l),u=null,o=await r.requestReferenceSpace(a),Le.setContext(r),Le.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return p.getDepthTexture()};function le(j){for(let he=0;he<j.removed.length;he++){let Ce=j.removed[he],Oe=E.indexOf(Ce);Oe>=0&&(E[Oe]=null,A[Oe].disconnect(Ce))}for(let he=0;he<j.added.length;he++){let Ce=j.added[he],Oe=E.indexOf(Ce);if(Oe===-1){for(let ke=0;ke<A.length;ke++)if(ke>=E.length){E.push(Ce),Oe=ke;break}else if(E[ke]===null){E[ke]=Ce,Oe=ke;break}if(Oe===-1)break}let fe=A[Oe];fe&&fe.connect(Ce)}}function J(j,he){he===null?j.matrixWorld.copy(j.matrix):j.matrixWorld.multiplyMatrices(he.matrixWorld,j.matrix),j.matrixWorldInverse.copy(j.matrixWorld).invert()}this.updateCamera=function(j){if(r===null)return;let he=j.near,Ce=j.far;p.texture!==null&&(p.depthNear>0&&(he=p.depthNear),p.depthFar>0&&(Ce=p.depthFar)),z.near=N.near=I.near=he,z.far=N.far=I.far=Ce,(D!==z.near||G!==z.far)&&(r.updateRenderState({depthNear:z.near,depthFar:z.far}),D=z.near,G=z.far),z.layers.mask=j.layers.mask|6,I.layers.mask=z.layers.mask&-5,N.layers.mask=z.layers.mask&-3;let Oe=j.parent,fe=z.cameras;J(z,Oe);for(let ke=0;ke<fe.length;ke++)J(fe[ke],Oe);z.projectionMatrix.copy(I.projectionMatrix),z.projectionMatrixInverse.copy(I.projectionMatrixInverse),L===null&&j.isPerspectiveCamera&&(L={camera:j,fov:j.fov,zoom:j.zoom}),se(j,z,Oe)};function se(j,he,Ce){Ce===null?j.matrix.copy(he.matrixWorld):(j.matrix.copy(Ce.matrixWorld),j.matrix.invert(),j.matrix.multiply(he.matrixWorld)),j.matrix.decompose(j.position,j.quaternion,j.scale),j.updateMatrixWorld(!0),j.projectionMatrix.copy(he.projectionMatrix),j.projectionMatrixInverse.copy(he.projectionMatrixInverse),j.isPerspectiveCamera&&(j.fov=Da*2*Math.atan(1/j.projectionMatrix.elements[5]),j.zoom=1)}this.getCamera=function(){return z},this.getFoveation=function(){if(!(c===null&&d===null))return l},this.setFoveation=function(j){l=j,c!==null&&(c.fixedFoveation=j),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=j)},this.hasDepthSensing=function(){return p.texture!==null},this.getDepthSensingMesh=function(){return p.getMesh(z)},this.getCameraTexture=function(j){return g[j]};let ae=null;function ye(j,he){if(f=he.getViewerPose(u||o),x=he,f!==null){let Ce=f.views;d!==null&&(e.setRenderTargetFramebuffer(M,d.framebuffer),e.setRenderTarget(M));let Oe=!1;Ce.length!==z.cameras.length&&(z.cameras.length=0,Oe=!0);for(let Be=0;Be<Ce.length;Be++){let at=Ce[Be],ft=null;if(d!==null)ft=d.getViewport(at);else{let Ht=h.getViewSubImage(c,at);ft=Ht.viewport,Be===0&&(e.setRenderTargetTextures(M,Ht.colorTexture,Ht.depthStencilTexture),e.setRenderTarget(M))}let rt=U[Be];rt===void 0&&(rt=new cn,rt.layers.enable(Be),rt.viewport=new St,U[Be]=rt),rt.matrix.fromArray(at.transform.matrix),rt.matrix.decompose(rt.position,rt.quaternion,rt.scale),rt.projectionMatrix.fromArray(at.projectionMatrix),rt.projectionMatrixInverse.copy(rt.projectionMatrix).invert(),rt.viewport.set(ft.x,ft.y,ft.width,ft.height),Be===0&&(z.matrix.copy(rt.matrix),z.matrix.decompose(z.position,z.quaternion,z.scale)),Oe===!0&&z.cameras.push(rt)}let fe=r.enabledFeatures;if(fe&&fe.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&S){h=n.getBinding();let Be=h.getDepthInformation(Ce[0]);Be&&Be.isValid&&Be.texture&&p.init(Be,r.renderState)}if(fe&&fe.includes("camera-access")&&S){e.state.unbindTexture(),h=n.getBinding();for(let Be=0;Be<Ce.length;Be++){let at=Ce[Be].camera;if(at){let ft=g[at];ft||(ft=new Js,g[at]=ft);let rt=h.getCameraImage(at);ft.sourceTexture=rt}}}}for(let Ce=0;Ce<A.length;Ce++){let Oe=E[Ce],fe=A[Ce];Oe!==null&&fe!==void 0&&fe.update(Oe,he,u||o)}ae&&ae(j,he),he.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:he}),x=null}let Le=new Gd;Le.setAnimationLoop(ye),this.setAnimationLoop=function(j){ae=j},this.dispose=function(){}}},Iy=new Ze,Qd=new je;Qd.set(-1,0,0,0,1,0,0,0,1);function Py(i,e){function t(p,g){p.matrixAutoUpdate===!0&&p.updateMatrix(),g.value.copy(p.matrix)}function n(p,g){g.color.getRGB(p.fogColor.value,Zu(i)),g.isFog?(p.fogNear.value=g.near,p.fogFar.value=g.far):g.isFogExp2&&(p.fogDensity.value=g.density)}function r(p,g,y,T,M){g.isNodeMaterial?g.uniformsNeedUpdate=!1:g.isMeshBasicMaterial?s(p,g):g.isMeshLambertMaterial?(s(p,g),g.envMap&&(p.envMapIntensity.value=g.envMapIntensity)):g.isMeshToonMaterial?(s(p,g),h(p,g)):g.isMeshPhongMaterial?(s(p,g),f(p,g),g.envMap&&(p.envMapIntensity.value=g.envMapIntensity)):g.isMeshStandardMaterial?(s(p,g),c(p,g),g.isMeshPhysicalMaterial&&d(p,g,M)):g.isMeshMatcapMaterial?(s(p,g),x(p,g)):g.isMeshDepthMaterial?s(p,g):g.isMeshDistanceMaterial?(s(p,g),S(p,g)):g.isMeshNormalMaterial?s(p,g):g.isLineBasicMaterial?(o(p,g),g.isLineDashedMaterial&&a(p,g)):g.isPointsMaterial?l(p,g,y,T):g.isSpriteMaterial?u(p,g):g.isShadowMaterial?(p.color.value.copy(g.color),p.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function s(p,g){p.opacity.value=g.opacity,g.color&&p.diffuse.value.copy(g.color),g.emissive&&p.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(p.map.value=g.map,t(g.map,p.mapTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,t(g.alphaMap,p.alphaMapTransform)),g.bumpMap&&(p.bumpMap.value=g.bumpMap,t(g.bumpMap,p.bumpMapTransform),p.bumpScale.value=g.bumpScale,g.side===Kt&&(p.bumpScale.value*=-1)),g.normalMap&&(p.normalMap.value=g.normalMap,t(g.normalMap,p.normalMapTransform),p.normalScale.value.copy(g.normalScale),g.side===Kt&&p.normalScale.value.negate()),g.displacementMap&&(p.displacementMap.value=g.displacementMap,t(g.displacementMap,p.displacementMapTransform),p.displacementScale.value=g.displacementScale,p.displacementBias.value=g.displacementBias),g.emissiveMap&&(p.emissiveMap.value=g.emissiveMap,t(g.emissiveMap,p.emissiveMapTransform)),g.specularMap&&(p.specularMap.value=g.specularMap,t(g.specularMap,p.specularMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest);let y=e.get(g),T=y.envMap,M=y.envMapRotation;T&&(p.envMap.value=T,p.envMapRotation.value.setFromMatrix4(Iy.makeRotationFromEuler(M)).transpose(),T.isCubeTexture&&T.isRenderTargetTexture===!1&&p.envMapRotation.value.premultiply(Qd),p.reflectivity.value=g.reflectivity,p.ior.value=g.ior,p.refractionRatio.value=g.refractionRatio),g.lightMap&&(p.lightMap.value=g.lightMap,p.lightMapIntensity.value=g.lightMapIntensity,t(g.lightMap,p.lightMapTransform)),g.aoMap&&(p.aoMap.value=g.aoMap,p.aoMapIntensity.value=g.aoMapIntensity,t(g.aoMap,p.aoMapTransform))}function o(p,g){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,g.map&&(p.map.value=g.map,t(g.map,p.mapTransform))}function a(p,g){p.dashSize.value=g.dashSize,p.totalSize.value=g.dashSize+g.gapSize,p.scale.value=g.scale}function l(p,g,y,T){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,p.size.value=g.size*y,p.scale.value=T*.5,g.map&&(p.map.value=g.map,t(g.map,p.uvTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,t(g.alphaMap,p.alphaMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest)}function u(p,g){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,p.rotation.value=g.rotation,g.map&&(p.map.value=g.map,t(g.map,p.mapTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,t(g.alphaMap,p.alphaMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest)}function f(p,g){p.specular.value.copy(g.specular),p.shininess.value=Math.max(g.shininess,1e-4)}function h(p,g){g.gradientMap&&(p.gradientMap.value=g.gradientMap)}function c(p,g){p.metalness.value=g.metalness,g.metalnessMap&&(p.metalnessMap.value=g.metalnessMap,t(g.metalnessMap,p.metalnessMapTransform)),p.roughness.value=g.roughness,g.roughnessMap&&(p.roughnessMap.value=g.roughnessMap,t(g.roughnessMap,p.roughnessMapTransform)),g.envMap&&(p.envMapIntensity.value=g.envMapIntensity)}function d(p,g,y){p.ior.value=g.ior,g.diffuseRoughness>0&&(p.diffuseRoughness.value=g.diffuseRoughness,g.diffuseRoughnessMap&&(p.diffuseRoughnessMap.value=g.diffuseRoughnessMap,t(g.diffuseRoughnessMap,p.diffuseRoughnessMapTransform))),g.sheen>0&&(p.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),p.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(p.sheenColorMap.value=g.sheenColorMap,t(g.sheenColorMap,p.sheenColorMapTransform)),g.sheenRoughnessMap&&(p.sheenRoughnessMap.value=g.sheenRoughnessMap,t(g.sheenRoughnessMap,p.sheenRoughnessMapTransform))),g.clearcoat>0&&(p.clearcoat.value=g.clearcoat,p.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(p.clearcoatMap.value=g.clearcoatMap,t(g.clearcoatMap,p.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,t(g.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(p.clearcoatNormalMap.value=g.clearcoatNormalMap,t(g.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===Kt&&p.clearcoatNormalScale.value.negate())),g.dispersion>0&&(p.dispersion.value=g.dispersion),g.retroreflectivity>0&&(p.retroreflectivity.value=g.retroreflectivity),g.iridescence>0&&(p.iridescence.value=g.iridescence,p.iridescenceIOR.value=g.iridescenceIOR,p.iridescenceThicknessMinimum.value=g.iridescenceThicknessMinimum,p.iridescenceThicknessMaximum.value=g.iridescenceThicknessMaximum,g.iridescenceMap&&(p.iridescenceMap.value=g.iridescenceMap,t(g.iridescenceMap,p.iridescenceMapTransform)),g.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=g.iridescenceThicknessMap,t(g.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),g.transmission>0&&(p.transmission.value=g.transmission,p.transmissionSamplerMap.value=y.texture,p.transmissionSamplerSize.value.set(y.width,y.height),g.transmissionMap&&(p.transmissionMap.value=g.transmissionMap,t(g.transmissionMap,p.transmissionMapTransform)),p.thickness.value=g.thickness,g.thicknessMap&&(p.thicknessMap.value=g.thicknessMap,t(g.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=g.attenuationDistance,p.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(p.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(p.anisotropyMap.value=g.anisotropyMap,t(g.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=g.specularIntensity,p.specularColor.value.copy(g.specularColor),g.specularColorMap&&(p.specularColorMap.value=g.specularColorMap,t(g.specularColorMap,p.specularColorMapTransform)),g.specularIntensityMap&&(p.specularIntensityMap.value=g.specularIntensityMap,t(g.specularIntensityMap,p.specularIntensityMapTransform))}function x(p,g){g.matcap&&(p.matcap.value=g.matcap)}function S(p,g){let y=e.get(g).light;p.referencePosition.value.setFromMatrixPosition(y.matrixWorld),p.nearDistance.value=y.shadow.camera.near,p.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:r}}function Dy(i,e,t,n){let r={},s={};function o(y,T){let M=T.program;n.uniformBlockBinding(y,M,r[y.id])}function a(y,T){let M=r[y.id];M===void 0&&(x(y),M=l(y),r[y.id]=M,y.addEventListener("dispose",p));let A=T.program;n.updateUBOMapping(y,A);let E=e.render.frame;s[y.id]!==E&&(u(y),s[y.id]=E)}function l(y){let T=i.createBuffer(),M=y.__size,A=y.usage;return i.bindBuffer(i.UNIFORM_BUFFER,T),i.bufferData(i.UNIFORM_BUFFER,M,A),i.bindBuffer(i.UNIFORM_BUFFER,null),T}function u(y){let T=r[y.id],M=y.uniforms,A=y.__cache;i.bindBuffer(i.UNIFORM_BUFFER,T);for(let E=0,_=M.length;E<_;E++){let w=M[E];if(Array.isArray(w))for(let L=0,I=w.length;L<I;L++)f(w[L],E,L,A);else f(w,E,0,A)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(y,T,M,A){if(c(y,T,M,A)===!0){let E=y.__offset,_=y.value;if(Array.isArray(_)){let w=0;for(let L=0;L<_.length;L++){let I=_[L],N=S(I,!0);h(I,y.__data,w),w+=N.storage/Float32Array.BYTES_PER_ELEMENT}}else h(_,y.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,E,y.__data)}}function h(y,T,M){typeof y=="number"||typeof y=="boolean"?T[M]=y:y.isMatrix3?(T[M]=y.elements[0],T[M+1]=y.elements[1],T[M+2]=y.elements[2],T[M+3]=0,T[M+4]=y.elements[3],T[M+5]=y.elements[4],T[M+6]=y.elements[5],T[M+7]=0,T[M+8]=y.elements[6],T[M+9]=y.elements[7],T[M+10]=y.elements[8],T[M+11]=0):ArrayBuffer.isView(y)?T.set(y.subarray(0,T.length-M),M):y.toArray(T,M)}function c(y,T,M,A){let E=y.value,_=T+"_"+M;if(Array.isArray(E)){A[_]===void 0&&(A[_]=[]);let w=A[_],L=!1;for(let I=0;I<E.length;I++)d(E[I],w,I)===!0&&(L=!0);return L}return d(E,A,_)}function d(y,T,M){if(T[M]===void 0)return typeof y=="number"||typeof y=="boolean"?T[M]=y:ArrayBuffer.isView(y)?T[M]=y.slice():T[M]=y.clone(),!0;{let A=T[M];if(typeof y=="number"||typeof y=="boolean"){if(A!==y)return T[M]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(A.equals(y)===!1)return A.copy(y),!0}}return!1}function x(y){let T=y.uniforms,M=0,A=16;for(let _=0,w=T.length;_<w;_++){let L=Array.isArray(T[_])?T[_]:[T[_]];for(let I=0,N=L.length;I<N;I++){let U=L[I],z=Array.isArray(U.value)?U.value:[U.value],D=Array.isArray(T[_])||Array.isArray(U.value),G=M;for(let Z=0,le=z.length;Z<le;Z++){let J=z[Z],se=S(J,D),ae=M%A,ye=ae%se.boundary,Le=ae+ye;M+=ye,Le!==0&&A-Le<se.storage&&(M+=A-Le),Z===0&&(G=M),M+=se.storage}let W=U.type==="int"?Int32Array:U.type==="uint"?Uint32Array:Float32Array;U.__data=new W((M-G)/Float32Array.BYTES_PER_ELEMENT),U.__offset=G}}let E=M%A;return E>0&&(M+=A-E),y.__size=M,y.__cache={},this}function S(y,T){let M={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(M.boundary=4,M.storage=4):y.isVector2?(M.boundary=8,M.storage=8):y.isVector3||y.isColor?(M.boundary=16,M.storage=12):y.isVector4?(M.boundary=16,M.storage=16):y.isMatrix3?(M.boundary=16,M.storage=48):y.isMatrix4?(M.boundary=16,M.storage=64):y.isTexture?Xe("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(M.boundary=16,M.storage=y.byteLength):Xe("WebGLRenderer: Unsupported uniform value type.",y),T===!0&&(M.boundary=16,M.storage=Math.ceil(M.storage/16)*16),M}function p(y){let T=y.target;T.removeEventListener("dispose",p),i.deleteBuffer(r[T.id]),delete r[T.id],delete s[T.id]}function g(){for(let y in r)i.deleteBuffer(r[y]);r={},s={}}return{bind:o,update:a,dispose:g}}var Ly=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),ci=null;function Fy(){return ci===null&&(ci=new Rt(Ly,16,16,an,ht),ci.name="DFG_LUT",ci.minFilter=lt,ci.magFilter=lt,ci.wrapS=Pt,ci.wrapT=Pt,ci.generateMipmaps=!1,ci.needsUpdate=!0),ci}var Ul=class{constructor(e={}){let{canvas:t=fd(),context:n=null,depth:r=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:u=!1,powerPreference:f="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:c=!1,outputBufferType:d=sn}=e;this.isWebGLRenderer=!0;let x;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");x=n.getContextAttributes().alpha}else x=o;let S=d,p=new Set([Zi,Yi,os]),g=new Set([sn,on,Xi,vr,el,tl]),y=new Uint32Array(4),T=new Int32Array(4),M={textures:[],min:[],max:[],resolution:[]},A=null,E=null,_=[],w=[],L=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Ln,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let I=this,N=!1,U=null,z=null,D=null,G=null;this._outputColorSpace=Tn;let W=0,Z=0,le=null,J=-1,se=null,ae=new St,ye=new St,Le=null,j=new Je(0),he=0,Ce=t.width,Oe=t.height,fe=1,ke=null,mt=null,Be=new St(0,0,Ce,Oe),at=new St(0,0,Ce,Oe),ft=!1,rt=new dr,Ht=new Ua,Bt=!1,en=!1,Ft=new Ze,Gn=new H,Vt=new St,Sn={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},bn=!1;function In(){return le===null?fe:1}let q=n;function Mn(m,b){return t.getContext(m,b)}let Ct,It,Ee,Wt,Ge,et,B,R,K,xe,ce,be,Re,ne,re,Me,k,ie,Q,we,ve,Te,ze;try{let m={alpha:!0,depth:r,stencil:s,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:u,powerPreference:f,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"187"}`),t.addEventListener("webglcontextlost",He,!1),t.addEventListener("webglcontextrestored",it,!1),t.addEventListener("webglcontextcreationerror",Pe,!1),q===null){let b="webgl2";if(q=Mn(b,m),q===null)throw Mn(b)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}st()}catch(m){throw t.removeEventListener("webglcontextlost",He,!1),t.removeEventListener("webglcontextrestored",it,!1),t.removeEventListener("webglcontextcreationerror",Pe,!1),Ke("WebGLRenderer: "+m.message),m}function st(){Ct=new Xv(q),Ct.init(),ve=new Ey(q,Ct),It=new Fv(q,Ct,e,ve),Ee=new wy(q,Ct),It.reversedDepthBuffer&&c&&Ee.buffers.depth.setReversed(!0),z=q.createFramebuffer(),D=q.createFramebuffer(),G=q.createFramebuffer(),Wt=new Zv(q),Ge=new hy,et=new Ay(q,Ct,Ee,Ge,It,ve,Wt),B=new Wv(I),R=new Jg(q),Te=new Dv(q,R),K=new qv(q,R,Wt,Te),xe=new Jv(q,K,R,Te,Wt),ie=new $v(q,It,et),re=new Nv(Ge),ce=new uy(I,B,Ct,It,Te,re),be=new Py(I,Ge),Re=new dy,ne=new _y(Ct),k=new Pv(I,B,Ee,xe,x,l),Me=new Ty(I,xe,It),ze=new Dy(q,Wt,It,Ee),Q=new Lv(q,Ct,Wt),we=new Yv(q,Ct,Wt),Wt.programs=ce.programs,I.capabilities=It,I.extensions=Ct,I.properties=Ge,I.renderLists=Re,I.shadowMap=Me,I.state=Ee,I.info=Wt}S!==sn&&(L=new Qv(S,t.width,t.height,a,r,s));let _e=new fh(I,q);this.xr=_e,this.getContext=function(){return q},this.getContextAttributes=function(){return q.getContextAttributes()},this.forceContextLoss=function(){let m=Ct.get("WEBGL_lose_context");m&&m.loseContext()},this.forceContextRestore=function(){let m=Ct.get("WEBGL_lose_context");m&&m.restoreContext()},this.getPixelRatio=function(){return fe},this.setPixelRatio=function(m){m!==void 0&&(fe=m,this.setSize(Ce,Oe,!1))},this.getSize=function(m){return m.set(Ce,Oe)},this.setSize=function(m,b,C=!0){if(_e.isPresenting){Xe("WebGLRenderer: Can't change size while VR device is presenting.");return}Ce=m,Oe=b,t.width=Math.floor(m*fe),t.height=Math.floor(b*fe),C===!0&&(t.style.width=m+"px",t.style.height=b+"px"),L!==null&&L.setSize(t.width,t.height),this.setViewport(0,0,m,b)},this.getDrawingBufferSize=function(m){return m.set(Ce*fe,Oe*fe).floor()},this.setDrawingBufferSize=function(m,b,C){Ce=m,Oe=b,fe=C,t.width=Math.floor(m*C),t.height=Math.floor(b*C),this.setViewport(0,0,m,b)},this.setEffects=function(m){if(S===sn){Ke("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(m){for(let b=0;b<m.length;b++)if(m[b].isOutputPass===!0){Xe("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}L.setEffects(m||[])},this.getCurrentViewport=function(m){return m.copy(ae)},this.getViewport=function(m){return m.copy(Be)},this.setViewport=function(m,b,C,P){m.isVector4?Be.set(m.x,m.y,m.z,m.w):Be.set(m,b,C,P),Ee.viewport(ae.copy(Be).multiplyScalar(In()).round())},this.getScissor=function(m){return m.copy(at)},this.setScissor=function(m,b,C,P){m.isVector4?at.set(m.x,m.y,m.z,m.w):at.set(m,b,C,P),Ee.scissor(ye.copy(at).multiplyScalar(In()).round())},this.getScissorTest=function(){return ft},this.setScissorTest=function(m){Ee.setScissorTest(ft=m)},this.setOpaqueSort=function(m){ke=m},this.setTransparentSort=function(m){mt=m},this.getClearColor=function(m){return m.copy(k.getClearColor())},this.setClearColor=function(){k.setClearColor(...arguments)},this.getClearAlpha=function(){return k.getClearAlpha()},this.setClearAlpha=function(){k.setClearAlpha(...arguments)},this.clear=function(m=!0,b=!0,C=!0){let P=0;if(m){let O=!1;if(le!==null){let F=le.texture.format;O=p.has(F)}if(O){let F=le.texture.type,Y=g.has(F),V=k.getClearColor(),X=k.getClearAlpha(),$=V.r,oe=V.g,ee=V.b;Y?(y[0]=$,y[1]=oe,y[2]=ee,y[3]=X,q.clearBufferuiv(q.COLOR,0,y)):(T[0]=$,T[1]=oe,T[2]=ee,T[3]=X,q.clearBufferiv(q.COLOR,0,T))}else P|=q.COLOR_BUFFER_BIT}b&&(P|=q.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),C&&(P|=q.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),P!==0&&q.clear(P)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(m){m.setRenderer(this),U=m},this.dispose=function(){t.removeEventListener("webglcontextlost",He,!1),t.removeEventListener("webglcontextrestored",it,!1),t.removeEventListener("webglcontextcreationerror",Pe,!1),k.dispose(),Re.dispose(),ne.dispose(),et.dispose(),Ge.dispose(),B.dispose(),xe.dispose(),K.dispose(),Te.dispose(),ze.dispose(),ce.dispose(),_e.dispose(),_e.removeEventListener("sessionstart",Ps),_e.removeEventListener("sessionend",Xo),di.stop()};function He(m){m.preventDefault(),qu("WebGLRenderer: Context Lost."),N=!0}function it(){qu("WebGLRenderer: Context Restored."),N=!1;let m=Wt.autoReset,b=Me.enabled,C=Me.autoUpdate,P=Me.needsUpdate,O=Me.type;st(),Wt.autoReset=m,Me.enabled=b,Me.autoUpdate=C,Me.needsUpdate=P,Me.type=O}function Pe(m){Ke("WebGLRenderer: A WebGL context could not be created. Reason: ",m.statusMessage)}function _t(m){let b=m.target;b.removeEventListener("dispose",_t),Yt(b)}function Yt(m){ti(m),Ge.remove(m)}function ti(m){let b=Ge.get(m).programs;b!==void 0&&(b.forEach(function(C){ce.releaseProgram(C)}),m.isShaderMaterial&&ce.releaseShaderCache(m))}this.renderBufferDirect=function(m,b,C,P,O,F){b===null&&(b=Sn);let Y=O.isMesh&&O.matrixWorld.determinantAffine()<0,V=Jo(m,b,C,P,O);Ee.setMaterial(P,Y);let X=C.index,$=1;if(P.wireframe===!0){if(X=K.getWireframeAttribute(C),X===void 0)return;$=2}let oe=C.drawRange,ee=C.attributes.position,te=oe.start*$,de=(oe.start+oe.count)*$;F!==null&&(te=Math.max(te,F.start*$),de=Math.min(de,(F.start+F.count)*$)),X!==null?(te=Math.max(te,0),de=Math.min(de,X.count)):ee!=null&&(te=Math.max(te,0),de=Math.min(de,ee.count));let me=de-te;if(me<0||me===1/0)return;Te.setup(O,P,V,C,X);let ge,Ae=Q;if(X!==null&&(ge=R.get(X),Ae=we,Ae.setIndex(ge)),O.isMesh)P.wireframe===!0?(Ee.setLineWidth(P.wireframeLinewidth*In()),Ae.setMode(q.LINES)):Ae.setMode(q.TRIANGLES);else if(O.isLine){let Ve=P.linewidth;Ve===void 0&&(Ve=1),Ee.setLineWidth(Ve*In()),O.isLineSegments?Ae.setMode(q.LINES):O.isLineLoop?Ae.setMode(q.LINE_LOOP):Ae.setMode(q.LINE_STRIP)}else O.isPoints?Ae.setMode(q.POINTS):O.isSprite&&Ae.setMode(q.TRIANGLES);if(O.isBatchedMesh)if(Ct.get("WEBGL_multi_draw"))Ae.renderMultiDraw(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount);else{let Ve=O._multiDrawStarts,ue=O._multiDrawCounts,Ye=O._multiDrawCount,Se=X?R.get(X).bytesPerElement:1,Ie=Ge.get(P).currentProgram.getUniforms();for(let De=0;De<Ye;De++)Ie.setValue(q,"_gl_DrawID",De),Ae.render(Ve[De]/Se,ue[De])}else if(O.isInstancedMesh)Ae.renderInstances(te,me,O.count);else if(C.isInstancedBufferGeometry){let Ve=C._maxInstanceCount!==void 0?C._maxInstanceCount:1/0,ue=Math.min(C.instanceCount,Ve);Ae.renderInstances(te,me,ue)}else Ae.render(te,me)};function Wo(m,b,C,P){U!==null&&m.isNodeMaterial&&U.setObject(P,m),Bt===!0&&re.setState(m,C,!1),m.transparent===!0&&m.side===vn&&m.forceSinglePass===!1?(m.side=Kt,m.needsUpdate=!0,ni(m,b,P),m.side=En,m.needsUpdate=!0,ni(m,b,P),m.side=vn):ni(m,b,P)}this.compile=function(m,b,C=null){C===null&&(C=m),U!==null&&U.renderStart(m,b,C),E=ne.get(C),E.init(b),w.push(E),C.traverseVisible(function(O){O.isLight&&O.layers.test(b.layers)&&(E.pushLight(O),O.castShadow&&E.pushShadow(O))}),m!==C&&m.traverseVisible(function(O){O.isLight&&O.layers.test(b.layers)&&(E.pushLight(O),O.castShadow&&E.pushShadow(O))}),E.setupLights(),U!==null&&U.updateLights(E.state.lightsArray),en=this.localClippingEnabled,Bt=re.init(this.clippingPlanes,en),Bt===!0&&re.setGlobalState(this.clippingPlanes,b),U!==null&&Me.render(E.state.shadowsArray,C,b);let P=new Set;return m.traverse(function(O){if(!(O.isMesh||O.isPoints||O.isLine||O.isSprite))return;let F=O.material;if(F)if(Array.isArray(F))for(let Y=0;Y<F.length;Y++){let V=F[Y];Wo(V,C,b,O),P.add(V)}else Wo(F,C,b,O),P.add(F)}),E=w.pop(),U!==null&&U.renderEnd(),P},this.compileAsync=function(m,b,C=null){let P=this.compile(m,b,C);return new Promise(O=>{function F(){if(P.forEach(function(Y){let X=Ge.get(Y).currentProgram;(X===void 0||X.isReady())&&P.delete(Y)}),P.size===0){O(m);return}setTimeout(F,10)}Ct.get("KHR_parallel_shader_compile")!==null?F():setTimeout(F,10)})};let Is=null;function Jc(m){Is&&Is(m)}function Ps(){di.stop()}function Xo(){di.start()}let di=new Gd;di.setAnimationLoop(Jc),typeof self<"u"&&di.setContext(self),this.setAnimationLoop=function(m){Is=m,_e.setAnimationLoop(m),m===null?di.stop():di.start()},_e.addEventListener("sessionstart",Ps),_e.addEventListener("sessionend",Xo),this.render=function(m,b){if(b!==void 0&&b.isCamera!==!0){Ke("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;U!==null&&U.renderStart(m,b);let C=_e.enabled===!0&&_e.isPresenting===!0,P=L!==null&&(le===null||C)&&L.begin(I,le);if(m.matrixWorldAutoUpdate===!0&&m.updateMatrixWorld(),b.parent===null&&b.matrixWorldAutoUpdate===!0&&b.updateMatrixWorld(),_e.enabled===!0&&_e.isPresenting===!0&&(L===null||L.isCompositing()===!1)&&(_e.cameraAutoUpdate===!0&&_e.updateCamera(b),b=_e.getCamera()),m.isScene===!0&&m.onBeforeRender(I,m,b,le),E=ne.get(m,w.length),E.init(b),E.state.textureUnits=et.getTextureUnits(),w.push(E),Ft.multiplyMatrices(b.projectionMatrix,b.matrixWorldInverse),b.isArrayCamera?Ht.setFromArrayCamera(b):rt.setFromProjectionMatrix(Ft,Wn,b.reversedDepth),en=this.localClippingEnabled,Bt=re.init(this.clippingPlanes,en),A=Re.get(m,_.length),A.init(),_.push(A),this.info.render.frame++,_e.enabled===!0&&_e.isPresenting===!0){let Y=I.xr.getDepthSensingMesh();Y!==null&&Ds(Y,b,-1/0,I.sortObjects)}Ds(m,b,0,I.sortObjects),A.finish(),U!==null&&U.updateLights(E.state.lightsArray),I.sortObjects===!0&&A.sort(ke,mt),bn=_e.enabled===!1||_e.isPresenting===!1||_e.hasDepthSensing()===!1,bn&&k.addToRenderList(A,m),this.info.autoReset===!0&&this.info.reset(),Bt===!0&&re.beginShadows();let O=E.state.shadowsArray;if(Me.render(O,m,b),Bt===!0&&re.endShadows(),(P&&L.hasRenderPass())===!1){let Y=A.opaque,V=A.transmissive;if(E.setupLights(),b.isArrayCamera){let X=b.cameras;if(V.length>0)for(let $=0,oe=X.length;$<oe;$++){let ee=X[$];qo(Y,V,m,ee)}bn&&k.render(m);for(let $=0,oe=X.length;$<oe;$++){let ee=X[$];Ls(A,m,ee,ee.viewport)}}else V.length>0&&qo(Y,V,m,b),bn&&k.render(m),Ls(A,m,b)}le!==null&&Z===0&&(et.updateMultisampleRenderTarget(le),et.updateRenderTargetMipmap(le)),P&&L.end(I),m.isScene===!0&&m.onAfterRender(I,m,b),Te.resetDefaultState(),J=-1,se=null,w.pop(),w.length>0?(E=w[w.length-1],et.setTextureUnits(E.state.textureUnits),Bt===!0&&re.setGlobalState(I.clippingPlanes,E.state.camera)):E=null,_.pop(),_.length>0?A=_[_.length-1]:A=null,U!==null&&U.renderEnd()};function Ds(m,b,C,P){if(m.visible===!1)return;if(m.layers.test(b.layers)){if(m.isGroup)C=m.renderOrder;else if(m.isLOD)m.autoUpdate===!0&&m.update(b);else if(m.isLight)E.pushLight(m),m.castShadow&&E.pushShadow(m);else if(m.isSprite){let Y=b.isArrayCamera?Ht:rt;if(!m.frustumCulled||m.intersectsFrustum(Y)){P&&Vt.setFromMatrixPosition(m.matrixWorld).applyMatrix4(Ft);let V=xe.update(m),X=m.material;X.visible&&A.push(m,V,X,C,Vt.z,null,b)}}else if(m.isMesh||m.isLine||m.isPoints){let Y=b.isArrayCamera?Ht:rt;if(!m.frustumCulled||m.intersectsFrustum(Y)){let V=xe.update(m),X=m.material;if(P&&(m.boundingSphere!==void 0?(m.boundingSphere===null&&m.computeBoundingSphere(),Vt.copy(m.boundingSphere.center)):(V.boundingSphere===null&&V.computeBoundingSphere(),Vt.copy(V.boundingSphere.center)),Vt.applyMatrix4(m.matrixWorld).applyMatrix4(Ft)),Array.isArray(X)){let $=V.groups;for(let oe=0,ee=$.length;oe<ee;oe++){let te=$[oe],de=X[te.materialIndex];de&&de.visible&&A.push(m,V,de,C,Vt.z,te,b)}}else X.visible&&A.push(m,V,X,C,Vt.z,null,b)}}}let F=m.children;for(let Y=0,V=F.length;Y<V;Y++)Ds(F[Y],b,C,P)}function Ls(m,b,C,P){let{opaque:O,transmissive:F,transparent:Y}=m;E.setupLightsView(C),Bt===!0&&re.setGlobalState(I.clippingPlanes,C),P&&Ee.viewport(ae.copy(P)),O.length>0&&rr(O,b,C),F.length>0&&rr(F,b,C),Y.length>0&&rr(Y,b,C),Ee.buffers.depth.setTest(!0),Ee.buffers.depth.setMask(!0),Ee.buffers.color.setMask(!0),Ee.setPolygonOffset(!1)}function qo(m,b,C,P){if((C.isScene===!0?C.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[P.id]===void 0){let te=Ct.has("EXT_color_buffer_half_float")||Ct.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[P.id]=new zt(1,1,{generateMipmaps:!0,type:te?ht:sn,minFilter:li,samples:Math.max(4,It.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:dt.workingColorSpace})}let F=E.state.transmissionRenderTarget[P.id],Y=P.viewport||ae;F.setSize(Y.z*I.transmissionResolutionScale,Y.w*I.transmissionResolutionScale);let V=I.getRenderTarget(),X=I.getActiveCubeFace(),$=I.getActiveMipmapLevel();I.setRenderTarget(F),I.getClearColor(j),he=I.getClearAlpha(),he<1&&I.setClearColor(16777215,.5),I.clear(),bn&&k.render(C);let oe=I.toneMapping;I.toneMapping=Ln;let ee=P.viewport;if(P.viewport!==void 0&&(P.viewport=void 0),E.setupLightsView(P),Bt===!0&&re.setGlobalState(I.clippingPlanes,P),rr(m,C,P),et.updateMultisampleRenderTarget(F),et.updateRenderTargetMipmap(F),Ct.has("WEBGL_multisampled_render_to_texture")===!1){let te=!1;for(let de=0,me=b.length;de<me;de++){let ge=b[de],{object:Ae,geometry:Ve,material:ue,group:Ye}=ge;if(ue.side===vn&&Ae.layers.test(P.layers)){let Se=ue.side;ue.side=Kt,ue.needsUpdate=!0,Yo(Ae,C,P,Ve,ue,Ye),ue.side=Se,ue.needsUpdate=!0,te=!0}}te===!0&&(et.updateMultisampleRenderTarget(F),et.updateRenderTargetMipmap(F))}I.setRenderTarget(V,X,$),I.setClearColor(j,he),ee!==void 0&&(P.viewport=ee),I.toneMapping=oe}function rr(m,b,C){let P=b.isScene===!0?b.overrideMaterial:null;for(let O=0,F=m.length;O<F;O++){let Y=m[O],{object:V,geometry:X,group:$}=Y,oe=Y.material;oe.allowOverride===!0&&P!==null&&(oe=P),V.layers.test(C.layers)&&Yo(V,b,C,X,oe,$)}}function Yo(m,b,C,P,O,F){U!==null&&O.isNodeMaterial&&U.setObject(m,O),m.onBeforeRender(I,b,C,P,O,F),m.modelViewMatrix.multiplyMatrices(C.matrixWorldInverse,m.matrixWorld),m.normalMatrix.getNormalMatrix(m.modelViewMatrix),O.onBeforeRender(I,b,C,P,m,F),O.transparent===!0&&O.side===vn&&O.forceSinglePass===!1?(O.side=Kt,O.needsUpdate=!0,I.renderBufferDirect(C,b,P,O,m,F),O.side=En,O.needsUpdate=!0,I.renderBufferDirect(C,b,P,O,m,F),O.side=vn):I.renderBufferDirect(C,b,P,O,m,F),m.onAfterRender(I,b,C,P,O,F)}function Zo(m){let b=0;for(let C of m)C.texture!==null&&b++;return b}function ni(m,b,C){b.isScene!==!0&&(b=Sn);let P=Ge.get(m),O=E.state.lights,F=E.state.shadowsArray,Y=O.state.version,V=ce.getParameters(m,O.state,F,b,C,E.state.lightProbeGridArray),X=ce.getProgramCacheKey(V),$=P.programs;P.environment=m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial?b.environment:null,P.fog=b.fog;let oe=m.isMeshStandardMaterial||m.isMeshLambertMaterial&&!m.envMap||m.isMeshPhongMaterial&&!m.envMap;P.envMap=B.get(m.envMap||P.environment,oe),P.envMapRotation=P.environment!==null&&m.envMap===null?b.environmentRotation:m.envMapRotation,$===void 0&&(m.addEventListener("dispose",_t),$=new Map,P.programs=$,P.programVariants=new Map);let ee=$.get(X);if(ee!==void 0){if(P.currentProgram===ee&&P.lightsStateVersion===Y)return sr(m,V),ee}else V.uniforms=ce.getUniforms(m),U!==null&&m.isNodeMaterial&&U.build(m,C,V),m.onBeforeCompile(V,I),ee=ce.acquireProgram(V,X),$.set(X,ee),P.uniforms=V.uniforms;let te=P.uniforms;return(!m.isShaderMaterial&&!m.isRawShaderMaterial||m.clipping===!0)&&(te.clippingPlanes=re.uniform),sr(m,V),P.needsLights=Pn(m),P.lightsStateVersion=Y,P.needsLights&&(te.ambientLightColor.value=O.state.ambient,te.lightProbe.value=O.state.probe,te.sunLights.value=O.state.sun,te.sunLightShadows.value=O.state.sunShadow,te.directionalLights.value=O.state.directional,te.directionalLightShadows.value=O.state.directionalShadow,te.spotLights.value=O.state.spot,te.spotLightShadows.value=O.state.spotShadow,te.rectAreaLights.value=O.state.rectArea,te.ltc_1.value=O.state.rectAreaLTC1,te.ltc_2.value=O.state.rectAreaLTC2,te.pointLights.value=O.state.point,te.pointLightShadows.value=O.state.pointShadow,te.hemisphereLights.value=O.state.hemi,te.sunShadowMatrix.value=O.state.sunShadowMatrix,te.sunShadowCascade.value=O.state.sunShadowCascade,te.directionalShadowMatrix.value=O.state.directionalShadowMatrix,te.spotLightMatrix.value=O.state.spotLightMatrix,te.spotLightMap.value=O.state.spotLightMap,te.pointShadowMatrix.value=O.state.pointShadowMatrix),P.numLightProbeGrids=Zo(E.state.lightProbeGridArray),P.currentProgram=ee,P.uniformsList=null,ee}function Cr(m,b,C,P,O){let F=Ge.get(m),Y=F.currentProgram.id+","+P+","+O,V=F.programVariants.get(Y);return V===void 0?(V=ni(m,b,C),F.programVariants.set(Y,V)):(F.currentProgram=V,F.uniformsList=null,F.outputColorSpace=P,F.toneMapping=O),V}function $o(m){if(m.uniformsList===null){let b=m.currentProgram.getUniforms();m.uniformsList=as.seqWithValue(b.seq,m.uniforms)}return m.uniformsList}function sr(m,b){let C=Ge.get(m);C.outputColorSpace=b.outputColorSpace,C.batching=b.batching,C.batchingColor=b.batchingColor,C.instancing=b.instancing,C.instancingColor=b.instancingColor,C.instancingMorph=b.instancingMorph,C.skinning=b.skinning,C.morphTargets=b.morphTargets,C.morphNormals=b.morphNormals,C.morphColors=b.morphColors,C.morphTargetsCount=b.morphTargetsCount,C.numClippingPlanes=b.numClippingPlanes,C.numIntersection=b.numClipIntersection,C.vertexAlphas=b.vertexAlphas,C.vertexTangents=b.vertexTangents,C.toneMapping=b.toneMapping}function Jo(m,b,C,P,O){b.isScene!==!0&&(b=Sn),et.resetTextureUnits();let F=b.fog,Y=P.isMeshStandardMaterial||P.isMeshLambertMaterial||P.isMeshPhongMaterial?b.environment:null,V=le===null?I.outputColorSpace:le.isXRRenderTarget===!0?le.texture.colorSpace:dt.workingColorSpace,X=P.isMeshStandardMaterial||P.isMeshLambertMaterial&&!P.envMap||P.isMeshPhongMaterial&&!P.envMap,$=B.get(P.envMap||Y,X),oe=P.vertexColors===!0&&!!C.attributes.color&&C.attributes.color.itemSize===4,ee=!!C.attributes.tangent&&(!!P.normalMap||P.anisotropy>0),te=!!C.morphAttributes.position,de=!!C.morphAttributes.normal,me=!!C.morphAttributes.color,ge=Ln;P.toneMapped&&(le===null||le.isXRRenderTarget===!0)&&(ge=I.toneMapping);let Ae=C.morphAttributes.position||C.morphAttributes.normal||C.morphAttributes.color,Ve=Ae!==void 0?Ae.length:0,ue=Ge.get(P),Ye=E.state.lights;if(Bt===!0&&(en===!0||m!==se)){let $e=m===se&&P.id===J;re.setState(P,m,$e)}let Se=!1,Ie=!1;P.version===ue.__version?ue.needsLights&&ue.lightsStateVersion!==Ye.state.version||O.isBatchedMesh&&ue.batching===!1||!O.isBatchedMesh&&ue.batching===!0||O.isBatchedMesh&&ue.batchingColor===!0&&O._colorsTexture===null||O.isBatchedMesh&&ue.batchingColor===!1&&O._colorsTexture!==null||O.isInstancedMesh&&ue.instancing===!1||!O.isInstancedMesh&&ue.instancing===!0||O.isSkinnedMesh&&ue.skinning===!1||!O.isSkinnedMesh&&ue.skinning===!0||O.isInstancedMesh&&ue.instancingColor===!0&&O.instanceColor===null||O.isInstancedMesh&&ue.instancingColor===!1&&O.instanceColor!==null||O.isInstancedMesh&&ue.instancingMorph===!0&&O.morphTexture===null||O.isInstancedMesh&&ue.instancingMorph===!1&&O.morphTexture!==null||ue.envMap!==$||P.fog===!0&&ue.fog!==F||ue.numClippingPlanes!==void 0&&(ue.numClippingPlanes!==re.numPlanes||ue.numIntersection!==re.numIntersection)||ue.vertexAlphas!==oe||ue.vertexTangents!==ee||ue.morphTargets!==te||ue.morphNormals!==de||ue.morphColors!==me||ue.morphTargetsCount!==Ve||ue.numLightProbeGrids!==Zo(E.state.lightProbeGridArray)?Se=!0:(ue.outputColorSpace!==V||ue.toneMapping!==ge)&&(Ie=!0):(Se=!0,ue.__version=P.version);let De=ue.currentProgram;(Se===!0||Ie===!0)&&(De=Ie===!0?Cr(P,b,O,V,ge):ni(P,b,O),U&&P.isNodeMaterial&&U.onUpdateProgram(P,De,ue));let gt=!1,ot=!1,We=!1,Ne=De.getUniforms(),ut=ue.uniforms;if(Ee.useProgram(De.program)&&(gt=!0,ot=!0,We=!0),P.id!==J&&(J=P.id,ot=!0),gt||se!==m){Ee.buffers.depth.getReversed()&&m.reversedDepth!==!0&&(m._reversedDepth=!0,m.updateProjectionMatrix()),Ne.setValue(q,"projectionMatrix",m.projectionMatrix),Ne.setValue(q,"viewMatrix",m.matrixWorldInverse);let Et=Ne.map.cameraPosition;Et!==void 0&&Et.setValue(q,Gn.setFromMatrixPosition(m.matrixWorld)),It.logarithmicDepthBuffer&&Ne.setValue(q,"logDepthBufFC",2/(Math.log(m.far+1)/Math.LN2)),(P.isMeshPhongMaterial||P.isMeshToonMaterial||P.isMeshLambertMaterial||P.isMeshBasicMaterial||P.isMeshStandardMaterial||P.isShaderMaterial)&&Ne.setValue(q,"isOrthographic",m.isOrthographicCamera===!0),se!==m&&(se=m,ot=!0,We=!0)}if(ue.needsLights&&(Ye.state.sunShadowMap.length>0&&Ne.setValue(q,"sunShadowMap",Ye.state.sunShadowMap,et),Ye.state.directionalShadowMap.length>0&&Ne.setValue(q,"directionalShadowMap",Ye.state.directionalShadowMap,et),Ye.state.spotShadowMap.length>0&&Ne.setValue(q,"spotShadowMap",Ye.state.spotShadowMap,et),Ye.state.pointShadowMap.length>0&&Ne.setValue(q,"pointShadowMap",Ye.state.pointShadowMap,et)),O.isSkinnedMesh){Ne.setOptional(q,O,"bindMatrix"),Ne.setOptional(q,O,"bindMatrixInverse");let $e=O.skeleton;$e&&($e.boneTexture===null&&$e.computeBoneTexture(),Ne.setValue(q,"boneTexture",$e.boneTexture,et))}O.isBatchedMesh&&(Ne.setOptional(q,O,"batchingTexture"),Ne.setValue(q,"batchingTexture",O._matricesTexture,et),Ne.setOptional(q,O,"batchingIdTexture"),Ne.setValue(q,"batchingIdTexture",O._indirectTexture,et),Ne.setOptional(q,O,"batchingColorTexture"),O._colorsTexture!==null&&Ne.setValue(q,"batchingColorTexture",O._colorsTexture,et));let Nt=C.morphAttributes;if((Nt.position!==void 0||Nt.normal!==void 0||Nt.color!==void 0)&&ie.update(O,C,De),(ot||ue.receiveShadow!==O.receiveShadow)&&(ue.receiveShadow=O.receiveShadow,Ne.setValue(q,"receiveShadow",O.receiveShadow)),(P.isMeshStandardMaterial||P.isMeshLambertMaterial||P.isMeshPhongMaterial)&&P.envMap===null&&b.environment!==null&&(ut.envMapIntensity.value=b.environmentIntensity),ut.dfgLUT!==void 0&&(ut.dfgLUT.value=Fy()),ot){if(Ne.setValue(q,"toneMappingExposure",I.toneMappingExposure),ue.needsLights&&tn(ut,We),F&&P.fog===!0&&be.refreshFogUniforms(ut,F),be.refreshMaterialUniforms(ut,P,fe,Oe,E.state.transmissionRenderTarget[m.id]),ue.needsLights&&ue.numLightProbeGrids>0){let $e=M,Et=0;for(let dn of E.state.lightProbeGridArray)dn.texture!==null&&($e.textures[Et]=dn.texture,$e.min[Et]=dn.boundingBox.min,$e.max[Et]=dn.boundingBox.max,$e.resolution[Et]=dn.resolution,Et++);for(let dn in $e)$e[dn].length=Et;ut.probesSH.value=$e.textures,ut.probesMin.value=$e.min,ut.probesMax.value=$e.max,ut.probesResolution.value=$e.resolution}as.upload(q,$o(ue),ut,et)}if(P.isShaderMaterial&&P.uniformsNeedUpdate===!0&&(as.upload(q,$o(ue),ut,et),P.uniformsNeedUpdate=!1),P.isSpriteMaterial&&Ne.setValue(q,"center",O.center),Ne.setValue(q,"modelViewMatrix",O.modelViewMatrix),Ne.setValue(q,"normalMatrix",O.normalMatrix),Ne.setValue(q,"modelMatrix",O.matrixWorld),P.uniformsGroups!==void 0){let $e=P.uniformsGroups;for(let Et=0,dn=$e.length;Et<dn;Et++){let Di=$e[Et];ze.update(Di,De),ze.bind(Di,De)}}return De}function tn(m,b){m.ambientLightColor.needsUpdate=b,m.lightProbe.needsUpdate=b,m.sunLights.needsUpdate=b,m.sunLightShadows.needsUpdate=b,m.directionalLights.needsUpdate=b,m.directionalLightShadows.needsUpdate=b,m.pointLights.needsUpdate=b,m.pointLightShadows.needsUpdate=b,m.spotLights.needsUpdate=b,m.spotLightShadows.needsUpdate=b,m.rectAreaLights.needsUpdate=b,m.hemisphereLights.needsUpdate=b}function Pn(m){return m.isMeshLambertMaterial||m.isMeshToonMaterial||m.isMeshPhongMaterial||m.isMeshStandardMaterial||m.isShadowMaterial||m.isShaderMaterial&&m.lights===!0}this.getActiveCubeFace=function(){return W},this.getActiveMipmapLevel=function(){return Z},this.getRenderTarget=function(){return le},this.setRenderTargetTextures=function(m,b,C){let P=Ge.get(m);P.__autoAllocateDepthBuffer=m.resolveDepthBuffer===!1,P.__autoAllocateDepthBuffer===!1&&(P.__useRenderToTexture=!1),Ge.get(m.texture).__webglTexture=b,Ge.get(m.depthTexture).__webglTexture=P.__autoAllocateDepthBuffer?void 0:C,P.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(m,b){let C=Ge.get(m);C.__webglFramebuffer=b,C.__useDefaultFramebuffer=b===void 0},this.setRenderTarget=function(m,b=0,C=0){le=m,W=b,Z=C;let P=null,O=!1,F=!1;if(m){let V=Ge.get(m);if(V.__useDefaultFramebuffer!==void 0){Ee.bindFramebuffer(q.FRAMEBUFFER,V.__webglFramebuffer),ae.copy(m.viewport),ye.copy(m.scissor),Le=m.scissorTest,Ee.viewport(ae),Ee.scissor(ye),Ee.setScissorTest(Le),J=-1;return}else if(V.__webglFramebuffer===void 0)et.setupRenderTarget(m);else if(V.__hasExternalTextures)et.rebindTextures(m,Ge.get(m.texture).__webglTexture,Ge.get(m.depthTexture).__webglTexture);else if(m.depthBuffer){let oe=m.depthTexture;if(V.__boundDepthTexture!==oe){if(oe!==null&&Ge.has(oe)&&(m.width!==oe.image.width||m.height!==oe.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");et.setupDepthRenderbuffer(m)}}let X=m.texture;(X.isData3DTexture||X.isDataArrayTexture||X.isCompressedArrayTexture)&&(F=!0);let $=Ge.get(m).__webglFramebuffer;m.isWebGLCubeRenderTarget?(Array.isArray($[b])?P=$[b][C]:P=$[b],O=!0):m.samples>0&&et.useMultisampledRTT(m)===!1?P=Ge.get(m).__webglMultisampledFramebuffer:Array.isArray($)?P=$[C]:P=$,ae.copy(m.viewport),ye.copy(m.scissor),Le=m.scissorTest}else ae.copy(Be).multiplyScalar(fe).floor(),ye.copy(at).multiplyScalar(fe).floor(),Le=ft;if(C!==0&&(P=z),Ee.bindFramebuffer(q.FRAMEBUFFER,P)&&Ee.drawBuffers(m,P),Ee.viewport(ae),Ee.scissor(ye),Ee.setScissorTest(Le),O){let V=Ge.get(m.texture);q.framebufferTexture2D(q.FRAMEBUFFER,q.COLOR_ATTACHMENT0,q.TEXTURE_CUBE_MAP_POSITIVE_X+b,V.__webglTexture,C)}else if(F){let V=b;for(let X=0;X<m.textures.length;X++){let $=Ge.get(m.textures[X]);q.framebufferTextureLayer(q.FRAMEBUFFER,q.COLOR_ATTACHMENT0+X,$.__webglTexture,C,V)}}else if(m!==null&&C!==0){let V=Ge.get(m.texture);q.framebufferTexture2D(q.FRAMEBUFFER,q.COLOR_ATTACHMENT0,q.TEXTURE_2D,V.__webglTexture,C)}J=-1};function v(m){let b=Ge.get(m);return(b.__readFormat!==m.format||b.__readType!==m.type)&&(b.__readFormat=m.format,b.__readType=m.type,b.__formatReadable=It.textureFormatReadable(m.format),b.__typeReadable=It.textureTypeReadable(m.type)),b}this.readRenderTargetPixels=function(m,b,C,P,O,F,Y,V=0){if(!(m&&m.isWebGLRenderTarget)){Ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let X=Ge.get(m).__webglFramebuffer;if(m.isWebGLCubeRenderTarget&&Y!==void 0&&(X=X[Y],Array.isArray(X)&&(X=X[0])),X){Ee.bindFramebuffer(q.FRAMEBUFFER,X);try{let $=m.textures[V],oe=$.format,ee=$.type;m.textures.length>1&&q.readBuffer(q.COLOR_ATTACHMENT0+V);let te=v($);if(te.__formatReadable===!1){Ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(te.__typeReadable===!1){Ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}b>=0&&b<=m.width-P&&C>=0&&C<=m.height-O&&q.readPixels(b,C,P,O,ve.convert(oe),ve.convert(ee),F)}finally{let $=le!==null?Ge.get(le).__webglFramebuffer:null;Ee.bindFramebuffer(q.FRAMEBUFFER,$)}}},this.readRenderTargetPixelsAsync=async function(m,b,C,P,O,F,Y,V=0){if(!(m&&m.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let X=Ge.get(m).__webglFramebuffer;if(m.isWebGLCubeRenderTarget&&Y!==void 0&&(X=X[Y],Array.isArray(X)&&(X=X[0])),X)if(b>=0&&b<=m.width-P&&C>=0&&C<=m.height-O){Ee.bindFramebuffer(q.FRAMEBUFFER,X);let $=m.textures[V],oe=$.format,ee=$.type;m.textures.length>1&&q.readBuffer(q.COLOR_ATTACHMENT0+V);let te=v($);if(te.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(te.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let de=q.createBuffer();q.bindBuffer(q.PIXEL_PACK_BUFFER,de),q.bufferData(q.PIXEL_PACK_BUFFER,F.byteLength,q.STREAM_READ),q.readPixels(b,C,P,O,ve.convert(oe),ve.convert(ee),0),q.bindBuffer(q.PIXEL_PACK_BUFFER,null);let me=le!==null?Ge.get(le).__webglFramebuffer:null;Ee.bindFramebuffer(q.FRAMEBUFFER,me);let ge=q.fenceSync(q.SYNC_GPU_COMMANDS_COMPLETE,0);return q.flush(),await pd(q,ge,4),q.bindBuffer(q.PIXEL_PACK_BUFFER,de),q.getBufferSubData(q.PIXEL_PACK_BUFFER,0,F),q.bindBuffer(q.PIXEL_PACK_BUFFER,null),q.deleteBuffer(de),q.deleteSync(ge),F}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(m,b=null,C=0){let P=Math.pow(2,-C),O=Math.floor(m.image.width*P),F=Math.floor(m.image.height*P),Y=b!==null?b.x:0,V=b!==null?b.y:0;et.setTexture2D(m,0),q.copyTexSubImage2D(q.TEXTURE_2D,C,0,0,Y,V,O,F),Ee.unbindTexture()},this.copyTextureToTexture=function(m,b,C=null,P=null,O=0,F=0){let Y,V,X,$,oe,ee,te,de,me,ge=m.isCompressedTexture?m.mipmaps[F]:m.image;if(C!==null)Y=C.max.x-C.min.x,V=C.max.y-C.min.y,X=C.isBox3?C.max.z-C.min.z:1,$=C.min.x,oe=C.min.y,ee=C.isBox3?C.min.z:0;else{let Ne=Math.pow(2,-O);Y=Math.floor(ge.width*Ne),V=Math.floor(ge.height*Ne),m.isDataArrayTexture?X=ge.depth:m.isData3DTexture?X=Math.floor(ge.depth*Ne):X=1,$=0,oe=0,ee=0}P!==null?(te=P.x,de=P.y,me=P.z):(te=0,de=0,me=0);let Ae=ve.convert(b.format),Ve=ve.convert(b.type),ue;b.isData3DTexture?(et.setTexture3D(b,0),ue=q.TEXTURE_3D):b.isDataArrayTexture||b.isCompressedArrayTexture?(et.setTexture2DArray(b,0),ue=q.TEXTURE_2D_ARRAY):(et.setTexture2D(b,0),ue=q.TEXTURE_2D),Ee.activeTexture(q.TEXTURE0),Ee.pixelStorei(q.UNPACK_FLIP_Y_WEBGL,b.flipY),Ee.pixelStorei(q.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),Ee.pixelStorei(q.UNPACK_ALIGNMENT,b.unpackAlignment);let Ye=Ee.getParameter(q.UNPACK_ROW_LENGTH),Se=Ee.getParameter(q.UNPACK_IMAGE_HEIGHT),Ie=Ee.getParameter(q.UNPACK_SKIP_PIXELS),De=Ee.getParameter(q.UNPACK_SKIP_ROWS),gt=Ee.getParameter(q.UNPACK_SKIP_IMAGES);Ee.pixelStorei(q.UNPACK_ROW_LENGTH,ge.width),Ee.pixelStorei(q.UNPACK_IMAGE_HEIGHT,ge.height),Ee.pixelStorei(q.UNPACK_SKIP_PIXELS,$),Ee.pixelStorei(q.UNPACK_SKIP_ROWS,oe),Ee.pixelStorei(q.UNPACK_SKIP_IMAGES,ee);let ot=m.isDataArrayTexture||m.isData3DTexture,We=b.isDataArrayTexture||b.isData3DTexture;if(m.isDepthTexture){let Ne=Ge.get(m),ut=Ge.get(b),Nt=Ge.get(Ne.__renderTarget),$e=Ge.get(ut.__renderTarget);Ee.bindFramebuffer(q.READ_FRAMEBUFFER,Nt.__webglFramebuffer),Ee.bindFramebuffer(q.DRAW_FRAMEBUFFER,$e.__webglFramebuffer);for(let Et=0;Et<X;Et++)ot&&(q.framebufferTextureLayer(q.READ_FRAMEBUFFER,q.COLOR_ATTACHMENT0,Ge.get(m).__webglTexture,O,ee+Et),q.framebufferTextureLayer(q.DRAW_FRAMEBUFFER,q.COLOR_ATTACHMENT0,Ge.get(b).__webglTexture,F,me+Et)),q.blitFramebuffer($,oe,$+Y,oe+V,te,de,te+Y,de+V,q.DEPTH_BUFFER_BIT,q.NEAREST);Ee.bindFramebuffer(q.READ_FRAMEBUFFER,null),Ee.bindFramebuffer(q.DRAW_FRAMEBUFFER,null)}else if(O!==0||m.isRenderTargetTexture||Ge.has(m)){let Ne=Ge.get(m),ut=Ge.get(b);Ee.bindFramebuffer(q.READ_FRAMEBUFFER,D),Ee.bindFramebuffer(q.DRAW_FRAMEBUFFER,G);for(let Nt=0;Nt<X;Nt++)ot?q.framebufferTextureLayer(q.READ_FRAMEBUFFER,q.COLOR_ATTACHMENT0,Ne.__webglTexture,O,ee+Nt):q.framebufferTexture2D(q.READ_FRAMEBUFFER,q.COLOR_ATTACHMENT0,q.TEXTURE_2D,Ne.__webglTexture,O),We?q.framebufferTextureLayer(q.DRAW_FRAMEBUFFER,q.COLOR_ATTACHMENT0,ut.__webglTexture,F,me+Nt):q.framebufferTexture2D(q.DRAW_FRAMEBUFFER,q.COLOR_ATTACHMENT0,q.TEXTURE_2D,ut.__webglTexture,F),O!==0?q.blitFramebuffer($,oe,$+Y,oe+V,te,de,te+Y,de+V,q.COLOR_BUFFER_BIT,q.NEAREST):We?q.copyTexSubImage3D(ue,F,te,de,me+Nt,$,oe,Y,V):q.copyTexSubImage2D(ue,F,te,de,$,oe,Y,V);Ee.bindFramebuffer(q.READ_FRAMEBUFFER,null),Ee.bindFramebuffer(q.DRAW_FRAMEBUFFER,null)}else We?m.isDataTexture||m.isData3DTexture?q.texSubImage3D(ue,F,te,de,me,Y,V,X,Ae,Ve,ge.data):b.isCompressedArrayTexture?q.compressedTexSubImage3D(ue,F,te,de,me,Y,V,X,Ae,ge.data):q.texSubImage3D(ue,F,te,de,me,Y,V,X,Ae,Ve,ge):m.isDataTexture?q.texSubImage2D(q.TEXTURE_2D,F,te,de,Y,V,Ae,Ve,ge.data):m.isCompressedTexture?q.compressedTexSubImage2D(q.TEXTURE_2D,F,te,de,ge.width,ge.height,Ae,ge.data):q.texSubImage2D(q.TEXTURE_2D,F,te,de,Y,V,Ae,Ve,ge);Ee.pixelStorei(q.UNPACK_ROW_LENGTH,Ye),Ee.pixelStorei(q.UNPACK_IMAGE_HEIGHT,Se),Ee.pixelStorei(q.UNPACK_SKIP_PIXELS,Ie),Ee.pixelStorei(q.UNPACK_SKIP_ROWS,De),Ee.pixelStorei(q.UNPACK_SKIP_IMAGES,gt),F===0&&b.generateMipmaps===!0&&b.mipmapsAutoUpdate===!0&&q.generateMipmap(ue),Ee.unbindTexture()},this.initRenderTarget=function(m){Ge.get(m).__webglFramebuffer===void 0&&et.setupRenderTarget(m)},this.initTexture=function(m){m.isCubeTexture?et.setTextureCube(m,0):m.isData3DTexture?et.setTexture3D(m,0):m.isDataArrayTexture||m.isCompressedArrayTexture?et.setTexture2DArray(m,0):et.setTexture2D(m,0),Ee.unbindTexture()},this.resetState=function(){W=0,Z=0,le=null,Ee.reset(),Te.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Wn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=dt._getDrawingBufferColorSpace(e),t.unpackColorSpace=dt._getUnpackColorSpace()}};var us=Math.pow(2,-24),wo=Symbol("SKIP_GENERATION"),zl={strategy:0,maxDepth:40,targetLeafSize:10,useSharedArrayBuffer:!1,setBoundingBox:!0,onProgress:null,indirect:!1,verbose:!0,range:null,[wo]:!1};function Dt(i,e,t){return t.min.x=e[i],t.min.y=e[i+1],t.min.z=e[i+2],t.max.x=e[i+3],t.max.y=e[i+4],t.max.z=e[i+5],t}function Ao(i){let e=-1,t=-1/0;for(let n=0;n<3;n++){let r=i[n+3]-i[n];r>t&&(t=r,e=n)}return e}function dh(i,e){e.set(i)}function ph(i,e,t){let n,r;for(let s=0;s<3;s++){let o=s+3;n=i[s],r=e[s],t[s]=n<r?n:r,n=i[o],r=e[o],t[o]=n>r?n:r}}function Eo(i,e,t){for(let n=0;n<3;n++){let r=e[i+2*n],s=e[i+2*n+1],o=r-s,a=r+s;o<t[n]&&(t[n]=o),a>t[n+3]&&(t[n+3]=a)}}function hs(i){let e=i[3]-i[0],t=i[4]-i[1],n=i[5]-i[2];return 2*(e*t+t*n+n*e)}function pt(i,e){return e[i+15]===65535}function vt(i,e){return e[i+6]}function At(i,e){return e[i+14]}function bt(i){return i+8}function Mt(i,e){let t=e[i+6];return i+t*8}function $i(i,e){return e[i+7]}function kl(i,e,t,n,r){let s=1/0,o=1/0,a=1/0,l=-1/0,u=-1/0,f=-1/0,h=1/0,c=1/0,d=1/0,x=-1/0,S=-1/0,p=-1/0,g=i.offset||0;for(let y=(e-g)*6,T=(e+t-g)*6;y<T;y+=6){let M=i[y+0],A=i[y+1],E=M-A,_=M+A;E<s&&(s=E),_>l&&(l=_),M<h&&(h=M),M>x&&(x=M);let w=i[y+2],L=i[y+3],I=w-L,N=w+L;I<o&&(o=I),N>u&&(u=N),w<c&&(c=w),w>S&&(S=w);let U=i[y+4],z=i[y+5],D=U-z,G=U+z;D<a&&(a=D),G>f&&(f=G),U<d&&(d=U),U>p&&(p=U)}n[0]=s,n[1]=o,n[2]=a,n[3]=l,n[4]=u,n[5]=f,r[0]=h,r[1]=c,r[2]=d,r[3]=x,r[4]=S,r[5]=p}var Ri=32,Oy=(i,e)=>i.candidate-e.candidate,Ji=new Array(Ri).fill().map(()=>({count:0,bounds:new Float32Array(6),rightCacheBounds:new Float32Array(6),leftCacheBounds:new Float32Array(6),candidate:0})),Hl=new Float32Array(6);function tp(i,e,t,n,r,s){let o=-1,a=0;if(s===0)o=Ao(e),o!==-1&&(a=(e[o]+e[o+3])/2);else if(s===1)o=Ao(i),o!==-1&&(a=By(t,n,r,o));else if(s===2){let l=hs(i),u=1.25*r,f=t.offset||0,h=(n-f)*6,c=(n+r-f)*6;for(let d=0;d<3;d++){let x=e[d],g=(e[d+3]-x)/Ri;if(r<Ri/4){let y=[...Ji];y.length=r;let T=0;for(let A=h;A<c;A+=6,T++){let E=y[T];E.candidate=t[A+2*d],E.count=0;let{bounds:_,leftCacheBounds:w,rightCacheBounds:L}=E;for(let I=0;I<3;I++)L[I]=1/0,L[I+3]=-1/0,w[I]=1/0,w[I+3]=-1/0,_[I]=1/0,_[I+3]=-1/0;Eo(A,t,_)}y.sort(Oy);let M=r;for(let A=0;A<M;A++){let E=y[A];for(;A+1<M&&y[A+1].candidate===E.candidate;)y.splice(A+1,1),M--}for(let A=h;A<c;A+=6){let E=t[A+2*d];for(let _=0;_<M;_++){let w=y[_];E>=w.candidate?Eo(A,t,w.rightCacheBounds):(Eo(A,t,w.leftCacheBounds),w.count++)}}for(let A=0;A<M;A++){let E=y[A],_=E.count,w=r-E.count,L=E.leftCacheBounds,I=E.rightCacheBounds,N=0;_!==0&&(N=hs(L)/l);let U=0;w!==0&&(U=hs(I)/l);let z=1+1.25*(N*_+U*w);z<u&&(o=d,u=z,a=E.candidate)}}else{for(let M=0;M<Ri;M++){let A=Ji[M];A.count=0,A.candidate=x+g+M*g;let E=A.bounds;for(let _=0;_<3;_++)E[_]=1/0,E[_+3]=-1/0}for(let M=h;M<c;M+=6){let _=~~((t[M+2*d]-x)/g);_>=Ri&&(_=Ri-1);let w=Ji[_];w.count++,Eo(M,t,w.bounds)}let y=Ji[Ri-1];dh(y.bounds,y.rightCacheBounds);for(let M=Ri-2;M>=0;M--){let A=Ji[M],E=Ji[M+1];ph(A.bounds,E.rightCacheBounds,A.rightCacheBounds)}let T=0;for(let M=0;M<Ri-1;M++){let A=Ji[M],E=A.count,_=A.bounds,L=Ji[M+1].rightCacheBounds;E!==0&&(T===0?dh(_,Hl):ph(_,Hl,Hl)),T+=E;let I=0,N=0;T!==0&&(I=hs(Hl)/l);let U=r-T;U!==0&&(N=hs(L)/l);let z=1+1.25*(I*T+N*U);z<u&&(o=d,u=z,a=A.candidate)}}}}else console.warn(`BVH: Invalid build strategy value ${s} used.`);return{axis:o,pos:a}}function By(i,e,t,n){let r=0,s=i.offset;for(let o=e,a=e+t;o<a;o++)r+=i[(o-s)*6+n*2];return r/t}var fs=class{constructor(){this.boundingData=new Float32Array(6)}};function np(i,e,t,n,r,s){let o=n,a=n+r-1,l=s.pos,u=s.axis*2,f=t.offset||0;for(;;){for(;o<=a&&t[(o-f)*6+u]<l;)o++;for(;o<=a&&t[(a-f)*6+u]>=l;)a--;if(o<a){for(let h=0;h<e;h++){let c=i[o*e+h];i[o*e+h]=i[a*e+h],i[a*e+h]=c}for(let h=0;h<6;h++){let c=o-f,d=a-f,x=t[c*6+h];t[c*6+h]=t[d*6+h],t[d*6+h]=x}o++,a--}else return o}}var ip,Gl,mh,rp,zy=Math.pow(2,32);function Vl(i){return"count"in i?1:1+Vl(i.left)+Vl(i.right)}function sp(i,e,t){return ip=new Float32Array(t),Gl=new Uint32Array(t),mh=new Uint16Array(t),rp=new Uint8Array(t),gh(i,e)}function gh(i,e){let t=i/4,n=i/2,r="count"in e,s=e.boundingData;for(let o=0;o<6;o++)ip[t+o]=s[o];if(r)return e.buffer?(rp.set(new Uint8Array(e.buffer),i),i+e.buffer.byteLength):(Gl[t+6]=e.offset,mh[n+14]=e.count,mh[n+15]=65535,i+32);{let{left:o,right:a,splitAxis:l}=e,u=i+32,f=gh(u,o),h=i/32,d=f/32-h;if(d>zy)throw new Error("MeshBVH: Cannot store relative child node offset greater than 32 bits.");return Gl[t+6]=d,Gl[t+7]=l,gh(f,a)}}function ky(i,e,t,n,r,s){let{maxDepth:o,verbose:a,targetLeafSize:l,_strictLeafSize:u=1/0,strategy:f,onProgress:h}=r,c=i.primitiveBuffer,d=i.primitiveBufferStride,x=new Float32Array(6),S=!1,p=new fs;return kl(e,t,n,p.boundingData,x),y(p,t,n,x),p;function g(T){h&&h((T-s.offset)/s.count)}function y(T,M,A,E=null,_=0){!S&&_>=o&&(S=!0,a&&console.warn(`BVH: Max depth of ${o} reached when generating BVH. Consider increasing maxDepth.`));let w=A>u;if(A<=l&&!w||_>=o)return g(M+A),T.offset=M,T.count=A,T;let L=tp(T.boundingData,E,e,M,A,f),I=L.axis===-1?-1:np(c,d,e,M,A,L);if(L.axis===-1||I===M||I===M+A){if(!w)return g(M+A),T.offset=M,T.count=A,T;L.axis=Math.max(0,Ao(T.boundingData)),I=M+Math.max(1,Math.floor(A/2))}T.splitAxis=L.axis;let N=new fs,U=M,z=I-M;T.left=N,kl(e,U,z,N.boundingData,x),y(N,U,z,x,_+1);let D=new fs,G=I,W=A-z;return T.right=D,kl(e,G,W,D.boundingData,x),y(D,G,W,x,_+1),T}}function op(i,e){let t=e.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,n=i.getRootRanges(e.range),r=n[0],s=n[n.length-1],o={offset:r.offset,count:s.offset+s.count-r.offset},a=new Float32Array(6*o.count);a.offset=o.offset,i.computePrimitiveBounds(o.offset,o.count,a),i._roots=n.map(l=>{let u=ky(i,a,l.offset,l.count,e,o),f=Vl(u),h=new t(32*f);return sp(0,u,h),h})}var Ki=class{constructor(e){this._getNewPrimitive=e,this._primitives=[]}getPrimitive(){let e=this._primitives;return e.length===0?this._getNewPrimitive():e.pop()}releasePrimitive(e){this._primitives.push(e)}};var xh=class{constructor(){this.float32Array=null,this.uint16Array=null,this.uint32Array=null;let e=[],t=null;this.setBuffer=n=>{t&&e.push(t),t=n,this.float32Array=new Float32Array(n),this.uint16Array=new Uint16Array(n),this.uint32Array=new Uint32Array(n)},this.clearBuffer=()=>{t=null,this.float32Array=null,this.uint16Array=null,this.uint32Array=null,e.length!==0&&this.setBuffer(e.pop())}}},xt=new xh;var Qi,ps,ds=[],Wl=new Ki(()=>new kt);function ap(i,e,t,n,r,s){Qi=Wl.getPrimitive(),ps=Wl.getPrimitive(),ds.push(Qi,ps),xt.setBuffer(i._roots[e]);let o=vh(0,i.geometry,t,n,r,s);xt.clearBuffer(),Wl.releasePrimitive(Qi),Wl.releasePrimitive(ps),ds.pop(),ds.pop();let a=ds.length;return a>0&&(ps=ds[a-1],Qi=ds[a-2]),o}function vh(i,e,t,n,r=null,s=0,o=0){let{float32Array:a,uint16Array:l,uint32Array:u}=xt,f=i*2;if(pt(f,l)){let c=vt(i,u),d=At(f,l);return Dt(i,a,Qi),n(c,d,!1,o,s+i/8,Qi)}else{let I=function(U){let{uint16Array:z,uint32Array:D}=xt,G=U*2;for(;!pt(G,z);)U=bt(U),G=U*2;return vt(U,D)},N=function(U){let{uint16Array:z,uint32Array:D}=xt,G=U*2;for(;!pt(G,z);)U=Mt(U,D),G=U*2;return vt(U,D)+At(G,z)},c=bt(i),d=Mt(i,u),x=c,S=d,p,g,y,T;if(r&&(y=Qi,T=ps,Dt(x,a,y),Dt(S,a,T),p=r(y),g=r(T),g<p)){x=d,S=c;let U=p;p=g,g=U,y=T}y||(y=Qi,Dt(x,a,y));let M=pt(x*2,l),A=t(y,M,p,o+1,s+x/8),E;if(A===2){let U=I(x),D=N(x)-U;E=n(U,D,!0,o+1,s+x/8,y)}else E=A&&vh(x,e,t,n,r,s,o+1);if(E)return!0;T=ps,Dt(S,a,T);let _=pt(S*2,l),w=t(T,_,g,o+1,s+S/8),L;if(w===2){let U=I(S),D=N(S)-U;L=n(U,D,!0,o+1,s+S/8,T)}else L=w&&vh(S,e,t,n,r,s,o+1);return!!L}}var Ro=new xt.constructor,ql=new xt.constructor,ji=new Ki(()=>new kt),ms=new kt,gs=new kt,_h=new kt,yh=new kt,Sh=!1;function lp(i,e,t,n){if(Sh)throw new Error("MeshBVH: Recursive calls to bvhcast not supported.");Sh=!0;let r=i._roots,s=e._roots,o,a=0,l=0,u=new Ze().copy(t).invert();for(let f=0,h=r.length;f<h;f++){Ro.setBuffer(r[f]),l=0;let c=ji.getPrimitive();Dt(0,Ro.float32Array,c),c.applyMatrix4(u);for(let d=0,x=s.length;d<x&&(ql.setBuffer(s[d]),o=Qn(0,0,t,u,n,a,l,0,0,c),ql.clearBuffer(),l+=s[d].byteLength/32,!o);d++);if(ji.releasePrimitive(c),Ro.clearBuffer(),a+=r[f].byteLength/32,o)break}return Sh=!1,o}function Qn(i,e,t,n,r,s=0,o=0,a=0,l=0,u=null,f=!1){let h,c;f?(h=ql,c=Ro):(h=Ro,c=ql);let d=h.float32Array,x=h.uint32Array,S=h.uint16Array,p=c.float32Array,g=c.uint32Array,y=c.uint16Array,T=i*2,M=e*2,A=pt(T,S),E=pt(M,y),_=!1;if(E&&A)f?_=r(vt(e,g),At(e*2,y),vt(i,x),At(i*2,S),l,o+e/8,a,s+i/8):_=r(vt(i,x),At(i*2,S),vt(e,g),At(e*2,y),a,s+i/8,l,o+e/8);else if(E){let w=ji.getPrimitive();Dt(e,p,w),w.applyMatrix4(t);let L=bt(i),I=Mt(i,x);Dt(L,d,ms),Dt(I,d,gs);let N=w.intersectsBox(ms),U=w.intersectsBox(gs);_=N&&Qn(e,L,n,t,r,o,s,l,a+1,w,!f)||U&&Qn(e,I,n,t,r,o,s,l,a+1,w,!f),ji.releasePrimitive(w)}else{let w=bt(e),L=Mt(e,g);Dt(w,p,_h),Dt(L,p,yh);let I=u.intersectsBox(_h),N=u.intersectsBox(yh);if(I&&N)_=Qn(i,w,t,n,r,s,o,a,l+1,u,f)||Qn(i,L,t,n,r,s,o,a,l+1,u,f);else if(I)if(A)_=Qn(i,w,t,n,r,s,o,a,l+1,u,f);else{let U=ji.getPrimitive();U.copy(_h).applyMatrix4(t);let z=bt(i),D=Mt(i,x);Dt(z,d,ms),Dt(D,d,gs);let G=U.intersectsBox(ms),W=U.intersectsBox(gs);_=G&&Qn(w,z,n,t,r,o,s,l,a+1,U,!f)||W&&Qn(w,D,n,t,r,o,s,l,a+1,U,!f),ji.releasePrimitive(U)}else if(N)if(A)_=Qn(i,L,t,n,r,s,o,a,l+1,u,f);else{let U=ji.getPrimitive();U.copy(yh).applyMatrix4(t);let z=bt(i),D=Mt(i,x);Dt(z,d,ms),Dt(D,d,gs);let G=U.intersectsBox(ms),W=U.intersectsBox(gs);_=G&&Qn(L,z,n,t,r,o,s,l,a+1,U,!f)||W&&Qn(L,D,n,t,r,o,s,l,a+1,U,!f),ji.releasePrimitive(U)}}return _}var Yl=new class{constructor(){let i=null,e=null,t=null,n=!1;this.root=null,this.buffer=null,this.uint32Array=null,this.uint16Array=null,this.setBVH=(s,o)=>{if(n)throw new Error("BVHTraversalHelper: cannot call setBVH during an active traversal.");this.root=o,this.buffer=i=s._roots[o],this.uint16Array=t=new Uint16Array(i),this.uint32Array=e=new Uint32Array(i)},this.reset=()=>{this.root=null,this.buffer=i=null,this.uint16Array=t=null,this.uint32Array=e=null},this.getRangeStart=s=>{let o=s*2;for(;!pt(o,t);)s=bt(s),o=s*2;return vt(s,e)},this.getRangeEnd=s=>{let o=s*2;for(;!pt(o,t);)s=Mt(s,e),o=s*2;return vt(s,e)+At(o,t)};let r=(s,o,a)=>{let l=o*2,u=pt(l,t);if(!s(a,u,o)&&!u){let h=bt(o),c=Mt(o,e);r(s,h,a+1),r(s,c,a+1)}};this.traverseBuffer=s=>{if(n)throw new Error("BVHTraversalHelper: cannot start a traversal during an active traversal.");n=!0;try{r(s,0,0)}finally{n=!1}},this.traverse=s=>{this.traverseBuffer((o,a,l)=>{if(a){let u=l*2,f=e[l+6],h=t[u+14];return s(o,a,new Float32Array(i,l*4,6),f,h)}else{let u=$i(l,e);return s(o,a,new Float32Array(i,l*4,6),u)}})}}};var cp=new kt,xs=new Float32Array(6),Zl=class{constructor(){this._roots=null,this.primitiveBuffer=null,this.primitiveBufferStride=null}init(e){e={...zl,...e},"maxLeafSize"in e&&(console.warn('BVH: "maxLeafSize" option has been deprecated. Use "targetLeafSize", instead.'),e={...e,targetLeafSize:e.maxLeafSize}),op(this,e)}getRootRanges(){throw new Error("BVH: getRootRanges() not implemented")}writePrimitiveBounds(){throw new Error("BVH: writePrimitiveBounds() not implemented")}writePrimitiveRangeBounds(e,t,n,r){let s=1/0,o=1/0,a=1/0,l=-1/0,u=-1/0,f=-1/0;for(let h=e,c=e+t;h<c;h++){this.writePrimitiveBounds(h,xs,0);let[d,x,S,p,g,y]=xs;d<s&&(s=d),p>l&&(l=p),x<o&&(o=x),g>u&&(u=g),S<a&&(a=S),y>f&&(f=y)}return n[r+0]=s,n[r+1]=o,n[r+2]=a,n[r+3]=l,n[r+4]=u,n[r+5]=f,n}computePrimitiveBounds(e,t,n){let r=n.offset||0;for(let s=e,o=e+t;s<o;s++){this.writePrimitiveBounds(s,xs,0);let[a,l,u,f,h,c]=xs,d=(a+f)/2,x=(l+h)/2,S=(u+c)/2,p=(f-a)/2,g=(h-l)/2,y=(c-u)/2,T=(s-r)*6;n[T+0]=d,n[T+1]=p+(Math.abs(d)+p)*us,n[T+2]=x,n[T+3]=g+(Math.abs(x)+g)*us,n[T+4]=S,n[T+5]=y+(Math.abs(S)+y)*us}return n}shiftPrimitiveOffsets(e){let t=this._indirectBuffer;if(t)for(let n=0,r=t.length;n<r;n++)t[n]+=e;else{let n=this._roots;for(let r=0;r<n.length;r++){let s=n[r],o=new Uint32Array(s),a=new Uint16Array(s),l=s.byteLength/32;for(let u=0;u<l;u++){let f=8*u,h=2*f;pt(h,a)&&(o[f+6]+=e)}}}}traverse(e,t=0){Yl.setBVH(this,t),Yl.traverse(e),Yl.reset()}refit(){let e=this._roots;for(let t=0,n=e.length;t<n;t++){let r=e[t],s=new Uint32Array(r),o=new Uint16Array(r),a=new Float32Array(r),l=r.byteLength/32;for(let u=l-1;u>=0;u--){let f=u*8,h=f*2;if(pt(h,o)){let d=vt(f,s),x=At(h,o);this.writePrimitiveRangeBounds(d,x,xs,0),a.set(xs,f)}else{let d=bt(f),x=Mt(f,s);for(let S=0;S<3;S++){let p=a[d+S],g=a[d+S+3],y=a[x+S],T=a[x+S+3];a[f+S]=p<y?p:y,a[f+S+3]=g>T?g:T}}}}}getBoundingBox(e){return e.makeEmpty(),this._roots.forEach(n=>{Dt(0,new Float32Array(n),cp),e.union(cp)}),e}shapecast(e){let{boundsTraverseOrder:t,intersectsBounds:n,intersectsRange:r,intersectsPrimitive:s,scratchPrimitive:o,iterate:a}=e;if(r&&s){let h=r;r=(c,d,x,S,p)=>h(c,d,x,S,p)?!0:a(c,d,this,s,x,S,o)}else r||(s?r=(h,c,d,x)=>a(h,c,this,s,d,x,o):r=(h,c,d)=>d);let l=!1,u=0,f=this._roots;for(let h=0,c=f.length;h<c;h++){let d=f[h];if(l=ap(this,h,n,r,t,u),l)break;u+=d.byteLength/32}return l}bvhcast(e,t,n){let{intersectsRanges:r}=n;return lp(this,e,t,r)}};function up(){return typeof SharedArrayBuffer<"u"}function Co(i){return i.index?i.index.count:i.attributes.position.count}function er(i){return Co(i)/3}function bh(i,e=ArrayBuffer){return i>65535?new Uint32Array(new e(4*i)):new Uint16Array(new e(2*i))}function hp(i,e){if(!i.index){let t=i.attributes.position.count,n=e.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,r=bh(t,n);i.setIndex(new yt(r,1));for(let s=0;s<t;s++)r[s]=s}}function Gy(i,e,t){let n=Co(i)/t,r=e||i.drawRange,s=r.start/t,o=(r.start+r.count)/t,a=Math.max(0,s),l=Math.min(n,o)-a;return{offset:Math.floor(a),count:Math.floor(l)}}function Vy(i,e){return i.groups.map(t=>({offset:t.start/e,count:t.count/e}))}function Mh(i,e,t){let n=Gy(i,e,t),r=Vy(i,t);if(!r.length)return[n];let s=[],o=n.offset,a=n.offset+n.count,l=Co(i)/t,u=[];for(let c of r){let{offset:d,count:x}=c,S=d,p=isFinite(x)?x:l-d,g=d+p;S<a&&g>o&&(u.push({pos:Math.max(o,S),isStart:!0}),u.push({pos:Math.min(a,g),isStart:!1}))}u.sort((c,d)=>c.pos!==d.pos?c.pos-d.pos:c.type==="end"?-1:1);let f=0,h=null;for(let c of u){let d=c.pos;f!==0&&d!==h&&s.push({offset:h,count:d-h}),f+=c.isStart?1:-1,h=d}return s}function Wy(i,e){let t=i[i.length-1],n=t.offset+t.count>2**16,r=i.reduce((u,f)=>u+f.count,0),s=n?4:2,o=e?new SharedArrayBuffer(r*s):new ArrayBuffer(r*s),a=n?new Uint32Array(o):new Uint16Array(o),l=0;for(let u=0;u<i.length;u++){let{offset:f,count:h}=i[u];for(let c=0;c<h;c++)a[l+c]=f+c;l+=h}return a}var $l=class extends Zl{get indirect(){return!!this._indirectBuffer}get primitiveStride(){return null}get primitiveBufferStride(){return this.indirect?1:this.primitiveStride}set primitiveBufferStride(e){}get primitiveBuffer(){return this.indirect?this._indirectBuffer:this.geometry.index.array}set primitiveBuffer(e){}constructor(e,t={}){if(e.isBufferGeometry){if(e.index&&e.index.isInterleavedBufferAttribute)throw new Error("BVH: InterleavedBufferAttribute is not supported for the index attribute.")}else throw new Error("BVH: Only BufferGeometries are supported.");if(t.useSharedArrayBuffer&&!up())throw new Error("BVH: SharedArrayBuffer is not available.");super(),this.geometry=e,this.resolvePrimitiveIndex=t.indirect?n=>this._indirectBuffer[n]:n=>n,this.primitiveBuffer=null,this.primitiveBufferStride=null,this._indirectBuffer=null,t={...zl,...t},t[wo]||this.init(t)}init(e){let{geometry:t,primitiveStride:n}=this;if(e.indirect){let r=Mh(t,e.range,n),s=Wy(r,e.useSharedArrayBuffer);this._indirectBuffer=s}else hp(t,e);super.init(e),!t.boundingBox&&e.setBoundingBox&&(t.boundingBox=this.getBoundingBox(new kt))}getRootRanges(e){return this.indirect?[{offset:0,count:this._indirectBuffer.length}]:Mh(this.geometry,e,this.primitiveStride)}raycastObject3D(){throw new Error("BVH: raycastObject3D() not implemented")}};var zn=class{constructor(){this.min=1/0,this.max=-1/0}setFromPointsField(e,t){let n=1/0,r=-1/0;for(let s=0,o=e.length;s<o;s++){let l=e[s][t];n=l<n?l:n,r=l>r?l:r}this.min=n,this.max=r}setFromPoints(e,t){let n=1/0,r=-1/0;for(let s=0,o=t.length;s<o;s++){let a=t[s],l=e.dot(a);n=l<n?l:n,r=l>r?l:r}this.min=n,this.max=r}isSeparated(e){return this.min>e.max||e.min>this.max}};zn.prototype.setFromBox=(function(){let i=new H;return function(t,n){let r=n.min,s=n.max,o=1/0,a=-1/0;for(let l=0;l<=1;l++)for(let u=0;u<=1;u++)for(let f=0;f<=1;f++){i.x=r.x*l+s.x*(1-l),i.y=r.y*u+s.y*(1-u),i.z=r.z*f+s.z*(1-f);let h=t.dot(i);o=Math.min(h,o),a=Math.max(h,a)}this.min=o,this.max=a}})();var Xy=(function(){let i=new H,e=new H,t=new H;return function(r,s,o){let a=r.start,l=i,u=s.start,f=e;t.subVectors(a,u),i.subVectors(r.end,r.start),e.subVectors(s.end,s.start);let h=t.dot(f),c=f.dot(l),d=f.dot(f),x=t.dot(l),p=l.dot(l)*d-c*c,g,y;p!==0?g=(h*c-x*d)/p:g=0,y=(h+g*c)/d,o.x=g,o.y=y}})(),Io=(function(){let i=new Ue,e=new H,t=new H;return function(r,s,o,a){Xy(r,s,i);let l=i.x,u=i.y;if(l>=0&&l<=1&&u>=0&&u<=1){r.at(l,o),s.at(u,a);return}else if(l>=0&&l<=1){u<0?s.at(0,a):s.at(1,a),r.closestPointToPoint(a,!0,o);return}else if(u>=0&&u<=1){l<0?r.at(0,o):r.at(1,o),s.closestPointToPoint(o,!0,a);return}else{let f;l<0?f=r.start:f=r.end;let h;u<0?h=s.start:h=s.end;let c=e,d=t;if(r.closestPointToPoint(h,!0,e),s.closestPointToPoint(f,!0,t),c.distanceToSquared(h)<=d.distanceToSquared(f)){o.copy(c),a.copy(h);return}else{o.copy(f),a.copy(d);return}}}})(),fp=(function(){let i=new H,e=new H,t=new wn,n=new An;return function(s,o){let{radius:a,center:l}=s,{a:u,b:f,c:h}=o;if(n.start=u,n.end=f,n.closestPointToPoint(l,!0,i).distanceTo(l)<=a||(n.start=u,n.end=h,n.closestPointToPoint(l,!0,i).distanceTo(l)<=a)||(n.start=f,n.end=h,n.closestPointToPoint(l,!0,i).distanceTo(l)<=a))return!0;let S=o.getPlane(t);if(Math.abs(S.distanceToPoint(l))<=a){let g=S.projectPoint(l,e);if(o.containsPoint(g))return!0}return!1}})();var qy=["x","y","z"],Ci=1e-15,dp=Ci*Ci;function Yn(i){return Math.abs(i)<Ci}var hn=class extends gn{constructor(...e){super(...e),this.isExtendedTriangle=!0,this.satAxes=new Array(4).fill().map(()=>new H),this.satBounds=new Array(4).fill().map(()=>new zn),this.points=[this.a,this.b,this.c],this.plane=new wn,this.isDegenerateIntoSegment=!1,this.isDegenerateIntoPoint=!1,this.degenerateSegment=new An,this.needsUpdate=!0}intersectsSphere(e){return fp(e,this)}update(){let e=this.a,t=this.b,n=this.c,r=this.points,s=this.satAxes,o=this.satBounds,a=s[0],l=o[0];this.getNormal(a),l.setFromPoints(a,r);let u=s[1],f=o[1];u.subVectors(e,t),f.setFromPoints(u,r);let h=s[2],c=o[2];h.subVectors(t,n),c.setFromPoints(h,r);let d=s[3],x=o[3];d.subVectors(n,e),x.setFromPoints(d,r);let S=u.length(),p=h.length(),g=d.length();this.isDegenerateIntoPoint=!1,this.isDegenerateIntoSegment=!1,S<Ci?p<Ci||g<Ci?this.isDegenerateIntoPoint=!0:(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(e),this.degenerateSegment.end.copy(n)):p<Ci?g<Ci?this.isDegenerateIntoPoint=!0:(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(t),this.degenerateSegment.end.copy(e)):g<Ci&&(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(n),this.degenerateSegment.end.copy(t)),this.plane.setFromNormalAndCoplanarPoint(a,e),this.needsUpdate=!1}};hn.prototype.closestPointToSegment=(function(){let i=new H,e=new H,t=new An;return function(r,s=null,o=null){let{start:a,end:l}=r,u=this.points,f,h=1/0;for(let c=0;c<3;c++){let d=(c+1)%3;t.start.copy(u[c]),t.end.copy(u[d]),Io(t,r,i,e),f=i.distanceToSquared(e),f<h&&(h=f,s&&s.copy(i),o&&o.copy(e))}return this.closestPointToPoint(a,i),f=a.distanceToSquared(i),f<h&&(h=f,s&&s.copy(i),o&&o.copy(a)),this.closestPointToPoint(l,i),f=l.distanceToSquared(i),f<h&&(h=f,s&&s.copy(i),o&&o.copy(l)),Math.sqrt(h)}})();hn.prototype.intersectsTriangle=(function(){let i=new hn,e=new zn,t=new zn,n=new H,r=new H,s=new H,o=new H,a=new An,l=new An,u=new H,f=new Ue,h=new Ue;function c(T,M,A,E){let _=n;!T.isDegenerateIntoPoint&&!T.isDegenerateIntoSegment?_.copy(T.plane.normal):_.copy(M.plane.normal);let w=T.satBounds,L=T.satAxes;for(let U=1;U<4;U++){let z=w[U],D=L[U];if(e.setFromPoints(D,M.points),z.isSeparated(e)||(o.copy(_).cross(D),e.setFromPoints(o,T.points),t.setFromPoints(o,M.points),e.isSeparated(t)))return!1}let I=M.satBounds,N=M.satAxes;for(let U=1;U<4;U++){let z=I[U],D=N[U];if(e.setFromPoints(D,T.points),z.isSeparated(e)||(o.crossVectors(_,D),e.setFromPoints(o,T.points),t.setFromPoints(o,M.points),e.isSeparated(t)))return!1}return A&&(E||console.warn("ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0."),A.start.set(0,0,0),A.end.set(0,0,0)),!0}function d(T,M,A,E,_,w,L,I,N,U,z){let D=L/(L-I);U.x=E+(_-E)*D,z.start.subVectors(M,T).multiplyScalar(D).add(T),D=L/(L-N),U.y=E+(w-E)*D,z.end.subVectors(A,T).multiplyScalar(D).add(T)}function x(T,M,A,E,_,w,L,I,N,U,z){if(_>0)d(T.c,T.a,T.b,E,M,A,N,L,I,U,z);else if(w>0)d(T.b,T.a,T.c,A,M,E,I,L,N,U,z);else if(I*N>0||L!=0)d(T.a,T.b,T.c,M,A,E,L,I,N,U,z);else if(I!=0)d(T.b,T.a,T.c,A,M,E,I,L,N,U,z);else if(N!=0)d(T.c,T.a,T.b,E,M,A,N,L,I,U,z);else return!0;return!1}function S(T,M,A,E){let _=M.degenerateSegment,w=T.plane.distanceToPoint(_.start),L=T.plane.distanceToPoint(_.end);return Yn(w)?Yn(L)?c(T,M,A,E):(A&&(A.start.copy(_.start),A.end.copy(_.start)),T.containsPoint(_.start)):Yn(L)?(A&&(A.start.copy(_.end),A.end.copy(_.end)),T.containsPoint(_.end)):T.plane.intersectLine(_,n)!=null?(A&&(A.start.copy(n),A.end.copy(n)),T.containsPoint(n)):!1}function p(T,M,A){let E=M.a;return Yn(T.plane.distanceToPoint(E))&&T.containsPoint(E)?(A&&(A.start.copy(E),A.end.copy(E)),!0):!1}function g(T,M,A){let E=T.degenerateSegment,_=M.a;return E.closestPointToPoint(_,!0,n),_.distanceToSquared(n)<dp?(A&&(A.start.copy(_),A.end.copy(_)),!0):!1}function y(T,M,A,E){if(T.isDegenerateIntoSegment)if(M.isDegenerateIntoSegment){let _=T.degenerateSegment,w=M.degenerateSegment,L=r,I=s;_.delta(L),w.delta(I);let N=n.subVectors(w.start,_.start),U=L.x*I.y-L.y*I.x;if(Yn(U))return!1;let z=(N.x*I.y-N.y*I.x)/U,D=-(L.x*N.y-L.y*N.x)/U;if(z<0||z>1||D<0||D>1)return!1;let G=_.start.z+L.z*z,W=w.start.z+I.z*D;return Yn(G-W)?(A&&(A.start.copy(_.start).addScaledVector(L,z),A.end.copy(_.start).addScaledVector(L,z)),!0):!1}else return M.isDegenerateIntoPoint?g(T,M,A):S(M,T,A,E);else{if(T.isDegenerateIntoPoint)return M.isDegenerateIntoPoint?M.a.distanceToSquared(T.a)<dp?(A&&(A.start.copy(T.a),A.end.copy(T.a)),!0):!1:M.isDegenerateIntoSegment?g(M,T,A):p(M,T,A);if(M.isDegenerateIntoPoint)return p(T,M,A);if(M.isDegenerateIntoSegment)return S(T,M,A,E)}}return function(M,A=null,E=!1){this.needsUpdate&&this.update(),M.isExtendedTriangle?M.needsUpdate&&M.update():(i.copy(M),i.update(),M=i);let _=y(this,M,A,E);if(_!==void 0)return _;let w=this.plane,L=M.plane,I=L.distanceToPoint(this.a),N=L.distanceToPoint(this.b),U=L.distanceToPoint(this.c);Yn(I)&&(I=0),Yn(N)&&(N=0),Yn(U)&&(U=0);let z=I*N,D=I*U;if(z>0&&D>0)return!1;let G=w.distanceToPoint(M.a),W=w.distanceToPoint(M.b),Z=w.distanceToPoint(M.c);Yn(G)&&(G=0),Yn(W)&&(W=0),Yn(Z)&&(Z=0);let le=G*W,J=G*Z;if(le>0&&J>0)return!1;r.copy(w.normal),s.copy(L.normal);let se=r.cross(s),ae=0,ye=Math.abs(se.x),Le=Math.abs(se.y);Le>ye&&(ye=Le,ae=1),Math.abs(se.z)>ye&&(ae=2);let he=qy[ae],Ce=this.a[he],Oe=this.b[he],fe=this.c[he],ke=M.a[he],mt=M.b[he],Be=M.c[he];if(x(this,Ce,Oe,fe,z,D,I,N,U,f,a))return c(this,M,A,E);if(x(M,ke,mt,Be,le,J,G,W,Z,h,l))return c(this,M,A,E);if(f.y<f.x){let at=f.y;f.y=f.x,f.x=at,u.copy(a.start),a.start.copy(a.end),a.end.copy(u)}if(h.y<h.x){let at=h.y;h.y=h.x,h.x=at,u.copy(l.start),l.start.copy(l.end),l.end.copy(u)}return f.y<h.x||h.y<f.x?!1:(A&&(h.x>f.x?A.start.copy(l.start):A.start.copy(a.start),h.y<f.y?A.end.copy(l.end):A.end.copy(a.end)),!0)}})();hn.prototype.distanceToPoint=(function(){let i=new H;return function(t){return this.closestPointToPoint(t,i),t.distanceTo(i)}})();hn.prototype.distanceToTriangle=(function(){let i=new H,e=new H,t=["a","b","c"],n=new An,r=new An;return function(o,a=null,l=null){let u=a||l?n:null;if(this.intersectsTriangle(o,u,!0))return(a||l)&&(a&&u.getCenter(a),l&&u.getCenter(l)),0;let f=1/0;for(let h=0;h<3;h++){let c,d=t[h],x=o[d];this.closestPointToPoint(x,i),c=x.distanceToSquared(i),c<f&&(f=c,a&&a.copy(i),l&&l.copy(x));let S=this[d];o.closestPointToPoint(S,i),c=S.distanceToSquared(i),c<f&&(f=c,a&&a.copy(S),l&&l.copy(i))}for(let h=0;h<3;h++){let c=t[h],d=t[(h+1)%3];n.set(this[c],this[d]);for(let x=0;x<3;x++){let S=t[x],p=t[(x+1)%3];r.set(o[S],o[p]),Io(n,r,i,e);let g=i.distanceToSquared(e);g<f&&(f=g,a&&a.copy(i),l&&l.copy(e))}}return Math.sqrt(f)}})();var Gt=class{constructor(e,t,n){this.isOrientedBox=!0,this.min=new H,this.max=new H,this.matrix=new Ze,this.invMatrix=new Ze,this.points=new Array(8).fill().map(()=>new H),this.satAxes=new Array(3).fill().map(()=>new H),this.satBounds=new Array(3).fill().map(()=>new zn),this.alignedSatBounds=new Array(3).fill().map(()=>new zn),this.needsUpdate=!1,e&&this.min.copy(e),t&&this.max.copy(t),n&&this.matrix.copy(n)}set(e,t,n){this.min.copy(e),this.max.copy(t),this.matrix.copy(n),this.needsUpdate=!0}copy(e){this.min.copy(e.min),this.max.copy(e.max),this.matrix.copy(e.matrix),this.needsUpdate=!0}};Gt.prototype.update=(function(){return function(){let e=this.matrix,t=this.min,n=this.max,r=this.points;for(let u=0;u<=1;u++)for(let f=0;f<=1;f++)for(let h=0;h<=1;h++){let c=1*u|2*f|4*h,d=r[c];d.x=u?n.x:t.x,d.y=f?n.y:t.y,d.z=h?n.z:t.z,d.applyMatrix4(e)}let s=this.satBounds,o=this.satAxes,a=r[0];for(let u=0;u<3;u++){let f=o[u],h=s[u],c=1<<u,d=r[c];f.subVectors(a,d),h.setFromPoints(f,r)}let l=this.alignedSatBounds;l[0].setFromPointsField(r,"x"),l[1].setFromPointsField(r,"y"),l[2].setFromPointsField(r,"z"),this.invMatrix.copy(this.matrix).invert(),this.needsUpdate=!1}})();Gt.prototype.intersectsBox=(function(){let i=new zn;return function(t){this.needsUpdate&&this.update();let n=t.min,r=t.max,s=this.satBounds,o=this.satAxes,a=this.alignedSatBounds;if(i.min=n.x,i.max=r.x,a[0].isSeparated(i)||(i.min=n.y,i.max=r.y,a[1].isSeparated(i))||(i.min=n.z,i.max=r.z,a[2].isSeparated(i)))return!1;for(let l=0;l<3;l++){let u=o[l],f=s[l];if(i.setFromBox(u,t),f.isSeparated(i))return!1}return!0}})();Gt.prototype.intersectsTriangle=(function(){let i=new hn,e=new Array(3),t=new zn,n=new zn,r=new H;return function(o){this.needsUpdate&&this.update(),o.isExtendedTriangle?o.needsUpdate&&o.update():(i.copy(o),i.update(),o=i);let a=this.satBounds,l=this.satAxes;e[0]=o.a,e[1]=o.b,e[2]=o.c;for(let c=0;c<3;c++){let d=a[c],x=l[c];if(t.setFromPoints(x,e),d.isSeparated(t))return!1}let u=o.satBounds,f=o.satAxes,h=this.points;for(let c=0;c<3;c++){let d=u[c],x=f[c];if(t.setFromPoints(x,h),d.isSeparated(t))return!1}for(let c=0;c<3;c++){let d=l[c];for(let x=0;x<4;x++){let S=f[x];if(r.crossVectors(d,S),t.setFromPoints(r,e),n.setFromPoints(r,h),t.isSeparated(n))return!1}}return!0}})();Gt.prototype.closestPointToPoint=(function(){return function(e,t){return this.needsUpdate&&this.update(),t.copy(e).applyMatrix4(this.invMatrix).clamp(this.min,this.max).applyMatrix4(this.matrix),t}})();Gt.prototype.distanceToPoint=(function(){let i=new H;return function(t){return this.closestPointToPoint(t,i),t.distanceTo(i)}})();Gt.prototype.distanceToBox=(function(){let i=["x","y","z"],e=new Array(12).fill().map(()=>new An),t=new Array(12).fill().map(()=>new An),n=new H,r=new H;return function(o,a=0,l=null,u=null){if(this.needsUpdate&&this.update(),this.intersectsBox(o))return(l||u)&&(o.getCenter(r),this.closestPointToPoint(r,n),o.closestPointToPoint(n,r),l&&l.copy(n),u&&u.copy(r)),0;let f=a*a,h=o.min,c=o.max,d=this.points,x=1/0;for(let p=0;p<8;p++){let g=d[p];r.copy(g).clamp(h,c);let y=g.distanceToSquared(r);if(y<x&&(x=y,l&&l.copy(g),u&&u.copy(r),y<f))return Math.sqrt(y)}let S=0;for(let p=0;p<3;p++)for(let g=0;g<=1;g++)for(let y=0;y<=1;y++){let T=(p+1)%3,M=(p+2)%3,A=g<<T|y<<M,E=1<<p|g<<T|y<<M,_=d[A],w=d[E];e[S].set(_,w);let I=i[p],N=i[T],U=i[M],z=t[S],D=z.start,G=z.end;D[I]=h[I],D[N]=g?h[N]:c[N],D[U]=y?h[U]:c[N],G[I]=c[I],G[N]=g?h[N]:c[N],G[U]=y?h[U]:c[N],S++}for(let p=0;p<=1;p++)for(let g=0;g<=1;g++)for(let y=0;y<=1;y++){r.x=p?c.x:h.x,r.y=g?c.y:h.y,r.z=y?c.z:h.z,this.closestPointToPoint(r,n);let T=r.distanceToSquared(n);if(T<x&&(x=T,l&&l.copy(n),u&&u.copy(r),T<f))return Math.sqrt(T)}for(let p=0;p<12;p++){let g=e[p];for(let y=0;y<12;y++){let T=t[y];Io(g,T,n,r);let M=n.distanceToSquared(r);if(M<x&&(x=M,l&&l.copy(n),u&&u.copy(r),M<f))return Math.sqrt(M)}}return Math.sqrt(x)}})();var Th=class extends Ki{constructor(){super(()=>new hn)}},Cn=new Th;var Po=new H,wh=new H;function pp(i,e,t={},n=0,r=1/0){let s=n*n,o=r*r,a=1/0,l=null;if(i.shapecast({boundsTraverseOrder:f=>(Po.copy(e).clamp(f.min,f.max),Po.distanceToSquared(e)),intersectsBounds:(f,h,c)=>c<a&&c<o,intersectsTriangle:(f,h)=>{f.closestPointToPoint(e,Po);let c=e.distanceToSquared(Po);return c<a&&(wh.copy(Po),a=c,l=h),c<s}}),a===1/0)return null;let u=Math.sqrt(a);return t.point?t.point.copy(wh):t.point=wh.clone(),t.distance=u,t.faceIndex=l,t}var Jl=parseInt("187")>=169,Yy=parseInt("187")<=161,yr=new H,Sr=new H,br=new H,Kl=new Ue,Ql=new Ue,jl=new Ue,mp=new H,gp=new H,xp=new H,Do=new H;function Zy(i,e,t,n,r,s,o,a){let l;if(s===Kt?l=i.intersectTriangle(n,t,e,!0,r):l=i.intersectTriangle(e,t,n,s!==vn,r),l===null)return null;let u=i.origin.distanceTo(r);return u<o||u>a?null:{distance:u,point:r.clone()}}function vp(i,e,t,n,r,s,o,a,l,u,f){yr.fromBufferAttribute(e,s),Sr.fromBufferAttribute(e,o),br.fromBufferAttribute(e,a);let h=Zy(i,yr,Sr,br,Do,l,u,f);if(h){if(n){Kl.fromBufferAttribute(n,s),Ql.fromBufferAttribute(n,o),jl.fromBufferAttribute(n,a),h.uv=new Ue;let d=gn.getInterpolation(Do,yr,Sr,br,Kl,Ql,jl,h.uv);Jl||(h.uv=d)}if(r){Kl.fromBufferAttribute(r,s),Ql.fromBufferAttribute(r,o),jl.fromBufferAttribute(r,a),h.uv1=new Ue;let d=gn.getInterpolation(Do,yr,Sr,br,Kl,Ql,jl,h.uv1);Jl||(h.uv1=d),Yy&&(h.uv2=h.uv1)}if(t){mp.fromBufferAttribute(t,s),gp.fromBufferAttribute(t,o),xp.fromBufferAttribute(t,a),h.normal=new H;let d=gn.getInterpolation(Do,yr,Sr,br,mp,gp,xp,h.normal);h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1),Jl||(h.normal=d)}let c={a:s,b:o,c:a,normal:new H,materialIndex:0};if(gn.getNormal(yr,Sr,br,c.normal),h.face=c,h.faceIndex=s,Jl){let d=new H;gn.getBarycoord(Do,yr,Sr,br,d),h.barycoord=d}}return h}function _p(i){return i&&i.isMaterial?i.side:i}function vs(i,e,t,n,r,s,o){let a=n*3,l=a+0,u=a+1,f=a+2,{index:h,groups:c}=i;i.index&&(l=h.getX(l),u=h.getX(u),f=h.getX(f));let{position:d,normal:x,uv:S,uv1:p}=i.attributes;if(Array.isArray(e)){let g=n*3;for(let y=0,T=c.length;y<T;y++){let{start:M,count:A,materialIndex:E}=c[y];if(g>=M&&g<M+A){let _=_p(e[E]),w=vp(t,d,x,S,p,l,u,f,_,s,o);if(w)if(w.faceIndex=n,w.face.materialIndex=E,r)r.push(w);else return w}}}else{let g=_p(e),y=vp(t,d,x,S,p,l,u,f,g,s,o);if(y)if(y.faceIndex=n,y.face.materialIndex=0,r)r.push(y);else return y}return null}function Lt(i,e,t,n){let r=i.a,s=i.b,o=i.c,a=e,l=e+1,u=e+2;t&&(a=t.getX(a),l=t.getX(l),u=t.getX(u)),r.x=n.getX(a),r.y=n.getY(a),r.z=n.getZ(a),s.x=n.getX(l),s.y=n.getY(l),s.z=n.getZ(l),o.x=n.getX(u),o.y=n.getY(u),o.z=n.getZ(u)}function yp(i,e,t,n,r,s,o,a){let{geometry:l,_indirectBuffer:u}=i;for(let f=n,h=n+r;f<h;f++)vs(l,e,t,f,s,o,a)}function Sp(i,e,t,n,r,s,o){let{geometry:a,_indirectBuffer:l}=i,u=1/0,f=null;for(let h=n,c=n+r;h<c;h++){let d;d=vs(a,e,t,h,null,s,o),d&&d.distance<u&&(f=d,u=d.distance)}return f}function bp(i,e,t,n,r,s,o){let{geometry:a}=t,{index:l}=a,u=a.attributes.position;for(let f=i,h=e+i;f<h;f++){let c;if(c=f,Lt(o,c*3,l,u),o.needsUpdate=!0,n(o,c,r,s))return!0}return!1}function Mp(i,e=null){e&&Array.isArray(e)&&(e=new Set(e));let t=i.geometry,n=t.index?t.index.array:null,r=t.attributes.position,s,o,a,l,u=0,f=i._roots;for(let c=0,d=f.length;c<d;c++)s=f[c],o=new Uint32Array(s),a=new Uint16Array(s),l=new Float32Array(s),h(0,u),u+=s.byteLength;function h(c,d,x=!1){let S=c*2;if(pt(S,a)){let p=vt(c,o),g=At(S,a),y=1/0,T=1/0,M=1/0,A=-1/0,E=-1/0,_=-1/0;for(let w=3*p,L=3*(p+g);w<L;w++){let I=n[w],N=r.getX(I),U=r.getY(I),z=r.getZ(I);N<y&&(y=N),N>A&&(A=N),U<T&&(T=U),U>E&&(E=U),z<M&&(M=z),z>_&&(_=z)}return l[c+0]!==y||l[c+1]!==T||l[c+2]!==M||l[c+3]!==A||l[c+4]!==E||l[c+5]!==_?(l[c+0]=y,l[c+1]=T,l[c+2]=M,l[c+3]=A,l[c+4]=E,l[c+5]=_,!0):!1}else{let p=bt(c),g=Mt(c,o),y=x,T=!1,M=!1;if(e){if(!y){let I=p/8+d/32,N=g/8+d/32;T=e.has(I),M=e.has(N),y=!T&&!M}}else T=!0,M=!0;let A=y||T,E=y||M,_=!1;A&&(_=h(p,d,y));let w=!1;E&&(w=h(g,d,y));let L=_||w;if(L)for(let I=0;I<3;I++){let N=p+I,U=g+I,z=l[N],D=l[N+3],G=l[U],W=l[U+3];l[c+I]=z<G?z:G,l[c+I+3]=D>W?D:W}return L}}}function Zn(i,e,t,n,r){let s,o,a,l,u,f,h=1/t.direction.x,c=1/t.direction.y,d=1/t.direction.z,x=t.origin.x,S=t.origin.y,p=t.origin.z,g=e[i],y=e[i+3],T=e[i+1],M=e[i+3+1],A=e[i+2],E=e[i+3+2];return h>=0?(s=(g-x)*h,o=(y-x)*h):(s=(y-x)*h,o=(g-x)*h),c>=0?(a=(T-S)*c,l=(M-S)*c):(a=(M-S)*c,l=(T-S)*c),s>l||a>o||((a>s||isNaN(s))&&(s=a),(l<o||isNaN(o))&&(o=l),d>=0?(u=(A-p)*d,f=(E-p)*d):(u=(E-p)*d,f=(A-p)*d),s>f||u>o)?!1:((u>s||s!==s)&&(s=u),(f<o||o!==o)&&(o=f),s<=r&&o>=n)}function Tp(i,e,t,n,r,s,o,a){let{geometry:l,_indirectBuffer:u}=i;for(let f=n,h=n+r;f<h;f++){let c=u?u[f]:f;vs(l,e,t,c,s,o,a)}}function wp(i,e,t,n,r,s,o){let{geometry:a,_indirectBuffer:l}=i,u=1/0,f=null;for(let h=n,c=n+r;h<c;h++){let d;d=vs(a,e,t,l?l[h]:h,null,s,o),d&&d.distance<u&&(f=d,u=d.distance)}return f}function Ap(i,e,t,n,r,s,o){let{geometry:a}=t,{index:l}=a,u=a.attributes.position;for(let f=i,h=e+i;f<h;f++){let c;if(c=t.resolveTriangleIndex(f),Lt(o,c*3,l,u),o.needsUpdate=!0,n(o,c,r,s))return!0}return!1}function Ep(i,e,t,n,r,s,o){xt.setBuffer(i._roots[e]),Ah(0,i,t,n,r,s,o),xt.clearBuffer()}function Ah(i,e,t,n,r,s,o){let{float32Array:a,uint16Array:l,uint32Array:u}=xt,f=i*2;if(pt(f,l)){let c=vt(i,u),d=At(f,l);yp(e,t,n,c,d,r,s,o)}else{let c=bt(i);Zn(c,a,n,s,o)&&Ah(c,e,t,n,r,s,o);let d=Mt(i,u);Zn(d,a,n,s,o)&&Ah(d,e,t,n,r,s,o)}}var $y=["x","y","z"];function Rp(i,e,t,n,r,s){xt.setBuffer(i._roots[e]);let o=Eh(0,i,t,n,r,s);return xt.clearBuffer(),o}function Eh(i,e,t,n,r,s){let{float32Array:o,uint16Array:a,uint32Array:l}=xt,u=i*2;if(pt(u,a)){let h=vt(i,l),c=At(u,a);return Sp(e,t,n,h,c,r,s)}else{let h=$i(i,l),c=$y[h],x=n.direction[c]>=0,S,p;x?(S=bt(i),p=Mt(i,l)):(S=Mt(i,l),p=bt(i));let y=Zn(S,o,n,r,s)?Eh(S,e,t,n,r,s):null;if(y){let A=y.point[c];if(x?A<=o[p+h]:A>=o[p+h+3])return y}let M=Zn(p,o,n,r,s)?Eh(p,e,t,n,r,s):null;return y&&M?y.distance<=M.distance?y:M:y||M||null}}var ec=new kt,_s=new hn,ys=new hn,Lo=new Ze,Cp=new Gt,tc=new Gt;function Ip(i,e,t,n){xt.setBuffer(i._roots[e]);let r=Rh(0,i,t,n);return xt.clearBuffer(),r}function Rh(i,e,t,n,r=null){let{float32Array:s,uint16Array:o,uint32Array:a}=xt,l=i*2;if(r===null&&(t.boundingBox||t.computeBoundingBox(),Cp.set(t.boundingBox.min,t.boundingBox.max,n),r=Cp),pt(l,o)){let f=e.geometry,h=f.index,c=f.attributes.position,d=t.index,x=t.attributes.position,S=vt(i,a),p=At(l,o);if(Lo.copy(n).invert(),t.boundsTree)return Dt(i,s,tc),tc.matrix.copy(Lo),tc.needsUpdate=!0,t.boundsTree.shapecast({intersectsBounds:y=>tc.intersectsBox(y),intersectsTriangle:y=>{y.a.applyMatrix4(n),y.b.applyMatrix4(n),y.c.applyMatrix4(n),y.needsUpdate=!0;for(let T=S*3,M=(p+S)*3;T<M;T+=3)if(Lt(ys,T,h,c),ys.needsUpdate=!0,y.intersectsTriangle(ys))return!0;return!1}});{let g=er(t);for(let y=S*3,T=(p+S)*3;y<T;y+=3){Lt(_s,y,h,c),_s.a.applyMatrix4(Lo),_s.b.applyMatrix4(Lo),_s.c.applyMatrix4(Lo),_s.needsUpdate=!0;for(let M=0,A=g*3;M<A;M+=3)if(Lt(ys,M,d,x),ys.needsUpdate=!0,_s.intersectsTriangle(ys))return!0}}}else{let f=bt(i),h=Mt(i,a);return Dt(f,s,ec),!!(r.intersectsBox(ec)&&Rh(f,e,t,n,r)||(Dt(h,s,ec),r.intersectsBox(ec)&&Rh(h,e,t,n,r)))}}var nc=new Ze,Ch=new Gt,Fo=new Gt,Jy=new H,Ky=new H,Qy=new H,jy=new H;function Pp(i,e,t,n={},r={},s=0,o=1/0){e.boundingBox||e.computeBoundingBox(),Ch.set(e.boundingBox.min,e.boundingBox.max,t),Ch.needsUpdate=!0;let a=i.geometry,l=a.attributes.position,u=a.index,f=e.attributes.position,h=e.index,c=Cn.getPrimitive(),d=Cn.getPrimitive(),x=Jy,S=Ky,p=null,g=null;r&&(p=Qy,g=jy);let y=1/0,T=null,M=null;return nc.copy(t).invert(),Fo.matrix.copy(nc),i.shapecast({boundsTraverseOrder:A=>Ch.distanceToBox(A),intersectsBounds:(A,E,_)=>_<y&&_<o?(E&&(Fo.min.copy(A.min),Fo.max.copy(A.max),Fo.needsUpdate=!0),!0):!1,intersectsRange:(A,E)=>{if(e.boundsTree)return e.boundsTree.shapecast({boundsTraverseOrder:w=>Fo.distanceToBox(w),intersectsBounds:(w,L,I)=>I<y&&I<o,intersectsRange:(w,L)=>{for(let I=w,N=w+L;I<N;I++){Lt(d,3*I,h,f),d.a.applyMatrix4(t),d.b.applyMatrix4(t),d.c.applyMatrix4(t),d.needsUpdate=!0;for(let U=A,z=A+E;U<z;U++){Lt(c,3*U,u,l),c.needsUpdate=!0;let D=c.distanceToTriangle(d,x,p);if(D<y&&(S.copy(x),g&&g.copy(p),y=D,T=U,M=I),D<s)return!0}}}});{let _=er(e);for(let w=0,L=_;w<L;w++){Lt(d,3*w,h,f),d.a.applyMatrix4(t),d.b.applyMatrix4(t),d.c.applyMatrix4(t),d.needsUpdate=!0;for(let I=A,N=A+E;I<N;I++){Lt(c,3*I,u,l),c.needsUpdate=!0;let U=c.distanceToTriangle(d,x,p);if(U<y&&(S.copy(x),g&&g.copy(p),y=U,T=I,M=w),U<s)return!0}}}}}),Cn.releasePrimitive(c),Cn.releasePrimitive(d),y===1/0?null:(n.point?n.point.copy(S):n.point=S.clone(),n.distance=y,n.faceIndex=T,r&&(r.point?r.point.copy(g):r.point=g.clone(),r.point.applyMatrix4(nc),S.applyMatrix4(nc),r.distance=S.sub(r.point).length(),r.faceIndex=M),n)}function Dp(i,e=null){e&&Array.isArray(e)&&(e=new Set(e));let t=i.geometry,n=t.index?t.index.array:null,r=t.attributes.position,s,o,a,l,u=0,f=i._roots;for(let c=0,d=f.length;c<d;c++)s=f[c],o=new Uint32Array(s),a=new Uint16Array(s),l=new Float32Array(s),h(0,u),u+=s.byteLength;function h(c,d,x=!1){let S=c*2;if(pt(S,a)){let p=vt(c,o),g=At(S,a),y=1/0,T=1/0,M=1/0,A=-1/0,E=-1/0,_=-1/0;for(let w=p,L=p+g;w<L;w++){let I=3*i.resolveTriangleIndex(w);for(let N=0;N<3;N++){let U=I+N;U=n?n[U]:U;let z=r.getX(U),D=r.getY(U),G=r.getZ(U);z<y&&(y=z),z>A&&(A=z),D<T&&(T=D),D>E&&(E=D),G<M&&(M=G),G>_&&(_=G)}}return l[c+0]!==y||l[c+1]!==T||l[c+2]!==M||l[c+3]!==A||l[c+4]!==E||l[c+5]!==_?(l[c+0]=y,l[c+1]=T,l[c+2]=M,l[c+3]=A,l[c+4]=E,l[c+5]=_,!0):!1}else{let p=bt(c),g=Mt(c,o),y=x,T=!1,M=!1;if(e){if(!y){let I=p/8+d/32,N=g/8+d/32;T=e.has(I),M=e.has(N),y=!T&&!M}}else T=!0,M=!0;let A=y||T,E=y||M,_=!1;A&&(_=h(p,d,y));let w=!1;E&&(w=h(g,d,y));let L=_||w;if(L)for(let I=0;I<3;I++){let N=p+I,U=g+I,z=l[N],D=l[N+3],G=l[U],W=l[U+3];l[c+I]=z<G?z:G,l[c+I+3]=D>W?D:W}return L}}}function Lp(i,e,t,n,r,s,o){xt.setBuffer(i._roots[e]),Ih(0,i,t,n,r,s,o),xt.clearBuffer()}function Ih(i,e,t,n,r,s,o){let{float32Array:a,uint16Array:l,uint32Array:u}=xt,f=i*2;if(pt(f,l)){let c=vt(i,u),d=At(f,l);Tp(e,t,n,c,d,r,s,o)}else{let c=bt(i);Zn(c,a,n,s,o)&&Ih(c,e,t,n,r,s,o);let d=Mt(i,u);Zn(d,a,n,s,o)&&Ih(d,e,t,n,r,s,o)}}var eS=["x","y","z"];function Fp(i,e,t,n,r,s){xt.setBuffer(i._roots[e]);let o=Ph(0,i,t,n,r,s);return xt.clearBuffer(),o}function Ph(i,e,t,n,r,s){let{float32Array:o,uint16Array:a,uint32Array:l}=xt,u=i*2;if(pt(u,a)){let h=vt(i,l),c=At(u,a);return wp(e,t,n,h,c,r,s)}else{let h=$i(i,l),c=eS[h],x=n.direction[c]>=0,S,p;x?(S=bt(i),p=Mt(i,l)):(S=Mt(i,l),p=bt(i));let y=Zn(S,o,n,r,s)?Ph(S,e,t,n,r,s):null;if(y){let A=y.point[c];if(x?A<=o[p+h]:A>=o[p+h+3])return y}let M=Zn(p,o,n,r,s)?Ph(p,e,t,n,r,s):null;return y&&M?y.distance<=M.distance?y:M:y||M||null}}var ic=new kt,Ss=new hn,bs=new hn,No=new Ze,Np=new Gt,rc=new Gt;function Up(i,e,t,n){xt.setBuffer(i._roots[e]);let r=Dh(0,i,t,n);return xt.clearBuffer(),r}function Dh(i,e,t,n,r=null){let{float32Array:s,uint16Array:o,uint32Array:a}=xt,l=i*2;if(r===null&&(t.boundingBox||t.computeBoundingBox(),Np.set(t.boundingBox.min,t.boundingBox.max,n),r=Np),pt(l,o)){let f=e.geometry,h=f.index,c=f.attributes.position,d=t.index,x=t.attributes.position,S=vt(i,a),p=At(l,o);if(No.copy(n).invert(),t.boundsTree)return Dt(i,s,rc),rc.matrix.copy(No),rc.needsUpdate=!0,t.boundsTree.shapecast({intersectsBounds:y=>rc.intersectsBox(y),intersectsTriangle:y=>{y.a.applyMatrix4(n),y.b.applyMatrix4(n),y.c.applyMatrix4(n),y.needsUpdate=!0;for(let T=S,M=p+S;T<M;T++)if(Lt(bs,3*e.resolveTriangleIndex(T),h,c),bs.needsUpdate=!0,y.intersectsTriangle(bs))return!0;return!1}});{let g=er(t);for(let y=S,T=p+S;y<T;y++){let M=e.resolveTriangleIndex(y);Lt(Ss,3*M,h,c),Ss.a.applyMatrix4(No),Ss.b.applyMatrix4(No),Ss.c.applyMatrix4(No),Ss.needsUpdate=!0;for(let A=0,E=g*3;A<E;A+=3)if(Lt(bs,A,d,x),bs.needsUpdate=!0,Ss.intersectsTriangle(bs))return!0}}}else{let f=bt(i),h=Mt(i,a);return Dt(f,s,ic),!!(r.intersectsBox(ic)&&Dh(f,e,t,n,r)||(Dt(h,s,ic),r.intersectsBox(ic)&&Dh(h,e,t,n,r)))}}var sc=new Ze,Lh=new Gt,Uo=new Gt,tS=new H,nS=new H,iS=new H,rS=new H;function Op(i,e,t,n={},r={},s=0,o=1/0){e.boundingBox||e.computeBoundingBox(),Lh.set(e.boundingBox.min,e.boundingBox.max,t),Lh.needsUpdate=!0;let a=i.geometry,l=a.attributes.position,u=a.index,f=e.attributes.position,h=e.index,c=Cn.getPrimitive(),d=Cn.getPrimitive(),x=tS,S=nS,p=null,g=null;r&&(p=iS,g=rS);let y=1/0,T=null,M=null;return sc.copy(t).invert(),Uo.matrix.copy(sc),i.shapecast({boundsTraverseOrder:A=>Lh.distanceToBox(A),intersectsBounds:(A,E,_)=>_<y&&_<o?(E&&(Uo.min.copy(A.min),Uo.max.copy(A.max),Uo.needsUpdate=!0),!0):!1,intersectsRange:(A,E)=>{if(e.boundsTree){let _=e.boundsTree;return _.shapecast({boundsTraverseOrder:w=>Uo.distanceToBox(w),intersectsBounds:(w,L,I)=>I<y&&I<o,intersectsRange:(w,L)=>{for(let I=w,N=w+L;I<N;I++){let U=_.resolveTriangleIndex(I);Lt(d,3*U,h,f),d.a.applyMatrix4(t),d.b.applyMatrix4(t),d.c.applyMatrix4(t),d.needsUpdate=!0;for(let z=A,D=A+E;z<D;z++){let G=i.resolveTriangleIndex(z);Lt(c,3*G,u,l),c.needsUpdate=!0;let W=c.distanceToTriangle(d,x,p);if(W<y&&(S.copy(x),g&&g.copy(p),y=W,T=z,M=I),W<s)return!0}}}})}else{let _=er(e);for(let w=0,L=_;w<L;w++){Lt(d,3*w,h,f),d.a.applyMatrix4(t),d.b.applyMatrix4(t),d.c.applyMatrix4(t),d.needsUpdate=!0;for(let I=A,N=A+E;I<N;I++){let U=i.resolveTriangleIndex(I);Lt(c,3*U,u,l),c.needsUpdate=!0;let z=c.distanceToTriangle(d,x,p);if(z<y&&(S.copy(x),g&&g.copy(p),y=z,T=I,M=w),z<s)return!0}}}}}),Cn.releasePrimitive(c),Cn.releasePrimitive(d),y===1/0?null:(n.point?n.point.copy(S):n.point=S.clone(),n.distance=y,n.faceIndex=T,r&&(r.point?r.point.copy(g):r.point=g.clone(),r.point.applyMatrix4(sc),S.applyMatrix4(sc),r.distance=S.sub(r.point).length(),r.faceIndex=M),n)}function Fh(i,e,t){return i===null?null:(i.point.applyMatrix4(e.matrixWorld),i.distance=i.point.distanceTo(t.ray.origin),i.object=e,i)}var oc=new Gt,ac=new Kr,Bp=new H,zp=new Ze,kp=new H,Nh=["getX","getY","getZ"],lc=class i extends $l{static serialize(e,t={}){t={cloneBuffers:!0,...t};let n=e.geometry,r=e._roots,s=e._indirectBuffer,o=n.getIndex(),a={version:1,roots:null,index:null,indirectBuffer:null};return t.cloneBuffers?(a.roots=r.map(l=>l.slice()),a.index=o?o.array.slice():null,a.indirectBuffer=s?s.slice():null):(a.roots=r,a.index=o?o.array:null,a.indirectBuffer=s),a}static deserialize(e,t,n={}){n={setIndex:!0,indirect:!!e.indirectBuffer,...n};let{index:r,roots:s,indirectBuffer:o}=e;e.version||(console.warn("MeshBVH.deserialize: Serialization format has been changed and will be fixed up. It is recommended to regenerate any stored serialized data."),l(s));let a=new i(t,{...n,[wo]:!0});if(a._roots=s,a._indirectBuffer=o||null,n.setIndex){let u=t.getIndex();if(u===null){let f=new yt(e.index,1,!1);t.setIndex(f)}else u.array!==r&&(u.array.set(r),u.needsUpdate=!0)}return a;function l(u){for(let f=0;f<u.length;f++){let h=u[f],c=new Uint32Array(h),d=new Uint16Array(h);for(let x=0,S=h.byteLength/32;x<S;x++){let p=8*x,g=2*p;pt(g,d)||(c[p+6]=c[p+6]/8-x)}}}}get primitiveStride(){return 3}get resolveTriangleIndex(){return this.resolvePrimitiveIndex}constructor(e,t={}){t.maxLeafTris&&(console.warn('MeshBVH: "maxLeafTris" option has been deprecated. Use "targetLeafSize", instead.'),t={...t,targetLeafSize:t.maxLeafTris}),super(e,t)}shiftTriangleOffsets(e){return super.shiftPrimitiveOffsets(e)}writePrimitiveBounds(e,t,n){let r=this.geometry,s=this._indirectBuffer,o=r.attributes.position,a=r.index?r.index.array:null,u=(s?s[e]:e)*3,f=u+0,h=u+1,c=u+2;a&&(f=a[f],h=a[h],c=a[c]);for(let d=0;d<3;d++){let x=o[Nh[d]](f),S=o[Nh[d]](h),p=o[Nh[d]](c),g=x;S<g&&(g=S),p<g&&(g=p);let y=x;S>y&&(y=S),p>y&&(y=p),t[n+d]=g,t[n+d+3]=y}return t}computePrimitiveBounds(e,t,n){let r=this.geometry,s=this._indirectBuffer,o=r.attributes.position,a=r.index?r.index.array:null,l=o.normalized;if(e<0||t+e-n.offset>n.length/6)throw new Error("MeshBVH: compute triangle bounds range is invalid.");let u=o.array,f=o.offset||0,h=3;o.isInterleavedBufferAttribute&&(h=o.data.stride);let c=["getX","getY","getZ"],d=n.offset;for(let x=e,S=e+t;x<S;x++){let g=(s?s[x]:x)*3,y=(x-d)*6,T=g+0,M=g+1,A=g+2;a&&(T=a[T],M=a[M],A=a[A]),l||(T=T*h+f,M=M*h+f,A=A*h+f);for(let E=0;E<3;E++){let _,w,L;l?(_=o[c[E]](T),w=o[c[E]](M),L=o[c[E]](A)):(_=u[T+E],w=u[M+E],L=u[A+E]);let I=_;w<I&&(I=w),L<I&&(I=L);let N=_;w>N&&(N=w),L>N&&(N=L);let U=(N-I)/2,z=E*2;n[y+z+0]=I+U,n[y+z+1]=U+(Math.abs(I)+U)*us}}return n}raycastObject3D(e,t,n=[]){let{material:r}=e;if(r===void 0)return;zp.copy(e.matrixWorld).invert(),ac.copy(t.ray).applyMatrix4(zp),kp.setFromMatrixScale(e.matrixWorld),Bp.copy(ac.direction).multiply(kp);let s=Bp.length(),o=t.near/s,a=t.far/s;if(t.firstHitOnly===!0){let l=this.raycastFirst(ac,r,o,a);l=Fh(l,e,t),l&&n.push(l)}else{let l=this.raycast(ac,r,o,a);for(let u=0,f=l.length;u<f;u++){let h=Fh(l[u],e,t);h&&n.push(h)}}return n}refit(e=null){return(this.indirect?Dp:Mp)(this,e)}raycast(e,t=En,n=0,r=1/0){let s=this._roots,o=[],a=this.indirect?Lp:Ep;for(let l=0,u=s.length;l<u;l++)a(this,l,t,e,o,n,r);return o}raycastFirst(e,t=En,n=0,r=1/0){let s=this._roots,o=null,a=this.indirect?Fp:Rp;for(let l=0,u=s.length;l<u;l++){let f=a(this,l,t,e,n,r);f!=null&&(o==null||f.distance<o.distance)&&(o=f)}return o}intersectsGeometry(e,t){let n=!1,r=this._roots,s=this.indirect?Up:Ip;for(let o=0,a=r.length;o<a&&(n=s(this,o,e,t),!n);o++);return n}shapecast(e){let t=Cn.getPrimitive(),n=super.shapecast({...e,intersectsPrimitive:e.intersectsTriangle,scratchPrimitive:t,iterate:this.indirect?Ap:bp});return Cn.releasePrimitive(t),n}bvhcast(e,t,n){let{intersectsRanges:r,intersectsTriangles:s}=n,o=Cn.getPrimitive(),a=this.geometry.index,l=this.geometry.attributes.position,u=this.indirect?x=>{let S=this.resolveTriangleIndex(x);Lt(o,S*3,a,l)}:x=>{Lt(o,x*3,a,l)},f=Cn.getPrimitive(),h=e.geometry.index,c=e.geometry.attributes.position,d=e.indirect?x=>{let S=e.resolveTriangleIndex(x);Lt(f,S*3,h,c)}:x=>{Lt(f,x*3,h,c)};if(s){if(!(e instanceof i))throw new Error('MeshBVH: "intersectsTriangles" callback can only be used with another MeshBVH.');let x=(S,p,g,y,T,M,A,E)=>{for(let _=g,w=g+y;_<w;_++){d(_),f.a.applyMatrix4(t),f.b.applyMatrix4(t),f.c.applyMatrix4(t),f.needsUpdate=!0;for(let L=S,I=S+p;L<I;L++)if(u(L),o.needsUpdate=!0,s(o,f,L,_,T,M,A,E))return!0}return!1};if(r){let S=r;r=function(p,g,y,T,M,A,E,_){return S(p,g,y,T,M,A,E,_)?!0:x(p,g,y,T,M,A,E,_)}}else r=x}return super.bvhcast(e,t,{intersectsRanges:r})}intersectsBox(e,t){return oc.set(e.min,e.max,t),oc.needsUpdate=!0,this.shapecast({intersectsBounds:n=>oc.intersectsBox(n),intersectsTriangle:n=>oc.intersectsTriangle(n)})}intersectsSphere(e){return this.shapecast({intersectsBounds:t=>e.intersectsBox(t),intersectsTriangle:t=>t.intersectsSphere(e)})}closestPointToGeometry(e,t,n={},r={},s=0,o=1/0){return(this.indirect?Op:Pp)(this,e,t,n,r,s,o)}closestPointToPoint(e,t={},n=0,r=1/0){return pp(this,e,t,n,r)}};function sS(i){switch(i){case 1:return"R";case 2:return"RG";case 3:return"RGBA";case 4:return"RGBA"}throw new Error}function oS(i){switch(i){case 1:return Rn;case 2:return an;case 3:return qe;case 4:return qe}}function Hp(i){switch(i){case 1:return os;case 2:return Yi;case 3:return Zi;case 4:return Zi}}var cc=class extends Rt{constructor(){super(),this.minFilter=Qe,this.magFilter=Qe,this.generateMipmaps=!1,this.overrideItemSize=null,this._forcedType=null}updateFrom(e){let t=this.overrideItemSize,n=e.itemSize,r=e.count;if(t!==null){if(n*r%t!==0)throw new Error("VertexAttributeTexture: overrideItemSize must divide evenly into buffer length.");e.itemSize=t,e.count=r*n/t}let s=e.itemSize,o=e.count,a=e.normalized,l=e.array.constructor,u=l.BYTES_PER_ELEMENT,f=this._forcedType,h=s;if(f===null)switch(l){case Float32Array:f=tt;break;case Uint8Array:case Uint16Array:case Uint32Array:f=on;break;case Int8Array:case Int16Array:case Int32Array:f=qi;break}let c,d,x,S,p=sS(s);switch(f){case tt:x=1,d=oS(s),a&&u===1?(S=l,p+="8",l===Uint8Array?c=sn:(c=ss,p+="_SNORM")):(S=Float32Array,p+="32F",c=tt);break;case qi:p+=u*8+"I",x=a?Math.pow(2,l.BYTES_PER_ELEMENT*8-1):1,d=Hp(s),u===1?(S=Int8Array,c=ss):u===2?(S=Int16Array,c=fo):(S=Int32Array,c=qi);break;case on:p+=u*8+"UI",x=a?Math.pow(2,l.BYTES_PER_ELEMENT*8-1):1,d=Hp(s),u===1?(S=Uint8Array,c=sn):u===2?(S=Uint16Array,c=Xi):(S=Uint32Array,c=on);break}h===3&&(d===qe||d===Zi)&&(h=4);let g=Math.ceil(Math.sqrt(o))||1,y=h*g*g,T=new S(y),M=e.normalized;e.normalized=!1;for(let A=0;A<o;A++){let E=h*A;T[E]=e.getX(A)/x,s>=2&&(T[E+1]=e.getY(A)/x),s>=3&&(T[E+2]=e.getZ(A)/x,h===4&&(T[E+3]=1)),s>=4&&(T[E+3]=e.getW(A)/x)}e.normalized=M,this.internalFormat=p,this.format=d,this.type=c,this.image.width=g,this.image.height=g,this.image.data=T,this.needsUpdate=!0,this.dispose(),e.itemSize=n,e.count=r}},Ms=class extends cc{constructor(){super(),this._forcedType=on}};var Ts=class extends cc{constructor(){super(),this._forcedType=tt}};var uc=class{constructor(){this.index=new Ms,this.position=new Ts,this.bvhBounds=new Rt,this.bvhContents=new Rt,this._cachedIndexAttr=null,this.index.overrideItemSize=3}updateFrom(e){let{geometry:t}=e;if(lS(e,this.bvhBounds,this.bvhContents),this.position.updateFrom(t.attributes.position),e.indirect){let n=e._indirectBuffer;if(this._cachedIndexAttr===null||this._cachedIndexAttr.count!==n.length)if(t.index)this._cachedIndexAttr=t.index.clone();else{let r=bh(Co(t));this._cachedIndexAttr=new yt(r,1,!1)}aS(t,n,this._cachedIndexAttr),this.index.updateFrom(this._cachedIndexAttr)}else this.index.updateFrom(t.index)}dispose(){let{index:e,position:t,bvhBounds:n,bvhContents:r}=this;e&&e.dispose(),t&&t.dispose(),n&&n.dispose(),r&&r.dispose()}};function aS(i,e,t){let n=t.array,r=i.index?i.index.array:null;for(let s=0,o=e.length;s<o;s++){let a=3*s,l=3*e[s];for(let u=0;u<3;u++)n[a+u]=r?r[l+u]:l+u}}function lS(i,e,t){let n=i._roots;if(n.length!==1)throw new Error("MeshBVHUniformStruct: Multi-root BVHs not supported.");let r=n[0],s=new Uint16Array(r),o=new Uint32Array(r),a=new Float32Array(r),l=r.byteLength/32,u=2*Math.ceil(Math.sqrt(l/2)),f=new Float32Array(4*u*u),h=Math.ceil(Math.sqrt(l)),c=new Uint32Array(2*h*h);for(let d=0;d<l;d++){let x=d*32/4,S=x*2,p=x;for(let g=0;g<3;g++)f[8*d+0+g]=a[p+0+g],f[8*d+4+g]=a[p+3+g];if(pt(S,s)){let g=At(S,s),y=vt(x,o),T=-65536|g;c[d*2+0]=T,c[d*2+1]=y}else{let g=o[x+6],y=$i(x,o);c[d*2+0]=y,c[d*2+1]=g}}e.image.data=f,e.image.width=u,e.image.height=u,e.format=qe,e.type=tt,e.internalFormat="RGBA32F",e.minFilter=Qe,e.magFilter=Qe,e.generateMipmaps=!1,e.needsUpdate=!0,e.dispose(),t.image.data=c,t.image.width=h,t.image.height=h,t.format=Yi,t.type=on,t.internalFormat="RG32UI",t.minFilter=Qe,t.magFilter=Qe,t.generateMipmaps=!1,t.needsUpdate=!0,t.dispose()}var Mr={};cf(Mr,{bvh_distance_functions:()=>Gp,bvh_ray_functions:()=>Oh,bvh_struct_definitions:()=>Vp,common_functions:()=>Uh});var Uh=`

// A stack of uint32 indices can can store the indices for
// a perfectly balanced tree with a depth up to 31. Lower stack
// depth gets higher performance.
//
// However not all trees are balanced. Best value to set this to
// is the trees max depth.
#ifndef BVH_STACK_DEPTH
#define BVH_STACK_DEPTH 60
#endif

#ifndef INFINITY
#define INFINITY 1e20
#endif

// Utilities
uvec4 uTexelFetch1D( usampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

ivec4 iTexelFetch1D( isampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 texelFetch1D( sampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 textureSampleBarycoord( sampler2D tex, vec3 barycoord, uvec3 faceIndices ) {

	return
		barycoord.x * texelFetch1D( tex, faceIndices.x ) +
		barycoord.y * texelFetch1D( tex, faceIndices.y ) +
		barycoord.z * texelFetch1D( tex, faceIndices.z );

}

void ndcToCameraRay(
	vec2 coord, mat4 cameraWorld, mat4 invProjectionMatrix,
	out vec3 rayOrigin, out vec3 rayDirection
) {

	// get camera look direction and near plane for camera clipping
	vec4 lookDirection = cameraWorld * vec4( 0.0, 0.0, - 1.0, 0.0 );
	vec4 nearVector = invProjectionMatrix * vec4( 0.0, 0.0, - 1.0, 1.0 );
	float near = abs( nearVector.z / nearVector.w );

	// get the camera direction and position from camera matrices
	vec4 origin = cameraWorld * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec4 direction = invProjectionMatrix * vec4( coord, 0.5, 1.0 );
	direction /= direction.w;
	direction = cameraWorld * direction - origin;

	// slide the origin along the ray until it sits at the near clip plane position
	origin.xyz += direction.xyz * near / dot( direction, lookDirection );

	rayOrigin = origin.xyz;
	rayDirection = direction.xyz;

}
`;var Gp=`

float dot2( vec3 v ) {

	return dot( v, v );

}

// implementation from https://www.shadertoy.com/view/ttfGWl, though method 2 has been removed
// and is now available at this fork: https://www.shadertoy.com/view/WlB3zW
vec3 closestPointToTriangle( vec3 p, vec3 v0, vec3 v1, vec3 v2, out vec3 barycoord ) {

    vec3 v10 = v1 - v0;
    vec3 v21 = v2 - v1;
    vec3 v02 = v0 - v2;

	vec3 p0 = p - v0;
	vec3 p1 = p - v1;
	vec3 p2 = p - v2;

    vec3 nor = cross( v10, v02 );

    // method 2, in barycentric space
    vec3  q = cross( nor, p0 );
    float d = 1.0 / dot2( nor );
    float u = d * dot( q, v02 );
    float v = d * dot( q, v10 );
    float w = 1.0 - u - v;

	if( u < 0.0 ) {

		w = clamp( dot( p2, v02 ) / dot2( v02 ), 0.0, 1.0 );
		u = 0.0;
		v = 1.0 - w;

	} else if( v < 0.0 ) {

		u = clamp( dot( p0, v10 ) / dot2( v10 ), 0.0, 1.0 );
		v = 0.0;
		w = 1.0 - u;

	} else if( w < 0.0 ) {

		v = clamp( dot( p1, v21 ) / dot2( v21 ), 0.0, 1.0 );
		w = 0.0;
		u = 1.0 - v;

	}

	// output the barycoord in v0, v1, v2 weight order
	barycoord = vec3( w, u, v );
    return u * v1 + v * v2 + w * v0;

}

float distanceToTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// point and cut off range
	vec3 point, float closestDistanceSquared,

	// outputs
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord, inout float side, inout vec3 outPoint
) {

	bool found = false;
	vec3 localBarycoord;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		// get the closest point and barycoord
		vec3 closestPoint = closestPointToTriangle( point, a, b, c, localBarycoord );
		vec3 delta = point - closestPoint;
		float sqDist = dot2( delta );
		if ( sqDist < closestDistanceSquared ) {

			// set the output results
			closestDistanceSquared = sqDist;
			faceIndices = uvec4( indices.xyz, i );
			faceNormal = normalize( cross( a - b, b - c ) );
			barycoord = localBarycoord;
			outPoint = closestPoint;
			side = sign( dot( faceNormal, delta ) );

		}

	}

	return closestDistanceSquared;

}

float distanceSqToBounds( vec3 point, vec3 boundsMin, vec3 boundsMax ) {

	vec3 clampedPoint = clamp( point, boundsMin, boundsMax );
	vec3 delta = point - clampedPoint;
	return dot( delta, delta );

}

float distanceSqToBVHNodeBoundsPoint( vec3 point, sampler2D bvhBounds, uint currNodeIndex ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return distanceSqToBounds( point, boundsMin, boundsMax );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhClosestPointToPoint(		bvh,		point, maxDistance, faceIndices, faceNormal, barycoord, side, outPoint	)	_bvhClosestPointToPoint(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		point, maxDistance, faceIndices, faceNormal, barycoord, side, outPoint	)

float _bvhClosestPointToPoint(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// point to check
	vec3 point, float maxDistance,

	// output variables
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout vec3 outPoint
 ) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int pointer = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float closestDistanceSquared = maxDistance * maxDistance;
	bool found = false;
	while ( pointer > - 1 && pointer < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ pointer ];
		pointer --;

		// check if we intersect the current bounds
		float boundsHitDistance = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, currNodeIndex );
		if ( boundsHitDistance > closestDistanceSquared ) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );
		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;
			closestDistanceSquared = distanceToTriangles(
				bvh_position, bvh_index, offset, count, point, closestDistanceSquared,

				// outputs
				faceIndices, faceNormal, barycoord, side, outPoint
			);

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = currNodeIndex + boundsInfo.y;
			bool leftToRight = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, leftIndex ) < distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, rightIndex );//rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			pointer ++;
			stack[ pointer ] = c2;
			pointer ++;
			stack[ pointer ] = c1;

		}

	}

	return sqrt( closestDistanceSquared );

}
`;var Oh=`

#ifndef TRI_INTERSECT_EPSILON
#define TRI_INTERSECT_EPSILON 1e-5
#endif

// Raycasting
bool intersectsBounds( vec3 rayOrigin, vec3 rayDirection, vec3 boundsMin, vec3 boundsMax, out float dist ) {

	// https://www.reddit.com/r/opengl/comments/8ntzz5/fast_glsl_ray_box_intersection/
	// https://tavianator.com/2011/ray_box.html
	vec3 invDir = 1.0 / rayDirection;

	// find intersection distances for each plane
	vec3 tMinPlane = invDir * ( boundsMin - rayOrigin );
	vec3 tMaxPlane = invDir * ( boundsMax - rayOrigin );

	// get the min and max distances from each intersection
	vec3 tMinHit = min( tMaxPlane, tMinPlane );
	vec3 tMaxHit = max( tMaxPlane, tMinPlane );

	// get the furthest hit distance
	vec2 t = max( tMinHit.xx, tMinHit.yz );
	float t0 = max( t.x, t.y );

	// get the minimum hit distance
	t = min( tMaxHit.xx, tMaxHit.yz );
	float t1 = min( t.x, t.y );

	// set distance to 0.0 if the ray starts inside the box
	dist = max( t0, 0.0 );

	return t1 >= dist;

}

bool intersectsTriangle(
	vec3 rayOrigin, vec3 rayDirection, vec3 a, vec3 b, vec3 c,
	out vec3 barycoord, out vec3 norm, out float dist, out float side
) {

	// https://stackoverflow.com/questions/42740765/intersection-between-line-and-triangle-in-3d
	vec3 edge1 = b - a;
	vec3 edge2 = c - a;
	norm = cross( edge1, edge2 );

	float det = - dot( rayDirection, norm );
	float invdet = 1.0 / det;

	vec3 AO = rayOrigin - a;
	vec3 DAO = cross( AO, rayDirection );

	vec4 uvt;
	uvt.x = dot( edge2, DAO ) * invdet;
	uvt.y = - dot( edge1, DAO ) * invdet;
	uvt.z = dot( AO, norm ) * invdet;
	uvt.w = 1.0 - uvt.x - uvt.y;

	// set the hit information
	barycoord = uvt.wxy; // arranged in A, B, C order
	dist = uvt.z;
	side = sign( det );
	norm = side * normalize( norm );

	// add an epsilon to avoid misses between triangles
	uvt += vec4( TRI_INTERSECT_EPSILON );

	return all( greaterThanEqual( uvt, vec4( 0.0 ) ) );

}

bool intersectTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// outputs
	inout float minDistance, inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	bool found = false;
	vec3 localBarycoord, localNormal;
	float localDist, localSide;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		if (
			intersectsTriangle( rayOrigin, rayDirection, a, b, c, localBarycoord, localNormal, localDist, localSide )
			&& localDist < minDistance
		) {

			found = true;
			minDistance = localDist;

			faceIndices = uvec4( indices.xyz, i );
			faceNormal = localNormal;

			side = localSide;
			barycoord = localBarycoord;
			dist = localDist;

		}

	}

	return found;

}

bool intersectsBVHNodeBounds( vec3 rayOrigin, vec3 rayDirection, sampler2D bvhBounds, uint currNodeIndex, out float dist ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return intersectsBounds( rayOrigin, rayDirection, boundsMin, boundsMax, dist );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhIntersectFirstHit(		bvh,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)	_bvhIntersectFirstHit(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)

bool _bvhIntersectFirstHit(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// output variables split into separate variables due to output precision
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int pointer = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float triangleDistance = INFINITY;
	bool found = false;
	while ( pointer > - 1 && pointer < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ pointer ];
		pointer --;

		// check if we intersect the current bounds
		float boundsHitDistance;
		if (
			! intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh_bvhBounds, currNodeIndex, boundsHitDistance )
			|| boundsHitDistance > triangleDistance
		) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );

		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;

			found = intersectTriangles(
				bvh_position, bvh_index, offset, count,
				rayOrigin, rayDirection, triangleDistance,
				faceIndices, faceNormal, barycoord, side, dist
			) || found;

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = currNodeIndex + boundsInfo.y;

			bool leftToRight = rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			pointer ++;
			stack[ pointer ] = c2;

			pointer ++;
			stack[ pointer ] = c1;

		}

	}

	return found;

}
`;var Vp=`
struct BVH {

	usampler2D index;
	sampler2D position;

	sampler2D bvhBounds;
	usampler2D bvhContents;

};
`;var $E=`
	${Uh}
	${Oh}
`;function hc(i,e,t=0){if(i.isInterleavedBufferAttribute){let n=i.itemSize;for(let r=0,s=i.count;r<s;r++){let o=r+t;e.setX(o,i.getX(r)),n>=2&&e.setY(o,i.getY(r)),n>=3&&e.setZ(o,i.getZ(r)),n>=4&&e.setW(o,i.getW(r))}}else{let n=e.array,r=n.constructor,s=n.BYTES_PER_ELEMENT*i.itemSize*t;new r(n.buffer,s,i.array.length).set(i.array)}}function Tr(i,e=null){let t=i.array.constructor,n=i.normalized,r=i.itemSize,s=e===null?i.count:e;return new yt(new t(r*s),r,n)}function tr(i,e){if(!i&&!e)return!0;if(!!i!=!!e)return!1;let t=i.count===e.count,n=i.normalized===e.normalized,r=i.array.constructor===e.array.constructor,s=i.itemSize===e.itemSize;return!(!t||!n||!r||!s)}function cS(i){let e=i[0].index!==null,t=new Set(Object.keys(i[0].attributes));if(!i[0].getAttribute("position"))throw new Error("StaticGeometryGenerator: position attribute is required.");for(let n=0;n<i.length;++n){let r=i[n],s=0;if(e!==(r.index!==null))throw new Error("StaticGeometryGenerator: All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.");for(let o in r.attributes){if(!t.has(o))throw new Error('StaticGeometryGenerator: All geometries must have compatible attributes; make sure "'+o+'" attribute exists among all geometries, or in none of them.');s++}if(s!==t.size)throw new Error("StaticGeometryGenerator: All geometries must have the same number of attributes.")}}function uS(i){let e=0;for(let t=0,n=i.length;t<n;t++)e+=i[t].getIndex().count;return e}function hS(i){let e=0;for(let t=0,n=i.length;t<n;t++)e+=i[t].getAttribute("position").count;return e}function fS(i,e,t){i.index&&i.index.count!==e&&i.setIndex(null);let n=i.attributes;for(let r in n)n[r].count!==t&&i.deleteAttribute(r)}function Wp(i,e={},t=new Ot){let{useGroups:n=!1,forceUpdate:r=!1,skipAssigningAttributes:s=[],overwriteIndex:o=!0}=e;cS(i);let a=i[0].index!==null,l=a?uS(i):-1,u=hS(i);if(fS(t,l,u),n){let h=0;for(let c=0,d=i.length;c<d;c++){let x=i[c],S;a?S=x.getIndex().count:S=x.getAttribute("position").count,t.addGroup(h,S,c),h+=S}}if(a){let h=!1;if(t.index||(t.setIndex(new yt(new Uint32Array(l),1,!1)),h=!0),h||o){let c=0,d=0,x=t.getIndex();for(let S=0,p=i.length;S<p;S++){let g=i[S],y=g.getIndex();if(!(!r&&!h&&s[S]))for(let M=0;M<y.count;++M)x.setX(c+M,y.getX(M)+d);c+=y.count,d+=g.getAttribute("position").count}}}let f=Object.keys(i[0].attributes);for(let h=0,c=f.length;h<c;h++){let d=!1,x=f[h];if(!t.getAttribute(x)){let g=i[0].getAttribute(x);t.setAttribute(x,Tr(g,u)),d=!0}let S=0,p=t.getAttribute(x);for(let g=0,y=i.length;g<y;g++){let T=i[g],M=!r&&!d&&s[g],A=T.getAttribute(x);if(!M)if(x==="color"&&p.itemSize!==A.itemSize)for(let E=S,_=A.count;E<_;E++)A.setXYZW(E,p.getX(E),p.getY(E),p.getZ(E),1);else hc(A,p,S);S+=A.count}}}function Xp(i,e,t){let n=i.index,s=i.attributes.position.count,o=n?n.count:s,a=i.groups;a.length===0&&(a=[{count:o,start:0,materialIndex:0}]);let l=i.getAttribute("materialIndex");if(!l||l.count!==s){let f;t.length<=255?f=new Uint8Array(s):f=new Uint16Array(s),l=new yt(f,1,!1),i.deleteAttribute("materialIndex"),i.setAttribute("materialIndex",l)}let u=l.array;for(let f=0;f<a.length;f++){let h=a[f],c=h.start,d=h.count,x=Math.min(d,o-c),S=Array.isArray(e)?e[h.materialIndex]:e,p=t.indexOf(S);for(let g=0;g<x;g++){let y=c+g;n&&(y=n.getX(y)),u[y]=p}}}function qp(i,e){if(!i.index){let t=i.attributes.position.count,n=new Array(t);for(let r=0;r<t;r++)n[r]=r;i.setIndex(n)}if(!i.attributes.normal&&e&&e.includes("normal")&&i.computeVertexNormals(),!i.attributes.uv&&e&&e.includes("uv")){let t=i.attributes.position.count;i.setAttribute("uv",new yt(new Float32Array(t*2),2,!1))}if(!i.attributes.uv2&&e&&e.includes("uv2")){let t=i.attributes.position.count;i.setAttribute("uv2",new yt(new Float32Array(t*2),2,!1))}if(!i.attributes.tangent&&e&&e.includes("tangent"))if(i.attributes.uv&&i.attributes.normal)i.computeTangents();else{let t=i.attributes.position.count;i.setAttribute("tangent",new yt(new Float32Array(t*4),4,!1))}if(!i.attributes.color&&e&&e.includes("color")){let t=i.attributes.position.count,n=new Float32Array(t*4);n.fill(1),i.setAttribute("color",new yt(n,4))}}function ws(i){let e=0;if(i.byteLength!==0){let t=new Uint8Array(i);for(let n=0;n<i.byteLength;n++){let r=t[n];e=(e<<5)-e+r,e|=0}}return e}function Yp(i){let e=i.uuid,t=Object.values(i.attributes);i.index&&(t.push(i.index),e+=`index|${i.index.version}`);let n=Object.keys(t).sort();for(let r of n){let s=t[r];e+=`${r}_${s.version}|`}return e}function Zp(i){let e=i.skeleton;return e?(e.boneTexture||e.computeBoneTexture(),`${ws(e.boneTexture.image.data.buffer)}_${e.boneTexture.uuid}`):null}var fc=class{constructor(e=null){this.matrixWorld=new Ze,this.geometryHash=null,this.skeletonHash=null,this.primitiveCount=-1,e!==null&&this.updateFrom(e)}updateFrom(e){let t=e.geometry,n=(t.index?t.index.count:t.attributes.position.count)/3;this.matrixWorld.copy(e.matrixWorld),this.geometryHash=Yp(t),this.primitiveCount=n,this.skeletonHash=Zp(e)}didChange(e){let t=e.geometry,n=(t.index?t.index.count:t.attributes.position.count)/3;return!(this.matrixWorld.equals(e.matrixWorld)&&this.geometryHash===Yp(t)&&this.skeletonHash===Zp(e)&&this.primitiveCount===n)}};var wr=new H,Ar=new H,Er=new H,$p=new St,dc=new H,Bh=new H,Jp=new St,Kp=new St,pc=new Ze,Qp=new Ze;function jp(i,e,t){let n=i.skeleton,r=i.geometry,s=n.bones,o=n.boneInverses;Jp.fromBufferAttribute(r.attributes.skinIndex,e),Kp.fromBufferAttribute(r.attributes.skinWeight,e),pc.elements.fill(0);for(let a=0;a<4;a++){let l=Kp.getComponent(a);if(l!==0){let u=Jp.getComponent(a);Qp.multiplyMatrices(s[u].matrixWorld,o[u]),dS(pc,Qp,l)}}return pc.multiply(i.bindMatrix).premultiply(i.bindMatrixInverse),t.transformDirection(pc),t}function zh(i,e,t,n,r){dc.set(0,0,0);for(let s=0,o=i.length;s<o;s++){let a=e[s],l=i[s];a!==0&&(Bh.fromBufferAttribute(l,n),t?dc.addScaledVector(Bh,a):dc.addScaledVector(Bh.sub(r),a))}r.add(dc)}function dS(i,e,t){let n=i.elements,r=e.elements;for(let s=0,o=r.length;s<o;s++)n[s]+=r[s]*t}function pS(i){let{index:e,attributes:t}=i;if(e)for(let n=0,r=e.count;n<r;n+=3){let s=e.getX(n),o=e.getX(n+2);e.setX(n,o),e.setX(n+2,s)}else for(let n in t){let r=t[n],s=r.itemSize;for(let o=0,a=r.count;o<a;o+=3)for(let l=0;l<s;l++){let u=r.getComponent(o,l),f=r.getComponent(o+2,l);r.setComponent(o,l,f),r.setComponent(o+2,l,u)}}return i}function em(i,e={},t=new Ot){e={applyWorldTransforms:!0,attributes:[],...e};let n=i.geometry,r=e.applyWorldTransforms,s=e.attributes.includes("normal"),o=e.attributes.includes("tangent"),a=n.attributes,l=t.attributes;for(let y in t.attributes)(!e.attributes.includes(y)||!(y in n.attributes))&&t.deleteAttribute(y);!t.index&&n.index&&(t.index=n.index.clone()),l.position||t.setAttribute("position",Tr(a.position)),s&&!l.normal&&a.normal&&t.setAttribute("normal",Tr(a.normal)),o&&!l.tangent&&a.tangent&&t.setAttribute("tangent",Tr(a.tangent)),tr(n.index,t.index),tr(a.position,l.position),s&&tr(a.normal,l.normal),o&&tr(a.tangent,l.tangent);let u=a.position,f=s?a.normal:null,h=o?a.tangent:null,c=n.morphAttributes.position,d=n.morphAttributes.normal,x=n.morphAttributes.tangent,S=n.morphTargetsRelative,p=i.morphTargetInfluences,g=new je;g.getNormalMatrix(i.matrixWorld),n.index&&t.index.array.set(n.index.array);for(let y=0,T=a.position.count;y<T;y++)wr.fromBufferAttribute(u,y),f&&Ar.fromBufferAttribute(f,y),h&&($p.fromBufferAttribute(h,y),Er.fromBufferAttribute(h,y)),p&&(c&&zh(c,p,S,y,wr),d&&zh(d,p,S,y,Ar),x&&zh(x,p,S,y,Er)),i.isSkinnedMesh&&(i.applyBoneTransform(y,wr),f&&jp(i,y,Ar),h&&jp(i,y,Er)),r&&wr.applyMatrix4(i.matrixWorld),l.position.setXYZ(y,wr.x,wr.y,wr.z),f&&(r&&Ar.applyNormalMatrix(g),l.normal.setXYZ(y,Ar.x,Ar.y,Ar.z)),h&&(r&&Er.transformDirection(i.matrixWorld),l.tangent.setXYZW(y,Er.x,Er.y,Er.z,$p.w));for(let y in e.attributes){let T=e.attributes[y];T==="position"||T==="tangent"||T==="normal"||!(T in a)||(l[T]||t.setAttribute(T,Tr(a[T])),tr(a[T],l[T]),hc(a[T],l[T]))}return i.matrixWorld.determinant()<0&&pS(t),t}var mc=class extends Ot{constructor(){super(),this.version=0,this.hash=null,this._diff=new fc}isCompatible(e,t){let n=e.geometry;for(let r=0;r<t.length;r++){let s=t[r],o=n.attributes[s],a=this.attributes[s];if(o&&!tr(o,a))return!1}return!0}updateFrom(e,t){let n=this._diff;return n.didChange(e)?(em(e,t,this),n.updateFrom(e),this.version++,this.hash=`${this.uuid}_${this.version}`,!0):!1}};var xc=0,kh=1,Hh=2;function mS(i,e){for(let t=0,n=i.length;t<n;t++)i[t].traverseVisible(s=>{s.isMesh&&e(s)})}function gS(i){let e=[];for(let t=0,n=i.length;t<n;t++){let r=i[t];Array.isArray(r.material)?e.push(...r.material):e.push(r.material)}return e}function xS(i,e,t){if(i.length===0){e.setIndex(null);let n=e.attributes;for(let r in n)e.deleteAttribute(r);for(let r in t.attributes)e.setAttribute(t.attributes[r],new yt(new Float32Array(0),4,!1))}else Wp(i,t,e);for(let n in e.attributes)e.attributes[n].needsUpdate=!0}var gc=class{constructor(e){this.objects=null,this.useGroups=!0,this.applyWorldTransforms=!0,this.generateMissingAttributes=!0,this.overwriteIndex=!0,this.attributes=["position","normal","color","tangent","uv","uv2"],this._intermediateGeometry=new Map,this._geometryMergeSets=new WeakMap,this._mergeOrder=[],this._dummyMesh=null,this.setObjects(e||[])}_getDummyMesh(){if(!this._dummyMesh){let e=new Qr,t=new Ot;t.setAttribute("position",new yt(new Float32Array(9),3)),this._dummyMesh=new xn(t,e)}return this._dummyMesh}_getMeshes(){let e=[];return mS(this.objects,t=>{e.push(t)}),e.sort((t,n)=>t.uuid>n.uuid?1:t.uuid<n.uuid?-1:0),e.length===0&&e.push(this._getDummyMesh()),e}_updateIntermediateGeometries(){let{_intermediateGeometry:e}=this,t=this._getMeshes(),n=new Set(e.keys()),r={attributes:this.attributes,applyWorldTransforms:this.applyWorldTransforms};for(let s=0,o=t.length;s<o;s++){let a=t[s],l=a.uuid;n.delete(l);let u=e.get(l);(!u||!u.isCompatible(a,this.attributes))&&(u&&u.dispose(),u=new mc,e.set(l,u)),u.updateFrom(a,r)&&this.generateMissingAttributes&&qp(u,this.attributes)}n.forEach(s=>{e.delete(s)})}setObjects(e){Array.isArray(e)?this.objects=[...e]:this.objects=[e]}generate(e=new Ot){let{useGroups:t,overwriteIndex:n,_intermediateGeometry:r,_geometryMergeSets:s}=this,o=this._getMeshes(),a=[],l=[],u=s.get(e)||[];this._updateIntermediateGeometries();let f=!1;o.length!==u.length&&(f=!0);for(let c=0,d=o.length;c<d;c++){let x=o[c],S=r.get(x.uuid);l.push(S);let p=u[c];!p||p.uuid!==S.uuid?(a.push(!1),f=!0):p.version!==S.version?a.push(!1):a.push(!0)}xS(l,e,{useGroups:t,forceUpdate:f,skipAssigningAttributes:a,overwriteIndex:n}),f&&e.dispose(),s.set(e,l.map(c=>({version:c.version,uuid:c.uuid})));let h=xc;return f?h=Hh:a.includes(!1)&&(h=kh),{changeType:h,materials:gS(o),geometry:e}}};function vS(i){let e=new Set;for(let t=0,n=i.length;t<n;t++){let r=i[t];for(let s in r){let o=r[s];o&&o.isTexture&&e.add(o)}}return Array.from(e)}function _S(i){let e=[],t=new Set;for(let r=0,s=i.length;r<s;r++)i[r].traverse(o=>{o.visible&&(o.isRectAreaLight||o.isSpotLight||o.isPointLight||o.isDirectionalLight)&&(e.push(o),o.iesMap&&t.add(o.iesMap))});let n=Array.from(t).sort((r,s)=>r.uuid<s.uuid?1:r.uuid>s.uuid?-1:0);return{lights:e,iesTextures:n}}var vc=class{get initialized(){return!!this.bvh}constructor(e){this.bvhOptions={},this.attributes=["position","normal","tangent","color","uv","uv2"],this.generateBVH=!0,this.bvh=null,this.geometry=new Ot,this.staticGeometryGenerator=new gc(e),this._bvhWorker=null,this._pendingGenerate=null,this._buildAsync=!1,this._materialUuids=null}setObjects(e){this.staticGeometryGenerator.setObjects(e)}setBVHWorker(e){this._bvhWorker=e}async generateAsync(e=null){if(!this._bvhWorker)throw new Error('PathTracingSceneGenerator: "setBVHWorker" must be called before "generateAsync" can be called.');if(this.bvh instanceof Promise)return this._pendingGenerate||(this._pendingGenerate=new Promise(async()=>(await this.bvh,this._pendingGenerate=null,this.generateAsync(e)))),this._pendingGenerate;{this._buildAsync=!0;let t=this.generate(e);return this._buildAsync=!1,t.bvh=this.bvh=await t.bvh,t}}generate(e=null){let{staticGeometryGenerator:t,geometry:n,attributes:r}=this,s=t.objects;t.attributes=r,s.forEach(c=>{c.traverse(d=>{d.isSkinnedMesh&&d.skeleton&&d.skeleton.update()})});let o=t.generate(n),a=o.materials,l=o.changeType!==xc||this._materialUuids===null||this._materialUuids.length!==length;if(!l){for(let c=0,d=a.length;c<d;c++)if(a[c].uuid!==this._materialUuids[c]){l=!0;break}}let u=vS(a),{lights:f,iesTextures:h}=_S(s);if(l&&(Xp(n,a,a),this._materialUuids=a.map(c=>c.uuid)),this.generateBVH){if(this.bvh instanceof Promise)throw new Error("PathTracingSceneGenerator: BVH is already building asynchronously.");if(o.changeType===Hh){let c={strategy:2,maxLeafTris:1,indirect:!0,onProgress:e,...this.bvhOptions};this._buildAsync?this.bvh=this._bvhWorker.generate(n,c):this.bvh=new lc(n,c)}else o.changeType===kh&&this.bvh.refit()}return{bvhChanged:o.changeType!==xc,bvh:this.bvh,needsMaterialIndexUpdate:l,lights:f,iesTextures:h,geometry:n,materials:a,textures:u,objects:s}}};var yS=new Wi(-1,1,1,-1,0,1),Gh=class extends Ot{constructor(){super(),this.setAttribute("position",new Xt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new Xt([0,2,0,0,2,0],2))}},SS=new Gh,kn=class{constructor(e){this._mesh=new xn(SS,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,yS)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}};var nr=class extends $t{set needsUpdate(e){super.needsUpdate=!0,this.dispatchEvent({type:"recompilation"})}constructor(e){super(e);for(let t in this.uniforms)Object.defineProperty(this,t,{get(){return this.uniforms[t].value},set(n){this.uniforms[t].value=n}})}setDefine(e,t=void 0){if(t==null){if(e in this.defines)return delete this.defines[e],this.needsUpdate=!0,!0}else if(this.defines[e]!==t)return this.defines[e]=t,this.needsUpdate=!0,!0;return!1}};var _c=class extends nr{constructor(e){super({blending:_n,uniforms:{target1:{value:null},target2:{value:null},opacity:{value:1}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				uniform float opacity;

				uniform sampler2D target1;
				uniform sampler2D target2;

				varying vec2 vUv;

				void main() {

					vec4 color1 = texture2D( target1, vUv );
					vec4 color2 = texture2D( target2, vUv );

					float invOpacity = 1.0 - opacity;
					float totalAlpha = color1.a * invOpacity + color2.a * opacity;

					if ( color1.a != 0.0 || color2.a != 0.0 ) {

						gl_FragColor.rgb = color1.rgb * ( invOpacity * color1.a / totalAlpha ) + color2.rgb * ( opacity * color2.a / totalAlpha );
						gl_FragColor.a = totalAlpha;

					} else {

						gl_FragColor = vec4( 0.0 );

					}

				}`}),this.setValues(e)}};function yc(i=1){let e="uint";return i>1&&(e="uvec"+i),`
		${e} sobolReverseBits( ${e} x ) {

			x = ( ( ( x & 0xaaaaaaaau ) >> 1 ) | ( ( x & 0x55555555u ) << 1 ) );
			x = ( ( ( x & 0xccccccccu ) >> 2 ) | ( ( x & 0x33333333u ) << 2 ) );
			x = ( ( ( x & 0xf0f0f0f0u ) >> 4 ) | ( ( x & 0x0f0f0f0fu ) << 4 ) );
			x = ( ( ( x & 0xff00ff00u ) >> 8 ) | ( ( x & 0x00ff00ffu ) << 8 ) );
			return ( ( x >> 16 ) | ( x << 16 ) );

		}

		${e} sobolHashCombine( uint seed, ${e} v ) {

			return seed ^ ( v + ${e}( ( seed << 6 ) + ( seed >> 2 ) ) );

		}

		${e} sobolLaineKarrasPermutation( ${e} x, ${e} seed ) {

			x += seed;
			x ^= x * 0x6c50b47cu;
			x ^= x * 0xb82f1e52u;
			x ^= x * 0xc7afe638u;
			x ^= x * 0x8d22f6e6u;
			return x;

		}

		${e} nestedUniformScrambleBase2( ${e} x, ${e} seed ) {

			x = sobolLaineKarrasPermutation( x, seed );
			x = sobolReverseBits( x );
			return x;

		}
	`}function Sc(i=1){let e="uint",t="float",n="",r=".r",s="1u";return i>1&&(e="uvec"+i,t="vec"+i,n=i+"",i===2?(r=".rg",s="uvec2( 1u, 2u )"):i===3?(r=".rgb",s="uvec3( 1u, 2u, 3u )"):(r="",s="uvec4( 1u, 2u, 3u, 4u )")),`

		${t} sobol${n}( int effect ) {

			uint seed = sobolGetSeed( sobolBounceIndex, uint( effect ) );
			uint index = sobolPathIndex;

			uint shuffle_seed = sobolHashCombine( seed, 0u );
			uint shuffled_index = nestedUniformScrambleBase2( sobolReverseBits( index ), shuffle_seed );
			${t} sobol_pt = sobolGetTexturePoint( shuffled_index )${r};
			${e} result = ${e}( sobol_pt * 16777216.0 );

			${e} seed2 = sobolHashCombine( seed, ${s} );
			result = nestedUniformScrambleBase2( result, seed2 );

			return SOBOL_FACTOR * ${t}( result >> 8 );

		}
	`}var bc=`

	// Utils
	const float SOBOL_FACTOR = 1.0 / 16777216.0;
	const uint SOBOL_MAX_POINTS = 256u * 256u;

	${yc(1)}
	${yc(2)}
	${yc(3)}
	${yc(4)}

	uint sobolHash( uint x ) {

		// finalizer from murmurhash3
		x ^= x >> 16;
		x *= 0x85ebca6bu;
		x ^= x >> 13;
		x *= 0xc2b2ae35u;
		x ^= x >> 16;
		return x;

	}

`,tm=`

	const uint SOBOL_DIRECTIONS_1[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0xa0000000u, 0xf0000000u,
		0x88000000u, 0xcc000000u, 0xaa000000u, 0xff000000u,
		0x80800000u, 0xc0c00000u, 0xa0a00000u, 0xf0f00000u,
		0x88880000u, 0xcccc0000u, 0xaaaa0000u, 0xffff0000u,
		0x80008000u, 0xc000c000u, 0xa000a000u, 0xf000f000u,
		0x88008800u, 0xcc00cc00u, 0xaa00aa00u, 0xff00ff00u,
		0x80808080u, 0xc0c0c0c0u, 0xa0a0a0a0u, 0xf0f0f0f0u,
		0x88888888u, 0xccccccccu, 0xaaaaaaaau, 0xffffffffu
	);

	const uint SOBOL_DIRECTIONS_2[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0x60000000u, 0x90000000u,
		0xe8000000u, 0x5c000000u, 0x8e000000u, 0xc5000000u,
		0x68800000u, 0x9cc00000u, 0xee600000u, 0x55900000u,
		0x80680000u, 0xc09c0000u, 0x60ee0000u, 0x90550000u,
		0xe8808000u, 0x5cc0c000u, 0x8e606000u, 0xc5909000u,
		0x6868e800u, 0x9c9c5c00u, 0xeeee8e00u, 0x5555c500u,
		0x8000e880u, 0xc0005cc0u, 0x60008e60u, 0x9000c590u,
		0xe8006868u, 0x5c009c9cu, 0x8e00eeeeu, 0xc5005555u
	);

	const uint SOBOL_DIRECTIONS_3[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0x20000000u, 0x50000000u,
		0xf8000000u, 0x74000000u, 0xa2000000u, 0x93000000u,
		0xd8800000u, 0x25400000u, 0x59e00000u, 0xe6d00000u,
		0x78080000u, 0xb40c0000u, 0x82020000u, 0xc3050000u,
		0x208f8000u, 0x51474000u, 0xfbea2000u, 0x75d93000u,
		0xa0858800u, 0x914e5400u, 0xdbe79e00u, 0x25db6d00u,
		0x58800080u, 0xe54000c0u, 0x79e00020u, 0xb6d00050u,
		0x800800f8u, 0xc00c0074u, 0x200200a2u, 0x50050093u
	);

	const uint SOBOL_DIRECTIONS_4[ 32 ] = uint[ 32 ](
		0x80000000u, 0x40000000u, 0x20000000u, 0xb0000000u,
		0xf8000000u, 0xdc000000u, 0x7a000000u, 0x9d000000u,
		0x5a800000u, 0x2fc00000u, 0xa1600000u, 0xf0b00000u,
		0xda880000u, 0x6fc40000u, 0x81620000u, 0x40bb0000u,
		0x22878000u, 0xb3c9c000u, 0xfb65a000u, 0xddb2d000u,
		0x78022800u, 0x9c0b3c00u, 0x5a0fb600u, 0x2d0ddb00u,
		0xa2878080u, 0xf3c9c040u, 0xdb65a020u, 0x6db2d0b0u,
		0x800228f8u, 0x400b3cdcu, 0x200fb67au, 0xb00ddb9du
	);

	uint getMaskedSobol( uint index, uint directions[ 32 ] ) {

		uint X = 0u;
		for ( int bit = 0; bit < 32; bit ++ ) {

			uint mask = ( index >> bit ) & 1u;
			X ^= mask * directions[ bit ];

		}
		return X;

	}

	vec4 generateSobolPoint( uint index ) {

		if ( index >= SOBOL_MAX_POINTS ) {

			return vec4( 0.0 );

		}

		// NOTE: this sobol "direction" is also available but we can't write out 5 components
		// uint x = index & 0x00ffffffu;
		uint x = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_1 ) ) & 0x00ffffffu;
		uint y = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_2 ) ) & 0x00ffffffu;
		uint z = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_3 ) ) & 0x00ffffffu;
		uint w = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_4 ) ) & 0x00ffffffu;

		return vec4( x, y, z, w ) * SOBOL_FACTOR;

	}

`,nm=`

	// Seeds
	uniform sampler2D sobolTexture;
	uint sobolPixelIndex = 0u;
	uint sobolPathIndex = 0u;
	uint sobolBounceIndex = 0u;

	uint sobolGetSeed( uint bounce, uint effect ) {

		return sobolHash(
			sobolHashCombine(
				sobolHashCombine(
					sobolHash( bounce ),
					sobolPixelIndex
				),
				effect
			)
		);

	}

	vec4 sobolGetTexturePoint( uint index ) {

		if ( index >= SOBOL_MAX_POINTS ) {

			index = index % SOBOL_MAX_POINTS;

		}

		uvec2 dim = uvec2( textureSize( sobolTexture, 0 ).xy );
		uint y = index / dim.x;
		uint x = index - y * dim.x;
		vec2 uv = vec2( x, y ) / vec2( dim );
		return texture( sobolTexture, uv );

	}

	${Sc(1)}
	${Sc(2)}
	${Sc(3)}
	${Sc(4)}

`;var Vh=class extends nr{constructor(){super({blending:_n,uniforms:{resolution:{value:new Ue}},vertexShader:`

				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,fragmentShader:`

				${bc}
				${tm}

				varying vec2 vUv;
				uniform vec2 resolution;
				void main() {

					uint index = uint( gl_FragCoord.y ) * uint( resolution.x ) + uint( gl_FragCoord.x );
					gl_FragColor = generateSobolPoint( index );

				}
			`})}},Mc=class{generate(e,t=256){let n=new zt(t,t,{type:tt,format:qe,minFilter:Qe,magFilter:Qe,generateMipmaps:!1}),r=e.getRenderTarget();e.setRenderTarget(n);let s=new kn(new Vh);return s.material.resolution.set(t,t),s.render(e),e.setRenderTarget(r),s.dispose(),n}};var As=class extends cn{set bokehSize(e){this.fStop=this.getFocalLength()/e}get bokehSize(){return this.getFocalLength()/this.fStop}constructor(...e){super(...e),this.fStop=1.4,this.apertureBlades=0,this.apertureRotation=0,this.focusDistance=25,this.anamorphicRatio=1}copy(e,t){return super.copy(e,t),this.fStop=e.fStop,this.apertureBlades=e.apertureBlades,this.apertureRotation=e.apertureRotation,this.focusDistance=e.focusDistance,this.anamorphicRatio=e.anamorphicRatio,this}};var Tc=class{constructor(){this.bokehSize=0,this.apertureBlades=0,this.apertureRotation=0,this.focusDistance=10,this.anamorphicRatio=1}updateFrom(e){e instanceof As?(this.bokehSize=e.bokehSize,this.apertureBlades=e.apertureBlades,this.apertureRotation=e.apertureRotation,this.focusDistance=e.focusDistance,this.anamorphicRatio=e.anamorphicRatio):(this.bokehSize=0,this.apertureRotation=0,this.apertureBlades=0,this.focusDistance=10,this.anamorphicRatio=1)}};function wc(i){let e=new Uint16Array(i.length);for(let t=0,n=i.length;t<n;++t)e[t]=pe.toHalfFloat(i[t]);return e}function im(i,e,t=0,n=i.length){let r=t,s=t+n-1;for(;r<s;){let o=r+s>>1;i[o]<e?r=o+1:s=o}return r-t}function bS(i,e,t){return .2126*i+.7152*e+.0722*t}function MS(i,e=ht){let t=i.clone();t.source=new Vs({...t.image});let{width:n,height:r,data:s}=t.image,o=s;if(t.type!==e){e===ht?o=new Uint16Array(s.length):o=new Float32Array(s.length);let a;s instanceof Int8Array||s instanceof Int16Array||s instanceof Int32Array?a=2**(8*s.BYTES_PER_ELEMENT-1)-1:a=2**(8*s.BYTES_PER_ELEMENT)-1;for(let l=0,u=s.length;l<u;l++){let f=s[l];t.type===ht&&(f=pe.fromHalfFloat(s[l])),t.type!==tt&&t.type!==ht&&(f/=a),e===ht&&(o[l]=pe.toHalfFloat(f))}t.image.data=o,t.type=e}if(t.flipY){let a=o;o=o.slice();for(let l=0;l<r;l++)for(let u=0;u<n;u++){let f=r-l-1,h=4*(l*n+u),c=4*(f*n+u);o[c+0]=a[h+0],o[c+1]=a[h+1],o[c+2]=a[h+2],o[c+3]=a[h+3]}t.flipY=!1,t.image.data=o}return t}var Ac=class{constructor(){let e=new Rt(wc(new Float32Array([0,0,0,0])),1,1);e.type=ht,e.format=qe,e.minFilter=lt,e.magFilter=lt,e.wrapS=rn,e.wrapT=rn,e.generateMipmaps=!1,e.needsUpdate=!0;let t=new Rt(wc(new Float32Array([0,1])),1,2);t.type=ht,t.format=Rn,t.minFilter=lt,t.magFilter=lt,t.generateMipmaps=!1,t.needsUpdate=!0;let n=new Rt(wc(new Float32Array([0,0,1,1])),2,2);n.type=ht,n.format=Rn,n.minFilter=lt,n.magFilter=lt,n.generateMipmaps=!1,n.needsUpdate=!0,this.map=e,this.marginalWeights=t,this.conditionalWeights=n,this.totalSum=0}getPixelWeight(e,t,n){return bS(e,t,n)}dispose(){this.marginalWeights.dispose(),this.conditionalWeights.dispose(),this.map.dispose()}updateFrom(e){let t=MS(e);t.wrapS=rn,t.wrapT=Pt;let{width:n,height:r,data:s}=t.image,o=new Float32Array(n*r),a=new Float32Array(n*r),l=new Float32Array(r),u=new Float32Array(r),f=0,h=0;for(let p=0;p<r;p++){let g=0;for(let y=0;y<n;y++){let T=p*n+y,M=pe.fromHalfFloat(s[4*T+0]),A=pe.fromHalfFloat(s[4*T+1]),E=pe.fromHalfFloat(s[4*T+2]),_=this.getPixelWeight(M,A,E,p,r);g+=_,f+=_,o[T]=_,a[T]=g}if(g!==0)for(let y=p*n,T=p*n+n;y<T;y++)o[y]/=g,a[y]/=g;h+=g,l[p]=g,u[p]=h}if(h!==0)for(let p=0,g=l.length;p<g;p++)l[p]/=h,u[p]/=h;let c=new Uint16Array(r),d=new Uint16Array(n*r);for(let p=0;p<r;p++){let g=(p+1)/r,y=im(u,g);c[p]=pe.toHalfFloat((y+.5)/r)}for(let p=0;p<r;p++)for(let g=0;g<n;g++){let y=p*n+g,T=(g+1)/n,M=im(a,T,p*n,n);d[y]=pe.toHalfFloat((M+.5)/n)}this.dispose();let{marginalWeights:x,conditionalWeights:S}=this;x.image={width:r,height:1,data:c},x.needsUpdate=!0,S.image={width:n,height:r,data:d},S.needsUpdate=!0,this.totalSum=f,this.map=t}};var Wh=6,TS=11,wS=0,AS=1,ES=2,RS=3,CS=4,jn=new H,Fn=new H,rm=new Ze,Es=new Xn,sm=new H,hi=new H,IS=new H(0,1,0),Ec=class{constructor(){let e=new Rt(new Float32Array(4),1,1);e.format=qe,e.type=tt,e.wrapS=Pt,e.wrapT=Pt,e.generateMipmaps=!1,e.minFilter=Qe,e.magFilter=Qe,this.tex=e,this.count=0}updateFrom(e,t=[]){let n=this.tex,r=Math.max(e.length*Wh,1),s=Math.ceil(Math.sqrt(r));n.image.width!==s&&(n.dispose(),n.image.data=new Float32Array(s*s*4),n.image.width=s,n.image.height=s);let o=n.image.data;for(let l=0,u=e.length;l<u;l++){let f=e[l],h=l*Wh*4,c=0;for(let x=0;x<Wh*4;x++)o[h+x]=0;f.getWorldPosition(Fn),o[h+c++]=Fn.x,o[h+c++]=Fn.y,o[h+c++]=Fn.z;let d=wS;if(f.isRectAreaLight&&f.isCircular?d=AS:f.isSpotLight?d=ES:f.isDirectionalLight||f.isSunLight?d=RS:f.isPointLight&&(d=CS),o[h+c++]=d,o[h+c++]=f.color.r,o[h+c++]=f.color.g,o[h+c++]=f.color.b,o[h+c++]=f.intensity,f.getWorldQuaternion(Es),f.isRectAreaLight)jn.set(f.width,0,0).applyQuaternion(Es),o[h+c++]=jn.x,o[h+c++]=jn.y,o[h+c++]=jn.z,c++,Fn.set(0,f.height,0).applyQuaternion(Es),o[h+c++]=Fn.x,o[h+c++]=Fn.y,o[h+c++]=Fn.z,o[h+c++]=jn.cross(Fn).length()*(f.isCircular?Math.PI/4:1);else if(f.isSpotLight){let x=f.radius||0;sm.setFromMatrixPosition(f.matrixWorld),hi.setFromMatrixPosition(f.target.matrixWorld),rm.lookAt(sm,hi,IS),Es.setFromRotationMatrix(rm),jn.set(1,0,0).applyQuaternion(Es),o[h+c++]=jn.x,o[h+c++]=jn.y,o[h+c++]=jn.z,c++,Fn.set(0,1,0).applyQuaternion(Es),o[h+c++]=Fn.x,o[h+c++]=Fn.y,o[h+c++]=Fn.z,o[h+c++]=Math.PI*x*x,o[h+c++]=x,o[h+c++]=f.decay,o[h+c++]=f.distance,o[h+c++]=Math.cos(f.angle),o[h+c++]=Math.cos(f.angle*(1-f.penumbra)),o[h+c++]=f.iesMap?t.indexOf(f.iesMap):-1}else if(f.isPointLight){let x=jn.setFromMatrixPosition(f.matrixWorld);o[h+c++]=x.x,o[h+c++]=x.y,o[h+c++]=x.z,c++,c+=4,c+=1,o[h+c++]=f.decay,o[h+c++]=f.distance}else if(f.isDirectionalLight){let x=jn.setFromMatrixPosition(f.matrixWorld),S=Fn.setFromMatrixPosition(f.target.matrixWorld);hi.subVectors(x,S).normalize(),o[h+c++]=hi.x,o[h+c++]=hi.y,o[h+c++]=hi.z}else f.isSunLight&&(hi.setFromMatrixPosition(f.matrixWorld).normalize(),o[h+c++]=hi.x,o[h+c++]=hi.y,o[h+c++]=hi.z);o[h+TS]=f.visibleToCameraRays?1:0}this.count=e.length;let a=ws(o.buffer);return this.hash!==a?(this.hash=a,n.needsUpdate=!0,!0):!1}};function om(i,e,t,n,r){if(e>n)throw new Error;let s=i.length/e,o=i.constructor.BYTES_PER_ELEMENT*8,a=1;switch(i.constructor){case Uint8Array:case Uint16Array:case Uint32Array:a=2**o-1;break;case Int8Array:case Int16Array:case Int32Array:a=2**(o-1)-1;break}for(let l=0;l<s;l++){let u=4*l,f=e*l;for(let h=0;h<n;h++)t[r+u+h]=e>=h+1?i[f+h]/a:0}}var Rc=class extends zi{constructor(){super(),this._textures=[],this.type=tt,this.format=qe,this.internalFormat="RGBA32F"}updateAttribute(e,t){let n=this._textures[e];n.updateFrom(t);let r=n.image,s=this.image;if(r.width!==s.width||r.height!==s.height)throw new Error("FloatAttributeTextureArray: Attribute must be the same dimensions when updating single layer.");let{width:o,height:a,data:l}=s,f=o*a*4*e,h=t.itemSize;h===3&&(h=4),om(n.image.data,h,l,4,f),this.dispose(),this.needsUpdate=!0}setAttributes(e){let t=e[0].count,n=e.length;for(let h=0,c=n;h<c;h++)if(e[h].count!==t)throw new Error("FloatAttributeTextureArray: All attributes must have the same item count.");let r=this._textures;for(;r.length<n;){let h=new Ts;r.push(h)}for(;r.length>n;)r.pop();for(let h=0,c=n;h<c;h++)r[h].updateFrom(e[h]);let o=r[0].image,a=this.image;(o.width!==a.width||o.height!==a.height||o.depth!==n)&&(a.width=o.width,a.height=o.height,a.depth=n,a.data=new Float32Array(a.width*a.height*a.depth*4));let{data:l,width:u,height:f}=a;for(let h=0,c=n;h<c;h++){let d=r[h],S=u*f*4*h,p=e[h].itemSize;p===3&&(p=4),om(d.image.data,p,l,4,S)}this.dispose(),this.needsUpdate=!0}};var Cc=class extends Rc{updateNormalAttribute(e){this.updateAttribute(0,e)}updateTangentAttribute(e){this.updateAttribute(1,e)}updateUvAttribute(e){this.updateAttribute(2,e)}updateColorAttribute(e){this.updateAttribute(3,e)}updateFrom(e,t,n,r){this.setAttributes([e,t,n,r])}};function Xh(i,e){return i.uuid<e.uuid?1:i.uuid>e.uuid?-1:0}function Ic(i){return`${i.source.uuid}:${i.colorSpace}`}function PS(i){let e=new Set,t=[];for(let n=0,r=i.length;n<r;n++){let s=i[n],o=Ic(s);e.has(o)||(e.add(o),t.push(s))}return t}function am(i){let e=i.map(n=>n.iesMap||null).filter(n=>n),t=new Set(e);return Array.from(t).sort(Xh)}function lm(i){let e=new Set;for(let n=0,r=i.length;n<r;n++){let s=i[n];for(let o in s){let a=s[o];a&&a.isTexture&&e.add(a)}}let t=Array.from(e);return PS(t).sort(Xh)}function cm(i){let e=[];return i.traverseVisible(t=>{(t.isRectAreaLight||t.isSpotLight||t.isPointLight||t.isDirectionalLight||t.isSunLight)&&e.push(t)}),e.sort(Xh)}var Dc=47,um=Dc*4,qh=class{constructor(){this._features={}}isUsed(e){return e in this._features}setUsed(e,t=!0){t===!1?delete this._features[e]:this._features[e]=!0}reset(){this._features={}}},Pc=class extends Rt{constructor(){super(new Float32Array(4),1,1),this.format=qe,this.type=tt,this.wrapS=Pt,this.wrapT=Pt,this.minFilter=Qe,this.magFilter=Qe,this.generateMipmaps=!1,this.features=new qh}updateFrom(e,t){function n(x,S,p=-1){if(S in x&&x[S]){let g=Ic(x[S]);return h[g]}else return p}function r(x,S,p){return S in x?x[S]:p}function s(x,S,p,g){let y=x[S]&&x[S].isTexture?x[S]:null;if(y){y.matrixAutoUpdate&&y.updateMatrix();let T=y.matrix.elements,M=0;p[g+M++]=T[0],p[g+M++]=T[3],p[g+M++]=T[6],M++,p[g+M++]=T[1],p[g+M++]=T[4],p[g+M++]=T[7],M++}return 8}let o=0,a=e.length*Dc,l=Math.ceil(Math.sqrt(a))||1,{image:u,features:f}=this,h={};for(let x=0,S=t.length;x<S;x++)h[Ic(t[x])]=x;u.width!==l&&(this.dispose(),u.data=new Float32Array(l*l*4),u.width=l,u.height=l);let c=u.data;f.reset();for(let x=0,S=e.length;x<S;x++){let p=e[x];if(p.isFogVolumeMaterial){f.setUsed("FOG");for(let T=0;T<um;T++)c[o+T]=0;c[o+0+0]=p.color.r,c[o+0+1]=p.color.g,c[o+0+2]=p.color.b,c[o+8+3]=r(p,"emissiveIntensity",0),c[o+12+0]=p.emissive.r,c[o+12+1]=p.emissive.g,c[o+12+2]=p.emissive.b,c[o+52+1]=p.density,c[o+52+3]=0,c[o+56+2]=4,o+=um;continue}c[o++]=p.color.r,c[o++]=p.color.g,c[o++]=p.color.b,c[o++]=n(p,"map"),c[o++]=r(p,"metalness",0),c[o++]=n(p,"metalnessMap"),c[o++]=r(p,"roughness",0),c[o++]=n(p,"roughnessMap"),c[o++]=r(p,"ior",1.5),c[o++]=r(p,"transmission",0),c[o++]=n(p,"transmissionMap"),c[o++]=r(p,"emissiveIntensity",0),"emissive"in p?(c[o++]=p.emissive.r,c[o++]=p.emissive.g,c[o++]=p.emissive.b):(c[o++]=0,c[o++]=0,c[o++]=0),c[o++]=n(p,"emissiveMap"),c[o++]=n(p,"normalMap"),"normalScale"in p?(c[o++]=p.normalScale.x,c[o++]=p.normalScale.y):(c[o++]=1,c[o++]=1),c[o++]=r(p,"clearcoat",0),c[o++]=n(p,"clearcoatMap"),c[o++]=r(p,"clearcoatRoughness",0),c[o++]=n(p,"clearcoatRoughnessMap"),c[o++]=n(p,"clearcoatNormalMap"),"clearcoatNormalScale"in p?(c[o++]=p.clearcoatNormalScale.x,c[o++]=p.clearcoatNormalScale.y):(c[o++]=1,c[o++]=1),o++,c[o++]=r(p,"sheen",0),"sheenColor"in p?(c[o++]=p.sheenColor.r,c[o++]=p.sheenColor.g,c[o++]=p.sheenColor.b):(c[o++]=0,c[o++]=0,c[o++]=0),c[o++]=n(p,"sheenColorMap"),c[o++]=r(p,"sheenRoughness",0),c[o++]=n(p,"sheenRoughnessMap"),c[o++]=n(p,"iridescenceMap"),c[o++]=n(p,"iridescenceThicknessMap"),c[o++]=r(p,"iridescence",0),c[o++]=r(p,"iridescenceIOR",1.3);let g=r(p,"iridescenceThicknessRange",[100,400]);c[o++]=g[0],c[o++]=g[1],"specularColor"in p?(c[o++]=p.specularColor.r,c[o++]=p.specularColor.g,c[o++]=p.specularColor.b):(c[o++]=1,c[o++]=1,c[o++]=1),c[o++]=n(p,"specularColorMap"),c[o++]=r(p,"specularIntensity",1),c[o++]=n(p,"specularIntensityMap");let y=r(p,"thickness",0)===0&&r(p,"attenuationDistance",1/0)===1/0;if(c[o++]=Number(y),o++,"attenuationColor"in p?(c[o++]=p.attenuationColor.r,c[o++]=p.attenuationColor.g,c[o++]=p.attenuationColor.b):(c[o++]=1,c[o++]=1,c[o++]=1),c[o++]=r(p,"attenuationDistance",1/0),c[o++]=n(p,"alphaMap"),c[o++]=p.opacity,c[o++]=p.alphaTest,!y&&p.transmission>0)c[o++]=0;else switch(p.side){case En:c[o++]=1;break;case Kt:c[o++]=-1;break;case vn:c[o++]=0;break}c[o++]=Number(r(p,"matte",!1)),c[o++]=Number(r(p,"castShadow",!0)),c[o++]=Number(p.vertexColors)|Number(p.flatShading)<<1,c[o++]=Number(p.transparent),o+=s(p,"map",c,o),o+=s(p,"metalnessMap",c,o),o+=s(p,"roughnessMap",c,o),o+=s(p,"transmissionMap",c,o),o+=s(p,"emissiveMap",c,o),o+=s(p,"normalMap",c,o),o+=s(p,"clearcoatMap",c,o),o+=s(p,"clearcoatNormalMap",c,o),o+=s(p,"clearcoatRoughnessMap",c,o),o+=s(p,"sheenColorMap",c,o),o+=s(p,"sheenRoughnessMap",c,o),o+=s(p,"iridescenceMap",c,o),o+=s(p,"iridescenceThicknessMap",c,o),o+=s(p,"specularColorMap",c,o),o+=s(p,"specularIntensityMap",c,o),o+=s(p,"alphaMap",c,o)}let d=ws(c.buffer);return this.hash!==d?(this.hash=d,this.needsUpdate=!0,!0):!1}};var hm=new Je;function DS(i){return i?`${i.uuid}:${i.version}`:null}function LS(i,e){for(let t in e)t in i&&(i[t]=e[t])}var Oo=class extends Ws{constructor(e,t,n){let r={format:qe,type:sn,minFilter:lt,magFilter:lt,wrapS:rn,wrapT:rn,generateMipmaps:!1,...n};super(e,t,1,r),LS(this.texture,r),this.texture.setTextures=(...o)=>{this.setTextures(...o)},this.hashes=[null];let s=new kn(new Yh);this.fsQuad=s}setTextures(e,t,n=this.width,r=this.height){let s=e.getRenderTarget(),o=e.toneMapping,a=e.getClearAlpha();e.getClearColor(hm);let l=t.length||1;(n!==this.width||r!==this.height||this.depth!==l)&&(this.setSize(n,r,l),this.hashes=new Array(l).fill(null)),e.setClearColor(0,0),e.toneMapping=Ln;let u=this.fsQuad,f=this.hashes,h=!1;for(let c=0,d=l;c<d;c++){let x=t[c],S=DS(x);x&&(f[c]!==S||x.isWebGLRenderTarget)&&(x.matrixAutoUpdate=!1,x.matrix.identity(),u.material.map=x,e.setRenderTarget(this,c),u.render(e),x.updateMatrix(),x.matrixAutoUpdate=!0,f[c]=S,h=!0)}return u.material.map=null,e.setClearColor(hm,a),e.setRenderTarget(s),e.toneMapping=o,h}dispose(){super.dispose(),this.fsQuad.dispose()}},Yh=class extends $t{get map(){return this.uniforms.map.value}set map(e){this.uniforms.map.value=e}constructor(){super({uniforms:{map:{value:null}},vertexShader:`
				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,fragmentShader:`
				uniform sampler2D map;
				varying vec2 vUv;
				void main() {

					gl_FragColor = texture2D( map, vUv );

				}
			`})}};function FS(i,e=Math.random()){for(let t=i.length-1;t>0;t--){let n=Math.floor(e()*(t+1)),r=i[t];i[t]=i[n],i[n]=r}return i}var Lc=class{constructor(e,t,n=Math.random){let r=e**t,s=new Uint16Array(r),o=r;for(let a=0;a<r;a++)s[a]=a;this.samples=new Float32Array(t),this.strataCount=e,this.reset=function(){for(let a=0;a<r;a++)s[a]=a;o=0},this.reshuffle=function(){o=0},this.next=function(){let{samples:a}=this;o>=s.length&&(FS(s,n),this.reshuffle());let l=s[o++];for(let u=0;u<t;u++)a[u]=(l%e+n())/e,l=Math.floor(l/e);return a}}};var Fc=class{constructor(e,t,n=Math.random){let r=0;for(let l of t)r+=l;let s=new Float32Array(r),o=[],a=0;for(let l of t){let u=new Lc(e,l,n);u.samples=new Float32Array(s.buffer,a,u.samples.length),a+=u.samples.length*4,o.push(u)}this.samples=s,this.strataCount=e,this.next=function(){for(let l of o)l.next();return s},this.reshuffle=function(){for(let l of o)l.reshuffle()},this.reset=function(){for(let l of o)l.reset()}}};var Zh=class{constructor(e=0){this.m=2147483648,this.a=1103515245,this.c=12345,this.seed=e}nextInt(){return this.seed=(this.a*this.seed+this.c)%this.m,this.seed}nextFloat(){return this.nextInt()/(this.m-1)}},Nc=class extends Rt{constructor(e=1,t=1,n=8){super(new Float32Array(1),1,1,qe,tt),this.minFilter=Qe,this.magFilter=Qe,this.strata=n,this.sampler=null,this.generator=new Zh,this.stableNoise=!1,this.random=()=>this.stableNoise?this.generator.nextFloat():Math.random(),this.init(e,t,n)}init(e=this.image.height,t=this.image.width,n=this.strata){let{image:r}=this;if(r.width===t&&r.height===e&&this.sampler!==null)return;let s=new Array(e*t).fill(4),o=new Fc(n,s,this.random);r.width=t,r.height=e,r.data=o.samples,this.sampler=o,this.dispose(),this.next()}next(){this.sampler.next(),this.needsUpdate=!0}reset(){this.sampler.reset(),this.generator.seed=0}};function fm(i,e=Math.random){for(let t=i.length-1;t>0;t--){let n=~~((e()-1e-6)*t),r=i[t];i[t]=i[n],i[n]=r}}function dm(i,e){i.fill(0);for(let t=0;t<e;t++)i[t]=1}var Bo=class{constructor(e){this.count=0,this.size=-1,this.sigma=-1,this.radius=-1,this.lookupTable=null,this.score=null,this.binaryPattern=null,this.resize(e),this.setSigma(1.5)}findVoid(){let{score:e,binaryPattern:t}=this,n=1/0,r=-1;for(let s=0,o=t.length;s<o;s++){if(t[s]!==0)continue;let a=e[s];a<n&&(n=a,r=s)}return r}findCluster(){let{score:e,binaryPattern:t}=this,n=-1/0,r=-1;for(let s=0,o=t.length;s<o;s++){if(t[s]!==1)continue;let a=e[s];a>n&&(n=a,r=s)}return r}setSigma(e){if(e===this.sigma)return;let t=~~(Math.sqrt(20*e**2)+1),n=2*t+1,r=new Float32Array(n*n),s=e*e;for(let o=-t;o<=t;o++)for(let a=-t;a<=t;a++){let l=(t+a)*n+o+t,u=o*o+a*a;r[l]=Math.E**(-u/(2*s))}this.lookupTable=r,this.sigma=e,this.radius=t}resize(e){this.size!==e&&(this.size=e,this.score=new Float32Array(e*e),this.binaryPattern=new Uint8Array(e*e))}invert(){let{binaryPattern:e,score:t,size:n}=this;t.fill(0);for(let r=0,s=e.length;r<s;r++)if(e[r]===0){let o=~~(r/n),a=r-o*n;this.updateScore(a,o,1),e[r]=1}else e[r]=0}updateScore(e,t,n){let{size:r,score:s,lookupTable:o}=this,a=this.radius,l=2*a+1;for(let u=-a;u<=a;u++)for(let f=-a;f<=a;f++){let h=(a+f)*l+u+a,c=o[h],d=e+u;d=d<0?r+d:d%r;let x=t+f;x=x<0?r+x:x%r;let S=x*r+d;s[S]+=n*c}}addPointIndex(e){this.binaryPattern[e]=1;let t=this.size,n=~~(e/t),r=e-n*t;this.updateScore(r,n,1),this.count++}removePointIndex(e){this.binaryPattern[e]=0;let t=this.size,n=~~(e/t),r=e-n*t;this.updateScore(r,n,-1),this.count--}copy(e){this.resize(e.size),this.score.set(e.score),this.binaryPattern.set(e.binaryPattern),this.setSigma(e.sigma),this.count=e.count}};var Uc=class{constructor(){this.random=Math.random,this.sigma=1.5,this.size=64,this.majorityPointsRatio=.1,this.samples=new Bo(1),this.savedSamples=new Bo(1)}generate(){let{samples:e,savedSamples:t,sigma:n,majorityPointsRatio:r,size:s}=this;e.resize(s),e.setSigma(n);let o=Math.floor(s*s*r),a=e.binaryPattern;dm(a,o),fm(a,this.random);for(let h=0,c=a.length;h<c;h++)a[h]===1&&e.addPointIndex(h);for(;;){let h=e.findCluster();e.removePointIndex(h);let c=e.findVoid();if(h===c){e.addPointIndex(h);break}e.addPointIndex(c)}let l=new Uint32Array(s*s);t.copy(e);let u;for(u=e.count-1;u>=0;){let h=e.findCluster();e.removePointIndex(h),l[h]=u,u--}let f=s*s;for(u=t.count;u<f/2;){let h=t.findVoid();t.addPointIndex(h),l[h]=u,u++}for(t.invert();u<f;){let h=t.findCluster();t.removePointIndex(h),l[h]=u,u++}return{data:l,maxValue:f}}};function NS(i){return i>=3?4:i}function US(i){switch(i){case 1:return Rn;case 2:return an;default:return qe}}var Oc=class extends Rt{constructor(e=64,t=1){super(new Float32Array(4),1,1,qe,tt),this.minFilter=Qe,this.magFilter=Qe,this.size=e,this.channels=t,this.update()}update(){let e=this.channels,t=this.size,n=new Uc;n.channels=e,n.size=t;let r=NS(e),s=US(r);(this.image.width!==t||s!==this.format)&&(this.image.width=t,this.image.height=t,this.image.data=new Float32Array(t**2*r),this.format=s,this.dispose());let o=this.image.data;for(let a=0,l=e;a<l;a++){let u=n.generate(),f=u.data,h=u.maxValue;for(let c=0,d=f.length;c<d;c++){let x=f[c]/h;o[c*r+a]=x}}this.needsUpdate=!0}};var pm=`

	struct PhysicalCamera {

		float focusDistance;
		float anamorphicRatio;
		float bokehSize;
		int apertureBlades;
		float apertureRotation;

	};

`;var mm=`

	struct EquirectHdrInfo {

		sampler2D marginalWeights;
		sampler2D conditionalWeights;
		sampler2D map;

		float totalSum;

	};

`;var gm=`

	#define RECT_AREA_LIGHT_TYPE 0
	#define CIRC_AREA_LIGHT_TYPE 1
	#define SPOT_LIGHT_TYPE 2
	#define DIR_LIGHT_TYPE 3
	#define POINT_LIGHT_TYPE 4

	struct LightsInfo {

		sampler2D tex;
		uint count;

	};

	struct Light {

		vec3 position;
		int type;

		vec3 color;
		float intensity;

		vec3 u;
		vec3 v;
		float area;

		// spot light fields
		float radius;
		float near;
		float decay;
		float distance;
		float coneCos;
		float penumbraCos;
		int iesProfile;

	};

	Light readLightInfo( sampler2D tex, uint index ) {

		uint i = index * 6u;

		vec4 s0 = texelFetch1D( tex, i + 0u );
		vec4 s1 = texelFetch1D( tex, i + 1u );
		vec4 s2 = texelFetch1D( tex, i + 2u );
		vec4 s3 = texelFetch1D( tex, i + 3u );

		Light l;
		l.position = s0.rgb;
		l.type = int( round( s0.a ) );

		l.color = s1.rgb;
		l.intensity = s1.a;

		l.u = s2.rgb;
		l.v = s3.rgb;
		l.area = s3.a;

		if ( l.type == SPOT_LIGHT_TYPE || l.type == POINT_LIGHT_TYPE ) {

			vec4 s4 = texelFetch1D( tex, i + 4u );
			vec4 s5 = texelFetch1D( tex, i + 5u );
			l.radius = s4.r;
			l.decay = s4.g;
			l.distance = s4.b;
			l.coneCos = s4.a;

			l.penumbraCos = s5.r;
			l.iesProfile = int( round( s5.g ) );

		} else {

			l.radius = 0.0;
			l.decay = 0.0;
			l.distance = 0.0;

			l.coneCos = 0.0;
			l.penumbraCos = 0.0;
			l.iesProfile = - 1;

		}

		return l;

	}

`;var xm=`

	struct Material {

		vec3 color;
		int map;

		float metalness;
		int metalnessMap;

		float roughness;
		int roughnessMap;

		float ior;
		float transmission;
		int transmissionMap;

		float emissiveIntensity;
		vec3 emissive;
		int emissiveMap;

		int normalMap;
		vec2 normalScale;

		float clearcoat;
		int clearcoatMap;
		int clearcoatNormalMap;
		vec2 clearcoatNormalScale;
		float clearcoatRoughness;
		int clearcoatRoughnessMap;

		int iridescenceMap;
		int iridescenceThicknessMap;
		float iridescence;
		float iridescenceIor;
		float iridescenceThicknessMinimum;
		float iridescenceThicknessMaximum;

		vec3 specularColor;
		int specularColorMap;

		float specularIntensity;
		int specularIntensityMap;
		bool thinFilm;

		vec3 attenuationColor;
		float attenuationDistance;

		int alphaMap;

		bool castShadow;
		float opacity;
		float alphaTest;

		float side;
		bool matte;

		float sheen;
		vec3 sheenColor;
		int sheenColorMap;
		float sheenRoughness;
		int sheenRoughnessMap;

		bool vertexColors;
		bool flatShading;
		bool transparent;
		bool fogVolume;

		mat3 mapTransform;
		mat3 metalnessMapTransform;
		mat3 roughnessMapTransform;
		mat3 transmissionMapTransform;
		mat3 emissiveMapTransform;
		mat3 normalMapTransform;
		mat3 clearcoatMapTransform;
		mat3 clearcoatNormalMapTransform;
		mat3 clearcoatRoughnessMapTransform;
		mat3 sheenColorMapTransform;
		mat3 sheenRoughnessMapTransform;
		mat3 iridescenceMapTransform;
		mat3 iridescenceThicknessMapTransform;
		mat3 specularColorMapTransform;
		mat3 specularIntensityMapTransform;
		mat3 alphaMapTransform;

	};

	mat3 readTextureTransform( sampler2D tex, uint index ) {

		mat3 textureTransform;

		vec4 row1 = texelFetch1D( tex, index );
		vec4 row2 = texelFetch1D( tex, index + 1u );

		textureTransform[0] = vec3(row1.r, row2.r, 0.0);
		textureTransform[1] = vec3(row1.g, row2.g, 0.0);
		textureTransform[2] = vec3(row1.b, row2.b, 1.0);

		return textureTransform;

	}

	Material readMaterialInfo( sampler2D tex, uint index ) {

		uint i = index * uint( MATERIAL_PIXELS );

		vec4 s0 = texelFetch1D( tex, i + 0u );
		vec4 s1 = texelFetch1D( tex, i + 1u );
		vec4 s2 = texelFetch1D( tex, i + 2u );
		vec4 s3 = texelFetch1D( tex, i + 3u );
		vec4 s4 = texelFetch1D( tex, i + 4u );
		vec4 s5 = texelFetch1D( tex, i + 5u );
		vec4 s6 = texelFetch1D( tex, i + 6u );
		vec4 s7 = texelFetch1D( tex, i + 7u );
		vec4 s8 = texelFetch1D( tex, i + 8u );
		vec4 s9 = texelFetch1D( tex, i + 9u );
		vec4 s10 = texelFetch1D( tex, i + 10u );
		vec4 s11 = texelFetch1D( tex, i + 11u );
		vec4 s12 = texelFetch1D( tex, i + 12u );
		vec4 s13 = texelFetch1D( tex, i + 13u );
		vec4 s14 = texelFetch1D( tex, i + 14u );

		Material m;
		m.color = s0.rgb;
		m.map = int( round( s0.a ) );

		m.metalness = s1.r;
		m.metalnessMap = int( round( s1.g ) );
		m.roughness = s1.b;
		m.roughnessMap = int( round( s1.a ) );

		m.ior = s2.r;
		m.transmission = s2.g;
		m.transmissionMap = int( round( s2.b ) );
		m.emissiveIntensity = s2.a;

		m.emissive = s3.rgb;
		m.emissiveMap = int( round( s3.a ) );

		m.normalMap = int( round( s4.r ) );
		m.normalScale = s4.gb;

		m.clearcoat = s4.a;
		m.clearcoatMap = int( round( s5.r ) );
		m.clearcoatRoughness = s5.g;
		m.clearcoatRoughnessMap = int( round( s5.b ) );
		m.clearcoatNormalMap = int( round( s5.a ) );
		m.clearcoatNormalScale = s6.rg;

		m.sheen = s6.a;
		m.sheenColor = s7.rgb;
		m.sheenColorMap = int( round( s7.a ) );
		m.sheenRoughness = s8.r;
		m.sheenRoughnessMap = int( round( s8.g ) );

		m.iridescenceMap = int( round( s8.b ) );
		m.iridescenceThicknessMap = int( round( s8.a ) );
		m.iridescence = s9.r;
		m.iridescenceIor = s9.g;
		m.iridescenceThicknessMinimum = s9.b;
		m.iridescenceThicknessMaximum = s9.a;

		m.specularColor = s10.rgb;
		m.specularColorMap = int( round( s10.a ) );

		m.specularIntensity = s11.r;
		m.specularIntensityMap = int( round( s11.g ) );
		m.thinFilm = bool( s11.b );

		m.attenuationColor = s12.rgb;
		m.attenuationDistance = s12.a;

		m.alphaMap = int( round( s13.r ) );

		m.opacity = s13.g;
		m.alphaTest = s13.b;
		m.side = s13.a;

		m.matte = bool( s14.r );
		m.castShadow = bool( s14.g );
		m.vertexColors = bool( int( s14.b ) & 1 );
		m.flatShading = bool( int( s14.b ) & 2 );
		m.fogVolume = bool( int( s14.b ) & 4 );
		m.transparent = bool( s14.a );

		uint firstTextureTransformIdx = i + 15u;

		// mat3( 1.0 ) is an identity matrix
		m.mapTransform = m.map == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx );
		m.metalnessMapTransform = m.metalnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 2u );
		m.roughnessMapTransform = m.roughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 4u );
		m.transmissionMapTransform = m.transmissionMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 6u );
		m.emissiveMapTransform = m.emissiveMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 8u );
		m.normalMapTransform = m.normalMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 10u );
		m.clearcoatMapTransform = m.clearcoatMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 12u );
		m.clearcoatNormalMapTransform = m.clearcoatNormalMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 14u );
		m.clearcoatRoughnessMapTransform = m.clearcoatRoughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 16u );
		m.sheenColorMapTransform = m.sheenColorMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 18u );
		m.sheenRoughnessMapTransform = m.sheenRoughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 20u );
		m.iridescenceMapTransform = m.iridescenceMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 22u );
		m.iridescenceThicknessMapTransform = m.iridescenceThicknessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 24u );
		m.specularColorMapTransform = m.specularColorMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 26u );
		m.specularIntensityMapTransform = m.specularIntensityMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 28u );
		m.alphaMapTransform = m.alphaMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 30u );

		return m;

	}

`;var vm=`

	struct SurfaceRecord {

		// surface type
		bool volumeParticle;

		// geometry
		vec3 faceNormal;
		bool frontFace;
		vec3 normal;
		mat3 normalBasis;
		mat3 normalInvBasis;

		// cached properties
		float eta;
		float f0;

		// material
		float roughness;
		float filteredRoughness;
		float metalness;
		vec3 color;
		vec3 emission;

		// transmission
		float ior;
		float transmission;
		bool thinFilm;
		vec3 attenuationColor;
		float attenuationDistance;

		// clearcoat
		vec3 clearcoatNormal;
		mat3 clearcoatBasis;
		mat3 clearcoatInvBasis;
		float clearcoat;
		float clearcoatRoughness;
		float filteredClearcoatRoughness;

		// sheen
		float sheen;
		vec3 sheenColor;
		float sheenRoughness;

		// iridescence
		float iridescence;
		float iridescenceIor;
		float iridescenceThickness;

		// specular
		vec3 specularColor;
		float specularIntensity;
	};

	struct ScatterRecord {
		float specularPdf;
		float pdf;
		vec3 direction;
		vec3 color;
	};

`;var _m=`

	// samples the the given environment map in the given direction
	vec3 sampleEquirectColor( sampler2D envMap, vec3 direction ) {

		return texture2D( envMap, equirectDirectionToUv( direction ) ).rgb;

	}

	// gets the pdf of the given direction to sample
	float equirectDirectionPdf( vec3 direction ) {

		vec2 uv = equirectDirectionToUv( direction );
		float theta = uv.y * PI;
		float sinTheta = sin( theta );
		if ( sinTheta == 0.0 ) {

			return 0.0;

		}

		return 1.0 / ( 2.0 * PI * PI * sinTheta );

	}

	// samples the color given env map with CDF and returns the pdf of the direction
	float sampleEquirect( vec3 direction, inout vec3 color ) {

		float totalSum = envMapInfo.totalSum;
		if ( totalSum == 0.0 ) {

			color = vec3( 0.0 );
			return 1.0;

		}

		vec2 uv = equirectDirectionToUv( direction );
		color = texture2D( envMapInfo.map, uv ).rgb;

		float lum = luminance( color );
		ivec2 resolution = textureSize( envMapInfo.map, 0 );
		float pdf = lum / totalSum;

		return float( resolution.x * resolution.y ) * pdf * equirectDirectionPdf( direction );

	}

	// samples a direction of the envmap with color and retrieves pdf
	float sampleEquirectProbability( vec2 r, inout vec3 color, inout vec3 direction ) {

		// sample env map cdf
		float v = texture2D( envMapInfo.marginalWeights, vec2( r.x, 0.0 ) ).x;
		float u = texture2D( envMapInfo.conditionalWeights, vec2( r.y, v ) ).x;
		vec2 uv = vec2( u, v );

		vec3 derivedDirection = equirectUvToDirection( uv );
		direction = derivedDirection;
		color = texture2D( envMapInfo.map, uv ).rgb;

		float totalSum = envMapInfo.totalSum;
		float lum = luminance( color );
		ivec2 resolution = textureSize( envMapInfo.map, 0 );
		float pdf = lum / totalSum;

		return float( resolution.x * resolution.y ) * pdf * equirectDirectionPdf( direction );

	}
`;var ym=`

	float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {

		return smoothstep( coneCosine, penumbraCosine, angleCosine );

	}

	float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {

		// based upon Frostbite 3 Moving to Physically-based Rendering
		// page 32, equation 26: E[window1]
		// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), EPSILON );

		if ( cutoffDistance > 0.0 ) {

			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );

		}

		return distanceFalloff;

	}

	float getPhotometricAttenuation( sampler2DArray iesProfiles, int iesProfile, vec3 posToLight, vec3 lightDir, vec3 u, vec3 v ) {

		float cosTheta = dot( posToLight, lightDir );
		float angle = acos( cosTheta ) / PI;

		return texture2D( iesProfiles, vec3( angle, 0.0, iesProfile ) ).r;

	}

	struct LightRecord {

		float dist;
		vec3 direction;
		float pdf;
		vec3 emission;
		int type;

	};

	bool intersectLightAtIndex( sampler2D lights, vec3 rayOrigin, vec3 rayDirection, uint l, inout LightRecord lightRec ) {

		bool didHit = false;
		Light light = readLightInfo( lights, l );

		vec3 u = light.u;
		vec3 v = light.v;

		// check for backface
		vec3 normal = normalize( cross( u, v ) );
		if ( dot( normal, rayDirection ) > 0.0 ) {

			u *= 1.0 / dot( u, u );
			v *= 1.0 / dot( v, v );

			float dist;

			// MIS / light intersection is not supported for punctual lights.
			if(
				( light.type == RECT_AREA_LIGHT_TYPE && intersectsRectangle( light.position, normal, u, v, rayOrigin, rayDirection, dist ) ) ||
				( light.type == CIRC_AREA_LIGHT_TYPE && intersectsCircle( light.position, normal, u, v, rayOrigin, rayDirection, dist ) )
			) {

				float cosTheta = dot( rayDirection, normal );
				didHit = true;
				lightRec.dist = dist;
				lightRec.pdf = ( dist * dist ) / ( light.area * cosTheta );
				lightRec.emission = light.color * light.intensity;
				lightRec.direction = rayDirection;
				lightRec.type = light.type;

			}

		}

		return didHit;

	}

	LightRecord randomAreaLightSample( Light light, vec3 rayOrigin, vec2 ruv ) {

		vec3 randomPos;
		if( light.type == RECT_AREA_LIGHT_TYPE ) {

			// rectangular area light
			randomPos = light.position + light.u * ( ruv.x - 0.5 ) + light.v * ( ruv.y - 0.5 );

		} else if( light.type == CIRC_AREA_LIGHT_TYPE ) {

			// circular area light
			float r = 0.5 * sqrt( ruv.x );
			float theta = ruv.y * 2.0 * PI;
			float x = r * cos( theta );
			float y = r * sin( theta );

			randomPos = light.position + light.u * x + light.v * y;

		}

		vec3 toLight = randomPos - rayOrigin;
		float lightDistSq = dot( toLight, toLight );
		float dist = sqrt( lightDistSq );
		vec3 direction = toLight / dist;
		vec3 lightNormal = normalize( cross( light.u, light.v ) );

		LightRecord lightRec;
		lightRec.type = light.type;
		lightRec.emission = light.color * light.intensity;
		lightRec.dist = dist;
		lightRec.direction = direction;

		// TODO: the denominator is potentially zero
		lightRec.pdf = lightDistSq / ( light.area * dot( direction, lightNormal ) );

		return lightRec;

	}

	LightRecord randomSpotLightSample( Light light, sampler2DArray iesProfiles, vec3 rayOrigin, vec2 ruv ) {

		float radius = light.radius * sqrt( ruv.x );
		float theta = ruv.y * 2.0 * PI;
		float x = radius * cos( theta );
		float y = radius * sin( theta );

		vec3 u = light.u;
		vec3 v = light.v;
		vec3 normal = normalize( cross( u, v ) );

		float angle = acos( light.coneCos );
		float angleTan = tan( angle );
		float startDistance = light.radius / max( angleTan, EPSILON );

		vec3 randomPos = light.position - normal * startDistance + u * x + v * y;
		vec3 toLight = randomPos - rayOrigin;
		float lightDistSq = dot( toLight, toLight );
		float dist = sqrt( lightDistSq );

		vec3 direction = toLight / max( dist, EPSILON );
		float cosTheta = dot( direction, normal );

		float spotAttenuation = light.iesProfile != - 1 ?
			getPhotometricAttenuation( iesProfiles, light.iesProfile, direction, normal, u, v ) :
			getSpotAttenuation( light.coneCos, light.penumbraCos, cosTheta );

		float distanceAttenuation = getDistanceAttenuation( dist, light.distance, light.decay );
		LightRecord lightRec;
		lightRec.type = light.type;
		lightRec.dist = dist;
		lightRec.direction = direction;
		lightRec.emission = light.color * light.intensity * distanceAttenuation * spotAttenuation;
		lightRec.pdf = 1.0;

		return lightRec;

	}

	LightRecord randomLightSample( sampler2D lights, sampler2DArray iesProfiles, uint lightCount, vec3 rayOrigin, vec3 ruv ) {

		LightRecord result;

		// pick a random light
		uint l = uint( ruv.x * float( lightCount ) );
		Light light = readLightInfo( lights, l );

		if ( light.type == SPOT_LIGHT_TYPE ) {

			result = randomSpotLightSample( light, iesProfiles, rayOrigin, ruv.yz );

		} else if ( light.type == POINT_LIGHT_TYPE ) {

			vec3 lightRay = light.u - rayOrigin;
			float lightDist = length( lightRay );
			float cutoffDistance = light.distance;
			float distanceFalloff = 1.0 / max( pow( lightDist, light.decay ), 0.01 );
			if ( cutoffDistance > 0.0 ) {

				distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDist / cutoffDistance ) ) );

			}

			LightRecord rec;
			rec.direction = normalize( lightRay );
			rec.dist = length( lightRay );
			rec.pdf = 1.0;
			rec.emission = light.color * light.intensity * distanceFalloff;
			rec.type = light.type;
			result = rec;

		} else if ( light.type == DIR_LIGHT_TYPE ) {

			LightRecord rec;
			rec.dist = 1e10;
			rec.direction = light.u;
			rec.pdf = 1.0;
			rec.emission = light.color * light.intensity;
			rec.type = light.type;

			result = rec;

		} else {

			// sample the light
			result = randomAreaLightSample( light, rayOrigin, ruv.yz );

		}

		return result;

	}

`;var Sm=`

	vec3 sampleHemisphere( vec3 n, vec2 uv ) {

		// https://www.rorydriscoll.com/2009/01/07/better-sampling/
		// https://graphics.pixar.com/library/OrthonormalB/paper.pdf
		float sign = n.z == 0.0 ? 1.0 : sign( n.z );
		float a = - 1.0 / ( sign + n.z );
		float b = n.x * n.y * a;
		vec3 b1 = vec3( 1.0 + sign * n.x * n.x * a, sign * b, - sign * n.x );
		vec3 b2 = vec3( b, sign + n.y * n.y * a, - n.y );

		float r = sqrt( uv.x );
		float theta = 2.0 * PI * uv.y;
		float x = r * cos( theta );
		float y = r * sin( theta );
		return x * b1 + y * b2 + sqrt( 1.0 - uv.x ) * n;

	}

	vec2 sampleTriangle( vec2 a, vec2 b, vec2 c, vec2 r ) {

		// get the edges of the triangle and the diagonal across the
		// center of the parallelogram
		vec2 e1 = a - b;
		vec2 e2 = c - b;
		vec2 diag = normalize( e1 + e2 );

		// pick the point in the parallelogram
		if ( r.x + r.y > 1.0 ) {

			r = vec2( 1.0 ) - r;

		}

		return e1 * r.x + e2 * r.y;

	}

	vec2 sampleCircle( vec2 uv ) {

		float angle = 2.0 * PI * uv.x;
		float radius = sqrt( uv.y );
		return vec2( cos( angle ), sin( angle ) ) * radius;

	}

	vec3 sampleSphere( vec2 uv ) {

		float u = ( uv.x - 0.5 ) * 2.0;
		float t = uv.y * PI * 2.0;
		float f = sqrt( 1.0 - u * u );

		return vec3( f * cos( t ), f * sin( t ), u );

	}

	vec2 sampleRegularPolygon( int sides, vec3 uvw ) {

		sides = max( sides, 3 );

		vec3 r = uvw;
		float anglePerSegment = 2.0 * PI / float( sides );
		float segment = floor( float( sides ) * r.x );

		float angle1 = anglePerSegment * segment;
		float angle2 = angle1 + anglePerSegment;
		vec2 a = vec2( sin( angle1 ), cos( angle1 ) );
		vec2 b = vec2( 0.0, 0.0 );
		vec2 c = vec2( sin( angle2 ), cos( angle2 ) );

		return sampleTriangle( a, b, c, r.yz );

	}

	// samples an aperture shape with the given number of sides. 0 means circle
	vec2 sampleAperture( int blades, vec3 uvw ) {

		return blades == 0 ?
			sampleCircle( uvw.xy ) :
			sampleRegularPolygon( blades, uvw );

	}


`;var bm=`

	bool totalInternalReflection( float cosTheta, float eta ) {

		float sinTheta = sqrt( 1.0 - cosTheta * cosTheta );
		return eta * sinTheta > 1.0;

	}

	// https://google.github.io/filament/Filament.md.html#materialsystem/diffusebrdf
	float schlickFresnel( float cosine, float f0 ) {

		return f0 + ( 1.0 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	vec3 schlickFresnel( float cosine, vec3 f0 ) {

		return f0 + ( 1.0 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	vec3 schlickFresnel( float cosine, vec3 f0, vec3 f90 ) {

		return f0 + ( f90 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	float dielectricFresnel( float cosThetaI, float eta ) {

		// https://schuttejoe.github.io/post/disneybsdf/
		float ni = eta;
		float nt = 1.0;

		// Check for total internal reflection
		float sinThetaISq = 1.0f - cosThetaI * cosThetaI;
		float sinThetaTSq = eta * eta * sinThetaISq;
		if( sinThetaTSq >= 1.0 ) {

			return 1.0;

		}

		float sinThetaT = sqrt( sinThetaTSq );

		float cosThetaT = sqrt( max( 0.0, 1.0f - sinThetaT * sinThetaT ) );
		float rParallel = ( ( nt * cosThetaI ) - ( ni * cosThetaT ) ) / ( ( nt * cosThetaI ) + ( ni * cosThetaT ) );
		float rPerpendicular = ( ( ni * cosThetaI ) - ( nt * cosThetaT ) ) / ( ( ni * cosThetaI ) + ( nt * cosThetaT ) );
		return ( rParallel * rParallel + rPerpendicular * rPerpendicular ) / 2.0;

	}

	// https://raytracing.github.io/books/RayTracingInOneWeekend.html#dielectrics/schlickapproximation
	float iorRatioToF0( float eta ) {

		return pow( ( 1.0 - eta ) / ( 1.0 + eta ), 2.0 );

	}

	vec3 evaluateFresnel( float cosTheta, float eta, vec3 f0, vec3 f90 ) {

		if ( totalInternalReflection( cosTheta, eta ) ) {

			return f90;

		}

		return schlickFresnel( cosTheta, f0, f90 );

	}

	// TODO: disney fresnel was removed and replaced with this fresnel function to better align with
	// the glTF but is causing blown out pixels. Should be revisited
	// float evaluateFresnelWeight( float cosTheta, float eta, float f0 ) {

	// 	if ( totalInternalReflection( cosTheta, eta ) ) {

	// 		return 1.0;

	// 	}

	// 	return schlickFresnel( cosTheta, f0 );

	// }

	// https://schuttejoe.github.io/post/disneybsdf/
	float disneyFresnel( vec3 wo, vec3 wi, vec3 wh, float f0, float eta, float metalness ) {

		float dotHV = dot( wo, wh );
		if ( totalInternalReflection( dotHV, eta ) ) {

			return 1.0;

		}

		float dotHL = dot( wi, wh );
		float dielectricFresnel = dielectricFresnel( abs( dotHV ), eta );
		float metallicFresnel = schlickFresnel( dotHL, f0 );

		return mix( dielectricFresnel, metallicFresnel, metalness );

	}

`;var Mm=`

	// Fast arccos approximation used to remove banding artifacts caused by numerical errors in acos.
	// This is a cubic Lagrange interpolating polynomial for x = [-1, -1/2, 0, 1/2, 1].
	// For more information see: https://github.com/gkjohnson/three-gpu-pathtracer/pull/171#issuecomment-1152275248
	float acosApprox( float x ) {

		x = clamp( x, -1.0, 1.0 );
		return ( - 0.69813170079773212 * x * x - 0.87266462599716477 ) * x + 1.5707963267948966;

	}

	// An acos with input values bound to the range [-1, 1].
	float acosSafe( float x ) {

		return acos( clamp( x, -1.0, 1.0 ) );

	}

	float saturateCos( float val ) {

		return clamp( val, 0.001, 1.0 );

	}

	float square( float t ) {

		return t * t;

	}

	vec2 square( vec2 t ) {

		return t * t;

	}

	vec3 square( vec3 t ) {

		return t * t;

	}

	vec4 square( vec4 t ) {

		return t * t;

	}

	vec2 rotateVector( vec2 v, float t ) {

		float ac = cos( t );
		float as = sin( t );
		return vec2(
			v.x * ac - v.y * as,
			v.x * as + v.y * ac
		);

	}

	// forms a basis with the normal vector as Z
	mat3 getBasisFromNormal( vec3 normal ) {

		vec3 other;
		if ( abs( normal.x ) > 0.5 ) {

			other = vec3( 0.0, 1.0, 0.0 );

		} else {

			other = vec3( 1.0, 0.0, 0.0 );

		}

		vec3 ortho = normalize( cross( normal, other ) );
		vec3 ortho2 = normalize( cross( normal, ortho ) );
		return mat3( ortho2, ortho, normal );

	}

`;var Tm=`

	// Finds the point where the ray intersects the plane defined by u and v and checks if this point
	// falls in the bounds of the rectangle on that same plane.
	// Plane intersection: https://lousodrome.net/blog/light/2020/07/03/intersection-of-a-ray-and-a-plane/
	bool intersectsRectangle( vec3 center, vec3 normal, vec3 u, vec3 v, vec3 rayOrigin, vec3 rayDirection, inout float dist ) {

		float t = dot( center - rayOrigin, normal ) / dot( rayDirection, normal );

		if ( t > EPSILON ) {

			vec3 p = rayOrigin + rayDirection * t;
			vec3 vi = p - center;

			// check if p falls inside the rectangle
			float a1 = dot( u, vi );
			if ( abs( a1 ) <= 0.5 ) {

				float a2 = dot( v, vi );
				if ( abs( a2 ) <= 0.5 ) {

					dist = t;
					return true;

				}

			}

		}

		return false;

	}

	// Finds the point where the ray intersects the plane defined by u and v and checks if this point
	// falls in the bounds of the circle on that same plane. See above URL for a description of the plane intersection algorithm.
	bool intersectsCircle( vec3 position, vec3 normal, vec3 u, vec3 v, vec3 rayOrigin, vec3 rayDirection, inout float dist ) {

		float t = dot( position - rayOrigin, normal ) / dot( rayDirection, normal );

		if ( t > EPSILON ) {

			vec3 hit = rayOrigin + rayDirection * t;
			vec3 vi = hit - position;

			float a1 = dot( u, vi );
			float a2 = dot( v, vi );

			if( length( vec2( a1, a2 ) ) <= 0.5 ) {

				dist = t;
				return true;

			}

		}

		return false;

	}

`;var wm=`

	// add texel fetch functions for texture arrays
	vec4 texelFetch1D( sampler2DArray tex, int layer, uint index ) {

		uint width = uint( textureSize( tex, 0 ).x );
		uvec2 uv;
		uv.x = index % width;
		uv.y = index / width;

		return texelFetch( tex, ivec3( uv, layer ), 0 );

	}

	vec4 textureSampleBarycoord( sampler2DArray tex, int layer, vec3 barycoord, uvec3 faceIndices ) {

		return
			barycoord.x * texelFetch1D( tex, layer, faceIndices.x ) +
			barycoord.y * texelFetch1D( tex, layer, faceIndices.y ) +
			barycoord.z * texelFetch1D( tex, layer, faceIndices.z );

	}

`;var Bc=`

	// TODO: possibly this should be renamed something related to material or path tracing logic

	#ifndef RAY_OFFSET
	#define RAY_OFFSET 1e-4
	#endif

	// adjust the hit point by the surface normal by a factor of some offset and the
	// maximum component-wise value of the current point to accommodate floating point
	// error as values increase.
	vec3 stepRayOrigin( vec3 rayOrigin, vec3 rayDirection, vec3 offset, float dist ) {

		vec3 point = rayOrigin + rayDirection * dist;
		vec3 absPoint = abs( point );
		float maxPoint = max( absPoint.x, max( absPoint.y, absPoint.z ) );
		return point + offset * ( maxPoint + 1.0 ) * RAY_OFFSET;

	}

	// https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_volume/README.md#attenuation
	vec3 transmissionAttenuation( float dist, vec3 attColor, float attDist ) {

		vec3 ot = - log( attColor ) / attDist;
		return exp( - ot * dist );

	}

	vec3 getHalfVector( vec3 wi, vec3 wo, float eta ) {

		// get the half vector - assuming if the light incident vector is on the other side
		// of the that it's transmissive.
		vec3 h;
		if ( wi.z > 0.0 ) {

			h = normalize( wi + wo );

		} else {

			// Scale by the ior ratio to retrieve the appropriate half vector
			// From Section 2.2 on computing the transmission half vector:
			// https://blog.selfshadow.com/publications/s2015-shading-course/burley/s2015_pbs_disney_bsdf_notes.pdf
			h = normalize( wi + wo * eta );

		}

		h *= sign( h.z );
		return h;

	}

	vec3 getHalfVector( vec3 a, vec3 b ) {

		return normalize( a + b );

	}

	// The discrepancy between interpolated surface normal and geometry normal can cause issues when a ray
	// is cast that is on the top side of the geometry normal plane but below the surface normal plane. If
	// we find a ray like that we ignore it to avoid artifacts.
	// This function returns if the direction is on the same side of both planes.
	bool isDirectionValid( vec3 direction, vec3 surfaceNormal, vec3 geometryNormal ) {

		bool aboveSurfaceNormal = dot( direction, surfaceNormal ) > 0.0;
		bool aboveGeometryNormal = dot( direction, geometryNormal ) > 0.0;
		return aboveSurfaceNormal == aboveGeometryNormal;

	}

	// ray sampling x and z are swapped to align with expected background view
	vec2 equirectDirectionToUv( vec3 direction ) {

		// from Spherical.setFromCartesianCoords
		vec2 uv = vec2( atan( direction.z, direction.x ), acos( direction.y ) );
		uv /= vec2( 2.0 * PI, PI );

		// apply adjustments to get values in range [0, 1] and y right side up
		uv.x += 0.5;
		uv.y = 1.0 - uv.y;
		return uv;

	}

	vec3 equirectUvToDirection( vec2 uv ) {

		// undo above adjustments
		uv.x -= 0.5;
		uv.y = 1.0 - uv.y;

		// from Vector3.setFromSphericalCoords
		float theta = uv.x * 2.0 * PI;
		float phi = uv.y * PI;

		float sinPhi = sin( phi );

		return vec3( sinPhi * cos( theta ), cos( phi ), sinPhi * sin( theta ) );

	}

	// power heuristic for multiple importance sampling
	float misHeuristic( float a, float b ) {

		float aa = a * a;
		float bb = b * b;
		return aa / ( aa + bb );

	}

	// tentFilter from Peter Shirley's 'Realistic Ray Tracing (2nd Edition)' book, pg. 60
	// erichlof/THREE.js-PathTracing-Renderer/
	float tentFilter( float x ) {

		return x < 0.5 ? sqrt( 2.0 * x ) - 1.0 : 1.0 - sqrt( 2.0 - ( 2.0 * x ) );

	}
`;var $h=`

	// https://www.shadertoy.com/view/wltcRS
	uvec4 WHITE_NOISE_SEED;

	void rng_initialize( vec2 p, int frame ) {

		// white noise seed
		WHITE_NOISE_SEED = uvec4( p, uint( frame ), uint( p.x ) + uint( p.y ) );

	}

	// https://www.pcg-random.org/
	void pcg4d( inout uvec4 v ) {

		v = v * 1664525u + 1013904223u;
		v.x += v.y * v.w;
		v.y += v.z * v.x;
		v.z += v.x * v.y;
		v.w += v.y * v.z;
		v = v ^ ( v >> 16u );
		v.x += v.y*v.w;
		v.y += v.z*v.x;
		v.z += v.x*v.y;
		v.w += v.y*v.z;

	}

	// returns [ 0, 1 ]
	float pcgRand() {

		pcg4d( WHITE_NOISE_SEED );
		return float( WHITE_NOISE_SEED.x ) / float( 0xffffffffu );

	}

	vec2 pcgRand2() {

		pcg4d( WHITE_NOISE_SEED );
		return vec2( WHITE_NOISE_SEED.xy ) / float(0xffffffffu);

	}

	vec3 pcgRand3() {

		pcg4d( WHITE_NOISE_SEED );
		return vec3( WHITE_NOISE_SEED.xyz ) / float( 0xffffffffu );

	}

	vec4 pcgRand4() {

		pcg4d( WHITE_NOISE_SEED );
		return vec4( WHITE_NOISE_SEED ) / float( 0xffffffffu );

	}
`;var Am=`

	uniform sampler2D stratifiedTexture;
	uniform sampler2D stratifiedOffsetTexture;

	uint sobolPixelIndex = 0u;
	uint sobolPathIndex = 0u;
	uint sobolBounceIndex = 0u;
	vec4 pixelSeed = vec4( 0 );

	vec4 rand4( int v ) {

		ivec2 uv = ivec2( v, sobolBounceIndex );
		vec4 stratifiedSample = texelFetch( stratifiedTexture, uv, 0 );
		return fract( stratifiedSample + pixelSeed.r ); // blue noise + stratified samples

	}

	vec3 rand3( int v ) {

		return rand4( v ).xyz;

	}

	vec2 rand2( int v ) {

		return rand4( v ).xy;

	}

	float rand( int v ) {

		return rand4( v ).x;

	}

	void rng_initialize( vec2 screenCoord, int frame ) {

		// tile the small noise texture across the entire screen
		ivec2 noiseSize = ivec2( textureSize( stratifiedOffsetTexture, 0 ) );
		ivec2 pixel = ivec2( screenCoord.xy ) % noiseSize;
		vec2 pixelWidth = 1.0 / vec2( noiseSize );
		vec2 uv = vec2( pixel ) * pixelWidth + pixelWidth * 0.5;

		// note that using "texelFetch" here seems to break Android for some reason
		pixelSeed = texture( stratifiedOffsetTexture, uv );

	}

`;var Em=`

	// diffuse
	float diffuseEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// https://schuttejoe.github.io/post/disneybsdf/
		float fl = schlickFresnel( wi.z, 0.0 );
		float fv = schlickFresnel( wo.z, 0.0 );

		float metalFactor = ( 1.0 - surf.metalness );
		float transFactor = ( 1.0 - surf.transmission );
		float rr = 0.5 + 2.0 * surf.roughness * fl * fl;
		float retro = rr * ( fl + fv + fl * fv * ( rr - 1.0f ) );
		float lambert = ( 1.0f - 0.5f * fl ) * ( 1.0f - 0.5f * fv );

		// TODO: subsurface approx?

		// float F = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		float F = disneyFresnel( wo, wi, wh, surf.f0, surf.eta, surf.metalness );
		color = ( 1.0 - F ) * transFactor * metalFactor * wi.z * surf.color * ( retro + lambert ) / PI;

		return wi.z / PI;

	}

	vec3 diffuseDirection( vec3 wo, SurfaceRecord surf ) {

		vec3 lightDirection = sampleSphere( rand2( 11 ) );
		lightDirection.z += 1.0;
		lightDirection = normalize( lightDirection );

		return lightDirection;

	}

	// specular
	float specularEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// if roughness is set to 0 then D === NaN which results in black pixels
		float metalness = surf.metalness;
		float roughness = surf.filteredRoughness;

		float eta = surf.eta;
		float f0 = surf.f0;

		vec3 f0Color = mix( f0 * surf.specularColor * surf.specularIntensity, surf.color, surf.metalness );
		vec3 f90Color = vec3( mix( surf.specularIntensity, 1.0, surf.metalness ) );
		vec3 F = evaluateFresnel( dot( wo, wh ), eta, f0Color, f90Color );

		vec3 iridescenceF = evalIridescence( 1.0, surf.iridescenceIor, dot( wi, wh ), surf.iridescenceThickness, f0Color );
		F = mix( F, iridescenceF,  surf.iridescence );

		// PDF
		// See 14.1.1 Microfacet BxDFs in https://www.pbr-book.org/
		float incidentTheta = acos( wo.z );
		float G = ggxShadowMaskG2( wi, wo, roughness );
		float D = ggxDistribution( wh, roughness );
		float G1 = ggxShadowMaskG1( incidentTheta, roughness );
		float ggxPdf = D * G1 * max( 0.0, abs( dot( wo, wh ) ) ) / abs ( wo.z );

		color = wi.z * F * G * D / ( 4.0 * abs( wi.z * wo.z ) );
		return ggxPdf / ( 4.0 * dot( wo, wh ) );

	}

	vec3 specularDirection( vec3 wo, SurfaceRecord surf ) {

		// sample ggx vndf distribution which gives a new normal
		float roughness = surf.filteredRoughness;
		vec3 halfVector = ggxDirection(
			wo,
			vec2( roughness ),
			rand2( 12 )
		);

		// apply to new ray by reflecting off the new normal
		return - reflect( wo, halfVector );

	}


	// transmission
	/*
	float transmissionEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// See section 4.2 in https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf

		float filteredRoughness = surf.filteredRoughness;
		float eta = surf.eta;
		bool frontFace = surf.frontFace;
		bool thinFilm = surf.thinFilm;

		color = surf.transmission * surf.color;

		float denom = pow( eta * dot( wi, wh ) + dot( wo, wh ), 2.0 );
		return ggxPDF( wo, wh, filteredRoughness ) / denom;

	}

	vec3 transmissionDirection( vec3 wo, SurfaceRecord surf ) {

		float filteredRoughness = surf.filteredRoughness;
		float eta = surf.eta;
		bool frontFace = surf.frontFace;

		// sample ggx vndf distribution which gives a new normal
		vec3 halfVector = ggxDirection(
			wo,
			vec2( filteredRoughness ),
			rand2( 13 )
		);

		vec3 lightDirection = refract( normalize( - wo ), halfVector, eta );
		if ( surf.thinFilm ) {

			lightDirection = - refract( normalize( - lightDirection ), - vec3( 0.0, 0.0, 1.0 ), 1.0 / eta );

		}

		return normalize( lightDirection );

	}
	*/

	// TODO: This is just using a basic cosine-weighted specular distribution with an
	// incorrect PDF value at the moment. Update it to correctly use a GGX distribution
	float transmissionEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		color = surf.transmission * surf.color;

		// PDF
		// float F = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		// float F = disneyFresnel( wo, wi, wh, surf.f0, surf.eta, surf.metalness );
		// if ( F >= 1.0 ) {

		// 	return 0.0;

		// }

		// return 1.0 / ( 1.0 - F );

		// reverted to previous to transmission. The above was causing black pixels
		float eta = surf.eta;
		float f0 = surf.f0;
		float cosTheta = min( wo.z, 1.0 );
		float sinTheta = sqrt( 1.0 - cosTheta * cosTheta );
		float reflectance = schlickFresnel( cosTheta, f0 );
		bool cannotRefract = eta * sinTheta > 1.0;
		if ( cannotRefract ) {

			return 0.0;

		}

		return 1.0 / ( 1.0 - reflectance );

	}

	vec3 transmissionDirection( vec3 wo, SurfaceRecord surf ) {

		float roughness = surf.filteredRoughness;
		float eta = surf.eta;
		vec3 halfVector = normalize( vec3( 0.0, 0.0, 1.0 ) + sampleSphere( rand2( 13 ) ) * roughness );
		vec3 lightDirection = refract( normalize( - wo ), halfVector, eta );

		if ( surf.thinFilm ) {

			lightDirection = - refract( normalize( - lightDirection ), - vec3( 0.0, 0.0, 1.0 ), 1.0 / eta );

		}
		return normalize( lightDirection );

	}

	// clearcoat
	float clearcoatEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		float ior = 1.5;
		float f0 = iorRatioToF0( ior );
		bool frontFace = surf.frontFace;
		float roughness = surf.filteredClearcoatRoughness;

		float eta = frontFace ? 1.0 / ior : ior;
		float G = ggxShadowMaskG2( wi, wo, roughness );
		float D = ggxDistribution( wh, roughness );
		float F = schlickFresnel( dot( wi, wh ), f0 );

		float fClearcoat = F * D * G / ( 4.0 * abs( wi.z * wo.z ) );
		color = color * ( 1.0 - surf.clearcoat * F ) + fClearcoat * surf.clearcoat * wi.z;

		// PDF
		// See equation (27) in http://jcgt.org/published/0003/02/03/
		return ggxPDF( wo, wh, roughness ) / ( 4.0 * dot( wi, wh ) );

	}

	vec3 clearcoatDirection( vec3 wo, SurfaceRecord surf ) {

		// sample ggx vndf distribution which gives a new normal
		float roughness = surf.filteredClearcoatRoughness;
		vec3 halfVector = ggxDirection(
			wo,
			vec2( roughness ),
			rand2( 14 )
		);

		// apply to new ray by reflecting off the new normal
		return - reflect( wo, halfVector );

	}

	// sheen
	vec3 sheenColor( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf ) {

		float cosThetaO = saturateCos( wo.z );
		float cosThetaI = saturateCos( wi.z );
		float cosThetaH = wh.z;

		float D = velvetD( cosThetaH, surf.sheenRoughness );
		float G = velvetG( cosThetaO, cosThetaI, surf.sheenRoughness );

		// See equation (1) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
		vec3 color = surf.sheenColor;
		color *= D * G / ( 4.0 * abs( cosThetaO * cosThetaI ) );

		return color;

	}

	// bsdf
	void getLobeWeights(
		vec3 wo, vec3 wi, vec3 wh, vec3 clearcoatWo, SurfaceRecord surf,
		inout float diffuseWeight, inout float specularWeight, inout float transmissionWeight, inout float clearcoatWeight
	) {

		float metalness = surf.metalness;
		float transmission = surf.transmission;
		// float fEstimate = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		float fEstimate = disneyFresnel( wo, wi, wh, surf.f0, surf.eta, surf.metalness );

		float transSpecularProb = mix( max( 0.25, fEstimate ), 1.0, metalness );
		float diffSpecularProb = 0.5 + 0.5 * metalness;

		diffuseWeight = ( 1.0 - transmission ) * ( 1.0 - diffSpecularProb );
		specularWeight = transmission * transSpecularProb + ( 1.0 - transmission ) * diffSpecularProb;
		transmissionWeight = transmission * ( 1.0 - transSpecularProb );
		clearcoatWeight = surf.clearcoat * schlickFresnel( clearcoatWo.z, 0.04 );

		float totalWeight = diffuseWeight + specularWeight + transmissionWeight + clearcoatWeight;
		diffuseWeight /= totalWeight;
		specularWeight /= totalWeight;
		transmissionWeight /= totalWeight;
		clearcoatWeight /= totalWeight;
	}

	float bsdfEval(
		vec3 wo, vec3 clearcoatWo, vec3 wi, vec3 clearcoatWi, SurfaceRecord surf,
		float diffuseWeight, float specularWeight, float transmissionWeight, float clearcoatWeight, inout float specularPdf, inout vec3 color
	) {

		float metalness = surf.metalness;
		float transmission = surf.transmission;

		float spdf = 0.0;
		float dpdf = 0.0;
		float tpdf = 0.0;
		float cpdf = 0.0;
		color = vec3( 0.0 );

		vec3 halfVector = getHalfVector( wi, wo, surf.eta );

		// diffuse
		if ( diffuseWeight > 0.0 && wi.z > 0.0 ) {

			dpdf = diffuseEval( wo, wi, halfVector, surf, color );
			color *= 1.0 - surf.transmission;

		}

		// ggx specular
		if ( specularWeight > 0.0 && wi.z > 0.0 ) {

			vec3 outColor;
			spdf = specularEval( wo, wi, getHalfVector( wi, wo ), surf, outColor );
			color += outColor;

		}

		// transmission
		if ( transmissionWeight > 0.0 && wi.z < 0.0 ) {

			tpdf = transmissionEval( wo, wi, halfVector, surf, color );

		}

		// sheen
		color *= mix( 1.0, sheenAlbedoScaling( wo, wi, surf ), surf.sheen );
		color += sheenColor( wo, wi, halfVector, surf ) * surf.sheen;

		// clearcoat
		if ( clearcoatWi.z >= 0.0 && clearcoatWeight > 0.0 ) {

			vec3 clearcoatHalfVector = getHalfVector( clearcoatWo, clearcoatWi );
			cpdf = clearcoatEval( clearcoatWo, clearcoatWi, clearcoatHalfVector, surf, color );

		}

		float pdf =
			dpdf * diffuseWeight
			+ spdf * specularWeight
			+ tpdf * transmissionWeight
			+ cpdf * clearcoatWeight;

		// retrieve specular rays for the shadows flag
		specularPdf = spdf * specularWeight + cpdf * clearcoatWeight;

		return pdf;

	}

	float bsdfResult( vec3 worldWo, vec3 worldWi, SurfaceRecord surf, inout vec3 color ) {

		if ( surf.volumeParticle ) {

			color = surf.color / ( 4.0 * PI );
			return 1.0 / ( 4.0 * PI );

		}

		vec3 wo = normalize( surf.normalInvBasis * worldWo );
		vec3 wi = normalize( surf.normalInvBasis * worldWi );

		vec3 clearcoatWo = normalize( surf.clearcoatInvBasis * worldWo );
		vec3 clearcoatWi = normalize( surf.clearcoatInvBasis * worldWi );

		vec3 wh = getHalfVector( wo, wi, surf.eta );
		float diffuseWeight;
		float specularWeight;
		float transmissionWeight;
		float clearcoatWeight;
		getLobeWeights( wo, wi, wh, clearcoatWo, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight );

		float specularPdf;
		return bsdfEval( wo, clearcoatWo, wi, clearcoatWi, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight, specularPdf, color );

	}

	ScatterRecord bsdfSample( vec3 worldWo, SurfaceRecord surf ) {

		if ( surf.volumeParticle ) {

			ScatterRecord sampleRec;
			sampleRec.specularPdf = 0.0;
			sampleRec.pdf = 1.0 / ( 4.0 * PI );
			sampleRec.direction = sampleSphere( rand2( 16 ) );
			sampleRec.color = surf.color / ( 4.0 * PI );
			return sampleRec;

		}

		vec3 wo = normalize( surf.normalInvBasis * worldWo );
		vec3 clearcoatWo = normalize( surf.clearcoatInvBasis * worldWo );
		mat3 normalBasis = surf.normalBasis;
		mat3 invBasis = surf.normalInvBasis;
		mat3 clearcoatNormalBasis = surf.clearcoatBasis;
		mat3 clearcoatInvBasis = surf.clearcoatInvBasis;

		float diffuseWeight;
		float specularWeight;
		float transmissionWeight;
		float clearcoatWeight;
		// using normal and basically-reflected ray since we don't have proper half vector here
		getLobeWeights( wo, wo, vec3( 0, 0, 1 ), clearcoatWo, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight );

		float pdf[4];
		pdf[0] = diffuseWeight;
		pdf[1] = specularWeight;
		pdf[2] = transmissionWeight;
		pdf[3] = clearcoatWeight;

		float cdf[4];
		cdf[0] = pdf[0];
		cdf[1] = pdf[1] + cdf[0];
		cdf[2] = pdf[2] + cdf[1];
		cdf[3] = pdf[3] + cdf[2];

		if( cdf[3] != 0.0 ) {

			float invMaxCdf = 1.0 / cdf[3];
			cdf[0] *= invMaxCdf;
			cdf[1] *= invMaxCdf;
			cdf[2] *= invMaxCdf;
			cdf[3] *= invMaxCdf;

		} else {

			cdf[0] = 1.0;
			cdf[1] = 0.0;
			cdf[2] = 0.0;
			cdf[3] = 0.0;

		}

		vec3 wi;
		vec3 clearcoatWi;

		float r = rand( 15 );
		if ( r <= cdf[0] ) { // diffuse

			wi = diffuseDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[1] ) { // specular

			wi = specularDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[2] ) { // transmission / refraction

			wi = transmissionDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[3] ) { // clearcoat

			clearcoatWi = clearcoatDirection( clearcoatWo, surf );
			wi = normalize( invBasis * normalize( clearcoatNormalBasis * clearcoatWi ) );

		}

		ScatterRecord result;
		result.pdf = bsdfEval( wo, clearcoatWo, wi, clearcoatWi, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight, result.specularPdf, result.color );
		result.direction = normalize( surf.normalBasis * wi );

		return result;

	}

`;var Rm=`

	// returns the hit distance given the material density
	float intersectFogVolume( Material material, float u ) {

		// https://raytracing.github.io/books/RayTracingTheNextWeek.html#volumes/constantdensitymediums
		return material.opacity == 0.0 ? INFINITY : ( - 1.0 / material.opacity ) * log( u );

	}

	ScatterRecord sampleFogVolume( SurfaceRecord surf, vec2 uv ) {

		ScatterRecord sampleRec;
		sampleRec.specularPdf = 0.0;
		sampleRec.pdf = 1.0 / ( 2.0 * PI );
		sampleRec.direction = sampleSphere( uv );
		sampleRec.color = surf.color;
		return sampleRec;

	}

`;var Cm=`

	// The GGX functions provide sampling and distribution information for normals as output so
	// in order to get probability of scatter direction the half vector must be computed and provided.
	// [0] https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf
	// [1] https://hal.archives-ouvertes.fr/hal-01509746/document
	// [2] http://jcgt.org/published/0007/04/01/
	// [4] http://jcgt.org/published/0003/02/03/

	// trowbridge-reitz === GGX === GTR

	vec3 ggxDirection( vec3 incidentDir, vec2 roughness, vec2 uv ) {

		// TODO: try GGXVNDF implementation from reference [2], here. Needs to update ggxDistribution
		// function below, as well

		// Implementation from reference [1]
		// stretch view
		vec3 V = normalize( vec3( roughness * incidentDir.xy, incidentDir.z ) );

		// orthonormal basis
		vec3 T1 = ( V.z < 0.9999 ) ? normalize( cross( V, vec3( 0.0, 0.0, 1.0 ) ) ) : vec3( 1.0, 0.0, 0.0 );
		vec3 T2 = cross( T1, V );

		// sample point with polar coordinates (r, phi)
		float a = 1.0 / ( 1.0 + V.z );
		float r = sqrt( uv.x );
		float phi = ( uv.y < a ) ? uv.y / a * PI : PI + ( uv.y - a ) / ( 1.0 - a ) * PI;
		float P1 = r * cos( phi );
		float P2 = r * sin( phi ) * ( ( uv.y < a ) ? 1.0 : V.z );

		// compute normal
		vec3 N = P1 * T1 + P2 * T2 + V * sqrt( max( 0.0, 1.0 - P1 * P1 - P2 * P2 ) );

		// unstretch
		N = normalize( vec3( roughness * N.xy, max( 0.0, N.z ) ) );

		return N;

	}

	// Below are PDF and related functions for use in a Monte Carlo path tracer
	// as specified in Appendix B of the following paper
	// See equation (34) from reference [0]
	float ggxLamda( float theta, float roughness ) {

		float tanTheta = tan( theta );
		float tanTheta2 = tanTheta * tanTheta;
		float alpha2 = roughness * roughness;

		float numerator = - 1.0 + sqrt( 1.0 + alpha2 * tanTheta2 );
		return numerator / 2.0;

	}

	// See equation (34) from reference [0]
	float ggxShadowMaskG1( float theta, float roughness ) {

		return 1.0 / ( 1.0 + ggxLamda( theta, roughness ) );

	}

	// See equation (125) from reference [4]
	float ggxShadowMaskG2( vec3 wi, vec3 wo, float roughness ) {

		float incidentTheta = acos( wi.z );
		float scatterTheta = acos( wo.z );
		return 1.0 / ( 1.0 + ggxLamda( incidentTheta, roughness ) + ggxLamda( scatterTheta, roughness ) );

	}

	// See equation (33) from reference [0]
	float ggxDistribution( vec3 halfVector, float roughness ) {

		float a2 = roughness * roughness;
		a2 = max( EPSILON, a2 );
		float cosTheta = halfVector.z;
		float cosTheta4 = pow( cosTheta, 4.0 );

		if ( cosTheta == 0.0 ) return 0.0;

		float theta = acosSafe( halfVector.z );
		float tanTheta = tan( theta );
		float tanTheta2 = pow( tanTheta, 2.0 );

		float denom = PI * cosTheta4 * pow( a2 + tanTheta2, 2.0 );
		return ( a2 / denom );

	}

	// See equation (3) from reference [2]
	float ggxPDF( vec3 wi, vec3 halfVector, float roughness ) {

		float incidentTheta = acos( wi.z );
		float D = ggxDistribution( halfVector, roughness );
		float G1 = ggxShadowMaskG1( incidentTheta, roughness );

		return D * G1 * max( 0.0, dot( wi, halfVector ) ) / wi.z;

	}

`;var Im=`

	// XYZ to sRGB color space
	const mat3 XYZ_TO_REC709 = mat3(
		3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);

	vec3 fresnel0ToIor( vec3 fresnel0 ) {

		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );

	}

	// Conversion FO/IOR
	vec3 iorToFresnel0( vec3 transmittedIor, float incidentIor ) {

		return square( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );

	}

	// ior is a value between 1.0 and 3.0. 1.0 is air interface
	float iorToFresnel0( float transmittedIor, float incidentIor ) {

		return square( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ) );

	}

	// Fresnel equations for dielectric/dielectric interfaces. See https://belcour.github.io/blog/research/2017/05/01/brdf-thin-film.html
	vec3 evalSensitivity( float OPD, vec3 shift ) {

		float phase = 2.0 * PI * OPD * 1.0e-9;

		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );

		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - square( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * square( phase ) );
		xyz /= 1.0685e-7;

		vec3 srgb = XYZ_TO_REC709 * xyz;
		return srgb;

	}

	// See Section 4. Analytic Spectral Integration, A Practical Extension to Microfacet Theory for the Modeling of Varying Iridescence, https://hal.archives-ouvertes.fr/hal-01518344/document
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {

		vec3 I;

		// Force iridescenceIor -> outsideIOR when thinFilmThickness -> 0.0
		float iridescenceIor = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );

		// Evaluate the cosTheta on the base layer (Snell law)
		float sinTheta2Sq = square( outsideIOR / iridescenceIor ) * ( 1.0 - square( cosTheta1 ) );

		// Handle TIR:
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {

			return vec3( 1.0 );

		}

		float cosTheta2 = sqrt( cosTheta2Sq );

		// First interface
		float R0 = iorToFresnel0( iridescenceIor, outsideIOR );
		float R12 = schlickFresnel( cosTheta1, R0 );
		float R21 = R12;
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIor < outsideIOR ) {

			phi12 = PI;

		}

		float phi21 = PI - phi12;

		// Second interface
		vec3 baseIOR = fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) ); // guard against 1.0
		vec3 R1 = iorToFresnel0( baseIOR, iridescenceIor );
		vec3 R23 = schlickFresnel( cosTheta2, R1 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[0] < iridescenceIor ) {

			phi23[ 0 ] = PI;

		}

		if ( baseIOR[1] < iridescenceIor ) {

			phi23[ 1 ] = PI;

		}

		if ( baseIOR[2] < iridescenceIor ) {

			phi23[ 2 ] = PI;

		}

		// Phase shift
		float OPD = 2.0 * iridescenceIor * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;

		// Compound terms
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = square( T121 ) * R23 / ( vec3( 1.0 ) - R123 );

		// Reflectance term for m = 0 (DC term amplitude)
		vec3 C0 = R12 + Rs;
		I = C0;

		// Reflectance term for m > 0 (pairs of diracs)
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {

			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;

		}

		// Since out of gamut colors might be produced, negative color values are clamped to 0.
		return max( I, vec3( 0.0 ) );

	}

`;var Pm=`

	// See equation (2) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetD( float cosThetaH, float roughness ) {

		float alpha = max( roughness, 0.07 );
		alpha = alpha * alpha;

		float invAlpha = 1.0 / alpha;

		float sqrCosThetaH = cosThetaH * cosThetaH;
		float sinThetaH = max( 1.0 - sqrCosThetaH, 0.001 );

		return ( 2.0 + invAlpha ) * pow( sinThetaH, 0.5 * invAlpha ) / ( 2.0 * PI );

	}

	float velvetParamsInterpolate( int i, float oneMinusAlphaSquared ) {

		const float p0[5] = float[5]( 25.3245, 3.32435, 0.16801, -1.27393, -4.85967 );
		const float p1[5] = float[5]( 21.5473, 3.82987, 0.19823, -1.97760, -4.32054 );

		return mix( p1[i], p0[i], oneMinusAlphaSquared );

	}

	float velvetL( float x, float alpha ) {

		float oneMinusAlpha = 1.0 - alpha;
		float oneMinusAlphaSquared = oneMinusAlpha * oneMinusAlpha;

		float a = velvetParamsInterpolate( 0, oneMinusAlphaSquared );
		float b = velvetParamsInterpolate( 1, oneMinusAlphaSquared );
		float c = velvetParamsInterpolate( 2, oneMinusAlphaSquared );
		float d = velvetParamsInterpolate( 3, oneMinusAlphaSquared );
		float e = velvetParamsInterpolate( 4, oneMinusAlphaSquared );

		return a / ( 1.0 + b * pow( abs( x ), c ) ) + d * x + e;

	}

	// See equation (3) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetLambda( float cosTheta, float alpha ) {

		return abs( cosTheta ) < 0.5 ? exp( velvetL( cosTheta, alpha ) ) : exp( 2.0 * velvetL( 0.5, alpha ) - velvetL( 1.0 - cosTheta, alpha ) );

	}

	// See Section 3, Shadowing Term, in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetG( float cosThetaO, float cosThetaI, float roughness ) {

		float alpha = max( roughness, 0.07 );
		alpha = alpha * alpha;

		return 1.0 / ( 1.0 + velvetLambda( cosThetaO, alpha ) + velvetLambda( cosThetaI, alpha ) );

	}

	float directionalAlbedoSheen( float cosTheta, float alpha ) {

		cosTheta = saturate( cosTheta );

		float c = 1.0 - cosTheta;
		float c3 = c * c * c;

		return 0.65584461 * c3 + 1.0 / ( 4.16526551 + exp( -7.97291361 * sqrt( alpha ) + 6.33516894 ) );

	}

	float sheenAlbedoScaling( vec3 wo, vec3 wi, SurfaceRecord surf ) {

		float alpha = max( surf.sheenRoughness, 0.07 );
		alpha = alpha * alpha;

		float maxSheenColor = max( max( surf.sheenColor.r, surf.sheenColor.g ), surf.sheenColor.b );

		float eWo = directionalAlbedoSheen( saturateCos( wo.z ), alpha );
		float eWi = directionalAlbedoSheen( saturateCos( wi.z ), alpha );

		return min( 1.0 - maxSheenColor * eWo, 1.0 - maxSheenColor * eWi );

	}

	// See Section 5, Layering, in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float sheenAlbedoScaling( vec3 wo, SurfaceRecord surf ) {

		float alpha = max( surf.sheenRoughness, 0.07 );
		alpha = alpha * alpha;

		float maxSheenColor = max( max( surf.sheenColor.r, surf.sheenColor.g ), surf.sheenColor.b );

		float eWo = directionalAlbedoSheen( saturateCos( wo.z ), alpha );

		return 1.0 - maxSheenColor * eWo;

	}

`;var Dm=`

#ifndef FOG_CHECK_ITERATIONS
#define FOG_CHECK_ITERATIONS 30
#endif

// returns whether the given material is a fog material or not
bool isMaterialFogVolume( sampler2D materials, uint materialIndex ) {

	uint i = materialIndex * uint( MATERIAL_PIXELS );
	vec4 s14 = texelFetch1D( materials, i + 14u );
	return bool( int( s14.b ) & 4 );

}

// returns true if we're within the first fog volume we hit
bool bvhIntersectFogVolumeHit(
	vec3 rayOrigin, vec3 rayDirection,
	usampler2D materialIndexAttribute, sampler2D materials,
	inout Material material
) {

	material.fogVolume = false;

	for ( int i = 0; i < FOG_CHECK_ITERATIONS; i ++ ) {

		// find nearest hit
		uvec4 faceIndices = uvec4( 0u );
		vec3 faceNormal = vec3( 0.0, 0.0, 1.0 );
		vec3 barycoord = vec3( 0.0 );
		float side = 1.0;
		float dist = 0.0;
		bool hit = bvhIntersectFirstHit( bvh, rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist );
		if ( hit ) {

			// if it's a fog volume return whether we hit the front or back face
			uint materialIndex = uTexelFetch1D( materialIndexAttribute, faceIndices.x ).r;
			if ( isMaterialFogVolume( materials, materialIndex ) ) {

				material = readMaterialInfo( materials, materialIndex );
				return side == - 1.0;

			} else {

				// move the ray forward
				rayOrigin = stepRayOrigin( rayOrigin, rayDirection, - faceNormal, dist );

			}

		} else {

			return false;

		}

	}

	return false;

}

`;var Lm=`

	// step through multiple surface hits and accumulate color attenuation based on transmissive surfaces
	// returns true if a solid surface was hit
	bool attenuateHit(
		RenderState state,
		Ray ray, float rayDist,
		out vec3 color
	) {

		// store the original bounce index so we can reset it after
		uint originalBounceIndex = sobolBounceIndex;

		int traversals = state.traversals;
		int transmissiveTraversals = state.transmissiveTraversals;
		bool isShadowRay = state.isShadowRay;
		Material fogMaterial = state.fogMaterial;

		vec3 startPoint = ray.origin;

		// hit results
		SurfaceHit surfaceHit;

		color = vec3( 1.0 );

		bool result = true;
		for ( int i = 0; i < traversals; i ++ ) {

			sobolBounceIndex ++;

			int hitType = traceScene( ray, fogMaterial, surfaceHit );

			if ( hitType == FOG_HIT ) {

				result = true;
				break;

			} else if ( hitType == SURFACE_HIT ) {

				float totalDist = distance( startPoint, ray.origin + ray.direction * surfaceHit.dist );
				if ( totalDist > rayDist ) {

					result = false;
					break;

				}

				// TODO: attenuate the contribution based on the PDF of the resulting ray including refraction values
				// Should be able to work using the material BSDF functions which will take into account specularity, etc.
				// TODO: should we account for emissive surfaces here?

				uint materialIndex = uTexelFetch1D( materialIndexAttribute, surfaceHit.faceIndices.x ).r;
				Material material = readMaterialInfo( materials, materialIndex );

				// adjust the ray to the new surface
				bool isEntering = surfaceHit.side == 1.0;
				ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );

				#if FEATURE_FOG

				if ( material.fogVolume ) {

					fogMaterial = material;
					fogMaterial.fogVolume = surfaceHit.side == 1.0;
					i -= sign( transmissiveTraversals );
					transmissiveTraversals --;
					continue;

				}

				#endif

				if ( ! material.castShadow && isShadowRay ) {

					continue;

				}

				vec2 uv = textureSampleBarycoord( attributesArray, ATTR_UV, surfaceHit.barycoord, surfaceHit.faceIndices.xyz ).xy;
				vec4 vertexColor = textureSampleBarycoord( attributesArray, ATTR_COLOR, surfaceHit.barycoord, surfaceHit.faceIndices.xyz );

				// albedo
				vec4 albedo = vec4( material.color, material.opacity );
				if ( material.map != - 1 ) {

					vec3 uvPrime = material.mapTransform * vec3( uv, 1 );
					albedo *= texture2D( textures, vec3( uvPrime.xy, material.map ) );

				}

				if ( material.vertexColors ) {

					albedo *= vertexColor;

				}

				// alphaMap
				if ( material.alphaMap != - 1 ) {

					vec3 uvPrime = material.alphaMapTransform * vec3( uv, 1 );
					albedo.a *= texture2D( textures, vec3( uvPrime.xy, material.alphaMap ) ).x;

				}

				// transmission
				float transmission = material.transmission;
				if ( material.transmissionMap != - 1 ) {

					vec3 uvPrime = material.transmissionMapTransform * vec3( uv, 1 );
					transmission *= texture2D( textures, vec3( uvPrime.xy, material.transmissionMap ) ).r;

				}

				// metalness
				float metalness = material.metalness;
				if ( material.metalnessMap != - 1 ) {

					vec3 uvPrime = material.metalnessMapTransform * vec3( uv, 1 );
					metalness *= texture2D( textures, vec3( uvPrime.xy, material.metalnessMap ) ).b;

				}

				float alphaTest = material.alphaTest;
				bool useAlphaTest = alphaTest != 0.0;
				float transmissionFactor = ( 1.0 - metalness ) * transmission;
				if (
					transmissionFactor < rand( 9 ) && ! (
						// material sidedness
						material.side != 0.0 && surfaceHit.side == material.side

						// alpha test
						|| useAlphaTest && albedo.a < alphaTest

						// opacity
						|| material.transparent && ! useAlphaTest && albedo.a < rand( 10 )
					)
				) {

					result = true;
					break;

				}

				if ( surfaceHit.side == 1.0 && isEntering ) {

					// only attenuate by surface color on the way in
					color *= mix( vec3( 1.0 ), albedo.rgb, transmissionFactor );

				} else if ( surfaceHit.side == - 1.0 ) {

					// attenuate by medium once we hit the opposite side of the model
					color *= transmissionAttenuation( surfaceHit.dist, material.attenuationColor, material.attenuationDistance );

				}

				bool isTransmissiveRay = dot( ray.direction, surfaceHit.faceNormal * surfaceHit.side ) < 0.0;
				if ( ( isTransmissiveRay || isEntering ) && transmissiveTraversals > 0 ) {

					i -= sign( transmissiveTraversals );
					transmissiveTraversals --;

				}

			} else {

				result = false;
				break;

			}

		}

		// reset the bounce index
		sobolBounceIndex = originalBounceIndex;
		return result;

	}

`;var Fm=`

	vec3 ndcToRayOrigin( vec2 coord ) {

		vec4 rayOrigin4 = cameraWorldMatrix * invProjectionMatrix * vec4( coord, - 1.0, 1.0 );
		return rayOrigin4.xyz / rayOrigin4.w;
	}

	Ray getCameraRay() {

		vec2 ssd = vec2( 1.0 ) / resolution;

		// Jitter the camera ray by finding a uv coordinate at a random sample
		// around this pixel's UV coordinate for AA
		vec2 ruv = rand2( 0 );
		vec2 jitteredUv = vUv + vec2( tentFilter( ruv.x ) * ssd.x, tentFilter( ruv.y ) * ssd.y );
		Ray ray;

		#if CAMERA_TYPE == 2

			// Equirectangular projection
			vec4 rayDirection4 = vec4( equirectUvToDirection( jitteredUv ), 0.0 );
			vec4 rayOrigin4 = vec4( 0.0, 0.0, 0.0, 1.0 );

			rayDirection4 = cameraWorldMatrix * rayDirection4;
			rayOrigin4 = cameraWorldMatrix * rayOrigin4;

			ray.direction = normalize( rayDirection4.xyz );
			ray.origin = rayOrigin4.xyz / rayOrigin4.w;

		#else

			// get [- 1, 1] normalized device coordinates
			vec2 ndc = 2.0 * jitteredUv - vec2( 1.0 );
			ray.origin = ndcToRayOrigin( ndc );

			#if CAMERA_TYPE == 1

				// Orthographic projection
				ray.direction = ( cameraWorldMatrix * vec4( 0.0, 0.0, - 1.0, 0.0 ) ).xyz;
				ray.direction = normalize( ray.direction );

			#else

				// Perspective projection
				ray.direction = normalize( mat3( cameraWorldMatrix ) * ( invProjectionMatrix * vec4( ndc, 0.0, 1.0 ) ).xyz );

			#endif

		#endif

		#if FEATURE_DOF
		{

			// depth of field
			vec3 focalPoint = ray.origin + normalize( ray.direction ) * physicalCamera.focusDistance;

			// get the aperture sample
			// if blades === 0 then we assume a circle
			vec3 shapeUVW= rand3( 1 );
			int blades = physicalCamera.apertureBlades;
			float anamorphicRatio = physicalCamera.anamorphicRatio;
			vec2 apertureSample = sampleAperture( blades, shapeUVW );
			apertureSample *= physicalCamera.bokehSize * 0.5 * 1e-3;

			// rotate the aperture shape
			apertureSample =
				rotateVector( apertureSample, physicalCamera.apertureRotation ) *
				saturate( vec2( anamorphicRatio, 1.0 / anamorphicRatio ) );

			// create the new ray
			ray.origin += ( cameraWorldMatrix * vec4( apertureSample, 0.0, 0.0 ) ).xyz;
			ray.direction = focalPoint - ray.origin;

		}
		#endif

		ray.direction = normalize( ray.direction );

		return ray;

	}

`;var Nm=`

	vec3 directLightContribution( vec3 worldWo, SurfaceRecord surf, RenderState state, vec3 rayOrigin ) {

		vec3 result = vec3( 0.0 );

		// uniformly pick a light or environment map
		if( lightsDenom != 0.0 && rand( 5 ) < float( lights.count ) / lightsDenom ) {

			// sample a light or environment
			LightRecord lightRec = randomLightSample( lights.tex, iesProfiles, lights.count, rayOrigin, rand3( 6 ) );

			bool isSampleBelowSurface = ! surf.volumeParticle && dot( surf.faceNormal, lightRec.direction ) < 0.0;
			if ( isSampleBelowSurface ) {

				lightRec.pdf = 0.0;

			}

			// check if a ray could even reach the light area
			Ray lightRay;
			lightRay.origin = rayOrigin;
			lightRay.direction = lightRec.direction;
			vec3 attenuatedColor;
			if (
				lightRec.pdf > 0.0 &&
				isDirectionValid( lightRec.direction, surf.normal, surf.faceNormal ) &&
				! attenuateHit( state, lightRay, lightRec.dist, attenuatedColor )
			) {

				// get the material pdf
				vec3 sampleColor;
				float lightMaterialPdf = bsdfResult( worldWo, lightRec.direction, surf, sampleColor );
				bool isValidSampleColor = all( greaterThanEqual( sampleColor, vec3( 0.0 ) ) );
				if ( lightMaterialPdf > 0.0 && isValidSampleColor ) {

					// weight the direct light contribution
					float lightPdf = lightRec.pdf / lightsDenom;
					float misWeight = lightRec.type == SPOT_LIGHT_TYPE || lightRec.type == DIR_LIGHT_TYPE || lightRec.type == POINT_LIGHT_TYPE ? 1.0 : misHeuristic( lightPdf, lightMaterialPdf );
					result = attenuatedColor * lightRec.emission * state.throughputColor * sampleColor * misWeight / lightPdf;

				}

			}

		} else if ( envMapInfo.totalSum != 0.0 && environmentIntensity != 0.0 ) {

			// find a sample in the environment map to include in the contribution
			vec3 envColor, envDirection;
			float envPdf = sampleEquirectProbability( rand2( 7 ), envColor, envDirection );
			envDirection = invEnvRotation3x3 * envDirection;

			// this env sampling is not set up for transmissive sampling and yields overly bright
			// results so we ignore the sample in this case.
			// TODO: this should be improved but how? The env samples could traverse a few layers?
			bool isSampleBelowSurface = ! surf.volumeParticle && dot( surf.faceNormal, envDirection ) < 0.0;
			if ( isSampleBelowSurface ) {

				envPdf = 0.0;

			}

			// check if a ray could even reach the surface
			Ray envRay;
			envRay.origin = rayOrigin;
			envRay.direction = envDirection;
			vec3 attenuatedColor;
			if (
				envPdf > 0.0 &&
				isDirectionValid( envDirection, surf.normal, surf.faceNormal ) &&
				! attenuateHit( state, envRay, INFINITY, attenuatedColor )
			) {

				// get the material pdf
				vec3 sampleColor;
				float envMaterialPdf = bsdfResult( worldWo, envDirection, surf, sampleColor );
				bool isValidSampleColor = all( greaterThanEqual( sampleColor, vec3( 0.0 ) ) );
				if ( envMaterialPdf > 0.0 && isValidSampleColor ) {

					// weight the direct light contribution
					envPdf /= lightsDenom;
					float misWeight = misHeuristic( envPdf, envMaterialPdf );
					result = attenuatedColor * environmentIntensity * envColor * state.throughputColor * sampleColor * misWeight / envPdf;

				}

			}

		}

		// Function changed to have a single return statement to potentially help with crashes on Mac OS.
		// See issue #470
		return result;

	}

`;var Um=`

	#define SKIP_SURFACE 0
	#define HIT_SURFACE 1
	int getSurfaceRecord(
		Material material, SurfaceHit surfaceHit, sampler2DArray attributesArray,
		float accumulatedRoughness,
		inout SurfaceRecord surf
	) {

		if ( material.fogVolume ) {

			vec3 normal = vec3( 0, 0, 1 );

			SurfaceRecord fogSurface;
			fogSurface.volumeParticle = true;
			fogSurface.color = material.color;
			fogSurface.emission = material.emissiveIntensity * material.emissive;
			fogSurface.normal = normal;
			fogSurface.faceNormal = normal;
			fogSurface.clearcoatNormal = normal;

			surf = fogSurface;
			return HIT_SURFACE;

		}

		// uv coord for textures
		vec2 uv = textureSampleBarycoord( attributesArray, ATTR_UV, surfaceHit.barycoord, surfaceHit.faceIndices.xyz ).xy;
		vec4 vertexColor = textureSampleBarycoord( attributesArray, ATTR_COLOR, surfaceHit.barycoord, surfaceHit.faceIndices.xyz );

		// albedo
		vec4 albedo = vec4( material.color, material.opacity );
		if ( material.map != - 1 ) {

			vec3 uvPrime = material.mapTransform * vec3( uv, 1 );
			albedo *= texture2D( textures, vec3( uvPrime.xy, material.map ) );

		}

		if ( material.vertexColors ) {

			albedo *= vertexColor;

		}

		// alphaMap
		if ( material.alphaMap != - 1 ) {

			vec3 uvPrime = material.alphaMapTransform * vec3( uv, 1 );
			albedo.a *= texture2D( textures, vec3( uvPrime.xy, material.alphaMap ) ).x;

		}

		// possibly skip this sample if it's transparent, alpha test is enabled, or we hit the wrong material side
		// and it's single sided.
		// - alpha test is disabled when it === 0
		// - the material sidedness test is complicated because we want light to pass through the back side but still
		// be able to see the front side. This boolean checks if the side we hit is the front side on the first ray
		// and we're rendering the other then we skip it. Do the opposite on subsequent bounces to get incoming light.
		float alphaTest = material.alphaTest;
		bool useAlphaTest = alphaTest != 0.0;
		if (
			// material sidedness
			material.side != 0.0 && surfaceHit.side != material.side

			// alpha test
			|| useAlphaTest && albedo.a < alphaTest

			// opacity
			|| material.transparent && ! useAlphaTest && albedo.a < rand( 3 )
		) {

			return SKIP_SURFACE;

		}

		// fetch the interpolated smooth normal
		vec3 normal = normalize( textureSampleBarycoord(
			attributesArray,
			ATTR_NORMAL,
			surfaceHit.barycoord,
			surfaceHit.faceIndices.xyz
		).xyz );

		// roughness
		float roughness = material.roughness;
		if ( material.roughnessMap != - 1 ) {

			vec3 uvPrime = material.roughnessMapTransform * vec3( uv, 1 );
			roughness *= texture2D( textures, vec3( uvPrime.xy, material.roughnessMap ) ).g;

		}

		// metalness
		float metalness = material.metalness;
		if ( material.metalnessMap != - 1 ) {

			vec3 uvPrime = material.metalnessMapTransform * vec3( uv, 1 );
			metalness *= texture2D( textures, vec3( uvPrime.xy, material.metalnessMap ) ).b;

		}

		// emission
		vec3 emission = material.emissiveIntensity * material.emissive;
		if ( material.emissiveMap != - 1 ) {

			vec3 uvPrime = material.emissiveMapTransform * vec3( uv, 1 );
			emission *= texture2D( textures, vec3( uvPrime.xy, material.emissiveMap ) ).xyz;

		}

		// transmission
		float transmission = material.transmission;
		if ( material.transmissionMap != - 1 ) {

			vec3 uvPrime = material.transmissionMapTransform * vec3( uv, 1 );
			transmission *= texture2D( textures, vec3( uvPrime.xy, material.transmissionMap ) ).r;

		}

		// normal
		if ( material.flatShading ) {

			// if we're rendering a flat shaded object then use the face normals - the face normal
			// is provided based on the side the ray hits the mesh so flip it to align with the
			// interpolated vertex normals.
			normal = surfaceHit.faceNormal * surfaceHit.side;

		}

		vec3 baseNormal = normal;
		if ( material.normalMap != - 1 ) {

			vec4 tangentSample = textureSampleBarycoord(
				attributesArray,
				ATTR_TANGENT,
				surfaceHit.barycoord,
				surfaceHit.faceIndices.xyz
			);

			// some provided tangents can be malformed (0, 0, 0) causing the normal to be degenerate
			// resulting in NaNs and slow path tracing.
			if ( length( tangentSample.xyz ) > 0.0 ) {

				vec3 tangent = normalize( tangentSample.xyz );
				vec3 bitangent = normalize( cross( normal, tangent ) * tangentSample.w );
				mat3 vTBN = mat3( tangent, bitangent, normal );

				vec3 uvPrime = material.normalMapTransform * vec3( uv, 1 );
				vec3 texNormal = texture2D( textures, vec3( uvPrime.xy, material.normalMap ) ).xyz * 2.0 - 1.0;
				texNormal.xy *= material.normalScale;
				normal = vTBN * texNormal;

			}

		}

		normal *= surfaceHit.side;

		// clearcoat
		float clearcoat = material.clearcoat;
		if ( material.clearcoatMap != - 1 ) {

			vec3 uvPrime = material.clearcoatMapTransform * vec3( uv, 1 );
			clearcoat *= texture2D( textures, vec3( uvPrime.xy, material.clearcoatMap ) ).r;

		}

		// clearcoatRoughness
		float clearcoatRoughness = material.clearcoatRoughness;
		if ( material.clearcoatRoughnessMap != - 1 ) {

			vec3 uvPrime = material.clearcoatRoughnessMapTransform * vec3( uv, 1 );
			clearcoatRoughness *= texture2D( textures, vec3( uvPrime.xy, material.clearcoatRoughnessMap ) ).g;

		}

		// clearcoatNormal
		vec3 clearcoatNormal = baseNormal;
		if ( material.clearcoatNormalMap != - 1 ) {

			vec4 tangentSample = textureSampleBarycoord(
				attributesArray,
				ATTR_TANGENT,
				surfaceHit.barycoord,
				surfaceHit.faceIndices.xyz
			);

			// some provided tangents can be malformed (0, 0, 0) causing the normal to be degenerate
			// resulting in NaNs and slow path tracing.
			if ( length( tangentSample.xyz ) > 0.0 ) {

				vec3 tangent = normalize( tangentSample.xyz );
				vec3 bitangent = normalize( cross( clearcoatNormal, tangent ) * tangentSample.w );
				mat3 vTBN = mat3( tangent, bitangent, clearcoatNormal );

				vec3 uvPrime = material.clearcoatNormalMapTransform * vec3( uv, 1 );
				vec3 texNormal = texture2D( textures, vec3( uvPrime.xy, material.clearcoatNormalMap ) ).xyz * 2.0 - 1.0;
				texNormal.xy *= material.clearcoatNormalScale;
				clearcoatNormal = vTBN * texNormal;

			}

		}

		clearcoatNormal *= surfaceHit.side;

		// sheenColor
		vec3 sheenColor = material.sheenColor;
		if ( material.sheenColorMap != - 1 ) {

			vec3 uvPrime = material.sheenColorMapTransform * vec3( uv, 1 );
			sheenColor *= texture2D( textures, vec3( uvPrime.xy, material.sheenColorMap ) ).rgb;

		}

		// sheenRoughness
		float sheenRoughness = material.sheenRoughness;
		if ( material.sheenRoughnessMap != - 1 ) {

			vec3 uvPrime = material.sheenRoughnessMapTransform * vec3( uv, 1 );
			sheenRoughness *= texture2D( textures, vec3( uvPrime.xy, material.sheenRoughnessMap ) ).a;

		}

		// iridescence
		float iridescence = material.iridescence;
		if ( material.iridescenceMap != - 1 ) {

			vec3 uvPrime = material.iridescenceMapTransform * vec3( uv, 1 );
			iridescence *= texture2D( textures, vec3( uvPrime.xy, material.iridescenceMap ) ).r;

		}

		// iridescence thickness
		float iridescenceThickness = material.iridescenceThicknessMaximum;
		if ( material.iridescenceThicknessMap != - 1 ) {

			vec3 uvPrime = material.iridescenceThicknessMapTransform * vec3( uv, 1 );
			float iridescenceThicknessSampled = texture2D( textures, vec3( uvPrime.xy, material.iridescenceThicknessMap ) ).g;
			iridescenceThickness = mix( material.iridescenceThicknessMinimum, material.iridescenceThicknessMaximum, iridescenceThicknessSampled );

		}

		iridescence = iridescenceThickness == 0.0 ? 0.0 : iridescence;

		// specular color
		vec3 specularColor = material.specularColor;
		if ( material.specularColorMap != - 1 ) {

			vec3 uvPrime = material.specularColorMapTransform * vec3( uv, 1 );
			specularColor *= texture2D( textures, vec3( uvPrime.xy, material.specularColorMap ) ).rgb;

		}

		// specular intensity
		float specularIntensity = material.specularIntensity;
		if ( material.specularIntensityMap != - 1 ) {

			vec3 uvPrime = material.specularIntensityMapTransform * vec3( uv, 1 );
			specularIntensity *= texture2D( textures, vec3( uvPrime.xy, material.specularIntensityMap ) ).a;

		}

		surf.volumeParticle = false;

		surf.faceNormal = surfaceHit.faceNormal;
		surf.normal = normal;

		surf.metalness = metalness;
		surf.color = albedo.rgb;
		surf.emission = emission;

		surf.ior = material.ior;
		surf.transmission = transmission;
		surf.thinFilm = material.thinFilm;
		surf.attenuationColor = material.attenuationColor;
		surf.attenuationDistance = material.attenuationDistance;

		surf.clearcoatNormal = clearcoatNormal;
		surf.clearcoat = clearcoat;

		surf.sheen = material.sheen;
		surf.sheenColor = sheenColor;

		surf.iridescence = iridescence;
		surf.iridescenceIor = material.iridescenceIor;
		surf.iridescenceThickness = iridescenceThickness;

		surf.specularColor = specularColor;
		surf.specularIntensity = specularIntensity;

		// apply perceptual roughness factor from gltf. sheen perceptual roughness is
		// applied by its brdf function
		// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#microfacet-surfaces
		surf.roughness = roughness * roughness;
		surf.clearcoatRoughness = clearcoatRoughness * clearcoatRoughness;
		surf.sheenRoughness = sheenRoughness;

		// frontFace is used to determine transmissive properties and PDF. If no transmission is used
		// then we can just always assume this is a front face.
		surf.frontFace = surfaceHit.side == 1.0 || transmission == 0.0;
		surf.eta = material.thinFilm || surf.frontFace ? 1.0 / material.ior : material.ior;
		surf.f0 = iorRatioToF0( surf.eta );

		// Compute the filtered roughness value to use during specular reflection computations.
		// The accumulated roughness value is scaled by a user setting and a "magic value" of 5.0.
		// If we're exiting something transmissive then scale the factor down significantly so we can retain
		// sharp internal reflections
		surf.filteredRoughness = applyFilteredGlossy( surf.roughness, accumulatedRoughness );
		surf.filteredClearcoatRoughness = applyFilteredGlossy( surf.clearcoatRoughness, accumulatedRoughness );

		// get the normal frames
		surf.normalBasis = getBasisFromNormal( surf.normal );
		surf.normalInvBasis = inverse( surf.normalBasis );

		surf.clearcoatBasis = getBasisFromNormal( surf.clearcoatNormal );
		surf.clearcoatInvBasis = inverse( surf.clearcoatBasis );

		return HIT_SURFACE;

	}
`;var Om=`

	struct Ray {

		vec3 origin;
		vec3 direction;

	};

	struct SurfaceHit {

		uvec4 faceIndices;
		vec3 barycoord;
		vec3 faceNormal;
		float side;
		float dist;

	};

	struct RenderState {

		bool firstRay;
		bool transmissiveRay;
		bool isShadowRay;
		float accumulatedRoughness;
		int transmissiveTraversals;
		int traversals;
		uint depth;
		vec3 throughputColor;
		Material fogMaterial;

	};

	RenderState initRenderState() {

		RenderState result;
		result.firstRay = true;
		result.transmissiveRay = true;
		result.isShadowRay = false;
		result.accumulatedRoughness = 0.0;
		result.transmissiveTraversals = 0;
		result.traversals = 0;
		result.throughputColor = vec3( 1.0 );
		result.depth = 0u;
		result.fogMaterial.fogVolume = false;
		return result;

	}

`;var Bm=`

	#define NO_HIT 0
	#define SURFACE_HIT 1
	#define LIGHT_HIT 2
	#define FOG_HIT 3

	// Passing the global variable 'lights' into this function caused shader program errors.
	// So global variables like 'lights' and 'bvh' were moved out of the function parameters.
	// For more information, refer to: https://github.com/gkjohnson/three-gpu-pathtracer/pull/457
	int traceScene(
		Ray ray, Material fogMaterial, inout SurfaceHit surfaceHit
	) {

		int result = NO_HIT;
		bool hit = bvhIntersectFirstHit( bvh, ray.origin, ray.direction, surfaceHit.faceIndices, surfaceHit.faceNormal, surfaceHit.barycoord, surfaceHit.side, surfaceHit.dist );

		#if FEATURE_FOG

		if ( fogMaterial.fogVolume ) {

			// offset the distance so we don't run into issues with particles on the same surface
			// as other objects
			float particleDist = intersectFogVolume( fogMaterial, rand( 1 ) );
			if ( particleDist + RAY_OFFSET < surfaceHit.dist ) {

				surfaceHit.side = 1.0;
				surfaceHit.faceNormal = normalize( - ray.direction );
				surfaceHit.dist = particleDist;
				return FOG_HIT;

			}

		}

		#endif

		if ( hit ) {

			result = SURFACE_HIT;

		}

		return result;

	}

`;var zc=class extends nr{onBeforeRender(){this.setDefine("FEATURE_DOF",this.physicalCamera.bokehSize===0?0:1),this.setDefine("FEATURE_BACKGROUND_MAP",this.backgroundMap?1:0),this.setDefine("FEATURE_FOG",this.materials.features.isUsed("FOG")?1:0)}constructor(e){super({transparent:!0,depthWrite:!1,defines:{FEATURE_MIS:1,FEATURE_RUSSIAN_ROULETTE:1,FEATURE_DOF:1,FEATURE_BACKGROUND_MAP:0,FEATURE_FOG:1,RANDOM_TYPE:2,CAMERA_TYPE:0,DEBUG_MODE:0,ATTR_NORMAL:0,ATTR_TANGENT:1,ATTR_UV:2,ATTR_COLOR:3,MATERIAL_PIXELS:Dc},uniforms:{resolution:{value:new Ue},opacity:{value:1},bounces:{value:10},transmissiveBounces:{value:10},filterGlossyFactor:{value:0},physicalCamera:{value:new Tc},cameraWorldMatrix:{value:new Ze},invProjectionMatrix:{value:new Ze},bvh:{value:new uc},attributesArray:{value:new Cc},materialIndexAttribute:{value:new Ms},materials:{value:new Pc},textures:{value:new Oo().texture},lights:{value:new Ec},iesProfiles:{value:new Oo(360,180,{type:ht,wrapS:Pt,wrapT:Pt}).texture},environmentIntensity:{value:1},environmentRotation:{value:new Ze},envMapInfo:{value:new Ac},backgroundBlur:{value:0},backgroundMap:{value:null},backgroundAlpha:{value:1},backgroundIntensity:{value:1},backgroundRotation:{value:new Ze},seed:{value:0},sobolTexture:{value:null},stratifiedTexture:{value:new Nc},stratifiedOffsetTexture:{value:new Oc(64,1)}},vertexShader:`

				varying vec2 vUv;
				void main() {

					vec4 mvPosition = vec4( position, 1.0 );
					mvPosition = modelViewMatrix * mvPosition;
					gl_Position = projectionMatrix * mvPosition;

					vUv = uv;

				}

			`,fragmentShader:`
				#define RAY_OFFSET 1e-4
				#define INFINITY 1e20

				precision highp isampler2D;
				precision highp usampler2D;
				precision highp sampler2DArray;
				vec4 envMapTexelToLinear( vec4 a ) { return a; }
				#include <common>

				// bvh intersection
				${Mr.common_functions}
				${Mr.bvh_struct_definitions}
				${Mr.bvh_ray_functions}

				// uniform structs
				${pm}
				${gm}
				${mm}
				${xm}
				${vm}

				// random
				#if RANDOM_TYPE == 2 	// Stratified List

					${Am}

				#elif RANDOM_TYPE == 1 	// Sobol

					${$h}
					${bc}
					${nm}

					#define rand(v) sobol(v)
					#define rand2(v) sobol2(v)
					#define rand3(v) sobol3(v)
					#define rand4(v) sobol4(v)

				#else 					// PCG

				${$h}

					// Using the sobol functions seems to break the the compiler on MacOS
					// - specifically the "sobolReverseBits" function.
					uint sobolPixelIndex = 0u;
					uint sobolPathIndex = 0u;
					uint sobolBounceIndex = 0u;

					#define rand(v) pcgRand()
					#define rand2(v) pcgRand2()
					#define rand3(v) pcgRand3()
					#define rand4(v) pcgRand4()

				#endif

				// common
				${wm}
				${bm}
				${Bc}
				${Mm}
				${Tm}

				// environment
				uniform EquirectHdrInfo envMapInfo;
				uniform mat4 environmentRotation;
				uniform float environmentIntensity;

				// lighting
				uniform sampler2DArray iesProfiles;
				uniform LightsInfo lights;

				// background
				uniform float backgroundBlur;
				uniform float backgroundAlpha;
				#if FEATURE_BACKGROUND_MAP

				uniform sampler2D backgroundMap;
				uniform mat4 backgroundRotation;
				uniform float backgroundIntensity;

				#endif

				// camera
				uniform mat4 cameraWorldMatrix;
				uniform mat4 invProjectionMatrix;
				#if FEATURE_DOF

				uniform PhysicalCamera physicalCamera;

				#endif

				// geometry
				uniform sampler2DArray attributesArray;
				uniform usampler2D materialIndexAttribute;
				uniform sampler2D materials;
				uniform sampler2DArray textures;
				uniform BVH bvh;

				// path tracer
				uniform int bounces;
				uniform int transmissiveBounces;
				uniform float filterGlossyFactor;
				uniform int seed;

				// image
				uniform vec2 resolution;
				uniform float opacity;

				varying vec2 vUv;

				// globals
				mat3 envRotation3x3;
				mat3 invEnvRotation3x3;
				float lightsDenom;

				// sampling
				${Sm}
				${_m}
				${ym}

				${Dm}
				${Cm}
				${Pm}
				${Im}
				${Rm}
				${Em}

				float applyFilteredGlossy( float roughness, float accumulatedRoughness ) {

					return clamp(
						max(
							roughness,
							accumulatedRoughness * filterGlossyFactor * 5.0 ),
						0.0,
						1.0
					);

				}

				vec3 sampleBackground( vec3 direction, vec2 uv ) {

					vec3 sampleDir = sampleHemisphere( direction, uv ) * 0.5 * backgroundBlur;

					#if FEATURE_BACKGROUND_MAP

					sampleDir = normalize( mat3( backgroundRotation ) * direction + sampleDir );
					return backgroundIntensity * sampleEquirectColor( backgroundMap, sampleDir );

					#else

					sampleDir = normalize( envRotation3x3 * direction + sampleDir );
					return environmentIntensity * sampleEquirectColor( envMapInfo.map, sampleDir );

					#endif

				}

				${Om}
				${Fm}
				${Bm}
				${Lm}
				${Nm}
				${Um}

				void main() {

					// init
					rng_initialize( gl_FragCoord.xy, seed );
					sobolPixelIndex = ( uint( gl_FragCoord.x ) << 16 ) | uint( gl_FragCoord.y );
					sobolPathIndex = uint( seed );

					// get camera ray
					Ray ray = getCameraRay();

					// inverse environment rotation
					envRotation3x3 = mat3( environmentRotation );
					invEnvRotation3x3 = inverse( envRotation3x3 );
					lightsDenom =
						( environmentIntensity == 0.0 || envMapInfo.totalSum == 0.0 ) && lights.count != 0u ?
							float( lights.count ) :
							float( lights.count + 1u );

					// final color
					gl_FragColor = vec4( 0, 0, 0, 1 );

					// surface results
					SurfaceHit surfaceHit;
					ScatterRecord scatterRec;

					// path tracing state
					RenderState state = initRenderState();
					state.transmissiveTraversals = transmissiveBounces;
					#if FEATURE_FOG

					state.fogMaterial.fogVolume = bvhIntersectFogVolumeHit(
						ray.origin, - ray.direction,
						materialIndexAttribute, materials,
						state.fogMaterial
					);

					#endif

					for ( int i = 0; i < bounces; i ++ ) {

						sobolBounceIndex ++;

						state.depth ++;
						state.traversals = bounces - i;
						state.firstRay = i == 0 && state.transmissiveTraversals == transmissiveBounces;

						int hitType = traceScene( ray, state.fogMaterial, surfaceHit );

						// check if we intersect any lights and accumulate the light contribution
						// TODO: we can add support for light surface rendering in the else condition if we
						// add the ability to toggle visibility of the the light
						if ( ! state.firstRay && ! state.transmissiveRay ) {

							LightRecord lightRec;
							float lightDist = hitType == NO_HIT ? INFINITY : surfaceHit.dist;
							for ( uint i = 0u; i < lights.count; i ++ ) {

								if (
									intersectLightAtIndex( lights.tex, ray.origin, ray.direction, i, lightRec ) &&
									lightRec.dist < lightDist
								) {

									#if FEATURE_MIS

									// weight the contribution
									// NOTE: Only area lights are supported for forward sampling and can be hit
									float misWeight = misHeuristic( scatterRec.pdf, lightRec.pdf / lightsDenom );
									gl_FragColor.rgb += lightRec.emission * state.throughputColor * misWeight;

									#else

									gl_FragColor.rgb += lightRec.emission * state.throughputColor;

									#endif

								}

							}

						}

						if ( hitType == NO_HIT ) {

							if ( state.firstRay || state.transmissiveRay ) {

								gl_FragColor.rgb += sampleBackground( ray.direction, rand2( 2 ) ) * state.throughputColor;
								gl_FragColor.a = backgroundAlpha;

							} else {

								#if FEATURE_MIS

								// get the PDF of the hit envmap point
								vec3 envColor;
								float envPdf = sampleEquirect( envRotation3x3 * ray.direction, envColor );
								envPdf /= lightsDenom;

								// and weight the contribution
								float misWeight = misHeuristic( scatterRec.pdf, envPdf );
								gl_FragColor.rgb += environmentIntensity * envColor * state.throughputColor * misWeight;

								#else

								gl_FragColor.rgb +=
									environmentIntensity *
									sampleEquirectColor( envMapInfo.map, envRotation3x3 * ray.direction ) *
									state.throughputColor;

								#endif

							}
							break;

						}

						uint materialIndex = uTexelFetch1D( materialIndexAttribute, surfaceHit.faceIndices.x ).r;
						Material material = readMaterialInfo( materials, materialIndex );

						#if FEATURE_FOG

						if ( hitType == FOG_HIT ) {

							material = state.fogMaterial;
							state.accumulatedRoughness += 0.2;

						} else if ( material.fogVolume ) {

							state.fogMaterial = material;
							state.fogMaterial.fogVolume = surfaceHit.side == 1.0;

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );

							i -= sign( state.transmissiveTraversals );
							state.transmissiveTraversals -= sign( state.transmissiveTraversals );
							continue;

						}

						#endif

						// early out if this is a matte material
						if ( material.matte && state.firstRay ) {

							gl_FragColor = vec4( 0.0 );
							break;

						}

						// if we've determined that this is a shadow ray and we've hit an item with no shadow casting
						// then skip it
						if ( ! material.castShadow && state.isShadowRay ) {

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );
							continue;

						}

						SurfaceRecord surf;
						if (
							getSurfaceRecord(
								material, surfaceHit, attributesArray, state.accumulatedRoughness,
								surf
							) == SKIP_SURFACE
						) {

							// only allow a limited number of transparency discards otherwise we could
							// crash the context with too long a loop.
							i -= sign( state.transmissiveTraversals );
							state.transmissiveTraversals -= sign( state.transmissiveTraversals );

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );
							continue;

						}

						scatterRec = bsdfSample( - ray.direction, surf );
						state.isShadowRay = scatterRec.specularPdf < rand( 4 );

						bool isBelowSurface = ! surf.volumeParticle && dot( scatterRec.direction, surf.faceNormal ) < 0.0;
						vec3 hitPoint = stepRayOrigin( ray.origin, ray.direction, isBelowSurface ? - surf.faceNormal : surf.faceNormal, surfaceHit.dist );

						// next event estimation
						#if FEATURE_MIS

						gl_FragColor.rgb += directLightContribution( - ray.direction, surf, state, hitPoint );

						#endif

						// accumulate a roughness value to offset diffuse, specular, diffuse rays that have high contribution
						// to a single pixel resulting in fireflies
						// TODO: handle transmissive surfaces
						if ( ! surf.volumeParticle && ! isBelowSurface ) {

							// determine if this is a rough normal or not by checking how far off straight up it is
							vec3 halfVector = normalize( - ray.direction + scatterRec.direction );
							state.accumulatedRoughness += max(
								sin( acosApprox( dot( halfVector, surf.normal ) ) ),
								sin( acosApprox( dot( halfVector, surf.clearcoatNormal ) ) )
							);

							state.transmissiveRay = false;

						}

						// accumulate emissive color
						gl_FragColor.rgb += ( surf.emission * state.throughputColor );

						// skip the sample if our PDF or ray is impossible
						if ( scatterRec.pdf <= 0.0 || ! isDirectionValid( scatterRec.direction, surf.normal, surf.faceNormal ) ) {

							break;

						}

						// if we're bouncing around the inside a transmissive material then decrement
						// perform this separate from a bounce
						bool isTransmissiveRay = ! surf.volumeParticle && dot( scatterRec.direction, surf.faceNormal * surfaceHit.side ) < 0.0;
						if ( ( isTransmissiveRay || isBelowSurface ) && state.transmissiveTraversals > 0 ) {

							state.transmissiveTraversals --;
							i --;

						}

						//

						// handle throughput color transformation
						// attenuate the throughput color by the medium color
						if ( ! surf.frontFace ) {

							state.throughputColor *= transmissionAttenuation( surfaceHit.dist, surf.attenuationColor, surf.attenuationDistance );

						}

						#if FEATURE_RUSSIAN_ROULETTE

						// russian roulette path termination
						// https://www.arnoldrenderer.com/research/physically_based_shader_design_in_arnold.pdf
						uint minBounces = 3u;
						float depthProb = float( state.depth < minBounces );

						float rrProb = luminance( state.throughputColor * scatterRec.color / scatterRec.pdf );
						rrProb /= luminance( state.throughputColor );
						rrProb = sqrt( rrProb );
						rrProb = max( rrProb, depthProb );
						rrProb = min( rrProb, 1.0 );
						if ( rand( 8 ) > rrProb ) {

							break;

						}

						// perform sample clamping here to avoid bright pixels
						state.throughputColor *= min( 1.0 / rrProb, 20.0 );

						#endif

						// adjust the throughput and discard and exit if we find discard the sample if there are any NaNs
						state.throughputColor *= scatterRec.color / scatterRec.pdf;
						if ( any( isnan( state.throughputColor ) ) || any( isinf( state.throughputColor ) ) ) {

							break;

						}

						//

						// prepare for next ray
						ray.direction = scatterRec.direction;
						ray.origin = hitPoint;

					}

					gl_FragColor.a *= opacity;

					#if DEBUG_MODE == 1

					// output the number of rays checked in the path and number of
					// transmissive rays encountered.
					gl_FragColor.rgb = vec3(
						float( state.depth ),
						transmissiveBounces - state.transmissiveTraversals,
						0.0
					);
					gl_FragColor.a = 1.0;

					#endif

				}

			`}),this.setValues(e)}};function*BS(){let{_renderer:i,_fsQuad:e,_blendQuad:t,_primaryTarget:n,_blendTargets:r,_sobolTarget:s,_subframe:o,alpha:a,material:l}=this,u=new St,f=new St,h=t.material,[c,d]=r;for(;;){a?(h.opacity=this._opacityFactor/(this.samples+1),l.blending=_n,l.opacity=1):(l.opacity=this._opacityFactor/(this.samples+1),l.blending=oi);let[x,S,p,g]=o,y=n.width,T=n.height;l.resolution.set(y*p,T*g),l.sobolTexture=s.texture,l.stratifiedTexture.init(20,l.bounces+l.transmissiveBounces+5),l.stratifiedTexture.next(),l.seed++;let M=this.tiles.x||1,A=this.tiles.y||1,E=M*A,_=Math.ceil(y*p),w=Math.ceil(T*g),L=Math.floor(x*y),I=Math.floor(S*T),N=Math.ceil(_/M),U=Math.ceil(w/A);for(let z=0;z<A;z++)for(let D=0;D<M;D++){let G=i.getRenderTarget(),W=i.autoClear,Z=i.getScissorTest();i.getScissor(u),i.getViewport(f);let le=D,J=z;if(!this.stableTiles){let ae=this._currentTile%(M*A);le=ae%M,J=~~(ae/M),this._currentTile=ae+1}let se=A-J-1;n.scissor.set(L+le*N,I+se*U,Math.min(N,_-le*N),Math.min(U,w-se*U)),n.viewport.set(L,I,_,w),i.setRenderTarget(n),i.setScissorTest(!0),i.autoClear=!1,e.render(i),i.setViewport(f),i.setScissor(u),i.setScissorTest(Z),i.setRenderTarget(G),i.autoClear=W,a&&(h.target1=c.texture,h.target2=n.texture,i.setRenderTarget(d),t.render(i),i.setRenderTarget(G)),this.samples+=1/E,D===M-1&&z===A-1&&(this.samples=Math.round(this.samples)),yield}[c,d]=[d,c]}}var zm=new Je,zo=class{get material(){return this._fsQuad.material}set material(e){this._fsQuad.material.removeEventListener("recompilation",this._compileFunction),e.addEventListener("recompilation",this._compileFunction),this._fsQuad.material=e}get target(){return this._alpha?this._blendTargets[1]:this._primaryTarget}set alpha(e){this._alpha!==e&&(e||(this._blendTargets[0].dispose(),this._blendTargets[1].dispose()),this._alpha=e,this.reset())}get alpha(){return this._alpha}get isCompiling(){return!!this._compilePromise}constructor(e){this.camera=null,this.tiles=new Ue(3,3),this.stableNoise=!1,this.stableTiles=!0,this.samples=0,this._subframe=new St(0,0,1,1),this._opacityFactor=1,this._renderer=e,this._alpha=!1,this._fsQuad=new kn(new zc),this._blendQuad=new kn(new _c),this._task=null,this._currentTile=0,this._compilePromise=null,this._sobolTarget=new Mc().generate(e),this._primaryTarget=new zt(1,1,{format:qe,type:tt,magFilter:Qe,minFilter:Qe}),this._blendTargets=[new zt(1,1,{format:qe,type:tt,magFilter:Qe,minFilter:Qe}),new zt(1,1,{format:qe,type:tt,magFilter:Qe,minFilter:Qe})],this._compileFunction=()=>{let t=this.compileMaterial(this._fsQuad._mesh);t.then(()=>{this._compilePromise===t&&(this._compilePromise=null)}),this._compilePromise=t},this.material.addEventListener("recompilation",this._compileFunction)}compileMaterial(){return this._renderer.compileAsync(this._fsQuad._mesh)}setCamera(e){let{material:t}=this;t.cameraWorldMatrix.copy(e.matrixWorld),t.invProjectionMatrix.copy(e.projectionMatrixInverse),t.physicalCamera.updateFrom(e);let n=0;e.projectionMatrix.elements[15]>0&&(n=1),e.isEquirectCamera&&(n=2),t.setDefine("CAMERA_TYPE",n),this.camera=e}setSize(e,t){e=Math.ceil(e),t=Math.ceil(t),!(this._primaryTarget.width===e&&this._primaryTarget.height===t)&&(this._primaryTarget.setSize(e,t),this._blendTargets[0].setSize(e,t),this._blendTargets[1].setSize(e,t),this.reset())}getSize(e){e.x=this._primaryTarget.width,e.y=this._primaryTarget.height}dispose(){this._primaryTarget.dispose(),this._blendTargets[0].dispose(),this._blendTargets[1].dispose(),this._sobolTarget.dispose(),this._fsQuad.dispose(),this._blendQuad.dispose(),this._task=null}reset(){let{_renderer:e,_primaryTarget:t,_blendTargets:n}=this,r=e.getRenderTarget(),s=e.getClearAlpha();e.getClearColor(zm),e.setRenderTarget(t),e.setClearColor(0,0),e.clearColor(),e.setRenderTarget(n[0]),e.setClearColor(0,0),e.clearColor(),e.setRenderTarget(n[1]),e.setClearColor(0,0),e.clearColor(),e.setClearColor(zm,s),e.setRenderTarget(r),this.samples=0,this._task=null,this.material.stratifiedTexture.stableNoise=this.stableNoise,this.stableNoise&&(this.material.seed=0,this.material.stratifiedTexture.reset())}update(){this.material.onBeforeRender(),!this.isCompiling&&(this._task||(this._task=BS.call(this)),this._task.next())}};var Rr=new Ue,km=new Ue,kc=new io,Hc=new Je,Gc=class extends Rt{constructor(e=512,t=512){super(new Uint16Array(e*t*4),e,t,qe,ht,ai,rn,Pt,lt,lt),this.generationCallback=null}update(){this.dispose(),this.needsUpdate=!0;let{data:e,width:t,height:n}=this.image;for(let r=0;r<t;r++)for(let s=0;s<n;s++){km.set(t,n),Rr.set(r/t,s/n),Rr.x-=.5,Rr.y=1-Rr.y,kc.theta=Rr.x*2*Math.PI,kc.phi=Rr.y*Math.PI,kc.radius=1,this.generationCallback(kc,Rr,km,Hc);let a=4*(s*t+r);e[a+0]=pe.toHalfFloat(Hc.r),e[a+1]=pe.toHalfFloat(Hc.g),e[a+2]=pe.toHalfFloat(Hc.b),e[a+3]=pe.toHalfFloat(1)}}copy(e){return super.copy(e),this.generationCallback=e.generationCallback,this}};var Hm=new H,Vc=class extends Gc{constructor(e=512){super(e,e),this.topColor=new Je().set(16777215),this.bottomColor=new Je().set(0),this.exponent=2,this.generationCallback=(t,n,r,s)=>{Hm.setFromSpherical(t);let o=Hm.y*.5+.5;s.lerpColors(this.bottomColor,this.topColor,o**this.exponent)}}copy(e){return super.copy(e),this.topColor.copy(e.topColor),this.bottomColor.copy(e.bottomColor),this}};var Wc=class extends $t{get map(){return this.uniforms.map.value}set map(e){this.uniforms.map.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}constructor(e){super({uniforms:{map:{value:null},opacity:{value:1}},vertexShader:`
				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,fragmentShader:`
				uniform sampler2D map;
				uniform float opacity;
				varying vec2 vUv;

				vec4 clampedTexelFatch( sampler2D map, ivec2 px, int lod ) {

					vec4 res = texelFetch( map, ivec2( px.x, px.y ), 0 );

					#if defined( TONE_MAPPING )

					res.xyz = toneMapping( res.xyz );

					#endif

			  		return linearToOutputTexel( res );

				}

				void main() {

					vec2 size = vec2( textureSize( map, 0 ) );
					vec2 pxUv = vUv * size;
					vec2 pxCurr = floor( pxUv );
					vec2 pxFrac = fract( pxUv ) - 0.5;
					vec2 pxOffset;
					pxOffset.x = pxFrac.x > 0.0 ? 1.0 : - 1.0;
					pxOffset.y = pxFrac.y > 0.0 ? 1.0 : - 1.0;

					vec2 pxNext = clamp( pxOffset + pxCurr, vec2( 0.0 ), size - 1.0 );
					vec2 alpha = abs( pxFrac );

					vec4 p1 = mix(
						clampedTexelFatch( map, ivec2( pxCurr.x, pxCurr.y ), 0 ),
						clampedTexelFatch( map, ivec2( pxNext.x, pxCurr.y ), 0 ),
						alpha.x
					);

					vec4 p2 = mix(
						clampedTexelFatch( map, ivec2( pxCurr.x, pxNext.y ), 0 ),
						clampedTexelFatch( map, ivec2( pxNext.x, pxNext.y ), 0 ),
						alpha.x
					);

					gl_FragColor = mix( p1, p2, alpha.y );
					gl_FragColor.a *= opacity;
					#include <premultiplied_alpha_fragment>

				}
			`}),this.setValues(e)}};var Jh=class extends $t{constructor(){super({uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:`
				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`
				#define ENVMAP_TYPE_CUBE_UV

				uniform samplerCube envMap;
				uniform float flipEnvMap;
				varying vec2 vUv;

				#include <common>
				#include <cube_uv_reflection_fragment>

				${Bc}

				void main() {

					vec3 rayDirection = equirectUvToDirection( vUv );
					rayDirection.x *= flipEnvMap;
					gl_FragColor = textureCube( envMap, rayDirection );

				}`}),this.depthWrite=!1,this.depthTest=!1}},ko=class{constructor(e){this._renderer=e,this._quad=new kn(new Jh)}generate(e,t=null,n=null){if(!e.isCubeTexture)throw new Error("CubeToEquirectMaterial: Source can only be cube textures.");let r=e.images[0],s=this._renderer,o=this._quad;t===null&&(t=4*r.height),n===null&&(n=2*r.height);let a=new zt(t,n,{type:tt,colorSpace:r.colorSpace}),l=r.height,u=Math.log2(l)-2,f=1/l,h=1/(3*Math.max(Math.pow(2,u),112));o.material.defines.CUBEUV_MAX_MIP=`${u}.0`,o.material.defines.CUBEUV_TEXEL_WIDTH=h,o.material.defines.CUBEUV_TEXEL_HEIGHT=f,o.material.uniforms.envMap.value=e,o.material.uniforms.flipEnvMap.value=e.isRenderTargetTexture?1:-1,o.material.needsUpdate=!0;let c=s.getRenderTarget(),d=s.autoClear;s.autoClear=!0,s.setRenderTarget(a),o.render(s),s.setRenderTarget(c),s.autoClear=d;let x=new Uint16Array(t*n*4),S=new Float32Array(t*n*4);s.readRenderTargetPixels(a,0,0,t,n,S),a.dispose();for(let g=0,y=S.length;g<y;g++)x[g]=pe.toHalfFloat(S[g]);let p=new Rt(x,t,n,qe,ht);return p.minFilter=Ou,p.magFilter=lt,p.wrapS=rn,p.wrapT=rn,p.mapping=ai,p.needsUpdate=!0,p}dispose(){this._quad.dispose()}};function zS(i){return i.extensions.get("EXT_float_blend")}var Rs=new Ue,Xc=class{get multipleImportanceSampling(){return!!this._pathTracer.material.defines.FEATURE_MIS}set multipleImportanceSampling(e){this._pathTracer.material.setDefine("FEATURE_MIS",e?1:0)}get transmissiveBounces(){return this._pathTracer.material.transmissiveBounces}set transmissiveBounces(e){this._pathTracer.material.transmissiveBounces=e}get bounces(){return this._pathTracer.material.bounces}set bounces(e){this._pathTracer.material.bounces=e}get filterGlossyFactor(){return this._pathTracer.material.filterGlossyFactor}set filterGlossyFactor(e){this._pathTracer.material.filterGlossyFactor=e}get samples(){return this._pathTracer.samples}get target(){return this._pathTracer.target}get tiles(){return this._pathTracer.tiles}get stableNoise(){return this._pathTracer.stableNoise}set stableNoise(e){this._pathTracer.stableNoise=e}get isCompiling(){return!!this._pathTracer.isCompiling}constructor(e){console.warn('WebGLPathTracer: This class has been deprecated and will be removed in a future release. Use "WebGPUPathTracer" instead.'),this._renderer=e,this._generator=new vc,this._pathTracer=new zo(e),this._queueReset=!1,this._clock=new no,this._compilePromise=null,this._lowResPathTracer=new zo(e),this._lowResPathTracer.tiles.set(1,1),this._quad=new kn(new Wc({map:null,transparent:!0,blending:_n,premultipliedAlpha:e.getContextAttributes().premultipliedAlpha})),this._materials=null,this._previousEnvironment=null,this._previousBackground=null,this._internalBackground=null,this.renderDelay=100,this.minSamples=5,this.fadeDuration=500,this.enablePathTracing=!0,this.pausePathTracing=!1,this.dynamicLowRes=!1,this.lowResScale=.25,this.renderScale=1,this.synchronizeRenderSize=!0,this.rasterizeScene=!0,this.renderToCanvas=!0,this.textureSize=new Ue(1024,1024),this.rasterizeSceneCallback=(t,n)=>{this._renderer.render(t,n)},this.renderToCanvasCallback=(t,n,r)=>{let s=n.autoClear;n.autoClear=!1,r.render(n),n.autoClear=s},this.setScene(new fr,new cn)}setBVHWorker(e){this._generator.setBVHWorker(e)}setScene(e,t,n={}){e.updateMatrixWorld(!0),t.updateMatrixWorld();let r=this._generator;if(r.setObjects(e),this._buildAsync)return r.generateAsync(n.onProgress).then(s=>this._updateFromResults(e,t,s));{let s=r.generate();return this._updateFromResults(e,t,s)}}setSceneAsync(...e){this._buildAsync=!0;let t=this.setScene(...e);return this._buildAsync=!1,t}setCamera(e){this.camera=e,this.updateCamera()}updateCamera(){let e=this.camera;e.updateMatrixWorld(),this._pathTracer.setCamera(e),this._lowResPathTracer.setCamera(e),this.reset()}updateMaterials(){let e=this._pathTracer.material,t=this._renderer,n=this._materials,r=this.textureSize,s=lm(n);e.textures.setTextures(t,s,r.x,r.y),e.materials.updateFrom(n,s),this.reset()}updateLights(){let e=this.scene,t=this._renderer,n=this._pathTracer.material,r=cm(e),s=am(r);n.lights.updateFrom(r,s),n.iesProfiles.setTextures(t,s),this.reset()}updateEnvironment(){let e=this.scene,t=this._pathTracer.material;if(this._internalBackground&&(this._internalBackground.dispose(),this._internalBackground=null),t.backgroundBlur=e.backgroundBlurriness,t.backgroundIntensity=e.backgroundIntensity??1,t.backgroundRotation.makeRotationFromEuler(e.backgroundRotation).invert(),e.background===null)t.backgroundMap=null,t.backgroundAlpha=0;else if(e.background.isColor){this._colorBackground=this._colorBackground||new Vc(16);let n=this._colorBackground;n.topColor.equals(e.background)||(n.topColor.set(e.background),n.bottomColor.set(e.background),n.update()),t.backgroundMap=n,t.backgroundAlpha=1}else if(e.background.isCubeTexture){if(e.background!==this._previousBackground){let n=new ko(this._renderer).generate(e.background);this._internalBackground=n,t.backgroundMap=n,t.backgroundAlpha=1}}else t.backgroundMap=e.background,t.backgroundAlpha=1;if(t.environmentIntensity=e.environment!==null?e.environmentIntensity??1:0,t.environmentRotation.makeRotationFromEuler(e.environmentRotation).invert(),this._previousEnvironment!==e.environment&&e.environment!==null)if(e.environment.isCubeTexture){let n=new ko(this._renderer).generate(e.environment);t.envMapInfo.updateFrom(n)}else t.envMapInfo.updateFrom(e.environment);this._previousEnvironment=e.environment,this._previousBackground=e.background,this.reset()}_updateFromResults(e,t,n){let{materials:r,geometry:s,bvh:o,bvhChanged:a,needsMaterialIndexUpdate:l}=n;this._materials=r;let f=this._pathTracer.material;return a&&(f.bvh.updateFrom(o),f.attributesArray.updateFrom(s.attributes.normal,s.attributes.tangent,s.attributes.uv,s.attributes.color)),l&&f.materialIndexAttribute.updateFrom(s.attributes.materialIndex),this._previousScene=e,this.scene=e,this.camera=t,this.updateCamera(),this.updateMaterials(),this.updateEnvironment(),this.updateLights(),n}renderSample(){let e=this._lowResPathTracer,t=this._pathTracer,n=this._renderer,r=this._clock,s=this._quad;this._updateScale(),this._queueReset&&(t.reset(),e.reset(),this._queueReset=!1,s.material.opacity=0,r.start());let o=r.getDelta()*1e3,a=r.getElapsedTime()*1e3;if(!this.pausePathTracing&&this.enablePathTracing&&this.renderDelay<=a&&!this.isCompiling&&t.update(),t.alpha=t.material.backgroundAlpha!==1||!zS(n),e.alpha=t.alpha,this.renderToCanvas){let l=this._renderer,u=this.minSamples;if(a>=this.renderDelay&&this.samples>=this.minSamples&&(this.fadeDuration!==0?s.material.opacity=Math.min(s.material.opacity+o/this.fadeDuration,1):s.material.opacity=1),!this.enablePathTracing||this.samples<u||s.material.opacity<1){if(this.dynamicLowRes&&!this.isCompiling){e.samples<1&&(e.material=t.material,e.update());let f=s.material.opacity;s.material.opacity=1-s.material.opacity,s.material.map=e.target.texture,s.render(l),s.material.opacity=f}(!this.dynamicLowRes&&this.rasterizeScene||this.dynamicLowRes&&this.isCompiling)&&this.rasterizeSceneCallback(this.scene,this.camera)}this.enablePathTracing&&s.material.opacity>0&&(s.material.opacity<1&&(s.material.blending=this.dynamicLowRes?so:oi),s.material.map=t.target.texture,this.renderToCanvasCallback(t.target,l,s),s.material.blending=_n)}}reset(){this._queueReset=!0,this._pathTracer.samples=0}dispose(){this._quad.dispose(),this._quad.material.dispose(),this._pathTracer.dispose()}_updateScale(){if(this.synchronizeRenderSize){this._renderer.getDrawingBufferSize(Rs);let e=Math.floor(this.renderScale*Rs.x),t=Math.floor(this.renderScale*Rs.y);if(this._pathTracer.getSize(Rs),Rs.x!==e||Rs.y!==t){let n=this.lowResScale;this._pathTracer.setSize(e,t),this._lowResPathTracer.setSize(Math.floor(e*n),Math.floor(t*n))}}}getRenderTime(){return this._clock.getElapsedTime()*1e3}};var qc=class extends mr{constructor(e){super(e),this.type=ht}parse(e){let o=function(w,L){switch(w){case 1:throw new Error("THREE.HDRLoader: Read Error: "+(L||""));case 2:throw new Error("THREE.HDRLoader: Write Error: "+(L||""));case 3:throw new Error("THREE.HDRLoader: Bad File Format: "+(L||""));default:case 4:throw new Error("THREE.HDRLoader: Memory Error: "+(L||""))}},h=function(w,L,I){L=L||1024;let U=w.pos,z=-1,D=0,G="",W=String.fromCharCode.apply(null,new Uint16Array(w.subarray(U,U+128)));for(;0>(z=W.indexOf(`
`))&&D<L&&U<w.byteLength;)G+=W,D+=W.length,U+=128,W=String.fromCharCode.apply(null,new Uint16Array(w.subarray(U,U+128)));return-1<z?(I!==!1&&(w.pos+=D+z+1),G+W.slice(0,z)):!1},c=function(w){let L=/^#\?(\S+)/,I=/^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,N=/^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,U=/^\s*FORMAT=(\S+)\s*$/,z=/^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,D={valid:0,string:"",comments:"",programtype:"RGBE",format:"",gamma:1,exposure:1,width:0,height:0},G,W;for((w.pos>=w.byteLength||!(G=h(w)))&&o(1,"no header found"),(W=G.match(L))||o(3,"bad initial token"),D.valid|=1,D.programtype=W[1],D.string+=G+`
`;G=h(w),G!==!1;){if(D.string+=G+`
`,G.charAt(0)==="#"){D.comments+=G+`
`;continue}if((W=G.match(I))&&(D.gamma=parseFloat(W[1])),(W=G.match(N))&&(D.exposure=parseFloat(W[1])),(W=G.match(U))&&(D.valid|=2,D.format=W[1]),(W=G.match(z))&&(D.valid|=4,D.height=parseInt(W[1],10),D.width=parseInt(W[2],10)),D.valid&2&&D.valid&4)break}return D.valid&2||o(3,"missing format specifier"),D.valid&4||o(3,"missing image size specifier"),D},d=function(w,L,I){let N=L;if(N<8||N>32767||w[0]!==2||w[1]!==2||w[2]&128)return new Uint8Array(w);N!==(w[2]<<8|w[3])&&o(3,"wrong scanline width");let U=new Uint8Array(4*L*I);U.length||o(4,"unable to allocate buffer space");let z=0,D=0,G=4*N,W=new Uint8Array(4),Z=new Uint8Array(G),le=I;for(;le>0&&D<w.byteLength;){D+4>w.byteLength&&o(1),W[0]=w[D++],W[1]=w[D++],W[2]=w[D++],W[3]=w[D++],(W[0]!=2||W[1]!=2||(W[2]<<8|W[3])!=N)&&o(3,"bad rgbe scanline format");let J=0,se;for(;J<G&&D<w.byteLength;){se=w[D++];let ye=se>128;if(ye&&(se-=128),(se===0||J+se>G)&&o(3,"bad scanline data"),ye){let Le=w[D++];for(let j=0;j<se;j++)Z[J++]=Le}else Z.set(w.subarray(D,D+se),J),J+=se,D+=se}let ae=N;for(let ye=0;ye<ae;ye++){let Le=0;U[z]=Z[ye+Le],Le+=N,U[z+1]=Z[ye+Le],Le+=N,U[z+2]=Z[ye+Le],Le+=N,U[z+3]=Z[ye+Le],z+=4}le--}return U},x=function(w,L,I,N){let U=w[L+3],z=Math.pow(2,U-128)/255;I[N+0]=w[L+0]*z,I[N+1]=w[L+1]*z,I[N+2]=w[L+2]*z,I[N+3]=1},S=function(w,L,I,N){let U=w[L+3],z=Math.pow(2,U-128)/255;I[N+0]=pe.toHalfFloat(Math.min(w[L+0]*z,65504)),I[N+1]=pe.toHalfFloat(Math.min(w[L+1]*z,65504)),I[N+2]=pe.toHalfFloat(Math.min(w[L+2]*z,65504)),I[N+3]=pe.toHalfFloat(1)},p=new Uint8Array(e);p.pos=0;let g=c(p),y=g.width,T=g.height,M=d(p.subarray(p.pos),y,T),A,E,_;switch(this.type){case tt:_=M.length/4;let w=new Float32Array(_*4);for(let I=0;I<_;I++)x(M,I*4,w,I*4);A=w,E=tt;break;case ht:_=M.length/4;let L=new Uint16Array(_*4);for(let I=0;I<_;I++)S(M,I*4,L,I*4);A=L,E=ht;break;default:throw new Error("THREE.HDRLoader: Unsupported type: "+this.type)}return{width:y,height:T,data:A,header:g.string,gamma:g.gamma,exposure:g.exposure,type:E,colorSpace:un,minFilter:lt,magFilter:lt,generateMipmaps:!1,flipY:!0}}setDataType(e){return this.type=e,this}};var qt=Uint8Array,Hn=Uint16Array,of=Int32Array,Yc=new qt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Zc=new qt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),ef=new qt([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),Zm=function(i,e){for(var t=new Hn(31),n=0;n<31;++n)t[n]=e+=1<<i[n-1];for(var r=new of(t[30]),n=1;n<30;++n)for(var s=t[n];s<t[n+1];++s)r[s]=s-t[n]<<5|n;return{b:t,r}},$m=Zm(Yc,2),Jm=$m.b,tf=$m.r;Jm[28]=258,tf[258]=28;var Km=Zm(Zc,0),kS=Km.b,Gm=Km.r,nf=new Hn(32768);for(Tt=0;Tt<32768;++Tt)Ii=(Tt&43690)>>1|(Tt&21845)<<1,Ii=(Ii&52428)>>2|(Ii&13107)<<2,Ii=(Ii&61680)>>4|(Ii&3855)<<4,nf[Tt]=((Ii&65280)>>8|(Ii&255)<<8)>>1;var Ii,Tt,fi=(function(i,e,t){for(var n=i.length,r=0,s=new Hn(e);r<n;++r)i[r]&&++s[i[r]-1];var o=new Hn(e);for(r=1;r<e;++r)o[r]=o[r-1]+s[r-1]<<1;var a;if(t){a=new Hn(1<<e);var l=15-e;for(r=0;r<n;++r)if(i[r])for(var u=r<<4|i[r],f=e-i[r],h=o[i[r]-1]++<<f,c=h|(1<<f)-1;h<=c;++h)a[nf[h]>>l]=u}else for(a=new Hn(n),r=0;r<n;++r)i[r]&&(a[r]=nf[o[i[r]-1]++]>>15-i[r]);return a}),ir=new qt(288);for(Tt=0;Tt<144;++Tt)ir[Tt]=8;var Tt;for(Tt=144;Tt<256;++Tt)ir[Tt]=9;var Tt;for(Tt=256;Tt<280;++Tt)ir[Tt]=7;var Tt;for(Tt=280;Tt<288;++Tt)ir[Tt]=8;var Tt,Vo=new qt(32);for(Tt=0;Tt<32;++Tt)Vo[Tt]=5;var Tt,HS=fi(ir,9,0),GS=fi(ir,9,1),VS=fi(Vo,5,0),WS=fi(Vo,5,1),Kh=function(i){for(var e=i[0],t=1;t<i.length;++t)i[t]>e&&(e=i[t]);return e},ei=function(i,e,t){var n=e/8|0;return(i[n]|i[n+1]<<8)>>(e&7)&t},Qh=function(i,e){var t=e/8|0;return(i[t]|i[t+1]<<8|i[t+2]<<16)>>(e&7)},af=function(i){return(i+7)/8|0},lf=function(i,e,t){return(e==null||e<0)&&(e=0),(t==null||t>i.length)&&(t=i.length),new qt(i.subarray(e,t))};var XS=["unexpected EOF","invalid block type","invalid length/literal","invalid distance","stream finished","no stream handler",,"no callback","invalid UTF-8 data","extra field too long","date not in range 1980-2099","filename too long","stream finishing","invalid zip data"],Nn=function(i,e,t){var n=new Error(e||XS[i]);if(n.code=i,Error.captureStackTrace&&Error.captureStackTrace(n,Nn),!t)throw n;return n},qS=function(i,e,t,n){var r=i.length,s=n?n.length:0;if(!r||e.f&&!e.l)return t||new qt(0);var o=!t,a=o||e.i!=2,l=e.i;o&&(t=new qt(r*3));var u=function(Be){var at=t.length;if(Be>at){var ft=new qt(Math.max(at*2,Be));ft.set(t),t=ft}},f=e.f||0,h=e.p||0,c=e.b||0,d=e.l,x=e.d,S=e.m,p=e.n,g=r*8;do{if(!d){f=ei(i,h,1);var y=ei(i,h+1,3);if(h+=3,y)if(y==1)d=GS,x=WS,S=9,p=5;else if(y==2){var E=ei(i,h,31)+257,_=ei(i,h+10,15)+4,w=E+ei(i,h+5,31)+1;h+=14;for(var L=new qt(w),I=new qt(19),N=0;N<_;++N)I[ef[N]]=ei(i,h+N*3,7);h+=_*3;for(var U=Kh(I),z=(1<<U)-1,D=fi(I,U,1),N=0;N<w;){var G=D[ei(i,h,z)];h+=G&15;var T=G>>4;if(T<16)L[N++]=T;else{var W=0,Z=0;for(T==16?(Z=3+ei(i,h,3),h+=2,W=L[N-1]):T==17?(Z=3+ei(i,h,7),h+=3):T==18&&(Z=11+ei(i,h,127),h+=7);Z--;)L[N++]=W}}var le=L.subarray(0,E),J=L.subarray(E);S=Kh(le),p=Kh(J),d=fi(le,S,1),x=fi(J,p,1)}else Nn(1);else{var T=af(h)+4,M=i[T-4]|i[T-3]<<8,A=T+M;if(A>r){l&&Nn(0);break}a&&u(c+M),t.set(i.subarray(T,A),c),e.b=c+=M,e.p=h=A*8,e.f=f;continue}if(h>g){l&&Nn(0);break}}a&&u(c+131072);for(var se=(1<<S)-1,ae=(1<<p)-1,ye=h;;ye=h){var W=d[Qh(i,h)&se],Le=W>>4;if(h+=W&15,h>g){l&&Nn(0);break}if(W||Nn(2),Le<256)t[c++]=Le;else if(Le==256){ye=h,d=null;break}else{var j=Le-254;if(Le>264){var N=Le-257,he=Yc[N];j=ei(i,h,(1<<he)-1)+Jm[N],h+=he}var Ce=x[Qh(i,h)&ae],Oe=Ce>>4;Ce||Nn(3),h+=Ce&15;var J=kS[Oe];if(Oe>3){var he=Zc[Oe];J+=Qh(i,h)&(1<<he)-1,h+=he}if(h>g){l&&Nn(0);break}a&&u(c+131072);var fe=c+j;if(c<J){var ke=s-J,mt=Math.min(J,fe);for(ke+c<0&&Nn(3);c<mt;++c)t[c]=n[ke+c]}for(;c<fe;++c)t[c]=t[c-J]}}e.l=d,e.p=ye,e.b=c,e.f=f,d&&(f=1,e.m=S,e.d=x,e.n=p)}while(!f);return c!=t.length&&o?lf(t,0,c):t.subarray(0,c)},Pi=function(i,e,t){t<<=e&7;var n=e/8|0;i[n]|=t,i[n+1]|=t>>8},Ho=function(i,e,t){t<<=e&7;var n=e/8|0;i[n]|=t,i[n+1]|=t>>8,i[n+2]|=t>>16},jh=function(i,e){for(var t=[],n=0;n<i.length;++n)i[n]&&t.push({s:n,f:i[n]});var r=t.length,s=t.slice();if(!r)return{t:jm,l:0};if(r==1){var o=new qt(t[0].s+1);return o[t[0].s]=1,{t:o,l:1}}t.sort(function(A,E){return A.f-E.f}),t.push({s:-1,f:25001});var a=t[0],l=t[1],u=0,f=1,h=2;for(t[0]={s:-1,f:a.f+l.f,l:a,r:l};f!=r-1;)a=t[t[u].f<t[h].f?u++:h++],l=t[u!=f&&t[u].f<t[h].f?u++:h++],t[f++]={s:-1,f:a.f+l.f,l:a,r:l};for(var c=s[0].s,n=1;n<r;++n)s[n].s>c&&(c=s[n].s);var d=new Hn(c+1),x=rf(t[f-1],d,0);if(x>e){var n=0,S=0,p=x-e,g=1<<p;for(s.sort(function(E,_){return d[_.s]-d[E.s]||E.f-_.f});n<r;++n){var y=s[n].s;if(d[y]>e)S+=g-(1<<x-d[y]),d[y]=e;else break}for(S>>=p;S>0;){var T=s[n].s;d[T]<e?S-=1<<e-d[T]++-1:++n}for(;n>=0&&S;--n){var M=s[n].s;d[M]==e&&(--d[M],++S)}x=e}return{t:new qt(d),l:x}},rf=function(i,e,t){return i.s==-1?Math.max(rf(i.l,e,t+1),rf(i.r,e,t+1)):e[i.s]=t},Vm=function(i){for(var e=i.length;e&&!i[--e];);for(var t=new Hn(++e),n=0,r=i[0],s=1,o=function(l){t[n++]=l},a=1;a<=e;++a)if(i[a]==r&&a!=e)++s;else{if(!r&&s>2){for(;s>138;s-=138)o(32754);s>2&&(o(s>10?s-11<<5|28690:s-3<<5|12305),s=0)}else if(s>3){for(o(r),--s;s>6;s-=6)o(8304);s>2&&(o(s-3<<5|8208),s=0)}for(;s--;)o(r);s=1,r=i[a]}return{c:t.subarray(0,n),n:e}},Go=function(i,e){for(var t=0,n=0;n<e.length;++n)t+=i[n]*e[n];return t},Qm=function(i,e,t){var n=t.length,r=af(e+2);i[r]=n&255,i[r+1]=n>>8,i[r+2]=i[r]^255,i[r+3]=i[r+1]^255;for(var s=0;s<n;++s)i[r+s+4]=t[s];return(r+4+n)*8},Wm=function(i,e,t,n,r,s,o,a,l,u,f){Pi(e,f++,t),++r[256];for(var h=jh(r,15),c=h.t,d=h.l,x=jh(s,15),S=x.t,p=x.l,g=Vm(c),y=g.c,T=g.n,M=Vm(S),A=M.c,E=M.n,_=new Hn(19),w=0;w<y.length;++w)++_[y[w]&31];for(var w=0;w<A.length;++w)++_[A[w]&31];for(var L=jh(_,7),I=L.t,N=L.l,U=19;U>4&&!I[ef[U-1]];--U);var z=u+5<<3,D=Go(r,ir)+Go(s,Vo)+o,G=Go(r,c)+Go(s,S)+o+14+3*U+Go(_,I)+2*_[16]+3*_[17]+7*_[18];if(l>=0&&z<=D&&z<=G)return Qm(e,f,i.subarray(l,l+u));var W,Z,le,J;if(Pi(e,f,1+(G<D)),f+=2,G<D){W=fi(c,d,0),Z=c,le=fi(S,p,0),J=S;var se=fi(I,N,0);Pi(e,f,T-257),Pi(e,f+5,E-1),Pi(e,f+10,U-4),f+=14;for(var w=0;w<U;++w)Pi(e,f+3*w,I[ef[w]]);f+=3*U;for(var ae=[y,A],ye=0;ye<2;++ye)for(var Le=ae[ye],w=0;w<Le.length;++w){var j=Le[w]&31;Pi(e,f,se[j]),f+=I[j],j>15&&(Pi(e,f,Le[w]>>5&127),f+=Le[w]>>12)}}else W=HS,Z=ir,le=VS,J=Vo;for(var w=0;w<a;++w){var he=n[w];if(he>255){var j=he>>18&31;Ho(e,f,W[j+257]),f+=Z[j+257],j>7&&(Pi(e,f,he>>23&31),f+=Yc[j]);var Ce=he&31;Ho(e,f,le[Ce]),f+=J[Ce],Ce>3&&(Ho(e,f,he>>5&8191),f+=Zc[Ce])}else Ho(e,f,W[he]),f+=Z[he]}return Ho(e,f,W[256]),f+Z[256]},YS=new of([65540,131080,131088,131104,262176,1048704,1048832,2114560,2117632]),jm=new qt(0),ZS=function(i,e,t,n,r,s){var o=s.z||i.length,a=new qt(n+o+5*(1+Math.ceil(o/7e3))+r),l=a.subarray(n,a.length-r),u=s.l,f=(s.r||0)&7;if(e){f&&(l[0]=s.r>>3);for(var h=YS[e-1],c=h>>13,d=h&8191,x=(1<<t)-1,S=s.p||new Hn(32768),p=s.h||new Hn(x+1),g=Math.ceil(t/3),y=2*g,T=function(rt){return(i[rt]^i[rt+1]<<g^i[rt+2]<<y)&x},M=new of(25e3),A=new Hn(288),E=new Hn(32),_=0,w=0,L=s.i||0,I=0,N=s.w||0,U=0;L+2<o;++L){var z=T(L),D=L&32767,G=p[z];if(S[D]=G,p[z]=D,N<=L){var W=o-L;if((_>7e3||I>24576)&&(W>423||!u)){f=Wm(i,l,0,M,A,E,w,I,U,L-U,f),I=_=w=0,U=L;for(var Z=0;Z<286;++Z)A[Z]=0;for(var Z=0;Z<30;++Z)E[Z]=0}var le=2,J=0,se=d,ae=D-G&32767;if(W>2&&z==T(L-ae))for(var ye=Math.min(c,W)-1,Le=Math.min(32767,L),j=Math.min(258,W);ae<=Le&&--se&&D!=G;){if(i[L+le]==i[L+le-ae]){for(var he=0;he<j&&i[L+he]==i[L+he-ae];++he);if(he>le){if(le=he,J=ae,he>ye)break;for(var Ce=Math.min(ae,he-2),Oe=0,Z=0;Z<Ce;++Z){var fe=L-ae+Z&32767,ke=S[fe],mt=fe-ke&32767;mt>Oe&&(Oe=mt,G=fe)}}}D=G,G=S[D],ae+=D-G&32767}if(J){M[I++]=268435456|tf[le]<<18|Gm[J];var Be=tf[le]&31,at=Gm[J]&31;w+=Yc[Be]+Zc[at],++A[257+Be],++E[at],N=L+le,++_}else M[I++]=i[L],++A[i[L]]}}for(L=Math.max(L,N);L<o;++L)M[I++]=i[L],++A[i[L]];f=Wm(i,l,u,M,A,E,w,I,U,L-U,f),u||(s.r=f&7|l[f/8|0]<<3,f-=7,s.h=p,s.p=S,s.i=L,s.w=N)}else{for(var L=s.w||0;L<o+u;L+=65535){var ft=L+65535;ft>=o&&(l[f/8|0]=u,ft=o),f=Qm(l,f+1,i.subarray(L,ft))}s.i=o}return lf(a,0,n+af(f)+r)},$S=(function(){for(var i=new Int32Array(256),e=0;e<256;++e){for(var t=e,n=9;--n;)t=(t&1&&-306674912)^t>>>1;i[e]=t}return i})(),JS=function(){var i=-1;return{p:function(e){for(var t=i,n=0;n<e.length;++n)t=$S[t&255^e[n]]^t>>>8;i=t},d:function(){return~i}}};var KS=function(i,e,t,n,r){if(!r&&(r={l:1},e.dictionary)){var s=e.dictionary.subarray(-32768),o=new qt(s.length+i.length);o.set(s),o.set(i,s.length),i=o,r.w=s.length}return ZS(i,e.level==null?6:e.level,e.mem==null?r.l?Math.ceil(Math.max(8,Math.min(13,Math.log(i.length)))*1.5):20:12+e.mem,t,n,r)},eg=function(i,e){var t={};for(var n in i)t[n]=i[n];for(var n in e)t[n]=e[n];return t};var fn=function(i,e,t){for(;t;++e)i[e]=t,t>>>=8};var QS=function(i,e){return((i[0]&15)!=8||i[0]>>4>7||(i[0]<<8|i[1])%31)&&Nn(6,"invalid zlib data"),(i[1]>>5&1)==+!e&&Nn(6,"invalid zlib data: "+(i[1]&32?"need":"unexpected")+" dictionary"),(i[1]>>3&4)+2};function jS(i,e){return KS(i,e||{},0,0)}function Cs(i,e){return qS(i.subarray(QS(i,e&&e.dictionary),-4),{i:2},e&&e.out,e&&e.dictionary)}var tg=function(i,e,t,n){for(var r in i){var s=i[r],o=e+r,a=n;Array.isArray(s)&&(a=eg(n,s[1]),s=s[0]),ArrayBuffer.isView(s)?t[o]=[s,a]:(t[o+="/"]=[new qt(0),a],tg(s,o,t,n))}},Xm=typeof TextEncoder<"u"&&new TextEncoder,eb=typeof TextDecoder<"u"&&new TextDecoder,tb=0;try{eb.decode(jm,{stream:!0}),tb=1}catch{}function qm(i,e){if(e){for(var t=new qt(i.length),n=0;n<i.length;++n)t[n]=i.charCodeAt(n);return t}if(Xm)return Xm.encode(i);for(var r=i.length,s=new qt(i.length+(i.length>>1)),o=0,a=function(f){s[o++]=f},n=0;n<r;++n){if(o+5>s.length){var l=new qt(o+8+(r-n<<1));l.set(s),s=l}var u=i.charCodeAt(n);u<128||e?a(u):u<2048?(a(192|u>>6),a(128|u&63)):u>55295&&u<57344?(u=65536+(u&1047552)|i.charCodeAt(++n)&1023,a(240|u>>18),a(128|u>>12&63),a(128|u>>6&63),a(128|u&63)):(a(224|u>>12),a(128|u>>6&63),a(128|u&63))}return lf(s,0,o)}var sf=function(i){var e=0;if(i)for(var t in i){var n=i[t].length;n>65535&&Nn(9),e+=n+4}return e},Ym=function(i,e,t,n,r,s,o,a){var l=n.length,u=t.extra,f=a&&a.length,h=sf(u);fn(i,e,o!=null?33639248:67324752),e+=4,o!=null&&(i[e++]=20,i[e++]=t.os),i[e]=20,e+=2,i[e++]=t.flag<<1|(s<0&&8),i[e++]=r&&8,i[e++]=t.compression&255,i[e++]=t.compression>>8;var c=new Date(t.mtime==null?Date.now():t.mtime),d=c.getFullYear()-1980;if((d<0||d>119)&&Nn(10),fn(i,e,d<<25|c.getMonth()+1<<21|c.getDate()<<16|c.getHours()<<11|c.getMinutes()<<5|c.getSeconds()>>1),e+=4,s!=-1&&(fn(i,e,t.crc),fn(i,e+4,s<0?-s-2:s),fn(i,e+8,t.size)),fn(i,e+12,l),fn(i,e+14,h),e+=16,o!=null&&(fn(i,e,f),fn(i,e+6,t.attrs),fn(i,e+10,o),e+=14),i.set(n,e),e+=l,h)for(var x in u){var S=u[x],p=S.length;fn(i,e,+x),fn(i,e+2,p),i.set(S,e+4),e+=4+p}return f&&(i.set(a,e),e+=f),e},nb=function(i,e,t,n,r){fn(i,e,101010256),fn(i,e+8,t),fn(i,e+10,t),fn(i,e+12,n),fn(i,e+16,r)};function ng(i,e){e||(e={});var t={},n=[];tg(i,"",t,e);var r=0,s=0;for(var o in t){var a=t[o],l=a[0],u=a[1],f=u.level==0?0:8,h=qm(o),c=h.length,d=u.comment,x=d&&qm(d),S=x&&x.length,p=sf(u.extra);c>65535&&Nn(11);var g=f?jS(l,u):l,y=g.length,T=JS();T.p(l),n.push(eg(u,{size:l.length,crc:T.d(),c:g,f:h,m:x,u:c!=o.length||x&&d.length!=S,o:r,compression:f})),r+=30+c+p+y,s+=76+2*(c+p)+(S||0)+y}for(var M=new qt(s+22),A=r,E=s-r,_=0;_<n.length;++_){var h=n[_];Ym(M,h.o,h,h.f,h.u,h.c.length);var w=30+h.f.length+sf(h.extra);M.set(h.c,h.o+w),Ym(M,r,h,h.f,h.u,h.c.length,h.o,h.m),r+=16+w+(h.m?h.m.length:0)}return nb(M,r,n.length,E,A),M}var $c=class extends mr{constructor(e){super(e),this.type=ht,this.outputFormat=qe,this.part=0}parse(e){let L=Math.pow(2.7182818,2.2),I=null,N=null;function U(v,m){let b=0;for(let P=0;P<65536;++P)(P==0||v[P>>3]&1<<(P&7))&&(m[b++]=P);let C=b-1;for(;b<65536;)m[b++]=0;return C}function z(v){for(let m=0;m<16384;m++)v[m]={},v[m].len=0,v[m].lit=0,v[m].p=null}let D={l:0,c:0,lc:0};function G(v,m,b,C,P){for(;b<v;)m=m<<8|Me(C,P),b+=8;b-=v,D.l=m>>b&(1<<v)-1,D.c=m,D.lc=b}let W=new Array(59);function Z(v){for(let b=0;b<=58;++b)W[b]=0;for(let b=0;b<65537;++b)W[v[b]]+=1;let m=0;for(let b=58;b>0;--b){let C=m+W[b]>>1;W[b]=m,m=C}for(let b=0;b<65537;++b){let C=v[b];C>0&&(v[b]=C|W[C]++<<6)}}function le(v,m,b,C,P,O){let F=m,Y=0,V=0;for(;C<=P;C++){if(F.value-m.value>b)return!1;G(6,Y,V,v,F);let X=D.l;if(Y=D.c,V=D.lc,O[C]=X,X==63){if(F.value-m.value>b)throw new Error("THREE.EXRLoader: Something wrong with hufUnpackEncTable");G(8,Y,V,v,F);let $=D.l+6;if(Y=D.c,V=D.lc,C+$>P+1)throw new Error("THREE.EXRLoader: Something wrong with hufUnpackEncTable");for(;$--;)O[C++]=0;C--}else if(X>=59){let $=X-59+2;if(C+$>P+1)throw new Error("THREE.EXRLoader: Something wrong with hufUnpackEncTable");for(;$--;)O[C++]=0;C--}}Z(O)}function J(v){return v&63}function se(v){return v>>6}function ae(v,m,b,C){for(;m<=b;m++){let P=se(v[m]),O=J(v[m]);if(P>>O)throw new Error("THREE.EXRLoader: Invalid table entry");if(O>14){let F=C[P>>O-14];if(F.len)throw new Error("THREE.EXRLoader: Invalid table entry");if(F.lit++,F.p){let Y=F.p;F.p=new Array(F.lit);for(let V=0;V<F.lit-1;++V)F.p[V]=Y[V]}else F.p=new Array(1);F.p[F.lit-1]=m}else if(O){let F=0;for(let Y=1<<14-O;Y>0;Y--){let V=C[(P<<14-O)+F];if(V.len||V.p)throw new Error("THREE.EXRLoader: Invalid table entry");V.len=O,V.lit=m,F++}}}return!0}let ye={c:0,lc:0};function Le(v,m,b,C){v=v<<8|Me(b,C),m+=8,ye.c=v,ye.lc=m}let j={c:0,lc:0};function he(v,m,b,C,P,O,F,Y,V){if(v==m){C<8&&(Le(b,C,P,O),b=ye.c,C=ye.lc),C-=8;let X=b>>C;if(X=new Uint8Array([X])[0],Y.value+X>V)return!1;let $=F[Y.value-1];for(;X-- >0;)F[Y.value++]=$}else if(Y.value<V)F[Y.value++]=v;else return!1;j.c=b,j.lc=C}function Ce(v){return v&65535}function Oe(v){let m=Ce(v);return m>32767?m-65536:m}let fe={a:0,b:0};function ke(v,m){let b=Oe(v),P=Oe(m),O=b+(P&1)+(P>>1),F=O,Y=O-P;fe.a=F,fe.b=Y}function mt(v,m){let b=Ce(v),C=Ce(m),P=b-(C>>1)&65535,O=C+P-32768&65535;fe.a=O,fe.b=P}function Be(v,m,b,C,P,O,F){let Y=F<16384,V=b>P?P:b,X=1,$,oe;for(;X<=V;)X<<=1;for(X>>=1,$=X,X>>=1;X>=1;){oe=0;let ee=oe+O*(P-$),te=O*X,de=O*$,me=C*X,ge=C*$,Ae,Ve,ue,Ye;for(;oe<=ee;oe+=de){let Se=oe,Ie=oe+C*(b-$);for(;Se<=Ie;Se+=ge){let De=Se+me,gt=Se+te,ot=gt+me;Y?(ke(v[Se+m],v[gt+m]),Ae=fe.a,ue=fe.b,ke(v[De+m],v[ot+m]),Ve=fe.a,Ye=fe.b,ke(Ae,Ve),v[Se+m]=fe.a,v[De+m]=fe.b,ke(ue,Ye),v[gt+m]=fe.a,v[ot+m]=fe.b):(mt(v[Se+m],v[gt+m]),Ae=fe.a,ue=fe.b,mt(v[De+m],v[ot+m]),Ve=fe.a,Ye=fe.b,mt(Ae,Ve),v[Se+m]=fe.a,v[De+m]=fe.b,mt(ue,Ye),v[gt+m]=fe.a,v[ot+m]=fe.b)}if(b&X){let De=Se+te;Y?ke(v[Se+m],v[De+m]):mt(v[Se+m],v[De+m]),Ae=fe.a,v[De+m]=fe.b,v[Se+m]=Ae}}if(P&X){let Se=oe,Ie=oe+C*(b-$);for(;Se<=Ie;Se+=ge){let De=Se+me;Y?ke(v[Se+m],v[De+m]):mt(v[Se+m],v[De+m]),Ae=fe.a,v[De+m]=fe.b,v[Se+m]=Ae}}$=X,X>>=1}return oe}function at(v,m,b,C,P,O,F,Y,V){let X=0,$=0,oe=F,ee=Math.trunc(C.value+(P+7)/8);for(;C.value<ee;)for(Le(X,$,b,C),X=ye.c,$=ye.lc;$>=14;){let de=X>>$-14&16383,me=m[de];if(me.len)$-=me.len,he(me.lit,O,X,$,b,C,Y,V,oe),X=j.c,$=j.lc;else{if(!me.p)throw new Error("THREE.EXRLoader: hufDecode issues");let ge;for(ge=0;ge<me.lit;ge++){let Ae=J(v[me.p[ge]]);for(;$<Ae&&C.value<ee;)Le(X,$,b,C),X=ye.c,$=ye.lc;if($>=Ae&&se(v[me.p[ge]])==(X>>$-Ae&(1<<Ae)-1)){$-=Ae,he(me.p[ge],O,X,$,b,C,Y,V,oe),X=j.c,$=j.lc;break}}if(ge==me.lit)throw new Error("THREE.EXRLoader: hufDecode issues")}}let te=8-P&7;for(X>>=te,$-=te;$>0;){let de=m[X<<14-$&16383];if(de.len)$-=de.len,he(de.lit,O,X,$,b,C,Y,V,oe),X=j.c,$=j.lc;else throw new Error("THREE.EXRLoader: hufDecode issues")}return!0}function ft(v,m,b,C,P,O){let F={value:0},Y=b.value,V=re(m,b),X=re(m,b);b.value+=4;let $=re(m,b);if(b.value+=4,V<0||V>=65537||X<0||X>=65537)throw new Error("THREE.EXRLoader: Something wrong with HUF_ENCSIZE");let oe=new Array(65537),ee=new Array(16384);z(ee);let te=C-(b.value-Y);if(le(v,b,te,V,X,oe),$>8*(C-(b.value-Y)))throw new Error("THREE.EXRLoader: Something wrong with hufUncompress");ae(oe,V,X,ee),at(oe,ee,v,b,$,X,O,P,F)}function rt(v,m,b){for(let C=0;C<b;++C)m[C]=v[m[C]]}function Ht(v){for(let m=1;m<v.length;m++){let b=v[m-1]+v[m]-128;v[m]=b}}function Bt(v,m){let b=0,C=Math.floor((v.length+1)/2),P=0,O=v.length-1;for(;!(P>O||(m[P++]=v[b++],P>O));)m[P++]=v[C++]}function en(v){let m=v.byteLength,b=new Array,C=0,P=new DataView(v);for(;m>0;){let O=P.getInt8(C++);if(O<0){let F=-O;m-=F+1;for(let Y=0;Y<F;Y++)b.push(P.getUint8(C++))}else{let F=O;m-=2;let Y=P.getUint8(C++);for(let V=0;V<F+1;V++)b.push(Y)}}return b}function Ft(v,m,b,C,P,O){let F=new DataView(O.buffer),Y=b[v.idx[0]].width,V=b[v.idx[0]].height,X=3,$=Math.floor(Y/8),oe=Math.ceil(Y/8),ee=Math.ceil(V/8),te=Y-(oe-1)*8,de=V-(ee-1)*8,me={value:0},ge=new Array(X),Ae=new Array(X),Ve=new Array(X),ue=new Array(X),Ye=new Array(X);for(let Ie=0;Ie<X;++Ie)Ye[Ie]=m[v.idx[Ie]],ge[Ie]=Ie<1?0:ge[Ie-1]+oe*ee,Ae[Ie]=new Float32Array(64),Ve[Ie]=new Uint16Array(64),ue[Ie]=new Uint16Array(oe*64);for(let Ie=0;Ie<ee;++Ie){let De=8;Ie==ee-1&&(De=de);let gt=8;for(let We=0;We<oe;++We){We==oe-1&&(gt=te);for(let Ne=0;Ne<X;++Ne)Ve[Ne].fill(0),Ve[Ne][0]=P[ge[Ne]++],Vt(me,C,Ve[Ne]),Sn(Ve[Ne],Ae[Ne]),bn(Ae[Ne]);X==3&&In(Ae);for(let Ne=0;Ne<X;++Ne)It(Ae[Ne],ue[Ne],We*64)}let ot=0;for(let We=0;We<X;++We){let Ne=b[v.idx[We]].type;for(let ut=8*Ie;ut<8*Ie+De;++ut){ot=Ye[We][ut];for(let Nt=0;Nt<$;++Nt){let $e=Nt*64+(ut&7)*8;F.setUint16(ot+0*Ne,ue[We][$e+0],!0),F.setUint16(ot+2*Ne,ue[We][$e+1],!0),F.setUint16(ot+4*Ne,ue[We][$e+2],!0),F.setUint16(ot+6*Ne,ue[We][$e+3],!0),F.setUint16(ot+8*Ne,ue[We][$e+4],!0),F.setUint16(ot+10*Ne,ue[We][$e+5],!0),F.setUint16(ot+12*Ne,ue[We][$e+6],!0),F.setUint16(ot+14*Ne,ue[We][$e+7],!0),ot+=16*Ne}}if($!=oe)for(let ut=8*Ie;ut<8*Ie+De;++ut){let Nt=Ye[We][ut]+8*$*2*Ne,$e=$*64+(ut&7)*8;for(let Et=0;Et<gt;++Et)F.setUint16(Nt+Et*2*Ne,ue[We][$e+Et],!0)}}}let Se=new Uint16Array(Y);F=new DataView(O.buffer);for(let Ie=0;Ie<X;++Ie){b[v.idx[Ie]].decoded=!0;let De=b[v.idx[Ie]].type;if(b[Ie].type==2)for(let gt=0;gt<V;++gt){let ot=Ye[Ie][gt];for(let We=0;We<Y;++We)Se[We]=F.getUint16(ot+We*2*De,!0);for(let We=0;We<Y;++We)F.setFloat32(ot+We*2*De,pe.fromHalfFloat(Se[We]),!0)}}}function Gn(v,m,b,C,P,O){let F=new DataView(O.buffer),Y=b[v],V=Y.width,X=Y.height,$=Math.ceil(V/8),oe=Math.ceil(X/8),ee=Math.floor(V/8),te=V-($-1)*8,de=X-(oe-1)*8,me={value:0},ge=0,Ae=new Float32Array(64),Ve=new Uint16Array(64),ue=new Uint16Array($*64);for(let Ye=0;Ye<oe;++Ye){let Se=8;Ye==oe-1&&(Se=de);for(let Ie=0;Ie<$;++Ie)Ve.fill(0),Ve[0]=P[ge++],Vt(me,C,Ve),Sn(Ve,Ae),bn(Ae),It(Ae,ue,Ie*64);for(let Ie=8*Ye;Ie<8*Ye+Se;++Ie){let De=m[v][Ie];for(let gt=0;gt<ee;++gt){let ot=gt*64+(Ie&7)*8;for(let We=0;We<8;++We)F.setUint16(De+We*2*Y.type,ue[ot+We],!0);De+=16*Y.type}if($!=ee){let gt=ee*64+(Ie&7)*8;for(let ot=0;ot<te;++ot)F.setUint16(De+ot*2*Y.type,ue[gt+ot],!0)}}}Y.decoded=!0}function Vt(v,m,b){let C,P=1;for(;P<64;)C=m[v.value],C==65280?P=64:C>>8==255?P+=C&255:(b[P]=C,P++),v.value++}function Sn(v,m){m[0]=pe.fromHalfFloat(v[0]),m[1]=pe.fromHalfFloat(v[1]),m[2]=pe.fromHalfFloat(v[5]),m[3]=pe.fromHalfFloat(v[6]),m[4]=pe.fromHalfFloat(v[14]),m[5]=pe.fromHalfFloat(v[15]),m[6]=pe.fromHalfFloat(v[27]),m[7]=pe.fromHalfFloat(v[28]),m[8]=pe.fromHalfFloat(v[2]),m[9]=pe.fromHalfFloat(v[4]),m[10]=pe.fromHalfFloat(v[7]),m[11]=pe.fromHalfFloat(v[13]),m[12]=pe.fromHalfFloat(v[16]),m[13]=pe.fromHalfFloat(v[26]),m[14]=pe.fromHalfFloat(v[29]),m[15]=pe.fromHalfFloat(v[42]),m[16]=pe.fromHalfFloat(v[3]),m[17]=pe.fromHalfFloat(v[8]),m[18]=pe.fromHalfFloat(v[12]),m[19]=pe.fromHalfFloat(v[17]),m[20]=pe.fromHalfFloat(v[25]),m[21]=pe.fromHalfFloat(v[30]),m[22]=pe.fromHalfFloat(v[41]),m[23]=pe.fromHalfFloat(v[43]),m[24]=pe.fromHalfFloat(v[9]),m[25]=pe.fromHalfFloat(v[11]),m[26]=pe.fromHalfFloat(v[18]),m[27]=pe.fromHalfFloat(v[24]),m[28]=pe.fromHalfFloat(v[31]),m[29]=pe.fromHalfFloat(v[40]),m[30]=pe.fromHalfFloat(v[44]),m[31]=pe.fromHalfFloat(v[53]),m[32]=pe.fromHalfFloat(v[10]),m[33]=pe.fromHalfFloat(v[19]),m[34]=pe.fromHalfFloat(v[23]),m[35]=pe.fromHalfFloat(v[32]),m[36]=pe.fromHalfFloat(v[39]),m[37]=pe.fromHalfFloat(v[45]),m[38]=pe.fromHalfFloat(v[52]),m[39]=pe.fromHalfFloat(v[54]),m[40]=pe.fromHalfFloat(v[20]),m[41]=pe.fromHalfFloat(v[22]),m[42]=pe.fromHalfFloat(v[33]),m[43]=pe.fromHalfFloat(v[38]),m[44]=pe.fromHalfFloat(v[46]),m[45]=pe.fromHalfFloat(v[51]),m[46]=pe.fromHalfFloat(v[55]),m[47]=pe.fromHalfFloat(v[60]),m[48]=pe.fromHalfFloat(v[21]),m[49]=pe.fromHalfFloat(v[34]),m[50]=pe.fromHalfFloat(v[37]),m[51]=pe.fromHalfFloat(v[47]),m[52]=pe.fromHalfFloat(v[50]),m[53]=pe.fromHalfFloat(v[56]),m[54]=pe.fromHalfFloat(v[59]),m[55]=pe.fromHalfFloat(v[61]),m[56]=pe.fromHalfFloat(v[35]),m[57]=pe.fromHalfFloat(v[36]),m[58]=pe.fromHalfFloat(v[48]),m[59]=pe.fromHalfFloat(v[49]),m[60]=pe.fromHalfFloat(v[57]),m[61]=pe.fromHalfFloat(v[58]),m[62]=pe.fromHalfFloat(v[62]),m[63]=pe.fromHalfFloat(v[63])}function bn(v){let m=.5*Math.cos(.7853975),b=.5*Math.cos(3.14159/16),C=.5*Math.cos(3.14159/8),P=.5*Math.cos(3*3.14159/16),O=.5*Math.cos(5*3.14159/16),F=.5*Math.cos(3*3.14159/8),Y=.5*Math.cos(7*3.14159/16),V=new Array(4),X=new Array(4),$=new Array(4),oe=new Array(4);for(let ee=0;ee<8;++ee){let te=ee*8;V[0]=C*v[te+2],V[1]=F*v[te+2],V[2]=C*v[te+6],V[3]=F*v[te+6],X[0]=b*v[te+1]+P*v[te+3]+O*v[te+5]+Y*v[te+7],X[1]=P*v[te+1]-Y*v[te+3]-b*v[te+5]-O*v[te+7],X[2]=O*v[te+1]-b*v[te+3]+Y*v[te+5]+P*v[te+7],X[3]=Y*v[te+1]-O*v[te+3]+P*v[te+5]-b*v[te+7],$[0]=m*(v[te+0]+v[te+4]),$[3]=m*(v[te+0]-v[te+4]),$[1]=V[0]+V[3],$[2]=V[1]-V[2],oe[0]=$[0]+$[1],oe[1]=$[3]+$[2],oe[2]=$[3]-$[2],oe[3]=$[0]-$[1],v[te+0]=oe[0]+X[0],v[te+1]=oe[1]+X[1],v[te+2]=oe[2]+X[2],v[te+3]=oe[3]+X[3],v[te+4]=oe[3]-X[3],v[te+5]=oe[2]-X[2],v[te+6]=oe[1]-X[1],v[te+7]=oe[0]-X[0]}for(let ee=0;ee<8;++ee)V[0]=C*v[16+ee],V[1]=F*v[16+ee],V[2]=C*v[48+ee],V[3]=F*v[48+ee],X[0]=b*v[8+ee]+P*v[24+ee]+O*v[40+ee]+Y*v[56+ee],X[1]=P*v[8+ee]-Y*v[24+ee]-b*v[40+ee]-O*v[56+ee],X[2]=O*v[8+ee]-b*v[24+ee]+Y*v[40+ee]+P*v[56+ee],X[3]=Y*v[8+ee]-O*v[24+ee]+P*v[40+ee]-b*v[56+ee],$[0]=m*(v[ee]+v[32+ee]),$[3]=m*(v[ee]-v[32+ee]),$[1]=V[0]+V[3],$[2]=V[1]-V[2],oe[0]=$[0]+$[1],oe[1]=$[3]+$[2],oe[2]=$[3]-$[2],oe[3]=$[0]-$[1],v[0+ee]=oe[0]+X[0],v[8+ee]=oe[1]+X[1],v[16+ee]=oe[2]+X[2],v[24+ee]=oe[3]+X[3],v[32+ee]=oe[3]-X[3],v[40+ee]=oe[2]-X[2],v[48+ee]=oe[1]-X[1],v[56+ee]=oe[0]-X[0]}function In(v){for(let m=0;m<64;++m){let b=v[0][m],C=v[1][m],P=v[2][m];v[0][m]=b+1.5747*P,v[1][m]=b-.1873*C-.4682*P,v[2][m]=b+1.8556*C}}let q=new Float32Array(1),Mn=new Uint32Array(q.buffer);function Ct(v){q[0]=v;let m=Mn[0],b=m>>>16&32768,C=m&2147483647;if(C>=1199570944)return b|(C>2139095040?32256:31744);if(C<947912704)return q[0]=Math.abs(v)+.5,b|Mn[0]-1056964608;let P=C+4095+(C>>>13&1);return b|P-939524096>>>13}function It(v,m,b){if(N===null){N=new Uint16Array(65536);for(let C=1;C<65536;++C){if((C&31744)===31744)continue;let P=pe.fromHalfFloat(C),O=Math.abs(P),F=O<=1?Math.pow(O,2.2):Math.pow(L,O-1);N[C]=Ct(P<0?-F:F)}}for(let C=0;C<64;++C)m[b+C]=N[Ct(v[C])]}function Ee(v){return new DataView(v.array.buffer,v.offset.value,v.size)}function Wt(v){let m=v.viewer.buffer.slice(v.offset.value,v.offset.value+v.size),b=new Uint8Array(en(m)),C=new Uint8Array(b.length);return Ht(b),Bt(b,C),new DataView(C.buffer)}function Ge(v){let m=v.array.slice(v.offset.value,v.offset.value+v.size),b=Cs(m),C=new Uint8Array(b.length);return Ht(b),Bt(b,C),new DataView(C.buffer)}function et(v){let m=v.viewer,b={value:v.offset.value},C=new Uint16Array(v.columns*v.lines*(v.inputChannels.length*v.type)),P=new Uint8Array(8192),O=0,F=new Array(v.inputChannels.length);for(let de=0,me=v.inputChannels.length;de<me;de++)F[de]={},F[de].start=O,F[de].end=F[de].start,F[de].nx=v.columns,F[de].ny=v.lines,F[de].size=v.type,O+=F[de].nx*F[de].ny*F[de].size;let Y=ve(m,b),V=ve(m,b);if(V>=8192)throw new Error("THREE.EXRLoader: Something is wrong with PIZ_COMPRESSION BITMAP_SIZE");if(Y<=V)for(let de=0;de<V-Y+1;de++)P[de+Y]=k(m,b);let X=new Uint16Array(65536),$=U(P,X),oe=re(m,b);ft(v.array,m,b,oe,C,O);for(let de=0;de<v.inputChannels.length;++de){let me=F[de];for(let ge=0;ge<F[de].size;++ge)Be(C,me.start+ge,me.nx,me.size,me.ny,me.nx*me.size,$)}rt(X,C,O);let ee=0,te=new Uint8Array(C.buffer.byteLength);for(let de=0;de<v.lines;de++)for(let me=0;me<v.inputChannels.length;me++){let ge=F[me],Ae=ge.nx*ge.size,Ve=new Uint8Array(C.buffer,ge.end*2,Ae*2);te.set(Ve,ee),ee+=Ae*2,ge.end+=Ae}return new DataView(te.buffer)}function B(v){let m=v.array.slice(v.offset.value,v.offset.value+v.size),b=Cs(m),C=v.inputChannels.length*v.lines*v.columns*v.totalBytes,P=new ArrayBuffer(C),O=new DataView(P),F=0,Y=0,V=new Array(4);for(let X=0;X<v.lines;X++)for(let $=0;$<v.inputChannels.length;$++){let oe=0;switch(v.inputChannels[$].pixelType){case 1:V[0]=F,V[1]=V[0]+v.columns,F=V[1]+v.columns;for(let te=0;te<v.columns;++te){let de=b[V[0]++]<<8|b[V[1]++];oe+=de,O.setUint16(Y,oe,!0),Y+=2}break;case 2:V[0]=F,V[1]=V[0]+v.columns,V[2]=V[1]+v.columns,F=V[2]+v.columns;for(let te=0;te<v.columns;++te){let de=b[V[0]++]<<24|b[V[1]++]<<16|b[V[2]++]<<8;oe+=de,O.setUint32(Y,oe,!0),Y+=4}break}}return O}function R(v){let m=v.array,b=v.offset.value,C=v.columns,P=v.lines,O=v.inputChannels,F=v.totalBytes,Y=tn.compression==="B44A_COMPRESSION",V=new Uint8Array(P*C*F),X=new Uint16Array(16),$=0;for(let oe=0;oe<O.length;oe++){let ee=O[oe],te=ee.pixelType*2,de=Math.ceil(C/ee.xSampling),me=Math.ceil(P/ee.ySampling),ge=ee.xSampling===1&&ee.ySampling===1;if(ee.pixelType!==1){for(let ue=0;ue<me;ue++)if(ge){let Ye=ue*C*F+$*C;for(let Se=0;Se<de*te;Se++)V[Ye+Se]=m[b++]}else b+=de*te;$+=te;continue}let Ae=Math.ceil(de/4),Ve=Math.ceil(me/4);for(let ue=0;ue<Ve;ue++)for(let Ye=0;Ye<Ae;Ye++){if(Y&&m[b+2]>=52){let Se=m[b]<<8|m[b+1],Ie=Se&32768?Se&32767:~Se&65535;X.fill(Ie),b+=3}else{let Se=m[b]<<8|m[b+1],Ie=m[b+2]>>2,De=32<<Ie,gt=Se+((m[b+2]<<4|m[b+3]>>4)&63)*(1<<Ie)-De&65535,ot=gt+((m[b+3]<<2|m[b+4]>>6)&63)*(1<<Ie)-De&65535,We=ot+(m[b+4]&63)*(1<<Ie)-De&65535,Ne=Se+(m[b+5]>>2&63)*(1<<Ie)-De&65535,ut=gt+((m[b+5]<<4|m[b+6]>>4)&63)*(1<<Ie)-De&65535,Nt=ot+((m[b+6]<<2|m[b+7]>>6)&63)*(1<<Ie)-De&65535,$e=We+(m[b+7]&63)*(1<<Ie)-De&65535,Et=Ne+(m[b+8]>>2&63)*(1<<Ie)-De&65535,dn=ut+((m[b+8]<<4|m[b+9]>>4)&63)*(1<<Ie)-De&65535,Di=Nt+((m[b+9]<<2|m[b+10]>>6)&63)*(1<<Ie)-De&65535,ii=$e+(m[b+10]&63)*(1<<Ie)-De&65535,or=Et+(m[b+11]>>2&63)*(1<<Ie)-De&65535,Ko=dn+((m[b+11]<<4|m[b+12]>>4)&63)*(1<<Ie)-De&65535,Qo=Di+((m[b+12]<<2|m[b+13]>>6)&63)*(1<<Ie)-De&65535,jo=ii+(m[b+13]&63)*(1<<Ie)-De&65535,Fs=[Se,Ne,Et,or,gt,ut,dn,Ko,ot,Nt,Di,Qo,We,$e,ii,jo];for(let Ir=0;Ir<16;Ir++)X[Ir]=Fs[Ir]&32768?Fs[Ir]&32767:~Fs[Ir]&65535;b+=14}if(ee.pLinear){if(I===null){I=new Uint16Array(65536);for(let Se=0;Se<65536;Se++)if((Se&31744)===31744||Se>32768)I[Se]=0;else{let Ie=pe.fromHalfFloat(Se);I[Se]=Ie<=0?0:pe.toHalfFloat(8*Math.log(Ie))}}for(let Se=0;Se<16;Se++)X[Se]=I[X[Se]]}for(let Se=0;Se<4;Se++){let Ie=ue*4+Se;if(!(Ie>=me))for(let De=0;De<4;De++){let gt=Ye*4+De;if(gt>=de)continue;let ot=X[Se*4+De];for(let We=0;We<ee.ySampling;We++){let Ne=Ie*ee.ySampling+We;if(!(Ne>=P))for(let ut=0;ut<ee.xSampling;ut++){let Nt=gt*ee.xSampling+ut;if(Nt>=C)continue;let $e=Ne*C*F+$*C+Nt*2;V[$e]=ot&255,V[$e+1]=ot>>8&255}}}}}$+=2}return new DataView(V.buffer)}function K(v){let m=v.viewer,b={value:v.offset.value},C=new Uint8Array(v.columns*v.lines*(v.inputChannels.length*v.type*2)),P={version:ie(m,b),unknownUncompressedSize:ie(m,b),unknownCompressedSize:ie(m,b),acCompressedSize:ie(m,b),dcCompressedSize:ie(m,b),rleCompressedSize:ie(m,b),rleUncompressedSize:ie(m,b),rleRawSize:ie(m,b),totalAcUncompressedCount:ie(m,b),totalDcUncompressedCount:ie(m,b),acCompression:ie(m,b)};if(P.version<2)throw new Error("THREE.EXRLoader: "+tn.compression+" version "+P.version+" is unsupported");let O=new Array,F=ve(m,b)-2;for(;F>0;){let me=xe(m.buffer,b),ge=k(m,b),Ae=ge>>2&3,Ve=(ge>>4)-1,ue=new Int8Array([Ve])[0],Ye=k(m,b);O.push({name:me,index:ue,type:Ye,compression:Ae}),F-=me.length+3}let Y=tn.channels,V=new Array(v.inputChannels.length);for(let me=0;me<v.inputChannels.length;++me){let ge=V[me]={},Ae=Y[me];ge.name=Ae.name,ge.compression=0,ge.decoded=!1,ge.type=Ae.pixelType,ge.pLinear=Ae.pLinear,ge.width=v.columns,ge.height=v.lines}let X={idx:new Array(3)};for(let me=0;me<v.inputChannels.length;++me){let ge=V[me],Ae=ge.name.lastIndexOf("."),Ve=Ae>=0?ge.name.substring(Ae+1):ge.name;for(let ue=0;ue<O.length;++ue){let Ye=O[ue];Ve===Ye.name&&ge.type===Ye.type&&(ge.compression=Ye.compression,Ye.index>=0&&(X.idx[Ye.index]=me),ge.offset=me)}}let $,oe,ee;if(P.acCompressedSize>0)switch(P.acCompression){case 0:$=new Uint16Array(P.totalAcUncompressedCount),ft(v.array,m,b,P.acCompressedSize,$,P.totalAcUncompressedCount);break;case 1:let me=v.array.slice(b.value,b.value+P.totalAcUncompressedCount),ge=Cs(me);$=new Uint16Array(ge.buffer),b.value+=P.totalAcUncompressedCount;break}if(P.dcCompressedSize>0){let me={array:v.array,offset:b,size:P.dcCompressedSize};oe=new Uint16Array(Ge(me).buffer),b.value+=P.dcCompressedSize}if(P.rleRawSize>0){let me=v.array.slice(b.value,b.value+P.rleCompressedSize),ge=Cs(me);ee=en(ge.buffer),b.value+=P.rleCompressedSize}let te=0,de=new Array(V.length);for(let me=0;me<de.length;++me)de[me]=new Array;for(let me=0;me<v.lines;++me)for(let ge=0;ge<V.length;++ge)de[ge].push(te),te+=V[ge].width*v.type*2;X.idx[0]!==void 0&&V[X.idx[0]]&&Ft(X,de,V,$,oe,C);for(let me=0;me<V.length;++me){let ge=V[me];if(!ge.decoded)switch(ge.compression){case 2:let Ae=0,Ve=0;for(let ue=0;ue<v.lines;++ue){let Ye=de[me][Ae];for(let Se=0;Se<ge.width;++Se){for(let Ie=0;Ie<2*ge.type;++Ie)C[Ye++]=ee[Ve+Ie*ge.width*ge.height];Ve++}Ae++}break;case 1:Gn(me,de,V,$,oe,C);break;default:throw new Error("THREE.EXRLoader: unsupported channel compression")}}return new DataView(C.buffer)}function xe(v,m){let b=new Uint8Array(v),C=0;for(;b[m.value+C]!=0;)C+=1;let P=new TextDecoder().decode(b.slice(m.value,m.value+C));return m.value=m.value+C+1,P}function ce(v,m,b){let C=new TextDecoder().decode(new Uint8Array(v).slice(m.value,m.value+b));return m.value=m.value+b,C}function be(v,m){let b=ne(v,m),C=re(v,m);return[b,C]}function Re(v,m){let b=re(v,m),C=re(v,m);return[b,C]}function ne(v,m){let b=v.getInt32(m.value,!0);return m.value=m.value+4,b}function re(v,m){let b=v.getUint32(m.value,!0);return m.value=m.value+4,b}function Me(v,m){let b=v[m.value];return m.value=m.value+1,b}function k(v,m){let b=v.getUint8(m.value);return m.value=m.value+1,b}let ie=function(v,m){let b=Number(v.getBigInt64(m.value,!0));return m.value+=8,b};function Q(v,m){let b=v.getFloat32(m.value,!0);return m.value+=4,b}function we(v,m){return pe.toHalfFloat(Q(v,m))}function ve(v,m){let b=v.getUint16(m.value,!0);return m.value+=2,b}function Te(v,m){return pe.fromHalfFloat(ve(v,m))}function ze(v,m,b,C){let P=b.value,O=[];for(;b.value<P+C-1;){let F=xe(m,b),Y=ne(v,b),V=k(v,b);b.value+=3;let X=ne(v,b),$=ne(v,b);O.push({name:F,pixelType:Y,pLinear:V,xSampling:X,ySampling:$})}return b.value+=1,O}function st(v,m){let b=Q(v,m),C=Q(v,m),P=Q(v,m),O=Q(v,m),F=Q(v,m),Y=Q(v,m),V=Q(v,m),X=Q(v,m);return{redX:b,redY:C,greenX:P,greenY:O,blueX:F,blueY:Y,whiteX:V,whiteY:X}}function _e(v,m){let b=["NO_COMPRESSION","RLE_COMPRESSION","ZIPS_COMPRESSION","ZIP_COMPRESSION","PIZ_COMPRESSION","PXR24_COMPRESSION","B44_COMPRESSION","B44A_COMPRESSION","DWAA_COMPRESSION","DWAB_COMPRESSION"],C=k(v,m);return b[C]}function He(v,m){let b=ne(v,m),C=ne(v,m),P=ne(v,m),O=ne(v,m);return{xMin:b,yMin:C,xMax:P,yMax:O}}function it(v,m){let b=["INCREASING_Y","DECREASING_Y","RANDOM_Y"],C=k(v,m);return b[C]}function Pe(v,m){let b=["ENVMAP_LATLONG","ENVMAP_CUBE"],C=k(v,m);return b[C]}function _t(v,m){let b=["ONE_LEVEL","MIPMAP_LEVELS","RIPMAP_LEVELS"],C=["ROUND_DOWN","ROUND_UP"],P=re(v,m),O=re(v,m),F=k(v,m);return{xSize:P,ySize:O,levelMode:b[F&15],roundingMode:C[F>>4]}}function Yt(v,m){let b=Q(v,m),C=Q(v,m);return[b,C]}function ti(v,m){let b=Q(v,m),C=Q(v,m),P=Q(v,m);return[b,C,P]}function Wo(v,m,b,C,P){if(C==="string"||C==="stringvector"||C==="iccProfile")return ce(m,b,P);if(C==="chlist")return ze(v,m,b,P);if(C==="chromaticities")return st(v,b);if(C==="compression")return _e(v,b);if(C==="box2i")return He(v,b);if(C==="envmap")return Pe(v,b);if(C==="tiledesc")return _t(v,b);if(C==="lineOrder")return it(v,b);if(C==="float")return Q(v,b);if(C==="v2f")return Yt(v,b);if(C==="v3f")return ti(v,b);if(C==="int")return ne(v,b);if(C==="rational")return be(v,b);if(C==="timecode")return Re(v,b);if(C==="preview"||C==="deepImageState"||C==="idmanifest")return b.value+=P,"skipped";b.value+=P}function Is(v,m){let b=Math.log2(v);return m=="ROUND_DOWN"?Math.floor(b):Math.ceil(b)}function Jc(v,m,b){let C=0;switch(v.levelMode){case"ONE_LEVEL":C=1;break;case"MIPMAP_LEVELS":C=Is(Math.max(m,b),v.roundingMode)+1;break;case"RIPMAP_LEVELS":throw new Error("THREE.EXRLoader: RIPMAP_LEVELS tiles currently unsupported.")}return C}function Ps(v,m,b,C){let P=new Array(v);for(let O=0;O<v;O++){let F=1<<O,Y=m/F|0;C=="ROUND_UP"&&Y*F<m&&(Y+=1);let V=Math.max(Y,1);P[O]=(V+b-1)/b|0}return P}function Xo(){let v=this,m=v.offset,b={value:0};for(let C=0;C<v.tileCount;C++){let P=ne(v.viewer,m),O=ne(v.viewer,m);m.value+=8,v.size=re(v.viewer,m);let F=P*v.blockWidth,Y=O*v.blockHeight;v.columns=F+v.blockWidth>v.width?v.width-F:v.blockWidth,v.lines=Y+v.blockHeight>v.height?v.height-Y:v.blockHeight;let V=v.columns*v.totalBytes,$=v.size<v.lines*V?v.uncompress(v):Ee(v);m.value+=v.size;for(let oe=0;oe<v.lines;oe++){let ee=oe*v.columns*v.totalBytes;for(let te=0;te<v.inputChannels.length;te++){let de=tn.channels[te].name,me=v.channelByteOffsets[de]*v.columns,ge=v.decodeChannels[de];if(ge===void 0)continue;b.value=ee+me;let Ae=(v.height-(1+Y+oe))*v.outLineWidth;for(let Ve=0;Ve<v.columns;Ve++){let ue=Ae+(Ve+F)*v.outputChannels+ge;v.byteArray[ue]=v.getter($,b)}}}}}function di(){let v=this,m=v.offset,b={value:0};for(let C=0;C<v.height/v.blockHeight;C++){let P=ne(v.viewer,m)-tn.dataWindow.yMin;v.size=re(v.viewer,m),v.lines=P+v.blockHeight>v.height?v.height-P:v.blockHeight;let O=v.columns*v.totalBytes,Y=v.size<v.lines*O?v.uncompress(v):Ee(v);m.value+=v.size;for(let V=0;V<v.lines;V++){let X=P+V,$=V*O,oe=(v.height-1-X)*v.outLineWidth;for(let ee=0;ee<v.inputChannels.length;ee++){let te=tn.channels[ee].name,de=v.channelByteOffsets[te]*v.columns,me=v.decodeChannels[te];if(me!==void 0){b.value=$+de;for(let ge=0;ge<v.columns;ge++){let Ae=oe+ge*v.outputChannels+me;v.byteArray[Ae]=v.getter(Y,b)}}}}}}function Ds(){let v=this,m=v.chunkOffsets,b={value:0};for(let C=0;C<m.length;C++){let P={value:m[C]};P.value+=4;let O=ne(v.viewer,P)-tn.dataWindow.yMin;v.size=re(v.viewer,P),v.lines=O+v.blockHeight>v.height?v.height-O:v.blockHeight;let F=v.columns*v.totalBytes,Y=v.size<v.lines*F,V=v.offset;v.offset=P;let X=Y?v.uncompress(v):Ee(v);v.offset=V;for(let $=0;$<v.lines;$++){let oe=O+$,ee=$*F,te=(v.height-1-oe)*v.outLineWidth;for(let de=0;de<v.inputChannels.length;de++){let me=tn.channels[de].name,ge=v.channelByteOffsets[me]*v.columns,Ae=v.decodeChannels[me];if(Ae!==void 0){b.value=ee+ge;for(let Ve=0;Ve<v.columns;Ve++){let ue=te+Ve*v.outputChannels+Ae;v.byteArray[ue]=v.getter(X,b)}}}}}}function Ls(v,m,b,C){if(b===0)return null;let P=v.slice(m,m+b);switch(C){case"NO_COMPRESSION":return new DataView(P.buffer,P.byteOffset,P.byteLength);case"RLE_COMPRESSION":{let O=new Uint8Array(en(P.buffer.slice(P.byteOffset,P.byteOffset+P.byteLength))),F=new Uint8Array(O.length);return Ht(O),Bt(O,F),new DataView(F.buffer)}case"ZIPS_COMPRESSION":{let O=Cs(P),F=new Uint8Array(O.length);return Ht(O),Bt(O,F),new DataView(F.buffer)}default:throw new Error("THREE.EXRLoader: "+C+" is unsupported for deep data")}}function qo(){let v=this,m=v.chunkOffsets,b=v.width,C=v.height,P=v.deepChannels,O=tn.compression,F=v.multiPart,Y=v.decodeChannels,V=v.outputChannels,X=v.byteArray instanceof Uint16Array,$=-1;for(let oe=0;oe<P.length;oe++)if(P[oe].name==="A"){$=oe;break}for(let oe=0;oe<m.length;oe++){let ee={value:m[oe]};F&&(ee.value+=4);let te=ne(v.viewer,ee)-tn.dataWindow.yMin,de=ie(v.viewer,ee),me=ie(v.viewer,ee);ie(v.viewer,ee);let ge=Ls(v.array,ee.value,de,O);if(ee.value+=de,ge===null)continue;let Ae=new Uint32Array(b);for(let De=0;De<b;De++)Ae[De]=ge.getUint32(De*4,!0);let Ve=Ae[b-1];if(Ve===0){ee.value+=me;continue}let ue=Ls(v.array,ee.value,me,O),Ye=[],Se=0;for(let De=0;De<P.length;De++)Ye.push(Se),Se+=Ve*P[De].bytesPerSample;let Ie=(C-1-te)*v.outLineWidth;for(let De=0;De<b;De++){let gt=De===0?0:Ae[De-1],We=Ae[De]-gt;if(We===0)continue;let Ne=new Float32Array(V),ut=0;for(let $e=0;$e<We;$e++){let Et=gt+$e,dn=1-ut;if(dn<=0)break;let Di=1;if($>=0){let ii=P[$].bytesPerSample,or=Ye[$]+Et*ii;Di=ii===2?pe.fromHalfFloat(ue.getUint16(or,!0)):ue.getFloat32(or,!0)}for(let ii=0;ii<P.length;ii++){let or=P[ii],Ko=Y[or.name];if(Ko===void 0)continue;let Qo=or.bytesPerSample,jo=Ye[ii]+Et*Qo,Fs=Qo===2?pe.fromHalfFloat(ue.getUint16(jo,!0)):ue.getFloat32(jo,!0);Ne[Ko]+=Fs*dn}ut+=Di*dn}Y.A!==void 0&&(Ne[Y.A]=ut);let Nt=Ie+De*V;for(let $e=0;$e<V;$e++)v.byteArray[Nt+$e]=X?pe.toHalfFloat(Ne[$e]):Ne[$e]}}}function rr(v,m,b){let C={},P=!1;for(;;){let O=xe(m,b);if(O==="")break;P=!0;let F=xe(m,b),Y=re(v,b),V=Wo(v,m,b,F,Y);V===void 0?console.warn(`THREE.EXRLoader: Skipped unknown header attribute type '${F}'.`):C[O]=V}return P?C:null}function Yo(v,m,b){if(v.getUint32(0,!0)!=20000630)throw new Error("THREE.EXRLoader: Provided file doesn't appear to be in OpenEXR format.");let C=v.getUint8(4),P=v.getUint8(5),O={singleTile:!!(P&2),longName:!!(P&4),deepFormat:!!(P&8),multiPart:!!(P&16)};b.value=8;let F=[];if(O.multiPart){for(;;){let Y=rr(v,m,b);if(Y===null)break;Y.version=C,Y.spec=O,F.push(Y)}if(F.length===0)throw new Error("THREE.EXRLoader: No valid part headers found.")}else{let Y=rr(v,m,b);Y.version=C,Y.spec=O,F.push(Y)}return F}function Zo(v,m,b,C,P,O){let F={size:0,viewer:m,array:b,offset:C,width:v.dataWindow.xMax-v.dataWindow.xMin+1,height:v.dataWindow.yMax-v.dataWindow.yMin+1,inputChannels:v.channels,channelByteOffsets:{},shouldExpand:!1,yCbCr:!1,totalBytes:null,columns:null,lines:null,type:null,uncompress:null,getter:null,format:null,colorSpace:un};switch(v.compression){case"NO_COMPRESSION":F.blockHeight=1,F.uncompress=Ee;break;case"RLE_COMPRESSION":F.blockHeight=1,F.uncompress=Wt;break;case"ZIPS_COMPRESSION":F.blockHeight=1,F.uncompress=Ge;break;case"ZIP_COMPRESSION":F.blockHeight=16,F.uncompress=Ge;break;case"PIZ_COMPRESSION":F.blockHeight=32,F.uncompress=et;break;case"PXR24_COMPRESSION":F.blockHeight=16,F.uncompress=B;break;case"B44_COMPRESSION":case"B44A_COMPRESSION":F.blockHeight=32,F.uncompress=R;break;case"DWAA_COMPRESSION":F.blockHeight=32,F.uncompress=K;break;case"DWAB_COMPRESSION":F.blockHeight=256,F.uncompress=K;break;default:throw new Error("THREE.EXRLoader: "+v.compression+" is unsupported")}let Y={};for(let ee of v.channels)switch(ee.name){case"BY":case"RY":case"Y":case"R":case"G":case"B":case"A":Y[ee.name]=!0,F.type=ee.pixelType}let V=!1,X=!1;if(Y.Y&&Y.RY&&Y.BY)F.outputChannels=4,F.yCbCr=!0;else if(Y.R&&Y.G&&Y.B)F.outputChannels=4;else if(Y.Y)F.outputChannels=1;else throw new Error("THREE.EXRLoader: file contains unsupported data channels.");switch(F.outputChannels){case 4:O==qe?(V=!Y.A,F.format=qe,F.colorSpace=un,F.outputChannels=4,F.decodeChannels={R:0,G:1,B:2,A:3}):O==an?(F.format=an,F.colorSpace=un,F.outputChannels=2,F.decodeChannels={R:0,G:1}):O==Rn?(F.format=Rn,F.colorSpace=un,F.outputChannels=1,F.decodeChannels={R:0}):X=!0;break;case 1:O==qe?(V=!0,F.format=qe,F.colorSpace=un,F.outputChannels=4,F.shouldExpand=!0,F.decodeChannels={Y:0}):O==an?(F.format=an,F.colorSpace=un,F.outputChannels=2,F.shouldExpand=!0,F.decodeChannels={Y:0}):O==Rn?(F.format=Rn,F.colorSpace=un,F.outputChannels=1,F.decodeChannels={Y:0}):X=!0;break;default:X=!0}if(X)throw new Error("THREE.EXRLoader: invalid output format for specified file.");if(F.yCbCr&&(F.format=qe,F.outputChannels=4,F.decodeChannels={Y:0,RY:1,BY:2},V=!0),F.type==1)switch(P){case tt:F.getter=Te;break;case ht:F.getter=ve;break}else if(F.type==2)switch(P){case tt:F.getter=Q;break;case ht:F.getter=we}else throw new Error("THREE.EXRLoader: unsupported pixelType "+F.type+" for "+v.compression+".");F.columns=F.width;let $=F.width*F.height*F.outputChannels;switch(P){case tt:F.byteArray=new Float32Array($),V&&F.byteArray.fill(1,0,$);break;case ht:F.byteArray=new Uint16Array($),V&&F.byteArray.fill(15360,0,$);break;default:console.error("THREE.EXRLoader: unsupported type: ",P);break}let oe=0;for(let ee of v.channels)F.decodeChannels[ee.name]!==void 0&&(F.channelByteOffsets[ee.name]=oe),oe+=ee.pixelType*2;if(F.totalBytes=oe,F.outLineWidth=F.width*F.outputChannels,v.spec.deepFormat){F.deepChannels=[];let ee=0;for(let te of v.channels){let de=te.pixelType===0?4:te.pixelType*2;F.deepChannels.push({name:te.name,pixelType:te.pixelType,bytesPerSample:de}),ee+=de}F.deepBytesPerSample=ee,F.chunkOffsets=v._chunkOffsets,F.multiPart=v.spec.multiPart,F.decode=qo.bind(F)}else if(v.spec.singleTile){F.blockHeight=v.tiles.ySize,F.blockWidth=v.tiles.xSize;let ee=Jc(v.tiles,F.width,F.height),te=Ps(ee,F.width,v.tiles.xSize,v.tiles.roundingMode),de=Ps(ee,F.height,v.tiles.ySize,v.tiles.roundingMode);F.tileCount=te[0]*de[0];for(let me=0;me<ee;me++)for(let ge=0;ge<de[me];ge++)for(let Ae=0;Ae<te[me];Ae++)ie(m,C);F.decode=Xo.bind(F)}else if(v.spec.multiPart)F.blockWidth=F.width,F.chunkOffsets=v._chunkOffsets,F.decode=Ds.bind(F);else{F.blockWidth=F.width;let ee=Math.ceil(F.height/F.blockHeight);for(let te=0;te<ee;te++)ie(m,C);F.decode=di.bind(F)}return F}let ni={value:0},Cr=new DataView(e),$o=new Uint8Array(e),sr=Yo(Cr,e,ni),Jo=Math.max(0,Math.min(this.part,sr.length-1)),tn=sr[Jo];if(tn.spec.multiPart||tn.spec.deepFormat)for(let v=0;v<sr.length;v++){let m=sr[v].chunkCount;if(v===Jo){tn._chunkOffsets=[];for(let b=0;b<m;b++)tn._chunkOffsets.push(ie(Cr,ni))}else for(let b=0;b<m;b++)ie(Cr,ni)}let Pn=Zo(tn,Cr,$o,ni,this.type,this.outputFormat);if(Pn.decode(),Pn.shouldExpand){let v=Pn.byteArray;if(this.outputFormat==qe)for(let m=0;m<v.length;m+=4)v[m+2]=v[m+1]=v[m];else if(this.outputFormat==an)for(let m=0;m<v.length;m+=2)v[m+1]=v[m]}if(Pn.yCbCr){let v=Pn.byteArray,m=Pn.width*Pn.height;if(this.type===ht)for(let b=0;b<m;b++){let C=b*4,P=pe.fromHalfFloat(v[C]),O=pe.fromHalfFloat(v[C+1]),F=pe.fromHalfFloat(v[C+2]),Y=(1+O)*P,V=(1+F)*P,X=(P-Y*.2126-V*.0722)/.7152;v[C]=pe.toHalfFloat(Math.max(0,Y)),v[C+1]=pe.toHalfFloat(Math.max(0,X)),v[C+2]=pe.toHalfFloat(Math.max(0,V))}else for(let b=0;b<m;b++){let C=b*4,P=v[C],O=v[C+1],F=v[C+2],Y=(1+O)*P,V=(1+F)*P;v[C]=Math.max(0,Y),v[C+1]=Math.max(0,(P-Y*.2126-V*.0722)/.7152),v[C+2]=Math.max(0,V)}}return{header:tn,width:Pn.width,height:Pn.height,data:Pn.byteArray,format:Pn.format,colorSpace:Pn.colorSpace,type:this.type,minFilter:lt,magFilter:lt,generateMipmaps:!1,flipY:!1}}setDataType(e){return this.type=e,this}setOutputFormat(e){return this.outputFormat=e,this}setPart(e){return this.part=e,this}};var ib={WebGLRenderer:Ul,Scene:fr,Group:Si,Mesh:xn,BufferGeometry:Ot,BufferAttribute:yt,MeshPhysicalMaterial:js,MeshStandardMaterial:es,DataTexture:Rt,Color:Je,Matrix4:Ze,Vector2:Ue,Vector3:H,PlaneGeometry:pr,CircleGeometry:Ks,LatheGeometry:Qs,RGBAFormat:qe,FloatType:tt,HalfFloatType:ht,LinearFilter:lt,EquirectangularReflectionMapping:ai,RepeatWrapping:rn,ClampToEdgeWrapping:Pt,DoubleSide:vn,FrontSide:En,SRGBColorSpace:Tn,LinearSRGBColorSpace:un,NoToneMapping:Ln,ACESFilmicToneMapping:lo,ReinhardToneMapping:oo,CineonToneMapping:ao,AgXToneMapping:co,NeutralToneMapping:uo,REVISION:"187",OrthographicCamera:Wi,WebGLRenderTarget:zt,ShaderMaterial:$t};return ag(rb);})();
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)

three/examples/jsm/libs/fflate.module.js:
  (*!
  fflate - fast JavaScript compression/decompression
  <https://101arrowz.github.io/fflate>
  Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
  version 0.8.3
  *)
*/
