# SmartPantry — Design Document

## 1. Purpose

This document describes the technical design of SmartPantry based on the requirements in `SPEC.md`.

The goal is to keep the mobile application offline-first, account-isolated and modular while integrating external services only where they add value.

## 2. Design Goals

- Preserve core pantry functionality without network access.
- Keep user data isolated by account.
- Separate local persistence, cloud synchronization and UI concerns.
- Use existing Expo/React Native capabilities instead of unnecessary custom native code.
- Keep external API failures from blocking local pantry management.
- Make product, shopping and history data recoverable through synchronization.
- Keep the architecture understandable and maintainable for a university project.

## 3. Non-Goals

This design does not include:

- a custom backend server outside Supabase;
- real-time shared household editing;
- AI recipe generation;
- nutrition analytics;
- remote push-notification infrastructure;
- a production iOS release.

## 4. Technology Stack

### Mobile

- Expo SDK 57
- React Native
- TypeScript
- Expo Router

### Local Persistence

- SQLite

### Backend

- Supabase Authentication
- Supabase PostgreSQL
- Supabase Storage
- Supabase Edge Functions

### External Services

- Open Food Facts
- TheMealDB

### Native Capabilities

- Camera / barcode scanning
- Local notifications
- Image picker
- Android system UI integration

## 5. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     SmartPantry Mobile App                  │
├─────────────────────────────────────────────────────────────┤
│ UI / Expo Router                                           │
│ Home | Inventory | Scan | Recipes | More | Detail screens  │
├─────────────────────────────────────────────────────────────┤
│ Application / Domain Logic                                 │
│ Product status | Ingredient matching | Statistics | i18n   │
│ Notification scheduling | Validation | Sync orchestration   │
├─────────────────────────────────────────────────────────────┤
│ Local Data Layer                                            │
│ SQLite: products | shopping list | history | settings       │
├─────────────────────────────────────────────────────────────┤
│ Integration Layer                                           │
│ Supabase | Open Food Facts | TheMealDB | Native APIs        │
└─────────────────────────────────────────────────────────────┘
```

The user interface operates primarily against local application state backed by SQLite. Remote services are integrations, not replacements for local CRUD.

## 6. Navigation Design

The primary bottom-tab navigation contains:

- Home
- Inventory
- Scan
- Recipes
- More

Additional routes include:

- product add/edit/detail flows;
- scanned-product and product-search flows;
- recipe detail;
- shopping list;
- statistics;
- profile;
- authentication and recovery;
- appearance and language settings.

Protected application routes require an authenticated session where appropriate.

## 7. Local Data Model

### 7.1 Product

Representative fields:

```text
id
user_id
name
brand
barcode
category
quantity
unit
expiration_date
storage_location
image_url
notes
created_at
updated_at
deleted_at
```

Responsibilities:

- represent a pantry item;
- support account isolation;
- support soft deletion/tombstones for synchronization;
- provide enough information for expiration status and recipe matching.

### 7.2 Shopping Item

Representative fields:

```text
id
user_id
name
quantity
unit
category
completed
source
created_at
updated_at
deleted_at
```

`source` is local metadata and does not need to be synchronized.

### 7.3 Product History

Representative fields:

```text
id
user_id
product_id
product_name
category
quantity
unit
action
action_date
created_at
updated_at
deleted_at
```

`action` is either `consumed` or `wasted`.

History stores product snapshots so statistics remain meaningful even after the active product is removed.

### 7.4 Application Settings

Settings include:

- language;
- theme mode;
- high-contrast state;
- accent color;
- reminder preferences;
- synchronization metadata where needed.

Not all settings are synchronized to the cloud.

## 8. Product Status Design

Product status is calculated from the expiration date relative to the current local date.

```text
expiration date < today       -> Expired
today ... today + 3 days      -> Expiring Soon
expiration date > today + 3   -> Fresh
```

Status is derived rather than stored as permanent product state. This prevents stale status values.

## 9. Barcode and Product Lookup Flow

```text
Scan barcode
    ↓
Read supported barcode value
    ↓
Open Food Facts lookup
    ↓
Found?
 ┌───────┴────────┐
Yes               No
 ↓                 ↓
Map product        Offer name search /
data               manual fallback
 └───────┬────────┘
         ↓
Open Product Form
         ↓
User supplies/validates expiration date
         ↓
Save to SQLite
```

Design rules:

- barcode lookup must never fabricate an expiration date;
- lookup failure must not block manual entry;
- original scanned barcode should be preserved through fallback flows;
- duplicate barcodes may be allowed because multiple physical items can exist.

## 10. Recipe Design

TheMealDB provides recipe metadata.

SmartPantry maps external recipe responses to an internal recipe representation.

Ingredient matching flow:

```text
Pantry ingredients
      ↓
Normalize names
      ↓
Recipe ingredients
      ↓
Normalize names
      ↓
Compare
      ↓
Available / Missing ingredients
      ↓
Match information
```

Missing ingredients can be transferred to the shopping list.

External recipe content is displayed in the language supplied by the source API; SmartPantry interface labels remain localized.

## 11. Notification Design

Expiration reminders are local notifications.

Lifecycle:

```text
Product created/updated
        ↓
Evaluate reminder settings + expiration date
        ↓
Cancel obsolete notification if needed
        ↓
