const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
process.env.NODE_ENV = 'production';
require('@expo/env').loadProjectEnv(root, { silent: true });
const env = { ...process.env };
if (!env.EXPO_PUBLIC_SUPABASE_URL?.startsWith('https://') || !env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
  console.error('Release requires the HTTPS Supabase URL and public publishable key. Values are not logged.');
  process.exit(1);
}
if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT && process.platform === 'win32' && env.LOCALAPPDATA) {
  const sdk = path.join(env.LOCALAPPDATA, 'Android', 'Sdk');
  if (fs.existsSync(sdk)) env.ANDROID_HOME = sdk;
}
const android = path.join(root, 'android');
if (!fs.existsSync(path.join(android, 'app/src/release/AndroidManifest.xml')) ||
    !fs.readFileSync(path.join(android, 'app/build.gradle'), 'utf8').includes('// SmartPantry release signing (environment only).')) {
  console.error('Run npm run android:prepare before the release build to apply the tracked release plugin.');
  process.exit(1);
}
if (!env.SMARTPANTRY_UPLOAD_STORE_FILE) console.warn('No upload keystore configured: artifacts will be UNSIGNED and cannot be installed or published as-is.');
const windows = process.platform === 'win32';
const result = spawnSync(windows ? (env.ComSpec || 'cmd.exe') : './gradlew', windows
  ? ['/d', '/s', '/c', 'gradlew.bat assembleRelease bundleRelease --console=plain']
  : ['assembleRelease', 'bundleRelease', '--console=plain'], { cwd: android, env, stdio: 'inherit' });
if (result.error) console.error('Could not launch Gradle. Check Java and Android SDK setup.');
process.exit(result.status ?? 1);
