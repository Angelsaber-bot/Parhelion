// Run a private rendered Match. Only camera luminance and a history-reset bit reach the model.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  seconds: { type: 'string', default: '4' }, seed: { type: 'string', default: '7241' },
  map: { type: 'string', default: 'aster' }, smoke: { type: 'boolean' }, interactive: { type: 'boolean' },
} });
const seconds = Number(values.seconds), seed = Number(values.seed);
if (positionals.length !== 1 || !Number.isInteger(seconds) || seconds < 1 || seconds > 120 ||
    !Number.isSafeInteger(seed) || seed < 0 || seed > 0x7fffffff || !/^[a-z0-9-]{1,32}$/.test(values.map)) {
  throw Error('Usage: node tools/visual-audition.mjs visual.pt [--map aster] [--seconds 4] [--seed 7241] [--smoke] [--interactive]');
}
const root = fileURLToPath(new URL('../', import.meta.url)), weights = resolve(positionals[0]);
await access(weights);
const endpoint = '/' + randomUUID();
let browser, chrome, profile, actor, origin, busy = false, started = false;
const done = Promise.withResolvers();
const options = JSON.stringify({ map: values.map, seconds, seed, smoke: Boolean(values.smoke) });
const html = `<!doctype html><meta charset="utf-8"><title>Arena pixel policy audition</title>
<style>body{margin:0} canvas{display:block} pre{position:fixed;top:0;color:white;background:#1a1a1acc;z-index:1}</style>
<pre id="status">Loading Arena camera…</pre><script type="module">
const send = async (path, data) => {
  const r = await fetch(location.pathname + '/' + path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
  if(!r.ok) throw Error('Camera bridge returned ' + r.status);
  return r.json();
};
try {
  const {visualMatch} = await import('/tools/visual-match.ts');
  const {map, seconds, seed, smoke} = ${options};
  const result = await visualMatch(map,seconds,seed,smoke,frame => send('action',frame));
  document.querySelector('#status').textContent = JSON.stringify(result,null,2);
  await send('done',{result});
} catch(error) {
  document.querySelector('#status').textContent = String(error);
  await send('done',{error:String(error)});
}
</script>`;
let receive;
const plugin = { name: 'private-arena-visual-audition', configureServer(vite) {
  vite.middlewares.use(async (req, res, next) => {
    if (req.url !== endpoint && !req.url?.startsWith(endpoint + '/')) return next();
    const reply = (code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer' }); res.end(body); };
    if (req.method === 'GET' && req.url === endpoint && !started) {
      started = true;
      return reply(200, 'text/html; charset=utf-8', html);
    }
    if (!started || req.method !== 'POST' || req.headers.origin !== origin ||
        req.headers['content-type'] !== 'application/json' || busy) return reply(403, 'text/plain', 'Unavailable');
    busy = true;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4096) return reply(413, 'text/plain', 'Frame too large');
        chunks.push(chunk);
      }
      const frame = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (req.url === endpoint + '/done') {
        reply(200, 'application/json', 'true');
        if (typeof frame.error === 'string') done.reject(Error(frame.error));
        else if (Number.isInteger(frame.result?.decisions) && frame.result.decisions > 0 &&
            frame.result.appliedTicks > 0 && frame.result.ticks === seconds * 60) done.resolve(frame.result);
        else done.reject(Error('No completed visual match'));
        return;
      }
      if (req.url !== endpoint + '/action' || typeof frame.luminance !== 'string' ||
          !/^[A-Za-z0-9+/]{1536}$/.test(frame.luminance) || typeof frame.reset !== 'boolean') {
        return reply(400, 'text/plain', 'Invalid camera input');
      }
      actor.stdin.write(JSON.stringify({ luminance: frame.luminance, reset: frame.reset }) + '\n');
      const prediction = JSON.parse(await receive());
      if (!Array.isArray(prediction) || prediction.length !== 14 || !prediction.every(Number.isFinite)) {
        throw Error('Invalid visual policy output');
      }
      reply(200, 'application/json', JSON.stringify(prediction));
    } catch (e) {
      reply(500, 'text/plain', 'Visual audition failed');
      done.reject(e);
    } finally { busy = false; }
  });
} };
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0,
  hmr: false }, plugins: [plugin] });
try {
  actor = spawn(process.env.ARENA_NEURAL_PYTHON || 'python3', ['-u', 'tools/arena_vision.py', weights],
    { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] });
  const actorError = new Promise((_, reject) => actor.once('error', reject));
  const lines = createInterface({ input: actor.stdout })[Symbol.asyncIterator]();
  receive = async () => {
    const line = await Promise.race([lines.next(), actorError]);
    if (line.done) throw Error('Visual actor exited before replying');
    return line.value;
  };
  if (await receive() !== 'ready') throw Error('Visual actor did not initialize');
  await server.listen();
  origin = 'http://127.0.0.1:' + server.httpServer.address().port;
  const url = origin + endpoint;
  if (values.interactive) {
    console.log('Open the local Arena audition in a foreground browser:', url);
  } else if (process.env.CHROMIUM_EXECUTABLE) {
    profile = await mkdtemp(join(tmpdir(), 'arena-camera-'));
    chrome = spawn(process.env.CHROMIUM_EXECUTABLE, ['--headless', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--window-size=512,288', '--user-data-dir=' + profile, url],
    { stdio: ['ignore', 'ignore', 'inherit'] });
    chrome.once('error', done.reject);
    chrome.once('exit', (code, signal) => done.reject(Error('Chrome exited before the match finished: ' + (signal || code))));
  } else {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 384, height: 216 } });
    page.on('pageerror', error => done.reject(error));
    await page.goto(url);
  }
  const timeout = setTimeout(() => done.reject(Error('Visual audition timed out')), 300000);
  try { console.log(JSON.stringify(await done.promise, null, 2)); } finally { clearTimeout(timeout); }
} finally {
  actor?.stdin.end();
  actor?.kill();
  await browser?.close();
  if (chrome?.pid && chrome.exitCode === null && chrome.signalCode === null) {
    const exited = once(chrome, 'exit');
    chrome.kill();
    await exited;
  }
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 2 });
  await server.close();
}
