import { clearAllAppData } from '@/db/manage-data';
import { getProducts } from '@/db/products';
import { cancelExpirationNotification, syncProductReminder } from './notifications';

export async function clearAllDataAndReminders(): Promise<void> {
  const products = await getProducts();
  await Promise.all(products.map((product) => cancelExpirationNotification(product.notificationId)));
  try { await clearAllAppData(); }
  catch (error) {
    await Promise.all(products.map((product) => syncProductReminder(product.id).catch(() => {})));
    throw error;
  }
}
