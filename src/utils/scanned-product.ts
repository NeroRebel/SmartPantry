import type { Product } from '@/types/product';
import type { ScannedProduct } from '@/types/scanned-product';

export function isValidBarcode(value: string): boolean {
  return /^(?:\d{8}|\d{12,14})$/.test(value.trim());
}

// UPC-A and its zero-prefixed EAN-13 representation identify the same package.
export function normalizeBarcode(value: string): string {
  const barcode = value.trim();
  return barcode.length === 12 ? `0${barcode}` : barcode;
}

export function findBarcodeProduct(products: Product[], barcode: string): Product | null {
  return products.find((product) => product.barcode && normalizeBarcode(product.barcode) === normalizeBarcode(barcode)) ?? null;
}

export function parsePackageQuantity(value: string | null): { quantity: number | null; unit: string | null } {
  const match = value?.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)$/i);
  if (!match) return { quantity: null, unit: null };
  const quantity = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) return { quantity: null, unit: null };
  const unit = match[2].toLowerCase();
  return { quantity, unit: unit === 'l' ? 'L' : unit };
}

export function mapFoodCategory(tags: string[], categories = ''): string {
  const labels = tags.map((tag) => tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').toLowerCase());
  labels.push(...categories.toLowerCase().split(',').map((item) => item.trim()));
  const rules: [RegExp, string][] = [
    [/\bfrozen\b/, 'Frozen'],
    [/^(milks?|dairy(?: products)?|dairies|cheeses?|yoghur?ts?|butter)$/, 'Dairy'],
    [/\b(meat|meats|fish|fishes|seafood|chicken|beef|pork|salmon|tuna)\b/, 'Meat & Fish'],
    [/\b(beverages?|drinks?|juices?|waters?)\b/, 'Drinks'],
    [/\b(bread|breads|bakery|baguettes?|croissants?)\b/, 'Bakery'],
    [/^(fruits?|fresh fruits?|apples?|bananas?|oranges?|grapes|strawberries)$/, 'Fruits'],
    [/^(vegetables?|fresh vegetables?|tomatoes|potatoes|carrots?|onions?|cucumbers?)$/, 'Vegetables'],
    [/\b(pastas?|rice|flour|sugar|cereals?)\b/, 'Pantry'],
  ];
  // Explicit plant substitutes should not become Dairy based on "milk" alone.
  if (labels.some((label) => /\b(plant based|plant milk|milk alternatives)\b/.test(label))) return 'Other';
  for (const [pattern, category] of rules) if (labels.some((label) => pattern.test(label))) return category;
  return 'Other';
}

export function scannedProductFormValues(product: ScannedProduct) {
  return {
    name: product.name, brand: product.brand, barcode: product.barcode,
    category: product.category, quantity: product.quantity, unit: product.unit,
    imageUrl: product.imageUrl,
  };
}
