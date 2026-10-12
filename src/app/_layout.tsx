import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const smartPantryTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#050505',
    card: '#0C0C0F',
    primary: '#FF5A1F',
    text: '#FFFFFF',
    border: '#1C1C20',
    notification: '#FF3B30',
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={smartPantryTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
