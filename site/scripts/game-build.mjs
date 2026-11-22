// Shared packaging steps used by the full site and the incremental Arena installer.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export async function addHomeNavigation(page) {
  const html = await fs.readFile(page, 'utf8');
  if (!html.includes('</body>')) throw new Error(`Missing </body> in ${page}`);
  const navigation = '<link rel="stylesheet" href="/site/nav.css"><script type="module" src="/site/home-nav.js"></script>';
  await fs.writeFile(page, html.replace('</body>', navigation + '</body>'));
}

export async function bundleLocalServer(outputDirectory) {
  const { build } = await import('../../arena-game/node_modules/esbuild/lib/main.js');
  return build({
    absWorkingDir: site,
    entryPoints: ['scripts/server.ts'],
    outfile: path.join(outputDirectory, 'server.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    nodePaths: [path.resolve(site, '../arena-game/node_modules')],
    legalComments: 'linked',
    logLevel: 'info',
  });
}
