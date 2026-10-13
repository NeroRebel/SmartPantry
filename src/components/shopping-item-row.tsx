import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pantryColors as colors } from '@/constants/pantry-theme';
import type { ShoppingItem } from '@/types/shopping-item';

export function ShoppingItemRow({ item, disabled, onToggle, onEdit, onDelete }: {
  item: ShoppingItem;
  disabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const quantity = item.quantity === null ? item.unit : `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
  const detail = [quantity, item.category].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, item.completed && styles.completedRow]}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.completed, disabled }} accessibilityLabel={`${item.name}, ${item.completed ? 'purchased' : 'to buy'}`} disabled={disabled} onPress={onToggle} style={styles.checkboxButton}>
        <Ionicons name={item.completed ? 'checkmark-circle' : 'ellipse-outline'} size={27} color={item.completed ? colors.fresh : colors.secondary} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} disabled={disabled} onPress={onEdit} style={styles.body}>
        <Text style={[styles.name, item.completed && styles.completedName]}>{item.name}</Text>
        {!!detail && <Text style={styles.detail}>{detail}</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.name}`} disabled={disabled} onPress={onDelete} style={styles.deleteButton}>
        <Ionicons name="trash-outline" size={19} color={colors.secondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  completedRow: { opacity: 0.68 },
  checkboxButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, paddingVertical: 7 },
  name: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  completedName: { textDecorationLine: 'line-through', color: colors.secondary },
  detail: { color: colors.secondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  deleteButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
