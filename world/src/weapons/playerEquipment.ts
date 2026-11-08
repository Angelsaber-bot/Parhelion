import * as THREE from 'three';

export interface GliderEquipment {
  root: THREE.Group;
  grips: { R: THREE.Object3D; L: THREE.Object3D };
  wings: [THREE.Group, THREE.Group];
  meshes: THREE.Mesh[];
  deploy(amount: number, bank: number): void;
}

/** Physical grips and braces are part of the visible frame, not invisible IK targets. */
export function makePlayerGlider(): GliderEquipment {
  const root = new THREE.Group(); root.name = 'Glider'; root.userData.dynamic = true;
  const cloth = new THREE.MeshStandardMaterial({ color: '#e9f0e7', roughness: .9, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: '#4197a5', roughness: .7 });
  const frame = new THREE.MeshStandardMaterial({ color: '#495662', metalness: .45, roughness: .55 });
  const gripMaterial = new THREE.MeshStandardMaterial({ color: '#252c33', roughness: .95 });
  const meshes: THREE.Mesh[] = [];
  function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name: string) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = true; parent.add(mesh); meshes.push(mesh); return mesh;
  }
  function strut(a: THREE.Vector3, b: THREE.Vector3, radius: number, material = frame, parent: THREE.Object3D = root, name = 'GliderBrace') {
    const mesh = part(parent, new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8), material, name);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
  }
  const grips = {} as GliderEquipment['grips'];
  const wings: THREE.Group[] = [];
  for (const [side, sign] of [['R', -1], ['L', 1]] as const) {
    const grip = new THREE.Group(); grip.name = `GliderGrip_${side}`; grip.position.set(sign * .30, -.025, .31); root.add(grip); grips[side] = grip;
    strut(new THREE.Vector3(sign * .30 - .075, -.025, .31), new THREE.Vector3(sign * .30 + .075, -.025, .31), .016, gripMaterial, root, `GliderHandle_${side}`);
    strut(new THREE.Vector3(sign * .30, -.025, .31), new THREE.Vector3(sign * .43, .23, -.06), .009);
    strut(new THREE.Vector3(0, .10, -.13), new THREE.Vector3(sign * .43, .23, -.06), .011);
    const wing = new THREE.Group(); wing.name = `GliderWing_${side}`; wing.position.set(sign * .12, .23, -.08); root.add(wing); wings.push(wing);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0,0,.36, sign*.62,.045,.30, sign*1.20,-.045,-.13, sign*.94,-.08,-.42, 0,-.035,-.30,
    ],3));
    geometry.setIndex([0,1,4,1,2,3,1,3,4]); geometry.computeVertexNormals();
    part(wing, geometry, cloth, `GliderFabric_${side}`);
    strut(new THREE.Vector3(0,0,.36), new THREE.Vector3(sign*1.2,-.045,-.13), .008, trim, wing, `GliderLeadingEdge_${side}`);
    strut(new THREE.Vector3(0,-.035,-.30), new THREE.Vector3(sign*1.2,-.045,-.13), .006, frame, wing);
  }
  return { root, grips, wings: wings as [THREE.Group, THREE.Group], meshes,
    deploy(amount, bank) {
      root.visible = amount > .015;
      root.rotation.z = bank;
      // Do not scale the frame: its measured hand contacts stay at the physical handles.
      wings[0].rotation.z = -(1 - amount) * 1.35;
      wings[1].rotation.z = (1 - amount) * 1.35;
      // Keep deployed handles steady through the initial release/landing rather than yanking
      // both hands downward while the wings have only just begun folding.
      root.position.set(0, 1.69 - .30 * (1 - amount) ** 3, -.18);
    },
  };
}
