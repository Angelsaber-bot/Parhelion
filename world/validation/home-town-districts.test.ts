import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { makeCombatTerrain } from '../src/combat/combatTerrain';

test('Homeward Town districts are solid and reachable; the Sky Crown carries its dark sun and open ring', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true });
  try {
    const w = h.world; let time = 0;
    const frame = (n = 1) => { for (let i = 0; i < n; i++) h.frame(time += 1000 / 60); };
    (h.window.document.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frame(3);
    const g = w.combat.geometry, X = (x: number) => x + 720;
    for (const name of ['HomeWorkshopRange', 'HomeBroadcastArchive', 'HomeLeveeCargo', 'HomeRooftopWalk', 'HomeOutstation', 'HomeSouthSlope'])
      assert.equal(w.colliders.find((k: { name: string }) => k.name === `COL_${name}`)?.enabled, true, name);
    const settle = () => { for (let i = 0; i < 120; i++) w.player.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false }); };
    const move = (yaw: number, seconds: number, jump = false) => {
      w.player.yaw = yaw;
      for (let i = 0; i < seconds * 120; i++) w.player.step(1 / 120, { x: 0, z: 1, jump: jump && i % 60 === 30, sprint: true });
      return w.player.pos.clone();
    };
    const place = (x: number, z: number) => { w.player.teleport(x, g.ground(x, z, 60)!.point.y + .2, z); settle(); };
    const east = -Math.PI / 2, west = Math.PI / 2; // forward = (−sin yaw, −cos yaw)
    // T07: the stair carries the player up onto the laundry deck without jumping.
    const base = w.grid.sampleHeight(X(-102), 176);
    place(X(-108), 176);
    const up = move(east, 1.6);
    assert.ok(up.y > base + 2.9 && up.x > X(-100), `on the rooftop deck at ${up.x.toFixed(1)}, ${up.y.toFixed(2)} (base ${base.toFixed(2)})`);
    // The two gaps between decks are clearable with ordinary jumps.
    place(X(-91), 176); const far = move(east, 2.4, true);
    assert.ok(far.x > X(-80) && far.y > base + 2.9, `across both gaps to the stargazing deck at ${far.x.toFixed(1)}, ${far.y.toFixed(2)}`);
    // T04: the broadcast room's east door opens into the room; its north wall does not.
    place(X(-187), 15); assert.ok(move(west, 2).x < X(-196), 'through the broadcast room door');
    place(X(-187), 12); assert.ok(move(west, 2).x > X(-189.5), 'the wall beside the door blocks');
    // The two new sheltered bays stand on the actual courtyard/terrain and remain open from the south.
    const publicRealm = w.homeTownDistricts.root, T = w.THREE;
    const baseTerrain = makeCombatTerrain(w.colliders.filter((collider: { name: string }) => !/^COL_Home(?:Square|SouthGarden)/.test(collider.name)), w.layout);
    const groundRay = new T.Raycaster();
    groundRay.layers.enableAll();
    publicRealm.updateMatrixWorld(true);
    for (const [name, x, z] of [['HomeSquareMarketShelter', -172.5, 43], ['HomeSouthGardenShelter', -90.5, 122]] as const) {
      const shelter = publicRealm.getObjectByName(name);
      const collider = w.colliders.find((c: { name: string }) => c.name === `COL_${name}`);
      assert.ok(shelter && collider?.enabled, name);
      assert.ok(shelter.children.some((child: { castShadow: boolean }) => child.castShadow));
      const cornerX = X(x - 3.06), cornerZ = z + 1.88;
      const floor = baseTerrain.ground(cornerX, cornerZ, 17)!.point.y;
      const plinth = collider.bvh.raycastFirst(new T.Ray(new T.Vector3(cornerX, floor - .16, cornerZ), new T.Vector3(0, 1, 0)), T.DoubleSide);
      assert.ok(plinth && Math.abs(plinth.point.y - floor + .08) < .025, `${name}: foot meets the courtyard`);
      const middle = X(x + 1.45);
      const roof = g.cast({ x: middle, y: floor + 1.65, z: z + .6 }, { x: 0, y: 1, z: 0 }, 3);
      assert.ok(roof && roof.point.y - floor > 2.9, `${name}: standing clearance below solid roof`);
      place(middle, z + 4.2);
      const entered = move(0, .62);
      assert.ok(entered.z < z + 1.4 && entered.z > z - .65 && Math.abs(entered.y - floor) < .3, `${name}: open public bay ${entered.toArray()}`);
    }
    // The arena of stone keeps the original court. The garden apron has its own
    // shallow walk surface where it blends into the raised street.
    for (const [name, x, z] of [['HomeSquareStoneApron', -149.52, 40.13], ['HomeSouthGardenPath', -90.7, 126.9]] as const) {
      const model = publicRealm.getObjectByName(name)!;
      groundRay.set(new T.Vector3(X(x), 18, z), new T.Vector3(0, -1, 0));
      const surface = groundRay.intersectObject(model, true)[0]?.point.y;
      const base = baseTerrain.ground(X(x), z, 18)!.point.y;
      assert.ok(surface && surface > base + .006 && surface < base + .15, `${name}: stone ${surface} on floor ${base}`);
      if (name === 'HomeSouthGardenPath') {
        assert.ok(Math.abs(g.ground(X(x), z, 18)!.point.y - surface) < .004);
      } else assert.ok(surface < base + .045);
    }
    for (const name of ['HomeSquareCisternStonework', 'HomeSquareTreePits', 'HomeSouthGardenFlowerBeds']) {
      assert.ok(publicRealm.getObjectByName(name));
      assert.ok(w.colliders.some((collider: { name: string; enabled: boolean }) => collider.name === `COL_${name}` && collider.enabled));
    }
    // Sky Crown: dark sun core and rim, and an incomplete observation ring above the decks.
    const sky = w.skyCrownLandmarks.root;
    const core = sky.getObjectByName('DarkSunCore'), ring = sky.getObjectByName('ObservationRing');
    assert.ok(core && sky.getObjectByName('DarkSunRim') && ring);
    assert.ok(ring.geometry.parameters.arc < Math.PI * 2 - .5, 'the ring has an obvious gap');
    assert.ok(ring.position.y - ring.geometry.parameters.radius * Math.sin(.18) - 4 > 212, 'the ring stays above every walking deck');
    const dark = core.material.color.getHex();
    w.done.add('journey_sky_handover'); frame(2); assert.notEqual(core.material.color.getHex(), dark, 'the sun warms after the handover');
    w.done.delete('journey_sky_handover'); frame(2); assert.equal(core.material.color.getHex(), dark);
  } finally { await h.close(); }
});
