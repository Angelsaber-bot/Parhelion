import * as THREE from 'three';
import { CHARACTER_KITS, MODEL_COMPANION_CLEARANCE, isModelCompanionId, type ModelCompanionId } from '../characters/catalog';
import { loadCharacterKit, type CharacterKit } from '../characters/characterKit';
import type { Collider } from '../player/player';
import { CompanionNavigation } from './companionNavigation';
import { KitCompanion } from './kitCompanion';

export interface ModelCompanionOptions {
  scene: THREE.Scene;
  colliders: Collider[];
  environment?: () => THREE.Texture | undefined;
  /** Existing story actors keep priority. The optional model reserves its own body space. */
  reservedRoots?: () => readonly THREE.Object3D[];
  /** Dependency injection for offline lifecycle tests; production uses the real loader. */
  load?: typeof loadCharacterKit;
  /** Optional combat bridge; omitted keeps the legacy visual-only companion behavior. */
  combat?: {
    range: number;
    damage: number;
    target: (position: THREE.Vector3, range: number, targetId?: string) => { id: string; position: THREE.Vector3 } | null;
    track: (position: THREE.Vector3, range: number, targetId: string) => { id: string; position: THREE.Vector3 } | null;
    strike: (position: THREE.Vector3, range: number, damage: number, targetId: string) => { id: string; position: THREE.Vector3 } | null;
    engage: (player: THREE.Vector3, from?: THREE.Vector3) => { id: string; position: THREE.Vector3 } | null;
  };
}

/** One optional model companion with an explicit combat bridge. Never writes quest or save state. */
export class ModelCompanion {
  private chosen: ModelCompanionId | null = null;
  private phase: 'off' | 'loading' | 'ready' | 'failed' = 'off';
  private current?: CharacterKit;
  private controller?: AbortController;
  private pending?: Promise<void>;
  private generation = 0;
  private disposed = false;
  private placed = false;
  private readonly navigation: CompanionNavigation;
  private readonly follow: KitCompanion;
  private readonly clearanceBox = new THREE.Box3();
  private readonly clearanceBand = new THREE.Box3();
  private readonly identityMatrix = new THREE.Matrix4();
  private readonly colliderBounds = new WeakMap<Collider['bvh'], THREE.Box3>();
  error?: unknown;

  constructor(private readonly options: ModelCompanionOptions) {
    this.navigation = new CompanionNavigation(options.colliders);
    const combat = options.combat;
    this.follow = new KitCompanion({
      colliders: options.colliders, range: combat?.range ?? 0, damage: combat?.damage ?? 0,
      target: combat?.target ?? (() => null), track: combat?.track,
      strike: combat?.strike ?? (() => null), engage: combat?.engage,
      followSide: -1, canPlace: this.canPlace,
    });
  }
  get selected() { return this.chosen; }
  get state() { return this.phase; }
  get actor() { return this.current; }
  get placementPending() { return this.phase === 'ready' && !this.placed; }
  private readonly canPlace = (point: THREE.Vector3) => {
    if (!this.chosen) return false;
    const { radius, height, bands } = MODEL_COMPANION_CLEARANCE[this.chosen];
    if (!(this.options.reservedRoots?.() ?? []).every(root =>
      !root.visible || root.position.y >= point.y + height || root.position.y + 3 <= point.y ||
      Math.hypot(root.position.x - point.x, root.position.z - point.z) >= radius + .5)) return false;
    // Grounded-foot checks own the bottom 20 cm. Height-varying upper bands
    // avoid putting a flag-width box at ankle height on ordinary slopes.
    this.clearanceBox.min.set(point.x - radius, point.y + .2, point.z - radius);
    this.clearanceBox.max.set(point.x + radius, point.y + height, point.z + radius);
    for (const collider of this.options.colliders) {
      if (!collider.enabled) continue;
      let bounds = this.colliderBounds.get(collider.bvh);
      if (!bounds) { bounds = collider.bvh.getBoundingBox(new THREE.Box3()); this.colliderBounds.set(collider.bvh, bounds); }
      if (!bounds.intersectsBox(this.clearanceBox)) continue;
      for (const band of bands) {
        this.clearanceBand.min.set(point.x - band.radius, point.y + band.bottom, point.z - band.radius);
        this.clearanceBand.max.set(point.x + band.radius, point.y + band.top, point.z + band.radius);
        if (bounds.intersectsBox(this.clearanceBand) && collider.bvh.intersectsBox(this.clearanceBand, this.identityMatrix)) return false;
      }
    }
    return true;
  };

  select(id: ModelCompanionId | null): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (id !== null && !isModelCompanionId(id)) return Promise.reject(new Error('Unknown model companion'));
    if (id === this.chosen) return this.pending ?? Promise.resolve();
    this.clearActor();
    this.chosen = id;
    this.error = undefined;
    if (!id) { this.phase = 'off'; return Promise.resolve(); }
    return this.startLoad(id);
  }

  retry(): Promise<void> {
    if (this.disposed || this.phase !== 'failed' || !this.chosen) return this.pending ?? Promise.resolve();
    this.error = undefined;
    return this.startLoad(this.chosen);
  }

  private startLoad(id: ModelCompanionId): Promise<void> {
    const generation = this.generation, controller = new AbortController();
    this.controller = controller;
    this.phase = 'loading';
    // Normalize synchronous loader/environment errors into the same recoverable state.
    const pending = Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return (this.options.load ?? loadCharacterKit)(CHARACTER_KITS[id], { signal: controller.signal, environment: this.options.environment?.(), onEvent: (event) => { if (this.current) this.follow.onEvent(this.current, event); } });
    }).then(actor => {
      if (this.disposed || generation !== this.generation || controller.signal.aborted) { actor.dispose(); return; }
      this.current = actor;
      actor.root.visible = false; // No flash at world origin before a safe placement exists.
      this.options.scene.add(actor.root);
      this.phase = 'ready';
    }).catch(error => {
      if (this.disposed || generation !== this.generation || controller.signal.aborted) return;
      this.error = error;
      this.phase = 'failed';
    }).finally(() => {
      if (generation === this.generation && this.controller === controller) {
        this.pending = undefined;
        this.controller = undefined;
      }
    });
    this.pending = pending;
    return pending;
  }

  update(dt: number, player: THREE.Vector3, yaw: number, enabled: boolean, paused: boolean) {
    const actor = this.current;
    if (this.disposed || !actor) return;
    if (!enabled) {
      actor.root.visible = false;
      this.placed = false;
      this.follow.release(actor);
      return;
    }
    if (paused) return;
    // Story movement always has priority, including a newly summoned/switched actor.
    if (this.placed && !this.canPlace(actor.root.position)) {
      actor.root.visible = false;
      this.placed = false;
      this.follow.release(actor);
    }
    if (!this.placed) {
      const safe = this.navigation.safeReturn(player, yaw, { side: -1, canPlace: this.canPlace });
      if (!safe) return; // Do not place the actor in midair or through an obstacle.
      actor.root.position.copy(safe);
      actor.root.rotation.y = yaw;
      this.placed = true;
      actor.root.visible = true;
    }
    // Host grounds only the identity root. Qin's authored mesh/bone hover is untouched.
    this.follow.update(actor, dt, player, yaw, false);
  }

  private clearActor() {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.pending = undefined;
    this.follow.release(this.current);
    this.current?.dispose();
    this.current = undefined;
    this.placed = false;
    this.navigation.reset();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearActor();
    this.chosen = null;
    this.phase = 'off';
    this.error = undefined;
  }
}
