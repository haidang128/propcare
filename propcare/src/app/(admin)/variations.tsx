import { Link, useFocusEffect } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { listPendingVariations, type Variation } from '@/lib/data';
import { formatGBP } from '@/lib/job-status';

/** Variation review queue — amber = money decisions (design A2 list pane). */
export default function VariationQueue() {
  const { colors: c, status } = usePalette();
  const [variations, setVariations] = useState<Variation[] | null>(null);

  const load = useCallback(async () => {
    try {
      setVariations(await listPendingVariations());
    } catch {
      setVariations([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        padding: 20,
        gap: 10,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
      }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: c.text }}>
        Pending — {variations?.length ?? '…'}
      </Text>

      {variations !== null && variations.length === 0 ? (
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
          <BadgeCheck size={28} color={c.textTertiary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Nothing to review</Text>
          <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: 'center' }}>
            Technician-flagged extra work lands here before it reaches the landlord.
          </Text>
        </View>
      ) : null}

      {(variations ?? []).map((v) => (
        <Link key={v.id} href={{ pathname: '/(admin)/variation/[id]', params: { id: v.id } }} asChild>
          <Pressable
            style={{
              backgroundColor: c.backgroundElement,
              borderWidth: 2,
              borderColor: status.amber.dot,
              borderRadius: Radius.card,
              borderCurve: 'continuous',
              padding: 14,
              gap: 4,
            }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: c.text }} numberOfLines={1}>
                {v.note}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: status.amber.fg }}>
                {new Date(v.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={{ fontSize: 12.5, color: c.textSecondary }} numberOfLines={1}>
              {v.job?.job_type?.name ?? ''} · {v.job?.property?.address_line1 ?? ''} · job paused ·
              original {formatGBP(v.old_job_price_inc_vat)}
            </Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}
