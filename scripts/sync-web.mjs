// Copies the static PWA into ./www so Capacitor can bundle it into the Android
// app. The web source stays where it is; www/ is a throwaway build folder
// (gitignored). The APK carries every file, so it works with no hosting and no
// network. sw.js is left out: inside the app the files are already local.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

const INCLUDE = ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons'];

if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const item of INCLUDE) {
  const src = join(root, item);
  if (existsSync(src)) {
    cpSync(src, join(www, item), { recursive: true });
    console.log(`  copied ${item}`);
  } else {
    console.warn(`  (skipped missing ${item})`);
  }
}
console.log('Web assets synced to www/');
