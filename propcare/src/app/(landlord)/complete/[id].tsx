import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { CreditCard } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { StarRating } from '@/components/star-rating';
import { StatusChip } from '@/components/status-chip';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import {
  getInvoice,
  getJob,
  getJobPhotoUrls,
  getRating,
  raiseDispute,
  requestPaymentLink,
  submitRating,
  type Invoice,
  type Job,
} from '@/lib/data';
import { formatGBP } from '@/lib/job-status';

/** Completion & payment — confirm, rate, pay; 72h auto-confirm noted (design 02 §8). */
export default function CompletionAndPayment() {
  const { colors: c, status } = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [rated, setRated] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    getJob(id).then(setJob);
    getInvoice(id).then(setInvoice);
    getRating(id).then((r) => {
      if (r) {
        setStars(r.stars);
        setComment(r.comment ?? '');
        setRated(true);
      }
    });
    getJobPhotoUrls(id, 'before').then((u) => setBefore(u[0] ?? null));
    getJobPhotoUrls(id, 'after').then((u) => setAfter(u[0] ?? null));
  }, [id]);

  useEffect(load, [load]);

  if (!job) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const paid = job.status === 'paid';
  const disputed = job.status === 'disputed';

  async function confirmAndPay() {
    setPaying(true);
    try {
      if (!rated && stars > 0) {
        await submitRating(job!.id, stars, comment.trim());
        setRated(true);
      }
      const { url, error } = await requestPaymentLink(job!.id);
      if (url) {
        await Linking.openURL(url);
      } else if (error) {
        Alert.alert('Payment', error);
      }
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setPaying(false);
    }
  }

  function dispute() {
    Alert.alert(
      'Something not right?',
      'Raising a dispute pauses payment until we resolve it with you — nothing is charged in the meantime.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Raise dispute',
          style: 'destructive',
          onPress: async () => {
            try {
              await raiseDispute(job!.id, 'Landlord raised a dispute from the completion screen');
              load();
            } catch (e) {
              Alert.alert('Could not raise dispute', e instanceof Error ? e.message : 'Try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: job.reference }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 14, flexGrow: 1 }}>
        <View style={{ gap: 8 }}>
          <StatusChip status={job.status} />
          <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>
            {paid ? 'All done and paid' : disputed ? 'In dispute — payment on hold' : 'Work finished — take a look'}
          </Text>
          <Text style={{ fontSize: 14, color: c.textSecondary }}>
            {job.job_type?.name} · {job.property?.address_line1}
          </Text>
        </View>

        {(before || after) && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'BEFORE', uri: before },
              { label: 'AFTER', uri: after },
            ].map(({ label, uri }) => (
              <View key={label} style={{ flex: 1, gap: 4 }}>
                {uri ? (
                  <Image source={{ uri }} style={{ height: 104, borderRadius: 10 }} contentFit="cover" />
                ) : (
                  <View
                    style={{
                      height: 104,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderStyle: 'dashed',
                      borderColor: c.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ fontSize: 12, color: c.textTertiary }}>no photo</Text>
                  </View>
                )}
                <Text style={{ fontSize: 11, fontWeight: '700', color: c.textTertiary, textAlign: 'center' }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            padding: 16,
            gap: 8,
          }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, textAlign: 'center' }}>
            {rated ? 'Thanks for the rating' : 'How did your engineer do?'}
          </Text>
          <StarRating value={stars} onChange={rated ? undefined : setStars} disabled={rated} />
          {!rated ? (
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Add a comment (optional)"
              placeholderTextColor={c.textTertiary}
              style={{
                borderWidth: 1.5,
                borderColor: c.border,
                borderRadius: Radius.button,
                borderCurve: 'continuous',
                paddingVertical: 11,
                paddingHorizontal: 12,
                fontSize: 14,
                color: c.text,
              }}
            />
          ) : null}
        </View>

        {invoice ? (
          <View
            style={{
              backgroundColor: c.backgroundElement,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: Radius.card,
              borderCurve: 'continuous',
              padding: 16,
              gap: 8,
            }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: c.textSecondary }}>Invoice #{invoice.number}</Text>
              <Text style={{ fontSize: 14, color: c.textSecondary }}>
                {new Date().toLocaleDateString('en-GB')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Total — as approved</Text>
              <Text
                selectable
                style={{ fontSize: 26, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }}>
                {formatGBP(invoice.total_inc_vat)}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: c.textTertiary, textAlign: 'right', marginTop: -4 }}>
              inc. VAT · the fixed price you approved
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 'auto', gap: 8 }}>
          {!paid && !disputed ? (
            <>
              <Pressable
                onPress={confirmAndPay}
                disabled={paying}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? c.primaryPressed : c.primary,
                  minHeight: 52,
                  borderRadius: Radius.card,
                  borderCurve: 'continuous',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                })}>
                {paying ? (
                  <ActivityIndicator color={c.onPrimary} />
                ) : (
                  <>
                    <CreditCard size={18} color={c.onPrimary} />
                    <Text style={{ color: c.onPrimary, fontSize: 16, fontWeight: '700' }}>
                      Confirm &amp; pay {invoice ? formatGBP(invoice.total_inc_vat) : ''}
                    </Text>
                  </>
                )}
              </Pressable>
              <Text style={{ fontSize: 12, color: c.textTertiary, textAlign: 'center', lineHeight: 18 }}>
                Secure card payment via Stripe. If you don&apos;t confirm, the job auto-confirms in
                72 hours — we&apos;ll remind you first.
              </Text>
              <Pressable onPress={dispute} style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: status.red.fg }}>
                  Something wrong? Raise a dispute
                </Text>
              </Pressable>
            </>
          ) : disputed ? (
            <Text style={{ fontSize: 13.5, color: c.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              We&apos;re on it — payment is frozen while we sort this out. We&apos;ll call you.
            </Text>
          ) : (
            <PrimaryButton label="Back to home" variant="secondary" onPress={() => router.dismissTo('/(landlord)')} />
          )}
        </View>
      </ScrollView>
    </>
  );
}
