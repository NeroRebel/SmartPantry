# SmartPantry

An Expo SDK 57 / React Native / TypeScript university project for tracking food,
reducing waste and finding recipes. SQLite is the offline-first runtime store;
Supabase provides authentication, private avatars and per-account cloud sync.

## Development

Use Node.js 22.13+ (Node 24 recommended for the node:sqlite test harness), npm,
Java 17 and Android SDK 36 with NDK 27.1.12297006 for local Android builds.

```sh
npm ci
```

Create an ignored `.env` using the variable names in `.env.example`. Only the
Supabase HTTPS URL and publishable key belong in the mobile environment. Set up
the backend using [auth setup](docs/auth-setup.md) and [cloud sync](docs/cloud-sync.md).
Never put server/admin secrets in Expo config.

```sh
npm start -- --dev-client
```

Routes are in `src/app`. Use an installed development build, not Expo Go, for
the complete camera, notifications, SQLite and custom-scheme auth experience.
Rebuild the development client with `npm run android` after native-module patch
updates; keep its signing identity consistent and do not uninstall to fix a mismatch.
Do not run the starter `reset-project` script on this implemented application.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run check:dependencies
npm run check:security
```

## Android Release

The primary path is **local Gradle**, not EAS. From the project root:

```sh
npm run android:prepare
npm run android:release
```

Native folders are generated/ignored. Tracked app config and config plugins are
the source of truth. Without an upload keystore, release artifacts are unsigned
verification artifacts, not installable/publishable production packages.

Read [release readiness](docs/release-readiness.md) for signing environment names,
artifact paths, branding/security blockers, backend requirements and smoke tests.
Read [data handling](docs/data-handling.md) for a factual storage/API overview.
Read [polish QA](docs/polish-qa.md) for UI checks and remaining device testing.

Version: **1.0.0**, Android versionCode **1**, package
`com.nerorebel.smartpantry`, scheme `smartpantry`.
