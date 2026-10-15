import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSystemBarStyle, shouldHideSystemBars } from '@/utils/system-ui';
import { useAppTheme } from './theme-context';

const SystemUIContext = createContext({ hidden: false, bottomInset: 0 });

export function SystemUIProvider({ children }: { children: ReactNode }) {
  const { settings, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Capture navigation clearance before a restored preference hides the bars.
  const [bottomInset, setBottomInset] = useState(() => Math.max(insets.bottom, initialWindowMetrics?.insets.bottom ?? 0));
  if (insets.bottom > 0 && bottomInset !== insets.bottom) setBottomInset(insets.bottom);
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  const hidden = shouldHideSystemBars(Platform.OS, settings.immersiveMode, keyboardVisible);
  const style = getSystemBarStyle(mode);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const keyboard = Keyboard.isVisible();
      setKeyboardVisible(keyboard);
      // Reapply only on resume, never on a timer that would fight edge-swipe reveal.
      const hide = shouldHideSystemBars(Platform.OS, settings.immersiveMode, keyboard);
      StatusBar.setHidden(hide);
      NavigationBar.setHidden(hide);
    });
    return () => subscription.remove();
  }, [settings.immersiveMode]);

  return <SystemUIContext.Provider value={{ hidden, bottomInset }}>
    <StatusBar style={style} hidden={hidden} />
    {Platform.OS === 'android' && <NavigationBar style={style} hidden={hidden} />}
    {children}
  </SystemUIContext.Provider>;
}

export const useSystemUI = () => useContext(SystemUIContext);
