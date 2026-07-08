import { useLocalSearchParams } from 'expo-router';
import { Check, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { usePalette } from '@/hooks/use-palette';
import { TENANT_ACCESS_ENDPOINT } from '@/lib/data';

type SlotInfo = {
  tenant_name: string | null;
  technician_name: string | null;
  job_name: string;
  address_line1: string | null;
  offered_slots: { start: string; end: string }[];
  chosen: { start: string; end: string } | null;
};

function slotLabel(s: { start: string; end: string }): { day: string; time: string } {
  const start = new Date(s.start);
  const end = new Date(s.end);
  const t = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return {
    day: start.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit' }),
    time: `${t(start)}–${t(end)}`,
  };
}

/**
 * Tenant slot picker — opened from an SMS link, no login, nothing to install
 * (design 04 TN). Works in any phone browser via the web build.
 */
export default function TenantVisit() {
  const { colors: c, status } = usePalette();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [info, setInfo] = useState<SlotInfo | null | 'error' | 'expired'>(
    TENANT_ACCESS_ENDPOINT ? null : 'error',
  );
  const [selected, setSelected] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    if (!TENANT_ACCESS_ENDPOINT) return;
    fetch(`${TENANT_ACCESS_ENDPOINT}?token=${token}`)
      .then(async (r) => {
        if (r.status === 410) return setInfo('expired');
        if (!r.ok) return setInfo('error');
        const data = (await r.json()) as SlotInfo;
        setInfo(data);
        if (data.chosen) setConfirmed(data.chosen);
      })
      .catch(() => setInfo('error'));
  }, [token]);

  async function confirm() {
    if (!info || typeof info === 'string' || !TENANT_ACCESS_ENDPOINT) return;
    const slot = info.offered_slots[selected];
    setConfirming(true);
    try {
      const r = await fetch(TENANT_ACCESS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, start: slot.start, end: slot.end }),
      });
      if (r.ok) setConfirmed(slot);
    } finally {
      setConfirming(false);
    }
  }

  if (info === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (info === 'error' || info === 'expired') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.background }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 6 }}>
          {info === 'expired' ? 'This link has expired' : "This link isn't working"}
        </Text>
        <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 21 }}>
          Please ask your landlord to send a new one — it only takes a moment.
        </Text>
      </View>
    );
  }

  const tenantFirst = info.tenant_name?.split(' ')[0];
  const techFirst = info.technician_name?.split(' ')[0] ?? 'the engineer';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 24, gap: 16, flexGrow: 1, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: c.primary, letterSpacing: -0.3 }}>PropCare</Text>

      {confirmed ? (
        <View style={{ alignItems: 'center', gap: 12, paddingTop: 32 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: status.green.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={32} color={status.green.dot} strokeWidth={3} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>You&apos;re booked</Text>
          <Text style={{ fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 }}>
            {techFirst} is coming {slotLabel(confirmed).day.toLowerCase()}, {slotLabel(confirmed).time}.{'\n'}
            We&apos;ll text you a reminder and when they&apos;re on the way.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 23, fontWeight: '800', color: c.text, lineHeight: 30 }}>
              {tenantFirst ? `Hi ${tenantFirst} — ` : ''}when can {techFirst} fix the{' '}
              {info.job_name.toLowerCase()}?
            </Text>
            <Text style={{ fontSize: 14.5, color: c.textSecondary, lineHeight: 22 }}>
              Your landlord has booked the repair. Just pick a time you&apos;ll be home. Takes 10
              seconds, nothing to install.
            </Text>
          </View>

          {info.technician_name ? (
            <View style={{ backgroundColor: c.backgroundElement, borderWidth: 1, borderColor: c.border, borderRadius: 14, borderCurve: 'continuous', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: status.green.bg, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 }}>
                <ShieldCheck size={12} color={status.green.fg} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: status.green.fg }}>ID checked</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: c.text }}>
                {info.technician_name} — will show a badge
              </Text>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            {info.offered_slots.map((s, i) => {
              const { day, time } = slotLabel(s);
              const sel = selected === i;
              return (
                <Pressable
                  key={s.start}
                  onPress={() => setSelected(i)}
                  style={{
                    backgroundColor: c.backgroundElement,
                    borderWidth: sel ? 2 : 1.5,
                    borderColor: sel ? c.primary : c.border,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    minHeight: 60,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: 18,
                  }}>
                  <View>
                    <Text style={{ fontSize: 15.5, fontWeight: sel ? '800' : '700', color: c.text }}>{day}</Text>
                    <Text style={{ fontSize: 13, color: c.textSecondary, fontVariant: ['tabular-nums'] }}>{time}</Text>
                  </View>
                  {sel ? (
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color={c.onPrimary} strokeWidth={3.5} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 'auto', gap: 8 }}>
            <PrimaryButton
              label={`Confirm ${slotLabel(info.offered_slots[selected]).day}, ${slotLabel(info.offered_slots[selected]).time}`}
              loading={confirming}
              onPress={confirm}
            />
            <Text style={{ fontSize: 12, color: c.textTertiary, textAlign: 'center', lineHeight: 18 }}>
              No app, no account, no charge to you.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
