import { useEffect } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Live status: re-runs `onChange` whenever any visible job row changes
 * (Supabase Realtime, RLS applies). "Always know the status" — no polling,
 * no pull-to-refresh needed.
 */
export function useJobsRealtime(onChange: () => void) {
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase!
      .channel('jobs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, onChange)
      .subscribe();
    return () => {
      supabase!.removeChannel(channel);
    };
  }, [onChange]);
}
