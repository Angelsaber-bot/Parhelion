/** Material state + generated shader source parity, without GPU execution. */
import * as THREE from 'three';
import{createHash}from'node:crypto';import{writeFileSync}from'node:fs';
import{bootWorldWithoutGpu}from'./world-dom-boot.fixture';
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
function texture(t:THREE.Texture){const image=t.image as any;return{type:t.type,format:t.format,colorSpace:t.colorSpace,wrapS:t.wrapS,wrapT:t.wrapT,minFilter:t.minFilter,magFilter:t.magFilter,flipY:t.flipY,repeat:t.repeat.toArray(),offset:t.offset.toArray(),rotation:t.rotation,matrix:t.matrix.toArray(),width:image?.width,height:image?.height,data:image?.data?hash([...image.data]):null};}
function signature(m:THREE.Material){const data=m.toJSON()as any;delete data.uuid;delete data.metadata;delete data.textures;delete data.images;
 for(const[key,value]of Object.entries(m))if(value instanceof THREE.Texture)data[key]=texture(value);
 const name=m.type==='MeshToonMaterial'?'toon':m.type==='MeshBasicMaterial'?'basic':m.type==='MeshStandardMaterial'?'standard':null;
 let generated:unknown=null;if(name){const base=THREE.ShaderLib[name],shader={vertexShader:base.vertexShader,fragmentShader:base.fragmentShader,uniforms:THREE.UniformsUtils.clone(base.uniforms)};m.onBeforeCompile(shader as any,{}as THREE.WebGLRenderer);generated={vertex:hash(shader.vertexShader),fragment:hash(shader.fragmentShader)};}
 return hash({data,programKey:m.customProgramCacheKey(),generated});}
const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true});
try{const w=h.world;h.frame(1000);await h.settleAssets();h.frame(1016);const cache=new Map<THREE.Material,string>(),rows:any[]=[];
 w.scene.getObjectByName('World').traverse((o:THREE.Object3D)=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const path=[];for(let p:THREE.Object3D|null=mesh;p;p=p.parent)path.unshift(p.name||p.type);const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];for(const m of materials)if(!cache.has(m))cache.set(m,signature(m));rows.push({path:path.join('/'),materials:materials.map(m=>cache.get(m))});});
 writeFileSync(process.argv[2],JSON.stringify({scope:'Exact authored material scalar/texture state and generated shader source hash parity. No shader GPU compile/pixel claim.',sourceRoot:process.env.WORLD_SOURCE_QA_ROOT,materialIdentities:cache.size,rows,errors:h.errors},null,2));console.log(cache.size,rows.length);
}finally{await h.close();}
