/** CPU bone-landmark framing, not a GPU or skinned silhouette guarantee. */
import * as THREE from 'three';
import {fileURLToPath} from 'node:url';
import {CHARACTER_KITS} from '../../src/characters/catalog.ts';
import {readCharacter} from './inspect.ts';
import {UltimateStage} from '../../src/ultimateStage.ts';
const report=[];
for(const identity of ['blackbeard','napoleon','musashi'] as const){
 const kit=CHARACTER_KITS[identity==='napoleon'?'napoleonMounted':identity];const {gltf}=await readCharacter(fileURLToPath(kit.assetUrl));
 const names=identity==='blackbeard'?['Head','ToeL','ToeR']:identity==='napoleon'?['Head','H_ForeHoof_L','H_ForeHoof_R','H_HindHoof_L','H_HindHoof_R']:['mixamorigHeadTop_End','mixamorigLeftToe_End','mixamorigRightToe_End'];
 for(const aspect of [16/9,4/3,21/9,9/16]){
  const stage=new UltimateStage();stage.begin({identity,sourceRoot:gltf.scene,clips:gltf.animations});
  let peak=0,minBody=1,maxBody=0;const failures=[];
  for(let tick=0;tick<=210;tick++){
   const elapsed=tick/60;const phase=elapsed<.65?'intro':elapsed<2.55?'charge':'release';const progress=phase==='intro'?elapsed/.65:phase==='charge'?(elapsed-.65)/1.9:(elapsed-2.55)/1.2;
   stage.update({elapsed,phase,progress,pulse:0,strikeCount:0});stage.setAspect(aspect);stage.scene.updateMatrixWorld(true);
   if(phase==='intro')continue;let low=Infinity,high=-Infinity;
   for(const name of names){const node=stage.scene.getObjectByName(name);if(!node)throw Error('missing '+name);const p=node.getWorldPosition(new THREE.Vector3()).project(stage.camera);peak=Math.max(peak,Math.abs(p.x),Math.abs(p.y));low=Math.min(low,p.y);high=Math.max(high,p.y);if(Math.abs(p.x)>1||Math.abs(p.y)>1)failures.push({tick,name,x:p.x,y:p.y});}
   minBody=Math.min(minBody,(high-low)/2);maxBody=Math.max(maxBody,(high-low)/2);
  }
  report.push({identity,aspect,peakNdc:peak,minBodyHeight:minBody,maxBodyHeight:maxBody,failures:failures.slice(0,5),failedLandmarks:failures.length});stage.dispose();
 }
}
console.log(JSON.stringify({criterion:'charge/precontact body head-to-ground landmarks; excludes deliberate face closeup, offscreen cannon shot and large impact VFX; no GPU claim',report},null,2));if(report.some(r=>r.failedLandmarks))process.exitCode=1;
