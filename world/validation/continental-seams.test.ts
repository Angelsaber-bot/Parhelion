import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {REGIONS} from '../src/map/regions';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {WorldGrid} from '../src/map/grid';
import {components} from '../tools/reground-scatter-parts';

const terrains:THREE.Mesh[]=[];
for(const def of REGIONS){
  const bytes=readFileSync(new URL(`../public/assets/${def.file}.core.glb`,import.meta.url));
  const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  bakeQuantized(scene);scene.position.set(def.offset[0],0,def.offset[1]);scene.updateMatrixWorld(true);
  terrains.push(scene.getObjectByName('Terrain') as THREE.Mesh);
}
const grid=new WorldGrid(terrains,-1080,-1080,2160,2),h=(x:number,z:number)=>grid.sampleHeight(x,z)!;
const joins=[[-360,-720,'x'],[360,-720,'x'],[-360,0,'x'],[360,0,'x'],[-360,720,'x'],[360,720,'x'],[-720,-360,'z'],[0,-360,'z'],[720,-360,'z'],[-720,360,'z'],[0,360,'z'],[720,360,'z']] as const;

test('no tile join is a ruled dyke: the seam never stands far above the ground on both sides of it', () => {
  for(const [jx,jz,axis] of joins)for(let s=-240;s<=240;s+=24){
    const at=(d:number)=>axis==='x'?h(jx+d,jz+s):h(jx+s,jz+d);
    const side=(sign:number)=>{let t=0;for(let d=60;d<=110;d+=10)t+=at(sign*d);return t/6;};
    const rim=at(0)-Math.max(side(-1),side(1));
    assert.ok(rim<4.5,`join ${jx},${jz} at ${s}: the seam stands ${rim.toFixed(1)} m above both sides`);
  }
});

test('join-band seating moves whole props, only vertically, only inside the join bands, onto the ground or fully under it', async () => {
  const [{NodeIO},{ALL_EXTENSIONS},{MeshoptDecoder}]=await Promise.all([import('@gltf-transform/core'),import('@gltf-transform/extensions'),import('meshoptimizer')]);
  const {seating}=await import('./join-band-seating.ts');
  await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
  assert.deepEqual(Object.keys(seating.regions).sort(),['alpha','blacksail','britain','kyoto','winter']);
  for(const [region,nodes] of Object.entries(seating.regions)){
    const doc=await io.read(new URL(`../public/assets/world_${region}.glb`,import.meta.url).pathname);
    for(const [name,edits] of Object.entries(nodes)){
      assert.match(name,/^(Trees_Trunks|Trees_Leaves|Rocks|Bushes|COL_Props)/,`${region}/${name}: only vegetation, rocks and their colliders`);
      const node=doc.getRoot().listNodes().find(n=>n.getName()===name)!,prim=node.getMesh()!.listPrimitives()[0],acc=prim.getAttribute('POSITION')!;
      const array=acc.getArray() as Int16Array,m=node.getWorldMatrix(),s=m[0]/32767,count=acc.getCount();
      const dq=new Int32Array(count);for(const [d,ranges] of edits)for(const [a,b] of ranges)for(let v=a;v<=b;v++){assert.equal(dq[v],0,`${name} vertex ${v} listed twice`);dq[v]=d;}
      const g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(Array.from(array,(q,i)=>q*s+m[12+i%3]-(i%3===1?dq[(i-1)/3]*s:0))),3));
      const index=prim.getIndices();if(index)g.setIndex(Array.from(index.getArray()!));
      const p=g.attributes.position;
      for(const c of components(g)){
        const shift=dq[c[0]];if(!c.some(v=>dq[v]!==0))continue;
        assert.ok(c.every(v=>dq[v]===shift),`${region}/${name}: a prop moves as one piece`);
        let x=0,z=0;for(const v of c){x+=p.getX(v);z+=p.getZ(v);}x/=c.length;z/=c.length;
        // crowns follow their trunk and may overhang the band edge by their radius
        assert.ok(Math.max(Math.abs(x),Math.abs(z))>=seating.band-(/^(Trees_Leaves|Bushes|COL_Props)/.test(name)?5:0),`${region}/${name}: seated prop at ${x.toFixed(0)},${z.toFixed(0)} lies inside the join band`);
        if(!/^(Trees_Trunks|Rocks)/.test(name))continue;
        let minY=Infinity,maxY=-Infinity,r=0;for(const v of c){const y=p.getY(v)+shift*s;minY=Math.min(minY,y);maxY=Math.max(maxY,y);r=Math.max(r,Math.hypot(p.getX(v)-x,p.getZ(v)-z));}
        const [ox,oz]=REGIONS.find(d=>d.id===region)!.offset;
        let ground=Infinity;for(const [dx,dz] of [[0,0],[r*.5,0],[-r*.5,0],[0,r*.5],[0,-r*.5]])ground=Math.min(ground,h(x+dx+ox,z+dz+oz));
        assert.ok(maxY<ground+.05||(minY-ground>-1.3&&minY-ground<.1),`${region}/${name} at ${x.toFixed(0)},${z.toFixed(0)}: base ${(minY-ground).toFixed(2)} m from the ground`);
      }
      g.dispose();
    }
  }
});
