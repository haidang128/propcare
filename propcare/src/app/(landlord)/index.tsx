import { Link, useFocusEffect } from 'expo-router';
import { Droplets, Hammer, Lightbulb, Wrench, Zap } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { PriceDisplay } from '@/components/price-display';
import { StatusChip } from '@/components/status-chip';
import { Radius } from '@/constants/theme';
import { useJobsRealtime } from '@/hooks/use-jobs-realtime';
import { usePalette } from '@/hooks/use-palette';
import { listActiveJobs, listProperties, type Job, type Property } from '@/lib/data';

/** Landlord home — active jobs with live status, properties at a glance, New request CTA. */
export default function LandlordHome() {
  const { colors: c } = usePalette();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [j, p] = await Promise.all([listActiveJobs(), listProperties()]);
      setJobs(j);
      setProperties(p);
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

  const empty = jobs !== null && jobs.length === 0;

  return (
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
      contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Link href="/(landlord)/new-request" asChild>
        <Pressable
          style={{
            backgroundColor: c.primary,
            minHeight: 54,
            borderRadius: 14,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(15,76,129,0.25)',
          }}>
          <Text style={{ color: c.onPrimary, fontSize: 16, fontWeight: '700' }}>
            ＋ New request
          </Text>
        </Pressable>
      </Link>

      {empty ? (
        <EmptyState />
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Active jobs</Text>
          {(jobs ?? []).map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </View>
      )}

      {properties.length > 0 ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Properties</Text>
            <Link href="/(landlord)/add-property" asChild>
              <Pressable hitSlop={8}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>＋ Add</Text>
              </Pressable>
            </Link>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {properties.map((p) => {
              const activeCount = (jobs ?? []).filter((j) => j.property_id === p.id).length;
              return (
                <Link key={p.id} href={{ pathname: '/(landlord)/property/[id]', params: { id: p.id } }} asChild>
                  <Pressable
                    style={{
                      flexGrow: 1,
                      minWidth: 100,
                      backgroundColor: c.backgroundElement,
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: Radius.card,
                      borderCurve: 'continuous',
                      padding: 12,
                    }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: c.text }}>
                      {p.address_line1}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: c.textTertiary }}>
                      {activeCount === 0 ? 'history →' : `${activeCount} active`}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function JobCard({ job }: { job: Job }) {
  const { colors: c } = usePalette();
  const Icon = job.category === 'plumbing' ? Droplets : job.category === 'electrical' ? Zap : Hammer;
  const title = job.job_type?.name ?? job.description.slice(0, 40) ?? 'Job';
  const needsReview = job.status === 'variation_pending';
  const needsPayment = job.status === 'completed' || job.status === 'disputed';

  return (
    <Link
      href={
        needsReview
          ? { pathname: '/(landlord)/variation/[jobId]', params: { jobId: job.id } }
          : needsPayment
            ? { pathname: '/(landlord)/complete/[id]', params: { id: job.id } }
            : { pathname: '/(landlord)/job/[id]', params: { id: job.id } }
      }
      asChild>
      <Pressable
        style={{
          backgroundColor: c.backgroundElement,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: Radius.card,
          borderCurve: 'continuous',
          padding: 14,
          gap: 9,
        }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 11, alignItems: 'center', flex: 1 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor: c.primaryTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon size={19} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
                {title}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.textSecondary }}>
                {job.property?.address_line1 ?? ''}
              </Text>
            </View>
          </View>
          <PriceDisplay amount={job.agreed_price_inc_vat} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <StatusChip status={job.status} />
          {needsReview ? (
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.primary }}>Review →</Text>
          ) : job.status === 'completed' ? (
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.primary }}>Confirm &amp; pay →</Text>
          ) : job.scheduled_start ? (
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.textTertiary }}>
              {new Date(job.scheduled_start).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
              })}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

function EmptyState() {
  const { colors: c } = usePalette();
  return (
    <>
      <View
        style={{
          backgroundColor: c.backgroundElement,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 14,
          borderCurve: 'continuous',
          paddingVertical: 32,
          paddingHorizontal: 24,
          alignItems: 'center',
          gap: 10,
          marginTop: 8,
        }}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: c.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Wrench size={28} color={c.primary} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>
          No jobs yet — and that&apos;s fine
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: c.textSecondary,
            lineHeight: 21,
            textAlign: 'center',
            maxWidth: 270,
          }}>
          When something needs fixing, book it here. You&apos;ll see the fixed price before you
          commit.
        </Text>
      </View>
      <View
        style={{
          backgroundColor: c.primaryTint,
          borderRadius: Radius.card,
          borderCurve: 'continuous',
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          gap: 10,
          alignItems: 'flex-start',
        }}>
        <Lightbulb size={17} color={c.primary} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: 13, color: c.primary, fontWeight: '600', lineHeight: 19 }}>
          Tip: add your other properties now so booking takes seconds when something breaks.
        </Text>
      </View>
    </>
  );
}
