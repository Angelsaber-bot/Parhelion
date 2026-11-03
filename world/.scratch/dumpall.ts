import { CAMPS, PUZZLES, DOMAINS, TRIALS, STATUES } from '../src/exploration/catalog';
import { writeFileSync } from 'node:fs';
writeFileSync('/tmp/claude-0/allcontent.json', JSON.stringify({ CAMPS, PUZZLES, DOMAINS, TRIALS, STATUES }));
