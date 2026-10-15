# SmartPantry

<p align="center">
  <img src="assets/images/icon.png" alt="SmartPantry icon" width="140" />
</p>

<h3 align="center">Keep track. Waste less. Cook smarter.</h3>

<p align="center">
  Offline-first mobile pantry manager built with React Native, Expo, TypeScript, SQLite and Supabase.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React%20Native-20232A?logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Android-3DDC84?logo=android&logoColor=white" alt="Android" />
</p>

---

## About

**SmartPantry** is a mobile application for managing household food, tracking expiration dates, reducing food waste and discovering recipes based on ingredients already available at home.

The app is designed around an **offline-first architecture**. SQLite remains the main local runtime database, while Supabase provides authentication, cloud synchronization, private avatar storage and account-specific backend data.

SmartPantry was developed as a university project, but its architecture and feature set are designed to resemble a production mobile application.

---

## Features

### Pantry Management

- Add, edit and remove pantry products
- Automatic expiration status:
  - Fresh
  - Expiring Soon
  - Expired
- Quick Add presets
- Product details and notes
- Storage location tracking
- Quantity and unit management

### Barcode Scanner

- Barcode scanning using the device camera
- Manual barcode entry
- Product lookup through **Open Food Facts**
- Fallback product search by name
- Manual product creation when no result is found

### Recipes

- Recipe discovery powered by **TheMealDB**
- Recipe search and categories
- Detailed recipe view
- Pantry-to-recipe ingredient matching
- Available and missing ingredient calculation
- Match percentage
- Add missing ingredients directly to the Shopping List

### Shopping List

- Add, edit and delete items
- Mark items as purchased
- Separate To Buy / Purchased sections
- Clear purchased items
- Persistent local storage

### Product History & Statistics

Products can be marked as:

- Consumed
- Wasted

SmartPantry preserves product snapshots in history and provides statistics including:

- Consumed products
- Wasted products
- Total processed items
- Waste rate
- Most wasted categories
- Recent activity
- 7 Days / 30 Days / All Time filters

### Expiration Notifications

- Local expiration reminders
- Configurable reminder timing
- Automatic rescheduling after product edits
- Automatic cancellation after deletion, consumption or waste
- Notification reconciliation after cloud synchronization

### Authentication & Account Management

- Email/password authentication
- Google OAuth
- Email confirmation
- Persistent sessions
- Forgot password
- Reset password
- Change password
- Change email
- Profile editing
- Sign out
- Secure account deletion

### Profile & Avatars

- Display name
- Email
- Authentication provider
- Account creation date
- Custom profile photo
- Google avatar fallback
- Initials fallback
- Private avatar storage through Supabase Storage

### Offline-First Cloud Sync

SmartPantry remains fully usable without internet access.

Local changes are stored in SQLite first and synchronized with Supabase when connectivity is available.

Features include:

- Per-account local caches
- Initial local/cloud merge
- Last Write Wins conflict resolution
- Tombstones for deleted records
- Manual **Sync now**
- Automatic synchronization
- Offline and sync status
- Account isolation
- Remote expiration-notification reconciliation

### Localization

SmartPantry currently supports:

- English
- Slovak
- Russian
- Ukrainian
- Hungarian

### Appearance

- Light theme
- Dark theme
- System theme
- High Contrast mode
- Multiple accent colors
- Semantic status colors for fresh, expiring and expired products

---

## Screenshots

> Screenshots will be added from the Android release build.

<!--
Example structure:

<p align="center">
  <img src="docs/screenshots/home.png" width="220" />
  <img src="docs/screenshots/inventory.png" width="220" />
  <img src="docs/screenshots/scanner.png" width="220" />
</p>

<p align="center">
  <img src="docs/screenshots/recipes.png" width="220" />
  <img src="docs/screenshots/profile.png" width="220" />
</p>
-->

---

## Architecture

