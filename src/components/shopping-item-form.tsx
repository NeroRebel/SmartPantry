import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { presetCategories } from '@/data/product-presets';
import type { NewShoppingItem, ShoppingItem } from '@/types/shopping-item';
import { categoryLabel } from '@/i18n/format';

const units = ['pcs', 'g', 'kg', 'ml', 'L', 'pack'];

export function ShoppingItemForm({ item, onClose, onSave }: {
  item: ShoppingItem | null;
  onClose: () => void;
  onSave: (input: NewShoppingItem) => Promise<void>;
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item?.quantity?.toString() ?? '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function submit() {
    if (submitting.current) return;
    const numberText = quantity.trim().replace(',', '.');
    const parsedQuantity = numberText ? Number(numberText) : null;
    let message: string | null = null;
    if (!name.trim()) message = t('shopping.nameRequired');
    else if (parsedQuantity !== null && (!/^\d+(\.\d+)?$/.test(numberText) || !Number.isFinite(parsedQuantity))) {
      message = t('form.quantityInvalid');
    }
    if (message) {
      setError(message);
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), quantity: parsedQuantity, unit: unit.trim() || null, category: category.trim() || null });
    } catch {
      const saveError = t('shopping.saveError');
      setError(saveError);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} disabled={saving} onPress={onClose} style={styles.backdrop} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrapper}>
          <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>{item ? t('shopping.edit') : t('shopping.add')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} disabled={saving} onPress={onClose} style={styles.close}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false} contentContainerStyle={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.label}>{t('shopping.name')}</Text>
                <TextInput accessibilityLabel={t('shopping.itemName')} value={name} onChangeText={setName} placeholder={t('form.nameHint')} placeholderTextColor={colors.secondary} selectionColor={colors.accent} editable={!saving} style={styles.input} />
              </View>
              <View style={styles.row}>
                <View style={[styles.field, styles.half]}>
                  <Text style={styles.label}>{t('form.quantity')}</Text>
                  <TextInput accessibilityLabel={t('form.quantity')} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder={t('form.quantityHint')} placeholderTextColor={colors.secondary} selectionColor={colors.accent} editable={!saving} style={styles.input} />
                </View>
                <View style={[styles.field, styles.half]}>
                  <Text style={styles.label}>{t('form.unit')}</Text>
                  <TextInput accessibilityLabel={t('form.unit')} value={unit} onChangeText={setUnit} placeholder={t('polish.unitHint')} autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.secondary} selectionColor={colors.accent} editable={!saving} style={styles.input} />
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.options}>
                {units.map((choice) => <Pressable key={choice} accessibilityRole="button" accessibilityState={{ selected: unit === choice }} disabled={saving} onPress={() => setUnit(choice)} style={[styles.chip, unit === choice && styles.chipSelected]}><Text style={[styles.chipText, unit === choice && styles.chipTextSelected]}>{choice}</Text></Pressable>)}
              </ScrollView>
              <View style={styles.field}>
                <Text style={styles.label}>{t('shopping.category')}</Text>
                <TextInput accessibilityLabel={t('shopping.category')} value={category} onChangeText={setCategory} placeholder={t('common.optional')} placeholderTextColor={colors.secondary} selectionColor={colors.accent} editable={!saving} style={styles.input} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.options}>
                {presetCategories.map((choice) => <Pressable key={choice} accessibilityRole="button" accessibilityState={{ selected: category === choice }} disabled={saving} onPress={() => setCategory(choice)} style={[styles.chip, category === choice && styles.chipSelected]}><Text style={[styles.chipText, category === choice && styles.chipTextSelected]}>{categoryLabel(choice, t)}</Text></Pressable>)}
              </ScrollView>
              {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={() => void submit()} style={({ pressed }) => [styles.submit, (saving || pressed) && styles.dimmed]}>
                {saving ? <ActivityIndicator color={colors.background} /> : <Ionicons name="checkmark" size={21} color={colors.background} />}
                <Text style={styles.submitText}>{saving ? t('common.saving') : item ? t('product.saveChanges') : t('shopping.add')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheetWrapper: { width: '100%' },
  sheet: { width: '100%', maxWidth: 600, maxHeight: '90%', alignSelf: 'center', paddingHorizontal: 24, paddingTop: 22, backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { color: colors.text, fontSize: 21, fontWeight: '700', flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fields: { gap: 16, paddingBottom: 4 },
  field: { gap: 8 },
  label: { color: colors.secondary, fontSize: 13 },
  input: { minHeight: 52, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.background, fontSize: 15 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, minWidth: 0 },
  options: { gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: colors.accent },
  error: { color: colors.expired, fontSize: 13 },
  submit: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, backgroundColor: colors.text },
  submitText: { color: colors.background, fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  dimmed: { opacity: 0.65 },
});
