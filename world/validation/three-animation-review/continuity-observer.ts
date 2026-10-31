import * as THREE from 'three';
/** Numeric CPU observations, not rendered brightness or mesh contact proof. */
export function createContinuityObserver(identity:string){
 const rows:any[]=[];const summaries:Record<string,any>={};let previous:any,previousRoot:any;
 const names=identity==='musashi'?['mixamorigLeftFoot','mixamorigRightFoot','mixamorigLeftHand','mixamorigRightHand','Attachment_LeftHand_Katana','Attachment_RightHand_Katana']:identity==='blackbeard'?['FootL','FootR','HandL','HandR','Blackbeard_Muzzle']:['H_ForeHoof_L','H_ForeHoof_R','H_HindHoof_L','H_HindHoof_R','RiderSeatAnchor','SaddleSocket','SaberTip'];
 const visible=(o:any)=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 function observe(w:any,seconds:number,actor:any){
  const stage=w.ultimateStage,frame=w.ultimateDirector.frame,cinematic=!!w.ultimateDirector.active,root=cinematic?stage.clone:actor;if(!root)return;
  root.updateWorldMatrix(true,true);const camera=cinematic?stage.camera:w.camera;camera.updateWorldMatrix(true,false);
  const nodes=names.map(name=>{const o=root.getObjectByName(name);return o?{name,p:o.getWorldPosition(new THREE.Vector3()).toArray(),localP:root.worldToLocal(o.getWorldPosition(new THREE.Vector3())).toArray()}:null;}).filter(Boolean);
  const row:any={seconds,scope:cinematic?'private-stage':'world',phase:cinematic?frame?.phase:null,progress:cinematic?frame?.progress:null,strikeCount:cinematic?frame?.strikeCount:null,visible:visible(root),root:root.getWorldPosition(new THREE.Vector3()).toArray(),rootQ:root.getWorldQuaternion(new THREE.Quaternion()).toArray(),camera:camera.getWorldPosition(new THREE.Vector3()).toArray(),cameraQ:camera.getWorldQuaternion(new THREE.Quaternion()).toArray(),nodes};
  const key=row.scope+':'+(row.phase??'follow');const summary=summaries[key]??={samples:0,visibleSamples:0,maxRootSpeed:0,maxNodeSpeed:{value:0},maxCameraSpeed:{value:0},maxCameraAngularSpeed:{value:0}};summary.samples++;if(row.visible)summary.visibleSamples++;
  if(previous&&previousRoot===root&&seconds>previous.seconds){const dt=seconds-previous.seconds,dist=(a:number[],b:number[])=>Math.hypot(...a.map((x,i)=>x-b[i]));summary.maxRootSpeed=Math.max(summary.maxRootSpeed,dist(row.root,previous.root)/dt);
   if(row.visible&&previous.visible)for(const node of nodes){const prev=previous.nodes.find((n:any)=>n.name===node!.name);if(prev){const speed=dist(node!.p,prev.p)/dt;if(speed>summary.maxNodeSpeed.value)summary.maxNodeSpeed={value:speed,node:node!.name,seconds,phase:row.phase,previousPhase:previous.phase};}}
   if(row.scope===previous.scope){const speed=dist(row.camera,previous.camera)/dt,angle=new THREE.Quaternion().fromArray(row.cameraQ).angleTo(new THREE.Quaternion().fromArray(previous.cameraQ))/dt;if(speed>summary.maxCameraSpeed.value)summary.maxCameraSpeed={value:speed,seconds,previousPhase:previous.phase};if(angle>summary.maxCameraAngularSpeed.value)summary.maxCameraAngularSpeed={value:angle,seconds,previousPhase:previous.phase};}
  }
  if(cinematic){let emissiveMax=0,lightIntensityMax=0,visibleEffectMeshes=0;stage.scene.traverse((o:any)=>{if(!visible(o))return;if(o.isLight)lightIntensityMax=Math.max(lightIntensityMax,o.intensity);if(o.isMesh){visibleEffectMeshes++;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.emissive)emissiveMax=Math.max(emissiveMax,Math.max(m.emissive.r,m.emissive.g,m.emissive.b)*(m.emissiveIntensity??1));}});row.materialEmissionMax=emissiveMax;row.lightIntensityMax=lightIntensityMax;row.visibleMeshes=visibleEffectMeshes;}
  // Capture full paid timeline, bounded local follow window only, never the long travel route.
  if(rows.length<(cinematic?2400:1200))rows.push(row);previous=row;previousRoot=root;
 }
 return{observe,report:()=>({scope:'Actual input 60Hz CPU transforms; visible ancestor checked. Node velocity and material emission are diagnostics, not sole contact or rendered brightness/GPU bloom. Intentional camera cuts require shot-specific review.',summaries,rows,capacity:2400,truncated:rows.length>=2400})};
}
