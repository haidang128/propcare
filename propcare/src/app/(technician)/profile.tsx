import { ShieldAlert, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { getOnCall, listMyCertifications, setOnCall, type Certification } from '@/lib/data';
import { useAuth } from '@/lib/auth';

const CERT_LABELS: Record<Certification['type'], string> = {
  niceic: 'NICEIC registration',
  napit: 'NAPIT registration',
  wras: 'Water regs (WRAS)',
  gas_safe: 'Gas Safe registration',
  public_liability: 'Public liability insurance',
  other: 'Certification',
};

function daysUntil(dateIso: string): number {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / 86400000);
}

/** Profile & on-call opt-in (design T4). */
export default function TechnicianProfile() {
  const { colors: c, status } = usePalette();
  const { signOut } = useAuth();
  const [onCall, setOnCallState] = useState(false);
  const [certs, setCerts] = useState<Certification[]>([]);

  useEffect(() => {
    getOnCall().then(setOnCallState);
    listMyCertifications().then(setCerts);
  }, []);

  async function toggle(value: boolean) {
    setOnCallState(value);
    try {
      await setOnCall(value);
    } catch {
      setOnCallState(!value);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View
        style={{
          backgroundColor: c.backgroundElement,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 14,
          borderCurve: 'continuous',
          padding: 16,
          gap: 12,
        }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: c.text }}>On-call pool</Text>
            <Text style={{ fontSize: 13, color: c.textSecondary, lineHeight: 19 }}>
              Get out-of-hours emergency jobs at 1.75× the day rate
            </Text>
          </View>
          <Switch value={onCall} onValueChange={toggle} />
        </View>
        {onCall ? (
          <View style={{ backgroundColor: status.green.bg, borderRadius: 10, borderCurve: 'continuous', padding: 11 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: status.green.fg }}>
              You&apos;re on call — emergency jobs will reach you by push and SMS
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={{
          backgroundColor: c.backgroundElement,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 14,
          borderCurve: 'continuous',
          padding: 16,
          gap: 12,
        }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: c.text }}>
          Certifications &amp; insurance
        </Text>
        {certs.length === 0 ? (
          <Text style={{ fontSize: 13.5, color: c.textSecondary }}>
            Nothing on file yet — the office adds your documents after vetting.
          </Text>
        ) : (
          certs.map((cert, i) => {
            const days = daysUntil(cert.expires_on);
            const state = days < 0 ? 'expired' : days <= 60 ? 'renew' : 'valid';
            const pal = state === 'expired' ? status.red : state === 'renew' ? status.amber : status.green;
            const Icon = state === 'valid' ? ShieldCheck : ShieldAlert;
            return (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Icon size={20} color={pal.dot} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: c.text }}>
                      {CERT_LABELS[cert.type]}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.textTertiary }}>
                      {state === 'expired'
                        ? `Expired ${new Date(cert.expires_on).toLocaleDateString('en-GB')}`
                        : `Expires ${new Date(cert.expires_on).toLocaleDateString('en-GB')}${state === 'renew' ? ` — ${days} days` : ''}`}
                    </Text>
                  </View>
                </View>
                <View style={{ backgroundColor: pal.bg, paddingVertical: 3, paddingHorizontal: 9, borderRadius: Radius.chip }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: pal.fg }}>
                    {state === 'expired' ? 'Expired' : state === 'renew' ? 'Renew soon' : 'Valid'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      <Text onPress={signOut} style={{ fontSize: 14, fontWeight: '700', color: c.textSecondary, textAlign: 'center', padding: 12 }}>
        Sign out
      </Text>
    </ScrollView>
  );
}
