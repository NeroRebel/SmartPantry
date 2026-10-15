import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { assertAccountWritable, blockAccount, unblockAccount } from './account-lock';
import { cancelDeletedAccountReminders } from './notifications';
import { forgetDeletedAccountReceipt, getDeletedAccountsToClean, purgeDeletedAccount } from '@/db/account-cleanup';

export async function finishDeletedAccountCleanup(userId: string): Promise<void> {
  await blockAccount(userId);
  await cancelDeletedAccountReminders(userId);
  await purgeDeletedAccount(userId);
}
export async function recoverDeletedAccountCleanup(clearSession: (userId: string) => Promise<void>): Promise<void> {
  for (const userId of await getDeletedAccountsToClean()) {
    await finishDeletedAccountCleanup(userId);
    await clearSession(userId);
    await forgetDeletedAccountReceipt(userId);
  }
}
export function createAccountDeletion(deps: {
  pause: (userId: string) => Promise<void>;
  resume: (userId: string) => void;
  removeCloud: (userId: string) => Promise<void>;
  record: (userId: string) => Promise<void>;
  cleanup: (userId: string) => Promise<void>;
  clearSession: (userId: string) => Promise<void>;
  forgetReceipt: (userId: string) => Promise<void>;
}) {
  let running = false;
  let confirmedOwner: string | null = null;
  return async (userId: string, confirmation: string) => {
    if (running || !userId || confirmation !== 'DELETE') throw Object.assign(new Error('Confirmation required'), { code: 'account.confirmRequired' });
    if (confirmedOwner !== userId) assertAccountWritable(userId);
    running = true;
    let confirmed = confirmedOwner === userId;
    try {
      await blockAccount(userId);
      await deps.pause(userId);
      if (!confirmed) await deps.removeCloud(userId);
      confirmed = true;
      confirmedOwner = userId;
      await deps.record(userId);
      await deps.cleanup(userId);
      await deps.clearSession(userId);
      await deps.forgetReceipt(userId);
    } catch (error) {
      if (!confirmed) { unblockAccount(userId); deps.resume(userId); throw error; }
      // Never reopen sync/mutations after confirmed deletion. The persisted receipt retries cleanup on startup.
      throw Object.assign(new Error('Account deleted; device cleanup needs retry'), { code: 'account.cleanupFailed' });
    } finally { running = false; }
  };
}
export async function deleteCloudAccount(userId: string, client: SupabaseClient | null = supabase): Promise<void> {
  if (!client) throw Object.assign(new Error('Unavailable'), { code: 'configuration_missing' });
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (session.session?.user.id !== userId || !session.session.access_token) throw Object.assign(new Error('Session changed'), { code: 'session_expired' });
  // Pin the validated account's token: a later account switch must never delete the new user.
  const { data, error } = await client.functions.invoke('delete-account', {
    body: { confirmation: 'DELETE' }, timeout: 120000,
    headers: { Authorization: `Bearer ${session.session.access_token}` },
  });
  // Never log the Functions error/context: it may include request authorization.
  if (error || data?.deleted !== true || data?.userId !== userId) throw Object.assign(new Error('Account deletion failed'), { code: 'account.deleteFailed' });
}
