# SmartPantry Release Readiness

Audit date: 2026-10-15. This document is a release checklist, not a claim that the
application has passed Play review or physical-device QA. Nothing was published,
no production backend was changed, and no production signing key was created.

## Identity and Configuration

| Setting | Value |
| --- | --- |
| Name / slug | SmartPantry / SmartPantry (existing slug retained) |
| Version / Android versionCode | 1.0.0 / 1 |
| Android applicationId / namespace | com.nerorebel.smartpantry |
| Native scheme / auth callback | smartpantry / smartpantry://auth/callback |
| Orientation / interface | portrait / automatic (app theme settings still apply) |
| Expo / React Native | SDK 57 / 0.86.3 |
| Android SDK / minimum / NDK | compile+target 36 / API 24 / 27.1.12297006 |
| Primary build path | local Gradle; no EAS migration/configuration |

Future releases: update `expo.version` in app.json and `version` in package.json
together. Increment app.json `android.versionCode` for every new Play upload.
Regenerate native config before building; do not change ignored native copies as
the source of truth. More/About already read the version from Expo Constants.

## Changes in This Pass

- Added explicit versionCode 1, retained version/package/scheme/orientation.
- Added the notifications config plugin; no FCM credentials or remote push added.
- Blocked unused broad storage/media and audio permissions in app.json.
- Disabled Android automatic backup of account/session caches; SQLite is not reset.
- Added a tracked release config plugin: removes SYSTEM_ALERT_WINDOW from release
  only, disables cleartext HTTP in release and replaces debug-key release signing
  with explicit environment-only signing or an unsigned verification artifact.
  Debug builds keep their normal debug key/Metro behavior.
- Applied only eight Expo-recommended compatible patches: @expo/ui 57.0.24,
  expo 57.0.29, auth-session 57.0.16, constants 57.0.22, linking 57.0.13,
  notifications 57.0.23, router 57.0.27, splash-screen 57.0.10.
- Added repeatable release/security commands and config/signing regression tests.
- Replaced starter README/MVP documentation and added factual data handling docs.
- No app UI, auth architecture, SQLite schema, local user rows or cloud schema changed.

## SmartPantry Branding Assets

All configured PNG paths exist and decode with nonzero dimensions:

| Asset | Dimensions |
| --- | --- |
| icon.png | 1024 x 1024 |
| android-icon-foreground.png | 1024 x 1024 |
| android-icon-background.png | 1024 x 1024 |
| android-icon-monochrome.png | 1024 x 1024 |
| splash-icon.png | 1024 x 1024 |
| favicon.png | 48 x 48 |

The five native assets now share a minimal orange pantry-and-leaf mark. The
launcher icon and warm-black background are opaque; foreground, white monochrome
mask and splash have true transparency. The adaptive symbol fits the central
66/108 safe circle. iOS now uses the same PNG instead of the old Expo Icon Composer
asset. Splash background is #0B0B0B with imageWidth 160.

Regenerate the five files with `powershell -NoProfile -ExecutionPolicy Bypass
-File scripts/generate-brand-assets.ps1` on Windows (System.Drawing; no extra
dependencies). Orange is #FF8A00. Geometry is shared across all exports.

The web favicon remains the existing Expo starter asset, outside this native asset
pass. Old unused `assets/expo.icon` sources remain unreferenced. Regenerate native
resources and rebuild: previously built APK/AAB artifacts still contain old art.
Verify launcher masks, themed icons, release splash and notification small-icon
appearance on a physical device before distribution.

## Permissions and Local Reminders

Expected release permissions: CAMERA, INTERNET, POST_NOTIFICATIONS,
RECEIVE_BOOT_COMPLETED and VIBRATE, plus any harmless platform/library-generated
normal permissions documented by the merged manifest. No microphone, location,
contacts, broad media/storage or overlay permission is intended in release.

