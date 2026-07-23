import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { loadPricingSettings } from '@/lib/pricing';
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

/**
 * A sign-in link that fails comes back as query/hash params, not as an error
 * from any call we make — so without this the user lands on the sign-in screen
 * with no session, no message, and no idea the link was simply stale.
 */
function noticeFromUrl(url: string): string | null {
  const [head, hash] = url.split('#');
  const query = head.includes('?') ? head.slice(head.indexOf('?') + 1) : '';
  const params = new URLSearchParams(`${query}${query && hash ? '&' : ''}${hash ?? ''}`);
  const code = params.get('error_code');
  const description = params.get('error_description');
  if (!code && !description) return null;
  if (code === 'otp_expired' || description?.toLowerCase().includes('expired')) {
    return 'That sign-in link had already expired — they only last an hour, and only work once. Send yourself a fresh one below.';
  }
  if (code === 'access_denied') {
    return 'That sign-in link could not be used. Send yourself a fresh one below.';
  }
  return description?.replace(/\+/g, ' ') ?? 'Sign-in did not complete. Please try again.';
}

export type Role = 'landlord' | 'technician' | 'admin';

type AuthState = {
  /** null = signed out */
  role: Role | null;
  userId: string | null;
  loading: boolean;
  /** True when running without a Supabase project (role-picker preview mode) */
  previewMode: boolean;
  /** Set when a sign-in link came back rejected, so the screen can explain it */
  notice: string | null;
  clearNotice: () => void;
  signInWithOtp: (email: string) => Promise<{ error?: string }>;
  /** The code in the same email — works even when the link opens elsewhere */
  verifyEmailCode: (email: string, code: string) => Promise<{ error?: string }>;
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
  // A rejected link redirects here with the reason in the URL. Read it once at
  // mount (lazily, so it is not re-read on every render)…
  const [landingNotice] = useState<string | null>(() =>
    process.env.EXPO_OS === 'web' && typeof window !== 'undefined'
      ? noticeFromUrl(window.location.href)
      : null,
  );
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // …then strip it from the address bar, so a refresh does not resurrect a
  // complaint about a link the user has already moved on from.
  useEffect(() => {
    if (!landingNotice || typeof window === 'undefined') return;
    window.history.replaceState({}, '', window.location.pathname);
  }, [landingNotice]);

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    let mounted = true;

    const loadRole = async (uid: string) => {
      // pricing_settings is readable by any signed-in user; failures keep the
      // conservative defaults in pricing.ts (unregistered for VAT, no floor)
      loadPricingSettings().catch(() => {});
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

  // A native deep link that carried no session carried a reason instead;
  // derived rather than stored, so it needs no effect.
  const deepLinkNotice =
    deepLink && process.env.EXPO_OS !== 'web' && !sessionFromUrl(deepLink)
      ? noticeFromUrl(deepLink)
      : null;
  const notice = noticeDismissed ? null : (landingNotice ?? deepLinkNotice);

  const signInWithOtp = useCallback(async (email: string) => {
    if (!supabase) return { error: 'Supabase is not configured yet — use preview mode below.' };
    const emailRedirectTo =
      process.env.EXPO_OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : Linking.createURL('/');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
    return error ? { error: error.message } : {};
  }, []);

  /**
   * The same email carries a code as well as a link. The link only signs you in
   * on whatever browser opens it — which on a phone is often the mail app's own
   * one, leaving the app you started in still signed out with no way forward.
   * The code always lands in the session you are actually looking at.
   *
   * A first-time address gets a signup confirmation and a returning one gets a
   * magic link; the code is the same, only the token type differs, so try each.
   */
  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    if (!supabase) return { error: 'Supabase is not configured yet — use preview mode below.' };
    const token = code.replace(/\D/g, '');
    if (!token) return { error: 'Enter the code from the email.' };
    let lastError = 'That code did not work. Check it, or send yourself a new email.';
    for (const type of ['email', 'signup', 'magiclink'] as const) {
      const { error } = await supabase.auth.verifyOtp({ email, token, type });
      if (!error) {
        setNoticeDismissed(true);
        return {};
      }
      lastError = error.message;
    }
    return { error: lastError };
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
    // a global sign-out is a network call; if it fails, drop the stored session
    // anyway rather than leaving someone signed in on a shared device
    supabase?.auth.signOut().catch(() => supabase?.auth.signOut({ scope: 'local' }));
    setRole(null);
    setUserId(null);
    setNoticeDismissed(true);
  }, []);

  const clearNotice = useCallback(() => setNoticeDismissed(true), []);

  const value = useMemo(
    () => ({
      role,
      userId,
      loading,
      previewMode: !isSupabaseConfigured,
      notice,
      clearNotice,
      signInWithOtp,
      verifyEmailCode,
      signInWithGoogle,
      signInWithApple,
      previewAs,
      signOut,
    }),
    [
      role,
      userId,
      loading,
      notice,
      clearNotice,
      signInWithOtp,
      verifyEmailCode,
      signInWithGoogle,
      signInWithApple,
      previewAs,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
