import { defineConfig } from 'vite';

// The map data and art live in ../arena (authored separately); read them in place, never copy.
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  server: { host: true, port: 5174, fs: { allow: ['..'] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
