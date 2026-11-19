import { PUBLIC_SERVER } from '../../shared/protocol.ts';
import { parseExplorationModel } from '../../shared/exploration.ts';
import { parseNeuralPolicy } from '../../shared/neuralPolicy.ts';
import { MAX_TRAINING_BODY, type TrainingBatch } from '../../shared/trainingData.ts';

export function trainingUrl(hostname: string): string {
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(hostname)) return 'http://127.0.0.1:8787/training';
  return PUBLIC_SERVER.replace(/^ws/, 'http').replace(/\/arena\/?$/, '/training');
}

export function submitTraining(batch: TrainingBatch, receipt?: (status: number) => void): void {
  const endpoint = trainingUrl(location.hostname);
  const body = JSON.stringify(batch);
  if (body.length > MAX_TRAINING_BODY) { receipt?.(413); return; }
  const send = () => fetch(endpoint, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain' } });
  const retry = () => setTimeout(() => { void send().then(response => receipt?.(response.status)).catch(() => receipt?.(0)); }, 1500);
  void send().then(response => {
    if (response.status === 429 || response.status >= 500) retry();
    else receipt?.(response.status);
  }).catch(retry);
}

export async function fetchExplorationModel() {
  const endpoint = `${trainingUrl(location.hostname)}/exploration?active=1`;
  try {
    const result = await fetch(endpoint, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(2000) });
    return result.ok ? parseExplorationModel(await result.json()) : undefined;
  } catch { return undefined; }
}

export async function fetchNeuralModel() {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const endpoint = local ? '/__parhelion/arena-neural/model' : `${trainingUrl(location.hostname)}/neural`;
  try {
    const response = await fetch(endpoint, { credentials: 'omit', signal: AbortSignal.timeout(2000) });
    const model = response.ok ? parseNeuralPolicy(await response.json()) : undefined;
    return model?.synthetic ? undefined : model;
  } catch { return undefined; }
}
