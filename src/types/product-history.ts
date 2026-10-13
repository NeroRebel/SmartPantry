export type ProductHistoryAction = 'consumed' | 'wasted';

export interface ProductHistoryEntry {
  id: number;
  productId: number | null;
  productName: string;
  brand: string | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  expirationDate: string | null;
  action: ProductHistoryAction;
  actionDate: string;
  createdAt: string | null;
}

export type NewProductHistoryEntry = Omit<ProductHistoryEntry, 'id'>;
