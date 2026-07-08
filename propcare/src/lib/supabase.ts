import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True once a real Supabase project is wired up via .env — until then the app runs in preview mode. */
export const isSupabaseConfigured = Boolean(url && anonKey);

const isWeb = process.env.EXPO_OS === 'web';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        // native has no localStorage — persist sessions in AsyncStorage
        ...(isWeb ? {} : { storage: AsyncStorage }),
        autoRefreshToken: true,
        persistSession: true,
        // magic links land back on the site with tokens in the URL hash;
        // implicit flow means the link works even when the email client
        // opens a different browser than the one that requested it
        detectSessionInUrl: isWeb,
        flowType: 'implicit',
      },
    })
  : null;
