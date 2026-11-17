import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { worker: 'src/index.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: false,
  noExternal: [/^@manage\//],
});
