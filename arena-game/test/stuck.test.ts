// No reachable spot on any map may trap a player (2026-10-28: CAMLANN's old berm ramps
// left corner pits nobody could walk or jump out of). See stuck-scan.ts for the method.
import { describe, expect, it } from 'vitest';
import { MAPS } from '../shared/arenaMap.ts';
import { findTraps } from './stuck-scan.ts';

describe('movement traps', () => {
  for (const info of MAPS) it(`${info.id} has no reachable spot a player cannot leave`, { timeout: 60000 }, () => {
    expect(findTraps(info.id, 0.5)).toEqual([]);
  });
});
