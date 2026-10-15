import { clearAllAppData } from '@/db/manage-data';
import { getProducts } from '@/db/products';
import { cancelExpirationNotification, syncProductReminder } from './notifications';
import { assertLocalAccount, getLocalUserId } from '@/db/local-state';

export async function clearAllDataAndReminders(): Promise<void> {
  const owner = getLocalUserId();
  const products = await getProducts();
  assertLocalAccount(owner);
  await Promise.all(products.map((product) => cancelExpirationNotification(product.notificationId)));
  try { assertLocalAccount(owner); await clearAllAppData(); }
  catch (error) {
    if (owner === getLocalUserId()) await Promise.all(products.map((product) => syncProductReminder(product.id).catch(() => {})));
    throw error;
  }
}
