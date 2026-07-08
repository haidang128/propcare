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
        <Text style={{ fontSize: 24, fontWeight: '700', color: c.text }}>Booked</Text>
        <Text style={{ fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 }}>
          {draft.slot ? `${draft.slot.label}, ${draft.slot.timeLabel}` : ''} ·{' '}
          {job ? `${formatGBP(job.agreed_price_inc_vat)} fixed` : ''}
          {draft.property?.tenant_name
            ? `\nWe'll text ${draft.property.tenant_name.split(' ')[0]} to confirm access.`
            : ''}
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
          steps={[
            { title: 'Request received', detail: `Today, ${now}`, state: 'done' },
            {
              title: `Price approved — ${job ? formatGBP(job.agreed_price_inc_vat) : ''}`,
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
          ]}
        />
      </View>

      <View style={{ marginTop: 'auto' }}>
        <PrimaryButton
          label="Back to home"
          variant="secondary"
          onPress={() => {
            draft.reset();
            router.dismissTo('/(landlord)');
          }}
        />
      </View>
    </ScrollView>
  );
}
