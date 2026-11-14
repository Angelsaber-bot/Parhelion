import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CROW_SHADOWS, type CrowShadow } from './combat';

/**
 * J08 鸦印「影子先到」 presentation: a paper screen lit from behind by the fire with his shadow thrown on it —
 * horned helm, shoulder plates, a raised blade — swaying a beat out of step with the real man. A round
 * through it tears the screen into shreds that fall and burn out. Lives in world space (the effect group),
 * driven from the simulation's `crowShadow`; nothing here decides a hit.
 */
export const SHADOW_LOOK = Object.freeze({ tall: 3.1, screenW: 2.3, screenH: 3.5, shreds: 16, shredLife: 1.1 });

/** The shadow figure (metres, feet at y = 0, in the xy plane facing +z), built from simple flat pieces so it
 * triangulates cleanly: planted legs, flared kusazuri skirt, chest, sode shoulder plates, helm with kuwagata
 * horns, and the right arm raised with a long blade over the head. */
export function crowSilhouetteGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const poly = (pts: [number, number][]) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); pieces.push(new THREE.ShapeGeometry(sh)); };
  poly([[-.42, 0], [-.18, 0], [-.12, 1.2], [-.36, 1.2]]); poly([[.18, 0], [.42, 0], [.36, 1.2], [.12, 1.2]]);       // legs
  poly([[-.5, 1.05], [.5, 1.05], [.34, 1.5], [-.34, 1.5]]);                                                       // kusazuri
  poly([[-.34, 1.45], [.34, 1.45], [.46, 2.05], [-.46, 2.05]]);                                                   // chest
  poly([[-.46, 2.1], [-.82, 1.98], [-.74, 1.6], [-.42, 1.72]]); poly([[.46, 2.1], [.82, 1.98], [.74, 1.6], [.42, 1.72]]); // sode
  poly([[-.66, 1.66], [-.56, 1.66], [-.5, 1.05], [-.62, 1.05]]);                                                  // left arm hanging
  poly([[.6, 1.95], [.74, 2.02], [.98, 2.62], [.86, 2.68]]);                                                      // right arm raised
  const head = new THREE.CircleGeometry(.19, 10); head.translate(0, 2.28, 0); pieces.push(head);
  poly([[-.36, 2.2], [.36, 2.2], [.22, 2.36], [-.22, 2.36]]);                                                     // helm brim
  poly([[-.08, 2.4], [-.02, 2.42], [-.3, 2.95], [-.38, 2.92]]); poly([[.08, 2.4], [.02, 2.42], [.3, 2.95], [.38, 2.92]]); // horns
  poly([[.88, 2.58], [.96, 2.62], [1.42, 3.28], [1.38, 3.3]]);                                                    // blade
  const merged = mergeGeometries(pieces); pieces.forEach(x => x.dispose());
  return merged!;
}

