# SmartPantry Authentication Setup

Authentication uses Supabase Auth only. Inventory, shopping items, history and settings remain in local SQLite. Signing out does not remove them. They are shared local device data in this phase, not isolated per account. No cloud tables or synchronization are introduced.

## Password Account Management

Sign In > Forgot password opens `/(auth)/forgot-password`. The email is trimmed and validated with the existing email validator. Requests show the same privacy-friendly success text whether or not an account exists, with a 60-second client cooldown; Supabase rate limits remain authoritative. Passwords are never passed through navigation, saved locally or logged.

The actual service call is:

```ts
const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), {
  redirectTo: web ? redirectTo : 'smartpantry://auth/callback',
});
if (error) { logPasswordError('send-reset-link', error); throw error; }
```

Native resets explicitly reuse `smartpantry://auth/callback`, never Site URL. Web resets keep the existing computed browser callback. The installed Supabase client uses PKCE and persists its verifier. Open a newly requested reset email on the same device/app installation that requested it; opening the email in Windows cannot launch the Android emulator, and reinstalling/clearing app storage or using another device can lose the verifier. Request a fresh link in the intended installation if exchange fails.

### Callback, Session and Recovery Routing

The existing `auth/callback` route and service still process Google OAuth and signup confirmation. Code callbacks reuse `exchangeCodeForSession(code, { flowId })` when the SDK returns a flow ID. Recovery is detected through the SDK's `PASSWORD_RECOVERY` auth event and PKCE exchange `redirectType === 'recovery'`. Legacy `type=recovery` token callbacks reuse the existing `setSession` path; they must establish a real Supabase session before reset access is granted. Empty/error callbacks never authorize a reset.

AuthProvider tracks recovery independently of a normal signed-in session. Protected application routes remain unavailable during recovery and callback processing, preventing recovery sessions from jumping to Home before password entry. The existing callback route no longer skips processing simply because another session already exists.

Only a recovery **user ID routing marker** is saved in the existing AsyncStorage approach. After restart, it is honored only if it matches the real session restored by Supabase. It is not a credential or proof of authentication. Passwords, reset links, codes and tokens are not saved by this feature. Supabase alone manages its supported persisted session and PKCE verifier.

`/(auth)/reset-password` uses `auth.updateUser({ password: newPassword })`. Reset and signup share the eight-character minimum and matching-confirmation rules; passwords are not trimmed. On success the recovery marker is cleared, a themed/localized success state appears, and **Continue** opens Home using the existing valid session. No forced re-login is introduced. Cancelling recovery signs out before returning to Sign In, without touching SQLite. If a reset session expires, request another link. Restarting after a completed reset opens the normal application session.

### Authenticated Password Changes

Profile > Change password opens `/settings/change-password`, reusing the reset form. The row is shown for email identities, including accounts linked to both email and Google. Google-only accounts instead see a provider-managed-password notice. No password credential is inferred from merely having an email address.

Supabase validates `updateUser({ password })` using the authenticated session. If Secure Password Change requires reauthentication, the UI offers `auth.reauthenticate()`, then submits `updateUser({ password, nonce })` with the received code. That code remains only in component memory. Sending another code has a 60-second cooldown. No current-password comparison or custom verification is implemented. Weak/same passwords, expired sessions, invalid links, rate limits, reauthentication and network errors map to localized feedback. Development diagnostics contain only operation, SDK error code/name and numeric status, never raw error messages or requests.

### Required Dashboard Settings

1. Keep **Authentication > Providers > Email** enabled and preserve the existing Confirm email setting.
2. Keep **Authentication > URL Configuration > Redirect URLs** allowing exactly `smartpantry://auth/callback`. Add each explicit browser callback used for web builds. The Site URL does not override the explicit native redirect.
3. Under **Authentication > Email Templates > Reset Password**, use the standard Supabase confirmation URL, for example `<a href="{{ .ConfirmationURL }}">Reset password</a>`. Do not link directly to `{{ .SiteURL }}` or directly to the app: Supabase must validate the recovery token first. The configured redirect is applied after validation.
4. Configure SMTP/email delivery, recovery expiry and rate limits appropriately for the project. Supabase's minimum password strength may be stricter than the app's eight-character baseline; server errors are handled.
5. Secure Password Change may remain enabled; use its supported reauthentication email/code flow when prompted. No new Google configuration, database table, Storage bucket or native scheme is needed.

### Password Verification Checklist

- Request a reset from Sign In; check generic success, invalid email, offline error and cooldown.
- Open a **new** reset email inside Android/on the requesting phone. Confirm Reset Password appears, not Home.
- Set a valid password; check success and Continue to Home. Sign out and verify the old password fails and the new one succeeds.
- Try mismatched/short passwords, an expired/used link and a link opened after losing the PKCE verifier; request another link from the error state.
- Restart while waiting for the email and while on Reset Password; no crash, and an established recovery session remains gated to reset.
- As an email user, change the password from Profile. If required, send/enter the reauthentication code; test wrong/expired codes and retry after cooldown.
- As a Google-only user, verify the informational notice and unchanged Google login. Linked email/Google users retain Change password.
- Regression-test signup confirmation, Google OAuth, session persistence, avatar upload and unchanged local Inventory/history/shopping/settings.
- Check the three new screens in EN/SK/RU/UK/HU and all theme modes, accents and high contrast.

