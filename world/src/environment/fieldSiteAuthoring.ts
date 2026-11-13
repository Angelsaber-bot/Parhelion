import type * as THREE from 'three';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import type { SiteArt } from '../story/campaignSites';

type Point = [number, number, number];
type Region = Parameters<SiteArt['finish']>[0];
type Apply = (done: ReadonlySet<string>, dt: number, player: THREE.Vector3) => void;
export type FieldAuthoring = {
  place(guess: Point, range?: number): Point | null;
  interact(id: string, point: Point): void;
  scenery(name: string): SiteArt;
  finish(art: SiteArt, region: Region, solid?: boolean): Collider | null;
  table(art: SiteArt, p: Point, color?: string): void;
  mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, p: Point, name?: string): THREE.Mesh;
  group(parent: THREE.Object3D, p: Point, name: string): THREE.Group;
  walkway(name: string, region: Region, points: [Point, Point], width: number, color: string, enabled: boolean, rails?: boolean): { art: SiteArt; collider: Collider };
  ground(x: number, z: number, ceiling: number): number | null;
  materials: Record<'wood' | 'dark' | 'red' | 'blue' | 'metal' | 'beacon', THREE.MeshStandardMaterial>;
  prior: ReadonlyMap<string, Marker>;
  markers: Marker[];
  colliders: Collider[];
  targets: THREE.Mesh[];
  updates: Apply[];
  actorCleanup: (() => void)[];
};
