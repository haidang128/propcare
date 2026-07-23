import { Redirect, router, Stack } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { StepBadge } from '@/components/step-badge';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { canBookOutOfHours, jobPrice } from '@/lib/data';
import { incVatSuffix, pricing } from '@/lib/pricing';
import { formatGBP } from '@/lib/job-status';
import { useDraft } from '@/lib/new-request-draft';

/** Step 4 of 5 — standard vs out-of-hours, surcharge clearly labelled best-effort. */
export default function PickUrgency() {
  const { colors: c, status } = usePalette();
  const draft = useDraft();
  const jobType = draft.jobType;
  const offerOutOfHours = jobType ? canBookOutOfHours(jobType) : false;

  // A draft can carry an out-of-hours choice from a previous, eligible job type.
  // The database would reject the insert; reset it here so the price is honest.
  useEffect(() => {
    if (!offerOutOfHours && draft.urgency === 'out_of_hours') {
      draft.update({ urgency: 'standard' });
    }
  }, [offerOutOfHours, draft]);

  // On web the URL is real: a refresh, a bookmark or browser back/forward can
  // land here with an empty draft. Start the wizard over rather than crash.
  if (!jobType) return <Redirect href="/(landlord)/new-request" />;

  // null on a "something else" line: the office quotes it after it reads the
  // description, so there is no number to show yet
  const standardPrice = jobPrice(jobType, 'standard', draft.quantity);

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <StepBadge label="Step 4 of 5" /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
        <Text style={{ fontSize: 15, color: c.textSecondary }}>
          {jobType.name}
          {jobType.unit === 'hour' && draft.quantity > 1 ? ` × ${draft.quantity} hours` : ''} ·{' '}
          {draft.property?.address_line1}
        </Text>

        <Pressable
          onPress={() => draft.update({ urgency: 'standard' })}
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: draft.urgency === 'standard' ? 2 : 1,
            borderColor: draft.urgency === 'standard' ? c.primary : c.border,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 18,
            gap: 8,
          }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>Standard</Text>
            <Text
              selectable
              style={{ fontSize: 20, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }}>
              {standardPrice == null ? 'Quoted' : formatGBP(standardPrice)}
            </Text>
          </View>
          <Text style={{ fontSize: 14, color: c.textSecondary, lineHeight: 21 }}>
            {standardPrice == null
              ? 'Next available weekday slot. We price it first and you approve the price before anything is booked.'
              : `Next available weekday slot — usually within 2 working days. Fixed price${
                  incVatSuffix() ? `,${incVatSuffix()}` : ''
                }.`}
          </Text>
        </Pressable>

        {!offerOutOfHours ? (
          <Text style={{ fontSize: 13, color: c.textTertiary, lineHeight: 19 }}>
            Out-of-hours call-out isn&apos;t available for this job. For an emergency — a burst pipe
            or a leak you can&apos;t stop — start a new request and choose{' '}
            <Text style={{ fontWeight: '700' }}>Isolate + make safe</Text>.
          </Text>
        ) : (
        <Pressable
          onPress={() => draft.update({ urgency: 'out_of_hours' })}
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: draft.urgency === 'out_of_hours' ? 2 : 1,
            borderColor: draft.urgency === 'out_of_hours' ? c.primary : c.border,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 18,
            gap: 8,
          }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>
              Out-of-hours emergency
            </Text>
            <Text
              selectable
              style={{
                fontSize: 20,
                fontWeight: '800',
                color: c.textSecondary,
                fontVariant: ['tabular-nums'],
              }}>
              {formatGBP(jobPrice(jobType, 'out_of_hours', draft.quantity) ?? 0)}
            </Text>
          </View>
          <Text style={{ fontSize: 14, color: c.textSecondary, lineHeight: 21 }}>
            An on-call engineer tonight or this weekend. ×{pricing().out_of_hours_multiplier} surcharge,
            still a fixed price.
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              backgroundColor: status.amber.bg,
              borderRadius: Radius.button,
              borderCurve: 'continuous',
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}>
            <TriangleAlert size={16} color={status.amber.fg} style={{ marginTop: 1 }} />
            <Text
              style={{
                flex: 1,
                fontSize: 12.5,
                color: status.amber.fg,
                fontWeight: '600',
                lineHeight: 18,
              }}>
              Best effort — depends on an on-call engineer accepting. You&apos;re only charged if
              one does. If none accepts, we&apos;ll show you safe next steps.
            </Text>
          </View>
        </Pressable>
        )}

        <View style={{ marginTop: 'auto' }}>
          <PrimaryButton
            label={standardPrice == null ? 'Continue' : 'See your fixed price'}
            onPress={() => router.push('/(landlord)/new-request/price')}
          />
        </View>
      </ScrollView>
    </>
  );
}
