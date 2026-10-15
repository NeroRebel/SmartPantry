# Cloud sync implementation record

## Inspection (before migration)

The device database is `smartpantry.db`. All three runtime tables currently use
`INTEGER PRIMARY KEY AUTOINCREMENT`, have no ownership, update timestamp or
tombstone, and are queried device-wide. Delete operations hard-delete rows.
Consume/waste inserts a snapshot and deletes the product in one transaction.
Product notifications use a nullable device-local `notification_id`.

Existing columns:

- products: id, name, brand, barcode, category, quantity, unit, expiration_date,
  storage_location, image_url, notes, notification_id, created_at.
- shopping_list: id, name, quantity, unit, category, completed (0/1), source,
  created_at.
- product_history: id, product_id, product_name, brand, category, quantity, unit,
  expiration_date, action, action_date, created_at (nullable).
- notification_settings is a single device-wide preferences row and is not syncable.

Dates use YYYY-MM-DD; creation/action timestamps use ISO UTC strings. Some older
creation timestamps can be date-only. History created_at retains the original
product's timestamp, not the lifecycle action timestamp; preserve that behavior.

## Cloud schema source

The user supplied the actual CREATE TABLE definitions and `set_updated_at` trigger
after a public-key REST OpenAPI inspection returned HTTP 401. The mapper uses
those supplied definitions, not inferred column names. All three cloud tables have
composite `(user_id, id)` keys, text IDs, timestamptz timestamps, soft deletes and
owner RLS. No remote schema or policies were changed. Auth metadata remains the
profile source of truth; the profiles table is not mirrored or required by sync.

## Necessary local compatibility changes

Integer auto-increment IDs collide across devices and cannot hold the same ID in
two accounts' caches. A transactional table-copy migration changes local keys to
`(user_id, id TEXT)` while preserving every existing ID as its exact decimal text.
It also converts snapshot product_id to text without remapping it. New records use
SQLite-generated 128-bit random text IDs; existing IDs are never regenerated.
This is a migration inside the existing database, not a database reset.

Legacy rows use the empty owner string until adopted. The first authenticated
account claims unowned rows once, transactionally with the metadata key
`legacy_data_claimed_by_user_id`. Subsequent accounts never claim them. Signed-out
UI must not expose the unowned repository scope. Logout keeps caches intact.

Each entity gets updated_at, deleted_at and a local revision counter. UI reads hide
tombstones; deletes/clear operations tombstone rows. Consume/waste inserts a
snapshot and tombstones the original product atomically. Device notification IDs
are never suitable for cloud synchronization.

## Verified cloud mapping (user-supplied actual DDL)

- products: same snake_case business names. Local category/expiration are required;
  cloud allows null. Missing category maps to Other; invalid/missing active expiration
  rejects the remote row rather than inventing a date or crashing the Inventory UI.
- shopping_list: local completed INTEGER maps to is_purchased BOOLEAN. Local source
  has no cloud equivalent and is preserved on updates; new downloads default to manual.
- product_history: product_name maps to name; action_date maps to processed_at;
  product_id is TEXT. Add nullable local snapshot barcode/storage_location/image_url/notes
  columns to preserve the richer existing cloud snapshot. Missing legacy created_at
  is sent as processed_at because cloud created_at cannot be null.
- all entities: id/user_id/updated_at/deleted_at map directly, dates are normalized
  only where needed for timestamptz transport. No notification_id/local_revision is uploaded.

The actual cloud trigger unconditionally sets updated_at=now() on UPDATE. Cloud
writes must compare-and-set against the fetched updated_at and acknowledge the
returned server timestamp. A concurrently edited local row must not be replaced
by acknowledgement of an older sent snapshot. No Supabase SQL change is required.

## Architecture and runtime responsibilities

`SyncProvider` reuses AuthProvider, waits for the local account boundary, and starts
the coordinator only for an authenticated, non-recovery session. Existing SQLite
repositories remain the only UI runtime source. Their reads/writes capture the
owner before awaiting, bind user_id on every entity query, and hide tombstones.
Compound lifecycle, data-clear and recipe-shopping operations also reject an
account switch between their asynchronous steps. The application navigator waits
for account preparation so old cached screen state cannot briefly render for a
different account. Local preparation needs no network.

