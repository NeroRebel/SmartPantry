# SmartPantry

SmartPantry is a mobile application designed to help users manage food at home,
monitor expiration dates, reduce food waste and discover recipes from ingredients
they already have.

## Problem

People often forget what food they have at home and when it expires, which leads
to unnecessary food waste and repeated purchases.

## Target Users

- Students and young adults living independently.
- Households that want to reduce food waste.
- Users who want a simple overview of food stored at home.
- Users looking for recipe ideas based on available ingredients.

## Initiative

### Reduce household food waste through better pantry management

The main initiative of SmartPantry is to help users consume food before it expires
by providing a clear overview of pantry items, expiration dates, reminders and
recipe recommendations.

### Goal

Improve awareness of expiring food and help users make better use of products
already available at home.

---

## Epics, User Stories and Tasks

### Epic 1: Pantry Management

Users can manage products stored in their pantry and see their expiration status.

#### User Story 1.1

As a user, I want to see all products in my pantry so that I know what food I
currently have at home.

Tasks:
- Create the local product data model.
- Implement SQLite storage.
- Create Inventory screen.
- Implement product list.
- Add search and filtering.

#### User Story 1.2

As a user, I want to see which products are expired or expiring soon so that I
know what I should use first.

Tasks:
- Implement expiration-date calculation.
- Define Expired, Expiring Soon and Fresh statuses.
- Add status colors and labels.
- Add expiration filters.

#### User Story 1.3

As a user, I want to add, edit and remove products so that my pantry reflects the
real food I have at home.

Tasks:
- Create Add Product form.
- Create Edit Product form.
- Implement delete functionality.
- Validate product input.
- Implement Quick Add presets.

---

### Epic 2: Barcode Scanning

Users can add food products faster by scanning their barcode.

#### User Story 2.1

As a user, I want to scan a product barcode so that I do not have to enter all
product information manually.

Tasks:
- Implement camera access.
- Implement barcode scanner.
- Support common barcode formats.
- Integrate Open Food Facts API.
- Map API data to the product form.

#### User Story 2.2

As a user, I want an alternative when a barcode is not found so that I can still
add the product.

Tasks:
- Add manual barcode input.
- Implement product search by name.
- Add manual product fallback.
- Preserve scanned barcode during fallback flow.

---

### Epic 3: Expiration Notifications

Users receive reminders before food expires.

#### User Story 3.1

As a user, I want to receive a notification before a product expires so that I
have time to use it.

Tasks:
- Implement local notifications.
- Request notification permission.
- Schedule expiration reminders.
- Reschedule notifications after product updates.
- Cancel notifications when products are deleted or processed.
- Add reminder timing settings.

---

### Epic 4: Recipe Recommendations

Users can discover recipes based on ingredients available in their pantry.

#### User Story 4.1

As a user, I want to see recipes that match products in my pantry so that I can
cook with food I already have.

Tasks:
- Integrate TheMealDB API.
- Retrieve recipes and recipe details.
- Normalize pantry ingredient names.
- Match pantry ingredients with recipe ingredients.
- Calculate ingredient match information.
- Show available and missing ingredients.

#### User Story 4.2

As a user, I want to see which ingredients are missing from a recipe so that I
know what I need to buy.

Tasks:
- Display missing ingredients.
- Add missing ingredients to Shopping List.
- Avoid duplicate shopping-list items.

---

### Epic 5: Shopping List

Users can manage products that they need to buy.

#### User Story 5.1

As a user, I want to maintain a shopping list so that I do not forget products
when shopping.

Tasks:
- Create Shopping List screen.
- Implement add, edit and delete actions.
- Implement purchased state.
- Separate To Buy and Purchased items.
- Implement Clear Purchased action.
- Store shopping items locally in SQLite.

---

### Epic 6: Food History and Statistics

Users can see how much food they consume and waste.

#### User Story 6.1

As a user, I want to mark products as consumed or wasted so that I can track what
happens to food in my pantry.

Tasks:
- Create product history storage.
- Implement Consumed action.
- Implement Wasted action.
- Store product snapshots in history.

