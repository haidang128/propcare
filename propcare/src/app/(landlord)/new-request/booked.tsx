import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { StatusTimeline } from '@/components/status-timeline';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { formatGBP } from '@/lib/job-status';
import { useDraft } from '@/lib/new-request-draft';

/** Booked confirmation — tracking begins (design 02, screen 6). */
export default function Booked() {
  const { colors: c, status } = usePalette();
  const draft = useDraft();
  const job = draft.bookedJob;
  // a "something else" request stops at 'requested' until the office prices it
  const awaitingQuote = job?.status === 'requested';

  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 8 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: status.green.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Check size={32} color={status.green.dot} strokeWidth={3} />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '700', color: c.text }}>
          {awaitingQuote ? 'Sent for a price' : 'Booked'}
        </Text>
        <Text style={{ fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 }}>
          {awaitingQuote
            ? "We'll come back with a fixed price to approve — usually the same working day. Nothing is booked or charged until you say yes."
            : `${draft.slot ? `${draft.slot.label}, ${draft.slot.timeLabel}` : ''} · ${
                job?.agreed_price_inc_vat != null ? `${formatGBP(job.agreed_price_inc_vat)} fixed` : ''
              }${
                draft.property?.tenant_name
                  ? `\nWe'll text ${draft.property.tenant_name.split(' ')[0]} to confirm access.`
                  : ''
              }`}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: c.backgroundElement,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: Radius.card,
          borderCurve: 'continuous',
          padding: 16,
        }}>
        <StatusTimeline
          steps={
            awaitingQuote
              ? [
                  { title: 'Request received', detail: `Today, ${now}`, state: 'done' },
                  {
                    title: 'Being priced',
                    detail: 'Usually the same working day',
                    state: 'current',
                    currentHue: 'blue',
                  },
                  {
                    title: 'Your approval',
                    detail: 'One fixed price, yes or no',
                    state: 'upcoming',
                  },
                  { title: 'Booked, then done', state: 'upcoming' },
                ]
              : [
                  { title: 'Request received', detail: `Today, ${now}`, state: 'done' },
                  {
                    title: `Price approved — ${
                      job?.agreed_price_inc_vat != null ? formatGBP(job.agreed_price_inc_vat) : ''
                    }`,
                    detail: `Today, ${now} · by you`,
                    state: 'done',
                  },
                  {
                    title: 'Scheduling your visit',
                    detail: 'Waiting for tenant to confirm access',
                    state: 'current',
                    currentHue: 'blue',
                  },
                  {
                    title: 'Job day — live updates here',
                    detail: "You won't need to call anyone",
                    state: 'upcoming',
                  },
                ]
          }
        />
      </View>

      <View style={{ marginTop: 'auto' }}>
        <PrimaryButton
          label="Back to home"
          variant="secondary"
          onPress={() => {
            // No draft.reset() here: the earlier wizard steps are still mounted
            // below this screen and read `draft.jobType!`, so clearing the draft
            // while they are alive crashes them. Leaving the wizard unmounts
            // DraftProvider, which discards the draft anyway.
            router.dismissTo('/(landlord)');
          }}
        />
      </View>
    </ScrollView>
  );
}
