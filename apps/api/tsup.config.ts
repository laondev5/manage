import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/main.ts',
    serverless: 'src/app.ts',
    'bootstrap-admin': 'src/scripts/bootstrap-admin.ts',
    'verify-indexes': 'src/scripts/verify-indexes.ts',
    'apply-indexes': 'src/scripts/apply-indexes.ts',
    'dev-db': 'src/scripts/dev-db.ts',
  },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: false,
  noExternal: [/^@manage\//],
});
