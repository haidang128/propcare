import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LockKeyhole } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { PriceDisplay } from '@/components/price-display';
import { PrimaryButton } from '@/components/primary-button';
import { StatusChip } from '@/components/status-chip';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import {
  decideVariation,
  getJobPhotoUrls,
  getPendingVariationForJob,
  type Variation,
} from '@/lib/data';
import { formatGBP } from '@/lib/job-status';

/**
 * Variation approval — the "no surprise bills" promise made real: the landlord
 * is being asked, not billed (design 02 §7). Prices move only via the
 * decide_variation RPC.
 */
export default function VariationApproval() {
  const { colors: c, status } = usePalette();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [variation, setVariation] = useState<Variation | null | undefined>(undefined);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPendingVariationForJob(jobId).then(setVariation);
    getJobPhotoUrls(jobId, 'variation').then(setPhotoUrls);
  }, [jobId]);

  if (variation === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (variation === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 }}>
          Nothing needs your approval on this job right now.
        </Text>
      </View>
    );
  }

  const extra = variation.admin_price_inc_vat ?? 0;
  const newTotal = variation.old_job_price_inc_vat + extra;
  const techFirst = 'Your engineer';

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      await decideVariation(variation!, approve);
      router.back();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 14, flexGrow: 1 }}>
      <View style={{ gap: 8 }}>
        <StatusChip status="variation_pending" label="Waiting for your approval — job paused" />
        <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>
          {techFirst} found extra work
        </Text>
        <Text style={{ fontSize: 14, color: c.textSecondary, lineHeight: 21 }}>
          &ldquo;{variation.note}&rdquo;
        </Text>
      </View>

      {photoUrls.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {photoUrls.slice(0, 2).map((url) => (
            <Image
              key={url}
              source={{ uri: url }}
              style={{ flex: 1, height: 110, borderRadius: 10 }}
              contentFit="cover"
            />
          ))}
        </View>
      ) : null}

      <View
        style={{
          backgroundColor: c.backgroundElement,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 14,
          borderCurve: 'continuous',
          padding: 16,
          gap: 10,
        }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontSize: 14, color: c.textSecondary }}>Original fixed price</Text>
          <PriceDisplay amount={variation.old_job_price_inc_vat} variant="superseded" />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 14, color: c.textSecondary }}>
            {variation.note.split(' — ')[0]} (parts + labour)
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] }}>
            +{formatGBP(extra)}
          </Text>
        </View>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: c.border,
            paddingTop: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LockKeyhole size={14} color={c.primary} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>New fixed price</Text>
          </View>
          <Text
            selectable
            style={{ fontSize: 30, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}>
            {formatGBP(newTotal)}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: c.textTertiary, textAlign: 'right', marginTop: -6 }}>
          inc. VAT · checked by PropCare before reaching you
        </Text>
      </View>

      <View style={{ marginTop: 'auto', gap: 8 }}>
        <PrimaryButton label={`Approve new price — ${formatGBP(newTotal)}`} loading={busy} onPress={() => decide(true)} />
        <Pressable
          onPress={() =>
            Alert.alert(
              'Decline the extra work?',
              "The job pauses and you won't be charged — we'll call you to rearrange or cancel.",
              [
                { text: 'Back', style: 'cancel' },
                { text: 'Decline', style: 'destructive', onPress: () => decide(false) },
              ],
            )
          }
          disabled={busy}
          style={{
            minHeight: 48,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            borderWidth: 1.5,
            borderColor: status.red.bg,
            backgroundColor: c.backgroundElement,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: status.red.fg }}>Decline extra work</Text>
        </Pressable>
        <Text style={{ fontSize: 12, color: c.textTertiary, textAlign: 'center', lineHeight: 18 }}>
          Declining pauses the job — you won&apos;t be charged; we&apos;ll call you to rearrange or
          cancel.
        </Text>
      </View>
    </ScrollView>
  );
}
