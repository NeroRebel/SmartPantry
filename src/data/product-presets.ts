import type { ProductPreset } from '@/types/product-preset';

export const presetCategories = [
  'Fruits', 'Vegetables', 'Dairy', 'Meat & Fish', 'Bakery', 'Drinks', 'Frozen', 'Pantry', 'Other',
] as const;

export const productPresets: readonly ProductPreset[] = [
  { id: 'apple', name: 'Apple', category: 'Fruits', defaultUnit: 'pcs', defaultStorageLocation: 'Refrigerator', emoji: '🍎' },
  { id: 'banana', name: 'Banana', category: 'Fruits', defaultUnit: 'pcs', defaultStorageLocation: 'Pantry', emoji: '🍌' },
  { id: 'orange', name: 'Orange', category: 'Fruits', defaultUnit: 'pcs', defaultStorageLocation: 'Refrigerator', emoji: '🍊' },
  { id: 'strawberry', name: 'Strawberry', category: 'Fruits', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🍓' },
  { id: 'grapes', name: 'Grapes', category: 'Fruits', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🍇' },
  { id: 'tomatoes', name: 'Tomatoes', category: 'Vegetables', defaultUnit: 'pcs', defaultStorageLocation: 'Refrigerator', emoji: '🍅' },
  { id: 'potatoes', name: 'Potatoes', category: 'Vegetables', defaultUnit: 'kg', defaultStorageLocation: 'Pantry', emoji: '🥔' },
  { id: 'onion', name: 'Onion', category: 'Vegetables', defaultUnit: 'pcs', defaultStorageLocation: 'Pantry', emoji: '🧅' },
  { id: 'carrot', name: 'Carrot', category: 'Vegetables', defaultUnit: 'pcs', defaultStorageLocation: 'Refrigerator', emoji: '🥕' },
  { id: 'cucumber', name: 'Cucumber', category: 'Vegetables', defaultUnit: 'pcs', defaultStorageLocation: 'Refrigerator', emoji: '🥒' },
  { id: 'milk', name: 'Milk', category: 'Dairy', defaultUnit: 'L', defaultStorageLocation: 'Refrigerator', emoji: '🥛' },
  { id: 'eggs', name: 'Eggs', category: 'Dairy', defaultUnit: 'pcs', defaultStorageLocation: 'Refrigerator', emoji: '🥚' },
  { id: 'cheese', name: 'Cheese', category: 'Dairy', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🧀' },
  { id: 'yogurt', name: 'Yogurt', category: 'Dairy', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🥣' },
  { id: 'butter', name: 'Butter', category: 'Dairy', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🧈' },
  { id: 'chicken-breast', name: 'Chicken Breast', category: 'Meat & Fish', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🍗' },
  { id: 'beef', name: 'Beef', category: 'Meat & Fish', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🥩' },
  { id: 'pork', name: 'Pork', category: 'Meat & Fish', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🥩' },
  { id: 'salmon', name: 'Salmon', category: 'Meat & Fish', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🐟' },
  { id: 'tuna', name: 'Tuna', category: 'Meat & Fish', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🐟' },
  { id: 'bread', name: 'Bread', category: 'Bakery', defaultUnit: 'pack', defaultStorageLocation: 'Pantry', emoji: '🍞' },
  { id: 'baguette', name: 'Baguette', category: 'Bakery', defaultUnit: 'pcs', defaultStorageLocation: 'Pantry', emoji: '🥖' },
  { id: 'croissant', name: 'Croissant', category: 'Bakery', defaultUnit: 'pcs', defaultStorageLocation: 'Pantry', emoji: '🥐' },
  { id: 'water', name: 'Water', category: 'Drinks', defaultUnit: 'L', defaultStorageLocation: 'Pantry', emoji: '💧' },
  { id: 'orange-juice', name: 'Orange Juice', category: 'Drinks', defaultUnit: 'L', defaultStorageLocation: 'Refrigerator', emoji: '🧃' },
  { id: 'coffee', name: 'Coffee', category: 'Drinks', defaultUnit: 'g', defaultStorageLocation: 'Pantry', emoji: '☕' },
  { id: 'tea', name: 'Tea', category: 'Drinks', defaultUnit: 'pack', defaultStorageLocation: 'Pantry', emoji: '🍵' },
  { id: 'frozen-peas', name: 'Frozen Peas', category: 'Frozen', defaultUnit: 'g', defaultStorageLocation: 'Freezer', emoji: '🫛' },
  { id: 'frozen-berries', name: 'Frozen Berries', category: 'Frozen', defaultUnit: 'g', defaultStorageLocation: 'Freezer', emoji: '🫐' },
  { id: 'ice-cream', name: 'Ice Cream', category: 'Frozen', defaultUnit: 'ml', defaultStorageLocation: 'Freezer', emoji: '🍨' },
  { id: 'pasta', name: 'Pasta', category: 'Pantry', defaultUnit: 'g', defaultStorageLocation: 'Pantry', emoji: '🍝' },
  { id: 'rice', name: 'Rice', category: 'Pantry', defaultUnit: 'g', defaultStorageLocation: 'Pantry', emoji: '🍚' },
  { id: 'flour', name: 'Flour', category: 'Pantry', defaultUnit: 'kg', defaultStorageLocation: 'Pantry', emoji: '🌾' },
  { id: 'sugar', name: 'Sugar', category: 'Pantry', defaultUnit: 'kg', defaultStorageLocation: 'Pantry', emoji: '🍬' },
  { id: 'cereal', name: 'Cereal', category: 'Pantry', defaultUnit: 'g', defaultStorageLocation: 'Pantry', emoji: '🥣' },
  { id: 'tofu', name: 'Tofu', category: 'Other', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🍱' },
  { id: 'hummus', name: 'Hummus', category: 'Other', defaultUnit: 'g', defaultStorageLocation: 'Refrigerator', emoji: '🥣' },
];

export function filterProductPresets(query: string, category: string): ProductPreset[] {
  const search = query.trim().toLowerCase();
  return productPresets.filter((preset) =>
    (category === 'All' || preset.category === category) && preset.name.toLowerCase().includes(search)
  );
}

export function getPresetFormValues(preset: ProductPreset) {
  return {
    name: preset.name,
    category: preset.category,
    unit: preset.defaultUnit ?? '',
    storageLocation: preset.defaultStorageLocation ?? '',
  };
}
