import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { ColorValue, Platform, StyleSheet, View } from 'react-native';

const colors = {
  background: '#050505',
  tabBar: '#0D0D10',
  tabBarBorder: '#1F1F24',
  active: '#FF5A1F',
  inactive: '#8E8E93',
  scan: '#FF3B30',
  white: '#FFFFFF',
};

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
  if (elevated) {
    return (
      <View style={[styles.scanButton, focused && styles.scanButtonFocused]}>
        <Ionicons name={name} size={size + 5} color={colors.white} />
      </View>
    );
  }

  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: styles.scene,
        tabBarActiveTintColor: colors.active,
        tabBarInactiveTintColor: colors.inactive,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name={focused ? 'cube' : 'cube-outline'} color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="scan" color={color} elevated focused={focused} size={size} />
          ),
          tabBarLabelStyle: styles.scanLabel,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name={focused ? 'restaurant' : 'restaurant-outline'} color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
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

const styles = StyleSheet.create({
  scene: {
    backgroundColor: colors.background,
  },
  tabBar: {
    position: 'absolute',
    height: Platform.select({ ios: 86, default: 72 }),
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 24, default: 12 }),
    backgroundColor: colors.tabBar,
    borderTopColor: colors.tabBarBorder,
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
    backgroundColor: colors.scan,
    shadowColor: colors.scan,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  scanButtonFocused: {
    backgroundColor: colors.active,
  },
  scanLabel: {
    marginTop: 18,
    fontSize: 11,
    fontWeight: '700',
  },
});
