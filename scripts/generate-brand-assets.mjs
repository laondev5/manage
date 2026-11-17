/**
 * Generates every derived brand asset from the master `logo.png`:
 *   apps/mobile/assets/*   app icon, adaptive icon, splash tile, in-app logo
 *   apps/web/public/brand/*   console logo, light logo, mark, mark tile
 *   apps/web/src/app/*        favicon, Apple icon, Open Graph image
 *
 * Run after changing logo.png: node scripts/generate-brand-assets.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'logo.png');

const CANVAS = '#F5F7FB';
const NAVY = '#101D35';
const COBALT = '#2457D6';

// Alpha bounds measured from the master file (2172x724).
const MARK = { left: 145, top: 148, width: 443, height: 449 };
const LOCKUP = { left: 145, top: 148, width: 1900, height: 449 };

const out = (path) => resolve(root, path);
const ensure = async (file) => mkdir(dirname(file), { recursive: true });

async function mark() {
  return sharp(source).extract(MARK).png().toBuffer();
}

async function lockup() {
  return sharp(source).extract(LOCKUP).png().toBuffer();
}

async function roundedTile(size, radius) {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#FFFFFF"/>
     </svg>`,
  );
  return sharp(svg).png().toBuffer();
}

async function onCanvas(size, markWidth, { background = CANVAS, radius = 0 } = {}) {
  const markHeight = Math.round((markWidth * MARK.height) / MARK.width);
  const scaled = await sharp(await mark()).resize({ width: markWidth }).png().toBuffer();
  const base = radius
    ? await roundedTile(size, radius)
    : await sharp({
        create: { width: size, height: size, channels: 4, background },
      })
        .png()
        .toBuffer();
  return sharp(base)
    .composite([
      {
        input: scaled,
        left: Math.round((size - markWidth) / 2),
        top: Math.round((size - markHeight) / 2),
      },
    ])
    .png()
    .toBuffer();
}

/** Master lockup with every non-blue pixel repainted white, for navy surfaces. */
async function lightLockup(width) {
  const trimmed = await sharp(await lockup()).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = trimmed;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const b = data[i + 2];
    if (b - r < 60) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function main() {
  const mobile = out('apps/mobile/assets');
  const brand = out('apps/web/public/brand');
  const webApp = out('apps/web/src/app');

  await ensure(resolve(mobile, 'icon.png'));
  await ensure(resolve(brand, 'logo.png'));
  await ensure(resolve(webApp, 'icon.png'));

  await writeFile(resolve(mobile, 'logo.png'), await sharp(await lockup()).resize({ width: 1600 }).png().toBuffer());
  await writeFile(resolve(mobile, 'logo-light.png'), await lightLockup(1200));
  await writeFile(resolve(mobile, 'mark.png'), await sharp(await mark()).resize({ width: 512 }).png().toBuffer());
  await writeFile(resolve(mobile, 'icon.png'), await onCanvas(1024, 604));
  await writeFile(
    resolve(mobile, 'adaptive-icon.png'),
    await onCanvas(1024, 524, { background: { r: 0, g: 0, b: 0, alpha: 0 } }),
  );
  await writeFile(resolve(mobile, 'favicon.png'), await onCanvas(64, 40));

  await writeFile(resolve(brand, 'logo.png'), await sharp(await lockup()).resize({ width: 1200 }).png().toBuffer());
  await writeFile(resolve(brand, 'logo-light.png'), await lightLockup(1200));
  await writeFile(resolve(brand, 'mark.png'), await sharp(await mark()).resize({ width: 512 }).png().toBuffer());
  await writeFile(resolve(brand, 'mark-tile.png'), await onCanvas(512, 278, { radius: 116 }));

  await writeFile(resolve(webApp, 'icon.png'), await onCanvas(512, 302));
  await writeFile(resolve(webApp, 'apple-icon.png'), await onCanvas(180, 106));

  const ogLockup = await lightLockup(620);
  const ogTile = await onCanvas(232, 130, { radius: 52 });
  const og = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <defs>
        <radialGradient id="glow" cx="18%" cy="8%" r="72%">
          <stop offset="0%" stop-color="${COBALT}" stop-opacity="0.42"/>
          <stop offset="100%" stop-color="${COBALT}" stop-opacity="0"/>
        </radialGradient>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke="#FFFFFF" stroke-opacity="0.05"/>
        </pattern>
      </defs>
      <rect width="1200" height="630" fill="${NAVY}"/>
      <rect width="1200" height="630" fill="url(#grid)"/>
      <rect width="1200" height="630" fill="url(#glow)"/>
      <text x="96" y="118" font-family="Helvetica, Arial, sans-serif" font-size="19" font-weight="bold" letter-spacing="4" fill="#8FB4FF">WORKSITE ATTENDANCE</text>
      <text x="96" y="452" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="600" fill="#FFFFFF">Know who is on site,</text>
      <text x="96" y="506" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="600" fill="#FFFFFF">and what happened when they left.</text>
      <text x="96" y="566" font-family="Helvetica, Arial, sans-serif" font-size="21" fill="#9FB0CB">Invitation-only access · server-verified presence · audited decisions</text>
    </svg>`,
  );

  await writeFile(
    resolve(webApp, 'opengraph-image.png'),
    await sharp(og)
      .composite([
        { input: ogTile, left: 96, top: 178 },
        { input: ogLockup, left: 360, top: 240 },
      ])
      .png()
      .toBuffer(),
  );

  console.log('Brand assets written.');
}

await main();