Automated tests cover service calls, PKCE/legacy recovery, session guards, recovery restart state and completion, error mapping, provider identities and translation parity. Live email delivery, account password changes and device-link opening still require a configured Supabase project and test account. No live account password is changed by the automated suite.

## Confirmed Desktop-to-Emulator Handoff Issue

The reported new email already contains `redirect_to=smartpantry://auth/callback`, but it is being opened in a **Windows desktop browser**. Windows cannot dispatch an Android app's custom scheme to an emulator. The installed emulator app correctly resolves this URL to `com.nerorebel.smartpantry/.MainActivity`; a token-free callback intent also reached the existing callback UI. This is not a missing Android scheme or a native signup Site URL fallback.

For automatic mobile sign-in, open a **new** confirmation email inside Android/the emulator (or on the same physical phone where registration began). For confirmation on Windows, let Supabase confirm the email, then manually return to the mobile app and sign in with the confirmed email/password. The app cannot automatically open itself from an unrelated desktop browser. No desktop-to-emulator bridge is implemented.

If opening on Android still stays in a browser, check its external-app-opening prompt/settings. Test an installed development/standalone build, not Expo Go. Do not share full confirmation URLs: they contain single-use secrets. Share only the decoded `redirect_to` value and safe diagnostic booleans.

The emulator is running an Expo development build. On cold start it can open the Expo launcher when it cannot reach the last Metro server; that is not a Supabase session error. During verification, reconnecting Metro on port 8081 loaded the app again. Keep Metro running and load the project before testing email links in development; a standalone build does not require Metro. Token-free emulator probes verified native callback delivery, the simulated no-session confirmation state, sequential error-state replacement, and the Sign In action. Real email delivery/code exchange, live Google account login, and authenticated-session restoration still require account/device testing.

## Exact Service Calls

Before this update, the factory set `const emailRedirectTo = web ? redirectTo : emailConfirmationRedirectUri`, where `emailConfirmationRedirectUri` was already `smartpantry://auth/callback`. Its signup method was:

```ts
async signUp(name: string, email: string, password: string) {
  const { data, error } = await requireClient().auth.signUp({ email: email.trim(), password,
    options: { data: { full_name: name.trim() }, emailRedirectTo } });
  if (error) throw error;
  return { session: data.session, confirmationRequired: !data.session };
}
```

The current method places the mobile redirect literal inside the method, while preserving the explicit web callback for web registration:

```ts
async signUp(name: string, email: string, password: string) {
  const options = {
    emailRedirectTo: 'smartpantry://auth/callback',
    data: { full_name: name.trim() },
  };
  // Browser registration keeps its explicit browser callback, never the Site URL fallback.
  if (web) options.emailRedirectTo = redirectTo;
  logEmailRedirect(options.emailRedirectTo);
  const { data, error } = await requireClient().auth.signUp({ email: email.trim(), password, options });
  if (error) throw error;
  return { session: data.session, confirmationRequired: !data.session };
}
```

The exact resend method is:

```ts
async resendConfirmationEmail(email: string) {
  if (!isValidVerificationEmail(email)) failure('email_address_invalid');
  const options = { emailRedirectTo: 'smartpantry://auth/callback' };
  if (web) options.emailRedirectTo = redirectTo;
  logEmailRedirect(options.emailRedirectTo);
  const { error } = await requireClient().auth.resend({ type: 'signup', email: email.trim(), options });
  if (error) throw error;
}
```

The AuthProvider's existing 60-second resend cooldown is unchanged. Google continues using the existing `redirectTo`, not a new email callback mechanism.

## Environment

Create a local `.env` with the two names in `.env.example`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Get the URL and `sb_publishable_...` key from your Supabase project's Connect dialog / API Keys settings. These values are public client configuration. Never use a secret key or service-role key here. `.env` and `.env.*` files are ignored; `.env.example` contains no credentials and is tracked. Restart Metro after changing environment values.

## Supabase Dashboard

1. Under **Authentication > Sign In / Providers > Email**, enable Email/password and **Confirm email**. Confirmation must remain enabled to prevent access before email verification. No OTP length setting is required; SmartPantry uses confirmation links, not code entry.
2. In Authentication > URL Configuration, add `smartpantry://auth/callback` to Redirect URLs.
   Native signup and resend explicitly send this exact URL; they do not use the Site URL as a fallback. Web signup/resend still send the explicit web callback. If Site URL remains `http://localhost:3000`, keep it only for local web development and replace it with your deployed web URL before production. Use the `{{ .ConfirmationURL }}` template below; a custom link using `{{ .SiteURL }}` or a hardcoded localhost URL can bypass the intended redirect. Retest with a newly sent email, not an older link.
