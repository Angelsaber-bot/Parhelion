import * as THREE from 'three';
import { figureGeometry } from './orleansCrossingTeams';
import { makeStoneArmour } from '../combat/egyptCreatures';

/**
 * A Black Sail chaser (B06–B07) for a field-chapter prop of size [beam, height, length]: a tapered
 * hull with gunwales and gunports, a deck, an after mainmast with yard, sail and black flag, and a
 * small crew. The foremast stays a separate prop so the chapter can still fell it. `animate(t)`
 * rocks the ship on the swell. Visual only.
 */
export function makeChaserShip(size: readonly number[], geometries: Set<THREE.BufferGeometry>, materials: THREE.Material[]) {
  const [beam, height, length] = size;
  const ship = new THREE.Group(); ship.name = 'BlackSailChaser';
  const swell = new THREE.Group(); ship.add(swell);
  const mat = (o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial(o); materials.push(m); return m; };
  const hullMat = mat({ color: '#3a2f27', roughness: .85, flatShading: true }), deckMat = mat({ color: '#7a5f42', roughness: .9 });
  const trim = mat({ color: '#8a6a3a', roughness: .7 }), dark = mat({ color: '#141210', roughness: 1 }), sailMat = mat({ color: '#bfb39a', roughness: .95, side: THREE.DoubleSide });
  const flagMat = mat({ color: '#111111', roughness: 1, side: THREE.DoubleSide }), crewMat = mat({ vertexColors: true, roughness: .85, flatShading: true });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, p: readonly number[], r: readonly number[] = [0, 0, 0]) => {
    geometries.add(g); const o = new THREE.Mesh(g, m); o.position.set(p[0], p[1], p[2]); o.rotation.set(r[0], r[1], r[2]); o.castShadow = true; o.receiveShadow = true; swell.add(o); return o;
  };
  // Hull: a segmented box narrowed toward the bow and the keel.
  const hull = new THREE.BoxGeometry(beam, height, length, 1, 2, 8), pos = hull.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i) / (length / 2), y = pos.getY(i) / (height / 2);
    const bow = z > .35 ? 1 - (z - .35) / .65 * .92 : 1, keel = y < 0 ? .55 + .45 * (1 + y) : 1;
    pos.setX(i, pos.getX(i) * bow * keel); if (z > .7 && y > 0) pos.setY(i, pos.getY(i) + (z - .7) * .9);
  }
  hull.computeVertexNormals(); add(hull, hullMat, [0, 0, 0]);
  add(new THREE.BoxGeometry(beam * .86, .08, length * .78), deckMat, [0, height / 2 - .12, -length * .05]);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(.1, .32, length * .72), trim, [s * beam * .47, height / 2 + .1, -length * .06]);
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(.04, .26, .36), dark, [s * beam * .505, .05, -length * .3 + k * length * .2]);
  }
  // Mainmast aft with a yard, a bellied sail and a black flag.
  const mx = 0, mz = -length * .2, mh = height / 2 + 6.5;
  add(new THREE.CylinderGeometry(.12, .16, 7, 8), trim, [mx, height / 2 + 3.4, mz]);
  add(new THREE.CylinderGeometry(.06, .06, beam * 1.5, 6), trim, [mx, mh - 1.2, mz + .1], [0, 0, Math.PI / 2]);
  const sail = new THREE.PlaneGeometry(beam * 1.4, 3.6, 4, 4), sp = sail.getAttribute('position');
  for (let i = 0; i < sp.count; i++) { const u = sp.getX(i) / (beam * .7), v = sp.getY(i) / 1.8; sp.setZ(i, (1 - u * u) * (1 - v * v * .6) * .5); }
  sail.computeVertexNormals(); add(sail, sailMat, [mx, mh - 3.05, mz + .25]);
  const flag = add(new THREE.PlaneGeometry(1, .62), flagMat, [mx + .55, mh + .1, mz]); flag.name = 'ChaserFlag';
  // A small crew on deck.
  const crewGeo = figureGeometry('#4a3f36', false); geometries.add(crewGeo);
  for (const [x, z, yaw] of [[-.6, length * .22, 0], [.7, length * .05, Math.PI * .8], [0, -length * .32, Math.PI]] as const) {
    const c = new THREE.Mesh(crewGeo, crewMat); c.position.set(x, height / 2 - .08, z); c.rotation.y = yaw; c.scale.setScalar(.9); c.castShadow = true; swell.add(c);
  }
  ship.userData.animate = (t: number) => {
    swell.rotation.z = Math.sin(t * .9) * .045; swell.rotation.x = Math.sin(t * .6 + 1) * .02; swell.position.y = Math.sin(t * 1.1) * .12;
    flag.rotation.y = Math.sin(t * 3.1) * .25;
  };
  return ship;
}

