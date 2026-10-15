# SmartPantry

SmartPantry is a feature-complete university project helping users organize food,
monitor expiry dates, reduce waste and discover recipes from pantry ingredients.

## Implemented Scope

- Expo SDK 57, React Native, Expo Router and strict TypeScript.
- SQLite offline-first inventory, shopping list and product history/statistics.
- Supabase email/Google auth, confirmation/recovery links, profile editing,
  private avatar storage and server-side account deletion.
- Account-isolated SQLite cache, tombstones and last-write-wins cloud sync.
- Manual/Quick Add, camera barcodes, Open Food Facts lookup and name-search fallback.
- TheMealDB recipes, local ingredient matching and missing-ingredient shopping actions.
- Local expiration reminders; no remote push infrastructure.
- English, Slovak, Russian, Ukrainian and Hungarian; light/dark/system themes,
  high contrast and selectable accents.

## Boundaries

SQLite remains the local runtime source of truth; cloud sync never replaces local
CRUD. Auth/profile metadata and avatar storage use Supabase. RLS restricts remote
rows/files to their authenticated owner. No AI, Realtime collaboration, household
sharing, calorie tracking or cloud settings sync is implemented.

## Release Status

Version 1.0.0 / Android code 1. Local Gradle is the primary release path. Native
configuration is generated from app.json and tracked plugins. Native launcher
and splash graphics use the shared black-and-orange SmartPantry pantry/leaf mark.
Rebuild native resources to include updated branding; the web favicon is unchanged.
Production signing, advisory review, backend verification and physical-phone QA
remain explicit release gates. See [release readiness](docs/release-readiness.md).
