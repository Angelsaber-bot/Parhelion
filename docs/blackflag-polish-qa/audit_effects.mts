/** Independent CPU resource/bounds audit. No browser, GPU timing or FPS claim. */
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import * as THREE from '../../arena-game/node_modules/three/build/three.module.js';
import { BlackflagEffects, BLACKFLAG_ATMOSPHERE } from '../../arena-game/src/blackflagPresentation.ts';
const results = [];
for (const quality of ['high', 'low'] as const) {
  const texture = new THREE.Texture(), effects = new BlackflagEffects(texture, quality);
  const objects = [...effects.root.children];
  const points = objects.filter(object => object.isPoints);
  const arrays = points.map(point => point.geometry.attributes.position.array);
  const geometries = points.map(point => point.geometry), materials = points.map(point => point.material);
  const range = points.map(point => ({name: point.name, x:[Infinity,-Infinity], y:[Infinity,-Infinity], z:[Infinity,-Infinity]}));
  for (let tick=0;tick<60000;tick++) {
    effects.update(tick%401===0?NaN:tick%599===0?Infinity:tick%997===0?-1:tick%1999===0?300:1/60);
    if (tick%100!==0)continue;
    points.forEach((point,index)=>{
      const a=point.geometry.attributes.position.array;
      assert.equal(a,arrays[index]);assert.equal(point.geometry,geometries[index]);assert.equal(point.material,materials[index]);
      for(let k=0;k<a.length;k+=3){
        const x=a[k],y=a[k+1],z=a[k+2];assert(Number.isFinite(x+y+z));
        assert(Math.hypot(x,y,z)<point.geometry.boundingSphere.radius);
        if(point.name.includes('sea_glints')){assert(Math.abs(z)>21.5);assert(y>-6.025&&y<-5.9);}else assert(y>5.7);
        for(const [axis,value] of [['x',x],['y',y],['z',z]] as const){range[index][axis][0]=Math.min(range[index][axis][0],value);range[index][axis][1]=Math.max(range[index][axis][1],value);}
      }
    });
  }
  assert.deepEqual(effects.root.children,objects);
  let geometryDisposals=0, materialDisposals=0, textureDisposals=0;
  texture.addEventListener('dispose',()=>textureDisposals++);
  points.forEach(point=>{point.geometry.addEventListener('dispose',()=>geometryDisposals++);point.material.addEventListener('dispose',()=>materialDisposals++);});
  effects.dispose();effects.dispose();effects.update(1/60);
  assert.equal(geometryDisposals,points.length);assert.equal(materialDisposals,points.length);assert.equal(textureDisposals,0);assert.equal(effects.root.children.length,0);
  results.push({quality,updates:60000,pointDraws:points.length,points:arrays.reduce((n,a)=>n+a.length/3,0),positionBufferBytes:arrays.reduce((n,a)=>n+a.byteLength,0),geometryDisposals,materialDisposals,sharedTextureDisposals:textureDisposals,ranges:range});
  texture.dispose();
}
const source=readFileSync(new URL('../../arena-game/src/blackflagPresentation.ts',import.meta.url),'utf8');
const update=source.split('  update(dt: number) {')[1].split('\n  dispose()')[0];
assert(!/\bnew\s|\.clone\(|\.slice\(|\.map\(/.test(update));
const report={scope:'CPU resource identity, bounded positions and disposal across 120,000 total update calls, not WebGL/FPS or a JS heap benchmark',results,atmosphere:BLACKFLAG_ATMOSPHERE,explicitUpdateObjectCreation:false};
writeFileSync(new URL('./effects-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
