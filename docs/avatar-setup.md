# SmartPantry Private Avatars

## Storage Inspection and Setup

A read-only `getBucket('avatars')` check with this project's public client key returned HTTP 404. An anonymous client cannot conclusively distinguish an absent private bucket from one hidden by permissions. No bucket or remote policy was changed automatically.

In Supabase Dashboard:

1. Open **Storage > Buckets** and inspect whether `avatars` already exists.
2. If absent, create a bucket with name/id **avatars**, **Public OFF**, maximum upload size **5 MB** (5,242,880 bytes), and allowed MIME types **image/jpeg**, **image/png**, **image/webp**.
3. Run the exact SQL in `docs/avatar-storage.sql` using Dashboard **SQL Editor** as the project administrator. The script is idempotent, creates/configures the private bucket, and installs folder-owned SELECT/INSERT/UPDATE/DELETE policies. It does not create a profiles table or modify Inventory, shopping list, history or settings.
4. Review existing Storage policies. The script includes a restrictive owner boundary for `avatars` so an existing broad permissive policy cannot grant cross-user access. Other buckets retain their existing policy behavior.

If an existing `avatars` bucket is public, this script intentionally makes it private. Existing public links into that bucket will cease working; review other applications sharing this bucket before applying it. Google avatar URLs are external and are not changed.

## Object and Metadata Strategy

Each account has one deterministic object: **`{auth.user.id}/avatar`**. The object name intentionally has no extension, so changing from JPEG to PNG or WebP replaces the same object instead of leaving format-specific old files. Actual bytes and their detected MIME type are preserved; Storage serves the correct Content-Type. Original filename/extension are not retained in Storage.

Gallery selection uses Expo ImagePicker with images only, square editing where supported, and quality 0.8. Camera capture is not offered and camera permission is never requested by this flow. The existing barcode scanner's camera permission remains intact. On Android/iOS, Expo FileSystem's `File.arrayBuffer()` reads the selected local file. On web, the picker's browser File is read into an ArrayBuffer. Upload always sends ArrayBuffer, not React Native Blob, File or FormData.

Actual file size is checked before reading and again before upload. JPEG, PNG and WebP signatures are checked rather than trusting an original filename (which may still say HEIC after native picker conversion). Cropping/compression behavior is platform-dependent; oversized final images are rejected. No extra resizing library is installed.

Uploads use `upsert: true`, the detected Content-Type and `cacheControl: '0'`. Successful uploads update only **avatar_path** and **avatar_version** through Auth `updateUser`. Supabase merges this partial metadata update, preserving full_name, name, avatar_url, picture and other existing metadata. No signed URL is persisted. The upload service verifies the current session's user ID before Storage mutation and before metadata updates.

AuthProvider updates its shared user state, then resolves the private avatar once for all screens. Resolution priority is:

1. The current user's custom avatar, via a signed URL.
2. A valid HTTPS avatar_url from Google/Supabase metadata.
3. A valid HTTPS picture URL.
4. Name/email initials.

Signed URLs expire after one hour and are renewed five minutes before expiration and when the app resumes. Signing failures retry after 30 seconds and fall back safely. Image-loading failures also fall back to the account photo/initials. A non-secret version query parameter prevents stale image caching after replacing the same object. Signing state is scoped to account/path/version so a previous user's URL cannot appear after logout/account switching. URLs and upload bodies are never logged or stored as permanent metadata.

## Removal and Failure Handling

Profile asks for confirmation before removing a custom photo. Storage deletes the deterministic object first; Auth then clears avatar_path/avatar_version (null). Original Google metadata remains, so Google photos reappear. Without an account photo, initials reappear.

Auth metadata and Storage are separate services and cannot share a transaction. A failed first-upload metadata update attempts to remove the new object; a failed replacement metadata update never deletes an already-referenced custom avatar. If cleanup is interrupted, at most the single deterministic object remains and the next upload overwrites it. If removal succeeds but metadata update fails, the UI falls back safely and another removal attempt retries metadata clearing. Concurrent edits from multiple devices use last-write-wins behavior.

A signed URL is a temporary bearer URL: anyone who receives that exact URL can use it until expiry. RLS prevents another user from creating signed URLs or managing files in your folder, but cannot revoke an already-disclosed URL immediately. Never log/share signed URLs. This module implements no cloud data synchronization, account deletion, Supabase profile table or avatar sharing.

## Native Build

Added Expo SDK-compatible **expo-image-picker** and a direct **expo-file-system** dependency. Rebuild the development/standalone app to include native modules and the localized iOS photo permission configuration, using the project's normal Expo/EAS workflow. No android/ios source files were manually edited. Web can be tested without a native rebuild; native square editing is not available on web.

## Upload Diagnostics (Development Only)

Retry an upload with the latest JavaScript loaded and look for `[SmartPantry] Avatar storage upload failed` in Metro/device development logs. The record includes only sanitized message, name, numeric status, bucket and object path. It never dumps an error object, session, upload bytes, signed URL or credentials. Production builds suppress these diagnostics.

The stage distinguishes `session check`, `storage upload`, `metadata update` and `upload cleanup` failures. A metadata failure can occur after Storage has successfully accepted the file; the generic Profile message alone cannot distinguish those cases.

- **Bucket not found**: verify the `avatars` bucket exists in the same Supabase project configured in the app.
- **new row violates row-level security policy / Unauthorized**: check the authenticated session and the folder-owned policies in `avatar-storage.sql`. Upsert needs INSERT, SELECT and UPDATE; replacement can fail if only INSERT was granted.
- **Invalid MIME type / size limit**: check the bucket allows JPEG/PNG/WebP and 5,242,880 bytes.
- **Network request failed / timeout**: check device connectivity; this is not evidence of an RLS problem.
- **metadata update failed**: check the Auth request separately; changing Storage policies will not fix an Auth update failure.

An anonymous `getBucket` 404 is not conclusive proof of a missing private bucket. Diagnose the actual authenticated upload error before choosing a fix. The extensionless `{user.id}/avatar` path is deliberate and valid; do not change it to a format-specific path to work around permissions.

## Manual Verification

- Email account with no photo: initials on Profile, Home and More.
- Google account: its current Google photo remains until a custom image is explicitly selected.
- Select/crop JPEG, PNG and WebP; verify successful upload, matching images on all three screens, and persistence after restart/logout/login.
- Replace images across formats; inspect Storage and verify only one `user-id/avatar` object exists.
- Cancel the picker and the removal dialog; verify no data changes.
- Confirm Remove photo; verify the object is deleted, custom metadata clears, and Google photo/initials return.
- Reject an oversized image and unsupported image (e.g. GIF/SVG), without changing metadata or Storage.
- Test upload, metadata-update and removal failures/offline behavior, then retry.
- Test private signed-URL refresh, app background/resume and account switching; no previous user's photo should appear.
- Sign in as User B and attempt upload/upsert/read/sign/delete of User A's path through the Storage SDK. Every operation must be rejected by RLS. Test signed-URL creation, not a URL already issued to User A.
- Check all five languages, theme modes, high contrast and accents.

Live upload/RLS verification requires the dashboard setup and authenticated accounts. Unit tests cover ownership guards, byte validation, upload/replace/removal, metadata preservation, signing and failure compensation; they do not substitute for a live database policy test.

References: [Expo ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), [Expo FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/), [Supabase uploads](https://supabase.com/docs/reference/javascript/storage-from-upload), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
