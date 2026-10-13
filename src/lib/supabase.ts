import 'react-native-url-polyfill/auto';
import './auth-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function createSupabaseClient(): SupabaseClient | null {
  // Accept only the public key type requested by this app; never bundle a server key.
  if (!supabaseUrl || !supabasePublishableKey?.startsWith('sb_publishable_')) return null;
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) return null;
    return createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage, lock: processLock } : {}),
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce',
      },
    });
  } catch { return null; }
}

export const supabase = createSupabaseClient();

// Temporary development diagnostics: never include credentials, errors, or session data.
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.info('[SmartPantry] Supabase configuration', {
    SUPABASE_URL_exists: Boolean(supabaseUrl),
    SUPABASE_PUBLISHABLE_KEY_exists: Boolean(supabasePublishableKey),
    SUPABASE_client_initialized: Boolean(supabase),
  });
}
