// Rasterizes icons/icon.svg into the PNGs the PWA manifest needs, and (without
// --web) the 1024² layers @capacitor/assets turns into every Android launcher
// icon density. Re-run after changing the icon art.
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'icons', 'icon.svg'));
const webOnly = process.argv.includes('--web');

// The maskable icon keeps the art inside the 80% safe zone on a full-bleed background.
const BG = '#0b3d27';
async function maskable(size) {
  const inner = Math.round(size * 0.8);
  const art = await sharp(svg).resize(inner, inner).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: 'center' }]).png();
}

console.log('Rasterizing PWA icons…');
await sharp(svg).resize(192, 192).png().toFile(join(root, 'icons', 'icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(join(root, 'icons', 'icon-512.png'));
await (await maskable(512)).toFile(join(root, 'icons', 'icon-maskable-512.png'));

if (!webOnly) {
  const assets = join(root, 'assets');
  mkdirSync(assets, { recursive: true });
  console.log('Rasterizing Android icon layers…');
  await sharp(svg).resize(1024, 1024).png().toFile(join(assets, 'icon-only.png'));
  await (await maskable(1024)).toFile(join(assets, 'icon-foreground.png'));
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png().toFile(join(assets, 'icon-background.png'));
  // Splash: the icon centred on the app's background colour (replaces Capacitor's logo).
  const splashArt = await sharp(svg).resize(640, 640).png().toBuffer();
  for (const name of ['splash.png', 'splash-dark.png']) {
    await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#0a1a13' } })
      .composite([{ input: splashArt, gravity: 'center' }]).png().toFile(join(assets, name));
  }
  console.log('Generating Android launcher icons…');
  const res = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['@capacitor/assets', 'generate', '--android'], { cwd: root, stdio: 'inherit', shell: true });
  process.exit(res.status || 0);
}
console.log('Done.');
