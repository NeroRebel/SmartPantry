const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { configureSigning, releaseManifest } = require('../plugins/with-release-android.cjs');
const { containsSecret } = require('../scripts/security-audit.cjs');
const config = require('../app.json').expo;

test('release identity and version remain consistent with package metadata', () => {
  assert.equal(config.name, 'SmartPantry'); assert.equal(config.scheme, 'smartpantry');
  assert.equal(config.android.package, 'com.nerorebel.smartpantry');
  assert.equal(config.version, '1.0.0'); assert.equal(config.version, require('../package.json').version);
  assert.ok(Number.isInteger(config.android.versionCode) && config.android.versionCode > 0);
  assert.equal(config.userInterfaceStyle, 'automatic'); assert.equal(config.android.allowBackup, false);
});

test('release blocks unneeded storage/audio permissions and overlay without removing camera or notification support', () => {
  for (const permission of ['RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO']) {
    assert.ok(config.android.blockedPermissions.includes(`android.permission.${permission}`));
  }
  assert.ok(!config.android.blockedPermissions.includes('android.permission.CAMERA'));
  assert.ok(!config.android.blockedPermissions.includes('android.permission.POST_NOTIFICATIONS'));
  assert.match(releaseManifest, /SYSTEM_ALERT_WINDOW" tools:node="remove"/);
  assert.match(releaseManifest, /usesCleartextTraffic="false"/);
  assert.ok(config.plugins.includes('expo-notifications'));
});

test('release signing never falls back to the debug key and plugin is idempotent', () => {
  const input = `android {
    signingConfigs { debug { storePassword 'android' } }
    buildTypes { debug { signingConfig signingConfigs.debug }
      release { signingConfig signingConfigs.debug }
    }
  }`;
  const output = configureSigning(input);
  assert.match(output, /debug \{ signingConfig signingConfigs.debug \}/);
  assert.match(output, /release \{ signingConfig = smartPantrySigningConfigured \? signingConfigs.release : null/);
  assert.match(output, /Supply all four SMARTPANTRY_UPLOAD/);
  assert.equal(configureSigning(output), output);
  assert.throws(() => configureSigning('android {}'), /template changed/);
});

test('configured launcher and splash PNG assets exist and have valid nonzero dimensions', () => {
  const paths = [config.icon, config.web.favicon, ...['foregroundImage', 'backgroundImage', 'monochromeImage'].map((key) => config.android.adaptiveIcon[key]), config.plugins.find((entry) => entry[0] === 'expo-splash-screen')[1].image];
  for (const name of paths) {
    const data = fs.readFileSync(path.resolve(__dirname, '..', name));
    assert.equal(data.subarray(1, 4).toString(), 'PNG');
    assert.ok(data.readUInt32BE(16) > 0 && data.readUInt32BE(20) > 0);
  }
});

test('credential scanner recognizes privileged/session tokens without returning their content', () => {
  assert.equal(containsSecret(`const key = '${'sb_secret_'}${'x'.repeat(28)}'`), true);
  const jwt = (role) => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'x'.repeat(32)].join('.');
  assert.equal(containsSecret(jwt('service_role')), true); assert.equal(containsSecret(jwt('authenticated')), true);
  assert.equal(containsSecret(jwt('anon')), false);
  assert.equal(containsSecret('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\nSUPABASE_SERVICE_ROLE_KEY is server-side only'), false);
});