export function createCrowShadowVisual(parent: THREE.Object3D) {
  const root = new THREE.Group(); root.name = 'CrowSealFalseShadow'; root.visible = false; parent.add(root);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => (geometries.push(x), x), m = <T extends THREE.Material>(x: T) => (materials.push(x), x);
  // Screen: a shoji panel of pale washi in a dark frame with a fine lattice, glowing from the fire behind it.
  const W = SHADOW_LOOK.screenW, H = SHADOW_LOOK.screenH;
  const screenMat = m(new THREE.MeshBasicMaterial({ color: '#f4cf94', transparent: true, opacity: .82, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  const screen = new THREE.Mesh(g(new THREE.PlaneGeometry(W, H).translate(0, H / 2, 0)), screenMat);
  const frameMat = m(new THREE.MeshStandardMaterial({ color: '#2a1a14', roughness: .8 }));
  const post = g(new THREE.BoxGeometry(.08, H + .1, .08)), rail = g(new THREE.BoxGeometry(W + .1, .08, .08));
  for (const x of [-1, 1]) { const p = new THREE.Mesh(post, frameMat); p.position.set(x * W / 2, (H + .1) / 2, 0); root.add(p); }
  for (const y of [.04, H + .04]) { const r = new THREE.Mesh(rail, frameMat); r.position.set(0, y, 0); root.add(r); }
  const latticeMat = m(new THREE.MeshBasicMaterial({ color: '#5a3a26', transparent: true, opacity: .55, depthWrite: false }));
  const bars: THREE.BufferGeometry[] = [];
  for (let i = 1; i < 3; i++) bars.push(new THREE.PlaneGeometry(.022, H).translate(-W / 2 + W * i / 3, H / 2, -.01));
  for (let j = 1; j < 6; j++) bars.push(new THREE.PlaneGeometry(W, .022).translate(0, H * j / 6, -.01));
  const lattice = new THREE.Mesh(g(mergeGeometries(bars)!), latticeMat); bars.forEach(b => b.dispose()); lattice.raycast = () => {};
  // Shadow on the paper, with a thin ember rim where the flame bleeds round its edge.
  const shadowGeo = g(crowSilhouetteGeometry());
  const rimMat = m(new THREE.MeshBasicMaterial({ color: '#ff8a3a', transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  const shadowMat = m(new THREE.MeshBasicMaterial({ color: '#0b0709', transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
  const rim = new THREE.Mesh(shadowGeo, rimMat); rim.scale.set(1.035, 1.02, 1); rim.position.set(0, -.01, .012);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.z = .02;
  const figure = new THREE.Group(); figure.add(rim, shadow); figure.position.y = .08; figure.scale.setScalar((H - .25) / SHADOW_LOOK.tall);
  root.add(lattice, screen, figure);
  for (const o of [screen, rim, shadow]) { o.raycast = () => {}; o.renderOrder = 2; }
  lattice.renderOrder = 1;
  // Torn paper: a small pool of flakes in world space that tumble down and char out.
  const shredGeo = g(new THREE.PlaneGeometry(.26, .2));
  const shredMat = m(new THREE.MeshBasicMaterial({ color: '#f0c487', transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  const shreds = new THREE.InstancedMesh(shredGeo, shredMat, SHADOW_LOOK.shreds); shreds.frustumCulled = false; shreds.visible = false; shreds.name = 'CrowShadowShreds'; parent.add(shreds);
  const sp = Array.from({ length: SHADOW_LOOK.shreds }, () => new THREE.Vector3()), sv = Array.from({ length: SHADOW_LOOK.shreds }, () => new THREE.Vector3()), spin = new Float32Array(SHADOW_LOOK.shreds);
  const dummy = new THREE.Object3D();
  let shredAge = Infinity, time = 0, fade = 0;
  return {
    root, shreds,
    get tearing() { return shredAge < SHADOW_LOOK.shredLife; },
    /** Follow the simulated shadow (null hides it). `dark` is the lamp-out beat: the screen loses its glow. */
    update(dt: number, s: CrowShadow | null, dark: boolean) {
      time += dt;
      fade = s ? Math.min(1, fade + dt * 4) : Math.max(0, fade - dt * 6);
      root.visible = fade > 0;
      if (s) { root.position.set(s.x, s.y, s.z); root.rotation.y = s.yaw; }
      // Out of step with him: a slow sway and a breathing flicker from the flame behind.
      figure.rotation.z = Math.sin(time * 2.3 + (s?.side ?? 1)) * .07; figure.position.x = Math.sin(time * 1.7) * .08;
      const flicker = .85 + .15 * Math.sin(time * 13) * Math.sin(time * 5.3);
      screenMat.opacity = fade * (dark ? .3 : .82) * flicker; latticeMat.opacity = fade * .55; rimMat.opacity = fade * (dark ? .2 : .45) * flicker; shadowMat.opacity = fade;
      if (shredAge < SHADOW_LOOK.shredLife) {
        shredAge += dt; const k = Math.min(1, shredAge / SHADOW_LOOK.shredLife);
        for (let i = 0; i < SHADOW_LOOK.shreds; i++) {
          sv[i].y -= 6 * dt; sv[i].multiplyScalar(1 - dt * 1.4); sp[i].addScaledVector(sv[i], dt);
          dummy.position.copy(sp[i]); dummy.rotation.set(spin[i] * shredAge, spin[i] * 1.7 * shredAge, spin[i] * .6 * shredAge); dummy.scale.setScalar(1 - k * .6); dummy.updateMatrix(); shreds.setMatrixAt(i, dummy.matrix);
        }
        shreds.instanceMatrix.needsUpdate = true;
        // The paper chars as it falls: pale, then ember, then ash.
        shredMat.color.set(k < .35 ? '#f0c487' : k < .7 ? '#ff7a2a' : '#3a2a22'); shredMat.opacity = 1 - k * k;
        shreds.visible = shredAge < SHADOW_LOOK.shredLife;
      }
    },
    /** The round went through: burst the screen into falling shreds at `at`, hide the screen at once. */
    tear(at: THREE.Vector3 | { x: number; y: number; z: number }) {
      fade = 0; root.visible = false; shredAge = 0; shreds.visible = true;
      for (let i = 0; i < SHADOW_LOOK.shreds; i++) {
        const a = i / SHADOW_LOOK.shreds * Math.PI * 2, r = .2 + (i % 4) * .18;
        sp[i].set(at.x + Math.cos(a) * r, at.y + Math.sin(a * 2) * .9, at.z + Math.sin(a) * r);
        sv[i].set(Math.cos(a) * (2 + i % 3), 1.5 + (i % 5) * .5, Math.sin(a) * (2 + i % 3)); spin[i] = 3 + (i % 7);
      }
    },
    dispose() { root.removeFromParent(); shreds.removeFromParent(); geometries.forEach(x => x.dispose()); materials.forEach(x => x.dispose()); shreds.dispose(); },
  };
}

/** 灭灯 darkness that reads in daylight too: a soot pool on the ground around him and a slow ring of
 * smoke from the smashed lamp, with a few embers. Fades in and out; never a full blackout, the arena
 * edge keeps its light. Child of the boss's root (local coordinates, feet at y = 0). */
export const SOOT = Object.freeze({ pool: 4.2, puffs: 18, embers: 10 });
export function createLampOutSoot(shared?: THREE.BufferGeometry[], owned?: THREE.Material[]) {
  const root = new THREE.Group(); root.name = 'CrowLampOutSoot'; root.visible = false;
  const poolMat = new THREE.MeshBasicMaterial({ color: '#050406', transparent: true, opacity: 0, depthWrite: false, fog: false });
  const poolGeo = new THREE.CircleGeometry(SOOT.pool, 40); poolGeo.rotateX(-Math.PI / 2);
  // Soft edge: a second, wider ring at half strength.
  const edgeGeo = new THREE.RingGeometry(SOOT.pool, SOOT.pool * 1.3, 40); edgeGeo.rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(poolGeo, poolMat), edgeMat = poolMat.clone(), edge = new THREE.Mesh(edgeGeo, edgeMat);
  pool.position.y = edge.position.y = .07; pool.renderOrder = edge.renderOrder = 1;
  const puffGeo = new THREE.IcosahedronGeometry(1, 1), puffMat = new THREE.MeshLambertMaterial({ color: '#141015', emissive: '#2a0c06', transparent: true, opacity: 0, depthWrite: false, flatShading: true, fog: false });
  const puffs = new THREE.InstancedMesh(puffGeo, puffMat, SOOT.puffs); puffs.frustumCulled = false;
  const emberGeo = new THREE.OctahedronGeometry(.06, 0), emberMat = new THREE.MeshBasicMaterial({ color: '#ff8a3a', transparent: true, opacity: 0, toneMapped: false });
  const embers = new THREE.InstancedMesh(emberGeo, emberMat, SOOT.embers); embers.frustumCulled = false;
  for (const o of [pool, edge, puffs, embers]) o.raycast = () => {};
  // An owner with pools (the combat view) disposes these with everything else it made.
  shared?.push(poolGeo, edgeGeo, puffGeo, emberGeo); owned?.push(poolMat, edgeMat, puffMat, emberMat);
  root.add(pool, edge, puffs, embers);
  const dummy = new THREE.Object3D(); let w = 0, time = 0;
  return {
    root,
    get strength() { return w; },
    update(dt: number, on: boolean) {
      time += dt; w = on ? Math.min(1, w + dt * 3) : Math.max(0, w - dt * 1.5);
      root.visible = w > 0; if (!root.visible) return;
      poolMat.opacity = .62 * w; edgeMat.opacity = .28 * w; puffMat.opacity = .78 * w; emberMat.opacity = w;
      for (let i = 0; i < SOOT.puffs; i++) {
        const a = i / SOOT.puffs * Math.PI * 2 + time * (.25 + (i % 3) * .08), r = 1.6 + (i % 4) * .4, rise = (time * .35 + i * .37) % 1;
        dummy.position.set(Math.cos(a) * r, .3 + rise * 2.2, Math.sin(a) * r); dummy.rotation.set(i, time * .3 + i, 0);
        dummy.scale.setScalar((.28 + (i % 5) * .07) * (1 - rise * .6) * (.4 + .6 * w)); dummy.updateMatrix(); puffs.setMatrixAt(i, dummy.matrix);
      }
      for (let i = 0; i < SOOT.embers; i++) {
        const a = i * 2.39 + time * .6, r = .8 + (i % 4) * .7, rise = (time * .5 + i * .23) % 1;
        dummy.position.set(Math.cos(a) * r, .2 + rise * 2.4, Math.sin(a) * r); dummy.rotation.set(time * 3 + i, i, 0); dummy.scale.setScalar(1 - rise); dummy.updateMatrix(); embers.setMatrixAt(i, dummy.matrix);
      }
      puffs.instanceMatrix.needsUpdate = embers.instanceMatrix.needsUpdate = true;
    },
    dispose() { root.removeFromParent(); for (const x of [poolGeo, edgeGeo, puffGeo, emberGeo, poolMat, edgeMat, puffMat, emberMat]) x.dispose(); puffs.dispose(); embers.dispose(); },
  };
}

/** Lamp-out ground tell: how strongly the ring reads (dimmed) and how bright the blade glint flares,
 * from windup progress 0–1. The glint peaks as the cut is about to land, so it is the timing cue. */
export function lampOutCue(progress: number) {
  const p = Math.min(1, Math.max(0, progress));
  return { ring: .1 + .12 * p, glint: .25 + .75 * p ** 2 };
}
export { CROW_SHADOWS };
