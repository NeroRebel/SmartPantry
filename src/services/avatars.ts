import type { SupabaseClient, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AVATAR_BUCKET, AVATAR_URL_SECONDS, avatarMimeType, avatarPath, customAvatarPath } from '@/utils/avatar';

function logAvatarFailure(stage: string, error: unknown) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const fields = error && typeof error === 'object'
    ? error as { name?: unknown; statusCode?: unknown; status?: unknown }
    : {};
  // Keep only SDK classifications, never arbitrary messages, paths or request objects.
  const name = typeof fields.name === 'string' && /^[A-Za-z]{1,80}$/.test(fields.name) ? fields.name : undefined;
  const status = fields.statusCode ?? fields.status;
  console.warn(`[SmartPantry] Avatar ${stage} failed`, {
    name,
    status: typeof status === 'number' || (typeof status === 'string' && /^\d{3}$/.test(status)) ? status : undefined,
    bucket: AVATAR_BUCKET,
  });
}

export function createAvatarService(client: SupabaseClient | null) {
  const requireClient = () => {
    if (!client) throw new Error('Supabase unavailable');
    return client;
  };
  async function requireOwner(userId: string) {
    if (typeof userId !== 'string' || !userId.trim()) throw Object.assign(new Error('Authenticated user ID missing'), { code: 'avatar.sessionChanged' });
    const current = requireClient();
    const { data, error } = await current.auth.getSession();
    if (error) throw error;
    if (data.session?.user?.id !== userId) throw Object.assign(new Error('Session changed'), { code: 'avatar.sessionChanged' });
    return current;
  }
  return {
    async upload(user: User, buffer: ArrayBuffer): Promise<User> {
      let stage = 'validation';
      let path: string | null = null;
      try {
        const contentType = avatarMimeType(buffer);
        stage = 'session check';
        const current = await requireOwner(user?.id);
        path = avatarPath(user.id);
        const bucket = current.storage.from(AVATAR_BUCKET);
        stage = 'storage upload';
        const { error: uploadError } = await bucket.upload(path, buffer, { upsert: true, contentType, cacheControl: '0' });
        if (uploadError) throw uploadError;
        stage = 'metadata update';
        try {
          await requireOwner(user.id);
          // Auth merges these fields into existing metadata; do not copy stale Google/profile fields.
          const { data, error } = await current.auth.updateUser({ data: { avatar_path: path, avatar_version: new Date().toISOString() } });
          if (error) throw error;
          if (!data.user) throw new Error('Profile update unavailable');
          return data.user;
        } catch (error) {
          // Roll back a first upload. Never delete a replacement of the user's existing avatar.
          if (!customAvatarPath(user)) {
            try {
              await requireOwner(user.id);
              const { error: cleanupError } = await bucket.remove([path]);
              if (cleanupError) throw cleanupError;
            } catch (cleanupError) {
              logAvatarFailure('upload cleanup', cleanupError);
            }
          }
          throw error;
        }
      } catch (error) {
        logAvatarFailure(stage, error);
        throw error;
      }
    },
    async remove(user: User): Promise<User> {
      const path = customAvatarPath(user);
      if (!path) return user;
      const current = await requireOwner(user.id);
      const { error: removalError } = await current.storage.from(AVATAR_BUCKET).remove([path]);
      if (removalError) throw removalError;
      await requireOwner(user.id);
      const { data, error } = await current.auth.updateUser({ data: { avatar_path: null, avatar_version: null } });
      if (error) throw error;
      if (!data.user) throw new Error('Profile update unavailable');
      return data.user;
    },
    async signedUrl(user: User): Promise<string | null> {
      const path = customAvatarPath(user);
      if (!path) return null;
      const current = await requireOwner(user.id);
      const { data, error } = await current.storage.from(AVATAR_BUCKET).createSignedUrl(path, AVATAR_URL_SECONDS);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Avatar URL unavailable');
      const url = new URL(data.signedUrl);
      // Replacements at the same path need a new image cache key; this is not persisted.
      const version = user.user_metadata?.avatar_version;
      if (typeof version === 'string') url.searchParams.set('v', version);
      return url.toString();
    },
  };
}

export const avatarService = createAvatarService(supabase);
