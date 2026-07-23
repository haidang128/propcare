import { useFocusEffect } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { getPilotMetrics, type PilotMetrics } from '@/lib/data';
import { formatGBP } from '@/lib/job-status';

/**
 * The 90-day gate, readable (PRD §2). Skipping the off-the-shelf pilot made the
 * build itself the validation experiment — so the numbers that decide go/no-go
 * have to be legible without a spreadsheet.
 */

type GateRow = {
  label: string;
  value: string;
  target: string;
  met: boolean | null; // null = not enough data to judge yet
  note?: string;
};

function Gate({ row }: { row: GateRow }) {
  const { colors: c, status } = usePalette();
  const pal = row.met === null ? status.amber : row.met ? status.green : status.red;
  const verdict = row.met === null ? 'No data' : row.met ? 'On track' : 'Below target';

  return (
    <View
      style={{
        backgroundColor: c.backgroundElement,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: Radius.card,
        borderCurve: 'continuous',
        padding: 14,
        gap: 6,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Text style={{ flex: 1, fontSize: 13.5, color: c.textSecondary }}>{row.label}</Text>
        <View style={{ backgroundColor: pal.bg, paddingVertical: 3, paddingHorizontal: 9, borderRadius: Radius.chip }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: pal.fg }}>{verdict}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ fontSize: 27, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }}>
          {row.value}
        </Text>
        <Text style={{ fontSize: 12.5, color: c.textTertiary }}>target {row.target}</Text>
      </View>
      {row.note ? <Text style={{ fontSize: 12, color: c.textTertiary, lineHeight: 17 }}>{row.note}</Text> : null}
    </View>
  );
}

export default function PilotMetricsScreen() {
  const { colors: c, status } = usePalette();
  const [m, setMetrics] = useState<PilotMetrics | null | undefined>(undefined);

  const load = useCallback(() => {
    getPilotMetrics()
      .then(setMetrics)
      .catch(() => setMetrics(null));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  if (m === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (m === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 21 }}>
          Metrics need a live Supabase project and an admin account.
        </Text>
      </View>
    );
  }

  const rows: GateRow[] = [
    {
      label: 'Completed jobs',
      value: String(m.completed_jobs),
      target: '≥ 30',
      // "Below target" on day one is not a finding, it is arithmetic. Until a
      // job has actually finished there is nothing to judge.
      met: m.completed_jobs === 0 ? null : m.completed_jobs >= 30,
      note:
        m.completed_jobs === 0
          ? `${m.total_jobs} job${m.total_jobs === 1 ? '' : 's'} booked so far, none finished yet. This counts jobs the technician has marked done.`
          : `${30 - m.completed_jobs > 0 ? `${30 - m.completed_jobs} to go.` : 'Target met.'}`,
    },
    {
      label: 'Per-job margin (completed + paid)',
      value: m.completed_jobs === 0 ? '—' : formatGBP(m.avg_margin),
      target: '> £0',
      met: m.completed_jobs === 0 ? null : m.avg_margin > 0,
      note:
        m.jobs_missing_cost > 0
          ? `${m.jobs_missing_cost} completed job${m.jobs_missing_cost > 1 ? 's have' : ' has'} no agreed price, so margin cannot be worked out for ${m.jobs_missing_cost > 1 ? 'them' : 'it'}.`
          : `Total ${formatGBP(m.total_margin)} across ${m.completed_jobs} job${m.completed_jobs === 1 ? '' : 's'}. Labour is the technician payout share of each price.`,
    },
    {
      label: '30-day repeat booking rate',
      value: m.cohort_landlords === 0 ? '—' : `${m.repeat_rate}%`,
      target: '≥ 25%',
      met: m.cohort_landlords === 0 ? null : m.repeat_rate >= 25,
      note:
        m.cohort_landlords === 0
          ? 'No landlord has yet had a first job more than 30 days ago, so the cohort is empty.'
          : `${m.repeat_landlords} of ${m.cohort_landlords} landlords booked again within 30 days of their first job.`,
    },
    {
      label: 'Variation rate',
      value: m.total_jobs === 0 ? '—' : `${m.variation_rate}%`,
      target: '< 20%',
      met: m.total_jobs === 0 ? null : m.variation_rate < 20,
      note: `${m.variation_jobs} of ${m.total_jobs} jobs needed a variation. Above 20% the rate card is mispriced and the "no surprise bill" promise erodes (PRD §10).`,
    },
  ];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' }}>
      <Text style={{ fontSize: 13, color: c.textSecondary, lineHeight: 19 }}>
        The four criteria that decide whether to keep investing after 90 days. Margin is revenue
        net of VAT (when registered), the technician payout share, materials, and platform
        overhead. It does not carry your own dispatch time.
      </Text>

      {/* Three of the four criteria need finished jobs before they mean
          anything. Saying so beats four amber "No data" chips. */}
      {m.completed_jobs === 0 ? (
        <View
          style={{
            backgroundColor: c.primaryTint,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            padding: 13,
            gap: 4,
          }}>
          <Text style={{ fontSize: 13.5, fontWeight: '800', color: c.primary }}>
            Nothing to measure yet
          </Text>
          <Text style={{ fontSize: 12.5, color: c.primary, lineHeight: 18 }}>
            {m.total_jobs === 0
              ? 'No jobs booked yet. These fill in on their own as work comes through.'
              : `${m.total_jobs} job${m.total_jobs === 1 ? '' : 's'} booked, but none completed — margin and repeat rate need finished, paid work before they mean anything. The page itself is working.`}
          </Text>
        </View>
      ) : null}

      {m.jobs_missing_cost > 0 ? (
        <View
          style={{
            backgroundColor: status.amber.bg,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            padding: 13,
            flexDirection: 'row',
            gap: 9,
          }}>
          <TriangleAlert size={17} color={status.amber.fg} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: status.amber.fg, lineHeight: 20 }}>
            Margin is incomplete — {m.jobs_missing_cost} completed job
            {m.jobs_missing_cost > 1 ? 's have' : ' has'} no agreed price, so there is nothing to
            take the technician payout share of.
          </Text>
        </View>
      ) : null}

      {rows.map((row) => (
        <Gate key={row.label} row={row} />
      ))}
    </ScrollView>
  );
}
