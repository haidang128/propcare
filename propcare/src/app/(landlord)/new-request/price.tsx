import { Redirect, router, Stack } from 'expo-router';
import { Check } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { PriceDisplay } from '@/components/price-display';
import { PrimaryButton } from '@/components/primary-button';
import { StepBadge } from '@/components/step-badge';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { createApprovedJob, jobPrice } from '@/lib/data';
import { formatGBP } from '@/lib/job-status';
import { useDraft } from '@/lib/new-request-draft';

type Slot = { start: string; end: string; label: string; timeLabel: string };

function upcomingSlots(): Slot[] {
  const slots: Slot[] = [];
  const windows = [
    { day: 1, from: 10, to: 12 },
    { day: 1, from: 14, to: 16 },
    { day: 2, from: 8, to: 10 },
  ];
  for (const w of windows) {
    const start = new Date();
    start.setDate(start.getDate() + w.day);
    start.setHours(w.from, 0, 0, 0);
    const end = new Date(start);
    end.setHours(w.to);
    const label = start.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const two = (n: number) => String(n).padStart(2, '0');
    slots.push({
      start: start.toISOString(),
      end: end.toISOString(),
      label,
      timeLabel: `${two(w.from)}:00–${two(w.to)}:00`,
    });
  }
  return slots;
}

/** Step 5 of 5 — the hero moment: fixed price, what's included, approve & book. */
export default function PriceApproval() {
  const { colors: c, status } = usePalette();
  const draft = useDraft();
  const jobType = draft.jobType;
  const slots = useMemo(() => upcomingSlots(), []);
  const [slotIndex, setSlotIndex] = useState(0);
  const [booking, setBooking] = useState(false);

  async function approveAndBook() {
    setBooking(true);
    try {
      const slot = slots[slotIndex];
      const job = await createApprovedJob({
        property: draft.property!,
        jobType: jobType!, // guarded below; this only runs from the rendered form
        description: draft.description,
        photoUris: draft.photoUris,
        urgency: draft.urgency,
        quantity: draft.quantity,
        slot: { start: slot.start, end: slot.end },
      });
      draft.update({ bookedJob: job, slot });
      router.replace('/(landlord)/new-request/booked');
    } catch (e) {
      showDialog('Booking failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBooking(false);
    }
  }

  // On web the URL is real: a refresh, a bookmark or browser back/forward can
  // land here with an empty draft. Start the wizard over rather than crash.
  if (!jobType || !draft.property) return <Redirect href="/(landlord)/new-request" />;

  const price = jobPrice(jobType, draft.urgency, draft.quantity);
  const hours = jobType.unit === 'hour' ? draft.quantity : 1;
  const included = [
    hours > 1 ? `${jobType.name} × ${hours} hours` : jobType.name,
    'All labour + standard parts up to £20',
    'Vetted, insured engineer · 12-month guarantee',
    'Extra work always needs your OK first',
  ];

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <StepBadge label="Step 5 of 5" /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 14, flexGrow: 1 }}>
        {price == null ? (
          // A "something else" request has no card price. Saying so plainly beats
          // showing £0 or inventing a number nobody has agreed to.
          <View
            style={{
              backgroundColor: c.primaryTint,
              borderRadius: Radius.card,
              borderCurve: 'continuous',
              padding: 18,
              gap: 6,
            }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: c.primary }}>
              We&apos;ll price this and come back to you
            </Text>
            <Text style={{ fontSize: 14, color: c.primary, lineHeight: 21 }}>
              Usually the same working day. You&apos;ll get a single fixed price to approve or turn
              down — nothing is booked and nothing is charged until you approve it.
            </Text>
          </View>
        ) : (
          <PriceDisplay amount={price} variant="hero" />
        )}

        <View
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            padding: 16,
            gap: 9,
          }}>
          {included.map((line) => (
            <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Check size={17} color={status.green.dot} strokeWidth={2.5} />
              <Text style={{ flex: 1, fontSize: 14, color: c.text }}>{line}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: c.textSecondary }}>
            When suits? Your tenant confirms from this and the two days after
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {slots.map((slot, i) => {
              const selected = slotIndex === i;
              return (
                <Pressable
                  key={slot.start}
                  onPress={() => setSlotIndex(i)}
                  style={{
                    flex: 1,
                    backgroundColor: selected ? c.primary : c.backgroundElement,
                    borderWidth: selected ? 0 : 1,
                    borderColor: c.border,
                    borderRadius: Radius.button,
                    borderCurve: 'continuous',
                    paddingVertical: 10,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    minHeight: 48,
                  }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: selected ? c.onPrimary : c.text,
                    }}>
                    {slot.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: selected ? c.onPrimary : c.textSecondary,
                      fontVariant: ['tabular-nums'],
                    }}>
                    {slot.timeLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 'auto', gap: 8 }}>
          <PrimaryButton
            label={price == null ? 'Send for a price' : `Approve ${formatGBP(price)} & book`}
            onPress={approveAndBook}
            loading={booking}
          />
          <Text style={{ fontSize: 12, color: c.textTertiary, textAlign: 'center' }}>
            You pay after the job is done, never before.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
