import { resolve } from 'node:path';
import { config } from 'dotenv';

const root = resolve(process.cwd(), '..', '..');

export const workspaceRoot = root;

config({
  path: [resolve(process.cwd(), '.env'), resolve(root, '.env')],
  quiet: true,
});
