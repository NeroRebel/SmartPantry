import type { ResolvedTheme } from '@/theme/theme';

// Both Expo components name the foreground (icon/text) color, not the background.
export function getSystemBarStyle(mode: ResolvedTheme): 'light' | 'dark' {
  return mode === 'dark' ? 'light' : 'dark';
}

export function shouldHideSystemBars(platform: string, immersiveMode: boolean, keyboardVisible: boolean) {
  return platform === 'android' && immersiveMode && !keyboardVisible;
}

export function getTabBarLayout(bottomInset: number, immersiveMode = false) {
  const paddingBottom = Math.max(immersiveMode ? 24 : 12, Number.isFinite(bottomInset) ? bottomInset : 0);
  return { height: 60 + paddingBottom, paddingBottom };
}
