export type V2 = [number, number];

export interface Marker {
  id: string;
  type: 'spawn' | 'objective' | 'interact' | 'discovery' | 'enemy' | 'cover' | 'poi';
  label: string;
  p: [number, number, number];
  radius?: number;
  requires?: string[];
  note?: string;
}

export interface Layout {
  world: { id: string; name: string; nameEn: string; half: number; playHalf: number; waterLevel: number; seed: number; version: number };
  areas: { id: string; name: string; nameEn: string; c: V2; r: number; color: string; tp: V2; region?: string }[];
  paths: V2[][];
  markers: Marker[];
  objective: { id: string; name: string; steps: { id: string; text: string; done: string[] }[] };
  /** Region extras (optional; 幻日谷 has none). */
  updrafts?: { x: number; z: number; r: number; y0: number; y1: number }[];
  lights?: { p: [number, number, number]; color: string; intensity: number; distance: number }[];
  atmosphere?: { fog: string; near: number; far: number; sea?: boolean };
}
