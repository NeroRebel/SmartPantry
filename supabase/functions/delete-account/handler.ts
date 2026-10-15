interface Failure { message: string }
interface StorageEntry { name: string; id: string | null }
export interface DeleteAccountDependencies {
  validateUser: (token: string) => Promise<string | null>;
  list: (folder: string, offset: number) => Promise<{ data: StorageEntry[] | null; error: Failure | null }>;
  remove: (paths: string[]) => Promise<{ error: Failure | null }>;
  deleteUser: (userId: string) => Promise<{ error: Failure | null }>;
  cascadeVerified: boolean;
}

// All paths originate from the validated user folder, never from client-supplied metadata.
export async function collectAvatarPaths(userId: string, deps: Pick<DeleteAccountDependencies, 'list'>): Promise<string[]> {
  if (!/^[a-f0-9-]{36}$/i.test(userId)) throw new Error('Invalid owner');
  const folders = [userId];
  const files: string[] = [];
  let visited = 0;
  while (folders.length) {
    if (++visited > 100) throw new Error('Avatar folder limit exceeded');
    const folder = folders.shift()!;
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await deps.list(folder, offset);
      if (error || !Array.isArray(data)) throw new Error('Avatar listing failed');
      for (const entry of data) {
        if (!entry.name || entry.name === '.' || entry.name === '..' || /[/\\]/.test(entry.name)) throw new Error('Invalid avatar path');
        const path = `${folder}/${entry.name}`;
        if (entry.id) files.push(path); else folders.push(path);
        if (files.length + folders.length > 10000) throw new Error('Avatar file limit exceeded');
      }
      if (data.length < 100) break;
      if (offset >= 10000) throw new Error('Avatar page limit exceeded');
    }
  }
  return files;
}

export function createDeleteAccountHandler(deps: DeleteAccountDependencies) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  };
  const reply = (status: number, data: object) => new Response(JSON.stringify(data), { status, headers });
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'unauthorized' });
    try {
      const userId = await deps.validateUser(authorization.slice(7));
      if (!userId) return reply(401, { error: 'unauthorized' });
      const body = await request.json().catch(() => null);
      if (body?.confirmation !== 'DELETE' || Object.keys(body).some((key) => key !== 'confirmation')) return reply(400, { error: 'confirmation_required' });
      if (!deps.cascadeVerified) return reply(503, { error: 'cascade_verification_required' });
      const files = await collectAvatarPaths(userId, deps);
      for (let index = 0; index < files.length; index += 100) {
        if ((await deps.remove(files.slice(index, index + 100))).error) return reply(502, { error: 'avatar_cleanup_failed' });
      }
      // Abort if a concurrent upload left another object in the folder.
      if ((await collectAvatarPaths(userId, deps)).length) return reply(409, { error: 'avatar_cleanup_retry' });
      if ((await deps.deleteUser(userId)).error) return reply(502, { error: 'account_delete_failed' });
      return reply(200, { deleted: true, userId });
    } catch {
      // Do not return/log provider errors, JWTs, keys or the request.
      return reply(500, { error: 'account_delete_failed' });
    }
  };
}
