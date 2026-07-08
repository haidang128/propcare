import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Registers the Expo push token against the signed-in profile so the
 * notify-push function can reach this device. Best-effort: silently a no-op
 * on web, in Expo Go (no remote push since SDK 53), or before EAS is set up —
 * it lights up fully with the week-8 development/production builds.
 */
export function usePushRegistration() {
  const { role, userId } = useAuth();

  useEffect(() => {
    if (!role || !userId || !isSupabaseConfigured) return;
    if (process.env.EXPO_OS === 'web' || !Device.isDevice) return;

    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        const granted =
          status === 'granted' ||
          (await Notifications.requestPermissionsAsync()).status === 'granted';
        if (!granted) return;
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        await supabase!.from('profiles').update({ expo_push_token: token }).eq('id', userId);
      } catch {
        // no EAS project yet, or push unsupported in this runtime — fine for now
      }
    })();
  }, [role, userId]);
}
