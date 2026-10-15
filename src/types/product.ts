export type ProductStatus = 'fresh' | 'expiringSoon' | 'expired';

export interface ProductStats {
  total: number;
  fresh: number;
  expiringSoon: number;
  expired: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  category: string;
  quantity: number | null;
  unit: string | null;
  expirationDate: string;
  storageLocation: string | null;
  imageUrl: string | null;
  notes: string | null;
  notificationId: string | null;
  createdAt: string;
}

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'notificationId'>;
