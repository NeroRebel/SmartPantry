import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';

export function ProductLoadState({ loading, error, onRetry, onBack }: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={colors.accent} accessibilityLabel={t('common.loading')} /> : (
          <>
            <Text style={styles.title}>{error ? t('product.loadError') : t('product.notFound')}</Text>
            <Text style={styles.message}>{error ? t('common.pleaseTryAgain') : t('product.gone')}</Text>
            {error && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}><Text style={styles.buttonText}>{t('common.tryAgain')}</Text></Pressable>}
          </>
        )}
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.button}><Text style={styles.buttonText}>{t('product.backInventory')}</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 },
  title: { color: colors.text, fontSize: 24, fontWeight: '600', textAlign: 'center' },
  message: { color: colors.secondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  button: { minHeight: 48, padding: 16, borderRadius: 12, backgroundColor: colors.surface },
  buttonText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
