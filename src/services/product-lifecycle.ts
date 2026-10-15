import { markProductAsConsumed, markProductAsWasted } from '@/db/product-history';
import { createProduct, deleteProduct, getProductById, updateProduct } from '@/db/products';
import type { ProductInput } from '@/types/product';
import { cancelExpirationNotification, syncProductReminder } from './notifications';
import { assertLocalAccount, getLocalUserId } from '@/db/local-state';

async function syncSafely(id: string) {
  try { await syncProductReminder(id); }
  catch (error) { if (__DEV__) console.warn('[SmartPantry] Reminder sync failed:', error); }
}

export async function addProduct(input: ProductInput): Promise<string> {
  const id = await createProduct(input);
  await syncSafely(id);
  return id;
}

export async function editProduct(id: string, input: ProductInput): Promise<void> {
  await updateProduct(id, input);
  await syncSafely(id);
}

export async function removeProduct(id: string): Promise<void> {
  const owner = getLocalUserId();
  const product = await getProductById(id);
  assertLocalAccount(owner);
  if (product?.notificationId) await cancelExpirationNotification(product.notificationId);
  try { assertLocalAccount(owner); await deleteProduct(id); }
  catch (error) {
    if (product && owner === getLocalUserId()) await syncSafely(id);
    throw error;
  }
}

export async function finishProduct(id: string, action: 'consumed' | 'wasted'): Promise<void> {
  const owner = getLocalUserId();
  const product = await getProductById(id);
  assertLocalAccount(owner);
  if (product?.notificationId) await cancelExpirationNotification(product.notificationId);
  try {
    assertLocalAccount(owner);
    if (action === 'consumed') await markProductAsConsumed(id);
    else await markProductAsWasted(id);
  } catch (error) {
    if (product && owner === getLocalUserId()) await syncSafely(id);
    throw error;
  }
}
