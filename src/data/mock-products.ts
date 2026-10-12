import type Ionicons from '@expo/vector-icons/Ionicons';

export type ProductStatus = 'Fresh' | 'Expiring Soon' | 'Expired';

export type Product = {
  id: string;
  name: string;
  quantity: string;
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
  daysUntilExpiry: number;
  expirationDate: Date;
  storage: string;
  notes: string;
};

// Capture one demo date so list labels and detail dates agree throughout the session.
const demoToday = new Date();
demoToday.setHours(0, 0, 0, 0);

function product(data: Omit<Product, 'expirationDate'>): Product {
  const expirationDate = new Date(demoToday);
  expirationDate.setDate(expirationDate.getDate() + data.daysUntilExpiry);
  return { ...data, expirationDate };
}

export const mockProducts: readonly Product[] = [
  product({ id: 'milk', name: 'Milk', quantity: '1 L', category: 'Dairy', icon: 'water-outline', daysUntilExpiry: 2, storage: 'Fridge', notes: 'Keep refrigerated. Shake well before use.' }),
  product({ id: 'eggs', name: 'Eggs', quantity: '12 pcs', category: 'Dairy', icon: 'egg-outline', daysUntilExpiry: 5, storage: 'Fridge', notes: 'Store in the original carton.' }),
  product({ id: 'tomatoes', name: 'Tomatoes', quantity: '4 pcs', category: 'Vegetables', icon: 'nutrition-outline', daysUntilExpiry: 1, storage: 'Fridge', notes: 'Set aside for a salad or pasta sauce.' }),
  product({ id: 'chicken-breast', name: 'Chicken Breast', quantity: '500 g', category: 'Meat', icon: 'restaurant-outline', daysUntilExpiry: 3, storage: 'Fridge', notes: 'Keep sealed on the bottom shelf.' }),
  product({ id: 'cheese', name: 'Cheese', quantity: '200 g', category: 'Dairy', icon: 'pizza-outline', daysUntilExpiry: 7, storage: 'Fridge', notes: 'Wrap tightly after opening.' }),
  product({ id: 'pasta', name: 'Pasta', quantity: '500 g', category: 'Pantry', icon: 'restaurant-outline', daysUntilExpiry: 60, storage: 'Pantry', notes: 'Store in a cool, dry place.' }),
].sort((a, b) => a.expirationDate.getTime() - b.expirationDate.getTime());

export function getProductStatus(daysUntilExpiry: number): ProductStatus {
  if (daysUntilExpiry < 0) return 'Expired';
  return daysUntilExpiry <= 3 ? 'Expiring Soon' : 'Fresh';
}

export function getExpirationLabel(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)} ${days === -1 ? 'day' : 'days'} ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

export function formatExpirationDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
