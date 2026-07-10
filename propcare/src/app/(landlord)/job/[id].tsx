import { Link, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { StatusChip } from '@/components/status-chip';
import { StatusTimeline, type TimelineStep } from '@/components/status-timeline';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { getJob, type Job } from '@/lib/data';
import { formatGBP, type JobStatus } from '@/lib/job-status';
import { vatBreakdown } from '@/lib/pricing';

const HAPPY_PATH: JobStatus[] = ['requested', 'priced', 'approved', 'scheduled', 'in_progress', 'completed', 'paid'];

const STEP_TITLES: Partial<Record<JobStatus, string>> = {
  requested: 'Request received',
  priced: 'Priced from the rate card',
  approved: 'Price approved',
  scheduled: 'Booked',
  in_progress: 'Work in progress',
  completed: 'Work completed',
  paid: 'Paid',
};

function timelineFor(job: Job): TimelineStep[] {
  const currentIndex = HAPPY_PATH.indexOf(job.status);
  return HAPPY_PATH.map((s, i) => ({
    title:
      s === 'approved'
        ? `Price approved — ${formatGBP(job.agreed_price_inc_vat)}`
        : (STEP_TITLES[s] ?? s),
    state: currentIndex === -1 ? 'upcoming' : i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming',
    currentHue: s === 'in_progress' ? 'green' : 'blue',
  }));
}

/** Job detail — status timeline, price breakdown (design 03 screen D, week-2 subset). */
export default function JobDetail() {
  const { colors: c } = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null | undefined>(undefined);

  useEffect(() => {
    getJob(id).then(setJob);
  }, [id]);

  if (job === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (job === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text selectable style={{ fontSize: 15, color: c.textSecondary, textAlign: 'center' }}>
          We can&apos;t load this job. The job still exists and your price is unchanged — this is
          just a loading problem.
        </Text>
      </View>
    );
  }

  // null until VAT registration is recorded — we must not itemise tax we don't charge
  const vat = vatBreakdown(job.agreed_price_inc_vat);

  return (
    <>
      <Stack.Screen options={{ title: job.reference }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 21, fontWeight: '700', color: c.text }}>
            {job.job_type?.name ?? 'Job'}
          </Text>
          <Text style={{ fontSize: 13, color: c.textSecondary }}>
            {job.property?.address_line1}
            {job.property?.postcode ? `, ${job.property.postcode}` : ''}
            {job.scheduled_start
              ? ` · ${new Date(job.scheduled_start).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                })}`
              : ''}
          </Text>
          <View style={{ marginTop: 6 }}>
            <StatusChip status={job.status} />
          </View>
        </View>

        {job.urgency === 'out_of_hours' && !['completed', 'paid', 'cancelled'].includes(job.status) ? (
          <Link href={{ pathname: '/(landlord)/fallback/[id]', params: { id: job.id } }} asChild>
            <Pressable
              style={{
                backgroundColor: c.primaryTint,
                borderRadius: Radius.card,
                borderCurve: 'continuous',
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.primary }}>
                Waiting for an engineer? Safety steps while you wait →
              </Text>
            </Pressable>
          </Link>
        ) : null}

        <View
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            padding: 16,
          }}>
          <StatusTimeline steps={timelineFor(job)} />
        </View>

        {job.description ? (
          <View
            style={{
              backgroundColor: c.backgroundElement,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: Radius.card,
              borderCurve: 'continuous',
              padding: 16,
              gap: 4,
            }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.textTertiary, textTransform: 'uppercase', letterSpacing: 1 }}>
              Your description
            </Text>
            <Text selectable style={{ fontSize: 14, color: c.text, lineHeight: 21 }}>
              {job.description}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            padding: 16,
            gap: 7,
          }}>
          {vat != null ? (
            <>
              <Row label={`${job.job_type?.name} — flat rate${job.surcharge_multiplier > 1 ? ` (out-of-hours ×${job.surcharge_multiplier})` : ''}`} value={formatGBP(vat.net)} />
              <Row label={`VAT (${vat.ratePct}%)`} value={formatGBP(vat.vat)} />
            </>
          ) : (
            <Row
              label={`${job.job_type?.name} — flat rate${job.surcharge_multiplier > 1 ? ` (out-of-hours ×${job.surcharge_multiplier})` : ''}`}
              value={formatGBP(job.agreed_price_inc_vat)}
            />
          )}
          <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 7, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: c.text }}>Fixed total</Text>
            <Text selectable style={{ fontSize: 14.5, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }}>
              {formatGBP(job.agreed_price_inc_vat)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors: c } = usePalette();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ flex: 1, fontSize: 13.5, color: c.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}
