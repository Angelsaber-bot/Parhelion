/** Independent ownership proof for dropping construction-array references; no GPU disposal. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeParts} from '../src/settlements/merge';
function buffers(g:THREE.BufferGeometry){const result=new Set<ArrayBufferLike>();for(const a of Object.values(g.attributes)){result.add((a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute?(a as THREE.InterleavedBufferAttribute).data.array.buffer:(a as THREE.BufferAttribute).array.buffer);}if(g.index)result.add(g.index.array.buffer);return result;}
for(const mode of ['indexed','nonindexed','mixed'] as const)test(`merged ${mode} collider owns independent buffers after construction arrays are cleared`,()=>{
 const a=new THREE.BoxGeometry(4,1,4),indexedB=new THREE.BoxGeometry(1,3,1).translate(4,0,0);
 const b=mode==='indexed'?indexedB:indexedB.toNonIndexed();
 const first=mode==='nonindexed'?a.toNonIndexed():a;
 if(mode==='mixed')b.deleteAttribute('uv');
 const parts=[first,b],sourceBuffers=new Set(parts.flatMap(g=>[...buffers(g)]));
 const merged=mergeParts(parts),bvh=new MeshBVH(merged),owned=buffers(merged);
 for(const buffer of owned)assert.equal(sourceBuffers.has(buffer),false,'merged attributes/index must not share source backing stores');
 const ray=new THREE.Ray(new THREE.Vector3(0,10,0),new THREE.Vector3(0,-1,0));
 const before=bvh.raycastFirst(ray,THREE.DoubleSide);assert.ok(before);
 const bytes=new Uint8Array(merged.attributes.position.array.buffer).slice();let disposed=0;
 for(const g of parts)g.addEventListener('dispose',()=>disposed++);
 parts.length=0;
 assert.equal(disposed,0);assert.equal(bvh.raycastFirst(ray,THREE.DoubleSide)?.distance,before.distance);
 assert.deepEqual(new Uint8Array(merged.attributes.position.array.buffer),bytes);
 assert.ok(b.attributes.position.count>0);assert.ok(first.attributes.position.count>0);
 merged.dispose();a.dispose();indexedB.dispose();if(first!==a)first.dispose();if(b!==indexedB)b.dispose();
});
