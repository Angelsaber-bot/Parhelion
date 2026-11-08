import * as THREE from 'three';
/** Same restrained lighting language in the workshop and the held-weapon layer:
 * readable darks, directional highlights, and a cool rim that reveals bevels. */
export function lightWeaponScene(scene:THREE.Scene){
 scene.environmentIntensity=.85;
 scene.add(new THREE.HemisphereLight(0xdce7fa,0x252b3a,.85));
 const key=new THREE.DirectionalLight(0xfff3e5,2.5);key.position.set(2.8,3.8,3.5);
 const rim=new THREE.DirectionalLight(0xa7c8f4,1.25);rim.position.set(-2,1.8,-2.5);
 const fill=new THREE.DirectionalLight(0xe1dcf5,.42);fill.position.set(-3,.2,2);
 scene.add(key,rim,fill);
}
export function renderHeldWeapon(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera){
 const exposure=renderer.toneMappingExposure;
 try{renderer.toneMappingExposure=.98;renderer.clearDepth();renderer.render(scene,camera);}
 finally{renderer.toneMappingExposure=exposure;}
}
