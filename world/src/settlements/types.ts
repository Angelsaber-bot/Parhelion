import type * as THREE from 'three';
import type { CampaignRegionId } from '../core/regionIdentity';

/** Shared identifier for the five authored campaign regions. */
export type RegionId = CampaignRegionId;
export type Localized = [string, string];
/** Socket positions are local to the settlement. The integration supplies world coordinates. */
export interface NpcSocket {
  id: string;
  role: Localized;
  position: [number, number, number];
  yaw?: number;
  lines: Localized[];
}
export interface PlacedNpcSocket extends NpcSocket { region: RegionId; worldRegion?: import('../core/regionIdentity').WorldRegionId; appearance?: {coat?:number;trim?:number;accent?:number;carry?:'sack'|'net'|'bellrope'}; }
export interface SettlementKit {
  id: RegionId;
  name: Localized;
  group: THREE.Group;
  /** Local X/Z dimensions, including all eaves, furnishings and rear yard. */
  footprint: [number, number];
  /** Walk-in portal, local X/Z. Front is +Z; finished interior floors y=0. */
  entry: [number, number];
  npcs: NpcSocket[];
}
export interface SettlementPlacement {
  /** World yaw of the authored settlement, shared by its annexes and entrances. */
  yaw?: number;
  id: RegionId;
  name: Localized;
  position: [number, number, number];
  entry: [number, number, number];
  footprint: [number, number];
  groundRange: number;
}
