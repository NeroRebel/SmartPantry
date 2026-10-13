import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ScannedProduct } from '@/types/scanned-product';
import { isValidBarcode, mapFoodCategory, parsePackageQuantity } from '@/utils/scanned-product';

interface OpenFoodFactsProduct {
  code?: unknown;
  product_name?: unknown;
  product_name_en?: unknown;
  brands?: unknown;
  categories?: unknown;
  categories_tags?: unknown;
  image_front_url?: unknown;
  image_url?: unknown;
  quantity?: unknown;
  nutrition_grades?: unknown;
}

interface OpenFoodFactsResponse {
  status?: unknown;
  product?: OpenFoodFactsProduct;
}

const fields = 'code,product_name,product_name_en,brands,categories,categories_tags,image_front_url,image_url,quantity,nutrition_grades';
const cache = new Map<string, { product: ScannedProduct | null; time: number }>();
const text = (value: unknown) => typeof value === 'string' ? value.trim() || null : null;
const image = (value: unknown) => {
  const url = text(value);
  return url && /^https:\/\//i.test(url) ? url : null;
};

export function mapOpenFoodFactsProduct(product: OpenFoodFactsProduct, barcode: string): ScannedProduct {
  const packageQuantity = text(product.quantity);
  const grade = text(product.nutrition_grades)?.toLowerCase();
  return {
    barcode, name: text(product.product_name) ?? text(product.product_name_en) ?? '',
    brand: text(product.brands),
    category: mapFoodCategory(Array.isArray(product.categories_tags) ? product.categories_tags.filter((tag): tag is string => typeof tag === 'string') : [], text(product.categories) ?? ''),
    imageUrl: image(product.image_front_url) ?? image(product.image_url),
    packageQuantity, nutritionGrade: grade && /^[a-e]$/.test(grade) ? grade.toUpperCase() : null,
    ...parsePackageQuantity(packageQuantity),
  };
}

export function parseOpenFoodFactsResponse(payload: unknown, barcode: string): ScannedProduct | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid product response');
  const response = payload as OpenFoodFactsResponse;
  if (response.status === 0) return null;
  if (response.status !== 1 || !response.product || typeof response.product !== 'object' || Array.isArray(response.product)) {
    throw new Error('Invalid product response');
  }
  return mapOpenFoodFactsProduct(response.product, barcode);
}

export async function lookupBarcode(value: string, signal?: AbortSignal): Promise<ScannedProduct | null> {
  const barcode = value.trim();
  if (!isValidBarcode(barcode)) throw new Error('Invalid barcode');
  const cached = cache.get(barcode);
  if (cached && Date.now() - cached.time < 300_000) return cached.product;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 12_000);
  try {
    // Browsers control User-Agent; native fetch supports identifying the client.
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (Platform.OS !== 'web') headers['User-Agent'] = `SmartPantry/${Constants.expoConfig?.version ?? '1.0.0'} (mobile application)`;
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, { headers, signal: controller.signal });
    if (!response.ok && response.status !== 404) throw new Error(`Product lookup failed: ${response.status}`);
    const product = parseOpenFoodFactsResponse(await response.json(), barcode);
    if (!response.ok && product) throw new Error('Invalid product response');
    if (cache.size >= 20) cache.delete(cache.keys().next().value!);
    cache.set(barcode, { product, time: Date.now() });
    return product;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