The first authenticated account claims unowned data, even when the legacy tables
are empty, and records the claim in the same local transaction. Claiming changes
ownership/revision, not content timestamps. It never runs for another account.
Migration metadata, device settings and caches survive logout. Migrations roll
back on invalid/incompatible legacy data rather than silently dropping records.

`cloud-store.ts` handles authenticated PostgREST requests with explicit user_id
filters, owner validation, abort signals and stable ID-ordered 250-row pagination.
`local-store.ts` applies remote winners transactionally, preserving local-only
columns. `sync-mappers.ts` contains the exact business-column mapping.
`entity-sync.ts` computes and applies a merge for one entity. `sync-service.ts`
coordinates products -> shopping_list -> product_history, status, concurrency,
bounded retries and per-account last-success metadata.

## Initial sync and conflict resolution

- Local only: insert the same ID, including a local tombstone if already deleted.
- Cloud only: insert that ID into the current account's cache, including tombstones.
- Both present: the strictly greater updated_at wins; equal versions do nothing.
- Comparing timestamps preserves PostgreSQL microseconds and timezone equivalence.
- Downloaded creation/processed UI timestamps normalize to millisecond UTC-Z for
  existing SQLite history date-range comparisons; sync updated_at keeps full precision.
- All active row content is validated before application. Missing/null product
  category becomes Other. Missing/invalid active product expiration causes a
  non-blocking sync error and leaves that entity's local data intact; repair the
  cloud date instead of inventing one. Invalid row structure/types fail safely.

