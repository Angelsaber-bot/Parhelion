import * as THREE from 'three';

/**
 * A one-shot heavy splash: an expanding wave ring, a fading foam disc and a burst of spray, for a
 * hull dropping into the sea (Black Sail B06: the flagship falls into the water and the wave slaps
 * the pier). Visual only; reusable pool of one effect.
 */
export const SPLASH = Object.freeze({ life: 3.2, ring: 26, spray: 40 });

export function createSplashWave() {
  const root = new THREE.Group(); root.name = 'SplashWave'; root.visible = false;
  const ringGeo = new THREE.RingGeometry(.86, 1, 48), discGeo = new THREE.CircleGeometry(1, 40), dropGeo = new THREE.SphereGeometry(.22, 6, 4);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#eaf8fb', transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const discMat = new THREE.MeshBasicMaterial({ color: '#cfeef2', transparent: true, depthWrite: false });
  const dropMat = new THREE.MeshBasicMaterial({ color: '#f4fcfd', transparent: true, depthWrite: false });
  const ring = new THREE.Mesh(ringGeo, ringMat), disc = new THREE.Mesh(discGeo, discMat); ring.rotation.x = disc.rotation.x = -Math.PI / 2; root.add(ring, disc);
  const drops = new THREE.InstancedMesh(dropGeo, dropMat, SPLASH.spray); drops.frustumCulled = false; root.add(drops);
  const vel = Array.from({ length: SPLASH.spray }, () => new THREE.Vector3()), pos = Array.from({ length: SPLASH.spray }, () => new THREE.Vector3());
  const dummy = new THREE.Object3D();
  let age = Infinity, radius = 8;
  return {
    root,
    get active() { return age < SPLASH.life; },
    /** Start a splash centred at `at` (on the water surface) for a hull of about `size` metres. */
    trigger(at: THREE.Vector3, size = 8) {
      root.position.copy(at); root.visible = true; age = 0; radius = size;
      for (let i = 0; i < SPLASH.spray; i++) {
        const a = Math.random() * Math.PI * 2, r = size * (.4 + Math.random() * .5), up = 6 + Math.random() * 7;
        pos[i].set(Math.cos(a) * r, 0, Math.sin(a) * r); vel[i].set(Math.cos(a) * (2 + Math.random() * 3), up, Math.sin(a) * (2 + Math.random() * 3));
      }
    },
    update(dt: number) {
      if (age >= SPLASH.life) { root.visible = false; return; }
      age += dt; const k = Math.min(1, age / SPLASH.life);
      // The wave ring runs out to the pier; the foam disc spreads and thins; spray rises and falls.
      const r = radius + (SPLASH.ring - radius) * Math.sqrt(k); ring.scale.set(r, r, 1); ringMat.opacity = (1 - k) * .9; ring.position.y = .15 + Math.sin(k * Math.PI) * .6;
      const d = radius * (1 + k * 1.4); disc.scale.set(d, d, 1); discMat.opacity = (1 - k) * .55; disc.position.y = .05;
      for (let i = 0; i < SPLASH.spray; i++) {
        vel[i].y -= 14 * dt; pos[i].addScaledVector(vel[i], dt); if (pos[i].y < 0) { pos[i].y = 0; vel[i].set(0, 0, 0); }
        dummy.position.copy(pos[i]); dummy.scale.setScalar(1.4 - k); dummy.updateMatrix(); drops.setMatrixAt(i, dummy.matrix);
      }
      drops.instanceMatrix.needsUpdate = true; dropMat.opacity = 1 - k * k;
      if (age >= SPLASH.life) root.visible = false;
    },
    dispose() { root.removeFromParent(); ringGeo.dispose(); discGeo.dispose(); dropGeo.dispose(); ringMat.dispose(); discMat.dispose(); dropMat.dispose(); drops.dispose(); },
  };
}
