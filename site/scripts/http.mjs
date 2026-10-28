import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const APP_ID = 'parhelion-local-website';
export const projectId = (root) => createHash('sha256').update(root).digest('hex');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.gz': 'application/octet-stream' };

export function isLocalRequest(req) {
  // Defend against DNS rebinding as well as cross-site matchmaking requests.
  const host = req.headers.host;
  if (typeof host !== 'string' || !/^(127\.0\.0\.1|localhost|\[::1\])(?::[0-9]+)?$/.test(host)) return false;
  if (!req.headers.origin) return true;
  try { const origin = new URL(req.headers.origin); return origin.protocol === 'http:' && origin.host === host; } catch { return false; }
}
export function safePath(rawUrl) {
  const raw = rawUrl.split('?')[0];
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { return null; }
  if (!decoded.startsWith('/') || decoded.includes('\\') || /[\x00-\x1f\x7f]/.test(decoded)) return null;
  // Do not normalize traversal or allow double-encoded paths to reach disk.
  const segments = decoded.split('/');
  if (segments.some((s) => s.startsWith('.') || s.includes('%') || s === 'node_modules')) return null;
  return decoded;
}
export async function createStaticHandler(root, buildId = 'development') {
  const publicRoot = await fs.realpath(path.join(root, 'dist', 'public'));
  const id = projectId(await fs.realpath(root));
  const nav = '<link rel="stylesheet" href="/site/nav.css"><script type="module" src="/site/nav.js"></script>';
  return async (req, res) => {
    const reply = (status, text) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(req.method === 'HEAD' ? '' : text); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    if (!isLocalRequest(req)) return reply(403, 'Only local requests are allowed.');
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return reply(405, 'Method not allowed'); }
    const route = safePath(req.url ?? '/');
    if (!route) return reply(400, 'Invalid path');
    if (route === '/__parhelion/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(req.method === 'HEAD' ? '' : JSON.stringify({ app: APP_ID, projectId: id, buildId, ready: true }));
    }
    if (route === '/arena' || route === '/world') {
      const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      res.writeHead(308, { Location: `${route}/${query}` }); return res.end();
    }
    let relative;
    if (route === '/' || route === '/index.html') relative = 'index.html';
    else if (route.startsWith('/site/')) relative = route.slice(1);
    else if (route.startsWith('/arena/') || route.startsWith('/world/')) relative = route.slice(1) + (route.endsWith('/') ? 'index.html' : '');
    else return reply(404, 'Not found');
    const ext = path.extname(relative).toLowerCase();
    if (!TYPES[ext]) return reply(404, 'Not found');
    try {
      const file = await fs.realpath(path.join(publicRoot, relative));
      if (!file.startsWith(publicRoot + path.sep)) return reply(403, 'Forbidden');
      if (!(await fs.stat(file)).isFile()) return reply(404, 'Not found');
      let body = await fs.readFile(file);
      if (ext === '.html' && /^(arena|world)\/index\.html$/.test(relative)) body = Buffer.from(body.toString('utf8').replace('</body>', `${nav}</body>`));
      res.writeHead(200, { 'Content-Type': TYPES[ext], 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (e) { reply(e.code === 'ENOENT' || e.code === 'ENOTDIR' ? 404 : 500, 'File unavailable'); }
  };
}
