import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 8787;
const base = `http://127.0.0.1:${port}`;
const scratch = `${root}/.scratch/training`;
mkdirSync(`${scratch}/registry`, { recursive: true });

const worker = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--test-scheduled',
  '--ip', '127.0.0.1', '--port', String(port), '--persist-to', `${scratch}/state`, '-c', 'worker/wrangler.toml'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_REGISTRY_PATH: `${scratch}/registry`, WRANGLER_LOG_PATH: `${scratch}/wrangler.log`, WRANGLER_SEND_METRICS: 'false' },
});

let timer;
function stop() {
  clearInterval(timer);
  if (worker.exitCode === null && !worker.killed) worker.kill('SIGTERM');
}
worker.on('exit', code => { clearInterval(timer); process.exitCode = code ?? 0; });
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

async function selfPlay() {
  try {
    const url = new URL('/__scheduled', base);
    url.searchParams.set('cron', '*/5 * * * *');
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (error) { console.error('Arena training self-play:', error.message); }
}

for (let attempt = 0; worker.exitCode === null && !worker.killed && attempt < 40; attempt++) {
  try {
    const status = await fetch(`${base}/training/status`, { signal: AbortSignal.timeout(650) });
    if (status.ok && (await status.json()).shadow === true) {
      console.log(`Arena training status: ${base}/training/status`);
      await selfPlay();
      if (worker.exitCode === null && !worker.killed) timer = setInterval(selfPlay, 5 * 60 * 1000);
      break;
    }
  } catch { /* wait for the local Worker */ }
  await new Promise(resolve => setTimeout(resolve, 500));
}
