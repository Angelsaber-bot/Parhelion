import {
  FALSE_DAWN, FALSE_DAWN_ENCOUNTERS, chooseFalseDawn, confirmFalseDawnEncounterStart, getExpectedFalseDawnEncounter,
  interactFalseDawn, recordFalseDawnEncounterVictory, type FalseDawnEncounterId, type FalseDawnInteraction,
} from './falseDawnCampaign';
import type { CampaignChoice } from './campaignEpisodes';
import type { Localized } from './settlements/types';

export interface FalseDawnRuntimeHooks {
  done: Set<string>;
  /** Recheck focus, alive/grounded state, distance and LOS at confirmation time. */
  reachable(id: string): boolean;
  activeEncounter(): string | null;
  startEncounter(id: FalseDawnEncounterId): { ok: boolean; reason?: Localized };
  cancelEncounter(): void;
  save(): boolean;
  applyState(): void;
  dialogue(line: Localized, speaker: Localized): void;
  choices(line: Localized, speaker: Localized, choices: readonly CampaignChoice[], select: (id: string) => void): void;
  toast(line: Localized): void;
  /** Brief existing interaction cue, never input clearing or a pausing dialog. */
  physicalFeedback?(): void;
}

/** Runtime transaction boundary for the additive adventure. The narrative owns
 * saved stages, the combat director owns victory, and physical admission stays
 * with the caller. No timers, proximity-completions or speculative rewards. */
export function createFalseDawnRuntime(hooks: FalseDawnRuntimeHooks) {
  let disposed = false, revision = 0;
  const context = () => ({ activeEncounter: hooks.activeEncounter() });
  const commit = (result: FalseDawnInteraction) => {
    if (!result.changed) return true;
    const saved = hooks.save(); hooks.applyState(); return saved;
  };
  const persistenceNote = (line: Localized, saved: boolean): Localized => saved ? line
    : [`${line[0]}（本次进度暂未保存，请在设置中重试或备份。）`, `${line[1]} (Progress is not saved; retry or back up in Settings.)`];
  function present(result: FalseDawnInteraction, origin: string): boolean {
    if (!result.handled || disposed) return false;
    const saved = commit(result);
    if (result.changed && (FALSE_DAWN.emitters as readonly string[]).includes(origin)) hooks.physicalFeedback?.();
    if (result.encounter) {
      if (!FALSE_DAWN_ENCOUNTERS.includes(result.encounter) || getExpectedFalseDawnEncounter(hooks.done) !== result.encounter || !hooks.reachable(origin)) return true;
      const started = hooks.startEncounter(result.encounter);
      if (!started.ok) {
        hooks.toast(started.reason ?? ['当前无法开始遭遇。请离开其他战斗、落到安全地面后重试。', 'The encounter cannot start now. Leave other combat, reach safe ground, and retry.']);
        return true;
      }
      const accepted = confirmFalseDawnEncounterStart(result.encounter, hooks.done);
      if (!accepted.handled) {
        // A caller can synchronously change progress while admitting actors.
        // Cancel only this request, never another newer encounter.
        if (hooks.activeEncounter() === result.encounter) hooks.cancelEncounter();
        hooks.toast(['任务状态已经改变，本次遭遇已取消。', 'Quest state changed; this encounter was canceled.']);
        return true;
      }
      const persisted = commit(accepted);
      if (accepted.toast) hooks.toast(persistenceNote(accepted.toast, persisted));
      return true; // Starting combat never opens a pausing dialogue.
    }
    if (result.toast) hooks.toast(persistenceNote(result.toast, saved));
    if (!result.dialogue) return true;
    const line = persistenceNote(result.dialogue, saved);
    if (result.choices?.length) {
      const current = revision;
      hooks.choices(line, result.speaker, result.choices, selected => {
        if (disposed || current !== revision) return;
        revision++;
        if (!hooks.reachable(origin)) { hooks.toast(['请回到现场后重新查看。', 'Return to the site and inspect it again.']); return; }
        present(chooseFalseDawn(origin, selected, hooks.done, context()), origin);
      });
    } else hooks.dialogue(line, result.speaker);
    return true;
  }
  return {
    interact(id: string) {
      if (disposed || !hooks.reachable(id)) return false;
      revision++; return present(interactFalseDawn(id, hooks.done, context()), id);
    },
    victory(id: string) {
      if (disposed) return false;
      const result = recordFalseDawnEncounterVictory(id, hooks.done);
      if (!result.handled) return false;
      revision++; const saved = commit(result);
      if (result.toast) hooks.toast(persistenceNote(result.toast, saved));
      return true;
    },
    /** Called on reset/import/session teardown, not merely to read the journal. */
    invalidate() { revision++; },
    dispose() { if (disposed) return; disposed = true; revision++; },
  };
}
