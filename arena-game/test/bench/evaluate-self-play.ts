// Compatibility entry for saved training commands and benchmark imports.
import { pathToFileURL } from 'node:url';
import { runSelfPlayEvaluation } from '../../scripts/evaluation/evaluate-self-play.ts';

export * from '../../scripts/evaluation/evaluate-self-play.ts';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSelfPlayEvaluation();
}
