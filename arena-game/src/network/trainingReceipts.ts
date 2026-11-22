// Per-capture keys keep simultaneous uploads from different tabs independent.
// These records stay on this origin and contain no inputs or camera frames.
const PREFIX = 'parhelion.arena.training-receipt.';
const LIMIT = 20;

interface TrainingReceipt {
  capture: string;
  map: string;
  startedAt: number;
  submitted: number;
  completed: number;
  status: number;
  acceptedAt: number | null;
}

function read(key: string): TrainingReceipt | undefined {
  try {
    const r = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (r && key === PREFIX + r.capture && typeof r.map === 'string' &&
        Number.isFinite(r.startedAt) && Number.isInteger(r.submitted) &&
        Number.isInteger(r.completed) && Number.isInteger(r.status) &&
        (r.acceptedAt === null || Number.isFinite(r.acceptedAt))) return r;
  } catch { /* Browser storage is optional. */ }
}

export function recentTrainingReceipts(): TrainingReceipt[] {
  const receipts: TrainingReceipt[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const receipt = read(key);
      if (receipt) receipts.push(receipt);
    }
  } catch { /* Storage may be disabled. */ }
  return receipts.sort((a, b) => b.startedAt - a.startedAt || a.capture.localeCompare(b.capture));
}

export function trackTrainingUpload(capture: string, map: string, startedAt: number, sequence: number) {
  const key = PREFIX + capture;
  try {
    const saved = read(key);
    const receipt = saved ?? { capture, map, startedAt, submitted: -1, completed: -1, status: 0, acceptedAt: null };
    receipt.submitted = Math.max(sequence, receipt.submitted);
    localStorage.setItem(key, JSON.stringify(receipt));
    if (!saved) {
      for (const old of recentTrainingReceipts().slice(LIMIT)) localStorage.removeItem(PREFIX + old.capture);
    }
  } catch { /* A failed local write must not interrupt an opted-in upload. */ }
  return (status: number) => {
    try {
      const receipt = read(key);
      if (!receipt) return; // A late response must not resurrect a pruned game.
      if (sequence >= receipt.completed) {
        receipt.completed = sequence;
        receipt.status = status;
      }
      if (status === 202) receipt.acceptedAt = Date.now();
      localStorage.setItem(key, JSON.stringify(receipt));
    } catch { /* Private browsing or exhausted quota. */ }
  };
}
