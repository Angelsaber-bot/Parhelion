import type { Plugin } from 'esbuild';

/**
 * Arena imports map thumbnails (`./assets/maps/*.jpg`) and map models (`*.glb?url`) the Vite way: each import is a
 * URL string. The DOM tests bundle Arena with esbuild, which has no loader for those files, so the whole bundle
 * failed. Here every such import becomes a module exporting its own path, which is all the menu code needs.
 */
export const arenaAssetStub: Plugin = {
  name: 'arena-asset-url-stub',
  setup(b) {
    b.onResolve({ filter: /\.(?:jpe?g|png|glb|gltf|ktx2|hdr)(?:\?url)?$/ }, args => ({ path: args.path, namespace: 'arena-asset-url' }));
    b.onLoad({ filter: /.*/, namespace: 'arena-asset-url' }, args => ({ contents: `export default ${JSON.stringify(`/stub/${args.path.replace(/^.*\//, '').replace(/\?url$/, '')}`)};`, loader: 'js' }));
  },
};

/**
 * Starting a match now waits for `prepareWorldHeroes()` (it fetches the shared hero models). The DOM tests forbid
 * network access, so for main.ts that import is a boundary like the scene and session: it resolves at once.
 * The lobby's 3D hero preview is a GPU boundary of the same kind (jsdom has no WebGL).
 */
export const arenaHeroStub: Plugin = {
  name: 'arena-world-hero-boundary',
  setup(b) {
    b.onResolve({ filter: /^\.\/(?:player\/worldHero|ui\/heroPreview)\.ts$/ }, args => args.importer.endsWith('/src/main.ts') ? { path: args.path, namespace: 'arena-hero-stub' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'arena-hero-stub' }, args => ({ loader: 'js', contents: args.path.includes('heroPreview')
      ? 'export class HeroPreview { constructor(host) { this.host = host; } choose() {} dispose() {} }'
      : 'export async function prepareWorldHeroes() {}' }));
  },
};
