/** Native player/rifle pose matrix; no gameplay modifications. */
import * as THREE from 'three';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {playerFixture} from '../player-fixture.ts';
import {SkinnedCharacterAnimator as ProductionAnimator} from '../../src/skinnedCharacter.ts';
import {SkinnedCharacterAnimator as BeforeAnimator} from '../fixtures/player-pre-ads-pole.ts';
const SkinnedCharacterAnimator=process.argv.includes('--baseline')?BeforeAnimator:ProductionAnimator;
import {RuntimePoseExporter} from './export-runtime-pose.ts';
const out=process.argv[2];if(!out)throw Error('Explicit workspace output required');await mkdir(out,{recursive:true});
const f=await playerFixture(),animator=new SkinnedCharacterAnimator(f.rig),exporter=new RuntimePoseExporter(out),rows:any[]=[];
for(const {pitch,aim} of [{pitch:0,aim:1},{pitch:.8,aim:1},{pitch:-.3,aim:.5}]){const air=false;
 animator.reset(false);const state={speed:air?5.5:0,onGround:!air,swimming:false,vy:air?-2:0,moveYaw:0,armed:true,aim,pitch};for(let i=0;i<120;i++)animator.update(1/60,state);
 const arms:any={};for(const side of ['R','L']){const p=(n:string)=>f.rig.joints[n+'_'+side].getWorldPosition(new THREE.Vector3()),shoulder=p('Arm'),elbow=p('Forearm'),wrist=p('Hand');arms[side]={shoulder:shoulder.toArray(),elbow:elbow.toArray(),wrist:wrist.toArray(),bendDegrees:THREE.MathUtils.radToDeg(elbow.clone().sub(shoulder).angleTo(wrist.clone().sub(elbow))),reachError:f.rig.diagnostics.armReachError[side as 'R'|'L']};}
 const id=`player-ads-${pitch<0?'minus':'plus'}${Math.abs(pitch).toFixed(2)}-${air?'air':'ground'}`;rows.push({id,pitch,aim,air,arms});await exporter.frame(id,f.rig.root,{asset:fileURLToPath(new URL('../../../assets/characters/player_v2/player_v2.glb',import.meta.url)),extraAssets:[fileURLToPath(new URL('../../../assets/weapons/glb/01_Dawn_AR.glb',import.meta.url))],label:'Baseline actual rifle/ADS pose; air is held animation state, not ballistic trajectory',framing:{center:[0,1.30,0],size:1.25},view:'right',groundY:0});const manifest=JSON.parse(await readFile(out+'/'+id+'.json','utf8'));await writeFile(out+'/'+id+'-side.json',JSON.stringify({...manifest,id:id+'-side',view:'side'}));
}
await writeFile(out+'/metrics.json',JSON.stringify({scope:'Settled native pose geometry; camera/gameplay unchanged; no crouch state exists in current animator API',rows},null,2));f.dispose();console.log(JSON.stringify(rows));
