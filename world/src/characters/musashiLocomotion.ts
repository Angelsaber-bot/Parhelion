import * as THREE from 'three';

const PREFIX = 'mixamorig';
const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1);
const SIDES = [['Left', 1], ['Right', -1]] as const;
const CHANNELS = ['Spine', 'Spine1', 'Spine2', 'Neck', ...SIDES.flatMap(([side]) => [`${side}Shoulder`, `${side}Arm`, `${side}ForeArm`, `${side}Hand`])];

/**
 * Musashi's delivered gait pins both hands in a raised guard. Bake just the upper-body
 * channels into relaxed, alternating low carries. This remains one ordinary mixer action,
 * so crossfades (including interrupted transitions) cannot leave a live IK correction on
 * Attack. Locomotion fingers/grips, foot contacts, hips and assets are untouched.
 * Ordinary attack has a separately baked, contact-preserving performance below.
 * Both katana trail outside the legs, angled back rather than pointing through the floor.
 */
export function musashiLocomotionClip(source: THREE.AnimationClip, model: THREE.Object3D, state: string): THREE.AnimationClip {
  if (state === 'attack') return musashiExpressionClip(musashiAttackClip(source, model), model, state);
  if (!['idle', 'walk', 'run'].includes(state)) return source;
  // No meshes, materials, geometries, skeletons or GPU resources are cloned for baking.
  function hierarchy(object: THREE.Object3D): THREE.Object3D {
    const copy = new THREE.Object3D(); copy.name = object.name;
    copy.position.copy(object.position); copy.quaternion.copy(object.quaternion); copy.scale.copy(object.scale);
    for (const child of object.children) if (!(child as THREE.Mesh).isMesh) copy.add(hierarchy(child));
    return copy;
  }
  const pose = hierarchy(model), bones = new Map<string, THREE.Object3D>();
  for (const name of CHANNELS) {
    const bone = pose.getObjectByName(`${PREFIX}${name}`);
    if (!bone) return source; // A different/unrecognized asset must never be partially retargeted.
    bones.set(name, bone);
  }
  pose.updateMatrixWorld(true);
  const restWorld = new Map(CHANNELS.map(name => [name, bones.get(name)!.getWorldQuaternion(new THREE.Quaternion())]));
  if (CHANNELS.some(name => !source.tracks.some(track => track.name === `${PREFIX}${name}.quaternion`))) return source;
  const originals = new Map(CHANNELS.map(name => {
    const track = source.tracks.find(track => track.name === `${PREFIX}${name}.quaternion`)!;
    return [name, (track as THREE.QuaternionKeyframeTrack & { createInterpolant(): THREE.Interpolant }).createInterpolant()];
  }));
  const mixer = new THREE.AnimationMixer(pose), action = mixer.clipAction(source);
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const samples = Math.ceil(source.duration * 60), times: number[] = [], values = new Map(CHANNELS.map(name => [name, [] as number[]]));
  const parentQ = new THREE.Quaternion(), delta = new THREE.Quaternion(), direction = new THREE.Vector3();
  function worldRotation(name: string, quaternion: THREE.Quaternion) {
    const bone = bones.get(name)!;
    bone.parent!.getWorldQuaternion(parentQ).invert(); bone.quaternion.copy(parentQ).multiply(quaternion).normalize();
    bone.updateWorldMatrix(false, true);
  }
  function pointBone(name: string, target: THREE.Vector3) {
    const rest = restWorld.get(name)!;
    direction.copy(UP).applyQuaternion(rest).normalize();
    delta.setFromUnitVectors(direction, target.normalize());
    worldRotation(name, delta.multiply(rest));
  }
  const motion = state === 'run' ? 1 : state === 'walk' ? .75 : 0;
  for (let frame = 0; frame <= samples; frame++) {
    const time = source.duration * frame / samples, phase = 2 * Math.PI * frame / samples;
    mixer.setTime(time);
    // PropertyMixer skips unchanged source values; explicitly restore channels we edit
    // so a constant spine/neck track cannot accumulate the previous sample's offset.
    for (const name of CHANNELS) bones.get(name)!.quaternion.fromArray(originals.get(name)!.evaluate(time));
    pose.updateMatrixWorld(true);
    // Keep the original grounded pelvis and leg cycle. Small thoracic counter-rotation
    // releases the rigid chest without re-solving or changing either foot's contact.
    const breath = Math.sin(phase), sway = motion * Math.sin(phase);
    for (const [name, x, y, z] of [
      ['Spine', -.015 * motion + .004 * breath, -.018 * sway, .008 * sway],
      ['Spine1', -.012 * motion, -.012 * sway, -.005 * sway],
      ['Spine2', .004 * breath, -.012 * sway, -.008 * sway],
      ['Neck', .015 * motion - .004 * breath, .018 * sway, .005 * sway],
    ] as const) {
      const bone = bones.get(name)!;
      bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z))).normalize();
      bone.updateWorldMatrix(false, true);
    }
    for (const [side, sign] of SIDES) {
      // Foot contact starts with the same-side leg forward: arms counter-swing.
      const swing = -sign * Math.cos(phase), follow = -sign * Math.cos(phase - .48);
      // Let the clavicle follow the chest, then the elbow trail the shoulder. The old
      // near-identical arm/forearm waves made the whole arm move like a rigid pendulum.
      const shoulder = bones.get(`${side}Shoulder`)!;
      shoulder.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
        .004 * breath, -sign * .018 * motion * swing, sign * .012 * motion * swing))).normalize();
      shoulder.updateWorldMatrix(false, true);
      const upper = new THREE.Vector3(sign * .18, -1, -.045 + motion * .29 * swing);
      const lower = new THREE.Vector3(sign * .075, -1, .25 + motion * (.22 * follow + .08 * (1 + swing)));
      // Arms remain close to the body; elbow flex changes over the stride instead of
      // locking the wrists to a constant bend. Fingers and hand-bound katana are intact.
      pointBone(`${side}Arm`, upper);
      pointBone(`${side}ForeArm`, lower);
      // The blade's authored rest-world direction is +Z. Align it to a low trailing
      // carry; wrist roll aligns the metacarpals with the forearm without changing grip.
      const blade = new THREE.Vector3(sign * .23, -.50 + motion * .075 * follow, -.84).normalize();
      const handQ = new THREE.Quaternion().setFromUnitVectors(FORWARD, blade).multiply(restWorld.get(`${side}Hand`)!);
      const finger = UP.clone().applyQuaternion(handQ).projectOnPlane(blade).normalize();
      const forearm = lower.clone().projectOnPlane(blade).normalize();
      const angle = Math.atan2(blade.dot(finger.clone().cross(forearm)), THREE.MathUtils.clamp(finger.dot(forearm), -1, 1));
      handQ.premultiply(new THREE.Quaternion().setFromAxisAngle(blade, angle));
      worldRotation(`${side}Hand`, handQ);
    }
    times.push(time);
    for (const name of CHANNELS) values.get(name)!.push(...bones.get(name)!.quaternion.toArray());
  }
  mixer.stopAllAction(); mixer.uncacheRoot(pose);
  const replaced = new Set(CHANNELS.map(name => `${PREFIX}${name}.quaternion`));
  const tracks = source.tracks.filter(track => !replaced.has(track.name)).map(track => track.clone());
  for (const name of CHANNELS) {
    // Exact loop closure: avoid Float32 timestamp rounding leaving a tiny wrap discontinuity.
    const rotations = values.get(name)!; rotations.splice(rotations.length - 4, 4, ...rotations.slice(0, 4));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${PREFIX}${name}.quaternion`, times, rotations));
  }
  return musashiExpressionClip(new THREE.AnimationClip(source.name, source.duration, tracks), model, state);
}


/** Two distinct load/cut/recovery phrases, with quiet low-carry bookends.
 * Contact poses and clock times remain exact; this cannot authorize damage.
 * Source asset, fingers/socket locals and all lower-body contact positions survive. */
function musashiAttackClip(source:THREE.AnimationClip,model:THREE.Object3D):THREE.AnimationClip{
 if(Math.abs(source.duration-1.6)>1e-4)return source;
 const low=musashiLocomotionClip(source,model,'idle');if(low===source)return source;
 const smooth=(x:number)=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
 const knots=[[0,0],[.24,.12],[.42,.29],[19/30,19/30],[.78,.82],[.95,.94],[33/30,33/30],[1.24,1.34],[1.6,1.6]];
 const remap=(time:number)=>{for(let i=1;i<knots.length;i++){const[a,x]=knots[i-1],[b,y]=knots[i];if(time<=b)return x+(y-x)*(time-a)/(b-a);}return source.duration;};
 const samples=96,times=Array.from({length:samples+1},(_,i)=>source.duration*i/samples),a=new THREE.Quaternion(),b=new THREE.Quaternion();
 const replaced=new Set(CHANNELS.map(n=>`${PREFIX}${n}.quaternion`));
 const tracks=source.tracks.map(track=>{
  const interpolation=(track as THREE.KeyframeTrack&{createInterpolant():THREE.Interpolant}).createInterpolant(),size=track.getValueSize(),values:number[]=[];
  const quietTrack=low.tracks.find(t=>t.name===track.name),quiet=replaced.has(track.name)&&quietTrack?(quietTrack as THREE.KeyframeTrack&{createInterpolant():THREE.Interpolant}).createInterpolant():undefined;
  for(const time of times){
   const sample=Array.from(interpolation.evaluate(remap(time)));
   const weight=(1-smooth(time/.26))+smooth((time-1.25)/.35);
   if(quiet&&weight>0){a.fromArray(sample);b.fromArray(quiet.evaluate(time));a.slerp(b,Math.min(1,weight)).normalize();values.push(...a.toArray());}else values.push(...sample.slice(0,size));
  }
  const copy=track.clone();copy.times=new Float32Array(times);copy.values=new Float32Array(values);return copy;
 });
 return new THREE.AnimationClip(source.name,source.duration,tracks);
}

/** Native facial morphs only: one calm idle blink and a restrained combat focus.
 * Every state owns both channels so interruption/crossfade cannot leave a stare. */
function musashiExpressionClip(source:THREE.AnimationClip,model:THREE.Object3D,state:string):THREE.AnimationClip{
 const tracks=[...source.tracks],duration=source.duration;
 model.traverse(object=>{
  const mesh=object as THREE.Mesh,dict=mesh.morphTargetDictionary;if(!dict||!mesh.morphTargetInfluences)return;
  for(const name of['Blink','Angry']){
   const index=dict[name];if(index===undefined)continue;
   const times=Array.from({length:Math.ceil(duration*60)+1},(_,i)=>duration*i/Math.ceil(duration*60));
   const values=times.map(time=>{
    if(name==='Blink'){if(state!=='idle')return 0;const u=Math.abs(time-duration*.78)/.115;return u<1?.92*Math.pow(Math.cos(u*Math.PI/2),2):0;}
    return state==='attack'?.20*Math.sin(Math.PI*time/duration)**2:state==='run'?.07:state==='walk'?.025:0;
   });
   tracks.push(new THREE.NumberKeyframeTrack(`${mesh.name}.morphTargetInfluences[${index}]`,times,values));
  }
 });
 return new THREE.AnimationClip(source.name,source.duration,tracks);
}
