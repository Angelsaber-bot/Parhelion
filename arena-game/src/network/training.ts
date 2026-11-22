import { LOCAL_TRAINER, PUBLIC_TRAINER, releasedBotPolicies } from '../../shared/releasedBotPolicy.ts';
import { MAX_TRAINING_BODY, type TrainingBatch } from '../../shared/trainingData.ts';

const loopback = (hostname: string) => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(hostname);

export function releaseUrl(hostname: string, search: string): string {
  return loopback(hostname) && new URLSearchParams(search).get('trainer') === 'local' ? LOCAL_TRAINER : PUBLIC_TRAINER;
}

export const matchPolicies = () => releasedBotPolicies(releaseUrl(location.hostname, location.search));

export function submitTraining(batch: TrainingBatch, receipt?: (status: number) => void): void {
  const endpoint = loopback(location.hostname) ? LOCAL_TRAINER : PUBLIC_TRAINER;
  const body = JSON.stringify(batch);
  if (body.length > MAX_TRAINING_BODY) { receipt?.(413); return; }
  const send = () => fetch(endpoint, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain' } });
  const retry = () => setTimeout(() => { void send().then(response => receipt?.(response.status)).catch(() => receipt?.(0)); }, 1500);
  void send().then(response => {
    if (response.status === 429 || response.status >= 500) retry();
    else receipt?.(response.status);
  }).catch(retry);
}
