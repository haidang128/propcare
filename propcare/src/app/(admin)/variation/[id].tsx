import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LockKeyhole } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { PriceDisplay } from '@/components/price-display';
import { PrimaryButton } from '@/components/primary-button';
import { StatusChip } from '@/components/status-chip';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import {
  getJobPhotoUrls,
  getVariation,
  rejectVariation,
  sendVariationToLandlord,
  type Variation,
} from '@/lib/data';
import { formatGBP } from '@/lib/job-status';
import { incVatCaption, incVatSuffix } from '@/lib/pricing';

/**
 * Variation review — admin prices the extra work and previews exactly what
 * the landlord will see before sending (design A2 detail pane).
 */
export default function VariationReview() {
  const { colors: c, status } = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [variation, setVariation] = useState<Variation | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getVariation(id).then((v) => {
      setVariation(v);
      if (v?.suggested_price_inc_vat != null) setPrice(String(v.suggested_price_inc_vat));
      if (v) getJobPhotoUrls(v.job_id, 'variation').then(setPhotoUrls);
    });
  }, [id]);

  if (!variation) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const parsedPrice = parseFloat(price.replace(',', '.'));
  const priceValid = Number.isFinite(parsedPrice) && parsedPrice > 0;
  const newTotal = priceValid ? variation.old_job_price_inc_vat + parsedPrice : null;

  async function send() {
    if (!priceValid || !variation) return;
    setBusy(true);
    try {
      await sendVariationToLandlord(variation.id, Math.round(parsedPrice * 100) / 100);
      router.back();
    } catch (e) {
      showDialog('Could not send', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  function reject() {
    showDialog(
      'Reject this variation?',
      'The job resumes at the original price and the technician is expected to complete the original scope.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await rejectVariation(variation!);
              router.back();
            } catch (e) {
              showDialog('Could not reject', e instanceof Error ? e.message : 'Try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        padding: 20,
        gap: 14,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
        flexGrow: 1,
      }}>
      <View style={{ gap: 6 }}>
        <StatusChip status="variation_pending" label="Job paused — technician waiting on site" />
        <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>{variation.note}</Text>
        <Text style={{ fontSize: 13, color: c.textSecondary }}>
          {variation.job?.reference} · {variation.job?.job_type?.name} ·{' '}
          {variation.job?.property?.address_line1}
        </Text>
      </View>

      {photoUrls.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {photoUrls.map((url) => (
            <Image key={url} source={{ uri: url }} style={{ width: 150, height: 110, borderRadius: 12 }} contentFit="cover" />
          ))}
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
          gap: 10,
        }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: c.text }}>Price the variation</Text>
        {variation.suggested_price_inc_vat != null ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13.5, color: c.textSecondary }}>Suggested (rate card)</Text>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] }}>
              {formatGBP(variation.suggested_price_inc_vat)}
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 13.5, color: c.textSecondary }}>
            Your price{incVatSuffix() ? ` (${incVatCaption()})` : ''}
          </Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor={c.textTertiary}
            keyboardType="decimal-pad"
            style={{
              borderWidth: 2,
              borderColor: c.primary,
              borderRadius: 9,
              borderCurve: 'continuous',
              paddingVertical: 8,
              paddingHorizontal: 14,
              fontSize: 17,
              fontWeight: '800',
              color: c.text,
              minWidth: 110,
              textAlign: 'right',
              fontVariant: ['tabular-nums'],
              backgroundColor: c.background,
            }}
          />
        </View>
      </View>

      <View
        style={{
          backgroundColor: c.primaryTint,
          borderWidth: 1.5,
          borderColor: c.primaryTintBorder,
          borderRadius: Radius.card,
          borderCurve: 'continuous',
          padding: 16,
          gap: 6,
        }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: c.primary }}>
          What the landlord will see
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13.5, color: c.textSecondary }}>Original fixed price</Text>
          <PriceDisplay amount={variation.old_job_price_inc_vat} variant="superseded" />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13.5, color: c.textSecondary }} numberOfLines={1}>
            {variation.note.split(' — ')[0]}
          </Text>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] }}>
            {priceValid ? `+${formatGBP(parsedPrice)}` : '+£—'}
          </Text>
        </View>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: c.primaryTintBorder,
            paddingTop: 8,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LockKeyhole size={14} color={c.primary} />
            <Text style={{ fontSize: 13.5, fontWeight: '800', color: c.primary }}>New fixed price</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }}>
            {newTotal != null ? formatGBP(newTotal) : '£—'}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 'auto', gap: 8 }}>
        <PrimaryButton label="Approve & send to landlord" disabled={!priceValid} loading={busy} onPress={send} />
        <Pressable onPress={reject} disabled={busy} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: status.red.fg }}>Reject variation</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
