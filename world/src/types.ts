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
  areas: { id: string; name: string; nameEn: string; c: V2; r: number; color: string; tp: V2 }[];
  paths: V2[][];
  markers: Marker[];
  objective: { id: string; name: string; steps: { id: string; text: string; done: string[] }[] };
}
