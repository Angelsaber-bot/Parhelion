import { RelayChannel, type RelayChannelFrame } from './relayChannel';
import { COMPACT_RELAY, completeCompactRelay, getCompactRelayIntro, getCompactRelayInterrupt } from './compactRelayCampaign';
import type { Localized } from './settlements/types';
import type { CampaignChoice } from './campaignEpisodes';

import { COMPACT_RELAY_ENCOUNTER } from './compactRelayEncounter';
export interface CompactRelayHooks {
  done: Set<string>;
  reachable(id: string): boolean;
  sessionValid(): boolean;
  activeEncounter(): string | null;
  startEncounter(): { ok: boolean; reason?: Localized };
  cancelEncounter(): void;
  save(): boolean;
  applyState(): void;
  toast(line: Localized): void;
  choices(line: Localized, speaker: Localized, choices: readonly CampaignChoice[], select: (id: string) => void): void;
  damageRevision(): number;
  deploy(): boolean;
}
/** Local training session and channel ownership. Reset/import/abandon cannot be
 * mistaken for victory, and killing the patrol does not complete the objective. */
export function createCompactRelayRuntime(hooks: CompactRelayHooks) {
  const channel = new RelayChannel();
  let disposed = false, revision = 0, active = false, cleared = false;
  const speaker: Localized = ['前沿联络 · 训练控制台', 'Forward Relay · Training Console'];
  function stop(cancel: boolean) {
    const wasActive = active; active = false; cleared = false; revision++;
    channel.reset(hooks.damageRevision());
    if (cancel && wasActive && hooks.activeEncounter() === COMPACT_RELAY_ENCOUNTER) hooks.cancelEncounter();
    if (wasActive && !disposed) hooks.applyState();
  }
  function sync() {
    if (!active || disposed) return;
    if (!hooks.done.has('armory_rack') || !hooks.sessionValid() || (!cleared && hooks.activeEncounter() !== COMPACT_RELAY_ENCOUNTER)) {
      stop(true); hooks.toast(['演练已中止，未领取奖励。回入口可重新开始；已完成的主线进度保留。', 'Training stopped without a reward. Restart at the entrance; completed story progress remains.']);
    }
  }
  return {
    get active() { return active; },
    get cleared() { return cleared; },
    get progress() { return channel.progress; },
    interact(id: string) {
      if (disposed || (id !== COMPACT_RELAY.entry && id !== COMPACT_RELAY.controller && id !== COMPACT_RELAY.deployment) || !hooks.reachable(id)) return false;
      sync(); revision++;
      if (id === COMPACT_RELAY.deployment) {
        if (!hooks.done.has(COMPACT_RELAY.complete) || active) {
          hooks.toast(['先完成突破演练；演练进行中不能部署。', 'Complete the breach exercise first; deployment is unavailable during training.']); return true;
        }
        const generation = revision;
        hooks.choices(['部署目的地：废弃前哨站南门外。不会替你开启中继器或完成旧主线；也可以关闭此页，继续步行探索。', 'Destination: outside the abandoned outpost’s south gate. This does not activate a relay or complete old story objectives. Close this page to keep exploring on foot.'], speaker,
          [{ id: 'deploy', label: ['安全部署到前哨站南门外', 'Deploy safely outside the outpost south gate'] }], selected => {
            if (disposed || generation !== revision || selected !== 'deploy') return;
            revision++;
            if (!active && hooks.done.has(COMPACT_RELAY.complete) && hooks.reachable(id)) hooks.deploy();
          });
        return true;
      }
      if (!hooks.done.has('armory_rack')) { hooks.toast(['先在军械架领取装备，再进入前沿演练。', 'Collect your armory equipment before entering training.']); return true; }
      if (id === COMPACT_RELAY.controller) {
        hooks.toast(active ? ['站稳并按住交互键三秒。移动、受伤或攻击会中断；中断后松开再按。', 'Stand still and hold Interact for three seconds. Moving, damage or attacks interrupt it; release and press again.'] : ['先在庭院入口主动开始演练。', 'Start training deliberately at the yard entrance.']);
        return true;
      }
      if (active) { stop(true); hooks.toast(['已主动撤出演练。可以调整路线后再来，不会改写已完成奖励。', 'Training abandoned. Try another approach when ready; completed rewards are unchanged.']); return true; }
      const generation = revision, before = [...hooks.done].sort().join('\n');
      hooks.choices(getCompactRelayIntro(hooks.done), speaker, [{ id: 'start', label: ['开始突破演练', 'Begin the breach exercise'] }], selected => {
        if (disposed || generation !== revision || selected !== 'start') return;
        revision++;
        if (before !== [...hooks.done].sort().join('\n') || !hooks.reachable(COMPACT_RELAY.entry) || !hooks.done.has('armory_rack')) return;
        const result = hooks.startEncounter();
        if (!result.ok) { hooks.toast(result.reason ?? ['暂不能开始，请落地并脱离其他战斗。', 'Cannot start yet. Land and leave other combat.']); return; }
        if (before !== [...hooks.done].sort().join('\n') || !hooks.sessionValid()) {
          if (hooks.activeEncounter() === COMPACT_RELAY_ENCOUNTER) hooks.cancelEncounter(); return;
        }
        active = true; cleared = false; channel.reset(hooks.damageRevision()); hooks.applyState();
        hooks.toast(['演练开始：借掩体突破，在机柜旁按住交互键接通。击败巡卫不是唯一办法。', 'Exercise started: use cover and hold Interact at the cabinet. Defeating the patrol is not the only way.']);
      });
      return true;
    },
    update(frame: Omit<RelayChannelFrame, 'active' | 'damageRevision'>) {
      sync();
      if (disposed || !active) return;
      const result = channel.update({ ...frame, active, damageRevision: hooks.damageRevision() });
      if (result.interrupted) hooks.toast(getCompactRelayInterrupt(result.interrupted));
      if (!result.completedNow) return;
      // Admission, position, threat lifecycle and input are rechecked in this
      // same update, after authoritative damage. No dialogue pauses the capture.
      if (!hooks.sessionValid() || !hooks.reachable(COMPACT_RELAY.controller)) { channel.reset(hooks.damageRevision()); return; }
      const first = completeCompactRelay(hooks.done);
      stop(true);
      const saved = !first || hooks.save(); hooks.applyState();
      const line: Localized = first
        ? ['联络已接通，训练巡卫收到停战指令并撤回。前沿部署台永久开放：可自愿前往旧前哨门外，不改写原主线进度。', 'Relay connected. The training patrol receives ceasefire and withdraws. Forward deployment is permanently available: travel voluntarily to the old outpost gate; original story progress is not changed.']
        : ['本次突破演练完成，巡卫已撤回。奖励不会重复领取；可以换条路线再试。', 'Exercise complete; the patrol withdraws. Rewards are not repeated. Try the other approach when ready.'];
      hooks.toast(saved ? line : [`${line[0]}（尚未保存，请在设置中重试或备份。）`, `${line[1]} (Not saved; retry or back up in Settings.)`]);
    },
    victory(id: string) {
      if (disposed || !active || id !== COMPACT_RELAY_ENCOUNTER || !hooks.sessionValid()) return false;
      cleared = true; hooks.applyState();
      hooks.toast(['巡卫已清除，仍需在机柜旁接通联络；没有自动完成。', 'Patrol cleared. Connect the cabinet to finish; this is not an automatic completion.']); return true;
    },
    interrupt() { channel.reset(hooks.damageRevision()); },
    invalidate() { stop(true); },
    dispose() { if (disposed) return; disposed = true; stop(true); },
  };
}
