import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp;
const BODY=['Hips','Spine','Chest','Neck','Head','ClavicleL','ClavicleR','UpperArmL','ForearmL','HandL','UpperArmR','ForearmR','HandR','ThighL','ShinL','FootL','ThighR','ShinR','FootR','H_Neck','H_Head'];
/** One ordinary mixer clip: contact-time native socket, duration, root/horse gait
 * and event ownership are unchanged. Bake only recognized private pose channels. */
export function remasterCaptainCavalryClip(source:THREE.AnimationClip,model:THREE.Object3D,state:string,identity:string):THREE.AnimationClip {
 if((model.getObjectByName('CaptainCavalry remaster tailoring')??model.getObjectByName('CaptainCavalry_remaster_tailoring'))?.userData.captainCavalryClipRevision===2)return source;
 const mounted=identity==='napoleon'||identity==='napoleonMounted';
 if(identity!=='blackbeard'&&!mounted||!['idle','walk','run','attack','melee'].includes(state))return source;
 const hierarchy=(o:THREE.Object3D):THREE.Object3D=>{const c=new THREE.Object3D();c.name=o.name;c.position.copy(o.position);c.quaternion.copy(o.quaternion);c.scale.copy(o.scale);for(const n of o.children)if(!(n as THREE.Mesh).isMesh)c.add(hierarchy(n));return c;};
 const pose=hierarchy(model),get=(n:string)=>pose.getObjectByName(n);
 if(['Hips','Spine','Chest','Head','UpperArmR','ForearmR','HandR','UpperArmL','ForearmL','HandL'].some(n=>!get(n)))return source;
 const names=BODY.filter(n=>get(n)&&source.tracks.some(t=>t.name===n+'.quaternion'));
 const channels=source.tracks.filter(t=>names.some(n=>t.name===n+'.quaternion'||t.name===n+'.position'));
 const originals=channels.map(t=>({name:t.name,bone:get(t.name.slice(0,t.name.lastIndexOf('.')))! ,property:t.name.slice(t.name.lastIndexOf('.')+1),sample:(t as THREE.KeyframeTrack&{createInterpolant():THREE.Interpolant}).createInterpolant()}));
 const mixer=new THREE.AnimationMixer(pose),action=mixer.clipAction(source);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const samples=Math.ceil(source.duration*60),times:number[]=[],values=new Map(channels.map(t=>[t.name,[] as number[]]));
 const wp=(b:THREE.Object3D)=>b.getWorldPosition(new THREE.Vector3()),wq=(b:THREE.Object3D)=>b.getWorldQuaternion(new THREE.Quaternion());
 const setQ=(b:THREE.Object3D,q:THREE.Quaternion)=>{b.quaternion.copy(wq(b.parent!).invert().multiply(q));b.updateWorldMatrix(false,true);};
 const axis=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).transformDirection(pose.matrixWorld);
 const rotate=(name:string,a:THREE.Vector3,angle:number)=>{const b=get(name);if(b&&Math.abs(angle)>1e-10)setQ(b,new THREE.Quaternion().setFromAxisAngle(a,angle).multiply(wq(b)));};
 const aim=(b:THREE.Object3D,c:THREE.Object3D,t:THREE.Vector3)=>{const p=wp(b),from=wp(c).sub(p).normalize(),to=t.clone().sub(p).normalize();setQ(b,new THREE.Quaternion().setFromUnitVectors(from,to).multiply(wq(b)));};
 const solve=(a:THREE.Object3D,b:THREE.Object3D,c:THREE.Object3D,target:THREE.Vector3,pole:THREE.Vector3,rotation:THREE.Quaternion)=>{const p=wp(a),l1=p.distanceTo(wp(b)),l2=wp(b).distanceTo(wp(c)),delta=target.clone().sub(p),distance=clamp(delta.length(),Math.abs(l1-l2)+1e-6,l1+l2-1e-6),direction=delta.normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));pole.addScaledVector(direction,-pole.dot(direction)).normalize();aim(a,b,p.clone().addScaledVector(direction,along).addScaledVector(pole,height));aim(b,c,p.clone().addScaledVector(direction,distance));setQ(c,rotation);};
 const attack=state==='attack'||state==='melee',contact=mounted?23/30:17/30;
 for(let frame=0;frame<=samples;frame++){
  const time=source.duration*frame/samples,phase=frame/samples*Math.PI*2;mixer.setTime(time);
  // Constant mixer tracks otherwise retain last sample's procedural rotation.
  for(const o of originals){const a=o.sample.evaluate(time);if(o.property==='quaternion')o.bone.quaternion.fromArray(a);else o.bone.position.fromArray(a);}pose.updateMatrixWorld(true);
  const envelope=attack?(time<=contact?Math.sin(Math.PI*time/contact):Math.sin(Math.PI*(time-contact)/(source.duration-contact))):1;
  // Exact native event pose (including weapon transform); interpolation cannot
  // invent a different hit line at either authored 30Hz contact key.
  if(!attack||Math.abs(envelope)>1e-7){
   const hands=['R','L'].map(side=>({side,chain:[get('UpperArm'+side)!,get('Forearm'+side)!,get('Hand'+side)!],p:wp(get('Hand'+side)!),q:wq(get('Hand'+side)!)}));
   const feet=!mounted&&attack?['L','R'].map(side=>({chain:[get('Thigh'+side)!,get('Shin'+side)!,get('Foot'+side)!],p:wp(get('Foot'+side)!),q:wq(get('Foot'+side)!)})):[];
   const movement=state==='run'?1:state==='walk'?.55:0,breath=Math.sin(phase),pre=time<contact;
   if(attack){
    rotate('Spine',axis(0,1,0),(mounted?-.14:-.24)*envelope*(pre?1:-.55));
    rotate('Chest',axis(1,0,0),(mounted?.14:.07)*envelope*(pre?1:-.45));
    rotate('Head',axis(0,1,0),(mounted?.07:.12)*envelope*(pre?1:-.4));
    rotate('Neck',axis(1,0,0),-.035*envelope);
    if(!mounted){get('Hips')!.position.y-=.026*envelope;pose.updateMatrixWorld(true);}
    else {rotate('H_Neck',axis(1,0,0),.05*envelope);rotate('H_Head',axis(1,0,0),-.045*envelope);}
    for(const h of hands){
     if(h.side==='R')h.p.addScaledVector(axis(0,1,0),(mounted?.09:.035)*envelope*(pre?1:-.5));
     else if(!mounted)h.p.addScaledVector(axis(0,1,0),.095*envelope).addScaledVector(axis(0,0,1),.08*envelope);
    }
   }else{
    rotate('Spine',axis(0,1,0),-.025*movement*Math.sin(phase));
    rotate('Chest',axis(1,0,0),.007*breath+(mounted?.025:.018)*movement);
    rotate('Head',axis(0,1,0),.025*Math.sin(phase+.6)*(1-movement*.6));
    rotate('Neck',axis(1,0,0),-.009*breath);
    if(mounted){rotate('H_Head',axis(1,0,0),.012*Math.sin(phase));rotate('H_Neck',axis(0,1,0),.012*Math.sin(phase));}
   }
   for(const h of hands)solve(h.chain[0],h.chain[1],h.chain[2],h.p,axis(h.side==='R'?-1:1,-.75,.05),h.q);
   for(const f of feet)solve(f.chain[0],f.chain[1],f.chain[2],f.p,axis(0,0,1),f.q);
  }
  times.push(time);for(const o of originals)values.get(o.name)!.push(...(o.property==='quaternion'?o.bone.quaternion:o.bone.position).toArray());
 }
 mixer.stopAllAction();mixer.uncacheRoot(pose);
 const tracks=source.tracks.map(t=>{if(!values.has(t.name))return t.clone();const c=t.clone();c.times=new Float32Array(times);c.values=new Float32Array(values.get(t.name)!);return c;});
 return new THREE.AnimationClip(source.name,source.duration,tracks);
}
