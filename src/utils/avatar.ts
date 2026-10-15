import type { User } from '@supabase/supabase-js';
import { getUserProfile } from '@/utils/auth';

export const AVATAR_BUCKET = 'avatars';
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_URL_SECONDS = 3600;

export function avatarPath(userId: string): string {
  if (!userId || /[\/\\]/.test(userId) || userId === '.' || userId === '..') throw new Error('Invalid avatar owner');
  return `${userId}/avatar`;
}

export function customAvatarPath(user: User): string | null {
  return user.user_metadata?.avatar_path === avatarPath(user.id) ? avatarPath(user.id) : null;
}

export function resolveAvatarUrl(user: User | null, signedUrl: string | null): string | null {
  if (!user) return null;
  return customAvatarPath(user) && signedUrl ? signedUrl : getUserProfile(user).avatarUrl;
}

export function validateAvatarSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) throw Object.assign(new Error('Invalid image'), { code: 'avatar.unsupported' });
  if (size > MAX_AVATAR_BYTES) throw Object.assign(new Error('Image too large'), { code: 'avatar.tooLarge' });
}

export function avatarMimeType(buffer: ArrayBuffer): 'image/jpeg' | 'image/png' | 'image/webp' {
  validateAvatarSize(buffer.byteLength);
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'image/png';
  if ([82, 73, 70, 70].every((value, index) => bytes[index] === value) &&
    [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value)) return 'image/webp';
  throw Object.assign(new Error('Unsupported image'), { code: 'avatar.unsupported' });
}

export function avatarErrorKey(error: unknown, fallback: 'avatar.uploadFailed' | 'avatar.removeFailed' | 'avatar.pickFailed' = 'avatar.uploadFailed'): string {
  const code = error && typeof error === 'object' ? (error as { code?: string }).code : undefined;
  return code === 'avatar.tooLarge' || code === 'avatar.unsupported' || code === 'avatar.sessionChanged' ? code : fallback;
}
