import { Link, useFocusEffect } from 'expo-router';
import { BadgePlus, ChartColumn, Inbox, TriangleAlert, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { NavRow, type NavItem } from '@/components/nav-row';
import { PriceDisplay } from '@/components/price-display';
import { PrimaryButton } from '@/components/primary-button';
import { StatusChip } from '@/components/status-chip';
import { Radius } from '@/constants/theme';
import { useJobsRealtime } from '@/hooks/use-jobs-realtime';
import { usePalette } from '@/hooks/use-palette';
import { listIncomingJobs, listJobsInFlight, quoteJob, type DispatchJob, type Job } from '@/lib/data';

const ADMIN_SECTIONS: NavItem[] = [
  { href: '/(admin)/variations', label: 'Variations', icon: BadgePlus },
  { href: '/(admin)/technicians', label: 'Technicians', icon: Users },
  { href: '/(admin)/metrics', label: '90-day gate', icon: ChartColumn },
];

function slotLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Putting a price on a request the rate card does not cover. The floor and the
 * "only a job still awaiting its quote" rule are both enforced in the RPC —
 * this form only has to be quick to use.
 */
function QuoteForm({ job, onQuoted }: { job: Job; onQuoted: () => void }) {
  const { colors: c } = usePalette();
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  async function send() {
    const parsed = Number(price.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showDialog('Enter a price', 'The landlord sees one number and approves it or does not.');
      return;
    }
    setSaving(true);
    try {
      await quoteJob(job.id, parsed);
      setPrice('');
      onQuoted();
    } catch (e) {
      showDialog('Could not send the quote', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: c.textSecondary }}>£</Text>
      <TextInput
        value={price}
        onChangeText={setPrice}
        placeholder="0.00"
        placeholderTextColor={c.textTertiary}
        keyboardType="decimal-pad"
        onSubmitEditing={send}
        style={{
          flex: 1,
          borderWidth: 1.5,
          borderColor: c.inputBorder,
          borderRadius: Radius.button,
          borderCurve: 'continuous',
          paddingVertical: 9,
          paddingHorizontal: 12,
          fontSize: 15,
          fontWeight: '700',
          color: c.text,
          fontVariant: ['tabular-nums'],
          backgroundColor: c.background,
        }}
      />
      <View style={{ minWidth: 150 }}>
        <PrimaryButton label="Send to landlord" loading={saving} onPress={send} />
      </View>
    </View>
  );
}

/** Dispatch — incoming requests oldest-first; emergencies flagged amber (design A1 subset). */
export default function AdminDispatch() {
  const { colors: c, status } = usePalette();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [inFlight, setInFlight] = useState<DispatchJob[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [incoming, live] = await Promise.all([listIncomingJobs(), listJobsInFlight()]);
      setJobs(incoming);
      setInFlight(live);
    } catch {
      setJobs([]);
      setInFlight([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useJobsRealtime(load);

  // a request with no price is not assignable yet — it needs a number first
  const needsQuote = (jobs ?? []).filter((j) => j.agreed_price_inc_vat == null);
  const readyToAssign = (jobs ?? []).filter((j) => j.agreed_price_inc_vat != null);

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
      contentContainerStyle={{
        padding: 20,
        gap: 12,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
      }}>
      <NavRow items={ADMIN_SECTIONS} />

      {needsQuote.length > 0 ? (
        <>
          <Text style={{ fontSize: 16, fontWeight: '700', color: status.amber.fg }}>
            Waiting on your price — {needsQuote.length}
          </Text>
          {needsQuote.map((job) => (
            <View
              key={job.id}
              style={{
                backgroundColor: c.backgroundElement,
                borderWidth: 2,
                borderColor: status.amber.dot,
                borderRadius: Radius.card,
                borderCurve: 'continuous',
                padding: 16,
                gap: 10,
              }}>
              <View>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: c.text }}>
                  {job.job_type?.name ?? 'Request'} · {job.category}
                </Text>
                <Text style={{ fontSize: 12.5, color: c.textSecondary }}>
                  {job.property?.address_line1}, {job.property?.postcode} · {job.reference}
                </Text>
              </View>
              <Text selectable style={{ fontSize: 14, color: c.text, lineHeight: 21 }}>
                {job.description}
              </Text>
              {job.preferred_slot_start ? (
                <Text style={{ fontSize: 12.5, color: c.textTertiary }}>
                  Landlord would like: {slotLabel(job.preferred_slot_start)}
                </Text>
              ) : null}
              <QuoteForm job={job} onQuoted={load} />
            </View>
          ))}
        </>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>
          Ready to assign{jobs ? ` — ${readyToAssign.length}` : ''}
        </Text>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.textTertiary }}>oldest first</Text>
      </View>

      {jobs !== null && readyToAssign.length === 0 ? (
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

      {readyToAssign.map((job) => {
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
                  {job.quantity > 1 ? ` × ${job.quantity}h` : ''}
                </Text>
                <Text style={{ fontSize: 12.5, color: c.textSecondary }}>
                  {job.property?.address_line1}, {job.property?.postcode} · {job.reference}
                </Text>
              </View>
              <PriceDisplay amount={job.agreed_price_inc_vat} />
            </View>

            {/* The dispatcher schedules; the landlord's preference is the input
                to that, and used to be silently discarded at insert. */}
            {job.preferred_slot_start ? (
              <Text style={{ fontSize: 12.5, color: c.textTertiary }}>
                Landlord would like: {slotLabel(job.preferred_slot_start)} — the tenant is offered
                this and the two days after
              </Text>
            ) : null}

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

      {/* Everything already assigned. Without this the board went quiet the
          moment a job was assigned — no way to see who was on what, or that
          anyone had started. */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginTop: 8 }}>
        Under way{inFlight ? ` — ${inFlight.length}` : ''}
      </Text>
      {inFlight !== null && inFlight.length === 0 ? (
        <Text style={{ fontSize: 13, color: c.textSecondary }}>
          Nothing on site right now. Assigned jobs stay here until they&apos;re paid.
        </Text>
      ) : null}
      {/* Read-only on purpose: a job that needs reassigning comes back to the
          queue above when the technician declines, and re-opening the assign
          sheet here would mint a second tenant access link. */}
      {(inFlight ?? []).map((job) => (
        <View
          key={job.id}
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            padding: 14,
            gap: 8,
          }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                {job.job_type?.name ?? 'Job'} · {job.reference}
              </Text>
              <Text style={{ fontSize: 12.5, color: c.textSecondary }}>
                {job.property?.address_line1} · {job.technician?.full_name ?? 'unassigned'}
                {job.scheduled_start
                  ? ` · ${slotLabel(job.scheduled_start)}`
                  : ' · tenant has not confirmed a slot'}
              </Text>
            </View>
            <PriceDisplay amount={job.agreed_price_inc_vat} />
          </View>
          <StatusChip status={job.status} />
        </View>
      ))}
    </ScrollView>
  );
}
