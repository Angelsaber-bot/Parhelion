/** Export actual runtime geometry and CharacterAnimator poses for independent offline visual QA. */
import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {attachExplorerRifle} from '../../src/weaponArt.ts';
import {buildCharacter,CharacterAnimator} from '../../src/character.ts';
(globalThis as any).FileReader??=class{result:ArrayBuffer|null=null;onload:any;onloadend:any;readAsArrayBuffer(blob:Blob){blob.arrayBuffer().then(buf=>{this.result=buf;this.onload?.({target:this});this.onloadend?.({target:this});});}};
const fallback=process.argv.includes('--fallback');
async function realRifle(){const b=readFileSync(new URL('../../../assets/weapons/glb/01_Dawn_AR.glb',import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const directory=process.argv[2];if(!directory)throw new Error('pass output review directory');mkdirSync(directory,{recursive:true});
const base={speed:0,onGround:true,swimming:false,vy:0,moveYaw:0};
const inventories:Record<string,unknown>={};
const states={ready:base,aim:{...base,aim:1,pitch:0},aim_up:{...base,aim:1,pitch:.5},aim_down:{...base,aim:1,pitch:-.5},run:{...base,speed:9},swim:{...base,speed:3,onGround:false,swimming:true},glide:{...base,speed:5,onGround:false,vy:-2,gliding:true}};
for(const [name,state] of Object.entries(states)){
 const rig=buildCharacter(new THREE.MeshStandardMaterial({name:'Runtime vertex colours',vertexColors:true,roughness:.85})),animator=new CharacterAnimator(rig);
 if(!fallback){const weapon=attachExplorerRifle(rig,undefined,realRifle);await weapon.ready;if(rig.joints.Gun.userData.artState!=='ready')throw new Error('Real rifle attachment failed');}
 for(let i=0;i<130;i++)animator.update(1/60,state);rig.root.updateMatrixWorld(true);
 let meshCount=0,triangles=0,materialGroups=0;rig.root.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;meshCount++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;materialGroups+=Array.isArray(m.material)?m.geometry.groups.length:1;});inventories[name]={meshCount,triangles,materialGroups,scope:'Full rig with equipped gun; inventory only, excludes runtime outline duplication and shadows/post passes; not GPU draw/FPS'};
 const glb=await new GLTFExporter().parseAsync(rig.root,{binary:true});writeFileSync(`${directory}/${name}.glb`,Buffer.from(glb as ArrayBuffer));
}
writeFileSync(`${directory}/poses.json`,JSON.stringify({source:'Actual runtime buildCharacter + CharacterAnimator + attachExplorerRifle;130steps at1/60s',fallback,states,inventories},null,2));