The inspected merged manifest also contains ACCESS_NETWORK_STATE, WAKE_LOCK,
the app-private DYNAMIC_RECEIVER_NOT_EXPORTED permission, FCM RECEIVE and vendor
badge/install-referrer permissions inherited from Expo/AndroidX libraries. These
normal/library permissions do not imply remote push or tracking is configured.
No push token is requested. They were not removed by rewriting library manifests;
the requested dangerous permissions and release overlay restrictions are enforced.

`expo-camera` uses CameraView with audio recording disabled. Avatar selection uses
the system photo picker, not blanket library permission or camera capture. The
installed picker uses PickVisualMedia / ACTION_GET_CONTENT fallback.

Expiration reminders use the `expiration-reminders` Android channel and persisted
notification IDs. Permissions are requested through the existing service; denial
does not block CRUD. Create/edit/settings reschedule, delete/consume/waste cancel,
and account changes/sync reconcile notifications. Past 09:00 local reminder times
are skipped. The installed SDK falls back to inexact idle-safe alarms when exact
alarms are unavailable: **no exact-alarm permission** is requested, so delivery may
be delayed by Doze/vendor battery restrictions. Boot/package-replaced receivers
restore persisted native schedules. Force-stop behavior still needs phone testing.
No Expo Go, Expo push token, FCM project or remote push server is needed for local
reminders. Android 13+ permission/channel behavior must be tested in a signed build.

## Environment and Security

Only these mobile variables are supported:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Use the real production project's HTTPS URL and `sb_publishable_` key in ignored
`.env` or the build process environment. These public values are embedded in the
binary; RLS, not key secrecy, protects cloud data. The release runner validates
presence/type without printing values. Expo uses direct static dot notation.
`.env.example` is tracked and has empty names only; `.env*`, signing material and
APK/AAB outputs are ignored. Native folders are generated and ignored.

Never add service-role, SMTP or Edge admin credentials to mobile environment,
app.json, documentation, tests or JavaScript bundles. Existing intentional logs
are __DEV__-gated, with constant messages or validated SDK name/status fields.
No passwords, tokens, session payloads or full callback URLs are logged.

`npm run check:security` checks nonignored project files and reachable historical
text blobs for private keys, Supabase secret keys and session/service-role JWTs.
It prints only counts/file identifiers, never matches. This is a bounded pattern
audit, not proof that no possible kind of secret exists. Remote Git refs not present
locally and provider settings are outside its scope.

## Supabase Production Requirements

Confirm the intended production project before creating a binary:

- Auth email/Google providers enabled, operational SMTP and templates using the
  Supabase ConfirmationURL; email confirmation/recovery/secure email change as
  documented in [auth setup](auth-setup.md).
- Auth URL Configuration allowlist includes **smartpantry://auth/callback** exactly.
  All native signup/resend/recovery/email-change/OAuth flows reuse that architecture.
  Site URL must be an intentional controlled production HTTPS page if used for
  browser fallbacks, not leftover localhost. Native calls have explicit redirects.
- Existing four tables and timestamp triggers match [cloud sync](cloud-sync.md).
  Keep composite (user_id,id) ownership, tombstones and RLS. No SQL migration is
  required by this release pass.
- Private `avatars` bucket and owner-folder Storage policies match
  [avatar setup](avatar-setup.md). Signed URLs are temporary; Auth metadata remains
  the profile/avatar-path source of truth.
- `delete-account` function deployed. Run `supabase/verify-account-cascades.sql`
  against the actual target project before setting ACCOUNT_DELETE_CASCADE_VERIFIED.
  Confirm all four user_id foreign keys cascade from auth.users, including profiles.
- Hosted function server environment has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY;
  additional secret ACCOUNT_DELETE_CASCADE_VERIFIED=true is set only after catalog
  verification. These names/values are not Expo variables.

Deployment commands (operator action; not executed by this audit):

