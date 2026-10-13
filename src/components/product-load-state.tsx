import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pantryColors as colors } from '@/constants/pantry-theme';

export function ProductLoadState({ loading, error, onRetry, onBack }: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading product" /> : (
          <>
            <Text style={styles.title}>{error ? 'Unable to load product' : 'Product not found'}</Text>
            <Text style={styles.message}>{error ?? 'This product is no longer in your pantry.'}</Text>
            {error && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}><Text style={styles.buttonText}>Try Again</Text></Pressable>}
          </>
        )}
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.button}><Text style={styles.buttonText}>Back to Inventory</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 },
  title: { color: colors.text, fontSize: 24, fontWeight: '600', textAlign: 'center' },
  message: { color: colors.secondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  button: { minHeight: 48, padding: 16, borderRadius: 12, backgroundColor: colors.surface },
  buttonText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
