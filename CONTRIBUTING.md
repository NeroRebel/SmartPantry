# Contributing to SmartPantry

Thanks for your interest in contributing to **SmartPantry**.

SmartPantry is a university mobile application built with Expo, React Native and TypeScript. Contributions that improve reliability, usability, documentation and code quality are welcome.

## Development setup

1. Clone the repository:

```bash
git clone https://github.com/NeroRebel/SmartPantry.git
cd SmartPantry
```

2. Install dependencies:

```bash
npm install
```

3. Create a local `.env` file based on `.env.example`.

4. Start the project:

```bash
npx expo start
```

For features that depend on native modules, use a development build or a native Android build.

## Branches

Create a separate branch for each change:

```bash
git checkout -b feature/my-change
```

## Pull requests

Before opening a pull request:

- keep the change focused;
- make sure TypeScript checks pass;
- run lint;
- run tests;
- update documentation if needed;
- do not commit secrets, `.env` files, keystores, APK/AAB files or private credentials.

Please describe what changed, why it is needed, how it was tested, and include screenshots for UI changes when useful.

## Commit messages

Use clear and concise commit messages, for example:

```text
Add pantry expiration filter
Fix shopping list sync
Improve Android system UI
Update project documentation
```

## Reporting bugs

Use the GitHub **Bug report** issue template and include steps to reproduce, expected behavior, actual behavior, device/Android version, SmartPantry version and screenshots when useful.

## Suggesting features

Use the **Feature request** issue template and explain the problem, the proposed feature and how it would improve SmartPantry.

Thanks for helping improve SmartPantry.
