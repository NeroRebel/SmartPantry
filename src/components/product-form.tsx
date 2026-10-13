import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pantryColors as colors } from '@/constants/pantry-theme';
import type { Product, ProductInput } from '@/types/product';
import { isValidISODate } from '@/utils/product-status';

const choices = {
  category: ['Dairy', 'Meat & Fish', 'Meat', 'Vegetables', 'Fruits', 'Fruit', 'Bakery', 'Drinks', 'Frozen', 'Pantry', 'Other'],
  unit: ['', 'pcs', 'g', 'kg', 'ml', 'L', 'pack'],
  storageLocation: ['', 'Refrigerator', 'Freezer', 'Pantry', 'Other'],
};
const choiceLabels = { category: 'Category *', unit: 'Unit', storageLocation: 'Storage Location' };

type Props = {
  title: string;
  submitLabel: string;
  initialProduct?: Product;
  initialValues?: Partial<Record<'name' | 'category' | 'unit' | 'storageLocation', string>>;
  headerContent?: ReactNode;
  onBack: () => void;
  onSubmit: (input: ProductInput) => Promise<void>;
};

export function ProductForm({ title, submitLabel, initialProduct, initialValues, headerContent, onBack, onSubmit }: Props) {
  const [fields, setFields] = useState({
    name: initialProduct?.name ?? initialValues?.name ?? '',
    brand: initialProduct?.brand ?? '',
    category: initialProduct?.category ?? initialValues?.category ?? '',
    quantity: initialProduct?.quantity?.toString() ?? '',
    unit: initialProduct?.unit ?? initialValues?.unit ?? '',
    expirationDate: initialProduct?.expirationDate ?? '',
    storageLocation: initialProduct?.storageLocation ?? initialValues?.storageLocation ?? '',
    notes: initialProduct?.notes ?? '',
  });
  const [menu, setMenu] = useState<keyof typeof choices | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const change = (field: keyof typeof fields, value: string) => setFields((current) => ({ ...current, [field]: value }));

  async function save() {
    if (submitting.current) return;
    const quantityText = fields.quantity.trim().replace(',', '.');
    const quantity = quantityText ? Number(quantityText) : null;
    let validation: string | null = null;
    if (!fields.name.trim()) validation = 'Please enter a product name.';
    else if (!fields.category) validation = 'Please choose a category.';
    else if (!isValidISODate(fields.expirationDate.trim())) validation = 'Enter a valid expiration date as YYYY-MM-DD, for example 2026-10-15.';
    else if (quantity !== null && (!/^\d+(\.\d+)?$/.test(quantityText) || !Number.isFinite(quantity) || quantity < 0)) validation = 'Enter a quantity of zero or more, such as 1 or 0.5.';
    if (validation) {
      setError(validation);
      Alert.alert('Check your product', validation);
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: fields.name.trim(), brand: fields.brand.trim() || null,
        category: fields.category, quantity, unit: fields.unit || null,
        expirationDate: fields.expirationDate.trim(), storageLocation: fields.storageLocation || null,
        notes: fields.notes.trim() || null,
        barcode: initialProduct?.barcode ?? null, imageUrl: initialProduct?.imageUrl ?? null,
      });
    } catch {
      const message = 'We could not save your product. Your entries are still here. Please try again.';
      setError(message);
      Alert.alert('Unable to save', message);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  function input(field: 'name' | 'brand' | 'quantity' | 'expirationDate' | 'notes', label: string, placeholder: string) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          accessibilityLabel={label.replace(' *', '')}
          value={fields[field]}
          onChangeText={(value) => change(field, value)}
          placeholder={placeholder}
          placeholderTextColor={colors.secondary}
          selectionColor={colors.accent}
          editable={!saving}
          autoCorrect={field !== 'expirationDate' && field !== 'quantity'}
          autoCapitalize={field === 'expirationDate' || field === 'quantity' ? 'none' : 'sentences'}
          keyboardType={field === 'quantity' ? 'decimal-pad' : field === 'expirationDate' ? 'numbers-and-punctuation' : 'default'}
          multiline={field === 'notes'}
          maxLength={field === 'expirationDate' ? 10 : undefined}
          style={[styles.input, field === 'notes' && styles.notesInput]}
        />
      </View>
    );
  }

  function select(field: keyof typeof choices) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{choiceLabels[field]}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${choiceLabels[field].replace(' *', '')}: ${fields[field] || 'Not selected'}`}
          disabled={saving}
          onPress={() => setMenu(field)}
          style={styles.select}
        >
          <Text style={[styles.selectText, !fields[field] && styles.muted]}>{fields[field] || 'Select'}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.secondary} />
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} disabled={saving} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          </View>
          {headerContent}
          {input('name', 'Product Name *', 'e.g. Milk')}
          {input('brand', 'Brand', 'Brand name')}
          {select('category')}
          <View style={styles.row}>
            <View style={styles.half}>{input('quantity', 'Quantity', 'e.g. 1')}</View>
            <View style={styles.half}>{select('unit')}</View>
          </View>
          {input('expirationDate', 'Expiration Date *', 'YYYY-MM-DD')}
          {select('storageLocation')}
          {input('notes', 'Notes', 'Anything to remember?')}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            accessibilityState={{ disabled: saving, busy: saving }}
            disabled={saving}
            onPress={() => void save()}
            style={({ pressed }) => [styles.submit, (pressed || saving) && styles.dimmed]}
          >
            {saving ? <ActivityIndicator color={colors.background} /> : <Ionicons name="checkmark" size={22} color={colors.background} />}
            <Text style={styles.submitText}>{saving ? 'Saving...' : submitLabel}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={menu !== null} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={styles.menu}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>{menu ? choiceLabels[menu].replace(' *', '') : ''}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={() => setMenu(null)} style={styles.back}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView>
              {menu && choices[menu].map((value) => (
                <Pressable key={value} accessibilityRole="button" accessibilityLabel={value || 'Not specified'} onPress={() => { change(menu, value); setMenu(null); }} style={styles.option}>
                  <Text style={styles.optionText}>{value || 'Not specified'}</Text>
                  {fields[menu] === value && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, paddingTop: 12, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface },
  title: { flex: 1, color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '700' },
  field: { gap: 8 },
  label: { color: colors.secondary, fontSize: 13, lineHeight: 18 },
  input: { minHeight: 54, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, color: colors.text, padding: 16, fontSize: 15 },
  notesInput: { minHeight: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, minWidth: 0 },
  select: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface },
  selectText: { flex: 1, color: colors.text, fontSize: 15 },
  muted: { color: colors.secondary },
  submit: { minHeight: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, borderRadius: 16, padding: 16, backgroundColor: colors.text },
  submitText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  error: { color: colors.expired, fontSize: 13, lineHeight: 20 },
  dimmed: { opacity: 0.6 },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#000000AA' },
  menu: { width: '100%', maxWidth: 500, maxHeight: '80%', alignSelf: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  menuTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingVertical: 14 },
  optionText: { color: colors.text, fontSize: 15 },
});
