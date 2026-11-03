// Three.js de la CAO (threejs/three.min.js) : depuis r160, three ne publie plus de script classique
// (seulement des modules ES). On empaquette donc le module en UN script qui pose window.THREE, comme
// l'ancien three.min.js : il marche en file:// et les tests vm le chargent tel quel. Pour le refaire
// (hors du dépôt) :
//   npm i three@0.187.0 esbuild
//   npx esbuild three-entree.mjs --bundle --minify --format=iife --target=es2020 --legal-comments=eof --outfile=three.min.js
// puis recopier three.min.js dans threejs/ (en gardant le bandeau en tête).
import * as T from 'three';
// Couleurs comme en r147 : pas de conversion sRGB ↔ linéaire des couleurs ni des textures…
T.ColorManagement.enabled=false;
// …et un WebGLRenderer réglé comme en r147 : sortie linéaire (ancien LinearEncoding, sans quoi tout
// sortirait plus clair) et tampon de gabarit (stencil, false par défaut depuis r163 ; les bouchons
// de coupe s'en servent). Les intensités des lumières (×π depuis r155) sont réglées dans src/.
class WebGLRenderer extends T.WebGLRenderer{
  constructor(p){super(Object.assign({stencil:true},p));this.outputColorSpace=T.LinearSRGBColorSpace;}
}
// Reflets des matières physiques comme en r147 : approximation analytique DFGApprox (Karis) au lieu de
// la table dfgLUT de r181 (métaux plus pâles : laiton, cuivre, or)
const DFG_APPROX=`
vec2 DFGApprox( const in float roughness, const in float dotNV ) {
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	return vec2( - 1.04, 1.04 ) * a004 + r.zw;
}
`;
{
  const C=T.ShaderChunk,lut=/texture2D\( dfgLUT, vec2\( ([\w.]+), (\w+) \) \)\.rg/g;
  if(!C.lights_physical_pars_fragment.includes('uniform sampler2D dfgLUT;'))throw new Error('three : dfgLUT introuvable');
  C.lights_physical_pars_fragment=C.lights_physical_pars_fragment.replace('uniform sampler2D dfgLUT;','uniform sampler2D dfgLUT;'+DFG_APPROX).replace(lut,'DFGApprox( $1, $2 )');
  C.lights_fragment_begin=C.lights_fragment_begin.replace(lut,'DFGApprox( $1, $2 )');
  if(lut.test(C.lights_physical_pars_fragment+C.lights_fragment_begin))throw new Error('three : dfgLUT encore lu');
}
// objet ordinaire (un espace de noms de module est figé) : OrbitControls.js y ajoute THREE.OrbitControls
globalThis.THREE=Object.assign({},T,{WebGLRenderer});
