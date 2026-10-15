import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createDeleteAccountHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = admin.storage.from('avatars');
Deno.serve(createDeleteAccountHandler({
  cascadeVerified: Deno.env.get('ACCOUNT_DELETE_CASCADE_VERIFIED') === 'true',
  validateUser: async (jwt) => {
    const { data, error } = await admin.auth.getUser(jwt);
    return error ? null : data.user?.id ?? null;
  },
  list: async (folder, offset) => bucket.list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }),
  remove: async (paths) => bucket.remove(paths),
  deleteUser: async (userId) => admin.auth.admin.deleteUser(userId, false),
}));
