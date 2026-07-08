import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/** Implicit-flow OAuth/magic-link redirects carry tokens in the URL hash. */
function sessionFromUrl(url: string): { access_token: string; refresh_token: string } | null {
  const hash = url.split('#')[1];
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}

export type Role = 'landlord' | 'technician' | 'admin';

type AuthState = {
  /** null = signed out */
  role: Role | null;
  userId: string | null;
  loading: boolean;
  /** True when running without a Supabase project (role-picker preview mode) */
  previewMode: boolean;
  signInWithOtp: (email: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  /** iOS only — native Sign in with Apple */
  signInWithApple: () => Promise<{ error?: string }>;
  /** Preview mode only: enter the app as a given role without a backend */
  previewAs: (role: Role) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    let mounted = true;

    const loadRole = async (uid: string) => {
      const { data } = await sb.from('profiles').select('role').eq('id', uid).maybeSingle();
      if (!mounted) return;
      // the signup trigger creates the profile; a brief race right after
      // OAuth signup can return no row yet — retry once before giving up
      if (!data) {
        await new Promise((r) => setTimeout(r, 800));
        const retry = await sb.from('profiles').select('role').eq('id', uid).maybeSingle();
        if (!mounted) return;
        setRole(((retry.data?.role as Role) ?? 'landlord') as Role);
      } else {
        setRole(data.role as Role);
      }
      setLoading(false);
    };

    sb.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) {
        setUserId(session.user.id);
        loadRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      // IMPORTANT: no awaited supabase calls inside this callback — the client
      // holds a lock while it runs and a query here can deadlock. Defer instead.
      if (!session) {
        setRole(null);
        setUserId(null);
        setLoading(false);
        return;
      }
      setUserId(session.user.id);
      setTimeout(() => loadRole(session.user.id), 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // native: magic links / OAuth open propcare:// with tokens in the hash — pick them up
  const deepLink = Linking.useURL();
  useEffect(() => {
    if (!supabase || !deepLink || process.env.EXPO_OS === 'web') return;
    const tokens = sessionFromUrl(deepLink);
    if (tokens) supabase.auth.setSession(tokens);
  }, [deepLink]);

  const signInWithOtp = useCallback(async (email: string) => {
    if (!supabase) return { error: 'Supabase is not configured yet — use preview mode below.' };
    const emailRedirectTo =
      process.env.EXPO_OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : Linking.createURL('/');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
    return error ? { error: error.message } : {};
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: 'Supabase is not configured yet — use preview mode below.' };
    try {
      if (process.env.EXPO_OS === 'web') {
        // full-page redirect; detectSessionInUrl completes it when Google returns
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
        });
        return error ? { error: error.message } : {};
      }
      // native: run the OAuth dance in an in-app browser, then adopt the tokens
      const redirectTo = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) return { error: error?.message ?? 'Could not start Google sign-in' };
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return {};
      const tokens = sessionFromUrl(result.url);
      if (!tokens) return { error: 'Google sign-in did not return a session' };
      const { error: sessionError } = await supabase.auth.setSession(tokens);
      return sessionError ? { error: sessionError.message } : {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Google sign-in failed' };
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    if (!supabase) return { error: 'Supabase is not configured yet — use preview mode below.' };
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return { error: 'Apple did not return a token' };
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      return error ? { error: error.message } : {};
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return {};
      return { error: e instanceof Error ? e.message : 'Apple sign-in failed' };
    }
  }, []);

  const previewAs = useCallback((r: Role) => {
    setRole(r);
    setUserId(`preview-${r}`);
  }, []);

  const signOut = useCallback(() => {
    supabase?.auth.signOut();
    setRole(null);
    setUserId(null);
  }, []);

  const value = useMemo(
    () => ({
      role,
      userId,
      loading,
      previewMode: !isSupabaseConfigured,
      signInWithOtp,
      signInWithGoogle,
      signInWithApple,
      previewAs,
      signOut,
    }),
    [role, userId, loading, signInWithOtp, signInWithGoogle, signInWithApple, previewAs, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
