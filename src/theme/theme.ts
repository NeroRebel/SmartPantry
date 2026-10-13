import type { AccentColor, ThemeMode } from '@/types/app-settings';

export type ResolvedTheme = 'light' | 'dark';

export function resolveThemeMode(mode: ThemeMode, system: 'light' | 'dark' | null | undefined): ResolvedTheme {
  return mode === 'system' ? system === 'light' ? 'light' : 'dark' : mode;
}

const accents = {
  orange: { dark: '#FF6B3D', light: '#B64116', fill: '#EF6A3E', onFill: '#FFFFFF', hero: ['#A72D27', '#D34730', '#EE7941'] },
  purple: { dark: '#C989FF', light: '#7432A9', fill: '#853DC2', onFill: '#FFFFFF', hero: ['#502477', '#7438A8', '#9A55C9'] },
  green: { dark: '#73DB9B', light: '#176B40', fill: '#238952', onFill: '#FFFFFF', hero: ['#155137', '#25784D', '#409A68'] },
  red: { dark: '#FF7075', light: '#B82F38', fill: '#D9434C', onFill: '#FFFFFF', hero: ['#8E252C', '#B6383D', '#D85559'] },
  yellow: { dark: '#FFD468', light: '#795400', fill: '#FFD05A', onFill: '#19140A', hero: ['#78510D', '#9C6816', '#BD8724'] },
} as const;

const status = {
  dark: { fresh: '#68D8A0', soon: '#FFBE55', expired: '#FF625C' },
  light: { fresh: '#187549', soon: '#8B5800', expired: '#B82F38' },
};

export function createTheme(mode: ResolvedTheme, highContrast: boolean, accentColor: AccentColor) {
  const accent = accents[accentColor];
  const dark = mode === 'dark';
  const base = dark ? {
    background: '#050505', surface: highContrast ? '#1D1D20' : '#141416', surfaceElevated: highContrast ? '#28282B' : '#1B1B1E',
    text: '#FFFFFF', secondary: highContrast ? '#E1E1E5' : '#99999F', border: highContrast ? '#77777F' : '#252528',
  } : {
    background: highContrast ? '#FFFFFF' : '#F5F6F8', surface: '#FFFFFF', surfaceElevated: highContrast ? '#ECEEF1' : '#F0F1F3',
    text: '#17191D', secondary: highContrast ? '#3B3F45' : '#656A73', border: highContrast ? '#646A72' : '#DDE0E5',
  };
  const semantic = status[mode];
  return {
    mode,
    colors: {
      ...base,
      accent: dark ? accent.dark : accent.light,
      accentFill: accent.fill,
      onAccent: accent.onFill,
      accentSoft: dark ? `${accent.dark}24` : `${accent.fill}1F`,
      accentBorder: dark ? `${accent.dark}80` : `${accent.light}80`,
      heroGradient: accent.hero as readonly [string, string, string],
      heroText: '#FFFFFF',
      ...semantic,
      success: semantic.fresh, warning: semantic.soon, danger: semantic.expired,
      white: base.text, orange: dark ? accent.dark : accent.light,
      red: semantic.expired, yellow: semantic.soon, green: semantic.fresh,
    },
  };
}

export type AppColors = ReturnType<typeof createTheme>['colors'];
