/** Node CPU-only clone/setup and update cost. No shader upload, browser, FPS or GPU claim. */
import * as THREE from 'three';
import { fileURLToPath } from 'node:url';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import { readCharacter } from '../characters/inspect.ts';
import { SERVANT_MODELS } from '../../src/servant.ts';
import { CHARACTER_KITS } from '../../src/characters/catalog.ts';
import { UltimateStage } from '../../src/ultimateStage.ts';
const rows = [],median=(xs:number[])=>xs.length?[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)]:null;
for (const [identity, url] of [['saber', SERVANT_MODELS.armor], ['blackbeard', CHARACTER_KITS.blackbeard.assetUrl], ['napoleon', CHARACTER_KITS.napoleonMounted.assetUrl], ['musashi', CHARACTER_KITS.musashi.assetUrl]]) {
 const { gltf } = await readCharacter(fileURLToPath(new URL(url)));
 const stage = new UltimateStage(), samples: number[] = [], boundsSamples: number[] = [],updateSamples:number[]=[];
 const original = THREE.Box3.prototype.setFromObject;let budget:unknown;
 THREE.Box3.prototype.setFromObject = function(object, precise) {const start=performance.now();try{return original.call(this,object,precise);}finally{boundsSamples.push(performance.now()-start);}};
 try { for (let i = 0; i < 12; i++) {
  const start = performance.now();stage.begin({identity,sourceRoot:gltf.scene,clips:gltf.animations});samples.push(performance.now()-start);
  if(i===0){let triangles=0,meshes=0;const owned=(stage as unknown as {geometries:Set<THREE.BufferGeometry>}).geometries;
   stage.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh&&owned.has(mesh.geometry)){meshes++;triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;}});budget={...stage.resourceCounts,stageOnlyMeshObjects:meshes,stageOnlyTriangleInstances:triangles};
   for(let tick=0;tick<=312;tick++){const elapsed=tick/60,phase=elapsed<.65?'intro':elapsed<2.55?'charge':elapsed<4?'release':'outro',progress=phase==='intro'?elapsed/.65:phase==='charge'?(elapsed-.65)/1.9:phase==='release'?(elapsed-2.55)/1.45:(elapsed-4)/1.2;
    const strikeCount=elapsed<2.9?0:identity==='saber'||identity==='napoleon'?1:elapsed<3.2?1:elapsed<3.6?2:3;
    const before=performance.now();stage.update({elapsed,phase,progress,pulse:0,strikeCount,sourceRoot:gltf.scene});stage.setAspect(16/9);stage.scene.updateMatrixWorld(true);updateSamples.push(performance.now()-before);
   }
  }stage.end();
 }}finally{THREE.Box3.prototype.setFromObject=original;stage.dispose();}
 rows.push({identity,firstBeginMs:samples[0],repeatMedianBeginMs:median(samples.slice(1)),samplesMs:samples,boundsCalls:boundsSamples.length,boundsSamplesMs:boundsSamples,firstUpdateMs:updateSamples[0],medianUpdateMs:median(updateSamples),maxUpdateMs:Math.max(...updateSamples),updateSamples: updateSamples.length,budget});
}
const sourceHashes:Record<string,string>={};for(const name of ['ultimateStage','saberStageArt','ultimatePerformance','eraStageArt','mountedStageArt','musashiStageArt','eraBladeTrace','eraUltimatePerformance'])sourceHashes[name]=createHash('sha256').update(await readFile(new URL('../../src/'+name+'.ts',import.meta.url))).digest('hex');
console.log(JSON.stringify({node:process.version,cpuOnly:true,note:'Same loaded model,12 begin/end cycles; includes cold first call per identity in one process. First cast then313 presentation updates at60Hz including matrix propagation; source stays loaded, no gameplay/render/shader work. Mesh counts are object/triangle budgets, NOT measured GPU draws. Generic benchmark strike schedule is presentation-only. Timings vary with ordinary machine load, JIT and garbage collection; no FPS inference.',sourceHashes,rows},null,2));
