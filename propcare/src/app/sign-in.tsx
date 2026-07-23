import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LockKeyhole, MailCheck, Radio, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth, type Role } from '@/lib/auth';

const BLUE = '#0F4C81';
const LIGHT_BLUE = '#9CC4E8';

/**
 * Supabase refuses email-template edits on the free tier while it uses the
 * built-in mail provider, so today's email carries only a link. The code path
 * is built and tested; flip this on with the custom SMTP that launch needs
 * anyway (see the auth SMTP item in the launch checklist).
 */
const EMAIL_CARRIES_CODE = process.env.EXPO_PUBLIC_EMAIL_CODES === '1';

/**
 * Onboarding / sign-up — design 03 screen A. Deep blue, the three promises,
 * email OTP entry. While Supabase is unconfigured, preview buttons let us
 * enter each role surface (week 1 exit demo).
 */
export default function SignIn() {
  const {
    signInWithOtp,
    verifyEmailCode,
    signInWithGoogle,
    signInWithApple,
    previewAs,
    previewMode,
    role,
    notice,
    clearNotice,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resent, setResent] = useState(false);
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
    clearNotice();
    setSending(true);
    const result = await signInWithOtp(email.trim());
    setSending(false);
    if (result.error) setError(result.error);
    else setSent(true);
  }

  async function onResend() {
    setError(null);
    setResent(false);
    setSending(true);
    const result = await signInWithOtp(email.trim());
    setSending(false);
    if (result.error) setError(result.error);
    else setResent(true);
  }

  async function onVerify() {
    setError(null);
    setVerifying(true);
    const result = await verifyEmailCode(email.trim(), code);
    setVerifying(false);
    if (result.error) setError(result.error);
    // success routes through the role effect above
  }

  /** Back to the start: the email box, Google, everything. */
  function startOver() {
    setSent(false);
    setCode('');
    setResent(false);
    setError(null);
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
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
        {/* Wordmark — final name TBD, keep swappable */}
        <Image
          source={require('../../assets/brand/glyph-white.svg')}
          style={{ width: 22, height: 22 }}
          contentFit="contain"
        />
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
        {notice && !sent ? (
          <View
            style={{
              backgroundColor: 'rgba(255,217,214,0.16)',
              borderRadius: 12,
              borderCurve: 'continuous',
              padding: 14,
            }}>
            <Text style={{ color: '#FFD9D6', fontSize: 13.5, fontWeight: '600', lineHeight: 20 }}>
              {notice}
            </Text>
          </View>
        ) : null}
        {sent ? (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.14)',
              borderRadius: 12,
              borderCurve: 'continuous',
              padding: 16,
              gap: 10,
            }}>
            <View style={{ alignItems: 'center', gap: 8 }}>
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
                {EMAIL_CARRIES_CODE
                  ? `We've sent ${email.trim()} a sign-in link and a code. Tap the link, or type the code in here — either works.`
                  : `We've sent a sign-in link to ${email.trim()}. Open it on this device and you'll land back here, signed in.`}
              </Text>
            </View>

            {/* The code path exists because the link signs you in only in
                whichever browser opens it, which is often not this one. */}
            {EMAIL_CARRIES_CODE ? (
              <>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="Sign-in code"
                  placeholderTextColor="#8A96A1"
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  returnKeyType="go"
                  onSubmitEditing={onVerify}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    fontSize: 18,
                    fontWeight: '700',
                    letterSpacing: 4,
                    textAlign: 'center',
                    color: '#17222E',
                  }}
                />
                <Pressable
                  onPress={onVerify}
                  disabled={verifying || code.trim().length < 6}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? '#0B1620' : '#17222E',
                    minHeight: 52,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: code.trim().length < 6 ? 0.6 : 1,
                  })}>
                  {verifying ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                      Sign in with code
                    </Text>
                  )}
                </Pressable>
              </>
            ) : null}

            {error ? (
              <Text selectable style={{ color: '#FFD9D6', fontSize: 13, fontWeight: '600' }}>
                {error}
              </Text>
            ) : null}
            {resent ? (
              <Text style={{ color: LIGHT_BLUE, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                New email sent.
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Pressable onPress={startOver} hitSlop={8}>
                <Text style={{ color: LIGHT_BLUE, fontSize: 13, fontWeight: '700' }}>
                  ← Back
                </Text>
              </Pressable>
              <Pressable onPress={onResend} disabled={sending} hitSlop={8}>
                <Text style={{ color: LIGHT_BLUE, fontSize: 13, fontWeight: '700' }}>
                  {sending ? 'Sending…' : 'Send it again'}
                </Text>
              </Pressable>
            </View>
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
        <Pressable onPress={() => router.push('/privacy')} hitSlop={8}>
          <Text
            style={{
              color: '#FFFFFF',
              opacity: 0.6,
              fontSize: 12,
              fontWeight: '600',
              textAlign: 'center',
              textDecorationLine: 'underline',
            }}>
            Privacy policy
          </Text>
        </Pressable>

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
