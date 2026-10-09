// Builds the Android APK with Gradle and copies it to dist/. Run after the web
// assets are synced (the npm scripts do sync-web + cap sync first).
//
//   node scripts/build-apk.mjs            release build, signed with the key in
//                                         ~/.android/shoe-school-signing.properties
//                                         -> dist/shoe-school.apk (the one to share)
//   node scripts/build-apk.mjs --debug    debug build -> dist/shoe-school-debug.apk
//
// A release build is checked with apksigner before it is copied: it must be
// signed and must not be debuggable.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
const debug = process.argv.includes('--debug');
const win = process.platform === 'win32';
const gradlew = win ? '.\\gradlew.bat' : './gradlew';

if (!debug && !existsSync(join(homedir(), '.android', 'shoe-school-signing.properties'))) {
  console.error('No release key: ~/.android/shoe-school-signing.properties is missing.\n'
    + 'Restore it (and shoe-school-release.jks) from your backup, or build with --debug.');
  process.exit(1);
}

const task = debug ? 'assembleDebug' : 'assembleRelease';
console.log(`Building ${debug ? 'debug' : 'release'} APK (Gradle ${task})…`);
const res = spawnSync(`${gradlew} ${task}`, { cwd: android, stdio: 'inherit', shell: true });
if (res.status !== 0) {
  console.error(`\nGradle build failed (exit ${res.status}).`);
  process.exit(res.status || 1);
}

const kind = debug ? 'debug' : 'release';
const apk = join(android, 'app', 'build', 'outputs', 'apk', kind, `app-${kind}.apk`);
if (!existsSync(apk)) {
  console.error(`\nBuild finished but ${apk} is missing (an unsigned release is named app-release-unsigned.apk).`);
  process.exit(1);
}

if (!debug) {
  // apksigner from the newest installed build-tools
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(homedir(), 'AppData', 'Local', 'Android', 'Sdk');
  const bt = join(sdk, 'build-tools');
  const versions = existsSync(bt) ? readdirSync(bt).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [];
  const apksigner = versions.length ? join(bt, versions[versions.length - 1], win ? 'apksigner.bat' : 'apksigner') : null;
  if (apksigner && existsSync(apksigner)) {
    const v = spawnSync(`"${apksigner}" verify --print-certs "${apk}"`, { shell: true, encoding: 'utf8' });
    if (v.status !== 0) { console.error(`apksigner verify failed:\n${v.stdout}${v.stderr}`); process.exit(1); }
    const signer = (v.stdout.match(/certificate DN: (.*)/) || [])[1];
    console.log(`Signed by: ${signer}`);
    if (/Android Debug/.test(signer || '')) { console.error('Release APK is signed with the DEBUG key. Refusing.'); process.exit(1); }
  } else {
    console.warn('(apksigner not found: signature not verified)');
  }
}

const outDir = join(root, 'dist');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, debug ? 'shoe-school-debug.apk' : 'shoe-school.apk');
copyFileSync(apk, out);
console.log(`\n✅ ${debug ? 'Debug' : 'Release'} APK:\n   ${out}`);
