import Ionicons from '@expo/vector-icons/Ionicons';
import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { dismissFeedback, getFeedback, subscribeFeedback } from '@/services/feedback';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';

export function FeedbackHost() {
  const feedback = useSyncExternalStore(subscribeFeedback, getFeedback, () => null);
  const { user } = useAuth();
  const { t } = useTranslation();
  const { colors, styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  if (!feedback || feedback.owner !== (user?.id ?? '')) return null;
  const color = feedback.tone === 'error' ? colors.danger : colors.success;
  return <View pointerEvents="box-none" style={[styles.position, { bottom: Math.max(insets.bottom, 12) + 80 }]}>
    <View style={[styles.banner, { borderColor: color }]}>
      <Ionicons accessible={false} name={feedback.tone === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={22} color={color} />
      <View style={styles.copy}>
        <Text accessibilityRole={feedback.tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.text}>{t(feedback.key, feedback.values)}</Text>
        {feedback.action && <Pressable accessibilityRole="button" onPress={() => { dismissFeedback(feedback.id); feedback.action!.run(); }} style={styles.action}><Text style={styles.link}>{t(feedback.action.key)}</Text></Pressable>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => dismissFeedback(feedback.id)} style={styles.close}><Ionicons name="close" size={20} color={colors.secondary} /></Pressable>
    </View>
  </View>;
}
const createStyles = (colors: AppColors) => StyleSheet.create({
  position: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  banner: { width: '100%', maxWidth: 560, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderRadius: 12, backgroundColor: colors.surfaceElevated },
  copy: { flex: 1, minWidth: 0 }, text: { color: colors.text, fontSize: 14, lineHeight: 21 },
  action: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: colors.accent, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
