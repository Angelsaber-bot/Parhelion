import { directPolicy } from './learnedOpponent.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from './neuralPolicy.ts';
import { PUBLIC_SERVER } from './protocol.ts';

export const PUBLIC_TRAINER = PUBLIC_SERVER.replace(/^ws/, 'http').replace(/\/arena\/?$/, '/training');
export const LOCAL_TRAINER = 'http://127.0.0.1:8787/training';

interface BotRelease {
  neural?: NeuralPolicyModel;
}

async function readModel<T>(url: string, parse: (raw: unknown) => T | undefined, previous?: T) {
  try {
    const options = { cache: 'no-cache', credentials: 'omit', signal: AbortSignal.timeout(20000) } as const;
    const response = await fetch(url, options);
    if (response.status === 404) return undefined;
    if (!response.ok) return previous;
    const raw: unknown = await response.json();
    // An older open tab can keep its last compatible model across a wire-format upgrade.
    return raw === null ? undefined : parse(raw) ?? previous;
  } catch { return previous; }
}

/** Keep an accepted release available during outages. Each room pins its result for the match. */
export function releasedBotPolicies(base: string) {
  let current: BotRelease = {};
  let pending: Promise<void> | undefined;

  function refresh() {
    if (!pending) {
      pending = readModel(base + '/neural', raw => {
        const model = parseNeuralPolicy(raw);
        return directPolicy(model) ? model : undefined;
      }, current.neural).then(neural => { current = { neural }; }).finally(() => { pending = undefined; });
    }
    return pending;
  }

  return {
    refresh,
    async forMatch(update = refresh()) {
      // Slow downloads may finish for the next match, without holding up offline play.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([update, new Promise<void>(resolve => { timer = setTimeout(resolve, 1500); })]);
      } finally { if (timer !== undefined) clearTimeout(timer); }
      return current;
    },
  };
}
