import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { Player } from '../src/player/player';
import { PARALLAX } from '../src/story/parallaxSurvey';

test('parallax garden is reachable and both views remain unobstructed in the actual world', { timeout: 90000 }, async t => {
  const app = await bootWorldWithoutGpu({ deterministic: true, effectsQuality: 'med' });
  try {
    const { world } = app, garden = world.parallaxGarden;
    const player = new Player(world.colliders, world.layout.world.waterLevel);
    const ground = (x: number, z: number) => world.ground(x, z);
    const idle = { x: 0, z: 0, jump: false, sprint: false };
    const walk = (route: [number, number][]) => {
      for (const [x, z] of route) {
        let frames = 0;
        while (Math.hypot(player.pos.x - x, player.pos.z - z) > .3 && frames++ < 120 * 20) {
          player.yaw = Math.atan2(-(x - player.pos.x), -(z - player.pos.z));
          player.step(1 / 120, { ...idle, z: 1 });
        }
        assert.ok(Math.hypot(player.pos.x - x, player.pos.z - z) <= .3, `walk stalled at ${player.pos.toArray()} on the way to ${x},${z}`);
      }
      for (let i = 0; i < 60; i++) player.step(1 / 120, idle);
      assert.ok(player.onGround && !player.swimming, 'viewpoint stands on dry ground');
    };
    const assertReachable = (id: string) => {
      const marker = garden.markers.find((m: { id: string }) => m.id === id);
      assert.ok(player.pos.distanceTo(new THREE.Vector3(...marker.p)) < marker.radius, `${id} is within interaction range`);
      const eye = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), delta = new THREE.Vector3(...marker.p).sub(eye);
      assert.equal(world.combat.geometry.cast(eye, delta, Math.max(0, delta.length() - .08)), null, `${id} passes the production panel reachability ray`);
    };
    await t.test('walk from the south approach to the record, front, side and back without jumping', () => {
      player.teleport(-118, ground(-118, 296) + .1, 296);
      for (let i = 0; i < 60; i++) player.step(1 / 120, idle);
      walk([[-124, 286], [-118, 286], [garden.front[0], garden.front[2]]]);
      assert.ok(Math.abs(player.pos.y - garden.front[1]) < .7, 'front footprint height matches collision ground');
      assertReachable(PARALLAX.front);
      walk([[garden.side[0], garden.side[2]]]);
      assert.ok(Math.abs(player.pos.y - garden.side[1]) < .7, 'side footprint height matches collision ground');
      assertReachable(PARALLAX.side);
      walk([[-104, 286], [-124, 286]]);
      assertReachable(PARALLAX.board);
    });
    await t.test('instrument paving and ground markings remain clear of the medium quality grass field', () => {
      const grass = world.scene.getObjectByName('GrassField') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
      assert.ok(grass, 'medium quality uses the production grass mask');
      const texture = grass.material.uniforms.tC.value as THREE.DataTexture;
      const { grid } = world;
      for (const station of [garden.front, garden.side, [-118, 0, 264], [-118, 0, 272], [-118, 0, 278]]) {
        for (let x = station[0] - 2; x <= station[0] + 2; x += 2) for (let z = station[2] - 2; z <= station[2] + 2; z += 2) {
          const ix = Math.round((x - grid.x0) / grid.cell), iz = Math.round((z - grid.z0) / grid.cell);
          assert.equal(texture.image.data[(iz * grid.nx + ix) * 4 + 3], 0, `grass covers footprint near ${x},${z}`);
        }
      }
    });
    await t.test('both stations have clear physical and rendered sight lines to both rings', () => {
      world.scene.updateMatrixWorld(true);
      const meshes: THREE.Mesh[] = [];
      world.scene.traverse((object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry || mesh.name === 'Sky') return;
        for (let ancestor: THREE.Object3D | null = mesh; ancestor; ancestor = ancestor.parent) {
          if (!ancestor.visible || ancestor === garden.root) return;
        }
        if (mesh.name.endsWith('__outline')) return;
        meshes.push(mesh);
      });
      const raycaster = new THREE.Raycaster(), sphere = new THREE.Sphere();
      for (const station of [garden.front, garden.side]) {
        const center = new THREE.Vector3(...garden.subject);
        const look = center.clone().sub(new THREE.Vector3(station[0], station[1] + 1.55, station[2])).normalize();
        const right = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0)).normalize();
        const eye = new THREE.Vector3(station[0], station[1] + 1.55, station[2]).addScaledVector(right, .45).addScaledVector(look, -3.6);
        const delta = center.clone().sub(eye);
        assert.equal(world.combat.geometry.cast(eye, delta, delta.length() - .2), null, `physical sight blocked at ${station}`);
        for (const [z, radius] of [[272, 1.05], [264, 1.6]]) {
          for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4, target = new THREE.Vector3(-118 + Math.cos(angle) * radius, garden.subject[1] + Math.sin(angle) * radius, z);
            const direction = target.clone().sub(eye), distance = direction.length();
            raycaster.set(eye, direction.normalize()); raycaster.far = distance - .15;
            for (const mesh of meshes) {
              if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
              sphere.copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld);
              if (!raycaster.ray.intersectsSphere(sphere)) continue;
              const hit = raycaster.intersectObject(mesh, false)[0];
              assert.equal(hit, undefined, `ring silhouette blocked by ${mesh.name} from ${station}, ring z=${z}, sample ${i} at ${hit?.point.toArray()}`);
            }
          }
        }
      }
    });
  } finally { await app.close(); }
});
