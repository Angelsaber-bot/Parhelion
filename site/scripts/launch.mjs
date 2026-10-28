import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { APP_ID, projectId } from './http.mjs';

export const DEFAULT_PORT = 4173;
export function portsFrom(value = String(DEFAULT_PORT)) {
  if (!/^\d+$/.test(value)) throw new Error('PARHELION_PORT 必须是 1024–65535 之间的整数。');
  const first = Number(value);
  if (first < 1024 || first > 65535) throw new Error('PARHELION_PORT 必须是 1024–65535 之间的整数。');
  return Array.from({ length: Math.min(20, 65536 - first) }, (_, i) => first + i);
}
export function probe(port) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/__parhelion/health', timeout: 350 }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; if (text.length > 4096) req.destroy(); });
      res.on('end', () => { try { resolve(res.statusCode === 200 ? JSON.parse(text) : null); } catch { resolve(null); } });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}
export function openBrowser(url) {
  if (process.env.PARHELION_NO_OPEN === '1') return;
  if (process.platform !== 'darwin') { console.log(`请在浏览器打开：${url}`); return; }
  const open = spawn('/usr/bin/open', [url], { stdio: 'ignore' });
  open.once('error', () => console.log(`未能自动打开浏览器，请手动打开：${url}`));
  open.once('exit', (code) => { if (code) console.log(`未能自动打开浏览器，请手动打开：${url}`); });
}
function startChild(root, port) {
  const child = fork(path.join(root, 'dist', 'server.cjs'), [root, String(port)], {
    cwd: root, stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); fn(value); };
    const timer = setTimeout(() => { child.kill('SIGTERM'); finish(reject, new Error('本地服务器启动超时，请查看上方错误。')); }, 20000);
    child.on('error', (e) => finish(reject, e));
    child.on('message', (message) => {
      if (message?.event === 'ready') finish(resolve, { child, port });
      if (message?.event === 'error') {
        const error = Object.assign(new Error(message.message), { code: message.code });
        finish(reject, error);
      }
    });
    child.once('exit', (code, signal) => finish(reject, Object.assign(new Error(`服务器退出（${signal ?? code}），请查看上方错误。`), { code: code === 20 ? 'EADDRINUSE' : 'START_ERROR' })));
  });
}
export async function launch({ root = fileURLToPath(new URL('..', import.meta.url)), ports = portsFrom(process.env.PARHELION_PORT), browser = true } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('需要 Node.js 22 或更新版本；建议安装 Node.js 24 LTS。不会自动安装任何依赖。');
  root = await fs.realpath(root);
  let build;
  try {
    build = JSON.parse(await fs.readFile(path.join(root, 'dist/build.json'), 'utf8'));
    for (const file of ['dist/server.cjs', 'dist/public/index.html', 'dist/public/arena/index.html', 'dist/public/world/index.html']) await fs.access(path.join(root, file));
  } catch { throw new Error('预构建网站文件缺失：先在 site 目录运行 npm run build。'); }
  const id = projectId(root);
  async function record(port, pid) {
    const state = { app: APP_ID, projectId: id, buildId: build.buildId, port, pid };
    const temporary = path.join(root, `.parhelion-launch-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`);
    try {
      await fs.writeFile(temporary, JSON.stringify(state) + '\n', { flag: 'wx', mode: 0o600 });
      await fs.rename(temporary, path.join(root, '.parhelion-launch.json'));
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => {});
      throw new Error(`无法记录启动状态；请把完整文件夹移到可写位置后启动：${error.message}`);
    }
  }
  const isOurs = (health) => health?.app === APP_ID && health.projectId === id && health.buildId === build.buildId && health.ready === true;
  const found = await Promise.all(ports.map(async (port) => ({ port, health: await probe(port) })));
  const reused = found.find(({ health }) => isOurs(health));
  if (found.some(({health}) => health?.app === APP_ID && health.projectId === id && health.buildId !== build.buildId)) console.log('检测到同目录的旧版服务；不会复用或终止它。请关闭旧启动终端，再使用本次新地址。');
  if (reused) {
    const url = `http://127.0.0.1:${reused.port}/`;
    console.log(`Parhelion 已在运行，复用原窗口的服务器：${url}`);
    if (browser) openBrowser(url);
    return { url, port: reused.port, reused: true, child: null };
  }
  for (const port of ports) {
    try {
      const { child } = await startChild(root, port);
      const health = await probe(port);
      if (!isOurs(health)) { child.kill('SIGTERM'); throw new Error('服务器健康检查失败，已停止本次启动的进程。'); }
      try { await record(port, child.pid); } catch (error) { child.kill('SIGTERM'); throw error; }
      child.once('exit', async () => {
        try { const stateFile = path.join(root, '.parhelion-launch.json'); const current = JSON.parse(await fs.readFile(stateFile, 'utf8')); if (current.pid === child.pid) await fs.rm(stateFile, { force: true }); } catch { /* Already removed or replaced. */ }
      });
      const url = `http://127.0.0.1:${port}/`;
      console.log(`\nParhelion 已启动：${url}\nArena 联机服务与网站共用此地址（仅本机）。\n保留本终端窗口；按 Ctrl+C 停止。再次双击将复用，不会重复开启。\n`);
      if (browser) openBrowser(url);
      return { url, port, reused: false, child };
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      // Concurrent double-click: the other instance may have just won this port.
      const health = await probe(port);
      if (isOurs(health)) {
        const url = `http://127.0.0.1:${port}/`;
        console.log(`Parhelion 已在运行：${url}`); if (browser) openBrowser(url);
        return { url, port, reused: true, child: null };
      }
      console.log(`端口 ${port} 已占用，保留原进程并尝试下一个端口。`);
    }
  }
  throw new Error(`端口 ${ports[0]}–${ports.at(-1)} 均已占用。未停止任何其他程序；可设置 PARHELION_PORT 选择其他端口。`);
}

async function main() {
  const result = await launch();
  if (!result.child) return;
  const child = result.child;
  let stopping = false;
  const stop = () => { stopping = true; child.kill('SIGTERM'); };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, stop);
  const code = await new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  if (!stopping && code !== 0) throw new Error(`本地服务器意外退出（${code}）。请重新双击启动，或查看上方错误。`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(`\n启动失败：${e.message}\n`); process.exitCode = 1; });
