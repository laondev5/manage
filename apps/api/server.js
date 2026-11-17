// Vercel's Express preset loads this file. It deliberately imports compiled
// output: Vercel does not run a general application bundler for Node functions,
// so TypeScript sources behind pnpm workspace packages are not reliably
// transpiled. `pnpm build` runs tsup first and emits dist/serverless.js with
// @manage/* bundled in.
import app from './dist/serverless.js';

export default app;
