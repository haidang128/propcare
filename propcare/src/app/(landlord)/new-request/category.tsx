import { router, Stack } from 'expo-router';
import { Droplets, Hammer, LockKeyhole, ShieldCheck, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { StepBadge } from '@/components/step-badge';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { listJobTypes, type Category, type JobType } from '@/lib/data';
import { formatGBP } from '@/lib/job-status';
import { useDraft } from '@/lib/new-request-draft';

const CATEGORIES: { key: Category; title: string; blurb: string }[] = [
  { key: 'plumbing', title: 'Plumbing', blurb: 'Taps, leaks, drains, hot water' },
  { key: 'electrical', title: 'Electrical', blurb: 'Sockets, lighting, consumer units' },
  { key: 'handyman', title: 'Handyman', blurb: 'Doors, locks, fixings, small repairs' },
];

/** Step 2 of 5 — category with "from" prices and the certification trust signal. */
export default function PickCategory() {
  const { colors: c, status } = usePalette();
  const draft = useDraft();
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [selected, setSelected] = useState<Category | null>(draft.jobType?.category ?? null);

  useEffect(() => {
    listJobTypes().then(setJobTypes).catch(() => {});
  }, []);

  function fromPrice(category: Category): string | null {
    const prices = jobTypes.filter((t) => t.category === category).map((t) => t.price_inc_vat);
    if (prices.length === 0) return null;
    return `from ${formatGBP(Math.min(...prices)).replace('.00', '')}`;
  }

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <StepBadge label="Step 2 of 5" /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
        <Text style={{ fontSize: 15, color: c.textSecondary }}>
          {draft.property?.address_line1}
        </Text>

        <View style={{ gap: 12 }}>
          {CATEGORIES.map(({ key, title, blurb }) => {
            const isSelected = selected === key;
            const Icon = key === 'plumbing' ? Droplets : key === 'electrical' ? Zap : Hammer;
            const from = fromPrice(key);
            return (
              <Pressable
                key={key}
                onPress={() => setSelected(key)}
                style={{
                  backgroundColor: c.backgroundElement,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? c.primary : c.border,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  padding: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: Radius.card,
                    borderCurve: 'continuous',
                    backgroundColor: isSelected ? c.primaryTint : c.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon size={26} color={isSelected ? c.primary : c.textSecondary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{title}</Text>
                  <Text style={{ fontSize: 13, color: c.textSecondary }}>{blurb}</Text>
                  {key === 'electrical' ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        alignSelf: 'flex-start',
                        backgroundColor: status.green.bg,
                        paddingVertical: 3,
                        paddingHorizontal: 8,
                        borderRadius: Radius.chip,
                        marginTop: 4,
                      }}>
                      <ShieldCheck size={12} color={status.green.fg} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: status.green.fg }}>
                        NICEIC / NAPIT registered only
                      </Text>
                    </View>
                  ) : null}
                </View>
                {from ? (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: isSelected ? c.primary : c.textSecondary,
                      fontVariant: ['tabular-nums'],
                    }}>
                    {from}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: c.primaryTint,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}>
          <LockKeyhole size={18} color={c.primary} />
          <Text style={{ flex: 1, fontSize: 13, color: c.primary, fontWeight: '600', lineHeight: 18 }}>
            Every job has a flat, pre-approved price. No hourly rates, no call-out fees.
          </Text>
        </View>

        <View style={{ marginTop: 'auto' }}>
          <PrimaryButton
            label="Continue"
            disabled={!selected}
            onPress={() => {
              // job type is chosen on the next step; store the category via a provisional clear
              draft.update({ jobType: null });
              router.push({
                pathname: '/(landlord)/new-request/describe',
                params: { category: selected! },
              });
            }}
          />
        </View>
      </ScrollView>
    </>
  );
}
