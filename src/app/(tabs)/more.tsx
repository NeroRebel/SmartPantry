import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pantryColors as colors } from '@/constants/pantry-theme';

export default function MoreScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>More</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Statistics" onPress={() => router.push('/statistics')} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <Ionicons name="bar-chart-outline" size={23} color={colors.accent} />
          <Text style={styles.rowText}>Statistics</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, gap: 26 },
  title: { color: colors.text, fontSize: 34, fontWeight: '700' },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  rowText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
