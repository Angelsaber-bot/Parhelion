import * as THREE from 'three';

/** Visible local apron; preserves the map, bridge, rails and global Player physics. */
export function createTraversalRepairs() {
  const root = new THREE.Group(); root.name = 'AuthoredTraversalAprons';
  // Production GLB bridge starts at x=-47.5 and its decoded top is y=4.6019.
  // Reach the top BEFORE the capsule touches that edge (radius .35), then
  // overlap existing planks. A slope ending inside the bridge still catches feet.
  const west = -48.05, shoulder = -47.05, east = -44.75;
  const z0 = 762.78, z1 = 767.22, high = 4.63, low = 3.99, base = 3.92;
  const positions: number[] = [], colors: number[] = [];
  const wood = new THREE.Color('#927451'), edge = new THREE.Color('#765b3e');
  const tri = (a: number[], b: number[], c: number[], color: THREE.Color) => {
    positions.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], color: THREE.Color) => {
    tri(a,b,c,color); tri(a,c,d,color);
  };
  // Eight subtle timber courses in one material/mesh, not a featureless slab.
  for (let i = 0; i < 8; i++) {
    const a = z0 + (z1-z0)*i/8, b = z0 + (z1-z0)*(i+1)/8;
    const shade = wood.clone().multiplyScalar(i%2 ? .96 : 1.03);
    quad([west,high,a],[west,high,b],[shoulder,high,b],[shoulder,high,a],shade);
    quad([shoulder,high,a],[shoulder,high,b],[east,low,b],[east,low,a],shade);
  }
  for (const z of [z0,z1]) {
    quad([west,base,z],[west,high,z],[shoulder,high,z],[shoulder,base,z],edge);
    quad([shoulder,base,z],[shoulder,high,z],[east,low,z],[east,base,z],edge);
  }
  quad([west,base,z0],[west,high,z0],[west,high,z1],[west,base,z1],edge);
  quad([east,base,z0],[east,low,z0],[east,low,z1],[east,base,z1],edge);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.9,side:THREE.DoubleSide});
  const mesh = new THREE.Mesh(geometry,material); mesh.name = 'HonnojiBridgeApproach';
  mesh.castShadow = false; mesh.receiveShadow = true; root.add(mesh);
  const collision = geometry.clone();
  let disposed = false;
  return { root, collisionGeometries:[collision], dispose() {
    if(disposed)return;disposed=true;root.removeFromParent();geometry.dispose();material.dispose();collision.dispose();
  }};
}
