# SmartPantry

## What problem am I solving?

SmartPantry helps users reduce food waste by keeping track of food products at home and notifying them before the products expire.

## Who are my users?

The target users are people who want to organize the food they have at home, monitor expiration dates, and reduce unnecessary food waste.

The application is mainly intended for:
- students,
- people living alone,
- households and families,
- users who want to plan food consumption more efficiently.

## How do I want to solve the problem? — MVP

The minimum viable product will allow the user to:

- add a food product manually,
- scan a product barcode using the phone camera,
- store the product name, quantity, and expiration date,
- view a list of stored food products,
- categorize products by status:
  - fresh,
  - expiring soon,
  - expired,
- edit or delete products,
- receive a local notification when a product is close to its expiration date.

The main goal of the MVP is to provide a simple digital overview of the food products the user currently has at home.

## What will not be included in the MVP? — Non-goals

The first version of the application will not include:

- **AI-based food recognition from photos** — this would require image processing or an external AI service and is not necessary for the core functionality.
- **AI-generated recipe recommendations** — this can be added later as an optional extension.
- **Personalized nutrition plans and calorie tracking** — the MVP focuses primarily on food inventory and expiration tracking.
- **Social features and shared household accounts** — these would require authentication, user management, and data synchronization.
- **A complex cloud backend** — local storage is sufficient for the MVP.

These features are excluded from the MVP to keep the first version simple, realistic, and focused on the main problem.

## Technologies

### Mobile application
- React Native
- Expo
- TypeScript

### Local data storage
- SQLite
- Expo SQLite

### Phone features
- Camera — barcode scanning
- Local notifications — expiration date reminders

### External services
- Open Food Facts API — retrieving basic product information using a barcode

### Development and version control
- Visual Studio Code
- Git
- GitHub
- Codex