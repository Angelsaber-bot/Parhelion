import * as THREE from 'three';
import type { UltimateStageFrame } from './ultimateStage';

const STYLES = {
  jeanne: { color: 0xffe9b2, shadow: 0x566884, camera: [-.24, 2.35, 7.3] },
  ozymandias: { color: 0xffc063, shadow: 0x87502f, camera: [.16, 1.72, 7.5] },
  qinshihuang: { color: 0x9de0ca, shadow: 0x52645d, camera: [.43, 3.5, 8.2] },
} as const;

export type RegionalStageIdentity = keyof typeof STYLES;
export function isRegionalStageIdentity(id: string): id is RegionalStageIdentity {
  return Object.hasOwn(STYLES, id);
}

type StageOwner = {
  material: (color: number, opacity: number) => THREE.MeshBasicMaterial;
  mesh: (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) => THREE.Mesh;
};

export class RegionalUltimateArt {
  readonly root = new THREE.Group();
  private readonly pieces: THREE.Group[] = [];
  private readonly glow: THREE.MeshBasicMaterial;

  constructor(private readonly id: RegionalStageIdentity, owner: StageOwner) {
    const style = STYLES[id];
    this.root.name = 'RegionalUltimate:' + id;
    const structure = owner.material(style.shadow, 1);
    this.glow = owner.material(style.color, .62);
    const part = (parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = owner.mesh(geometry, material, parent);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const group = (x: number, z: number) => {
      const piece = new THREE.Group();
      piece.position.set(x, 0, z);
      this.root.add(piece);
      this.pieces.push(piece);
      return piece;
    };
    if (id === 'jeanne') {
      const cloth = new THREE.Shape();
      cloth.moveTo(0, 0); cloth.lineTo(.84, 0); cloth.lineTo(.84, -1.28);
      cloth.lineTo(.42, -.95); cloth.lineTo(0, -1.28); cloth.closePath();
      for (const x of [-2.25, 2.25]) {
        const banner = group(x, -2.4);
        part(banner, new THREE.CylinderGeometry(.055, .08, 3.65, 8), structure, 0, 1.82, 0);
        part(banner, new THREE.BoxGeometry(1.05, .07, .085), structure, 0, 3.26, 0);
        part(banner, new THREE.ShapeGeometry(cloth), this.glow, -.42, 3.23, .04);
        part(banner, new THREE.OctahedronGeometry(.16), this.glow, 0, 3.76, 0);
      }
    } else if (id === 'ozymandias') {
      const disc = group(0, -3.7);
      part(disc, new THREE.TorusGeometry(1.48, .065, 8, 64), this.glow, 0, 2.88, 0);
      part(disc, new THREE.TorusGeometry(1.25, .025, 6, 48), this.glow, 0, 2.88, .04);
      const ray = new THREE.BoxGeometry(.065, .35, .08);
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        part(disc, ray, this.glow, Math.sin(angle) * 1.76, 2.88 + Math.cos(angle) * 1.76, 0).rotation.z = -angle;
      }
      for (const x of [-2.9, 2.9]) {
        const pylon = group(x, -3.1);
        part(pylon, new THREE.CylinderGeometry(.24, .42, 3.8, 4), structure, 0, 1.9, 0);
        part(pylon, new THREE.ConeGeometry(.34, .66, 4), this.glow, 0, 4.13, 0);
      }
    } else {
      for (const z of [-1.3, -2.75, -4.2]) {
        const rank = group(0, z);
        for (const x of [-2.8, -1.88, 1.88, 2.8]) {
          part(rank, new THREE.BoxGeometry(.41, 1.08, .31), structure, x, .54, 0);
          part(rank, new THREE.BoxGeometry(.29, .15, .035), this.glow, x, .85, .17);
        }
      }
    }
  }

  update(frame: UltimateStageFrame, camera: THREE.PerspectiveCamera, aim: THREE.Vector3, reduced: boolean) {
    const { phase, progress, strikeCount = 0 } = frame;
    this.root.visible = phase !== 'intro';
    const settle = phase === 'charge' && !reduced ? THREE.MathUtils.smoothstep(progress, 0, .85) : 1;
    this.pieces.forEach((piece, i) => {
      const raised = this.id === 'qinshihuang' && phase === 'release' ? (i < strikeCount ? 1 : .54) : settle;
      piece.position.y = (raised - 1) * 1.15;
      piece.rotation.y = !reduced && this.id === 'jeanne' ? Math.sin(frame.elapsed * 2 + i) * .15 : 0;
    });
    this.glow.opacity = reduced ? .48 : phase === 'release' ? .78 : .58;
    if (phase === 'intro') return;
    const [angle, height, distance] = STYLES[this.id].camera;
    const orbit = reduced ? .08 : angle + (phase === 'charge' ? (progress - .5) * .18 : 0);
    camera.position.set(Math.sin(orbit) * distance, height, Math.cos(orbit) * distance);
    camera.fov = 43;
    aim.set(0, this.id === 'ozymandias' ? 2.1 : 1.62, -.65);
  }
}
