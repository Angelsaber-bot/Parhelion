import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { lstat, mkdir, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 8787;
const base = `http://127.0.0.1:${port}`;
const scratch = `${root}/.scratch/training`;
const captureCorpus = process.env.ARENA_NEURAL_CORPUS === '1';
const corpusDir = `${scratch}/corpus`;
const corpusToken = captureCorpus ? randomBytes(32).toString('hex') : null;
const corpusFiles = new Map();
const batchFile = /^\d+\-[a-f0-9]{32}-\d+\.json$/;
const maxFiles = 4096;
const day = 24 * 60 * 60 * 1000;
mkdirSync(`${scratch}/registry`, { recursive: true });

async function pruneCorpus() {
  const cutoff = Date.now() - 30 * day;
  const oldest = [...corpusFiles].sort((a, b) => a[1] - b[1]);
  for (const [name, at] of oldest) {
    if (at >= cutoff && corpusFiles.size <= maxFiles) break;
    await unlink(`${corpusDir}/${name}`).catch(error => { if (error.code !== 'ENOENT') throw error; });
    corpusFiles.delete(name);
  }
}

if (captureCorpus) {
  await mkdir(corpusDir, { recursive: true, mode: 0o700 });
  if (!(await lstat(corpusDir)).isDirectory()) throw new Error('Arena corpus must be a local directory.');
  for (const entry of await readdir(corpusDir, { withFileTypes: true })) {
    if (entry.isFile() && batchFile.test(entry.name)) corpusFiles.set(entry.name, (await lstat(`${corpusDir}/${entry.name}`)).mtimeMs);
  }
  await pruneCorpus();
}

const worker = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--test-scheduled',
  '--ip', '127.0.0.1', '--port', String(port), '--persist-to', `${scratch}/state`, '-c', 'worker/wrangler.toml',
  ...(corpusToken ? ['--var', `ARENA_NEURAL_CORPUS_TOKEN:${corpusToken}`] : [])], {
  cwd: root, stdio: corpusToken ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  env: { ...process.env, WRANGLER_REGISTRY_PATH: `${scratch}/registry`, WRANGLER_LOG_PATH: `${scratch}/wrangler.log`, WRANGLER_SEND_METRICS: 'false' },
});
if (corpusToken) {
  for (const [input, output] of [[worker.stdout, process.stdout], [worker.stderr, process.stderr]]) {
    createInterface({ input, terminal: false }).on('line', line => output.write(`${line.replaceAll(corpusToken, '[redacted]')}\n`));
  }
}

let timer, corpusTimer;
function stop() {
  clearInterval(timer);
  clearTimeout(corpusTimer);
  if (worker.exitCode === null && !worker.killed) worker.kill('SIGTERM');
}
worker.on('exit', code => { clearInterval(timer); clearTimeout(corpusTimer); process.exitCode = code ?? 0; });
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

async function storeCorpusBatch(batch) {
  const name = `${batch.rulesVersion}-${batch.capture}-${batch.sequence}.json`;
  if (!batchFile.test(name)) throw new Error('Invalid corpus batch identity.');
  if (corpusFiles.has(name)) return;
  const staging = `${corpusDir}/.${randomUUID()}.tmp`;
  try {
    await writeFile(staging, JSON.stringify(batch) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(staging, `${corpusDir}/${name}`);
  } finally { await unlink(staging).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  corpusFiles.set(name, Date.now());
}

let nextPrune = Date.now() + 60 * 60 * 1000;
async function collectCorpus() {
  const url = new URL('/training/corpus', base);
  const headers = { authorization: `Bearer ${corpusToken}` };
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { records } = await response.json();
    let through = 0;
    for (const { id, batch } of records) {
      if (!Number.isSafeInteger(id) || id <= through) throw new Error('Invalid corpus staging order.');
      await storeCorpusBatch(batch);
      through = id;
    }
    if (corpusFiles.size > maxFiles || Date.now() >= nextPrune) {
      await pruneCorpus();
      nextPrune = Date.now() + 60 * 60 * 1000;
    }
    if (through) {
      url.searchParams.set('through', String(through));
      const ack = await fetch(url, { method: 'DELETE', headers, signal: AbortSignal.timeout(4000) });
      if (!ack.ok) throw new Error(`Acknowledgement HTTP ${ack.status}`);
    }
  } catch (error) { console.error('Arena training corpus:', error.message); }
  if (worker.exitCode === null && !worker.killed) corpusTimer = setTimeout(collectCorpus, 1700);
}

for (let attempt = 0; worker.exitCode === null && !worker.killed && attempt < 40; attempt++) {
  try {
    const status = await fetch(`${base}/training/status`, { signal: AbortSignal.timeout(650) });
    if (status.ok && (await status.json()).shadow === true) {
      if (corpusToken) {
        const probe = await fetch(`${base}/training/corpus`, { headers: { authorization: `Bearer ${corpusToken}` }, signal: AbortSignal.timeout(650) });
        if (!probe.ok) throw new Error(`Corpus startup HTTP ${probe.status}`);
        console.log(`Arena training corpus: ${corpusDir}`);
        void collectCorpus();
      }
      console.log(`Arena training status: ${base}/training/status`);
      await selfPlay();
      if (worker.exitCode === null && !worker.killed) timer = setInterval(selfPlay, 5 * 60 * 1000);
      break;
    }
  } catch { /* wait for the local Worker */ }
  await new Promise(resolve => setTimeout(resolve, 500));
}