#### User Story 6.2

As a user, I want to see statistics about food consumption and waste so that I
can understand my habits.

Tasks:
- Create Statistics screen.
- Show consumed, wasted and total counts.
- Calculate waste rate.
- Show recent activity.
- Show most wasted categories.
- Add 7 Days, 30 Days and All Time filters.

---

### Epic 7: User Account and Cloud Sync

Users can access their SmartPantry account and synchronize their data.

#### User Story 7.1

As a user, I want to create and sign in to an account so that my data is associated
with me.

Tasks:
- Implement email/password authentication.
- Implement Google authentication.
- Implement email confirmation.
- Implement password recovery.
- Implement protected routes.
- Implement sign out.

#### User Story 7.2

As a user, I want my pantry data synchronized across sessions and devices so that
I do not lose my information.

Tasks:
- Integrate Supabase.
- Create cloud database tables.
- Implement Row Level Security.
- Add per-user data isolation.
- Implement offline-first synchronization.
- Implement last-write-wins conflict handling.
- Synchronize products, shopping list and history.
- Implement deletion tombstones.

#### User Story 7.3

As a user, I want to manage my profile so that I can personalize my account.

Tasks:
- Create Profile screen.
- Allow display name editing.
- Implement avatar upload.
- Store avatars in private Supabase Storage.
- Implement account deletion.

---

### Epic 8: Personalization and Accessibility

Users can customize SmartPantry according to their preferences.

#### User Story 8.1

As a user, I want to choose the application language so that I can use SmartPantry
in a language I understand.

Tasks:
- Implement internationalization.
- Add English.
- Add Slovak.
- Add Russian.
- Add Ukrainian.
- Add Hungarian.

#### User Story 8.2

As a user, I want to customize the visual appearance so that the application is
comfortable for me to use.

Tasks:
- Implement Light, Dark and System themes.
- Add selectable accent colors.
- Add High Contrast mode.
- Preserve semantic warning/status colors.

---

## MVP

The original SmartPantry MVP includes:

- Product inventory.
- Add/edit/delete products.
- Expiration-date tracking.
- Expiration reminders.
- Barcode scanning.
- Recipe discovery.
- Shopping list.
- Basic food statistics.

## Non-Goals

The following features are currently outside the project scope:

- AI-generated recipes.
- Shared household accounts.
- Real-time collaboration.
- Calorie and nutrition tracking.
- Social features.
- Remote push-notification infrastructure.
- Cloud synchronization of application settings.

---

## Technology

### Mobile Application

- Expo SDK 57
- React Native
- TypeScript
- Expo Router

### Local Data

- SQLite

### Backend

- Supabase Authentication
- Supabase PostgreSQL
- Supabase Storage
- Supabase Edge Functions

### External APIs

- Open Food Facts
- TheMealDB

### Device Features

- Camera / barcode scanning
- Local notifications

---

## Implemented Scope

SmartPantry is currently feature-complete for the planned university project scope.

Implemented functionality includes:

- Offline-first SQLite inventory.
- Product expiration tracking.
- Quick Add and manual product entry.
- Barcode scanning and Open Food Facts lookup.
- Recipe recommendations and pantry ingredient matching.
- Shopping list.
- Product history and waste statistics.
- Local expiration notifications.
- Email and Google authentication.
- Profile management and avatar storage.
- Per-account cloud synchronization.
- English, Slovak, Russian, Ukrainian and Hungarian localization.
- Light, Dark and System appearance modes.
- High Contrast and selectable accent colors.

---

## Architecture Boundaries

SQLite remains the local runtime source of truth.

Cloud synchronization does not replace local CRUD operations. Supabase is used for:

- authentication;
- profile metadata;
- private avatar storage;
- synchronized account data;
- server-side account deletion.

Remote database rows and files are protected using Row Level Security.

---

## Release Status

Current release:

- Version: 1.0.1
- Android versionCode: 2

Android release builds are produced using Gradle and signed with the SmartPantry
release keystore.

See [release readiness](docs/release-readiness.md) for production checks and
release validation.
