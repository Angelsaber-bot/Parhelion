/** Reusable production-input-only combat policy for integrated journey QA.
 * Does not start encounters, travel, set grounded/HP/energy, or call damage APIs.
 * The caller owns the real main RAF clock and all story/navigation interactions. */
export interface StoryInputHost {
  world: any;
  window: any;
  /** Current production fixture clock in SECONDS. */
  nowSeconds(): number;
  /** Advance exactly one normal production frame, updating the caller's clock. */
  step(): void;
}
export interface StoryInputOptions {
  reactionSeconds?: number;
  strafe?: boolean;
  mode?: 'rifle' | 'melee';
  useSkill?: boolean;
  useEarnedUltimate?: boolean;
}
export function createStoryInputPolicy(host: StoryInputHost, options: StoryInputOptions = {}) {
  const {world: w, window} = host, document = window.document;
  const start = host.nowSeconds(), reaction = options.reactionSeconds ?? .3;
  if (!Number.isFinite(reaction) || reaction < 0 || reaction > 2) throw Error('Reaction must be in [0, 2] seconds');
  const held = new Set<string>();
  let targetId = '', acquired = start, perceived: any = null, nextSense = start, tellStart = -1, previous = start;
  let nextMelee = start, nextSkill = start + .5, nextUltimate = start;
  const seen = new Set<string>();
  function dispatch(binding: string, down: boolean) {
    if (binding.startsWith('Mouse')) window.dispatchEvent(new window.MouseEvent(down ? 'mousedown' : 'mouseup', {button: Number(binding.slice(5)), bubbles: true, cancelable: true}));
    else document.body.dispatchEvent(new window.KeyboardEvent(down ? 'keydown' : 'keyup', {code: binding, bubbles: true, cancelable: true}));
  }
  function hold(action: string, down: boolean) {
    const binding = w.settings.bindingsFor(action)[0];
    if (!binding || held.has(binding) === down) return;
    if (down) held.add(binding); else held.delete(binding);
    dispatch(binding, down);
  }
  function press(action: string) { hold(action, true); hold(action, false); }
  function release() { for (const binding of held) dispatch(binding, false); held.clear(); }
  function tick() {
    const now = host.nowSeconds(), elapsed = now - start, dt = Math.max(0, Math.min(.05, now - previous || 1 / 60)); previous = now;
    const paused = !document.pointerLockElement || w.ultimateDirector.active || w.narrative.open || w.settingsPanel.open || document.visibilityState !== 'visible' || !document.hasFocus();
    if (paused || w.combat.defeated || !w.combat.storyEncounter) { release(); tellStart = -1; return; }
    const live = w.combat.state.enemies.filter((e: any) => e.storyEncounter && e.active && e.hp > 0 && !e.pacified);
    for (const enemy of live) seen.add(enemy.id);
    const target = live.sort((a: any, b: any) => Math.hypot(a.p.x - w.player.pos.x, a.p.z - w.player.pos.z) - Math.hypot(b.p.x - w.player.pos.x, b.p.z - w.player.pos.z))[0];
    if (!target) { release(); return; }
    if (target.id !== targetId) { targetId = target.id; acquired = now; perceived = null; nextSense = now; }
    if (!perceived || now + 1e-9 >= nextSense) { perceived = {...target.p}; nextSense = now + .15; }
    const source = options.mode === 'melee' ? w.player.pos : w.camera.position;
    const dx = perceived.x - source.x, dz = perceived.z - source.z, dy = perceived.y + 1 - w.camera.position.y;
    const sway = (Math.floor(elapsed / .6) % 5 === 0 ? .10 : .018) * Math.sin(elapsed * 3.7 + .8);
    const yaw = Math.atan2(-dx, -dz) + sway, pitch = Math.atan2(dy, Math.hypot(dx, dz)) + .008 * Math.sin(elapsed * 4);
    const yawDelta = Math.atan2(Math.sin(w.player.yaw - yaw), Math.cos(w.player.yaw - yaw));
    const sensitivity = .0022 * w.settings.value.sensitivity * (1 + (w.settings.value.adsSensitivity - 1) * w.aim.value);
    const event = new window.MouseEvent('mousemove', {bubbles: true});
    Object.defineProperties(event, {
      movementX: {value: Math.max(-4.2 * dt, Math.min(4.2 * dt, yawDelta)) / sensitivity},
      movementY: {value: Math.max(-3 * dt, Math.min(3 * dt, w.player.pitch - pitch)) / (sensitivity * (w.settings.value.invertY ? -1 : 1))},
    });
    document.dispatchEvent(event);
    const telling = live.some((e: any) => e.mode === 'windup');
    if (telling && tellStart < 0) tellStart = now; if (!telling) tellStart = -1;
    hold('right', options.strafe !== false && tellStart >= 0 && now - tellStart >= reaction);
    const distance = Math.hypot(target.p.x - w.player.pos.x, target.p.z - w.player.pos.z);
    if (options.mode === 'melee') {
      hold('fire', false); hold('forward', distance > 1.15);
      if (now >= nextMelee) { press('melee'); nextMelee = now + .2; }
    } else {
      hold('forward', false); hold('fire', now - acquired >= .3);
    }
    if (options.useSkill && now >= nextSkill) { press('skill'); nextSkill = now + 7; }
    // Only existing earned charge is observed. Main retains target/cooldown/payment authority.
    if (options.useEarnedUltimate && now >= nextUltimate && w.actions.skills.energy >= 100 && distance < 5.7) {
      press('ultimate'); nextUltimate = now + 1;
    }
  }
  function run(maxSeconds = 45) {
    if (!Number.isFinite(maxSeconds) || maxSeconds <= 0 || maxSeconds > 180) throw Error('Invalid fight duration');
    const from = host.nowSeconds(), initialHp = w.combat.state.hp, encounter = w.combat.storyEncounter?.id ?? null;
    let ticks = 0;
    try {
      while (w.combat.storyEncounter && !w.combat.defeated && host.nowSeconds() - from < maxSeconds) { if (++ticks > Math.ceil(maxSeconds * 240) + 1) throw Error('Caller clock did not advance'); tick(); host.step(); }
      return {encounter, seconds: host.nowSeconds() - from, initialHp, hp: w.combat.state.hp,
        defeated: w.combat.defeated, remaining: w.combat.storyEncounter, seenIds: [...seen]};
    } finally { release(); }
  }
  return {tick, run, release, get seenIds() { return [...seen]; }};
}
