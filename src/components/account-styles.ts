import { StyleSheet } from 'react-native';
import type { AppColors } from '@/theme/theme';

export const accountStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, gap: 20 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  body: { color: colors.secondary, fontSize: 15, lineHeight: 23 }, label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  input: { minHeight: 56, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 16 },
  primary: { minHeight: 56, padding: 16, borderRadius: 14, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.onAccent, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  destructive: { minHeight: 56, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  danger: { color: colors.danger, fontSize: 15, lineHeight: 23 }, success: { color: colors.success, fontSize: 15, lineHeight: 23 },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, link: { color: colors.accent, fontSize: 15, fontWeight: '600' }, disabled: { opacity: 0.5 },
});
