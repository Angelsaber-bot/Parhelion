import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {Batch} from '../tools/gen/geo';
import {Frame,gable,hipRoof,workshopRoof} from '../tools/gen/orleans/craft';
for(const [name,build] of [['gable',gable],['hip',hipRoof],['workshop',(f:Frame,w:number,d:number,h:number,_rise:number,c:string)=>workshopRoof(f,w,d,h,c)]] as const){
  for(const [w,d] of [[9,11],[14,18]])test(`${name} ${w}×${d}: roof has sealed gables/soffit and outward-facing top and bottom`,()=>{
    const b=new Batch('roof'),f=new Frame(b,0,0,0);build(f,w,d,0,4,'#53677b');const g=b.vis[0],p=g.attributes.position;
    const edges=new Map<string,{count:number;balance:number}>(),key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(x=>x.toFixed(5)).join(',');
    for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){const a=key(i+j),q=key(i+(j+1)%3),id=a<q?`${a}|${q}`:`${q}|${a}`,e=edges.get(id)??{count:0,balance:0};e.count++;e.balance+=a<q?1:-1;edges.set(id,e);}
    for(const edge of edges.values()){assert.equal(edge.count,2);assert.equal(edge.balance,0,'neighbours have opposite winding');}
    const bvh=new MeshBVH(g.clone()),top=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(0,20,0),new THREE.Vector3(0,-1,0)),THREE.FrontSide),bottom=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(0,-2,0),new THREE.Vector3(0,1,0)),THREE.FrontSide);
    assert.ok(top&&top.point.y>1);assert.ok(bottom&&Math.abs(bottom.point.y)<1e-5);
    bvh.geometry.dispose();b.vis.forEach(g=>g.dispose());b.col.forEach(g=>g.dispose());
  });
}
