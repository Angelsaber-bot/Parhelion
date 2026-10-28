import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStaticHandler, safePath, isLocalRequest } from '../scripts/http.mjs';

const request = (port, url, method = 'GET', headers = {}) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port, path: url, method, headers }, (res) => { const parts = []; res.on('data', c => parts.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts).toString() })); });
  req.on('error', reject); req.end();
});
test('raw path validation blocks traversal, dotfiles, bad encoding and backslashes', () => {
  for (const route of ['/../README.md', '/%2e%2e/README.md', '/arena/%2e%2e/.env', '/arena/%252e%252e/foo', '/arena/%00.js', '/arena\\foo.js', '/arena/%5cfoo.js', '/site/.env', '/.git/config', '/site/node_modules/x.js', '/%xy']) assert.equal(safePath(route), null, route);
  assert.equal(safePath('/site/%E4%B8%AD%E6%96%87%20test.js?q=hi'), '/site/中文 test.js');
});
test('Host and Origin guard blocks remote rebinding and foreign origins', () => {
  assert.equal(isLocalRequest({ headers: { host: '127.0.0.1:4173', origin: 'http://127.0.0.1:4173' } }), true);
  for (const headers of [{ host: 'evil.example' }, { host: 'localhost.evil.example' }, { host: 'evil@localhost' }, { host: 'localhost:4173', origin: 'https://evil.example' }, { host: 'localhost:4173', origin: 'http://localhost:5000' }, { host: 'localhost', origin: 'null' }]) assert.equal(isLocalRequest({ headers }), false);
});
test('static routes, encoded Unicode, security, redirects, HEAD and nav injection', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'parhelion 安全 '));
  await fs.mkdir(path.join(root, 'dist/public/site'), { recursive: true });
  for (const dir of ['arena', 'world']) { await fs.mkdir(path.join(root, 'dist/public', dir)); await fs.writeFile(path.join(root, 'dist/public', dir, 'index.html'), '<body>game</body>'); }
  await fs.writeFile(path.join(root, 'dist/public/index.html'), 'home');
  await fs.writeFile(path.join(root, 'dist/public/site/中文 test.js'), '// unicode');
  await fs.writeFile(path.join(root, 'secret.js'), 'SECRET');
  await fs.symlink(path.join(root, 'secret.js'), path.join(root, 'dist/public/site/leak.js'));
  const handler = await createStaticHandler(root, 'test');
  const server = http.createServer((req,res) => void handler(req,res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  assert.equal((await request(port, '/')).body, 'home');
  for (const map of ['arena', 'world']) {
    const redirect = await request(port, `/${map}?low&x=1`); assert.equal(redirect.status, 308); assert.equal(redirect.headers.location, `/${map}/?low&x=1`);
    const page = await request(port, `/${map}/`); assert.equal(page.status, 200); assert.match(page.body, /\/site\/nav.js/);
  }
  assert.equal((await request(port, '/site/%E4%B8%AD%E6%96%87%20test.js')).body, '// unicode');
  assert.equal((await request(port, '/site/leak.js')).status, 403);
  for (const route of ['/.git/config','/.env','/arena/%2e%2e/.env','/%00.js','/node_modules/x']) assert.equal((await request(port, route)).status, 400, route);
  for (const route of ['/scripts/server.ts','/package.json','/arena/missing.js']) assert.equal((await request(port, route)).status, 404, route);
  assert.equal((await request(port, '/', 'HEAD')).body, '');
  assert.equal((await request(port, '/', 'POST')).status, 405);
  assert.equal((await request(port, '/', 'GET', { Host: 'evil.example' })).status, 403);
  assert.equal(JSON.parse((await request(port, '/__parhelion/health')).body).buildId, 'test');
});
