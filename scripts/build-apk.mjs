// Builds the debug APK with Gradle and reports where it landed. Run after the
// web assets are synced (npm run build:apk does sync-web + cap sync first).
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

console.log('Building debug APK (Gradle)…');
const res = spawnSync(gradlew, ['assembleDebug'], { cwd: android, stdio: 'inherit', shell: true });
if (res.status !== 0) {
  console.error(`\nGradle build failed (exit ${res.status}).`);
  process.exit(res.status || 1);
}
const apk = join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(apk)) {
  console.log('\n⚠️ Build finished but the APK is not at the expected path.');
  process.exit(1);
}
// A copy with a readable name next to the project, ready to send to a phone.
const outDir = join(root, 'dist');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'shoe-school.apk');
copyFileSync(apk, out);
console.log(`\n✅ APK built:\n   ${out}`);
