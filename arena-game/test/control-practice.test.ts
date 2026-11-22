import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { WEAPONS } from '../shared/content.ts';
import { EXPLORATION_TICKS } from '../shared/exploration.ts';
import { NEURAL_FEATURE_COUNT } from '../shared/neuralPolicy.ts';

it.each([false, true])('records observations before every candidate action (history=%s)', withHistory => {
  const temp = mkdtempSync(join(tmpdir(), 'arena-practice-'));
  try {
    const output = join(temp, 'observations.json');
    const script = fileURLToPath(new URL('../scripts/sample-control-practice.ts', import.meta.url));
    execFileSync(process.execPath, ['--import', 'tsx', script, output, '83519', '250', ...(withHistory ? ['--with-history'] : [])]);
    const trials: number[][] = JSON.parse(readFileSync(output, 'utf8'));
    let before: number[] | undefined;
    const kinds = new Set<number>();
    const ranges = new Set<number>();
    for (const row of trials) {
      kinds.add(row[0]);
      const sensors = row.slice(1, -2);
      expect(sensors.length).toBe(NEURAL_FEATURE_COUNT * (withHistory ? 2 : 1));
      if (withHistory && row[0] === 0) {
        const current = sensors.slice(NEURAL_FEATURE_COUNT);
        const change = Math.atan2(current[21], current[22]) - Math.atan2(sensors[21], sensors[22]);
        expect(current[16]).toBeCloseTo(Math.atan2(Math.sin(change), Math.cos(change)) / (EXPLORATION_TICKS * .4), 7);
      }
      if (row[0] === 0) {
        before = sensors;
        ranges.add(sensors.at(-NEURAL_FEATURE_COUNT + 15)!);
      }
      else expect(sensors).toEqual(before);
    }
    expect(ranges).toEqual(new Set(WEAPONS.filter(w => w.kind === 'gun').map(w => Math.min(1, w.falloffStart / 80))));
    expect(kinds).toEqual(new Set([0, 1, 2]));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
