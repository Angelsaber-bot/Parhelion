/** Cooperative loading checkpoints: yield to browser painting/input between expensive stages.
 * Individual geometry/BVH operations remain synchronous; this is not worker offloading. */
export class BootWorkBudget {
  private last: number;
  yields = 0;
  constructor(private budgetMs = 12, private now = () => performance.now(), private yieldTask = () => new Promise<void>(resolve => setTimeout(resolve, 0))) { this.last = now(); }
  async checkpoint(force = false) {
    if (!force && this.now() - this.last < this.budgetMs) return;
    await this.yieldTask(); this.last = this.now(); this.yields++;
  }
}
