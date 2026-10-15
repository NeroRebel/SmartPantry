import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ProductSearchResult, ScannedProduct } from '@/types/scanned-product';
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
const searchCache = new Map<string, { products: ProductSearchResult[]; time: number }>();
let nextSearchAt = 0;
const text = (value: unknown) => typeof value === 'string' ? value.trim() || null : null;
const image = (value: unknown) => {
  const url = text(value);
  return url && /^https:\/\//i.test(url) ? url : null;
};

function clientHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (Platform.OS !== 'web') headers['User-Agent'] = `SmartPantry/${Constants.expoConfig?.version ?? '1.0.0'} (mobile application)`;
  return headers;
}

export function mapOpenFoodFactsSearchResponse(payload: unknown, query: string): ProductSearchResult[] {
  if (!payload || typeof payload !== 'object' || !('products' in payload) || !Array.isArray(payload.products)) throw new Error('Invalid search response');
  if ('errors' in payload && Array.isArray(payload.errors) && payload.errors.length > 0) throw new Error('Product search failed');
  if ('timed_out' in payload && payload.timed_out === true) throw new Error('Search timed out');
  const results: ProductSearchResult[] = [];
  const seen = new Set<string>();
  for (const hit of payload.products) {
    if (!hit || typeof hit !== 'object' || Array.isArray(hit)) continue;
    const raw = hit as OpenFoodFactsProduct;
    const brand = Array.isArray(raw.brands) ? raw.brands.filter((value): value is string => typeof value === 'string').join(', ') : raw.brands;
    const code = text(raw.code);
    const product = mapOpenFoodFactsProduct({ ...raw, brands: brand }, code ?? '');
    if (!product.name) continue;
    const key = code ?? `${product.name.toLowerCase()}|${product.brand ?? ''}|${product.packageQuantity ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ ...product, barcode: code && isValidBarcode(code) ? code : null });
  }
  const normalized = query.trim().toLowerCase();
  const words = normalized.split(/\s+/);
  const score = (product: ProductSearchResult) => {
    const name = product.name.toLowerCase();
    const brand = product.brand?.toLowerCase() ?? '';
    return (name === normalized ? 100 : name.includes(normalized) ? 50 : 0)
      + words.filter((word) => name.includes(word)).length * 10
      + words.filter((word) => brand.includes(word)).length * 5
      + (product.imageUrl ? 2 : 0) + (product.packageQuantity ? 1 : 0);
  };
  return results.sort((a, b) => score(b) - score(a));
}

async function waitForSearchSlot(signal?: AbortSignal) {
  // The legacy full-text endpoint permits 10 searches/minute. Cancel stale queued queries.
  while (Date.now() < nextSearchAt) {
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Search cancelled')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, nextSearchAt - Date.now());
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  }
  if (signal?.aborted) throw new Error('Search cancelled');
  nextSearchAt = Date.now() + 6500;
}

export async function searchProducts(query: string, signal?: AbortSignal): Promise<ProductSearchResult[]> {
  const search = query.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (search.length < 3) return [];
  if (signal?.aborted) throw new Error('Search cancelled');
  const key = search.toLowerCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.time < 300_000) return cached.products;
  await waitForSearchSlot(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 12_000);
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(search)}&search_simple=1&action=process&json=1&page_size=20&page=1&fields=${fields}`;
    const response = await fetch(url, { headers: clientHeaders(), signal: controller.signal });
    if (!response.ok) throw Object.assign(new Error(`Product search failed: ${response.status}`), { status: response.status });
    const products = mapOpenFoodFactsSearchResponse(await response.json(), search);
    if (searchCache.size >= 20) searchCache.delete(searchCache.keys().next().value!);
    searchCache.set(key, { products, time: Date.now() });
    return products;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

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
    const headers = clientHeaders();
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, { headers, signal: controller.signal });
    if (!response.ok && response.status !== 404) throw Object.assign(new Error(`Product lookup failed: ${response.status}`), { status: response.status });
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
