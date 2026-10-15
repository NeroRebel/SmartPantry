# SmartPantry Data Handling

This is an engineering description, not a legal privacy policy or compliance claim.
Review actual deployment/provider settings before public distribution.

## On the Device

- SQLite stores inventory products (names, brands, barcodes, quantities, expiry,
  locations, notes and optional image URLs), shopping items and lifecycle history.
- User-owned rows, tombstones, sync timestamps/receipts and notification mappings
  are scoped by account. Device language/theme/notification preferences are local.
- Supabase Auth persists its session in AsyncStorage. App code does not separately
  save passwords. Sessions necessarily contain authentication tokens: do not expose
  app storage, bundle development exports or logs as user data.
- Scheduled reminder metadata/content also exists in Android notification storage.
- SQLite/AsyncStorage are not encrypted by this application. Device OS sandbox and
  device security apply; this is not an encrypted-vault claim.
- Android OS automatic backup is disabled to avoid automatically copying cached
  account/session data. This does not delete existing local data or affect app sync.
- Logout retains per-account pantry caches and device preferences. Account deletion
  clears only that user's local cache after server confirmation, cancels their
  reminders, clears their session and prevents pending sync from recreating data.

## Supabase

- Auth manages email, provider identities, password credentials, session lifecycle,
  confirmation/recovery and user metadata such as display name and avatar path.
  Passwords are submitted over HTTPS to Supabase Auth, not stored by SmartPantry.
- Private `avatars` storage contains the user's uploaded image under their folder.
  Short-lived signed URLs are generated for display, never permanent metadata.
- `products`, `shopping_list` and `product_history` receive account-owned snapshots,
  sync metadata and tombstones through the sync service. `profiles` exists in the
  backend schema; current profile display/edit source of truth is Auth metadata,
  not an independent profile-table sync engine.
- RLS and Storage policies must restrict each user's reads/writes to that owner.
- Delete Account validates the JWT server-side, removes owned avatars, then deletes
  the Auth user. Verified foreign-key cascades delete the four public tables' rows.
  Provider backups/retention are controlled separately; no immediate physical
  erasure of provider backups is claimed.

## Third-Party Requests

- Open Food Facts receives scanned/manually entered barcodes and fallback product
  name/brand searches; its images are downloaded by URL when displayed.
- TheMealDB receives recipe searches/categories/IDs and a bounded set of ingredient
  names derived from pantry products for recommendation discovery. Full local
  inventory and Supabase credentials are not sent to these recipe/product APIs.
- Google receives the browser OAuth login request when Google Sign-In is chosen;
  Supabase mediates the provider flow. Google/Supabase host their authentication UI.
- Remote APIs and image hosts can observe normal network metadata (for example
  source IP and request timing). SmartPantry adds no analytics/tracking platform.

## Before Publication

Confirm provider terms/attribution, data retention and account-deletion behavior;
prepare appropriate privacy/disclosure and store Data Safety responses based on
the shipped binary and deployed backend. Do not describe cloud sync as local-only.
