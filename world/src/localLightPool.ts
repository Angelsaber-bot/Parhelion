import * as THREE from 'three';

export interface AuthoredLocalLight {
  readonly p: readonly [number, number, number];
  readonly color: THREE.ColorRepresentation;
  readonly intensity: number;
  readonly distance: number;
  readonly decay?: number;
}
/** Fixed shader light count, not a distance-based visibility toggle. Only the
 * authored world lamps enter this pool; settlement and cinematic lamps do not.
 * This bounds lighting work, but is not a GPU/FPS guarantee. */
export class LocalLightPool {
  readonly root = new THREE.Group();
  readonly lights: readonly THREE.PointLight[];
  readonly sources: readonly AuthoredLocalLight[];
  private slots: { light: THREE.PointLight; current: number; target: number; level: number }[];
  private initialized = false;
  private disposed = false;
  constructor(sources: readonly AuthoredLocalLight[], count = 8, readonly hysteresis = 20) {
    if (!Number.isInteger(count) || count < 1 || count > 32 || !Number.isFinite(hysteresis) || hysteresis < 0) throw new RangeError('Invalid local light budget');
    if (sources.some(s => s.p.length !== 3 || !s.p.every(Number.isFinite) || !Number.isFinite(s.intensity) || s.intensity < 0 || !Number.isFinite(s.distance) || s.distance <= 0 || (s.decay !== undefined && (!Number.isFinite(s.decay) || s.decay < 0)))) throw new RangeError('Invalid authored local light');
    this.sources = sources.map(s => ({ ...s, p: [...s.p] as [number, number, number] }));
    this.root.name = 'AuthoredLocalLightPool';
    this.slots = Array.from({ length: count }, (_, index) => {
      const light = new THREE.PointLight(0xffffff, 0); light.name = `WorldLampSlot_${index}`;
      this.root.add(light); return { light, current: -1, target: -1, level: 0 };
    });
    this.lights = this.slots.map(s => s.light);
  }
  get selectedSources(): readonly number[] { return this.slots.map(s => s.target).filter(id => id >= 0); }
  private assign(slot: typeof this.slots[number], source: number) {
    slot.current = source;
    if (source < 0) { slot.light.intensity = 0; return; }
    const authored = this.sources[source];
    slot.light.position.fromArray(authored.p); slot.light.color.set(authored.color);
    slot.light.distance = authored.distance; slot.light.decay = authored.decay ?? 1.6;
    slot.light.userData.authoredSource = source;
  }
  update(position: Readonly<THREE.Vector3>, dt = 1 / 60) {
    if (this.disposed || ![position.x, position.y, position.z].every(Number.isFinite)) return;
    const incumbents = new Set(this.selectedSources);
    const ranked = this.sources.map((source, id) => ({ id, score: Math.max(0, Math.hypot(position.x - source.p[0], position.y - source.p[1], position.z - source.p[2]) - source.distance) - (incumbents.has(id) ? this.hysteresis : 0) }));
    ranked.sort((a, b) => a.score - b.score || a.id - b.id);
    const selected = new Set(ranked.slice(0, this.slots.length).map(s => s.id));
    const assigned = new Set<number>();
    // Keep selected targets in their current slots; sorting never shuffles lamps.
    for (const slot of this.slots) if (selected.has(slot.target)) assigned.add(slot.target); else slot.target = -1;
    const pending = [...selected].filter(id => !assigned.has(id));
    for (const slot of this.slots) if (slot.target < 0) slot.target = pending.shift() ?? -1;
    const step = Math.min(.1, Math.max(0, Number.isFinite(dt) ? dt : 0)) / .2;
    for (const slot of this.slots) {
      if (!this.initialized) { this.assign(slot, slot.target); slot.level = slot.target < 0 ? 0 : 1; }
      else if (slot.current !== slot.target) {
        slot.level = Math.max(0, slot.level - step);
        if (slot.level === 0) this.assign(slot, slot.target);
      } else slot.level = slot.current < 0 ? 0 : Math.min(1, slot.level + step);
      slot.light.intensity = slot.current < 0 ? 0 : this.sources[slot.current].intensity * slot.level;
    }
    this.initialized = true;
  }
  dispose() { if (this.disposed) return; this.disposed = true; this.root.removeFromParent(); this.root.clear(); for (const light of this.lights) light.dispose(); }
}
