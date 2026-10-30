import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
/** Original articulated survey-guardian: horizontal four-legged silhouette, never the old humanoid blob.
 * Geometry is intentionally compact so all valley creatures stay readable without skinned-asset downloads. */
export function makeValleySentinel(geometries: THREE.BufferGeometry[], materials: THREE.Material[], elite = false) {
  const root = new THREE.Group(); root.name = 'Valley_Articulated_Prism_Hound';
  const shell = new THREE.MeshStandardMaterial({ color: elite ? '#eee3c2' : '#d9e4e1', roughness: .48, metalness: .45 });
  const joint = new THREE.MeshStandardMaterial({ color: '#263f48', roughness: .6, metalness: .65 });
  const trim = new THREE.MeshStandardMaterial({ color: '#b89d60', roughness: .42, metalness: .7 });
  const light = new THREE.MeshStandardMaterial({ color: '#72e8d2', emissive: '#299c8c', emissiveIntensity: .7, roughness: .25, metalness: .2 });
  materials.push(shell, joint, trim, light);
  const box = new RoundedBoxGeometry(1,1,1,2,.07), cylinder = new THREE.CylinderGeometry(1,1,1,8), crystal = new THREE.OctahedronGeometry(1);
  const headGeo=box.clone(),muzzleGeo=box.clone(),plateGeo=box.clone();
  for(const [geo,taper] of [[headGeo,.27],[muzzleGeo,.48],[plateGeo,.16]] as const) {
    const a=geo.getAttribute('position');for(let i=0;i<a.count;i++) {
      const z=a.getZ(i),y=a.getY(i);a.setXYZ(i,a.getX(i)*(1-taper*(z+.5)),y+(geo===headGeo?.12*(z+.5):0),z);
    }a.needsUpdate=true;geo.computeVertexNormals();
  }
  geometries.push(box,cylinder,crystal,headGeo,muzzleGeo,plateGeo);
  const parts: THREE.Mesh[] = [];
  const part = (parent: THREE.Object3D, name: string, geo: THREE.BufferGeometry, mat: THREE.Material, p: number[], scale: number[]) => {
    const m = new THREE.Mesh(geo,mat); m.name=name; m.position.set(p[0],p[1],p[2]); m.scale.set(scale[0],scale[1],scale[2]); m.castShadow=true; m.receiveShadow=true;parent.add(m);parts.push(m);return m;
  };
  part(root,'Horizontal_Spine',box,joint,[0,.99,-.12],[.4,.3,1.2]);
  for(let i=0;i<3;i++) {
    const plate=part(root,`Layered_Carapace_${i}`,plateGeo,shell,[0,1.14,-.48+i*.35],[.68,.22,.38]);plate.rotation.x=-.10;
    part(root,`Spine_Light_${i}`,crystal,light,[0,1.32,-.48+i*.35],[.095,.19,.12]);
  }
  const head = new THREE.Group();head.name='Articulated_Head';head.position.set(0,1.13,.62);root.add(head);
  part(head,'Armored_Head',headGeo,shell,[0,.09,.06],[.53,.34,.55]);
  const muzzle=part(head,'Tapered_Muzzle',muzzleGeo,joint,[0,-.04,.43],[.35,.19,.39]);muzzle.rotation.x=.12;
  part(head,'Recessed_Visor_Frame',box,joint,[0,.12,.34],[.43,.115,.05]);
  part(head,'Sensor_Visor',box,light,[0,.12,.369],[.35,.04,.018]);
  part(head,'Lower_Jaw',muzzleGeo,shell,[0,-.14,.38],[.35,.07,.34]);
  for(const side of [-1,1]) {
    const ear=part(head,'Swept_Antenna_'+side,crystal,trim,[side*.2,.36,-.03],[.07,.22,.10]);ear.rotation.z=-side*.16;
    const shoulder=part(root,'Layered_Shoulder_'+side,plateGeo,shell,[side*.37,1.04,.38],[.20,.35,.43]);shoulder.rotation.z=side*.22;shoulder.rotation.x=.15;
    part(root,'Shoulder_Trim_'+side,box,trim,[side*.47,1.08,.36],[.035,.18,.25]);
  }
  const legs: THREE.Group[]=[];
  for(const z of [-.52,.42])for(const side of [-1,1]) {
    const leg=new THREE.Group();leg.name=`Leg_${z}_${side}`;leg.position.set(side*.36,.9,z);root.add(leg);legs.push(leg);
    const axle=part(leg,'Hip_Axle',cylinder,trim,[0,0,0],[.13,.15,.13]);axle.rotation.z=Math.PI/2;
    const upper=part(leg,'Upper_Armor',box,shell,[0,-.2,.025],[.17,.35,.22]);upper.rotation.x=.12;
    part(leg,'Knee_Light',box,light,[0,-.39,.14],[.12,.08,.035]);
    const shin=part(leg,'Lower_Strut',box,joint,[0,-.56,.04],[.12,.33,.13]);shin.rotation.x=-.12;
    const ankle=part(leg,'Ankle_Axle',cylinder,trim,[0,-.69,.07],[.09,.14,.09]);ankle.rotation.z=Math.PI/2;
    part(leg,'Compact_Paw',muzzleGeo,shell,[0,-.80,.12],[.22,.15,.24]);
    for(const claw of [-1,1]) {
      part(leg,'Split_Claw_'+claw,muzzleGeo,shell,[claw*.065,-.82,.27],[.105,.10,.18]);
      part(leg,'Claw_Tip_'+claw,box,trim,[claw*.065,-.83,.355],[.07,.04,.035]);
    }
  }
  const tail=part(root,'Counterweight_Tail',box,trim,[0,1.06,-.94],[.12,.12,.45]);tail.rotation.x=-.4;
  // Instance all compatible pieces: articulated original nodes act only as transform handles.
  // Four-legged detail therefore costs a handful of draws, not one draw per armor plate.
  const batches = new Map<string, { source: THREE.Mesh[]; mesh: THREE.InstancedMesh }>();
  const groups = new Map<string, THREE.Mesh[]>();
  for(const p of parts) { const key=p.geometry.uuid+':'+(p.material as THREE.Material).uuid; const list=groups.get(key)??[];list.push(p);groups.set(key,list);p.visible=false; }
  for(const [key,source] of groups) {
    const mesh=new THREE.InstancedMesh(source[0].geometry,source[0].material,source.length);
    mesh.name='Guardian_Plate_Batch';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    root.add(mesh);batches.set(key,{source,mesh});
  }
  const inverse=new THREE.Matrix4(),matrix=new THREE.Matrix4();
  const sync = () => { root.updateWorldMatrix(true,true);inverse.copy(root.matrixWorld).invert();for(const {source,mesh} of batches.values()) { source.forEach((p,i)=>mesh.setMatrixAt(i,matrix.multiplyMatrices(inverse,p.matrixWorld)));mesh.instanceMatrix.needsUpdate=true; } };
  sync();
  return { root, update(time: number, moving: boolean, attacking: boolean) {
    for(const [i,leg] of legs.entries()) leg.rotation.x=moving ? Math.sin(time*8+(i===0||i===3?0:Math.PI))*.25 : 0;
    head.rotation.x=attacking ? -.15 : Math.sin(time*1.5)*.025;
    tail.rotation.y=Math.sin(time*2)*.12;
    sync();
  }};
}
