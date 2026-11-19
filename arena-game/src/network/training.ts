import { PUBLIC_SERVER } from '../../shared/protocol.ts';
import { MAX_TRAINING_BODY, type TrainingBatch } from '../../shared/trainingData.ts';

export function trainingUrl(hostname: string): string {
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(hostname)) return 'http://127.0.0.1:8787/training';
  return PUBLIC_SERVER.replace(/^ws/, 'http').replace(/\/arena\/?$/, '/training');
}

export function submitTraining(batch: TrainingBatch): void {
  const endpoint = trainingUrl(location.hostname);
  const body = JSON.stringify(batch);
  if (body.length > MAX_TRAINING_BODY) return;
  const send = () => fetch(endpoint, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain' } });
  void send().then(response => {
    if (response.status === 429 || response.status >= 500) setTimeout(() => { void send().catch(() => {}); }, 1500);
  }).catch(() => { setTimeout(() => { void send().catch(() => {}); }, 1500); });
}