Schedule local notification
```

Notifications are cancelled when a product is:

- deleted;
- consumed;
- wasted.

Account switching must prevent reminders belonging to an inactive account from remaining scheduled.

No remote push server is required.

## 12. Authentication Design

Supabase Authentication supports:

- email/password sign-up and sign-in;
- email confirmation;
- password recovery;
- Google OAuth;
- session persistence;
- sign out.

Native deep-link callback:

```text
smartpantry://auth/callback
```

The application uses only public client configuration. Service-role credentials are never included in the mobile client.

## 13. Cloud Data Model

Remote tables:

- `profiles`
- `products`
- `shopping_list`
- `product_history`

Every user-owned row includes `user_id`.

Composite keys are used where required to preserve per-user ownership.

Supabase Row Level Security restricts authenticated users to their own records.

Private avatar files are stored in an `avatars` storage bucket using per-user paths.

## 14. Synchronization Design

### 14.1 Principle

SQLite remains the local runtime source of truth.

The cloud layer is used for account-backed synchronization and recovery.

### 14.2 Synced Data

- products;
- shopping list;
- product history.

### 14.3 Strategy

SmartPantry uses an offline-first synchronization approach with:

- stable text IDs;
- `updated_at`;
- `deleted_at` tombstones;
- account ownership;
- Last Write Wins conflict resolution.

Simplified flow:

```text
Authenticate user
      ↓
Load local account data
      ↓
Pull remote changes
      ↓
Compare local / remote timestamps
      ↓
Apply newer state
      ↓
Push eligible local changes
      ↓
Store synchronization metadata
```

### 14.4 Conflict Resolution

For the same logical row, the state with the newer `updated_at` value wins.

Known limitation:

- device clock skew may influence Last Write Wins decisions.

### 14.5 Deletion

Deletes are represented by tombstones (`deleted_at`) so that a record removed offline can later propagate deletion to the cloud.

## 15. Account Isolation

Local and remote records are scoped by `user_id`.

Requirements:

- account A must never display account B's cached records;
- signing out does not require deleting all local account caches;
- changing accounts switches the active local data scope;
- legacy unowned local data may be claimed only through a controlled migration path.

## 16. Account Deletion

Account deletion uses a server-side Supabase Edge Function.

Flow:

```text
User confirms destructive action
        ↓
Authenticated Edge Function request
        ↓
Delete private avatar files
        ↓
Delete Supabase Auth user
        ↓
Database rows removed through ON DELETE CASCADE
        ↓
Client receives confirmation
        ↓
Cancel local notifications
        ↓
Purge local data for deleted account
        ↓
Clear session
```

The function derives the user identity from the authenticated JWT and does not trust a client-provided `user_id`.

## 17. Localization Design

Supported languages:

- English
- Slovak
- Russian
- Ukrainian
- Hungarian

Application interface strings are stored in localization resources and resolved through the i18n layer.

External API content is not automatically translated.

## 18. Appearance Design

Appearance options:

- Light;
- Dark;
- System;
- High Contrast;
- selectable accent colors.

Semantic colors for states such as expired, expiring soon, fresh, warning and danger remain independent of the selected accent color.

Android system UI should match the active application theme while preserving safe-area handling.

## 19. Error Handling

### Local Operations

Local database failures should:

- not silently discard user input;
- surface a clear user-facing error;
- preserve existing data where possible.

### Network Operations

External API or Supabase failures should:

- not prevent offline pantry CRUD;
- provide retry where appropriate;
- avoid destructive rollback of valid local data;
- distinguish temporary connectivity problems from validation errors.

### Scanner

Camera denial or unavailable scanning should provide manual fallback paths.

## 20. Security Design

- `.env` files are excluded from Git.
- Android keystores and signing passwords are excluded from Git.
- Service-role secrets are never bundled in the application.
- Supabase RLS isolates user-owned data.
- Avatar storage uses private access rules.
- Account deletion runs server-side.
- External input is validated before being persisted where applicable.
- Public repository documentation must not expose credentials.

## 21. Testing Strategy

The project uses automated and manual validation.

Automated checks include:

- TypeScript validation;
- lint;
- unit/integration tests for relevant application logic;
- production export/build checks.

Manual Android QA should cover:

- authentication;
- account switching;
- product CRUD;
- barcode scanning on a physical device;
- notifications;
- recipes;
- shopping list;
- statistics;
- localization;
- appearance modes;
- offline/reconnect behavior;
- signed release installation.

## 22. Implementation Order

A logical implementation order for the design is:

1. application shell and navigation;
2. SQLite schema and product CRUD;
3. expiration status and Home overview;
4. recipes and external API mapping;
5. shopping list;
6. notifications;
7. statistics/history;
8. barcode scanner and Open Food Facts;
9. localization and appearance;
10. authentication/profile;
11. cloud schema and synchronization;
12. account deletion and release hardening.

## 23. Design Decisions and Trade-offs

### SQLite as local source of truth

Chosen because the application must remain useful offline.

Trade-off: synchronization requires explicit reconciliation logic.

### Supabase instead of a custom backend

Chosen to provide authentication, PostgreSQL, storage and server-side functions with less backend infrastructure.

Trade-off: the application depends on an external platform for cloud features.

### Local notifications

Chosen because expiration reminders are device-specific and do not require a remote notification server.

Trade-off: reminders are not centrally delivered across every device.

### Last Write Wins

Chosen because it is understandable and sufficient for the project scope.

Trade-off: simultaneous edits and clock skew are not resolved semantically.

### External recipe/product APIs

Chosen to avoid maintaining large product and recipe catalogs.

Trade-off: availability and data quality depend on third-party services.

## 24. Future Design Considerations

Possible future extensions include:

- shared household pantry model;
- improved ingredient normalization;
- nutrition metadata;
- AI-assisted recipe generation;
- preference synchronization;
- iOS release support;
- richer sync conflict resolution;
- onboarding and usage analytics.