[![Architecture diagram of nerorebel/smartpantry](https://gitdiagram.com/nerorebel/smartpantry/diagram.png)](https://gitdiagram.com/nerorebel/smartpantry?utm_source=readme&utm_medium=picture)

The application does not require Supabase to complete normal pantry operations. Cloud synchronization happens independently of local CRUD.

## Tech Stack
| Area | Technology |
|---|---|
| Mobile | React Native |
| Framework | Expo |
| Language | TypeScript |
| Navigation | Expo Router |
| Local database | Expo SQLite |
| Backend | Supabase |
| Authentication | Supabase Auth |
| Cloud database | Supabase Postgres |
| File storage | Supabase Storage |
| Barcode scanning | Expo Camera |
| Notifications | Expo Notifications |
| Product data | Open Food Facts |
| Recipes | TheMealDB |
| Localization | Expo Localization + custom i18n |
| Version control | Git / GitHub |

## Cloud Backend
Supabase currently stores:
auth.users
profiles
products
shopping_list
product_history
avatars/

User-owned tables are protected using Row Level Security (RLS).
Each authenticated user can only access their own cloud records.
The account-deletion flow is implemented through a Supabase Edge Function and removes:
- Auth account
- Profile
- Products
- Shopping List
- Product History
- Avatar files
- Local account cache
- Account-specific notifications

## Offline-First Synchronization

The synchronization architecture intentionally keeps SQLite as the runtime database.
SQLite
  ↕
Sync service
  ↕
Supabase Postgres

Current synchronization strategy:
- Existing local data is preserved during migrations
- Local and remote records are merged by (user_id, id)
- updated_at is used for conflict resolution
- Current conflict strategy: Last Write Wins
- Deleted records use deleted_at tombstones
- Failed synchronization does not block local usage

## Download
### Android
The latest Android APK is available from the repository's GitHub Releases page.
Recommended release filename:
SmartPantry-v1.0.0.apk

Android may ask you to allow installation from unknown sources when installing an APK outside Google Play.

## Development
Requirements
- Node.js 22.13+
- npm
- Java 17
- Android SDK 36
- Android NDK 27.1.12297006
Clone the repository:
git clone https://github.com/NeroRebel/SmartPantry.git
cd SmartPantry

Install dependencies:
npm ci

Create a local .env file based on:
.env.example

Required public variables:
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

Never place server-side or administrative Supabase secrets in the mobile application.

## Running the Development Build

SmartPantry uses native Expo modules and should be tested using a development build, not Expo Go.
Build Android:
npx expo run:android

Start Metro for the development client:
npx expo start --dev-client

## Android Release Build
From:
android/

run:
.\gradlew assembleRelease

Release APK output:
android/app/build/outputs/apk/release/app-release.apk

Release signing requires the production/upload keystore configuration described in the release documentation.
## Project Structure
SmartPantry/
├── assets/
│   └── images/
├── docs/
├── plugins/
├── scripts/
├── src/
│   ├── api/
│   ├── app/
│   ├── auth/
│   ├── components/
│   ├── constants/
│   ├── data/
│   ├── db/
│   ├── hooks/
│   ├── i18n/
│   ├── lib/
│   ├── services/
│   ├── sync/
│   ├── theme/
│   ├── types/
│   └── utils/
├── supabase/
│   └── functions/
├── tests/
├── app.json
├── package.json
└── project.md

## Documentation
Additional technical documentation is available in:
- [`docs/auth-setup.md`](docs/auth-setup.md) — authentication, OAuth and account management
- [`docs/cloud-sync.md`](docs/cloud-sync.md) — offline-first synchronization architecture
- [`docs/data-handling.md`](docs/data-handling.md) — application data handling
- [`docs/polish-qa.md`](docs/polish-qa.md) — UI/UX QA and polish pass
- [`docs/release-readiness.md`](docs/release-readiness.md) — Android release preparation and verification
## Security
SmartPantry follows several security rules:
- Passwords are handled by Supabase Auth
- Passwords are never stored by SmartPantry
- Mobile builds contain only the Supabase publishable key
- Supabase service-role credentials are server-side only
- Row Level Security protects cloud data
- Avatar storage uses user-specific access policies
- Account deletion uses a server-side Edge Function
- .env, keystores and release artifacts are excluded from Git
## External Services
Open Food Facts
Used for barcode-based and name-based product lookup.
Product coverage depends on the Open Food Facts database and may vary by region.
TheMealDB
Used for recipe discovery, search, categories and recipe details.
Recipe content is provided by the external API and is not translated by SmartPantry.
Supabase
Used for:
- Authentication
- Postgres cloud storage
- Avatar storage
- Edge Functions
- Cloud synchronization

## Known Limitations
- The first synchronization implementation uses whole-row Last Write Wins conflict resolution.
- Clock skew between devices may influence conflict resolution.
- Simultaneous offline lifecycle actions on multiple devices may produce duplicate history events.
- Open Food Facts does not contain every commercial product.
- Recipe matching currently uses lightweight ingredient normalization rather than advanced NLP.
- iOS has not yet received the same level of physical-device testing as Android.

## Future Improvements
Possible future development includes:
- AI-generated recipes
- Improved ingredient matching
- Nutrition information
- Favorite recipes
- Richer analytics
- Onboarding
- Additional synchronization conflict handling
- iOS release testing
License
This project is licensed under the MIT License.
See LICENSE for details.
<p align="center">
  <strong>SmartPantry</strong><br />
  Keep track. Waste less. Cook smarter.
</p>
```