/** A cloth that waves: a subdivided plane whose free edge ripples. Hoisted at its left edge. */
function wavingCloth(width: number, height: number, color: string, geometries: Set<THREE.BufferGeometry>, materials: THREE.Material[]) {
  const g = new THREE.PlaneGeometry(width, height, 8, 3); g.translate(width / 2, 0, 0); geometries.add(g);
  const base = Float32Array.from(g.getAttribute('position').array as Float32Array);
  const m = new THREE.MeshStandardMaterial({ color, roughness: .95, side: THREE.DoubleSide }); materials.push(m);
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = true;
  const wave = (t: number, strength = 1) => {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = base[i * 3], k = x / width; p.setZ(i, Math.sin(t * 5 - x * 3.2) * .14 * k * strength); p.setY(i, base[i * 3 + 1] - k * k * .08); }
    p.needsUpdate = true; g.computeVertexNormals();
  };
  return { mesh, wave };
}

/** O02 Alix's relay pennant: the cloth is raised and dropped in a steady signal rhythm on its pole. */
export function makeRelayPennant(size: readonly number[], geometries: Set<THREE.BufferGeometry>, materials: THREE.Material[]) {
  const group = new THREE.Group(); group.name = 'RelayPennant';
  const cloth = wavingCloth(size[0], size[1], '#e9e0c8', geometries, materials); cloth.mesh.position.x = -size[0] / 2; group.add(cloth.mesh);
  group.userData.animate = (t: number) => {
    // Up for a beat, down for a beat: the same covering order, passed on and on.
    const phase = (t % 1.6) / 1.6, lift = phase < .5 ? Math.sin(phase / .5 * Math.PI / 2) : Math.cos((phase - .5) / .5 * Math.PI / 2);
    cloth.mesh.position.y = (lift - .5) * .7; cloth.wave(t, .6 + lift * .6);
  };
  return group;
}

/** O07 the forward standard Alix carries: a large cloth waving from its pole. */
export function makeWavingStandard(size: readonly number[], geometries: Set<THREE.BufferGeometry>, materials: THREE.Material[]) {
  const group = new THREE.Group(); group.name = 'ForwardStandard';
  const cloth = wavingCloth(size[0], size[1], '#eae3cf', geometries, materials); cloth.mesh.position.x = -size[0] / 2; group.add(cloth.mesh);
  const emblemGeo = new THREE.CircleGeometry(size[1] * .22, 12); geometries.add(emblemGeo);
  const emblemMat = new THREE.MeshStandardMaterial({ color: '#2f4d8c', side: THREE.DoubleSide }); materials.push(emblemMat);
  const emblem = new THREE.Mesh(emblemGeo, emblemMat); emblem.position.set(size[0] * .1, 0, .02); group.add(emblem);
  group.userData.animate = (t: number) => { cloth.wave(t, 1.2); emblem.position.z = Math.sin(t * 5 - size[0] * .4 * 3.2) * .14 * .6 + .02; };
  return group;
}

/** E07 a river shell lunging at the boat: a stone-armour creature rearing to strike, with an invisible
 * box of the prop's size as the actual shot target (returned separately so the chapter can use it). */
export function makeLungingShell(size: readonly number[], geometries: Set<THREE.BufferGeometry>, materials: THREE.Material[]) {
  const group = new THREE.Group(); group.name = 'LungingShell';
  const geos: THREE.BufferGeometry[] = [];
  const creature = makeStoneArmour(geos, materials); geos.forEach(g => geometries.add(g));
  const scale = Math.max(size[0], size[2]) / 1.1; creature.root.scale.multiplyScalar(scale * .8); creature.root.position.y = -size[1] / 2; group.add(creature.root);
  const hitGeo = new THREE.BoxGeometry(size[0] * 1.2, size[1] * 1.4, size[2] * 1.6); geometries.add(hitGeo);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false }); materials.push(hitMat);
  const hit = new THREE.Mesh(hitGeo, hitMat); hit.name = 'LungingShellHitBox'; group.add(hit);
  group.userData.animate = (t: number) => { const lunge = Math.sin(t * 1.7) > .2; creature.update(t, false, lunge, lunge ? 'windup' : 'chase'); };
  return { group, hit };
}
