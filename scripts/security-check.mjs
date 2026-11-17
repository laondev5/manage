#!/usr/bin/env node
// First-party secrets and client-boundary check. Not a substitute for a review.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const skipDirs = new Set([
  'node_modules',
  'dist',
  '.next',
  '.expo',
  '.git',
  '.data',
  'coverage',
  'android',
  'ios',
]);
const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.env',
  '.example',
  '.css',
  '.html',
]);
const serverOnlyPackages = ['@manage/database', '@manage/domain'];
const clientRoots = [join('apps', 'web', 'src'), join('apps', 'mobile', 'src')];

const findings = [];
const warnings = [];

function report(level, file, line, message) {
  const entry = { file, line, message };
  if (level === 'error') findings.push(entry);
  else warnings.push(entry);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      await walk(join(directory, entry.name));
      continue;
    }
    if (!entry.isFile()) continue;
    const full = join(directory, entry.name);
    const extension = entry.name.startsWith('.env') ? '.env' : entry.name.slice(entry.name.lastIndexOf('.'));
    if (!textExtensions.has(extension)) continue;
    if (full === resolve(import.meta.dirname, 'security-check.mjs')) continue;
    if (full.endsWith(join('pnpm-lock.yaml'))) continue;

    let content;
    try {
      if ((await stat(full)).size > 2_000_000) continue;
      content = await readFile(full, 'utf8');
    } catch {
      continue;
    }
    inspect(full, content);
  }
}

function isClientRoot(file) {
  const rel = relative(root, file);
  return clientRoots.some((base) => rel.startsWith(`${base}${sep}`));
}

function inspect(file, content) {
  const rel = relative(root, file).split(sep).join('/');
  const lines = content.split('\n');
  const isExample = rel.endsWith('.env.example');
  const isDoc = rel.startsWith('docs/') || rel.endsWith('.md');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE_KEY)|EXPO_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE_KEY)/.test(line)) {
      report('error', rel, lineNumber, 'A secret-like value is exposed through a public client variable.');
    }

    if (
      !isExample &&
      !isDoc &&
      /mongodb(\+srv)?:\/\/[^\s/'"]+:[^\s/'"]+@/.test(line)
    ) {
      report('error', rel, lineNumber, 'A MongoDB URI with embedded credentials is committed in code.');
    }

    if (isClientRoot(file) && serverOnlyPackages.some((name) => line.includes(`from '${name}'`) || line.includes(`from "${name}"`))) {
      report('error', rel, lineNumber, 'Server-only package imported from client code.');
    }

    if (!isDoc && line.includes('dangerouslySetInnerHTML')) {
      report('error', rel, lineNumber, 'dangerouslySetInnerHTML needs an explicit review.');
    }
  });

  if (isClientRoot(file) && /require\(['"]@manage\/(database|domain)['"]\)/.test(content)) {
    report('error', rel, 0, 'Server-only package required from client code.');
  }
}

await walk(root);

for (const file of ['.env', 'apps/web/.env', 'apps/mobile/.env']) {
  try {
    await stat(join(root, file));
    warnings.push({
      file,
      line: 0,
      message: 'Local secrets file exists. Keep it untracked; only .env.example belongs in the repo.',
    });
  } catch {
    // Not present.
  }
}

const format = (entry) =>
  `  ${entry.file}${entry.line ? `:${entry.line}` : ''} — ${entry.message}`;

if (warnings.length) {
  console.log('Security check warnings:');
  for (const entry of warnings) console.log(format(entry));
  console.log('');
}

if (findings.length) {
  console.error(`Security check failed with ${findings.length} finding(s):`);
  for (const entry of findings) console.error(format(entry));
  process.exit(1);
}

console.log(`Security check passed (${warnings.length} warning(s)).`);
