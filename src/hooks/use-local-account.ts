import { useEffect, useState } from 'react';
import { claimLegacyData } from '@/db/local-owner';
import { setLocalUserId } from '@/db/local-state';
import { reconcileAccountReminders, restoreProductReminders } from '@/services/notifications';
import { recoverDeletedAccountCleanup } from '@/services/account-deletion';

export function useLocalAccount(userId: string | null, clearDeletedSession: (userId: string) => Promise<void>) {
  const [result, setResult] = useState<{ owner: string | null; ready: boolean; error: boolean }>({ owner: null, ready: false, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLocalUserId(userId);
    void (async () => {
      await recoverDeletedAccountCleanup(clearDeletedSession);
      if (userId) await claimLegacyData(userId);
      // Notification availability must never block access to an offline local cache.
      await reconcileAccountReminders().catch(() => {});
      if (active) {
        setResult({ owner: userId, ready: true, error: false });
        if (userId) void restoreProductReminders().catch(() => {});
      }
    })().catch(() => { if (active) setResult({ owner: userId, ready: false, error: true }); });
    return () => { active = false; };
  }, [userId, attempt, clearDeletedSession]);
  return { ready: result.owner === userId && result.ready, error: result.owner === userId && result.error, retry: () => setAttempt((value) => value + 1) };
}
