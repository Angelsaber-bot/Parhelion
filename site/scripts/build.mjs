// Builds the whole website into site/dist: homepage + Arena + World + local Colyseus server.
//   site/dist/public   static site (deployed to Cloudflare Pages as-is)
//   site/dist/server.cjs  one-port local server used by the launcher
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.dirname(site);
const dist = path.join(site, 'dist');
const pub = path.join(dist, 'public');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function filesBelow(dir, prefix = '') {
  const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1);
  const result = [];
  for (const entry of entries) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await filesBelow(path.join(dir, entry.name), name + '/'));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`Build input must not contain symbolic links: ${path.join(dir, entry.name)}`);
  }
  return result;
}

async function thirdPartyNotices() {
  const notices = new Map();
  async function inspectModules(directory) {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const item of entries) {
      if (!item.isDirectory() || item.name.startsWith('.')) continue;
      const folder = path.join(directory, item.name);
      if (item.name.startsWith('@')) { await inspectModules(folder); continue; }
      let pkg;
      try { pkg = JSON.parse(await fs.readFile(path.join(folder, 'package.json'), 'utf8')); } catch { continue; }
      const id = `${pkg.name}@${pkg.version}`;
      if (!notices.has(id)) {
        const licenseFiles = (await fs.readdir(folder)).filter(name => /^(license|licence|notice|copying|copyright)(\.|$|-)/i.test(name)).sort();
        let content = `${id}\nLicense declaration: ${typeof pkg.license === 'object' ? JSON.stringify(pkg.license) : pkg.license ?? 'not declared'}\n`;
        for (const name of licenseFiles) {
          const file = path.join(folder, name);
          if ((await fs.stat(file)).isFile()) content += `\n--- ${name} ---\n${await fs.readFile(file, 'utf8')}\n`;
        }
        notices.set(id, content);
      }
      await inspectModules(path.join(folder, 'node_modules'));
    }
  }
  for (const app of ['arena-game', 'world']) await inspectModules(path.join(repo, app, 'node_modules'));
  const original = await fs.readFile(path.join(repo, 'arena/THIRD_PARTY_NOTICES.md'), 'utf8');
  return 'Parhelion website — third-party notices\n\nThe bundle uses Colyseus, Three.js, Express, ws and their dependencies.\nThis file also includes installed build-tool notices; inclusion does not imply every package is shipped as executable code.\n\n' + original + '\n\n' + [...notices].sort(([a], [b]) => a < b ? -1 : 1).map(([, text]) => '='.repeat(72) + '\n' + text).join('\n');
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Building requires Node.js 22 or newer.');
  for (const app of ['arena-game', 'world']) {
    try { await fs.access(path.join(repo, app, 'node_modules')); }
    catch { throw new Error(`Missing ${app} dependencies. Run npm ci --prefix ${app} first.`); }
    const result = spawnSync(npm, ['run', 'build'], { cwd: path.join(repo, app), stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${app} build failed (exit ${result.status}).`);
  }
  const { build } = await import('../../arena-game/node_modules/esbuild/lib/main.js');
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(pub, { recursive: true });
  await fs.cp(path.join(repo, 'arena-game/dist'), path.join(pub, 'arena'), { recursive: true });
  await fs.cp(path.join(repo, 'world/dist'), path.join(pub, 'world'), { recursive: true });

  // Homepage: site/web is served at /site/, its index.html at /.
  await fs.cp(path.join(site, 'web'), path.join(pub, 'site'), { recursive: true, filter: (file) => !file.endsWith('.ts') && !path.basename(file).startsWith('.') });
  await fs.rename(path.join(pub, 'site/index.html'), path.join(pub, 'index.html'));
  // Language toggle for the homepage, bundled from shared-client so it tracks the game dictionary.
  await build({ entryPoints: [path.join(site, 'web/home.ts')], outfile: path.join(pub, 'site/home-language.js'), bundle: true, format: 'esm', target: 'es2022', minify: true, logLevel: 'warning' });

  // Static home link for both games, so the public (no local server) site has it too.
  const homeNav = '<link rel="stylesheet" href="/site/nav.css"><script type="module" src="/site/home-nav.js"></script>';
  for (const app of ['arena', 'world']) {
    const page = path.join(pub, app, 'index.html');
    const html = await fs.readFile(page, 'utf8');
    if (!html.includes('</body>')) throw new Error(`${app}/index.html has no </body> for the home link.`);
    await fs.writeFile(page, html.replace('</body>', `${homeNav}</body>`));
  }

  await build({
    absWorkingDir: site, entryPoints: ['scripts/server.ts'], outfile: 'dist/server.cjs',
    bundle: true, platform: 'node', format: 'cjs', target: 'node22',
    nodePaths: [path.join(repo, 'arena-game/node_modules')], legalComments: 'linked', logLevel: 'info',
  });
  await fs.writeFile(path.join(dist, 'THIRD_PARTY_NOTICES.txt'), await thirdPartyNotices());
  const hashes = {};
  const hash = createHash('sha256');
  for (const name of await filesBelow(dist)) {
    const digest = createHash('sha256').update(await fs.readFile(path.join(dist, name))).digest('hex');
    hashes[name] = digest;
    hash.update(name + '\0' + digest + '\n');
  }
  const buildId = hash.digest('hex');
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout?.trim() || 'unknown';
  await fs.writeFile(path.join(dist, 'build.json'), JSON.stringify({ schema: 1, commit, buildId, node: '>=22', files: hashes }, null, 2) + '\n');
  console.log(`\nBuilt Parhelion ${buildId.slice(0, 12)} → site/dist`);
}

void main().catch(error => { console.error(`Build failed: ${error.message}`); process.exitCode = 1; });