Local edits generate monotonic UTC timestamps (at least one millisecond after the
record's previous version). The first migration uses creation/action timestamps
because the old app did not record edit times; it preserves original creation fields.
LWW assumes reasonably synchronized device/server clocks and intentionally loses
the older whole-row version, not field-by-field merges.

For a local winner with a remote row, PostgREST UPDATE includes user_id, id and the
previously fetched updated_at as predicates. A concurrent remote edit causes zero
updated rows and a retry, not a blind overwrite. A local-only insert uses upsert
with ignoreDuplicates, so a concurrent insert cannot be overwritten either.

After a successful write, the server-returned updated_at is acknowledged locally
only when the sent local_revision/version still matches. If the user edited or
deleted the row during upload, its content is retained and rebased beyond the
acknowledged version, then synchronized again. This avoids a stale upload response
discarding a newer local edit and prevents endless pushes caused by the server trigger.

## Deletions and lifecycle

Delete, Clear Purchased, Clear Shopping List, Clear History and Clear All Data now
tombstone only the active account's records. Their normal UI hides these records.
Clear All Data will also clear their cloud visibility on a successful sync; other
accounts, preferences and migration metadata remain untouched. Tombstones are
retained indefinitely locally and remotely in this version, not purged automatically.
Never hard-delete cloud rows administratively if deletion must reach offline devices.

Consume/waste atomically inserts a full history snapshot and tombstones the product
locally. The history retains its original product ID and data after removal from
active Inventory. REST writes across different tables are not a distributed
transaction: product removal may reach cloud before history if a request fails.
The persistent local snapshot remains pending and the next sync sends it. Statistics
always use active local history and do not depend on the network.

## Triggers, retries and UI

Sync runs after authenticated restore/login and account preparation, on foreground,
from Profile > Cloud Sync > Sync now, and 1.5 seconds after important local changes.
Local CRUD never awaits cloud. Concurrent runs coalesce; local mutations during a
run queue a follow-up. Remote-applied change notifications refresh focused screens
once per entity without creating an upload loop. The existing focus/resume/midnight
refresh behavior remains.

The coordinator allows two automatic retries after failure (10s then 30s; conflicts
retry after 1s), then waits for another local mutation, foreground event or manual
request. A run aborts requests after 60s. Partial progress is safe and repeatable;
lastSuccessfulSyncAt is recorded per account only after all entities finish. Errors
are non-blocking. UI shows idle/never, syncing, synced, offline or failed with safe,
localized help. No raw server messages, sessions, tokens or callback URLs are logged.
Development entity diagnostics contain only names, counts and duration.

Account changes abort old network work and reset visible status. Every subsequent
request validates the session's user ID and every response validates ownership.
RLS remains the final server boundary; only the existing publishable client key is
used. No service role, SQL RPC or schema migration is introduced in Supabase.

## Notifications

notification_id and reminder_dirty are device-local and never uploaded. Remote
product creation/name/expiration/deletion sets reminder_dirty in the same local
application transaction. Reconciliation cancels obsolete and inactive-account
notifications; current missing/dirty reminders use existing scheduling/preferences.
Repeated equal syncs do not recreate a valid reminder. A dirty marker survives a
crash between applying data and scheduling. Reminder operations serialize, capture
the owner and cancel a newly scheduled result if the account changes mid-request.
Notification errors do not roll back synced food data or block offline access.
No remote push-notification or OS background-job system is added.

## Tests and manual verification

Automated tests use real Node SQLite for migrations, repositories and entity merge
application, with mocked Expo bridges and cloud transport. They cover preservation,
rollback, once-only claims, isolation, LWW, microseconds, tombstones, idempotency,
offline writes, concurrent acknowledgements, lifecycle snapshots, actual column
mapping, request scoping/conditional updates, bounded retries and reminder ownership.
They do not prove the deployed project's RLS or device behavior.

Manual checklist (use disposable accounts/devices and export/backup important data first):

1. With pre-update local Inventory/shopping/history, install the update without
   clearing app data. Sign in as A; verify the legacy claim flag, unchanged IDs/data,
   one initial upload and Profile's last-sync timestamp.
2. With A's cloud data populated, use a second empty installation. Verify download,
   shopping purchased flags and identical history/statistics.
3. Go offline; create/edit/delete products and shopping rows and consume/waste food.
   UI must work. Sync after reconnect; compare cloud content/tombstones/snapshots.
4. Make a newer valid cloud edit (including an expiration date), then sync. Check the
   local UI updates. Create a conflicting local edit and verify updated_at LWW.
5. Delete on A/device 1, sync, then sync device 2. No active record should reappear.
6. Mark food consumed/wasted; check both product tombstone and history snapshot
   eventually arrive, and Statistics remains correct while offline.
7. Switch A -> B -> A. B must not see A data, reminders or last-sync timestamp.
   Logout/login must retain the appropriate account cache and device settings.
8. Verify remote product creation yields one valid reminder, expiration update
   replaces it, deletion cancels it, and equal repeated sync does not duplicate it.
9. Test denied notification permission, network/RLS errors and foreground/manual retry.
10. Test Profile sync UI in all five languages, themes, accents and high contrast.

## Known limitations

- No live authenticated cloud/device/RLS test was performed by the automated suite.
  Deploy the supplied schema/policies as already configured and use the checklist.
- Device clock skew affects first-version whole-row LWW. Equal timestamp/content
  disagreements intentionally follow the specified no-action rule.
- Independently created *legacy* integer IDs can collide across old devices for the
  same account. Preserving those IDs means they represent one merge identity; back
  up and reconcile such legacy imports before syncing both. New 128-bit random IDs
  prevent normal auto-increment collisions going forward.
- Concurrent consume/waste on two offline devices can produce two history events
  for one product; there is no cross-device workflow deduplication/transaction.
- First-version sync scans all rows including tombstones and writes winners
  sequentially. Large caches can require retries/manual continuation beyond 60s.
- Shopping source has no cloud column and stays local. Legacy null history
  created_at falls back to processed_at when sent; no invented product creation
  date is shown as a separate value. Invalid cloud active expiration must be fixed.
- Settings/appearance/language remain device-wide, not per-account/cloud-synced.
  Auth profile metadata and private avatar storage keep their existing behavior.
- No Realtime, background OS jobs, collaborations, CRDT, recipe
  cloud cache or automated tombstone purge is implemented.

## Files in this change

Created:

- docs/cloud-sync.md
- src/components/sync-section.tsx
- src/db/local-owner.ts, local-state.ts, owned-data.ts, sync-migration.ts
- src/hooks/use-local-account.ts
- src/i18n/sync.ts
- src/sync/sync-types.ts, merge.ts, sync-mappers.ts, local-store.ts, cloud-store.ts,
  entity-sync.ts, sync-service.ts, sync-context.tsx
- tests/local-sync-migration.test.cjs, sync-merge.test.cjs, sync-service.test.cjs

Modified:

- docs/auth-setup.md
- src/app/_layout.tsx, profile.tsx, shopping-list.tsx
- src/app/settings/data.tsx (account/cloud scope in destructive confirmations)
- src/app/product/[id].tsx, [id]/edit.tsx, scanned.tsx
- src/data/recipe-shopping.ts
- src/db/database.ts, manage-data.ts, product-history.ts, products.ts, shopping-list.ts
- src/hooks/use-focused-data.ts, src/i18n/index.ts
- src/services/manage-data.ts, notifications.ts, product-lifecycle.ts
- src/types/product-history.ts, product.ts, shopping-item.ts
- src/utils/statistics.ts
- tests/notifications.test.cjs, product-history.test.cjs

No new dependencies, Supabase SQL changes or native project changes are required.

## Verification results

- TypeScript: `npx tsc --noEmit` passed.
- Lint: `npx expo lint` passed.
- Tests: `node --test tests/*.test.cjs` passed, 130 total (25 added).
- Android bundle: `npx expo export --platform android --output-dir .expo/cloud-sync-export` passed.
- Live account, multi-device, email/auth regression, device reminders and deployed
  RLS checks remain manual. No remote SQL was applied and no commit was created.

## Account Deletion Integration

Account deletion now uses the existing sync coordinator, not another sync layer.
`pauseAndDrain(userId)` cancels timers, aborts and awaits that account's active
run, resets visible sync state and prevents activation/manual/debounced retries
for that ID. Normal operations resume only if server deletion fails. A shared
account gate rejects queued local mutations and sync-store operations for the
deleting user and drains profile/avatar operations before calling the server.

After explicit server confirmation, `db/account-cleanup.ts` removes only that
owner's rows, including tombstones and local revisions, and its last-sync key.
Other users' caches stay intact. The legacy import owner marker is retired rather
than deleted so a future login cannot claim old device-wide data again. A local
receipt survives interrupted notification/cache/session cleanup and is processed
before local account initialization and sync. Device-wide notification preferences,
language, theme and accent are not reset.

Notification cleanup waits for reminder work and cancels stored mappings plus
scheduled SmartPantry expiration notifications tagged with the deleted owner.
Scheduling checks the account gate both before and after the native async call.
This avoids a late in-flight reminder surviving deletion. No blanket cancel-all
or database wipe is used.

The supplied schemas for products, shopping_list, product_history AND profiles
have user_id foreign keys with ON DELETE CASCADE. Before deployment, run the
read-only `supabase/verify-account-cascades.sql` against the actual project. No
Supabase table changes are required. See `docs/auth-setup.md` for Edge Function
deployment, secrets, JWT validation, Storage cleanup, distributed-failure
limitations and the full destructive manual test checklist.

New/updated account-management code: `src/app/settings/change-email.tsx`,
`delete-account.tsx`, `src/components/account-styles.ts`, `src/utils/account.ts`,
`src/services/account-lock.ts`, `account-deletion.ts`, `src/db/account-cleanup.ts`,
`src/i18n/account.ts`, Profile/auth screens, AuthProvider, shared auth callback,
auth service, notification service, local-account initialization, owned-data and
the existing sync service/context/local store. Server code is isolated under
`supabase/functions/delete-account`; Expo typecheck/lint do not use Deno globals.
The function core has its own strict TypeScript check and credential-free tests.
