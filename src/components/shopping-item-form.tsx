import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pantryColors as colors } from '@/constants/pantry-theme';
import { presetCategories } from '@/data/product-presets';
import type { NewShoppingItem, ShoppingItem } from '@/types/shopping-item';

const units = ['pcs', 'g', 'kg', 'ml', 'L', 'pack'];

export function ShoppingItemForm({ item, onClose, onSave }: {
  item: ShoppingItem | null;
  onClose: () => void;
  onSave: (input: NewShoppingItem) => Promise<void>;
}) {
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
    if (!name.trim()) message = 'Please enter an item name.';
    else if (parsedQuantity !== null && (!/^\d+(\.\d+)?$/.test(numberText) || !Number.isFinite(parsedQuantity))) {
      message = 'Enter a quantity of zero or more, such as 1 or 0.5.';
    }
    if (message) {
      setError(message);
      Alert.alert('Check your item', message);
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), quantity: parsedQuantity, unit: unit.trim() || null, category: category.trim() || null });
    } catch {
      const saveError = 'Could not save your item. Please try again.';
      setError(saveError);
      Alert.alert('Unable to save', saveError);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close item form" disabled={saving} onPress={onClose} style={styles.backdrop} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrapper}>
          <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>{item ? 'Edit Item' : 'Add Item'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={saving} onPress={onClose} style={styles.close}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.label}>Name *</Text>
                <TextInput accessibilityLabel="Item name" value={name} onChangeText={setName} placeholder="e.g. Milk" placeholderTextColor={colors.secondary} selectionColor={colors.accent} editable={!saving} style={styles.input} />
              </View>
              <View style={styles.row}>
                <View style={[styles.field, styles.half]}>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput accessibilityLabel="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="e.g. 1" placeholderTextColor={colors.secondary} selectionColor={colors.accent} editable={!saving} style={styles.input} />
                </View>
                <View style={[styles.field, styles.half]}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput accessibilityLabel="Unit" value={unit} onChangeText={setUnit} placeholder="e.g. L" placeholderTextColor={colors.secondary} selectionColor={colors.accent} editable={!saving} style={styles.input} />
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.options}>
                {units.map((choice) => <Pressable key={choice} accessibilityRole="button" accessibilityState={{ selected: unit === choice }} disabled={saving} onPress={() => setUnit(choice)} style={[styles.chip, unit === choice && styles.chipSelected]}><Text style={[styles.chipText, unit === choice && styles.chipTextSelected]}>{choice}</Text></Pressable>)}
              </ScrollView>
              <View style={styles.field}>
                <Text style={styles.label}>Category</Text>
                <TextInput accessibilityLabel="Category" value={category} onChangeText={setCategory} placeholder="Optional" placeholderTextColor={colors.secondary} selectionColor={colors.accent} editable={!saving} style={styles.input} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.options}>
                {presetCategories.map((choice) => <Pressable key={choice} accessibilityRole="button" accessibilityState={{ selected: category === choice }} disabled={saving} onPress={() => setCategory(choice)} style={[styles.chip, category === choice && styles.chipSelected]}><Text style={[styles.chipText, category === choice && styles.chipTextSelected]}>{choice}</Text></Pressable>)}
              </ScrollView>
              {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => void submit()} style={({ pressed }) => [styles.submit, (saving || pressed) && styles.dimmed]}>
                {saving ? <ActivityIndicator color={colors.background} /> : <Ionicons name="checkmark" size={21} color={colors.background} />}
                <Text style={styles.submitText}>{saving ? 'Saving...' : item ? 'Save Changes' : 'Add Item'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000000AA' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheetWrapper: { width: '100%' },
  sheet: { width: '100%', maxWidth: 600, maxHeight: '90%', alignSelf: 'center', paddingHorizontal: 24, paddingTop: 22, backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { color: colors.text, fontSize: 21, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fields: { gap: 16, paddingBottom: 4 },
  field: { gap: 8 },
  label: { color: colors.secondary, fontSize: 13 },
  input: { minHeight: 52, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.background, fontSize: 15 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, minWidth: 0 },
  options: { gap: 8 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipSelected: { borderColor: colors.accent, backgroundColor: '#FF6B3D20' },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: colors.accent },
  error: { color: colors.expired, fontSize: 13 },
  submit: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, backgroundColor: colors.text },
  submitText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  dimmed: { opacity: 0.65 },
});
