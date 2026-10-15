import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { avatarService } from '@/services/avatars';
import { AVATAR_URL_SECONDS, customAvatarPath, resolveAvatarUrl } from '@/utils/avatar';

export function useUserAvatar(user: User | null): string | null {
  const path = user ? customAvatarPath(user) : null;
  const version = typeof user?.user_metadata?.avatar_version === 'string' ? user.user_metadata.avatar_version : '';
  const key = user && path ? `${user.id}:${path}:${version}` : '';
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!user || !path) return;
    let active = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      if (!active || inFlight) return;
      inFlight = true;
      clearTimeout(timer);
      let delay = (AVATAR_URL_SECONDS - 300) * 1000;
      try {
        const url = await avatarService.signedUrl(user!);
        if (active) setResolved({ key, url });
      } catch {
        if (active) setResolved({ key, url: null });
        delay = 30000;
      } finally {
        inFlight = false;
        if (active) timer = setTimeout(() => { void refresh(); }, delay);
      }
    }
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { active = false; clearTimeout(timer); subscription.remove(); };
  }, [key, path, user]);
  const customUrl = resolved?.key === key ? resolved.url : null;
  return resolveAvatarUrl(user, customUrl);
}
