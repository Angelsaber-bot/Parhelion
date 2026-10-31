/** Scalar/geometry evidence only; dark assigned materials are not GPU rendering failures. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LANDMARK_REVIEW } from './landmark-review-data';
const root=process.argv[2]; assert(root,'REVIEW_ROOT required');
const rows=[];
for(const site of LANDMARK_REVIEW.filter(s=>!process.argv[3]||process.argv[3].split(',').includes(s.region))){
  const read=async(q:string)=>JSON.parse(await readFile(path.join(root,q,'meshes',`${site.region}.json`),'utf8'));
  const low=await read('low'),normal=await read('med');
  assert.deepEqual(low.cameras,normal.cameras,`${site.region}: exact native camera/ray parity`);
  assert.equal(low.triangles,normal.triangles);
  for(const c of low.cameras){
    assert(c.onGround&&!c.swimming&&Math.abs(c.feet[1]-site.origin[1])<1,`${site.region}/${c.label}: actual interior-height support, not rooftop setup`);
    assert.equal(c.cameraWallHit,null,`${site.region}/${c.label}: no static wall between player head and camera`);
  }
  const dark=[];let materialReferences=0,fullyBlackVertices=0,totalVertices=0;
  for(const mesh of normal.meshes){
    assert(mesh.materials.length>0,`${mesh.name}: assigned material`);materialReferences+=mesh.materials.length;
    for(const m of mesh.materials){
      assert(m.color.length===3&&m.color.every((x:number)=>Number.isFinite(x)&&x>=0));
      assert(Number.isFinite(m.opacity)&&m.opacity>=0&&m.opacity<=1);
    }
    const bytes=await readFile(path.join(root,'med','meshes',mesh.file));
    let darkVertices=0,minLuminance=Infinity,maxLuminance=0;
    for(let i=0;i<mesh.count;i++){
      const group=mesh.groups.find((g:any)=>i>=g.start&&i<g.start+g.count);
      assert(group&&mesh.materials[group.materialIndex],`${mesh.name}/${i}: material group assigned`);
      const m=mesh.materials[group.materialIndex],rgb=[0,1,2].map(k=>{
        const tint=bytes.readFloatLE(mesh.count*12+i*12+k*4);assert(Number.isFinite(tint));
        return m.color[k]*(m.vertexColors?tint:1);
      });
      const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
      minLuminance=Math.min(minLuminance,luminance);maxLuminance=Math.max(maxLuminance,luminance);
      if(luminance<.025)darkVertices++;
      if(rgb.every(x=>x===0))fullyBlackVertices++;
      totalVertices++;
    }
    if(darkVertices)dark.push({mesh:mesh.name,darkVertices,vertices:mesh.count,minLuminance,maxLuminance});
  }
  rows.push({region:site.region,landmark:site.title,poses:low.cameras.length,triangles:low.triangles,
    materialReferences,totalVertices,fullyBlackVertices,lowPointLights:low.lights.length,
    normalPointLights:normal.lights.length,cameraParity:true,staticCameraWallHits:0,
    darkAssignedGeometry:dark.sort((a,b)=>b.darkVertices-a.darkVertices),
    interpretation:site.region==='kyoto'?'Honnoji charred #2e2626 is intentional source palette; never auto-recolor':'Dark assigned materials alone are not missing-material evidence'});
}
await writeFile(path.join(root,'landmark-audit.json'),JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows.map(({darkAssignedGeometry,...row})=>({...row,darkMeshCount:darkAssignedGeometry.length})),null,2));
