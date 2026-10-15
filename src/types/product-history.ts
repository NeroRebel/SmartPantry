export type ProductHistoryAction = 'consumed' | 'wasted';

export interface ProductHistoryEntry {
  id: string;
  productId: string | null;
  productName: string;
  brand: string | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  expirationDate: string | null;
  action: ProductHistoryAction;
  actionDate: string;
  createdAt: string | null;
  barcode?: string | null;
  storageLocation?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
}

export type NewProductHistoryEntry = Omit<ProductHistoryEntry, 'id'>;
