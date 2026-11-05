import * as THREE from 'three';

/** Reuse the authored resident instead of keeping a separate faceless escort model.
 * Only this walking cast splits its lower-body batch into two rigid hip joints. */
export function residentWalkRig(person:THREE.Object3D){
 const legs=person.getObjectByName('ResidentBootsAndLegs') as THREE.Mesh;
 if(!legs?.isMesh)throw new Error(`Resident has no walking legs: ${person.name}`);
 const geometry=legs.geometry.index?legs.geometry.toNonIndexed():legs.geometry.clone();
 const position=geometry.getAttribute('position'),joints:THREE.Group[]=[];
 for(const sign of[-1,1]){
  const arrays=Object.fromEntries(Object.keys(geometry.attributes).map(k=>[k,[] as number[]]));
  for(let i=0;i<position.count;i+=3){
   const center=(position.getX(i)+position.getX(i+1)+position.getX(i+2))/3;
   if((center<0?-1:1)!==sign)continue;
   for(const [name,attribute]of Object.entries(geometry.attributes))for(let v=i;v<i+3;v++)for(let c=0;c<attribute.itemSize;c++)arrays[name].push(attribute.array[v*attribute.itemSize+c]);
  }
  const g=new THREE.BufferGeometry();for(const[name,values]of Object.entries(arrays))g.setAttribute(name,new THREE.Float32BufferAttribute(values,geometry.getAttribute(name).itemSize));
  g.translate(-sign*.11,-.79,0);
  const mesh=new THREE.Mesh(g,legs.material);mesh.name=`ResidentWalkingLeg_${sign}`;mesh.castShadow=true;mesh.receiveShadow=true;
  const joint=new THREE.Group();joint.name=`ResidentHip_${sign}`;joint.position.set(sign*.11,.79,0);joint.add(mesh);person.add(joint);joints.push(joint);
 }
 legs.removeFromParent();legs.geometry.dispose();geometry.dispose();
 const torso=person.getObjectByName('ResidentTorso')!,left=person.getObjectByName('ResidentArmLeft')!,right=person.getObjectByName('ResidentArmRight')!;
 const baseY=person.position.y;
 return{update(phase:number,moving:boolean,groundOffset=0){
  const gait=moving?Math.sin(phase):0;
  person.position.y=baseY+groundOffset-.79*(1-Math.cos(gait*.30));
  joints[0].rotation.x=gait*.30;joints[1].rotation.x=-gait*.30;
  left.rotation.x=-.08-gait*.23;right.rotation.x=-.05+gait*.23;
  torso.position.y=1.04+(moving?Math.abs(Math.sin(phase))*.016:0);
  torso.rotation.z=moving?Math.sin(phase)*.012:0;
 }};
}
