import { Link, Stack, useFocusEffect } from 'expo-router';
import { CalendarDays, Check, KeyRound } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { StatusChip } from '@/components/status-chip';
import { useJobsRealtime } from '@/hooks/use-jobs-realtime';
import { usePalette } from '@/hooks/use-palette';
import { listAssignedJobs, respondToAssignment, type Job } from '@/lib/data';

function timeWindow(job: Job): { big: string; small: string } {
  if (!job.scheduled_start) return { big: '—', small: '' };
  const s = new Date(job.scheduled_start);
  const e = job.scheduled_end ? new Date(job.scheduled_end) : null;
  const t = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return { big: t(s), small: e ? `–${t(e)}` : '' };
}

/** Technician today — big targets, glanceable, access details up front (design T1). */
export default function TechnicianToday() {
  const { colors: c, status: statusColors } = usePalette();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setJobs(await listAssignedJobs());
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

  async function respond(job: Job, accept: boolean) {
    try {
      await respondToAssignment(job.id, accept);
      await load();
    } catch (e) {
      showDialog('Could not respond', e instanceof Error ? e.message : 'Try again.');
    }
  }

  return (
    <>
    <Stack.Screen
      options={{
        headerRight: () => (
          <Link href="/(technician)/profile" asChild>
            <Pressable hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>Profile</Text>
            </Pressable>
          </Link>
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
      contentContainerStyle={{ padding: 20, gap: 12 }}>
      {jobs !== null && jobs.length === 0 ? (
        <View
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 16,
            borderCurve: 'continuous',
            paddingVertical: 36,
            paddingHorizontal: 24,
            alignItems: 'center',
            gap: 10,
            marginTop: 24,
          }}>
          <CalendarDays size={28} color={c.textTertiary} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>No jobs assigned yet</Text>
          <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 21 }}>
            When the office assigns you a job it appears here with time, address, and access
            details.
          </Text>
        </View>
      ) : null}

      {(jobs ?? []).map((job, i) => {
        const { big, small } = timeWindow(job);
        const isNext = i === 0;
        return (
          <Link
            key={job.id}
            href={{ pathname: '/(technician)/job/[id]', params: { id: job.id } }}
            asChild>
            <Pressable
              style={{
                backgroundColor: c.backgroundElement,
                borderWidth: isNext ? 2 : 1,
                borderColor: isNext ? c.primary : c.border,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 18,
                gap: 10,
              }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontVariant: ['tabular-nums'], color: c.text }}>
                  <Text style={{ fontSize: 26, fontWeight: '800' }}>{big}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: c.textTertiary }}>{small}</Text>
                </Text>
                <StatusChip status={job.status} label={isNext ? undefined : undefined} />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>
                  {job.job_type?.name ?? 'Job'}
                </Text>
                <Text style={{ fontSize: 15, color: c.textSecondary, lineHeight: 21 }}>
                  {job.property?.address_line1}
                  {job.property?.address_line2 ? `, ${job.property.address_line2}` : ''}{' '}
                  {job.property?.postcode ?? ''}
                </Text>
              </View>
              {job.property?.tenant_name ? (
                <View
                  style={{
                    backgroundColor: c.background,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    paddingVertical: 11,
                    paddingHorizontal: 13,
                    flexDirection: 'row',
                    gap: 9,
                    alignItems: 'flex-start',
                  }}>
                  <KeyRound size={17} color={c.textSecondary} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.text, lineHeight: 20 }}>
                    Tenant {job.property.tenant_name}
                    {job.property.tenant_phone ? ` · ${job.property.tenant_phone}` : ''}
                  </Text>
                </View>
              ) : null}
              {!job.technician_accepted_at && job.status === 'scheduled' ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => respond(job, true)}
                    style={{
                      flex: 1,
                      backgroundColor: statusColors.green.bg,
                      minHeight: 52,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}>
                    <Check size={18} color={statusColors.green.fg} strokeWidth={3} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: statusColors.green.fg }}>
                      Accept
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      showDialog('Decline this job?', 'It goes back to the office for reassignment.', [
                        { text: 'Keep it', style: 'cancel' },
                        { text: 'Decline', style: 'destructive', onPress: () => respond(job, false) },
                      ])
                    }
                    style={{
                      flex: 1,
                      backgroundColor: c.backgroundElement,
                      borderWidth: 1.5,
                      borderColor: c.border,
                      minHeight: 52,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: c.textSecondary }}>
                      Decline
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          </Link>
        );
      })}
    </ScrollView>
    </>
  );
}
