export type ShoppingItemSource = 'manual' | 'recipe';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  completed: boolean;
  source: ShoppingItemSource;
  createdAt: string;
}

export interface NewShoppingItem {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
  source?: ShoppingItemSource;
}
