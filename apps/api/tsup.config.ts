import { defineConfig, type Options } from 'tsup';

const shared: Options = {
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  splitting: false,
  dts: false,
};

export default defineConfig([
  {
    ...shared,
    entry: {
      server: 'src/main.ts',
      'bootstrap-admin': 'src/scripts/bootstrap-admin.ts',
      'verify-indexes': 'src/scripts/verify-indexes.ts',
      'apply-indexes': 'src/scripts/apply-indexes.ts',
      'dev-db': 'src/scripts/dev-db.ts',
    },
    clean: true,
    noExternal: [/^@manage\//],
  },
  {
    // The Vercel function has to be self-contained. pnpm hoists dependencies to
    // the repository root, which sits outside the API project's root directory,
    // so a traced-but-external `node_modules` import can be missing from the
    // deployed function bundle. Inlining every dependency removes the
    // platform's module resolution from the equation.
    ...shared,
    entry: { serverless: 'src/app.ts' },
    clean: false,
    noExternal: [/.*/],
  },
]);
