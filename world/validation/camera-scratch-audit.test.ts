import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { shoulderArmLength } from '../src/aim.ts';
// Independent equivalence check against the pre-optimization spring arm.
const baseline = "  if (thirdPerson) {\n    // over-the-shoulder spring arm that pulls in when terrain/walls are in the way\n    const look = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);\n    const pivot = new THREE.Vector3(player.pos.x + rx * 0.45, player.pos.y + 1.55, player.pos.z + rz * 0.45);\n    // keep the pivot under any ceiling (gallery floors, arches) so the arm never starts inside geometry\n    const up = staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(player.pos.x, player.pos.y + 1.0, player.pos.z), new THREE.Vector3(0, 1, 0)), THREE.DoubleSide);\n    if (up && up.distance < 0.85) pivot.y = Math.max(player.pos.y + 0.9, up.point.y - 0.3);\n    // The shoulder offset itself must not start on the other side of a nearby wall.\n    const origin = new THREE.Vector3(player.pos.x, pivot.y, player.pos.z);\n    const side = pivot.clone().sub(origin), sideLength = side.length();\n    const sideHit = staticBVH.raycastFirst(new THREE.Ray(origin, side.clone().normalize()), THREE.DoubleSide);\n    if (sideHit && sideHit.distance < sideLength + 0.15) pivot.copy(origin).addScaledVector(side.normalize(), Math.max(0, sideHit.distance - 0.15));\n    const back = look.clone().negate();\n    const hit = staticBVH.raycastFirst(new THREE.Ray(pivot, back), THREE.DoubleSide);\n    const want = shoulderArmLength(ads, player.gliding, hit?.distance);\n    camDist = want < camDist ? want : THREE.MathUtils.damp(camDist, want, 6, dt);\n    camera.position.copy(pivot).addScaledVector(back, camDist);\n    eye.copy(camera.position);\n  } else camera.position.copy(eye);\n";
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const start=source.indexOf('  if (thirdPerson) {',source.indexOf('function frame('));
const optimized=source.slice(start,source.indexOf('  // Full-body servant viewer',start));
test('scratch camera rays preserve ceiling, shoulder, back-wall and ADS results across 1,000 views',()=>{
 const geometry=new THREE.BoxGeometry(12,4,12);geometry.translate(0,2,0);
 const bvh=new MeshBVH(geometry);
 const make=()=>vm.createContext({THREE,shoulderArmLength,staticBVH:bvh,thirdPerson:true,
  player:{pos:new THREE.Vector3(),gliding:false},camera:new THREE.PerspectiveCamera(),eye:new THREE.Vector3(),
  cameraLook:new THREE.Vector3(),cameraPivot:new THREE.Vector3(),cameraOrigin:new THREE.Vector3(),
  cameraSide:new THREE.Vector3(),cameraBack:new THREE.Vector3(),cameraSideDirection:new THREE.Vector3(),
  cameraRay:new THREE.Ray(),cameraUp:new THREE.Vector3(0,1,0),camDist:4.2,rx:1,rz:0,ads:0,dt:1/60});
 const a=make(),b=make(),before=new vm.Script(baseline),after=new vm.Script(optimized);
 for(let i=0;i<1000;i++){
  const yaw=i*.173,pitch=Math.sin(i*.37)*1.4;
  for(const ctx of [a,b]){
   ctx.thirdPerson=i%29!==0;ctx.player.pos.set(Math.sin(i*.31)*5.9,Math.sin(i*.29)*1.1+1,Math.cos(i*.41)*5.9);
   ctx.player.gliding=i%7===0;ctx.camera.rotation.set(pitch,yaw,0,'YXZ');ctx.rx=Math.cos(yaw);ctx.rz=-Math.sin(yaw);ctx.ads=(i%11)/10;
   ctx.dt=(i%4+1)/120;ctx.eye.copy(ctx.player.pos).add(new THREE.Vector3(0,1.55,0));
  }
  before.runInContext(a);after.runInContext(b);
  assert.ok(a.camera.position.distanceTo(b.camera.position)<1e-10,`camera drift at view ${i}`);
  assert.ok(a.eye.distanceTo(b.eye)<1e-10,`eye drift at view ${i}`);
  assert.ok(Math.abs(a.camDist-b.camDist)<1e-10,`arm drift at view ${i}`);
 }
 geometry.dispose();
});
