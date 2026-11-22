import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('gives every candidate camera action the observation recorded before trying it', () => {
  const temp = mkdtempSync(join(tmpdir(), 'arena-practice-'));
  try {
    const output = join(temp, 'observations.json');
    const script = fileURLToPath(new URL('../scripts/sample-control-practice.ts', import.meta.url));
    execFileSync(process.execPath, ['--import', 'tsx', script, output, '83519', '250']);
    const trials: number[][] = JSON.parse(readFileSync(output, 'utf8'));
    let before: number[] | undefined;
    const kinds = new Set<number>();
    for (const row of trials) {
      kinds.add(row[0]);
      const sensors = row.slice(1, -2);
      if (row[0] === 0) before = sensors;
      else expect(sensors).toEqual(before);
    }
    expect(kinds).toEqual(new Set([0, 1, 2]));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
