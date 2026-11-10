import * as THREE from 'three';
/** Matrix placing a plan's authored frame in the world (translation, and a half turn when rotated). */
export function planMatrix(frame:{offset:readonly [number,number];rotated?:boolean}):THREE.Matrix4{
  const m=new THREE.Matrix4().makeTranslation(frame.offset[0],0,frame.offset[1]);
  return frame.rotated?m.multiply(new THREE.Matrix4().makeRotationY(Math.PI)):m;
}
