import { markProductAsConsumed, markProductAsWasted } from '@/db/product-history';
import { createProduct, deleteProduct, getProductById, updateProduct } from '@/db/products';
import type { ProductInput } from '@/types/product';
import { cancelExpirationNotification, syncProductReminder } from './notifications';

async function syncSafely(id: number) {
  try { await syncProductReminder(id); }
  catch (error) { if (__DEV__) console.warn('[SmartPantry] Reminder sync failed:', error); }
}

export async function addProduct(input: ProductInput): Promise<number> {
  const id = await createProduct(input);
  await syncSafely(id);
  return id;
}

export async function editProduct(id: number, input: ProductInput): Promise<void> {
  await updateProduct(id, input);
  await syncSafely(id);
}

export async function removeProduct(id: number): Promise<void> {
  const product = await getProductById(id);
  if (product?.notificationId) await cancelExpirationNotification(product.notificationId);
  try { await deleteProduct(id); }
  catch (error) {
    if (product) await syncSafely(id);
    throw error;
  }
}

export async function finishProduct(id: number, action: 'consumed' | 'wasted'): Promise<void> {
  const product = await getProductById(id);
  if (product?.notificationId) await cancelExpirationNotification(product.notificationId);
  try {
    if (action === 'consumed') await markProductAsConsumed(id);
    else await markProductAsWasted(id);
  } catch (error) {
    if (product) await syncSafely(id);
    throw error;
  }
}
