const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const signingMarker = '// SmartPantry release signing (environment only).';
function configureSigning(contents) {
  if (contents.includes(signingMarker)) return contents;
  if (!/android\s*\{/.test(contents) || !/signingConfigs\s*\{/.test(contents) || !/release\s*\{[\s\S]*?signingConfig signingConfigs\.debug/.test(contents)) {
    throw new Error('Android signing template changed; review release signing before building.');
  }
  const declarations = `${signingMarker}
def smartPantrySigning = [
    storeFile: System.getenv('SMARTPANTRY_UPLOAD_STORE_FILE'),
    storePassword: System.getenv('SMARTPANTRY_UPLOAD_STORE_PASSWORD'),
    keyAlias: System.getenv('SMARTPANTRY_UPLOAD_KEY_ALIAS'),
    keyPassword: System.getenv('SMARTPANTRY_UPLOAD_KEY_PASSWORD')
]
def smartPantrySigningConfigured = smartPantrySigning.values().every { it }
if (smartPantrySigning.values().any { it } && !smartPantrySigningConfigured) {
    throw new GradleException('Supply all four SMARTPANTRY_UPLOAD signing environment variables, or none for unsigned verification.')
}

`;
  return contents.replace(/(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig = smartPantrySigningConfigured ? signingConfigs.release : null')
    .replace(/android\s*\{/, `${declarations}android {`)
    .replace(/signingConfigs\s*\{/, `signingConfigs {
        if (smartPantrySigningConfigured) {
            release {
                storeFile file(smartPantrySigning.storeFile)
                storePassword smartPantrySigning.storePassword
                keyAlias smartPantrySigning.keyAlias
                keyPassword smartPantrySigning.keyPassword
            }
        }`);
}

const releaseManifest = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove" />
  <application android:usesCleartextTraffic="false" tools:replace="android:usesCleartextTraffic" />
</manifest>
`;

function withReleaseAndroid(config) {
  config = withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('Review SmartPantry signing for Kotlin Gradle.');
    mod.modResults.contents = configureSigning(mod.modResults.contents);
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/release');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'AndroidManifest.xml'), releaseManifest);
    return mod;
  }]);
}
module.exports = withReleaseAndroid;
module.exports.configureSigning = configureSigning;
module.exports.releaseManifest = releaseManifest;
