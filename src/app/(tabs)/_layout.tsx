import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { ColorValue, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  name,
  color,
  size,
  focused,
  elevated = false,
}: {
  name: TabIconName;
  color: ColorValue;
  size: number;
  focused: boolean;
  elevated?: boolean;
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  if (elevated) {
    return (
      <View style={[styles.scanButton, focused && styles.scanButtonFocused]}>
        <Ionicons name={name} size={size + 5} color={colors.onAccent} />
      </View>
    );
  }

  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: styles.scene,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.secondary,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: t('nav.inventory'),
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name={focused ? 'cube' : 'cube-outline'} color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t('nav.scan'),
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="scan" color={color} elevated focused={focused} size={size} />
          ),
          tabBarLabelStyle: styles.scanLabel,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: t('nav.recipes'),
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name={focused ? 'restaurant' : 'restaurant-outline'} color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('nav.more'),
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
              color={color}
              focused={focused}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scene: {
    backgroundColor: colors.background,
  },
  tabBar: {
    position: 'absolute',
    zIndex: 2,
    elevation: 9,
    height: Platform.select({ ios: 86, default: 72 }),
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 24, default: 12 }),
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  scanButton: {
    width: 58,
    height: 58,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: colors.accentFill,
    shadowColor: colors.accentFill,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  scanButtonFocused: {
    backgroundColor: colors.accentFill,
  },
  scanLabel: {
    marginTop: 18,
    fontSize: 11,
    fontWeight: '700',
  },
});
