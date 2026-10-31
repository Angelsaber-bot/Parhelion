import test from'node:test';import assert from'node:assert/strict';import*as THREE from'three';import{makeSunShafts}from'../src/fx';
test('sun shafts reuse the direction target without changing uniforms, NaN behavior, shader or pass routing',()=>{
 const shafts=makeSunShafts(),camera=new THREE.PerspectiveCamera(65,16/9,.1,6000);camera.position.set(120,12,-680);camera.updateMatrixWorld();const targets=new Set<THREE.Vector3>(),original=camera.getWorldDirection;
 camera.getWorldDirection=function(target){targets.add(target);return original.call(this,target)};
 try{for(const aspect of[9/16,16/9,2.4])for(const facing of[-1,0,.1,.100001,.105,.108,.109,.11,.3,.6,1]){
  camera.aspect=aspect;camera.updateProjectionMatrix();const sun=new THREE.Vector3(Math.sqrt(Math.max(0,1-facing*facing)),0,-facing),projected=camera.position.clone().addScaledVector(sun,1000).project(camera);shafts.update(camera,sun);
  assert.deepEqual(shafts.pass.uniforms.sunUv.value.toArray(),[projected.x*.5+.5,projected.y*.5+.5]);assert.equal(shafts.pass.uniforms.aspect.value,aspect);assert.equal(shafts.pass.uniforms.strength.value,THREE.MathUtils.smoothstep(facing,.1,.6)*1.1);assert.equal(shafts.pass.enabled,true,'identity pass remains enabled pending actual GPU precision proof');
 }
 assert.equal(targets.size,1);shafts.update(camera,new THREE.Vector3(NaN,NaN,NaN));assert.ok(Number.isNaN(shafts.pass.uniforms.strength.value));assert.equal(shafts.pass.enabled,true);
 assert.match(shafts.pass.material.fragmentShader,/strength <= 0\.001/);assert.match(shafts.pass.material.fragmentShader,/i < 32/);assert.match(shafts.pass.material.fragmentShader,/decay \*= 0\.935/);
 }finally{shafts.pass.dispose();}
});
