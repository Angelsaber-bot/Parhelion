import * as THREE from 'three';
import type { SettlementPlacement } from './types';

type Frame = Pick<SettlementPlacement, 'position' | 'yaw'>;
/** Annexes, NPCs and collision all use the same frame as the settlement shell. */
export function settlementPoint(frame: Frame, point: readonly number[]): [number, number, number] {
  const c = Math.cos(frame.yaw ?? 0), s = Math.sin(frame.yaw ?? 0);
  return [frame.position[0] + c * point[0] + s * point[2], frame.position[1] + point[1], frame.position[2] - s * point[0] + c * point[2]];
}
export function settlementMatrix(frame: Frame) {
  const matrix = new THREE.Matrix4().makeRotationY(frame.yaw ?? 0);
  return matrix.setPosition(...frame.position);
}
/** A point outside the entrance along authored +Z, including turned regions. */
export function settlementEntryApproach(p: Pick<SettlementPlacement, 'entry' | 'yaw'>, distance: number): [number, number] {
  return [p.entry[0] + Math.sin(p.yaw ?? 0) * distance, p.entry[2] + Math.cos(p.yaw ?? 0) * distance];
}
