import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { lookupBarcode } from '@/api/open-food-facts';
import { getProducts } from '@/db/products';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { findBarcodeProduct, isValidBarcode } from '@/utils/scanned-product';

type LookupState = 'ready' | 'loading' | 'notFound' | 'error' | 'invalid';

function ScanAction({ label, onPress, primary = false, icon = 'arrow-forward' }: {
  label: string; onPress: () => void; primary?: boolean; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, primary && styles.primary]}>
    <Ionicons name={icon} size={21} color={primary ? colors.onAccent : colors.accent} />
    <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
  </Pressable>;
}

export default function ScanScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [permission, requestPermission, getPermission] = useCameraPermissions({ get: false });
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [manual, setManual] = useState(Platform.OS === 'web');
  const [barcode, setBarcode] = useState('');
  const [state, setState] = useState<LookupState>('ready');
  const [torch, setTorch] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [permissionFailed, setPermissionFailed] = useState(false);
  const locked = useRef(false);
  const request = useRef<AbortController | null>(null);
  const active = useRef(false);

  useFocusEffect(useCallback(() => {
    active.current = true;
    setFocused(true);
    setState('ready');
    setManual(Platform.OS === 'web');
    locked.current = false;
    if (Platform.OS !== 'web') void getPermission().catch(() => setPermissionFailed(true));
    return () => {
      active.current = false;
      setFocused(false);
      setTorch(false);
      request.current?.abort();
    };
  }, [getPermission]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      setForeground(next === 'active');
      if (next !== 'active') setTorch(false);
      else if (active.current && Platform.OS !== 'web') void getPermission().catch(() => setPermissionFailed(true));
    });
    return () => subscription.remove();
  }, [getPermission]);

  const reset = () => { request.current?.abort(); locked.current = false; setState('ready'); setManual(Platform.OS === 'web'); setTorch(false); setCameraFailed(false); };
  async function lookup(value: string) {
    if (locked.current || !active.current) return;
    const code = value.trim();
    setBarcode(code);
    locked.current = true;
    if (!isValidBarcode(code)) { setState('invalid'); return; }
    const controller = new AbortController();
    request.current = controller;
    setState('loading');
    setTorch(false);
    try {
      const [product, products] = await Promise.all([lookupBarcode(code, controller.signal), getProducts()]);
      if (!active.current || controller.signal.aborted) return;
      if (product || findBarcodeProduct(products, code)) router.push({ pathname: '/product/scanned', params: { barcode: code } });
      else setState('notFound');
    } catch {
      if (active.current && !controller.signal.aborted) setState('error');
    }
  }
  const custom = (code?: string) => router.push({ pathname: '/product/add', params: { mode: 'custom', ...(code && isValidBarcode(code) ? { barcode: code } : {}) } });
  async function allowCamera() {
    try {
      setPermissionFailed(false);
      if (permission?.canAskAgain === false) await Linking.openSettings();
      else await requestPermission();
    } catch { setPermissionFailed(true); }
  }
  const cameraVisible = focused && foreground && permission?.granted && !manual && !cameraFailed && state === 'ready' && Platform.OS !== 'web';

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{t('scan.title')}</Text><Ionicons name="barcode-outline" size={28} color={colors.accent} /></View>
      {state === 'loading' ? <View style={styles.state}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.stateTitle}>{t('scan.lookingUp')}</Text><Text style={styles.secondary}>{barcode}</Text></View>
        : state !== 'ready' ? <View style={styles.state}>
          <Ionicons name={state === 'notFound' ? 'search-outline' : 'alert-circle-outline'} size={48} color={state === 'notFound' ? colors.secondary : colors.danger} />
          <Text style={styles.stateTitle}>{t(state === 'notFound' ? 'scan.notFound' : state === 'invalid' ? 'scan.invalid' : 'scan.lookupError')}</Text>
          <Text style={styles.secondary}>{t(state === 'notFound' ? 'scan.notFoundBody' : state === 'invalid' ? 'scan.invalidBody' : 'scan.errorBody')}</Text>
          {state === 'error' && <ScanAction label={t('common.retry')} onPress={() => { locked.current = false; void lookup(barcode); }} primary icon="refresh" />}
          {(state === 'notFound' || state === 'error') && <ScanAction label={t('scan.searchByName')} onPress={() => router.push({ pathname: '/product/search', params: { barcode } })} primary={state === 'notFound'} icon="search-outline" />}
          <ScanAction label={t('scan.createManually')} onPress={() => custom(barcode)} icon="create-outline" />
        </View> : <>
          {cameraVisible ? <View style={styles.preview}>
            <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
              onBarcodeScanned={({ data }) => void lookup(data)} onMountError={() => { setCameraFailed(true); setTorch(false); }} />
            <View pointerEvents="none" style={styles.cameraOverlay}><View style={styles.frame} /></View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('scan.torch')} accessibilityState={{ selected: torch }} onPress={() => setTorch((value) => !value)} style={styles.torch}>
              <Ionicons name={torch ? 'flash' : 'flash-outline'} size={24} color={colors.onAccent} />
            </Pressable>
          </View> : !manual && Platform.OS !== 'web' ? <View style={styles.state}>
            {!permission && !permissionFailed ? <ActivityIndicator color={colors.accent} /> : <>
              <Ionicons name="camera-outline" size={48} color={colors.accent} />
              <Text style={styles.stateTitle}>{t(cameraFailed ? 'scan.cameraError' : 'scan.permissionTitle')}</Text>
              <Text style={styles.secondary}>{t(cameraFailed ? 'scan.manualHint' : 'scan.permissionBody')}</Text>
              {!cameraFailed && <ScanAction label={t(permission?.canAskAgain === false ? 'scan.openSettings' : 'scan.allowCamera')} onPress={() => void allowCamera()} primary icon="camera-outline" />}
            </>}
          </View> : null}
          {cameraVisible && <Text style={styles.secondary}>{t('scan.instruction')}</Text>}
          {(manual || Platform.OS === 'web') && <View style={styles.manual}>
            {Platform.OS === 'web' && <Text style={styles.secondary}>{t('scan.webHint')}</Text>}
            <Text style={styles.label}>{t('scan.barcode')}</Text>
            <TextInput accessibilityLabel={t('scan.barcode')} placeholder={t('scan.barcodeHint')} placeholderTextColor={colors.secondary}
              value={barcode} onChangeText={setBarcode} keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} selectionColor={colors.accent} maxLength={14} style={styles.input} />
            <ScanAction label={t('scan.lookup')} onPress={() => void lookup(barcode)} primary icon="search-outline" />
          </View>}
        </>}
      {state !== 'ready' && <ScanAction label={t('scan.again')} onPress={reset} icon="scan-outline" />}
      {state === 'ready' && !manual && <ScanAction label={t('scan.enterManually')} onPress={() => { setTorch(false); setManual(true); }} icon="keypad-outline" />}
      {state === 'ready' && manual && Platform.OS !== 'web' && <ScanAction label={t('scan.useCamera')} onPress={() => { reset(); setManual(false); }} icon="camera-outline" />}
      {state === 'ready' && <ScanAction label={t('scan.addManually')} onPress={() => custom()} icon="add-outline" />}
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, gap: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 },
  title: { flex: 1, fontSize: 28, fontWeight: '700', color: colors.text },
  preview: { width: '100%', aspectRatio: 0.9, overflow: 'hidden', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cameraOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '82%', height: '35%', borderWidth: 3, borderRadius: 12, borderColor: colors.accent, backgroundColor: 'transparent' },
  torch: { position: 'absolute', bottom: 18, right: 18, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
  state: { minHeight: 230, alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 24 },
  stateTitle: { color: colors.text, fontWeight: '700', fontSize: 21, textAlign: 'center' },
  secondary: { color: colors.secondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  manual: { gap: 12 }, label: { color: colors.text, fontWeight: '600', fontSize: 14 },
  input: { minHeight: 54, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 17 },
  button: { minHeight: 52, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  primary: { backgroundColor: colors.accentFill, borderColor: colors.accent },
  buttonText: { color: colors.accent, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  primaryText: { color: colors.onAccent },
});
