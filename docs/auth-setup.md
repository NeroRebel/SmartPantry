# SmartPantry Authentication Setup

Authentication uses Supabase Auth only. Inventory, shopping items, history and settings remain in local SQLite. Signing out does not remove them. They are shared local device data in this phase, not isolated per account. No cloud tables or synchronization are introduced.

## Environment

Create a local `.env` with the two names in `.env.example`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Get the URL and `sb_publishable_...` key from your Supabase project's Connect dialog / API Keys settings. These values are public client configuration. Never use a secret key or service-role key here. `.env` and `.env.*` files are ignored; `.env.example` contains no credentials and is tracked. Restart Metro after changing environment values.

## Supabase Dashboard

1. Enable Email/password under Authentication providers. Choose whether email confirmation is required. With confirmation enabled, signup displays instructions to confirm the email; it does not grant access until Supabase issues a session.
2. In Authentication > URL Configuration, add `smartpantry://auth/callback` to Redirect URLs.
3. For web testing, add the exact browser callback origin and path, e.g. `http://localhost:8091/auth/callback`. Add your deployed HTTPS callback URL separately. Set Site URL to your deployed web URL when available.
4. Ensure your confirmation email template honors the provided redirect URL. Email links are handled by the callback route. PKCE confirmation should be opened on the device/browser where signup began; if the email was confirmed elsewhere, sign in with email/password on this device.
5. Configure email delivery/SMTP before production use and check the project's auth rate limits.

## Google Cloud and Supabase Google Provider

1. Create a Google Cloud project and configure its OAuth consent screen (branding, support contact and audience). Add your test users while the consent screen is in Testing.
2. Create an OAuth client of type **Web application**, since Supabase handles the Google OAuth exchange.
3. Add the exact callback URL shown by Supabase's Google provider settings as an authorized redirect URI. For a hosted project this is `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`. This is different from the mobile app callback.
4. Configure authorized JavaScript origins as needed for your Supabase project and deployed web application. Do not add paths to origins.
5. In Supabase Authentication > Providers > Google, enable Google and enter the Google client ID and client secret. The client secret belongs only in the Supabase dashboard, never in the app or `.env`.

## Native and Web Redirects

`app.json` already registers the `smartpantry` scheme. Native Google sign-in uses `openAuthSessionAsync` and `smartpantry://auth/callback`; Supabase returns a PKCE authorization code that the app exchanges for a session. Both a running-app redirect and a cold-start callback are supported. Duplicate callback delivery exchanges the code once. Cancellation leaves the user signed out.

Use a development build / standalone app on a physical device for the custom scheme. Expo Go does not register your app's custom scheme. Rebuild after adding the native session dependencies. No Google client secret or native Google SDK is included in SmartPantry.

On web, Google redirects the current page to Supabase, then back to the same-origin `/auth/callback` route. The callback exchanges the code using the verifier stored in the browser. Your hosting must serve exported callback routes and use HTTPS in production.

## Session and Data Behavior

The singleton client uses `persistSession`, automatic token refresh and PKCE. Expo Crypto supplies secure random values and SHA-256 for native PKCE; the browser retains its own WebCrypto. Native sessions use AsyncStorage; web sessions use Supabase's browser storage. Native token refresh runs while the app is active and stops in the background. `AuthProvider` restores the initial session, subscribes to auth changes and exposes auth actions. Protected routes are unavailable until restoration completes. A restore failure allows retry or another sign-in.

Passwords are passed to Supabase and are never stored by app code. Auth failures are converted to localized messages. Auth code does not log passwords, tokens or callback URLs. Sign-out removes the Supabase session; it does not clear SQLite, reminders, appearance or language.

## Manual Verification

- Email signup with confirmation enabled: expect confirmation instructions and no access to tabs before confirmation.
- Confirm the email, sign in, sign out, then sign in again. Test incorrect credentials and unconfirmed email.
- Restart the app after sign-in and verify the session is restored without a flash of the main app while signed out.
- Start Google sign-in, cancel, then complete a new sign-in. Check Google name, email and avatar on More/Profile.
- Restart after Google sign-in, verify persistence, then sign out.
- Open Inventory/Product Detail/Statistics deep links while signed out: expect the auth flow.
- Try opening Sign In while authenticated: expect the main application.
- Verify local products, shopping list, history and settings are unchanged across sign-out and a different login.

References: [Supabase React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native), [native deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google), [Expo protected routes](https://docs.expo.dev/router/advanced/protected/).
