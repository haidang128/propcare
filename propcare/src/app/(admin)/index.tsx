import { Link, Stack, useFocusEffect } from 'expo-router';
import { BadgePlus, Inbox, TriangleAlert } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { PriceDisplay } from '@/components/price-display';
import { StatusChip } from '@/components/status-chip';
import { Radius } from '@/constants/theme';
import { useJobsRealtime } from '@/hooks/use-jobs-realtime';
import { usePalette } from '@/hooks/use-palette';
import { listIncomingJobs, type Job } from '@/lib/data';

/** Dispatch — incoming requests oldest-first; emergencies flagged amber (design A1 subset). */
export default function AdminDispatch() {
  const { colors: c, status } = usePalette();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setJobs(await listIncomingJobs());
    } catch {
      setJobs([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useJobsRealtime(load);

  return (
    <>
    <Stack.Screen
      options={{
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Link href="/(admin)/variations" asChild>
              <Pressable hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <BadgePlus size={18} color={c.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>Variations</Text>
              </Pressable>
            </Link>
            <Link href="/(admin)/technicians" asChild>
              <Pressable hitSlop={8}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>Techs</Text>
              </Pressable>
            </Link>
          </View>
        ),
      }}
    />
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      contentContainerStyle={{
        padding: 20,
        gap: 12,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>
          Incoming requests{jobs ? ` — ${jobs.length}` : ''}
        </Text>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.textTertiary }}>oldest first</Text>
      </View>

      {jobs !== null && jobs.length === 0 ? (
        <View
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 14,
            borderCurve: 'continuous',
            paddingVertical: 36,
            alignItems: 'center',
            gap: 10,
          }}>
          <Inbox size={28} color={c.textTertiary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Queue is clear</Text>
          <Text style={{ fontSize: 13, color: c.textSecondary }}>
            New landlord requests appear here, ready to assign.
          </Text>
        </View>
      ) : null}

      {(jobs ?? []).map((job) => {
        const emergency = job.urgency === 'out_of_hours';
        return (
          <View
            key={job.id}
            style={{
              backgroundColor: c.backgroundElement,
              borderWidth: 1,
              borderColor: emergency ? status.amber.dot : c.border,
              borderLeftWidth: emergency ? 4 : 1,
              borderRadius: Radius.card,
              borderCurve: 'continuous',
              padding: 16,
              gap: 10,
            }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: c.text }}>
                  {emergency ? 'EMERGENCY · ' : ''}
                  {job.job_type?.name ?? job.description.slice(0, 48)}
                </Text>
                <Text style={{ fontSize: 12.5, color: c.textSecondary }}>
                  {job.property?.address_line1}, {job.property?.postcode} · {job.reference}
                </Text>
              </View>
              <PriceDisplay amount={job.agreed_price_inc_vat} />
            </View>

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusChip status={job.status} />
              {emergency ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: status.amber.bg,
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: Radius.chip,
                  }}>
                  <TriangleAlert size={12} color={status.amber.fg} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: status.amber.fg }}>
                    Out-of-hours · ×{job.surcharge_multiplier}
                  </Text>
                </View>
              ) : null}
              {job.category === 'electrical' ? (
                <View
                  style={{
                    backgroundColor: status.green.bg,
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: Radius.chip,
                  }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: status.green.fg }}>
                    Needs NICEIC/NAPIT
                  </Text>
                </View>
              ) : null}
            </View>

            <Link href={{ pathname: '/(admin)/assign/[jobId]', params: { jobId: job.id } }} asChild>
              <Pressable
                style={{
                  backgroundColor: c.primary,
                  minHeight: 40,
                  borderRadius: Radius.button,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ color: c.onPrimary, fontSize: 13.5, fontWeight: '700' }}>Assign</Text>
              </Pressable>
            </Link>
          </View>
        );
      })}
    </ScrollView>
    </>
  );
}
