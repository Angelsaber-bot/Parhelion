import { defineConfig } from 'vite';
import { NEURAL_POLICY_VERSION } from './shared/neuralPolicy.ts';
import { RULES_VERSION } from './shared/protocol.ts';

// The map data and art live in ../arena (authored separately); read them in place, never copy.
export default defineConfig({
  base: './',
  plugins: [{
    name: 'arena-policy-compatibility',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'neural-runtime.json',
        source: JSON.stringify({ rulesVersion: RULES_VERSION, neuralPolicyVersion: NEURAL_POLICY_VERSION }) });
    },
  }],
  assetsInclude: ['**/*.glb'],
  server: { host: true, port: 5174, fs: { allow: ['..'] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