3. For web testing, add the exact browser callback origin and path, e.g. `http://localhost:8091/auth/callback`. Add your deployed HTTPS callback URL separately. Set Site URL to your deployed web URL when available.
4. Under **Authentication > Email Templates > Confirm signup**, restore the standard confirmation-link template below. Use `{{ .ConfirmationURL }}`, not the previous code-only `{{ .Token }}` template or a direct link to the app. Supabase must confirm the email before redirecting to the app. Signup and resend both specify `emailRedirectTo` using the existing callback route.
5. Configure email delivery/SMTP before production use and check the project's auth rate limits.

Example Confirm signup subject: `Confirm your SmartPantry email`

```html
<h2>Confirm your SmartPantry email</h2>
<p>Follow this link to finish creating your account:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm my email</a></p>
<p>If you did not create this account, you can ignore this email.</p>
```

For real recipient testing, configure **Authentication > Email / SMTP Settings** with your SMTP provider. Supabase's built-in mail service restricts recipients and delivery rates; do not assume it can deliver to arbitrary users. Keep the resend rate limit compatible with the app's **60-second cooldown**; server-side limits may still reject a request. The email template is configured server-side and is not automatically localized by the app.

## Registration Confirmation

Signup still uses email/password, `full_name` metadata and the existing `emailRedirectTo`. With confirmation enabled, a null session is expected: password fields are cleared and the app opens `/(auth)/check-email`. The screen shows the pending email, confirmation-link instructions, resend and Back to Sign In. It does not create an authenticated session. Google and existing confirmed email logins are unchanged.

Resend calls `resend({ email, type: 'signup', options: { emailRedirectTo } })`, never another signup. AsyncStorage holds only the pending email and resend deadline. It never contains the registration password. Restart returns to Sign In, where **Confirm an unverified email** resumes the saved email. An unconfirmed-email sign-in error also provides a resend action that opens Check Email for the entered address. If local storage is unavailable, the user can enter their email on Check Email after restart. Pending data clears after successful authentication. Inventory, shopping list, history and settings are not touched.

Email links reuse `/auth/callback` and the existing callback parser: PKCE codes are exchanged for a real session; returned session tokens use Supabase's `setSession`. For PKCE, open the link on the same app installation or browser that initiated signup/resend, where the code verifier is stored. If confirmation happens in a different browser/device, the email may be confirmed without establishing this app's session: return to Sign In and use the confirmed email/password. A recognized email callback with no session or a missing/expired PKCE verifier shows **Email confirmed. Please sign in.** It never grants protected-route access without a real session. Callback error responses and network failures remain errors. Email callback detection uses `type=signup` / `type=email` when present, otherwise the locally pending registration as a hint; an unmarked PKCE code alone does not identify its provider. The callback always provides a Sign In action, including after errors or timeouts. Duplicate account registrations may return an obfuscated response for privacy, so a null session does not guarantee that an email was sent.

The configured flow is **PKCE** (`flowType: 'pkce'`), not OTP. The installed SDK creates and stores a verifier during signup and resend. The callback calls `exchangeCodeForSession(code, flowId ? { flowId } : undefined)`; when `sb_flow_id` is supplied, it selects that SDK flow's stored verifier. The app does not enable the experimental flag that adds flow IDs to redirects, so the exact mobile allowlist entry remains valid. Token-bearing legacy callbacks use `setSession` through the same service. Active Google OAuth is not classified as an email callback merely because an old email registration is pending.

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

Passwords are passed to Supabase and are never stored by app code. Auth failures are converted to localized messages. Development-only callback diagnostics log the configured callback path with query/hash values redacted, the email-detection flag/source, the inferred or returned provider, and whether a session was created. Signup and resend also log whether the exact mobile confirmation redirect is configured. They never log raw callback URLs, passwords, codes, flow IDs, tokens, user objects or errors. Sign-out removes the Supabase session; it does not clear SQLite, reminders, appearance or language.

## Manual Verification

- Register a new email account: expect Check Email and no access to protected tabs before confirmation. Verify the email contains a clickable confirmation link, not a six-digit code.
- Open the link on the original device/browser: verify the Supabase user is confirmed and the callback opens the authenticated app. Test expired/used links and callback errors.
- Resend after the 60-second cooldown; verify delivery and that repeated taps cannot send extra requests. Test server rate limits and offline errors.
- Restart before confirmation, resume from Sign In, and verify the email and cooldown persist. Confirm no password is persisted.
- Try signing in before confirmation: expect the helpful email-not-confirmed message and resend action.
- Confirm in another browser/device, then sign in manually. After confirmation, sign out and sign in normally with email/password.
- Restart the app after sign-in and verify the session is restored without a flash of the main app while signed out.
- Start Google sign-in, cancel, then complete a new sign-in. Check Google name, email and avatar on More/Profile.
- Restart after Google sign-in, verify persistence, then sign out.
- Open Inventory/Product Detail/Statistics deep links while signed out: expect the auth flow.
- Try opening Sign In while authenticated: expect the main application.
- Verify local products, shopping list, history and settings are unchanged across sign-out and a different login.

References: [Supabase React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native), [native deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [resend](https://supabase.com/docs/reference/javascript/auth-resend), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Expo protected routes](https://docs.expo.dev/router/advanced/protected/).
