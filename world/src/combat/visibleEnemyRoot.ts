import { Group } from 'three';

/** Render-only enemy container. Hidden encounters keep simulation in WorldCombatState.
 * Skip renderer traversal while hidden; the next visible traversal updates the entire
 * subtree normally. Keep matrixAutoUpdate enabled and explicit updateWorldMatrix /
 * getWorldPosition semantics unchanged. Do not use for colliders or source GLB nodes.
 */
export class VisibleEnemyRoot extends Group {
  override updateMatrixWorld(force?: boolean): void {
    if (this.visible) super.updateMatrixWorld(force);
  }
}
