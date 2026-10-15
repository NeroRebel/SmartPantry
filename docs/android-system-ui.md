# Android system bars and safe areas

SmartPantry uses Expo SDK 57 / React Native 0.86 edge-to-edge layout, already
enabled in the generated Android project. Do not add deprecated bar background,
translucency, or edgeToEdgeEnabled app-config overrides. The transparent system
areas show the themed root/screen background beneath them.

- Root layout keeps the status and navigation bars visible by default and supplies explicit
  icon styles from the resolved app appearance, including System mode. High
  Contrast and accents do not override the required icon contrast.
- The expo-navigation-bar config plugin disables Android's navigation contrast
  scrim. This is safe because the app paints an opaque theme background and
  explicitly supplies light icons for dark mode and dark icons for light mode.
  Optional Android immersive fullscreen is managed by the same system-UI provider.
- The tab bar uses the same background token as the root. Its 60-point content
  area plus max(bottom inset, 12) replaces the former fixed platform heights.
  Only this bar owns the bottom safe-area inset. The existing Scan symbol remains
  raised above the bar; the button and its geometry are unchanged.
- Tab screens use top/left/right SafeAreaView edges and the navigator's actual
  tab-bar height for scroll clearance. Scan already uses this pattern. No extra
  status-bar-height padding is applied. Header padding is normal design spacing.
- Profile, authentication and product/password forms already use all safe-area
  edges. Their existing KeyboardAvoidingView/scroll behavior is retained. Tabs
  hide while the keyboard is open, but Android system navigation remains visible.
- Native-stack content uses the app background, preventing differently colored
  system areas during navigation transitions and authentication loading.

## Optional immersive fullscreen (Android only)

Enable **More > Appearance > Immersive fullscreen**. It defaults off and persists
as `notification_settings.immersive_mode` (a safe ADD COLUMN migration, default 0).
Existing inventory, history, accounts, notifications and appearance values remain
unchanged. iOS/web do not show the switch or hide system bars.

`SystemUIProvider` supplies one visibility state to expo-status-bar,
expo-navigation-bar and both native-stack navigators, including auth. Expo SDK 57's
navigation module sets `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE` when hiding the bar;
there is no gesture-exclusion region, custom back interception or visibility loop.
Android retains system back gestures and temporarily reveals bars on edge swipes.

The keyboard suspends immersive hiding until it closes. Existing adjustResize,
safe areas and keyboard-aware scroll views remain in use. Keyboard visibility
events are limited on Android 10 and earlier; verify those devices separately.
Returning from background reapplies the selected visibility through Expo APIs.

While immersive, the tab layout retains the last visible bottom inset and a
minimum 24-point gesture clearance even if hidden navigation reports zero inset.
All tab screen clearance still comes from useBottomTabBarHeight, with no second
bottom safe-area padding. The Scan button geometry is unchanged.

The native plugin defaults stay visible so a cold launch can safely restore the
persisted preference rather than changing iOS or forcing fullscreen for everyone.

## Build and verify

`expo-navigation-bar` is a new native dependency. Regenerate native configuration
with `npm run android:prepare`, then rebuild using the existing development or
release build workflow. A Metro refresh alone cannot apply the native plugin or
add the module to an older installed app.

Physical-device QA is still required; no phone is connected to this task. Test
gesture navigation and three-button navigation separately, including after
switching modes/restarting:

1. Open Home, Inventory, Scan, Recipes and More. Check clock/icons remain visible,
   top headers clear cutouts, and all tabs/raised Scan button are tappable.
2. Scroll each list to the bottom; its last item must clear the tab bar. Check
   the area behind the Android buttons/gesture handle matches the bar.
3. Open Profile, Sign In/Sign Up and Add/Edit Product; use the keyboard, dismiss
   it and navigate back. Check no covered submit controls or stranded blank band.
4. Repeat in Light, Dark, System (change the OS theme) and High Contrast, including
   an app-theme selection opposite to the OS theme.
5. Check avatar/reminder dialogs, scanner camera/manual mode and auth return links.
6. Enable immersive mode; verify both bars hide, an edge swipe reveals them
   temporarily, side-swipe Back works, and tabs remain tappable. Open an input:
   keyboard/system controls should be usable; dismissing it restores fullscreen.
   Restart the app, then disable the switch to verify normal edge-to-edge returns.

Android/OEMs retain control of the gesture handle and keyboard's own navigation
area; its appearance can follow the IME rather than the app while typing. Android
7 devices cannot display dark navigation-button glyphs. Expo also documents an
Android 15 emulator navigation-style bug, so an emulator is not sufficient proof
of three-button appearance on a physical device.

References: [SDK 57 NavigationBar](https://docs.expo.dev/versions/v57.0.0/sdk/navigation-bar/)
and [SDK 57 StatusBar](https://docs.expo.dev/versions/v57.0.0/sdk/status-bar/).
