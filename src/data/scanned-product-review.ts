import type { ProductSearchResult, ScannedProduct } from '@/types/scanned-product';
import { selectFallbackProduct } from '@/utils/scanned-product';

// Short-lived route handoff only; this is not a saved search history.
const selections = new Map<string, ScannedProduct>();
let sequence = 0;

export function rememberProductSelection(result: ProductSearchResult, originalBarcode: string): string {
  const product = selectFallbackProduct(result, originalBarcode);
  const key = `${Date.now()}-${++sequence}`;
  if (selections.size >= 20) selections.delete(selections.keys().next().value!);
  selections.set(key, product);
  return key;
}

export function getProductSelection(key: string, originalBarcode: string): ScannedProduct {
  const product = selections.get(key);
  if (!product || product.barcode !== originalBarcode.trim()) throw new Error('Product selection unavailable');
  return product;
}
