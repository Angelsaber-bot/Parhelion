import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseExplorationModel, type ExplorationModel } from '../shared/exploration.ts';

export interface PublicFallback { exploration?: ExplorationModel; digest?: string }

/** The active Worker endpoint returns null when RoomCore uses its plain scripted pilot. */
export function loadFallback(path: string): PublicFallback {
  const bytes = readFileSync(path), raw = JSON.parse(bytes.toString('utf8'));
  if (raw === null) return {};
  const exploration = parseExplorationModel(raw);
  if (!exploration) throw Error('Invalid released Arena exploration policy');
  return { exploration, digest: createHash('sha256').update(bytes).digest('hex') };
}
