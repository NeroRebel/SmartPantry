# SmartPantry — Specification

## 1. Problem

People often forget what food they have at home and when it expires. This leads to unnecessary food waste, duplicate purchases and difficulty deciding what to cook from available ingredients.

SmartPantry addresses this problem by providing one mobile application for pantry tracking, expiration monitoring, barcode-based product entry, recipe discovery, shopping planning and food-waste statistics.

## 2. Users and Roles

### User

A registered user can:

- create an account and sign in;
- manage products in their pantry;
- scan barcodes or add products manually;
- see expiration status and receive reminders;
- discover recipes based on pantry ingredients;
- manage a shopping list;
- mark products as consumed or wasted;
- view food-consumption and waste statistics;
- manage profile, language and appearance preferences;
- synchronize supported data between local storage and the cloud.

There is no administrative role in version 1.

## 3. Functional Requirements

### 3.1 Authentication and Profile

- As a user, I want to register with email and password so that I can create my SmartPantry account.
- As a user, I want to sign in with email/password or Google so that I can access my account.
- As a user, I want to confirm my email and recover or change my password so that I can manage account access safely.
- As a user, I want to edit my display name and avatar so that I can personalize my profile.
- As a user, I want to delete my account so that my remote account data can be removed.

### 3.2 Pantry Management

- As a user, I want to add a product so that it appears in my pantry.
- As a user, I want to edit product information so that my pantry remains accurate.
- As a user, I want to remove a product so that items I no longer have are not shown.
- As a user, I want to search and filter products so that I can quickly find relevant items.
- As a user, I want to see whether a product is expired, expiring soon or fresh so that I know what to use first.
- As a user, I want to use Quick Add presets so that common products can be added faster.

### 3.3 Barcode Scanning and Product Lookup

- As a user, I want to scan a product barcode with the camera so that I can add products faster.
- As a user, I want SmartPantry to look up scanned products using Open Food Facts so that available product information is filled automatically.
- As a user, I want to enter a barcode manually when scanning is not practical.
- As a user, I want to search products by name when a barcode is not found so that I can still complete product entry.
- As a user, I want to enter the expiration date myself so that the application does not invent unreliable expiry information.

### 3.4 Expiration Reminders

- As a user, I want to receive a local reminder before a product expires so that I have time to use it.
- As a user, I want to configure reminder timing so that notifications match my preference.
- As a user, I want reminders to be updated or cancelled when product data changes.

### 3.5 Recipes

- As a user, I want to browse recipes so that I can discover meal ideas.
- As a user, I want to see recipes matched against ingredients in my pantry so that I can cook with food I already have.
- As a user, I want to see available and missing ingredients so that I know what is needed for a recipe.
- As a user, I want to add missing ingredients to my shopping list so that I can prepare for cooking.

### 3.6 Shopping List

- As a user, I want to add, edit and remove shopping-list items so that I can plan purchases.
- As a user, I want to mark items as purchased so that completed items are separated from items still needed.
- As a user, I want to clear purchased items so that the list remains tidy.

### 3.7 History and Statistics

- As a user, I want to mark products as consumed or wasted so that SmartPantry can track outcomes.
- As a user, I want to see counts of consumed and wasted products so that I can understand my habits.
- As a user, I want to see a waste rate and recent activity so that I can evaluate food usage over time.
- As a user, I want to view statistics for different time ranges so that I can compare short- and long-term behavior.

### 3.8 Synchronization

- As a signed-in user, I want supported pantry, shopping-list and history data synchronized with my account so that the data can be restored and used across sessions and devices.
- As a user, I want local functionality to remain available when the network is unavailable so that core pantry management still works offline.
- As a user, I want data from different accounts to remain isolated so that one account cannot see another account's data.

### 3.9 Localization and Appearance

- As a user, I want to use the application in English, Slovak, Russian, Ukrainian or Hungarian so that I can choose a suitable language.
- As a user, I want Light, Dark or System appearance so that the application matches my preference.
- As a user, I want selectable accent colors and High Contrast mode so that I can customize readability and appearance.

## 4. Constraints

- The mobile client is implemented with Expo SDK 57, React Native, Expo Router and TypeScript.
- Android is the primary tested platform for version 1.
- SQLite is the local runtime data store and remains the local source of truth for application CRUD.
- Supabase is used for authentication, remote data storage, private avatar storage and server-side account deletion.
- Product barcode/name lookup uses Open Food Facts.
- Recipe data uses TheMealDB.
- Expiration reminders are local notifications; no remote push-notification infrastructure is required.
- Internet access is required for cloud synchronization, authentication flows and external API requests.
- Core pantry CRUD must continue to work without an active network connection.
- Remote user data must be isolated with Supabase Row Level Security.
- Secrets, signing keys and service-role credentials must not be stored in the public repository.
- The interface must remain usable on typical Android phone screen sizes.

## 5. Out of Scope

The following functionality is intentionally outside version 1:

- AI-generated recipes;
- calorie or nutrition tracking;
- shared household accounts;
- real-time multi-user collaboration;
- social/community features inside the mobile application;
- remote push-notification infrastructure;
- cloud synchronization of all application settings;
- iOS production release;
- automatic food recognition from images.

## 6. Acceptance Criteria

### Pantry

- A user can create, edit and delete a product.
- Product state is displayed as Expired, Expiring Soon or Fresh based on its expiration date.
- Search and status filters update the visible inventory correctly.
- Data remains available after restarting the application.

### Barcode Flow

- Camera permission is requested before scanning.
- A supported barcode can be scanned on a physical Android device.
- A matching Open Food Facts result can prefill the product form.
- If no barcode result exists, the user can continue through manual or name-search fallback.
- Expiration date is never invented by the lookup flow.

### Recipes

- Recipe data can be loaded from TheMealDB when network access is available.
- Pantry ingredients are compared with recipe ingredients.
- Available and missing ingredients are displayed.
- Missing ingredients can be added to the shopping list.

### Notifications

- A local reminder can be scheduled for an expiring product.
- Editing the expiration date updates the relevant reminder.
- Removing, consuming or wasting a product cancels the relevant reminder.

### Statistics

- Consumed and wasted actions create history records.
- Statistics display consumed, wasted and total counts.
- Waste rate is calculated from recorded history.
- Time-range filters change the displayed statistics.

### Authentication and Sync

- Email/password sign-in works.
- Google sign-in works.
- Data is isolated by authenticated user.
- Local CRUD works without network access.
- Synchronization can reconcile local and remote changes after connectivity returns.
- Account deletion removes the remote account and its dependent cloud data.

### Localization and Appearance

- All five supported application languages can be selected.
- Light, Dark and System themes can be selected.
- Accent selection does not replace semantic warning/error/success colors.

## 7. Open Questions

The following items are not blockers for version 1 but may influence future development:

- Should SmartPantry support shared household pantries in a future version?
- Should recipe matching use a more advanced ingredient-normalization model?
- Should nutrition information be added from an external source?
- Should cloud synchronization be extended to application preferences?
- Should a future iOS release be prepared and tested?
- Should AI-assisted recipe generation be added as an optional feature?
