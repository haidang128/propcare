import { router } from 'expo-router';
import { LockKeyhole, MailCheck, Radio, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth, type Role } from '@/lib/auth';

const BLUE = '#0F4C81';
const LIGHT_BLUE = '#9CC4E8';

/**
 * Onboarding / sign-up — design 03 screen A. Deep blue, the three promises,
 * email OTP entry. While Supabase is unconfigured, preview buttons let us
 * enter each role surface (week 1 exit demo).
 */
export default function SignIn() {
  const { signInWithOtp, signInWithGoogle, signInWithApple, previewAs, previewMode, role } =
    useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [busyProvider, setBusyProvider] = useState<'google' | 'apple' | null>(null);

  async function withProvider(provider: 'google' | 'apple') {
    setError(null);
    setBusyProvider(provider);
    const result = provider === 'google' ? await signInWithGoogle() : await signInWithApple();
    setBusyProvider(null);
    if (result.error) setError(result.error);
  }

  // once the magic link lands and the session arrives, move straight in
  useEffect(() => {
    if (role) router.replace('/');
  }, [role]);

  async function onContinue() {
    setError(null);
    setSending(true);
    const result = await signInWithOtp(email.trim());
    setSending(false);
    if (result.error) setError(result.error);
    else setSent(true);
  }

  function enterAs(role: Role) {
    previewAs(role);
    router.replace('/');
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BLUE }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 24, gap: 20, flexGrow: 1 }}>
      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.14)',
          borderRadius: 10,
          borderCurve: 'continuous',
          paddingVertical: 8,
          paddingHorizontal: 14,
          alignSelf: 'flex-start',
          marginTop: 24,
        }}>
        {/* Wordmark placeholder — final name TBD, keep swappable */}
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 19, letterSpacing: -0.4 }}>
          PropCare
        </Text>
      </View>

      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 32,
          fontWeight: '800',
          letterSpacing: -0.6,
          lineHeight: 40,
          marginTop: 12,
        }}>
        Repairs sorted.{'\n'}Prices fixed.{'\n'}No chasing.
      </Text>

      <View style={{ gap: 14, marginTop: 4 }}>
        <Promise
          icon={<LockKeyhole size={20} color={LIGHT_BLUE} />}
          title="Flat prices, approved by you"
          body="See the full fixed price before anyone lifts a tool."
        />
        <Promise
          icon={<Radio size={20} color={LIGHT_BLUE} />}
          title="Live status on every job"
          body="From booked to paid — you'll never need to ring around."
        />
        <Promise
          icon={<ShieldCheck size={20} color={LIGHT_BLUE} />}
          title="Vetted, insured engineers"
          body="NICEIC / NAPIT registered for all electrical work."
        />
      </View>

      <View style={{ marginTop: 'auto', gap: 10, paddingBottom: 8 }}>
        {sent ? (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.14)',
              borderRadius: 12,
              borderCurve: 'continuous',
              padding: 16,
              alignItems: 'center',
              gap: 8,
            }}>
            <MailCheck size={26} color={LIGHT_BLUE} />
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
              Check your email
            </Text>
            <Text
              style={{
                color: '#FFFFFF',
                opacity: 0.85,
                fontSize: 13.5,
                textAlign: 'center',
                lineHeight: 20,
              }}>
              We&apos;ve sent a sign-in link to {email.trim()}. Open it on this device — you&apos;ll
              land straight back here, signed in.
            </Text>
            <Pressable onPress={() => setSent(false)} hitSlop={8}>
              <Text style={{ color: LIGHT_BLUE, fontSize: 13, fontWeight: '700' }}>
                Use a different email
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => withProvider('google')}
              disabled={busyProvider !== null}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#EDF0F3' : '#FFFFFF',
                minHeight: 52,
                borderRadius: 12,
                borderCurve: 'continuous',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              })}>
              {busyProvider === 'google' ? (
                <ActivityIndicator color={BLUE} />
              ) : (
                <>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#4285F4' }}>G</Text>
                  <Text style={{ color: '#17222E', fontSize: 16, fontWeight: '700' }}>
                    Continue with Google
                  </Text>
                </>
              )}
            </Pressable>
            {process.env.EXPO_OS === 'ios' ? (
              <Pressable
                onPress={() => withProvider('apple')}
                disabled={busyProvider !== null}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#1A1A1A' : '#000000',
                  minHeight: 52,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                })}>
                {busyProvider === 'apple' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={{ fontSize: 18, color: '#FFFFFF' }}></Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                      Continue with Apple
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
              <Text style={{ color: '#FFFFFF', opacity: 0.65, fontSize: 12, fontWeight: '600' }}>
                or use email
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor="#8A96A1"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingVertical: 14,
                paddingHorizontal: 16,
                fontSize: 15,
                color: '#17222E',
              }}
            />
            {error ? (
              <Text selectable style={{ color: '#FFD9D6', fontSize: 13, fontWeight: '600' }}>
                {error}
              </Text>
            ) : null}
            <Pressable
              onPress={onContinue}
              disabled={sending || !email.includes('@')}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#0B1620' : '#17222E',
                minHeight: 52,
                borderRadius: 12,
                borderCurve: 'continuous',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !email.includes('@') ? 0.6 : 1,
              })}>
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Continue</Text>
              )}
            </Pressable>
          </>
        )}
        <Text style={{ color: '#FFFFFF', opacity: 0.75, fontSize: 12, textAlign: 'center' }}>
          No subscription — you only pay for jobs you book
        </Text>

        {previewMode ? (
          <View style={{ marginTop: 16, gap: 8 }}>
            <Text
              style={{
                color: '#FFFFFF',
                opacity: 0.6,
                fontSize: 12,
                fontWeight: '700',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
              Dev preview — no backend configured
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['landlord', 'technician', 'admin'] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => enterAs(r)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.4)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Promise({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ marginTop: 1 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: '#FFFFFF', opacity: 0.85, fontSize: 13.5, lineHeight: 20 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}