```powershell
npx supabase@latest secrets set ACCOUNT_DELETE_CASCADE_VERIFIED=true --project-ref YOUR_PROJECT_REF
npx supabase@latest functions deploy delete-account --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

Gateway verification is disabled intentionally in supabase/config.toml; the
handler requires Authorization and validates the JWT through Auth getUser(jwt).
It derives the UUID there, accepts only explicit DELETE confirmation, never trusts
a client user_id, removes only that user's avatar folder, then admin-deletes Auth.
Storage cleanup failure aborts deletion. Cloud confirmation precedes local cleanup;
local cache isolation, notification cancellation and pending-sync locks remain.
Storage/Auth cleanup is not one transaction; see the existing retry limitations.
No function was redeployed and no live cascade/RLS assertion was made in this pass.

## Google OAuth in the Release App

This is **browser-based Supabase OAuth**, not a native Google ID-token SDK. Keep
the Google **Web application** OAuth client in Supabase's Google provider, with
the project's `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` authorized
redirect in Google Cloud. Use the exact callback shown in the Supabase dashboard
if a custom Auth domain is configured. App redirect is smartpantry://auth/callback.

This implementation does **not** require adding an Android Google OAuth client or
SHA fingerprint just to change from debug to release signing. Do not add native
Google config speculatively. Check Google consent-screen publishing/test-user
restrictions and branding for intended recipients. Phone deep links must be opened
on the phone; clicking a mobile scheme on Windows cannot launch an Android emulator.
PKCE verifier/session handling and all existing callback routing are unchanged.

## Primary Build Procedure: Windows Local Gradle

Prerequisites: installed Node/npm, Java 17, Android SDK/build tools 36, NDK
27.1.12297006, accepted Android licenses and network access for dependencies.
The runner detects the usual Windows SDK folder if ANDROID_HOME is absent.
Alternatively set ANDROID_HOME explicitly. No EAS account/configuration is required.

From the project root:

```powershell
npm ci
# Configure ignored .env (public client values only).
npm run android:prepare
npm run typecheck
npm run lint
npm test
npm run check:dependencies
npm run check:security
npm run android:release
```

`android:prepare` applies app.json and tracked config plugins to the ignored native
project. It may regenerate the directory: keep native customization in plugins,
and keep signing keys outside android/. `android:release` sets NODE_ENV=production,
loads Expo environment quietly and runs both Gradle release tasks. Direct equivalent:

```powershell
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
$env:NODE_ENV = 'production'
Set-Location android
.\gradlew.bat assembleRelease bundleRelease --console=plain
```

### Signing

No production signing credentials were provided. The tracked plugin **does not
fall back to the debug key**. Unsigned APK/AAB files are for build verification,
not installation or Play upload. Partial signing configuration fails the build.

To sign, supply all four variables from a secure external environment using your
existing upload keystore; do not put real values in this document or app config:

```text
SMARTPANTRY_UPLOAD_STORE_FILE     absolute path to an existing keystore
SMARTPANTRY_UPLOAD_STORE_PASSWORD
SMARTPANTRY_UPLOAD_KEY_ALIAS
SMARTPANTRY_UPLOAD_KEY_PASSWORD
```

No keystore is generated/overwritten. If no key exists, creating one and choosing
Play App Signing is an owner-controlled prerequisite. Preserve the chosen key for
all subsequent compatible updates. Do not uninstall a data-bearing app to bypass
a signing mismatch. EAS can be evaluated later, but is not configured here.

Typical outputs (verify existence; signed/unsigned names differ):

```text
android/app/build/outputs/apk/release/app-release-unsigned.apk
android/app/build/outputs/apk/release/app-release.apk           when signed
android/app/build/outputs/bundle/release/app-release.aab
```

Release embeds its Hermes JavaScript/assets and has BuildConfig.DEBUG=false.
expo-dev-client remains a development dependency/tooling package; a release must
launch MainActivity and its embedded JS without Metro/dev launcher. Confirm on a
signed installed binary with Metro stopped. A production export alone is not an APK.

## Dependency and Build Audit

`expo install --check` passes after the SDK-compatible patches. npm audit reports
**29 advisory entries (18 high, 11 moderate, 0 critical)**, including transitive
braces, node-forge, uuid and decode-uri-component chains. Several are tooling,
but router parsing also has a runtime chain. Do not mark the entire tree safe
merely because many entries are build-time. npm's automated suggestions include
incompatible upgrades/downgrades (for example another Expo/Router major).
**Do not run audit fix --force.** Review upstream patched compatible versions and
actual exposure before public release. No unreviewed overrides were introduced.

Several starter-related direct packages appear unused by active screens (for
example @expo/ui, expo-gl and expo-glass-effect); they were not removed during this
release build to avoid changing native autolinking and increasing regression scope.
Review size cleanup separately, not by deleting libraries used transitively.

Build warnings seen so far: native library deprecated API/manifest namespace
warnings, Android SDK XML version mismatch, cross-drive hard-link copy fallbacks,
NO_COLOR/FORCE_COLOR, and Gradle 10 deprecation warnings. These are documented,
not suppressed by editing dependency source. Final build results follow below.

## Final Verification Results

Verified on Windows with Node 24.21.0 and Java 17:

| Check | Result |
| --- | --- |
| npm run typecheck | PASS |
| npm run lint | PASS, no lint warnings/errors |
| All tests | PASS: 171 tests, zero failures/skips/cancellations (166 prior + 5 release tests) |
| expo install --check | PASS: dependencies up to date after patches |
| Critical runtime duplicates | One React 19.2.3, RN 0.86.3, Supabase JS 2.117.3 and expo-sqlite 57.0.4; npm reports no problems |
| check:security | PASS: 221 project files, 384 reachable historical text blobs, no pattern findings; local env values withheld |
| Android production export | PASS: dist/release-android, 1,603 modules, Hermes bundle ~4.6 MB |
| Merged release manifest | Forbidden audio/media/storage/overlay absent; backup=false, cleartext=false; native scheme preserved |
| Release BuildConfig | DEBUG=false, applicationId/version/code match the table above |
| git diff --check | PASS |
| npm audit | NOT CLEAN: 18 high + 11 moderate advisory entries; review required |
| Gradle assembleRelease + bundleRelease | PASS: BUILD SUCCESSFUL in 30m 33s; 911 tasks, all four ABIs |
| npm run android:release | PASS: cached repeat in 2m 26s; 57 executed / 854 up-to-date tasks, artifact hashes unchanged |

The first Gradle attempt was sandbox-network blocked; retry with dependency access
then found no ANDROID_HOME. Pointing the build process to the existing installed
SDK resolved this without changing system environment settings. No keystore was
generated. A successful unsigned build does not clear the signing/branding/
advisory/phone-QA release gates.

### Generated Artifacts

Both artifacts contain an embedded 3,776,100-byte Hermes bundle, all four native
ABIs (arm64-v8a, armeabi-v7a, x86, x86_64), and no packaged source maps:

| Artifact | Bytes | Signing |
| --- | --- | --- |
| android/app/build/outputs/apk/release/app-release-unsigned.apk | 137329281 | UNSIGNED |
| android/app/build/outputs/bundle/release/app-release.aab | 89195017 | UNSIGNED |

aapt2 confirmed SmartPantry / com.nerorebel.smartpantry / 1.0.0 / code 1 / target
36 and the expected ABIs. APK `apksigner verify` reports no signature as expected;
AAB `jarsigner -verify` reports unsigned. Neither artifact is ready for installation
or Play upload without signing. No release app was installed or cold-launched in
this audit. Temporary callback/password/avatar diagnostic strings were absent from
the release Hermes bundle; source __DEV__ guards remain for intentional development
failures. The documented runner is also exercised against the completed build.

SHA-256 (unsigned artifacts; recompute after signing/rebuilding):

```text
APK 356651F084ABEACAC01130AC6B4E7ACA72E2C023783026A39A1A8BCC786DDCDB
AAB 081771BA78C208324BC51AA8DE48EA0A6F60C2CFCC27EC598B180DFEA36AE50C
```

## Release Smoke-Test Checklist

Use disposable accounts/data and a signed release build. Never erase a real account
or uninstall a data-bearing installation just to test release signing.

- [ ] Auth: email + Google sign-in, logout/session restore, new confirmation link,
      recovery link, cancel Google; no protected-route flash or recovery-to-Home loop.
- [ ] Profile: avatar choose/upload/remove/fallback, display name, change email and
      password; Google-only provider actions remain appropriate.
- [ ] Delete Account: two-step confirmation; owned cloud/avatar rows removed,
      own local cache/reminders cleared, other accounts untouched; server failure
      retains local rows and restores sync. Verify actual cascade behavior.
- [ ] Pantry: Quick Add/custom add/edit/delete, scan and manual barcode, OFF found/
      unknown/name fallback/offline; original barcode preserved; expiry filters.
- [ ] Recipes: list/search/category/empty/error/retry, pantry matches, full detail,
      add missing ingredients, duplicate prevention and View Shopping List.
- [ ] Shopping: add/edit/check/delete/clear purchased, search and restart persistence.
- [ ] History: consumed/wasted snapshots survive product removal; statistics periods.
- [ ] Sync: manual sync, cold session restore, offline create/edit/delete, reconnect,
      second-device merge/tombstones/conflicts, User A/B isolation, no resurrection.
- [ ] Notifications: grant/deny, future schedule, edit/timing reschedule, disable/
      enable, deletion/consume/waste cancel, reboot/upgrade and remote sync changes.
- [ ] UI: EN/SK/RU/UK/HU, light/dark/system/OS change, high contrast, each accent,
      compact screen/large font/keyboard, TalkBack, long names/emails, back/navigation.
- [ ] Release: signed binary opens with Metro stopped, correct brand/version/package,
      HTTPS APIs work, gallery needs no blanket storage permission, no debug overlays.
- [ ] Upgrade: install compatible signed update over existing data; inventory,
      settings, session, sync ownership and pending notifications remain usable.

## Physical Android Phone Checklist (Not Claimed Tested)

- [ ] Camera permission granted/denied/permanent-denial fallback.
- [ ] Real barcode EAN-13/EAN-8/UPC scan, autofocus, low light, torch and Scan tab return.
- [ ] Gallery crop/upload/replace/remove and image-size errors.
- [ ] Google browser OAuth and native return with release signing.
- [ ] New email confirmation, password reset and secure email-change links on phone.
- [ ] Local reminders at future time, battery restrictions, reboot and cancellation.
- [ ] Airplane-mode local CRUD, reconnect sync, account switching and second device.
- [ ] Release cold start/restart offline and online, with no Metro/Expo Go running.

## Remaining Release Gates

1. Rebuild with the new SmartPantry assets and verify launcher masks/splash on-device; replace the web favicon if distributing the web app.
2. Supply and verify production signing; install and test the resulting signed binary.
3. Triage npm advisories with compatible upstream fixes or a documented risk decision.
4. Verify the actual deployed Supabase project, RLS, SMTP, Google consent settings,
   private Storage and deletion function/cascades. Repository tests cannot attest to them.
5. Complete signed physical-phone/upgrade/offline/deep-link/notification QA and store
   disclosures/provider attribution. This pass adds no formal legal policy.

## Changed Files in This Release Pass

Tracked: app.json, package.json, package-lock.json, .gitignore, README.md, project.md;
plugins/with-release-android.cjs; scripts/android-release.cjs,
scripts/security-audit.cjs; tests/release.test.cjs; docs/release-readiness.md and
docs/data-handling.md. Existing dirty polish changes were preserved, not reverted.
Ignored Android files were regenerated from tracked config/plugins, not hand-maintained.

## References

- [Expo local production builds](https://docs.expo.dev/guides/local-app-production/)
- [Expo permissions](https://docs.expo.dev/guides/permissions/)
- [Expo SDK 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)
- [Expo SDK 57 notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
- [Supabase Google browser OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)
